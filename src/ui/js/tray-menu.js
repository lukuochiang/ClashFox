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
let lastMenuRenderSignature = '';
let lastHeaderRenderSignature = '';
let lastMainListRenderSignature = '';
let menuResizeObserver = null;
let menuMutationObserver = null;
let geometryRaf = 0;
let suppressSubmenuUntil = 0;
let trayMenuRendererVisible = false;
let trayMenuSettingsRefreshTimer = null;
let lastSettingsSignature = '';
let lastMenuDataSettingsSignature = '';
let trayThemeSettingsSnapshot = null;
let trayMenuPaintReadySent = false;
let trayMenuPaintReadyFrame = null;
let systemThemeIsDark = null;

function nextTick() {
  return Promise.resolve();
}
const TRAFFIC_HISTORY_POINTS = 520;
const TRAFFIC_INTERVAL_MS = 1000;
const OVERVIEW_INTERVAL_MS = 5000;
const PROVIDER_TRAFFIC_ROTATE_MS = 2500;
const SETTINGS_CACHE_MS = 10000;
const TRAFFIC_CACHE_KEY = 'clashfox.trayMenuTrafficCache.v1';
const TRAFFIC_CACHE_MAX_AGE_MS = 15 * 60 * 1000;
const TRAFFIC_WS_RECONNECT_BASE_MS = 1500;
const TRAFFIC_WS_RECONNECT_MAX_MS = 12000;
const trafficState = {
  trafficTimer: null,
  overviewTimer: null,
  trafficLoading: false,
  overviewLoading: false,
  socket: null,
  socketUrl: '',
  socketLive: false,
  reconnectTimer: null,
  reconnectAttempts: 0,
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
  rotateTotalItems: 0,
  index: 0,
  paused: false,
  signature: '',
  renderKey: '',
};
const FOX_RANK_SKIN_PALETTES = {
  campfire: { start: '#ffb86c', end: '#ff8f57' },
  aurora: { start: '#7df3d2', end: '#4bc6ff' },
  starlight: { start: '#c685ff', end: '#8d6dff' },
  'solar-crown': { start: '#f6d365', end: '#fda085' },
  'nebula-flare': { start: '#ff8bd8', end: '#8f7cff' },
  'void-aurora': { start: '#8ef0ff', end: '#6ea0ff' },
};

function hasTrafficChartData() {
  return Math.max(trafficState.historyRx.length, trafficState.historyTx.length, 0) > 0;
}

function syncTrafficChartVisibility() {
  if (!chartEl) {
    return;
  }
  const shouldShow = trafficState.chartEnabled && hasTrafficChartData();
  chartEl.classList.toggle('is-hidden', !shouldShow);
  scheduleGeometrySync();
}

function stopMenuLiveActivity() {
  stopProviderTrafficRotation();
  stopTrafficTimers();
}

function clearTrayMenuPaintReadyFrame() {
  if (trayMenuPaintReadyFrame !== null && typeof cancelAnimationFrame === 'function') {
    cancelAnimationFrame(trayMenuPaintReadyFrame);
    trayMenuPaintReadyFrame = null;
  }
}

function scheduleTrayMenuPaintReady() {
  if (!trayMenuRendererVisible || trayMenuPaintReadySent || !menuData) {
    return;
  }
  clearTrayMenuPaintReadyFrame();
  const run = async () => {
    trayMenuPaintReadyFrame = null;
    if (!trayMenuRendererVisible || trayMenuPaintReadySent) {
      return;
    }
    await nextTick();
    if (!trayMenuRendererVisible || trayMenuPaintReadySent) {
      return;
    }
    await applyTrayTheme().catch(() => {});
    await Promise.resolve();
    if (!trayMenuRendererVisible || trayMenuPaintReadySent) {
      return;
    }
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => {
        if (!trayMenuRendererVisible || trayMenuPaintReadySent) {
          return;
        }
        trayMenuPaintReadySent = true;
        if (window.clashfox && typeof window.clashfox.trayMenuPaintReady === 'function') {
          window.clashfox.trayMenuPaintReady();
        }
      });
      return;
    }
    trayMenuPaintReadySent = true;
    if (window.clashfox && typeof window.clashfox.trayMenuPaintReady === 'function') {
      window.clashfox.trayMenuPaintReady();
    }
  };
  if (typeof requestAnimationFrame === 'function') {
    trayMenuPaintReadyFrame = requestAnimationFrame(() => {
      run().catch(() => {});
    });
    return;
  }
  run().catch(() => {});
}

function stopTrayMenuSettingsRefresh() {
  if (trayMenuSettingsRefreshTimer) {
    clearTimeout(trayMenuSettingsRefreshTimer);
    trayMenuSettingsRefreshTimer = null;
  }
}

function scheduleTrayMenuSettingsRefresh() {
  if (!trayMenuRendererVisible) {
    return;
  }
  if (trayMenuSettingsRefreshTimer) {
    return;
  }
  trayMenuSettingsRefreshTimer = setTimeout(async () => {
    trayMenuSettingsRefreshTimer = null;
    if (!trayMenuRendererVisible) {
      return;
    }
    try {
      const nextData = await window.clashfox.trayMenuGetData();
      if (nextData && typeof nextData === 'object') {
        const nextSignature = buildMenuRenderSignature(nextData);
        if (nextSignature === lastMenuRenderSignature) {
          return;
        }
        menuData = nextData;
        lastMenuRenderSignature = nextSignature;
        renderAll();
        scheduleGeometrySync();
      }
    } catch {
      trayLog('settings', 'tray menu refresh after settings update failed', null, 'warn');
    }
  }, 120);
}

