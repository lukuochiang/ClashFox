const submenuRootEl = document.getElementById('submenuRoot');
const submenuListEl = document.getElementById('submenuList');

let submenuKey = '';
let submenuItems = [];
let submenuMeta = {};
let connectivityRefreshTimer = null;
let kernelUptimeTimer = null;
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
let systemThemeIsDark = null;
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
const MIHOMO_START_TIME_KEY = 'mihomo_start_time';
let submenuRendererVisible = false;
let resizeSubmenuFrame = null;
let submenuMeasureGeneration = 0;
let submenuMeasureObserver = null;
const FOX_RANK_SKIN_PALETTES = {
  campfire: { start: '#ffb86c', end: '#ff8f57' },
  aurora: { start: '#7df3d2', end: '#4bc6ff' },
  starlight: { start: '#c685ff', end: '#8d6dff' },
  'solar-crown': { start: '#f6d365', end: '#fda085' },
  'nebula-flare': { start: '#ff8bd8', end: '#8f7cff' },
  'void-aurora': { start: '#8ef0ff', end: '#6ea0ff' },
};

function nextTick() {
  return Promise.resolve();
}

function waitForFontsReady() {
  if (!document.fonts || !document.fonts.ready || typeof document.fonts.ready.then !== 'function') {
    return Promise.resolve();
  }
  return document.fonts.ready.catch(() => {});
}

function waitForAnimationFrame() {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame !== 'function') {
      resolve();
      return;
    }
    requestAnimationFrame(() => resolve());
  });
}

function getTextVisualUnits(text = '') {
  return Array.from(String(text || '')).reduce((count, char) => {
    if (/[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/u.test(char)) {
      return count + 2;
    }
    return count + 1;
  }, 0);
}

function getSubmenuLayout() {
  return submenuMeta && typeof submenuMeta === 'object'
    ? String(submenuMeta.layout || '').trim()
    : '';
}

function clearSubmenuResizeObserver() {
  if (submenuMeasureObserver) {
    try {
      submenuMeasureObserver.disconnect();
    } catch {
      // ignore
    }
    submenuMeasureObserver = null;
  }
}

function ensureSubmenuResizeObserver() {
  if (submenuMeasureObserver || typeof ResizeObserver !== 'function') {
    return;
  }
  submenuMeasureObserver = new ResizeObserver(() => {
    if (!submenuRendererVisible) {
      return;
    }
    scheduleResizeSubmenuToContent();
  });
  if (submenuRootEl) {
    submenuMeasureObserver.observe(submenuRootEl);
  }
  if (submenuListEl) {
    submenuMeasureObserver.observe(submenuListEl);
  }
}

async function applyTrayTheme(preloadedSettings = null) {
  try {
    if (!document.body) {
      return;
    }
    let preference = '';
    let resolvedSettings = null;
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
    resolvedSettings = settings;
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
      resolvedSettings = settings;
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
      if (systemThemeIsDark !== null) {
        theme = systemThemeIsDark ? 'night' : 'day';
      } else {
        theme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'night'
          : 'day';
      }
    }
    document.body.dataset.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    applyFoxRankThemeCssVarsFromSettings(resolvedSettings);
  } catch {
    let fallback;
    if (systemThemeIsDark !== null) {
      fallback = systemThemeIsDark ? 'night' : 'day';
    } else {
      fallback = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'night'
        : 'day';
    }
    if (document.body) {
      document.body.dataset.theme = fallback;
      document.documentElement.setAttribute('data-theme', fallback);
      applyFoxRankThemeCssVarsFromSettings(null);
    }
  }
}

function resolveFoxRankSkinPaletteFromSettings(settings = null) {
  const source = settings && typeof settings === 'object' ? settings : {};
  const appearance = source && typeof source.appearance === 'object' ? source.appearance : {};
  const skinId = String(
    source.foxRankSkin
    || appearance.foxRankSkin
    || '',
  ).trim().toLowerCase();
  const palette = FOX_RANK_SKIN_PALETTES[skinId] || null;
  return {
    skinId,
    start: String(palette && palette.start ? palette.start : '#8dc2fa'),
    end: String(palette && palette.end ? palette.end : '#6ea7ea'),
  };
}

