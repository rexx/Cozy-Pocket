# 統計頁交易日期縮短實作計劃

> **給 agentic workers：** 本項目會使用新的 git worktree `worktrees/stats-transaction-datetime-compact` 開發，不直接修改 repo 根目錄；實作時必須逐項執行本計劃，並使用 `superpowers-subagent-driven-development` 或 `superpowers-executing-plans`。

**目標：** 統計頁交易明細只顯示月日，將更多橫向空間留給交易名稱；完整日期時間保留給輔助資訊。

**架構：** 在 `TransactionItem` 增加 opt-in 的 compact 日期顯示模式，預設仍維持目前的完整格式。只有 `MonthlyStatsPage` 的四個展開明細呼叫點啟用 `MM-dd`；完整日期時間另透過 title 與 aria-label 提供。

**技術棧：** React 19、TypeScript strict、date-fns 4、Tailwind CSS v4。

---

## 摘要

- 統計頁展開交易明細目前顯示 `yyyy-MM-dd HH:mm`，會固定占用標題列右側較寬空間。
- 可見格式改為 `MM-dd`，例如 `2026-07-11 09:30` 改顯示為 `07-11`。
- 同步狀態、同步紀錄、Tag 管理與商家管理仍顯示 `yyyy-MM-dd HH:mm`；首頁等未傳入 `showDateTime` 的場景仍只顯示 `HH:mm`。
- 本項目只改呈現，不調整 timestamp、排序、資料模型或同步，屬於資料風險綠區。

## 關鍵變更

- `components/TransactionItem.tsx`
  - 將日期物件只建立一次，再產生 compact 與完整兩種字串。
  - 新增 `dateTimeDisplayMode?: 'full' | 'compact'`，預設為 `full`；只有同時傳入 `showDateTime` 與 `compact` 時，可見文字才使用 `MM-dd`。
  - compact 模式的日期元素以 `title` 與 `aria-label` 保留 `yyyy-MM-dd HH:mm`，避免可見文字移除年份與時間後失去完整資訊。
  - 不更動 icon、tag chip、金額、同步狀態點或整列 padding。
- `components/MonthlyStatsPage.tsx`
  - 四個展開明細路徑同時傳入 `showDateTime` 與 `dateTimeDisplayMode="compact"`。
  - 同步狀態、同步紀錄、Tag 管理與商家管理不傳入新 prop，因此維持完整格式。

## 介面與型別

- `TransactionItemProps.showDateTime?: boolean` 維持不變；新增受限 union prop，不讓呼叫端任意傳入 date-fns format string。
- 建議整理為以下邏輯：

```ts
type DateTimeDisplayMode = 'full' | 'compact';

interface TransactionItemProps {
  showDateTime?: boolean;
  dateTimeDisplayMode?: DateTimeDisplayMode;
}

const transactionDate = new Date(toEpochMillis(transaction.timestamp));
const fullDateTime = format(transactionDate, 'yyyy-MM-dd HH:mm');
const formattedTime = format(
  transactionDate,
  showDateTime
    ? dateTimeDisplayMode === 'compact' ? 'MM-dd' : 'yyyy-MM-dd HH:mm'
    : 'HH:mm'
);
```

- `dateTimeDisplayMode` 預設為 `full`，確保既有 `showDateTime` 呼叫端無須修改且行為不變。
- 只有 compact 模式需要額外提供完整日期的 title 與 aria-label；full 與 time-only 模式維持目前語意。

## UI 細節

- 可見日期固定使用兩位數月日與連字號，例如 `07-11`，避免同一列表寬度跳動。
- 日期元素保留 `tabular-nums` 與不換行行為；移除年份與時間後釋出的空間由左側 flex title 區自然取得。
- 不調整目前 tag 存在時標題 `max-w-[65%]` 的保護規則，避免本項目同時改變 tag chip 排版。
- 不加入 `viewport-fit=cover`、`env(safe-area-inset-*)` 或新的 fixed 定位。

## 實作步驟

