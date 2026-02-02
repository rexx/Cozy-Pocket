# Cozy Pocket - 智慧記帳 WebApp

Cozy Pocket 是一款基於 **React 19** 開發的極簡風格智慧記帳應用程式，結合了美學設計與 Google Gemini AI 的強大功能，旨在提供流暢且直觀的個人財務管理體驗。

---

## 1. 專案概述 (Project Overview)
*   **設計理念**：深色調 (Dark Mode) 美感、隱私優先（資料本地存儲）、極致互動體驗。
*   **核心功能**：
    *   **智慧日曆**：以日期為核心的交易導覽與收支標記。
    *   **交易管理**：支援支出與收入的完整 CRUD 操作。
    *   **AI 智慧解析**：整合 Google Gemini API，支援自然語言輸入自動轉換為帳務（預留接口）。
    *   **本地存儲**：使用 IndexedDB (Dexie.js) 確保資料在離線狀態下依然可用且安全。
    *   **全文檢索**：可搜尋名稱、商家、備註及標籤。

---

## 2. 技術棧 (Tech Stack)
*   **核心框架**：React 19
*   **樣式處理**：Tailwind CSS
*   **資料庫**：Dexie.js (IndexedDB Wrapper)
*   **日期處理**：date-fns
*   **圖示庫**：Lucide React
*   **人工智慧**：@google/genai (Gemini 3 Flash)
*   **開發與構建**：Vite + TypeScript

---

## 3. 檔案架構 (File Structure)
```text
/
├── index.html          # 入口文件
├── index.tsx           # React 掛載點
├── App.tsx             # 應用程式主邏輯與搜尋管理
├── db.ts               # Dexie 資料庫配置
├── types.ts            # TypeScript 介面定義
├── constants.ts        # 靜態資料（分類、初始測試資料）
├── components/         # 介面組件
│   ├── Calendar.tsx             # 自定義日曆與導航
│   ├── TransactionItem.tsx      # 單筆交易列表顯示
│   └── AddTransactionModal.tsx  # 新增/編輯帳務彈窗
└── services/           # 外部服務
    └── geminiService.ts         # Google Gemini API 整合邏輯
```

---

## 4. 資料模型 (Data Schema)

### Transaction 介面
```typescript
export interface Transaction {
  id: string;            // 唯一識別碼
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
  tags?: string;         // 標籤字串 (空格分隔)
}
```

---

## 5. 核心邏輯說明

### 5.1 狀態與持久化
*   使用 **Dexie.js** 將所有交易儲存在瀏覽器的 IndexedDB 中。
*   `App.tsx` 負責過濾 `selectedDate` 的當日紀錄，並計算當日與當月的統計數據。

### 5.2 搜尋機制
*   支援跨欄位模糊搜尋：搜尋關鍵字會比對 `name`、`merchant`、`note`、`tags` 以及分類名稱。
*   搜尋結果會依據日期降序排列。

### 5.3 AI 解析 (Gemini)
*   在 `services/geminiService.ts` 中，預先定義了 `responseSchema`。
*   模型能將如「昨晚在屈臣氏買感冒藥 200」解析為結構化 JSON，自動映射到正確的 `categoryId` (medical) 與 `subCategoryId` (medicine)。

---

## 6. 如何開發與運行

1.  **安裝依賴**：
    ```bash
    npm install
    ```
2.  **本地開發**：
    ```bash
    npm run dev
    ```
3.  **構建生產版本**：
    ```bash
    npm run build
    ```

---

## 7. UI/UX 設計規範
*   **配色**：主色 `#1a1c2c` (深藍黑)，強調色 `#22d3ee` (Cyan-400)。
*   **字體**：Inter，注重易讀性與數字的 tabular-nums 排列。
*   **交互**：所有彈窗使用 `animate-slide-up` 動畫，列表項目具備 `active:scale-95` 的觸覺回饋。
