import { SidebarFoxDivider } from './sidebar-fox-divider.js';
import { FOX_RANK_I18N } from './foxrank-i18n.js';

const appLocaleUtils = globalThis.CLASHFOX_LOCALE_UTILS || {};
const detectSystemLocale = typeof appLocaleUtils.detectSystemLocale === 'function'
  ? appLocaleUtils.detectSystemLocale
  : (() => 'en');
let systemLocaleFromMain = '';

// apply last-used theme immediately to avoid flicker on reload
// this will be overwritten later when settings are applied
try {
  const last = localStorage.getItem('lastTheme');
  if (last) {
    document.documentElement.setAttribute('data-theme', last);
  }
  if (last && document.body) {
    document.body.dataset.theme = last;
  }
} catch {};

// disable theme-related transitions until initial load completes
if (document.body) {
  document.body.classList.add('no-theme-transition');
} else {
  document.addEventListener('DOMContentLoaded', () => document.body.classList.add('no-theme-transition'));
}

// remove the helper class once everything is loaded
window.addEventListener('load', () => {
  document.body.classList.remove('no-theme-transition');
});

let navButtons = Array.from(document.querySelectorAll('.nav-btn'));
let topNavMore = document.getElementById('topNavMore');
let topNavMoreBtn = document.getElementById('topNavMoreBtn');
let topNavMoreMenu = document.getElementById('topNavMoreMenu');
let navScroll = document.getElementById('navScroll');
let primaryNav = document.getElementById('primaryNav');
let appShell = document.querySelector('.app');
let menuContainer = document.getElementById('menuContainer');
let sidebarFoxDividerHost = document.getElementById('sidebarFoxDividerHost');
let sidebarCollapseToggle = document.getElementById('sidebarCollapseToggle');
let panels = Array.from(document.querySelectorAll('.panel'));
let noticePop = document.getElementById('noticePop');
let noticePopBody = document.getElementById('noticePopBody');
let noticePopClose = document.getElementById('noticePopClose');
let noticePopTitle = document.getElementById('noticePopTitle');
let contentRoot = document.getElementById('contentRoot');
let currentPage = document.body ? document.body.dataset.page : '';
const VALID_PAGES = new Set(['overview', 'kernel', 'config', 'logs', 'settings', 'help', 'dashboard']);
const FOX_RANK_STORAGE_KEY = 'clashfox-fox-rank-state';
const FOX_RANK_USAGE_RESET_VERSION = '2026-03-16-reset-usage-v1';
const FOX_RANK_EXPLORATION_COOLDOWN_MS = 45000;
const FOX_RANK_TIERS = [
  { name: 'Fox Pup', minXp: 0, colorStart: '#ffd86a', colorEnd: '#ffb347' },
  { name: 'Trail Fox', minXp: 400, colorStart: '#ff8f57', colorEnd: '#ff5e44' },
  { name: 'Lunar Fox', minXp: 900, colorStart: '#8ac1ff', colorEnd: '#5e9bff' },
  { name: 'Ember Fox', minXp: 1600, colorStart: '#ffb36a', colorEnd: '#ff8f57' },
  { name: 'Star Fox', minXp: 2400, colorStart: '#c685ff', colorEnd: '#8d6dff' },
  { name: 'Apex Fox', minXp: 3400, colorStart: '#7df3d2', colorEnd: '#4bc6ff' },
];
const FOX_RANK_SKINS = [
  { id: 'campfire', name: 'Campfire', unlockTier: 0, desc: 'Warm amber glow for daily routine.' },
  { id: 'aurora', name: 'Aurora Veil', unlockTier: 2, desc: 'Blue-green ribbons for steady links.' },
  { id: 'starlight', name: 'Starlight Grid', unlockTier: 4, desc: 'Nebula shimmer for long streaks.' },
  { id: 'solar-crown', name: 'Solar Crown', unlockTier: 5, desc: 'Golden crest reserved for Apex Fox.' },
];

let foxRankPanel = document.getElementById('foxRankPanel');
let foxRankCard = document.getElementById('foxRankCard');
let foxRankTierName = document.getElementById('foxRankTierName');
let foxRankLevelText = document.getElementById('foxRankLevelText');
let foxRankProgressFill = document.getElementById('foxRankProgressFill');
let foxRankProgressText = document.getElementById('foxRankProgressText');
let foxRankUsageValue = document.getElementById('foxRankUsageValue');
let foxRankStabilityValue = document.getElementById('foxRankStabilityValue');
let foxRankQualityValue = document.getElementById('foxRankQualityValue');
let foxRankBoostHint = document.getElementById('foxRankBoostHint');
let foxRankWarningChip = document.getElementById('foxRankWarningChip');
let foxRankExploreCount = document.getElementById('foxRankExploreCount');
let foxRankSkinHint = document.getElementById('foxRankSkinHint');
let foxRankDetailModal = document.getElementById('foxRankDetailModal');
let foxRankDetailClose = document.getElementById('foxRankDetailClose');
let foxRankDetailTier = document.getElementById('foxRankDetailTier');
let foxRankDetailSubtitle = document.getElementById('foxRankDetailSubtitle');
let foxRankDetailLevel = document.getElementById('foxRankDetailLevel');
let foxRankDetailXp = document.getElementById('foxRankDetailXp');
let foxRankDetailUsage = document.getElementById('foxRankDetailUsage');
let foxRankDetailStability = document.getElementById('foxRankDetailStability');
let foxRankDetailQuality = document.getElementById('foxRankDetailQuality');
let foxRankDetailExplore = document.getElementById('foxRankDetailExplore');
let foxRankDetailBoost = document.getElementById('foxRankDetailBoost');
let foxRankWeeklyCard = document.getElementById('foxRankWeeklyCard');
let foxRankSectionTabs = document.getElementById('foxRankSectionTabs');
let foxRankTabLog = document.getElementById('foxRankTabLog');
let foxRankTabBadges = document.getElementById('foxRankTabBadges');
let foxRankTabSkins = document.getElementById('foxRankTabSkins');
let foxRankTabPanelLog = document.getElementById('foxRankTabPanelLog');
let foxRankTabPanelBadges = document.getElementById('foxRankTabPanelBadges');
let foxRankTabPanelSkins = document.getElementById('foxRankTabPanelSkins');
let foxRankLogList = document.getElementById('foxRankLogList');
let foxRankBadgeList = document.getElementById('foxRankBadgeList');
let foxRankSkinList = document.getElementById('foxRankSkinList');
let foxRankSharePreview = document.getElementById('foxRankSharePreview');
let foxRankCopySummaryBtn = document.getElementById('foxRankCopySummaryBtn');
let foxRankExportPngBtn = document.getElementById('foxRankExportPngBtn');
let foxRankBriefModal = document.getElementById('foxRankBriefModal');
let foxRankBriefTitle = document.getElementById('foxRankBriefTitle');
let foxRankBriefSummary = document.getElementById('foxRankBriefSummary');
let foxRankBriefMetrics = document.getElementById('foxRankBriefMetrics');
let foxRankBriefBoost = document.getElementById('foxRankBriefBoost');
let foxRankBriefClose = document.getElementById('foxRankBriefClose');
let foxRankBriefOpenDetail = document.getElementById('foxRankBriefOpenDetail');
let sidebarFoxDivider = null;
let noticePopTimer = null;
let topNavOverflowRaf = null;
let foxRankActiveTab = 'log';

let statusRunning = document.getElementById('statusRunning');
let statusVersion = document.getElementById('statusVersion');
let statusKernelPath = document.getElementById('statusKernelPath');
let statusConfig = document.getElementById('statusConfig');
let statusKernelPathRow = document.getElementById('statusKernelPathRow');
let statusConfigRow = document.getElementById('statusConfigRow');
let statusPill = document.getElementById('statusPill');
let overviewUptime = document.getElementById('overviewUptime');
let overviewConnections = document.getElementById('overviewConnections');
let overviewMemory = document.getElementById('overviewMemory');
let overviewStatus = document.getElementById('overviewStatus');
let overviewKernel = document.getElementById('overviewKernel');
let overviewKernelCopy = document.getElementById('overviewKernelCopy');
let overviewSystem = document.getElementById('overviewSystem');
let overviewVersion = document.getElementById('overviewVersion');
let overviewInternet = document.getElementById('overviewInternet');
let overviewDns = document.getElementById('overviewDns');
let overviewRouter = document.getElementById('overviewRouter');
let overviewNetwork = document.getElementById('overviewNetwork');
let overviewLocalIp = document.getElementById('overviewLocalIp');
let overviewProxyIp = document.getElementById('overviewProxyIp');
let overviewInternetIp = document.getElementById('overviewInternetIp');
let overviewLocalIpCopy = document.getElementById('overviewLocalIpCopy');
let overviewProxyIpCopy = document.getElementById('overviewProxyIpCopy');
let overviewInternetIpCopy = document.getElementById('overviewInternetIpCopy');
let overviewConnCurrent = document.getElementById('overviewConnCurrent');
let overviewConnPeak = document.getElementById('overviewConnPeak');
let overviewConnAvg = document.getElementById('overviewConnAvg');
let overviewConnTrend = document.getElementById('overviewConnTrend');
let overviewConnLine = document.getElementById('overviewConnLine');
let overviewConnArea = document.getElementById('overviewConnArea');
let overviewProviderSubscriptionSummary = document.getElementById('overviewProviderSubscriptionSummary');
let overviewProviderSubscriptionList = document.getElementById('overviewProviderSubscriptionList');
let overviewRulesSwitch = document.getElementById('overviewRulesSwitch');
let overviewRulesMetrics = document.getElementById('overviewRulesMetrics');
let overviewRulesBehaviors = document.getElementById('overviewRulesBehaviors');
let overviewRulesChart = document.getElementById('overviewRulesChart');
let overviewRulesRecords = document.getElementById('overviewRulesRecords');
let overviewGrids = Array.from(document.querySelectorAll('.overview-drag-grid'));
let trafficSystemDownloadRate = document.getElementById('trafficSystemDownloadRate');
let trafficSystemDownloadTotal = document.getElementById('trafficSystemDownloadTotal');
let trafficSystemUploadRate = document.getElementById('trafficSystemUploadRate');
let trafficSystemUploadTotal = document.getElementById('trafficSystemUploadTotal');
let trafficTotalDownload = document.getElementById('trafficTotalDownload');
let trafficTotalUpload = document.getElementById('trafficTotalUpload');
let trafficUploadLine = document.getElementById('trafficUploadLine');
let trafficUploadArea = document.getElementById('trafficUploadArea');
let trafficDownloadLine = document.getElementById('trafficDownloadLine');
let trafficDownloadArea = document.getElementById('trafficDownloadArea');
let overviewTopologyStage = document.getElementById('overviewTopologyStage');
let overviewTopologySurface = document.getElementById('overviewTopologySurface');
let overviewTopologySvg = document.getElementById('overviewTopologySvg');
let overviewTopologyColumns = document.getElementById('overviewTopologyColumns');
let overviewTopologyEmpty = document.getElementById('overviewTopologyEmpty');
let overviewTopologyZoomBtn = document.getElementById('overviewTopologyZoomBtn');
let topologyZoomModal = document.getElementById('topologyZoomModal');
let topologyZoomClose = document.getElementById('topologyZoomClose');
let topologyZoomStage = document.getElementById('topologyZoomStage');
let topologyZoomSurface = document.getElementById('topologyZoomSurface');
let topologyZoomSvg = document.getElementById('topologyZoomSvg');
let topologyZoomColumns = document.getElementById('topologyZoomColumns');
let topologyZoomEmpty = document.getElementById('topologyZoomEmpty');
let topologyTooltip = null;
let topologyTooltipLifecycleBound = false;
let overviewSummaryConnections = document.getElementById('overviewSummaryConnections');
let overviewSummaryMemory = document.getElementById('overviewSummaryMemory');
let overviewSummaryDownloadTotal = document.getElementById('overviewSummaryDownloadTotal');
let overviewSummaryDownloadRate = document.getElementById('overviewSummaryDownloadRate');
let overviewSummaryUploadTotal = document.getElementById('overviewSummaryUploadTotal');
let overviewSummaryUploadRate = document.getElementById('overviewSummaryUploadRate');
let trafficUploadAxis = [];
let trafficDownloadAxis = [];
let tunToggle = document.getElementById('tunToggle');
let tunStackSelect = document.getElementById('tunStackSelect');
let tunSynced = false;

function getMihomoApiSource() {
  return resolveMihomoApiSourceFromState(state);
}

function stopMihomoConnectionsReconnect() {
  if (state.mihomoConnectionsReconnectTimer) {
    clearTimeout(state.mihomoConnectionsReconnectTimer);
    state.mihomoConnectionsReconnectTimer = null;
  }
}

function closeMihomoConnectionsSocket() {
  stopMihomoConnectionsReconnect();
  const socket = state.mihomoConnectionsSocket;
  state.mihomoConnectionsSocket = null;
  state.mihomoConnectionsLive = false;
  state.lastMihomoConnectionsAt = 0;
  state.mihomoConnectionsSocketUrl = '';
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

function scheduleMihomoConnectionsReconnect() {
  if (currentPage !== 'overview') {
    return;
  }
  stopMihomoConnectionsReconnect();
  const attempt = Math.max(0, Number(state.mihomoConnectionsReconnectAttempts || 0));
  const delay = Math.min(
    MIHOMO_CONNECTIONS_RECONNECT_MAX_MS,
    MIHOMO_CONNECTIONS_RECONNECT_BASE_MS * Math.max(1, 2 ** attempt),
  );
  state.mihomoConnectionsReconnectTimer = setTimeout(() => {
    state.mihomoConnectionsReconnectTimer = null;
    connectMihomoConnectionsStream();
  }, delay);
}

function shouldUseOverviewConnectionsFallback() {
  return !state.mihomoConnectionsLive;
}

function stopMihomoTrafficReconnect() {
  if (state.mihomoTrafficReconnectTimer) {
    clearTimeout(state.mihomoTrafficReconnectTimer);
    state.mihomoTrafficReconnectTimer = null;
  }
}

function closeMihomoTrafficSocket() {
  stopMihomoTrafficReconnect();
  const socket = state.mihomoTrafficSocket;
  state.mihomoTrafficSocket = null;
  state.mihomoTrafficLive = false;
  state.lastMihomoTrafficAt = 0;
  state.mihomoTrafficSocketUrl = '';
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

function scheduleMihomoTrafficReconnect() {
  if (currentPage !== 'overview') {
    return;
  }
  stopMihomoTrafficReconnect();
  const attempt = Math.max(0, Number(state.mihomoTrafficReconnectAttempts || 0));
  const delay = Math.min(
    MIHOMO_TRAFFIC_RECONNECT_MAX_MS,
    MIHOMO_TRAFFIC_RECONNECT_BASE_MS * Math.max(1, 2 ** attempt),
  );
  state.mihomoTrafficReconnectTimer = setTimeout(() => {
    state.mihomoTrafficReconnectTimer = null;
    connectMihomoTrafficStream();
  }, delay);
}

function shouldUseOverviewTrafficFallback() {
  return !state.mihomoTrafficLive;
}

function stopMihomoMemoryReconnect() {
  if (state.mihomoMemoryReconnectTimer) {
    clearTimeout(state.mihomoMemoryReconnectTimer);
    state.mihomoMemoryReconnectTimer = null;
  }
}

function closeMihomoMemorySocket() {
  stopMihomoMemoryReconnect();
  const socket = state.mihomoMemorySocket;
  state.mihomoMemorySocket = null;
  state.mihomoMemorySocketUrl = '';
  state.mihomoMemoryLive = false;
  state.lastMihomoMemoryAt = 0;
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

function scheduleMihomoMemoryReconnect() {
  if (currentPage !== 'overview') {
    return;
  }
  stopMihomoMemoryReconnect();
  const attempt = Math.max(0, Number(state.mihomoMemoryReconnectAttempts || 0));
  const delay = Math.min(
    MIHOMO_MEMORY_RECONNECT_MAX_MS,
    MIHOMO_MEMORY_RECONNECT_BASE_MS * Math.max(1, 2 ** attempt),
  );
  state.mihomoMemoryReconnectTimer = setTimeout(() => {
    state.mihomoMemoryReconnectTimer = null;
    connectMihomoMemoryStream();
  }, delay);
}

function shouldUseOverviewMemoryFallback() {
  return !state.mihomoMemoryLive;
}

function updateOverviewMemoryValue(inUseBytes) {
  const inUse = Number.parseFloat(inUseBytes);
  const value = Number.isFinite(inUse) && inUse >= 0
    ? formatBytes(inUse)
    : '-';
  if (!overviewMemory && !overviewSummaryMemory) {
    return;
  }
  if (overviewMemory) {
    setNodeTextIfChanged(overviewMemory, value);
  }
  if (overviewSummaryMemory) {
    setNodeTextIfChanged(overviewSummaryMemory, value);
  }
}

function escapeTopologyText(value = '') {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeTopologyXml(value = '') {
  return escapeTopologyText(value);
}

function truncateTopologyLabel(value = '', maxLength = 24) {
  const text = String(value || '').trim();
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, Math.max(1, maxLength - 1))}…`;
}

function clampTopologyNumber(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function estimateTopologyNodeWidth(columnKey = '', title = '', subtitle = '') {
  const basis = Math.max(String(title || '').length, Math.round(String(subtitle || '').length * 0.82));
  if (columnKey === 'source') {
    return clampTopologyNumber(84 + (basis * 5.5), 118, 220);
  }
  if (columnKey === 'rule') {
    return clampTopologyNumber(76 + (basis * 4.8), 100, 172);
  }
  if (columnKey === 'outbound') {
    return clampTopologyNumber(72 + (basis * 4.5), 92, 148);
  }
  return clampTopologyNumber(68 + (basis * 4.2), 86, 126);
}

function estimateTopologyNodeHeight(columnKey = '', title = '', subtitle = '', fallback = 22) {
  const titleLen = String(title || '').length;
  const subtitleLen = String(subtitle || '').length;
  const titleLines = columnKey === 'target'
    ? 1
    : Math.max(1, Math.min(2, Math.ceil(titleLen / (columnKey === 'source' ? 22 : 16))));
  const hasSubtitle = Boolean(String(subtitle || '').trim());
  const subtitleLines = hasSubtitle
    ? Math.max(1, Math.min(2, Math.ceil(subtitleLen / (columnKey === 'source' ? 20 : 18))))
    : 0;
  const vertical = 10 + (titleLines * 14) + (subtitleLines ? ((subtitleLines * 11) + 4) : 0) + 8;
  const minHeight = columnKey === 'target' ? 18 : fallback;
  const maxHeight = columnKey === 'source' ? 96 : (columnKey === 'rule' ? 86 : 72);
  return clampTopologyNumber(vertical, minHeight, maxHeight);
}

function pruneTopologyEvents(now = Date.now()) {
  const next = (Array.isArray(state.topologyEvents) ? state.topologyEvents : [])
    .filter((item) => item && (now - Number(item.at || 0)) <= TOPOLOGY_EVENT_TTL_MS)
    .slice(0, TOPOLOGY_EVENT_LIMIT);
  state.topologyEvents = next;
  return next;
}

function computeTopologyAgeOpacity(timestamp = 0, now = Date.now()) {
  const age = Math.max(0, now - Number(timestamp || 0));
  const ratio = Math.max(0, Math.min(1, 1 - (age / TOPOLOGY_EVENT_TTL_MS)));
  return 0.18 + ratio * 0.72;
}

function buildTopologyColumnLayout(rows = [], columnKey = '', height = 286, gap = 6) {
  const normalizedWeights = rows.map((row) => Math.max(0.4, Math.pow(Math.max(1, Number(row.weight || 0)), 1.05)));
  const total = normalizedWeights.reduce((sum, weight) => sum + weight, 0) || rows.length || 1;
  const minHeight = columnKey === 'target' ? 14 : 22;
  const measuredHeights = rows.map((row) => estimateTopologyNodeHeight(columnKey, row.label || '', row.subLabel || '', minHeight));
  const fixedHeight = measuredHeights.reduce((sum, item) => sum + item, 0) + (Math.max(0, rows.length - 1) * gap);
  const availableHeight = Math.max(minHeight, height - Math.max(0, rows.length - 1) * gap);
  const totalNodeHeight = measuredHeights.reduce((sum, item) => sum + item, 0) + (Math.max(0, rows.length - 1) * gap);
  let cursorY = Math.max(0, Math.round((height - totalNodeHeight) / 2));
  return rows.map((row, index) => {
    const ratio = normalizedWeights[index] / total;
    const weightedHeight = Math.max(minHeight, Math.round(availableHeight * ratio));
    const measuredHeight = measuredHeights[index] || minHeight;
    const nodeHeight = fixedHeight <= height ? measuredHeight : Math.max(minHeight, Math.min(weightedHeight, measuredHeight));
    const nodeWidth = estimateTopologyNodeWidth(columnKey, row.label || '', row.subLabel || '');
    const next = {
      ...row,
      columnKey,
      top: cursorY,
      height: nodeHeight,
      centerY: cursorY + (nodeHeight / 2),
      boxWidth: nodeWidth,
    };
    cursorY += nodeHeight + gap;
    return next;
  });
}

function buildTopologyBandPathFromAnchors(fromX, toX, fromCenterY, toCenterY) {
  const x1 = fromX;
  const y1 = fromCenterY;
  const x2 = toX;
  const y2 = toCenterY;
  const dx = Math.max(18, (x2 - x1) * 0.34);
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

function aggregateTopologyStageLinks(rows = [], fromKey = '', toKey = '') {
  const map = new Map();
  rows.forEach((row) => {
    const fromId = String(row?.[fromKey] || '');
    const toId = String(row?.[toKey] || '');
    if (!fromId || !toId) return;
    const aggregateKey = `${fromId}=>${toId}`;
    const next = map.get(aggregateKey) || {
      key: aggregateKey,
      fromId,
      toId,
      hits: 0,
      at: 0,
    };
    next.hits += Math.max(1, Number(row.hits || 1));
    next.at = Math.max(next.at, Number(row.at || 0));
    map.set(aggregateKey, next);
  });
  return Array.from(map.values());
}

function allocateTopologyLinkSlots(links = [], nodes = [], nodeField = '') {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const allocations = new Map();
  const groups = new Map();
  links.forEach((link) => {
    const nodeId = String(link?.[nodeField] || '');
    if (!nodeId) return;
    const bucket = groups.get(nodeId) || [];
    bucket.push(link);
    groups.set(nodeId, bucket);
  });
  groups.forEach((groupLinks, nodeId) => {
    const node = nodeMap.get(nodeId);
    if (!node) return;
    const sorted = groupLinks.slice().sort((a, b) => {
      const aSort = Number(a.sortCenterY ?? 0);
      const bSort = Number(b.sortCenterY ?? 0);
      if (aSort !== bSort) return aSort - bSort;
      const aHits = Number(a.hits || 0);
      const bHits = Number(b.hits || 0);
      if (aHits !== bHits) return bHits - aHits;
      return String(a.key || '').localeCompare(String(b.key || ''));
    });
    const padding = clampTopologyNumber(Math.round(node.height * 0.14), 2, 8);
    const startY = node.top + padding;
    const endY = node.top + node.height - padding;
    const usableSpan = Math.max(2, endY - startY);
    const slotStep = sorted.length > 1 ? usableSpan / (sorted.length - 1) : 0;
    sorted.forEach((link, index) => {
      const centerY = sorted.length === 1
        ? node.centerY
        : clampTopologyNumber(startY + (slotStep * index), node.top + 1.5, node.top + node.height - 1.5);
      allocations.set(link.key, { centerY });
    });
  });
  return allocations;
}

function ensureTopologySvgLayers(svgEl = overviewTopologySvg) {
  if (!svgEl) {
    return null;
  }
  let staticDefs = svgEl.querySelector('defs[data-topology-static="true"]');
  if (!staticDefs) {
    staticDefs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    staticDefs.setAttribute('data-topology-static', 'true');
    staticDefs.innerHTML = '<filter id="topologyGlow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="3" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>';
    svgEl.appendChild(staticDefs);
  }
  let dynamicDefs = svgEl.querySelector('defs[data-topology-dynamic="true"]');
  if (!dynamicDefs) {
    dynamicDefs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    dynamicDefs.setAttribute('data-topology-dynamic', 'true');
    svgEl.appendChild(dynamicDefs);
  }
  let linksLayer = svgEl.querySelector('g[data-topology-links="true"]');
  if (!linksLayer) {
    linksLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    linksLayer.setAttribute('data-topology-links', 'true');
    svgEl.appendChild(linksLayer);
  }
  return { dynamicDefs, linksLayer };
}

function setTopologyLinksMarkup(payload = '', svgEl = overviewTopologySvg) {
  if (!svgEl) {
    return;
  }
  const layers = ensureTopologySvgLayers(svgEl);
  if (!layers) {
    return;
  }
  const { dynamicDefs, linksLayer } = layers;
  if (!payload) {
    dynamicDefs.innerHTML = '';
    linksLayer.innerHTML = '';
    bindTopologySurfaceInteractions(svgEl);
    return;
  }
  if (typeof payload === 'string') {
    dynamicDefs.innerHTML = '';
    linksLayer.innerHTML = payload;
    bindTopologySurfaceInteractions(svgEl);
    return;
  }
  dynamicDefs.innerHTML = String(payload.defsMarkup || '');
  linksLayer.innerHTML = String(payload.pathsMarkup || '');
  bindTopologySurfaceInteractions(svgEl);
}

function setTopologyColumnsMarkup(columnsMarkup = '', columnsEl = overviewTopologyColumns) {
  if (columnsEl) {
    columnsEl.innerHTML = columnsMarkup;
    bindTopologySurfaceInteractions(columnsEl);
  }
}

function buildTopologySurfaceSignature(columns = {}, tooltipMap = new Map()) {
  const columnKeys = ['source', 'rule', 'outbound', 'target'];
  return columnKeys.map((columnKey) => {
    const items = Array.isArray(columns[columnKey]) ? columns[columnKey] : [];
    return `${columnKey}:${items.map((item) => {
      const tooltipData = tooltipMap.get(`${columnKey}:${item.id}`);
      const tooltip = tooltipData
        ? formatTopologyTooltipText(tooltipData.from, tooltipData.to, tooltipData.hits)
        : [String(item.label || '').trim(), String(item.subLabel || '').trim()].filter(Boolean).join(' · ');
      return [
        item.id,
        item.top,
        item.height,
        item.boxWidth,
        item.label || '',
        item.subLabel || '',
        item.primaryKey || '',
        tooltip || '',
      ].join('|');
    }).join(';')}`;
  }).join('#');
}

function buildTopologyLinkSignature({
  measured = null,
  sourceRuleLinks = [],
  ruleOutboundLinks = [],
  outboundTargetLinks = [],
  activeState = null,
} = {}) {
  const encodeNodeMap = (items = []) => items.map((item) => [
    item.id,
    Math.round(Number(item.top || 0)),
    Math.round(Number(item.height || 0)),
    Math.round(Number(item.leftAnchorX || 0)),
    Math.round(Number(item.rightAnchorX || 0)),
  ].join('|')).join(';');
  const encodeLinks = (items = []) => items.map((item) => [
    item.key,
    Number(item.hits || 0),
    Math.round(Number(item.sortCenterY || 0)),
    Math.round(Number(item.at || 0) / 1000),
  ].join('|')).join(';');
  const activeLinkKeys = Array.from(activeState?.activeLinkKeys || []).sort().join(',');
  return [
    encodeNodeMap(measured?.columns?.source || []),
    encodeNodeMap(measured?.columns?.rule || []),
    encodeNodeMap(measured?.columns?.outbound || []),
    encodeNodeMap(measured?.columns?.target || []),
    encodeLinks(sourceRuleLinks),
    encodeLinks(ruleOutboundLinks),
    encodeLinks(outboundTargetLinks),
    String(activeState?.activeKey || ''),
    activeLinkKeys,
    activeState?.hasActive ? '1' : '0',
  ].join('#');
}

function applyTopologyNodeActiveState(columnsEl = overviewTopologyColumns, activeState = null) {
  if (!columnsEl) {
    return;
  }
  const activeRows = Array.isArray(activeState?.rows) ? activeState.rows : [];
  const activeNodeIds = activeState?.nodeIds || null;
  const hasActive = Boolean(activeState?.hasActive);
  columnsEl.querySelectorAll('.topology-node-card[data-column-key][data-node-id]').forEach((nodeEl) => {
    const columnKey = String(nodeEl.getAttribute('data-column-key') || '');
    const nodeId = String(nodeEl.getAttribute('data-node-id') || '');
    const nodeIsActive = activeRows.some((row) => (
      columnKey === 'target'
        ? row.targetId === nodeId
        : row[`${columnKey}Id`] === nodeId
    )) || (activeNodeIds ? activeNodeIds.has(nodeId) : false);
    nodeEl.classList.toggle('is-active', hasActive && nodeIsActive);
    nodeEl.classList.toggle('is-dimmed', hasActive && !nodeIsActive);
  });
}

function setTopologyMarkup({ linksMarkup = '', columnsMarkup = '' } = {}, hasData = false, targets = {}) {
  const {
    svgEl = overviewTopologySvg,
    columnsEl = overviewTopologyColumns,
    emptyEl = overviewTopologyEmpty,
  } = targets;
  setTopologyLinksMarkup(linksMarkup, svgEl);
  setTopologyColumnsMarkup(columnsMarkup, columnsEl);
  if (!hasData) {
    hideTopologyTooltip();
    setTopologyHoverKey('');
  }
  if (emptyEl) {
    emptyEl.hidden = hasData;
    if (!hasData) {
      emptyEl.textContent = ti('status.topologyEmpty', 'No live request path yet');
    }
  }
}

function setTopologyHoverKey(nextKey = '') {
  const normalized = String(nextKey || '');
  if (String(state.topologyHoverKey || '') === normalized) {
    return;
  }
  state.topologyHoverKey = normalized;
  renderTopologyCard();
}

function ensureTopologyTooltip() {
  if (topologyTooltip && document.body && document.body.contains(topologyTooltip)) {
    return topologyTooltip;
  }
  if (!document.body) {
    return null;
  }
  topologyTooltip = document.createElement('div');
  topologyTooltip.className = 'topology-hover-tooltip';
  topologyTooltip.hidden = true;
  document.body.appendChild(topologyTooltip);
  bindTopologyTooltipLifecycle();
  return topologyTooltip;
}

function bindTopologyTooltipLifecycle() {
  if (topologyTooltipLifecycleBound) {
    return;
  }
  topologyTooltipLifecycleBound = true;
  window.addEventListener('blur', () => {
    hideTopologyTooltip();
    setTopologyHoverKey('');
  });
  window.addEventListener('scroll', () => {
    hideTopologyTooltip();
  }, true);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      hideTopologyTooltip();
      setTopologyHoverKey('');
    }
  });
  document.addEventListener('pointerdown', () => {
    hideTopologyTooltip();
  }, true);
  document.addEventListener('mouseleave', () => {
    hideTopologyTooltip();
    setTopologyHoverKey('');
  });
}

function closeTopologyZoomModal() {
  if (!topologyZoomModal) return;
  topologyZoomModal.hidden = true;
  document.body.classList.remove('topology-zoom-open');
}

function openTopologyZoomModal() {
  if (!topologyZoomModal) return;
  topologyZoomModal.hidden = false;
  document.body.classList.add('topology-zoom-open');
  renderTopologyCard();
}

function bindTopologyZoomModal() {
  if (overviewTopologyZoomBtn && overviewTopologyZoomBtn.dataset.bound !== 'true') {
    overviewTopologyZoomBtn.dataset.bound = 'true';
    overviewTopologyZoomBtn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      openTopologyZoomModal();
    });
  }
  if (topologyZoomClose && topologyZoomClose.dataset.bound !== 'true') {
    topologyZoomClose.dataset.bound = 'true';
    topologyZoomClose.addEventListener('click', (event) => {
      event.preventDefault();
      closeTopologyZoomModal();
    });
  }
  if (topologyZoomModal && topologyZoomModal.dataset.bound !== 'true') {
    topologyZoomModal.dataset.bound = 'true';
    topologyZoomModal.addEventListener('click', (event) => {
      if (event.target === topologyZoomModal || event.target.classList.contains('topology-zoom-backdrop')) {
        closeTopologyZoomModal();
      }
    });
  }
  if (document.body && document.body.dataset.topologyZoomBound !== 'true') {
    document.body.dataset.topologyZoomBound = 'true';
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && topologyZoomModal && !topologyZoomModal.hidden) {
        closeTopologyZoomModal();
      }
    });
  }
}

function hideTopologyTooltip() {
  const tip = ensureTopologyTooltip();
  if (!tip) return;
  tip.hidden = true;
  tip.textContent = '';
}

function positionTopologyTooltip(clientX, clientY) {
  const tip = ensureTopologyTooltip();
  if (!tip || tip.hidden) return;
  const gap = 14;
  const rect = tip.getBoundingClientRect();
  const maxLeft = Math.max(12, window.innerWidth - rect.width - 12);
  const maxTop = Math.max(12, window.innerHeight - rect.height - 12);
  const left = Math.min(maxLeft, Math.max(12, clientX + gap));
  const top = clientY + rect.height + gap > window.innerHeight
    ? Math.max(12, clientY - rect.height - gap)
    : Math.min(maxTop, Math.max(12, clientY + gap));
  tip.style.left = `${Math.round(left)}px`;
  tip.style.top = `${Math.round(top)}px`;
}

function showTopologyTooltip(text = '', clientX = 0, clientY = 0) {
  const value = String(text || '').trim();
  const tip = ensureTopologyTooltip();
  if (!tip || !value) {
    hideTopologyTooltip();
    return;
  }
  tip.textContent = value;
  tip.hidden = false;
  positionTopologyTooltip(clientX, clientY);
}

function bindTopologySurfaceInteractions(surface) {
  if (!surface || surface.dataset.boundTopologyHover === 'true') {
    return;
  }
  surface.dataset.boundTopologyHover = 'true';
  surface.addEventListener('mouseover', (event) => {
    const hoverTarget = event.target && typeof event.target.closest === 'function'
      ? event.target.closest('[data-topology-tooltip]')
      : null;
    if (hoverTarget) {
      showTopologyTooltip(
        hoverTarget.getAttribute('data-topology-tooltip') || '',
        Number(event.clientX || 0),
        Number(event.clientY || 0),
      );
    }
    const node = event.target && typeof event.target.closest === 'function'
      ? event.target.closest('.topology-node-card[data-column-key][data-node-id]')
      : null;
    if (node) {
      const columnKey = String(node.getAttribute('data-column-key') || '');
      const nodeId = String(node.getAttribute('data-node-id') || '');
      if (columnKey && nodeId) {
        setTopologyHoverKey(`node:${columnKey}:${nodeId}`);
        return;
      }
    }
    const target = event.target && typeof event.target.closest === 'function'
      ? event.target.closest('[data-topology-key]')
      : null;
    if (target) {
      setTopologyHoverKey(`link:${target.getAttribute('data-topology-key') || ''}`);
    }
  });
  surface.addEventListener('mousemove', (event) => {
    const hoverTarget = event.target && typeof event.target.closest === 'function'
      ? event.target.closest('[data-topology-tooltip]')
      : null;
    if (!hoverTarget) {
      hideTopologyTooltip();
      return;
    }
    showTopologyTooltip(
      hoverTarget.getAttribute('data-topology-tooltip') || '',
      Number(event.clientX || 0),
      Number(event.clientY || 0),
    );
  });
  surface.addEventListener('focusin', (event) => {
    const hoverTarget = event.target && typeof event.target.closest === 'function'
      ? event.target.closest('[data-topology-tooltip]')
      : null;
    if (hoverTarget) {
      const rect = hoverTarget.getBoundingClientRect();
      showTopologyTooltip(
        hoverTarget.getAttribute('data-topology-tooltip') || '',
        rect.left + (rect.width / 2),
        rect.top + (rect.height / 2),
      );
    }
    const node = event.target && typeof event.target.closest === 'function'
      ? event.target.closest('.topology-node-card[data-column-key][data-node-id]')
      : null;
    if (node) {
      const columnKey = String(node.getAttribute('data-column-key') || '');
      const nodeId = String(node.getAttribute('data-node-id') || '');
      if (columnKey && nodeId) {
        setTopologyHoverKey(`node:${columnKey}:${nodeId}`);
        return;
      }
    }
    const target = event.target && typeof event.target.closest === 'function'
      ? event.target.closest('[data-topology-key]')
      : null;
    if (target) {
      setTopologyHoverKey(`link:${target.getAttribute('data-topology-key') || ''}`);
    }
  });
  surface.addEventListener('mouseleave', () => {
    hideTopologyTooltip();
    setTopologyHoverKey('');
  });
  surface.addEventListener('focusout', (event) => {
    if (!surface.contains(event.relatedTarget)) {
      hideTopologyTooltip();
      setTopologyHoverKey('');
    }
  });
}

function measureTopologyDomGeometry(svgEl = overviewTopologySvg, columnsEl = overviewTopologyColumns) {
  if (!svgEl || !columnsEl) {
    return null;
  }
  const svgRect = svgEl.getBoundingClientRect();
  if (!svgRect.width || !svgRect.height) {
    return null;
  }
  svgEl.setAttribute('viewBox', `0 0 ${Math.round(svgRect.width)} ${Math.round(svgRect.height)}`);
  const columns = {
    source: [],
    rule: [],
    outbound: [],
    target: [],
  };
  columnsEl.querySelectorAll('.topology-node-card[data-column-key][data-node-id]').forEach((nodeEl) => {
    const columnKey = String(nodeEl.getAttribute('data-column-key') || '');
    const nodeId = String(nodeEl.getAttribute('data-node-id') || '');
    if (!columns[columnKey] || !nodeId) {
      return;
    }
    const rect = nodeEl.getBoundingClientRect();
    const top = rect.top - svgRect.top;
    const height = rect.height;
    columns[columnKey].push({
      id: nodeId,
      top,
      height,
      centerY: top + (height / 2),
      leftAnchorX: (rect.left - svgRect.left) + 3,
      rightAnchorX: (rect.right - svgRect.left) - 3,
    });
  });
  return {
    width: svgRect.width,
    height: svgRect.height,
    columns,
  };
}

function buildTopologyViewModel(events = []) {
  const rows = Array.isArray(events) ? events.slice(0, TOPOLOGY_EVENT_LIMIT) : [];
  if (!rows.length) {
    return null;
  }
  const sourceMap = new Map();
  const ruleMap = new Map();
  const outboundMap = new Map();
  const targetMap = new Map();
  const inc = (map, id, label, subLabel, weight) => {
    const existing = map.get(id) || { id, label, subLabel, weight: 0 };
    existing.weight += weight;
    if (!existing.label && label) existing.label = label;
    if (!existing.subLabel && subLabel) existing.subLabel = subLabel;
    map.set(id, existing);
  };
  rows.forEach((row) => {
    const weight = Number(row.hits || 1) || 1;
    inc(sourceMap, row.sourceId, row.sourceMain, row.sourceSub, weight);
    inc(ruleMap, row.ruleId, row.ruleLabel, row.ruleSub, weight);
    inc(outboundMap, row.outboundId, row.outboundMain, row.outboundSub, weight);
    inc(targetMap, row.targetId, row.destinationMain, row.destinationSub, weight);
  });
  const sortByWeight = (a, b) => Number(b.weight || 0) - Number(a.weight || 0);
  const sourceNodes = Array.from(sourceMap.values()).sort(sortByWeight);
  const ruleNodes = Array.from(ruleMap.values()).sort(sortByWeight);
  const outboundNodes = Array.from(outboundMap.values()).sort(sortByWeight);
  const targetNodes = Array.from(targetMap.values()).sort(sortByWeight);
  return { rows, sourceNodes, ruleNodes, outboundNodes, targetNodes };
}

function buildTopologyNodeTooltipMap(model = null) {
  const tips = new Map();
  if (!model || !Array.isArray(model.rows)) {
    return tips;
  }
  const bestBy = (rows, fromKey, toMainKey, getMapKey) => {
    const grouped = new Map();
    rows.forEach((row) => {
      const mapKey = getMapKey(row);
      if (!mapKey) return;
      const current = grouped.get(mapKey);
      const nextHits = Math.max(1, Number(row.hits || 1));
      if (!current || nextHits > current.hits) {
        grouped.set(mapKey, {
          from: row[fromKey] || '',
          to: row[toMainKey] || '',
          hits: nextHits,
        });
      }
    });
    return grouped;
  };
  const sourceTips = bestBy(model.rows, 'sourceMain', 'ruleLabel', (row) => `source:${row.sourceId}`);
  const ruleTips = bestBy(model.rows, 'ruleLabel', 'outboundMain', (row) => `rule:${row.ruleId}`);
  const outboundTips = bestBy(model.rows, 'outboundMain', 'destinationMain', (row) => `outbound:${row.outboundId}`);
  const targetTips = bestBy(model.rows, 'outboundMain', 'destinationMain', (row) => `target:${row.targetId}`);
  [sourceTips, ruleTips, outboundTips, targetTips].forEach((grouped) => {
    grouped.forEach((value, key) => tips.set(key, value));
  });
  return tips;
}

function formatTopologyTooltipText(fromLabel = '', toLabel = '', hits = 0) {
  const from = String(fromLabel || '').trim();
  const to = String(toLabel || '').trim();
  void hits;
  return `${from} \u2192 ${to}`;
}

function buildTopologyRealtimeCountMaps(connections = []) {
  const maps = {
    sourceRule: new Map(),
    ruleOutbound: new Map(),
    outboundTarget: new Map(),
  };
  if (!Array.isArray(connections) || !connections.length) {
    return maps;
  }
  connections.forEach((item) => {
    const metadata = item && item.metadata ? item.metadata : {};
    const processName = String(metadata.process || '').trim();
    const sourceIp = String(metadata.sourceIP || '').trim();
    const sourceId = processName || sourceIp || 'source';
    const ruleId = String(item.rule || '').trim() || String(metadata.specialRules || '').trim() || 'rule';
    const chains = Array.isArray(item.chains) ? item.chains.filter(Boolean).map((value) => String(value).trim()).filter(Boolean) : [];
    const outboundId = chains.length ? chains[chains.length - 1] : 'outbound';
    const host = String(metadata.host || '').trim();
    const port = String(metadata.destinationPort || '').trim();
    const targetId = host ? `${host}${port ? `:${port}` : ''}` : String(metadata.remoteDestination || '').trim() || 'destination';
    const pairs = [
      [maps.sourceRule, `${sourceId}=>${ruleId}`],
      [maps.ruleOutbound, `${ruleId}=>${outboundId}`],
      [maps.outboundTarget, `${outboundId}=>${targetId}`],
    ];
    pairs.forEach(([map, key]) => {
      map.set(key, Number(map.get(key) || 0) + 1);
    });
  });
  return maps;
}

function buildTopologyColumnsMarkup(columns = {}, activeState = null, tooltipMap = new Map()) {
  const columnDefs = [
    { key: 'source', title: ti('status.topologySource', 'Source') },
    { key: 'rule', title: ti('status.topologyRuleMatch', 'Rule Match') },
    { key: 'outbound', title: ti('status.topologyOutbound', 'Outbound') },
    { key: 'target', title: ti('status.topologyDestination', 'Destination') },
  ];
  return columnDefs.map((column) => {
    const items = Array.isArray(columns[column.key]) ? columns[column.key] : [];
    const nodesMarkup = items.map((item) => {
      const activeRows = Array.isArray(activeState?.rows) ? activeState.rows : [];
      const activeNodeIds = activeState?.nodeIds || null;
      const nodeIsActive = activeRows.some((row) => (
        column.key === 'target'
          ? row.targetId === item.id
          : row[`${column.key}Id`] === item.id
      )) || (activeNodeIds ? activeNodeIds.has(item.id) : false);
      const nodeClass = activeState?.hasActive ? (nodeIsActive ? ' is-active' : ' is-dimmed') : '';
      const title = truncateTopologyLabel(item.label || '-', column.key === 'target' ? 34 : 24);
      const subtitle = truncateTopologyLabel(item.subLabel || '', column.key === 'target' ? 16 : 18);
      const showSub = Boolean(subtitle) && item.height >= (column.key === 'target' ? 22 : 40);
      const tooltipData = tooltipMap.get(`${column.key}:${item.id}`);
      const tooltip = tooltipData
        ? formatTopologyTooltipText(tooltipData.from, tooltipData.to, tooltipData.hits)
        : [String(item.label || '').trim(), String(item.subLabel || '').trim()].filter(Boolean).join(' · ');
      return `<div class="topology-node-card ${column.key}${nodeClass}" data-column-key="${escapeTopologyXml(column.key)}" data-node-id="${escapeTopologyXml(item.id)}" data-topology-tooltip="${escapeTopologyXml(tooltip || item.label || '-')}" style="top:${item.top}px;height:${item.height}px;width:${item.boxWidth}px;"${item.primaryKey ? ` data-topology-key="${escapeTopologyXml(item.primaryKey)}"` : ''}>
        <div class="topology-node-title">${escapeTopologyXml(title)}</div>
        ${showSub ? `<div class="topology-node-subtitle">${escapeTopologyXml(subtitle)}</div>` : ''}
      </div>`;
    }).join('');
    return `<section class="topology-column ${column.key}">
      <div class="topology-column-header">${escapeTopologyXml(column.title)}</div>
      <div class="topology-column-body">${nodesMarkup}</div>
    </section>`;
  }).join('');
}

function renderTopologySurface(model, activeState, targets = {}) {
  const {
    svgEl = overviewTopologySvg,
    columnsEl = overviewTopologyColumns,
    emptyEl = overviewTopologyEmpty,
  } = targets;
  if (!svgEl || !columnsEl) {
    return;
  }
  const surfaceHeight = Math.round(columnsEl.getBoundingClientRect().height || 0);
  const chartHeight = Math.max(286, surfaceHeight - 30);
  const gap = 6;
  columnsEl.style.setProperty('--topology-body-height', `${chartHeight}px`);
  const nodeTooltipMap = buildTopologyNodeTooltipMap(model);
  const columns = {
    source: buildTopologyColumnLayout(model.sourceNodes, 'source', chartHeight, gap)
      .map((item) => ({ ...item, primaryKey: model.rows.find((row) => row.sourceId === item.id)?.key || '' })),
    rule: buildTopologyColumnLayout(model.ruleNodes, 'rule', chartHeight, gap)
      .map((item) => ({ ...item, primaryKey: model.rows.find((row) => row.ruleId === item.id)?.key || '' })),
    outbound: buildTopologyColumnLayout(model.outboundNodes, 'outbound', chartHeight, gap)
      .map((item) => ({ ...item, primaryKey: model.rows.find((row) => row.outboundId === item.id)?.key || '' })),
    target: buildTopologyColumnLayout(model.targetNodes, 'target', chartHeight, 4)
      .map((item) => ({ ...item, primaryKey: model.rows.find((row) => row.targetId === item.id)?.key || '' })),
  };
  const surfaceKey = String(svgEl.id || columnsEl.id || 'topology-surface');
  const signature = buildTopologySurfaceSignature(columns, nodeTooltipMap);
  const expectedNodeCount = Object.values(columns).reduce((sum, items) => sum + (Array.isArray(items) ? items.length : 0), 0);
  const actualNodeCount = columnsEl.querySelectorAll('.topology-node-card[data-column-key][data-node-id]').length;
  const columnsChanged = state.topologySurfaceSignatures[surfaceKey] !== signature || actualNodeCount !== expectedNodeCount;
  if (columnsChanged) {
    const columnsMarkup = buildTopologyColumnsMarkup(columns, activeState, nodeTooltipMap);
    setTopologyColumnsMarkup(columnsMarkup, columnsEl);
    state.topologySurfaceSignatures[surfaceKey] = signature;
  } else {
    applyTopologyNodeActiveState(columnsEl, activeState);
  }
  const measured = measureTopologyDomGeometry(svgEl, columnsEl);
  if (!measured) {
    setTopologyLinksMarkup('', svgEl);
    if (emptyEl) emptyEl.hidden = true;
    return;
  }
  const now = Date.now();
  const sourceRuleLinks = aggregateTopologyStageLinks(model.rows, 'sourceId', 'ruleId');
  const ruleOutboundLinks = aggregateTopologyStageLinks(model.rows, 'ruleId', 'outboundId');
  const outboundTargetLinks = aggregateTopologyStageLinks(model.rows, 'outboundId', 'targetId');
  const realtimeCounts = buildTopologyRealtimeCountMaps(state.mihomoConnectionsSnapshot || []);
  sourceRuleLinks.forEach((link) => {
    link.hits = Math.max(1, Number(realtimeCounts.sourceRule.get(link.key) || link.hits || 1));
  });
  ruleOutboundLinks.forEach((link) => {
    link.hits = Math.max(1, Number(realtimeCounts.ruleOutbound.get(link.key) || link.hits || 1));
  });
  outboundTargetLinks.forEach((link) => {
    link.hits = Math.max(1, Number(realtimeCounts.outboundTarget.get(link.key) || link.hits || 1));
  });
  const sourceMap = new Map(measured.columns.source.map((item) => [item.id, item]));
  const ruleMap = new Map(measured.columns.rule.map((item) => [item.id, item]));
  const outboundMap = new Map(measured.columns.outbound.map((item) => [item.id, item]));
  const targetMap = new Map(measured.columns.target.map((item) => [item.id, item]));
  sourceRuleLinks.forEach((link) => {
    link.sortCenterY = ruleMap.get(link.toId)?.centerY ?? sourceMap.get(link.fromId)?.centerY ?? 0;
  });
  ruleOutboundLinks.forEach((link) => {
    link.sortCenterY = outboundMap.get(link.toId)?.centerY ?? ruleMap.get(link.fromId)?.centerY ?? 0;
  });
  outboundTargetLinks.forEach((link) => {
    link.sortCenterY = targetMap.get(link.toId)?.centerY ?? outboundMap.get(link.fromId)?.centerY ?? 0;
  });
  const sourceRuleFromSlots = allocateTopologyLinkSlots(sourceRuleLinks, measured.columns.source, 'fromId');
  const sourceRuleToSlots = allocateTopologyLinkSlots(sourceRuleLinks, measured.columns.rule, 'toId');
  const ruleOutboundFromSlots = allocateTopologyLinkSlots(ruleOutboundLinks, measured.columns.rule, 'fromId');
  const ruleOutboundToSlots = allocateTopologyLinkSlots(ruleOutboundLinks, measured.columns.outbound, 'toId');
  const outboundTargetFromSlots = allocateTopologyLinkSlots(outboundTargetLinks, measured.columns.outbound, 'fromId');
  const outboundTargetToSlots = allocateTopologyLinkSlots(outboundTargetLinks, measured.columns.target, 'toId');
  const linkSignature = buildTopologyLinkSignature({
    measured,
    sourceRuleLinks,
    ruleOutboundLinks,
    outboundTargetLinks,
    activeState,
  });
  if (state.topologyLinkSignatures[surfaceKey] === linkSignature) {
    if (emptyEl) {
      emptyEl.hidden = true;
    }
    return;
  }
  const defs = [];
  const paths = [];
  const activeKey = activeState?.activeKey || '';
  const activeLinkKeys = activeState?.activeLinkKeys || new Set();
  const hasActiveSelection = Boolean(activeState?.hasActive);
  const pushAggregatedBand = (links, fromMap, toMap, fromSlots, toSlots, stageClass, fromColor, toColor) => {
    links.forEach((link, index) => {
      const fromNode = fromMap.get(link.fromId);
      const toNode = toMap.get(link.toId);
      const fromSlot = fromSlots.get(link.key);
      const toSlot = toSlots.get(link.key);
      if (!fromNode || !toNode || !fromSlot || !toSlot) return;
      const fromY = fromSlot.centerY;
      const toY = toSlot.centerY;
      const width = Math.max(1.25, Math.min(16, 1 + (Math.log2(Math.max(1, link.hits)) * 2.4)));
      const opacity = computeTopologyAgeOpacity(link.at, now);
      const isActive = activeLinkKeys.has(link.key);
      const rowClass = hasActiveSelection ? (isActive ? ' is-active' : ' is-dimmed') : '';
      const visibleOpacity = hasActiveSelection ? (isActive ? Math.max(0.74, opacity) : Math.max(0.08, opacity * 0.18)) : opacity;
      const fromX = fromNode.rightAnchorX;
      const toX = toNode.leftAnchorX;
      const d = buildTopologyBandPathFromAnchors(fromX, toX, fromY, toY);
      const gradientId = `topologyStroke-${stageClass}-${index}-${svgEl.id || 'surface'}`;
      const fromLabel = String((model.rows.find((row) => (
        row[stageClass === 'source' ? 'sourceId' : stageClass === 'rule' ? 'ruleId' : 'outboundId'] === link.fromId
      ))?.[stageClass === 'source' ? 'sourceMain' : stageClass === 'rule' ? 'ruleLabel' : 'outboundMain']) || link.fromId);
      const toLabel = String((model.rows.find((row) => (
        row[stageClass === 'source' ? 'ruleId' : stageClass === 'rule' ? 'outboundId' : 'targetId'] === link.toId
      ))?.[stageClass === 'source' ? 'ruleLabel' : stageClass === 'rule' ? 'outboundMain' : 'destinationMain']) || link.toId);
      const tooltip = formatTopologyTooltipText(fromLabel, toLabel, link.hits);
      defs.push(`<linearGradient id="${gradientId}" gradientUnits="userSpaceOnUse" x1="${fromX.toFixed(2)}" y1="${fromY.toFixed(2)}" x2="${toX.toFixed(2)}" y2="${toY.toFixed(2)}"><stop offset="0%" stop-color="${fromColor}" stop-opacity="${visibleOpacity.toFixed(3)}"/><stop offset="100%" stop-color="${toColor}" stop-opacity="${visibleOpacity.toFixed(3)}"/></linearGradient>`);
      paths.push(`<path class="topology-link ${stageClass}${rowClass}" data-topology-key="${escapeTopologyXml(link.key)}" d="${d}" style="stroke:url(#${gradientId})" stroke-width="${width.toFixed(2)}" ${activeKey === link.key ? 'filter="url(#topologyGlow)"' : ''}/><path class="topology-link-hit" data-topology-key="${escapeTopologyXml(link.key)}" data-topology-tooltip="${escapeTopologyXml(tooltip)}" d="${d}" stroke-width="${Math.max(10, width + 5).toFixed(2)}" />`);
    });
  };
  pushAggregatedBand(sourceRuleLinks, sourceMap, ruleMap, sourceRuleFromSlots, sourceRuleToSlots, 'source', '#5978ff', '#9ec782');
  pushAggregatedBand(ruleOutboundLinks, ruleMap, outboundMap, ruleOutboundFromSlots, ruleOutboundToSlots, 'rule', '#9ec782', '#efcd69');
  pushAggregatedBand(outboundTargetLinks, outboundMap, targetMap, outboundTargetFromSlots, outboundTargetToSlots, 'outbound', '#efcd69', '#f29a9a');
  setTopologyLinksMarkup({
    defsMarkup: defs.join(''),
    pathsMarkup: paths.join(''),
  }, svgEl);
  state.topologyLinkSignatures[surfaceKey] = linkSignature;
  if (emptyEl) {
    emptyEl.hidden = true;
  }
}

function performTopologyRender() {
  if (!overviewTopologySvg || !overviewTopologyEmpty || !overviewTopologyColumns) {
    return;
  }
  const now = Date.now();
  const model = buildTopologyViewModel(pruneTopologyEvents(now));
  if (!model) {
    state.topologyHoverKey = '';
    state.topologySurfaceSignatures = {};
    state.topologyLinkSignatures = {};
    setTopologyMarkup({ linksMarkup: '', columnsMarkup: '' }, false, {
      svgEl: overviewTopologySvg,
      columnsEl: overviewTopologyColumns,
      emptyEl: overviewTopologyEmpty,
    });
    if (topologyZoomSvg && topologyZoomColumns && topologyZoomEmpty) {
      setTopologyMarkup({ linksMarkup: '', columnsMarkup: '' }, false, {
        svgEl: topologyZoomSvg,
        columnsEl: topologyZoomColumns,
        emptyEl: topologyZoomEmpty,
      });
    }
    return;
  }
  const hoverValue = String(state.topologyHoverKey || '');
  const isLinkHover = hoverValue.startsWith('link:');
  const isNodeHover = hoverValue.startsWith('node:');
  const activeKey = isLinkHover ? hoverValue.slice(5) : '';
  const activeLinkNodeIds = activeKey.includes('=>') ? activeKey.split('=>').filter(Boolean) : [];
  const hoveredNodeParts = isNodeHover ? hoverValue.split(':') : [];
  const hoveredColumnKey = hoveredNodeParts[1] || '';
  const hoveredNodeId = hoveredNodeParts.slice(2).join(':') || '';
  const activeRow = activeKey ? model.rows.find((row) => row.key === activeKey) : null;
  const activeRows = activeRow
    ? [activeRow]
    : (hoveredColumnKey && hoveredNodeId
      ? model.rows.filter((row) => {
        if (hoveredColumnKey === 'target') return row.targetId === hoveredNodeId;
        return row[`${hoveredColumnKey}Id`] === hoveredNodeId;
      })
      : []);
  const activeLinkKeys = new Set();
  const activeNodeIds = new Set(activeLinkNodeIds);
  activeRows.forEach((row) => {
    activeNodeIds.add(row.sourceId);
    activeNodeIds.add(row.ruleId);
    activeNodeIds.add(row.outboundId);
    activeNodeIds.add(row.targetId);
    activeLinkKeys.add(`${row.sourceId}=>${row.ruleId}`);
    activeLinkKeys.add(`${row.ruleId}=>${row.outboundId}`);
    activeLinkKeys.add(`${row.outboundId}=>${row.targetId}`);
  });
  if (activeKey) {
    activeLinkKeys.add(activeKey);
  }
  const hasActiveSelection = Boolean(activeRows.length || activeLinkKeys.size);
  const activeState = {
    rows: activeRows,
    nodeIds: activeNodeIds,
    hasActive: hasActiveSelection,
    activeKey,
    activeLinkKeys,
  };
  renderTopologySurface(model, activeState, {
    svgEl: overviewTopologySvg,
    columnsEl: overviewTopologyColumns,
    emptyEl: overviewTopologyEmpty,
  });
  if (topologyZoomModal && !topologyZoomModal.hidden) {
    renderTopologySurface(model, activeState, {
      svgEl: topologyZoomSvg,
      columnsEl: topologyZoomColumns,
      emptyEl: topologyZoomEmpty,
    });
  }
}

function renderTopologyCard(options = {}) {
  const immediate = Boolean(options && options.immediate);
  const delayMs = Number.isFinite(Number(options && options.delayMs)) ? Number(options.delayMs) : 240;
  if (immediate) {
    if (state.topologyRenderTimer) {
      clearTimeout(state.topologyRenderTimer);
      state.topologyRenderTimer = null;
    }
    if (state.topologyRenderRaf) {
      cancelAnimationFrame(state.topologyRenderRaf);
      state.topologyRenderRaf = null;
    }
    performTopologyRender();
    return;
  }
  if (state.topologyRenderTimer) {
    clearTimeout(state.topologyRenderTimer);
  }
  state.topologyRenderTimer = setTimeout(() => {
    state.topologyRenderTimer = null;
    if (state.topologyRenderRaf) {
      cancelAnimationFrame(state.topologyRenderRaf);
    }
    state.topologyRenderRaf = requestAnimationFrame(() => {
      state.topologyRenderRaf = null;
      performTopologyRender();
    });
  }, Math.max(120, delayMs));
}

function parseTopologyLogPayload(payload = '') {
  const text = String(payload || '').trim();
  if (!text) {
    return null;
  }
  const match = text.match(/^\[(?<network>[A-Z]+)\]\s+(?<source>[^ ]+?)(?:\((?<process>[^)]+)\))?\s+-->\s+(?<destination>[^ ]+)\s+match\s+(?<rule>.+?)\s+using\s+(?<outbound>.+)$/);
  if (!match || !match.groups) {
    return null;
  }
  const sourceEndpoint = String(match.groups.source || '').trim();
  const sourceProcess = String(match.groups.process || '').trim();
  const destination = String(match.groups.destination || '').trim();
  const outbound = String(match.groups.outbound || '').trim();
  const rule = String(match.groups.rule || '').trim();
  const network = String(match.groups.network || '').trim();
  const outboundGroupMatch = outbound.match(/^(.+?)\[(.+)\]$/);
  const outboundMain = outboundGroupMatch ? String(outboundGroupMatch[1] || '').trim() : outbound;
  const outboundLeaf = outboundGroupMatch ? String(outboundGroupMatch[2] || '').trim() : outbound;
  return {
    key: `${sourceEndpoint}|${sourceProcess}|${destination}|${outbound}`,
    sourceId: sourceProcess || sourceEndpoint || 'source',
    sourceMain: sourceProcess || sourceEndpoint || '-',
    sourceSub: sourceProcess ? sourceEndpoint : network || '-',
    ruleId: rule || 'rule',
    ruleLabel: rule || 'Match',
    ruleSub: network || '-',
    outboundId: outboundMain || outbound || 'outbound',
    outboundMain: outboundMain || outbound || '-',
    outboundSub: outboundLeaf && outboundLeaf !== outboundMain ? outboundLeaf : '',
    outbound: outbound || '-',
    targetId: destination || 'destination',
    destinationMain: destination || '-',
    destinationSub: network || '-',
    hits: 1,
    at: Date.now(),
  };
}

function stopMihomoLogsReconnect() {
  if (state.mihomoLogsReconnectTimer) {
    clearTimeout(state.mihomoLogsReconnectTimer);
    state.mihomoLogsReconnectTimer = null;
  }
}

function closeMihomoLogsSocket() {
  stopMihomoLogsReconnect();
  const socket = state.mihomoLogsSocket;
  state.mihomoLogsSocket = null;
  state.mihomoLogsSocketUrl = '';
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

function stopMihomoPageLogsReconnect() {
  if (state.mihomoPageLogsReconnectTimer) {
    clearTimeout(state.mihomoPageLogsReconnectTimer);
    state.mihomoPageLogsReconnectTimer = null;
  }
}

function closeMihomoPageLogsSocket() {
  stopMihomoPageLogsReconnect();
  const socket = state.mihomoPageLogsSocket;
  state.mihomoPageLogsSocket = null;
  state.mihomoPageLogsSocketUrl = '';
  state.mihomoPageLogsLive = false;
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

function getSelectedMihomoLogLevel() {
  const normalized = String((logLevelFilter && logLevelFilter.value) || 'info').trim().toLowerCase();
  if (!normalized) {
    return 'info';
  }
  return normalized;
}

function scheduleMihomoPageLogsReconnect() {
  stopMihomoPageLogsReconnect();
  const attempt = Math.max(0, Number(state.mihomoPageLogsReconnectAttempts || 0));
  const delay = Math.min(
    12000,
    1500 * Math.max(1, 2 ** attempt),
  );
  state.mihomoPageLogsReconnectTimer = setTimeout(() => {
    state.mihomoPageLogsReconnectTimer = null;
    connectMihomoPageLogsStream();
  }, delay);
}

function scheduleMihomoLogsReconnect() {
  if (currentPage !== 'overview') {
    return;
  }
  stopMihomoLogsReconnect();
  const attempt = Math.max(0, Number(state.mihomoLogsReconnectAttempts || 0));
  const delay = Math.min(
    MIHOMO_LOGS_RECONNECT_MAX_MS,
    MIHOMO_LOGS_RECONNECT_BASE_MS * Math.max(1, 2 ** attempt),
  );
  state.mihomoLogsReconnectTimer = setTimeout(() => {
    state.mihomoLogsReconnectTimer = null;
    connectMihomoLogsStream();
  }, delay);
}

function startTopologyTicker() {
  if (state.topologyTickTimer) {
    clearInterval(state.topologyTickTimer);
  }
  state.topologyTickTimer = setInterval(() => {
    if (currentPage !== 'overview') {
      return;
    }
    const before = Array.isArray(state.topologyEvents) ? state.topologyEvents.length : 0;
    const after = pruneTopologyEvents(Date.now()).length;
    if (before !== after || after > 0) {
      renderTopologyCard({ immediate: true });
    }
  }, 1000);
}

function stopTopologyTicker() {
  if (state.topologyTickTimer) {
    clearInterval(state.topologyTickTimer);
    state.topologyTickTimer = null;
  }
  if (state.topologyRenderTimer) {
    clearTimeout(state.topologyRenderTimer);
    state.topologyRenderTimer = null;
  }
  if (state.topologyRenderRaf) {
    cancelAnimationFrame(state.topologyRenderRaf);
    state.topologyRenderRaf = null;
  }
}

function handleMihomoLogsPayload(payload = '') {
  const parsed = parseTopologyLogPayload(payload);
  if (!parsed) {
    return;
  }
  state.mihomoLogsReconnectAttempts = 0;
  const existing = Array.isArray(state.topologyEvents)
    ? state.topologyEvents.find((item) => item && item.key === parsed.key)
    : null;
  if (existing) {
    existing.hits = Number(existing.hits || 1) + 1;
    existing.at = Date.now();
    existing.ruleLabel = parsed.ruleLabel;
    existing.ruleSub = parsed.ruleSub;
    existing.outboundMain = parsed.outboundMain;
    existing.outboundSub = parsed.outboundSub;
    existing.destinationMain = parsed.destinationMain;
    existing.destinationSub = parsed.destinationSub;
  } else {
    state.topologyEvents = [parsed, ...(state.topologyEvents || [])].slice(0, TOPOLOGY_EVENT_LIMIT);
  }
  state.topologyEvents = (state.topologyEvents || [])
    .slice()
    .sort((a, b) => Number(b.at || 0) - Number(a.at || 0))
    .slice(0, TOPOLOGY_EVENT_LIMIT);
  renderTopologyCard();
}

function connectMihomoLogsStream() {
  if (currentPage !== 'overview' || typeof WebSocket !== 'function') {
    return;
  }
  const nextUrl = resolveMihomoLogsWebSocketUrl(getMihomoApiSource(), 'info');
  if (!nextUrl) {
    closeMihomoLogsSocket();
    return;
  }
  const existing = state.mihomoLogsSocket;
  if (
    existing
    && state.mihomoLogsSocketUrl === nextUrl
    && (
      existing.readyState === WebSocket.OPEN
      || existing.readyState === WebSocket.CONNECTING
    )
  ) {
    return;
  }
  closeMihomoLogsSocket();
  let socket = null;
  try {
    socket = new WebSocket(nextUrl);
  } catch {
    state.mihomoLogsReconnectAttempts += 1;
    scheduleMihomoLogsReconnect();
    return;
  }
  state.mihomoLogsSocket = socket;
  state.mihomoLogsSocketUrl = nextUrl;
  socket.onopen = () => {
    state.mihomoLogsReconnectAttempts = 0;
  };
  socket.onmessage = (event) => {
    try {
      const payload = JSON.parse(String(event && event.data ? event.data : '{}'));
      handleMihomoLogsPayload(payload && payload.payload ? payload.payload : '');
    } catch {
      // ignore malformed websocket frames
    }
  };
  socket.onerror = () => {};
  socket.onclose = () => {
    const currentSocket = state.mihomoLogsSocket;
    if (currentSocket !== socket) {
      return;
    }
    state.mihomoLogsSocket = null;
    state.mihomoLogsSocketUrl = '';
    state.mihomoLogsReconnectAttempts += 1;
    scheduleMihomoLogsReconnect();
  };
}

function appendMihomoLogEntry(payload = {}) {
  const rawMessage = String(payload && payload.payload ? payload.payload : '').trim();
  if (!rawMessage) {
    return;
  }
  const parsedEntry = parseLogLine(rawMessage) || {};
  const typeLevel = normalizeLogLevel(payload && payload.type ? payload.type : '');
  const nextEntry = {
    date: parsedEntry.date && parsedEntry.date !== '-' ? parsedEntry.date : formatLogDate(new Date().toISOString()),
    level: typeLevel || parsedEntry.level || 'INFO',
    msg: parsedEntry.msg && parsedEntry.msg !== '-' ? parsedEntry.msg : rawMessage,
  };
  const maxLines = Number.parseInt(
    String(
      (logLines && logLines.value)
      || (state.settings && state.settings.logLines)
      || 200,
    ),
    10,
  ) || 200;
  state.logEntries = [nextEntry, ...(Array.isArray(state.logEntries) ? state.logEntries : [])].slice(0, Math.max(1, maxLines));
  renderLogTable();
  if (logContent) {
    logContent.textContent = state.logEntries.map((entry) => `[${entry.level}] ${entry.msg}`).join('\n');
  }
}

function connectMihomoPageLogsStream() {
  if (currentPage !== 'logs' || typeof WebSocket !== 'function') {
    return;
  }
  const nextUrl = resolveMihomoLogsWebSocketUrl(getMihomoApiSource(), getSelectedMihomoLogLevel());
  if (!nextUrl) {
    closeMihomoPageLogsSocket();
    return;
  }
  const existing = state.mihomoPageLogsSocket;
  if (
    existing
    && state.mihomoPageLogsSocketUrl === nextUrl
    && (
      existing.readyState === WebSocket.OPEN
      || existing.readyState === WebSocket.CONNECTING
    )
  ) {
    return;
  }
  closeMihomoPageLogsSocket();
  let socket = null;
  try {
    socket = new WebSocket(nextUrl);
  } catch {
    state.mihomoPageLogsReconnectAttempts += 1;
    scheduleMihomoPageLogsReconnect();
    return;
  }
  state.mihomoPageLogsSocket = socket;
  state.mihomoPageLogsSocketUrl = nextUrl;
  socket.onopen = () => {
    state.mihomoPageLogsLive = true;
    state.mihomoPageLogsReconnectAttempts = 0;
  };
  socket.onmessage = (event) => {
    try {
      const payload = JSON.parse(String(event && event.data ? event.data : '{}'));
      appendMihomoLogEntry(payload);
    } catch {
      // ignore malformed websocket frames
    }
  };
  socket.onerror = () => {
    state.mihomoPageLogsLive = false;
  };
  socket.onclose = () => {
    const currentSocket = state.mihomoPageLogsSocket;
    if (currentSocket !== socket) {
      return;
    }
    state.mihomoPageLogsSocket = null;
    state.mihomoPageLogsSocketUrl = '';
    state.mihomoPageLogsLive = false;
    state.mihomoPageLogsReconnectAttempts += 1;
    scheduleMihomoPageLogsReconnect();
  };
}

function handleMihomoMemoryPayload(payload = {}) {
  state.mihomoMemoryLive = true;
  state.mihomoMemoryReconnectAttempts = 0;
  state.lastMihomoMemoryAt = Date.now();
  updateOverviewMemoryValue(payload.inuse);
}

function connectMihomoMemoryStream() {
  if (currentPage !== 'overview' || typeof WebSocket !== 'function') {
    return;
  }
  const nextUrl = resolveMihomoMemoryWebSocketUrl(getMihomoApiSource());
  if (!nextUrl) {
    closeMihomoMemorySocket();
    return;
  }
  const existing = state.mihomoMemorySocket;
  if (
    existing
    && state.mihomoMemorySocketUrl === nextUrl
    && (
      existing.readyState === WebSocket.OPEN
      || existing.readyState === WebSocket.CONNECTING
    )
  ) {
    return;
  }
  closeMihomoMemorySocket();
  let socket = null;
  try {
    socket = new WebSocket(nextUrl);
  } catch {
    state.mihomoMemoryLive = false;
    state.mihomoMemoryReconnectAttempts += 1;
    scheduleMihomoMemoryReconnect();
    return;
  }
  state.mihomoMemorySocket = socket;
  state.mihomoMemorySocketUrl = nextUrl;
  socket.onopen = () => {
    state.mihomoMemoryReconnectAttempts = 0;
  };
  socket.onmessage = (event) => {
    try {
      const payload = JSON.parse(String(event && event.data ? event.data : '{}'));
      handleMihomoMemoryPayload(payload);
    } catch {
      // ignore malformed websocket frames
    }
  };
  socket.onerror = () => {
    state.mihomoMemoryLive = false;
  };
  socket.onclose = () => {
    const currentSocket = state.mihomoMemorySocket;
    if (currentSocket !== socket) {
      return;
    }
    state.mihomoMemorySocket = null;
    state.mihomoMemorySocketUrl = '';
    state.mihomoMemoryLive = false;
    state.mihomoMemoryReconnectAttempts += 1;
    scheduleMihomoMemoryReconnect();
  };
}

function updateProxyTrafficSnapshot(downRate, upRate, downTotal, upTotal) {
  const down = Number.parseFloat(downRate);
  const up = Number.parseFloat(upRate);
  const rxTotal = Number.parseFloat(downTotal);
  const txTotal = Number.parseFloat(upTotal);
  if (!Number.isFinite(down) || !Number.isFinite(up) || down < 0 || up < 0) {
    return;
  }
  if (trafficSystemDownloadRate) {
    trafficSystemDownloadRate.textContent = formatBitrate(down);
  }
  if (overviewSummaryDownloadRate) {
    setNodeTextIfChanged(overviewSummaryDownloadRate, formatBitrate(down));
  }
  if (trafficSystemUploadRate) {
    trafficSystemUploadRate.textContent = formatBitrate(up);
  }
  if (overviewSummaryUploadRate) {
    setNodeTextIfChanged(overviewSummaryUploadRate, formatBitrate(up));
  }
  if (Number.isFinite(rxTotal) && rxTotal >= 0) {
    if (trafficSystemDownloadTotal) {
      trafficSystemDownloadTotal.textContent = `${t('status.trafficTotal')}: ${formatBytes(rxTotal)}`;
    }
    if (trafficTotalDownload) {
      trafficTotalDownload.textContent = formatBytes(rxTotal);
    }
    if (overviewSummaryDownloadTotal) {
      setNodeTextIfChanged(overviewSummaryDownloadTotal, formatBytes(rxTotal));
    }
  }
  if (Number.isFinite(txTotal) && txTotal >= 0) {
    if (trafficSystemUploadTotal) {
      trafficSystemUploadTotal.textContent = `${t('status.trafficTotal')}: ${formatBytes(txTotal)}`;
    }
    if (trafficTotalUpload) {
      trafficTotalUpload.textContent = formatBytes(txTotal);
    }
    if (overviewSummaryUploadTotal) {
      setNodeTextIfChanged(overviewSummaryUploadTotal, formatBytes(txTotal));
    }
  }
  state.lastProxyTrafficAt = Date.now();
  updateTrafficHistory(down, up);
}

function handleMihomoTrafficPayload(payload = {}) {
  state.mihomoTrafficLive = true;
  state.mihomoTrafficReconnectAttempts = 0;
  state.lastMihomoTrafficAt = Date.now();
  updateProxyTrafficSnapshot(payload.down, payload.up, payload.downTotal, payload.upTotal);
}

function connectMihomoTrafficStream() {
  if (currentPage !== 'overview' || typeof WebSocket !== 'function') {
    return;
  }
  const nextUrl = resolveMihomoTrafficWebSocketUrl(getMihomoApiSource());
  if (!nextUrl) {
    closeMihomoTrafficSocket();
    return;
  }
  const existing = state.mihomoTrafficSocket;
  if (
    existing
    && state.mihomoTrafficSocketUrl === nextUrl
    && (
      existing.readyState === WebSocket.OPEN
      || existing.readyState === WebSocket.CONNECTING
    )
  ) {
    return;
  }
  closeMihomoTrafficSocket();
  let socket = null;
  try {
    socket = new WebSocket(nextUrl);
  } catch {
    state.mihomoTrafficLive = false;
    state.mihomoTrafficReconnectAttempts += 1;
    scheduleMihomoTrafficReconnect();
    return;
  }
  state.mihomoTrafficSocket = socket;
  state.mihomoTrafficSocketUrl = nextUrl;
  socket.onopen = () => {
    state.mihomoTrafficReconnectAttempts = 0;
  };
  socket.onmessage = (event) => {
    try {
      const payload = JSON.parse(String(event && event.data ? event.data : '{}'));
      handleMihomoTrafficPayload(payload);
    } catch {
      // ignore malformed websocket frames
    }
  };
  socket.onerror = () => {
    state.mihomoTrafficLive = false;
  };
  socket.onclose = () => {
    const currentSocket = state.mihomoTrafficSocket;
    if (currentSocket !== socket) {
      return;
    }
    state.mihomoTrafficSocket = null;
    state.mihomoTrafficLive = false;
    state.mihomoTrafficSocketUrl = '';
    state.mihomoTrafficReconnectAttempts += 1;
    scheduleMihomoTrafficReconnect();
  };
}

function handleMihomoConnectionsPayload(payload = {}) {
  const connections = Array.isArray(payload && payload.connections) ? payload.connections : [];
  state.mihomoConnectionsLive = true;
  state.mihomoConnectionsReconnectAttempts = 0;
  state.lastMihomoConnectionsAt = Date.now();
  state.mihomoConnectionsSnapshot = connections;
  updateRealtimeConnections(connections.length);
  renderTopologyCard();
}

function connectMihomoConnectionsStream() {
  if (currentPage !== 'overview' || typeof WebSocket !== 'function') {
    return;
  }
  const nextUrl = resolveMihomoConnectionsWebSocketUrl(getMihomoApiSource());
  if (!nextUrl) {
    closeMihomoConnectionsSocket();
    return;
  }
  const existing = state.mihomoConnectionsSocket;
  if (
    existing
    && state.mihomoConnectionsSocketUrl === nextUrl
    && (
      existing.readyState === WebSocket.OPEN
      || existing.readyState === WebSocket.CONNECTING
    )
  ) {
    return;
  }
  closeMihomoConnectionsSocket();
  let socket = null;
  try {
    socket = new WebSocket(nextUrl);
  } catch {
    state.mihomoConnectionsLive = false;
    state.mihomoConnectionsReconnectAttempts += 1;
    scheduleMihomoConnectionsReconnect();
    return;
  }
  state.mihomoConnectionsSocket = socket;
  state.mihomoConnectionsSocketUrl = nextUrl;
  socket.onopen = () => {
    state.mihomoConnectionsReconnectAttempts = 0;
  };
  socket.onmessage = (event) => {
    try {
      const payload = JSON.parse(String(event && event.data ? event.data : '{}'));
      handleMihomoConnectionsPayload(payload);
    } catch {
      // ignore malformed websocket frames
    }
  };
  socket.onerror = () => {
    state.mihomoConnectionsLive = false;
  };
  socket.onclose = () => {
    const currentSocket = state.mihomoConnectionsSocket;
    if (currentSocket !== socket) {
      return;
    }
    state.mihomoConnectionsSocket = null;
    state.mihomoConnectionsLive = false;
    state.mihomoConnectionsSocketUrl = '';
    state.mihomoConnectionsReconnectAttempts += 1;
    scheduleMihomoConnectionsReconnect();
  };
}

async function fetchTunFromController() {
  return fetchTunConfigFromController(getMihomoApiSource());
}

async function updateTunViaController(partialTun = {}) {
  return updateTunConfigViaController(partialTun, getMihomoApiSource());
}
let quickHintNodes = [];

// IP地址隐私保护函数
function maskIpAddress(ip) {
  if (!ip || ip === '-') return ip;
  
  // 处理IPv4地址
  if (ip.includes('.')) {
    const parts = ip.split('.');
    if (parts.length === 4) {
      // 保留前两段，后两段替换为星号
      return `${parts[0]}.${parts[1]}.*.*`;
    }
  }
  
  // 处理IPv6地址（简化处理）
  if (ip.includes(':')) {
    const parts = ip.split(':');
    if (parts.length >= 4) {
      // 保留前两段和后两段，中间替换为星号
      return `${parts[0]}:${parts[1]}:****:****:****:****:${parts[parts.length-2]}:${parts[parts.length-1]}`;
    }
  }
  
  return ip;
}
let overviewNetworkRefresh = document.getElementById('overviewNetworkRefresh');

let githubUser = document.getElementById('githubUser');
let installBtn = document.getElementById('installBtn');
let installStatus = document.getElementById('installStatus');
let installCurrentKernel = document.getElementById('installCurrentKernel');
let installProgress = document.getElementById('installProgress');
let installVersionRow = document.getElementById('installVersionRow');
let installVersion = document.getElementById('installVersion');
let cancelInstallBtn = document.getElementById('cancelInstallBtn');
let configPathInput = document.getElementById('configPath');
let overviewConfigPath = document.getElementById('overviewConfigPath');
let overviewBrowseConfig = document.getElementById('overviewBrowseConfig');
let overviewConfigReset = document.getElementById('overviewConfigReset');
let browseConfigBtn = document.getElementById('browseConfig');
let externalControllerInput = document.getElementById('externalController');
let externalSecretInput = document.getElementById('externalSecret');
let externalAuthInput = document.getElementById('externalAuth');
let settingsExternalUi = document.getElementById('settingsExternalUi');
let settingsExternalUiUrl = document.getElementById('settingsExternalUiUrl');
let panelSelect = document.getElementById('panelSelect');
let startBtn = document.getElementById('startBtn');
let stopBtn = document.getElementById('stopBtn');
let restartBtn = document.getElementById('restartBtn');
let proxyModeSelect = document.getElementById('proxyModeSelect');
let refreshStatusBtn = document.getElementById('refreshStatus');
let refreshBackups = document.getElementById('refreshBackups');
let backupsRefresh = document.getElementById('backupsRefresh');
let switchBtn = document.getElementById('switchBtn');
let backupTable = document.getElementById('backupTable');
let backupTableFull = document.getElementById('backupTableFull');
let kernelCurrentTable = document.getElementById('kernelCurrentTable');
let configsRefresh = document.getElementById('configsRefresh');
let configsImport = document.getElementById('configsImport');
let configTable = document.getElementById('configTable');
let configPrev = document.getElementById('configPrev');
let configNext = document.getElementById('configNext');
let configPageInfo = document.getElementById('configPageInfo');
let configPageSize = document.getElementById('configPageSize');
let kernelTable = document.getElementById('kernelTable');
let kernelRefresh = document.getElementById('kernelRefresh');
let kernelPrev = document.getElementById('kernelPrev');
let kernelNext = document.getElementById('kernelNext');
let kernelPageInfo = document.getElementById('kernelPageInfo');
let kernelPageSize = document.getElementById('kernelPageSize');
let switchPrev = document.getElementById('switchPrev');
let switchNext = document.getElementById('switchNext');
let switchPageInfo = document.getElementById('switchPageInfo');
let switchPageSize = document.getElementById('switchPageSize');
let backupsPrev = document.getElementById('backupsPrev');
let backupsNext = document.getElementById('backupsNext');
let backupsPageInfo = document.getElementById('backupsPageInfo');
let backupsPageSize = document.getElementById('backupsPageSize');
let recommendPrev = document.getElementById('recommendPrev');
let recommendNext = document.getElementById('recommendNext');
let recommendPageInfo = document.getElementById('recommendPageInfo');
let recommendPageSize = document.getElementById('recommendPageSize');
let recommendTableBody = document.getElementById('recommendTableBody');
let backupsDelete = document.getElementById('backupsDelete');
let logLines = document.getElementById('logLines');
let logRefresh = document.getElementById('logRefresh');
let logContent = document.getElementById('logContent');
let logAutoRefresh = document.getElementById('logAutoRefresh');
let logIntervalPreset = document.getElementById('logIntervalPreset');
let logLevelFilter = document.getElementById('logLevelFilter');
let logMessageFilter = document.getElementById('logMessageFilter');
let logTableBody = document.getElementById('logTableBody');
let cleanModeSelect = document.getElementById('cleanModeSelect');

let cleanBtn = document.getElementById('cleanBtn');
let openAppLogBtn = document.getElementById('openAppLogBtn');
let dashboardFrame = document.getElementById('dashboardFrame');
let dashboardEmpty = document.getElementById('dashboardEmpty');
let dashboardHint = document.getElementById('dashboardHint');
let dashboardLocalModule = null;
let sudoModal = document.getElementById('sudoModal');
let sudoPassword = document.getElementById('sudoPassword');
let sudoCancel = document.getElementById('sudoCancel');
let sudoConfirm = document.getElementById('sudoConfirm');
let confirmModal = document.getElementById('confirmModal');
let confirmTitle = document.getElementById('confirmTitle');
let confirmBody = document.getElementById('confirmBody');
let confirmCancel = document.getElementById('confirmCancel');
let confirmOk = document.getElementById('confirmOk');
let updateGuideModal = document.getElementById('updateGuideModal');
let updateGuideTitle = document.getElementById('updateGuideTitle');
let updateGuideBody = document.getElementById('updateGuideBody');
let updateGuideClose = document.getElementById('updateGuideClose');
let updateGuideReleaseBtn = document.getElementById('updateGuideReleaseBtn');
let updateGuideAlphaBtn = document.getElementById('updateGuideAlphaBtn');
let appName = document.getElementById('appName');
let appVersion = document.getElementById('appVersion');
let themeToggle = document.getElementById('themeToggle');
let settingsTheme = document.getElementById('settingsTheme');
let settingsLang = document.getElementById('settingsLang');
let settingsGithubUser = document.getElementById('settingsGithubUser');
let settingsConfigPath = document.getElementById('settingsConfigPath');
let settingsBrowseConfig = document.getElementById('settingsBrowseConfig');
let settingsKernelPath = document.getElementById('settingsKernelPath');
let settingsConfigDefault = document.getElementById('settingsConfigDefault');
let settingsLogPath = document.getElementById('settingsLogPath');
let settingsConfigDir = document.getElementById('settingsConfigDir');
let settingsCoreDir = document.getElementById('settingsCoreDir');
let settingsDataDir = document.getElementById('settingsDataDir');
let settingsConfigDirReveal = document.getElementById('settingsConfigDirReveal');
let settingsCoreDirReveal = document.getElementById('settingsCoreDirReveal');
let settingsDataDirReveal = document.getElementById('settingsDataDirReveal');
let helperInstallBtn = document.getElementById('helperInstallBtn');
let helperRepairBtn = document.getElementById('helperRepairBtn');
let helperInstallTerminalBtn = document.getElementById('helperInstallTerminalBtn');
let helperInstallPathBtn = document.getElementById('helperInstallPathBtn');
let helperInstallPath = document.getElementById('helperInstallPath');
let helperStatusText = document.getElementById('helperStatusText');
let helperStatusDot = document.querySelector('.helper-status-dot');
let helperRefreshBtn = document.getElementById('helperRefreshBtn');
let helperCheckUpdateBtn = document.getElementById('helperCheckUpdateBtn');
let helperLogsOpenBtn = document.getElementById('helperLogsOpenBtn');
let helperLogsRevealBtn = document.getElementById('helperLogsRevealBtn');
let helperLogsPath = document.getElementById('helperLogsPath');
let helperVersionText = document.getElementById('helperVersionText');
let helpAboutVersion = document.getElementById('helpAboutVersion');
let helpAboutBuild = document.getElementById('helpAboutBuild');
let appInfoCache = null;
let appInfoPromise = null;
let helpAboutStatus = document.getElementById('helpAboutStatus');
let helpCheckAppUpdateBtn = document.getElementById('helpCheckAppUpdateBtn');
let helpCheckKernelUpdateBtn = document.getElementById('helpCheckKernelUpdateBtn');
let helpCheckHelperUpdateBtn = document.getElementById('helpCheckHelperUpdateBtn');
let helperPrimaryAction = 'install';
let settingsBackupsPageSize = document.getElementById('settingsBackupsPageSize');
let settingsDebugMode = document.getElementById('settingsDebugMode');
let settingsWindowWidth = document.getElementById('settingsWindowWidth');
let settingsWindowHeight = document.getElementById('settingsWindowHeight');
let settingsAcceptBeta = document.getElementById('settingsAcceptBeta');
let settingsTrayMenuChart = document.getElementById('settingsTrayMenuChart');
let settingsTrayMenuProviderTraffic = document.getElementById('settingsTrayMenuProviderTraffic');
let settingsTrayMenuTrackers = document.getElementById('settingsTrayMenuTrackers');
let settingsTrayMenuFoxboard = document.getElementById('settingsTrayMenuFoxboard');
let settingsTrayMenuKernelManager = document.getElementById('settingsTrayMenuKernelManager');
let settingsTrayMenuDirectoryLocations = document.getElementById('settingsTrayMenuDirectoryLocations');
let settingsTrayMenuCopyShellExport = document.getElementById('settingsTrayMenuCopyShellExport');
let settingsProxyMixedPort = document.getElementById('settingsProxyMixedPort');
let settingsProxyPort = document.getElementById('settingsProxyPort');
let settingsProxySocksPort = document.getElementById('settingsProxySocksPort');
let settingsProxyAllowLan = document.getElementById('settingsProxyAllowLan');

let langButtons = Array.from(document.querySelectorAll('.lang-btn'));
const customSelectRegistry = new WeakMap();
let activeCustomSelectEntry = null;
let customSelectGlobalBound = false;

const I18N = window.CLASHFOX_I18N || {};
;

const SETTINGS_KEY = 'clashfox-settings';
const MAIN_WINDOW_DEFAULT_WIDTH = 980;
const MAIN_WINDOW_DEFAULT_HEIGHT = 640;
const MAIN_WINDOW_MIN_WIDTH = 980;
const MAIN_WINDOW_MIN_HEIGHT = 640;
const MAIN_WINDOW_MAX_WIDTH = 4096;
const MAIN_WINDOW_MAX_HEIGHT = 2160;
const APP_RELEASES_URL = 'https://github.com/lukuochiang/ClashFox/releases';
const DEFAULT_SETTINGS = {
  lang: 'auto',
  theme: 'auto',
  githubUser: 'vernesong',
  configPath: '',
  configDir: '',
  coreDir: '',
  dataDir: '',
  panelChoice: '',
  externalUi: 'ui',
  externalController: '127.0.0.1:9090',
  secret: 'clashfox',
  authentication: ['mihomo:clashfox'],
  panelManager: {
    panelChoice: 'zashboard',
    externalUi: 'ui',
    externalController: '127.0.0.1:9090',
    secret: 'clashfox',
    authentication: ['mihomo:clashfox'],
  },
  proxy: 'rule',
  systemProxy: false,
  tun: false,
  stack: 'Mixed',
  mixedPort: 7893,
  port: 7890,
  socksPort: 7891,
  allowLan: true,
  overviewOrder: [],
  logLines: 10,
  logAutoRefresh: false,
  logIntervalPreset: '3',
  generalPageSize: '10',
  switchPageSize: '10',
  backupsPageSize: '10',
  configPageSize: '10',
  recommendPageSize: '10',
  sidebarCollapsed: false,
  acceptBeta: false,
  debugMode: false,
  chartEnabled: true,
  providerTrafficEnabled: true,
  trackersEnabled: true,
  foxboardEnabled: true,
  kernelManagerEnabled: true,
  directoryLocationsEnabled: true,
  copyShellExportCommandEnabled: true,
  trayMenu: {
    chartEnabled: true,
    providerTrafficEnabled: true,
    trackersEnabled: true,
    foxboardEnabled: true,
    kernelManagerEnabled: true,
    directoryLocationsEnabled: true,
    copyShellExportCommandEnabled: true,
  },
  windowWidth: MAIN_WINDOW_DEFAULT_WIDTH,
  windowHeight: MAIN_WINDOW_DEFAULT_HEIGHT,
  mainWindowClosed: false,
  appearance: {
    lang: 'auto',
    theme: 'auto',
    debugMode: false,
    acceptBeta: false,
    githubUser: 'vernesong',
    windowWidth: MAIN_WINDOW_DEFAULT_WIDTH,
    windowHeight: MAIN_WINDOW_DEFAULT_HEIGHT,
    mainWindowClosed: false,
    generalPageSize: '10',
    logLines: 10,
    logAutoRefresh: false,
    logIntervalPreset: '3',
  },
  kernel: {},
  mihomoStatus: {
    running: false,
    source: 'init',
    updatedAt: '',
  },
};

let PANEL_PRESETS = {};
let RECOMMENDED_CONFIGS = [];

const STATIC_CONFIGS_URL = new URL('../../../static/configs.json', window.location.href);
let PANEL_EXTERNAL_UI_URLS = {};

const state = {
  lang: 'auto',
  lastBackups: [],
  configs: [],
  kernels: [],
  fileSettings: {},
  logTimer: null,
  logIntervalMs: 3000,
  logEntries: [],
  switchPage: 1,
  backupsPage: 1,
  configPage: 1,
  recommendPage: 1,
  kernelsPage: 1,
  kernelPageSizeLocal: null,
  switchPageSizeLocal: null,
  backupsPageSizeLocal: null,
  configPageSizeLocal: null,
  recommendPageSizeLocal: null,
  selectedBackupPaths: new Set(),
  theme: 'night',
  themeSetting: 'auto',
  installState: 'idle',
  dashboardAlerted: false,
  dashboardLoaded: false,
  autoPanelInstalled: false,
  panelInstallRequested: false,
  helperAuthFallbackHintShown: false,
  kernelUpdateInfo: null,
  kernelUpdateCache: null,
  kernelUpdateChecking: false,
  kernelUpdatePendingRefresh: false,
  kernelUpdateCheckedAt: 0,
  kernelUpdateNotifiedVersion: '',
  kernelUpdateRequestSeq: 0,
  githubSourceManualOverride: false,
  coreVersionRaw: '',
  coreStatusTimer: null,
  providerSubscriptionTimer: null,
  providerSubscriptionLoading: false,
  rulesOverviewTimer: null,
  rulesOverviewLoading: false,
  rulesOverviewView: 'rules',
  rulesOverviewPayload: null,
  ruleProvidersOverviewPayload: null,
  overviewTimer: null,
  overviewTickTimer: null,
  overviewLoading: false,
  overviewLiteTimer: null,
  overviewLiteLoading: false,
  overviewMemoryTimer: null,
  overviewMemoryLoading: false,
  trafficTimer: null,
  trafficLoading: false,
  trafficRxBytes: null,
  trafficTxBytes: null,
  trafficAt: 0,
  trafficHistoryRx: [],
  trafficHistoryTx: [],
  lastProxyTrafficAt: 0,
  proxyRxBytes: null,
  proxyTxBytes: null,
  proxyAt: 0,
  coreActionInFlight: false,
  coreStartupEstimateMs: 1500,
  coreRunning: false,
  coreRunningFalseStreak: 0,
  coreRunningGuardUntil: 0,
  coreRunningUpdatedAt: 0,
  overviewRunningUpdatedAt: 0,
  overviewRunning: false,
  overviewUptimeBaseSec: 0,
  overviewUptimeAt: 0,
  connSamples: [],
  connPeak: 0,
  connLast: null,
  mihomoConnectionsSocket: null,
  mihomoConnectionsSocketUrl: '',
  mihomoConnectionsReconnectTimer: null,
  mihomoConnectionsReconnectAttempts: 0,
  mihomoConnectionsLive: false,
  lastMihomoConnectionsAt: 0,
  mihomoConnectionsSnapshot: [],
  mihomoTrafficSocket: null,
  mihomoTrafficSocketUrl: '',
  mihomoTrafficReconnectTimer: null,
  mihomoTrafficReconnectAttempts: 0,
  mihomoTrafficLive: false,
  lastMihomoTrafficAt: 0,
  mihomoMemorySocket: null,
  mihomoMemorySocketUrl: '',
  mihomoMemoryReconnectTimer: null,
  mihomoMemoryReconnectAttempts: 0,
  mihomoMemoryLive: false,
  lastMihomoMemoryAt: 0,
  mihomoLogsSocket: null,
  mihomoLogsSocketUrl: '',
  mihomoLogsReconnectTimer: null,
  mihomoLogsReconnectAttempts: 0,
  mihomoPageLogsSocket: null,
  mihomoPageLogsSocketUrl: '',
  mihomoPageLogsReconnectTimer: null,
  mihomoPageLogsReconnectAttempts: 0,
  mihomoPageLogsLive: false,
  topologyTickTimer: null,
  topologyRenderTimer: null,
  topologyRenderRaf: null,
  topologySurfaceSignatures: {},
  topologyLinkSignatures: {},
  topologyEvents: [],
  topologyHoverKey: '',
  providerSubscriptionCachePayload: null,
  rulesOverviewCachePayload: null,
  overviewLatencySnapshot: {
    internet: '',
    dns: '',
    router: '',
  },
  providerSubscriptionRenderSignature: '',
  rulesOverviewRenderSignatures: {
    metrics: '',
    chart: '',
    records: '',
    behaviors: '',
    switchView: '',
  },
  overviewIpRaw: {
    local: '',
    proxy: '',
    internet: '',
  },
  hasKernel: false,
  configDefault: '',
  settings: { ...DEFAULT_SETTINGS },
};
state.foxRank = loadFoxRankFromStorage();
saveFoxRankToStorage();

const CORE_STARTUP_ESTIMATE_MIN_MS = 900;
const CORE_STARTUP_ESTIMATE_MAX_MS = 10000;
const MIHOMO_CONNECTIONS_RECONNECT_BASE_MS = 1500;
const MIHOMO_CONNECTIONS_RECONNECT_MAX_MS = 12000;
const MIHOMO_TRAFFIC_RECONNECT_BASE_MS = 1500;
const MIHOMO_TRAFFIC_RECONNECT_MAX_MS = 12000;
const MIHOMO_MEMORY_RECONNECT_BASE_MS = 1500;
const MIHOMO_MEMORY_RECONNECT_MAX_MS = 12000;
const MIHOMO_LOGS_RECONNECT_BASE_MS = 1500;
const MIHOMO_LOGS_RECONNECT_MAX_MS = 12000;
const TOPOLOGY_EVENT_LIMIT = 8;
const TOPOLOGY_EVENT_TTL_MS = 20000;

function readKernelUpdateCacheStore() {
  return {};
}

function writeKernelUpdateCacheStore(store = {}) {
  return store;
}

function buildKernelUpdateCacheKey(source = '', currentVersion = '') {
  return `${String(source || '').trim().toLowerCase()}::${String(currentVersion || '').trim()}`;
}

function getCachedKernelUpdateResult(source = '', currentVersion = '') {
  void source;
  void currentVersion;
  return null;
}

function setCachedKernelUpdateResult(source = '', currentVersion = '', result = null) {
  void source;
  void currentVersion;
  void result;
}

function readOverviewNetworkCache() {
  return null;
}

function writeOverviewNetworkCache(payload = {}) {
  return payload;
}

function cacheOverviewNetworkFromState() {
  return;
}

function hydrateOverviewNetworkFromCache() {
  return;
}

function readOverviewTrafficCache() {
  return null;
}

function writeOverviewTrafficCache(payload = {}) {
  return payload;
}

function cacheOverviewTrafficFromState() {
  return;
}

function hydrateOverviewTrafficFromCache() {
  return;
}

function readOverviewProviderSubscriptionCache() {
  return state.providerSubscriptionCachePayload
    && typeof state.providerSubscriptionCachePayload === 'object'
    ? state.providerSubscriptionCachePayload
    : null;
}

function writeOverviewProviderSubscriptionCache(payload = {}) {
  return payload;
}

function cacheOverviewProviderSubscription(payload = null) {
  state.providerSubscriptionCachePayload = payload && typeof payload === 'object'
    ? JSON.parse(JSON.stringify(payload))
    : null;
}

function hydrateOverviewProviderSubscriptionFromCache() {
  const cached = readOverviewProviderSubscriptionCache();
  if (!cached) {
    return;
  }
  renderProviderSubscriptionOverview(cached);
}

function readOverviewRulesCardCache() {
  return state.rulesOverviewCachePayload
    && typeof state.rulesOverviewCachePayload === 'object'
    ? state.rulesOverviewCachePayload
    : null;
}

function writeOverviewRulesCardCache(payload = {}) {
  return payload;
}

function cacheOverviewRulesCard() {
  state.rulesOverviewCachePayload = JSON.parse(JSON.stringify({
    rules: state.rulesOverviewPayload && typeof state.rulesOverviewPayload === 'object'
      ? state.rulesOverviewPayload
      : null,
    providers: state.ruleProvidersOverviewPayload && typeof state.ruleProvidersOverviewPayload === 'object'
      ? state.ruleProvidersOverviewPayload
      : null,
    view: state.rulesOverviewView === 'providers' ? 'providers' : 'rules',
  }));
}

function hydrateOverviewRulesCardFromCache() {
  const cached = readOverviewRulesCardCache();
  if (!cached) {
    return;
  }
  state.rulesOverviewPayload = cached.rules && typeof cached.rules === 'object'
    ? cached.rules
    : state.rulesOverviewPayload;
  state.ruleProvidersOverviewPayload = cached.providers && typeof cached.providers === 'object'
    ? cached.providers
    : state.ruleProvidersOverviewPayload;
  state.rulesOverviewView = cached.view === 'providers' ? 'providers' : 'rules';
  renderRulesOverviewCard();
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function sanitizeWindowDimension(value, fallback, min, max) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return clamp(parsed, min, max);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function updateCoreStartupEstimate(measuredMs) {
  if (!Number.isFinite(measuredMs) || measuredMs <= 0) {
    return;
  }
  const safeMeasured = clamp(Math.round(measuredMs), CORE_STARTUP_ESTIMATE_MIN_MS, CORE_STARTUP_ESTIMATE_MAX_MS);
  const previous = Number.isFinite(state.coreStartupEstimateMs) ? state.coreStartupEstimateMs : safeMeasured;
  state.coreStartupEstimateMs = clamp(
    Math.round(previous * 0.65 + safeMeasured * 0.35),
    CORE_STARTUP_ESTIMATE_MIN_MS,
    CORE_STARTUP_ESTIMATE_MAX_MS,
  );
}

function t(path) {
  const lang = state.lang === 'auto' ? getAutoLanguage() : state.lang;

  const parts = path.split('.');
  let current = I18N[lang];
  for (const part of parts) {
    if (!current || typeof current !== 'object') return '';
    current = current[part];
  }
  return current || '';
}

function ti(path, fallback = '') {
  const value = t(path);
  return value && String(value).trim() !== '' ? value : fallback;
}

function getFoxRankLocale() {
  const lang = state.lang === 'auto' ? getAutoLanguage() : state.lang;
  return FOX_RANK_I18N[lang] ? lang : 'en';
}

function foxRankText(key, fallback = '') {
  const locale = getFoxRankLocale();
  const value = FOX_RANK_I18N[locale] && Object.prototype.hasOwnProperty.call(FOX_RANK_I18N[locale], key)
    ? FOX_RANK_I18N[locale][key]
    : '';
  return value || fallback;
}

function formatFoxRankText(key, vars = {}, fallback = '') {
  return String(foxRankText(key, fallback)).replace(/\{(\w+)\}/g, (_match, token) => {
    const value = vars[token];
    return value === undefined || value === null ? '' : String(value);
  });
}

function normalizeVersionForDisplay(raw = '') {
  const text = String(raw || '').trim();
  if (!text) {
    return '';
  }
  const match = text.match(/v?\d+\.\d+\.\d+/);
  return match ? String(match[0]).replace(/^v/i, '') : text;
}

function resolveAppReleaseChannel(version = '', prerelease = false) {
  if (!prerelease) {
    return 'stable';
  }
  const normalized = String(version || '').trim().toLowerCase();
  if (/-rc(?:\.|$)/.test(normalized)) {
    return 'rc';
  }
  if (/-beta(?:\.|$)/.test(normalized)) {
    return 'beta';
  }
  if (/-alpha(?:\.|$)/.test(normalized)) {
    return 'alpha';
  }
  return 'beta';
}

function getAppReleaseChannelLabel(channel = 'stable') {
  const normalized = String(channel || 'stable').trim().toLowerCase();
  if (normalized === 'alpha') return ti('help.channelAlpha', 'Alpha');
  if (normalized === 'beta') return ti('help.channelBeta', 'Beta');
  if (normalized === 'rc') return ti('help.channelRc', 'RC');
  return ti('help.channelStable', 'Stable');
}

function formatAppUpdateChannelText(key, fallback, channel, version = '') {
  return ti(key, fallback)
    .replace('{channel}', getAppReleaseChannelLabel(channel))
    .replace('{version}', String(version || '').trim());
}

function getAutoLanguage() {
  return detectSystemLocale(systemLocaleFromMain || '');
}

function applyFoxRankLocalizedUi() {
  document.querySelectorAll('[data-fox-rank-ui]').forEach((el) => {
    const key = String(el.dataset.foxRankUi || '').trim();
    if (!key) return;
    el.textContent = foxRankText(key, el.textContent || '');
  });
  if (openAppLogBtn) {
    openAppLogBtn.textContent = ti('logs.openAppLog', 'Open App Log');
  }
  if (foxRankCopySummaryBtn && !foxRankCopySummaryBtn.disabled) {
    foxRankCopySummaryBtn.textContent = foxRankText('copySummary', 'Copy Summary');
  }
  if (foxRankExportPngBtn && !foxRankExportPngBtn.disabled) {
    foxRankExportPngBtn.textContent = foxRankText('exportPng', 'Export PNG');
  }
  if (foxRankBriefClose) {
    foxRankBriefClose.textContent = foxRankText('later', 'Later');
  }
  if (foxRankBriefOpenDetail) {
    foxRankBriefOpenDetail.textContent = foxRankText('openDetail', 'Open Fox Rank');
  }
  if (foxRankCard) {
    foxRankCard.setAttribute('aria-label', foxRankText('openDetail', 'Open Fox Rank'));
  }
  if (state.foxRank) {
    renderFoxRankPanel(null, { suppressBrief: true });
  }
}

async function refreshSystemLocaleFromMain(forceApply = false) {
  if (!window.clashfox || typeof window.clashfox.getSystemLocale !== 'function') {
    return false;
  }
  try {
    const response = await window.clashfox.getSystemLocale();
    const nextLocale = response && response.ok
      ? String(response.locale || '').trim()
      : '';
    if (!nextLocale) {
      return false;
    }
    const changed = nextLocale !== systemLocaleFromMain;
    systemLocaleFromMain = nextLocale;
    if ((changed || forceApply) && state.lang === 'auto') {
      applyI18n();
      if (typeof refreshPageView === 'function') {
        refreshPageView();
      }
    }
    return changed;
  } catch {
    return false;
  }
}

function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.dataset.i18n;
    const tip = t(key);
    el.textContent = tip;
  });
  document.querySelectorAll('[data-tip-key]').forEach((el) => {
    const key = el.dataset.tipKey || '';
    const fallback = String(el.dataset.tipFallback || '').trim();
    const tip = t(key) || fallback;
    el.dataset.tip = tip;
    if (el.dataset.nativeTitle === 'false') {
      el.removeAttribute('title');
    } else {
      el.setAttribute('title', tip);
    }
    el.setAttribute('aria-label', tip);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const key = el.dataset.i18nPlaceholder;
    el.setAttribute('placeholder', t(key));
  });
  applyFoxRankLocalizedUi();
  document.querySelectorAll('.overview-inline-copy-btn').forEach((el) => {
    el.setAttribute('aria-label', ti('actions.copy', 'Copy'));
  });

  applyCardIcons();

  if (statusPill && !statusPill.dataset.state) {
    statusPill.dataset.state = 'unknown';
  }
  updateThemeToggle();
  refreshNavButtonTooltips();
  setInstallState(state.installState);
  renderConfigTable();
  refreshCustomSelects();
  requestTopNavOverflowSync();
}

function closeActiveCustomSelect() {
  if (!activeCustomSelectEntry) {
    return;
  }
  activeCustomSelectEntry.wrapper.classList.remove('is-open');
  activeCustomSelectEntry.menu.hidden = true;
  activeCustomSelectEntry.trigger.setAttribute('aria-expanded', 'false');
  activeCustomSelectEntry = null;
}

function refreshCustomSelectEntry(entry) {
  if (!entry || !entry.select || !entry.wrapper || !entry.menu || !entry.trigger || !entry.label) {
    return;
  }
  const { select, menu, label, trigger, wrapper } = entry;
  const options = Array.from(select.options || []);
  const selectedValue = String(select.value ?? '');
  const optionMap = new Map();
  menu.innerHTML = '';
  options.forEach((option) => {
    const optionValue = String(option.value ?? '');
    const optionText = String(option.textContent || '').trim();
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'cf-select-option';
    item.dataset.value = optionValue;
    item.setAttribute('role', 'option');
    item.setAttribute('aria-selected', option.selected ? 'true' : 'false');
    item.textContent = optionText;
    if (option.disabled) {
      item.disabled = true;
    }
    item.addEventListener('click', () => {
      if (option.disabled) {
        return;
      }
      if (String(select.value ?? '') !== optionValue) {
        select.value = optionValue;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
      closeActiveCustomSelect();
      trigger.focus();
    });
    menu.appendChild(item);
    optionMap.set(optionValue, item);
  });
  entry.optionMap = optionMap;
  const selectedOption = options.find((option) => option.value === select.value)
    || options.find((option) => option.selected)
    || options[0]
    || null;
  const selectedText = selectedOption ? String(selectedOption.textContent || '').trim() : '';
  label.textContent = selectedText || '';
  trigger.disabled = Boolean(select.disabled);
  wrapper.classList.toggle('is-disabled', Boolean(select.disabled));
  optionMap.forEach((item, value) => {
    const isSelected = String(value) === selectedValue;
    item.classList.toggle('is-selected', isSelected);
    item.setAttribute('aria-selected', isSelected ? 'true' : 'false');
  });
}

function refreshCustomSelects(root = document) {
  const container = root && typeof root.querySelectorAll === 'function' ? root : document;
  const selects = Array.from(container.querySelectorAll('select[data-custom-select="true"]'));
  selects.forEach((select) => {
    const entry = customSelectRegistry.get(select);
    if (entry) {
      refreshCustomSelectEntry(entry);
    }
  });
}

function initCustomSelects(root = document) {
  const container = root && typeof root.querySelectorAll === 'function' ? root : document;
  const selects = Array.from(container.querySelectorAll('select'))
    .filter((select) => !select.multiple && select.size <= 1 && select.dataset.nativeSelect !== 'true');
  if (!customSelectGlobalBound) {
    customSelectGlobalBound = true;
    document.addEventListener('pointerdown', (event) => {
      if (!activeCustomSelectEntry) {
        return;
      }
      const target = event.target instanceof Node ? event.target : null;
      if (target && activeCustomSelectEntry.wrapper.contains(target)) {
        return;
      }
      closeActiveCustomSelect();
    }, true);
    document.addEventListener('keydown', (event) => {
      if (!activeCustomSelectEntry) {
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        closeActiveCustomSelect();
      }
    });
    window.addEventListener('resize', () => {
      closeActiveCustomSelect();
    });
  }

  selects.forEach((select) => {
    if (select.dataset.customSelect === 'true') {
      const existingEntry = customSelectRegistry.get(select);
      if (existingEntry) {
        refreshCustomSelectEntry(existingEntry);
      }
      return;
    }
    const wrapper = document.createElement('div');
    wrapper.className = 'cf-select';
    if (select.id) {
      wrapper.dataset.selectId = select.id;
    }
    select.classList.forEach((cls) => wrapper.classList.add(cls));
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'cf-select-trigger';
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-label', select.getAttribute('aria-label') || select.id || 'Select');
    const label = document.createElement('span');
    label.className = 'cf-select-value';
    const arrow = document.createElement('span');
    arrow.className = 'cf-select-arrow';
    arrow.setAttribute('aria-hidden', 'true');
    trigger.appendChild(label);
    trigger.appendChild(arrow);
    const menu = document.createElement('div');
    menu.className = 'cf-select-menu';
    menu.hidden = true;
    menu.setAttribute('role', 'listbox');
    menu.tabIndex = -1;

    const openMenu = () => {
      if (select.disabled) {
        return;
      }
      if (activeCustomSelectEntry && activeCustomSelectEntry !== entry) {
        closeActiveCustomSelect();
      }
      activeCustomSelectEntry = entry;
      wrapper.classList.add('is-open');
      menu.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
      const selectedItem = menu.querySelector('.cf-select-option.is-selected:not(:disabled)')
        || menu.querySelector('.cf-select-option:not(:disabled)');
      if (selectedItem && typeof selectedItem.focus === 'function') {
        selectedItem.focus();
      }
    };

    const closeMenu = () => {
      if (activeCustomSelectEntry === entry) {
        closeActiveCustomSelect();
      } else {
        wrapper.classList.remove('is-open');
        menu.hidden = true;
        trigger.setAttribute('aria-expanded', 'false');
      }
    };

    trigger.addEventListener('click', () => {
      if (wrapper.classList.contains('is-open')) {
        closeMenu();
        return;
      }
      openMenu();
    });

    trigger.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openMenu();
      }
    });

    menu.addEventListener('keydown', (event) => {
      const optionsInMenu = Array.from(menu.querySelectorAll('.cf-select-option:not(:disabled)'));
      const currentIndex = optionsInMenu.indexOf(document.activeElement);
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        const nextIndex = currentIndex < 0 ? 0 : Math.min(currentIndex + 1, optionsInMenu.length - 1);
        const target = optionsInMenu[nextIndex];
        if (target) target.focus();
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        const prevIndex = currentIndex <= 0 ? 0 : currentIndex - 1;
        const target = optionsInMenu[prevIndex];
        if (target) target.focus();
        return;
      }
      if (event.key === 'Tab') {
        closeMenu();
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMenu();
        trigger.focus();
      }
    });

    select.addEventListener('change', () => {
      const active = activeCustomSelectEntry && activeCustomSelectEntry.select === select;
      refreshCustomSelectEntry(entry);
      if (active) {
        closeMenu();
      }
    });

    const nativeProto = Object.getPrototypeOf(select);
    const valueDescriptor = Object.getOwnPropertyDescriptor(nativeProto, 'value');
    if (valueDescriptor && typeof valueDescriptor.set === 'function' && typeof valueDescriptor.get === 'function') {
      Object.defineProperty(select, 'value', {
        configurable: true,
        enumerable: true,
        get() {
          return valueDescriptor.get.call(this);
        },
        set(nextValue) {
          valueDescriptor.set.call(this, nextValue);
          const linkedEntry = customSelectRegistry.get(this);
          if (linkedEntry) {
            refreshCustomSelectEntry(linkedEntry);
          }
        },
      });
    }
    const disabledDescriptor = Object.getOwnPropertyDescriptor(nativeProto, 'disabled');
    if (disabledDescriptor && typeof disabledDescriptor.set === 'function' && typeof disabledDescriptor.get === 'function') {
      Object.defineProperty(select, 'disabled', {
        configurable: true,
        enumerable: true,
        get() {
          return disabledDescriptor.get.call(this);
        },
        set(nextValue) {
          disabledDescriptor.set.call(this, nextValue);
          const linkedEntry = customSelectRegistry.get(this);
          if (linkedEntry) {
            refreshCustomSelectEntry(linkedEntry);
          }
        },
      });
    }

    const observer = new MutationObserver(() => {
      refreshCustomSelectEntry(entry);
    });
    observer.observe(select, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['disabled', 'label', 'selected', 'value'],
    });

    const entry = { select, wrapper, trigger, label, menu, observer, optionMap: new Map() };
    customSelectRegistry.set(select, entry);
    select.dataset.customSelect = 'true';
    select.classList.add('cf-native-select');
    select.tabIndex = -1;

    const parent = select.parentNode;
    if (parent) {
      parent.insertBefore(wrapper, select);
      wrapper.appendChild(select);
      wrapper.appendChild(trigger);
      wrapper.appendChild(menu);
    }
    refreshCustomSelectEntry(entry);
  });
}

function applyCardIcons() {
  const mapIconByI18nKey = (key) => {
    if (!key) return '';
    if (key === 'status.quick') return 'var(--icon-sliders)';
    if (key === 'status.proxyMode') return 'var(--icon-outbound)';
    if (key === 'status.connLiveTitle') return 'var(--icon-connections)';
    if (key === 'status.trafficTitle') return 'var(--icon-clock)';
    if (key === 'status.topologyTitle') return 'var(--icon-topology)';
    if (key === 'overview.runningTitle') return 'var(--icon-activity)';
    if (key === 'overview.networkTitle') return 'var(--icon-wifi)';
    if (key === 'overview.providerTrafficTitle') return 'var(--icon-clock)';
    if (key === 'overview.rulesOverviewTitle') return 'var(--icon-list)';
    if (key === 'install.title') return 'var(--icon-download)';
    if (key === 'install.kernelsTitle') return 'var(--icon-kernel)';
    if (key === 'control.title') return 'var(--icon-config)';
    if (key === 'control.recommendationsTitle') return 'var(--icon-list)';
    if (key === 'logs.title') return 'var(--icon-doc)';
    if (key === 'clean.title') return 'var(--icon-broom)';
    if (key === 'help.title') return 'var(--icon-help)';
    if (key === 'help.introTitle') return 'var(--icon-info)';
    if (key === 'help.ackTitle') return 'var(--icon-defaults)';
    if (key === 'settings.appearance') return 'var(--icon-palette)';
    if (key === 'settings.panelManager') return 'var(--icon-panels)';
    if (key === 'settings.paths') return 'var(--icon-folders)';
    if (key === 'settings.proxyConfigTitle') return 'var(--icon-slider-h)';
    if (key === 'settings.logs') return 'var(--icon-doc)';
    return '';
  };

  const mapFillByI18nKey = (key) => {
    if (!key) return '';
    if (key === 'status.quick') return 'var(--icon-fill-config)';
    if (key === 'status.proxyMode') return 'var(--icon-fill-dashboard)';
    if (key === 'status.connLiveTitle') return 'var(--icon-fill-connections)';
    if (key === 'status.trafficTitle') return 'var(--icon-fill-clock)';
    if (key === 'status.topologyTitle') return 'var(--icon-fill-topology)';
    if (key === 'overview.runningTitle') return 'var(--icon-fill-dashboard)';
    if (key === 'overview.networkTitle') return 'var(--icon-fill-worldwide)';
    if (key === 'overview.providerTrafficTitle') return 'var(--icon-fill-clock)';
    if (key === 'overview.rulesOverviewTitle') return 'var(--icon-fill-default)';
    if (key === 'install.title') return 'var(--icon-fill-warning)';
    if (key === 'install.kernelsTitle') return 'var(--icon-fill-kernel)';
    if (key === 'control.title') return 'var(--icon-fill-config)';
    if (key === 'control.recommendationsTitle') return 'var(--icon-fill-default)';
    if (key === 'logs.title') return 'var(--icon-fill-logs)';
    if (key === 'clean.title') return 'var(--icon-fill-warning)';
    if (key === 'help.title') return 'var(--icon-fill-help)';
    if (key === 'help.introTitle') return 'var(--icon-fill-default)';
    if (key === 'help.ackTitle') return 'var(--icon-fill-default)';
    if (key === 'settings.panelManager') return 'var(--icon-fill-overview)';
    if (key === 'settings.paths') return 'var(--icon-fill-worldwide)';
    if (key === 'settings.proxyConfigTitle') return 'var(--icon-fill-config)';
    if (key === 'settings.logs') return 'var(--icon-fill-logs)';
    if (key === 'settings.appearance') return 'var(--icon-fill-help)';
    return '';
  };

  const mapIcon = (text) => {
    const tname = (text || '').toLowerCase();
    if (tname.includes('network history')) return 'var(--icon-clock)';
    if (tname.includes('running status')) return 'var(--icon-activity)';
    if (tname.includes('realtime connections') || tname.includes('real-time connections') || tname.includes('实时连接')) return 'var(--icon-connections)';
    if (tname.includes('network status')) return 'var(--icon-wifi)';
    if (tname.includes('privileged helper') || tname.includes('特权助手')) return 'var(--icon-shield)';
    if (tname.includes('kernel list')) return 'var(--icon-list)';
    if (tname.includes('recommended configs')) return 'var(--icon-list)';
    if (tname.includes('backup inventory')) return 'var(--icon-list)';
    if (tname.includes('switch kernel')) return 'var(--icon-checklist)';
    if (tname.includes('config control')) return 'var(--icon-checklist)';
    if (tname.includes('panel manager')) return 'var(--icon-panels)';
    if (tname.includes('outbound mode')) return 'var(--icon-outbound)';
    if (tname.includes('user data paths')) return 'var(--icon-folders)';
    if (tname.includes('pagination')) return 'var(--icon-slider-h)';
    if (tname.includes('appearance')) return 'var(--icon-palette)';
    if (tname.includes('defaults')) return 'var(--icon-defaults)';
    if (tname.includes('clashflox logs')) return 'var(--icon-journal)';
    if (tname.includes('clean logs')) return 'var(--icon-broom)';
    if (tname.includes('introduction')) return 'var(--icon-info)';
    if (tname.includes('overview') || tname.includes('status')) return 'var(--icon-overview)';
    if (tname.includes('quick') || tname.includes('action')) return 'var(--icon-sliders)';
    if (tname.includes('install') || tname.includes('update') || tname.includes('download')) return 'var(--icon-download)';
    if (tname.includes('switch')) return 'var(--icon-switch)';
    if (tname.includes('config')) return 'var(--icon-gear)';
    if (tname.includes('backup')) return 'var(--icon-backup)';
    if (tname.includes('log')) return 'var(--icon-doc)';
    if (tname.includes('network')) return 'var(--icon-overview)';
    if (tname.includes('help')) return 'var(--icon-help)';
    return 'var(--icon-gear)';
  };

  const mapFill = (text) => {
    const tname = (text || '').toLowerCase();
    if (tname.includes('network history')) return 'var(--icon-fill-clock)';
    if (tname.includes('running status')) return 'var(--icon-fill-dashboard)';
    if (tname.includes('realtime connections') || tname.includes('real-time connections') || tname.includes('实时连接')) return 'var(--icon-fill-connections)';
    if (tname.includes('privileged helper') || tname.includes('特权助手')) return 'var(--icon-fill-settings)';
    if (tname.includes('panel manager')) return 'var(--icon-fill-overview)';
    if (tname.includes('outbound mode')) return 'var(--icon-fill-dashboard)';
    if (tname.includes('user data paths')) return 'var(--icon-fill-worldwide)';
    if (tname.includes('appearance')) return 'var(--icon-fill-help)';
    if (tname.includes('log')) return 'var(--icon-fill-logs)';
    if (tname.includes('config')) return 'var(--icon-fill-config)';
    if (tname.includes('quick') || tname.includes('action')) return 'var(--icon-fill-config)';
    if (tname.includes('overview') || tname.includes('status')) return 'var(--icon-fill-overview)';
    if (tname.includes('help')) return 'var(--icon-fill-help)';
    return 'var(--icon-fill-default)';
  };

  document.querySelectorAll('.card h3').forEach((h) => {
    h.classList.add('iconized');

    const explicitIcon = (h.dataset.cardIcon || '').trim();
    if (explicitIcon) {
      const iconVar = explicitIcon.startsWith('var(') ? explicitIcon : `var(--icon-${explicitIcon})`;
      h.style.setProperty('--card-icon-mask', iconVar);
      h.style.setProperty('--card-icon-fill', 'var(--icon-fill-list)');
      return;
    }

    // Respect explicit icon classes to avoid i18n text matching side effects.
    if (
      h.classList.contains('outbound-icon')
      || h.classList.contains('conn-live-icon')
      || h.classList.contains('topology-icon')
      || h.classList.contains('quick-actions-icon')
      || h.classList.contains('provider-subscription-icon')
      || h.classList.contains('rules-overview-icon')
    ) {
      h.style.removeProperty('--card-icon-mask');
      h.style.removeProperty('--card-icon-fill');
      return;
    }

    const iconByKey = mapIconByI18nKey(h.dataset.i18n || '');
    const fillByKey = mapFillByI18nKey(h.dataset.i18n || '');
    if (iconByKey) {
      h.style.setProperty('--card-icon-mask', iconByKey);
      if (fillByKey) h.style.setProperty('--card-icon-fill', fillByKey);
      return;
    }

    const text = h.textContent || '';
    const icon = mapIcon(text);
    const fill = mapFill(text);
    h.style.setProperty('--card-icon-mask', icon);
    h.style.setProperty('--card-icon-fill', fill);
  });
}

function setLanguage(lang, persist = true, refreshStatus = true) {
  state.lang = lang;
  langButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });
  if (settingsLang) {
    settingsLang.value = lang;
  }
  if (persist) {
    saveSettings({ lang });
  }
  applyI18n();
  if (lang === 'auto') {
    refreshSystemLocaleFromMain(true).catch(() => {});
  }
  if (refreshStatus) {
    loadStatus();
  }
}

function normalizeSettingsForUi(settings) {
  const normalized = { ...(settings || {}) };
  const appearance = normalized.appearance && typeof normalized.appearance === 'object'
    ? normalized.appearance
    : {};
  const trayMenu = normalized.trayMenu && typeof normalized.trayMenu === 'object'
    ? normalized.trayMenu
    : {};
  const readAppearanceString = (key, fallback = '') => {
    const top = normalized[key];
    if (typeof top === 'string' && top.trim()) {
      return top.trim();
    }
    const inner = appearance[key];
    if (typeof inner === 'string' && inner.trim()) {
      return inner.trim();
    }
    return fallback;
  };
  const readAppearanceBool = (key, fallback = false) => {
    if (Object.prototype.hasOwnProperty.call(normalized, key)) {
      return Boolean(normalized[key]);
    }
    if (Object.prototype.hasOwnProperty.call(appearance, key)) {
      return Boolean(appearance[key]);
    }
    return fallback;
  };
  const readTrayMenuBool = (key, fallback = false) => {
    if (Object.prototype.hasOwnProperty.call(normalized, key)) {
      return Boolean(normalized[key]);
    }
    if (Object.prototype.hasOwnProperty.call(trayMenu, key)) {
      return Boolean(trayMenu[key]);
    }
    if (Object.prototype.hasOwnProperty.call(appearance, key)) {
      return Boolean(appearance[key]);
    }
    return fallback;
  };
  const readAppearanceNum = (key, fallback = 0) => {
    const top = Object.prototype.hasOwnProperty.call(normalized, key) ? normalized[key] : undefined;
    const inner = Object.prototype.hasOwnProperty.call(appearance, key) ? appearance[key] : undefined;
    const candidate = top !== undefined ? top : inner;
    const parsed = Number.parseInt(String(candidate ?? ''), 10);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  normalized.lang = readAppearanceString('lang', 'auto');
  normalized.theme = readAppearanceString('theme', 'auto');
  normalized.debugMode = readAppearanceBool('debugMode', false);
  normalized.acceptBeta = readAppearanceBool('acceptBeta', false);
  normalized.githubUser = readAppearanceString('githubUser', 'vernesong');
  normalized.chartEnabled = readTrayMenuBool('chartEnabled', readTrayMenuBool('trayMenuChartEnabled', true));
  normalized.providerTrafficEnabled = readTrayMenuBool('providerTrafficEnabled', readTrayMenuBool('trayMenuProviderTrafficEnabled', true));
  normalized.trackersEnabled = readTrayMenuBool('trackersEnabled', readTrayMenuBool('trayMenuTrackersEnabled', true));
  normalized.foxboardEnabled = readTrayMenuBool('foxboardEnabled', readTrayMenuBool('trayMenuFoxboardEnabled', true));
  normalized.kernelManagerEnabled = readTrayMenuBool('kernelManagerEnabled', readTrayMenuBool('trayMenuKernelManagerEnabled', true));
  normalized.directoryLocationsEnabled = readTrayMenuBool('directoryLocationsEnabled', readTrayMenuBool('trayMenuDirectoryLocationsEnabled', true));
  normalized.copyShellExportCommandEnabled = readTrayMenuBool('copyShellExportCommandEnabled', readTrayMenuBool('trayMenuCopyShellExportCommandEnabled', true));
  normalized.windowWidth = readAppearanceNum('windowWidth', MAIN_WINDOW_DEFAULT_WIDTH);
  normalized.windowHeight = readAppearanceNum('windowHeight', MAIN_WINDOW_DEFAULT_HEIGHT);
  normalized.mainWindowClosed = readAppearanceBool('mainWindowClosed', false);
  normalized.sidebarCollapsed = readAppearanceBool('sidebarCollapsed', false);
  normalized.logLines = readAppearanceNum('logLines', 10);
  normalized.logAutoRefresh = readAppearanceBool('logAutoRefresh', false);
  normalized.logIntervalPreset = readAppearanceString('logIntervalPreset', '3');

  const legacyGeneralPageSize = normalized.generalPageSize || normalized.backupsPageSize || normalized.kernelPageSize || '10';
  const unifiedPageSize = readAppearanceString('generalPageSize', String(legacyGeneralPageSize || '10')) || '10';
  normalized.generalPageSize = unifiedPageSize;
  normalized.appearance = {
    ...appearance,
    lang: normalized.lang,
    theme: normalized.theme,
    debugMode: normalized.debugMode,
    acceptBeta: normalized.acceptBeta,
    githubUser: normalized.githubUser,
    windowWidth: normalized.windowWidth,
    windowHeight: normalized.windowHeight,
    mainWindowClosed: normalized.mainWindowClosed,
    generalPageSize: normalized.generalPageSize,
    logLines: normalized.logLines,
    logAutoRefresh: normalized.logAutoRefresh,
    logIntervalPreset: normalized.logIntervalPreset,
  };
  normalized.trayMenu = {
    ...trayMenu,
    chartEnabled: normalized.chartEnabled,
    providerTrafficEnabled: normalized.providerTrafficEnabled,
    trackersEnabled: normalized.trackersEnabled,
    foxboardEnabled: normalized.foxboardEnabled,
    kernelManagerEnabled: normalized.kernelManagerEnabled,
    directoryLocationsEnabled: normalized.directoryLocationsEnabled,
    copyShellExportCommandEnabled: normalized.copyShellExportCommandEnabled,
  };

  const panelManager = normalized.panelManager && typeof normalized.panelManager === 'object'
    ? normalized.panelManager
    : {};
  const normalizeAuthList = (value) => {
    const source = Array.isArray(value)
      ? value
      : (typeof value === 'string' ? [value] : []);
    return source.map((item) => String(item || '').trim()).filter(Boolean);
  };
  const authList = normalizeAuthList(
    Array.isArray(normalized.authentication) && normalized.authentication.length
      ? normalized.authentication
      : panelManager.authentication,
  );
  normalized.panelManager = {
    ...panelManager,
    panelChoice: (normalized.panelChoice || panelManager.panelChoice || 'zashboard'),
    externalUi: (normalized.externalUi || panelManager.externalUi || 'ui'),
    externalController: (normalized.externalController || panelManager.externalController || '127.0.0.1:9090'),
    secret: (normalized.secret || panelManager.secret || 'clashfox'),
    authentication: authList.length ? authList : ['mihomo:clashfox'],
  };
  if (!normalized.panelChoice) {
    normalized.panelChoice = normalized.panelManager.panelChoice;
  }
  if (!normalized.externalUi) {
    normalized.externalUi = normalized.panelManager.externalUi;
  }
  if (!normalized.externalController) {
    normalized.externalController = normalized.panelManager.externalController;
  }
  if (!normalized.secret) {
    normalized.secret = normalized.panelManager.secret;
  }
  normalized.authentication = normalized.panelManager.authentication;
  normalized.proxy = normalizeProxyMode(normalized.proxy || 'rule');
  normalized.systemProxy = Boolean(normalized.systemProxy);
  normalized.tun = Boolean(normalized.tun);
  normalized.stack = normalizeTunStack(normalized.stack || 'Mixed');
  normalized.mixedPort = Number.parseInt(String(normalized.mixedPort ?? ''), 10) || 7893;
  normalized.port = Number.parseInt(String(normalized.port ?? ''), 10) || 7890;
  normalized.socksPort = Number.parseInt(String(normalized.socksPort ?? ''), 10) || 7891;
  normalized.allowLan = Object.prototype.hasOwnProperty.call(normalized, 'allowLan')
    ? Boolean(normalized.allowLan)
    : true;

  const userDataPaths = normalized.userDataPaths && typeof normalized.userDataPaths === 'object'
    ? normalized.userDataPaths
    : {};
  if (!normalized.configFile && typeof userDataPaths.configFile === 'string') {
    normalized.configFile = userDataPaths.configFile;
  }
  if (!normalized.configDir && typeof userDataPaths.configDir === 'string') {
    normalized.configDir = userDataPaths.configDir;
  }
  if (!normalized.coreDir && typeof userDataPaths.coreDir === 'string') {
    normalized.coreDir = userDataPaths.coreDir;
  }
  if (!normalized.dataDir && typeof userDataPaths.dataDir === 'string') {
    normalized.dataDir = userDataPaths.dataDir;
  }
  if (!normalized.logDir && typeof userDataPaths.logDir === 'string') {
    normalized.logDir = userDataPaths.logDir;
  }
  if (!normalized.pidDir && typeof userDataPaths.pidDir === 'string') {
    normalized.pidDir = userDataPaths.pidDir;
  }
  if (!normalized.kernel || typeof normalized.kernel !== 'object') {
    normalized.kernel = {};
  }
  if (!normalized.configPath && typeof normalized.configFile === 'string') {
    normalized.configPath = normalized.configFile;
  }
  normalized.backupsPageSize = unifiedPageSize;
  normalized.switchPageSize = unifiedPageSize;
  normalized.configPageSize = unifiedPageSize;
  normalized.recommendPageSize = unifiedPageSize;
  if (Object.prototype.hasOwnProperty.call(normalized, 'configFile')) {
    delete normalized.configFile;
  }
  return normalized;
}

function getGeneralPageSizeValue() {
  const raw = String(
    (state.settings && state.settings.generalPageSize)
    || (state.fileSettings && state.fileSettings.generalPageSize)
    || '10',
  ).trim();
  return raw || '10';
}

function mapSettingsForFile(settings) {
  const mapped = { ...(settings || {}) };
  const existingAppearance = mapped.appearance && typeof mapped.appearance === 'object'
    ? mapped.appearance
    : {};
  const existingTrayMenu = mapped.trayMenu && typeof mapped.trayMenu === 'object'
    ? mapped.trayMenu
    : {};
  mapped.proxy = normalizeProxyMode(mapped.proxy || 'rule');
  mapped.systemProxy = Boolean(mapped.systemProxy);
  mapped.tun = Boolean(mapped.tun);
  mapped.stack = normalizeTunStack(mapped.stack || 'Mixed');
  mapped.mixedPort = Number.parseInt(String(mapped.mixedPort ?? ''), 10) || 7893;
  mapped.port = Number.parseInt(String(mapped.port ?? ''), 10) || 7890;
  mapped.socksPort = Number.parseInt(String(mapped.socksPort ?? ''), 10) || 7891;
  mapped.allowLan = Object.prototype.hasOwnProperty.call(mapped, 'allowLan')
    ? Boolean(mapped.allowLan)
    : true;
  mapped.appearance = {
    ...existingAppearance,
    lang: String(mapped.lang || existingAppearance.lang || 'auto'),
    theme: String(mapped.theme || existingAppearance.theme || 'auto'),
    debugMode: Object.prototype.hasOwnProperty.call(mapped, 'debugMode')
      ? Boolean(mapped.debugMode)
      : Boolean(existingAppearance.debugMode),
    acceptBeta: Object.prototype.hasOwnProperty.call(mapped, 'acceptBeta')
      ? Boolean(mapped.acceptBeta)
      : Boolean(existingAppearance.acceptBeta),
    githubUser: String(mapped.githubUser || existingAppearance.githubUser || 'vernesong'),
    windowWidth: Number.parseInt(String(mapped.windowWidth ?? existingAppearance.windowWidth ?? MAIN_WINDOW_DEFAULT_WIDTH), 10) || MAIN_WINDOW_DEFAULT_WIDTH,
    windowHeight: Number.parseInt(String(mapped.windowHeight ?? existingAppearance.windowHeight ?? MAIN_WINDOW_DEFAULT_HEIGHT), 10) || MAIN_WINDOW_DEFAULT_HEIGHT,
    mainWindowClosed: Object.prototype.hasOwnProperty.call(mapped, 'mainWindowClosed')
      ? Boolean(mapped.mainWindowClosed)
      : Boolean(existingAppearance.mainWindowClosed),
    generalPageSize: String(
      mapped.generalPageSize
      || existingAppearance.generalPageSize
      || mapped.backupsPageSize
      || mapped.kernelPageSize
      || '10'
    ).trim() || '10',
    logLines: Number.parseInt(String(mapped.logLines ?? existingAppearance.logLines ?? 10), 10) || 10,
    logAutoRefresh: Object.prototype.hasOwnProperty.call(mapped, 'logAutoRefresh')
      ? Boolean(mapped.logAutoRefresh)
      : Boolean(existingAppearance.logAutoRefresh),
    logIntervalPreset: String(mapped.logIntervalPreset || existingAppearance.logIntervalPreset || '3'),
  };
  mapped.trayMenu = {
    ...existingTrayMenu,
    chartEnabled: Object.prototype.hasOwnProperty.call(mapped, 'chartEnabled')
      ? Boolean(mapped.chartEnabled)
      : (Object.prototype.hasOwnProperty.call(mapped, 'trayMenuChartEnabled')
        ? Boolean(mapped.trayMenuChartEnabled)
        : (Object.prototype.hasOwnProperty.call(existingTrayMenu, 'chartEnabled')
          ? Boolean(existingTrayMenu.chartEnabled)
          : (Object.prototype.hasOwnProperty.call(existingTrayMenu, 'trayMenuChartEnabled')
            ? Boolean(existingTrayMenu.trayMenuChartEnabled)
            : Boolean(existingAppearance.chartEnabled ?? existingAppearance.trayMenuChartEnabled)))),
    providerTrafficEnabled: Object.prototype.hasOwnProperty.call(mapped, 'providerTrafficEnabled')
      ? Boolean(mapped.providerTrafficEnabled)
      : (Object.prototype.hasOwnProperty.call(mapped, 'trayMenuProviderTrafficEnabled')
        ? Boolean(mapped.trayMenuProviderTrafficEnabled)
        : (Object.prototype.hasOwnProperty.call(existingTrayMenu, 'providerTrafficEnabled')
          ? Boolean(existingTrayMenu.providerTrafficEnabled)
          : (Object.prototype.hasOwnProperty.call(existingTrayMenu, 'trayMenuProviderTrafficEnabled')
            ? Boolean(existingTrayMenu.trayMenuProviderTrafficEnabled)
            : Boolean(existingAppearance.providerTrafficEnabled ?? existingAppearance.trayMenuProviderTrafficEnabled)))),
    trackersEnabled: Object.prototype.hasOwnProperty.call(mapped, 'trackersEnabled')
      ? Boolean(mapped.trackersEnabled)
      : (Object.prototype.hasOwnProperty.call(mapped, 'trayMenuTrackersEnabled')
        ? Boolean(mapped.trayMenuTrackersEnabled)
        : (Object.prototype.hasOwnProperty.call(existingTrayMenu, 'trackersEnabled')
          ? Boolean(existingTrayMenu.trackersEnabled)
          : (Object.prototype.hasOwnProperty.call(existingTrayMenu, 'trayMenuTrackersEnabled')
            ? Boolean(existingTrayMenu.trayMenuTrackersEnabled)
            : Boolean(existingAppearance.trackersEnabled ?? existingAppearance.trayMenuTrackersEnabled)))),
    foxboardEnabled: Object.prototype.hasOwnProperty.call(mapped, 'foxboardEnabled')
      ? Boolean(mapped.foxboardEnabled)
      : (Object.prototype.hasOwnProperty.call(mapped, 'trayMenuFoxboardEnabled')
        ? Boolean(mapped.trayMenuFoxboardEnabled)
        : (Object.prototype.hasOwnProperty.call(existingTrayMenu, 'foxboardEnabled')
          ? Boolean(existingTrayMenu.foxboardEnabled)
          : (Object.prototype.hasOwnProperty.call(existingTrayMenu, 'trayMenuFoxboardEnabled')
            ? Boolean(existingTrayMenu.trayMenuFoxboardEnabled)
            : Boolean(existingAppearance.foxboardEnabled ?? existingAppearance.trayMenuFoxboardEnabled)))),
    kernelManagerEnabled: Object.prototype.hasOwnProperty.call(mapped, 'kernelManagerEnabled')
      ? Boolean(mapped.kernelManagerEnabled)
      : (Object.prototype.hasOwnProperty.call(mapped, 'trayMenuKernelManagerEnabled')
        ? Boolean(mapped.trayMenuKernelManagerEnabled)
        : (Object.prototype.hasOwnProperty.call(existingTrayMenu, 'kernelManagerEnabled')
          ? Boolean(existingTrayMenu.kernelManagerEnabled)
          : (Object.prototype.hasOwnProperty.call(existingTrayMenu, 'trayMenuKernelManagerEnabled')
            ? Boolean(existingTrayMenu.trayMenuKernelManagerEnabled)
            : Boolean(existingAppearance.kernelManagerEnabled ?? existingAppearance.trayMenuKernelManagerEnabled)))),
    directoryLocationsEnabled: Object.prototype.hasOwnProperty.call(mapped, 'directoryLocationsEnabled')
      ? Boolean(mapped.directoryLocationsEnabled)
      : (Object.prototype.hasOwnProperty.call(mapped, 'trayMenuDirectoryLocationsEnabled')
        ? Boolean(mapped.trayMenuDirectoryLocationsEnabled)
        : (Object.prototype.hasOwnProperty.call(existingTrayMenu, 'directoryLocationsEnabled')
          ? Boolean(existingTrayMenu.directoryLocationsEnabled)
          : (Object.prototype.hasOwnProperty.call(existingTrayMenu, 'trayMenuDirectoryLocationsEnabled')
            ? Boolean(existingTrayMenu.trayMenuDirectoryLocationsEnabled)
            : Boolean(existingAppearance.directoryLocationsEnabled ?? existingAppearance.trayMenuDirectoryLocationsEnabled)))),
    copyShellExportCommandEnabled: Object.prototype.hasOwnProperty.call(mapped, 'copyShellExportCommandEnabled')
      ? Boolean(mapped.copyShellExportCommandEnabled)
      : (Object.prototype.hasOwnProperty.call(mapped, 'trayMenuCopyShellExportCommandEnabled')
        ? Boolean(mapped.trayMenuCopyShellExportCommandEnabled)
        : (Object.prototype.hasOwnProperty.call(existingTrayMenu, 'copyShellExportCommandEnabled')
          ? Boolean(existingTrayMenu.copyShellExportCommandEnabled)
          : (Object.prototype.hasOwnProperty.call(existingTrayMenu, 'trayMenuCopyShellExportCommandEnabled')
            ? Boolean(existingTrayMenu.trayMenuCopyShellExportCommandEnabled)
            : Boolean(existingAppearance.copyShellExportCommandEnabled ?? existingAppearance.trayMenuCopyShellExportCommandEnabled)))),
  };
  const existingPanelManager = mapped.panelManager && typeof mapped.panelManager === 'object'
    ? mapped.panelManager
    : {};
  const normalizeAuthList = (value) => {
    const source = Array.isArray(value)
      ? value
      : (typeof value === 'string' ? [value] : []);
    return source.map((item) => String(item || '').trim()).filter(Boolean);
  };
  mapped.panelManager = {
    ...existingPanelManager,
    panelChoice: String(mapped.panelChoice || existingPanelManager.panelChoice || 'zashboard'),
    externalUi: String(mapped.externalUi || existingPanelManager.externalUi || 'ui'),
    externalController: String(mapped.externalController || existingPanelManager.externalController || '127.0.0.1:9090'),
    secret: String(mapped.secret || existingPanelManager.secret || 'clashfox'),
    authentication: (() => {
      const auth = normalizeAuthList(
        Array.isArray(mapped.authentication) && mapped.authentication.length
          ? mapped.authentication
          : existingPanelManager.authentication,
      );
      return auth.length ? auth : ['mihomo:clashfox'];
    })(),
  };
  const existingPaths = mapped.userDataPaths && typeof mapped.userDataPaths === 'object'
    ? mapped.userDataPaths
    : {};
  mapped.userDataPaths = {
    ...existingPaths,
    ...(mapped.configFile ? { configFile: String(mapped.configFile) } : {}),
    ...(mapped.configDir ? { configDir: String(mapped.configDir) } : {}),
    ...(mapped.coreDir ? { coreDir: String(mapped.coreDir) } : {}),
    ...(mapped.dataDir ? { dataDir: String(mapped.dataDir) } : {}),
    ...(mapped.logDir ? { logDir: String(mapped.logDir) } : {}),
    ...(mapped.pidDir ? { pidDir: String(mapped.pidDir) } : {}),
  };
  if (typeof mapped.configPath === 'string') {
    mapped.userDataPaths.configFile = mapped.configPath;
  }
  if (Object.prototype.hasOwnProperty.call(mapped, 'switchPageSize')) {
    delete mapped.switchPageSize;
  }
  if (Object.prototype.hasOwnProperty.call(mapped, 'kernelPageSize')) {
    delete mapped.kernelPageSize;
  }
  if (Object.prototype.hasOwnProperty.call(mapped, 'backupsPageSize')) {
    delete mapped.backupsPageSize;
  }
  if (Object.prototype.hasOwnProperty.call(mapped, 'configPageSize')) {
    delete mapped.configPageSize;
  }
  if (Object.prototype.hasOwnProperty.call(mapped, 'recommendPageSize')) {
    delete mapped.recommendPageSize;
  }
  // Kernel identity is maintained by main process command results.
  if (Object.prototype.hasOwnProperty.call(mapped, 'kernelVersion')) {
    delete mapped.kernelVersion;
  }
  if (Object.prototype.hasOwnProperty.call(mapped, 'kernelVersionMeta')) {
    delete mapped.kernelVersionMeta;
  }
  if (Object.prototype.hasOwnProperty.call(mapped, 'kernel')) {
    delete mapped.kernel;
  }
  if (Object.prototype.hasOwnProperty.call(mapped, 'configPath')) {
    delete mapped.configPath;
  }
  if (Object.prototype.hasOwnProperty.call(mapped, 'configFile')) {
    delete mapped.configFile;
  }
  if (Object.prototype.hasOwnProperty.call(mapped, 'configDir')) {
    delete mapped.configDir;
  }
  if (Object.prototype.hasOwnProperty.call(mapped, 'coreDir')) {
    delete mapped.coreDir;
  }
  if (Object.prototype.hasOwnProperty.call(mapped, 'dataDir')) {
    delete mapped.dataDir;
  }
  if (Object.prototype.hasOwnProperty.call(mapped, 'logDir')) {
    delete mapped.logDir;
  }
  if (Object.prototype.hasOwnProperty.call(mapped, 'pidDir')) {
    delete mapped.pidDir;
  }
  if (Object.prototype.hasOwnProperty.call(mapped, 'panelChoice')) {
    delete mapped.panelChoice;
  }
  if (Object.prototype.hasOwnProperty.call(mapped, 'externalUi')) {
    delete mapped.externalUi;
  }
  if (Object.prototype.hasOwnProperty.call(mapped, 'externalController')) {
    delete mapped.externalController;
  }
  if (Object.prototype.hasOwnProperty.call(mapped, 'secret')) {
    delete mapped.secret;
  }
  if (Object.prototype.hasOwnProperty.call(mapped, 'authentication')) {
    delete mapped.authentication;
  }
  if (Object.prototype.hasOwnProperty.call(mapped, 'lang')) {
    delete mapped.lang;
  }
  if (Object.prototype.hasOwnProperty.call(mapped, 'theme')) {
    delete mapped.theme;
  }
  if (Object.prototype.hasOwnProperty.call(mapped, 'debugMode')) {
    delete mapped.debugMode;
  }
  if (Object.prototype.hasOwnProperty.call(mapped, 'acceptBeta')) {
    delete mapped.acceptBeta;
  }
  if (Object.prototype.hasOwnProperty.call(mapped, 'githubUser')) {
    delete mapped.githubUser;
  }
  if (Object.prototype.hasOwnProperty.call(mapped, 'chartEnabled')) {
    delete mapped.chartEnabled;
  }
  if (Object.prototype.hasOwnProperty.call(mapped, 'providerTrafficEnabled')) {
    delete mapped.providerTrafficEnabled;
  }
  if (Object.prototype.hasOwnProperty.call(mapped, 'trackersEnabled')) {
    delete mapped.trackersEnabled;
  }
  if (Object.prototype.hasOwnProperty.call(mapped, 'foxboardEnabled')) {
    delete mapped.foxboardEnabled;
  }
  if (Object.prototype.hasOwnProperty.call(mapped, 'kernelManagerEnabled')) {
    delete mapped.kernelManagerEnabled;
  }
  if (Object.prototype.hasOwnProperty.call(mapped, 'directoryLocationsEnabled')) {
    delete mapped.directoryLocationsEnabled;
  }
  if (Object.prototype.hasOwnProperty.call(mapped, 'trayMenuChartEnabled')) {
    delete mapped.trayMenuChartEnabled;
  }
  if (Object.prototype.hasOwnProperty.call(mapped, 'trayMenuProviderTrafficEnabled')) {
    delete mapped.trayMenuProviderTrafficEnabled;
  }
  if (Object.prototype.hasOwnProperty.call(mapped, 'trayMenuTrackersEnabled')) {
    delete mapped.trayMenuTrackersEnabled;
  }
  if (Object.prototype.hasOwnProperty.call(mapped, 'trayMenuFoxboardEnabled')) {
    delete mapped.trayMenuFoxboardEnabled;
  }
  if (Object.prototype.hasOwnProperty.call(mapped, 'trayMenuKernelManagerEnabled')) {
    delete mapped.trayMenuKernelManagerEnabled;
  }
  if (Object.prototype.hasOwnProperty.call(mapped, 'trayMenuDirectoryLocationsEnabled')) {
    delete mapped.trayMenuDirectoryLocationsEnabled;
  }
  if (Object.prototype.hasOwnProperty.call(mapped, 'copyShellExportCommandEnabled')) {
    delete mapped.copyShellExportCommandEnabled;
  }
  if (Object.prototype.hasOwnProperty.call(mapped, 'trayMenuCopyShellExportCommandEnabled')) {
    delete mapped.trayMenuCopyShellExportCommandEnabled;
  }
  if (Object.prototype.hasOwnProperty.call(mapped, 'windowWidth')) {
    delete mapped.windowWidth;
  }
  if (Object.prototype.hasOwnProperty.call(mapped, 'windowHeight')) {
    delete mapped.windowHeight;
  }
  if (Object.prototype.hasOwnProperty.call(mapped, 'mainWindowClosed')) {
    delete mapped.mainWindowClosed;
  }
  if (Object.prototype.hasOwnProperty.call(mapped, 'generalPageSize')) {
    delete mapped.generalPageSize;
  }
  if (Object.prototype.hasOwnProperty.call(mapped, 'logLines')) {
    delete mapped.logLines;
  }
  if (Object.prototype.hasOwnProperty.call(mapped, 'logAutoRefresh')) {
    delete mapped.logAutoRefresh;
  }
  if (Object.prototype.hasOwnProperty.call(mapped, 'logIntervalPreset')) {
    delete mapped.logIntervalPreset;
  }
  if (Object.prototype.hasOwnProperty.call(mapped, 'overviewTopOrder')) {
    delete mapped.overviewTopOrder;
  }
  if (Object.prototype.hasOwnProperty.call(mapped, 'captureMixedPort')) {
    delete mapped.captureMixedPort;
  }
  if (Object.prototype.hasOwnProperty.call(mapped, 'captureHttpPort')) {
    delete mapped.captureHttpPort;
  }
  if (Object.prototype.hasOwnProperty.call(mapped, 'captureSocksPort')) {
    delete mapped.captureSocksPort;
  }
  if (Object.prototype.hasOwnProperty.call(mapped, 'captureTunMode')) {
    delete mapped.captureTunMode;
  }
  if (Object.prototype.hasOwnProperty.call(mapped, 'captureAllowLan')) {
    delete mapped.captureAllowLan;
  }
  return mapped;
}

function readSettings() {
  const raw = localStorage.getItem(SETTINGS_KEY);
  if (!raw) {
    return { ...DEFAULT_SETTINGS, ...(state.fileSettings || {}) };
  }
  try {
    const parsed = normalizeSettingsForUi(JSON.parse(raw));
    const merged = { ...DEFAULT_SETTINGS, ...parsed };
    if (state.fileSettings) {
      if (!merged.configPath && state.fileSettings.configPath) merged.configPath = state.fileSettings.configPath;
      if (!merged.configDir && state.fileSettings.configDir) merged.configDir = state.fileSettings.configDir;
      if (!merged.coreDir && state.fileSettings.coreDir) merged.coreDir = state.fileSettings.coreDir;
      if (!merged.dataDir && state.fileSettings.dataDir) merged.dataDir = state.fileSettings.dataDir;
      if (!merged.logDir && state.fileSettings.logDir) merged.logDir = state.fileSettings.logDir;
      if (!merged.pidDir && state.fileSettings.pidDir) merged.pidDir = state.fileSettings.pidDir;
    }
    if (merged.configPath && (!parsed.configPath || parsed.configPath !== merged.configPath)) {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
    }
    return merged;
  } catch {
    return { ...DEFAULT_SETTINGS, ...(state.fileSettings || {}) };
  }
}

async function syncSettingsFromFile() {
  if (!window.clashfox || typeof window.clashfox.readSettings !== 'function') {
    return;
  }
  const response = await window.clashfox.readSettings();
  if (!response || !response.ok || !response.data) {
    return;
  }
  const merged = normalizeSettingsForUi({ ...DEFAULT_SETTINGS, ...response.data });
  if (window.clashfox && typeof window.clashfox.getUserDataPath === 'function') {
    const userData = await window.clashfox.getUserDataPath();
    if (userData && userData.ok && userData.path) {
      const base = userData.path;
      if (!merged.configDir) {
        merged.configDir = `${base}/config`;
      }
      if (!merged.coreDir) {
        merged.coreDir = `${base}/core`;
      }
      if (!merged.dataDir) {
        merged.dataDir = `${base}/data`;
      }
      if (!merged.logDir) {
        merged.logDir = `${base}/logs`;
      }
      if (!merged.pidDir) {
        merged.pidDir = `${base}/runtime`;
      }
    }
  }
  state.fileSettings = { ...merged };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
  if (window.clashfox && typeof window.clashfox.writeSettings === 'function') {
    const { externalUiUrl, externalUiName, ...restSettings } = merged;
    const fileSettings = mapSettingsForFile(restSettings);
    window.clashfox.writeSettings(fileSettings);
  }
}

function saveSettings(patch) {
  guiLog('settings', 'saveSettings called', patch);
  const nextPatch = { ...(patch || {}) };
  const nextAppearance = {
    ...((state.settings && state.settings.appearance) || {}),
    ...((state.fileSettings && state.fileSettings.appearance) || {}),
    ...((nextPatch.appearance && typeof nextPatch.appearance === 'object') ? nextPatch.appearance : {}),
  };
  const appearanceKeys = [
    'lang',
    'theme',
    'debugMode',
    'acceptBeta',
    'githubUser',
    'windowWidth',
    'windowHeight',
    'mainWindowClosed',
    'sidebarCollapsed',
    'generalPageSize',
    'logLines',
    'logAutoRefresh',
    'logIntervalPreset',
  ];
  appearanceKeys.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(nextPatch, key)) {
      nextAppearance[key] = nextPatch[key];
    }
  });
  if (Object.keys(nextAppearance).length) {
    nextPatch.appearance = nextAppearance;
  }
  const nextTrayMenu = {
    ...((state.settings && state.settings.trayMenu) || {}),
    ...((state.fileSettings && state.fileSettings.trayMenu) || {}),
    ...((nextPatch.trayMenu && typeof nextPatch.trayMenu === 'object') ? nextPatch.trayMenu : {}),
  };
  const trayMenuKeys = [
    'trayMenuChartEnabled',
    'trayMenuProviderTrafficEnabled',
    'trayMenuTrackersEnabled',
    'trayMenuFoxboardEnabled',
    'trayMenuKernelManagerEnabled',
    'trayMenuDirectoryLocationsEnabled',
    'trayMenuCopyShellExportCommandEnabled',
    'chartEnabled',
    'providerTrafficEnabled',
    'trackersEnabled',
    'foxboardEnabled',
    'kernelManagerEnabled',
    'directoryLocationsEnabled',
    'copyShellExportCommandEnabled',
  ];
  trayMenuKeys.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(nextPatch, key)) {
      nextTrayMenu[key] = nextPatch[key];
    }
  });
  if (Object.keys(nextTrayMenu).length) {
    nextPatch.trayMenu = nextTrayMenu;
  }

  const nextPanelManager = {
    ...((state.settings && state.settings.panelManager) || {}),
    ...((state.fileSettings && state.fileSettings.panelManager) || {}),
    ...((nextPatch.panelManager && typeof nextPatch.panelManager === 'object') ? nextPatch.panelManager : {}),
  };
  if (Object.prototype.hasOwnProperty.call(nextPatch, 'panelChoice')) {
    nextPanelManager.panelChoice = nextPatch.panelChoice;
  }
  if (Object.prototype.hasOwnProperty.call(nextPatch, 'externalUi')) {
    nextPanelManager.externalUi = nextPatch.externalUi;
  }
  if (Object.prototype.hasOwnProperty.call(nextPatch, 'externalController')) {
    nextPanelManager.externalController = nextPatch.externalController;
  }
  if (Object.prototype.hasOwnProperty.call(nextPatch, 'secret')) {
    nextPanelManager.secret = nextPatch.secret;
  }
  if (Object.prototype.hasOwnProperty.call(nextPatch, 'authentication')) {
    nextPanelManager.authentication = Array.isArray(nextPatch.authentication)
      ? nextPatch.authentication
      : [];
  }
  if (Object.keys(nextPanelManager).length) {
    nextPatch.panelManager = nextPanelManager;
  }
  state.settings = { ...state.settings, ...nextPatch };
  state.fileSettings = { ...state.fileSettings, ...nextPatch };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
  if (window.clashfox && typeof window.clashfox.writeSettings === 'function') {
    const { externalUiUrl, externalUiName, ...restSettings } = state.settings;
    const fileSettings = mapSettingsForFile(restSettings);
    Promise.resolve(window.clashfox.writeSettings(fileSettings)).catch((error) => {
      guiLog('settings', 'writeSettings failed', {
        error: error && error.message ? error.message : String(error || ''),
      }, 'error');
    });
  }
}

function resolveTheme(preference) {
  if (preference !== 'auto') {
    return preference;
  }
  if (window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'night' : 'day';
  }
  return 'night';
}

function updateThemeToggle() {
  if (!themeToggle) {
    return;
  }
  const nextTheme = state.theme === 'night' ? 'day' : 'night';
  const key = nextTheme === 'day' ? 'theme.toDay' : 'theme.toNight';
  const label = t(key);
  themeToggle.dataset.i18nTipKey = key;
  themeToggle.dataset.i18nTip = key;
  themeToggle.dataset.tip = label;
  themeToggle.setAttribute('title', label);
  themeToggle.setAttribute('aria-label', label);
}

function refreshNavButtonTooltips() {
  navButtons.forEach((btn) => {
    const label = String(btn.textContent || '').trim();
    if (!label) {
      return;
    }
    btn.dataset.navLabel = label;
    btn.removeAttribute('title');
    btn.setAttribute('aria-label', label);
  });
}

function applySidebarCollapsedState(collapsed = false, persist = false) {
  const topNavMode = isTopNavMode();
  const shouldCollapse = Boolean(collapsed) && !topNavMode;
  if (appShell) {
    appShell.classList.toggle('sidebar-collapsed', shouldCollapse);
  }
  if (menuContainer) {
    menuContainer.classList.toggle('is-collapsed', shouldCollapse);
  }
  if (sidebarCollapseToggle) {
    sidebarCollapseToggle.style.display = topNavMode ? 'none' : '';
    const label = shouldCollapse ? 'Expand sidebar' : 'Collapse sidebar';
    sidebarCollapseToggle.setAttribute('title', label);
    sidebarCollapseToggle.setAttribute('aria-label', label);
  }
  state.settings = { ...DEFAULT_SETTINGS, ...(state.settings || {}), sidebarCollapsed: Boolean(collapsed) };
  if (persist) {
    saveSettings({ sidebarCollapsed: Boolean(collapsed) });
  }
  requestTopNavOverflowSync();
}

function applyOverviewOrder(grid) {
  if (!grid) {
    return;
  }
  const orderKey = grid.dataset.orderKey || 'overviewOrder';
  let order = Array.isArray(state.settings && state.settings[orderKey])
    ? state.settings[orderKey]
    : [];
  if (order.length === 0) {
    return;
  }
  const cards = Array.from(grid.querySelectorAll('[draggable="true"][data-module]'));
  if (cards.length === 0) {
    return;
  }
  const cardMap = new Map(cards.map((card) => [card.dataset.module, card]));
  const fragment = document.createDocumentFragment();
  order.forEach((key) => {
    const card = cardMap.get(key);
    if (card) {
      fragment.appendChild(card);
      cardMap.delete(key);
    }
  });
  cardMap.forEach((card) => fragment.appendChild(card));
  grid.appendChild(fragment);
}

function applyOverviewOrders() {
  if (!overviewGrids || overviewGrids.length === 0) {
    return;
  }
  overviewGrids.forEach((grid) => applyOverviewOrder(grid));
}

function saveOverviewOrder(grid) {
  if (!grid) {
    return;
  }
  const orderKey = grid.dataset.orderKey || 'overviewOrder';
  const order = Array.from(grid.querySelectorAll('[draggable="true"][data-module]'))
    .map((card) => card.dataset.module)
    .filter(Boolean);
  if (order.length === 0) {
    return;
  }
  saveSettings({ [orderKey]: order });
}

function getOverviewInsertTarget(container, x, y) {
  const cards = Array.from(container.querySelectorAll('[draggable="true"][data-module]:not(.is-dragging)'));
  let closest = null;
  let closestDist = Number.POSITIVE_INFINITY;
  let insertBefore = true;
  cards.forEach((card) => {
    const rect = card.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = x - cx;
    const dy = y - cy;
    const dist = Math.hypot(dx, dy);
    if (dist < closestDist) {
      closestDist = dist;
      closest = card;
      const nearRow = Math.abs(dy) < rect.height * 0.2;
      insertBefore = nearRow ? x < cx : y < cy;
    }
  });
  if (!closest) {
    return null;
  }
  return { element: closest, insertBefore };
}

function bindOverviewDrag() {
  if (overviewGrids && overviewGrids.length) {
    overviewGrids.forEach((grid) => {
      grid.querySelectorAll('[draggable="true"][data-module]').forEach((card) => {
        card.removeAttribute('draggable');
      });
    });
  }
  return;
  overviewGrids.forEach((grid) => {
    if (grid.dataset.dragBound === 'true') {
      return;
    }
    grid.dataset.dragBound = 'true';
    let draggingCard = null;
    const cards = () => Array.from(grid.querySelectorAll('[draggable="true"][data-module]'));

    const clearDragging = () => {
      cards().forEach((card) => {
        card.classList.remove('is-dragging');
        card.dataset.dragArmed = '';
        card.style.removeProperty('transform');
        card.style.removeProperty('transition');
      });
      draggingCard = null;
      grid.classList.remove('is-dragging');
    };

    grid.addEventListener('mousedown', (event) => {
      const handle = event.target.closest('.overview-drag-handle');
      if (!handle || !grid.contains(handle)) {
        return;
      }
      const card = handle.closest('[draggable="true"][data-module]');
      if (card) {
        card.dataset.dragArmed = 'true';
      }
    });

    grid.addEventListener('dragstart', (event) => {
      const card = event.target.closest('[draggable="true"][data-module]');
      if (!card || !grid.contains(card) || card.dataset.dragArmed !== 'true') {
        event.preventDefault();
        return;
      }
      draggingCard = card;
      draggingCard.classList.add('is-dragging');
      grid.classList.add('is-dragging');
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', card.dataset.module || '');
    });

    grid.addEventListener('dragover', (event) => {
      if (!draggingCard) {
        return;
      }
      event.preventDefault();
      const target = getOverviewInsertTarget(grid, event.clientX, event.clientY);
      if (!target || target.element === draggingCard) {
        return;
      }
      if (target.insertBefore) {
        grid.insertBefore(draggingCard, target.element);
      } else {
        grid.insertBefore(draggingCard, target.element.nextSibling);
      }
    });

    grid.addEventListener('drop', (event) => {
      if (!draggingCard) {
        return;
      }
      event.preventDefault();
      saveOverviewOrder(grid);
      clearDragging();
    });

    grid.addEventListener('dragend', () => {
      saveOverviewOrder(grid);
      clearDragging();
    });

    grid.addEventListener('mouseup', clearDragging);
  });
}

function updateTipPosition(el) {
  if (!el || !contentRoot) {
    return;
  }
  const rootRect = contentRoot.getBoundingClientRect();
  const rect = el.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const topGap = centerY - rootRect.top;
  const bottomGap = rootRect.bottom - centerY;
  const leftGap = centerX - rootRect.left;
  const rightGap = rootRect.right - centerX;
  const tipText = String(el.dataset.tip || '').trim();
  const estimatedTipWidth = Math.min(320, Math.max(120, tipText.length * 7 + 24));
  const estimatedTipHeight = 42;
  const spacing = 12;
  const halfWidth = estimatedTipWidth / 2;
  const fits = {
    top: topGap >= estimatedTipHeight + spacing && leftGap >= halfWidth && rightGap >= halfWidth,
    bottom: bottomGap >= estimatedTipHeight + spacing && leftGap >= halfWidth && rightGap >= halfWidth,
    left: leftGap >= estimatedTipWidth + spacing,
    right: rightGap >= estimatedTipWidth + spacing,
  };
  if (fits.top) {
    el.dataset.position = 'top';
    return;
  }
  if (fits.bottom) {
    el.dataset.position = 'bottom';
    return;
  }
  if (fits.right) {
    el.dataset.position = 'right';
    return;
  }
  if (fits.left) {
    el.dataset.position = 'left';
    return;
  }
  const spaces = { top: topGap, bottom: bottomGap, right: rightGap, left: leftGap };
  const best = Object.entries(spaces).sort((a, b) => b[1] - a[1])[0];
  el.dataset.position = best ? best[0] : 'top';
}

function applyTheme(theme) {
  state.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  document.body.dataset.theme = theme;
  try {
    localStorage.setItem('lastTheme', theme);
  } catch {}
}

function syncDebugMode(enabled) {
  if (settingsDebugMode) {
    settingsDebugMode.checked = Boolean(enabled);
  }
  if (window.clashfox && typeof window.clashfox.setDebugMode === 'function') {
    window.clashfox.setDebugMode(Boolean(enabled));
  }
}

function applySystemTheme(isDark) {
  if (state.themeSetting !== 'auto') {
    return;
  }
  applyTheme(isDark ? 'night' : 'day');
  sendDashboardTheme();
  updateThemeToggle();
}

function applyThemePreference(preference, persist = true) {
  state.themeSetting = preference;
  if (settingsTheme) {
    settingsTheme.value = preference;
  }
  applyTheme(resolveTheme(preference));
  syncThemeSource(preference);
  sendDashboardTheme();
  if (persist) {
    saveSettings({ theme: preference });
  }
  updateThemeToggle();
}

function applySettings(settings) {
  state.settings = { ...DEFAULT_SETTINGS, ...settings };
  state.settings.windowWidth = sanitizeWindowDimension(
    state.settings.windowWidth,
    MAIN_WINDOW_DEFAULT_WIDTH,
    MAIN_WINDOW_MIN_WIDTH,
    MAIN_WINDOW_MAX_WIDTH,
  );
  state.settings.windowHeight = sanitizeWindowDimension(
    state.settings.windowHeight,
    MAIN_WINDOW_DEFAULT_HEIGHT,
    MAIN_WINDOW_MIN_HEIGHT,
    MAIN_WINDOW_MAX_HEIGHT,
  );
  if (!state.settings.panelChoice) {
    state.settings.panelChoice = 'zashboard';
    saveSettings({ panelChoice: 'zashboard' });
  }
  if (!state.settings.externalUi) {
    state.settings.externalUi = 'ui';
    saveSettings({ externalUi: 'ui' });
  }
  const externalUi = state.settings.dataDir
    ? `${String(state.settings.dataDir).replace(/\/+$/, '')}/ui`
    : '';
  // temporarily suppress transitions while applying initial theme
  document.body.classList.add('no-theme-transition');
  applyThemePreference(state.settings.theme, false);
  document.body.classList.remove('no-theme-transition');
  setLanguage(state.settings.lang, false, false);
  syncDebugMode(state.settings.debugMode);
  applySidebarCollapsedState(state.settings.sidebarCollapsed, false);
  if (settingsWindowWidth) {
    settingsWindowWidth.value = state.settings.windowWidth;
  }
  if (settingsWindowHeight) {
    settingsWindowHeight.value = state.settings.windowHeight;
  }
  if (settingsAcceptBeta) {
    settingsAcceptBeta.checked = Boolean(state.settings.acceptBeta);
  }
  if (settingsTrayMenuChart) {
    settingsTrayMenuChart.checked = state.settings.chartEnabled !== false;
  }
  if (settingsTrayMenuProviderTraffic) {
    settingsTrayMenuProviderTraffic.checked = state.settings.providerTrafficEnabled !== false;
  }
  if (settingsTrayMenuTrackers) {
    settingsTrayMenuTrackers.checked = state.settings.trackersEnabled !== false;
  }
  if (settingsTrayMenuFoxboard) {
    settingsTrayMenuFoxboard.checked = state.settings.foxboardEnabled !== false;
  }
  if (settingsTrayMenuKernelManager) {
    settingsTrayMenuKernelManager.checked = state.settings.kernelManagerEnabled !== false;
  }
  if (settingsTrayMenuDirectoryLocations) {
    settingsTrayMenuDirectoryLocations.checked = state.settings.directoryLocationsEnabled !== false;
  }
  if (settingsTrayMenuCopyShellExport) {
    settingsTrayMenuCopyShellExport.checked = state.settings.copyShellExportCommandEnabled !== false;
  }
  if (settingsProxyMixedPort) {
    settingsProxyMixedPort.value = Number.parseInt(String(state.settings.mixedPort ?? 7893), 10) || 7893;
  }
  if (settingsProxyPort) {
    settingsProxyPort.value = Number.parseInt(String(state.settings.port ?? 7890), 10) || 7890;
  }
  if (settingsProxySocksPort) {
    settingsProxySocksPort.value = Number.parseInt(String(state.settings.socksPort ?? 7891), 10) || 7891;
  }
  if (settingsProxyAllowLan) {
    settingsProxyAllowLan.checked = Boolean(state.settings.allowLan);
  }
  if (settingsConfigDir) {
    settingsConfigDir.value = state.settings.configDir;
  }
  if (settingsCoreDir) {
    settingsCoreDir.value = state.settings.coreDir;
  }
  if (settingsDataDir) {
    settingsDataDir.value = state.settings.dataDir;
  }
  if (settingsExternalUi) {
    settingsExternalUi.value = state.settings.externalUi || 'ui';
  }
  updateExternalUiUrlField();
  if (githubUser) {
    githubUser.value = state.settings.githubUser;
  }
  if (settingsGithubUser) {
    settingsGithubUser.value = state.settings.githubUser;
  }
  state.coreVersionRaw = readKernelVersionFromSettings();
  applyKernelVersionDisplay(state.coreVersionRaw || '');
  updateInstallVersionVisibility();
  if (configPathInput) {
    configPathInput.value = state.settings.configPath;
  }
  if (overviewConfigPath) {
    overviewConfigPath.value = state.settings.configPath;
  }
  if (settingsConfigPath) {
    settingsConfigPath.value = state.settings.configPath;
  }
  hydrateOverviewIdentityFromSettings();
  hydrateOverviewNetworkFromCache();
  hydrateOverviewTrafficFromCache();
  hydrateOverviewProviderSubscriptionFromCache();
  hydrateOverviewRulesCardFromCache();
  applyOverviewOrders();
  if (externalControllerInput) {
    externalControllerInput.value = state.settings.externalController || '';
  }
  if (externalSecretInput) {
    externalSecretInput.value = state.settings.secret || '';
  }
  if (externalAuthInput) {
    const auth = Array.isArray(state.settings.authentication) ? state.settings.authentication : (state.settings.authentication ? [state.settings.authentication] : []);
    externalAuthInput.value = auth.join('\n');
  }
  if (logLines) {
    logLines.value = state.settings.logLines;
  }
  if (logIntervalPreset) {
    logIntervalPreset.value = state.settings.logIntervalPreset;
  }
  updateInterval();
  if (logAutoRefresh) {
    logAutoRefresh.checked = state.settings.logAutoRefresh;
  }
  setLogAutoRefresh(true);
  if (proxyModeSelect) {
    setProxyModeValue(state.settings.proxy || 'rule');
  }
  if (tunToggle) {
    tunToggle.checked = Boolean(state.settings.tun);
  }
  if (tunStackSelect) {
    const stack = normalizeTunStack(state.settings.stack);
    tunStackSelect.value = stack;
    if (state.settings.stack !== stack) {
      saveSettings({ stack });
    }
  }
  if (panelSelect) {
    panelSelect.value = state.settings.panelChoice || '';
  }
  updateExternalUiUrlField();
  updateDashboardFrameSrc();
  const unifiedPageSize = state.settings.generalPageSize || state.settings.backupsPageSize || state.settings.kernelPageSize || '10';
  state.kernelPageSizeLocal = unifiedPageSize;
  state.switchPageSizeLocal = unifiedPageSize;
  state.backupsPageSizeLocal = unifiedPageSize;
  state.configPageSizeLocal = unifiedPageSize;
  state.recommendPageSizeLocal = unifiedPageSize;
  if (kernelPageSize) {
    kernelPageSize.value = state.kernelPageSizeLocal;
  }
  if (switchPageSize) {
    switchPageSize.value = state.switchPageSizeLocal;
  }
  if (backupsPageSize) {
    backupsPageSize.value = state.backupsPageSizeLocal;
  }
  if (recommendPageSize) {
    recommendPageSize.value = state.recommendPageSizeLocal;
  }
  if (configPageSize) {
    configPageSize.value = state.configPageSizeLocal;
  }
  if (settingsBackupsPageSize) {
    settingsBackupsPageSize.value = state.settings.generalPageSize || unifiedPageSize;
  }
  applyPersistedMihomoStatus();
  if (currentPage === 'overview') {
    connectMihomoConnectionsStream();
    connectMihomoTrafficStream();
    connectMihomoMemoryStream();
    connectMihomoLogsStream();
    startTopologyTicker();
  } else {
    closeMihomoConnectionsSocket();
    closeMihomoTrafficSocket();
    closeMihomoMemorySocket();
    closeMihomoLogsSocket();
    stopTopologyTicker();
  }
  renderTopologyCard();
  renderRecommendTable();
}

const prefersDarkQuery = window.matchMedia
  ? window.matchMedia('(prefers-color-scheme: dark)')
  : null;

if (prefersDarkQuery) {
  prefersDarkQuery.addEventListener('change', () => {
    if (state.themeSetting === 'auto') {
      applyThemePreference('auto', false);
    }
  });
}

if (window.clashfox && typeof window.clashfox.onSystemThemeChange === 'function') {
  window.clashfox.onSystemThemeChange((payload) => {
    if (!payload || typeof payload.dark !== 'boolean') {
      return;
    }
    applySystemTheme(payload.dark);
  });
}

if (window.clashfox && typeof window.clashfox.onTrayRefresh === 'function') {
  window.clashfox.onTrayRefresh(async () => {
    await syncProxyModeFromFile();
    loadStatus();
    loadTunStatus(false);
  });
}

if (window.clashfox && typeof window.clashfox.onMainToast === 'function') {
  window.clashfox.onMainToast((payload) => {
    if (!payload || !payload.message) {
      return;
    }
    showNoticePop(payload.message, payload.type || 'info');
  });
}

if (window.clashfox && typeof window.clashfox.onMainCoreAction === 'function') {
  window.clashfox.onMainCoreAction((payload) => {
    if (!payload || !payload.action) {
      return;
    }
    if (payload.action === 'install') {
      setInstallState('loading');
      if (installStatus && payload.message) {
        installStatus.textContent = payload.message;
      }
      return;
    }
    // Always sync from real kernel state; avoid synthetic transition states.
    loadStatusSilently();
  });
}

if (window.clashfox && typeof window.clashfox.onMainNavigate === 'function') {
  window.clashfox.onMainNavigate((payload) => {
    const page = payload && typeof payload.page === 'string' ? payload.page.trim() : '';
    if (!page) {
      return;
    }
    navigatePage(page);
  });
}

if (window.clashfox && typeof window.clashfox.onMainWindowResize === 'function') {
  window.clashfox.onMainWindowResize((payload) => {
    if (!payload || typeof payload !== 'object') {
      return;
    }
    const fallbackWidth = state.settings && Number.isFinite(Number(state.settings.windowWidth))
      ? Number(state.settings.windowWidth)
      : MAIN_WINDOW_DEFAULT_WIDTH;
    const fallbackHeight = state.settings && Number.isFinite(Number(state.settings.windowHeight))
      ? Number(state.settings.windowHeight)
      : MAIN_WINDOW_DEFAULT_HEIGHT;
    const nextWidth = sanitizeWindowDimension(
      payload.width,
      fallbackWidth,
      MAIN_WINDOW_MIN_WIDTH,
      MAIN_WINDOW_MAX_WIDTH,
    );
    const nextHeight = sanitizeWindowDimension(
      payload.height,
      fallbackHeight,
      MAIN_WINDOW_MIN_HEIGHT,
      MAIN_WINDOW_MAX_HEIGHT,
    );

    state.settings = { ...DEFAULT_SETTINGS, ...(state.settings || {}), windowWidth: nextWidth, windowHeight: nextHeight };
    state.fileSettings = { ...(state.fileSettings || {}), windowWidth: nextWidth, windowHeight: nextHeight };

    if (settingsWindowWidth) {
      settingsWindowWidth.value = nextWidth;
    }
    if (settingsWindowHeight) {
      settingsWindowHeight.value = nextHeight;
    }

    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
    } catch {
      // ignore storage write errors
    }
  });
}

function promptSudoPassword() {
  sudoPassword.value = '';
  sudoModal.classList.add('show');
  sudoModal.setAttribute('aria-hidden', 'false');
  sudoPassword.focus();

  return new Promise((resolve) => {
    const cleanup = () => {
      sudoModal.classList.remove('show');
      sudoModal.setAttribute('aria-hidden', 'true');
      sudoCancel.removeEventListener('click', onCancel);
      sudoConfirm.removeEventListener('click', onConfirm);
      sudoPassword.removeEventListener('keydown', onKeydown);
    };

    const onCancel = () => {
      cleanup();
      resolve(null);
    };

    const onConfirm = () => {
      const value = sudoPassword.value.trim();
      cleanup();
      resolve(value || null);
    };

    const onKeydown = (event) => {
      if (event.key === 'Escape') {
        onCancel();
      }
      if (event.key === 'Enter') {
        onConfirm();
      }
    };

    sudoCancel.addEventListener('click', onCancel);
    sudoConfirm.addEventListener('click', onConfirm);
    sudoPassword.addEventListener('keydown', onKeydown);
  });
}

function promptConfirm({ title, body, confirmLabel, confirmTone = 'danger' }) {
  confirmTitle.textContent = title || t('confirm.title');
  confirmBody.textContent = body || t('confirm.body');
  confirmCancel.textContent = t('confirm.cancel');
  confirmOk.textContent = confirmLabel || t('confirm.confirm');
  confirmOk.classList.remove('primary', 'danger');
  confirmOk.classList.add(confirmTone === 'primary' ? 'primary' : 'danger');
  confirmModal.classList.add('show');
  confirmModal.setAttribute('aria-hidden', 'false');

  return new Promise((resolve) => {
    const cleanup = () => {
      confirmModal.classList.remove('show');
      confirmModal.setAttribute('aria-hidden', 'true');
      confirmCancel.removeEventListener('click', onCancel);
      confirmOk.removeEventListener('click', onConfirm);
      confirmModal.removeEventListener('keydown', onKeydown);
    };

    const onCancel = () => {
      cleanup();
      resolve(false);
    };

    const onConfirm = () => {
      cleanup();
      resolve(true);
    };

    const onKeydown = (event) => {
      if (event.key === 'Escape') {
        onCancel();
      }
      if (event.key === 'Enter') {
        onConfirm();
      }
    };

    confirmCancel.addEventListener('click', onCancel);
    confirmOk.addEventListener('click', onConfirm);
    confirmModal.addEventListener('keydown', onKeydown);
    confirmOk.focus();
  });
}

function promptUpdateGuide({
  title,
  body,
  releaseLabel = '',
  alphaLabel = '',
}) {
  if (!updateGuideModal || !updateGuideTitle || !updateGuideBody || !updateGuideClose || !updateGuideReleaseBtn || !updateGuideAlphaBtn) {
    return Promise.resolve(null);
  }
  updateGuideTitle.textContent = title || ti('help.appUpdateChoicesTitle', 'Update Options');
  updateGuideBody.textContent = body || ti('help.updateGuideHint', 'Choose a version channel to continue.');
  updateGuideReleaseBtn.textContent = releaseLabel || formatAppUpdateChannelText('help.appUpdateOpenChannelAction', 'Open {channel}', 'stable');
  updateGuideAlphaBtn.textContent = alphaLabel || formatAppUpdateChannelText('help.appUpdateOpenChannelAction', 'Open {channel}', 'alpha');
  updateGuideReleaseBtn.classList.toggle('is-hidden', !releaseLabel);
  updateGuideAlphaBtn.classList.toggle('is-hidden', !alphaLabel);
  updateGuideModal.classList.add('show');
  updateGuideModal.setAttribute('aria-hidden', 'false');

  return new Promise((resolve) => {
    const cleanup = () => {
      updateGuideModal.classList.remove('show');
      updateGuideModal.setAttribute('aria-hidden', 'true');
      updateGuideClose.removeEventListener('click', onClose);
      updateGuideReleaseBtn.removeEventListener('click', onRelease);
      updateGuideAlphaBtn.removeEventListener('click', onAlpha);
      updateGuideModal.removeEventListener('keydown', onKeydown);
      updateGuideModal.removeEventListener('click', onBackdrop);
    };

    const onClose = () => {
      cleanup();
      resolve(null);
    };

    const onRelease = () => {
      cleanup();
      resolve('release');
    };

    const onAlpha = () => {
      cleanup();
      resolve('alpha');
    };

    const onKeydown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    const onBackdrop = (event) => {
      if (event.target === updateGuideModal) {
        onClose();
      }
    };

    updateGuideClose.addEventListener('click', onClose);
    if (!updateGuideReleaseBtn.classList.contains('is-hidden')) {
      updateGuideReleaseBtn.addEventListener('click', onRelease);
    }
    if (!updateGuideAlphaBtn.classList.contains('is-hidden')) {
      updateGuideAlphaBtn.addEventListener('click', onAlpha);
    }
    updateGuideModal.addEventListener('keydown', onKeydown);
    updateGuideModal.addEventListener('click', onBackdrop);

    if (!updateGuideReleaseBtn.classList.contains('is-hidden')) {
      updateGuideReleaseBtn.focus();
    } else if (!updateGuideAlphaBtn.classList.contains('is-hidden')) {
      updateGuideAlphaBtn.focus();
    } else {
      updateGuideClose.focus();
    }
  });
}

function getProxyModeInputs() {
  if (!proxyModeSelect) {
    return [];
  }
  return Array.from(proxyModeSelect.querySelectorAll('input[name="proxyMode"]'));
}

function getProxyModeValue() {
  const selected = getProxyModeInputs().find((input) => input.checked);
  return selected ? selected.value : 'rule';
}

function setProxyModeValue(value) {
  const target = value || 'rule';
  const inputs = getProxyModeInputs();
  let matched = false;
  inputs.forEach((input) => {
    const isMatch = input.value === target;
    input.checked = isMatch;
    if (isMatch) {
      matched = true;
    }
  });
  if (!matched) {
    const fallback = inputs.find((input) => input.value === 'rule') || inputs[0];
    if (fallback) {
      fallback.checked = true;
    }
  }
}

function normalizeTunStack(value) {
  const stack = String(value || '').trim();
  const lower = stack.toLowerCase();
  if (lower === 'mixed') {
    return 'Mixed';
  }
  if (lower === 'gvisor') {
    return 'gVisor';
  }
  if (lower === 'system') {
    return 'System';
  }
  return 'Mixed';
}

function normalizeProxyMode(value) {
  const mode = String(value || '').trim().toLowerCase();
  if (mode === 'global' || mode === 'direct' || mode === 'rule') {
    return mode;
  }
  return 'rule';
}

function formatBackupTimestamp(raw, fallback = '-') {
  if (!raw || typeof raw !== 'string') {
    return fallback;
  }
  const match = raw.match(/^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})$/);
  if (!match) {
    return raw || fallback;
  }
  return `${match[1]}-${match[2]}-${match[3]} ${match[4]}:${match[5]}:${match[6]}`;
}

async function syncProxyModeFromFile() {
  if (!window.clashfox || typeof window.clashfox.readSettings !== 'function') {
    return;
  }
  const response = await window.clashfox.readSettings();
  if (!response || !response.ok || !response.data) {
    return;
  }
  const nextMode = normalizeProxyMode(response.data.proxy);
  const currentMode = normalizeProxyMode(state.settings && state.settings.proxy);
  if (nextMode === currentMode) {
    return;
  }
  saveSettings({ proxy: nextMode });
  setProxyModeValue(nextMode);
}

async function runCommandWithSudo(command, args = []) {
  return runCommand(command, args);
}

async function maybeNotifyHelperAuthFallback(command = '') {
  const cmd = String(command || '').trim();
  if (!cmd || state.helperAuthFallbackHintShown) {
    return;
  }
  const privileged = new Set(['install', 'start', 'stop', 'restart', 'delete-backups']);
  if (!privileged.has(cmd)) {
    return;
  }
  try {
    const response = await getHelperStatus();
    const running = Boolean(response && response.ok && response.data && response.data.running);
    if (!running) {
      state.helperAuthFallbackHintShown = true;
      showNoticePop(
        ti('labels.helperAuthFallbackHint', 'Privileged Helper is not running. macOS authorization dialog may appear.'),
        'warn',
      );
    }
  } catch {
    // ignore helper status check errors
  }
}

function isTunConflictError(message) {
  const text = String(message || '').toLowerCase();
  if (!text) return false;
  const tunMarkers = [
    'tun',
    'utun',
    'gvisor',
    'stack',
    'configure tun',
    'start tun',
    'create tun',
  ];
  const conflictMarkers = [
    'device or resource busy',
    'resource busy',
    'file exists',
    'already in use',
    'address already in use',
    'conflict',
    'operation not permitted',
    'permission denied',
    'cannot assign requested address',
  ];
  const hasTunMarker = tunMarkers.some((marker) => text.includes(marker));
  const hasConflictMarker = conflictMarkers.some((marker) => text.includes(marker));
  return hasTunMarker && hasConflictMarker;
}

function formatCoreActionError(action, response) {
  const genericErrors = new Set(['start_failed', 'restart_failed', 'stop_failed']);
  const errorCode = response?.error || '';
  const details = response?.details || response?.message || '';
  const helperState = ((state.settings && state.settings.helperStatus) || (state.fileSettings && state.fileSettings.helperStatus) || {}).state || '';
  const helperMissing = String(helperState || '').trim() === 'not_installed';
  if (helperMissing && new Set(['unexpected_error', 'helper_unreachable', 'socket_missing']).has(String(errorCode || '').trim())) {
    return ti('labels.helperNotInstalledHint', 'Privileged Helper is not installed. Please install it in Settings first.');
  }
  const fallback = (details && genericErrors.has(errorCode))
    ? details
    : (response?.error || response?.details || response?.message
      || `${action.charAt(0).toUpperCase() + action.slice(1)} failed`);
  const combined = [response?.error, response?.details, response?.message]
    .filter(Boolean)
    .join(' | ');
  if ((action === 'start' || action === 'restart') && isTunConflictError(combined)) {
    return ti('labels.tunConflictHint', 'TUN conflict detected. Turn off TUN mode in other proxy apps, then try again.');
  }
  return fallback;
}

function showToast(message, type = 'info') {
  showNoticePop(message, type);
}

function guiLog(scope, message, payload = null, level = 'log') {
  return;
}

function hideNoticePop() {
  if (!noticePop) {
    return;
  }
  noticePop.classList.remove('show');
  if (noticePopTimer) {
    clearTimeout(noticePopTimer);
    noticePopTimer = null;
  }
}

function showNoticePop(message, type = 'info') {
  if (!message || !noticePop || !noticePopBody) {
    return;
  }
  const normalizedType = ['success', 'warn', 'error'].includes(String(type || '').toLowerCase())
    ? String(type).toLowerCase()
    : 'info';
  const titleKey = normalizedType === 'success'
    ? 'labels.noticeSuccess'
    : normalizedType === 'warn'
      ? 'labels.noticeWarning'
      : normalizedType === 'error'
        ? 'labels.noticeError'
        : 'labels.noticeInfo';
  if (noticePopTitle) {
    noticePopTitle.textContent = ti(titleKey, ti('labels.notice', 'Notice'));
  }
  noticePopBody.textContent = String(message || '').trim();
  noticePop.dataset.type = normalizedType;
  noticePop.classList.add('show');
  if (noticePopTimer) {
    clearTimeout(noticePopTimer);
  }
  noticePopTimer = setTimeout(() => {
    hideNoticePop();
  }, normalizedType === 'error' ? 4200 : 3200);
}

async function copyTextToClipboard(text) {
  const value = String(text || '').trim();
  if (!value) {
    return false;
  }
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {}
  }
  const fallbackInput = document.createElement('textarea');
  fallbackInput.value = value;
  fallbackInput.setAttribute('readonly', 'readonly');
  fallbackInput.style.position = 'fixed';
  fallbackInput.style.left = '-9999px';
  document.body.appendChild(fallbackInput);
  fallbackInput.focus();
  fallbackInput.select();
  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  }
  document.body.removeChild(fallbackInput);
  return copied;
}

async function handleOverviewKernelCopy() {
  const kernelText = overviewKernel ? String(overviewKernel.textContent || '').trim() : '';
  if (!kernelText || kernelText === '-') {
    showNoticePop(ti('labels.copyFailed', 'Copy failed.'), 'error');
    return;
  }
  const copied = await copyTextToClipboard(kernelText);
  showNoticePop(
    copied
      ? ti('labels.kernelCopied', 'Kernel version copied.')
      : ti('labels.copyFailed', 'Copy failed.'),
    copied ? 'success' : 'error',
  );
}

async function handleOverviewTextCopy(value) {
  const text = String(value || '').trim();
  if (!text || text === '-') {
    showNoticePop(ti('labels.copyFailed', 'Copy failed.'), 'error');
    return;
  }
  const copied = await copyTextToClipboard(text);
  showNoticePop(
    copied
      ? ti('labels.copied', 'Copied.')
      : ti('labels.copyFailed', 'Copy failed.'),
    copied ? 'success' : 'error',
  );
}

function setInstallState(nextState, errorMessage = '') {
  state.installState = nextState;
  if (!installStatus || !installProgress) {
    return;
  }
  let message = t('install.ready');
  if (nextState === 'loading') {
    message = t('install.progress');
  } else if (nextState === 'success') {
    message = t('install.done');
  } else if (nextState === 'error') {
    message = t('install.failed');
  }

  installStatus.textContent = message;
  installStatus.dataset.state = nextState;
  installProgress.classList.toggle('show', nextState === 'loading');
  installBtn.disabled = nextState === 'loading';
  githubUser.disabled = nextState === 'loading';
  if (cancelInstallBtn) {
    cancelInstallBtn.style.display = nextState === 'loading' ? 'block' : 'none';
    cancelInstallBtn.disabled = nextState !== 'loading';
  }
  if (installVersion) {
    installVersion.disabled = nextState === 'loading';
  }
  if (nextState === 'idle') {
    applyKernelUpdateInstallHint();
  }
}

function extractKernelSemver(raw = '') {
  const text = String(raw || '').trim();
  if (!text) {
    return '';
  }
  const match = text.match(/v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?/);
  return match ? match[0].replace(/^v/i, '') : '';
}

function resolveKernelUpdateSourceByVersion(rawVersion = '', fallbackSource = '') {
  const fallback = 'MetaCubeX';
  const text = String(rawVersion || '').toLowerCase();
  if (!text) {
    const selected = String(fallbackSource || '').trim();
    return selected === 'vernesong' || selected === 'MetaCubeX' ? selected : fallback;
  }
  if (text.includes('alpha-smart') || text.includes('-smart-') || text.includes('vernesong')) {
    return 'vernesong';
  }
  return fallback;
}

function normalizeKernelSource(source = '') {
  const text = String(source || '').trim();
  if (text === 'vernesong' || text === 'MetaCubeX') {
    return text;
  }
  return '';
}

function formatKernelVersionForDisplay(version = '', source = '', prerelease = false) {
  const raw = String(version || '').trim();
  if (!raw) {
    return '';
  }
  const normalizedSource = String(source || '').toLowerCase();
  const normalized = raw.replace(/^v/i, '');
  const isStableSemver = /^\d+\.\d+\.\d+$/.test(normalized);
  if (normalizedSource === 'metacubex' && !prerelease && isStableSemver) {
    return `v${normalized}`;
  }
  return raw;
}

function readKernelVersionFromSettings() {
  const candidate = [
    state.settings && state.settings.kernel && (state.settings.kernel.raw || state.settings.kernel.version),
    state.fileSettings && state.fileSettings.kernel && (state.fileSettings.kernel.raw || state.fileSettings.kernel.version),
  ].find((item) => typeof item === 'string' && item.trim());
  return String(candidate || '').trim();
}

function readDeviceFromSettings() {
  const candidate = [
    state.settings && state.settings.device,
    state.fileSettings && state.fileSettings.device,
  ].find((item) => item && typeof item === 'object');
  return candidate && typeof candidate === 'object' ? candidate : {};
}

function setOverviewCopyButtonVisible(button, visible) {
  if (!button) {
    return;
  }
  const show = Boolean(visible);
  const hiddenNow = button.classList.contains('is-hidden');
  if (hiddenNow === !show && button.disabled === !show) {
    return;
  }
  button.classList.toggle('is-hidden', !show);
  button.disabled = !show;
}

function setNodeTextIfChanged(node, value) {
  if (!node) {
    return;
  }
  const next = String(value ?? '');
  if (node.textContent === next) {
    return;
  }
  node.textContent = next;
}

function syncOverflowTooltip(node, options = {}) {
  if (!node) {
    return;
  }
  const {
    position = 'bottom',
    tipKey = 'overflow',
  } = options;
  const applyTooltip = () => {
    const text = String(node.textContent || '').trim();
    const isOverflowing = node.scrollWidth > node.clientWidth || node.scrollHeight > node.clientHeight;
    if (text && isOverflowing) {
      node.dataset.tipKey = tipKey;
      node.dataset.tip = text;
      node.dataset.position = position;
      node.setAttribute('aria-label', text);
    } else {
      delete node.dataset.tipKey;
      delete node.dataset.tip;
      delete node.dataset.position;
      node.removeAttribute('aria-label');
    }
  };
  requestAnimationFrame(applyTooltip);
}

function syncStaticTooltip(node, value, options = {}) {
  if (!node) {
    return;
  }
  const {
    position = 'bottom',
    tipKey = 'tooltip',
  } = options;
  const text = String(value ?? '').trim();
  if (text) {
    node.dataset.tipKey = tipKey;
    node.dataset.tip = text;
    node.dataset.position = position;
    node.setAttribute('aria-label', text);
  } else {
    delete node.dataset.tipKey;
    delete node.dataset.tip;
    delete node.dataset.position;
    node.removeAttribute('aria-label');
  }
}

function setNodeHtmlIfChanged(node, value) {
  if (!node) {
    return;
  }
  const next = String(value ?? '');
  if (node.innerHTML === next) {
    return;
  }
  node.innerHTML = next;
}

function resolveSidebarFoxDividerState() {
  const mihomoStatus = state && state.mihomoStatus ? state.mihomoStatus : null;
  const statusSource = mihomoStatus && typeof mihomoStatus.source === 'string' ? mihomoStatus.source : 'init';
  if (!state || statusSource === 'init') {
    return 'normal';
  }
  return state.coreRunning ? 'active' : 'issue';
}

function syncSidebarFoxDividerState() {
  if (!sidebarFoxDivider) {
    return;
  }
  sidebarFoxDivider.setState(resolveSidebarFoxDividerState());
}

function ensureSidebarFoxDivider() {
  if (!sidebarFoxDividerHost) {
    if (sidebarFoxDivider) {
      sidebarFoxDivider.destroy();
      sidebarFoxDivider = null;
    }
    return;
  }
  const currentContainer = sidebarFoxDivider && sidebarFoxDivider.container ? sidebarFoxDivider.container : null;
  if (currentContainer !== sidebarFoxDividerHost) {
    if (sidebarFoxDivider) {
      sidebarFoxDivider.destroy();
    }
    sidebarFoxDivider = new SidebarFoxDivider(sidebarFoxDividerHost, {
      state: resolveSidebarFoxDividerState(),
    });
    return;
  }
  syncSidebarFoxDividerState();
}

function hydrateOverviewIdentityFromSettings() {
  const persistedVersion = readKernelVersionFromSettings();
  applyKernelVersionDisplay(persistedVersion);
  const persistedDevice = readDeviceFromSettings();
  if (overviewSystem) {
    overviewSystem.textContent = persistedDevice.os || '-';
  }
  if (overviewVersion) {
    const versionRaw = String(persistedDevice.version || '').trim();
    const buildRaw = String(persistedDevice.build || '').trim();
    overviewVersion.textContent = versionRaw
      ? (buildRaw ? `${versionRaw} (${buildRaw})` : versionRaw)
      : '-';
  }
  const persistedMihomoStatus = (state.settings && state.settings.mihomoStatus)
    || (state.fileSettings && state.fileSettings.mihomoStatus)
    || null;
  if (overviewStatus && persistedMihomoStatus && typeof persistedMihomoStatus.running === 'boolean') {
    overviewStatus.textContent = persistedMihomoStatus.running ? t('labels.running') : t('labels.stopped');
  }
  state.overviewIpRaw.local = '';
  state.overviewIpRaw.proxy = '';
  state.overviewIpRaw.internet = '';
  setOverviewCopyButtonVisible(overviewLocalIpCopy, false);
  setOverviewCopyButtonVisible(overviewProxyIpCopy, false);
  setOverviewCopyButtonVisible(overviewInternetIpCopy, false);
}

function applyKernelVersionDisplay(versionRaw = '') {
  const normalizedVersion = String(versionRaw || '').trim();
  const kernelDisplay = formatKernelDisplay(normalizedVersion);
  if (overviewKernel) {
    overviewKernel.textContent = kernelDisplay || '-';
  }
  if (installCurrentKernel) {
    installCurrentKernel.textContent = kernelDisplay && kernelDisplay !== '-' ? kernelDisplay : t('labels.notInstalled');
  }
  if (statusVersion) {
    statusVersion.textContent = normalizedVersion || t('labels.notInstalled');
  }
  setOverviewCopyButtonVisible(overviewKernelCopy, Boolean(kernelDisplay && kernelDisplay !== '-'));
}

async function syncKernelVersionFromMihomo() {
  const source = getMihomoApiSource();
  const response = await fetchMihomoVersion(source, window.clashfox);
  if (!response || !response.ok || !response.data) {
    return response || { ok: false, error: 'request_failed' };
  }
  const versionRaw = String((response.data && response.data.version) || '').trim();
  if (!versionRaw) {
    return { ok: false, error: 'version_missing' };
  }
  syncKernelVersionInState(versionRaw);
  state.coreVersionRaw = versionRaw;
  syncGithubSourceFromKernelVersion();
  applyKernelVersionDisplay(versionRaw);
  return { ok: true, data: response.data };
}

function syncKernelVersionInState(version = '') {
  const normalized = String(version || '').trim();
  if (!normalized) {
    return;
  }
  if (!state.settings) {
    state.settings = { ...DEFAULT_SETTINGS };
  }
  if (!state.fileSettings) {
    state.fileSettings = {};
  }
  if (!state.settings.kernel || typeof state.settings.kernel !== 'object') {
    state.settings.kernel = {};
  }
  if (!state.fileSettings.kernel || typeof state.fileSettings.kernel !== 'object') {
    state.fileSettings.kernel = {};
  }
  state.settings.kernel.raw = normalized;
  state.fileSettings.kernel.raw = normalized;
}

function syncGithubSourceFromKernelVersion() {
  if (!githubUser) {
    return;
  }
  if (state.githubSourceManualOverride) {
    return;
  }
  const current = String(githubUser.value || '').trim() || 'vernesong';
  const next = resolveKernelUpdateSourceByVersion(state.coreVersionRaw || '', current);
  if (next === current) {
    return;
  }
  githubUser.value = next;
  updateInstallVersionVisibility();
  state.kernelUpdateCheckedAt = 0;
  state.kernelUpdateInfo = { ok: false, status: 'checking', source: next };
  applyKernelUpdateInstallHint();
  if (currentPage === 'kernel' && state.installState !== 'loading') {
    if (state.kernelUpdateChecking) {
      state.kernelUpdatePendingRefresh = true;
      return;
    }
    refreshKernelUpdateNotice(true);
  }
}

function applyKernelUpdateInstallHint() {
  if (!installStatus || state.installState === 'loading') {
    return;
  }
  const info = state.kernelUpdateInfo;
  if (info && info.status === 'checking') {
    installStatus.textContent = ti('install.kernelChecking', `Checking updates from ${info.source || 'source'}...`);
    installStatus.dataset.state = 'loading';
    return;
  }
  if (info && info.ok && info.status === 'update_available' && info.latestVersion) {
    const latestDisplay = formatKernelVersionForDisplay(info.latestVersion, info.source, Boolean(info.prerelease));
    installStatus.textContent = ti('install.kernelUpdateAvailable', `Kernel update available: ${latestDisplay}`);
    installStatus.dataset.state = 'warn';
    return;
  }
  if (
    info
    && info.ok
    && info.latestVersion
    && String(info.source || '').toLowerCase() === 'vernesong'
  ) {
    const latestDisplay = formatKernelVersionForDisplay(info.latestVersion, info.source, Boolean(info.prerelease));
    installStatus.textContent = ti('install.kernelLatestVersion', `Latest version: ${latestDisplay}`);
    installStatus.dataset.state = 'ready';
    return;
  }
  installStatus.textContent = t('install.ready');
  installStatus.dataset.state = 'idle';
}

async function refreshKernelUpdateNotice(force = false) {
  if (!window.clashfox || typeof window.clashfox.checkKernelUpdates !== 'function') {
    return;
  }
  if (state.kernelUpdateChecking) {
    if (force) {
      state.kernelUpdatePendingRefresh = true;
    }
    return;
  }
  const now = Date.now();
  if (!force && (now - state.kernelUpdateCheckedAt) < 5 * 60 * 1000) {
    applyKernelUpdateInstallHint();
    return;
  }
  const selectedSource = (githubUser && githubUser.value)
    || (state.settings && state.settings.githubUser)
    || 'vernesong';
  const source = normalizeKernelSource(selectedSource)
    || resolveKernelUpdateSourceByVersion(state.coreVersionRaw || '', selectedSource);
  const currentVersion = String(state.coreVersionRaw || '').trim();
  const cachedResult = getCachedKernelUpdateResult(source, currentVersion);
  if (cachedResult) {
    state.kernelUpdateInfo = cachedResult;
    state.kernelUpdateCheckedAt = Date.now();
    if (
      cachedResult.ok
      && cachedResult.latestVersion
      && String(source || '').toLowerCase() === 'metacubex'
      && !cachedResult.prerelease
      && installVersion
    ) {
      const latest = String(cachedResult.latestVersion || '').trim();
      installVersion.value = latest;
    }
    applyKernelUpdateInstallHint();
    return;
  }
  const requestSeq = (state.kernelUpdateRequestSeq || 0) + 1;
  state.kernelUpdateRequestSeq = requestSeq;
  state.kernelUpdateInfo = { ok: false, status: 'checking', source };
  applyKernelUpdateInstallHint();
  state.kernelUpdateChecking = true;
  try {
    const result = await window.clashfox.checkKernelUpdates({
      source,
      currentVersion,
    });
    if (requestSeq !== state.kernelUpdateRequestSeq) {
      return;
    }
    state.kernelUpdateInfo = result || null;
    state.kernelUpdateCheckedAt = Date.now();
    if (result && typeof result === 'object') {
      setCachedKernelUpdateResult(source, currentVersion, result);
    }
    if (
      result
      && result.ok
      && result.latestVersion
      && String(source || '').toLowerCase() === 'metacubex'
      && !result.prerelease
      && installVersion
    ) {
      const latest = String(result.latestVersion || '').trim();
      installVersion.value = latest;
    }
    if (
      result
      && result.ok
      && result.status === 'update_available'
      && result.latestVersion
      && state.kernelUpdateNotifiedVersion !== result.latestVersion
    ) {
      state.kernelUpdateNotifiedVersion = result.latestVersion;
      const latestDisplay = formatKernelVersionForDisplay(result.latestVersion, source, Boolean(result.prerelease));
      showNoticePop(
        ti('install.kernelUpdateAvailable', `Kernel update available: ${latestDisplay}`),
        'info',
      );
    }
    applyKernelUpdateInstallHint();
  } catch {
    if (requestSeq !== state.kernelUpdateRequestSeq) {
      return;
    }
    state.kernelUpdateInfo = { ok: false, status: 'error', source };
    state.kernelUpdateCheckedAt = Date.now();
    applyKernelUpdateInstallHint();
  } finally {
    if (requestSeq === state.kernelUpdateRequestSeq) {
      state.kernelUpdateChecking = false;
      if (state.kernelUpdatePendingRefresh) {
        state.kernelUpdatePendingRefresh = false;
        refreshKernelUpdateNotice(true);
      }
    }
  }
}

function setActiveSection(sectionId) {
  navButtons.forEach((btn) => {
    const match = btn.dataset.section === sectionId || btn.dataset.page === sectionId;
    btn.classList.toggle('active', match);
  });
  panels.forEach((panel) => {
    panel.classList.toggle('active', panel.id === sectionId);
  });
}

function setActiveNav(page) {
  if (!page) {
    return;
  }
  navButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.page === page);
  });
}

async function runCommand(command, args = [], options = {}) {
  if (!window.clashfox || typeof window.clashfox.runCommand !== 'function') {
    guiLog('command', 'bridge missing', { command, args, options }, 'error');
    return { ok: false, error: 'bridge_missing' };
  }
  const effectiveSettings = { ...(state.fileSettings || {}), ...(state.settings || {}) };
  const pathArgs = [];
  if (effectiveSettings.configDir) {
    pathArgs.push('--config-dir', effectiveSettings.configDir);
  }
  if (effectiveSettings.coreDir) {
    pathArgs.push('--core-dir', effectiveSettings.coreDir);
  }
  if (effectiveSettings.dataDir) {
    pathArgs.push('--data-dir', effectiveSettings.dataDir);
  }
  const finalArgs = [...pathArgs, ...args];
  guiLog('command', 'runCommand start', { command, args: finalArgs, options });
  try {
    const result = await window.clashfox.runCommand(command, finalArgs, options);
    guiLog('command', 'runCommand result', {
      command,
      ok: Boolean(result && result.ok),
      error: result && result.error ? result.error : '',
    });
    return result;
  } catch (error) {
    guiLog('command', 'runCommand threw', {
      command,
      message: String(error && error.message ? error.message : error || ''),
    }, 'error');
    throw error;
  }
}

async function loadStaticConfigs() {
  try {
    const response = await fetch(STATIC_CONFIGS_URL, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`load_failed_${response.status}`);
    }
    const payload = await response.json();
    if (payload && typeof payload === 'object') {
      if (payload.panelPresets && typeof payload.panelPresets === 'object') {
        PANEL_PRESETS = payload.panelPresets;
        // derive external UI URLs from presets if present
        const derivedUrls = {};
        Object.entries(PANEL_PRESETS).forEach(([key, preset]) => {
          if (preset && typeof preset === 'object') {
            const url = preset['external-ui-url'] || preset.externalUiUrl || preset.url;
            if (url) {
              derivedUrls[key] = url;
            }
          }
        });
        PANEL_EXTERNAL_UI_URLS = Object.keys(derivedUrls).length > 0 ? derivedUrls : {};
      }
      if (Array.isArray(payload.recommendedConfigs)) {
        RECOMMENDED_CONFIGS = payload.recommendedConfigs;
      }
    }
  } catch (error) {
    console.warn('Failed to load static configs.', error);
  }
}

async function cancelCommand() {
  if (!window.clashfox || typeof window.clashfox.cancelCommand !== 'function') {
    return { ok: false, error: 'bridge_missing' };
  }
  return window.clashfox.cancelCommand();
}

async function readAppInfo(force = false) {
  if (!window.clashfox || typeof window.clashfox.getAppInfo !== 'function') {
    return null;
  }
  if (!force && appInfoCache) {
    return appInfoCache;
  }
  if (!force && appInfoPromise) {
    return appInfoPromise;
  }
  appInfoPromise = window.clashfox.getAppInfo()
    .then((response) => {
      if (response && response.ok && response.data) {
        appInfoCache = response.data;
        return appInfoCache;
      }
      return null;
    })
    .catch(() => null)
    .finally(() => {
      appInfoPromise = null;
    });
  return appInfoPromise;
}

function applyAppInfo(appInfo) {
  if (!appInfo || typeof appInfo !== 'object') {
    return;
  }
  const helpVersionEl = helpAboutVersion || document.getElementById('helpAboutVersion');
  const helpBuildEl = helpAboutBuild || document.getElementById('helpAboutBuild');
  if (appName) {
    appName.textContent = appInfo.name || 'ClashFox';
  }
  const displayVersion = typeof appInfo.displayVersion === 'string' && appInfo.displayVersion.trim()
    ? appInfo.displayVersion
    : (() => {
      const version = appInfo.version || '0.0.0';
      const baseVersionMatch = String(version).match(/^(\d+\.\d+\.\d+)/);
      const baseVersion = baseVersionMatch ? baseVersionMatch[1] : String(version).replace(/-.*/, '');
      const isDev = Boolean(appInfo.isDev);
      const buildNumber = Number.parseInt(appInfo.buildNumber, 10);
      const normalizedBuild = Number.isFinite(buildNumber) && buildNumber > 0 ? buildNumber : 1;
      return isDev
        ? `v${baseVersion || '0.0.0'}-alpha.${normalizedBuild}`
        : `v${version}`;
    })();
  if (appVersion) {
    appVersion.textContent = displayVersion;
  }
  if (helpVersionEl) {
    helpVersionEl.textContent = displayVersion;
    helpAboutVersion = helpVersionEl;
  }
  if (helpBuildEl) {
    helpBuildEl.textContent = appInfo.buildNumber || '-';
    helpAboutBuild = helpBuildEl;
  }
}

async function loadAppInfo(force = false) {
  const appInfo = await readAppInfo(force);
  applyAppInfo(appInfo);
}

function setHelpAboutStatus(text = '', stateName = 'idle') {
  if (!helpAboutStatus) {
    return;
  }
  helpAboutStatus.textContent = text || ti('help.updateEntryHint', 'Use the buttons below to check app, kernel, and helper updates.');
  helpAboutStatus.dataset.state = stateName || 'idle';
}

async function handleHelpAppUpdateCheck() {
  if (!window.clashfox || typeof window.clashfox.checkUpdates !== 'function') {
    setHelpAboutStatus(ti('help.updateCheckBridgeMissing', 'Update check is unavailable.'), 'error');
    return;
  }
  if (helpCheckAppUpdateBtn) {
    helpCheckAppUpdateBtn.disabled = true;
  }
  setHelpAboutStatus(ti('help.checkingAppUpdate', 'Checking app updates...'), 'checking');
  try {
    const [stableResult, alphaResult] = await Promise.all([
      window.clashfox.checkUpdates({ manual: true, acceptBeta: false }),
      window.clashfox.checkUpdates({ manual: true, acceptBeta: true }),
    ]);
    const stableAvailable = Boolean(stableResult && stableResult.ok && stableResult.status === 'update_available' && !stableResult.prerelease);
    const prereleaseAvailable = Boolean(alphaResult && alphaResult.ok && alphaResult.status === 'update_available' && alphaResult.prerelease);
    if (!stableAvailable && !prereleaseAvailable) {
      setHelpAboutStatus(ti('help.appAlreadyLatest', 'App is up to date.'), 'success');
      return;
    }
    const stableVersion = normalizeVersionForDisplay(stableResult && stableResult.latestVersion ? stableResult.latestVersion : '');
    const prereleaseVersion = normalizeVersionForDisplay(alphaResult && alphaResult.latestVersion ? alphaResult.latestVersion : '');
    const prereleaseChannel = resolveAppReleaseChannel(prereleaseVersion, Boolean(alphaResult && alphaResult.prerelease));
    const bodyParts = [];
    if (prereleaseAvailable) {
      bodyParts.push(
        prereleaseVersion
          ? formatAppUpdateChannelText(
            'help.appUpdateChannelBodyVersion',
            'A newer {channel} version v{version} is available. Open the latest tag page?',
            prereleaseChannel,
            prereleaseVersion,
          )
          : formatAppUpdateChannelText(
            'help.appUpdateChannelBody',
            'A newer {channel} version is available. Open the latest tag page?',
            prereleaseChannel,
          ),
      );
    }
    if (stableAvailable) {
      bodyParts.push(
        stableVersion
          ? formatAppUpdateChannelText(
            'help.appUpdateChannelBodyVersion',
            'A newer {channel} version v{version} is available. Open the latest tag page?',
            'stable',
            stableVersion,
          )
          : formatAppUpdateChannelText(
            'help.appUpdateChannelBody',
            'A newer {channel} version is available. Open the latest tag page?',
            'stable',
          ),
      );
    }
    const choice = await promptUpdateGuide({
      title: ti('help.appUpdateChoicesTitle', 'Update Options'),
      body: bodyParts.join(' '),
      releaseLabel: stableAvailable
        ? formatAppUpdateChannelText('help.appUpdateOpenChannelAction', 'Open {channel}', 'stable')
        : '',
      alphaLabel: prereleaseAvailable
        ? formatAppUpdateChannelText('help.appUpdateOpenChannelAction', 'Open {channel}', prereleaseChannel)
        : '',
    });
    if (choice === 'release' && window.clashfox && typeof window.clashfox.openExternal === 'function') {
      await window.clashfox.openExternal((stableResult && stableResult.releaseUrl) || APP_RELEASES_URL);
    } else if (choice === 'alpha' && window.clashfox && typeof window.clashfox.openExternal === 'function') {
      await window.clashfox.openExternal((alphaResult && alphaResult.releaseUrl) || APP_RELEASES_URL);
    }
    const statusParts = [];
    if (stableAvailable) {
      statusParts.push(
        stableVersion
          ? `${formatAppUpdateChannelText('help.appUpdateChannelAvailable', '{channel} update available', 'stable')}: v${stableVersion}`
          : formatAppUpdateChannelText('help.appUpdateChannelAvailable', '{channel} update available', 'stable'),
      );
    }
    if (prereleaseAvailable) {
      statusParts.push(
        prereleaseVersion
          ? `${formatAppUpdateChannelText('help.appUpdateChannelAvailable', '{channel} update available', prereleaseChannel)}: v${prereleaseVersion}`
          : formatAppUpdateChannelText('help.appUpdateChannelAvailable', '{channel} update available', prereleaseChannel),
      );
    }
    setHelpAboutStatus(statusParts.join(' · '), 'warning');
  } catch (err) {
    setHelpAboutStatus(ti('help.updateEntryHint', 'Use the buttons below to check app, kernel, and helper updates.'), 'idle');
  } finally {
    if (helpCheckAppUpdateBtn) {
      helpCheckAppUpdateBtn.disabled = false;
    }
  }
}

async function handleHelpKernelUpdateCheck() {
  if (!window.clashfox || typeof window.clashfox.checkKernelUpdates !== 'function') {
    setHelpAboutStatus(ti('help.updateCheckBridgeMissing', 'Update check is unavailable.'), 'error');
    return;
  }
  if (helpCheckKernelUpdateBtn) {
    helpCheckKernelUpdateBtn.disabled = true;
  }
  setHelpAboutStatus(ti('help.checkingKernelUpdate', 'Checking kernel updates...'), 'checking');
  try {
    const selectedSource = (githubUser && githubUser.value)
      || (state.settings && state.settings.githubUser)
      || 'vernesong';
    const source = normalizeKernelSource(selectedSource)
      || resolveKernelUpdateSourceByVersion(state.coreVersionRaw || '', selectedSource);
    const currentVersion = String(state.coreVersionRaw || '').trim();
    const result = await window.clashfox.checkKernelUpdates({ source, currentVersion });
    state.kernelUpdateInfo = result || null;
    state.kernelUpdateCheckedAt = Date.now();
    if (result && typeof result === 'object') {
      setCachedKernelUpdateResult(source, currentVersion, result);
    }
    applyKernelUpdateInstallHint();
    if (!result || !result.ok) {
      const detail = result && result.error ? ` (${String(result.error)})` : '';
      setHelpAboutStatus(`${ti('help.kernelUpdateCheckFailed', 'Kernel update check failed')}${detail}`, 'error');
    } else if (result.status === 'update_available') {
      const latest = formatKernelVersionForDisplay(result.latestVersion, source, Boolean(result.prerelease));
      setHelpAboutStatus(`${ti('help.kernelUpdateAvailable', 'Kernel update available')}: ${latest}`, 'warning');
    } else {
      setHelpAboutStatus(ti('help.kernelAlreadyLatest', 'Kernel is up to date.'), 'success');
    }
  } catch (err) {
    const detail = err && err.message ? ` (${String(err.message)})` : '';
    setHelpAboutStatus(`${ti('help.kernelUpdateCheckFailed', 'Kernel update check failed')}${detail}`, 'error');
  } finally {
    if (helpCheckKernelUpdateBtn) {
      helpCheckKernelUpdateBtn.disabled = false;
    }
  }
}

async function handleHelpHelperUpdateCheck() {
  if (helpCheckHelperUpdateBtn) {
    helpCheckHelperUpdateBtn.disabled = true;
  }
  setHelpAboutStatus(ti('help.checkingHelperUpdate', 'Checking helper updates...'), 'checking');
  try {
    const result = await checkHelperUpdates({ force: true });
    if (result && result.error === 'bridge_missing') {
      setHelpAboutStatus(ti('help.updateCheckBridgeMissing', 'Update check is unavailable.'), 'error');
      return;
    }
    if (!result || !result.ok) {
      const detail = result && result.error ? ` (${String(result.error)})` : '';
      setHelpAboutStatus(`${ti('help.helperUpdateCheckFailed', 'Helper update check failed')}${detail}`, 'error');
    } else if (result.updateAvailable) {
      const targetVersion = normalizeVersionForDisplay(result.targetVersion || result.onlineVersion || '');
      setHelpAboutStatus(
        targetVersion
          ? `${ti('help.helperUpdateAvailable', 'Helper update available')}: v${targetVersion}`
          : ti('help.helperUpdateAvailable', 'Helper update available'),
        'warning',
      );
    } else {
      setHelpAboutStatus(ti('help.helperAlreadyLatest', 'Helper is up to date.'), 'success');
    }
  } catch (err) {
    const detail = err && err.message ? ` (${String(err.message)})` : '';
    setHelpAboutStatus(`${ti('help.helperUpdateCheckFailed', 'Helper update check failed')}${detail}`, 'error');
  } finally {
    await refreshHelperPanel(true);
    if (helpCheckHelperUpdateBtn) {
      helpCheckHelperUpdateBtn.disabled = false;
    }
  }
}

function updateStatusUI(data) {
  const running = data.running;
  applyKernelRunningState(running, 'status');
  state.coreVersionRaw = readKernelVersionFromSettings();
  if (!state.coreVersionRaw) {
    const kernelPathRaw = String((data && data.kernelPath) || '').trim();
    const kernelName = kernelPathRaw ? kernelPathRaw.split('/').pop() : '';
    if (kernelName && kernelName !== '-') {
      state.coreVersionRaw = kernelName;
    }
  }
  syncGithubSourceFromKernelVersion();
  state.configDefault = data.configDefault || '';
  const configValue = getCurrentConfigPath() || data.configDefault || '-';
  const hasKernel = Boolean(data.kernelExists);
  state.hasKernel = hasKernel;
  if (statusRunning) {
    statusRunning.textContent = running ? t('labels.running') : t('labels.stopped');
  }
  if (overviewStatus) {
    overviewStatus.textContent = running ? t('labels.running') : t('labels.stopped');
  }
  if (statusVersion) {
    statusVersion.textContent = state.coreVersionRaw || t('labels.notInstalled');
  }
  applyKernelVersionDisplay(state.coreVersionRaw || '');
  syncQuickActionButtons();
  if (quickHintNodes.length) {
  // quick hint removed
  }
  if (statusKernelPath) {
    statusKernelPath.textContent = hasKernel ? (data.kernelPath || '-') : '-';
  }
  if (statusConfig) {
    statusConfig.textContent = hasKernel ? configValue : '-';
  }
  if (statusKernelPathRow) {
    statusKernelPathRow.classList.toggle('is-hidden', !hasKernel);
  }
  if (statusConfigRow) {
    statusConfigRow.classList.toggle('is-hidden', !hasKernel);
  }
  if (settingsKernelPath) {
    settingsKernelPath.textContent = data.kernelPath || '-';
  }
  if (settingsConfigDefault) {
    settingsConfigDefault.textContent = data.configDefault || '-';
  }
  if (settingsLogPath) {
    settingsLogPath.textContent = data.logPath || '-';
  }
  if (settingsConfigDir) {
    settingsConfigDir.placeholder = data.configDir || '-';
  }
  if (settingsCoreDir) {
    settingsCoreDir.placeholder = data.coreDir || '-';
  }
  if (settingsDataDir) {
    settingsDataDir.placeholder = data.dataDir || '-';
  }
  if (settingsExternalUi) {
    settingsExternalUi.placeholder = 'ui';
  }
  if (settingsExternalUiUrl) {
    settingsExternalUiUrl.placeholder = '-';
    // ensure value reflects current panel
    updateExternalUiUrlField();
  }
  if (currentPage === 'kernel') {
    refreshKernelUpdateNotice();
  }
  syncRunningIndicators(state.coreRunning);
  renderConfigTable();
}

function syncQuickActionButtons() {
  const running = Boolean(state.coreRunning);
  const inFlight = Boolean(state.coreActionInFlight);
  if (startBtn) {
    startBtn.disabled = inFlight || running;
  }
  if (stopBtn) {
    stopBtn.disabled = inFlight || !running;
  }
  if (restartBtn) {
    restartBtn.disabled = inFlight || !running;
  }
}

function setCoreActionState(inFlight) {
  state.coreActionInFlight = inFlight;
  syncQuickActionButtons();
}

function setQuickActionRunningState(running) {
  const next = Boolean(running);
  state.coreRunning = next;
  state.coreRunningUpdatedAt = Date.now();
  state.coreRunningFalseStreak = 0;
  cacheMihomoStatusForUi(next, 'quick-action');
  syncRunningIndicators(next);
  syncQuickActionButtons();
}

function getPersistedMihomoStatusSnapshot() {
  const candidate = (state.settings && state.settings.mihomoStatus)
    || (state.fileSettings && state.fileSettings.mihomoStatus)
    || null;
  if (!candidate || typeof candidate !== 'object' || typeof candidate.running !== 'boolean') {
    return null;
  }
  return candidate;
}

function applyPersistedMihomoStatus() {
  const snapshot = getPersistedMihomoStatusSnapshot();
  if (!snapshot) {
    return;
  }
  applyKernelRunningState(Boolean(snapshot.running), 'settings');
}

function cacheMihomoStatusForUi(running, source = 'status') {
  const snapshot = {
    running: Boolean(running),
    source: String(source || 'status'),
    updatedAt: new Date().toISOString(),
  };
  state.mihomoStatus = snapshot;
  if (!state.settings) {
    state.settings = { ...DEFAULT_SETTINGS };
  }
  if (!state.fileSettings) {
    state.fileSettings = {};
  }
  state.settings.mihomoStatus = snapshot;
  state.fileSettings.mihomoStatus = snapshot;
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
  } catch {
    // ignore
  }
}

function applyKernelRunningState(running, source = 'status') {
  const next = Boolean(running);
  const now = Date.now();
  if (next) {
    state.coreRunning = true;
    state.coreRunningFalseStreak = 0;
    state.coreRunningUpdatedAt = now;
    cacheMihomoStatusForUi(true, source);
    syncRunningIndicators(true);
    syncSidebarFoxDividerState();
    syncQuickActionButtons();
    return;
  }
  if (source === 'status' && state.coreRunning && now < state.coreRunningGuardUntil) {
    state.coreRunningFalseStreak += 1;
    if (state.coreRunningFalseStreak < 3) {
      return;
    }
  }
  state.coreRunning = false;
  state.coreRunningFalseStreak = 0;
  state.coreRunningUpdatedAt = now;
  cacheMihomoStatusForUi(false, source);
  syncRunningIndicators(false);
  syncSidebarFoxDividerState();
  syncQuickActionButtons();
}

function syncRunningIndicators(running) {
  const label = running ? t('labels.running') : t('labels.stopped');
  if (statusRunning) {
    statusRunning.textContent = label;
  }
  if (overviewStatus) {
    overviewStatus.textContent = label;
  }
  if (statusPill) {
    // Always reflect the latest real status instead of keeping a stale transition state.
    statusPill.dataset.state = running ? 'running' : 'stopped';
    statusPill.dataset.i18nTipKey = running ? 'labels.running' : 'labels.stopped';
    statusPill.dataset.i18nTip = statusPill.dataset.i18nTipKey;
    statusPill.dataset.tip = label;
    statusPill.setAttribute('aria-label', label);
    if (statusPill.dataset.nativeTitle === 'false') {
      statusPill.removeAttribute('title');
    } else {
      statusPill.setAttribute('title', label);
    }
  }
}

function updateInstallVersionVisibility() {
  if (!installVersionRow || !installVersion) {
    return;
  }
  const currentUser =
    (githubUser && githubUser.value) ||
    (settingsGithubUser && settingsGithubUser.value) ||
    (state.settings && state.settings.githubUser) ||
    '';
  const isMetaCubeX = String(currentUser).toLowerCase() === 'metacubex';
  installVersionRow.classList.toggle('is-hidden', !isMetaCubeX);
  installVersion.readOnly = !isMetaCubeX;
  if (!isMetaCubeX) {
    installVersion.value = '';
  }
  installVersion.disabled = state.installState === 'loading';
}

function formatUptime(seconds) {
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

function formatLatency(value) {
  const num = Number.parseFloat(value);
  if (!Number.isFinite(num)) {
    return '-';
  }
  return `${Math.round(num)} ms`;
}

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

function formatSimpleDateTime(value) {
  const parsed = Number.parseInt(String(value || '').trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return '-';
  }
  const date = new Date(parsed);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

function renderProviderSubscriptionOverview(payload = null) {
  if (!overviewProviderSubscriptionSummary || !overviewProviderSubscriptionList) {
    return;
  }
  const data = payload && typeof payload === 'object' ? payload : {};
  const summary = data.summary && typeof data.summary === 'object' ? data.summary : {};
  const items = Array.isArray(data.items) ? data.items : [];
  const providerCount = Number.parseInt(String(summary.providerCount || 0), 10) || items.length;
  const totalBytes = Number.parseFloat(summary.totalBytes || 0) || 0;
  const usedBytes = Number.parseFloat(summary.usedBytes || 0) || 0;
  const remainingBytes = Number.parseFloat(summary.remainingBytes || 0) || Math.max(0, totalBytes - usedBytes);
  const usedPercent = totalBytes > 0
    ? Math.max(0, Math.min(100, (usedBytes / totalBytes) * 100))
    : 0;

  const summaryMarkup = `
    <div class="provider-subscription-stat">
      <div class="provider-subscription-stat-label">${escapeLogCell(ti('providers.summaryCount', 'Providers'))}</div>
      <div class="provider-subscription-stat-value">${escapeLogCell(String(providerCount))}</div>
    </div>
    <div class="provider-subscription-stat">
      <div class="provider-subscription-stat-label">${escapeLogCell(ti('providers.summaryUsed', 'Used'))}</div>
      <div class="provider-subscription-stat-value">${escapeLogCell(formatBytes(usedBytes))}</div>
    </div>
    <div class="provider-subscription-stat">
      <div class="provider-subscription-stat-label">${escapeLogCell(ti('providers.summaryRemain', 'Remaining'))}</div>
      <div class="provider-subscription-stat-value">${escapeLogCell(formatBytes(remainingBytes))}</div>
    </div>
    <div class="provider-subscription-stat">
      <div class="provider-subscription-stat-label">${escapeLogCell(ti('providers.summaryUsage', 'Usage'))}</div>
      <div class="provider-subscription-stat-value">${escapeLogCell(`${usedPercent.toFixed(1)}%`)}</div>
    </div>
  `;
  let listMarkup = '';

  if (!items.length) {
    listMarkup = `<div class="provider-subscription-item-empty">${escapeLogCell(ti('providers.empty', 'No provider subscription data.'))}</div>`;
  } else {
    listMarkup = items.map((item) => {
      const name = String(item.name || '-').trim() || '-';
      const vehicleType = String(item.vehicleType || '').trim() || 'UNKNOWN';
      const percentRaw = Number.parseFloat(item.usedPercent || 0);
      const percent = Number.isFinite(percentRaw) ? Math.max(0, Math.min(100, percentRaw)) : 0;
      const used = Number.parseFloat(item.usedBytes || 0) || 0;
      const remaining = Number.parseFloat(item.remainingBytes || 0) || 0;
      const expireAt = Number.parseInt(String(item.expireAt || 0), 10) || 0;
      const expireText = expireAt > 0
        ? formatSimpleDateTime(expireAt)
        : '-';
      return `<div class="provider-subscription-item">
        <div class="provider-subscription-item-head">
          <div class="provider-subscription-item-name">${escapeLogCell(name)}</div>
          <div class="provider-subscription-item-percent">${escapeLogCell(`${percent.toFixed(1)}%`)}</div>
        </div>
        <div class="provider-subscription-progress">
          <div class="provider-subscription-progress-bar" style="width:${percent.toFixed(2)}%"></div>
        </div>
        <div class="provider-subscription-item-meta">
          <span>${escapeLogCell(`${ti('providers.remaining', 'Remaining')}: ${formatBytes(remaining)}`)}</span>
          <span>${escapeLogCell(`${ti('providers.used', 'Used')}: ${formatBytes(used)}`)}</span>
        </div>
        <div class="provider-subscription-item-meta">
          <span>${escapeLogCell(vehicleType)}</span>
          <span>${escapeLogCell(`${ti('providers.expire', 'Expire')}: ${expireText}`)}</span>
        </div>
      </div>`;
    }).join('');
  }
  const renderSignature = JSON.stringify([summaryMarkup, listMarkup]);
  if (state.providerSubscriptionRenderSignature === renderSignature) {
    return;
  }
  state.providerSubscriptionRenderSignature = renderSignature;
  setNodeHtmlIfChanged(overviewProviderSubscriptionSummary, summaryMarkup);
  setNodeHtmlIfChanged(overviewProviderSubscriptionList, listMarkup);
}


function renderRulesOverviewCard() {
  if (!overviewRulesChart || !overviewRulesRecords || !overviewRulesMetrics || !overviewRulesBehaviors) {
    return;
  }
  const currentView = state.rulesOverviewView === 'providers' ? 'providers' : 'rules';
  if (overviewRulesSwitch) {
    const switchSignature = `view:${currentView}`;
    if (state.rulesOverviewRenderSignatures.switchView !== switchSignature) {
      Array.from(overviewRulesSwitch.querySelectorAll('[data-rules-view]')).forEach((button) => {
        const view = String(button.dataset.rulesView || '').trim();
        button.classList.toggle('active', view === currentView);
      });
      state.rulesOverviewRenderSignatures.switchView = switchSignature;
    }
  }

  const renderMetrics = (items = []) => {
    const markup = items.map((item) => `
      <div class="rules-overview-metric">
        <div class="rules-overview-metric-label">${escapeLogCell(String(item.label || '-'))}</div>
        <div class="rules-overview-metric-value">${escapeLogCell(String(item.value || '-'))}</div>
      </div>
    `).join('');
    if (state.rulesOverviewRenderSignatures.metrics !== markup) {
      state.rulesOverviewRenderSignatures.metrics = markup;
      setNodeHtmlIfChanged(overviewRulesMetrics, markup);
    }
  };

  if (currentView === 'providers') {
    const payload = state.ruleProvidersOverviewPayload && typeof state.ruleProvidersOverviewPayload === 'object'
      ? state.ruleProvidersOverviewPayload
      : {};
    const items = Array.isArray(payload.items) ? payload.items : [];
    const behaviorStats = Array.isArray(payload.behaviors) ? payload.behaviors : [];
    const totalProviders = Number.parseInt(String(payload.totalProviders || 0), 10) || items.length;
    const totalRules = Number.parseInt(String(payload.totalRules || 0), 10) || 0;
    const behaviorKinds = behaviorStats.length;
    const maxProviderRules = items.length
      ? Math.max(...items.map((item) => Number(item.ruleCount || 0)), 0)
      : 0;

    renderMetrics([
      { label: ti('providers.summaryCount', 'Providers'), value: totalProviders },
      { label: ti('rules.total', 'Rules'), value: totalRules },
      { label: ti('rules.behaviors', 'Behaviors'), value: behaviorKinds },
      { label: ti('rules.maxPerProvider', 'Max/Provider'), value: maxProviderRules },
    ]);

    overviewRulesBehaviors.hidden = true;
    if (state.rulesOverviewRenderSignatures.behaviors !== '') {
      state.rulesOverviewRenderSignatures.behaviors = '';
      setNodeHtmlIfChanged(overviewRulesBehaviors, '');
    }

    if (!items.length) {
      overviewRulesChart.hidden = false;
      const emptyMarkup = `<div class="rules-overview-empty">${escapeLogCell(ti('rules.emptyProviders', 'No rule provider data.'))}</div>`;
      if (state.rulesOverviewRenderSignatures.chart !== emptyMarkup) {
        state.rulesOverviewRenderSignatures.chart = emptyMarkup;
        setNodeHtmlIfChanged(overviewRulesChart, emptyMarkup);
      }
      if (state.rulesOverviewRenderSignatures.records !== '') {
        state.rulesOverviewRenderSignatures.records = '';
        setNodeHtmlIfChanged(overviewRulesRecords, '');
      }
      overviewRulesRecords.hidden = true;
      return;
    }
    overviewRulesChart.hidden = false;
    const maxCount = Math.max(...items.map((item) => Number(item.ruleCount || 0)), 1);
    const chartMarkup = items.slice(0, 12).map((item) => {
      const name = String(item.name || '-').trim() || '-';
      const count = Number.parseInt(String(item.ruleCount || 0), 10) || 0;
      const ratio = Math.max(0, Math.min(100, (count / maxCount) * 100));
      return `<div class="rules-overview-row">
        <div class="rules-overview-row-name">${escapeLogCell(name)}</div>
        <div class="rules-overview-row-bar"><div class="rules-overview-row-fill" style="width:${ratio.toFixed(2)}%"></div></div>
        <div class="rules-overview-row-count">${escapeLogCell(String(count))}</div>
      </div>`;
    }).join('');
    if (state.rulesOverviewRenderSignatures.chart !== chartMarkup) {
      state.rulesOverviewRenderSignatures.chart = chartMarkup;
      setNodeHtmlIfChanged(overviewRulesChart, chartMarkup);
    }
    if (state.rulesOverviewRenderSignatures.records !== '') {
      state.rulesOverviewRenderSignatures.records = '';
      setNodeHtmlIfChanged(overviewRulesRecords, '');
    }
    overviewRulesRecords.hidden = true;
    return;
  }

  const payload = state.rulesOverviewPayload && typeof state.rulesOverviewPayload === 'object'
    ? state.rulesOverviewPayload
    : {};
  const types = Array.isArray(payload.types) ? payload.types : [];
  const records = Array.isArray(payload.records) ? payload.records : [];
  const policies = Array.isArray(payload.policies) ? payload.policies : [];
  const totalRules = Number.parseInt(String(payload.totalRules || 0), 10) || 0;
  const typeKinds = types.length;
  const policyKinds = policies.length;
  const shownRecords = Math.min(records.length, 100);
  renderMetrics([
    { label: ti('rules.total', 'Rules'), value: totalRules },
    { label: ti('rules.typeKinds', 'Type Kinds'), value: typeKinds },
    { label: ti('rules.policyKinds', 'Policy Kinds'), value: policyKinds },
    { label: ti('rules.recordsShown', 'Records Shown'), value: shownRecords },
  ]);
  overviewRulesBehaviors.hidden = true;
  if (state.rulesOverviewRenderSignatures.behaviors !== '') {
    state.rulesOverviewRenderSignatures.behaviors = '';
    setNodeHtmlIfChanged(overviewRulesBehaviors, '');
  }
  overviewRulesChart.hidden = true;
  if (!types.length) {
    const emptyMarkup = `<div class="rules-overview-empty">${escapeLogCell(ti('rules.empty', 'No rules data.'))}</div>`;
    if (state.rulesOverviewRenderSignatures.records !== emptyMarkup) {
      state.rulesOverviewRenderSignatures.records = emptyMarkup;
      setNodeHtmlIfChanged(overviewRulesRecords, emptyMarkup);
    }
    overviewRulesRecords.hidden = false;
    return;
  }
  if (!records.length) {
    const emptyMarkup = `<div class="rules-overview-empty">${escapeLogCell(ti('rules.empty', 'No rules data.'))}</div>`;
    if (state.rulesOverviewRenderSignatures.records !== emptyMarkup) {
      state.rulesOverviewRenderSignatures.records = emptyMarkup;
      setNodeHtmlIfChanged(overviewRulesRecords, emptyMarkup);
    }
  } else {
    const recordsMarkup = records.slice(0, 100).map((record) => {
      const type = String(record.type || '-').trim() || '-';
      const payloadText = String(record.payload || '-').trim() || '-';
      const policy = String(record.policy || '-').trim() || '-';
      return `<div class="rules-overview-record">
        <span class="rules-overview-record-type">${escapeLogCell(type)}</span>
        <span class="rules-overview-record-payload">${escapeLogCell(payloadText)}</span>
        <span class="rules-overview-record-policy">${escapeLogCell(policy)}</span>
      </div>`;
    }).join('');
    if (state.rulesOverviewRenderSignatures.records !== recordsMarkup) {
      state.rulesOverviewRenderSignatures.records = recordsMarkup;
      setNodeHtmlIfChanged(overviewRulesRecords, recordsMarkup);
    }
  }
  overviewRulesRecords.hidden = false;
}

const TRAFFIC_HISTORY_POINTS = 26;
const CONNECTION_HISTORY_MS = 30000;

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

function formatKbpsLabel(kbPerSec) {
  const num = Number.parseFloat(kbPerSec);
  if (!Number.isFinite(num)) {
    return '-';
  }
  if (num >= 1024) {
    const value = num / 1024;
    const fixed = value >= 100 ? 0 : value >= 10 ? 1 : 2;
    return `${value.toFixed(fixed)} MB/s`;
  }
  return `${Math.round(num)} KB/s`;
}

function buildSparkPath(values, maxValue) {
  if (!values.length) {
    return '';
  }
  const width = 100;
  const height = 40;
  const len = values.length;
  const denom = maxValue > 0 ? maxValue : 1;
  const points = values.map((value, index) => {
    const x = len === 1 ? 0 : (index / (len - 1)) * width;
    const y = height - (Math.min(Math.max(value, 0), denom) / denom) * height;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  return `M ${points.join(' L ')}`;
}

function buildSparkArea(values, maxValue) {
  if (!values.length) {
    return '';
  }
  const width = 100;
  const height = 40;
  const line = buildSparkPath(values, maxValue);
  if (!line) {
    return '';
  }
  const lastX = values.length === 1 ? 0 : 100;
  return `${line} L ${lastX},${height} L 0,${height} Z`;
}

function renderTrafficChart(values, lineEl, areaEl, axisEls) {
  if (!lineEl || !areaEl || !axisEls.length) {
    return;
  }
  if (!values.length) {
    axisEls.forEach((el) => {
      el.textContent = '-';
    });
    lineEl.setAttribute('d', '');
    areaEl.setAttribute('d', '');
    return;
  }
  const maxValue = Math.max(...values, 0);
  let niceMax = niceMaxValue(maxValue);
  if (niceMax < 8) {
    niceMax = 8;
  }
  const step = niceMax / 4;
  axisEls.forEach((el, index) => {
    const labelValue = step * (4 - index);
    el.textContent = formatKbpsLabel(labelValue);
  });
  lineEl.setAttribute('d', buildSparkPath(values, niceMax));
  areaEl.setAttribute('d', buildSparkArea(values, niceMax));
}

function updateTrafficHistory(rxRate, txRate) {
  const rxK = Math.max(0, rxRate / 1024);
  const txK = Math.max(0, txRate / 1024);
  state.trafficHistoryRx.push(rxK);
  state.trafficHistoryTx.push(txK);
  if (state.trafficHistoryRx.length > TRAFFIC_HISTORY_POINTS) {
    state.trafficHistoryRx.shift();
  }
  if (state.trafficHistoryTx.length > TRAFFIC_HISTORY_POINTS) {
    state.trafficHistoryTx.shift();
  }
  renderTrafficChart(state.trafficHistoryTx, trafficUploadLine, trafficUploadArea, trafficUploadAxis);
  renderTrafficChart(state.trafficHistoryRx, trafficDownloadLine, trafficDownloadArea, trafficDownloadAxis);
  cacheOverviewTrafficFromState();
}

function resetTrafficHistory() {
  state.trafficHistoryRx = [];
  state.trafficHistoryTx = [];
  renderTrafficChart(state.trafficHistoryTx, trafficUploadLine, trafficUploadArea, trafficUploadAxis);
  renderTrafficChart(state.trafficHistoryRx, trafficDownloadLine, trafficDownloadArea, trafficDownloadAxis);
  cacheOverviewTrafficFromState();
}

function parseAuthList(value) {
  if (!value) {
    return [];
  }
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function updateSystemTraffic(rxBytes, txBytes) {
  const rx = Number.parseFloat(rxBytes);
  const tx = Number.parseFloat(txBytes);
  const now = Date.now();
  const hasSnapshot = state.trafficRxBytes !== null && state.trafficTxBytes !== null && Boolean(state.trafficAt);
  if (!Number.isFinite(rx) || !Number.isFinite(tx)) {
    // Overview/traffic may occasionally return empty counters; don't wipe a valid chart snapshot.
    if (hasSnapshot) {
      return;
    }
    if (trafficSystemDownloadRate) {
      trafficSystemDownloadRate.textContent = '-';
    }
    if (overviewSummaryDownloadRate) {
      setNodeTextIfChanged(overviewSummaryDownloadRate, '-');
    }
    if (trafficSystemDownloadTotal) {
      trafficSystemDownloadTotal.textContent = '-';
    }
    if (trafficSystemUploadRate) {
      trafficSystemUploadRate.textContent = '-';
    }
    if (overviewSummaryUploadRate) {
      setNodeTextIfChanged(overviewSummaryUploadRate, '-');
    }
    if (trafficSystemUploadTotal) {
      trafficSystemUploadTotal.textContent = '-';
    }
    if (trafficTotalDownload) {
      trafficTotalDownload.textContent = '-';
    }
    if (overviewSummaryDownloadTotal) {
      setNodeTextIfChanged(overviewSummaryDownloadTotal, '-');
    }
    if (trafficTotalUpload) {
      trafficTotalUpload.textContent = '-';
    }
    if (overviewSummaryUploadTotal) {
      setNodeTextIfChanged(overviewSummaryUploadTotal, '-');
    }
    state.trafficRxBytes = null;
    state.trafficTxBytes = null;
    state.trafficAt = 0;
    resetTrafficHistory();
    return;
  }

  if (trafficSystemDownloadTotal) {
    trafficSystemDownloadTotal.textContent = `${t('status.trafficTotal')}: ${formatBytes(rx)}`;
  }
  if (trafficSystemUploadTotal) {
    trafficSystemUploadTotal.textContent = `${t('status.trafficTotal')}: ${formatBytes(tx)}`;
  }
  if (trafficTotalDownload) {
    trafficTotalDownload.textContent = formatBytes(rx);
  }
  if (overviewSummaryDownloadTotal) {
    setNodeTextIfChanged(overviewSummaryDownloadTotal, formatBytes(rx));
  }
  if (trafficTotalUpload) {
    trafficTotalUpload.textContent = formatBytes(tx);
  }
  if (overviewSummaryUploadTotal) {
    setNodeTextIfChanged(overviewSummaryUploadTotal, formatBytes(tx));
  }

  if (state.trafficRxBytes === null || state.trafficTxBytes === null || !state.trafficAt) {
    state.trafficRxBytes = rx;
    state.trafficTxBytes = tx;
    state.trafficAt = now;
    if (trafficSystemDownloadRate) {
      trafficSystemDownloadRate.textContent = '-';
    }
    if (overviewSummaryDownloadRate) {
      setNodeTextIfChanged(overviewSummaryDownloadRate, '-');
    }
    if (trafficSystemUploadRate) {
      trafficSystemUploadRate.textContent = '-';
    }
    if (overviewSummaryUploadRate) {
      setNodeTextIfChanged(overviewSummaryUploadRate, '-');
    }
    cacheOverviewTrafficFromState();
    return;
  }

  const deltaSec = (now - state.trafficAt) / 1000;
  if (deltaSec <= 0) {
    return;
  }
  const rxRate = (rx - state.trafficRxBytes) / deltaSec;
  const txRate = (tx - state.trafficTxBytes) / deltaSec;
  state.trafficRxBytes = rx;
  state.trafficTxBytes = tx;
  state.trafficAt = now;

  if (trafficSystemDownloadRate) {
    trafficSystemDownloadRate.textContent = formatBitrate(rxRate);
  }
  if (overviewSummaryDownloadRate) {
    setNodeTextIfChanged(overviewSummaryDownloadRate, formatBitrate(rxRate));
  }
  if (trafficSystemUploadRate) {
    trafficSystemUploadRate.textContent = formatBitrate(txRate);
  }
  if (overviewSummaryUploadRate) {
    setNodeTextIfChanged(overviewSummaryUploadRate, formatBitrate(txRate));
  }
  updateTrafficHistory(rxRate, txRate);
}

function updateProxyTraffic(rxBytes, txBytes) {
  updateProxyTrafficSnapshot(rxBytes, txBytes, null, null);
}

function formatKernelDisplay(value) {
  const text = String(value || '').trim();
  if (!text) {
    return '-';
  }
  const match = text.match(/alpha(?:-smart)?-[0-9a-f]+/i);
  if (match) {
    return match[0];
  }
  const semver = text.match(/\bv?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?\b/);
  if (semver) {
    return semver[0];
  }
  const tokens = text.split(/\s+/).filter(Boolean);
  if (tokens.length >= 3) {
    return tokens[2] || '-';
  }
  if (tokens.length >= 1) {
    return tokens[0] || '-';
  }
  return '-';
}

function parseConnectionCount(value) {
  if (value === '' || value === null || value === undefined) {
    return null;
  }
  const text = String(value).trim();
  if (!text) {
    return null;
  }
  const matched = text.match(/-?\d+/);
  if (!matched) {
    return null;
  }
  const parsed = Number.parseInt(matched[0], 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
}

function renderConnectionHistoryChart(samples) {
  if (!overviewConnLine || !overviewConnArea) {
    return;
  }
  if (!Array.isArray(samples) || !samples.length) {
    overviewConnLine.setAttribute('d', '');
    overviewConnArea.setAttribute('d', '');
    return;
  }

  const values = samples.map((item) => Number.parseInt(item.value, 10)).filter((item) => Number.isFinite(item) && item >= 0);
  if (!values.length) {
    overviewConnLine.setAttribute('d', '');
    overviewConnArea.setAttribute('d', '');
    return;
  }

  let maxValue = niceMaxValue(Math.max(...values, 0));
  if (maxValue < 4) {
    maxValue = 4;
  }
  overviewConnLine.setAttribute('d', buildSparkPath(values, maxValue));
  overviewConnArea.setAttribute('d', buildSparkArea(values, maxValue));
}

function updateRealtimeConnections(value) {
  if (!overviewConnCurrent || !overviewConnPeak || !overviewConnAvg || !overviewConnTrend) {
    return;
  }
  const current = parseConnectionCount(value);
  if (current === null) {
    if (overviewConnections) {
      setNodeTextIfChanged(overviewConnections, '-');
    }
    if (overviewSummaryConnections) {
      setNodeTextIfChanged(overviewSummaryConnections, '-');
    }
    setNodeTextIfChanged(overviewConnCurrent, '-');
    setNodeTextIfChanged(overviewConnPeak, '-');
    setNodeTextIfChanged(overviewConnAvg, '-');
    setNodeTextIfChanged(overviewConnTrend, '-');
    overviewConnTrend.dataset.trend = 'flat';
    state.connSamples = [];
    state.connPeak = 0;
    state.connLast = null;
    renderConnectionHistoryChart([]);
    return;
  }

  const now = Date.now();
  state.connSamples.push({ at: now, value: current });
  const threshold = now - CONNECTION_HISTORY_MS;
  state.connSamples = state.connSamples.filter((item) => item.at >= threshold);
  state.connPeak = Math.max(state.connPeak || 0, current);

  const total = state.connSamples.reduce((sum, item) => sum + item.value, 0);
  const avg = state.connSamples.length ? Math.round(total / state.connSamples.length) : current;
  const delta = state.connLast === null ? 0 : (current - state.connLast);
  state.connLast = current;

  if (overviewConnections) {
    setNodeTextIfChanged(overviewConnections, String(current));
  }
  if (overviewSummaryConnections) {
    setNodeTextIfChanged(overviewSummaryConnections, String(current));
  }
  setNodeTextIfChanged(overviewConnCurrent, String(current));
  setNodeTextIfChanged(overviewConnPeak, String(state.connPeak));
  setNodeTextIfChanged(overviewConnAvg, String(avg));

  if (delta > 0) {
    setNodeTextIfChanged(overviewConnTrend, `▲ +${delta}`);
    overviewConnTrend.dataset.trend = 'up';
  } else if (delta < 0) {
    setNodeTextIfChanged(overviewConnTrend, `▼ ${delta}`);
    overviewConnTrend.dataset.trend = 'down';
  } else {
    setNodeTextIfChanged(overviewConnTrend, '• 0');
    overviewConnTrend.dataset.trend = 'flat';
  }

  renderConnectionHistoryChart(state.connSamples);
}

function updateOverviewUI(data) {
  if (!data) {
    return;
  }
  const now = Date.now();
  const wsConnectionFresh = Boolean(state.lastMihomoConnectionsAt) && (now - Number(state.lastMihomoConnectionsAt || 0) < 10000);
  const wsTrafficFresh = Boolean(state.lastMihomoTrafficAt) && (now - Number(state.lastMihomoTrafficAt || 0) < 10000);
  const wsMemoryFresh = Boolean(state.lastMihomoMemoryAt) && (now - Number(state.lastMihomoMemoryAt || 0) < 10000);
  const running = Boolean(data.running);
  state.overviewRunning = running;
  state.overviewRunningUpdatedAt = Date.now();
  const uptime = Number.parseFloat(data.uptimeSec);
  if (running && Number.isFinite(uptime) && uptime >= 0) {
    state.overviewUptimeBaseSec = uptime;
    state.overviewUptimeAt = Date.now();
    if (overviewUptime) {
      setNodeTextIfChanged(overviewUptime, formatUptime(uptime));
    }
  } else if (!running) {
    state.overviewUptimeBaseSec = 0;
    state.overviewUptimeAt = 0;
    if (overviewUptime) {
      setNodeTextIfChanged(overviewUptime, '-');
    }
  }
  if (!wsConnectionFresh) {
    const fallbackConnections = parseConnectionCount(data.connections);
    if (fallbackConnections !== null) {
      updateRealtimeConnections(fallbackConnections);
    }
  }
  if (!wsTrafficFresh) {
    updateSystemTraffic(data.rxBytes, data.txBytes);
  }
  if (!wsMemoryFresh) {
    const fallbackMemory = Number.parseFloat(data.memory);
    if (Number.isFinite(fallbackMemory) && fallbackMemory >= 0) {
      updateOverviewMemoryValue(fallbackMemory);
    }
  }
  applyOverviewNetworkSnapshot(data);
  updateFoxRankFromOverviewSnapshot(data);
}

function applyOverviewNetworkSnapshot(data) {
  if (!data || typeof data !== 'object') {
    return;
  }
  const internetLatency = formatLatency(data.internetMs ?? data.internet ?? data.internetLatency);
  const dnsLatency = formatLatency(data.dnsMs ?? data.dns ?? data.dnsLatency);
  const routerLatency = formatLatency(data.routerMs ?? data.router ?? data.gatewayMs ?? data.routerLatency);

  if (internetLatency !== '-') {
    state.overviewLatencySnapshot.internet = internetLatency;
  }
  if (dnsLatency !== '-') {
    state.overviewLatencySnapshot.dns = dnsLatency;
  }
  if (routerLatency !== '-') {
    state.overviewLatencySnapshot.router = routerLatency;
  }

  if (overviewInternet) {
    setNodeTextIfChanged(overviewInternet, internetLatency !== '-'
      ? internetLatency
      : (state.overviewLatencySnapshot.internet || '-'));
  }
  if (overviewDns) {
    setNodeTextIfChanged(overviewDns, dnsLatency !== '-'
      ? dnsLatency
      : (state.overviewLatencySnapshot.dns || '-'));
  }
  if (overviewRouter) {
    setNodeTextIfChanged(overviewRouter, routerLatency !== '-'
      ? routerLatency
      : (state.overviewLatencySnapshot.router || '-'));
  }
  if (overviewNetwork) {
    const nextNetworkName = String(data.networkName || '').trim();
    const fallbackNetworkName = state.settings && state.settings.device && state.settings.device.networkName
      ? String(state.settings.device.networkName || '').trim()
      : '';
    setNodeTextIfChanged(
      overviewNetwork,
      nextNetworkName || fallbackNetworkName || String(overviewNetwork.textContent || '').trim() || '-',
    );
  }
  if (overviewLocalIp) {
    const rawLocalIp = String(data.localIp || '').trim();
    if (rawLocalIp) {
      state.overviewIpRaw.local = rawLocalIp;
    }
    const text = maskIpAddress(rawLocalIp || state.overviewIpRaw.local || '') || '-';
    setNodeTextIfChanged(overviewLocalIp, text);
    setOverviewCopyButtonVisible(overviewLocalIpCopy, Boolean(text && text !== '-'));
  }
  if (overviewProxyIp) {
    const rawProxyIp = String(data.proxyIp || '').trim();
    if (rawProxyIp) {
      state.overviewIpRaw.proxy = rawProxyIp;
    }
    const text = maskIpAddress(rawProxyIp || state.overviewIpRaw.proxy || '') || '-';
    setNodeTextIfChanged(overviewProxyIp, text);
    setOverviewCopyButtonVisible(overviewProxyIpCopy, Boolean(text && text !== '-'));
  }
  if (overviewInternetIp) {
    const ipValue = data.internetIp4 || data.internetIp || '';
    const rawInternetIp = String(ipValue || '').trim();
    if (rawInternetIp) {
      state.overviewIpRaw.internet = rawInternetIp;
    }
    const text = maskIpAddress(rawInternetIp || state.overviewIpRaw.internet || '') || '-';
    setNodeTextIfChanged(overviewInternetIp, text);
    setOverviewCopyButtonVisible(overviewInternetIpCopy, Boolean(text && text !== '-'));
  }
  cacheOverviewNetworkFromState();
}

function loadFoxRankFromStorage() {
  const createDefaultFoxRankState = () => ({
    totalUsageSec: 0,
    stableDays: 0,
    lastStableDay: '',
    lastUsageBaseSec: 0,
    lastUsageTickSec: 0,
    usageResetVersion: FOX_RANK_USAGE_RESET_VERSION,
    qualityScore: 0,
    explorationCount: 0,
    lastExplorationFingerprint: '',
    lastExplorationAt: 0,
    unlockedBadges: [],
    freshUnlockedBadges: [],
    badgeUnlockMoments: {},
    history: [],
    lastQuickReportDay: '',
    quickReportBaseline: null,
  });
  const normalizeHistory = (value) => (Array.isArray(value) ? value : [])
    .map((item) => ({
      day: String(item && item.day ? item.day : ''),
      xp: Number(item && item.xp) || 0,
      usageSec: Number(item && item.usageSec) || 0,
      stableDays: Number(item && item.stableDays) || 0,
      qualityScore: Number(item && item.qualityScore) || 0,
      explorationCount: Number(item && item.explorationCount) || 0,
      unlockedCount: Number(item && item.unlockedCount) || 0,
    }))
    .filter((item) => item.day)
    .slice(-14);
  try {
    const payload = localStorage.getItem(FOX_RANK_STORAGE_KEY);
    if (!payload) {
      return createDefaultFoxRankState();
    }
    const parsed = JSON.parse(payload);
    const usageResetVersion = String(parsed.usageResetVersion || '');
    const shouldResetUsage = usageResetVersion !== FOX_RANK_USAGE_RESET_VERSION;
    return {
      ...createDefaultFoxRankState(),
      totalUsageSec: shouldResetUsage ? 0 : (Number(parsed.totalUsageSec) || 0),
      stableDays: Number(parsed.stableDays) || 0,
      lastStableDay: String(parsed.lastStableDay || ''),
      usageResetVersion: FOX_RANK_USAGE_RESET_VERSION,
      qualityScore: Number(parsed.qualityScore) || 0,
      explorationCount: Number(parsed.explorationCount) || 0,
      lastExplorationFingerprint: String(parsed.lastExplorationFingerprint || ''),
      lastExplorationAt: Number(parsed.lastExplorationAt) || 0,
      unlockedBadges: Array.isArray(parsed.unlockedBadges) ? parsed.unlockedBadges.map((item) => String(item || '')) : [],
      badgeUnlockMoments: parsed.badgeUnlockMoments && typeof parsed.badgeUnlockMoments === 'object'
        ? Object.fromEntries(Object.entries(parsed.badgeUnlockMoments).map(([key, value]) => [key, String(value || '')]))
        : {},
      history: normalizeHistory(parsed.history),
      lastQuickReportDay: String(parsed.lastQuickReportDay || ''),
      quickReportBaseline: parsed.quickReportBaseline && typeof parsed.quickReportBaseline === 'object'
        ? {
          xp: Number(parsed.quickReportBaseline.xp) || 0,
          stableDays: Number(parsed.quickReportBaseline.stableDays) || 0,
          qualityScore: Number(parsed.quickReportBaseline.qualityScore) || 0,
          explorationCount: Number(parsed.quickReportBaseline.explorationCount) || 0,
        }
        : null,
    };
  } catch {
    return createDefaultFoxRankState();
  }
}

function saveFoxRankToStorage() {
  if (!state.foxRank) {
    return;
  }
  try {
    localStorage.setItem(FOX_RANK_STORAGE_KEY, JSON.stringify({
      totalUsageSec: state.foxRank.totalUsageSec,
      stableDays: state.foxRank.stableDays,
      lastStableDay: state.foxRank.lastStableDay,
      usageResetVersion: state.foxRank.usageResetVersion || FOX_RANK_USAGE_RESET_VERSION,
      qualityScore: state.foxRank.qualityScore || 0,
      explorationCount: state.foxRank.explorationCount || 0,
      lastExplorationFingerprint: state.foxRank.lastExplorationFingerprint || '',
      lastExplorationAt: state.foxRank.lastExplorationAt || 0,
      unlockedBadges: Array.isArray(state.foxRank.unlockedBadges) ? state.foxRank.unlockedBadges : [],
      badgeUnlockMoments: state.foxRank.badgeUnlockMoments && typeof state.foxRank.badgeUnlockMoments === 'object'
        ? state.foxRank.badgeUnlockMoments
        : {},
      history: Array.isArray(state.foxRank.history) ? state.foxRank.history.slice(-14) : [],
      lastQuickReportDay: state.foxRank.lastQuickReportDay || '',
      quickReportBaseline: state.foxRank.quickReportBaseline && typeof state.foxRank.quickReportBaseline === 'object'
        ? state.foxRank.quickReportBaseline
        : null,
    }));
  } catch {
    // ignore storage failures
  }
}

function computeFoxRankXp() {
  if (!state.foxRank) {
    return 0;
  }
  const usageXp = Math.floor((state.foxRank.totalUsageSec || 0) / 600);
  const stabilityXp = (state.foxRank.stableDays || 0) * 20;
  const qualityXp = Math.round((state.foxRank.qualityScore || 0) * 120);
  const explorationXp = (state.foxRank.explorationCount || 0) * 12;
  return usageXp + stabilityXp + qualityXp + explorationXp;
}

function getFoxRankTierForXp(xp) {
  for (let i = FOX_RANK_TIERS.length - 1; i >= 0; i -= 1) {
    const tier = FOX_RANK_TIERS[i];
    if (xp >= tier.minXp) {
      const nextTier = FOX_RANK_TIERS[i + 1];
      const nextMin = nextTier ? nextTier.minXp : tier.minXp + 800;
      const range = Math.max(nextMin - tier.minXp, 1);
      return {
        ...tier,
        index: i,
        nextMinXp: nextMin,
        range,
      };
    }
  }
  const first = FOX_RANK_TIERS[0];
  const next = FOX_RANK_TIERS[1];
  const fallbackNext = next ? next.minXp : first.minXp + 200;
  return {
    ...first,
    index: 0,
    nextMinXp: fallbackNext,
    range: Math.max(fallbackNext - first.minXp, 1),
  };
}

function getFoxRankQualityLabel(score) {
  if (score >= 0.85) {
    return foxRankText('qualityPristine', 'Pristine');
  }
  if (score >= 0.6) {
    return foxRankText('qualitySolid', 'Solid');
  }
  if (score >= 0.35) {
    return foxRankText('qualitySteady', 'Steady');
  }
  return foxRankText('qualityBronze', 'Bronze');
}

function getLatencyValue(data, keys) {
  if (!data || !Array.isArray(keys)) {
    return null;
  }
  for (const key of keys) {
    const raw = data[key];
    if (raw !== undefined && raw !== null) {
      const value = Number.parseFloat(raw);
      if (Number.isFinite(value)) {
        return value;
      }
    }
  }
  return null;
}

function computeFoxRankQualityScore(data) {
  const values = [
    getLatencyValue(data, ['internetMs', 'internet', 'internetLatency']),
    getLatencyValue(data, ['dnsMs', 'dns', 'dnsLatency']),
    getLatencyValue(data, ['routerMs', 'router', 'gatewayMs', 'routerLatency']),
  ].filter((value) => Number.isFinite(value) && value >= 0);
  if (!values.length) {
    return state.foxRank ? (state.foxRank.qualityScore || 0) : 0;
  }
  const normalized = values.reduce((sum, value) => {
    const delta = Math.max(0, value - 30);
    const capped = Math.min(1, Math.max(0, 1 - (delta / 170)));
    return sum + capped;
  }, 0);
  return Math.min(1, Math.max(0, normalized / values.length));
}

function formatFoxRankUsageValue(totalSeconds = 0) {
  const normalizedSeconds = Math.max(0, Number.isFinite(totalSeconds) ? totalSeconds : 0);
  const totalMinutes = Math.floor(normalizedSeconds / 60);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  return `${days}d:${hours}h:${minutes}m`;
}

function getTodayKey() {
  return new Date().toISOString().split('T')[0];
}

function getFoxRankBoost(snapshot) {
  const data = snapshot || getFoxRankSnapshot();
  const tierBoost = (data.tier.index + 1) * 2;
  const stabilityBoost = Math.min(12, data.stabilityDays);
  const qualityBoost = Math.round(data.qualityScore * 10);
  const total = tierBoost + stabilityBoost + qualityBoost;
  const description = data.qualityScore >= 0.75
    ? foxRankText('boostDescHigh', 'Node switching feels smoother today.')
    : data.stabilityDays >= 3
      ? foxRankText('boostDescStable', 'Stable sessions are compounding into cleaner routing.')
      : foxRankText('boostDescBase', 'Stay online to stack more daily momentum.');
  return {
    total,
    label: `${foxRankText('rankBoost', 'Rank Boost')} +${total}%`,
    description,
  };
}

function getFoxRankTierName(index = 0) {
  const map = [
    'tierFoxPup',
    'tierTrailFox',
    'tierLunarFox',
    'tierEmberFox',
    'tierStarFox',
    'tierApexFox',
  ];
  const key = map[index] || map[0];
  return foxRankText(key, FOX_RANK_TIERS[index] ? FOX_RANK_TIERS[index].name : 'Fox Pup');
}

function getFoxRankSkinText(skinId, field = 'name', fallback = '') {
  const map = {
    campfire: { name: 'skinCampfire', desc: 'skinCampfireDesc' },
    aurora: { name: 'skinAurora', desc: 'skinAuroraDesc' },
    starlight: { name: 'skinStarlight', desc: 'skinStarlightDesc' },
    'solar-crown': { name: 'skinSolar', desc: 'skinSolarDesc' },
  };
  const entry = map[skinId] || {};
  return foxRankText(entry[field] || '', fallback);
}

function getFoxRankSkinItems(snapshot) {
  const data = snapshot || getFoxRankSnapshot();
  return FOX_RANK_SKINS.map((skin) => ({
    ...skin,
    name: getFoxRankSkinText(skin.id, 'name', skin.name),
    desc: getFoxRankSkinText(skin.id, 'desc', skin.desc),
    unlocked: data.tier.index >= skin.unlockTier,
    active: data.tier.index >= skin.unlockTier
      && skin.unlockTier === Math.max(...FOX_RANK_SKINS.filter((item) => data.tier.index >= item.unlockTier).map((item) => item.unlockTier)),
  }));
}

function getFoxRankActiveSkin(snapshot) {
  const items = getFoxRankSkinItems(snapshot);
  return items.slice().reverse().find((item) => item.unlocked) || items[0];
}

function recordFoxRankHistory(snapshot = null) {
  if (!state.foxRank) {
    return;
  }
  const data = snapshot || getFoxRankSnapshot();
  const today = getTodayKey();
  const history = Array.isArray(state.foxRank.history) ? state.foxRank.history.slice(-13) : [];
  const entry = {
    day: today,
    xp: data.xp,
    usageSec: state.foxRank.totalUsageSec || 0,
    stableDays: state.foxRank.stableDays || 0,
    qualityScore: state.foxRank.qualityScore || 0,
    explorationCount: state.foxRank.explorationCount || 0,
    unlockedCount: Array.isArray(state.foxRank.unlockedBadges) ? state.foxRank.unlockedBadges.length : 0,
  };
  const index = history.findIndex((item) => item.day === today);
  if (index >= 0) {
    history[index] = entry;
  } else {
    history.push(entry);
  }
  state.foxRank.history = history.slice(-14);
}

function getFoxRankWeeklyReview(snapshot) {
  const data = snapshot || getFoxRankSnapshot();
  const history = Array.isArray(state.foxRank && state.foxRank.history) ? state.foxRank.history.slice(-7) : [];
  const first = history.length ? history[0] : null;
  const xpGain = Math.max(0, data.xp - (first ? first.xp : 0));
  const exploreGain = Math.max(0, (state.foxRank && state.foxRank.explorationCount ? state.foxRank.explorationCount : 0) - (first ? first.explorationCount : 0));
  const stableGain = Math.max(0, data.stabilityDays - (first ? first.stableDays : 0));
  const qualityPeak = Math.max(
    data.qualityScore,
    ...history.map((item) => Number(item.qualityScore) || 0),
  );
  const unlockedThisWeek = Object.values(state.foxRank && state.foxRank.badgeUnlockMoments ? state.foxRank.badgeUnlockMoments : {})
    .filter((day) => history.some((item) => item.day === day) || day === getTodayKey()).length;
  return {
    xpGain,
    exploreGain,
    stableGain,
    qualityPeak,
    unlockedThisWeek,
  };
}

function getFoxRankSnapshot() {
  const xp = computeFoxRankXp();
  const tier = getFoxRankTierForXp(xp);
  const delta = Math.max(0, Math.round(xp - tier.minXp));
  const span = Math.max(tier.range, 1);
  const usageText = formatFoxRankUsageValue(state.foxRank ? state.foxRank.totalUsageSec : 0);
  const stabilityDays = state.foxRank ? (state.foxRank.stableDays || 0) : 0;
  const qualityScore = state.foxRank ? (state.foxRank.qualityScore || 0) : 0;
  const qualityLabel = getFoxRankQualityLabel(qualityScore);
  const explorationCount = state.foxRank ? (state.foxRank.explorationCount || 0) : 0;
  const progress = Math.min(1, Math.max(0, delta / span));
  const boost = getFoxRankBoost({
    xp,
    tier,
    delta,
    span,
    usageText,
    stabilityDays,
    qualityScore,
    qualityLabel,
    explorationCount,
  });
  const activeSkin = getFoxRankActiveSkin({
    xp,
    tier,
    delta,
    span,
    usageText,
    stabilityDays,
    qualityScore,
    qualityLabel,
    explorationCount,
  });
  return {
    xp,
    tier: {
      ...tier,
      name: getFoxRankTierName(tier.index),
    },
    delta,
    span,
    usageText,
    stabilityDays,
    qualityScore,
    qualityLabel,
    explorationCount,
    progress,
    boost,
    activeSkin,
  };
}

function getFoxRankBadgeItems(snapshot) {
  return [
    { id: 'connection-keeper', name: foxRankText('badgeConnectionKeeper', 'Connection Keeper'), desc: formatFoxRankText('stableDays', { count: snapshot.stabilityDays }, `${snapshot.stabilityDays} stable days`), unlocked: snapshot.stabilityDays >= 1 },
    { id: 'long-run', name: foxRankText('badgeLongRun', 'Long Run'), desc: snapshot.usageText, unlocked: snapshot.xp >= 200 },
    { id: 'quality-eye', name: foxRankText('badgeQualityEye', 'Quality Eye'), desc: formatFoxRankText('qualityPctShort', { value: Math.round(snapshot.qualityScore * 100) }, `${Math.round(snapshot.qualityScore * 100)}% quality`), unlocked: snapshot.qualityScore >= 0.6 },
    { id: 'tier-climber', name: foxRankText('badgeTierClimber', 'Tier Climber'), desc: formatFoxRankText('reachedTier', { tier: snapshot.tier.name }, `${snapshot.tier.name} reached`), unlocked: snapshot.tier.index >= 2 },
    { id: 'route-scout', name: foxRankText('badgeRouteScout', 'Route Scout'), desc: formatFoxRankText('routeHops', { count: snapshot.explorationCount }, `${snapshot.explorationCount} route hops`), unlocked: snapshot.explorationCount >= 3 },
    { id: 'sky-bridge', name: foxRankText('badgeSkyBridge', 'Sky Bridge'), desc: foxRankText('badgeSkyBridgeDesc', '5 explorations this week'), unlocked: getFoxRankWeeklyReview(snapshot).exploreGain >= 5 },
    { id: 'pristine-loop', name: foxRankText('badgePristineLoop', 'Pristine Loop'), desc: foxRankText('badgePristineLoopDesc', 'Quality held above 85%'), unlocked: snapshot.qualityScore >= 0.85 },
    { id: 'skin-awakened', name: foxRankText('badgeSkinAwakened', 'Skin Awakened'), desc: formatFoxRankText('badgeSkinAwakenedDesc', { skin: snapshot.activeSkin.name }, `${snapshot.activeSkin.name} online`), unlocked: snapshot.tier.index >= 2 },
  ];
}

function getFoxRankLogItems(snapshot) {
  return [
    { label: foxRankText('rankXp', 'Rank XP'), value: `${snapshot.delta}/${snapshot.span} XP` },
    { label: foxRankText('stability', 'Stability'), value: formatFoxRankText('stableDays', { count: snapshot.stabilityDays }, `${snapshot.stabilityDays} stable days`) },
    { label: foxRankText('network', 'Network'), value: formatFoxRankText('qualityPct', { label: snapshot.qualityLabel, value: Math.round(snapshot.qualityScore * 100) }, `${snapshot.qualityLabel} • ${Math.round(snapshot.qualityScore * 100)}%`) },
    { label: foxRankText('usage', 'Usage'), value: snapshot.usageText },
    { label: foxRankText('explore', 'Explore'), value: formatFoxRankText('nodeHops', { count: snapshot.explorationCount }, `${snapshot.explorationCount} node hops`) },
    { label: foxRankText('boost', 'Boost'), value: snapshot.boost.label },
  ];
}

function syncFoxRankUnlockedBadges(snapshot) {
  if (!state.foxRank) {
    return;
  }
  const unlockedBefore = new Set(Array.isArray(state.foxRank.unlockedBadges) ? state.foxRank.unlockedBadges : []);
  const freshUnlocked = [];
  getFoxRankBadgeItems(snapshot).forEach((badge) => {
    if (badge.unlocked && !unlockedBefore.has(badge.id)) {
      unlockedBefore.add(badge.id);
      freshUnlocked.push(badge.id);
      if (!state.foxRank.badgeUnlockMoments || typeof state.foxRank.badgeUnlockMoments !== 'object') {
        state.foxRank.badgeUnlockMoments = {};
      }
      state.foxRank.badgeUnlockMoments[badge.id] = getTodayKey();
    }
  });
  state.foxRank.unlockedBadges = Array.from(unlockedBefore);
  state.foxRank.freshUnlockedBadges = freshUnlocked;
}

function buildFoxRankSummaryText(snapshot = null) {
  const data = snapshot || getFoxRankSnapshot();
  return [
    formatFoxRankText('summaryHeadline', { title: foxRankText('title', 'Fox Rank'), tier: data.tier.name, level: data.tier.index + 1 }, `Fox Rank ${data.tier.name} (Lv. ${data.tier.index + 1})`),
    `XP: ${data.delta} / ${data.span}`,
    `${foxRankText('usage', 'Usage')}: ${data.usageText}`,
    `${foxRankText('stability', 'Stability')}: ${data.stabilityDays}d`,
    `${foxRankText('quality', 'Quality')}: ${formatFoxRankText('qualityPct', { label: data.qualityLabel, value: Math.round(data.qualityScore * 100) }, `${data.qualityLabel} • ${Math.round(data.qualityScore * 100)}%`)}`,
    `${foxRankText('explore', 'Explore')}: ${formatFoxRankText('hops', { count: data.explorationCount }, `${data.explorationCount} hops`)}`,
    `${data.boost.label} • ${data.activeSkin.name}`,
    foxRankText('shareFrom', 'Shared from ClashFox'),
  ].join('\n');
}

async function copyFoxRankSummary(snapshot = null) {
  const text = buildFoxRankSummaryText(snapshot);
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(text);
    } else {
      const input = document.createElement('textarea');
      input.value = text;
      input.setAttribute('readonly', 'true');
      input.style.position = 'absolute';
      input.style.left = '-9999px';
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
    }
    showToast(foxRankText('summaryCopied', 'Fox Rank summary copied'), 'info');
  } catch {
    showToast(foxRankText('copyFailed', 'Copy failed'), 'error');
  }
}

function exportFoxRankCardPng(snapshot = null) {
  const data = snapshot || getFoxRankSnapshot();
  const canvas = document.createElement('canvas');
  canvas.width = 980;
  canvas.height = 560;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    showToast(foxRankText('exportFailed', 'Export failed'), 'error');
    return;
  }

  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, '#1c2836');
  gradient.addColorStop(1, '#101722');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#ffffff';
  ctx.font = '700 54px Trebuchet MS';
  ctx.fillText(`ClashFox • ${foxRankText('title', 'Fox Rank')}`, 64, 104);
  ctx.font = '700 82px Trebuchet MS';
  ctx.fillStyle = '#8ac1ff';
  ctx.fillText(data.tier.name, 64, 210);
  ctx.font = '700 40px Trebuchet MS';
  ctx.fillStyle = '#f5f9ff';
  ctx.fillText(formatFoxRankText('levelPrefix', { level: data.tier.index + 1 }, `Lv. ${data.tier.index + 1}`), 760, 104);
  ctx.font = '600 32px Trebuchet MS';
  ctx.fillStyle = '#d9e6f4';
  ctx.fillText(`XP ${data.delta} / ${data.span}`, 64, 278);
  ctx.fillText(`${foxRankText('usage', 'Usage')} ${data.usageText}`, 64, 340);
  ctx.fillText(`${foxRankText('stability', 'Stability')} ${data.stabilityDays}d`, 64, 394);
  ctx.fillText(`${foxRankText('quality', 'Quality')} ${formatFoxRankText('qualityPct', { label: data.qualityLabel, value: Math.round(data.qualityScore * 100) }, `${data.qualityLabel} • ${Math.round(data.qualityScore * 100)}%`)}`, 64, 448);
  ctx.fillText(`${foxRankText('explore', 'Explore')} ${formatFoxRankText('hops', { count: data.explorationCount }, `${data.explorationCount} hops`)}`, 64, 502);
  ctx.fillText(`${data.boost.label} • ${data.activeSkin.name}`, 480, 278);
  ctx.fillText(`${foxRankText('weeklyReview', 'Weekly Review')} +${getFoxRankWeeklyReview(data).xpGain} XP`, 480, 340);
  ctx.fillText(formatFoxRankText('activeSkinShort', { skin: foxRankText('skin', 'Skin'), name: data.activeSkin.name }, `Skin: ${data.activeSkin.name}`), 480, 394);

  const anchor = document.createElement('a');
  anchor.href = canvas.toDataURL('image/png');
  anchor.download = `clashfox-fox-rank-lv${data.tier.index + 1}.png`;
  anchor.click();
  showToast(foxRankText('pngExported', 'Fox Rank PNG exported'), 'info');
}

async function runFoxRankActionWithButton(button, idleLabel, busyLabel, action) {
  if (!button || typeof action !== 'function') {
    return;
  }
  const originalLabel = String(idleLabel || button.textContent || '').trim();
  button.disabled = true;
  button.textContent = busyLabel;
  try {
    await action();
  } finally {
    button.disabled = false;
    button.textContent = originalLabel;
  }
}

function renderFoxRankBriefModal(snapshot = null) {
  if (!foxRankBriefModal || !state.foxRank) {
    return;
  }
  const data = snapshot || getFoxRankSnapshot();
  const baseline = state.foxRank.quickReportBaseline || {
    xp: data.xp,
    stableDays: data.stabilityDays,
    qualityScore: data.qualityScore,
    explorationCount: data.explorationCount,
  };
  const xpDelta = Math.max(0, data.xp - (Number(baseline.xp) || 0));
  const stableDelta = Math.max(0, data.stabilityDays - (Number(baseline.stableDays) || 0));
  const qualityDelta = Math.round((data.qualityScore - (Number(baseline.qualityScore) || 0)) * 100);
  const exploreDelta = Math.max(0, data.explorationCount - (Number(baseline.explorationCount) || 0));
  if (foxRankBriefTitle) {
    setNodeTextIfChanged(foxRankBriefTitle, xpDelta > 0 ? foxRankText('campfireUpdated', 'Campfire report updated') : foxRankText('syncedToday', 'Fox Rank synced for today'));
  }
  if (foxRankBriefSummary) {
    setNodeTextIfChanged(
      foxRankBriefSummary,
      formatFoxRankText('syncedSummary', {
        tier: data.tier.name,
        level: data.tier.index + 1,
        hint: data.progress >= 0.8 ? foxRankText('ascensionOpen', 'Ascension window is open.') : foxRankText('momentumBuilding', 'Momentum is building.'),
      }, `${data.tier.name} is at Lv. ${data.tier.index + 1}. ${data.progress >= 0.8 ? 'Ascension window is open.' : 'Momentum is building.'}`),
    );
  }
  if (foxRankBriefMetrics) {
    foxRankBriefMetrics.innerHTML = [
      `<div class="fox-rank-brief-metric"><span>${escapeLogCell(foxRankText('dailyXp', 'XP'))}</span><strong>+${xpDelta}</strong></div>`,
      `<div class="fox-rank-brief-metric"><span>${escapeLogCell(foxRankText('dailyStability', 'Stability'))}</span><strong>+${stableDelta}d</strong></div>`,
      `<div class="fox-rank-brief-metric"><span>${escapeLogCell(foxRankText('dailyQuality', 'Quality'))}</span><strong>${qualityDelta >= 0 ? '+' : ''}${qualityDelta}%</strong></div>`,
      `<div class="fox-rank-brief-metric"><span>${escapeLogCell(foxRankText('dailyExplore', 'Explore'))}</span><strong>+${exploreDelta}</strong></div>`,
    ].join('');
  }
  if (foxRankBriefBoost) {
    setNodeTextIfChanged(foxRankBriefBoost, formatFoxRankText('briefBoost', { label: data.boost.label, desc: data.boost.description }, `${data.boost.label} • ${data.boost.description}`));
  }
}

function maybeOpenFoxRankBrief(snapshot = null) {
  if (!foxRankBriefModal || !state.foxRank) {
    return;
  }
  const today = getTodayKey();
  if (state.foxRank.lastQuickReportDay === today) {
    return;
  }
  const data = snapshot || getFoxRankSnapshot();
  renderFoxRankBriefModal(data);
  foxRankBriefModal.hidden = false;
  document.body.classList.add('fox-rank-brief-open');
  state.foxRank.lastQuickReportDay = today;
  state.foxRank.quickReportBaseline = {
    xp: data.xp,
    stableDays: data.stabilityDays,
    qualityScore: data.qualityScore,
    explorationCount: data.explorationCount,
  };
  saveFoxRankToStorage();
}

function closeFoxRankBriefModal() {
  if (!foxRankBriefModal) {
    return;
  }
  foxRankBriefModal.hidden = true;
  document.body.classList.remove('fox-rank-brief-open');
}

function setFoxRankDetailTab(tab = 'log') {
  foxRankActiveTab = tab === 'badges' || tab === 'skins' ? tab : 'log';
  const tabs = foxRankSectionTabs && foxRankSectionTabs.querySelectorAll
    ? Array.from(foxRankSectionTabs.querySelectorAll('[data-fox-rank-tab]'))
    : [];
  tabs.forEach((button) => {
    const isActive = button.dataset.foxRankTab === foxRankActiveTab;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });
  const panels = [foxRankTabPanelLog, foxRankTabPanelBadges, foxRankTabPanelSkins];
  panels.forEach((panel) => {
    if (!panel) return;
    const isActive = panel.dataset.foxRankPanel === foxRankActiveTab;
    panel.hidden = !isActive;
    panel.classList.toggle('active', isActive);
  });
}

function getAppLogFilePath() {
  const configuredDir = state && state.fileSettings && typeof state.fileSettings.logDir === 'string'
    ? String(state.fileSettings.logDir || '').trim()
    : '';
  const dir = configuredDir || '~/Library/Application Support/ClashFox/logs';
  return dir.endsWith('/') ? `${dir}clashfox.log` : `${dir}/clashfox.log`;
}

function renderFoxRankDetailPanel(snapshot = null) {
  if (!foxRankDetailModal || !state.foxRank) {
    return;
  }
  const data = snapshot || getFoxRankSnapshot();
  const weekly = getFoxRankWeeklyReview(data);
  if (foxRankDetailTier) {
    setNodeTextIfChanged(foxRankDetailTier, data.tier.name);
  }
  if (foxRankDetailSubtitle) {
    setNodeTextIfChanged(foxRankDetailSubtitle, formatFoxRankText('activeSkinDesc', { boost: data.boost.description, skin: data.activeSkin.name }, `${data.boost.description} Active skin: ${data.activeSkin.name}.`));
  }
  if (foxRankDetailLevel) {
    setNodeTextIfChanged(foxRankDetailLevel, formatFoxRankText('levelPrefix', { level: data.tier.index + 1 }, `Lv. ${data.tier.index + 1}`));
  }
  if (foxRankDetailXp) {
    setNodeTextIfChanged(foxRankDetailXp, `${data.delta} / ${data.span} XP`);
  }
  if (foxRankDetailUsage) {
    setNodeTextIfChanged(foxRankDetailUsage, data.usageText);
  }
  if (foxRankDetailStability) {
    setNodeTextIfChanged(foxRankDetailStability, `${data.stabilityDays}d`);
  }
  if (foxRankDetailQuality) {
    setNodeTextIfChanged(foxRankDetailQuality, formatFoxRankText('qualityPct', { label: data.qualityLabel, value: Math.round(data.qualityScore * 100) }, `${data.qualityLabel} • ${Math.round(data.qualityScore * 100)}%`));
  }
  if (foxRankDetailExplore) {
    setNodeTextIfChanged(foxRankDetailExplore, formatFoxRankText('hops', { count: data.explorationCount }, `${data.explorationCount} hops`));
  }
  if (foxRankDetailBoost) {
    setNodeTextIfChanged(foxRankDetailBoost, data.boost.label);
  }
  if (foxRankWeeklyCard) {
    foxRankWeeklyCard.innerHTML = [
      `<div class="fox-rank-weekly-metric"><span>${escapeLogCell(foxRankText('xpGained', 'XP gained'))}</span><strong>+${weekly.xpGain}</strong></div>`,
      `<div class="fox-rank-weekly-metric"><span>${escapeLogCell(foxRankText('weeklyStable', 'Stable days'))}</span><strong>+${weekly.stableGain}</strong></div>`,
      `<div class="fox-rank-weekly-metric"><span>${escapeLogCell(foxRankText('weeklyExplore', 'Explore hops'))}</span><strong>+${weekly.exploreGain}</strong></div>`,
      `<div class="fox-rank-weekly-metric"><span>${escapeLogCell(foxRankText('weeklyPeak', 'Peak quality'))}</span><strong>${Math.round(weekly.qualityPeak * 100)}%</strong></div>`,
      `<div class="fox-rank-weekly-note">${escapeLogCell(formatFoxRankText('unlockedThisWeek', { count: weekly.unlockedThisWeek, suffix: weekly.unlockedThisWeek === 1 ? '' : 's', skin: data.activeSkin.name }, `This week unlocked ${weekly.unlockedThisWeek} badge${weekly.unlockedThisWeek === 1 ? '' : 's'} and pushed ${data.activeSkin.name} forward.`))}</div>`,
    ].join('');
  }
  if (foxRankLogList) {
    foxRankLogList.innerHTML = getFoxRankLogItems(data)
      .map((item, index) => `<div class="fox-rank-log-item" style="animation-delay:${index * 60}ms"><span class="fox-rank-log-index">${index + 1}</span><div class="fox-rank-log-main"><strong>${escapeLogCell(item.label)}</strong><span>${escapeLogCell(item.value)}</span></div></div>`)
      .join('');
  }
  if (foxRankBadgeList) {
    const freshSet = new Set(state.foxRank && Array.isArray(state.foxRank.freshUnlockedBadges)
      ? state.foxRank.freshUnlockedBadges
      : []);
    foxRankBadgeList.innerHTML = getFoxRankBadgeItems(data)
      .map((item, index) => {
        const status = item.unlocked ? foxRankText('unlocked', 'Unlocked') : foxRankText('locked', 'Locked');
        const classNames = `fox-rank-badge-item ${item.unlocked ? 'is-unlocked' : 'is-locked'}${freshSet.has(item.id) ? ' unlocked-fresh' : ''}`;
        return `<div class="${classNames}" style="animation-delay:${index * 70}ms"><div class="fox-rank-badge-main"><strong>${escapeLogCell(item.name)}</strong><span>${escapeLogCell(item.desc)}</span></div><em class="fox-rank-badge-status">${escapeLogCell(status)}</em></div>`;
      })
      .join('');
  }
  if (foxRankSkinList) {
    foxRankSkinList.innerHTML = getFoxRankSkinItems(data)
      .map((item, index) => {
        const status = item.active
          ? foxRankText('equipped', 'Equipped')
          : item.unlocked
            ? foxRankText('unlocked', 'Unlocked')
            : formatFoxRankText('levelPrefix', { level: item.unlockTier + 1 }, `Lv. ${item.unlockTier + 1}`);
        const className = `fox-rank-skin-item ${item.unlocked ? 'is-unlocked' : 'is-locked'}${item.active ? ' is-active' : ''}`;
        return `<div class="${className}" style="animation-delay:${index * 50}ms"><strong>${escapeLogCell(item.name)}</strong><span>${escapeLogCell(item.desc)}</span><em>${escapeLogCell(status)}</em></div>`;
      })
      .join('');
  }
  if (foxRankSharePreview) {
    foxRankSharePreview.innerHTML = `<div class="fox-rank-share-head"><strong>${escapeLogCell(data.tier.name)}</strong><span>${escapeLogCell(formatFoxRankText('levelPrefix', { level: data.tier.index + 1 }, `Lv. ${data.tier.index + 1}`))}</span></div><div class="fox-rank-share-lines"><span>${escapeLogCell(data.boost.label)}</span><span>${escapeLogCell(formatFoxRankText('qualityShare', { label: data.qualityLabel, value: Math.round(data.qualityScore * 100) }, `${data.qualityLabel} • ${Math.round(data.qualityScore * 100)}% quality`))}</span><span>${escapeLogCell(formatFoxRankText('exploreSkinShare', { explore: formatFoxRankText('routeHops', { count: data.explorationCount }, `${data.explorationCount} explorations`), skin: data.activeSkin.name }, `${data.explorationCount} explorations • ${data.activeSkin.name}`))}</span></div>`;
  }
  setFoxRankDetailTab(foxRankActiveTab);
  renderFoxRankBriefModal(data);
}

function openFoxRankDetailModal() {
  if (!foxRankDetailModal) {
    return;
  }
  renderFoxRankDetailPanel();
  foxRankDetailModal.hidden = false;
  document.body.classList.add('fox-rank-detail-open');
  if (state.foxRank && Array.isArray(state.foxRank.freshUnlockedBadges) && state.foxRank.freshUnlockedBadges.length) {
    setTimeout(() => {
      if (!state.foxRank) {
        return;
      }
      state.foxRank.freshUnlockedBadges = [];
      renderFoxRankDetailPanel();
      saveFoxRankToStorage();
    }, 900);
  }
}

function closeFoxRankDetailModal() {
  if (!foxRankDetailModal) {
    return;
  }
  foxRankDetailModal.hidden = true;
  document.body.classList.remove('fox-rank-detail-open');
}

function updateFoxRankFromOverviewSnapshot(data) {
  if (!data || !state.foxRank) {
    return;
  }
  const running = Boolean(data.running);
  const uptime = Number.parseFloat(data.uptimeSec);
  const nowMs = Date.now();
  const nowSec = nowMs / 1000;
  if (running && Number.isFinite(uptime) && uptime >= 0) {
    const lastBase = state.foxRank.lastUsageBaseSec || 0;
    const lastTick = state.foxRank.lastUsageTickSec || 0;
    const delta = uptime - lastBase;
    if (!lastBase || delta <= 0) {
      state.foxRank.lastUsageBaseSec = uptime;
    } else {
      // Prevent double-counting on refresh/reconnect by capping to elapsed wall time.
      const wallDelta = Math.max(0, nowSec - lastTick);
      const safeDelta = Math.min(delta, wallDelta + 2);
      if (safeDelta > 0) {
        state.foxRank.totalUsageSec += safeDelta;
      }
      state.foxRank.lastUsageBaseSec = uptime;
    }
    state.foxRank.lastUsageTickSec = nowSec;
    if (uptime >= 300) {
      const today = getTodayKey();
      if (state.foxRank.lastStableDay !== today) {
        state.foxRank.stableDays = Math.min(365, (state.foxRank.stableDays || 0) + 1);
        state.foxRank.lastStableDay = today;
      }
    }
  } else {
    state.foxRank.lastUsageBaseSec = 0;
    state.foxRank.lastUsageTickSec = 0;
  }
  const proxyFingerprint = String(data.proxyIp || data.internetIp4 || data.internetIp || '').trim();
  if (running && proxyFingerprint) {
    if (!state.foxRank.lastExplorationFingerprint) {
      state.foxRank.lastExplorationFingerprint = proxyFingerprint;
    } else if (
      state.foxRank.lastExplorationFingerprint !== proxyFingerprint
      && (nowMs - Number(state.foxRank.lastExplorationAt || 0) >= FOX_RANK_EXPLORATION_COOLDOWN_MS)
    ) {
      state.foxRank.explorationCount = Math.min(9999, (state.foxRank.explorationCount || 0) + 1);
      state.foxRank.lastExplorationFingerprint = proxyFingerprint;
      state.foxRank.lastExplorationAt = nowMs;
      showToast(`Exploration +12 XP • ${formatFoxRankText('hops', { count: state.foxRank.explorationCount }, `${state.foxRank.explorationCount} hops`)}`, 'info');
    }
  }
  state.foxRank.qualityScore = computeFoxRankQualityScore(data);
  const snapshot = getFoxRankSnapshot();
  syncFoxRankUnlockedBadges(snapshot);
  recordFoxRankHistory(snapshot);
  saveFoxRankToStorage();
  renderFoxRankPanel(snapshot);
}

function renderFoxRankPanel(snapshot = null, options = {}) {
  if (!foxRankPanel || !state.foxRank) {
    return;
  }
  const suppressBrief = Boolean(options && options.suppressBrief);
  const data = snapshot || getFoxRankSnapshot();
  const { tier, delta, span } = data;
  if (foxRankTierName) {
    setNodeTextIfChanged(foxRankTierName, tier.name);
    foxRankTierName.style.color = tier.colorStart || '#ffd86a';
  }
  if (foxRankLevelText) {
    setNodeTextIfChanged(foxRankLevelText, `Lv. ${tier.index + 1}`);
  }
  if (foxRankProgressText) {
    setNodeTextIfChanged(foxRankProgressText, `${delta} / ${span} XP`);
  }
  if (foxRankProgressFill) {
    foxRankProgressFill.style.width = `${Math.round(data.progress * 100)}%`;
    foxRankProgressFill.style.background = `linear-gradient(135deg, ${tier.colorStart}, ${tier.colorEnd})`;
  }
  if (foxRankUsageValue) {
    setNodeTextIfChanged(foxRankUsageValue, data.usageText);
    syncStaticTooltip(foxRankUsageValue, data.usageText, { position: 'bottom', tipKey: 'fox-rank-usage' });
  }
  if (foxRankStabilityValue) {
    const stabilityText = `${data.stabilityDays}d`;
    setNodeTextIfChanged(foxRankStabilityValue, stabilityText);
    syncStaticTooltip(foxRankStabilityValue, stabilityText, { tipKey: 'fox-rank-stability' });
  }
  if (foxRankQualityValue) {
    const qualityText = `${data.qualityLabel} • ${Math.round(data.qualityScore * 100)}%`;
    setNodeTextIfChanged(foxRankQualityValue, qualityText);
    syncStaticTooltip(foxRankQualityValue, qualityText, { position: 'left', tipKey: 'fox-rank-quality' });
  }
  if (foxRankBoostHint) {
    setNodeTextIfChanged(foxRankBoostHint, data.boost.label);
  }
  if (foxRankWarningChip) {
    const shouldWarn = data.progress >= 0.8;
    foxRankWarningChip.hidden = !shouldWarn;
    setNodeTextIfChanged(foxRankWarningChip, shouldWarn ? foxRankText('ascendSoon', 'Ascend soon') : '');
  }
  if (foxRankExploreCount) {
    setNodeTextIfChanged(foxRankExploreCount, String(data.explorationCount));
  }
  if (foxRankSkinHint) {
    setNodeTextIfChanged(foxRankSkinHint, formatFoxRankText('activeSkinShort', { skin: foxRankText('skin', 'Skin'), name: data.activeSkin.name }, `Skin: ${data.activeSkin.name}`));
  }
  if (foxRankCard) {
    foxRankCard.classList.toggle('is-ascend-near', data.progress >= 0.8);
    foxRankCard.style.setProperty('--fox-rank-aura-start', tier.colorStart);
    foxRankCard.style.setProperty('--fox-rank-aura-end', tier.colorEnd);
  }
  renderFoxRankDetailPanel(data);
  if (!suppressBrief) {
    maybeOpenFoxRankBrief(data);
  }
}

async function loadStatusSilently() {
  // Do not bind status detection to selected config file validity.
  // Status should reflect actual kernel process state.
  const response = await runCommand('status');
  if (!response.ok) {
    const fallbackOk = probeKernelRunningFromLocalGuard();
    if (fallbackOk) {
      return {
        ok: true,
        data: { running: state.coreRunning },
        fallback: 'local-guard',
      };
    }
    return response;
  }
  updateStatusUI(response.data);
  if (currentPage === 'overview' || currentPage === 'kernel') {
    await syncKernelVersionFromMihomo().catch(() => {});
  }
  loadTunStatus(false);
  return response;
}

function probeKernelRunningFromLocalGuard() {
  const now = Date.now();
  const recentCoreRunning = Boolean(state.coreRunning) && (now - Number(state.coreRunningUpdatedAt || 0) <= 15000);
  if (recentCoreRunning) {
    applyKernelRunningState(true, 'local-guard');
    return true;
  }
  const recentOverviewRunning = Boolean(state.overviewRunning) && (now - Number(state.overviewRunningUpdatedAt || 0) <= 15000);
  if (recentOverviewRunning) {
    applyKernelRunningState(true, 'local-guard');
    return true;
  }
  return false;
}

async function loadStatus() {
  guiLog('status', 'loadStatus started');
  const response = await loadStatusSilently();
  if (!response.ok) {
    const msg = response.error === 'bridge_missing' ? t('labels.bridgeMissing') : (response.error || ti('labels.statusError', 'Status error'));
    guiLog('status', 'loadStatus failed', {
      error: response.error || 'unknown_error',
    }, 'warn');
    showToast(msg, 'error');
    return;
  }
  guiLog('status', 'loadStatus completed', {
    running: Boolean(state.coreRunning),
    source: response && response.data && response.data.source ? response.data.source : '',
  });
}

async function waitForKernelState(expectedRunning, timeoutMs = 12000, intervalMs = 350) {
  const expected = Boolean(expectedRunning);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() <= deadline) {
    await loadStatusSilently();
    if (Boolean(state.coreRunning) === expected) {
      return true;
    }
    await sleep(intervalMs);
  }
  return Boolean(state.coreRunning) === expected;
}

async function applyTunSettingsAfterStart() {
  const enabled = Boolean(state.settings && state.settings.tun);
  const stack = normalizeTunStack(state.settings && state.settings.stack);
  const response = await updateTunViaController({ enable: enabled, stack });
  if (!response || !response.ok) {
    return response || { ok: false, error: 'tun_update_failed' };
  }
  const waitResult = await waitForTunState(enabled, 3000, 350);
  const statusResponse = waitResult && waitResult.status ? waitResult.status : await loadTunStatus(false);
  if (!waitResult || !waitResult.ok || !statusResponse || !statusResponse.ok || !statusResponse.data) {
    return { ok: false, error: (statusResponse && statusResponse.error) || 'tun_status_failed' };
  }
  return { ok: true, data: statusResponse.data };
}

async function loadOverview(showToastOnSuccess = false) {
  if (state.overviewLoading) {
    return false;
  }
  state.overviewLoading = true;
  guiLog('overview', 'loadOverview started', {
    showToastOnSuccess: Boolean(showToastOnSuccess),
  });
  try {
    const configPath = getCurrentConfigPath();
    const args = ['--cache-ttl', '1'];
    if (configPath) {
      args.push('--config', configPath);
    }
    args.push(...getControllerArgs());
    const [response, networkSnapshot] = await Promise.all([
      runCommand('overview', args),
      window.clashfox && typeof window.clashfox.getOverviewNetworkSnapshot === 'function'
        ? window.clashfox.getOverviewNetworkSnapshot()
        : Promise.resolve({ ok: false }),
    ]);
    if (!response.ok) {
      if (networkSnapshot && networkSnapshot.ok && networkSnapshot.data) {
        applyOverviewNetworkSnapshot(networkSnapshot.data);
      }
      guiLog('overview', 'loadOverview failed', {
        error: response.error || 'unknown_error',
      }, 'warn');
      if (showToastOnSuccess) {
        showToast(response.error || ti('labels.overviewError', 'Overview error'), 'error');
      }
      return false;
    }
    const mergedOverviewData = networkSnapshot && networkSnapshot.ok && networkSnapshot.data
      ? { ...(response.data || {}), ...networkSnapshot.data }
      : response.data;
    updateOverviewUI(mergedOverviewData);
    guiLog('overview', 'loadOverview completed', {
      mode: mergedOverviewData && mergedOverviewData.mode ? mergedOverviewData.mode : '',
      mixedPort: mergedOverviewData && mergedOverviewData.mixedPort ? mergedOverviewData.mixedPort : '',
      running: mergedOverviewData && Object.prototype.hasOwnProperty.call(mergedOverviewData, 'running')
        ? Boolean(mergedOverviewData.running)
        : Boolean(state.coreRunning),
    });
    if (showToastOnSuccess) {
      showToast(t('labels.statusRefreshed'));
    }
    return true;
  } catch {
    guiLog('overview', 'loadOverview threw', null, 'error');
    if (showToastOnSuccess) {
      showToast(ti('labels.overviewError', 'Overview error'), 'error');
    }
    return false;
  } finally {
    state.overviewLoading = false;
  }
}

async function loadTunStatus(showToastOnSuccess = false) {
  if (!tunToggle && !tunStackSelect) {
    return null;
  }
  const configPath = getCurrentConfigPath();
  const args = configPath ? ['--config', configPath] : [];
  const response = await runCommand('tun-status', args);
  if (!response.ok || !response.data) {
    const statusResp = await runCommand('status');
    const running = statusResp && statusResp.ok && statusResp.data && statusResp.data.running;
    if (!running) {
      if (tunToggle) tunToggle.checked = false;
      saveSettings({ tun: false });
      tunSynced = true;
      return { ok: true, data: { enabled: false }, error: response.error };
    }
    const fetched = await fetchTunFromController();
    if (fetched && typeof fetched.enabled === 'boolean') {
      if (tunToggle) tunToggle.checked = fetched.enabled;
      const fetchedStack = normalizeTunStack(fetched.stack);
      if (tunStackSelect) tunStackSelect.value = fetchedStack;
      saveSettings({
        tun: fetched.enabled,
        stack: fetchedStack,
      });
      tunSynced = true;
      return { ok: true, data: { enabled: fetched.enabled, stack: fetchedStack }, error: response.error };
    }
    return response;
  }
  if (tunToggle && typeof response.data.enabled === 'boolean') {
    tunToggle.checked = response.data.enabled;
    if (state.settings.tun !== response.data.enabled) {
      saveSettings({ tun: response.data.enabled });
    }
  }
  if (tunStackSelect && typeof response.data.stack === 'string') {
    const stack = normalizeTunStack(response.data.stack);
    tunStackSelect.value = stack;
    if (state.settings.stack !== stack) {
      saveSettings({ stack });
    }
  }
  if (showToastOnSuccess) {
    showToast(t('labels.tunRefreshed'));
  }
  tunSynced = true;
  return response;
}

async function waitForTunState(targetEnabled, timeoutMs = 3000, intervalMs = 350) {
  const expected = Boolean(targetEnabled);
  const deadline = Date.now() + Math.max(500, Number(timeoutMs) || 3000);
  let lastStatus = null;
  while (Date.now() <= deadline) {
    const statusResponse = await loadTunStatus(false);
    lastStatus = statusResponse;
    if (statusResponse && statusResponse.ok && statusResponse.data
      && typeof statusResponse.data.enabled === 'boolean') {
      const actual = Boolean(statusResponse.data.enabled);
      if (actual === expected) {
        return { ok: true, status: statusResponse };
      }
      if (expected && actual === false) {
        return { ok: false, error: 'tun_enable_not_effective', status: statusResponse };
      }
    }
    await sleep(Math.max(120, Number(intervalMs) || 350));
  }
  return { ok: false, error: 'tun_status_timeout', status: lastStatus };
}

function formatTunUpdateError(response, statusResponse, fallbackLabel) {
  if (response && response.ok && response.data && response.data.mismatched === true) {
    return ti('labels.tunConflictHint', 'TUN conflict detected. Turn off TUN mode in other proxy apps, then try again.');
  }
  const mergedError = (response && response.error) || (statusResponse && statusResponse.error) || '';
  if (mergedError === 'controller_missing') {
    return t('labels.controllerMissing');
  }
  const details = (response && response.details)
    || (statusResponse && statusResponse.details)
    || '';
  if (mergedError === 'request_failed' && details) {
    return `request_failed: ${String(details).slice(0, 220)}`;
  }
  return mergedError || fallbackLabel;
}

async function loadTraffic() {
  if (state.mihomoTrafficLive) {
    return;
  }
  if (state.trafficLoading) {
    return;
  }
  state.trafficLoading = true;
  const configPath = getCurrentConfigPath();
  const args = configPath ? ['--config', configPath] : [];
  args.push(...getControllerArgs());
  try {
    const response = await runCommand('traffic', args);
    if (!response.ok || !response.data) {
      // Keep last successful values to avoid flicker when endpoint is temporarily unavailable.
      return;
    }
    const downRaw = response.data.down ?? response.data.download ?? response.data.rx ?? '';
    const upRaw = response.data.up ?? response.data.upload ?? response.data.tx ?? '';
    const down = Number.parseFloat(downRaw);
    const up = Number.parseFloat(upRaw);
    if (!Number.isFinite(down) || !Number.isFinite(up)) {
      return;
    }
    updateProxyTraffic(down, up);
  } finally {
    state.trafficLoading = false;
  }
}

async function loadProviderSubscriptionOverview() {
  if (!overviewProviderSubscriptionSummary || !overviewProviderSubscriptionList) {
    return;
  }
  if (state.providerSubscriptionLoading) {
    return;
  }
  state.providerSubscriptionLoading = true;
  guiLog('provider-traffic', 'load started');
  try {
    const response = await fetchProviderSubscriptionOverview();
    if (!response || !response.ok || !response.data) {
      guiLog('provider-traffic', 'load failed', {
        error: response && response.error ? response.error : 'provider_subscription_overview_failed',
        cacheHit: Boolean(readOverviewProviderSubscriptionCache()),
      }, 'warn');
      if (readOverviewProviderSubscriptionCache()) {
        hydrateOverviewProviderSubscriptionFromCache();
      } else if (!state.providerSubscriptionRenderSignature) {
        renderProviderSubscriptionOverview({ items: [], summary: { providerCount: 0 } });
      }
      return;
    }
    cacheOverviewProviderSubscription(response.data);
    renderProviderSubscriptionOverview(response.data);
    guiLog('provider-traffic', 'load completed', {
      providerCount: response.data && response.data.summary
        ? Number(response.data.summary.providerCount || 0)
        : 0,
      itemCount: Array.isArray(response.data && response.data.items) ? response.data.items.length : 0,
    });
  } catch {
    guiLog('provider-traffic', 'load threw', {
      cacheHit: Boolean(readOverviewProviderSubscriptionCache()),
    }, 'error');
    if (readOverviewProviderSubscriptionCache()) {
      hydrateOverviewProviderSubscriptionFromCache();
    } else if (!state.providerSubscriptionRenderSignature) {
      renderProviderSubscriptionOverview({ items: [], summary: { providerCount: 0 } });
    }
  } finally {
    state.providerSubscriptionLoading = false;
  }
}


async function loadRulesOverviewCard() {
  if (!overviewRulesChart || !overviewRulesRecords) {
    return;
  }
  if (state.rulesOverviewLoading) {
    return;
  }
  state.rulesOverviewLoading = true;
  guiLog('rules-overview', 'load started');
  try {
    const { rules: rulesResp, providers: providerResp } = await fetchRulesOverviewBundle();
    const hasRules = Boolean(rulesResp && rulesResp.ok && rulesResp.data);
    const hasProviders = Boolean(providerResp && providerResp.ok && providerResp.data);
    if (!hasRules && !hasProviders) {
      guiLog('rules-overview', 'load failed', {
        rulesError: rulesResp && rulesResp.error ? rulesResp.error : '',
        providersError: providerResp && providerResp.error ? providerResp.error : '',
        cacheHit: Boolean(readOverviewRulesCardCache()),
      }, 'warn');
      if (readOverviewRulesCardCache()) {
        hydrateOverviewRulesCardFromCache();
        return;
      }
      if (
        state.rulesOverviewPayload
        || state.ruleProvidersOverviewPayload
        || state.rulesOverviewRenderSignatures.records
        || state.rulesOverviewRenderSignatures.chart
      ) {
        return;
      }
    }
    if (hasRules) {
      state.rulesOverviewPayload = rulesResp.data;
    } else if (!state.rulesOverviewPayload) {
      state.rulesOverviewPayload = { totalRules: 0, types: [], records: [] };
    }
    if (hasProviders) {
      state.ruleProvidersOverviewPayload = providerResp.data;
    } else if (!state.ruleProvidersOverviewPayload) {
      state.ruleProvidersOverviewPayload = { totalProviders: 0, totalRules: 0, behaviors: [], items: [], records: [] };
    }
    cacheOverviewRulesCard();
    renderRulesOverviewCard();
    guiLog('rules-overview', 'load completed', {
      totalRules: state.rulesOverviewPayload
        ? Number(state.rulesOverviewPayload.totalRules || 0)
        : 0,
      totalRuleProviders: state.ruleProvidersOverviewPayload
        ? Number(state.ruleProvidersOverviewPayload.totalProviders || 0)
        : 0,
      records: state.rulesOverviewPayload && Array.isArray(state.rulesOverviewPayload.records)
        ? state.rulesOverviewPayload.records.length
        : 0,
    });
  } catch {
    guiLog('rules-overview', 'load threw', {
      cacheHit: Boolean(readOverviewRulesCardCache()),
    }, 'error');
    if (readOverviewRulesCardCache()) {
      hydrateOverviewRulesCardFromCache();
    } else if (
      !state.rulesOverviewPayload
      && !state.ruleProvidersOverviewPayload
      && !state.rulesOverviewRenderSignatures.records
      && !state.rulesOverviewRenderSignatures.chart
    ) {
      state.rulesOverviewPayload = { totalRules: 0, types: [], records: [] };
      state.ruleProvidersOverviewPayload = { totalProviders: 0, totalRules: 0, behaviors: [], items: [], records: [] };
      renderRulesOverviewCard();
    }
  } finally {
    state.rulesOverviewLoading = false;
  }
}

async function loadOverviewMemory() {
  if (state.mihomoMemoryLive) {
    return false;
  }
  if (state.overviewMemoryLoading) {
    return false;
  }
  state.overviewMemoryLoading = true;
  try {
    const response = await runCommand('overview-memory');
    if (!response.ok) {
      return false;
    }
    if (response.data && overviewMemory) {
      overviewMemory.textContent = response.data.memory || '-';
    }
    return true;
  } catch {
    return false;
  } finally {
    state.overviewMemoryLoading = false;
  }
}

function paginate(items, page, pageSize) {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * pageSize;
  const end = start + pageSize;
  return {
    page: safePage,
    totalPages,
    items: items.slice(start, end),
  };
}

function estimateTableRowHeight(table, fallback = 42) {
  const rows = Array.from(table.querySelectorAll('tbody tr:not(.placeholder)'));
  for (const row of rows) {
    if (row.querySelector('.empty-cell')) {
      continue;
    }
    const measured = row.getBoundingClientRect().height;
    if (Number.isFinite(measured) && measured > 0) {
      return measured;
    }
  }
  const cell = table.querySelector('tbody td, thead th');
  if (!cell) {
    return fallback;
  }
  const computed = window.getComputedStyle(cell);
  const lineHeight = Number.parseFloat(computed.lineHeight) || 16;
  const paddingTop = Number.parseFloat(computed.paddingTop) || 0;
  const paddingBottom = Number.parseFloat(computed.paddingBottom) || 0;
  const borderTop = Number.parseFloat(computed.borderTopWidth) || 0;
  const borderBottom = Number.parseFloat(computed.borderBottomWidth) || 0;
  const estimated = lineHeight + paddingTop + paddingBottom + borderTop + borderBottom;
  return Number.isFinite(estimated) && estimated > 0 ? estimated : fallback;
}

function applyPagedTableMinHeight(hostEl, pageSize, totalItems = 0) {
  if (!hostEl) {
    return;
  }
  const table = hostEl.querySelector('table.app-table');
  if (!table) {
    hostEl.style.removeProperty('min-height');
    return;
  }
  const safePageSize = Math.max(1, Number.parseInt(String(pageSize || ''), 10) || 1);
  const safeTotalItems = Math.max(0, Number.parseInt(String(totalItems || ''), 10) || 0);
  if (safeTotalItems <= safePageSize) {
    hostEl.style.removeProperty('min-height');
    return;
  }
  const theadRow = table.querySelector('thead tr');
  const headerHeight = theadRow ? theadRow.getBoundingClientRect().height : 0;
  const rowHeight = estimateTableRowHeight(table, Number.parseFloat(hostEl.dataset.tableRowHeight) || 42);
  hostEl.dataset.tableRowHeight = String(rowHeight);
  const minHeight = Math.ceil(headerHeight + (rowHeight * safePageSize));
  hostEl.style.minHeight = `${minHeight}px`;
}

function renderBackups(targetEl, withRadio, pageInfo, pageSize, multiSelect) {
  const items = state.lastBackups;
  const pageData = paginate(items, pageInfo, pageSize);
  if (multiSelect) {
    const totalCount = state.lastBackups.length;
    const allChecked = totalCount > 0 && state.selectedBackupPaths.size === totalCount;
    const checkedAttr = allChecked ? 'checked' : '';
    let html = '<table class="app-table" aria-label="Backups">';
    html += '<thead><tr>';
    html += `<th class="check-col"><input type="checkbox" id="backupsHeaderSelect" ${checkedAttr} /></th>`;
    html += `<th class="version-col">${t('table.version')}</th>`;
    html += `<th class="time-col">${t('table.time')}</th>`;
    html += '</tr></thead><tbody>';

    pageData.items.forEach((item) => {
      const checked = state.selectedBackupPaths.has(item.path) ? 'checked' : '';
      // always mark backup rows selectable so hover effect applies
      const selectedClass = checked ? 'selected selectable' : 'selectable';
      html += `<tr class="${selectedClass}" data-path="${item.path}">`;
      html += `<td class="check-col"><input type="checkbox" data-path="${item.path}" ${checked} /></td>`;
      html += `<td class="version-col">${item.version || item.name}</td>`;
      const displayTime = formatBackupTimestamp(item.timestamp, item.timestamp || '-');
      html += `<td class="time-col">${displayTime}</td>`;
      html += '</tr>';
    });

    if (items.length === 0) {
      html += `<tr><td class="empty-cell" colspan="3">${t('labels.noBackups')}</td></tr>`;
    }
    html += '</tbody></table>';
    targetEl.innerHTML = html;
    applyPagedTableMinHeight(targetEl, pageSize, items.length);
    return pageData;
  }

  let headerClass = 'table-row header backup';
  let html = `<div class="${headerClass}">`;
  html += withRadio ? '<div></div>' : `<div class="index-head">${t('table.index')}</div>`;
  html += `<div class="version-head">${t('table.version')}</div><div class="time-head">${t('table.time')}</div></div>`;

  pageData.items.forEach((item) => {
    const rowClass = withRadio ? 'table-row backup selectable' : 'table-row backup';
    html += `<div class="${rowClass}" data-index="${item.index}">`;
    if (withRadio) {
      html += '<div class="pick-cell"><span class="pick-dot" aria-hidden="true"></span></div>';
    } else {
      html += `<div class="index-cell">${item.index}</div>`;
    }
    const displayTime = formatBackupTimestamp(item.timestamp, item.timestamp || '-');
    html += `<div class="version-cell">${item.version || item.name}</div><div class="time-cell">${displayTime}</div></div>`;
  });

  if (items.length === 0) {
    html += `<div class="table-row empty"><div class="empty-cell">${t('labels.noBackups')}</div></div>`;
  }

  targetEl.innerHTML = html;
  targetEl.style.removeProperty('min-height');
  return pageData;
}

function getCurrentConfigPath() {
  const candidates = [];
  if (configPathInput && typeof configPathInput.value === 'string') {
    candidates.push(configPathInput.value);
  }
  if (overviewConfigPath && typeof overviewConfigPath.value === 'string') {
    candidates.push(overviewConfigPath.value);
  }
  if (settingsConfigPath && typeof settingsConfigPath.value === 'string') {
    candidates.push(settingsConfigPath.value);
  }
  if (state.settings && typeof state.settings.configPath === 'string') {
    const selected = state.settings.configPath.trim();
    if (selected) {
      if (!state.configs || state.configs.length === 0) {
        candidates.push(selected);
      } else {
        const exists = state.configs.some((item) => item && item.path === selected);
        if (exists) {
          candidates.push(selected);
        }
      }
    }
  }
  const explicit = candidates.find((value) => value && value.trim());
  return (explicit || state.configDefault || '').trim();
}

function syncThemeSource(preference) {
  if (!window.clashfox || typeof window.clashfox.setThemeSource !== 'function') {
    return;
  }
  let source = 'system';
  if (preference === 'day') {
    source = 'light';
  } else if (preference === 'night') {
    source = 'dark';
  }
  window.clashfox.setThemeSource(source);
}

function sendDashboardTheme() {
  if (!dashboardFrame || !dashboardFrame.contentWindow) {
    return;
  }
  updateDashboardFrameSrc();
  const themeValue = state.theme === 'night' ? 'dark' : 'light';
  try {
    dashboardFrame.contentWindow.postMessage(
      { type: 'clashfox-theme', theme: themeValue },
      '*'
    );
  } catch {
    // ignore cross-origin errors
  }
}


function getControllerArgs() {
  const settings = state.settings || readSettings();
  const args = [];
  const controller = (settings.externalController || '').trim();
  const secret = (settings.secret || '').trim();
  if (controller) {
    args.push('--controller', controller);
  }
  if (secret) {
    args.push('--secret', secret);
  }
  return args;
}

function renderConfigTable() {
  if (!configTable || !configPageInfo || !configPrev || !configNext || !configPageSize) {
    return;
  }
  const items = state.configs || [];
  const size = Number.parseInt(
    state.configPageSizeLocal || configPageSize.value || getGeneralPageSizeValue(),
    10,
  ) || 10;
  const pageData = paginate(items, state.configPage, size);
  state.configPage = pageData.page;
  configPageInfo.textContent = `${pageData.page} / ${pageData.totalPages} · ${items.length}`;
  configPrev.disabled = pageData.page <= 1;
  configNext.disabled = pageData.page >= pageData.totalPages;
  const currentPath = getCurrentConfigPath();
  let html = '<table class="app-table config-table" aria-label="Configs">';
  html += '<thead><tr>';
  html += '<th class="check-col"></th>';
  html += `<th class="name-col">${t('table.name')}</th>`;
  // html += `<th class="path-col">${t('table.path')}</th>`;
  html += `<th class="modified-col">${t('table.modified')}</th>`;
  html += `<th class="action-col">${t('table.action') || 'Action'}</th>`;
  // html += `<th class="current-col">${t('table.current')}</th>`;
  html += '</tr></thead><tbody>';
  pageData.items.forEach((item) => {
    const isCurrent = currentPath && item.path === currentPath;
    const rowClass = isCurrent ? 'selectable selected' : 'selectable';
    html += `<tr class="${rowClass}" data-path="${item.path || ''}">`;
    html += `<td class="check-col"><input type="radio" name="configCurrent" data-path="${item.path || ''}" ${isCurrent ? 'checked' : ''} /></td>`;
    html += `<td class="name-col">${item.name || '-'} ${isCurrent ? `<span class="tag current">${t('labels.current')}</span>` : ''}</td>`;
    // html += `<td class="path-col">${item.path || '-'}</td>`;
    html += `<td class="modified-col">${item.modified || '-'}</td>`;
    html += '<td class="action-col">';
    if (!isCurrent) {
      html += `<button class="icon-btn ghost small table-icon-btn list-action-icon-btn config-delete-btn danger-action-btn" type="button" data-action="delete-config" data-path="${item.path || ''}" data-name="${item.name || ''}" data-tip-key="actions.delete" data-tip="${ti('actions.delete', 'Delete')}" data-position="top" data-native-title="false" aria-label="${ti('actions.delete', 'Delete')}"><svg viewBox="0 0 24 24" role="presentation" focusable="false"><path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm1 6h2v9h-2V9Zm4 0h2v9h-2V9ZM7 9h2v9H7V9Z"></path></svg></button>`;
    } else {
      html += '-';
    }
    html += '</td>';
    // html += `<td class="current-col">${isCurrent ? t('labels.current') : '-'}</td>`;
    html += '</tr>';
  });
  if (items.length === 0) {
    html += `<tr><td class="empty-cell" colspan="4">${t('labels.configsEmpty')}</td></tr>`;
  }
  html += '</tbody></table>';
  configTable.innerHTML = html;
  applyPagedTableMinHeight(configTable, size, items.length);
}

function renderKernelTable() {
  if (!kernelTable || !kernelPageSize || !kernelPageInfo || !kernelPrev || !kernelNext) {
    return;
  }
  const currentKernelHeading = kernelCurrentTable?.closest('.card')?.querySelector('h3');
  if (currentKernelHeading) {
    currentKernelHeading.classList.add('iconized', 'current-kernel-icon');
    currentKernelHeading.style.setProperty('--card-icon-mask', 'var(--icon-current)');
  }
  const items = state.kernels || [];
  const backupItems = [];
  let currentItem = null;
  const backupRe = /^mihomo\.backup\.(mihomo-darwin-(amd64|arm64)-.+)\.([0-9]{8}_[0-9]{6})$/;

  items.forEach((item) => {
    const name = item && item.name ? item.name : '';
    const isBackup = backupRe.test(name);
    if (isBackup) {
      backupItems.push(item);
      return;
    }
    const isCurrentCandidate = name === 'mihomo' || name.startsWith('mihomo-darwin-');
    if (!isCurrentCandidate) {
      return;
    }
    // Prefer the active kernel symlink/binary name for "Current" display.
    if (!currentItem || (currentItem.name !== 'mihomo' && name === 'mihomo')) {
      currentItem = item;
    }
  });

  const pageSizeRaw = state.kernelPageSizeLocal
    || (kernelPageSize && kernelPageSize.value)
    || getGeneralPageSizeValue();
  const size = Number.parseInt(pageSizeRaw, 10) || 10;
  const pageData = paginate(backupItems, state.kernelsPage, size);
  state.kernelsPage = pageData.page;
  kernelPageInfo.textContent = `${pageData.page} / ${pageData.totalPages} · ${backupItems.length}`;
  kernelPrev.disabled = pageData.page <= 1;
  kernelNext.disabled = pageData.page >= pageData.totalPages;

  const currentName = currentItem && currentItem.name ? currentItem.name : '-';
  let currentDisplayName = currentName === '-' ? '-' : currentName;
  if (currentName === 'mihomo' && state.coreVersionRaw) {
    const versionShort = formatKernelDisplay(state.coreVersionRaw);
    if (versionShort && versionShort !== '-') {
      currentDisplayName = `mihomo (${versionShort})`;
    }
  }
  const currentTimestamp = currentItem && currentItem.modified ? currentItem.modified : '-';
  if (kernelCurrentTable) {
    let currentHtml = '<div class="kernel-current-card">';
    currentHtml += '<div class="kernel-current-meta">';
    currentHtml += `<div class="kernel-current-title">${t('labels.current')} ${t('status.kernel')}</div>`;
    currentHtml += `<div class="kernel-current-time-label">${ti('table.installTime', t('table.time'))}</div>`;
    currentHtml += '</div>';
    currentHtml += '<div class="kernel-current-main">';
    currentHtml += `<div class="version-cell"><span class="kernel-name">${currentDisplayName}</span> <span class="tag-group"><span class="tag current">${t('labels.current')}</span></span></div>`;
    currentHtml += `<div class="time-cell">${currentTimestamp}</div>`;
    currentHtml += '</div>';
    currentHtml += '</div>';
    kernelCurrentTable.innerHTML = currentHtml;
  }

  let html = '<table class="app-table kernel-table" aria-label="Kernel List">';
  html += '<thead><tr>';
  html += `<th class="index-col">${t('table.index')}</th>`;
  html += `<th class="version-col">${t('table.version')}</th>`;
  html += `<th class="time-col">${t('table.time')}</th>`;
  html += `<th class="action-col">${ti('table.action', 'Action')}</th>`;
  html += '</tr></thead><tbody>';

  const pageOffset = ((pageData.page || 1) - 1) * size;
  pageData.items.forEach((item, idx) => {
    const name = item && item.name ? item.name : '-';
    const backupMatch = backupRe.exec(name);
    const isBackup = Boolean(backupMatch);
    const displayName = backupMatch ? backupMatch[1] : name;
    const timestamp = backupMatch
      ? formatBackupTimestamp(backupMatch[3], item.modified || '-')
      : (item.modified || '-');
    const tags = [];
    if (isBackup) {
      tags.push(`<span class="tag backup">${t('labels.backup')}</span>`);
    }
    let backupPath = item && item.path ? item.path : '';
    if (!backupPath && Array.isArray(state.lastBackups) && state.lastBackups.length) {
      const matchedBackup = state.lastBackups.find((backupItem) => {
        if (!backupItem || !backupItem.path) {
          return false;
        }
        if (backupItem.name === name) {
          return true;
        }
        if (backupItem.version && backupItem.version === displayName) {
          return true;
        }
        return false;
      });
      if (matchedBackup) {
        backupPath = matchedBackup.path;
      }
    }
    const backupName = displayName || name || '-';
    const backupPathAttr = backupPath ? ` data-delete-path="${backupPath}"` : '';
    const backupNameAttr = backupName ? ` data-delete-name="${backupName}"` : '';
    const deleteDisabledAttr = backupPath ? '' : ' disabled';
    html += '<tr class="selectable">';
    html += `<td class="index-col">${pageOffset + idx + 1}</td>`;
    html += `<td class="version-col"><span class="kernel-name">${displayName || '-'}</span>${tags.length ? ` <span class="tag-group">${tags.join('')}</span>` : ''}</td>`;
    html += `<td class="time-col">${timestamp}</td>`;
    html += '<td class="action-col"><div class="kernel-action-group">';
    html += `<button class="icon-btn ghost small table-icon-btn list-action-icon-btn kernel-switch-action" data-switch-index="${pageOffset + idx + 1}" data-tip-key="confirm.switchConfirm" data-tip="${ti('confirm.switchConfirm', 'Switch')}" data-position="top" data-native-title="false" aria-label="${ti('confirm.switchConfirm', 'Switch')}"><svg viewBox="0 0 24 24" role="presentation" focusable="false"><path d="M4 7h8V4l6 5-6 5v-3H4V7Zm16 10h-8v3l-6-5 6-5v3h8v4Z"></path></svg></button>`;
    html += `<button class="icon-btn ghost small table-icon-btn list-action-icon-btn kernel-delete-action danger-action-btn"${backupPathAttr}${backupNameAttr}${deleteDisabledAttr} data-tip-key="actions.delete" data-tip="${ti('actions.delete', 'Delete')}" data-position="top" data-native-title="false" aria-label="${ti('actions.delete', 'Delete')}"><svg viewBox="0 0 24 24" role="presentation" focusable="false"><path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm1 6h2v9h-2V9Zm4 0h2v9h-2V9ZM7 9h2v9H7V9Z"></path></svg></button>`;
    html += '</div></td></tr>';
  });

  if (backupItems.length === 0) {
    html += `<tr><td class="empty-cell" colspan="4">${t('labels.noBackups')}</td></tr>`;
  }

  html += '</tbody></table>';
  kernelTable.innerHTML = html;
  applyPagedTableMinHeight(kernelTable, size, backupItems.length);
}

async function switchKernelByIndex(index) {
  const safeIndex = Number.parseInt(String(index || ''), 10);
  if (!Number.isFinite(safeIndex) || safeIndex <= 0) {
    showToast(t('labels.selectBackup'), 'error');
    return;
  }
  const confirmed = await promptConfirm({
    title: t('confirm.switchTitle'),
    body: t('confirm.switchBody'),
    confirmLabel: t('confirm.switchConfirm'),
    confirmTone: 'primary',
  });
  if (!confirmed) {
    return;
  }
  const response = await runCommand('switch', ['--index', String(safeIndex)]);
  if (response.ok) {
    showToast(t('labels.switchNeedsRestart'));
    loadStatus();
    loadKernels();
    loadBackups();
  } else {
    showToast(response.error || ti('labels.switchFailed', 'Switch failed'), 'error');
  }
}

async function deleteKernelBackupByPath(targetPath, backupName = '') {
  const pathValue = String(targetPath || '').trim();
  if (!pathValue) {
    showToast(ti('labels.deleteFailed', 'Delete failed'), 'error');
    return;
  }
  const confirmed = await promptConfirm({
    title: t('confirm.deleteTitle'),
    body: backupName ? `${t('confirm.deleteBody')}\n${backupName}` : t('confirm.deleteBody'),
    confirmLabel: t('confirm.deleteConfirm'),
    confirmTone: 'danger',
  });
  if (!confirmed) {
    return;
  }
  const response = await runCommandWithSudo('delete-backups', ['--path', pathValue]);
  if (response.ok) {
    showToast(t('labels.deleteSuccess'));
    await Promise.all([
      loadKernels(),
      loadBackups(),
    ]);
  } else {
    showToast(response.error || ti('labels.deleteFailed', 'Delete failed'), 'error');
  }
}

async function loadConfigs(showToastOnSuccess = false) {
  guiLog('config', 'loadConfigs start', { showToastOnSuccess });
  const response = await runCommand('configs');
  if (!response.ok) {
    guiLog('config', 'loadConfigs failed', response, 'warn');
    showToast(response.error || ti('labels.configsError', 'Configs error'), 'error');
    return;
  }
  state.configs = response.data || [];
  guiLog('config', 'loadConfigs success', { count: state.configs.length });
  renderConfigTable();
  if (showToastOnSuccess) {
    showToast(t('labels.configsRefreshed'));
  }
}

async function loadKernels() {
  if (!kernelTable) {
    return;
  }
  const response = await runCommand('cores');
  if (!response.ok) {
    renderKernelTable();
    return;
  }
  state.kernels = response.data || [];
  renderKernelTable();
}

async function loadBackups(showToastOnSuccess = false) {
  const response = await runCommand('backups');
  if (!response.ok) {
    showToast(response.error || ti('labels.backupsError', 'Backups error'), 'error');
    return;
  }
  state.lastBackups = response.data;
  state.switchPage = 1;
  state.backupsPage = 1;
  state.selectedBackupPaths.clear();
  renderSwitchTable();
  renderBackupsTable();
  if (showToastOnSuccess) {
    showToast(t('labels.backupsRefreshed'));
  }
}

function renderSwitchTable() {
  if (!backupTable || !switchPageInfo || !switchPrev || !switchNext) {
    return;
  }
  const pageSizeRaw = state.switchPageSizeLocal
    || (switchPageSize && switchPageSize.value)
    || state.settings.generalPageSize
    || '10';
  const size = Number.parseInt(pageSizeRaw, 10) || 10;
  const pageData = renderBackups(backupTable, true, state.switchPage, size, false);
  state.switchPage = pageData.page;
  switchPageInfo.textContent = `${pageData.page} / ${pageData.totalPages} · ${state.lastBackups.length}`;
  switchPrev.disabled = pageData.page <= 1;
  switchNext.disabled = pageData.page >= pageData.totalPages;
}

function renderBackupsTable() {
  if (!backupTableFull || !backupsPageInfo || !backupsPrev || !backupsNext) {
    return;
  }
  const pageSizeRaw = state.backupsPageSizeLocal
    || (backupsPageSize && backupsPageSize.value)
    || state.settings.generalPageSize
    || '10';
  const size = Number.parseInt(pageSizeRaw, 10) || 10;
  const pageData = renderBackups(backupTableFull, false, state.backupsPage, size, true);
  state.backupsPage = pageData.page;
  backupsPageInfo.textContent = `${pageData.page} / ${pageData.totalPages} · ${state.lastBackups.length}`;
  backupsPrev.disabled = pageData.page <= 1;
  backupsNext.disabled = pageData.page >= pageData.totalPages;
}

function renderRecommendTable() {
  if (!recommendTableBody || !recommendPageSize || !recommendPageInfo || !recommendPrev || !recommendNext) {
    return;
  }
  const size = Number.parseInt(
    state.recommendPageSizeLocal || recommendPageSize.value || getGeneralPageSizeValue(),
    10,
  ) || 10;
  const pageData = paginate(RECOMMENDED_CONFIGS, state.recommendPage, size);
  state.recommendPage = pageData.page;
  recommendPageInfo.textContent = `${pageData.page} / ${pageData.totalPages} · ${RECOMMENDED_CONFIGS.length}`;
  recommendPrev.disabled = pageData.page <= 1;
  recommendNext.disabled = pageData.page >= pageData.totalPages;

  const startIndex = (pageData.page - 1) * size;
  let html = '';
  pageData.items.forEach((item, index) => {
    const githubLabel = (item.github || '').replace(/^https?:\/\//, '');
    html += '<tr class="selectable">';
    html += `<td class="index-col">${startIndex + index + 1}</td>`;
    html += `<td class="name-col">${item.name || '-'}</td>`;
    html += '<td class="github-col">';
    html += `<a class="recommend-link" href="${item.github}" target="_blank" rel="noopener noreferrer">${githubLabel || '-'}</a>`;
    html += '</td>';
    html += `<td class="dir-col">${item.dir || '-'}</td>`;
    html += `<td class="rating-col">${item.rating || '-'}</td>`;
    html += '</tr>';
  });
  if (pageData.items.length === 0) {
    html = `<tr><td class="empty-cell" colspan="5">${t('labels.configsEmpty')}</td></tr>`;
  }
  recommendTableBody.innerHTML = html;
  const recommendTableWrap = recommendTableBody.closest('.table');
  applyPagedTableMinHeight(recommendTableWrap, size, RECOMMENDED_CONFIGS.length);
}

async function loadLogs() {
  if (!logTableBody && !logContent) {
    return;
  }
  if (!Array.isArray(state.logEntries)) {
    state.logEntries = [];
  }
  connectMihomoPageLogsStream();
  renderLogTable();
  if (logContent) {
    logContent.textContent = state.logEntries.map((entry) => `[${entry.level}] ${entry.msg}`).join('\n');
  }
}

function setLogAutoRefresh(enabled) {
  if (state.logTimer) {
    clearInterval(state.logTimer);
    state.logTimer = null;
  }
  void enabled;
  if (currentPage === 'logs') {
    connectMihomoPageLogsStream();
  } else {
    closeMihomoPageLogsSocket();
  }
}

function getIntervalMs() {
  const sourcePreset = (logIntervalPreset && logIntervalPreset.value)
    || (state.settings && state.settings.logIntervalPreset)
    || '3';
  const presetValue = Number.parseInt(String(sourcePreset), 10);
  const clamped = Math.min(Math.max(presetValue || 3, 1), 60);
  return clamped * 1000;
}

function updateInterval() {
  state.logIntervalMs = getIntervalMs();
}

function normalizeLogLevel(level = '') {
  const raw = String(level || '').trim().toUpperCase();
  if (!raw) return 'INFO';
  if (raw === 'WARNING') return 'WARN';
  if (raw === 'ERR') return 'ERROR';
  return raw;
}

function formatLogDate(value = '') {
  const text = String(value || '').trim();
  if (!text || text === '-') {
    return '-';
  }
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    const yyyy = parsed.getFullYear();
    const mm = String(parsed.getMonth() + 1).padStart(2, '0');
    const dd = String(parsed.getDate()).padStart(2, '0');
    const hh = String(parsed.getHours()).padStart(2, '0');
    const mi = String(parsed.getMinutes()).padStart(2, '0');
    const ss = String(parsed.getSeconds()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
  }
  const normalized = text.replace('T', ' ').replace(/Z$/i, '');
  const match = normalized.match(
    /^(\d{4}[-/]\d{2}[-/]\d{2})\s+(\d{2}:\d{2}:\d{2})(?:\.\d+)?(?:\s*[+\-]\d{2}:?\d{2})?$/,
  );
  if (match) {
    return `${match[1].replace(/\//g, '-')} ${match[2]}`;
  }
  return normalized.replace(/\.\d+(?=\s*[+\-]\d{2}:?\d{2}$|$)/, '');
}

function parseLogLine(line = '') {
  const source = String(line || '').trim();
  if (!source) {
    return null;
  }
  const raw = source.replace(/\x1b\[[0-9;]*m/g, '').trim();
  let date = '-';
  let level = 'INFO';
  let msg = raw;

  const readLogfmtValue = (text = '', key = '') => {
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const quoted = text.match(new RegExp(`(?:^|\\s)${escapedKey}=\"((?:\\\\.|[^\"])*)\"`));
    if (quoted) {
      return String(quoted[1] || '').replace(/\\"/g, '"').replace(/\\\\/g, '\\').trim();
    }
    const plain = text.match(new RegExp(`(?:^|\\s)${escapedKey}=([^\\s]+)`));
    if (plain) {
      return String(plain[1] || '').trim();
    }
    return '';
  };

  // e.g. time="2026-03-07T12:00:00.123+08:00" level=info msg="..."
  const hasLogfmtTokens = /\b(?:time|timestamp|ts|date)=/.test(raw) && /\blevel=/.test(raw);
  if (hasLogfmtTokens) {
    const tokenDate = readLogfmtValue(raw, 'time')
      || readLogfmtValue(raw, 'timestamp')
      || readLogfmtValue(raw, 'ts')
      || readLogfmtValue(raw, 'date');
    const tokenLevel = readLogfmtValue(raw, 'level');
    const tokenMsg = readLogfmtValue(raw, 'msg') || readLogfmtValue(raw, 'message');
    if (tokenDate) {
      date = tokenDate;
    }
    if (tokenLevel) {
      level = normalizeLogLevel(tokenLevel);
    }
    if (tokenMsg) {
      msg = tokenMsg;
    } else {
      msg = raw
        .replace(/(?:^|\s)(?:time|timestamp|ts|date)=(?:"(?:\\.|[^"])*"|[^\s]+)/g, ' ')
        .replace(/(?:^|\s)level=(?:"(?:\\.|[^"])*"|[^\s]+)/g, ' ')
        .replace(/(?:^|\s)(?:msg|message)=(?:"(?:\\.|[^"])*"|[^\s]+)/g, ' ')
        .trim() || '-';
    }
    return { date: formatLogDate(date), level, msg };
  }

  const fullMatch = raw.match(/^(\d{4}[-/]\d{2}[-/]\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+\-]\d{2}:?\d{2})?)\s+\[?([A-Za-z]+)\]?\s*(.*)$/);
  if (fullMatch) {
    date = fullMatch[1];
    level = normalizeLogLevel(fullMatch[2]);
    msg = String(fullMatch[3] || '').trim() || '-';
    return { date: formatLogDate(date), level, msg };
  }

  const timeLevelMatch = raw.match(/^(\d{2}:\d{2}:\d{2}(?:\.\d+)?)\s+\[?([A-Za-z]+)\]?\s*(.*)$/);
  if (timeLevelMatch) {
    date = timeLevelMatch[1];
    level = normalizeLogLevel(timeLevelMatch[2]);
    msg = String(timeLevelMatch[3] || '').trim() || '-';
    return { date: formatLogDate(date), level, msg };
  }

  const levelTokenMatch = raw.match(/\b(DEBUG|INFO|WARN|WARNING|ERROR|FATAL|TRACE)\b/i);
  if (levelTokenMatch) {
    level = normalizeLogLevel(levelTokenMatch[1]);
    msg = raw.replace(levelTokenMatch[0], '').trim() || raw;
  }
  return { date: formatLogDate(date), level, msg };
}

function escapeLogCell(value = '') {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderLogTable() {
  if (!logTableBody) {
    return;
  }
  const levelFilter = String((logLevelFilter && logLevelFilter.value) || 'info').toLowerCase();
  const keyword = String((logMessageFilter && logMessageFilter.value) || '').trim().toLowerCase();
  const rows = (Array.isArray(state.logEntries) ? state.logEntries : []).filter((entry) => {
    const entryLevel = String(entry.level || '').toLowerCase();
    if (entryLevel !== levelFilter) {
      return false;
    }
    if (!keyword) {
      return true;
    }
    return String(entry.msg || '').toLowerCase().includes(keyword);
  });
  if (!rows.length) {
    logTableBody.innerHTML = `<tr><td class="empty-cell" colspan="3">${escapeLogCell(ti('logs.noMatching', 'No matching logs.'))}</td></tr>`;
    return;
  }
  logTableBody.innerHTML = rows.map((entry) => {
    const levelClass = `log-level-${String(entry.level || '').toLowerCase()}`;
    return `<tr>
      <td class="log-date-col">${escapeLogCell(entry.date)}</td>
      <td class="log-level-col"><span class="log-level-badge ${levelClass}">${escapeLogCell(entry.level)}</span></td>
      <td class="log-msg-col">${escapeLogCell(entry.msg)}</td>
    </tr>`;
  }).join('');
}

function getSelectedBackupIndex() {
  if (!backupTable) {
    return null;
  }
  const selectedRow = backupTable.querySelector('.table-row.selectable.selected');
  return selectedRow ? selectedRow.dataset.index : null;
}

function mountFoxRankDetailModalToBody() {
  const modalNodes = Array.from(document.querySelectorAll('#foxRankDetailModal'));
  if (!modalNodes.length) {
    foxRankDetailModal = null;
    return;
  }
  const modal = modalNodes[modalNodes.length - 1];
  modalNodes.slice(0, -1).forEach((node) => {
    if (node && node !== modal && node.parentNode) {
      node.parentNode.removeChild(node);
    }
  });
  if (modal.parentElement !== document.body) {
    document.body.appendChild(modal);
  }
  foxRankDetailModal = modal;
}

function mountFoxRankBriefModalToBody() {
  const modalNodes = Array.from(document.querySelectorAll('#foxRankBriefModal'));
  if (!modalNodes.length) {
    foxRankBriefModal = null;
    return;
  }
  const modal = modalNodes[modalNodes.length - 1];
  modalNodes.slice(0, -1).forEach((node) => {
    if (node && node !== modal && node.parentNode) {
      node.parentNode.removeChild(node);
    }
  });
  if (modal.parentElement !== document.body) {
    document.body.appendChild(modal);
  }
  foxRankBriefModal = modal;
}

function refreshLayoutRefs() {
  navButtons = Array.from(document.querySelectorAll('.nav-btn'));
  topNavMore = document.getElementById('topNavMore');
  topNavMoreBtn = document.getElementById('topNavMoreBtn');
  topNavMoreMenu = document.getElementById('topNavMoreMenu');
  navScroll = document.getElementById('navScroll');
  primaryNav = document.getElementById('primaryNav');
  appShell = document.querySelector('.app');
  menuContainer = document.getElementById('menuContainer');
  sidebarFoxDividerHost = document.getElementById('sidebarFoxDividerHost');
  sidebarCollapseToggle = document.getElementById('sidebarCollapseToggle');
  appName = document.getElementById('appName');
  appVersion = document.getElementById('appVersion');
  themeToggle = document.getElementById('themeToggle');
  refreshStatusBtn = document.getElementById('refreshStatus');
  statusPill = document.getElementById('statusPill');
  foxRankPanel = document.getElementById('foxRankPanel');
  foxRankCard = document.getElementById('foxRankCard');
  foxRankTierName = document.getElementById('foxRankTierName');
  foxRankLevelText = document.getElementById('foxRankLevelText');
  foxRankProgressFill = document.getElementById('foxRankProgressFill');
  foxRankProgressText = document.getElementById('foxRankProgressText');
  foxRankUsageValue = document.getElementById('foxRankUsageValue');
  foxRankStabilityValue = document.getElementById('foxRankStabilityValue');
  foxRankQualityValue = document.getElementById('foxRankQualityValue');
  foxRankBoostHint = document.getElementById('foxRankBoostHint');
  foxRankWarningChip = document.getElementById('foxRankWarningChip');
  foxRankExploreCount = document.getElementById('foxRankExploreCount');
  foxRankSkinHint = document.getElementById('foxRankSkinHint');
  mountFoxRankDetailModalToBody();
  mountFoxRankBriefModalToBody();
  foxRankDetailClose = document.getElementById('foxRankDetailClose');
  foxRankDetailTier = document.getElementById('foxRankDetailTier');
  foxRankDetailSubtitle = document.getElementById('foxRankDetailSubtitle');
  foxRankDetailLevel = document.getElementById('foxRankDetailLevel');
  foxRankDetailXp = document.getElementById('foxRankDetailXp');
  foxRankDetailUsage = document.getElementById('foxRankDetailUsage');
  foxRankDetailStability = document.getElementById('foxRankDetailStability');
  foxRankDetailQuality = document.getElementById('foxRankDetailQuality');
  foxRankDetailExplore = document.getElementById('foxRankDetailExplore');
  foxRankDetailBoost = document.getElementById('foxRankDetailBoost');
  foxRankWeeklyCard = document.getElementById('foxRankWeeklyCard');
  foxRankSectionTabs = document.getElementById('foxRankSectionTabs');
  foxRankTabLog = document.getElementById('foxRankTabLog');
  foxRankTabBadges = document.getElementById('foxRankTabBadges');
  foxRankTabSkins = document.getElementById('foxRankTabSkins');
  foxRankTabPanelLog = document.getElementById('foxRankTabPanelLog');
  foxRankTabPanelBadges = document.getElementById('foxRankTabPanelBadges');
  foxRankTabPanelSkins = document.getElementById('foxRankTabPanelSkins');
  foxRankLogList = document.getElementById('foxRankLogList');
  foxRankBadgeList = document.getElementById('foxRankBadgeList');
  foxRankSkinList = document.getElementById('foxRankSkinList');
  foxRankSharePreview = document.getElementById('foxRankSharePreview');
  foxRankCopySummaryBtn = document.getElementById('foxRankCopySummaryBtn');
  foxRankExportPngBtn = document.getElementById('foxRankExportPngBtn');
  foxRankBriefTitle = document.getElementById('foxRankBriefTitle');
  foxRankBriefSummary = document.getElementById('foxRankBriefSummary');
  foxRankBriefMetrics = document.getElementById('foxRankBriefMetrics');
  foxRankBriefBoost = document.getElementById('foxRankBriefBoost');
  foxRankBriefClose = document.getElementById('foxRankBriefClose');
  foxRankBriefOpenDetail = document.getElementById('foxRankBriefOpenDetail');
  ensureSidebarFoxDivider();
}

function setTopNavOverflowItemVisible(action = '', visible = false) {
  if (!topNavMoreMenu) {
    return;
  }
  const key = String(action || '').trim();
  if (!key) {
    return;
  }
  const item = topNavMoreMenu.querySelector(`[data-overflow-item="${key}"]`);
  if (!item) {
    return;
  }
  item.style.display = visible ? '' : 'none';
}

function isTopNavMode() {
  return window.matchMedia && window.matchMedia('(max-width: 980px)').matches;
}

function insertAfterNode(referenceNode, node) {
  if (!referenceNode || !referenceNode.parentNode || !node) {
    return;
  }
  referenceNode.parentNode.insertBefore(node, referenceNode.nextSibling);
}

function syncTopNavMenuLayout() {
  if (!primaryNav || !topNavMoreMenu) {
    return;
  }
  const bottomNav = document.querySelector('.nav.nav-bottom');
  const logsBtn = primaryNav.querySelector('.nav-btn[data-page="logs"]');
  const settingsMainBtn = document.getElementById('navSettingsMain');
  const helpMainBtn = document.getElementById('navHelpMain');
  const settingsOverflowBtn = document.getElementById('navSettingsOverflow');
  const helpOverflowBtn = document.getElementById('navHelpOverflow');
  const trayButtons = [
    document.getElementById('navDashboard'),
    document.getElementById('navTrackers'),
    document.getElementById('navFoxboard'),
  ].filter(Boolean);

  if (isTopNavMode()) {
    const trayAnchor = trayButtons.find((btn) => btn.parentElement === primaryNav) || null;
    if (settingsMainBtn && settingsMainBtn.parentElement !== primaryNav) {
      if (trayAnchor) primaryNav.insertBefore(settingsMainBtn, trayAnchor);
      else primaryNav.appendChild(settingsMainBtn);
    }
    if (helpMainBtn && helpMainBtn.parentElement !== primaryNav) {
      if (trayAnchor) primaryNav.insertBefore(helpMainBtn, trayAnchor);
      else primaryNav.appendChild(helpMainBtn);
    }
    trayButtons.forEach((btn) => {
      if (btn.parentElement !== topNavMoreMenu) {
        topNavMoreMenu.appendChild(btn);
      }
      btn.classList.add('top-nav-more-item');
    });
    if (settingsOverflowBtn) settingsOverflowBtn.style.display = 'none';
    if (helpOverflowBtn) helpOverflowBtn.style.display = 'none';
    return;
  }

  if (bottomNav) {
    if (settingsMainBtn && settingsMainBtn.parentElement !== bottomNav) {
      bottomNav.appendChild(settingsMainBtn);
    }
    if (helpMainBtn && helpMainBtn.parentElement !== bottomNav) {
      bottomNav.appendChild(helpMainBtn);
    }
  }
  let insertRef = logsBtn;
  trayButtons.forEach((btn) => {
    if (!insertRef || !primaryNav.contains(insertRef)) {
      if (btn.parentElement !== primaryNav) {
        primaryNav.appendChild(btn);
      }
    } else if (btn.parentElement !== primaryNav || btn.previousElementSibling !== insertRef) {
      if (btn.parentElement !== primaryNav) {
        insertAfterNode(insertRef, btn);
      } else {
        primaryNav.insertBefore(btn, insertRef.nextSibling);
      }
    }
    btn.classList.remove('top-nav-more-item');
    if (primaryNav.contains(btn)) {
      insertRef = btn;
    }
  });
  if (settingsOverflowBtn) settingsOverflowBtn.style.display = '';
  if (helpOverflowBtn) helpOverflowBtn.style.display = '';
}

function syncTopNavOverflow() {
  if (!primaryNav) {
    return;
  }
  const overflowButtons = Array.from(primaryNav.querySelectorAll('.nav-btn[data-overflow-candidate="true"]'));
  overflowButtons.forEach((btn) => {
    btn.classList.remove('nav-overflow-hidden');
    setTopNavOverflowItemVisible(btn.dataset.trayAction || '', false);
  });
  if (!isTopNavMode() || !navScroll) {
    if (topNavMore) {
      topNavMore.classList.remove('show');
    }
    return;
  }

  const available = Math.max(0, navScroll.clientWidth - 4);
  let required = primaryNav.scrollWidth;
  if (required <= available) {
    return;
  }

  const orderedCandidates = overflowButtons.slice().reverse();
  orderedCandidates.forEach((btn) => {
    if (required <= available) {
      return;
    }
    btn.classList.add('nav-overflow-hidden');
    setTopNavOverflowItemVisible(btn.dataset.trayAction || '', true);
    required = primaryNav.scrollWidth;
  });
}

function requestTopNavOverflowSync() {
  if (topNavOverflowRaf) {
    cancelAnimationFrame(topNavOverflowRaf);
  }
  topNavOverflowRaf = requestAnimationFrame(() => {
    topNavOverflowRaf = null;
    syncTopNavMenuLayout();
    syncTopNavOverflow();
  });
}

function bindTopNavMore() {
  if (!topNavMore || !topNavMoreBtn || !topNavMoreMenu) {
    return;
  }
  if (topNavMoreBtn.dataset.bound !== 'true') {
    topNavMoreBtn.dataset.bound = 'true';
    topNavMoreBtn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      topNavMore.classList.toggle('show');
    });
  }
  if (topNavMoreMenu.dataset.bound !== 'true') {
    topNavMoreMenu.dataset.bound = 'true';
    topNavMoreMenu.addEventListener('click', () => {
      topNavMore.classList.remove('show');
    });
  }
  if (document.body && document.body.dataset.topNavMoreBound !== 'true') {
    document.body.dataset.topNavMoreBound = 'true';
    document.addEventListener('click', (event) => {
      if (!topNavMore || !topNavMore.classList.contains('show')) {
        return;
      }
      const target = event.target;
      if (target && topNavMore.contains(target)) {
        return;
      }
      topNavMore.classList.remove('show');
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && topNavMore) {
        topNavMore.classList.remove('show');
      }
    });
  }
  requestTopNavOverflowSync();
}

function refreshPageRefs() {
  panels = Array.from(document.querySelectorAll('.panel'));
  noticePop = document.getElementById('noticePop');
  noticePopBody = document.getElementById('noticePopBody');
  noticePopClose = document.getElementById('noticePopClose');
  noticePopTitle = document.getElementById('noticePopTitle');
  contentRoot = document.getElementById('contentRoot');

  const menuItemsTitle = document.querySelector('.menu-items-title');
  if (menuItemsTitle) {
    if (!menuItemsTitle.classList.contains('iconized')) {
      menuItemsTitle.classList.add('iconized');
    }
    menuItemsTitle.style.setProperty('--card-icon-mask', 'var(--icon-list)');
  }

  statusRunning = document.getElementById('statusRunning');
  statusVersion = document.getElementById('statusVersion');
  statusKernelPath = document.getElementById('statusKernelPath');
  statusConfig = document.getElementById('statusConfig');
  statusKernelPathRow = document.getElementById('statusKernelPathRow');
  statusConfigRow = document.getElementById('statusConfigRow');
  statusPill = document.getElementById('statusPill');
  overviewUptime = document.getElementById('overviewUptime');
  overviewConnections = document.getElementById('overviewConnections');
  overviewMemory = document.getElementById('overviewMemory');
  overviewStatus = document.getElementById('overviewStatus');
  overviewKernel = document.getElementById('overviewKernel');
  overviewKernelCopy = document.getElementById('overviewKernelCopy');
  overviewSystem = document.getElementById('overviewSystem');
  overviewVersion = document.getElementById('overviewVersion');
  overviewInternet = document.getElementById('overviewInternet');
  overviewDns = document.getElementById('overviewDns');
  overviewRouter = document.getElementById('overviewRouter');
  overviewNetwork = document.getElementById('overviewNetwork');
  overviewLocalIp = document.getElementById('overviewLocalIp');
  overviewProxyIp = document.getElementById('overviewProxyIp');
  overviewInternetIp = document.getElementById('overviewInternetIp');
  overviewLocalIpCopy = document.getElementById('overviewLocalIpCopy');
  overviewProxyIpCopy = document.getElementById('overviewProxyIpCopy');
  overviewInternetIpCopy = document.getElementById('overviewInternetIpCopy');
  overviewConnCurrent = document.getElementById('overviewConnCurrent');
  overviewConnPeak = document.getElementById('overviewConnPeak');
  overviewConnAvg = document.getElementById('overviewConnAvg');
  overviewConnTrend = document.getElementById('overviewConnTrend');
  overviewConnLine = document.getElementById('overviewConnLine');
  overviewConnArea = document.getElementById('overviewConnArea');
  overviewProviderSubscriptionSummary = document.getElementById('overviewProviderSubscriptionSummary');
  overviewProviderSubscriptionList = document.getElementById('overviewProviderSubscriptionList');
  overviewRulesSwitch = document.getElementById('overviewRulesSwitch');
  overviewRulesMetrics = document.getElementById('overviewRulesMetrics');
  overviewRulesBehaviors = document.getElementById('overviewRulesBehaviors');
  overviewRulesChart = document.getElementById('overviewRulesChart');
  overviewRulesRecords = document.getElementById('overviewRulesRecords');
  overviewTopologyStage = document.getElementById('overviewTopologyStage');
  overviewTopologySurface = document.getElementById('overviewTopologySurface');
  overviewTopologySvg = document.getElementById('overviewTopologySvg');
  overviewTopologyColumns = document.getElementById('overviewTopologyColumns');
  overviewTopologyEmpty = document.getElementById('overviewTopologyEmpty');
  overviewTopologyZoomBtn = document.getElementById('overviewTopologyZoomBtn');
  overviewSummaryConnections = document.getElementById('overviewSummaryConnections');
  overviewSummaryMemory = document.getElementById('overviewSummaryMemory');
  overviewSummaryDownloadTotal = document.getElementById('overviewSummaryDownloadTotal');
  overviewSummaryDownloadRate = document.getElementById('overviewSummaryDownloadRate');
  overviewSummaryUploadTotal = document.getElementById('overviewSummaryUploadTotal');
  overviewSummaryUploadRate = document.getElementById('overviewSummaryUploadRate');
  topologyZoomModal = document.getElementById('topologyZoomModal');
  topologyZoomClose = document.getElementById('topologyZoomClose');
  topologyZoomStage = document.getElementById('topologyZoomStage');
  topologyZoomSurface = document.getElementById('topologyZoomSurface');
  topologyZoomSvg = document.getElementById('topologyZoomSvg');
  topologyZoomColumns = document.getElementById('topologyZoomColumns');
  topologyZoomEmpty = document.getElementById('topologyZoomEmpty');
  bindTopologyZoomModal();
  overviewGrids = Array.from(document.querySelectorAll('.overview-drag-grid'));
  trafficSystemDownloadRate = document.getElementById('trafficSystemDownloadRate');
  trafficSystemDownloadTotal = document.getElementById('trafficSystemDownloadTotal');
  trafficSystemUploadRate = document.getElementById('trafficSystemUploadRate');
  trafficSystemUploadTotal = document.getElementById('trafficSystemUploadTotal');
  trafficTotalDownload = document.getElementById('trafficTotalDownload');
  trafficTotalUpload = document.getElementById('trafficTotalUpload');
  trafficUploadLine = document.getElementById('trafficUploadLine');
  trafficUploadArea = document.getElementById('trafficUploadArea');
  trafficDownloadLine = document.getElementById('trafficDownloadLine');
  trafficDownloadArea = document.getElementById('trafficDownloadArea');
  trafficUploadAxis = [
    document.getElementById('trafficUploadAxis4'),
    document.getElementById('trafficUploadAxis3'),
    document.getElementById('trafficUploadAxis2'),
    document.getElementById('trafficUploadAxis1'),
  ].filter(Boolean);
  trafficDownloadAxis = [
    document.getElementById('trafficDownloadAxis4'),
    document.getElementById('trafficDownloadAxis3'),
    document.getElementById('trafficDownloadAxis2'),
    document.getElementById('trafficDownloadAxis1'),
  ].filter(Boolean);
  quickHintNodes = [];
  overviewNetworkRefresh = document.getElementById('overviewNetworkRefresh');

  githubUser = document.getElementById('githubUser');
  installBtn = document.getElementById('installBtn');
  installStatus = document.getElementById('installStatus');
  installCurrentKernel = document.getElementById('installCurrentKernel');
  installProgress = document.getElementById('installProgress');
  installVersionRow = document.getElementById('installVersionRow');
  installVersion = document.getElementById('installVersion');
  cancelInstallBtn = document.getElementById('cancelInstallBtn');
  configPathInput = document.getElementById('configPath');
  overviewConfigPath = document.getElementById('overviewConfigPath');
  overviewBrowseConfig = document.getElementById('overviewBrowseConfig');
  overviewConfigReset = document.getElementById('overviewConfigReset');
  browseConfigBtn = document.getElementById('browseConfig');
  externalControllerInput = document.getElementById('externalController');
  externalSecretInput = document.getElementById('externalSecret');
  externalAuthInput = document.getElementById('externalAuth');
  settingsExternalUi = document.getElementById('settingsExternalUi');
  settingsExternalUiUrl = document.getElementById('settingsExternalUiUrl');
  panelSelect = document.getElementById('panelSelect');
  startBtn = document.getElementById('startBtn');
  stopBtn = document.getElementById('stopBtn');
  restartBtn = document.getElementById('restartBtn');
  proxyModeSelect = document.getElementById('proxyModeSelect');
  tunToggle = document.getElementById('tunToggle');
  tunStackSelect = document.getElementById('tunStackSelect');
  refreshStatusBtn = document.getElementById('refreshStatus');
  refreshBackups = document.getElementById('refreshBackups');
  backupsRefresh = document.getElementById('backupsRefresh');
  switchBtn = document.getElementById('switchBtn');
  backupTable = document.getElementById('backupTable');
  backupTableFull = document.getElementById('backupTableFull');
  kernelCurrentTable = document.getElementById('kernelCurrentTable');
  configsRefresh = document.getElementById('configsRefresh');
  configsImport = document.getElementById('configsImport');
  configTable = document.getElementById('configTable');
  configPrev = document.getElementById('configPrev');
  configNext = document.getElementById('configNext');
  configPageInfo = document.getElementById('configPageInfo');
  configPageSize = document.getElementById('configPageSize');
  kernelTable = document.getElementById('kernelTable');
  kernelRefresh = document.getElementById('kernelRefresh');
  kernelPrev = document.getElementById('kernelPrev');
  kernelNext = document.getElementById('kernelNext');
  kernelPageInfo = document.getElementById('kernelPageInfo');
  kernelPageSize = document.getElementById('kernelPageSize');
  switchPrev = document.getElementById('switchPrev');
  switchNext = document.getElementById('switchNext');
  switchPageInfo = document.getElementById('switchPageInfo');
  switchPageSize = document.getElementById('switchPageSize');
  backupsPrev = document.getElementById('backupsPrev');
  backupsNext = document.getElementById('backupsNext');
  backupsPageInfo = document.getElementById('backupsPageInfo');
  backupsPageSize = document.getElementById('backupsPageSize');
  recommendPrev = document.getElementById('recommendPrev');
  recommendNext = document.getElementById('recommendNext');
  recommendPageInfo = document.getElementById('recommendPageInfo');
  recommendPageSize = document.getElementById('recommendPageSize');
  recommendTableBody = document.getElementById('recommendTableBody');
  backupsDelete = document.getElementById('backupsDelete');
  logLines = document.getElementById('logLines');
  logRefresh = document.getElementById('logRefresh');
  logContent = document.getElementById('logContent');
  logAutoRefresh = document.getElementById('logAutoRefresh');
  logIntervalPreset = document.getElementById('logIntervalPreset');
  logLevelFilter = document.getElementById('logLevelFilter');
  logMessageFilter = document.getElementById('logMessageFilter');
  logTableBody = document.getElementById('logTableBody');
  cleanModeSelect = document.getElementById('cleanModeSelect');
  cleanBtn = document.getElementById('cleanBtn');
  openAppLogBtn = document.getElementById('openAppLogBtn');
  dashboardFrame = document.getElementById('dashboardFrame');
  dashboardEmpty = document.getElementById('dashboardEmpty');
  dashboardHint = document.getElementById('dashboardHint');
  sudoModal = document.getElementById('sudoModal');
  sudoPassword = document.getElementById('sudoPassword');
  sudoCancel = document.getElementById('sudoCancel');
  sudoConfirm = document.getElementById('sudoConfirm');
  confirmModal = document.getElementById('confirmModal');
  confirmTitle = document.getElementById('confirmTitle');
  confirmBody = document.getElementById('confirmBody');
  confirmCancel = document.getElementById('confirmCancel');
  confirmOk = document.getElementById('confirmOk');
  updateGuideModal = document.getElementById('updateGuideModal');
  updateGuideTitle = document.getElementById('updateGuideTitle');
  updateGuideBody = document.getElementById('updateGuideBody');
  updateGuideClose = document.getElementById('updateGuideClose');
  updateGuideReleaseBtn = document.getElementById('updateGuideReleaseBtn');
  updateGuideAlphaBtn = document.getElementById('updateGuideAlphaBtn');
  appName = document.getElementById('appName');
  appVersion = document.getElementById('appVersion');
  themeToggle = document.getElementById('themeToggle');
  settingsTheme = document.getElementById('settingsTheme');
  settingsLang = document.getElementById('settingsLang');
  settingsGithubUser = document.getElementById('settingsGithubUser');
  settingsConfigPath = document.getElementById('settingsConfigPath');
  settingsBrowseConfig = document.getElementById('settingsBrowseConfig');
  settingsKernelPath = document.getElementById('settingsKernelPath');
  settingsConfigDefault = document.getElementById('settingsConfigDefault');
  settingsLogPath = document.getElementById('settingsLogPath');
  settingsConfigDir = document.getElementById('settingsConfigDir');
  settingsCoreDir = document.getElementById('settingsCoreDir');
  settingsDataDir = document.getElementById('settingsDataDir');
  settingsConfigDirReveal = document.getElementById('settingsConfigDirReveal');
  settingsCoreDirReveal = document.getElementById('settingsCoreDirReveal');
  settingsDataDirReveal = document.getElementById('settingsDataDirReveal');
  helperInstallBtn = document.getElementById('helperInstallBtn');
  helperRepairBtn = document.getElementById('helperRepairBtn');
  helperInstallTerminalBtn = document.getElementById('helperInstallTerminalBtn');
  helperInstallPathBtn = document.getElementById('helperInstallPathBtn');
  helperInstallPath = document.getElementById('helperInstallPath');
  helperStatusText = document.getElementById('helperStatusText');
  helperStatusDot = document.querySelector('.helper-status-dot');
  helperRefreshBtn = document.getElementById('helperRefreshBtn');
  helperCheckUpdateBtn = document.getElementById('helperCheckUpdateBtn');
  helperLogsOpenBtn = document.getElementById('helperLogsOpenBtn');
  helperLogsRevealBtn = document.getElementById('helperLogsRevealBtn');
  helperLogsPath = document.getElementById('helperLogsPath');
  helperVersionText = document.getElementById('helperVersionText');
  helpAboutVersion = document.getElementById('helpAboutVersion');
  helpAboutBuild = document.getElementById('helpAboutBuild');
  helpAboutStatus = document.getElementById('helpAboutStatus');
  helpCheckAppUpdateBtn = document.getElementById('helpCheckAppUpdateBtn');
  helpCheckKernelUpdateBtn = document.getElementById('helpCheckKernelUpdateBtn');
  helpCheckHelperUpdateBtn = document.getElementById('helpCheckHelperUpdateBtn');
  settingsBackupsPageSize = document.getElementById('settingsBackupsPageSize');
  settingsDebugMode = document.getElementById('settingsDebugMode');
  settingsWindowWidth = document.getElementById('settingsWindowWidth');
  settingsWindowHeight = document.getElementById('settingsWindowHeight');
  settingsAcceptBeta = document.getElementById('settingsAcceptBeta');
  settingsTrayMenuChart = document.getElementById('settingsTrayMenuChart');
  settingsTrayMenuProviderTraffic = document.getElementById('settingsTrayMenuProviderTraffic');
  settingsTrayMenuTrackers = document.getElementById('settingsTrayMenuTrackers');
  settingsTrayMenuFoxboard = document.getElementById('settingsTrayMenuFoxboard');
  settingsTrayMenuKernelManager = document.getElementById('settingsTrayMenuKernelManager');
  settingsTrayMenuDirectoryLocations = document.getElementById('settingsTrayMenuDirectoryLocations');
  settingsTrayMenuCopyShellExport = document.getElementById('settingsTrayMenuCopyShellExport');
  settingsProxyMixedPort = document.getElementById('settingsProxyMixedPort');
  settingsProxyPort = document.getElementById('settingsProxyPort');
  settingsProxySocksPort = document.getElementById('settingsProxySocksPort');
  settingsProxyAllowLan = document.getElementById('settingsProxyAllowLan');
  langButtons = Array.from(document.querySelectorAll('.lang-btn'));
  initCustomSelects(document);

  // Page sections are re-mounted on navigation. Reset overview render signatures so
  // the current payload can render into fresh DOM nodes instead of being skipped.
  state.providerSubscriptionRenderSignature = '';
  state.rulesOverviewRenderSignatures = {
    metrics: '',
    chart: '',
    records: '',
    behaviors: '',
    switchView: '',
  };
}

function bindNavButtons() {
  bindTopNavMore();
  navButtons.forEach((btn) => {
    if (btn.dataset.bound === 'true') {
      return;
    }
    btn.dataset.bound = 'true';
    btn.addEventListener('click', () => {
      if (topNavMore) {
        topNavMore.classList.remove('show');
      }
      const targetUrl = btn.dataset.url;
      if (targetUrl) {
        if (window.clashfox && typeof window.clashfox.openExternal === 'function') {
          window.clashfox.openExternal(targetUrl);
        } else {
          window.open(targetUrl);
        }
        return;
      }
      const trayAction = btn.dataset.trayAction;
      if (trayAction) {
        if (window.clashfox && typeof window.clashfox.trayMenuAction === 'function') {
          window.clashfox.trayMenuAction(trayAction).catch(() => {});
        }
        return;
      }
      const targetPage = btn.dataset.page;
      if (targetPage) {
        navigatePage(targetPage);
        return;
      }
      const target = btn.dataset.section;
      if (target) {
        setActiveSection(target);
      }
    });
  });
}

function bindTopbarActions() {
  if (sidebarCollapseToggle && sidebarCollapseToggle.dataset.bound !== 'true') {
    sidebarCollapseToggle.dataset.bound = 'true';
    sidebarCollapseToggle.addEventListener('click', () => {
      const nextCollapsed = !(state.settings && state.settings.sidebarCollapsed);
      applySidebarCollapsedState(nextCollapsed, true);
    });
  }
  if (themeToggle && themeToggle.dataset.bound !== 'true') {
    themeToggle.dataset.bound = 'true';
    themeToggle.addEventListener('click', () => {
      const nextTheme = state.theme === 'night' ? 'day' : 'night';
      applyThemePreference(nextTheme);
    });
  }
  if (refreshStatusBtn && refreshStatusBtn.dataset.bound !== 'true') {
    refreshStatusBtn.dataset.bound = 'true';
    refreshStatusBtn.addEventListener('click', async () => {
      await Promise.all([
        loadStatus(),
        loadOverview(),
        loadProviderSubscriptionOverview(),
        loadRulesOverviewCard(),
      ]);
      showToast(t('labels.statusRefreshed'));
    });
  }
}

function refreshPageView() {
  renderConfigTable();
  renderKernelTable();
  renderSwitchTable();
  renderBackupsTable();
  renderRecommendTable();
  if (logContent || logLines || logTableBody) {
    loadLogs();
  }
  loadStatus();
  if (currentPage === 'kernel') {
    loadKernels();
  }
  if (currentPage === 'kernel') {
    loadBackups();
  }
  if (currentPage === 'overview') {
    hydrateOverviewProviderSubscriptionFromCache();
    hydrateOverviewRulesCardFromCache();
    Promise.all([
      loadOverview(),
      loadProviderSubscriptionOverview(),
      loadRulesOverviewCard(),
    ]);
  }
  if (currentPage === 'dashboard') {
    initDashboardFrame();
  }
  if (currentPage === 'help') {
    loadAppInfo().catch(() => {});
  }
  if (currentPage === 'settings') {
    invokeHelperPanelRefresh();
  }
}

async function invokeHelperPanelRefresh(force = false) {
  try {
    const fn = window.__refreshHelperPanel;
    if (typeof fn === 'function') {
      await fn(Boolean(force));
    }
  } catch (err) {
    console.warn('[helper] invokeHelperPanelRefresh failed:', err);
  }
}

function getPageFromLocation() {
  const path = window.location.pathname || '';
  const match = path.match(/([^/]+)\.html$/);
  const page = match ? match[1] : currentPage;
  return VALID_PAGES.has(page) ? page : currentPage;
}

function extractPageSectionHtml(pageHtml = '') {
  if (!pageHtml) {
    return '';
  }
  const parsed = new DOMParser().parseFromString(pageHtml, 'text/html');
  const root = parsed.getElementById('contentRoot');
  const section = root && root.firstElementChild ? root.firstElementChild : null;
  return section ? section.outerHTML : '';
}

const pageTemplateCache = new Map();
const pageTemplatePendingMap = new Map();

function savePageTemplateCache(page, sectionHtml) {
  const key = String(page || '').trim();
  const markup = String(sectionHtml || '').trim();
  if (!key || !markup) {
    return;
  }
  pageTemplateCache.set(key, markup);
}

function readPageTemplateCache(page) {
  const key = String(page || '').trim();
  return key ? String(pageTemplateCache.get(key) || '') : '';
}

async function loadPageSectionTemplate(page, allowFetch = true) {
  const normalized = String(page || '').trim();
  if (!normalized) {
    return '';
  }
  const cached = readPageTemplateCache(normalized);
  if (cached) {
    return cached;
  }
  if (!allowFetch) {
    return '';
  }
  if (pageTemplatePendingMap.has(normalized)) {
    return pageTemplatePendingMap.get(normalized);
  }
  const pending = (async () => {
    try {
      const response = await fetch(new URL(`${normalized}.html`, window.location.href));
      if (!response.ok) {
        return '';
      }
      const html = await response.text();
      const sectionHtml = extractPageSectionHtml(html);
      if (sectionHtml) {
        savePageTemplateCache(normalized, sectionHtml);
      }
      return sectionHtml;
    } finally {
      pageTemplatePendingMap.delete(normalized);
    }
  })();
  pageTemplatePendingMap.set(normalized, pending);
  return pending;
}

async function preloadPageTemplates(excludePage = '') {
  const exclude = String(excludePage || '').trim();
  const targets = Array.from(VALID_PAGES).filter((page) => page && page !== exclude && !readPageTemplateCache(page));
  if (!targets.length) {
    return;
  }
  const run = async () => {
    for (const page of targets) {
      await loadPageSectionTemplate(page, true).catch(() => '');
    }
  };
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(() => {
      run().catch(() => {});
    }, { timeout: 1200 });
    return;
  }
  setTimeout(() => {
    run().catch(() => {});
  }, 120);
}

function preventPageReloadShortcuts() {
  document.addEventListener('keydown', (event) => {
    if (state && state.settings && state.settings.debugMode) {
      return;
    }
    const key = String(event.key || '').toLowerCase();
    const isReloadShortcut = (event.metaKey || event.ctrlKey) && key === 'r';
    const isF5 = key === 'f5';
    if (isReloadShortcut || isF5) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);
}

async function navigatePage(targetPage, pushState = true) {
  const normalized = String(targetPage || '').trim();
  guiLog('nav', 'navigatePage called', { targetPage: normalized, currentPage, pushState });
  if (!VALID_PAGES.has(normalized)) {
    return;
  }
  if (currentPage === 'dashboard' && normalized !== 'dashboard' && dashboardLocalModule && typeof dashboardLocalModule.teardownDashboardPanel === 'function') {
    dashboardLocalModule.teardownDashboardPanel();
  }
  if (currentPage === 'overview') {
    cacheOverviewNetworkFromState();
    cacheOverviewTrafficFromState();
    cacheOverviewRulesCard();
    closeTopologyZoomModal();
    if (normalized !== 'overview') {
      closeMihomoConnectionsSocket();
      closeMihomoTrafficSocket();
      closeMihomoMemorySocket();
      closeMihomoLogsSocket();
      stopTopologyTicker();
    }
  }
  if (currentPage === 'logs' && normalized !== 'logs') {
    closeMihomoPageLogsSocket();
  }
  if (!normalized || normalized === currentPage) {
    return;
  }
  if (!contentRoot) {
    window.location.href = `${normalized}.html`;
    return;
  }
  const sectionHtml = await loadPageSectionTemplate(normalized, true);
  if (!sectionHtml) {
    window.location.href = `${normalized}.html`;
    return;
  }
  const template = document.createElement('template');
  template.innerHTML = sectionHtml.trim();
  const newSection = template.content.firstElementChild;
  if (!newSection) {
    window.location.href = `${targetPage}.html`;
    return;
  }
  newSection.classList.add('page-section');
  contentRoot.innerHTML = '';
  contentRoot.appendChild(newSection);
  contentRoot.scrollTop = 0;
  if (typeof contentRoot.scrollTo === 'function') {
    contentRoot.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }

  currentPage = normalized;
  if (document.body) {
    document.body.dataset.page = normalized;
  }
  setActiveNav(normalized);
  refreshPageRefs();
  applySettings(state.settings || readSettings());
  applyI18n();
  bindPageEvents();
  refreshPageView();
  if (normalized === 'settings') {
    requestAnimationFrame(() => {
      if (!contentRoot) return;
      contentRoot.scrollTop = 0;
      if (typeof contentRoot.scrollTo === 'function') {
        contentRoot.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      }
    });
  }
  if (normalized === 'dashboard') {
    initDashboardFrame();
  }
  if (pushState) {
    history.pushState({ page: normalized }, '', `${normalized}.html`);
  }
}

window.addEventListener('beforeunload', () => {
  if (dashboardLocalModule && typeof dashboardLocalModule.teardownDashboardPanel === 'function') {
    dashboardLocalModule.teardownDashboardPanel();
  }
  closeMihomoConnectionsSocket();
  closeMihomoTrafficSocket();
  closeMihomoMemorySocket();
  closeMihomoLogsSocket();
  closeMihomoPageLogsSocket();
  stopTopologyTicker();
  if (currentPage === 'overview') {
    cacheOverviewNetworkFromState();
    cacheOverviewTrafficFromState();
    cacheOverviewRulesCard();
  }
});

function setLayoutReady() {
  // Compute scrollbar compensation before first paint to avoid topbar jitter.
  updateScrollbarWidthVar();
  if (document.body && !document.body.classList.contains('layout-ready')) {
    document.body.classList.add('layout-ready');
  }
}

function updateScrollbarWidthVar() {
  const measure = document.createElement('div');
  measure.style.width = '100px';
  measure.style.height = '100px';
  measure.style.overflow = 'scroll';
  measure.style.position = 'absolute';
  measure.style.top = '-9999px';
  document.body.appendChild(measure);
  const width = measure.offsetWidth - measure.clientWidth;
  document.body.removeChild(measure);
  document.documentElement.style.setProperty('--scrollbar-width', `${width}px`);
}

async function loadLayoutParts() {
  const menuContainer = document.getElementById('menuContainer');
  const topbarContainer = document.getElementById('topbarContainer');
  const tasks = [];
  if (menuContainer) {
    tasks.push(
      fetch(new URL('menu.html', window.location.href))
        .then((res) => (res.ok ? res.text() : ''))
        .then((html) => {
          if (html) {
            menuContainer.innerHTML = html;
          }
        })
    );
  }
  if (topbarContainer) {
    tasks.push(
      fetch(new URL('topbar.html', window.location.href))
        .then((res) => (res.ok ? res.text() : ''))
        .then((html) => {
          if (html) {
            topbarContainer.innerHTML = html;
          }
        })
    );
  }
  if (tasks.length) {
    await Promise.all(tasks);
  }
  // First paint should not wait for modal fragments.
  refreshLayoutRefs();
  refreshPageRefs();
  bindNavButtons();
  bindTopbarActions();
  setLayoutReady();
  ensureSidebarFoxDivider();
  renderFoxRankPanel();

  const sudoRoot = document.getElementById('sudoRoot');
  const confirmRoot = document.getElementById('confirmRoot');
  const updateGuideRoot = document.getElementById('updateGuideRoot');
  const fragmentTasks = [];
  if (sudoRoot) {
    fragmentTasks.push(
      fetch('authorize.html')
        .then((res) => (res.ok ? res.text() : ''))
        .then((html) => {
          if (html) {
            sudoRoot.innerHTML = html;
          }
        })
    );
  }
  if (confirmRoot) {
    fragmentTasks.push(
      fetch('confirm.html')
        .then((res) => (res.ok ? res.text() : ''))
        .then((html) => {
          if (html) {
            confirmRoot.innerHTML = html;
          }
        })
    );
  }
  if (updateGuideRoot) {
    fragmentTasks.push(
      fetch('update-guide.html')
        .then((res) => (res.ok ? res.text() : ''))
        .then((html) => {
          if (html) {
            updateGuideRoot.innerHTML = html;
          }
        })
    );
  }
  if (fragmentTasks.length) {
    Promise.all(fragmentTasks)
      .then(() => {
        refreshLayoutRefs();
        refreshPageRefs();
        bindNavButtons();
        bindTopbarActions();
      })
      .catch(() => {
        // ignore fragment load errors
      });
  }
}

function bindPageEvents() {
if (noticePopClose && noticePopClose.dataset.bound !== 'true') {
  noticePopClose.dataset.bound = 'true';
  noticePopClose.addEventListener('click', hideNoticePop);
}
if (foxRankCard && foxRankCard.dataset.bound !== 'true') {
  foxRankCard.dataset.bound = 'true';
  foxRankCard.addEventListener('click', openFoxRankDetailModal);
}
if (foxRankDetailClose && foxRankDetailClose.dataset.bound !== 'true') {
  foxRankDetailClose.dataset.bound = 'true';
  foxRankDetailClose.addEventListener('click', closeFoxRankDetailModal);
}
if (foxRankDetailModal && foxRankDetailModal.dataset.bound !== 'true') {
  foxRankDetailModal.dataset.bound = 'true';
  foxRankDetailModal.addEventListener('click', (event) => {
    if (event.target === foxRankDetailModal || event.target.classList.contains('fox-rank-detail-backdrop')) {
      closeFoxRankDetailModal();
    }
  });
}
if (foxRankSectionTabs && foxRankSectionTabs.dataset.bound !== 'true') {
  foxRankSectionTabs.dataset.bound = 'true';
  foxRankSectionTabs.addEventListener('click', (event) => {
    const button = event.target && event.target.closest
      ? event.target.closest('[data-fox-rank-tab]')
      : null;
    if (!button) {
      return;
    }
    setFoxRankDetailTab(String(button.dataset.foxRankTab || 'log'));
  });
}
if (foxRankBriefModal && foxRankBriefModal.dataset.bound !== 'true') {
  foxRankBriefModal.dataset.bound = 'true';
  foxRankBriefModal.addEventListener('click', (event) => {
    if (event.target === foxRankBriefModal || event.target.classList.contains('fox-rank-brief-backdrop')) {
      closeFoxRankBriefModal();
    }
  });
}
if (foxRankCopySummaryBtn && foxRankCopySummaryBtn.dataset.bound !== 'true') {
  foxRankCopySummaryBtn.dataset.bound = 'true';
  foxRankCopySummaryBtn.addEventListener('click', () => {
    runFoxRankActionWithButton(
      foxRankCopySummaryBtn,
      foxRankText('copySummary', 'Copy Summary'),
      foxRankText('copying', 'Copying...'),
      () => copyFoxRankSummary(),
    );
  });
}
if (foxRankExportPngBtn && foxRankExportPngBtn.dataset.bound !== 'true') {
  foxRankExportPngBtn.dataset.bound = 'true';
  foxRankExportPngBtn.addEventListener('click', () => {
    runFoxRankActionWithButton(
      foxRankExportPngBtn,
      foxRankText('exportPng', 'Export PNG'),
      foxRankText('exporting', 'Exporting...'),
      () => exportFoxRankCardPng(),
    );
  });
}
if (foxRankBriefClose && foxRankBriefClose.dataset.bound !== 'true') {
  foxRankBriefClose.dataset.bound = 'true';
  foxRankBriefClose.addEventListener('click', closeFoxRankBriefModal);
}
if (foxRankBriefOpenDetail && foxRankBriefOpenDetail.dataset.bound !== 'true') {
  foxRankBriefOpenDetail.dataset.bound = 'true';
  foxRankBriefOpenDetail.addEventListener('click', () => {
    closeFoxRankBriefModal();
    openFoxRankDetailModal();
  });
}
if (document.body && document.body.dataset.proxyConfigActionBound !== 'true') {
  document.body.dataset.proxyConfigActionBound = 'true';
  document.addEventListener('click', async (event) => {
    const button = event.target && event.target.closest
      ? event.target.closest('#proxyConfigReloadCoreBtn, #proxyConfigReloadConfigBtn')
      : null;
    if (!button) {
      return;
    }
    const isReloadCore = button.id === 'proxyConfigReloadCoreBtn';
    guiLog('proxy-config', isReloadCore ? 'reload core requested' : 'reload config requested');
    button.disabled = true;
    try {
      const response = isReloadCore
        ? await reloadMihomoCore(getMihomoApiSource())
        : await reloadMihomoConfig(getMihomoApiSource());
      if (!response || !response.ok) {
        const detail = response && (response.details || response.error)
          ? `: ${String(response.details || response.error)}`
          : '';
        showToast(
          `${isReloadCore
            ? ti('settings.proxyReloadCoreFailed', 'Reload core failed')
            : ti('settings.proxyReloadConfigFailed', 'Reload config failed')}${detail}`,
          'error',
        );
        return;
      }
      showToast(
        isReloadCore
          ? ti('settings.proxyReloadCoreSuccess', 'Core reloaded')
          : ti('settings.proxyReloadConfigSuccess', 'Config reloaded'),
        'info',
      );
      loadStatus();
      loadTunStatus(false);
      if (currentPage === 'overview') {
        loadOverview();
      }
    } finally {
      button.disabled = false;
    }
  });
}
const externalLinks = Array.from(document.querySelectorAll('[data-open-external="true"]'));
externalLinks.forEach((link) => {
  if (link.dataset.bound === 'true') {
    return;
  }
  link.dataset.bound = 'true';
  link.addEventListener('click', (event) => {
    event.preventDefault();
    const url = link.getAttribute('href');
    if (!url) {
      return;
    }
    if (window.clashfox && typeof window.clashfox.openExternal === 'function') {
      window.clashfox.openExternal(url);
    } else {
      window.open(url);
    }
  });
});
bindOverviewDrag();
document.querySelectorAll('[data-tip-key]').forEach((el) => {
  if (el.dataset.tipBound === 'true') {
    return;
  }
  el.dataset.tipBound = 'true';
  el.addEventListener('mouseenter', () => updateTipPosition(el));
  el.addEventListener('focus', () => updateTipPosition(el));
});
if (document.body && document.body.dataset.tipDelegationBound !== 'true') {
  document.body.dataset.tipDelegationBound = 'true';
  const delegatedTipHandler = (event) => {
    const target = event.target && event.target.closest
      ? event.target.closest('[data-tip-key]')
      : null;
    if (!target) {
      return;
    }
    updateTipPosition(target);
  };
  document.addEventListener('mouseover', delegatedTipHandler, true);
  document.addEventListener('focusin', delegatedTipHandler, true);
}
if (document.body && document.body.dataset.topologyKeyBound !== 'true') {
  document.body.dataset.topologyKeyBound = 'true';
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      setTopologyHoverKey('');
      if (foxRankDetailModal && !foxRankDetailModal.hidden) {
        closeFoxRankDetailModal();
      }
    }
  });
}
if (overviewKernelCopy && overviewKernelCopy.dataset.bound !== 'true') {
  overviewKernelCopy.dataset.bound = 'true';
  overviewKernelCopy.addEventListener('click', handleOverviewKernelCopy);
}
if (overviewLocalIpCopy && overviewLocalIpCopy.dataset.bound !== 'true') {
  overviewLocalIpCopy.dataset.bound = 'true';
  overviewLocalIpCopy.addEventListener('click', () => handleOverviewTextCopy(state.overviewIpRaw.local));
}
if (overviewProxyIpCopy && overviewProxyIpCopy.dataset.bound !== 'true') {
  overviewProxyIpCopy.dataset.bound = 'true';
  overviewProxyIpCopy.addEventListener('click', () => handleOverviewTextCopy(state.overviewIpRaw.proxy));
}
if (overviewInternetIpCopy && overviewInternetIpCopy.dataset.bound !== 'true') {
  overviewInternetIpCopy.dataset.bound = 'true';
  overviewInternetIpCopy.addEventListener('click', () => handleOverviewTextCopy(state.overviewIpRaw.internet));
}
  langButtons.forEach((btn) => {
    btn.addEventListener('click', () => setLanguage(btn.dataset.lang));
  });

  if (settingsLang) {
  settingsLang.addEventListener('change', (event) => {
    setLanguage(event.target.value);
  });
}

if (settingsTheme) {
  settingsTheme.addEventListener('change', (event) => {
    applyThemePreference(event.target.value);
  });
}

if (settingsDebugMode) {
  settingsDebugMode.addEventListener('change', (event) => {
    const enabled = Boolean(event.target.checked);
    saveSettings({ debugMode: enabled });
    syncDebugMode(enabled);
  });
}

if (settingsWindowWidth) {
  settingsWindowWidth.addEventListener('change', (event) => {
    const current = sanitizeWindowDimension(
      state.settings.windowWidth,
      MAIN_WINDOW_DEFAULT_WIDTH,
      MAIN_WINDOW_MIN_WIDTH,
      MAIN_WINDOW_MAX_WIDTH,
    );
    const next = sanitizeWindowDimension(
      event.target.value,
      current,
      MAIN_WINDOW_MIN_WIDTH,
      MAIN_WINDOW_MAX_WIDTH,
    );
    event.target.value = next;
    saveSettings({ windowWidth: next });
  });
}

if (settingsWindowHeight) {
  settingsWindowHeight.addEventListener('change', (event) => {
    const current = sanitizeWindowDimension(
      state.settings.windowHeight,
      MAIN_WINDOW_DEFAULT_HEIGHT,
      MAIN_WINDOW_MIN_HEIGHT,
      MAIN_WINDOW_MAX_HEIGHT,
    );
    const next = sanitizeWindowDimension(
      event.target.value,
      current,
      MAIN_WINDOW_MIN_HEIGHT,
      MAIN_WINDOW_MAX_HEIGHT,
    );
    event.target.value = next;
    saveSettings({ windowHeight: next });
  });
}

if (settingsAcceptBeta) {
  settingsAcceptBeta.addEventListener('change', (event) => {
    const enabled = Boolean(event.target.checked);
    saveSettings({ acceptBeta: enabled });
  });
}

if (settingsTrayMenuChart) {
  settingsTrayMenuChart.addEventListener('change', (event) => {
    const enabled = Boolean(event.target.checked);
    saveSettings({ chartEnabled: enabled });
  });
}

if (settingsTrayMenuProviderTraffic) {
  settingsTrayMenuProviderTraffic.addEventListener('change', (event) => {
    const enabled = Boolean(event.target.checked);
    saveSettings({ providerTrafficEnabled: enabled });
  });
}

if (settingsTrayMenuTrackers) {
  settingsTrayMenuTrackers.addEventListener('change', (event) => {
    const enabled = Boolean(event.target.checked);
    saveSettings({ trackersEnabled: enabled });
  });
}

if (settingsTrayMenuFoxboard) {
  settingsTrayMenuFoxboard.addEventListener('change', (event) => {
    const enabled = Boolean(event.target.checked);
    saveSettings({ foxboardEnabled: enabled });
  });
}

if (settingsTrayMenuKernelManager) {
  settingsTrayMenuKernelManager.addEventListener('change', (event) => {
    const enabled = Boolean(event.target.checked);
    saveSettings({ kernelManagerEnabled: enabled });
  });
}

if (settingsTrayMenuDirectoryLocations) {
  settingsTrayMenuDirectoryLocations.addEventListener('change', (event) => {
    const enabled = Boolean(event.target.checked);
    saveSettings({ directoryLocationsEnabled: enabled });
  });
}

if (settingsTrayMenuCopyShellExport) {
  settingsTrayMenuCopyShellExport.addEventListener('change', (event) => {
    const enabled = Boolean(event.target.checked);
    saveSettings({ copyShellExportCommandEnabled: enabled });
  });
}

const normalizeProxyPortSetting = (input, fallback) => {
  const parsed = Number.parseInt(String(input ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 65535) {
    return fallback;
  }
  return parsed;
};

if (settingsProxyMixedPort) {
  settingsProxyMixedPort.addEventListener('change', async (event) => {
    const fallback = Number.parseInt(String(state.settings.mixedPort ?? 7893), 10) || 7893;
    const next = normalizeProxyPortSetting(event.target.value, fallback);
    const previous = fallback;
    event.target.value = next;
    event.target.disabled = true;
    try {
      const response = await updateMihomoConfigViaController({ 'mixed-port': next }, getMihomoApiSource());
      if (!response || !response.ok) {
        event.target.value = previous;
        const detail = response && (response.details || response.error)
          ? `: ${String(response.details || response.error)}`
          : '';
        showToast(`${ti('settings.proxyMixedPortUpdateFailed', 'Mixed port update failed')}${detail}`, 'error');
        return;
      }
      saveSettings({ mixedPort: next });
    } finally {
      event.target.disabled = false;
    }
  });
}

if (settingsProxyPort) {
  settingsProxyPort.addEventListener('change', async (event) => {
    const fallback = Number.parseInt(String(state.settings.port ?? 7890), 10) || 7890;
    const next = normalizeProxyPortSetting(event.target.value, fallback);
    const previous = fallback;
    event.target.value = next;
    event.target.disabled = true;
    try {
      const response = await updateMihomoConfigViaController({ port: next }, getMihomoApiSource());
      if (!response || !response.ok) {
        event.target.value = previous;
        const detail = response && (response.details || response.error)
          ? `: ${String(response.details || response.error)}`
          : '';
        showToast(`${ti('settings.proxyPortUpdateFailed', 'Port update failed')}${detail}`, 'error');
        return;
      }
      saveSettings({ port: next });
    } finally {
      event.target.disabled = false;
    }
  });
}

if (settingsProxySocksPort) {
  settingsProxySocksPort.addEventListener('change', async (event) => {
    const fallback = Number.parseInt(String(state.settings.socksPort ?? 7891), 10) || 7891;
    const next = normalizeProxyPortSetting(event.target.value, fallback);
    const previous = fallback;
    event.target.value = next;
    event.target.disabled = true;
    try {
      const response = await updateMihomoConfigViaController({ 'socks-port': next }, getMihomoApiSource());
      if (!response || !response.ok) {
        event.target.value = previous;
        const detail = response && (response.details || response.error)
          ? `: ${String(response.details || response.error)}`
          : '';
        showToast(`${ti('settings.proxySocksPortUpdateFailed', 'Socks port update failed')}${detail}`, 'error');
        return;
      }
      saveSettings({ socksPort: next });
    } finally {
      event.target.disabled = false;
    }
  });
}

if (settingsProxyAllowLan) {
  settingsProxyAllowLan.addEventListener('change', async (event) => {
    const nextChecked = Boolean(event.target.checked);
    const previousChecked = Boolean(state.settings.allowLan);
    event.target.disabled = true;
    try {
      const response = await updateAllowLanViaController(nextChecked, getMihomoApiSource());
      if (!response || !response.ok) {
        event.target.checked = previousChecked;
        const detail = response && (response.details || response.error)
          ? `: ${String(response.details || response.error)}`
          : '';
        showToast(`${ti('settings.proxyAllowLanUpdateFailed', 'Allow LAN update failed')}${detail}`, 'error');
        return;
      }
      saveSettings({ allowLan: nextChecked });
    } finally {
      event.target.disabled = false;
    }
  });
}

const getRevealPath = (inputEl) => {
  if (!inputEl) {
    return '';
  }
  const value = (inputEl.value || '').trim();
  if (value && value !== '-') {
    return value;
  }
  const placeholder = (inputEl.placeholder || '').trim();
  if (placeholder && placeholder !== '-') {
    return placeholder;
  }
  return '';
};

async function refreshHelperInstallPath() {
  if (!helperInstallPath) {
    return;
  }
  guiLog('helper-panel', 'refresh install path started');
  const response = await getHelperInstallPath();
  if (response && response.ok) {
    helperInstallPath.textContent = response.path || '-';
    helperInstallPath.dataset.exists = response.exists ? 'true' : 'false';
    guiLog('helper-panel', 'refresh install path completed', {
      exists: Boolean(response.exists),
      path: response.path || '',
    });
    return;
  }
  guiLog('helper-panel', 'refresh install path failed', {
    error: response && response.error ? response.error : 'get_helper_install_path_failed',
  }, 'warn');
}

function refreshHelperLogPath() {
  if (helperLogsPath) {
    helperLogsPath.textContent = DEFAULT_HELPER_LOG_PATH;
  }
}

function setHelperStatus(state, text) {
  if (helperStatusText) {
    helperStatusText.textContent = text || '-';
    helperStatusText.dataset.state = state || 'unknown';
  }
  if (helperStatusDot) {
    helperStatusDot.dataset.state = state || 'unknown';
  }
}

function setHelperPrimaryAction(snapshot = {}) {
  const stateValue = snapshot && snapshot.state ? String(snapshot.state) : '';
  const installed = Boolean(snapshot && snapshot.installed);
  const updateAvailable = Boolean(snapshot && snapshot.helperUpdateAvailable);
  if (!installed) {
    helperPrimaryAction = 'install';
  } else if (updateAvailable) {
    helperPrimaryAction = 'update';
  } else {
    helperPrimaryAction = 'uninstall';
  }
  if (!helperInstallBtn) {
    return;
  }
  if (helperPrimaryAction === 'uninstall') {
    helperInstallBtn.textContent = ti('settings.helperUninstall', 'Uninstall');
  } else if (helperPrimaryAction === 'update') {
    helperInstallBtn.textContent = ti('settings.helperUpdate', 'Update');
  } else {
    helperInstallBtn.textContent = ti('settings.helperInstall', 'Install');
  }
  helperInstallBtn.dataset.helperAction = helperPrimaryAction;
  if (helperCheckUpdateBtn) {
    // Only show "Check updates" after helper is installed.
    helperCheckUpdateBtn.classList.toggle('is-hidden', !installed);
  }
  if (helperRefreshBtn) {
    // When primary action is uninstall, hide manual refresh button.
    const hideRefresh = helperPrimaryAction === 'uninstall';
    helperRefreshBtn.classList.toggle('is-hidden', hideRefresh);
  }
  if (helperRepairBtn) {
    const showRepair = installed && stateValue === 'installed_unreachable';
    helperRepairBtn.classList.toggle('is-hidden', !showRepair);
  }
}

function getCachedHelperStatus() {
  const candidate = (state.settings && state.settings.helperStatus)
    || (state.fileSettings && state.fileSettings.helperStatus)
    || null;
  if (!candidate || typeof candidate !== 'object') {
    return null;
  }
  return candidate;
}

async function hydrateHelperStatusFromFile() {
  try {
    const response = await readHelperSettings();
    if (!response || !response.ok || !response.data || typeof response.data !== 'object') {
      return;
    }
    if (response.data.helperStatus && typeof response.data.helperStatus === 'object') {
      if (!state.settings) state.settings = {};
      if (!state.fileSettings) state.fileSettings = {};
      state.settings.helperStatus = response.data.helperStatus;
      state.fileSettings.helperStatus = response.data.helperStatus;
      applyHelperStatusSnapshot(response.data.helperStatus);
    }
  } catch {
    // ignore
  }
}

function applyHelperStatusSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') {
    return;
  }
  setHelperPrimaryAction(snapshot);
  if (helperVersionText) {
    const version = normalizeVersionForDisplay(snapshot.helperVersion || '');
    const targetVersion = normalizeVersionForDisplay(snapshot.helperTargetVersion || '');
    const updateAvailable = Boolean(snapshot.helperUpdateAvailable && version && targetVersion);
    helperVersionText.dataset.updateAvailable = updateAvailable ? 'true' : 'false';
    if (updateAvailable) {
      helperVersionText.innerHTML = `Version: <span class="helper-version-current">${version}</span> -> <span class="helper-version-target">${targetVersion}</span>`;
    } else {
      helperVersionText.textContent = `Version: ${version || '-'}`;
    }
  }
  const logPath = snapshot.logPath || DEFAULT_HELPER_LOG_PATH;
  if (helperLogsPath) {
    helperLogsPath.textContent = logPath;
  }
  if (snapshot.state === 'running') {
    setHelperStatus('running', ti('settings.helperStatusRunning', 'Running'));
  } else if (snapshot.state === 'installed_unreachable') {
    setHelperStatus('warning', ti('settings.helperStatusUnreachable', 'Installed (Unreachable)'));
  } else if (snapshot.state === 'not_installed') {
    setHelperStatus('stopped', ti('settings.helperStatusStopped', 'Not Installed'));
  } else if (snapshot.state === 'stopped') {
    setHelperStatus('stopped', 'Stopped');
  } else {
    setHelperStatus('unknown', '-');
  }
}

async function refreshHelperStatus(force = false) {
  guiLog('helper-panel', 'refresh status started', { force: Boolean(force) });
  await hydrateHelperStatusFromFile();
  const cached = getCachedHelperStatus();
  if (cached) {
    applyHelperStatusSnapshot(cached);
  }

  try {
    const response = await getHelperStatus();
    if (response && response.ok && response.data) {
      const snapshot = buildHelperStatusSnapshot(response.data, {
        defaultLogPath: DEFAULT_HELPER_LOG_PATH,
      });
      if (state.settings) {
        state.settings.helperStatus = snapshot;
      }
      if (state.fileSettings) {
        state.fileSettings.helperStatus = snapshot;
      }
      applyHelperStatusSnapshot(snapshot);
      guiLog('helper-panel', 'refresh status completed', {
        state: snapshot.state,
        installed: snapshot.installed,
        running: snapshot.running,
        updateAvailable: snapshot.helperUpdateAvailable,
      });
      return;
    }
  } catch (err) {
    guiLog('helper-panel', 'refresh status threw', {
      error: err && err.message ? err.message : String(err || ''),
    }, 'error');
  }
}

async function refreshHelperPanel(force = false) {
  guiLog('helper-panel', 'refresh panel started', { force: Boolean(force) });
  await hydrateHelperStatusFromFile();
  await Promise.all([
    refreshHelperStatus(force),
    refreshHelperInstallPath(),
    Promise.resolve(refreshHelperLogPath()),
  ]);
  guiLog('helper-panel', 'refresh panel completed');
}
window.__refreshHelperPanel = refreshHelperPanel;

if (settingsConfigDirReveal) {
  settingsConfigDirReveal.addEventListener('click', async () => {
    const target = getRevealPath(settingsConfigDir);
    if (target && window.clashfox && typeof window.clashfox.revealInFinder === 'function') {
      await window.clashfox.revealInFinder(target);
    }
  });
}

if (settingsCoreDirReveal) {
  settingsCoreDirReveal.addEventListener('click', async () => {
    const target = getRevealPath(settingsCoreDir);
    if (target && window.clashfox && typeof window.clashfox.revealInFinder === 'function') {
      await window.clashfox.revealInFinder(target);
    }
  });
}

if (settingsDataDirReveal) {
  settingsDataDirReveal.addEventListener('click', async () => {
    const target = getRevealPath(settingsDataDir);
    if (target && window.clashfox && typeof window.clashfox.revealInFinder === 'function') {
      await window.clashfox.revealInFinder(target);
    }
  });
}

if (helperInstallBtn) {
  if (helperInstallBtn.dataset.bound !== 'true') {
    helperInstallBtn.dataset.bound = 'true';
    helperInstallBtn.addEventListener('click', async () => {
      const isUninstall = helperPrimaryAction === 'uninstall';
      const isUpdate = helperPrimaryAction === 'update';
      helperInstallBtn.disabled = true;
      const response = isUninstall
        ? await uninstallHelper()
        : await installHelper();
      if (response && response.error === 'bridge_missing') {
        helperInstallBtn.disabled = false;
        showToast(ti('settings.helperInstallUnavailable', 'Helper installer unavailable'), 'error');
        return;
      }
      helperInstallBtn.disabled = false;
      if (response && response.ok) {
        showToast(
          isUninstall
            ? ti('settings.helperUninstallSuccess', 'Helper uninstalled')
            : (isUpdate
              ? ti('settings.helperUpdateSuccess', 'Helper updated')
              : ti('settings.helperInstallSuccess', 'Helper installed')),
          'info'
        );
        await refreshHelperPanel(true);
        return;
      }
      if (response && response.path && helperInstallPath) {
        helperInstallPath.textContent = response.path;
      }
      const detail = response && (response.details || response.error)
        ? `: ${String(response.details || response.error)}`
        : '';
      showToast(
        `${isUninstall
          ? ti('settings.helperUninstallFailed', 'Helper uninstall failed')
          : (isUpdate
            ? ti('settings.helperUpdateFailed', 'Helper update failed')
            : ti('settings.helperInstallFailed', 'Helper install failed'))}${detail}`,
        'error'
      );
      if (response && response.rollback && typeof response.rollback === 'object') {
        const restored = Boolean(response.rollback.restored);
        showToast(
          restored
            ? ti('settings.helperRollbackOk', 'Helper rollback completed')
            : ti('settings.helperRollbackFailed', 'Helper rollback failed'),
          restored ? 'info' : 'error'
        );
      }
    });
  }
}

if (helperRepairBtn) {
  if (helperRepairBtn.dataset.bound !== 'true') {
    helperRepairBtn.dataset.bound = 'true';
    helperRepairBtn.addEventListener('click', async () => {
      helperRepairBtn.disabled = true;
      const response = await repairHelper();
      if (response && response.error === 'bridge_missing') {
        helperRepairBtn.disabled = false;
        showToast(ti('settings.helperInstallUnavailable', 'Helper installer unavailable'), 'error');
        return;
      }
      helperRepairBtn.disabled = false;
      if (response && response.ok) {
        showToast(ti('settings.helperRepairSuccess', 'Helper repaired'), 'info');
        await refreshHelperPanel(true);
        return;
      }
      const detail = response && (response.details || response.error)
        ? `: ${String(response.details || response.error)}`
        : '';
      showToast(`${ti('settings.helperRepairFailed', 'Helper repair failed')}${detail}`, 'error');
    });
  }
}

if (helperInstallTerminalBtn) {
  helperInstallTerminalBtn.addEventListener('click', async () => {
    helperInstallTerminalBtn.disabled = true;
    const response = await runHelperInstallInTerminal();
    helperInstallTerminalBtn.disabled = false;
    if (response && response.error === 'bridge_missing') {
      showToast(ti('settings.helperInstallUnavailable', 'Helper installer unavailable'), 'error');
      return;
    }
    if (response && response.ok) {
      showToast(ti('settings.helperInstallTerminalLaunched', 'Opened Terminal'), 'info');
      refreshHelperInstallPath();
      return;
    }
    if (response && response.path && helperInstallPath) {
      helperInstallPath.textContent = response.path;
    }
    showToast(ti('settings.helperInstallFailed', 'Helper install failed'), 'error');
  });
}

if (helperInstallPathBtn) {
  helperInstallPathBtn.addEventListener('click', async () => {
    await refreshHelperInstallPath();
    const pathValue = helperInstallPath ? helperInstallPath.textContent.trim() : '';
    if (!pathValue || pathValue === '-') {
      return;
    }
    await revealInFinder(pathValue);
  });
}

if (helperRefreshBtn) {
  helperRefreshBtn.addEventListener('click', async () => {
    helperRefreshBtn.disabled = true;
    await refreshHelperPanel(true);
    helperRefreshBtn.disabled = false;
  });
}

if (helperCheckUpdateBtn) {
  if (helperCheckUpdateBtn.dataset.bound !== 'true') {
    helperCheckUpdateBtn.dataset.bound = 'true';
    helperCheckUpdateBtn.addEventListener('click', async () => {
      helperCheckUpdateBtn.disabled = true;
      try {
        const result = await checkHelperUpdates({ force: true });
        if (result && result.error === 'bridge_missing') {
          showToast(ti('settings.helperUpdateCheckFailed', 'Failed to check helper updates'), 'error');
          return;
        }
        if (!result || !result.ok) {
          const detail = result && result.error ? `: ${String(result.error)}` : '';
          showToast(`${ti('settings.helperUpdateCheckFailed', 'Failed to check helper updates')}${detail}`, 'error');
        } else if (result.updateAvailable) {
          const targetVersion = normalizeVersionForDisplay(result.targetVersion || result.onlineVersion || '');
          showToast(
            targetVersion
              ? `${ti('settings.helperUpdateFound', 'Helper update available')}: v${targetVersion}`
              : ti('settings.helperUpdateFound', 'Helper update available'),
            'info'
          );
        } else if (String(result.targetVersion || '').trim()) {
          const installedVersion = normalizeVersionForDisplay(result.installedVersion || '');
          const targetVersion = normalizeVersionForDisplay(result.targetVersion || '');
          if (installedVersion) {
            showToast(ti('settings.helperAlreadyLatest', 'Helper is up to date.'), 'info');
          } else {
            showToast(`${ti('settings.helperLatestVersion', 'Latest helper version')}: v${targetVersion}`, 'info');
          }
        } else {
          showToast(ti('settings.helperAlreadyLatest', 'Helper is up to date.'), 'info');
        }
      } catch (err) {
        const detail = err && err.message ? `: ${String(err.message)}` : '';
        showToast(`${ti('settings.helperUpdateCheckFailed', 'Failed to check helper updates')}${detail}`, 'error');
      } finally {
        await refreshHelperPanel(true);
        helperCheckUpdateBtn.disabled = false;
      }
    });
  }
}

if (helperLogsOpenBtn) {
  if (helperLogsOpenBtn.dataset.bound !== 'true') {
    helperLogsOpenBtn.dataset.bound = 'true';
    helperLogsOpenBtn.addEventListener('click', async () => {
      try {
        const response = await openHelperLogsWithFallback(DEFAULT_HELPER_LOG_PATH);
        if (!response || !response.ok) {
          console.warn('[helper] open logs failed');
        }
      } catch (err) {
        console.warn('[helper] open logs failed:', err);
        try {
          await openPath(DEFAULT_HELPER_LOG_PATH);
        } catch {
          // ignore
        }
      }
    });
  }
}

if (helpCheckAppUpdateBtn && helpCheckAppUpdateBtn.dataset.bound !== 'true') {
  helpCheckAppUpdateBtn.dataset.bound = 'true';
  helpCheckAppUpdateBtn.addEventListener('click', async () => {
    await handleHelpAppUpdateCheck();
  });
}

if (helpCheckKernelUpdateBtn && helpCheckKernelUpdateBtn.dataset.bound !== 'true') {
  helpCheckKernelUpdateBtn.dataset.bound = 'true';
  helpCheckKernelUpdateBtn.addEventListener('click', async () => {
    await handleHelpKernelUpdateCheck();
  });
}

if (helpCheckHelperUpdateBtn && helpCheckHelperUpdateBtn.dataset.bound !== 'true') {
  helpCheckHelperUpdateBtn.dataset.bound = 'true';
  helpCheckHelperUpdateBtn.addEventListener('click', async () => {
    await handleHelpHelperUpdateCheck();
  });
}

if (helperLogsRevealBtn) {
  if (helperLogsRevealBtn.dataset.bound !== 'true') {
    helperLogsRevealBtn.dataset.bound = 'true';
    helperLogsRevealBtn.addEventListener('click', async () => {
      const logPath = helperLogsPath ? helperLogsPath.textContent.trim() : '';
      if (!logPath || logPath === '-') {
        return;
      }
      await revealInFinder(logPath);
    });
  }
}

if (installBtn) {
  installBtn.addEventListener('click', async () => {
    setInstallState('loading');
    const args = ['--github-user', githubUser ? githubUser.value : 'vernesong'];
    if (githubUser && githubUser.value === 'MetaCubeX' && installVersion && installVersion.value.trim()) {
      args.push('--version', installVersion.value.trim());
    }
    await maybeNotifyHelperAuthFallback('install');
    const response = await runCommandWithSudo('install', args);
    if (response.ok) {
      setInstallState('success');
      showNoticePop(`${t('labels.installSuccess')} ${t('labels.installConfigHint')}`, 'success');
      loadKernels();
      loadStatus();
      refreshKernelUpdateNotice(true);
      setTimeout(() => {
        if (state.installState === 'success') {
          setInstallState('idle');
        }
      }, 1200);
    } else if (response.error === 'cancelled') {
        setInstallState('idle');
        showToast(t('install.cancelSuccess'), 'info');
      } else {
      setInstallState('error', response.error || '');
    }
  });
}

// 添加取消按钮事件监听
if (cancelInstallBtn) {
  cancelInstallBtn.addEventListener('click', async () => {
    const response = await cancelCommand();
    if (response.ok) {
      setInstallState('idle');
      showToast(t('install.cancelSuccess'), 'info');
    } else {
      showToast(response.message || t('install.cancelFailed'), 'error');
    }
  });
}

if (settingsGithubUser) {
  settingsGithubUser.addEventListener('change', (event) => {
    const value = event.target.value;
    const normalized = normalizeKernelSource(value) || 'vernesong';
    if (githubUser) {
      githubUser.value = normalized;
    }
    state.githubSourceManualOverride = true;
    updateInstallVersionVisibility();
    saveSettings({ githubUser: normalized });
    state.kernelUpdateCheckedAt = 0;
    state.kernelUpdateInfo = {
      ok: false,
      status: 'checking',
      source: normalized,
    };
    applyKernelUpdateInstallHint();
    if (state.installState !== 'loading') {
      setInstallState('idle');
    }
    if (currentPage === 'kernel') {
      refreshKernelUpdateNotice(true);
    }
  });
}

if (githubUser) {
  githubUser.addEventListener('change', (event) => {
    const value = event.target.value;
    const normalized = normalizeKernelSource(value) || 'vernesong';
    githubUser.value = normalized;
    state.githubSourceManualOverride = true;
    updateInstallVersionVisibility();
    state.kernelUpdateCheckedAt = 0;
    state.kernelUpdateInfo = {
      ok: false,
      status: 'checking',
      source: normalized,
    };
    applyKernelUpdateInstallHint();
    if (state.installState !== 'loading') {
      setInstallState('idle');
    }
    if (currentPage === 'kernel') {
      refreshKernelUpdateNotice(true);
    }
  });
}

async function handleConfigBrowse() {
  guiLog('config', 'browse requested');
  const result = await window.clashfox.selectConfig();
  if (result.ok) {
    guiLog('config', 'browse completed', { path: result.path || '' });
    configPathInput.value = result.path;
    if (overviewConfigPath) {
      overviewConfigPath.value = result.path;
    }
    if (settingsConfigPath) {
      settingsConfigPath.value = result.path;
    }
    saveSettings({ configPath: result.path });
    showToast(t('labels.configNeedsRestart'));
    renderConfigTable();
    return;
  }
  guiLog('config', 'browse cancelled or failed', {
    error: result && result.error ? result.error : '',
  }, result && result.error && result.error !== 'cancelled' ? 'warn' : 'log');
}

async function handleConfigImport() {
  if (!window.clashfox || typeof window.clashfox.importConfig !== 'function') {
    return;
  }
  guiLog('config', 'import requested');
  const result = await window.clashfox.importConfig();
  if (!result || !result.ok) {
    guiLog('config', 'import failed', {
      error: result && result.error ? result.error : 'import_config_failed',
    }, result && result.error && result.error !== 'cancelled' ? 'warn' : 'log');
    if (result && result.error && result.error !== 'cancelled') {
      showToast(`${t('labels.configImportFailed')}: ${result.error}`, 'error');
    }
    return;
  }
  const fileName = result.data && result.data.fileName ? result.data.fileName : '';
  guiLog('config', 'import completed', { fileName });
  if (fileName) {
    showToast(`${t('labels.configImported')}: ${fileName}`, 'info');
  } else {
    showToast(t('labels.configImported'), 'info');
  }
  await loadConfigs(true);
}

async function handleConfigDelete(targetPath, configName = '') {
  if (!targetPath || !window.clashfox || typeof window.clashfox.deleteConfig !== 'function') {
    return;
  }
  guiLog('config', 'delete requested', {
    targetPath,
    configName,
  });
  const confirmed = await promptConfirm({
    title: ti('confirm.deleteConfigTitle', 'Delete Config?'),
    body: `${ti('confirm.deleteConfigBody', 'This will permanently delete the selected config file.')} ${configName || ''}`.trim(),
    confirmLabel: ti('confirm.deleteConfirm', 'Delete'),
    confirmTone: 'danger',
  });
  if (!confirmed) {
    guiLog('config', 'delete cancelled', { targetPath });
    return;
  }
  const response = await window.clashfox.deleteConfig(targetPath);
  if (response && response.ok) {
    guiLog('config', 'delete completed', { targetPath });
    showToast(ti('labels.configDeleteSuccess', 'Config deleted.'));
    await loadConfigs();
    return;
  }
  if (response && response.error === 'current_config') {
    guiLog('config', 'delete rejected', {
      targetPath,
      error: response.error,
    }, 'warn');
    showToast(ti('labels.configDeleteCurrent', 'Cannot delete current config.'), 'error');
    return;
  }
  guiLog('config', 'delete failed', {
    targetPath,
    error: response && response.error ? response.error : 'delete_config_failed',
  }, 'warn');
  showToast(`${ti('labels.configDeleteFailed', 'Delete config failed')}: ${response && response.error ? response.error : ''}`.trim(), 'error');
}

async function handleDirectoryBrowse(title) {
  if (!window.clashfox || typeof window.clashfox.selectDirectory !== 'function') {
    return { ok: false };
  }
  return window.clashfox.selectDirectory(title);
}

function refreshPathDependentViews() {
  loadStatus();
  loadConfigs();
  loadKernels();
  loadBackups();
  loadLogs();
  if (currentPage === 'kernel') {
    refreshKernelUpdateNotice(true);
  }
}

async function resetConfigPath() {
  const ok = await promptConfirm({
    title: t('confirm.resetTitle'),
    body: `${t('confirm.resetBody')} ${t('control.config')}`,
    confirmLabel: t('confirm.resetConfirm'),
    confirmTone: 'primary',
  });
  if (!ok) {
    return;
  }
  if (configPathInput) {
    configPathInput.value = '';
  }
  if (overviewConfigPath) {
    overviewConfigPath.value = '';
  }
  if (settingsConfigPath) {
    settingsConfigPath.value = '';
  }
  saveSettings({ configPath: '' });
  showToast(t('labels.configNeedsRestart'));
  renderConfigTable();
}

async function resetPathSetting(key, label) {
  const ok = await promptConfirm({
    title: t('confirm.resetTitle'),
    body: `${t('confirm.resetBody')} ${label}`,
    confirmLabel: t('confirm.resetConfirm'),
    confirmTone: 'primary',
  });
  if (!ok) {
    return;
  }
  if (key === 'configDir' && settingsConfigDir) {
    settingsConfigDir.value = '';
  }
  if (key === 'coreDir' && settingsCoreDir) {
    settingsCoreDir.value = '';
  }
  if (key === 'dataDir' && settingsDataDir) {
    settingsDataDir.value = '';
  }
  saveSettings({ [key]: '' });
  refreshPathDependentViews();
}

if (browseConfigBtn) {
  browseConfigBtn.addEventListener('click', handleConfigBrowse);
}
if (overviewBrowseConfig) {
  overviewBrowseConfig.addEventListener('click', handleConfigBrowse);
}
if (overviewConfigReset) {
  overviewConfigReset.addEventListener('click', () => {
    resetConfigPath();
  });
}

if (kernelRefresh) {
  kernelRefresh.addEventListener('click', () => {
    loadKernels();
  });
}

if (kernelTable) {
  kernelTable.addEventListener('click', async (event) => {
    const switchTarget = event.target.closest('.kernel-switch-action');
    if (switchTarget) {
      const index = switchTarget.dataset.switchIndex || '';
      await switchKernelByIndex(index);
      return;
    }
    const deleteTarget = event.target.closest('.kernel-delete-action');
    if (deleteTarget) {
      const path = deleteTarget.getAttribute('data-delete-path') || '';
      const name = deleteTarget.getAttribute('data-delete-name') || '';
      await deleteKernelBackupByPath(path, name);
    }
  });
}

if (kernelPrev) {
  kernelPrev.addEventListener('click', () => {
    state.kernelsPage = Math.max(1, state.kernelsPage - 1);
    renderKernelTable();
  });
}
if (kernelNext) {
  kernelNext.addEventListener('click', () => {
    state.kernelsPage += 1;
    renderKernelTable();
  });
}
if (kernelPageSize) {
  kernelPageSize.addEventListener('change', () => {
    state.kernelPageSizeLocal = kernelPageSize.value;
    state.kernelsPage = 1;
    renderKernelTable();
  });
}
if (switchPageSize) {
  switchPageSize.addEventListener('change', () => {
    state.switchPageSizeLocal = switchPageSize.value;
    state.switchPage = 1;
    renderSwitchTable();
  });
}

if (settingsConfigPath) {
  settingsConfigPath.addEventListener('change', (event) => {
    const value = event.target.value.trim();
    if (configPathInput) {
      configPathInput.value = value;
    }
    if (overviewConfigPath) {
      overviewConfigPath.value = value;
    }
    saveSettings({ configPath: value });
    renderConfigTable();
  });
}

if (configPathInput) {
  configPathInput.addEventListener('change', (event) => {
    const value = event.target.value.trim();
    if (overviewConfigPath) {
      overviewConfigPath.value = value;
    }
    if (settingsConfigPath) {
      settingsConfigPath.value = value;
    }
    saveSettings({ configPath: value });
    renderConfigTable();
  });
}

if (panelSelect) {
  panelSelect.addEventListener('change', async (event) => {
    const value = event.target.value || '';
    if (!value) {
      return;
    }
    const currentChoice = (state.settings && state.settings.panelChoice) || 'zashboard';
    if (value !== currentChoice) {
      const confirmed = await promptConfirm({
        title: t('confirm.panelTitle'),
        body: t('confirm.panelBody'),
        confirmLabel: t('confirm.panelConfirm'),
        confirmTone: 'primary',
      });
      if (!confirmed) {
        panelSelect.value = currentChoice;
        return;
      }
    }
    const preset = PANEL_PRESETS[value];
    if (!preset) {
      return;
    }
    updateExternalUiUrlField();
    if (settingsExternalUiUrl) {
      const urlVal = settingsExternalUiUrl.value || '';
      if (urlVal && state.settings.externalUiUrl !== urlVal) {
        saveSettings({ externalUiUrl: urlVal });
      }
    }
    state.panelInstallRequested = true;
    showToast(t('labels.panelSwitchHint'), 'info');
    saveSettings({ panelChoice: value });
    updateDashboardFrameSrc();
    const response = await ensurePanelInstalledAndActivated(preset);
    if (response.ok) {
      if (state.panelInstallRequested && response.installed) {
        showToast(t('labels.panelInstalled'));
      }
      state.panelInstallRequested = false;
      return;
    }
    let errorMsg = t('labels.panelInstallFailed');
    if (response.error) {
      errorMsg = `${errorMsg} (${response.error})`;
      if (response.error === 'empty_output' && response.details) {
        errorMsg = `${errorMsg}: ${response.details}`;
      }
    }
    if (state.panelInstallRequested) {
      showToast(errorMsg, 'error');
    }
    state.panelInstallRequested = false;
  });
}
if (externalControllerInput) {
  externalControllerInput.addEventListener('change', (event) => {
    saveSettings({ externalController: event.target.value.trim() });
  });
}
if (externalSecretInput) {
  externalSecretInput.addEventListener('change', (event) => {
    saveSettings({ secret: event.target.value.trim() });
  });
}
if (externalAuthInput) {
  externalAuthInput.addEventListener('change', (event) => {
    saveSettings({ authentication: parseAuthList(event.target.value) });
  });
}

if (settingsBrowseConfig) {
  settingsBrowseConfig.addEventListener('click', () => {
    if (browseConfigBtn) {
      browseConfigBtn.click();
    }
  });
}

// 统一的核心操作处理函数
async function handleCoreAction(action, button) {
  guiLog('core-action', 'requested', {
    action,
    button: button && button.id ? button.id : '',
  });
  // Keep quick actions always responsive.
  setCoreActionState(false);
  const helperStateSnapshot = () => {
    const snapshot = (state.settings && state.settings.helperStatus)
      || (state.fileSettings && state.fileSettings.helperStatus)
      || {};
    return String((snapshot && snapshot.state) || '').trim();
  };
  const helperNotInstalled = () => helperStateSnapshot() === 'not_installed';
  
  try {
    // Always refresh status before making action decisions to avoid stale state.
    const statusResp = await loadStatusSilently();
    if (!statusResp.ok && !state.coreRunning) {
      showToast(statusResp.error || ti('labels.statusError', 'Status error'), 'error');
      return;
    }

    // 检查当前运行状态
    if (action === 'start' && state.coreRunning) {
      showToast(t('labels.alreadyRunning'));
      return;
    }
    
    if (action === 'stop' && !state.coreRunning) {
      showToast(t('labels.alreadyStopped'));
      return;
    }
    
    let command = action;
    if (action === 'restart' && !state.coreRunning) {
      showToast(t('labels.alreadyStopped'));
      return;
    }

    // 准备命令参数
    const args = [];
    if (command === 'start' || command === 'restart') {
      const configPath = getCurrentConfigPath();
      if (configPath) {
        args.push('--config', configPath);
      }
    }
    
    // 执行操作
    const commandStartedAt = Date.now();
    await maybeNotifyHelperAuthFallback(command);
    const response = await runCommandWithSudo(command, args);
    if (response.ok) {
      if (action === 'start') {
        const running = await waitForKernelState(true, 12000, 350);
        if (running) {
          const tunApply = await applyTunSettingsAfterStart();
          state.coreRunningGuardUntil = Date.now() + 10000;
          setQuickActionRunningState(true);
          const startupElapsedMs = Date.now() - commandStartedAt;
          updateCoreStartupEstimate(startupElapsedMs);
          showToast(t('labels.startSuccess'));
          if (!tunApply || !tunApply.ok) {
            const message = (tunApply && tunApply.error) || ti('labels.tunUpdateFailed', 'TUN update failed');
            showToast(message, 'warn');
          }
          guiLog('core-action', 'completed', { action, running: true });
        } else {
          state.coreRunningGuardUntil = 0;
          await loadStatusSilently();
          syncQuickActionButtons();
          if (!helperNotInstalled()) {
            showToast(ti('labels.startFailed', 'Start failed'), 'error');
          }
          guiLog('core-action', 'failed after wait', { action, reason: 'wait_for_running_timeout' }, 'warn');
        }
      } else if (action === 'restart') {
        const running = await waitForKernelState(true, 15000, 400);
        if (running) {
          const tunApply = await applyTunSettingsAfterStart();
          state.coreRunningGuardUntil = Date.now() + 10000;
          setQuickActionRunningState(true);
          const startupElapsedMs = Date.now() - commandStartedAt;
          updateCoreStartupEstimate(startupElapsedMs);
          showToast(t('labels.restartSuccess'));
          if (!tunApply || !tunApply.ok) {
            const message = (tunApply && tunApply.error) || ti('labels.tunUpdateFailed', 'TUN update failed');
            showToast(message, 'warn');
          }
          guiLog('core-action', 'completed', { action, running: true });
        } else {
          state.coreRunningGuardUntil = 0;
          await loadStatusSilently();
          syncQuickActionButtons();
          if (!helperNotInstalled()) {
            showToast(ti('labels.restartFailed', 'Restart failed'), 'error');
          }
          guiLog('core-action', 'failed after wait', { action, reason: 'wait_for_running_timeout' }, 'warn');
        }
      } else {
        const stopped = await waitForKernelState(false, 10000, 300);
        if (stopped) {
          state.coreRunningGuardUntil = 0;
          setQuickActionRunningState(false);
          showToast(t('labels.stopped'));
          guiLog('core-action', 'completed', { action, running: false });
        } else {
          state.coreRunningGuardUntil = 0;
          await loadStatusSilently();
          syncQuickActionButtons();
          showToast(ti('labels.stopFailed', 'Stop failed'), 'error');
          guiLog('core-action', 'failed after wait', { action, reason: 'wait_for_stopped_timeout' }, 'warn');
        }
      }
      loadOverview();
    } else {
      guiLog('core-action', 'command failed', {
        action,
        error: response.error || 'unknown_error',
      }, 'warn');
      state.coreRunningGuardUntil = 0;
      await loadStatusSilently();
      syncQuickActionButtons();
      const message = formatCoreActionError(action, response);
      const helperState = ((state.settings && state.settings.helperStatus) || (state.fileSettings && state.fileSettings.helperStatus) || {}).state || '';
      const helperMissing = String(helperState || '').trim() === 'not_installed';
      showToast(message, helperMissing ? 'info' : 'error');
    }
    
  } catch (error) {
    guiLog('core-action', 'threw', {
      action,
      error: error && error.message ? error.message : String(error || ''),
    }, 'error');
    showToast(error.message || ti('labels.unexpectedError', 'An unexpected error occurred'), 'error');
  } finally {
    setCoreActionState(false);
    // refresh with restart-safe timing to avoid transient false-negative overriding buttons.
    if (action === 'restart') {
      const delay = clamp(Math.round(state.coreStartupEstimateMs * 0.8), 1200, 6000);
      setTimeout(() => loadStatus(), 900);
      setTimeout(() => loadStatus(), delay);
      setTimeout(() => loadStatus(), Math.max(delay + 1200, 2600));
    } else {
      loadStatus();
      setTimeout(() => loadStatus(), 1200);
    }
  }
}

// 使用统一的处理函数
if (startBtn) {
  startBtn.addEventListener('click', () => handleCoreAction('start', startBtn));
}

if (stopBtn) {
  stopBtn.addEventListener('click', () => handleCoreAction('stop', stopBtn));
}

if (restartBtn) {
  restartBtn.addEventListener('click', () => handleCoreAction('restart', restartBtn));
}

if (proxyModeSelect) {
  getProxyModeInputs().forEach((input) => {
    input.addEventListener('change', async () => {
      if (!input.checked) {
        return;
      }
      const value = getProxyModeValue();
      const previous = (state.settings && state.settings.proxy) || 'rule';
      guiLog('proxy-config', 'mode change requested', { value, previous });
      saveSettings({ proxy: value });
      const response = await updateModeViaController(value, getMihomoApiSource());
      if (response.ok) {
        guiLog('proxy-config', 'mode change completed', { value });
        showToast(t('labels.proxyModeUpdated'));
        return;
      }
      guiLog('proxy-config', 'mode change failed', {
        value,
        error: response.error || 'unknown_error',
      }, 'warn');
      setProxyModeValue(previous);
      saveSettings({ proxy: previous });
      const details = response && response.details ? `: ${String(response.details)}` : '';
      const message = response.error === 'controller_missing'
        ? t('labels.controllerMissing')
        : `${ti('labels.modeUpdateFailed', 'Mode update failed')}${details}`;
      showToast(message, 'error');
    });
  });
}

if (tunToggle) {
  tunToggle.addEventListener('change', async () => {
    const enabled = Boolean(tunToggle.checked);
    const previous = !enabled;
    guiLog('proxy-config', 'tun toggle requested', { enabled, previous });
    if (enabled && !previous && window.clashfox && typeof window.clashfox.detectTunConflict === 'function') {
      try {
        const conflictProbe = await window.clashfox.detectTunConflict();
        const conflictLikely = Boolean(conflictProbe && conflictProbe.ok && conflictProbe.data && conflictProbe.data.conflictLikely);
        if (conflictLikely) {
          const proceed = await promptConfirm({
            title: ti('confirm.tunConflictTitle', 'TUN Conflict Detected'),
            body: ti('labels.tunConflictHint', 'TUN conflict detected. Turn off TUN mode in other proxy apps, then try again.'),
            confirmLabel: ti('confirm.tunConflictProceed', 'Continue'),
            confirmTone: 'primary',
          });
          if (!proceed) {
            tunToggle.checked = previous;
            saveSettings({ tun: previous });
            showToast(ti('labels.tunConflictHint', 'TUN conflict detected. Turn off TUN mode in other proxy apps, then try again.'), 'warn');
            return;
          }
        }
      } catch {
        // ignore preflight detection failures
      }
    }
    if (!state.coreRunning) {
      saveSettings({ tun: enabled });
      guiLog('proxy-config', 'tun toggle deferred until next start', { enabled });
      showToast(ti('labels.tunApplyOnStart', 'TUN setting saved, it will be applied on next start.'));
      return;
    }
    const response = await updateTunViaController({ enable: enabled });
    // /configs patch may return OK first, while runtime TUN can fail shortly after.
    // Wait a short window and validate final TUN state before showing success.
    const waitResult = await waitForTunState(enabled, 3000, 350);
    const statusResponse = waitResult && waitResult.status ? waitResult.status : await loadTunStatus(false);
    const actual = tunToggle.checked;
    const statusOk = waitResult && waitResult.ok && statusResponse && statusResponse.ok && statusResponse.data;
    const tunMismatch = Boolean(response && response.ok && response.data && response.data.mismatched === true);
    if (!response.ok || tunMismatch || !statusOk || actual !== enabled) {
      const nextChecked = statusOk ? actual : previous;
      tunToggle.checked = nextChecked;
      saveSettings({ tun: nextChecked });
      const message = formatTunUpdateError(
        response,
        statusResponse,
        !statusOk
          ? ti('labels.tunStatusFailed', 'TUN status unavailable')
          : ti('labels.tunUpdateFailed', 'TUN update failed'),
      );
      const finalMessage = enabled
        ? ti(
          'labels.tunEnableFailedConflictHint',
          'TUN update failed. Turn off TUN mode in other proxy apps, then try again.',
        )
        : message;
      guiLog('proxy-config', 'tun toggle failed', {
        enabled,
        actual,
        error: response && response.error ? response.error : 'tun_update_failed',
      }, 'warn');
      showToast(finalMessage, 'error');
      return;
    }
    saveSettings({ tun: actual });
    guiLog('proxy-config', 'tun toggle completed', { enabled: actual });
    showToast(actual ? t('labels.tunEnabled') : t('labels.tunDisabled'));
  });
}

if (tunStackSelect) {
  tunStackSelect.addEventListener('change', async () => {
    const previous = normalizeTunStack(state.settings && state.settings.stack);
    const value = normalizeTunStack(tunStackSelect.value);
    guiLog('proxy-config', 'tun stack change requested', { value, previous });
    tunStackSelect.value = value;
    if (!state.coreRunning) {
      saveSettings({ stack: value });
      guiLog('proxy-config', 'tun stack deferred until next start', { value });
      showToast(ti('labels.tunApplyOnStart', 'TUN setting saved, it will be applied on next start.'));
      return;
    }
    const response = await updateTunViaController({ stack: value });
    const statusResponse = await loadTunStatus(false);
    const actual = normalizeTunStack(tunStackSelect.value);
    const statusOk = statusResponse && statusResponse.ok && statusResponse.data;
    if (!response.ok || !statusOk || actual !== value) {
      const nextValue = statusOk ? actual : previous;
      tunStackSelect.value = nextValue;
      saveSettings({ stack: nextValue });
      const message = formatTunUpdateError(
        response,
        statusResponse,
        !statusOk
          ? ti('labels.tunStatusFailed', 'TUN status unavailable')
          : ti('labels.tunStackUpdateFailed', 'TUN stack update failed'),
      );
      guiLog('proxy-config', 'tun stack change failed', {
        value,
        actual,
        error: response && response.error ? response.error : 'tun_stack_update_failed',
      }, 'warn');
      showToast(message, 'error');
      return;
    }
    saveSettings({ stack: actual });
    guiLog('proxy-config', 'tun stack change completed', { value: actual });
  });
}

if (configTable) {
  configTable.addEventListener('click', async (event) => {
    const deleteBtn = event.target.closest('button[data-action="delete-config"]');
    if (deleteBtn) {
      event.preventDefault();
      event.stopPropagation();
      const targetPath = deleteBtn.getAttribute('data-path') || '';
      const configName = deleteBtn.getAttribute('data-name') || '';
      await handleConfigDelete(targetPath, configName);
      return;
    }
    const row = event.target.closest('tr[data-path]');
    if (!row) {
      return;
    }
    const path = row.getAttribute('data-path') || '';
    if (!path || path === getCurrentConfigPath()) {
      return;
    }
    guiLog('config', 'switch requested', {
      path,
      currentPath: getCurrentConfigPath(),
    });
    // Avoid radio input switching before user confirms.
    event.preventDefault();
    const confirmed = await promptConfirm({
      title: t('confirm.title'),
      body: t('confirm.body'),
      confirmLabel: t('confirm.confirm'),
      confirmTone: 'primary',
    });
    if (!confirmed) {
      guiLog('config', 'switch cancelled', { path });
      renderConfigTable();
      return;
    }
    saveSettings({ configPath: path });
    guiLog('config', 'switch completed', { path });
    showToast(t('labels.configNeedsRestart'));
    renderConfigTable();
  });
}

if (refreshBackups) {
  refreshBackups.addEventListener('click', () => loadBackups(true));
}
if (backupsRefresh) {
  backupsRefresh.addEventListener('click', () => loadBackups(true));
}
if (configsRefresh) {
  configsRefresh.addEventListener('click', () => {
    guiLog('config', 'refresh requested');
    loadConfigs(true);
  });
}
if (configsImport) {
  configsImport.addEventListener('click', handleConfigImport);
}
if (configPrev) {
  configPrev.addEventListener('click', () => {
    state.configPage = Math.max(1, state.configPage - 1);
    renderConfigTable();
  });
}
if (configNext) {
  configNext.addEventListener('click', () => {
    state.configPage += 1;
    renderConfigTable();
  });
}
if (configPageSize) {
  configPageSize.addEventListener('change', () => {
    state.configPage = 1;
    state.configPageSizeLocal = configPageSize.value;
    renderConfigTable();
  });
}
if (backupTable) {
  backupTable.addEventListener('click', (event) => {
    const row = event.target.closest('.table-row.selectable');
    if (!row) {
      return;
    }
    const index = row.dataset.index;
    backupTable.querySelectorAll('.table-row.selectable').forEach((el) => {
      el.classList.toggle('selected', el.dataset.index === index);
    });
  });
}
if (backupTableFull) {
  backupTableFull.addEventListener('click', (event) => {
    const row = event.target.closest('tr');
    if (!row) {
      return;
    }
    const checkbox = row.querySelector('input[type="checkbox"]');
    if (!checkbox) {
      return;
    }
    if (checkbox.id === 'backupsHeaderSelect') {
      if (event.target.tagName !== 'INPUT') {
        checkbox.checked = !checkbox.checked;
      }
      applySelectAll(checkbox.checked);
      return;
    }
    if (event.target.tagName !== 'INPUT') {
      checkbox.checked = !checkbox.checked;
    }
    if (checkbox.checked) {
      state.selectedBackupPaths.add(checkbox.dataset.path);
    } else {
      state.selectedBackupPaths.delete(checkbox.dataset.path);
    }
    row.classList.toggle('selected', checkbox.checked);
    renderBackupsTable();
  });
}

if (backupTableFull) {
  backupTableFull.addEventListener('change', (event) => {
    if (event.target && event.target.id === 'backupsHeaderSelect') {
      applySelectAll(event.target.checked);
    }
  });
}
if (switchPrev) {
  switchPrev.addEventListener('click', () => {
    state.switchPage = Math.max(1, state.switchPage - 1);
    renderSwitchTable();
  });
}
if (switchNext) {
  switchNext.addEventListener('click', () => {
    state.switchPage += 1;
    renderSwitchTable();
  });
}
if (settingsBackupsPageSize) {
  settingsBackupsPageSize.addEventListener('change', () => {
    if (backupsPageSize) {
      backupsPageSize.value = settingsBackupsPageSize.value;
    }
    state.backupsPageSizeLocal = settingsBackupsPageSize.value;
    state.switchPageSizeLocal = settingsBackupsPageSize.value;
    state.configPageSizeLocal = settingsBackupsPageSize.value;
    state.recommendPageSizeLocal = settingsBackupsPageSize.value;
    state.backupsPage = 1;
    state.switchPage = 1;
    state.configPage = 1;
    state.recommendPage = 1;
    if (switchPageSize) {
      switchPageSize.value = settingsBackupsPageSize.value;
    }
    if (configPageSize) {
      configPageSize.value = settingsBackupsPageSize.value;
    }
    if (recommendPageSize) {
      recommendPageSize.value = settingsBackupsPageSize.value;
    }
    renderBackupsTable();
    renderSwitchTable();
    renderConfigTable();
    renderRecommendTable();
    saveSettings({ generalPageSize: settingsBackupsPageSize.value });
  });
}
if (backupsPrev) {
  backupsPrev.addEventListener('click', () => {
    state.backupsPage = Math.max(1, state.backupsPage - 1);
    renderBackupsTable();
  });
}
if (backupsNext) {
  backupsNext.addEventListener('click', () => {
    state.backupsPage += 1;
    renderBackupsTable();
  });
}
if (backupsPageSize) {
  backupsPageSize.addEventListener('change', () => {
    state.backupsPageSizeLocal = backupsPageSize.value;
    state.switchPageSizeLocal = backupsPageSize.value;
    state.configPageSizeLocal = backupsPageSize.value;
    state.recommendPageSizeLocal = backupsPageSize.value;
    state.backupsPage = 1;
    state.switchPage = 1;
    state.configPage = 1;
    state.recommendPage = 1;
    if (settingsBackupsPageSize) {
      settingsBackupsPageSize.value = backupsPageSize.value;
    }
    if (switchPageSize) {
      switchPageSize.value = backupsPageSize.value;
    }
    if (configPageSize) {
      configPageSize.value = backupsPageSize.value;
    }
    if (recommendPageSize) {
      recommendPageSize.value = backupsPageSize.value;
    }
    renderBackupsTable();
    renderSwitchTable();
    renderConfigTable();
    renderRecommendTable();
    saveSettings({ generalPageSize: backupsPageSize.value });
  });
}

if (recommendPrev) {
  recommendPrev.addEventListener('click', () => {
    state.recommendPage = Math.max(1, state.recommendPage - 1);
    renderRecommendTable();
  });
}
if (recommendNext) {
  recommendNext.addEventListener('click', () => {
    state.recommendPage += 1;
    renderRecommendTable();
  });
}
if (recommendPageSize) {
  recommendPageSize.addEventListener('change', () => {
    state.recommendPage = 1;
    state.recommendPageSizeLocal = recommendPageSize.value;
    renderRecommendTable();
  });
}

function applySelectAll(checked) {
  if (checked) {
    state.lastBackups.forEach((item) => {
      state.selectedBackupPaths.add(item.path);
    });
  } else {
    state.selectedBackupPaths.clear();
  }
  renderBackupsTable();
}

if (backupsDelete) {
  backupsDelete.addEventListener('click', async () => {
    if (state.selectedBackupPaths.size === 0) {
      showToast(t('labels.deleteEmpty'), 'error');
      return;
    }
    const confirmed = await promptConfirm({
      title: t('confirm.deleteTitle'),
      body: t('confirm.deleteBody'),
      confirmLabel: t('confirm.deleteConfirm'),
      confirmTone: 'danger',
    });
    if (!confirmed) {
      return;
    }
    const args = [];
    state.selectedBackupPaths.forEach((path) => {
      args.push('--path', path);
    });
    const response = await runCommandWithSudo('delete-backups', args);
    if (response.ok) {
      showToast(t('labels.deleteSuccess'));
      loadBackups();
    } else {
      showToast(response.error || ti('labels.deleteFailed', 'Delete failed'), 'error');
    }
  });
}

if (switchBtn) {
  switchBtn.addEventListener('click', async () => {
    const index = getSelectedBackupIndex();
    guiLog('kernel', 'switch backup requested', { index: index || '' });
    await switchKernelByIndex(index);
  });
}

if (logRefresh) {
  logRefresh.addEventListener('click', loadLogs);
}
if (logAutoRefresh) {
  logAutoRefresh.addEventListener('change', (event) => {
    setLogAutoRefresh(event.target.checked);
  });
}
if (logIntervalPreset) {
  logIntervalPreset.addEventListener('change', () => {
    updateInterval();
  });
}

if (logLines) {
  logLines.addEventListener('change', (event) => {
    const value = Number.parseInt(event.target.value, 10) || 10;
    if (logLines) {
      logLines.value = value;
    }
  });
}

if (logLevelFilter) {
  logLevelFilter.addEventListener('change', () => {
    if (currentPage === 'logs') {
      state.logEntries = [];
      renderLogTable();
      closeMihomoPageLogsSocket();
      connectMihomoPageLogsStream();
      return;
    }
    renderLogTable();
  });
}

if (logMessageFilter) {
  logMessageFilter.addEventListener('input', () => {
    renderLogTable();
  });
}

if (cleanBtn) {
  cleanBtn.addEventListener('click', async () => {
    const confirmed = await promptConfirm({
      title: ti('clean.confirmTitle', t('confirm.title')),
      body: ti('clean.confirmBody', t('confirm.body')),
      confirmLabel: ti('clean.confirmAction', ti('clean.action', 'Clean Logs')),
      confirmTone: 'danger',
    });
    if (!confirmed) {
      return;
    }

    const mode = cleanModeSelect ? String(cleanModeSelect.value || 'all') : 'all';
    const response = await runCommand('clean', ['--mode', mode]);
    if (response.ok) {
      showToast(t('labels.cleanDone'));
    } else {
      showToast(response.error || ti('labels.cleanFailed', 'Clean failed'), 'error');
    }
  });
}

if (openAppLogBtn) {
  openAppLogBtn.addEventListener('click', async () => {
    const response = await openPath(getAppLogFilePath());
    if (!response || !response.ok) {
      showToast(ti('labels.openLogFailed', 'Open log failed'), 'error');
    }
  });
}


if (overviewNetworkRefresh) {
  overviewNetworkRefresh.addEventListener('click', async () => {
    overviewNetworkRefresh.classList.add('is-loading');
    await loadOverview(true);
    setTimeout(() => overviewNetworkRefresh.classList.remove('is-loading'), 400);
  });
}
if (overviewRulesSwitch && overviewRulesSwitch.dataset.bound !== 'true') {
  overviewRulesSwitch.dataset.bound = 'true';
  overviewRulesSwitch.addEventListener('click', (event) => {
    const button = event.target.closest('[data-rules-view]');
    if (!button) {
      return;
    }
    const view = String(button.dataset.rulesView || '').trim();
    if (view !== 'rules' && view !== 'providers') {
      return;
    }
    state.rulesOverviewView = view;
    renderRulesOverviewCard();
  });
}
}

function startOverviewTimer() {
  if (state.coreStatusTimer) {
    clearInterval(state.coreStatusTimer);
  }
  state.coreStatusTimer = setInterval(() => {
    if (currentPage === 'overview') {
      loadStatusSilently();
    }
  }, 4000);

  if (state.overviewTimer) {
    clearInterval(state.overviewTimer);
  }
  state.overviewTimer = setInterval(() => {
    if (currentPage === 'overview') {
      loadOverview();
    }
  }, 8000);

  if (state.trafficTimer) {
    clearInterval(state.trafficTimer);
  }
  state.trafficTimer = null;

  if (state.overviewLiteTimer) {
    clearInterval(state.overviewLiteTimer);
  }
  state.overviewLiteTimer = null;

  if (state.overviewMemoryTimer) {
    clearInterval(state.overviewMemoryTimer);
  }
  state.overviewMemoryTimer = null;

  if (state.overviewTickTimer) {
    clearInterval(state.overviewTickTimer);
  }
  state.overviewTickTimer = setInterval(() => {
    if (!state.overviewRunning || !state.overviewUptimeAt || !overviewUptime) {
      return;
    }
    const elapsedSec = Math.max(0, Math.floor((Date.now() - state.overviewUptimeAt) / 1000));
    setNodeTextIfChanged(overviewUptime, formatUptime(state.overviewUptimeBaseSec + elapsedSec));
  }, 1000);

  if (state.providerSubscriptionTimer) {
    clearInterval(state.providerSubscriptionTimer);
  }
  if (currentPage === 'overview') {
    loadProviderSubscriptionOverview();
  }
  state.providerSubscriptionTimer = setInterval(() => {
    if (currentPage === 'overview') {
      loadProviderSubscriptionOverview();
    }
  }, 15000);

  if (state.rulesOverviewTimer) {
    clearInterval(state.rulesOverviewTimer);
  }
  if (currentPage === 'overview') {
    loadRulesOverviewCard();
  }
  state.rulesOverviewTimer = setInterval(() => {
    if (currentPage === 'overview') {
      loadRulesOverviewCard();
    }
  }, 20000);
}

function bridgeReady() {
  return Boolean(window.clashfox && typeof window.clashfox.runCommand === 'function');
}

function waitForBridge(timeoutMs = 5000) {
  if (bridgeReady()) {
    return Promise.resolve(true);
  }
  return new Promise((resolve) => {
    const start = Date.now();
    const timer = setInterval(() => {
      if (bridgeReady()) {
        clearInterval(timer);
        resolve(true);
        return;
      }
      if (Date.now() - start >= timeoutMs) {
        clearInterval(timer);
        resolve(false);
      }
    }, 200);
  });
}

function showDashboardAlert() {
  if (state.dashboardAlerted) {
    return;
  }
  state.dashboardAlerted = true;
  showToast(t('dashboard.hint'), 'info');
}

function updateExternalUiUrlField() {
  if (!settingsExternalUiUrl) {
    return;
  }
  const choice = getSelectedPanelName();
  const preset = PANEL_PRESETS && PANEL_PRESETS[choice];
  let url = PANEL_EXTERNAL_UI_URLS[choice] || '';
  if (!url && preset) {
    url = preset['external-ui-url'] || preset.externalUiUrl || preset.url || '';
  }
  settingsExternalUiUrl.value = url || '';
}

function getSelectedPanelName() {
  let choice = (panelSelect && panelSelect.value) || (state.settings && state.settings.panelChoice) || '';
  if (!choice && panelSelect && panelSelect.options && panelSelect.options.length > 0) {
    choice = panelSelect.options[0].value || '';
  }
  if (!choice && PANEL_PRESETS && typeof PANEL_PRESETS === 'object') {
    const keys = Object.keys(PANEL_PRESETS);
    if (keys.length > 0) choice = keys[0];
  }
  return choice || 'zashboard';
}

function updateDashboardFrameSrc() {
  // Dashboard has been replaced by a local panel implementation.
}

async function ensurePanelInstalledAndActivated(preset) {
  if (!preset || !preset.name) {
    return { ok: false, error: 'panel_preset_missing' };
  }
  const activateFirst = await runCommand('panel-activate', ['--name', preset.name]);
  if (activateFirst && activateFirst.ok) {
    return { ok: true, installed: false };
  }
  if (activateFirst && activateFirst.error && activateFirst.error !== 'panel_missing') {
    return activateFirst;
  }
  const install = await runCommand('panel-install', ['--name', preset.name, '--url', preset.url]);
  if (!install || !install.ok) {
    return install || { ok: false, error: 'panel_install_failed' };
  }
  const activateAfter = await runCommand('panel-activate', ['--name', preset.name]);
  if (!activateAfter || !activateAfter.ok) {
    return activateAfter || { ok: false, error: 'panel_activate_failed' };
  }
  return { ok: true, installed: true };
}

async function initDashboardFrame() {
  try {
    if (!dashboardLocalModule) {
      dashboardLocalModule = await import('./dashboard.js');
    }
    if (dashboardLocalModule && typeof dashboardLocalModule.initDashboardPanel === 'function') {
      await dashboardLocalModule.initDashboardPanel();
      state.dashboardAlerted = false;
      state.dashboardLoaded = true;
      return;
    }
  } catch (error) {
    console.warn('[dashboard] init local dashboard failed:', error);
  }
  showDashboardAlert();
  state.dashboardLoaded = false;
}

async function initApp() {
  preventPageReloadShortcuts();
  await loadLayoutParts();
  const targetPage = getPageFromLocation();
  if (targetPage && targetPage !== currentPage) {
    await navigatePage(targetPage, false);
  }
  preloadPageTemplates(targetPage || currentPage).catch(() => {});
  await loadStaticConfigs();
  await syncSettingsFromFile();
  await refreshSystemLocaleFromMain();
  applySettings(readSettings());
  if (state.themeSetting === 'auto' && prefersDarkQuery) {
    applySystemTheme(prefersDarkQuery.matches);
  }
  updateScrollbarWidthVar();
  window.addEventListener('resize', () => {
    updateScrollbarWidthVar();
    applySidebarCollapsedState(Boolean(state.settings && state.settings.sidebarCollapsed), false);
    requestTopNavOverflowSync();
  });
  bindPageEvents();
  renderRecommendTable();
  if (contentRoot && contentRoot.firstElementChild) {
    contentRoot.firstElementChild.classList.add('page-section');
    if (currentPage) {
      savePageTemplateCache(currentPage, contentRoot.firstElementChild.outerHTML || '');
    }
  }
  setActiveNav(currentPage);
  if (currentPage === 'dashboard') {
    initDashboardFrame();
  }
  const ok = await waitForBridge();
  if (!ok) {
    showToast(t('labels.bridgeMissing'), 'error');
    return;
  }
  loadAppInfo(true);
  if (state.settings && state.settings.panelChoice && !state.autoPanelInstalled) {
    const preset = PANEL_PRESETS[state.settings.panelChoice];
    if (preset) {
      state.autoPanelInstalled = true;
      ensurePanelInstalledAndActivated(preset).then((response) => {
        if (response.ok) {
          return;
        }
        if (!response.ok && response.error && response.error !== 'cancelled') {
          const errorMsg = response.error ? `${t('labels.panelInstallFailed')} (${response.error})` : t('labels.panelInstallFailed');
          showToast(errorMsg, 'error');
        }
      });
    }
  }
  loadStatus();
  setTimeout(() => loadStatus(), 1200);
  setTimeout(() => loadStatus(), 4000);
  if (currentPage === 'settings') {
    if (contentRoot) {
      contentRoot.scrollTop = 0;
      if (typeof contentRoot.scrollTo === 'function') {
        contentRoot.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      }
    }
    await invokeHelperPanelRefresh();
  }
  if (currentPage === 'overview') {
    Promise.all([
      loadOverview(),
      loadProviderSubscriptionOverview(),
      loadRulesOverviewCard(),
    ]);
  }
  updateInstallVersionVisibility();
  startOverviewTimer();
  loadConfigs();
  loadKernels();
  loadBackups();
  loadLogs();
}

window.addEventListener('popstate', () => {
  const historyPage = history.state && history.state.page ? String(history.state.page) : '';
  const target = VALID_PAGES.has(historyPage) ? historyPage : getPageFromLocation();
  navigatePage(target, false);
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

// Common entry: load tray i18n first, then main i18n map
import {
  fetchProviderSubscriptionOverview,
  fetchRulesOverviewBundle,
  fetchTunConfigFromController,
  fetchMihomoVersion,
  reloadMihomoConfig,
  reloadMihomoCore,
  resolveMihomoApiSourceFromState,
  resolveMihomoConnectionsWebSocketUrl,
  resolveMihomoLogsWebSocketUrl,
  resolveMihomoMemoryWebSocketUrl,
  resolveMihomoTrafficWebSocketUrl,
  updateAllowLanViaController,
  updateModeViaController,
  updateMihomoConfigViaController,
  updateTunConfigViaController,
} from './mihomo-api.js';
import {
  DEFAULT_HELPER_LOG_PATH,
  buildHelperStatusSnapshot,
  checkHelperUpdates,
  getHelperInstallPath,
  getHelperStatus,
  installHelper,
  openHelperLogsWithFallback,
  openPath,
  readHelperSettings,
  repairHelper,
  revealInFinder,
  runHelperInstallInTerminal,
  uninstallHelper,
} from './helper-api.js';
import '../locales/tray-i18n.js';
import '../locales/i18n.js';
