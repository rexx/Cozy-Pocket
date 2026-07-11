# 資料風險分區與 Guardrail（data-risk-guardrails）

## 摘要

2026-07-03 對全 codebase 做了一次資料風險 review，結論是：本專案的資料安全模型是「local-first + 雲端 upsert-only 備份」——雲端（Google Sheets）永遠不會被程式刪列或清空、pull 也永遠不刪本地列，因此永久遺失風險集中在「尚未同步成功的本地資料」與少數靜默污染路徑。本計劃把 review 結論固化為三層 guardrail：文件層（AGENTS.md 紅區清單）、程式層（payload 型別上鎖、GAS 欄位索引派生、重置確認強化、CSV 匯入驗證對齊）、測試層（紅區純函式最小單元測試）。

各 Step 彼此獨立、可分批 land，符合「小 diff、可 review」原則。Steps 1–2 是純文件與純型別變更、無瀏覽器可驗證表面，已直接在 `main` 上完成；剩餘 Steps 3–6 動到 runtime / GAS / 相依套件，建議走 `worktrees/data-risk-guardrails`。

## 進度

- ✅ **Step 1（AGENTS.md 紅區清單）** — commit `ff57658`。
- ✅ **Step 2（同步 payload 型別上鎖）** — commit `ff57658`。實作與原計劃唯一差異：`SyncPayloadItem` 用 `type` alias 而非 `interface`——interface 不能賦值給 `prepareMockPullFixture` 回傳的 `Record<string, unknown>`（TypeScript issue #15300），封閉物件型別的 `type` alias 則可，且明確回傳型別註記照樣對 `toPayloadItem` 物件字面量做 excess-property 檢查。已驗證：暫加 `syncStatus` 欄位時 tsc 報 `TS2353`。
- ⬜ **Steps 3–6** 待辦（GAS 欄位索引派生、重置確認顯示未同步筆數、CSV 匯入驗證對齊、紅區純函式單元測試）。

## 風險分區結論（本計劃的依據）

判斷一段程式碼屬於哪一區的三個問題：(1) 會不會寫入 `transactions` 表或 Google Sheet？(2) 會不會影響同步 merge 的勝負判定（version / updatedAt / payload 比較）？(3) 是不是破壞性操作的防線（確認對話框、id 前綴過濾、mock 分流判斷）？三題皆否即綠區。

### 紅區（改錯 = 永久遺失或難以還原）

| # | 位置 | 風險 |
|---|---|---|
| R1 | `services/cloudSyncService.ts` `compareLocalAndCloud`（954-968）+ pull merge 的 `db.transactions.put`（1245） | merge 判錯方向時本地未同步編輯被雲端整筆覆寫，無備份。967 行的 tie-break（version 與 updatedAt 皆同但內容不同時雲端無條件勝出）是刻意決策（commit `9a39ee3`） |
| R2 | `services/cloudSyncService.ts` `toPayloadItem`（181-197） | GAS 以欄位名稱取值，欄位改名或漏傳不報錯、只讓雲端備份被寫入空值——靜默污染最後一道救援管道 |
| R3 | `docs/google-apps-script-phase1.js`：`SHEET_HEADERS` 順序、`loadRecordMap`（266-267 的 `row[13]`/`row[14]`）、`resolveSyncDecision`（303-310） | 寫入端用欄位順序組 row array、讀取端用寫死 index，雙重維護無檢查；upsert 判斷改錯會讓雲端被舊資料覆寫。此腳本目前沒有任何 clear/deleteRow，這個不變量不可打破 |
| R4 | `db.ts` 既有 Dexie schema version | 改動已出貨的 version stores 會損毀使用者本地 DB；只允許新增 version + additive migration |
| R5 | `components/SettingsPage.tsx` `commitImport` overwrite 模式（351 的 `db.transactions.clear()`）與 `resetLocalData`(358-361) 及其周邊確認流程 | 全 app 僅有的兩個全清操作；確認流程是唯一防線。重置連 sync 憑證一起清掉，未同步交易永久遺失 |
| R6 | `App.tsx` 交易 id 生成（628-634）與編輯 handler 的 version/updatedAt 遞增 | id 是跨裝置與雲端的身分識別；生成或遞增改錯會在 merge 時造成無聲覆蓋 |
| R7 | `time.ts` `toEpochSeconds`（秒 vs 毫秒不變量） | 把關所有寫入邊界；改錯後毫秒值會同步上雲污染備份，雲端無自癒機制 |

紅區共同特徵：錯誤靜默（不 throw、build 綠）、後果延遲顯現（下次 sync/pull 才爆）、`tsc --strict` 抓不到。

### 橘區（改錯 = 損毀或污染，但技術上可救）

