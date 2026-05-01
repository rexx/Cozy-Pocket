# 手動年度雲端同步前端實作與後端驗證紀錄

本項目已使用獨立 git worktree 開發，未直接修改 repo 根目錄；實作分支為 `feature-manual-cloud-pull-reporting`。

## 摘要

- 在現有自動補送同步之外，新增「年度雲端同步」手動入口。
- 使用者可選擇單一年份執行同步；前端流程會先讀取該年份雲端資料，再依 `version` 與 `updatedAt` 做雙向合併。
- 每次同步都會在本地保存完整同步報告，可回看分類統計、ID 清單、before/after 快照與失敗原因，並可手動刪除報告。
- 開發測試可使用 `mock://cloud-sync`，不需要先部署 Google Apps Script。
- 前端入口、mock API 與本地報告 UI 已完成。
- 後端 GAS `get` API 已提供範例程式，但尚未部署與端到端測試，因此後端驗證不算完成。

## 前端已完成

- `services/cloudSyncService.ts` 已實作按年份讀取雲端資料的前端流程與 mock API，並處理雲端新增本機、雲端覆蓋本機、本機覆蓋雲端、本機新增雲端、未變更與失敗等分類。
- `components/settings/SyncSection.tsx`、`components/SettingsPage.tsx` 與 `App.tsx` 已串接年度雲端同步入口、年份選擇、同步完成後自動開啟報告頁，以及報告刪除。
- `components/PullReportsPage.tsx` 已提供同步紀錄與報告詳細 UI；比較型項目會顯示 before/after transaction item，單邊資料只顯示該筆 transaction item，未變更只保存與顯示 ID。
- `db.ts` 與 `types.ts` 已加入同步報告本地保存所需的 IndexedDB store 與型別。
- `README.md` 與 `docs/cloud-sync-specification.md` 已更新為年度雲端同步語意。

## 已驗證

- 已執行 `npm run build` 並通過。
- 已使用 mock API 手動檢視多筆雲端新增、雲端覆蓋、本機覆蓋、本機新增、未變更與失敗案例的報告 UI。

## 後端待驗證

- `docs/google-apps-script-phase1.js` 已補上 `action: "get"` 範例，但尚未部署到實際 GAS Web App。
- 尚未部署新版 Google Apps Script。
- 尚未以真實 Google Sheets 資料測試 `action: "get"` 的年份讀取 response。
- 尚未端到端驗證真實 API 下的雲端新增本機、雲端覆蓋本機、本機覆蓋雲端、本機新增雲端與失敗報告分類。

## 後續可評估

- 優先部署 GAS 並用真實 Google Sheets 資料跑一次年度雲端同步端到端測試。
- 若未來要把內部 `PullReport` 命名改成 `YearSyncReport`，需要同步處理 IndexedDB store 遷移，避免破壞使用者既有本地報告。
- 若要支援真正多裝置同時編輯，可評估欄位級 merge 或衝突確認 UI；目前採整筆交易以 `version` / `updatedAt` 決定勝出端。
