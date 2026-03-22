const submenuRootEl = document.getElementById('submenuRoot');
const submenuListEl = document.getElementById('submenuList');

let submenuKey = '';
let submenuItems = [];
let connectivityRefreshTimer = null;
let lastResizeWidth = 0;
let lastResizeHeight = 0;
let lastHoverSent = false;
let lastSettingsSignature = '';
let trayThemeSettingsSnapshot = null;
let panelChartSocket = null;
let panelChartReconnectTimer = null;
let panelChartReconnectAttempts = 0;
let panelChartRatesRx = [];
let panelChartRatesTx = [];
let panelChartTotalRx = null;
let panelChartTotalTx = null;
const CONNECTIVITY_REFRESH_MS = 1000;
const SUBMENU_MIN_WIDTH = 170;
const SUBMENU_MAX_WIDTH = 340;
const SUBMENU_PANEL_MIN_WIDTH = 300;
const SUBMENU_PANEL_MAX_WIDTH = 356;
const NETWORK_TOGGLE_ACTIONS = new Set(['toggle-system-proxy', 'toggle-tun']);
const pendingActionSet = new Set();
const loadingVisibleSet = new Set();
const loadingTimerMap = new Map();
const loadingVisibleAtMap = new Map();
const ACTION_TIMEOUT_MS = 12000;
const LOADING_SHOW_DELAY_MS = 180;
const MIN_LOADING_VISIBLE_MS = 220;
const PANEL_TRAFFIC_HISTORY_LIMIT = 18;
const PANEL_TRAFFIC_INTERVAL_MS = 1500;
const PANEL_TRAFFIC_RECONNECT_BASE_MS = 1200;
const PANEL_TRAFFIC_RECONNECT_MAX_MS = 10000;
let submenuRendererVisible = false;

