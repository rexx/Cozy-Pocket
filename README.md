
# Cozy Pocket - 智慧記帳 WebApp

Cozy Pocket 是一款基於 **React 19** 開發的極簡風格智慧記帳應用程式，結合了美學設計與 Google Gemini AI 的強大功能。

---

## 1. 專案概述 (Project Overview)
*   **設計理念**：深色調 (Dark Mode) 美感、隱私優先、極致互動體驗。
*   **核心功能**：智慧日曆、月份／年份統計、類別彙整分析、Tag 篩選、商家更名管理、AI 智慧解析、離線優先 (IndexedDB)、資料匯入匯出、歷史輸入建議。
*   **雲端同步 (Cloud Sync)**：透過 Google Apps Script 將資料自動備份至 Google Sheets。

---

## 2. 開發規範 (Coding Standards) - 重要

為確保專案穩定性與類型安全，所有開發者必須遵守以下規範：

### 2.1 外部庫匯入規則
*   **Dexie (資料庫)**：
    *   **必須使用預設匯入**：`import Dexie from 'dexie';`
    *   **嚴禁使用具名匯入**：不可使用 `import { Dexie } from 'dexie';`，以避免 TypeScript 在處理子類別繼承（Subclassing）時無法識別 `this.version()` 等核心方法。
*   **Google GenAI**：
    *   前端瀏覽器環境需明確傳入 API key；目前由設定頁儲存 `geminiApiKey` 後，再以 `new GoogleGenAI({ apiKey })` 初始化。

---

## 3. 雲端同步規格 (Cloud Sync Specification)

目前已實作 **Phase 1.5（create + pending sync + manual year sync）** 的雲端同步流程：
*   透過 Google Apps Script 將資料自動備份至 Google Sheets。
*   新增、更新、匯入、插入範例資料後會觸發同步。
*   App 啟動後會自動補送尚未同步完成的資料。
*   使用者可從設定頁手動指定年份，執行年度雲端同步，並依 `version` / `updatedAt` 自動雙向 merge。
*   每次年度雲端同步都會在本地保存完整報告，可回看變更紀錄與手動刪除報告。
*   交易列表會顯示同步狀態點，且可從「同步狀態頁」查看待同步 / 同步中 / 已同步 / 失敗總覽。
*   通知分工採用短 toast + 頁內詳細 status 的雙層設計，且兩者互斥：全部成功時只顯示底部輕量 toast；離線待同步、部分同步失敗或需要後續行動（例如「查看同步狀態」按鈕）時，只顯示頁內狀態卡片，不重複跳 toast。
*   需要使用者確認的危險操作使用 `sweetalert2` app 內對話框；交易新增、修改、刪除成功已改用底部輕量 toast，不再使用 `sweetalert2` 置中 auto-dismiss toast（`sweetalert2` 只保留互動確認對話框用途）。

### 3.1 Mock Sync API
開發測試時可在「同步設定」點擊「使用 mock API」，系統會填入：

```text
Sync API URL: mock://cloud-sync
Sync Token: mock-token
```

mock cloud 會保存在瀏覽器 `localStorage`，支援 `create` upsert 與按年份 `get` 讀取，不需要先部署 Google Apps Script。

完整規格請見：[Cloud Sync Specification](docs/cloud-sync-specification.md)

---

