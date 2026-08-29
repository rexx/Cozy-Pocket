# 設定頁顯示可辨識的建置版本

## 摘要

設定頁最底部原本只有一行裝飾字 `Cozy Pocket • Minimalism`（`text-gray-700 opacity-15`，刻意壓到幾乎看不見）。在它下面加了一行建置識別，讓人能直接判斷「現在跑的是哪一版」。

主要用途是 service worker 交接的驗證。`registerType: 'autoUpdate'` 換 SW 時沒有任何提示，而 `package.json` 的 `version` 長年停在 `1.0.0`，看了分不出新舊。要能辨識就必須是**每次 build 都會變**的值。

## 關鍵變更

### 1. build 時注入三個常數

`vite.config.ts` 的 `define` 加入：

| 常數 | 來源 | 用途 |
|---|---|---|
| `__APP_VERSION__` | `package.json` 的 `version` | 語意版本，慣例欄位 |
| `__BUILD_COMMIT__` | `GITHUB_SHA` 前七碼，退回 `git rev-parse --short=7 HEAD`，再退回 `unknown` | 精確指向部署的 commit |
| `__BUILD_TIME__` | build 當下的 ISO 字串 | 區分同一 commit 的重複 build |

commit 取值採三層 fallback：CI 上 `actions/checkout` 是淺 clone，但 runner 一定有 `GITHUB_SHA`；本機沒有這個環境變數，改跑 `git`；`git` 也失敗（例如從 tarball 建置）才落到 `unknown`。

### 2. 型別宣告

`vite-env.d.ts` 加三行 `declare const`，讓 `tsc --strict` 認得這些全域常數。

### 3. 設定頁 footer

在既有的 `Cozy Pocket • Minimalism` 下面加一行，格式為 `v<version> · <commit> · <build time>`。

樣式與上方裝飾字一致（`text-gray-700 opacity-15`），只有字體改成 `font-mono` 讓 commit hash 好認。這是刻意的取捨：這行不該搶視覺，需要時湊近看或放大即可。

build 時間烤進去的是 ISO（UTC），渲染時用 `date-fns` 的 `format` 轉成使用者當地時間顯示——CI 跑在 UTC，直接顯示原字串會讓台灣的使用者看到差八小時的時間。

## 介面與型別

新增三個 build-time 全域常數，宣告於 `vite-env.d.ts`。不新增 props、不改動任何 service 介面或資料流。

## UI 細節

- 位置：設定頁捲動容器最底部，`Cozy Pocket • Minimalism` 之下。
- 因為這行在 `renderSection()` 之外的共用容器內，所有設定子頁都會顯示，與既有裝飾字一致。
- 純顯示，不可點擊、不可編輯。

## 驗證

1. `npm run build` 通過，`tsc --strict` 認得三個全域常數。
2. production 產物內查無字面上的 `__BUILD_COMMIT__` / `__APP_VERSION__` / `__BUILD_TIME__`，全部已代入；烤進去的 commit 與 `git rev-parse --short=7 HEAD` 相符。
3. cmux 進設定頁，該行顯示 `v1.0.0 · 52b1395 · 2026-08-29 10:37`；build 時間烤的是 UTC `02:37`，畫面顯示台北時間 `10:37`，時區換算正確。
4. 進入設定子頁（偏好設定）確認同樣顯示。
5. 連續兩次 build，`__BUILD_TIME__` 由 `02:37:02` 變為 `02:38:45`。
6. 無 console error。
7. `npm run docs:check` 通過。

## 假設

- 每次 build 都會產生不同的 `__BUILD_TIME__`，因此主 chunk 的 content hash 每次都會變。對這個專案是可接受的副作用，而且順帶保證 service worker 的 precache revision 一定更新。
- 專案沒有正式的版本號流程，`package.json` 的 `version` 維持 `1.0.0`；辨識度由 commit 與時間提供。
