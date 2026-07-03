# App 內建確認 UI 紀錄

## 摘要

- `AddTransactionModal` 刪除交易與 `SettingsPage` 匯入／重置／插入範例資料使用的 browser `confirm()` 已改為 app 內建確認對話框。
- 導入 `sweetalert2` 並以統一 wrapper 套用深色 theme，取代自建 dialog 方案。
- 刪除流程保留取消、確認、關閉與 keyboard 可用性。

## 關鍵變更

- 新增 `services/dialogService.ts`，提供共用 `confirmAction()`（title、message、confirmLabel、tone 等參數），供各處危險操作與確認流程呼叫。
- `AddTransactionModal` 的 `handleDelete` 改為開啟 `confirmAction()` danger dialog；確認後才呼叫 `onDelete` 與 `onClose`。
- `SettingsPage` 的匯入覆蓋、重複 ID 覆蓋、最終匯入、重置本機資料與插入範例資料確認皆改走 `confirmAction()`。
- 新增 `sweetalert2` dependency，wrapper 統一深色視覺；完整的回饋機制對照見 [user-feedback-inventory.md](../user-feedback-inventory.md)。

## 介面與型別

- 交易資料模型未變更。
- `services/dialogService.ts` 為對話框單一入口；後續的成功 toast（`showAutoDismissToast()`）沿用同一 service（見 [alert-toast-center.md](./alert-toast-center.md)）。

## 驗證

- `npm run build` 通過。
- 已手動驗證編輯交易時按刪除會出現 app 內確認 UI。
- 已驗證取消不刪資料，確認才刪資料且 modal 關閉。
- 已驗證 dialog 在手機寬度、ESC/返回、快速連點下不會重複刪除。

## 決策

- 原計劃傾向自建 dialog 以降低 bundle 與樣式風險，評估後改採 `sweetalert2` 統一 alert/confirm 互動；bundle 影響由 [dynamic-sweetalert2.md](../todo-references/dynamic-sweetalert2.md) 的動態載入計劃追蹤。
