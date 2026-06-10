# SettingsPage 拆解計劃

## 現況

`components/SettingsPage.tsx` 在收編商家管理為設定子頁後已成長到約 1168 行，與 `App.tsx`、`AddTransactionModal.tsx`、`cloudSyncService.ts` 同列「known debt」量級。它同時承擔：

- 設定首頁 / 七個設定子頁 routing 與 render switch
- Currency / payment-method-display / Gemini API key / 同步設定 db 讀寫與儲存
- Tag 更名與商家更名兩條完整流程的 state、effects、handlers
- CSV 匯入解析、匯出、覆寫/附加流程
- 年度雲端同步的 Pull dialog markup 與互動 state
- 共用 status 訊息（成功 / 錯誤 / idle）與底部渲染
- 重置本機資料與插入範例資料

每新增一個有更名／預覽流程的設定子頁，會多約 100 行（7 個 state + 2 個 useEffect + 4 個 handler + render 分支）。照此速度增加，下一個子頁會把檔案推到 1300 行以上。

## 收斂目標

讓 `SettingsPage` 退回單純的 container：負責 header / 背景 glow / 子頁 routing / overview 卡片 / render switch，其餘邏輯分散到對應的 hook、service 或 component。預估完整拆完後可瘦回約 500–600 行。

## 拆解步驟（建議由低風險到高風險）

### 1. 把更名流程 state 移進對應的 Section（含 Tag、Merchant）✅ 已完成

> 完成紀錄：[`section-owned-rename-state.md`](../completed-references/section-owned-rename-state.md)。

`TagManagementSection` / `MerchantManagementSection` 已各自以 `useState` 持有 `selected*ToRename`、`renamed*Input`、`*RenamePreview`、`isPreviewLoading`、`isSubmitting`、`*Transactions`、`isTransactionsLoading` 與 inline status，連同失效檢查與載入相關交易的兩個 useEffect、四個 handler 一併移入；`SettingsPage` 對這兩條子頁只剩 props 透傳（資料來源 + preview／rename／get-transactions／`onDataChange`／`onOpenSyncProgress`）。切換到其他設定子頁再返回時子頁會重新掛載，選取與預覽會重置，已驗證為刻意行為。底部 `renderStatusMessage` 的 `section !== 'merchant' && section !== 'tags'` 守衛保留，由 Step 2 連同 `status` 一起拆。

### 2. 把共用 status state 拆解到各 Section

> 已拆出獨立 focused TODO：[`section-owned-status-state.md`](./section-owned-status-state.md)。

Step 1 處理完 Tag / Merchant 後，剩下的 `status` 寫入仍分布在偏好 / AI / 同步 / 匯入匯出 / 危險操作。實測 61 處 `setStatus` 全部跟單一 Section 的 handler 一對一耦合，沒有跨 Section 的共用情境，因此選擇直接讓各 Section 自管 status 而非另外抽 hook，並把 `MerchantFeedbackCard` 改成共用 `SettingsFeedbackCard`。`SettingsPage` 完成後移除 `status`、`renderStatusMessage` 與 `section !== 'merchant'` 的 special case。

排在 CSV / PullDialog 之前的原因：先把「容器只有 routing / render switch」的形狀做出來，再往各 Section 內部擠複雜邏輯（Step 3 / 4），review 比較容易讀。

### 3. 把 CSV 匯入解析搬到 `services/csvService.ts`

`parseCSVLine`、`splitCSVIntoRows`、`parseTransactionsFromCSV` 屬於純資料邏輯，目前夾在 UI component 裡，難以重用且讓檔案吃了 ~120 行。

實作方向：
- 建立 `services/csvService.ts`，匯出 `parseTransactionsFromCSV`、`exportTransactionsToCSV`。
- `ImportExportSection` 直接呼叫 service，預覽結果與 `importPreview` state 也搬進該 Section。
- `SettingsPage` 只在 import 完成後觸發 `onTriggerSync`、`onDataChange`，不再需要 `importPreview`、`isParsingImportFile`、`fileInputRef`。

預估去除：~150 行。

### 4. 把年度雲端同步 Pull dialog 拉成獨立 component

`PullYearDialog` 對應目前 `isPullDialogOpen`、`selectedPullYear`、`isPullSubmitting` 三個 state 與一段 dialog markup。它跟 `SyncSection` 較相關，不該住在 `SettingsPage` 通用容器層。

實作方向：
- 新增 `components/settings/PullYearDialog.tsx`，自己管 open / submitting / 選年份 state。
- `SyncSection` 控制是否顯示 dialog；report 結果回流由 `onPullFromCloud`（保留在 `App.tsx`）處理。

預估去除：~80 行。

## 與既有程式碼的關係

- `App.tsx` 仍是資料 / 服務 / 同步 orchestrator，不會被本計劃拉胖。它只需要持續對外提供 `onPreviewTagRename` / `onRenameTag` / `onGetTagTransactions` / `onPreviewMerchantRename` / `onRenameMerchant` / `onGetMerchantTransactions` / `onTriggerSync` / `onPullFromCloud` 等 callback。
- `MerchantManagementSection` / `TagManagementSection` 既有的 UI（`MerchantFeedbackCard`、preview 卡、相關交易列表）不需重作；只是把 state 從 props 改成內部 useState。
- 各 Section 維持「不直接碰 db / cloudSyncService」的紀律，仍透過 callback 觸發資料層動作。

## 驗證計劃

- `npm run build`（tsc strict + Vite）。
- 手動驗證每個設定子頁進入 / 返回 / 瀏覽器返回鍵 / 切換到其他子頁再回來時的 state 行為。
- 重點驗證 Tag / Merchant 更名：預覽、確認、離線提示、同步失敗提示、合併行為、相關交易點擊編輯 modal。
- 匯入：覆寫 / 附加 / 重複 ID 偵測 / 偵測到重複後的二次確認流程。
- 年度雲端同步：成功 / 部分失敗 / 失敗的 status 訊息與報告跳轉。

## 暫緩原因

- 商家管理子頁化（`merchant-management-settings-subpage.md`）剛完成，先讓近期變動穩定再動 container 結構。
- 拆解 Section state 會碰到所有 *Section 元件，建議分數個 PR，每個 PR 只動一個 Section 與對應 SettingsPage 配線，避免一次大型 review。
