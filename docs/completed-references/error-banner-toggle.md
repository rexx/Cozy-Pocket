# 錯誤訊息紅色區塊顯示偏好（debug 開關）

## 摘要

偏好設定新增了一個開關，控制畫面最上方的全域錯誤訊息紅色區塊（`App.tsx` 內的 `ErrorDisplay`）是否顯示。

- **預設關閉（隱藏）**：一般使用時即使捕捉到錯誤，最上方也不會跳出紅色 debug 區塊，避免干擾。
- **開啟（顯示）**：debug 時可打開，觀看累積的 `window` error、unhandledrejection，以及各 CRUD / 同步流程寫入的錯誤訊息。

核心設計：**錯誤照常持續捕捉**（`capturedErrors` state 不變），開關只 gate 顯示。因此切到「顯示」時會立即看到先前已累積的錯誤，不會因為一開始關閉而漏接。

偏好持久化沿用 `homeNavArrowsVisible` / `paymentMethodDisplayMode` 的 `db.settings` + `preferences.ts` helper 模式，歸入「偏好設定」子頁。

## 變更內容

1. **`preferences.ts`**：新增 setting key、預設值與解析 helper。
   - `ERROR_BANNER_VISIBLE_SETTING_KEY = 'errorBannerVisible'`
   - `DEFAULT_ERROR_BANNER_VISIBLE = false`
   - `getErrorBannerVisible(value)`：只有明確存成 `true` 才回 `true`，其餘（未設定、legacy 值）一律 `false`，確保預設維持隱藏。

2. **`App.tsx`**：
   - `ErrorDisplay` 新增 `enabled: boolean` prop，`if (!enabled || errors.length === 0) return null;`。
   - 新增 state `errorBannerVisible`（初值 `false`）。
   - `refreshData` 與 init effect 的 settings 批次讀取加入 `ERROR_BANNER_VISIBLE_SETTING_KEY`，透過 `getErrorBannerVisible` normalize；init effect 一併把 normalized 預設寫回 `db.settings`。
   - 六處 `<ErrorDisplay>` 呼叫點都帶上 `enabled={errorBannerVisible}`。
   - 傳入 `SettingsPage`（`errorBannerVisible` + `onErrorBannerVisibleChange={setErrorBannerVisible}`）。

3. **`components/settings/PreferencesSection.tsx`**：新增「Error Banner (Debug)」功能子卡牌，內含「顯示／隱藏」二選一 segmented control。原本 Home Navigation Buttons 專用的 `HOME_NAV_ARROWS_OPTIONS` 改名為通用的 `SHOW_HIDE_OPTIONS`，由兩個顯示／隱藏 toggle 共用。

4. **`components/SettingsPage.tsx`**：新增 `errorBannerVisible` 與 `onErrorBannerVisibleChange` props，新增 `handleErrorBannerVisibleChange`（比照 `handleHomeNavArrowsVisibleChange`：先呼叫 callback、再 `db.settings.put`、最後 `onDataChange`），並在 `case 'preferences'` 透傳給 `PreferencesSection`。

## 介面與型別

`preferences.ts`：

```ts
export const ERROR_BANNER_VISIBLE_SETTING_KEY = 'errorBannerVisible';
export const DEFAULT_ERROR_BANNER_VISIBLE = false;

export const getErrorBannerVisible = (value: unknown): boolean => (
  value === true ? true : DEFAULT_ERROR_BANNER_VISIBLE
);
```

各元件 props 追加：

- `ErrorDisplay`（`App.tsx` 內部元件）：`enabled: boolean`
- `PreferencesSection` / `SettingsPage`：`errorBannerVisible: boolean`、`onErrorBannerVisibleChange: (visible: boolean) => void`

純 boolean，未新增 `types.ts` 型別；`settings` 表為 key-value，新增 key 不需 Dexie migration。

## UI 細節

- 偏好設定卡片標題 `Error Banner (Debug)`，說明文字「控制畫面最上方的錯誤訊息紅色區塊是否顯示；預設關閉，debug 時可開啟觀看捕捉到的錯誤。」
- Segmented control 兩個選項：`顯示`（`Eye`）／`隱藏`（`EyeOff`），active 樣式沿用 Payment Method Display / Home Navigation Buttons 的 cyan glow。
- 卡牌順序位於 Home Navigation Buttons 之後、Currency Options 之前。
- icon 沿用既有 import 的 `Eye`, `EyeOff`（遵守無 wildcard 規範）。

## 驗證

- `npm run build`（tsc strict + Vite production build）通過，為專案唯一自動化關卡。
- 瀏覽器手動驗證（cmux 內建瀏覽器）：
  1. 預設進 App，最上方不顯示紅色區塊。
  2. 偏好設定的「Error Banner (Debug)」預設停在「隱藏」。
  3. 在「隱藏」狀態注入合成 `window` error → 錯誤被捕捉但區塊不顯示（gating 生效）。
  4. 切「顯示」→ 最上方紅色區塊出現，列出累積的錯誤（`Total: 1` 含注入訊息），可按 `X` 清除。
  5. 切回「隱藏」→ 紅色區塊消失。
  6. 設「顯示」後重整 App → 偏好持久化仍為「顯示」；因 `capturedErrors` 重整後清空，區塊正確地不顯示（符合 `enabled && errors > 0` 邏輯）。

## 備註

- 此 key 僅本地偏好，不進同步上傳 payload。
- 開關只 gate 顯示，不清空 `capturedErrors`；清除仍透過區塊內 `X` 按鈕（`clearErrors`）。
