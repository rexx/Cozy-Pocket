# 依類別彙整統計完成紀錄

## 摘要

- 統計頁已加入依類別彙整區塊，提供每個幣別下的支出類別與收入類別分析。
- 類別彙整沿用既有月份／年份、tag 與支付方式篩選，不新增 persisted data。
- 類別統計支援多幣別分開顯示，不做匯率換算或跨幣別合計。

## 已完成變更

- `services/statsService.ts` 新增 `getCategoryStats`，依幣別、收入／支出、主類別彙整 `total`、`count`、交易列表與子類別摘要。
- `components/MonthlyStatsPage.tsx` 在每個幣別卡片中加入「依類別彙整」區塊，支出類別優先顯示，收入類別接續顯示。
- 類別列使用 `categoryIconMap` 與 `constants.ts` 的分類名稱、圖示與顏色，並顯示金額、筆數與占同類型總額比例。
- 類別列可展開，展開後直接顯示子類別統計卡片與既有 `TransactionItem` 交易列表。
- 類別排序採金額由高到低，再以筆數與類別名稱排序；子類別摘要採金額、筆數與子類別 id 排序。

## 介面與型別

- 新增 `CategoryStatsItem` 與 `CategoryStatsSubItem` 作為統計 service 回傳型別。
- 不變更 `Transaction` 模型，不新增資料表或本機儲存欄位。

## 驗證

- 已執行 `npm run build`。
- 手動驗證月份／年份切換、tag 篩選、支付方式篩選後類別統計同步更新。
- 驗證多幣別交易分幣別顯示，不混算。
- 驗證類別列可展開，並保留子類別統計卡片與交易列表。
- 驗證無資料、只有收入、只有支出、缺少子類別資料時都有合理 fallback。

## 後續

- 若類別統計互動繼續增加，可把類別彙整 UI 從 `MonthlyStatsPage.tsx` 拆成獨立 component。
