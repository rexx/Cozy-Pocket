# Tag 移除與拆分完成紀錄

**成果：** Tag 管理可從所有相關交易移除指定 tag，或將單一 tag 拆成多個 tag。每筆交易寫回前會對完整 tag 清單去重並依 code point 排序。

**架構：** 原本的單一更名 helper 泛化成 tag replacement operation —— 空 replacement list 代表移除，一個 token 代表更名，多個 token 代表拆分。資料轉換維持在 `tagService` 純函式，`App.tsx` 沿用既有 Dexie bulk write、版本遞增與背景同步流程，UI 維持預覽後確認的兩階段操作。

**技術棧：** React 19、TypeScript strict、Dexie 4、Tailwind CSS v4、既有 cloud sync service。

---

## 摘要

- 更名輸入允許以空白分隔多個新 tag。輸入 `Ipass 永豐` 解析為 `Ipass` 與 `永豐` 兩個獨立 tag token，不是名稱含空白的單一 tag。
- 每筆交易先替換目標 tag，再用 `joinTags()` 對完整結果去重並排序。`Ipass Ipass永豐` 拆分後邏輯結果是 `Ipass`、`永豐` 兩個 tag，`Transaction.tags` 寫成空白分隔字串。
- 移除只刪除符合精確 token 的 tag，不刪除交易；交易沒有其他 tag 時寫回空字串。
- 移除與拆分都必須先預覽受影響交易筆數，再顯示確認按鈕。
- 移除入口是「預覽影響筆數」右側的方形垃圾桶按鈕，點擊即產生移除 preview，全程使用頁內兩階段確認，不使用 SweetAlert2。
- 本項目批次寫入交易並觸發同步，屬於資料風險橘區；`App.tsx` 的 version 與 updatedAt 遞增屬於 R6 紅區，已手動檢查 diff 並執行 mock sync。

## 關鍵變更

- `services/tagService.ts`
  - `TagRenamePreview` 改為 `TagReplacementPreview`，以 `operation: 'remove' | 'rename' | 'split'` 區分三種操作，並帶 `replacementTags`、`willBecomeUntaggedCount`、`existingReplacementTags`。
  - replacement tags 以 `splitTags()` 正規化、去除輸入內重複值；呼叫端傳入非空但正規化後為空的輸入會 throw，不會被當成移除。
  - 交易轉換以 `flatMap()` 替換目標 token，再對整筆交易的 tag 清單呼叫 `joinTags()`。
  - `joinTags()` 成為 `Transaction.tags` 的唯一序列化點：正規化、去重、依 code point 排序。刻意不用 `localeCompare` —— code point 順序與引擎無關，跨裝置寫入同一組 tag 會產生完全相同的字串。
  - `getTagUsageSummaries()` 的同筆數 tie-break 從 `localeCompare(…, 'zh-Hant')` 改為 code point，與儲存順序一致。
  - 維持精確 token 與大小寫敏感比對。
- `services/statsService.ts`
  - `getMonthTags()` 的排序一併改為 code point，讓統計頁 Tag 篩選清單與 Tag 管理清單一致。
- `App.tsx`
  - `previewTagRename` / `renameTag` 改為 `previewTagReplacement` / `replaceTag`，改接 replacement tag 陣列。
  - 保留每筆 `version + 1`、唯一 `updatedAt`、`syncStatus: 'pending'` 與清除 `lastSyncError`。
  - 保留離線先寫本機、上線後同步，以及同步部分失敗的既有處理。
- `components/AddTransactionModal.tsx`
  - 儲存時的 `tags` 改由 `joinTags()` 序列化，與 Tag 管理共用同一套去重與排序規則。
- `components/SettingsPage.tsx`
  - 更新傳給 Tag 管理 section 的 callback 型別，view routing 不變。
- `components/settings/TagManagementSection.tsx`
  - 更名輸入改為可輸入多個 tag。
  - 「預覽影響筆數」右側新增方形垃圾桶按鈕，點擊直接產生移除 preview。
  - preview 卡與確認按鈕由三種操作共用，外觀依 `operation` 切換。
  - 單一 replacement 完成後直接選取新 tag；拆分或移除完成後清除選取並在頁內顯示結果。

## 介面與型別

```ts
export interface TagReplacementPreview {
  oldTag: string;
  replacementTags: string[];
  affectedCount: number;
  willBecomeUntaggedCount: number;
  existingReplacementTags: string[];
  operation: 'remove' | 'rename' | 'split';
}

export const replaceTagInTransactions = (
  transactions: Transaction[],
  oldTag: string,
  replacementTags: string[]
) => {
  const preview = buildTagReplacementPreview(transactions, oldTag, replacementTags);

  const updatedTransactions = transactions.flatMap<Transaction>((tx) => {
    const tags = splitTags(tx.tags);
    if (!tags.includes(preview.oldTag)) return [];

    const replacedTags = applyReplacement(tags, preview.oldTag, preview.replacementTags);
    return [{ ...tx, tags: joinTags(replacedTags) }];
  });

  return { preview, updatedTransactions };
};
```