function applyFoxRankThemeCssVarsFromSettings(settings = null) {
  const palette = resolveFoxRankSkinPaletteFromSettings(settings);
  const targets = [document.documentElement, document.body].filter(Boolean);
  targets.forEach((node) => {
    node.style.setProperty('--fox-rank-skin-start', palette.start);
    node.style.setProperty('--fox-rank-skin-end', palette.end);
    node.style.setProperty('--fox-rank-aura-start', palette.start);
    node.style.setProperty('--fox-rank-aura-end', palette.end);
    node.style.setProperty('--accent', palette.start);
    node.style.setProperty('--accent-strong', palette.end);
    node.style.setProperty('--chart-down', palette.start);
    node.style.setProperty('--chart-up', palette.end);
    if (palette.skinId) {
      node.dataset.foxRankSkin = palette.skinId;
    } else if (node.dataset && Object.prototype.hasOwnProperty.call(node.dataset, 'foxRankSkin')) {
      delete node.dataset.foxRankSkin;
    }
  });
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
  kernelManager: '<svg viewBox="0 0 24 24"><rect x="7" y="7" width="10" height="10" rx="2"/><path d="M3 10h2M3 14h2M19 10h2M19 14h2M10 3v2M14 3v2M10 19v2M14 19v2"/></svg>',
  kernelStart: '<svg viewBox="0 0 24 24"><path d="M8 6l10 6-10 6z"/></svg>',
  kernelStop: '<svg viewBox="0 0 24 24"><rect x="7" y="7" width="10" height="10" rx="1.5"/></svg>',
  kernelRestart: '<svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v6h-6"/></svg>',
  folder: '<svg viewBox="0 0 24 24"><path d="M3 7h7l2 2h9v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/><path d="M3 7V5a2 2 0 0 1 2-2h5l2 2h9"/></svg>',
  userDir: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.2"/><path d="M5 19a7 7 0 0 1 14 0v1H5z"/></svg>',
  coreDir: '<svg viewBox="0 0 24 24"><rect x="7" y="7" width="10" height="10" rx="2"/><path d="M3 10h2M3 14h2M19 10h2M19 14h2M10 3v2M14 3v2M10 19v2M14 19v2"/></svg>',
  dataDir: '<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="14" rx="2"/><path d="M8 9h8M8 13h5"/></svg>',
  workDir: '<svg viewBox="0 0 24 24"><path d="M4 9h16v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9z"/><path d="M8 9V7a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M4 12h16"/></svg>',
  helperDir: '<svg viewBox="0 0 24 24"><path d="M12 3 6.5 5.5v4.2c0 3.8 2.2 7.1 5.5 8.6 3.3-1.5 5.5-4.8 5.5-8.6V5.5L12 3Z" fill="var(--icon-fill-success)"/><path d="m9.4 12.1 1.6 1.6 3.7-3.7" fill="var(--icon-fill-text)"/></svg>',
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
  stopKernelUptimeRefresh();
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
  if (submenuKey === 'kernel') {
    ensureKernelUptimeRefresh();
  }
}

