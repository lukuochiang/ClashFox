const stageEl = document.getElementById('trayStage');
const menuRootEl = document.getElementById('menuRoot');
const headerEl = document.getElementById('menuHeader');
const listEl = document.getElementById('menuList');
const submenuRootEl = document.getElementById('submenuRoot');
const submenuListEl = document.getElementById('submenuList');

let menuData = null;
let activeSubmenuKey = null;
let activeSubmenuAnchor = null;
let submenuHideTimer = null;
let connectivityRefreshTimer = null;
let lastExpandedSent = null;
let lastHeightSent = 0;
let lastWidthSent = 0;
let blockClickUntil = 0;
let menuVersion = 0;
const SUBMENU_MIN_WIDTH = 170;
const SUBMENU_MAX_WIDTH = 340;
const CONNECTIVITY_REFRESH_MS = 1000;

const ICON_SVGS = {
  showMain: '<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="14" rx="2"/><path d="M4 9h16"/></svg>',
  networkTakeover: '<svg viewBox="0 0 24 24"><path d="M4 10a12 12 0 0 1 16 0"/><path d="M7 13a8 8 0 0 1 10 0"/><path d="M10 16a4 4 0 0 1 4 0"/><circle cx="12" cy="19" r="1"/></svg>',
  outboundMode: '<svg viewBox="0 0 24 24"><path d="M4 8h11"/><path d="M12 5l3 3-3 3"/><path d="M20 16H9"/><path d="M12 13l-3 3 3 3"/></svg>',
  dashboard: '<svg viewBox="0 0 24 24"><path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20v-4"/></svg>',
  kernelManager: '<svg viewBox="0 0 24 24"><rect x="7" y="7" width="10" height="10" rx="2"/><path d="M3 10h2M3 14h2M19 10h2M19 14h2M10 3v2M14 3v2M10 19v2M14 19v2"/></svg>',
  settings: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a1.7 1.7 0 0 1-2.4 2.4l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a1.7 1.7 0 1 1-3.4 0v-.2a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a1.7 1.7 0 0 1-2.4-2.4l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H6a1.7 1.7 0 1 1 0-3.4h.2a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a1.7 1.7 0 0 1 2.4-2.4l.1.1a1 1 0 0 0 1.1.2 1 1 0 0 0 .6-.9V6a1.7 1.7 0 1 1 3.4 0v.2a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a1.7 1.7 0 0 1 2.4 2.4l-.1.1a1 1 0 0 0-.2 1.1 1 1 0 0 0 .9.6h.2a1.7 1.7 0 1 1 0 3.4h-.2a1 1 0 0 0-.9.6z"/></svg>',
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
};

function clearHideTimer() {
  if (submenuHideTimer) {
    clearTimeout(submenuHideTimer);
    submenuHideTimer = null;
  }
}

function stopConnectivityRefresh() {
  if (connectivityRefreshTimer) {
    clearInterval(connectivityRefreshTimer);
    connectivityRefreshTimer = null;
  }
}

