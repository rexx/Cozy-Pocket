# 交易儲存震動回饋實作計劃

本項目實作時會使用新的 git worktree 進行開發，不直接修改目前 repo 根目錄；建議 worktree 路徑為 `worktrees/transaction-save-haptic-feedback`，完成後再由該分支提交與合併。

## 摘要

- 交易編輯完成並成功儲存時，除了現有 toast，也觸發一次輕量震動回饋。
- 目標是讓手機 PWA 使用者在按下儲存後有更明確的觸覺確認。
- 不支援震動 API 的裝置或瀏覽器直接 no-op，不顯示錯誤。

## 關鍵變更

- 新增小型 helper，例如 `services/hapticService.ts`，包裝 `navigator.vibrate?.(duration)` 與瀏覽器支援檢查。
- 在 `App.tsx` 的 `updateTransaction` 成功寫入 IndexedDB 並顯示「已儲存修改」toast 後，呼叫成功震動 helper。
- 震動模式保持短促，例如 10 到 20ms，避免干擾使用者。
- 新增交易流程可先不套用；本項目聚焦「交易編輯完成按下儲存」。

## 介面與型別

- 新增 `triggerSuccessHaptic()` 或類似函式，回傳 `void`。
- 不新增使用者設定；震動只在瀏覽器與系統允許時發生。
- 不改 `AddTransactionModal` props，儲存成功仍由 `onUpdate` 回傳 `true` 關閉 modal。

## 測試計劃

- 執行 `npm run build`。
- 手動在支援震動的手機瀏覽器或 PWA 中編輯交易並儲存，確認 toast 與震動都發生。
- 手動在不支援 `navigator.vibrate` 的桌面瀏覽器測試，確認不報錯且 toast 行為不變。
- 驗證儲存失敗時不觸發震動。

## 假設

- 第一版不新增關閉震動的設定；若使用者之後覺得干擾，再補偏好設定。
