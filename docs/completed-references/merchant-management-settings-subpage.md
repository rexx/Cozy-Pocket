# Merchant Management 設定子頁化紀錄

實作於 worktree `worktrees/merchant-management-settings-subpage`，分支同名，最後合併回 `main`。

## 摘要

- 將原本獨立的 `MerchantManagementPage` 併入 `SettingsPage` 的設定子頁模型。
- 商家管理與偏好設定、同步設定、Tag 管理、匯入匯出、危險操作共用同一套設定首頁卡片、設定子頁 routing、header 與背景 accent 規則。
- 不再有 `merchant-management` 這個獨立的 top-level view；改以 `settings-merchant` 子頁 view 表示。

## 變更內容

- `components/settings/settingsSectionCopy.ts`：在 `SETTINGS_SECTION_COPY` 中新增 `merchant` key，並移除原本獨立的 `MERCHANT_MANAGEMENT_COPY`。
- `components/SettingsPage.tsx`：
  - 新增 `MerchantManagementSection` import 與 case 分支。
  - 新增 merchant rename 相關 state、useEffect、reset / preview / rename handler，與 tag 流程對齊。
  - 將原本特例的「商家管理」入口卡片改為一般的 overview item，沿用 amber accent。
  - 加入 `merchant: 'rgba(245,158,11,0.12)'` 至 `SECTION_GLOW_COLORS`。
  - 移除 `onOpenMerchantManagement` props，改接 `onPreviewMerchantRename` / `onRenameMerchant` / `onGetMerchantTransactions` / `onMerchantTransactionClick` / `merchantSummaries`。
- `App.tsx`：
  - `AppView` 加入 `settings-merchant`，移除 `merchant-management`。
  - `SETTINGS_SECTION_VIEW_MAP` / `SETTINGS_VIEW_SECTION_MAP` 加上 merchant 對應。
  - 以 `getMerchantUsageSummaries` 計算 `merchantUsageSummaries` 取代原本的 `merchantCount` Set 計算。
  - 移除整段 `merchant-management` view block 與 `MerchantManagementPage` import。
  - 將 merchant rename 與相關交易 callback 直接傳給 `SettingsPage`。
- 刪除 `components/MerchantManagementPage.tsx`（已無使用方）。
- `README.md` / `AGENTS.md` / `TODO.md`：更新主頁面數量、頁面元件對應、設定子頁清單與狀態描述。

## 驗證

- `npm run build`（tsc --strict + Vite）通過。
- 手動驗證項目（建議在 PWA 模式下執行）：
  - 設定首頁 → 商家管理卡片 → 商家管理子頁 → 左上返回。
  - 瀏覽器返回鍵從商家子頁回到設定首頁，再回到首頁。
  - 商家更名預覽、確認更名、離線提示、同步失敗提示。
  - 商家相關交易點擊可開啟既有編輯 modal，且編輯 modal 關閉後仍停留在商家子頁。
  - 設定首頁商家數量與 Tag 數量同步刷新，不互相影響。
