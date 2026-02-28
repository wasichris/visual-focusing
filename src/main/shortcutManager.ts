import { globalShortcut, Notification } from 'electron';
import Store from 'electron-store';
import type { ShortcutConfig, Direction, AppConfig } from '../shared/types';
import { windowManagerInstance } from './windowManager';
import { logger } from './logger';

// 使用型別斷言繞過 ElectronStore 的型別限制
type StoreWithMethods<T extends Record<string, any>> = Store<T> & {
  get<K extends keyof T>(key: K): T[K];
  get<K extends keyof T>(key: K, defaultValue: T[K]): T[K];
  set<K extends keyof T>(key: K, value: T[K]): void;
};

export class ShortcutManager {
  private store: StoreWithMethods<AppConfig>;
  private registered = false;
  private suspended = false; // 新增：暫停狀態

  constructor() {
    this.store = new Store<AppConfig>({
      defaults: {
        shortcuts: {
          up: 'CommandOrControl+Alt+Up',
          down: 'CommandOrControl+Alt+Down',
          left: 'CommandOrControl+Alt+Left',
          right: 'CommandOrControl+Alt+Right',
        },
        enabled: true,
        showNotifications: false,
        enableDebugLog: false,
        hideDockIcon: false,
        launchAtLogin: false,
        language: 'en',
      },
    }) as StoreWithMethods<AppConfig>;
  }

  // 新增：暫停快捷鍵（設定時使用）
  suspend(): void {
    this.suspended = true;
    logger.debug('快速鍵已暫停');
  }

  // 新增：恢復快捷鍵
  resume(): void {
    this.suspended = false;
    logger.debug('快速鍵已恢復');
  }

  registerShortcuts(): boolean {
    if (this.registered) {
      logger.debug('快速鍵已註冊，先取消註冊');
      this.unregisterShortcuts();
    }

    const shortcuts = this.store.get('shortcuts');

    try {
      const directions: Direction[] = ['up', 'down', 'left', 'right'];
      const failedShortcuts: string[] = [];

      for (const direction of directions) {
        const shortcut = shortcuts[direction];

        const success = globalShortcut.register(shortcut, () => {
          this.handleShortcut(direction);
        });

        if (!success) {
          logger.error(`註冊快速鍵失敗: ${direction} - ${shortcut}`);
          failedShortcuts.push(`${direction}: ${shortcut}`);
        } else {
          logger.debug(`註冊快速鍵成功: ${direction} - ${shortcut}`);
        }
      }

      if (failedShortcuts.length > 0) {
        logger.warn('部分快速鍵註冊失敗，可能與其他應用衝突');
        this.unregisterShortcuts();
        return false;
      }

      this.registered = true;
      logger.info('所有快速鍵註冊成功');
      return true;
    } catch (error) {
      logger.error('註冊快速鍵時發生錯誤', error);
      this.unregisterShortcuts();
      return false;
    }
  }

  unregisterShortcuts(): void {
    globalShortcut.unregisterAll();
    this.registered = false;
    logger.info('快速鍵已取消註冊');
  }

  updateShortcuts(shortcuts: ShortcutConfig): boolean {
    logger.info('更新快速鍵設定');
    this.unregisterShortcuts();
    this.store.set('shortcuts', shortcuts);
    return this.registerShortcuts();
  }

  getShortcuts(): ShortcutConfig {
    return this.store.get('shortcuts');
  }

  private handleShortcut(direction: Direction): void {
    // 如果暫停中，不處理快捷鍵
    if (this.suspended) {
      logger.debug(`快速鍵已暫停，忽略: ${direction}`);
      return;
    }

    logger.debug(`觸發快速鍵: ${direction}`);

    try {
      const targetWindow =
        windowManagerInstance.findWindowInDirection(direction);
      const showNotifications = this.store.get('showNotifications', false);

      if (targetWindow) {
        const success = windowManagerInstance.focusWindow(targetWindow.id);
        if (success) {
          // 根據設定顯示通知
          if (showNotifications && Notification.isSupported()) {
            const notification = new Notification({
              title: '視窗切換',
              body: `已切換至: ${targetWindow.title}`,
              silent: true,
              timeoutType: 'never',
            });
            notification.show();

            // 1 秒後自動關閉通知
            setTimeout(() => {
              notification.close();
            }, 1000);
          }
        } else {
          logger.warn('視窗切換失敗');
        }
      } else {
        logger.debug(`${direction} 方向沒有找到視窗`);

        // 根據設定顯示沒有視窗的提示
        if (showNotifications && Notification.isSupported()) {
          const notification = new Notification({
            title: '視窗切換',
            body: `${this.getDirectionName(direction)}沒有可切換的視窗`,
            silent: true,
          });
          notification.show();
          setTimeout(() => {
            notification.close();
          }, 1000);
        }
      }
    } catch (error) {
      logger.error('處理快速鍵時發生錯誤', error);
    }
  }

  private getDirectionName(direction: Direction): string {
    const names: Record<Direction, string> = {
      up: '上方',
      down: '下方',
      left: '左方',
      right: '右方',
    };
    return names[direction];
  }

  isRegistered(): boolean {
    return this.registered;
  }
}

export const shortcutManager = new ShortcutManager();
