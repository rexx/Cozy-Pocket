# 交易編輯同步狀態與重傳計劃

本項目實作時會使用新的 git worktree 進行開發，不直接修改目前 repo 根目錄；建議 worktree 路徑為 `worktrees/transaction-edit-sync-status-retry`，完成後再由該分支提交與合併。

## 摘要

- 在交易編輯頁面底部顯示目前交易的同步狀態，讓使用者不必離開編輯流程就能知道該筆是否已同步。
- 當該筆交易同步失敗時，直接提供「重新上傳」操作。
- 重傳沿用既有雲端同步流程與 `syncStatus` / `lastSyncError` 資料，不新增新的同步狀態來源。

## 關鍵變更

- 在 `AddTransactionModal` 編輯模式底部加入同步狀態區塊，顯示 `待同步`、`同步中`、`已同步`、`同步失敗` 與錯誤摘要。
- 從 `App.tsx` 傳入獨立的同步資訊，例如 `syncInfo` 或只含 `id`、`syncStatus`、`lastSyncError` 的物件，避免背景同步刷新時重建整筆 `editingTransaction` 造成表單內容被重置。
- 新增單筆重傳 callback，例如 `onRetrySyncTransaction(id)`，內部可呼叫既有 `syncCreateItems([transaction])` 並在完成後 `refreshData()`。
- 失敗狀態顯示「重新上傳」按鈕；離線、同步中、找不到交易或沒有同步設定時停用或顯示明確狀態文字。
- 保留現有「同步狀態頁」作為大量失敗與詳細追蹤入口，不在編輯頁新增完整清單。

## 介面與型別

- 擴充 `AddTransactionModalProps`，加入可選的 `syncInfo` 與 `onRetrySyncTransaction`。
- 不改 `Transaction.syncStatus` union；仍使用 `pending | syncing | synced | error`。
- 若需呈現 UI 文案，可在 modal 內新增小型 status meta map，或抽成共用 helper 與 `TransactionItem` / `SyncStatusPage` 共用。

## 測試計劃

- 執行 `npm run build`。
- 手動驗證編輯已同步、待同步、同步中與失敗交易時，底部狀態文案與顏色正確。
- 手動製造單筆 `syncStatus: "error"` 與 `lastSyncError`，確認「重新上傳」可觸發該筆同步，成功後狀態更新。
- 驗證離線時按鈕 disabled，且不會清掉既有錯誤內容。
- 驗證背景同步更新同步狀態時，不會覆蓋使用者尚未儲存的表單欄位。

## 假設

- 第一版只做單筆重新上傳，不新增單筆雲端刪除或衝突解決流程。
- 若交易內容已被使用者修改但尚未儲存，重新上傳仍以資料庫中既有版本為準；使用者要先按儲存才會同步最新編輯內容。
