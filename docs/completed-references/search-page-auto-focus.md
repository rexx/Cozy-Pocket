# 搜尋畫面自動 focus 輸入框

## 摘要

- 點下首頁的搜尋按鈕進入搜尋畫面後，搜尋輸入框會在同一個點擊事件內同步取得 focus，並在 iPhone PWA 上一併彈出虛擬鍵盤，使用者進入頁面後可立即輸入。
- 此前 `App.tsx#openSearchPage` 透過 `setActiveView('search')` 後接 `setTimeout(..., 100)` 呼叫 `searchInputRef.current?.focus()`，`setTimeout` 切斷瀏覽器的 user gesture chain，使 iOS Safari / standalone PWA 雖會把 caret 放進輸入框，但不會自動彈出虛擬鍵盤。
- 採用 React 19 提供的 `flushSync` 將 `setActiveView('search')` 同步 commit，使 `SearchPage` 立即掛載；接著在同一個 click handler 的同步流程裡呼叫 `searchInputRef.current?.focus()`，讓 focus 仍處於原本 user gesture 的同步 call stack 上，符合 iOS 的鍵盤彈出條件。

## 關鍵變更

- `App.tsx`
  - 新增 `import { flushSync } from 'react-dom'`。
  - 改寫 `openSearchPage`：以 `flushSync(() => setActiveView('search'))` 同步切換 view，再立即 `searchInputRef.current?.focus()`，移除原本的 `window.setTimeout(..., 100)`。
- `SearchPage.tsx` 未變動，`searchInputRef` 仍由 `App.tsx` 擁有並透過 props 傳入。

未變更：
- `searchInputRef` 的擁有者位置。
- `SearchPage` 其餘 props 與行為。
- 輸入框的 `inputmode`、placeholder、樣式。

## 介面與型別

- 沒有新增型別。
- `SearchPageProps` 維持不變。
- `openSearchPage` 仍為 `() => void`，僅實作改動。

## UI 細節

- 進入搜尋畫面後，搜尋輸入框立刻顯示焦點：`focus:border-cyan-500` 邊框亮起、caret 在輸入框內。
- iPhone PWA：軟體鍵盤同步彈出，沒有 100ms 視覺延遲，亦不需要再點一次輸入框。
- 桌面瀏覽器：caret 立即進入輸入框，可直接打字。
- 不引入動畫或 placeholder 變化，PageHeader 與既有過場視覺不受影響。

## 驗證

- 在 worktree 內執行 `npm run build`，通過 tsc strict + Vite production build。
- 桌面 Microsoft Edge 手動驗證：
  - 從首頁點搜尋按鈕，輸入框 caret 立刻可見，輸入即可生效。
  - 從搜尋畫面返回首頁，再次點搜尋按鈕，仍能立即聚焦。
  - 搜尋畫面下其他 overlay（同步 toast 等）不會搶走 focus。

## 假設與限制

- 採用 React 19 的 `flushSync`，可在 click handler 中強制同步 commit 並讓 `searchInputRef.current` 立即指向實體 DOM 節點。
- 原本的 100ms `setTimeout` 並非語意性延遲，只是為了等待 React render 完成；改用 `flushSync` 後即可立即 focus，因此可以放心移除。
- iOS PWA 真機鍵盤彈出取決於 user gesture chain 是否中斷；此次改動讓 focus 留在原本 click 的同步 call stack 上，符合 iOS 規則。
