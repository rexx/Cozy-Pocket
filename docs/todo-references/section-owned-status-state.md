# Section 自管 status 訊息計劃

## 摘要

把目前 `SettingsPage` 內共用的 `status` state（`{ type: 'success' | 'error' | 'idle', message: string }`）以及底部統一的 `renderStatusMessage()` 拆解到各設定 Section 自行擁有，讓「寫入端」與「渲染端」回到同一個元件內。本項目與 [`section-owned-rename-state.md`](../completed-references/section-owned-rename-state.md) 互補：前者處理 Tag / Merchant 兩條更名流程的 in-progress state（含其 status 顯示），本項目則收尾偏好、AI、同步、匯入匯出、危險操作這幾段非更名流程的 status。

> 本項目是 [`settings-page-decomposition.md`](./settings-page-decomposition.md) 第 2 步的獨立追蹤紀錄，緊接在 Step 1（Tag / Merchant 自管）之後執行；CSV / PullDialog（Step 3 / Step 4）排在後面。

## 動機

`SettingsPage` 內 `setStatus` 共出現 61 處，分布在 7 個流程：

| 流程 | setStatus 出處 | 對應 Section / Component |
|---|---|---|
| 啟用幣別不能全關 | 1 處 | `PreferencesSection` |
| Gemini API key 儲存成功 / 失敗 | 2 處 | `AiSection` |
| 同步設定儲存（成功 / 離線 / 部分失敗 / 失敗 / mock 填入） | 5 處 | `SyncSection` |
| 年度雲端同步 dialog（未選年份 / 成功 / 部分失敗 / 失敗 / 摘要） | 6 處 | 預計拉成 `PullYearDialog`（見 decomposition Step 4） |
| Tag 載入交易失敗 / 預覽 / 更名 | ~10 處 | `TagManagementSection`（由 `section-owned-rename-state.md` 處理） |
| Merchant 載入交易失敗 / 預覽 / 更名 | ~10 處 | `MerchantManagementSection`（由 `section-owned-rename-state.md` 處理） |
| 匯入 / 匯出 / 範例資料 / 重置 | ~20 處 | `ImportExportSection`、`DangerZoneSection` |

每段 `setStatus` 都跟發出它的 handler 一對一耦合：例如「至少要保留一個可用幣別」只可能從 `handleEnabledCurrencyToggle` 觸發、「Gemini API key 儲存失敗」只可能從 `saveGeminiApiKey` 觸發。共用 state 名義上方便，實質上沒有 Section 之間需要互相讀寫 status 的情境。

把 status 跟發送者一起放進 Section 後，下面這些缺點會一起消失：

- 切換子頁時上一個子頁的訊息殘留（目前靠每個 handler 開頭 `setStatus({ idle })` 主動清掉）。
- `SettingsPage` 必須記住「商家子頁要跳過底部 `renderStatusMessage`」這條 special case；Tag 子頁完成 section-owned-rename-state 後也會出現同樣的需求。
- 新增子頁時必須記得共用這個 status 物件，否則訊息渲染不出來。

## 範圍

### `PreferencesSection`
- 自管 `status` state，覆蓋啟用幣別衝突等錯誤訊息。
- `onNotify` 仍由 `App.tsx` 提供，用於跨頁 toast；status 只走 inline。

### `AiSection`
- 自管 `status` state 與「API key 儲存成功 / 失敗」訊息。

### `SyncSection`
- 自管 `status` state，涵蓋「儲存同步設定」與「使用 mock API」按鈕後的訊息。
- 年度雲端同步 dialog 的訊息隨 `PullYearDialog` 拉出後一併歸該 component（與 decomposition Step 4 同步）。在 PullYearDialog 拆出之前，可先把這段 status 留在 `SyncSection` 暫管。

### `ImportExportSection`
- 自管 `status` state，涵蓋預覽錯誤、覆寫 / 附加成功、同步部分失敗、覆蓋警示等訊息。
- `importPreview` 等流程內 state 一併移入（與 decomposition Step 3「CSV → service」重疊）；如 Step 3 尚未進行，可先只搬 status。

### `DangerZoneSection`
- 自管 `status` state，涵蓋重置成功 / 失敗、範例資料插入失敗。

### `SettingsPage`
- 移除 `status` state、`setStatus`、`renderStatusMessage`，以及 `section !== 'merchant'` 那條 special case。
- 不需再為了 status 顯示訂底部空間；各 Section 自行排版 inline feedback card。

### 共用 UI
- 為了避免每個 Section 重做卡片，可以把 `MerchantManagementSection` 內已有的 `MerchantFeedbackCard` 抽成 `components/settings/SettingsFeedbackCard.tsx`（重命名去除 merchant 字樣），所有 Section 共用。

## 接受條件

- `npm run build` 通過。
- 進入每個設定子頁觸發各自的成功 / 失敗訊息，inline 顯示位置正確。
- 切換到別的設定子頁時，前一個子頁的訊息不再殘留。
- `SettingsPage.tsx` 內不再出現 `setStatus`、`renderStatusMessage`，也不再有 `section !== 'merchant'` 這條跳過邏輯。
- `onNotify`（toast）行為不受影響。

## 風險與決定

- **訊息分散在多檔**：拆完後沒有單一檔可掃出所有訊息，但每個 Section 內 setStatus 數量不會超過 5–10 條，可控。
- **Pull dialog 訊息歸屬**：原則上跟 dialog 一起搬到 `PullYearDialog`；若 decomposition Step 4 尚未進行，`SyncSection` 暫管即可，不阻塞此項目。
- **重複的 idle 重置**：handler 開頭原本的 `setStatus({ idle })` 仍然有用（同一 Section 內前一次訊息），保留即可。
- **避免吃掉 toast 角色**：`onNotify` 走的 toast 是跨頁的「結果摘要」；inline status 是頁內的「詳細解釋」。本次重構維持兩者分工不變。

## PR 切分建議

1. 抽 `SettingsFeedbackCard` 共用元件並改寫 `MerchantManagementSection`（純重構，零行為變化）。
2. `AiSection` + `PreferencesSection` 自管 status（兩段最簡單，可同 PR）。
3. `DangerZoneSection` + `ImportExportSection` 自管 status。
4. `SyncSection`（含暫時包住 Pull dialog 的 status）自管。
5. `SettingsPage` 移除 `status` state、`renderStatusMessage` 與 merchant special case。

完成後本檔案移到 `docs/completed-references/`，並推進 `settings-page-decomposition.md` Step 2 的標記、銜接 Step 3（CSV）。
