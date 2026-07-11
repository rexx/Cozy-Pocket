# Tag 移除與拆分實作計劃

> **給 agentic workers：** 本項目會使用新的 git worktree `worktrees/tag-remove-and-split` 開發，不直接修改 repo 根目錄；實作時必須逐項執行本計劃，並使用 `superpowers-subagent-driven-development` 或 `superpowers-executing-plans`。

**目標：** 讓 Tag 管理可從所有相關交易移除指定 tag，或將單一 tag 拆成多個 tag，並在每筆交易寫回前對完整 tag 清單去重。

**架構：** 將現有單一更名 helper 泛化成 tag replacement operation，空 replacement list 代表移除，一個或多個 token 代表更名或拆分。資料轉換維持在 `tagService` 純函式，`App.tsx` 沿用既有 Dexie bulk write、版本遞增與背景同步流程，UI 繼續使用預覽後確認的兩階段操作。

**技術棧：** React 19、TypeScript strict、Dexie 4、Tailwind CSS v4、既有 cloud sync service。

---

## 摘要

- 更名輸入允許以空白分隔多個新 tag。輸入 `Ipass 永豐` 會解析為 `Ipass` 與 `永豐` 兩個獨立 tag token，不是名稱含空白的單一 tag。
- 每筆交易會先替換目標 tag，再使用 `joinTags()` 對完整結果去重。`Ipass Ipass永豐` 拆分後，邏輯結果是 `Ipass`、`永豐` 兩個 tag；`Transaction.tags` 欄位依既有資料模型寫成空白分隔字串 `Ipass 永豐`。
- 移除 tag 只刪除符合精確 token 的 tag，不刪除交易；交易沒有其他 tag 時寫回空字串。
- 移除與拆分都必須先預覽受影響交易筆數，再顯示確認按鈕。
- 移除採獨立紅色區塊與頁內兩階段確認，不使用 tag chip 刪除圖示、空白輸入暗示或 SweetAlert2。
- 本項目會批次寫入交易並觸發同步，屬於資料風險橘區；`App.tsx` 的 version 與 updatedAt 遞增屬於 R6 紅區，必須手動檢查 diff 並執行 mock sync。

## 關鍵變更

- `services/tagService.ts`
  - 將 `TagRenamePreview` 改為可表示 remove、rename、split 的 preview 型別。
  - replacement tags 使用 `splitTags()` 正規化並用 `joinTags()` 去除輸入內重複值。
  - 交易轉換使用 `flatMap()` 替換目標 token，再對整筆交易的 tag 清單呼叫 `joinTags()`。
  - 維持精確 token 與大小寫敏感比對。
- `App.tsx`
  - 將 preview 與 execute callback 改接 generalized operation。
  - 保留每筆 `version + 1`、唯一 `updatedAt`、`syncStatus: 'pending'` 與清除 `lastSyncError`。
  - 保留離線先寫本機、上線後同步，以及同步部分失敗的既有處理。
- `components/SettingsPage.tsx`
  - 更新傳給 Tag 管理 section 的 callback 型別，不改 view routing。
- `components/settings/TagManagementSection.tsx`
  - 更名輸入改為可輸入多個 tag。
  - 在更名／拆分控制下方增加獨立的紅色危險操作區塊，採頁內「預覽移除」與「確認移除」兩階段流程。
  - 單一 replacement 完成後可直接選取新 tag；拆分或移除完成後清除選取並在頁內顯示結果。

## 介面與型別

- 建議 preview 型別：

```ts
export interface TagReplacementPreview {
  oldTag: string;
  replacementTags: string[];
  affectedCount: number;
  willBecomeUntaggedCount: number;
  existingReplacementTags: string[];
  operation: 'remove' | 'rename' | 'split';
}
```

- 建議純函式介面：

```ts
export const replaceTagInTransactions = (
  transactions: Transaction[],
  oldTag: string,
  replacementTags: string[]
) => {
  const preview = buildTagReplacementPreview(
    transactions,
    oldTag,
    replacementTags
  );

  const updatedTransactions = transactions.flatMap((tx) => {
    const tags = splitTags(tx.tags);
    if (!tags.includes(preview.oldTag)) return [];

    const replacedTags = tags.flatMap((tag) => (
      tag === preview.oldTag ? preview.replacementTags : [tag]
    ));
    return [{ ...tx, tags: joinTags(replacedTags) }];
  });

  return { preview, updatedTransactions };
};
```

