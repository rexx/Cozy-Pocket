# `SettingsPage` 拆解（完成紀錄）

## 摘要

`components/SettingsPage.tsx` 在收編商家管理之後一度達到約 1168 行，同時持有七個設定子頁的 routing、各子頁的 in-progress state、一份共用的 status state、CSV 匯入匯出的全部邏輯，以及年度雲端同步 dialog 的 markup。此項目分四步把這些責任移到各自該在的地方，container 退回「header / 背景 glow / 子頁 routing / overview 卡片 / render switch ＋ 少量跨子頁資料 state」的形狀，最終落在 483 行。

四步都是行為保持不變的重構：UI 文案、樣式、錯誤訊息與所有計數語意都與拆解前相同。

各步驟另有獨立紀錄：

| 步驟 | 內容 | 紀錄 |
|---|---|---|
| 1 | Tag / Merchant 更名 state 移進各自的 Section | [`section-owned-rename-state.md`](./section-owned-rename-state.md) |
| 2 | 共用 status state 拆到各 Section ＋ 共用 `SettingsFeedbackCard` | [`section-owned-status-state.md`](./section-owned-status-state.md) |
| 3a | CSV 純字串層進 `services/csvService.ts` | [`csv-service-string-layer.md`](./csv-service-string-layer.md) |
| 4 | 年度雲端同步 Pull dialog 獨立成 component | [`pull-year-dialog.md`](./pull-year-dialog.md) |

Step 3b 是收尾的最後一步，沒有另開紀錄，其終態直接寫在下方。

## 最終狀態

### container 保留的責任

`SettingsPage` 現在只持有：

- 設定首頁 / 七個設定子頁的 routing、overview 卡片與 render switch
- 跨子頁共用的設定資料 state：`defaultCurrency`、`enabledCurrencies`、`geminiApiKeyInput`／`hasGeminiApiKey`、`syncApiUrl`／`syncToken`，以及啟動時一次性載入的 `useEffect`
- 偏好幣別 / 付款方式 / 首頁箭頭 / error banner / Gemini key / 同步設定的 db 寫入 handler
- CSV 匯入匯出與重置本機資料的 db orchestration callback

不再由 container 持有：Tag / Merchant 更名流程的所有 state 與 handler、共用 `status` 與底部 `renderStatusMessage`、Pull dialog 的 state 與 markup、CSV 的字串處理與映射，以及 `section !== 'merchant'` 之類的 special-case 渲染。

### Step 3b — 映射、匯出與 `ImportPreview` 型別歸位

`services/csvService.ts` 在純字串層之外新增三個 export 與兩個型別：

- `parseTransactionsFromCSV(text)`：header 正規化、row → `Transaction` 映射、`amount`／`timestamp`／`updatedAt`／`version` 的轉型與 fallback、`isNaN` 過濾、檔案內重複 ID 計數。回傳 `transactions` 與 `totalRows`／`validRows`／`invalidRows`／`duplicateInFileCount`，外加呼叫端查既有重複所需的 `uniqueIds`。`檔案內容為空` 與 `檔案格式不正確或無資料` 兩個 throw 一併搬入。
- `buildTransactionsCSV(transactions)`：`CSV_HEADERS.join(',')` 與每格的 `"` 跳脫。
- `downloadCSV(csvContent, fileName)`：UTF-8 BOM、mime `text/csv;charset=utf-8;` 的 Blob 與 anchor 下載。BOM 以 `\ufeff` escape 書寫而非字面字元——該字元在多數編輯器不可見，而它同時守著匯出的 Excel 相容性與匯入時的 header 前綴剝除，兩者失效都不會有任何錯誤徵兆。
- `ImportPreview` 型別從 `components/settings/ImportExportSection.tsx` 移入，`ImportExportSection` 與 `SettingsPage` 都改 import。
- `ParsedTransactionsCSV` 為 service 的回傳型別，與 UI 要看的 `ImportPreview` 分開：前者帶 `uniqueIds` 不帶 `duplicateWithExistingCount`，後者相反。

container 側 `parseImportFile` 縮成「呼叫 service → 用 `uniqueIds` 做一次 `bulkGet` → 合成 `ImportPreview`」5 行，`exportToCSV` 縮成「讀 db → `buildTransactionsCSV` → `downloadCSV`」4 行。檔名 `cozy_pocket_backup_<yyyyMMdd>.csv` 仍在 container 組出來後傳入。`ImportCommitResult`（`extends SyncOutcome`）留在 `ImportExportSection`，它描述的是 commit 結果而非 CSV 結構。

