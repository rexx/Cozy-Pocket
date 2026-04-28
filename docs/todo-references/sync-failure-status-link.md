# 同步部分失敗狀態按鈕實作計劃

本項目實作時會使用新的 git worktree 進行開發，不直接修改目前 repo 根目錄；建議 worktree 路徑為 `worktrees/sync-failure-status-link`，完成後再由該分支提交與合併。

## 摘要

- 當同步部分失敗時，頁內狀態訊息需提供可直接前往同步狀態頁的操作按鈕。
- 目標是讓使用者從設定頁或資料操作結果中能直接查看失敗項目與錯誤詳情。
- Toast 保持短訊息，詳細處理入口放在頁內 status。

## 關鍵變更

- 擴充 `SettingsPage` 的 status 結構，支援 action label 與 callback，或由各 section 接收 `onOpenSyncProgress` 顯示按鈕。
- 在同步設定儲存、tag 更名、商家更名、匯入後補送同步等失敗場景，顯示「查看同步狀態」操作。
- 確認 `App.tsx` 進入同步狀態頁時保留 return view，從設定頁進入後可回設定頁。
- 保持 toast 簡短，例如「有 N 筆同步失敗」，頁內 status 顯示詳細摘要與按鈕。

## 介面與型別

- 可能新增 `StatusMessage` 型別，包含 `type`、`message`、`actionLabel`、`onAction`。
- 不變更同步 API 回傳格式。

## 測試計劃

- 執行 `npm run build`。
- 手動製造同步部分失敗，確認頁內狀態出現查看同步狀態按鈕。
- 點擊後確認進入 `SyncStatusPage`，返回時回到設定頁。
- 驗證全部成功、離線略過、未設定同步 config 時不出現錯誤導向按鈕或文案合理。

## 假設

- 同步狀態頁已是失敗詳情的主要落點，不另外新增錯誤列表 modal。