## 4. 技術棧 (Tech Stack)
*   **前端框架**：React 19
*   **樣式處理**：Tailwind CSS v4（本地建置，非 CDN）
*   **資料庫**：Dexie.js (IndexedDB)
*   **日期處理**：date-fns
*   **確認與交易成功提示**：sweetalert2
*   **圖示庫**：Lucide React
*   **人工智慧**：@google/genai (Gemini 3.1 Flash Lite)
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
this.version(2).stores({
  transactions: '++id, timestamp, categoryId, type, currency',
  settings: 'key',
  pullReports: 'id, createdAt, year, status',
});
```

目前 schema 為 v2，共三張表：`transactions`、`settings`、`pullReports`（年度雲端同步報告）。既有 version 定義不可修改，新欄位或新表一律以新 version 疊加（詳見 AGENTS.md）。

`tags` 是空白分隔的單一字串，tag 名稱本身不可含空白。新增／編輯交易與 Tag 管理兩條寫入路徑都以 `services/tagService.ts` 的 `joinTags()` 序列化：正規化、去除重複、依 code point 排序。排序刻意不使用 `localeCompare`，因為 code point 順序與執行引擎無關，不同裝置寫入同一組 tag 會產生完全相同的字串，同步的內容比對不會因排序差異誤判。既有資料不會回頭重排，只有被重新寫入的交易會套用新順序。

---

## 6. 核心邏輯說明

### 6.1 CSV 處理
*   系統使用自定義的 `splitCSVIntoRows` 與 `parseCSVLine` 邏輯，能正確處理包含換行符號（Newline）或逗號（Comma）且被引號包裹的 CSV 欄位，確保備份完整性。

### 6.2 AI 解析
*   整合 Gemini API，支援將自然語言輸入（如「午餐 120 現金」）結構化為帳務紀錄。
*   AI 交易解析目前使用 `gemini-3.1-flash-lite-preview`，並將 Gemini 3 thinking level 設為 `minimal`，以符合 free tier 日常記帳用量與低延遲需求。
*   Gemini API key 由使用者在「資料與設定」頁輸入並儲存在本機 IndexedDB，不使用 build-time env。
*   AI 快速填寫整合為新增交易頁的「支出 / AI / 收入」tab 之一，AI tab 夾在支出與收入中間，按鈕本體只顯示 `Sparkles` icon 不含文字，active 時 icon 與底色 underline 採用 cyan。
*   只有切到 AI tab 才會顯示 AI 輸入區與其狀態訊息；切到 AI tab 時會自動 focus 輸入框，方便使用者直接輸入。停留在支出／收入 tab 時表單佔滿整個 modal 內容，不再保留 AI 輸入框佔位。
*   尚未設定 Gemini API key、或處於編輯既有交易的模式時，AI tab 不會出現在 tab 列，只剩支出與收入兩個 tab。
*   AI 解析成功後 tab 會自動切回對應的支出或收入並顯示填入後的表單；無法辨識 type 時 fallback 為支出，並以 inline 警告提示。
*   AI 已填入欄位摘要（如「AI 已填入：金額、類別⋯」）顯示在 scroll 區頂端，與目前 active tab 無關，因此切回支出／收入 tab 仍能看見 AI 剛剛填了哪些欄位；使用者在 AI 輸入框重新輸入時摘要會自動清除。
*   切到 AI tab 不會清除表單已輸入的內容；從 AI tab 切回支出／收入時也會保留目前選好的類別、金額等欄位。
*   等待 Gemini API 回應時，AI 快速填寫輸入框會顯示 SVG 外框流動動畫，成功或失敗後停止。
*   AI 填入的欄位會以 cyan 邊框標示；手動修改該欄位後會移除標示。
*   AI 可套用支援但未啟用的幣別到單筆交易，但不會自動修改偏好設定中的啟用幣別清單。
*   AI prompt 與 response schema 會列出並限制可用類別、子類別、支付方式與幣別；AI 回傳的非法類別、子類別、支付方式或幣別不會覆蓋表單欄位，會改以 inline 提示提醒使用者手動確認。
*   若裝置目前離線，AI 解析會直接顯示不可用提示，不會阻塞記帳流程。

### 6.3 精確排序 (Precise Sorting)
*   雖然 UI 介面僅讓使用者選擇至「分鐘」，系統會將秒數固定為 `00` 後寫入 `timestamp`（Epoch 秒），並同步寫入 `readableDateTime` 方便人類閱讀。

### 6.4 同步狀態追蹤
*   每筆交易在本地端會保存 `syncStatus` 與 `lastSyncError`，用來追蹤同步進度與錯誤訊息。
*   `syncStatus` 為本地 UI / 補送機制使用的狀態欄位，不屬於上傳到 Google Sheets 的 payload 欄位。
*   目前同步狀態包含：`pending`、`syncing`、`synced`、`error`。
*   離線時新增／編輯／匯入資料仍會先落在 IndexedDB，並保持 `pending`，待恢復連線後補送。
*   「同步狀態頁」中的交易時間會顯示完整日期與時間，方便跨天追查同步順序。
*   同步失敗等錯誤會被持續捕捉；最上方的錯誤訊息紅色區塊（debug banner）預設隱藏，於偏好設定開啟後才會列出失敗交易 `id` 與錯誤摘要。無論開關狀態，「同步狀態頁」中的失敗交易都會直接顯示 `lastSyncError` 詳細內容。
*   「同步狀態頁」預設會隱藏 `synced` 項目，讓使用者優先聚焦 `pending`、`syncing`、`error` 的資料；如有需要可在頁內切回顯示全部。
*   「同步狀態頁」中的交易項目可直接點入既有編輯 modal，方便立即修正待同步或失敗資料。
*   編輯交易時，畫面底部會顯示該筆交易的同步狀態；`pending` 可點擊左側時鐘圖示立即上傳，`error` 可點擊左側驚嘆號圖示重新上傳，`syncing` 與 `synced` 則維持狀態顯示。
*   編輯頁的單筆上傳會使用 IndexedDB 中已儲存的最新版本；若表單內容尚未儲存，需先按儲存才會同步最新編輯內容。
*   設定頁在同步設定儲存、Tag 更名、商家更名、CSV 匯入後，若補送同步出現部分失敗，頁內狀態訊息會附帶「查看同步狀態」按鈕，可直接跳到同步狀態頁查看失敗交易與錯誤詳情；返回時會回到原本的設定子頁。
*   若目前所有交易都已同步完成，且篩選仍維持開啟，頁面會顯示「目前沒有待處理或失敗的同步項目」。
*   若後端有正確回傳結構化錯誤（例如 Google Apps Script 寫入失敗），前端會優先顯示該錯誤訊息；只有在瀏覽器拿不到可讀 response 時，才會退回顯示 `Failed to fetch` 類型的診斷提示。

### 6.5 頁面規劃
*   App 目前的**主頁面（active views）**共有五個：`首頁`、`搜尋`、`統計`、`資料與設定`、`同步狀態`。
*   `搜尋` 已改為獨立頁面，從首頁右上角搜尋按鈕進入，左上角返回首頁；進入時會在同一個點擊事件內同步聚焦搜尋輸入框，iPhone PWA 上會一併彈出虛擬鍵盤，使用者可立即輸入。
*   `商家管理` 已整併為 `資料與設定` 的設定子頁，與 Tag 管理等其他子頁共用設定首頁卡片、子頁 routing 與返回行為。
*   `同步狀態` 已改為獨立頁面，可從首頁或資料與設定進入；返回時會依入口回到原本頁面。
*   `首頁` 負責日期切換、每日交易列表，以及進入其他功能頁的入口。
*   首頁上半部日曆支援週／月切換：月模式可左右滑動切換月份，週模式可左右滑動切換週次；下半部每日交易列表支援左右滑動切換前後日，與既有左右按鈕行為一致。
*   首頁的左右導覽按鈕（上半日曆切週／月、下半交易列表切前後日）可在偏好設定一次隱藏，預設顯示；隱藏後左右滑動手勢仍可切換，週／月切換鈕與新增交易按鈕不受影響。
*   最上方的錯誤訊息紅色區塊（debug banner，顯示捕捉到的 `window` 錯誤、未處理的 promise rejection 與各 CRUD／同步流程錯誤）可在偏好設定切換顯示／隱藏，預設隱藏；錯誤仍會在背景持續捕捉，開啟後即可檢視已累積的錯誤，並可按區塊內 `X` 清除。
*   交易列表項目（`TransactionItem`，首頁、搜尋、統計、同步狀態共用）的 tag 以小型 pill 顯示在第二行次要文字之後；交易名稱獨佔第一行整行寬度並在過長時截斷。第二行空間不足時由次要文字先截斷，tag 儘量完整顯示，只有單一 tag 長到超過整行時才會截斷。
*   `統計` 與 `資料與設定` 都是獨立頁面，不再是首頁上的小型浮層工具。
*   共用頁面 header 使用與 PWA 外框一致的 `#1a1c2c`，並保留較短的上方留白，讓設定、同步狀態、搜尋、統計與交易 modal 在手機 PWA 上維持連續色面。
*   目前的**overlay / modal 畫面**包含：`新增／編輯交易`。
*   overlay 關閉後會回到原本所在的主頁面；例如從搜尋、統計、資料與設定或同步狀態進入編輯，關閉後會回到原本頁面。
*   新增、複製或編輯交易儲存成功後，首頁選取日期會同步到該筆交易日期；若當下位於其他主頁面，會保留原頁面並在返回首頁時顯示該日期。

