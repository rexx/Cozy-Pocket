# SweetAlert2 動態載入實作計劃

本項目實作時會使用新的 git worktree 進行開發，不直接修改目前 repo 根目錄；建議 worktree 路徑為 `worktrees/dynamic-sweetalert2`，完成後再由該分支提交與合併。

## 摘要

- 將 `sweetalert2` 改為動態載入。
- `dialogService` 經 toast 系統統一後只剩 `confirmAction` 一個用途（見 unify-toast-system 計劃），目標是把它從主 bundle 移出，只在實際開啟 confirm dialog 時載入。

## 關鍵變更

- 將 `services/dialogService.ts` 內的 `sweetalert2` 靜態 import 改為 `import('sweetalert2')`。
- 保留既有 `confirmAction` API 介面，避免呼叫端跟著改動。
- 評估是否需要在高頻操作前預載 dialog chunk，降低首次確認對話框延遲。

## 測試計劃

- 執行 `npm run build`。
- 確認 `sweetalert2` 不再進主 `index-*` chunk。
- 手動驗證 `AddTransactionModal` 的刪除確認、`SettingsPage` 的匯入／重置／插入範例資料確認行為不變。

## 假設

- 呼叫端可以接受 dialog helper 回傳 Promise，因此動態 import 不需要改變既有互動流程。
