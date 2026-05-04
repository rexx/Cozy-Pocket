# Gemini 功能入口實作紀錄

本項目實作時會使用新的 git worktree 進行開發，不直接修改目前 repo 根目錄；建議 worktree 路徑為 `worktrees/gemini-entrypoint`，完成後再由該分支提交與合併。

## 摘要

- 將已存在的 Gemini 解析能力接到可用入口，補齊設定、錯誤提示與使用者回饋。
- AI 交易解析使用 `gemini-3.1-flash-lite-preview`，並將 Gemini 3 thinking level 設為 `minimal`，避免 free tier 的 Gemini 3 Flash 每日請求額度太低並降低延遲。
- Gemini API key 採設定頁輸入並儲存在本機 IndexedDB，不使用 build-time env。
- 目標是讓使用者能知道 AI 是否可用、不可用原因，以及解析成功後哪些欄位被填入。

## 關鍵變更

- 調整 Gemini API key 來源為設定頁儲存的 `geminiApiKey`，移除前端 `process.env` shim。
- 將交易解析模型設定為 `gemini-3.1-flash-lite-preview`，保留 Flash 系列的結構化解析能力並提高 free tier 可用次數。
- 將 Gemini 3 `thinkingLevel` 設為 `minimal`；此任務是短文字分類與欄位抽取，不需要高 reasoning depth。
- 開發環境會在瀏覽器 console 記錄 Gemini `usageMetadata`，用來檢查 prompt、thinking、cache、output 與 total token 分布；production 不輸出此診斷資訊。
- 在設定頁新增 AI 設定狀態；儲存空字串時清除 API key。
- 強化 `services/geminiService.ts` 的錯誤分類，離線、缺 key、模型錯誤、JSON 解析失敗需回傳可讀訊息。
- 在 `AddTransactionModal` 中保留 lazy import；未設定 API key 時隱藏 AI 區塊，解析成功後提供輕量回饋，解析失敗時顯示內嵌錯誤。
- AI 實際填入的欄位以 cyan 邊框標示；使用者手動修改後移除該欄位標示。
- Gemini prompt 與 response schema 會列出並限制可用類別、子類別、支付方式與幣別；Gemini 可填入支援但未啟用的幣別，但不允許填入非法類別、子類別、支付方式或幣別。

## 介面與型別

- 新增 AI 設定 key `geminiApiKey` 與 `getGeminiApiKey` helper。
- 解析結果型別應明確化，避免 `any` 直接寫入表單狀態。

## 測試計劃

- 執行 `npm run build`。
- 手動驗證未設定 key 時新增交易不顯示 AI 區塊，以及離線、空輸入、正常解析與解析失敗。
- 手動驗證解析結果可填入支援但未啟用幣別，且不會填入非法類別、子類別、支付方式或幣別。
- 手動驗證 AI 填入欄位只有邊框上色，且手動修改後會移除上色。
- 在開發環境送出一筆真實 Gemini 解析，確認 console 顯示 `Gemini transaction parse usage` 且沒有輸出 API key 或原始交易文字。
- 檢查 Gemini 相關程式仍維持 lazy-loaded，避免初始 bundle 明顯膨脹。

## 假設

- AI 功能第一版只支援新增交易，不支援編輯既有交易時重解析。
