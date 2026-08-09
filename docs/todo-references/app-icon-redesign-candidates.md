# App icon 造型二選一：口袋 vs 字母 C

現行 icon 已經拿到 iOS 26 的 Liquid Glass 處理，這件待辦不是修 bug，是**造型層次的選擇**：要不要把 icon 從「口袋裡有錢幣」換成別的講法。不換也是合理結論。

動手前必讀 [App icon 與 iOS 26 Liquid Glass](../app-icon-ios-liquid-glass.md)，下面兩案都已經照那份文件的限制畫好並量過。

---

## 決選兩案

### A — 投幣入袋

口袋輪廓不變，錢幣改成騎在袋口線上（半進半出），袋口在錢幣兩側斷開讓位；縫線從袋口下方的橫線改成貼著底部弧線的一道虛線，因為袋口的位置已經被錢幣佔走。

```svg
<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M188 132H160A22 22 0 0 0 138 154V262A118 118 0 0 0 374 262V154A22 22 0 0 0 352 132H324"
        stroke="#22D3EE" stroke-width="24" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M185 303A82 82 0 0 0 327 303"
        stroke="#1FA8BE" stroke-width="11" stroke-linecap="round" stroke-dasharray="14 20"/>
  <circle cx="256" cy="132" r="46" fill="#22D3EE"/>
  <path d="M389 89L400 60L411 89L440 100L411 111L400 140L389 111L360 100Z" fill="#0891B2"/>
  <path d="M101 331L110 312L119 331L138 340L119 349L110 368L101 349L82 340Z" fill="#0891B2"/>
</svg>
```

**已知瑕疵**：袋口兩側殘留的短直線在深色底上會讀成提把，整體偏向提籃；縫線貼著底部弧線之後，輪廓也可能被讀成 U 形容器而不是口袋。實機上若真的認不出來，第一個該試的調整是把縫線改回袋口下方的橫線：

```svg
  <path d="M150 190H362" stroke="#1FA8BE" stroke-width="11" stroke-linecap="round"
        stroke-dasharray="14 20"/>
```

那條橫線橫過袋口下方時，是「這是袋口」最強的識別線索（改動時錢幣半徑一併縮到 42，讓出縫線的空間）。代價是袋口一帶的元素變密。

### C3 — 字母 C 抱著錢幣

開口朝正右方的環，缺口讓它同時是預算圈與 Cozy 的字首 `C`，錢幣收在環中央。

```svg
<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M342 366A140 140 0 1 1 342 146"
        stroke="#22D3EE" stroke-width="26" stroke-linecap="round"/>
  <circle cx="256" cy="256" r="44" fill="#22D3EE"/>
  <path d="M400 130L410 106L420 130L444 140L420 150L410 174L400 150L376 140Z" fill="#0891B2"/>
</svg>
```

**代價**：丟掉「口袋」這個跟 App 名字綁定的視覺資產。**好處**：所有候選裡 16×16 最清楚的一案，而且形狀最單純，最吃得到系統沿描邊擠出的高光。

---

## 已經試過、不要重畫的變體

| 變體 | 為什麼不行 |
|---|---|
| 錢幣置中懸在閉合袋口正上方 | 圓加圓角方是使用者頭像的標準剪影，會被讀成 avatar |
| 錢幣偏左懸在閉合袋口上方 | 避開頭像了，但口袋變成空桶，構圖散掉 |
| 日曆造型，其中一格是錢幣 | 32px 辨識度最好，但撞系統行事曆的長相，且跟 Cozy Pocket 這個名字脫鉤 |
| 環的缺口在右上、錢幣在缺口外 | 缺口朝右加右側一顆圓點是小精靈吃豆子的標準構圖 |

---

## 驗收

1. 換掉 `public/icon.svg` 後跑 `npm run icons:generate`，確認透明比例檢查通過（兩案量到的值分別是 87.7% 與 89.6%，都遠高於 76.3% 門檻）
2. 產出檔一併 commit —— GitHub Pages 部署不跑產出步驟
3. 實機驗 Liquid Glass：**先移除主畫面舊圖示再重新加入**，否則會看到快取的舊圖，並比對 Light／Dark／Tinted 三種外觀
4. 桌面瀏覽器另外看 favicon，尤其是 16×16 下造型還認不認得出來
