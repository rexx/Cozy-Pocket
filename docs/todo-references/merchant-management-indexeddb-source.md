# 商家管理 IndexedDB 資料來源評估計劃

本項目實作時會使用新的 git worktree 進行開發，不直接修改目前 repo 根目錄；建議 worktree 路徑為 `worktrees/merchant-management-indexeddb-source`，完成後再由該分支提交與合併。

## 摘要

- 評估是否將商家管理改為進頁後直接查 IndexedDB，而不是依賴 `App` 全量載入的 `transactions` state。
- 目標是降低商家管理對全域 state 的耦合，並為大量交易資料做準備。
- 若評估後實作，商家管理頁需自行載入摘要與商家交易列表。

## 關鍵變更

- 在 `services/merchantService.ts` 新增 IndexedDB 查詢版本，例如 `getMerchantUsageSummariesFromDb` 與 `getTransactionsByMerchantFromDb`。
- 將 `MerchantManagementSection`（目前由 `SettingsPage` 在 `settings-merchant` 子頁掛載）的資料來源從 `App.tsx` 全量 `transactions` state 改成進子頁時 useEffect 載入。
- 更名成功後由 Section 重新載入商家摘要與選取商家的交易列表，再通知 `App` refresh shared state。
- 保留從商家交易點入編輯 modal 的 callback。

## 介面與型別

- 可減少 `merchantSummaries` 與相關 callback 對 `App.tsx` 全量 transactions 的依賴；若其他流程仍需要，可在過渡期保留可選。
- 新增 service 函式應回傳現有 `MerchantUsageSummary` 與 `Transaction[]`。

## 測試計劃

- 執行 `npm run build`。
- 手動驗證進入商家管理頁時顯示 loading、空狀態與摘要列表。
- 驗證更名後商家列表與交易列表即時更新，返回首頁後資料也一致。
- 驗證大量交易資料下切換商家不會造成明顯 UI 卡頓。

## 假設

- 本項目不改 IndexedDB schema，只改查詢與元件資料來源。
