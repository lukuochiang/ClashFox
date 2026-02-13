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
let currentInstallProcess = null; // 仅用于跟踪安装进程，支持取消功能
let globalSettings = {
  debugMode: true, // 是否启用调试模式
};
let isQuitting = false;

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

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function promptTraySudo(labels) {
  return new Promise((resolve) => {
    const channel = `clashfox:traySudo:${Date.now()}`;
    let resolved = false;
    const parent = mainWindow && !mainWindow.isDestroyed() ? mainWindow : null;
    let sudoTemplate = '';
    let sharedStyles = '';
    try {
      sudoTemplate = fs.readFileSync(path.join(__dirname, 'ui', 'html', 'authorize.html'), 'utf8');
      sharedStyles = fs.readFileSync(path.join(__dirname, 'ui', 'css', 'styles.css'), 'utf8');
    } catch {
      sudoTemplate = '';
      sharedStyles = '';
    }
    const win = new BrowserWindow({
      width: 420,
      height: 240,
      resizable: false,
      minimizable: false,
      maximizable: false,
      parent: parent || undefined,
      modal: Boolean(parent),
      alwaysOnTop: true,
      title: labels.sudoTitle || 'Administrator permission required',
      backgroundColor: '#0f1216',
      webPreferences: {
        contextIsolation: false,
        nodeIntegration: true,
      },
    });

    const isDark = nativeTheme && nativeTheme.shouldUseDarkColors;
    const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(labels.sudoTitle)}</title>
    <style>${sharedStyles}</style>
    <style>
      html,
      body {
        height: 100%;
      }
      body {
        margin: 0;
        overflow: hidden;
      }
    </style>
  </head>
  <body data-theme="${isDark ? 'night' : 'day'}">
    ${sudoTemplate}
    <script>
      const { ipcRenderer } = require('electron');
      const labels = ${JSON.stringify(labels)};
      const modal = document.getElementById('sudoModal');
      const title = modal ? modal.querySelector('.modal-title') : null;
      const body = modal ? modal.querySelector('.modal-body') : null;
      const hint = modal ? modal.querySelector('.modal-hint') : null;
      const cancel = document.getElementById('sudoCancel');
      const confirm = document.getElementById('sudoConfirm');
      const password = document.getElementById('sudoPassword');
      if (title) title.textContent = labels.sudoTitle || 'Authorization Required';
      if (body) body.textContent = labels.sudoMessage || 'Enter your macOS password to continue.';
      if (hint) hint.textContent = labels.sudoHint || '';
      if (cancel) cancel.textContent = labels.cancel || 'Cancel';
      if (confirm) confirm.textContent = labels.ok || 'Authorize';
      if (password) {
        password.placeholder = labels.sudoPlaceholder || '••••••••';
        password.focus();
      }
      if (modal) {
        modal.classList.add('show');
        modal.setAttribute('aria-hidden', 'false');
      }
      if (cancel) cancel.addEventListener('click', () => {
        ipcRenderer.send('${channel}', { ok: false });
      });
      if (confirm) confirm.addEventListener('click', () => {
        ipcRenderer.send('${channel}', { ok: true, password: password ? password.value : '' });
      });
      window.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          ipcRenderer.send('${channel}', { ok: true, password: password ? password.value : '' });
        }
        if (event.key === 'Escape') {
          ipcRenderer.send('${channel}', { ok: false });
        }
      });
    </script>
  </body>
