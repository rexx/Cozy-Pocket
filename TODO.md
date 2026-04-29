# 待辦事項

## 整體建議順序

1. ✅ 已支援商家更名，既有交易紀錄、搜尋、統計與同步資料會一致反映新名稱。
2. ✅ `SettingsPage` 已拆成單頁區段元件：偏好設定、同步設定、Tag 管理、匯入匯出與危險操作區，並完成視覺一致化。
3. ✅ `SyncStatusPage` 已支援預設隱藏已成功項目的篩選，讓使用者聚焦尚未處理或失敗的資料。
4. ✅ `SyncStatusPage` 的項目已可直接點入既有編輯 modal，方便從同步清單修正失敗或待同步資料。
5. ✅ 首頁月曆已支援左右滑動切換月份，且下方交易列表已支援左右滑動切換前後日。
6. ✅ 新增、複製或編輯交易儲存後，首頁會同步切到該筆交易日期，避免資料已建立但日列表停在舊日期。
7. ✅ 首頁已支援週／月切換模式，並會記住使用者最後一次選擇，讓近期交易與整月分布都能快速查看。
8. ✅ `AddTransactionModal` 的表單驗證已改為 modal 內嵌錯誤提示，並保留低調欄位標示。
9. ✅ 需要確認的危險操作已改用 `swal2` app 內對話框，交易新增／修改／刪除成功則試用 `swal2` auto-dismiss toast。
10. ✅ 統計卡片顯示多幣別時已改用統一圖示表示，不使用文字。
11. ✅ 今天按鈕已移除光暈效果，避免上方出現被截斷的視覺問題。（紀錄：[today-button-glow-clipping.md](docs/todo-references/today-button-glow-clipping.md)）
12. 🔴 修正設定頁面 header 顏色不符合整體視覺設計的問題。（計劃：[settings-header-color.md](docs/todo-references/settings-header-color.md)）
13. 🔴 提供可手動從 cloud 拉資料回本機的功能，作為現有同步流程之外的明確操作入口。（計劃：[manual-cloud-pull.md](docs/todo-references/manual-cloud-pull.md)）
14. 🟡 將交易項目的支付方式改為可用圖示顯示，提升列表辨識度。（計劃：[payment-method-icons.md](docs/todo-references/payment-method-icons.md)）
15. 🟡 將目前已存在的 `Gemini` 相關功能打開並接到可用入口，補齊必要的設定、錯誤提示與使用者回饋。（計劃：[gemini-entrypoint.md](docs/todo-references/gemini-entrypoint.md)）
16. 🟡 新增依類別彙整的統計頁或統計區塊，提供金額與筆數等基礎分析。（計劃：[category-stats.md](docs/todo-references/category-stats.md)）
17. 🟡 新增依商家彙整的統計頁或統計區塊，方便查看常去商家與消費分布。（計劃：[merchant-stats.md](docs/todo-references/merchant-stats.md)）
18. 🟡 評估是否將 `SettingsPage` 內更多 section 進一步升級為獨立 page，讓偏好設定、同步設定、Tag 管理、匯入匯出與危險操作可各自擁有更完整的資訊架構。（計劃：[settings-section-pages.md](docs/todo-references/settings-section-pages.md)）
19. 🟢 評估為非首頁頁面引入共用 page-shell pattern，讓 layout chrome 維持一致，同時讓 `App.tsx` 持續聚焦於 routing 與 shared state。（計劃：[shared-page-shell.md](docs/todo-references/shared-page-shell.md)）

## 通知與互動體驗

