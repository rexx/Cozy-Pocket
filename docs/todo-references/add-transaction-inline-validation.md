# AddTransactionModal 內嵌驗證實作計劃

本項目實作時會使用新的 git worktree 進行開發，不直接修改目前 repo 根目錄；建議 worktree 路徑為 `worktrees/add-transaction-inline-validation`，完成後再由該分支提交與合併。

## 摘要

- 將 `AddTransactionModal` 內阻擋式 `alert()` 驗證改為 modal 內的內嵌錯誤提示。
- 使用者送出後應看到錯誤位置與可修正方向，不被 browser alert 打斷。
- 錯誤提示需支援金額、主類別與支出子類別三種既有驗證。

## 關鍵變更

- 在 `components/AddTransactionModal.tsx` 新增 validation state，例如 `formError` 或欄位錯誤 map。
- 將 `handleSubmit` 中的 `alert()` 改為設定錯誤狀態，並在必要時展開類別選擇器。
- 在 header 或表單上方顯示一段醒目的錯誤提示；金額欄與類別區塊可用 border/tone 輔助標示。
- 當使用者修改對應欄位或重新選擇類別後，清除相關錯誤。

## 介面與型別

- 不需要變更 `AddTransactionModalProps`。
- 若使用欄位錯誤 map，限制 key 為內部 union type，不外露到其他元件。

## 測試計劃

- 執行 `npm run build`。
- 手動驗證空金額、非數字金額、未選類別、支出未選子類別都會顯示內嵌錯誤。
- 手動驗證錯誤修正後可成功新增與編輯交易。
- 手動驗證 AI 快速填寫與複製交易流程不會留下舊錯誤狀態。

## 假設

- 本項目只替換 submit validation 的 browser alert，不處理刪除 confirm。