function startMenuLiveActivity() {
  if (!trayMenuRendererVisible) {
    return;
  }
  if (menuData && providerTrafficState.renderKey) {
    renderProviderTraffic();
  }
  if (chartEl) {
    startTrafficTimers();
  }
}

function setTrayMenuRendererVisible(nextVisible) {
  const visible = Boolean(nextVisible);
  if (trayMenuRendererVisible === visible) {
    return;
  }
  trayMenuRendererVisible = visible;
  if (!visible) {
    stopMenuLiveActivity();
    stopTrayMenuSettingsRefresh();
    clearTrayMenuPaintReadyFrame();
    trayMenuPaintReadySent = false;
    blockClickUntil = 0;
    return;
  }
  renderAll(true);
  syncTrafficChartVisibility();
  if (chartEl) {
    startTrafficTimers();
  }
  scheduleGeometrySync();
}

const TRAY_SIGNATURE_OMIT_KEYS = new Set(['generatedAt', 'updatedAt']);

function buildMenuRenderSignature(value = null) {
  try {
    return JSON.stringify(value || {}, (key, val) => {
      if (TRAY_SIGNATURE_OMIT_KEYS.has(key)) {
        return undefined;
      }
      return val;
    });
  } catch {
    return '';
  }
}

function buildHeaderRenderSignature(value = null) {
  try {
    return JSON.stringify((value && value.header) || {});
  } catch {
    return '';
  }
}

function buildMainListRenderSignature(value = null) {
  try {
    return JSON.stringify({
      items: Array.isArray(value && value.items) ? value.items : [],
      outboundProxyTree: value && value.outboundProxyTree ? value.outboundProxyTree : null,
    }, (key, val) => {
      if (TRAY_SIGNATURE_OMIT_KEYS.has(key)) {
        return undefined;
      }
      return val;
    });
  } catch {
    return '';
  }
}

function buildSubmenuRenderSignature(submenuKey = '', items = []) {
  const key = String(submenuKey || '').trim();
  const source = Array.isArray(items) ? items : [];
  const normalized = key === 'network'
    ? source.map((item) => {
      if (!item || typeof item !== 'object') {
        return item;
      }
      if (item.iconKey !== 'connectivityQuality') {
        return item;
      }
      const nextItem = { ...item, rightText: '' };
      if (nextItem.rightBadge && typeof nextItem.rightBadge === 'object') {
        nextItem.rightBadge = {
          ...nextItem.rightBadge,
          text: '',
          tone: '',
        };
      }
      return nextItem;
    })
    : source;
  return buildMenuRenderSignature(normalized);
}

