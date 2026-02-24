const fs = require('fs');
const os = require('os');
const path = require('path');
const { app, BrowserWindow, ipcMain, dialog, nativeImage, Menu, nativeTheme, shell, Tray, session, clipboard, screen } = require('electron');
const { spawn, execFileSync, execFile } = require('child_process');

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
  if (!app.isPackaged) {
    return path.join(ROOT_DIR, 'scripts', 'gui_bridge.sh');
  }
  return path.join(process.resourcesPath, 'app.asar.unpacked', 'scripts', 'gui_bridge.sh');
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
let dashboardWindow = null;
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
const PRIVILEGED_COMMANDS = new Set(['install', 'start', 'stop', 'restart', 'delete-backups', 'system-proxy-enable', 'system-proxy-disable']);
const SYSTEM_AUTH_ERROR_PREFIX = '__CLASHFOX_SYSTEM_AUTH_ERROR__';
const OUTBOUND_MODE_BADGE = {
  rule: 'R',
  global: 'G',
  direct: 'D',
};
const CONNECTIVITY_REFRESH_MS = 1500;
const trayIconCache = new Map();
let connectivityQualityCache = {
  text: '-',
  tone: 'neutral',
  updatedAt: 0,
};
let connectivityQualityFetchPromise = null;

const I18N = require(path.join(APP_PATH, 'static', 'locales', 'i18n.js'));
;

