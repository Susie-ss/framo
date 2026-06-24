// electron-main.js — Electron 壳，窗口固定大小，无菜单，读配置端口
const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

let mainWindow;

function getDataDir() {
  const home = os.homedir();
  if (process.platform === 'darwin') {
    return path.join(home, 'Library', 'Application Support', 'AxureSyncService');
  } else if (process.platform === 'win32') {
    return path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'AxureSyncService');
  }
  return path.join(home, '.config', 'AxureSyncService');
}

function getPort() {
  const dataDir = getDataDir();
  // 1) 用户目录优先
  const userCfg = path.join(dataDir, 'config.json');
  try {
    if (fs.existsSync(userCfg)) {
      const cfg = JSON.parse(fs.readFileSync(userCfg, 'utf8'));
      if (cfg.uiPort && cfg.uiPort >= 1024 && cfg.uiPort <= 65535) return cfg.uiPort;
      if (cfg.port && cfg.port >= 1024 && cfg.port <= 65535) return cfg.port;
    }
  } catch (e) {}
  // 2) 打包内置
  const builtinCfg = path.join(__dirname, 'config.json');
  try {
    if (fs.existsSync(builtinCfg)) {
      const cfg = JSON.parse(fs.readFileSync(builtinCfg, 'utf8'));
      if (cfg.uiPort && cfg.uiPort >= 1024 && cfg.uiPort <= 65535) return cfg.uiPort;
      if (cfg.port && cfg.port >= 1024 && cfg.port <= 65535) return cfg.port;
    }
  } catch (e) {}
  return 8080;
}

function createWindow() {
  const port = getPort();
  mainWindow = new BrowserWindow({
    width: 390,
    height: 604,
    resizable: false,
    maximizable: false,
    minimizable: true,
    fullscreenable: false,
    autoHideMenuBar: true,
    title: 'AxureSyncService',
    icon: path.join(__dirname, 'app-icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  Menu.setApplicationMenu(null);
  mainWindow.setResizable(false);
  mainWindow.loadURL('http://127.0.0.1:' + port);
  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(() => {
  require('./main.js');
  setTimeout(createWindow, 1000);
});

app.on('window-all-closed', () => {
  app.quit();
});
