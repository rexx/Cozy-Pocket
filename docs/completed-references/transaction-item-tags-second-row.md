# 交易列表 Tag 移到第二行

**目標：** 交易列表的 tag chip 從第一行（標題列）移到第二行（副標題列），讓通常較長的標題取回整行寬度，也讓通常較空的第二行承接 tag。

**架構：** 只調整 `TransactionItem` 的兩層 flex 版面歸屬，沒有新增 prop、沒有改資料模型、沒有動任何呼叫端。第一行是「標題全寬 truncate＋右側同步點與時間」；第二行是「副標題 truncate＋tag chips＋右側支付方式與金額」。

**技術棧：** React 19、TypeScript strict、Tailwind CSS v4。

---

## 摘要

- Tag chip 原本與標題同一行，標題被 `max-w-[65%]` 壓縮，tag 仍常被 `truncate` 切掉，兩者互相擠壓。
- 現在標題獨占第一行、tag 接在副標題之後，例如第二行顯示 `全聯 · 早餐 · 招...  #Ipass #永豐`。
- 空間不足時優先犧牲副標題（副標題先 truncate），tag 儘量完整顯示；tag 本身保留 truncate 作為最後防線。
- 只改呈現，沒有調整 tag 字串解析、排序、資料模型或同步，屬於資料風險綠區。

## 實際變更

- `components/TransactionItem.tsx`
  - 第一行：移除包住標題與 tag 的 flex 容器，`<h3>` 直接成為 flex 子元素並帶 `min-w-0 truncate`，取回整行寬度；右側同步狀態點與時間不變。
  - 第二行：左側改為 `flex min-w-0 items-center gap-2` 容器，依序放入副標題與 tag chip 群組；右側支付方式與金額區塊維持 `flex-shrink-0`，並補上 `ml-4`。
  - tag chip 的視覺樣式（`text-[10px]`、`bg-white/5`、`border-white/5`、`#` 前綴）完全沿用，只換位置。
  - 副標題為空（`subtitleParts` 長度為 0）時不渲染 `<p>`，第二行左側不會出現多餘的 gap。
  - `tags.length === 0` 時第二行結構與改動前一致，副標題取得整個左側寬度。

## 介面與型別

- `TransactionItemProps` 不變：沒有新增 prop、沒有新增 union、呼叫端零修改。
- 所有共用 `TransactionItem` 的頁面（`HomePage`、`MonthlyStatsPage`、`SearchPage`、`SyncStatusPage`、`PullReportsPage`、`TagManagementSection`、`MerchantManagementSection`）自動取得新版面。
- `tags` 的推導邏輯（`transaction.tags.split(/\s+/)`）不變。

## UI 細節

- 第二行左側容器使用 `flex min-w-0 items-center gap-2`；副標題 `<p>` 帶 `truncate` 且允許收縮，tag 群組使用 `flex min-w-0 max-w-full flex-shrink-0 items-center gap-1`。
- 副標題原本的 `pr-4` 由容器層的 `gap-2` 與右側區塊的 `ml-4` 取代，避免 tag 與副標題之間出現雙重間距。
- tag 群組的 `flex-shrink-0` 確保空間不足時是副標題先被切；`max-w-full` 則把群組寬度上限綁在整行寬度，讓單一超長 tag 由 chip 自己 truncate，而不是溢出去壓到金額。
- 沒有新增第三行、沒有改整列 `py-4 px-5` padding，也沒有改 icon 尺寸，有 tag 與無 tag 的列高一致（83px，第二行 28px）。
- 沒有加入 `viewport-fit=cover`、`env(safe-area-inset-*)` 或新的 fixed 定位。

## 驗證

- 自動檢查：`npm run build`（tsc strict + Vite production build）、`npm run docs:check` 皆通過。
- 版面驗證在 cmux WKWebView 進行，以 `#root` 固定 390px 模擬 iPhone 寬度，用 `getBoundingClientRect` 與 `scrollWidth` vs `clientWidth` 做幾何斷言，不依賴目視：
  - 長標題無 tag：標題 227px（整行減時間欄）truncate。
  - 長標題多 tag：標題同樣 227px，3 個 chip 完整，副標題壓到 14px 先 truncate。
  - 短標題多 tag：標題、副標題、3 個 chip 全部完整。
  - 無副標題有 tag：不渲染 `<p>`，chip 從內容左緣起，無多餘 gap。
  - 長副標題有 tag：副標題 truncate，2 個 chip 完整。
  - 單一超長 tag：副標題壓到 0，chip 自己 truncate，右緣未達金額左緣。
  - 所有列的標題未壓到時間、左側未壓到金額、第二行未溢出內容框。
- 入口覆蓋：首頁、搜尋、統計頁展開明細、同步狀態、Pull 報告（以本機合成報告驗證 Before/After）、Tag 管理、商家管理。
- 新舊版 A/B：舊版在統計頁明細那種 186px 窄容器裡，第一行的 tag 群組會與時間戳重疊、chip 被壓到只剩一個 `#`；新版在同一位置不重疊，chip 保有可辨識片段。

## 已知取捨

- 第二行排列順序固定為「副標題在前、tag 在後」，不依副標題長度動態換序。
- 標題是列表最重要的辨識資訊，因此優先取回整行寬度；副標題被壓到只剩一兩個字時視覺偏怪，屬於已接受的取捨。
- 超量 tag 允許被切掉，沒有引入 `+N` 折疊或多行換行。
- 統計頁明細、Tag 管理、商家管理三處的列表內容寬只有約 186px，chip 仍會各自截斷。這是容器寬度本身的限制，TODO 的「統計頁交易明細只顯示 `MM-dd`」會直接緩解。
- 本次取代了 [transaction-item-inline-tags.md](transaction-item-inline-tags.md) 的「tag 放在標題右側、標題設 `max-w-[65%]`」做法；該紀錄維持不可變快照，不回頭修改。
