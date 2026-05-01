# Bundle Size Baseline 實作計劃

本項目實作時會使用新的 git worktree 進行開發，不直接修改目前 repo 根目錄；建議 worktree 路徑為 `worktrees/bundle-size-baseline`，完成後再由該分支提交與合併。

## 摘要

- 建立 bundle size baseline 與驗收門檻。
- 目標是避免只憑感覺判斷 bundle 優化是否有效。

## 關鍵變更

- 每次優化前後記錄主 `index-*.js` raw / gzip 大小。
- 記錄總 PWA precache 大小與主要 chunk 列表。
- 在 TODO 更新或 PR 描述中列出優化前後數字，並說明變化是否符合預期。
- 評估是否新增輕量 script 或文件化手動流程，讓後續比較方式一致。

## 測試計劃

- 執行 `npm run build`。
- 確認 baseline 可重複產出且欄位清楚。
- 驗證同一次 build 產物的主要 chunk 名稱、raw size、gzip size 與 precache total 都有紀錄。

## 假設

- 第一版可以先用文件化紀錄，不一定要立刻加入 CI gate。
