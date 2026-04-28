# SyncStatusPage 篩選與重試實作計劃

本項目實作時會使用新的 git worktree 進行開發，不直接修改目前 repo 根目錄；建議 worktree 路徑為 `worktrees/sync-status-filters-and-retry`，完成後再由該分支提交與合併。

## 摘要

- 強化 `SyncStatusPage` 的互動，提供只看失敗、只看待同步等篩選，以及更清楚的重試導向操作。
- 保留目前預設隱藏已成功項目的行為，但讓使用者能更快聚焦指定狀態。
- 重試操作沿用現有 `onSyncNow`，不先新增單筆重試 API。

## 關鍵變更

- 將 `hideSyncedItems` 改為狀態篩選模式，例如 `all | actionable | pending | error | synced`。
- 將四個狀態計數卡改為可點選篩選，並明確標示目前選取狀態。
- 在失敗清單或空狀態區加上「重新同步」導向按鈕，離線時 disabled 並顯示原因。
- 保留點交易項目開啟編輯 modal 的既有流程。

## 介面與型別

- 不需要改 `SyncStatusPageProps`；可沿用 `onSyncNow`、`isSyncing`、`isOffline`。
- 新增內部 filter union type。

## 測試計劃

- 執行 `npm run build`。
- 手動驗證各狀態計數、篩選切換、空狀態文案與重試按鈕。
- 驗證離線時重試 disabled，同步中 icon spin 與 disabled 狀態正確。
- 驗證點擊交易項目仍能開啟編輯 modal 並返回同步狀態頁。

## 假設

- 第一版只提供整批重試，不提供單筆重試。
