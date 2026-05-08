# 刪除範例資料按鈕計劃

本項目實作時會使用新的 git worktree 進行開發，不直接修改目前 repo 根目錄；建議 worktree 路徑為 `worktrees/delete-sample-data-button`，完成後再由該分支提交與合併。

## 摘要

- 在設定頁的危險操作區新增「刪除範例資料」按鈕，讓 demo 或測試後可移除由「插入範例資料」建立的交易。
- 刪除範圍以範例資料專用 id prefix 為準，避免用商家、金額、名稱等相似度誤刪使用者自行建立的交易。
- 第一版只處理本機資料刪除，不處理雲端已同步資料的刪除。

## 關鍵變更

- 插入範例資料時，將新產生的交易 id 改為明確 prefix 格式，例如 `sample-tx-${now}-${idx}-${random}`。
- 在 `App.tsx` 新增刪除範例資料流程：找出 `id` 以 `sample-tx-` 開頭的交易、刪除符合項目、更新 state。
- 在 `SettingsPage` 新增預覽與刪除 props，並於 `DangerZoneSection` 加入刪除按鈕與說明文案。
- 刪除前先預覽將被刪除的交易，至少顯示日期、商家或名稱、金額與筆數摘要。
- 使用既有 `confirmAction()` 或同風格對話框顯示確認，提醒此操作只會刪除 id 具有範例資料 prefix 的交易。
- 刪除完成後使用現有 toast / status 顯示刪除筆數；沒有可刪資料時顯示溫和提示。

## 介面與型別

- 擴充 `SettingsPageProps` 與 `DangerZoneSectionProps`，加入 `onPreviewDeleteExamples: () => Promise<Transaction[]>` 與 `onDeleteExamples: (ids: string[]) => Promise<number>`。
- 不新增 `Transaction` 欄位或 settings key，避免需要 IndexedDB schema migration；以 id prefix 區分範例資料。

## 測試計劃

- 執行 `npm run build`。
- 插入範例資料後確認新交易 id 皆使用 `sample-tx-` prefix，再按刪除範例資料並確認交易被移除。
- 刪除前確認預覽清單只包含 `sample-tx-` prefix 的交易，且摘要資訊足以辨識項目。
- 重複插入多次後刪除，確認所有 prefix 符合的範例交易都被移除。
- 手動刪掉其中一筆範例交易後再執行刪除，確認流程不報錯且回報實際刪除筆數。
- 沒有 prefix 符合項目時按刪除，確認顯示沒有可刪除範例資料，不影響一般交易。

## 假設

- 既有版本曾插入但沒有 `sample-tx-` prefix 的範例資料不會被自動辨識或刪除，避免誤刪真實交易。
- 目前雲端同步規格尚未支援交易 delete/tombstone；若範例資料已同步到 Google Sheet，本功能第一版不會從雲端移除。
