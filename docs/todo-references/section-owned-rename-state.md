# Section 自管更名流程 state 計劃

## 摘要

讓 `TagManagementSection` 與 `MerchantManagementSection` 各自持有自己的更名流程 state，`SettingsPage` 不再為這兩條子頁保留 in-progress 狀態與 handler。對外 API 收斂為「資料來源 callback + app 級副作用 callback」，Section 變成自包含的設定子頁內容。

> 本項目是 [`settings-page-decomposition.md`](./settings-page-decomposition.md) 第 1 步的獨立追蹤紀錄，先單獨拆出來做完，再回頭推進其他 decomposition 步驟。

## 動機

- 商家管理子頁化（`merchant-management-settings-subpage.md`）後，`SettingsPage` 已成長到約 1168 行；Tag 與 Merchant 兩條更名流程合計貢獻約 200 行 state + effects + handlers。
- 目前的位置是慣例延續，不是架構限制：當初設定子頁從 inline 大頁拆分時，state 留在 container；商家管理併入 `SettingsPage` 時，為了與 Tag 對齊也放在 container。
- `MerchantManagementSection` 經 `fb7906e` 改造後已具備 `MerchantFeedbackCard` 結構，可在 Section 內 inline 呈現 status；不再需要倚賴 `SettingsPage` 的共用 `status` state。
- 把流程 state 放回 Section 後，新增有更名 / 預覽流程的設定子頁時，`SettingsPage` 不需配線新 state、effects、handlers，只要在 overview 與 render switch 加一筆。

## 範圍

### `TagManagementSection`
- 自管 `selectedTagToRename`、`renamedTagInput`、`tagRenamePreview`、`isTagPreviewLoading`、`isTagRenameSubmitting`、`tagTransactions`、`isTagTransactionsLoading`。
- 自管 `selectedTagToRename` 失效檢查與「載入相關交易」兩個 useEffect。
- 自管 `handleSelectTagToRename` / `handlePreviewTagRename` / `handleRenameTag` / `resetTagRenameState` 與 inline status 顯示。
- 對外 prop 收斂為：`tagSummaries`、`paymentMethodDisplayMode`、`onPreviewTagRename`、`onRenameTag`、`onGetTagTransactions`、`onTagTransactionClick`、`onDataChange`、`onNotify`。

### `MerchantManagementSection`
- 對應的 7 個 state、2 個 useEffect、4 個 handler 全數搬入 Section。
- 沿用既有的 `MerchantFeedbackCard` 與 `LoaderCircle` 提交動畫。
- 對外 prop 收斂為：`merchantSummaries`、`paymentMethodDisplayMode`、`onPreviewMerchantRename`、`onRenameMerchant`、`onGetMerchantTransactions`、`onMerchantTransactionClick`、`onDataChange`、`onNotify`。
- 因此 `SettingsPage` 不再需要為 merchant 子頁特別跳過底部 `renderStatusMessage`。

### `SettingsPage`
- 移除 Tag / Merchant 兩條流程的 state、useEffect、handler、reset 函式。
- `renderSection` 對應分支只剩 props 透傳。
- `MerchantManagementSection` 不再需要外部傳入 `status`，可移除該 prop。

## 接受條件

- `npm run build` 通過。
- 設定首頁進入 Tag 管理 / 商家管理 → 預覽 → 確認更名（含合併情境）→ 完成後焦點仍在新名稱、status 顯示正確。
- 離線模式下更名顯示「待恢復連線後同步」。
- 同步部分失敗時顯示對應錯誤 status。
- 切換到其他設定子頁再回來，預覽 state 清空（明確紀錄為刻意行為）。
- 點擊相關交易仍能進入既有編輯 modal。

## 風險與決定

- **state 不再跨子頁保留**：使用者切到別的設定子頁再回來時，預覽會清空。對個人記帳 app 的使用情境可接受；如有反饋再改為 hook + ref 保留。
- **`SettingsPage.status` 是否仍需要**：拿掉 Tag / Merchant 後剩下偏好 / AI / 同步 / 匯入匯出 / 危險操作仍會用，先保留；後續由 `settings-page-decomposition.md` Step 2（[`section-owned-status-state.md`](./section-owned-status-state.md)）負責拆解。
- **PR 切分建議**：Tag 與 Merchant 各一個 PR，避免一次大型 review；先做 Merchant（已經有 inline feedback 結構）再做 Tag（需順帶補齊 status 呈現）。

## 完成後續動作

完成後將本檔案移到 `docs/completed-references/`，並回到 `settings-page-decomposition.md` 把 Step 1 標記完成、推進 Step 2（status 拆解）。
