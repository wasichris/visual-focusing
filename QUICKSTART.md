# Visual Focusing - 快速開始

## 🚀 立即開始

### 1. 安裝依賴
```bash
npm install
```

### 2. 開發模式
```bash
npm run dev
```
這會啟動：
- Vite 開發服務器（http://localhost:5173）
- Electron 應用程式視窗

### 3. 授予權限
第一次使用時：
1. 點擊「開啟系統設定」
2. 在「隱私權與安全性」→「輔助使用」中啟用 Visual Focusing
3. 重新啟動應用程式

### 4. 使用快速鍵
預設快速鍵：
- `⌘ + ⌥ + ↑` - 向上切換
- `⌘ + ⌥ + ↓` - 向下切換
- `⌘ + ⌥ + ←` - 向左切換
- `⌘ + ⌥ + →` - 向右切換

## 📦 建置發布版本

### 方式一：僅建置（不打包）
```bash
npm run build
```
產生 `dist/` 目錄

### 方式二：完整打包
```bash
npm run build:all
```
產生 `release/` 目錄，包含：
- `.dmg` 安裝檔
- `.zip` 壓縮檔

## 🔧 開發指令

```bash
# 啟動開發環境
npm run dev

# 僅建置 renderer (React)
npm run build:renderer

# 僅建置 main (Electron)
npm run build:main

# 完整建置
npm run build

# 建置 + 打包
npm run build:all

# 程式碼檢查
npm run lint

# 程式碼格式化
npm run format
```

## 📁 專案結構

```
visual-focusing/
├── src/
│   ├── main/                 # Electron 主程序
│   │   ├── index.ts          # 應用程式入口
│   │   ├── windowManager.ts  # 視窗管理邏輯
│   │   ├── shortcutManager.ts# 快速鍵管理
│   │   ├── permissions.ts    # 權限管理
│   │   ├── logger.ts         # 日誌系統
│   │   └── preload.ts        # Preload script
│   ├── renderer/             # React UI
│   │   ├── App.tsx           # 主應用
│   │   ├── main.tsx          # React 入口
│   │   ├── index.css         # 全域樣式
│   │   └── components/       # React 組件
│   │       ├── Settings.tsx
│   │       └── ShortcutInput.tsx
│   └── shared/               # 共用型別
│       └── types.ts
├── build/                    # 建置資源
│   ├── icon.svg              # 應用程式圖示
│   └── entitlements.mac.plist# macOS 權限
├── dist/                     # 建置輸出
├── release/                  # 打包輸出
├── index.html                # HTML 模板
├── package.json
├── tsconfig.json             # TypeScript 配置
├── tsconfig.main.json        # Main process 配置
├── vite.config.ts            # Vite 配置
└── electron-builder.json     # 打包配置
```

## 🐛 除錯

### 檢視主程序日誌
開發模式下，日誌會輸出到終端機：
```
[INFO] 2026-02-15T12:00:00.000Z - 正在初始化 Visual Focusing...
[DEBUG] 2026-02-15T12:00:00.100Z - 獲取到 33 個有效視窗
[INFO] 2026-02-15T12:00:00.200Z - 快速鍵已啟用並註冊
```

### 檢視 renderer 日誌
開啟 DevTools（開發模式自動開啟）查看瀏覽器 console

### 常見問題

**Q: 快速鍵沒反應？**
- 檢查是否已授予輔助使用權限
- 檢查快速鍵是否與其他應用衝突
- 查看終端機日誌確認是否有錯誤

**Q: 建置失敗？**
```bash
# 清除並重新安裝
rm -rf node_modules dist
npm install
npm run build
```

**Q: 找不到視窗？**
- 確認目標視窗不是最小化狀態
- 視窗大小需大於 50x50 像素
- 檢查視窗是否有標題

## 💡 開發提示

1. **熱重載**：修改 renderer 程式碼會自動重載，main 程式碼需要重啟
2. **型別檢查**：使用 TypeScript strict mode，確保型別安全
3. **日誌級別**：開發模式啟用 DEBUG，生產模式只有 INFO 以上
4. **測試**：在多個視窗開啟的環境下測試效果最佳

## 📝 修改與擴充

### 修改預設快速鍵
編輯 `src/main/shortcutManager.ts`：
```typescript
defaults: {
  shortcuts: {
    up: 'Control+Alt+Up',    // 你的快速鍵
    down: 'Control+Alt+Down',
    left: 'Control+Alt+Left',
    right: 'Control+Alt+Right',
  },
}
```

### 修改視窗過濾規則
編輯 `src/main/windowManager.ts`：
```typescript
private readonly MIN_WINDOW_SIZE = 50; // 調整最小視窗大小
```

### 修改快取時間
編輯 `src/main/windowManager.ts`：
```typescript
private readonly CACHE_DURATION = 500; // 毫秒
```

## 🎨 自訂圖示

替換 `build/icon.svg` 或建立 `build/icon.icns`（macOS 原生格式）：

```bash
# 從 PNG 產生 .icns（需要 iconutil）
mkdir icon.iconset
sips -z 16 16     icon.png --out icon.iconset/icon_16x16.png
sips -z 32 32     icon.png --out icon.iconset/icon_16x16@2x.png
# ... (其他尺寸)
iconutil -c icns icon.iconset
mv icon.icns build/
```

---

**準備好了嗎？開始使用 `npm run dev` 吧！** 🎯
