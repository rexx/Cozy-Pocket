# 統計頁展開內容的歸屬感（依類別／依商家彙整）

## 摘要

統計頁「依類別彙整」展開一個類別後，子類別卡與交易明細是類別按鈕的兄弟節點，`mt-2` 外距、圓角與寬度都與同層的其他類別卡一致，因此看不出這些框框掛在被展開的類別（例如「購物」）之下，讀起來像是與「飲食」「交通」平行的另一批卡片。

現在展開內容與父列接成一張連續卡片：父列在展開時去掉下緣圓角與下邊框，展開面板沿用同一組選中色邊框並去掉上緣圓角，兩者左緣與寬度對齊且沒有間距；面板內再以低對比小標區分「子類別」與「交易明細」兩段。「依商家彙整」結構相同，套用了同一處理以維持一致性。

## 關鍵變更

- `components/MonthlyStatsPage.tsx`
  - 兩個彙整區塊的父列展開態加上 `rounded-b-none border-b-0`。
  - `renderMerchantStatsGroup`：交易列表包進 `rounded-t-none border-t-0` 的相接容器。
  - `renderCategoryStatsGroup`：同樣的相接容器，內部加入「<類別名>的子類別」與「<類別名>的交易明細」兩個小標。

## 介面與型別

無變更。純呈現層調整，未動 props、型別與 `statsService`。

## UI 細節

- 父列展開態沿用既有的 `border-cyan-300/25` / `bg-cyan-500/10`，展開面板用更淡的 `bg-cyan-500/[0.06]`，父列仍是視覺重心。
- 小標沿用頁面既有的裝飾字樣式（`text-[10px] font-black uppercase tracking-[0.3em] text-gray-500`）與鄰近色階，沒有為了可讀性拉高對比。
- 面板內距為 `p-2.5`，交易列可用寬度只縮減約 22px，沒有造成橫向溢出。
- section 層級（`activeSectionKey`）的收入／支出明細展開未變動。

## 驗證

- `npm run build` 通過（tsc strict + Vite production build）。
- cmux（390×844 viewport、範例資料）量測展開中的「飲食」類別：父列與面板 `gap` 為 0、左緣與寬度相同、接縫處圓角與邊框寬度皆為 0，邊框色相同；收合後父列回復 16px 圓角與 1px 下邊框。
- cmux 量測交易列 `scrollWidth === clientWidth`，`p-2.5` 沒造成橫向溢出。
- cmux 量測展開中的「王品牛排」商家列，接縫結果與類別一致。
- 使用者在瀏覽器與 iPhone standalone PWA 上確認實機觀感。
