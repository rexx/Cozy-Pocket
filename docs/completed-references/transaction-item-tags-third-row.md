# 交易列表 Tag 移到第三行

**目標：** 交易列表的 tag chip 從第二行移到專屬的第三行並允許換行，讓 tag 在窄容器下也能完整顯示，不再被截成 `#LINEP…`、`#元…`。

**架構：** 只調整 `TransactionItem` 的版面，沒有新增 prop、沒有改資料模型、沒有動任何呼叫端。第一行「標題＋同步點與時間」不變；第二行回到「副標題＋支付方式與金額」；有 tag 時才渲染第三行的 `flex-wrap` chip 群組。

**技術棧：** React 19、TypeScript strict、Tailwind CSS v4。

---

## 摘要

- 統計頁明細的內容寬只有約 165～186px，第二行扣掉支付方式與金額後只剩約 80px 給副標題與 tag，兩個 tag 就被截斷到無法辨識。
- 評估過的其他方向：統計頁隱藏篩選中的 tag（交易帶有篩選外 tag 時，畫面與資料不一致）、`+N` 收合、統計頁精簡排版、金額與日期換位。最後選擇第三行，因為它是唯一能在任何 tag 數量下都讓 tag 完整可讀的做法。
- 只改呈現，屬於資料風險綠區。

## 實際變更

- `components/TransactionItem.tsx`
  - 第二行：移除 tag 群組，副標題 `<p>`（`min-w-0 truncate`）成為左側唯一的可收縮元素，右側支付方式與金額不變。
  - 第三行：`tags.length > 0` 時渲染 `mt-1.5 flex flex-wrap gap-1` 容器；chip 樣式沿用 `text-[10px]`、`bg-white/5`、`border-white/5`、`#` 前綴。
  - 單一 chip 保留 `max-w-full truncate`，只在單一 tag 比整行還寬時截斷。

## 介面與型別

- `TransactionItemProps` 不變，所有共用 `TransactionItem` 的頁面（首頁、搜尋、統計、同步狀態、Pull 報告、Tag 管理、商家管理）自動取得新版面。

## UI 細節

- 有 tag 的列比沒有 tag 的列高：無 tag 83px、一行 tag 約 110px、換成兩行約 135px。這取代了 [transaction-item-tags-second-row.md](transaction-item-tags-second-row.md)「有無 tag 列高一致」的做法。
- 左側 icon 維持 `items-center` 垂直置中。
- 沒有新增 `viewport-fit=cover`、`env(safe-area-inset-*)` 或 fixed 定位。

## 驗證

- `npm run build`（tsc strict + Vite production build）、`npm run docs:check` 皆通過。
- 在 Claude 桌面 app 的 Browser pane 以 375px mobile viewport、新 port（無同步設定）寫入 5 筆測試交易，以 `getBoundingClientRect` 與 `scrollWidth` vs `clientWidth` 做幾何斷言。統計頁展開明細的內容寬為 165px：
  - 無 tag：不渲染第三行，列高 83px。
  - `#LINEPAY #元大`：兩個 chip 完整、單行。
  - 5 個 tag：換成兩行，全部完整，無溢出內容框。
  - 單一超長 tag：chip 自己 truncate，未溢出內容框。
- 首頁同一組資料目視正常；console 無錯誤。

## 已知取捨

- 列表長度隨 tag 數量變長，列高不再一致。
- 本次取代了 [transaction-item-tags-second-row.md](transaction-item-tags-second-row.md) 的「tag 接在第二行副標題之後」做法；該紀錄維持不可變快照。
