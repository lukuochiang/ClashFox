const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');
const dns = require('dns');
const net = require('net');
const { app, BrowserWindow, ipcMain, dialog, nativeImage, Menu, nativeTheme, shell, Tray, session, clipboard, screen } = require('electron');
const { spawn, spawnSync, execFile } = require('child_process');

const isDev = !app.isPackaged;
const ROOT_DIR = isDev ? path.join(__dirname, '..') : process.resourcesPath;
const APP_PATH = app.getAppPath ? app.getAppPath() : ROOT_DIR;
app.name = 'ClashFox';
app.setName('ClashFox');
const APP_DATA_DIR = path.join(app.getPath('appData'), app.getName());
const WORK_DIR = path.join(APP_DATA_DIR, 'work');
app.setPath('userData', WORK_DIR);
// app.setPath('cache', path.join(WORK_DIR, 'Cache'));
// app.setPath('logs', path.join(WORK_DIR, 'Logs'));

function ensureAppDirs() {
  try {
    fs.mkdirSync(APP_DATA_DIR, { recursive: true });
    fs.mkdirSync(WORK_DIR, { recursive: true });
    fs.mkdirSync(path.join(APP_DATA_DIR, 'core'), { recursive: true });
    fs.mkdirSync(path.join(APP_DATA_DIR, 'config'), { recursive: true });
    fs.mkdirSync(path.join(APP_DATA_DIR, 'data'), { recursive: true });
    fs.mkdirSync(path.join(APP_DATA_DIR, 'logs'), { recursive: true });
    fs.mkdirSync(path.join(APP_DATA_DIR, 'runtime'), { recursive: true });
  } catch {
    // ignore
  }
}

function getBridgePath() {
  const candidates = [
    path.join(ROOT_DIR, 'static', 'scripts', 'gui_bridge.sh'),
    path.join(process.resourcesPath || '', 'scripts', 'gui_bridge.sh'),
    path.join(ROOT_DIR, 'scripts', 'gui_bridge.sh'),
  ];
  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return path.join(ROOT_DIR, 'static', 'scripts', 'gui_bridge.sh');
}
let mainWindow = null;
let tray = null;
let trayMenuWindow = null;
let trayMenuVisible = false;
let trayMenuData = null;
let trayMenuBuildInProgress = false;
let trayMenuBuildPending = false;
let trayMenuContentHeight = 420;
let trayMenuRefreshTimer = null;
let trayMenuRendererReady = false;
let trayMenuLastBuiltAt = 0;
let trayMenuDataSignature = '';
let trayMenuClosing = false;
let traySubmenuWindow = null;
let traySubmenuVisible = false;
let traySubmenuReady = false;
let traySubmenuHovering = false;
let traySubmenuAnchor = { top: 0, height: 0, rootHeight: 0 };
let traySubmenuLastSize = { width: 0, height: 0 };
let traySubmenuPendingPayload = null;
let dashboardWindow = null;
let foxboardWindow = null;
let foxboardPreloadWindow = null;
let worldwideWindow = null;
let worldwidePreloadWindow = null;
let mainWindowResizePersistTimer = null;
let suppressMainWindowSizeApplyUntil = 0;
let currentInstallProcess = null; // 仅用于跟踪安装进程，支持取消功能
let globalSettings = {
  debugMode: true, // 是否启用调试模式
};
function guiMainLog(scope, message, payload = null, level = 'log') {
  void scope;
  void message;
  void payload;
  void level;
}

function buildTrayMenuDataSignature(value = null) {
  try {
    return JSON.stringify(value || {});
  } catch {
    return '';
  }
}

function truncateLogPayload(value, maxLength = 1200) {
  const text = String(value === undefined || value === null ? '' : value);
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength)}...[truncated ${text.length - maxLength} chars]`;
}

let helperRequestSeq = 0;

function nextHelperRequestId() {
  helperRequestSeq += 1;
  return `helper-${Date.now()}-${helperRequestSeq}`;
}

function resolveHelperRequestKind(command = '', method = 'GET', path = '') {
  const normalizedCommand = String(command || '').trim().toLowerCase();
  const normalizedMethod = String(method || '').trim().toUpperCase();
  const normalizedPath = String(path || '').trim();
  if (normalizedCommand === 'status' && normalizedMethod === 'GET' && normalizedPath === '/v1/core/status') {
    return 'auto';
  }
  if (normalizedCommand === 'ping' && normalizedMethod === 'GET' && normalizedPath === '/health') {
    return 'auto';
  }
  return 'manual';
}

function shouldSuppressHelperRequestLog(command = '', method = 'GET', path = '', level = 'log', ok = true) {
  if (level !== 'log') {
    return false;
  }
  if (resolveHelperRequestKind(command, method, path) === 'auto' && ok) {
    return true;
  }
  return false;
}

function resolveMihomoRequestKind(method = 'GET', url = '') {
  const normalizedMethod = String(method || '').trim().toUpperCase();
  const normalizedUrl = String(url || '').trim();
  if (normalizedMethod === 'GET' && /\/configs(?:\?|$)/i.test(normalizedUrl)) {
    return 'auto';
  }
  return 'manual';
}

function shouldSuppressMihomoRequestLog(method = 'GET', url = '', level = 'log', ok = true) {
  if (level !== 'log') {
    return false;
  }
  return resolveMihomoRequestKind(method, url) === 'auto' && ok;
}

let isQuitting = false;
const CORE_STARTUP_ESTIMATE_MIN_MS = 900;
const CORE_STARTUP_ESTIMATE_MAX_MS = 10000;
const RESTART_TRANSITION_MIN_MS = 450;
const RESTART_TRANSITION_MAX_MS = 4000;
const RESTART_TRANSITION_RATIO = 0.5;
let trayCoreStartupEstimateMs = 1500;
const PRIVILEGED_COMMANDS = new Set([
  'install',
  'delete-backups',
  'system-proxy-enable',
  'system-proxy-disable',
  'system-proxy-status',
]);
const HELPER_SOCKET_PATH = '/var/run/com.clashfox.helper.sock';
const HELPER_APP_BUNDLE_DIR = '/Applications/ClashFox.app/Contents/Resources/helper';
const HELPER_USER_DIR = path.join(APP_DATA_DIR, 'helper');
const HELPER_LEGACY_DIR = '/Library/Application Support/ClashFox/helper';
const HELPER_TOKEN_PATH = path.join(HELPER_USER_DIR, 'token');
const HELPER_TOKEN_LEGACY_PATH = `${HELPER_LEGACY_DIR}/token`;
const SYSTEM_AUTH_ERROR_PREFIX = '__CLASHFOX_SYSTEM_AUTH_ERROR__';
const OUTBOUND_MODE_BADGE = {
  rule: 'R',
  global: 'G',
  direct: 'D',
};
const CONNECTIVITY_REFRESH_MS = 1500;
const CHECK_UPDATE_API_URL = 'https://api.github.com/repos/lukuochiang/ClashFox/releases?per_page=30';
const CHECK_UPDATE_STABLE_URL = 'https://github.com/lukuochiang/ClashFox/releases/latest';
const CHECK_UPDATE_BETA_URL = 'https://github.com/lukuochiang/ClashFox/releases';
const HELPER_RELEASE_LATEST_URL = 'https://github.com/lukuochiang/ClashFox-Helper/releases/latest';
const KERNEL_RELEASE_API = {
  vernesong: 'https://api.github.com/repos/vernesong/mihomo/releases?per_page=50',
  MetaCubeX: 'https://api.github.com/repos/MetaCubeX/mihomo/releases?per_page=50',
};
const KERNEL_BETA_VERSION_TXT_URL = {
  vernesong: 'https://github.com/vernesong/mihomo/releases/download/Prerelease-Alpha/version.txt',
  MetaCubeX: 'https://github.com/MetaCubeX/mihomo/releases/download/Prerelease-Alpha/version.txt',
};
const DEFAULT_MAIN_WINDOW_WIDTH = 980;
const DEFAULT_MAIN_WINDOW_HEIGHT = 640;
const MIN_MAIN_WINDOW_WIDTH = 980;
const MIN_MAIN_WINDOW_HEIGHT = 640;
const MAX_MAIN_WINDOW_WIDTH = 4096;
const MAX_MAIN_WINDOW_HEIGHT = 2160;
const trayIconCache = new Map();
let connectivityQualityCache = {
  text: '-',
  tone: 'neutral',
  updatedAt: 0,
};
let connectivityQualityFetchPromise = null;
const HELPER_UPDATE_CACHE_TTL_MS = 3 * 60 * 1000;
let helperUpdateCache = {
  checkedAt: 0,
  acceptBeta: null,
  result: null,
};
const WORLDWIDE_TRACK_LIMIT = 320;
const WORLDWIDE_MAX_POINTS = 80;
const WORLDWIDE_FILTER_TOP_TRACKS = 500;
const WORLDWIDE_DNS_CACHE_TTL_MS = 10 * 60 * 1000;
const WORLDWIDE_GEO_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const WORLDWIDE_SELF_GEO_TTL_MS = 30 * 60 * 1000;
const DASHBOARD_TRACK_LIMIT = 320;
const DASHBOARD_RECENT_LIMIT = 240;
const DASHBOARD_DNS_LIMIT = 200;
const DASHBOARD_DEVICES_LIMIT = 32;
const DASHBOARD_TOP_LIMIT = 24;
const DASHBOARD_HISTORY_MAX_AGE_MS = 45 * 60 * 1000;
const worldwideDnsCache = new Map();
const worldwideGeoCache = new Map();
const dashboardActiveConnections = new Map();
const dashboardDnsRecords = new Map();
const dashboardRecentRequests = [];
let dashboardEventSeq = 1;
let worldwideSelfGeoCache = {
  expiresAt: 0,
  data: null,
};
let worldwideCityReader = null;
let worldwideCountryReader = null;
let maxmindModule = null;
let maxmindModuleError = null;
const dnsLookupAsync = dns.promises && dns.promises.lookup
  ? dns.promises.lookup.bind(dns.promises)
  : null;

const I18N = require(path.join(APP_PATH, 'src', 'ui', 'locales', 'i18n.js'));
const {
  normalizeLocaleCode,
  resolveLocaleFromSettings,
} = require(path.join(APP_PATH, 'src', 'ui', 'js', 'locale-utils.js'));

function resolveTrayLang() {
  const settings = readAppSettings();
  const resolved = resolveLocaleFromSettings(settings, {
    systemLocale: (app.getLocale && app.getLocale()) || 'en',
  });
  const normalized = normalizeLocaleCode(resolved);
  return I18N[normalized] ? normalized : 'en';
}

function getTrayLabels() {
  const lang = resolveTrayLang();
  const tray = (I18N[lang] && I18N[lang].tray) || (I18N.en && I18N.en.tray) || {};
  return tray;
}

function getUiLabels() {
  const lang = resolveTrayLang();
  return (I18N[lang] && I18N[lang].labels) || (I18N.en && I18N.en.labels) || {};
}

function getConfigPathFromSettings() {
  const settings = readAppSettings();
  const configPath = settings && typeof settings.configFile === 'string' ? settings.configFile.trim() : '';
  if (configPath && fs.existsSync(configPath)) {
    return configPath;
  }
  return path.join(APP_DATA_DIR, 'config', 'default.yaml');
}

function getNavLabels() {
  const lang = resolveTrayLang();
  return (I18N[lang] && I18N[lang].nav) || (I18N.en && I18N.en.nav) || {};
}

function refreshTrayMenuLabelsOnly() {
  if (!trayMenuData) {
    return;
  }
  const labels = getTrayLabels();
  const uiLabels = getUiLabels();
  const navLabels = getNavLabels();
  const runningLabel = uiLabels.running || labels.on || 'Running';
  const stoppedLabel = uiLabels.stopped || labels.off || 'Stopped';

  if (trayMenuData.header && trayMenuData.header.statusState) {
    trayMenuData.header.status = trayMenuData.header.statusState === 'running'
      ? runningLabel
      : stoppedLabel;
  }

  trayMenuData.items = (trayMenuData.items || []).map((item) => {
    if (!item || item.type === 'separator') {
      return item;
    }
    if (item.action === 'show-main') {
      return { ...item, label: labels.showMain };
    }
    if (item.submenu === 'network') {
      return { ...item, label: labels.networkTakeover || 'Network Takeover' };
    }
    if (item.submenu === 'outbound') {
      return { ...item, label: labels.outboundMode || 'Outbound Mode' };
    }
    if (item.submenu === 'panel') {
      return { ...item, label: labels.panel || 'Panel' };
    }
    if (item.action === 'open-dashboard') {
      return { ...item, label: labels.dashboard };
    }
    if (item.action === 'open-worldwide') {
      return { ...item, label: labels.trackers || 'Trackers' };
    }
    if (item.action === 'open-foxboard') {
      return { ...item, label: 'Foxboard' };
    }
    if (item.submenu === 'kernel') {
      return { ...item, label: labels.kernelManager };
    }
    if (item.submenu === 'directory') {
      return { ...item, label: labels.directoryLocations || 'Directory Locations' };
    }
    if (item.action === 'open-settings') {
      return { ...item, label: navLabels.settings || 'Settings' };
    }
    if (item.action === 'check-update') {
      return { ...item, label: labels.checkUpdate || 'Check for Updates' };
    }
    if (item.action === 'quit') {
      return { ...item, label: labels.quit };
    }
    return item;
  });

  if (trayMenuData.submenus && Array.isArray(trayMenuData.submenus.network)) {
    trayMenuData.submenus.network = trayMenuData.submenus.network.map((item) => {
      if (!item || item.type === 'separator') {
        return item;
      }
      if (item.action === 'toggle-system-proxy') {
        return { ...item, label: labels.networkTakeover || 'Network Takeover' };
      }
      if (item.action === 'toggle-tun') {
        return { ...item, label: labels.tun || 'TUN' };
      }
      if (item.iconKey === 'currentService') {
        const prevLabel = String(item.label || '');
        const parts = prevLabel.split(':');
        const service = parts.length > 1 ? parts.slice(1).join(':').trim() : '-';
        return { ...item, label: `${labels.currentService || 'Current Service'}: ${service || '-'}` };
      }
      if (item.iconKey === 'connectivityQuality') {
        return { ...item, label: labels.connectivityQuality || 'Connectivity Quality' };
      }
      if (item.action === 'copy-shell-export') {
        return { ...item, label: labels.copyShellExportCommand || 'Copy Shell Export Command' };
      }
      return item;
    });
  }

  if (trayMenuData.submenus && Array.isArray(trayMenuData.submenus.outbound)) {
    trayMenuData.submenus.outbound = trayMenuData.submenus.outbound.map((item) => {
      if (!item || item.type === 'separator') {
        return item;
      }
      if (item.value === 'global') {
        return { ...item, label: labels.modeGlobalTitle || 'Global Proxy' };
      }
      if (item.value === 'rule') {
        return { ...item, label: labels.modeRuleTitle || 'Rule-Based Proxy' };
      }
      if (item.value === 'direct') {
        return { ...item, label: labels.modeDirectTitle || 'Direct Outbound' };
      }
      return item;
    });
  }

  if (trayMenuData.submenus && Array.isArray(trayMenuData.submenus.kernel)) {
    trayMenuData.submenus.kernel = trayMenuData.submenus.kernel.map((item) => {
      if (!item || item.type === 'separator') {
        return item;
      }
      if (item.action === 'kernel-start') {
        return { ...item, label: labels.startKernel };
      }
      if (item.action === 'kernel-stop') {
        return { ...item, label: labels.stopKernel };
      }
      if (item.action === 'kernel-restart') {
        return { ...item, label: labels.restartKernel };
      }
      return item;
    });
  }

  if (trayMenuData.submenus && Array.isArray(trayMenuData.submenus.directory)) {
    trayMenuData.submenus.directory = trayMenuData.submenus.directory.map((item) => {
      if (!item || item.type === 'separator') {
        return item;
      }
      if (item.action === 'open-user-directory') {
        return { ...item, label: labels.userDirectory || 'User Directory' };
      }
      if (item.action === 'open-config-directory') {
        return { ...item, label: labels.userConfigDirectory || 'Config Directory' };
      }
      if (item.action === 'open-work-directory') {
        return { ...item, label: labels.workDirectory || 'Work Directory' };
      }
      if (item.action === 'open-log-directory') {
        return { ...item, label: labels.logDirectory || 'Log Directory' };
      }
      return item;
    });
  }

  if (trayMenuWindow && !trayMenuWindow.isDestroyed()) {
    trayMenuWindow.webContents.send('clashfox:trayMenu:update', trayMenuData);
  }
}

async function openDirectoryInFinder(targetPath) {
  try {
    if (!targetPath || typeof targetPath !== 'string') {
      return false;
    }
    const result = await shell.openPath(targetPath);
    return !result;
  } catch {
    return false;
  }
}

function withMacTrayGlyph(key, label) {
  const text = String(label || '').trim();
  if (process.platform !== 'darwin' || !text) {
    return text;
  }
  const glyphs = {
    showMain: 'Ⓜ',
    networkTakeover: 'Ⓟ',
    outboundMode: 'Ⓞ',
    dashboard: 'Ⓓ',
    kernelManager: 'Ⓚ',
    settings: 'Ⓢ',
    checkUpdate: 'Ⓤ',
    quit: 'Ⓠ',
  };
  const glyph = glyphs[key] || '';
  return glyph ? `${glyph} ${text}` : text;
}

function readAppSettings() {
  try {
    const settingsPath = path.join(APP_DATA_DIR, 'settings.json');
    if (!fs.existsSync(settingsPath)) {
      return {};
    }
    const raw = fs.readFileSync(settingsPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return {};
    }
    return mergeAppearanceAliases(mergePanelManagerAliases(mergeUserDataPathAliases(normalizeSettingsForStorage(parsed))));
  } catch {
    return {};
  }
}

function normalizeTextValue(value) {
  return String(value || '').trim();
}

function resolveDefaultDeviceOsName() {
  if (process.platform === 'darwin') {
    return 'macOS';
  }
  if (process.platform === 'win32') {
    return 'Windows';
  }
  if (process.platform === 'linux') {
    return 'Linux';
  }
  return normalizeTextValue(os.type()) || process.platform;
}

function resolveCurrentDeviceUser() {
  try {
    const info = os.userInfo();
    return normalizeTextValue(info && (info.username || info.user));
  } catch {
    return '';
  }
}

function resolveCurrentUserRealName() {
  if (process.platform === 'darwin') {
    try {
      const idResult = spawnSync('/usr/bin/id', ['-F'], { encoding: 'utf8' });
      const fromId = normalizeTextValue(idResult && idResult.stdout);
      if (fromId) {
        return fromId;
      }
    } catch {
      // ignore and fallback
    }
    try {
      const user = resolveCurrentDeviceUser();
      if (user) {
        const dsclResult = spawnSync('/usr/bin/dscl', ['.', '-read', `/Users/${user}`, 'RealName'], { encoding: 'utf8' });
        const raw = normalizeTextValue(dsclResult && dsclResult.stdout);
        if (raw) {
          const lines = raw.split(/\r?\n/).map((line) => normalizeTextValue(line)).filter(Boolean);
          const realNameLine = lines.find((line) => line.toLowerCase().startsWith('realname:')) || '';
          const parsed = normalizeTextValue(realNameLine.replace(/^RealName:\s*/i, '')) || normalizeTextValue(lines[1]);
          if (parsed) {
            return parsed;
          }
        }
      }
    } catch {
      // ignore and fallback
    }
  }
  return resolveCurrentDeviceUser();
}

function resolveCurrentComputerName() {
  if (process.platform === 'darwin') {
    try {
      const result = spawnSync('/usr/sbin/scutil', ['--get', 'ComputerName'], { encoding: 'utf8' });
      const name = normalizeTextValue(result && result.stdout);
      if (name) {
        return name;
      }
    } catch {
      // ignore and fallback
    }
  }
  return normalizeTextValue(os.hostname());
}

function resolveCurrentMacProductVersion() {
  if (process.platform !== 'darwin') {
    return '';
  }
  try {
    const result = spawnSync('/usr/bin/sw_vers', ['-productVersion'], { encoding: 'utf8' });
    return normalizeTextValue(result && result.stdout);
  } catch {
    return '';
  }
}

function resolveCurrentMacBuildVersion() {
  if (process.platform !== 'darwin') {
    return '';
  }
  try {
    const result = spawnSync('/usr/bin/sw_vers', ['-buildVersion'], { encoding: 'utf8' });
    return normalizeTextValue(result && result.stdout);
  } catch {
    return '';
  }
}

function resolveDefaultDeviceVersion() {
  if (process.platform === 'darwin') {
    return resolveCurrentMacProductVersion();
  }
  const release = normalizeTextValue(os.release());
  return release;
}

function resolveCurrentDeviceBuild() {
  if (process.platform === 'darwin') {
    return resolveCurrentMacBuildVersion();
  }
  return '';
}

function resolveCurrentDeviceSnapshot(source = 'electron') {
  return {
    user: resolveCurrentDeviceUser(),
    userRealName: resolveCurrentUserRealName(),
    computerName: resolveCurrentComputerName(),
    os: resolveDefaultDeviceOsName(),
    version: resolveDefaultDeviceVersion(),
    build: resolveCurrentDeviceBuild(),
    source: normalizeTextValue(source) || 'electron',
    updatedAt: new Date().toISOString(),
  };
}

function mapOrderedFields(source = {}, orderedKeys = []) {
  const mapped = {};
  orderedKeys.forEach((key) => {
    if (!Object.prototype.hasOwnProperty.call(source, key)) {
      return;
    }
    const value = source[key];
    if (value === undefined) {
      return;
    }
    if (typeof value === 'string') {
      const text = normalizeTextValue(value);
      if (!text) {
        return;
      }
      mapped[key] = text;
      return;
    }
    if (value !== null) {
      mapped[key] = value;
    }
  });
  Object.keys(source).forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(mapped, key)) {
      return;
    }
    const value = source[key];
    if (value === undefined) {
      return;
    }
    mapped[key] = value;
  });
  return mapped;
}

function buildDefaultDirectorySettings() {
  const configDir = path.join(APP_DATA_DIR, 'config');
  return {
    configDir,
    coreDir: path.join(APP_DATA_DIR, 'core'),
    dataDir: path.join(APP_DATA_DIR, 'data'),
    logDir: path.join(APP_DATA_DIR, 'logs'),
    pidDir: path.join(APP_DATA_DIR, 'runtime'),
    configFile: path.join(configDir, 'default.yaml'),
  };
}

function mergeUserDataPathAliases(settings = {}) {
  const source = settings && typeof settings === 'object' ? settings : {};
  const paths = source.userDataPaths && typeof source.userDataPaths === 'object'
    ? source.userDataPaths
    : {};
  return {
    ...source,
    configFile: normalizeTextValue(paths.configFile) || normalizeTextValue(source.configFile),
    configDir: normalizeTextValue(paths.configDir) || normalizeTextValue(source.configDir),
    coreDir: normalizeTextValue(paths.coreDir) || normalizeTextValue(source.coreDir),
    dataDir: normalizeTextValue(paths.dataDir) || normalizeTextValue(source.dataDir),
    logDir: normalizeTextValue(paths.logDir) || normalizeTextValue(source.logDir),
    pidDir: normalizeTextValue(paths.pidDir) || normalizeTextValue(source.pidDir),
  };
}

function normalizeAuthenticationValue(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeTextValue(item))
      .filter(Boolean);
  }
  const single = normalizeTextValue(value);
  return single ? [single] : [];
}

function mergePanelManagerAliases(settings = {}) {
  const source = settings && typeof settings === 'object' ? settings : {};
  const panel = source.panelManager && typeof source.panelManager === 'object'
    ? source.panelManager
    : {};
  return {
    ...source,
    externalController: normalizeTextValue(panel.externalController) || normalizeTextValue(source.externalController),
    secret: normalizeTextValue(panel.secret) || normalizeTextValue(source.secret),
    panelChoice: normalizeTextValue(panel.panelChoice) || normalizeTextValue(source.panelChoice),
    externalUi: normalizeTextValue(panel.externalUi) || normalizeTextValue(source.externalUi),
    authentication: normalizeAuthenticationValue(
      Array.isArray(panel.authentication) && panel.authentication.length
        ? panel.authentication
        : source.authentication,
    ),
  };
}

function mergeAppearanceAliases(settings = {}) {
  const source = settings && typeof settings === 'object' ? settings : {};
  const appearance = source.appearance && typeof source.appearance === 'object'
    ? source.appearance
    : {};
  const trayMenu = source.trayMenu && typeof source.trayMenu === 'object'
    ? source.trayMenu
    : {};
  const readString = (key, fallback = '') => normalizeTextValue(appearance[key]) || normalizeTextValue(source[key]) || fallback;
  const readBoolean = (key, fallback = false) => {
    if (Object.prototype.hasOwnProperty.call(appearance, key)) {
      return Boolean(appearance[key]);
    }
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      return Boolean(source[key]);
    }
    return fallback;
  };
  const readNumber = (key, fallback = 0) => {
    const sourceValue = Object.prototype.hasOwnProperty.call(source, key) ? source[key] : undefined;
    const appearanceValue = Object.prototype.hasOwnProperty.call(appearance, key) ? appearance[key] : undefined;
    const candidate = appearanceValue !== undefined ? appearanceValue : sourceValue;
    const parsed = Number.parseInt(String(candidate ?? ''), 10);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const readTrayBoolean = (key, fallback = false) => {
    if (Object.prototype.hasOwnProperty.call(trayMenu, key)) {
      return Boolean(trayMenu[key]);
    }
    if (Object.prototype.hasOwnProperty.call(appearance, key)) {
      return Boolean(appearance[key]);
    }
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      return Boolean(source[key]);
    }
    return fallback;
  };
  return {
    ...source,
    lang: readString('lang', 'auto'),
    theme: readString('theme', 'auto'),
    debugMode: readBoolean('debugMode', false),
    acceptBeta: readBoolean('acceptBeta', false),
    githubUser: readString('githubUser', 'vernesong'),
    chartEnabled: readTrayBoolean('chartEnabled', readTrayBoolean('trayMenuChartEnabled', true)),
    providerTrafficEnabled: readTrayBoolean('providerTrafficEnabled', readTrayBoolean('trayMenuProviderTrafficEnabled', true)),
    trackersEnabled: readTrayBoolean('trackersEnabled', readTrayBoolean('trayMenuTrackersEnabled', true)),
    foxboardEnabled: readTrayBoolean('foxboardEnabled', readTrayBoolean('trayMenuFoxboardEnabled', true)),
    kernelManagerEnabled: readTrayBoolean('kernelManagerEnabled', readTrayBoolean('trayMenuKernelManagerEnabled', true)),
    directoryLocationsEnabled: readTrayBoolean('directoryLocationsEnabled', readTrayBoolean('trayMenuDirectoryLocationsEnabled', true)),
    copyShellExportCommandEnabled: readTrayBoolean('copyShellExportCommandEnabled', readTrayBoolean('trayMenuCopyShellExportCommandEnabled', true)),
    windowWidth: readNumber('windowWidth', DEFAULT_MAIN_WINDOW_WIDTH),
    windowHeight: readNumber('windowHeight', DEFAULT_MAIN_WINDOW_HEIGHT),
    mainWindowClosed: readBoolean('mainWindowClosed', false),
    generalPageSize: readString('generalPageSize', '10'),
    logLines: readNumber('logLines', 10),
    logAutoRefresh: readBoolean('logAutoRefresh', false),
    logIntervalPreset: readString('logIntervalPreset', '3'),
  };
}

function normalizeKernelSettings(value = {}) {
  const kernel = value && typeof value === 'object' ? value : {};
  const ordered = mapOrderedFields(kernel, [
    'raw',
    'core',
    'type',
    'version',
    'platform',
    'arch',
    'language',
    'languageVersion',
    'buildTime',
    'source',
    'updatedAt',
  ]);
  if (!Object.keys(ordered).length) {
    return {};
  }
  return ordered;
}

function normalizeDeviceSettings(value = {}, overviewValue = {}) {
  const device = value && typeof value === 'object' ? value : {};
  const snapshot = resolveCurrentDeviceSnapshot(normalizeTextValue(device.source) || 'electron');
  const user = normalizeTextValue(device.user) || snapshot.user;
  const userRealName = normalizeTextValue(device.userRealName) || snapshot.userRealName;
  const computerName = normalizeTextValue(device.computerName) || normalizeTextValue(device.displayName) || snapshot.computerName;
  const osName = normalizeTextValue(device.os) || snapshot.os;
  const version = normalizeTextValue(device.version) || snapshot.version;
  const build = normalizeTextValue(device.build) || snapshot.build;
  const normalized = {
    user,
    userRealName,
    computerName,
    os: osName,
    version,
    build,
    source: normalizeTextValue(device.source) || snapshot.source,
    updatedAt: normalizeTextValue(device.updatedAt) || snapshot.updatedAt,
  };
  const ordered = mapOrderedFields(normalized, [
    'user',
    'userRealName',
    'computerName',
    'os',
    'version',
    'build',
    'source',
    'updatedAt',
  ]);
  if (!Object.keys(ordered).length) {
    return {};
  }
  return ordered;
}

function normalizeSettingsForStorage(input = {}) {
  const parsed = mergeAppearanceAliases(mergePanelManagerAliases(mergeUserDataPathAliases(input)));
  const defaultDirs = buildDefaultDirectorySettings();
  const normalizePort = (value, fallback) => {
    const parsedPort = Number.parseInt(String(value ?? ''), 10);
    if (!Number.isFinite(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
      return fallback;
    }
    return parsedPort;
  };
  const normalizeBool = (value, fallback = false) => {
    if (value === undefined || value === null || value === '') {
      return fallback;
    }
    if (typeof value === 'boolean') {
      return value;
    }
    const text = String(value).trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(text)) {
      return true;
    }
    if (['false', '0', 'no', 'off'].includes(text)) {
      return false;
    }
    return fallback;
  };

  const configPathFromLegacy = typeof parsed.configPath === 'string' ? normalizeTextValue(parsed.configPath) : '';
  const configuredConfigDir = normalizeTextValue(parsed.configDir) || defaultDirs.configDir;
  const configuredCoreDir = normalizeTextValue(parsed.coreDir) || defaultDirs.coreDir;
  const configuredDataDir = normalizeTextValue(parsed.dataDir) || defaultDirs.dataDir;
  const configuredLogDir = normalizeTextValue(parsed.logDir) || defaultDirs.logDir;
  const configuredPidDir = normalizeTextValue(parsed.pidDir) || defaultDirs.pidDir;
  const configuredConfigFile = normalizeTextValue(parsed.configFile) || configPathFromLegacy;
  parsed.userDataPaths = {
    configFile: configuredConfigFile || path.join(configuredConfigDir, 'default.yaml'),
    configDir: configuredConfigDir,
    coreDir: configuredCoreDir,
    dataDir: configuredDataDir,
    logDir: configuredLogDir,
    pidDir: configuredPidDir,
  };
  delete parsed.configFile;
  delete parsed.configDir;
  delete parsed.coreDir;
  delete parsed.dataDir;
  delete parsed.logDir;
  delete parsed.pidDir;
  delete parsed.configPath;

  const panelManager = parsed.panelManager && typeof parsed.panelManager === 'object'
    ? parsed.panelManager
    : {};
  const authList = normalizeAuthenticationValue(
    Array.isArray(parsed.authentication) && parsed.authentication.length
      ? parsed.authentication
      : panelManager.authentication,
  );
  parsed.panelManager = {
    externalController: normalizeTextValue(parsed.externalController)
      || normalizeTextValue(panelManager.externalController)
      || '127.0.0.1:9090',
    secret: normalizeTextValue(parsed.secret)
      || normalizeTextValue(panelManager.secret)
      || 'clashfox',
    panelChoice: normalizeTextValue(parsed.panelChoice)
      || normalizeTextValue(panelManager.panelChoice)
      || 'zashboard',
    externalUi: normalizeTextValue(parsed.externalUi)
      || normalizeTextValue(panelManager.externalUi)
      || 'ui',
    authentication: authList.length ? authList : ['mihomo:clashfox'],
  };
  delete parsed.externalController;
  delete parsed.secret;
  delete parsed.panelChoice;
  delete parsed.externalUi;
  delete parsed.authentication;

  const generalPageSize = String(parsed.generalPageSize || parsed.backupsPageSize || parsed.kernelPageSize || '10').trim() || '10';
  delete parsed.backupsPageSize;
  delete parsed.kernelPageSize;
  delete parsed.switchPageSize;
  delete parsed.configPageSize;
  delete parsed.recommendPageSize;
  const trayMenuConfig = parsed.trayMenu && typeof parsed.trayMenu === 'object'
    ? parsed.trayMenu
    : {};

  parsed.appearance = {
    lang: normalizeTextValue(parsed.lang) || 'auto',
    theme: normalizeTextValue(parsed.theme) || 'auto',
    debugMode: Boolean(parsed.debugMode),
    acceptBeta: Boolean(parsed.acceptBeta),
    githubUser: normalizeTextValue(parsed.githubUser) || 'vernesong',
    windowWidth: Number.parseInt(String(parsed.windowWidth ?? ''), 10) || DEFAULT_MAIN_WINDOW_WIDTH,
    windowHeight: Number.parseInt(String(parsed.windowHeight ?? ''), 10) || DEFAULT_MAIN_WINDOW_HEIGHT,
    mainWindowClosed: Boolean(parsed.mainWindowClosed),
    generalPageSize,
    logLines: Number.parseInt(String(parsed.logLines ?? ''), 10) || 10,
    logAutoRefresh: Boolean(parsed.logAutoRefresh),
    logIntervalPreset: normalizeTextValue(parsed.logIntervalPreset) || '3',
  };
  parsed.trayMenu = {
    chartEnabled: normalizeBool(
      Object.prototype.hasOwnProperty.call(parsed, 'chartEnabled')
        ? parsed.chartEnabled
        : (Object.prototype.hasOwnProperty.call(parsed, 'trayMenuChartEnabled')
          ? parsed.trayMenuChartEnabled
          : trayMenuConfig.chartEnabled ?? trayMenuConfig.trayMenuChartEnabled),
      true,
    ),
    providerTrafficEnabled: normalizeBool(
      Object.prototype.hasOwnProperty.call(parsed, 'providerTrafficEnabled')
        ? parsed.providerTrafficEnabled
        : (Object.prototype.hasOwnProperty.call(parsed, 'trayMenuProviderTrafficEnabled')
          ? parsed.trayMenuProviderTrafficEnabled
          : trayMenuConfig.providerTrafficEnabled ?? trayMenuConfig.trayMenuProviderTrafficEnabled),
      true,
    ),
    trackersEnabled: normalizeBool(
      Object.prototype.hasOwnProperty.call(parsed, 'trackersEnabled')
        ? parsed.trackersEnabled
        : (Object.prototype.hasOwnProperty.call(parsed, 'trayMenuTrackersEnabled')
          ? parsed.trayMenuTrackersEnabled
          : trayMenuConfig.trackersEnabled ?? trayMenuConfig.trayMenuTrackersEnabled),
      true,
    ),
    foxboardEnabled: normalizeBool(
      Object.prototype.hasOwnProperty.call(parsed, 'foxboardEnabled')
        ? parsed.foxboardEnabled
        : (Object.prototype.hasOwnProperty.call(parsed, 'trayMenuFoxboardEnabled')
          ? parsed.trayMenuFoxboardEnabled
          : trayMenuConfig.foxboardEnabled ?? trayMenuConfig.trayMenuFoxboardEnabled),
      true,
    ),
    kernelManagerEnabled: normalizeBool(
      Object.prototype.hasOwnProperty.call(parsed, 'kernelManagerEnabled')
        ? parsed.kernelManagerEnabled
        : (Object.prototype.hasOwnProperty.call(parsed, 'trayMenuKernelManagerEnabled')
          ? parsed.trayMenuKernelManagerEnabled
          : trayMenuConfig.kernelManagerEnabled ?? trayMenuConfig.trayMenuKernelManagerEnabled),
      true,
    ),
    directoryLocationsEnabled: normalizeBool(
      Object.prototype.hasOwnProperty.call(parsed, 'directoryLocationsEnabled')
        ? parsed.directoryLocationsEnabled
        : (Object.prototype.hasOwnProperty.call(parsed, 'trayMenuDirectoryLocationsEnabled')
          ? parsed.trayMenuDirectoryLocationsEnabled
          : trayMenuConfig.directoryLocationsEnabled ?? trayMenuConfig.trayMenuDirectoryLocationsEnabled),
      true,
    ),
    copyShellExportCommandEnabled: normalizeBool(
      Object.prototype.hasOwnProperty.call(parsed, 'copyShellExportCommandEnabled')
        ? parsed.copyShellExportCommandEnabled
        : (Object.prototype.hasOwnProperty.call(parsed, 'trayMenuCopyShellExportCommandEnabled')
          ? parsed.trayMenuCopyShellExportCommandEnabled
          : trayMenuConfig.copyShellExportCommandEnabled ?? trayMenuConfig.trayMenuCopyShellExportCommandEnabled),
      true,
    ),
  };
  delete parsed.lang;
  delete parsed.theme;
  delete parsed.debugMode;
  delete parsed.acceptBeta;
  delete parsed.githubUser;
  delete parsed.chartEnabled;
  delete parsed.providerTrafficEnabled;
  delete parsed.trackersEnabled;
  delete parsed.foxboardEnabled;
  delete parsed.kernelManagerEnabled;
  delete parsed.directoryLocationsEnabled;
  delete parsed.trayMenuChartEnabled;
  delete parsed.trayMenuProviderTrafficEnabled;
  delete parsed.trayMenuTrackersEnabled;
  delete parsed.trayMenuFoxboardEnabled;
  delete parsed.trayMenuKernelManagerEnabled;
  delete parsed.trayMenuDirectoryLocationsEnabled;
  delete parsed.windowWidth;
  delete parsed.windowHeight;
  delete parsed.mainWindowClosed;
  delete parsed.generalPageSize;
  delete parsed.logLines;
  delete parsed.logAutoRefresh;
  delete parsed.logIntervalPreset;
  delete parsed.overviewTopOrder;

  parsed.proxy = normalizeTextValue(parsed.proxy) || 'rule';
  parsed.systemProxy = normalizeBool(parsed.systemProxy, false);
  parsed.tun = normalizeBool(parsed.tun, false);
  parsed.stack = normalizeTextValue(parsed.stack) || 'Mixed';
  parsed.mixedPort = normalizePort(parsed.mixedPort, 7893);
  parsed.port = normalizePort(parsed.port, 7890);
  parsed.socksPort = normalizePort(parsed.socksPort, 7891);
  parsed.allowLan = normalizeBool(parsed.allowLan, true);
  delete parsed.captureMixedPort;
  delete parsed.captureHttpPort;
  delete parsed.captureSocksPort;
  delete parsed.captureTunMode;
  delete parsed.captureAllowLan;

  const legacyKernelVersion = normalizeKernelVersionValue(parsed.kernelVersion);
  const kernelCandidate = normalizeKernelVersionValue(
    (parsed.kernel && typeof parsed.kernel === 'object' && (parsed.kernel.raw || parsed.kernel.version))
    || legacyKernelVersion,
  );
  if (kernelCandidate) {
    const parsedKernel = parseKernelVersionDetails(kernelCandidate) || {};
    const mergedKernel = {
      ...(parsed.kernel && typeof parsed.kernel === 'object' ? parsed.kernel : {}),
      ...parsedKernel,
    };
    if (!normalizeTextValue(mergedKernel.raw)) {
      mergedKernel.raw = kernelCandidate;
    }
    parsed.kernel = normalizeKernelSettings(mergedKernel);
  } else {
    parsed.kernel = normalizeKernelSettings(parsed.kernel);
  }
  delete parsed.kernelVersion;
  delete parsed.kernelVersionMeta;

  parsed.device = normalizeDeviceSettings(parsed.device, {});
  delete parsed.overview;

  const ordered = {};
  const priority = [
    'proxy',
    'systemProxy',
    'tun',
    'stack',
    'mixedPort',
    'port',
    'socksPort',
    'allowLan',
    'appearance',
    'trayMenu',
    'userDataPaths',
    'panelManager',
    'kernel',
    'device',
    'helperStatus',
    'mihomoStatus',
    'overviewOrder',
  ];
  priority.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(parsed, key)) {
      ordered[key] = parsed[key];
    }
  });
  Object.keys(parsed).forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(ordered, key)) {
      return;
    }
    ordered[key] = parsed[key];
  });
  return ordered;
}

function resolveCheckUpdateUrlFromSettings() {
  const settings = readAppSettings();
  return settings && settings.acceptBeta ? CHECK_UPDATE_BETA_URL : CHECK_UPDATE_STABLE_URL;
}

function resolveConfigDirectoryFromSettings() {
  const settings = readAppSettings();
  const configured = settings && typeof settings.configDir === 'string'
    ? settings.configDir.trim()
    : '';
  if (configured) {
    return path.resolve(configured);
  }
  return path.join(APP_DATA_DIR, 'config');
}

function resolveCoreDirectoryFromSettings() {
  const settings = readAppSettings();
  const configured = settings && typeof settings.coreDir === 'string'
    ? settings.coreDir.trim()
    : '';
  if (configured) {
    return path.resolve(configured);
  }
  return path.join(APP_DATA_DIR, 'core');
}

function formatFileModifiedTime(value) {
  const date = value instanceof Date ? value : new Date(value);
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

function listConfigFilesFromFs() {
  try {
    const configDir = resolveConfigDirectoryFromSettings();
    fs.mkdirSync(configDir, { recursive: true });
    const items = fs.readdirSync(configDir, { withFileTypes: true })
      .filter((entry) => entry && entry.isFile())
      .filter((entry) => /\.(ya?ml|json)$/i.test(String(entry.name || '')))
      .map((entry) => {
        const filePath = path.join(configDir, entry.name);
        const stat = fs.statSync(filePath);
        return {
          name: entry.name,
          path: filePath,
          modified: formatFileModifiedTime(stat.mtime),
          modifiedAt: stat.mtimeMs || stat.mtime.getTime() || 0,
        };
      })
      .sort((a, b) => {
        const delta = Number(b.modifiedAt || 0) - Number(a.modifiedAt || 0);
        if (delta !== 0) {
          return delta;
        }
        return String(a.name || '').localeCompare(String(b.name || ''));
      })
      .map(({ modifiedAt, ...rest }) => rest);
    guiMainLog('config', 'listConfigFilesFromFs success', {
      configDir,
      count: items.length,
    });
    return { ok: true, data: items };
  } catch (error) {
    guiMainLog('config', 'listConfigFilesFromFs failed', {
      message: String(error && error.message ? error.message : error || ''),
    }, 'error');
    return {
      ok: false,
      error: 'configs_read_failed',
      details: String(error && error.message ? error.message : error || ''),
    };
  }
}

function listKernelFilesFromFs() {
  try {
    const coreDir = resolveCoreDirectoryFromSettings();
    fs.mkdirSync(coreDir, { recursive: true });
    const items = fs.readdirSync(coreDir, { withFileTypes: true })
      .filter((entry) => entry && (entry.isFile() || entry.isSymbolicLink()))
      .filter((entry) => {
        const name = String(entry.name || '');
        return name === 'mihomo'
          || name.startsWith('mihomo-darwin-')
          || name.startsWith('mihomo.backup.');
      })
      .map((entry) => {
        const filePath = path.join(coreDir, entry.name);
        const stat = fs.statSync(filePath);
        return {
          name: entry.name,
          path: filePath,
          modified: formatFileModifiedTime(stat.mtime),
          modifiedAt: stat.mtimeMs || stat.mtime.getTime() || 0,
        };
      })
      .sort((a, b) => {
        const delta = Number(b.modifiedAt || 0) - Number(a.modifiedAt || 0);
        if (delta !== 0) {
          return delta;
        }
        return String(a.name || '').localeCompare(String(b.name || ''));
      })
      .map(({ modifiedAt, ...rest }) => rest);
    guiMainLog('kernel', 'listKernelFilesFromFs success', {
      coreDir,
      count: items.length,
    });
    return { ok: true, data: items };
  } catch (error) {
    guiMainLog('kernel', 'listKernelFilesFromFs failed', {
      message: String(error && error.message ? error.message : error || ''),
    }, 'error');
    return {
      ok: false,
      error: 'kernels_read_failed',
      details: String(error && error.message ? error.message : error || ''),
    };
  }
}

function buildUniqueFilePath(targetDir, fileName) {
  const ext = path.extname(fileName || '');
  const base = path.basename(fileName || '', ext) || 'imported-config';
  let candidate = path.join(targetDir, `${base}${ext}`);
  let idx = 1;
  while (fs.existsSync(candidate)) {
    candidate = path.join(targetDir, `${base}-${idx}${ext}`);
    idx += 1;
  }
  return candidate;
}

function normalizeVersionTag(version) {
  return String(version || '').trim().replace(/^v/i, '');
}

function parseVersion(version) {
  const normalized = normalizeVersionTag(version);
  const match = normalized.match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/);
  if (!match) {
    return null;
  }
  const [, major, minor, patch, prereleaseRaw] = match;
  const prerelease = prereleaseRaw
    ? prereleaseRaw.split('.').map((token) => {
      if (/^\d+$/.test(token)) {
        return Number.parseInt(token, 10);
      }
      return token.toLowerCase();
    })
    : [];
  return {
    major: Number.parseInt(major, 10),
    minor: Number.parseInt(minor, 10),
    patch: Number.parseInt(patch, 10),
    prerelease,
    raw: normalized,
  };
}

function comparePrerelease(left = [], right = []) {
  if (!left.length && !right.length) {
    return 0;
  }
  if (!left.length) {
    return 1;
  }
  if (!right.length) {
    return -1;
  }
  const maxLen = Math.max(left.length, right.length);
  for (let i = 0; i < maxLen; i += 1) {
    const a = left[i];
    const b = right[i];
    if (a === undefined) return -1;
    if (b === undefined) return 1;
    if (a === b) continue;
    const aNum = typeof a === 'number';
    const bNum = typeof b === 'number';
    if (aNum && bNum) {
      return a > b ? 1 : -1;
    }
    if (aNum) return -1;
    if (bNum) return 1;
    return String(a).localeCompare(String(b));
  }
  return 0;
}

function compareVersions(left, right) {
  const a = parseVersion(left);
  const b = parseVersion(right);
  if (!a || !b) {
    return String(normalizeVersionTag(left)).localeCompare(String(normalizeVersionTag(right)));
  }
  if (a.major !== b.major) return a.major > b.major ? 1 : -1;
  if (a.minor !== b.minor) return a.minor > b.minor ? 1 : -1;
  if (a.patch !== b.patch) return a.patch > b.patch ? 1 : -1;
  return comparePrerelease(a.prerelease, b.prerelease);
}

function fetchJson(url, timeoutMs = 6000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': `ClashFox/${app.getVersion() || '0.0.0'}`,
        Accept: 'application/vnd.github+json',
      },
    }, (res) => {
      const statusCode = Number(res.statusCode || 0);
      if (statusCode >= 300 && statusCode < 400 && res.headers.location) {
        res.resume();
        fetchJson(res.headers.location, timeoutMs).then(resolve).catch(reject);
        return;
      }
      if (statusCode < 200 || statusCode >= 300) {
        res.resume();
        reject(new Error(`HTTP_${statusCode}`));
        return;
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch {
          reject(new Error('INVALID_JSON'));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error('TIMEOUT'));
    });
  });
}

function fetchText(url, timeoutMs = 6000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': `ClashFox/${app.getVersion() || '0.0.0'}`,
        Accept: 'text/plain,*/*',
      },
    }, (res) => {
      const statusCode = Number(res.statusCode || 0);
      if (statusCode >= 300 && statusCode < 400 && res.headers.location) {
        res.resume();
        fetchText(res.headers.location, timeoutMs).then(resolve).catch(reject);
        return;
      }
      if (statusCode < 200 || statusCode >= 300) {
        res.resume();
        reject(new Error(`HTTP_${statusCode}`));
        return;
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        resolve(String(body || ''));
      });
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error('TIMEOUT'));
    });
  });
}

function fetchTextViaCurl(url, timeoutMs = 9000) {
  return new Promise((resolve, reject) => {
    const maxTimeSec = Math.max(3, Math.ceil(Number(timeoutMs || 9000) / 1000));
    const args = [
      '--silent',
      '--show-error',
      '--location',
      '--max-time',
      String(maxTimeSec),
      '-H',
      'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      '-H',
      'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      String(url || ''),
    ];
    execFile('/usr/bin/curl', args, { timeout: timeoutMs + 1000 }, (error, stdout = '', stderr = '') => {
      if (error) {
        reject(new Error(String(stderr || error.message || 'curl_fetch_failed').trim() || 'curl_fetch_failed'));
        return;
      }
      const text = String(stdout || '');
      if (!text.trim()) {
        reject(new Error('curl_empty_response'));
        return;
      }
      resolve(text);
    });
  });
}

function fetchLatestReleaseTagViaCurlHead(url, timeoutMs = 7000) {
  return new Promise((resolve, reject) => {
    const maxTimeSec = Math.max(3, Math.ceil(Number(timeoutMs || 7000) / 1000));
    const args = [
      '--silent',
      '--show-error',
      '--head',
      '--max-time',
      String(maxTimeSec),
      '-H',
      'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      String(url || ''),
    ];
    execFile('/usr/bin/curl', args, { timeout: timeoutMs + 1000 }, (error, stdout = '', stderr = '') => {
      if (error) {
        reject(new Error(String(stderr || error.message || 'curl_head_failed').trim() || 'curl_head_failed'));
        return;
      }
      const text = String(stdout || '');
      const locationMatch = text.match(/^\s*location:\s*(.+)$/im);
      if (!locationMatch || !locationMatch[1]) {
        reject(new Error('head_location_missing'));
        return;
      }
      const location = String(locationMatch[1]).trim();
      const tagMatch = location.match(/\/releases\/tag\/([^/?#\s]+)/i);
      if (!tagMatch || !tagMatch[1]) {
        reject(new Error('head_tag_missing'));
        return;
      }
      resolve(tagMatch[1]);
    });
  });
}

function downloadFile(url, targetPath, timeoutMs = 20000, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 6) {
      reject(new Error('TOO_MANY_REDIRECTS'));
      return;
    }
    const req = https.get(url, {
      headers: {
        'User-Agent': `ClashFox/${app.getVersion() || '0.0.0'}`,
        Accept: '*/*',
      },
    }, (res) => {
      const statusCode = Number(res.statusCode || 0);
      if (statusCode >= 300 && statusCode < 400 && res.headers.location) {
        res.resume();
        downloadFile(res.headers.location, targetPath, timeoutMs, redirectCount + 1).then(resolve).catch(reject);
        return;
      }
      if (statusCode < 200 || statusCode >= 300) {
        res.resume();
        reject(new Error(`HTTP_${statusCode}`));
        return;
      }
      const file = fs.createWriteStream(targetPath);
      file.on('error', (err) => {
        try {
          file.close();
        } catch {
          // ignore
        }
        reject(err);
      });
      res.on('error', (err) => {
        try {
          file.close();
        } catch {
          // ignore
        }
        reject(err);
      });
      file.on('finish', () => {
        file.close((err) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(targetPath);
        });
      });
      res.pipe(file);
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error('TIMEOUT'));
    });
  });
}

function extractSemverFromText(raw = '') {
  const source = String(raw || '').trim();
  if (!source) {
    return '';
  }
  const fullMatch = source.match(/v?\d+\.\d+\.\d+(?:-[0-9A-Za-z]+(?:\.[0-9A-Za-z]+)*)?/);
  if (!fullMatch || !fullMatch[0]) {
    return '';
  }
  const candidate = normalizeVersionTag(fullMatch[0]);
  const baseMatch = candidate.match(/^\d+\.\d+\.\d+/);
  const base = baseMatch ? baseMatch[0] : '';
  if (!base) {
    return candidate;
  }
  const suffix = candidate.startsWith(`${base}-`) ? candidate.slice(base.length + 1) : '';
  if (!suffix) {
    return base;
  }
  if (/(darwin|linux|windows|macos|mac|arm64|aarch64|amd64|x64|x86|universal|tar|zip|gz|pkg|dmg)/i.test(suffix)) {
    return base;
  }
  return candidate;
}

function scoreHelperAsset(asset = {}, arch = process.arch) {
  const name = String(asset && asset.name ? asset.name : '').trim();
  if (!name) {
    return -1;
  }
  const lower = name.toLowerCase();
  if (!lower.includes('helper')) {
    return -1;
  }
  const extOk = lower.endsWith('.tar.gz')
    || lower.endsWith('.tgz')
    || lower.endsWith('.zip')
    || lower.endsWith('.gz')
    || lower === 'com.clashfox.helper'
    || lower.endsWith('/com.clashfox.helper');
  if (!extOk) {
    return -1;
  }
  let score = 0;
  if (lower.includes('darwin') || lower.includes('macos') || lower.includes('mac')) {
    score += 30;
  }
  if (arch === 'arm64') {
    if (lower.includes('arm64') || lower.includes('aarch64')) {
      score += 25;
    } else if (lower.includes('universal')) {
      score += 20;
    } else if (lower.includes('amd64') || lower.includes('x64')) {
      score -= 20;
    }
  } else if (arch === 'x64') {
    if (lower.includes('x64') || lower.includes('amd64')) {
      score += 25;
    } else if (lower.includes('universal')) {
      score += 20;
    } else if (lower.includes('arm64') || lower.includes('aarch64')) {
      score -= 20;
    }
  }
  if (lower.endsWith('.tar.gz') || lower.endsWith('.tgz')) {
    score += 8;
  } else if (lower.endsWith('.zip')) {
    score += 6;
  } else if (lower === 'com.clashfox.helper') {
    score += 4;
  }
  return score;
}

function pickHelperAssetFromRelease(release = {}, arch = process.arch) {
  const assets = Array.isArray(release && release.assets) ? release.assets : [];
  let best = null;
  let bestScore = -1;
  for (const asset of assets) {
    const score = scoreHelperAsset(asset, arch);
    if (score > bestScore) {
      bestScore = score;
      best = asset;
    }
  }
  if (!best || bestScore < 0) {
    return null;
  }
  return best;
}

async function fetchLatestHelperReleaseFallback() {
  let html = '';
  let fetchError = '';
  try {
    const headTag = await fetchLatestReleaseTagViaCurlHead(HELPER_RELEASE_LATEST_URL, 7000);
    const headVersion = extractSemverFromText(headTag);
    if (headVersion) {
      const normalizedTag = String(headTag || `v${headVersion}`).replace(/^\/+/, '');
      const releaseUrl = `https://github.com/lukuochiang/ClashFox-Helper/releases/tag/${normalizedTag}`;
      return {
        ok: true,
        version: headVersion,
        releaseTag: normalizedTag,
        releaseName: normalizedTag || `v${headVersion}`,
        releaseUrl,
        prerelease: false,
        assetName: '',
        assetUrl: '',
        source: 'latest_head_fallback',
      };
    }
  } catch {
    // continue with HTML-based parsing fallback
  }
  try {
    html = await fetchText(HELPER_RELEASE_LATEST_URL, 9000);
  } catch (error) {
    fetchError = String((error && error.message) || 'latest_fetch_failed');
    try {
      html = await fetchTextViaCurl(HELPER_RELEASE_LATEST_URL, 10000);
    } catch (curlError) {
      const curlDetail = String((curlError && curlError.message) || 'curl_fetch_failed');
      return { ok: false, error: `${fetchError}|${curlDetail}` };
    }
  }
  try {
    const patterns = [
      /releases\/tag\/([^"'#<\s]+)/i,
      /"tag_name"\s*:\s*"([^"]+)"/i,
      /<title>\s*Release\s+([^<]+?)\s*[·-]/i,
    ];
    let tag = '';
    for (const pattern of patterns) {
      const match = String(html || '').match(pattern);
      if (match && match[1]) {
        tag = String(match[1]).trim();
        break;
      }
    }
    const version = extractSemverFromText(tag || html);
    if (!version) {
      return { ok: false, error: 'FALLBACK_NO_VERSION' };
    }
    const normalizedTag = String(tag || `v${version}`).replace(/^\/+/, '');
    const releaseUrl = normalizedTag
      ? `https://github.com/lukuochiang/ClashFox-Helper/releases/tag/${normalizedTag}`
      : HELPER_RELEASE_LATEST_URL;
    const assetHrefRegex = /href="([^"]*\/releases\/download\/[^"]+)"/ig;
    let matchedAssetUrl = '';
    let matchedAssetName = '';
    let bestScore = -1;
    let match = assetHrefRegex.exec(String(html || ''));
    while (match) {
      const rawHref = String(match[1] || '').trim();
      const decodedHref = rawHref.replace(/&amp;/g, '&');
      const fullUrl = decodedHref.startsWith('http')
        ? decodedHref
        : `https://github.com${decodedHref.startsWith('/') ? decodedHref : `/${decodedHref}`}`;
      const name = path.basename(fullUrl.split('?')[0] || '').trim();
      const score = scoreHelperAsset({ name }, process.arch);
      if (score > bestScore) {
        bestScore = score;
        matchedAssetUrl = fullUrl;
        matchedAssetName = name;
      }
      match = assetHrefRegex.exec(String(html || ''));
    }
    return {
      ok: true,
      version,
      releaseTag: normalizedTag,
      releaseName: normalizedTag || `v${version}`,
      releaseUrl,
      prerelease: false,
      assetName: matchedAssetName,
      assetUrl: matchedAssetUrl,
      source: 'latest_page_fallback',
    };
  } catch (error) {
    return { ok: false, error: String((error && error.message) || 'FALLBACK_FAILED') };
  }
}

function buildHelperAssetFallbackUrls({ releaseTag = '', version = '' } = {}) {
  const tag = String(releaseTag || '').trim().replace(/^\/+/, '') || (version ? `v${version}` : '');
  const ver = String(version || '').trim();
  if (!tag && !ver) {
    return [];
  }
  const arch = process.arch === 'arm64' ? 'arm64' : 'amd64';
  const names = [
    `clashfox-helper-v${ver}-darwin-universal.tar.gz`,
    `clashfox-helper-v${ver}-darwin-${arch}.tar.gz`,
    `clashfox-helper-${ver}-darwin-universal.tar.gz`,
    `clashfox-helper-${ver}-darwin-${arch}.tar.gz`,
    'com.clashfox.helper',
  ].filter((item) => item && !item.includes('vv'));
  const unique = new Set();
  const urls = [];
  for (const name of names) {
    const url = `https://github.com/lukuochiang/ClashFox-Helper/releases/download/${tag}/${name}`;
    if (!unique.has(url)) {
      unique.add(url);
      urls.push(url);
    }
  }
  return urls;
}

async function getLatestHelperReleaseInfo({ acceptBeta = false, force = false } = {}) {
  const now = Date.now();
  if (!force && helperUpdateCache.result && helperUpdateCache.acceptBeta === Boolean(acceptBeta) && (now - helperUpdateCache.checkedAt) < HELPER_UPDATE_CACHE_TTL_MS) {
    return helperUpdateCache.result;
  }
  const latestPageInfo = await fetchLatestHelperReleaseFallback();
  if (latestPageInfo && latestPageInfo.ok) {
    const result = { ...latestPageInfo };
    result.assetFallbackUrls = buildHelperAssetFallbackUrls({
      releaseTag: result.releaseTag,
      version: result.version,
    });
    helperUpdateCache = { checkedAt: now, acceptBeta: Boolean(acceptBeta), result };
    return result;
  }
  const result = {
    ok: false,
    error: latestPageInfo && latestPageInfo.error
      ? String(latestPageInfo.error)
      : 'CHECK_HELPER_UPDATE_FAILED',
  };
  helperUpdateCache = { checkedAt: now, acceptBeta: Boolean(acceptBeta), result };
  return result;
}

function findHelperBinaryInDirectory(searchDir = '') {
  const root = String(searchDir || '').trim();
  if (!root || !fs.existsSync(root)) {
    return '';
  }
  const queue = [root];
  while (queue.length) {
    const current = queue.shift();
    let entries = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(fullPath);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }
      if (entry.name === 'com.clashfox.helper') {
        return fullPath;
      }
    }
  }
  return '';
}

function resolveExtractedHelperRoot(binaryPath = '', extractTempDir = '') {
  const binary = String(binaryPath || '').trim();
  const root = String(extractTempDir || '').trim();
  if (!binary || !root) {
    return '';
  }
  const resolvedRoot = path.resolve(root);
  const resolvedBinary = path.resolve(binary);
  if (!resolvedBinary.startsWith(`${resolvedRoot}${path.sep}`) && resolvedBinary !== resolvedRoot) {
    return '';
  }
  let candidate = path.dirname(resolvedBinary);
  const maxSteps = 6;
  for (let i = 0; i < maxSteps; i += 1) {
    const helperBin = path.join(candidate, 'com.clashfox.helper');
    const installScript = path.join(candidate, 'install-helper.sh');
    if (fs.existsSync(helperBin) || fs.existsSync(installScript)) {
      return candidate;
    }
    const parent = path.dirname(candidate);
    if (!parent || parent === candidate || !parent.startsWith(resolvedRoot)) {
      break;
    }
    candidate = parent;
  }
  return path.dirname(resolvedBinary);
}

function syncExtractedHelperPackageFiles(binaryPath = '', extractTempDir = '', bundleHelperDir = '') {
  const sourceRoot = resolveExtractedHelperRoot(binaryPath, extractTempDir);
  const targetRoot = String(bundleHelperDir || '').trim();
  if (!sourceRoot || !targetRoot || !fs.existsSync(sourceRoot)) {
    return { ok: false, copied: [], sourceRoot, targetRoot };
  }
  const fileNames = [
    'com.clashfox.helper',
    'com.clashfox.helper.plist',
    'install-helper.sh',
    'uninstall-helper.sh',
    'doctor-helper.sh',
    'check-helper.sh',
    'VERSION',
    'manifest.json',
    'checksums.txt',
    'CHANGELOG.md',
    'README.md',
    'LICENSE',
  ];
  const copied = [];
  const failed = [];
  try {
    fs.mkdirSync(targetRoot, { recursive: true });
    for (const name of fileNames) {
      const src = path.join(sourceRoot, name);
      if (!fs.existsSync(src)) {
        continue;
      }
      const stat = fs.statSync(src);
      if (!stat.isFile()) {
        continue;
      }
      const dst = path.join(targetRoot, name);
      try {
        fs.copyFileSync(src, dst);
        if (name.endsWith('.sh') || name === 'com.clashfox.helper') {
          fs.chmodSync(dst, 0o755);
        }
        copied.push(name);
      } catch (error) {
        failed.push({ name, error: String((error && error.message) || error || 'copy_failed') });
      }
    }
    return { ok: failed.length === 0, copied, failed, sourceRoot, targetRoot };
  } catch (error) {
    return {
      ok: false,
      copied,
      failed: failed.concat([{ name: '*', error: String((error && error.message) || error || 'sync_failed') }]),
      sourceRoot,
      targetRoot,
    };
  }
}

function resolveHelperWorkspaceDir() {
  const helperDir = HELPER_APP_BUNDLE_DIR;
  try {
    fs.mkdirSync(helperDir, { recursive: true });
  } catch {
    // Keep returning the required path and let callers surface permission errors.
  }
  return helperDir;
}

function installHelperBinaryWithSystemAuth(binaryPath = '', version = '') {
  const targetBinary = String(binaryPath || '').trim();
  if (!targetBinary || !fs.existsSync(targetBinary)) {
    return Promise.resolve({ ok: false, error: 'helper_binary_missing', path: targetBinary });
  }
  return new Promise((resolve) => {
    const scriptPath = resolveHelperInstallScriptPath();
    if (!fs.existsSync(scriptPath)) {
      resolve({ ok: false, error: 'install_script_missing', path: scriptPath });
      return;
    }
    const quote = (value) => `'${String(value || '').replace(/'/g, `'\\''`)}'`;
    const commandParts = [
      '/bin/bash',
      quote(scriptPath),
      quote(targetBinary),
      quote(String(version || '').trim()),
      quote(HELPER_APP_BUNDLE_DIR),
    ];
    const command = commandParts.join(' ');
    const script = [
      'try',
      `set out to do shell script ${JSON.stringify(command)} with administrator privileges`,
      'return out',
      'on error errMsg number errNum',
      `return "${SYSTEM_AUTH_ERROR_PREFIX}:" & (errNum as text) & ":" & errMsg`,
      'end try',
    ].join('\n');
    execFile('osascript', ['-e', script], { timeout: 180 * 1000 }, (error, stdout) => {
      if (error) {
        resolve({
          ok: false,
          error: 'system_auth_failed',
          details: error.message || String(error),
          path: scriptPath,
        });
        return;
      }
      const output = String(stdout || '').trim();
      if (output.startsWith(`${SYSTEM_AUTH_ERROR_PREFIX}:`)) {
        const payload = output.slice(SYSTEM_AUTH_ERROR_PREFIX.length + 1);
        const firstColonIndex = payload.indexOf(':');
        const errNumRaw = firstColonIndex >= 0 ? payload.slice(0, firstColonIndex) : payload;
        const errMsg = firstColonIndex >= 0 ? payload.slice(firstColonIndex + 1).trim() : '';
        const errNum = Number.parseInt(String(errNumRaw || '').trim(), 10);
        if (errNum === -128) {
          resolve({ ok: false, error: 'sudo_required', path: scriptPath });
          return;
        }
        resolve({
          ok: false,
          error: 'system_auth_failed',
          details: errMsg || 'system_authorization_failed',
          path: scriptPath,
        });
        return;
      }
      resolve({ ok: true, output, path: scriptPath });
    });
  });
}

async function installLatestHelperFromOnline() {
  const settings = readAppSettings();
  const acceptBeta = Boolean(settings && settings.acceptBeta);
  const latest = await getLatestHelperReleaseInfo({ acceptBeta, force: true });
  if (!latest || !latest.ok) {
    return { ok: false, error: (latest && latest.error) || 'helper_update_unavailable' };
  }
  const bundleHelperDir = resolveHelperWorkspaceDir();
  const packageDir = path.join(bundleHelperDir, 'package');
  let archivePath = '';
  let extractTempDir = '';
  try {
    fs.mkdirSync(packageDir, { recursive: true });
    let resolvedAssetUrl = String(latest.assetUrl || '').trim();
    let resolvedAssetName = String(latest.assetName || '').trim();
    const candidateAssetUrls = [];
    if (resolvedAssetUrl) {
      candidateAssetUrls.push(resolvedAssetUrl);
    }
    const fallbackUrls = Array.isArray(latest.assetFallbackUrls) ? latest.assetFallbackUrls : [];
    for (const candidate of fallbackUrls) {
      const normalized = String(candidate || '').trim();
      if (normalized && !candidateAssetUrls.includes(normalized)) {
        candidateAssetUrls.push(normalized);
      }
    }
    if (candidateAssetUrls.length === 0) {
      return { ok: false, error: 'helper_asset_not_found' };
    }
    let downloadError = '';
    let downloaded = false;
    for (const candidateUrl of candidateAssetUrls) {
      const candidateName = path.basename(String(candidateUrl).split('?')[0] || '').trim();
      if (!candidateName) {
        continue;
      }
      const candidatePath = path.join(packageDir, candidateName);
      if (fs.existsSync(candidatePath)) {
        try {
          const stat = fs.statSync(candidatePath);
          if (stat && stat.isFile() && stat.size > 0) {
            resolvedAssetUrl = candidateUrl;
            resolvedAssetName = candidateName;
            archivePath = candidatePath;
            downloaded = true;
            break;
          }
        } catch {
          // ignore broken local asset and continue to download
        }
      }
      try {
        await downloadFile(candidateUrl, candidatePath, 25000);
        resolvedAssetUrl = candidateUrl;
        resolvedAssetName = candidateName;
        archivePath = candidatePath;
        downloaded = true;
        break;
      } catch (error) {
        downloadError = String((error && error.message) || error || 'download_failed');
      }
    }
    if (!downloaded) {
      return { ok: false, error: downloadError || 'helper_download_failed' };
    }
    extractTempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clashfox-helper-extract-'));
    let binaryPath = '';
    const lowerName = String(resolvedAssetName || path.basename(archivePath)).toLowerCase();
    if (lowerName.endsWith('.tar.gz') || lowerName.endsWith('.tgz')) {
      const tarResult = spawnSync('/usr/bin/tar', ['-xzf', archivePath, '-C', extractTempDir], { encoding: 'utf8' });
      if (tarResult.error || tarResult.status !== 0) {
        return { ok: false, error: 'helper_extract_failed', details: String((tarResult && tarResult.stderr) || '').trim() };
      }
      binaryPath = findHelperBinaryInDirectory(extractTempDir);
    } else if (lowerName.endsWith('.gz')) {
      const decompressedPath = path.join(extractTempDir, path.basename(archivePath, '.gz'));
      const gunzipResult = spawnSync('/usr/bin/gunzip', ['-c', archivePath], { encoding: null });
      if (gunzipResult.error || gunzipResult.status !== 0 || !gunzipResult.stdout) {
        return { ok: false, error: 'helper_extract_failed', details: String((gunzipResult && gunzipResult.stderr) || '').trim() };
      }
      fs.writeFileSync(decompressedPath, gunzipResult.stdout);
      try {
        fs.chmodSync(decompressedPath, 0o755);
      } catch {
        // ignore chmod errors; installer will validate binary later
      }
      binaryPath = fs.existsSync(decompressedPath) ? decompressedPath : '';
    } else if (lowerName.endsWith('.zip')) {
      const unzipResult = spawnSync('/usr/bin/ditto', ['-x', '-k', archivePath, extractTempDir], { encoding: 'utf8' });
      if (unzipResult.error || unzipResult.status !== 0) {
        return { ok: false, error: 'helper_extract_failed', details: String((unzipResult && unzipResult.stderr) || '').trim() };
      }
      binaryPath = findHelperBinaryInDirectory(extractTempDir);
    } else {
      binaryPath = archivePath;
    }
    if (!binaryPath || !fs.existsSync(binaryPath)) {
      return { ok: false, error: 'helper_binary_missing' };
    }
    const syncResult = syncExtractedHelperPackageFiles(binaryPath, extractTempDir, bundleHelperDir);
    const installResult = await installHelperBinaryWithSystemAuth(binaryPath, latest.version || '');
    if (!installResult || !installResult.ok) {
      return {
        ...(installResult || { ok: false, error: 'helper_install_failed' }),
        diagnostics: {
          archivePath,
          extractedBinaryPath: binaryPath,
          packageDir,
          bundleHelperDir,
          extractTempDir,
          helperSync: syncResult,
          expectedBackupPath: path.join(bundleHelperDir, 'install-backup', 'com.clashfox.helper'),
        },
      };
    }
    helperUpdateCache.checkedAt = 0;
    helperUpdateCache.result = null;
    return {
      ok: true,
      version: latest.version || '',
      releaseUrl: latest.releaseUrl || '',
      assetName: latest.assetName || '',
      assetUrl: resolvedAssetUrl,
      output: installResult.output || '',
      diagnostics: {
        archivePath,
        extractedBinaryPath: binaryPath,
        packageDir,
        bundleHelperDir,
        extractTempDir,
        helperSync: syncResult,
        expectedBackupPath: path.join(bundleHelperDir, 'install-backup', 'com.clashfox.helper'),
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: String((err && err.message) || 'helper_update_failed'),
      diagnostics: {
        archivePath,
        packageDir,
        bundleHelperDir,
        extractTempDir,
        expectedBackupPath: path.join(bundleHelperDir, 'install-backup', 'com.clashfox.helper'),
      },
    };
  } finally {
    if (extractTempDir) {
      try {
        fs.rmSync(extractTempDir, { recursive: true, force: true });
      } catch {
        // ignore temp cleanup errors
      }
    }
  }
}

async function checkHelperUpdates({ force = true } = {}) {
  const settings = readAppSettings();
  const acceptBeta = Boolean(settings && settings.acceptBeta);
  const latest = await getLatestHelperReleaseInfo({ acceptBeta, force: Boolean(force) });
  if (!latest || !latest.ok) {
    return {
      ok: false,
      status: 'error',
      error: (latest && latest.error) || 'helper_update_unavailable',
    };
  }
  const installedVersion = readInstalledHelperVersion();
  const bundledVersion = readBundledHelperVersion();
  const onlineVersion = String(latest.version || '').trim();
  let targetVersion = onlineVersion || bundledVersion || '';
  if (onlineVersion && bundledVersion) {
    targetVersion = compareVersions(onlineVersion, bundledVersion) >= 0 ? onlineVersion : bundledVersion;
  }
  const updateAvailable = Boolean(
    installedVersion
    && targetVersion
    && compareVersions(targetVersion, installedVersion) > 0
  );
  return {
    ok: true,
    status: updateAvailable ? 'update_available' : 'up_to_date',
    installedVersion,
    onlineVersion,
    bundledVersion,
    targetVersion,
    updateAvailable,
    updateSource: targetVersion === bundledVersion ? 'bundled' : 'online',
    releaseUrl: String(latest.releaseUrl || '').trim(),
    assetName: String(latest.assetName || '').trim(),
  };
}

function pickLatestRelease(releases = [], acceptBeta = false) {
  if (!Array.isArray(releases)) {
    return null;
  }
  for (const release of releases) {
    if (!release || release.draft) {
      continue;
    }
    if (!acceptBeta && release.prerelease) {
      continue;
    }
    return release;
  }
  return null;
}

function pickLatestKernelRelease(releases = [], acceptBeta = false) {
  if (!Array.isArray(releases)) {
    return null;
  }
  const betaLikePattern = /(alpha|beta|rc|pre(?:release)?|preview|nightly|canary|dev|smart)/i;
  const isBetaLikeRelease = (release) => {
    if (!release || release.draft) {
      return false;
    }
    if (release.prerelease) {
      return true;
    }
    const tagOrName = String(release.tag_name || release.name || '').trim();
    return betaLikePattern.test(tagOrName);
  };
  let fallback = null;
  for (const release of releases) {
    if (!release || release.draft) {
      continue;
    }
    if (!acceptBeta && release.prerelease) {
      continue;
    }
    if (acceptBeta && !isBetaLikeRelease(release)) {
      if (!fallback) {
        fallback = release;
      }
      continue;
    }
    if (!fallback) {
      fallback = release;
    }
    const latestTag = String(release.tag_name || release.name || '').trim();
    const latest = extractKernelSemver(latestTag);
    if (latest) {
      return release;
    }
  }
  return fallback;
}

function extractKernelSemver(raw = '') {
  const source = String(raw || '').trim();
  if (!source) {
    return '';
  }
  const match = source.match(/v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?/);
  return match ? normalizeVersionTag(match[0]) : '';
}

function isStableKernelVersion(raw = '') {
  const normalizedRaw = String(raw || '').toLowerCase();
  const prereleaseMarkerPattern = /(^|[^a-z0-9])(alpha-smart|alpha|beta|rc|pre(?:release)?|preview|nightly|canary|dev|smart)([^a-z0-9]|$)/i;
  if (prereleaseMarkerPattern.test(normalizedRaw)) {
    return false;
  }
  const semver = extractKernelSemver(raw);
  if (!semver) {
    return false;
  }
  const parsed = parseVersion(semver);
  return Boolean(parsed && (!Array.isArray(parsed.prerelease) || parsed.prerelease.length === 0));
}

async function checkKernelUpdates({ source = 'vernesong', currentVersion = '', acceptBeta } = {}) {
  const sourceKey = Object.prototype.hasOwnProperty.call(KERNEL_RELEASE_API, source) ? source : 'vernesong';
  const currentRaw = String(currentVersion || '').trim();
  const current = extractKernelSemver(currentRaw);
  // Kernel update channel policy:
  // - vernesong always checks prerelease channel.
  // - MetaCubeX checks stable channel only when current kernel is a clear stable semver.
  //   All other/unknown tags (e.g. alpha-smart-xxxx) use prerelease channel.
  // Explicit acceptBeta (if provided) takes precedence.
  const currentIsStable = isStableKernelVersion(currentRaw);
  const allowBeta = typeof acceptBeta === 'boolean'
    ? acceptBeta
    : (sourceKey === 'vernesong' ? true : !currentIsStable);
  try {
    if (allowBeta && KERNEL_BETA_VERSION_TXT_URL[sourceKey]) {
      try {
        const text = await fetchText(KERNEL_BETA_VERSION_TXT_URL[sourceKey]);
        const latestRaw = String(text || '').split(/\r?\n/).map((line) => line.trim()).find(Boolean) || '';
        if (latestRaw) {
          const latestSemver = extractKernelSemver(latestRaw);
          let status = 'unknown_current';
          if (latestSemver && current) {
            status = compareVersions(latestSemver, current) > 0 ? 'update_available' : 'up_to_date';
          } else if (currentRaw) {
            const normalizedCurrent = currentRaw.toLowerCase();
            const normalizedLatest = latestRaw.toLowerCase();
            status = (
              normalizedCurrent === normalizedLatest
              || normalizedCurrent.includes(normalizedLatest)
              || normalizedLatest.includes(normalizedCurrent)
            ) ? 'up_to_date' : 'update_available';
          }
          return {
            ok: true,
            status,
            source: sourceKey,
            currentVersion: current || currentRaw,
            latestVersion: latestSemver || normalizeVersionTag(latestRaw) || latestRaw,
            releaseUrl: KERNEL_BETA_VERSION_TXT_URL[sourceKey],
            prerelease: true,
          };
        }
      } catch {
        // Fallback to GitHub API list below if version.txt is temporarily unavailable.
      }
    }
    const releases = await fetchJson(KERNEL_RELEASE_API[sourceKey]);
    const latestRelease = pickLatestKernelRelease(releases, allowBeta);
    if (!latestRelease || !latestRelease.tag_name) {
      return {
        ok: false,
        status: 'error',
        source: sourceKey,
        currentVersion: current,
        error: 'NO_RELEASE_FOUND',
      };
    }
    const latestTag = String(latestRelease.tag_name || latestRelease.name || '').trim();
    const latest = extractKernelSemver(latestTag);
    if (!latest) {
      return {
        ok: true,
        status: 'unknown_latest',
        source: sourceKey,
        currentVersion: current,
        latestVersion: normalizeVersionTag(latestTag),
        releaseUrl: latestRelease.html_url || '',
        prerelease: Boolean(latestRelease.prerelease),
      };
    }
    if (!current) {
      return {
        ok: true,
        status: 'unknown_current',
        source: sourceKey,
        currentVersion: '',
        latestVersion: latest,
        releaseUrl: latestRelease.html_url || '',
        prerelease: Boolean(latestRelease.prerelease),
      };
    }
    const compare = compareVersions(latest, current);
    return {
      ok: true,
      status: compare > 0 ? 'update_available' : 'up_to_date',
      source: sourceKey,
      currentVersion: current,
      latestVersion: latest,
      releaseUrl: latestRelease.html_url || '',
      prerelease: Boolean(latestRelease.prerelease),
    };
  } catch (err) {
    return {
      ok: false,
      status: 'error',
      source: sourceKey,
      currentVersion: current,
      error: err && err.message ? err.message : 'CHECK_KERNEL_UPDATE_FAILED',
    };
  }
}

async function checkForUpdates({ manual = false, acceptBeta } = {}) {
  const settings = readAppSettings();
  const allowBeta = typeof acceptBeta === 'boolean'
    ? acceptBeta
    : Boolean(settings && settings.acceptBeta);
  const currentVersion = normalizeVersionTag(app.getVersion());
  try {
    const releases = await fetchJson(CHECK_UPDATE_API_URL);
    const latest = pickLatestRelease(releases, allowBeta);
    if (!latest || !latest.tag_name) {
      return {
        ok: false,
        status: 'error',
        manual,
        acceptBeta: allowBeta,
        currentVersion,
        error: 'NO_RELEASE_FOUND',
      };
    }
    const latestVersion = normalizeVersionTag(latest.tag_name);
    const compare = compareVersions(latestVersion, currentVersion);
    return {
      ok: true,
      status: compare > 0 ? 'update_available' : 'up_to_date',
      manual,
      acceptBeta: allowBeta,
      currentVersion,
      latestVersion,
      releaseUrl: latest.html_url || resolveCheckUpdateUrlFromSettings(),
      releaseName: latest.name || latest.tag_name,
      publishedAt: latest.published_at || '',
      prerelease: Boolean(latest.prerelease),
    };
  } catch (err) {
    return {
      ok: false,
      status: 'error',
      manual,
      acceptBeta: allowBeta,
      currentVersion,
      error: err && err.message ? err.message : 'CHECK_UPDATE_FAILED',
    };
  }
}

function writeAppSettings(settings = {}) {
  ensureAppDirs();
  const settingsPath = path.join(APP_DATA_DIR, 'settings.json');
  const normalized = normalizeSettingsForStorage(settings);
  fs.writeFileSync(settingsPath, `${JSON.stringify(normalized, null, 2)}\n`);
}

function sanitizeMainWindowDimension(value, fallback, min, max) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, parsed));
}

function resolveMainWindowSizeFromSettings() {
  const settings = readAppSettings();
  const width = sanitizeMainWindowDimension(
    settings.windowWidth,
    DEFAULT_MAIN_WINDOW_WIDTH,
    MIN_MAIN_WINDOW_WIDTH,
    MAX_MAIN_WINDOW_WIDTH,
  );
  const height = sanitizeMainWindowDimension(
    settings.windowHeight,
    DEFAULT_MAIN_WINDOW_HEIGHT,
    MIN_MAIN_WINDOW_HEIGHT,
    MAX_MAIN_WINDOW_HEIGHT,
  );
  return { width, height };
}

function resolveHelperInstallScriptPath() {
  const candidates = [
    path.join(HELPER_APP_BUNDLE_DIR, 'install-helper.sh'),
    path.join(process.resourcesPath || '', 'helper', 'install-helper.sh'),
    path.join(APP_PATH, 'static', 'helper', 'install-helper.sh'),
    path.join(APP_PATH, 'helper', 'install-helper.sh'),
  ];
  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return path.join(HELPER_APP_BUNDLE_DIR, 'install-helper.sh');
}

function resolveHelperUninstallScriptPath() {
  const candidates = [
    path.join(HELPER_APP_BUNDLE_DIR, 'uninstall-helper.sh'),
    path.join(process.resourcesPath || '', 'helper', 'uninstall-helper.sh'),
    path.join(APP_PATH, 'static', 'helper', 'uninstall-helper.sh'),
    path.join(APP_PATH, 'helper', 'uninstall-helper.sh'),
  ];
  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return path.join(HELPER_APP_BUNDLE_DIR, 'uninstall-helper.sh');
}

function resolveHelperDoctorScriptPath() {
  const candidates = [
    path.join(HELPER_APP_BUNDLE_DIR, 'doctor-helper.sh'),
    path.join(process.resourcesPath || '', 'helper', 'doctor-helper.sh'),
    path.join(APP_PATH, 'static', 'helper', 'doctor-helper.sh'),
    path.join(APP_PATH, 'helper', 'doctor-helper.sh'),
  ];
  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return path.join(HELPER_APP_BUNDLE_DIR, 'doctor-helper.sh');
}

function runHelperDoctor(options = {}) {
  return new Promise((resolve) => {
    const scriptPath = resolveHelperDoctorScriptPath();
    if (!fs.existsSync(scriptPath)) {
      resolve({ ok: false, error: 'doctor_script_missing', path: scriptPath });
      return;
    }
    const repair = Boolean(options && options.repair);
    const parseDoctorOutput = (text) => {
      try {
        return parseBridgeOutput(String(text || '').trim());
      } catch {
        return null;
      }
    };

    if (!repair) {
      execFile('/bin/bash', [scriptPath, '--json'], { timeout: 120 * 1000 }, (error, stdout, stderr) => {
        const parsed = parseDoctorOutput(stdout) || parseDoctorOutput(stderr);
        if (parsed) {
          resolve(parsed);
          return;
        }
        if (error) {
          resolve({
            ok: false,
            error: 'doctor_failed',
            details: error.message || String(error),
            path: scriptPath,
          });
          return;
        }
        resolve({ ok: false, error: 'doctor_output_empty', path: scriptPath });
      });
      return;
    }

    const quote = (value) => `'${String(value || '').replace(/'/g, `'\\''`)}'`;
    const command = `/bin/bash ${quote(scriptPath)} --json --repair`;
    const script = [
      'try',
      `set out to do shell script ${JSON.stringify(command)} with administrator privileges`,
      'return out',
      'on error errMsg number errNum',
      `return "${SYSTEM_AUTH_ERROR_PREFIX}:" & (errNum as text) & ":" & errMsg`,
      'end try',
    ].join('\n');
    execFile('osascript', ['-e', script], { timeout: 180 * 1000 }, (error, stdout) => {
      if (error) {
        resolve({
          ok: false,
          error: 'system_auth_failed',
          details: error.message || String(error),
          path: scriptPath,
        });
        return;
      }
      const output = String(stdout || '').trim();
      if (output.startsWith(`${SYSTEM_AUTH_ERROR_PREFIX}:`)) {
        const payload = output.slice(SYSTEM_AUTH_ERROR_PREFIX.length + 1);
        const firstColonIndex = payload.indexOf(':');
        const errNumRaw = firstColonIndex >= 0 ? payload.slice(0, firstColonIndex) : payload;
        const errMsg = firstColonIndex >= 0 ? payload.slice(firstColonIndex + 1).trim() : '';
        const errNum = Number.parseInt(String(errNumRaw || '').trim(), 10);
        if (errNum === -128) {
          resolve({ ok: false, error: 'sudo_required', path: scriptPath });
          return;
        }
        resolve({
          ok: false,
          error: 'system_auth_failed',
          details: errMsg || 'system_authorization_failed',
          path: scriptPath,
        });
        return;
      }
      const parsed = parseDoctorOutput(output);
      if (parsed) {
        resolve(parsed);
      } else {
        resolve({ ok: false, error: 'doctor_parse_failed', details: output, path: scriptPath });
      }
    });
  });
}

function getHelperPaths() {
  return {
    binary: '/Library/PrivilegedHelperTools/com.clashfox.helper',
    plist: '/Library/LaunchDaemons/com.clashfox.helper.plist',
    versionMeta: path.join(HELPER_USER_DIR, 'version.json'),
    versionMetaLegacy: `${HELPER_LEGACY_DIR}/version.json`,
    logs: [
      '/var/log/clashfox-helper.log',
      '/var/log/com.clashfox.helper.log',
    ],
  };
}

function normalizeHelperVersion(raw = '') {
  const text = String(raw || '').trim();
  if (!text) {
    return '';
  }
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed.version === 'string' && parsed.version.trim()) {
      return parsed.version.trim();
    }
  } catch {
    // ignore non-json format
  }
  const match = text.match(/"version"\s*:\s*"([^"]+)"/i);
  if (match && match[1]) {
    return String(match[1]).trim();
  }
  const semver = extractSemverFromText(text);
  if (semver) {
    return semver;
  }
  return '';
}

function readInstalledHelperVersion(paths = getHelperPaths()) {
  const metaPaths = [
    String((paths && paths.versionMeta) || '').trim(),
    String((paths && paths.versionMetaLegacy) || '').trim(),
  ].filter(Boolean);
  for (const metaPath of metaPaths) {
    if (!fs.existsSync(metaPath)) {
      continue;
    }
    try {
      const raw = fs.readFileSync(metaPath, 'utf8');
      const parsed = JSON.parse(raw);
      const version = parsed && typeof parsed.version === 'string' ? parsed.version.trim() : '';
      if (version) {
        return version;
      }
    } catch {
      // continue probing other candidates
    }
  }
  const binaryPath = String((paths && paths.binary) || '').trim();
  if (binaryPath && fs.existsSync(binaryPath)) {
    try {
      const result = spawnSync(binaryPath, ['--version'], { encoding: 'utf8', timeout: 1500 });
      const raw = String((result && result.stdout) || '').trim();
      const version = normalizeHelperVersion(raw);
      if (version) {
        return version;
      }
    } catch {
      // ignore
    }
  }
  return '';
}

function readBundledHelperVersion() {
  const candidates = [
    path.join(process.resourcesPath || '', 'helper', 'com.clashfox.helper'),
    path.join(APP_PATH, 'static', 'helper', 'com.clashfox.helper'),
    path.join(APP_PATH, 'helper', 'com.clashfox.helper'),
  ];
  for (const candidate of candidates) {
    if (!candidate || !fs.existsSync(candidate)) {
      continue;
    }
    try {
      const result = spawnSync(candidate, ['--version'], { encoding: 'utf8', timeout: 1500 });
      const raw = String((result && result.stdout) || '').trim();
      const version = normalizeHelperVersion(raw);
      if (version) {
        return version;
      }
    } catch {
      // continue probing other candidates
    }
  }
  return '';
}

function readProxyPortsFromConfigPath(configPath = '') {
  try {
    if (!configPath || !fs.existsSync(configPath)) {
      return { port: '', socksPort: '' };
    }
    const raw = String(fs.readFileSync(configPath, 'utf8') || '');
    const targetKeys = new Set(['mixed-port', 'port', 'http-port', 'socks-port']);
    const values = {};
    const lines = raw.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = String(line || '').trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }
      const separatorIndex = trimmed.indexOf(':');
      if (separatorIndex <= 0) {
        continue;
      }
      const key = trimmed.slice(0, separatorIndex).trim();
      if (!targetKeys.has(key)) {
        continue;
      }
      let value = trimmed.slice(separatorIndex + 1).trim();
      const commentIndex = value.indexOf('#');
      if (commentIndex >= 0) {
        value = value.slice(0, commentIndex).trim();
      }
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith('\'') && value.endsWith('\''))) {
        value = value.slice(1, -1).trim();
      }
      const numeric = value.match(/^([0-9]{1,5})$/);
      if (numeric && numeric[1]) {
        values[key] = numeric[1];
      }
    }
    const port = String(values['mixed-port'] || values.port || values['http-port'] || values['socks-port'] || '').trim();
    const socksPort = String(values['socks-port'] || values['mixed-port'] || values.port || values['http-port'] || '').trim();
    return { port, socksPort };
  } catch {
    return { port: '', socksPort: '' };
  }
}

function readArgValueFromArgv(name = '') {
  if (!name) {
    return '';
  }
  const argv = Array.isArray(process.argv) ? process.argv : [];
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] !== name) {
      continue;
    }
    const value = argv[index + 1];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
}

function resolveConfigPathFromSettingsOrArgs(settings = null) {
  const fromSettingsUserData = settings
    && settings.userDataPaths
    && typeof settings.userDataPaths.configFile === 'string'
    ? settings.userDataPaths.configFile.trim()
    : '';
  const fromSettingsLegacy = settings && typeof settings.configFile === 'string'
    ? settings.configFile.trim()
    : '';
  const fromArgs = readArgValueFromArgv('--config');
  return (fromSettingsUserData || fromSettingsLegacy || fromArgs || '').trim();
}

async function resolveActiveNetworkServiceName() {
  const defaultRoute = await resolveDefaultRouteSnapshot();
  if (defaultRoute.interfaceName) {
    const service = await resolveNetworkServiceNameForInterface(defaultRoute.interfaceName);
    if (service) {
      return service;
    }
  }
  const fallback = await listEnabledNetworkServices();
  return fallback[0] || '';
}

function execFileText(bin, args = [], timeout = 2500) {
  return new Promise((resolve) => {
    execFile(bin, args, { timeout }, (err, stdout) => {
      if (err) {
        resolve('');
        return;
      }
      resolve(String(stdout || '').trim());
    });
  });
}

async function resolveDefaultRouteSnapshot() {
  const output = await execFileText('/usr/sbin/route', ['-n', 'get', 'default'], 2500);
  if (!output) {
    return { interfaceName: '', gateway: '' };
  }
  let interfaceName = '';
  let gateway = '';
  output.split(/\r?\n/).forEach((line) => {
    const ifaceMatch = line.match(/^\s*interface:\s*(.+)\s*$/i);
    if (ifaceMatch && ifaceMatch[1]) {
      interfaceName = String(ifaceMatch[1]).trim();
    }
    const gatewayMatch = line.match(/^\s*gateway:\s*(.+)\s*$/i);
    if (gatewayMatch && gatewayMatch[1]) {
      gateway = String(gatewayMatch[1]).trim();
    }
  });
  return { interfaceName, gateway };
}

async function listEnabledNetworkServices() {
  const output = await execFileText('/usr/sbin/networksetup', ['-listallnetworkservices'], 2500);
  if (!output) {
    return [];
  }
  return output
    .split(/\r?\n/)
    .map((line, index) => {
      const text = String(line || '').trim();
      if (!text) {
        return '';
      }
      if (index === 0 && text.toLowerCase().includes('network services')) {
        return '';
      }
      if (text.startsWith('*')) {
        return '';
      }
      return text;
    })
    .filter(Boolean);
}

async function listOrderedNetworkServices() {
  const output = await execFileText('/usr/sbin/networksetup', ['-listnetworkserviceorder'], 2500);
  if (!output) {
    return [];
  }
  const services = [];
  const lines = output.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const current = String(lines[index] || '').trim();
    const next = String(lines[index + 1] || '').trim();
    const serviceMatch = current.match(/^\(\d+\)\s*(.+)$/);
    if (!serviceMatch || !serviceMatch[1]) {
      continue;
    }
    const detailMatch = next.match(/Hardware Port:\s*(.+?),\s*Device:\s*([^)]+)/i);
    services.push({
      service: String(serviceMatch[1]).trim(),
      hardwarePort: detailMatch && detailMatch[1] ? String(detailMatch[1]).trim() : '',
      device: detailMatch && detailMatch[2] ? String(detailMatch[2]).trim() : '',
    });
  }
  return services.filter((item) => item.service);
}

async function resolveNetworkServiceNameForInterface(interfaceName = '') {
  const iface = String(interfaceName || '').trim();
  if (!iface) {
    return '';
  }
  const services = await listOrderedNetworkServices();
  for (const item of services) {
    if (String(item.device || '').trim() === iface) {
      return String(item.service || '').trim();
    }
  }
  return '';
}

async function resolveNetworkServiceInfo(serviceName = '') {
  const service = String(serviceName || '').trim();
  if (!service) {
    return { ip: '', router: '' };
  }
  const output = await execFileText('/usr/sbin/networksetup', ['-getinfo', service], 2500);
  if (!output) {
    return { ip: '', router: '' };
  }
  let ip = '';
  let router = '';
  output.split(/\r?\n/).forEach((line) => {
    const ipMatch = line.match(/^\s*IP address:\s*(.+)\s*$/i);
    if (ipMatch && ipMatch[1] && !String(ipMatch[1]).includes('none')) {
      ip = String(ipMatch[1]).trim();
    }
    const routerMatch = line.match(/^\s*Router:\s*(.+)\s*$/i);
    if (routerMatch && routerMatch[1] && !String(routerMatch[1]).includes('none')) {
      router = String(routerMatch[1]).trim();
    }
  });
  return { ip, router };
}

async function resolveInterfaceIpv4ViaIpconfig(interfaceName = '') {
  const iface = String(interfaceName || '').trim();
  if (!iface) {
    return '';
  }
  const output = await execFileText('/usr/sbin/ipconfig', ['getifaddr', iface], 2000);
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(output) ? output : '';
}

async function resolvePreferredNetworkServiceSnapshot() {
  const defaultRoute = await resolveDefaultRouteSnapshot();
  const services = await listOrderedNetworkServices();
  const defaultInterface = String(defaultRoute.interfaceName || '').trim();
  for (const item of services) {
    const device = String(item.device || '').trim();
    const hardwarePort = String(item.hardwarePort || '').trim().toLowerCase();
    if (!device || device.startsWith('utun')) {
      continue;
    }
    if (!hardwarePort.includes('wi-fi') && !hardwarePort.includes('airport')) {
      continue;
    }
    const info = await resolveNetworkServiceInfo(item.service);
    const localIp = info.ip
      || await resolveInterfaceIpv4ViaIpconfig(device)
      || resolveInterfacePrimaryAddress(device);
    if (!localIp) {
      continue;
    }
    return {
      service: item.service,
      device,
      router: info.router || '',
      localIp,
    };
  }
  const preferred = services.find((item) => {
    const device = String(item.device || '').trim();
    return device && device === defaultInterface && !device.startsWith('utun');
  });
  if (preferred) {
    const info = await resolveNetworkServiceInfo(preferred.service);
    const localIp = info.ip
      || await resolveInterfaceIpv4ViaIpconfig(preferred.device)
      || resolveInterfacePrimaryAddress(preferred.device);
    return {
      service: preferred.service,
      device: preferred.device,
      router: info.router || defaultRoute.gateway || '',
      localIp,
    };
  }
  for (const item of services) {
    const device = String(item.device || '').trim();
    if (!device || device.startsWith('utun')) {
      continue;
    }
    const info = await resolveNetworkServiceInfo(item.service);
    const localIp = info.ip
      || await resolveInterfaceIpv4ViaIpconfig(device)
      || resolveInterfacePrimaryAddress(device);
    if (!localIp) {
      continue;
    }
    return {
      service: item.service,
      device,
      router: info.router || '',
      localIp,
    };
  }
  return {
    service: await resolveActiveNetworkServiceName(),
    device: defaultInterface,
    router: defaultRoute.gateway || '',
    localIp: await resolveInterfaceIpv4ViaIpconfig(defaultInterface) || resolveInterfacePrimaryAddress(defaultInterface),
  };
}

function resolveInterfacePrimaryAddress(interfaceName = '') {
  const iface = String(interfaceName || '').trim();
  if (!iface) {
    return '';
  }
  const interfaces = os.networkInterfaces();
  const items = Array.isArray(interfaces[iface]) ? interfaces[iface] : [];
  const ipv4 = items.find((item) => item && item.family === 'IPv4' && !item.internal && item.address);
  if (ipv4 && ipv4.address) {
    return String(ipv4.address).trim();
  }
  const ipv6 = items.find((item) => item && item.family === 'IPv6' && !item.internal && item.address);
  return ipv6 && ipv6.address ? String(ipv6.address).trim() : '';
}

async function measurePingLatency(host = '', timeoutMs = 1800) {
  const target = String(host || '').trim();
  if (!target) {
    return '';
  }
  const output = await execFileText('/sbin/ping', ['-n', '-c', '1', target], timeoutMs);
  const match = output.match(/time[=<]([0-9.]+)\s*ms/i);
  return match && match[1] ? String(match[1]).trim() : '';
}

async function measureDnsLatency(hostname = 'cloudflare.com') {
  const target = String(hostname || '').trim();
  if (!target) {
    return '';
  }
  const startedAt = Date.now();
  try {
    await dns.promises.resolve4(target);
    return String(Math.max(1, Date.now() - startedAt));
  } catch {
    return '';
  }
}

function extractIpFromPayload(raw = '') {
  const text = String(raw || '').trim();
  if (!text) {
    return '';
  }
  try {
    const parsed = JSON.parse(text);
    const directCandidates = [
      parsed && parsed.ip,
      parsed && parsed.address,
      parsed && parsed.query,
      parsed && parsed.data && parsed.data.ip,
      parsed && parsed.data && parsed.data.address,
      parsed && parsed.ipip && parsed.ipip.ip,
    ];
    for (const candidate of directCandidates) {
      const value = String(candidate || '').trim();
      if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(value)) {
        return value;
      }
    }
  } catch {}
  const match = text.match(/\b\d{1,3}(?:\.\d{1,3}){3}\b/);
  return match && match[0] ? String(match[0]).trim() : '';
}

async function fetchPublicIpViaCurl(url, { proxyPort = '', useProxy = false } = {}) {
  const requestUrl = String(url || '').trim();
  if (!requestUrl) {
    return '';
  }
  const args = ['-sS', '--max-time', '4', '--connect-timeout', '2', requestUrl];
  const normalizedProxyPort = String(proxyPort || '').trim();
  if (useProxy && normalizedProxyPort) {
    args.unshift('--proxy', `http://127.0.0.1:${normalizedProxyPort}`, '--noproxy', '');
  }
  const output = await execFileText('/usr/bin/curl', args, 4000);
  return extractIpFromPayload(output);
}

async function buildOverviewNetworkSnapshot() {
  const settings = readAppSettings();
  const [defaultRoute, preferredNetwork] = await Promise.all([
    resolveDefaultRouteSnapshot(),
    resolvePreferredNetworkServiceSnapshot(),
  ]);
  const networkName = String(preferredNetwork.service || '').trim();
  const localIp = String(preferredNetwork.localIp || '').trim();
  const routerTarget = String(preferredNetwork.router || defaultRoute.gateway || '').trim();
  const proxyPortCandidate = String(
    (settings && (settings.mixedPort ?? settings.port))
      ?? '',
  ).trim();
  const now = Date.now();
  const [routerMs, dnsMs, internetMs, internetIp, proxyIp] = await Promise.all([
    measurePingLatency(routerTarget),
    measureDnsLatency(),
    measurePingLatency('1.1.1.1'),
    fetchPublicIpViaCurl(`https://api.ipapi.is/?t=${now}`, { useProxy: false }),
    fetchPublicIpViaCurl(`https://api.ip.sb/ip?t=${now}`, { proxyPort: proxyPortCandidate, useProxy: true }),
  ]);
  return {
    ok: true,
    data: {
      networkName: networkName || preferredNetwork.device || defaultRoute.interfaceName || '-',
      localIp: localIp || '',
      proxyIp: proxyIp || '',
      internetIp: internetIp || '',
      internetIp4: internetIp || '',
      internetMs: internetMs || '',
      dnsMs: dnsMs || '',
      routerMs: routerMs || '',
    },
  };
}

async function resolveUsableNetworkServiceName(preferred = '') {
  const candidate = String(preferred || '').trim();
  const runCommand = (bin, args = []) => new Promise((resolve) => {
    execFile(bin, args, { timeout: 2500 }, (err, stdout) => {
      if (err) {
        resolve([]);
        return;
      }
      const lines = String(stdout || '')
        .split(/\r?\n/)
        .map((line) => String(line || '').trim())
        .filter((line, index) => {
          if (!line) {
            return false;
          }
          if (index === 0 && line.toLowerCase().includes('network services')) {
            return false;
          }
          if (line.startsWith('*')) {
            return false;
          }
          return true;
        });
      resolve(lines);
    });
  });
  const services = await runCommand('/usr/sbin/networksetup', ['-listallnetworkservices']);
  if (candidate && services.includes(candidate)) {
    return candidate;
  }
  return (await resolveActiveNetworkServiceName()) || '';
}

function isHelperLaunchdLoaded(label = 'com.clashfox.helper') {
  return new Promise((resolve) => {
    execFile('/bin/launchctl', ['print', `system/${label}`], { timeout: 4000 }, (error) => {
      resolve(!error);
    });
  });
}

async function getHelperStatus() {
  const paths = getHelperPaths();
  const doctor = await runHelperDoctor({ repair: false }).catch(() => null);
  const doctorData = doctor && doctor.data && typeof doctor.data === 'object' ? doctor.data : {};
  const binaryExists = Object.prototype.hasOwnProperty.call(doctorData, 'binaryExists')
    ? Boolean(doctorData.binaryExists)
    : fs.existsSync(paths.binary);
  const plistExists = Object.prototype.hasOwnProperty.call(doctorData, 'plistExists')
    ? Boolean(doctorData.plistExists)
    : fs.existsSync(paths.plist);
  const installed = binaryExists && plistExists;
  const ping = await pingHelper();
  const statusProbe = (!ping || !ping.ok) ? await runBridgeViaHelperApi(['status']) : null;
  const statusProbeOk = Boolean(statusProbe && statusProbe.ok);
  const launchdLoaded = Object.prototype.hasOwnProperty.call(doctorData, 'launchdLoaded')
    ? Boolean(doctorData.launchdLoaded)
    : await isHelperLaunchdLoaded();
  const socketExists = Object.prototype.hasOwnProperty.call(doctorData, 'socketExists')
    ? Boolean(doctorData.socketExists)
    : fs.existsSync(HELPER_SOCKET_PATH);
  const socketPingOk = Object.prototype.hasOwnProperty.call(doctorData, 'socketPingOk')
    ? Boolean(doctorData.socketPingOk)
    : Boolean(ping && ping.ok);
  const httpPingOk = Object.prototype.hasOwnProperty.call(doctorData, 'httpPingOk')
    ? Boolean(doctorData.httpPingOk)
    : statusProbeOk;
  const running = Boolean(socketPingOk || httpPingOk || (ping && ping.ok) || statusProbeOk);
  const helperVersion = readInstalledHelperVersion(paths)
    || normalizeHelperVersion(doctorData.helperVersion)
    || normalizeHelperVersion(ping && ping.data && ping.data.version)
    || normalizeHelperVersion(statusProbe && statusProbe.data && statusProbe.data.version)
    || '';
  const bundledTargetVersion = readBundledHelperVersion();
  const settings = readAppSettings();
  const acceptBeta = Boolean(settings && settings.acceptBeta);
  const onlineLatest = await getLatestHelperReleaseInfo({ acceptBeta, force: false }).catch(() => null);
  const onlineVersion = onlineLatest && onlineLatest.ok ? String(onlineLatest.version || '').trim() : '';
  let helperTargetVersion = onlineVersion || bundledTargetVersion;
  if (onlineVersion && bundledTargetVersion) {
    helperTargetVersion = compareVersions(onlineVersion, bundledTargetVersion) >= 0
      ? onlineVersion
      : bundledTargetVersion;
  }
  const helperUpdateAvailable = Boolean(
    helperVersion
    && helperTargetVersion
    && compareVersions(helperTargetVersion, helperVersion) > 0,
  );
  const helperUpdateSource = helperTargetVersion === bundledTargetVersion ? 'bundled' : 'online';
  let state = 'installed_unreachable';
  if (running) {
    state = 'running';
  } else if (!installed) {
    state = 'not_installed';
  } else if (!launchdLoaded) {
    state = 'stopped';
  }
  const logPath = paths.logs.find((p) => fs.existsSync(p)) || paths.logs[0];
  return {
    ok: true,
    data: {
      state,
      running,
      installed,
      binaryExists,
      plistExists,
      launchdLoaded,
      socketExists,
      socketPingOk,
      httpPingOk,
      helperVersion,
      helperBundledVersion: bundledTargetVersion,
      helperOnlineVersion: onlineVersion,
      helperTargetVersion,
      helperUpdateAvailable,
      helperUpdateSource,
      helperOnlineReleaseUrl: onlineLatest && onlineLatest.ok ? String(onlineLatest.releaseUrl || '').trim() : '',
      helperOnlineAssetName: onlineLatest && onlineLatest.ok ? String(onlineLatest.assetName || '').trim() : '',
      helperOnlineError: onlineLatest && !onlineLatest.ok ? String(onlineLatest.error || '') : '',
      logPath,
      ping: ping || { ok: false, error: 'helper_unreachable' },
      statusProbe: statusProbe || null,
      doctor: doctor || null,
    },
  };
}

function normalizeHelperStatusPayload(result) {
  const data = result && result.data ? result.data : {};
  const state = String(data.state || 'unknown');
  return {
    state,
    installed: Boolean(data.installed),
    running: Boolean(data.running),
    binaryExists: Boolean(data.binaryExists),
    plistExists: Boolean(data.plistExists),
    launchdLoaded: Boolean(data.launchdLoaded),
    socketExists: Boolean(data.socketExists),
    socketPingOk: Boolean(data.socketPingOk),
    httpPingOk: Boolean(data.httpPingOk),
    helperVersion: String(data.helperVersion || ''),
    helperBundledVersion: String(data.helperBundledVersion || ''),
    helperOnlineVersion: String(data.helperOnlineVersion || ''),
    helperTargetVersion: String(data.helperTargetVersion || ''),
    helperUpdateAvailable: Boolean(data.helperUpdateAvailable),
    helperUpdateSource: String(data.helperUpdateSource || ''),
    helperOnlineReleaseUrl: String(data.helperOnlineReleaseUrl || ''),
    helperOnlineAssetName: String(data.helperOnlineAssetName || ''),
    helperOnlineError: String(data.helperOnlineError || ''),
    logPath: String(data.logPath || '/var/log/clashfox-helper.log'),
    updatedAt: new Date().toISOString(),
  };
}

function persistHelperStatusToSettings(result) {
  try {
    const settings = readAppSettings();
    settings.helperStatus = normalizeHelperStatusPayload(result);
    writeAppSettings(settings);
    return settings.helperStatus;
  } catch {
    return null;
  }
}

async function syncHelperStatusToSettings() {
  try {
    const status = await getHelperStatus();
    persistHelperStatusToSettings(status);
    return status;
  } catch {
    return null;
  }
}

async function openHelperLogs() {
  const targetPath = '/var/log/clashfox-helper.log';
  if (!fs.existsSync(targetPath)) {
    return { ok: false, error: 'log_missing', path: targetPath };
  }

  const primary = await shell.openPath(targetPath);
  if (!primary) {
    return { ok: true, path: targetPath, method: 'shell.openPath' };
  }

  const tryOpen = (args = []) => new Promise((resolve) => {
    execFile('/usr/bin/open', args, { timeout: 8000 }, (err) => {
      resolve(!err);
    });
  });

  if (await tryOpen(['-b', 'com.apple.Console', targetPath])) {
    return { ok: true, path: targetPath, method: 'open-console' };
  }
  if (await tryOpen(['-a', '/System/Applications/Utilities/Console.app', targetPath])) {
    return { ok: true, path: targetPath, method: 'open-console-app' };
  }
  if (await tryOpen(['-a', '/Applications/Utilities/Console.app', targetPath])) {
    return { ok: true, path: targetPath, method: 'open-console-app-legacy' };
  }
  if (await tryOpen(['-t', targetPath])) {
    return { ok: true, path: targetPath, method: 'open-text' };
  }
  try {
    shell.showItemInFolder(targetPath);
    return { ok: true, path: targetPath, method: 'reveal' };
  } catch {
    return { ok: false, error: primary || 'open_failed', path: targetPath };
  }
}

function installHelperWithSystemAuth() {
  return new Promise((resolve) => {
    const scriptPath = resolveHelperInstallScriptPath();
    if (!fs.existsSync(scriptPath)) {
      resolve({ ok: false, error: 'install_script_missing', path: scriptPath });
      return;
    }
    const quote = (value) => `'${String(value || '').replace(/'/g, `'\\''`)}'`;
    const command = `/bin/bash ${quote(scriptPath)}`;
    const script = [
      'try',
      `set out to do shell script ${JSON.stringify(command)} with administrator privileges`,
      'return out',
      'on error errMsg number errNum',
      `return "${SYSTEM_AUTH_ERROR_PREFIX}:" & (errNum as text) & ":" & errMsg`,
      'end try',
    ].join('\n');
    execFile('osascript', ['-e', script], { timeout: 180 * 1000 }, (error, stdout) => {
      if (error) {
        resolve({
          ok: false,
          error: 'system_auth_failed',
          details: error.message || String(error),
          path: scriptPath,
        });
        return;
      }
      const output = String(stdout || '').trim();
      if (output.startsWith(`${SYSTEM_AUTH_ERROR_PREFIX}:`)) {
        const payload = output.slice(SYSTEM_AUTH_ERROR_PREFIX.length + 1);
        const firstColonIndex = payload.indexOf(':');
        const errNumRaw = firstColonIndex >= 0 ? payload.slice(0, firstColonIndex) : payload;
        const errMsg = firstColonIndex >= 0 ? payload.slice(firstColonIndex + 1).trim() : '';
        const errNum = Number.parseInt(String(errNumRaw || '').trim(), 10);
        if (errNum === -128) {
          resolve({ ok: false, error: 'sudo_required', path: scriptPath });
          return;
        }
        resolve({
          ok: false,
          error: 'system_auth_failed',
          details: errMsg || 'system_authorization_failed',
          path: scriptPath,
        });
        return;
      }
      resolve({ ok: true, output, path: scriptPath });
    });
  });
}

function uninstallHelperWithSystemAuth() {
  return new Promise((resolve) => {
    const scriptPath = resolveHelperUninstallScriptPath();
    if (!fs.existsSync(scriptPath)) {
      resolve({ ok: false, error: 'uninstall_script_missing', path: scriptPath });
      return;
    }
    const quote = (value) => `'${String(value || '').replace(/'/g, `'\\''`)}'`;
    const command = `/bin/bash ${quote(scriptPath)}`;
    const script = [
      'try',
      `set out to do shell script ${JSON.stringify(command)} with administrator privileges`,
      'return out',
      'on error errMsg number errNum',
      `return "${SYSTEM_AUTH_ERROR_PREFIX}:" & (errNum as text) & ":" & errMsg`,
      'end try',
    ].join('\n');
    execFile('osascript', ['-e', script], { timeout: 180 * 1000 }, (error, stdout) => {
      if (error) {
        resolve({
          ok: false,
          error: 'system_auth_failed',
          details: error.message || String(error),
          path: scriptPath,
        });
        return;
      }
      const output = String(stdout || '').trim();
      if (output.startsWith(`${SYSTEM_AUTH_ERROR_PREFIX}:`)) {
        const payload = output.slice(SYSTEM_AUTH_ERROR_PREFIX.length + 1);
        const firstColonIndex = payload.indexOf(':');
        const errNumRaw = firstColonIndex >= 0 ? payload.slice(0, firstColonIndex) : payload;
        const errMsg = firstColonIndex >= 0 ? payload.slice(firstColonIndex + 1).trim() : '';
        const errNum = Number.parseInt(String(errNumRaw || '').trim(), 10);
        if (errNum === -128) {
          resolve({ ok: false, error: 'sudo_required', path: scriptPath });
          return;
        }
        resolve({
          ok: false,
          error: 'system_auth_failed',
          details: errMsg || 'system_authorization_failed',
          path: scriptPath,
        });
        return;
      }
      resolve({ ok: true, output, path: scriptPath });
    });
  });
}

function runHelperInstallInTerminal() {
  return new Promise((resolve) => {
    const scriptPath = resolveHelperInstallScriptPath();
    if (!fs.existsSync(scriptPath)) {
      resolve({ ok: false, error: 'install_script_missing', path: scriptPath });
      return;
    }
    const quote = (value) => `'${String(value || '').replace(/'/g, `'\\''`)}'`;
    const command = `sudo /bin/bash ${quote(scriptPath)}`;
    const script = [
      'tell application "Terminal"',
      'activate',
      `do script ${JSON.stringify(command)}`,
      'end tell',
    ].join('\n');
    execFile('osascript', ['-e', script], { timeout: 8000 }, (error) => {
      if (error) {
        resolve({ ok: false, error: 'terminal_launch_failed', details: error.message, path: scriptPath });
        return;
      }
      resolve({ ok: true, path: scriptPath });
    });
  });
}

function readMainWindowClosedFromSettings() {
  const parsed = readAppSettings();
  return Boolean(parsed && parsed.mainWindowClosed);
}

function persistMainWindowClosedToSettings(closed) {
  try {
    ensureAppDirs();
    const parsed = readAppSettings();
    parsed.mainWindowClosed = Boolean(closed);
    writeAppSettings(parsed);
    return true;
  } catch {
    return false;
  }
}

function persistMainWindowSizeToSettings(width, height) {
  try {
    ensureAppDirs();
    const parsed = readAppSettings();
    const nextWidth = sanitizeMainWindowDimension(
      width,
      DEFAULT_MAIN_WINDOW_WIDTH,
      MIN_MAIN_WINDOW_WIDTH,
      MAX_MAIN_WINDOW_WIDTH,
    );
    const nextHeight = sanitizeMainWindowDimension(
      height,
      DEFAULT_MAIN_WINDOW_HEIGHT,
      MIN_MAIN_WINDOW_HEIGHT,
      MAX_MAIN_WINDOW_HEIGHT,
    );
    if (parsed.windowWidth === nextWidth && parsed.windowHeight === nextHeight) {
      return false;
    }
    parsed.windowWidth = nextWidth;
    parsed.windowHeight = nextHeight;
    writeAppSettings(parsed);
    return true;
  } catch {
    return false;
  }
}

function resolveOutboundModeFromSettings() {
  const parsed = readAppSettings();
  const mode = parsed && typeof parsed.proxy === 'string'
    ? parsed.proxy.trim().toLowerCase()
    : '';
  if (OUTBOUND_MODE_BADGE[mode]) {
    return mode;
  }
  return 'rule';
}

function persistOutboundModeToSettings(mode) {
  if (!OUTBOUND_MODE_BADGE[mode]) {
    return false;
  }
  try {
    ensureAppDirs();
    const parsed = readAppSettings();
    parsed.proxy = mode;
    writeAppSettings(parsed);
    return true;
  } catch {
    return false;
  }
}

function persistTunEnabledToSettings(enabled) {
  try {
    ensureAppDirs();
    const parsed = readAppSettings();
    parsed.tun = Boolean(enabled);
    writeAppSettings(parsed);
    return true;
  } catch {
    return false;
  }
}

function persistSystemProxyEnabledToSettings(enabled) {
  try {
    ensureAppDirs();
    const parsed = readAppSettings() || {};
    parsed.systemProxy = Boolean(enabled);
    writeAppSettings(parsed);
    return true;
  } catch {
    return false;
  }
}

function persistSystemProxyEnabledToAppSettings(enabled) {
  try {
    ensureAppDirs();
    const parsed = readAppSettings() || {};
    parsed.systemProxy = Boolean(enabled);
    writeAppSettings(parsed);
    return parsed;
  } catch {
    return null;
  }
}

function normalizeMihomoRunningValue(value, command = '') {
  if (typeof value === 'boolean') {
    return value;
  }
  const cmd = String(command || '').trim();
  if (cmd === 'start' || cmd === 'restart') {
    return true;
  }
  if (cmd === 'stop') {
    return false;
  }
  return null;
}

function persistMihomoStatusToSettings(runningValue, source = 'unknown') {
  const running = normalizeMihomoRunningValue(runningValue);
  if (running === null) {
    return false;
  }
  try {
    ensureAppDirs();
    const parsed = readAppSettings() || {};
    const previous = parsed && parsed.mihomoStatus && typeof parsed.mihomoStatus === 'object'
      ? parsed.mihomoStatus
      : null;
    const previousRunning = previous && typeof previous.running === 'boolean'
      ? previous.running
      : null;
    if (previousRunning === running) {
      return false;
    }
    parsed.mihomoStatus = {
      running,
      source: String(source || 'unknown'),
      updatedAt: new Date().toISOString(),
    };
    writeAppSettings(parsed);
    return true;
  } catch {
    return false;
  }
}

function normalizeKernelVersionValue(value) {
  const text = String(value || '').trim();
  return text || '';
}

function parseKernelVersionDetails(rawVersion = '') {
  const raw = normalizeKernelVersionValue(rawVersion);
  if (!raw) {
    return null;
  }
  const tokens = raw.split(/\s+/).filter(Boolean);
  const core = tokens[0] ? String(tokens[0]).toLowerCase() : '';
  const versionMatch = raw.match(/(?:^|\s)((?:alpha-smart|alpha|beta|rc)-[0-9a-z]+|v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)/i);
  const platformMatch = raw.match(/\b(darwin|linux|windows|freebsd|android)\b/i);
  const archMatch = raw.match(/\b(amd64|arm64|386|armv7|armv6|s390x|ppc64le|riscv64)\b/i);
  const goMatch = raw.match(/\b(go\d+\.\d+(?:\.\d+)?)\b/i);
  const typeCandidate = tokens[1] || '';
  const typeBlocked = /^(with|go\d+\.\d+|darwin|linux|windows|freebsd|android|amd64|arm64|386|armv7|armv6|s390x|ppc64le|riscv64)$/i;
  const type = typeCandidate && !typeBlocked.test(typeCandidate)
    ? typeCandidate
    : '';
  let buildTime = '';
  if (goMatch) {
    const goToken = String(goMatch[1] || '').trim();
    const idx = raw.toLowerCase().indexOf(goToken.toLowerCase());
    if (idx >= 0) {
      buildTime = raw.slice(idx + goToken.length).trim();
    }
  }
  return {
    raw,
    core,
    type,
    version: versionMatch ? String(versionMatch[1] || '').trim() : '',
    platform: platformMatch ? String(platformMatch[1] || '').toLowerCase() : '',
    arch: archMatch ? String(archMatch[1] || '').toLowerCase() : '',
    language: goMatch ? 'go' : '',
    languageVersion: goMatch ? String(goMatch[1] || '').trim() : '',
    buildTime,
  };
}

function persistKernelVersionToSettings(versionValue, source = 'unknown') {
  const kernelVersion = normalizeKernelVersionValue(versionValue);
  if (!kernelVersion) {
    return false;
  }
  try {
    ensureAppDirs();
    const parsed = readAppSettings() || {};
    const existingKernel = parsed.kernel && typeof parsed.kernel === 'object' ? parsed.kernel : null;
    const existingKernelRaw = existingKernel
      ? normalizeKernelVersionValue(existingKernel.raw || existingKernel.version)
      : '';
    const hasStructuredKernel = Boolean(
      existingKernel
      && existingKernelRaw
      && existingKernel.core
      && existingKernel.arch
      && existingKernel.languageVersion,
    );
    if (existingKernelRaw === kernelVersion && hasStructuredKernel) {
      return false;
    }
    const parsedKernel = parseKernelVersionDetails(kernelVersion);
    parsed.kernel = {
      ...(parsedKernel || {}),
      source: String(source || 'unknown'),
      updatedAt: new Date().toISOString(),
    };
    if (Object.prototype.hasOwnProperty.call(parsed, 'kernelVersion')) {
      delete parsed.kernelVersion;
    }
    if (Object.prototype.hasOwnProperty.call(parsed, 'kernelVersionMeta')) {
      delete parsed.kernelVersionMeta;
    }
    writeAppSettings(parsed);
    return true;
  } catch {
    return false;
  }
}

async function persistKernelVersionFromStatus(source = 'status-refresh') {
  try {
    const statusResult = await runBridge(['status']);
    if (!statusResult || !statusResult.ok || !statusResult.data) {
      return false;
    }
    const version = normalizeKernelVersionValue(statusResult.data.version);
    if (!version) {
      return false;
    }
    return persistKernelVersionToSettings(version, source);
  } catch {
    return false;
  }
}

function buildDeviceVersionFromOverview(systemVersion = '', systemBuild = '') {
  return resolveDefaultDeviceVersion();
}

function persistOverviewSystemToSettings(overviewData = {}, source = 'overview') {
  try {
    const parsed = readAppSettings() || {};
    const previousDevice = parsed.device && typeof parsed.device === 'object' ? parsed.device : {};
    const snapshot = resolveCurrentDeviceSnapshot('electron');
    const nextDeviceCore = {
      user: snapshot.user,
      userRealName: snapshot.userRealName,
      computerName: snapshot.computerName,
      os: snapshot.os,
      version: snapshot.version,
      build: snapshot.build,
      source: snapshot.source,
    };
    const previousDeviceSignature = [
      normalizeTextValue(previousDevice.user),
      normalizeTextValue(previousDevice.userRealName),
      normalizeTextValue(previousDevice.computerName) || normalizeTextValue(previousDevice.displayName),
      normalizeTextValue(previousDevice.os),
      normalizeTextValue(previousDevice.version),
      normalizeTextValue(previousDevice.build),
      normalizeTextValue(previousDevice.source),
    ].join('|');
    const nextDeviceSignature = [
      nextDeviceCore.user,
      nextDeviceCore.userRealName,
      nextDeviceCore.computerName,
      nextDeviceCore.os,
      nextDeviceCore.version,
      nextDeviceCore.build,
      nextDeviceCore.source,
    ].join('|');
    const deviceChanged = previousDeviceSignature !== nextDeviceSignature;

    if (!deviceChanged) {
      return false;
    }

    if (deviceChanged) {
      parsed.device = {
        ...nextDeviceCore,
        updatedAt: snapshot.updatedAt,
      };
      if (Object.prototype.hasOwnProperty.call(parsed.device, 'displayName')) {
        delete parsed.device.displayName;
      }
    }
    if (Object.prototype.hasOwnProperty.call(parsed, 'overview')) {
      delete parsed.overview;
    }
    writeAppSettings(parsed);
    return true;
  } catch {
    return false;
  }
}

function buildShellExportCommand(settings = null) {
  const source = settings && typeof settings === 'object' ? settings : readAppSettings();
  const httpCandidate = String(
    (source && (source.port ?? source.mixedPort))
      ?? '',
  ).trim();
  const socksCandidate = String(
    (source && source.socksPort)
      ?? '',
  ).trim();
  const safeHttpPort = /^[0-9]+$/.test(httpCandidate) ? httpCandidate : '7890';
  const safeSocksPort = /^[0-9]+$/.test(socksCandidate) ? socksCandidate : '7891';
  return `export http_proxy="http://127.0.0.1:${safeHttpPort}" https_proxy="http://127.0.0.1:${safeHttpPort}" all_proxy="socks5://127.0.0.1:${safeSocksPort}" no_proxy="localhost,127.0.0.1,::1"`;
}

function resolveConnectivityToneByLatency(rawLatency) {
  const latency = Number.parseFloat(String(rawLatency || '').trim());
  if (!Number.isFinite(latency)) {
    return 'neutral';
  }
  if (latency <= 50) {
    return 'good';
  }
  if (latency <= 120) {
    return 'warn';
  }
  return 'bad';
}

function pickOverviewInternetLatencyValue(data = {}) {
  if (!data || typeof data !== 'object') {
    return '';
  }
  const candidates = [
    data.internetMs,
    data.internet,
    data.internetLatency,
    data.dnsMs,
    data.dns,
    data.dnsLatency,
    data.routerMs,
    data.router,
    data.gatewayMs,
    data.routerLatency,
  ];
  for (const value of candidates) {
    if (value === null || value === undefined || value === '') {
      continue;
    }
    const num = Number.parseFloat(String(value).trim());
    if (Number.isFinite(num)) {
      return String(num);
    }
  }
  return '';
}

async function getConnectivityQualitySnapshot(configPath) {
  const now = Date.now();
  if ((now - connectivityQualityCache.updatedAt) <= CONNECTIVITY_REFRESH_MS) {
    return connectivityQualityCache;
  }
  if (connectivityQualityFetchPromise) {
    return connectivityQualityFetchPromise;
  }

  connectivityQualityFetchPromise = (async () => {
    try {
      const overview = await runBridge(['overview', '--cache-ttl', '2', '--config', configPath, ...getControllerArgsFromSettings()]);
      const internetMs = overview && overview.ok && overview.data
        ? pickOverviewInternetLatencyValue(overview.data)
        : '';
      if (internetMs && internetMs !== '-') {
        connectivityQualityCache = {
          text: `${internetMs} ms`,
          tone: resolveConnectivityToneByLatency(internetMs),
          updatedAt: Date.now(),
        };
        return connectivityQualityCache;
      }
      if (connectivityQualityCache.text && connectivityQualityCache.text !== '-') {
        connectivityQualityCache = {
          ...connectivityQualityCache,
          updatedAt: Date.now(),
        };
        return connectivityQualityCache;
      }
      connectivityQualityCache = {
        text: '-',
        tone: 'neutral',
        updatedAt: Date.now(),
      };
      return connectivityQualityCache;
    } catch {
      // Keep old snapshot and allow immediate retry on next refresh cycle.
      return connectivityQualityCache;
    } finally {
      connectivityQualityFetchPromise = null;
    }
  })();

  return connectivityQualityFetchPromise;
}

function patchTrayMenuConnectivityBadge(snapshot) {
  if (!trayMenuData || !trayMenuData.submenus || !Array.isArray(trayMenuData.submenus.network)) {
    return;
  }
  const text = snapshot && snapshot.text ? String(snapshot.text) : '-';
  const tone = snapshot && snapshot.tone ? String(snapshot.tone) : 'neutral';
  trayMenuData.submenus.network = trayMenuData.submenus.network.map((item) => {
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
}

async function refreshNetworkSubmenuState() {
  const configPath = getConfigPathFromSettings();
  let systemProxyEnabled;
  let tunEnabled;
  const traySettings = readAppSettings();
  const expectedProxyPort = String(
    traySettings && Object.prototype.hasOwnProperty.call(traySettings, 'port')
      ? traySettings.port
      : '',
  ).trim();
  try {
    const statusArgs = ['system-proxy-status', '--config', configPath];
    if (expectedProxyPort) {
      statusArgs.push('--port', expectedProxyPort);
    }
    const takeover = await runBridge(statusArgs);
    systemProxyEnabled = Boolean(takeover && takeover.ok && takeover.data && takeover.data.enabled);
  } catch {
    // ignore transient errors; keep last known value
  }
  try {
    const tunStatus = await runBridge(['tun-status']);
    tunEnabled = Boolean(tunStatus && tunStatus.ok && tunStatus.data && tunStatus.data.enabled);
  } catch {
    // ignore transient errors; keep last known value
  }
  patchTrayMenuNetworkState({ systemProxyEnabled, tunEnabled });
}

function getControllerArgsFromSettings() {
  const settings = readAppSettings();
  const args = [];
  const controller = settings && typeof settings.externalController === 'string'
    ? settings.externalController.trim()
    : '';
  const secret = settings && typeof settings.secret === 'string'
    ? settings.secret.trim()
    : '';
  if (controller) {
    args.push('--controller', controller);
  }
  if (secret) {
    args.push('--secret', secret);
  }
  return args;
}

function trimTransparentPadding(image, alphaThreshold = 8) {
  if (!image || image.isEmpty()) {
    return image;
  }
  try {
    const { width, height } = image.getSize();
    if (!width || !height) {
      return image;
    }
    const bitmap = image.toBitmap();
    if (!bitmap || !bitmap.length) {
      return image;
    }
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const alpha = bitmap[(y * width + x) * 4 + 3];
        if (alpha > alphaThreshold) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < minX || maxY < minY) {
      return image;
    }
    const cropRect = {
      x: minX,
      y: minY,
      width: (maxX - minX) + 1,
      height: (maxY - minY) + 1,
    };
    return image.crop(cropRect);
  } catch {
    return image;
  }
}

function buildTrayIconWithState({ active = true } = {}) {
  const cacheKey = process.platform === 'darwin'
    ? `mac-template-v5-${active ? 'active' : 'inactive'}`
    : `default-${active ? 'active' : 'inactive'}`;
  const cached = trayIconCache.get(cacheKey);
  if (cached && !cached.isEmpty()) {
    return cached;
  }
  let icon = nativeImage.createEmpty();

  if (process.platform === 'darwin') {
    const fill = active ? '#000000' : 'rgba(0,0,0,0.34)';
    const trayTemplateSvg = [
      '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">',
      `<path fill="${fill}" d="M9 0.2 12 2.7l3.8.8-.9 3 .9 2.3-2.7 1.7-1.2 3.4L9 15.2l-2.9-1.3-1.2-3.4-2.7-1.7.9-2.3-.9-3 3.8-.8L9 .2z"/>`,
      '</svg>',
    ].join('');
    const dataUrl = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(trayTemplateSvg)}`;
    icon = nativeImage.createFromDataURL(dataUrl);
    if (icon.isEmpty()) {
      const fallbackIconPath = path.join(APP_PATH, 'src', 'ui', 'assets', 'menu.png');
      icon = nativeImage.createFromPath(fallbackIconPath);
      icon = trimTransparentPadding(icon);
    }
    if (!icon.isEmpty()) {
      icon = icon.resize({ width: 16, height: 16, quality: 'best' });
      if (typeof icon.setTemplateImage === 'function') {
        icon.setTemplateImage(true);
      }
    }
  } else {
    const iconPath = path.join(APP_PATH, 'src', 'ui', 'assets', 'menu.png');
    icon = nativeImage.createFromPath(iconPath);
    icon = trimTransparentPadding(icon);
    if (!icon.isEmpty()) {
      icon = icon.resize({ width: 16, height: 16, quality: 'best' });
    }
  }

  if (!icon.isEmpty()) {
    trayIconCache.set(cacheKey, icon);
  }
  return icon;
}

function applyTrayIconForState({ active = true } = {}) {
  if (!tray) {
    return;
  }
  const trayIcon = buildTrayIconWithState({ active });
  if (!trayIcon.isEmpty()) {
    if (process.platform === 'darwin' && typeof trayIcon.setTemplateImage === 'function') {
      trayIcon.setTemplateImage(true);
    }
    tray.setImage(trayIcon);
  }
}

function isTrayActiveState({ systemProxyEnabled = false, tunEnabled = false } = {}) {
  return Boolean(systemProxyEnabled || tunEnabled);
}

function runBridgeWithSystemAuth(bridgeArgs = []) {
  return new Promise((resolve) => {
    const bridgePath = getBridgePath();
    if (!fs.existsSync(bridgePath)) {
      resolve({ ok: false, error: 'script_missing', details: bridgePath });
      return;
    }
    const cwd = app.isPackaged ? APP_DATA_DIR : ROOT_DIR;
    const quote = (value) => `'${String(value || '').replace(/'/g, `'\\''`)}'`;
    const command = `cd ${quote(cwd)}; /bin/bash ${quote(bridgePath)} ${bridgeArgs.map((arg) => quote(arg)).join(' ')}`;
    const script = [
      'try',
      `set out to do shell script ${JSON.stringify(command)} with administrator privileges`,
      'return out',
      'on error errMsg number errNum',
      `return "${SYSTEM_AUTH_ERROR_PREFIX}:" & (errNum as text) & ":" & errMsg`,
      'end try',
    ].join('\n');
    execFile('osascript', ['-e', script], { timeout: 180 * 1000 }, (error, stdout) => {
      if (error) {
        resolve({
          ok: false,
          error: 'system_auth_failed',
          details: error.message || String(error),
        });
        return;
      }
      try {
        const output = String(stdout || '').trim();
        if (output.startsWith(`${SYSTEM_AUTH_ERROR_PREFIX}:`)) {
          const payload = output.slice(SYSTEM_AUTH_ERROR_PREFIX.length + 1);
          const firstColonIndex = payload.indexOf(':');
          const errNumRaw = firstColonIndex >= 0 ? payload.slice(0, firstColonIndex) : payload;
          const errMsg = firstColonIndex >= 0 ? payload.slice(firstColonIndex + 1).trim() : '';
          const errNum = Number.parseInt(String(errNumRaw || '').trim(), 10);
          if (errNum === -128) {
            resolve({ ok: false, error: 'sudo_required' });
            return;
          }
          resolve({
            ok: false,
            error: 'system_auth_failed',
            details: errMsg || 'system_authorization_failed',
          });
          return;
        }
        resolve(parseBridgeOutput(output));
      } catch {
        resolve({
          ok: false,
          error: 'system_auth_failed',
          details: String(stdout || '').trim(),
        });
      }
    });
  });
}

function normalizeBridgeArgs(args = [], options = {}) {
  const inputArgs = Array.isArray(args) ? args : [];
  const normalized = [];
  let extractedSudoPass = '';
  for (let index = 0; index < inputArgs.length; index += 1) {
    const value = inputArgs[index];
    if (value === '--sudo-pass') {
      const nextValue = inputArgs[index + 1];
      if (!extractedSudoPass && typeof nextValue === 'string') {
        extractedSudoPass = nextValue;
      }
      index += 1;
      continue;
    }
    normalized.push(value);
  }
  const optionSudoPass = options && typeof options.sudoPass === 'string' ? options.sudoPass : '';
  return {
    args: normalized,
    sudoPass: optionSudoPass || extractedSudoPass,
  };
}

function readHelperTokens() {
  const candidates = [HELPER_TOKEN_LEGACY_PATH, HELPER_TOKEN_PATH];
  const tokens = [];
  try {
    for (const candidate of candidates) {
      if (!fs.existsSync(candidate)) {
        continue;
      }
      const token = String(fs.readFileSync(candidate, 'utf8') || '').trim();
      if (!token) {
        continue;
      }
      if (!tokens.includes(token)) {
        tokens.push(token);
      }
    }
    return tokens;
  } catch {
    return tokens;
  }
}

function sendHelperRequest(pathname, method = 'GET', payload = null, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(HELPER_SOCKET_PATH)) {
      reject(new Error('socket_missing'));
      return;
    }
    const tokens = readHelperTokens();
    if (!tokens.length) {
      reject(new Error('token_missing'));
      return;
    }
    const hasBody = payload !== null && payload !== undefined;
    const body = hasBody ? JSON.stringify(payload) : '';
    const maxTime = String(Math.max(1, Math.ceil(Number(timeoutMs || 20000) / 1000)));
    const requestMethod = String(method || 'GET').toUpperCase();
    const marker = '__CURL_HTTP_CODE__';

    const runWithToken = (token, callback) => {
      const args = [
        '--silent',
        '--show-error',
        '--max-time',
        maxTime,
        '--unix-socket',
        HELPER_SOCKET_PATH,
        '-H',
        `X-Helper-Token: ${token}`,
        '-X',
        requestMethod,
      ];
      if (hasBody) {
        args.push('-H', 'Content-Type: application/json', '-d', body);
      }
      args.push(
        '--write-out',
        `\\n${marker}:%{http_code}`,
        `http://localhost${pathname}`,
      );
      execFile('/usr/bin/curl', args, { timeout: timeoutMs }, (error, stdout = '', stderr = '') => {
        callback(error, String(stdout || ''), String(stderr || ''));
      });
    };

    const tryNext = (index = 0, lastError = null) => {
      if (index >= tokens.length) {
        reject(lastError || new Error('helper_unreachable'));
        return;
      }
      runWithToken(tokens[index], (error, stdout, stderr) => {
        if (error) {
          const message = String(stderr || error.message || 'helper_request_failed').trim() || 'helper_request_failed';
          tryNext(index + 1, new Error(message));
          return;
        }
        const markerIndex = stdout.lastIndexOf(`\n${marker}:`);
        const fallbackMarkerIndex = markerIndex >= 0 ? markerIndex : stdout.lastIndexOf(`${marker}:`);
        if (fallbackMarkerIndex < 0) {
          resolve({
            statusCode: 200,
            body: stdout.trim(),
          });
          return;
        }
        const statusText = stdout.slice(fallbackMarkerIndex).replace(/\n/g, '').replace(`${marker}:`, '').trim();
        const statusCode = Number.parseInt(statusText, 10);
        const bodyText = stdout.slice(0, fallbackMarkerIndex).trim();
        if ((statusCode === 401 || statusCode === 403) && index < tokens.length - 1) {
          tryNext(index + 1, new Error('unauthorized'));
          return;
        }
        resolve({
          statusCode: Number.isFinite(statusCode) ? statusCode : 200,
          body: bodyText,
        });
      });
    };

    tryNext(0, null);
  });
}

function normalizeHelperApiError(err) {
  const raw = String((err && err.message) || '').trim().toLowerCase();
  if (!raw) {
    return 'helper_unreachable';
  }
  if (raw.includes('token_missing') || raw.includes('unauthorized')) {
    return 'unauthorized';
  }
  if (raw.includes('socket_missing') || raw.includes('no such file')) {
    return 'socket_missing';
  }
  if (raw.includes('timed out') || raw.includes('timeout')) {
    return 'timeout';
  }
  if (raw.includes('permission denied')) {
    return 'permission_denied';
  }
  if (raw.includes('could not connect') || raw.includes('connection refused')) {
    return 'helper_unreachable';
  }
  return 'helper_unreachable';
}

function isHelperHealthResponseOk(body = '') {
  const text = String(body || '').trim();
  if (!text) {
    return false;
  }
  try {
    const parsed = JSON.parse(text);
    if (parsed && parsed.ok === true) {
      return true;
    }
  } catch {
    // fallback to relaxed check below
  }
  if (/"ok"\s*:\s*true/i.test(text)) {
    return true;
  }
  if (/"status"\s*:\s*"ok"/i.test(text)) {
    return true;
  }
  return false;
}

async function runBridgeViaHelperApi(bridgeArgs = []) {
  const commandType = String((bridgeArgs && bridgeArgs[0]) || '').trim();
  const commandArgs = Array.isArray(bridgeArgs) ? bridgeArgs.slice(1) : [];
  if (!commandType || process.platform !== 'darwin') {
    return null;
  }

  const readArgValue = (name = '') => {
    if (!name) {
      return '';
    }
    for (let index = 0; index < commandArgs.length; index += 1) {
      if (commandArgs[index] !== name) {
        continue;
      }
      const value = commandArgs[index + 1];
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }
    return '';
  };

  const respondFromHelper = async (pathname, method = 'GET', payload = null) => {
    const requestId = nextHelperRequestId();
    const kind = resolveHelperRequestKind(commandType, method, pathname);
    if (!shouldSuppressHelperRequestLog(commandType, method, pathname, 'log', true)) {
      guiMainLog('helper-api', 'request', {
        requestId,
        kind,
        method,
        path: pathname,
        command: commandType,
        payload: truncateLogPayload(payload ? JSON.stringify(payload) : ''),
      });
    }
    const response = await sendHelperRequest(pathname, method, payload);
    if (!response) {
      guiMainLog('helper-api', 'response', {
        requestId,
        kind,
        method,
        path: pathname,
        command: commandType,
        ok: false,
        error: 'helper_unreachable',
      }, 'warn');
      return { ok: false, error: 'helper_unreachable' };
    }
    const statusCode = Number(response.statusCode || 0);
    const isHttpOk = statusCode >= 200 && statusCode < 300;
    const textBody = String(response.body || '').trim();
    if (!textBody) {
      if (!shouldSuppressHelperRequestLog(commandType, method, pathname, 'log', isHttpOk)) {
        guiMainLog('helper-api', 'response', {
          requestId,
          kind,
          method,
          path: pathname,
          command: commandType,
          statusCode,
          ok: isHttpOk,
          body: '',
        });
      }
      return isHttpOk ? { ok: true, data: {} } : { ok: false, error: `http_${statusCode || 0}` };
    }
    try {
      const parsed = parseBridgeOutput(textBody);
      if (!parsed || typeof parsed !== 'object') {
        if (!shouldSuppressHelperRequestLog(commandType, method, pathname, 'log', isHttpOk)) {
          guiMainLog('helper-api', 'response', {
            requestId,
            kind,
            method,
            path: pathname,
            command: commandType,
            statusCode,
            ok: isHttpOk,
            shape: typeof parsed,
            body: truncateLogPayload(textBody),
          });
        }
        return isHttpOk ? { ok: true, data: parsed } : { ok: false, error: 'helper_unreachable' };
      }
      if (parsed.ok === true) {
        if (!shouldSuppressHelperRequestLog(commandType, method, pathname, 'log', true)) {
          guiMainLog('helper-api', 'response', {
            requestId,
            kind,
            method,
            path: pathname,
            command: commandType,
            statusCode,
            ok: true,
            body: truncateLogPayload(JSON.stringify(parsed)),
          });
        }
        return parsed;
      }
      if (parsed.ok === false || parsed.error) {
        guiMainLog('helper-api', 'response', {
          requestId,
          kind,
          method,
          path: pathname,
          command: commandType,
          statusCode,
          ok: false,
          error: parsed.error || 'helper_error',
          body: truncateLogPayload(JSON.stringify(parsed)),
        }, 'warn');
        return parsed;
      }
      if (parsed.status === 'ok' || parsed.success === true) {
        if (!shouldSuppressHelperRequestLog(commandType, method, pathname, 'log', true)) {
          guiMainLog('helper-api', 'response', {
            requestId,
            kind,
            method,
            path: pathname,
            command: commandType,
            statusCode,
            ok: true,
            body: truncateLogPayload(JSON.stringify(parsed)),
          });
        }
        return {
          ok: true,
          data: Object.prototype.hasOwnProperty.call(parsed, 'data') ? parsed.data : parsed,
        };
      }
      if (isHttpOk) {
        if (!shouldSuppressHelperRequestLog(commandType, method, pathname, 'log', true)) {
          guiMainLog('helper-api', 'response', {
            requestId,
            kind,
            method,
            path: pathname,
            command: commandType,
            statusCode,
            ok: true,
            body: truncateLogPayload(JSON.stringify(parsed)),
          });
        }
        return { ok: true, data: parsed };
      }
      guiMainLog('helper-api', 'response', {
        requestId,
        kind,
        method,
        path: pathname,
        command: commandType,
        statusCode,
        ok: false,
        error: 'helper_unreachable',
        body: truncateLogPayload(JSON.stringify(parsed)),
      }, 'warn');
      return parsed;
    } catch {
      guiMainLog('helper-api', 'response', {
        requestId,
        kind,
        method,
        path: pathname,
        command: commandType,
        statusCode,
        ok: isHttpOk,
        error: isHttpOk ? 'parse_warning' : 'parse_error',
        body: truncateLogPayload(textBody),
      }, isHttpOk ? 'warn' : 'error');
      if (isHttpOk) {
        return { ok: true, data: textBody };
      }
      return { ok: false, error: 'parse_error', details: textBody };
    }
  };
  const isInvalidServiceError = (resp = null) => {
    if (!resp || typeof resp !== 'object') {
      return false;
    }
    const errorText = String(resp.error || '').trim().toLowerCase();
    const detailsText = String(resp.details || resp.message || '').trim().toLowerCase();
    return errorText.includes('invalid_service_name')
      || errorText.includes('invalid service')
      || detailsText.includes('invalid service name');
  };

  try {
    switch (commandType) {
      case 'ping': {
        let response = null;
        try {
          response = await sendHelperRequest('/health', 'GET', null, 5000);
        } catch {
          response = null;
        }
        if (response && isHelperHealthResponseOk(response.body)) {
          return {
            ok: true,
            data: {
              status: 'ok',
              source: 'helper',
            },
          };
        }
        const result = await respondFromHelper('/health', 'GET');
        if (result && result.ok) {
          return {
            ok: true,
            data: {
              status: 'ok',
              source: 'helper',
            },
          };
        }
        return result;
      }
      case 'status': {
        const result = await respondFromHelper('/v1/core/status', 'GET');
        const hasStatusShape = Boolean(
          result
          && typeof result === 'object'
          && (Object.prototype.hasOwnProperty.call(result, 'running')
            || Object.prototype.hasOwnProperty.call(result, 'pid')
            || Object.prototype.hasOwnProperty.call(result, 'binary')),
        );
        if (result && (result.ok || hasStatusShape)) {
          const running = Boolean(
            Object.prototype.hasOwnProperty.call(result, 'running')
              ? result.running
              : (result.data && result.data.running),
          );
          return {
            ok: true,
            data: {
              running,
              pid: Number(
                Object.prototype.hasOwnProperty.call(result, 'pid')
                  ? result.pid
                  : (result.data && result.data.pid) || 0,
              ),
              path: String(
                Object.prototype.hasOwnProperty.call(result, 'binary')
                  ? result.binary
                  : (result.data && (result.data.binary || result.data.path)) || '',
              ),
              source: 'helper',
            },
          };
        }
        return result;
      }
      case 'start': {
        const settings = readAppSettings();
        const configFileName = path.basename(resolveConfigPathFromSettingsOrArgs(settings)).trim();
        if (!configFileName) {
          return respondFromHelper('/v1/core/start', 'POST', {});
        }
        return respondFromHelper('/v1/core/start', 'POST', {
          configPath: configFileName,
        });
      }
      case 'stop':
        return respondFromHelper('/v1/core/stop', 'POST', {});
      case 'restart': {
        const settings = readAppSettings();
        const configFileName = path.basename(resolveConfigPathFromSettingsOrArgs(settings)).trim();
        if (!configFileName) {
          return respondFromHelper('/v1/core/restart', 'POST', {});
        }
        return respondFromHelper('/v1/core/restart', 'POST', {
          configPath: configFileName,
        });
      }
      case 'tun-status':
        return { ok: false, error: 'unsupported_command' };
      case 'tun':
        return { ok: false, error: 'unsupported_command' };
      case 'system-proxy-enable': {
        const settings = readAppSettings();
        const configPath = resolveConfigPathFromSettingsOrArgs(settings);
        const ports = readProxyPortsFromConfigPath(configPath);
        const portFromSettings = settings && Object.prototype.hasOwnProperty.call(settings, 'port')
          ? String(settings.port || '').trim()
          : '';
        const socksFromSettings = settings && Object.prototype.hasOwnProperty.call(settings, 'socksPort')
          ? String(settings.socksPort || '').trim()
          : '';
        const port = portFromSettings || String(ports.port || '').trim() || '7890';
        const socksPort = socksFromSettings || String(ports.socksPort || '').trim() || String(port);
        const parsedPort = Number.parseInt(String(port || '').trim(), 10);
        const parsedSocksPort = Number.parseInt(String(socksPort || '').trim(), 10);
        if (!Number.isFinite(parsedPort) || parsedPort <= 0 || parsedPort > 65535) {
          return { ok: false, error: 'invalid_proxy_host_port' };
        }
        if (!Number.isFinite(parsedSocksPort) || parsedSocksPort <= 0 || parsedSocksPort > 65535) {
          return { ok: false, error: 'invalid_proxy_host_port' };
        }
        let service = await resolveUsableNetworkServiceName(readArgValue('--service'));
        if (!service) {
          return { ok: false, error: 'network_service_not_found' };
        }
        const enablePayload = {
          service,
          host: '127.0.0.1',
          port: parsedPort,
          socksPort: parsedSocksPort,
        };
        let response = await respondFromHelper('/v1/proxy/enable?withStatus=1', 'POST', enablePayload);
        if (isInvalidServiceError(response)) {
          const fallbackService = await resolveActiveNetworkServiceName();
          if (fallbackService && fallbackService !== service) {
            service = fallbackService;
            response = await respondFromHelper('/v1/proxy/enable?withStatus=1', 'POST', {
              ...enablePayload,
              service,
            });
          }
          // Some helper builds can infer active service when omitted.
          if (isInvalidServiceError(response)) {
            response = await respondFromHelper('/v1/proxy/enable?withStatus=1', 'POST', {
              host: '127.0.0.1',
              port: parsedPort,
              socksPort: parsedSocksPort,
            });
          }
        }
        return response;
      }
      case 'system-proxy-disable': {
        return respondFromHelper('/v1/proxy/disable?withStatus=1', 'POST', {});
      }
      case 'system-proxy-status': {
        const activeService = await resolveActiveNetworkServiceName();
        const candidates = [activeService, '']
          .map((item) => String(item || '').trim())
          .filter((item, index, list) => list.indexOf(item) === index);
        let result = null;
        for (const service of candidates) {
          const endpoint = service
            ? `/v1/proxy/status?service=${encodeURIComponent(service)}`
            : '/v1/proxy/status';
          result = await respondFromHelper(endpoint, 'GET');
          if (!isInvalidServiceError(result)) {
            break;
          }
        }
        if (!result || result.ok === false) {
          return result;
        }
        const data = (result && result.data && typeof result.data === 'object')
          ? result.data
          : (result && typeof result === 'object' ? result : {});
        const toBool = (value) => value === true || value === 'true' || value === 1 || value === '1';
        const hasAnyEnabled = Object.prototype.hasOwnProperty.call(data, 'anyEnabled');
        const hasMatchesDesired = Object.prototype.hasOwnProperty.call(data, 'matchesDesired');
        const hasManagedByHelper = Object.prototype.hasOwnProperty.call(data, 'managedByHelper');
        const anyEnabled = toBool(data.anyEnabled);
        const matchesDesired = toBool(data.matchesDesired);
        const managedByHelper = toBool(data.managedByHelper);
        const enabledRaw = Object.prototype.hasOwnProperty.call(data, 'enabled')
          ? data.enabled
          : (Object.prototype.hasOwnProperty.call(data, 'enable') ? data.enable : false);
        const legacyEnabled = toBool(enabledRaw);
        const hasGuardFields = hasAnyEnabled || hasMatchesDesired || hasManagedByHelper;
        const enabled = hasGuardFields
          ? (anyEnabled && matchesDesired && managedByHelper)
          : legacyEnabled;
        return {
          ok: true,
          data: {
            enabled,
            service: String(data.service || service || '').trim(),
            host: String(data.host || '127.0.0.1').trim(),
            port: String(data.port || '').trim(),
            socksPort: String(data.socksPort || '').trim(),
            anyEnabled,
            matchesDesired,
            managedByHelper,
            source: 'helper',
          },
        };
      }
      default:
        return { ok: false, error: 'unsupported_command' };
    }
  } catch (err) {
    return {
      ok: false,
      error: normalizeHelperApiError(err),
      details: String((err && err.message) || '').trim(),
    };
  }
}

async function runBridgeViaHelper(bridgeArgs = []) {
  const commandType = bridgeArgs[0];
  const helperOnlyCommands = new Set(['system-proxy-enable', 'system-proxy-disable']);
  if (!commandType || process.platform !== 'darwin') {
    return null;
  }
  const shouldFallbackToScript = (result) => {
    if (!result || typeof result !== 'object' || result.ok === true) {
      return false;
    }
    const errorCode = String(result.error || '').trim().toUpperCase();
    const details = String(result.details || '').toLowerCase();
    if (errorCode === 'UNSUPPORTED_COMMAND') {
      return true;
    }
    const fallbackErrors = new Set([
      'CIRCUIT_OPEN',
      'RATE_LIMITED',
      'FORBIDDEN_CALLER',
      'UNAUTHORIZED',
      'UNAUTHORIZED_TOKEN',
      'FORBIDDEN',
      'NOT_FOUND',
      'PARSE_ERROR',
      'HELPER_UNREACHABLE',
      'SOCKET_MISSING',
      'TOKEN_MISSING',
      'TIMEOUT',
    ]);
    if (fallbackErrors.has(errorCode)) {
      return true;
    }
    // Helper internal transient errors should not block TUN toggle flow.
    if ((commandType === 'tun' || commandType === 'tun-status') && errorCode === 'UNEXPECTED_ERROR') {
      return true;
    }
    if (details.includes('temporarily blocked') || details.includes('repeated failures')) {
      return true;
    }
    return false;
  };
  const helperResult = await runBridgeViaHelperApi(bridgeArgs);
  if (helperOnlyCommands.has(String(commandType || '').trim())) {
    const isTransientHelperError = (result) => {
      if (!result || typeof result !== 'object') {
        return true;
      }
      if (result.ok) {
        return false;
      }
      const code = String(result.error || '').trim().toLowerCase();
      return code === 'helper_unreachable' || code === 'socket_missing' || code === 'timeout';
    };
    if (isTransientHelperError(helperResult)) {
      await sleep(200);
      const retryResult = await runBridgeViaHelperApi(bridgeArgs);
      if (retryResult) {
        return retryResult;
      }
    }
    if (!helperResult) {
      return { ok: false, error: 'helper_unreachable' };
    }
    return helperResult;
  }
  if (shouldFallbackToScript(helperResult)) {
    return null;
  }
  if (helperResult) {
    return helperResult;
  }
  return null;
}

async function pingHelper() {
  if (process.platform !== 'darwin') {
    return { ok: false, error: 'unsupported_os' };
  }
  const helperResult = await runBridgeViaHelperApi(['ping']);
  if (helperResult && helperResult.ok) {
    return helperResult;
  }
  return { ok: false, error: 'helper_unreachable' };
}

async function checkHelperOnStartup() {
  const response = await pingHelper();
  if (response && response.ok) {
    return;
  }
  emitMainToast(
    'Helper is not installed or not running. Please install/repair it in Settings.',
    'warn',
  );
}

function resolveBridgeResultSource(result) {
  return result && result.data && result.data.source
    ? String(result.data.source).trim()
    : 'script';
}

async function syncBridgeResultToSettings(command, result) {
  if (!(result && result.ok)) {
    return;
  }
  const cmdLower = String(command || '').trim().toLowerCase();
  if (cmdLower === 'status') {
    const runningValue = result.data && Object.prototype.hasOwnProperty.call(result.data, 'running')
      ? result.data.running
      : null;
    persistMihomoStatusToSettings(runningValue, 'status');
    const versionValue = result.data && Object.prototype.hasOwnProperty.call(result.data, 'version')
      ? result.data.version
      : '';
    persistKernelVersionToSettings(versionValue, 'status');
    return;
  }
  if (cmdLower === 'overview') {
    persistOverviewSystemToSettings(result.data || {}, 'overview');
    return;
  }
  if (!['start', 'stop', 'restart', 'switch'].includes(cmdLower)) {
    return;
  }
  const runningValue = result.data && Object.prototype.hasOwnProperty.call(result.data, 'running')
    ? result.data.running
    : normalizeMihomoRunningValue(null, cmdLower);
  persistMihomoStatusToSettings(runningValue, cmdLower);
  if (!['start', 'restart', 'switch'].includes(cmdLower)) {
    return;
  }
  const versionValue = result.data && Object.prototype.hasOwnProperty.call(result.data, 'version')
    ? result.data.version
    : '';
  if (normalizeKernelVersionValue(versionValue)) {
    persistKernelVersionToSettings(versionValue, cmdLower);
    return;
  }
  await persistKernelVersionFromStatus(cmdLower);
}

async function runBridgeWithAutoAuth(command, args = [], options = {}) {
  const cmd = String(command || '').trim();
  if (!cmd) {
    return { ok: false, error: 'unknown_command' };
  }
  const cmdArgs = Array.isArray(args) ? args : [];
  guiMainLog('bridge', 'command start', {
    command: cmd,
    args: cmdArgs,
  });
  let result = await runBridge([cmd, ...cmdArgs], options);
  let source = resolveBridgeResultSource(result);
  if (
    result
    && result.error === 'sudo_required'
    && process.platform === 'darwin'
    && PRIVILEGED_COMMANDS.has(cmd)
  ) {
    guiMainLog('bridge', 'command escalated to system auth', {
      command: cmd,
    }, 'warn');
    result = await runBridgeWithSystemAuth([cmd, ...cmdArgs]);
    source = 'system-auth';
  }
  await syncBridgeResultToSettings(cmd, result);
  guiMainLog('bridge', 'command completed', {
    command: cmd,
    ok: Boolean(result && result.ok),
    error: result && result.ok ? '' : String((result && result.error) || '').trim(),
    source,
  }, result && result.ok ? 'log' : 'warn');
  return result;
}

function emitTrayRefresh() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('clashfox:trayRefresh');
  }
}

function emitSettingsUpdated(settings = {}) {
  const payload = settings && typeof settings === 'object' ? settings : {};
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win || win.isDestroyed() || !win.webContents) {
      return;
    }
    win.webContents.send('clashfox:settingsUpdated', payload);
  });
}

function pushCurrentSettingsToWindow(win) {
  if (!win || win.isDestroyed() || !win.webContents) {
    return;
  }
  try {
    const settings = mergeAppearanceAliases(
      mergePanelManagerAliases(
        mergeUserDataPathAliases(
          normalizeSettingsForStorage(readAppSettings()),
        ),
      ),
    );
    win.webContents.send('clashfox:settingsUpdated', settings);
  } catch {
    // ignore settings push failures for auxiliary windows
  }
}

function emitMainToast(message, type = 'info') {
  const text = String(message || '').trim();
  if (!text) {
    return;
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('clashfox:mainToast', { message: text, type });
  }
}

function emitMainCoreAction(payload = {}) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('clashfox:mainCoreAction', payload);
  }
}

function detectInstallPhaseFromLine(line = '') {
  const text = String(line || '').trim();
  if (!text) return null;
  const lower = text.toLowerCase();
  if (
    lower.includes('download')
    || lower.includes('fetch')
    || lower.includes('wget')
    || text.includes('下载')
  ) {
    return { phase: 'downloading', message: 'Downloading kernel package...' };
  }
  if (
    lower.includes('extract')
    || lower.includes('unzip')
    || lower.includes('untar')
    || text.includes('解压')
  ) {
    return { phase: 'extracting', message: 'Extracting package...' };
  }
  if (
    lower.includes('install')
    || lower.includes('update')
    || lower.includes('replace')
    || text.includes('安装')
    || text.includes('更新')
  ) {
    return { phase: 'installing', message: 'Installing / updating kernel...' };
  }
  return null;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getTrayRestartTransitionDelayMs() {
  const estimate = Number.isFinite(trayCoreStartupEstimateMs) ? trayCoreStartupEstimateMs : 1500;
  return clamp(
    Math.round(estimate * RESTART_TRANSITION_RATIO),
    RESTART_TRANSITION_MIN_MS,
    RESTART_TRANSITION_MAX_MS,
  );
}

function updateTrayCoreStartupEstimate(measuredMs) {
  if (!Number.isFinite(measuredMs) || measuredMs <= 0) {
    return;
  }
  const safeMeasured = clamp(Math.round(measuredMs), CORE_STARTUP_ESTIMATE_MIN_MS, CORE_STARTUP_ESTIMATE_MAX_MS);
  const previous = Number.isFinite(trayCoreStartupEstimateMs) ? trayCoreStartupEstimateMs : safeMeasured;
  trayCoreStartupEstimateMs = clamp(
    Math.round(previous * 0.65 + safeMeasured * 0.35),
    CORE_STARTUP_ESTIMATE_MIN_MS,
    CORE_STARTUP_ESTIMATE_MAX_MS,
  );
}

async function getKernelRunningSilently(sudoPass = '') {
  try {
    const response = await runBridge(['status'], { sudoPass });
    if (response && response.ok) {
      const running = Boolean(response.data && response.data.running);
      if (running) {
        return true;
      }
    }
    const overview = await runBridge(['overview'], { sudoPass });
    if (overview && overview.ok) {
      return Boolean(overview.data && overview.data.running);
    }
    return null;
  } catch {
    return null;
  }
}

async function waitForKernelRunningFromTray(sudoPass = '', timeoutMs = 12000, intervalMs = 350) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() <= deadline) {
    const running = await getKernelRunningSilently(sudoPass);
    if (running === null) {
      return false;
    }
    if (running) {
      return true;
    }
    await sleep(intervalMs);
  }
  return false;
}

async function readSystemProxyEnabledSnapshot(configPath = '') {
  const settings = readAppSettings();
  const expectedPort = String(
    settings && Object.prototype.hasOwnProperty.call(settings, 'port')
      ? settings.port
      : '',
  ).trim();
  const statusArgs = ['system-proxy-status'];
  if (configPath) {
    statusArgs.push('--config', configPath);
  }
  if (expectedPort) {
    statusArgs.push('--port', expectedPort);
  }
  const statusResp = await runBridge(statusArgs);
  if (!(statusResp && statusResp.ok && statusResp.data)) {
    return { ok: false, enabled: null };
  }
  return {
    ok: true,
    enabled: Boolean(
      Object.prototype.hasOwnProperty.call(statusResp.data, 'enabled')
        ? statusResp.data.enabled
        : false,
    ),
  };
}

async function waitForSystemProxyEnabledState(targetEnabled, configPath = '', timeoutMs = 1000, intervalMs = 160) {
  const expected = Boolean(targetEnabled);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() <= deadline) {
    const snapshot = await readSystemProxyEnabledSnapshot(configPath);
    if (snapshot.ok && snapshot.enabled === expected) {
      return snapshot;
    }
    await sleep(intervalMs);
  }
  return readSystemProxyEnabledSnapshot(configPath);
}

function resolveSystemProxyEnabledFromPayload(payload = null) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }
  const toBool = (value) => value === true || value === 'true' || value === 1 || value === '1';
  const data = (payload && payload.data && typeof payload.data === 'object')
    ? payload.data
    : payload;
  const hasAnyEnabled = Object.prototype.hasOwnProperty.call(data, 'anyEnabled');
  const hasMatchesDesired = Object.prototype.hasOwnProperty.call(data, 'matchesDesired');
  const hasManagedByHelper = Object.prototype.hasOwnProperty.call(data, 'managedByHelper');
  if (hasAnyEnabled || hasMatchesDesired || hasManagedByHelper) {
    return toBool(data.anyEnabled) && toBool(data.matchesDesired) && toBool(data.managedByHelper);
  }
  if (Object.prototype.hasOwnProperty.call(data, 'enabled')) {
    return toBool(data.enabled);
  }
  if (Object.prototype.hasOwnProperty.call(data, 'enable')) {
    return toBool(data.enable);
  }
  return null;
}

function resolveControllerAccessFromSettings(controllerOverride = '', secretOverride = '') {
  const settings = readAppSettings();
  const controllerRaw = settings && Object.prototype.hasOwnProperty.call(settings, 'externalController')
    ? String(settings.externalController || '').trim()
    : '';
  const secretRaw = settings && Object.prototype.hasOwnProperty.call(settings, 'secret')
    ? String(settings.secret || '').trim()
    : '';
  const controller = String(controllerOverride || '').trim() || controllerRaw || '127.0.0.1:9090';
  const baseUrl = /^https?:\/\//i.test(controller) ? controller : `http://${controller}`;
  return {
    baseUrl: String(baseUrl || '').replace(/\/+$/, ''),
    secret: String(secretOverride || '').trim() || secretRaw || 'clashfox',
  };
}

async function runControllerConfigRequestMain(source = {}, candidates = []) {
  try {
    const normalizedSource = source && typeof source === 'object' ? source : {};
    const controllerOverride = String(
      normalizedSource.controller || normalizedSource.externalController || '',
    ).trim();
    const secretOverride = String(normalizedSource.secret || '').trim();
    const { baseUrl, secret } = resolveControllerAccessFromSettings(controllerOverride, secretOverride);
    if (!baseUrl) {
      return { ok: false, error: 'controller_missing' };
    }
    let lastError = { ok: false, error: 'request_failed' };
    for (const candidate of Array.isArray(candidates) ? candidates : []) {
      const headers = candidate && candidate.headers && typeof candidate.headers === 'object'
        ? { ...candidate.headers }
        : {};
      if (secret) {
        headers.Authorization = `Bearer ${secret}`;
      }
      const requestUrl = `${baseUrl}${candidate.path || '/configs'}`;
      const requestId = `main-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const kind = resolveMihomoRequestKind(candidate.method || 'GET', requestUrl);
      const logHeaders = { ...headers };
      if (Object.prototype.hasOwnProperty.call(logHeaders, 'Authorization')) {
        logHeaders.Authorization = '[redacted]';
      }
      if (!shouldSuppressMihomoRequestLog(candidate.method || 'GET', requestUrl, 'log', true)) {
        guiMainLog('mihomo-api', 'request', {
          requestId,
          kind,
          method: candidate.method || 'GET',
          url: requestUrl,
          headers: logHeaders,
          body: truncateLogPayload(candidate.body === undefined ? '' : JSON.stringify(candidate.body)),
        });
      }
      try {
        const resp = await fetch(requestUrl, {
          method: candidate.method || 'GET',
          headers,
          body: candidate.body === undefined ? undefined : JSON.stringify(candidate.body),
        });
        if (resp.ok) {
          if (!shouldSuppressMihomoRequestLog(candidate.method || 'GET', requestUrl, 'log', true)) {
            guiMainLog('mihomo-api', 'response', {
              requestId,
              kind,
              method: candidate.method || 'GET',
              url: requestUrl,
              ok: true,
              status: resp.status,
            });
          }
          return { ok: true };
        }
        const details = (await resp.text().catch(() => '')) || `http_status=${resp.status}`;
        guiMainLog('mihomo-api', 'response', {
          requestId,
          kind,
          method: candidate.method || 'GET',
          url: requestUrl,
          ok: false,
          status: resp.status,
          details: truncateLogPayload(details),
        }, 'warn');
        lastError = { ok: false, error: 'request_failed', details };
      } catch (error) {
        guiMainLog('mihomo-api', 'response', {
          requestId,
          kind,
          method: candidate.method || 'GET',
          url: requestUrl,
          ok: false,
          error: truncateLogPayload(String((error && error.message) || error || 'request_failed')),
        }, 'warn');
        lastError = {
          ok: false,
          error: 'request_failed',
          details: String((error && error.message) || error || 'request_failed'),
        };
      }
    }
    return lastError;
  } catch (error) {
    return {
      ok: false,
      error: 'request_failed',
      details: String((error && error.message) || error || 'request_failed'),
    };
  }
}

async function getControllerConfigsMain(source = {}) {
  const requestId = `main-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const kind = 'auto';
  try {
    const normalizedSource = source && typeof source === 'object' ? source : {};
    const controllerOverride = String(
      normalizedSource.controller || normalizedSource.externalController || '',
    ).trim();
    const secretOverride = String(normalizedSource.secret || '').trim();
    const { baseUrl, secret } = resolveControllerAccessFromSettings(controllerOverride, secretOverride);
    if (!baseUrl) {
      return { ok: false, error: 'controller_missing' };
    }
    const headers = {};
    if (secret) {
      headers.Authorization = `Bearer ${secret}`;
    }
    const requestUrl = `${baseUrl}/configs`;
    const logHeaders = { ...headers };
    if (Object.prototype.hasOwnProperty.call(logHeaders, 'Authorization')) {
      logHeaders.Authorization = '[redacted]';
    }
    if (!shouldSuppressMihomoRequestLog('GET', requestUrl, 'log', true)) {
      guiMainLog('mihomo-api', 'request', {
        requestId,
        kind,
        method: 'GET',
        url: requestUrl,
        headers: logHeaders,
        body: '',
      });
    }
    const resp = await fetch(requestUrl, {
      method: 'GET',
      headers,
    });
    if (!resp.ok) {
      const details = (await resp.text().catch(() => '')) || `http_status=${resp.status}`;
      guiMainLog('mihomo-api', 'response', {
        requestId,
        method: 'GET',
        url: requestUrl,
        ok: false,
        status: resp.status,
        details: truncateLogPayload(details),
      }, 'warn');
      return { ok: false, error: 'request_failed', details };
    }
    const data = await resp.json();
    if (!shouldSuppressMihomoRequestLog('GET', requestUrl, 'log', true)) {
      guiMainLog('mihomo-api', 'response', {
        requestId,
        kind,
        method: 'GET',
        url: requestUrl,
        ok: true,
        status: resp.status,
        data: truncateLogPayload(JSON.stringify(data)),
      });
    }
    return { ok: true, data };
  } catch (error) {
    guiMainLog('mihomo-api', 'response', {
      requestId,
      kind,
      method: 'GET',
      url: 'unknown',
      ok: false,
      error: truncateLogPayload(String((error && error.message) || error || 'request_failed')),
    }, 'warn');
    return {
      ok: false,
      error: 'request_failed',
      details: String((error && error.message) || error || 'request_failed'),
    };
  }
}

async function getControllerVersionMain(source = {}) {
  const requestId = `main-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const kind = 'manual';
  try {
    const normalizedSource = source && typeof source === 'object' ? source : {};
    const controllerOverride = String(
      normalizedSource.controller || normalizedSource.externalController || '',
    ).trim();
    const secretOverride = String(normalizedSource.secret || '').trim();
    const { baseUrl, secret } = resolveControllerAccessFromSettings(controllerOverride, secretOverride);
    if (!baseUrl) {
      return { ok: false, error: 'controller_missing' };
    }
    const headers = {};
    if (secret) {
      headers.Authorization = `Bearer ${secret}`;
    }
    const requestUrl = `${baseUrl}/version`;
    const logHeaders = { ...headers };
    if (Object.prototype.hasOwnProperty.call(logHeaders, 'Authorization')) {
      logHeaders.Authorization = '[redacted]';
    }
    guiMainLog('mihomo-api', 'request', {
      requestId,
      kind,
      method: 'GET',
      url: requestUrl,
      headers: logHeaders,
    });
    const resp = await fetch(requestUrl, { method: 'GET', headers });
    if (!resp.ok) {
      const details = (await resp.text().catch(() => '')) || `http_status=${resp.status}`;
      guiMainLog('mihomo-api', 'response', {
        requestId,
        kind,
        method: 'GET',
        url: requestUrl,
        ok: false,
        status: resp.status,
        details: truncateLogPayload(details),
      }, 'warn');
      return { ok: false, error: 'request_failed', details };
    }
    const data = await resp.json().catch(() => ({}));
    guiMainLog('mihomo-api', 'response', {
      requestId,
      kind,
      method: 'GET',
      url: requestUrl,
      ok: true,
      status: resp.status,
      data: truncateLogPayload(JSON.stringify(data)),
    });
    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      error: 'request_failed',
      details: String((error && error.message) || error || 'request_failed'),
    };
  }
}

async function updateMihomoConfigMain(patch = {}, source = {}) {
  const configPatch = patch && typeof patch === 'object' && !Array.isArray(patch) ? patch : {};
  if (!Object.keys(configPatch).length) {
    return { ok: false, error: 'invalid_config_patch' };
  }
  return runControllerConfigRequestMain(source, [
    {
      method: 'PATCH',
      path: '/configs',
      headers: { 'Content-Type': 'application/json' },
      body: configPatch,
    },
    {
      method: 'PUT',
      path: '/configs',
      headers: { 'Content-Type': 'application/json' },
      body: configPatch,
    },
  ]);
}

async function updateMihomoProxySelectionMain(groupName = '', proxyName = '', source = {}) {
  const group = String(groupName || '').trim();
  const proxy = String(proxyName || '').trim();
  if (!group || !proxy) {
    return { ok: false, error: 'invalid_proxy_selection' };
  }
  return runControllerConfigRequestMain(source, [
    {
      method: 'PUT',
      path: `/proxies/${encodeURIComponent(group)}`,
      headers: { 'Content-Type': 'application/json' },
      body: { name: proxy },
    },
    {
      method: 'PATCH',
      path: `/proxies/${encodeURIComponent(group)}`,
      headers: { 'Content-Type': 'application/json' },
      body: { name: proxy },
    },
  ]);
}

function detectTunConflictLikely() {
  const safeRun = (bin, args = []) => {
    try {
      const result = spawnSync(bin, args, { encoding: 'utf8', timeout: 1800 });
      return String((result && result.stdout) || '').trim();
    } catch {
      return '';
    }
  };

  const ifacesRaw = safeRun('/sbin/ifconfig', ['-l']);
  const ifaceList = ifacesRaw ? ifacesRaw.split(/\s+/).filter(Boolean) : [];
  const utuns = ifaceList.filter((item) => String(item).startsWith('utun'));

  const routeRaw = safeRun('/usr/sbin/route', ['get', 'default']);
  const ifaceMatch = routeRaw.match(/interface:\s+([^\s]+)/i);
  const defaultInterface = ifaceMatch ? String(ifaceMatch[1] || '').trim() : '';

  const psRaw = safeRun('/bin/ps', ['-axo', 'comm']);
  const processLines = psRaw
    .split(/\r?\n/)
    .map((line) => String(line || '').trim().toLowerCase())
    .filter(Boolean);
  const tunKeywords = [
    'clash',
    'surge',
    'sing-box',
    'v2ray',
    'xray',
    'wireguard',
    'tailscale',
    'protonvpn',
    'warp',
    'openvpn',
  ];
  const hitProcesses = processLines.filter((line) => tunKeywords.some((kw) => line.includes(kw)));

  const defaultUtun = defaultInterface.startsWith('utun');
  const conflictLikely = defaultUtun || (utuns.length >= 2 && hitProcesses.length > 0) || utuns.length >= 4;
  return {
    ok: true,
    data: {
      conflictLikely,
      utunCount: utuns.length,
      defaultInterface: defaultInterface || '-',
      processHits: hitProcesses.slice(0, 8),
    },
  };
}

async function runTrayCommand(command, args = [], labels = TRAY_I18N.en, sudoPass = '') {
  let effectiveSudoPass = sudoPass || '';
  let result = await runBridgeWithAutoAuth(command, args, { sudoPass: effectiveSudoPass });
  if (!result || !result.ok) {
    if (result && result.error === 'sudo_required') {
      await dialog.showMessageBox({
        type: 'warning',
        buttons: [labels.ok || 'OK'],
        title: labels.errorTitle || 'Operation Cancelled',
        message: labels.sudoRequired || 'Administrator authorization was not granted.',
      });
      return { ok: false };
    }
    if (result && result.error === 'sudo_invalid') {
      await dialog.showMessageBox({
        type: 'error',
        buttons: [labels.ok || 'OK'],
        title: labels.errorTitle || 'Operation Failed',
        message: labels.sudoInvalid || 'Password incorrect.',
      });
      return { ok: false };
    }
    const message = (result && (result.details || result.error || result.message))
      ? String(result.details || result.error || result.message)
      : 'Unknown error';
    await dialog.showMessageBox({
      type: 'error',
      buttons: [labels.ok || 'OK'],
      title: labels.errorTitle || 'Operation Failed',
      message: `${labels.commandFailed || 'Command failed'}: ${command}`,
      detail: message,
    });
    return { ok: false };
  }
  return { ok: true, sudoPass: effectiveSudoPass, result };
}

async function confirmTrayRestart(labels) {
  const response = await dialog.showMessageBox({
    type: 'warning',
    buttons: [labels.cancel || 'Cancel', labels.restartKernel],
    defaultId: 1,
    cancelId: 0,
    message: labels.restartKernel,
    detail: labels.restartConfirm || 'Are you sure you want to restart the kernel?',
  });
  return response.response === 1;
}

async function getKernelRunning(labels) {
  const result = await runBridgeWithAutoAuth('status');
  if (result && result.ok) {
    return { running: Boolean(result.data && result.data.running), sudoPass: '' };
  }
  const message = (result && (result.error || result.message)) ? String(result.error || result.message) : 'Unknown error';
  await dialog.showMessageBox({
    type: 'error',
    buttons: [labels.ok || 'OK'],
    title: labels.errorTitle || 'Operation Failed',
    message: `${labels.commandFailed || 'Command failed'}: status`,
    detail: message,
  });
  return null;
}

function showMainWindow() {
  persistMainWindowClosedToSettings(false);
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (app.dock && app.dock.isVisible && !app.dock.isVisible()) {
      app.dock.show();
    }
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.show();
    mainWindow.focus();
    return;
  }
  createWindow(true);
}

function openMainPage(page) {
  showMainWindow();
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }
  const sendNavigate = () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return;
    }
    mainWindow.webContents.send('clashfox:mainNavigate', { page });
  };
  if (mainWindow.webContents.isLoadingMainFrame()) {
    mainWindow.webContents.once('did-finish-load', sendNavigate);
    return;
  }
  sendNavigate();
}

function openDashboardPanel() {
  try {
    const settings = readAppSettings();
    const panel = (settings && settings.panelChoice) ? String(settings.panelChoice) : 'zashboard';
    let controller = (settings && settings.externalController) ? String(settings.externalController).trim() : '127.0.0.1:9090';
    const secret = (settings && settings.secret) ? String(settings.secret).trim() : 'clashfox';
    if (!/^https?:\/\//.test(controller)) {
      controller = `http://${controller}`;
    }
    controller = controller.replace(/\/+$/, '');
    const dashboardUrl = new URL(`${controller}/ui/${panel}/`);
    if (secret) {
      // Different dashboards use different query keys; set both for compatibility.
      dashboardUrl.searchParams.set('token', secret);
      dashboardUrl.searchParams.set('secret', secret);
    }
    dashboardUrl.searchParams.set('_ts', String(Date.now()));
    const url = dashboardUrl.toString();
    if (dashboardWindow && !dashboardWindow.isDestroyed()) {
      dashboardWindow.show();
      dashboardWindow.focus();
      dashboardWindow.loadURL(url);
      return;
    }

    dashboardWindow = new BrowserWindow({
      width: 1280,
      height: 820,
      minWidth: 960,
      minHeight: 640,
      alwaysOnTop: false,
      backgroundColor: '#0f1216',
      autoHideMenuBar: true,
      title: 'ClashFox Dashboard',
      webPreferences: {
        contextIsolation: true,
        devTools: false,
      },
    });

    dashboardWindow.on('closed', () => {
      dashboardWindow = null;
    });
    dashboardWindow.on('blur', () => {
      if (dashboardWindow && !dashboardWindow.isDestroyed()) {
        dashboardWindow.setAlwaysOnTop(false);
      }
    });
    dashboardWindow.webContents.on('before-input-event', (event, input) => {
      const key = String(input.key || '').toLowerCase();
      const isDevToolsCombo =
        (input.control && input.shift && key === 'i') ||
        (input.meta && input.alt && key === 'i') ||
        key === 'f12';
      if (isDevToolsCombo) {
        event.preventDefault();
      }
    });

    dashboardWindow.loadURL(url);
  } catch (err) {
    // keep tray-only flow stable; do not reopen main window on panel failure
  }
}

function clampWorldwideNumber(value, min, max, fallback) {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, parsed));
}

function isPublicTrackIpV4(value = '') {
  const ip = String(value || '').trim();
  if (!ip || net.isIP(ip) !== 4) {
    return false;
  }
  const parts = ip.split('.').map((item) => Number.parseInt(item, 10));
  if (parts.some((item) => !Number.isFinite(item) || item < 0 || item > 255)) {
    return false;
  }
  const [a, b] = parts;
  if (a === 10 || a === 127 || a === 0) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  if (a >= 224) return false;
  return true;
}

function isPublicTrackIp(value = '') {
  const ip = String(value || '').trim();
  const family = net.isIP(ip);
  if (!family) {
    return false;
  }
  if (family === 4) {
    return isPublicTrackIpV4(ip);
  }
  const text = ip.toLowerCase();
  if (text === '::1' || text.startsWith('fe80:') || text.startsWith('fc') || text.startsWith('fd')) {
    return false;
  }
  return true;
}

function getCachedEntry(cache = new Map(), key = '', ttlMs = 0) {
  if (!key || !cache.has(key)) {
    return null;
  }
  const entry = cache.get(key);
  if (!entry || !Number.isFinite(entry.expiresAt) || entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function setCachedEntry(cache = new Map(), key = '', value = null, ttlMs = 0) {
  if (!key) {
    return;
  }
  cache.set(key, {
    value,
    expiresAt: Date.now() + Math.max(1000, Number(ttlMs || 0)),
  });
}

function resolveWorldwideMmdbPath(fileName = '') {
  const name = String(fileName || '').trim();
  if (!name) return '';
  const candidates = app.isPackaged
    ? [
      path.join(process.resourcesPath || '', name),
      path.join(process.resourcesPath || '', 'geoip', name),
      path.join(APP_PATH, 'static', 'geoip', name),
      path.join(APP_PATH, 'static', name),
      path.join(ROOT_DIR, 'static', 'geoip', name),
      path.join(ROOT_DIR, 'static', name),
    ]
    : [
      path.join(ROOT_DIR, 'static', 'geoip', name),
      path.join(ROOT_DIR, 'static', name),
      path.join(APP_PATH, 'static', 'geoip', name),
      path.join(APP_PATH, 'static', name),
      path.join(process.resourcesPath || '', 'geoip', name),
      path.join(process.resourcesPath || '', name),
    ];
  return candidates.find((candidate) => candidate && fs.existsSync(candidate)) || '';
}

function resolveCountryCentroid(countryCode = '') {
  const code = String(countryCode || '').trim().toUpperCase();
  if (!code) return null;
  const known = {
    US: [39.5, -98.35], CN: [35.0, 103.8], JP: [36.2, 138.3], KR: [36.4, 127.9], TW: [23.7, 121.0],
    HK: [22.3, 114.2], SG: [1.35, 103.8], IN: [22.6, 79.0], RU: [61.5, 105.3], DE: [51.2, 10.4],
    FR: [46.3, 2.2], GB: [54.2, -2.8], NL: [52.2, 5.3], IT: [41.9, 12.7], ES: [40.3, -3.7],
    CH: [46.8, 8.3], SE: [62.1, 15.2], NO: [60.4, 8.5], FI: [64.3, 26.0], PL: [52.1, 19.4],
    CZ: [49.8, 15.5], AT: [47.6, 14.1], IE: [53.4, -8.1], DK: [56.1, 10.0], BE: [50.8, 4.5],
    AU: [-25.3, 133.8], NZ: [-41.3, 174.8], CA: [56.1, -106.3], BR: [-14.2, -51.9], MX: [23.6, -102.5],
    AR: [-34.6, -64.0], CL: [-35.7, -71.5], ZA: [-30.6, 22.9], AE: [24.4, 54.4], SA: [24.0, 45.0],
    TR: [39.0, 35.2], IL: [31.0, 35.0], TH: [15.9, 101.0], VN: [16.2, 107.9], MY: [4.2, 101.9],
    ID: [-2.6, 118.0], PH: [12.8, 121.8], PK: [30.4, 69.3], UA: [49.0, 31.3], RO: [45.9, 24.9],
  };
  if (Object.prototype.hasOwnProperty.call(known, code)) {
    return { lat: known[code][0], lon: known[code][1] };
  }
  let hash = 0;
  for (let i = 0; i < code.length; i += 1) {
    hash = ((hash << 5) - hash) + code.charCodeAt(i);
    hash |= 0;
  }
  const positive = Math.abs(hash);
  const lat = ((positive % 11500) / 100) - 55; // [-55, 60)
  const lon = ((Math.floor(positive / 11500) % 34000) / 100) - 170; // [-170, 170)
  return { lat, lon };
}

function getWorldwideReaders() {
  if (!maxmindModule) {
    if (maxmindModuleError) {
      throw maxmindModuleError;
    }
    try {
      // Load geo DB reader on demand so a packaging miss cannot crash app startup.
      maxmindModule = require('maxmind');
    } catch (error) {
      maxmindModuleError = error || new Error('maxmind_load_failed');
      throw maxmindModuleError;
    }
  }
  if (!worldwideCityReader) {
    const cityPath = resolveWorldwideMmdbPath('GeoLite2-City.mmdb');
    if (!cityPath) {
      throw new Error('city_mmdb_missing');
    }
    worldwideCityReader = new maxmindModule.Reader(fs.readFileSync(cityPath));
  }
  if (!worldwideCountryReader) {
    const countryPath = resolveWorldwideMmdbPath('GeoLite2-Country.mmdb');
    if (!countryPath) {
      throw new Error('country_mmdb_missing');
    }
    worldwideCountryReader = new maxmindModule.Reader(fs.readFileSync(countryPath));
  }
  return {
    cityReader: worldwideCityReader,
    countryReader: worldwideCountryReader,
  };
}

function lookupGeoFromMmdb(ip = '') {
  const target = String(ip || '').trim();
  if (!isPublicTrackIp(target)) {
    return null;
  }
  const cacheKey = target;
  const cached = getCachedEntry(worldwideGeoCache, cacheKey, WORLDWIDE_GEO_CACHE_TTL_MS);
  if (cached) {
    return cached;
  }
  let cityRecord = null;
  let countryRecord = null;
  try {
    const readers = getWorldwideReaders();
    cityRecord = readers.cityReader.get(target);
    countryRecord = readers.countryReader.get(target);
  } catch {
    return null;
  }
  if (!cityRecord && !countryRecord) {
    return null;
  }
  const location = cityRecord && cityRecord.location && typeof cityRecord.location === 'object'
    ? cityRecord.location
    : {};
  const countryNode = (cityRecord && cityRecord.country) || (countryRecord && countryRecord.country) || {};
  const cityNode = (cityRecord && cityRecord.city) || {};
  const countryNames = countryNode && countryNode.names && typeof countryNode.names === 'object'
    ? countryNode.names
    : {};
  const cityNames = cityNode && cityNode.names && typeof cityNode.names === 'object'
    ? cityNode.names
    : {};
  const fallback = resolveCountryCentroid(String(countryNode.iso_code || '').trim());
  const geo = {
    ip: target,
    lat: Number.isFinite(Number(location.latitude)) ? Number(location.latitude) : Number(fallback && fallback.lat),
    lon: Number.isFinite(Number(location.longitude)) ? Number(location.longitude) : Number(fallback && fallback.lon),
    city: String(cityNames.en || cityNames['zh-CN'] || cityNames.zh || '').trim(),
    country: String(countryNames.en || countryNames['zh-CN'] || countryNames.zh || '').trim(),
    countryCode: String(countryNode.iso_code || '').trim(),
  };
  if (!Number.isFinite(geo.lat) || !Number.isFinite(geo.lon)) {
    return null;
  }
  setCachedEntry(worldwideGeoCache, cacheKey, geo, WORLDWIDE_GEO_CACHE_TTL_MS);
  return geo;
}

async function resolveTrackIp(track = {}) {
  const fromIp = String(track.ip || '').trim();
  if (isPublicTrackIp(fromIp)) {
    return fromIp;
  }
  const host = String(track.host || '').trim();
  if (!host) {
    return '';
  }
  if (isPublicTrackIp(host) && net.isIP(host) === 4) {
    return host;
  }

  const cached = getCachedEntry(worldwideDnsCache, host, WORLDWIDE_DNS_CACHE_TTL_MS);
  if (cached) {
    return String(cached || '');
  }
  if (!dnsLookupAsync) {
    return '';
  }
  try {
    const resolved = await dnsLookupAsync(host, { family: 4, all: false });
    const address = resolved && typeof resolved === 'object' ? String(resolved.address || '').trim() : '';
    if (isPublicTrackIpV4(address)) {
      setCachedEntry(worldwideDnsCache, host, address, WORLDWIDE_DNS_CACHE_TTL_MS);
      return address;
    }
  } catch {
    // ignore
  }
  return '';
}

async function resolveSelfGeoPoint() {
  if (worldwideSelfGeoCache.data && Number(worldwideSelfGeoCache.expiresAt || 0) > Date.now()) {
    return worldwideSelfGeoCache.data;
  }
  let geo = null;
  try {
    const overview = await runBridgeWithAutoAuth('overview');
    const internetIp = overview && overview.ok && overview.data
      ? String(overview.data.internetIp || overview.data.internetIp4 || '').trim()
      : '';
    if (isPublicTrackIp(internetIp)) {
      geo = lookupGeoFromMmdb(internetIp);
    }
  } catch {
    geo = null;
  }
  worldwideSelfGeoCache = {
    expiresAt: Date.now() + WORLDWIDE_SELF_GEO_TTL_MS,
    data: geo,
  };
  return geo;
}

async function buildWorldwideSnapshot(options = {}) {
  const limit = clampWorldwideNumber(options.limit, 60, 1000, WORLDWIDE_TRACK_LIMIT);
  const maxPoints = clampWorldwideNumber(options.maxPoints, 20, 200, WORLDWIDE_MAX_POINTS);
  const commandResult = await runBridgeWithAutoAuth('track-connections', ['--limit', String(limit)]);
  if (!commandResult || !commandResult.ok) {
    return {
      ok: false,
      error: commandResult ? String(commandResult.error || 'track_failed') : 'track_failed',
      details: commandResult ? String(commandResult.details || '') : '',
    };
  }

  const payload = (commandResult.data && typeof commandResult.data === 'object') ? commandResult.data : {};
  const rawTracks = Array.isArray(payload.tracks) ? payload.tracks : [];
  const dedup = new Map();
  for (const item of rawTracks) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const host = String(item.host || '').trim();
    const ip = String(item.ip || '').trim();
    const outbound = String(item.outbound || 'DIRECT').trim() || 'DIRECT';
    if (!host && !ip) {
      continue;
    }
    const key = `${ip}|${host}|${outbound}`;
    const prev = dedup.get(key);
    if (prev) {
      prev.count += 1;
      prev.download += Number(item.download || 0);
      prev.upload += Number(item.upload || 0);
    } else {
      dedup.set(key, {
        ip,
        host,
        outbound,
        count: 1,
        download: Number(item.download || 0),
        upload: Number(item.upload || 0),
      });
    }
  }

  const dedupedTracks = Array.from(dedup.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, Math.max(maxPoints * 3, WORLDWIDE_FILTER_TOP_TRACKS));

  const resolvedTracks = [];
  for (const item of dedupedTracks) {
    const ip = await resolveTrackIp(item);
    if (!ip) {
      continue;
    }
    const geo = lookupGeoFromMmdb(ip);
    if (!geo || !Number.isFinite(Number(geo.lat)) || !Number.isFinite(Number(geo.lon))) {
      continue;
    }
    resolvedTracks.push({
      ...item,
      ip,
      lat: Number(geo.lat),
      lon: Number(geo.lon),
      city: String(geo.city || '').trim(),
      country: String(geo.country || '').trim(),
      countryCode: String(geo.countryCode || '').trim(),
    });
  }

  const pointMap = new Map();
  for (const item of resolvedTracks) {
    const locationKey = `${item.lat.toFixed(3)},${item.lon.toFixed(3)}`;
    const existing = pointMap.get(locationKey);
    if (existing) {
      existing.count += item.count;
      existing.download += item.download;
      existing.upload += item.upload;
      if (!existing.city && item.city) existing.city = item.city;
      if (!existing.country && item.country) existing.country = item.country;
      existing.outboundSet.add(item.outbound || 'DIRECT');
      if (item.host) {
        existing.hosts.add(item.host);
      }
      if (item.ip) {
        existing.ips.add(item.ip);
      }
      continue;
    }
    pointMap.set(locationKey, {
      key: locationKey,
      lat: item.lat,
      lon: item.lon,
      city: item.city,
      country: item.country,
      countryCode: item.countryCode,
      count: item.count,
      download: item.download,
      upload: item.upload,
      outboundSet: new Set([item.outbound || 'DIRECT']),
      hosts: new Set(item.host ? [item.host] : []),
      ips: new Set(item.ip ? [item.ip] : []),
    });
  }

  const points = Array.from(pointMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, maxPoints)
    .map((point) => ({
      key: point.key,
      lat: point.lat,
      lon: point.lon,
      city: point.city,
      country: point.country,
      countryCode: point.countryCode,
      count: point.count,
      download: point.download,
      upload: point.upload,
      outbounds: Array.from(point.outboundSet).filter(Boolean).slice(0, 6),
      hostSamples: Array.from(point.hosts).filter(Boolean).slice(0, 6),
      ipSamples: Array.from(point.ips).filter(Boolean).slice(0, 6),
    }));

  const allOutbounds = Array.from(new Set(
    resolvedTracks.map((item) => String(item.outbound || 'DIRECT').trim() || 'DIRECT'),
  )).sort((a, b) => a.localeCompare(b));
  const allCountries = Array.from(new Set(
    resolvedTracks.map((item) => String(item.country || '').trim()).filter(Boolean),
  )).sort((a, b) => a.localeCompare(b));
  const allCities = Array.from(new Set(
    resolvedTracks.map((item) => String(item.city || '').trim()).filter(Boolean),
  )).sort((a, b) => a.localeCompare(b));

  const self = await resolveSelfGeoPoint();
  return {
    ok: true,
    data: {
      generatedAt: Date.now(),
      local: self || null,
      points,
      stats: {
        totalConnections: Number(payload.total || rawTracks.length || 0),
        sampledConnections: rawTracks.length,
        dedupedConnections: dedupedTracks.length,
        renderedPoints: points.length,
      },
      filters: {
        outbounds: allOutbounds,
        countries: allCountries,
        cities: allCities,
      },
      mmdb: {
        city: resolveWorldwideMmdbPath('GeoLite2-City.mmdb'),
        country: resolveWorldwideMmdbPath('GeoLite2-Country.mmdb'),
      },
    },
  };
}

function parseDashboardTimestamp(value = '') {
  const text = String(value || '').trim();
  if (!text) {
    return 0;
  }
  const stamp = Date.parse(text);
  return Number.isFinite(stamp) ? stamp : 0;
}

function trimDashboardState(now = Date.now()) {
  const minAliveAt = now - DASHBOARD_HISTORY_MAX_AGE_MS;
  while (dashboardRecentRequests.length > DASHBOARD_RECENT_LIMIT) {
    dashboardRecentRequests.pop();
  }
  for (let index = dashboardRecentRequests.length - 1; index >= 0; index -= 1) {
    if (Number(dashboardRecentRequests[index].eventAt || 0) < minAliveAt) {
      dashboardRecentRequests.splice(index, 1);
    }
  }
  for (const [host, record] of dashboardDnsRecords.entries()) {
    if (Number(record.lastSeenAt || 0) < minAliveAt) {
      dashboardDnsRecords.delete(host);
    }
  }
}

function buildDashboardConnectionKey(track = {}) {
  return String(track.id || '').trim()
    || [
      String(track.processPath || track.process || '').trim(),
      String(track.sourceIp || '').trim(),
      String(track.sourcePort || '').trim(),
      String(track.host || track.ip || '').trim(),
      String(track.port || '').trim(),
      String(track.outbound || '').trim(),
      String(track.start || '').trim(),
    ].join('|');
}

function normalizeDashboardClientName(track = {}) {
  const processPath = String(track.processPath || '').trim();
  const processName = String(track.process || '').trim();
  const explicit = processName || (processPath ? path.basename(processPath) : '');
  if (explicit) {
    return explicit;
  }
  const host = String(track.host || '').trim();
  if (host) {
    return host;
  }
  return String(track.sourceIp || 'Unknown');
}

function makeDashboardRecord(track = {}, now = Date.now()) {
  const startedAt = parseDashboardTimestamp(track.start) || now;
  const upload = Math.max(0, Number(track.upload || 0));
  const download = Math.max(0, Number(track.download || 0));
  const client = normalizeDashboardClientName(track);
  return {
    key: buildDashboardConnectionKey(track),
    id: String(track.id || '').trim() || String(dashboardEventSeq),
    startedAt,
    firstSeenAt: now,
    lastSeenAt: now,
    client,
    host: String(track.host || '').trim(),
    ip: String(track.ip || '').trim(),
    port: Number(track.port || 0),
    outbound: String(track.outbound || track.rule || 'DIRECT').trim() || 'DIRECT',
    network: String(track.network || track.type || '').trim().toUpperCase(),
    rule: String(track.rule || '').trim(),
    process: String(track.process || '').trim(),
    processPath: String(track.processPath || '').trim(),
    sourceIp: String(track.sourceIp || '').trim(),
    sourcePort: Number(track.sourcePort || 0),
    upload,
    download,
  };
}

function pushDashboardRecentEvent(record = {}, status = 'Active', eventAt = Date.now()) {
  const recentKey = String(record.key || [record.id, record.host || record.ip || '', record.port || '', record.startedAt || ''].join('|')).trim();
  for (let index = dashboardRecentRequests.length - 1; index >= 0; index -= 1) {
    if (String(dashboardRecentRequests[index].recentKey || '').trim() === recentKey) {
      dashboardRecentRequests.splice(index, 1);
    }
  }
  dashboardRecentRequests.unshift({
    eventId: dashboardEventSeq++,
    recentKey,
    status,
    eventAt,
    id: record.id,
    client: record.client,
    host: record.host,
    ip: record.ip,
    port: record.port,
    outbound: record.outbound,
    network: record.network,
    rule: record.rule,
    upload: record.upload,
    download: record.download,
    startedAt: record.startedAt,
    process: record.process,
    processPath: record.processPath,
    sourceIp: record.sourceIp,
    sourcePort: record.sourcePort,
    durationMs: Math.max(0, eventAt - Number(record.startedAt || eventAt)),
  });
}

function updateDashboardDnsRecord(record = {}, now = Date.now()) {
  const host = String(record.host || '').trim();
  if (!host) {
    return;
  }
  const existing = dashboardDnsRecords.get(host);
  if (existing) {
    existing.lastSeenAt = now;
    existing.hits += 1;
    if (!existing.ip && record.ip) existing.ip = record.ip;
    if (record.client) existing.clients.add(record.client);
    if (record.outbound) existing.outbounds.add(record.outbound);
    return;
  }
  dashboardDnsRecords.set(host, {
    host,
    ip: String(record.ip || '').trim(),
    firstSeenAt: now,
    lastSeenAt: now,
    hits: 1,
    clients: new Set(record.client ? [record.client] : []),
    outbounds: new Set(record.outbound ? [record.outbound] : []),
  });
}

async function buildDashboardSnapshot(options = {}) {
  const limit = Math.max(60, Math.min(Number(options.limit) || DASHBOARD_TRACK_LIMIT, 1200));
  const now = Date.now();
  const trackResult = await runBridgeWithAutoAuth('track-connections', ['--limit', String(limit)]);
  if (!trackResult || !trackResult.ok) {
    return {
      ok: false,
      error: trackResult ? String(trackResult.error || 'dashboard_track_failed') : 'dashboard_track_failed',
      details: trackResult ? String(trackResult.details || '') : '',
    };
  }

  const payload = trackResult && trackResult.data && typeof trackResult.data === 'object' ? trackResult.data : {};
  const tracks = Array.isArray(payload.tracks) ? payload.tracks : [];
  const currentKeys = new Set();
  const currentRecords = [];
  for (const track of tracks) {
    if (!track || typeof track !== 'object') {
      continue;
    }
    const nextRecord = makeDashboardRecord(track, now);
    currentKeys.add(nextRecord.key);
    const previous = dashboardActiveConnections.get(nextRecord.key);
    if (!previous) {
      dashboardActiveConnections.set(nextRecord.key, nextRecord);
      pushDashboardRecentEvent(nextRecord, 'Active', now);
      updateDashboardDnsRecord(nextRecord, now);
      currentRecords.push(nextRecord);
      continue;
    }
    previous.lastSeenAt = now;
    previous.upload = nextRecord.upload;
    previous.download = nextRecord.download;
    previous.outbound = nextRecord.outbound || previous.outbound;
    previous.network = nextRecord.network || previous.network;
    previous.rule = nextRecord.rule || previous.rule;
    previous.client = nextRecord.client || previous.client;
    previous.host = nextRecord.host || previous.host;
    previous.ip = nextRecord.ip || previous.ip;
    previous.port = nextRecord.port || previous.port;
    previous.process = nextRecord.process || previous.process;
    previous.processPath = nextRecord.processPath || previous.processPath;
    previous.sourceIp = nextRecord.sourceIp || previous.sourceIp;
    previous.sourcePort = nextRecord.sourcePort || previous.sourcePort;
    updateDashboardDnsRecord(previous, now);
    currentRecords.push({ ...previous });
  }

  for (const [key, previous] of Array.from(dashboardActiveConnections.entries())) {
    if (currentKeys.has(key)) {
      continue;
    }
    const endedAt = now;
    const totalBytes = Number(previous.upload || 0) + Number(previous.download || 0);
    pushDashboardRecentEvent(previous, totalBytes > 0 ? 'Completed' : 'Failed', endedAt);
    dashboardActiveConnections.delete(key);
  }

  trimDashboardState(now);

  let overviewData = {};
  let trafficData = {};
  try {
    const overviewResult = await runBridgeWithAutoAuth('overview', ['--cache-ttl', '2']);
    if (overviewResult && overviewResult.ok && overviewResult.data && typeof overviewResult.data === 'object') {
      overviewData = overviewResult.data;
    }
  } catch {
    overviewData = {};
  }
  try {
    const trafficResult = await runBridgeWithAutoAuth('traffic');
    if (trafficResult && trafficResult.ok && trafficResult.data && typeof trafficResult.data === 'object') {
      trafficData = trafficResult.data;
    }
  } catch {
    trafficData = {};
  }

  const settings = readAppSettings();
  const normalizedDevice = normalizeDeviceSettings(settings && settings.device, overviewData);

  const activeConnections = currentRecords
    .sort((a, b) => Number(b.startedAt || 0) - Number(a.startedAt || 0))
    .slice(0, limit)
    .map((record) => ({
      id: record.id,
      startedAt: record.startedAt,
      client: record.client,
      host: record.host,
      ip: record.ip,
      port: record.port,
      outbound: record.outbound,
      network: record.network,
      rule: record.rule,
      upload: record.upload,
      download: record.download,
      durationMs: Math.max(0, now - Number(record.startedAt || now)),
      sourceIp: record.sourceIp,
      sourcePort: record.sourcePort,
      process: record.process,
      processPath: record.processPath,
      status: 'Active',
    }));

  const recentRequests = dashboardRecentRequests
    .slice(0, DASHBOARD_RECENT_LIMIT)
    .map((item) => ({ ...item }));

  const dnsRecords = Array.from(dashboardDnsRecords.values())
    .sort((a, b) => Number(b.lastSeenAt || 0) - Number(a.lastSeenAt || 0))
    .slice(0, DASHBOARD_DNS_LIMIT)
    .map((record) => ({
      host: record.host,
      ip: record.ip,
      hits: record.hits,
      firstSeenAt: record.firstSeenAt,
      lastSeenAt: record.lastSeenAt,
      clients: Array.from(record.clients).filter(Boolean).slice(0, 6),
      outbounds: Array.from(record.outbounds).filter(Boolean).slice(0, 6),
    }));

  const deviceMap = new Map();
  const localDeviceKey = normalizedDevice.computerName || normalizedDevice.user || 'local-device';
  deviceMap.set(localDeviceKey, {
    id: localDeviceKey,
    name: normalizedDevice.computerName || normalizedDevice.user || 'Current Mac',
    os: normalizedDevice.os || String(overviewData.systemName || '').trim(),
    version: normalizedDevice.version || String(overviewData.systemVersion || '').trim(),
    build: normalizedDevice.build || String(overviewData.systemBuild || '').trim(),
    user: normalizedDevice.user || '',
    userRealName: normalizedDevice.userRealName || '',
    source: 'local',
    connections: activeConnections.length,
    upload: activeConnections.reduce((sum, item) => sum + Number(item.upload || 0), 0),
    download: activeConnections.reduce((sum, item) => sum + Number(item.download || 0), 0),
    endpoints: new Set(activeConnections.map((item) => item.sourceIp).filter(Boolean)),
    clients: new Set(activeConnections.map((item) => item.client).filter(Boolean)),
    lastSeenAt: now,
  });
  for (const item of activeConnections) {
    const endpointKey = String(item.sourceIp || '').trim();
    if (!endpointKey) {
      continue;
    }
    const existing = deviceMap.get(endpointKey) || {
      id: endpointKey,
      name: endpointKey,
      os: '',
      version: '',
      build: '',
      user: '',
      userRealName: '',
      source: 'endpoint',
      connections: 0,
      upload: 0,
      download: 0,
      endpoints: new Set([endpointKey]),
      clients: new Set(),
      lastSeenAt: now,
    };
    existing.connections += 1;
    existing.upload += Number(item.upload || 0);
    existing.download += Number(item.download || 0);
    if (item.client) existing.clients.add(item.client);
    existing.lastSeenAt = now;
    deviceMap.set(endpointKey, existing);
  }
  const devices = Array.from(deviceMap.values())
    .sort((a, b) => {
      if (a.source === 'local' && b.source !== 'local') return -1;
      if (a.source !== 'local' && b.source === 'local') return 1;
      return Number(b.connections || 0) - Number(a.connections || 0);
    })
    .slice(0, DASHBOARD_DEVICES_LIMIT)
    .map((item) => ({
      id: item.id,
      name: item.name,
      os: item.os,
      version: item.version,
      build: item.build,
      user: item.user,
      userRealName: item.userRealName,
      source: item.source,
      connections: item.connections,
      upload: item.upload,
      download: item.download,
      endpoints: Array.from(item.endpoints).filter(Boolean).slice(0, 6),
      clients: Array.from(item.clients).filter(Boolean).slice(0, 8),
      lastSeenAt: item.lastSeenAt,
    }));

  const topClientMap = new Map();
  const topHostMap = new Map();
  for (const item of activeConnections) {
    const clientKey = item.client || 'Unknown';
    const clientEntry = topClientMap.get(clientKey) || { name: clientKey, connections: 0, upload: 0, download: 0, outbounds: new Set() };
    clientEntry.connections += 1;
    clientEntry.upload += Number(item.upload || 0);
    clientEntry.download += Number(item.download || 0);
    if (item.outbound) clientEntry.outbounds.add(item.outbound);
    topClientMap.set(clientKey, clientEntry);

    const hostKey = item.host || item.ip || 'Unknown';
    const hostEntry = topHostMap.get(hostKey) || { name: hostKey, connections: 0, upload: 0, download: 0, clients: new Set() };
    hostEntry.connections += 1;
    hostEntry.upload += Number(item.upload || 0);
    hostEntry.download += Number(item.download || 0);
    if (item.client) hostEntry.clients.add(item.client);
    topHostMap.set(hostKey, hostEntry);
  }

  const topClients = Array.from(topClientMap.values())
    .sort((a, b) => (b.upload + b.download) - (a.upload + a.download))
    .slice(0, DASHBOARD_TOP_LIMIT)
    .map((item) => ({
      name: item.name,
      connections: item.connections,
      upload: item.upload,
      download: item.download,
      outbounds: Array.from(item.outbounds).filter(Boolean).slice(0, 6),
    }));

  const topHosts = Array.from(topHostMap.values())
    .sort((a, b) => (b.upload + b.download) - (a.upload + a.download))
    .slice(0, DASHBOARD_TOP_LIMIT)
    .map((item) => ({
      name: item.name,
      connections: item.connections,
      upload: item.upload,
      download: item.download,
      clients: Array.from(item.clients).filter(Boolean).slice(0, 6),
    }));

  return {
    ok: true,
    data: {
      generatedAt: now,
      summary: {
        activeConnections: activeConnections.length,
        totalConnections: Number(payload.total || activeConnections.length),
        dnsHosts: dnsRecords.length,
        recentRequests: recentRequests.length,
        uploadRate: Number(trafficData.up || trafficData.upload || 0),
        downloadRate: Number(trafficData.down || trafficData.download || 0),
        totalUploadBytes: Number(overviewData.txBytes || 0),
        totalDownloadBytes: Number(overviewData.rxBytes || 0),
      },
      recentRequests,
      activeConnections,
      dnsRecords,
      devices,
      traffic: {
        topClients,
        topHosts,
      },
    },
  };
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
    .filter((record) => {
      if (record.vehicleType === 'FILE') {
        return false;
      }
      return record.total > 0 || record.upload > 0 || record.download > 0 || record.expire > 0;
    })
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

function buildProviderProxyTreeData(rawData = {}) {
  const now = Date.now();
  const records = normalizeProxyProviderRecords(rawData);
  const groupsMap = new Map();
  records.forEach((record) => {
    const vehicleType = record.vehicleType || 'UNKNOWN';
    if (vehicleType !== 'COMPATIBLE') {
      return;
    }
    if (!groupsMap.has(vehicleType)) {
      groupsMap.set(vehicleType, []);
    }
    const providers = groupsMap.get(vehicleType);
    const proxies = Array.isArray(record.proxies) ? record.proxies.map((item, index) => {
      if (typeof item === 'string') {
        return {
          id: `${record.key}:${index}:${item}`,
          name: item,
          type: 'Proxy',
          alive: null,
          delay: null,
        };
      }
      const node = item && typeof item === 'object' ? item : {};
      const proxyName = String(node.name || '').trim() || '-';
      return {
        id: `${record.key}:${index}:${String(node.name || item || '').trim() || 'proxy'}`,
        name: proxyName,
        type: String(node.type || '').trim() || 'Proxy',
        alive: typeof node.alive === 'boolean' ? node.alive : null,
        delay: Number.isFinite(Number(node.history && node.history[0] && node.history[0].delay))
          ? Number(node.history[0].delay)
          : (Number.isFinite(Number(node.delay)) ? Number(node.delay) : null),
        isCurrent: Boolean(record.currentProxy) && proxyName === record.currentProxy,
      };
    }) : [];
    providers.push({
      id: record.key,
      name: record.name,
      vehicleType,
      proxyCount: proxies.length,
      currentProxy: record.currentProxy || '',
      proxies,
    });
  });
  const groups = Array.from(groupsMap.entries())
    .map(([vehicleType, providers]) => ({
      vehicleType,
      providers: providers.sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => a.vehicleType.localeCompare(b.vehicleType));

  const totalProviders = groups.reduce((sum, group) => sum + group.providers.length, 0);
  const totalProxies = groups.reduce(
    (sum, group) => sum + group.providers.reduce((sub, provider) => sub + Number(provider.proxyCount || 0), 0),
    0,
  );
  return {
    generatedAt: now,
    totalProviders,
    totalProxies,
    groups,
  };
}

async function loadProvidersProxiesRaw() {
  const configPath = getConfigPathFromSettings();
  const args = [];
  if (configPath) {
    args.push('--config', configPath);
  }
  args.push(...getControllerArgsFromSettings());
  const response = await runBridgeWithAutoAuth('providers-proxies', args);
  if (!response || !response.ok) {
    return response || { ok: false, error: 'providers_proxies_failed' };
  }
  const payload = response.data && typeof response.data === 'object' ? response.data : {};
  return { ok: true, data: payload };
}

function parseRuleTimestamp(value) {
  const parsed = Number.parseInt(String(value || '').trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }
  return parsed > 10_000_000_000 ? parsed : parsed * 1000;
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

async function loadRulesRaw() {
  const configPath = getConfigPathFromSettings();
  const args = [];
  if (configPath) {
    args.push('--config', configPath);
  }
  args.push(...getControllerArgsFromSettings());
  const response = await runBridgeWithAutoAuth('rules', args);
  if (!response || !response.ok) {
    return response || { ok: false, error: 'rules_failed' };
  }
  const payload = response.data && typeof response.data === 'object' ? response.data : {};
  return { ok: true, data: payload };
}

async function loadRuleProvidersRaw() {
  const configPath = getConfigPathFromSettings();
  const args = [];
  if (configPath) {
    args.push('--config', configPath);
  }
  args.push(...getControllerArgsFromSettings());
  const response = await runBridgeWithAutoAuth('providers-rules', args);
  if (!response || !response.ok) {
    return response || { ok: false, error: 'providers_rules_failed' };
  }
  const payload = response.data && typeof response.data === 'object' ? response.data : {};
  return { ok: true, data: payload };
}

function openWorldwideWindow() {
  try {
    if (worldwideWindow && !worldwideWindow.isDestroyed()) {
      worldwideWindow.show();
      worldwideWindow.focus();
      pushCurrentSettingsToWindow(worldwideWindow);
      return;
    }
    if (worldwidePreloadWindow && !worldwidePreloadWindow.isDestroyed()) {
      worldwideWindow = worldwidePreloadWindow;
      worldwidePreloadWindow = null;
      worldwideWindow.show();
      worldwideWindow.focus();
      pushCurrentSettingsToWindow(worldwideWindow);
      return;
    }
    worldwideWindow = new BrowserWindow({
      width: 1240,
      height: 820,
      minWidth: 900,
      minHeight: 620,
      show: true,
      alwaysOnTop: false,
      backgroundColor: '#0f1216',
      autoHideMenuBar: true,
      title: 'ClashFox Worldwide',
      webPreferences: {
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js'),
        devTools: false,
      },
    });

    const windowRef = worldwideWindow;
    windowRef.on('closed', () => {
      if (worldwideWindow === windowRef) {
        worldwideWindow = null;
      }
      if (worldwidePreloadWindow === windowRef) {
        worldwidePreloadWindow = null;
      }
    });
    windowRef.on('blur', () => {
      if (windowRef && !windowRef.isDestroyed()) {
        windowRef.setAlwaysOnTop(false);
      }
    });
    windowRef.webContents.on('before-input-event', (event, input) => {
      const key = String(input.key || '').toLowerCase();
      const isDevToolsCombo =
        (input.control && input.shift && key === 'i') ||
        (input.meta && input.alt && key === 'i') ||
        key === 'f12';
      if (isDevToolsCombo) {
        event.preventDefault();
      }
    });
    windowRef.webContents.on('did-finish-load', () => {
      pushCurrentSettingsToWindow(windowRef);
    });

    windowRef.loadFile(path.join(APP_PATH, 'src', 'ui', 'html', 'trackers.html'));
  } catch {
    showMainWindow();
  }
}

function openFoxboardWindow() {
  try {
    guiMainLog('foxboard', 'open requested', {
      hasWindow: Boolean(foxboardWindow && !foxboardWindow.isDestroyed()),
      hasPreloadWindow: Boolean(foxboardPreloadWindow && !foxboardPreloadWindow.isDestroyed()),
    });
    if (foxboardWindow && !foxboardWindow.isDestroyed()) {
      foxboardWindow.show();
      foxboardWindow.focus();
      guiMainLog('foxboard', 'focused existing window');
      return;
    }
    if (foxboardPreloadWindow && !foxboardPreloadWindow.isDestroyed()) {
      foxboardWindow = foxboardPreloadWindow;
      foxboardPreloadWindow = null;
      if (!foxboardWindow.__clashfoxKeepAliveBound) {
        foxboardWindow.__clashfoxKeepAliveBound = true;
        foxboardWindow.on('close', (event) => {
          if (isQuitting || !foxboardWindow || foxboardWindow.isDestroyed()) {
            return;
          }
          event.preventDefault();
          if (foxboardWindow && !foxboardWindow.isDestroyed()) {
            foxboardWindow.hide();
          }
        });
      }
      foxboardWindow.show();
      foxboardWindow.focus();
      guiMainLog('foxboard', 'promoted preload window');
      return;
    }
    foxboardWindow = new BrowserWindow({
      width: 1320,
      height: 860,
      minWidth: 980,
      minHeight: 680,
      show: true,
      alwaysOnTop: false,
      backgroundColor: '#0f1216',
      autoHideMenuBar: true,
      title: 'ClashFox Foxboard',
      webPreferences: {
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js'),
        devTools: false,
      },
    });
    const windowRef = foxboardWindow;
    if (!windowRef.__clashfoxKeepAliveBound) {
      windowRef.__clashfoxKeepAliveBound = true;
      windowRef.on('close', (event) => {
        if (isQuitting) {
          return;
        }
        event.preventDefault();
        if (windowRef && !windowRef.isDestroyed()) {
          windowRef.hide();
        }
      });
    }
    windowRef.on('closed', () => {
      guiMainLog('foxboard', 'window closed');
      if (foxboardWindow === windowRef) {
        foxboardWindow = null;
      }
      if (foxboardPreloadWindow === windowRef) {
        foxboardPreloadWindow = null;
      }
    });
    windowRef.on('blur', () => {
      if (windowRef && !windowRef.isDestroyed()) {
        windowRef.setAlwaysOnTop(false);
      }
    });
    windowRef.webContents.on('before-input-event', (event, input) => {
      const key = String(input.key || '').toLowerCase();
      const isDevToolsCombo =
        (input.control && input.shift && key === 'i')
        || (input.meta && input.alt && key === 'i')
        || key === 'f12';
      if (isDevToolsCombo) {
        event.preventDefault();
      }
    });
    windowRef.loadFile(path.join(APP_PATH, 'src', 'ui', 'html', 'dashboard.html'));
    guiMainLog('foxboard', 'window created');
  } catch {
    guiMainLog('foxboard', 'open failed', null, 'error');
  }
}

function preloadFoxboardWindow() {
  try {
    guiMainLog('foxboard', 'preload requested', {
      hasWindow: Boolean(foxboardWindow && !foxboardWindow.isDestroyed()),
      hasPreloadWindow: Boolean(foxboardPreloadWindow && !foxboardPreloadWindow.isDestroyed()),
    });
    if (
      (foxboardWindow && !foxboardWindow.isDestroyed())
      || (foxboardPreloadWindow && !foxboardPreloadWindow.isDestroyed())
    ) {
      return;
    }
    foxboardPreloadWindow = new BrowserWindow({
      width: 1320,
      height: 860,
      minWidth: 980,
      minHeight: 680,
      show: false,
      alwaysOnTop: false,
      backgroundColor: '#0f1216',
      autoHideMenuBar: true,
      title: 'ClashFox Foxboard',
      webPreferences: {
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js'),
        devTools: false,
      },
    });
    const preloadRef = foxboardPreloadWindow;
    preloadRef.on('closed', () => {
      guiMainLog('foxboard', 'preload window closed');
      if (foxboardPreloadWindow === preloadRef) {
        foxboardPreloadWindow = null;
      }
      if (foxboardWindow === preloadRef) {
        foxboardWindow = null;
      }
    });
    preloadRef.on('blur', () => {
      if (preloadRef && !preloadRef.isDestroyed()) {
        preloadRef.setAlwaysOnTop(false);
      }
    });
    preloadRef.webContents.on('before-input-event', (event, input) => {
      const key = String(input.key || '').toLowerCase();
      const isDevToolsCombo =
        (input.control && input.shift && key === 'i')
        || (input.meta && input.alt && key === 'i')
        || key === 'f12';
      if (isDevToolsCombo) {
        event.preventDefault();
      }
    });
    preloadRef.loadFile(path.join(APP_PATH, 'src', 'ui', 'html', 'dashboard.html'));
    guiMainLog('foxboard', 'preload window created');
  } catch {
    guiMainLog('foxboard', 'preload failed', null, 'error');
    if (foxboardPreloadWindow && !foxboardPreloadWindow.isDestroyed()) {
      foxboardPreloadWindow.close();
    }
    foxboardPreloadWindow = null;
  }
}

function focusPreferredWindowOnActivate() {
  const candidates = [
    BrowserWindow.getFocusedWindow(),
    foxboardWindow,
    dashboardWindow,
    worldwideWindow,
    mainWindow,
  ].filter((win, index, arr) => win && !win.isDestroyed() && arr.indexOf(win) === index);
  const target = candidates.find((win) => win.isVisible()) || candidates[0] || null;
  if (!target) {
    return false;
  }
  try {
    if (target.isMinimized()) {
      target.restore();
    }
  } catch {
    // ignore
  }
  target.show();
  target.focus();
  return true;
}

function preloadWorldwideWindow() {
  try {
    if (
      (worldwideWindow && !worldwideWindow.isDestroyed())
      || (worldwidePreloadWindow && !worldwidePreloadWindow.isDestroyed())
    ) {
      return;
    }
    worldwidePreloadWindow = new BrowserWindow({
      width: 1240,
      height: 820,
      minWidth: 900,
      minHeight: 620,
      show: false,
      alwaysOnTop: false,
      backgroundColor: '#0f1216',
      autoHideMenuBar: true,
      title: 'ClashFox Worldwide',
      webPreferences: {
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js'),
        devTools: false,
      },
    });
    const preloadRef = worldwidePreloadWindow;
    preloadRef.on('closed', () => {
      if (worldwidePreloadWindow === preloadRef) {
        worldwidePreloadWindow = null;
      }
      if (worldwideWindow === preloadRef) {
        worldwideWindow = null;
      }
    });
    preloadRef.on('blur', () => {
      if (preloadRef && !preloadRef.isDestroyed()) {
        preloadRef.setAlwaysOnTop(false);
      }
    });
    preloadRef.webContents.on('before-input-event', (event, input) => {
      const key = String(input.key || '').toLowerCase();
      const isDevToolsCombo =
        (input.control && input.shift && key === 'i')
        || (input.meta && input.alt && key === 'i')
        || key === 'f12';
      if (isDevToolsCombo) {
        event.preventDefault();
      }
    });
    preloadRef.webContents.on('did-finish-load', () => {
      pushCurrentSettingsToWindow(preloadRef);
    });
    preloadRef.loadFile(path.join(APP_PATH, 'src', 'ui', 'html', 'trackers.html'));
  } catch {
    if (worldwidePreloadWindow && !worldwidePreloadWindow.isDestroyed()) {
      worldwidePreloadWindow.close();
    }
    worldwidePreloadWindow = null;
  }
}

function buildMenuTemplate() {
  const viewMenu = globalSettings.debugMode
    ? { role: 'viewMenu' }
    : {
        label: 'View',
        submenu: [
          { role: 'reload' },
          { role: 'forceReload' },
          { type: 'separator' },
          { role: 'togglefullscreen' },
        ],
      };

  return [
    {
      label: 'ClashFox',
      submenu: [
        { label: 'About ClashFox', click: () => createAboutWindow() },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    { role: 'editMenu' },
    viewMenu,
    { role: 'windowMenu' },
    { role: 'help' },
  ];
}

function applyAppMenu() {
  if (process.platform !== 'darwin') {
    return;
  }
  const menu = Menu.buildFromTemplate(buildMenuTemplate());
  Menu.setApplicationMenu(menu);
}

function patchTrayMenuOutboundMode(nextMode) {
  if (!trayMenuData || !OUTBOUND_MODE_BADGE[nextMode]) {
    return;
  }
  const badge = OUTBOUND_MODE_BADGE[nextMode];
  trayMenuData.meta = {
    ...(trayMenuData.meta || {}),
    currentOutboundMode: nextMode,
  };
  if (Array.isArray(trayMenuData.items)) {
    trayMenuData.items = trayMenuData.items.map((item) => {
      if (item && item.submenu === 'outbound') {
        return {
          ...item,
          rightText: `[${badge}]`,
        };
      }
      return item;
    });
  }
  if (trayMenuData.submenus && Array.isArray(trayMenuData.submenus.outbound)) {
    trayMenuData.submenus.outbound = trayMenuData.submenus.outbound.map((item) => {
      if (!item || item.type === 'separator' || item.action !== 'mode-change') {
        return item;
      }
      return {
        ...item,
        checked: String(item.value || '') === nextMode,
      };
    });
  }
  if (trayMenuWindow && !trayMenuWindow.isDestroyed()) {
    trayMenuWindow.webContents.send('clashfox:trayMenu:update', trayMenuData);
  }
}

function patchTrayMenuNetworkState({ systemProxyEnabled, tunEnabled } = {}) {
  if (!trayMenuData || !trayMenuData.submenus || !Array.isArray(trayMenuData.submenus.network)) {
    return;
  }
  trayMenuData.submenus.network = trayMenuData.submenus.network.map((item) => {
    if (!item || item.type === 'separator') {
      return item;
    }
    if (item.action === 'toggle-system-proxy' && typeof systemProxyEnabled === 'boolean') {
      return {
        ...item,
        checked: systemProxyEnabled,
        rightText: systemProxyEnabled ? 'On' : 'Off',
      };
    }
    if (item.action === 'toggle-tun' && typeof tunEnabled === 'boolean') {
      return {
        ...item,
        checked: tunEnabled,
        rightText: tunEnabled ? 'On' : 'Off',
      };
    }
    return item;
  });
  if (traySubmenuWindow && traySubmenuVisible) {
    sendTraySubmenuUpdate({
      key: 'network',
      items: trayMenuData.submenus.network,
    });
  }
  const settings = readAppSettings();
  applyTrayIconForState({
    active: isTrayActiveState({
      systemProxyEnabled: typeof systemProxyEnabled === 'boolean' ? systemProxyEnabled : Boolean(settings && settings.systemProxy),
      tunEnabled: typeof tunEnabled === 'boolean' ? tunEnabled : Boolean(settings && settings.tun),
    }),
  });
}

function buildTrayProviderPayload({ providerTrafficResult, showProviderTraffic }) {
  let providerTraffic = null;
  let outboundProxyTree = null;
  try {
    const rawProviders = providerTrafficResult && providerTrafficResult.status === 'fulfilled'
      ? providerTrafficResult.value
      : null;
    if (rawProviders && rawProviders.ok) {
      if (showProviderTraffic) {
        providerTraffic = buildProviderSubscriptionOverviewData(rawProviders.data || {});
      }
      outboundProxyTree = buildProviderProxyTreeData(rawProviders.data || {});
    }
  } catch {
    providerTraffic = null;
    outboundProxyTree = null;
  }
  return { providerTraffic, outboundProxyTree };
}

function buildTrayOutboundModeItems({ labels, currentOutboundMode }) {
  return [
    { type: 'action', label: labels.modeGlobalTitle || 'Global Proxy', action: 'mode-change', value: 'global', checked: currentOutboundMode === 'global', iconKey: 'modeGlobal' },
    { type: 'action', label: labels.modeRuleTitle || 'Rule-Based Proxy', action: 'mode-change', value: 'rule', checked: currentOutboundMode === 'rule', iconKey: 'modeRule' },
    { type: 'action', label: labels.modeDirectTitle || 'Direct Outbound', action: 'mode-change', value: 'direct', checked: currentOutboundMode === 'direct', iconKey: 'modeDirect' },
  ];
}

function buildTrayMainMenuItems({
  labels,
  currentOutboundBadge,
  dashboardEnabled,
  trayFeatureFlags,
}) {
  const items = [
    { type: 'action', label: labels.showMain, action: 'show-main', rightText: '⌘ 1', shortcut: 'Cmd+1', iconKey: 'showMain' },
    { type: 'separator' },
    { type: 'action', label: labels.networkTakeover || 'Network Takeover', submenu: 'network', iconKey: 'networkTakeover' },
    { type: 'separator' },
    { type: 'action', label: labels.outboundMode || 'Outbound Mode', rightText: `[${currentOutboundBadge}]`, submenu: 'outbound', iconKey: 'outboundMode' },
    { type: 'separator' },
    { type: 'action', label: labels.dashboard, action: 'open-dashboard', enabled: dashboardEnabled, rightText: '⌘ 2', shortcut: 'Cmd+2', iconKey: 'dashboard' },
  ];
  if (trayFeatureFlags.showTrackers) {
    items.push({ type: 'separator' });
    items.push({ type: 'action', label: labels.trackers || 'Trackers', action: 'open-worldwide', rightText: '⌘ 3', shortcut: 'Cmd+3', iconKey: 'trackers' });
  }
  if (trayFeatureFlags.showFoxboard) {
    items.push({ type: 'separator' });
    items.push({ type: 'action', label: 'Foxboard', action: 'open-foxboard', rightText: '⌘ 4', shortcut: 'Cmd+4', iconKey: 'foxboard' });
  }
  if (trayFeatureFlags.showKernelManager) {
    items.push({ type: 'separator' });
    items.push({ type: 'action', label: labels.kernelManager, submenu: 'kernel', iconKey: 'kernelManager' });
  }
  if (trayFeatureFlags.showDirectoryLocations) {
    items.push({ type: 'separator' });
    items.push({ type: 'action', label: labels.directoryLocations || 'Directory Locations', submenu: 'directory', iconKey: 'directory' });
  }
  items.push(
    { type: 'separator' },
    { type: 'action', label: getNavLabels().settings || 'Settings', action: 'open-settings', rightText: '⌘ ,', shortcut: 'Cmd+,', iconKey: 'settings' },
    { type: 'separator' },
    { type: 'action', label: labels.checkUpdate || 'Check for Updates', action: 'check-update', iconKey: 'checkUpdate' },
    { type: 'action', label: labels.quit, action: 'quit', rightText: '⌘ Q', shortcut: 'Cmd+Q', iconKey: 'quit' },
  );
  return items;
}

function buildTraySubmenuData({
  labels,
  outboundItems,
  providerTraffic,
  showProviderTraffic,
  dashboardEnabled,
  networkTakeoverEnabled,
  tunEnabled,
  tunAvailable,
  networkTakeoverService,
  connectivityQuality,
  connectivityTone,
  showCopyShellExportCommand,
  outboundProviderSubmenus,
}) {
  const submenus = {
    network: [
      {
        type: 'action',
        label: labels.networkTakeover || 'Network Takeover',
        action: 'toggle-system-proxy',
        checked: networkTakeoverEnabled,
        enabled: true,
        rightText: networkTakeoverEnabled ? 'On' : 'Off',
        iconKey: 'systemProxy',
      },
      {
        type: 'action',
        label: labels.tun || 'TUN',
        action: 'toggle-tun',
        checked: tunEnabled,
        enabled: tunAvailable,
        rightText: tunEnabled ? 'On' : 'Off',
        iconKey: 'tun',
      },
      { type: 'separator' },
      { type: 'action', label: `${labels.currentService || 'Current Service'}: ${networkTakeoverService || '-'}`, enabled: false, iconKey: 'currentService' },
      { type: 'separator' },
      {
        type: 'action',
        label: labels.connectivityQuality || 'Connectivity Quality',
        rightBadge: {
          text: connectivityQuality,
          tone: connectivityTone,
        },
        enabled: false,
        iconKey: 'connectivityQuality',
      },
    ],
    outbound: [
      outboundItems[0],
      { type: 'separator' },
      outboundItems[1],
      { type: 'separator' },
      outboundItems[2],
    ],
    panel: [
      { type: 'panel-chart' },
      ...(showProviderTraffic && providerTraffic && Array.isArray(providerTraffic.items) && providerTraffic.items.length
        ? [{ type: 'panel-provider-traffic', payload: providerTraffic }]
        : []),
    ],
    directory: [
      { type: 'action', label: labels.userDirectory || 'User Directory', action: 'open-user-directory', iconKey: 'userDir' },
      { type: 'separator' },
      { type: 'action', label: labels.userConfigDirectory || 'Config Directory', action: 'open-config-directory', iconKey: 'configDir' },
      { type: 'separator' },
      { type: 'action', label: labels.workDirectory || 'Work Directory', action: 'open-work-directory', iconKey: 'workDir' },
      { type: 'separator' },
      { type: 'action', label: labels.logDirectory || 'Log Directory', action: 'open-log-directory', iconKey: 'logDir' },
    ],
    kernel: [
      { type: 'action', label: labels.startKernel, action: 'kernel-start', enabled: !dashboardEnabled, iconKey: 'kernelStart' },
      { type: 'separator' },
      { type: 'action', label: labels.stopKernel, action: 'kernel-stop', enabled: dashboardEnabled, iconKey: 'kernelStop' },
      { type: 'separator' },
      { type: 'action', label: labels.restartKernel, action: 'kernel-restart', enabled: dashboardEnabled, iconKey: 'kernelRestart' },
    ],
    ...outboundProviderSubmenus,
  };
  if (showCopyShellExportCommand) {
    submenus.network.push(
      { type: 'separator' },
      { type: 'action', label: labels.copyShellExportCommand || 'Copy Shell Export Command', action: 'copy-shell-export', rightText: '⌘ C', iconKey: 'copyShellExport' },
    );
  }
  return submenus;
}

async function buildTrayMenuOnce() {
  if (process.platform !== 'darwin') {
    return;
  }
  guiMainLog('tray', 'build started');
  const labels = getTrayLabels();
  const uiLabels = getUiLabels();
  const configPath = getConfigPathFromSettings();
  const traySettings = readAppSettings();
  let dashboardEnabled = false;
  let networkTakeoverEnabled = false;
  let networkTakeoverService = '';
  let networkTakeoverPort = String(traySettings && traySettings.port ? traySettings.port : '7890').trim() || '7890';
  let networkTakeoverSocksPort = String(traySettings && traySettings.socksPort ? traySettings.socksPort : '7891').trim() || '7891';
  let connectivityQuality = '-';
  let connectivityTone = 'neutral';
  let tunEnabled = Boolean(
    Object.prototype.hasOwnProperty.call(traySettings || {}, 'tun')
      ? traySettings.tun
      : false,
  );
  const expectedProxyPort = String(
    traySettings && Object.prototype.hasOwnProperty.call(traySettings, 'port')
      ? traySettings.port
      : '',
  ).trim();
  let tunAvailable = true;
  const parsedProxyPorts = readProxyPortsFromConfigPath(configPath);
  if (!traySettings || !Object.prototype.hasOwnProperty.call(traySettings, 'port')) {
    if (parsedProxyPorts && parsedProxyPorts.port) {
      networkTakeoverPort = String(parsedProxyPorts.port).trim() || networkTakeoverPort;
    }
  }
  if (!traySettings || !Object.prototype.hasOwnProperty.call(traySettings, 'socksPort')) {
    if (parsedProxyPorts && parsedProxyPorts.socksPort) {
      networkTakeoverSocksPort = String(parsedProxyPorts.socksPort).trim() || networkTakeoverSocksPort;
    }
  }
  const showProviderTraffic = traySettings ? traySettings.providerTrafficEnabled !== false : true;
  const systemProxyArgs = ['system-proxy-status', '--config', configPath];
  if (expectedProxyPort) {
    systemProxyArgs.push('--port', expectedProxyPort);
  }
  const [
    statusResult,
    overviewResult,
    takeoverResult,
    connectivitySnapshot,
    tunStatusResult,
    providerTrafficResult,
  ] = await Promise.allSettled([
    runBridge(['status']),
    runBridge(['overview']),
    runBridge(systemProxyArgs),
    getConnectivityQualitySnapshot(configPath),
    runBridge(['tun-status', '--config', configPath]),
    loadProvidersProxiesRaw(),
  ]);
  try {
    const status = statusResult.status === 'fulfilled' ? statusResult.value : null;
    dashboardEnabled = Boolean(status && status.ok && status.data && status.data.running);
    if (!dashboardEnabled) {
      const overview = overviewResult.status === 'fulfilled' ? overviewResult.value : null;
      dashboardEnabled = Boolean(overview && overview.ok && overview.data && overview.data.running);
    }
  } catch {
    dashboardEnabled = false;
  }
  try {
    const takeover = takeoverResult.status === 'fulfilled' ? takeoverResult.value : null;
    networkTakeoverEnabled = Boolean(takeover && takeover.ok && takeover.data && takeover.data.enabled);
    networkTakeoverService = (takeover && takeover.ok && takeover.data && takeover.data.service)
      ? String(takeover.data.service)
      : '';
    networkTakeoverPort = (takeover && takeover.ok && takeover.data && takeover.data.port)
      ? String(takeover.data.port).trim()
      : '7890';
    networkTakeoverSocksPort = (takeover && takeover.ok && takeover.data && takeover.data.socksPort)
      ? String(takeover.data.socksPort).trim()
      : (parsedProxyPorts && parsedProxyPorts.socksPort
        ? String(parsedProxyPorts.socksPort).trim()
        : networkTakeoverPort);
    persistSystemProxyEnabledToSettings(networkTakeoverEnabled);
  } catch {
    networkTakeoverEnabled = Boolean(
      traySettings && Object.prototype.hasOwnProperty.call(traySettings, 'systemProxy')
        ? traySettings.systemProxy
        : false,
    );
    networkTakeoverService = '';
    networkTakeoverPort = (traySettings && Object.prototype.hasOwnProperty.call(traySettings, 'port'))
      ? String(traySettings.port).trim()
      : ((parsedProxyPorts && parsedProxyPorts.port)
      ? String(parsedProxyPorts.port).trim()
      : '7890');
    networkTakeoverSocksPort = (traySettings && Object.prototype.hasOwnProperty.call(traySettings, 'socksPort'))
      ? String(traySettings.socksPort).trim()
      : ((parsedProxyPorts && parsedProxyPorts.socksPort)
      ? String(parsedProxyPorts.socksPort).trim()
      : '7891');
    // Keep last persisted systemProxy on transient status errors.
  }
  const connectivity = connectivitySnapshot.status === 'fulfilled' ? connectivitySnapshot.value : null;
  connectivityQuality = connectivity && connectivity.text
    ? String(connectivity.text)
    : '-';
  connectivityTone = connectivity && connectivity.tone
    ? String(connectivity.tone)
    : 'neutral';
  try {
    const tunStatus = tunStatusResult.status === 'fulfilled' ? tunStatusResult.value : null;
    if (tunStatus && tunStatus.ok && tunStatus.data) {
      const tunEnabledRaw = Object.prototype.hasOwnProperty.call(tunStatus.data, 'enabled')
        ? tunStatus.data.enabled
        : tunStatus.data.enable;
      tunEnabled = tunEnabledRaw === true || tunEnabledRaw === 'true' || tunEnabledRaw === 1;
      tunAvailable = true;
    }
  } catch {
    // Keep fallback from local settings when controller is unavailable.
  }
  const trayActive = isTrayActiveState({ systemProxyEnabled: networkTakeoverEnabled, tunEnabled });
  if (!tray) {
    const trayIcon = buildTrayIconWithState({ active: trayActive });
    tray = new Tray(trayIcon);
    if (process.platform === 'darwin' && trayIcon && typeof trayIcon.setTemplateImage === 'function') {
      trayIcon.setTemplateImage(true);
    }
    tray.setToolTip('ClashFox');
    if (typeof tray.setIgnoreDoubleClickEvents === 'function') {
      tray.setIgnoreDoubleClickEvents(true);
    }
    tray.on('click', () => {
      try {
        toggleTrayMenuWindow();
      } catch (err) {
        console.error('[tray] click handler failed:', err && err.message ? err.message : err);
      }
    });
    tray.on('right-click', () => {
      try {
        toggleTrayMenuWindow();
      } catch (err) {
        console.error('[tray] right-click handler failed:', err && err.message ? err.message : err);
      }
    });
  } else {
    applyTrayIconForState({ active: trayActive });
  }
  // Re-read mode at commit time to avoid stale snapshot overwriting a newer switch.
  const currentOutboundMode = resolveOutboundModeFromSettings();
  const currentOutboundBadge = OUTBOUND_MODE_BADGE[currentOutboundMode] || OUTBOUND_MODE_BADGE.rule;
  const runningLabel = uiLabels.running || labels.on || 'Running';
  const stoppedLabel = uiLabels.stopped || labels.off || 'Stopped';
  const trayStatusState = dashboardEnabled ? 'running' : 'stopped';
  const trayStatusLabel = dashboardEnabled ? runningLabel : stoppedLabel;

  const trayFeatureFlags = {
    showKernelManager: traySettings ? traySettings.kernelManagerEnabled !== false : true,
    showDirectoryLocations: traySettings ? traySettings.directoryLocationsEnabled !== false : true,
    showTrackers: traySettings ? traySettings.trackersEnabled !== false : true,
    showFoxboard: traySettings ? traySettings.foxboardEnabled !== false : true,
    showCopyShellExportCommand: traySettings ? traySettings.copyShellExportCommandEnabled !== false : true,
  };
  const trayProviderPayload = buildTrayProviderPayload({
    providerTrafficResult,
    showProviderTraffic,
  });
  const outboundItems = buildTrayOutboundModeItems({
    labels,
    currentOutboundMode,
  });
  const items = buildTrayMainMenuItems({
    labels,
    currentOutboundBadge,
    dashboardEnabled,
    trayFeatureFlags,
  });
  const showOutboundProxyGroups = false;
  let outboundProxyCard = null;
  const outboundProviderSubmenus = {};
  if (showOutboundProxyGroups && trayProviderPayload.outboundProxyTree && Array.isArray(trayProviderPayload.outboundProxyTree.groups) && trayProviderPayload.outboundProxyTree.groups.length) {
    const compatibleGroup = trayProviderPayload.outboundProxyTree.groups.find((group) => String(group.vehicleType || '').trim() === 'COMPATIBLE');
    const providers = compatibleGroup && Array.isArray(compatibleGroup.providers) ? compatibleGroup.providers : [];
    if (providers.length) {
      outboundProxyCard = {
        totalProviders: providers.length,
        totalProxies: providers.reduce((sum, provider) => sum + (Array.isArray(provider.proxies) ? provider.proxies.length : 0), 0),
        providers: providers.map((provider) => ({
          id: provider.id,
          name: provider.name,
          proxyCount: provider.proxyCount,
          currentProxy: provider.currentProxy || '',
          chart: (Array.isArray(provider.proxies) ? provider.proxies : []).slice(0, 18).map((proxy) => ({
            status: proxy && proxy.isCurrent ? 'current' : (typeof proxy.alive === 'boolean' ? (proxy.alive ? 'alive' : 'dead') : 'unknown'),
          })),
          submenuKey: `outbound-provider:${provider.id}`,
        })),
      };
      providers.forEach((provider) => {
        const submenuKey = `outbound-provider:${provider.id}`;
        const proxies = Array.isArray(provider.proxies) ? provider.proxies : [];
        const proxyItems = proxies.length
          ? proxies.flatMap((proxy, index) => {
              const nextItem = {
                type: 'child',
                label: proxy.name || '-',
                rightText: Number.isFinite(Number(proxy.delay)) ? `${Number(proxy.delay)} ms` : '',
                status: typeof proxy.alive === 'boolean' ? (proxy.alive ? 'alive' : 'dead') : 'unknown',
                checked: Boolean(proxy.isCurrent),
                action: 'proxy-select',
                value: proxy.name || '',
                groupName: provider.name || '',
                submenuKey,
              };
              if (index >= proxies.length - 1) {
                return [nextItem];
              }
              return [nextItem, { type: 'separator' }];
            })
          : [{ type: 'child', label: '-', rightText: '', status: 'unknown', enabled: false }];
        outboundProviderSubmenus[submenuKey] = [
          { type: 'provider', label: provider.name || '-', rightText: String(Number(provider.proxyCount || 0)) },
          { type: 'separator' },
          ...proxyItems,
        ];
      });
    }
  }
  const nextMenuData = {
    header: {
      title: app.getName(),
      status: trayStatusLabel,
      statusState: trayStatusState,
    },
    backLabel: '‹ Back',
    meta: {
      configPath,
      networkTakeoverPort,
      networkTakeoverSocksPort,
      networkTakeoverService,
      dashboardEnabled,
      currentOutboundMode,
      submenuSide: 'right',
    },
    providerTraffic: trayProviderPayload.providerTraffic,
    outboundProxyTree: outboundProxyCard,
    items,
    submenus: buildTraySubmenuData({
      labels,
      outboundItems,
      providerTraffic: trayProviderPayload.providerTraffic,
      showProviderTraffic,
      dashboardEnabled,
      networkTakeoverEnabled,
      tunEnabled,
      tunAvailable,
      networkTakeoverService,
      connectivityQuality,
      connectivityTone,
      showCopyShellExportCommand: trayFeatureFlags.showCopyShellExportCommand,
      outboundProviderSubmenus,
    }),
  };
  const nextSignature = buildTrayMenuDataSignature(nextMenuData);
  const changed = nextSignature !== trayMenuDataSignature;
  trayMenuData = nextMenuData;
  trayMenuDataSignature = nextSignature;
  trayMenuLastBuiltAt = Date.now();
  guiMainLog('tray', 'build completed', {
    items: Array.isArray(items) ? items.length : 0,
    showTrackers: trayFeatureFlags.showTrackers,
    showFoxboard: trayFeatureFlags.showFoxboard,
    showProviderTraffic,
    providerCount: trayProviderPayload.providerTraffic && Array.isArray(trayProviderPayload.providerTraffic.items)
      ? trayProviderPayload.providerTraffic.items.length
      : 0,
    dashboardEnabled,
    networkTakeoverEnabled,
    tunEnabled,
  });
  if (changed && trayMenuWindow && !trayMenuWindow.isDestroyed()) {
    trayMenuWindow.webContents.send('clashfox:trayMenu:update', trayMenuData);
  }
  return trayMenuData;
}

async function createTrayMenu() {
  if (trayMenuBuildInProgress) {
    trayMenuBuildPending = true;
    guiMainLog('tray', 'build skipped, pending rerun');
    return trayMenuData;
  }
  trayMenuBuildInProgress = true;
  guiMainLog('tray', 'build loop entered');
  try {
    do {
      trayMenuBuildPending = false;
      await buildTrayMenuOnce();
    } while (trayMenuBuildPending);
    return trayMenuData;
  } finally {
    trayMenuBuildInProgress = false;
    guiMainLog('tray', 'build loop exited');
  }
}

function ensureTrayMenuWindow() {
  if (trayMenuWindow && !trayMenuWindow.isDestroyed()) {
    return trayMenuWindow;
  }
  trayMenuWindow = new BrowserWindow({
    width: 520,
    height: 420,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    hasShadow: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      devTools: false,
      backgroundThrottling: false,
    },
  });
  if (trayMenuWindow.setSkipTaskbar) {
    trayMenuWindow.setSkipTaskbar(true);
  }
  if (trayMenuWindow.setExcludedFromShownWindowsMenu) {
    trayMenuWindow.setExcludedFromShownWindowsMenu(true);
  }
  trayMenuWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  trayMenuWindow.setAlwaysOnTop(true, 'pop-up-menu');
  trayMenuRendererReady = false;
  trayMenuWindow.webContents.on('before-input-event', (event, input) => {
    const key = String(input.key || '').toLowerCase();
    const isReloadCombo = (input.control || input.meta) && key === 'r';
    const isReloadKey = key === 'f5';
    const isDevToolsCombo =
      (input.control && input.shift && key === 'i')
      || (input.meta && input.alt && key === 'i')
      || key === 'f12';
    if (isReloadCombo || isReloadKey) {
      event.preventDefault();
      if (globalSettings.debugMode) {
        try {
          trayMenuWindow.webContents.reload();
        } catch {
          // ignore reload failures
        }
      }
      return;
    }
    if (isDevToolsCombo && !globalSettings.debugMode) {
      event.preventDefault();
    }
  });
  trayMenuWindow.loadFile(path.join(__dirname, 'ui', 'html', 'tray-menu.html'));
  trayMenuWindow.on('blur', () => {
    trayMenuClosing = true;
    hideTraySubmenuWindow();
    setTimeout(() => {
      if (!traySubmenuHovering) {
        hideTrayMenuWindow();
      }
    }, 40);
  });
  trayMenuWindow.on('closed', () => {
    hideTraySubmenuWindow();
    trayMenuWindow = null;
    trayMenuVisible = false;
    trayMenuClosing = false;
    trayMenuRendererReady = false;
    if (trayMenuRefreshTimer) {
      clearInterval(trayMenuRefreshTimer);
      trayMenuRefreshTimer = null;
    }
  });
  return trayMenuWindow;
}

function hideTraySubmenuWindow() {
  traySubmenuVisible = false;
  traySubmenuHovering = false;
  if (traySubmenuWindow && !traySubmenuWindow.isDestroyed()) {
    traySubmenuWindow.hide();
  }
}

function ensureTraySubmenuWindow() {
  if (traySubmenuWindow && !traySubmenuWindow.isDestroyed()) {
    return traySubmenuWindow;
  }
  traySubmenuWindow = new BrowserWindow({
    width: 240,
    height: 200,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    hasShadow: true,
    skipTaskbar: true,
    alwaysOnTop: true,
    focusable: false,
    backgroundColor: '#00000000',
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      devTools: false,
    },
  });
  if (traySubmenuWindow.setSkipTaskbar) {
    traySubmenuWindow.setSkipTaskbar(true);
  }
  if (traySubmenuWindow.setExcludedFromShownWindowsMenu) {
    traySubmenuWindow.setExcludedFromShownWindowsMenu(true);
  }
  traySubmenuWindow.setAlwaysOnTop(true, 'pop-up-menu');
  traySubmenuWindow.loadFile(path.join(__dirname, 'ui', 'html', 'tray-submenu.html'));
  traySubmenuWindow.on('closed', () => {
    traySubmenuWindow = null;
    traySubmenuVisible = false;
    traySubmenuReady = false;
    traySubmenuHovering = false;
    traySubmenuPendingPayload = null;
    traySubmenuLastSize = { width: 0, height: 0 };
  });
  return traySubmenuWindow;
}

function hideTrayMenuWindow() {
  if (!trayMenuWindow || trayMenuWindow.isDestroyed()) {
    trayMenuVisible = false;
    trayMenuClosing = false;
    hideTraySubmenuWindow();
    traySubmenuPendingPayload = null;
    if (trayMenuRefreshTimer) {
      clearInterval(trayMenuRefreshTimer);
      trayMenuRefreshTimer = null;
    }
    return;
  }
  hideTraySubmenuWindow();
  trayMenuVisible = false;
  trayMenuClosing = false;
  traySubmenuPendingPayload = null;
  if (trayMenuRefreshTimer) {
    clearInterval(trayMenuRefreshTimer);
    trayMenuRefreshTimer = null;
  }
  trayMenuWindow.hide();
}

function sendTraySubmenuUpdate(payload) {
  traySubmenuPendingPayload = payload || null;
  if (
    !trayMenuVisible
    || trayMenuClosing
    || !trayMenuWindow
    || trayMenuWindow.isDestroyed()
    || !trayMenuWindow.isFocused()
  ) {
    hideTraySubmenuWindow();
    return;
  }
  if (
    traySubmenuWindow
    && !traySubmenuWindow.isDestroyed()
    && traySubmenuReady
    && traySubmenuPendingPayload
  ) {
    traySubmenuWindow.webContents.send('clashfox:traySubmenu:update', traySubmenuPendingPayload);
  }
}

function computeTraySubmenuBounds(width, height) {
  if (!trayMenuWindow || trayMenuWindow.isDestroyed()) {
    return null;
  }
  if (!trayMenuVisible) {
    return null;
  }
  const mainBounds = trayMenuWindow.getBounds();
  const display = screen.getDisplayNearestPoint({ x: mainBounds.x, y: mainBounds.y });
  const area = display.workArea;
  const gap = 0;
  const targetWidth = Math.max(140, Math.round(width || 0));
  const targetHeight = Math.max(60, Math.round(height || 0));
  const maxTopWithinMain = Math.max(
    8,
    (traySubmenuAnchor.rootHeight || targetHeight) - targetHeight - 8,
  );
  const anchorTop = Math.min(Math.max(8, Math.round(traySubmenuAnchor.top || 0)), maxTopWithinMain);
  const desiredY = mainBounds.y + anchorTop;
  const y = Math.max(area.y + 4, Math.min(desiredY, area.y + area.height - targetHeight - 4));
  let xRight = mainBounds.x + mainBounds.width + gap;
  let xLeft = mainBounds.x - targetWidth - gap;
  let side = 'right';
  const canRight = (xRight + targetWidth) <= (area.x + area.width - 4);
  const canLeft = xLeft >= (area.x + 4);
  if (!canRight && canLeft) {
    side = 'left';
  } else if (!canRight && !canLeft) {
    const rightOverflow = (xRight + targetWidth) - (area.x + area.width - 4);
    const leftOverflow = (area.x + 4) - xLeft;
    side = rightOverflow <= leftOverflow ? 'right' : 'left';
  }
  const x = side === 'right'
    ? Math.min(Math.max(area.x + 4, xRight), area.x + area.width - targetWidth - 4)
    : Math.max(area.x + 4, Math.min(xLeft, area.x + area.width - targetWidth - 4));
  return { x, y, side };
}

function positionTraySubmenuWindow(width, height) {
  if (!traySubmenuWindow || traySubmenuWindow.isDestroyed()) {
    return;
  }
  const bounds = computeTraySubmenuBounds(width, height);
  if (!bounds) {
    return;
  }
  const nextBounds = {
    x: Math.round(bounds.x),
    y: Math.round(bounds.y),
    width: Math.round(width),
    height: Math.round(height),
  };
  traySubmenuWindow.setBounds(nextBounds);
}

function computeTrayMenuWindowBounds(contentHeight = trayMenuContentHeight, explicitWidth = 260) {
  if (!tray) {
    return null;
  }
  const trayBounds = tray.getBounds();
  const display = screen.getDisplayNearestPoint({ x: trayBounds.x, y: trayBounds.y });
  const area = display.workArea;
  const screenBounds = display.bounds;
  const mainMenuWidth = 260;
  const popupWidth = Number.isFinite(explicitWidth)
    ? Math.max(mainMenuWidth, Math.round(explicitWidth))
    : mainMenuWidth;
  const popupHeight = Math.max(120, Math.min(Number(contentHeight) || 420, 760));
  const anchorX = trayBounds.x + Math.round(trayBounds.width / 2);
  // Align tray icon center with the header logo center (padding-left 12px + logo radius 24px).
  const logoCenterX = 36;
  const desiredX = anchorX - logoCenterX;
  const x = Math.max(area.x + 8, Math.min(desiredX, area.x + area.width - popupWidth - 8));
  const trayBottomY = trayBounds.y + trayBounds.height;
  const attachedY = process.platform === 'darwin'
    ? trayBottomY - 10
    : trayBottomY;
  const minY = process.platform === 'darwin' ? screenBounds.y : area.y;
  const y = Math.max(minY, Math.min(attachedY, area.y + area.height - popupHeight - 8));
  return {
    bounds: { x, y, width: popupWidth, height: popupHeight },
  };
}

function applyTrayMenuWindowBounds(contentHeight = trayMenuContentHeight, preservePosition = false, explicitWidth = 260, syncMenuData = true) {
  if (!trayMenuWindow || trayMenuWindow.isDestroyed()) {
    return;
  }
  let computed = computeTrayMenuWindowBounds(contentHeight, explicitWidth);
  if (!computed) {
    return;
  }
  if (preservePosition) {
    const current = trayMenuWindow.getBounds();
    const display = screen.getDisplayNearestPoint({ x: current.x, y: current.y });
    const area = display.workArea;
    const screenBounds = display.bounds;
    const minY = process.platform === 'darwin' ? screenBounds.y : area.y + 8;
    const boundedX = Math.max(area.x + 8, Math.min(current.x, area.x + area.width - computed.bounds.width - 8));
    const boundedY = Math.max(minY, Math.min(current.y, area.y + area.height - computed.bounds.height - 8));
    computed = {
      ...computed,
      bounds: {
        ...computed.bounds,
        x: boundedX,
        y: boundedY,
      },
    };
  }
  trayMenuContentHeight = Math.max(120, Math.min(Number(contentHeight) || trayMenuContentHeight || 420, 760));
  trayMenuWindow.setBounds(computed.bounds);
  if (
    traySubmenuVisible
    && traySubmenuLastSize
    && traySubmenuLastSize.width
    && traySubmenuLastSize.height
  ) {
    positionTraySubmenuWindow(traySubmenuLastSize.width, traySubmenuLastSize.height);
  }
  if (syncMenuData && trayMenuData) {
    const sendUpdate = () => {
      if (!trayMenuWindow || trayMenuWindow.isDestroyed()) {
        return;
      }
      trayMenuWindow.webContents.send('clashfox:trayMenu:update', trayMenuData);
    };
    if (trayMenuWindow.webContents.isLoadingMainFrame()) {
      trayMenuWindow.webContents.once('did-finish-load', sendUpdate);
    } else {
      sendUpdate();
    }
  }
}

async function showTrayMenuWindow() {
  if (!tray) {
    return;
  }
  trayMenuClosing = false;
  hideTraySubmenuWindow();
  const popup = ensureTrayMenuWindow();
  const currentBounds = popup.getBounds();
  if (
    currentBounds
    && Number.isFinite(currentBounds.height)
    && currentBounds.height > 0
    && (!Number.isFinite(trayMenuContentHeight) || trayMenuContentHeight <= 0)
  ) {
    trayMenuContentHeight = currentBounds.height;
  }
  if (!trayMenuData) {
    await createTrayMenu().catch(() => {});
  } else if ((Date.now() - trayMenuLastBuiltAt) > 1000) {
    // Refresh stale cache in background only when needed.
    createTrayMenu().catch(() => {});
  } else {
    const connectivityItem = trayMenuData
      && trayMenuData.submenus
      && Array.isArray(trayMenuData.submenus.network)
      ? trayMenuData.submenus.network.find((item) => item && item.iconKey === 'connectivityQuality')
      : null;
    const connectivityText = connectivityItem && connectivityItem.rightBadge
      ? String(connectivityItem.rightBadge.text || '').trim()
      : '';
    if (!connectivityText || connectivityText === '-') {
      createTrayMenu().catch(() => {});
    }
  }
  applyTrayMenuWindowBounds(trayMenuContentHeight, false, 260);
  popup.show();
  popup.focus();
  trayMenuVisible = true;
  if (!trayMenuRefreshTimer) {
    trayMenuRefreshTimer = setInterval(() => {
      if (!trayMenuVisible) {
        return;
      }
      createTrayMenu().catch(() => {});
    }, CONNECTIVITY_REFRESH_MS);
  }
}

function toggleTrayMenuWindow() {
  if (trayMenuVisible) {
    hideTrayMenuWindow();
    return;
  }
  showTrayMenuWindow().catch((err) => {
    console.error('[tray] show menu failed:', err && err.message ? err.message : err);
  });
}

async function handleTrayMenuAction(action, payload = {}) {
  guiMainLog('tray', 'action requested', {
    action,
    payload,
  });
  const labels = getTrayLabels();
  const uiLabels = getUiLabels();
  const configPath = getConfigPathFromSettings();
  switch (action) {
    case 'show-main':
      hideTrayMenuWindow();
      showMainWindow();
      return { ok: true, hide: true };
    case 'open-foxboard':
      hideTrayMenuWindow();
      openFoxboardWindow();
      return { ok: true, hide: true };
    case 'open-dashboard':
      hideTrayMenuWindow();
      openDashboardPanel();
      return { ok: true, hide: true };
    case 'open-worldwide':
      hideTrayMenuWindow();
      openWorldwideWindow();
      return { ok: true, hide: true };
    case 'open-settings':
      hideTrayMenuWindow();
      openMainPage('settings');
      return { ok: true, hide: true };
    case 'check-update':
      hideTrayMenuWindow();
      try {
        const result = await checkForUpdates({ manual: true });
        if (!result.ok) {
          const reason = String(result.error || 'unknown_error');
          await shell.openExternal(resolveCheckUpdateUrlFromSettings());
          emitMainToast(`Check for updates failed (${reason}). Opened releases page.`, 'warn');
          return { ok: true, hide: true, result };
        }
        if (result.status === 'update_available') {
          await shell.openExternal(result.releaseUrl || resolveCheckUpdateUrlFromSettings());
          emitMainToast(`Update available: v${result.latestVersion}`, 'info');
          return { ok: true, hide: true, result };
        }
        emitMainToast('Already up to date.', 'info');
        return { ok: true, hide: true };
      } catch {
        return { ok: false, hide: true };
      }
    case 'quit':
      app.quit();
      return { ok: true, hide: true };
    case 'toggle-system-proxy': {
      const targetEnabled = Boolean(payload && payload.checked);
      const command = payload && payload.checked ? 'system-proxy-enable' : 'system-proxy-disable';
      const proxyArgs = ['--config', configPath];
      const settings = readAppSettings();
      const expectedPort = String(
        settings && Object.prototype.hasOwnProperty.call(settings, 'port')
          ? settings.port
          : '',
      ).trim();
      if (expectedPort) {
        proxyArgs.push('--port', expectedPort);
      }
      const serviceHint = String(
        trayMenuData
        && trayMenuData.meta
        && Object.prototype.hasOwnProperty.call(trayMenuData.meta, 'networkTakeoverService')
          ? trayMenuData.meta.networkTakeoverService
          : '',
      ).trim();
      if (serviceHint) {
        proxyArgs.push('--service', serviceHint);
      }
      const response = await runTrayCommand(command, proxyArgs, labels);
      if (response.ok) {
        let actualEnabled = resolveSystemProxyEnabledFromPayload(response.result);
        if (actualEnabled === null) actualEnabled = targetEnabled;
        persistSystemProxyEnabledToSettings(actualEnabled);
        patchTrayMenuNetworkState({ systemProxyEnabled: actualEnabled });
      } else {
        const fallbackEnabled = Boolean(
          settings && Object.prototype.hasOwnProperty.call(settings, 'systemProxy')
            ? settings.systemProxy
            : false
        );
        persistSystemProxyEnabledToSettings(fallbackEnabled);
        patchTrayMenuNetworkState({ systemProxyEnabled: fallbackEnabled });
      }
      emitTrayRefresh();
      return { ok: true, submenu: 'network', data: trayMenuData };
    }
    case 'toggle-tun': {
      const targetEnabled = Boolean(payload && payload.checked);
      const tunResult = await updateMihomoConfigMain({ tun: { enable: targetEnabled } });
      if (tunResult && tunResult.ok) {
        persistTunEnabledToSettings(targetEnabled);
        patchTrayMenuNetworkState({ tunEnabled: targetEnabled });
      }
      if (!(tunResult && tunResult.ok)) {
        const message = (tunResult && (tunResult.details || tunResult.error || tunResult.message))
          ? String(tunResult.details || tunResult.error || tunResult.message)
          : 'Unknown error';
        await dialog.showMessageBox({
          type: 'error',
          buttons: [labels.ok || 'OK'],
          title: labels.errorTitle || 'Operation Failed',
          message: `${labels.commandFailed || 'Command failed'}: tun`,
          detail: message,
        });
      }
      emitTrayRefresh();
      return { ok: true, submenu: 'network', data: trayMenuData, result: tunResult };
    }
    case 'copy-shell-export': {
      const shellExportCommand = buildShellExportCommand(readAppSettings());
      clipboard.writeText(shellExportCommand);
      emitMainToast(labels.shellExportCopied || 'Shell export command copied.', 'info');
      createTrayMenu().catch(() => {});
      return { ok: true, submenu: 'network' };
    }
    case 'mode-change': {
      const nextMode = payload && payload.value ? String(payload.value) : '';
      if (!OUTBOUND_MODE_BADGE[nextMode]) {
        return { ok: false };
      }
      const response = await updateMihomoConfigMain({ mode: nextMode });
      if (response.ok) {
        persistOutboundModeToSettings(nextMode);
        patchTrayMenuOutboundMode(nextMode);
        emitTrayRefresh();
      }
      return { ok: true, submenu: 'outbound' };
    }
    case 'proxy-select': {
      const nextProxy = payload && payload.value ? String(payload.value) : '';
      const groupName = payload && payload.groupName ? String(payload.groupName) : '';
      const submenu = payload && payload.submenuKey ? String(payload.submenuKey) : '';
      const response = await updateMihomoProxySelectionMain(groupName, nextProxy);
      if (response && response.ok) {
        const rebuilt = await createTrayMenu();
        emitTrayRefresh();
        return { ok: true, submenu, data: rebuilt || trayMenuData };
      }
      return { ok: false, submenu, error: response && response.error ? response.error : 'proxy_select_failed' };
    }
    case 'kernel-start': {
      try {
        const status = await getKernelRunning(labels);
        if (!status) {
          return { ok: false, submenu: 'kernel' };
        }
        if (status.running) {
          emitMainToast(uiLabels.alreadyRunning || 'Kernel is already running.', 'info');
          return { ok: true, submenu: 'kernel' };
        }
        emitMainCoreAction({ action: 'start', phase: 'start' });
        const commandStartedAt = Date.now();
        const started = await runTrayCommand('start', ['--config', configPath], labels, status.sudoPass);
        if (started.ok) {
          const running = await waitForKernelRunningFromTray(started.sudoPass || status.sudoPass || '');
          if (running) {
            updateTrayCoreStartupEstimate(Date.now() - commandStartedAt);
            emitMainToast(uiLabels.startSuccess || 'Kernel started.', 'info');
          } else {
            emitMainToast(uiLabels.startFailed || 'Start failed.', 'error');
          }
        }
      } finally {
        emitTrayRefresh();
      }
      return { ok: true, submenu: 'kernel' };
    }
    case 'kernel-stop': {
      try {
        const status = await getKernelRunning(labels);
        if (!status) {
          return { ok: false, submenu: 'kernel' };
        }
        if (!status.running) {
          emitMainToast(uiLabels.alreadyStopped || 'Kernel is already stopped.', 'info');
          return { ok: true, submenu: 'kernel' };
        }
        const stopped = await runTrayCommand('stop', [], labels, status.sudoPass);
        if (stopped.ok) {
          emitMainToast(uiLabels.stopSuccess || uiLabels.stopped || 'Kernel stopped.', 'info');
        }
      } finally {
        emitTrayRefresh();
      }
      return { ok: true, submenu: 'kernel' };
    }
    case 'kernel-restart': {
      try {
        const status = await getKernelRunning(labels);
        if (!status) {
          return { ok: false, submenu: 'kernel' };
        }
        if (!status.running) {
          emitMainToast(uiLabels.restartStarts || 'Kernel is stopped, starting now.', 'info');
          emitMainCoreAction({ action: 'start', phase: 'start' });
          const commandStartedAt = Date.now();
          const started = await runTrayCommand('start', ['--config', configPath], labels, status.sudoPass);
          if (started.ok) {
            const running = await waitForKernelRunningFromTray(started.sudoPass || status.sudoPass || '');
            if (running) {
              updateTrayCoreStartupEstimate(Date.now() - commandStartedAt);
              emitMainToast(uiLabels.startSuccess || 'Kernel started.', 'info');
            } else {
              emitMainToast(uiLabels.startFailed || 'Start failed.', 'error');
            }
          }
          return { ok: true, submenu: 'kernel' };
        }
        const transitionDelayMs = getTrayRestartTransitionDelayMs();
        emitMainCoreAction({ action: 'restart', phase: 'transition', delayMs: transitionDelayMs });
        await sleep(transitionDelayMs);
        const commandStartedAt = Date.now();
        const restarted = await runTrayCommand('restart', ['--config', configPath], labels, status.sudoPass);
        if (restarted.ok) {
          const running = await waitForKernelRunningFromTray(restarted.sudoPass || status.sudoPass || '');
          if (running) {
            updateTrayCoreStartupEstimate(Date.now() - commandStartedAt);
            emitMainToast(uiLabels.restartSuccess || 'Kernel restarted.', 'info');
          } else {
            emitMainToast(uiLabels.startFailed || 'Start failed.', 'error');
          }
        }
      } finally {
        emitTrayRefresh();
      }
      return { ok: true, submenu: 'kernel' };
    }
    case 'open-user-directory': {
      const opened = await openDirectoryInFinder(APP_DATA_DIR);
      return { ok: opened, hide: false, submenu: 'directory' };
    }
    case 'open-config-directory': {
      const opened = await openDirectoryInFinder(path.join(APP_DATA_DIR, 'config'));
      return { ok: opened, hide: false, submenu: 'directory' };
    }
    case 'open-work-directory': {
      const opened = await openDirectoryInFinder(WORK_DIR);
      return { ok: opened, hide: false, submenu: 'directory' };
    }
    case 'open-log-directory': {
      const opened = await openDirectoryInFinder(path.join(APP_DATA_DIR, 'logs'));
      return { ok: opened, hide: false, submenu: 'directory' };
    }
    default:
      return { ok: false, error: 'unknown_action' };
  }
}

function applyDevToolsState() {
  BrowserWindow.getAllWindows().forEach((win) => {
    if (trayMenuWindow && win.id === trayMenuWindow.id) {
      if (win.webContents.isDevToolsOpened()) {
        win.webContents.closeDevTools();
      }
      return;
    }
    if (globalSettings.debugMode) {
      if (!win.webContents.isDevToolsOpened()) {
        win.webContents.openDevTools({ mode: 'detach' });
      }
      return;
    }
    if (win.webContents.isDevToolsOpened()) {
      win.webContents.closeDevTools();
    }
  });
  applyAppMenu();
}


if (process.env.CLASHFOX_DEV === '1') {
  // Hot reload for main + renderer during local development.
  // eslint-disable-next-line global-require
  require('electron-reload')([
    path.join(ROOT_DIR, 'src'),
    path.join(ROOT_DIR, 'static'),
    path.join(ROOT_DIR, 'package.json'),
  ], {
    electron: path.join(ROOT_DIR, 'node_modules', '.bin', 'electron'),
  });
}

function runBridge(args, options = {}) {
  return new Promise((resolve) => {
    (async () => {
      try {
        const normalized = normalizeBridgeArgs(args, options);
        const bridgeArgs = normalized.args;
        const sudoPass = normalized.sudoPass;
        // console.log('[runBridge] Running command:', args);
        const commandType = bridgeArgs[0];

        const helperResult = await runBridgeViaHelper(bridgeArgs);
        if (helperResult) {
          if (!(helperResult && helperResult.ok === false && helperResult.error === 'unsupported_command')) {
            resolve(helperResult);
            return;
          }
        }

        const startBridgeProcess = () => {

      // 1. 如果是安装命令，终止当前正在运行的安装进程（如果有）
      const isInstallCommand = commandType === 'install' || commandType === 'panel-install';
      
      if (isInstallCommand && currentInstallProcess) {
        const oldPid = currentInstallProcess.pid;
        // console.log('[runBridge] Terminating existing install process with PID:', oldPid);
        try {
          currentInstallProcess.kill(); // 直接终止，不等待优雅终止
        } catch (err) {
          // console.error('[runBridge] Error terminating existing install process:', err);
        }
        // 立即清空引用，为新进程做准备
        currentInstallProcess = null;
      }
      
      // 2. 启动新进程
      const bridgePath = getBridgePath();
      if (!fs.existsSync(bridgePath)) {
        resolve({ ok: false, error: 'script_missing', details: bridgePath });
        return;
      }
      try {
        fs.accessSync(bridgePath, fs.constants.X_OK);
      } catch {
        try {
          fs.chmodSync(bridgePath, 0o755);
        } catch (err) {
          resolve({ ok: false, error: 'script_not_executable', details: err.message });
          return;
        }
      }
      const cwd = app.isPackaged ? APP_DATA_DIR : ROOT_DIR;
      const childEnv = { ...process.env };
      if (sudoPass) {
        childEnv.CLASHFOX_SUDO_PASS = sudoPass;
      }
      const child = spawn('bash', [bridgePath, ...bridgeArgs], { cwd, env: childEnv });
      const processId = child.pid;
      
      // 只跟踪安装进程
      if (isInstallCommand) {
        currentInstallProcess = child;
        // console.log('[runBridge] Tracking install process with PID:', processId);
      }
      
      // console.log('[runBridge] Started new', commandType, 'process with PID:', processId);
      
      // 3. 进程输出和终止处理
      let stdout = '';
      let stderr = '';
      let resolved = false;
      
      // 超时保护
      const timeoutMs = isInstallCommand ? 180000 : 30000;
      const timeout = setTimeout(() => {
        if (!resolved && child) {
          // console.log('[runBridge] Process timeout, killing PID:', processId);
          try {
            child.kill();
          } catch (err) {
            // console.error('[runBridge] Error killing timed-out process:', err);
          }
        }
      }, timeoutMs);

      // 输出收集
      if (child.stdout) {
        child.stdout.on('data', (chunk) => {
          const text = chunk.toString();
          stdout += text;
          if (isInstallCommand) {
            const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
            lines.forEach((line) => {
              const phaseInfo = detectInstallPhaseFromLine(line);
              if (phaseInfo) {
                emitMainCoreAction({
                  action: 'install',
                  phase: phaseInfo.phase,
                  message: phaseInfo.message,
                  raw: line,
                });
              }
            });
          }
        });
      }

      if (child.stderr) {
        child.stderr.on('data', (chunk) => {
          stderr += chunk.toString();
        });
      }

      // 进程终止处理
      const handleTermination = (code, signal) => {
        if (resolved) return;
        resolved = true;
        
        clearTimeout(timeout);
        
        // 只在当前进程是这个安装进程时才清空引用
        if (isInstallCommand && currentInstallProcess === child) {
          currentInstallProcess = null;
          // console.log('[runBridge] Cleared install process reference for PID:', processId);
        }
        
        const output = stdout.trim();
        
        // 检查是否为取消操作
        if (signal === 'SIGINT' || (code && code > 128)) {
          resolve({ 
            ok: false, 
            error: 'cancelled', 
            details: 'Operation was cancelled by user' 
          });
          return;
        }
        
        // 处理输出
        if (!output) {
          resolve({ 
            ok: false, 
            error: 'empty_output', 
            details: stderr.trim() 
          });
          return;
        }
        
        try {
          const parsed = parseBridgeOutput(output);
          resolve(parsed);
        } catch (err) {
          console.error('[runBridge] JSON parse error:', err);
          resolve({
            ok: false,
            error: 'parse_error',
            details: output
          });
        }
      };
      
      // 监听进程事件
      child.on('close', handleTermination);
      child.on('exit', handleTermination);
      
      child.on('error', (err) => {
        if (resolved) return;
        resolved = true;
        
        clearTimeout(timeout);
        
        if (isInstallCommand && currentInstallProcess === child) {
          currentInstallProcess = null;
          // console.log('[runBridge] Cleared install process reference for PID:', processId, '(error case)');
        }
        
        resolve({ 
          ok: false, 
          error: 'process_error', 
          details: err.message 
        });
      });
        };
        startBridgeProcess();
      } catch (err) {
        console.error('[runBridge] unexpected error:', {
          args,
          message: err && err.message ? err.message : String(err),
        });
        resolve({ 
          ok: false, 
          error: 'unexpected_error', 
          details: err.message 
        });
      }
    })();
  });
}

function parseBridgeOutput(output) {
  const trimmed = (output || '').trim();
  if (!trimmed) {
    throw new Error('empty_output');
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    const lines = trimmed.split(/\r?\n/);
    for (const line of lines) {
      const candidate = line.trim();
      if (!candidate) continue;
      if (candidate.startsWith('{') || candidate.startsWith('[')) {
        try {
          return JSON.parse(candidate);
        } catch {
          // continue searching
        }
      }
    }
  }
  throw new Error('parse_failed');
}

function createWindow(showOnCreate = false) {
  nativeTheme.themeSource = 'system';
  if (showOnCreate) {
    persistMainWindowClosedToSettings(false);
  }
  const mainWindowSize = resolveMainWindowSizeFromSettings();
  const win = new BrowserWindow({
    show: Boolean(showOnCreate),
    width: mainWindowSize.width,
    height: mainWindowSize.height,
    minWidth: MIN_MAIN_WINDOW_WIDTH,
    minHeight: MIN_MAIN_WINDOW_HEIGHT,
    backgroundColor: '#0f1216',
    icon: path.join(APP_PATH, 'src', 'ui', 'assets', 'logo.png'),
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      devTools: true,
    },
  });

  win.loadFile(path.join(__dirname, 'ui', 'html', 'index.html'));

  mainWindow = win;

  const attachDashboardAuth = () => {
    const settingsPath = path.join(APP_DATA_DIR, 'settings.json');
    win.webContents.session.webRequest.onBeforeSendHeaders((details, callback) => {
      const url = details.url || '';
      const isLocalControllerRequest =
        url.startsWith('http://127.0.0.1:9090/')
        || url.startsWith('http://localhost:9090/')
        || url.startsWith('ws://127.0.0.1:9090/')
        || url.startsWith('ws://localhost:9090/');
      if (!isLocalControllerRequest) {
        callback({ requestHeaders: details.requestHeaders });
        return;
      }
      let secret = '';
      try {
        if (fs.existsSync(settingsPath)) {
          const raw = fs.readFileSync(settingsPath, 'utf8');
          const parsed = mergePanelManagerAliases(JSON.parse(raw));
          if (parsed && typeof parsed.secret === 'string') {
            secret = parsed.secret.trim();
          }
        }
      } catch {
        // ignore
      }
      if (secret) {
        details.requestHeaders = {
          ...details.requestHeaders,
          Authorization: `Bearer ${secret}`,
        };
      }
      callback({ requestHeaders: details.requestHeaders });
    });
  };
  attachDashboardAuth();

  win.on('close', (event) => {
    if (isQuitting) {
      return;
    }
    event.preventDefault();
    persistMainWindowClosedToSettings(true);
    win.hide();
    if (app.dock && app.dock.hide) {
      app.dock.hide();
    }
  });

  win.on('resize', () => {
    if (!win || win.isDestroyed() || win.isMinimized() || win.isMaximized() || win.isFullScreen()) {
      return;
    }
    if (mainWindowResizePersistTimer) {
      clearTimeout(mainWindowResizePersistTimer);
    }
    mainWindowResizePersistTimer = setTimeout(() => {
      if (!win || win.isDestroyed()) {
        return;
      }
      const [width, height] = win.getSize();
      persistMainWindowSizeToSettings(width, height);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('clashfox:mainWindowResize', { width, height });
      }
    }, 180);
  });

  win.on('closed', () => {
    if (mainWindowResizePersistTimer) {
      clearTimeout(mainWindowResizePersistTimer);
      mainWindowResizePersistTimer = null;
    }
  });

  win.webContents.on('before-input-event', (event, input) => {
    const key = (input.key || '').toLowerCase();
    const isReloadCombo = (input.control || input.meta) && key === 'r';
    const isReloadKey = key === 'f5';
    if (isReloadCombo || isReloadKey) {
      event.preventDefault();
      if (!win.isDestroyed() && !win.isMaximized() && !win.isFullScreen()) {
        const [width, height] = win.getSize();
        persistMainWindowSizeToSettings(width, height);
        suppressMainWindowSizeApplyUntil = Date.now() + 4000;
      }
      if (globalSettings.debugMode) {
        try {
          win.webContents.reload();
        } catch {
          // ignore reload failures
        }
      }
      return;
    }
    if (globalSettings.debugMode) {
      return;
    }
    const isDevToolsCombo =
      (input.control && input.shift && key === 'i') ||
      (input.meta && input.alt && key === 'i') ||
      key === 'f12';
    if (isDevToolsCombo) {
      event.preventDefault();
    }
  });

  const sendSystemTheme = () => {
    setDockIcon(true);
    BrowserWindow.getAllWindows().forEach((window) => {
      if (!window || window.isDestroyed()) {
        return;
      }
      window.webContents.send('clashfox:systemTheme', {
        dark: nativeTheme.shouldUseDarkColors,
      });
    });
  };

  win.webContents.on('did-finish-load', sendSystemTheme);
  win.webContents.on('did-start-loading', () => {
    if (!win || win.isDestroyed() || win.isMaximized() || win.isFullScreen()) {
      return;
    }
    const [width, height] = win.getSize();
    persistMainWindowSizeToSettings(width, height);
    suppressMainWindowSizeApplyUntil = Date.now() + 4000;
  });
  nativeTheme.on('updated', sendSystemTheme);

  // Do not auto-open DevTools here; it should only open when toggled on.
}

function getBuildNumber() {
  try {
    // APP_PATH points to app.asar when packaged, ensuring package.json is found.
    const pkgPath = path.join(APP_PATH, 'package.json');
    const raw = fs.readFileSync(pkgPath, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed.buildNumber;
  } catch {
    return undefined;
  }
}

function createAboutWindow() {
  if (!mainWindow) {
    return;
  }
  const aboutWindow = new BrowserWindow({
    width: 420,
    height: 280,
    resizable: false,
    minimizable: false,
    maximizable: false,
    parent: mainWindow,
    modal: true,
    title: 'About ClashFox',
    backgroundColor: '#0f1216',
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true,
      devTools: false
    },
  });

  aboutWindow.loadFile(path.join(__dirname, 'ui', 'html', 'about.html'));
}

function loadDockIconFromIcns(iconPath) {
  if (!fs.existsSync(iconPath)) {
    return null;
  }
  try {
    const iconFromPath = nativeImage.createFromPath(iconPath);
    if (!iconFromPath.isEmpty()) {
      return { image: iconFromPath, via: 'path' };
    }
  } catch {
    // ignore and continue fallback chain
  }
  try {
    const iconBuffer = fs.readFileSync(iconPath);
    const iconFromBuffer = nativeImage.createFromBuffer(iconBuffer);
    if (!iconFromBuffer.isEmpty()) {
      return { image: iconFromBuffer, via: 'buffer' };
    }
  } catch {
    // ignore and continue fallback chain
  }
  try {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clashfox-dock-'));
    const iconsetDir = path.join(tmpDir, 'icon.iconset');
    const iconutilResult = spawnSync(
      'iconutil',
      ['-c', 'iconset', iconPath, '-o', iconsetDir],
      { stdio: 'ignore' },
    );
    if (iconutilResult.error || iconutilResult.status !== 0) {
      console.warn('[dock-icon] iconutil conversion failed', {
        iconPath,
        code: iconutilResult.error?.code ?? null,
        status: iconutilResult.status,
      });
      fs.rmSync(tmpDir, { recursive: true, force: true });
      return null;
    }
    const pngPath = path.join(iconsetDir, 'icon_512x512@2x.png');
    if (fs.existsSync(pngPath)) {
      const iconFromPng = nativeImage.createFromPath(pngPath);
      if (!iconFromPng.isEmpty()) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
        return { image: iconFromPng, via: 'iconutil-png' };
      }
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    // ignore
  }
  return null;
}

function setDockIcon() {
  if (!app.dock) {
    return;
  }
  const isDark = nativeTheme.shouldUseDarkColors;
  const icnsDir = path.join(APP_PATH, 'src', 'ui', 'assets', 'icns');
  const iconCandidates = isDark
    ? [
      path.join(icnsDir, 'logo_night.icns'),
      path.join(icnsDir, 'logo.icns'),
    ]
    : [
      path.join(icnsDir, 'logo_light.icns'),
      path.join(icnsDir, 'logo.icns'),
    ];

  for (const iconPath of iconCandidates) {
    const loaded = loadDockIconFromIcns(iconPath);
    if (loaded && loaded.image && !loaded.image.isEmpty()) {
      app.dock.setIcon(loaded.image);
      if (isDev) {
        // console.log(`[dock] icon hit (${loaded.via}):`, iconPath);
      }
      return;
    }
  }
  if (isDev) {
    console.log('[dock] icon not set: all candidates failed');
  }
}

app.whenReady().then(() => {
  ensureAppDirs();
  setDockIcon();
  createTrayMenu();
  const shouldShowMainWindow = !readMainWindowClosedFromSettings();
  createWindow(shouldShowMainWindow);
  if (app.dock && app.dock.show) {
    if (shouldShowMainWindow) {
      app.dock.show();
    } else {
      app.dock.hide();
    }
  }
  ensureTrayMenuWindow();
  setTimeout(() => {
    checkHelperOnStartup().catch(() => {});
  }, 1200);
  setTimeout(() => {
    syncHelperStatusToSettings().catch(() => {});
  }, 1500);
  setTimeout(setDockIcon, 500);
  setTimeout(setDockIcon, 1500);
  setTimeout(setDockIcon, 3000);
  setTimeout(() => {
    preloadFoxboardWindow();
  }, 1600);
  setTimeout(() => {
    preloadWorldwideWindow();
  }, 1700);

  applyAppMenu();

  ipcMain.handle('clashfox:command', async (_event, command, args = [], options = {}) => {
    const cmd = String(command || '').trim();
    const cmdArgs = Array.isArray(args) ? args : [];
    guiMainLog('command', 'ipc command received', { cmd, args: cmdArgs });
    let result;
    if (cmd === 'configs') {
      result = listConfigFilesFromFs();
    } else if (cmd === 'kernels') {
      result = listKernelFilesFromFs();
    } else {
      result = await runBridgeWithAutoAuth(cmd, cmdArgs, options);
    }
    guiMainLog('command', 'ipc command result', {
      cmd,
      ok: Boolean(result && result.ok),
      error: result && result.error ? result.error : '',
    });
    if (result && result.ok && ['start', 'stop', 'restart', 'system-proxy-enable', 'system-proxy-disable'].includes(command)) {
      await createTrayMenu();
    }
    return result;
  });

  ipcMain.handle('clashfox:detectTunConflict', async () => detectTunConflictLikely());

  ipcMain.handle('clashfox:worldwideSnapshot', async (_event, options = {}) => {
    try {
      return await buildWorldwideSnapshot(options);
    } catch (error) {
      return {
        ok: false,
        error: 'worldwide_snapshot_failed',
        details: String(error && error.message ? error.message : error || ''),
      };
    }
  });

  ipcMain.handle('clashfox:dashboardSnapshot', async (_event, options = {}) => {
    try {
      return await buildDashboardSnapshot(options);
    } catch (error) {
      return {
        ok: false,
        error: 'dashboard_snapshot_failed',
        details: String(error && error.message ? error.message : error || ''),
      };
    }
  });

  ipcMain.handle('clashfox:getOverviewNetworkSnapshot', async () => {
    try {
      return await buildOverviewNetworkSnapshot();
    } catch (error) {
      return {
        ok: false,
        error: 'overview_network_snapshot_failed',
        details: String(error && error.message ? error.message : error || ''),
      };
    }
  });

  ipcMain.handle('clashfox:reloadMihomoCore', async (_event, source = {}) => runControllerConfigRequestMain(source, [
    {
      method: 'POST',
      path: '/restart',
    },
  ]));

  ipcMain.handle('clashfox:getMihomoConfigs', async (_event, source = {}) => getControllerConfigsMain(source));
  ipcMain.handle('clashfox:getMihomoVersion', async (_event, source = {}) => getControllerVersionMain(source));

  ipcMain.handle('clashfox:reloadMihomoConfig', async (_event, source = {}) => runControllerConfigRequestMain(source, [
    {
      method: 'PUT',
      path: '/configs?reload=true',
      headers: { 'Content-Type': 'application/json' },
      body: { path: '', payload: '' },
    },
  ]));

  ipcMain.handle('clashfox:updateMihomoConfig', async (_event, patch = {}, source = {}) => {
    const configPatch = patch && typeof patch === 'object' && !Array.isArray(patch) ? patch : {};
    if (!Object.keys(configPatch).length) {
      return { ok: false, error: 'invalid_config_patch' };
    }
    return runControllerConfigRequestMain(source, [
      {
        method: 'PATCH',
        path: '/configs',
        headers: { 'Content-Type': 'application/json' },
        body: configPatch,
      },
      {
        method: 'PUT',
        path: '/configs',
        headers: { 'Content-Type': 'application/json' },
        body: configPatch,
      },
    ]);
  });

  ipcMain.handle('clashfox:updateMihomoAllowLan', async (_event, enabled, source = {}) => runControllerConfigRequestMain(source, [
    {
      method: 'PATCH',
      path: '/configs',
      headers: { 'Content-Type': 'application/json' },
      body: { 'allow-lan': Boolean(enabled) },
    },
    {
      method: 'PUT',
      path: '/configs',
      headers: { 'Content-Type': 'application/json' },
      body: { 'allow-lan': Boolean(enabled) },
    },
  ]));

  ipcMain.handle('clashfox:providerSubscriptionOverview', async () => {
    try {
      const raw = await loadProvidersProxiesRaw();
      if (!raw || !raw.ok) {
        return raw || { ok: false, error: 'provider_subscription_overview_failed' };
      }
      return {
        ok: true,
        data: buildProviderSubscriptionOverviewData(raw.data || {}),
      };
    } catch (error) {
      return {
        ok: false,
        error: 'provider_subscription_overview_failed',
        details: String(error && error.message ? error.message : error || ''),
      };
    }
  });

  ipcMain.handle('clashfox:providerProxyTree', async () => {
    try {
      const raw = await loadProvidersProxiesRaw();
      if (!raw || !raw.ok) {
        return raw || { ok: false, error: 'provider_proxy_tree_failed' };
      }
      return {
        ok: true,
        data: buildProviderProxyTreeData(raw.data || {}),
      };
    } catch (error) {
      return {
        ok: false,
        error: 'provider_proxy_tree_failed',
        details: String(error && error.message ? error.message : error || ''),
      };
    }
  });

  ipcMain.handle('clashfox:rulesOverview', async () => {
    try {
      const raw = await loadRulesRaw();
      if (!raw || !raw.ok) {
        return raw || { ok: false, error: 'rules_overview_failed' };
      }
      return {
        ok: true,
        data: buildRulesOverviewData(raw.data || {}),
      };
    } catch (error) {
      return {
        ok: false,
        error: 'rules_overview_failed',
        details: String(error && error.message ? error.message : error || ''),
      };
    }
  });

  ipcMain.handle('clashfox:ruleProvidersOverview', async () => {
    try {
      const raw = await loadRuleProvidersRaw();
      if (!raw || !raw.ok) {
        return raw || { ok: false, error: 'rule_providers_overview_failed' };
      }
      return {
        ok: true,
        data: buildRuleProvidersOverviewData(raw.data || {}),
      };
    } catch (error) {
      return {
        ok: false,
        error: 'rule_providers_overview_failed',
        details: String(error && error.message ? error.message : error || ''),
      };
    }
  });

  ipcMain.handle('clashfox:trayMenu:getData', async () => {
    const data = await createTrayMenu();
    return data || trayMenuData || {};
  });

  ipcMain.handle('clashfox:trayMenu:connectivity', async () => {
    const configPath = getConfigPathFromSettings();
    const snapshot = await getConnectivityQualitySnapshot(configPath);
    patchTrayMenuConnectivityBadge(snapshot);
    return snapshot || { text: '-', tone: 'neutral' };
  });

  ipcMain.handle('clashfox:trayMenu:action', async (_event, action, payload = {}) => {
    const result = await handleTrayMenuAction(action, payload);
    guiMainLog('tray', 'action completed', {
      action,
      ok: Boolean(result && result.ok),
      error: result && result.ok ? '' : String((result && result.error) || '').trim(),
    }, result && result.ok ? 'log' : 'warn');
    const skipRebuildActions = new Set(['toggle-system-proxy', 'toggle-tun']);
    if (!skipRebuildActions.has(String(action || '').trim())) {
      createTrayMenu().catch(() => {});
    }
    return result || { ok: false };
  });

  ipcMain.on('clashfox:trayMenu:hide', () => {
    hideTrayMenuWindow();
  });

  ipcMain.on('clashfox:trayMenu:rendererReady', () => {
    trayMenuRendererReady = true;
    if (trayMenuWindow && !trayMenuWindow.isDestroyed() && trayMenuData) {
      trayMenuWindow.webContents.send('clashfox:trayMenu:update', trayMenuData);
    }
  });

  ipcMain.on('clashfox:trayMenu:setExpanded', (_event, expanded, payload = {}) => {
    const requestedWidth = payload && Number.isFinite(payload.width)
      ? Number(payload.width)
      : 260;
    const requestedHeight = payload && Number.isFinite(payload.height) ? Number(payload.height) : trayMenuContentHeight;
    trayMenuContentHeight = Math.max(200, Math.min(requestedHeight || trayMenuContentHeight || 420, 760));
    if (trayMenuWindow && !trayMenuWindow.isDestroyed()) {
      applyTrayMenuWindowBounds(trayMenuContentHeight, trayMenuVisible, requestedWidth, false);
    }
  });
  ipcMain.on('clashfox:trayMenu:openSubmenu', async (_event, payload = {}) => {
    if (
      !trayMenuVisible
      || trayMenuClosing
      || !trayMenuWindow
      || trayMenuWindow.isDestroyed()
      || !trayMenuWindow.isFocused()
    ) {
      return;
    }
    const key = payload && payload.key ? String(payload.key) : '';
    const items = (trayMenuData
      && trayMenuData.submenus
      && Array.isArray(trayMenuData.submenus[key]))
      ? trayMenuData.submenus[key]
      : (Array.isArray(payload.items) ? payload.items : []);
    const popup = ensureTraySubmenuWindow();
    traySubmenuAnchor = {
      top: Number(payload && payload.anchorTop) || 0,
      height: Number(payload && payload.anchorHeight) || 0,
      rootHeight: Number(payload && payload.rootHeight) || 0,
    };
    traySubmenuLastSize = { width: 0, height: 0 };
    traySubmenuVisible = true;
    sendTraySubmenuUpdate({
      key,
      items,
    });
    if (!popup.isVisible()) {
      popup.show();
    }
  });

  ipcMain.on('clashfox:trayMenu:closeSubmenu', () => {
    hideTraySubmenuWindow();
  });

  ipcMain.on('clashfox:traySubmenu:resize', (_event, payload = {}) => {
    if (
      !trayMenuVisible
      || trayMenuClosing
      || !trayMenuWindow
      || trayMenuWindow.isDestroyed()
      || !trayMenuWindow.isFocused()
    ) {
      hideTraySubmenuWindow();
      return;
    }
    const width = Math.max(140, Math.round(Number(payload && payload.width) || 0));
    const height = Math.max(60, Math.round(Number(payload && payload.height) || 0));
    traySubmenuLastSize = { width, height };
    positionTraySubmenuWindow(width, height);
    const popup = ensureTraySubmenuWindow();
    traySubmenuVisible = true;
    if (!popup.isVisible()) {
      popup.show();
    }
  });

  ipcMain.on('clashfox:traySubmenu:hover', (_event, hovering) => {
    traySubmenuHovering = Boolean(hovering);
    if (!traySubmenuHovering && (!trayMenuWindow || trayMenuWindow.isDestroyed() || !trayMenuWindow.isFocused())) {
      hideTrayMenuWindow();
    }
  });

  ipcMain.on('clashfox:traySubmenu:ready', () => {
    traySubmenuReady = true;
    if (
      !trayMenuVisible
      || trayMenuClosing
      || !trayMenuWindow
      || trayMenuWindow.isDestroyed()
      || !trayMenuWindow.isFocused()
    ) {
      hideTraySubmenuWindow();
      return;
    }
    if (traySubmenuPendingPayload) {
      sendTraySubmenuUpdate(traySubmenuPendingPayload);
    }
    if (traySubmenuVisible && traySubmenuLastSize.width && traySubmenuLastSize.height) {
      positionTraySubmenuWindow(traySubmenuLastSize.width, traySubmenuLastSize.height);
      if (traySubmenuWindow && !traySubmenuWindow.isDestroyed()) {
        traySubmenuWindow.show();
      }
    }
  });

  ipcMain.on('clashfox:traySubmenu:hide', () => {
    hideTraySubmenuWindow();
  });
  
  // 处理取消命令，只取消安装进程
  ipcMain.handle('clashfox:cancelCommand', () => {
    if (currentInstallProcess) {
      const pid = currentInstallProcess.pid;
      // console.log('[cancelCommand] Cancelling install process with PID:', pid);
      try {
        // 发送SIGINT信号终止安装进程
        currentInstallProcess.kill('SIGINT');
        return { ok: true, message: 'Install cancellation initiated' };
      } catch (err) {
        // console.error('[cancelCommand] Error cancelling install process:', err);
        return { ok: false, error: 'cancel_error', details: err.message };
      }
    }
    return { ok: false, error: 'no_install_command_running' };
  });

  ipcMain.handle('clashfox:selectConfig', async () => {
    guiMainLog('ipc-file', 'selectConfig requested');
    const result = await dialog.showOpenDialog({
      title: 'Select Config File',
      properties: ['openFile'],
      filters: [
        { name: 'Config', extensions: ['yaml', 'yml', 'json'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    if (result.canceled || result.filePaths.length === 0) {
      guiMainLog('ipc-file', 'selectConfig cancelled');
      return { ok: false, error: 'cancelled' };
    }

    guiMainLog('ipc-file', 'selectConfig completed', {
      path: result.filePaths[0],
    });
    return { ok: true, path: result.filePaths[0] };
  });

  ipcMain.handle('clashfox:deleteConfig', async (_event, targetPath) => {
    guiMainLog('ipc-file', 'deleteConfig requested', {
      targetPath: String(targetPath || ''),
    });
    try {
      if (!targetPath || typeof targetPath !== 'string') {
        guiMainLog('ipc-file', 'deleteConfig failed', { error: 'invalid_path' }, 'warn');
        return { ok: false, error: 'invalid_path' };
      }
      const resolvedTarget = path.resolve(String(targetPath));
      const configDir = resolveConfigDirectoryFromSettings();
      const normalizedDir = path.resolve(configDir);
      const dirPrefix = `${normalizedDir}${path.sep}`;
      if (!(resolvedTarget === normalizedDir || resolvedTarget.startsWith(dirPrefix))) {
        guiMainLog('ipc-file', 'deleteConfig failed', {
          targetPath: resolvedTarget,
          error: 'outside_config_dir',
        }, 'warn');
        return { ok: false, error: 'outside_config_dir' };
      }
      const settings = readAppSettings();
      const currentConfig = settings && typeof settings.configFile === 'string'
        ? path.resolve(settings.configFile)
        : '';
      if (currentConfig && resolvedTarget === currentConfig) {
        guiMainLog('ipc-file', 'deleteConfig failed', {
          targetPath: resolvedTarget,
          error: 'current_config',
        }, 'warn');
        return { ok: false, error: 'current_config' };
      }
      if (!fs.existsSync(resolvedTarget)) {
        guiMainLog('ipc-file', 'deleteConfig failed', {
          targetPath: resolvedTarget,
          error: 'not_found',
        }, 'warn');
        return { ok: false, error: 'not_found' };
      }
      const stat = fs.statSync(resolvedTarget);
      if (!stat.isFile()) {
        guiMainLog('ipc-file', 'deleteConfig failed', {
          targetPath: resolvedTarget,
          error: 'not_file',
        }, 'warn');
        return { ok: false, error: 'not_file' };
      }
      fs.unlinkSync(resolvedTarget);
      guiMainLog('ipc-file', 'deleteConfig completed', {
        targetPath: resolvedTarget,
      });
      return { ok: true, path: resolvedTarget };
    } catch (err) {
      guiMainLog('ipc-file', 'deleteConfig threw', {
        targetPath: String(targetPath || ''),
        error: err && err.message ? err.message : 'delete_failed',
      }, 'error');
      return { ok: false, error: err && err.message ? err.message : 'delete_failed' };
    }
  });

  ipcMain.handle('clashfox:importConfig', async () => {
    guiMainLog('ipc-file', 'importConfig requested');
    const selection = await dialog.showOpenDialog({
      title: 'Import Config File',
      properties: ['openFile'],
      filters: [
        { name: 'Config', extensions: ['yaml', 'yml', 'json'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });
    if (selection.canceled || selection.filePaths.length === 0) {
      guiMainLog('ipc-file', 'importConfig cancelled');
      return { ok: false, error: 'cancelled' };
    }
    const sourcePath = selection.filePaths[0];
    try {
      ensureAppDirs();
      const targetDir = resolveConfigDirectoryFromSettings();
      fs.mkdirSync(targetDir, { recursive: true });
      const sourceName = path.basename(sourcePath);
      const targetPath = buildUniqueFilePath(targetDir, sourceName);
      fs.copyFileSync(sourcePath, targetPath);
      guiMainLog('ipc-file', 'importConfig completed', {
        sourcePath,
        targetPath,
      });
      return {
        ok: true,
        data: {
          sourcePath,
          targetPath,
          fileName: path.basename(targetPath),
          configDir: targetDir,
        },
      };
    } catch (err) {
      guiMainLog('ipc-file', 'importConfig threw', {
        sourcePath,
        error: err && err.message ? err.message : 'import_failed',
      }, 'error');
      return { ok: false, error: err && err.message ? err.message : 'import_failed' };
    }
  });

  ipcMain.handle('clashfox:selectDirectory', async (_event, title) => {
    guiMainLog('ipc-file', 'selectDirectory requested', {
      title: String(title || ''),
    });
    const result = await dialog.showOpenDialog({
      title: title || 'Select Directory',
      properties: ['openDirectory', 'createDirectory'],
    });

    if (result.canceled || result.filePaths.length === 0) {
      guiMainLog('ipc-file', 'selectDirectory cancelled');
      return { ok: false, error: 'cancelled' };
    }

    guiMainLog('ipc-file', 'selectDirectory completed', {
      path: result.filePaths[0],
    });
    return { ok: true, path: result.filePaths[0] };
  });

  ipcMain.handle('clashfox:openAbout', () => {
    createAboutWindow();
    return { ok: true };
  });

  ipcMain.handle('clashfox:openExternal', async (_event, url) => {
    guiMainLog('ipc-file', 'openExternal requested', {
      url: String(url || ''),
    });
    if (!url || typeof url !== 'string') {
      guiMainLog('ipc-file', 'openExternal failed', { error: 'invalid_url' }, 'warn');
      return { ok: false };
    }
    try {
      await shell.openExternal(url);
      guiMainLog('ipc-file', 'openExternal completed', { url });
      return { ok: true };
    } catch (err) {
      guiMainLog('ipc-file', 'openExternal threw', {
        url,
        error: err && err.message ? err.message : '',
      }, 'error');
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('clashfox:revealInFinder', (_event, targetPath) => {
    guiMainLog('ipc-file', 'revealInFinder requested', {
      targetPath: String(targetPath || ''),
    });
    try {
      if (!targetPath || typeof targetPath !== 'string') {
        guiMainLog('ipc-file', 'revealInFinder failed', { error: 'invalid_path' }, 'warn');
        return { ok: false };
      }
      const resolved = path.resolve(String(targetPath));
      let openTarget = resolved;
      try {
        const stat = fs.existsSync(resolved) ? fs.statSync(resolved) : null;
        if (stat && stat.isFile()) {
          openTarget = path.dirname(resolved);
        }
      } catch {
        // ignore
      }
      const result = shell.openPath(openTarget);
      if (result && typeof result.then === 'function') {
        return result.then((err) => {
          if (err) {
            guiMainLog('ipc-file', 'revealInFinder failed', {
              targetPath: resolved,
              openTarget,
              error: err,
            }, 'warn');
            return { ok: false, error: err };
          }
          guiMainLog('ipc-file', 'revealInFinder completed', {
            targetPath: resolved,
            openTarget,
          });
          return { ok: true };
        });
      }
      guiMainLog('ipc-file', 'revealInFinder completed', {
        targetPath: resolved,
        openTarget,
      });
      return { ok: true };
    } catch (err) {
      guiMainLog('ipc-file', 'revealInFinder threw', {
        targetPath: String(targetPath || ''),
        error: err && err.message ? err.message : '',
      }, 'error');
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('clashfox:clearUiStorage', async () => {
    try {
      const origin = 'http://127.0.0.1:9090';
      await session.defaultSession.clearStorageData({
        origin,
        storages: ['serviceworkers', 'caches'],
      });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('clashfox:readSettings', async () => {
    try {
      ensureAppDirs();
      const settingsPath = path.join(APP_DATA_DIR, 'settings.json');
      const defaultConfigPath = path.join(APP_DATA_DIR, 'config', 'default.yaml');
      if (!fs.existsSync(settingsPath)) {
        const defaults = {
          configFile: defaultConfigPath,
          proxy: 'rule',
          systemProxy: false,
          tun: false,
          stack: 'Mixed',
          mixedPort: 7893,
          port: 7890,
          socksPort: 7891,
          allowLan: true,
          generalPageSize: '10',
          trayMenu: {
            chartEnabled: true,
            providerTrafficEnabled: true,
            trackersEnabled: true,
            foxboardEnabled: true,
            kernelManagerEnabled: true,
            directoryLocationsEnabled: true,
            copyShellExportCommandEnabled: true,
          },
          kernel: {},
          device: resolveCurrentDeviceSnapshot('electron'),
          mihomoStatus: {
            running: false,
            source: 'init',
            updatedAt: new Date().toISOString(),
          },
        };
        const status = await getHelperStatus();
        defaults.helperStatus = normalizeHelperStatusPayload(status);
        writeAppSettings(defaults);
        return {
          ok: true,
          data: mergeAppearanceAliases(mergePanelManagerAliases(mergeUserDataPathAliases(normalizeSettingsForStorage(defaults)))),
        };
      }
      const raw = fs.readFileSync(settingsPath, 'utf8');
      const parsed = JSON.parse(raw) || {};
      const parsedPaths = parsed.userDataPaths && typeof parsed.userDataPaths === 'object'
        ? parsed.userDataPaths
        : {};
      let changed = false;
      if (!parsed.configFile && typeof parsed.configPath === 'string') {
        parsed.configFile = parsed.configPath;
        changed = true;
      }
      if (Object.prototype.hasOwnProperty.call(parsed, 'configPath')) {
        delete parsed.configPath;
        changed = true;
      }
      if (!parsed.configFile && !(parsedPaths && parsedPaths.configFile)) {
        parsed.configFile = defaultConfigPath;
        changed = true;
      }
      if (!Object.prototype.hasOwnProperty.call(parsed, 'mixedPort')) {
        parsed.mixedPort = 7893;
        changed = true;
      }
      if (!Object.prototype.hasOwnProperty.call(parsed, 'port')) {
        parsed.port = 7890;
        changed = true;
      }
      if (!Object.prototype.hasOwnProperty.call(parsed, 'proxy')) {
        parsed.proxy = 'rule';
        changed = true;
      }
      if (!Object.prototype.hasOwnProperty.call(parsed, 'systemProxy')) {
        parsed.systemProxy = false;
        changed = true;
      }
      if (!Object.prototype.hasOwnProperty.call(parsed, 'tun')) {
        parsed.tun = false;
        changed = true;
      }
      if (!Object.prototype.hasOwnProperty.call(parsed, 'stack')) {
        parsed.stack = 'Mixed';
        changed = true;
      }
      if (!Object.prototype.hasOwnProperty.call(parsed, 'socksPort')) {
        parsed.socksPort = 7891;
        changed = true;
      }
      if (!Object.prototype.hasOwnProperty.call(parsed, 'allowLan')) {
        parsed.allowLan = true;
        changed = true;
      }
      const parsedTrayMenu = parsed.trayMenu && typeof parsed.trayMenu === 'object'
        ? parsed.trayMenu
        : {};
      if (!parsed.trayMenu || typeof parsed.trayMenu !== 'object') {
        parsed.trayMenu = parsedTrayMenu;
        changed = true;
      }
      const ensureTrayFlag = (key) => {
        if (Object.prototype.hasOwnProperty.call(parsedTrayMenu, key)) {
          return;
        }
        if (Object.prototype.hasOwnProperty.call(parsed, key)) {
          parsedTrayMenu[key] = Boolean(parsed[key]);
        } else {
          parsedTrayMenu[key] = true;
        }
        changed = true;
      };
      ensureTrayFlag('chartEnabled');
      ensureTrayFlag('providerTrafficEnabled');
      ensureTrayFlag('trackersEnabled');
      ensureTrayFlag('foxboardEnabled');
      ensureTrayFlag('kernelManagerEnabled');
      ensureTrayFlag('directoryLocationsEnabled');
      ensureTrayFlag('copyShellExportCommandEnabled');
      ensureTrayFlag('trayMenuChartEnabled');
      ensureTrayFlag('trayMenuProviderTrafficEnabled');
      ensureTrayFlag('trayMenuTrackersEnabled');
      ensureTrayFlag('trayMenuFoxboardEnabled');
      ensureTrayFlag('trayMenuKernelManagerEnabled');
      ensureTrayFlag('trayMenuDirectoryLocationsEnabled');
      ensureTrayFlag('trayMenuCopyShellExportCommandEnabled');
      [
        'chartEnabled',
        'providerTrafficEnabled',
        'trackersEnabled',
        'foxboardEnabled',
        'kernelManagerEnabled',
        'directoryLocationsEnabled',
        'copyShellExportCommandEnabled',
        'trayMenuChartEnabled',
        'trayMenuProviderTrafficEnabled',
        'trayMenuTrackersEnabled',
        'trayMenuFoxboardEnabled',
        'trayMenuKernelManagerEnabled',
        'trayMenuDirectoryLocationsEnabled',
        'trayMenuCopyShellExportCommandEnabled',
      ].forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(parsed, key)) {
          delete parsed[key];
          changed = true;
        }
      });
      const appearanceGeneralPageSize = parsed.appearance && typeof parsed.appearance === 'object'
        ? String(parsed.appearance.generalPageSize || '').trim()
        : '';
      const legacyGeneralPageSize = String(
        parsed.generalPageSize
        || appearanceGeneralPageSize
        || parsed.backupsPageSize
        || parsed.kernelPageSize
        || '10',
      ).trim() || '10';
      if ((!parsed.generalPageSize && !appearanceGeneralPageSize) || (parsed.generalPageSize && parsed.generalPageSize !== legacyGeneralPageSize)) {
        parsed.generalPageSize = legacyGeneralPageSize;
        changed = true;
      }
      if (Object.prototype.hasOwnProperty.call(parsed, 'backupsPageSize')) {
        delete parsed.backupsPageSize;
        changed = true;
      }
      if (Object.prototype.hasOwnProperty.call(parsed, 'kernelPageSize')) {
        delete parsed.kernelPageSize;
        changed = true;
      }
      if (Object.prototype.hasOwnProperty.call(parsed, 'switchPageSize')) {
        delete parsed.switchPageSize;
        changed = true;
      }
      if (Object.prototype.hasOwnProperty.call(parsed, 'configPageSize')) {
        delete parsed.configPageSize;
        changed = true;
      }
      if (Object.prototype.hasOwnProperty.call(parsed, 'recommendPageSize')) {
        delete parsed.recommendPageSize;
        changed = true;
      }
      if (!parsed.kernel || typeof parsed.kernel !== 'object') {
        parsed.kernel = {};
        changed = true;
      }
      const existingKernel = parsed.kernel && typeof parsed.kernel === 'object' ? parsed.kernel : {};
      const legacyKernelVersion = normalizeKernelVersionValue(parsed.kernelVersion);
      const kernelRawCandidate = normalizeKernelVersionValue(existingKernel.raw || existingKernel.version || legacyKernelVersion);
      const missingCoreFields = !existingKernel.core || !existingKernel.arch || !existingKernel.languageVersion;
      if (kernelRawCandidate && (!normalizeKernelVersionValue(existingKernel.raw) || missingCoreFields)) {
        const parsedKernel = parseKernelVersionDetails(kernelRawCandidate) || {};
        parsed.kernel = {
          ...parsedKernel,
          source: existingKernel.source || 'migrate',
          updatedAt: existingKernel.updatedAt || new Date().toISOString(),
        };
        changed = true;
      }
      if (Object.prototype.hasOwnProperty.call(parsed, 'kernelVersion')) {
        delete parsed.kernelVersion;
        changed = true;
      }
      if (Object.prototype.hasOwnProperty.call(parsed, 'kernelVersionMeta')) {
        delete parsed.kernelVersionMeta;
        changed = true;
      }
      if (!parsed.helperStatus || typeof parsed.helperStatus !== 'object') {
        const status = await getHelperStatus();
        parsed.helperStatus = normalizeHelperStatusPayload(status);
        changed = true;
      }
      if (!parsed.mihomoStatus || typeof parsed.mihomoStatus !== 'object' || typeof parsed.mihomoStatus.running !== 'boolean') {
        parsed.mihomoStatus = {
          running: false,
          source: 'init',
          updatedAt: new Date().toISOString(),
        };
        changed = true;
      }
      const normalized = normalizeSettingsForStorage(parsed);
      if (JSON.stringify(parsed) !== JSON.stringify(normalized)) {
        changed = true;
      }
      if (changed) {
        writeAppSettings(normalized);
      }
      return {
        ok: true,
        data: mergeAppearanceAliases(mergePanelManagerAliases(mergeUserDataPathAliases(normalized))),
      };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('clashfox:getSystemLocale', () => {
    try {
      return {
        ok: true,
        locale: String((app.getLocale && app.getLocale()) || '').trim() || 'en',
      };
    } catch {
      return {
        ok: true,
        locale: 'en',
      };
    }
  });

  ipcMain.handle('clashfox:writeSettings', async (_event, data) => {
    try {
      ensureAppDirs();
      const payload = data && typeof data === 'object' ? { ...data } : {};
      const existing = readAppSettings();
      const merged = { ...existing, ...payload };
      if (!payload.configFile && typeof payload.configPath === 'string') {
        merged.configFile = payload.configPath;
      }
      if (Object.prototype.hasOwnProperty.call(merged, 'configPath')) {
        delete merged.configPath;
      }
      const legacyGeneralPageSize = String(
        merged.generalPageSize
        || merged.backupsPageSize
        || merged.kernelPageSize
        || '10',
      ).trim() || '10';
      merged.generalPageSize = legacyGeneralPageSize;
      if (Object.prototype.hasOwnProperty.call(merged, 'backupsPageSize')) {
        delete merged.backupsPageSize;
      }
      if (Object.prototype.hasOwnProperty.call(merged, 'kernelPageSize')) {
        delete merged.kernelPageSize;
      }
      if (Object.prototype.hasOwnProperty.call(merged, 'switchPageSize')) {
        delete merged.switchPageSize;
      }
      if (Object.prototype.hasOwnProperty.call(merged, 'configPageSize')) {
        delete merged.configPageSize;
      }
      if (Object.prototype.hasOwnProperty.call(merged, 'recommendPageSize')) {
        delete merged.recommendPageSize;
      }
      merged.windowWidth = sanitizeMainWindowDimension(
        merged.windowWidth,
        DEFAULT_MAIN_WINDOW_WIDTH,
        MIN_MAIN_WINDOW_WIDTH,
        MAX_MAIN_WINDOW_WIDTH,
      );
      merged.windowHeight = sanitizeMainWindowDimension(
        merged.windowHeight,
        DEFAULT_MAIN_WINDOW_HEIGHT,
        MIN_MAIN_WINDOW_HEIGHT,
        MAX_MAIN_WINDOW_HEIGHT,
      );
      const normalized = normalizeSettingsForStorage(merged);
      writeAppSettings(normalized);
      const normalizedForUi = mergeAppearanceAliases(
        mergePanelManagerAliases(
          mergeUserDataPathAliases(normalized),
        ),
      );
      const canApplySizeNow = Boolean(
        mainWindow
        && !mainWindow.isDestroyed()
        && mainWindow.webContents
        && !mainWindow.webContents.isLoadingMainFrame(),
      );
      if (canApplySizeNow && Date.now() > Number(suppressMainWindowSizeApplyUntil || 0)) {
        mainWindow.setSize(normalizedForUi.windowWidth, normalizedForUi.windowHeight);
      }
      trayMenuData = null;
      trayMenuDataSignature = '';
      trayMenuLastBuiltAt = 0;
      refreshTrayMenuLabelsOnly();
      await createTrayMenu();
      emitSettingsUpdated(normalizedForUi);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('clashfox:userDataPath', () => {
    return { ok: true, path: APP_DATA_DIR };
  });

  ipcMain.handle('clashfox:setDebugMode', (_event, enabled) => {
    const next = Boolean(enabled);
    if (globalSettings.debugMode === next) {
      return { ok: true, unchanged: true };
    }
    globalSettings.debugMode = next;
    applyDevToolsState();
    return { ok: true };
  });

  ipcMain.handle('clashfox:setThemeSource', (_event, source) => {
    const allowed = new Set(['system', 'light', 'dark']);
    const next = allowed.has(source) ? source : 'system';
    nativeTheme.themeSource = next;
    setDockIcon(true);
    return { ok: true };
  });

  ipcMain.handle('clashfox:appInfo', () => {
    return {
      ok: true,
      data: {
        name: app.getName(),
        version: app.getVersion(),
        buildNumber: getBuildNumber(),
        isDev: !app.isPackaged,
      },
    };
  });

  ipcMain.handle('clashfox:checkUpdates', async (_event, options = {}) => {
    const manual = Boolean(options && options.manual);
    const acceptBeta = typeof (options && options.acceptBeta) === 'boolean'
      ? Boolean(options.acceptBeta)
      : undefined;
    const result = await checkForUpdates({ manual, acceptBeta });
    if (manual && typeof acceptBeta !== 'boolean') {
      if (!result.ok) {
        const reason = String(result.error || 'unknown_error');
        emitMainToast(`Check for updates failed (${reason}).`, 'error');
      } else if (result.status === 'update_available') {
        emitMainToast(`Update available: v${result.latestVersion}`, 'info');
      } else {
        emitMainToast('Already up to date.', 'info');
      }
    }
    return result;
  });

  ipcMain.handle('clashfox:checkKernelUpdates', async (_event, options = {}) => {
    return checkKernelUpdates(options || {});
  });

  ipcMain.handle('clashfox:checkHelperUpdates', async (_event, options = {}) => {
    return checkHelperUpdates(options || {});
  });

  ipcMain.handle('clashfox:installHelper', async () => {
    try {
      const result = await installLatestHelperFromOnline();
      helperUpdateCache.checkedAt = 0;
      helperUpdateCache.result = null;
      const status = await getHelperStatus();
      persistHelperStatusToSettings(status);
      refreshTrayMenuLabelsOnly();
      createTrayMenu().catch(() => {});
      return result || { ok: false, error: 'install_failed' };
    } catch (err) {
      return { ok: false, error: String((err && err.message) || 'install_failed') };
    }
  });

  ipcMain.handle('clashfox:uninstallHelper', async () => {
    try {
      const result = await uninstallHelperWithSystemAuth();
      helperUpdateCache.checkedAt = 0;
      helperUpdateCache.result = null;
      const status = await getHelperStatus();
      persistHelperStatusToSettings(status);
      refreshTrayMenuLabelsOnly();
      createTrayMenu().catch(() => {});
      return result || { ok: false, error: 'uninstall_failed' };
    } catch (err) {
      return { ok: false, error: String((err && err.message) || 'uninstall_failed') };
    }
  });

  ipcMain.handle('clashfox:runHelperInstallInTerminal', async () => {
    const result = await runHelperInstallInTerminal();
    return result || { ok: false, error: 'terminal_launch_failed' };
  });

  ipcMain.handle('clashfox:getHelperInstallPath', () => {
    const scriptPath = resolveHelperInstallScriptPath();
    return { ok: true, path: scriptPath, exists: fs.existsSync(scriptPath) };
  });

  ipcMain.handle('clashfox:pingHelper', async () => {
    const result = await pingHelper();
    return result || { ok: false, error: 'helper_unreachable' };
  });

  ipcMain.handle('clashfox:getHelperStatus', async () => {
    try {
      const result = await getHelperStatus();
      persistHelperStatusToSettings(result);
      refreshTrayMenuLabelsOnly();
      createTrayMenu().catch(() => {});
      return result || { ok: false, error: 'status_unavailable' };
    } catch (err) {
      return { ok: false, error: String((err && err.message) || 'status_unavailable') };
    }
  });

  ipcMain.handle('clashfox:doctorHelper', async (_event, options = {}) => {
    try {
      const result = await runHelperDoctor(options || {});
      helperUpdateCache.checkedAt = 0;
      helperUpdateCache.result = null;
      const status = await getHelperStatus();
      persistHelperStatusToSettings(status);
      refreshTrayMenuLabelsOnly();
      createTrayMenu().catch(() => {});
      return result || { ok: false, error: 'doctor_failed' };
    } catch (err) {
      return { ok: false, error: String((err && err.message) || 'doctor_failed') };
    }
  });

  ipcMain.handle('clashfox:openHelperLogs', async () => {
    const result = await openHelperLogs();
    return result || { ok: false, error: 'open_failed' };
  });

  ipcMain.handle('clashfox:openPath', async (_event, targetPath) => {
    guiMainLog('ipc-file', 'openPath requested', {
      targetPath: String(targetPath || ''),
    });
    try {
      if (!targetPath || typeof targetPath !== 'string') {
        guiMainLog('ipc-file', 'openPath failed', { error: 'invalid_path' }, 'warn');
        return { ok: false };
      }
      const result = await shell.openPath(targetPath);
      if (result) {
        guiMainLog('ipc-file', 'openPath failed', {
          targetPath,
          error: result,
        }, 'warn');
        return { ok: false, error: result };
      }
      guiMainLog('ipc-file', 'openPath completed', { targetPath });
      return { ok: true };
    } catch (err) {
      guiMainLog('ipc-file', 'openPath threw', {
        targetPath: String(targetPath || ''),
        error: err && err.message ? err.message : '',
      }, 'error');
      return { ok: false, error: err.message };
    }
  });

  app.on('activate', () => {
    hideTrayMenuWindow();
    if (focusPreferredWindowOnActivate()) {
      return;
    }
    if (readMainWindowClosedFromSettings()) {
      return;
    }
    if (!mainWindow || mainWindow.isDestroyed()) {
      createWindow(true);
      return;
    }
    showMainWindow();
  });
});

app.on('before-quit', () => {
  isQuitting = true;
  hideTrayMenuWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
