# SettingsPage Status Type 擴充

## 摘要

- 設定子頁的頁內 status type 由 `success | error | idle` 擴充為 `success | error | warning | info | idle`。
- 離線待同步、mock 設定填入改用 `info`；表單前置條件提醒改用 `warning`。
- 移除以 success tone 表示非成功狀態的用法，預覽卡不再混用成功綠。

## 實作內容

- `components/settings/settingsStatus.ts` 的 `SettingsStatusType` 為 `'success' | 'error' | 'warning' | 'info' | 'idle'`。
- `components/settings/SettingsFeedbackCard.tsx` 的 `SettingsFeedbackTone` 定義為 `Exclude<SettingsStatusType, 'idle'>`，兩者不會各自漂移；新增 `info` 的 border／background／action 樣式（cyan 色系，沿用專案 accent）。
- `SettingsStatusCard` 依 type 渲染對應圖示：success 為 `CheckCircle2`、error 為 `AlertCircle`、warning 為 `TriangleAlert`、info 為 `Info`；圖示色階沿用該 tone 的標題色。`idle` 不渲染任何卡片。
- 圖示與訊息以 flex 排列，訊息保留 `whitespace-pre-line` 並加上 `min-w-0 flex-1`，多行訊息在手機寬度下換行對齊圖示右側。

### 語意調整

| 情境 | 原本 | 現在 |
| --- | --- | --- |
| 同步設定儲存後離線待同步 | `success` | `info` |
| CSV 匯入後離線待同步 | `success` | `info` |
| Tag 更新後離線待同步 | `success` | `info` |
| 商家更名後離線待同步 | `success` | `info` |
| 填入 mock API 設定 | `success` | `info` |
| 未輸入新 tag 名稱 | `error` | `warning` |
| 未先預覽受影響筆數（Tag／商家） | `error` | `warning` |
| 預覽結果為 0 筆 | `error` | `warning` |
| 未選擇同步年份 | `error` | `warning` |
| 未選擇 CSV／設定備份檔 | `error` | `warning` |
| 預覽完成但無有效交易紀錄 | `error` | `warning` |

`error` 保留給例外與同步失敗；`success` 保留給 Tag 拆分／移除完成、設定還原待重新載入、本機重置完成。

### 預覽卡

- `ImportExportSection` 的匯入預覽與還原預覽原本是手寫的 amber `div`，已改用共用的 `SettingsFeedbackCard tone="warning"`。
- 預覽卡內「預計影響」「可匯入」「設定項目」等統計數字原本使用 `text-emerald-300`，在 warning／error tone 的卡片中讀起來像成功訊號，已改為繼承卡片自身色階。

## 驗證

- `npm run build`（`tsc --strict` + Vite production build）通過。
- info tone 的 7 個 Tailwind utility 皆出現在 build 產物的 CSS 中。
- 瀏覽器實測（375×812，全新 origin 因此 `getSyncConfig()` 為 `null`）涵蓋四個 tone 的 status 卡：
  - `info`：填入 mock API 設定、離線儲存同步設定，皆渲染 cyan 卡與 `lucide-info`。
  - `warning`：輸入會被 `normalizeTag` 正規化為空的字串（例如 `#`）後按預覽，渲染 amber 卡與 `lucide-triangle-alert`。
  - `success`：Tag 拆分完成，渲染 emerald 卡與 `lucide-circle-check`。
  - `error`：同步端點指向不可達位址造成同步全失敗，渲染 red 卡與 `lucide-circle-alert`，附帶的「查看同步狀態」按鈕在 343px 卡片內佔 309px，多行訊息未擠壓按鈕。
- 更名預覽、拆分預覽與移除預覽卡確認不再含 `emerald` 元素。
- 匯入預覽與還原預覽需先選檔，未納入瀏覽器實測，僅由 build 與 diff 佐證。
