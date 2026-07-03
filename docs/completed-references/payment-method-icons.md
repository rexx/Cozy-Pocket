# 交易項目支付方式顯示模式紀錄

## 摘要

- 交易列表支付方式已支援「文字」與「圖示」兩種顯示模式，可在偏好設定切換。
- 預設為文字模式，保留完整可讀標籤；圖示模式提升列表掃描效率。
- 圖示與新增／編輯 modal 中既有付款方式圖示保持一致。

## 關鍵變更

- 偏好設定新增「交易列表支付方式顯示」選項，提供「文字」與「圖示」兩種模式，排在偏好設定最上方。
- 顯示模式存於 `db.settings`，key 為 `paymentMethodDisplayMode`（`preferences.ts` 匯出 `PAYMENT_METHOD_DISPLAY_MODE_SETTING_KEY`），值為 `text` 或 `icon`。
- `components/TransactionItem.tsx` 新增 display mode prop；文字模式保留 `transaction.paymentMethod` pill，圖示模式改為 icon badge。
- 新增 `components/paymentMethodIcons.ts` 共用 helper，統一 payment method 到 lucide icon 的對應，與 `AddTransactionModal` 的圖示一致。
- 圖示模式保留 `title` 與 `aria-label` 顯示完整支付方式，避免無障礙與辨識度退化。
- 圖示模式只套用在已知支付方式；未知或空支付方式一律回退為文字顯示，不使用 fallback icon。
- 由 `App.tsx` 載入設定並傳遞到首頁、搜尋結果、同步狀態頁、統計展開列表、Tag 管理與商家管理中所有 `TransactionItem`。

## 介面與型別

- `Transaction` 與 `PaymentMethod` 儲存格式未變更。
- 新增 `PaymentMethodDisplayMode = 'text' | 'icon'` 型別。
- `TransactionItem` 新增 `paymentMethodDisplayMode?: PaymentMethodDisplayMode` prop，預設為 `text`。

## 驗證

- `npm run build` 通過。
- 已手動驗證偏好設定可在文字與圖示模式間切換，重新進入 app 後仍保留選擇。
- 已手動驗證首次使用與未設定偏好時預設為文字模式。
- 已手動驗證圖示模式下現金、信用卡、電子支付、轉帳皆顯示正確圖示；切回文字模式維持文字標籤。
- 已手動驗證未知或空支付方式一律以文字顯示，列表不受影響。
- 已手動檢查首頁、搜尋結果、同步狀態頁與統計展開列表的交易項目顯示一致。
- 已確認切換顯示模式後，既有交易資料與 CSV 匯出內容不改變。

## 假設

- 交易資料仍保留文字支付方式，文字／圖示切換只改變顯示層。
- 已知支付方式包含現金、信用卡、電子支付、轉帳；其他值視為未知支付方式。
