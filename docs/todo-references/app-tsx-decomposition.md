# App.tsx 拆薄實作計劃

本項目實作時會使用新的 git worktree 進行開發，不直接修改目前 repo 根目錄；建議 worktree 路徑為 `worktrees/app-tsx-decomposition`，完成後再由該分支提交與合併。

## 摘要

- 持續拆薄 `App.tsx`。
- 目標是降低 page orchestration 與 shared state 集中在單一檔案的耦合，讓 page-level lazy load 更自然。

## 關鍵變更

- 將 page loader 與 route/page selection 邏輯抽出到獨立 helper 或 component。
- 將 transaction modal orchestration 拆成明確的 hook 或 container。
- 將 shared data hooks 逐步拆出，讓 `App.tsx` 聚焦於高階 app state 與 page 組合。
- 每次拆分保持小步提交，避免同時改動 routing、資料流與視覺結構。

## 測試計劃

- 執行 `npm run build`。
- 手動驗證首頁、設定、同步狀態、搜尋、統計、商家管理與交易 modal 流程維持穩定。
- 檢查 `App.tsx` 行數與靜態 import 數量下降。
- 確認 shared state 更新仍能同步反映到首頁列表、統計與同步狀態頁。

## 假設

- 本項目是結構整理，不改變使用者可見功能。
