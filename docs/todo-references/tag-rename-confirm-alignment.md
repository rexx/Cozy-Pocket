# Tag 更名流程與商家更名對齊計劃

## 摘要

把 `TagManagementSection` 的更名互動全面對齊到 `MerchantManagementSection` 已採用的節奏：
1. 預設只顯示預覽按鈕，按下預覽後才在輸入下方同時出現黃色預覽匡與確認按鈕。
2. 確認按鈕送出中顯示旋轉中的 `LoaderCircle`。
3. 把目前由 `SettingsPage.renderStatusMessage()` 套上 `AlertTriangle` ⚠️ icon 的紅色狀態卡，改成 tag section 內聯渲染、與商家相同樣式（無 icon、色塊 + 文字 + 同步動作按鈕）。
4. 更名完成後不再把選取清掉、整個編輯區消失；改成把選取切到新 tag（含合併到既有 tag 的情境），讓使用者可以延續查看與調整。

## 關鍵變更

### `components/SettingsPage.tsx`

- `case 'tags'` 改成跟 `case 'merchant'` 一樣，把 `status` prop 傳進 `TagManagementSection`。
- `renderSection()` 之後渲染 `renderStatusMessage()` 的條件由 `section !== 'merchant'` 擴大為 `section !== 'merchant' && section !== 'tags'`，避免 status 同時被 SettingsPage 與 tag section 各自渲染一次。
- `handleRenameTag` 完成後從 `resetTagRenameState('')` 改為 `resetTagRenameState(result.newTag)`：
  - 不管是一般更名或合併到既有 tag，都把選取切到新 tag。
  - 沿用既有 `resetTagRenameState` 的清空輸入與 preview 行為，並讓 tag transactions 重新載入（透過 `useEffect` watch `selectedTagToRename` 或同樣呼叫 reset helper，視現有實作）。
- 設定相關交易重新載入：tag transactions 目前由 `selectedTagToRename` 變更時的 effect 觸發；切到 `result.newTag` 後會自動重抓，與 merchant 的行為一致。

### `components/settings/TagManagementSection.tsx`

- 新增 `status: SettingsStatus` prop（型別來自 `./settingsStatus`），與 merchant section 同形狀。
- 內聯一份與 `MerchantFeedbackCard` 樣式相同的 `TagFeedbackCard`（不抽共用元件——`SettingsFeedbackCard` 統一抽離已被 `TODO.md` 的 `section-owned-status-state.md` 追蹤，留給後續一次處理）：
  - tone：`error` / `success` / `warning`，色票與 merchant 對齊（`text-slate-200` body、`text-amber-300` warning 標題等）。
  - 無左側 ⚠️ icon，避免與 merchant 不一致。
  - 支援可選 `action: SettingsStatusAction`，按鈕樣式（`CloudUpload` + label）與 merchant 一致，避免「查看同步狀態」按鈕在 tag 子頁缺席或樣式飄移。
- 渲染位置：
  - 預覽 / 更名相關訊息（一般 error、合併提醒、預覽結果為 0 等）放在輸入區下方、預覽按鈕上方或之後，與 merchant 的 `renameFeedbackMessage` 對齊：
    - merchant 規則：`!merchantRenamePreview && status.type !== 'idle'` 時才顯示 feedback。
    - tag 採用同邏輯，避免黃色預覽匡同時與紅色錯誤卡爭搶位置。
  - 完成更名後（已切到新 tag、`tagRenamePreview === null`）的成功 / 同步失敗訊息，仍透過同一個 `TagFeedbackCard` 顯示在預覽按鈕上方。
- 拆掉現有「預覽 + 確認」並排 grid：
  - 預覽按鈕永遠渲染。
  - 確認按鈕只在 `tagRenamePreview` 存在時才渲染，icon 在送出中切換為 `LoaderCircle + animate-spin`、文字為「更名中...」。
- 預覽按鈕 disabled 條件對齊 merchant：`!renamedTagInput.trim() || isTagPreviewLoading || isTagRenameSubmitting`。

### 不會改動

- `services/tagService.ts`：`TagRenamePreview`、`renameTagInTransactions` 不變。
- `App.tsx` 的 `renameTag` 回傳形狀已含 `newTag`，不必調整。

## 介面與型別

- `TagManagementSectionProps` 新增 `status: SettingsStatus`，引用 `./settingsStatus`。
- 共用型別已存在於 `components/settings/settingsStatus.ts`，tag section 直接 import；不新增任何型別。

## UI 細節

- 預設狀態（尚未按下預覽）：
  - 顯示原 tag、新名稱輸入框與預覽按鈕；確認按鈕、黃色預覽匡都不渲染。
  - 若有上一輪殘留的成功 / 失敗 status，顯示在預覽按鈕上方的 `TagFeedbackCard`，樣式與 merchant 對齊（無 ⚠️）。
- 按下預覽且 `tagRenamePreview` 取得後：
  - 輸入下方依序：黃色預覽匡 → 確認按鈕。
  - 合併警告 `conflictsWithExistingTag` 仍顯示在黃色匡內，文字保留：「提醒：新名稱已存在；確認後會合併為同一個 tag，並自動去除重複 tag。」
- 確認送出中：
  - 預覽按鈕同步 disable。
  - 確認按鈕 icon 切換到 `LoaderCircle` + `animate-spin`，文字「更名中...」。
- 完成更名：
  - 編輯區仍保留，但已切到新 tag（`result.newTag`）。
  - 黃色預覽匡與確認按鈕消失，回到只有預覽按鈕的初始狀態。
  - `TagFeedbackCard` 顯示成功 / 離線 / 同步部分失敗訊息；若是同步部分失敗，附帶「查看同步狀態」按鈕。

## 測試計劃

- `npm --prefix worktrees/tag-rename-confirm-alignment run build` 通過 `tsc --strict` 與 Vite production build。
- 手動驗證：
  - 一般更名：選 tag、輸入新名稱、預覽 → 黃色匡 + 確認按鈕；按確認 → 訊息卡無 ⚠️、樣式與 merchant 一致；更名完成後選取自動切到新 tag，編輯區不消失。
  - 合併到既有 tag：輸入既有 tag 名，預覽顯示合併提醒；按確認後選取切到合併目標 tag，related transactions 重抓。
  - 修改新名稱輸入：黃色匡與確認按鈕同時消失。
  - 同步部分失敗：訊息卡內出現「查看同步狀態」按鈕，可導向同步狀態頁，返回後仍在 tag 子頁。
  - 在 merchant 子頁交叉確認操作節奏與訊息卡樣式一致。

## 假設

- 不抽出 `SettingsFeedbackCard` 共用元件；那項抽共用已被 `docs/todo-references/section-owned-status-state.md` 追蹤，留待後續一起處理。
- 不調整 `services/tagService.ts` 與 `App.tsx` 的 rename 行為；本次純前端視覺與選取狀態對齊。
- 不修改 merchant section 行為，以 merchant 為基準對齊 tag。
- worktree 路徑：`worktrees/tag-rename-confirm-alignment`。