- raw input 只在 UI 邊界轉成 `string[]`；service 不以空字串猜測操作，移除必須明確傳入空陣列。

## UI 細節

- 欄位名稱改為「新的 Tag」，placeholder 說明可用空白分隔多個 tag。
- 一般預覽將正規化後的 replacement list 顯示為個別 chip，例如分別顯示 `#Ipass` 與 `#永豐`，並列出受影響交易筆數。
- replacement 已存在時，warning 列出會合併的 tag，並說明每筆交易會自動去重。
- 移除區塊放在更名／拆分控制之後、相關交易列表之前，以紅色外框或淡紅背景與一般操作區隔。
- 第一階段使用 `sectionRedButtonClassName` 呈現「預覽移除 #tag」；點擊後以空 replacement list 建立 preview，不開啟 SweetAlert2。
- 移除 preview 使用紅色 `SettingsFeedbackCard`，顯示受影響交易筆數、移除後沒有任何 tag 的交易筆數，以及「只移除 tag，不會刪除交易」。
- preview 成功後才顯示第二階段紅色按鈕「確認移除 #tag」；執行前按鈕文案必須包含目前選取的 tag，降低套用錯誤目標的風險。
- 頁面同時只保留一個 preview。開始移除預覽時清除更名／拆分 preview；重新預覽更名／拆分時清除移除 preview，但不必清掉尚未送出的輸入文字。
- 使用者變更輸入或切換目標 tag 時，必須清除舊 preview，避免舊確認套用到新內容。
- 執行中停用所有 mutation controls；完成、離線與同步失敗訊息沿用 `SettingsFeedbackCard`。

## 實作步驟

### Task 1：建立獨立 worktree 並確認資料風險基準

**Files:**

- Read: `AGENTS.md`
- Read: `README.md` §6.10
- Read: `docs/cloud-sync-specification.md`

- [ ] 從最新 `main` 建立 `worktrees/tag-remove-and-split` 與同名分支。
- [ ] 建立 `node_modules` symlink，指向 repo 根目錄既有依賴。
- [ ] 記錄 `services/tagService.ts`、`App.tsx` 與 Tag 管理現況 diff 基準。
- [ ] 執行 `npm --prefix worktrees/tag-remove-and-split run build`，預期成功。

### Task 2：泛化 Tag replacement 純函式

**Files:**

- Modify: `services/tagService.ts`

- [ ] 新增 replacement preview 型別，明確區分 remove、rename、split。
- [ ] 正規化 replacement tags，移除空 token、前置 `#` 與重複輸入。
- [ ] 確認 `splitTags('Ipass 永豐')` 產生長度為 2 的 replacement list，且兩個 token 可獨立查詢與彙整。
- [ ] preview 計算 `willBecomeUntaggedCount`，定義為操作完成且完整清單去重後 `tags` 為空字串的受影響交易數。
- [ ] 驗證 old tag 存在；非移除操作不得產生空 replacement list；單一 replacement 不得等於 old tag。
- [ ] 以 `flatMap()` 替換每筆交易中的精確 old tag token，最後用 `joinTags()` 對完整清單去重。
- [ ] 覆蓋移除最後一個 tag、保留其他 tag、拆分後撞到既有 tag、輸入自身重複與大小寫不同等案例。
- [ ] 執行 build，預期先顯示舊 UI callback 型別需要更新，再進入後續 task 完成串接。

### Task 3：更新 App persistence 與同步 callback

**Files:**

- Modify: `App.tsx`

- [ ] 將 preview callback 改接 replacement tags；移除操作明確傳入空陣列。
- [ ] 將 execute callback 改用 `replaceTagInTransactions()`，不複製 tag 轉換邏輯。
- [ ] 保留 `bulkPut` 前的 `version + 1`、`updatedAt`、pending 與 error 清理欄位。
- [ ] 依 operation 組裝移除、更名與拆分摘要，不把多個 tag 壓成單一字串名稱。
- [ ] 保留離線回傳、pending sync、refresh 與部分失敗處理。
- [ ] 手動 review `App.tsx` diff，確認交易 id、timestamp、version、updatedAt 以外欄位沒有意外變更。

