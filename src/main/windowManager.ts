import * as windowManagerLib from 'node-window-manager';
import type { WindowInfo, Direction, WindowBounds } from '../shared/types';
import { logger } from './logger';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const wm = (windowManagerLib as any).windowManager;

export class WindowManager {
  private cachedWindows: WindowInfo[] = [];
  private lastUpdateTime = 0;
  private readonly CACHE_DURATION = 500;
  private readonly MIN_WINDOW_SIZE = 50; // 最小視窗大小（避免偵測到極小視窗）

  getAllWindows(): WindowInfo[] {
    const now = Date.now();
    
    if (now - this.lastUpdateTime < this.CACHE_DURATION) {
      return this.cachedWindows;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const windows = wm.getWindows();
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.cachedWindows = windows
        .filter((win: any) => {
          try {
            const bounds = win.getBounds();
            const title = win.getTitle();
            const owner = win.getOwner();
            const ownerName = owner?.name || '';
            
            // 排除條件
            const isTooSmall = bounds.width < this.MIN_WINDOW_SIZE || 
                              bounds.height < this.MIN_WINDOW_SIZE;
            const hasNoTitle = title.length === 0;
            const isMinimized = this.isMinimized(win);
            const isDock = ownerName === 'Dock' || title === 'Dock';
            const isSystemUI = title.includes('Item-0'); // 系統 UI 元素
            const isNotificationCenter = ownerName === 'NotificationCenter' || 
                                        title.includes('通知中心') || 
                                        title.includes('Notification Center');
            
            // 記錄被過濾的視窗
            if (isTooSmall || hasNoTitle || isMinimized || isDock || isSystemUI || isNotificationCenter) {
              const reasons = [];
              if (isTooSmall) reasons.push(`太小(${bounds.width}x${bounds.height})`);
              if (hasNoTitle) reasons.push('無標題');
              if (isMinimized) reasons.push('已最小化');
              if (isDock) reasons.push('Dock');
              if (isSystemUI) reasons.push('系統UI');
              if (isNotificationCenter) reasons.push('通知中心');
              logger.debug(`  [過濾] ${title || '(無標題)'} - ${reasons.join(', ')}`);
            }
            
            return !isTooSmall && 
                   !hasNoTitle && 
                   !isMinimized && 
                   !isDock && 
                   !isSystemUI &&
                   !isNotificationCenter;
          } catch (err) {
            logger.debug('過濾視窗時發生錯誤', err);
            return false;
          }
        })
        .map((win: any, index: number) => {
          const bounds = win.getBounds();
          return {
            id: win.id,
            title: win.getTitle(),
            owner: win.getOwner()?.name || 'Unknown',
            bounds: {
              x: bounds.x || 0,
              y: bounds.y || 0,
              width: bounds.width || 0,
              height: bounds.height || 0,
            },
            zIndex: index, // 記錄在原始列表中的順序（越小越在上層）
          };
        });

      this.lastUpdateTime = now;
      
      // 詳細記錄所有找到的視窗（包含 Z-order）
      logger.debug(`獲取到 ${this.cachedWindows.length} 個有效視窗 (按 Z-order 排序)`);
      this.cachedWindows.forEach((win, idx) => {
        logger.debug(
          `  [Z${win.zIndex}] ${win.title} (${win.owner}) - ` +
          `位置:(${win.bounds.x}, ${win.bounds.y}) ` +
          `大小:${win.bounds.width}x${win.bounds.height}`
        );
      });
      
      return this.cachedWindows;
    } catch (error) {
      logger.error('獲取視窗列表失敗', error);
      return [];
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private isMinimized(win: any): boolean {
    try {
      // node-window-manager 沒有直接的 isMinimized 方法
      // 透過視窗位置判斷（最小化的視窗通常在螢幕外）
      const bounds = win.getBounds();
      return bounds.x < -10000 || bounds.y < -10000;
    } catch {
      return false;
    }
  }

  getActiveWindow(): WindowInfo | null {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const activeWin = wm.getActiveWindow();
      if (!activeWin) {
        logger.debug('無法獲取當前活躍視窗');
        return null;
      }

      const bounds = activeWin.getBounds();
      const title = activeWin.getTitle();
      const owner = activeWin.getOwner();
      const ownerName = owner?.name || '';
      
      // 套用相同的過濾條件
      const isTooSmall = bounds.width < this.MIN_WINDOW_SIZE || 
                        bounds.height < this.MIN_WINDOW_SIZE;
      const hasNoTitle = title.length === 0;
      const isMinimized = this.isMinimized(activeWin);
      const isDock = ownerName === 'Dock' || title === 'Dock';
      const isSystemUI = title.includes('Item-0');
      const isNotificationCenter = ownerName === 'NotificationCenter' || 
                                   title.includes('通知中心') || 
                                   title.includes('Notification Center');
      
      // 如果當前視窗不符合條件，嘗試找同一個 app 的其他視窗
      if (isTooSmall || hasNoTitle || isMinimized || isDock || isSystemUI || isNotificationCenter) {
        const reasons = [];
        if (isTooSmall) reasons.push(`太小(${bounds.width}x${bounds.height})`);
        if (hasNoTitle) reasons.push('無標題');
        if (isMinimized) reasons.push('已最小化');
        if (isDock) reasons.push('Dock');
        if (isSystemUI) reasons.push('系統UI');
        if (isNotificationCenter) reasons.push('通知中心');
        
        logger.warn(
          `當前焦點視窗被過濾: ${title || '(無標題)'} (${ownerName}) - ${reasons.join(', ')} ` +
          `位置:(${bounds.x}, ${bounds.y}) 大小:${bounds.width}x${bounds.height}`
        );
        
        // 嘗試找同一個 app 的其他有效視窗
        const allWindows = this.getAllWindows();
        
        // 如果 owner 為空或 Unknown，用 title 匹配；否則用 owner 匹配
        const useTitle = !ownerName || ownerName === 'Unknown';
        const sameAppWindows = allWindows.filter(win => {
          if (win.id === activeWin.id) return false; // 排除自己
          
          if (useTitle) {
            // 用 title 匹配（精確匹配或包含）
            return win.title === title || (title && win.title.includes(title));
          } else {
            // 用 owner 匹配
            return win.owner === ownerName;
          }
        });
        
        logger.debug(`尋找同 App 視窗 - 使用 ${useTitle ? 'title' : 'owner'} 匹配: "${useTitle ? title : ownerName}"`);
        logger.debug(`找到 ${sameAppWindows.length} 個同 App 視窗`);
        
        if (sameAppWindows.length > 0) {
          // 選擇最大的視窗
          const largestWindow = sameAppWindows.reduce((largest, current) => {
            const largestArea = largest.bounds.width * largest.bounds.height;
            const currentArea = current.bounds.width * current.bounds.height;
            return currentArea > largestArea ? current : largest;
          });
          
          logger.info(
            `回退至同 App 的其他視窗: ${largestWindow.title} (${largestWindow.owner}) ` +
            `位置:(${largestWindow.bounds.x}, ${largestWindow.bounds.y}) ` +
            `大小:${largestWindow.bounds.width}x${largestWindow.bounds.height}`
          );
          
          return largestWindow;
        }
        
        logger.warn('找不到同 App 的其他有效視窗');
        return null;
      }

      const windowInfo: WindowInfo = {
        id: activeWin.id,
        title: title,
        owner: ownerName || 'Unknown',
        bounds: {
          x: bounds.x || 0,
          y: bounds.y || 0,
          width: bounds.width || 0,
          height: bounds.height || 0,
        },
      };
      
      logger.debug(
        `當前視窗: ${windowInfo.title} (ID:${windowInfo.id}) ` +
        `位置:(${windowInfo.bounds.x}, ${windowInfo.bounds.y}) ` +
        `大小:${windowInfo.bounds.width}x${windowInfo.bounds.height}`
      );
      return windowInfo;
    } catch (error) {
      logger.error('獲取當前視窗失敗', error);
      return null;
    }
  }

  focusWindow(windowId: number): boolean {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const windows = wm.getWindows();
      const targetWindow = windows.find((win: any) => win.id === windowId);
      
      if (targetWindow) {
        targetWindow.bringToTop();
        logger.info(`成功切換至視窗: ${targetWindow.getTitle()}`);
        return true;
      }
      
      logger.warn(`找不到 ID 為 ${windowId} 的視窗`);
      return false;
    } catch (error) {
      logger.error('切換視窗失敗', error);
      return false;
    }
  }

