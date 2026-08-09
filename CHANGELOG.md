# 變更紀錄

已完成並上線的功能與修正，依主題分組（沿用 `TODO.md` 的 section）。精確時間軸以 `git log` 為準；每項的實作細節見連結的 `docs/completed-references/`（少數尚有後續工作的項目連到 `docs/todo-references/`）。

`TODO.md` 只保留尚未完成的項目（🔴 高優先 / 🟡 規劃中 / 🟢 已評估暫緩）；完成的項目搬到此檔。

## 通知與互動體驗

- ✅ 偏好設定新增「Error Banner (Debug)」顯示／隱藏開關，控制畫面最上方錯誤訊息紅色區塊，預設隱藏；錯誤仍持續捕捉，開啟後可檢視累積的全域錯誤。（紀錄：[error-banner-toggle.md](docs/completed-references/error-banner-toggle.md)）
- ✅ 新增／編輯交易頁面的 Tag 建議項目已改依最後出現時間排序，最近使用的 tag 排在最前面；商家與項目名稱建議排序不變。（紀錄：[tag-suggestion-recency-sort.md](docs/completed-references/tag-suggestion-recency-sort.md)）
- ✅ Tag 建議的 recency 排序已排除未來日期交易：`lastUsedAt` 改為只取「不晚於現在」的交易最大 `timestamp`，只在未來用過的 tag 不再被推到最前。（紀錄：[tag-suggestion-recency-exclude-future.md](docs/completed-references/tag-suggestion-recency-exclude-future.md)）
- ✅ 點下搜尋按鈕進入搜尋畫面時會在同一個點擊事件內同步聚焦搜尋輸入框，iPhone PWA 上會一併彈出虛擬鍵盤。（紀錄：[search-page-auto-focus.md](docs/completed-references/search-page-auto-focus.md)）
- ✅ 新增交易 modal 開啟時不再自動 focus 金額輸入框，避免在 iPhone PWA 上一開啟就彈出虛擬鍵盤；切到 AI tab 仍會自動 focus AI 輸入框。（紀錄：[add-transaction-no-auto-focus.md](docs/completed-references/add-transaction-no-auto-focus.md)）
- ✅ 交易新增 / 修改 / 刪除成功的 swal toast 曾從貼底 pill 改為畫面正中央的圓角方形 modal（紀錄：[alert-toast-center.md](docs/completed-references/alert-toast-center.md)）；此決策已被 toast 系統統一取代，改回底部輕量 toast（紀錄：[unify-toast-system.md](docs/completed-references/unify-toast-system.md)）。
- ✅ 統一 toast 系統：瞬時回饋一律使用底部輕量 toast，`swal2` 只保留互動確認對話框，並移除設定頁與 toast 重複的 inline status。（紀錄：[unify-toast-system.md](docs/completed-references/unify-toast-system.md)）
- ✅ 設定頁在同步部分失敗時，頁內狀態訊息會附帶可直接前往同步狀態頁的「查看同步狀態」按鈕，覆蓋同步設定儲存、Tag 更名、商家更名、CSV 匯入四個場景。（紀錄：[sync-failure-status-link.md](docs/completed-references/sync-failure-status-link.md)）
- ✅ 新增／編輯項目發生驗證錯誤時，錯誤卡會 shake、金額與類別紅框會 pulse，重複按儲存也會重新觸發。（紀錄：[transaction-validation-error-animation.md](docs/completed-references/transaction-validation-error-animation.md)）
- ✅ `AddTransactionModal` 中阻擋式的 `alert()` 驗證已改為 modal 內嵌錯誤提示，並保留低調欄位標示。（紀錄：[add-transaction-inline-validation.md](docs/completed-references/add-transaction-inline-validation.md)）
- ✅ `AddTransactionModal` 刪除確認、設定頁匯入／重置／插入範例資料確認已改用 `swal2` app 內對話框。（紀錄：[app-confirm-dialogs.md](docs/completed-references/app-confirm-dialogs.md)）
- ✅ 交易新增、修改、刪除成功已試用 `swal2` auto-dismiss toast。

## 導航與頁面架構

