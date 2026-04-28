# 手動 Cloud Pull 實作計劃

本項目實作時會使用新的 git worktree 進行開發，不直接修改目前 repo 根目錄；建議 worktree 路徑為 `worktrees/manual-cloud-pull`，完成後再由該分支提交與合併。

## 摘要

- 在現有自動同步之外，提供明確的「從 cloud 拉回本機」操作入口。
- 功能應放在設定/同步相關區域，讓使用者能主動處理本機資料缺漏或換裝置後回復資料。
- Pull 結果需清楚回報新增、更新、略過與失敗筆數。

## 關鍵變更

- 擴充 `services/cloudSyncService.ts`，新增讀取雲端資料的函式，例如 `pullCloudTransactions`。
- 依 `docs/cloud-sync-specification.md` 與 `docs/google-apps-script-phase1.js` 檢查目前 GAS 是否已有 pull/read action；若沒有，先同步更新 GAS 規格與 script。
- 在 `components/settings/SyncSection.tsx` 新增手動 pull 按鈕，並由 `SettingsPage`/`App.tsx` 提供 handler。
- Pull 回來的資料以 `id`、`updatedAt`、`version` 做合併；本機較新的 pending/error 資料不可被舊雲端資料覆蓋。

## 介面與型別

- 新增 cloud pull 的回傳型別，至少包含 `created`、`updated`、`skipped`、`failed` 與錯誤摘要。
- 視需要擴充同步 API response 型別，保持 create/pending sync 既有行為不變。

## 測試計劃

- 執行 `npm run build`。
- 手動驗證未設定 sync config、離線、token 錯誤、cloud 空資料與成功拉回資料的狀態訊息。
- 手動建立本機較新資料與雲端較舊資料，確認 pull 不會覆蓋本機較新版本。
- 驗證 pull 後首頁、搜尋、統計與同步狀態頁都反映最新本機資料。

## 假設

- Cloud 端仍以 Google Apps Script 作為同步 API。
- 本項目不處理雙向衝突解決 UI，只採用明確的版本/時間戳合併規則。
