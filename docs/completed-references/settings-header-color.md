# 設定頁 Header 外框色延伸紀錄

## 摘要

- 已修正設定頁 header 顏色與 PWA 外框色不一致的問題。
- 共用 `PageHeader` 已改用與 PWA 外框相同的 `#1a1c2c`，也就是 `index.html` 的 `theme-color` 與 manifest 的 `background_color/theme_color`。
- Header 背景一路延伸到畫面頂端，讓狀態列/外框區域與頁面 header 看起來是同一塊連續色面。
- Header 上方 padding 已縮減為 `pt-0`，對齊首頁月曆的頂部留白節奏。
- 最終改為所有共用 `PageHeader` 的頁面一致套用，包含設定頁、同步狀態頁、搜尋頁、統計頁、商家管理頁與新增／編輯交易 modal。

## 關鍵變更

- 將 `PageHeader` 背景改為 `#1a1c2c`，與 PWA 外框色一致，不再使用較亮的 `#1e1e2d` 作為共用頁面 header 背景。
- 讓 header 的同色背景延伸到 viewport 最上方，不改動內容區的 spacing 或 section layout。
- 將 `PageHeader` 的垂直 padding 從 `py-4` 調整為 `pt-0 pb-4`，降低手機 PWA 狀態列下方的空白感。
- 保留 header 下緣分隔線與返回按鈕/標題對比，避免 header 變成和內容區混在一起。
- 不調整 `index.html` 的 `theme-color` 或 manifest 色值；這次是讓共用 page header 對齊既有 PWA 外框色。

## 介面與型別

- 未新增 public API。
- `PageHeader` 既有呼叫點不需要新增 props，所有使用點都直接套用一致 header 色與頂部留白。

## 驗證

- 已執行 `npm run build`。
- 已用 dev server 手動檢查手機網址可開啟。
- 已在手機 PWA 模式與一般瀏覽器模式檢查 header 背景、底線、返回按鈕與標題對齊。
- 已檢查設定頁、同步狀態頁、搜尋頁、統計頁、商家管理頁與新增／編輯交易 modal 的 header 皆為一致外框色。

## 假設

- PWA 外框色以現有 `#1a1c2c` 為準，不導入新的主色系。
