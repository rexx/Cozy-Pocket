# 雲端同步規格 (Cloud Sync Specification)

## 1. 範圍與決策
- 同步模式：**Phase 1（個人用 / Simple Token）**。
- 功能範圍：**僅 `create + sync`**。
- `id` 來源：**前端產生並送出**。
- 本次不做：`read/update/delete`、`keepalive`、`Service Worker Background Sync`、OAuth。

## 2. 目前本地資料模型（以程式碼為準）

### 2.1 TypeScript `Transaction`
來源：[types.ts](/Users/gtso/Downloads/ai-studio/cozy-pocket/Cozy-Pocket/types.ts)

```typescript
export interface Transaction {
  id: string;
  type: '支出' | '收入';
  amount: number;
  currency: string;
  categoryId: string;
  subCategoryId?: string;
  name: string;
  note?: string;
  timestamp: number;
  paymentMethod: string;
  merchant?: string;
  projectName?: string;
  tags?: string;
}
```

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
  - `J: timestamp`
  - `K: paymentMethod`
  - `L: tags`
  - `M: projectName`

## 4. API 規格（Phase 1）

### 4.1 Endpoint
- `POST {apiUrl}`
- `Content-Type: application/json`

### 4.2 Request Body（create only）
```json
{
  "token": "your_sync_token",
  "action": "create",
  "id": "1709000000000",
  "type": "支出",
  "amount": -100,
  "currency": "TWD",
  "categoryId": "food",
  "subCategoryId": "breakfast",
  "name": "早餐",
  "merchant": "便利商店",
  "note": "三明治",
  "timestamp": 1709000000000,
  "paymentMethod": "現金",
  "tags": "早餐 便利商店",
  "projectName": ""
}
```

### 4.3 Response Body
```json
{ "status": "success", "id": "1709000000000" }
```

```json
{ "status": "success", "skipped": true, "message": "Duplicate ID" }
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

## 5. 同步流程（MVP）
1. 前端新增交易，先寫入 IndexedDB。
2. 前端呼叫 GAS `create` API 上傳該筆交易。
3. GAS 以 `id` 檢查重複。
4. 同 `id` 已存在時，MVP 行為為 `skip`（不覆寫既有列），回傳 `{ "status": "success", "skipped": true }`。
5. 僅當 response JSON 的 `status === "success"` 且非錯誤回應時，前端才標記該筆同步完成。

## 6. `syncPending` 定義
- `syncPending` 是「補發機制」：
  - 在 App 啟動時，掃描本地尚未成功上傳的交易，逐筆重送到雲端。
- 本專案現況：
  - 目前 code base 還**沒有** `syncPending` 狀態欄位與函式實作。
  - 若後續要加，需先在本地模型加入同步狀態欄位（例如 `synced`）。

## 7. Sync Conflict Matrix

### 7.1 同一筆資料重送（重試/重複點擊）
- 情境：相同 `id` 被多次送出。
- 風險：雲端重複寫入。
- 現行處理：GAS 以 `id` 驗重；已存在則 `skip`。
- 後續策略：維持 `id` 唯一約束與 `skipped` 回應。

### 7.2 不同裝置意外產生相同 `id`
- 情境：兩端本地生成碰撞 `id`（低機率）。
- 風險：其中一筆可能被視為 duplicate 而未上雲。
- 現行處理：後送資料會被 `skip`。
- 後續策略：若風險不可接受，改用 UUID v4 作為 `id` 生成策略。

### 7.3 伺服端寫入成功但客戶端未收到成功回應
- 情境：網路中斷或 redirect/CORS 造成前端拿不到成功結果。
- 風險：前端可能再次送出同筆資料。
- 現行處理：重送由 `id` 驗重保護，避免重複寫入。
- 後續策略：補上待同步狀態欄位與 `syncPending`，提升可追蹤性。

### 7.4 本地有資料、雲端沒有
- 情境：離線或 token 錯誤時新增交易，未成功上雲。
- 風險：跨裝置看不到該筆資料。
- 現行處理：目前無自動補發實作。
- 後續策略：實作 `syncPending`，在啟動時補送未完成資料。

### 7.5 雲端有資料、本地沒有
- 情境：其他裝置已上傳，本機未同步拉回。
- 風險：本地列表與雲端不一致。
- 現行處理：Phase 1 不含 `pull`，不自動合併。
- 後續策略：未來若新增 `pull`，需定義雲端覆寫與 merge 規則。

### 7.6 同一筆資料內容被修改（未來風險）
- 情境：若未來上線 `update`，本地與雲端可能同時修改。
- 風險：版本衝突與資料覆寫爭議。
- 現行處理：Phase 1 僅 `create`，不處理 update conflict。
- 後續策略：上線 `update` 前需先定義 version/timestamp conflict policy。

### 7.7 未來衝突解決規則（Phase 2+）
- 適用情境：本地與雲端都存在同一 `id`，且資料內容不同。
- 比較欄位：`updatedAt`（最後更新時間）。
- 規則：
  - 若 `local.updatedAt > cloud.updatedAt`：以本地為準（覆寫雲端）。
  - 若 `local.updatedAt < cloud.updatedAt`：以雲端為準（覆寫本地）。
  - 若 `local.updatedAt === cloud.updatedAt`：**以雲端為準**（支援雲端人工修正優先）。
- 設計說明：
  - 使用者在 App 本地端調整資料時，`updatedAt` 必須更新為最新時間。
  - 若雲端端有人工調整且時間戳與本地相同，系統仍採雲端版本。
- 實作階段：本規則僅做為 Phase 2+ 設計約束，Phase 1 不實作。

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
3. 貼上 `doPost`（僅 `create`）程式碼並設定 `TOKEN`。
4. Deploy Web App：
   - Execute as: `Me`
   - Who has access: `Anyone`
5. 將部署網址填入前端 `apiUrl`。

## 10. 驗收標準（MVP）
1. 新增交易後，IndexedDB 內可看到該筆資料。
2. 網路正常時，Google Sheets 對應年份分頁新增一列。
3. 重送同一筆 `id`，不會重複新增列。
4. `token` 錯誤時，API 回 `unauthorized` 或 `status: error`，前端顯示同步失敗提示。
5. 當同步失敗（含驗證失敗、網路錯誤）時，UI 必須有可見提示（例如 toast、錯誤列、狀態訊息）。