async function applyTrayTheme(preloadedSettings = null) {
  try {
    if (!document.body) {
      return;
    }
    let preference = '';
    const nextSettings = preloadedSettings && typeof preloadedSettings === 'object'
      ? preloadedSettings
      : null;
    if (nextSettings) {
      trayThemeSettingsSnapshot = {
        ...(trayThemeSettingsSnapshot || {}),
        ...nextSettings,
      };
    }
    const settings = trayThemeSettingsSnapshot && typeof trayThemeSettingsSnapshot === 'object'
      ? trayThemeSettingsSnapshot
      : nextSettings;
    if (settings) {
      const appearance = settings && typeof settings.appearance === 'object' ? settings.appearance : {};
      preference = String(
        settings.theme
        || appearance.theme
        || appearance.colorMode
        || '',
      ).trim().toLowerCase();
    } else if (window.clashfox && typeof window.clashfox.readSettings === 'function') {
      const response = await window.clashfox.readSettings();
      const settings = response && response.ok && response.data && typeof response.data === 'object'
        ? response.data
        : null;
      if (settings) {
        trayThemeSettingsSnapshot = settings;
      }
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

function wait(ms = 0) {
  return new Promise((resolve) => {
    setTimeout(resolve, Math.max(0, Number(ms) || 0));
  });
}

const ICON_SVGS = {
  dashboard: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M8 14.5a4 4 0 0 1 8 0"/><path d="M12 12l3-3"/><circle cx="9" cy="10" r="1" class="menu-icon-fill"/></svg>',
  panel: '<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="14" rx="2" fill="rgba(86,156,255,0.18)" stroke="#5ea8ff" stroke-width="1.4"/><path d="M4 10h16" stroke="#f2b663" stroke-width="1.4"/><path d="M8 14h7" stroke="#67d39c" stroke-width="1.6" stroke-linecap="round"/><path d="M8 17h5" stroke="#c78bff" stroke-width="1.6" stroke-linecap="round"/></svg>',
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
  folder: '<svg viewBox="0 0 24 24"><path d="M3 7h7l2 2h9v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/><path d="M3 7V5a2 2 0 0 1 2-2h5l2 2h9"/></svg>',
  userDir: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.2"/><path d="M5 19a7 7 0 0 1 14 0v1H5z"/></svg>',
  configDir: '<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="14" rx="2"/><path d="M8 9h8M8 13h5"/></svg>',
  workDir: '<svg viewBox="0 0 24 24"><path d="M4 9h16v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9z"/><path d="M8 9V7a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M4 12h16"/></svg>',
  logDir: '<svg viewBox="0 0 24 24"><path d="M6 4h9l3 3v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><path d="M9 11h6M9 15h6"/></svg>',
};

function formatBytes(value) {
  const num = Number.parseFloat(value);
  if (!Number.isFinite(num) || num < 0) return '-';
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
  if (!Number.isFinite(num) || num < 0) return '-';
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

function formatExpireAt(value) {
  const timestamp = Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return '-';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '-';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function niceMaxValue(value) {
  if (!Number.isFinite(value) || value <= 0) return 8;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const normalized = value / magnitude;
  let factor = 10;
  if (normalized <= 1) factor = 1;
  else if (normalized <= 2) factor = 2;
  else if (normalized <= 5) factor = 5;
  return factor * magnitude;
}

async function getPanelTrafficSocketUrl() {
  if (!window.clashfox || typeof window.clashfox.readSettings !== 'function') {
    return '';
  }
  try {
    const response = await window.clashfox.readSettings();
    const settings = response && response.ok ? response.data : null;
    if (!settings || typeof settings !== 'object') {
      return '';
    }
    const controllerRaw = String(settings.externalController || '127.0.0.1:9090').trim() || '127.0.0.1:9090';
    const secret = String(settings.secret || 'clashfox').trim();
    const baseUrl = /^https?:\/\//i.test(controllerRaw) ? controllerRaw : `http://${controllerRaw}`;
    const url = new URL(baseUrl);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.pathname = '/traffic';
    if (secret) {
      url.searchParams.set('token', secret);
    }
    return url.toString();
  } catch {
    return '';
  }
}

function stopPanelTrafficReconnect() {
  if (panelChartReconnectTimer) {
    clearTimeout(panelChartReconnectTimer);
    panelChartReconnectTimer = null;
  }
}

function closePanelTrafficSocket() {
  stopPanelTrafficReconnect();
  panelChartReconnectAttempts = 0;
  const socket = panelChartSocket;
  panelChartSocket = null;
  if (!socket) return;
  try {
    socket.onopen = null;
    socket.onmessage = null;
    socket.onerror = null;
    socket.onclose = null;
    socket.close();
  } catch {
    // ignore
  }
}

function stopSubmenuLiveActivity() {
  stopConnectivityRefresh();
  closePanelTrafficSocket();
}

function startSubmenuLiveActivity() {
  if (!submenuRendererVisible) {
    return;
  }
  if (submenuKey === 'network') {
    ensureConnectivityRefresh();
  }
  if (submenuKey === 'panel') {
    openPanelTrafficSocket().catch(() => {});
    renderPanelTrafficChart();
  }
}

function setSubmenuRendererVisible(nextVisible) {
  const visible = Boolean(nextVisible);
  if (submenuRendererVisible === visible) {
    return;
  }
  submenuRendererVisible = visible;
  if (!visible) {
    stopSubmenuLiveActivity();
    return;
  }
  if (submenuKey) {
    renderSubmenu();
  }
  startSubmenuLiveActivity();
}

function schedulePanelTrafficReconnect() {
  stopPanelTrafficReconnect();
  const delay = Math.min(
    PANEL_TRAFFIC_RECONNECT_MAX_MS,
    PANEL_TRAFFIC_RECONNECT_BASE_MS * Math.max(1, 2 ** panelChartReconnectAttempts),
  );
  panelChartReconnectTimer = setTimeout(() => {
    panelChartReconnectTimer = null;
    openPanelTrafficSocket().catch(() => {});
  }, delay);
}

function buildPanelChartMarkup() {
  return `
    <div class="menu-chart">
      <div class="menu-chart-body">
        <div class="menu-chart-overlay">
          <div id="panelChartTopLabel" class="menu-chart-label top">-</div>
          <div id="panelChartBottomLabel" class="menu-chart-label bottom">-</div>
        </div>
        <div class="menu-chart-overlay right">
          <div id="panelChartTopTotal" class="menu-chart-label top total">-</div>
          <div id="panelChartBottomTotal" class="menu-chart-label bottom total">-</div>
        </div>
        <svg class="menu-chart-svg" viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="panelDownGradient" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stop-color="#53b8ff" stop-opacity="0.98" />
              <stop offset="100%" stop-color="#53b8ff" stop-opacity="0.18" />
            </linearGradient>
            <linearGradient id="panelUpGradient" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stop-color="#d88cff" stop-opacity="0.98" />
              <stop offset="100%" stop-color="#d88cff" stop-opacity="0.18" />
            </linearGradient>
          </defs>
          <line class="chart-baseline" x1="0" y1="30" x2="100" y2="30"></line>
          <g id="panelChartBars"></g>
        </svg>
      </div>
      <div class="menu-chart-footer">
        <span id="panelChartLeftTime">-</span>
        <span id="panelChartRightTime">now</span>
      </div>
    </div>
  `;
}

function buildPanelProviderTrafficMarkup(payload = null) {
  const summary = payload && payload.summary && typeof payload.summary === 'object' ? payload.summary : null;
  const items = payload && Array.isArray(payload.items) ? payload.items : [];
  if (!summary || !items.length) {
    return '';
  }
  const current = items[0];
  const usedPercent = Number.parseFloat(current.usedPercent || 0) || 0;
  return `
    <div class="menu-provider-traffic">
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
          <div class="provider-traffic-item-name">${current.name || '-'}</div>
          <div class="provider-traffic-item-percent">${usedPercent.toFixed(usedPercent >= 10 ? 0 : 1)}%</div>
        </div>
        <div class="provider-traffic-progress">
          <div class="provider-traffic-progress-bar" style="width:${Math.max(0, Math.min(100, usedPercent)).toFixed(2)}%"></div>
        </div>
        <div class="provider-traffic-item-meta">
          <span>${formatBytes(current.usedBytes || 0)} used</span>
          <span>${formatBytes(current.remainingBytes || 0)} left</span>
        </div>
        <div class="provider-traffic-item-meta secondary">
          <span>${current.vehicleType || '-'}</span>
          <span>Expire ${formatExpireAt(current.expireAt)}</span>
        </div>
      </div>
    </div>
  `;
}

function renderPanelTrafficChart() {
  if (!submenuRendererVisible) {
    return;
  }
  const barsEl = document.getElementById('panelChartBars');
  if (!barsEl) return;
  const topLabelEl = document.getElementById('panelChartTopLabel');
  const bottomLabelEl = document.getElementById('panelChartBottomLabel');
  const topTotalEl = document.getElementById('panelChartTopTotal');
  const bottomTotalEl = document.getElementById('panelChartBottomTotal');
  const leftTimeEl = document.getElementById('panelChartLeftTime');
  const rightTimeEl = document.getElementById('panelChartRightTime');
  const count = Math.max(panelChartRatesRx.length, panelChartRatesTx.length, 0);
  const maxRx = panelChartRatesRx.length ? Math.max(...panelChartRatesRx, 0) : 0;
  const maxTx = panelChartRatesTx.length ? Math.max(...panelChartRatesTx, 0) : 0;
  const niceMaxRx = Math.max(8, niceMaxValue(maxRx));
  const niceMaxTx = Math.max(8, niceMaxValue(maxTx));
  if (topLabelEl) topLabelEl.textContent = formatBitrate(maxTx);
  if (bottomLabelEl) bottomLabelEl.textContent = formatBitrate(maxRx);
  if (topTotalEl) topTotalEl.textContent = formatBytes(panelChartTotalTx || 0);
  if (bottomTotalEl) bottomTotalEl.textContent = formatBytes(panelChartTotalRx || 0);
  if (leftTimeEl) {
    const totalSec = Math.max(1, Math.round(((Math.max(count, 1) - 1) * PANEL_TRAFFIC_INTERVAL_MS) / 1000));
    leftTimeEl.textContent = count <= 1 ? '-' : `${totalSec} seconds ago`;
  }
  if (rightTimeEl) rightTimeEl.textContent = 'now';
  const width = 100;
  const height = 60;
  const baseline = height / 2;
  const available = baseline;
  const maxBars = PANEL_TRAFFIC_HISTORY_LIMIT;
  const barWidth = 3.6;
  const xStep = maxBars > 1 ? (width - barWidth) / (maxBars - 1) : 0;
  const startIndex = Math.max(0, count - maxBars);
  let svg = '';
  for (let i = 0; i < maxBars; i += 1) {
    const x = i * xStep;
    const idx = startIndex + i;
    const hasSample = idx < count;
    const downValue = hasSample ? (panelChartRatesRx[idx] || 0) : 0;
    const upValue = hasSample ? (panelChartRatesTx[idx] || 0) : 0;
    const downHeight = Math.max(0, Math.min(available, (downValue / niceMaxRx) * available));
    const upHeight = Math.max(0, Math.min(available, (upValue / niceMaxTx) * available));
    svg += `<rect class="chart-bar-bg down${hasSample ? '' : ' is-placeholder'}" x="${x.toFixed(2)}" y="${baseline.toFixed(2)}" width="${barWidth.toFixed(2)}" height="${available.toFixed(2)}" rx="0.35"></rect>`;
    svg += `<rect class="chart-bar-bg up${hasSample ? '' : ' is-placeholder'}" x="${x.toFixed(2)}" y="${(baseline - available).toFixed(2)}" width="${barWidth.toFixed(2)}" height="${available.toFixed(2)}" rx="0.35"></rect>`;
    if (hasSample && downHeight > 0.2) {
      svg += `<rect class="chart-bar down" x="${x.toFixed(2)}" y="${baseline.toFixed(2)}" width="${barWidth.toFixed(2)}" height="${downHeight.toFixed(2)}" rx="0.35" fill="url(#panelDownGradient)"></rect>`;
    }
    if (hasSample && upHeight > 0.2) {
      svg += `<rect class="chart-bar up" x="${x.toFixed(2)}" y="${(baseline - upHeight).toFixed(2)}" width="${barWidth.toFixed(2)}" height="${upHeight.toFixed(2)}" rx="0.35" fill="url(#panelUpGradient)"></rect>`;
    }
  }
  barsEl.innerHTML = svg;
  if (submenuKey === 'panel') {
    requestAnimationFrame(() => {
      resizeSubmenuToContent();
    });
  }
}

function applyPanelTrafficSnapshot(payload = {}) {
  const down = Number.parseFloat(payload.down);
  const up = Number.parseFloat(payload.up);
  const downTotal = Number.parseFloat(payload.downTotal);
  const upTotal = Number.parseFloat(payload.upTotal);
  if (!Number.isFinite(down) || !Number.isFinite(up) || down < 0 || up < 0) {
    return;
  }
  panelChartRatesRx.push(down);
  panelChartRatesTx.push(up);
  if (panelChartRatesRx.length > PANEL_TRAFFIC_HISTORY_LIMIT) panelChartRatesRx = panelChartRatesRx.slice(-PANEL_TRAFFIC_HISTORY_LIMIT);
  if (panelChartRatesTx.length > PANEL_TRAFFIC_HISTORY_LIMIT) panelChartRatesTx = panelChartRatesTx.slice(-PANEL_TRAFFIC_HISTORY_LIMIT);
  if (Number.isFinite(downTotal) && downTotal >= 0) panelChartTotalRx = downTotal;
  if (Number.isFinite(upTotal) && upTotal >= 0) panelChartTotalTx = upTotal;
  renderPanelTrafficChart();
}

async function openPanelTrafficSocket() {
  if (!submenuRendererVisible || submenuKey !== 'panel' || typeof WebSocket !== 'function') {
    return;
  }
  const nextUrl = await getPanelTrafficSocketUrl();
  if (!nextUrl) return;
  const existing = panelChartSocket;
  if (existing && (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING)) {
    return;
  }
  try {
    const socket = new WebSocket(nextUrl);
    panelChartSocket = socket;
    socket.onopen = () => {
      panelChartReconnectAttempts = 0;
    };
    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data || '{}');
        applyPanelTrafficSnapshot(payload);
      } catch {
        // ignore
      }
    };
    socket.onclose = () => {
      if (panelChartSocket === socket) {
        panelChartSocket = null;
      }
      if (submenuKey === 'panel') {
        panelChartReconnectAttempts += 1;
        schedulePanelTrafficReconnect();
      }
    };
    socket.onerror = () => {
      try {
        socket.close();
      } catch {
        // ignore
      }
    };
  } catch {
    panelChartReconnectAttempts += 1;
    schedulePanelTrafficReconnect();
  }
}

function stopConnectivityRefresh() {
  if (connectivityRefreshTimer) {
    clearInterval(connectivityRefreshTimer);
    connectivityRefreshTimer = null;
  }
}

function applyConnectivitySnapshot(snapshot) {
  if (!snapshot || !Array.isArray(submenuItems)) {
    return;
  }
  const text = snapshot.text ? String(snapshot.text) : '-';
  const tone = snapshot.tone ? String(snapshot.tone) : 'neutral';
  submenuItems = submenuItems.map((item) => {
    if (!item || item.type === 'separator') {
      return item;
    }
    if (item.iconKey === 'connectivityQuality') {
      return {
        ...item,
        rightBadge: {
          text,
          tone,
        },
      };
    }
    return item;
  });
  renderSubmenu();
}

async function refreshConnectivityBadge(force = false) {
  if (!submenuRendererVisible || submenuKey !== 'network' || !window.clashfox || typeof window.clashfox.trayMenuGetConnectivity !== 'function') {
    return;
  }
  try {
    const snapshot = await window.clashfox.trayMenuGetConnectivity(Boolean(force));
    applyConnectivitySnapshot(snapshot);
  } catch {
    // ignore
  }
}

function ensureConnectivityRefresh() {
  if (!submenuRendererVisible || submenuKey !== 'network') {
    stopConnectivityRefresh();
    return;
  }
  refreshConnectivityBadge(true);
  if (connectivityRefreshTimer) {
    return;
  }
  connectivityRefreshTimer = setInterval(() => {
    refreshConnectivityBadge(false);
  }, CONNECTIVITY_REFRESH_MS);
}

function makeLeading(item, isLoading = false) {
  const check = document.createElement('div');
  if (isLoading) {
    check.className = 'menu-check loading';
    check.textContent = ' ';
  } else {
    check.className = `menu-check${item.checked ? '' : ' empty'}`;
    check.textContent = item.checked ? '✓' : ' ';
  }

  const leading = document.createElement('div');
  leading.className = 'menu-leading';
  if (item.iconKey && ICON_SVGS[item.iconKey]) {
    leading.innerHTML = ICON_SVGS[item.iconKey];
  }
  return { check, leading };
}

async function runActionForItem(item) {
  if (!item || !item.action || !window.clashfox || typeof window.clashfox.trayMenuAction !== 'function') {
    return;
  }
  const actionName = String(item.action || '').trim();
  const withLoading = NETWORK_TOGGLE_ACTIONS.has(actionName);
  if (withLoading && pendingActionSet.has(actionName)) {
    return;
  }
  if (withLoading) {
    pendingActionSet.add(actionName);
    const timer = setTimeout(() => {
      if (!pendingActionSet.has(actionName)) {
        return;
      }
      loadingVisibleSet.add(actionName);
      loadingVisibleAtMap.set(actionName, Date.now());
      renderSubmenu();
    }, LOADING_SHOW_DELAY_MS);
    loadingTimerMap.set(actionName, timer);
  }
  // Keep submenu considered “hovered” briefly so blur from opening Finder doesn’t auto-hide.
  if (window.clashfox && typeof window.clashfox.traySubmenuHover === 'function') {
    window.clashfox.traySubmenuHover(true);
  }
  const payload = { ...item };
  if (typeof item.checked === 'boolean') {
    payload.checked = !item.checked;
  }
  let response = null;
  try {
    const actionPromise = window.clashfox.trayMenuAction(item.action, payload);
    const timeoutPromise = new Promise((resolve) => {
      setTimeout(() => resolve({ ok: false, error: 'action_timeout', submenu: submenuKey || '' }), ACTION_TIMEOUT_MS);
    });
    response = await Promise.race([actionPromise, timeoutPromise]);
  } catch {
    response = { ok: false, error: 'action_failed' };
  } finally {
    if (withLoading) {
      const timer = loadingTimerMap.get(actionName);
      if (timer) {
        clearTimeout(timer);
        loadingTimerMap.delete(actionName);
      }
      if (loadingVisibleSet.has(actionName)) {
        const shownAt = Number(loadingVisibleAtMap.get(actionName) || 0);
        const elapsed = shownAt > 0 ? Date.now() - shownAt : 0;
        if (elapsed < MIN_LOADING_VISIBLE_MS) {
          await wait(MIN_LOADING_VISIBLE_MS - elapsed);
        }
      }
      loadingVisibleAtMap.delete(actionName);
      loadingVisibleSet.delete(actionName);
      pendingActionSet.delete(actionName);
      renderSubmenu();
    }
  }
  if (response && response.submenu) {
    try {
      const data = response && response.data ? response.data : await window.clashfox.trayMenuGetData();
      const latestItems = data
        && data.submenus
        && Array.isArray(data.submenus[response.submenu])
        ? data.submenus[response.submenu]
        : null;
      if (latestItems) {
        setSubmenu({
          key: response.submenu,
          items: latestItems,
        });
      }
    } catch {
      // ignore sync failure
    }
  }
  if (response && response.hide) {
    window.clashfox.trayMenuHide();
    window.clashfox.traySubmenuHide();
  } else if (response && response.submenu) {
    // stay open
  } else {
    window.clashfox.trayMenuHide();
    window.clashfox.traySubmenuHide();
  }
}

function makeRow(item) {
  if (item.type === 'separator') {
    const sep = document.createElement('div');
    sep.className = 'menu-row-sep';
    return sep;
  }

  if (item.type === 'panel-chart') {
    const row = document.createElement('div');
    row.className = 'menu-row menu-row-panel-card disabled';
    row.innerHTML = buildPanelChartMarkup();
    return row;
  }

  if (item.type === 'panel-provider-traffic') {
    const row = document.createElement('div');
    row.className = 'menu-row menu-row-panel-card disabled';
    row.innerHTML = buildPanelProviderTrafficMarkup(item.payload || null);
    return row;
  }

  if (item.type === 'provider') {
    const row = document.createElement('div');
    row.className = 'menu-row menu-row-provider disabled';
    const bullet = document.createElement('div');
    bullet.className = 'menu-leading provider-bullet';
    row.appendChild(bullet);
    const label = document.createElement('div');
    label.className = 'menu-label';
    label.textContent = item.label || '';
    row.appendChild(label);
    if (item.rightText) {
      const right = document.createElement('div');
      right.className = 'menu-right';
      right.textContent = String(item.rightText || '');
      row.appendChild(right);
    }
    return row;
  }

  if (item.type === 'child') {
    const row = document.createElement('div');
    const clickable = item.enabled !== false && item.action;
    row.className = `menu-row menu-row-child status-${String(item.status || 'unknown')}`;
    if (clickable) {
      row.classList.add('clickable');
    } else {
      row.classList.add('disabled');
    }
    if (item.checked) {
      row.classList.add('selected');
    }
    if (item.action) {
      row.dataset.action = String(item.action);
    }
    const bullet = document.createElement('div');
    bullet.className = 'menu-leading child-bullet';
    row.appendChild(bullet);
    const label = document.createElement('div');
    label.className = 'menu-label';
    label.textContent = item.label || '';
    row.appendChild(label);
    if (item.rightText) {
      const right = document.createElement('div');
      right.className = 'menu-right';
      right.textContent = String(item.rightText || '');
      row.appendChild(right);
    }
    if (clickable) {
      row.addEventListener('click', async (event) => {
        event.stopPropagation();
        await runActionForItem(item);
      });
    }
    return row;
  }

  const row = document.createElement('div');
  row.className = 'menu-row';
  if (item.action) {
    row.dataset.action = String(item.action);
  }
  if (item.iconKey) {
    row.dataset.iconKey = String(item.iconKey);
  }
  const actionName = item && item.action ? String(item.action).trim() : '';
  const pending = NETWORK_TOGGLE_ACTIONS.has(actionName) && pendingActionSet.has(actionName);
  const isLoading = NETWORK_TOGGLE_ACTIONS.has(actionName) && loadingVisibleSet.has(actionName);
  const clickable = item.enabled !== false && !pending;
  const checked = typeof item.checked === 'boolean' && item.checked;
  if (clickable) {
    row.classList.add('clickable');
  } else {
    row.classList.add('disabled');
  }
  if (checked) {
    row.classList.add('selected');
  }

  const leadingParts = makeLeading(item, isLoading);
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

  if (clickable) {
    row.addEventListener('click', async (event) => {
      event.stopPropagation();
      await runActionForItem(item);
    });
  }
  return row;
}

function isScrollableSubmenuKey(key = '') {
  return String(key || '').startsWith('outbound-group:');
}

function getVisibleSubmenuItems() {
  return submenuItems;
}

function applySubmenuWidthByContent() {
  if (!submenuRootEl) {
    return { width: SUBMENU_MIN_WIDTH, height: 0 };
  }
  const scrollableMode = isScrollableSubmenuKey(submenuKey);
  if (submenuListEl) {
    if (scrollableMode) {
      const viewportHeight = window.screen && Number.isFinite(Number(window.screen.availHeight))
        ? Number(window.screen.availHeight)
        : window.innerHeight;
      const maxHeight = Math.max(420, Math.min(760, Math.floor(viewportHeight * 0.8)));
      submenuListEl.style.maxHeight = `${maxHeight}px`;
      submenuListEl.style.overflowY = 'auto';
    } else {
      submenuListEl.style.maxHeight = '';
      submenuListEl.style.overflowY = '';
    }
  }
  if (submenuKey === 'panel') {
    submenuRootEl.style.width = 'max-content';
  } else {
    submenuRootEl.style.width = 'fit-content';
  }
  const measured = Math.ceil(
    Math.max(
      submenuRootEl.scrollWidth || 0,
      submenuRootEl.getBoundingClientRect().width || 0,
      submenuListEl ? submenuListEl.scrollWidth || 0 : 0,
    ),
  );
  const width = submenuKey === 'panel'
    ? Math.max(SUBMENU_PANEL_MIN_WIDTH, Math.min(measured, SUBMENU_PANEL_MAX_WIDTH))
    : Math.max(SUBMENU_MIN_WIDTH, Math.min(measured, SUBMENU_MAX_WIDTH));
  submenuRootEl.style.width = `${width}px`;
  const listHeight = submenuListEl
    ? Math.ceil(
        scrollableMode
          ? Math.max(submenuListEl.clientHeight || 0, submenuListEl.getBoundingClientRect().height || 0)
          : Math.max(submenuListEl.scrollHeight || 0, submenuListEl.getBoundingClientRect().height || 0),
      )
    : 0;
  const height = Math.ceil(
    Math.max(
      submenuRootEl.scrollHeight || 0,
      submenuRootEl.getBoundingClientRect().height || 0,
      listHeight,
    ),
  );
  return { width, height };
}

function resizeSubmenuToContent() {
  const metrics = applySubmenuWidthByContent();
  const width = Math.max(SUBMENU_MIN_WIDTH, Math.ceil(metrics && metrics.width ? metrics.width : 0));
  const height = Math.max(60, Math.ceil(metrics && metrics.height ? metrics.height : 0));
  if (width === lastResizeWidth && height === lastResizeHeight) {
    return;
  }
  lastResizeWidth = width;
  lastResizeHeight = height;
  window.clashfox.traySubmenuResize({ width, height });
}

function renderSubmenu() {
  if (!submenuRendererVisible) {
    return;
  }
  submenuListEl.innerHTML = '';
  getVisibleSubmenuItems().forEach((item) => {
    submenuListEl.appendChild(makeRow(item));
  });
  requestAnimationFrame(() => {
    resizeSubmenuToContent();
  });
}

function setSubmenu(payload) {
  submenuKey = payload && payload.key ? payload.key : '';
  submenuItems = Array.isArray(payload && payload.items) ? payload.items : [];
  if (submenuRootEl) {
    submenuRootEl.dataset.submenuKey = submenuKey;
  }
  if (!submenuRendererVisible) {
    return;
  }
  renderSubmenu();
  ensureConnectivityRefresh();
  if (submenuKey === 'panel') {
    openPanelTrafficSocket().catch(() => {});
    requestAnimationFrame(() => {
      renderPanelTrafficChart();
    });
  } else {
    closePanelTrafficSocket();
  }
}

applyTrayTheme().catch(() => {});

if (window.clashfox && typeof window.clashfox.onTraySubmenuUpdate === 'function') {
  window.clashfox.onTraySubmenuUpdate((payload) => {
    applyTrayTheme().catch(() => {});
    setSubmenu(payload);
  });
}

if (window.clashfox && typeof window.clashfox.onTraySubmenuVisibility === 'function') {
  window.clashfox.onTraySubmenuVisibility((payload = {}) => {
    setSubmenuRendererVisible(Boolean(payload && payload.visible));
  });
}

if (window.clashfox && typeof window.clashfox.onSystemThemeChange === 'function') {
  window.clashfox.onSystemThemeChange(() => {
    applyTrayTheme().catch(() => {});
  });
}

if (window.clashfox && typeof window.clashfox.onSettingsUpdated === 'function') {
  window.clashfox.onSettingsUpdated((settings = {}) => {
    const appearance = settings && typeof settings.appearance === 'object' ? settings.appearance : {};
    const mergedSettings = {
      ...(trayThemeSettingsSnapshot || {}),
      ...(settings || {}),
    };
    const nextSignature = String(
      mergedSettings.theme
      || (mergedSettings.appearance && mergedSettings.appearance.theme)
      || (mergedSettings.appearance && mergedSettings.appearance.colorMode)
      || 'auto',
    ).trim().toLowerCase();
    if (nextSignature === lastSettingsSignature) {
      return;
    }
    lastSettingsSignature = nextSignature;
    if (!submenuRendererVisible) {
      return;
    }
    applyTrayTheme(mergedSettings).catch(() => {});
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


if (window.clashfox && typeof window.clashfox.traySubmenuHover === 'function') {
  const sendHover = (nextValue) => {
    const normalized = Boolean(nextValue);
    if (normalized === lastHoverSent) {
      return;
    }
    lastHoverSent = normalized;
    window.clashfox.traySubmenuHover(normalized);
  };
  if (submenuRootEl) {
    submenuRootEl.addEventListener('mouseenter', () => sendHover(true));
    submenuRootEl.addEventListener('mousemove', () => sendHover(true));
    submenuRootEl.addEventListener('mouseleave', () => sendHover(false));
  }
}

if (window.clashfox && typeof window.clashfox.traySubmenuReady === 'function') {
  window.clashfox.traySubmenuReady();
}

if (submenuListEl) {
  submenuListEl.addEventListener('scroll', () => {
    if (window.clashfox && typeof window.clashfox.traySubmenuHover === 'function') {
      window.clashfox.traySubmenuHover(true);
      lastHoverSent = true;
    }
  });
}

window.addEventListener('beforeunload', () => {
  stopSubmenuLiveActivity();
});