刪除路徑的過濾條件（`sample-tx-` 前綴等）、合併型更名（willMerge 不可逆）、CSV 匯入弱驗證、`prepareMockPullFixture` 直接寫真實 Dexie 表（靠 `mock-demo-*` 前綴隔離）、範例資料上雲污染、`dialogService` 確認語意。

### 綠區（放心改）

純呈現元件、`statsService` / `analyticsService` 等唯讀計算、偏好設定與 localStorage 內容、`networkService`（判斷錯的後果是同步 skip，fail-safe 方向）、Gemini 解析（只預填表單，有人工確認）、pullReports 顯示層。綠區不等於無規則——PWA layout 有自己的 gotchas 文件，屬另一維度。

### 既存設計缺口（不在本計劃範圍，見「不在範圍」）

刪除無 tombstone（已同步交易刪除後會從雲端復活）、交易 id 純 `Date.now()` 無隨機成分（跨裝置同毫秒碰撞）、GAS 無 LockService（多裝置並發 append 可互相覆蓋）、merge 邏輯有三份平行實作（前端 / GAS / mock）會 drift。

## 關鍵變更

### Step 1 — 文件層：AGENTS.md 紅區清單

- 在 AGENTS.md「What NOT to touch without strong reason」之後新增「Data-risk zones」小節：紅區清單（R1–R7，含檔案與函式名，行號不寫死）、三問判準、以及修改紅區的最低要求（人工 review diff + mock sync 手動驗證一輪 push / pull / 衝突）。
- 補記「Google Sheets 版本歷史（File → Version history）是雲端污染事故的最後救援管道」——目前無任何文件提及。
- 同步更新 README §6 若有對應段落（預期只有 AGENTS.md 需要動）。

### Step 2 — 程式層：同步 payload 型別上鎖

- 在 `types.ts` 定義 `SyncPayloadItem`（`type` alias，理由見「進度」）：15 個具名欄位（id, type, amount, currency, categoryId, subCategoryId, name, merchant, note, timestamp, readableDateTime, paymentMethod, tags, updatedAt, version），明確不含 `syncStatus` / `lastSyncError`。
- `toPayloadItem` 回傳型別改為 `SyncPayloadItem`。此後多傳、漏傳、改名欄位都會被 `tsc --strict` 攔下，把 R2 的錯誤形式從「靜默」變成「編譯失敗」。
- 純型別變更，不改 runtime 行為，payload 內容不變。

### Step 3 — 程式層：GAS 欄位索引派生化

- `docs/google-apps-script-phase1.js` 中 `loadRecordMap` / `processGetItems` 的 `row[13]`、`row[14]` 等寫死 index，改由 `SHEET_HEADERS.indexOf(...)` 派生的常數取得（例如 `const COL_UPDATED_AT = SHEET_HEADERS.indexOf('updatedAt')`），消除欄位順序的雙重維護。
- 行為不變（index 值相同），但之後調整 `SHEET_HEADERS` 只需改一處。
- 部署注意：此檔是 GAS 的 source of truth，改完需由使用者手動重新部署 GAS 並以真實 Sheets 驗證（與 `manual-cloud-pull.md` 的待部署項可合併一次部署）。

### Step 4 — 程式層：重置確認強化

- `resetLocalData` 的確認框（`DangerZoneSection.tsx` `handleResetLocalData`）在文案中顯示未同步筆數：查 `transactions` 表中 `syncStatus !== 'synced'` 的數量 N，N > 0 時顯示「其中 N 筆尚未同步，清除後永久遺失」。
- 同時提示 sync 設定（GAS URL / token）也會被清除，救回資料前需重新設定同步。
- 不改 `resetLocalData` 本體行為，只強化防線資訊量。自動先匯出 CSV 的方案先不做（多一步網路無關的檔案下載在 iPhone PWA 上體驗待驗證），列為候選後續。

### Step 5 — 程式層：CSV 匯入驗證對齊 pull

- `parseImportFile`（`SettingsPage.tsx`）目前只驗 `!isNaN(amount) && !isNaN(timestamp)`；比照 `normalizePullItem`（`cloudSyncService.ts`）的驗證強度：type 必須是 支出/收入、categoryId 非空、paymentMethod 非空，並將 `parseInt('')` 產生的 NaN `updatedAt` / `version` 正規化為 undefined 或 0。
- 被拒收的列不進 DB，於匯入預覽回報「略過 N 筆格式不符（行號清單）」。
- 抽驗證邏輯時注意與 `settings-page-decomposition.md` 計劃的 `services/csvService.ts` 方向一致：若該計劃先行，驗證放進 csvService；若本計劃先行，先放 `SettingsPage.tsx` 內的獨立函式，之後隨 decomposition 搬移。

### Step 6 — 測試層：紅區純函式最小單元測試

