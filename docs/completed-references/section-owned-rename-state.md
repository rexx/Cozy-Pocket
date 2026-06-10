# Section 自管更名流程 state（完成紀錄）

## 摘要

`TagManagementSection` 與 `MerchantManagementSection` 各自持有自己的更名流程 state，`SettingsPage` 不再為這兩條子頁保留 in-progress 狀態與 handler。對外 API 收斂為「資料來源 callback + app 級副作用 callback」，兩個 Section 成為自包含的設定子頁內容。本項目是 [`settings-page-decomposition.md`](../todo-references/settings-page-decomposition.md) 第 1 步。

## 最終實作

### `TagManagementSection`
- 自管 `selectedTagToRename`、`renamedTagInput`、`tagRenamePreview`、`isTagPreviewLoading`、`isTagRenameSubmitting`、`tagTransactions`、`isTagTransactionsLoading`，以及本地 `status`。
- 自管 `selectedTagToRename` 失效檢查與「載入相關交易」兩個 useEffect。
- 自管 `resetTagRenameState` / `handleSelectTagToRename` / `handlePreviewTagRename` / `handleRenameTag` 與 inline status 顯示。
- 對外 prop：`tagSummaries`、`paymentMethodDisplayMode`、`onPreviewTagRename`、`onRenameTag`、`onGetTagTransactions`、`onTagTransactionClick`、`onDataChange`、`onOpenSyncProgress`。

### `MerchantManagementSection`
- 對應的 7 個 state、2 個 useEffect、4 個 handler 全數搬入 Section，沿用既有的 `MerchantFeedbackCard` 與 `LoaderCircle` 提交動畫。
- 對外 prop：`merchantSummaries`、`paymentMethodDisplayMode`、`onPreviewMerchantRename`、`onRenameMerchant`、`onGetMerchantTransactions`、`onMerchantTransactionClick`、`onDataChange`、`onOpenSyncProgress`。

### `SettingsPage`
- 移除 Tag / Merchant 兩條流程的 state、useEffect、handler、reset 函式，以及 `normalizeTag` / `normalizeMerchantName` import。
- `renderSection` 對應分支只剩 props 透傳；`App.tsx` 不需改動。

## 與原計劃 prop 清單的差異

- **加入 `onOpenSyncProgress`**（原清單未列）：同步部分失敗時的 inline status 帶有「查看同步狀態」action 按鈕，需要這個 callback 才能維持，否則該按鈕會消失。
- **未加入 `onNotify`**（原清單有列）：更名流程從未呼叫 `onNotify`，加入會成為死 prop，故省略。
- **保留底部 `renderStatusMessage` 的 `section !== 'merchant' && section !== 'tags'` 守衛**：移除會讓其他子頁殘留的 `SettingsPage.status` 洩漏到這兩個自管子頁底部。守衛由 [`section-owned-status-state.md`](../todo-references/section-owned-status-state.md)（Step 2）連同 `status` 一起拆。

## 行為決定

- **state 不跨子頁保留**：切換到別的設定子頁再返回時，子頁會重新掛載，選取與預覽重置為初始狀態。對個人記帳 app 可接受，已驗證為刻意行為。
- **`SettingsPage.status` 暫時保留**：偏好 / AI / 同步 / 匯入匯出 / 危險操作仍使用，由 Step 2 負責拆解。

## 驗證

- `npm run build`（tsc strict + Vite production build）通過。
- 透過 cmux 內建瀏覽器實際操作驗證：
  - Tag 更名：選取 → 預覽（`#孝親 → #孝親費`、預計影響 1 筆）→ 確認，完成後 inline status 顯示「已將 #孝親 更名為 #孝親費，共更新 1 筆」、chip 更新、Current Tag 保留新名稱。
  - 商家合併：`50嵐` → 既有 `吉野家`，預覽顯示合併提醒，確認後 status 顯示「已將 50嵐 合併到 吉野家，共更新 1 筆」、吉野家筆數合併為 2、50嵐 消失。
  - 切換子頁再返回：選取與預覽 state 已清空。
  - 點擊相關交易：開出既有編輯 modal（「修改項目」）。
  - 全程瀏覽器 console 無錯誤。
- 未在瀏覽器覆蓋：離線更名「待恢復連線後同步」、同步部分失敗 status。兩者走透傳 callback 的既有業務邏輯，本次重構未更動，且 callback 鏈已由成功 status 證明連通。
