# Settings Section 獨立頁評估與實作計劃

本項目實作時會使用新的 git worktree 進行開發，不直接修改目前 repo 根目錄；建議 worktree 路徑為 `worktrees/settings-section-pages`，完成後再由該分支提交與合併。

## 摘要

- 評估是否將 `SettingsPage` 內更多 section 升級成獨立 page。
- 目標是避免設定頁隨功能增加再次膨脹，讓偏好設定、同步設定、Tag 管理、匯入匯出與危險操作有更清楚的資訊架構。
- 先以低風險方式建立設定首頁與單一 section 詳細頁導覽。

## 關鍵變更

- 在 `App.tsx` 擴充 view routing，支援設定子頁，例如 `settings-sync`、`settings-tags`。
- 將 `components/settings/*Section.tsx` 保留為內容元件，外層改由各 page 包裝 `PageHeader` 與狀態訊息。
- `SettingsPage` 改為設定入口清單，提供每個 section 的摘要與進入按鈕。
- 優先 page 化資訊量較大的 Sync、Tag、Import/Export；危險操作可保留在設定首頁或獨立頁視風險決定。

## 介面與型別

- 擴充 `AppView` union 與 history state。
- 各 section props 維持現有行為；若 props 過多，建立 settings page container 協調狀態。

## 測試計劃

- 執行 `npm run build`。
- 手動驗證從設定首頁進入各 section、返回設定首頁、瀏覽器返回鍵與同步狀態返回來源。
- 驗證既有同步設定、匯入匯出、tag 更名與危險操作功能不退化。
- 檢查手機寬度下頁面高度、scroll 與 header 固定感一致。

## 假設

- 本項目可先做資訊架構與導覽，不必一次重設所有 section UI。
