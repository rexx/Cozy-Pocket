# 設定頁 Header 外框色延伸計劃

本項目實作時會使用新的 git worktree 進行開發，不直接修改目前 repo 根目錄；建議 worktree 路徑為 `worktrees/settings-header-color`，完成後再由該分支提交與合併。

## 摘要

- 修正設定頁 header 顏色與 PWA 外框色不一致的問題。
- Header bar 應使用與 PWA 外框相同的 `#1a1c2c`，也就是 `index.html` 的 `theme-color` 與 manifest 的 `background_color/theme_color`。
- Header 背景需要一路延伸到畫面頂端，讓狀態列/外框區域與設定頁 header 看起來是同一塊連續色面。
- 參考圖：`docs/todo-references/settings-header-color.jpg`。
- 優先針對設定頁處理；不要為了這個需求改變首頁或其他頁面的視覺層級。

## 關鍵變更

- 將設定頁使用的 header bar 背景改為 `#1a1c2c`，與 PWA 外框色一致，不使用目前較亮的 `#1e1e2d` 作為設定頁 header 背景。
- 讓設定頁 header 的同色背景延伸到 viewport 最上方；若需要額外容器，應只補同色 top band，不改動內容區的 spacing 或 section layout。
- 保留 header 下緣分隔線與返回按鈕/標題對比，避免 header 變成和內容區混在一起。
- 若共用 `PageHeader` 會影響其他頁面，為 `PageHeader` 增加可選 `className`、`tone` 或 `backgroundClassName`，由 `SettingsPage` 指定外框色。
- 不調整 `index.html` 的 `theme-color` 或 manifest 色值；這次是讓設定頁 header 對齊既有 PWA 外框色。

## 介面與型別

- 優先不新增 public API。
- 若需要新增 `PageHeader` props，限定為可選的 `className`、`tone` 或 `backgroundClassName`，既有呼叫點維持預設行為。

## 測試計劃

- 執行 `npm run build`。
- 手動檢查設定頁 header 與 PWA 外框/狀態列區域同色，視覺上一路延伸到畫面頂端。
- 在手機 PWA 模式與一般瀏覽器模式檢查 header 背景、底線、返回按鈕與標題對齊。
- 檢查同步狀態頁、統計頁、商家管理頁 header 沒有因共用元件調整而非預期變色。

## 假設

- PWA 外框色以現有 `#1a1c2c` 為準，不導入新的主色系。
