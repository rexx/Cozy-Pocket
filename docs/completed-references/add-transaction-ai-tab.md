# 新增交易 AI tab 化完成紀錄

本項目把原本固定置於新增交易頁頂端的「AI 快速填寫」輸入區，改為與「支出」、「收入」並列的第三個 tab；只在 AI tab 才顯示 AI 輸入區，切到 AI tab 時自動 focus 輸入框，並把「AI 已填入」摘要搬到 scroll 區頂端讓所有 tab 都看得到。

## 完成內容

### `components/AddTransactionModal.tsx`

- 新增本檔內部用的 union 型別 `ModalTab = TransactionType | 'AI'`，`activeTab` / `setActiveTab` 改為 `ModalTab`。
- Tab 列改為動態組成：`hasApiKey && !isEditing` 時為 `['支出', 'AI', '收入']`（AI tab 夾在中間），否則維持 `['支出', '收入']`。
- AI tab 按鈕本體只渲染 `Sparkles` icon（`size={18}`），不含文字；用 `flex-none px-6` 控制寬度，避免擠壓支出／收入兩個 `flex-1` tab 的版位；active 時 icon 用 `text-cyan-300`、底色 underline 採 `bg-cyan-400 shadow-cyan-400/30`，加上 `aria-label="AI 快速填寫"` 提供無障礙語意。
- `handleTabChange` 改為接受 `ModalTab`：切到 AI tab 不重置任何表單 state；從 AI tab 切回支出／收入時也不清除類別、金額等欄位；只有支出 ↔ 收入的切換才走原本的 reset 邏輯（重置 sub view、清掉 category 驗證錯誤、若非編輯模式清掉 categoryId / subCategoryId）。
- 新增 `aiInputRef = useRef<HTMLInputElement>(null)` 並以 `useEffect` 監看 `activeTab`：當 `activeTab === 'AI'` 時呼叫 `aiInputRef.current?.focus()`，讓使用者切到 AI tab 即可直接輸入。`useLayoutEffect` 對 amount 的初次 focus 行為維持不變。
- AI 輸入區的 wrapper（含 SVG 流動邊框 form、`Sparkles` icon、send 按鈕、離線提示與 `aiError`）改為只在 `activeTab === 'AI'` 時渲染；原本「`hasApiKey && !isEditing` 一定顯示」的條件不再使用。
- 「AI 已填入：⋯」success / warning feedback 從 AI 區塊內搬到 scroll 區頂端，與 `activeTab` 解耦：AI 解析成功 → tab 自動切回支出／收入 → 使用者在表單頂端就能直接看到 AI 填了哪些欄位，不必再切回 AI tab 才能看到摘要。
- `handleAiSubmit` 對 `result.type` 的 fallback 加入 `activeTab === 'AI'` 防呆：fallback type 從 `activeTab` 改為 `activeTab === 'AI' ? '支出' : activeTab`，避免 AI 回傳無效 type 時 `activeTab` 卡在 `'AI'`。
- 右上角的儲存（Check）按鈕在 `activeTab === 'AI'` 時隱藏（`rightSlot` 變成 `null`），避免使用者誤觸尚未填妥的儲存。
- `handleSubmit` 在開頭加 early return guard `if (activeTab === 'AI') return;` 並把 `activeTab` narrow 為本地常數 `transactionType: TransactionType`，作為 `Transaction.type`、multiplier 與類別驗證的單一來源，繞開 `ModalTab` 對 `Transaction.type` 的型別不匹配。
- 表單區（驗證錯誤卡、類別選擇、付款方式 + 金額、商家 + 名稱、日期 + 時間、tag、備註，以及編輯模式的複製／刪除／同步狀態卡）整段包進 `activeTab !== 'AI' && (<>...</>)` 條件，AI tab 上只剩 AI 輸入框與摘要，避免兩邊內容同時出現造成混淆。

## 介面與資料

- `TransactionType`（`types.ts`）維持 `'支出' | '收入'`，未變動。
- `ModalTab` 為 `AddTransactionModal.tsx` 內部型別，不對外匯出，不影響 `Transaction` 資料模型或其他元件。
- `Transaction.type` 寫入時仍只會是 `'支出' | '收入'`：寫入點 `handleSubmit` 已對 AI tab early return，且型別 narrow 過。
- `services/geminiService.ts` 與 AI 解析回傳的 schema 未變動。

## 驗證

- 已執行 `npm run build`，`tsc --strict` 與 Vite production build 均通過。
- 手動驗證：
  - 有 Gemini API key、非編輯模式：tab 列顯示「支出 / `Sparkles` / 收入」三個 tab，AI tab 夾在中間，預設 active 為「支出」。
  - 切到 AI tab：表單區整段隱藏、右上角 Check 按鈕隱藏；AI 輸入框可見並自動取得 focus。
  - 在 AI tab 輸入文字並送出，AI 回傳 `type=支出`：tab 自動切到「支出」、表單恢復顯示、AI 填入欄位帶 cyan 邊框，且表單頂端出現「AI 已填入：⋯」摘要可見。
  - AI 回傳 `type=收入`：tab 自動切到「收入」，類別 / 金額 / 商家等正確填入。
  - AI 回傳的 type 無法辨識：tab fallback 為「支出」（不再卡在 `'AI'`），摘要的 warning 文案出現在表單頂端。
  - 沒設 Gemini API key、或進入編輯既有交易：tab 列只剩「支出 / 收入」，無 AI tab。
  - 在支出 tab 輸入金額、選類別後切到 AI tab → 切回支出 tab：原本輸入與類別選擇保留。
  - 支出 ↔ 收入 直接切換：類別仍依既有規則重置（非編輯模式才清空）。
  - 驗證錯誤（缺金額／類別）後切到 AI tab：紅色錯誤卡隱藏；切回支出／收入時錯誤卡與 pulse 動畫仍在。
  - 離線狀態下切到 AI tab：AI 輸入框與「目前離線」提示同時可見，輸入無法送出。
