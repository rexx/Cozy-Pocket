# Settings Section 獨立頁評估與實作計劃

本項目實作時會使用新的 git worktree 進行開發，不直接修改目前 repo 根目錄；實際 worktree 路徑為 `worktrees/settings-section-pages`。

狀態：已完成，實作於 `settings-section-pages` branch。

## 摘要

- 將 `SettingsPage` 從長型單頁改為設定入口清單。
- 讓偏好設定、AI 設定、同步設定、Tag 管理、匯入匯出與危險操作各自進入設定子頁。
- 保留既有 section 元件與資料 handler，先完成資訊架構與導覽調整，避免同步、CSV 與 Tag 更名流程大幅重寫。
- 設定子頁只保留上方 page header 與置中副標題，內容以玻璃感功能子卡牌呈現，避免重複標題與多層卡牌。

## 關鍵變更

- 在 `App.tsx` 擴充 view routing，新增 `settings-preferences`、`settings-ai`、`settings-sync`、`settings-tags`、`settings-import-export` 與 `settings-danger`。
- `SettingsPage` 新增 `SettingsSectionPage` 型別，依目前 section render 對應設定子頁。
- `SettingsPage` 首頁改為入口卡片清單，顯示各設定區摘要與進入操作。
- 各 `components/settings/*Section.tsx` 保留為內容元件，外層由 `SettingsPage` 包裝 `PageHeader`、置中副標題、status 訊息、底部品牌 footer 與年度雲端同步 dialog。
- 新增 `components/settings/settingsSectionCopy.ts`，讓設定首頁入口卡片與設定子頁共用 title / description copy。
- `PreferencesSection` 拆成支付方式顯示與幣別選項兩張功能子卡牌，幣別清單預設直接展開。
- `ImportExportSection` 與 `DangerZoneSection` 移除子卡牌標題區圖示，改由操作按鈕承載 icon；同步、AI、tag 更名與商家更名等主要操作按鈕也維持 icon + label。
- 設定首頁顯示 tag 數量與商家數量；商家數量只用已載入交易建立唯一商家 `Set`。
- 商家管理維持既有獨立頁面，設定首頁提供入口卡片；後續子頁化另列 TODO。

## 介面與型別

- 擴充 `AppView` union 與 settings section/view 對照表。
- `SettingsPage` 新增 `section`、`onCloseSection` 與 `onOpenSection` props。
- 各 section props 維持既有行為，沒有改變同步、CSV、Tag 更名或危險操作的資料流程。
- `SettingsSection` 簡化為 section 內部間距 wrapper；功能子卡牌統一使用玻璃感 `sectionPanelClassName`。

## 測試計劃

- 執行 `npm run build`。
- 手動驗證從設定首頁進入各 section、返回設定首頁、瀏覽器返回鍵與同步狀態返回來源。
- 驗證既有同步設定、匯入匯出、tag 更名與危險操作功能不退化。
- 檢查手機寬度下頁面高度、scroll 與 header 固定感一致。
- 驗證設定子頁副標題置中、功能子卡牌玻璃感一致、主要操作按鈕都有圖示。

## 假設

- 本項目先做資訊架構與導覽，不一次重設所有 section UI。
- `SettingsPage` 仍可作為設定資料流程 container，避免各設定子頁重複讀寫 IndexedDB 或同步服務。
