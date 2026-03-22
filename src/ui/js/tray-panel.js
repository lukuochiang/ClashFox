const panelRootEl = document.getElementById('panelRoot');
const panelListEl = document.getElementById('panelList');

let panelItems = [];
let lastResizeWidth = 0;
let lastResizeHeight = 0;
let lastHoverSent = false;
let panelItemsSignature = '';

let panelChartSocket = null;
let panelChartReconnectTimer = null;
let panelChartReconnectAttempts = 0;
let panelChartRatesRx = [];
let panelChartRatesTx = [];
let panelChartTotalRx = null;
let panelChartTotalTx = null;
let panelProviderPayloadSignature = '';
let lastSettingsSignature = '';

const PANEL_TRAFFIC_HISTORY_LIMIT = 520;
const PANEL_TRAFFIC_INTERVAL_MS = 1000;
const PANEL_TRAFFIC_RECONNECT_BASE_MS = 1200;
const PANEL_TRAFFIC_RECONNECT_MAX_MS = 10000;
const PANEL_WIDTH_FIXED = 260;
const PANEL_PROVIDER_REFRESH_MS = 2500;
let panelProviderRefreshTimer = null;
const PANEL_MIN_HEIGHT = 286;
const PANEL_RESIZE_DIFF_THRESHOLD = 4;
let panelResizeScheduled = false;
let panelRendererVisible = false;

