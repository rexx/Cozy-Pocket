# HomePage / Calendar Lazy Chunk 暫不優先紀錄

本項目若未來重新評估並進入實作，會使用新的 git worktree 進行開發，不直接修改目前 repo 根目錄；建議 worktree 路徑為 `worktrees/home-calendar-lazy-chunk`，完成後再由該分支提交與合併。

## 摘要

- 不優先拆 `HomePage` / `Calendar` 成 lazy chunk。
- 原因是兩者屬於首屏必要內容，通常對 initial load 幫助有限。

## 評估重點

- `HomePage` 與 `Calendar` 是目前主要入口，延後載入可能只會把使用者等待時間移到首屏互動前。
- 若未來首頁改成更輕的 shell，或 calendar 變成次要入口，再重新評估拆分收益。

## 驗證方式

- 若重新評估，先建立 bundle baseline。
- 比較拆分前後首頁首次可互動時間、主 chunk 大小與 lazy chunk 載入延遲。
- 確認拆分不影響離線啟動與月曆手勢互動。
