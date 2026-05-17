# 統計排除子類別完成紀錄

## 摘要

- 統計頁可從「依類別彙整」展開後的子類別列直接排除指定子類別，例如「固定支出 / 房貸」，避免大額固定支出影響日常消費佔比。
- 排除條件套用在統計頁的所有結果上，包括幣別總額、依類別彙整、子類別摘要、收入／支出展開明細與交易列表；既有月份／年份、tag、支付方式篩選持續疊加生效。
- 排除清單以 `localStorage` 保存，下次回到統計頁仍會自動套用；切換期間／tag／支付方式時排除清單不會被清空。

## 已完成變更

- `preferences.ts` 新增 `STATS_EXCLUDED_SUBCATEGORY_KEYS_STORAGE_KEY = 'statsExcludedSubCategoryKeys'`，搭配 `buildSubCategoryExclusionKey`、`parseExcludedSubCategoryKeys`、`readExcludedSubCategoryKeys` 與 `writeExcludedSubCategoryKeys` helper；非 array、缺少 `:` 分隔符或 JSON 損毀皆 fallback 為空清單。
- `components/MonthlyStatsPage.tsx`：
  - 新增 `excludedSubCategoryKeys: string[]` state，初始化讀取 localStorage；變動時寫回，且當清空時自動關閉摘要面板。
  - `filteredTransactions` 在 tag／支付方式之外，再以 `categoryId:subCategoryId` 比對排除，後續 `statsByCurrency`、`categoryStats`、`categoryStatsByCurrency` 與展開明細皆自動跟隨。
  - 每個子類別摘要列右側加上 `EyeOff` 排除按鈕；按下後該子類別立刻從統計與明細移除。
  - 篩選列在有排除項時顯示中性灰「排除 N」按鈕，與漏斗按鈕同一族系；面板預設收合，按下才展開「已排除子類別」chip 清單。
  - 面板含「清除全部」按鈕，每個 chip 點擊可單獨取消排除；最後一個 chip 取消後面板自動關閉且按鈕消失。
  - 每個幣別卡右上的 active filter badge 在 tag／支付方式描述後加入「排除 N 個子類別」段落，作為面板收合時的視覺提示。

## 介面與型別

- key 格式為 `categoryId:subCategoryId`，空 `subCategoryId` 仍保留分隔符以支援「未選子類別」排除；顯示名稱透過 `CATEGORY_BY_ID` 解析為「主類別 / 子類別」，找不到時 fallback 為原始 id。
- 不變更 `Transaction` 模型，亦未新增 IndexedDB settings；偏好僅保存在當前瀏覽器，因此跨裝置不會同步。

## 驗證

- 已執行 `npm run build`（含 `tsc --strict`）。
- 已啟動 `npm run dev` 本機驗證：
  - 從「固定支出」展開後排除「房貸」，總支出、類別占比、子類別摘要、展開明細與交易列表同步消失。
  - 重新整理或關閉再開後，排除清單仍從 localStorage 還原並繼續套用。
  - 月份／年份、tag、支付方式篩選與排除子類別可同時生效。
  - 「排除 N」按鈕、面板、chip 與「清除全部」皆運作正常，最後一個 chip 取消後面板自動關閉。
  - 故意把 `statsExcludedSubCategoryKeys` 改為非 JSON 或非 array 後重新整理，頁面照常呈現且回到無排除狀態。

## 後續

- 第一版只用 localStorage，沒有跨裝置同步；之後若有需要再評估移到 IndexedDB settings 或雲端設定。