function applyConnectivitySnapshot(snapshot) {
  if (!snapshot || !menuData || !menuData.submenus || !Array.isArray(menuData.submenus.network)) {
    return;
  }
  const text = snapshot.text ? String(snapshot.text) : '-';
  const tone = snapshot.tone ? String(snapshot.tone) : 'neutral';
  menuData.submenus.network = menuData.submenus.network.map((item) => {
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
  if (activeSubmenuKey !== 'network') {
    return;
  }
  const row = submenuListEl.querySelector('.menu-row[data-icon-key="connectivityQuality"]');
  if (!row) {
    return;
  }
  let badge = row.querySelector('.menu-badge');
  if (!badge) {
    badge = document.createElement('div');
    badge.className = 'menu-badge';
    row.appendChild(badge);
  }
  badge.className = `menu-badge tone-${tone}`;
  badge.textContent = text;
}

async function refreshConnectivityBadge() {
  if (activeSubmenuKey !== 'network' || !window.clashfox || typeof window.clashfox.trayMenuGetConnectivity !== 'function') {
    return;
  }
  try {
    const snapshot = await window.clashfox.trayMenuGetConnectivity();
    applyConnectivitySnapshot(snapshot);
  } catch {
    // ignore transient refresh errors
  }
}

function ensureConnectivityRefresh() {
  if (activeSubmenuKey !== 'network') {
    stopConnectivityRefresh();
    return;
  }
  refreshConnectivityBadge();
  if (connectivityRefreshTimer) {
    return;
  }
  connectivityRefreshTimer = setInterval(() => {
    refreshConnectivityBadge();
  }, CONNECTIVITY_REFRESH_MS);
}

function syncWindowGeometry(expanded) {
  const rootRect = menuRootEl.getBoundingClientRect();
  const rootWidth = Math.ceil(rootRect.width) || 260;
  const submenuWidth = !submenuRootEl.classList.contains('hidden')
    ? Math.ceil(submenuRootEl.offsetWidth || 0)
    : 0;
  const height = Math.ceil(rootRect.height) + 2;
  const width = expanded ? (rootWidth + submenuWidth) : rootWidth;
  if (
    lastExpandedSent === Boolean(expanded)
    && Math.abs(height - lastHeightSent) <= 2
    && Math.abs(width - lastWidthSent) <= 2
  ) {
    return;
  }
  lastExpandedSent = Boolean(expanded);
  lastHeightSent = height;
  lastWidthSent = width;
  window.clashfox.trayMenuSetExpanded(Boolean(expanded), { height, width });
}

function hideSubmenu() {
  stopConnectivityRefresh();
  activeSubmenuKey = null;
  activeSubmenuAnchor = null;
  submenuRootEl.classList.add('hidden');
  submenuListEl.innerHTML = '';
  listEl.querySelectorAll('.menu-row.expanded').forEach((node) => node.classList.remove('expanded'));
  syncWindowGeometry(false);
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

function makeRow(item, options = {}) {
  if (item.type === 'separator') {
    const sep = document.createElement('div');
    sep.className = 'menu-row-sep';
    return sep;
  }

  const { isSubmenu = false, submenuKey = '', withCheckColumn = false } = options;
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
  if (withCheckColumn) {
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

  if (!isSubmenu && item.submenu) {
    row.dataset.submenuKey = String(item.submenu);
    const arrow = document.createElement('div');
    arrow.className = 'menu-arrow';
    arrow.textContent = '›';
    row.appendChild(arrow);
  }

  if (!clickable) {
    return row;
  }

  if (!isSubmenu && item.submenu) {
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

  if (!isSubmenu && !item.submenu) {
    row.addEventListener('mouseenter', () => {
      hideSubmenu();
    });
  }

  row.addEventListener('click', async () => {
    if (Date.now() < blockClickUntil) {
      return;
    }
    await runActionForItem(item, submenuKey);
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
  if (submenuKey) {
    hideSubmenu();
  } else {
    hideSubmenu();
  }
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

function applySubmenuSide() {
  const side = (menuData && menuData.meta && menuData.meta.submenuSide) === 'left' ? 'left' : 'right';
  stageEl.classList.remove('side-left', 'side-right');
  stageEl.classList.add(side === 'left' ? 'side-left' : 'side-right');
}

function renderMainList() {
  listEl.innerHTML = '';
  const items = Array.isArray(menuData && menuData.items) ? menuData.items : [];
  for (const item of items) {
    listEl.appendChild(makeRow(item, { withCheckColumn: false }));
  }
}

function renderSubmenuList(submenuKey) {
  submenuListEl.innerHTML = '';
  const items = (menuData && menuData.submenus && Array.isArray(menuData.submenus[submenuKey]))
    ? menuData.submenus[submenuKey]
    : [];
  const withCheckColumn = items.some((item) => item && item.type !== 'separator' && typeof item.checked === 'boolean');
  for (const item of items) {
    submenuListEl.appendChild(makeRow(item, { isSubmenu: true, submenuKey, withCheckColumn }));
  }
}

function applySubmenuWidthByContent() {
  if (!submenuRootEl) {
    return;
  }
  submenuRootEl.style.width = 'fit-content';
  const measured = Math.ceil(submenuRootEl.getBoundingClientRect().width || 0);
  const width = Math.max(SUBMENU_MIN_WIDTH, Math.min(measured, SUBMENU_MAX_WIDTH));
  submenuRootEl.style.width = `${width}px`;
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
  if (
    activeSubmenuKey === submenuKey
    && !submenuRootEl.classList.contains('hidden')
    && activeSubmenuAnchor === resolvedAnchor
  ) {
    clearHideTimer();
    return;
  }
  clearHideTimer();
  activeSubmenuKey = submenuKey;
  activeSubmenuAnchor = resolvedAnchor;
  listEl.querySelectorAll('.menu-row.expanded').forEach((node) => node.classList.remove('expanded'));
  if (resolvedAnchor) {
    resolvedAnchor.classList.add('expanded');
  }

  renderSubmenuList(submenuKey);
  submenuRootEl.classList.remove('hidden');
  applySubmenuWidthByContent();
  const rootRect = menuRootEl.getBoundingClientRect();
  const anchor = resolveSubmenuAnchor(submenuKey, activeSubmenuAnchor);
  let top = 56;
  if (anchor) {
    const anchorRect = anchor.getBoundingClientRect();
    const rawTop = anchorRect.top - rootRect.top;
    top = Math.max(8, rawTop);
  }
  submenuRootEl.style.top = `${top}px`;
  syncWindowGeometry(true);
  ensureConnectivityRefresh();
}

function renderAll() {
  applySubmenuSide();
  renderHeader();
  renderMainList();
  hideSubmenu();
}

async function init() {
  try {
    menuData = await window.clashfox.trayMenuGetData();
    renderAll();
  } catch {
    // ignore
  }

  window.clashfox.onTrayMenuUpdate((payload) => {
    if (!payload) {
      return;
    }
    menuVersion += 1;
    const keepSubmenuKey = activeSubmenuKey;
    const keepSubmenuAnchorKey = activeSubmenuAnchor
      && activeSubmenuAnchor.dataset
      && activeSubmenuAnchor.dataset.submenuKey
      ? activeSubmenuAnchor.dataset.submenuKey
      : keepSubmenuKey;
    menuData = payload;
    applySubmenuSide();
    renderHeader();
    renderMainList();
    if (keepSubmenuKey && keepSubmenuAnchorKey) {
      const nextAnchor = findMainAnchorBySubmenuKey(keepSubmenuAnchorKey);
      if (nextAnchor) {
        // Force refresh submenu content with latest payload to avoid stale rows.
        activeSubmenuKey = null;
        activeSubmenuAnchor = null;
        openSubmenu(keepSubmenuKey, nextAnchor);
        return;
      }
    }
    hideSubmenu();
  });

  stageEl.addEventListener('mouseenter', clearHideTimer);
  headerEl.addEventListener('mouseenter', hideSubmenu);
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
  }
});

init();
