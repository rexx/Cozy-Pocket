
# Cozy Pocket - 智慧記帳 WebApp

Cozy Pocket 是一款基於 **React 19** 開發的極簡風格智慧記帳應用程式，結合了美學設計與 Google Gemini AI 的強大功能。

---

## 1. 專案概述 (Project Overview)
*   **設計理念**：深色調 (Dark Mode) 美感、隱私優先、極致互動體驗。
*   **核心功能**：智慧日曆、AI 智慧解析、離線優先 (IndexedDB)、資料匯入匯出、歷史輸入建議。
*   **雲端同步 (Cloud Sync)**：透過 Google Apps Script 將資料自動備份至 Google Sheets。

---

## 2. 開發規範 (Coding Standards) - 重要

為確保專案穩定性與類型安全，所有開發者必須遵守以下規範：

### 2.1 外部庫匯入規則
*   **Dexie (資料庫)**：
    *   **必須使用預設匯入**：`import Dexie from 'dexie';`
    *   **嚴禁使用具名匯入**：不可使用 `import { Dexie } from 'dexie';`，以避免 TypeScript 在處理子類別繼承（Subclassing）時無法識別 `this.version()` 等核心方法。
*   **Google GenAI**：
    *   遵循官方最新 SDK 規範，使用 `new GoogleGenAI({ apiKey: process.env.API_KEY })` 初始化。

---

## 3. 雲端同步規格 (Cloud Sync Specification)

目前已實作 **Phase 1（create + pending sync）** 的雲端同步流程：
*   透過 Google Apps Script 將資料自動備份至 Google Sheets。
*   新增、更新、匯入、插入範例資料後會觸發同步。
*   App 啟動後會自動補送尚未同步完成的資料。
*   交易列表會顯示同步狀態點，且可從「同步狀態頁」查看待同步 / 同步中 / 已同步 / 失敗總覽。

完整規格請見：[Cloud Sync Specification](docs/cloud-sync-specification.md)

---

## 4. 技術棧 (Tech Stack)
*   **前端框架**：React 19
*   **樣式處理**：Tailwind CSS v4（本地建置，非 CDN）
*   **資料庫**：Dexie.js (IndexedDB)
*   **日期處理**：date-fns
*   **圖示庫**：Lucide React
*   **人工智慧**：@google/genai (Gemini 3 Flash)
*   **PWA**：Vite PWA Plugin + Service Worker precache

---

## 5. 資料模型 (Data Schema)

### Transaction 介面
```typescript
export interface Transaction {
  id: string;
  type: '支出' | '收入';
  amount: number;
  currency: string;
  categoryId: string;
  subCategoryId?: string;
  name: string;
  merchant?: string;
  note?: string;
  timestamp: number; // Epoch seconds
  readableDateTime?: string; // e.g. 2026-03-05 14:30
  paymentMethod: string;
  tags?: string;
  updatedAt?: number;
  version?: number;
  syncStatus?: 'pending' | 'syncing' | 'synced' | 'error';
  lastSyncError?: string;
}
```

### Dexie Schema
```typescript
this.version(1).stores({
  transactions: '++id, timestamp, categoryId, type, currency',
  settings: 'key'
});
```

---

## 6. 核心邏輯說明

### 6.1 CSV 處理
*   系統使用自定義的 `splitCSVIntoRows` 與 `parseCSVLine` 邏輯，能正確處理包含換行符號（Newline）或逗號（Comma）且被引號包裹的 CSV 欄位，確保備份完整性。

### 6.2 AI 解析
*   整合 Gemini API，支援將自然語言輸入（如「午餐 120 現金」）結構化為帳務紀錄。
*   若裝置目前離線，AI 解析會直接顯示不可用提示，不會阻塞記帳流程。

### 6.3 精確排序 (Precise Sorting)
*   雖然 UI 介面僅讓使用者選擇至「分鐘」，系統會將秒數固定為 `00` 後寫入 `timestamp`（Epoch 秒），並同步寫入 `readableDateTime` 方便人類閱讀。

### 6.4 同步狀態追蹤
*   每筆交易在本地端會保存 `syncStatus` 與 `lastSyncError`，用來追蹤同步進度與錯誤訊息。
*   `syncStatus` 為本地 UI / 補送機制使用的狀態欄位，不屬於上傳到 Google Sheets 的 payload 欄位。
*   目前同步狀態包含：`pending`、`syncing`、`synced`、`error`。
*   離線時新增／編輯／匯入資料仍會先落在 IndexedDB，並保持 `pending`，待恢復連線後補送。

### 6.6 PWA / iOS 離線模式
*   專案現在會在 production build 產生 Service Worker，precache app shell、manifest 與 icon 資產。
*   GitHub Pages 部署路徑固定為 `https://rexx.github.io/Cozy-Pocket/`，Vite `base` 與 manifest `scope/start_url` 已對齊此路徑。
*   iOS Safari 首次上線開啟後，可透過「加入主畫面」安裝；之後離線仍可開啟 app 與操作本機資料。
*   離線模式下可瀏覽、新增、編輯、刪除交易；雲端同步與 AI 解析暫停。
*   iOS standalone PWA 目前**不要**使用 `viewport-fit=cover`，也**不需要** `env(safe-area-inset-*)`。
*   詳細排版注意事項請見：[PWA Layout Gotchas](docs/pwa-layout-gotchas.md)

### 6.5 輸入建議排序
*   新增／編輯記帳時，`merchant`、`name`、`tags` 會根據歷史交易產生建議 chips。
*   建議來源來自目前本機已載入的 `transactions`，不另外建立建議資料表。
*   每個建議值會累積出現次數、最近使用時間、曾出現過的主類別與子類別。
*   建議排序優先序為：字串 match、子類別 match、主類別 match、頻率，最後才用最近使用時間與字串穩定排序做 tie-break。
*   未命中目前輸入字串的項目仍會保留在後方；`tags` 已存在於當前 `tagList` 的值會排除，避免重複加入。

---

## 7. 如何運行
1. `npm install`
2. `npm run dev`
3. 開啟 `http://localhost:5173/`
4. production build：`npm run build`

若需要讓同網段裝置也能連線：

```bash
npm run dev -- --host 0.0.0.0 --port 5173
```

GitHub Pages 部署目標：

```text
https://rexx.github.io/Cozy-Pocket/
```

PWA icon 與 manifest 會直接從 `/Cozy-Pocket/<filename>` 提供，例如：

```text
https://rexx.github.io/Cozy-Pocket/android-chrome-192x192.png
```

---

## 8. 重置本機資料 (Local Storage / IndexedDB)

App 內建重置按鈕：

1. 右上角進入「資料與設定」
2. 找到「重置本機資料」
3. 點擊「清除本機資料並重置」

此操作會執行：
* `localStorage.clear()`
* 刪除 `CozyPocketDB`（IndexedDB）
* 自動重新載入頁面

---

## 9. 雲端同步行為

目前會在以下時機觸發同步：

1. 新增交易後立即同步
2. 更新交易後立即同步
3. 匯入 CSV 後立即同步
4. 儲存 Sync API URL / Token 後立即同步既有待同步資料
5. 插入範例資料後立即同步
6. App 啟動後自動補送未同步完成資料
7. 使用者可從「資料與設定」開啟「同步狀態頁」，手動重新同步待同步資料

補充：
*   若目前離線，上述同步會改為跳過並保留 `pending` 狀態，不視為資料遺失。
*   恢復連線後，App 啟動補送或手動同步都會重新嘗試待同步資料。
