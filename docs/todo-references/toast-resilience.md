# 全域 Toast 韌性改善計劃

本項目實作時會使用新的 git worktree 進行開發，不直接修改目前 repo 根目錄；建議 worktree 路徑為 `worktrees/toast-resilience`，完成後再由該分支提交與合併。

## 摘要

- 改善全域 toast 元件，讓它能穩定承接稍長摘要。
- 支援兩行換行或依訊息長度調整顯示時間，避免文字被截斷或閃太快。
- 保持 toast 是短回饋，詳細內容仍放頁內 status 或同步狀態頁。

## 關鍵變更

- 調整 `App.tsx` 的 `SuccessToast`，移除過度限制的 `whitespace-nowrap` 或加入 max-width 與 line clamp。
- 將 `showToast` timeout 從固定 1800ms 改為依字數計算，設定合理上下限。
- 重新命名 toast 元件使其不只代表 success，或新增 tone 支援未來 info/error。
- 確保 toast 在底部 floating action button 附近不遮擋主要操作。

## 介面與型別

- 可能將 toast state 從單一 string 改為 `{ message: string; tone?: ToastTone }`。
- 若只處理長度與換行，可先不新增 tone。

## 測試計劃

- 執行 `npm run build`。
- 手動觸發短訊息、兩行訊息與較長同步摘要，確認 toast 可讀且不溢出。
- 檢查手機窄寬、桌面寬度與 safe-area 下 toast 不遮住底部關鍵按鈕。
- 驗證連續觸發 toast 時前一個 timer 會被正確清除。

## 假設

- Toast 仍是暫時提示，不提供手動關閉或操作按鈕。