- ✅ `AddTransactionModal` 中阻擋式的 `alert()` 驗證已改為 modal 內嵌錯誤提示。
- ✅ `AddTransactionModal` 刪除確認、設定頁匯入／重置／插入範例資料確認已改用 `swal2` app 內對話框。
- ✅ 交易新增、修改、刪除成功已試用 `swal2` auto-dismiss toast。
- 🔴 當同步部分失敗時，從頁內狀態訊息提供可直接前往同步狀態頁的操作按鈕。（計劃：[sync-failure-status-link.md](docs/todo-references/sync-failure-status-link.md)）
- 🟡 抽出共用的通知文案與摘要組裝 helper，避免 toast 與頁內狀態訊息逐漸分歧。（計劃：[notification-message-helper.md](docs/todo-references/notification-message-helper.md)）
- 🟡 擴充 `SettingsPage` 的 status type，不只保留 `success | error | idle`，讓離線提醒與預覽提醒可使用更清楚的 `info` 或 `warning` 語意。（計劃：[settings-status-types.md](docs/todo-references/settings-status-types.md)）
- 🟡 改善全域 toast 元件，讓它能更穩定地承接稍長摘要，例如支援兩行換行或依訊息長度調整顯示時間。（計劃：[toast-resilience.md](docs/todo-references/toast-resilience.md)）
- 🟢 補上通知行為的 UI 測試，至少涵蓋以下情境：（計劃：[notification-ui-tests.md](docs/todo-references/notification-ui-tests.md)）
  - 匯入成功時不應重複顯示成功訊息。
  - 同步部分失敗時應顯示短 toast 與詳細頁內狀態。
  - Tag 更名應遵守與匯入、同步設定相同的 toast / status 分工。

### 建議順序
1. 同步部分失敗時提供可直接前往同步狀態頁的操作按鈕
2. 抽出共用通知文案與摘要組裝 helper
3. status type 精緻化
4. toast 元件優化
5. UI 測試補齊

## 導航與頁面架構

- ✅ 同步狀態頁已支援返回來源感知：從 `SettingsPage` 進入時返回設定頁，從首頁進入時返回首頁。
- ✅ 同步狀態頁的交易項目已可直接開啟既有編輯 modal，方便就地修正待同步或失敗資料。
- ✅ `SettingsPage` 已拆成單頁區段元件，下一步可視需要抽共用 page-shell 或 section state helper。
- ✅ 商家管理已從 `SettingsPage` 內嵌區塊升級為獨立頁面，避免長商家清單直接撐開設定頁。
- 🟡 評估是否將 `SettingsPage` 內的 section 升級成獨立 page，避免單頁設定在功能繼續擴張後再次膨脹。（計劃：[settings-section-pages.md](docs/todo-references/settings-section-pages.md)）
- 🟡 強化 `SyncStatusPage` 的互動，例如提供只看失敗 / 只看待同步的篩選，以及更清楚的重試導向操作。（計劃：[sync-status-filters-and-retry.md](docs/todo-references/sync-status-filters-and-retry.md)）
- 🟢 評估為非首頁頁面引入共用 page-shell pattern，讓 layout chrome 維持一致，同時讓 `App.tsx` 持續聚焦於 routing 與 shared state。（計劃：[shared-page-shell.md](docs/todo-references/shared-page-shell.md)）

### 建議順序
1. 評估 `SettingsPage` section page 化
2. `SyncStatusPage` 互動升級
3. 共用 page-shell 整理

## 首頁與日曆體驗

- ✅ 新增、複製或編輯交易儲存後，首頁會同步切到該筆交易日期，避免資料已建立但日列表停在舊日期。
- ✅ 首頁已支援週／月切換模式：週模式聚焦近期日期與交易，月模式保留整月分布檢視，且導覽手勢會跟隨模式切換。
- ✅ 今天按鈕已移除光暈效果，避免上方出現被截斷的視覺問題。（示意圖：[today-button-glow-clipped.jpg](docs/todo-references/today-button-glow-clipped.jpg)；紀錄：[today-button-glow-clipping.md](docs/todo-references/today-button-glow-clipping.md)）
- 🟡 將交易項目的支付方式改為可用圖示顯示，提升列表辨識度。（示意圖：[payment-method-icon.jpg](docs/todo-references/payment-method-icon.jpg)；計劃：[payment-method-icons.md](docs/todo-references/payment-method-icons.md)）

## 設定頁體驗

- 🔴 修正設定頁面 header 顏色不符合整體視覺設計的問題。（示意圖：[settings-header-color.jpg](docs/todo-references/settings-header-color.jpg)；計劃：[settings-header-color.md](docs/todo-references/settings-header-color.md)）