#### 6.5.1 資訊架構摘要
*   `首頁`：日期切換、每日交易列表、本月摘要卡，以及前往搜尋／資料與設定／同步狀態的入口；日曆可切換週／月模式，並依模式左右滑動切週或切月，交易列表可左右滑動切日。本月與本日摘要在多幣別時會以一致圖示標示，避免以文字或 emoji 佔用摘要空間；交易列表的支付方式可依偏好顯示為文字或圖示，預設為文字。
*   `搜尋`：搜尋名稱、商家、備註、tag、類別與幣別，顯示搜尋結果並可直接編輯。
*   `統計`：分為「總覽」與「趨勢」兩個分頁。總覽提供月份／年份切換，tag、支付方式與類別篩選，收入／支出明細展開，依類別彙整以及依商家彙整的金額與筆數分析；趨勢以近 12 個月滾動視窗的堆疊長條圖呈現每月收支組成，並共用同一組篩選條件（見 §6.14）。
*   `資料與設定`：提供設定入口清單；偏好設定、AI 設定、同步設定、Tag 管理、商家管理、匯入匯出與危險操作會進入各自設定子頁。
*   `資料與設定` 每一頁（含所有設定子頁）最底部固定顯示建置識別 `v<version> · <commit> · <build 時間>`，三個值都在 build 時烤進 bundle。樣式與上方的 `Cozy Pocket • Minimalism` 裝飾字一致，只是改用等寬字讓 commit hash 好認。
*   `商家管理`（設定子頁）：提供可搜尋與逐批載入的商家清單、受影響交易預覽與商家更名操作。
*   `同步狀態`：顯示待同步／同步中／已同步／失敗統計、交易清單、預設隱藏已同步項目的篩選、詳細錯誤、手動同步入口，以及可直接點入編輯的交易項目。
*   `新增／編輯交易`：唯一保留的 overlay，會覆蓋在目前主頁面上，關閉後返回原頁；編輯模式底部會顯示單筆同步狀態與可用的單筆上傳操作。modal 開啟時不會自動 focus 金額輸入框，避免在 iPhone PWA 上一開啟就彈出虛擬鍵盤；使用者點擊欄位後再彈出。（切到 AI tab 時仍會自動 focus AI 輸入框，見 §6.2。）
*   `同步狀態` 也會保留返回來源：從首頁進入返回首頁，從資料與設定進入則返回資料與設定。

#### 6.5.2 導航地圖
```text
首頁
├─ 搜尋
├─ 統計
├─ 資料與設定
└─ 同步狀態

資料與設定
├─ 偏好設定（設定子頁）
├─ AI 設定（設定子頁）
├─ 同步設定（設定子頁）
│  ├─ 同步狀態
│  └─ 同步紀錄
├─ Tag 管理（設定子頁）
├─ 商家管理（設定子頁）
├─ 匯入匯出（設定子頁）
└─ 危險操作（設定子頁）

任一主頁面
└─ 新增／編輯交易（overlay）
```

*   `搜尋`、`統計`、`資料與設定`、`同步狀態` 都屬於主頁面層級。
*   `資料與設定` 已改為設定入口清單，偏好設定、AI 設定、同步設定、Tag 管理、商家管理、匯入匯出與危險操作各自進入設定子頁。
*   `新增／編輯交易` 可從多個主頁面進入，但仍維持 overlay 呈現。

#### 6.5.3 頁面元件對應
*   `首頁`：`components/HomePage.tsx`
*   `搜尋`：`components/SearchPage.tsx`
*   `統計`：`components/MonthlyStatsPage.tsx`
*   `資料與設定`：`components/SettingsPage.tsx`
*   `同步狀態`：`components/SyncStatusPage.tsx`
*   `同步紀錄`：`components/PullReportsPage.tsx`（從同步設定子頁進入）
*   `新增／編輯交易` overlay：`components/AddTransactionModal.tsx`

設定子頁內容（由 `SettingsPage` 依 `section` 切換 render）：
*   `偏好設定`：`components/settings/PreferencesSection.tsx`
*   `AI 設定`：`components/settings/AiSection.tsx`
*   `同步設定`：`components/settings/SyncSection.tsx`
*   `Tag 管理`：`components/settings/TagManagementSection.tsx`
*   `商家管理`：`components/settings/MerchantManagementSection.tsx`
*   `匯入匯出`：`components/settings/ImportExportSection.tsx`
*   `危險操作`：`components/settings/DangerZoneSection.tsx`

`App.tsx` 以 `AppView` 字串對應：主頁面 `home` / `search` / `stats` / `settings` / `sync`、設定子頁 `settings-preferences` / `settings-ai` / `settings-sync` / `settings-tags` / `settings-merchant` / `settings-import-export` / `settings-danger`，以及獨立子頁 `pull-reports`。

#### 6.5.4 元件層級與命名原則
*   主頁面元件統一使用 `*Page.tsx` 命名，放在 `components/` 目錄下。
*   overlay / modal 元件統一使用 `*Modal.tsx` 命名，與主頁面元件語意區隔。
*   `App.tsx` 應盡量只負責：
    *   active view 切換
    *   共用 state / handler 管理
    *   將資料與 callback 傳給各 page / modal
*   新的完整頁面功能，優先新增獨立 `*Page.tsx`，避免再把大量頁面 JSX 直接堆回 `App.tsx`。
*   頁內功能區塊應先拆成 page 內的子元件；當資訊量或操作流程增加時，可升級為設定子頁，並由 `App.tsx` 負責 view routing。

