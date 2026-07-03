# AddTransactionModal 內嵌驗證紀錄

## 摘要

- `AddTransactionModal` 內阻擋式 `alert()` 驗證已改為 modal 內的內嵌錯誤提示。
- 使用者送出後可看到錯誤位置與可修正方向，不再被 browser alert 打斷。
- 錯誤提示涵蓋金額、主類別與支出子類別三種既有驗證。

## 關鍵變更

- `components/AddTransactionModal.tsx` 新增 `validationErrors` 欄位錯誤 map state。
- `handleSubmit` 中的 `alert()` 改為設定錯誤狀態，並在必要時展開類別選擇器。
- 表單上方顯示醒目的錯誤提示；金額欄與類別區塊以 border/tone 輔助標示。
- 使用者修改對應欄位或重新選擇類別後，清除相關錯誤。

## 介面與型別

- `AddTransactionModalProps` 未變更。
- 欄位錯誤 map 的 key 為內部 union type（`ValidationErrors`），不外露到其他元件。

## 驗證

- `npm run build` 通過。
- 已手動驗證空金額、非數字金額、未選類別、支出未選子類別都顯示內嵌錯誤。
- 已手動驗證錯誤修正後可成功新增與編輯交易。
- 已手動驗證 AI 快速填寫與複製交易流程不會留下舊錯誤狀態。

## 假設

- 本項目只替換 submit validation 的 browser alert；刪除 confirm 由 [app-confirm-dialogs.md](./app-confirm-dialogs.md) 處理。
