const fs = require('fs');
const os = require('os');
const path = require('path');
const { app, BrowserWindow, ipcMain, dialog, nativeImage, Menu, nativeTheme, shell, Tray, session } = require('electron');
const { spawn, execFileSync } = require('child_process');

const isDev = !app.isPackaged;
const ROOT_DIR = isDev ? path.join(__dirname, '..') : process.resourcesPath;
const APP_PATH = app.getAppPath ? app.getAppPath() : ROOT_DIR;
app.name = 'ClashFox';
app.setName('ClashFox');
const APP_DATA_DIR = path.join(app.getPath('appData'), app.getName());
const CHROMIUM_DIR = path.join(APP_DATA_DIR, 'others');
app.setPath('userData', CHROMIUM_DIR);
// app.setPath('cache', path.join(CHROMIUM_DIR, 'Cache'));
// app.setPath('logs', path.join(CHROMIUM_DIR, 'Logs'));

function ensureAppDirs() {
  try {
    fs.mkdirSync(APP_DATA_DIR, { recursive: true });
    fs.mkdirSync(CHROMIUM_DIR, { recursive: true });
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
let dashboardWindow = null;
let currentInstallProcess = null; // 仅用于跟踪安装进程，支持取消功能
let sudoKeepAliveTimer = null;
let sudoKeepAliveInFlight = false;
let sudoLastActivityAt = 0;
let sudoAuthorizeInFlight = null;
let globalSettings = {
  debugMode: true, // 是否启用调试模式
};
let isQuitting = false;
const SUDO_KEEPALIVE_INTERVAL_MS = 55 * 1000;
const SUDO_KEEPALIVE_IDLE_TIMEOUT_MS = 45 * 60 * 1000;
const SUDO_AUTH_TIMEOUT_MS = 45 * 1000;
const CORE_STARTUP_ESTIMATE_MIN_MS = 900;
const CORE_STARTUP_ESTIMATE_MAX_MS = 10000;
const RESTART_TRANSITION_MIN_MS = 450;
const RESTART_TRANSITION_MAX_MS = 4000;
const RESTART_TRANSITION_RATIO = 0.5;
let trayCoreStartupEstimateMs = 1500;
const PRIVILEGED_COMMANDS = new Set(['install', 'start', 'stop', 'restart', 'delete-backups']);
const OUTBOUND_MODE_BADGE = {
  rule: 'R',
  global: 'G',
  direct: 'D',
};
const OUTBOUND_MODE_BADGE_STYLE = {
  rule: { bg: '#ffffff', fg: '#0b1118' },
  global: { bg: '#ffffff', fg: '#0b1118' },
  direct: { bg: '#ffffff', fg: '#0b1118' },
};

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
  }
  return icon;
}

function runSudoCheckNoPrompt() {
  return new Promise((resolve) => {
    const child = spawn('sudo', ['-n', 'true']);
    child.on('error', () => resolve(false));
    child.on('close', (code) => resolve(code === 0));
  });
}

function stopSudoKeepAlive() {
  if (sudoKeepAliveTimer) {
    clearInterval(sudoKeepAliveTimer);
    sudoKeepAliveTimer = null;
  }
  sudoLastActivityAt = 0;
}

function markSudoActivity() {
  sudoLastActivityAt = Date.now();
}

function startSudoKeepAlive() {
  if (!sudoLastActivityAt) {
    markSudoActivity();
  }
  if (sudoKeepAliveTimer) {
    return;
  }
  sudoKeepAliveTimer = setInterval(async () => {
    if (sudoKeepAliveInFlight) {
      return;
    }
    if (!sudoLastActivityAt || (Date.now() - sudoLastActivityAt) >= SUDO_KEEPALIVE_IDLE_TIMEOUT_MS) {
      stopSudoKeepAlive();
      return;
    }
    sudoKeepAliveInFlight = true;
    try {
      const ok = await runSudoCheckNoPrompt();
      if (!ok) {
        stopSudoKeepAlive();
      }
    } finally {
      sudoKeepAliveInFlight = false;
    }
  }, SUDO_KEEPALIVE_INTERVAL_MS);
  if (sudoKeepAliveTimer && typeof sudoKeepAliveTimer.unref === 'function') {
    sudoKeepAliveTimer.unref();
  }
}

function runSudoValidateInteractive() {
  if (sudoAuthorizeInFlight) {
    return sudoAuthorizeInFlight;
  }
  sudoAuthorizeInFlight = new Promise((resolve) => {
    const child = spawn('sudo', ['-v']);
    let finished = false;
    const finalize = (ok) => {
      if (finished) return;
      finished = true;
      resolve(Boolean(ok));
    };
    const timer = setTimeout(() => {
      try {
        child.kill('SIGTERM');
      } catch {
        // ignore
      }
      finalize(false);
    }, SUDO_AUTH_TIMEOUT_MS);
    child.on('error', () => {
      clearTimeout(timer);
      finalize(false);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      finalize(code === 0);
    });
  }).finally(() => {
    sudoAuthorizeInFlight = null;
  });
  return sudoAuthorizeInFlight;
}