- 引入 `vitest`（devDependency），新增 `npm run test` script；CI（`.github/workflows/deploy.yml`）是否加 test step 由使用者決定，預設先不加、僅本地執行。
- 測試對象限紅區純函式：`compareLocalAndCloud`、`toEpochSeconds`、`toPayloadItem`、`splitTags` / `joinTags`。不做 UI 測試、不做 component 測試——「零測試」原則僅對紅區純函式破例，理由是這些函式錯了最痛且 `tsc` 抓不到。
- `compareLocalAndCloud` 目前未 export，需加 export（或以 `export const __internals` 模式暴露給測試）。
- 同步更新 AGENTS.md「Quality gates」段落，記錄此例外與範圍。

## 介面與型別

```ts
// types.ts — upload payload contract with the deployed GAS backend.
// Field names are load-bearing: GAS reads them by name. syncStatus and
// lastSyncError are local-only and must never appear here. A type alias (not
// an interface) so it stays assignable to the pull path's Record<string, unknown>.
export type SyncPayloadItem = {
  id: string;
  type: TransactionType;
  amount: number;
  currency: string;
  categoryId: string;
  subCategoryId: string;
  name: string;
  merchant: string;
  note: string;
  timestamp: number; // epoch seconds
  readableDateTime: string;
  paymentMethod: string;
  tags: string;
  updatedAt: number; // epoch milliseconds
  version: number;
};
```

（欄位的空字串預設以現行 `toPayloadItem` 實際輸出為準；Step 2 實作已逐欄對照確認，未改變輸出內容。）

CSV 匯入驗證函式簽名（暫置 `SettingsPage.tsx`，將來隨 decomposition 移入 csvService）：

```ts
interface ImportRowValidationResult {
  valid: Transaction[];
  rejected: { rowNumber: number; reason: string }[];
}
const validateImportRows = (rows: Transaction[]): ImportRowValidationResult => { ... };
```

## UI 細節

- 重置確認框：維持現有 `confirmAction` danger tone；文案由靜態改為動態組字，例如「這會清除 Local Storage 與 IndexedDB 的所有資料，且無法復原。其中 12 筆交易尚未同步，清除後永久遺失；同步設定（URL 與 token）也會一併清除。」N = 0 時維持接近現行文案。
- 匯入預覽卡：在既有的重複 id 警告旁增列「略過 N 筆格式不符」，展開可見行號與原因；沿用 `SettingsFeedbackCard` 樣式。
- Step 1 / 2 / 3 / 6 無 UI 變更。

## 測試計劃

- 每個 Step 完成後跑 `npm --prefix worktrees/data-risk-guardrails run build`（tsc strict + Vite build）。
- Step 2：刻意在 `toPayloadItem` 加一個 `syncStatus` 欄位驗證 tsc 會報錯，確認上鎖生效後移除。
- Step 3：GAS 為純 JS、無 tsc 保護，改完後人工 diff 對照 index 值不變；使用者重新部署後以真實 Sheets 跑一次年度同步驗證。
- Step 4 / 5：`mock://cloud-sync` 手動驗證——插入含 pending 交易後開重置確認框看筆數；準備一份含畸形列（空 category、錯誤 type、空 paymentMethod、重複 id）的 CSV 驗證拒收與回報。
- Step 6：`npm run test` 全綠；重點 case——`compareLocalAndCloud` 的 version 勝出 / updatedAt 勝出 / tie 時 cloud 勝出三分支、`toEpochSeconds` 的秒毫秒閾值邊界（1e12 前後）、`toPayloadItem` 不含 syncStatus、`splitTags` 的多空白與 `#` 前綴、`joinTags` 去重。
- 瀏覽器驗證依標準流程等待 `/start-local-server`。

## 不在範圍（設計缺口，另行開票）

- 刪除 tombstone（本地刪除同步到雲端，消除復活問題）
- 交易 id 加隨機後綴（跨裝置同毫秒碰撞）
- GAS `LockService`（多裝置並發 append 互相覆蓋）
- 範例資料改為不上雲
- merge 邏輯三份實作的收斂（前端 / GAS / mock 共用決策表）

## 假設

- 「零測試」原則僅對紅區純函式破例；vitest 只測 pure function，不引入 jsdom / testing-library。
- GAS 重新部署由使用者手動執行；Step 3 在部署完成前，repo 內檔案與線上 GAS 會短暫不一致（僅重構、行為相同，風險可接受）。
- Step 5 的驗證邏輯位置以「不與 `settings-page-decomposition.md` 衝突」為原則，兩計劃誰先動誰先搬。
- 行號會隨程式演進漂移；AGENTS.md 紅區清單只寫檔案與函式名，本計劃書內的行號為 review 當下（2026-07-03, commit `8368c47`）的快照。
