# SettingsPage Status Type 擴充計劃

本項目實作時會使用新的 git worktree 進行開發，不直接修改目前 repo 根目錄；建議 worktree 路徑為 `worktrees/settings-status-types`，完成後再由該分支提交與合併。

## 摘要

- 擴充 `SettingsPage` 的 status type，不只保留 `success | error | idle`。
- 讓離線提醒、預覽提醒、合併提示可使用更準確的 `info` 或 `warning` 語意。
- 改善目前部分提醒使用 success tone 表示非成功狀態的問題。

## 關鍵變更

- 將 status type 擴充為 `idle | success | error | info | warning`。
- 更新 `SettingsPage`（含其各 Section 子頁內已 inline 的 `MerchantFeedbackCard` 等 feedback 卡）的 status render tone、icon 與 border/background class。
- 將「目前離線，待恢復連線後同步」改為 info 或 warning。
- 將「執行後會合併 tag/商家」改為 warning，而不是 success。

## 介面與型別

- 新增共用 `StatusType` 型別，或在各頁內先建立局部 union。
- 若已有共用 status 元件，可讓其接收 `type` 與 `message`。

## 測試計劃

- 執行 `npm run build`。
- 手動驗證同步設定儲存、離線、同步失敗、tag 合併提示、商家合併提示的顏色語意正確。
- 確認 `idle` 不渲染 status，其他 type 都有可辨識 icon 與文字。
- 檢查手機寬度下多行 status 不會擠壓操作按鈕。

## 假設

- 此項目只調整語意與樣式，不改變任何資料操作流程。
