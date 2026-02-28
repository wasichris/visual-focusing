import {
  app,
  BrowserWindow,
  ipcMain,
  Notification,
  nativeImage,
  Tray,
  Menu,
} from 'electron';
import path from 'path';
import Store from 'electron-store';
import type { AppConfig, ShortcutConfig } from '../shared/types';

app.setName('Visual Focusing');
import { shortcutManager } from './shortcutManager';
import { permissionsManager } from './permissions';
import { windowManagerInstance } from './windowManager';
import { logger } from './logger';
import { checkForUpdates } from './updateChecker';

// 使用型別斷言繞過 ElectronStore 的型別限制
type StoreWithMethods<T extends Record<string, any>> = Store<T> & {
  get<K extends keyof T>(key: K): T[K];
  get<K extends keyof T>(key: K, defaultValue: T[K]): T[K];
  set<K extends keyof T>(key: K, value: T[K]): void;
};

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
    enableDebugLog: false, // 預設關閉除錯日誌
    hideDockIcon: false, // 預設不隱藏 Dock 圖示
    launchAtLogin: false, // 預設不自動啟動
  },
}) as StoreWithMethods<AppConfig>;

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

function createTray() {
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'assets/icon.png')
    : path.join(__dirname, '../../../assets/icon.png');
  const icon = nativeImage
    .createFromPath(iconPath)
    .resize({ width: 18, height: 18 });
  tray = new Tray(icon);
  tray.setToolTip('Visual Focusing');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: `Visual Focusing v${app.getVersion()}`,
      enabled: false,
    },
    { type: 'separator' },
    {
      label: '開啟 Visual Focusing',
      click: async () => {
        if (process.platform === 'darwin') {
          await app.dock?.show();
        }
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createWindow();
        }
      },
    },
    { type: 'separator' },
    {
      label: '結束',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  // 左鍵、右鍵點擊都顯示選單
  tray.setContextMenu(contextMenu);
}

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
    // mainWindow.webContents.openDevTools(); // 註解掉自動開啟 DevTools
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../renderer/index.html'));
  }

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
      // 根據設定隱藏 Dock 圖示
      if (process.platform === 'darwin' && store.get('hideDockIcon')) {
        app.dock?.hide();
      }
    }
  });

  // 將 console.log 轉發到 renderer 的 console
  setupConsoleForwarding();
}

function setupConsoleForwarding() {
  if (!mainWindow) return;

  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;
  const originalDebug = console.debug;

  console.log = (...args) => {
    originalLog(...args);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.executeJavaScript(
        `console.log(${JSON.stringify(args.map(String).join(' '))})`
      );
    }
  };

  console.warn = (...args) => {
    originalWarn(...args);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.executeJavaScript(
        `console.warn(${JSON.stringify(args.map(String).join(' '))})`
      );
    }
  };

  console.error = (...args) => {
    originalError(...args);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.executeJavaScript(
        `console.error(${JSON.stringify(args.map(String).join(' '))})`
      );
    }
  };

  console.debug = (...args) => {
    originalDebug(...args);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.executeJavaScript(
        `console.debug(${JSON.stringify(args.map(String).join(' '))})`
      );
    }
  };
}

function setupIpcHandlers() {
  ipcMain.handle('get-config', () => {
    // launchAtLogin 從系統實際狀態讀取
    const loginSettings = app.getLoginItemSettings();
    return {
      shortcuts: store.get('shortcuts'),
      enabled: store.get('enabled'),
      showNotifications: store.get('showNotifications'),
      enableDebugLog: store.get('enableDebugLog'),
      hideDockIcon: store.get('hideDockIcon'),
      launchAtLogin: loginSettings.openAtLogin,
    };
  });

  ipcMain.handle('set-config', (_event, config: AppConfig) => {
    store.set('shortcuts', config.shortcuts);
    store.set('enabled', config.enabled);
    store.set('showNotifications', config.showNotifications);
    store.set('enableDebugLog', config.enableDebugLog);
    store.set('hideDockIcon', config.hideDockIcon);

    // 設定開機自動啟動
    app.setLoginItemSettings({ openAtLogin: config.launchAtLogin });

    // 更新 WindowManager 的除錯模式
    windowManagerInstance.setDebugMode(config.enableDebugLog);

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

  // 新增：暫停/恢復快捷鍵（供設定頁面使用）
  ipcMain.handle('suspend-shortcuts', () => {
    shortcutManager.suspend();
  });

  ipcMain.handle('resume-shortcuts', () => {
    shortcutManager.resume();
  });

  ipcMain.handle('get-version', () => {
    return app.getVersion();
  });

  ipcMain.handle('check-update', async () => {
    return await checkForUpdates(app.getVersion());
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

  // 讀取除錯設定並套用
  const enableDebugLog = store.get('enableDebugLog', false);
  windowManagerInstance.setDebugMode(enableDebugLog);

  const enabled = store.get('enabled');
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

  if (process.platform === 'darwin') {
    const iconPath = app.isPackaged
      ? path.join(process.resourcesPath, 'assets/icon.png')
      : path.join(__dirname, '../../../assets/icon.png');
    app.dock?.setIcon(nativeImage.createFromPath(iconPath));
  }

  setupIpcHandlers();
  createTray();
  createWindow();
  initializeApp();

  app.on('activate', async () => {
    if (process.platform === 'darwin') {
      await app.dock?.show();
    }
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    } else {
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
