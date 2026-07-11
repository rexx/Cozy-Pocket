# Toast 系統統一

## 摘要

- 統一瞬時回饋為底部輕量 toast（`App.tsx` 的 `SuccessToast` + `showToast`）；`sweetalert2` 只保留需要互動按鈕的 `confirmAction`。
- 移除了 swal 的置中 auto-dismiss toast（`showAutoDismissToast`），交易新增／修改／刪除成功改用輕量 toast，反轉了先前 [alert-toast-center.md](alert-toast-center.md) 的決策。
- 設定頁各 Section 的 inline status 與 toast 不再重複；同一場景只會出現 toast 或 inline status 其中一種。

## 分工原則

- 瞬時純文字回饋 → 底部輕量 toast。
- 需要確認／取消按鈕 → swal `confirmAction`。
- 帶後續行動按鈕（例如「查看同步狀態」）或多行詳細內容 → inline status，不再同時發 toast。
- 錯誤訊息 → 維持 inline status。
- 更名預覽卡等流程 UI 不屬於通知，未列入本次範圍。

## 關鍵變更

- `services/dialogService.ts`：刪除了 `showAutoDismissToast` 與 `AutoDismissToastOptions`，只留 `confirmAction`。
- `App.tsx`：
  - 交易新增／修改／刪除成功的 `showAutoDismissToast` 改為 `showToast`。
  - `renameTag` / `renameMerchant` 內的 `showToast` 移除，回饋責任移交給對應 Section（避免 App 發 toast、Section 又發 status 的雙重通知）。
- `components/settings/AiSection.tsx`：儲存成功不再設定 success status（toast 已由 `SettingsPage` 的 `onNotify` 發出）；失敗仍走 error status。`onSaveGeminiApiKey` 簽名改為 `Promise<void>`。
- `components/settings/PreferencesSection.tsx`：「至少要保留一個可用幣別」只留 toast；整組 status state／`SettingsStatusCard` 已移除。
- `components/settings/SyncSection.tsx`：
  - 同步設定儲存：全成功只留 toast；離線與部分失敗只留 inline status（含離線提示／「查看同步狀態」action），不發 toast。
  - 年度雲端同步：完成時已導航到 `PullReportsPage`（`SettingsPage` 隨即 unmount），移除了導航後不可見的 `setStatus` dead code；改為三種結果（成功／部分失敗／失敗）都以 toast 呈現，報告詳情由 `PullReportsPage` 呈現。選年份前的驗證錯誤與 `onPullFromCloud` 拋錯（未導航）時的 error status 維持不變。
- `components/settings/ImportExportSection.tsx`：CSV 匯入全成功只留 toast；離線與部分同步失敗只留 inline status（含 action），不發 toast。
- `components/settings/TagManagementSection.tsx` / `MerchantManagementSection.tsx`：
  - 新增了 `onNotify` prop（由 `SettingsPage` 透傳）。
  - 更名全成功改為 toast（含「共更新 N 筆」），status 歸 idle。
  - 離線與部分同步失敗維持 inline status（含 action），不發 toast。
- `docs/todo-references/dynamic-sweetalert2.md`：同步更新——swal 僅剩 confirm 用途，原計劃中的 toast 驗證段落已移除。

## 介面與型別

- `AiSectionProps.onSaveGeminiApiKey`：`() => Promise<string>` → `() => Promise<void>`；`SettingsPage.saveGeminiApiKey` 不再回傳 message。
- `TagManagementSection` / `MerchantManagementSection` props 新增 `onNotify: (message: string) => void`。
- `PreferencesSection` 已移除內部 `SettingsStatus` state。
- `showToast` 與 `SuccessToast` 本身未改動；tone／換行／顯示時間調整仍由 [toast-resilience.md](../todo-references/toast-resilience.md) 後續處理。

## UI 細節

- toast 外觀維持原樣（底部 emerald pill、1800ms）；本次只統一「哪些訊息走 toast」。
- `SuccessToast` 在 `App.tsx` 六個 view 分支各渲染一次，收斂工作留給 `app-tsx-decomposition`，本次未處理。
- 交易新增／修改／刪除成功從畫面正中央 swal modal 改回底部 pill，反轉了先前 [alert-toast-center.md](alert-toast-center.md) 的決策；該紀錄本身維持不可變快照，不回頭修改。

## 驗證

- 執行 `npm run build`（tsc strict + Vite production build）通過。
- 使用 cmux browser 對 worktree dev server 做互動驗證：
  - 交易新增／修改／刪除成功顯示底部輕量 toast，不再出現置中 swal modal；刪除確認 swal 對話框行為不變。
  - AI 設定儲存只出現底部 toast，設定頁內不再出現重複的寬版訊息框。
  - Tag 更名全成功只出現 toast（含更新筆數），不再重複顯示頁內完成卡。
- 手動確認同步設定儲存、CSV 匯入、商家更名的離線／部分失敗情境維持只顯示頁內 status（含「查看同步狀態」按鈕），無 toast；危險操作與匯入確認等 swal 對話框行為不變。

## 假設與限制

- toast 承接現有訊息長度（更名摘要含筆數約 20 餘字）；更長訊息的換行與 timing 改善留給 [toast-resilience.md](../todo-references/toast-resilience.md)。
- 錯誤訊息維持頁內呈現，未因本次統一改走 toast（toast 目前僅有 success 外觀）。
