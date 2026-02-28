import { contextBridge, ipcRenderer } from 'electron';
import type { AppConfig, WindowInfo } from '../shared/types';

contextBridge.exposeInMainWorld('electronAPI', {
  getConfig: () => ipcRenderer.invoke('get-config'),
  setConfig: (config: AppConfig) => ipcRenderer.invoke('set-config', config),
  checkPermissions: () => ipcRenderer.invoke('check-permissions'),
  requestPermissions: () => ipcRenderer.invoke('request-permissions'),
  getAllWindows: (): Promise<WindowInfo[]> =>
    ipcRenderer.invoke('get-all-windows'),
  getActiveWindow: (): Promise<WindowInfo | null> =>
    ipcRenderer.invoke('get-active-window'),
  suspendShortcuts: () => ipcRenderer.invoke('suspend-shortcuts'),
  resumeShortcuts: () => ipcRenderer.invoke('resume-shortcuts'),
  getVersion: (): Promise<string> => ipcRenderer.invoke('get-version'),
  checkUpdate: (): Promise<{
    hasUpdate: boolean;
    latestVersion: string;
    currentVersion: string;
    releaseUrl: string;
  }> => ipcRenderer.invoke('check-update'),
});
