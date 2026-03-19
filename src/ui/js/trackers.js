import TRACKERS_I18N from '../locales/trackers-i18n.js';

const trackersLocaleUtils = globalThis.CLASHFOX_LOCALE_UTILS || {};
const detectSystemLocale = typeof trackersLocaleUtils.detectSystemLocale === 'function'
  ? trackersLocaleUtils.detectSystemLocale
  : (() => 'en');
const normalizeLocaleCode = typeof trackersLocaleUtils.normalizeLocaleCode === 'function'
  ? trackersLocaleUtils.normalizeLocaleCode
  : (value => String(value || 'en').trim().toLowerCase() || 'en');
let map = null;
let localMarker = null;
let localMarkerLayer = null; // 根节点独立图层
let pointsLayer = null; // 远程端点图层
let linksLayer = null;
let flowLayer = null;
let pollTimer = null;
let polling = false;
let lastCenterKey = '';
let pendingSnapshot = null;
let renderQueued = false;
let snapshotState = null;
let tileLayer = null;
let tileErrorCount = 0;
let activeProviderIndex = 0;
let hasAnyTileLoaded = false;
let allProvidersFailed = false;
let flowParticles = [];
let currentFlowParticles = new Map(); // key: fromLat,fromLon-toLat,toLon-index -> flowParticle
let flowAnimationFrame = 0;
let flowLastFrameAt = 0;
let languagePreference = 'auto';
let activeLanguage = 'en';
let systemLocaleFromMain = '';
let themePreference = 'auto';
let lastSystemDark = window.matchMedia
  ? window.matchMedia('(prefers-color-scheme: dark)').matches
  : true;
let lastAppliedTheme = null;
let lastStatsText = '';
let lastStatsMode = '';
let lastStatsParts = { endpoints: null, connections: null, provider: null };
let statsFailureCount = 0;
let pinnedPointKey = '';
let pinnedPoint = null;

// 存储当前渲染的节点和连线，用于差异更新
let currentPoints = [];
let currentLinks = [];
let currentMarkers = new Map(); // key: lat,lon -> marker
let currentPolylines = new Map(); // key: fromLat,fromLon-toLat,toLon -> polyline
let currentLabels = new Map(); // key: labelKey -> label marker

const statsEl = document.getElementById('worldwideStats');
const detailBodyEl = document.getElementById('worldwideDetailBody');
const emptyEl = document.getElementById('worldwideEmpty');
const filterOutboundEl = document.getElementById('filterOutbound');
const filterCountryEl = document.getElementById('filterCountry');
const filterCityEl = document.getElementById('filterCity');

const POLL_INTERVAL_MS = 2400;
const RENDER_MAX_POINTS = 70;
const RENDER_LABEL_MAX = 28;
const FLOW_MAX_PARTICLES = 54;
const canvasRenderer = typeof L !== 'undefined' ? L.canvas({ padding: 0.2 }) : null;
const TILE_ERROR_SWITCH_THRESHOLD = 6;
const TILE_PROVIDERS = [
  {
    name: 'Carto Voyager',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    urlDark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    options: {
      maxZoom: 10,
      minZoom: 2,
      subdomains: 'abcd',
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    },
  },
  {
    name: 'OpenStreetMap',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    options: {
      maxZoom: 10,
      minZoom: 2,
      subdomains: 'abc',
      attribution: '&copy; OpenStreetMap contributors',
    },
  },
  {
    name: 'OpenStreetMap HOT',
    url: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
    options: {
      maxZoom: 10,
      subdomains: 'abc',
      attribution: '&copy; OpenStreetMap contributors',
    },
  },
  {
    name: 'Esri World Street',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    options: {
      maxZoom: 10,
      attribution: 'Tiles &copy; Esri',
    },
  },
  {
    name: 'OpenTopoMap',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    options: {
      maxZoom: 10,
      subdomains: 'abc',
      attribution: '&copy; OpenStreetMap contributors',
    },
  },
  {
    name: 'OpenStreetMap (HTTP)',
    url: 'http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    options: {
      maxZoom: 10,
      subdomains: 'abc',
      attribution: '&copy; OpenStreetMap contributors',
    },
  },
  {
    name: 'AutoNavi Road',
    url: 'https://webrd0{s}.is.autonavi.com/appmaptile?lang=en&size=1&scale=1&style=8&x={x}&y={y}&z={z}',
    options: {
      maxZoom: 10,
      minZoom: 2,
      subdomains: '1234',
      attribution: 'Map data &copy; AutoNavi',
    },
  },
];

function resolveThemePreference(settings = {}) {
  const appearance = settings && typeof settings.appearance === 'object' ? settings.appearance : {};
  return String(
    settings.theme
    || settings.appearance?.theme
    || appearance.colorMode
    || 'auto',
  ).trim().toLowerCase() || 'auto';
}

function getI18nValue(path, fallback = '') {
  const dictionaries = TRACKERS_I18N;
  const current = dictionaries[activeLanguage] || dictionaries.en || {};
  const parts = String(path || '').split('.');
  let value = current;
  for (const part of parts) {
    if (!value || typeof value !== 'object') {
      return fallback;
    }
    value = value[part];
  }
  if (typeof value === 'string' && value.trim() !== '') {
    return value;
  }
  return fallback;
}

