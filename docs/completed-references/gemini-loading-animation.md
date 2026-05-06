# Gemini 解析中動畫實作紀錄

## 背景

- 新增交易頁可使用 Gemini AI 快速填寫，但等待 API 回應時需要更清楚的視覺回饋。
- 使用者按下 AI 送出後，應能立即看出系統正在解析中，避免誤以為沒有反應。
- 動畫需維持 Cozy Pocket 既有深色、低調介面風格，不做過度裝飾。

## 實作內容

- 在 `AddTransactionModal` 的 AI 快速填寫輸入框加入 SVG 外框 overlay。
- 靜態外框與解析中漸層外框都由 SVG `rect` 繪製，共用相同 geometry，避免 CSS border 與動畫路徑不一致。
- 解析中外框使用四組 SVG `linearGradient` 搭配 `animate`，分別處理上、右、下、左四邊，呈現接近 Jira 的沿邊線流動效果。
- 目前動畫參數：
  - 靜態外框 `stroke-width: 1`
  - 動畫外框 `stroke-width: 1`
  - SVG 漸層速度約 3 秒一輪
  - 外框顏色使用 cyan 與 purple 漸層
  - 外層 glow 使用固定弱光暈，不做呼吸動畫
- `Sparkles` icon 在解析中保留輕微 pulse，作為第二層低調回饋。
- 補上 `prefers-reduced-motion: reduce` 降級，使用者偏好減少動態時停用外框流動動畫。

## 行為

- 使用者輸入 AI 快速填寫文字並送出後，才會啟動解析中動畫。
- 動畫接回真實 Gemini API 呼叫，只在 `isAiProcessing` pending 期間顯示。
- Gemini 解析成功、失敗或丟出錯誤後，既有 `finally` 會停止動畫。
- 解析中不會改變輸入框尺寸、padding、外框位置或下方類別列表位置。
- 離線、空輸入、缺少 API key 等不會送出 API 的狀態不會啟動解析中動畫。

## 驗證

- 執行 `npm run build`。
- 手動輸入一段 AI 快速填寫文字並送出，確認 Gemini API pending 期間外框動畫開始。
- 手動驗證 API 成功、失敗後動畫停止，並維持既有成功／錯誤提示。
- 手動驗證動畫前後輸入框高度、外框位置、送出按鈕與下方類別列表沒有跳動。
- 手動驗證離線、空輸入、未設定 API key 時不會啟動解析中動畫。
