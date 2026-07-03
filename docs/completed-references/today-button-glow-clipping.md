# 今天按鈕光暈移除修正紀錄

## 摘要

- 已修正首頁月曆 header 中「今」按鈕的 glow 被上方容器裁切的問題。
- 修正策略是直接移除「今」按鈕的光暈 shadow，未調整 header 或外層容器的 top padding。
- 改動聚焦在 `components/Calendar.tsx` 的今天按鈕 class。

## 關鍵變更

- 已移除今天按鈕 class 中的 glow shadow：`shadow-[0_0_10px_rgba(34,211,238,0.1)]`。
- 未修改 `Calendar` 外層 `p-4 pt-0`、header `mb-3` 或其他 top padding。
- 搜尋、日期 input、同步狀態與設定按鈕的垂直對齊維持不變。

## 介面與型別

- 不需要新增 props、型別或資料結構。
- 只調整 CSS class，未新增 DOM 包裝層。

## 驗證

- `npm run build` 已通過。
- 選取非今天日期時，「今」按鈕保留 cyan 按鈕本體，但不再顯示光暈。
- 今天日期時按鈕仍隱藏，header 不產生水平位移。
- header 高度與 top padding 未變更。

## 假設

- 視覺目標改為保留 cyan 按鈕本體，但移除光暈效果。