async function applyTrayTheme() {
  try {
    if (!document.body) return;
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

function stopPanelLiveActivity() {
  stopProviderFallbackRefresh();
  closePanelTrafficSocket();
}

function startPanelLiveActivity() {
  if (!panelRendererVisible) {
    return;
  }
  if (panelItems.length) {
    renderPanel();
  }
  startProviderFallbackRefresh();
  openPanelTrafficSocket();
}

function setPanelRendererVisible(nextVisible) {
  const visible = Boolean(nextVisible);
  if (panelRendererVisible === visible) {
    return;
  }
  panelRendererVisible = visible;
  if (!visible) {
    stopPanelLiveActivity();
    return;
  }
  startPanelLiveActivity();
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
      <div class="panel-card-title">Traffic Chart</div>
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
            <linearGradient id="trayDownGradient" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stop-color="#53b8ff" stop-opacity="0.98" />
              <stop offset="100%" stop-color="#53b8ff" stop-opacity="0.18" />
            </linearGradient>
            <linearGradient id="trayUpGradient" x1="0" x2="0" y1="0" y2="1">
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

function buildProviderPayloadSignature(payload = null) {
  const summary = payload && payload.summary && typeof payload.summary === 'object' ? payload.summary : null;
  const items = payload && Array.isArray(payload.items) ? payload.items : [];
  const current = items[0] || {};
  return [
    summary ? `${summary.providerCount || 0}:${summary.usedBytes || 0}:${summary.remainingBytes || 0}` : 'none',
    current.id || current.name || '-',
    current.usedBytes || 0,
    current.remainingBytes || 0,
    current.expireAt || 0,
  ].join('|');
}

function buildPanelItemsSignature(items = []) {
  if (!Array.isArray(items)) {
    return '';
  }
  return items.map((item) => {
    if (!item || typeof item !== 'object') {
      return 'invalid';
    }
    if (item.type === 'panel-provider-traffic') {
      return `panel-provider-traffic:${buildProviderPayloadSignature(item.payload || null)}`;
    }
    return String(item.type || 'unknown');
  }).join('|');
}

function buildPanelProviderTrafficMarkup(payload = null) {
  const summary = payload && payload.summary && typeof payload.summary === 'object' ? payload.summary : null;
  const items = payload && Array.isArray(payload.items) ? payload.items : [];
  if (!summary || !items.length) {
    return `
      <div class="menu-provider-traffic">
        <div class="panel-card-title">Subscription Traffic</div>
        <div class="provider-traffic-summary">
          <div class="provider-traffic-stat">
            <span class="provider-traffic-stat-label">Providers</span>
            <span class="provider-traffic-stat-value">0</span>
          </div>
          <div class="provider-traffic-stat">
            <span class="provider-traffic-stat-label">Used</span>
            <span class="provider-traffic-stat-value">-</span>
          </div>
          <div class="provider-traffic-stat">
            <span class="provider-traffic-stat-label">Remaining</span>
            <span class="provider-traffic-stat-value">-</span>
          </div>
        </div>
        <div class="provider-traffic-item">
          <div class="provider-traffic-item-head">
            <div class="provider-traffic-item-name">No subscription data</div>
            <div class="provider-traffic-item-percent">-</div>
          </div>
          <div class="provider-traffic-progress">
            <div class="provider-traffic-progress-bar" style="width:0%"></div>
          </div>
          <div class="provider-traffic-item-meta">
            <span>-</span>
            <span>-</span>
          </div>
          <div class="provider-traffic-item-meta secondary">
            <span>-</span>
            <span>-</span>
          </div>
        </div>
      </div>
    `;
  }
  const current = items[0];
  const usedPercent = Number.parseFloat(current.usedPercent || 0) || 0;
  return `
    <div class="menu-provider-traffic">
      <div class="panel-card-title">Subscription Traffic</div>
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
  if (!panelRendererVisible) {
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
  const points = Math.max(panelChartRatesRx.length, panelChartRatesTx.length, 0);
  const currentRx = panelChartRatesRx.length ? panelChartRatesRx[panelChartRatesRx.length - 1] : null;
  const currentTx = panelChartRatesTx.length ? panelChartRatesTx[panelChartRatesTx.length - 1] : null;
  if (topLabelEl) topLabelEl.textContent = Number.isFinite(currentTx) ? `${formatBytes(currentTx)}/s` : '-';
  if (bottomLabelEl) bottomLabelEl.textContent = Number.isFinite(currentRx) ? `${formatBytes(currentRx)}/s` : '-';
  if (topTotalEl) topTotalEl.textContent = Number.isFinite(panelChartTotalTx) ? formatBytes(panelChartTotalTx) : 'U';
  if (bottomTotalEl) bottomTotalEl.textContent = Number.isFinite(panelChartTotalRx) ? formatBytes(panelChartTotalRx) : 'D';
  if (leftTimeEl) {
    if (points <= 1) {
      leftTimeEl.textContent = '-';
    } else {
      const totalSec = Math.max(1, Math.round(((points - 1) * PANEL_TRAFFIC_INTERVAL_MS) / 1000));
      leftTimeEl.textContent = totalSec < 60
        ? `${totalSec} seconds ago`
        : `${Math.max(1, Math.round(totalSec / 60))} minutes ago`;
    }
  }
  if (rightTimeEl) rightTimeEl.textContent = 'now';

  const maxRx = panelChartRatesRx.length ? Math.max(...panelChartRatesRx, 0) : 0;
  const maxTx = panelChartRatesTx.length ? Math.max(...panelChartRatesTx, 0) : 0;
  let niceMaxRx = niceMaxValue(maxRx);
  let niceMaxTx = niceMaxValue(maxTx);
  if (niceMaxRx < 8) niceMaxRx = 8;
  if (niceMaxTx < 8) niceMaxTx = 8;
  const width = 100;
  const height = 60;
  const baseline = height / 2;
  const available = baseline;
  const fixedHeight = available;
  const svgEl = barsEl.ownerSVGElement;
  const svgRect = svgEl ? svgEl.getBoundingClientRect() : null;
  const desiredPx = 5.7;
  const pxPerUnit = svgRect && svgRect.width ? svgRect.width / width : 2.4;
  const barWidth = Math.min(4, Math.max(0.6, desiredPx / pxPerUnit));
  const gap = Math.max(0.2, barWidth * 0.25);
  const unit = barWidth + gap;
  const maxBars = Math.max(1, Math.floor(width / unit));
  const startIndex = Math.max(0, points - maxBars);
  const visibleCount = Math.min(points, maxBars);
  const emptySlots = Math.max(0, maxBars - visibleCount);
  const xStep = maxBars > 1 ? (width - barWidth) / (maxBars - 1) : 0;
  if (!Array.isArray(barsEl._barPairs)) {
    barsEl._barPairs = [];
  }
  while (barsEl._barPairs.length < maxBars) {
    const downBase = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    downBase.setAttribute('class', 'chart-bar-bg down');
    const upBase = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    upBase.setAttribute('class', 'chart-bar-bg up');
    const down = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    down.setAttribute('class', 'chart-bar down');
    const up = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    up.setAttribute('class', 'chart-bar up');
    barsEl.appendChild(downBase);
    barsEl.appendChild(upBase);
    barsEl.appendChild(down);
    barsEl.appendChild(up);
    barsEl._barPairs.push({ downBase, upBase, down, up });
  }
  for (let i = 0; i < barsEl._barPairs.length; i += 1) {
    const pair = barsEl._barPairs[i];
    const x = i * xStep;
    const dataIndex = i - emptySlots;
    const hasSample = dataIndex >= 0 && dataIndex < visibleCount;
    const idx = hasSample ? (startIndex + dataIndex) : -1;
    const downValue = hasSample ? (panelChartRatesRx[idx] || 0) : 0;
    const upValue = hasSample ? (panelChartRatesTx[idx] || 0) : 0;
    const downHeight = Math.max(0, Math.min(available, (downValue / niceMaxRx) * available));
    const upHeight = Math.max(0, Math.min(available, (upValue / niceMaxTx) * available));
    pair.downBase.setAttribute('class', hasSample ? 'chart-bar-bg down' : 'chart-bar-bg down is-placeholder');
    pair.downBase.setAttribute('display', '');
    pair.downBase.setAttribute('x', x.toFixed(2));
    pair.downBase.setAttribute('y', baseline.toFixed(2));
    pair.downBase.setAttribute('width', barWidth.toFixed(2));
    pair.downBase.setAttribute('height', fixedHeight.toFixed(2));
    pair.downBase.setAttribute('rx', '0.35');
    pair.upBase.setAttribute('class', hasSample ? 'chart-bar-bg up' : 'chart-bar-bg up is-placeholder');
    pair.upBase.setAttribute('display', '');
    pair.upBase.setAttribute('x', x.toFixed(2));
    pair.upBase.setAttribute('y', (baseline - fixedHeight).toFixed(2));
    pair.upBase.setAttribute('width', barWidth.toFixed(2));
    pair.upBase.setAttribute('height', fixedHeight.toFixed(2));
    pair.upBase.setAttribute('rx', '0.35');
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
  if (!panelRendererVisible || typeof WebSocket !== 'function') return;
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
      panelChartReconnectAttempts += 1;
      schedulePanelTrafficReconnect();
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

function measurePanelDimensions() {
  if (!panelRootEl) {
    return { width: PANEL_WIDTH_FIXED, height: 0 };
  }
  const width = PANEL_WIDTH_FIXED;
  panelRootEl.style.width = `${width}px`;
  const height = panelListEl
    ? (panelListEl.scrollHeight || panelListEl.getBoundingClientRect().height || 0)
    : (panelRootEl.scrollHeight || panelRootEl.getBoundingClientRect().height || 0);
  return { width, height };
}

function performPanelResize(metrics) {
  const width = metrics.width;
  const height = Math.max(PANEL_MIN_HEIGHT, Math.ceil(metrics.height || 0));
  const heightDelta = Math.abs(height - lastResizeHeight);
  if (width === lastResizeWidth && heightDelta < PANEL_RESIZE_DIFF_THRESHOLD) {
    return;
  }
  lastResizeWidth = width;
  lastResizeHeight = height;
  if (window.clashfox && typeof window.clashfox.trayPanelResize === 'function') {
    window.clashfox.trayPanelResize({ width, height });
  }
}

function resizePanelToContent() {
  if (panelResizeScheduled) {
    return;
  }
  panelResizeScheduled = true;
  requestAnimationFrame(() => {
    panelResizeScheduled = false;
    performPanelResize(measurePanelDimensions());
  });
}

function getPanelProviderItem() {
  const index = panelItems.findIndex((item) => item && item.type === 'panel-provider-traffic');
  if (index < 0) {
    return { index: -1, item: null };
  }
  return { index, item: panelItems[index] };
}

function hasProviderData(payload = null) {
  const summary = payload && payload.summary && typeof payload.summary === 'object' ? payload.summary : null;
  const items = payload && Array.isArray(payload.items) ? payload.items : [];
  return Boolean(summary && items.length);
}

function applyProviderPayload(payload = null) {
  const { index, item } = getPanelProviderItem();
  if (index < 0 || !item) {
    return false;
  }
  panelItems[index] = { ...item, payload };
  return true;
}

function updateProviderCardInPlace(payload = null) {
  if (!panelListEl) {
    return false;
  }
  const providerHost = panelListEl.querySelector('[data-panel-card="provider"]');
  if (!providerHost) {
    return false;
  }
  providerHost.innerHTML = buildPanelProviderTrafficMarkup(payload);
  resizePanelToContent();
  return true;
}

async function refreshProviderTrafficFallback(force = false) {
  if (!panelRendererVisible) {
    return;
  }
  if (!window.clashfox || typeof window.clashfox.providerSubscriptionOverview !== 'function') {
    return;
  }
  const { item } = getPanelProviderItem();
  const existingPayload = item && item.payload ? item.payload : null;
  if (!force && hasProviderData(existingPayload)) {
    return;
  }
  try {
    const response = await window.clashfox.providerSubscriptionOverview();
    if (!(response && response.ok && response.data)) {
      return;
    }
    const nextSignature = buildProviderPayloadSignature(response.data);
    if (!force && nextSignature && nextSignature === panelProviderPayloadSignature) {
      return;
    }
    if (!applyProviderPayload(response.data)) {
      return;
    }
    panelProviderPayloadSignature = nextSignature;
    if (!updateProviderCardInPlace(response.data)) {
      renderPanel();
    }
  } catch {
    // ignore fallback refresh failures
  }
}

function startProviderFallbackRefresh() {
  if (!panelRendererVisible || panelProviderRefreshTimer) {
    return;
  }
  panelProviderRefreshTimer = setInterval(() => {
    refreshProviderTrafficFallback(false).catch(() => {});
  }, PANEL_PROVIDER_REFRESH_MS);
}

function stopProviderFallbackRefresh() {
  if (!panelProviderRefreshTimer) {
    return;
  }
  clearInterval(panelProviderRefreshTimer);
  panelProviderRefreshTimer = null;
}

function makeRow(item) {
  if (item.type === 'separator') {
    const sep = document.createElement('div');
    sep.className = 'menu-row-sep';
    return sep;
  }
  if (item.type === 'panel-chart') {
    const row = document.createElement('div');
    row.className = 'menu-panel-card-host';
    row.dataset.panelCard = 'chart';
    row.innerHTML = buildPanelChartMarkup();
    return row;
  }
  if (item.type === 'panel-provider-traffic') {
    const row = document.createElement('div');
    row.className = 'menu-panel-card-host';
    row.dataset.panelCard = 'provider';
    row.innerHTML = buildPanelProviderTrafficMarkup(item.payload || null);
    return row;
  }
  return document.createElement('div');
}

function renderPanel() {
  if (!panelRendererVisible || !panelListEl) {
    return;
  }
  panelListEl.innerHTML = '';
  panelItems.forEach((item) => {
    panelListEl.appendChild(makeRow(item));
  });
  resizePanelToContent();
  openPanelTrafficSocket().catch(() => {});
}

function setPanel(payload) {
  const incomingItems = Array.isArray(payload && payload.items) ? payload.items : [];
  const nextItems = incomingItems.length ? incomingItems : [
    { type: 'panel-chart' },
    { type: 'panel-provider-traffic', payload: null },
  ];
  const nextItemsSignature = buildPanelItemsSignature(nextItems);
  if (nextItemsSignature && nextItemsSignature === panelItemsSignature) {
    refreshProviderTrafficFallback(false).catch(() => {});
    startProviderFallbackRefresh();
    return;
  }
  panelItems = nextItems;
  panelItemsSignature = nextItemsSignature;
  const { item } = getPanelProviderItem();
  panelProviderPayloadSignature = buildProviderPayloadSignature(item && item.payload ? item.payload : null);
  if (!panelRendererVisible) {
    return;
  }
  renderPanel();
  refreshProviderTrafficFallback(false).catch(() => {});
  startProviderFallbackRefresh();
}

applyTrayTheme().catch(() => {});

if (window.clashfox && typeof window.clashfox.onTrayPanelUpdate === 'function') {
  window.clashfox.onTrayPanelUpdate((payload) => {
    applyTrayTheme().catch(() => {});
    setPanel(payload);
  });
}

if (window.clashfox && typeof window.clashfox.onTrayPanelVisibility === 'function') {
  window.clashfox.onTrayPanelVisibility((payload = {}) => {
    setPanelRendererVisible(Boolean(payload && payload.visible));
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
    const nextSignature = String(
      settings.theme
      || appearance.theme
      || appearance.colorMode
      || 'auto',
    ).trim().toLowerCase();
    if (nextSignature === lastSettingsSignature) {
      return;
    }
    lastSettingsSignature = nextSignature;
    if (!panelRendererVisible) {
      return;
    }
    applyTrayTheme().catch(() => {});
  });
}

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


if (window.clashfox && typeof window.clashfox.trayPanelHover === 'function') {
  const sendHover = (nextValue) => {
    const normalized = Boolean(nextValue);
    if (normalized === lastHoverSent) return;
    lastHoverSent = normalized;
    window.clashfox.trayPanelHover(normalized);
  };
  if (panelRootEl) {
    panelRootEl.addEventListener('mousemove', () => sendHover(true));
    panelRootEl.addEventListener('mouseleave', () => sendHover(false));
  }
  window.addEventListener('blur', () => sendHover(false));
}

if (window.clashfox && typeof window.clashfox.trayPanelReady === 'function') {
  window.clashfox.trayPanelReady();
}

window.addEventListener('beforeunload', () => {
  stopPanelLiveActivity();
  stopProviderFallbackRefresh();
  closePanelTrafficSocket();
});