  findWindowInDirection(direction: Direction): WindowInfo | null {
    try {
      const currentWindow = this.getActiveWindow();
      if (!currentWindow) {
        logger.warn('無法獲取當前視窗，無法進行方向切換');
        return null;
      }

      logger.debug(
        `當前視窗: ${currentWindow.title} (ID:${currentWindow.id}) ` +
        `位置:(${currentWindow.bounds.x}, ${currentWindow.bounds.y})`
      );

      const allWindows = this.getAllWindows().filter((win) => {
        // 排除當前視窗（使用 ID 和位置雙重檢查）
        const isSameId = win.id === currentWindow.id;
        const isSamePosition = 
          win.bounds.x === currentWindow.bounds.x &&
          win.bounds.y === currentWindow.bounds.y &&
          win.bounds.width === currentWindow.bounds.width &&
          win.bounds.height === currentWindow.bounds.height;
        
        return !isSameId && !isSamePosition;
      });

      if (allWindows.length === 0) {
        logger.debug('沒有其他可切換的視窗');
        return null;
      }

      logger.debug(`可切換的視窗數量: ${allWindows.length}`);

      let targetWindow: WindowInfo | null = null;

      switch (direction) {
        case 'up':
          targetWindow = this.findWindowAbove(currentWindow, allWindows);
          break;
        case 'down':
          targetWindow = this.findWindowBelow(currentWindow, allWindows);
          break;
        case 'left':
          targetWindow = this.findWindowToLeft(currentWindow, allWindows);
          break;
        case 'right':
          targetWindow = this.findWindowToRight(currentWindow, allWindows);
          break;
      }

      if (targetWindow) {
        logger.info(
          `找到 ${direction} 方向的視窗: ${targetWindow.title} (ID:${targetWindow.id}, Z-order:${targetWindow.zIndex ?? 'N/A'}) ` +
          `位置:(${targetWindow.bounds.x}, ${targetWindow.bounds.y}) ` +
          `大小:${targetWindow.bounds.width}x${targetWindow.bounds.height}`
        );
      } else {
        logger.debug(`${direction} 方向沒有可切換的視窗`);
      }

      return targetWindow;
    } catch (error) {
      logger.error(`尋找 ${direction} 方向視窗時發生錯誤`, error);
      return null;
    }
  }

