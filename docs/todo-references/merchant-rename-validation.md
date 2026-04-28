# 商家名稱調整驗證與回饋計劃

本項目實作時會使用新的 git worktree 進行開發，不直接修改目前 repo 根目錄；建議 worktree 路徑為 `worktrees/merchant-rename-validation`，完成後再由該分支提交與合併。

## 摘要

- 補齊商家名稱調整的驗證與回饋，避免產生重複商家或名稱變更後 UI 狀態不一致。
- 目前已有 preview 與合併提示，但需要更清楚的名稱正規化、衝突語意與操作後狀態。
- 目標是讓使用者知道更名、合併、同步失敗各自代表什麼。

## 關鍵變更

- 檢查 `services/merchantService.ts` 的 `normalizeMerchantName`，確認是否需要合併連續空白或大小寫規則。
- 強化 `buildMerchantRenamePreview` 的錯誤訊息，區分空白、同名、不存在與會合併到既有商家。
- 在 `MerchantManagementPage` 與 `MerchantManagementSection` 顯示更名預覽、合併警示與受影響交易列表。
- 更名成功後清除選取與 input，並確保商家摘要與交易列表重新載入。

## 介面與型別

- 可擴充 `MerchantRenamePreview`，加入 `willMerge` 或 `normalizedInput` 等欄位，但需保持既有呼叫點可更新。
- 不變更交易資料儲存格式。

## 測試計劃

- 執行 `npm run build`。
- 手動驗證空白名稱、同名、找不到商家、合併到既有商家與成功更名。
- 驗證更名後首頁、搜尋、統計、同步狀態與商家管理頁都顯示新名稱。
- 驗證離線與同步部分失敗時 status 文案合理，且交易保持 pending 可後續同步。

## 假設

- 允許合併到既有商家，但必須以 warning 明確告知。
