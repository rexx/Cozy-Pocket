# 手動年度雲端同步（完成紀錄）

## 摘要

- 在既有自動補送同步之外，提供「年度雲端同步」手動入口。
- 使用者可選擇單一年份執行同步；流程先讀取該年份雲端資料，再依 `version` 與 `updatedAt` 做雙向合併。
- 每次同步都會在本地保存完整同步報告，可回看分類統計、ID 清單、before/after 快照與失敗原因，並可手動刪除報告。
- 開發測試可使用 `mock://cloud-sync`，不需部署 Google Apps Script。

## 前端

- `services/cloudSyncService.ts` 實作按年份讀取雲端資料的流程與 mock API，處理雲端新增本機、雲端覆蓋本機、本機覆蓋雲端、本機新增雲端、未變更與失敗等分類。
- 雲端/本地各種同步情境與處理方式整理於 `docs/cloud-sync-specification.md` 的「年度雲端同步情境表」。
- `components/settings/SyncSection.tsx`、`components/SettingsPage.tsx` 與 `App.tsx` 串接年度雲端同步入口、年份選擇、同步完成後自動開啟報告頁，以及報告刪除。
- `components/PullReportsPage.tsx` 提供同步紀錄與報告詳細 UI；比較型項目顯示 before/after transaction item，單邊資料只顯示該筆 transaction item，未變更只保存與顯示 ID。
- `db.ts` 與 `types.ts` 加入同步報告本地保存所需的 IndexedDB store 與型別。

## 後端

- `docs/google-apps-script-phase1.js` 提供 `action: "create"`（依 `id` upsert）與 `action: "get"`（依年份讀取）兩個 action，並以 200-wrapping JSON 回傳。
- 新版 GAS 已部署為 Web App，`action: "get"` 的 response 格式與前端 `fetchPullItemsWithConfig` 相符。

## `readableDateTime` coercion 修正

- 現象：前端送出的 `readableDateTime`（例如 `2098-06-15 12:00`）會被 Google Sheets 自動 coerce 成 Date cell，`action: "get"` 讀回來變成 `Sun Jun 15 2098 12:00:00 GMT+0800 (台北標準時間)`。
- 影響：`readableDateTime` 是從 `timestamp` 衍生、且時區相依的顯示欄位。將它納入 conflict detection 的 payload 比對，會讓同 revision 的交易被誤判為衝突，第一次年度同步出現假性「雲端覆蓋本機」churn，並把本機的乾淨格式覆寫成 coerce 後的字串。
- 修正（`services/cloudSyncService.ts`）：新增 `toComparablePayload`，`hasSamePersistedPayload` 的比對排除 `readableDateTime`；`normalizePullItem` 一律以 `formatReadableDateTime(timestamp)` 重算，不信任雲端值。

## 驗證

- `npm run build`（`tsc && vite build`）通過。
- mock API fixture 覆蓋情境表主要路徑：雲端-only、本地-only、`version` 較新、`updatedAt` 較新、同 revision payload mismatch、未變更、雲端格式錯誤、本地寫入失敗與回推失敗。
- 以真實 Google Sheets 端到端驗證：PUSH（`create`）、PULL 雲端新增本機、雲端覆蓋本機、本機覆蓋雲端（回推）與未變更五個分類，報告數字皆正確。
- 修正後回歸驗證：同 revision 情境正確判「未變更」（churn 消失），真正的雲端較新仍正確覆蓋本機，且覆蓋後本機 `readableDateTime` 重算為乾淨格式。

## 後續可評估

- GAS 端可加固：把 `readableDateTime` 欄位設為純文字格式（`setNumberFormat('@')`），從來源避免 Sheets coerce，讓 sheet 內顯示也維持乾淨格式（前端已不信任該值，此為 sheet 可讀性的加分項）。
- 若未來把內部 `PullReport` 命名改成 `YearSyncReport`，需同步處理 IndexedDB store 遷移，避免破壞既有本地報告。
- 若要支援真正多裝置同時編輯，可評估欄位級 merge 或衝突確認 UI；目前採整筆交易以 `version` / `updatedAt` 決定勝出端。
