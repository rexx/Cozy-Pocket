
# Cozy Pocket - 智慧記帳 WebApp

Cozy Pocket 是一款基於 **React 19** 開發的極簡風格智慧記帳應用程式，結合了美學設計與 Google Gemini AI 的強大功能。

---

## 1. 專案概述 (Project Overview)
*   **設計理念**：深色調 (Dark Mode) 美感、隱私優先、極致互動體驗。
*   **核心功能**：智慧日曆、月份／年份統計、Tag 篩選、商家更名管理、AI 智慧解析、離線優先 (IndexedDB)、資料匯入匯出、歷史輸入建議。
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
*   通知分工採用短 toast + 頁內詳細 status 的雙層設計：短成功摘要走 toast，長結果與部分失敗細節保留在頁內狀態區塊。

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
*   「同步狀態頁」中的交易時間會顯示完整日期與時間，方便跨天追查同步順序。
*   同步失敗時，頂部錯誤列會顯示失敗交易 `id` 與錯誤摘要；「同步狀態頁」中的失敗交易會直接顯示 `lastSyncError` 詳細內容。
*   「同步狀態頁」預設會隱藏 `synced` 項目，讓使用者優先聚焦 `pending`、`syncing`、`error` 的資料；如有需要可在頁內切回顯示全部。
*   「同步狀態頁」中的交易項目可直接點入既有編輯 modal，方便立即修正待同步或失敗資料。
*   若目前所有交易都已同步完成，且篩選仍維持開啟，頁面會顯示「目前沒有待處理或失敗的同步項目」。
*   若後端有正確回傳結構化錯誤（例如 Google Apps Script 寫入失敗），前端會優先顯示該錯誤訊息；只有在瀏覽器拿不到可讀 response 時，才會退回顯示 `Failed to fetch` 類型的診斷提示。

### 6.5 頁面規劃
*   App 目前的**主頁面（active views）**共有六個：`首頁`、`搜尋`、`統計`、`資料與設定`、`商家管理`、`同步狀態`。
*   `搜尋` 已改為獨立頁面，從首頁右上角搜尋按鈕進入，左上角返回首頁。
*   `商家管理` 已改為獨立頁面，從「資料與設定」中的入口卡片進入，返回時會回到「資料與設定」。
*   `同步狀態` 已改為獨立頁面，可從首頁或資料與設定進入；返回時會依入口回到原本頁面。
*   `首頁` 負責日期切換、每日交易列表，以及進入其他功能頁的入口。
*   `統計` 與 `資料與設定` 都是獨立頁面，不再是首頁上的小型浮層工具。
*   目前的**overlay / modal 畫面**包含：`新增／編輯交易`。
*   overlay 關閉後會回到原本所在的主頁面；例如從搜尋、統計、資料與設定或同步狀態進入編輯，關閉後會回到原本頁面。

#### 6.5.1 資訊架構摘要
*   `首頁`：日期切換、每日交易列表、本月摘要卡，以及前往搜尋／資料與設定／同步狀態的入口。
*   `搜尋`：搜尋名稱、商家、備註、tag、類別與幣別，顯示搜尋結果並可直接編輯。
*   `統計`：提供月份／年份切換、tag 與支付方式篩選，以及依條件展開交易明細。
*   `資料與設定`：提供偏好設定、同步設定、Tag 管理、商家管理入口、匯入匯出與危險操作等單頁分區。
*   `商家管理`：提供商家清單、受影響交易預覽與商家更名操作。
*   `同步狀態`：顯示待同步／同步中／已同步／失敗統計、交易清單、預設隱藏已同步項目的篩選、詳細錯誤、手動同步入口，以及可直接點入編輯的交易項目。
*   `新增／編輯交易`：唯一保留的 overlay，會覆蓋在目前主頁面上，關閉後返回原頁。
*   `同步狀態` 也會保留返回來源：從首頁進入返回首頁，從資料與設定進入則返回資料與設定。

#### 6.5.2 導航地圖
```text
首頁
├─ 搜尋
├─ 統計
├─ 資料與設定
│  └─ 商家管理
└─ 同步狀態

資料與設定
├─ Tag 管理（頁內區塊）
├─ 商家管理（獨立頁入口）
└─ 同步狀態

任一主頁面
└─ 新增／編輯交易（overlay）
```

*   `搜尋`、`統計`、`資料與設定`、`商家管理`、`同步狀態` 都屬於主頁面層級；其中 `商家管理` 從 `資料與設定` 進入。
*   `資料與設定` 目前維持單一頁面，但已拆成偏好設定、同步設定、Tag 管理、商家管理入口、匯入匯出與危險操作等區段元件。
*   `Tag 管理` 是 `資料與設定` 內的功能區塊，不是獨立頁面；`商家管理` 則已升級為獨立頁面。
*   `新增／編輯交易` 可從多個主頁面進入，但仍維持 overlay 呈現。

#### 6.5.3 頁面元件對應
*   `首頁`：`components/HomePage.tsx`
*   `搜尋`：`components/SearchPage.tsx`
*   `統計`：`components/MonthlyStatsPage.tsx`
*   `資料與設定`：`components/SettingsPage.tsx`
*   `商家管理`：`components/MerchantManagementPage.tsx`
*   `同步狀態`：`components/SyncStatusPage.tsx`
*   `新增／編輯交易` overlay：`components/AddTransactionModal.tsx`

#### 6.5.4 元件層級與命名原則
*   主頁面元件統一使用 `*Page.tsx` 命名，放在 `components/` 目錄下。
*   overlay / modal 元件統一使用 `*Modal.tsx` 命名，與主頁面元件語意區隔。
*   `App.tsx` 應盡量只負責：
    *   active view 切換
    *   共用 state / handler 管理
    *   將資料與 callback 傳給各 page / modal
