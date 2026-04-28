# 共用 Page Shell 實作計劃

本項目實作時會使用新的 git worktree 進行開發，不直接修改目前 repo 根目錄；建議 worktree 路徑為 `worktrees/shared-page-shell`，完成後再由該分支提交與合併。

## 摘要

- 評估並引入非首頁頁面的共用 page-shell pattern。
- 目標是讓 layout chrome、背景、header、scroll 容器與 safe-area 處理一致，同時讓 `App.tsx` 專注於 routing 與 shared state。
- 適用頁面包含設定、同步狀態、搜尋、統計與商家管理。

## 關鍵變更

- 新增共用 shell 元件，例如 `components/PageShell.tsx`，負責全頁背景、header slot、內容 scroll 區與 spacing。
- 將 `PageHeader` 納入 shell 組合，避免每個頁面各自處理外層 flex、高度與背景。
- 逐步改造 `SettingsPage`、`SyncStatusPage`、`MonthlyStatsPage`、`MerchantManagementPage`，每次保持視覺一致。
- 避免改動首頁 `HomePage`，首頁保留專屬沉浸式 layout。

## 介面與型別

- 新增 `PageShell` props：`title`、`leftAction`、`onLeftAction`、`rightSlot`、`children`、可選 `contentClassName`。
- `PageHeader` 可保持獨立供 modal 使用，或由 `PageShell` 組合使用。

## 測試計劃

- 執行 `npm run build`。
- 手動驗證所有非首頁頁面的 header、背景、scroll、返回行為與原功能一致。
- 檢查手機直向、桌面寬度與 PWA safe area 下沒有內容被裁切。
- 確認 `App.tsx` 沒有承擔頁面視覺細節。

## 假設

- 本項目是結構整理，不新增使用者功能。