function resolveTrayLang() {
  try {
    const settingsPath = path.join(APP_DATA_DIR, 'settings.json');
    if (fs.existsSync(settingsPath)) {
      const raw = fs.readFileSync(settingsPath, 'utf8');
      const parsed = JSON.parse(raw);
      const lang = parsed && parsed.lang ? String(parsed.lang) : '';
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
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function resolveOutboundModeFromSettings() {
  const parsed = readAppSettings();
  const mode = parsed && typeof parsed.proxyMode === 'string' ? parsed.proxyMode.trim().toLowerCase() : '';
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
    const settingsPath = path.join(APP_DATA_DIR, 'settings.json');
    const parsed = readAppSettings();
    parsed.proxyMode = mode;
    fs.writeFileSync(settingsPath, `${JSON.stringify(parsed, null, 2)}\n`);
    return true;
  } catch {
    return false;
  }
}

function persistTunEnabledToSettings(enabled) {
  try {
    ensureAppDirs();
    const settingsPath = path.join(APP_DATA_DIR, 'settings.json');
    const parsed = readAppSettings();
    parsed.tunEnabled = Boolean(enabled);
    fs.writeFileSync(settingsPath, `${JSON.stringify(parsed, null, 2)}\n`);
    return true;
  } catch {
    return false;
  }
}

function buildShellExportCommand(portValue) {
  const port = String(portValue || '').trim();
  const safePort = /^[0-9]+$/.test(port) ? port : '7890';
  return `export http_proxy="http://127.0.0.1:${safePort}" https_proxy="http://127.0.0.1:${safePort}" all_proxy="socks5://127.0.0.1:${safePort}" no_proxy="localhost,127.0.0.1,::1"`;
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
      const overview = await runBridge(['overview', '--no-cache', '--config', configPath, ...getControllerArgsFromSettings()]);
      const internetMs = overview && overview.ok && overview.data ? String(overview.data.internetMs || '').trim() : '';
      if (internetMs && internetMs !== '-') {
        connectivityQualityCache = {
          text: `${internetMs} ms`,
          tone: resolveConnectivityToneByLatency(internetMs),
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

function buildTrayIconWithMode(mode) {
  const safeMode = OUTBOUND_MODE_BADGE[mode] ? mode : 'rule';
  const cached = trayIconCache.get(safeMode);
  if (cached && !cached.isEmpty()) {
    return cached;
  }
  const modeIconMap = {
    rule: 'menu_r.png',
    global: 'menu_g.png',
    direct: 'menu_d.png',
  };
  const modeIconPath = path.join(APP_PATH, 'src', 'ui', 'assets', modeIconMap[safeMode] || 'menu_r.png');
  let icon = nativeImage.createFromPath(modeIconPath);
  if (icon.isEmpty()) {
    const fallback = path.join(APP_PATH, 'src', 'ui', 'assets', 'menu.png');
    icon = nativeImage.createFromPath(fallback);
  }

  if (!icon.isEmpty()) {
    icon = icon.resize({ width: 21, height: 21 });
    if (process.platform === 'darwin' && typeof icon.setTemplateImage === 'function') {
      icon.setTemplateImage(false);
    }
    trayIconCache.set(safeMode, icon);
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
      trayIcon.setTemplateImage(false);
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
  const normalized = [];
  let extractedSudoPass = '';
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value === '--sudo-pass') {
      const nextValue = args[index + 1];
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
    if (!response || !response.ok) {
      return null;
    }
    return Boolean(response.data && response.data.running);
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
    const message = (result && (result.error || result.message)) ? String(result.error || result.message) : 'Unknown error';
    await dialog.showMessageBox({
      type: 'error',
      buttons: [labels.ok || 'OK'],
      title: labels.errorTitle || 'Operation Failed',
      message: `${labels.commandFailed || 'Command failed'}: ${command}`,
      detail: message,
    });
    return { ok: false };
  }
  return { ok: true, sudoPass: effectiveSudoPass };
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
    const settingsPath = path.join(APP_DATA_DIR, 'settings.json');
    let settings = {};
    if (fs.existsSync(settingsPath)) {
      const raw = fs.readFileSync(settingsPath, 'utf8');
      settings = JSON.parse(raw);
    }
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
      return { ...item, checked: systemProxyEnabled };
    }
    if (item.action === 'toggle-tun' && typeof tunEnabled === 'boolean') {
      return { ...item, checked: tunEnabled };
    }
    return item;
  });
  if (trayMenuWindow && !trayMenuWindow.isDestroyed()) {
    trayMenuWindow.webContents.send('clashfox:trayMenu:update', trayMenuData);
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
      trayIcon.setTemplateImage(false);
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
  let dashboardEnabled = false;
  let networkTakeoverEnabled = false;
  let networkTakeoverService = '';
  let networkTakeoverPort = '7890';
  let connectivityQuality = '-';
  let connectivityTone = 'neutral';
  let tunEnabled = Boolean(readAppSettings().tunEnabled);
  let tunAvailable = true;
  try {
    const status = await runBridge(['status']);
    dashboardEnabled = Boolean(status && status.ok && status.data && status.data.running);
  } catch {
    dashboardEnabled = false;
  }
  try {
    const takeover = await runBridge(['system-proxy-status', '--config', configPath]);
    networkTakeoverEnabled = Boolean(takeover && takeover.ok && takeover.data && takeover.data.enabled);
    networkTakeoverService = (takeover && takeover.ok && takeover.data && takeover.data.service)
      ? String(takeover.data.service)
      : '';
    networkTakeoverPort = (takeover && takeover.ok && takeover.data && takeover.data.port)
      ? String(takeover.data.port).trim()
      : '7890';
  } catch {
    networkTakeoverEnabled = false;
    networkTakeoverService = '';
    networkTakeoverPort = '7890';
  }
  const connectivitySnapshot = await getConnectivityQualitySnapshot(configPath);
  connectivityQuality = connectivitySnapshot && connectivitySnapshot.text
    ? String(connectivitySnapshot.text)
    : '-';
  connectivityTone = connectivitySnapshot && connectivitySnapshot.tone
    ? String(connectivitySnapshot.tone)
    : 'neutral';
  try {
    const tunStatus = await runBridge(['tun-status', '--config', configPath, ...getControllerArgsFromSettings()]);
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
      { type: 'action', label: getNavLabels().settings || 'Settings', action: 'open-settings', rightText: '⌘ ,', shortcut: 'Cmd+,', iconKey: 'settings' },
      { type: 'separator' },
      { type: 'action', label: labels.quit, action: 'quit', rightText: '⌘ Q', shortcut: 'Cmd+Q', iconKey: 'quit' },
    ],
    submenus: {
      network: [
        {
          type: 'action',
          label: labels.systemProxy || 'System Proxy',
          action: 'toggle-system-proxy',
          checked: networkTakeoverEnabled,
          iconKey: 'systemProxy',
        },
        {
          type: 'action',
          label: labels.tun || 'TUN',
          action: 'toggle-tun',
          checked: tunEnabled,
          enabled: tunAvailable,
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
  trayMenuWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  trayMenuWindow.setAlwaysOnTop(true, 'pop-up-menu');
  trayMenuWindow.loadFile(path.join(__dirname, 'ui', 'html', 'tray-menu.html'));
  trayMenuWindow.on('blur', () => {
    hideTrayMenuWindow();
  });
  trayMenuWindow.on('closed', () => {
    trayMenuWindow = null;
    trayMenuVisible = false;
    if (trayMenuRefreshTimer) {
      clearInterval(trayMenuRefreshTimer);
      trayMenuRefreshTimer = null;
    }
  });
  return trayMenuWindow;
}

function hideTrayMenuWindow() {
  if (!trayMenuWindow || trayMenuWindow.isDestroyed()) {
    trayMenuVisible = false;
    if (trayMenuRefreshTimer) {
      clearInterval(trayMenuRefreshTimer);
      trayMenuRefreshTimer = null;
    }
    return;
  }
  trayMenuVisible = false;
  if (trayMenuRefreshTimer) {
    clearInterval(trayMenuRefreshTimer);
    trayMenuRefreshTimer = null;
  }
  trayMenuWindow.hide();
}

function computeTrayMenuWindowBounds(contentHeight = trayMenuContentHeight, explicitWidth = 520) {
  if (!tray) {
    return null;
  }
  const trayBounds = tray.getBounds();
  const display = screen.getDisplayNearestPoint({ x: trayBounds.x, y: trayBounds.y });
  const area = display.workArea;
  const mainMenuWidth = 260;
  const submenuGap = 0;
  const popupWidth = Number.isFinite(explicitWidth)
    ? Math.max(mainMenuWidth, Math.round(explicitWidth))
    : (mainMenuWidth + submenuGap + 260);
  const submenuWidth = Math.max(0, popupWidth - mainMenuWidth - submenuGap);
  const hasSubmenuPane = popupWidth > mainMenuWidth;
  const popupHeight = Math.max(200, Math.min(Number(contentHeight) || 420, 620));
  const anchorX = trayBounds.x + Math.round(trayBounds.width / 2);
  let submenuSide = 'right';
  if (hasSubmenuPane) {
    const rightNeed = anchorX + Math.round(mainMenuWidth / 2) + submenuGap + submenuWidth;
    const leftNeed = anchorX - Math.round(mainMenuWidth / 2) - submenuGap - submenuWidth;
    const canUseRightSubmenu = rightNeed <= (area.x + area.width - 8);
    const canUseLeftSubmenu = leftNeed >= (area.x + 8);
    if (!canUseRightSubmenu && canUseLeftSubmenu) {
      submenuSide = 'left';
    } else if (!canUseRightSubmenu && !canUseLeftSubmenu) {
      const rightOverflow = rightNeed - (area.x + area.width - 8);
      const leftOverflow = (area.x + 8) - leftNeed;
      submenuSide = rightOverflow <= leftOverflow ? 'right' : 'left';
    }
  }

  const mainOffset = hasSubmenuPane && submenuSide === 'left' ? (submenuWidth + submenuGap) : 0;
  const desiredX = anchorX - Math.round(mainMenuWidth / 2) - mainOffset;
  const x = Math.max(area.x + 8, Math.min(desiredX, area.x + area.width - popupWidth - 8));
  const y = Math.max(area.y + 8, Math.min(trayBounds.y + trayBounds.height + 6, area.y + area.height - popupHeight - 8));
  return {
    bounds: { x, y, width: popupWidth, height: popupHeight },
    submenuSide,
  };
}

function applyTrayMenuWindowBounds(contentHeight = trayMenuContentHeight, preservePosition = false, explicitWidth = 520, syncMenuData = true) {
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
  if (syncMenuData && trayMenuData) {
    trayMenuData.meta = {
      ...(trayMenuData.meta || {}),
      submenuSide: computed.submenuSide,
    };
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
  const popup = ensureTrayMenuWindow();
  const currentBounds = popup.getBounds();
  if (currentBounds && Number.isFinite(currentBounds.height) && currentBounds.height > 0) {
    trayMenuContentHeight = currentBounds.height;
  }
  if (!trayMenuData) {
    createTrayMenu().catch(() => {});
  } else {
    // Show cached menu immediately, then refresh in background for responsiveness.
    createTrayMenu().catch(() => {});
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
    case 'quit':
      app.quit();
      return { ok: true, hide: true };
    case 'toggle-system-proxy': {
      const targetEnabled = Boolean(payload && payload.checked);
      patchTrayMenuNetworkState({ systemProxyEnabled: targetEnabled });
      const command = payload && payload.checked ? 'system-proxy-enable' : 'system-proxy-disable';
      const response = await runTrayCommand(command, ['--config', configPath], labels);
      if (!response.ok) {
        createTrayMenu().catch(() => {});
      }
      emitTrayRefresh();
      return { ok: true, submenu: 'network' };
    }
    case 'toggle-tun': {
      const target = payload && payload.checked ? 'true' : 'false';
      patchTrayMenuNetworkState({ tunEnabled: target === 'true' });
      const response = await runTrayCommand('tun', ['--enable', target, ...getControllerArgsFromSettings()], labels);
      if (response.ok) {
        persistTunEnabledToSettings(target === 'true');
      } else {
        createTrayMenu().catch(() => {});
      }
      emitTrayRefresh();
      return { ok: true, submenu: 'network' };
    }
    case 'copy-shell-export': {
      const shellExportCommand = buildShellExportCommand((trayMenuData && trayMenuData.meta && trayMenuData.meta.networkTakeoverPort) || '7890');
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
    try {
      const normalized = normalizeBridgeArgs(args, options);
      const bridgeArgs = normalized.args;
      const sudoPass = normalized.sudoPass;
      // console.log('[runBridge] Running command:', args);
      const commandType = bridgeArgs[0];
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
          stdout += chunk.toString();
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
      // console.error('Error in runBridge:', err);
      resolve({ 
        ok: false, 
        error: 'unexpected_error', 
        details: err.message 
      });
    }
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
  const win = new BrowserWindow({
    show: Boolean(showOnCreate),
    width: 1180,
    height: 760,
    minWidth: 980,
    minHeight: 640,
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
          const parsed = JSON.parse(raw);
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
    win.hide();
    if (app.dock && app.dock.hide) {
      app.dock.hide();
    }
  });

  win.webContents.on('before-input-event', (event, input) => {
    if (globalSettings.debugMode) {
      return;
    }
    const key = (input.key || '').toLowerCase();
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
    execFileSync('iconutil', ['-c', 'iconset', iconPath, '-o', iconsetDir]);
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
  createWindow(false);
  ensureTrayMenuWindow();
  setTimeout(setDockIcon, 500);
  setTimeout(setDockIcon, 1500);
  setTimeout(setDockIcon, 3000);

  applyAppMenu();

  ipcMain.handle('clashfox:command', async (_event, command, args = [], options = {}) => {
    const result = await runBridgeWithAutoAuth(command, args, options);
    if (result && result.ok && ['start', 'stop', 'restart', 'mode'].includes(command)) {
      await createTrayMenu();
    }
    return result;
  });

  ipcMain.handle('clashfox:trayMenu:getData', async () => {
    const data = await createTrayMenu();
    return data || trayMenuData || {};
  });

  ipcMain.handle('clashfox:trayMenu:action', async (_event, action, payload = {}) => {
    const result = await handleTrayMenuAction(action, payload);
    createTrayMenu().catch(() => {});
    return result || { ok: false };
  });

  ipcMain.on('clashfox:trayMenu:hide', () => {
    hideTrayMenuWindow();
  });

  ipcMain.on('clashfox:trayMenu:setExpanded', (_event, expanded, payload = {}) => {
    const requestedWidth = payload && Number.isFinite(payload.width)
      ? Number(payload.width)
      : (expanded ? 520 : 260);
    const requestedHeight = payload && Number.isFinite(payload.height) ? Number(payload.height) : trayMenuContentHeight;
    trayMenuContentHeight = Math.max(200, Math.min(requestedHeight || trayMenuContentHeight || 420, 620));
    if (trayMenuWindow && !trayMenuWindow.isDestroyed() && trayMenuVisible) {
      applyTrayMenuWindowBounds(trayMenuContentHeight, true, requestedWidth, false);
    }
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
      shell.showItemInFolder(targetPath);
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

  ipcMain.handle('clashfox:readSettings', () => {
    try {
      ensureAppDirs();
      const settingsPath = path.join(APP_DATA_DIR, 'settings.json');
      const defaultConfigPath = path.join(APP_DATA_DIR, 'config', 'default.yaml');
      if (!fs.existsSync(settingsPath)) {
        const defaults = {
          configFile: defaultConfigPath,
        };
        fs.writeFileSync(settingsPath, `${JSON.stringify(defaults, null, 2)}\n`);
        return { ok: true, data: defaults };
      }
      const raw = fs.readFileSync(settingsPath, 'utf8');
      const parsed = JSON.parse(raw) || {};
      let changed = false;
      if (!parsed.configFile && typeof parsed.configPath === 'string') {
        parsed.configFile = parsed.configPath;
        changed = true;
      }
      if (Object.prototype.hasOwnProperty.call(parsed, 'configPath')) {
        delete parsed.configPath;
        changed = true;
      }
      if (!parsed.configFile) {
        parsed.configFile = defaultConfigPath;
        changed = true;
      }
      if (changed) {
        fs.writeFileSync(settingsPath, `${JSON.stringify(parsed, null, 2)}\n`);
      }
      return { ok: true, data: parsed };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('clashfox:writeSettings', async (_event, data) => {
    try {
      ensureAppDirs();
      const settingsPath = path.join(APP_DATA_DIR, 'settings.json');
      const payload = data && typeof data === 'object' ? { ...data } : {};
      if (!payload.configFile && typeof payload.configPath === 'string') {
        payload.configFile = payload.configPath;
      }
      if (Object.prototype.hasOwnProperty.call(payload, 'configPath')) {
        delete payload.configPath;
      }
      const json = JSON.stringify(payload, null, 2);
      fs.writeFileSync(settingsPath, `${json}\n`);
      await createTrayMenu();
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

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow(false);
    }
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
