# 使用者回饋與對話框盤點

本文盤點目前 app 內所有主要使用者回饋機制，包含原本使用瀏覽器原生 `alert()` / `confirm()` 的地方、目前改用 `sweetalert2` 的確認對話框、toast、頁內 status、inline error、同步狀態與全域錯誤面板。「原本 Alert / Confirm 使用點」一節為導入 app 內對話框前的歷史對照。

## 摘要

- 原本 runtime 程式碼共有 9 個瀏覽器原生 blocking call site：
  - `alert()`：3 個，全部在 `AddTransactionModal` 表單驗證。
  - `confirm()`：6 個，分布在 `AddTransactionModal` 刪除交易與 `SettingsPage` 匯入 / 重置資料。
- 目前 runtime 程式碼已無原生 `alert()` / `confirm()`。
- 需要使用者明確選擇「繼續 / 取消」的流程，統一走 `services/dialogService.ts` 的 `confirmAction()`。
- 表單驗證、短成功訊息、長狀態說明、同步錯誤詳情與 debug error 各自保留不同呈現方式，不全部改成 swal。

## 回饋機制總覽

| 機制 | 實作位置 | 適用情境 | 是否適合改 swal |
| --- | --- | --- | --- |
| `confirmAction()` swal dialog | `services/dialogService.ts` | 危險操作、不可逆操作、需要繼續 / 取消的明確決策 | 已使用 |
| `showAutoDismissToast()` swal toast | `services/dialogService.ts` | 用於新增 / 修改 / 刪除交易成功的短通知，外觀沿用 `confirmAction()` 的圓角方形 modal、置中顯示、無背景遮罩、1800ms 自動消失 | 已使用 |
| 全域 toast | `App.tsx` 的 `SuccessToast` / `showToast()` | 短成功訊息、連線狀態、操作摘要 | 通常不適合 |
| 頁內 status | `SettingsPage`（含 `MerchantManagementSection` 的 inline `MerchantFeedbackCard`） | 長訊息、部分成功、同步失敗、預覽提醒、表單流程錯誤 | 通常不適合 |
| inline validation / inline error | `AddTransactionModal` | 可立即修正的表單錯誤、AI 解析錯誤、離線提示 | 不適合 |
| 同步狀態頁 | `SyncStatusPage`、`TransactionItem` | 可回看、可追蹤的同步狀態與單筆錯誤詳情 | 不適合 |
| 全域錯誤面板 | `App.tsx` 的 `ErrorDisplay` / `capturedErrors` | DB、sync、runtime error 等偏除錯資訊 | 不適合 |
| loading / progress UI | `App.tsx`、`Calendar`、`SyncStatusPage` | app 載入、同步中、按鈕 disabled 狀態 | 不適合 |

## 原本 Alert / Confirm 使用點

| 模組 | 原本互動 | 原本文案 / 目的 | 目前處理 | 是否仍需要對話框 |
| --- | --- | --- | --- | --- |
| `AddTransactionModal` | `alert()` | `請輸入有效的數字` | modal 內嵌錯誤提示 | 否 |
| `AddTransactionModal` | `alert()` | `請選擇類別` | modal 內嵌錯誤提示，並以低調紅框標示類別區塊 | 否 |
| `AddTransactionModal` | `alert()` | `請選擇子類別` | 已選主類別但未選子類別時，顯示 modal 內嵌錯誤提示、以低調紅框標示類別區塊並展開子類別選擇區 | 否 |
| `AddTransactionModal` | `confirm()` | 刪除交易前確認 | `confirmAction()` danger dialog | 是 |
| `SettingsPage` | `confirm()` | 覆蓋匯入第一段確認 | `confirmAction()` danger dialog | 是 |
| `SettingsPage` | `confirm()` | 覆蓋匯入第二段確認 | `confirmAction()` danger dialog | 是 |
| `SettingsPage` | `confirm()` | 重複 ID 覆蓋確認 | `confirmAction()` default dialog | 是 |
| `SettingsPage` | `confirm()` | 最終匯入確認 | `confirmAction()`，覆寫為 danger、附加為 default | 是 |
| `SettingsPage` | `confirm()` | 重置本機資料確認 | `confirmAction()` danger dialog | 是 |
| `SettingsPage` | 無 | 插入範例資料前確認 | `confirmAction()` default dialog | 是 |
| `SettingsPage` | 無 | 刪除範例資料前確認 | `confirmAction()` danger dialog（附 HTML 預覽清單） | 是 |

