# 依商家彙整統計紀錄

## 摘要

- 統計頁新增「依商家彙整」區塊，整合在 `MonthlyStatsPage` 既有期間與篩選條件下方，沿用同一套幣別卡片。
- 只統計有商家名稱的交易；空商家交易仍計入收支與類別總額，但不會出現在商家清單。
- 第一版聚焦於彙整與展開，未加入圖表。

## 最終行為

- 每個幣別卡片在「依類別彙整」下方顯示「依商家彙整」區塊，預設收合；標題列右側顯示商家數量徽章與展開／收合 chevron，點擊才會渲染商家群組。
- 群組分為「支出商家」與「收入商家」兩段；當該幣別在目前篩選下沒有收入時，整段隱藏與既有收入摘要卡同步。
- 商家列表使用 `Store` 圖示與深色 accent（支出 `#427267`、收入 `#7A4E5F`），與既有類別卡片視覺有所區隔。
- 每張商家卡顯示商家名稱、筆數、佔該幣別同類型總額的百分比、總金額與依百分比寬度的 progress bar。
- 點擊商家卡會展開該商家的交易列表，沿用 `TransactionItem`；同時間只會展開一個收入／支出區塊、類別或商家，避免清單同時撐開。
- 切換期間、tag、支付方式、月份／年份模式會重置展開狀態並重新計算商家清單。

## 介面與型別

- `services/statsService.ts` 新增 `MerchantStatsItem` 型別（`currency` / `type` / `merchant` / `total` / `count` / `latestTransactionAt` / `transactions`）與 `getMerchantStats` 函數。
- 分組 key 為 `currency:type:normalized-merchant`，正規化沿用既有 `normalizeMerchantName`，比對採大小寫不敏感；顯示名稱保留正規化後的原始大小寫。
- 排序依序為：currency asc → 支出在前 → total desc → count desc → latestTransactionAt desc → merchant locale。
- 不變更商家儲存格式，商家名稱仍存在 `Transaction.merchant`。

## 驗證

- 執行 `npm run build` 通過 `tsc --strict` 與 Vite production build。
- 在 `worktrees/merchant-stats` dev server 上手動驗證月份／年份、tag、支付方式篩選後商家彙整同步更新，且切換時展開狀態 reset。
- 驗證多幣別交易不混算、同一商家可在不同幣別各自列出。
- 驗證空商家交易不會出現在商家清單，但仍計入幣別總額；前後空白不同的同名商家會合併到同一項。
- 在 Microsoft Edge 確認商家卡互斥展開、與類別卡互不干擾、Console 無新增 runtime error。
