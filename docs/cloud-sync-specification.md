# 雲端同步規格 (Cloud Sync Specification)

## 1. 範圍與決策
- 同步模式：**Phase 1.5（個人用 / Simple Token）**。
- 功能範圍：`create + sync + 手動年度雲端同步`。
- `id` 來源：**前端產生並送出**。
- 本次不做：`get/update/delete`、`keepalive`、`Service Worker Background Sync`、OAuth。
- 離線策略：**核心記帳可離線，雲同步不在離線時強行送出**。

## 2. 目前本地資料模型（以程式碼為準）

### 2.1 TypeScript `Transaction`
來源：[types.ts](/Users/gtso/Downloads/ai-studio/cozy-pocket/Cozy-Pocket/types.ts)

```typescript
export interface Transaction {
  id: string; // Date.now() 產生的毫秒字串 ID
  type: '支出' | '收入';
  amount: number;
  currency: string;
  categoryId: string;
  subCategoryId?: string;
  name: string;
  note?: string;
  timestamp: number; // Epoch seconds（交易時間）
  readableDateTime?: string; // yyyy-MM-dd HH:mm（人類可讀）
  paymentMethod: string;
  merchant?: string;
  tags?: string;
  updatedAt?: number; // Epoch milliseconds（最後更新時間）
  version?: number;
  syncStatus?: 'pending' | 'syncing' | 'synced' | 'error'; // 本地同步追蹤狀態
  lastSyncError?: string; // 最近一次同步錯誤訊息（本地欄位）
}
```

- `syncStatus`、`lastSyncError` 為前端本地追蹤欄位，用於 UI 顯示與補送流程。
- 這兩個欄位目前不寫入 Google Sheets，也不包含在 API `items[]` payload 中。

### 2.2 Dexie 結構
來源：[db.ts](/Users/gtso/Downloads/ai-studio/cozy-pocket/Cozy-Pocket/db.ts)

```typescript
this.version(1).stores({
  transactions: '++id, timestamp, categoryId, type, currency',
  settings: 'key'
});
```

### 2.3 既有 `id` 實作
來源：[App.tsx](/Users/gtso/Downloads/ai-studio/cozy-pocket/Cozy-Pocket/App.tsx)

- 前端新增交易時以時間戳字串產生 `id`：`(Date.now() + attempts).toString()`。
- 若遇到主鍵衝突會重試（最多 10 次）。

## 3. 雲端儲存模型（Google Sheets）
- 每年一個工作表（例如 `2026`, `2027`）。
- 欄位對應（MVP）：
  - `A: id`
  - `B: type`
  - `C: amount`
  - `D: currency`
  - `E: categoryId`
  - `F: subCategoryId`
  - `G: name`
  - `H: merchant`
  - `I: note`
  - `J: timestamp`（交易時間，Epoch seconds）
  - `K: readableDateTime`（人類可讀時間，`yyyy-MM-dd HH:mm`）
  - `L: paymentMethod`
  - `M: tags`
  - `N: updatedAt`（最後更新時間，Epoch milliseconds）
  - `O: version`（整筆版本號）

## 4. API 規格（Phase 1）

### 4.1 Endpoint
- `POST {apiUrl}`
- `Content-Type: application/x-www-form-urlencoded`（Simple Request，避免 CORS preflight）

### 4.1.a CORS 策略（GAS Web App）
- 背景：瀏覽器對 `application/json` `POST` 通常會先送 `OPTIONS` preflight；GAS Web App 常在 preflight/redirect 情境下導致前端無法讀取可用錯誤內容。
- 本專案策略：使用 **Simple Request**，避免 preflight。
- 前端實作：送出 `URLSearchParams`，欄位為 `payload=<JSON字串>`。
- 後端（GAS）實作：優先解析 `e.parameter.payload`，若無再回退解析 raw JSON（保留相容性）。
- 注意：`text/plain + JSON` 也是可行的 Simple Request 方案；本專案目前選擇 `form-urlencoded` 是為了表單相容性與參數解析可預期性。

### 4.1.1 API 路線圖（目前）
- **Phase 1**：`create`（POST）
- **Phase 1.5**：`get`（POST / by year，供年度雲端同步讀取雲端資料）
- **Phase 3**：`update`（POST）
- **Phase 4**：`delete`（POST）