`TODO.md` 與 `docs/cloud-sync-specification.md` 仍有 `alert()` / `confirm()` 字樣，屬於需求或歷史規格描述，不是 runtime 呼叫點。

## 目前 Swal Dialog

以下是目前已改用 `confirmAction()` 的完整清單。

| 頁面 / 元件 | 觸發點 | Dialog title | 主要風險 | tone | 確認後動作 | 取消後動作 |
| --- | --- | --- | --- | --- | --- | --- |
| `AddTransactionModal` | 編輯交易時按下刪除 | `刪除這筆紀錄？` | 交易資料被刪除 | `danger` | 呼叫 `onDelete(editingTransaction.id)`，再關閉 modal | 保留資料並停留在 modal |
| `SettingsPage` | 覆蓋匯入第一段確認 | `覆蓋匯入資料？` | 即將進入清空既有資料流程 | `danger` | 進入第二段覆蓋確認 | 中止匯入 |
| `SettingsPage` | 覆蓋匯入第二段確認 | `再次確認覆蓋匯入` | 既有資料會先被清空且無法復原 | `danger` | 繼續後續匯入檢查 | 中止匯入 |
| `SettingsPage` | 偵測到重複 ID | `偵測到重複 ID` | 既有或檔案內同 ID 資料會被覆蓋 | `default` | 進入最終匯入確認 | 中止匯入 |
| `SettingsPage` | 覆寫匯入最終確認 | `執行覆寫匯入？` | 執行資料覆寫 | `danger` | 清空既有資料後匯入 CSV | 中止匯入 |
| `SettingsPage` | 附加匯入最終確認 | `執行附加匯入？` | 匯入資料，可能包含已確認的覆蓋行為 | `default` | 將 CSV 寫入 IndexedDB | 中止匯入 |
| `SettingsPage` | 重置本機資料 | `重置本機資料？` | 清除 Local Storage 與 IndexedDB | `danger` | 清除本機資料並 reload | 保留資料 |
| `SettingsPage` | 插入範例資料 | `插入範例資料？` | 新增多筆預設範例交易 | `default` | 插入範例資料並觸發既有同步流程 | 不新增資料 |
| `SettingsPage` | 刪除範例資料 | `刪除範例資料？` | 刪除 id 以 `sample-tx-` 開頭的交易（附 HTML 預覽清單） | `danger` | 透過 `bulkDelete()` 刪除符合 prefix 的交易，toast 顯示實際筆數 | 不刪除資料 |

## Toast 盤點

全域 toast 由 `App.tsx` 的 `showToast()` 控制，顯示時間為 1800ms。用途是短句、非阻擋、可消失的摘要。

| 來源 | 文案類型 | 目的 | 建議 |
| --- | --- | --- | --- |
| 連線狀態變化 | `目前為離線模式...`、`已恢復連線...` | 告知連線狀態切換 | 維持 toast |
| 新增交易 | `已儲存新紀錄` | 成功摘要 | 改用 swal auto-dismiss toast |
| 修改交易 | `已儲存修改` | 成功摘要 | 改用 swal auto-dismiss toast |
| 刪除交易 | `已刪除紀錄` | 成功摘要 | 改用 swal auto-dismiss toast |
| 同步設定儲存 | `同步設定已儲存` 或同步失敗摘要 | 操作結果摘要 | 維持 toast，詳細內容留頁內 status |
| 匯出 | `匯出成功` | 成功摘要 | 維持 toast |
| 匯入 | `匯入成功 (...)` 或部分同步失敗摘要 | 操作結果摘要 | 維持 toast，詳細內容留頁內 status |
| 插入範例資料 | `已插入範例資料 (...)` | 成功摘要 | 維持 toast |
| 刪除範例資料 | `已刪除範例資料 (...)` / `目前沒有範例資料可刪除` / `沒有可刪除的範例資料` | 成功摘要或無資料提示 | 維持 toast |
| 商家 / Tag 更名 | 更名成功或同步部分失敗摘要 | 操作結果摘要 | 維持 toast，詳細內容留頁內 status |
| 幣別設定防呆 | `至少要保留一個可用幣別` | 短錯誤提醒 | 可維持 status + toast，不建議 swal |

