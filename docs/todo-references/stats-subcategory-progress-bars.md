# 統計子類別 Progress Bar 實作計劃

本項目實作時會使用新的 git worktree 進行開發，不直接修改目前 repo 根目錄；建議 worktree 路徑為 `worktrees/stats-subcategory-progress-bars`，完成後再由該分支提交與合併。

## 摘要

- 在統計頁展開類別後，讓子類別摘要也顯示 progress bar 與佔比。
- 目標是讓使用者在主類別內快速比較各子類別的支出或收入佔比。
- 沿用目前 `MonthlyStatsPage` 的類別展開 UI，不新增獨立頁面或圖表套件。

## 關鍵變更

- 在 `MonthlyStatsPage` 的 `item.subcategories.map()` 區塊計算子類別佔比，分母使用目前展開主類別的 `item.total`。
- 子類別卡片顯示 `count`、金額、百分比文字與 progress bar。
- progress bar 顏色優先沿用主類別顏色，收入與支出仍保留現有金額色彩語意。
- 缺少子類別的交易維持顯示為「未選子類別」，並照樣計入佔比。
- 保留既有排序：子類別仍依金額、筆數與子類別 id 排序。

## 介面與型別

- 不需要變更 `CategoryStatsSubItem`；可直接使用既有 `total`、`count`、`transactions`。
- 不新增 persisted settings 或交易欄位。

## 測試計劃

- 執行 `npm run build`。
- 手動驗證月份／年份、tag、支付方式篩選後，子類別 progress bar 與百分比同步更新。
- 驗證單一子類別時 progress bar 為 100%，多個子類別時比例正確。
- 驗證缺少子類別、收入類別與多幣別資料都有合理顯示。

## 假設

- 子類別佔比只在已展開的主類別內計算，不跨主類別或跨幣別比較。