### 4.1.2 Get Request Body（by year）
- 傳輸格式：`payload=<urlencoded JSON>`
- `payload` 內容（JSON）：
```json
{
  "token": "your_sync_token",
  "action": "get",
  "year": "2026"
}
```

- 一次只讀取單一年份。
- `year` 對應 Google Sheets 中的年份工作表名稱。

### 4.1.3 Get Response Body
```json
{
  "status": "success",
  "year": "2026",
  "items": []
}
```

- 若指定年份工作表不存在或沒有資料，回傳 `status: "success"` 且 `items: []`。

### 4.2 Request Body（create only）
- 傳輸格式：`payload=<urlencoded JSON>`
- `payload` 內容（JSON）：
```json
{
  "token": "your_sync_token",
  "action": "create",
  "items": [
    {
      "id": "1709000000000",
      "type": "支出",
      "amount": -100,
      "currency": "TWD",
      "categoryId": "food",
      "subCategoryId": "breakfast",
      "name": "早餐",
      "merchant": "便利商店",
      "note": "三明治",
      "timestamp": 1709000000,
      "readableDateTime": "2024-02-27 08:53",
      "paymentMethod": "現金",
      "tags": "早餐 便利商店",
      "updatedAt": 1709000000000,
      "version": 1
    }
  ]
}
```

- 單筆同步：`items` 只放 1 筆。
- 匯入同步：`items` 可放多筆（建議分批送，避免單次 payload 過大）。

### 4.3 Response Body
```json
{
  "status": "success",
  "results": [
    { "id": "1709000000000", "status": "success" }
  ]
}
```

```json
{
  "status": "success",
  "results": [
    { "id": "1709000000000", "status": "skipped", "message": "Already up-to-date" }
  ]
}
```

```json
{
  "status": "success",
  "results": [
    { "id": "1709000000000", "status": "success" },
    { "id": "1709000000001", "status": "error", "message": "Invalid amount" }
  ]
}
```

```json
{ "status": "unauthorized" }
```

```json
{ "status": "error", "message": "..." }
```

### 4.4 GAS 平台限制與回應約定
- GAS Web App 回應可能經過 Google redirect，瀏覽器端在非 200 或 CORS 條件下，可能拿不到可讀錯誤內容。
- 為了讓前端可穩定判斷錯誤，**本專案強制採用 200-Wrapping**：
  - API 一律回 `HTTP 200`。
  - 真正成功/失敗狀態放在 JSON body 的 `status` 欄位。
  - 錯誤情境也必須回傳可解析 JSON（不可只回 HTTP status）。
- 規範格式：
  - 成功：`{ "status": "success", ... }`
  - 失敗：`{ "status": "error", "message": "..." }` 或 `{ "status": "unauthorized" }`

### 4.5 前端回應解析規範
- 前端不得只以 `res.ok` 或 HTTP status 判斷同步成功。
- 每次同步都必須解析 response body JSON，並依 `status` 判斷結果。
- 當 `status !== "success"` 時：
  - 視為同步失敗。
  - 保留該筆為待同步狀態（不標記為完成）。
  - 顯示可見的錯誤提示給使用者。
- 當 `status === "success"` 且有 `results[]` 時：
  - 必須逐筆處理 `results[i].status`。
  - 允許部分成功、部分失敗（Partial Failure），不得以全批成功處理。
- 若瀏覽器端只收到 `Failed to fetch`，表示前端未取得可解析 response body；此時只能顯示 URL / origin / online 狀態等診斷資訊，不能視為已取得後端真實錯誤。
- 因此 GAS 端必須盡可能將可預期失敗包成 JSON 回傳，避免 quota、權限、寫入失敗等錯誤在前端退化成單純的網路錯誤。

