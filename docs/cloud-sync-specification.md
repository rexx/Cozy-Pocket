# 雲端同步規格 (Cloud Sync Specification)

## 1. 範圍與決策
- 同步模式：**Phase 1（個人用 / Simple Token）**。
- 功能範圍：**僅 `create + sync`**。
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

### 4.1.1 API 路線圖（你已確認）
- **Phase 1**：`create`（POST）
- **Phase 2**：`get`（GET / pull）
- **Phase 3**：`update`（POST）
- **Phase 4**：`delete`（POST）

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

## 5. 同步流程（MVP）
1. 前端新增交易，先寫入 IndexedDB。
2. 前端呼叫 GAS `create` API 上傳資料（單筆新增也用 `items: [oneItem]`）。
3. GAS 逐筆以 `id` 檢查重複。
4. 同 `id` 已存在時，執行 upsert conflict 規則：
   - `incoming.version > existing.version`：更新雲端列（`success`）
   - `incoming.version === existing.version` 且 `incoming.updatedAt > existing.updatedAt`：更新雲端列（`success`）
   - `incoming.version === existing.version` 且 `incoming.updatedAt === existing.updatedAt`：視為重送（`skipped`）
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

7. 同步狀態頁手動同步（Manual Retry from Sync Progress Page）
- 觸發：使用者在同步狀態頁點擊「同步待同步」。
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
- App 另提供「同步狀態頁」，顯示四種狀態的筆數統計、完整交易列表，以及手動同步待同步資料的入口。
- 若目前離線，同步狀態頁會顯示離線提示，並停用「同步待同步」按鈕。

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
- 情境：其他裝置已上傳，本機未同步拉回。
- 風險：本地列表與雲端不一致。
- 現行處理：Phase 1 不含 `pull`，不自動合併。
- 後續策略：未來若新增 `pull`，需定義雲端覆寫與 merge 規則。

### 7.6 同一筆資料內容被修改（未來風險）
- 情境：多裝置對同一 `id` 先後修改。
- 風險：版本衝突與資料覆寫爭議。
- 現行處理：已在 `create`（upsert）實作 conflict policy（`version` 優先，`updatedAt` 次之）。
- 後續策略：Phase 2 pull 時沿用同一規則做雙向 merge。

### 7.7 未來衝突解決規則（Phase 2+）
- 適用情境：本地與雲端都存在同一 `id`，且資料內容不同。
- 比較欄位：`version`（主）與 `updatedAt`（輔）。
- 規則：
  - 若 `local.version > cloud.version`：以本地為準（覆寫雲端）。
  - 若 `local.version < cloud.version`：以雲端為準（覆寫本地）。
  - 若 `local.version === cloud.version`：比較 `updatedAt`，較新者為準。
  - 若 `version` 與 `updatedAt` 皆相同：視為相同版本，不做變更。
- 設計說明：
  - 使用者在 App 本地端調整資料時，`version` 必須 +1，`updatedAt` 必須更新為最新時間。
  - 目前已實作在 push/create(upsert)；pull 端規則待 Phase 2 套用。

### 7.8 補充風險清單（Phase 2+）
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
