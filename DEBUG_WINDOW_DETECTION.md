# 視窗偵測問題修正

## 問題描述

### 1. 自己找到自己
**現象**: 當前視窗是 LINE，切換後還是 LINE
```
[DEBUG] 當前視窗: LINE
[INFO] 找到 down 方向的視窗: LINE
[INFO] 成功切換至視窗: LINE
```

**原因分析**:
- 可能 LINE 有多個視窗（主視窗、聊天視窗等）
- 只用 ID 過濾不夠，需要同時檢查位置

**解決方案**:
```typescript
// 雙重檢查：ID + 位置
const isSameId = win.id === currentWindow.id;
const isSamePosition = 
  win.bounds.x === currentWindow.bounds.x &&
  win.bounds.y === currentWindow.bounds.y &&
  win.bounds.width === currentWindow.bounds.width &&
  win.bounds.height === currentWindow.bounds.height;

return !isSameId && !isSamePosition;
```

### 2. 偵測到 Dock
**原因**: 沒有特別過濾 Dock

**解決方案**:
```typescript
const isDock = ownerName === 'Dock' || title === 'Dock';
const isSystemUI = title.includes('Item-0'); // 系統 UI 元素

return !isDock && !isSystemUI;
```

### 3. 除錯資訊不足
**改進**: 增加詳細的視窗列表日誌

**新輸出格式**:
```
[DEBUG] 獲取到 4 個有效視窗
[DEBUG]   [1] iTerm2 (Unknown) - 位置:(1787, 143) 大小:1249x798
[DEBUG]   [2] Chrome (Unknown) - 位置:(200, 100) 大小:1200x800
[DEBUG]   [3] VS Code (Unknown) - 位置:(50, 50) 大小:1400x900
[DEBUG]   [4] Finder (Unknown) - 位置:(500, 400) 大小:800x600
```

### 4. 視覺化標示
**新功能**: 使用系統通知標示目標視窗

**效果**:
- 切換成功: 顯示 "已切換至: [視窗名稱]"
- 沒有視窗: 顯示 "[方向]沒有可切換的視窗"
- 通知會在 1 秒後自動消失

## 測試方式

### 1. 啟動應用程式
```bash
npm run build:main
npm run dev
```

### 2. 查看詳細日誌
開啟終端機，查看以下資訊：
- 所有找到的視窗列表
- 當前視窗的 ID 和位置
- 目標視窗的 ID 和位置

### 3. 測試案例

#### 案例 A: LINE 多視窗
1. 開啟 LINE 主視窗
2. 開啟一個聊天視窗
3. 聚焦在主視窗
4. 按快速鍵切換
5. **預期**: 切換到聊天視窗，不是自己

#### 案例 B: 排除 Dock
1. 檢查日誌中的視窗列表
2. **預期**: 不應該出現 "Dock" 或 "Item-0"

#### 案例 C: 視覺化回饋
1. 按快速鍵切換視窗
2. **預期**: 看到通知顯示目標視窗名稱
3. 通知在 1 秒後自動消失

## 除錯技巧

### 查看完整視窗列表
每次觸發快速鍵時，日誌會顯示：
```
[DEBUG] 觸發快速鍵: down
[DEBUG] 當前視窗: LINE (ID:12345) 位置:(100, 200)
[DEBUG] 獲取到 4 個有效視窗
[DEBUG]   [1] Chrome (Unknown) - 位置:(300, 400) 大小:1200x800
[DEBUG]   [2] iTerm2 (Unknown) - 位置:(500, 600) 大小:1000x700
[DEBUG]   [3] VS Code (Unknown) - 位置:(700, 100) 大小:1400x900
[DEBUG]   [4] LINE (Unknown) - 位置:(100, 500) 大小:400x600
[DEBUG] 可切換的視窗數量: 3
[INFO] 找到 down 方向的視窗: LINE (ID:67890) 位置:(100, 500) 大小:400x600
```

### 確認不是同一個視窗
比較 ID 和位置：
- 當前視窗: ID:12345, 位置:(100, 200)
- 目標視窗: ID:67890, 位置:(100, 500)
- ✅ ID 不同，位置不同，確認是不同視窗

### 如果還是切換到自己
可能的原因：
1. **視窗完全重疊**: 檢查兩個視窗的位置和大小是否完全相同
2. **ID 重複**: 檢查系統是否錯誤分配相同 ID
3. **快取問題**: 清除快取 `windowManagerInstance.clearCache()`

## 已修正的問題

✅ 排除 Dock 和系統 UI 元素
✅ 雙重檢查避免選到自己（ID + 位置）
✅ 詳細的日誌輸出（包含 ID、位置、大小）
✅ 視覺化通知標示目標視窗
✅ 過濾條件更嚴格（標題、大小、最小化狀態）

## 如果仍有問題

請提供以下資訊：
1. 完整的日誌輸出
2. 當前視窗的名稱和應用程式
3. 預期切換到哪個視窗
4. 實際切換到哪個視窗
5. 螢幕配置（單螢幕/多螢幕）

## 進一步優化建議

### 1. 視窗去重
如果還是遇到相同視窗，可以考慮：
```typescript
// 使用視窗指紋去重
const fingerprint = `${win.title}-${win.owner}-${win.bounds.x}-${win.bounds.y}`;
```

### 2. 更智慧的過濾
```typescript
// 排除隱藏視窗、輔助視窗等
const isAuxiliary = title.startsWith('輔助') || title.startsWith('Helper');
```

### 3. 視覺化高亮
除了通知，還可以考慮：
- 視窗邊框高亮（需要額外權限）
- 螢幕上的箭頭指示
- 半透明遮罩

---

**更新時間**: 2026-02-15 20:23
**版本**: 1.0.1-bugfix