## 5. 同步流程（MVP）
1. 前端新增交易，先寫入 IndexedDB。
2. 前端呼叫 GAS `create` API 上傳資料（單筆新增也用 `items: [oneItem]`）。
3. GAS 逐筆以 `id` 檢查重複。
4. 同 `id` 已存在時，執行 upsert conflict 規則：
   - `incoming.version > existing.version`：更新雲端列（`success`）
   - `incoming.version === existing.version` 且 `incoming.updatedAt > existing.updatedAt`：更新雲端列（`success`）
   - `incoming.version === existing.version` 且 `incoming.updatedAt === existing.updatedAt`：雲端列視為 source of truth，不覆寫雲端；若 payload 相同則為冪等重送（`skipped`），若 payload 不同則保留雲端資料，等待年度雲端同步將本地 cache 收斂回雲端版本。
   - 其餘情況：回傳衝突錯誤（`error`, `message: "Conflict: stale version"`）
5. 前端依 `results[]` 逐筆更新同步狀態（`success/skipped/error`）。
6. 若裝置離線，前端不送出 `create` 請求，資料維持在本地 `pending` 狀態，待下次有網路時補送。

### 5.1 Phase 1 `create` 使用情境 / 觸發條件
1. 新增交易後立即同步（Immediate Create Sync）
- 觸發：使用者在 App 新增一筆交易成功寫入本地後。
- 行為：呼叫 `create`，`items` 只帶該 1 筆。

2. 更新交易後立即同步（Immediate Update Sync）
- 觸發：使用者編輯既有交易並成功寫回本地後。
- 行為：沿用 `create` API 單筆 upsert；前端會先將 `version + 1`、更新 `updatedAt`，並把 `syncStatus` 重設為 `pending`。

3. 匯入後立即同步（Import Sync）
- 觸發：使用者從 CSV 匯入資料成功寫入本地後。
- 行為：呼叫 `syncPending` 補送所有尚未同步完成的資料；支援 append 與 overwrite 匯入模式。

4. 儲存同步設定後立即同步（Config Save Sync）
- 觸發：使用者儲存 `syncApiUrl` 與 `syncToken` 後。
- 行為：立即執行 `syncPending`，嘗試補送既有待同步資料。

5. 插入範例資料後立即同步（Example Seed Sync）
- 觸發：使用者插入範例交易後。
- 行為：對新插入的範例資料執行同步。
- 離線例外：若目前離線，只插入本地資料，不立刻送出同步。

6. 啟動補送未完成資料（Startup Pending Sync）
- 觸發：App 啟動後執行 `syncPending`（掃描待同步資料）。
- 行為：以 `create` 分批補送待同步資料。
- 離線例外：若目前離線，直接跳過，不標記為失敗。

7. 同步狀態頁手動同步（Manual Retry from Sync Status Page）
- 觸發：使用者在同步狀態頁點擊右上角同步按鈕（tooltip / aria-label 為「立即同步」）。
- 行為：執行 `syncPending`，重新嘗試所有 `syncStatus !== 'synced'` 的資料。
- 離線例外：按鈕應停用，並提示需恢復連線後再重試。

## 6. `syncPending` 定義
- `syncPending` 是「補發機制」：
  - 在 App 啟動時，掃描本地尚未成功上傳的交易，逐筆重送到雲端。
- 前端目前將 `syncStatus !== 'synced'` 的資料都視為待補送項目，包含 `pending`、`syncing`、`error`。
- 批次大小目前固定為 `50` 筆。
- 若瀏覽器 `navigator.onLine === false`，`syncPending` 直接返回空結果，不修改本地資料。

## 6.1 前端同步狀態機（目前實作）
- 初始或待重送：`pending`
- 送出中：`syncing`
- API 回傳 `success` 或 `skipped`：標記為 `synced`
- API 回傳 item `error`、整體 `status !== success`、缺少 `results[]`、缺少單筆結果、非 JSON 回應、網路錯誤：標記為 `error`，並寫入 `lastSyncError`
- 離線時不進入 `syncing`，維持 `pending`，避免把暫時離線誤判為同步失敗。

## 6.2 使用者可見同步 UI
- 交易列表中的每筆交易會顯示一個同步狀態點：
  - `pending`：待同步
  - `syncing`：同步中
  - `synced`：已同步
  - `error`：同步失敗
