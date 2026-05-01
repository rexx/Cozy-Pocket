# Lucide React 進一步拆分暫不優先紀錄

本項目若未來重新評估並進入實作，會使用新的 git worktree 進行開發，不直接修改目前 repo 根目錄；建議 worktree 路徑為 `worktrees/lucide-react-further-splitting`，完成後再由該分支提交與合併。

## 摘要

- 不優先把 `lucide-react` 再切得更碎。
- 原因是目前已從 wildcard import 改成明確 icon map，後續收益有限。

## 評估重點

- 目前 icon import 已經比 wildcard import 更可控。
- 若繼續拆分，需要確認是否真的能降低主 chunk，而不是增加 chunk 管理複雜度。
- 若未來新增大量低頻圖示頁面，可再評估 page-level icon lazy load。

## 驗證方式

- 若重新評估，先比較目前 lucide 相關 chunk / module size。
- 驗證拆分後主 chunk 是否有明顯下降。
- 確認圖示載入不會造成按鈕尺寸跳動或短暫缺圖。
