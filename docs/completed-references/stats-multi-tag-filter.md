# 統計頁多選 Tag 篩選

**目標：** 讓統計頁可同時選取多個 tag，只有包含全部已選 tag 的交易才會納入統計。

**架構：** 統計頁的單一 tag state 改為 tag 陣列，AND 比對集中在 `statsService` 的純函式。期間、支付方式與排除子類別沿用同一條 `filteredTransactions` 管線，所有總額、彙整與明細共用結果。

**技術棧：** React 19、TypeScript strict、date-fns 4、Tailwind CSS v4。

---

## 摘要

- Tag chip 為可獨立切換的多選控制；「全部」會清空已選 tag。
- 多選採 AND 規則。選取 `Ipass` 與 `永豐` 時，交易必須同時具有兩個完整 tag token 才會保留。
- tag 比對維持大小寫敏感、精確 token 比對，不做模糊搜尋或部分字串比對。
- 本項目只改讀取與呈現，不寫入交易、IndexedDB 或同步 payload，屬於資料風險綠區。

## 關鍵變更

- `components/MonthlyStatsPage.tsx`
  - `selectedTag: string` 改為 `selectedTags: string[]`。
  - 新增單一 tag 的 `toggleTag` handler 與 `clearSelectedTags`；再次點擊已選 tag 會取消該 tag。
  - 切換月份或年份後，只移除新期間不存在的已選 tag，仍有效的選項保留；沒有變動時回傳原陣列，維持 state identity 穩定。
  - `hasActiveFilters`、展開區塊重置條件與 active filter badge 改用 `selectedTags`。
  - 一個 tag 時顯示 `#tag`；多個 tag 時顯示「N 個 tag」，避免手機寬度下 badge 過長。
  - chip 保留 `type="button"`，並以 `aria-pressed` 表達多選狀態。
- `services/statsService.ts`
  - `filterTransactionsByTag` 擴充為 `filterTransactionsByTags`。
  - 每筆交易先建立 tag token set，再用 `selectedTags.every(...)` 實作 AND 比對。

## 介面與型別

- 未變更 `Transaction`、`MonthlyStatsPageProps` 或 IndexedDB schema。
- 新 helper 介面：

```ts
export const filterTransactionsByTags = (transactions: Transaction[], tags: string[]) => {
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

- Tag 列沿用既有橫向捲動 chip 版面，沒有新增第二層面板。
- 「全部」只在 `selectedTags.length === 0` 時呈現選取樣式。
- 已選 tag 沿用 cyan 選取樣式，未選 tag 沿用灰色樣式。
- 篩選沒有結果時沿用既有空狀態，沒有新增獨立 dialog 或 toast。

## 驗證

- 自動檢查：`npm run build`（tsc strict + Vite production build）、`npm run docs:check`，兩者皆通過。
- cmux 瀏覽器驗證（390×844 viewport，dev server 跑在未使用過的 port，IndexedDB 無同步憑證）：
  - 以 `Ipass`、`永豐`、`Ipass 永豐`、`Ipass永豐` 四筆 fixture 加上既有資料驗證金額總和：只選 `Ipass` 得 706、同時選 `Ipass` 與 `永豐` 得 606，證實 AND 規則成立且 `Ipass` 不會命中 `Ipass永豐`。
  - 展開支出明細只列出同時具備兩個 tag 的 4 筆交易。
  - 取消其中一個 tag 後回到單選結果，徽章從「2 個 tag」變回 `#永豐`；「全部」一次清空並回到全月總額。
  - 期間切換：八月選兩個 tag 後切到七月（只有 `Ipass` 的期間），`永豐` 被移除、`Ipass` 保留；切回八月仍保留 `Ipass`。
  - 年份模式與支付方式篩選可與多選 tag 疊加，徽章顯示「2 個 tag · 電子支付」。
  - 選取三個沒有交集的 tag 時進入既有空狀態，`errors list` 無錯誤。
- 專案沒有測試框架，本項目未額外導入 runner；純函式案例以明確 fixture 進行瀏覽器驗證。

## 假設

- 多選狀態只存在於統計頁 mount 期間，不寫入 `localStorage` 或 Dexie。
- 「全部」代表未套用 tag 條件，不是將目前期間所有 tag 全部選取。
