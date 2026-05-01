# Lazy Load Fallback 與 Prefetch 實作計劃

本項目實作時會使用新的 git worktree 進行開發，不直接修改目前 repo 根目錄；建議 worktree 路徑為 `worktrees/lazy-load-fallback-prefetch`，完成後再由該分支提交與合併。

## 摘要

- 為 lazy-loaded page / dialog 補上 fallback 或 prefetch 策略。
- 目標是避免初次開啟非首頁 page、交易 modal 或 confirm dialog 時出現可感知延遲。

## 關鍵變更

- 為 `React.lazy` 頁面設計符合現有視覺的 `Suspense` fallback。
- 為交易 modal 與 confirm dialog 評估 idle prefetch 或接近操作時預載。
- 避免 fallback 造成頁面高度跳動或與 PWA safe area 衝突。

## 測試計劃

- 執行 `npm run build`。
- 手動驗證第一次進入設定頁、統計頁、交易 modal 與刪除確認時不會出現空白或明顯卡頓。
- 在慢速網路模擬下檢查 fallback 是否能穩定顯示。
- 確認 prefetch 不會讓首頁初始載入重新變重。

## 假設

- 先以高頻頁面和高頻 dialog 為預載候選，不一次預載所有 lazy chunk。
