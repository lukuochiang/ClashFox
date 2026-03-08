const stageEl = document.getElementById('trayStage');
const menuRootEl = document.getElementById('menuRoot');
const headerEl = document.getElementById('menuHeader');
const chartEl = document.getElementById('menuChart');
const chartTopLabelEl = document.getElementById('menuChartTopLabel');
const chartBottomLabelEl = document.getElementById('menuChartBottomLabel');
const chartTopTotalEl = document.getElementById('menuChartTopTotal');
const chartBottomTotalEl = document.getElementById('menuChartBottomTotal');
const chartBarsEl = document.getElementById('menuChartBars');
const chartLeftTimeEl = document.getElementById('menuChartLeftTime');
const chartRightTimeEl = document.getElementById('menuChartRightTime');
const providerTrafficEl = document.getElementById('menuProviderTraffic');
const listEl = document.getElementById('menuList');
let menuData = null;
let activeSubmenuKey = null;
let activeSubmenuAnchor = null;
let lastHeightSent = 0;
let lastWidthSent = 0;
let blockClickUntil = 0;
let menuVersion = 0;
let menuResizeObserver = null;
let menuMutationObserver = null;
let geometryRaf = 0;
const TRAFFIC_HISTORY_POINTS = 520;
const TRAFFIC_INTERVAL_MS = 1000;
const OVERVIEW_INTERVAL_MS = 5000;
const SETTINGS_CACHE_MS = 10000;
const TRAFFIC_CACHE_KEY = 'clashfox.trayMenuTrafficCache.v1';
const TRAFFIC_CACHE_MAX_AGE_MS = 15 * 60 * 1000;
const trafficState = {
  trafficTimer: null,
  overviewTimer: null,
  trafficLoading: false,
  overviewLoading: false,
  trafficRxBytes: null,
  trafficTxBytes: null,
  trafficAt: 0,
  lastTrafficAt: 0,
  lastRateRx: null,
  lastRateTx: null,
  lastTotalRx: null,
  lastTotalTx: null,
  historyRx: [],
  historyTx: [],
  settings: null,
  settingsAt: 0,
  chartEnabled: true,
};
const providerTrafficState = {
  rotateTimer: null,
  index: 0,
  paused: false,
  signature: '',
};

async function applyTrayTheme() {
  try {
    if (!document.body) {
      return;
    }
    let preference = '';
    if (window.clashfox && typeof window.clashfox.readSettings === 'function') {
      const response = await window.clashfox.readSettings();
      const settings = response && response.ok && response.data && typeof response.data === 'object'
        ? response.data
        : null;
      preference = String(
        (settings && settings.theme)
        || (settings && settings.appearance && settings.appearance.theme)
        || '',
      ).trim().toLowerCase();
    }
    let theme = '';
    if (preference === 'day' || preference === 'light') {
      theme = 'day';
    } else if (preference === 'night' || preference === 'dark') {
      theme = 'night';
    } else {
      theme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'night'
        : 'day';
    }
    document.body.dataset.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
  } catch {
    const fallback = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'night'
      : 'day';
    if (document.body) {
      document.body.dataset.theme = fallback;
      document.documentElement.setAttribute('data-theme', fallback);
    }
  }
}

function persistTrafficCache() {
  try {
    localStorage.setItem(TRAFFIC_CACHE_KEY, JSON.stringify({
      savedAt: Date.now(),
      historyRx: trafficState.historyRx.slice(-TRAFFIC_HISTORY_POINTS),
      historyTx: trafficState.historyTx.slice(-TRAFFIC_HISTORY_POINTS),
      lastRateRx: trafficState.lastRateRx,
      lastRateTx: trafficState.lastRateTx,
      lastTotalRx: trafficState.lastTotalRx,
      lastTotalTx: trafficState.lastTotalTx,
      trafficRxBytes: trafficState.trafficRxBytes,
      trafficTxBytes: trafficState.trafficTxBytes,
      trafficAt: trafficState.trafficAt,
      lastTrafficAt: trafficState.lastTrafficAt,
    }));
  } catch {
    // ignore cache persistence failures
  }
}

function restoreTrafficCache() {
  try {
    const raw = localStorage.getItem(TRAFFIC_CACHE_KEY);
    if (!raw) {
      return false;
    }
    const parsed = JSON.parse(raw);
    const savedAt = Number(parsed && parsed.savedAt);
    if (!Number.isFinite(savedAt) || (Date.now() - savedAt) > TRAFFIC_CACHE_MAX_AGE_MS) {
      localStorage.removeItem(TRAFFIC_CACHE_KEY);
      return false;
    }
    const historyRx = Array.isArray(parsed.historyRx) ? parsed.historyRx : [];
    const historyTx = Array.isArray(parsed.historyTx) ? parsed.historyTx : [];
    trafficState.historyRx = historyRx
      .map((value) => Number.parseFloat(value))
      .filter((value) => Number.isFinite(value) && value >= 0)
      .slice(-TRAFFIC_HISTORY_POINTS);
    trafficState.historyTx = historyTx
      .map((value) => Number.parseFloat(value))
      .filter((value) => Number.isFinite(value) && value >= 0)
      .slice(-TRAFFIC_HISTORY_POINTS);
    trafficState.lastRateRx = Number.isFinite(parsed.lastRateRx) ? parsed.lastRateRx : Number.parseFloat(parsed.lastRateRx);
    trafficState.lastRateTx = Number.isFinite(parsed.lastRateTx) ? parsed.lastRateTx : Number.parseFloat(parsed.lastRateTx);
    trafficState.lastTotalRx = Number.isFinite(parsed.lastTotalRx) ? parsed.lastTotalRx : Number.parseFloat(parsed.lastTotalRx);
    trafficState.lastTotalTx = Number.isFinite(parsed.lastTotalTx) ? parsed.lastTotalTx : Number.parseFloat(parsed.lastTotalTx);
    trafficState.trafficRxBytes = Number.isFinite(parsed.trafficRxBytes) ? parsed.trafficRxBytes : Number.parseFloat(parsed.trafficRxBytes);
    trafficState.trafficTxBytes = Number.isFinite(parsed.trafficTxBytes) ? parsed.trafficTxBytes : Number.parseFloat(parsed.trafficTxBytes);
    trafficState.trafficAt = Number.isFinite(parsed.trafficAt) ? parsed.trafficAt : Number.parseFloat(parsed.trafficAt);
    trafficState.lastTrafficAt = Number.isFinite(parsed.lastTrafficAt) ? parsed.lastTrafficAt : Number.parseFloat(parsed.lastTrafficAt);
    renderTrafficBars();
    updateChartTimeLabels();
    setOverlayLabels();
    return trafficState.historyRx.length > 0 || trafficState.historyTx.length > 0;
  } catch {
    return false;
  }
}

