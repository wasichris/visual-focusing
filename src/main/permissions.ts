import { systemPreferences } from 'electron';
import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from './logger';

const execAsync = promisify(exec);

export class PermissionsManager {
  async checkAccessibilityPermission(): Promise<boolean> {
    if (process.platform !== 'darwin') {
      logger.debug('非 macOS 平台，跳過權限檢查');
      return true;
    }

    try {
      const status = systemPreferences.isTrustedAccessibilityClient(false);
      logger.debug(`輔助使用權限狀態: ${status}`);
      return status;
    } catch (error) {
      logger.error('檢查輔助使用權限失敗', error);
      return false;
    }
  }

  async requestAccessibilityPermission(): Promise<boolean> {
    if (process.platform !== 'darwin') {
      return true;
    }

    try {
      const status = systemPreferences.isTrustedAccessibilityClient(true);
      
      if (!status) {
        logger.info('正在開啟系統偏好設定...');
        await this.openSystemPreferences();
      } else {
        logger.info('已獲得輔助使用權限');
      }
      
      return status;
    } catch (error) {
      logger.error('請求輔助使用權限失敗', error);
      return false;
    }
  }

  private async openSystemPreferences(): Promise<void> {
    try {
      await execAsync(
        'open "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"'
      );
      logger.debug('系統偏好設定已開啟');
    } catch (error) {
      logger.error('開啟系統偏好設定失敗', error);
    }
  }

  getPermissionStatus(): {
    accessibility: boolean;
    message: string;
  } {
    const hasPermission = systemPreferences.isTrustedAccessibilityClient(false);

    return {
      accessibility: hasPermission,
      message: hasPermission
        ? '已授予輔助使用權限'
        : '需要輔助使用權限才能控制視窗',
    };
  }
}

export const permissionsManager = new PermissionsManager();
