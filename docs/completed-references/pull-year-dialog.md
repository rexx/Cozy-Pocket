# 年度雲端同步 Pull dialog 獨立成 component（完成紀錄）

## 摘要

年度雲端同步的年份選擇 dialog 原本內嵌在 `components/settings/SyncSection.tsx`，讓該子頁同時持有同步設定表單與 dialog 兩套 state。此項目把 dialog 整段搬到 `components/settings/PullYearDialog.tsx`，`SyncSection` 回到「同步設定表單 + 入口按鈕」的形狀。這是 [`settings-page-decomposition.md`](./settings-page-decomposition.md) Step 4 的紀錄，接在 [`section-owned-status-state.md`](./section-owned-status-state.md)（Step 2 把 dialog 從 container 移入 `SyncSection` 暫管）之後。行為保持不變，文案、樣式與 status 判斷條件都沒有改動。

## 最終狀態

### `components/settings/PullYearDialog.tsx`（新增）
- 自管 `selectedPullYear`、`isPullSubmitting` 與自己的 `SettingsStatus`，並持有同步 `pullYearOptions` 的 `useEffect`（options 清空時重設選取、否則保留仍有效的選取值，都無效時退回第一項）。
- props 為 `isOpen` / `onClose` / `pullYearOptions` / `onPullFromCloud` / `onOpenPullReports` / `onNotify`。**不接 `isOffline`**：離線提示卡與入口按鈕都在 `SyncSection`，dialog markup 沒有用到它。
- 「提交中不可關閉」的守衛跟著 dialog 走：內部 `handleClose` 在 `isPullSubmitting` 時直接 return，成功路徑則直接呼叫 `onClose()` 再導頁。
- component 本身常駐掛載，只有 overlay 由 `isOpen` 控制，因此 status card 渲染在 overlay 之外——與拆解前一致：dialog 期間被 overlay 蓋住，關閉後仍看得到。
- `isOpen` 轉為 true 時重設 status，對應拆解前 `openPullDialog()` 清空共用 status 的行為。
- 同步結果的 toast 沿用 `services/notificationMessageService.ts` 的 `describePullReportOutcome(year, status)`。

### `components/settings/SyncSection.tsx`
- 239 行降到 153 行：只留同步設定表單、離線提示卡、自己的 status、`isPullDialogOpen` 與入口按鈕，並以 props 把 dialog 需要的 callback 透傳下去。
- 入口按鈕仍在開啟 dialog 時清空 section 自己的 status。

`components/SettingsPage.tsx` 與 `App.tsx` 不需要改動——dialog 的 state 在 Step 2 就已離開 container，report 結果回流仍由 `App.tsx` 的 `onPullFromCloud` 處理。

## 驗證

- `npm run build`（tsc strict + Vite）通過，rebase 到最新 main 後重跑一次仍通過。
- 以 in-app Browser 在獨立 port 的 dev server（全新 origin，無同步憑證）互動驗證：
  - 開關 dialog、年份選單顯示去年／今年／明年三個選項、預設選第一項；改選後關閉再開仍保留該年份，離開子頁再返回則重置為第一項（與拆解前相同，state 綁在停留於畫面的 component 上）。
  - 未設定同步來源時執行：報告為 `failed`（`Sync config missing`），dialog 關閉、toast 顯示「⟨年⟩ 年年度雲端同步失敗」、導向同步紀錄頁並聚焦該筆報告。
  - 填入 mock API 並儲存後執行：報告為 `partial`，toast 顯示「已完成 ⟨年⟩ 年年度雲端同步，但有部分失敗」，同樣導頁並聚焦報告。
  - 提交中：提交鍵顯示「處理中...」且 disabled，點「取消」不會關閉 dialog，完成後照常導頁。
  - 入口按鈕開啟 dialog 時，section 既有的 status 卡片被清除。
  - 全程 console 無錯誤與警告。
- 兩條路徑在現行 app 沒有瀏覽器可達的入口，靠 diff 的平移等價性擔保：報告為 `success` 的結果需要 mock pull fixture 提供不含 `local-write-fail` / `push-fail` / invalid item 的乾淨模式；`pullYearOptions` 為空則因 `App.tsx` 的 memo 固定給三個年份而不可達。

## 行為差異備註

- status card 從「`SyncSection` 一張」變成「section 一張 + dialog 一張」，兩張可能並存。dialog 那張在現行 app 幾乎不可達：`pullTransactionsFromCloud` 把年份空白、config missing、離線、HTTP／JSON 錯誤、單筆 invalid item 與 local write 失敗全部轉成 `failed` / `partial` 的報告回傳，而那條路徑一律關 dialog ＋ toast ＋ 導頁；dialog 的 inline error 只在 `onPullFromCloud` 真的拋例外時出現（Dexie 失效、`refreshData()` 失敗這類基礎設施級故障）。warning 分支（`請先選擇要同步的年份`）則因為沒選年份時提交鍵本來就 disabled 而是死路。
- 兩張卡並存時共用 `space-y-4` 節奏，375px 寬下同寬並以 16px 間距堆疊。
