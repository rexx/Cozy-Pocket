# 統計子類別 Progress Bar 完成紀錄

本項目讓統計頁展開類別後，子類別摘要也帶有 progress bar 與佔比，使用者可在主類別內快速比較各子類別的支出或收入比例。

## 完成內容

- 在 `MonthlyStatsPage` 的 `item.subcategories.map()` 區塊計算子類別佔比，分母採用展開主類別的 `item.total`，未展開的主類別不參與計算。
- 子類別卡片同列顯示 `count`、佔比文字與金額；佔比文字格式與主類別一致（`{筆數} 筆 · {百分比}%`）。
- 子類別 progress bar 沿用主類別顏色（`CATEGORIES[].color`），背景使用 `bg-white/5`、軌道高度為 `h-1`，視覺上比主類別細，避免層級混淆。
- 缺少子類別的交易維持以「未選子類別」彙整，且照樣計入佔比與 bar。
- 收入類別與支出類別都套用同一份呈現邏輯；金額文字維持中性灰色，僅 bar 顏色帶有類別語意。
- 子類別仍依金額、筆數與子類別 id 排序，與既有 `getCategoryStats` 行為一致。

## 介面與資料

- 沒有改 `CategoryStatsSubItem` 結構，直接讀取既有 `total`、`count`、`transactions`。
- 沒有新增 persisted settings 或交易欄位；佔比計算純為 render-time 推導。
- 子類別佔比僅在展開的主類別內計算，不跨主類別或跨幣別比較。

## 驗證

- 已執行 `npm run build`（tsc strict + Vite production build 皆通過）。
- 手動於 dev server 驗證月份／年份切換、tag 與支付方式篩選後，子類別 progress bar 與百分比同步更新。
- 手動驗證單一子類別時 bar 為 100%、多子類別時比例合計為 100%（受整數捨入影響時誤差在 ±1%）。
- 手動驗證缺少子類別、收入類別與多幣別資料的呈現都符合預期。
