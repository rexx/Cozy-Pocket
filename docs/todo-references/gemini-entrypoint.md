# Gemini 功能入口實作計劃

本項目實作時會使用新的 git worktree 進行開發，不直接修改目前 repo 根目錄；建議 worktree 路徑為 `worktrees/gemini-entrypoint`，完成後再由該分支提交與合併。

## 摘要

- 將已存在的 Gemini 解析能力接到可用入口，補齊設定、錯誤提示與使用者回饋。
- 目前 `AddTransactionModal` 已有 AI 快速填寫區塊，但以 `process.env.API_KEY` 判斷顯示，需確認 Vite 環境變數與設定流程。
- 目標是讓使用者能知道 AI 是否可用、不可用原因，以及解析成功後哪些欄位被填入。

## 關鍵變更

- 調整 Gemini API key 來源，優先符合 Vite 的 `import.meta.env` 或設定頁儲存策略，避免 `process.env` 在前端不可用。
- 在設定頁新增 AI 設定狀態或說明，至少顯示是否已設定 API key。
- 強化 `services/geminiService.ts` 的錯誤分類，離線、缺 key、模型錯誤、JSON 解析失敗需回傳可讀訊息。
- 在 `AddTransactionModal` 中保留 lazy import，解析成功後提供輕量回饋，解析失敗時顯示內嵌錯誤。

## 介面與型別

- 可能新增 AI 設定 key，例如 `geminiApiKey`；若使用 build-time env，需在 `vite-env.d.ts` 補型別。
- 解析結果型別應明確化，避免 `any` 直接寫入表單狀態。

## 測試計劃

- 執行 `npm run build`。
- 手動驗證未設定 key、離線、空輸入、正常解析與解析失敗。
- 手動驗證解析結果不會填入停用幣別，且類別/子類別不合法時有 fallback 或提示。
- 檢查 Gemini 相關程式仍維持 lazy-loaded，避免初始 bundle 明顯膨脹。

## 假設

- AI 功能第一版只支援新增交易，不支援編輯既有交易時重解析。
