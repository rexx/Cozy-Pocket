# Section 自管 status 訊息（完成紀錄）

## 摘要

原本 `SettingsPage` 以一份共用的 `status` state（`{ type: 'success' | 'error' | 'idle', message }`）加上底部統一的 `renderStatusMessage()` 承接所有設定子頁的訊息。此項目把該 state 拆解到偏好 / AI / 同步 / 匯入匯出 / 危險操作各 Section 自管，讓「寫入端」與「渲染端」回到同一個元件內，並抽出共用的 `SettingsFeedbackCard`。與 [`section-owned-rename-state.md`](./section-owned-rename-state.md) 互補：前者處理 Tag / Merchant 更名流程的 in-progress state（含其 status），本項目收尾其餘非更名流程的 status。這是 [`settings-page-decomposition.md`](../todo-references/settings-page-decomposition.md) Step 2 的紀錄。

## 最終狀態

### 共用元件 `components/settings/SettingsFeedbackCard.tsx`
- `SettingsFeedbackCard`：卡片元件，`tone` 為 `error` / `success` / `warning`，支援 `title` 與 `action`（沿用原 `MerchantFeedbackCard` / `TagFeedbackCard` 的樣式，去除 merchant / tag 字樣）。
- `SettingsStatusCard`：吃一個 `SettingsStatus`，`idle` 不渲染，`success` / `error` 直接對應卡片。
- `TagManagementSection` 與 `MerchantManagementSection` 的預覽卡與狀態卡改用此共用元件，原本兩份重複的 `*FeedbackCard` 移除。

### 各 Section 自管 status
- `PreferencesSection`：自管 status，自行檢查「至少要保留一個可用幣別」衝突並走 inline + `onNotify`；幣別套用、付款方式與首頁箭頭切換仍由 container callback 落 db。
- `AiSection`：自管 API key 儲存成功 / 失敗訊息；`onSaveGeminiApiKey` 回傳成功訊息字串、失敗時 throw，由 Section 寫 status。
- `SyncSection`：自管儲存同步設定、使用 mock API 與年度雲端同步的訊息；年度雲端同步 dialog 的 state 與 markup 一併移入此 Section 暫管（待 decomposition Step 4 再拉成獨立 `PullYearDialog`）。
- `ImportExportSection`：自管 status 與 `importPreview` / 選檔名 / 解析中旗標 / `fileInputRef`；CSV 解析、db 寫入與同步觸發仍由 container callback（`onParseImportFile` / `onCommitImport` / `onExportToCsv`）處理，Section 依結果寫 status。
- `DangerZoneSection`：自管重置、插入 / 刪除範例資料的訊息與 confirm 流程；實際清除（`localStorage.clear` + `db.delete`）走 `onResetLocalData` callback。

### `SettingsPage`
- 移除 `status` state、`setStatus`、`renderStatusMessage`，以及 `section !== 'merchant' && section !== 'tags'` 的底部渲染 special case。
- 年度雲端同步 dialog 及其 state（`isPullDialogOpen` / `selectedPullYear` / `isPullSubmitting`）移入 `SyncSection`。
- 仍持有跨 Section 的 currency / Gemini key / sync config state 與 db 讀寫；資料層 handler 改成回傳結果或 throw 的純資料 callback，不再寫 status。`SettingsPageProps` 對 `App.tsx` 的介面不變。

## 驗證

- `npm run build`（tsc strict + Vite）通過。
- 透過 cmux 內建瀏覽器互動驗證：
  - AI 子頁空 key 儲存 → inline「AI 設定已清除」綠色卡 + toast。
  - 同步子頁「使用 mock API」→ inline 成功卡並填入 mock URL。
  - 偏好子頁砍到剩一個幣別再取消最後一個 → inline 紅色「至少要保留一個可用幣別」，最後一個維持勾選（防呆 guard）。
  - AI 顯示狀態後切到同步子頁 → 訊息不殘留；偏好錯誤在下一次成功 toggle 後清除。
  - 同步子頁「執行年度雲端同步」→ dialog 從 `SyncSection` 正常彈出 / 取消。
  - 危險操作「插入範例資料」→ swal2 確認對話框正常彈出 / 取消。
  - 全程 console 無錯誤。

## 後續

- decomposition Step 3：CSV 解析抽到 `services/csvService.ts`。
- decomposition Step 4：年度雲端同步 dialog 從 `SyncSection` 拉成獨立 `PullYearDialog`，dialog 訊息一併歸該 component。

## 行為差異備註

- 偏好 / AI / 同步 / 匯入匯出 / 危險操作的 status 卡片改用共用 `SettingsFeedbackCard` 樣式（無獨立警告 icon、action 按鈕在卡片內），取代原本 container 底部含 icon 的橫向卡。
- 同步子頁「查看同步紀錄」按鈕改為 `() => onOpenPullReports()` 不帶參數（原本把 click event 當 `reportId` 傳入），語意為開啟報告列表而不聚焦特定報告。
- `onNotify`（跨頁 toast）行為維持不變。
