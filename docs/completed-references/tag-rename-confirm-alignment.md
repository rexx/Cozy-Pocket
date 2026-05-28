# Tag 更名流程與商家更名對齊完成紀錄

本項目把 Tag 管理子頁的更名互動全面對齊到商家更名既有流程，包含按鈕顯示節奏、訊息卡樣式與更名完成後的選取狀態，讓兩個設定子頁在視覺與操作上一致。

## 完成內容

### `components/settings/TagManagementSection.tsx`

- 新增 `status: SettingsStatus` prop，引用 `./settingsStatus` 既有型別，與 `MerchantManagementSection` 同形狀。
- 內聯一份與 `MerchantFeedbackCard` 樣式對齊的 `TagFeedbackCard`，支援 `error` / `success` / `warning` tone、可選標題、可選 `action` 按鈕（用於「查看同步狀態」捷徑），不包含獨立 `AlertTriangle` ⚠️ icon。
- 預覽按鈕永遠渲染並佔獨立 grid 區塊；確認按鈕只在 `tagRenamePreview` 存在時才渲染，送出中前綴 icon 從 `CheckCircle2` 切換成旋轉中的 `LoaderCircle`。
- 預覽按鈕 disabled 條件含送出中狀態：`!renamedTagInput.trim() || isTagPreviewLoading || isTagRenameSubmitting`。
- 更名相關訊息（一般錯誤、預覽錯誤、合併警告、預覽結果為 0、更名完成或同步部分失敗）透過 `TagFeedbackCard` 顯示在輸入區下方，依 `tagRenamePreview` 是否存在切換位置邏輯，與商家更名的 `renameFeedbackMessage` / `resultStatusMessage` 對齊。

### `components/SettingsPage.tsx`

- `case 'tags'` 渲染 `<TagManagementSection>` 時傳入 `status`，與 `case 'merchant'` 行為一致。
- `renderSection()` 後渲染 `renderStatusMessage()` 的條件擴大為 `section !== 'merchant' && section !== 'tags'`，避免 status 同時被 SettingsPage 與 tag section 各自渲染一次。
- `resetTagRenameState(nextSelectedTag)` 改為計算 `willSwitchTag`，切換到不同 tag 時主動清空 `tagTransactions` 並進入 loading 狀態，避免新 tag 載入前短暫顯示舊 tag 的交易。
- `handleRenameTag` 完成後改為 `await onDataChange()` 後 `resetTagRenameState(result.newTag)`，包含合併到既有 tag 的情境，更名後選取會自動切到新名稱；成功 / 離線 / 同步部分失敗訊息統一用 `renameSummary` 模板組合，並在純成功路徑也設 `success` status，與商家更名一致。

## 介面與資料

- 沒有新增 service 或型別檔。`SettingsStatus` / `SettingsStatusAction` 沿用 `components/settings/settingsStatus.ts`。
- `TagRenamePreview` 與 `services/tagService.ts` 未變動；`App.tsx` 的 `renameTag` 回傳形狀已含 `newTag`，沒有調整 hook 或 service。

## 驗證

- 已執行 `npm run build`，`tsc --strict` 與 Vite production build 均通過。
- 手動驗證：
  - 一般更名：選 tag、輸入新名稱、按預覽 → 黃色預覽卡與確認按鈕同時出現；按確認 → 旋轉 icon 顯示，完成後選取自動切到新 tag，feedback card 樣式無 ⚠️ icon。
  - 合併到既有 tag：輸入既有 tag 名 → 黃色卡顯示合併提醒；確認後選取切到合併目標 tag，related transactions 重新載入。
  - 修改新名稱輸入 → 黃色預覽卡與確認按鈕同時消失。
  - 同步部分失敗：feedback card 內出現「查看同步狀態」按鈕，可導向同步狀態頁，返回後仍在 Tag 管理子頁。
  - 與商家管理子頁交叉比對，操作節奏、按鈕顯隱與訊息卡樣式一致。
