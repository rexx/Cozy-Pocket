# 統計頁多選 Tag 篩選實作計劃

> **給 agentic workers：** 本項目會使用新的 git worktree `worktrees/stats-multi-tag-filter` 開發，不直接修改 repo 根目錄；實作時必須逐項執行本計劃，並使用 `superpowers-subagent-driven-development` 或 `superpowers-executing-plans`。

**目標：** 讓統計頁可同時選取多個 tag，只有包含全部已選 tag 的交易才會納入統計。

**架構：** 將統計頁的單一 tag state 改為 tag 陣列，並把 AND 比對集中在 `statsService` 的純函式。期間、支付方式與排除子類別仍沿用同一條 `filteredTransactions` 管線，所有總額、彙整與明細自然共用結果。

**技術棧：** React 19、TypeScript strict、date-fns 4、Tailwind CSS v4。

---

## 摘要

- Tag chip 改為可獨立切換的多選控制；「全部」會清空已選 tag。
- 多選採 AND 規則。若選取 `Ipass` 與 `永豐`，交易必須同時具有兩個完整 tag token 才會保留。
- tag 比對維持大小寫敏感、精確 token 比對，不做模糊搜尋或部分字串比對。
- 本項目只改讀取與呈現，不寫入交易、IndexedDB 或同步 payload，屬於資料風險綠區。

## 關鍵變更

- `components/MonthlyStatsPage.tsx`
  - 將 `selectedTag: string` 改為 `selectedTags: string[]`。
  - 新增單一 tag 的 toggle handler；再次點擊已選 tag 會取消該 tag。
  - 切換月份或年份後，只移除新期間不存在的已選 tag，不清除仍有效的選項。
  - `hasActiveFilters`、展開區塊重置條件與 active filter badge 改用 `selectedTags`。
  - 一個 tag 時顯示 `#tag`；多個 tag 時顯示「N 個 tag」，避免手機寬度下 badge 過長。
- `services/statsService.ts`
  - 將 `filterTransactionsByTag` 擴充為 `filterTransactionsByTags`。
  - 每筆交易先建立 tag token set，再用 `selectedTags.every(...)` 實作 AND 比對。

## 介面與型別

- 不變更 `Transaction`、`MonthlyStatsPageProps` 或 IndexedDB schema。
- 新 helper 介面：

```ts
export const filterTransactionsByTags = (
  transactions: Transaction[],
  tags: string[]
): Transaction[] => {
  const normalizedTags = tags.map(normalizeTag).filter(Boolean);
  if (normalizedTags.length === 0) return transactions;

  return transactions.filter((tx) => {
    const transactionTags = new Set(extractTransactionTags(tx));
    return normalizedTags.every((tag) => transactionTags.has(tag));
  });
};
```

- `selectedTags` 保持使用者點選順序；filter helper 只負責正規化與比對，不重新排序 UI state。

## UI 細節

- Tag 列保留現有橫向捲動 chip 版面，不新增第二層面板。
- 「全部」只在 `selectedTags.length === 0` 時呈現選取樣式。
- 已選 tag 沿用目前 cyan 選取樣式，未選 tag 沿用灰色樣式。
- chip 必須保留 `type="button"`，並新增 `aria-pressed` 表達多選狀態。
- 篩選沒有結果時沿用現有空狀態，不新增獨立 dialog 或 toast。

## 實作步驟

### Task 1：建立獨立 worktree 並確認基準

**Files:**

- Read: `AGENTS.md`
- Read: `README.md`

- [ ] 從最新 `main` 建立 `worktrees/stats-multi-tag-filter` 與同名分支。
- [ ] 建立 `node_modules` symlink，指向 repo 根目錄既有依賴。
- [ ] 執行 `npm --prefix worktrees/stats-multi-tag-filter run build`，預期 TypeScript 與 Vite production build 皆成功。

### Task 2：擴充 tag 篩選純函式

**Files:**

- Modify: `services/statsService.ts`

- [ ] 將單一 tag 參數改為 `string[]`，空陣列直接回傳原交易陣列。
- [ ] 使用 `extractTransactionTags()` 與 `Set`，以 `every()` 檢查交易是否具有全部已選 tag。
- [ ] 確認 `Ipass` 不會命中 `Ipass永豐`，大小寫不同的 tag 仍視為不同值。
- [ ] 執行 build，預期先指出 `MonthlyStatsPage` 的舊呼叫介面尚未更新，再進入下一個 task 修正呼叫端。

### Task 3：改造統計頁多選 state 與 UI

**Files:**

- Modify: `components/MonthlyStatsPage.tsx`

- [ ] 將 `selectedTag` 改為 `selectedTags`，新增 toggle 與 clear handler。
- [ ] 日期期間改變時，以 `periodTags` 過濾失效選項；避免因一個 tag 不存在而清除其他仍有效的 tag。
- [ ] 將 `filteredTransactions` 改呼叫 `filterTransactionsByTags(periodTransactions, selectedTags)`。
- [ ] 更新 active filter 判斷、badge 文案與展開狀態 reset dependency。
- [ ] 將 chip 選取樣式改為 `selectedTags.includes(tag)`，並補上 `aria-pressed`。
- [ ] 執行 `npm --prefix worktrees/stats-multi-tag-filter run build`，預期成功且沒有 TypeScript 錯誤。

### Task 4：更新行為文件並完成驗證

**Files:**

- Modify during cleanup: `README.md`
- Move during cleanup: `docs/todo-references/stats-multi-tag-filter.md`
- Modify during cleanup: `TODO.md`
- Modify during cleanup: `CHANGELOG.md`

- [ ] 在 `README.md` §6.6 記錄多選與 AND 規則。
- [ ] 執行 `npm --prefix worktrees/stats-multi-tag-filter run docs:check`，預期 `docs-check: OK`。
- [ ] 等使用者執行 `/start-local-server` 後，在 iPhone 寬度驗證單選、多選、取消單一 tag、「全部」清除與無結果狀態。
- [ ] 驗證月份與年份切換、支付方式、排除子類別可與多選 tag 同時作用。
- [ ] 使用範例交易 `Ipass`、`永豐`、`Ipass 永豐`，確認同選兩個 tag 時只留下第三筆。
- [ ] 使用者驗收後再執行 `/git-branch-cleanup`，由該流程更新完成紀錄、commit、合併並移除 worktree。

## 測試計劃

- 自動檢查：`npm run build`、`npm run docs:check`。
- 手動檢查：0、1、2 個以上 tag 的選取與取消；AND 精確比對；期間切換後失效 tag 的清理；與支付方式及子類別排除條件疊加。
- 專案目前沒有測試框架，本項目不額外導入 runner；純函式案例以明確 fixture 進行瀏覽器驗證。

## 假設

- 多選狀態只存在於本次統計頁 mount，不寫入 `localStorage` 或 Dexie。
- 「全部」代表未套用 tag 條件，不是將目前期間所有 tag 全部選取。
- 實作期間不 commit；使用者完成瀏覽器驗收後，由 `/git-branch-cleanup` 產生單一完整 commit。