  private findWindowAbove(
    current: WindowInfo,
    windows: WindowInfo[]
  ): WindowInfo | null {
    const currentCenter = this.getCenterPoint(current.bounds);
    const currentTop = current.bounds.y;

    logger.debug(`\n=== 尋找上方視窗 ===`);
    logger.debug(`當前視窗: ${current.title}`);
    logger.debug(`  位置: (${current.bounds.x}, ${current.bounds.y}) 大小: ${current.bounds.width}x${current.bounds.height}`);
    logger.debug(`  頂部 Y = ${currentTop}`);
    logger.debug(`  X 範圍: ${current.bounds.x} ~ ${current.bounds.x + current.bounds.width}`);

    // 先記錄所有視窗的過濾情況
    windows.forEach((win) => {
      const winRight = win.bounds.x + win.bounds.width;
      const hasOverlap = this.hasHorizontalOverlap(current.bounds, win.bounds);
      const yCondition = win.bounds.y < currentTop;
      const passFilter = yCondition && hasOverlap;
      
      logger.debug(
        `\n檢查: ${win.title} [Z:${win.zIndex ?? 'N/A'}]` +
        `\n  位置: (${win.bounds.x}, ${win.bounds.y}) 大小: ${win.bounds.width}x${win.bounds.height}` +
        `\n  條件1 [頂部Y]: ${win.bounds.y} < ${currentTop} ? ${yCondition ? '✓ 是' : '✗ 否'}` +
        `\n  條件2 [X重疊]: 當前[${current.bounds.x}~${current.bounds.x + current.bounds.width}] vs 目標[${win.bounds.x}~${winRight}] ? ${hasOverlap ? '✓ 有重疊' : '✗ 無重疊'}` +
        `\n  → 結果: ${passFilter ? '✓✓ 符合條件' : '✗✗ 不符合'}`
      );
    });

    const candidates = windows
      .filter((win) => {
        return win.bounds.y < currentTop && this.hasHorizontalOverlap(current.bounds, win.bounds);
      })
      .map((win) => {
        const winBottom = win.bounds.y + win.bounds.height;
        // 修正距離計算：有重疊時距離為0，優先比較可見面積
        const verticalDistance = Math.max(0, currentTop - winBottom);
        
        // Z-order 懲罰：數字越大（越下層）懲罰越多
        const zOrderPenalty = (win.zIndex ?? 0) * 50;
        
        // 可見面積比例：計算視窗在上方的可見面積比例
        const visibleRatio = this.calculateVisibleAreaRatio(current.bounds, win.bounds, 'up');
        
        // 加權距離：垂直距離 - 可見比例x500 + Z-order懲罰
        // 向上/向下搜尋不考慮水平偏移
        const weightedDistance = verticalDistance - visibleRatio * 500 + zOrderPenalty;
        
        return {
          window: win,
          distance: weightedDistance,
          verticalDistance,
          zOrderPenalty,
          visibleRatio,
        };
      })
      .sort((a, b) => a.distance - b.distance);

    logger.debug(`\n符合條件的候選視窗: ${candidates.length} 個`);
    
    if (candidates.length > 0) {
      logger.debug(`排序後的候選清單 (前3名):`);
      candidates.slice(0, 3).forEach((c, idx) => {
        logger.debug(
          `  ${idx + 1}. ${c.window.title} [Z:${c.window.zIndex}]` +
          `\n     加權分數:${c.distance.toFixed(0)} = 垂直${c.verticalDistance.toFixed(0)} - 可見×500(${(c.visibleRatio * 500).toFixed(0)}) + Z×50(${c.zOrderPenalty})` +
          `\n     可見面積比例: ${(c.visibleRatio * 100).toFixed(1)}%`
        );
      });
      logger.debug(`\n→ 最終選擇: ${candidates[0].window.title} [Z:${candidates[0].window.zIndex}]`);
      return candidates[0].window;
    }

    // 後備搜尋：找左右方向的視窗
    logger.debug(`\n上方沒有找到視窗，啟動後備搜尋...`);
    return this.findFallbackForUp(current, windows);
  }