### 6.6 統計頁期間與篩選
*   使用者可從首頁底部的本月摘要卡進入「統計」頁。
*   統計頁分為 `總覽` 與 `趨勢` 兩個分頁，切換鈕位於期間卡片最上方，預設為總覽。
*   統計頁支援 `月份` 與 `年份` 兩種模式，兩者共用同一套聚合邏輯與 UI。`月份／年份` 切換與排序鈕只屬於總覽，切到趨勢時一併隱藏：趨勢的視窗固定為 12 個月，年為單位的期間不適用，而排序只影響總覽的交易列表。
*   期間導覽的 `‹ ›` 在總覽依 `月份／年份` 模式移動一個月或一年；在趨勢一律移動一個月，移動的是滾動視窗的右端，標題下方另以細字顯示視窗實際涵蓋範圍（例如 `2025/9 – 2026/8`）。即使總覽當下處在年份模式，切到趨勢仍以月為步進。
*   tag、支付方式、類別與已排除子類別四個篩選條件由總覽與趨勢共用同一份 state，切換分頁不會重置，幣別卡片右上的篩選徽章在兩個分頁都照常顯示。
*   可選的 tag、支付方式與類別清單取自目前分頁的實際範圍：總覽取選定月份或年份，趨勢取 12 個月的滾動視窗，因此在趨勢下可以選到幾個月前才用過的 tag 或類別。
*   期間切換會同步影響幣別統計、Tag 清單、支付方式清單、類別清單、收入／支出展開明細、類別彙整與商家彙整結果。
*   `tags` 採空白分隔儲存；統計頁的 Tag 篩選使用精確 token 比對，不做模糊包含搜尋。
*   統計頁的 Tag 篩選可同時選取多個 tag，採 AND 規則：交易必須同時具有全部已選 tag 才會納入統計。選取 `Ipass` 與 `永豐` 時，只有兩個 tag 都具備的交易會保留，只有其中一個的不會。
*   Tag chip 可獨立切換，再次點擊已選 tag 即取消該項；「全部」代表未套用 tag 條件，按下會一次清空所有已選 tag，並只在沒有任何已選 tag 時呈現選取樣式。
*   切換月份或年份時，只移除新期間不存在的已選 tag，其餘仍有效的選取會保留。
*   幣別卡片右上角的篩選徽章在只選一個 tag 時顯示 `#tag`，選取多個時顯示「N 個 tag」，避免手機寬度下徽章過長。
*   統計頁的 Tag 篩選清單依 tag 名稱的 code point 順序排列，與 Tag 管理清單和 `tags` 欄位的儲存順序一致。
*   篩選面板由上而下為 `TAG`、`支付方式`、`類別` 三列 chip，最後一區是 `時間範圍` 的「排除未來交易」switch。類別篩選與 Tag 一樣支援多選，但採 OR 規則：交易只要屬於任一已選類別就納入統計。這與 Tag 的 AND 規則不同——一筆交易只有一個類別，AND 在此永遠得到空集合。
*   類別 chip 只列出目前期間實際出現過的類別，不列出 `CATEGORIES` 全表，避免整列都是永遠比不到東西的選項。沒有 `categoryId` 的交易歸為「未分類」，可被單獨選取。
*   類別清單依 `CATEGORIES` 的既有順序排列，支出類別在前、收入類別在後；不在該表內的 id（含「未分類」）排在最後。
*   類別 chip 可獨立切換，再次點擊已選類別即取消該項；「全部」代表未套用類別條件，按下會一次清空所有已選類別，並只在沒有任何已選類別時呈現選取樣式。
*   切換月份、年份或分頁時，只移除新期間不存在的已選類別，其餘仍有效的選取會保留。
*   幣別卡片右上角的篩選徽章在只選一個類別時顯示類別名稱，選取多個時顯示「N 個類別」，與 Tag 的收合規則一致。徽章的組成順序為 tag、支付方式、類別、排除未來、已排除子類別，與篩選面板由上而下的順序相同。
*   類別篩選與 Tag、支付方式、已排除子類別互為交集，並同時影響幣別總額、依類別彙整、依商家彙整、所有展開明細與趨勢圖。
*   篩選面板最下方的「排除未來交易」switch 預設開啟，會排除 `timestamp` 嚴格晚於當下的交易；剛好等於當下的交易仍保留。比較前兩邊都先轉成 epoch 秒，不直接拿毫秒值比對。關閉後未來交易立即回到統計中。
*   這個排除在期間篩選之後、tag／支付方式／類別篩選之前套用，所以可選的 tag、支付方式與類別清單也只反映未被排除的交易；幣別總額、依類別彙整、依商家彙整、所有展開明細與趨勢圖使用同一份資料，不會出現某一區塊算進未來交易、另一區塊沒算的情況。
*   選項只存在於這次進入統計頁的期間，不寫入 `localStorage` 或 Dexie；離開統計頁再回來會回到預設的開啟狀態。這與已排除子類別不同，後者是持久化設定。
*   徽章只在這個選項「真的擋掉東西」時才加上「排除未來」——選項開啟但期間內沒有未來交易時不顯示，也不會讓篩選按鈕呈現套用中的樣式。

