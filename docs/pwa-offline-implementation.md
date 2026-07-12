# PWA 離線使用修改說明

這份文件整理 Cozy Pocket 為了支援 **iOS / PWA 離線使用** 所需要修改的部分，包含 app shell、Service Worker、部署路徑、離線降級行為，以及 iOS 舊安裝的已知注意事項。

## 1. 目標

離線模式的目標不是讓所有功能都在無網路下完整可用，而是做到：

- App 加入 iOS 主畫面後，離線仍可冷啟動
- 本機資料（IndexedDB）可離線讀寫
- 新增、編輯、刪除、搜尋交易可離線使用
- AI 與雲同步在離線時明確降級，不阻塞主流程

## 2. 必須修改的部分

### 2.1 App Shell 要改成可被 precache

如果 `index.html`、主 JS、主 CSS、manifest、icons 沒有進入 Service Worker 的 precache，iOS 在離線冷啟動時就可能直接落回 Safari 的網路錯誤頁。

因此必須：

- 導入 `vite-plugin-pwa`
- 讓 production build 產生 `sw.js`
- precache：
  - `index.html`
  - build 後的 JS chunk
  - build 後的 CSS chunk
  - `manifest.json`
  - app icons

目前相關檔案：

- [vite.config.ts](../vite.config.ts)
- [index.tsx](../index.tsx)

### 2.2 不能依賴外部 CDN 才能顯示 UI

若首頁樣式仰賴外部 CDN script 或外部字型，離線啟動時即使 HTML 有快取，也可能出現：

- 樣式失效
- 首屏外部請求失敗
- iOS PWA 冷啟動不穩定

因此必須：

- 拿掉 `index.html` 中會影響首屏的外部依賴
- Tailwind 改成本地建置
- 全域樣式改由本地 CSS 檔打包

目前相關檔案：

- [index.html](../index.html)
- [styles.css](../styles.css)
- [package.json](../package.json)

### 2.3 Manifest、icons、base path 必須一致

這個專案部署在 GitHub Pages 子路徑：

```text
https://rexx.github.io/Cozy-Pocket/
```

如果 Vite `base`、manifest `start_url/scope`、icon 路徑彼此不一致，iOS 安裝後容易出現：

- icon 正常但 app 打不開
- 離線冷啟動命中錯誤 URL
- 啟動畫面與主畫面網址不一致

因此必須：

- `vite.config.ts` 的 `base` 對齊 `/Cozy-Pocket/`
- `manifest.json` 的 `start_url`、`scope` 對齊部署路徑
- icon 直接由 `public/` 提供，部署後對應到 `/Cozy-Pocket/<filename>`

目前相關檔案：

- [vite.config.ts](../vite.config.ts)
- [public/manifest.json](../public/manifest.json)
- [public/android-chrome-192x192.png](../public/android-chrome-192x192.png)

### 2.4 離線時要保留核心記帳流程，網路功能改降級

本機資料已經存在 IndexedDB，因此離線時不應阻止使用者記帳。

因此必須：

- 交易資料一律先寫入 Dexie / IndexedDB
- 離線時：
  - AI 解析不執行，顯示不可用提示
  - 雲同步不執行，保留 `pending`
  - App 啟動時不強制補送同步
- 恢復連線後，再由既有同步機制補送待同步資料

目前相關檔案：

- [services/networkService.ts](../services/networkService.ts)
- [services/cloudSyncService.ts](../services/cloudSyncService.ts)
- [services/geminiService.ts](../services/geminiService.ts)
- [App.tsx](../App.tsx)

### 2.5 離線狀態要有 UI 提示，但不能擋住主流程

離線提示需要存在，否則使用者不知道為什麼 AI / 同步沒反應；但提示也不能蓋住月曆或 modal 操作。

因此目前策略是：

- 主畫面進入離線時先顯示完整訊息
- 幾秒後縮成左上角小圖示
- 不顯示在新增頁、設定頁、同步頁等全畫面 overlay 上

目前相關檔案：

- [App.tsx](../App.tsx)
- [docs/pwa-layout-gotchas.md](pwa-layout-gotchas.md)

### 2.6 Google Analytics 不能回到 blocking script 寫法

如果把 gtag 直接放回 `index.html`，會重新引入外部啟動依賴。

因此目前採用：

- 只在 production 載入
- 只在 online 時載入
- 啟動後動態插入 `gtag.js`
- 失敗時不影響 app 啟動

目前相關檔案：

- [services/analyticsService.ts](../services/analyticsService.ts)
- [index.tsx](../index.tsx)

## 3. iOS 已知注意事項

### 3.1 舊安裝可能需要刪掉重裝一次

已觀察到：

- 新重裝的 iOS 主畫面 app 可以離線冷啟動
- 舊安裝版本可能在完全滑掉後，離線重開時跳出 Safari 無網路錯誤頁

這代表舊的安裝 metadata / start URL / service worker 狀態可能與新版本不一致。

目前建議：

1. 刪除舊的主畫面 app
2. 用 Safari 重新打開正式網址
3. 重新「加入主畫面」
4. 上線開一次後再測離線冷啟動

### 3.2 `viewport-fit=cover` 目前不要開

目前 iOS standalone 模式下，開 `viewport-fit=cover` 容易連動出現：

- 頂部區塊位置偏移
- safe-area 行為不符合預期
- overlay / header 與狀態列重疊

因此目前文件策略是：

- 不使用 `viewport-fit=cover`
- 不使用 `env(safe-area-inset-*)`

詳細排版結論見：

- [docs/pwa-layout-gotchas.md](pwa-layout-gotchas.md)

## 4. 驗證清單

每次調整 PWA / 離線相關設定後，至少驗證以下情境：

### 4.1 線上首次安裝

- Safari 開啟正式網址
- 加入主畫面
- 從主畫面成功啟動
- icon / app 名稱正確

### 4.2 離線冷啟動

- 線上先成功開 app 一次
- 完全滑掉 app
- 開飛航模式
- 從主畫面重新打開
- 確認不是 Safari 錯誤頁，而是正常進入 app

### 4.3 離線核心流程

- 可查看既有交易
- 可新增交易
- 可編輯交易
- 可刪除交易
- 關掉 app 再打開，資料仍存在

### 4.4 離線降級

- AI 輸入區顯示不可用提示
- 同步狀態頁顯示離線提示
- 手動同步不應造成白畫面或未捕捉錯誤

### 4.5 恢復連線

- 恢復網路後可重新打開 app
- `pending` 資料可補送
- AI 再次可用

## 5. 後續若再遇到離線打不開，優先檢查什麼

如果未來又出現「完全關閉 app 後，離線重開失敗」，優先檢查：

1. `manifest.json` 的 `start_url` / `scope`
2. `vite.config.ts` 的 `base`
3. `sw.js` 是否有 precache `index.html`
4. navigation fallback 是否仍指向 app shell
5. 這是不是一個舊安裝，而不是新重裝的 app

如果是新安裝仍然失敗，才往更深一層檢查：

- iOS standalone 啟動 URL 實際請求了哪個路徑
- service worker 是否在安裝後完成接管
- 是否有新的外部啟動依賴重新混入首頁
