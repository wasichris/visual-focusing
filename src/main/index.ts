import { app, BrowserWindow, ipcMain, Notification } from 'electron';
import path from 'path';
import Store from 'electron-store';
import type { AppConfig, ShortcutConfig } from '../shared/types';
import { shortcutManager } from './shortcutManager';
import { permissionsManager } from './permissions';
import { windowManagerInstance } from './windowManager';
import { logger } from './logger';

const store = new Store<AppConfig>({
  defaults: {
    shortcuts: {
      up: 'CommandOrControl+Alt+Up',
      down: 'CommandOrControl+Alt+Down',
      left: 'CommandOrControl+Alt+Left',
      right: 'CommandOrControl+Alt+Right',
    },
    enabled: true,
    showNotifications: false, // 預設關閉通知
  },
});

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 650,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'Visual Focusing',
    resizable: true,
    minimizable: true,
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function setupIpcHandlers() {
  ipcMain.handle('get-config', () => {
    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      shortcuts: (store as any).get('shortcuts'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      enabled: (store as any).get('enabled'),
    };
  });

  ipcMain.handle('set-config', (_event, config: AppConfig) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (store as any).set('shortcuts', config.shortcuts);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (store as any).set('enabled', config.enabled);
    
    if (config.enabled) {
      shortcutManager.updateShortcuts(config.shortcuts);
    } else {
      shortcutManager.unregisterShortcuts();
    }
    
    return true;
  });

  ipcMain.handle('check-permissions', () => {
    return permissionsManager.getPermissionStatus();
  });

  ipcMain.handle('request-permissions', async () => {
    return await permissionsManager.requestAccessibilityPermission();
  });

  ipcMain.handle('get-all-windows', () => {
    return windowManagerInstance.getAllWindows();
  });

  ipcMain.handle('get-active-window', () => {
    return windowManagerInstance.getActiveWindow();
  });
}

async function initializeApp() {
  logger.info('正在初始化 Visual Focusing...');
  
  const hasPermission = await permissionsManager.checkAccessibilityPermission();
  
  if (!hasPermission) {
    logger.warn('⚠️  缺少輔助使用權限，部分功能可能無法使用');
  } else {
    logger.info('✅ 已獲得輔助使用權限');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const enabled = (store as any).get('enabled');
  if (enabled && hasPermission) {
    const success = shortcutManager.registerShortcuts();
    if (success) {
      logger.info('快速鍵已啟用並註冊');
    } else {
      logger.error('快速鍵註冊失敗');
    }
  } else {
    logger.info('快速鍵未啟用或缺少權限');
  }
  
  logger.info('Visual Focusing 初始化完成');
}

app.whenReady().then(() => {
  logger.info('Electron app 就緒');
  setupIpcHandlers();
  createWindow();
  initializeApp();

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

app.on('will-quit', () => {
  shortcutManager.unregisterShortcuts();
});