function formatI18n(template, vars = {}) {
  return String(template || '').replace(/\{(\w+)\}/g, (_m, key) => {
    const value = vars[key];
    return value === undefined || value === null ? '' : String(value);
  });
}

function applyI18nText() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = String(el.dataset.i18n || '').trim();
    if (!key) return;
    const translated = getI18nValue(key, el.textContent || '');
    el.textContent = translated;
  });
}

function refreshLocalizedUi() {
  applyI18nText();
  document.title = `ClashFox | ${getI18nValue('worldwide.title', 'Track the Trackers')}`;
  lastStatsMode = '';
  lastStatsParts = { endpoints: null, connections: null, provider: null };
  statsFailureCount = 0;
  if (snapshotState) {
    scheduleRender(snapshotState);
    return;
  }
  setDetail(null);
  setStats(getI18nValue('worldwide.loading', 'Loading...'));
}

function resolveThemeMode(preference) {
  if (preference === 'day' || preference === 'night') {
    return preference;
  }
  return lastSystemDark ? 'night' : 'day';
}

function applyThemeMode(preference) {
  const theme = resolveThemeMode(preference);
  document.documentElement.setAttribute('data-theme', theme);
  if (document.body) {
    document.body.dataset.theme = theme;
  }
  lastAppliedTheme = theme;
  try {
    localStorage.setItem('lastTheme', theme);
  } catch {
    // ignore storage failures
  }
  return theme;
}

async function refreshSystemLocaleFromMain() {
  if (!window.clashfox || typeof window.clashfox.getSystemLocale !== 'function') {
    return false;
  }
  try {
    const response = await window.clashfox.getSystemLocale();
    if (!response || !response.ok) {
      return false;
    }
    const locale = String(response.locale || '').trim();
    if (!locale) {
      return false;
    }
    const changed = locale !== systemLocaleFromMain;
    systemLocaleFromMain = locale;
    return changed;
  } catch {
    return false;
  }
}

function readLanguagePreferenceFromSettings(settings = {}) {
  const appearance = settings && typeof settings.appearance === 'object' ? settings.appearance : {};
  const raw = String(
    settings.lang
    || settings.language
    || settings.locale
    || appearance.lang
    || appearance.language
    || appearance.locale
    || 'auto',
  ).trim().toLowerCase();
  return raw || 'auto';
}

function syncLanguageFromPreference() {
  activeLanguage = languagePreference === 'auto'
    ? detectSystemLocale(systemLocaleFromMain || '')
    : normalizeLocaleCode(languagePreference);
  document.documentElement.setAttribute('lang', activeLanguage);
  refreshLocalizedUi();
}

async function syncPreferencesFromSettings() {
  await refreshSystemLocaleFromMain();
  if (!window.clashfox || typeof window.clashfox.readSettings !== 'function') {
    syncLanguageFromPreference();
    applyThemeMode(themePreference);
    return;
  }
  try {
    const response = await window.clashfox.readSettings();
    const settings = response && response.ok && response.data && typeof response.data === 'object'
      ? response.data
      : {};
    if (settings && Object.keys(settings).length) {
      languagePreference = readLanguagePreferenceFromSettings(settings);
      themePreference = resolveThemePreference(settings);
    }
  } catch {
    languagePreference = 'auto';
    themePreference = 'auto';
  }
  syncLanguageFromPreference();
  applyThemeMode(themePreference);
}

function applySettingsPayload(settings = {}) {
  languagePreference = readLanguagePreferenceFromSettings(settings);
  themePreference = resolveThemePreference(settings);
  const applyNow = () => {
    syncLanguageFromPreference();
    applyThemeMode(themePreference);
  };
  if (languagePreference === 'auto') {
    refreshSystemLocaleFromMain().finally(applyNow);
    return;
  }
  applyNow();
}

function setStats(text) {
  if (!statsEl) {
    return;
  }
  const next = String(text || '');
  if (next === lastStatsText) {
    return;
  }
  lastStatsText = next;
  statsEl.textContent = next;
}