function trayLog(scope, message, payload = null, level = 'log') {
  return;
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

function persistTrafficCache() {
  return;
}

function stopTrafficReconnect() {
  if (trafficState.reconnectTimer) {
    clearTimeout(trafficState.reconnectTimer);
    trafficState.reconnectTimer = null;
  }
}

function closeTrafficSocket() {
  stopTrafficReconnect();
  const socket = trafficState.socket;
  trafficState.socket = null;
  trafficState.socketUrl = '';
  trafficState.socketLive = false;
  if (!socket) {
    return;
  }
  try {
    socket.onopen = null;
    socket.onmessage = null;
    socket.onerror = null;
    socket.onclose = null;
    socket.close();
  } catch {
    // ignore socket close failures
  }
}

function scheduleTrafficReconnect() {
  stopTrafficReconnect();
  const attempt = Math.max(0, Number(trafficState.reconnectAttempts || 0));
  const delay = Math.min(
    TRAFFIC_WS_RECONNECT_MAX_MS,
    TRAFFIC_WS_RECONNECT_BASE_MS * Math.max(1, 2 ** attempt),
  );
  trafficState.reconnectTimer = setTimeout(() => {
    trafficState.reconnectTimer = null;
    openTrafficSocket().catch(() => {});
  }, delay);
}

function restoreTrafficCache() {
  return false;
}

const ICON_SVGS = {
  showMain: '<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="14" rx="2"/><path d="M4 9h16"/></svg>',
  networkTakeover: '<svg viewBox="0 0 24 24"><path d="M4 10a12 12 0 0 1 16 0"/><path d="M7 13a8 8 0 0 1 10 0"/><path d="M10 16a4 4 0 0 1 4 0"/><circle cx="12" cy="19" r="1"/></svg>',
  outboundMode: '<svg viewBox="0 0 24 24"><path d="M4 8h11"/><path d="M12 5l3 3-3 3"/><path d="M20 16H9"/><path d="M12 13l-3 3 3 3"/></svg>',
  proxyGroup: '<svg viewBox="0 0 24 24"><circle cx="7" cy="6.5" r="2.2"/><circle cx="17" cy="17.5" r="2.2"/><path d="M9.2 7h5.6a3.2 3.2 0 0 1 3.2 3.2v1.4"/><path d="M14.8 17H9.2A3.2 3.2 0 0 1 6 13.8v-1.4"/><path d="M15 7l3 3-3 3"/><path d="M9 17l-3-3 3-3"/></svg>',
  dashboard: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M8 14.5a4 4 0 0 1 8 0"/><path d="M12 12l3-3"/><circle cx="9" cy="10" r="1" class="menu-icon-fill"/></svg>',
  panel: '<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="14" rx="2" fill="rgba(86,156,255,0.18)" stroke="#5ea8ff" stroke-width="1.4"/><path d="M4 10h16" stroke="#f2b663" stroke-width="1.4"/><path d="M8 14h7" stroke="#67d39c" stroke-width="1.6" stroke-linecap="round"/><path d="M8 17h5" stroke="#c78bff" stroke-width="1.6" stroke-linecap="round"/></svg>',
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
  coreDir: '<svg viewBox="0 0 24 24"><rect x="7" y="7" width="10" height="10" rx="2"/><path d="M3 10h2M3 14h2M19 10h2M19 14h2M10 3v2M14 3v2M10 19v2M14 19v2"/></svg>',
  dataDir: '<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="14" rx="2"/><path d="M8 9h8M8 13h5"/></svg>',
  workDir: '<svg viewBox="0 0 24 24"><path d="M4 9h16v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9z"/><path d="M8 9V7a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M4 12h16"/></svg>',
  helperDir: '<svg viewBox="0 0 24 24"><rect x="3" y="10" width="18" height="9" rx="2"/><path d="M7 10V7a5 5 0 0 1 10 0v3"/><circle cx="12" cy="14.5" r="1.1"/></svg>',
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
  providerTrafficState.rotateTotalItems = 0;
}

function startProviderTrafficRotation(totalItems) {
  if (!Number.isFinite(totalItems) || totalItems <= 1) {
    stopProviderTrafficRotation();
    return;
  }
  if (providerTrafficState.rotateTimer && providerTrafficState.rotateTotalItems === totalItems) {
    return;
  }
  stopProviderTrafficRotation();
  providerTrafficState.rotateTotalItems = totalItems;
  trayLog('provider-traffic', 'rotation started', { totalItems });
  providerTrafficState.rotateTimer = setInterval(() => {
    if (providerTrafficState.paused) {
      return;
    }
    providerTrafficState.index = (providerTrafficState.index + 1) % totalItems;
    trayLog('provider-traffic', 'rotation tick', { index: providerTrafficState.index });
    renderProviderTraffic();
  }, PROVIDER_TRAFFIC_ROTATE_MS);
}

function renderProviderTraffic(force = false) {
  if (!trayMenuRendererVisible || !providerTrafficEl) {
    return;
  }
  const payload = menuData && menuData.providerTraffic && typeof menuData.providerTraffic === 'object'
    ? menuData.providerTraffic
    : null;
  const errorText = payload && payload.error ? String(payload.error).trim() : '';
  const summary = payload && payload.summary && typeof payload.summary === 'object'
    ? payload.summary
    : null;
  const items = payload && Array.isArray(payload.items) ? payload.items : [];
  if (!payload || !summary) {
    if (!providerTrafficEl.classList.contains('is-hidden') || providerTrafficEl.innerHTML) {
      providerTrafficEl.innerHTML = '';
      providerTrafficEl.classList.add('is-hidden');
    }
    stopProviderTrafficRotation();
    providerTrafficState.renderKey = '';
    trayLog('provider-traffic', 'render empty');
    return;
  }
  providerTrafficEl.classList.remove('is-hidden');
  if (items.length === 0) {
    const renderKey = [
      'empty',
      summary.providerCount || 0,
      summary.usedBytes || 0,
      summary.remainingBytes || 0,
    ].join('|');
    if (!force && providerTrafficState.renderKey === renderKey) {
      return;
    }
    providerTrafficState.renderKey = renderKey;
    providerTrafficState.signature = '';
    providerTrafficState.index = 0;
    stopProviderTrafficRotation();
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
          <div class="provider-traffic-item-name">No provider data</div>
          <div class="provider-traffic-item-percent">-</div>
        </div>
        <div class="provider-traffic-item-meta secondary">
          <span>${errorText ? `No provider data (${errorText})` : 'Check provider subscription info'}</span>
          <span>Expire -</span>
        </div>
      </div>
    `;
    providerTrafficEl.dataset.hasMultiple = 'false';
    return;
  }
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
  const renderKey = [
    signature,
    providerTrafficState.index,
    summary.providerCount || 0,
    summary.usedBytes || 0,
    summary.remainingBytes || 0,
  ].join('|');
  if (!force && providerTrafficState.renderKey === renderKey) {
    startProviderTrafficRotation(totalItems);
    return;
  }
  providerTrafficState.renderKey = renderKey;
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
  trayLog('provider-traffic', 'render completed', {
    providerCount: Number.parseInt(String(summary.providerCount || 0), 10) || 0,
    totalItems,
    index: providerTrafficState.index,
    current: currentItem && currentItem.name ? currentItem.name : '',
  });
  startProviderTrafficRotation(totalItems);
}

function renderTrafficBars() {
  if (!trayMenuRendererVisible || !chartBarsEl) {
    return;
  }
  const count = Math.max(trafficState.historyRx.length, trafficState.historyTx.length, 0);
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
  const emptySlots = Math.max(0, maxBars - visibleCount);
  const startX = 0;
  const xStep = maxBars > 1 ? (width - barWidth) / (maxBars - 1) : 0;
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
    const x = startX + i * xStep;
    const dataIndex = i - emptySlots;
    const hasSample = dataIndex >= 0 && dataIndex < visibleCount;
    const idx = hasSample ? (startIndex + dataIndex) : -1;
    const downValue = hasSample ? (trafficState.historyRx[idx] || 0) : 0;
    const upValue = hasSample ? (trafficState.historyTx[idx] || 0) : 0;
    const downHeight = Math.max(0, Math.min(available, (downValue / niceMaxRx) * available));
    const upHeight = Math.max(0, Math.min(available, (upValue / niceMaxTx) * available));
    if (pair.downBase) {
      pair.downBase.setAttribute('class', hasSample ? 'chart-bar-bg down' : 'chart-bar-bg down is-placeholder');
      pair.downBase.setAttribute('display', '');
      pair.downBase.setAttribute('x', x.toFixed(2));
      pair.downBase.setAttribute('y', baseline.toFixed(2));
      pair.downBase.setAttribute('width', barWidth.toFixed(2));
      pair.downBase.setAttribute('height', fixedHeight.toFixed(2));
      pair.downBase.setAttribute('rx', '0.35');
    }
    if (pair.upBase) {
      pair.upBase.setAttribute('class', hasSample ? 'chart-bar-bg up' : 'chart-bar-bg up is-placeholder');
      pair.upBase.setAttribute('display', '');
      pair.upBase.setAttribute('x', x.toFixed(2));
      pair.upBase.setAttribute('y', (baseline - fixedHeight).toFixed(2));
      pair.upBase.setAttribute('width', barWidth.toFixed(2));
      pair.upBase.setAttribute('height', fixedHeight.toFixed(2));
      pair.upBase.setAttribute('rx', '0.35');
    }
    if (hasSample && downHeight > 0.2) {
      pair.down.setAttribute('display', '');
      pair.down.setAttribute('x', x.toFixed(2));
      pair.down.setAttribute('y', baseline.toFixed(2));
      pair.down.setAttribute('width', barWidth.toFixed(2));
      pair.down.setAttribute('height', downHeight.toFixed(2));
      pair.down.setAttribute('rx', '0.35');
    } else {
      pair.down.setAttribute('display', 'none');
    }
    if (hasSample && upHeight > 0.2) {
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
  syncTrafficChartVisibility();
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
  syncTrafficChartVisibility();
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
  syncTrafficChartVisibility();
  if (!enabled) {
    stopMenuLiveActivity();
    resetTrafficChart();
    syncWindowGeometry();
    return;
  }
  if (trayMenuRendererVisible) {
    startMenuLiveActivity();
  }
}

function invalidateSettingsCache() {
  trafficState.settings = null;
  trafficState.settingsAt = 0;
}

function buildTrafficArgsFromSettings(settings = {}) {
  const source = settings && typeof settings === 'object' ? settings : {};
  const userDataPaths = source.userDataPaths && typeof source.userDataPaths === 'object'
    ? source.userDataPaths
    : {};
  const userAppDataDir = String(userDataPaths.userAppDataDir || '').trim();
  const dataDir = String(userDataPaths.dataDir || 'data').trim() || 'data';
  const configFile = String(
    userDataPaths.configFile
    || source.configFile
    || source.configPath
    || 'default.yaml',
  ).trim() || 'default.yaml';
  const fullConfigPath = userAppDataDir
    ? require('path').resolve(userAppDataDir, dataDir, configFile)
    : configFile;
  const controller = String(
    (source.panelManager && source.panelManager.externalController)
    || source.externalController
    || '',
  ).trim();
  const secret = String(
    (source.panelManager && source.panelManager.secret)
    || source.secret
    || '',
  ).trim();
  const args = [];
  if (fullConfigPath) {
    args.push('--config', fullConfigPath);
  }
  if (controller) {
    args.push('--controller', controller);
  }
  if (secret) {
    args.push('--secret', secret);
  }
  return args;
}

function buildTrayMenuSettingsSignature(settings = {}) {
  const source = settings && typeof settings === 'object' ? settings : {};
  const appearance = source.appearance && typeof source.appearance === 'object' ? source.appearance : {};
  const proxy = source.proxy && typeof source.proxy === 'object' ? source.proxy : {};
  const userDataPaths = source.userDataPaths && typeof source.userDataPaths === 'object' ? source.userDataPaths : {};
  return JSON.stringify({
    configPath: String(source.configPath || userDataPaths.configFile || '').trim(),
    panelChoice: String(source.panelChoice || source.externalUi || '').trim(),
    controller: String(source.externalController || '').trim(),
    secret: String(source.secret || '').trim(),
    authentication: Array.isArray(source.authentication) ? source.authentication.slice() : [],
    proxy: {
      mode: String(proxy.mode || '').trim(),
      systemProxy: Boolean(proxy.systemProxy),
      tun: Boolean(proxy.tun),
      stack: String(proxy.stack || '').trim(),
      mixedPort: String(proxy.mixedPort || '').trim(),
      port: String(proxy.port || '').trim(),
      socksPort: String(proxy.socksPort || '').trim(),
      allowLan: Boolean(proxy.allowLan),
    },
    trayMenu: {
      chartEnabled: source.chartEnabled !== false,
      providerTrafficEnabled: source.providerTrafficEnabled !== false,
      trackersEnabled: source.trackersEnabled !== false,
      foxboardEnabled: source.foxboardEnabled !== false,
      panelEnabled: source.panelEnabled === true,
      kernelManagerEnabled: source.kernelManagerEnabled !== false,
      directoryLocationsEnabled: source.directoryLocationsEnabled !== false,
      copyShellExportCommandEnabled: source.copyShellExportCommandEnabled !== false,
    },
    userDataPaths: {
      dataDir: String(userDataPaths.dataDir || '').trim(),
      userAppDataDir: String(userDataPaths.userAppDataDir || '').trim(),
    },
  });
}

async function getTrafficArgs() {
  if (!window.clashfox || typeof window.clashfox.readSettings !== 'function') {
    return [];
  }
  const now = Date.now();
  if (trafficState.settings && (now - trafficState.settingsAt) < SETTINGS_CACHE_MS) {
    return buildTrafficArgsFromSettings(trafficState.settings);
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
    trafficState.settings = settings;
    trafficState.settingsAt = now;
    return buildTrafficArgsFromSettings(settings);
  } catch {
    return [];
  }
}

async function getTrafficSocketUrl() {
  if (!window.clashfox || typeof window.clashfox.readSettings !== 'function') {
    return '';
  }
  const now = Date.now();
  if (trafficState.settings && (now - trafficState.settingsAt) < SETTINGS_CACHE_MS) {
    const cached = trafficState.settings;
    const controllerRaw = String(cached.externalController || '127.0.0.1:9090').trim() || '127.0.0.1:9090';
    const secret = String(cached.secret || 'clashfox').trim();
    const baseUrl = /^https?:\/\//i.test(controllerRaw) ? controllerRaw : `http://${controllerRaw}`;
    const url = new URL(baseUrl);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.pathname = '/traffic';
    if (secret) {
      url.searchParams.set('token', secret);
    } else {
      url.searchParams.delete('token');
    }
    return url.toString();
  }
  try {
    const response = await window.clashfox.readSettings();
    const settings = response && response.ok ? response.data : null;
    if (!settings || typeof settings !== 'object') {
      return '';
    }
    trafficState.settings = settings;
    trafficState.settingsAt = now;
    const controllerRaw = String(settings.externalController || '127.0.0.1:9090').trim() || '127.0.0.1:9090';
    const secret = String(settings.secret || 'clashfox').trim();
    const baseUrl = /^https?:\/\//i.test(controllerRaw) ? controllerRaw : `http://${controllerRaw}`;
    const url = new URL(baseUrl);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.pathname = '/traffic';
    if (secret) {
      url.searchParams.set('token', secret);
    } else {
      url.searchParams.delete('token');
    }
    return url.toString();
  } catch {
    return '';
  }
}

function shouldUseTrafficFallback() {
  return !trafficState.socketLive;
}

function updateProxyTrafficSnapshot(downRate, upRate, downTotal, upTotal) {
  const down = Number.parseFloat(downRate);
  const up = Number.parseFloat(upRate);
  const rxTotal = Number.parseFloat(downTotal);
  const txTotal = Number.parseFloat(upTotal);
  if (!Number.isFinite(down) || !Number.isFinite(up) || down < 0 || up < 0) {
    return;
  }
  trafficState.lastTrafficAt = Date.now();
  trafficState.lastRateRx = down;
  trafficState.lastRateTx = up;
  if (Number.isFinite(rxTotal) && rxTotal >= 0) {
    trafficState.lastTotalRx = rxTotal;
  }
  if (Number.isFinite(txTotal) && txTotal >= 0) {
    trafficState.lastTotalTx = txTotal;
  }
  setOverlayLabels();
  updateTrafficHistory(down, up);
  persistTrafficCache();
}

function handleTrafficSocketPayload(payload = {}) {
  trafficState.socketLive = true;
  trafficState.reconnectAttempts = 0;
  updateProxyTrafficSnapshot(payload.down, payload.up, payload.downTotal, payload.upTotal);
}

async function openTrafficSocket() {
  if (!trayMenuRendererVisible || !trafficState.chartEnabled || typeof WebSocket !== 'function') {
    return;
  }
  const nextUrl = await getTrafficSocketUrl();
  if (!nextUrl) {
    closeTrafficSocket();
    return;
  }
  const existing = trafficState.socket;
  if (
    existing
    && trafficState.socketUrl === nextUrl
    && (
      existing.readyState === WebSocket.OPEN
      || existing.readyState === WebSocket.CONNECTING
    )
  ) {
    return;
  }
  closeTrafficSocket();
  let socket = null;
  try {
    socket = new WebSocket(nextUrl);
  } catch {
    trafficState.socketLive = false;
    trafficState.reconnectAttempts += 1;
    scheduleTrafficReconnect();
    return;
  }
  trafficState.socket = socket;
  trafficState.socketUrl = nextUrl;
  socket.onopen = () => {
    trafficState.reconnectAttempts = 0;
  };
  socket.onmessage = (event) => {
    try {
      const payload = JSON.parse(String(event && event.data ? event.data : '{}'));
      handleTrafficSocketPayload(payload);
    } catch {
      // ignore malformed websocket frames
    }
  };
  socket.onerror = () => {
    trafficState.socketLive = false;
  };
  socket.onclose = () => {
    const currentSocket = trafficState.socket;
    if (currentSocket !== socket) {
      return;
    }
    trafficState.socket = null;
    trafficState.socketUrl = '';
    trafficState.socketLive = false;
    trafficState.reconnectAttempts += 1;
    scheduleTrafficReconnect();
  };
}

async function loadTrafficSnapshot() {
  if (!trayMenuRendererVisible || !shouldUseTrafficFallback()) {
    return;
  }
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
  if (!trayMenuRendererVisible || !shouldUseTrafficFallback()) {
    return;
  }
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
  if (!trayMenuRendererVisible) {
    return;
  }
  if (trafficState.trafficTimer || trafficState.overviewTimer) {
    openTrafficSocket().catch(() => {});
    return;
  }
  await getTrafficArgs();
  if (!trafficState.chartEnabled) {
    return;
  }
  syncTrafficChartVisibility();
  openTrafficSocket().catch(() => {});
  loadTrafficSnapshot();
  loadOverviewSnapshot();
  trafficState.trafficTimer = setInterval(loadTrafficSnapshot, TRAFFIC_INTERVAL_MS);
  trafficState.overviewTimer = setInterval(loadOverviewSnapshot, OVERVIEW_INTERVAL_MS);
}

function stopTrafficTimers() {
  closeTrafficSocket();
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
  if (window.clashfox && typeof window.clashfox.trayMenuClosePanel === 'function') {
    window.clashfox.trayMenuClosePanel();
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

function buildOutboundProxyTreeItems(payload = null) {
  const providers = payload && Array.isArray(payload.providers) ? payload.providers : [];
  if (!providers.length) {
    return [];
  }
  const items = [{ type: 'separator' }];
  providers.forEach((provider) => {
    items.push({
      type: 'provider-link',
      label: provider.name || '-',
      subtitle: provider.subtitle || '',
      iconUrl: provider.iconUrl || '',
      iconKey: provider.iconKey || 'outboundMode',
      status: provider.currentStatus || 'unknown',
      currentProxy: provider.currentProxy || '',
      chart: Array.isArray(provider.chart) ? provider.chart : [],
      submenu: provider.submenuKey || '',
      rightText: provider.currentProxy || '-',
      chartMode: provider.chartMode || 'segmented',
      enabled: true,
    });
  });
  return items;
}

function buildProviderLinkLeading(item) {
  const iconKey = 'proxyGroup';
  const leading = document.createElement('div');
  leading.className = 'menu-leading';
  const iconUrl = String(item && item.iconUrl ? item.iconUrl : '').trim();
  const fallbackMarkup = ICON_SVGS[iconKey] || ICON_SVGS.proxyGroup || '';
  if (iconUrl) {
    leading.innerHTML = fallbackMarkup;
    const img = document.createElement('img');
    img.className = 'menu-provider-link-icon';
    img.alt = '';
    img.referrerPolicy = 'no-referrer';
    img.style.display = 'none';
    img.src = iconUrl;
    const applyFallback = () => {
      leading.innerHTML = fallbackMarkup;
    };
    img.addEventListener('error', applyFallback, { once: true });
    img.addEventListener('load', () => {
      img.style.display = 'block';
      leading.innerHTML = '';
      leading.appendChild(img);
    }, { once: true });
    return leading;
  }
  leading.innerHTML = fallbackMarkup;
  return leading;
}

function makeRow(item) {
  if (item.type === 'section') {
    const row = document.createElement('div');
    row.className = 'menu-row-section';
    row.textContent = item.label || '';
    bindHoverSubmenuClose(row);
    return row;
  }

  if (item.type === 'provider-link') {
    const row = document.createElement('div');
    row.className = 'menu-row clickable menu-row-provider-link';
    row.classList.add(`status-${String(item.status || 'unknown')}`);
    if (item.submenu) {
      row.dataset.submenuKey = String(item.submenu);
    }
    row.dataset.iconKey = String(item.iconKey || 'outboundMode');
    row.appendChild(buildProviderLinkLeading(item));
    const content = document.createElement('div');
    content.className = 'menu-provider-link-content';
    const head = document.createElement('div');
    head.className = 'menu-provider-link-head';
    const title = document.createElement('div');
    title.className = 'menu-provider-link-title';
    title.textContent = item.label || '';
    head.appendChild(title);
    if (item.rightText) {
      const right = document.createElement('div');
      right.className = 'menu-right';
      right.textContent = String(item.rightText || '');
      head.appendChild(right);
    }
    content.appendChild(head);
    if (item.subtitle) {
      const subtitle = document.createElement('div');
      subtitle.className = 'menu-provider-link-subtitle';
      subtitle.textContent = String(item.subtitle || '');
      content.appendChild(subtitle);
    }
    if (Array.isArray(item.chart) && item.chart.length) {
      const chart = document.createElement('div');
      chart.className = 'menu-provider-link-chart';
      chart.dataset.chartMode = String(item.chartMode || 'segmented');
      item.chart.forEach((segment) => {
        const bar = document.createElement('span');
        bar.className = `menu-provider-link-bar is-${String(segment && segment.status ? segment.status : 'unknown')}`;
        chart.appendChild(bar);
      });
      content.appendChild(chart);
    }
    row.appendChild(content);
    const arrow = document.createElement('div');
    arrow.className = 'menu-arrow';
    arrow.textContent = '›';
    row.appendChild(arrow);
    if (item.submenu) {
      bindHoverSubmenuOpen(row, item.submenu);
    } else {
      bindHoverSubmenuClose(row);
    }
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
    bindHoverSubmenuOpen(row, item.submenu);
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

  bindHoverSubmenuClose(row);
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

function renderHeader(force = false) {
  if (!menuData || !menuData.header) {
    if (headerEl.innerHTML) {
      headerEl.innerHTML = '';
      lastHeaderRenderSignature = '';
    }
    return;
  }
  const nextSignature = buildHeaderRenderSignature(menuData);
  if (!force && nextSignature === lastHeaderRenderSignature) {
    return;
  }
  lastHeaderRenderSignature = nextSignature;
  const title = menuData.header.title || 'ClashFox';
  const rawStatus = String(menuData.header.status || '');
  let statusState = String(menuData.header.statusState || '').trim().toLowerCase();
  if (statusState === 'neutral') {
    statusState = 'unknown';
  }
  if (!statusState) {
    if (/running/i.test(rawStatus) || rawStatus.includes('🟢')) {
      statusState = 'running';
    } else if (/stopp?ed/i.test(rawStatus) || rawStatus.includes('⚪') || rawStatus.includes('🔴')) {
      statusState = 'stopped';
    } else {
      statusState = 'unknown';
    }
  }
  if (statusState !== 'running' && statusState !== 'stopped' && statusState !== 'unknown') {
    statusState = 'unknown';
  }
  const status = rawStatus.replace(/^[🟢⚪🔴]\s*/u, '') || '-';
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

function renderMainList(force = false) {
  const items = Array.isArray(menuData && menuData.items) ? menuData.items : [];
  const nextSignature = buildMainListRenderSignature(menuData);
  if (!force && nextSignature === lastMainListRenderSignature) {
    return;
  }
  lastMainListRenderSignature = nextSignature;
  listEl.innerHTML = '';
  for (const item of items) {
    listEl.appendChild(makeRow(item));
    if (item && item.submenu === 'outbound') {
      const extraItems = buildOutboundProxyTreeItems(menuData && menuData.outboundProxyTree ? menuData.outboundProxyTree : null);
      if (extraItems.length) {
        extraItems.forEach((extraItem) => {
          listEl.appendChild(makeRow(extraItem));
        });
      }
    }
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

function shouldRestoreSubmenu(anchorRow) {
  return Boolean(
    document.hasFocus()
    && anchorRow
    && anchorRow.isConnected
    && typeof anchorRow.matches === 'function'
    && anchorRow.matches(':hover')
  );
}

function bindHoverSubmenuOpen(row, submenuKey) {
  if (!row || !submenuKey) {
    return;
  }
  const open = () => openSubmenu(submenuKey, row);
  row.addEventListener('pointerenter', open);
  row.addEventListener('mouseenter', open);
}

function bindHoverSubmenuClose(row) {
  if (!row) {
    return;
  }
  const close = () => {
    if (activeSubmenuKey) {
      hideSubmenu();
    }
  };
  row.addEventListener('pointerenter', close);
  row.addEventListener('mouseenter', close);
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
  if (
    activeSubmenuKey === submenuKey
    && activeSubmenuAnchor
    && resolvedAnchor
    && activeSubmenuAnchor === resolvedAnchor
  ) {
    return;
  }
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
    meta: (menuData && menuData.submenuMeta && menuData.submenuMeta[submenuKey] && typeof menuData.submenuMeta[submenuKey] === 'object')
      ? menuData.submenuMeta[submenuKey]
      : {},
    anchorTop: Math.max(0, Math.round(anchorTop)),
    anchorHeight: Math.max(0, Math.round(anchorHeight)),
    rootHeight: Math.max(0, Math.round(rootRect.height || 0)),
  };
  if (submenuKey === 'panel') {
    if (window.clashfox && typeof window.clashfox.trayMenuCloseSubmenu === 'function') {
      window.clashfox.trayMenuCloseSubmenu();
    }
    if (window.clashfox && typeof window.clashfox.trayMenuOpenPanel === 'function') {
      window.clashfox.trayMenuOpenPanel(payload);
    }
    return;
  }
  if (window.clashfox && typeof window.clashfox.trayMenuOpenSubmenu === 'function') {
    window.clashfox.trayMenuOpenSubmenu(payload);
  }
}

function renderAll(force = false) {
  renderHeader(force);
  renderProviderTraffic(force);
  renderMainList(force);
  hideSubmenu();
  scheduleGeometrySync();
  scheduleTrayMenuPaintReady();
}

async function init() {
  await applyTrayTheme();
  ensureMenuAutoResize();
  if (window.clashfox && typeof window.clashfox.onTrayMenuVisibility === 'function') {
    window.clashfox.onTrayMenuVisibility((payload = {}) => {
      setTrayMenuRendererVisible(Boolean(payload && payload.visible));
      if (trayMenuRendererVisible && menuData) {
        if (chartEl && !trafficState.trafficTimer && !trafficState.overviewTimer) {
          startTrafficTimers();
        }
      }
    });
  }
  if (window.clashfox && typeof window.clashfox.onTrayMenuUpdate === 'function') {
    window.clashfox.onTrayMenuUpdate((payload) => {
      if (!payload) {
        return;
      }
      if (!trayMenuRendererVisible) {
        menuData = payload;
        lastMenuRenderSignature = buildMenuRenderSignature(payload);
        return;
      }
      applyTrayTheme().catch(() => {});
      const nextSignature = buildMenuRenderSignature(payload);
      if (nextSignature === lastMenuRenderSignature) {
        return;
      }
      menuVersion += 1;
      const keepSubmenuKey = activeSubmenuKey;
      const keepSubmenuAnchorKey = activeSubmenuAnchor
        && activeSubmenuAnchor.dataset
        && activeSubmenuAnchor.dataset.submenuKey
        ? activeSubmenuAnchor.dataset.submenuKey
        : keepSubmenuKey;
      const prevSubmenuSignature = keepSubmenuKey
        && menuData
        && menuData.submenus
        && Array.isArray(menuData.submenus[keepSubmenuKey])
        ? buildMenuRenderSignature(menuData.submenus[keepSubmenuKey])
        : '';
      const nextSubmenuSignature = keepSubmenuKey
        && payload
        && payload.submenus
        && Array.isArray(payload.submenus[keepSubmenuKey])
        ? buildMenuRenderSignature(payload.submenus[keepSubmenuKey])
        : '';
      const prevSubmenuStableSignature = keepSubmenuKey
        && menuData
        && menuData.submenus
        && Array.isArray(menuData.submenus[keepSubmenuKey])
        ? buildSubmenuRenderSignature(keepSubmenuKey, menuData.submenus[keepSubmenuKey])
        : '';
      const nextSubmenuStableSignature = keepSubmenuKey
        && payload
        && payload.submenus
        && Array.isArray(payload.submenus[keepSubmenuKey])
        ? buildSubmenuRenderSignature(keepSubmenuKey, payload.submenus[keepSubmenuKey])
        : '';
      menuData = payload;
      lastMenuRenderSignature = nextSignature;
      renderHeader();
      renderProviderTraffic();
      renderMainList();
      if (chartEl && chartBarsEl && !chartBarsEl.hasChildNodes()) {
        if (!restoreTrafficCache()) {
          resetTrafficChart();
        }
      }
      if (keepSubmenuKey && keepSubmenuAnchorKey) {
        const nextAnchor = findMainAnchorBySubmenuKey(keepSubmenuAnchorKey);
        if (nextAnchor) {
          activeSubmenuKey = keepSubmenuKey;
          activeSubmenuAnchor = nextAnchor;
          nextAnchor.classList.add('expanded');
          if (keepSubmenuKey === 'panel') {
            syncWindowGeometry();
            return;
          }
          if (
            prevSubmenuSignature === nextSubmenuSignature
            || prevSubmenuStableSignature === nextSubmenuStableSignature
          ) {
            syncWindowGeometry();
            return;
          }
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
      const nextSignature = buildMenuRenderSignature(initial);
      menuData = initial;
      lastMenuRenderSignature = nextSignature;
      if (trayMenuRendererVisible) {
        renderAll(true);
        if (chartEl) {
          if (!restoreTrafficCache()) {
            resetTrafficChart();
          }
        }
      }
    }
  } catch {
    // ignore
  }

  headerEl.addEventListener('mouseenter', hideSubmenu);
  if (window.clashfox && typeof window.clashfox.onSystemThemeChange === 'function') {
    window.clashfox.onSystemThemeChange((payload = {}) => {
      if (payload && typeof payload.dark === 'boolean') {
        systemThemeIsDark = payload.dark;
      }
      applyTrayTheme().catch(() => {});
    });
  }
  if (window.clashfox && typeof window.clashfox.onSettingsUpdated === 'function') {
    window.clashfox.onSettingsUpdated(async (settings = {}) => {
      const appearance = settings && typeof settings.appearance === 'object' ? settings.appearance : {};
      const nextSignature = JSON.stringify({
        theme: String(settings.theme || appearance.theme || 'auto').trim().toLowerCase(),
        lang: String(settings.lang || settings.language || settings.locale || appearance.lang || appearance.language || appearance.locale || 'auto').trim().toLowerCase(),
        foxRankSkin: String(settings.foxRankSkin || appearance.foxRankSkin || '').trim().toLowerCase(),
        chartEnabled: Object.prototype.hasOwnProperty.call(settings || {}, 'chartEnabled')
          ? Boolean(settings.chartEnabled)
          : Object.prototype.hasOwnProperty.call(settings || {}, 'trayMenuChartEnabled')
            ? Boolean(settings.trayMenuChartEnabled)
            : true,
        providerTrafficEnabled: Object.prototype.hasOwnProperty.call(settings || {}, 'providerTrafficEnabled')
          ? Boolean(settings.providerTrafficEnabled)
          : true,
        panelEnabled: Object.prototype.hasOwnProperty.call(settings || {}, 'panelEnabled')
          ? Boolean(settings.panelEnabled)
          : false,
        trackersEnabled: Object.prototype.hasOwnProperty.call(settings || {}, 'trackersEnabled')
          ? Boolean(settings.trackersEnabled)
          : true,
        foxboardEnabled: Object.prototype.hasOwnProperty.call(settings || {}, 'foxboardEnabled')
          ? Boolean(settings.foxboardEnabled)
          : true,
        kernelManagerEnabled: Object.prototype.hasOwnProperty.call(settings || {}, 'kernelManagerEnabled')
          ? Boolean(settings.kernelManagerEnabled)
          : true,
        directoryLocationsEnabled: Object.prototype.hasOwnProperty.call(settings || {}, 'directoryLocationsEnabled')
          ? Boolean(settings.directoryLocationsEnabled)
          : true,
        copyShellExportCommandEnabled: Object.prototype.hasOwnProperty.call(settings || {}, 'copyShellExportCommandEnabled')
          ? Boolean(settings.copyShellExportCommandEnabled)
          : true,
      });
      if (nextSignature === lastSettingsSignature) {
        return;
      }
      lastSettingsSignature = nextSignature;
      const nextMenuSettingsSignature = buildTrayMenuSettingsSignature(settings);
      const shouldRefreshMenuData = nextMenuSettingsSignature !== lastMenuDataSettingsSignature;
      lastMenuDataSettingsSignature = nextMenuSettingsSignature;
      invalidateSettingsCache();
      if (!trayMenuRendererVisible) {
        return;
      }
      const chartEnabled = Object.prototype.hasOwnProperty.call(settings || {}, 'chartEnabled')
        ? settings.chartEnabled !== false
        : (Object.prototype.hasOwnProperty.call(settings || {}, 'trayMenuChartEnabled')
          ? settings.trayMenuChartEnabled !== false
          : true);
      applyChartEnabled(
        chartEnabled,
      );
      applyTrayTheme(settings).catch(() => {});
      if (shouldRefreshMenuData) {
        scheduleTrayMenuSettingsRefresh();
      }
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

window.addEventListener('blur', () => {
  // Keep submenu hover responsive; main process handles actual window closing.
});

window.addEventListener('beforeunload', () => {
  stopTrafficTimers();
  stopTrayMenuSettingsRefresh();
  persistTrafficCache();
});

init();
