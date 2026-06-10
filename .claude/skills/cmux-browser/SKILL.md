---
name: cmux-browser
description: >-
  Drive the cmux built-in browser via the `cmux browser` CLI to interactively
  verify a local frontend dev server — open a surface, navigate, click, fill
  forms, snapshot the DOM, screenshot, and read console errors. Use when
  verifying front-end changes in a browser inside a cmux session (typically
  after /start-local-server), when the user says "用 cmux 瀏覽器測試 / 驗證",
  "open cmux browser", "test this in the browser", or whenever you need to
  actually exercise a UI flow (click → fill → assert) instead of a curl smoke
  test. Encodes the known cmux footguns: commands need an escalated sandbox,
  button labels live in aria-label, SPA re-render timing, React controlled
  inputs need fill/type, swal2 dialogs, and avoiding `!` inside eval JS.
---

# cmux 內建瀏覽器自動化

用 `cmux browser` CLI 操作 cmux app 的內建瀏覽器，對 local dev server 做**互動式**驗證（導航、點擊、填表、snapshot、screenshot、讀 console error）。這是 SPA 唯一可行的瀏覽器驗證路徑——`curl` 只能拿到 SPA 空殼，驗不出互動。

## 前置條件

- dev server 必須已在跑。本專案先 invoke `/start-local-server`（從 feature worktree 啟動），拿到 Local URL（例如 `http://localhost:5173/Cozy-Pocket/`）。
- `cmux` CLI 路徑：`/Applications/cmux.app/Contents/Resources/bin/cmux`，通常已在 PATH。`command -v cmux` 確認。

## 最高原則：所有 `cmux browser` 指令都要提權

cmux 是 host GUI app，CLI 透過 local socket 跟它通訊。sandbox 會擋掉，導致 `not_found` 或連線失敗。**每個 `cmux browser ...` 的 Bash tool call 都直接帶 `dangerouslyDisableSandbox: true`**，省一輪 sandbox-fail → retry。

## 基本流程

```bash
# 1. 開一個 browser surface 指向 local server（--focus true 讓它跑到前景）
cmux browser open "http://localhost:5173/Cozy-Pocket/" --focus true
#   → OK surface=surface:8 pane=pane:3 placement=reuse   ← 記下 surface:N

# 2. 列出 / 確認現有 surface（沒有 browser surface 時回 not_found）
cmux browser identify

# 3. 等載入完成，確認 URL 與 console
cmux browser surface:8 wait --load-state complete --timeout 15
cmux browser surface:8 get url
cmux browser surface:8 errors list        # 'No browser errors' = 乾淨

# 4. 看畫面有哪些可互動元素（compact 省 token）
cmux browser surface:8 snapshot --interactive --compact --max-depth 25
```

之後所有指令都帶 `surface:N`（positional）或 `--surface surface:N`。

## 互動指令速查

| 動作 | 指令 |
|---|---|
| 導航 | `cmux browser <s> navigate "<url>"` / `back` / `forward` / `reload` |
| 等待 | `cmux browser <s> wait [--load-state complete] [--selector <css>] [--text <t>] [--function <js>] --timeout <秒>` |
| 快照 | `cmux browser <s> snapshot --interactive --compact [--max-depth N] [--selector <css>]` |
| 執行 JS | `cmux browser <s> eval "<js>"`（回傳值會被印出） |
| 點擊 | `cmux browser <s> click --selector "<css>"`（真實滑鼠事件） |
| 填值 | `cmux browser <s> fill --selector "<css>" --text "<v>"` / `type`（逐字） |
| 按鍵 | `cmux browser <s> press --key "Escape"` |
| 讀取 | `cmux browser <s> get <url\|title\|text\|html\|value\|count> [--selector <css>]` |
| 截圖 | `cmux browser <s> screenshot --out <path>` |
| Console | `cmux browser <s> console list` / `errors list` |

完整子指令：`cmux browser --help`。

## 踩過的坑（重要）

1. **button 名稱常在 `aria-label` / `title`，不是 `textContent`。**
   icon-only button 的 `textContent` 是空字串。先 dump 屬性再決定 selector：
   ```bash
   cmux browser <s> eval "JSON.stringify([...document.querySelectorAll('button')].map(b=>({t:b.textContent.trim(), al:b.getAttribute('aria-label'), ti:b.getAttribute('title')})))"
   ```
   找到後用 `document.querySelector('button[aria-label=\"資料管理\"]').click()`，不要用 `textContent.includes(...)`。

