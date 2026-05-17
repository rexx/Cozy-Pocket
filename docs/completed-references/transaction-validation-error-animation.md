# 交易驗證錯誤微動畫

## 摘要

- 新增／編輯項目送出時若有驗證錯誤，除了既有紅框與錯誤卡之外，再加上短暫微動畫，讓金額、主類別或子類別錯誤更容易被注意到。
- 即使是同一個錯誤重複按儲存，每次都會重新觸發動畫，不會卡在首次播放。
- 動畫長度落在 320–350ms，搭配既有的 modal 內嵌錯誤卡，未恢復 browser alert。

## 實作內容

- 在 `AddTransactionModal` 內新增 `errorPulseKey` state；每次 `handleSubmit` 偵測到驗證錯誤就 `+1`，送出成功與切換編輯對象時歸 0。
- 由 `errorPulseKey` 的奇偶性推導出 `errorShakeClass` / `errorPulseClass`（後綴 `-a` 或 `-b`），套用在：
  - 錯誤訊息卡：`validation-error-shake-{a,b}`，同時補上 `role="alert"` + `aria-live="assertive"`。
  - 金額與幣別所在的 input 容器：`validation-error-pulse-{a,b}`，只在 `validationErrors.amount` 存在時掛上。
  - 類別容器與摺疊狀態下的類別 button：同樣只在 `validationErrors.category` / `validationErrors.subCategory` 存在時掛上。
- `styles.css` 定義了兩組 keyframes（`validation-error-shake-1` / `-2`、`validation-error-pulse-1` / `-2`），內容完全相同。`-a` 與 `-b` 兩個 class 各自 bind 到不同的 `animation-name`，這樣 React 在連續錯誤之間切換 class 時，瀏覽器才會把 `animation-name` 視為已改變、重啟動畫；若兩個 class 共用同一個 `animation-name`，瀏覽器會把它當成同一個動畫實體而不重啟。
- `@media (prefers-reduced-motion: reduce)` 對四個 class 一併設 `animation: none`，使用者開啟減少動態效果時只保留紅框與錯誤文案。

## 介面與型別

- 沒有改動 `AddTransactionModalProps` 或 `ValidationErrors` 結構。
- 沒有新增任何使用者可調設定，動畫純粹由內部 `errorPulseKey` state 驅動。

## 驗證

- `npm run build` 通過（tsc strict + Vite production）。
- 手動驗證空金額、未選主類別、支出未選子類別時，錯誤卡會 shake、對應紅框會 pulse。
- 手動驗證同一錯誤連續按儲存，每次都會再次觸發動畫（由 `-a` / `-b` 對應到不同 `animation-name`）。
- 修正欄位後錯誤狀態清除，成功新增或編輯交易時不再觸發錯誤動畫。
- `prefers-reduced-motion: reduce` 啟用時 shake 與 pulse 全部停用，紅框與錯誤訊息仍清楚。

## 限制

- 本版本只處理交易 modal 的 validation error，不涵蓋 AI 解析錯誤或設定頁 status 動畫。
