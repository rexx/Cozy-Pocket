# 設定備份與還原（JSON）

## 摘要

刪除並重新安裝 PWA 會清空整個 origin 的儲存，交易可以從雲端 pull 或 CSV 匯入救回，但**設定救不回來**：`syncApiUrl`、`syncToken`、`geminiApiKey`、`defaultCurrency`、`enabledCurrencies`、`paymentMethodDisplayMode`、`homeNavArrowsVisible`、`errorBannerVisible` 都只存在本機。其中 `geminiApiKey` 與 `syncToken` 在 UI 上是 `type="password"`，使用者連抄都抄不出來。

「匯入匯出」因此多了一組 JSON 設定備份／還原，與既有 CSV 並存，形成兩檔備份模型：

| 檔案 | 內容 | 既有／新增 |
|---|---|---|
| `cozy_pocket_backup_YYYYMMDD.csv` | 交易 | 既有 |
| `cozy_pocket_settings_YYYYMMDD.json` | 設定（+ 選配敏感資料與同步紀錄） | 新增 |

前置作業是把僅存於 localStorage 的兩個偏好（`home-calendar-view-mode`、`statsExcludedSubCategoryKeys`）搬進 Dexie `settings` 表，因此備份只需要處理單一儲存層，檔案裡沒有 localStorage 區塊。

Tag 與商家不需另存：兩者都是從 `Transaction.tags` / `.merchant` 即時推導，沒有獨立儲存。分類為 `constants.ts` 硬編碼。

## 關鍵決策

### 第一步：偏好統一收進 `settings` 表

1. **`home-calendar-view-mode` → `homeCalendarViewMode`、`statsExcludedSubCategoryKeys` 維持同名搬進 `settings`。** 原本用 localStorage 是為了同步讀取（`useState` initializer），但 `App.tsx` 有 `isLoading` gate，開機時本來就在 `await db.settings.get(...)`，畫面在那之前只有 spinner——併進既有的 `Promise.all` 不會有預設值閃一下的問題。
2. **不動 Dexie schema。** `settings` 表已存在，只是多兩個 key，不需要 `db.version(3)`，紅區 R4 不受影響。
3. **一次性遷移。** `migrateLegacyLocalStoragePreferences()` 在開機讀設定前執行：`settings` 已有該 key 就跳過（idempotent，且防止過期的 localStorage 殘值覆蓋較新的偏好），搬完刪掉 localStorage 原值。
4. **寫入改由 change handler 負責，不用 effect。** effect 會在 mount 時也觸發一次，與開機讀取形成 race，把預設值寫回去蓋掉已存的偏好。
5. **統計排除項提升到 `App.tsx`。** `MonthlyStatsPage` 只在進入統計頁時才掛載，自己非同步讀會有一幀顯示未排除的金額再跳動。改由 App 開機載入、以 prop 傳入，與 `paymentMethodDisplayMode` 等四個偏好同一模式。
6. **`cozy-pocket.mock-cloud-sync.v1` 留在 localStorage。** 它是 mock 後端的儲存，刻意模擬「遠端」，搬進同一個 Dexie DB 會把 local 與 remote 的界線弄糊。所以結論是「設定全部進 db」，不是「完全不用 localStorage」。

### 第二步：備份與還原

7. **新增 `services/settingsBackupService.ts`** — 擁有匯出組裝、檔案解析、驗證與還原寫入的完整資料流。UI 只呼叫服務，不自行讀寫 Dexie。
8. **匯出採整表 dump，不用 key 白名單** — `db.settings.toArray()` 全撈，未來新增設定 key 自動納入備份，不會出現「加了 key 忘了更新備份清單」的漏洞。
9. **三項選配、預設不選** — `geminiApiKey`、`syncToken`、`pullReports` 各自一個勾選框，預設關閉。前兩者是明文金鑰，預設不寫進會落在下載資料夾／iCloud 的檔案；`pullReports` 是同步歷史而非設定，預設不帶。
10. **還原走「先預覽再套用」** — 與既有 CSV 匯入同一節奏：選檔 → 顯示這個檔案帶了什麼 → 確認才寫入。
11. **還原語意為 merge，不是 replace** — `db.settings.bulkPut()` 只覆蓋檔案裡有的 key。沒勾金鑰匯出的檔案，還原時不會把現有金鑰清掉。
12. **套用後強制 reload** — 偏好是在啟動時讀進 React state 的，不 reload 畫面不會反映。

## 介面與型別

