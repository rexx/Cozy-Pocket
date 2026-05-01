# 待辦事項

## 通知與互動體驗

- 🔴 當同步部分失敗時，從頁內狀態訊息提供可直接前往同步狀態頁的操作按鈕。（計劃：[sync-failure-status-link.md](docs/todo-references/sync-failure-status-link.md)）
- 🟡 抽出共用的通知文案與摘要組裝 helper，避免 toast 與頁內狀態訊息逐漸分歧。（計劃：[notification-message-helper.md](docs/todo-references/notification-message-helper.md)）
- 🟡 擴充 `SettingsPage` 的 status type，不只保留 `success | error | idle`，讓離線提醒與預覽提醒可使用更清楚的 `info` 或 `warning` 語意。（計劃：[settings-status-types.md](docs/todo-references/settings-status-types.md)）
- 🟡 改善全域 toast 元件，讓它能更穩定地承接稍長摘要，例如支援兩行換行或依訊息長度調整顯示時間。（計劃：[toast-resilience.md](docs/todo-references/toast-resilience.md)）
- 🟢 補上通知行為的 UI 測試。（計劃：[notification-ui-tests.md](docs/todo-references/notification-ui-tests.md)）
- ✅ `AddTransactionModal` 中阻擋式的 `alert()` 驗證已改為 modal 內嵌錯誤提示，並保留低調欄位標示。
- ✅ `AddTransactionModal` 刪除確認、設定頁匯入／重置／插入範例資料確認已改用 `swal2` app 內對話框。
- ✅ 交易新增、修改、刪除成功已試用 `swal2` auto-dismiss toast。

## 導航與頁面架構

- 🟡 評估是否將 `SettingsPage` 內更多 section 進一步升級為獨立 page，讓偏好設定、同步設定、Tag 管理、匯入匯出與危險操作可各自擁有更完整的資訊架構。（計劃：[settings-section-pages.md](docs/todo-references/settings-section-pages.md)）
- 🟡 強化 `SyncStatusPage` 的互動，例如提供只看失敗 / 只看待同步的篩選，以及更清楚的重試導向操作。（計劃：[sync-status-filters-and-retry.md](docs/todo-references/sync-status-filters-and-retry.md)）
- 🟢 評估為非首頁頁面引入共用 page-shell pattern，讓 layout chrome 維持一致，同時讓 `App.tsx` 持續聚焦於 routing 與 shared state。（計劃：[shared-page-shell.md](docs/todo-references/shared-page-shell.md)）
- ✅ 同步狀態頁已支援返回來源感知：從 `SettingsPage` 進入時返回設定頁，從首頁進入時返回首頁。
- ✅ `SyncStatusPage` 已支援預設隱藏已成功項目的篩選，讓使用者聚焦尚未處理或失敗的資料。
- ✅ 同步狀態頁的交易項目已可直接開啟既有編輯 modal，方便就地修正待同步或失敗資料。
- ✅ `SettingsPage` 已拆成單頁區段元件：偏好設定、同步設定、Tag 管理、匯入匯出與危險操作區，並完成視覺一致化。
- ✅ 商家管理已從 `SettingsPage` 內嵌區塊升級為獨立頁面，避免長商家清單直接撐開設定頁。

## 首頁與日曆體驗

- ✅ 新增、複製或編輯交易儲存後，首頁會同步切到該筆交易日期，避免資料已建立但日列表停在舊日期。
- ✅ 首頁月曆已支援左右滑動切換月份，且下方交易列表已支援左右滑動切換前後日。（紀錄：[home-week-calendar.md](docs/todo-references/home-week-calendar.md)）
- ✅ 首頁已支援週／月切換模式，並會記住使用者最後一次選擇；週模式聚焦近期日期與交易，月模式保留整月分布檢視，且導覽手勢會跟隨模式切換。
- ✅ 今天按鈕已移除光暈效果，避免上方出現被截斷的視覺問題。（紀錄：[today-button-glow-clipping.md](docs/todo-references/today-button-glow-clipping.md)）
- ✅ 交易項目的支付方式已支援文字／圖示顯示偏好，預設保留文字並可在偏好設定切換，圖示模式使用與新增／編輯 modal 一致的圖示。（計劃：[payment-method-icons.md](docs/todo-references/payment-method-icons.md)）