  private findWindowBelow(
    current: WindowInfo,
    windows: WindowInfo[]
  ): WindowInfo | null {
    const currentCenter = this.getCenterPoint(current.bounds);
    const currentBottom = current.bounds.y + current.bounds.height;

    logger.debug(`\n=== 尋找下方視窗 ===`);
    logger.debug(`當前視窗: ${current.title}`);
    logger.debug(`  位置: (${current.bounds.x}, ${current.bounds.y}) 大小: ${current.bounds.width}x${current.bounds.height}`);
    logger.debug(`  底部 Y = ${currentBottom}`);
    logger.debug(`  X 範圍: ${current.bounds.x} ~ ${current.bounds.x + current.bounds.width}`);

    // 先記錄所有視窗的過濾情況
    windows.forEach((win) => {
      const winBottom = win.bounds.y + win.bounds.height;
      const winRight = win.bounds.x + win.bounds.width;
      const hasOverlap = this.hasHorizontalOverlap(current.bounds, win.bounds);
      const yCondition = winBottom > currentBottom;
      const passFilter = yCondition && hasOverlap;
      
      logger.debug(
        `\n檢查: ${win.title} [Z:${win.zIndex ?? 'N/A'}]` +
        `\n  位置: (${win.bounds.x}, ${win.bounds.y}) 大小: ${win.bounds.width}x${win.bounds.height}` +
        `\n  條件1 [底部Y]: ${winBottom} > ${currentBottom} ? ${yCondition ? '✓ 是' : '✗ 否'}` +
        `\n  條件2 [X重疊]: 當前[${current.bounds.x}~${current.bounds.x + current.bounds.width}] vs 目標[${win.bounds.x}~${winRight}] ? ${hasOverlap ? '✓ 有重疊' : '✗ 無重疊'}` +
        `\n  → 結果: ${passFilter ? '✓✓ 符合條件' : '✗✗ 不符合'}`
      );
    });

    const candidates = windows
      .filter((win) => {
        const winBottom = win.bounds.y + win.bounds.height;
        return winBottom > currentBottom && this.hasHorizontalOverlap(current.bounds, win.bounds);
      })
      .map((win) => {
        // 修正距離計算：有重疊時距離為0，優先比較可見面積
        const verticalDistance = Math.max(0, win.bounds.y - currentBottom);
        
        // Z-order 懲罰：數字越大（越下層）懲罰越多
        const zOrderPenalty = (win.zIndex ?? 0) * 50;
        
        // 可見面積比例：計算視窗在下方的可見面積比例
        const visibleRatio = this.calculateVisibleAreaRatio(current.bounds, win.bounds, 'down');
        
        // 加權距離：垂直距離 - 可見比例x500 + Z-order懲罰
        // 向上/向下搜尋不考慮水平偏移
        const weightedDistance = verticalDistance - visibleRatio * 500 + zOrderPenalty;
        
        return {
          window: win,
          distance: weightedDistance,
          verticalDistance,
          zOrderPenalty,
          visibleRatio,
        };
      })
      .sort((a, b) => a.distance - b.distance);

    logger.debug(`\n符合條件的候選視窗: ${candidates.length} 個`);
    
    if (candidates.length > 0) {
      logger.debug(`排序後的候選清單 (前3名):`);
      candidates.slice(0, 3).forEach((c, idx) => {
        logger.debug(
          `  ${idx + 1}. ${c.window.title} [Z:${c.window.zIndex}]` +
          `\n     加權分數:${c.distance.toFixed(0)} = 垂直${c.verticalDistance.toFixed(0)} - 可見×500(${(c.visibleRatio * 500).toFixed(0)}) + Z×50(${c.zOrderPenalty})` +
          `\n     可見面積比例: ${(c.visibleRatio * 100).toFixed(1)}%`
        );
      });
      logger.debug(`\n→ 最終選擇: ${candidates[0].window.title}`);
      return candidates[0].window;
    }

    // 後備搜尋：找左右方向的視窗
    logger.debug(`\n下方沒有找到視窗，啟動後備搜尋...`);
    return this.findFallbackForDown(current, windows);
  }

