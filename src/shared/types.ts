export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WindowInfo {
  id: number;
  title: string;
  owner: string;
  bounds: WindowBounds;
  zIndex?: number; // Z-order 索引，數字越小越在上層
}

export interface ShortcutConfig {
  up: string;
  down: string;
  left: string;
  right: string;
}

export interface AppConfig {
  shortcuts: ShortcutConfig;
  enabled: boolean;
  showNotifications: boolean; // 是否顯示切換通知，預設關閉
  enableDebugLog: boolean; // 是否啟用除錯日誌，預設關閉
  hideDockIcon: boolean; // 關閉設定視窗後是否隱藏 Dock 圖示，預設關閉
  launchAtLogin: boolean; // 開機時自動啟動，預設關閉
  language: string; // UI 語言，預設 'en'
}

export type Direction = 'up' | 'down' | 'left' | 'right';

declare global {
  interface Window {
    electronAPI: {
      getConfig: () => Promise<AppConfig>;
      setConfig: (config: AppConfig) => Promise<boolean>;
      checkPermissions: () => Promise<{
        accessibility: boolean;
        message: string;
      }>;
      requestPermissions: () => Promise<boolean>;
      getAllWindows: () => Promise<WindowInfo[]>;
      getActiveWindow: () => Promise<WindowInfo | null>;
      suspendShortcuts: () => Promise<void>;
      resumeShortcuts: () => Promise<void>;
      getVersion: () => Promise<string>;
      checkUpdate: () => Promise<{
        hasUpdate: boolean;
        latestVersion: string;
        currentVersion: string;
        releaseUrl: string;
      }>;
    };
  }
}

export {};
