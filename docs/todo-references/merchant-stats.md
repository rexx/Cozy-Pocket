# 依商家彙整統計實作計劃

本項目實作時會使用新的 git worktree 進行開發，不直接修改目前 repo 根目錄；建議 worktree 路徑為 `worktrees/merchant-stats`，完成後再由該分支提交與合併。

## 摘要

- 新增依商家彙整的統計區塊，方便查看常去商家與消費分布。
- 優先整合在 `MonthlyStatsPage`，沿用現有期間與篩選條件。
- 只統計有商家名稱的交易，空商家交易不列入商家排名。

## 關鍵變更

- 在 `services/statsService.ts` 新增 `getMerchantStats`，依商家與幣別彙整 total/count/latestTransactionAt。
- 在 `MonthlyStatsPage` 新增商家統計區塊，支援展開商家後查看交易列表。
- 排序預設以支出總額由高到低，其次筆數與最近交易時間。
- 商家名稱使用 `normalizeMerchantName` 規則，避免前後空白造成分組分裂。

## 介面與型別

- 新增 stats service 回傳型別，例如 `MerchantStatsItem`。
- 不變更商家儲存格式；商家名稱仍存在 `Transaction.merchant`。

## 測試計劃

- 執行 `npm run build`。
- 手動驗證月份/年份、tag、支付方式篩選後商家統計同步更新。
- 驗證多幣別交易不混算，且同一商家可分幣別顯示。
- 驗證空商家、同名商家、名稱前後空白的處理符合預期。

## 假設

- 第一版只做彙整與展開，不新增圖表。