  private findWindowToLeft(
    current: WindowInfo,
    windows: WindowInfo[]
  ): WindowInfo | null {
    const currentCenter = this.getCenterPoint(current.bounds);
    const currentLeft = current.bounds.x;

    logger.debug(`\n=== 尋找左方視窗 ===`);
    logger.debug(`當前視窗: ${current.title}`);
    logger.debug(`  位置: (${current.bounds.x}, ${current.bounds.y}) 大小: ${current.bounds.width}x${current.bounds.height}`);
    logger.debug(`  左邊 X = ${currentLeft}`);
    logger.debug(`  Y 範圍: ${current.bounds.y} ~ ${current.bounds.y + current.bounds.height}`);

    // 先記錄所有視窗的過濾情況
    windows.forEach((win) => {
      const winBottom = win.bounds.y + win.bounds.height;
      const hasOverlap = this.hasVerticalOverlap(current.bounds, win.bounds);
      const xCondition = win.bounds.x < currentLeft;
      const passFilter = xCondition && hasOverlap;
      
      logger.debug(
        `\n檢查: ${win.title} [Z:${win.zIndex ?? 'N/A'}]` +
        `\n  位置: (${win.bounds.x}, ${win.bounds.y}) 大小: ${win.bounds.width}x${win.bounds.height}` +
        `\n  條件1 [左邊X]: ${win.bounds.x} < ${currentLeft} ? ${xCondition ? '✓ 是' : '✗ 否'}` +
        `\n  條件2 [Y重疊]: 當前[${current.bounds.y}~${current.bounds.y + current.bounds.height}] vs 目標[${win.bounds.y}~${winBottom}] ? ${hasOverlap ? '✓ 有重疊' : '✗ 無重疊'}` +
        `\n  → 結果: ${passFilter ? '✓✓ 符合條件' : '✗✗ 不符合'}`
      );
    });

    const candidates = windows
      .filter((win) => {
        return win.bounds.x < currentLeft && this.hasVerticalOverlap(current.bounds, win.bounds);
      })
      .map((win) => {
        const winRight = win.bounds.x + win.bounds.width;
        // 修正距離計算：有重疊時距離為0，優先比較可見面積
        const horizontalDistance = Math.max(0, currentLeft - winRight);
        
        // Z-order 懲罰：數字越大（越下層）懲罰越多
        const zOrderPenalty = (win.zIndex ?? 0) * 50;
        
        // 可見面積比例：計算視窗在左方的可見面積比例
        const visibleRatio = this.calculateVisibleAreaRatio(current.bounds, win.bounds, 'left');
        
        // 加權距離：水平距離 - 可見比例x500 + Z-order懲罰
        // 向左/向右搜尋不考慮垂直偏移
        const weightedDistance = horizontalDistance - visibleRatio * 500 + zOrderPenalty;
        
        return {
          window: win,
          distance: weightedDistance,
          horizontalDistance,
          zOrderPenalty,
          visibleRatio,
        };
      })
      .sort((a, b) => a.distance - b.distance);

    logger.debug(`\n符合條件的候選視窗: ${candidates.length} 個`);
    
    if (candidates.length > 0) {
      logger.debug(`排序後的候選清單 (前3名):`);
      candidates.slice(0, 3).forEach((c, idx) => {
        logger.debug(
          `  ${idx + 1}. ${c.window.title} [Z:${c.window.zIndex}]` +
          `\n     加權分數:${c.distance.toFixed(0)} = 水平${c.horizontalDistance.toFixed(0)} - 可見×500(${(c.visibleRatio * 500).toFixed(0)}) + Z×50(${c.zOrderPenalty})` +
          `\n     可見面積比例: ${(c.visibleRatio * 100).toFixed(1)}%`
        );
      });
      logger.debug(`\n→ 最終選擇: ${candidates[0].window.title}`);
      return candidates[0].window;
    }

    // 後備搜尋：找上下方向的視窗
    logger.debug(`\n左方沒有找到視窗，啟動後備搜尋...`);
    return this.findFallbackForLeft(current, windows);
  }

