# 統計頁排除未來交易選項實作計劃

> **給 agentic workers：** 本項目會使用新的 git worktree `worktrees/stats-exclude-future-toggle` 開發，不直接修改 repo 根目錄；實作時必須逐項執行本計劃，並使用 `superpowers-subagent-driven-development` 或 `superpowers-executing-plans`。

**目標：** 在統計頁提供「排除未來交易」選項，讓使用者決定統計結果是否包含時間晚於現在的交易。

**架構：** 在期間篩選後建立一層 eligible transactions，開啟選項時用 epoch 秒上限移除未來交易。Tag 與支付方式選項、幣別總額、類別與商家彙整、展開明細都從同一份 eligible transactions 衍生，避免不同區塊出現不一致結果。

**技術棧：** React 19、TypeScript strict、date-fns 4、Tailwind CSS v4。

---

## 摘要

- 篩選面板新增「排除未來交易」switch，預設開啟；使用者可關閉以重新納入未來交易。
- 開啟後，`timestamp` 嚴格晚於篩選計算當下的交易不會出現在任何統計結果或篩選選項。
- 等於現在的交易仍會保留；比較前以 `toEpochSeconds()` 統一秒與毫秒單位。
- 本項目不修改交易內容、IndexedDB 或同步資料，屬於資料風險綠區。

## 關鍵變更

- `services/statsService.ts`
  - 新增接受明確上限時間的純函式 `filterTransactionsThroughTimestamp()`。
  - helper 只處理 epoch 秒比較，不自行呼叫 `Date.now()`，讓呼叫端控制同一次計算的時間基準。
- `components/MonthlyStatsPage.tsx`
  - 新增 `excludeFutureTransactions` boolean state，預設 `true`。
  - `periodTransactions` 後新增 `eligiblePeriodTransactions`；開啟選項時擷取一次 `toEpochSeconds(Date.now())` 作為上限。
  - `periodTags`、支付方式清單與 `filteredTransactions` 全部改從 `eligiblePeriodTransactions` 衍生。
  - active filter badge、篩選按鈕狀態與展開區塊 reset dependency 納入此選項。

## 介面與型別

- 不變更 `Transaction`、`MonthlyStatsPageProps` 或 IndexedDB schema。
- 新 helper 介面：

```ts
export const filterTransactionsThroughTimestamp = (
  transactions: Transaction[],
  maxTimestamp: number
): Transaction[] => (
  transactions.filter((tx) => toEpochSeconds(tx.timestamp) <= maxTimestamp)
);
```

- `maxTimestamp` 由頁面以 `toEpochSeconds(Date.now())` 建立；不可直接拿毫秒值與 `Transaction.timestamp` 比較。

## UI 細節

- switch 放在現有篩選面板內，接在支付方式區塊之後，不占用面板外控制列空間。
- 可點擊整列切換，並使用 `role="switch"`、`aria-checked` 與清楚的 focus 樣式。
- 關閉顯示「包含未來交易」，開啟顯示「已排除未來交易」。
- 開啟時 active filter badge 加入「排除未來」；關閉時不顯示額外文字。
- 不新增 `viewport-fit=cover`、safe-area padding 或 fixed 元件。

## 實作步驟

### Task 1：建立獨立 worktree 並確認基準

**Files:**

- Read: `AGENTS.md`
- Read: `docs/pwa-layout-gotchas.md`

- [ ] 從最新 `main` 建立 `worktrees/stats-exclude-future-toggle` 與同名分支。
- [ ] 建立 `node_modules` symlink，指向 repo 根目錄既有依賴。
- [ ] 執行 `npm --prefix worktrees/stats-exclude-future-toggle run build`，預期成功。

### Task 2：新增未來交易純篩選函式

**Files:**

- Modify: `services/statsService.ts`

- [ ] 新增 `filterTransactionsThroughTimestamp()`，對交易與上限時間都使用 epoch 秒。
- [ ] 保留 `timestamp === maxTimestamp` 的交易，只排除嚴格大於上限的資料。
- [ ] 不改動 `getMonthTransactions()` 與 `getYearTransactions()`，避免改變其他呼叫端的期間語意。
- [ ] 執行 build，預期成功。

### Task 3：串接統計頁 state、資料來源與 switch

**Files:**

- Modify: `components/MonthlyStatsPage.tsx`

- [ ] 新增預設為 `true` 的 `excludeFutureTransactions` state。
- [ ] 在期間交易之後計算 `eligiblePeriodTransactions`，同一次計算只擷取一次現在時間。
- [ ] 讓 Tag 清單、支付方式清單與最終 `filteredTransactions` 使用 eligible transactions。
- [ ] 在篩選面板加入可存取的 switch 與狀態文案。
- [ ] 更新 `hasActiveFilters`、badge 文案與展開區塊 reset dependency。
- [ ] 執行 `npm --prefix worktrees/stats-exclude-future-toggle run build`，預期成功且沒有 TypeScript 錯誤。

### Task 4：更新行為文件並完成驗證

**Files:**

- Modify during cleanup: `README.md`
- Move during cleanup: `docs/todo-references/stats-exclude-future-toggle.md`
- Modify during cleanup: `TODO.md`
- Modify during cleanup: `CHANGELOG.md`

- [ ] 在 `README.md` §6.6 記錄選項位置、預設值與嚴格晚於現在的定義。
- [ ] 執行 `npm --prefix worktrees/stats-exclude-future-toggle run docs:check`，預期 `docs-check: OK`。
- [ ] 等使用者執行 `/start-local-server` 後，準備同期間的過去、現在與未來交易，在 iPhone 寬度切換選項。
- [ ] 驗證開啟時 Tag 與支付方式選項、總額、類別、商家及所有展開明細同步排除未來交易。
- [ ] 驗證關閉後未來交易立即恢復，且月份、年份、Tag、支付方式與子類別排除仍可疊加。
- [ ] 使用者驗收後再執行 `/git-branch-cleanup`，由該流程更新完成紀錄、commit、合併並移除 worktree。

## 測試計劃

- 自動檢查：`npm run build`、`npm run docs:check`。
- 手動檢查：預設開啟；開關往返；過去、等於現在、未來三種時間邊界；月份與年份模式；所有彙整與 filter options 使用相同資料集。
- 專案目前沒有測試框架，本項目不新增 runner；時間邊界以固定 fixture 手動驗證。

## 假設

- 選項預設開啟，進入統計頁時先排除未來交易；使用者可手動關閉以恢復完整期間資料。
- 選項只存在於本次統計頁 mount，不寫入 `localStorage` 或 Dexie。
- 頁面不建立計時器；現在時間會在交易、期間或選項變動而重新計算篩選時更新。
- 實作期間不 commit；使用者完成瀏覽器驗收後，由 `/git-branch-cleanup` 產生單一完整 commit。
