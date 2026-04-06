# 待辦事項

## 整體建議順序

1. 🔴 支援商家更名，並確認既有交易紀錄、搜尋、統計與同步資料都能一致反映新名稱。
2. ✅ `SettingsPage` 已拆成單頁區段元件：偏好設定、同步設定、Tag 管理、匯入匯出與危險操作區，並完成視覺一致化。
3. ✅ `SyncStatusPage` 已支援預設隱藏已成功項目的篩選，讓使用者聚焦尚未處理或失敗的資料。
4. 🔴 提供可手動從 cloud 拉資料回本機的功能，作為現有同步流程之外的明確操作入口。
5. 🔴 將 `AddTransactionModal` 中阻擋式的 `alert()` 驗證改為 modal 內的內嵌錯誤提示。
6. 🔴 將 `AddTransactionModal` 中刪除用的 `confirm()` 改為 app 內建的確認 UI，讓互動風格與其他頁面一致。
7. 🟡 將目前已存在的 `Gemini` 相關功能打開並接到可用入口，補齊必要的設定、錯誤提示與使用者回饋。
8. 🟡 新增依類別彙整的統計頁或統計區塊，提供金額與筆數等基礎分析。
9. 🟡 新增依商家彙整的統計頁或統計區塊，方便查看常去商家與消費分布。
10. 🟡 評估是否將 `SettingsPage` 內的 section 進一步升級為獨立 page，讓偏好設定、同步設定、Tag 管理、匯入匯出與危險操作可各自擁有更完整的資訊架構。
11. 🟢 評估為非首頁頁面引入共用 page-shell pattern，讓 layout chrome 維持一致，同時讓 `App.tsx` 持續聚焦於 routing 與 shared state。

## 通知與互動體驗

- 🔴 將 `AddTransactionModal` 中阻擋式的 `alert()` 驗證改為 modal 內的內嵌錯誤提示。
- 🔴 將 `AddTransactionModal` 中刪除用的 `confirm()` 改為 app 內建的確認 UI，讓互動風格與其他頁面一致。
- 🔴 當同步部分失敗時，從頁內狀態訊息提供可直接前往同步狀態頁的操作按鈕。
- 🟡 抽出共用的通知文案與摘要組裝 helper，避免 toast 與頁內狀態訊息逐漸分歧。
- 🟡 擴充 `SettingsPage` 的 status type，不只保留 `success | error | idle`，讓離線提醒與預覽提醒可使用更清楚的 `info` 或 `warning` 語意。
- 🟡 改善全域 toast 元件，讓它能更穩定地承接稍長摘要，例如支援兩行換行或依訊息長度調整顯示時間。
- 🟢 補上通知行為的 UI 測試，至少涵蓋以下情境：
  - 匯入成功時不應重複顯示成功訊息。
  - 同步部分失敗時應顯示短 toast 與詳細頁內狀態。
  - Tag 更名應遵守與匯入、同步設定相同的 toast / status 分工。

### 建議順序
1. `AddTransactionModal` 內嵌驗證
2. app 內刪除確認 UI
3. 通知 helper 抽離
4. status type 精緻化與同步失敗操作按鈕
5. toast 元件優化
6. UI 測試補齊

## 導航與頁面架構

- ✅ 同步狀態頁已支援返回來源感知：從 `SettingsPage` 進入時返回設定頁，從首頁進入時返回首頁。
- ✅ `SettingsPage` 已拆成單頁區段元件，下一步可視需要抽共用 page-shell 或 section state helper。
- 🟡 評估是否將 `SettingsPage` 內的 section 升級成獨立 page，避免單頁設定在功能繼續擴張後再次膨脹。
- 🟡 強化 `SyncStatusPage` 的互動，例如提供只看失敗 / 只看待同步的篩選，以及更清楚的重試導向操作。
- 🟢 評估為非首頁頁面引入共用 page-shell pattern，讓 layout chrome 維持一致，同時讓 `App.tsx` 持續聚焦於 routing 與 shared state。

### 建議順序
1. 評估 `SettingsPage` section page 化
2. `SyncStatusPage` 互動升級
3. 共用 page-shell 整理

## 商家與資料維護

- 🔴 支援商家更名，並確認既有交易紀錄、搜尋、統計與同步資料都能一致反映新名稱。
- 🟡 補齊商家名稱調整的驗證與回饋，避免產生重複商家或名稱變更後的 UI 狀態不一致。

## 統計與分析

- 🟡 新增依類別彙整的統計頁或統計區塊，提供金額與筆數等基礎分析。
- 🟡 新增依商家彙整的統計頁或統計區塊，方便查看常去商家與消費分布。

## 匯入與外部資料

- 🔴 提供可手動從 cloud 拉資料回本機的功能，作為現有同步流程之外的明確操作入口。

## AI 功能

- 🟡 將目前已存在的 `Gemini` 相關功能打開並接到可用入口，補齊必要的設定、錯誤提示與使用者回饋。
