# CDN External 依賴暫不優先紀錄

本項目若未來重新評估並進入實作，會使用新的 git worktree 進行開發，不直接修改目前 repo 根目錄；建議 worktree 路徑為 `worktrees/cdn-external-dependencies`，完成後再由該分支提交與合併。

## 摘要

- 不改走 CDN external 依賴。
- 原因是對目前的 Vite + PWA 架構不划算，會增加部署、快取與離線相容性複雜度。

## 評估重點

- CDN external 會讓 PWA 離線策略、service worker 快取與版本控管更複雜。
- 第三方 CDN 也會增加網路依賴與部署環境差異。
- 目前較務實的方向是先做 page-level code splitting、動態載入與 baseline 管理。

## 驗證方式

- 若重新評估，需同時驗證線上載入、離線啟動、service worker 更新與快取失效行為。
- 比較 CDN external 前後的 initial load、precache total 與可用性風險。
- 確認部署環境允許外部 CDN 且符合專案安全與隱私要求。