### Task 4：更新 SettingsPage 與 Tag 管理 UI

**Files:**

- Modify: `components/SettingsPage.tsx`
- Modify: `components/settings/TagManagementSection.tsx`

- [ ] 更新 props 與 local preview state 型別。
- [ ] 將輸入值用 `splitTags()` 轉為 replacement list，再送入 preview callback。
- [ ] 保留一般預覽與確認流程；多個 replacement tag 必須分成個別 chip 顯示，避免被理解為單一含空白名稱。
- [ ] 在一般操作之後、相關交易之前新增獨立紅色移除區塊，第一階段只顯示「預覽移除 #tag」。
- [ ] 預覽成功後顯示紅色 feedback card，列出 `affectedCount`、`willBecomeUntaggedCount` 與不刪除交易的說明，再顯示「確認移除 #tag」。
- [ ] 移除流程只使用頁內 preview 與確認按鈕，不新增 SweetAlert2；任一新 preview 會使另一種操作的舊 preview 失效。
- [ ] 單一 replacement 完成後選取新 tag；拆分或移除後清除選取並保留結果訊息。
- [ ] 同步失敗時保留「查看同步狀態」入口。
- [ ] 執行 `npm --prefix worktrees/tag-remove-and-split run build`，預期成功且沒有 TypeScript 錯誤。

### Task 5：更新行為文件並完成 mock sync 驗證

**Files:**

- Modify during cleanup: `README.md`
- Move during cleanup: `docs/todo-references/tag-remove-and-split.md`
- Modify during cleanup: `TODO.md`
- Modify during cleanup: `CHANGELOG.md`

- [ ] 在 `README.md` §6.10 記錄移除、拆分、完整清單去重與完成後選取狀態。
- [ ] 執行 `npm --prefix worktrees/tag-remove-and-split run docs:check`，預期 `docs-check: OK`。
- [ ] 等使用者執行 `/start-local-server` 後，使用 `mock://cloud-sync` 驗證一般更名、拆分、移除、離線與同步失敗 UI。
- [ ] 以 `Ipass Ipass永豐` fixture 將 `Ipass永豐` 拆成 `Ipass` 與 `永豐`，確認 Tag 管理出現兩個獨立 tag、各自可查詢，且原有 `Ipass` 不會重複。
- [ ] 移除交易唯一 tag，確認交易仍存在、`tags` 為空字串、version 遞增且狀態為 pending。
- [ ] 驗證移除 preview 的受影響筆數與無 tag 筆數正確；變更輸入或切換 tag 後，舊的確認按鈕必須消失。
- [ ] 完成 push、pull 與 conflict 手動流程，確認雲端 payload 收到更新後 tags，未覆寫其他交易欄位。
- [ ] 使用者驗收後再執行 `/git-branch-cleanup`，由該流程更新完成紀錄、commit、合併並移除 worktree。

## 測試計劃

- 自動檢查：`npm run build`、`npm run docs:check`。
- 純函式案例：單一更名、多 tag 拆分、兩個 token 可獨立查詢與彙整、replacement 內重複、與交易原有 tag 重複、移除中間 token、移除唯一 token、精確 token 與大小寫敏感。
- 資料與同步案例：每筆 affected transaction 只遞增一次 version；updatedAt 不重複；pending 與 error 清理正確；離線保留本機變更；mock push、pull、conflict 完整通過。
- 專案目前沒有測試框架，本項目不額外導入 runner；純函式案例與同步案例使用固定 fixture 手動驗證。

## 假設

- `Transaction.tags` 仍以單一空白分隔儲存；字串 `Ipass 永豐` 代表 `Ipass` 與 `永豐` 兩個 tag token，tag 名稱本身不可包含空白。
- tag 名稱仍區分大小寫；`Ipass` 與 `ipass` 不會互相去重。
- 拆分維持原 tag 所在位置，去重保留整筆交易中第一次出現的 token 順序。
- 移除不刪除交易，也不改動交易的 id、timestamp、金額、分類、商家、付款方式或備註。
- 實作期間不 commit；使用者完成瀏覽器與 mock sync 驗收後，由 `/git-branch-cleanup` 產生單一完整 commit。
