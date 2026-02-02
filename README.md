# Cozy Pocket - 智慧記帳 WebApp

Cozy Pocket 是一款基於 **React 19** 開發的極簡風格智慧記帳應用程式，結合了美學設計與 Google Gemini AI 的強大功能，並提供 **Google Sheets 雲端同步**功能，確保資料安全與跨裝置存取。

---

## 1. 專案概述 (Project Overview)
*   **設計理念**：深色調 (Dark Mode) 美感、隱私優先、極致互動體驗。
*   **核心功能**：
    *   **智慧日曆**：以日期為核心的交易導覽與收支標記。
    *   **AI 智慧解析**：整合 Google Gemini API，支援自然語言輸入自動轉換為帳務。
    *   **離線優先 (Offline-First)**：使用 IndexedDB (Dexie.js) 確保資料在無網路時依然可用。
    *   **雲端同步 (Cloud Sync)**：透過 Google Apps Script 將資料自動備份至 Google Sheets。

---

## 2. 雲端同步規格 (Cloud Sync Specification)

為了實現資料的永久保存與多端檢視，Cozy Pocket 採用「本地優先、非同步上雲」的架構。

### 2.1 儲存架構 (Storage Architecture)
*   **本地 (Local)**：IndexedDB (透過 Dexie.js)，存儲完整的交易紀錄與同步狀態 (`synced: boolean`)。
*   **中繼 (Bridge)**：Google Apps Script (GAS)，作為 Serverless API 接收前端請求。
*   **遠端 (Remote)**：Google Sheets，作為最終雲端資料庫。
    *   **分表邏輯**：系統將依據年份自動建立分頁（如：`2024`, `2025`），方便管理大量數據。

### 2.2 同步流程 (Sync Logic)
1.  **新增紀錄**：資料首先寫入本地 IndexedDB，`synced` 標記為 `false`。
2.  **背景觸發**：若網路連接正常，前端立即發送 `POST` 請求至 GAS API。
3.  **衝突處理**：GAS 透過 `UUID` 檢查重複性，確保資料不因重複同步而冗餘。
4.  **狀態更新**：同步成功後，將本地資料標記為 `synced: true`。
5.  **啟動校驗**：每次 App 開啟時，自動掃描並補發所有 `synced: false` 的紀錄。

### 2.3 安全與配置 (Configuration)
用戶需在 App 的「同步設定」中提供以下資訊：
*   **API URL**：部署後的 Google Apps Script 網址。
*   **Sheet ID**：目標試算表的唯一識別碼。
*   **Secret Key**：自定義的通訊密鑰，防止未經授權的 API 調用。

---

## 3. 技術棧 (Tech Stack)
*   **前端框架**：React 19
*   **樣式處理**：Tailwind CSS
*   **資料庫**：Dexie.js (IndexedDB Wrapper)
*   **日期處理**：date-fns
*   **圖示庫**：Lucide React
*   **人工智慧**：@google/genai (Gemini 3 Flash)
*   **後端服務**：Google Apps Script
*   **雲端儲存**：Google Sheets API

---

## 4. 資料模型 (Data Schema)

### Transaction 介面 (擴充版)
```typescript
export interface Transaction {
  id: string;            // 唯一識別碼 (UUID)
  type: '支出' | '收入';
  amount: number;        // 金額
  categoryId: string;    // 主分類 ID
  subCategoryId?: string; // 子分類 ID
  name: string;          // 項目名稱
  merchant?: string;     // 商家名稱
  note?: string;         // 備註
  date: string;          // YYYY-MM-DD
  time: string;          // HH:mm
  paymentMethod: string; // 現金, 信用卡, 電子支付, 轉帳
  tags?: string;         // 標籤字串
  synced: boolean;       // 同步狀態 (雲端專用)
}
```

---

## 5. 核心邏輯說明

### 5.1 全文檢索
*   支援跨欄位模糊搜尋：搜尋關鍵字會比對 `name`、`merchant`、`note`、`tags` 以及分類名稱。

### 5.2 AI 解析 (Gemini)
*   模型能將自然語言（如「昨晚在屈臣氏買感冒藥 200」）解析為結構化 JSON，自動映射到正確的分類。

---

## 6. 如何開發與運行

1.  **安裝依賴**：`npm install`
2.  **本地開發**：`npm run dev`
3.  **配置雲端**：參考 `db-spec-by-claude.md` 部署 Google Apps Script 並於 App 內填入配置。

---

## 7. UI/UX 設計規範
*   **配色**：主色 `#1a1c2c` (深藍黑)，強調色 `#22d3ee` (Cyan-400)。
*   **交互**：所有彈窗使用 `animate-slide-up` 動畫，具備流暢的觸覺回饋。