*   新的完整頁面功能，優先新增獨立 `*Page.tsx`，避免再把大量頁面 JSX 直接堆回 `App.tsx`。
*   頁內功能區塊（例如 `SettingsPage` 內的偏好設定、同步設定、Tag 管理、匯入匯出與危險操作）應優先拆成 page 內的子元件，保留單一頁面體驗，同時降低大型 JSX 維護成本。

### 6.6 統計頁期間與篩選
*   使用者可從首頁底部的本月摘要卡進入「統計」頁。
*   統計頁支援 `月份` 與 `年份` 兩種模式，兩者共用同一套聚合邏輯與 UI。
*   期間切換會同步影響幣別統計、Tag 清單，以及收入／支出展開後的交易明細。
*   `tags` 採空白分隔儲存；統計頁的 Tag 篩選使用精確 token 比對，不做模糊包含搜尋。

### 6.7 統計頁明細展開
*   每個幣別卡片會顯示收入與支出總額。
*   點擊收入或支出卡片後，會展開符合目前期間與 Tag 篩選的交易列表。
*   展開後的項目沿用既有 `TransactionItem` 呈現，點擊後會直接進入原本的編輯流程。

### 6.8 PWA / iOS 離線模式
*   專案現在會在 production build 產生 Service Worker，precache app shell、manifest 與 icon 資產。
*   GitHub Pages 部署路徑固定為 `https://rexx.github.io/Cozy-Pocket/`，Vite `base` 與 manifest `scope/start_url` 已對齊此路徑。
*   iOS Safari 首次上線開啟後，可透過「加入主畫面」安裝；之後離線仍可開啟 app 與操作本機資料。
*   離線模式下可瀏覽、新增、編輯、刪除交易；雲端同步與 AI 解析暫停。
*   iOS standalone PWA 目前**不要**使用 `viewport-fit=cover`，也**不需要** `env(safe-area-inset-*)`。
*   離線實作與修改重點說明請見：[PWA Offline Implementation](docs/pwa-offline-implementation.md)
*   詳細排版注意事項請見：[PWA Layout Gotchas](docs/pwa-layout-gotchas.md)

### 6.9 輸入建議排序
*   新增／編輯記帳時，`merchant`、`name`、`tags` 會根據歷史交易產生建議 chips。
*   建議來源來自目前本機已載入的 `transactions`，不另外建立建議資料表。
*   每個建議值會累積出現次數、最近使用時間、曾出現過的主類別與子類別。
*   建議排序優先序為：字串 match、子類別 match、主類別 match、頻率，最後才用最近使用時間與字串穩定排序做 tie-break。
*   未命中目前輸入字串的項目仍會保留在後方；`tags` 已存在於當前 `tagList` 的值會排除，避免重複加入。

### 6.10 Tag 管理
*   「資料與設定」改為獨立頁面，從首頁右上角進入，左上角返回首頁。
*   「資料與設定」頁提供 Tag 管理區塊，可查看目前所有 tag 與各自使用筆數。
*   尚未選擇 tag 前，只顯示 tag 清單；更名輸入區與操作按鈕會先隱藏。
*   選擇 tag 後，會在同一區塊列出該 tag 的所有交易，並可直接點進既有編輯流程。
*   更名 tag 前需先執行預覽，確認會影響的交易筆數。
*   tag 更名採精確 token 比對，只會更新完整相同的 tag，不做模糊字串取代。
*   預覽顯示的是「受影響交易筆數」，不是 tag token 次數。
*   輸入時會自動正規化 tag：去除前後空白，並移除前置 `#`。
*   若新 tag 名稱已存在，系統會先提醒；確認後會合併為同一個 tag，並自動去除重複 tag。
*   合併或更名後，該筆交易的 `tags` 會重新整理為標準空白分隔格式。
*   tag 名稱目前仍區分大小寫，例如 `food` 與 `Food` 會視為不同 tag。

### 6.11 商家管理
*   商家名稱目前仍保存在每筆交易的 `merchant` 欄位中，商家更名會以批次更新交易的方式完成。
*   「商家管理」已改為獨立頁面，方便集中整理商家名稱與相關交易。
*   設定頁只保留商家管理入口卡片；進入管理頁後才會整理商家清單與相關交易。
*   更名前需先執行預覽，確認受影響交易筆數。
*   商家更名會一次更新所有符合舊名稱的交易，並將這些交易標記為 `pending` 以便後續同步。
*   更名完成後，既有交易列表、搜尋結果、統計頁內容與同步 payload 都會反映新名稱。
*   商家名稱目前採前後空白 trim 後精確比對，不做大小寫折疊或模糊合併。

### 6.12 設定頁區段化
*   `SettingsPage` 目前維持單一頁面，不使用 tabs 或子路由。
*   畫面已拆成五個主要區段元件：`PreferencesSection`、`SyncSection`、`TagManagementSection`、`ImportExportSection`、`DangerZoneSection`，另保留商家管理入口卡片。
*   頁面層仍集中管理 Dexie 讀寫、CSV 匯入匯出、同步觸發、Tag 更名與 status 訊息。
*   各區段元件只負責 UI 與事件轉發，不直接操作資料庫或同步服務。
*   匯入與匯出已整併在同一個 section 中；插入範例資料與清除本機資料則集中在危險操作區。

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

統計頁操作方式：

1. 在首頁底部點擊本月摘要卡
2. 在統計頁上方切換 `月份` 或 `年份`
3. 使用左右箭頭切換目前期間
4. 視需要選擇單一 `tag` 篩選
5. 點擊收入或支出卡片展開符合條件的交易列表
6. 點擊列表項目可直接編輯該筆交易

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
