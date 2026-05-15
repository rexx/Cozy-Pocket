# 交易編輯同步狀態與重傳紀錄

## 摘要

- 交易編輯頁面底部已顯示目前交易的同步狀態，讓使用者不必離開編輯流程就能知道該筆是否已同步。
- `pending` 與 `error` 狀態可直接點擊左側狀態圖示觸發單筆上傳；`syncing` 與 `synced` 維持純狀態顯示。
- 重傳沿用既有雲端同步流程與 `syncStatus` / `lastSyncError` 資料，未新增新的同步狀態來源。

## 關鍵變更

- 在 `AddTransactionModal` 編輯模式底部加入同步狀態區塊，顯示 `待同步`、`同步中`、`已同步`、`同步失敗` 與錯誤摘要。
- 從 `App.tsx` 傳入獨立的 `syncInfo`，只包含 `id`、`syncStatus`、`lastSyncError` 與存在狀態，避免背景同步刷新時重建整筆 `editingTransaction` 造成表單內容被重置。
- 新增 `onRetrySyncTransaction(id)` 單筆上傳 callback，內部讀取 IndexedDB 中的最新交易，呼叫既有 `syncCreateItems([transaction])`，完成後 `refreshData()`。
- `pending` 的時鐘圖示與 `error` 的驚嘆號圖示可點擊上傳；離線、同步中、找不到交易或沒有同步設定時停用，並顯示明確狀態文字。
- 保留現有「同步狀態頁」作為大量失敗與詳細追蹤入口，編輯頁只顯示當前交易的狀態與錯誤摘要。

## 介面與型別

- `AddTransactionModalProps` 已加入可選的 `syncInfo`、`onRetrySyncTransaction`、`isOffline`、`isSyncConfigured` 與 `isSyncing`。
- `Transaction.syncStatus` union 未改動，仍使用 `pending | syncing | synced | error`。
- 狀態 UI 使用 modal 內的小型 status meta map，對應四組圖示與顏色。

## 驗證

- 執行 `npm run build`。
- 編輯已同步、待同步、同步中與失敗交易時，底部狀態文案與顏色正確。
- 單筆 `syncStatus: "error"` 與 `lastSyncError` 可在編輯頁看到錯誤摘要，點擊左側驚嘆號圖示可重新上傳。
- 單筆 `syncStatus: "pending"` 可點擊左側時鐘圖示立即上傳。
- 離線、同步中、找不到交易或沒有同步設定時，狀態圖示按鈕 disabled，且不會清掉既有錯誤內容。
- 背景同步更新同步狀態時，不會覆蓋使用者尚未儲存的表單欄位。

## 範圍

- 本次只做單筆上傳 / 重新上傳，不新增單筆雲端刪除或衝突解決流程。
- 若交易內容已被使用者修改但尚未儲存，重新上傳仍以資料庫中既有版本為準；使用者要先按儲存才會同步最新編輯內容。
