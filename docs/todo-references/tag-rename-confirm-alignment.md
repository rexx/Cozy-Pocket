# Tag 更名流程與商家更名對齊計劃

## 摘要

把 `TagManagementSection` 的更名按鈕順序與顯示邏輯，對齊到 `MerchantManagementSection` 已採用的「預覽 → 確認」兩階段顯示。預設只顯示預覽按鈕，按下預覽後才在輸入下方出現黃色預覽匡，並同時露出確認按鈕；同步補上確認按鈕送出中的旋轉 icon，讓兩個設定子頁的更名操作有一致的視覺節奏。

## 關鍵變更

- `components/settings/TagManagementSection.tsx`
  - 拆掉現有的 `預覽 + 確認` 並排 grid，改成兩個獨立的 `grid grid-cols-1 gap-3` 區塊：
    - 第一個區塊永遠顯示「預覽影響筆數」按鈕。
    - 第二個區塊只在 `tagRenamePreview` 存在時才渲染「確認更名」按鈕。
  - 黃色預覽匡保留在輸入區下方、確認按鈕上方，與 merchant 一致。
  - 確認按鈕送出中時，將前綴 icon 從 `CheckCircle2` 換成旋轉中的 `LoaderCircle`（沿用 merchant 的 `lucide-react` 用法）。
- 預覽按鈕 disabled 條件改成 `!renamedTagInput.trim() || isTagPreviewLoading || isTagRenameSubmitting`（含送出中），與 merchant 的判斷一致；確認按鈕仍依 `affectedCount` 與 loading 狀態 disable。

## 介面與型別

- 無需新增 props。`TagManagementSectionProps` 既有欄位（`tagRenamePreview`、`isTagPreviewLoading`、`isTagRenameSubmitting`、`onPreviewTagRename`、`onRenameTag` 等）已足以驅動新顯示邏輯。
- `TagRenamePreview` 型別維持原狀（`oldTag` / `newTag` / `affectedCount` / `conflictsWithExistingTag`），不影響 `services/tagService.ts`。
- `SettingsPage` 端不需要改動，因為輸入變更時已會 `setTagRenamePreview(null)`，確認按鈕會自動隱藏。

## UI 細節

- 預設狀態（尚未按下預覽）：
  - 顯示原 tag 與新名稱輸入框。
  - 下方只出現預覽按鈕；確認按鈕完全不渲染（不是 disabled），避免使用者誤點與視覺擁擠。
- 按下預覽且 `tagRenamePreview` 取得後：
  - 輸入下方顯示既有的黃色預覽匡：`#oldTag → #newTag`、`預計影響：N 筆`、若 `conflictsWithExistingTag` 顯示合併提醒。
  - 預覽匡下方接著出現確認按鈕；位置與 merchant 的「黃色匡 → 確認」一致。
- 確認送出中：
  - 預覽按鈕同步 disable。
  - 確認按鈕左側 icon 改為 `LoaderCircle` + `animate-spin`，文字變為「更名中...」。
- 輸入變更導致 `tagRenamePreview` 被清掉時：
  - 黃色預覽匡與確認按鈕一起消失，回到只顯示預覽按鈕的初始狀態。
- 視覺色系維持 tag 既有的青色（`sectionCyanButtonClassName`）與綠色（`sectionEmeraldButtonClassName`），不引入 merchant 的 `MerchantFeedbackCard` 共用元件；這次只對齊「按鈕順序與顯隱」，不擴大到 feedback card 抽共用。

## 測試計劃

- `npm --prefix worktrees/tag-rename-confirm-alignment run build` 通過 `tsc --strict` 與 Vite production build。
- 手動驗證：
  - 開啟 Tag 管理子頁，選一個 tag，未按預覽前畫面只看得到預覽按鈕。
  - 輸入新名稱按預覽 → 黃色匡與確認按鈕同時出現；按確認後旋轉 icon 顯示，完成後 tag 列表更新、表單回到只剩預覽按鈕的初始狀態。
  - 修改新名稱輸入 → 黃色匡與確認按鈕同時消失。
  - 輸入既有 tag 名稱觸發合併警告 → 確認按鈕仍可按；完成後合併結果正確。
  - 在 merchant 管理子頁交叉確認操作節奏一致。

## 假設

- 維持「預覽 → 確認」兩段式互動，不引入「直接確認」捷徑；與 merchant 子頁一致是目標。
- 不重構共用 feedback card，也不調整文字色系或 icon 大小，只動按鈕顯示邏輯與旋轉 icon，避免影響其他設定子頁。
- 不修改 `services/tagService.ts` 與 `SettingsPage` 內既有的 state 清空時機；本次純前端視覺與互動對齊。
- worktree 路徑：`worktrees/tag-rename-confirm-alignment`。