一般不建議把所有 toast 類訊息都改成 swal，因為它們不需要使用者做決策。交易新增 / 修改 / 刪除成功已正式走 `showAutoDismissToast()`，外觀對齊 `confirmAction()`（圓角方形 modal、置中、無背景遮罩、1800ms 自動消失）。

## 頁內 Status 盤點

頁內 status 主要用於「需要留在上下文中閱讀」的訊息，通常比 toast 長，或需要保留操作後狀態。

| 頁面 | 類型 | 典型情境 | 建議 |
| --- | --- | --- | --- |
| `SettingsPage` | `success` / `error` / `idle`（可選 `action`） | 同步設定儲存後離線、同步部分失敗、Tag 更名結果、匯出 / 匯入錯誤、CSV 預覽錯誤、重置錯誤；同步設定儲存、Tag 更名、商家更名、CSV 匯入若有 `failed > 0` 會附帶「查看同步狀態」按鈕 | 維持頁內 status |
| `MerchantManagementSection`（`SettingsPage` 子頁內 inline） | `success` / `error` / `idle` + feedback card tone（可選 `action`） | 商家預覽錯誤、商家更名預覽資訊、合併警告、商家更名離線或同步失敗、讀取商家項目失敗；商家更名部分失敗時 feedback card 會附帶「查看同步狀態」按鈕 | 維持頁內 feedback card |
| `SyncStatusPage` | persistent list/detail | 待同步 / 同步中 / 失敗 / 已同步統計，單筆 `lastSyncError` 詳情 | 維持頁面呈現 |
| `AddTransactionModal` | persistent item status | 編輯單筆交易時顯示該筆同步狀態，`pending` / `error` 可點左側圖示單筆上傳，`error` 會顯示 `lastSyncError` 摘要 | 維持 modal 內嵌狀態 |

頁內 status 不適合全面改成 swal。這些訊息多半需要使用者回看、修正欄位、或理解部分成功狀態，放在頁面內比 dialog 更穩定。

## Inline Error / Inline Warning 盤點

| 頁面 / 元件 | 情境 | 目前呈現 | 建議 |
| --- | --- | --- | --- |
| `AddTransactionModal` | 金額空白或非數字 | modal 上方內嵌紅色錯誤框並 shake、金額欄位紅框 pulse；重複按儲存會重新觸發動畫，`prefers-reduced-motion` 啟用時停用動畫 | 維持 inline |
| `AddTransactionModal` | 未選類別、已選主類別但未選子類別 | modal 上方內嵌紅色錯誤框並 shake、類別區塊紅框 pulse；子類別錯誤會展開子類別選擇區；重複按儲存會重新觸發動畫，`prefers-reduced-motion` 啟用時停用動畫 | 維持 inline |
| `AddTransactionModal` | AI 解析失敗 | AI 輸入框下方紅色文字 | 維持 inline |
| `AddTransactionModal` | 離線時 AI 不可用 | AI 輸入框下方 amber 提示 | 維持 inline |
| `AddTransactionModal` | 交易同步狀態 | 編輯模式底部顯示待同步 / 同步中 / 已同步 / 同步失敗；待同步與同步失敗可點左側圖示觸發單筆上傳，離線或同步中時 disabled | 維持 inline |
| `SyncStatusPage` | 離線時不能同步 | 頁面上方 amber 提示，右上同步按鈕 disabled | 維持 inline |
| `TransactionItem` | 單筆同步狀態 | 狀態點與 title / aria-label | 維持 inline |

這類訊息與目前畫面操作強相關，使用者通常要直接修正或理解當下狀態，不應改成 swal。