function setStatsStructured({ mode, endpoints, connections, provider }) {
  if (!statsEl) {
    return;
  }
  const nextMode = mode === 'unavailable' ? 'unavailable' : 'live';
  const rebuild = nextMode !== lastStatsMode || !statsEl.querySelector('[data-stats-root="true"]');
  if (rebuild) {
    const template = nextMode === 'unavailable'
      ? getI18nValue('worldwide.stats.liveUnavailable', 'Live {endpoints} endpoints · {connections} active connections · map unavailable')
      : getI18nValue('worldwide.stats.live', 'Live {endpoints} endpoints · {connections} active connections · map: {provider}');
    const html = template
      .replace('{endpoints}', '<strong data-stats="endpoints"></strong>')
      .replace('{connections}', '<strong data-stats="connections"></strong>')
      .replace('{provider}', '<strong data-stats="provider"></strong>');
    statsEl.innerHTML = `<span data-stats-root="true">${html}</span>`;
    lastStatsMode = nextMode;
    lastStatsText = '';
    lastStatsParts = { endpoints: null, connections: null, provider: null };
  }
  const endpointsText = String(Number(endpoints || 0));
  const connectionsText = String(Number(connections || 0));
  const providerText = nextMode === 'unavailable' ? '' : String(provider || '');

  if (lastStatsParts.endpoints !== endpointsText) {
    const node = statsEl.querySelector('[data-stats="endpoints"]');
    if (node) node.textContent = endpointsText;
    lastStatsParts.endpoints = endpointsText;
  }
  if (lastStatsParts.connections !== connectionsText) {
    const node = statsEl.querySelector('[data-stats="connections"]');
    if (node) node.textContent = connectionsText;
    lastStatsParts.connections = connectionsText;
  }
  if (nextMode === 'live' && lastStatsParts.provider !== providerText) {
    const node = statsEl.querySelector('[data-stats="provider"]');
    if (node) node.textContent = providerText;
    lastStatsParts.provider = providerText;
  }
  statsFailureCount = 0;
}

function setStatsError(text) {
  if (!statsEl) {
    return;
  }
  statsFailureCount += 1;
  if (lastStatsMode === 'live' || lastStatsMode === 'unavailable') {
    if (statsFailureCount < 2) {
      return;
    }
  }
  lastStatsMode = 'error';
  lastStatsParts = { endpoints: null, connections: null, provider: null };
  setStats(text);
}

function setDetail(point = null) {
  if (!detailBodyEl) {
    return;
  }
  if (!point) {
    detailBodyEl.textContent = getI18nValue('worldwide.hoverDetail', 'Hover a node to view details.');
    return;
  }
  const location = [point.city, point.country].filter(Boolean).join(', ') || point.ipSamples?.[0] || '-';
  const outbounds = Array.isArray(point.outbounds) && point.outbounds.length ? point.outbounds.join(', ') : '-';
  const hosts = Array.isArray(point.hostSamples) && point.hostSamples.length ? point.hostSamples.join(', ') : '-';
  detailBodyEl.textContent = `${location} | ${getI18nValue('worldwide.labels.connections', 'conns')}: ${Number(point.count || 0)} | ${getI18nValue('worldwide.labels.outbound', 'outbound')}: ${outbounds} | ${getI18nValue('worldwide.labels.host', 'host')}: ${hosts}`;
}

function pinDetail(pointKey, point) {
  pinnedPointKey = pointKey;
  pinnedPoint = point || null;
  if (pinnedPoint) {
    setDetail(pinnedPoint);
  } else {
    setDetail(null);
  }
}

function localLabel(local) {
  const yourMac = getI18nValue('worldwide.yourMac', 'Your Mac');
  if (!local) return yourMac;
  const city = String(local.city || '').trim();
  const country = String(local.country || '').trim();
  if (city && country) return `${yourMac} (${city}, ${country})`;
  if (country) return `${yourMac} (${country})`;
  return yourMac;
}

function pointLabel(point) {
  const city = String(point.city || '').trim();
  const country = String(point.country || '').trim();
  if (city && country) return `${city}, ${country}`;
  if (city) return city;
  if (country) return country;
  const sampleIp = Array.isArray(point.ipSamples) ? point.ipSamples[0] : '';
  const sampleHost = Array.isArray(point.hostSamples) ? point.hostSamples[0] : '';
  return sampleIp || sampleHost || getI18nValue('worldwide.unknown', 'Unknown');
}

function providerName() {
  return TILE_PROVIDERS[activeProviderIndex] ? TILE_PROVIDERS[activeProviderIndex].name : 'Unknown';
}