- App 另提供「同步狀態頁」，顯示四種狀態的筆數統計、交易列表，以及手動同步待同步資料的入口。
- 同步狀態頁預設啟用「隱藏已成功項目」，只顯示 `pending`、`syncing`、`error`；使用者可手動切回顯示全部。
- 同步狀態頁中的交易項目可直接開啟既有編輯 modal，讓使用者就地修正待同步或失敗資料。
- 全域錯誤列應顯示失敗交易 `id` 與錯誤摘要，避免只顯示「同步失敗」或失敗筆數。
- 同步狀態頁對 `syncStatus === error` 的交易，應顯示 `lastSyncError` 詳細內容。
- 若錯誤來自瀏覽器層級且無可讀 response，可顯示診斷提示（例如 `Failed to fetch`、sync URL、origin、online 狀態與可能原因）；若後端有回傳 `message`，則應以後端訊息為主。
- 若目前離線，同步狀態頁會顯示離線提示，並停用右上角同步按鈕；同步中時同樣停用該按鈕。
- 若所有交易都已同步完成且仍啟用該篩選，頁面應顯示「目前沒有待處理或失敗的同步項目」，避免誤解為資料遺失。

## 6.3 通知與狀態呈現規則（目前實作）
- 前端目前有 6 種通知 / 狀態呈現機制：
  - `sweetalert2` confirmation dialog：用於刪除、覆蓋、重置、插入範例資料等需要使用者確認的操作。
  - `sweetalert2` auto-dismiss toast：目前用於交易新增、修改、刪除成功。
  - 全域 toast：短暫、非阻擋、單行摘要，用於連線狀態與設定頁操作摘要。
  - 頁內 status message：顯示較長結果，可保留換行與細節。
  - 同步狀態頁：持續型狀態檢視，顯示統計與單筆錯誤詳情。
  - 全域錯誤面板：偏除錯用途，顯示系統層級錯誤與同步診斷。
- 使用原則：
  - `sweetalert2` confirmation dialog 只用於需要使用者明確選擇「繼續 / 取消」的流程。
  - toast 只用於短摘要，適合「操作成功」或「狀態切換已發生」。
  - 頁內 status 用於長訊息、部分成功、離線待同步、同步失敗、預覽提醒等需要上下文的資訊。
  - 同步狀態頁提供可回看、可追查的詳細狀態，不用 toast 取代。
  - 表單驗證錯誤應在頁內或 modal 內嵌呈現，不使用 blocking `alert()`。
  - 全域錯誤面板不作為一般使用者成功 / 失敗提示的主要 UI。
- 匯入、同步設定、範例資料、匯出等設定頁操作，應遵守以下規則：
  - 純成功：只顯示短 toast，例如「匯入成功 (20 筆)」。
  - 成功但需補充說明：toast 顯示摘要，頁內 status 顯示細節，例如覆蓋筆數、離線待同步、同步失敗筆數。
  - 完全失敗：頁內 status 顯示主要錯誤；若有系統層級細節，再同步寫入錯誤面板或同步狀態頁。
- 文案規則：
  - toast 文案應控制在短句，避免多個子句與過長數據細節。
  - 頁內 status 可用多行文案，第一行先給結果摘要，第二行再補充同步或離線資訊。
  - 若同一操作同時有 toast 與頁內 status，兩者不得重複顯示完全相同的長文案。

## 7. Sync Conflict Matrix

### 7.1 同一筆資料重送（重試/重複點擊）
- 情境：相同 `id` 被多次送出。
- 風險：雲端重複寫入。
- 現行處理：GAS 以 `id + version + updatedAt` 比較；完全相同視為 `skipped`（冪等）。
- 後續策略：維持冪等回應，避免重複寫入。

### 7.2 不同裝置意外產生相同 `id`
- 情境：兩端本地生成碰撞 `id`（低機率）。
- 風險：其中一筆可能被視為 duplicate 而未上雲。
- 現行處理：依 `version + updatedAt` 判定，可能 `update`、`skipped` 或 `error(conflict)`。
- 後續策略：若風險不可接受，改用 UUID v4 作為 `id` 生成策略。

### 7.3 伺服端寫入成功但客戶端未收到成功回應
- 情境：網路中斷或 redirect/CORS 造成前端拿不到成功結果。
- 風險：前端可能再次送出同筆資料。
- 現行處理：重送由 `id` 驗重保護，避免重複寫入。
- 後續策略：補上待同步狀態欄位與 `syncPending`，提升可追蹤性。

