# 交易驗證錯誤微動畫實作計劃

本項目實作時會使用新的 git worktree 進行開發，不直接修改目前 repo 根目錄；建議 worktree 路徑為 `worktrees/transaction-validation-error-animation`，完成後再由該分支提交與合併。

## 摘要

- 新增／編輯項目送出時若有驗證錯誤，在既有紅框與錯誤卡之外加入短暫微動畫。
- 目標是讓金額、主類別或子類別錯誤更容易被注意到，但不打斷表單輸入。
- 保留目前 modal 內嵌錯誤提示，不恢復 browser alert。

## 關鍵變更

- 在 `AddTransactionModal` 的驗證失敗分支更新一個 `validationErrorPulseKey` 或類似 state，讓同一錯誤重複送出時也能重新觸發動畫。
- 錯誤提示卡加入短暫 shake 或 pop 動畫；金額欄與類別區塊的紅框可加 subtle pulse。
- 動畫時間控制在 200 到 350ms，避免造成干擾或拖慢操作。
- 使用 CSS class / keyframes 實作，優先放在既有樣式檔；若使用 Tailwind class 不足，再新增少量自訂 CSS。
- 支援 `prefers-reduced-motion: reduce`，使用者偏好減少動態時停用 shake，只保留紅框與錯誤文案。

## 介面與型別

- 不變更 `AddTransactionModalProps`。
- 不變更 `ValidationErrors` 結構；只新增內部動畫 trigger state。
- 不新增使用者設定。

## 測試計劃

- 執行 `npm run build`。
- 手動驗證空金額、未選主類別、支出未選子類別時，錯誤卡與對應紅框會短暫動態提示。
- 手動驗證同一錯誤連續按儲存，每次都會重新觸發動畫。
- 驗證修正欄位後錯誤狀態清除，成功新增或編輯交易時不觸發錯誤動畫。
- 驗證 `prefers-reduced-motion` 啟用時沒有 shake 動畫，但錯誤提示仍清楚。

## 假設

- 第一版只針對交易 modal 的 validation error，不處理 AI 解析錯誤或設定頁 status 動畫。
