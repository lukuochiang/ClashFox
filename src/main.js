const fs = require('fs');
const os = require('os');
const path = require('path');
const { app, BrowserWindow, ipcMain, dialog, nativeImage, Menu } = require('electron');
const { spawn, execFileSync } = require('child_process');

const ROOT_DIR = path.join(__dirname, '..');
const BRIDGE_PATH = path.join(ROOT_DIR, 'scripts', 'gui_bridge.sh');
let mainWindow = null;
let currentProcess = null; // 用于跟踪当前正在运行的进程

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
      const child = spawn('bash', [BRIDGE_PATH, ...args], { cwd: ROOT_DIR });
      let stdout = '';
      let stderr = '';

      // 修复变量名不匹配的问题，使用child而不是currentProcess
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

      child.on('close', (code) => {
        const output = stdout.trim();
        if (!output) {
          resolve({ ok: false, error: 'empty_output', details: stderr.trim(), exitCode: code });
          return;
        }
        try {
          const parsed = JSON.parse(output);
          resolve(parsed);
        } catch (err) {
          resolve({ ok: false, error: 'parse_error', details: output, exitCode: code });
        }
      });
      
      // 添加进程错误处理
      child.on('error', (err) => {
        resolve({ ok: false, error: 'process_error', details: err.message });
      });
    } catch (err) {
      // 捕获创建进程时的异常
      resolve({ ok: false, error: 'unexpected_error', details: err.message });
    }
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 980,
    minHeight: 640,
    backgroundColor: '#0f1216',
    icon: path.join(ROOT_DIR, 'assets', 'logo.png'),
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  mainWindow = win;
}

app.name = 'ClashFox';
app.setName('ClashFox');

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
    },
  });

  aboutWindow.loadFile(path.join(__dirname, 'renderer', 'about.html'));
}

function setDockIcon() {
  if (!app.dock) {
    return;
  }
  const icnsPath = path.join(ROOT_DIR, 'assets', 'logo.icns');
  if (!fs.existsSync(icnsPath)) {
    console.log('[dock] icns missing:', icnsPath);
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
    console.log('[dock] iconutil fallback failed:', error.message);
  }

  if (!dockIcon.isEmpty()) {
    app.dock.setIcon(dockIcon);
  }
}

app.whenReady().then(() => {
  setDockIcon();
  createWindow();
  setTimeout(setDockIcon, 500);
  setTimeout(setDockIcon, 1500);
  setTimeout(setDockIcon, 3000);

  if (process.platform === 'darwin') {
    const menu = Menu.buildFromTemplate([
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
      { role: 'viewMenu' },
      { role: 'windowMenu' },
      { role: 'help' },
    ]);
    Menu.setApplicationMenu(menu);
  }

  ipcMain.handle('clashfox:command', (_event, command, args = []) => {
    return runBridge([command, ...args]);
  });
  
  // 处理取消命令
  ipcMain.handle('clashfox:cancelCommand', () => {
    if (currentProcess) {
      currentProcess.kill(); // 发送SIGTERM信号
      currentProcess = null;
      return { ok: true, message: 'Operation cancelled' };
    }
    return { ok: false, error: 'no_process_running', message: 'No process is currently running' };
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

  ipcMain.handle('clashfox:openAbout', () => {
    createAboutWindow();
    return { ok: true };
  });

  ipcMain.handle('clashfox:appInfo', () => {
    return {
      ok: true,
      data: {
        name: app.getName(),
        version: app.getVersion(),
      },
    };
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});