### 刻意留在 container 的 db 寫入層

`commitImport` 與它內部的 `bulkGet`、以及 `parseImportFile` 保留的那一次 `bulkGet` 長期留在 `SettingsPage`：它們是 db 寫入 ＋ `onTriggerSync` 的 orchestration，移進 `ImportExportSection` 會破壞「Section 不直接碰 db」的紀律，移進 service 則讓 service 同時持有解析與資料庫兩種責任。`csvService` 沒有任何 db 存取。

### 行數

| 檔案 | 拆解前 | 最終 |
|---|---|---|
| `components/SettingsPage.tsx` | ~1168 | 483 |
| `services/csvService.ts` | 不存在 | 154 |

## 驗證

- `npm run build`（tsc strict + Vite）在每一步都通過。
- Step 3b 的平移等價性以 script 逐 token 比對：除了預期的形狀改變（`parsedTransactions` → `transactions`、計數改成在 return 裡算、`uniqueIds` 納入回傳、`await file.text()` 留在 container）之外，映射邏輯一個 token 都沒變；`buildTransactionsCSV` 的 15 欄陣列字面值與 `downloadCSV` 的 Blob／anchor 區塊逐字存在。
- 瀏覽器驗證（Claude 桌面 app 的 Browser pane，dev server 跑在未使用過的 port 以取得空的 `CozyPocketDB`，`settings` 表確認無 `syncApiUrl`／`syncToken`）：
  - 匯出檔開頭為 `EF BB BF`，mime `text/csv;charset=utf-8;`，header 15 欄順序與 `CSV_HEADERS` 一致，檔名格式正確。
  - 匯入覆寫與附加兩種模式：確認對話框段數與文案正確，覆寫後 db 只剩該檔內容，附加後既有同 ID 被覆蓋。
  - 檔案內重複 ID 與既有 ID 兩種計數在同一份測試檔中分別讀出正確數字，無效列另計。
  - 含引號、逗號、換行的儲存格入庫值與寫入時相同；含多行儲存格的資料再匯出後仍被正確切回原列數。
  - Round trip：匯出 → 附加匯入 → 再匯出，兩次匯出結果逐字相同。
  - 兩個 throw 分支各自顯示對應的錯誤訊息，且不產生匯入預覽卡。
  - 使用者以真實下載檔（非合成 fixture）走完整匯出 → 選檔 → 附加匯入流程，確認下載檔實際落地且 header 前綴剝除正確。
- 全程 console 與 dev server log 無錯誤；390×844 下頁面無水平溢出。

## 後續線索

以下三點客觀上仍可再優化，但不屬於本項目的範圍（尤其第 3 點會碰 `App.tsx`，本項目刻意把 App orchestrator 排除在外）：

1. **把設定資料 state ＋ db handler 抽成 hook**（如 `useSettingsData`）：container 再瘦一截、logic 可獨立測試，風險低。屬於 Step 1–4 同一條紀律（container／hook 管 db、Section 管 UI）的自然延伸。
2. **讓 `PreferencesSection` / `AiSection` / `SyncSection` 也自管自己的持久化設定**（比照 Tag / Merchant 自管 rename state），container 變成幾乎純 routing。需先決定如何維持「Section 不直接碰 db」的紀律——改用 data-access hook 注入，或明確放寬該紀律，是個設計取捨。
3. **消除 `App.tsx` ↔ `SettingsPage` 的設定 state 重複載入**：兩者各自從 `db.settings` 載入 currency / payment-method / home-nav / error-banner，是兩份 source of truth。抽一個 settings service / context 統一可去掉 dual-load，但會動到 `App.tsx`，屬於另一個更大的重構。

「CSV 抽出後可單元測試」是這次拆解的潛在收益而非交付項：repo 沒有測試框架（`package.json` 無 `test` script），要真的補上 `csvService` 的測試得先引入 vitest，屬獨立決策，與 [`data-risk-guardrails.md`](../todo-references/data-risk-guardrails.md) Step 6 的紅區純函式測試是同一個前置條件。

## 行為差異備註

無。對外介面、解析結果、匯出位元組、重複計數語意與所有 UI 文案都與拆解前相同。
