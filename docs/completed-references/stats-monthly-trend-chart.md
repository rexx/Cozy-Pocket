# 統計頁月趨勢圖

## 摘要

統計頁新增「趨勢」分頁，以近 12 個月滾動視窗的堆疊長條圖呈現每月收支組成，並可依類別篩選。

原本的統計頁一次只看一個期間（月或年）的加總與明細，要比較「這個月的飲食比上個月多嗎」只能左右切換月份、憑記憶比對數字。趨勢圖把 12 個月攤在同一張圖上，讓週期性支出（年繳保費、過年紅包、雙 11 購物）和異常月份直接被看見。

沒有引入任何圖表套件。專案的 bundle 待辦已有一整段在瘦身，為一張長條圖再加一個 runtime dependency 不划算，圖表以手刻 SVG 實作。

## 呈現方式的選擇

實作前先做了一份可切換三案的 HTML prototype 供比較，最後採用 C 案。

| 案 | 呈現 | 取捨 |
|---|---|---|
| A | 單一顏色長條，單選類別 | 手機上最好讀，但一次只能看一個類別 |
| B | 多條折線疊加，多選類別 | 可比較類別間走勢，窄螢幕上線條容易糊在一起 |
| **C** | **堆疊長條，多選類別** | **看得出組成比例，單一類別走勢需靠色塊高度目測** |

C 案的代價（單一類別走勢不易目測）由後來補上的「取消全選」按鈕補償：兩下即可隔離出單一類別，此時圖形退化為單色長條，等同 A 案。

## 關鍵變更

| 檔案 | 變更 |
|---|---|
| `services/statsService.ts` | 新增 `getMonthlyTrend()` 與 `getTrendWindowTransactions()`，把交易依「月 × 類別」聚合成連續 12 個月的序列。純讀取計算，綠區。 |
| `components/stats/MonthlyTrendChart.tsx` | 新元件。SVG 繪製、月份摘要、三格數字卡與類別 chip 都在這裡，自行持有收支類型、隱藏類別與聚焦月份三個 local state。 |
| `components/MonthlyStatsPage.tsx` | 新增 `viewMode: 'summary' \| 'trend'` state 與分頁切換 UI；`periodTransactions` 依分頁決定取單一期間或 12 個月視窗，讓既有篩選自然套用到兩個分頁。 |

`MonthlyStatsPage.tsx` 已超過 1000 行，繪製邏輯全部放在新元件裡，頁面只負責分頁切換與把已篩選的交易傳下去。

## 介面與型別

```ts
// services/statsService.ts
export interface MonthlyTrendCategoryPoint {
  categoryId: string;
  total: number;
  count: number;
}

export interface MonthlyTrendBucket {
  year: number;
  month: number; // 0-indexed, matching Date
  total: number;
  categories: MonthlyTrendCategoryPoint[];
}

export const getMonthlyTrend = (
  transactions: Transaction[],
  options: {
    endDate: Date;
    monthCount: number;
    currency: string;
    type: TransactionType;
  }
): MonthlyTrendBucket[];
```

回傳的 bucket 數量恆等於 `monthCount`。沒有交易的月份回傳 `total: 0` 與空的 `categories`，不跳過——跳過會讓橫軸間距失真，把「那個月沒花錢」畫成「那個月不存在」。視窗邊界沿用 `time.ts` 的 epoch 秒慣例計算。

## 最終行為

完整的行為規格在 README §6.14，以下只記錄幾個非顯而易見的決定：

**堆疊順序全圖共用。** 順序取近 12 個月總額由大到小，總額大的疊在下面。若改成每個月各自排序，同一個顏色會在相鄰長條之間上下跳動，堆疊圖賴以閱讀的「同一色帶的厚度變化＝該類別的走勢」就不成立。

**收支分開畫。** 薪資與飲食的量級通常差一個數量級以上，共用 Y 軸會把支出壓成貼底的一條線，所以以 segmented control 切換而非同圖並陳。

**Y 軸進位到整數刻度。** 上緣進位到 1 / 1.5 / 2 / 2.5 / 3 / 4 / 5 / 7.5 / 10 乘以 10 的次方。初版用固定係數放大最大值，產生 `4,393`、`8,786` 這種刻度，讀一個標籤的成本高過它標註的長條。整條軸也統一單位，不在相鄰刻度間混用「萬」與千分位。

**月均虛線不標字。** 線上的文字標籤在手機寬度下會壓到長條，數值改由下方的月均卡片承接。

**三格數字卡拆成兩行。** iPhone 寬度下每格只有約 74px 文字空間，`11 月 · 1.6萬` 這種複合值必定截斷，因此金額當主值、月份放說明次行，金額也改用與 Y 軸相同的精簡格式且不帶幣別符號（卡片標題已標明幣別）。

**「全選／取消全選」依狀態出現。** 全部顯示時只有「取消全選」，全部取消時只有「全選」，部分顯示時兩個都在。這讓兩個動作在任何狀態下都只要一下，隔離單一類別從九下降為兩下。

**篩選 state 跨分頁共用，圖表自身 state 不共用。** tag、支付方式與已排除子類別由 `MonthlyStatsPage` 持有，切換分頁不重置；收支類型與隱藏類別由 `MonthlyTrendChart` 自己持有，切回總覽再切回來會重置。

## 驗證

專案沒有自動化測試，`tsc --strict` 加 Vite production build 是唯一自動關卡，兩者皆通過，`npm run docs:check` 亦通過。

cmux 自驗涵蓋：分頁切換不重置篩選、滾動視窗左右導覽與範圍說明字同步、支出／收入切換時 Y 軸重新縮放與類別 chip 換組、類別開關與全選／取消全選三種狀態、點長條切換月份摘要、空月份保留欄位並讀出 0、多幣別各自成圖、單一幣別無收入時的空狀態、年份模式下切到趨勢改為月步進，以及總覽與年份模式無回歸。全程 `errors list` 無錯誤。

驗證期間修掉四個問題：Y 軸非整數刻度、月均標籤壓到長條、月均出現小數、無資料時最高月顯示 `9 月 · 0`。

使用者在 iPhone 上完成實機驗收。過程中發現 Vite dev server 不打包、會把 1935 個模組拆成上千次 HTTP 來回，透過 Wi-Fi 傳到手機時看起來像永遠載不完；改以 `python3 -m http.server` 提供 production build 後正常。實機測試若需要跨網路存取，用 production build 而非 dev server。

## 假設

- 資料來源沿用 `App.tsx` 已載入的完整 `transactions` state，趨勢圖不另外查 IndexedDB。
- 12 個月是固定值，沒有做成偏好設定。
- 未來交易一併計入。統計頁的「排除未來交易」選項是獨立項目（[stats-exclude-future-toggle.md](stats-exclude-future-toggle.md)），該選項落地後趨勢圖可直接沿用同一個開關。
- 類別以主類別為單位，不下鑽子類別。子類別的排除設定照舊生效。