raw input 只在 UI 邊界轉成 `string[]`；service 不以空字串猜測操作，移除必須明確傳入空陣列。

## UI 細節

- 欄位名稱為「New Tags」，placeholder 說明可用空白分隔多個 tag。
- 更名／拆分預覽將正規化後的 replacement list 顯示為個別 chip，例如分別顯示 `#Ipass` 與 `#永豐`，並列出受影響交易筆數。
- replacement 已存在時，warning 列出會合併的 tag，並說明每筆交易會自動去重。
- 移除入口是「預覽影響筆數」右側的 `aspect-square` 紅色垃圾桶按鈕，載入中在按鈕內顯示 spinner。
- 移除 preview 使用紅色 `SettingsFeedbackCard`，顯示受影響交易筆數、移除後沒有任何 tag 的交易筆數，以及「只移除 tag，不會刪除交易」。
- 確認按鈕只有一顆：更名／拆分為綠色，移除為紅色並在文案帶上目標 tag 名稱，降低套用錯誤目標的風險。
- 頁面同時只保留一個 preview；因為確認按鈕共用，只要變更輸入或切換目標 tag 就會清除既有 preview，畫面文字永遠等於按下確認會發生的事。
- 執行中停用所有 mutation controls；完成、離線與同步失敗訊息沿用 `SettingsFeedbackCard`。

## 執行期間的畫面穩定性

實作過程中發現兩個只在真實使用情境浮現的問題，都與「操作完成後面板收合」有關：

- **執行中面板提前卸載。** 本機 `bulkPut` 落地後 `transactions` 立即更新，目標 tag 從 `tagSummaries` 消失，原本負責「選取的 tag 不存在就清空選取」的 effect 會在同步往返還沒結束時就把面板卸載，使用者只看得到空白。解法是 `isSubmitting` 期間凍結面板：清空選取與重載交易列表兩個 effect 都跳過。
- **收合後捲動位置越界。** 完成後面板收合，內容高度大幅縮短，原本停在深處的捲動位置會落在新內容之外，iOS Safari 不保證會夾回。解法是把捲動歸零放進 `useLayoutEffect`（由 `scrollResetToken` 觸發），確保在內容已縮短後才執行；歸零前先把捲動容器的 `overflowY` 暫設為 `hidden` 再還原，掐掉 iOS 殘餘的慣性捲動，否則手指離開後的動量會再次把畫面推出界。

## 驗證

- 自動檢查：`npm run build`（tsc strict + Vite production build）、`npm run docs:check`。
- 純函式案例：單一更名、多 tag 拆分、兩個 token 可獨立查詢與彙整、replacement 內重複、與交易原有 tag 重複、移除中間 token、移除唯一 token、精確 token 與大小寫敏感。
- cmux 瀏覽器驗證（fresh origin，無同步憑證）：
  - 拆分 `Ipass永豐` → `Ipass 永豐`：`Ipass` 由 1 筆變 3 筆而非 4 筆，證實同時含兩者的交易已去重；`永豐` 3 筆，兩者可各自查詢。
  - 移除唯一 tag：交易仍存在、`tags` 為空字串、version 遞增、狀態為 `pending`，金額與商家未變動。
  - 錯誤路徑：輸入 `#`（正規化後為空）與輸入與原名相同，都被擋下且不產生 preview。
  - 排序：寫回結果為 `Ipass zzz 永豐`，符合 code point 順序。
  - 執行中面板不再提前卸載（操作進行中仍可觀察到 busy 按鈕與交易列表）。
  - 模擬「執行中持續往下捲動、完成才放手」：放手當下捲動位置即為 0，之後四次取樣維持 0 且無可捲空間。
- mock sync：push payload 為 15 個 `SyncPayloadItem` 欄位、無 `syncStatus` 外洩，tags（含空字串）正確上傳；年度 pull 後本項目的交易 tags、version 與金額未被覆寫。
- 專案沒有測試框架，本項目不額外導入 runner；純函式案例與同步案例以固定 fixture 手動驗證。

## 已知取捨

- `Transaction.tags` 仍以單一空白分隔儲存；tag 名稱本身不可包含空白。
- tag 名稱區分大小寫，`Ipass` 與 `ipass` 不會互相去重，排序上大寫排在小寫之前（code point 順序）。
- 既有資料不會回頭重排，只有被重新寫入的交易才會套用新的排序規則。
- 移除不刪除交易，也不改動交易的 id、timestamp、金額、分類、商家、付款方式或備註。
