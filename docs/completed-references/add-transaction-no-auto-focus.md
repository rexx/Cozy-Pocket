# 新增交易 modal 開啟時不自動 focus 輸入框

## 摘要

- 開啟新增交易 modal（非編輯模式）時不再自動 focus 金額輸入框，避免在 iPhone PWA 上一開啟就彈出虛擬鍵盤遮住表單。使用者主動點擊金額欄後鍵盤才會出現。
- 此前 `AddTransactionModal.tsx` 以一個 `useLayoutEffect`，在 `!isEditing` 時呼叫 `amountInputRef.current.focus()`，使新增交易一開啟即取得 focus 並彈出鍵盤。
- 切到 AI tab 時自動 focus AI 輸入框的行為刻意保留（由另一個 `useEffect` 監聽 `activeTab` 控制），與本次改動無關。

## 關鍵變更

- `components/AddTransactionModal.tsx`
  - 移除開啟時 auto-focus 金額欄的 `useLayoutEffect`。
  - 移除連帶失去用途的 dead code：`amountInputRef` 宣告、金額 `<input>` 上的 `ref={amountInputRef}`，以及未再使用的 `useLayoutEffect` import。

未變更：
- 切到 AI tab 時自動 focus AI 輸入框的 `useEffect`。
- `tagInputRef`、`aiInputRef` 等其他 ref 與其用途。
- modal 其餘表單狀態、驗證與 AI 解析流程。

## 介面與型別

- 沒有新增或移除型別。
- `AddTransactionModalProps` 維持不變。

## UI 細節

- 桌面瀏覽器：開啟 modal 後 caret 不會自動進入金額欄；點擊金額欄才取得 focus。
- iPhone PWA：開啟 modal 時不會立刻彈出虛擬鍵盤，表單完整可見；點擊任一輸入欄後鍵盤才彈出。
- AI tab：切過去仍會自動 focus AI 輸入框（需已設定 Gemini API key 且為新增模式）。
- 編輯既有交易：行為一致，開啟時不自動 focus（原本編輯模式即不會 auto-focus）。

## 驗證

- 執行 `npm run build`，通過 tsc strict + Vite production build。
- 桌面 Microsoft Edge 手動驗證：
  - 開啟新增交易 modal，金額欄未自動取得 focus；點擊後可正常輸入。
  - 切到 AI tab，AI 輸入框仍自動 focus。
  - 開啟既有交易編輯，行為一致。

## 假設與限制

- 金額欄不再需要程式化 focus，故一併移除 `amountInputRef` 而非保留 dead ref。
- 移除 auto-focus 不影響表單其他預設值與初始化邏輯（`sourceTransaction` 變更時的 reset effect 維持不變）。
