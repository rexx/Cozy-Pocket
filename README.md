
# Cozy Pocket - 智慧記帳 WebApp

Cozy Pocket 是一款基於 **React 19** 開發的極簡風格智慧記帳應用程式，結合了美學設計與 Google Gemini AI 的強大功能。

---

## 1. 專案概述 (Project Overview)
*   **設計理念**：深色調 (Dark Mode) 美感、隱私優先、極致互動體驗。
*   **核心功能**：智慧日曆、AI 智慧解析、離線優先 (IndexedDB)、資料匯入匯出。
*   **雲端同步 (Cloud Sync)**：透過 Google Apps Script 將資料自動備份至 Google Sheets。

---

## 2. 開發規範 (Coding Standards) - 重要

為確保專案穩定性與類型安全，所有開發者必須遵守以下規範：

### 2.1 外部庫匯入規則
*   **Dexie (資料庫)**：
    *   **必須使用預設匯入**：`import Dexie from 'dexie';`
    *   **嚴禁使用具名匯入**：不可使用 `import { Dexie } from 'dexie';`，以避免 TypeScript 在處理子類別繼承（Subclassing）時無法識別 `this.version()` 等核心方法。
*   **Google GenAI**：
    *   遵循官方最新 SDK 規範，使用 `new GoogleGenAI({ apiKey: process.env.API_KEY })` 初始化。

---

## 3. 雲端同步規格 (Cloud Sync Specification) - 未來實作項目

為了實現資料的永久保存與多端檢視，Cozy Pocket 採用「本地優先、非同步上雲」的架構。

### 3.1 儲存架構 (Storage Architecture)
*   **本地 (Local)**：IndexedDB (透過 Dexie.js)，存儲完整的交易紀錄與同步狀態 (`synced: boolean`)。
*   **中繼 (Bridge)**：Google Apps Script (GAS)，作為 Serverless API 接收前端請求。
*   **遠端 (Remote)**：Google Sheets，作為最終雲端資料庫。
    *   **分表邏輯**：系統將依據年份自動建立分頁（如：`2024`, `2025`），方便管理大量數據。

### 3.2 同步流程 (Sync Logic)
1.  **新增紀錄**：資料首先寫入本地 IndexedDB，`synced` 標記為 `false`。
2.  **背景觸發**：若網路連接正常，前端立即發送 `POST` 請求至 GAS API。
3.  **衝突處理**：GAS 透過 `UUID` 檢查重複性，確保資料不因重複同步而冗餘。
4.  **狀態更新**：同步成功後，將本地資料標記為 `synced: true`。
5.  **啟動校驗**：每次 App 開啟時，自動掃描並補發所有 `synced: false` 的紀錄。

### 3.3 安全與配置 (Configuration)
用戶需在 App 的「同步設定」中提供以下資訊：
*   **API URL**：部署後的 Google Apps Script 網址。
*   **Sheet ID**：目標試算表的唯一識別碼。
*   **Secret Key**：自定義的通訊密鑰，防止未經授權的 API 調用。

---

## 4. 技術棧 (Tech Stack)
*   **前端框架**：React 19
*   **樣式處理**：Tailwind CSS
*   **資料庫**：Dexie.js (IndexedDB)
*   **日期處理**：date-fns
*   **圖示庫**：Lucide React
*   **人工智慧**：@google/genai (Gemini 3 Flash)

---

## 5. 資料模型 (Data Schema)

### Transaction 介面
```typescript
export interface Transaction {
  id: string;
  type: '支出' | '收入';
  amount: number;
  categoryId: string;
  subCategoryId?: string;
  name: string;
  merchant?: string;
  note?: string;
  timestamp: number; // 數字格式 (Epoch)，包含日期與時間
  paymentMethod: string;
  tags?: string;
}
```

---

## 6. 核心邏輯說明

### 6.1 CSV 處理
*   系統使用自定義的 `splitCSVIntoRows` 與 `parseCSVLine` 邏輯，能正確處理包含換行符號（Newline）或逗號（Comma）且被引號包裹的 CSV 欄位，確保備份完整性。

### 6.2 AI 解析
*   整合 Gemini API，支援將自然語言輸入（如「午餐 120 現金」）結構化為帳務紀錄。

### 6.3 精確排序 (Precise Sorting)
*   雖然 UI 介面僅讓使用者選擇至「分鐘」，但系統在存檔時會自動擷取當下的「秒數」與「毫秒」併入 `timestamp`。這解決了在同一分鐘內新增多筆交易時，畫面排序可能跳動的問題。

---

## 7. 如何運行
1. `npm install`
2. `npm run dev`
