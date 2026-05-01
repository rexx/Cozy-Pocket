# PWA Precache 與 Lazy Chunk 評估計劃

本項目實作時會使用新的 git worktree 進行開發，不直接修改目前 repo 根目錄；建議 worktree 路徑為 `worktrees/pwa-precache-lazy-chunks`，完成後再由該分支提交與合併。

## 摘要

- 評估 PWA precache 對 lazy chunk 的實際影響。
- 目標是釐清 lazy load 對首屏下載與 service worker 安裝快取總量的不同影響。

## 關鍵變更

- 檢查 Workbox precache 清單，確認新拆出的 lazy chunk 是否仍被預快取。
- 分別記錄 initial load chunk 與 precache total。
- 若 lazy chunk 仍被預快取，補充這對首次安裝、離線可用性與後續頁面切換的影響。

## 測試計劃

- 執行 `npm run build`。
- 檢查 build output 中的 service worker / precache manifest。
- 在瀏覽器驗證首次載入與 service worker 安裝後的 network 行為。
- 比較 initial load 下載量與 precache total，避免只看主 bundle 下降。

## 假設

- 專案仍維持 PWA 離線優先策略，因此 lazy load 的收益需要同時看 initial load 與 precache 成本。
