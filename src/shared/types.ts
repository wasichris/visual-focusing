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
}

export type Direction = 'up' | 'down' | 'left' | 'right';