### 7.4 本地有資料、雲端沒有
- 情境：離線或 token 錯誤時新增交易，未成功上雲。
- 風險：跨裝置看不到該筆資料。
- 現行處理：App 啟動時自動執行 `syncPending` 補送。
- 後續策略：增加手動重試入口與重試統計。

### 7.5 雲端有資料、本地沒有
- 情境：其他裝置已上傳，本機尚未取得該筆資料。
- 風險：本地列表與雲端不一致。
- 現行處理：提供手動年度雲端同步入口，不自動在啟動時合併。
- 現行策略：指定年份同步時，若本地不存在該筆 `id`，直接新增到本地。

### 7.6 同一筆資料內容被修改
- 情境：多裝置對同一 `id` 先後修改。
- 風險：版本衝突與資料覆寫爭議。
- 現行處理：已在 `create`（upsert）實作 conflict policy（`version` 優先，`updatedAt` 次之）。
- 現行策略：手動年度雲端同步時沿用同一規則做雙向 merge；若本地較新，同步流程會再回推雲端。

### 7.7 年度雲端同步衝突解決規則
- 適用情境：本地與雲端都存在同一 `id`，且資料內容不同。
- 比較欄位：`version`（主）與 `updatedAt`（輔）。
- 規則：
  - 若 `local.version > cloud.version`：以本地為準（覆寫雲端）。
  - 若 `local.version < cloud.version`：以雲端為準（覆寫本地）。
  - 若 `local.version === cloud.version`：比較 `updatedAt`，較新者為準。
  - 若 `version` 與 `updatedAt` 皆相同，且持久化 payload 相同：視為相同版本，不做變更。
  - 若 `version` 與 `updatedAt` 皆相同，但持久化 payload 不同：以雲端為準（覆寫本地 cache），原因標記為 `content_mismatch`。
- 設計說明：
  - 本機資料只視為 cache；雲端資料是 source of truth。當 revision metadata 無法判斷勝出端時，不應讓本機 cache 覆蓋雲端。
  - 使用者在 App 本地端調整資料時，`version` 必須 +1，`updatedAt` 必須更新為最新時間。
  - 若年度雲端同步判定為本地較新，前端會把該筆列入本次回推清單，使用既有 `create` upsert 讓雲端收斂。
  - 若年度雲端同步判定為雲端較新，前端會直接覆蓋本地。
  - 若指定年份中只有本地有資料、雲端沒有，該筆也會列入回推清單。

#### 年度雲端同步情境表

| 情境 | 處理方式 | 報告分類 | 快照保存 |
| --- | --- | --- | --- |
| 雲端有、本地沒有 | 新增到本地 | `insertedFromCloud`（雲端新增本機） | 保存新增後交易 |
| 本地有、雲端沒有 | 使用 `create` upsert 新增到雲端 | `insertedLocalOnlyToCloud`（本機新增雲端） | 保存本地交易 |
| 同 `id`，雲端 `version` 較新 | 雲端覆蓋本地 | `updatedFromCloud`（雲端覆蓋本機） | 保存 before/after |
| 同 `id`，本地 `version` 較新 | 本地回推覆蓋雲端 | `pushedLocalUpdateToCloud`（本機覆蓋雲端） | 保存 before/after |
| 同 `id`、同 `version`，雲端 `updatedAt` 較新 | 雲端覆蓋本地 | `updatedFromCloud`（雲端覆蓋本機） | 保存 before/after |
| 同 `id`、同 `version`，本地 `updatedAt` 較新 | 本地回推覆蓋雲端 | `pushedLocalUpdateToCloud`（本機覆蓋雲端） | 保存 before/after |
| 同 `id`、同 `version`、同 `updatedAt`，payload 也相同 | 不處理 | `unchanged`（未變更） | 只保存 ID，不保存快照 |
| 同 `id`、同 `version`、同 `updatedAt`，但 payload 不同 | 雲端為 source of truth，覆蓋本地 cache | `updatedFromCloud`（雲端覆蓋本機），reason: `content_mismatch` | 保存 before/after |
| 雲端資料格式不合法 | 不寫入本地，記錄錯誤 | `failed`（失敗） | 盡可能保存可用資訊 |
| 本地寫入失敗 | 不完成該筆 merge，記錄錯誤 | `failed`（失敗） | 保存 before/after（若可取得） |
| 回推雲端失敗 | 該筆回推失敗，保留本地同步錯誤 | `failed`（失敗） | 保存 before/after（若可取得） |

