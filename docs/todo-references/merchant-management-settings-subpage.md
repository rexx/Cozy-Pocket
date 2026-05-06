# Merchant Management 設定子頁化計劃

本項目實作時會使用新的 git worktree 進行開發，不直接修改目前 repo 根目錄；建議 worktree 路徑為 `worktrees/merchant-management-settings-subpage`，完成後再由該分支提交與合併。

## 摘要

- 將目前獨立的 `MerchantManagementPage` 併入 `SettingsPage` 的正式設定子頁模型。
- 目標是讓商家管理與偏好設定、同步設定、Tag 管理、匯入匯出、危險操作走一致的設定首頁卡片、設定子頁 routing、header 與背景 accent 規則。
- 本項目先列入 TODO，不在目前 settings section pages 變更中實作，避免與 merchant 相關功能調整產生衝突。

## 關鍵變更

- 擴充 `SettingsSectionPage`，新增 merchant 對應的設定子頁 key。
- 將商家管理入口納入 `SETTINGS_SECTION_COPY` 或後續統一的設定首頁卡片 copy 結構。
- 調整 `AppView` 與 settings view map，讓商家管理走 `settings-merchant` 類型的設定子頁 view。
- 將 `MerchantManagementPage` 的 container 邏輯整理到 `SettingsPage` 子頁 render flow，或拆成可被 settings 子頁直接掛載的 container。
- 保留 `MerchantManagementSection` 作為 UI section，並維持既有商家更名、預覽與相關交易點擊行為。

## 測試計劃

- 執行 `npm run build`。
- 手動驗證設定首頁進入商家管理、左上返回設定首頁、瀏覽器返回鍵行為一致。
- 驗證商家更名預覽、確認更名、離線提示、同步失敗提示與交易點擊編輯 modal 不退化。
- 驗證設定首頁商家數量、Tag 數量與其他設定卡片資訊不互相影響。

## 暫緩原因

- Merchant 管理近期可能還會有搜尋、分頁、資料來源或更名驗證相關變更。
- 先暫緩 routing/container 合併，可以降低 merge conflict 與重複調整商家管理狀態流程的風險。
