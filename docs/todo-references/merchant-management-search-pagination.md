# 商家管理搜尋與分頁實作計劃

本項目實作時會使用新的 git worktree 進行開發，不直接修改目前 repo 根目錄；建議 worktree 路徑為 `worktrees/merchant-management-search-pagination`，完成後再由該分支提交與合併。

## 摘要

- 若商家數量持續成長，為商家管理加入搜尋、分頁或虛擬列表，降低渲染成本。
- 第一版優先做搜尋與簡單分頁，只有在商家數量真的很大時再導入虛擬列表。
- 目標是維持商家管理頁可掃描、可快速定位商家。

## 關鍵變更

- 在 `MerchantManagementSection` 增加商家搜尋 input，依商家名稱做即時 filter。
- 對商家摘要列表加入分頁或「載入更多」，預設顯示前 50 筆。
- 選取商家後保留搜尋字串，並確保目前選取項目在篩選結果中有清楚標示。
- 若採用 IndexedDB 資料來源，可將搜尋條件下推到 service；否則先在記憶體中 filter。

## 介面與型別

- 不變更交易資料模型。
- `MerchantManagementSection` 可能新增 `searchQuery`、`onSearchQueryChange`、pagination 狀態 props，或由 section 內部管理。

## 測試計劃

- 執行 `npm run build`。
- 手動驗證搜尋可找到中文、英文、含空白商家名稱。
- 驗證清空搜尋、沒有結果、分頁載入更多與選取商家的狀態。
- 使用較大量測試資料檢查初次 render 與輸入搜尋時沒有明顯卡頓。

## 假設

- 第一版不導入額外虛擬列表套件，除非實測分頁仍不足。