### 7.7.1 同步報告
- 每次手動年度雲端同步都會在本地保存一筆完整報告，包含：
  - `year`
  - `fetched`
  - `insertedFromCloud`
  - `updatedFromCloud`
  - `pushedLocalUpdateToCloud`
  - `insertedLocalOnlyToCloud`
  - `unchanged`
  - `failed`
- `insertedFromCloud`、`updatedFromCloud`、`pushedLocalUpdateToCloud`、`insertedLocalOnlyToCloud` 會保留完整 id list 與 transaction 快照。
- `unchanged` 只保留 id list，不保存快照。
- 同步報告可在 UI 中查看與手動刪除；刪除報告不影響任何交易資料。

### 7.8 補充風險清單
- 說明：以下為未來擴充同步時常見衝突來源，Phase 1 先記錄不實作。
- 高優先（建議先處理）：`R1`, `R2`, `R4`, `R10`。
- `R1` 時區/夏令時間差異：若 `updatedAt` 非統一 UTC，先後順序可能誤判。
- `R2` 裝置時鐘偏差（clock skew）：本地時間不準會造成新舊版本判斷錯誤。
- `R3` 欄位級變更互吃：本地與雲端改不同欄位，若整筆覆寫會遺失一方變更。
- `R4` 雲端人工編輯型別漂移：Sheet 手改可能造成型別/格式錯誤，影響 merge。
- `R5` 非 `id` 層級重複：同內容不同 `id` 的語意重複，`id` 驗重無法攔截。
- `R6` 刪除衝突（未來 delete）：一端刪除、一端更新，若無 tombstone 容易復活資料。
- `R7` 批次部分成功：多筆同步時若只有部分成功，重試策略需避免混亂。
- `R8` Schema 版本落差：App/GAS 欄位版本不一致，可能導致欄位遺失或覆蓋。
- `R9` Token 輪替誤判：認證失敗可能被誤認為資料衝突。
- `R10` 年分分頁邊界：跨時區或跨年時，資料可能被寫入錯誤年份 tab。

## 8. 安全與設定（Phase 1）
- 使用者需提供：
  - `apiUrl`（Apps Script Web App URL）
  - `token`（Simple Token）
- Phase 1 不使用 `sheetId`（使用綁定試算表）。

## 9. GAS 部署（Phase 1）
1. 新建 Google Sheet。
2. `Extensions -> Apps Script`。
3. 貼上後端程式碼：[docs/google-apps-script-phase1.js](/Users/gtso/Downloads/ai-studio/cozy-pocket/Cozy-Pocket/docs/google-apps-script-phase1.js)。
4. 設定 Script Property：
   - `Project Settings -> Script properties -> Add script property`
   - Key: `SYNC_TOKEN`
   - Value: 你的同步 token（需與前端設定一致）
5. Deploy Web App：
   - Execute as: `Me`
   - Who has access: `Anyone`
6. `Deploy -> New deployment -> Web app`，完成後複製 Web App URL。
7. 將部署網址填入前端 `apiUrl`，並在前端設定同一組 `token`。

## 10. 驗收標準（MVP）
1. 新增交易後，IndexedDB 內可看到該筆資料。
2. 網路正常時，`create` 可成功寫入 Google Sheets 對應年份分頁（單筆或多筆）。
3. 重送同一筆 `id`，結果為 `skipped`，不會重複新增列。
4. `token` 錯誤時，API 回 `unauthorized` 或 `status: error`，前端顯示同步失敗提示。
5. 回應可逐筆辨識 `success/skipped/error`，前端能正確更新各筆同步狀態。
6. 當同步失敗（含驗證失敗、網路錯誤）時，UI 必須有可見提示（例如 toast、錯誤列、狀態訊息）。
