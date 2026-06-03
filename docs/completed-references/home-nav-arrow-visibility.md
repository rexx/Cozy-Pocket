# 首頁左右導覽按鈕顯示偏好

## 摘要

偏好設定新增了一個開關，使用者可一次隱藏首頁的左右導覽按鈕，涵蓋：

- **上半（月曆區）**：`Calendar.tsx` 內切換上一週／下一週、上個月／下個月的左右圓鈕。
- **下半（交易列表區）**：`HomePage.tsx` 內切換昨天／明天的左右圓鈕。

預設為「顯示」，行為與先前一致。隱藏時兩組按鈕同時消失，但**左右滑動手勢（`useHorizontalSwipe`）維持運作**，使用者仍可切換週期與日期——這個開關只移除視覺上的按鈕，不移除導覽能力。月曆下方的週／月切換圓鈕與右下角新增交易 `+` FAB 不受影響。

單一開關同時控制上下兩組。偏好持久化沿用 `paymentMethodDisplayMode` 的 `db.settings` + `preferences.ts` helper 模式，歸入「偏好設定」子頁。

## 變更內容

1. **`preferences.ts`**：新增 setting key、預設值與解析 helper。
   - `HOME_NAV_ARROWS_VISIBLE_SETTING_KEY = 'homeNavArrowsVisible'`
   - `DEFAULT_HOME_NAV_ARROWS_VISIBLE = true`
   - `getHomeNavArrowsVisible(value)`：只有明確存成 `false` 才回 `false`，其餘（未設定、legacy 值）一律 `true`，確保預設維持顯示。

2. **`App.tsx`**：
   - 新增 state `homeNavArrowsVisible`（初值 `true`）。
   - 在 `refreshData` 與 init effect 的 settings 批次讀取中加入 `HOME_NAV_ARROWS_VISIBLE_SETTING_KEY`，並透過 `getHomeNavArrowsVisible` normalize；init effect 一併把 normalized 預設寫回 `db.settings`。
   - 傳入 `HomePage`（`showNavArrows={homeNavArrowsVisible}`）與 `SettingsPage`（`homeNavArrowsVisible` + `onHomeNavArrowsVisibleChange={setHomeNavArrowsVisible}`）。

3. **`HomePage.tsx`**：新增 `showNavArrows: boolean` prop，以 `{showNavArrows && (...)}` 包住下半昨天／明天按鈕 overlay，並將 `showNavArrows` 往下傳給 `<Calendar />`。

4. **`Calendar.tsx`**：新增 `showNavArrows?: boolean` prop（預設 `true`），以 `{showNavArrows && (...)}` 包住月曆上一週／下一週按鈕 overlay。

5. **`components/settings/PreferencesSection.tsx`**：新增「Home Navigation Buttons」功能子卡牌，內含「顯示／隱藏」二選一 segmented control，沿用 Payment Method Display 的雙按鈕樣式（icon 用 `Eye` / `EyeOff`）。

6. **`components/SettingsPage.tsx`**：新增 `homeNavArrowsVisible` 與 `onHomeNavArrowsVisibleChange` props，新增 `handleHomeNavArrowsVisibleChange`（比照 `handlePaymentMethodDisplayModeChange`：先呼叫 callback、再 `db.settings.put`、最後 `onDataChange`），並在 `case 'preferences'` 透傳給 `PreferencesSection`。

## 介面與型別

`preferences.ts`：

```ts
export const HOME_NAV_ARROWS_VISIBLE_SETTING_KEY = 'homeNavArrowsVisible';
export const DEFAULT_HOME_NAV_ARROWS_VISIBLE = true;

export const getHomeNavArrowsVisible = (value: unknown): boolean => (
  value === false ? false : DEFAULT_HOME_NAV_ARROWS_VISIBLE
);
```

各元件 props 追加：

- `HomePage`：`showNavArrows: boolean`
- `Calendar`：`showNavArrows?: boolean`（預設 `true`）
- `PreferencesSection` / `SettingsPage`：`homeNavArrowsVisible: boolean`、`onHomeNavArrowsVisibleChange: (visible: boolean) => void`

純 boolean，未新增 `types.ts` 型別；`settings` 表為 key-value，新增 key 不需 Dexie migration。

## UI 細節

- 偏好設定卡片標題 `Home Navigation Buttons`，說明文字「控制首頁月曆與交易列表的左右切換按鈕是否顯示；隱藏後仍可左右滑動切換。」
- Segmented control 兩個選項：`顯示`（`Eye`）／`隱藏`（`EyeOff`），active 樣式沿用 Payment Method Display 的 cyan glow。
- 隱藏時月曆左右圓鈕與交易列表左右圓鈕同時不顯示；月曆下方週／月切換圓鈕與右下角新增交易 `+` FAB 不受影響。
- icon 從 `lucide-react` 明確 import `Eye`, `EyeOff`（遵守無 wildcard 規範）。

## 驗證

- `npm run build`（tsc strict + Vite production build）通過，為專案唯一自動化關卡。
- 瀏覽器手動驗證：
  1. 預設進首頁，上下兩組左右按鈕都在。
  2. 偏好設定切「隱藏」→ 回首頁，兩組按鈕都消失；週／月切換鈕與 `+` FAB 仍在。
  3. 隱藏狀態下左右滑動月曆與交易列表，仍能切換週期／日期。
  4. 重整 App 後偏好持久化，仍維持隱藏。
  5. 切回「顯示」，兩組按鈕回來。

## 備註

- 採單一開關同時控制上下兩組。若日後需要上下分開控制，可把此 boolean 拆成兩個 key，介面已預留擴充空間。
- 此 key 僅本地偏好，不進同步上傳 payload。