  private findWindowToRight(
    current: WindowInfo,
    windows: WindowInfo[]
  ): WindowInfo | null {
    const currentCenter = this.getCenterPoint(current.bounds);
    const currentRight = current.bounds.x + current.bounds.width;

    logger.debug(`\n=== 尋找右方視窗 ===`);
    logger.debug(`當前視窗: ${current.title}`);
    logger.debug(`  位置: (${current.bounds.x}, ${current.bounds.y}) 大小: ${current.bounds.width}x${current.bounds.height}`);
    logger.debug(`  右邊 X = ${currentRight}`);
    logger.debug(`  Y 範圍: ${current.bounds.y} ~ ${current.bounds.y + current.bounds.height}`);

    // 先記錄所有視窗的過濾情況
    windows.forEach((win) => {
      const winRight = win.bounds.x + win.bounds.width;
      const winBottom = win.bounds.y + win.bounds.height;
      const hasOverlap = this.hasVerticalOverlap(current.bounds, win.bounds);
      const xCondition = winRight > currentRight;
      const passFilter = xCondition && hasOverlap;
      
      logger.debug(
        `\n檢查: ${win.title} [Z:${win.zIndex ?? 'N/A'}]` +
        `\n  位置: (${win.bounds.x}, ${win.bounds.y}) 大小: ${win.bounds.width}x${win.bounds.height}` +
        `\n  條件1 [右邊X]: ${winRight} > ${currentRight} ? ${xCondition ? '✓ 是' : '✗ 否'}` +
        `\n  條件2 [Y重疊]: 當前[${current.bounds.y}~${current.bounds.y + current.bounds.height}] vs 目標[${win.bounds.y}~${winBottom}] ? ${hasOverlap ? '✓ 有重疊' : '✗ 無重疊'}` +
        `\n  → 結果: ${passFilter ? '✓✓ 符合條件' : '✗✗ 不符合'}`
      );
    });

    const candidates = windows
      .filter((win) => {
        const winRight = win.bounds.x + win.bounds.width;
        return winRight > currentRight && this.hasVerticalOverlap(current.bounds, win.bounds);
      })
      .map((win) => {
        // 修正距離計算：有重疊時距離為0，優先比較可見面積
        const horizontalDistance = Math.max(0, win.bounds.x - currentRight);
        
        // Z-order 懲罰：數字越大（越下層）懲罰越多
        const zOrderPenalty = (win.zIndex ?? 0) * 50;
        
        // 可見面積比例：計算視窗在右方的可見面積比例
        const visibleRatio = this.calculateVisibleAreaRatio(current.bounds, win.bounds, 'right');
        
        // 加權距離：水平距離 - 可見比例x500 + Z-order懲罰
        // 向左/向右搜尋不考慮垂直偏移
        const weightedDistance = horizontalDistance - visibleRatio * 500 + zOrderPenalty;
        
        return {
          window: win,
          distance: weightedDistance,
          horizontalDistance,
          zOrderPenalty,
          visibleRatio,
        };
      })
      .sort((a, b) => a.distance - b.distance);

    logger.debug(`\n符合條件的候選視窗: ${candidates.length} 個`);
    
    if (candidates.length > 0) {
      logger.debug(`排序後的候選清單 (前3名):`);
      candidates.slice(0, 3).forEach((c, idx) => {
        logger.debug(
          `  ${idx + 1}. ${c.window.title} [Z:${c.window.zIndex}]` +
          `\n     加權分數:${c.distance.toFixed(0)} = 水平${c.horizontalDistance.toFixed(0)} - 可見×500(${(c.visibleRatio * 500).toFixed(0)}) + Z×50(${c.zOrderPenalty})` +
          `\n     可見面積比例: ${(c.visibleRatio * 100).toFixed(1)}%`
        );
      });
      logger.debug(`\n→ 最終選擇: ${candidates[0].window.title}`);
      return candidates[0].window;
    }

    // 後備搜尋：找上下方向的視窗
    logger.debug(`\n右方沒有找到視窗，啟動後備搜尋...`);
    return this.findFallbackForRight(current, windows);
  }

  /**
   * 檢查兩個視窗是否完全重疊（X軸和Y軸都有重疊）
   */
  private hasCompleteOverlap(win1: WindowBounds, win2: WindowBounds): boolean {
    return this.hasHorizontalOverlap(win1, win2) && this.hasVerticalOverlap(win1, win2);
  }

