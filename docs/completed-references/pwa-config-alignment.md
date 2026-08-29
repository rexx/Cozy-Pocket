# PWA 設定與 rexx app 群組對齊

## 摘要

`~/Downloads/ai-studio/` 底下的 rexx app repo 做過一次橫向 PWA 盤點。結論是 Cozy Pocket 在**知識面**領先（`docs/pwa-offline-implementation.md`、`docs/pwa-layout-gotchas.md` 加上 AGENTS.md 的禁令，是整組 repo 裡唯一的負面知識資產），但在**設定面**落後 mini-sudoku。

這次把設定面補齊，範圍限縮在三件零功能風險的收斂：precache 重複、safe-area 自我矛盾、manifest 缺欄位。沒有新增功能，也沒有動到其他 repo。

## 關鍵變更

### 1. 移除 `vite.config.ts` 的 `includeAssets`

Vite 本來就會把 `public/` 整個複製進 `dist/`，而 `workbox.globPatterns` 的 `**/*.{js,css,html,ico,png,svg,json}` 已經把那些 icon 全部收進 precache。`includeAssets` 再列一次，同一個檔案就在 precache manifest 出現兩筆。

實測值（拆 `dist/sw.js` 直接數，不是讀 config 推論）：

| Repo | precache 項目 | 去重後 | 重複 |
|---|---|---|---|
| mini-sudoku | 13 | 13 | 0 |
| QR-Reader | 15 | 15 | 0 |
| Cozy Pocket（改前） | 27 | 19 | 8 |
| Cozy Pocket（改後） | 19 | 19 | 0 |

八筆重複正好是 `includeAssets` 列的八個檔案。mini-sudoku 與 QR-Reader 都已經拿掉並留了註解說明原因，這個教訓先前沒有回傳到 Cozy Pocket。

現在照 mini-sudoku 的寫法留了註解，說明「不加 `includeAssets`」是刻意的。

### 2. 清掉 `HomePage.tsx` 的 `env(safe-area-inset-bottom)`

`AGENTS.md`、`README.md` 與 `docs/pwa-layout-gotchas.md` 三處都明文禁止 `env(safe-area-inset-*)`，但 `components/HomePage.tsx` 還有兩處在用。

實際影響是零：沒有 `viewport-fit=cover` 時 `env(safe-area-inset-bottom)` 解析為 `0px`，所以 `calc(2rem + 0px)` 就是 `2rem`。留著的唯一後果是違反專案自己寫下的不變式，而且 Cozy Pocket 被當成其他 repo 的對齊基準時這兩行會被抄走。

`calc()` 收成常數，數值不變：

- `bottom-[calc(2rem+env(safe-area-inset-bottom))]` → `bottom-8`
- `pb-[calc(8.5rem+env(safe-area-inset-bottom))]` → `pb-[8.5rem]`

### 3. manifest 補 `id` 與 `lang`

`id` 是 PWA 的安裝身分。沒有明寫時瀏覽器退回用 `start_url` 當身分，於是 `start_url` 一改，既有安裝就會被當成另一個 app。明寫 `"/Cozy-Pocket/"` 讓身分與 `base` / `scope` / `start_url` 四邊一致。

這次明寫的值解析後與原本的隱含值逐字相同，所以既有安裝的身分沒有變化，不會產生重複 app 或需要重新加入主畫面。

`lang` 補 `zh-TW`，`index.html` 的 `<html lang>` 一併從 `en` 改成 `zh-TW`。UI 全是繁體中文，宣告成 `en` 會影響輔助技術朗讀與 CJK 字型 fallback。

`orientation` 沒有加。mini-sudoku 有 `portrait`，但那在 Android 會真的鎖直向，屬於行為改變而非技術債收斂。

## 介面與型別

無。三項都是設定與 className 字面值，不觸及任何 TypeScript 介面、service 邊界或資料流。

## UI 細節

改前改後像素相同。第 2 項的兩個數值在無 `viewport-fit=cover` 的前提下本來就等價，第 1、3 項不影響渲染。

## 驗證

1. `npm run build` 通過（tsc strict + Vite production build）。
2. 拆 `dist/sw.js` 的 precache manifest：項目數 27 → 19，重複 8 → 0。
3. 把改前改後的 precache URL 清單剝掉 content hash 後比對，**19 對 19 完全相同**——去掉的純粹是重複計數，離線快取的檔案集合沒有變。
4. cmux 量 `HomePage`：FAB `bottom: 32px`、列表 `padding-bottom: 136px`，與改前的 `calc(2rem + 0px)` / `calc(8.5rem + 0px)` 相同；DOM 內已無 `safe-area-inset`。
5. `document.documentElement.lang === "zh-TW"`，`dist/manifest.json` 含 `id` 與 `lang`。
6. **離線冷啟動實測**：`vite preview` 開在 `localhost`（secure context，SW 會註冊），確認 SW 接管且 precache 實際落地 19 筆，接著把 server 殺掉再 reload——app 完整渲染、無 console error。server 已死仍能開，即為離線。
7. 拿 `骨直說過`（SC/TC 字形差異字）在 `lang="en"` 與 `lang="zh-TW"` 下並排比對，macOS WebKit 上字形相同，`lang` 改動沒有觸發 CJK fallback 切換。
8. `npm run docs:check` 通過。

dev server 無法用來驗離線：`vite-plugin-pwa` 在 dev 模式不產生 service worker（`sw.js` 會回 SPA fallback 的 `index.html`），且 LAN HTTP 位址不是 secure context，iOS 上 `navigator.serviceWorker` 根本不存在。要驗離線只能用 production build 配 `localhost` 或 HTTPS。

## 假設

- 專案維持「不使用 `viewport-fit=cover`」的決策。這是第 2 項等價性的前提；若日後要重新引入 `viewport-fit=cover`，safe-area padding 要整體重新設計，而不是把這兩行加回來。
- `base` 維持 `/Cozy-Pocket/`。`id` 寫死絕對路徑，與 `base` 綁在一起。
