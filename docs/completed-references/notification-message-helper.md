# 通知文案 Helper

## 摘要

「先寫本機、再補送同步」的四條流程——同步設定儲存、CSV 匯入、Tag 異動（更名／拆分／移除）、商家更名——原本各自在自己的 section 裡手寫三段 if/else，決定離線、部分失敗、全部成功三種結果的措辭與去向。本項目把那組判斷與文案抽成 `services/notificationMessageService.ts`，四條流程共用同一份措辭。

helper 只決定「說什麼、說在哪」，不負責顯示：回傳的結果由 `components/settings/settingsStatus.ts` 的 `applyOperationMessage()` 送上全域 toast 或頁內 status 卡片，「查看同步狀態」的 callback 仍由各設定子頁自己持有。

## 實作內容

### 新增 `services/notificationMessageService.ts`

`buildSyncedOperationMessage(summary, outcome, options)` 是主要入口，回傳 `OperationMessageResult`：

| 欄位 | 用途 |
| --- | --- |
| `toastMessage` | 只在「整個結果短到放得進 toast」時為非 null，其餘為 null |
| `statusType` | `success` / `error` / `info` / `idle` |
| `statusMessage` | 頁內卡片內容，`idle` 時為空字串 |
| `showSyncProgressAction` | 頁內卡片是否要附「查看同步狀態」入口 |

`toastMessage !== null` 與 `statusType === 'idle'` 恆為等價，也就是同一次操作只會有一個介面說話。這個互斥性由 helper 內部保證，不靠各呼叫點自律。

三種結果的判斷順序固定為離線 → 部分失敗 → 成功：

- `skippedOffline` → info 卡，`<摘要>` 換行接「目前離線，待恢復連線後再同步」，不附按鈕
- `failed > 0` → error 卡，`<摘要>` 換行接「同步失敗 N/M 筆」，附「查看同步狀態」按鈕
- 其餘 → 預設走 toast，內容就是 `<摘要>`

`successSurface: 'status'` 讓個別流程把「全部成功」改留在頁內。目前只有 Tag 拆分與移除使用（結果會列出後繼 tag，使用者需要回看），是四條流程中唯一的分岔；離線與部分失敗的判斷優先於它。

同模組另有兩個輔助函式：

- `describeUpdatedCount(summary, n)` — 產生「`<摘要>`，共更新 N 筆」，商家與 Tag 兩條流程共用
- `buildSyncFailureDetail(results, fallbackLabel)` — 從 `App.tsx` 搬入並改名（原 `buildSyncFailureSummary`）。它服務的是全域錯誤面板而非使用者訊息，輸出逐筆 `id: message`、最多三筆、其餘收斂成「另外 N 筆失敗」。改名的原因是它與使用者看到的計數訊息用途不同，舊名字容易混淆。

`describePullReportOutcome(year, status)` 收納年度雲端同步的三種結果 toast。這條流程走 toast 而非 status，是因為完成後會導航到同步紀錄頁，`SyncSection` 隨即卸載。

### 收斂重複的型別與判斷

`SyncOutcome`（`total` / `failed` / `skippedOffline`）移入 `types.ts`，取代原本散在 `App.tsx`、`SettingsPage.tsx` 與三個 section props 裡的五份 inline 字面型別。`skippedOffline` 代表該次同步從未執行，此時 `total` 與 `failed` 都是 0，不代表待同步筆數。

`App.tsx` 的商家更名與 Tag 異動各有一段自己的 `isOffline()` 早退，與 `triggerPendingSync()` 內部的離線判斷重複。改為一律呼叫 `triggerPendingSync()`，用它回報的 `skippedOffline` 決定要不要 `refreshData()`。行為不變（離線不同步也不重載，連線則同步後重載），但兩條更名流程的回傳值不再同時帶 `skippedOffline` 與 `syncResult.skippedOffline` 兩個真相——回傳型別從 `preview & { skippedOffline, syncResult? }` 收成 `preview & { syncResult }`。

### 文案變動

商家更名與 Tag 異動的離線提示原本是「目前離線，待恢復連線後**同步**」，同步設定儲存與 CSV 匯入則是「待恢復連線後**再**同步」。統一為後者。這是本項目唯一的使用者可見文案變動，其餘措辭與行為維持原樣。

## 驗證

`npm run build`（tsc strict + Vite production build）通過。

helper 的純函式行為以 15 條案例驗過：四條流程 × 三種結果的措辭、`successSurface` 被離線與部分失敗蓋掉的優先序、`buildSyncFailureDetail` 的空集／trim／fallback／超過三筆截斷，以及「恰好一個介面說話、按鈕只在 error 出現」的不變式。專案依慣例不設 test runner，因此以一次性斷言腳本執行而非留下測試檔。

瀏覽器驗證在 Claude desktop 的 in-app Browser 上完成，dev server 起在未使用過的 port（per-origin IndexedDB 為空，`getSyncConfig()` 回 null，fixture 無路徑到真實 Google Sheet），同步端點只用過 `mock://cloud-sync` 與一個本機 404 位址。實際走過的分支：

| 流程 | 全部成功 → toast | 離線 → info 卡 | 部分失敗 → error 卡＋按鈕 |
| --- | --- | --- | --- |
| 同步設定儲存 | ✅ | — | ✅ |
| CSV 匯入 | ✅ | — | ✅ |
| Tag 更名 | ✅ | — | — |
| Tag 拆分 | ✅（留在 success 卡） | — | — |
| 商家更名 | ✅ | ✅ | ✅ |

helper 的三種結果各在瀏覽器裡驗過，四個 section 的接線全部跑過，每一輪都確認 toast 與頁內 status 互斥。部分失敗分支以把 `syncApiUrl` 指向本機 404 端點造出。

多行卡片在 375×812 下另外量過幾何：離線卡三行、失敗卡四行，卡片與頁面的水平溢出皆為 0，「查看同步狀態」按鈕在 `<sm` 撐滿寬度、離線時正確不出現。

未在瀏覽器覆蓋、留給 iPhone standalone PWA 的部分：安全區與 PWA chrome 的關係、header 背景連續性、觸控事件順序。這三項 agent 端結構上到不了（agent 的點擊為 synthetic，連 `pointerdown` 都不發），與本項目的邏輯無關。
