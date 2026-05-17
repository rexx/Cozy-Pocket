# 同步部分失敗狀態按鈕紀錄

## 摘要

- 設定頁在同步部分失敗時，頁內狀態訊息會直接附帶「查看同步狀態」按鈕，可一鍵跳到同步狀態頁查看失敗交易與錯誤詳情。
- Toast 維持短摘要，詳細處理入口集中在頁內 status 卡片內，避免使用者必須再到同步設定才能進入同步狀態頁。
- 覆蓋四個同步可能部分失敗的場景：同步設定儲存、Tag 更名、商家更名、CSV 匯入。

## 關鍵變更

- 新增 `components/settings/settingsStatus.ts`，定義共用的 `SettingsStatus` / `SettingsStatusAction` 型別與 `idleStatus` 預設值，讓設定頁狀態訊息可選擇性帶入 action label 與 callback。
- `SettingsPage` 的 status state 改用 `SettingsStatus`，並在 `saveSyncConfig`、`handleRenameTag`、`handleRenameMerchant`、`importFromPreview` 四個 `failed > 0` 分支注入 `openSyncProgressAction`，action 點擊呼叫既有的 `onOpenSyncProgress`。
- `renderStatusMessage` 在 status 帶 action 時加上「查看同步狀態」按鈕（`CloudUpload` icon），並依 success / error tone 套不同顏色；窄螢幕時按鈕會自動換行到下方。
- `MerchantManagementSection` 的 `status` prop 改用共用 `SettingsStatus`；`MerchantFeedbackCard` 新增 `action?: SettingsStatusAction`，於 error / success / warning 三種 tone 下統一渲染按鈕，讓商家更名失敗訊息也能附帶同步狀態入口。

## 介面與型別

- `SettingsStatus { type: 'success' | 'error' | 'idle'; message: string; action?: SettingsStatusAction }`。
- `SettingsStatusAction { label: string; onClick: () => void }`。
- 既有同步 API 回傳格式（`{ total, failed, skippedOffline }`、`PullReport`）未變動。
- `App.tsx` 既有的 `openSyncStatusFrom('settings')` + `setSyncReturnView` 機制已支援從設定頁進入同步狀態頁後返回設定子頁，無需額外調整。

## 驗證

- 執行 `npm run build`（tsc strict + Vite production build 通過）。
- 透過暫時把 mock cloud 失敗率拉高到 60% 的方式，依序在四個場景觸發部分失敗，確認頁內狀態都出現「查看同步狀態」按鈕，且按鈕點擊後正確進入 `SyncStatusPage`、返回時回到原本的設定子頁。
- 全部成功、離線跳過、未設定同步 config 的情境下，頁內狀態文案不會出現按鈕，文案維持原本的成功 / 離線提示。

## 範圍

- 本次僅針對既有「部分失敗」的頁內狀態訊息，不新增錯誤列表 modal 或重試流程；詳細追蹤與重試仍由 `SyncStatusPage` 主導。
- 年度雲端同步（pull from cloud）已會直接跳到 `PullReportsPage` 顯示報告，因此本次不在該流程加同步狀態按鈕。