function buildLocalComputerIcon() {
  const icon = L.divIcon({
    className: 'world-local-computer-icon',
    html: '<span class="world-local-computer-core" aria-hidden="true"><svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><rect x="5.5" y="5.5" width="13" height="9" rx="1.8"></rect><path d="M9.4 17.3h5.2"></path><path d="M11 14.8v2.5"></path></svg></span>',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
  return icon;
}

function normalizeLongitude(lon) {
  let value = Number(lon || 0);
  while (value > 180) value -= 360;
  while (value < -180) value += 360;
  return value;
}

function stopFlowAnimation() {
  if (flowAnimationFrame) {
    window.cancelAnimationFrame(flowAnimationFrame);
    flowAnimationFrame = 0;
  }
  flowLastFrameAt = 0;
}

function clearFlowParticles() {
  stopFlowAnimation();
  flowParticles = [];
  if (flowLayer) {
    flowLayer.clearLayers();
  }
}

function startFlowAnimation() {
  if (flowAnimationFrame || !flowParticles.length || document.hidden) {
    return;
  }
  const tick = (ts) => {
    if (!flowParticles.length || document.hidden) {
      stopFlowAnimation();
      return;
    }
    const now = Number(ts || 0);
    const elapsed = flowLastFrameAt > 0 ? Math.max(0, now - flowLastFrameAt) : 16;
    flowLastFrameAt = now;
    const delta = Math.min(elapsed, 80) / 1000;
    flowParticles.forEach((particle) => {
      const marker = particle.marker;
      if (!marker) {
        return;
      }
      particle.progress += delta * particle.speed;
      while (particle.progress >= 2) {
        particle.progress -= 2;
      }
      const progress = particle.progress <= 1 ? particle.progress : (2 - particle.progress);
      const lat = particle.from[0] + ((particle.to[0] - particle.from[0]) * progress);
      const lon = particle.from[1] + ((particle.to[1] - particle.from[1]) * progress);
      marker.setLatLng([lat, lon]);
    });
    flowAnimationFrame = window.requestAnimationFrame(tick);
  };
  flowAnimationFrame = window.requestAnimationFrame(tick);
}

function buildArcPoints(from = [0, 0], to = [0, 0], steps = 30) {
  const fromLat = Number(from[0] || 0);
  const fromLon = normalizeLongitude(from[1]);
  const toLat = Number(to[0] || 0);
  let toLon = normalizeLongitude(to[1]);
  let deltaLon = toLon - fromLon;
  if (deltaLon > 180) deltaLon -= 360;
  if (deltaLon < -180) deltaLon += 360;
  toLon = fromLon + deltaLon;

  const midLat = (fromLat + toLat) / 2;
  const midLon = (fromLon + toLon) / 2;
  const dx = deltaLon * Math.cos((midLat * Math.PI) / 180);
  const dy = toLat - fromLat;
  const distance = Math.hypot(dx, dy);
  if (!Number.isFinite(distance) || distance < 0.001) {
    return [[fromLat, fromLon], [toLat, normalizeLongitude(toLon)]];
  }
  const normalX = -dy / distance;
  const normalY = dx / distance;
  const hashSeed = Math.round((fromLat + fromLon + toLat + toLon) * 1000);
  const sign = hashSeed % 2 === 0 ? 1 : -1;
  const curveStrength = Math.max(2.8, Math.min(18, distance * 0.34)) * sign;
  const controlLon = midLon + (normalX * curveStrength);
  const controlLat = midLat + (normalY * curveStrength);

  const points = [];
  const count = Math.max(8, Math.min(steps, 44));
  for (let i = 0; i <= count; i += 1) {
    const t = i / count;
    const oneMinus = 1 - t;
    const lat = (oneMinus * oneMinus * fromLat) + (2 * oneMinus * t * controlLat) + (t * t * toLat);
    const lon = (oneMinus * oneMinus * fromLon) + (2 * oneMinus * t * controlLon) + (t * t * toLon);
    points.push([lat, normalizeLongitude(lon)]);
  }
  return points;
}

function pickArcLabelPosition(arcPoints = []) {
  if (!Array.isArray(arcPoints) || arcPoints.length < 3) {
    return null;
  }
  const idx = Math.max(1, Math.floor(arcPoints.length * 0.62));
  const item = arcPoints[Math.min(idx, arcPoints.length - 2)];
  if (!item) {
    return null;
  }
  const lat = Number(item[0]);
  const lon = Number(item[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null;
  }
  return [lat, lon];
}

function applyTileAvailabilityClass(unavailable) {
  const mapEl = document.getElementById('worldwideMap');
  if (!mapEl) {
    return;
  }
  mapEl.classList.toggle('tiles-unavailable', Boolean(unavailable));
}

function switchToProvider(nextIndex) {
  if (!map || !Number.isFinite(nextIndex) || nextIndex < 0 || nextIndex >= TILE_PROVIDERS.length) {
    return false;
  }
  activeProviderIndex = nextIndex;
  tileErrorCount = 0;
  const provider = TILE_PROVIDERS[activeProviderIndex];
  if (!provider) {
    return false;
  }
  if (tileLayer) {
    map.removeLayer(tileLayer);
    tileLayer = null;
  }

  // 根据当前主题选择合适的瓦片 URL（深色或浅色）
  const currentTheme = resolveThemeMode(themePreference);
  const tileUrl = (currentTheme === 'night' && provider.urlDark) ? provider.urlDark : provider.url;

  tileLayer = L.tileLayer(tileUrl, provider.options || {});
  tileLayer.on('tileload', () => {
    hasAnyTileLoaded = true;
    allProvidersFailed = false;
    applyTileAvailabilityClass(false);
  });
  tileLayer.on('tileerror', () => {
    tileErrorCount += 1;
    if (tileErrorCount < TILE_ERROR_SWITCH_THRESHOLD) {
      return;
    }
    const next = activeProviderIndex + 1;
    if (next < TILE_PROVIDERS.length) {
      switchToProvider(next);
      return;
    }
    if (!hasAnyTileLoaded) {
      allProvidersFailed = true;
      applyTileAvailabilityClass(true);
    }
  });
  tileLayer.addTo(map);
  return true;
}

function initMap() {
  if (typeof L === 'undefined') {
    setStats(getI18nValue('worldwide.leafletFailed', 'Leaflet failed to load.'));
    return null;
  }
  const el = document.getElementById('worldwideMap');
  if (!el) {
    return null;
  }
  map = L.map(el, {
    zoomControl: true,
    minZoom: 2,
    maxZoom: 10,
    worldCopyJump: true,
    preferCanvas: true,
    renderer: canvasRenderer || undefined,
  }).setView([20, 10], 2);

  if (map.attributionControl) {
    map.attributionControl.setPrefix(false);
  }
  map.on('click', () => {
    pinDetail('', null);
  });
  switchToProvider(0);

  // 创建独立的pane给Local Mac节点
  if (!map.getPane('localMarkerPane')) {
    map.createPane('localMarkerPane');
    map.getPane('localMarkerPane').style.zIndex = 650;
    map.getPane('localMarkerPane').style.pointerEvents = 'none';
  }

  localMarkerLayer = L.layerGroup({ zIndex: 40, pane: 'localMarkerPane' }).addTo(map); // 根节点使用独立pane
  linksLayer = L.layerGroup({ zIndex: 10 }).addTo(map);
  flowLayer = L.layerGroup({ zIndex: 20 }).addTo(map);
  pointsLayer = L.layerGroup({ zIndex: 30 }).addTo(map);
  return map;
}

function refillSelect(el, values = []) {
  if (!el) return;
  const current = String(el.value || '');
  const allText = getI18nValue('worldwide.filters.all', 'All');
  el.innerHTML = `<option value="">${allText}</option>`;
  values.forEach((value) => {
    const text = String(value || '').trim();
    if (!text) return;
    const option = document.createElement('option');
    option.value = text;
    option.textContent = text;
    el.appendChild(option);
  });
  if (current && values.includes(current)) {
    el.value = current;
  }
}

function applyFilters(points = []) {
  const outbound = String(filterOutboundEl && filterOutboundEl.value || '').trim();
  const country = String(filterCountryEl && filterCountryEl.value || '').trim();
  const city = String(filterCityEl && filterCityEl.value || '').trim();
  const filtered = points.filter((point) => {
    if (outbound) {
      const outbounds = Array.isArray(point.outbounds) ? point.outbounds : [];
      if (!outbounds.includes(outbound)) return false;
    }
    if (country && String(point.country || '').trim() !== country) {
      return false;
    }
    if (city && String(point.city || '').trim() !== city) {
      return false;
    }
    return true;
  });
  return filtered;
}

function drawSnapshot(snapshot) {
  if (!map || !pointsLayer || !linksLayer) {
    return;
  }
  const payload = snapshot && snapshot.data && typeof snapshot.data === 'object' ? snapshot.data : {};
  const local = payload.local && Number.isFinite(Number(payload.local.lat)) && Number.isFinite(Number(payload.local.lon))
    ? payload.local
    : null;
  const pointsSource = Array.isArray(payload.points) ? payload.points : [];
  const stats = payload.stats && typeof payload.stats === 'object' ? payload.stats : {};
  const filters = payload.filters && typeof payload.filters === 'object' ? payload.filters : {};

  refillSelect(filterOutboundEl, Array.isArray(filters.outbounds) ? filters.outbounds : []);
  refillSelect(filterCountryEl, Array.isArray(filters.countries) ? filters.cities : []);
  refillSelect(filterCityEl, Array.isArray(filters.cities) ? filters.cities : []);

  const points = applyFilters(pointsSource).slice(0, RENDER_MAX_POINTS);

  setDetail(null);
  if (emptyEl) {
    emptyEl.classList.toggle('show', points.length === 0);
  }

  if (!local) {
    statsFailureCount = 0;
    lastStatsMode = 'waiting';
    setStats(getI18nValue('worldwide.waitingLocal', 'Waiting for local geo location...'));
    return;
  }

  const localLatLng = [Number(local.lat), Number(local.lon)];
  if (!localMarker) {
    localMarker = L.marker(localLatLng, {
      icon: buildLocalComputerIcon(),
      keyboard: false,
      pane: 'localMarkerPane',
    }).addTo(localMarkerLayer);
    // 只在创建时绑定tooltip
    localMarker.bindTooltip(localLabel(local), {
      direction: 'top',
      permanent: false,
      opacity: 0.92,
    });
  } else {
    // 只有位置变化超过阈值才更新，避免频繁重绘
    const currentPos = localMarker.getLatLng();
    const latDiff = Math.abs(currentPos.lat - localLatLng[0]);
    const lonDiff = Math.abs(currentPos.lng - localLatLng[1]);
    if (latDiff > 0.001 || lonDiff > 0.001) {
      localMarker.setLatLng(localLatLng);
    }
    if (!localMarkerLayer.hasLayer(localMarker)) {
      localMarkerLayer.addLayer(localMarker);
    }
  }
  // 不再每次都重新绑定tooltip

  // 差异更新：标记哪些节点在新数据中存在
  const newPointKeys = new Set();
  const newLinkKeys = new Set();
  const newLabelKeys = new Set();
  const boundsPoints = [L.latLng(localLatLng[0], localLatLng[1])];
  const flowCandidates = [];

  // 第一步：处理新的节点和连线
  points.forEach((point, pointIndex) => {
    const lat = Number(point.lat);
    const lon = Number(point.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return;
    }

    const pointKey = `${lat.toFixed(4)},${lon.toFixed(4)}`;
    const linkKey = `${localLatLng[0].toFixed(4)},${localLatLng[1].toFixed(4)}-${lat.toFixed(4)},${lon.toFixed(4)}`;
    newPointKeys.add(pointKey);
    newLinkKeys.add(linkKey);

    const weight = Math.min(5.9, Math.max(1.9, 1.45 + (Math.log2(Number(point.count || 1) + 1) * 0.82)));
    const baseRadius = Math.min(12, Math.max(2, 1.8 + Math.log2(Number(point.count || 1) + 1)));

    // 如果连线不存在，创建新的
    if (!currentPolylines.has(linkKey)) {
      const linePoints = [localLatLng, [lat, lon]];
      const polyline = L.polyline(linePoints, {
        color: '#2f8fd8',
        opacity: 0.74,
        weight,
        className: 'world-link-path',
        interactive: false,
        // 不使用Canvas渲染，避免每次更新时整个画布重绘导致的闪烁
        renderer: undefined,
      }).addTo(linksLayer);
      currentPolylines.set(linkKey, polyline);
    }

    flowCandidates.push({
      from: localLatLng,
      to: [lat, lon],
      count: Number(point.count || 0),
      weight,
    });

    // 如果marker不存在，创建新的
    if (!currentMarkers.has(pointKey)) {
      const pulseIcon = L.divIcon({
        className: 'remote-pulse-marker',
        html: `
          <svg width="${baseRadius * 2 + 10}" height="${baseRadius * 2 + 10}" viewBox="0 0 ${baseRadius * 2 + 10} ${baseRadius * 2 + 10}">
            <circle
              class="remote-pulse-circle"
              cx="${baseRadius + 5}"
              cy="${baseRadius + 5}"
              r="${baseRadius}"
              fill="#ffffff"
              stroke="#2f8fd8"
              stroke-width="2.2"
              fill-opacity="0.98"
            />
          </svg>
        `,
        iconSize: [baseRadius * 2 + 10, baseRadius * 2 + 10],
        iconAnchor: [baseRadius + 5, baseRadius + 5],
      });

      const marker = L.marker([lat, lon], {
        icon: pulseIcon,
        interactive: true,
        pane: 'markerPane',
        zIndex: 600,
      });

      marker.bindTooltip(`${pointLabel(point)} · ${Number(point.count || 0)} ${getI18nValue('worldwide.labels.connections', 'conns')}`, {
        direction: 'top',
        permanent: false,
        opacity: 0.9,
      });
      marker.on('mouseover', () => {
        setDetail(point);
      });
      marker.on('mouseout', () => {
        if (pinnedPointKey) {
          setDetail(pinnedPoint);
          return;
        }
        setDetail(null);
      });
      marker.on('click', (event) => {
        if (event) {
          L.DomEvent.stopPropagation(event);
        }
        if (pinnedPointKey === pointKey) {
          pinDetail('', null);
          return;
        }
        pinDetail(pointKey, point);
      });

      marker.addTo(pointsLayer);
      currentMarkers.set(pointKey, { marker, lat, lon, baseRadius, point });

      // 启动呼吸动画（仅针对新创建的marker）
      setTimeout(() => {
        const element = marker.getElement();
        if (!element) return;

        if (element.classList.contains('world-local-computer-icon') ||
            !element.classList.contains('remote-pulse-marker')) {
          return;
        }

        const circle = element.querySelector('.remote-pulse-circle');
        if (!circle || circle.dataset.isAnimating === 'true') return;

        circle.dataset.isAnimating = 'true';

        let startTime = Date.now();
        const animate = () => {
          const elapsed = (Date.now() - startTime) / 1000;
          const phase = (Math.sin(elapsed * Math.PI * 2 / 1.8) + 1) / 2;

          const fillOpacity = 0.85 + (phase * 0.15);
          const strokeWidth = 1.5 + (phase * 2.5);
          const r = baseRadius + (phase * 3);

          if (circle.parentNode && circle.dataset.isAnimating === 'true') {
            circle.setAttribute('fill-opacity', fillOpacity);
            circle.setAttribute('stroke-width', strokeWidth);
            circle.setAttribute('r', r);
            requestAnimationFrame(animate);
          }
        };
        animate();
      }, 100);
    } else {
      const existing = currentMarkers.get(pointKey);
      if (existing) {
        existing.point = point;
        if (pinnedPointKey === pointKey) {
          pinnedPoint = point;
          setDetail(point);
        }
        if (existing.marker && typeof existing.marker.setTooltipContent === 'function') {
          existing.marker.setTooltipContent(`${pointLabel(point)} · ${Number(point.count || 0)} ${getI18nValue('worldwide.labels.connections', 'conns')}`);
        }
      }
    }

    // 添加或更新标签（差异更新）
    const cityLabel = String(point.city || '').trim() || String(point.country || '').trim();
    if (cityLabel && pointIndex < RENDER_LABEL_MAX) {
      const labelLat = (localLatLng[0] * 0.36) + (lat * 0.64);
      const labelLon = (localLatLng[1] * 0.36) + (lon * 0.64);
      const labelKey = `${labelLat.toFixed(4)},${labelLon.toFixed(4)}-${cityLabel}`;
      newLabelKeys.add(labelKey);

      // 如果标签不存在，创建新的
      if (!currentLabels.has(labelKey)) {
        const labelMarker = L.marker([labelLat, labelLon], {
          interactive: false,
          keyboard: false,
          icon: L.divIcon({
            className: 'world-line-label-wrap',
            html: `<span class="world-line-label">${cityLabel}</span>`,
            iconSize: null,
          }),
        }).addTo(linksLayer);
        labelMarker._labelKey = labelKey;
        currentLabels.set(labelKey, labelMarker);
      }
    }
    boundsPoints.push(L.latLng(lat, lon));
  });

  // 第二步：移除不再存在的节点、连线和标签（批处理）
  const toRemoveMarkers = [];
  const toRemovePolylines = [];
  const toRemoveLabels = [];

  currentMarkers.forEach((value, key) => {
    if (!newPointKeys.has(key)) {
      toRemoveMarkers.push(value.marker);
      currentMarkers.delete(key);
    }
  });

  currentPolylines.forEach((polyline, key) => {
    if (!newLinkKeys.has(key)) {
      toRemovePolylines.push(polyline);
      currentPolylines.delete(key);
    }
  });

  currentLabels.forEach((labelMarker, key) => {
    if (!newLabelKeys.has(key)) {
      toRemoveLabels.push(labelMarker);
      currentLabels.delete(key);
    }
  });

  // 一次性删除所有过期元素
  toRemoveMarkers.forEach(marker => pointsLayer.removeLayer(marker));
  toRemovePolylines.forEach(polyline => linksLayer.removeLayer(polyline));
  toRemoveLabels.forEach(labelMarker => linksLayer.removeLayer(labelMarker));

  // 更新流动粒子（差异更新，批处理）
  const newFlowKeys = new Set();
  const sortedFlowCandidates = flowCandidates
    .sort((a, b) => b.count - a.count)
    .slice(0, 28);

  sortedFlowCandidates.forEach((item) => {
    const density = item.weight >= 4.2 ? 3 : (item.weight >= 3.2 ? 2 : 1);
    for (let i = 0; i < density; i += 1) {
      if (flowParticles.length >= FLOW_MAX_PARTICLES) {
        break;
      }
      const fromKey = `${item.from[0].toFixed(4)},${item.from[1].toFixed(4)}`;
      const toKey = `${item.to[0].toFixed(4)},${item.to[1].toFixed(4)}`;
      const flowKey = `${fromKey}-${toKey}-${i}`;
      newFlowKeys.add(flowKey);

      // 如果流动粒子不存在，创建新的
      if (!currentFlowParticles.has(flowKey)) {
        const marker = L.circleMarker(item.from, {
          radius: 1.9,
          color: '#e0f8ff',
          fillColor: '#89ebff',
          fillOpacity: 0.95,
          opacity: 0.95,
          weight: 1,
          className: 'world-link-flow',
          interactive: false,
          renderer: canvasRenderer || undefined,
        }).addTo(flowLayer);
        const particle = {
          marker,
          from: item.from,
          to: item.to,
          speed: 0.12 + Math.random() * 0.14,
          progress: Math.random() * 2,
        };
        flowParticles.push(particle);
        currentFlowParticles.set(flowKey, particle);
      }
    }
  });

  // 批量移除不再存在的流动粒子
  const toRemoveParticles = [];
  currentFlowParticles.forEach((particle, key) => {
    if (!newFlowKeys.has(key)) {
      toRemoveParticles.push(particle);
      currentFlowParticles.delete(key);
    }
  });

  toRemoveParticles.forEach(particle => {
    flowLayer.removeLayer(particle.marker);
    const index = flowParticles.indexOf(particle);
    if (index > -1) {
      flowParticles.splice(index, 1);
    }
  });

  startFlowAnimation();

  const centerKey = `${localLatLng[0].toFixed(2)},${localLatLng[1].toFixed(2)}|${points.length}`;
  // 只在节点数量变化超过2个时才重新定位地图，避免频繁跳动
  const countDiff = Math.abs(points.length - (lastCenterKey.split('|')[1] || 0));
  if (boundsPoints.length > 1 && centerKey !== lastCenterKey && countDiff > 2) {
    map.fitBounds(L.latLngBounds(boundsPoints), { padding: [48, 48], maxZoom: 6 });
    lastCenterKey = centerKey;
  } else if (boundsPoints.length === 1 && centerKey !== lastCenterKey) {
    map.setView(localLatLng, 4);
    lastCenterKey = centerKey;
  }

  const provider = providerName();
  if (allProvidersFailed) {
    setStatsStructured({
      mode: 'unavailable',
      endpoints: points.length,
      connections: Number(stats.totalConnections || 0),
    });
    return;
  }
  setStatsStructured({
    mode: 'live',
    endpoints: points.length,
    connections: Number(stats.totalConnections || 0),
    provider,
  });
}

function scheduleRender(snapshot) {
  pendingSnapshot = snapshot;
  if (renderQueued) {
    return;
  }
  renderQueued = true;

  // 使用双帧RAF策略，确保在同一帧内完成所有DOM操作
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      renderQueued = false;
      if (pendingSnapshot) {
        snapshotState = pendingSnapshot;
        pendingSnapshot = null;
        drawSnapshot(snapshotState);
      }
    });
  });
}