  /**
   * 後備搜尋：向上找不到時，從上緣往下找最近的重疊視窗
   */
  private findFallbackForUp(
    current: WindowInfo,
    windows: WindowInfo[]
  ): WindowInfo | null {
    logger.debug(`\n=== 後備搜尋：從上緣往下找重疊視窗 ===`);
    logger.debug(`當前視窗: ${current.title}`);
    logger.debug(`  Y 座標: ${current.bounds.y}`);
    logger.debug(`  搜尋條件: 與當前視窗完全重疊 且 Y > ${current.bounds.y}（在下方）`);
    
    // 先檢查所有視窗
    windows.forEach((win) => {
      const hasXOverlap = this.hasHorizontalOverlap(current.bounds, win.bounds);
      const hasYOverlap = this.hasVerticalOverlap(current.bounds, win.bounds);
      const hasComplete = hasXOverlap && hasYOverlap;
      const yCondition = win.bounds.y > current.bounds.y;
      
      logger.debug(
        `\n檢查: ${win.title}` +
        `\n  位置: (${win.bounds.x}, ${win.bounds.y}) 大小: ${win.bounds.width}x${win.bounds.height}` +
        `\n  X重疊: ${hasXOverlap ? '✓' : '✗'}` +
        `\n  Y重疊: ${hasYOverlap ? '✓' : '✗'}` +
        `\n  完全重疊: ${hasComplete ? '✓' : '✗'}` +
        `\n  Y座標條件 (${win.bounds.y} > ${current.bounds.y}): ${yCondition ? '✓' : '✗'}` +
        `\n  → ${hasComplete && yCondition ? '✓✓ 符合' : '✗✗ 不符合'}`
      );
    });
    
    const candidates = windows
      .filter((win) => this.hasCompleteOverlap(current.bounds, win.bounds))
      .filter((win) => win.bounds.y > current.bounds.y)
      .sort((a, b) => a.bounds.y - b.bounds.y);  // 升序，選最小的Y（最接近上緣）

    if (candidates.length > 0) {
      logger.debug(`\n找到 ${candidates.length} 個符合條件的候選視窗`);
      logger.debug(`選擇最接近的: ${candidates[0].title} (Y: ${candidates[0].bounds.y})`);
      return candidates[0];
    }

    logger.debug(`\n後備搜尋也未找到視窗`);
    return null;
  }

  /**
   * 後備搜尋：向下找不到時，從下緣往上找最近的重疊視窗
   */
  private findFallbackForDown(
    current: WindowInfo,
    windows: WindowInfo[]
  ): WindowInfo | null {
    const currentBottom = current.bounds.y + current.bounds.height;
    logger.debug(`\n=== 後備搜尋：從下緣往上找重疊視窗 ===`);
    logger.debug(`當前視窗: ${current.title}`);
    logger.debug(`  下緣 Y 座標: ${currentBottom}`);
    logger.debug(`  搜尋條件: 與當前視窗完全重疊 且 Y < ${currentBottom}（在上方）`);
    
    const candidates = windows
      .filter((win) => this.hasCompleteOverlap(current.bounds, win.bounds))
      .filter((win) => win.bounds.y < currentBottom)
      .sort((a, b) => b.bounds.y - a.bounds.y);  // 降序，選最大的Y（最接近下緣）

    if (candidates.length > 0) {
      logger.debug(`找到 ${candidates.length} 個符合條件的候選視窗`);
      logger.debug(`選擇最接近的: ${candidates[0].title} (Y: ${candidates[0].bounds.y})`);
      return candidates[0];
    }

    logger.debug(`後備搜尋也未找到視窗`);
    return null;
  }

  /**
   * 後備搜尋：向左找不到時，從左緣往右找最近的重疊視窗
   */
  private findFallbackForLeft(
    current: WindowInfo,
    windows: WindowInfo[]
  ): WindowInfo | null {
    logger.debug(`\n=== 後備搜尋：從左緣往右找重疊視窗 ===`);
    logger.debug(`當前視窗: ${current.title}`);
    logger.debug(`  X 座標: ${current.bounds.x}`);
    logger.debug(`  搜尋條件: 與當前視窗完全重疊 且 X > ${current.bounds.x}（在右方）`);
    
    const candidates = windows
      .filter((win) => this.hasCompleteOverlap(current.bounds, win.bounds))
      .filter((win) => win.bounds.x > current.bounds.x)
      .sort((a, b) => a.bounds.x - b.bounds.x);  // 升序，選最小的X（最接近左緣）

    if (candidates.length > 0) {
      logger.debug(`找到 ${candidates.length} 個符合條件的候選視窗`);
      logger.debug(`選擇最接近的: ${candidates[0].title} (X: ${candidates[0].bounds.x})`);
      return candidates[0];
    }

    logger.debug(`後備搜尋也未找到視窗`);
    return null;
  }

  /**
   * 後備搜尋：向右找不到時，從右緣往左找最近的重疊視窗
   */
  private findFallbackForRight(
    current: WindowInfo,
    windows: WindowInfo[]
  ): WindowInfo | null {
    const currentRight = current.bounds.x + current.bounds.width;
    logger.debug(`\n=== 後備搜尋：從右緣往左找重疊視窗 ===`);
    logger.debug(`當前視窗: ${current.title}`);
    logger.debug(`  右緣 X 座標: ${currentRight}`);
    logger.debug(`  搜尋條件: 與當前視窗完全重疊 且 X < ${currentRight}（在左方）`);
    
    const candidates = windows
      .filter((win) => this.hasCompleteOverlap(current.bounds, win.bounds))
      .filter((win) => win.bounds.x < currentRight)
      .sort((a, b) => b.bounds.x - a.bounds.x);  // 降序，選最大的X（最接近右緣）

    if (candidates.length > 0) {
      logger.debug(`找到 ${candidates.length} 個符合條件的候選視窗`);
      logger.debug(`選擇最接近的: ${candidates[0].title} (X: ${candidates[0].bounds.x})`);
      return candidates[0];
    }

    logger.debug(`後備搜尋也未找到視窗`);
    return null;
  }