const ICON_SVGS = {
  showMain: '<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="14" rx="2"/><path d="M4 9h16"/></svg>',
  networkTakeover: '<svg viewBox="0 0 24 24"><path d="M4 10a12 12 0 0 1 16 0"/><path d="M7 13a8 8 0 0 1 10 0"/><path d="M10 16a4 4 0 0 1 4 0"/><circle cx="12" cy="19" r="1"/></svg>',
  outboundMode: '<svg viewBox="0 0 24 24"><path d="M4 8h11"/><path d="M12 5l3 3-3 3"/><path d="M20 16H9"/><path d="M12 13l-3 3 3 3"/></svg>',
  dashboard: '<svg viewBox="0 0 24 24"><path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20v-4"/></svg>',
  trackers: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.6"/><path d="M3.8 12h16.4"/><path d="M12 3.4c2.7 2.2 2.7 15 0 17.2"/><path d="M12 3.4c-2.7 2.2-2.7 15 0 17.2"/><path d="M6.2 7.1c1.7 1 3.7 1.6 5.8 1.6s4.1-.6 5.8-1.6"/><path d="M6.2 16.9c1.7-1 3.7-1.6 5.8-1.6s4.1.6 5.8 1.6"/></svg>',
  foxboard: '<svg viewBox="0 0 24 24"><path d="M4 13.4a8 8 0 0 1 16 0"/><path d="M12 13l4-4"/><circle cx="12" cy="13" r="1.2"/><path d="M4 15.6h16"/><path d="M5 18h14"/></svg>',
  kernelManager: '<svg viewBox="0 0 24 24"><rect x="7" y="7" width="10" height="10" rx="2"/><path d="M3 10h2M3 14h2M19 10h2M19 14h2M10 3v2M14 3v2M10 19v2M14 19v2"/></svg>',
  settings: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a1.7 1.7 0 0 1-2.4 2.4l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a1.7 1.7 0 1 1-3.4 0v-.2a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a1.7 1.7 0 0 1-2.4-2.4l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H6a1.7 1.7 0 1 1 0-3.4h.2a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a1.7 1.7 0 0 1 2.4-2.4l.1.1a1 1 0 0 0 1.1.2 1 1 0 0 0 .6-.9V6a1.7 1.7 0 1 1 3.4 0v.2a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a1.7 1.7 0 0 1 2.4 2.4l-.1.1a1 1 0 0 0-.2 1.1 1 1 0 0 0 .9.6h.2a1.7 1.7 0 1 1 0 3.4h-.2a1 1 0 0 0-.9.6z"/></svg>',
  checkUpdate: '<svg viewBox="0 0 24 24"><path d="M12 4v10"/><path d="M8 10l4 4 4-4"/><path d="M5 19h14"/></svg>',
  quit: '<svg viewBox="0 0 24 24"><path d="M12 3v9"/><circle cx="12" cy="13" r="8"/></svg>',
  systemProxy: '<svg viewBox="0 0 24 24"><path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6l7-3z"/></svg>',
  tun: '<svg viewBox="0 0 24 24"><path d="M3 12h8"/><path d="M13 12h8"/><path d="M9 8l4 4-4 4"/></svg>',
  currentService: '<svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/></svg>',
  connectivityQuality: '<svg viewBox="0 0 24 24"><path d="M4 16h3M10 12h3M16 8h4"/></svg>',
  copyShellExport: '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2"/><rect x="4" y="4" width="11" height="11" rx="2"/></svg>',
  modeGlobal: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/></svg>',
  modeRule: '<svg viewBox="0 0 24 24"><path d="M5 6h14M5 12h14M5 18h14"/><circle cx="9" cy="6" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="11" cy="18" r="1"/></svg>',
  modeDirect: '<svg viewBox="0 0 24 24"><path d="M4 12h14"/><path d="M14 8l4 4-4 4"/></svg>',
  kernelStart: '<svg viewBox="0 0 24 24"><path d="M8 6l10 6-10 6z"/></svg>',
  kernelStop: '<svg viewBox="0 0 24 24"><rect x="7" y="7" width="10" height="10" rx="1.5"/></svg>',
  kernelRestart: '<svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v6h-6"/></svg>',
  directory: '<svg viewBox="0 0 24 24"><path d="M3 7h7l2 2h9v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/><path d="M3 7V5a2 2 0 0 1 2-2h5l2 2h9a2 2 0 0 1 2 2v2"/></svg>',
  folder: '<svg viewBox="0 0 24 24"><path d="M3 7h7l2 2h9v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/><path d="M3 7V5a2 2 0 0 1 2-2h5l2 2h9"/></svg>',
  userDir: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.2"/><path d="M5 19a7 7 0 0 1 14 0v1H5z"/></svg>',
  configDir: '<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="14" rx="2"/><path d="M8 9h8M8 13h5"/></svg>',
  workDir: '<svg viewBox="0 0 24 24"><path d="M4 9h16v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9z"/><path d="M8 9V7a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M4 12h16"/></svg>',
  logDir: '<svg viewBox="0 0 24 24"><path d="M6 4h9l3 3v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><path d="M9 11h6M9 15h6"/></svg>',
};

