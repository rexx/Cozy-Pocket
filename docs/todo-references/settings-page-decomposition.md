# SettingsPage 拆解計劃

## 現況

Step 1（Tag / Merchant 更名 state）與 Step 2（共用 status state + `SettingsFeedbackCard`）已完成並上線。`components/SettingsPage.tsx` 已從收編商家管理後的約 1168 行降到約 585 行，container 目前只剩：

- 設定首頁 / 七個設定子頁的 routing、overview 卡片與 render switch
- 跨子頁共用的資料 state：`defaultCurrency`、`enabledCurrencies`、`geminiApiKeyInput`／`hasGeminiApiKey`、`syncApiUrl`／`syncToken`，以及啟動時一次性載入這些設定的 `useEffect`
- CSV 解析（`splitCSVIntoRows` / `parseCSVLine` / `parseImportFile`）、匯出（`exportToCSV`）、覆寫/附加提交（`commitImport`）等資料層 helper，以 callback 提供給 `ImportExportSection`
- 偏好幣別 / 付款方式 / 首頁箭頭 / error banner / Gemini key / 同步設定的 db 寫入 handler，以 callback 提供給對應子頁
- 重置本機資料（`resetLocalData`）callback

已不再由 container 持有的部分：Tag / Merchant 更名流程的所有 state 與 handler（→ 各自 Section）、共用 `status` state 與底部 `renderStatusMessage`（→ 各 Section 自管 + `SettingsFeedbackCard`）、年度雲端同步 Pull dialog 的 state 與 markup（→ `SyncSection`），`section !== 'merchant'` 之類的 special-case 渲染也已移除。

剩下尚未拆的兩塊：Step 3（CSV 解析仍夾在 container，~120 行純資料邏輯）與 Step 4（Pull dialog 目前內嵌在 `SyncSection`，尚未拉成獨立 component）。

## 收斂目標

讓 `SettingsPage` 退回單純的 container：負責 header / 背景 glow / 子頁 routing / overview 卡片 / render switch，其餘邏輯分散到對應的 hook、service 或 component。預估完整拆完後可瘦回約 500–600 行。

## 拆解步驟（建議由低風險到高風險）

### 1. 把更名流程 state 移進對應的 Section（含 Tag、Merchant）✅ 已完成

> 完成紀錄：[`section-owned-rename-state.md`](../completed-references/section-owned-rename-state.md)。

`TagManagementSection` / `MerchantManagementSection` 已各自以 `useState` 持有 `selected*ToRename`、`renamed*Input`、`*RenamePreview`、`isPreviewLoading`、`isSubmitting`、`*Transactions`、`isTransactionsLoading` 與 inline status，連同失效檢查與載入相關交易的兩個 useEffect、四個 handler 一併移入；`SettingsPage` 對這兩條子頁只剩 props 透傳（資料來源 + preview／rename／get-transactions／`onDataChange`／`onOpenSyncProgress`）。切換到其他設定子頁再返回時子頁會重新掛載，選取與預覽會重置，已驗證為刻意行為。底部 `renderStatusMessage` 的 `section !== 'merchant' && section !== 'tags'` 守衛保留，由 Step 2 連同 `status` 一起拆。

### 2. 把共用 status state 拆解到各 Section ✅ 已完成

> 完成紀錄：[`section-owned-status-state.md`](../completed-references/section-owned-status-state.md)。

偏好 / AI / 同步 / 匯入匯出 / 危險操作各自以 `useState<SettingsStatus>` 自管 inline status，`MerchantFeedbackCard`／`TagFeedbackCard` 統一成共用 `components/settings/SettingsFeedbackCard.tsx`（含包裝 `SettingsStatus` 的 `SettingsStatusCard`）。`SettingsPage` 移除 `status`／`setStatus`／`renderStatusMessage` 與 `section !== 'merchant'` special case，資料層 handler 改成回傳結果的 callback（parse／commit／export／saveSync 等），由各 Section 依結果寫自己的 status。年度雲端同步 dialog 連同其 state 一併移入 `SyncSection` 暫管，待 Step 4 再進一步拉成獨立 `PullYearDialog`；CSV 解析與 db 寫入仍留在 container（Step 3）。

排在 CSV / PullDialog 之前的原因：先把「容器只有 routing / render switch」的形狀做出來，再往各 Section 內部擠複雜邏輯（Step 3 / 4），review 比較容易讀。

### 3. 把 CSV 匯入解析搬到 `services/csvService.ts`

`parseCSVLine`、`splitCSVIntoRows`、`parseTransactionsFromCSV` 屬於純資料邏輯，目前夾在 UI component 裡，難以重用且讓檔案吃了 ~120 行。

實作方向：
- 建立 `services/csvService.ts`，匯出 `parseTransactionsFromCSV`、`exportTransactionsToCSV`。
- `ImportExportSection` 直接呼叫 service，預覽結果與 `importPreview` state 也搬進該 Section。
- `SettingsPage` 只在 import 完成後觸發 `onTriggerSync`、`onDataChange`，不再需要 `importPreview`、`isParsingImportFile`、`fileInputRef`。

預估去除：~150 行。

### 4. 把年度雲端同步 Pull dialog 從 `SyncSection` 拉成獨立 component