### Task 1：建立獨立 worktree 並完成版面前置檢查

**Files:**

- Read: `AGENTS.md`
- Read: `docs/pwa-layout-gotchas.md`
- Inspect history: `components/TransactionItem.tsx`

- [ ] 從最新 `main` 建立 `worktrees/stats-transaction-datetime-compact` 與同名分支。
- [ ] 建立 `node_modules` symlink，指向 repo 根目錄既有依賴。
- [ ] 執行 `git log --oneline -- components/TransactionItem.tsx docs/pwa-layout-gotchas.md`，確認沒有漏掉近期手機版排版修正。
- [ ] 執行 `npm --prefix worktrees/stats-transaction-datetime-compact run build`，預期成功。

### Task 2：新增 opt-in compact 模式並只套用統計頁

**Files:**

- Modify: `components/TransactionItem.tsx`
- Modify: `components/MonthlyStatsPage.tsx`

- [ ] 共用同一個 `transactionDate`，避免對同一 timestamp 重複轉換。
- [ ] 新增預設為 `full` 的 `dateTimeDisplayMode` union prop；`showDateTime` 為 `false` 時仍顯示 `HH:mm`。
- [ ] compact 模式顯示 `MM-dd`，並為日期元素加入完整日期時間的 `title` 與 `aria-label`。
- [ ] 在 `MonthlyStatsPage` 四個 `TransactionItem` 呼叫點傳入 `dateTimeDisplayMode="compact"`。
- [ ] 不修改 `SyncStatusPage`、`PullReportsPage`、`TagManagementSection` 與 `MerchantManagementSection` 的呼叫方式。
- [ ] 執行 `npm --prefix worktrees/stats-transaction-datetime-compact run build`，預期成功且沒有 TypeScript 錯誤。

### Task 3：更新行為文件並完成 iPhone 版面驗證

**Files:**

- Modify during cleanup: `README.md`
- Move during cleanup: `docs/todo-references/stats-transaction-datetime-compact.md`
- Modify during cleanup: `TODO.md`
- Modify during cleanup: `CHANGELOG.md`

- [ ] 在 `README.md` §6.7 記錄統計頁明細可見文字只顯示 `MM-dd`，完整日期時間保留在輔助資訊。
- [ ] 執行 `npm --prefix worktrees/stats-transaction-datetime-compact run docs:check`，預期 `docs-check: OK`。
- [ ] 等使用者執行 `/start-local-server` 後，以 iPhone 寬度驗證長交易名稱、有 tag、無 tag、文字與 icon 支付方式。
- [ ] 逐一驗證收入／支出總額、類別與商家展開明細都只顯示 `MM-dd`。
- [ ] 驗證同步狀態、同步紀錄、Tag 管理與商家管理仍顯示 `yyyy-MM-dd HH:mm`，首頁仍只顯示 `HH:mm`。
- [ ] 若畫面看不到變更，先硬重新整理或移除舊 Service Worker，再判斷程式問題。
- [ ] 使用者驗收後再執行 `/git-branch-cleanup`，由該流程更新完成紀錄、commit、合併並移除 worktree。

## 測試計劃

- 自動檢查：`npm run build`、`npm run docs:check`。
- 手動檢查：不同年份與月份、長短名稱、0 至多個 tag、所有統計頁展開來源，以及其他共用 `TransactionItem` 的頁面未受影響。
- 主要驗收裝置為 iPhone standalone PWA；桌面瀏覽器只作輔助，不以桌面空間判斷完成。

## 假設

- compact 格式固定為 `MM-dd`，不依月份或年份模式切換格式。
- 統計頁期間標題已提供年份脈絡，交易時間對此列表的辨識重要性較低；完整日期時間保留在 title 與 aria-label。
- `dateTimeDisplayMode` 未傳入時固定使用 `full`，維持所有既有 `showDateTime` 呼叫端行為。
- 實作期間不 commit；使用者完成瀏覽器驗收後，由 `/git-branch-cleanup` 產生單一完整 commit。