### 6.7 統計頁明細展開、類別與商家彙整
*   每個幣別卡片會顯示收入與支出總額。
*   點擊收入或支出卡片後，會展開符合目前期間與 Tag 篩選的交易列表。
*   目前期間與篩選條件下該幣別沒有收入資料時，會整段隱藏收入摘要卡、收入明細展開與收入類別群組；只有收入沒有支出時收入區塊仍會正常顯示。
*   每個幣別卡片下方會顯示依類別彙整區塊，分為支出類別與收入類別。
*   依類別彙整區塊預設為收合狀態，標題列右側顯示類別數量徽章與展開／收合 chevron；點擊標題列才會渲染支出／收入類別群組，再次點擊可收合。多幣別下每個幣別卡片的展開狀態彼此獨立；離開統計頁再回來會重置為收合。
*   類別列依金額由高到低排序，金額相同時再依筆數與類別名稱排序；不同幣別不會混算。
*   類別列會使用既有分類圖示與分類顏色，並顯示該類別在同類型總額中的占比。
*   點擊類別列後會展開子類別摘要與該類別交易列表；交易項目沿用既有 `TransactionItem` 呈現，點擊後會直接進入原本的編輯流程。
*   展開中的類別列會與下方展開面板接成一張連續卡片：類別列去掉下緣圓角與下邊框，面板沿用同一組選中色的邊框並去掉上緣圓角，兩者左緣、寬度對齊且無間距，因此子類別卡與交易明細讀起來屬於被展開的那個類別，而不是同層的另一批類別卡。面板內以「<類別名>的子類別」與「<類別名>的交易明細」兩個小標分段。
*   展開後的子類別摘要會顯示筆數、金額、佔比與沿用主類別顏色的 progress bar；佔比分母為展開類別的總額，不跨類別或幣別比較。
*   每個子類別摘要列右側提供排除按鈕，按下後該子類別會從幣別總額、類別占比、子類別摘要、收入／支出展開明細與交易列表一起移除。
*   排除清單以 Dexie `settings` 表的 `statsExcludedSubCategoryKeys` 保存（內容為 JSON array，每筆為 `categoryId:subCategoryId`），切換期間／tag／支付方式不會清空；重新開啟統計頁時自動套用，並可透過篩選列上的「排除 N」按鈕展開摘要進行單筆取消或全部清除。清單由 `App.tsx` 在開機時讀入並以 props 傳給 `MonthlyStatsPage`，因此進入統計頁的第一次 render 就已套用排除，不會先顯示未排除的金額再跳動。
*   依類別彙整下方會顯示依商家彙整區塊，預設為收合狀態，標題列右側顯示商家數量徽章與展開／收合 chevron；點擊標題列才會渲染支出商家與收入商家群組，再次點擊可收合。每個幣別卡片的展開狀態彼此獨立；離開統計頁再回來會重置為收合。
*   商家列依金額由高到低排序，金額相同時再依筆數、最近交易時間與商家名稱排序；不同幣別不會混算，同一商家在不同幣別會分別顯示。
*   只有有商家名稱的交易會列入商家彙整，空商家交易仍計入幣別與類別總額但不會出現在商家清單。
*   商家分組使用正規化後的大小寫不敏感 key（移除前後空白、合併連續空白後比對），顯示則保留正規化後的商家名稱。
*   點擊商家列會展開該商家的交易列表，沿用既有 `TransactionItem` 呈現，點擊後直接進入原本的編輯流程；同時間只會展開一個收入／支出區塊、類別或商家。
*   展開中的商家列與其交易列表同樣接成一張連續卡片，相接方式與依類別彙整相同；因為只有交易明細一段內容，面板內不加分段小標。
*   統計頁所有展開明細（收入／支出總額、類別、商家）的交易時間只顯示 `MM-dd` 月日，把橫向空間留給交易名稱；完整的 `yyyy-MM-dd HH:mm` 保留在該元素的 title 與 aria-label。年份脈絡由頁面上方的期間標題提供。同步狀態頁、同步紀錄、Tag 管理與商家管理仍顯示完整日期時間，首頁維持只顯示 `HH:mm`。

### 6.8 PWA / iOS 離線模式
*   專案現在會在 production build 產生 Service Worker，precache app shell、manifest 與 icon 資產。
*   GitHub Pages 部署路徑固定為 `https://rexx.github.io/Cozy-Pocket/`，Vite `base` 與 manifest `id/scope/start_url` 已對齊此路徑。
*   iOS Safari 首次上線開啟後，可透過「加入主畫面」安裝；之後離線仍可開啟 app 與操作本機資料。
*   離線模式下可瀏覽、新增、編輯、刪除交易；雲端同步與 AI 解析暫停。
*   iOS standalone PWA 目前**不要**使用 `viewport-fit=cover`，也**不需要** `env(safe-area-inset-*)`；版面用常數 padding，不用 `env()` 補償。
*   Service worker 用 `autoUpdate`，換版時沒有任何提示。要確認 PWA 是否已換到新的 build，看「資料與設定」頁最底部的建置識別——其中的 commit 與 build 時間每次部署都會變。
*   離線實作與修改重點說明請見：[PWA Offline Implementation](docs/pwa-offline-implementation.md)
*   詳細排版注意事項請見：[PWA Layout Gotchas](docs/pwa-layout-gotchas.md)

### 6.9 輸入建議排序
*   新增／編輯記帳時，`merchant`、`name`、`tags` 會根據歷史交易產生建議 chips。
*   建議來源來自目前本機已載入的 `transactions`，不另外建立建議資料表。
*   每個建議值會累積出現次數、最近使用時間、曾出現過的主類別與子類別；最近使用時間只計入不晚於現在的交易，記到未來日期的交易不算進「最近使用」（時間統一以 epoch 秒比較）。
*   `merchant`、`name` 的建議排序優先序為：字串 match、子類別 match、主類別 match、頻率，最後才用最近使用時間與字串穩定排序做 tie-break。
*   `tags` 的建議排序優先序為：字串 match、最近使用時間（新到舊），再用頻率與字串穩定排序做 tie-break；不考慮類別／子類別 match，讓最近在記的 tag 排最前。
*   未命中目前輸入字串的項目仍會保留在後方；`tags` 已存在於當前 `tagList` 的值會排除，避免重複加入。
*   點建議 chip 不會讓對應輸入框失焦，因此不會觸發 tag 輸入框在失焦時提交的行為。
*   點 tag 建議會取代未確認的輸入片段：只加入點到的建議，已輸入但尚未確認的字串會被丟棄，輸入框清空並保持 focus。
*   按 Enter、以空格分隔輸入，或直接點畫面其他區域讓輸入框失焦時，未確認的片段仍照舊被提交成 tag。