```ts
// preferences.ts
export const HOME_CALENDAR_VIEW_MODE_SETTING_KEY = 'homeCalendarViewMode';
export const STATS_EXCLUDED_SUBCATEGORY_KEYS_SETTING_KEY = 'statsExcludedSubCategoryKeys';
export const getHomeCalendarViewMode: (value: unknown) => CalendarViewMode;
export const migrateLegacyLocalStoragePreferences: () => Promise<void>;

// services/settingsBackupService.ts
export const SETTINGS_BACKUP_SCHEMA_VERSION = 1;

export interface SettingsBackupOptions {
  includeGeminiApiKey: boolean;
  includeSyncToken: boolean;
  includePullReports: boolean;
}

export interface SettingsBackupFile {
  schemaVersion: number;   // 目前為 1
  exportedAt: string;      // ISO 8601
  dbVersion: number;       // Dexie schema 版本，還原時判斷相容性
  settings: AppSetting[];
  pullReports?: PullReport[];
}

export interface SettingsBackupPreview {
  exportedAt: string;
  schemaVersion: number;
  settingKeys: string[];         // 顯示用，供使用者確認檔案內容
  pullReportCount: number;
  includesGeminiApiKey: boolean;
  includesSyncCredentials: boolean;
  skippedEntryCount: number;     // 格式不符被丟棄的筆數
}

export const exportSettingsBackup: (options: SettingsBackupOptions) => Promise<void>;
export const parseSettingsBackupFile: (file: File) => Promise<{ backup: SettingsBackupFile; preview: SettingsBackupPreview }>;
export const restoreSettingsBackup: (backup: SettingsBackupFile) => Promise<SettingsBackupRestoreResult>;
```

驗證規則：

- `schemaVersion` 比目前版本新 → 直接擋下並說明「此備份由較新版本產生」，不嘗試硬套。
- `settings` 項目需為 `{ key: string, value: unknown }`，`key` 非空字串；不符者丟棄並計入 `skippedEntryCount`。
- `pullReports` 需有字串 `id`；不符者丟棄。
- 整份 JSON 解析失敗或缺少 `schemaVersion` → 視為非本 app 的備份檔，錯誤訊息明講。

## UI 細節

「匯入匯出」頁在原本兩個面板（匯出 CSV／匯入 CSV）之外多了兩個，維持 `xl:grid-cols-2` 的 2×2 版面：

**設定備份（匯出 JSON）**

- 三個勾選框，預設全部未勾：「包含 Gemini API key」「包含同步 token」「包含同步紀錄」。
- 勾選任一金鑰時，面板顯示琥珀色提醒：檔案將含明文金鑰，請勿外流。
- 按鈕「匯出設定 JSON」。

**設定還原（匯入 JSON）**

- 檔案選擇（`accept=".json"`）→ 預覽卡列出：匯出時間、設定項目數、同步紀錄筆數，以及是否含 Gemini key／同步憑證。
- 含同步憑證時，確認對話框額外說明會覆蓋目前的同步設定——避免在 dev origin 上誤把本機指向正式 GAS 端點。
- 套用成功 → SweetAlert2 告知需重新載入 → `window.location.reload()`。

文案：`settingsSectionCopy.ts` 的 `import-export` description 與 `SettingsPage` overview 的 meta 改為同時反映交易與設定備份。

## 驗證

在 cmux 以未使用過的 port 啟動（fresh IndexedDB，無同步憑證，對雲端無寫入路徑）：

**偏好遷移**

1. 造出舊版狀態（localStorage 有兩個 key、`settings` 沒有）→ 重新載入 → 兩個值進 `settings`，localStorage 原 key 已刪除。
2. 開機後月曆維持遷移來的週檢視（`aria-expanded="false"`），統計頁首次 render 即顯示「排除 2」——沒有先閃預設值。
3. 切換月曆檢視 → `homeCalendarViewMode` 寫入 db；統計頁「清除全部」→ `statsExcludedSubCategoryKeys` 寫入 `[]`。

**備份與還原**

4. 預設不勾任何選項匯出 → JSON 只有 `schemaVersion` / `exportedAt` / `dbVersion` / `settings` 四個頂層欄位，不含 `geminiApiKey`、`syncToken`、`pullReports`。
5. 三項全勾匯出 → 三者都在。
6. 實際下載的檔案（非合成物件）重新匯入 → 還原前刻意改掉的 `defaultCurrency` / `paymentMethodDisplayMode` 回到檔案中的值，檔案沒帶的 key 保持不變。
7. 餵入非 JSON 檔、`schemaVersion: 99`、`settings` 內含壞資料的檔案 → 分別得到可讀的錯誤訊息／略過計數，不寫入任何資料。
8. `npm run build`（tsc strict + production build）與 `npm run docs:check`。

不在 cmux 範圍：作業系統檔案選擇器本身（匯入是以真實檔案 bytes 造 `File` 物件注入 input，繞過選擇器），以及 iPhone standalone 下的下載與 share sheet 行為，交由使用者在實機驗收。

## 假設

- 使用者是唯一使用者，備份檔由本人保管；金鑰明文的風險以「預設不含 + 明確警告」處理，不做加密。
- 還原對象是同一個 app 的不同安裝，不處理跨 app／跨 schema 的資料遷移。
- `pullReports` 屬於稽核歷史，遺失可接受，因此預設不備份。