async function pollSnapshot() {
  if (polling) {
    return;
  }
  polling = true;
  try {
    if (!window.clashfox || typeof window.clashfox.worldwideSnapshot !== 'function') {
      setStatsError(getI18nValue('worldwide.bridgeMissing', 'Bridge API not available.'));
      return;
    }
    const result = await window.clashfox.worldwideSnapshot({
      limit: 360,
      maxPoints: RENDER_MAX_POINTS,
    });
    if (!result || !result.ok) {
      setStatsError(getI18nValue('worldwide.loadFailed', 'Unable to load connection tracks.'));
      return;
    }
    scheduleRender(result);
  } catch {
    setStatsError(getI18nValue('worldwide.loadFailed', 'Unable to load connection tracks.'));
  } finally {
    polling = false;
  }
}

function handleFilterChange() {
  if (snapshotState) {
    scheduleRender(snapshotState);
  }
}

function startPolling() {
  if (document.hidden) {
    return;
  }
  pollSnapshot();
  pollTimer = setInterval(pollSnapshot, POLL_INTERVAL_MS);
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  stopFlowAnimation();
}

function syncPollingWithVisibility() {
  if (document.hidden) {
    stopPolling();
    return;
  }
  if (!pollTimer) {
    startPolling();
  }
  if (flowParticles.length) {
    startFlowAnimation();
  }
}