### 6.10 Tag 管理
*   「資料與設定」改為獨立頁面，從首頁右上角進入，左上角返回首頁。
*   「資料與設定」頁提供 Tag 管理區塊，可查看目前所有 tag 與各自使用筆數。
*   Tag 清單依使用筆數由多到少排序，同筆數時依 tag 名稱的 code point 順序排列，與 `tags` 欄位的儲存順序使用同一套比較規則。
*   尚未選擇 tag 前，只顯示 tag 清單；輸入區與操作按鈕會先隱藏。
*   選擇 tag 後，會在同一區塊列出該 tag 的所有交易，並可直接點進既有編輯流程。
*   Tag 管理支援三種操作，共用同一個 preview 與確認流程：更名（一個新 tag）、拆分（多個新 tag）、移除（不指定新 tag）。
*   「新的 Tag」輸入框可用空白分隔多個 tag。輸入 `Ipass 永豐` 會解析成 `Ipass` 與 `永豐` 兩個獨立 tag token，不是名稱含空白的單一 tag；preview 會將它們顯示為個別 chip。
*   移除入口是「預覽影響筆數」右側的方形垃圾桶按鈕，點下去直接產生移除 preview，不需要額外的確認步驟按鈕。
*   preview 卡與確認按鈕只有一組，外觀依操作切換：更名／拆分為黃色卡加綠色確認鈕，移除為紅色卡加紅色確認鈕。移除的確認鈕文案會帶上目標 tag 名稱。
*   移除 preview 會顯示受影響交易筆數、移除後不再有任何 tag 的交易筆數，以及「只移除 tag，不會刪除交易」的說明。
*   所有操作都必須先預覽才會出現確認按鈕；預覽顯示的是「受影響交易筆數」，不是 tag token 次數。
*   更名、拆分與移除都採精確 token 比對，只處理完整相同的 tag，不做模糊字串取代。
*   輸入時會自動正規化 tag：去除前後空白，並移除前置 `#`。輸入內容正規化後為空（例如只輸入 `#`）會被擋下並提示輸入新的 tag 名稱，不會被當成移除。
*   輸入框內容變更後會清除既有預覽，預覽卡與確認按鈕同步消失，避免舊預覽套用到新輸入值。
*   若新 tag 名稱已存在，預覽卡會先提醒；確認後會合併為同一個 tag，並自動去除重複 tag。
*   預覽錯誤與合併警告會顯示在與商家管理相同樣式的 feedback card 位置，依狀態使用紅色或黃色，不使用獨立警告 icon；更名全部成功時只顯示底部 toast（含更新筆數），拆分與移除則在頁內保留結果訊息。
*   送出中會顯示旋轉 loading icon，並在操作完成前保留整個 tag 詳情面板，避免本機寫入完成、同步尚未結束時面板提前收合。
*   更名完成後會直接選到新 tag 或合併目標 tag，相關交易列表跟著重新載入；拆分與移除完成後會清除選取，並把畫面捲回區塊頂端顯示結果訊息。
*   合併、更名、拆分或移除後，該筆交易的 `tags` 會由 `joinTags()` 重新序列化：正規化、去除重複，並依 code point 排序，最後標記為 `pending` 以便後續同步。移除最後一個 tag 的交易會保留下來，`tags` 寫成空字串。
*   同步部分失敗時 feedback card 會附帶「查看同步狀態」按鈕，可直接跳到同步狀態頁，返回時回到 Tag 管理子頁。
*   tag 名稱目前仍區分大小寫，例如 `food` 與 `Food` 會視為不同 tag，也不會互相去重。

### 6.11 商家管理
*   商家名稱目前仍保存在每筆交易的 `merchant` 欄位中，商家更名會以批次更新交易的方式完成。
*   「商家管理」已整併為「資料與設定」內的設定子頁，從設定首頁的商家入口卡片進入，返回時回到設定首頁。
*   商家清單支援即時搜尋，並預設每次顯示 200 個商家，可用「載入更多」展開後續項目；商家清單與相關交易列表高度最多佔視窗高度一半，超過時在各自列表內捲動。
*   更名前需先執行預覽，確認受影響交易筆數；確認按鈕只會在有效預覽後顯示。
*   預覽錯誤、預覽資訊與合併警告會顯示在同一個 feedback card 位置，依狀態使用紅色或黃色樣式；新名稱輸入變更後會清除既有預覽與錯誤；更名全部成功時只顯示底部 toast（含更新筆數），不再顯示綠色完成卡。
*   若新商家名稱已存在，系統會先提醒；確認後會合併到既有商家，不會新增重複商家。
*   商家更名會一次更新所有符合舊名稱的交易，並將這些交易標記為 `pending` 以便後續同步。
*   更名送出中會顯示旋轉 loading icon；完成後表單會保留並直接選到新商家或合併目標商家。
*   更名完成後，既有交易列表、搜尋結果、統計頁內容與同步 payload 都會反映新名稱或合併後名稱。
*   商家名稱會移除前後空白並合併連續空白；商家分組、查詢與更名影響範圍使用正規化後的大小寫不敏感 key 比對，顯示與寫回仍保留既有名稱或使用者輸入的正規化名稱。

