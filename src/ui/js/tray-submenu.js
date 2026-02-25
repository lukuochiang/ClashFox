const submenuRootEl = document.getElementById('submenuRoot');
const submenuListEl = document.getElementById('submenuList');

let submenuKey = '';
let submenuItems = [];
let connectivityRefreshTimer = null;
const CONNECTIVITY_REFRESH_MS = 1000;
const SUBMENU_MIN_WIDTH = 170;
const SUBMENU_MAX_WIDTH = 340;

const ICON_SVGS = {
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

async function refreshConnectivityBadge() {
  if (submenuKey !== 'network' || !window.clashfox || typeof window.clashfox.trayMenuGetConnectivity !== 'function') {
    return;
  }
  try {
    const snapshot = await window.clashfox.trayMenuGetConnectivity();
    applyConnectivitySnapshot(snapshot);
  } catch {
    // ignore
  }
}

function ensureConnectivityRefresh() {
  if (submenuKey !== 'network') {
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

async function runActionForItem(item) {
  if (!item || !item.action || !window.clashfox || typeof window.clashfox.trayMenuAction !== 'function') {
    return;
  }
  // Keep submenu considered “hovered” briefly so blur from opening Finder doesn’t auto-hide.
  if (window.clashfox && typeof window.clashfox.traySubmenuHover === 'function') {
    window.clashfox.traySubmenuHover(true);
  }
  const payload = { ...item };
  if (typeof item.checked === 'boolean') {
    payload.checked = !item.checked;
  }
  const response = await window.clashfox.trayMenuAction(item.action, payload);
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

  if (clickable) {
    row.addEventListener('click', async (event) => {
      event.stopPropagation();
      await runActionForItem(item);
    });
  }
  return row;
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

function renderSubmenu() {
  submenuListEl.innerHTML = '';
  submenuItems.forEach((item) => {
    submenuListEl.appendChild(makeRow(item));
  });
  applySubmenuWidthByContent();
  window.clashfox.traySubmenuResize({
    width: Math.ceil(submenuRootEl.getBoundingClientRect().width || 0),
    height: Math.ceil(submenuRootEl.getBoundingClientRect().height || 0),
  });
}

function setSubmenu(payload) {
  submenuKey = payload && payload.key ? payload.key : '';
  submenuItems = Array.isArray(payload && payload.items) ? payload.items : [];
  renderSubmenu();
  ensureConnectivityRefresh();
}

if (window.clashfox && typeof window.clashfox.onTraySubmenuUpdate === 'function') {
  window.clashfox.onTraySubmenuUpdate((payload) => {
    setSubmenu(payload);
  });
}

if (window.clashfox && typeof window.clashfox.traySubmenuHover === 'function') {
  document.addEventListener('mouseenter', () => window.clashfox.traySubmenuHover(true));
  document.addEventListener('mouseleave', () => window.clashfox.traySubmenuHover(false));
}

if (window.clashfox && typeof window.clashfox.traySubmenuReady === 'function') {
  window.clashfox.traySubmenuReady();
}