async function ensureSudoSession() {
  const ready = await runSudoCheckNoPrompt();
  if (ready) {
    markSudoActivity();
    startSudoKeepAlive();
    return true;
  }
  const authed = await runSudoValidateInteractive();
  if (!authed) {
    stopSudoKeepAlive();
    return false;
  }
  markSudoActivity();
  startSudoKeepAlive();
  return true;
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

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function promptTraySudo(labels) {
  // Deprecated: keep disabled to avoid custom auth modal when system auth is used.
  return null;
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
  const result = await runBridge([command, ...args], { sudoPass });
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
  createTrayMenu();
  return { ok: true, sudoPass };
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
  let result = await runBridge(['status']);
  if (result && result.ok) {
    return { running: Boolean(result.data && result.data.running), sudoPass: '' };
  }
  if (result && result.error === 'sudo_required') {
    const ok = await ensureSudoSession();
    if (!ok) {
      return null;
    }
    result = await runBridge(['status']);
    if (result && result.ok) {
      return { running: Boolean(result.data && result.data.running), sudoPass: '' };
    }
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
  createWindow();
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

async function createTrayMenu() {
  if (process.platform !== 'darwin') {
    return;
    return;
  }
  if (!tray) {
    const trayIcon = buildTrayIconWithMode(resolveOutboundModeFromSettings());
    tray = new Tray(trayIcon);
    if (process.platform === 'darwin' && trayIcon && typeof trayIcon.setTemplateImage === 'function') {
      trayIcon.setTemplateImage(false);
    }
    tray.setToolTip('ClashFox');
  } else {
    const trayIcon = buildTrayIconWithMode(resolveOutboundModeFromSettings());
    if (!trayIcon.isEmpty()) {
      if (process.platform === 'darwin' && typeof trayIcon.setTemplateImage === 'function') {
        trayIcon.setTemplateImage(false);
      }
      tray.setImage(trayIcon);
    }
  }
  const labels = getTrayLabels();
  const uiLabels = getUiLabels();
  const currentOutboundMode = resolveOutboundModeFromSettings();
  const currentOutboundBadge = OUTBOUND_MODE_BADGE[currentOutboundMode] || OUTBOUND_MODE_BADGE.rule;
  let dashboardEnabled = false;
  try {
    const status = await runBridge(['status']);
    dashboardEnabled = Boolean(status && status.ok && status.data && status.data.running);
  } catch {
    dashboardEnabled = false;
  }
  const trayMenu = Menu.buildFromTemplate([
    { label: labels.showMain, click: () => showMainWindow() },
    { type: 'separator' },
    {
      label: `${labels.outboundMode || 'Outbound Mode'}\t[${currentOutboundBadge}]`,
      submenu: [
        {
          type: 'radio',
          label: labels.modeGlobalTitle || 'Global Proxy',
          sublabel: labels.modeGlobalDesc || 'All requests will be forwarded to a proxy server',
          checked: currentOutboundMode === 'global',
          click: async () => {
            const response = await runTrayCommand('mode', ['--mode', 'global', ...getControllerArgsFromSettings()], labels);
            if (response.ok) {
              persistOutboundModeToSettings('global');
              await createTrayMenu();
              emitTrayRefresh();
            }
          },
        },
        {
          type: 'radio',
          label: labels.modeRuleTitle || 'Rule-Based Proxy',
          sublabel: labels.modeRuleDesc || 'Using rule system to determine how to process requests',
          checked: currentOutboundMode === 'rule',
          click: async () => {
            const response = await runTrayCommand('mode', ['--mode', 'rule', ...getControllerArgsFromSettings()], labels);
            if (response.ok) {
              persistOutboundModeToSettings('rule');
              await createTrayMenu();
              emitTrayRefresh();
            }
          },
        },
        {
          type: 'radio',
          label: labels.modeDirectTitle || 'Direct Outbound',
          sublabel: labels.modeDirectDesc || 'All requests will be sent to the target server directly',
          checked: currentOutboundMode === 'direct',
          click: async () => {
            const response = await runTrayCommand('mode', ['--mode', 'direct', ...getControllerArgsFromSettings()], labels);
            if (response.ok) {
              persistOutboundModeToSettings('direct');
              await createTrayMenu();
              emitTrayRefresh();
            }
          },
        },
      ],
    },
    { type: 'separator' },
    { label: labels.dashboard, enabled: dashboardEnabled, click: () => openDashboardPanel() },
    { type: 'separator' },
    // { label: 'About', click: () => createAboutWindow() },
    // { type: 'separator' },
    {
      label: labels.kernelManager,
      submenu: [
        {
          label: labels.startKernel,
          click: async () => {
            try {
              const status = await getKernelRunning(labels);
              if (status === null) {
                return;
              }
              if (status.running) {
                emitMainToast(uiLabels.alreadyRunning || 'Kernel is already running.', 'info');
                return;
              }
              emitMainCoreAction({ action: 'start', phase: 'start' });
              const commandStartedAt = Date.now();
              const started = await runTrayCommand('start', [], labels, status.sudoPass);
              if (started.ok) {
                const running = await waitForKernelRunningFromTray(started.sudoPass || status.sudoPass || '');
                if (running) {
                  updateTrayCoreStartupEstimate(Date.now() - commandStartedAt);
                }
                emitMainToast(uiLabels.startSuccess || 'Kernel started.', 'info');
              }
            } finally {
              emitTrayRefresh();
            }
          },
        },
        { type: 'separator' },
        {
          label: labels.stopKernel,
          click: async () => {
            try {
              const status = await getKernelRunning(labels);
              if (status === null) {
                return;
              }
              if (!status.running) {
                emitMainToast(uiLabels.alreadyStopped || 'Kernel is already stopped.', 'info');
                return;
              }
              const stopped = await runTrayCommand('stop', [], labels, status.sudoPass);
              if (stopped.ok) {
                emitMainToast(uiLabels.stopSuccess || uiLabels.stopped || 'Kernel stopped.', 'info');
              }
            } finally {
              emitTrayRefresh();
            }
          },
        },
        { type: 'separator' },
        {
          label: labels.restartKernel,
          enabled: dashboardEnabled,
          click: async () => {
            try {
              const status = await getKernelRunning(labels);
              if (status === null) {
                return;
              }
              if (!status.running) {
                emitMainToast(uiLabels.restartStarts || 'Kernel is stopped, starting now.', 'info');
                emitMainCoreAction({ action: 'start', phase: 'start' });
                const commandStartedAt = Date.now();
                const started = await runTrayCommand('start', [], labels, status.sudoPass);
                if (started.ok) {
                  const running = await waitForKernelRunningFromTray(started.sudoPass || status.sudoPass || '');
                  if (running) {
                    updateTrayCoreStartupEstimate(Date.now() - commandStartedAt);
                  }
                  emitMainToast(uiLabels.startSuccess || 'Kernel started.', 'info');
                }
                return;
              }
              const transitionDelayMs = getTrayRestartTransitionDelayMs();
              emitMainCoreAction({ action: 'restart', phase: 'transition', delayMs: transitionDelayMs });
              await sleep(transitionDelayMs);
              const commandStartedAt = Date.now();
              const restarted = await runTrayCommand('restart', [], labels, status.sudoPass);
              if (restarted.ok) {
                const running = await waitForKernelRunningFromTray(restarted.sudoPass || status.sudoPass || '');
                if (running) {
                  updateTrayCoreStartupEstimate(Date.now() - commandStartedAt);
                }
                emitMainToast(uiLabels.restartSuccess || 'Kernel restarted.', 'info');
              }
            } finally {
              emitTrayRefresh();
            }
          },
        },
      ],
    },
    { type: 'separator' },
    { label: labels.quit, click: () => app.quit() },
  ]);
  tray.setContextMenu(trayMenu);
}

function applyDevToolsState() {
  BrowserWindow.getAllWindows().forEach((win) => {
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
      const needsSudo = PRIVILEGED_COMMANDS.has(commandType);
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
          if (parsed && parsed.ok && PRIVILEGED_COMMANDS.has(commandType)) {
            markSudoActivity();
            startSudoKeepAlive();
          }
          if (parsed && parsed.error === 'sudo_required') {
            stopSudoKeepAlive();
          }
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
      if (needsSudo && !sudoPass) {
        ensureSudoSession()
          .then((ok) => {
            if (!ok) {
              resolve({ ok: false, error: 'sudo_required' });
              return;
            }
            startBridgeProcess();
          })
          .catch((err) => {
            resolve({
              ok: false,
              error: 'sudo_required',
              details: err && err.message ? err.message : String(err),
            });
          });
        return;
      }
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

function createWindow() {
  nativeTheme.themeSource = 'system';
  const win = new BrowserWindow({
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
  createWindow();
  setTimeout(setDockIcon, 500);
  setTimeout(setDockIcon, 1500);
  setTimeout(setDockIcon, 3000);

  applyAppMenu();

  ipcMain.handle('clashfox:command', async (_event, command, args = [], options = {}) => {
    const result = await runBridge([command, ...args], options);
    if (result && result.ok && ['start', 'stop', 'restart', 'mode'].includes(command)) {
      await createTrayMenu();
    }
    return result;
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
          configPath: defaultConfigPath,
        };
        fs.writeFileSync(settingsPath, JSON.stringify(defaults, null, 2));
        return { ok: true, data: defaults };
      }
      const raw = fs.readFileSync(settingsPath, 'utf8');
      const parsed = JSON.parse(raw) || {};
      if (!parsed.configPath && parsed.configFile) {
        parsed.configPath = parsed.configFile;
      }
      if (parsed.configFile) {
        delete parsed.configFile;
      }
      if (!parsed.configPath) {
        parsed.configPath = defaultConfigPath;
        fs.writeFileSync(settingsPath, JSON.stringify(parsed, null, 2));
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
      const json = JSON.stringify(data || {}, null, 2);
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
      createWindow();
    }
  });
});

app.on('before-quit', () => {
  isQuitting = true;
  stopSudoKeepAlive();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