## 設定頁體驗

- ✅ 共用頁面 header 已對齊 PWA 外框色，並縮減上方留白，讓設定頁與同步狀態等頁面在手機 PWA 上更連續。（示意圖：[settings-header-color.jpg](docs/todo-references/settings-header-color.jpg)；紀錄：[settings-header-color.md](docs/todo-references/settings-header-color.md)）

## 商家與資料維護

- 🟡 補齊商家名稱調整的驗證與回饋，避免產生重複商家或名稱變更後的 UI 狀態不一致。（計劃：[merchant-rename-validation.md](docs/todo-references/merchant-rename-validation.md)）
- 🟡 評估是否將商家管理改為進頁後直接查 IndexedDB，而不是依賴 App 全量載入的 `transactions` state。（計劃：[merchant-management-indexeddb-source.md](docs/todo-references/merchant-management-indexeddb-source.md)）
- 🟡 若商家數量持續成長，可加入商家搜尋、分頁或虛擬列表，降低管理頁渲染成本。（計劃：[merchant-management-search-pagination.md](docs/todo-references/merchant-management-search-pagination.md)）
- ✅ 已支援商家更名，並確認既有交易紀錄、搜尋、統計與同步資料都能一致反映新名稱。

## 統計與分析

- 🟡 新增依類別彙整的統計頁或統計區塊，提供金額與筆數等基礎分析。（計劃：[category-stats.md](docs/todo-references/category-stats.md)）
- 🟡 新增依商家彙整的統計頁或統計區塊，方便查看常去商家與消費分布。（計劃：[merchant-stats.md](docs/todo-references/merchant-stats.md)）
- ✅ 統計卡片顯示多幣別時已改用統一圖示表示，不使用文字。

## 匯入與外部資料

- 🟡 年度雲端同步後端待驗證：新版 GAS `action: "get"` 尚需部署，並以真實 Google Sheets 端到端驗證。（紀錄：[manual-cloud-pull.md](docs/todo-references/manual-cloud-pull.md)）
- ✅ 年度雲端同步前端已完成：入口、年份選擇、mock API、本地同步報告與報告 UI 已可測試。（紀錄：[manual-cloud-pull.md](docs/todo-references/manual-cloud-pull.md)）

## AI 功能

- 🟡 將目前已存在的 `Gemini` 相關功能打開並接到可用入口，補齊必要的設定、錯誤提示與使用者回饋。（計劃：[gemini-entrypoint.md](docs/todo-references/gemini-entrypoint.md)）

## Bundle / Chunk 優化待辦

- 🔴 將非首頁 page 改為 `React.lazy`。（計劃：[lazy-load-non-home-pages.md](docs/todo-references/lazy-load-non-home-pages.md)）
- 🟡 將 `sweetalert2` 改為動態載入。（計劃：[dynamic-sweetalert2.md](docs/todo-references/dynamic-sweetalert2.md)）
- 🟡 持續拆薄 `App.tsx`。（計劃：[app-tsx-decomposition.md](docs/todo-references/app-tsx-decomposition.md)）
- 🟡 建立 bundle size baseline 與驗收門檻。（計劃：[bundle-size-baseline.md](docs/todo-references/bundle-size-baseline.md)）
- 🟡 評估 PWA precache 對 lazy chunk 的實際影響。（計劃：[pwa-precache-lazy-chunks.md](docs/todo-references/pwa-precache-lazy-chunks.md)）
- 🟡 為 lazy-loaded page / dialog 補上 fallback 或 prefetch 策略。（計劃：[lazy-load-fallback-prefetch.md](docs/todo-references/lazy-load-fallback-prefetch.md)）
- 🟢 不優先拆 `HomePage` / `Calendar` 成 lazy chunk。（紀錄：[home-calendar-lazy-chunk-deprioritized.md](docs/todo-references/home-calendar-lazy-chunk-deprioritized.md)）
- 🟢 不優先把 `lucide-react` 再切得更碎。（紀錄：[lucide-react-further-splitting.md](docs/todo-references/lucide-react-further-splitting.md)）
- 🟢 不改走 CDN external 依賴。（紀錄：[cdn-external-dependencies.md](docs/todo-references/cdn-external-dependencies.md)）