function formatBytes(value) {
  const num = Number.parseFloat(value);
  if (!Number.isFinite(num) || num < 0) {
    return '-';
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = num;
  let idx = 0;
  while (size >= 1024 && idx < units.length - 1) {
    size /= 1024;
    idx += 1;
  }
  const fixed = size >= 100 ? 0 : size >= 10 ? 1 : 2;
  return `${size.toFixed(fixed)} ${units[idx]}`;
}

function formatBitrate(bytesPerSec) {
  const num = Number.parseFloat(bytesPerSec);
  if (!Number.isFinite(num) || num < 0) {
    return '-';
  }
  const bitsPerSec = (num * 8) / 1000;
  const units = ['Kb/s', 'Mb/s', 'Gb/s', 'Tb/s'];
  let value = bitsPerSec;
  let idx = 0;
  while (value >= 1000 && idx < units.length - 1) {
    value /= 1000;
    idx += 1;
  }
  const fixed = value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(fixed)} ${units[idx]}`;
}

function niceMaxValue(value) {
  if (!Number.isFinite(value) || value <= 0) {
    return 8;
  }
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const normalized = value / magnitude;
  let factor = 10;
  if (normalized <= 1) factor = 1;
  else if (normalized <= 2) factor = 2;
  else if (normalized <= 5) factor = 5;
  return factor * magnitude;
}

function formatPercent(value) {
  const num = Number.parseFloat(value);
  if (!Number.isFinite(num) || num < 0) {
    return '-';
  }
  return `${num.toFixed(num >= 10 ? 0 : 1)}%`;
}

function formatExpireAt(value) {
  const timestamp = Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return '-';
  }
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function stopProviderTrafficRotation() {
  if (providerTrafficState.rotateTimer) {
    clearInterval(providerTrafficState.rotateTimer);
    providerTrafficState.rotateTimer = null;
  }
}

function startProviderTrafficRotation(totalItems) {
  stopProviderTrafficRotation();
  if (!Number.isFinite(totalItems) || totalItems <= 1) {
    return;
  }
  providerTrafficState.rotateTimer = setInterval(() => {
    if (providerTrafficState.paused) {
      return;
    }
    providerTrafficState.index = (providerTrafficState.index + 1) % totalItems;
    renderProviderTraffic();
  }, 2500);
}

function renderProviderTraffic() {
  if (!providerTrafficEl) {
    return;
  }
  const payload = menuData && menuData.providerTraffic && typeof menuData.providerTraffic === 'object'
    ? menuData.providerTraffic
    : null;
  const summary = payload && payload.summary && typeof payload.summary === 'object'
    ? payload.summary
    : null;
  const items = payload && Array.isArray(payload.items) ? payload.items : [];
  if (!payload || !summary || items.length === 0) {
    providerTrafficEl.innerHTML = '';
    providerTrafficEl.classList.add('is-hidden');
    stopProviderTrafficRotation();
    return;
  }
  providerTrafficEl.classList.remove('is-hidden');
  const totalItems = items.length;
  const safeIndex = ((providerTrafficState.index % totalItems) + totalItems) % totalItems;
  const current = items[safeIndex];
  const signature = items.map((item) => `${item.id}:${item.usedBytes}:${item.remainingBytes}:${item.expireAt}`).join('|');
  if (providerTrafficState.signature !== signature) {
    providerTrafficState.signature = signature;
    providerTrafficState.index = Math.min(safeIndex, Math.max(0, totalItems - 1));
  }
  const currentItem = items[providerTrafficState.index] || items[0];
  const usedBytes = Number.parseFloat(currentItem.usedBytes || 0) || 0;
  const remainingBytes = Number.parseFloat(currentItem.remainingBytes || 0) || 0;
  const usedPercent = Number.parseFloat(currentItem.usedPercent || 0) || 0;
  providerTrafficEl.innerHTML = `
    <div class="provider-traffic-summary">
      <div class="provider-traffic-stat">
        <span class="provider-traffic-stat-label">Providers</span>
        <span class="provider-traffic-stat-value">${Number.parseInt(String(summary.providerCount || 0), 10) || 0}</span>
      </div>
      <div class="provider-traffic-stat">
        <span class="provider-traffic-stat-label">Used</span>
        <span class="provider-traffic-stat-value">${formatBytes(summary.usedBytes || 0)}</span>
      </div>
      <div class="provider-traffic-stat">
        <span class="provider-traffic-stat-label">Remaining</span>
        <span class="provider-traffic-stat-value">${formatBytes(summary.remainingBytes || 0)}</span>
      </div>
    </div>
    <div class="provider-traffic-item">
      <div class="provider-traffic-item-head">
        <div class="provider-traffic-item-name">${currentItem.name || '-'}</div>
        <div class="provider-traffic-item-percent">${formatPercent(usedPercent)}</div>
      </div>
      <div class="provider-traffic-progress">
        <div class="provider-traffic-progress-bar" style="width:${Math.max(0, Math.min(100, usedPercent)).toFixed(2)}%"></div>
      </div>
      <div class="provider-traffic-item-meta">
        <span>${formatBytes(usedBytes)} used</span>
        <span>${formatBytes(remainingBytes)} left</span>
      </div>
      <div class="provider-traffic-item-meta secondary">
        <span>${currentItem.vehicleType || '-'}</span>
        <span>Expire ${formatExpireAt(currentItem.expireAt)}</span>
      </div>
    </div>
  `;
  providerTrafficEl.dataset.hasMultiple = totalItems > 1 ? 'true' : 'false';
  startProviderTrafficRotation(totalItems);
}

function renderTrafficBars() {
  if (!chartBarsEl) {
    return;
  }
  const count = Math.max(trafficState.historyRx.length, trafficState.historyTx.length, 0);
  if (!count) {
    if (Array.isArray(chartBarsEl._barPairs)) {
      chartBarsEl._barPairs.forEach((pair) => {
        if (pair.downBase) pair.downBase.setAttribute('display', 'none');
        if (pair.upBase) pair.upBase.setAttribute('display', 'none');
        pair.down.setAttribute('display', 'none');
        pair.up.setAttribute('display', 'none');
      });
    }
    return;
  }
  const maxRx = trafficState.historyRx.length ? Math.max(...trafficState.historyRx, 0) : 0;
  const maxTx = trafficState.historyTx.length ? Math.max(...trafficState.historyTx, 0) : 0;
  let niceMaxRx = niceMaxValue(maxRx);
  let niceMaxTx = niceMaxValue(maxTx);
  if (niceMaxRx < 8) niceMaxRx = 8;
  if (niceMaxTx < 8) niceMaxTx = 8;
  const width = 100;
  const height = 60;
  const baseline = height / 2;
  const available = baseline;
  const fixedHeight = available;
  const svgEl = chartBarsEl.ownerSVGElement;
  const svgRect = svgEl ? svgEl.getBoundingClientRect() : null;
  const desiredPx = 5.7;
  const pxPerUnit = svgRect && svgRect.width ? svgRect.width / width : 2.4;
  const barWidth = Math.min(4, Math.max(0.6, desiredPx / pxPerUnit));
  const gap = Math.max(0.2, barWidth * 0.25);
  const unit = barWidth + gap;
  const maxBars = Math.max(1, Math.floor(width / unit));
  const startIndex = Math.max(0, count - maxBars);
  const visibleCount = Math.min(count, maxBars);
  const startX = 0;
  const xStep = visibleCount > 1 ? (width - barWidth) / (visibleCount - 1) : 0;
  if (!Array.isArray(chartBarsEl._barPairs)) {
    chartBarsEl._barPairs = [];
  }
  const needed = maxBars;
  while (chartBarsEl._barPairs.length < needed) {
    const downBase = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    downBase.setAttribute('class', 'chart-bar-bg down');
    const upBase = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    upBase.setAttribute('class', 'chart-bar-bg up');
    const down = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    down.setAttribute('class', 'chart-bar down');
    const up = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    up.setAttribute('class', 'chart-bar up');
    chartBarsEl.appendChild(downBase);
    chartBarsEl.appendChild(upBase);
    chartBarsEl.appendChild(down);
    chartBarsEl.appendChild(up);
    chartBarsEl._barPairs.push({ downBase, upBase, down, up });
  }
  for (let i = 0; i < chartBarsEl._barPairs.length; i += 1) {
    const pair = chartBarsEl._barPairs[i];
    if (i >= visibleCount) {
      if (pair.downBase) pair.downBase.setAttribute('display', 'none');
      if (pair.upBase) pair.upBase.setAttribute('display', 'none');
      pair.down.setAttribute('display', 'none');
      pair.up.setAttribute('display', 'none');
      continue;
    }
    const idx = startIndex + i;
    const downValue = trafficState.historyRx[idx] || 0;
    const upValue = trafficState.historyTx[idx] || 0;
    const downHeight = Math.max(0, Math.min(available, (downValue / niceMaxRx) * available));
    const upHeight = Math.max(0, Math.min(available, (upValue / niceMaxTx) * available));
    const x = startX + i * xStep;
    if (pair.downBase) {
      pair.downBase.setAttribute('display', '');
      pair.downBase.setAttribute('x', x.toFixed(2));
      pair.downBase.setAttribute('y', baseline.toFixed(2));
      pair.downBase.setAttribute('width', barWidth.toFixed(2));
      pair.downBase.setAttribute('height', fixedHeight.toFixed(2));
      pair.downBase.setAttribute('rx', '0.35');
    }
    if (pair.upBase) {
      pair.upBase.setAttribute('display', '');
      pair.upBase.setAttribute('x', x.toFixed(2));
      pair.upBase.setAttribute('y', (baseline - fixedHeight).toFixed(2));
      pair.upBase.setAttribute('width', barWidth.toFixed(2));
      pair.upBase.setAttribute('height', fixedHeight.toFixed(2));
      pair.upBase.setAttribute('rx', '0.35');
    }
    if (downHeight > 0.2) {
      pair.down.setAttribute('display', '');
      pair.down.setAttribute('x', x.toFixed(2));
      pair.down.setAttribute('y', baseline.toFixed(2));
      pair.down.setAttribute('width', barWidth.toFixed(2));
      pair.down.setAttribute('height', downHeight.toFixed(2));
      pair.down.setAttribute('rx', '0.35');
    } else {
      pair.down.setAttribute('display', 'none');
    }
    if (upHeight > 0.2) {
      pair.up.setAttribute('display', '');
      pair.up.setAttribute('x', x.toFixed(2));
      pair.up.setAttribute('y', (baseline - upHeight).toFixed(2));
      pair.up.setAttribute('width', barWidth.toFixed(2));
      pair.up.setAttribute('height', upHeight.toFixed(2));
      pair.up.setAttribute('rx', '0.35');
    } else {
      pair.up.setAttribute('display', 'none');
    }
  }
}

function updateChartTimeLabels() {
  if (!chartLeftTimeEl || !chartRightTimeEl) {
    return;
  }
  const points = Math.max(trafficState.historyRx.length, trafficState.historyTx.length, 0);
  if (points <= 1) {
    chartLeftTimeEl.textContent = '-';
    chartRightTimeEl.textContent = 'now';
    return;
  }
  const totalMs = (points - 1) * TRAFFIC_INTERVAL_MS;
  const totalSec = Math.max(1, Math.round(totalMs / 1000));
  if (totalSec < 60) {
    chartLeftTimeEl.textContent = `${totalSec} seconds ago`;
  } else {
    const mins = Math.max(1, Math.round(totalSec / 60));
    chartLeftTimeEl.textContent = `${mins} minutes ago`;
  }
  chartRightTimeEl.textContent = 'now';
}

function formatRateLabel(value) {
  const num = Number.parseFloat(value);
  if (!Number.isFinite(num) || num < 0) {
    return '-';
  }
  return `${formatBytes(num)}/s`;
}

function setOverlayLabels() {
  const rxRate = trafficState.lastRateRx;
  const txRate = trafficState.lastRateTx;
  const rxTotal = trafficState.lastTotalRx;
  const txTotal = trafficState.lastTotalTx;
  if (chartTopLabelEl) {
    chartTopLabelEl.textContent = Number.isFinite(txRate) ? formatRateLabel(txRate) : '-';
  }
  if (chartBottomLabelEl) {
    chartBottomLabelEl.textContent = Number.isFinite(rxRate) ? formatRateLabel(rxRate) : '-';
  }
  if (chartTopTotalEl) {
    chartTopTotalEl.textContent = Number.isFinite(txTotal) ? formatBytes(txTotal) : 'U';
  }
  if (chartBottomTotalEl) {
    chartBottomTotalEl.textContent = Number.isFinite(rxTotal) ? formatBytes(rxTotal) : 'D';
  }
}

function resetTrafficChart() {
  trafficState.historyRx = [];
  trafficState.historyTx = [];
  renderTrafficBars();
  updateChartTimeLabels();
  if (chartTopLabelEl) chartTopLabelEl.textContent = '-';
  if (chartBottomLabelEl) chartBottomLabelEl.textContent = '-';
  if (chartTopTotalEl) chartTopTotalEl.textContent = '-';
  if (chartBottomTotalEl) chartBottomTotalEl.textContent = '-';
  persistTrafficCache();
}

function updateTrafficHistory(rxRate, txRate) {
  const rxK = Math.max(0, rxRate / 1024);
  const txK = Math.max(0, txRate / 1024);
  trafficState.historyRx.push(rxK);
  trafficState.historyTx.push(txK);
  if (trafficState.historyRx.length > TRAFFIC_HISTORY_POINTS) {
    trafficState.historyRx.shift();
  }
  if (trafficState.historyTx.length > TRAFFIC_HISTORY_POINTS) {
    trafficState.historyTx.shift();
  }
  renderTrafficBars();
  updateChartTimeLabels();
  persistTrafficCache();
}

function updateProxyTraffic(downRate, upRate) {
  const down = Number.parseFloat(downRate);
  const up = Number.parseFloat(upRate);
  if (!Number.isFinite(down) || !Number.isFinite(up) || down < 0 || up < 0) {
    return;
  }
  trafficState.lastTrafficAt = Date.now();
  trafficState.lastRateRx = down;
  trafficState.lastRateTx = up;
  setOverlayLabels();
  updateTrafficHistory(down, up);
  persistTrafficCache();
}

function updateSystemTraffic(rxBytes, txBytes) {
  const rx = Number.parseFloat(rxBytes);
  const tx = Number.parseFloat(txBytes);
  const now = Date.now();
  if (!Number.isFinite(rx) || !Number.isFinite(tx)) {
    return;
  }
  trafficState.lastTotalRx = rx;
  trafficState.lastTotalTx = tx;
  setOverlayLabels();
  persistTrafficCache();
  if (trafficState.lastTrafficAt && (now - trafficState.lastTrafficAt) <= 1500) {
    return;
  }
  if (trafficState.trafficRxBytes === null || trafficState.trafficTxBytes === null || !trafficState.trafficAt) {
    trafficState.trafficRxBytes = rx;
    trafficState.trafficTxBytes = tx;
    trafficState.trafficAt = now;
    return;
  }
  const deltaSec = (now - trafficState.trafficAt) / 1000;
  if (deltaSec <= 0) {
    return;
  }
  const rxRate = (rx - trafficState.trafficRxBytes) / deltaSec;
  const txRate = (tx - trafficState.trafficTxBytes) / deltaSec;
  trafficState.trafficRxBytes = rx;
  trafficState.trafficTxBytes = tx;
  trafficState.trafficAt = now;
  if (!Number.isFinite(rxRate) || !Number.isFinite(txRate) || rxRate < 0 || txRate < 0) {
    return;
  }
  updateTrafficHistory(rxRate, txRate);
}

function applyChartEnabled(enabled) {
  trafficState.chartEnabled = enabled;
  if (chartEl) {
    chartEl.classList.toggle('is-hidden', !enabled);
  }
  if (!enabled) {
    stopTrafficTimers();
    resetTrafficChart();
    syncWindowGeometry();
  }
}

async function getTrafficArgs() {
  if (!window.clashfox || typeof window.clashfox.readSettings !== 'function') {
    return [];
  }
  const now = Date.now();
  if (trafficState.settings && (now - trafficState.settingsAt) < SETTINGS_CACHE_MS) {
    return trafficState.settings;
  }
  try {
    const response = await window.clashfox.readSettings();
    const settings = response && response.ok ? response.data : null;
    if (!settings || typeof settings !== 'object') {
      return [];
    }
    applyChartEnabled(
      Object.prototype.hasOwnProperty.call(settings, 'chartEnabled')
        ? settings.chartEnabled !== false
        : settings.trayMenuChartEnabled !== false,
    );
    const configFile = String(settings.configFile || settings.configPath || '').trim();
    const controller = String(settings.externalController || '').trim();
    const secret = String(settings.secret || '').trim();
    const args = [];
    if (configFile) {
      args.push('--config', configFile);
    }
    if (controller) {
      args.push('--controller', controller);
    }
    if (secret) {
      args.push('--secret', secret);
    }
    trafficState.settings = args;
    trafficState.settingsAt = now;
    return args;
  } catch {
    return [];
  }
}

async function loadTrafficSnapshot() {
  if (!window.clashfox || typeof window.clashfox.runCommand !== 'function') {
    return;
  }
  if (trafficState.trafficLoading) {
    return;
  }
  trafficState.trafficLoading = true;
  try {
    const args = await getTrafficArgs();
    const response = await window.clashfox.runCommand('traffic', args);
    if (!response || !response.ok || !response.data) {
      return;
    }
    const downRaw = response.data.down ?? response.data.download ?? response.data.rx ?? '';
    const upRaw = response.data.up ?? response.data.upload ?? response.data.tx ?? '';
    updateProxyTraffic(downRaw, upRaw);
  } catch {
    // ignore
  } finally {
    trafficState.trafficLoading = false;
  }
}

async function loadOverviewSnapshot() {
  if (!window.clashfox || typeof window.clashfox.runCommand !== 'function') {
    return;
  }
  if (trafficState.overviewLoading) {
    return;
  }
  trafficState.overviewLoading = true;
  try {
    const args = await getTrafficArgs();
    const response = await window.clashfox.runCommand('overview', ['--cache-ttl', '1', ...args]);
    if (!response || !response.ok || !response.data) {
      return;
    }
    updateSystemTraffic(response.data.rxBytes, response.data.txBytes);
  } catch {
    // ignore
  } finally {
    trafficState.overviewLoading = false;
  }
}

async function startTrafficTimers() {
  if (trafficState.trafficTimer || trafficState.overviewTimer) {
    return;
  }
  await getTrafficArgs();
  if (!trafficState.chartEnabled) {
    return;
  }
  loadTrafficSnapshot();
  loadOverviewSnapshot();
  trafficState.trafficTimer = setInterval(loadTrafficSnapshot, TRAFFIC_INTERVAL_MS);
  trafficState.overviewTimer = setInterval(loadOverviewSnapshot, OVERVIEW_INTERVAL_MS);
}

function stopTrafficTimers() {
  if (trafficState.trafficTimer) {
    clearInterval(trafficState.trafficTimer);
    trafficState.trafficTimer = null;
  }
  if (trafficState.overviewTimer) {
    clearInterval(trafficState.overviewTimer);
    trafficState.overviewTimer = null;
  }
}

function syncWindowGeometry() {
  const rootRect = menuRootEl.getBoundingClientRect();
  const rootWidth = Math.ceil(rootRect.width) || 260;
  const contentHeight = Math.ceil(menuRootEl.scrollHeight || rootRect.height || 0);
  const height = contentHeight + 2;
  const width = rootWidth;
  if (
    Math.abs(height - lastHeightSent) <= 2
    && Math.abs(width - lastWidthSent) <= 2
  ) {
    return;
  }
  lastHeightSent = height;
  lastWidthSent = width;
  window.clashfox.trayMenuSetExpanded(false, { height, width });
}

function scheduleGeometrySync() {
  if (geometryRaf) {
    return;
  }
  geometryRaf = requestAnimationFrame(() => {
    geometryRaf = 0;
    syncWindowGeometry();
  });
}

function ensureMenuAutoResize() {
  if (!menuRootEl) {
    return;
  }
  if (!menuResizeObserver && typeof ResizeObserver !== 'undefined') {
    menuResizeObserver = new ResizeObserver(() => {
      scheduleGeometrySync();
    });
    menuResizeObserver.observe(menuRootEl);
  }
  if (!menuMutationObserver && typeof MutationObserver !== 'undefined') {
    menuMutationObserver = new MutationObserver(() => {
      scheduleGeometrySync();
    });
    menuMutationObserver.observe(menuRootEl, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    });
  }
  if (document.fonts && typeof document.fonts.ready === 'object' && typeof document.fonts.ready.then === 'function') {
    document.fonts.ready.then(() => {
      scheduleGeometrySync();
    }).catch(() => {});
  }
}

function hideSubmenu() {
  activeSubmenuKey = null;
  activeSubmenuAnchor = null;
  listEl.querySelectorAll('.menu-row.expanded').forEach((node) => node.classList.remove('expanded'));
  if (window.clashfox && typeof window.clashfox.trayMenuCloseSubmenu === 'function') {
    window.clashfox.trayMenuCloseSubmenu();
  }
}

function makeLeading(item) {
  const check = document.createElement('div');
  check.className = `menu-check${item.checked ? '' : ' empty'}`;
  check.textContent = item.checked ? '✓' : ' ';

  const leading = document.createElement('div');
  leading.className = 'menu-leading';
  if (item.iconKey && ICON_SVGS[item.iconKey]) {
    leading.innerHTML = ICON_SVGS[item.iconKey];
  }
  return { check, leading };
}

function makeRow(item) {
  if (item.type === 'separator') {
    const sep = document.createElement('div');
    sep.className = 'menu-row-sep';
    return sep;
  }

  const row = document.createElement('div');
  row.className = 'menu-row';
  if (item.action) {
    row.dataset.action = String(item.action);
  }
  if (item.iconKey) {
    row.dataset.iconKey = String(item.iconKey);
  }
  const clickable = item.enabled !== false;
  if (clickable) {
    row.classList.add('clickable');
  } else {
    row.classList.add('disabled');
  }

  const leadingParts = makeLeading(item);
  if (typeof item.checked === 'boolean') {
    row.appendChild(leadingParts.check);
  }
  row.appendChild(leadingParts.leading);

  const label = document.createElement('div');
  label.className = 'menu-label';
  label.textContent = item.label || '';
  row.appendChild(label);

  if (item.rightText) {
    const right = document.createElement('div');
    right.className = 'menu-right';
    const rightText = String(item.rightText || '').trim();
    const badgeMatch = rightText.match(/^[\[\【]\s*([A-Za-z0-9]{1,6})\s*[\]\】]$/);
    if (badgeMatch) {
      right.classList.add('tag');
      right.textContent = badgeMatch[1];
    } else {
      right.textContent = rightText;
    }
    row.appendChild(right);
  }
  if (item.rightBadge && item.rightBadge.text) {
    const badge = document.createElement('div');
    const tone = String(item.rightBadge.tone || 'neutral');
    badge.className = `menu-badge tone-${tone}`;
    badge.textContent = String(item.rightBadge.text);
    row.appendChild(badge);
  }

  if (item.submenu) {
    row.dataset.submenuKey = String(item.submenu);
    const arrow = document.createElement('div');
    arrow.className = 'menu-arrow';
    arrow.textContent = '›';
    row.appendChild(arrow);
  }

  if (!clickable) {
    return row;
  }

  if (item.submenu) {
    row.addEventListener('mouseenter', () => {
      openSubmenu(item.submenu, row);
    });
    row.addEventListener('click', (event) => {
      if (Date.now() < blockClickUntil) {
        event.preventDefault();
        return;
      }
      event.preventDefault();
      openSubmenu(item.submenu, row);
    });
    return row;
  }

  row.addEventListener('mouseenter', () => {
    hideSubmenu();
  });

  row.addEventListener('click', async () => {
    if (Date.now() < blockClickUntil) {
      return;
    }
    await runActionForItem(item);
  });

  return row;
}

async function invokeAction(item) {
  if (!item.action) {
    return { ok: false };
  }
  const payload = {};
  if (typeof item.checked === 'boolean') {
    payload.checked = !item.checked;
  }
  if (item.value !== undefined) {
    payload.value = item.value;
  }
  try {
    return await window.clashfox.trayMenuAction(item.action, payload);
  } catch {
    return { ok: false };
  }
}

async function runActionForItem(item, submenuKey = '') {
  const actionStartVersion = menuVersion;
  const result = await invokeAction(item);
  if (result && result.hide) {
    window.clashfox.trayMenuHide();
    hideSubmenu();
    return;
  }
  if (result && result.data && menuVersion === actionStartVersion) {
    menuData = result.data;
  } else if (menuVersion === actionStartVersion) {
    const latest = await window.clashfox.trayMenuGetData();
    if (menuVersion === actionStartVersion) {
      menuData = latest || menuData;
    }
  }
  renderHeader();
  renderMainList();
  hideSubmenu();
  syncWindowGeometry();
}

function normalizeShortcut(text = '') {
  return String(text).trim().toLowerCase().replace(/\s+/g, '');
}

function eventToShortcut(event) {
  const mods = [];
  if (event.metaKey) {
    mods.push('cmd');
  }
  if (event.ctrlKey) {
    mods.push('ctrl');
  }
  if (event.altKey) {
    mods.push('alt');
  }
  if (event.shiftKey) {
    mods.push('shift');
  }
  const key = String(event.key || '').toLowerCase();
  if (!key) {
    return '';
  }
  return `${mods.join('+')}${mods.length ? '+' : ''}${key}`;
}

function findShortcutItem(shortcut) {
  const items = Array.isArray(menuData && menuData.items) ? menuData.items : [];
  return items.find((item) => (
    item
    && item.type !== 'separator'
    && item.enabled !== false
    && item.action
    && normalizeShortcut(item.shortcut) === shortcut
  ));
}

function renderHeader() {
  if (!menuData || !menuData.header) {
    headerEl.innerHTML = '';
    return;
  }
  const title = menuData.header.title || 'ClashFox';
  const rawStatus = String(menuData.header.status || '');
  let statusState = String(menuData.header.statusState || '').trim().toLowerCase();
  if (!statusState) {
    if (/running/i.test(rawStatus) || rawStatus.includes('🟢')) {
      statusState = 'running';
    } else if (/stopp?ed/i.test(rawStatus) || rawStatus.includes('⚪') || rawStatus.includes('🔴')) {
      statusState = 'stopped';
    } else {
      statusState = 'neutral';
    }
  }
  const status = rawStatus.replace(/^[🟢⚪🔴]\s*/u, '');
  headerEl.innerHTML = `
    <div class="menu-header-left">
      <div class="menu-header-logo">
        <img class="logo-dark" src="../assets/logo_night.png" alt="logo"/>
        <img class="logo-light" src="../assets/logo_light.png" alt="logo"/>
      </div>
      <div class="menu-header-title">${title}</div>
    </div>
    <div class="menu-header-status ${statusState}">
      <span class="status-dot"></span>
      <span class="status-text">${status}</span>
    </div>
  `;
}

function renderMainList() {
  listEl.innerHTML = '';
  const items = Array.isArray(menuData && menuData.items) ? menuData.items : [];
  for (const item of items) {
    listEl.appendChild(makeRow(item));
  }
  scheduleGeometrySync();
}

function findMainAnchorBySubmenuKey(submenuKey) {
  const rows = listEl.querySelectorAll('.menu-row[data-submenu-key]');
  for (const row of rows) {
    if (row && row.dataset && row.dataset.submenuKey === submenuKey) {
      return row;
    }
  }
  return null;
}

function resolveSubmenuAnchor(submenuKey, anchorRow) {
  if (anchorRow && anchorRow.isConnected && listEl.contains(anchorRow)) {
    return anchorRow;
  }
  return findMainAnchorBySubmenuKey(submenuKey);
}

function openSubmenu(submenuKey, anchorRow, keepAnchor = false) {
  if (!submenuKey || !menuData || !menuData.submenus || !Array.isArray(menuData.submenus[submenuKey])) {
    hideSubmenu();
    return;
  }
  const resolvedAnchor = resolveSubmenuAnchor(
    submenuKey,
    keepAnchor ? activeSubmenuAnchor : anchorRow,
  );
  activeSubmenuKey = submenuKey;
  activeSubmenuAnchor = resolvedAnchor;
  listEl.querySelectorAll('.menu-row.expanded').forEach((node) => node.classList.remove('expanded'));
  if (resolvedAnchor) {
    resolvedAnchor.classList.add('expanded');
  }

  const rootRect = menuRootEl.getBoundingClientRect();
  const anchorRect = resolvedAnchor ? resolvedAnchor.getBoundingClientRect() : null;
  const anchorTop = anchorRect ? (anchorRect.top - rootRect.top) : 56;
  const anchorHeight = anchorRect ? anchorRect.height : 32;
  const payload = {
    key: submenuKey,
    items: (menuData && menuData.submenus && Array.isArray(menuData.submenus[submenuKey]))
      ? menuData.submenus[submenuKey]
      : [],
    anchorTop: Math.max(0, Math.round(anchorTop)),
    anchorHeight: Math.max(0, Math.round(anchorHeight)),
    rootHeight: Math.max(0, Math.round(rootRect.height || 0)),
  };
  if (window.clashfox && typeof window.clashfox.trayMenuOpenSubmenu === 'function') {
    window.clashfox.trayMenuOpenSubmenu(payload);
  }
}

function renderAll() {
  renderHeader();
  renderProviderTraffic();
  renderMainList();
  hideSubmenu();
  scheduleGeometrySync();
}

async function init() {
  await applyTrayTheme();
  ensureMenuAutoResize();
  if (chartEl) {
    if (!restoreTrafficCache()) {
      resetTrafficChart();
    }
  }
  if (window.clashfox && typeof window.clashfox.onTrayMenuUpdate === 'function') {
    window.clashfox.onTrayMenuUpdate((payload) => {
      if (!payload) {
        return;
      }
      applyTrayTheme().catch(() => {});
      menuVersion += 1;
      const keepSubmenuKey = activeSubmenuKey;
      const keepSubmenuAnchorKey = activeSubmenuAnchor
        && activeSubmenuAnchor.dataset
        && activeSubmenuAnchor.dataset.submenuKey
        ? activeSubmenuAnchor.dataset.submenuKey
        : keepSubmenuKey;
      menuData = payload;
      renderHeader();
      renderProviderTraffic();
      renderMainList();
      if (keepSubmenuKey && keepSubmenuAnchorKey) {
        const nextAnchor = findMainAnchorBySubmenuKey(keepSubmenuAnchorKey);
        if (nextAnchor) {
          activeSubmenuKey = null;
          activeSubmenuAnchor = null;
          openSubmenu(keepSubmenuKey, nextAnchor, true);
          return;
        }
      }
      hideSubmenu();
      syncWindowGeometry();
    });
  }

  if (window.clashfox && typeof window.clashfox.trayMenuRendererReady === 'function') {
    window.clashfox.trayMenuRendererReady();
  }

  try {
    const initial = await window.clashfox.trayMenuGetData();
    if (menuVersion === 0) {
      menuData = initial;
      renderAll();
    }
  } catch {
    // ignore
  }

  headerEl.addEventListener('mouseenter', hideSubmenu);
  if (window.clashfox && typeof window.clashfox.onSystemThemeChange === 'function') {
    window.clashfox.onSystemThemeChange(() => {
      applyTrayTheme().catch(() => {});
    });
  }
  window.addEventListener('storage', (event) => {
    if (!event || event.key !== 'clashfox.settings') {
      return;
    }
    applyTrayTheme().catch(() => {});
  });
  if (window.matchMedia) {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handleThemeChange = () => {
      applyTrayTheme().catch(() => {});
    };
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', handleThemeChange);
    } else if (typeof media.addListener === 'function') {
      media.addListener(handleThemeChange);
    }
  }
  if (providerTrafficEl) {
    providerTrafficEl.addEventListener('mouseenter', () => {
      providerTrafficState.paused = true;
    });
    providerTrafficEl.addEventListener('mouseleave', () => {
      providerTrafficState.paused = false;
    });
  }

  startTrafficTimers();
}

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    window.clashfox.trayMenuHide();
    return;
  }
  const shortcut = eventToShortcut(event);
  if (!shortcut) {
    return;
  }
  const item = findShortcutItem(shortcut);
  if (!item) {
    return;
  }
  event.preventDefault();
  runActionForItem(item).catch(() => {});
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    blockClickUntil = Date.now() + 220;
    hideSubmenu();
    startTrafficTimers();
  }
});

window.addEventListener('beforeunload', () => {
  stopTrafficTimers();
  persistTrafficCache();
});

init();