2. **SPA state transition 後要等 re-render。**
   eval `.click()` 觸發 React state change 後，**同一批指令**裡接著 eval 讀 DOM 會讀到舊畫面（re-render 還沒發生）。對策：把點擊與斷言拆成**不同的 Bash tool call**（call 之間自然有時間差），或在點擊後 `wait --function`/`wait --selector`，或先 eval 抓 `document.querySelector('h1,h2')?.textContent` 確認已到目標頁再繼續。

3. **React controlled input 一定用 `fill` / `type`，不要 eval 設 `.value`。**
   直接設 `.value` 不會觸發 React 的 onChange，畫面 state 不更新。`cmux browser <s> fill --selector "input[...]" --text "新值"` 走真實 input 事件，React 才會收到。填完用 eval 確認 `document.querySelector(...).value` 與按鈕 `disabled` 狀態。

4. **cmux 原生 `click` 比 eval `.click()` 可靠。**
   某些元素（實測：`PageHeader` 的 icon-only 返回鍵）用 eval `.click()` 不生效，改用 `cmux browser <s> click --selector "<css>"`（合成真實滑鼠事件）就會動。卡片類 textContent 按鈕兩者都可。

5. **swal2 對話框不是原生 dialog。**
   `cmux browser <s> dialog accept` 只對 `window.confirm/alert` 有效。專案的 `confirmAction()` 用 sweetalert2，要點 DOM：
   ```bash
   cmux browser <s> eval "document.querySelector('.swal2-confirm')?.click(); 'ok'"   # 確認
   cmux browser <s> eval "document.querySelector('.swal2-cancel')?.click(); 'ok'"    # 取消
   ```
   先 `wait --selector ".swal2-popup"` 等它彈出。

6. **`wait --text` 比對很挑（中文 / 巢狀文字常 timeout）。** 別依賴它判斷頁面到位；改用 eval 斷言 `document.body.innerText.includes('...')` 或特定 selector 存在性（例如 `document.querySelector("input[placeholder='輸入新的商家名稱']") === null ? 'cleared' : 'present'`）。

7. **eval 的 JS 裡避免 `!`。** Bash hook 會把 `!` escape 成 `\!`（連單引號 / heredoc 內也一樣），破壞 `!x`、`!!x`。改寫成 `=== null` / `=== false` / 三元 `x ? a : b`。

8. **eval 只跑 main frame。** 頁面有 iframe 時先 `cmux browser <s> frame <main|selector>`。先用 `document.querySelectorAll('iframe').length` 確認。

## 斷言與收尾

- 用 eval 把要驗的事實一次抓成 JSON 回傳，例如 status 訊息、清單筆數、表單是否出現：
  ```bash
  cmux browser <s> eval "JSON.stringify({status: document.body.innerText.match(/已將[^\\n]*/g), chip:[...document.querySelectorAll('button')].map(b=>b.textContent.trim()).find(t=>t.includes('孝親費'))})"
  ```
- 每段流程結束跑 `cmux browser <s> errors list` 確認 console 無新錯誤。
- 需要視覺證據時 `screenshot --out /tmp/claude/<name>.png` 再用 Read 看圖。

## Cozy-Pocket 範例：驗證 tag 更名

```bash
# 乾淨環境沒有 tag/商家 → 先到「危險操作」插入範例資料（會跳 swal2，點 .swal2-confirm）
# 進設定：點 aria-label 按鈕
cmux browser <s> eval "document.querySelector('button[aria-label=\"資料管理\"]').click(); 'ok'"
# 進 Tag 管理卡片（textContent 按鈕）→ 下一個 call 再斷言（等 re-render）
cmux browser <s> eval "[...document.querySelectorAll('button')].find(b=>b.textContent.trim().startsWith('Tag 管理'))?.click(); 'ok'"
# 選 tag → fill 新名稱 → 點預覽 → 等預覽卡 → 點確認 → 斷言 status / chip
cmux browser <s> fill --selector "input[type=text]" --text "新名稱"
cmux browser <s> eval "[...document.querySelectorAll('button')].find(b=>b.textContent.includes('預覽影響筆數'))?.click(); 'ok'"
cmux browser <s> errors list
```

## 注意事項

- 一個 surface 重用即可；不要每步重開。亂點導致跑到非預期頁面時，`navigate "<base-url>"` reload 回起點重來。
- 驗證會動到本機 IndexedDB（插入範例資料、改 tag/商家）。範例資料是 `sample-tx-` prefix，可在「危險操作 → 刪除範例資料」清除。
- 完成後若不再需要可留著 surface 讓使用者自己看；不需主動關閉。
