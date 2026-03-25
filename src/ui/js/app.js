import {SidebarFoxDivider} from '../components/sidebar-fox-divider.js';
import {FOX_RANK_I18N} from '../locales/foxrank-i18n.js';

const appLocaleUtils = globalThis.CLASHFOX_LOCALE_UTILS || {};
const detectSystemLocale = typeof appLocaleUtils.detectSystemLocale === 'function'
  ? appLocaleUtils.detectSystemLocale
  : (() => 'en');
let systemLocaleFromMain = '';

// Default panel presets used before static config loads.
const DEFAULT_PANEL_PRESETS = {
  zashboard: {
    name: 'zashboard',
    displayName: 'Zashboard',
    url: 'https://github.com/Zephyruso/zashboard/releases/latest/download/dist.zip',
    'external-ui-url': 'ui',
  },
  metacubexd: {
    name: 'metacubexd',
    displayName: 'MetaCubeXD',
    url: 'https://github.com/MetaCubeX/metacubexd/releases/latest/download/compressed-dist.tgz',
    'external-ui-url': 'ui',
  },
};

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
let appWindowVisible = !document.hidden;
const VALID_PAGES = new Set(['overview', 'kernel', 'config', 'logs', 'settings', 'help', 'dashboard']);
const FOX_RANK_STORAGE_KEY = 'clashfox-fox-rank-state';
const FOX_RANK_USAGE_RESET_VERSION = '2026-03-16-reset-usage-v1';
const FOX_RANK_EXPLORATION_COOLDOWN_MS = 45000;
const FOX_RANK_STAGE_SUB_LEVELS = 5;
const FOX_RANK_SAMPLING = {
  pollMs: 4000,
  usageMs: 60000,
  qualityMs: 10000,
  qualityHistoryLimit: 90,
};
const FOX_RANK_STAGE_DEFS = [
  { id: 'fox-pup', key: 'stageFoxPup', fallback: '狐幼', colorStart: '#ffd86a', colorEnd: '#ffb347' },
  { id: 'spirit-fox', key: 'stageSpiritFox', fallback: '灵狐', colorStart: '#c685ff', colorEnd: '#8d6dff' },
  { id: 'star-fox', key: 'stageStarFox', fallback: '星狐', colorStart: '#8ac1ff', colorEnd: '#5e9bff' },
  { id: 'guardian', key: 'stageGuardianFox', fallback: '星辰守护者', colorStart: '#f6d365', colorEnd: '#fda085' },
];
const FOX_RANK_TIER_MIN_XP = [
  0, 120, 260, 420, 620,
  860, 1140, 1460, 1820, 2240,
  2720, 3260, 3860, 4520, 5240,
  6020, 6860, 7760, 8720, 9740,
];
const FOX_RANK_TIERS = FOX_RANK_TIER_MIN_XP.map((minXp, index) => {
  const stageIndex = Math.min(
    FOX_RANK_STAGE_DEFS.length - 1,
    Math.floor(index / FOX_RANK_STAGE_SUB_LEVELS),
  );
  const stage = FOX_RANK_STAGE_DEFS[stageIndex] || FOX_RANK_STAGE_DEFS[0];
  const subLevel = (index % FOX_RANK_STAGE_SUB_LEVELS) + 1;
  return {
    minXp,
    stageIndex,
    subLevel,
    stageId: stage.id,
    stageKey: stage.key,
    stageFallback: stage.fallback,
    colorStart: stage.colorStart,
    colorEnd: stage.colorEnd,
  };
});
const FOX_RANK_SKINS = [
  { id: 'campfire', name: 'Campfire', unlockTier: 0, desc: 'Warm amber glow for daily routine.' },
  { id: 'aurora', name: 'Aurora Veil', unlockTier: 5, desc: 'Blue-green ribbons for steady links.' },
  { id: 'starlight', name: 'Starlight Grid', unlockTier: 10, desc: 'Nebula shimmer for long streaks.' },
  { id: 'solar-crown', name: 'Solar Crown', unlockTier: 15, desc: 'Golden crest reserved for Apex Fox.' },
];
const FOX_RANK_SKIN_PALETTES = {
  campfire: { start: '#ffb86c', end: '#ff8f57' },
  aurora: { start: '#7df3d2', end: '#4bc6ff' },
  starlight: { start: '#c685ff', end: '#8d6dff' },
  'solar-crown': { start: '#f6d365', end: '#fda085' },
};

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
let foxRankDetailCard = document.getElementById('foxRankDetailCard');
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
let foxRankImpactToastAt = 0;

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
  if (currentPage !== 'overview' || !isMainWindowVisible()) {
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
  if (currentPage !== 'overview' || !isMainWindowVisible()) {
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
  if (currentPage !== 'overview' || !isMainWindowVisible()) {
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
  renderTopologyCard({ immediate: true, delayMs: 0 });
}

function bindTopologyZoomModal() {
  if (overviewTopologyZoomBtn && overviewTopologyZoomBtn.dataset.bound !== 'true') {
    overviewTopologyZoomBtn.dataset.bound = 'true';
    overviewTopologyZoomBtn.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    overviewTopologyZoomBtn.addEventListener('mousedown', (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    overviewTopologyZoomBtn.addEventListener('dragstart', (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
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
  if (!isMainWindowVisible() || currentPage !== 'overview') {
    return;
  }
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
  if (!isMainWindowVisible()) {
    return;
  }
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
  if (currentPage !== 'overview' || !isMainWindowVisible()) {
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
  if (!isMainWindowVisible() || currentPage !== 'overview') {
    stopTopologyTicker();
    return;
  }
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
  if (currentPage !== 'overview' || !isMainWindowVisible() || typeof WebSocket !== 'function') {
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
  if (currentPage !== 'logs' || !isMainWindowVisible() || typeof WebSocket !== 'function') {
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
  if (currentPage !== 'overview' || !isMainWindowVisible() || typeof WebSocket !== 'function') {
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
  if (currentPage !== 'overview' || !isMainWindowVisible() || typeof WebSocket !== 'function') {
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
  if (currentPage !== 'overview' || !isMainWindowVisible() || typeof WebSocket !== 'function') {
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
  return updateTunConfigViaController(partialTun, getMihomoApiSource(), window.clashfox);
}

function getGuiBridgeSettings() {
  return { ...(state.fileSettings || {}), ...(state.settings || {}) };
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
let kernelSourcePicker = document.getElementById('kernelSourcePicker');
let kernelSourceCards = Array.from(document.querySelectorAll('.kernel-source-card'));
let installBtn = document.getElementById('installBtn');
let updateBtn = document.getElementById('updateBtn');
let installStatus = document.getElementById('installStatus');
let installCurrentKernel = document.getElementById('installCurrentKernel');
let installVersionRow = document.getElementById('installVersionRow');
let installVersionMode = document.getElementById('installVersionMode');
let installVersion = document.getElementById('installVersion');
let installVersionRefreshBtn = document.getElementById('installVersionRefreshBtn');
let installVersionOptionsSignature = '';
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
let panelInstallBtn = document.getElementById('panelInstallBtn');
let panelUpdateBtn = document.getElementById('panelUpdateBtn');
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
let configsReload = document.getElementById('configsReload');
let configTable = document.getElementById('configTable');
let configPrev = document.getElementById('configPrev');
let configNext = document.getElementById('configNext');
let configPageInfo = document.getElementById('configPageInfo');
let configPageSize = document.getElementById('configPageSize');
let kernelTable = document.getElementById('kernelTable');
let kernelRefresh = document.getElementById('kernelRefresh');
let kernelRestart = document.getElementById('kernelRestart');
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
let updateGuidePrimaryBtn = document.getElementById('updateGuidePrimaryBtn');
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
let settingsHelperDir = document.getElementById('settingsHelperDir');
let settingsLogDir = document.getElementById('settingsLogDir');
let settingsConfigDirReveal = document.getElementById('settingsConfigDirReveal');
let settingsCoreDirReveal = document.getElementById('settingsCoreDirReveal');
let settingsDataDirReveal = document.getElementById('settingsDataDirReveal');
let settingsHelperDirReveal = document.getElementById('settingsHelperDirReveal');
let settingsLogDirReveal = document.getElementById('settingsLogDirReveal');
let helperInstallBtn = document.getElementById('helperInstallBtn');
let helperUninstallBtn = document.getElementById('helperUninstallBtn');
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
let settingsTrayMenuPanel = document.getElementById('settingsTrayMenuPanel');
let settingsTrayMenuDashboard = document.getElementById('settingsTrayMenuDashboard');
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

const SETTINGS_KEY = 'clashfox-settings';
const METACUBEX_CATALOG_CACHE_KEY = 'clashfox-metacubex-version-catalog-v1';
const METACUBEX_CATALOG_CACHE_MAX_AGE_MS = 30 * 60 * 1000;
const MAIN_WINDOW_DEFAULT_WIDTH = 980;
const MAIN_WINDOW_DEFAULT_HEIGHT = 640;
const MAIN_WINDOW_MIN_WIDTH = 980;
const MAIN_WINDOW_MIN_HEIGHT = 640;
const MAIN_WINDOW_MAX_WIDTH = 4096;
const MAIN_WINDOW_MAX_HEIGHT = 2160;
const APP_RELEASES_URL = 'https://github.com/lukuochiang/ClashFox/releases';
let DEFAULT_SETTINGS = {};

let PANEL_PRESETS = { ...DEFAULT_PANEL_PRESETS };
let RECOMMENDED_CONFIGS = [];

const STATIC_CONFIGS_URL = new URL('../../../static/configs.json', window.location.href);
const STATIC_DEFAULT_SETTINGS_URL = new URL('../../../static/default-settings.json', window.location.href);
let PANEL_EXTERNAL_UI_URLS = Object.fromEntries(
  Object.entries(PANEL_PRESETS).map(([key, preset]) => [key, preset['external-ui-url'] || preset.externalUiUrl || preset.url || '']),
);

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
  panelActionPending: false,
  helperAuthFallbackHintShown: false,
  kernelUpdateInfo: null,
  kernelUpdateCache: null,
  kernelUpdateChecking: false,
  kernelUpdatePendingRefresh: false,
  kernelUpdateCheckedAt: 0,
  kernelUpdateNotifiedVersion: '',
  kernelUpdateRequestSeq: 0,
  githubSourceManualOverride: false,
  metaCubeXVersionCatalog: null,
  metaCubeXVersionCatalogLoaded: false,
  metaCubeXVersionCatalogLoading: false,
  metaCubeXVersionCatalogPromise: null,
  metaCubeXCatalogErrorNotifiedAt: 0,
  metaCubeXCatalogLastLoadFailed: false,
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
  foxRankTimer: null,
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
  // JS-based uptime tracking: start timestamp for current session
  mihomoStartTime: null,
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

let kernelUpdateCacheStore = {};

function readKernelUpdateCacheStore() {
  return kernelUpdateCacheStore || {};
}

function writeKernelUpdateCacheStore(store = {}) {
  kernelUpdateCacheStore = store && typeof store === 'object' ? { ...store } : {};
  return kernelUpdateCacheStore;
}

function buildKernelUpdateCacheKey(source = '', currentVersion = '') {
  return `${String(source || '').trim().toLowerCase()}::${String(currentVersion || '').trim()}`;
}

function getCachedKernelUpdateResult(source = '', currentVersion = '') {
  const store = readKernelUpdateCacheStore();
  const key = buildKernelUpdateCacheKey(source, currentVersion);
  return store && typeof store === 'object' ? store[key] || null : null;
}

function setCachedKernelUpdateResult(source = '', currentVersion = '', result = null) {
  const store = readKernelUpdateCacheStore();
  const key = buildKernelUpdateCacheKey(source, currentVersion);
  store[key] = result;
  writeKernelUpdateCacheStore(store);
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
  if (systemLocaleFromMain) {
    if (forceApply && state.lang === 'auto') {
      applyI18n();
    }
    return false;
  }
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
    }
    return changed;
  } catch {
    return false;
  }
}

function refreshLocalizedVisibleContent() {
  if (currentPage === 'overview') {
    renderProviderSubscriptionOverview();
    renderRulesOverviewCard();
    return;
  }
  if (currentPage === 'kernel') {
    renderKernelTable();
    renderSwitchTable();
    renderBackupsTable();
    renderRecommendTable();
    return;
  }
  if (currentPage === 'settings') {
    renderConfigTable();
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
  updateInstallVersionModeOptionText();
  setInstallState(state.installState);
  refreshLocalizedVisibleContent();
  refreshCustomSelects();
  requestTopNavOverflowSync();
}

function closeActiveCustomSelect() {
  if (!activeCustomSelectEntry) {
    return;
  }
  const { wrapper, menu, trigger } = activeCustomSelectEntry;
  if (wrapper && menu && menu.parentNode !== wrapper) {
    wrapper.appendChild(menu);
  }
  if (wrapper) {
    wrapper.style.zIndex = '';
  }
  menu.classList.remove('is-floating');
  menu.removeAttribute('data-placement');
  menu.style.top = '';
  menu.style.left = '';
  menu.style.width = '';
  menu.style.maxHeight = '';
  menu.style.visibility = '';
  activeCustomSelectEntry.wrapper.classList.remove('is-open');
  menu.hidden = true;
  trigger.setAttribute('aria-expanded', 'false');
  activeCustomSelectEntry = null;
}

function positionCustomSelectMenu(entry) {
  if (!entry || !entry.trigger || !entry.menu || entry.menu.hidden) {
    return;
  }
  const overlayRoot = document.getElementById('overlayRoot') || document.body;
  const { wrapper, trigger, menu } = entry;
  if (overlayRoot && menu.parentNode !== overlayRoot) {
    overlayRoot.appendChild(menu);
  }
  menu.classList.add('is-floating');
  menu.style.visibility = 'hidden';
  const triggerRect = trigger.getBoundingClientRect();
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
  const gap = 6;
  const edgePadding = 8;
  const naturalHeight = Math.min(menu.scrollHeight || 0, 260);
  const spaceBelow = Math.max(0, viewportHeight - triggerRect.bottom - edgePadding - gap);
  const spaceAbove = Math.max(0, triggerRect.top - edgePadding - gap);
  const openUpward = spaceBelow < Math.min(180, naturalHeight || 180) && spaceAbove > spaceBelow;
  const maxHeight = Math.max(120, Math.min(260, openUpward ? spaceAbove : spaceBelow));
  const menuHeight = Math.min(Math.max(naturalHeight, 0), maxHeight);
  const rawTop = openUpward
    ? triggerRect.top - gap - menuHeight
    : triggerRect.bottom + gap;
  const top = Math.max(edgePadding, Math.min(rawTop, viewportHeight - edgePadding - menuHeight));
  const width = Math.max(Math.round(triggerRect.width), 80);
  const left = Math.max(edgePadding, Math.min(triggerRect.left, viewportWidth - edgePadding - width));
  menu.dataset.placement = openUpward ? 'top' : 'bottom';
  menu.style.top = `${Math.round(top)}px`;
  menu.style.left = `${Math.round(left)}px`;
  menu.style.width = `${width}px`;
  menu.style.maxHeight = `${Math.round(maxHeight)}px`;
  menu.style.visibility = '';
  if (wrapper) {
    wrapper.style.zIndex = '61';
  }
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
      if (target && (activeCustomSelectEntry.wrapper.contains(target) || activeCustomSelectEntry.menu.contains(target))) {
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
    document.addEventListener('scroll', () => {
      if (activeCustomSelectEntry) {
        positionCustomSelectMenu(activeCustomSelectEntry);
      }
    }, true);
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
      positionCustomSelectMenu(entry);
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
        if (menu.parentNode !== wrapper) {
          wrapper.appendChild(menu);
        }
        menu.classList.remove('is-floating');
        menu.removeAttribute('data-placement');
        menu.style.top = '';
        menu.style.left = '';
        menu.style.width = '';
        menu.style.maxHeight = '';
        menu.style.visibility = '';
        wrapper.classList.remove('is-open');
        wrapper.style.zIndex = '';
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
    if (tname.includes('network history') || tname.includes('network rate') || tname.includes('network speed') || tname.includes('网络速率')) return 'var(--icon-clock)';
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
    if (tname.includes('network history') || tname.includes('network rate') || tname.includes('network speed') || tname.includes('网络速率')) return 'var(--icon-fill-clock)';
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
  const kernelSettingsRaw = normalized.kernel && typeof normalized.kernel === 'object'
    ? normalized.kernel
    : {};
  const { source: _kernelSource, updatedAt: _kernelUpdatedAt, ...kernelSettings } = kernelSettingsRaw;
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
  normalized.foxRankSkin = readAppearanceString('foxRankSkin', '');
  normalized.debugMode = readAppearanceBool('debugMode', false);
  normalized.acceptBeta = readAppearanceBool('acceptBeta', false);
  const kernelGithubUser = String(kernelSettings.githubUser || '').trim();
  const kernelInstallVersionMode = String(kernelSettings.installVersionMode || '').trim();
  const kernelInstallVersion = String(kernelSettings.installVersion || '').trim();
  normalized.githubUser = normalizeKernelSource(kernelGithubUser || readAppearanceString('githubUser', 'vernesong')) || 'vernesong';
  normalized.installVersionMode = normalizeInstallVersionMode(kernelInstallVersionMode || readAppearanceString('installVersionMode', 'latest'));
  normalized.installVersion = kernelInstallVersion || readAppearanceString('installVersion', '');
  normalized.chartEnabled = readTrayMenuBool('chartEnabled', readTrayMenuBool('trayMenuChartEnabled', true));
  normalized.providerTrafficEnabled = readTrayMenuBool('providerTrafficEnabled', readTrayMenuBool('trayMenuProviderTrafficEnabled', true));
  normalized.trackersEnabled = readTrayMenuBool('trackersEnabled', readTrayMenuBool('trayMenuTrackersEnabled', true));
  normalized.foxboardEnabled = readTrayMenuBool('foxboardEnabled', readTrayMenuBool('trayMenuFoxboardEnabled', true));
  normalized.panelEnabled = readTrayMenuBool('panelEnabled', readTrayMenuBool('trayMenuPanelEnabled', false));
  normalized.dashboardEnabled = readTrayMenuBool('dashboardEnabled', readTrayMenuBool('trayMenuDashboardEnabled', true));
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
  const {
    logLines: _appearanceLogLines,
    logAutoRefresh: _appearanceLogAutoRefresh,
    logIntervalPreset: _appearanceLogIntervalPreset,
    githubUser: _appearanceGithubUser,
    installVersionMode: _appearanceInstallVersionMode,
    installVersion: _appearanceInstallVersion,
    ...appearanceRest
  } = appearance;
  normalized.appearance = {
    ...appearanceRest,
    lang: normalized.lang,
    theme: normalized.theme,
    foxRankSkin: normalized.foxRankSkin,
    debugMode: normalized.debugMode,
    acceptBeta: normalized.acceptBeta,
    windowWidth: normalized.windowWidth,
    windowHeight: normalized.windowHeight,
    mainWindowClosed: normalized.mainWindowClosed,
    sidebarCollapsed: normalized.sidebarCollapsed,
    generalPageSize: normalized.generalPageSize,
  };
  normalized.trayMenu = {
    ...trayMenu,
    chartEnabled: normalized.chartEnabled,
    providerTrafficEnabled: normalized.providerTrafficEnabled,
    trackersEnabled: normalized.trackersEnabled,
    foxboardEnabled: normalized.foxboardEnabled,
    panelEnabled: normalized.panelEnabled,
    dashboardEnabled: normalized.dashboardEnabled,
    kernelManagerEnabled: normalized.kernelManagerEnabled,
    directoryLocationsEnabled: normalized.directoryLocationsEnabled,
    copyShellExportCommandEnabled: normalized.copyShellExportCommandEnabled,
  };
  normalized.kernel = {
    ...kernelSettings,
    githubUser: normalized.githubUser,
    installVersionMode: normalized.installVersionMode,
    installVersion: normalized.installVersion,
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
  const proxy = normalized.proxy && typeof normalized.proxy === 'object' ? normalized.proxy : {};
  normalized.proxy = {
    mode: normalizeProxyMode(proxy.mode || normalized.proxy || 'rule'),
    systemProxy: Boolean(normalized.systemProxy ?? proxy.systemProxy),
    tun: Boolean(normalized.tun ?? proxy.tun),
    stack: normalizeTunStack(normalized.stack || proxy.stack || 'Mixed'),
    mixedPort: Number.parseInt(String(normalized.mixedPort ?? proxy.mixedPort ?? ''), 10) || 7893,
    port: Number.parseInt(String(normalized.port ?? proxy.port ?? ''), 10) || 7890,
    socksPort: Number.parseInt(String(normalized.socksPort ?? proxy.socksPort ?? ''), 10) || 7891,
    allowLan: Object.prototype.hasOwnProperty.call(normalized, 'allowLan')
      ? Boolean(normalized.allowLan)
      : Object.prototype.hasOwnProperty.call(proxy, 'allowLan')
      ? Boolean(proxy.allowLan)
      : true,
  };
  LEGACY_PROXY_FIELDS.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(normalized, key)) {
      delete normalized[key];
    }
  });

  const userDataPaths = normalized.userDataPaths && typeof normalized.userDataPaths === 'object'
    ? normalized.userDataPaths
    : {};
  const normalizeConfigFileName = (value = '') => {
    const text = String(value || '').trim().replace(/[\\/]+$/, '');
    if (!text) {
      return '';
    }
    const parts = text.split(/[\\/]/).filter(Boolean);
    return parts.length ? parts[parts.length - 1] : text;
  };
  if (!normalized.configFile && typeof userDataPaths.configFile === 'string') {
    normalized.configFile = normalizeConfigFileName(userDataPaths.configFile);
  }
  if (!normalized.configFile && typeof normalized.configFileDir === 'string') {
    normalized.configFile = normalizeConfigFileName(normalized.configFileDir);
  }
  if (!normalized.configFile && typeof userDataPaths.configFileDir === 'string') {
    normalized.configFile = normalizeConfigFileName(userDataPaths.configFileDir);
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
    normalized.configPath = normalizeConfigFileName(normalized.configFile);
  }
  normalized.backupsPageSize = unifiedPageSize;
  normalized.switchPageSize = unifiedPageSize;
  normalized.configPageSize = unifiedPageSize;
  normalized.recommendPageSize = unifiedPageSize;
  if (Object.prototype.hasOwnProperty.call(normalized, 'configFile')) {
    delete normalized.configFile;
  }
  if (Object.prototype.hasOwnProperty.call(normalized, 'configFileDir')) {
    delete normalized.configFileDir;
  }
  if (Object.prototype.hasOwnProperty.call(normalized, 'foxRank')) {
    delete normalized.foxRank;
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
  const proxy = mapped.proxy && typeof mapped.proxy === 'object' ? mapped.proxy : {};
  mapped.proxy = {
    mode: normalizeProxyMode(proxy.mode || mapped.proxy || 'rule'),
    systemProxy: Boolean(mapped.systemProxy ?? proxy.systemProxy),
    tun: Boolean(mapped.tun ?? proxy.tun),
    stack: normalizeTunStack(mapped.stack || proxy.stack || 'Mixed'),
    mixedPort: Number.parseInt(String(mapped.mixedPort ?? proxy.mixedPort ?? ''), 10) || 7893,
    port: Number.parseInt(String(mapped.port ?? proxy.port ?? ''), 10) || 7890,
    socksPort: Number.parseInt(String(mapped.socksPort ?? proxy.socksPort ?? ''), 10) || 7891,
    allowLan: Object.prototype.hasOwnProperty.call(mapped, 'allowLan')
      ? Boolean(mapped.allowLan)
      : Object.prototype.hasOwnProperty.call(proxy, 'allowLan')
      ? Boolean(proxy.allowLan)
      : true,
  };
  LEGACY_PROXY_FIELDS.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(mapped, key)) {
      delete mapped[key];
    }
  });
  const {
    logLines: _existingLogLines,
    logAutoRefresh: _existingLogAutoRefresh,
    logIntervalPreset: _existingLogIntervalPreset,
    githubUser: _existingAppearanceGithubUser,
    installVersionMode: _existingAppearanceInstallVersionMode,
    installVersion: _existingAppearanceInstallVersion,
    ...existingAppearanceSansLogs
  } = existingAppearance;
  mapped.appearance = {
    ...existingAppearanceSansLogs,
    lang: String(mapped.lang || existingAppearance.lang || 'auto'),
    theme: String(mapped.theme || existingAppearance.theme || 'auto'),
    foxRankSkin: String(
      mapped.foxRankSkin
      || existingAppearance.foxRankSkin
      || ''
    ).trim().toLowerCase(),
    debugMode: Object.prototype.hasOwnProperty.call(mapped, 'debugMode')
      ? Boolean(mapped.debugMode)
      : Boolean(existingAppearance.debugMode),
    acceptBeta: Object.prototype.hasOwnProperty.call(mapped, 'acceptBeta')
      ? Boolean(mapped.acceptBeta)
      : Boolean(existingAppearance.acceptBeta),
    windowWidth: Number.parseInt(String(mapped.windowWidth ?? existingAppearance.windowWidth ?? MAIN_WINDOW_DEFAULT_WIDTH), 10) || MAIN_WINDOW_DEFAULT_WIDTH,
    windowHeight: Number.parseInt(String(mapped.windowHeight ?? existingAppearance.windowHeight ?? MAIN_WINDOW_DEFAULT_HEIGHT), 10) || MAIN_WINDOW_DEFAULT_HEIGHT,
    mainWindowClosed: Object.prototype.hasOwnProperty.call(mapped, 'mainWindowClosed')
      ? Boolean(mapped.mainWindowClosed)
      : Boolean(existingAppearance.mainWindowClosed),
    sidebarCollapsed: Object.prototype.hasOwnProperty.call(mapped, 'sidebarCollapsed')
      ? Boolean(mapped.sidebarCollapsed)
      : Boolean(existingAppearance.sidebarCollapsed),
    generalPageSize: String(
      mapped.generalPageSize
      || existingAppearance.generalPageSize
      || mapped.backupsPageSize
      || mapped.kernelPageSize
      || '10'
    ).trim() || '10',
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
    panelEnabled: Object.prototype.hasOwnProperty.call(mapped, 'panelEnabled')
      ? Boolean(mapped.panelEnabled)
      : (Object.prototype.hasOwnProperty.call(mapped, 'trayMenuPanelEnabled')
        ? Boolean(mapped.trayMenuPanelEnabled)
        : (Object.prototype.hasOwnProperty.call(existingTrayMenu, 'panelEnabled')
          ? Boolean(existingTrayMenu.panelEnabled)
          : (Object.prototype.hasOwnProperty.call(existingTrayMenu, 'trayMenuPanelEnabled')
            ? Boolean(existingTrayMenu.trayMenuPanelEnabled)
            : Boolean(existingAppearance.panelEnabled ?? existingAppearance.trayMenuPanelEnabled)))),
    dashboardEnabled: Object.prototype.hasOwnProperty.call(mapped, 'dashboardEnabled')
      ? Boolean(mapped.dashboardEnabled)
      : (Object.prototype.hasOwnProperty.call(mapped, 'trayMenuDashboardEnabled')
        ? Boolean(mapped.trayMenuDashboardEnabled)
        : (Object.prototype.hasOwnProperty.call(existingTrayMenu, 'dashboardEnabled')
          ? Boolean(existingTrayMenu.dashboardEnabled)
          : (Object.prototype.hasOwnProperty.call(existingTrayMenu, 'trayMenuDashboardEnabled')
            ? Boolean(existingTrayMenu.trayMenuDashboardEnabled)
            : Boolean(existingAppearance.dashboardEnabled ?? existingAppearance.trayMenuDashboardEnabled)))),
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
  const normalizeConfigFileName = (value = '') => {
    const text = String(value || '').trim().replace(/[\\/]+$/, '');
    if (!text) {
      return '';
    }
    const parts = text.split(/[\\/]/).filter(Boolean);
    return parts.length ? parts[parts.length - 1] : text;
  };
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
  const existingKernelRaw = mapped.kernel && typeof mapped.kernel === 'object'
    ? mapped.kernel
    : {};
  const { source: _mappedKernelSource, updatedAt: _mappedKernelUpdatedAt, ...existingKernel } = existingKernelRaw;
  mapped.kernel = {
    ...existingKernel,
    githubUser: normalizeKernelSource(
      String(mapped.githubUser || existingKernel.githubUser || 'vernesong'),
    ) || 'vernesong',
    installVersionMode: normalizeInstallVersionMode(
      mapped.installVersionMode || existingKernel.installVersionMode || 'latest',
    ),
    installVersion: String(mapped.installVersion ?? existingKernel.installVersion ?? '').trim(),
  };
  mapped.userDataPaths = {
    ...existingPaths,
    ...(mapped.configFile ? { configFile: normalizeConfigFileName(mapped.configFile) } : {}),
    ...(mapped.configFileDir ? { configFile: normalizeConfigFileName(mapped.configFileDir) } : {}),
    ...(mapped.configDir ? { configDir: String(mapped.configDir) } : {}),
    ...(mapped.coreDir ? { coreDir: String(mapped.coreDir) } : {}),
    ...(mapped.dataDir ? { dataDir: String(mapped.dataDir) } : {}),
    ...(mapped.logDir ? { logDir: String(mapped.logDir) } : {}),
    ...(mapped.pidDir ? { pidDir: String(mapped.pidDir) } : {}),
  };
  if (typeof mapped.configPath === 'string') {
    mapped.userDataPaths.configFile = normalizeConfigFileName(mapped.configPath);
  }
  if (typeof mapped.configFileDir === 'string' && !mapped.userDataPaths.configFile) {
    mapped.userDataPaths.configFile = normalizeConfigFileName(mapped.configFileDir);
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
  // Kernel metadata remains under mapped.kernel.
  if (Object.prototype.hasOwnProperty.call(mapped, 'kernelVersion')) {
    delete mapped.kernelVersion;
  }
  if (Object.prototype.hasOwnProperty.call(mapped, 'kernelVersionMeta')) {
    delete mapped.kernelVersionMeta;
  }
  if (Object.prototype.hasOwnProperty.call(mapped, 'configPath')) {
    delete mapped.configPath;
  }
  if (Object.prototype.hasOwnProperty.call(mapped, 'configFile')) {
    delete mapped.configFile;
  }
  if (Object.prototype.hasOwnProperty.call(mapped, 'configFileDir')) {
    delete mapped.configFileDir;
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
  if (Object.prototype.hasOwnProperty.call(mapped, 'foxRankSkin')) {
    delete mapped.foxRankSkin;
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
  if (Object.prototype.hasOwnProperty.call(mapped, 'installVersionMode')) {
    delete mapped.installVersionMode;
  }
  if (Object.prototype.hasOwnProperty.call(mapped, 'installVersion')) {
    delete mapped.installVersion;
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
  if (Object.prototype.hasOwnProperty.call(mapped, 'dashboardEnabled')) {
    delete mapped.dashboardEnabled;
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
  if (Object.prototype.hasOwnProperty.call(mapped, 'trayMenuDashboardEnabled')) {
    delete mapped.trayMenuDashboardEnabled;
  }
  if (Object.prototype.hasOwnProperty.call(mapped, 'trayMenuDirectoryLocationsEnabled')) {
    delete mapped.trayMenuDirectoryLocationsEnabled;
  }
  if (Object.prototype.hasOwnProperty.call(mapped, 'panelEnabled')) {
    delete mapped.panelEnabled;
  }
  if (Object.prototype.hasOwnProperty.call(mapped, 'trayMenuPanelEnabled')) {
    delete mapped.trayMenuPanelEnabled;
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
  if (Object.prototype.hasOwnProperty.call(mapped, 'foxRank')) {
    delete mapped.foxRank;
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
      if (!merged.userDataPaths) {
        merged.userDataPaths = {};
      }
      if (state.fileSettings.userDataPaths && typeof state.fileSettings.userDataPaths === 'object') {
        if (!merged.userDataPaths.userAppDataDir && state.fileSettings.userDataPaths.userAppDataDir) {
          merged.userDataPaths.userAppDataDir = state.fileSettings.userDataPaths.userAppDataDir;
        }
        if (!merged.userDataPaths.configFile && state.fileSettings.userDataPaths.configFile) {
          merged.userDataPaths.configFile = state.fileSettings.userDataPaths.configFile;
        }
        if (!merged.userDataPaths.configDir && state.fileSettings.userDataPaths.configDir) {
          merged.userDataPaths.configDir = state.fileSettings.userDataPaths.configDir;
        }
        if (!merged.userDataPaths.coreDir && state.fileSettings.userDataPaths.coreDir) {
          merged.userDataPaths.coreDir = state.fileSettings.userDataPaths.coreDir;
        }
        if (!merged.userDataPaths.dataDir && state.fileSettings.userDataPaths.dataDir) {
          merged.userDataPaths.dataDir = state.fileSettings.userDataPaths.dataDir;
        }
        if (!merged.userDataPaths.logDir && state.fileSettings.userDataPaths.logDir) {
          merged.userDataPaths.logDir = state.fileSettings.userDataPaths.logDir;
        }
        if (!merged.userDataPaths.pidDir && state.fileSettings.userDataPaths.pidDir) {
          merged.userDataPaths.pidDir = state.fileSettings.userDataPaths.pidDir;
        }
      }
    }
    if (merged.userDataPaths && merged.userDataPaths.configFile && (!parsed.userDataPaths || !parsed.userDataPaths.configFile || parsed.userDataPaths.configFile !== merged.userDataPaths.configFile)) {
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
      if (!merged.userDataPaths) {
        merged.userDataPaths = {};
      }
      if (!merged.userDataPaths.configDir) {
        merged.userDataPaths.configDir = 'config';
      }
      if (!merged.userDataPaths.coreDir) {
        merged.userDataPaths.coreDir = 'core';
      }
      if (!merged.userDataPaths.dataDir) {
        merged.userDataPaths.dataDir = 'data';
      }
      if (!merged.userDataPaths.logDir) {
        merged.userDataPaths.logDir = 'logs';
      }
      if (!merged.userDataPaths.helperDir) {
        merged.userDataPaths.helperDir = 'helper';
      }
      if (!merged.userDataPaths.pidDir) {
        merged.userDataPaths.pidDir = 'runtime';
      }
      if (!merged.userDataPaths.userAppDataDir) {
        merged.userDataPaths.userAppDataDir = base;
      }
    }
  }
  state.fileSettings = { ...merged };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
  if (window.clashfox && typeof window.clashfox.writeSettings === 'function') {
    const { externalUiUrl: _externalUiUrl, externalUiName: _externalUiName, ...restSettings } = merged;
    const fileSettings = mapSettingsForFile(restSettings);
    const { externalUiUrl: _currentExternalUiUrl, externalUiName: _currentExternalUiName, ...currentRestSettings } = state.fileSettings || {};
    const currentFileSettings = mapSettingsForFile(currentRestSettings);
    if (JSON.stringify(fileSettings) !== JSON.stringify(currentFileSettings)) {
    window.clashfox.writeSettings(fileSettings);
    }
  }
}

function saveSettings(patch, options = {}) {
  const forceWrite = Boolean(options && options.forceWrite);
  const nextPatch = { ...(patch || {}) };
  const proxyPatchKeys = LEGACY_PROXY_FIELDS;
  const hasProxyPatch = Object.prototype.hasOwnProperty.call(nextPatch, 'proxy')
    || proxyPatchKeys.some((key) => Object.prototype.hasOwnProperty.call(nextPatch, key));
  if (hasProxyPatch) {
    const currentProxy = state.settings && state.settings.proxy && typeof state.settings.proxy === 'object'
      ? state.settings.proxy
      : {};
    const proxyPatch = nextPatch.proxy && typeof nextPatch.proxy === 'object'
      ? nextPatch.proxy
      : (Object.prototype.hasOwnProperty.call(nextPatch, 'proxy') ? { mode: nextPatch.proxy } : {});
    proxyPatchKeys.forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(nextPatch, key)) {
        proxyPatch[key] = nextPatch[key];
        delete nextPatch[key];
      }
    });
    nextPatch.proxy = normalizeProxySettings({
      ...currentProxy,
      ...proxyPatch,
    });
  }
  const nextAppearance = {
    ...((state.settings && state.settings.appearance) || {}),
    ...((state.fileSettings && state.fileSettings.appearance) || {}),
    ...((nextPatch.appearance && typeof nextPatch.appearance === 'object') ? nextPatch.appearance : {}),
  };
  const appearanceKeys = [
    'lang',
    'theme',
    'foxRankSkin',
    'debugMode',
    'acceptBeta',
    'windowWidth',
    'windowHeight',
    'mainWindowClosed',
    'sidebarCollapsed',
    'generalPageSize',
  ];
  appearanceKeys.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(nextPatch, key)) {
      nextAppearance[key] = nextPatch[key];
    }
  });
  if (Object.keys(nextAppearance).length) {
    nextPatch.appearance = nextAppearance;
  }
  const nextKernel = {
    ...((state.settings && state.settings.kernel) || {}),
    ...((state.fileSettings && state.fileSettings.kernel) || {}),
    ...((nextPatch.kernel && typeof nextPatch.kernel === 'object') ? nextPatch.kernel : {}),
  };
  const kernelKeys = [
    'githubUser',
    'installVersionMode',
    'installVersion',
  ];
  kernelKeys.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(nextPatch, key)) {
      nextKernel[key] = nextPatch[key];
    }
  });
  if (Object.keys(nextKernel).length) {
    nextPatch.kernel = nextKernel;
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
    'trayMenuPanelEnabled',
    'trayMenuDashboardEnabled',
    'trayMenuKernelManagerEnabled',
    'trayMenuDirectoryLocationsEnabled',
    'trayMenuCopyShellExportCommandEnabled',
    'chartEnabled',
    'providerTrafficEnabled',
    'trackersEnabled',
    'foxboardEnabled',
    'panelEnabled',
    'dashboardEnabled',
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
  const nextUserDataPaths = {
    ...((state.settings && state.settings.userDataPaths) || {}),
    ...((state.fileSettings && state.fileSettings.userDataPaths) || {}),
    ...((nextPatch.userDataPaths && typeof nextPatch.userDataPaths === 'object') ? nextPatch.userDataPaths : {}),
  };
  const userDataPathKeys = [
    'userAppDataDir',
    'configFile',
    'configDir',
    'coreDir',
    'dataDir',
    'helperDir',
    'logDir',
    'pidDir',
  ];
  userDataPathKeys.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(nextPatch, key)) {
      nextUserDataPaths[key] = nextPatch[key];
    }
  });
  if (Object.keys(nextUserDataPaths).length) {
    nextPatch.userDataPaths = nextUserDataPaths;
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
  const currentSettings = state.settings || {};
  const nextSettings = { ...currentSettings, ...nextPatch };
  LEGACY_PROXY_FIELDS.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(nextSettings, key)) {
      delete nextSettings[key];
    }
  });
  const { externalUiUrl: _currentExternalUiUrl, externalUiName: _currentExternalUiName, ...currentRestSettings } = currentSettings;
  const { externalUiUrl: _nextExternalUiUrl, externalUiName: _nextExternalUiName, ...nextRestSettings } = nextSettings;
  const currentFileSettings = mapSettingsForFile(currentRestSettings);
  const nextFileSettings = mapSettingsForFile(nextRestSettings);
  if (!forceWrite && JSON.stringify(currentFileSettings) === JSON.stringify(nextFileSettings)) {
    state.settings = nextSettings;
    state.fileSettings = { ...state.fileSettings, ...nextPatch };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
    return;
  }
  state.settings = nextSettings;
  state.fileSettings = { ...state.fileSettings, ...nextPatch };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
  if (window.clashfox && typeof window.clashfox.writeSettings === 'function') {
    Promise.resolve(window.clashfox.writeSettings(nextFileSettings, forceWrite ? { forceWrite: true } : {})).catch((error) => {
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
  if (!state.settings) {
    state.settings = { ...DEFAULT_SETTINGS };
  }
  if (!state.settings.appearance) {
    state.settings.appearance = {};
  }
  state.settings.appearance.sidebarCollapsed = Boolean(collapsed);
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
  const cards = Array.from(grid.querySelectorAll('[draggable="true"][data-module]'));
  if (cards.length === 0) {
    return;
  }
  // 如果settings中没有order，使用HTML中定义的默认顺序
  if (order.length === 0) {
    order = cards.map(card => card.dataset.module);
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
  // Respect pre-set position attribute if it exists
  const presetPosition = el.dataset.position;
  if (presetPosition && ['top', 'bottom', 'left', 'right'].includes(presetPosition)) {
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
  applyFoxRankThemeCssVars(null, state.settings || null);
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

const resolveAbsolutePath = (relativePath) => {
  const inputPath = String(relativePath || '').trim();
  if (!inputPath) {
    return '';
  }
  const userDataPaths = state.settings?.userDataPaths || {};
  const userAppDataDir = userDataPaths.userAppDataDir || '';
  if (!userAppDataDir) {
    return inputPath;
  }
  if (inputPath.startsWith('/') || inputPath.startsWith('~') || /^[A-Za-z]:/.test(inputPath)) {
    return inputPath;
  }
  return userAppDataDir.endsWith('/')
      ? `${userAppDataDir}${inputPath}`
      : `${userAppDataDir}/${inputPath}`;
};

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
  const dataDir = state.settings.userDataPaths?.dataDir
    ? resolveAbsolutePath(state.settings.userDataPaths.dataDir)
    : '';
  const externalUi = dataDir
    ? `${dataDir.replace(/\/+$/, '')}/ui`
    : '';
  // temporarily suppress transitions while applying initial theme
  document.body.classList.add('no-theme-transition');
  applyThemePreference(state.settings.theme, false);
  applyFoxRankThemeCssVars(null, state.settings);
  document.body.classList.remove('no-theme-transition');
  setLanguage(state.settings.lang, false, false);
  syncDebugMode(state.settings.debugMode);
  applySidebarCollapsedState(state.settings.appearance && state.settings.appearance.sidebarCollapsed, false);
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
  if (settingsTrayMenuPanel) {
    settingsTrayMenuPanel.checked = state.settings.panelEnabled === true;
  }
  if (settingsTrayMenuDashboard) {
    settingsTrayMenuDashboard.checked = state.settings.dashboardEnabled !== false;
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
    settingsProxyMixedPort.value = Number.parseInt(String(state.settings.proxy?.mixedPort ?? 7893), 10) || 7893;
  }
  if (settingsProxyPort) {
    settingsProxyPort.value = Number.parseInt(String(state.settings.proxy?.port ?? 7890), 10) || 7890;
  }
  if (settingsProxySocksPort) {
    settingsProxySocksPort.value = Number.parseInt(String(state.settings.proxy?.socksPort ?? 7891), 10) || 7891;
  }
  if (settingsProxyAllowLan) {
    settingsProxyAllowLan.checked = Boolean(state.settings.proxy?.allowLan);
  }
  if (settingsConfigDir) {
    settingsConfigDir.value = resolveAbsolutePath(state.settings.userDataPaths?.configDir || '');
  }
  if (settingsCoreDir) {
    settingsCoreDir.value = resolveAbsolutePath(state.settings.userDataPaths?.coreDir || '');
  }
  if (settingsDataDir) {
    settingsDataDir.value = resolveAbsolutePath(state.settings.userDataPaths?.dataDir || '');
  }
  if (settingsHelperDir) {
    settingsHelperDir.value = resolveAbsolutePath(state.settings.userDataPaths?.helperDir || 'helper');
  }
  if (settingsLogDir) {
    settingsLogDir.value = resolveAbsolutePath(state.settings.userDataPaths?.logDir || 'logs');
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
  if (installVersionMode) {
    installVersionMode.value = normalizeInstallVersionMode(state.settings.installVersionMode || 'latest');
  }
  if (installVersion) {
    installVersion.value = String(state.settings.installVersion || '').trim();
  }
  rebuildInstallVersionOptions();
  if (String(state.settings.githubUser || '').trim() === 'MetaCubeX') {
    ensureMetaCubeXVersionCatalog().catch(() => {});
  } else {
    rebuildInstallVersionOptions();
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
    setProxyModeValue(state.settings.proxy?.mode || 'rule');
  }
  if (tunToggle) {
    tunToggle.checked = Boolean(state.settings.proxy?.tun);
  }
  if (tunStackSelect) {
    const stack = normalizeTunStack(state.settings.proxy?.stack);
    tunStackSelect.value = stack;
    if (state.settings.proxy?.stack !== stack) {
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
    const action = String(payload.action || '').trim().toLowerCase();
    const phase = String(payload.phase || '').trim().toLowerCase();
    if (action === 'start' && phase === 'start') {
      startMihomoUptimeTracking();
    } else if (action === 'restart' && (phase === 'transition' || phase === 'start')) {
      resetMihomoUptimeTracking();
      startMihomoUptimeTracking();
    } else if (action === 'stop' && phase === 'start') {
      resetMihomoUptimeTracking();
      if (overviewUptime) {
        setNodeTextIfChanged(overviewUptime, '-');
      }
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
  primaryLabel = '',
  releaseLabel = '',
  alphaLabel = '',
}) {
  if (!updateGuideModal || !updateGuideTitle || !updateGuideBody || !updateGuideClose || !updateGuidePrimaryBtn || !updateGuideReleaseBtn || !updateGuideAlphaBtn) {
    return Promise.resolve(null);
  }
  updateGuideTitle.textContent = title || ti('help.appUpdateChoicesTitle', 'Update Options');
  updateGuideBody.textContent = body || ti('help.updateGuideHint', 'Choose a version channel to continue.');
  updateGuidePrimaryBtn.textContent = primaryLabel || ti('install.updateDialogPrimaryAction', 'Update Kernel');
  updateGuideReleaseBtn.textContent = releaseLabel || formatAppUpdateChannelText('help.appUpdateOpenChannelAction', 'Open {channel}', 'stable');
  updateGuideAlphaBtn.textContent = alphaLabel || formatAppUpdateChannelText('help.appUpdateOpenChannelAction', 'Open {channel}', 'alpha');
  updateGuidePrimaryBtn.classList.toggle('is-hidden', !primaryLabel);
  updateGuideReleaseBtn.classList.toggle('is-hidden', !releaseLabel);
  updateGuideAlphaBtn.classList.toggle('is-hidden', !alphaLabel);
  updateGuideModal.classList.add('show');
  updateGuideModal.setAttribute('aria-hidden', 'false');

  return new Promise((resolve) => {
    const cleanup = () => {
      updateGuideModal.classList.remove('show');
      updateGuideModal.setAttribute('aria-hidden', 'true');
      updateGuideClose.removeEventListener('click', onClose);
      updateGuidePrimaryBtn.removeEventListener('click', onPrimary);
      updateGuideReleaseBtn.removeEventListener('click', onRelease);
      updateGuideAlphaBtn.removeEventListener('click', onAlpha);
      updateGuideModal.removeEventListener('keydown', onKeydown);
      updateGuideModal.removeEventListener('click', onBackdrop);
    };

    const onClose = () => {
      cleanup();
      resolve(null);
    };

    const onPrimary = () => {
      cleanup();
      resolve('primary');
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
    if (!updateGuidePrimaryBtn.classList.contains('is-hidden')) {
      updateGuidePrimaryBtn.addEventListener('click', onPrimary);
    }
    if (!updateGuideReleaseBtn.classList.contains('is-hidden')) {
      updateGuideReleaseBtn.addEventListener('click', onRelease);
    }
    if (!updateGuideAlphaBtn.classList.contains('is-hidden')) {
      updateGuideAlphaBtn.addEventListener('click', onAlpha);
    }
    updateGuideModal.addEventListener('keydown', onKeydown);
    updateGuideModal.addEventListener('click', onBackdrop);

    if (!updateGuidePrimaryBtn.classList.contains('is-hidden')) {
      updateGuidePrimaryBtn.focus();
    } else if (!updateGuideReleaseBtn.classList.contains('is-hidden')) {
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

const LEGACY_PROXY_FIELDS = [
  'systemProxy',
  'tun',
  'stack',
  'mixedPort',
  'port',
  'socksPort',
  'allowLan',
];

function normalizeProxySettings(value) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    mode: normalizeProxyMode(source.mode || source),
    systemProxy: Boolean(source.systemProxy),
    tun: Boolean(source.tun),
    stack: normalizeTunStack(source.stack || 'Mixed'),
    mixedPort: Number.parseInt(String(source.mixedPort ?? ''), 10) || 7893,
    port: Number.parseInt(String(source.port ?? ''), 10) || 7890,
    socksPort: Number.parseInt(String(source.socksPort ?? ''), 10) || 7891,
    allowLan: Object.prototype.hasOwnProperty.call(source, 'allowLan')
      ? Boolean(source.allowLan)
      : true,
  };
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
  const nextMode = normalizeProxyMode(
    response.data.proxy && typeof response.data.proxy === 'object'
      ? response.data.proxy.mode
      : response.data.proxy,
  );
  const currentMode = normalizeProxyMode(state.settings?.proxy?.mode);
  if (nextMode === currentMode) {
    return;
  }
  saveSettings({ proxy: { mode: nextMode } });
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
  if (!installStatus) {
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
  if (installBtn) {
    installBtn.disabled = nextState === 'loading';
  }
  if (updateBtn) {
    updateBtn.disabled = nextState === 'loading';
  }
  githubUser.disabled = nextState === 'loading';
  if (cancelInstallBtn) {
    cancelInstallBtn.style.display = nextState === 'loading' ? 'block' : 'none';
    cancelInstallBtn.disabled = nextState !== 'loading';
  }
  if (installVersion) {
    installVersion.disabled = nextState === 'loading';
  }
  if (installVersionMode) {
    installVersionMode.disabled = nextState === 'loading';
  }
  syncInstallVersionPickerUi();
  syncKernelSourceCards();
  if (nextState === 'idle') {
    applyKernelUpdateInstallHint();
  }
}

async function performMihomoInstall(mode = 'install') {
  setInstallState('loading');
  const githubUserValue = githubUser ? githubUser.value : 'vernesong';
  const installMode = typeof mode === 'string' ? mode : (mode && mode.mode) || 'install';
  let targetChannel = (mode && typeof mode === 'object' && mode.channel) ? mode.channel : 'default';
  const installVersionModeValue = normalizeInstallVersionMode(
    (installVersionMode && installVersionMode.value)
    || (state.settings && state.settings.installVersionMode)
    || 'latest',
  );
  let versionValue = '';
  if (installMode === 'install' && githubUserValue === 'MetaCubeX') {
    if (installVersionModeValue === 'manual') {
      versionValue = installVersion && installVersion.value.trim() ? installVersion.value.trim() : '';
      if (versionValue && !validateMetaCubeXManualVersion(versionValue)) {
        setInstallState('error');
        showToast(ti('install.versionManualInvalid', 'Manual version is not found in recent tags/releases.'), 'error');
        return;
      }
    } else if (installVersionModeValue.startsWith('tag:')) {
      versionValue = String(installVersionModeValue.slice(4) || '').trim();
    } else if (installVersionModeValue === 'latest') {
      const catalog = getMetaCubeXCatalog();
      const latestStableTag = String(catalog && catalog.latestStableTag ? catalog.latestStableTag : '').trim();
      const latestStableVersion = String(catalog && catalog.latestStableVersion ? catalog.latestStableVersion : '').trim();
      versionValue = latestStableTag || latestStableVersion || '';
      targetChannel = 'default';
    }
  }

  if (typeof window.clashfox.installMihomo !== 'function') {
    setInstallState('error', 'installMihomo_not_available');
    showToast(t('install.notAvailable'), 'error');
    return;
  }

  const unsubscribeProgress = window.clashfox.onInstallMihomoProgress((progress) => {
    if (progress.status === 'downloading') {
      const percentage = typeof progress.progress === 'number' ? progress.progress : 0;
      if (installStatus) {
        installStatus.textContent = ti('install.downloading', 'Downloading {progress}...')
          .replace('{progress}', `${percentage}%`);
      }
    } else if (progress.status === 'fetching_version' && installStatus) {
      installStatus.textContent = t('install.fetchingVersion', 'Fetching version info...');
    } else if (progress.status === 'extracting' && installStatus) {
      installStatus.textContent = t('install.extracting', 'Extracting...');
    } else if (progress.status === 'installing' && installStatus) {
      installStatus.textContent = ti('install.installingKernel', 'Installing / updating kernel...');
    }
  });

  const response = await window.clashfox.installMihomo({
    githubUser: githubUserValue,
    version: versionValue,
    channel: targetChannel,
  });

  unsubscribeProgress();

  if (response.ok) {
    if (response.skipped) {
      setInstallState('idle');
      const versionDisplay = formatKernelVersionForDisplay(
        response.version || '',
        githubUserValue,
        targetChannel === 'alpha' || String(response.version || '').toLowerCase().includes('alpha'),
      );
      const resolvedVersion = versionDisplay || response.version || '-';
      const message = response.skipReason === 'backup_exists'
        ? ti('install.skipBackupExists', 'Backup already exists for version: {version}')
        : ti('install.skipCurrentVersion', 'Current kernel is already version: {version}');
      showToast(message.replace('{version}', resolvedVersion), 'info');
      refreshKernelUpdateNotice(true);
      return;
    }
    setInstallState('success');
    try {
      const restartResponse = await reloadMihomoCore(getMihomoApiSource(), window.clashfox);
      if (!restartResponse || !restartResponse.ok) {
        const detail = String((restartResponse && (restartResponse.details || restartResponse.error)) || '').trim();
        showToast(detail || ti('labels.restartFailed', 'Restart failed'), 'warn');
      }
    } catch (error) {
      const message = String(error && error.message ? error.message : '').trim();
      showToast(message || ti('labels.restartFailed', 'Restart failed'), 'warn');
    }
    showNoticePop(`${t('labels.installSuccess')} ${t('labels.installConfigHint')}`, 'success');
    loadKernels();
    loadStatus();
    refreshKernelUpdateNotice(true);
    setTimeout(() => {
      if (state.installState === 'success') {
        setInstallState('idle');
      }
    }, 1200);
    return;
  }

  const isErrorCancelled = response.error === 'INSTALL_CANCELLED';
  if (isErrorCancelled) {
    setInstallState('idle');
    showToast(t('install.cancelled'), 'info');
  } else {
    setInstallState('error', response.error || '');
    showToast(response.error || t('install.failed'), 'error');
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

function normalizeInstallVersionMode(value = '') {
  const raw = String(value || '').trim();
  const mode = raw.toLowerCase();
  if (mode === 'manual') {
    return 'manual';
  }
  if (mode.startsWith('tag:')) {
    const tag = String(raw.slice(raw.indexOf(':') + 1) || '').trim();
    return tag ? `tag:${tag}` : 'latest';
  }
  return 'latest';
}

function normalizeVersionTag(version = '') {
  return String(version || '').trim().replace(/^v/i, '');
}

function buildVersionSelectOption(value = '', label = '') {
  const option = document.createElement('option');
  option.value = String(value || '').trim();
  option.textContent = String(label || '').trim();
  return option;
}

function getMetaCubeXCatalog() {
  const catalog = state.metaCubeXVersionCatalog;
  return catalog && typeof catalog === 'object' ? catalog : null;
}

function normalizeMetaCubeXCatalogPayload(payload = null) {
  const source = payload && typeof payload === 'object' ? payload : {};
  const normalizeTagList = (input = []) => {
    if (!Array.isArray(input)) {
      return [];
    }
    return input
      .map((item) => String(item || '').trim())
      .filter(Boolean)
      .slice(0, 120);
  };
  return {
    latestStableVersion: String(source.latestStableVersion || '').trim(),
    latestStableTag: String(source.latestStableTag || '').trim(),
    latestTestingVersion: String(source.latestTestingVersion || '').trim(),
    latestTestingTag: String(source.latestTestingTag || '').trim(),
    historyTags: normalizeTagList(source.historyTags),
    tags: normalizeTagList(source.tags),
  };
}

function hydrateMetaCubeXCatalogFromCache() {
  try {
    const raw = localStorage.getItem(METACUBEX_CATALOG_CACHE_KEY);
    if (!raw) {
      return false;
    }
    const parsed = JSON.parse(raw);
    const updatedAt = Number(parsed && parsed.updatedAt ? parsed.updatedAt : 0);
    if (!Number.isFinite(updatedAt) || updatedAt <= 0) {
      return false;
    }
    if ((Date.now() - updatedAt) > METACUBEX_CATALOG_CACHE_MAX_AGE_MS) {
      return false;
    }
    const catalog = normalizeMetaCubeXCatalogPayload(parsed && parsed.catalog ? parsed.catalog : {});
    state.metaCubeXVersionCatalog = catalog;
    state.metaCubeXVersionCatalogLoaded = true;
    return true;
  } catch {
    return false;
  }
}

function persistMetaCubeXCatalogToCache(catalog = null) {
  try {
    if (!catalog || typeof catalog !== 'object') {
      return;
    }
    localStorage.setItem(METACUBEX_CATALOG_CACHE_KEY, JSON.stringify({
      updatedAt: Date.now(),
      catalog: normalizeMetaCubeXCatalogPayload(catalog),
    }));
  } catch {
    // Ignore localStorage write errors.
  }
}

function validateMetaCubeXManualVersion(rawValue = '') {
  const value = String(rawValue || '').trim();
  if (!value) {
    return true;
  }
  const catalog = getMetaCubeXCatalog();
  const tags = Array.isArray(catalog && catalog.tags) ? catalog.tags : [];
  const releaseDerivedTags = [
    String(catalog && catalog.latestStableTag ? catalog.latestStableTag : '').trim(),
    String(catalog && catalog.latestTestingTag ? catalog.latestTestingTag : '').trim(),
    ...(Array.isArray(catalog && catalog.historyTags) ? catalog.historyTags : []),
  ].map((item) => String(item || '').trim()).filter(Boolean);
  const candidateTags = [...new Set([...tags, ...releaseDerivedTags])];
  if (!candidateTags.length) {
    return true;
  }
  const normalizedValue = normalizeVersionTag(value).toLowerCase();
  return candidateTags.some((tag) => {
    const normalizedTag = normalizeVersionTag(tag).toLowerCase();
    return normalizedTag === normalizedValue || normalizedTag.includes(normalizedValue) || normalizedValue.includes(normalizedTag);
  });
}

function rebuildInstallVersionOptions() {
  if (!installVersionMode) {
    return;
  }
  const selectedRaw = normalizeInstallVersionMode(
    (state.settings && state.settings.installVersionMode)
    || installVersionMode.value
    || 'latest',
  );
  const catalog = getMetaCubeXCatalog();
  const latestStableVersion = String(catalog && catalog.latestStableVersion ? catalog.latestStableVersion : '').trim();
  const latestStableTag = String(catalog && catalog.latestStableTag ? catalog.latestStableTag : latestStableVersion).trim();
  const latestTestingVersion = String(catalog && catalog.latestTestingVersion ? catalog.latestTestingVersion : '').trim();
  const latestTestingTag = String(catalog && catalog.latestTestingTag ? catalog.latestTestingTag : latestTestingVersion).trim();
  const historyTags = Array.isArray(catalog && catalog.historyTags) ? catalog.historyTags : [];
  const latestLabelBase = ti('install.versionLatestOption', 'Latest Stable');
  const latestLabel = latestStableVersion
    ? `${latestLabelBase} (${latestStableVersion})`
    : latestLabelBase;
  const latestTestingLabelBase = ti('install.versionLatestTestingOption', 'Latest Testing');
  const latestTestingLabel = latestTestingVersion
    ? `${latestTestingLabelBase} (${latestTestingVersion})`
    : latestTestingLabelBase;

  const manualLabel = ti('install.versionManualOption', 'Manual Input');
  const options = [];
  if (latestStableTag || latestStableVersion) {
    options.push(buildVersionSelectOption('latest', latestLabel));
  }
  if (latestTestingTag || latestTestingVersion) {
    const latestTestingValue = latestTestingTag || latestTestingVersion;
    options.push(buildVersionSelectOption(`tag:${latestTestingValue}`, latestTestingLabel));
  }
  const historyOptions = [];
  historyTags.forEach((tagText) => {
    const tag = String(tagText || '').trim();
    if (!tag || tag === latestTestingTag || tag === latestStableTag) {
      return;
    }
    historyOptions.push(buildVersionSelectOption(`tag:${tag}`, `${tag}`));
  });
  historyOptions.slice(0, 10).forEach((option) => options.push(option));
  options.push(buildVersionSelectOption('manual', manualLabel));

  const optionsSignature = options.map((option) => `${option.value}::${option.textContent}`).join('|');
  if (installVersionOptionsSignature === optionsSignature) {
    const existingValues = new Set(Array.from(installVersionMode.options || []).map((option) => option.value));
    const selected = existingValues.has(selectedRaw)
      ? selectedRaw
      : (existingValues.has('latest') ? 'latest' : 'manual');
    if (installVersionMode.value !== selected) {
      installVersionMode.value = selected;
      if (state.settings && state.settings.installVersionMode !== selected) {
        state.settings.installVersionMode = selected;
      }
      refreshCustomSelects();
    }
    return;
  }
  installVersionOptionsSignature = optionsSignature;

  installVersionMode.innerHTML = '';
  options.forEach((option) => installVersionMode.appendChild(option));
  const availableValues = new Set(options.map((option) => option.value));
  const selected = availableValues.has(selectedRaw)
    ? selectedRaw
    : (availableValues.has('latest') ? 'latest' : 'manual');
  installVersionMode.value = selected;
  if (state.settings && state.settings.installVersionMode !== selected) {
    state.settings.installVersionMode = selected;
  }
  refreshCustomSelects();
}

async function ensureMetaCubeXVersionCatalog(force = false) {
  if (!force && !state.metaCubeXVersionCatalogLoaded) {
    hydrateMetaCubeXCatalogFromCache();
  }
  rebuildInstallVersionOptions();
  if (!window.clashfox || typeof window.clashfox.listKernelVersions !== 'function') {
    return;
  }
  if (!force && state.metaCubeXVersionCatalogLoaded) {
    return;
  }
  if (state.metaCubeXVersionCatalogPromise) {
    return state.metaCubeXVersionCatalogPromise;
  }
  state.metaCubeXVersionCatalogLoading = true;
  const request = (async () => {
    try {
      const result = await window.clashfox.listKernelVersions({ source: 'MetaCubeX' });
      if (result && result.ok) {
        const normalizedCatalog = normalizeMetaCubeXCatalogPayload(result);
        state.metaCubeXVersionCatalog = normalizedCatalog;
        state.metaCubeXVersionCatalogLoaded = true;
        state.metaCubeXCatalogLastLoadFailed = false;
        persistMetaCubeXCatalogToCache(normalizedCatalog);
        return;
      }
      throw new Error(result && result.error ? String(result.error) : 'LIST_KERNEL_VERSIONS_FAILED');
    } catch {
      state.metaCubeXCatalogLastLoadFailed = true;
      const now = Date.now();
      const selectedSource = normalizeKernelSource(
        (githubUser && githubUser.value)
        || (state.settings && state.settings.githubUser)
        || '',
      );
      const shouldNotify = selectedSource === 'MetaCubeX'
        && (now - Number(state.metaCubeXCatalogErrorNotifiedAt || 0) > 15000);
      if (shouldNotify) {
        state.metaCubeXCatalogErrorNotifiedAt = now;
        showToast(
          ti(
            'install.metaCubeXCatalogLoadFailed',
            'MetaCubeX version list failed to load. You can use Manual Input and retry later.',
          ),
          'warn',
        );
      }
    } finally {
      state.metaCubeXVersionCatalogLoading = false;
      state.metaCubeXVersionCatalogPromise = null;
      rebuildInstallVersionOptions();
    }
  })();
  state.metaCubeXVersionCatalogPromise = request;
  return request;
}

function updateInstallVersionModeOptionText() {
  rebuildInstallVersionOptions();
  refreshCustomSelects();
}

function syncInstallVersionPickerUi() {
  if (!installVersionMode || !installVersion) {
    return;
  }
  const mode = normalizeInstallVersionMode(
    (state.settings && state.settings.installVersionMode)
    || installVersionMode.value
    || 'latest',
  );
  installVersionMode.value = mode;
  const showManualInput = mode === 'manual';
  installVersion.classList.toggle('is-hidden', !showManualInput);
  installVersion.readOnly = !showManualInput;
  const isLoading = state.installState === 'loading';
  installVersionMode.disabled = isLoading;
  installVersion.disabled = isLoading || !showManualInput;
}

function syncKernelSourceCards() {
  if (!Array.isArray(kernelSourceCards) || !kernelSourceCards.length) {
    return;
  }
  const selected = normalizeKernelSource((githubUser && githubUser.value) || '') || 'vernesong';
  const disabled = state.installState === 'loading';
  kernelSourceCards.forEach((card) => {
    const value = normalizeKernelSource(card && card.dataset ? card.dataset.sourceValue : '') || '';
    const active = value === selected;
    card.classList.toggle('is-active', active);
    card.setAttribute('aria-checked', active ? 'true' : 'false');
    card.disabled = disabled;
  });
  if (kernelSourcePicker) {
    kernelSourcePicker.setAttribute('aria-disabled', disabled ? 'true' : 'false');
  }
}

function selectKernelSource(nextSource = '', { persist = false } = {}) {
  const normalized = normalizeKernelSource(nextSource) || 'vernesong';
  if (githubUser) {
    githubUser.value = normalized;
  }
  if (settingsGithubUser) {
    settingsGithubUser.value = normalized;
  }
  if (!state.settings || typeof state.settings !== 'object') {
    state.settings = { ...DEFAULT_SETTINGS };
  }
  state.settings.githubUser = normalized;
  if (!state.settings.kernel || typeof state.settings.kernel !== 'object') {
    state.settings.kernel = {};
  }
  state.settings.kernel.githubUser = normalized;
  refreshCustomSelects();
  if (normalized === 'MetaCubeX') {
    ensureMetaCubeXVersionCatalog().catch(() => {});
  }
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
  if (persist) {
    saveSettings({ githubUser: normalized });
  }
  if (currentPage === 'kernel') {
    refreshKernelUpdateNotice(true);
  }
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
  const persistedKernel = (state.settings && state.settings.kernel)
    || (state.fileSettings && state.fileSettings.kernel)
    || {};
  if (overviewStatus && typeof persistedKernel.running === 'boolean') {
    overviewStatus.textContent = persistedKernel.running ? t('labels.running') : t('labels.stopped');
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
    installStatus.textContent = ti('install.kernelChecking', `Checking updates from ${info.source || 'source'}...`)
      .replace('{source}', info.source || 'source');
    installStatus.dataset.state = 'loading';
    return;
  }
  if (info && info.ok && info.status === 'update_available' && info.latestVersion) {
    const latestDisplay = formatKernelVersionForDisplay(info.latestVersion, info.source, Boolean(info.prerelease));
    installStatus.textContent = ti('install.kernelUpdateAvailable', `Kernel update available: ${latestDisplay}`)
      .replace('{version}', latestDisplay);
    installStatus.dataset.state = 'warn';
    return;
  }
  if (
    info
    && info.ok
    && info.latestVersion
  ) {
    const latestDisplay = formatKernelVersionForDisplay(info.latestVersion, info.source, Boolean(info.prerelease));
    installStatus.textContent = ti('install.kernelLatestVersion', 'Latest version: {version}')
      .replace('{version}', latestDisplay);
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
    ) {
      const latest = String(cachedResult.latestVersion || '').trim();
      state.metaCubeXVersionCatalog = {
        ...(state.metaCubeXVersionCatalog || {}),
        latestStableVersion: latest,
      };
      updateInstallVersionModeOptionText();
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
    ) {
      const latest = String(result.latestVersion || '').trim();
      state.metaCubeXVersionCatalog = {
        ...(state.metaCubeXVersionCatalog || {}),
        latestStableVersion: latest,
      };
      updateInstallVersionModeOptionText();
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
        ti('install.kernelUpdateAvailable', `Kernel update available: ${latestDisplay}`)
          .replace('{version}', latestDisplay),
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

// For command arguments that require absolute paths.
const resolveCommandPath = (relativePath) => {
  const userDataPaths = state.settings?.userDataPaths || {};
  const userAppDataDir = userDataPaths.userAppDataDir || '';
  if (!userAppDataDir) {
    return relativePath;
  }
  if (relativePath.startsWith('/') || /^[A-Za-z]:/.test(relativePath)) {
    return relativePath;
  }
  return userAppDataDir.endsWith('/')
      ? `${userAppDataDir}${relativePath}`
      : `${userAppDataDir}/${relativePath}`;
}

async function runCommand(command, args = [], options = {}) {
  if (!window.clashfox || typeof window.clashfox.runCommand !== 'function') {
    return { ok: false, error: 'bridge_missing' };
  }
  const effectiveSettings = { ...(state.fileSettings || {}), ...(state.settings || {}) };
  const userDataPaths = effectiveSettings.userDataPaths || {};
  const pathArgs = [];
  if (userDataPaths.configDir) {
    pathArgs.push('--config-dir', resolveCommandPath(userDataPaths.configDir));
  }
  if (userDataPaths.coreDir) {
    pathArgs.push('--core-dir', resolveCommandPath(userDataPaths.coreDir));
  }
  if (userDataPaths.dataDir) {
    pathArgs.push('--data-dir', resolveCommandPath(userDataPaths.dataDir));
  }
  const finalArgs = [...pathArgs, ...args];
  try {
    const result = await window.clashfox.runCommand(command, finalArgs, options);
    return result;
  } catch (error) {
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
        PANEL_PRESETS = {
          ...DEFAULT_PANEL_PRESETS,
          ...payload.panelPresets,
        };
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
        syncPanelActionButtons();
      }
      if (Array.isArray(payload.recommendedConfigs)) {
        RECOMMENDED_CONFIGS = payload.recommendedConfigs;
      }
    }
  } catch (error) {
    // Silent error handling in production
  }
}

async function loadDefaultSettings() {
  try {
    const response = await fetch(STATIC_DEFAULT_SETTINGS_URL, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`load_failed_${response.status}`);
    }
    const payload = await response.json();
    if (payload && typeof payload === 'object') {
      DEFAULT_SETTINGS = payload;
      if (state && typeof state === 'object') {
        state.settings = { ...DEFAULT_SETTINGS, ...(state.settings || {}) };
      }
    }
  } catch (error) {
    // Silent error handling in production
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
      const onlineVersionText = normalizeVersionForDisplay(result.onlineVersion || '');
      setHelpAboutStatus(
        onlineVersionText
          ? `${ti('help.helperUpdateAvailable', 'Helper update available')}: v${onlineVersionText}`
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
  if (currentPage === 'config') {
    renderConfigTable();
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
  if (settingsHelperDir) {
    settingsHelperDir.placeholder = resolveAbsolutePath(state.settings.userDataPaths?.helperDir || 'helper') || '-';
  }
  if (settingsLogDir) {
    settingsLogDir.placeholder = resolveAbsolutePath(state.settings.userDataPaths?.logDir || 'logs') || '-';
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
  const kernel = (state.settings && state.settings.kernel)
    || (state.fileSettings && state.fileSettings.kernel)
    || {};
  if (!kernel || typeof kernel !== 'object' || typeof kernel.running !== 'boolean') {
    return null;
  }
  return {
    running: kernel.running,
  };
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
  if (!state.settings.kernel) {
    state.settings.kernel = {};
  }
  if (!state.fileSettings.kernel) {
    state.fileSettings.kernel = {};
  }
  state.settings.kernel.running = snapshot.running;
  state.fileSettings.kernel.running = snapshot.running;
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
    if (!state.mihomoStartTime && !getMihomoStartTime()) {
      startMihomoUptimeTracking();
    }
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
  const dashboardNav = document.getElementById('navDashboard');
  if (dashboardNav) {
    dashboardNav.disabled = false;
    dashboardNav.classList.remove('is-disabled');
    dashboardNav.setAttribute('aria-disabled', 'false');
  }
}

function updateInstallVersionVisibility() {
  if (!installVersionRow || !installVersion || !installVersionMode) {
    syncKernelSourceCards();
    return;
  }
  const currentUser =
    (githubUser && githubUser.value) ||
    (settingsGithubUser && settingsGithubUser.value) ||
    (state.settings && state.settings.githubUser) ||
    '';
  const isMetaCubeX = String(currentUser).toLowerCase() === 'metacubex';
  installVersionRow.classList.toggle('is-hidden', !isMetaCubeX);
  if (isMetaCubeX) {
    ensureMetaCubeXVersionCatalog().catch(() => {});
  } else {
    rebuildInstallVersionOptions();
  }
  const installMode = normalizeInstallVersionMode(
    (state.settings && state.settings.installVersionMode)
    || installVersionMode.value
    || 'latest',
  );
  installVersionMode.value = installMode;
  const isLoading = state.installState === 'loading' || state.metaCubeXVersionCatalogLoading;
  installVersionMode.disabled = isLoading || !isMetaCubeX;
  installVersion.disabled = isLoading || !isMetaCubeX || installMode !== 'manual';
  installVersion.readOnly = !isMetaCubeX || installMode !== 'manual';
  installVersion.classList.toggle('is-hidden', installMode !== 'manual');
  if (installVersionRefreshBtn) {
    installVersionRefreshBtn.disabled = isLoading || !isMetaCubeX;
    installVersionRefreshBtn.classList.toggle('is-hidden', !isMetaCubeX || !state.metaCubeXCatalogLastLoadFailed);
  }
  updateInstallVersionModeOptionText();
  syncInstallVersionPickerUi();
  syncKernelSourceCards();
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

// JS-based uptime tracking functions
const MIHOMO_START_TIME_KEY = 'mihomo_start_time';
const MIHOMO_TOTAL_UPTIME_KEY = 'mihomo_total_uptime';

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
    // Ignore localStorage errors
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
    // Ignore localStorage errors
  }
}

function getMihomoTotalUptime() {
  try {
    const stored = localStorage.getItem(MIHOMO_TOTAL_UPTIME_KEY);
    if (stored) {
      const seconds = Number.parseFloat(stored);
      if (Number.isFinite(seconds) && seconds >= 0) {
        return seconds;
      }
    }
  } catch {
    // Ignore localStorage errors
  }
  return 0;
}

function setMihomoTotalUptime(seconds) {
  try {
    if (seconds == null || seconds < 0) {
      localStorage.removeItem(MIHOMO_TOTAL_UPTIME_KEY);
    } else {
      localStorage.setItem(MIHOMO_TOTAL_UPTIME_KEY, String(seconds));
    }
  } catch {
    // Ignore localStorage errors
  }
}

function calculateMihomoUptime() {
  const startTime = state.mihomoStartTime || getMihomoStartTime();

  if (!startTime || !state.coreRunning) {
    return 0;
  }

  const now = Date.now();
  const elapsedMs = Math.max(0, now - startTime);
  const elapsedSec = Math.floor(elapsedMs / 1000);

  return elapsedSec;
}

function resetMihomoUptimeTracking() {
  state.mihomoStartTime = null;
  setMihomoStartTime(null);
  setMihomoTotalUptime(0);
}

function saveMihomoUptimeBeforeStop() {
  const startTime = state.mihomoStartTime || getMihomoStartTime();
  if (!startTime) {
    return;
  }
  const now = Date.now();
  const elapsedMs = Math.max(0, now - startTime);
  const elapsedSec = Math.floor(elapsedMs / 1000);
  
  // Add to total uptime
  const currentTotal = getMihomoTotalUptime();
  const newTotal = currentTotal + elapsedSec;
  setMihomoTotalUptime(newTotal);
  
  // Reset start time
  state.mihomoStartTime = null;
  setMihomoStartTime(null);
}

function startMihomoUptimeTracking() {
  const now = Date.now();
  state.mihomoStartTime = now;
  setMihomoStartTime(now);
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

function parseProviderNumber(value) {
  if (value === null || value === undefined || value === '') {
    return 0;
  }
  const parsed = Number.parseFloat(String(value).trim());
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return parsed;
}

function parseProviderExpire(value) {
  const parsed = Number.parseInt(String(value || '').trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }
  // Some variants may return ms timestamps.
  return parsed > 10_000_000_000 ? Math.floor(parsed / 1000) : parsed;
}

function parseSubscriptionUserinfo(raw = '') {
  const source = String(raw || '').trim();
  if (!source) {
    return {
      upload: 0,
      download: 0,
      total: 0,
      expire: 0,
    };
  }
  const result = {
    upload: 0,
    download: 0,
    total: 0,
    expire: 0,
  };
  source.split(';').forEach((segment) => {
    const [keyRaw, valueRaw] = String(segment || '').split('=');
    const key = String(keyRaw || '').trim().toLowerCase();
    if (!key) {
      return;
    }
    let value = String(valueRaw || '').trim();
    try {
      value = decodeURIComponent(value);
    } catch {
      // ignore decode failures
    }
    if (key === 'upload') result.upload = parseProviderNumber(value);
    if (key === 'download') result.download = parseProviderNumber(value);
    if (key === 'total') result.total = parseProviderNumber(value);
    if (key === 'expire') result.expire = parseProviderExpire(value);
  });
  return result;
}

function normalizeProviderVehicleType(value = '') {
  const text = String(value || '').trim();
  if (!text) {
    return 'UNKNOWN';
  }
  return text.toUpperCase();
}

function normalizeProxyProviderRecords(rawData = {}) {
  const source = rawData && typeof rawData === 'object' ? rawData : {};
  const providersContainer = source.providers && typeof source.providers === 'object'
    ? source.providers
    : source;
  const records = [];
  Object.entries(providersContainer).forEach(([key, value]) => {
    if (!value || typeof value !== 'object') {
      return;
    }
    const entry = value;
    const name = String(entry.name || key || '').trim() || String(key || '').trim() || 'Provider';
    const vehicleType = normalizeProviderVehicleType(entry.vehicleType || entry.vehicle || entry.type || '');
    const subscriptionInfo = (entry.subscriptionInfo && typeof entry.subscriptionInfo === 'object')
      ? entry.subscriptionInfo
      : ((entry.subscription && typeof entry.subscription === 'object')
        ? entry.subscription
        : ((entry['subscription-info'] && typeof entry['subscription-info'] === 'object')
          ? entry['subscription-info']
          : null));
    const fromHeader = parseSubscriptionUserinfo(
      entry.subscriptionUserinfo
      || entry['subscription-userinfo']
      || entry.userinfo
      || '',
    );
    const upload = parseProviderNumber(
      (subscriptionInfo && (subscriptionInfo.upload ?? subscriptionInfo.Upload))
      ?? entry.upload
      ?? entry.Upload
      ?? fromHeader.upload,
    );
    const download = parseProviderNumber(
      (subscriptionInfo && (subscriptionInfo.download ?? subscriptionInfo.Download))
      ?? entry.download
      ?? entry.Download
      ?? fromHeader.download,
    );
    const total = parseProviderNumber(
      (subscriptionInfo && (subscriptionInfo.total ?? subscriptionInfo.Total))
      ?? entry.total
      ?? entry.Total
      ?? fromHeader.total,
    );
    const expire = parseProviderExpire(
      (subscriptionInfo && (subscriptionInfo.expire ?? subscriptionInfo.Expire))
      ?? entry.expire
      ?? entry.Expire
      ?? fromHeader.expire,
    );
    let proxies = [];
    if (Array.isArray(entry.proxies)) {
      proxies = entry.proxies;
    } else if (entry.proxies && typeof entry.proxies === 'object') {
      proxies = Object.values(entry.proxies).filter(Boolean);
    } else if (Array.isArray(entry.all)) {
      proxies = entry.all;
    } else if (Array.isArray(entry.children)) {
      proxies = entry.children;
    } else if (entry.now && Array.isArray(entry.now.all)) {
      proxies = entry.now.all;
    }
    let currentProxy = '';
    if (typeof entry.now === 'string') {
      currentProxy = String(entry.now).trim();
    } else if (entry.now && typeof entry.now === 'object') {
      currentProxy = String(
        entry.now.name
        || entry.now.now
        || entry.now.current
        || entry.now.selected
        || '',
      ).trim();
    }
    if (!currentProxy) {
      currentProxy = String(
        entry.current
        || entry.currentProxy
        || entry.selected
        || entry.selectedProxy
        || entry.nowName
        || '',
      ).trim();
    }
    records.push({
      key: String(key || '').trim() || name,
      name,
      vehicleType,
      upload,
      download,
      total,
      expire,
      proxies,
      currentProxy,
    });
  });
  return records;
}

function buildProviderSubscriptionOverviewData(rawData = {}) {
  const now = Date.now();
  const records = normalizeProxyProviderRecords(rawData);
  const items = records
    .filter((record) => Boolean(record && record.name) && String(record.vehicleType || '').toUpperCase() === 'HTTP')
    .map((record) => {
      const used = Math.max(0, record.upload + record.download);
      const total = Math.max(0, record.total);
      const remaining = Math.max(0, total - used);
      const usedPercent = total > 0 ? Math.max(0, Math.min(100, (used / total) * 100)) : 0;
      return {
        id: record.key,
        name: record.name,
        vehicleType: record.vehicleType,
        totalBytes: total,
        usedBytes: used,
        remainingBytes: remaining,
        usedPercent,
        expireAt: record.expire > 0 ? (record.expire * 1000) : 0,
      };
    })
    .sort((a, b) => (b.usedPercent - a.usedPercent) || (b.usedBytes - a.usedBytes) || a.name.localeCompare(b.name));

  const summary = items.reduce((acc, item) => {
    acc.providerCount += 1;
    acc.totalBytes += Number(item.totalBytes || 0);
    acc.usedBytes += Number(item.usedBytes || 0);
    acc.remainingBytes += Number(item.remainingBytes || 0);
    return acc;
  }, {
    providerCount: 0,
    totalBytes: 0,
    usedBytes: 0,
    remainingBytes: 0,
  });
  summary.usedPercent = summary.totalBytes > 0 ? Math.max(0, Math.min(100, (summary.usedBytes / summary.totalBytes) * 100)) : 0;

  return {
    generatedAt: now,
    summary,
    items,
  };
}

function buildRulesOverviewData(rawData = {}) {
  const payload = rawData && typeof rawData === 'object' ? rawData : {};
  const rawRules = Array.isArray(payload.rules)
    ? payload.rules
    : (Array.isArray(payload) ? payload : []);
  const typeCounter = new Map();
  const policyCounter = new Map();
  rawRules.forEach((rule) => {
    const entry = rule && typeof rule === 'object' ? rule : {};
    const type = String(entry.type || entry.ruleType || '').trim().toUpperCase() || 'UNKNOWN';
    const policy = String(entry.proxy || entry.policy || entry.adapter || '').trim() || 'DIRECT';
    typeCounter.set(type, (typeCounter.get(type) || 0) + 1);
    policyCounter.set(policy, (policyCounter.get(policy) || 0) + 1);
  });
  const types = Array.from(typeCounter.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 12);
  const policies = Array.from(policyCounter.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 12);
  const records = rawRules.slice(0, 160).map((rule, index) => {
    const entry = rule && typeof rule === 'object' ? rule : {};
    const type = String(entry.type || entry.ruleType || '').trim().toUpperCase() || 'UNKNOWN';
    const payloadText = String(
      entry.payload
      || entry.rule
      || entry.domain
      || entry.target
      || entry.value
      || '',
    ).trim();
    const payload = payloadText || '-';
    const policy = String(entry.proxy || entry.policy || entry.adapter || '').trim() || 'DIRECT';
    const provider = String(
      entry.providerName
      || entry.provider
      || entry.source
      || entry.sourceName
      || '',
    ).trim() || '-';
    return {
      id: `rule-${index}`,
      type,
      payload,
      policy,
      provider,
    };
  });
  return {
    generatedAt: Date.now(),
    totalRules: rawRules.length,
    types,
    policies,
    records,
  };
}

function parseRuleTimestamp(value) {
  const parsed = Number.parseInt(String(value || '').trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }
  return parsed > 10_000_000_000 ? parsed : parsed * 1000;
}

function buildRuleProvidersOverviewData(rawData = {}) {
  const payload = rawData && typeof rawData === 'object' ? rawData : {};
  const container = payload.providers && typeof payload.providers === 'object'
    ? payload.providers
    : payload;
  const items = [];
  const behaviorCounter = new Map();
  Object.entries(container).forEach(([key, value]) => {
    if (!value || typeof value !== 'object') {
      return;
    }
    const entry = value;
    const name = String(entry.name || key || '').trim() || String(key || '').trim() || 'Provider';
    const behavior = String(entry.behavior || '').trim() || 'Unknown';
    const vehicleType = String(entry.vehicleType || entry.type || '').trim().toUpperCase() || 'UNKNOWN';
    const ruleCount = Number.parseInt(String(entry.ruleCount ?? entry.count ?? entry.size ?? 0), 10) || 0;
    const updatedAt = parseRuleTimestamp(entry.updatedAt || entry.updateTime || entry.updated || entry.lastUpdate || 0);
    items.push({
      id: String(key || '').trim() || name,
      name,
      behavior,
      vehicleType,
      ruleCount,
      updatedAt,
    });
    behaviorCounter.set(behavior, (behaviorCounter.get(behavior) || 0) + 1);
  });
  items.sort((a, b) => b.ruleCount - a.ruleCount || a.name.localeCompare(b.name));
  const behaviors = Array.from(behaviorCounter.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  return {
    generatedAt: Date.now(),
    totalProviders: items.length,
    totalRules: items.reduce((sum, item) => sum + Number(item.ruleCount || 0), 0),
    behaviors,
    items,
    records: items.slice(0, 160).map((item, index) => ({
      id: `provider-${index}`,
      name: item.name,
      behavior: item.behavior,
      vehicleType: item.vehicleType,
      ruleCount: item.ruleCount,
      updatedAt: item.updatedAt,
    })),
  };
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
    <div class="provider-subscription-stat" data-stat-key="providers">
      <div class="provider-subscription-stat-label">${escapeLogCell(ti('providers.summaryCount', 'Providers'))}</div>
      <div class="provider-subscription-stat-value">${escapeLogCell(String(providerCount))}</div>
    </div>
    <div class="provider-subscription-stat" data-stat-key="used">
      <div class="provider-subscription-stat-label">${escapeLogCell(ti('providers.summaryUsed', 'Used'))}</div>
      <div class="provider-subscription-stat-value">${escapeLogCell(formatBytes(usedBytes))}</div>
    </div>
    <div class="provider-subscription-stat" data-stat-key="remaining">
      <div class="provider-subscription-stat-label">${escapeLogCell(ti('providers.summaryRemain', 'Remaining'))}</div>
      <div class="provider-subscription-stat-value">${escapeLogCell(formatBytes(remainingBytes))}</div>
    </div>
    <div class="provider-subscription-stat" data-stat-key="usage">
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
}

function resetTrafficHistory() {
  state.trafficHistoryRx = [];
  state.trafficHistoryTx = [];
  renderTrafficChart(state.trafficHistoryTx, trafficUploadLine, trafficUploadArea, trafficUploadAxis);
  renderTrafficChart(state.trafficHistoryRx, trafficDownloadLine, trafficDownloadArea, trafficDownloadAxis);
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

  // Prefer snapshot running state when present to avoid stale local guard.
  const hasRunning = Object.prototype.hasOwnProperty.call(data, 'running');
  const running = hasRunning ? Boolean(data.running) : Boolean(state.coreRunning);
  state.overviewRunning = running;
  state.overviewRunningUpdatedAt = Date.now();

  // Use JS-based uptime calculation
  if (running) {
    // If mihomo just started, start tracking
    if (!state.mihomoStartTime && !getMihomoStartTime()) {
      startMihomoUptimeTracking();
    }

    // Don't set overviewUptimeBaseSec here, let the timer handle it
    // Just update the display immediately
    const uptime = calculateMihomoUptime();
    if (Number.isFinite(uptime) && uptime >= 0) {
      if (overviewUptime) {
        setNodeTextIfChanged(overviewUptime, formatUptime(uptime));
      }
    }
  } else {
    // mihomo stopped, clear any stale runtime clock so the UI does not keep counting.
    if (state.mihomoStartTime || getMihomoStartTime()) {
      resetMihomoUptimeTracking();
    }

    state.overviewUptimeBaseSec = 0;
    state.overviewUptimeAt = 0;
    if (overviewUptime) {
      // Display accumulated total uptime even when stopped
      const uptime = calculateMihomoUptime();
      if (Number.isFinite(uptime) && uptime > 0) {
        setNodeTextIfChanged(overviewUptime, formatUptime(uptime));
      } else {
        setNodeTextIfChanged(overviewUptime, '-');
      }
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
    avgLatencyMs: 0,
    avgLossRate: 0,
    avgDownRate: 0,
    avgUpRate: 0,
    explorationCount: 0,
    lastExplorationFingerprint: '',
    lastExplorationAt: 0,
    qualitySamples: [],
    qualitySampleDraft: [],
    qualityLastSampleAt: 0,
    usageSampleAt: 0,
    usageSamples: [],
    disconnectCount: 0,
    reconnectCount: 0,
    reconnectDelayMsTotal: 0,
    lastDisconnectAt: 0,
    lastRunning: false,
    runningStateKnown: false,
    showcasedBadgeId: '',
    lastTrafficProbeAt: 0,
    unlockedBadges: [],
    freshUnlockedBadges: [],
    badgeUnlockMoments: {},
    history: [],
    lastQuickReportDay: '',
    quickReportBaseline: null,
  });
  const normalizeFoxRankSnapshot = (value = {}) => ({
    ...createDefaultFoxRankState(),
    totalUsageSec: Number(value.totalUsageSec) || 0,
    stableDays: Number(value.stableDays) || 0,
    lastStableDay: String(value.lastStableDay || ''),
    lastUsageBaseSec: Number(value.lastUsageBaseSec) || 0,
    lastUsageTickSec: Number(value.lastUsageTickSec) || 0,
    usageResetVersion: String(value.usageResetVersion || FOX_RANK_USAGE_RESET_VERSION),
    qualityScore: Number(value.qualityScore) || 0,
    avgLatencyMs: Number(value.avgLatencyMs) || 0,
    avgLossRate: Number(value.avgLossRate) || 0,
    avgDownRate: Number(value.avgDownRate) || 0,
    avgUpRate: Number(value.avgUpRate) || 0,
    explorationCount: Number(value.explorationCount) || 0,
    lastExplorationFingerprint: String(value.lastExplorationFingerprint || ''),
    lastExplorationAt: Number(value.lastExplorationAt) || 0,
    qualitySamples: normalizeQualitySamples(value.qualitySamples),
    qualitySampleDraft: normalizeQualitySamples(value.qualitySampleDraft),
    qualityLastSampleAt: Number(value.qualityLastSampleAt) || 0,
    usageSampleAt: Number(value.usageSampleAt) || 0,
    usageSamples: normalizeUsageSamples(value.usageSamples),
    disconnectCount: Number(value.disconnectCount) || 0,
    reconnectCount: Number(value.reconnectCount) || 0,
    reconnectDelayMsTotal: Number(value.reconnectDelayMsTotal) || 0,
    lastDisconnectAt: Number(value.lastDisconnectAt) || 0,
    lastRunning: Boolean(value.lastRunning),
    runningStateKnown: Boolean(value.runningStateKnown),
    showcasedBadgeId: String(value.showcasedBadgeId || ''),
    lastTrafficProbeAt: Number(value.lastTrafficProbeAt) || 0,
    unlockedBadges: Array.isArray(value.unlockedBadges) ? value.unlockedBadges.map((item) => String(item || '')) : [],
    freshUnlockedBadges: Array.isArray(value.freshUnlockedBadges) ? value.freshUnlockedBadges.map((item) => String(item || '')) : [],
    badgeUnlockMoments: value.badgeUnlockMoments && typeof value.badgeUnlockMoments === 'object'
      ? Object.fromEntries(Object.entries(value.badgeUnlockMoments).map(([key, item]) => [String(key || ''), String(item || '')]))
      : {},
    history: normalizeHistory(value.history),
    lastQuickReportDay: String(value.lastQuickReportDay || ''),
    quickReportBaseline: value.quickReportBaseline && typeof value.quickReportBaseline === 'object'
      ? {
        xp: Number(value.quickReportBaseline.xp) || 0,
        stableDays: Number(value.quickReportBaseline.stableDays) || 0,
        qualityScore: Number(value.quickReportBaseline.qualityScore) || 0,
        explorationCount: Number(value.quickReportBaseline.explorationCount) || 0,
      }
      : null,
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
  const normalizeQualitySamples = (value) => (Array.isArray(value) ? value : [])
    .map((item) => ({
      at: Number(item && item.at) || 0,
      latencyMs: Number(item && item.latencyMs) || 0,
      lossRate: Number(item && item.lossRate) || 0,
      downRate: Number(item && item.downRate) || 0,
      upRate: Number(item && item.upRate) || 0,
      running: Boolean(item && item.running),
    }))
    .filter((item) => item.at > 0)
    .slice(-FOX_RANK_SAMPLING.qualityHistoryLimit);
  const normalizeUsageSamples = (value) => (Array.isArray(value) ? value : [])
    .map((item) => ({
      at: Number(item && item.at) || 0,
      totalUsageSec: Number(item && item.totalUsageSec) || 0,
    }))
    .filter((item) => item.at > 0)
    .slice(-240);
  try {
    const payload = localStorage.getItem(FOX_RANK_STORAGE_KEY);
    if (!payload) {
      return createDefaultFoxRankState();
    }
    const parsed = JSON.parse(payload);
    const usageResetVersion = parsed.usageResetVersion
      ? String(parsed.usageResetVersion || '')
      : FOX_RANK_USAGE_RESET_VERSION;
    const shouldResetUsage = usageResetVersion !== FOX_RANK_USAGE_RESET_VERSION;
    return normalizeFoxRankSnapshot({
      ...parsed,
      totalUsageSec: shouldResetUsage ? 0 : parsed.totalUsageSec,
      usageResetVersion: FOX_RANK_USAGE_RESET_VERSION,
    });
  } catch {
    return createDefaultFoxRankState();
  }
}

function saveFoxRankToStorage() {
  if (!state.foxRank) {
    return;
  }
  try {
    const snapshot = {
      totalUsageSec: Number(state.foxRank.totalUsageSec) || 0,
      stableDays: Number(state.foxRank.stableDays) || 0,
      lastStableDay: String(state.foxRank.lastStableDay || ''),
      lastUsageBaseSec: Number(state.foxRank.lastUsageBaseSec) || 0,
      lastUsageTickSec: Number(state.foxRank.lastUsageTickSec) || 0,
      usageResetVersion: String(state.foxRank.usageResetVersion || FOX_RANK_USAGE_RESET_VERSION),
      qualityScore: Number(state.foxRank.qualityScore) || 0,
      avgLatencyMs: Number(state.foxRank.avgLatencyMs) || 0,
      avgLossRate: Number(state.foxRank.avgLossRate) || 0,
      avgDownRate: Number(state.foxRank.avgDownRate) || 0,
      avgUpRate: Number(state.foxRank.avgUpRate) || 0,
      explorationCount: Number(state.foxRank.explorationCount) || 0,
      lastExplorationFingerprint: String(state.foxRank.lastExplorationFingerprint || ''),
      lastExplorationAt: Number(state.foxRank.lastExplorationAt) || 0,
      qualitySamples: Array.isArray(state.foxRank.qualitySamples)
        ? state.foxRank.qualitySamples.slice(-FOX_RANK_SAMPLING.qualityHistoryLimit)
        : [],
      qualitySampleDraft: Array.isArray(state.foxRank.qualitySampleDraft)
        ? state.foxRank.qualitySampleDraft.slice(-6)
        : [],
      qualityLastSampleAt: Number(state.foxRank.qualityLastSampleAt) || 0,
      usageSampleAt: Number(state.foxRank.usageSampleAt) || 0,
      usageSamples: Array.isArray(state.foxRank.usageSamples)
        ? state.foxRank.usageSamples.slice(-240)
        : [],
      disconnectCount: Number(state.foxRank.disconnectCount) || 0,
      reconnectCount: Number(state.foxRank.reconnectCount) || 0,
      reconnectDelayMsTotal: Number(state.foxRank.reconnectDelayMsTotal) || 0,
      lastDisconnectAt: Number(state.foxRank.lastDisconnectAt) || 0,
      lastRunning: Boolean(state.foxRank.lastRunning),
      runningStateKnown: Boolean(state.foxRank.runningStateKnown),
      showcasedBadgeId: String(state.foxRank.showcasedBadgeId || ''),
      lastTrafficProbeAt: Number(state.foxRank.lastTrafficProbeAt) || 0,
      unlockedBadges: Array.isArray(state.foxRank.unlockedBadges) ? state.foxRank.unlockedBadges.map((item) => String(item || '')) : [],
      freshUnlockedBadges: Array.isArray(state.foxRank.freshUnlockedBadges) ? state.foxRank.freshUnlockedBadges.map((item) => String(item || '')) : [],
      badgeUnlockMoments: state.foxRank.badgeUnlockMoments && typeof state.foxRank.badgeUnlockMoments === 'object'
        ? Object.fromEntries(Object.entries(state.foxRank.badgeUnlockMoments).map(([key, value]) => [String(key || ''), String(value || '')]))
        : {},
      history: Array.isArray(state.foxRank.history) ? state.foxRank.history.slice(-14) : [],
      lastQuickReportDay: String(state.foxRank.lastQuickReportDay || ''),
      quickReportBaseline: state.foxRank.quickReportBaseline && typeof state.foxRank.quickReportBaseline === 'object'
        ? {
          xp: Number(state.foxRank.quickReportBaseline.xp) || 0,
          stableDays: Number(state.foxRank.quickReportBaseline.stableDays) || 0,
          qualityScore: Number(state.foxRank.quickReportBaseline.qualityScore) || 0,
          explorationCount: Number(state.foxRank.quickReportBaseline.explorationCount) || 0,
        }
        : null,
    };
    localStorage.setItem(FOX_RANK_STORAGE_KEY, JSON.stringify({
      ...snapshot,
    }));
  } catch {
    // ignore storage failures
  }
}

async function resetFoxRankProgress() {
  try {
    localStorage.removeItem(FOX_RANK_STORAGE_KEY);
  } catch {
    // ignore localStorage errors
  }
  state.foxRank = loadFoxRankFromStorage();
  saveFoxRankToStorage();
  renderFoxRankPanel(null, { suppressBrief: true });
  showToast(foxRankText('resetDone', 'Fox Rank data has been reset and restarted.'), 'info');
}

window.__clashfoxResetFoxRank = resetFoxRankProgress;

function computeFoxRankXp() {
  if (!state.foxRank) {
    return 0;
  }
  const usageXp = Math.floor((state.foxRank.totalUsageSec || 0) / 1800);
  const stabilityXp = (state.foxRank.stableDays || 0) * 6;
  const qualityXp = Math.round((state.foxRank.qualityScore || 0) * 35);
  const explorationXp = (state.foxRank.explorationCount || 0) * 4;
  return usageXp + stabilityXp + qualityXp + explorationXp;
}

function getFoxRankTierForXp(xp) {
  for (let i = FOX_RANK_TIERS.length - 1; i >= 0; i -= 1) {
    const tier = FOX_RANK_TIERS[i];
    if (xp >= tier.minXp) {
      const nextTier = FOX_RANK_TIERS[i + 1];
      const nextMin = nextTier ? nextTier.minXp : tier.minXp + 1200;
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
  const fallbackNext = next ? next.minXp : first.minXp + 240;
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

function getRateValue(data, keys) {
  if (!data || !Array.isArray(keys)) {
    return null;
  }
  for (const key of keys) {
    const raw = data[key];
    if (raw !== undefined && raw !== null && raw !== '') {
      const value = Number.parseFloat(raw);
      if (Number.isFinite(value) && value >= 0) {
        return value;
      }
    }
  }
  return null;
}

function parseLossRateValue(raw) {
  if (raw === undefined || raw === null || raw === '') {
    return null;
  }
  if (typeof raw === 'string' && raw.includes('%')) {
    const parsedPercent = Number.parseFloat(raw.replace(/[^\d.-]/g, ''));
    if (Number.isFinite(parsedPercent) && parsedPercent >= 0) {
      return clamp(parsedPercent / 100, 0, 1);
    }
  }
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  if (parsed > 1) {
    return clamp(parsed / 100, 0, 1);
  }
  return clamp(parsed, 0, 1);
}

function computeFoxRankQualityScore(data) {
  const latencyValues = [
    Number(data && data.avgLatencyMs),
    getLatencyValue(data, ['internetMs', 'internet', 'internetLatency']),
    getLatencyValue(data, ['dnsMs', 'dns', 'dnsLatency']),
    getLatencyValue(data, ['routerMs', 'router', 'gatewayMs', 'routerLatency']),
  ].filter((value) => Number.isFinite(value) && value >= 0);
  const latencyMs = latencyValues.length
    ? latencyValues.reduce((sum, value) => sum + value, 0) / latencyValues.length
    : NaN;
  const lossRate = (() => {
    const direct = Number(data && data.avgLossRate);
    if (Number.isFinite(direct) && direct >= 0) {
      return clamp(direct, 0, 1);
    }
    return parseLossRateValue(
      data && (
        data.lossRate
        ?? data.packetLoss
        ?? data.loss
        ?? data.packetLossRate
      ),
    );
  })();
  const downRate = Number(data && data.avgDownRate);
  const upRate = Number(data && data.avgUpRate);
  const resolvedDown = Number.isFinite(downRate) && downRate >= 0
    ? downRate
    : (getRateValue(data, ['downRate', 'down', 'downloadRate', 'download', 'rxRate']) || 0);
  const resolvedUp = Number.isFinite(upRate) && upRate >= 0
    ? upRate
    : (getRateValue(data, ['upRate', 'up', 'uploadRate', 'upload', 'txRate']) || 0);
  const disconnectCount = Math.max(0, Number(data && data.disconnectCount) || 0);
  const reconnectCount = Math.max(0, Number(data && data.reconnectCount) || 0);
  const reconnectDelayMsTotal = Math.max(0, Number(data && data.reconnectDelayMsTotal) || 0);

  if (!Number.isFinite(latencyMs) && !Number.isFinite(lossRate) && !(resolvedDown > 0 || resolvedUp > 0)) {
    return state.foxRank ? (state.foxRank.qualityScore || 0) : 0;
  }

  const latencyScore = Number.isFinite(latencyMs)
    ? clamp(1 - ((latencyMs - 20) / 220), 0, 1)
    : 0.55;
  const lossScore = Number.isFinite(lossRate)
    ? clamp(1 - (lossRate / 0.08), 0, 1)
    : 0.6;
  const throughputScore = clamp((Math.max(0, resolvedDown) + Math.max(0, resolvedUp)) / (2.5 * 1024 * 1024), 0, 1);
  const reconnectAvgMs = reconnectCount > 0 ? reconnectDelayMsTotal / reconnectCount : 0;
  const stabilityPenalty = (clamp(disconnectCount / 12, 0, 1) * 0.65)
    + (clamp(reconnectAvgMs / 45000, 0, 1) * 0.35);
  const stabilityScore = clamp(1 - stabilityPenalty, 0, 1);

  const score = (latencyScore * 0.4)
    + (lossScore * 0.2)
    + (throughputScore * 0.25)
    + (stabilityScore * 0.15);
  return clamp(score, 0, 1);
}

function formatFoxRankUsageValue(totalSeconds = 0) {
  const normalizedSeconds = Math.max(0, Number.isFinite(totalSeconds) ? totalSeconds : 0);
  const totalMinutes = Math.floor(normalizedSeconds / 60);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  return `${days}d:${hours}h:${minutes}m`;
}

function formatFoxRankStableDays(count = 0) {
  const normalized = Math.max(0, Number(count) || 0);
  return formatFoxRankText('stableDays', { count: normalized }, `${normalized} stable days`);
}

function getTodayKey() {
  return new Date().toISOString().split('T')[0];
}

function getFoxRankBoost(snapshot) {
  const data = snapshot || getFoxRankSnapshot();
  const tierBoost = ((Number(data.tier.stageIndex) || 0) + 1) * 3 + (Number(data.tier.subLevel) || 1);
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
  const tier = FOX_RANK_TIERS[index] || FOX_RANK_TIERS[0];
  const stageName = foxRankText(tier.stageKey, tier.stageFallback || '狐幼');
  return `${stageName} · ${tier.subLevel}/${FOX_RANK_STAGE_SUB_LEVELS}`;
}

function getFoxRankTierLevelText(tier = null) {
  const normalized = tier && typeof tier === 'object' ? tier : (FOX_RANK_TIERS[0] || {});
  return `S${Number(normalized.stageIndex || 0) + 1} · ${Number(normalized.subLevel || 1)}/${FOX_RANK_STAGE_SUB_LEVELS}`;
}

function getFoxRankTierDualText(tier = null) {
  const normalized = tier && typeof tier === 'object' ? tier : (FOX_RANK_TIERS[0] || {});
  const stageName = foxRankText(normalized.stageKey, normalized.stageFallback || '狐幼');
  const subLevel = Number(normalized.subLevel || 1);
  const level = Number(normalized.index || 0) + 1;
  return `${stageName} · ${subLevel}/${FOX_RANK_STAGE_SUB_LEVELS} (Lv.${level})`;
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

function resolveFoxRankSkinPaletteFromSettings(settings = null) {
  const source = settings && typeof settings === 'object'
    ? settings
    : (state.settings && typeof state.settings === 'object' ? state.settings : {});
  const appearance = source && typeof source.appearance === 'object' ? source.appearance : {};
  const skinId = String(
    source.foxRankSkin
    || appearance.foxRankSkin
    || '',
  ).trim().toLowerCase();
  const palette = FOX_RANK_SKIN_PALETTES[skinId] || null;
  if (!palette) {
    return {
      skinId: '',
      start: '#8dc2fa',
      end: '#6ea7ea',
    };
  }
  return {
    skinId,
    start: String(palette.start),
    end: String(palette.end),
  };
}

function applyFoxRankThemeCssVars(palette = null, settings = null) {
  if (!document || !document.documentElement) {
    return;
  }
  const resolved = palette && typeof palette === 'object'
    ? {
      skinId: String(palette.skinId || '').trim().toLowerCase(),
      start: String(palette.start || '#8dc2fa'),
      end: String(palette.end || '#6ea7ea'),
    }
    : resolveFoxRankSkinPaletteFromSettings(settings);
  const targets = [document.documentElement, document.body].filter(Boolean);
  targets.forEach((node) => {
    node.style.setProperty('--fox-rank-skin-start', resolved.start);
    node.style.setProperty('--fox-rank-skin-end', resolved.end);
    node.style.setProperty('--fox-rank-aura-start', resolved.start);
    node.style.setProperty('--fox-rank-aura-end', resolved.end);
    if (resolved.skinId) {
      node.dataset.foxRankSkin = resolved.skinId;
    } else if (node.dataset && Object.prototype.hasOwnProperty.call(node.dataset, 'foxRankSkin')) {
      delete node.dataset.foxRankSkin;
    }
  });
}

function resolveFoxRankSkinPalette(snapshot = null) {
  const data = snapshot || getFoxRankSnapshot();
  const tier = data && data.tier && Number.isFinite(Number(data.tier.index))
    ? (FOX_RANK_TIERS[Number(data.tier.index)] || FOX_RANK_TIERS[0])
    : FOX_RANK_TIERS[0];
  const skinId = String(data && data.activeSkin && data.activeSkin.id ? data.activeSkin.id : '').trim();
  const fallbackStart = String(tier && tier.colorStart ? tier.colorStart : '#8dc2fa');
  const fallbackEnd = String(tier && tier.colorEnd ? tier.colorEnd : '#6ea7ea');
  const skinPalette = FOX_RANK_SKIN_PALETTES[skinId] || null;
  return {
    skinId,
    start: String(skinPalette && skinPalette.start ? skinPalette.start : fallbackStart),
    end: String(skinPalette && skinPalette.end ? skinPalette.end : fallbackEnd),
  };
}

function applyFoxRankSkinPalette(snapshot = null) {
  const palette = resolveFoxRankSkinPalette(snapshot);
  applyFoxRankThemeCssVars(palette);
  const targets = [
    foxRankPanel,
    foxRankCard,
    foxRankDetailCard,
    foxRankBriefModal && foxRankBriefModal.querySelector
      ? foxRankBriefModal.querySelector('.fox-rank-brief-card')
      : null,
  ];
  targets.forEach((node) => {
    if (!node || !node.style) {
      return;
    }
    node.style.setProperty('--fox-rank-aura-start', palette.start);
    node.style.setProperty('--fox-rank-aura-end', palette.end);
    if (palette.skinId) {
      node.dataset.foxRankSkin = palette.skinId;
    } else if (node.dataset && Object.prototype.hasOwnProperty.call(node.dataset, 'foxRankSkin')) {
      delete node.dataset.foxRankSkin;
    }
  });
}

function syncFoxRankSkinThemeSetting(snapshot = null) {
  const data = snapshot || getFoxRankSnapshot();
  const nextSkin = String(data && data.activeSkin && data.activeSkin.id ? data.activeSkin.id : '').trim().toLowerCase();
  if (!nextSkin) {
    return;
  }
  const currentAppearance = state.settings && state.settings.appearance && typeof state.settings.appearance === 'object'
    ? state.settings.appearance
    : {};
  const currentSkin = String(
    (state.settings && state.settings.foxRankSkin)
    || currentAppearance.foxRankSkin
    || '',
  ).trim().toLowerCase();
  if (currentSkin === nextSkin) {
    return;
  }
  saveSettings({
    appearance: {
      foxRankSkin: nextSkin,
    },
  });
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

function maybeShowFoxRankImpactHint() {
  if (!state.foxRank) {
    return;
  }
  const now = Date.now();
  if (now - foxRankImpactToastAt < 120000) {
    return;
  }
  const snapshot = getFoxRankSnapshot();
  showToast(
    formatFoxRankText(
      'activeSkinDesc',
      { boost: snapshot.boost.label, skin: snapshot.activeSkin.name },
      `${snapshot.boost.label} Active skin: ${snapshot.activeSkin.name}.`,
    ),
    'info',
  );
  foxRankImpactToastAt = now;
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
  const avgLatencyMs = state.foxRank ? (Number(state.foxRank.avgLatencyMs) || 0) : 0;
  const avgLossRate = state.foxRank ? (Number(state.foxRank.avgLossRate) || 0) : 0;
  const avgDownRate = state.foxRank ? (Number(state.foxRank.avgDownRate) || 0) : 0;
  const avgUpRate = state.foxRank ? (Number(state.foxRank.avgUpRate) || 0) : 0;
  const disconnectCount = state.foxRank ? (Number(state.foxRank.disconnectCount) || 0) : 0;
  const reconnectCount = state.foxRank ? (Number(state.foxRank.reconnectCount) || 0) : 0;
  const reconnectDelayMsTotal = state.foxRank ? (Number(state.foxRank.reconnectDelayMsTotal) || 0) : 0;
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
    avgLatencyMs,
    avgLossRate,
    avgDownRate,
    avgUpRate,
    disconnectCount,
    reconnectCount,
    reconnectDelayMsTotal,
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
    avgLatencyMs,
    avgLossRate,
    avgDownRate,
    avgUpRate,
    disconnectCount,
    reconnectCount,
    reconnectDelayMsTotal,
    explorationCount,
  });
  return {
    xp,
    tier: {
      ...tier,
      level: tier.index + 1,
      stageName: foxRankText(tier.stageKey, tier.stageFallback || '狐幼'),
      name: getFoxRankTierName(tier.index),
    },
    delta,
    span,
    usageText,
    stabilityDays,
    qualityScore,
    qualityLabel,
    avgLatencyMs,
    avgLossRate,
    avgDownRate,
    avgUpRate,
    disconnectCount,
    reconnectCount,
    reconnectDelayMsTotal,
    explorationCount,
    progress,
    boost,
    activeSkin,
  };
}

function getFoxRankBadgeItems(snapshot) {
  return [
    { id: 'connection-keeper', name: foxRankText('badgeConnectionKeeper', 'Connection Keeper'), desc: formatFoxRankStableDays(snapshot.stabilityDays), unlocked: snapshot.stabilityDays >= 1 },
    { id: 'long-run', name: foxRankText('badgeLongRun', 'Long Run'), desc: snapshot.usageText, unlocked: snapshot.xp >= 200 },
    { id: 'quality-eye', name: foxRankText('badgeQualityEye', 'Quality Eye'), desc: formatFoxRankText('qualityPctShort', { value: Math.round(snapshot.qualityScore * 100) }, `${Math.round(snapshot.qualityScore * 100)}% quality`), unlocked: snapshot.qualityScore >= 0.6 },
    { id: 'tier-climber', name: foxRankText('badgeTierClimber', 'Tier Climber'), desc: formatFoxRankText('reachedTier', { tier: getFoxRankTierDualText(snapshot.tier) }, `${getFoxRankTierDualText(snapshot.tier)} reached`), unlocked: snapshot.tier.index >= 5 },
    { id: 'route-scout', name: foxRankText('badgeRouteScout', 'Route Scout'), desc: formatFoxRankText('routeHops', { count: snapshot.explorationCount }, `${snapshot.explorationCount} route hops`), unlocked: snapshot.explorationCount >= 3 },
    { id: 'sky-bridge', name: foxRankText('badgeSkyBridge', 'Sky Bridge'), desc: foxRankText('badgeSkyBridgeDesc', '5 explorations this week'), unlocked: getFoxRankWeeklyReview(snapshot).exploreGain >= 5 },
    { id: 'pristine-loop', name: foxRankText('badgePristineLoop', 'Pristine Loop'), desc: foxRankText('badgePristineLoopDesc', 'Quality held above 85%'), unlocked: snapshot.qualityScore >= 0.85 },
    { id: 'skin-awakened', name: foxRankText('badgeSkinAwakened', 'Skin Awakened'), desc: formatFoxRankText('badgeSkinAwakenedDesc', { skin: snapshot.activeSkin.name }, `${snapshot.activeSkin.name} online`), unlocked: snapshot.tier.index >= 10 },
  ];
}

function getFoxRankLogItems(snapshot) {
  const reconnectAvgMs = snapshot.reconnectCount > 0
    ? Math.round(snapshot.reconnectDelayMsTotal / snapshot.reconnectCount)
    : 0;
  return [
    { label: foxRankText('rankXp', 'Rank XP'), value: `${snapshot.delta}/${snapshot.span} XP` },
    { label: foxRankText('stability', 'Stability'), value: formatFoxRankStableDays(snapshot.stabilityDays) },
    { label: foxRankText('network', 'Network'), value: formatFoxRankText('qualityPct', { label: snapshot.qualityLabel, value: Math.round(snapshot.qualityScore * 100) }, `${snapshot.qualityLabel} • ${Math.round(snapshot.qualityScore * 100)}%`) },
    { label: foxRankText('latency', 'Latency'), value: `${Math.round(snapshot.avgLatencyMs || 0)} ms` },
    { label: foxRankText('packetLoss', 'Packet Loss'), value: `${Math.round((snapshot.avgLossRate || 0) * 100)}%` },
    { label: foxRankText('downlink', 'Downlink'), value: formatBitrate(snapshot.avgDownRate || 0) },
    { label: foxRankText('uplink', 'Uplink'), value: formatBitrate(snapshot.avgUpRate || 0) },
    { label: foxRankText('disconnects', 'Disconnects'), value: String(snapshot.disconnectCount || 0) },
    { label: foxRankText('reconnectDelay', 'Reconnect Delay'), value: `${reconnectAvgMs} ms` },
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
  const unlockedIds = state.foxRank.unlockedBadges;
  if (!unlockedIds.includes(String(state.foxRank.showcasedBadgeId || ''))) {
    state.foxRank.showcasedBadgeId = unlockedIds[0] || '';
  }
}

function setFoxRankShowcasedBadge(badgeId = '') {
  if (!state.foxRank) {
    return;
  }
  const nextId = String(badgeId || '').trim();
  if (!nextId) {
    return;
  }
  const unlocked = new Set(Array.isArray(state.foxRank.unlockedBadges) ? state.foxRank.unlockedBadges : []);
  if (!unlocked.has(nextId)) {
    return;
  }
  if (state.foxRank.showcasedBadgeId === nextId) {
    return;
  }
  state.foxRank.showcasedBadgeId = nextId;
  const snapshot = getFoxRankSnapshot();
  renderFoxRankDetailPanel(snapshot);
  saveFoxRankToStorage();
  showToast(foxRankText('badgeShowcasedDone', 'Showcased badge updated'), 'info');
}

function buildFoxRankSummaryText(snapshot = null) {
  const data = snapshot || getFoxRankSnapshot();
  return [
    `${foxRankText('title', 'Fox Rank')} ${getFoxRankTierDualText(data.tier)}`,
    `XP: ${data.delta} / ${data.span}`,
    `${foxRankText('usage', 'Usage')}: ${data.usageText}`,
    `${foxRankText('stability', 'Stability')}: ${formatFoxRankStableDays(data.stabilityDays)}`,
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
  canvas.height = 580;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    showToast(foxRankText('exportFailed', 'Export failed'), 'error');
    return;
  }

  const isLightTheme = state.theme === 'day';
  const weeklyReview = getFoxRankWeeklyReview(data);
  const tier = FOX_RANK_TIERS[data.tier.index] || FOX_RANK_TIERS[0];

  // 背景渐变 - 使用等级主题色
  const bgGradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  if (isLightTheme) {
    bgGradient.addColorStop(0, '#f5f9ff');
    bgGradient.addColorStop(1, '#e8f2ff');
  } else {
    bgGradient.addColorStop(0, '#1c2836');
    bgGradient.addColorStop(1, '#101722');
  }
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 装饰图案 - 使用等级主题色
  ctx.globalAlpha = 0.03;
  ctx.fillStyle = tier.colorStart;
  ctx.beginPath();
  ctx.arc(canvas.width, 0, 300, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1.0;

  // 光晕效果 A - 右上角（大光晕）
  ctx.globalAlpha = 0.38;
  const haloAGradient = ctx.createRadialGradient(canvas.width - 40, -60, 0, canvas.width - 40, -60, 90);
  haloAGradient.addColorStop(0, tier.colorStart);
  haloAGradient.addColorStop(0.72, 'transparent');
  ctx.fillStyle = haloAGradient;
  ctx.beginPath();
  ctx.arc(canvas.width - 40, -60, 90, 0, Math.PI * 2);
  ctx.fill();

  // 光晕效果 B - 左下角（大光晕）
  const haloBGradient = ctx.createRadialGradient(-50, canvas.height + 70, 0, -50, canvas.height + 70, 100);
  haloBGradient.addColorStop(0, tier.colorEnd);
  haloBGradient.addColorStop(0.72, 'transparent');
  ctx.fillStyle = haloBGradient;
  ctx.beginPath();
  ctx.arc(-50, canvas.height + 70, 100, 0, Math.PI * 2);
  ctx.fill();

  // 光晕效果 C - 左上角（中等光晕）
  ctx.globalAlpha = 0.32;
  const haloCGradient = ctx.createRadialGradient(40, 50, 0, 40, 50, 60);
  haloCGradient.addColorStop(0, tier.colorStart);
  haloCGradient.addColorStop(0.65, 'transparent');
  ctx.fillStyle = haloCGradient;
  ctx.beginPath();
  ctx.arc(40, 50, 60, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1.0;

  // 粒子效果 - 白色发光粒子
  const particles = [
    { x: 100, y: 80, r: 6 },
    { x: 180, y: 140, r: 6 },
    { x: 100, y: 500, r: 6 },
    { x: 700, y: 100, r: 5 },
  ];
  particles.forEach((p) => {
    // 粒子核心
    ctx.globalAlpha = 0.68;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();

    // 粒子光晕
    ctx.globalAlpha = 0.34;
    const glowGradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 14);
    glowGradient.addColorStop(0, 'rgba(255, 255, 255, 0.38)');
    glowGradient.addColorStop(1, 'transparent');
    ctx.fillStyle = glowGradient;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 14, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1.0;

  // 标题
  const textColor = isLightTheme ? '#1c2836' : '#ffffff';
  const mutedColor = isLightTheme ? '#6b7280' : '#9ca3af';

  ctx.fillStyle = textColor;
  ctx.font = '700 42px system-ui, -apple-system, sans-serif';
  ctx.fillText(`ClashFox • ${foxRankText('title', 'Fox Rank')}`, 64, 88);

  // 等级名称
  ctx.font = 'bold 82px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = tier.colorStart;
  ctx.fillText(getFoxRankTierDualText(data.tier), 64, 182);

  // 等级索引
  ctx.font = 'bold 36px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = mutedColor;
  ctx.fillText(formatFoxRankText('levelPrefix', { level: data.tier.index + 1 }, `Lv. ${data.tier.index + 1}`), 720, 88);

  // 进度条背景
  const progressBarWidth = 800;
  const progressBarHeight = 10;
  const progressY = 210;
  ctx.fillStyle = isLightTheme ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.1)';
  roundRect(ctx, 64, progressY, progressBarWidth, progressBarHeight, 5);

  // 进度条填充
  const progress = data.delta / data.span;
  const progressGradient = ctx.createLinearGradient(64, progressY, 64 + progressBarWidth * progress, progressY);
  progressGradient.addColorStop(0, tier.colorStart);
  progressGradient.addColorStop(1, tier.colorEnd);
  ctx.fillStyle = progressGradient;
  roundRect(ctx, 64, progressY, progressBarWidth * progress, progressBarHeight, 5);

  // XP 文本
  ctx.font = '600 28px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = textColor;
  ctx.fillText(`XP ${data.delta} / ${data.span}`, 64, 258);

  // 本周 XP - 右对齐，与进度条右边缘对齐
  ctx.fillStyle = '#8ac1ff';
  ctx.textAlign = 'right';
  ctx.fillText(`📈 +${weeklyReview.xpGain} ${foxRankText('xpGained', 'XP gained')}`, 864, 258);
  ctx.textAlign = 'left';

  // 指标数据 - 两行两列布局：左两列左对齐，右两列右对齐
  const metrics = [
    { label: foxRankText('usage', 'Usage'), value: data.usageText },
    { label: foxRankText('quality', 'Quality'), value: `${data.qualityLabel} • ${Math.round(data.qualityScore * 100)}%` },
    { label: foxRankText('stability', 'Stability'), value: formatFoxRankStableDays(data.stabilityDays) },
    { label: foxRankText('explore', 'Explore'), value: formatFoxRankText('hops', { count: data.explorationCount }, `${data.explorationCount} hops`) },
  ];

  metrics.forEach((metric, index) => {
    const row = Math.floor(index / 2);
    const col = index % 2;
    const y = 318 + row * 52;
    ctx.font = '600 28px system-ui, -apple-system, sans-serif';

    if (col === 0) {
      // 左侧列：左对齐
      ctx.fillStyle = textColor;
      ctx.fillText(`${metric.label} ${metric.value}`, 64, y);
    } else {
      // 右侧列：右对齐，与进度条右边缘对齐
      ctx.textAlign = 'right';
      ctx.fillStyle = textColor;
      ctx.fillText(`${metric.label} ${metric.value}`, 864, y);
      ctx.textAlign = 'left';
    }
  });

  // 底部信息
  const footerY = 540;
  ctx.font = '600 26px system-ui, -apple-system, sans-serif';

  // 皮肤
  ctx.fillStyle = '#ffb86c';
  ctx.fillText(`🦊 ${data.activeSkin.name}`, 64, footerY);

  // Boost
  ctx.fillStyle = '#8ac1ff';
  ctx.fillText(data.boost.label, 300, footerY);

  // 品牌信息 - 换行显示在右侧
  ctx.font = '24px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = mutedColor;
  ctx.textAlign = 'right';
  ctx.fillText('Powered by ClashFox', 916, footerY + 32);
  ctx.textAlign = 'left';

  // 导出
  const anchor = document.createElement('a');
  anchor.href = canvas.toDataURL('image/png');
  anchor.download = `clashfox-fox-rank-lv${data.tier.index + 1}-${Date.now()}.png`;
  anchor.click();
  showToast(foxRankText('pngExported', 'Fox Rank PNG exported'), 'info');
}

// 辅助函数：绘制圆角矩形
function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.fill();
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
  const baseline = getFoxRankQuickReportBaseline(data);
  const xpDelta = Math.max(0, data.xp - (Number(baseline.xp) || 0));
  const stableDelta = Math.max(0, data.stabilityDays - (Number(baseline.stableDays) || 0));
  const qualityDelta = Math.round((data.qualityScore - (Number(baseline.qualityScore) || 0)) * 100);
  const exploreDelta = Math.max(0, data.explorationCount - (Number(baseline.explorationCount) || 0));
  if (foxRankBriefTitle) {
    setNodeTextIfChanged(foxRankBriefTitle, xpDelta > 0 ? foxRankText('campfireUpdated', 'Campfire report updated') : foxRankText('syncedToday', 'Fox Rank synced for today'));
  }
  if (foxRankBriefSummary) {
    const hint = data.progress >= 0.8
      ? foxRankText('ascensionOpen', 'Ascension window is open.')
      : foxRankText('momentumBuilding', 'Momentum is building.');
    setNodeTextIfChanged(
      foxRankBriefSummary,
      `${getFoxRankTierDualText(data.tier)} · ${hint}`,
    );
  }
  if (foxRankBriefMetrics) {
    foxRankBriefMetrics.innerHTML = [
      `<div class="fox-rank-brief-metric"><span>${escapeLogCell(foxRankText('dailyXp', 'XP'))}</span><strong>+${xpDelta}</strong></div>`,
      `<div class="fox-rank-brief-metric"><span>${escapeLogCell(foxRankText('dailyStability', 'Stability'))}</span><strong>+${stableDelta}</strong></div>`,
      `<div class="fox-rank-brief-metric"><span>${escapeLogCell(foxRankText('dailyQuality', 'Quality'))}</span><strong>${qualityDelta >= 0 ? '+' : ''}${qualityDelta}%</strong></div>`,
      `<div class="fox-rank-brief-metric"><span>${escapeLogCell(foxRankText('dailyExplore', 'Explore'))}</span><strong>+${exploreDelta}</strong></div>`,
    ].join('');
  }
  if (foxRankBriefBoost) {
    setNodeTextIfChanged(foxRankBriefBoost, formatFoxRankText('briefBoost', { label: data.boost.label, desc: data.boost.description }, `${data.boost.label} • ${data.boost.description}`));
  }
}

function getFoxRankQuickReportBaseline(snapshot) {
  if (!state.foxRank) {
    return {
      xp: snapshot.xp,
      stableDays: snapshot.stabilityDays,
      qualityScore: snapshot.qualityScore,
      explorationCount: snapshot.explorationCount,
    };
  }
  const stored = state.foxRank.quickReportBaseline;
  if (stored && typeof stored === 'object') {
    return stored;
  }
  const history = Array.isArray(state.foxRank.history) ? state.foxRank.history : [];
  const today = getTodayKey();
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const entry = history[i];
    if (entry && entry.day && entry.day !== today) {
      return {
        xp: Number(entry.xp) || 0,
        stableDays: Number(entry.stableDays) || 0,
        qualityScore: Number(entry.qualityScore) || 0,
        explorationCount: Number(entry.explorationCount) || 0,
      };
    }
  }
  return {
    xp: snapshot.xp,
    stableDays: snapshot.stabilityDays,
    qualityScore: snapshot.qualityScore,
    explorationCount: snapshot.explorationCount,
  };
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
  const userDataPaths = state && state.fileSettings && state.fileSettings.userDataPaths
    ? state.fileSettings.userDataPaths
    : (state.settings && state.settings.userDataPaths ? state.settings.userDataPaths : {});
  const relativeLogDir = userDataPaths && typeof userDataPaths.logDir === 'string'
    ? String(userDataPaths.logDir || '').trim()
    : '';
  const dir = relativeLogDir
    ? resolveAbsolutePath(relativeLogDir)
    : '~/Library/Application Support/ClashFox/logs';
  return dir.endsWith('/') ? `${dir}clashfox.log` : `${dir}/clashfox.log`;
}

function renderFoxRankDetailPanel(snapshot = null) {
  if (!foxRankDetailModal || !state.foxRank) {
    return;
  }
  const data = snapshot || getFoxRankSnapshot();
  const weekly = getFoxRankWeeklyReview(data);
  if (foxRankDetailTier) {
    setNodeTextIfChanged(foxRankDetailTier, getFoxRankTierDualText(data.tier));
  }
  if (foxRankDetailSubtitle) {
    setNodeTextIfChanged(foxRankDetailSubtitle, formatFoxRankText('activeSkinDesc', { boost: data.boost.description, skin: data.activeSkin.name }, `${data.boost.description} Active skin: ${data.activeSkin.name}.`));
  }
  if (foxRankDetailLevel) {
    setNodeTextIfChanged(foxRankDetailLevel, getFoxRankTierLevelText(data.tier));
  }
  if (foxRankDetailXp) {
    setNodeTextIfChanged(foxRankDetailXp, `${data.delta} / ${data.span} XP`);
  }
  if (foxRankDetailUsage) {
    setNodeTextIfChanged(foxRankDetailUsage, data.usageText);
  }
  if (foxRankDetailStability) {
    setNodeTextIfChanged(foxRankDetailStability, formatFoxRankStableDays(data.stabilityDays));
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
      `<div class="fox-rank-weekly-note">${escapeLogCell(formatFoxRankText('unlockedThisWeek', { count: weekly.unlockedThisWeek, skin: data.activeSkin.name }, `This week unlocked ${weekly.unlockedThisWeek} badges and pushed ${data.activeSkin.name} forward.`))}</div>`,
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
    const showcasedId = String(state.foxRank && state.foxRank.showcasedBadgeId ? state.foxRank.showcasedBadgeId : '');
    foxRankBadgeList.innerHTML = getFoxRankBadgeItems(data)
      .map((item, index) => {
        const isShowcased = item.unlocked && showcasedId === item.id;
        const status = isShowcased
          ? foxRankText('showcased', 'Showcased')
          : (item.unlocked ? foxRankText('unlocked', 'Unlocked') : foxRankText('locked', 'Locked'));
        const classNames = `fox-rank-badge-item ${item.unlocked ? 'is-unlocked' : 'is-locked'}${freshSet.has(item.id) ? ' unlocked-fresh' : ''}${isShowcased ? ' is-showcased' : ''}`;
        const action = item.unlocked && !isShowcased
          ? `<button class="fox-rank-badge-action" type="button" data-fox-rank-showcase="${escapeLogCell(item.id)}">${escapeLogCell(foxRankText('setShowcase', 'Set Showcase'))}</button>`
          : '';
        return `<div class="${classNames}" style="animation-delay:${index * 70}ms"><div class="fox-rank-badge-main"><strong>${escapeLogCell(item.name)}</strong><span>${escapeLogCell(item.desc)}</span></div><div class="fox-rank-badge-side"><em class="fox-rank-badge-status">${escapeLogCell(status)}</em>${action}</div></div>`;
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
    // foxRankSharePreview.innerHTML = `<div class="fox-rank-share-head"><strong>${escapeLogCell(data.tier.name)}</strong><span>${escapeLogCell(formatFoxRankText('levelPrefix', { level: data.tier.index + 1 }, `Lv. ${data.tier.index + 1}`))}</span></div><div class="fox-rank-share-lines"><span>${escapeLogCell(data.boost.label)}</span><span>${escapeLogCell(formatFoxRankText('qualityShare', { label: data.qualityLabel, value: Math.round(data.qualityScore * 100) }, `${data.qualityLabel} • ${Math.round(data.qualityScore * 100)}% quality`))}</span><span>${escapeLogCell(formatFoxRankText('exploreSkinShare', { explore: formatFoxRankText('routeHops', { count: data.explorationCount }, `${data.explorationCount} explorations`), skin: data.activeSkin.name }, `${data.explorationCount} explorations • ${data.activeSkin.name}`))}</span></div>`;
    const weeklyReview = getFoxRankWeeklyReview(data);
    const tierColor = getFoxRankTierColor(data.tier.index);

    foxRankSharePreview.innerHTML = `
      <div class="fox-rank-share-head">
        <strong style="color: ${tierColor}">${escapeLogCell(getFoxRankTierDualText(data.tier))}</strong>
        <span>${escapeLogCell(getFoxRankTierLevelText(data.tier))}</span>
      </div>
      <div class="fox-rank-share-progress">
        <div class="fox-rank-share-progress-fill" style="width: ${Math.round(data.progress * 100)}%; background: linear-gradient(90deg,${tierColor},${adjustColor(tierColor, -20)})"></div>
      </div>
      <div class="fox-rank-share-meta">
        <span>XP ${data.delta} / ${data.span}</span>
        <span class="badge">📈 +${weeklyReview.xpGain} ${escapeLogCell(foxRankText('xpGained', 'XP gained'))}</span>
      </div>
      <div class="fox-rank-share-lines">
        <span class="metric-item">
          <i>⏱️</i>
          ${escapeLogCell(data.usageText)}
          ${renderTrendBadge(data.usageSec, data.previousUsageSec)}
        </span>
        <span class="metric-item">
          <i>🛡️</i>
          ${escapeLogCell(formatFoxRankText('stableDays', { count: data.stabilityDays || 0 }, `${data.stabilityDays || 0} stable days`))}
          ${renderTrendBadge(data.stabilityDays, data.previousStabilityDays)}
        </span>
        <span class="metric-item">
          <i>⭐</i>
          ${escapeLogCell(data.qualityLabel)} • ${Math.round(data.qualityScore * 100)}%
        </span>
        <span class="metric-item">
          <i>🧭</i>
          ${escapeLogCell(formatFoxRankText('routeHops', { count: data.explorationCount || 0 }, `${data.explorationCount || 0} route hops`))}
          ${renderTrendBadge(data.explorationCount, data.previousExplorationCount)}
        </span>
      </div>
      <div class="fox-rank-share-footer">
        <span class="skin-badge">${data.activeSkin.name}</span>
        <span class="boost-badge">${data.boost.label}</span>
      </div>
      ${renderShareBadges(data)}
    `;
  }
  setFoxRankDetailTab(foxRankActiveTab);
  renderFoxRankBriefModal(data);
}

// 辅助函数：获取等级颜色
function getFoxRankTierColor(tierIndex) {
  const tier = FOX_RANK_TIERS[tierIndex] || FOX_RANK_TIERS[0];
  return tier.colorStart || '#8ac1ff';
}

// 辅助函数：调整颜色亮度
function adjustColor(hex, percent) {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) + amt;
  const G = (num >> 8 & 0x00FF) + amt;
  const B = (num & 0x0000FF) + amt;
  return '#' + (0x1000000 +
      (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
      (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
      (B < 255 ? (B < 1 ? 0 : B) : 255)
  ).toString(16).slice(1);
}

// 辅助函数：渲染趋势指示器
function renderTrendBadge(current, previous) {
  if (previous === undefined || previous === null) {
    return '';
  }
  const diff = current - previous;
  if (diff === 0) return '<span class="trend neutral">→</span>';
  const icon = diff > 0 ? '↑' : '↓';
  const className = diff > 0 ? 'positive' : 'negative';
  return `<span class="trend ${className}" title="较上周 ${diff > 0 ? '+' : ''}${diff}">${icon} ${Math.abs(diff)}</span>`;
}

// 辅助函数：渲染徽章
function renderShareBadges(data) {
  const all = getFoxRankBadgeItems(data).filter((item) => item.unlocked);
  const showcasedId = String(state.foxRank && state.foxRank.showcasedBadgeId ? state.foxRank.showcasedBadgeId : '');
  const showcased = all.find((item) => item.id === showcasedId) || null;
  const recent = (showcased ? [showcased, ...all.filter((item) => item.id !== showcased.id)] : all).slice(0, 4);
  if (!recent.length) return '';

  const badgeIcons = {
    'connection-keeper': '🛡️',
    'long-run': '⏱️',
    'quality-eye': '⭐',
    'tier-climber': '📈',
    'route-scout': '🧭',
    'sky-bridge': '🌉',
    'pristine-loop': '💠',
    'skin-awakened': '🦊',
  };

  return `
    <div class="fox-rank-share-badges">
      ${recent.map((b) => `
        <div class="badge-mini${showcased && showcased.id === b.id ? ' is-showcased' : ''}" title="${escapeLogCell(b.name)}">
          <span>${badgeIcons[b.id] || '🏆'}</span>
        </div>
      `).join('')}
    </div>
  `;
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

function pushFoxRankUsageSample(nowMs) {
  if (!state.foxRank) {
    return;
  }
  const marker = Number(state.foxRank.usageSampleAt) || 0;
  if (!marker) {
    state.foxRank.usageSampleAt = nowMs;
    return;
  }
  if ((nowMs - marker) < FOX_RANK_SAMPLING.usageMs) {
    return;
  }
  const steps = Math.max(1, Math.floor((nowMs - marker) / FOX_RANK_SAMPLING.usageMs));
  const samples = Array.isArray(state.foxRank.usageSamples) ? state.foxRank.usageSamples.slice() : [];
  let nextAt = marker;
  for (let i = 0; i < steps; i += 1) {
    nextAt += FOX_RANK_SAMPLING.usageMs;
    samples.push({
      at: nextAt,
      totalUsageSec: Number(state.foxRank.totalUsageSec) || 0,
    });
  }
  state.foxRank.usageSampleAt = nextAt;
  state.foxRank.usageSamples = samples.slice(-240);
}

function collectFoxRankQualityDraft(data, nowMs, running) {
  if (!state.foxRank) {
    return;
  }
  const latencyValues = [
    getLatencyValue(data, ['internetMs', 'internet', 'internetLatency']),
    getLatencyValue(data, ['dnsMs', 'dns', 'dnsLatency']),
    getLatencyValue(data, ['routerMs', 'router', 'gatewayMs', 'routerLatency']),
  ].filter((value) => Number.isFinite(value) && value >= 0);
  const latencyMs = latencyValues.length
    ? latencyValues.reduce((sum, value) => sum + value, 0) / latencyValues.length
    : NaN;
  const lossRate = parseLossRateValue(data && (
    data.lossRate
    ?? data.packetLoss
    ?? data.loss
    ?? data.packetLossRate
  ));
  const downRate = getRateValue(data, ['downRate', 'down', 'downloadRate', 'download', 'rxRate']);
  const upRate = getRateValue(data, ['upRate', 'up', 'uploadRate', 'upload', 'txRate']);
  const draft = Array.isArray(state.foxRank.qualitySampleDraft) ? state.foxRank.qualitySampleDraft.slice(-7) : [];
  draft.push({
    at: nowMs,
    latencyMs: Number.isFinite(latencyMs) ? latencyMs : 0,
    lossRate: Number.isFinite(lossRate) ? lossRate : NaN,
    downRate: Number.isFinite(downRate) ? downRate : 0,
    upRate: Number.isFinite(upRate) ? upRate : 0,
    running: Boolean(running),
  });
  state.foxRank.qualitySampleDraft = draft;
}

function foldFoxRankQualitySample(nowMs) {
  if (!state.foxRank) {
    return;
  }
  const lastSampleAt = Number(state.foxRank.qualityLastSampleAt) || 0;
  if (!lastSampleAt) {
    state.foxRank.qualityLastSampleAt = nowMs;
    return;
  }
  if ((nowMs - lastSampleAt) < FOX_RANK_SAMPLING.qualityMs) {
    return;
  }
  const draft = Array.isArray(state.foxRank.qualitySampleDraft) ? state.foxRank.qualitySampleDraft : [];
  if (!draft.length) {
    state.foxRank.qualityLastSampleAt = nowMs;
    return;
  }
  const avg = (list) => {
    if (!list.length) {
      return 0;
    }
    return list.reduce((sum, value) => sum + value, 0) / list.length;
  };
  const latencyList = draft.map((item) => Number(item.latencyMs)).filter((value) => Number.isFinite(value) && value > 0);
  const lossList = draft.map((item) => Number(item.lossRate)).filter((value) => Number.isFinite(value) && value >= 0);
  const downList = draft.map((item) => Number(item.downRate)).filter((value) => Number.isFinite(value) && value >= 0);
  const upList = draft.map((item) => Number(item.upRate)).filter((value) => Number.isFinite(value) && value >= 0);
  const runningRatio = avg(draft.map((item) => (item.running ? 1 : 0)));
  const sample = {
    at: nowMs,
    latencyMs: avg(latencyList),
    lossRate: avg(lossList),
    downRate: avg(downList),
    upRate: avg(upList),
    running: runningRatio >= 0.5,
  };
  const samples = Array.isArray(state.foxRank.qualitySamples) ? state.foxRank.qualitySamples.slice() : [];
  samples.push(sample);
  state.foxRank.qualitySamples = samples.slice(-FOX_RANK_SAMPLING.qualityHistoryLimit);
  state.foxRank.qualitySampleDraft = [];
  state.foxRank.qualityLastSampleAt = nowMs;

  const recent = state.foxRank.qualitySamples.slice(-12);
  state.foxRank.avgLatencyMs = avg(recent.map((item) => Number(item.latencyMs)).filter((value) => Number.isFinite(value) && value > 0));
  state.foxRank.avgLossRate = avg(recent.map((item) => Number(item.lossRate)).filter((value) => Number.isFinite(value) && value >= 0));
  state.foxRank.avgDownRate = avg(recent.map((item) => Number(item.downRate)).filter((value) => Number.isFinite(value) && value >= 0));
  state.foxRank.avgUpRate = avg(recent.map((item) => Number(item.upRate)).filter((value) => Number.isFinite(value) && value >= 0));
}

function updateFoxRankFromOverviewSnapshot(data) {
  if (!data || !state.foxRank) {
    return;
  }
  const running = Boolean(data.running);
  const overviewUptime = Number.parseFloat(data.uptimeSec);
  const jsTrackedUptime = calculateMihomoUptime();
  const uptime = Number.isFinite(overviewUptime) && overviewUptime >= 0
    ? overviewUptime
    : (Number.isFinite(jsTrackedUptime) && jsTrackedUptime >= 0 ? jsTrackedUptime : NaN);
  const nowMs = Date.now();
  const nowSec = nowMs / 1000;
  if (!state.foxRank.runningStateKnown) {
    state.foxRank.lastRunning = running;
    state.foxRank.runningStateKnown = true;
  } else if (state.foxRank.lastRunning !== running) {
    if (state.foxRank.lastRunning && !running) {
      state.foxRank.disconnectCount = Math.max(0, Number(state.foxRank.disconnectCount) || 0) + 1;
      state.foxRank.lastDisconnectAt = nowMs;
    } else if (!state.foxRank.lastRunning && running) {
      const lastDisconnectAt = Number(state.foxRank.lastDisconnectAt) || 0;
      if (lastDisconnectAt > 0) {
        state.foxRank.reconnectCount = Math.max(0, Number(state.foxRank.reconnectCount) || 0) + 1;
        state.foxRank.reconnectDelayMsTotal = Math.max(0, Number(state.foxRank.reconnectDelayMsTotal) || 0)
          + Math.max(0, nowMs - lastDisconnectAt);
      }
      state.foxRank.lastDisconnectAt = 0;
    }
    state.foxRank.lastRunning = running;
  }
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
    const stableDaysByUsage = Math.floor(Math.max(0, Number(state.foxRank.totalUsageSec || 0)) / 86400);
    state.foxRank.stableDays = Math.min(3650, stableDaysByUsage);
    state.foxRank.lastStableDay = getTodayKey();
    pushFoxRankUsageSample(nowMs);
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
      showToast(`Exploration +4 XP • ${formatFoxRankText('hops', { count: state.foxRank.explorationCount }, `${state.foxRank.explorationCount} hops`)}`, 'info');
    }
  }
  collectFoxRankQualityDraft(data, nowMs, running);
  foldFoxRankQualitySample(nowMs);
  state.foxRank.qualityScore = computeFoxRankQualityScore({
    ...data,
    avgLatencyMs: Number(state.foxRank.avgLatencyMs) || 0,
    avgLossRate: Number(state.foxRank.avgLossRate) || 0,
    avgDownRate: Number(state.foxRank.avgDownRate) || 0,
    avgUpRate: Number(state.foxRank.avgUpRate) || 0,
    disconnectCount: Number(state.foxRank.disconnectCount) || 0,
    reconnectCount: Number(state.foxRank.reconnectCount) || 0,
    reconnectDelayMsTotal: Number(state.foxRank.reconnectDelayMsTotal) || 0,
  });
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
    setNodeTextIfChanged(foxRankTierName, getFoxRankTierDualText(tier));
    foxRankTierName.style.color = tier.colorStart || '#ffd86a';
  }
  if (foxRankLevelText) {
    setNodeTextIfChanged(foxRankLevelText, getFoxRankTierLevelText(tier));
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
    const stabilityText = formatFoxRankStableDays(data.stabilityDays);
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
    const shouldWarn = data.progress >= 0.8 && data.progress < 1;
    foxRankWarningChip.hidden = false;
    foxRankWarningChip.classList.toggle('is-alert', shouldWarn);
    setNodeTextIfChanged(
      foxRankWarningChip,
      shouldWarn
        ? foxRankText('ascendSoon', '即将升阶')
        : foxRankText('upgrading', '升级中'),
    );
  }
  if (foxRankExploreCount) {
    setNodeTextIfChanged(foxRankExploreCount, String(data.explorationCount));
  }
  if (foxRankSkinHint) {
    setNodeTextIfChanged(foxRankSkinHint, formatFoxRankText('activeSkinShort', { skin: foxRankText('skin', 'Skin'), name: data.activeSkin.name }, `Skin: ${data.activeSkin.name}`));
  }
  if (foxRankCard) {
    foxRankCard.classList.toggle('is-ascend-near', data.progress >= 0.8);
  }
  applyFoxRankSkinPalette(data);
  syncFoxRankSkinThemeSetting(data);
  renderFoxRankDetailPanel(data);
  if (!suppressBrief) {
    maybeOpenFoxRankBrief(data);
  }
}

async function loadStatusSilently() {
  if (!isMainWindowVisible()) {
    return { ok: false, error: 'window_hidden' };
  }
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
  if (!isMainWindowVisible()) {
    return;
  }
  const response = await loadStatusSilently();
  if (!response.ok) {
    const msg = response.error === 'bridge_missing' ? t('labels.bridgeMissing') : (response.error || ti('labels.statusError', 'Status error'));
    showToast(msg, 'error');
    return;
  }
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
  const enabled = Boolean(state.settings?.proxy?.tun);
  const stack = normalizeTunStack(state.settings?.proxy?.stack);
  const retryableErrors = new Set(['request_failed', 'controller_missing', 'helper_unreachable', 'socket_missing']);
  let response = null;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    response = await updateTunViaController({ enable: enabled, stack });
    if (response && response.ok) {
      break;
    }
    const errorCode = String((response && response.error) || '').trim();
    if (!retryableErrors.has(errorCode) || attempt === 4) {
      break;
    }
    await sleep(250 * attempt);
  }
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
  if (!isMainWindowVisible()) {
    return false;
  }
  if (state.overviewLoading) {
    return false;
  }
  state.overviewLoading = true;
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
      if (showToastOnSuccess) {
        showToast(response.error || ti('labels.overviewError', 'Overview error'), 'error');
      }
      return false;
    }
    const mergedOverviewData = networkSnapshot && networkSnapshot.ok && networkSnapshot.data
      ? { ...(response.data || {}), ...networkSnapshot.data }
      : response.data;
    updateOverviewUI(mergedOverviewData);
    if (showToastOnSuccess) {
      showToast(t('labels.statusRefreshed'));
    }
    return true;
  } catch {
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
      tunSynced = true;
      return { ok: true, data: { enabled: Boolean(state.settings?.proxy?.tun) }, error: response.error };
    }
    const fetched = await fetchTunFromController();
    if (fetched && typeof fetched.enabled === 'boolean') {
      if (tunToggle) tunToggle.checked = fetched.enabled;
      const fetchedStack = normalizeTunStack(fetched.stack);
      if (tunStackSelect) tunStackSelect.value = fetchedStack;
      syncRuntimeTunState(fetched.enabled, fetchedStack);
      tunSynced = true;
      return { ok: true, data: { enabled: fetched.enabled, stack: fetchedStack }, error: response.error };
    }
    return response;
  }
  if (tunToggle && typeof response.data.enabled === 'boolean') {
    tunToggle.checked = response.data.enabled;
  }
  if (tunStackSelect && typeof response.data.stack === 'string') {
    const stack = normalizeTunStack(response.data.stack);
    tunStackSelect.value = stack;
  }
  if (typeof response.data.enabled === 'boolean' || typeof response.data.stack === 'string') {
    syncRuntimeTunState(
      typeof response.data.enabled === 'boolean' ? response.data.enabled : undefined,
      typeof response.data.stack === 'string' ? response.data.stack : null,
    );
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
  try {
    const response = await fetchProviderSubscriptionOverview(window.clashfox);
    if (response && response.ok && response.data) {
      renderProviderSubscriptionOverview(response.data);
      return;
    }
    const fallbackResponse = await fetchMihomoProvidersProxies(getMihomoApiSource());
    if (!fallbackResponse || !fallbackResponse.ok || !fallbackResponse.data) {
      if (!state.providerSubscriptionRenderSignature) {
        renderProviderSubscriptionOverview({ items: [], summary: { providerCount: 0 } });
      }
      return;
    }
    const overviewData = buildProviderSubscriptionOverviewData(fallbackResponse.data);
    renderProviderSubscriptionOverview(overviewData);
  } catch {
    if (!state.providerSubscriptionRenderSignature) {
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
  try {
    const source = getMihomoApiSource();
    const [rulesResp, providerResp] = await Promise.all([
      fetchMihomoRules(source),
      fetchMihomoProvidersRules(source),
    ]);
    const hasRules = Boolean(rulesResp && rulesResp.ok && rulesResp.data);
    const hasProviders = Boolean(providerResp && providerResp.ok && providerResp.data);
    if (!hasRules && !hasProviders) {
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
      state.rulesOverviewPayload = buildRulesOverviewData(rulesResp.data);
    } else if (!state.rulesOverviewPayload) {
      state.rulesOverviewPayload = { totalRules: 0, types: [], records: [] };
    }
    if (hasProviders) {
      state.ruleProvidersOverviewPayload = buildRuleProvidersOverviewData(providerResp.data);
    } else if (!state.ruleProvidersOverviewPayload) {
      state.ruleProvidersOverviewPayload = { totalProviders: 0, totalRules: 0, behaviors: [], items: [], records: [] };
    }
    renderRulesOverviewCard();
  } catch {
    if (
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
  if (typeof state.settings?.configFileDir === 'string') {
    candidates.push(state.settings.configFileDir);
  }
  if (state.settings?.userDataPaths && typeof state.settings.userDataPaths.configFile === 'string') {
    candidates.push(state.settings.userDataPaths.configFile);
  }
  if (state.settings?.userDataPaths && typeof state.settings.userDataPaths.configFileDir === 'string') {
    candidates.push(state.settings.userDataPaths.configFileDir);
  }
  if (state.fileSettings?.userDataPaths && typeof state.fileSettings.userDataPaths.configFile === 'string') {
    candidates.push(state.fileSettings.userDataPaths.configFile);
  }
  if (state.fileSettings?.userDataPaths && typeof state.fileSettings.userDataPaths.configFileDir === 'string') {
    candidates.push(state.fileSettings.userDataPaths.configFileDir);
  }
  if (typeof state.configDefault === 'string' && state.configDefault.trim()) {
    candidates.push(state.configDefault);
  }
  const explicit = candidates.find((value) => value && value.trim());
  const selected = (explicit || state.configDefault || '').trim();
  if (!selected) {
    return '';
  }
  if (selected.startsWith('/') || /^[A-Za-z]:[\\/]/.test(selected)) {
    return selected;
  }
  const userDataPaths = state.settings?.userDataPaths || {};
  const userAppDataDir = String(userDataPaths.userAppDataDir || '').trim();
  const configDir = String(userDataPaths.configDir || 'config').trim() || 'config';
  if (!userAppDataDir) {
    return selected;
  }
  const base = userAppDataDir.replace(/[\\/]+$/, '');
  return `${base}/${configDir}/${selected}`.replace(/\/+/g, '/');
}

function normalizeConfigPathKey(value = '') {
  const text = String(value || '').trim();
  if (!text) {
    return { full: '', base: '' };
  }
  const normalizedFull = text.replace(/\\/g, '/').replace(/\/+$/, '');
  const parts = normalizedFull.split('/').filter(Boolean);
  return {
    full: normalizedFull,
    base: parts.length ? parts[parts.length - 1] : normalizedFull,
  };
}

function isCurrentConfigPath(candidatePath = '', currentPath = '') {
  const candidate = normalizeConfigPathKey(candidatePath);
  const current = normalizeConfigPathKey(currentPath);
  if (!candidate.full || !current.full) {
    return false;
  }
  return candidate.full === current.full || candidate.base === current.base;
}

function syncRuntimeTunState(tunEnabled, tunStack = null) {
  if (!state.settings) {
    state.settings = { ...DEFAULT_SETTINGS };
  }
  if (!state.settings.proxy || typeof state.settings.proxy !== 'object') {
    state.settings.proxy = {};
  }
  if (typeof tunEnabled === 'boolean') {
    state.settings.proxy.tun = tunEnabled;
  }
  if (typeof tunStack === 'string' && tunStack) {
    const normalizedStack = normalizeTunStack(tunStack);
    state.settings.proxy.stack = normalizedStack;
  }
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
  } catch {
    // ignore
  }
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
    const isCurrent = currentPath && isCurrentConfigPath(item.path, currentPath);
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
  const backupRe = /^mihomo\.backup\.(mihomo-darwin-(amd64|arm64|x64)-.+)\.([0-9]{8}_[0-9]{6})$/;

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

async function restartKernel() {
  const confirmed = await promptConfirm({
    title: t('confirm.restartKernelTitle'),
    body: t('confirm.restartKernelBody'),
    confirmLabel: t('confirm.restartKernelConfirm'),
    confirmTone: 'primary',
  });
  if (!confirmed) {
    return;
  }
  
  try {
    const source = resolveMihomoApiSourceFromState(state);
    const response = await reloadMihomoCore(source, window.clashfox);
    if (response.ok) {
      showToast(t('labels.restartSuccess'));
      await loadStatus();
    } else {
      showToast(response.error || ti('labels.restartFailed', 'Restart failed'), 'error');
    }
  } catch (error) {
    showToast(ti('labels.restartFailed', 'Restart failed'), 'error');
  }
}

async function loadConfigs(showToastOnSuccess = false) {
  const response = await runCommand('configs');
  if (!response.ok) {
    showToast(response.error || ti('labels.configsError', 'Configs error'), 'error');
    return;
  }
  state.configs = response.data || [];
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
  if (!isMainWindowVisible() || (!logTableBody && !logContent)) {
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
  foxRankDetailCard = document.getElementById('foxRankDetailCard');
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
  kernelSourcePicker = document.getElementById('kernelSourcePicker');
  kernelSourceCards = Array.from(document.querySelectorAll('.kernel-source-card'));
  installBtn = document.getElementById('installBtn');
  updateBtn = document.getElementById('updateBtn');
  installStatus = document.getElementById('installStatus');
  installCurrentKernel = document.getElementById('installCurrentKernel');
  installVersionRow = document.getElementById('installVersionRow');
  installVersionMode = document.getElementById('installVersionMode');
  installVersion = document.getElementById('installVersion');
  installVersionRefreshBtn = document.getElementById('installVersionRefreshBtn');
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
  panelInstallBtn = document.getElementById('panelInstallBtn');
  panelUpdateBtn = document.getElementById('panelUpdateBtn');
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
  configsReload = document.getElementById('configsReload');
  configTable = document.getElementById('configTable');
  configPrev = document.getElementById('configPrev');
  configNext = document.getElementById('configNext');
  configPageInfo = document.getElementById('configPageInfo');
  configPageSize = document.getElementById('configPageSize');
  kernelTable = document.getElementById('kernelTable');
  kernelRefresh = document.getElementById('kernelRefresh');
  kernelRestart = document.getElementById('kernelRestart');
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
  updateGuidePrimaryBtn = document.getElementById('updateGuidePrimaryBtn');
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
  settingsHelperDir = document.getElementById('settingsHelperDir');
  settingsLogDir = document.getElementById('settingsLogDir');
  settingsConfigDirReveal = document.getElementById('settingsConfigDirReveal');
  settingsCoreDirReveal = document.getElementById('settingsCoreDirReveal');
  settingsDataDirReveal = document.getElementById('settingsDataDirReveal');
  settingsHelperDirReveal = document.getElementById('settingsHelperDirReveal');
  settingsLogDirReveal = document.getElementById('settingsLogDirReveal');
  helperInstallBtn = document.getElementById('helperInstallBtn');
  helperUninstallBtn = document.getElementById('helperUninstallBtn');
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
  settingsTrayMenuPanel = document.getElementById('settingsTrayMenuPanel');
  settingsTrayMenuDashboard = document.getElementById('settingsTrayMenuDashboard');
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
        if (trayAction === 'open-foxboard') {
          maybeShowFoxRankImpactHint();
        }
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
      const nextCollapsed = !(state.settings && state.settings.appearance && state.settings.appearance.sidebarCollapsed);
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
  if (currentPage !== 'overview') {
    loadStatusSilently().catch(() => {});
  }
  if (currentPage === 'kernel') {
    loadKernels();
  }
  if (currentPage === 'kernel') {
    loadBackups();
  }
  if (currentPage === 'overview') {
    if (!state.providerSubscriptionRenderSignature) {
      renderProviderSubscriptionOverview({ items: [], summary: { providerCount: 0 } });
    }
    if (
      !state.rulesOverviewPayload
      && !state.ruleProvidersOverviewPayload
      && !state.rulesOverviewRenderSignatures.records
      && !state.rulesOverviewRenderSignatures.chart
    ) {
      state.rulesOverviewPayload = { totalRules: 0, types: [], records: [] };
      state.ruleProvidersOverviewPayload = { totalProviders: 0, totalRules: 0, behaviors: [], items: [], records: [] };
      renderRulesOverviewCard();
    }
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
    // Silent error handling in production
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

function isMainWindowVisible() {
  return Boolean(appWindowVisible) && !document.hidden;
}

function stopOverviewActivity() {
  if (state.coreStatusTimer) {
    clearInterval(state.coreStatusTimer);
    state.coreStatusTimer = null;
  }
  if (state.overviewTimer) {
    clearInterval(state.overviewTimer);
    state.overviewTimer = null;
  }
  if (state.overviewTickTimer) {
    clearInterval(state.overviewTickTimer);
    state.overviewTickTimer = null;
  }
  if (state.providerSubscriptionTimer) {
    clearInterval(state.providerSubscriptionTimer);
    state.providerSubscriptionTimer = null;
  }
  if (state.rulesOverviewTimer) {
    clearInterval(state.rulesOverviewTimer);
    state.rulesOverviewTimer = null;
  }
  if (state.trafficTimer) {
    clearInterval(state.trafficTimer);
    state.trafficTimer = null;
  }
  if (state.overviewLiteTimer) {
    clearInterval(state.overviewLiteTimer);
    state.overviewLiteTimer = null;
  }
  if (state.overviewMemoryTimer) {
    clearInterval(state.overviewMemoryTimer);
    state.overviewMemoryTimer = null;
  }
  closeMihomoConnectionsSocket();
  closeMihomoTrafficSocket();
  closeMihomoMemorySocket();
  closeMihomoLogsSocket();
  stopTopologyTicker();
}

function stopFoxRankActivity() {
  if (state.foxRankTimer) {
    clearInterval(state.foxRankTimer);
    state.foxRankTimer = null;
  }
}

function startFoxRankActivity() {
  if (!isMainWindowVisible()) {
    stopFoxRankActivity();
    return;
  }
  if (currentPage === 'overview') {
    stopFoxRankActivity();
    return;
  }
  if (state.foxRankTimer) {
    return;
  }
  state.foxRankTimer = setInterval(() => {
    if (!isMainWindowVisible() || currentPage === 'overview') {
      return;
    }
    refreshFoxRankSnapshotSilently().catch(() => {});
  }, FOX_RANK_SAMPLING.pollMs);
  refreshFoxRankSnapshotSilently().catch(() => {});
}

async function refreshFoxRankSnapshotSilently() {
  if (!isMainWindowVisible() || !state.foxRank || currentPage === 'overview') {
    return;
  }
  const nowMs = Date.now();
  const configPath = getCurrentConfigPath();
  const args = ['--cache-ttl', '1'];
  const trafficArgs = [];
  if (configPath) {
    args.push('--config', configPath);
    trafficArgs.push('--config', configPath);
  }
  args.push(...getControllerArgs());
  trafficArgs.push(...getControllerArgs());
  const shouldFetchTraffic = !state.foxRank.lastTrafficProbeAt
    || (nowMs - Number(state.foxRank.lastTrafficProbeAt || 0) >= FOX_RANK_SAMPLING.qualityMs);
  if (shouldFetchTraffic) {
    state.foxRank.lastTrafficProbeAt = nowMs;
  }
  const [statusResp, overviewResp, networkSnapshot, trafficResp] = await Promise.all([
    loadStatusSilently(),
    runCommand('overview', args),
    window.clashfox && typeof window.clashfox.getOverviewNetworkSnapshot === 'function'
      ? window.clashfox.getOverviewNetworkSnapshot()
      : Promise.resolve({ ok: false }),
    shouldFetchTraffic
      ? runCommand('traffic', trafficArgs)
      : Promise.resolve({ ok: true, data: { down: Number(state.foxRank.avgDownRate) || 0, up: Number(state.foxRank.avgUpRate) || 0 } }),
  ]);
  const trafficData = trafficResp && trafficResp.ok && trafficResp.data ? trafficResp.data : null;
  const trafficPatch = trafficData
    ? {
      downRate: Number(trafficData.down ?? trafficData.download ?? trafficData.rx ?? 0) || 0,
      upRate: Number(trafficData.up ?? trafficData.upload ?? trafficData.tx ?? 0) || 0,
    }
    : {};
  if (!(statusResp && statusResp.ok)) {
    return;
  }
  const statusRunning = Boolean(statusResp && statusResp.data && statusResp.data.running);
  if (statusRunning && !state.mihomoStartTime && !getMihomoStartTime()) {
    startMihomoUptimeTracking();
  }
  if (!(overviewResp && overviewResp.ok && overviewResp.data)) {
    // Fallback: keep Fox Rank usage moving even when overview snapshots are temporarily unavailable.
    updateFoxRankFromOverviewSnapshot({
      running: statusRunning,
      uptimeSec: calculateMihomoUptime(),
      internetMs: parseInt(String(state.overviewLatencySnapshot.internet || '').replace(/[^\d.-]/g, ''), 10),
      dnsMs: parseInt(String(state.overviewLatencySnapshot.dns || '').replace(/[^\d.-]/g, ''), 10),
      routerMs: parseInt(String(state.overviewLatencySnapshot.router || '').replace(/[^\d.-]/g, ''), 10),
      ...trafficPatch,
    });
    return;
  }
  const mergedOverviewData = networkSnapshot && networkSnapshot.ok && networkSnapshot.data
    ? { ...(overviewResp.data || {}), ...networkSnapshot.data, ...trafficPatch }
    : { ...(overviewResp.data || {}), ...trafficPatch };
  if (!Object.prototype.hasOwnProperty.call(mergedOverviewData || {}, 'running')) {
    mergedOverviewData.running = statusRunning;
  }
  const overviewUptime = Number.parseFloat(mergedOverviewData.uptimeSec);
  if (!Number.isFinite(overviewUptime) || overviewUptime < 0) {
    mergedOverviewData.uptimeSec = calculateMihomoUptime();
  }
  updateFoxRankFromOverviewSnapshot(mergedOverviewData);
}

async function syncMainWindowActivity() {
  if (!isMainWindowVisible()) {
    stopOverviewActivity();
    stopFoxRankActivity();
    closeMihomoPageLogsSocket();
    if (dashboardLocalModule && typeof dashboardLocalModule.teardownDashboardPanel === 'function' && currentPage === 'dashboard') {
      dashboardLocalModule.teardownDashboardPanel();
      state.dashboardLoaded = false;
    }
    return;
  }
  if (currentPage === 'dashboard') {
    await initDashboardFrame();
  } else if (dashboardLocalModule && typeof dashboardLocalModule.teardownDashboardPanel === 'function' && state.dashboardLoaded) {
    dashboardLocalModule.teardownDashboardPanel();
    state.dashboardLoaded = false;
  }
  if (currentPage === 'overview') {
    stopFoxRankActivity();
    startOverviewTimer();
    connectMihomoConnectionsStream();
    connectMihomoTrafficStream();
    connectMihomoMemoryStream();
    connectMihomoLogsStream();
    startTopologyTicker();
    loadStatusSilently().catch(() => {});
    Promise.all([
      loadOverview(),
      loadProviderSubscriptionOverview(),
      loadRulesOverviewCard(),
    ]).catch(() => {});
  } else {
    stopOverviewActivity();
    startFoxRankActivity();
  }
  if (currentPage === 'logs') {
    loadLogs();
  } else {
    closeMihomoPageLogsSocket();
  }
}

async function navigatePage(targetPage, pushState = true) {
  const normalized = String(targetPage || '').trim();
  if (!VALID_PAGES.has(normalized)) {
    return;
  }
  if (currentPage === 'dashboard' && normalized !== 'dashboard' && dashboardLocalModule && typeof dashboardLocalModule.teardownDashboardPanel === 'function') {
    dashboardLocalModule.teardownDashboardPanel();
  }
  if (currentPage === 'overview') {
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
  await syncMainWindowActivity();
  if (normalized === 'config') {
    maybeShowFoxRankImpactHint();
  }
  if (pushState) {
    history.pushState({ page: normalized }, '', `${normalized}.html`);
  }
}

window.addEventListener('beforeunload', () => {
  if (dashboardLocalModule && typeof dashboardLocalModule.teardownDashboardPanel === 'function') {
    dashboardLocalModule.teardownDashboardPanel();
  }
  stopOverviewActivity();
  stopFoxRankActivity();
  closeMihomoConnectionsSocket();
  closeMihomoTrafficSocket();
  closeMihomoMemorySocket();
  closeMihomoLogsSocket();
  closeMihomoPageLogsSocket();
  stopTopologyTicker();
  if (currentPage === 'overview') {
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
  bindKernelInstallControls();
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
  if (foxRankBadgeList && foxRankBadgeList.dataset.bound !== 'true') {
    foxRankBadgeList.dataset.bound = 'true';
    foxRankBadgeList.addEventListener('click', (event) => {
      const action = event.target && event.target.closest
        ? event.target.closest('[data-fox-rank-showcase]')
        : null;
      if (!action) {
        return;
      }
      setFoxRankShowcasedBadge(String(action.dataset.foxRankShowcase || ''));
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
      saveSettings({debugMode: enabled});
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
      saveSettings({windowWidth: next});
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
      saveSettings({windowHeight: next});
    });
  }

  if (settingsAcceptBeta) {
    settingsAcceptBeta.addEventListener('change', (event) => {
      const enabled = Boolean(event.target.checked);
      saveSettings({acceptBeta: enabled});
    });
  }

  if (settingsTrayMenuChart) {
    settingsTrayMenuChart.addEventListener('change', (event) => {
      const enabled = Boolean(event.target.checked);
      saveSettings({chartEnabled: enabled});
    });
  }

  if (settingsTrayMenuProviderTraffic) {
    settingsTrayMenuProviderTraffic.addEventListener('change', (event) => {
      const enabled = Boolean(event.target.checked);
      saveSettings({providerTrafficEnabled: enabled});
    });
  }

  if (settingsTrayMenuTrackers) {
    settingsTrayMenuTrackers.addEventListener('change', (event) => {
      const enabled = Boolean(event.target.checked);
      saveSettings({trackersEnabled: enabled});
    });
  }

  if (settingsTrayMenuFoxboard) {
    settingsTrayMenuFoxboard.addEventListener('change', (event) => {
      const enabled = Boolean(event.target.checked);
      saveSettings({foxboardEnabled: enabled});
    });
  }

  if (settingsTrayMenuPanel) {
    settingsTrayMenuPanel.addEventListener('change', (event) => {
      const enabled = Boolean(event.target.checked);
      saveSettings({panelEnabled: enabled});
    });
  }

  if (settingsTrayMenuDashboard) {
    settingsTrayMenuDashboard.addEventListener('change', (event) => {
      const enabled = Boolean(event.target.checked);
      saveSettings({dashboardEnabled: enabled});
    });
  }

  if (settingsTrayMenuKernelManager) {
    settingsTrayMenuKernelManager.addEventListener('change', (event) => {
      const enabled = Boolean(event.target.checked);
      saveSettings({kernelManagerEnabled: enabled});
    });
  }

  if (settingsTrayMenuDirectoryLocations) {
    settingsTrayMenuDirectoryLocations.addEventListener('change', (event) => {
      const enabled = Boolean(event.target.checked);
      saveSettings({directoryLocationsEnabled: enabled});
    });
  }

  if (settingsTrayMenuCopyShellExport) {
    settingsTrayMenuCopyShellExport.addEventListener('change', (event) => {
      const enabled = Boolean(event.target.checked);
      saveSettings({copyShellExportCommandEnabled: enabled});
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
      const fallback = Number.parseInt(String(state.settings.proxy?.mixedPort ?? 7893), 10) || 7893;
      const next = normalizeProxyPortSetting(event.target.value, fallback);
      const previous = fallback;
      event.target.value = next;
      event.target.disabled = true;
      try {
        const response = await updateMihomoConfigViaController({'mixed-port': next}, getMihomoApiSource());
        if (!response || !response.ok) {
          event.target.value = previous;
          const detail = response && (response.details || response.error)
              ? `: ${String(response.details || response.error)}`
              : '';
          showToast(`${ti('settings.proxyMixedPortUpdateFailed', 'Mixed port update failed')}${detail}`, 'error');
          return;
        }
        saveSettings({mixedPort: next}, { forceWrite: true });
      } finally {
        event.target.disabled = false;
      }
    });
  }

  if (settingsProxyPort) {
    settingsProxyPort.addEventListener('change', async (event) => {
      const fallback = Number.parseInt(String(state.settings.proxy?.port ?? 7890), 10) || 7890;
      const next = normalizeProxyPortSetting(event.target.value, fallback);
      const previous = fallback;
      event.target.value = next;
      event.target.disabled = true;
      try {
        const response = await updateMihomoConfigViaController({port: next}, getMihomoApiSource());
        if (!response || !response.ok) {
          event.target.value = previous;
          const detail = response && (response.details || response.error)
              ? `: ${String(response.details || response.error)}`
              : '';
          showToast(`${ti('settings.proxyPortUpdateFailed', 'Port update failed')}${detail}`, 'error');
          return;
        }
        saveSettings({port: next}, { forceWrite: true });
      } finally {
        event.target.disabled = false;
      }
    });
  }

  if (settingsProxySocksPort) {
    settingsProxySocksPort.addEventListener('change', async (event) => {
      const fallback = Number.parseInt(String(state.settings.proxy?.socksPort ?? 7891), 10) || 7891;
      const next = normalizeProxyPortSetting(event.target.value, fallback);
      const previous = fallback;
      event.target.value = next;
      event.target.disabled = true;
      try {
        const response = await updateMihomoConfigViaController({'socks-port': next}, getMihomoApiSource());
        if (!response || !response.ok) {
          event.target.value = previous;
          const detail = response && (response.details || response.error)
              ? `: ${String(response.details || response.error)}`
              : '';
          showToast(`${ti('settings.proxySocksPortUpdateFailed', 'Socks port update failed')}${detail}`, 'error');
          return;
        }
        saveSettings({socksPort: next}, { forceWrite: true });
      } finally {
        event.target.disabled = false;
      }
    });
  }

  if (settingsProxyAllowLan) {
    settingsProxyAllowLan.addEventListener('change', async (event) => {
      const nextChecked = Boolean(event.target.checked);
      const previousChecked = Boolean(state.settings.proxy?.allowLan);
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
        saveSettings({allowLan: nextChecked}, { forceWrite: true });
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
    return resolveAbsolutePath(value);
  }
  const placeholder = (inputEl.placeholder || '').trim();
  if (placeholder && placeholder !== '-') {
    return resolveAbsolutePath(placeholder);
  }
  return '';
};

// Display-only path resolver. Does not mutate settings or storage.
const resolveAbsolutePath = (relativePath) => {
  const inputPath = String(relativePath || '').trim();
  if (!inputPath) {
    return '';
  }
  const userDataPaths = state.settings?.userDataPaths || {};
  const userAppDataDir = userDataPaths.userAppDataDir || '';
  if (!userAppDataDir) {
    return inputPath;
  }
  if (inputPath.startsWith('/') || inputPath.startsWith('~') || /^[A-Za-z]:/.test(inputPath)) {
    return inputPath;
  }
  return userAppDataDir.endsWith('/')
    ? `${userAppDataDir}${inputPath}`
    : `${userAppDataDir}/${inputPath}`;
};

async function refreshHelperInstallPath() {
  if (!helperInstallPath) {
    return;
  }
  const response = await getHelperInstallPath();
  if (response && response.ok) {
    helperInstallPath.textContent = response.path || '-';
    helperInstallPath.dataset.exists = response.exists ? 'true' : 'false';
    return;
  }
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
    const updateAvailable = Boolean(snapshot && (snapshot.updateAvailable ?? snapshot.helperUpdateAvailable));
    if (!installed) {
      helperPrimaryAction = 'install';
    } else if (updateAvailable) {
      helperPrimaryAction = 'update';
    } else {
      helperPrimaryAction = null;
    }
    if (!helperInstallBtn) {
      return;
    }
    helperInstallBtn.classList.toggle('is-hidden', installed && !updateAvailable);
    if (helperPrimaryAction === 'update') {
      helperInstallBtn.textContent = ti('settings.helperUpdate', 'Update');
      helperInstallBtn.dataset.helperAction = helperPrimaryAction;
    } else if (!installed) {
      helperInstallBtn.textContent = ti('settings.helperInstall', 'Install');
      helperInstallBtn.dataset.helperAction = 'install';
    } else {
      helperInstallBtn.dataset.helperAction = '';
    }
    if (helperCheckUpdateBtn) {
      // Only show "Check updates" after helper is installed.
      helperCheckUpdateBtn.classList.toggle('is-hidden', !installed);
    }
    if (helperUninstallBtn) {
      helperUninstallBtn.classList.toggle('is-hidden', !installed);
    }
    if (helperRefreshBtn) {
      helperRefreshBtn.classList.toggle('is-hidden', installed);
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
    const version = normalizeVersionForDisplay(snapshot.version || snapshot.helperVersion || '');
    const onlineVersionText = normalizeVersionForDisplay(snapshot.onlineVersion || snapshot.helperOnlineVersion || '');
    const updateAvailable = Boolean((snapshot.updateAvailable ?? snapshot.helperUpdateAvailable) && version && onlineVersionText);
    helperVersionText.dataset.updateAvailable = updateAvailable ? 'true' : 'false';
    if (updateAvailable) {
      helperVersionText.innerHTML = `Version: <span class="helper-version-current">${version}</span> -> <span class="helper-version-target">${onlineVersionText}</span>`;
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
      return;
    }
  } catch (err) {
  }

  await hydrateHelperStatusFromFile();
  const cached = getCachedHelperStatus();
  if (cached) {
    applyHelperStatusSnapshot(cached);
  }
}

async function refreshHelperPanel(force = false) {
  await hydrateHelperStatusFromFile();
  await Promise.all([
    refreshHelperStatus(force),
    refreshHelperInstallPath(),
    Promise.resolve(refreshHelperLogPath()),
  ]);
}

window.__refreshHelperPanel = refreshHelperPanel;

async function revealSettingsDirectory(targetPath) {
  if (!targetPath || !window.clashfox || typeof window.clashfox.revealInFinder !== 'function') {
    return;
  }
  const result = await window.clashfox.revealInFinder(targetPath);
  if (!result || !result.ok) {
    const detail = result && result.error ? `: ${String(result.error)}` : '';
    showToast(`${ti('settings.openDirFailed', 'Unable to open directory')}${detail}`, 'error');
  }
}

if (settingsConfigDirReveal) {
  settingsConfigDirReveal.addEventListener('click', async () => {
    const target = getRevealPath(settingsConfigDir);
    await revealSettingsDirectory(target);
  });
}

if (settingsCoreDirReveal) {
  settingsCoreDirReveal.addEventListener('click', async () => {
    const target = getRevealPath(settingsCoreDir);
    await revealSettingsDirectory(target);
  });
}

if (settingsDataDirReveal) {
  settingsDataDirReveal.addEventListener('click', async () => {
    const target = getRevealPath(settingsDataDir);
    await revealSettingsDirectory(target);
  });
}

if (settingsHelperDirReveal) {
  settingsHelperDirReveal.addEventListener('click', async () => {
    const target = getRevealPath(settingsHelperDir);
    await revealSettingsDirectory(target);
  });
}

if (settingsLogDirReveal) {
  settingsLogDirReveal.addEventListener('click', async () => {
    const target = getRevealPath(settingsLogDir);
    await revealSettingsDirectory(target);
  });
}

if (helperInstallBtn) {
  if (helperInstallBtn.dataset.bound !== 'true') {
    helperInstallBtn.dataset.bound = 'true';
    helperInstallBtn.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();
      const isUninstall = helperPrimaryAction === 'uninstall';
      const isUpdate = helperPrimaryAction === 'update';
      const pendingText = isUninstall
        ? ti('settings.helperUninstalling', 'Uninstalling helper...')
        : (isUpdate
          ? ti('settings.helperUpdating', 'Updating helper...')
          : ti('settings.helperInstalling', 'Installing helper...'));
      setHelperStatus('checking', pendingText);
      helperInstallBtn.disabled = true;
      try {
        const response = isUninstall
            ? await uninstallHelper()
            : await installHelper();
        if (response && response.error === 'bridge_missing') {
          setHelperStatus('error', ti('settings.helperInstallUnavailable', 'Helper installer unavailable'));
          showToast(ti('settings.helperInstallUnavailable', 'Helper installer unavailable'), 'error');
          return;
        }
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
        const message = `${isUninstall
            ? ti('settings.helperUninstallFailed', 'Helper uninstall failed')
            : (isUpdate
                ? ti('settings.helperUpdateFailed', 'Helper update failed')
                : ti('settings.helperInstallFailed', 'Helper install failed'))}${detail}`;
        setHelperStatus('error', message);
        showToast(message, 'error');
        if (response && response.rollback && typeof response.rollback === 'object') {
          const restored = Boolean(response.rollback.restored);
          showToast(
              restored
                  ? ti('settings.helperRollbackOk', 'Helper rollback completed')
                  : ti('settings.helperRollbackFailed', 'Helper rollback failed'),
              restored ? 'info' : 'error'
          );
        }
      } catch (err) {
        const detail = err && err.message ? `: ${String(err.message)}` : '';
        const message = `${isUninstall
            ? ti('settings.helperUninstallFailed', 'Helper uninstall failed')
            : (isUpdate
                ? ti('settings.helperUpdateFailed', 'Helper update failed')
                : ti('settings.helperInstallFailed', 'Helper install failed'))}${detail}`;
        setHelperStatus('error', message);
        showToast(message, 'error');
      } finally {
        helperInstallBtn.disabled = false;
      }
    });
  }
}

if (helperUninstallBtn) {
  if (helperUninstallBtn.dataset.bound !== 'true') {
    helperUninstallBtn.dataset.bound = 'true';
    helperUninstallBtn.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();
      helperUninstallBtn.disabled = true;
      try {
        setHelperStatus('checking', ti('settings.helperUninstalling', 'Uninstalling helper...'));
        const response = await uninstallHelper();
        if (response && response.error === 'bridge_missing') {
          setHelperStatus('error', ti('settings.helperInstallUnavailable', 'Helper installer unavailable'));
          showToast(ti('settings.helperInstallUnavailable', 'Helper installer unavailable'), 'error');
          return;
        }
        if (response && response.ok) {
          showToast(ti('settings.helperUninstallSuccess', 'Helper uninstalled'), 'info');
          await refreshHelperPanel(true);
          return;
        }
        const detail = response && (response.details || response.error)
          ? `: ${String(response.details || response.error)}`
          : '';
        const message = `${ti('settings.helperUninstallFailed', 'Helper uninstall failed')}${detail}`;
        setHelperStatus('error', message);
        showToast(message, 'error');
      } catch (err) {
        const detail = err && err.message ? `: ${String(err.message)}` : '';
        const message = `${ti('settings.helperUninstallFailed', 'Helper uninstall failed')}${detail}`;
        setHelperStatus('error', message);
        showToast(message, 'error');
      } finally {
        helperUninstallBtn.disabled = false;
      }
    });
  }
}

if (helperRepairBtn) {
  if (helperRepairBtn.dataset.bound !== 'true') {
    helperRepairBtn.dataset.bound = 'true';
    helperRepairBtn.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();
      setHelperStatus('checking', ti('settings.helperRepairing', 'Repairing helper...'));
      helperRepairBtn.disabled = true;
      try {
        const response = await repairHelper();
        if (response && response.error === 'bridge_missing') {
          setHelperStatus('error', ti('settings.helperInstallUnavailable', 'Helper installer unavailable'));
          showToast(ti('settings.helperInstallUnavailable', 'Helper installer unavailable'), 'error');
          return;
        }
        if (response && response.ok) {
          showToast(ti('settings.helperRepairSuccess', 'Helper repaired'), 'info');
          await refreshHelperPanel(true);
          return;
        }
        const detail = response && (response.details || response.error)
            ? `: ${String(response.details || response.error)}`
            : '';
        const message = `${ti('settings.helperRepairFailed', 'Helper repair failed')}${detail}`;
        setHelperStatus('error', message);
        showToast(message, 'error');
      } catch (err) {
        const detail = err && err.message ? `: ${String(err.message)}` : '';
        const message = `${ti('settings.helperRepairFailed', 'Helper repair failed')}${detail}`;
        setHelperStatus('error', message);
        showToast(message, 'error');
      } finally {
        helperRepairBtn.disabled = false;
      }
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
  helperRefreshBtn.addEventListener('click', async (event) => {
    event.preventDefault();
    event.stopPropagation();
    setHelperStatus('checking', ti('settings.helperRefreshing', 'Refreshing helper panel...'));
    helperRefreshBtn.disabled = true;
    try {
      await refreshHelperPanel(true);
    } finally {
      helperRefreshBtn.disabled = false;
    }
  });
}

if (helperCheckUpdateBtn) {
  if (helperCheckUpdateBtn.dataset.bound !== 'true') {
    helperCheckUpdateBtn.dataset.bound = 'true';
    helperCheckUpdateBtn.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();
      setHelperStatus('checking', ti('settings.helperCheckingUpdate', 'Checking helper updates...'));
      helperCheckUpdateBtn.disabled = true;
      try {
        const result = await checkHelperUpdates({force: true});
        if (result && result.error === 'bridge_missing') {
          showToast(ti('settings.helperUpdateCheckFailed', 'Failed to check helper updates'), 'error');
          return;
        }
        if (!result || !result.ok) {
          const detail = result && result.error ? `: ${String(result.error)}` : '';
          showToast(`${ti('settings.helperUpdateCheckFailed', 'Failed to check helper updates')}${detail}`, 'error');
        } else if (result.updateAvailable) {
          const onlineVersionText = normalizeVersionForDisplay(result.onlineVersion || '');
          showToast(
              onlineVersionText
                  ? `${ti('settings.helperUpdateFound', 'Helper update available')}: v${onlineVersionText}`
                  : ti('settings.helperUpdateFound', 'Helper update available'),
              'info'
          );
        } else if (String(result.onlineVersion || '').trim()) {
          const installedVersion = normalizeVersionForDisplay(result.installedVersion || '');
          const onlineVersionText = normalizeVersionForDisplay(result.onlineVersion || '');
          if (installedVersion) {
            showToast(ti('settings.helperAlreadyLatest', 'Helper is up to date.'), 'info');
          } else {
            showToast(`${ti('settings.helperLatestVersion', 'Latest helper version')}: v${onlineVersionText}`, 'info');
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
          // Silent error handling in production
        }
      } catch (err) {
        // Silent error handling in production
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
    await performMihomoInstall('install');
  });
}

if (updateBtn) {
  updateBtn.addEventListener('click', async () => {
    const source = normalizeKernelSource((githubUser && githubUser.value) || '') || 'vernesong';
    const choice = await promptUpdateGuide({
      title: ti('install.updateDialogTitle', 'Update Kernel'),
      body: ti('install.updateDialogBody', 'Choose an update channel to continue.'),
      primaryLabel: ti('install.updateDialogPrimaryAction', 'Update Kernel'),
      releaseLabel: source === 'vernesong' ? '' : ti('install.updateDialogReleaseAction', 'Update to Release'),
      alphaLabel: ti('install.updateDialogAlphaAction', 'Update to Alpha'),
    });
    if (!choice) {
      return;
    }
    const channel = choice === 'release'
        ? 'release'
        : (choice === 'alpha' ? 'alpha' : 'default');
    await performMihomoInstall({mode: 'update', channel});
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

function bindKernelInstallControls() {
  if (settingsGithubUser && settingsGithubUser.dataset.bound !== 'true') {
    settingsGithubUser.dataset.bound = 'true';
    settingsGithubUser.addEventListener('change', (event) => {
      const value = event.target.value;
      selectKernelSource(value, { persist: true });
    });
  }

  if (githubUser && githubUser.dataset.bound !== 'true') {
    githubUser.dataset.bound = 'true';
    githubUser.addEventListener('change', (event) => {
      const value = event.target.value;
      selectKernelSource(value, { persist: true });
    });
  }

  if (installVersionMode && installVersionMode.dataset.bound !== 'true') {
    installVersionMode.dataset.bound = 'true';
    installVersionMode.addEventListener('change', (event) => {
      const mode = normalizeInstallVersionMode(event.target.value || 'latest');
      installVersionMode.value = mode;
      saveSettings({ installVersionMode: mode });
      syncInstallVersionPickerUi();
    });
  }

  if (installVersion && installVersion.dataset.bound !== 'true') {
    installVersion.dataset.bound = 'true';
    const persistInstallVersion = () => {
      const value = String(installVersion.value || '').trim();
      saveSettings({ installVersion: value });
    };
    installVersion.addEventListener('change', persistInstallVersion);
    installVersion.addEventListener('blur', persistInstallVersion);
  }

  if (installVersionRefreshBtn && installVersionRefreshBtn.dataset.bound !== 'true') {
    installVersionRefreshBtn.dataset.bound = 'true';
    installVersionRefreshBtn.addEventListener('click', async () => {
      const currentUser =
        (githubUser && githubUser.value) ||
        (settingsGithubUser && settingsGithubUser.value) ||
        (state.settings && state.settings.githubUser) ||
        '';
      if (String(currentUser).toLowerCase() !== 'metacubex') {
        return;
      }
      installVersionRefreshBtn.disabled = true;
      installVersionRefreshBtn.classList.add('is-loading');
      try {
        await ensureMetaCubeXVersionCatalog(true);
      } finally {
        installVersionRefreshBtn.classList.remove('is-loading');
        updateInstallVersionVisibility();
      }
    });
  }

  if (Array.isArray(kernelSourceCards) && kernelSourceCards.length) {
    kernelSourceCards.forEach((card) => {
      if (!card || card.dataset.bound === 'true') {
        return;
      }
      card.dataset.bound = 'true';
      card.addEventListener('click', () => {
        if (state.installState === 'loading') {
          return;
        }
        const source = normalizeKernelSource(card.dataset.sourceValue || '');
        if (!source) {
          return;
        }
        selectKernelSource(source, { persist: true });
      });
    });
  }
}

bindKernelInstallControls();

async function handleConfigBrowse() {
  const result = await window.clashfox.selectConfig();
  if (result.ok) {
    configPathInput.value = result.path;
    if (overviewConfigPath) {
      overviewConfigPath.value = result.path;
    }
    if (settingsConfigPath) {
      settingsConfigPath.value = result.path;
    }
    saveSettings({configPath: result.path});
    showToast(t('labels.configNeedsRestart'));
    renderConfigTable();
    return;
  }
}

async function handleConfigReload() {
  const button = configsReload;
  if (button) {
    button.disabled = true;
  }
  try {
    const response = await reloadMihomoConfig(getMihomoApiSource());
    if (!response || !response.ok) {
      const detail = response && (response.details || response.error)
          ? `: ${String(response.details || response.error)}`
          : '';
      showToast(`${ti('labels.configReloadFailed', 'Reload config failed')}${detail}`, 'error');
      return;
    }
    showToast(ti('labels.configReloaded', 'Config reloaded'), 'info');
    await loadConfigs(true);
  } catch (error) {
    showToast(ti('labels.configReloadFailed', 'Reload config failed'), 'error');
  } finally {
    if (button) {
      button.disabled = false;
    }
  }
}

async function handleConfigImport() {
  if (!window.clashfox || typeof window.clashfox.importConfig !== 'function') {
    return;
  }
  const result = await window.clashfox.importConfig();
  if (!result || !result.ok) {
    if (result && result.error && result.error !== 'cancelled') {
      showToast(`${t('labels.configImportFailed')}: ${result.error}`, 'error');
    }
    return;
  }
  const fileName = result.data && result.data.fileName ? result.data.fileName : '';
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
  const confirmed = await promptConfirm({
    title: ti('confirm.deleteConfigTitle', 'Delete Config?'),
    body: `${ti('confirm.deleteConfigBody', 'This will permanently delete the selected config file.')} ${configName || ''}`.trim(),
    confirmLabel: ti('confirm.deleteConfirm', 'Delete'),
    confirmTone: 'danger',
  });
  if (!confirmed) {
    return;
  }
  const response = await window.clashfox.deleteConfig(targetPath);
  if (response && response.ok) {
    showToast(ti('labels.configDeleteSuccess', 'Config deleted.'));
    await loadConfigs();
    return;
  }
  if (response && response.error === 'current_config') {
    showToast(ti('labels.configDeleteCurrent', 'Cannot delete current config.'), 'error');
    return;
  }
  showToast(`${ti('labels.configDeleteFailed', 'Delete config failed')}: ${response && response.error ? response.error : ''}`.trim(), 'error');
}

async function handleDirectoryBrowse(title) {
  if (!window.clashfox || typeof window.clashfox.selectDirectory !== 'function') {
    return {ok: false};
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
  saveSettings({configPath: ''});
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
  const userDataPathsUpdate = {};
  if (key === 'configDir' && settingsConfigDir) {
    userDataPathsUpdate.configDir = '';
    settingsConfigDir.value = '';
  }
  if (key === 'coreDir' && settingsCoreDir) {
    userDataPathsUpdate.coreDir = '';
    settingsCoreDir.value = '';
  }
  if (key === 'dataDir' && settingsDataDir) {
    userDataPathsUpdate.dataDir = '';
    settingsDataDir.value = '';
  }
  if (Object.keys(userDataPathsUpdate).length > 0) {
    saveSettings({userDataPaths: userDataPathsUpdate});
  } else {
    saveSettings({[key]: ''});
  }
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

if (kernelRestart) {
  kernelRestart.addEventListener('click', async () => {
    await restartKernel();
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
    saveSettings({configPath: value});
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
    saveSettings({configPath: value});
    renderConfigTable();
  });
}

if (panelSelect) {
  panelSelect.addEventListener('change', async (event) => {
    if (state.panelActionPending) {
      panelSelect.value = (state.settings && state.settings.panelChoice) || 'zashboard';
      return;
    }
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
    const preset = getPanelPreset(value);
    if (!preset) {
      return;
    }
    updateExternalUiUrlField();
    if (settingsExternalUiUrl) {
      const urlVal = settingsExternalUiUrl.value || '';
      if (urlVal && state.settings.externalUiUrl !== urlVal) {
        saveSettings({externalUiUrl: urlVal});
      }
    }
    saveSettings({panelChoice: value});
    updateDashboardFrameSrc();
  });
}

if (panelInstallBtn) {
  panelInstallBtn.addEventListener('click', async () => {
    const choice = getSelectedPanelName();
    const preset = getPanelPreset(choice);
    const panelName = preset?.displayName || preset?.name || choice;

    const confirmed = await promptConfirm({
      title: t('confirm.panelInstallTitle', 'Install Panel'),
      body: t('confirm.panelInstallBody', `Are you sure you want to install ${panelName}?`),
      confirmLabel: t('confirm.installConfirm', 'Install'),
      confirmTone: 'primary',
    });

    if (!confirmed) {
      return;
    }

    handlePanelInstallAction().catch((error) => {
      const message = String(error && error.message ? error.message : error || '');
      showToast(`${t('labels.panelInstallFailed')} (${message || 'unknown_error'})`, 'error');
      setPanelActionPending(false);
    });
  });
}

if (panelUpdateBtn) {
  panelUpdateBtn.addEventListener('click', async () => {
    const choice = getSelectedPanelName();
    const preset = getPanelPreset(choice);
    const panelName = preset?.displayName || preset?.name || choice;

    const confirmed = await promptConfirm({
      title: t('confirm.panelUpdateTitle', 'Update Panel'),
      body: t('confirm.panelUpdateBody', `Are you sure you want to update ${panelName}?`),
      confirmLabel: t('confirm.updateConfirm', 'Update'),
      confirmTone: 'primary',
    });

    if (!confirmed) {
      return;
    }

    handlePanelUpdateAction().catch((error) => {
      const message = String(error && error.message ? error.message : error || '');
      showToast(`${t('labels.panelUpdateFailed')} (${message || 'unknown_error'})`, 'error');
      setPanelActionPending(false);
    });
  });
}
if (externalControllerInput) {
  externalControllerInput.addEventListener('change', (event) => {
    saveSettings({externalController: event.target.value.trim()});
  });
}
if (externalSecretInput) {
  externalSecretInput.addEventListener('change', (event) => {
    saveSettings({secret: event.target.value.trim()});
  });
}
if (externalAuthInput) {
  externalAuthInput.addEventListener('change', (event) => {
    saveSettings({authentication: parseAuthList(event.target.value)});
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
        // Start uptime tracking when mihomo is being started
        startMihomoUptimeTracking();

        const running = await waitForKernelState(true, 12000, 350);
        if (running) {
          const tunApply = await applyTunSettingsAfterStart();
          state.coreRunningGuardUntil = Date.now() + 10000;
          setQuickActionRunningState(true);
          const startupElapsedMs = Date.now() - commandStartedAt;
          updateCoreStartupEstimate(startupElapsedMs);
          // Refresh overview UI to update uptime display
          if (currentPage === 'overview') {
            updateOverviewUI();
          }
          showToast(t('labels.startSuccess'));
          if (!tunApply || !tunApply.ok) {
            const message = (tunApply && tunApply.error) || ti('labels.tunUpdateFailed', 'TUN update failed');
            showToast(message, 'warn');
          }
        } else {
          // Failed to start, reset uptime tracking
          resetMihomoUptimeTracking();

          state.coreRunningGuardUntil = 0;
          await loadStatusSilently();
          syncQuickActionButtons();
          if (!helperNotInstalled()) {
            showToast(ti('labels.startFailed', 'Start failed'), 'error');
          }
        }
      } else if (action === 'restart') {
        // For restart: reset tracking and start fresh
        resetMihomoUptimeTracking();
        startMihomoUptimeTracking();

        const running = await waitForKernelState(true, 15000, 400);
        if (running) {
          const tunApply = await applyTunSettingsAfterStart();
          state.coreRunningGuardUntil = Date.now() + 10000;
          setQuickActionRunningState(true);
          const startupElapsedMs = Date.now() - commandStartedAt;
          updateCoreStartupEstimate(startupElapsedMs);
          // Refresh overview UI to update uptime display
          if (currentPage === 'overview') {
            updateOverviewUI();
          }
          showToast(t('labels.restartSuccess'));
          if (!tunApply || !tunApply.ok) {
            const message = (tunApply && tunApply.error) || ti('labels.tunUpdateFailed', 'TUN update failed');
            showToast(message, 'warn');
          }
        } else {
          // Failed to restart, reset uptime tracking
          resetMihomoUptimeTracking();

          state.coreRunningGuardUntil = 0;
          await loadStatusSilently();
          syncQuickActionButtons();
          if (!helperNotInstalled()) {
            showToast(ti('labels.restartFailed', 'Restart failed'), 'error');
          }
        }
      } else {
        // Stop action: reset uptime tracking
        resetMihomoUptimeTracking();

        const stopped = await waitForKernelState(false, 10000, 300);
        if (stopped) {
          state.coreRunningGuardUntil = 0;
          setQuickActionRunningState(false);
          // Refresh overview UI to update uptime display
          if (currentPage === 'overview') {
            updateOverviewUI();
          }
          showToast(t('labels.stopped'));
        } else {
          state.coreRunningGuardUntil = 0;
          await loadStatusSilently();
          syncQuickActionButtons();
          showToast(ti('labels.stopFailed', 'Stop failed'), 'error');
        }
      }
      loadOverview();
    } else {
      state.coreRunningGuardUntil = 0;
      await loadStatusSilently();
      syncQuickActionButtons();
      const message = formatCoreActionError(action, response);
      const helperState = ((state.settings && state.settings.helperStatus) || (state.fileSettings && state.fileSettings.helperStatus) || {}).state || '';
      const helperMissing = String(helperState || '').trim() === 'not_installed';
      showToast(message, helperMissing ? 'info' : 'error');
    }

  } catch (error) {
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
      const previous = (state.settings?.proxy?.mode) || 'rule';
      saveSettings({proxy: { mode: value }}, { forceWrite: true });
      const response = await updateModeViaController(value, getMihomoApiSource());
      if (response.ok) {
        showToast(t('labels.proxyModeUpdated'));
        return;
      }
      setProxyModeValue(previous);
      saveSettings({proxy: { mode: previous }}, { forceWrite: true });
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
    if (enabled && !previous && window.clashfox && typeof window.clashfox.detectTunConflict === 'function') {
      try {
        const conflictProbe = await window.clashfox.detectTunConflict();
        const conflictLikely = Boolean(conflictProbe && conflictProbe.ok && conflictProbe.data && conflictProbe.data.conflictLikely);
        if (conflictLikely) {
          showToast(ti('labels.tunConflictHint', 'TUN conflict detected. Turn off TUN mode in other proxy apps, then try again.'), 'warn');
        }
      } catch {
        // ignore preflight detection failures
      }
    }
    if (!state.coreRunning) {
      saveSettings({tun: enabled}, { forceWrite: true });
      showToast(ti('labels.tunApplyOnStart', 'TUN setting saved, it will be applied on next start.'));
      return;
    }
    const response = await updateTunViaController({enable: enabled});
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
      saveSettings({tun: nextChecked}, { forceWrite: true });
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
      showToast(finalMessage, 'error');
      return;
    }
    saveSettings({tun: actual}, { forceWrite: true });
    showToast(actual ? t('labels.tunEnabled') : t('labels.tunDisabled'));
  });
}

if (tunStackSelect) {
  tunStackSelect.addEventListener('change', async () => {
    const previous = normalizeTunStack(state.settings?.proxy?.stack);
    const value = normalizeTunStack(tunStackSelect.value);
    tunStackSelect.value = value;
    if (!state.coreRunning) {
      saveSettings({stack: value}, { forceWrite: true });
      showToast(ti('labels.tunApplyOnStart', 'TUN setting saved, it will be applied on next start.'));
      return;
    }
    const response = await updateTunViaController({stack: value});
    const statusResponse = await loadTunStatus(false);
    const actual = normalizeTunStack(tunStackSelect.value);
    const statusOk = statusResponse && statusResponse.ok && statusResponse.data;
    if (!response.ok || !statusOk || actual !== value) {
      const nextValue = statusOk ? actual : previous;
      tunStackSelect.value = nextValue;
      saveSettings({stack: nextValue}, { forceWrite: true });
      const message = formatTunUpdateError(
          response,
          statusResponse,
          !statusOk
              ? ti('labels.tunStatusFailed', 'TUN status unavailable')
              : ti('labels.tunStackUpdateFailed', 'TUN stack update failed'),
      );
      showToast(message, 'error');
      return;
    }
    saveSettings({stack: actual}, { forceWrite: true });
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
    // Avoid radio input switching before user confirms.
    event.preventDefault();
    const confirmed = await promptConfirm({
      title: t('confirm.title'),
      body: t('confirm.body'),
      confirmLabel: t('confirm.confirm'),
      confirmTone: 'primary',
    });
    if (!confirmed) {
      renderConfigTable();
      return;
    }
    saveSettings({configPath: path});
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
    loadConfigs(true);
  });
}
if (configsReload) {
  configsReload.addEventListener('click', handleConfigReload);
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
    saveSettings({generalPageSize: settingsBackupsPageSize.value});
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
    saveSettings({generalPageSize: backupsPageSize.value});
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
    let response;
    if (window.clashfox && typeof window.clashfox.cleanLogs === 'function') {
      response = await window.clashfox.cleanLogs(mode);
    } else {
      response = {ok: false, error: 'cleanLogs function not available'};
    }

    if (response.ok) {
      const count = response.cleanedCount !== undefined ? ` (${response.cleanedCount} files)` : '';
      showToast(t('labels.cleanDone') + count);
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
  overviewRulesSwitch.querySelectorAll('button').forEach((button) => {
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    button.addEventListener('mousedown', (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    button.addEventListener('dragstart', (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
  });
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
  if (!isMainWindowVisible() || currentPage !== 'overview') {
    stopOverviewActivity();
    return;
  }
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
    const startTime = state.mihomoStartTime || getMihomoStartTime();
    if (!startTime || !overviewUptime) {
      return;
    }
    // Use JS-based uptime calculation
    const uptime = calculateMihomoUptime();
    if (Number.isFinite(uptime) && uptime >= 0) {
      setNodeTextIfChanged(overviewUptime, formatUptime(uptime));
    }
  }, 1000);

  if (state.providerSubscriptionTimer) {
    clearInterval(state.providerSubscriptionTimer);
  }
  state.providerSubscriptionTimer = setInterval(() => {
    if (currentPage === 'overview') {
      loadProviderSubscriptionOverview();
    }
  }, 15000);

  if (state.rulesOverviewTimer) {
    clearInterval(state.rulesOverviewTimer);
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
  syncPanelActionButtons();
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

function setPanelActionPending(pending) {
  state.panelActionPending = Boolean(pending);
  if (panelInstallBtn) {
    panelInstallBtn.disabled = state.panelActionPending;
  }
  if (panelUpdateBtn) {
    panelUpdateBtn.disabled = state.panelActionPending;
  }
}

function syncPanelActionButtons() {
  if (!panelUpdateBtn) {
    return;
  }
  const choice = getSelectedPanelName();
  const preset = getPanelPreset(choice);
  const hideUpdate = Boolean(preset && preset.name === 'metacubexd');
  panelUpdateBtn.classList.toggle('is-hidden', hideUpdate);
}

function getPanelPreset(panelName = '') {
  const key = String(panelName || '').trim().toLowerCase();
  if (!key) {
    return null;
  }
  const preset = PANEL_PRESETS && typeof PANEL_PRESETS === 'object' ? PANEL_PRESETS[key] : null;
  return preset && typeof preset === 'object' ? {...preset, name: preset.name || key} : null;
}

async function installPanelMainBridge(preset) {
  if (!preset) {
    return {ok: false, error: 'panel_preset_missing'};
  }
  if (!window.clashfox || typeof window.clashfox.installPanel !== 'function') {
    return {ok: false, error: 'bridge_missing'};
  }
  return window.clashfox.installPanel(preset);
}

async function updatePanelMainBridge(preset) {
  if (!preset) {
    return {ok: false, error: 'panel_preset_missing'};
  }
  const nextPreset = {...preset, force: true};
  return installPanelMainBridge(nextPreset);
}

async function activatePanelMainBridge(panelName = '') {
  const normalizedName = String(panelName || '').trim();
  if (!normalizedName) {
    return {ok: false, error: 'panel_preset_missing'};
  }
  if (!window.clashfox || typeof window.clashfox.activatePanel !== 'function') {
    return {ok: false, error: 'bridge_missing'};
  }
  return window.clashfox.activatePanel(normalizedName);
}

async function ensurePanelInstalledAndActivated(preset) {
  if (!preset || !preset.name) {
    return {ok: false, error: 'panel_preset_missing'};
  }
  const activateFirst = await activatePanelMainBridge(preset.name);
  if (activateFirst && activateFirst.ok) {
    return {ok: true, installed: false};
  }
  if (activateFirst && activateFirst.error && activateFirst.error !== 'panel_missing') {
    return activateFirst;
  }
  const install = await installPanelMainBridge(preset);
  if (!install || !install.ok) {
    return install || {ok: false, error: 'panel_install_failed'};
  }
  const activateAfter = await activatePanelMainBridge(preset.name);
  if (!activateAfter || !activateAfter.ok) {
    return activateAfter || {ok: false, error: 'panel_activate_failed'};
  }
  return {ok: true, installed: Boolean(install.installed !== false), skipped: Boolean(install.skipped)};
}

async function handlePanelInstallAction() {
  if (state.panelActionPending) {
    return;
  }
  const choice = getSelectedPanelName();
  const preset = getPanelPreset(choice);
  if (!preset) {
    showToast(t('labels.panelInstallFailed'), 'error');
    return;
  }
  setPanelActionPending(true);
  showToast(t('labels.panelInstallInProgress'), 'info');
  try {
    const response = await ensurePanelInstalledAndActivated(preset);
    if (response && response.ok) {
      showToast(t('labels.panelInstalled'));
      return;
    }
    let errorMsg = t('labels.panelInstallFailed');
    if (response && response.error) {
      errorMsg = `${errorMsg} (${response.error})`;
      if (response.error === 'empty_output' && response.details) {
        errorMsg = `${errorMsg}: ${response.details}`;
      }
    }
    showToast(errorMsg, 'error');
  } finally {
    setPanelActionPending(false);
  }
}

async function handlePanelUpdateAction() {
  if (state.panelActionPending) {
    return;
  }
  const choice = getSelectedPanelName();
  const preset = getPanelPreset(choice);
  if (!preset || preset.name === 'metacubexd') {
    return;
  }
  setPanelActionPending(true);
  showToast(t('labels.panelUpdateInProgress'), 'info');
  try {
    const response = await updatePanelMainBridge(preset);
    if (response && response.ok) {
      const activateAfter = await activatePanelMainBridge(preset.name);
      if (!activateAfter || !activateAfter.ok) {
        const suffix = activateAfter && activateAfter.error ? ` (${activateAfter.error})` : '';
        showToast(`${t('labels.panelUpdateFailed')}${suffix}`, 'error');
        return;
      }
      showToast(t('labels.panelUpdated'));
      return;
    }
    const suffix = response && response.error ? ` (${response.error})` : '';
    showToast(`${t('labels.panelUpdateFailed')}${suffix}`, 'error');
  } finally {
    setPanelActionPending(false);
  }
}

async function initDashboardFrame() {
  if (!isMainWindowVisible() || currentPage !== 'dashboard') {
    return;
  }
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
    // Silent error handling in production
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
  preloadPageTemplates(targetPage || currentPage).catch(() => {
  });
  await loadDefaultSettings();
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
    applySidebarCollapsedState(Boolean(state.settings && state.settings.appearance && state.settings.appearance.sidebarCollapsed), false);
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
  const ok = await waitForBridge();
  if (!ok) {
    showToast(t('labels.bridgeMissing'), 'error');
    return;
  }
  loadAppInfo(true);
  if (currentPage !== 'overview') {
    await loadStatusSilently().catch(() => {});
  }
  if (currentPage === 'settings') {
    if (contentRoot) {
      contentRoot.scrollTop = 0;
      if (typeof contentRoot.scrollTo === 'function') {
        contentRoot.scrollTo({top: 0, left: 0, behavior: 'auto'});
      }
    }
    await invokeHelperPanelRefresh();
  }
  updateInstallVersionVisibility();
  await syncMainWindowActivity();
  loadConfigs();
  loadKernels();
  loadBackups();
}

window.addEventListener('popstate', () => {
  const historyPage = history.state && history.state.page ? String(history.state.page) : '';
  const target = VALID_PAGES.has(historyPage) ? historyPage : getPageFromLocation();
  navigatePage(target, false);
});

async function handleMainWindowVisibilityChange() {
  const visible = !document.hidden;
  if (appWindowVisible === visible) {
    return;
  }
  appWindowVisible = visible;
  if (!appWindowVisible) {
    stopOverviewActivity();
    closeMihomoPageLogsSocket();
    if (currentPage === 'dashboard' && dashboardLocalModule && typeof dashboardLocalModule.teardownDashboardPanel === 'function') {
      dashboardLocalModule.teardownDashboardPanel();
      state.dashboardLoaded = false;
    }
    return;
  }
  syncMainWindowActivity().catch(() => {});
}

document.addEventListener('visibilitychange', handleMainWindowVisibilityChange);

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

// Common entry: load tray i18n first, then main i18n map
import {
  fetchProviderSubscriptionOverview,
  fetchMihomoProvidersProxies,
  fetchMihomoProvidersRules,
  fetchMihomoRules,
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
} from '../api/mihomo-api.js';
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
} from '../api/helper-api.js';
import '../locales/tray-i18n.js';
import '../locales/i18n.js';
