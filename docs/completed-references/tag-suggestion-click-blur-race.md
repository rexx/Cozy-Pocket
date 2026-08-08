# Tag 建議點擊被 blur 搶先的修正紀錄

**成果：** 在 tag 輸入框打了部分文字後點建議 chip，得到的是「點到的建議」而不是「已輸入的片段」。

**範圍：** 修正 `AddTransactionModal` 內 `SuggestionChips` 與 tag 輸入框的事件順序衝突：chip 的 pointer 互動不再觸發輸入框 blur，選取建議時一併清掉未確認的輸入片段。建議排序演算法與 tag 儲存格式未變動。

---

## 摘要

- 原本的現象：tag 輸入框輸入「永」後點建議 `#永豐`，結果只加入 `#永`，點到的 `#永豐` 沒有進入 tag 列表。
- 成因：tag 輸入框綁了 `onBlur={addTag}`。點 chip 的 mousedown 先讓輸入框失焦 → `addTag()` 把片段「永」提交成 tag 並清空 `tagInput` → `tagSuggestions` 依新的 `tagInput` 與 `tagList` 重算 → 被點的 chip 已卸載或位移，該次 click 的 `onSelect` 不再觸發。
- 這是 blur-before-click 的事件順序競爭，不是建議排序或比對邏輯的問題。
- 採用的行為：點建議只加入點到的建議，**丟掉**已輸入的片段，輸入框清空並保持 focus。
- 商家與名稱建議共用同一個 `SuggestionChips`，但那兩個輸入框沒有 `onBlur` 提交行為，原本就沒有此症狀；修正一併套用，順帶消除了點 chip 時的 focus 跳動。

## 變更內容

- `components/AddTransactionModal.tsx`
  - `SuggestionChips` 的 chip `<button>` 同時攔截 `onPointerDown` 與 `onMouseDown` 並呼叫 `preventDefault()`，讓點擊不把 focus 從輸入框移走，因此不觸發 `onBlur={addTag}`；click 是唯一的選取入口。取消 `pointerdown` 在符合規範的瀏覽器上會連帶抑制相容性 `mousedown`，`onMouseDown` 這道防線是為了涵蓋仍然送出 `mousedown` 的引擎。
  - tag chip 的 `onSelect` 除了把值加入 `tagList`，同時 `setTagInput('')`，明確丟掉未確認的片段。
  - `addTag()`／`handleTagKeyDown()`／送出時的 `finalTagList` 收尾邏輯維持不變：使用者按 Enter、空格分隔、或直接送出表單時，片段仍照舊被提交。
  - 真正離開輸入框（點畫面其他區域、切 tab）時 `onBlur={addTag}` 的行為不變。

## 介面與型別

- `SuggestionChips` 的 props 未變動（`items` / `onSelect` / `formatValue` / `tone`），只在內部 button 上新增事件處理。
- `getRankedSuggestions` 與 `suggestions.tags` 的來源、排序策略（`recency`）與排除集合邏輯都未修改。

## UI 細節

- 點 chip 後輸入框保持 focus 且為空，使用者可直接接著輸入下一個 tag，不需再點一次輸入框。
- 選取後建議列會因 `excluded` 更新而重排，這是預期行為，列表不凍結。
- 已在 `tagList` 中的 tag 不出現在建議列（沿用既有 `excluded` 行為）。
- chip 的顏色、尺寸、`active:scale-95` 與橫向滑動行為皆未變動。

## 驗證

- 自動檢查：`npm run build`（tsc strict + Vite production build）與 `npm run docs:check` 皆通過。
- 手動檢查：輸入片段後點建議、不輸入直接點建議、輸入片段後按 Enter、輸入多個空格分隔 tag、輸入片段後讓輸入框失焦（片段仍被提交）、連續點兩個建議；另加商家與名稱建議點擊填值的回歸，以及編輯既有交易時載入的 tag 不受影響。
- 主要驗收裝置為 iPhone standalone PWA。

### cmux 無法驗證此類修正

驗證過程中確認了一個非顯而易見的限制：`cmux browser <surface> click` 送出的是程式合成的事件，`preventDefault()` 沒有 default action 可取消。以隔離對照實驗（一個 input 加一個在 `pointerdown` 呼叫 `preventDefault()` 的 button）測得的序列為 `pointerdown（已 prevented）→ mousedown → input blur → click`，focus 仍然移到 button 上；真實瀏覽器則會抑制相容性 `mousedown` 與 focus 轉移。

因此在 cmux 中執行「輸入片段後點建議」必然觀察到 blur 先發生，該結果是測試工具的產物，不能當作修正失效的證據。cmux 仍可驗證不依賴 default action 抑制的路徑（建議填值、Enter 提交、空格分隔提交、失焦提交），這些在 cmux 中皆通過；核心的 focus 保留行為改在真實瀏覽器與 iPhone 上驗收。