## 全域錯誤與同步錯誤

| 機制 | 來源 | 用途 | 建議 |
| --- | --- | --- | --- |
| `ErrorDisplay` | `capturedErrors` | DB load/init/add/update/delete、sync error、runtime error、unhandled rejection | 保留為 debug overlay，不改 swal |
| `lastSyncError` | `syncPendingTransactions` / `syncCreateItems` 結果 | 單筆同步失敗詳情 | 保留在 `SyncStatusPage` 中可回看，並在交易編輯頁的同步失敗區塊顯示摘要 |
| `syncProgressUI` | `runSyncWithProgress()` | 同步中狀態、首頁同步 icon、同步頁按鈕 disabled | 保留 progress UI，不改 swal |

同步與 debug 訊息不適合 swal，因為錯誤可能很多筆、需要回看、也可能在背景流程產生。設定頁的同步部分失敗狀態已附帶「查看同步狀態」按鈕，可直接跳到同步狀態頁查看失敗交易與錯誤詳情；後續若要再改善，方向應該是擴充錯誤摘要或加更多就地操作入口，而不是改成 blocking dialog。

## 其他適合評估改用 Swal 的地方

以下不是本次已改項目，但可列為後續候選。原則是：只有會造成批次資料異動、資料合併、資料污染，且目前缺少明確最後確認的流程，才值得考慮。

| 候選流程 | 目前機制 | 為什麼可考慮 swal | 建議優先度 |
| --- | --- | --- | --- |
| `MerchantManagementSection` 執行商家更名 | 預覽 + 頁內 feedback card | 會批次更新多筆交易；若新商家已存在，實際上會合併商家 | 中 |
| `SettingsPage` 執行 Tag 更名 | 預覽 + 頁內 status | 會批次更新多筆交易；若新 tag 已存在，實際上會合併並去重 | 中 |
| 匯入 append 且偵測到重複 ID | 已有 swal default dialog | 會覆蓋同 ID 資料，目前使用 default tone | 低，若要更保守可改 `danger` |

不建議改用 swal 的地方：

| 流程 | 原因 |
| --- | --- |
| 匯出成功 | 無需決策，toast 足夠 |
| 離線 / 上線提示 | 狀態變化提示，不應阻擋操作 |
| 同步失敗摘要 | 需要可回看與可追查，應導向同步狀態頁 |
| CSV 預覽錯誤 | 使用者需要回到設定頁選檔或看預覽狀態，頁內 status 較合適 |
| AI 解析失敗 | 使用者需要直接修改輸入或重試，inline error 較合適 |

## 後續規範

- 表單驗證錯誤：使用頁內或 modal 內嵌錯誤，不新增 `window.alert()`。
- 危險操作或不可逆操作：使用 `confirmAction()`，不新增 `window.confirm()`。
- 成功訊息：使用非阻擋 toast；交易新增 / 修改 / 刪除成功目前走 `showAutoDismissToast()`，其他短摘要維持 app toast。
- 長訊息或可回看的操作結果：維持使用頁內 status 或專門頁面，不使用 dialog。
- 只有需要使用者明確選擇「繼續 / 取消」的流程，才使用 confirmation dialog。
- 若未來真的需要資訊型 blocking dialog，應新增共用 `showAlert()` helper，不直接呼叫 `Swal.fire()`。

## 掃描指令

查看原本 `HEAD` 的 native 使用點：

```sh
git grep -n -E "alert\\(|confirm\\(" HEAD -- components App.tsx services docs TODO.md
```

查看目前實作後的 dialog / feedback 入口：

```sh
rg -n "confirmAction|showAutoDismissToast|Swal\\.fire|showToast|onNotify|setStatus|capturedErrors|lastSyncError|validationErrors|aiError" App.tsx components services
```

查看目前是否仍有原生 runtime 呼叫：

```sh
rg -n "\\balert\\s*\\(|\\bconfirm\\s*\\(" components App.tsx services
```

預期結果：`components`、`App.tsx`、`services` 中不應再出現原生 `alert()` 或 `confirm()`。