- ✅ `TagManagementSection` 與 `MerchantManagementSection` 各自持有更名流程 state（選取、新名稱、預覽、送出、相關交易與 inline status），`SettingsPage` 只負責 routing 與 props 透傳；切換設定子頁再返回會重置選取與預覽。（紀錄：[section-owned-rename-state.md](docs/completed-references/section-owned-rename-state.md)）
- ✅ `SettingsPage` 共用的 `status` state 已拆解到各 Section（偏好 / AI / 同步 / 匯入匯出 / 危險操作）自管，並抽出共用 `SettingsFeedbackCard`；container 移除 `status`／`renderStatusMessage` 與 `section !== 'merchant'` special case，年度雲端同步 dialog 也移入 `SyncSection`。（紀錄：[section-owned-status-state.md](docs/completed-references/section-owned-status-state.md)）
- ✅ 交易編輯頁面底部已顯示同步狀態，待同步與同步失敗交易可直接點左側狀態圖示觸發單筆上傳。（紀錄：[transaction-edit-sync-status-retry.md](docs/completed-references/transaction-edit-sync-status-retry.md)）
- ✅ `SettingsPage` 已升級為設定入口清單，偏好設定、AI 設定、同步設定、Tag 管理、匯入匯出與危險操作已各自進入設定子頁。（紀錄：[settings-section-pages.md](docs/completed-references/settings-section-pages.md)）
- ✅ 同步狀態頁已支援返回來源感知：從 `SettingsPage` 進入時返回設定頁，從首頁進入時返回首頁。
- ✅ `SyncStatusPage` 已支援預設隱藏已成功項目的篩選，讓使用者聚焦尚未處理或失敗的資料。
- ✅ 同步狀態頁的交易項目已可直接開啟既有編輯 modal，方便就地修正待同步或失敗資料。
- ✅ `SettingsPage` 已保留設定 section 元件作為各設定子頁的內容元件，並以玻璃感功能子卡牌完成視覺一致化。
- ✅ 商家管理曾從 `SettingsPage` 內嵌區塊拆出以解決長清單撐開設定頁的問題，後續已重新整併為正式設定子頁。
- ✅ 商家管理已重新整併為 `SettingsPage` 的正式設定子頁，與 Tag 管理、同步設定等共用設定首頁卡片、子頁 routing 與返回行為。（紀錄：[merchant-management-settings-subpage.md](docs/completed-references/merchant-management-settings-subpage.md)）

## 首頁與日曆體驗

- ✅ 交易列表項目的 Tag 已改為顯示在第二行、接在次要文字之後，主要文字取回整行寬度；第二行空間不足時由次要文字先截斷，tag 儘量完整，只有單一 tag 超過整行時才截斷。（紀錄：[transaction-item-tags-second-row.md](docs/completed-references/transaction-item-tags-second-row.md)）
- ✅ 交易列表項目的 Tag 已改為小型 pill 顯示在交易名稱（主要文字）右邊，不再附加於次要文字尾端；主要文字太長時截斷並保留空間給 tag，沒有 tag 則不保留空間。（紀錄：[transaction-item-inline-tags.md](docs/completed-references/transaction-item-inline-tags.md)）
- ✅ 偏好設定可一次隱藏首頁的左右導覽按鈕（上半月曆左右、下半日期左右），預設顯示，隱藏後仍可左右滑動切換，週／月切換鈕與新增交易按鈕不受影響。（紀錄：[home-nav-arrow-visibility.md](docs/completed-references/home-nav-arrow-visibility.md)）
- ✅ 新增、複製或編輯交易儲存後，首頁會同步切到該筆交易日期，避免資料已建立但日列表停在舊日期。
- ✅ 首頁月曆已支援左右滑動切換月份，且下方交易列表已支援左右滑動切換前後日。（紀錄：[home-week-calendar.md](docs/completed-references/home-week-calendar.md)）
- ✅ 首頁已支援週／月切換模式，並會記住使用者最後一次選擇；週模式聚焦近期日期與交易，月模式保留整月分布檢視，且導覽手勢會跟隨模式切換。
- ✅ 今天按鈕已移除光暈效果，避免上方出現被截斷的視覺問題。（紀錄：[today-button-glow-clipping.md](docs/completed-references/today-button-glow-clipping.md)）
- ✅ 交易項目的支付方式已支援文字／圖示顯示偏好，預設保留文字並可在偏好設定切換，圖示模式使用與新增／編輯 modal 一致的圖示。（紀錄：[payment-method-icons.md](docs/completed-references/payment-method-icons.md)）

## 設定頁體驗

- ✅ Tag 更名互動已對齊商家更名：預設只顯示預覽按鈕、預覽後才出現黃色預覽卡與確認按鈕、確認送出中顯示旋轉 icon，feedback card 樣式移除 ⚠️ icon、更名完成後直接選到新 tag 編輯畫面，與商家更名共用相同節奏。（紀錄：[tag-rename-confirm-alignment.md](docs/completed-references/tag-rename-confirm-alignment.md)）
- ✅ 危險操作已新增刪除範例資料按鈕，依 `sample-tx-` id prefix 預覽並刪除由範例資料入口建立的交易，不影響使用者自行建立的紀錄。（紀錄：[delete-sample-data-button.md](docs/completed-references/delete-sample-data-button.md)）
- ✅ 共用頁面 header 已對齊 PWA 外框色，並縮減上方留白，讓設定頁與同步狀態等頁面在手機 PWA 上更連續。（紀錄：[settings-header-color.md](docs/completed-references/settings-header-color.md)）

## 商家與資料維護