function setSubmenuRendererVisible(nextVisible) {
  const visible = Boolean(nextVisible);
  if (submenuRendererVisible === visible) {
    return;
  }
  submenuRendererVisible = visible;
  if (!visible) {
    submenuMeasureGeneration += 1;
    if (resizeSubmenuFrame !== null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(resizeSubmenuFrame);
      resizeSubmenuFrame = null;
    }
    clearSubmenuResizeObserver();
    stopSubmenuLiveActivity();
    lastResizeWidth = 0;
    lastResizeHeight = 0;
    return;
  }
  ensureSubmenuResizeObserver();
  submenuMeasureGeneration += 1;
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
  const errorText = payload && payload.error ? String(payload.error).trim() : '';
  if (!summary) {
    return '';
  }
  if (!items.length) {
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
            <div class="provider-traffic-item-name">No provider data</div>
            <div class="provider-traffic-item-percent">-</div>
          </div>
          <div class="provider-traffic-item-meta secondary">
            <span>${errorText ? `No provider data (${errorText})` : 'Check provider subscription info'}</span>
            <span>Expire -</span>
          </div>
        </div>
      </div>
    `;
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

function formatKernelUptime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '-';
  }
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const base = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  return days > 0 ? `${days}d ${base}` : base;
}

function getMihomoStartTime() {
  try {
    const stored = localStorage.getItem(MIHOMO_START_TIME_KEY);
    if (stored) {
      const time = Number.parseInt(stored, 10);
      if (Number.isFinite(time) && time > 0) {
        return time;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

function setMihomoStartTime(timestamp) {
  try {
    if (timestamp == null || timestamp <= 0) {
      localStorage.removeItem(MIHOMO_START_TIME_KEY);
    } else {
      localStorage.setItem(MIHOMO_START_TIME_KEY, String(timestamp));
    }
  } catch {
    // ignore
  }
}

function isKernelRunningFromSubmenuItems(items = []) {
  const list = Array.isArray(items) ? items : [];
  const startItem = list.find((item) => item && item.action === 'kernel-start');
  const stopItem = list.find((item) => item && item.action === 'kernel-stop');
  const restartItem = list.find((item) => item && item.action === 'kernel-restart');
  const startEnabled = startItem ? startItem.enabled !== false : false;
  const stopEnabled = stopItem ? stopItem.enabled !== false : false;
  const restartEnabled = restartItem ? restartItem.enabled !== false : false;
  if (stopEnabled || restartEnabled) {
    return true;
  }
  if (startItem) {
    return !startEnabled;
  }
  return false;
}

function stopKernelUptimeRefresh() {
  if (kernelUptimeTimer) {
    clearInterval(kernelUptimeTimer);
    kernelUptimeTimer = null;
  }
}

function applyKernelUptimeBadge() {
  if (!submenuRendererVisible || submenuKey !== 'kernel' || !Array.isArray(submenuItems)) {
    return;
  }
  const running = isKernelRunningFromSubmenuItems(submenuItems);
  if (!running) {
    setMihomoStartTime(null);
  }
  let nextText = '-';
  let nextTone = 'neutral';
  if (running) {
    let startTime = getMihomoStartTime();
    if (!startTime) {
      startTime = Date.now();
      setMihomoStartTime(startTime);
    }
    const elapsedSec = Math.max(0, Math.floor((Date.now() - startTime) / 1000));
    nextText = formatKernelUptime(elapsedSec);
    nextTone = 'good';
  }
  let changed = false;
  submenuItems = submenuItems.map((item) => {
    if (!item || item.type === 'separator') {
      return item;
    }
    if (item.iconKey === 'kernelManager' && !item.action) {
      const badge = item.rightBadge && typeof item.rightBadge === 'object' ? item.rightBadge : {};
      if (String(badge.text || '') === nextText && String(badge.tone || '') === nextTone) {
        return item;
      }
      changed = true;
      return {
        ...item,
        rightBadge: {
          text: nextText,
          tone: nextTone,
        },
      };
    }
    return item;
  });
  if (!changed) {
    return;
  }
  const badgeEl = submenuListEl
    ? submenuListEl.querySelector('.menu-row[data-icon-key="kernelManager"] .menu-badge')
    : null;
  if (badgeEl) {
    badgeEl.className = `menu-badge tone-${nextTone}`;
    badgeEl.textContent = nextText;
    return;
  }
  renderSubmenu();
}

function ensureKernelUptimeRefresh() {
  stopKernelUptimeRefresh();
  if (!submenuRendererVisible || submenuKey !== 'kernel') {
    return;
  }
  applyKernelUptimeBadge();
  kernelUptimeTimer = setInterval(() => {
    applyKernelUptimeBadge();
  }, 1000);
}

function applyConnectivitySnapshot(snapshot) {
  if (!snapshot || !Array.isArray(submenuItems)) {
    return;
  }
  const text = snapshot.text ? String(snapshot.text) : '-';
  const tone = snapshot.tone ? String(snapshot.tone) : 'neutral';
  let changed = false;
  submenuItems = submenuItems.map((item) => {
    if (!item || item.type === 'separator') {
      return item;
    }
    if (item.iconKey === 'connectivityQuality') {
      const currentBadge = item.rightBadge && typeof item.rightBadge === 'object'
        ? item.rightBadge
        : {};
      const currentText = String(currentBadge.text || '');
      const currentTone = String(currentBadge.tone || '');
      if (currentText === text && currentTone === tone) {
        return item;
      }
      changed = true;
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
  if (changed) {
    renderSubmenu();
  }
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
  stopConnectivityRefresh();
  if (!submenuRendererVisible || submenuKey !== 'network') {
    return;
  }
  refreshConnectivityBadge(true);
  // connectivityRefreshTimer = setInterval(() => {
  //   refreshConnectivityBadge(false);
  // }, CONNECTIVITY_REFRESH_MS);
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
  if (actionName === 'kernel-start' || actionName === 'kernel-stop' || actionName === 'kernel-restart') {
    const runningFromResponse = response && Object.prototype.hasOwnProperty.call(response, 'kernelRunning')
      ? Boolean(response.kernelRunning)
      : null;
    if (runningFromResponse === true) {
      if (actionName === 'kernel-restart') {
        setMihomoStartTime(Date.now());
      } else if (!getMihomoStartTime()) {
        setMihomoStartTime(Date.now());
      }
    } else if (runningFromResponse === false) {
      setMihomoStartTime(null);
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
      const latestMeta = data
        && data.submenuMeta
        && data.submenuMeta[response.submenu]
        && typeof data.submenuMeta[response.submenu] === 'object'
        ? data.submenuMeta[response.submenu]
        : {};
      if (latestItems) {
        setSubmenu({
          key: response.submenu,
          items: latestItems,
          meta: latestMeta,
        });
        if (response.submenu === 'kernel') {
          applyKernelUptimeBadge();
        }
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
    row.classList.add(`status-${String(item.status || 'unknown')}`);
    if (item.checked || String(item.status || '').toLowerCase() === 'current') {
      row.classList.add('selected');
    }
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
    if (item.action) {
      row.dataset.action = String(item.action);
    }
    if (item.checked) {
      row.classList.add('selected');
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

  const row = document.createElement('div');
  row.className = 'menu-row';
  if (item.action) {
    row.dataset.action = String(item.action);
  }
  if (item.iconKey) {
    row.dataset.iconKey = String(item.iconKey);
  }
  const actionName = item && item.action ? String(item.action).trim() : '';
  const isNetworkToggle = NETWORK_TOGGLE_ACTIONS.has(actionName);
  const pending = NETWORK_TOGGLE_ACTIONS.has(actionName) && pendingActionSet.has(actionName);
  const isLoading = NETWORK_TOGGLE_ACTIONS.has(actionName) && loadingVisibleSet.has(actionName);
  const clickable = item.enabled !== false && !pending;
  if (clickable) {
    row.classList.add('clickable');
  } else {
    row.classList.add('disabled');
  }

  const leadingParts = makeLeading(item, isLoading);
  if (typeof item.checked === 'boolean' && !isNetworkToggle) {
    row.appendChild(leadingParts.check);
    if (item.checked) {
      row.classList.add('selected');
    }
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

function getVisibleSubmenuItems() {
  return submenuItems;
}

function estimateSubmenuDimensions() {
  const items = Array.isArray(submenuItems) ? submenuItems : [];
  if (submenuKey === 'panel') {
    return { width: 260, height: 286 };
  }
  if (submenuKey === 'network') {
    const contentHeight = items.reduce((height, item) => {
      if (!item || typeof item !== 'object') {
        return height + 28;
      }
      switch (item.type) {
        case 'separator':
          return height + 11;
        default:
          if (item.iconKey === 'currentService') {
            return height + 38;
          }
          return height + 28;
      }
    }, 20);
    return {
      width: 300,
      height: Math.max(72, Math.min(220, Math.round(contentHeight))),
    };
  }
  const layout = getSubmenuLayout();
  let longestUnits = submenuKey === 'network' ? 16 : 10;
  let hasBadge = false;
  items.forEach((item) => {
    if (!item || typeof item !== 'object' || item.type === 'separator') {
      return;
    }
    const labelUnits = getTextVisualUnits(item.label || '');
    const rightUnits = item.rightBadge && item.rightBadge.text
      ? Math.max(6, getTextVisualUnits(item.rightBadge.text))
      : (item.rightText ? getTextVisualUnits(item.rightText) : 0);
    longestUnits = Math.max(longestUnits, labelUnits + Math.min(10, rightUnits));
    hasBadge = hasBadge || Boolean((item.rightBadge && item.rightBadge.text) || item.rightText);
  });
  const chromeWidth = String(submenuKey || '').startsWith('outbound-group:') ? 92 : 110;
  const badgeWidth = hasBadge ? 68 : 0;
  const estimatedWidth = chromeWidth + badgeWidth + (longestUnits * 6) + 8;
  const width = layout === 'scrollable'
    ? Math.max(312, Math.min(336, Math.round(estimatedWidth)))
    : Math.max(196, Math.min(300, Math.round(estimatedWidth)));
  const contentHeight = items.reduce((height, item) => {
    if (!item || typeof item !== 'object') {
      return height + 28;
    }
    switch (item.type) {
      case 'separator':
        return height + 11;
      case 'provider':
        return height + 24;
      case 'child':
        return height + 22;
      case 'panel-chart':
        return height + 132;
      case 'panel-provider-traffic':
        return height + 154;
      default:
        if (submenuKey === 'network' && item.iconKey === 'currentService') {
          return height + 38;
        }
        return height + 28;
    }
  }, 20);
  const heightCap = submenuKey === 'panel'
    ? 500
    : (layout === 'scrollable'
      ? 520
      : (submenuKey === 'network' ? 220 : 420));
  return {
    width,
    height: Math.max(72, Math.min(heightCap, Math.round(contentHeight))),
  };
}

function isScrollableSubmenuKey(key = submenuKey) {
  return key === submenuKey
    ? getSubmenuLayout() === 'scrollable'
    : false;
}

function measureSubmenuContentHeight() {
  if (submenuListEl) {
    if (typeof submenuListEl.scrollHeight === 'number') {
      const measured = Math.ceil(submenuListEl.scrollHeight || 0);
      if (measured > 0) {
        return measured;
      }
    }
  }
  return Math.max(0, Math.ceil(submenuRootEl ? submenuRootEl.scrollHeight || 0 : 0));
}

function getSubmenuMeasureWidth() {
  if (submenuKey === 'network') {
    return 300;
  }
  const metrics = estimateSubmenuDimensions();
  const baseWidth = Math.max(SUBMENU_MIN_WIDTH, Math.ceil(metrics.width || 0));
  if (lastResizeWidth > 0) {
    return lastResizeWidth;
  }
  return baseWidth;
}

function getSubmenuHeightCap() {
  if (submenuKey === 'panel') {
    return 500;
  }
  if (isScrollableSubmenuKey()) {
    return 520;
  }
  if (submenuKey === 'network') {
    return 220;
  }
  return 420;
}

function resizeSubmenuToContent(force = false) {
  const width = Math.max(SUBMENU_MIN_WIDTH, getSubmenuMeasureWidth());
  const measuredHeight = measureSubmenuContentHeight();
  const fallbackHeight = estimateSubmenuDimensions().height || 0;
  const cap = getSubmenuHeightCap();
  const contentHeight = Math.ceil(measuredHeight || fallbackHeight || 0);
  const height = Math.max(60, Math.min(cap, contentHeight));
  const scrollable = isScrollableSubmenuKey();
  if (!force && width === lastResizeWidth && height === lastResizeHeight) {
    return false;
  }
  lastResizeWidth = width;
  lastResizeHeight = height;
  if (submenuRootEl) {
    submenuRootEl.style.width = `${width}px`;
    submenuRootEl.style.maxHeight = '';
    submenuRootEl.classList.toggle('is-scrollable', scrollable);
  }
  if (submenuListEl) {
    if (scrollable) {
      submenuListEl.style.maxHeight = `${Math.max(96, height)}px`;
      submenuListEl.style.overflowY = contentHeight > height ? 'auto' : 'hidden';
    } else {
      submenuListEl.style.maxHeight = `${Math.max(96, height)}px`;
      submenuListEl.style.overflowY = contentHeight > height ? 'auto' : 'hidden';
    }
  }
  window.clashfox.traySubmenuResize({ width, height });
  return true;
}

function scheduleResizeSubmenuToContent() {
  if (resizeSubmenuFrame !== null && typeof cancelAnimationFrame === 'function') {
    cancelAnimationFrame(resizeSubmenuFrame);
    resizeSubmenuFrame = null;
  }
  const generation = submenuMeasureGeneration;
  const run = async () => {
    resizeSubmenuFrame = null;
    if (!submenuRendererVisible || generation !== submenuMeasureGeneration) {
      return;
    }
    await nextTick();
    if (!submenuRendererVisible || generation !== submenuMeasureGeneration) {
      return;
    }
    await waitForFontsReady();
    if (!submenuRendererVisible || generation !== submenuMeasureGeneration) {
      return;
    }
    await waitForAnimationFrame();
    if (!submenuRendererVisible || generation !== submenuMeasureGeneration) {
      return;
    }
    resizeSubmenuToContent(false);
  };
  if (typeof requestAnimationFrame === 'function') {
    resizeSubmenuFrame = requestAnimationFrame(() => {
      run().catch(() => {});
    });
    return;
  }
  run().catch(() => {});
}

function renderSubmenu() {
  if (!submenuRendererVisible) {
    return;
  }
  submenuListEl.innerHTML = '';
  getVisibleSubmenuItems().forEach((item) => {
    submenuListEl.appendChild(makeRow(item));
  });
  scheduleResizeSubmenuToContent();
}

function setSubmenu(payload) {
  const nextKey = payload && payload.key ? payload.key : '';
  const keyChanged = nextKey !== submenuKey;
  submenuKey = nextKey;
  submenuItems = Array.isArray(payload && payload.items) ? payload.items : [];
  submenuMeta = payload && payload.meta && typeof payload.meta === 'object' ? payload.meta : {};
  if (keyChanged) {
    lastResizeWidth = 0;
    lastResizeHeight = 0;
  }
  if (submenuRootEl) {
    submenuRootEl.dataset.submenuKey = submenuKey;
    submenuRootEl.classList.toggle('is-scrollable', isScrollableSubmenuKey());
  }
  if (!submenuRendererVisible) {
    return;
  }
  ensureSubmenuResizeObserver();
  renderSubmenu();
  ensureConnectivityRefresh();
  ensureKernelUptimeRefresh();
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
  window.clashfox.onSystemThemeChange((payload = {}) => {
    if (payload && typeof payload.dark === 'boolean') {
      systemThemeIsDark = payload.dark;
    }
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
      [
        String(
          mergedSettings.theme
          || (mergedSettings.appearance && mergedSettings.appearance.theme)
          || (mergedSettings.appearance && mergedSettings.appearance.colorMode)
          || 'auto',
        ).trim().toLowerCase(),
        String(
          mergedSettings.foxRankSkin
          || (mergedSettings.appearance && mergedSettings.appearance.foxRankSkin)
          || '',
        ).trim().toLowerCase(),
      ].join('|')
    );
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
  clearSubmenuResizeObserver();
  if (resizeSubmenuFrame !== null && typeof cancelAnimationFrame === 'function') {
    cancelAnimationFrame(resizeSubmenuFrame);
    resizeSubmenuFrame = null;
  }
  stopSubmenuLiveActivity();
});
