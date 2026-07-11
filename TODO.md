# 待辦事項

尚未完成的項目。狀態標記：🔴 高優先 / 🟡 規劃中 / 🟢 已評估暫緩。已完成的項目移到 [CHANGELOG.md](CHANGELOG.md)。

## 通知與互動體驗

- 🟡 抽出共用的通知文案與摘要組裝 helper，避免 toast 與頁內狀態訊息逐漸分歧。（計劃：[notification-message-helper.md](docs/todo-references/notification-message-helper.md)）
- 🟡 擴充 `SettingsPage` 的 status type，不只保留 `success | error | idle`，讓離線提醒與預覽提醒可使用更清楚的 `info` 或 `warning` 語意。（計劃：[settings-status-types.md](docs/todo-references/settings-status-types.md)）
- 🟡 改善全域 toast 元件，讓它能更穩定地承接稍長摘要，例如支援兩行換行或依訊息長度調整顯示時間。（計劃：[toast-resilience.md](docs/todo-references/toast-resilience.md)）
- 🟢 補上通知行為的 UI 測試。（計劃：[notification-ui-tests.md](docs/todo-references/notification-ui-tests.md)）

## 導航與頁面架構

- 🟡 拆解 `SettingsPage`：把 Tag / Merchant 更名 state 移進對應 Section、CSV 邏輯抽到 `services/csvService.ts`、Pull dialog 拉成獨立 component，讓 container 退回 routing/render switch 形狀。（計劃：[settings-page-decomposition.md](docs/todo-references/settings-page-decomposition.md)）
- 🟡 強化 `SyncStatusPage` 的互動，例如提供只看失敗 / 只看待同步的篩選，以及更清楚的重試導向操作。（計劃：[sync-status-filters-and-retry.md](docs/todo-references/sync-status-filters-and-retry.md)）
- 🟢 評估為非首頁頁面引入共用 page-shell pattern，讓 layout chrome 維持一致，同時讓 `App.tsx` 持續聚焦於 routing 與 shared state。（計劃：[shared-page-shell.md](docs/todo-references/shared-page-shell.md)）

## 商家與資料維護

- 🟡 評估是否將商家管理改為進頁後直接查 IndexedDB，而不是依賴 App 全量載入的 `transactions` state。（計劃：[merchant-management-indexeddb-source.md](docs/todo-references/merchant-management-indexeddb-source.md)）
- 🟡 新增商家詳情頁，從商家管理進入後查看該商家的消費趨勢、常用類別、付款方式分布與最近交易。（計劃：[merchant-detail-page.md](docs/todo-references/merchant-detail-page.md)）

## 資料安全與 Guardrail

- 🟡 建立資料風險分區 guardrail（Step 1–2 已完成：AGENTS.md 紅區清單、同步 payload 型別上鎖；Step 3–6 待辦：GAS 欄位索引派生、重置確認顯示未同步筆數、CSV 匯入驗證對齊 pull、紅區純函式最小單元測試）。（計劃：[data-risk-guardrails.md](docs/todo-references/data-risk-guardrails.md)）

## Bundle / Chunk 優化待辦

- 🔴 將非首頁 page 改為 `React.lazy`。（計劃：[lazy-load-non-home-pages.md](docs/todo-references/lazy-load-non-home-pages.md)）
- 🟡 將 `sweetalert2` 改為動態載入。（計劃：[dynamic-sweetalert2.md](docs/todo-references/dynamic-sweetalert2.md)）
- 🟡 持續拆薄 `App.tsx`。（計劃：[app-tsx-decomposition.md](docs/todo-references/app-tsx-decomposition.md)）
- 🟡 建立 bundle size baseline 與驗收門檻。（計劃：[bundle-size-baseline.md](docs/todo-references/bundle-size-baseline.md)）
- 🟡 評估 PWA precache 對 lazy chunk 的實際影響。（計劃：[pwa-precache-lazy-chunks.md](docs/todo-references/pwa-precache-lazy-chunks.md)）
- 🟡 為 lazy-loaded page / dialog 補上 fallback 或 prefetch 策略。（計劃：[lazy-load-fallback-prefetch.md](docs/todo-references/lazy-load-fallback-prefetch.md)）
- 🟢 不優先拆 `HomePage` / `Calendar` 成 lazy chunk。（紀錄：[home-calendar-lazy-chunk-deprioritized.md](docs/todo-references/home-calendar-lazy-chunk-deprioritized.md)）
- 🟢 不優先把 `lucide-react` 再切得更碎。（紀錄：[lucide-react-further-splitting.md](docs/todo-references/lucide-react-further-splitting.md)）
- 🟢 不改走 CDN external 依賴。（紀錄：[cdn-external-dependencies.md](docs/todo-references/cdn-external-dependencies.md)）
