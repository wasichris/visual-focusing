import { windowManager as wm } from 'node-window-manager';
import type { WindowInfo, Direction, WindowBounds } from '../shared/types';
import { logger } from './logger';

export class WindowManager {
  private cachedWindows: WindowInfo[] = [];
  private lastUpdateTime = 0;
  private readonly CACHE_DURATION = 500;
  private readonly MIN_WINDOW_SIZE = 50; // 最小視窗大小（避免偵測到極小視窗）
  private debugMode = false; // 除錯模式開關

  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
    logger.info(`除錯模式: ${enabled ? '已啟用' : '已關閉'}`);
  }

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
            const isTooSmall =
              bounds.width < this.MIN_WINDOW_SIZE ||
              bounds.height < this.MIN_WINDOW_SIZE;
            const hasNoTitle = title.length === 0;
            const isMinimized = this.isMinimized(win);
            const isDock = ownerName === 'Dock' || title === 'Dock';
            const isSystemUI = title.includes('Item-0'); // 系統 UI 元素
            const isNotificationCenter =
              ownerName === 'NotificationCenter' ||
              title.includes('通知中心') ||
              title.includes('Notification Center');

            // 記錄被過濾的視窗
            if (
              isTooSmall ||
              hasNoTitle ||
              isMinimized ||
              isDock ||
              isSystemUI ||
              isNotificationCenter
            ) {
              const reasons = [];
              if (isTooSmall)
                reasons.push(`太小(${bounds.width}x${bounds.height})`);
              if (hasNoTitle) reasons.push('無標題');
              if (isMinimized) reasons.push('已最小化');
              if (isDock) reasons.push('Dock');
              if (isSystemUI) reasons.push('系統UI');
              if (isNotificationCenter) reasons.push('通知中心');
              if (this.debugMode) {
                logger.debug(
                  `  [過濾] ${title || '(無標題)'} - ${reasons.join(', ')}`
                );
              }
            }

            return (
              !isTooSmall &&
              !hasNoTitle &&
              !isMinimized &&
              !isDock &&
              !isSystemUI &&
              !isNotificationCenter
            );
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
      if (this.debugMode) {
        logger.debug(
          `獲取到 ${this.cachedWindows.length} 個有效視窗 (按 Z-order 排序)`
        );
        this.cachedWindows.forEach((win, idx) => {
          logger.debug(
            `  [Z${win.zIndex}] ${win.title} (${win.owner}) - ` +
              `位置:(${win.bounds.x}, ${win.bounds.y}) ` +
              `大小:${win.bounds.width}x${win.bounds.height}`
          );
        });
      }

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
      const ownerName = owner?.path?.split('/').pop() || '';

      // 套應相同的過濾條件
      const isTooSmall =
        (bounds.width ?? 0) < this.MIN_WINDOW_SIZE ||
        (bounds.height ?? 0) < this.MIN_WINDOW_SIZE;
      const hasNoTitle = title.length === 0;
      const isMinimized = this.isMinimized(activeWin);
      const isDock = ownerName === 'Dock' || title === 'Dock';
      const isSystemUI = title.includes('Item-0');
      const isNotificationCenter =
        ownerName === 'NotificationCenter' ||
        title.includes('通知中心') ||
        title.includes('Notification Center');

      // 如果當前視窗不符合條件，嘗試找同一個 app 的其他視窗
      if (
        isTooSmall ||
        hasNoTitle ||
        isMinimized ||
        isDock ||
        isSystemUI ||
        isNotificationCenter
      ) {
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
        const sameAppWindows = allWindows.filter((win) => {
          if (win.id === activeWin.id) return false; // 排除自己

          if (useTitle) {
            // 用 title 匹配（精確匹配或包含）
            return win.title === title || (title && win.title.includes(title));
          } else {
            // 用 owner 匹配
            return win.owner === ownerName;
          }
        });

        logger.debug(
          `尋找同 App 視窗 - 使用 ${useTitle ? 'title' : 'owner'} 匹配: "${useTitle ? title : ownerName}"`
        );
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
        zIndex: 0, // 暫時設為 0，稍後從 getAllWindows 更新
      };

      // 從 getAllWindows 取得完整的視窗資訊（包含正確的 z-index）
      const allWindows = this.getAllWindows();
      const fullWindowInfo = allWindows.find(
        (win) =>
          win.id === windowInfo.id ||
          (win.bounds.x === windowInfo.bounds.x &&
            win.bounds.y === windowInfo.bounds.y &&
            win.bounds.width === windowInfo.bounds.width &&
            win.bounds.height === windowInfo.bounds.height)
      );

      if (fullWindowInfo) {
        // 使用完整的視窗資訊（包含 z-index）
        logger.debug(
          `當前視窗: ${fullWindowInfo.title} (ID:${fullWindowInfo.id}) ` +
            `位置:(${fullWindowInfo.bounds.x}, ${fullWindowInfo.bounds.y}) ` +
            `大小:${fullWindowInfo.bounds.width}x${fullWindowInfo.bounds.height} ` +
            `Z-index:${fullWindowInfo.zIndex}`
        );
        return fullWindowInfo;
      }

      // 找不到的話使用原本的 windowInfo（不應該發生）
      logger.warn(
        `當前視窗: ${windowInfo.title} (ID:${windowInfo.id}) ` +
          `位置:(${windowInfo.bounds.x}, ${windowInfo.bounds.y}) ` +
          `大小:${windowInfo.bounds.width}x${windowInfo.bounds.height} ` +
          `[警告] 在視窗列表中找不到對應的 z-index`
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
    const startTime = Date.now();
    try {
      const currentWindow = this.getActiveWindow();
      if (!currentWindow) {
        logger.warn('無法獲取當前視窗，無法進行方向切換');
        return null;
      }

      logger.debug(
        `\n[查詢] 方向=${direction.toUpperCase()} 當前=${currentWindow.title}`
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
        logger.debug('無其他視窗');
        return null;
      }

      if (this.debugMode) {
        logger.debug(`[候選視窗] 共 ${allWindows.length} 個:`);
        allWindows.forEach((win, idx) => {
          logger.debug(
            `  ${idx + 1}. ${win.title} Z:${win.zIndex} (${win.bounds.x},${win.bounds.y}) ${win.bounds.width}×${win.bounds.height}`
          );
        });
      }

      if (this.debugMode) {
        logger.debug(`[可見性分析]`);
      }

      // 過濾出實際有露出的視窗（可見面積 > 0）
      // 注意：計算可見度時需要包含當前視窗，因為當前視窗可能遮擋其他視窗
      const allWindowsIncludingCurrent = [currentWindow, ...allWindows];

      const visibleWindows = allWindows.filter((win) => {
        const visibleRatio = this.calculateActualVisibleArea(
          win,
          allWindowsIncludingCurrent
        );
        const isVisible = visibleRatio > 0;

        if (this.debugMode) {
          logger.debug(
            `  ${win.title}: ${(visibleRatio * 100).toFixed(1)}% ${isVisible ? '✓' : '✗完全被遮擋'}`
          );
        }

        return isVisible;
      });

      if (visibleWindows.length === 0) {
        logger.debug('無可見視窗');
        return null;
      }

      if (this.debugMode) {
        logger.debug(`[可見視窗] 共 ${visibleWindows.length} 個`);
      }

      let targetWindow: WindowInfo | null = null;

      switch (direction) {
        case 'up':
          targetWindow = this.findWindowAbove(currentWindow, visibleWindows);
          break;
        case 'down':
          targetWindow = this.findWindowBelow(currentWindow, visibleWindows);
          break;
        case 'left':
          targetWindow = this.findWindowToLeft(currentWindow, visibleWindows);
          break;
        case 'right':
          targetWindow = this.findWindowToRight(currentWindow, visibleWindows);
          break;
      }

      if (targetWindow) {
        const elapsed = Date.now() - startTime;
        logger.info(
          `找到 ${direction} 方向的視窗: ${targetWindow.title} (耗時: ${elapsed}ms)`
        );
      } else {
        logger.debug(`${direction} 方向沒有可切換的視窗`);
      }

      return targetWindow;
    } catch (error) {
      logger.error(`尋找 ${direction} 方向視窗時發生錯誤`, error);
      return null;
    } finally {
      const elapsed = Date.now() - startTime;
      if (elapsed > 100) {
        logger.warn(`視窗查詢耗時過長: ${elapsed}ms`);
      }
    }
  }

  private findWindowAbove(
    current: WindowInfo,
    windows: WindowInfo[]
  ): WindowInfo | null {
    const currentCenter = this.getCenterPoint(current.bounds);
    const currentTop = current.bounds.y;

    if (this.debugMode) {
      logger.debug(`\n=== 尋找上方視窗 ===`);
      logger.debug(`當前視窗: ${current.title}`);
      logger.debug(
        `  位置: (${current.bounds.x}, ${current.bounds.y}) 大小: ${current.bounds.width}x${current.bounds.height}`
      );
      logger.debug(`  頂部 Y = ${currentTop}`);
      logger.debug(
        `  X 範圍: ${current.bounds.x} ~ ${current.bounds.x + current.bounds.width}`
      );
    }

    const candidates = windows
      .filter((win) => {
        return (
          win.bounds.y < currentTop &&
          this.hasHorizontalOverlap(current.bounds, win.bounds)
        );
      })
      .map((win) => {
        const winBottom = win.bounds.y + win.bounds.height;
        // 修正距離計算：有重疊時距離為0，優先比較可見面積
        const verticalDistance = Math.max(0, currentTop - winBottom);

        // Z-order 懲罰：數字越大（越下層）懲罰越多
        const zOrderPenalty = (win.zIndex ?? 0) * 50;

        // 可見面積比例：計算視窗在上方的可見面積比例
        const visibleRatio = this.calculateVisibleAreaRatio(
          current.bounds,
          win.bounds,
          'up'
        );

        // 檢查是否與當前視窗有重疊（X和Y都有重疊）
        const hasCompleteOverlap = this.hasCompleteOverlap(
          current.bounds,
          win.bounds
        );

        // 檢查是否為全螢幕包含視窗
        const isFullscreen = this.isFullscreenContaining(
          current.bounds,
          win.bounds
        );

        // 加權分數：可見面積加成 - 距離懲罰 - Z-order懲罰（分數越高越優先）
        const score = visibleRatio * 500 - verticalDistance - zOrderPenalty;

        return {
          window: win,
          score,
          verticalDistance,
          zOrderPenalty,
          visibleRatio,
          hasCompleteOverlap,
          isFullscreen,
        };
      });

    // 分成三組：有重疊的 > 沒重疊的 > 全螢幕包含的
    const overlappingNormalCandidates = candidates.filter(
      (c) => c.hasCompleteOverlap && !c.isFullscreen
    );
    const nonOverlappingNormalCandidates = candidates.filter(
      (c) => !c.hasCompleteOverlap && !c.isFullscreen
    );
    const fullscreenCandidates = candidates.filter((c) => c.isFullscreen);

    logger.debug(
      `\n符合條件的候選視窗: ${candidates.length} 個 (重疊:${overlappingNormalCandidates.length}, 不重疊:${nonOverlappingNormalCandidates.length}, 全螢幕:${fullscreenCandidates.length})`
    );

    // 優先處理有重疊的 > 無重疊的 > 全螢幕的（分數由高到低排序）
    let finalCandidates: typeof candidates = [];
    let groupType = '';

    if (overlappingNormalCandidates.length > 0) {
      finalCandidates = overlappingNormalCandidates.sort(
        (a, b) => b.score - a.score
      );
      groupType = '【重疊組】';
    } else if (nonOverlappingNormalCandidates.length > 0) {
      finalCandidates = nonOverlappingNormalCandidates.sort(
        (a, b) => b.score - a.score
      );
      groupType = '【不重疊組】';
    } else if (fullscreenCandidates.length > 0) {
      finalCandidates = fullscreenCandidates.sort((a, b) => b.score - a.score);
      groupType = '【全螢幕組】';
    }

    if (finalCandidates.length > 0) {
      logger.debug(`${groupType} 排序後的候選清單 (前3名):`);
      finalCandidates.slice(0, 3).forEach((c, idx) => {
        const statusLabel = c.isFullscreen
          ? ' [全螢幕]'
          : c.hasCompleteOverlap
            ? ' [重疊✓]'
            : '';
        logger.debug(
          `  ${idx + 1}. ${c.window.title} [Z:${c.window.zIndex}]${statusLabel}` +
            `\n     加權分數:${c.score.toFixed(0)} = 可見×500(${(c.visibleRatio * 500).toFixed(0)}) - 垂直距離(${c.verticalDistance.toFixed(0)}) - Z懲罰(${c.zOrderPenalty})` +
            `\n     可見面積比例: ${(c.visibleRatio * 100).toFixed(1)}%`
        );
      });
      logger.debug(
        `\n→ 最終選擇: ${finalCandidates[0].window.title} [Z:${finalCandidates[0].window.zIndex}]`
      );
      return finalCandidates[0].window;
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
    logger.debug(
      `  位置: (${current.bounds.x}, ${current.bounds.y}) 大小: ${current.bounds.width}x${current.bounds.height}`
    );
    logger.debug(`  底部 Y = ${currentBottom}`);
    logger.debug(
      `  X 範圍: ${current.bounds.x} ~ ${current.bounds.x + current.bounds.width}`
    );

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
        return (
          winBottom > currentBottom &&
          this.hasHorizontalOverlap(current.bounds, win.bounds)
        );
      })
      .map((win) => {
        // 修正距離計算：有重疊時距離為0，優先比較可見面積
        const verticalDistance = Math.max(0, win.bounds.y - currentBottom);

        // Z-order 懲罰：數字越大（越下層）懲罰越多
        const zOrderPenalty = (win.zIndex ?? 0) * 50;

        // 可見面積比例：計算視窗在下方的可見面積比例
        const visibleRatio = this.calculateVisibleAreaRatio(
          current.bounds,
          win.bounds,
          'down'
        );

        // 檢查是否與當前視窗有重疊（X和Y都有重疊）
        const hasCompleteOverlap = this.hasCompleteOverlap(
          current.bounds,
          win.bounds
        );

        // 檢查是否為全螢幕包含視窗
        const isFullscreen = this.isFullscreenContaining(
          current.bounds,
          win.bounds
        );

        // 加權分數：可見面積加成 - 距離懲罰 - Z-order懲罰（分數越高越優先）
        const score = visibleRatio * 500 - verticalDistance - zOrderPenalty;

        return {
          window: win,
          score,
          verticalDistance,
          zOrderPenalty,
          visibleRatio,
          hasCompleteOverlap,
          isFullscreen,
        };
      });

    // 分成三組：有重疊的 > 沒重疊的 > 全螢幕包含的
    const overlappingNormalCandidates = candidates.filter(
      (c) => c.hasCompleteOverlap && !c.isFullscreen
    );
    const nonOverlappingNormalCandidates = candidates.filter(
      (c) => !c.hasCompleteOverlap && !c.isFullscreen
    );
    const fullscreenCandidates = candidates.filter((c) => c.isFullscreen);

    logger.debug(
      `\n符合條件的候選視窗: ${candidates.length} 個 (重疊:${overlappingNormalCandidates.length}, 不重疊:${nonOverlappingNormalCandidates.length}, 全螢幕:${fullscreenCandidates.length})`
    );

    // 優先處理有重疊的 > 無重疊的 > 全螢幕的（分數由高到低排序）
    let finalCandidates: typeof candidates = [];
    let groupType = '';

    if (overlappingNormalCandidates.length > 0) {
      finalCandidates = overlappingNormalCandidates.sort(
        (a, b) => b.score - a.score
      );
      groupType = '【重疊組】';
    } else if (nonOverlappingNormalCandidates.length > 0) {
      finalCandidates = nonOverlappingNormalCandidates.sort(
        (a, b) => b.score - a.score
      );
      groupType = '【不重疊組】';
    } else if (fullscreenCandidates.length > 0) {
      finalCandidates = fullscreenCandidates.sort((a, b) => b.score - a.score);
      groupType = '【全螢幕組】';
    }

    if (finalCandidates.length > 0) {
      logger.debug(`${groupType} 排序後的候選清單 (前3名):`);
      finalCandidates.slice(0, 3).forEach((c, idx) => {
        const statusLabel = c.isFullscreen
          ? ' [全螢幕]'
          : c.hasCompleteOverlap
            ? ' [重疊✓]'
            : '';
        logger.debug(
          `  ${idx + 1}. ${c.window.title} [Z:${c.window.zIndex}]${statusLabel}` +
            `\n     加權分數:${c.score.toFixed(0)} = 可見×500(${(c.visibleRatio * 500).toFixed(0)}) - 垂直距離(${c.verticalDistance.toFixed(0)}) - Z懲罰(${c.zOrderPenalty})` +
            `\n     可見面積比例: ${(c.visibleRatio * 100).toFixed(1)}%`
        );
      });
      logger.debug(`\n→ 最終選擇: ${finalCandidates[0].window.title}`);
      return finalCandidates[0].window;
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
    logger.debug(
      `  位置: (${current.bounds.x}, ${current.bounds.y}) 大小: ${current.bounds.width}x${current.bounds.height}`
    );
    logger.debug(`  左邊 X = ${currentLeft}`);
    logger.debug(
      `  Y 範圍: ${current.bounds.y} ~ ${current.bounds.y + current.bounds.height}`
    );

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
        return (
          win.bounds.x < currentLeft &&
          this.hasVerticalOverlap(current.bounds, win.bounds)
        );
      })
      .map((win) => {
        const winRight = win.bounds.x + win.bounds.width;
        // 修正距離計算：有重疊時距離為0，優先比較可見面積
        const horizontalDistance = Math.max(0, currentLeft - winRight);

        // Z-order 懲罰：數字越大（越下層）懲罰越多
        const zOrderPenalty = (win.zIndex ?? 0) * 50;

        // 可見面積比例：計算視窗在左方的可見面積比例
        const visibleRatio = this.calculateVisibleAreaRatio(
          current.bounds,
          win.bounds,
          'left'
        );

        // 檢查是否與當前視窗有重疊（X和Y都有重疊）
        const hasCompleteOverlap = this.hasCompleteOverlap(
          current.bounds,
          win.bounds
        );

        // 檢查是否為全螢幕包含視窗
        const isFullscreen = this.isFullscreenContaining(
          current.bounds,
          win.bounds
        );

        // 加權分數：可見面積加成 - 距離懲罰 - Z-order懲罰（分數越高越優先）
        const score = visibleRatio * 500 - horizontalDistance - zOrderPenalty;

        return {
          window: win,
          score,
          horizontalDistance,
          zOrderPenalty,
          visibleRatio,
          hasCompleteOverlap,
          isFullscreen,
        };
      });

    // 分成三組：有重疊的 > 沒重疊的 > 全螢幕包含的
    const overlappingNormalCandidates = candidates.filter(
      (c) => c.hasCompleteOverlap && !c.isFullscreen
    );
    const nonOverlappingNormalCandidates = candidates.filter(
      (c) => !c.hasCompleteOverlap && !c.isFullscreen
    );
    const fullscreenCandidates = candidates.filter((c) => c.isFullscreen);

    logger.debug(
      `\n符合條件的候選視窗: ${candidates.length} 個 (重疊:${overlappingNormalCandidates.length}, 不重疊:${nonOverlappingNormalCandidates.length}, 全螢幕:${fullscreenCandidates.length})`
    );

    // 優先處理有重疊的 > 無重疊的 > 全螢幕的（分數由高到低排序）
    let finalCandidates: typeof candidates = [];
    let groupType = '';

    if (overlappingNormalCandidates.length > 0) {
      finalCandidates = overlappingNormalCandidates.sort(
        (a, b) => b.score - a.score
      );
      groupType = '【重疊組】';
    } else if (nonOverlappingNormalCandidates.length > 0) {
      finalCandidates = nonOverlappingNormalCandidates.sort(
        (a, b) => b.score - a.score
      );
      groupType = '【不重疊組】';
    } else if (fullscreenCandidates.length > 0) {
      finalCandidates = fullscreenCandidates.sort((a, b) => b.score - a.score);
      groupType = '【全螢幕組】';
    }

    if (finalCandidates.length > 0) {
      logger.debug(`${groupType} 排序後的候選清單 (前3名):`);
      finalCandidates.slice(0, 3).forEach((c, idx) => {
        const statusLabel = c.isFullscreen
          ? ' [全螢幕]'
          : c.hasCompleteOverlap
            ? ' [重疊✓]'
            : '';
        logger.debug(
          `  ${idx + 1}. ${c.window.title} [Z:${c.window.zIndex}]${statusLabel}` +
            `\n     加權分數:${c.score.toFixed(0)} = 可見×500(${(c.visibleRatio * 500).toFixed(0)}) - 水平距離(${c.horizontalDistance.toFixed(0)}) - Z懲罰(${c.zOrderPenalty})` +
            `\n     可見面積比例: ${(c.visibleRatio * 100).toFixed(1)}%`
        );
      });
      logger.debug(`\n→ 最終選擇: ${finalCandidates[0].window.title}`);
      return finalCandidates[0].window;
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
    logger.debug(
      `  位置: (${current.bounds.x}, ${current.bounds.y}) 大小: ${current.bounds.width}x${current.bounds.height}`
    );
    logger.debug(`  右邊 X = ${currentRight}`);
    logger.debug(
      `  Y 範圍: ${current.bounds.y} ~ ${current.bounds.y + current.bounds.height}`
    );

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
        return (
          winRight > currentRight &&
          this.hasVerticalOverlap(current.bounds, win.bounds)
        );
      })
      .map((win) => {
        // 修正距離計算：有重疊時距離為0，優先比較可見面積
        const horizontalDistance = Math.max(0, win.bounds.x - currentRight);

        // Z-order 懲罰：數字越大（越下層）懲罰越多
        const zOrderPenalty = (win.zIndex ?? 0) * 50;

        // 可見面積比例：計算視窗在右方的可見面積比例
        const visibleRatio = this.calculateVisibleAreaRatio(
          current.bounds,
          win.bounds,
          'right'
        );

        // 檢查是否與當前視窗有重疊（X和Y都有重疊）
        const hasCompleteOverlap = this.hasCompleteOverlap(
          current.bounds,
          win.bounds
        );

        // 檢查是否為全螢幕包含視窗
        const isFullscreen = this.isFullscreenContaining(
          current.bounds,
          win.bounds
        );

        // 加權分數：可見面積加成 - 距離懲罰 - Z-order懲罰（分數越高越優先）
        const score = visibleRatio * 500 - horizontalDistance - zOrderPenalty;

        return {
          window: win,
          score,
          horizontalDistance,
          zOrderPenalty,
          visibleRatio,
          hasCompleteOverlap,
          isFullscreen,
        };
      });

    // 分成三組：有重疊的 > 沒重疊的 > 全螢幕包含的
    const overlappingNormalCandidates = candidates.filter(
      (c) => c.hasCompleteOverlap && !c.isFullscreen
    );
    const nonOverlappingNormalCandidates = candidates.filter(
      (c) => !c.hasCompleteOverlap && !c.isFullscreen
    );
    const fullscreenCandidates = candidates.filter((c) => c.isFullscreen);

    logger.debug(
      `\n符合條件的候選視窗: ${candidates.length} 個 (重疊:${overlappingNormalCandidates.length}, 不重疊:${nonOverlappingNormalCandidates.length}, 全螢幕:${fullscreenCandidates.length})`
    );

    // 優先處理有重疊的 > 無重疊的 > 全螢幕的（分數由高到低排序）
    let finalCandidates: typeof candidates = [];
    let groupType = '';

    if (overlappingNormalCandidates.length > 0) {
      finalCandidates = overlappingNormalCandidates.sort(
        (a, b) => b.score - a.score
      );
      groupType = '【重疊組】';
    } else if (nonOverlappingNormalCandidates.length > 0) {
      finalCandidates = nonOverlappingNormalCandidates.sort(
        (a, b) => b.score - a.score
      );
      groupType = '【不重疊組】';
    } else if (fullscreenCandidates.length > 0) {
      finalCandidates = fullscreenCandidates.sort((a, b) => b.score - a.score);
      groupType = '【全螢幕組】';
    }

    if (finalCandidates.length > 0) {
      logger.debug(`${groupType} 排序後的候選清單 (前3名):`);
      finalCandidates.slice(0, 3).forEach((c, idx) => {
        const statusLabel = c.isFullscreen
          ? ' [全螢幕]'
          : c.hasCompleteOverlap
            ? ' [重疊✓]'
            : '';
        logger.debug(
          `  ${idx + 1}. ${c.window.title} [Z:${c.window.zIndex}]${statusLabel}` +
            `\n     加權分數:${c.score.toFixed(0)} = 可見×500(${(c.visibleRatio * 500).toFixed(0)}) - 水平距離(${c.horizontalDistance.toFixed(0)}) - Z懲罰(${c.zOrderPenalty})` +
            `\n     可見面積比例: ${(c.visibleRatio * 100).toFixed(1)}%`
        );
      });
      logger.debug(`\n→ 最終選擇: ${finalCandidates[0].window.title}`);
      return finalCandidates[0].window;
    }

    // 後備搜尋：找上下方向的視窗
    logger.debug(`\n右方沒有找到視窗，啟動後備搜尋...`);
    return this.findFallbackForRight(current, windows);
  }

  /**
   * 檢查兩個視窗是否完全重疊（X軸和Y軸都有重疊）
   */
  private hasCompleteOverlap(win1: WindowBounds, win2: WindowBounds): boolean {
    return (
      this.hasHorizontalOverlap(win1, win2) &&
      this.hasVerticalOverlap(win1, win2)
    );
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
    logger.debug(
      `  搜尋條件: 與當前視窗完全重疊 且 Y > ${current.bounds.y}（在下方）`
    );

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

    // 先找一般視窗，再找全螢幕視窗
    const normalCandidates = windows
      .filter((win) => {
        return (
          this.hasCompleteOverlap(current.bounds, win.bounds) &&
          !this.isFullscreenContaining(current.bounds, win.bounds)
        );
      })
      .filter((win) => win.bounds.y > current.bounds.y)
      .sort((a, b) => a.bounds.y - b.bounds.y); // 升序，選最小的Y（最接近上緣）

    if (normalCandidates.length > 0) {
      logger.debug(`\n找到 ${normalCandidates.length} 個一般視窗候選`);
      logger.debug(
        `選擇最接近的: ${normalCandidates[0].title} (Y: ${normalCandidates[0].bounds.y})`
      );
      return normalCandidates[0];
    }

    // 如果沒有一般視窗，才考慮全螢幕視窗
    const fullscreenCandidates = windows
      .filter((win) => {
        return (
          this.hasCompleteOverlap(current.bounds, win.bounds) &&
          this.isFullscreenContaining(current.bounds, win.bounds)
        );
      })
      .filter((win) => win.bounds.y > current.bounds.y)
      .sort((a, b) => a.bounds.y - b.bounds.y);

    if (fullscreenCandidates.length > 0) {
      logger.debug(`\n找到 ${fullscreenCandidates.length} 個全螢幕視窗候選`);
      logger.debug(
        `選擇最接近的: ${fullscreenCandidates[0].title} (Y: ${fullscreenCandidates[0].bounds.y}) [全螢幕]`
      );
      return fullscreenCandidates[0];
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
    logger.debug(
      `  搜尋條件: 與當前視窗完全重疊 且 Y < ${currentBottom}（在上方）`
    );

    // 先找一般視窗，再找全螢幕視窗
    const normalCandidates = windows
      .filter((win) => {
        return (
          this.hasCompleteOverlap(current.bounds, win.bounds) &&
          !this.isFullscreenContaining(current.bounds, win.bounds)
        );
      })
      .filter((win) => win.bounds.y < currentBottom)
      .sort((a, b) => b.bounds.y - a.bounds.y); // 降序，選最大的Y（最接近下緣）

    if (normalCandidates.length > 0) {
      logger.debug(`找到 ${normalCandidates.length} 個一般視窗候選`);
      logger.debug(
        `選擇最接近的: ${normalCandidates[0].title} (Y: ${normalCandidates[0].bounds.y})`
      );
      return normalCandidates[0];
    }

    // 如果沒有一般視窗，才考慮全螢幕視窗
    const fullscreenCandidates = windows
      .filter((win) => {
        return (
          this.hasCompleteOverlap(current.bounds, win.bounds) &&
          this.isFullscreenContaining(current.bounds, win.bounds)
        );
      })
      .filter((win) => win.bounds.y < currentBottom)
      .sort((a, b) => b.bounds.y - a.bounds.y);

    if (fullscreenCandidates.length > 0) {
      logger.debug(`找到 ${fullscreenCandidates.length} 個全螢幕視窗候選`);
      logger.debug(
        `選擇最接近的: ${fullscreenCandidates[0].title} (Y: ${fullscreenCandidates[0].bounds.y}) [全螢幕]`
      );
      return fullscreenCandidates[0];
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
    logger.debug(
      `  搜尋條件: 與當前視窗完全重疊 且 X > ${current.bounds.x}（在右方）`
    );

    // 先找一般視窗，再找全螢幕視窗
    const normalCandidates = windows
      .filter((win) => {
        return (
          this.hasCompleteOverlap(current.bounds, win.bounds) &&
          !this.isFullscreenContaining(current.bounds, win.bounds)
        );
      })
      .filter((win) => win.bounds.x > current.bounds.x)
      .sort((a, b) => a.bounds.x - b.bounds.x); // 升序，選最小的X（最接近左緣）

    if (normalCandidates.length > 0) {
      logger.debug(`找到 ${normalCandidates.length} 個一般視窗候選`);
      logger.debug(
        `選擇最接近的: ${normalCandidates[0].title} (X: ${normalCandidates[0].bounds.x})`
      );
      return normalCandidates[0];
    }

    // 如果沒有一般視窗，才考慮全螢幕視窗
    const fullscreenCandidates = windows
      .filter((win) => {
        return (
          this.hasCompleteOverlap(current.bounds, win.bounds) &&
          this.isFullscreenContaining(current.bounds, win.bounds)
        );
      })
      .filter((win) => win.bounds.x > current.bounds.x)
      .sort((a, b) => a.bounds.x - b.bounds.x);

    if (fullscreenCandidates.length > 0) {
      logger.debug(`找到 ${fullscreenCandidates.length} 個全螢幕視窗候選`);
      logger.debug(
        `選擇最接近的: ${fullscreenCandidates[0].title} (X: ${fullscreenCandidates[0].bounds.x}) [全螢幕]`
      );
      return fullscreenCandidates[0];
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
    logger.debug(
      `  搜尋條件: 與當前視窗完全重疊 且 X < ${currentRight}（在左方）`
    );

    // 先找一般視窗，再找全螢幕視窗
    const normalCandidates = windows
      .filter((win) => {
        return (
          this.hasCompleteOverlap(current.bounds, win.bounds) &&
          !this.isFullscreenContaining(current.bounds, win.bounds)
        );
      })
      .filter((win) => win.bounds.x < currentRight)
      .sort((a, b) => b.bounds.x - a.bounds.x); // 降序，選最大的X（最接近右緣）

    if (normalCandidates.length > 0) {
      logger.debug(`找到 ${normalCandidates.length} 個一般視窗候選`);
      logger.debug(
        `選擇最接近的: ${normalCandidates[0].title} (X: ${normalCandidates[0].bounds.x})`
      );
      return normalCandidates[0];
    }

    // 如果沒有一般視窗，才考慮全螢幕視窗
    const fullscreenCandidates = windows
      .filter((win) => {
        return (
          this.hasCompleteOverlap(current.bounds, win.bounds) &&
          this.isFullscreenContaining(current.bounds, win.bounds)
        );
      })
      .filter((win) => win.bounds.x < currentRight)
      .sort((a, b) => b.bounds.x - a.bounds.x);

    if (fullscreenCandidates.length > 0) {
      logger.debug(`找到 ${fullscreenCandidates.length} 個全螢幕視窗候選`);
      logger.debug(
        `選擇最接近的: ${fullscreenCandidates[0].title} (X: ${fullscreenCandidates[0].bounds.x}) [全螢幕]`
      );
      return fullscreenCandidates[0];
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
  private hasHorizontalOverlap(
    win1: WindowBounds,
    win2: WindowBounds
  ): boolean {
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
   * 檢查目標視窗是否包含當前視窗且佔螢幕90%以上
   * 用於降低全螢幕或接近全螢幕的視窗優先度
   */
  private isFullscreenContaining(
    current: WindowBounds,
    target: WindowBounds
  ): boolean {
    // 檢查目標視窗是否完全包含當前視窗
    const contains =
      target.x <= current.x &&
      target.y <= current.y &&
      target.x + target.width >= current.x + current.width &&
      target.y + target.height >= current.y + current.height;

    if (!contains) {
      return false;
    }

    // 取得螢幕大小（使用 node-window-manager）
    try {
      const monitor = wm.getPrimaryMonitor();
      if (!monitor) {
        return false;
      }

      const screenBounds = monitor.getBounds();
      const screenArea = (screenBounds.width ?? 0) * (screenBounds.height ?? 0);
      const targetArea = target.width * target.height;
      const ratio = screenArea > 0 ? targetArea / screenArea : 0;

      // 如果目標視窗佔螢幕90%以上，視為全螢幕
      return ratio >= 0.9;
    } catch (error) {
      logger.debug('無法取得螢幕大小，跳過全螢幕檢查');
      return false;
    }
  }

  /**
   * 計算視窗的實際可見面積（考慮被其他視窗遮擋的情況）
   * @param target 目標視窗
   * @param allWindows 所有視窗列表（已按 z-index 排序，0 是最上層）
   * @returns 可見面積比例 (0-1)
   */
  /**
   * 計算視窗的實際可見面積（考慮被其他視窗遮擋的情況）
   * 使用快速算法：檢查是否完全被遮擋 + 最大重疊估算
   * @param target 目標視窗
   * @param allWindows 所有視窗列表（已按 z-index 排序，0 是最上層）
   * @returns 可見面積比例 (0-1)
   */
  private calculateActualVisibleArea(
    target: WindowInfo,
    allWindows: WindowInfo[]
  ): number {
    const targetArea = target.bounds.width * target.bounds.height;
    if (targetArea === 0) return 0;

    // 預先計算目標視窗的邊界（避免重複計算）
    const targetRight = target.bounds.x + target.bounds.width;
    const targetBottom = target.bounds.y + target.bounds.height;

    // 找出所有在目標視窗上方的視窗（z-index 更小）
    const windowsAbove = allWindows.filter(
      (win) =>
        win.zIndex !== undefined &&
        target.zIndex !== undefined &&
        win.zIndex < target.zIndex
    );

    // 如果沒有上層視窗，完全可見
    if (windowsAbove.length === 0) {
      return 1.0;
    }

    // 快速檢查：是否被任何單一上層視窗完全遮擋
    for (const upperWin of windowsAbove) {
      const upperRight = upperWin.bounds.x + upperWin.bounds.width;
      const upperBottom = upperWin.bounds.y + upperWin.bounds.height;

      const isTotallyOccluded =
        upperWin.bounds.x <= target.bounds.x &&
        upperWin.bounds.y <= target.bounds.y &&
        upperRight >= targetRight &&
        upperBottom >= targetBottom;

      if (isTotallyOccluded) {
        return 0; // 完全被遮擋
      }
    }

    // 簡化計算：有任何上層視窗但未完全遮擋，使用最大重疊估算
    let maxOverlapRatio = 0;

    for (const upperWin of windowsAbove) {
      const upperRight = upperWin.bounds.x + upperWin.bounds.width;
      const upperBottom = upperWin.bounds.y + upperWin.bounds.height;

      // 計算重疊區域
      const overlapX1 = Math.max(target.bounds.x, upperWin.bounds.x);
      const overlapY1 = Math.max(target.bounds.y, upperWin.bounds.y);
      const overlapX2 = Math.min(targetRight, upperRight);
      const overlapY2 = Math.min(targetBottom, upperBottom);

      if (overlapX1 < overlapX2 && overlapY1 < overlapY2) {
        const overlapArea = (overlapX2 - overlapX1) * (overlapY2 - overlapY1);
        const overlapRatio = overlapArea / targetArea;
        maxOverlapRatio = Math.max(maxOverlapRatio, overlapRatio);
      }
    }

    // 返回估算的可見比例（1 - 最大重疊比例）
    return Math.max(0, 1 - maxOverlapRatio);
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
