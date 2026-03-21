# PWA Layout Gotchas

這份文件整理 `Cozy Pocket` 在 iOS Safari / iOS standalone PWA 上踩過的排版陷阱，避免之後為了調整全螢幕體驗時又把同樣的問題加回來。

## 結論

目前 `Cozy Pocket` 的穩定做法是：

* 不使用 `viewport-fit=cover`
* 不使用 `env(safe-area-inset-*)`
* 保留現有的 fixed app shell

在這個組合下，首頁、設定頁、新增/修改頁、同步頁都能正常避開系統 UI，且不會在 iOS 已安裝 PWA 底部出現額外的「下巴」區域。

## 已驗證的關鍵結論

### 1. `viewport-fit=cover` 會導致底部出現「下巴」

在這個專案中，iOS standalone PWA 的底部多出一段明顯區域，最後用單變因測試確認是 `viewport-fit=cover` 造成的。

已驗證流程：

1. 先移除 `body { position: fixed; inset: 0 }`，下巴仍存在
2. 再移除 `viewport-fit=cover`，下巴消失
3. 把 `body fixed` 加回去，但維持沒有 `viewport-fit=cover`，下巴仍然不會回來

結論：

* `body fixed` 不是主因
* `viewport-fit=cover` 才是這個問題的關鍵變因

## 2. 拿掉 `viewport-fit=cover` 之後，不再需要 safe-area inset

`viewport-fit=cover` 移除後，iOS 會把 viewport 收在安全區內。實測把全域 `safe-area` 變數全部清成 `0` 後：

* 首頁正常
* 新增/修改頁正常
* 資料與設定頁正常
* 同步頁正常

因此目前專案已經不再依賴：

* `env(safe-area-inset-top)`
* `env(safe-area-inset-right)`
* `env(safe-area-inset-bottom)`
* `env(safe-area-inset-left)`

也不再需要：

* `.safe-area-top`
* `.safe-area-bottom`
* `.safe-area-frame`

## 3. `manifest` 與 `service worker` 不是主因

比對多個其他專案後，`manifest` 與 `sw.js` / `vite-plugin-pwa` 並沒有和「有沒有下巴」形成穩定對應。

有下巴與沒下巴的專案都可能：

* 有 manifest
* 沒 manifest
* 有 PWA 行為
* 沒有明顯的 SW 註冊

所以這次問題的核心不是 PWA 資產或快取機制，而是 iOS viewport 行為本身。

## 4. fixed app shell 不是根因，但會放大問題排查成本

這個專案目前仍使用固定式 app shell：

* `html, body` 鎖高
* `body { position: fixed; inset: 0 }`
* `#root` 滿版
* 內部分區滾動

這種結構本身不是造成下巴的主因，但在排查 iOS viewport 問題時，很容易誤以為是：

* `flex-1` 沒撐滿
* scroll container 高度算錯
* safe-area bottom 多墊了一段

因此之後如果要再改 shell，請先確認問題到底是 layout 高度還是 viewport 行為。

## 其他實作注意事項

### 1. 短內容頁面若想保留 iOS bounce / overscroll

當 scroll container 的內容高度沒有超過容器時，iOS 會失去 overscroll / bounce。這個專案目前用的做法是給 scroll 內容一個極小的額外高度：

```tsx
min-h-[calc(100%+1px)]
```

目前用在：

* 首頁交易列表
* 新增 / 修改項目 modal

### 2. iOS PWA 更新驗證不要只靠顏色猜

iOS 已安裝 PWA 的快取很黏，Safari 與主畫面 PWA 常常不是同一個前端版本。若要驗證 layout 修正：

* 優先用明顯版本字串或視覺標記確認是否已更新
* 不要只憑感覺判斷是不是最新 PWA

## 未來若要重新啟用 `viewport-fit=cover`

如果未來想為了更貼頂/貼底的全螢幕效果把 `viewport-fit=cover` 加回來，請至少重新驗證以下頁面：

* 首頁
* 新增 / 修改項目頁
* 資料與設定頁
* 同步狀態頁
* 已安裝到 iOS 主畫面的 standalone PWA

並重新確認：

* 是否又出現底部下巴
* 是否需要重新引入 `safe-area` padding
* toast、錯誤面板、fixed button 是否撞到系統 UI