</html>`;

    win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

    const cleanup = (payload) => {
      if (resolved) return;
      resolved = true;
      if (!win.isDestroyed()) {
        win.close();
      }
      resolve(payload && payload.ok ? String(payload.password || '') : null);
    };

    ipcMain.once(channel, (_event, payload) => {
      cleanup(payload);
    });

    win.on('closed', () => {
      cleanup({ ok: false });
    });
  });
}

function emitTrayRefresh() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('clashfox:trayRefresh');
  }
}

async function runTrayCommand(command, args = [], labels = TRAY_I18N.en, sudoPass = '') {
  const baseArgs = sudoPass ? [...args, '--sudo-pass', sudoPass] : args;
  const result = await runBridge([command, ...baseArgs]);
  if (!result || !result.ok) {
    if (result && result.error === 'sudo_required') {
      const password = await promptTraySudo(labels);
      if (!password) {
        return { ok: false };
      }
      return runTrayCommand(command, args, labels, password);
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
    const password = await promptTraySudo(labels);
    if (!password) {
      return null;
    }
    result = await runBridge(['status', '--sudo-pass', password]);
    if (result && result.ok) {
      return { running: Boolean(result.data && result.data.running), sudoPass: password };
    }
    if (result && result.error === 'sudo_invalid') {
      await dialog.showMessageBox({
        type: 'error',
        buttons: [labels.ok || 'OK'],
        title: labels.errorTitle || 'Operation Failed',
        message: labels.sudoInvalid || 'Password incorrect.',
      });
      return null;
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
    const url = `${controller}/ui/${panel}/`;//?secret=${encodeURIComponent(secret)}&_ts=${Date.now()}
    shell.openExternal(url);
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
  }
  if (!tray) {
    const trayIconPath = path.join(APP_PATH, 'src', 'ui', 'assets', 'menu.png');
    let trayIcon = nativeImage.createFromPath(trayIconPath);
    if (!trayIcon.isEmpty()) {
      trayIcon = trayIcon.resize({ width: 18, height: 18 });
      trayIcon.setTemplateImage(true);
    }
    tray = new Tray(trayIcon);
    tray.setToolTip('ClashFox');
  }
  const labels = getTrayLabels();
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
                return;
              }
              await runTrayCommand('start', [], labels, status.sudoPass);
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
                return;
              }
              await runTrayCommand('stop', [], labels, status.sudoPass);
            } finally {
              emitTrayRefresh();
            }
          },
        },
        { type: 'separator' },
        {
          label: labels.restartKernel,
          click: async () => {
            try {
              const ok = await confirmTrayRestart(labels);
              if (!ok) {
                return;
              }
              const status = await getKernelRunning(labels);
              if (status === null) {
                return;
              }
              if (!status.running) {
                return;
              }
              const stopped = await runTrayCommand('stop', [], labels, status.sudoPass);
              if (!stopped.ok) {
                return;
              }
              await runTrayCommand('start', [], labels, stopped.sudoPass || status.sudoPass);
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

function runBridge(args) {
  return new Promise((resolve) => {
    try {
      // console.log('[runBridge] Running command:', args);
      const commandType = args[0];

      // 1. 如果是安装命令，终止当前正在运行的安装进程（如果有）
      let isInstallCommand = commandType === 'install' || commandType === 'panel-install';
      
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
      const child = spawn('bash', [bridgePath, ...args], { cwd });
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
      if (!url.startsWith('http://127.0.0.1:9090/') && !url.startsWith('http://localhost:9090/')) {
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

function setDockIcon() {
  if (!app.dock) {
    return;
  }
  const icnsPath = path.join(APP_PATH, 'src', 'ui', 'assets', 'logo.icns');
  if (!fs.existsSync(icnsPath)) {
    // console.log('[dock] icns missing:', icnsPath);
    return;
  }
  let dockIcon = nativeImage.createFromPath(icnsPath);
  if (dockIcon.isEmpty()) {
    const icnsBuffer = fs.readFileSync(icnsPath);
    dockIcon = nativeImage.createFromBuffer(icnsBuffer);
  }

  try {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clashfox-icon-'));
    const iconsetDir = path.join(tmpDir, 'logo.iconset');
    execFileSync('iconutil', ['-c', 'iconset', icnsPath, '-o', iconsetDir]);
    const pngPath = path.join(iconsetDir, 'icon_512x512@2x.png');
    if (fs.existsSync(pngPath)) {
      const pngBuffer = fs.readFileSync(pngPath);
      const pngBase64 = pngBuffer.toString('base64');
      const padScale = 0.82;
      const size = 1024;
      const padded = Math.round(size * padScale);
      const offset = Math.round((size - padded) / 2);
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><image href="data:image/png;base64,${pngBase64}" x="${offset}" y="${offset}" width="${padded}" height="${padded}"/></svg>`;
      const svgDataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
      const paddedIcon = nativeImage.createFromDataURL(svgDataUrl);
      if (!paddedIcon.isEmpty()) {
        dockIcon = paddedIcon;
      } else {
        const pngIcon = nativeImage.createFromPath(pngPath);
        if (!pngIcon.isEmpty()) {
          dockIcon = pngIcon;
        }
      }
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (error) {
    // console.log('[dock] iconutil fallback failed:', error.message);
  }

  if (!dockIcon.isEmpty()) {
    app.dock.setIcon(dockIcon);
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

  ipcMain.handle('clashfox:command', async (_event, command, args = []) => {
    const result = await runBridge([command, ...args]);
    if (result && result.ok && ['start', 'stop', 'restart'].includes(command)) {
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
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
