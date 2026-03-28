import FOXBOARD_I18N from '../locales/foxboard-i18n.js';

const POLL_MS = 2200;
const DASHBOARD_PREFS_KEY = 'clashfox.dashboardLocalPrefs.v1';

const state = {
  initialized: false,
  timer: null,
  root: null,
  snapshot: null,
  loading: false,
  lastError: '',
  activeTab: 'recent',
  locale: 'en',
  recentStatus: 'all',
  recentRangeMs: 0,
  groupBy: 'client',
  selectedFilter: '',
  selectedRowKey: '',
  detailVisible: false,
  query: '',
  viewMode: {
    dns: 'cards',
    devices: 'cards',
  },
  summaryMode: '',
};

const refs = {};

function $(id) {
  return document.getElementById(id);
}

function normalizeLocale(value) {
  const lang = String(value || '').trim().toLowerCase();
  if (lang.startsWith('zh')) return 'zh';
  if (lang.startsWith('ja')) return 'ja';
  if (lang.startsWith('ko')) return 'ko';
  if (lang.startsWith('fr')) return 'fr';
  if (lang.startsWith('de')) return 'de';
  if (lang.startsWith('ru')) return 'ru';
  return 'en';
}

function t(key, fallback = '') {
  const pack = FOXBOARD_I18N[state.locale] || FOXBOARD_I18N.en;
  if (Object.prototype.hasOwnProperty.call(pack, key)) {
    return pack[key];
  }
  return fallback || (FOXBOARD_I18N.en[key] || key);
}

function readPrefs() {
  try {
    return JSON.parse(localStorage.getItem(DASHBOARD_PREFS_KEY) || '{}');
  } catch {
    return {};
  }
}

function writePrefs() {
  try {
    localStorage.setItem(DASHBOARD_PREFS_KEY, JSON.stringify({
      activeTab: state.activeTab,
      recentStatus: state.recentStatus,
      recentRangeMs: state.recentRangeMs,
      groupBy: state.groupBy,
      selectedFilter: state.selectedFilter,
      selectedRowKey: state.selectedRowKey,
      query: state.query,
      viewMode: state.viewMode,
    }));
  } catch {
    // ignore
  }
}