let trackersBootstrapped = false;
let trackersSettingsListenerBound = false;
let unsubscribeSystemTheme = null;
let unsubscribeSettingsUpdated = null;

function bindSettingsListeners() {
  if (trackersSettingsListenerBound) {
    return;
  }
  trackersSettingsListenerBound = true;
  if (window.clashfox && typeof window.clashfox.onSystemThemeChange === 'function') {
    unsubscribeSystemTheme = window.clashfox.onSystemThemeChange((payload) => {
      if (!payload || typeof payload.dark !== 'boolean') {
        return;
      }
      const previousTheme = lastAppliedTheme || resolveThemeMode(themePreference);
      lastSystemDark = payload.dark;
      if (themePreference === 'auto') {
        applyThemeMode('auto');
        const nextTheme = lastAppliedTheme || resolveThemeMode(themePreference);
        if (previousTheme !== nextTheme) {
          // 主题切换时重新加载地图瓦片
          switchToProvider(activeProviderIndex);
        }
      }
    });
  }
  if (window.clashfox && typeof window.clashfox.onSettingsUpdated === 'function') {
    unsubscribeSettingsUpdated = window.clashfox.onSettingsUpdated((settings = {}) => {
      const previousTheme = lastAppliedTheme || resolveThemeMode(themePreference);
      applySettingsPayload(settings);
      const nextTheme = lastAppliedTheme || resolveThemeMode(themePreference);
      if (previousTheme !== nextTheme) {
        // 主题设置更新时重新加载地图瓦片
        switchToProvider(activeProviderIndex);
      }
    });
  }
  if (window.matchMedia) {
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    query.addEventListener('change', (event) => {
      const previousTheme = lastAppliedTheme || resolveThemeMode(themePreference);
      lastSystemDark = Boolean(event.matches);
      if (themePreference === 'auto') {
        applyThemeMode('auto');
        const nextTheme = lastAppliedTheme || resolveThemeMode(themePreference);
        if (previousTheme !== nextTheme) {
          // 主题切换时重新加载地图瓦片
          switchToProvider(activeProviderIndex);
        }
      }
    });
  }
  window.addEventListener('focus', () => {
    syncPreferencesFromSettings().catch(() => {});
  });
  window.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      syncPreferencesFromSettings().catch(() => {});
    }
    syncPollingWithVisibility();
  });
}

async function bootstrapTrackersPage() {
  if (trackersBootstrapped) {
    return;
  }
  trackersBootstrapped = true;
  bindSettingsListeners();
  await syncPreferencesFromSettings();
  setDetail(null);
  if (statsEl) {
    statsEl.textContent = getI18nValue('worldwide.loading', 'Loading...');
  }
  if (filterOutboundEl) filterOutboundEl.addEventListener('change', handleFilterChange);
  if (filterCountryEl) filterCountryEl.addEventListener('change', handleFilterChange);
  if (filterCityEl) filterCityEl.addEventListener('change', handleFilterChange);
  if (initMap()) {
    syncPollingWithVisibility();
  }
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', () => {
    bootstrapTrackersPage().catch(() => {});
  });
} else {
  bootstrapTrackersPage().catch(() => {});
}

window.addEventListener('beforeunload', () => {
  stopPolling();
  if (typeof unsubscribeSystemTheme === 'function') {
    unsubscribeSystemTheme();
  }
  if (typeof unsubscribeSettingsUpdated === 'function') {
    unsubscribeSettingsUpdated();
  }
});
