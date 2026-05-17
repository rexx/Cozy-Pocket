# 刪除範例資料按鈕

## 摘要

- 「資料與設定 → 危險操作」新增「刪除範例資料」按鈕，可移除由「插入範例資料」入口建立的交易，方便 demo 或測試結束後快速清理。
- 刪除範圍以範例資料專用 id prefix 為準，避免用商家、金額、名稱等相似度誤刪使用者自行建立的紀錄。
- 第一版只處理本機資料刪除，沒有處理雲端已同步資料的刪除（與既有 transaction delete 行為一致，目前 GAS 端尚無 delete / tombstone 規格）。

## 最終行為

- `App.tsx` 以 `sample-tx-` 作為範例資料 id prefix（`SAMPLE_TRANSACTION_ID_PREFIX`）；`buildExampleTransactions()` 產生的交易 id 形如 `sample-tx-${now}-${idx}-${random}`。
- `previewSampleTransactions()` 從 IndexedDB 撈出所有 id 以 `sample-tx-` 開頭的交易；`deleteSampleTransactions(ids)` 再次以 prefix 過濾後執行 `db.transactions.bulkDelete()`，並同步更新 React state，回傳實際刪除筆數。
- `SettingsPage` 的 `deleteExamples()` flow：先預覽 → 沒有可刪資料時透過 toast 顯示「目前沒有範例資料可刪除」→ 透過 `confirmAction({ html, tone: 'danger' })` 顯示完整預覽（日期 · 商家／名稱 · 金額，已加 `escapeHtml` 防注入）以及「只會刪除具有 `sample-tx-` prefix 的交易」提示文字 → 確認後刪除，最後 toast 報告實際刪除筆數。
- `DangerZoneSection` 與「插入範例資料」共用同一張「Sample Data」卡牌：說明文字統一在卡牌上方，下方並排顯示「插入範例資料」（cyan）與「刪除範例資料」（red），窄畫面自動堆疊。

## 介面與型別

- `SettingsPageProps` 與 `DangerZoneSectionProps` 新增：
  - `onPreviewDeleteExamples: () => Promise<Transaction[]>`
  - `onDeleteExamples: (ids: string[]) => Promise<number>`
- 沒有新增 `Transaction` 欄位或 settings key，避免觸發 IndexedDB schema migration；範例資料純以 id prefix 區分。

## 驗證

- `npm run build`（tsc strict + vite）通過。
- 插入範例資料後，IndexedDB 中新交易 id 皆使用 `sample-tx-` prefix；按「刪除範例資料」確認預覽列出全部範例交易，刪除後相關紀錄消失、toast 顯示實際筆數。
- 重複插入多次後按一次刪除，所有 prefix 符合的範例交易都被移除。
- 手動先刪掉其中一筆範例交易後再按「刪除範例資料」，流程不報錯且 toast 報告實際刪除筆數。
- 沒有 prefix 符合項目時按「刪除範例資料」，跳過確認直接以 toast 提示「目前沒有範例資料可刪除」，不影響一般交易。

## 已知限制

- 舊版本曾插入但沒有 `sample-tx-` prefix 的範例資料不會被自動辨識或刪除，避免誤刪真實交易；如需清理請改用「清除本機資料並重置」。
- 範例資料若已同步到雲端（Google Sheet），本入口不會從雲端移除，與現行 transaction delete 行為一致。
