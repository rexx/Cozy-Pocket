# 依類別彙整統計實作計劃

本項目實作時會使用新的 git worktree 進行開發，不直接修改目前 repo 根目錄；建議 worktree 路徑為 `worktrees/category-stats`，完成後再由該分支提交與合併。

## 摘要

- 新增依類別彙整的統計區塊，提供金額與筆數等基礎分析。
- 優先整合在現有 `MonthlyStatsPage`，沿用月份/年份、tag、支付方式篩選。
- 類別統計需支援多幣別，不強制換算。

## 關鍵變更

- 在 `services/statsService.ts` 新增 `getCategoryStats`，依幣別、收入/支出、主類別與子類別彙整 total/count。
- 在 `components/MonthlyStatsPage.tsx` 增加類別統計 view 或 section，顯示排序後的類別列。
- 類別列使用 `categoryIconMap` 與 `constants.ts` 的分類名稱、顏色，點擊後可展開該類別交易列表。
- 排序預設以支出金額由高到低，再以筆數與名稱排序。

## 介面與型別

- 新增 stats service 回傳型別，例如 `CategoryStatsItem`。
- 不變更 `Transaction` 模型，不新增 persisted data。

## 測試計劃

- 執行 `npm run build`。
- 手動驗證月份/年份切換、tag 篩選、支付方式篩選後類別統計同步更新。
- 驗證多幣別交易會分幣別顯示，不混算。
- 驗證無資料、只有收入、只有支出、缺少子類別資料時都有合理 fallback。

## 假設

- 第一版以主類別為主要分組，支出可在展開後顯示子類別明細。
