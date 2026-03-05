const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');
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
    path.join(ROOT_DIR, 'scripts', 'gui_bridge.sh'),
    path.join(process.resourcesPath || '', 'scripts', 'gui_bridge.sh'),
  ];
  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return path.join(ROOT_DIR, 'scripts', 'gui_bridge.sh');
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
let traySubmenuWindow = null;
let traySubmenuVisible = false;
let traySubmenuReady = false;
let traySubmenuHovering = false;
let traySubmenuAnchor = { top: 0, height: 0, rootHeight: 0 };
let traySubmenuLastSize = { width: 0, height: 0 };
let traySubmenuPendingPayload = null;
let dashboardWindow = null;
let mainWindowResizePersistTimer = null;
let currentInstallProcess = null; // 仅用于跟踪安装进程，支持取消功能
let globalSettings = {
  debugMode: true, // 是否启用调试模式
};
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
  'tun',
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
const DEFAULT_MAIN_WINDOW_WIDTH = 997;
const DEFAULT_MAIN_WINDOW_HEIGHT = 655;
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

const I18N = require(path.join(APP_PATH, 'static', 'locales', 'i18n.js'));
;

function resolveTrayLang() {
  try {
    const settingsPath = path.join(APP_DATA_DIR, 'settings.json');
    if (fs.existsSync(settingsPath)) {
      const raw = fs.readFileSync(settingsPath, 'utf8');
      const parsed = JSON.parse(raw);
      const lang = parsed && typeof parsed === 'object'
        ? (normalizeTextValue(parsed.lang) || normalizeTextValue(parsed.appearance && parsed.appearance.lang))
        : '';
      if (lang && lang !== 'auto') {
        return I18N[lang] ? lang : 'en';
      }
    }
  } catch {
    // ignore
  }
  const locale = (app.getLocale && app.getLocale()) ? app.getLocale().toLowerCase() : '';
  if (locale.startsWith('zh')) return 'zh';
  if (locale.startsWith('ja')) return 'ja';
  if (locale.startsWith('ko')) return 'ko';
  if (locale.startsWith('fr')) return 'fr';
  if (locale.startsWith('de')) return 'de';
  if (locale.startsWith('ru')) return 'ru';
  return 'en';
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
    if (item.action === 'open-dashboard') {
      return { ...item, label: labels.dashboard };
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
        return { ...item, label: labels.systemProxy || 'System Proxy' };
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

function resolveDefaultDeviceVersion() {
  const release = normalizeTextValue(os.release());
  if (process.platform === 'darwin') {
    return release ? `Darwin ${release}` : '';
  }
  return release;
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
  return {
    ...source,
    lang: readString('lang', 'auto'),
    theme: readString('theme', 'auto'),
    debugMode: readBoolean('debugMode', false),
    acceptBeta: readBoolean('acceptBeta', false),
    githubUser: readString('githubUser', 'vernesong'),
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
  const overview = overviewValue && typeof overviewValue === 'object' ? overviewValue : {};
  const overviewOs = normalizeTextValue(overview.systemName);
  const overviewVersion = normalizeTextValue(overview.systemVersion);
  const overviewBuild = normalizeTextValue(overview.systemBuild);
  const user = normalizeTextValue(device.user) || resolveCurrentDeviceUser();
  const userRealName = normalizeTextValue(device.userRealName) || resolveCurrentUserRealName();
  const computerName = normalizeTextValue(device.computerName) || normalizeTextValue(device.displayName) || resolveCurrentComputerName();
  const osName = normalizeTextValue(device.os) || overviewOs || resolveDefaultDeviceOsName();
  let version = normalizeTextValue(device.version) || overviewVersion || resolveDefaultDeviceVersion();
  let build = normalizeTextValue(device.build) || overviewBuild;
  if (version) {
    const combinedMatch = version.match(/^([0-9]+(?:\.[0-9]+)*(?:\.[0-9]+)?)\s+([0-9A-Za-z]+)$/);
    if (combinedMatch) {
      version = normalizeTextValue(combinedMatch[1]);
      if (!build) {
        build = normalizeTextValue(combinedMatch[2]);
      }
    }
  }
  if (overviewVersion && /^Darwin\s+\d+/i.test(version || '')) {
    version = overviewVersion;
  }
  const normalized = {
    user,
    userRealName,
    computerName,
    os: osName,
    version,
    build,
    source: normalizeTextValue(device.source),
    updatedAt: normalizeTextValue(device.updatedAt),
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
  delete parsed.lang;
  delete parsed.theme;
  delete parsed.debugMode;
  delete parsed.acceptBeta;
  delete parsed.githubUser;
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

async function checkForUpdates({ manual = false } = {}) {
  const settings = readAppSettings();
  const acceptBeta = Boolean(settings && settings.acceptBeta);
  const currentVersion = normalizeVersionTag(app.getVersion());
  try {
    const releases = await fetchJson(CHECK_UPDATE_API_URL);
    const latest = pickLatestRelease(releases, acceptBeta);
    if (!latest || !latest.tag_name) {
      return {
        ok: false,
        status: 'error',
        manual,
        acceptBeta,
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
      acceptBeta,
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
      acceptBeta,
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
  const runCommand = (bin, args = []) => new Promise((resolve) => {
    execFile(bin, args, { timeout: 2500 }, (err, stdout) => {
      if (err) {
        resolve('');
        return;
      }
      resolve(String(stdout || '').trim());
    });
  });
  const iface = await runCommand('/bin/sh', [
    '-c',
    'route get default 2>/dev/null | awk \'/interface:/{print $2; exit}\'',
  ]);
  if (iface) {
    const escapedIface = iface.replace(/'/g, "'\\''");
    const service = await runCommand('/bin/sh', [
      '-c',
      `networksetup -listnetworkserviceorder 2>/dev/null | awk -v iface='${escapedIface}' '$0 ~ "\\\\(" iface "\\\\)" {print prev; exit} {prev=$0}' | sed -E 's/^\\([0-9]+\\) //'`,
    ]);
    if (service && !service.includes('denotes that a network service is disabled')) {
      return service;
    }
  }
  const fallback = await runCommand('/bin/sh', [
    '-c',
    "networksetup -listallnetworkservices 2>/dev/null | sed '1d' | sed '/^\\*/d' | awk 'NF{print; exit}'",
  ]);
  return fallback || '';
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
  const version = normalizeTextValue(systemVersion);
  return version;
}

function persistOverviewSystemToSettings(overviewData = {}, source = 'overview') {
  const payload = overviewData && typeof overviewData === 'object' ? overviewData : {};
  const systemName = normalizeTextValue(payload.systemName);
  const systemVersion = normalizeTextValue(payload.systemVersion);
  const systemBuild = normalizeTextValue(payload.systemBuild);
  if (!systemName && !systemVersion && !systemBuild) {
    return false;
  }
  try {
    const parsed = readAppSettings() || {};
    const previousDevice = parsed.device && typeof parsed.device === 'object' ? parsed.device : {};

    const nextDeviceCore = {
      user: normalizeTextValue(previousDevice.user) || resolveCurrentDeviceUser(),
      userRealName: normalizeTextValue(previousDevice.userRealName) || resolveCurrentUserRealName(),
      computerName: normalizeTextValue(previousDevice.computerName) || normalizeTextValue(previousDevice.displayName) || resolveCurrentComputerName(),
      os: systemName || normalizeTextValue(previousDevice.os) || resolveDefaultDeviceOsName(),
      version: buildDeviceVersionFromOverview(systemVersion, systemBuild)
        || normalizeTextValue(previousDevice.version)
        || resolveDefaultDeviceVersion(),
      build: systemBuild || normalizeTextValue(previousDevice.build),
      source: String(source || 'overview'),
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
        updatedAt: new Date().toISOString(),
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

function buildTrayIconWithMode(mode) {
  const cacheKey = process.platform === 'darwin' ? 'mac-template-v3' : 'default';
  const cached = trayIconCache.get(cacheKey);
  if (cached && !cached.isEmpty()) {
    return cached;
  }
  let icon = nativeImage.createEmpty();

  if (process.platform === 'darwin') {
    // Pixel-tuned menubar glyph with maximal visual occupancy.
    const trayTemplateSvg = [
      '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">',
      '<path fill="#000" d="M9 0.2 12 2.7l3.8.8-.9 3 .9 2.3-2.7 1.7-1.2 3.4L9 15.2l-2.9-1.3-1.2-3.4-2.7-1.7.9-2.3-.9-3 3.8-.8L9 .2z"/>',
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

function applyTrayIconForMode(mode) {
  if (!tray) {
    return;
  }
  const trayIcon = buildTrayIconWithMode(mode);
  if (!trayIcon.isEmpty()) {
    if (process.platform === 'darwin' && typeof trayIcon.setTemplateImage === 'function') {
      trayIcon.setTemplateImage(true);
    }
    tray.setImage(trayIcon);
  }
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
    const response = await sendHelperRequest(pathname, method, payload);
    if (!response) {
      return { ok: false, error: 'helper_unreachable' };
    }
    const statusCode = Number(response.statusCode || 0);
    const isHttpOk = statusCode >= 200 && statusCode < 300;
    const textBody = String(response.body || '').trim();
    if (!textBody) {
      return isHttpOk ? { ok: true, data: {} } : { ok: false, error: `http_${statusCode || 0}` };
    }
    try {
      const parsed = parseBridgeOutput(textBody);
      if (!parsed || typeof parsed !== 'object') {
        return isHttpOk ? { ok: true, data: parsed } : { ok: false, error: 'helper_unreachable' };
      }
      if (parsed.ok === true) {
        return parsed;
      }
      if (parsed.ok === false || parsed.error) {
        return parsed;
      }
      if (parsed.status === 'ok' || parsed.success === true) {
        return {
          ok: true,
          data: Object.prototype.hasOwnProperty.call(parsed, 'data') ? parsed.data : parsed,
        };
      }
      if (isHttpOk) {
        return { ok: true, data: parsed };
      }
      return parsed;
    } catch {
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
      // Current helper API does not expose TUN endpoints.
      // Keep TUN operations on the script path (gui_bridge.sh) only.
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
        let service = await resolveUsableNetworkServiceName(readArgValue('--service'));
        if (!service) {
          return { ok: false, error: 'network_service_not_found' };
        }
        let endpoint = `/v1/proxy/status?service=${encodeURIComponent(service)}`;
        let result = await respondFromHelper(endpoint, 'GET');
        if (isInvalidServiceError(result)) {
          const fallbackService = await resolveActiveNetworkServiceName();
          if (fallbackService && fallbackService !== service) {
            service = fallbackService;
            endpoint = `/v1/proxy/status?service=${encodeURIComponent(service)}`;
            result = await respondFromHelper(endpoint, 'GET');
          }
          if (isInvalidServiceError(result)) {
            result = await respondFromHelper('/v1/proxy/status', 'GET');
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

async function runBridgeWithAutoAuth(command, args = [], options = {}) {
  const cmd = String(command || '').trim();
  if (!cmd) {
    return { ok: false, error: 'unknown_command' };
  }
  const cmdArgs = Array.isArray(args) ? args : [];
  let result = await runBridge([cmd, ...cmdArgs], options);
  if (
    result
    && result.error === 'sudo_required'
    && process.platform === 'darwin'
    && PRIVILEGED_COMMANDS.has(cmd)
  ) {
    result = await runBridgeWithSystemAuth([cmd, ...cmdArgs]);
  }
  if (result && result.ok) {
    const cmdLower = cmd.toLowerCase();
    if (cmdLower === 'status') {
      const runningValue = result.data && Object.prototype.hasOwnProperty.call(result.data, 'running')
        ? result.data.running
        : null;
      persistMihomoStatusToSettings(runningValue, 'status');
      const versionValue = result.data && Object.prototype.hasOwnProperty.call(result.data, 'version')
        ? result.data.version
        : '';
      persistKernelVersionToSettings(versionValue, 'status');
    } else if (cmdLower === 'overview') {
      persistOverviewSystemToSettings(result.data || {}, 'overview');
    } else if (cmdLower === 'start' || cmdLower === 'stop' || cmdLower === 'restart' || cmdLower === 'switch') {
      const runningValue = result.data && Object.prototype.hasOwnProperty.call(result.data, 'running')
        ? result.data.running
        : normalizeMihomoRunningValue(null, cmdLower);
      persistMihomoStatusToSettings(runningValue, cmdLower);
      if (cmdLower === 'start' || cmdLower === 'restart' || cmdLower === 'switch') {
        const versionValue = result.data && Object.prototype.hasOwnProperty.call(result.data, 'version')
          ? result.data.version
          : '';
        if (normalizeKernelVersionValue(versionValue)) {
          persistKernelVersionToSettings(versionValue, cmdLower);
        } else {
          await persistKernelVersionFromStatus(cmdLower);
        }
      }
    }
  }
  return result;
}

function emitTrayRefresh() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('clashfox:trayRefresh');
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

async function readTunEnabledSnapshot(configPath = '', controllerOverride = '', secretOverride = '') {
  const statusArgs = ['tun-status'];
  if (configPath) {
    statusArgs.push('--config', configPath);
  }
  if (controllerOverride) {
    statusArgs.push('--controller', controllerOverride);
  }
  if (secretOverride) {
    statusArgs.push('--secret', secretOverride);
  }
  const statusResp = await runBridge(statusArgs);
  if (!(statusResp && statusResp.ok && statusResp.data)) {
    return { ok: false, enabled: null };
  }
  const enabledRaw = Object.prototype.hasOwnProperty.call(statusResp.data, 'enabled')
    ? statusResp.data.enabled
    : statusResp.data.enable;
  return {
    ok: true,
    enabled: enabledRaw === true || enabledRaw === 'true' || enabledRaw === 1,
  };
}

async function waitForTunEnabledState(
  targetEnabled,
  configPath = '',
  timeoutMs = 3200,
  intervalMs = 220,
  controllerOverride = '',
  secretOverride = '',
) {
  const expected = Boolean(targetEnabled);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() <= deadline) {
    const snapshot = await readTunEnabledSnapshot(configPath, controllerOverride, secretOverride);
    if (snapshot.ok && snapshot.enabled === expected) {
      return snapshot;
    }
    await sleep(intervalMs);
  }
  return readTunEnabledSnapshot(configPath, controllerOverride, secretOverride);
}

function readArgValueFromList(args = [], name = '') {
  if (!Array.isArray(args) || !name) {
    return '';
  }
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] !== name) {
      continue;
    }
    const value = args[index + 1];
    if (typeof value === 'string') {
      return value.trim();
    }
    return '';
  }
  return '';
}

function parseEnableFlagValue(value = '') {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }
  return null;
}

function buildTunPatchPayloadFromArgs(args = []) {
  const payload = {};
  const enableRaw = readArgValueFromList(args, '--enable');
  const stackRaw = readArgValueFromList(args, '--stack');
  const enable = parseEnableFlagValue(enableRaw);
  if (enable !== null) {
    payload.enable = enable;
  }
  if (stackRaw) {
    payload.stack = String(stackRaw);
  }
  return payload;
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

async function applyTunViaControllerMain(partialTun = {}, controllerOverride = '', secretOverride = '') {
  try {
    const { baseUrl, secret } = resolveControllerAccessFromSettings(controllerOverride, secretOverride);
    if (!baseUrl) {
      return { ok: false, error: 'controller_missing' };
    }
    const tunBody = {};
    if (Object.prototype.hasOwnProperty.call(partialTun, 'enable')) {
      tunBody.enable = Boolean(partialTun.enable);
    }
    if (Object.prototype.hasOwnProperty.call(partialTun, 'stack') && partialTun.stack) {
      tunBody.stack = String(partialTun.stack);
    }
    if (!Object.keys(tunBody).length) {
      return { ok: false, error: 'invalid_tun' };
    }
    const headers = { 'Content-Type': 'application/json' };
    if (secret) {
      headers.Authorization = `Bearer ${secret}`;
    }
    const candidates = [
      { method: 'PATCH', payload: { tun: tunBody } },
      { method: 'PUT', payload: { tun: tunBody } },
    ];
    if (Object.prototype.hasOwnProperty.call(tunBody, 'enable')) {
      const enabledBody = { ...tunBody, enabled: tunBody.enable };
      delete enabledBody.enable;
      candidates.push({ method: 'PATCH', payload: { tun: enabledBody } });
      candidates.push({ method: 'PUT', payload: { tun: enabledBody } });
    }
    let lastError = { ok: false, error: 'request_failed' };
    for (const candidate of candidates) {
      const resp = await fetch(`${baseUrl}/configs`, {
        method: candidate.method,
        headers,
        body: JSON.stringify(candidate.payload),
      });
      if (resp.ok) {
        return { ok: true };
      }
      const details = (await resp.text().catch(() => '')) || `http_status=${resp.status}`;
      lastError = { ok: false, error: 'request_failed', details };
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

async function applyTunCommandUnified(commandArgs = [], options = {}) {
  const args = Array.isArray(commandArgs) ? commandArgs : [];
  const enableRaw = readArgValueFromList(args, '--enable');
  const hasEnableTarget = enableRaw !== '';
  const targetEnabled = hasEnableTarget ? parseEnableFlagValue(enableRaw) : null;
  const configPath = readArgValueFromList(args, '--config') || getConfigPathFromSettings();
  const controllerOverride = readArgValueFromList(args, '--controller');
  const secretOverride = readArgValueFromList(args, '--secret');
  const tunPatchPayload = buildTunPatchPayloadFromArgs(args);

  let response = null;
  if (Object.keys(tunPatchPayload).length > 0) {
    const controllerApply = await applyTunViaControllerMain(
      tunPatchPayload,
      controllerOverride,
      secretOverride,
    );
    if (controllerApply && controllerApply.ok) {
      response = { ok: true, source: 'controller' };
    }
  }
  if (!(response && response.ok)) {
    response = await runBridgeWithAutoAuth('tun', args, options);
  }
  if (!(response && response.ok)) {
    if (hasEnableTarget && targetEnabled !== null) {
      const fallbackTunSnapshot = await readTunEnabledSnapshot(configPath, controllerOverride, secretOverride);
      const fallbackSettings = readAppSettings();
      const fallbackEnabled = fallbackTunSnapshot.ok
        ? Boolean(fallbackTunSnapshot.enabled)
        : Boolean(
          fallbackSettings
          && Object.prototype.hasOwnProperty.call(fallbackSettings, 'tun')
            ? fallbackSettings.tun
            : false
        );
      persistTunEnabledToSettings(fallbackEnabled);
      patchTrayMenuNetworkState({ tunEnabled: fallbackEnabled });
    }
    return response;
  }

  if (!hasEnableTarget || targetEnabled === null) {
    return response;
  }

  const tunSnapshot = await waitForTunEnabledState(
    targetEnabled,
    configPath,
    3200,
    220,
    controllerOverride,
    secretOverride,
  );
  let actualEnabled = tunSnapshot.ok
    ? Boolean(tunSnapshot.enabled)
    : targetEnabled;
  let mismatch = tunSnapshot.ok && actualEnabled !== targetEnabled;
  if (mismatch) {
    await sleep(600);
    const retrySnapshot = await readTunEnabledSnapshot(configPath, controllerOverride, secretOverride);
    if (retrySnapshot.ok) {
      actualEnabled = Boolean(retrySnapshot.enabled);
      mismatch = actualEnabled !== targetEnabled;
    }
  }
  persistTunEnabledToSettings(actualEnabled);
  patchTrayMenuNetworkState({ tunEnabled: actualEnabled });
  return {
    ...response,
    data: {
      ...(response && response.data && typeof response.data === 'object' ? response.data : {}),
      requestedEnabled: targetEnabled,
      enabled: actualEnabled,
      mismatched: Boolean(mismatch),
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
    // fallback: just show main window
    showMainWindow();
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
  if (trayMenuWindow && !trayMenuWindow.isDestroyed()) {
    trayMenuWindow.webContents.send('clashfox:trayMenu:update', trayMenuData);
  }
  if (traySubmenuWindow && traySubmenuVisible) {
    sendTraySubmenuUpdate({
      key: 'network',
      items: trayMenuData.submenus.network,
    });
  }
}

async function buildTrayMenuOnce() {
  if (process.platform !== 'darwin') {
    return;
  }
  if (!tray) {
    const trayIcon = buildTrayIconWithMode(resolveOutboundModeFromSettings());
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
    applyTrayIconForMode(resolveOutboundModeFromSettings());
  }
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
  try {
    const status = await runBridge(['status']);
    dashboardEnabled = Boolean(status && status.ok && status.data && status.data.running);
    if (!dashboardEnabled) {
      const overview = await runBridge(['overview']);
      dashboardEnabled = Boolean(overview && overview.ok && overview.data && overview.data.running);
    }
  } catch {
    dashboardEnabled = false;
  }
  try {
    const statusArgs = ['system-proxy-status', '--config', configPath];
    if (expectedProxyPort) {
      statusArgs.push('--port', expectedProxyPort);
    }
    const takeover = await runBridge(statusArgs);
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
  const connectivitySnapshot = await getConnectivityQualitySnapshot(configPath);
  connectivityQuality = connectivitySnapshot && connectivitySnapshot.text
    ? String(connectivitySnapshot.text)
    : '-';
  connectivityTone = connectivitySnapshot && connectivitySnapshot.tone
    ? String(connectivitySnapshot.tone)
    : 'neutral';
  try {
    const tunStatus = await runBridge(['tun-status', '--config', configPath]);
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
  // Re-read mode at commit time to avoid stale snapshot overwriting a newer switch.
  const currentOutboundMode = resolveOutboundModeFromSettings();
  const currentOutboundBadge = OUTBOUND_MODE_BADGE[currentOutboundMode] || OUTBOUND_MODE_BADGE.rule;
  const runningLabel = uiLabels.running || labels.on || 'Running';
  const stoppedLabel = uiLabels.stopped || labels.off || 'Stopped';
  const trayStatusState = dashboardEnabled ? 'running' : 'stopped';
  const trayStatusLabel = dashboardEnabled ? runningLabel : stoppedLabel;

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
    items: [
      { type: 'action', label: labels.showMain, action: 'show-main', rightText: '⌘ 1', shortcut: 'Cmd+1', iconKey: 'showMain' },
      { type: 'separator' },
      { type: 'action', label: labels.networkTakeover || 'Network Takeover', submenu: 'network', iconKey: 'networkTakeover' },
      { type: 'separator' },
      { type: 'action', label: labels.outboundMode || 'Outbound Mode', rightText: `[${currentOutboundBadge}]`, submenu: 'outbound', iconKey: 'outboundMode' },
      { type: 'separator' },
      { type: 'action', label: labels.dashboard, action: 'open-dashboard', enabled: dashboardEnabled, rightText: '⌘ 2', shortcut: 'Cmd+2', iconKey: 'dashboard' },
      { type: 'separator' },
      { type: 'action', label: labels.kernelManager, submenu: 'kernel', iconKey: 'kernelManager' },
      { type: 'separator' },
      { type: 'action', label: labels.directoryLocations || 'Directory Locations', submenu: 'directory', iconKey: 'directory' },
      { type: 'separator' },
      { type: 'action', label: getNavLabels().settings || 'Settings', action: 'open-settings', rightText: '⌘ ,', shortcut: 'Cmd+,', iconKey: 'settings' },
      { type: 'separator' },
      { type: 'action', label: labels.checkUpdate || 'Check for Updates', action: 'check-update', iconKey: 'checkUpdate' },
      { type: 'action', label: labels.quit, action: 'quit', rightText: '⌘ Q', shortcut: 'Cmd+Q', iconKey: 'quit' },
    ],
    submenus: {
      network: [
        {
          type: 'action',
          label: labels.systemProxy || 'System Proxy',
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
        { type: 'separator' },
        { type: 'action', label: labels.copyShellExportCommand || 'Copy Shell Export Command', action: 'copy-shell-export', rightText: '⌘ C', iconKey: 'copyShellExport' },
      ],
      outbound: [
        { type: 'action', label: labels.modeGlobalTitle || 'Global Proxy', action: 'mode-change', value: 'global', checked: currentOutboundMode === 'global', iconKey: 'modeGlobal' },
        { type: 'action', label: labels.modeRuleTitle || 'Rule-Based Proxy', action: 'mode-change', value: 'rule', checked: currentOutboundMode === 'rule', iconKey: 'modeRule' },
        { type: 'action', label: labels.modeDirectTitle || 'Direct Outbound', action: 'mode-change', value: 'direct', checked: currentOutboundMode === 'direct', iconKey: 'modeDirect' },
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
    },
  };
  trayMenuData = nextMenuData;
  trayMenuLastBuiltAt = Date.now();
  if (trayMenuWindow && !trayMenuWindow.isDestroyed()) {
    trayMenuWindow.webContents.send('clashfox:trayMenu:update', trayMenuData);
  }
  return trayMenuData;
}

async function createTrayMenu() {
  if (trayMenuBuildInProgress) {
    trayMenuBuildPending = true;
    return trayMenuData;
  }
  trayMenuBuildInProgress = true;
  try {
    do {
      trayMenuBuildPending = false;
      await buildTrayMenuOnce();
    } while (trayMenuBuildPending);
    return trayMenuData;
  } finally {
    trayMenuBuildInProgress = false;
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
  trayMenuWindow.loadFile(path.join(__dirname, 'ui', 'html', 'tray-menu.html'));
  trayMenuWindow.on('blur', () => {
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
  traySubmenuPendingPayload = null;
  if (trayMenuRefreshTimer) {
    clearInterval(trayMenuRefreshTimer);
    trayMenuRefreshTimer = null;
  }
  trayMenuWindow.hide();
}

function sendTraySubmenuUpdate(payload) {
  traySubmenuPendingPayload = payload || null;
  if (!trayMenuVisible) {
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
  const mainMenuWidth = 260;
  const popupWidth = Number.isFinite(explicitWidth)
    ? Math.max(mainMenuWidth, Math.round(explicitWidth))
    : mainMenuWidth;
  const popupHeight = Math.max(200, Math.min(Number(contentHeight) || 420, 620));
  const anchorX = trayBounds.x + Math.round(trayBounds.width / 2);
  // Align tray icon center with the header logo center (padding-left 12px + logo radius 24px).
  const logoCenterX = 36;
  const desiredX = anchorX - logoCenterX;
  const x = Math.max(area.x + 8, Math.min(desiredX, area.x + area.width - popupWidth - 8));
  const y = Math.max(area.y, Math.min(trayBounds.y + trayBounds.height, area.y + area.height - popupHeight - 8));
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
    const boundedX = Math.max(area.x + 8, Math.min(current.x, area.x + area.width - computed.bounds.width - 8));
    const boundedY = Math.max(area.y + 8, Math.min(current.y, area.y + area.height - computed.bounds.height - 8));
    computed = {
      ...computed,
      bounds: {
        ...computed.bounds,
        x: boundedX,
        y: boundedY,
      },
    };
  }
  trayMenuContentHeight = Math.max(200, Math.min(Number(contentHeight) || trayMenuContentHeight || 420, 620));
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
  hideTraySubmenuWindow();
  const popup = ensureTrayMenuWindow();
  const currentBounds = popup.getBounds();
  if (currentBounds && Number.isFinite(currentBounds.height) && currentBounds.height > 0) {
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
  const labels = getTrayLabels();
  const uiLabels = getUiLabels();
  const configPath = getConfigPathFromSettings();
  switch (action) {
    case 'show-main':
      hideTrayMenuWindow();
      showMainWindow();
      return { ok: true, hide: true };
    case 'open-dashboard':
      hideTrayMenuWindow();
      openDashboardPanel();
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
      const target = targetEnabled ? 'true' : 'false';
      const tunArgs = ['--config', configPath, '--enable', target, ...getControllerArgsFromSettings()];
      const tunResult = await applyTunCommandUnified(tunArgs, {});
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
      const response = await runTrayCommand('mode', ['--mode', nextMode, ...getControllerArgsFromSettings()], labels);
      if (response.ok) {
        persistOutboundModeToSettings(nextMode);
        patchTrayMenuOutboundMode(nextMode);
        applyTrayIconForMode(nextMode);
        emitTrayRefresh();
      }
      return { ok: true, submenu: 'outbound' };
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
  require('electron-reload')(ROOT_DIR, {
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
    if (globalSettings.debugMode) {
      return;
    }
    const isReloadCombo = (input.control || input.meta) && key === 'r';
    const isReloadKey = key === 'f5';
    if (isReloadCombo || isReloadKey) {
      event.preventDefault();
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
  // Always show main window on app launch; close-to-tray only applies to current runtime.
  const shouldShowMainWindow = true;
  createWindow(shouldShowMainWindow);
  if (app.dock && app.dock.show) {
    app.dock.show();
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

  applyAppMenu();

  ipcMain.handle('clashfox:command', async (_event, command, args = [], options = {}) => {
    const cmd = String(command || '').trim();
    const cmdArgs = Array.isArray(args) ? args : [];
    const result = cmd === 'tun'
      ? await applyTunCommandUnified(cmdArgs, options)
      : await runBridgeWithAutoAuth(cmd, cmdArgs, options);
    if (result && result.ok && ['start', 'stop', 'restart', 'mode', 'tun', 'system-proxy-enable', 'system-proxy-disable'].includes(command)) {
      await createTrayMenu();
    }
    return result;
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
    trayMenuContentHeight = Math.max(200, Math.min(requestedHeight || trayMenuContentHeight || 420, 620));
    if (trayMenuWindow && !trayMenuWindow.isDestroyed() && trayMenuVisible) {
      applyTrayMenuWindowBounds(trayMenuContentHeight, true, requestedWidth, false);
    }
  });
  ipcMain.on('clashfox:trayMenu:openSubmenu', async (_event, payload = {}) => {
    if (!trayMenuVisible) {
      return;
    }
    const key = payload && payload.key ? String(payload.key) : '';
    if (key === 'network') {
      await createTrayMenu().catch(() => {});
      // await refreshNetworkSubmenuState().catch(() => {});
    }
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
    if (!trayMenuVisible) {
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
    if (!trayMenuVisible) {
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
    const result = await dialog.showOpenDialog({
      title: 'Select Config File',
      properties: ['openFile'],
      filters: [
        { name: 'Config', extensions: ['yaml', 'yml', 'json'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { ok: false, error: 'cancelled' };
    }

    return { ok: true, path: result.filePaths[0] };
  });

  ipcMain.handle('clashfox:deleteConfig', async (_event, targetPath) => {
    try {
      if (!targetPath || typeof targetPath !== 'string') {
        return { ok: false, error: 'invalid_path' };
      }
      const resolvedTarget = path.resolve(String(targetPath));
      const configDir = resolveConfigDirectoryFromSettings();
      const normalizedDir = path.resolve(configDir);
      const dirPrefix = `${normalizedDir}${path.sep}`;
      if (!(resolvedTarget === normalizedDir || resolvedTarget.startsWith(dirPrefix))) {
        return { ok: false, error: 'outside_config_dir' };
      }
      const settings = readAppSettings();
      const currentConfig = settings && typeof settings.configFile === 'string'
        ? path.resolve(settings.configFile)
        : '';
      if (currentConfig && resolvedTarget === currentConfig) {
        return { ok: false, error: 'current_config' };
      }
      if (!fs.existsSync(resolvedTarget)) {
        return { ok: false, error: 'not_found' };
      }
      const stat = fs.statSync(resolvedTarget);
      if (!stat.isFile()) {
        return { ok: false, error: 'not_file' };
      }
      fs.unlinkSync(resolvedTarget);
      return { ok: true, path: resolvedTarget };
    } catch (err) {
      return { ok: false, error: err && err.message ? err.message : 'delete_failed' };
    }
  });

  ipcMain.handle('clashfox:importConfig', async () => {
    const selection = await dialog.showOpenDialog({
      title: 'Import Config File',
      properties: ['openFile'],
      filters: [
        { name: 'Config', extensions: ['yaml', 'yml', 'json'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });
    if (selection.canceled || selection.filePaths.length === 0) {
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
      return { ok: false, error: err && err.message ? err.message : 'import_failed' };
    }
  });

  ipcMain.handle('clashfox:selectDirectory', async (_event, title) => {
    const result = await dialog.showOpenDialog({
      title: title || 'Select Directory',
      properties: ['openDirectory', 'createDirectory'],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { ok: false, error: 'cancelled' };
    }

    return { ok: true, path: result.filePaths[0] };
  });

  ipcMain.handle('clashfox:openAbout', () => {
    createAboutWindow();
    return { ok: true };
  });

  ipcMain.handle('clashfox:openExternal', async (_event, url) => {
    if (!url || typeof url !== 'string') {
      return { ok: false };
    }
    try {
      await shell.openExternal(url);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('clashfox:revealInFinder', (_event, targetPath) => {
    try {
      if (!targetPath || typeof targetPath !== 'string') {
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
        return result.then((err) => (err ? { ok: false, error: err } : { ok: true }));
      }
      return { ok: true };
    } catch (err) {
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
          kernel: {},
          device: {
            user: resolveCurrentDeviceUser(),
            userRealName: resolveCurrentUserRealName(),
            computerName: resolveCurrentComputerName(),
            os: resolveDefaultDeviceOsName(),
            version: resolveDefaultDeviceVersion(),
            source: 'init',
            updatedAt: new Date().toISOString(),
          },
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
      if (mainWindow && !mainWindow.isDestroyed()) {
        const normalizedWithAliases = mergeAppearanceAliases(normalized);
        mainWindow.setSize(normalizedWithAliases.windowWidth, normalizedWithAliases.windowHeight);
      }
      refreshTrayMenuLabelsOnly();
      createTrayMenu().catch(() => {});
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
      },
    };
  });

  ipcMain.handle('clashfox:checkUpdates', async (_event, options = {}) => {
    const manual = Boolean(options && options.manual);
    const result = await checkForUpdates({ manual });
    if (manual) {
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
    try {
      if (!targetPath || typeof targetPath !== 'string') {
        return { ok: false };
      }
      const result = await shell.openPath(targetPath);
      if (result) {
        return { ok: false, error: result };
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  app.on('activate', () => {
    hideTrayMenuWindow();
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
