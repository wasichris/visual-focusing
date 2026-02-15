import type { AppConfig, WindowInfo } from './shared/types';

export interface ElectronAPI {
  getConfig: () => Promise<AppConfig>;
  setConfig: (config: AppConfig) => Promise<boolean>;
  checkPermissions: () => Promise<{
    accessibility: boolean;
    message: string;
  }>;
  requestPermissions: () => Promise<boolean>;
  getAllWindows: () => Promise<WindowInfo[]>;
  getActiveWindow: () => Promise<WindowInfo | null>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
