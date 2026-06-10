# 新增／編輯交易的 Tag 建議改依最後出現時間排序

## 摘要

- 新增／編輯交易 modal 的 Tag 建議 chips 原本與商家、項目名稱共用同一套排序：文字符合度 → 子類別符合 → 類別符合 → 使用次數 → 最後使用時間。
- Tag 的使用情境偏向「延續最近在記的事情」（例如旅行、專案），因此 Tag 建議已改以最後出現時間（`lastUsedAt`）為主要排序依據，越近期使用的 tag 越前面。
- 商家與項目名稱建議維持原有排序，不受影響。

## 最終行為

- `components/AddTransactionModal.tsx` 的 `getRankedSuggestions()` 新增排序策略參數 `rankBy: 'frequency' | 'recency'`（預設 `'frequency'`）。
- Tag 建議走 `'recency'`：文字符合度（輸入過濾時精確／前綴符合仍優先）→ `lastUsedAt` 由新到舊 → 使用次數 → 字典序。
- recency 模式跳過類別／子類別符合層：Tag 與類別關聯較弱，直接以最近使用為主。
- `tagSuggestions` 的 useMemo 依賴同步移除不再影響結果的 `categoryId` / `subCategoryId`。
- 資料面不變：`SuggestionItem.lastUsedAt`（`types.ts`）由 `App.tsx` 建立 suggestion index 時以交易 `timestamp` 取最大值計算。

## 驗證

- `npm run build`（tsc strict + Vite production build）通過。
- 以 cmux browser 對 dev server 實測，測試資料設計成次數排序與最近使用排序結果相反（`often` ×3 於 30 天前、`middle` ×2 於 10 天前、`recent` ×1 於昨天）：
  - 預設建議順序為 `#recent → #middle → #often`（最近使用優先）。
  - 輸入 `mi` 時 `#middle` 因前綴符合排到第一，其餘仍依最近使用排序。
  - 點選建議加入 tag 後，該 tag 從建議中排除。
  - 商家建議排序行為不變，console 無錯誤。

## 假設

- 「最後出現時間」即 suggestion index 既有的 `lastUsedAt`（該 tag 所屬交易的最大 `timestamp`），不另外記錄 tag 被點選的時間。
- 建議數量上限（`suggestionLimit`）維持現狀。
