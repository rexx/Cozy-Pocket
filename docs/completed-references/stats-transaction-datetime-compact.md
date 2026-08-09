# 統計頁交易日期縮短完成紀錄

**成果：** 統計頁交易明細只顯示月日，把更多橫向空間留給交易名稱；完整日期時間保留為輔助資訊。

**架構：** `TransactionItem` 具備 opt-in 的 compact 日期顯示模式，預設維持完整格式。只有 `MonthlyStatsPage` 的四個展開明細呼叫點啟用 `MM-dd`；完整日期時間透過 title 與 aria-label 提供。

**技術棧：** React 19、TypeScript strict、date-fns 4、Tailwind CSS v4。

---

## 摘要

- 統計頁展開交易明細原本顯示 `yyyy-MM-dd HH:mm`，固定占用標題列右側較寬空間。
- 可見格式改為 `MM-dd`，例如 `2026-07-11 09:30` 顯示為 `07-11`。
- 同步狀態、同步紀錄、Tag 管理與商家管理仍顯示 `yyyy-MM-dd HH:mm`；首頁等未傳入 `showDateTime` 的場景仍只顯示 `HH:mm`。
- 本項目只改呈現，未調整 timestamp、排序、資料模型或同步，屬於資料風險綠區。

## 關鍵變更

- `components/TransactionItem.tsx`
  - 日期物件只建立一次，再產生 compact 與完整兩種字串。
  - 新增 `dateTimeDisplayMode?: 'full' | 'compact'`，預設為 `full`；只有同時傳入 `showDateTime` 與 `compact` 時，可見文字才使用 `MM-dd`。
  - compact 模式的日期元素以 `title` 與 `aria-label` 保留 `yyyy-MM-dd HH:mm`，讓可見文字移除年份與時間後仍能取得完整資訊。
  - 日期元素加上 `whitespace-nowrap`，保留既有 `tabular-nums`。
  - icon、tag chip、金額、同步狀態點與整列 padding 均未更動。
- `components/MonthlyStatsPage.tsx`
  - 四個展開明細路徑同時傳入 `showDateTime` 與 `dateTimeDisplayMode="compact"`。
  - 同步狀態、同步紀錄、Tag 管理與商家管理未傳入新 prop，因此維持完整格式。

## 介面與型別

- `TransactionItemProps.showDateTime?: boolean` 維持不變；新增的是受限 union prop，呼叫端無法任意傳入 date-fns format string。

```ts
type DateTimeDisplayMode = 'full' | 'compact';

interface TransactionItemProps {
  showDateTime?: boolean;
  dateTimeDisplayMode?: DateTimeDisplayMode;
}

const transactionDate = new Date(toEpochMillis(transaction.timestamp));
const fullDateTime = format(transactionDate, 'yyyy-MM-dd HH:mm');
const isCompactDate = showDateTime && dateTimeDisplayMode === 'compact';
const formattedTime = isCompactDate
  ? format(transactionDate, 'MM-dd')
  : showDateTime ? fullDateTime : format(transactionDate, 'HH:mm');
```

- `dateTimeDisplayMode` 未傳入時為 `full`，既有 `showDateTime` 呼叫端無須修改且行為不變。
- 只有 compact 模式會輸出完整日期的 title 與 aria-label；full 與 time-only 模式維持原本語意，不帶這兩個屬性。

## UI 細節

- 可見日期固定使用兩位數月日與連字號，例如 `07-11`，同一列表寬度不會跳動。
- 日期元素保留 `tabular-nums` 與不換行行為；移除年份與時間後釋出的空間由左側 flex title 區取得。
- 未加入 `viewport-fit=cover`、`env(safe-area-inset-*)` 或新的 fixed 定位。
- 第二列的 tag chip 排版未更動；釋出的空間全數歸標題 `h3`，第二列可用寬度不變。

## 驗證

- 自動檢查：`npm run build`（tsc strict + Vite production build）綠燈、`npm run docs:check` 回 `docs-check: OK`。
- 瀏覽器驗收：cmux WKWebView，viewport 393×852（iPhone 邏輯解析度），以 DOM 斷言判定而非目視。
  - 四個統計展開路徑（支出總額、類別、商家、收入總額）可見文字皆為 `MM-dd`，`title` 與 `aria-label` 皆帶完整 `yyyy-MM-dd HH:mm`。
  - 同一列標題可用寬度由 62px 增為 128px（+66px），長標題從約 4 個字增為約 10 個字。
  - 首頁維持 `HH:mm`；同步狀態頁、同步紀錄、Tag 管理、商家管理維持 `yyyy-MM-dd HH:mm` 且不帶 title / aria-label。
  - 2098-06-15 的交易在統計頁顯示 `06-15`，年份僅由期間標題與 title 提供，符合設計取捨。
  - `cmux browser errors list` 回報 `No browser errors`。
- 主要驗收裝置為 iPhone standalone PWA；桌面與 cmux 只作輔助。

## 設計取捨

- compact 格式固定為 `MM-dd`，不依月份或年份模式切換格式。
- 統計頁期間標題已提供年份脈絡，交易時間對此列表的辨識重要性較低；完整日期時間保留在 title 與 aria-label。同一份明細內無法用可見文字分辨不同年份，這是刻意的取捨。
- `dateTimeDisplayMode` 未傳入時固定使用 `full`，維持所有既有 `showDateTime` 呼叫端行為。
