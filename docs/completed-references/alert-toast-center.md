# Alert Toast 置中顯示

## 摘要

- `services/dialogService.ts` 的 `showAutoDismissToast()` 已從緊湊的「貼底 swal toast pill」改造為畫面正中央的圓角方形 modal，外觀規格沿用 `confirmAction()` 的 popup / title customClass：`rounded-[28px] border border-white/10`、深色背景、`text-base font-bold text-white` 標題。
- 同時加上 `backdrop: false`，所以背景不會變暗，1800ms 內 swal2 仍會 trap focus 到 popup（接受的取捨——通知時間極短，且不要求使用者決策）。
- 影響範圍嚴格限縮在 swal2 通道：新增、修改、刪除交易成功（`已儲存新紀錄` / `已儲存修改` / `已刪除紀錄`）三條走 `showAutoDismissToast()` 的場景。`App.tsx` 自製的 `SuccessToast`（連線狀態、同步摘要、tag / 商家更名等）仍貼底，留給 [`toast-resilience.md`](../todo-references/toast-resilience.md) 後續處理。
- 文案、計時（1800ms）、icon（預設 success）、呼叫端皆未變動，只改 swal2 設定與 customClass。

## 關鍵變更

- `services/dialogService.ts#showAutoDismissToast`
  - 移除 `toast: true`，改用 swal2 預設 modal 結構（更大、更方）。
  - `position: 'bottom'` 改為 `position: 'center'`。
  - 新增 `backdrop: false`，保留「不變暗整個畫面」的非干擾感。
  - popup customClass 由 `mb-24 rounded-2xl border border-emerald-400/30 bg-[#1f2235] px-4 py-3 shadow-2xl` 改為 `rounded-[28px] border border-white/10 bg-[#1f2235] px-2 pb-4 pt-3 shadow-2xl`（對齊 `confirmAction()` 的 `baseDialogOptions.customClass.popup`）。
  - title customClass 由 `text-sm font-bold text-emerald-100` 改為 `px-4 pt-3 text-base font-bold text-white`。比 `confirmAction()` 的 `text-xl font-black` 小一檔，因為成功訊息只有 4–6 個字、沒有 body / button 對照，沿用 `text-xl` 會顯得過重。
  - `timerProgressBar` 維持 `bg-emerald-300`，搭配 swal2 內建的綠色 success ✓ icon 作為唯一的成功色暗示。

未變更：
- 呼叫端：`App.tsx#624`（新增）、`App.tsx#666`（修改）、`App.tsx#691`（刪除）三處 `showAutoDismissToast({ title })`。
- `confirmAction()` 的設定與外觀。
- `App.tsx` 內 `SuccessToast` 元件、`showToast()` helper、`styles.css` 的 `animate-slide-up` 動畫。
- `services/dialogService.ts` 的 `baseDialogOptions`、`getConfirmButtonClassName`、`cancelButtonClassName`。

## 介面與型別

- `AutoDismissToastOptions`（`title`、選用 `icon`、選用 `timer`）對外簽章不變。
- 沒有新增 tone / position / backdrop 參數；如未來要對不同 icon 採用不同位置或樣式，再另案處理。

## UI 細節

- 成功提示出現在 viewport 縱向＋橫向正中央，圓角、邊框與 padding 與 `confirmAction()` 確認對話框視覺一致；同一頁面同時開啟刪除確認對話框與成功 toast 時，兩者外框可直接對照。
- 沒有背景遮罩（`backdrop: false`），不會把畫面變暗。swal2 仍 trap focus 到 popup，1800ms 內背景不可互動。
- title `已儲存新紀錄` / `已儲存修改` / `已刪除紀錄` 以 16px、bold 白字置中顯示；上方為 swal2 內建的綠色 success ✓ icon；底部 1800ms timer progress bar 採 `bg-emerald-300`。
- 連續觸發（連續儲存兩筆）由 swal2 內部管理，不會疊圖、不會留下殘餘 DOM。

## 驗證

- 在 worktree 內執行 `npm run build`，通過 tsc strict + Vite production build。
- 桌面 Microsoft Edge 手動驗證以下情境，確認 popup 出現在正中央、外觀與 `confirmAction()` 對話框一致：
  - 新增交易 → `已儲存新紀錄`。
  - 修改交易 → `已儲存修改`。
  - 刪除交易 → `已刪除紀錄`。
- 同時觀察：背景未變暗、1800ms 自動消失、連續觸發不疊圖。
- 對照 `App.tsx` 的 `SuccessToast`（例如同步摘要、tag / 商家更名）仍維持貼底位置，未受本次變更影響。

## 假設與限制

- 「置中」指 viewport 縱向＋橫向皆置中。
- swal2 在非 toast 模式會 trap focus，1800ms 內背景互動會被阻擋；本案接受此取捨，因為通知時間短且不要求使用者輸入。若日後反饋焦點凍結明顯影響輸入連續性，可回到 `toast: true` 並透過 customClass 強行放大尺寸。
- 沒有 e2e / 視覺回歸測試覆蓋 toast，本次依靠手動驗證。
- `App.tsx` 自製的 `SuccessToast` 是否一併調整外觀，由 [`toast-resilience.md`](../todo-references/toast-resilience.md) 另案處理。
