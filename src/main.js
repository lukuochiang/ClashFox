const fs = require('fs');
const os = require('os');
const path = require('path');
const { app, BrowserWindow, ipcMain, dialog, nativeImage, Menu } = require('electron');
const { spawn, execFileSync } = require('child_process');

const ROOT_DIR = path.join(__dirname, '..');
const BRIDGE_PATH = path.join(ROOT_DIR, 'scripts', 'gui_bridge.sh');
let mainWindow = null;
let currentInstallProcess = null; // 仅用于跟踪安装进程，支持取消功能

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
      let isInstallCommand = commandType === 'install';
      
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
      const child = spawn('bash', [BRIDGE_PATH, ...args], { cwd: ROOT_DIR });
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
      const timeout = setTimeout(() => {
        if (!resolved && child) {
          // console.log('[runBridge] Process timeout, killing PID:', processId);
          try {
            child.kill();
          } catch (err) {
            // console.error('[runBridge] Error killing timed-out process:', err);
          }
        }
      }, 30000);

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
          const parsed = JSON.parse(output);
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
      devTools: true
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
      devTools: false
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