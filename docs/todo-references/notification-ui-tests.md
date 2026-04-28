# 通知行為 UI 測試實作計劃

本項目實作時會使用新的 git worktree 進行開發，不直接修改目前 repo 根目錄；建議 worktree 路徑為 `worktrees/notification-ui-tests`，完成後再由該分支提交與合併。

## 摘要

- 補上通知行為的 UI 測試，涵蓋匯入成功、同步部分失敗、Tag 更名的 toast/status 分工。
- 目前專案沒有 test script，需先選定前端測試工具與最小設定。
- 測試目標是防止通知重複、文案分歧與重要失敗入口遺失。

## 關鍵變更

- 新增 Vitest 與 React Testing Library，或若偏向瀏覽器互動，新增 Playwright component/e2e 測試。
- 優先測試狀態組裝 helper；再補最小 UI 測試確認 toast 與頁內 status 的呈現。
- 將 IndexedDB、cloud sync 與檔案匯入互動 mock 化，避免測試依賴真實網路。
- 在 `package.json` 新增 `test` 或 `test:ui` script。

## 介面與型別

- 可能需要為通知 helper、設定頁 callback 與 sync result 建立更清楚型別。
- 不變更 runtime 使用者介面。

## 測試案例

- 匯入成功時不應重複顯示成功訊息。
- 同步部分失敗時應顯示短 toast 與詳細頁內狀態。
- Tag 更名應遵守與匯入、同步設定相同的 toast/status 分工。
- 離線時應顯示可理解的 info/warning，而不是 error 或 success 混用。

## 假設

- 若尚未完成通知 helper 抽離，本項目應先補 helper 再寫測試，避免測試直接綁死分散文案。