### 6.12 設定頁區段化
*   `SettingsPage` 目前作為設定 container，支援設定首頁與設定子頁，不使用 tabs。
*   設定首頁只保留入口卡片；`PreferencesSection`、`AiSection`、`SyncSection`、`TagManagementSection`、`MerchantManagementSection`、`ImportExportSection`、`DangerZoneSection` 由各自設定子頁呈現。
*   `App.tsx` 以 `settings-preferences`、`settings-ai`、`settings-sync`、`settings-tags`、`settings-merchant`、`settings-import-export`、`settings-danger` 等 view 管理設定子頁導覽與 history state。
*   `SettingsPage` 會依設定子頁顯示置中的頁面副標題，並用與入口圖示一致的背景 glow。設定子頁內容使用玻璃感功能子卡牌，不再額外包一層重複標題的外框卡牌。
*   設定首頁與設定子頁標題／副標題共用 `components/settings/settingsSectionCopy.ts`，避免入口卡片與子頁文案分歧。
*   `PreferencesSection` 會分成「Payment Method Display」、「Home Navigation Buttons」、「Error Banner (Debug)」與「Currency Options」四張功能子卡牌；支付方式支援文字／圖示切換，首頁左右導覽按鈕支援顯示／隱藏切換（預設顯示），錯誤訊息紅色區塊支援顯示／隱藏切換（預設隱藏），幣別清單預設直接展開。
*   `AiSection` 會顯示 Gemini API key 設定狀態；清空欄位後儲存即可移除本機 API key。
*   `ImportExportSection` 與 `DangerZoneSection` 的子卡牌標題區不放圖示，圖示只放在實際操作按鈕上；其他設定子頁主要操作按鈕也維持 icon + label 呈現。
*   設定 container 仍集中管理 Dexie 讀寫、CSV 解析與匯入匯出、同步觸發等資料流程，並以 callback 提供給各設定子頁；不再保留共用的 status state 或底部統一的訊息渲染。
*   各區段元件不直接操作資料庫或同步服務（透過 container callback 觸發），但各自視情況以 `useState` 自管 inline status 訊息：全部成功時只顯示底部輕量 toast（不重複顯示頁內卡片，`PreferencesSection` 因此完全不再持有 inline status state）；離線待同步、部分同步失敗或需要後續行動（例如查看同步狀態）時才顯示頁內 status 卡片；驗證錯誤與例外仍固定顯示頁內錯誤卡片。切換子頁時前一頁訊息隨子頁卸載而消失。
*   設定子頁的 inline 回饋共用 `components/settings/SettingsFeedbackCard.tsx`（`SettingsFeedbackCard` 卡片 + 包裝 `SettingsStatus` 的 `SettingsStatusCard`），success／error／warning 對應綠／紅／黃樣式；`TagManagementSection` 與 `MerchantManagementSection` 的預覽卡與狀態卡也改用此共用元件。
*   `SyncSection` 另外自管年度雲端同步 dialog 的開關、選取年份與送出 state（dialog markup 已移入該子頁）；`TagManagementSection` 與 `MerchantManagementSection` 另外自管各自的更名流程 state。
*   年度雲端同步完成後會導航到「同步紀錄」頁（`SyncSection` 隨即卸載），無論成功、部分失敗或失敗都改以底部 toast 呈現結果摘要，詳細報告內容改看同步紀錄頁本身；選擇年份前的驗證錯誤與同步前拋出例外仍在 `SyncSection` 內顯示頁內錯誤卡片。
*   `TagManagementSection` 與 `MerchantManagementSection` 各自以 `useState` 持有選取的 tag／商家、新名稱輸入、預覽結果、送出狀態、相關交易與 inline status；container 只透過 props 傳入資料來源與 preview／replace 或 rename／get-transactions／`onDataChange`／`onOpenSyncProgress` 等 callback，不再保留這兩條流程的 state 或 handler。Tag 的兩個 callback 為 `onPreviewTagReplacement` 與 `onReplaceTag`，兩者都接受 replacement tag 陣列，空陣列即代表移除。
*   這兩個更名子頁的選取與預覽 state 與「目前開啟的子頁」綁定；切換到其他設定子頁再返回時子頁會重新掛載，選取與預覽會重置為初始狀態（刻意行為）。
*   匯入與匯出已整併在同一個 section 中，共四張子卡牌：交易 CSV 匯出／匯入，以及設定 JSON 匯出／還原（見 6.13）；危險操作區則集中清除本機資料、以及範例資料的插入與刪除（依 `sample-tx-` id prefix 辨識可刪除範圍）。
*   `ImportExportSection` 的設定備份／還原直接呼叫 `services/settingsBackupService.ts`，不經過 `SettingsPage` container；CSV 兩條流程仍由 container 提供 callback。
*   設定首頁會顯示目前 tag 數量與商家數量；商家數量直接取自已載入交易計算的商家用量摘要（`MerchantUsageSummary`），不額外讀取 IndexedDB。
*   商家管理已整併為 `SettingsPage` 的正式設定子頁，與 Tag 管理等其他子頁共用設定首頁卡片、子頁 routing 與返回行為。

### 6.13 設定備份與還原

**偏好的儲存位置**

*   所有設定與偏好都存在 Dexie `settings` 表：`defaultCurrency`、`enabledCurrencies`、`paymentMethodDisplayMode`、`homeNavArrowsVisible`、`errorBannerVisible`、`homeCalendarViewMode`、`statsExcludedSubCategoryKeys`、`geminiApiKey`、`syncApiUrl`、`syncToken`。
*   正常使用路徑不會往 `localStorage` 寫入任何設定。唯一還在使用 `localStorage` 的是 `mock://cloud-sync` 假後端的狀態 key（`cozy-pocket.mock-cloud-sync.v1`），以及危險操作的 `localStorage.clear()`。
*   `homeCalendarViewMode` 與 `statsExcludedSubCategoryKeys` 原本存在 `localStorage`。`preferences.ts` 的 `migrateLegacyLocalStoragePreferences()` 會在開機讀設定前執行一次性遷移：`settings` 已有該 key 就跳過（既有值永遠優先），寫入成功後才刪除 `localStorage` 原值，中途失敗時原值仍在、下次開機重試。
*   兩者的寫入都由 change handler 負責而非 `useEffect`：effect 會在 mount 時一併觸發，與開機讀取形成 race，把預設值寫回去蓋掉已存的偏好。

**備份檔**

*   交易與設定分成兩個檔案：交易走既有的 `cozy_pocket_backup_YYYYMMDD.csv`，設定走新的 `cozy_pocket_settings_YYYYMMDD.json`。
*   JSON 結構為 `schemaVersion`（目前 1）、`exportedAt`（ISO 8601）、`dbVersion`（Dexie schema 版本）、`settings`（`{ key, value }` 陣列），另有選配的 `pullReports`。
*   匯出時整張 `settings` 表 dump，不使用 key 白名單，日後新增的設定 key 會自動納入備份。
*   `geminiApiKey`、`syncToken`、`pullReports` 為三個獨立勾選框，**預設皆不勾**。前兩者是明文金鑰，勾選任一項時面板會顯示明文金鑰警告；`pullReports` 是同步稽核歷史而非設定。

**還原**

*   選檔後先顯示預覽（匯出時間、設定項目數、同步紀錄筆數、是否含 Gemini key 與同步憑證），確認後才寫入。
*   還原語意為 merge：`db.settings.bulkPut()` 只覆蓋檔案內有的 key，檔案沒帶的 key 保持現值，因此不含金鑰的備份不會清掉本機已設定的金鑰。
*   檔案含同步憑證時，確認對話框會轉為 danger tone 並額外說明本機將改用備份中的雲端端點與 token。
*   `schemaVersion` 比目前支援版本新時直接擋下，不嘗試套用；JSON 解析失敗、缺少 `schemaVersion`、或內容沒有任何可還原項目時，各自給出可讀的錯誤訊息且不寫入資料。格式不符的個別項目會被丟棄並計入預覽的「略過無效項目」。
*   偏好在開機時讀入 React state，因此還原成功後會詢問是否立即重新載入；選擇稍後則以頁內 status 卡片提示需重新載入才會套用。