## 商家與資料維護

- ✅ 已支援商家更名，並確認既有交易紀錄、搜尋、統計與同步資料都能一致反映新名稱。
- 🟡 補齊商家名稱調整的驗證與回饋，避免產生重複商家或名稱變更後的 UI 狀態不一致。（計劃：[merchant-rename-validation.md](docs/todo-references/merchant-rename-validation.md)）
- 🟡 評估是否將商家管理改為進頁後直接查 IndexedDB，而不是依賴 App 全量載入的 `transactions` state。（計劃：[merchant-management-indexeddb-source.md](docs/todo-references/merchant-management-indexeddb-source.md)）
- 🟡 若商家數量持續成長，可加入商家搜尋、分頁或虛擬列表，降低管理頁渲染成本。（計劃：[merchant-management-search-pagination.md](docs/todo-references/merchant-management-search-pagination.md)）

## 統計與分析

- 🟡 新增依類別彙整的統計頁或統計區塊，提供金額與筆數等基礎分析。（計劃：[category-stats.md](docs/todo-references/category-stats.md)）
- 🟡 新增依商家彙整的統計頁或統計區塊，方便查看常去商家與消費分布。（計劃：[merchant-stats.md](docs/todo-references/merchant-stats.md)）
- ✅ 統計卡片顯示多幣別時已改用統一圖示表示，不使用文字。

## 匯入與外部資料

- 🔴 提供可手動從 cloud 拉資料回本機的功能，作為現有同步流程之外的明確操作入口。（計劃：[manual-cloud-pull.md](docs/todo-references/manual-cloud-pull.md)）

## AI 功能

- 🟡 將目前已存在的 `Gemini` 相關功能打開並接到可用入口，補齊必要的設定、錯誤提示與使用者回饋。（計劃：[gemini-entrypoint.md](docs/todo-references/gemini-entrypoint.md)）

## Bundle / Chunk 優化待辦

- 🔴 將非首頁 page 改為 `React.lazy`
  - 目標：降低初始主 bundle，避免 `App.tsx` 一開始就靜態吃進所有頁面。
  - 優先對象：`SettingsPage`、`SyncStatusPage`、`SearchPage`、`MonthlyStatsPage`、`MerchantManagementPage`、`AddTransactionModal`。
  - 驗證：重新比較 build 後的 `index-*.js` raw / gzip 大小，確認主 chunk 明顯下降且頁面切換正常。
- 🟡 將 `sweetalert2` 改為動態載入
  - 目標：把 `dialogService` 從主 bundle 移出，只在實際開啟 confirm dialog 時載入。
  - 做法：將 `dialogService` 內的 `sweetalert2` 改為 `import('sweetalert2')`。
  - 驗證：確認 `sweetalert2` 不再進主 `index-*` chunk，且 `AddTransactionModal`、`SettingsPage` 的 confirm 行為不變。
- 🟡 持續拆薄 `App.tsx`
  - 目標：降低 page orchestration 與 shared state 集中在單一檔案的耦合，讓 page-level lazy load 更自然。
  - 方向：把 page loader、transaction modal orchestration、shared data hooks 逐步拆出。
  - 驗證：`App.tsx` 行數與靜態 import 數量下降，且 routing / modal 流程維持穩定。

### 暫時不建議

- 🟢 不優先拆 `HomePage` / `Calendar` 成 lazy chunk
  - 原因：屬於首屏必要內容，通常對 initial load 幫助有限。
- 🟢 不優先把 `lucide-react` 再切得更碎
  - 原因：目前已從 wildcard import 改成明確 icon map，後續收益有限。
- 🟢 不改走 CDN external 依賴
  - 原因：對目前的 Vite + PWA 架構不划算，會增加部署、快取與離線相容性複雜度。

### 建議順序

1. 非首頁頁面全面改為 `React.lazy`
2. `sweetalert2` 改為動態載入
3. 持續拆薄 `App.tsx`
