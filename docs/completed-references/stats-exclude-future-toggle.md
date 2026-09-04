# 統計頁排除未來交易選項完成紀錄

統計頁篩選面板底部加入「排除未來交易」switch，預設開啟，讓統計結果只涵蓋已經發生的交易。記到未來日期的預定支出（例如先登錄的下個月房租）不再灌進本月總額，使用者要看含未來的全貌時再自行關閉。

排除發生在期間篩選之後、tag／支付方式／類別篩選之前，因此可選的篩選選項清單、幣別總額、類別彙整、商家彙整、展開明細與趨勢圖全部吃同一份資料，不會出現某一區塊算進未來交易、另一區塊沒算的情況。

實作只做唯讀的統計計算，不寫入 `transactions`、不碰同步 payload，屬於資料風險綠區。

---

## 最終行為

- switch 位於篩選面板最下方的 `時間範圍` 區，接在 `TAG`、`支付方式`、`類別` 三列 chip 之後，預設開啟。
- 開啟時排除 `timestamp` 嚴格晚於當下的交易；剛好等於當下的交易仍保留。
- 比較前兩邊都先轉成 epoch 秒，不直接拿毫秒值與 `Transaction.timestamp` 比對。
- 關閉顯示「包含未來交易」，開啟顯示「已排除未來交易」；使用 `role="switch"` 與 `aria-checked`，整列可點。
- 月份、年份與趨勢三種期間範圍都套用，切換分頁不重置選項。
- 選項只存在於這次進入統計頁的期間，不寫入 `localStorage` 或 Dexie；離開統計頁再回來回到預設的開啟狀態。這與已排除子類別不同，後者是持久化設定。
- 篩選徽章只在這個選項真的擋掉東西時才加上「排除未來」。徽章組成順序為 tag、支付方式、類別、排除未來、已排除子類別，與面板由上而下的順序相同。

## 實作內容

- `services/statsService.ts`
  - 新增 `filterTransactionsThroughTimestamp(transactions, maxTimestamp)`，兩邊都以 `toEpochSeconds()` 正規化後做 `<=` 比較。
  - cutoff 由呼叫端傳入，helper 本身不呼叫 `Date.now()`。這讓同一次 render 的每個區塊都對同一個瞬間比較；helper 自己取時間會讓篩選選項與由它衍生的總額對到不同的秒數。
- `components/MonthlyStatsPage.tsx`
  - `excludeFutureTransactions: boolean` state，預設 `true`。
  - `periodTransactions` 之後新增 `eligiblePeriodTransactions` memo，開啟時取一次 `toEpochSeconds(Date.now())` 當上限。
  - `periodTags`、`periodPaymentMethods`、`periodCategoryIds` 與 `filteredTransactions` 全部改從 `eligiblePeriodTransactions` 衍生。
  - `hiddenFutureCount` 為兩份清單的長度差，供徽章與 `hasActiveFilters` 判斷用。
  - 展開區塊 reset 的 dependency 納入這個選項。
  - 面板新增的 switch 沿用既有的 cyan 選中色階與 `white/5` 表面，未引入新色階。

`getMonthTransactions()` 與 `getYearTransactions()` 沒有變動，避免改變其他呼叫端的期間語意。

## 徽章為什麼要看 `hiddenFutureCount` 而不是選項本身

選項預設開啟。若「開啟」就直接計入 `hasActiveFilters`，沒有任何未來交易的使用者會永遠看到篩選按鈕呈套用中狀態、徽章永遠寫著「排除未來」，這個訊號就失去意義。改成只在實際擋掉東西時才顯示，徽章維持「這頁的數字不是期間全貌」的告警語意。

## 現在時間的更新時機

頁面不建立計時器。cutoff 在交易、期間或選項變動導致 memo 重算時才更新，因此長時間停在統計頁不動時，跨過某筆未來交易的時間點不會即時反映。以個人記帳的使用情境，這個延遲不影響判讀，換取的是不必為了秒級精度養一個 interval。