Step 2 已把 dialog 的 `isPullDialogOpen` / `selectedPullYear` / `isPullSubmitting` 三個 state、同步 `pullYearOptions` 的 useEffect、dialog markup 與 `handlePullFromCloud` 一併從 `SettingsPage` 移入 `SyncSection` 暫管。Step 4 是把這段再從 `SyncSection` 抽成獨立的 `components/settings/PullYearDialog.tsx`，讓 `SyncSection` 回到「同步設定表單 + 入口按鈕」的單純形狀。

實作方向：
- 新增 `components/settings/PullYearDialog.tsx`，自己管 open / submitting / 選年份 state（從 `SyncSection` 平移過去）。
- `SyncSection` 只控制是否顯示 dialog；report 結果回流由 `onPullFromCloud`（保留在 `App.tsx`）處理。
- dialog 自身的成功 / 部分失敗 / 失敗 status 可一併歸 `PullYearDialog`（仍用共用 `SettingsStatusCard`），或維持由 `SyncSection` 顯示。

預估從 `SyncSection` 移出：~80 行。

## 與既有程式碼的關係

- `App.tsx` 仍是資料 / 服務 / 同步 orchestrator，不會被本計劃拉胖。它只需要持續對外提供 `onPreviewTagRename` / `onRenameTag` / `onGetTagTransactions` / `onPreviewMerchantRename` / `onRenameMerchant` / `onGetMerchantTransactions` / `onTriggerSync` / `onPullFromCloud` 等 callback。
- `MerchantManagementSection` / `TagManagementSection` 既有的 UI（共用 `SettingsFeedbackCard`、preview 卡、相關交易列表）不需重作；Step 1 / 2 已把 state 從 props 改成內部 useState 並改用共用卡片。
- 各 Section 維持「不直接碰 db / cloudSyncService」的紀律，仍透過 callback 觸發資料層動作。

## 驗證計劃

- `npm run build`（tsc strict + Vite）。
- 手動驗證每個設定子頁進入 / 返回 / 瀏覽器返回鍵 / 切換到其他子頁再回來時的 state 行為。
- 重點驗證 Tag / Merchant 更名：預覽、確認、離線提示、同步失敗提示、合併行為、相關交易點擊編輯 modal。
- 匯入：覆寫 / 附加 / 重複 ID 偵測 / 偵測到重複後的二次確認流程。
- 年度雲端同步：成功 / 部分失敗 / 失敗的 status 訊息與報告跳轉。

## 後續建議

- **下一步做 Step 3（CSV → service）**：收益最大（~120–150 行純資料邏輯離開 UI 層、可單元測試），且風險低——`ImportExportSection` 已自管 `importPreview` 與 status，只要把 `parseImportFile` / `commitImport` 內的 CSV 解析與 db 寫入搬到 `services/csvService.ts`，container 端的 `splitCSVIntoRows` / `parseCSVLine` / `parseImportFile` / `exportToCSV` 即可整段移除，`SettingsPage` 再瘦一截。
- **Step 4（PullYearDialog）可獨立進行**：與 Step 3 無相依、規模較小（~80 行），主要是把已在 `SyncSection` 內的 dialog 平移到獨立 component；可排在 Step 3 之後或穿插。
- **維持「一個 PR 一個 Section」的節奏**：每個 PR 只動一個 Section 與對應的 `SettingsPage` 配線，沿用 Step 1 / 2 的小步快跑 + `npm run build` + cmux 瀏覽器驗證流程，避免一次大型 review。
- **完成 Step 3 / 4 後的預期**：`SettingsPage` 落在收斂目標的 ~500 行上下，只剩 routing / overview / render switch 與少量跨子頁資料 state；屆時本計劃整份移到 `docs/completed-references/`。
- **開工前先 rebase 最新 main**：近期 main 有並行 commit（如 error-banner toggle）直接改過 `SettingsPage` / `PreferencesSection`，後續步驟動工前先對齊最新 main，縮小 container 層的衝突面。

### 更遠的優化（超出本計劃範圍）

完成 Step 3 / 4 後 container 仍會留著跨子頁的設定資料 state（`defaultCurrency`／`enabledCurrencies`／`geminiApiKeyInput`／`syncApiUrl`／`syncToken`）+ 載入 `useEffect`，以及偏好 / AI / 同步的 db 寫入 handler（`handleEnabledCurrencyToggle`、`saveGeminiApiKey`、`saveSyncConfig`…）。以下三點客觀上仍可再優化，但不屬於「SettingsPage 拆解」這份計劃（尤其第 3 點會碰 `App.tsx`，本計劃刻意把 App orchestrator 排除在外），列為未來 TODO 的線索：

1. **把設定資料 state + db handler 抽成 hook**（如 `useSettingsData`）：container 再瘦一截、logic 可獨立測試，風險低。屬於 Step 1–4 同一條紀律（container／hook 管 db、Section 管 UI）的自然延伸。
2. **讓 `PreferencesSection` / `AiSection` / `SyncSection` 也自管自己的持久化設定**（比照 Tag / Merchant 自管 rename state），container 變成幾乎純 routing。需先決定如何維持「Section 不直接碰 db」的紀律——改用 data-access hook 注入，或明確放寬該紀律，是個設計取捨。
3. **消除 `App.tsx` ↔ `SettingsPage` 的設定 state 重複載入**：目前兩者各自從 `db.settings` 載入 currency / payment-method / home-nav / error-banner，是兩份 source of truth。抽一個 settings service / context 統一可去掉 dual-load，但會動到 `App.tsx`，屬於另一個更大的 refactor，宜獨立立項。
