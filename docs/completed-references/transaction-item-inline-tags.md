# 交易列表項目 Tag 移至主要文字右側完成紀錄

## 摘要

- `TransactionItem` 的 tag 原本以 `#tag` 形式附加在次要文字（subtitle）尾端，與名稱、商家、子類別、備註串成一行；次要文字一長，tag 就被 truncate 吃掉看不到。
- 現在 tag 以小型 pill 顯示在交易名稱（主要文字）右邊，不再跟次要文字搶空間。
- 主要文字太長時會截斷並保留空間給 tag；沒有 tag 的交易完全不保留空間，標題照舊吃滿整行。

## 最終行為

- `components/TransactionItem.tsx`：tag 由 `transaction.tags` 以空白切割推導為獨立陣列，不再加入 `subtitleParts`。
- 主要文字列中，標題與 tag pills 包在同一個 `flex flex-1 min-w-0` 容器（位於同步狀態圓點／時間左側）。`flex-1` 讓百分比上限對完整列寬解析，避免對 content-sized 盒子取百分比造成的循環取值（第一版用 `max-w-[45%]` 掛在 tag 區塊上，實測 tag 被壓到只剩 `#.`，因此改為現行做法）。
- **有 tag 時**：標題設 `flex-shrink-0 max-w-[65%]`——標題過長才截斷，保證 tag 至少有約 35% 的空間；tag 區塊本身不設上限，可使用所有剩餘空間，只有整列真的塞不下時才逐個 pill 截斷。
- **沒有 tag 時**：tag 區塊不渲染任何節點，標題不設上限，行為與改動前相同。
- Pill 樣式沿用付款方式 text pill 的語彙（`text-[10px]`、`bg-white/5`、`border-white/5`、圓角），文字為 `#tag`；多個 tag 依序渲染多個 pill。
- 此調整一致套用到所有共用 `TransactionItem` 的場景（首頁、搜尋頁、統計頁展開明細、同步狀態頁）。

## 介面與型別

- `Transaction` 資料模型與 `TransactionItemProps` 均未變更；為純呈現層調整。

## 驗證

- `npm run build`（tsc strict + Vite production build）通過。
- 以 cmux 瀏覽器對 dev server 執行互動驗證（以 `getBoundingClientRect` 斷言 tag 區塊位於標題右側、以 `scrollWidth > clientWidth` 判斷截斷狀態）：
  - 無 tag：標題吃滿整行，右側無 tag 節點。
  - 短標題 + 單一 tag：pill 緊跟標題右邊完整顯示。
  - 短標題 + 超長 tag：pill 使用剩餘空間完整顯示，不被不必要地壓窄。
  - 長標題 + 1 tag：標題在 65% 上限截斷，tag 完整可見。
  - 長標題 + 3 tags：標題截斷，pills 在剩餘空間內各自截斷，不會把標題擠光。
  - 短標題 + 超長備註 + tag：次要文字自行截斷，tag 不受影響。
  - 搜尋頁與同步狀態頁的項目排版與首頁一致；console 全程無錯誤。

## 既知取捨

- 長標題 + 多個（或超長）tag 時，pills 會在剩餘約 35% 寬度內各自截斷成極窄的 `#字…`；視為可接受，未另設 pill 最小寬度。
- tag pill 不可點擊，僅為顯示；點擊行為仍由整列項目承載。
