# 統計排除子類別實作計劃

本項目實作時會使用新的 git worktree 進行開發，不直接修改目前 repo 根目錄；建議 worktree 路徑為 `worktrees/stats-excluded-subcategories`，完成後再由該分支提交與合併。

## 摘要

- 在統計頁提供排除指定子類別的能力，例如排除房貸，避免大額固定支出拉高日常消費佔比。
- 排除操作應從「依照類別分析」中的子類別卡牌直接觸發，讓使用者看到高佔比項目時可就地排除。
- 排除條件套用在統計頁的所有統計結果與交易明細，並沿用既有月份／年份、tag、支付方式篩選。
- 排除清單需 persist in local storage，讓使用者下次開啟統計頁時仍保留排除偏好。

## 關鍵變更

- 在 `MonthlyStatsPage` 的類別分析子類別卡牌加入排除操作，例如小型 menu / icon button / secondary action。
- 新增本頁 state，例如 `excludedSubCategoryKeys: string[]`，key 使用 `categoryId:subCategoryId`，避免不同主類別下同名或同 id 子類別混淆。
- 初始化時從 `localStorage` 讀取排除清單；使用者新增、清除單一或清除全部排除條件時同步寫回。
- 使用者在子類別卡牌按下排除後，重新計算 `filteredTransactions`，排除符合 `categoryId` 與 `subCategoryId` 的交易。
- 在篩選列或分頁上方顯示已排除摘要 chip，例如 `已排除：固定支出 / 房貸`，並提供清除單一排除與清除全部。
- active filter badge 納入排除摘要，例如 `排除 1 個子類別`。
- 當期間、tag 或支付方式變更後，即使已排除的子類別不在目前畫面出現，也保留 local storage 中的排除清單；摘要可顯示已知名稱，無法解析時 fallback 為原始 key。

## 介面與型別

- 可在 `MonthlyStatsPage` 用 `useMemo` 從目前類別統計結果建立已排除摘要；若邏輯變複雜再抽到 `statsService`。
- 不變更 `Transaction` 模型；使用既有 `categoryId` 與 `subCategoryId`。
- 新增 local storage key，例如 `statsExcludedSubCategoryKeys`，value 為 JSON string array。
- 不新增 IndexedDB settings；此偏好僅保存在目前瀏覽器。

## 測試計劃

- 執行 `npm run build`。
- 手動驗證可從「依照類別分析」的房貸子類別卡牌觸發排除。
- 手動驗證排除房貸後，總支出、類別統計、子類別摘要、收入／支出明細與交易列表都同步移除該子類別交易。
- 驗證已排除 chip 可清除單一子類別或全部排除條件。
- 重新整理頁面或離開再回到統計頁後，確認 local storage 中的排除條件仍會套用。
- 驗證月份／年份、tag、支付方式篩選與排除子類別可共同作用。
- 驗證沒有子類別、未選子類別與多幣別資料的候選選項與統計結果合理。
- 驗證清除排除條件後統計恢復包含所有交易。
- 驗證 local storage 值損毀或不是 array 時，安全 fallback 為空清單且不造成頁面錯誤。

## 假設

- 第一版使用 local storage，不提供跨裝置同步；若後續需要同步到其他裝置，再評估移到 IndexedDB settings 或雲端設定。