### 6.14 統計頁月趨勢圖
*   趨勢分頁以堆疊長條圖呈現近 12 個月，橫軸最後一格為期間卡片上選定的月份，往前推 12 個月為一個滾動視窗。
*   視窗內每個月都有一格，**沒有交易的月份畫成 0 而不是略過**。略過會壓縮橫軸間距，把「那個月沒花錢」畫成「那個月不存在」。
*   一次只畫支出或收入，卡片內以 segmented control 切換，預設支出。收入與支出的量級通常差一個數量級以上，共用同一個 Y 軸會把支出壓成貼底的一條線。
*   幣別與總覽一致，一個幣別一張卡片、一張圖，不做跨幣別換算。
*   堆疊順序取「近 12 個月總額由大到小」，總額大的疊在下面，且整張圖共用同一組順序。若改成每個月各自排序，同一個顏色會在相鄰長條之間上下跳動，堆疊圖賴以閱讀的「同一色帶的厚度變化＝該類別的走勢」就不成立。
*   類別顏色沿用 `constants.ts` 的分類顏色，與依類別彙整區塊一致。
*   Y 軸上緣進位到 1 / 1.5 / 2 / 2.5 / 3 / 4 / 5 / 7.5 / 10 乘以 10 的次方的刻度，讓格線落在整數上；整條軸統一單位，最大值達到一萬以上時全部以「萬」顯示，否則全部用千分位，不在相鄰刻度之間混用。
*   圖上有一條月均虛線，數值由下方的月均卡片承接，線上不另外標字，避免在手機寬度下壓到長條。
*   點選任一月份的長條會在圖下方顯示該月總額與分類明細；預設聚焦視窗最後一個月，切換月份、幣別或收支類型時重設回最後一個月。
*   分類明細有 `單月` 與 `近 12 月` 兩個數值欄，並以「顯示所有類別」按鈕在兩種形狀之間切換。這張表同時是堆疊圖的圖例——色塊、類別名稱與視窗總額都在這裡，圖表底部沒有另一排圖例 chip。
*   收合形狀只列當月有金額的類別，最多 5 列，其餘併為「其他 N 個類別」（該列兩欄分別是被折疊類別的當月合計與視窗合計），依**單月金額**由大到小排序，所以被折疊掉的是當月最不相關的項目。
*   展開形狀列出視窗內全部類別，當月沒有的單月欄顯示 0 並降低文字與色塊的明度，依**近 12 月總額**由大到小排序，也就是堆疊順序，這才是解讀色帶需要的對照。展開時不套用 5 列上限：0 值項目必然排在金額末端，沿用上限會讓它們全部被折疊，切換就失去意義。
*   兩個數值欄不帶幣別符號，只用千分位並以 `tabular-nums` 右對齊；卡片標題與上方的單月總額已標明幣別，每列付兩次符號會在 iPhone 寬度吃掉類別名稱的空間。這與三格摘要既有的做法一致。
*   「顯示所有類別」是顯示偏好而非資料選取，切換月份與收支類型都不重設，只在離開趨勢分頁（component unmount）或重新載入時歸零。
*   支出與收入各有 10 個主類別，所以展開形狀最多 10 列。收合形狀恆為最多 6 列，兩者的高度差取決於視窗有幾個類別、當月又佔其中幾個：視窗滿 10 個類別時實測多 88px（單列 pitch 22px），視窗類別數不超過當月已列出的數量時高度不變。
*   圖下方三格摘要為月均、最高月與較上月。金額使用與 Y 軸相同的精簡格式且不帶幣別符號（卡片標題已標明幣別），月份與對比基準放在各自的說明次行；三格在 iPhone 寬度下每格只有約 74px 文字空間，把月份與金額擠在同一行必定截斷。
*   圖表沒有自己的類別開關：縮小圖表資料集的唯一入口是篩選面板的類別篩選（§6.6），它改變整頁的資料集，跨分頁保留，也影響總覽的彙整與明細。分類明細與長條會一起收斂到篩選後的類別。
*   圖區空狀態只有兩種：該幣別在視窗內完全沒有該類型的紀錄時顯示「近 12 個月沒有<類型>紀錄」；有紀錄但金額全為 0 時顯示「近 12 個月的<類型>金額都是 0」。金額為 0 時月份摘要與三格數字卡一併收起，不顯示沒有意義的 0。
*   圖表為手刻 SVG，以 `viewBox` 自適應寬度，不量測容器尺寸、不引入圖表套件。聚合邏輯在 `services/statsService.ts` 的 `getMonthlyTrend()`，屬唯讀計算；繪製在 `components/stats/MonthlyTrendChart.tsx`。

---

## 7. 如何運行
1. `npm install`
2. `npm run dev`
3. 開啟 `http://localhost:5173/Cozy-Pocket/`（Vite `base` 固定為 `/Cozy-Pocket/`，根路徑不會載入 app）
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

### App icon 產出流程

`public/` 底下的 icon 全部由 `public/icon.svg` 這一份來源產生，不要手動編輯產出檔：

1. 改 `public/icon.svg`
2. `npm run icons:generate`
3. 把重新產出的檔案一起 commit（GitHub Pages 部署不會跑這個步驟）

`favicon.ico` 與 maskable 版也都從同一份 SVG 產出，所以造型只有一個地方要改。產出時會印出兩個檢查：`icon-maskable-512.png` 的 ink 半徑有沒有超出 Android 的安全圓（這條是硬規格），以及 `apple-touch-icon.png` 的空腔內周長（這條是**指紋不是門檻**，只用來偵測造型有沒有偏離已在真機驗證過的那一版）。

**改 `icon.svg` 前先讀 [App icon 與 iOS 26 Liquid Glass](docs/app-icon-ios-liquid-glass.md)。** 重點只有一條：`apple-touch-icon.png` 必須是透明底，除此之外**沒有任何可以先算的判準能預測 iOS 26 會不會套用 Liquid Glass**——透明比例、留白、空腔面積、內周長、元件數、顏色全部試過並被真機推翻。所以改造型後一定要上機看（深色背景 = 有效，純白 = 失效）。那份文件記了所有死掉的假說，避免重跑。

1. 在首頁底部點擊本月摘要卡
2. 在統計頁上方切換 `月份` 或 `年份`
3. 使用左右箭頭切換目前期間
4. 視需要按篩選鈕（漏斗）選擇 `tag`、支付方式或類別
5. 點擊收入或支出卡片展開符合條件的交易列表
6. 點擊「依類別彙整」標題列展開區塊，再點擊類別列查看子類別摘要與該類別交易列表
7. 點擊「依商家彙整」標題列展開區塊，再點擊商家列查看該商家的交易列表
8. 點擊列表項目可直接編輯該筆交易

---

## 8. 重置本機資料 (Local Storage / IndexedDB)

App 內建重置按鈕：

1. 右上角進入「資料與設定」
2. 進入「危險操作」設定子頁
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
