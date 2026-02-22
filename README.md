# Visual Focusing - 使用說明

## 功能介紹

Visual Focusing 是一個 macOS 應用程式，讓你可以使用快速鍵在視窗間快速切換。它會根據目前聚焦視窗的位置，自動偵測上下左右四個方向最近的視窗。

## 安裝

### 系統需求

- macOS 10.13 或更新版本
- Node.js 20.14+ (開發環境)

### 從原始碼安裝

```bash
# 安裝依賴
npm install

# 啟動開發環境
npm run dev

# 建置應用程式
npm run build:all
```

輸出會在 release/ 資料夾，包含：

- Visual Focusing-1.0.0-arm64.dmg（Apple Silicon）
- Visual Focusing-1.0.0.dmg（Intel）

給對方的安裝說明： 下載 DMG → 拖曳到 Applications → 若 macOS 封鎖，在 Terminal 執行：

```bash
xattr -cr "/Applications/Visual Focusing.app"
```

## 初次使用

### 1. 授予權限

應用程式需要「輔助使用」(Accessibility) 權限才能控制其他視窗。

1. 開啟應用程式
2. 點擊「開啟系統設定」按鈕
3. 在系統設定中啟用 Visual Focusing 的權限
4. 重新啟動應用程式

### 2. 設定快速鍵

預設快速鍵為：

- **向上切換**: `Command + Option + ↑`
- **向下切換**: `Command + Option + ↓`
- **向左切換**: `Command + Option + ←`
- **向右切換**: `Command + Option + →`

你可以在設定界面中自訂這些快速鍵。

### 3. 啟用功能

在設定界面中勾選「啟用快速鍵」即可開始使用。

## 使用方式

1. **正常使用視窗**：在任何應用程式中工作
2. **按下快速鍵**：例如按 `Command + Option + →`
3. **自動切換**：應用程式會自動切換到右側最近的視窗

### 運作原理

- 以**目前視窗的中心點**為基準
- 計算指定方向上**所有視窗的距離**
- 切換到**距離最近的視窗**

### 範例場景

#### 雙螢幕工作流程

```
螢幕 1                    螢幕 2
┌─────────┐              ┌─────────┐
│ VS Code │  →快速鍵→    │ Browser │
└─────────┘              └─────────┘
```

在 VS Code 中按 `Command + Option + →` 就能切換到右側的瀏覽器。

#### 平鋪視窗佈局

```
┌─────────┬─────────┐
│  上視窗  │         │
├─────────┤  右視窗  │
│ 當前視窗 │         │
└─────────┴─────────┘
```

- 按 `Command + Option + ↑` 切換到上方視窗
- 按 `Command + Option + →` 切換到右側視窗

## 設定快速鍵

### 修改快速鍵

1. 點擊快速鍵輸入框
2. 直接按下想要的組合鍵
3. 點擊「儲存設定」

### 可用的修飾鍵

- **Command (⌘)**: 建議使用，避免與應用程式快速鍵衝突
- **Control (⌃)**: 可使用
- **Option (⌥)**: 可使用
- **Shift (⇧)**: 可使用

### 快速鍵建議

- 使用 2-3 個修飾鍵避免衝突
- 搭配方向鍵使用最直覺
- 避免使用系統保留的組合鍵

## 疑難排解

### 快速鍵沒有反應

1. **檢查權限**：確認已授予輔助使用權限
2. **檢查啟用狀態**：確認已勾選「啟用快速鍵」
3. **檢查衝突**：嘗試更換快速鍵組合
4. **重新啟動**：關閉並重新開啟應用程式

### 切換到錯誤的視窗

- 這可能是因為視窗排列較為複雜
- 演算法會選擇距離最近的視窗
- 可以嘗試調整視窗位置

### 某些視窗無法切換

- 部分系統視窗可能無法被偵測或控制
- 這是 macOS 的安全限制

### 應用程式無法啟動

1. 檢查 Node.js 版本：`node --version`
2. 重新安裝依賴：`npm install`
3. 清除快取：`rm -rf node_modules dist && npm install`

## 技術細節

### 視窗偵測演算法

使用歐幾里得距離計算：

```
distance = √[(x₂-x₁)² + (y₂-y₁)²]
```

### 快速鍵格式

快速鍵字串格式：`Modifier1+Modifier2+Key`
例如：`CommandOrControl+Alt+Up`

### 設定儲存

設定儲存在：

```
~/Library/Application Support/visual-focusing/config.json
```

## 開發資訊

### 技術棧

- **Electron**: 跨平台桌面應用框架
- **React**: UI 框架
- **TypeScript**: 型別安全
- **node-window-manager**: 視窗管理
- **electron-store**: 設定持久化

### 專案結構

```
src/
├── main/              # Electron 主程序
│   ├── index.ts       # 入口
│   ├── windowManager.ts
│   ├── shortcutManager.ts
│   └── permissions.ts
├── renderer/          # React UI
│   ├── App.tsx
│   └── components/
└── shared/            # 共用型別
    └── types.ts
```

## 授權

MIT License

## 問題回報

如有任何問題或建議，請透過 GitHub Issues 回報。