- ✅ 新增／修改交易的 tag 建議點擊不再被輸入框 blur 搶先：chip 攔截 pointer/mouse down 保住輸入框 focus，選取建議時只加入點到的建議並清空未確認的輸入片段；Enter、空格分隔與失焦提交的既有路徑不變。（紀錄：[tag-suggestion-click-blur-race.md](docs/completed-references/tag-suggestion-click-blur-race.md)）
- ✅ 商家管理已加入商家搜尋與每次 200 筆的「載入更多」，降低大量商家清單的初次渲染成本。（紀錄：[merchant-management-search-pagination.md](docs/completed-references/merchant-management-search-pagination.md)）
- ✅ 商家名稱調整已補齊正規化驗證、合併提醒、共用 feedback card 與更名後直接選到新商家的 UI 狀態。（紀錄：[merchant-rename-validation.md](docs/completed-references/merchant-rename-validation.md)）
- ✅ 已支援商家更名，並確認既有交易紀錄、搜尋、統計與同步資料都能一致反映新名稱。

## 統計與分析

- ✅ 統計頁「依類別彙整」區塊已改為預設收合，點擊標題列才展開內容，維持單頁排版。（紀錄：[stats-collapsible-category.md](docs/completed-references/stats-collapsible-category.md)）
- ✅ 統計頁的子類別摘要已加入沿用主類別顏色的 progress bar 與佔比，可在展開類別後快速比較子類別佔比。（紀錄：[stats-subcategory-progress-bars.md](docs/completed-references/stats-subcategory-progress-bars.md)）
- ✅ 統計頁可從「依照類別分析」的子類別卡牌按下排除按鈕，將該子類別從統計與交易明細移除；已排除清單存於 local storage，並提供清除單一或全部排除條件。（紀錄：[stats-excluded-subcategories.md](docs/completed-references/stats-excluded-subcategories.md)）
- ✅ 統計頁在沒有收入資料時，整段隱藏收入摘要卡、收入明細與收入類別群組，避免空狀態佔用畫面。（紀錄：[stats-hide-empty-income.md](docs/completed-references/stats-hide-empty-income.md)）
- ✅ 統計頁「依照類別分析」的類別卡牌已移除類別名稱旁邊的「支出」／「收入」 pill badge，型別資訊改由上方群組標題單一來源呈現。（紀錄：[stats-category-type-badge-removal.md](docs/completed-references/stats-category-type-badge-removal.md)）
- ✅ 統計頁已加入依類別彙整區塊，支援金額、筆數、子類別摘要與交易展開。（紀錄：[category-stats.md](docs/completed-references/category-stats.md)）
- ✅ 統計頁已加入依商家彙整區塊，支援展開後查看商家交易列表，並可分幣別呈現常去商家與消費分布。（紀錄：[merchant-stats.md](docs/completed-references/merchant-stats.md)）
- ✅ 統計頁交易明細的可見日期已縮短為 `MM-dd`，把橫向空間留給交易名稱；完整的 `yyyy-MM-dd HH:mm` 保留在 title 與 aria-label，其他共用 `TransactionItem` 的頁面維持原格式。（紀錄：[stats-transaction-datetime-compact.md](docs/completed-references/stats-transaction-datetime-compact.md)）
- ✅ 統計卡片顯示多幣別時已改用統一圖示表示，不使用文字。

## 匯入與外部資料

- ✅ 年度雲端同步已完成並端到端驗證：前端入口、年份選擇、mock API、本地同步報告與報告 UI 皆可用；新版 GAS `action: "get"` 已部署，並以真實 Google Sheets 驗證 PUSH 與四種 PULL 分類；過程中發現並修正 `readableDateTime` 被 Sheets coerce 導致的假性同步 churn（conflict detection 排除該衍生欄位、pull 一律重算）。（紀錄：[manual-cloud-pull.md](docs/completed-references/manual-cloud-pull.md)）

## AI 功能

- ✅ 新增交易頁的 AI 快速填寫已改為「支出 / AI / 收入」並列的 tab；AI tab 夾在中間、只顯示 Sparkles icon，切到 AI tab 才會顯示 AI 輸入區並自動 focus，解析成功後 tab 自動切回支出／收入並在表單頂端顯示「AI 已填入欄位」摘要。（紀錄：[add-transaction-ai-tab.md](docs/completed-references/add-transaction-ai-tab.md)）
- ✅ 等待 Gemini API 回應時已新增更明確的 SVG 外框流動動畫，讓使用者知道 AI 正在解析中。（紀錄：[gemini-loading-animation.md](docs/completed-references/gemini-loading-animation.md)）
- ✅ 將目前已存在的 `Gemini` 相關功能打開並接到可用入口，補齊必要的設定、錯誤提示與使用者回饋。（紀錄：[gemini-entrypoint.md](docs/completed-references/gemini-entrypoint.md)）

## App icon 與品牌資產

- ✅ App icon 已取得 iOS 26 的 Liquid Glass 系統加工：`icon.svg` 改為透明底的純線稿（口袋輪廓、縫線、實心錢幣、兩顆 AI 星星），由新增的 `npm run icons:generate` 從單一 SVG 來源產出所有 PNG 與 `favicon.ico`，manifest 補上 `purpose` 與 maskable icon。實機確認觸發條件是透明背景，且主體內部不能填滿。（紀錄：[app-icon-ios-liquid-glass.md](docs/completed-references/app-icon-ios-liquid-glass.md)）
