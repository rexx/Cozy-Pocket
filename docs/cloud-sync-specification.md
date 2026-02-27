# 雲端同步規格 (Cloud Sync Specification) - 未來實作項目

為了實現資料的永久保存與多端檢視，Cozy Pocket 採用「本地優先、非同步上雲」的架構。

## 3.1 儲存架構 (Storage Architecture)
*   **本地 (Local)**：IndexedDB (透過 Dexie.js)，存儲完整的交易紀錄與同步狀態 (`synced: boolean`)。
*   **中繼 (Bridge)**：Google Apps Script (GAS)，作為 Serverless API 接收前端請求。
*   **遠端 (Remote)**：Google Sheets，作為最終雲端資料庫。
    *   **分表邏輯**：系統將依據年份自動建立分頁（如：`2024`, `2025`），方便管理大量數據。

## 3.2 同步流程 (Sync Logic)
1.  **新增紀錄**：資料首先寫入本地 IndexedDB，`synced` 標記為 `false`。
2.  **背景觸發**：若網路連接正常，前端立即發送 `POST` 請求至 GAS API。
3.  **衝突處理**：GAS 透過 `UUID` 檢查重複性，確保資料不因重複同步而冗餘。
4.  **狀態更新**：同步成功後，將本地資料標記為 `synced: true`。
5.  **啟動校驗**：每次 App 開啟時，自動掃描並補發所有 `synced: false` 的紀錄。

## 3.3 安全與配置 (Configuration)
用戶需在 App 的「同步設定」中提供以下資訊：
*   **API URL**：部署後的 Google Apps Script 網址。
*   **Sheet ID**：目標試算表的唯一識別碼。
*   **Secret Key**：自定義的通訊密鑰，防止未經授權的 API 調用。
