# Tag 建議 recency 排序排除未來日期交易

## 摘要

- Tag 建議以最後出現時間（`lastUsedAt`）為主排序（見 [tag-suggestion-recency-sort.md](tag-suggestion-recency-sort.md)），但 `lastUsedAt` 原本取「該值所有交易 `timestamp` 的最大值」，會把記到未來日期的交易也算進「最近使用」。
- 結果：只在未來用過、或同時有過去與未來日期的 tag 會被未來日期推到最前，不符合「最近使用」語意。
- 已改為計算 `lastUsedAt` 時只取「不晚於現在」的交易最大 `timestamp`。

## 最終行為

- `App.tsx` 的 `buildSuggestions()` 新增 `now: number` 參數；累加 `lastUsedAt` 時，`toEpochSeconds(tx.timestamp) > now` 的交易以 `0` 取代，不參與 `Math.max`。
- `buildSuggestionIndex()` 擷取一次 `const now = toEpochSeconds(Date.now())`，傳入 merchants / names / tags 三組建議，共用同一基準時間。
- 單位一致性是關鍵：`Transaction.timestamp` 儲存為 epoch 秒（存檔時 `toEpochSeconds`），`Date.now()` 為毫秒，比較前兩端都經 `toEpochSeconds` 正規化，否則秒 vs 毫秒會讓未來判斷永遠成立、修正失效。
- 全部交易都在未來的值，`lastUsedAt` 為 `0`，於 recency 排序自然落到最後；該值仍保留在建議清單（`count` 不變）。
- `count` 定義不變：未來交易仍計入使用次數，僅 recency 用的 `lastUsedAt` 排除未來。
- `AddTransactionModal.tsx` 排序邏輯未動，recency 仍直接讀 `lastUsedAt`，語意由資料源頭修正後一致。

## 行為範例（今天 6/14）

- `#a` 最後一次 6/12、`#b` 6/10、`#c` 用於 6/1 / 7/1 / 8/1。
- 修正前：`#c` 因 8/1 排最前 → `#c > #a > #b`。
- 修正後：`#c` 視為 6/1 → `#a > #b > #c`。

## 驗證

- `npm run build`（tsc strict + Vite production build）通過。
- 以 cmux browser 對 dev server 實機驗證：直接寫入 5 筆測試交易到 IndexedDB（`#a` 6/12、`#b` 6/10、`#c` 6/1 + 7/1 + 8/1，系統日期 2026-06-14），重載後開啟新增交易 modal：
  - tag 建議 chips 順序為 `#a → #b → #c`（修正前未來日期會讓 `#c` 排到最前）。
  - console 無錯誤；驗證後以精確 id 刪除測試資料還原。

## 假設

- 「未來」定義為 `timestamp` 嚴格晚於 index 建立當下的 `Date.now()`；`buildSuggestionIndex` 為 `transactions` 的 `useMemo`，交易變動時重算，跨日基準時間漂移影響極小。
- 「最後使用時間」沿用 suggestion index 既有的 `lastUsedAt`（交易 `timestamp`），不另外記錄 tag 被點選的時間。
