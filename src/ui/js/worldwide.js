let map = null;
let localMarker = null;
let pointsLayer = null;
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
let flowAnimationFrame = 0;
let flowLastFrameAt = 0;
let languagePreference = 'auto';
let activeLanguage = 'en';
let themePreference = 'auto';
let lastSystemDark = window.matchMedia
  ? window.matchMedia('(prefers-color-scheme: dark)').matches
  : true;

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

function normalizeLanguageCode(value) {
  const lang = String(value || '').trim().toLowerCase();
  if (lang.startsWith('zh')) return 'zh';
  if (lang.startsWith('ja')) return 'ja';
  if (lang.startsWith('ko')) return 'ko';
  if (lang.startsWith('fr')) return 'fr';
  if (lang.startsWith('de')) return 'de';
  if (lang.startsWith('ru')) return 'ru';
  return 'en';
}

function detectSystemLanguageCode() {
  return normalizeLanguageCode(navigator.language || 'en');
}

function getI18nValue(path, fallback = '') {
  const dictionaries = window.CLASHFOX_I18N || {};
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
  try {
    localStorage.setItem('lastTheme', theme);
  } catch {
    // ignore storage failures
  }
}

function syncLanguageFromPreference() {
  activeLanguage = languagePreference === 'auto'
    ? detectSystemLanguageCode()
    : normalizeLanguageCode(languagePreference);
  document.documentElement.setAttribute('lang', activeLanguage);
  applyI18nText();
}

async function syncPreferencesFromSettings() {
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
    const nextLang = String(
      settings.lang
      || (settings.appearance && settings.appearance.lang)
      || 'auto',
    ).trim().toLowerCase() || 'auto';
    const nextTheme = String(
      settings.theme
      || (settings.appearance && settings.appearance.theme)
      || 'auto',
    ).trim().toLowerCase() || 'auto';
    languagePreference = nextLang;
    themePreference = nextTheme;
  } catch {
    languagePreference = 'auto';
    themePreference = 'auto';
  }
  syncLanguageFromPreference();
  applyThemeMode(themePreference);
}

