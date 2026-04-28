# App 內建確認 UI 實作計劃

本項目實作時會使用新的 git worktree 進行開發，不直接修改目前 repo 根目錄；建議 worktree 路徑為 `worktrees/app-confirm-dialogs`，完成後再由該分支提交與合併。

## 摘要

- 將 `AddTransactionModal` 刪除交易使用的 browser `confirm()` 改為 app 內建確認 UI。
- 評估是否導入 `swal2` 統一 alert/confirm 互動；若導入，需避免增加過重或破壞既有深色視覺。
- 刪除流程需保留取消、確認、關閉與 keyboard 可用性。

## 關鍵變更

- 優先建立共用確認 dialog 元件或 service，供 `AddTransactionModal` 呼叫。
- 將 `handleDelete` 改為開啟 app dialog；確認後才呼叫 `onDelete` 與 `onClose`。
- 若採用 `sweetalert2`，需新增 dependency、建立統一 wrapper，並套用深色 theme class。
- 檢查未來可共用於危險操作區與匯入覆蓋等場景。

## 介面與型別

- 不變更交易資料模型。
- 可能新增 `components/ConfirmDialog.tsx` 或 `services/dialogService.ts`，提供 title、message、confirmLabel、tone、onConfirm 等介面。

## 測試計劃

- 執行 `npm run build`。
- 手動驗證編輯交易時按刪除會出現 app 內確認 UI。
- 驗證取消不刪資料，確認才刪資料且 modal 關閉。
- 驗證 dialog 在手機寬度、ESC/返回、快速連點下不會重複刪除。

## 假設

- 若未特別要求外部套件，優先使用本專案自建 dialog，降低 bundle 與樣式風險。
