# 統計頁「依類別彙整」可收合區塊完成紀錄

本項目把統計頁每個幣別 section 的「依類別彙整」區塊改為預設收合，點擊標題列才會展開內容，維持原本的單頁排版，未導入分頁。

## 完成內容

- 在 `MonthlyStatsPage` 新增 `categoryBreakdownExpanded: Record<string, boolean>` state，key 為 currency code，預設為空 record（全部收合）。
- 標題列改為 `<button>`，點擊呼叫 `toggleCategoryBreakdownExpanded(currency)` 切換對應 currency 的展開狀態，並加上 `aria-expanded` 與 `aria-controls`，內容區塊掛對應的 `id="category-breakdown-<currency>"`。
- 標題列只保留主標「依類別彙整」（移除原本的 `分析` 小標）；右側保留「N 類別」徽章並加入 `ChevronDown` icon，展開時 chevron `rotate-180`。
- 收合時不渲染 `renderCategoryStatsGroup(...)`，包括支出／收入類別群組、子類別摘要與交易展開，避免額外計算與 DOM 成本。
- 多幣別下每個 currency section 的展開狀態彼此獨立，互不影響。
- 切換期間（月份／年份）或變更篩選時不強制收合，state 在 `MonthlyStatsPage` mount 期間保留；離開統計頁再回來會重置為收合。
- 當某 currency section 完全沒有類別資料（`categoryCount === 0`）時，整個收合區塊（含 border-t 分隔線）不渲染。

## 介面與資料

- 沒有新增對外型別或 service API；只在 `MonthlyStatsPage` 內部追加 `useState<Record<string, boolean>>`。
- 沒有變更 `Transaction`、stats service 回傳型別或 persisted settings。
- 不導入分頁／tab 結構，與既有的 `expandedSectionKey`、`expandedCategoryKey` state 共存不衝突。

## 驗證

- 已執行 `npm run build`（tsc strict + Vite production build 皆通過）。
- 預期手動驗證：預設進入統計頁時「依類別彙整」是收合狀態，只看得到標題、`N 類別` 徽章與 chevron。
- 預期手動驗證：點擊標題列後展開支出／收入類別群組、子類別摘要、交易列表，再次點擊可收合；chevron 旋轉狀態跟隨切換。
- 預期手動驗證：多幣別情境下每個 currency section 的展開狀態彼此獨立。
- 預期手動驗證：月份／年份、tag、支付方式、排除子類別等篩選與既有總計區塊互動正常，展開後類別內容隨篩選即時更新。
- 預期手動驗證：鍵盤可 focus 並用 Enter／Space 切換展開，`aria-expanded` 對應正確。
