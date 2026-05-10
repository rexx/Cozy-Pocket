# 非首頁頁面 Lazy Load 實作計劃

本項目實作時會使用新的 git worktree 進行開發，不直接修改目前 repo 根目錄；建議 worktree 路徑為 `worktrees/lazy-load-non-home-pages`，完成後再由該分支提交與合併。

## 摘要

- 將非首頁 page 改為 `React.lazy`。
- 目標是降低初始主 bundle，避免 `App.tsx` 一開始就靜態吃進所有頁面。
- 優先對象包含 `SettingsPage`、`SyncStatusPage`、`SearchPage`、`MonthlyStatsPage`、`PullReportsPage`、`AddTransactionModal`（商家管理已併入 `SettingsPage` 子頁，跟著 `SettingsPage` 一起 lazy 即可）。

## 關鍵變更

- 將非首頁頁面與交易 modal 的靜態 import 改為 `React.lazy`。
- 在 routing / modal render 位置補上符合現有視覺的 `Suspense` fallback。
- 避免把首頁首屏必要元件一起 lazy load，讓首頁仍維持穩定載入。

## 測試計劃

- 執行 `npm run build`。
- 重新比較 build 後的 `index-*.js` raw / gzip 大小，確認主 chunk 明顯下降。
- 手動驗證設定（含商家管理子頁）、同步狀態、搜尋、月統計、同步紀錄與交易 modal 的首次開啟與返回流程正常。
- 確認 lazy chunk 載入期間不會出現空白畫面或 layout shift。

## 假設

- 本項目先處理 page-level code splitting，不同時重構 `App.tsx` 的 shared state。
