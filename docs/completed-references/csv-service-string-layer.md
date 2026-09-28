# CSV 純字串層抽到 `services/csvService.ts`（完成紀錄）

## 摘要

`CSV_HEADERS`、`splitCSVIntoRows` 與 `parseCSVLine` 原本宣告在 `components/SettingsPage.tsx` 內，是三段完全不碰 IndexedDB 與 DOM 的純字串處理，卻夾在 UI container 裡難以重用。此項目把三者原封不動搬到新的 `services/csvService.ts`，container 改成 import 使用。這是 [`settings-page-decomposition.md`](./settings-page-decomposition.md) Step 3a 的紀錄，接在 [`section-owned-status-state.md`](./section-owned-status-state.md)（Step 2）之後。

行為完全不變，是一次純平移。

## 最終狀態

### 新檔 `services/csvService.ts`

- `CSV_HEADERS`：15 個欄位的順序常數，匯入與匯出共用（匯入用來在檔案缺 header 時 fallback，匯出用來產生第一行）。
- `splitCSVIntoRows(text)`：以引號狀態為準切列，因此儲存格內的換行不會被誤切成新的一列；`\r\n` 與 `\r` 都當作換行，空白列丟棄。
- `parseCSVLine(line)`：以引號狀態為準切欄，連續兩個雙引號還原成一個字面雙引號，引號內的逗號不視為分隔。

三者都不 import `db`、不碰 `document`，可獨立於 React 樹使用。

### `components/SettingsPage.tsx`

- 移除上述三段宣告，改為 `import { CSV_HEADERS, parseCSVLine, splitCSVIntoRows } from '../services/csvService';`，位置與既有的 `tagService` / `merchantService` import 同一群組。
- `parseImportFile`、`exportToCSV`、`commitImport` 的本體未動，`SettingsPageProps` 對 `App.tsx` 與各 Section 的介面也未動。
- 檔案從 592 行降到 555 行。

### 刻意留在 container 的部分

row → `Transaction` 映射、`ImportPreview` 的組裝、`duplicateInFileCount` 計算、匯出字串組裝與 Blob／anchor 下載都仍在 `SettingsPage`，屬 decomposition Step 3b 的範圍；`commitImport` 與匯入時的 `db.transactions.bulkGet` 依 Step 3c 的決定長期留在 container，避免 service 同時持有解析與資料庫兩種責任。

## 驗證

- `npm run build`（tsc strict + Vite）通過。
- 平移等價性以 script 逐 token 比對（去除註解與縮排）：`splitCSVIntoRows` 的 body 與 `CSV_HEADERS` 的 literal 與搬移前完全一致；`parseCSVLine` 的唯一差異是 `const result = []` 補上 `string[]` 標註，strict mode 下的隱含 `any[]` 需要它。
- 瀏覽器互動驗證（Claude 桌面 app 的 Browser pane，dev server 跑在未使用過的 port 以取得空的 `CozyPocketDB`）：
  - 匯出 10 筆範例資料：下載的檔案開頭是 `EF BB BF`（UTF-8 BOM），header 15 欄順序與 `CSV_HEADERS` 一致，檔名 `cozy_pocket_backup_<yyyyMMdd>.csv`。
  - 匯入含特殊字元的 fixture：儲存格內換行未被切成新列、引號內逗號未被當分隔、連續雙引號正確還原、結尾空欄位解析為空字串。
  - 重複 ID 偵測：檔案內重複 1 筆、與既有資料重複 1 筆都正確計數，二次確認對話框正常跳出，確認後既有資料被覆蓋、檔內重複以最後一筆勝出。
  - Round trip：把含換行儲存格的資料再匯出，該儲存格被正確包在引號內輸出，引號重新跳脫為 `""`；下載的檔案以標準 CSV parser 讀取為 14 筆記錄、每筆 15 欄，換行與引號內容與寫入時相同。
  - 全程 console 與 dev server log 無錯誤。

## 後續

- decomposition Step 3b：`parseTransactionsFromCSV` / `buildTransactionsCSV` / `downloadCSV` 進 service，`ImportPreview` 型別從 `ImportExportSection` 跟著歸位。
- decomposition Step 4：年度雲端同步 Pull dialog 從 `SyncSection` 拉成獨立 `PullYearDialog`。

## 行為差異備註

無。對外介面、解析結果、匯出位元組與所有 UI 文案都與搬移前相同。
