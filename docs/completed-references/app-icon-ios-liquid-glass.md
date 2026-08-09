# App icon 立體感（iOS Liquid Glass）

Cozy Pocket 加到 iPhone 主畫面後會取得 iOS 26 的 Liquid Glass 系統加工。實機確認拿到了效果：描邊被擠出厚度、沿著邊緣有高光，深色背景由系統生成。

## 摘要

- **觸發條件是 icon 的透明背景。** iOS 26 把不透明像素當成 icon 的前景層，自己補背景與立體光影。`apple-touch-icon.png` 因此不填不透明底。
- **透明是必要條件，但不充分：圖形還必須夠細。** 主體內部一旦填滿就完全失去效果，與填色的 alpha 無關 —— 半透明 20% 與不透明深青色分別實測，結果相同。可見關鍵是非透明區域的覆蓋率，不是部分透明度本身。
- **`"purpose": "maskable"` 不是觸發條件。** 對照樣本的 icon 目錄裡沒有 manifest 也沒有 maskable 宣告，照樣拿到效果。manifest 的 `purpose` 只剩安全區裁切的價值。
- Liquid Glass 的官方路徑是 Icon Composer 產出的分層 `.icon` 加 Xcode 26 編譯，那是原生 App 專屬。PWA 只能交付單張點陣圖，無法宣告 foreground／background layer、depth 或 specular highlight，所以拿到的是系統對單張圖的自動推導，效果幅度是邊緣的立體處理而非可控的玻璃分層。
- 不把玻璃、陰影、反射烘進 PNG —— 那會破壞 Light／Dark／Clear／Tinted 的系統適配，可能出現雙重高光。只交付乾淨平面圖形。
- 本項目只改靜態資產與 manifest／build 設定，不碰任何交易資料路徑，屬於資料風險綠區。

## 覆蓋率判準

判斷一張 icon 能不能拿到系統加工，看 `apple-touch-icon.png` 的全透明像素比例：

| 圖形 | 全透明像素 | 玻璃 |
|---|---|---|
| 改版前（不透明滿版底） | 0% | ❌ |
| 對照樣本（另一個 PWA 的線稿 icon） | 76.3% | ✅ |
| 線稿，口袋內部填滿（半透明 20%） | 約 62% | ❌ |
| 線稿，口袋內部填滿（不透明深青） | 62.2% | ❌ |
| 最終版（線稿＋縫線＋錢幣＋星星） | 86.5% | ✅ |

76% 與 86% 都有效、62% 失效。細描邊與虛線縫線的成本極低（縫線只佔 1.7%），可以自由使用；面狀填色不行。

判斷透明度時**不能只看 `sips -g hasAlpha`** —— 有 alpha channel 不等於有透明像素，上述樣本都回報 `hasAlpha: yes`，實際差異只在像素值。

另外，「任何部分透明度都會關掉效果」這個中途假說不成立：對照樣本本身就有 12.7% 的抗鋸齒半透明像素（76.3% 全透明加 11.0% 全不透明），照樣有效。

## 關鍵變更

- `public/icon.svg`（唯一的 icon 來源）
  - 移除了滿版背景矩形，圖檔本身沒有背景，圓角交給 iOS mask。
  - 主體改為純 stroke 線稿，不再依賴底色：口袋輪廓 `stroke-width="24"`、虛線縫線、實心錢幣，口袋內部保持未填滿。
  - 口袋 236×248，略高於寬 —— 底部圓弧與開口等寬會讀成碗而不是口袋。
  - AI 星星保留兩顆，位置避開口袋外緣與畫布四角（四角會被 iOS 的 squircle 遮罩裁掉）。
  - 移除了 `<circle>` 上不存在的 `shadow` 屬性（SVG 無此屬性、完全不生效）。
- `scripts/generate-icons.mjs`（新增）
  - 以 `sharp` 從 `icon.svg` 產出六個 PNG 與 `favicon.ico`，config 陣列驅動。
  - `flatten` 是 per-output 開關：`apple-touch-icon` 與 android 主畫面 icon 保留透明讓系統補背景；favicon 與 maskable 壓上 `#1A1C2C`，因為瀏覽器分頁列與 Android adaptive icon 的裁切都沒有系統補的背景可用。
  - `favicon.ico` 由 script 自行組裝 ICO 容器（目錄標頭加各尺寸 PNG payload），內含 16／32／48 三種尺寸。`sharp` 不能寫 `.ico`，但不需要額外依賴。
  - maskable 版不另開 SVG 來源。手抄第二份同造型的 SVG 會變成兩個必須同步的檔案，改 stroke 粗細時容易只改一邊。目前圖形最遠的角落落在 r=188，已在 maskable 安全圓（r=204.8）內，所以不需要縮放；圖形若之後放大超過安全圓，才需要為這個輸出加回 inset。
- `package.json`：新增 `sharp` devDependency 與 `icons:generate` script。
- `public/manifest.json`：兩個現有 icon 補 `"purpose": "any"`，新增 `icon-maskable-512.png` 一筆 `"purpose": "maskable"`。
- `vite.config.ts`：`VitePWA.includeAssets` 加入 `icon-maskable-512.png`。
- `README.md`：新增「App icon 產出流程」章節，記錄產出流程與「不要填滿主體」這條硬限制。

## 產出設定

```js
const OUTPUTS = [
  { out: 'favicon-16x16.png',          size: 16,  flatten: true },
  { out: 'favicon-32x32.png',          size: 32,  flatten: true },
  { out: 'apple-touch-icon.png',       size: 180, flatten: false },
  { out: 'android-chrome-192x192.png', size: 192, flatten: false },
  { out: 'android-chrome-512x512.png', size: 512, flatten: false },
  { out: 'icon-maskable-512.png',      size: 512, flatten: true },
];
```

`favicon.ico` 另外以 16／32／48 三個尺寸組裝，全部 flatten。

## 已知限制

- **16×16 favicon 會失去細節。** 縫線在該尺寸看不見，星星縮成角落的亮點。造型仍可辨識，但這是單一來源產出全尺寸的固有代價；要救得讓 favicon 走自己的粗描邊來源，代價是造型變成兩個地方要維護。
- PWA 無法指定 Clear 外觀。
- 產出的 PNG 直接進版控，GitHub Pages 部署不跑 icon 產出步驟。改圖後必須手動跑 `npm run icons:generate` 並 commit 產出檔。

## 驗證

- `npm run icons:generate` 產出七個檔案，`npm run build` 與 `npm run docs:check` 皆通過。
- iPhone 實機逐版比對，每次都先移除主畫面圖示再重新加入（iOS 會快取 web clip icon，不移除會看到舊圖而誤判）。最終版確認取得系統生成的背景與邊緣立體光影。
- `apple-touch-icon.png` 的 alpha 分佈以 Python 3 stdlib 腳本量測，確認 86.5% 全透明、四角 alpha 為 0。
- 桌面瀏覽器 favicon 與 PWA 安裝提示圖示均無破圖。
