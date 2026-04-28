# 交易項目支付方式顯示模式實作計劃

本項目實作時會使用新的 git worktree 進行開發，不直接修改目前 repo 根目錄；建議 worktree 路徑為 `worktrees/payment-method-icons`，完成後再由該分支提交與合併。

## 摘要

- 新增交易列表支付方式顯示模式，讓使用者可在「文字」與「圖示」之間切換。
- 預設使用圖示模式，提升列表掃描效率；使用者可切回文字模式保留完整可讀標籤。
- 參考圖：`docs/todo-references/payment-method-icon.jpg`。
- 圖示需與新增/編輯 modal 中既有付款方式圖示保持一致。

## 關鍵變更

- 在偏好設定新增「交易列表支付方式顯示」選項，提供「文字」與「圖示」兩種模式。
- 使用 `db.settings` 儲存顯示模式，例如 key `paymentMethodDisplayMode`，值為 `text` 或 `icon`。
- 在 `components/TransactionItem.tsx` 支援 display mode prop；文字模式保留目前 `transaction.paymentMethod` pill，圖示模式改為 icon badge。
- 在 `components/TransactionItem.tsx` 或共用 helper 建立 payment method 到 lucide icon 的對應表，與 `AddTransactionModal` 目前 `getPaymentIcon` 邏輯對齊；若重複明顯，可抽到共用 helper。
- 圖示模式仍保留 `title` 與 `aria-label` 顯示完整支付方式，避免無障礙與辨識度退化。
- 圖示模式只套用在已知支付方式；未知或空支付方式一律回退為文字顯示，不使用 fallback icon。
- 由 `App.tsx` 載入設定並傳遞到首頁、搜尋結果、同步狀態頁與統計展開列表中所有 `TransactionItem`。
- 檢查金額區寬度，避免 icon 化後造成金額跳動或窄螢幕重疊。

## 介面與型別

- 不變更 `Transaction` 或 `PaymentMethod` 儲存格式。
- 新增 UI 偏好設定型別，例如 `PaymentMethodDisplayMode = 'text' | 'icon'`。
- 若抽 helper，可新增 `components/paymentMethodIcons.ts` 或放在既有 constants，但不改交易資料持久化格式。
- `TransactionItem` 新增 prop，例如 `paymentMethodDisplayMode?: PaymentMethodDisplayMode`，預設為 `icon`。

## 測試計劃

- 執行 `npm run build`。
- 手動驗證偏好設定可在文字與圖示模式間切換，重新進入 app 後仍保留選擇。
- 手動驗證首次使用與未設定偏好時預設為圖示模式，且現金、信用卡、電子支付、轉帳皆顯示正確圖示。
- 手動驗證切到文字模式後維持目前文字標籤顯示。
- 手動驗證未知或空支付方式一律以文字顯示，且不讓列表崩潰。
- 手動檢查首頁、搜尋結果、同步狀態頁與統計展開列表的交易項目顯示一致。
- 手動檢查切換顯示模式後，既有交易資料與 CSV 匯出內容不改變。

## 假設

- 交易資料仍保留文字支付方式，文字/圖示切換只改變顯示層。
- 偏好設定預設為圖示模式。
- 已知支付方式包含現金、信用卡、電子支付、轉帳；其他值視為未知支付方式。