function setStats(text) {
  if (statsEl) {
    statsEl.textContent = text;
  }
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
  detailBodyEl.textContent = `${location} | conns: ${Number(point.count || 0)} | outbound: ${outbounds} | host: ${hosts}`;
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
  return L.divIcon({
    className: 'world-local-computer-icon',
    html: '<span class="world-local-computer-core" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="5.5" y="5.5" width="13" height="9" rx="1.8"></rect><path d="M9.4 17.3h5.2"></path><path d="M11 14.8v2.5"></path></svg></span>',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
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

  tileLayer = L.tileLayer(provider.url, provider.options || {});
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
  switchToProvider(0);

  pointsLayer = L.layerGroup().addTo(map);
  linksLayer = L.layerGroup().addTo(map);
  flowLayer = L.layerGroup().addTo(map);
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
  return points.filter((point) => {
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
  refillSelect(filterCountryEl, Array.isArray(filters.countries) ? filters.countries : []);
  refillSelect(filterCityEl, Array.isArray(filters.cities) ? filters.cities : []);

  const points = applyFilters(pointsSource).slice(0, RENDER_MAX_POINTS);
  pointsLayer.clearLayers();
  linksLayer.clearLayers();
  clearFlowParticles();
  setDetail(null);
  if (emptyEl) {
    emptyEl.classList.toggle('show', points.length === 0);
  }

  if (!local) {
    setStats(getI18nValue('worldwide.waitingLocal', 'Waiting for local geo location...'));
    return;
  }

  const localLatLng = [Number(local.lat), Number(local.lon)];
  if (!localMarker) {
    localMarker = L.marker(localLatLng, {
      icon: buildLocalComputerIcon(),
      keyboard: false,
    }).addTo(pointsLayer);
  } else {
    localMarker.setLatLng(localLatLng);
    pointsLayer.addLayer(localMarker);
  }
  localMarker.bindTooltip(localLabel(local), {
    direction: 'top',
    permanent: false,
    opacity: 0.92,
  });

  const boundsPoints = [L.latLng(localLatLng[0], localLatLng[1])];
  const flowCandidates = [];
  points.forEach((point, pointIndex) => {
    const lat = Number(point.lat);
    const lon = Number(point.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return;
    }
    const weight = Math.min(5.9, Math.max(1.9, 1.45 + (Math.log2(Number(point.count || 1) + 1) * 0.82)));
    const marker = L.circleMarker([lat, lon], {
      radius: Math.min(12, Math.max(4, 3.8 + Math.log2(Number(point.count || 1) + 1))),
      color: '#35587a',
      fillColor: '#6b8fb3',
      fillOpacity: 0.96,
      weight: 2.1,
      renderer: canvasRenderer || undefined,
    });
    marker.bindTooltip(`${pointLabel(point)} · ${Number(point.count || 0)} conns`, {
      direction: 'top',
      permanent: false,
      opacity: 0.9,
    });
    marker.on('mouseover', () => setDetail(point));
    marker.on('mouseout', () => setDetail(null));
    marker.addTo(pointsLayer);

    const linePoints = [localLatLng, [lat, lon]];
    L.polyline(linePoints, {
      color: '#2f8fd8',
      opacity: 0.74,
      weight,
      className: 'world-link-path',
      interactive: false,
      renderer: canvasRenderer || undefined,
    }).addTo(linksLayer);
    flowCandidates.push({
      from: localLatLng,
      to: [lat, lon],
      count: Number(point.count || 0),
      weight,
    });

    const cityLabel = String(point.city || '').trim() || String(point.country || '').trim();
    if (cityLabel && pointIndex < RENDER_LABEL_MAX) {
      const labelLat = (localLatLng[0] * 0.36) + (lat * 0.64);
      const labelLon = (localLatLng[1] * 0.36) + (lon * 0.64);
      L.marker([labelLat, labelLon], {
        interactive: false,
        keyboard: false,
        icon: L.divIcon({
          className: 'world-line-label-wrap',
          html: `<span class="world-line-label">${cityLabel}</span>`,
          iconSize: null,
        }),
      }).addTo(linksLayer);
    }
    boundsPoints.push(L.latLng(lat, lon));
  });

  flowCandidates
    .sort((a, b) => b.count - a.count)
    .slice(0, 28)
    .forEach((item) => {
      const density = item.weight >= 4.2 ? 3 : (item.weight >= 3.2 ? 2 : 1);
      for (let i = 0; i < density; i += 1) {
        if (flowParticles.length >= FLOW_MAX_PARTICLES) {
          break;
        }
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
        flowParticles.push({
          marker,
          from: item.from,
          to: item.to,
          speed: 0.12 + Math.random() * 0.14,
          progress: Math.random() * 2,
        });
      }
    });
  startFlowAnimation();

  const centerKey = `${localLatLng[0].toFixed(2)},${localLatLng[1].toFixed(2)}|${points.length}`;
  if (boundsPoints.length > 1 && centerKey !== lastCenterKey) {
    map.fitBounds(L.latLngBounds(boundsPoints), { padding: [48, 48], maxZoom: 6 });
    lastCenterKey = centerKey;
  } else if (boundsPoints.length === 1 && centerKey !== lastCenterKey) {
    map.setView(localLatLng, 4);
    lastCenterKey = centerKey;
  }

  const provider = providerName();
  if (allProvidersFailed) {
    setStats(formatI18n(
      getI18nValue('worldwide.stats.liveUnavailable', 'Live {endpoints} endpoints · {connections} active connections · map unavailable'),
      {
        endpoints: points.length,
        connections: Number(stats.totalConnections || 0),
      },
    ));
    return;
  }
  setStats(formatI18n(
    getI18nValue('worldwide.stats.live', 'Live {endpoints} endpoints · {connections} active connections · map: {provider}'),
    {
      endpoints: points.length,
      connections: Number(stats.totalConnections || 0),
      provider,
    },
  ));
}

function scheduleRender(snapshot) {
  pendingSnapshot = snapshot;
  if (renderQueued) {
    return;
  }
  renderQueued = true;
  window.requestAnimationFrame(() => {
    renderQueued = false;
    if (pendingSnapshot) {
      snapshotState = pendingSnapshot;
      pendingSnapshot = null;
      drawSnapshot(snapshotState);
    }
  });
}

async function pollSnapshot() {
  if (polling) {
    return;
  }
  polling = true;
  try {
    if (!window.clashfox || typeof window.clashfox.worldwideSnapshot !== 'function') {
      setStats(getI18nValue('worldwide.bridgeMissing', 'Bridge API not available.'));
      return;
    }
    const result = await window.clashfox.worldwideSnapshot({
      limit: 360,
      maxPoints: RENDER_MAX_POINTS,
    });
    if (!result || !result.ok) {
      setStats(getI18nValue('worldwide.loadFailed', 'Unable to load connection tracks.'));
      return;
    }
    scheduleRender(result);
  } catch {
    setStats(getI18nValue('worldwide.loadFailed', 'Unable to load connection tracks.'));
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

window.addEventListener('beforeunload', () => {
  stopPolling();
});

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

window.addEventListener('DOMContentLoaded', async () => {
  await syncPreferencesFromSettings();
  setDetail(null);
  if (statsEl) {
    statsEl.textContent = getI18nValue('worldwide.loading', 'Loading...');
  }
  if (filterOutboundEl) filterOutboundEl.addEventListener('change', handleFilterChange);
  if (filterCountryEl) filterCountryEl.addEventListener('change', handleFilterChange);
  if (filterCityEl) filterCityEl.addEventListener('change', handleFilterChange);
  if (window.clashfox && typeof window.clashfox.onSystemThemeChange === 'function') {
    window.clashfox.onSystemThemeChange((payload) => {
      if (!payload || typeof payload.dark !== 'boolean') {
        return;
      }
      lastSystemDark = payload.dark;
      if (themePreference === 'auto') {
        applyThemeMode('auto');
      }
    });
  }
  if (window.matchMedia) {
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    query.addEventListener('change', (event) => {
      lastSystemDark = Boolean(event.matches);
      if (themePreference === 'auto') {
        applyThemeMode('auto');
      }
    });
  }
  window.addEventListener('focus', () => {
    syncPreferencesFromSettings().catch(() => {});
  });
  window.addEventListener('visibilitychange', syncPollingWithVisibility);
  if (initMap()) {
    syncPollingWithVisibility();
  }
});