  private getCenterPoint(bounds: WindowBounds): { x: number; y: number } {
    return {
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height / 2,
    };
  }

  // 檢查兩個視窗在水平方向上是否有重疊
  private hasHorizontalOverlap(win1: WindowBounds, win2: WindowBounds): boolean {
    const win1Right = win1.x + win1.width;
    const win2Right = win2.x + win2.width;
    return !(win1Right <= win2.x || win2Right <= win1.x);
  }

  // 檢查兩個視窗在垂直方向上是否有重疊
  private hasVerticalOverlap(win1: WindowBounds, win2: WindowBounds): boolean {
    const win1Bottom = win1.y + win1.height;
    const win2Bottom = win2.y + win2.height;
    return !(win1Bottom <= win2.y || win2Bottom <= win1.y);
  }

  /**
   * 計算目標視窗在指定方向上的可見面積比例
   * @param current 當前視窗
   * @param target 目標視窗
   * @param direction 方向
   * @returns 可見面積比例 (0-1)
   */
  private calculateVisibleAreaRatio(
    current: WindowBounds,
    target: WindowBounds,
    direction: Direction
  ): number {
    const targetArea = target.width * target.height;
    if (targetArea === 0) return 0;

    let visibleArea = 0;

    switch (direction) {
      case 'up': {
        // 計算目標視窗在當前視窗頂部上方的可見面積
        const currentTop = current.y;
        const visibleBottom = Math.min(target.y + target.height, currentTop);
        const visibleTop = target.y;
        const visibleHeight = Math.max(0, visibleBottom - visibleTop);

        // X 軸方向的重疊寬度
        const overlapLeft = Math.max(current.x, target.x);
        const overlapRight = Math.min(
          current.x + current.width,
          target.x + target.width
        );
        const overlapWidth = Math.max(0, overlapRight - overlapLeft);

        visibleArea = visibleHeight * overlapWidth;
        break;
      }

      case 'down': {
        // 計算目標視窗在當前視窗底部下方的可見面積
        const currentBottom = current.y + current.height;
        const visibleTop = Math.max(target.y, currentBottom);
        const visibleBottom = target.y + target.height;
        const visibleHeight = Math.max(0, visibleBottom - visibleTop);

        // X 軸方向的重疊寬度
        const overlapLeft = Math.max(current.x, target.x);
        const overlapRight = Math.min(
          current.x + current.width,
          target.x + target.width
        );
        const overlapWidth = Math.max(0, overlapRight - overlapLeft);

        visibleArea = visibleHeight * overlapWidth;
        break;
      }

      case 'left': {
        // 計算目標視窗在當前視窗左邊界左側的可見面積
        const currentLeft = current.x;
        const visibleRight = Math.min(target.x + target.width, currentLeft);
        const visibleLeft = target.x;
        const visibleWidth = Math.max(0, visibleRight - visibleLeft);

        // Y 軸方向的重疊高度
        const overlapTop = Math.max(current.y, target.y);
        const overlapBottom = Math.min(
          current.y + current.height,
          target.y + target.height
        );
        const overlapHeight = Math.max(0, overlapBottom - overlapTop);

        visibleArea = visibleWidth * overlapHeight;
        break;
      }

      case 'right': {
        // 計算目標視窗在當前視窗右邊界右側的可見面積
        const currentRight = current.x + current.width;
        const visibleLeft = Math.max(target.x, currentRight);
        const visibleRight = target.x + target.width;
        const visibleWidth = Math.max(0, visibleRight - visibleLeft);

        // Y 軸方向的重疊高度
        const overlapTop = Math.max(current.y, target.y);
        const overlapBottom = Math.min(
          current.y + current.height,
          target.y + target.height
        );
        const overlapHeight = Math.max(0, overlapBottom - overlapTop);

        visibleArea = visibleWidth * overlapHeight;
        break;
      }
    }

    return visibleArea / targetArea;
  }

  private calculateDistance(
    x1: number,
    y1: number,
    x2: number,
    y2: number
  ): number {
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
  }

  clearCache(): void {
    this.cachedWindows = [];
    this.lastUpdateTime = 0;
  }
}

export const windowManagerInstance = new WindowManager();
