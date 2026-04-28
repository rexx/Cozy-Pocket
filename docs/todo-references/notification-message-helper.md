# 通知文案 Helper 實作計劃

本項目實作時會使用新的 git worktree 進行開發，不直接修改目前 repo 根目錄；建議 worktree 路徑為 `worktrees/notification-message-helper`，完成後再由該分支提交與合併。

## 摘要

- 抽出共用通知文案與摘要組裝 helper，避免 toast 與頁內狀態訊息逐漸分歧。
- 優先整理同步、匯入、tag 更名、商家更名等目前已有多處手寫文案的流程。
- Helper 不負責顯示 UI，只負責產生一致訊息與摘要資料。

## 關鍵變更

- 新增 `services/notificationMessageService.ts` 或 `services/statusMessageService.ts`。
- 將 `App.tsx` 的 `buildSyncFailureSummary` 與設定頁內同步結果文案搬到 helper。
- 建立明確輸入，例如 sync total/failed/skippedOffline、操作名稱、受影響筆數。
- Toast 使用短句，頁內 status 使用較完整內容；兩者由同一 helper 回傳。

## 介面與型別

- 新增訊息組裝型別，例如 `OperationMessageResult`，包含 `toastMessage`、`statusMessage`、`statusType`。
- 既有 component props 可先維持不變，只替換內部文案來源。

## 測試計劃

- 執行 `npm run build`。
- 針對 helper 補純函式測試；若專案尚無 test runner，先在計劃後續補測試基礎或以手動案例驗證。
- 手動驗證匯入成功、同步部分失敗、tag 更名、商家更名的 toast/status 分工一致。
- 檢查繁體中文文案不出現彼此矛盾的成功/失敗描述。

## 假設

- 本項目不重設 toast 元件外觀，只統一文案來源。