function formatBytes(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num) || num <= 0) {
    return '0 B';
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

function formatRate(value) {
  return `${formatBytes(value)}/s`;
}

function formatTime(value) {
  const stamp = Number(value || 0);
  if (!Number.isFinite(stamp) || stamp <= 0) {
    return '-';
  }
  const date = new Date(stamp);
  return date.toLocaleTimeString([], { hour12: false });
}

function formatDuration(ms) {
  const value = Math.max(0, Number(ms || 0));
  if (!value) {
    return '0 s';
  }
  if (value < 1000) {
    return `${Math.round(value)} ms`;
  }
  const sec = Math.round(value / 1000);
  if (sec < 60) {
    return `${sec} s`;
  }
  const mins = Math.floor(sec / 60);
  const rem = sec % 60;
  if (mins < 60) {
    return rem ? `${mins}m ${rem}s` : `${mins}m`;
  }
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins ? `${hrs}h ${remMins}m` : `${hrs}h`;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function compactText(value, fallback = '-') {
  const text = String(value || '').trim();
  return text || fallback;
}

function setTextIfChanged(node, value) {
  if (!node) {
    return;
  }
  const text = String(value ?? '');
  if (node.textContent !== text) {
    node.textContent = text;
  }
}

function pluralize(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function renderBadgeList(values = [], className = '') {
  const items = Array.isArray(values) ? values.filter(Boolean).slice(0, 4) : [];
  if (!items.length) {
    return '<span class="dashboard-dash">-</span>';
  }
  return items.map((item) => `<span class="dashboard-badge ${className}">${escapeHtml(item)}</span>`).join('');
}

function renderEntityCell(primary, secondary = '', tone = '') {
  return `
    <div class="dashboard-entity ${tone}">
      <div class="dashboard-entity-primary">${escapeHtml(compactText(primary))}</div>
      <div class="dashboard-entity-secondary">${escapeHtml(compactText(secondary))}</div>
    </div>`;
}

function renderMetricStack(primary, secondary = '') {
  return `
    <div class="dashboard-metric-stack">
      <strong>${escapeHtml(compactText(primary))}</strong>
      <span>${escapeHtml(compactText(secondary))}</span>
    </div>`;
}

function normalizeViewMode(tab, value) {
  if (tab === 'devices') {
    return 'cards';
  }
  if (tab === 'dns') {
    return 'table';
  }
  return 'table';
}

function resolveCurrentViewMode() {
  return normalizeViewMode(state.activeTab, state.viewMode[state.activeTab] || 'table');
}

function resolveRowKey(row) {
  if (!row || typeof row !== 'object') {
    return '';
  }
  if (state.activeTab === 'dns') {
    return `dns:${row.host || row.ip || '-'}`;
  }
  if (state.activeTab === 'devices') {
    return `device:${row.id || row.name || '-'}`;
  }
  if (state.activeTab === 'traffic') {
    return `traffic:${row.name || '-'}:${row.connections || 0}`;
  }
  return `${state.activeTab}:${row.id || row.host || row.ip || row.name || '-'}`;
}

function buildDetailEntries(row) {
  if (!row || typeof row !== 'object') {
    return [];
  }
  if (state.activeTab === 'recent' || state.activeTab === 'active') {
    return [
      ['Client', row.client],
      ['Event Time', formatTime(row.eventAt)],
      ['Started At', formatTime(row.startedAt)],
      ['Process', row.process],
      ['Process Path', row.processPath],
      ['Policy', row.outbound || row.rule],
      ['Rule', row.rule],
      ['Protocol', row.network],
      ['Host', row.host],
      ['IP', row.ip],
      ['Port', row.port],
      ['Source', `${row.sourceIp || '-'}${row.sourcePort ? `:${row.sourcePort}` : ''}`],
      ['Upload', formatBytes(row.upload)],
      ['Download', formatBytes(row.download)],
      ['Duration', formatDuration(row.durationMs)],
    ];
  }
  if (state.activeTab === 'dns') {
    return [
      ['Host', row.host],
      ['IP', row.ip],
      ['Hits', row.hits],
      ['Clients', (row.clients || []).join(', ')],
      ['Policies', (row.outbounds || []).join(', ')],
      ['First Seen', formatTime(row.firstSeenAt)],
      ['Last Seen', formatTime(row.lastSeenAt)],
    ];
  }
  if (state.activeTab === 'devices') {
    return [
      ['Device', row.name],
      ['User', row.userRealName || row.user],
      ['System', [row.os, row.version, row.build].filter(Boolean).join(' ')],
      ['Source', row.source],
      ['Clients', (row.clients || []).join(', ')],
      ['Endpoints', (row.endpoints || []).join(', ')],
      ['Connections', row.connections],
      ['Upload', formatBytes(row.upload)],
      ['Download', formatBytes(row.download)],
      ['Last Seen', formatTime(row.lastSeenAt)],
    ];
  }
  return [
    ['Dimension', row.dimension || '-'],
    ['Name', row.name],
    ['Connections', row.connections],
    ['Upload', formatBytes(row.upload)],
    ['Download', formatBytes(row.download)],
    ['Extra', (row.outbounds || row.clients || []).join(', ')],
  ];
}

function resolveRowsByTab() {
  const data = state.snapshot || {};
  if (state.activeTab === 'active') return Array.isArray(data.activeConnections) ? data.activeConnections : [];
  if (state.activeTab === 'dns') return Array.isArray(data.dnsRecords) ? data.dnsRecords : [];
  if (state.activeTab === 'devices') return Array.isArray(data.devices) ? data.devices : [];
  if (state.activeTab === 'traffic') {
    const traffic = data.traffic || {};
    return [
      ...(Array.isArray(traffic.topClients) ? traffic.topClients.map((row) => ({ ...row, dimension: 'client' })) : []),
      ...(Array.isArray(traffic.topHosts) ? traffic.topHosts.map((row) => ({ ...row, dimension: 'host' })) : []),
    ];
  }
  return Array.isArray(data.recentRequests) ? data.recentRequests : [];
}

function sortRowsForCurrentTab(rows) {
  const list = Array.isArray(rows) ? rows.slice() : [];
  if (state.activeTab === 'recent') {
    const statusOrder = { Active: 0, Completed: 1, Failed: 2 };
    return list.sort((a, b) => {
      const statusDiff = (statusOrder[String(a.status || '')] ?? 9) - (statusOrder[String(b.status || '')] ?? 9);
      if (statusDiff !== 0) {
        return statusDiff;
      }
      return Number(b.eventAt || 0) - Number(a.eventAt || 0);
    });
  }
  if (state.activeTab === 'active') {
    return list.sort((a, b) => {
      const trafficDiff = (Number(b.download || 0) + Number(b.upload || 0)) - (Number(a.download || 0) + Number(a.upload || 0));
      if (trafficDiff !== 0) {
        return trafficDiff;
      }
      return Number(b.durationMs || 0) - Number(a.durationMs || 0);
    });
  }
  if (state.activeTab === 'dns') {
    return list.sort((a, b) => Number(b.lastSeenAt || 0) - Number(a.lastSeenAt || 0) || Number(b.hits || 0) - Number(a.hits || 0));
  }
  if (state.activeTab === 'devices' || state.activeTab === 'traffic') {
    return list.sort((a, b) => Number(b.connections || 0) - Number(a.connections || 0) || Number(b.download || 0) - Number(a.download || 0));
  }
  return list;
}

function normalizeRecentStatus(value) {
  const key = String(value || '').trim().toLowerCase();
  if (key === 'active' || key === 'completed' || key === 'failed') {
    return key;
  }
  return 'all';
}

function normalizeRecentRange(value) {
  const num = Number(value || 0);
  const allowed = new Set([0, 300000, 900000, 3600000]);
  return allowed.has(num) ? num : 0;
}

function resolveFilterValue(row) {
  if (state.groupBy === 'host') {
    return String(row.host || row.name || row.ip || '-').trim();
  }
  return String(row.client || row.name || row.process || '-').trim();
}

function filterRows(rows) {
  const query = String(state.query || '').trim().toLowerCase();
  const now = Date.now();
  return rows.filter((row) => {
    if (state.activeTab === 'recent' && state.recentStatus !== 'all') {
      const status = String(row.status || '').trim().toLowerCase();
      if (status !== state.recentStatus) {
        return false;
      }
    }
    if (state.activeTab === 'recent' && state.recentRangeMs > 0) {
      const eventAt = Number(row.eventAt || row.startedAt || 0);
      if (!Number.isFinite(eventAt) || eventAt <= 0 || now - eventAt > state.recentRangeMs) {
        return false;
      }
    }
    if (state.selectedFilter && resolveFilterValue(row) !== state.selectedFilter) {
      return false;
    }
    if (!query) {
      return true;
    }
    const haystack = [
      row.client,
      row.host,
      row.ip,
      row.name,
      row.process,
      row.outbound,
      row.rule,
      row.network,
    ].map((item) => String(item || '').toLowerCase()).join(' ');
    return haystack.includes(query);
  });
}

function renderSidebar(rows) {
  if (!refs.filterList) {
    return;
  }
  const counts = new Map();
  for (const row of rows) {
    const key = resolveFilterValue(row) || '-';
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const items = Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const markup = [
    `<button class="dashboard-filter-item${state.selectedFilter ? '' : ' active'}" data-filter="">${state.groupBy === 'host' ? t('allHosts', 'All Hosts') : t('allClients', 'All Clients')}<span>${rows.length}</span></button>`,
    ...items.slice(0, 40).map(([label, count]) => (
      `<button class="dashboard-filter-item${state.selectedFilter === label ? ' active' : ''}" data-filter="${escapeHtml(label)}">${escapeHtml(label)}<span>${count}</span></button>`
    )),
  ].join('');
  if (refs.filterList.dataset.renderSig !== markup) {
    refs.filterList.innerHTML = markup;
    refs.filterList.dataset.renderSig = markup;
  }
}

function ensureLoadingOverlay() {
  if (!state.root) {
    return null;
  }
  if (refs.loadingOverlay && refs.loadingOverlay.parentElement === state.root) {
    return refs.loadingOverlay;
  }
  const overlay = document.createElement('div');
  overlay.className = 'dashboard-loading-overlay';
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="dashboard-loading-card" role="status" aria-live="polite">
      <span class="dashboard-loading-spinner" aria-hidden="true"></span>
      <span class="dashboard-loading-text"></span>
    </div>
  `;
  state.root.appendChild(overlay);
  refs.loadingOverlay = overlay;
  refs.loadingText = overlay.querySelector('.dashboard-loading-text');
  return overlay;
}

function renderLoadingOverlay() {
  const overlay = ensureLoadingOverlay();
  if (!overlay) {
    return;
  }
  const shouldShow = state.loading && !state.snapshot;
  overlay.hidden = !shouldShow;
  overlay.classList.toggle('is-visible', shouldShow);
  setTextIfChanged(refs.loadingText, t('loadingSnapshot', 'Loading live snapshot...'));
}

function renderSummarySkeleton(mode = 'empty') {
  if (!refs.summaryGrid) {
    return;
  }
  if (state.summaryMode === mode && refs.summaryGrid.querySelector('[data-summary-slot]')) {
    return;
  }
  state.summaryMode = mode;
  const slots = mode === 'live'
    ? ['active', 'recent', 'devices', 'upload', 'download', 'balance']
    : ['status', 'active', 'recent', 'devices', 'upload', 'download'];
  refs.summaryGrid.innerHTML = slots.map((slot) => (
    `<div class="dashboard-stat" data-stat-key="${slot}" data-summary-slot="${slot}">
      <span data-summary-label></span>
      <strong data-summary-value></strong>
      <small data-summary-sub></small>
    </div>`
  )).join('');
  refs.summarySlots = {};
  refs.summaryGrid.querySelectorAll('[data-summary-slot]').forEach((card) => {
    const key = String(card.getAttribute('data-summary-slot') || '').trim();
    if (!key) {
      return;
    }
    refs.summarySlots[key] = {
      label: card.querySelector('[data-summary-label]'),
      value: card.querySelector('[data-summary-value]'),
      sub: card.querySelector('[data-summary-sub]'),
    };
  });
}

function updateSummarySlot(slotKey, label, value, sub) {
  const slots = refs.summarySlots && typeof refs.summarySlots === 'object'
    ? refs.summarySlots
    : {};
  const slot = slots[slotKey];
  if (!slot) {
    return;
  }
  setTextIfChanged(slot.label, label);
  setTextIfChanged(slot.value, value);
  setTextIfChanged(slot.sub, sub);
}

function setPanelTitle() {
  if (!refs.panelTitle || !refs.panelMeta) {
    return;
  }
  if (!state.snapshot) {
    refs.panelTitle.textContent = 'Foxboard';
    refs.panelMeta.textContent = state.lastError
      ? t('snapshotUnavailableShort', 'Snapshot unavailable')
      : t('waitingFirstSnapshot', 'Waiting for first live snapshot');
    if (refs.liveMeta) {
      refs.liveMeta.textContent = state.loading
        ? t('syncing', 'Syncing...')
        : (state.lastError ? t('readDegraded', 'Read degraded') : t('idle', 'Idle'));
      refs.liveMeta.dataset.state = state.loading ? 'loading' : (state.lastError ? 'error' : 'live');
    }
    return;
  }
  const titleMap = {
    recent: t('panelRecent', 'Recent Requests'),
    active: t('panelActive', 'Active Connection'),
    dns: 'DNS',
    devices: t('panelDevices', 'Devices'),
    traffic: t('panelTraffic', 'Traffic Statistics'),
  };
  const rows = filterRows(sortRowsForCurrentTab(resolveRowsByTab()));
  const total = rows.length;
  const rangeLabelMap = {
    0: t('allTime', 'All Time'),
    300000: '5m',
    900000: '15m',
    3600000: '1h',
  };
  const rangeLabel = rangeLabelMap[state.recentRangeMs] || t('custom', 'Custom');
  refs.panelTitle.textContent = titleMap[state.activeTab] || 'Dashboard';
  refs.panelTitle.dataset.tab = state.activeTab;
  if (state.activeTab === 'recent') {
    const activeCount = rows.filter((row) => row.status === 'Active').length;
    const completedCount = rows.filter((row) => row.status === 'Completed').length;
    const failedCount = rows.filter((row) => row.status === 'Failed').length;
    refs.panelMeta.textContent = `${pluralize(total, t('itemSingular', 'item'), t('itemPlural', 'items'))} · ${rangeLabel} · ${activeCount} ${t('active', 'active')} · ${completedCount} ${t('completed', 'completed')} · ${failedCount} ${t('failed', 'failed')} · ${t('updated', 'Updated')} ${formatTime(state.snapshot.generatedAt)}`;
  } else {
    refs.panelMeta.textContent = `${pluralize(total, t('itemSingular', 'item'), t('itemPlural', 'items'))} · ${t('updated', 'Updated')} ${formatTime(state.snapshot.generatedAt)}`;
  }
  if (refs.liveMeta) {
    refs.liveMeta.textContent = state.loading
      ? t('syncing', 'Syncing...')
      : state.lastError
        ? t('readDegraded', 'Read degraded')
        : `${t('polling', 'Polling')} ${Math.round(POLL_MS / 1000)}s`;
    refs.liveMeta.dataset.state = state.loading ? 'loading' : (state.lastError ? 'error' : 'live');
  }
}

function renderRecentTable(rows) {
  refs.tableHead.innerHTML = `
    <tr>
      <th>Request</th><th>Client</th><th>Status</th><th>Policy</th>
      <th>Transfer</th><th>Duration</th><th>Protocol</th><th>Endpoint</th>
    </tr>`;
  refs.tableBody.innerHTML = rows.map((row) => `
    <tr data-row-key="${escapeHtml(resolveRowKey(row))}" class="${state.selectedRowKey === resolveRowKey(row) ? 'is-selected' : ''}">
      <td>${renderEntityCell(
        row.host || row.ip || row.id,
        `${formatTime(row.eventAt)} · ${compactText(row.id)}`
      )}</td>
      <td>${renderEntityCell(row.client, row.process || `${row.sourceIp || '-'}${row.sourcePort ? `:${row.sourcePort}` : ''}`)}</td>
      <td><span class="dashboard-status ${String(row.status || '').toLowerCase()}">${escapeHtml(row.status)}</span></td>
      <td>${renderBadgeList([row.outbound || row.rule || '-', row.rule && row.outbound && row.rule !== row.outbound ? row.rule : ''], 'warm')}</td>
      <td>${renderMetricStack(
        `${formatBytes(row.download)} down`,
        `${formatBytes(row.upload)} up`
      )}</td>
      <td>${escapeHtml(formatDuration(row.durationMs))}</td>
      <td>${renderBadgeList([row.network || '-', row.process ? 'Process' : 'Socket'], 'muted')}</td>
      <td>${renderEntityCell(
        `${row.host || row.ip || '-'}${row.port ? `:${row.port}` : ''}`,
        row.ip && row.host && row.ip !== row.host ? row.ip : row.sourceIp || '-'
      )}</td>
    </tr>`).join('');
}

function renderActiveTable(rows) {
  refs.tableHead.innerHTML = `
    <tr>
      <th>Connection</th><th>Client</th><th>Policy</th><th>Protocol</th>
      <th>Transfer</th><th>Duration</th><th>Source</th><th>Endpoint</th>
    </tr>`;
  refs.tableBody.innerHTML = rows.map((row) => `
    <tr data-row-key="${escapeHtml(resolveRowKey(row))}" class="${state.selectedRowKey === resolveRowKey(row) ? 'is-selected' : ''}">
      <td>${renderEntityCell(row.host || row.ip || row.id, compactText(row.id))}</td>
      <td>${renderEntityCell(row.client, row.process || '-')}</td>
      <td>${renderBadgeList([row.outbound || row.rule || '-', row.rule && row.outbound && row.rule !== row.outbound ? row.rule : ''], 'warm')}</td>
      <td>${renderBadgeList([row.network || '-', row.status || 'Active'], 'muted')}</td>
      <td>${renderMetricStack(
        `${formatBytes(row.download)} down`,
        `${formatBytes(row.upload)} up`
      )}</td>
      <td>${escapeHtml(formatDuration(row.durationMs))}</td>
      <td>${renderEntityCell(
        `${row.sourceIp || '-'}${row.sourcePort ? `:${row.sourcePort}` : ''}`,
        row.processPath || row.client || '-'
      )}</td>
      <td>${renderEntityCell(
        `${row.host || row.ip || '-'}${row.port ? `:${row.port}` : ''}`,
        row.ip && row.host && row.ip !== row.host ? row.ip : '-'
      )}</td>
    </tr>`).join('');
}

function renderDnsTable(rows) {
  refs.tableHead.innerHTML = `
    <tr>
      <th>Host</th><th>Resolution</th><th>Clients</th><th>Policy</th><th>Last Seen</th>
    </tr>`;
  refs.tableBody.innerHTML = rows.map((row) => `
    <tr data-row-key="${escapeHtml(resolveRowKey(row))}" class="${state.selectedRowKey === resolveRowKey(row) ? 'is-selected' : ''}">
      <td>${renderEntityCell(row.host, `${pluralize(Number(row.hits || 0), 'hit')} · first ${formatTime(row.firstSeenAt)}`)}</td>
      <td>${renderEntityCell(row.ip || '-', 'Latest resolved address')}</td>
      <td>${renderBadgeList(row.clients || [], 'muted')}</td>
      <td>${renderBadgeList(row.outbounds || [], 'warm')}</td>
      <td>${escapeHtml(formatTime(row.lastSeenAt))}</td>
    </tr>`).join('');
}

function renderDevicesTable(rows) {
  refs.tableHead.innerHTML = `
    <tr>
      <th>Device</th><th>User</th><th>Clients</th><th>Connections</th><th>Traffic</th><th>Last Seen</th>
    </tr>`;
  refs.tableBody.innerHTML = rows.map((row) => `
    <tr data-row-key="${escapeHtml(resolveRowKey(row))}" class="${state.selectedRowKey === resolveRowKey(row) ? 'is-selected' : ''}">
      <td>${renderEntityCell(row.name, [row.os, row.version].filter(Boolean).join(' ') || row.source || '-')}</td>
      <td>${renderEntityCell(row.userRealName || row.user || '-', row.source === 'local' ? 'Current Mac' : 'Endpoint')}</td>
      <td>${renderBadgeList(row.clients || [], 'muted')}</td>
      <td>${renderMetricStack(String(row.connections || 0), pluralize((row.endpoints || []).length, 'endpoint'))}</td>
      <td>${renderMetricStack(formatBytes(row.download), `${formatBytes(row.upload)} up`)}</td>
      <td>${escapeHtml(formatTime(row.lastSeenAt))}</td>
    </tr>`).join('');
}

function renderTrafficTab(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const topClients = list.filter((row) => row.dimension === 'client');
  const topHosts = list.filter((row) => row.dimension === 'host');
  refs.tableHead.innerHTML = `
    <tr>
      <th>Name</th><th>Connections</th><th>Transfer</th><th>Extra</th>
    </tr>`;
  refs.tableBody.innerHTML = [
    '<tr class="dashboard-group-row"><td colspan="4">Top Clients</td></tr>',
    ...topClients.slice(0, 12).map((row) => `
      <tr data-row-key="${escapeHtml(resolveRowKey(row))}" class="${state.selectedRowKey === resolveRowKey(row) ? 'is-selected' : ''}">
        <td>${renderEntityCell(row.name, 'Top talker by client')}</td>
        <td>${escapeHtml(String(row.connections || 0))}</td>
        <td>${renderMetricStack(formatBytes(row.download), `${formatBytes(row.upload)} up`)}</td>
        <td>${renderBadgeList(row.outbounds || [], 'warm')}</td>
      </tr>`),
    '<tr class="dashboard-group-row"><td colspan="4">Top Hosts</td></tr>',
    ...topHosts.slice(0, 12).map((row) => `
      <tr data-row-key="${escapeHtml(resolveRowKey(row))}" class="${state.selectedRowKey === resolveRowKey(row) ? 'is-selected' : ''}">
        <td>${renderEntityCell(row.name, 'Top talker by host')}</td>
        <td>${escapeHtml(String(row.connections || 0))}</td>
        <td>${renderMetricStack(formatBytes(row.download), `${formatBytes(row.upload)} up`)}</td>
        <td>${renderBadgeList(row.clients || [], 'muted')}</td>
      </tr>`),
  ].join('');
}

function getEmptyMessage() {
  if (state.lastError) {
    return t('snapshotUnavailable', 'Snapshot unavailable. Kernel may be stopped or bridge data is degraded.');
  }
  if (state.loading) {
    return t('loadingSnapshot', 'Loading live snapshot...');
  }
  if (state.activeTab === 'dns') {
    return t('noDns', 'No DNS observations yet.');
  }
  if (state.activeTab === 'devices') {
    return t('noDevices', 'No device activity yet.');
  }
  if (state.activeTab === 'traffic') {
    return t('noTraffic', 'No traffic leaders yet.');
  }
  return t('noData', 'No data yet.');
}

function renderCards(rows) {
  if (!refs.cardsView) {
    return;
  }
  const kind = state.activeTab === 'dns' ? 'DNS' : 'Device';
  refs.cardsView.innerHTML = rows.map((row) => {
    const rowKey = resolveRowKey(row);
    if (state.activeTab === 'dns') {
      return `
        <button type="button" class="dashboard-data-card${state.selectedRowKey === rowKey ? ' active' : ''}" data-row-key="${escapeHtml(rowKey)}" data-card-kind="dns">
          <div class="dashboard-data-card-kicker">${kind}</div>
          <div class="dashboard-data-card-title">${escapeHtml(compactText(row.host))}</div>
          <div class="dashboard-data-card-subtitle">${escapeHtml(compactText(row.ip))}</div>
          <div class="dashboard-data-card-meta">
            <span>${escapeHtml(pluralize(Number(row.hits || 0), 'hit'))}</span>
            <span>${escapeHtml(formatTime(row.lastSeenAt))}</span>
          </div>
          <div class="dashboard-data-card-badges">${renderBadgeList(row.clients || [], 'muted')}</div>
          <div class="dashboard-data-card-badges">${renderBadgeList(row.outbounds || [], 'warm')}</div>
        </button>`;
    }
    return `
      <button type="button" class="dashboard-data-card${state.selectedRowKey === rowKey ? ' active' : ''}" data-row-key="${escapeHtml(rowKey)}" data-card-kind="device">
        <div class="dashboard-data-card-kicker">${kind}</div>
        <div class="dashboard-data-card-title">${escapeHtml(compactText(row.name))}</div>
        <div class="dashboard-data-card-subtitle">${escapeHtml(compactText([row.os, row.version].filter(Boolean).join(' ') || row.source))}</div>
        <div class="dashboard-data-card-meta">
          <span>${escapeHtml(pluralize(Number(row.connections || 0), 'connection'))}</span>
          <span>${escapeHtml(formatTime(row.lastSeenAt))}</span>
        </div>
        <div class="dashboard-data-card-badges">${renderBadgeList(row.clients || [], 'muted')}</div>
        <div class="dashboard-data-card-badges">${renderMetricStack(formatBytes(row.download), `${formatBytes(row.upload)} up`)}</div>
      </button>`;
  }).join('');
}

function renderDetailPanel(rows) {
  if (!refs.detailPanel) {
    return;
  }
  const currentRows = Array.isArray(rows) ? rows : [];
  if (!currentRows.length) {
    refs.detailPanel.innerHTML = '';
    refs.detailPanel.hidden = true;
    state.detailVisible = false;
    return;
  }
  const selected = currentRows.find((row) => resolveRowKey(row) === state.selectedRowKey) || currentRows[0];
  if (!selected) {
    refs.detailPanel.innerHTML = '';
    refs.detailPanel.hidden = true;
    state.detailVisible = false;
    return;
  }
  if (!state.detailVisible) {
    refs.detailPanel.innerHTML = '';
    refs.detailPanel.hidden = true;
    return;
  }
  state.selectedRowKey = resolveRowKey(selected);
  const details = buildDetailEntries(selected).filter(([, value]) => String(value || '').trim() !== '');
  refs.detailPanel.hidden = false;
  refs.detailPanel.innerHTML = `
    <div class="dashboard-detail-header">
      <div>
        <div class="dashboard-detail-kicker">Detail</div>
        <h4>${escapeHtml(compactText(selected.host || selected.name || selected.client || selected.id))}</h4>
      </div>
      <div class="dashboard-detail-actions">
        <button type="button" class="dashboard-detail-close" data-detail-close aria-label="${escapeHtml(t('closeDetail', 'Close detail'))}">×</button>
      </div>
    </div>
    <div class="dashboard-detail-grid">
      ${details.map(([label, value]) => `
        <div class="dashboard-detail-item">
          <span>${escapeHtml(label)}</span>
          <strong data-copy-value="${escapeHtml(String(value))}" title="Click to copy">${escapeHtml(String(value))}</strong>
        </div>`).join('')}
    </div>`;
}

function renderViewSwitch() {
  if (!refs.viewSwitch) {
    return;
  }
  refs.viewSwitch.hidden = true;
}

function renderRecentStatusFilters() {
  if (!refs.statusFilters) {
    return;
  }
  const visible = state.activeTab === 'recent';
  refs.statusFilters.hidden = !visible;
  if (!visible) {
    return;
  }
  refs.statusFilters.querySelectorAll('[data-recent-status]').forEach((node) => {
    node.classList.toggle('active', node.dataset.recentStatus === state.recentStatus);
  });
}

function renderRecentTimeFilters() {
  if (!refs.timeFilters) {
    return;
  }
  const visible = state.activeTab === 'recent';
  refs.timeFilters.hidden = !visible;
  if (!visible) {
    return;
  }
  refs.timeFilters.querySelectorAll('[data-recent-range]').forEach((node) => {
    node.classList.toggle('active', Number(node.dataset.recentRange || 0) === state.recentRangeMs);
  });
}

function renderControlRow() {
  if (!refs.controlRow) {
    return;
  }
  refs.controlRow.dataset.mode = state.activeTab === 'recent' ? 'recent' : 'search-only';
}

function renderTable() {
  if (!refs.tableHead || !refs.tableBody || !refs.cardsView) {
    return;
  }
  const rows = sortRowsForCurrentTab(filterRows(resolveRowsByTab()));
  const currentView = resolveCurrentViewMode();
  renderSidebar(resolveRowsByTab());
  renderControlRow();
  renderViewSwitch();
  renderRecentStatusFilters();
  renderRecentTimeFilters();
  if (!rows.length) {
    refs.cardsView.hidden = true;
    refs.tableHead.innerHTML = '';
    refs.tableBody.innerHTML = `<tr><td class="dashboard-empty-row" colspan="10">${escapeHtml(getEmptyMessage())}</td></tr>`;
    renderDetailPanel([]);
    return;
  }
  if (!state.selectedRowKey || !rows.some((row) => resolveRowKey(row) === state.selectedRowKey)) {
    state.selectedRowKey = resolveRowKey(rows[0]);
  }
  if ((state.activeTab === 'dns' || state.activeTab === 'devices') && currentView === 'cards') {
    refs.tableHead.innerHTML = '';
    refs.tableBody.innerHTML = '';
    refs.cardsView.hidden = false;
    renderCards(rows);
    renderDetailPanel(rows);
    return;
  }
  refs.cardsView.hidden = true;
  refs.cardsView.innerHTML = '';
  if (state.activeTab === 'recent') renderRecentTable(rows);
  else if (state.activeTab === 'active') renderActiveTable(rows);
  else if (state.activeTab === 'dns') renderDnsTable(rows);
  else if (state.activeTab === 'devices') renderDevicesTable(rows);
  else renderTrafficTab(rows);
  renderDetailPanel(rows);
}

function renderSummary() {
  if (!refs.summaryGrid) {
    return;
  }
  if (!state.snapshot) {
    renderSummarySkeleton('empty');
    updateSummarySlot('status',
      t('summaryStatus', 'Status'),
      state.lastError ? t('degraded', 'Degraded') : t('booting', 'Booting'),
      state.lastError ? t('bridgeNotReady', 'Bridge snapshot not ready.') : t('waitingTrafficSamples', 'Waiting for traffic and connection samples.'));
    updateSummarySlot('active',
      t('summaryActiveConnections', 'Active Connections'),
      '0',
      t('awaitFirstPoll', 'Awaiting first poll'));
    updateSummarySlot('recent',
      t('summaryRecentRequests', 'Recent Requests'),
      '0',
      t('sessionCacheEmpty', 'Session cache empty'));
    updateSummarySlot('devices',
      t('summaryObservedDevices', 'Observed Devices'),
      '0',
      t('noSourceEndpoints', 'No source endpoints yet'));
    updateSummarySlot('upload',
      t('summaryUploadRate', 'Upload Rate'),
      '0 B/s',
      t('liveFeedInactive', 'Live feed inactive'));
    updateSummarySlot('download',
      t('summaryDownloadRate', 'Download Rate'),
      '0 B/s',
      t('liveFeedInactive', 'Live feed inactive'));
    return;
  }
  renderSummarySkeleton('live');
  const summary = state.snapshot.summary || {};
  const activeConnections = Array.isArray(state.snapshot.activeConnections) ? state.snapshot.activeConnections : [];
  const dnsRecords = Array.isArray(state.snapshot.dnsRecords) ? state.snapshot.dnsRecords : [];
  const devices = Array.isArray(state.snapshot.devices) ? state.snapshot.devices : [];
  const busiestPolicy = activeConnections
    .reduce((acc, row) => {
      const key = row.outbound || row.rule || 'Unknown';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  const topPolicy = Object.entries(busiestPolicy).sort((a, b) => b[1] - a[1])[0];
  updateSummarySlot('active',
    t('summaryActiveConnections', 'Active Connections'),
    String(summary.activeConnections || 0),
    pluralize(activeConnections.filter((row) => row.process).length, t('process', 'process')));
  updateSummarySlot('recent',
    t('summaryRecentRequests', 'Recent Requests'),
    String(summary.recentRequests || 0),
    pluralize(dnsRecords.length, t('dnsHost', 'DNS host')));
  updateSummarySlot('devices',
    t('summaryObservedDevices', 'Observed Devices'),
    String(devices.length || 0),
    topPolicy ? `${topPolicy[0]} ${t('busiest', 'busiest')}` : t('awaitingPolicyData', 'Awaiting policy data'));
  updateSummarySlot('upload',
    t('summaryUploadRate', 'Upload Rate'),
    formatRate(summary.uploadRate || 0),
    `${formatBytes(summary.totalUploadBytes || 0)} ${t('total', 'total')}`);
  updateSummarySlot('download',
    t('summaryDownloadRate', 'Download Rate'),
    formatRate(summary.downloadRate || 0),
    `${formatBytes(summary.totalDownloadBytes || 0)} ${t('total', 'total')}`);
  updateSummarySlot('balance',
    t('summaryTrafficBalance', 'Traffic Balance'),
    `${formatBytes(summary.totalDownloadBytes || 0)} / ${formatBytes(summary.totalUploadBytes || 0)}`,
    `${t('liveDown', 'Live')} ${formatRate(summary.downloadRate || 0)} down`);
}

function renderTabs() {
  if (!refs.tabs) {
    return;
  }
  refs.tabs.querySelectorAll('[data-dashboard-tab]').forEach((node) => {
    node.classList.toggle('active', node.dataset.dashboardTab === state.activeTab);
  });
  refs.groupButtons.querySelectorAll('[data-dashboard-group]').forEach((node) => {
    node.classList.toggle('active', node.dataset.dashboardGroup === state.groupBy);
  });
}

function renderAll() {
  renderLoadingOverlay();
  renderTabs();
  setPanelTitle();
  renderSummary();
  renderTable();
}

function dashboardLog(scope, message, payload = null, level = 'log') {
  return;
}

async function refreshSnapshot() {
  if (!window.clashfox || typeof window.clashfox.dashboardSnapshot !== 'function') {
    return;
  }
  state.loading = true;
  dashboardLog('snapshot', 'refresh started', { tab: state.activeTab, groupBy: state.groupBy });
  renderAll();
  try {
    const result = await window.clashfox.dashboardSnapshot({ limit: 320 });
    if (!result || !result.ok || !result.data) {
      state.lastError = result && result.error ? String(result.error) : 'dashboard_snapshot_failed';
      dashboardLog('snapshot', 'refresh failed', {
        error: state.lastError,
      }, 'warn');
      renderAll();
      return;
    }
    state.snapshot = result.data;
    state.lastError = '';
    dashboardLog('snapshot', 'refresh completed', {
      requests: Array.isArray(result.data.requests) ? result.data.requests.length : 0,
      connections: Array.isArray(result.data.connections) ? result.data.connections.length : 0,
      dns: Array.isArray(result.data.dns) ? result.data.dns.length : 0,
      devices: Array.isArray(result.data.devices) ? result.data.devices.length : 0,
    });
    renderAll();
  } catch {
    state.lastError = 'dashboard_snapshot_failed';
    dashboardLog('snapshot', 'refresh threw', { error: state.lastError }, 'error');
    renderAll();
  } finally {
    state.loading = false;
    renderAll();
  }
}

function startPolling() {
  if (state.timer) {
    clearInterval(state.timer);
  }
  refreshSnapshot().catch(() => {});
  state.timer = setInterval(() => {
    refreshSnapshot().catch(() => {});
  }, POLL_MS);
}

function bindEvents() {
  if (refs.bound) {
    return;
  }
  refs.bound = true;
  refs.tabs.addEventListener('click', (event) => {
    const button = event.target.closest('[data-dashboard-tab]');
    if (!button) return;
    state.activeTab = button.dataset.dashboardTab || 'recent';
    dashboardLog('interaction', 'tab changed', { tab: state.activeTab });
    state.selectedFilter = '';
    writePrefs();
    renderAll();
  });
  refs.groupButtons.addEventListener('click', (event) => {
    const button = event.target.closest('[data-dashboard-group]');
    if (!button) return;
    state.groupBy = button.dataset.dashboardGroup || 'client';
    dashboardLog('interaction', 'group changed', { groupBy: state.groupBy });
    state.selectedFilter = '';
    writePrefs();
    renderAll();
  });
  refs.filterList.addEventListener('click', (event) => {
    const button = event.target.closest('[data-filter]');
    if (!button) return;
    state.selectedFilter = button.dataset.filter || '';
    dashboardLog('interaction', 'filter changed', { filter: state.selectedFilter });
    writePrefs();
    renderAll();
  });
  refs.searchInput.addEventListener('input', () => {
    state.query = refs.searchInput.value || '';
    dashboardLog('interaction', 'search changed', { query: state.query });
    writePrefs();
    renderAll();
  });
  refs.statusFilters.addEventListener('click', (event) => {
    const button = event.target.closest('[data-recent-status]');
    if (!button) return;
    state.recentStatus = normalizeRecentStatus(button.dataset.recentStatus);
    dashboardLog('interaction', 'status filter changed', { recentStatus: state.recentStatus });
    writePrefs();
    renderAll();
  });
  refs.timeFilters.addEventListener('click', (event) => {
    const button = event.target.closest('[data-recent-range]');
    if (!button) return;
    state.recentRangeMs = normalizeRecentRange(button.dataset.recentRange);
    dashboardLog('interaction', 'time range changed', { recentRangeMs: state.recentRangeMs });
    writePrefs();
    renderAll();
  });
  refs.tableBody.addEventListener('click', (event) => {
    const row = event.target.closest('[data-row-key]');
    if (!row) return;
    state.selectedRowKey = row.dataset.rowKey || '';
    state.detailVisible = true;
    dashboardLog('interaction', 'table row selected', { rowKey: state.selectedRowKey });
    writePrefs();
    renderAll();
  });
  refs.cardsView.addEventListener('click', (event) => {
    const card = event.target.closest('[data-row-key]');
    if (!card) return;
    state.selectedRowKey = card.dataset.rowKey || '';
    state.detailVisible = true;
    dashboardLog('interaction', 'card selected', { rowKey: state.selectedRowKey });
    writePrefs();
    renderAll();
  });
  refs.detailPanel.addEventListener('click', async (event) => {
    const closeButton = event.target.closest('[data-detail-close]');
    if (closeButton) {
      state.detailVisible = false;
      dashboardLog('interaction', 'detail closed');
      renderAll();
      return;
    }
    const target = event.target.closest('[data-copy-value]');
    if (!target) return;
    const value = String(target.dataset.copyValue || '').trim();
    if (!value || value === '-') return;
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(value);
      } else {
        const input = document.createElement('textarea');
        input.value = value;
        input.style.position = 'fixed';
        input.style.opacity = '0';
        document.body.appendChild(input);
        input.focus();
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }
      if (refs.liveMeta) {
        refs.liveMeta.textContent = t('copied', 'Copied');
        refs.liveMeta.dataset.state = 'live';
      }
    } catch {
      // ignore copy failure
    }
  });
}

export async function initDashboardPanel() {
  dashboardLog('lifecycle', 'init requested');
  state.root = $('dashboardLocalPanel');
  if (!state.root) {
    return;
  }
  refs.tabs = $('dashboardTabs');
  refs.controlRow = $('dashboardControlRow');
  refs.groupButtons = $('dashboardGroupButtons');
  refs.statusFilters = $('dashboardStatusFilters');
  refs.timeFilters = $('dashboardTimeFilters');
  refs.filterList = $('dashboardFilterList');
  refs.searchInput = $('dashboardSearchInput');
  refs.summaryGrid = $('dashboardSummaryGrid');
  refs.tableHead = $('dashboardTableHead');
  refs.tableBody = $('dashboardTableBody');
  refs.cardsView = $('dashboardCardsView');
  refs.panelTitle = $('dashboardPanelTitle');
  refs.panelMeta = $('dashboardPanelMeta');
  refs.liveMeta = $('dashboardLiveMeta');
  refs.viewSwitch = $('dashboardViewSwitch');
  refs.detailPanel = $('dashboardDetailPanel');
  if (!state.initialized) {
    const prefs = readPrefs();
    state.activeTab = prefs.activeTab || state.activeTab;
    state.recentStatus = normalizeRecentStatus(prefs.recentStatus || state.recentStatus);
    state.recentRangeMs = normalizeRecentRange(prefs.recentRangeMs);
    state.groupBy = prefs.groupBy || state.groupBy;
    state.selectedFilter = prefs.selectedFilter || '';
    state.selectedRowKey = prefs.selectedRowKey || '';
    state.query = prefs.query || '';
    state.viewMode = {
      dns: normalizeViewMode('dns', prefs.viewMode && prefs.viewMode.dns),
      devices: normalizeViewMode('devices', prefs.viewMode && prefs.viewMode.devices),
    };
    if (refs.searchInput) {
      refs.searchInput.value = state.query;
    }
    bindEvents();
    state.initialized = true;
  }
  if (!state.snapshot) {
    state.loading = true;
  }
  ensureLoadingOverlay();
  renderAll();
  startPolling();
  dashboardLog('lifecycle', 'init completed', {
    activeTab: state.activeTab,
    groupBy: state.groupBy,
  });
}

export function setDashboardLocale(locale = 'en') {
  const normalized = normalizeLocale(locale);
  if (state.locale === normalized) {
    return;
  }
  state.locale = normalized;
  renderAll();
}

export function teardownDashboardPanel() {
  dashboardLog('lifecycle', 'teardown');
  if (state.timer) {
    clearInterval(state.timer);
    state.timer = null;
  }
}
