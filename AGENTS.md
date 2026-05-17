# AGENTS.md

The single source of truth for any agent (Claude Code, Codex, Cursor, Aider…) or human working on Cozy Pocket. Project context first, then operational rules.

---

## What this is

Cozy Pocket is a **personal-use** React 19 PWA for tracking expenses. Single-developer, vibe-coded with AI as design partner. Frontend + Google Apps Script backend live in this repo. Cloud storage = Google Sheets.

Deployment: GitHub Pages at `https://rexx.github.io/Cozy-Pocket/`.

**Primary runtime: iPhone in standalone mode** (Add to Home Screen → PWA). Browser mode is not the target.

## Tech stack

- React 19 / TypeScript (strict) / Vite 6
- Tailwind v4 via `@tailwindcss/vite` (no config file)
- Dexie 4 (IndexedDB wrapper) — DB name `CozyPocketDB`, schema v2
- date-fns 4 / lucide-react / sweetalert2
- vite-plugin-pwa with `registerType: 'autoUpdate'`, `StaleWhileRevalidate`
- `@google/genai` for Gemini AI parsing (model `gemini-3.1-flash-lite-preview`, `thinking=MINIMAL`)

## Architecture at a glance

**Local-first.** All writes hit Dexie before anything else. Sync is best-effort layered on top.

```
User action → React state + Dexie write → background sync to GAS → Google Sheets
                                       ↘ (if offline / fail) → leave pending → retry on app boot or manual
```

**Key modules**:
- `App.tsx` — view routing, shared state, CRUD handlers, sync orchestration (currently fat — see "Known debt")
- `db.ts` — Dexie schema (3 tables: `transactions`, `settings`, `pullReports`)
- `services/cloudSyncService.ts` — sync engine + mock backend (see "Known debt")
- `services/geminiService.ts` — AI parsing
- `services/networkService.ts` — online/offline detection
- `components/*Page.tsx` — full pages
- `components/*Modal.tsx` — overlays (only `AddTransactionModal` currently)
- `components/settings/*Section.tsx` — settings subpages

**Pages (5)**: 首頁 / 搜尋 / 統計 / 資料與設定 / 同步狀態
**Settings subpages (7)** (under 資料與設定): 偏好設定 / AI 設定 / 同步設定 / Tag 管理 / 商家管理 / 匯入匯出 / 危險操作
**Other subpages (1)**: 同步紀錄 (`PullReportsPage`, entered from 同步設定)
**Overlays (1)**: 新增／編輯交易

Full hierarchy and component mapping: README §6.5.

## Sync model

- **Best-effort by design.** No exponential backoff, no aggressive retry. Failed syncs stay `pending`, retried on app boot or via 同步狀態 page (manual). User restarting the app is the expected recovery path — **do not add retry-storm logic**.
- **Conflict resolution**: `version` > `updatedAt` > content match. Two-way merge produces a `PullReport` saved locally for audit.
- **Sync triggers** (see README §9 for the full list): create / update / CSV import / save credentials / sample data insert / app boot pending sweep / manual button.
- **`syncStatus` is local-only** (`pending` / `syncing` / `synced` / `error`) — never sent in the upload payload.
- **Offline-aware**: writes always succeed locally; sync is skipped (not failed) when `networkService` reports offline.
- **Payload shape** must stay compatible with the deployed Google Apps Script (`docs/google-apps-script-phase1.js`).

## Mock cloud backend

`mock://cloud-sync` URL scheme is implemented **inline in `cloudSyncService.ts`** (~400 lines), backed by `localStorage`. It exists for two purposes:
1. Frontend UI testing without deploying GAS
2. Stand-in while the real GAS endpoint is in flux

**Status: short-term scaffolding.** Could/should be split out of `cloudSyncService.ts` eventually, but low priority. **When editing sync logic, keep the mock path working** — it's the developer's UI testing harness.

## Data model essentials

- Transaction `id` is generated from `Date.now()` (millisecond string).
- `timestamp` is **epoch seconds** (not ms) with seconds always `00` to enable precise minute-level ordering. `readableDateTime` is the human-readable mirror.
- `tags` stored as **single space-separated string**, not array. Token-based exact match (no substring matching).
- `merchant` stored on each transaction, not in a separate table. Rename = batch update of all matching transactions.

## iPhone PWA — load-bearing rules

The app is used in standalone PWA mode on iPhone. Layout is the most fragile area; the developer has hit multiple Safari/standalone quirks. Before changing layout-affecting code:

1. Read `docs/pwa-layout-gotchas.md`
2. `git log` on layout-related files / `docs/pwa-layout-gotchas.md` for prior incident fixes
3. **Do NOT** add `viewport-fit=cover` or `env(safe-area-inset-*)` — this has been deliberately rejected
4. Header background must stay `#1a1c2c` (matches PWA chrome) for visual continuity in standalone mode
5. Don't optimize for desktop browser appearance at the cost of standalone mode

Other PWA notes:
- `vite.config.ts` `base` is hardcoded to `/Cozy-Pocket/`. The PWA manifest scope/start_url match. Forking and redeploying requires updating both.
- Service worker uses `autoUpdate` — users get new code on next app open without prompt.

## Known debt (intentional, not bugs)

These three files are oversized and the developer knows it. **Refactor opportunistically when touching them; do not force-break them as part of unrelated work.**

| File | Lines | Status |
|---|---|---|
| `App.tsx` | ~1150 | Contains CRUD + sync orchestration + merchant/tag rename. New full pages should NOT add to it — extract `*Page.tsx` instead. Decomposition tracked in `docs/todo-references/app-tsx-decomposition.md`. |
| `AddTransactionModal.tsx` | ~1065 | Form state + AI parsing + validation in one file. |
| `cloudSyncService.ts` | ~1369 | Sync engine + mock backend in same file. Mock split is tracked debt. |

**Planned moves** (in `docs/todo-references/`):
- See `docs/todo-references/` for the full list of planned changes

---

## Operational rules

### Where new code goes

- **New full page** → `components/<Name>Page.tsx`. Do NOT add it as JSX inside `App.tsx`.
- **New overlay / modal** → `components/<Name>Modal.tsx`.
- **New settings subpage** → `components/settings/<Name>Section.tsx` + register the view key in `App.tsx` (e.g. `settings-foo`).
- **New service** → `services/<name>Service.ts`. Service modules own data flow; UI components only call them, do not bypass them.
- `App.tsx` is already too big — when adding shared state or handlers, extract a custom hook or service rather than piling onto `App.tsx`.

### What NOT to touch without strong reason

- **Dexie schema migrations** in `db.ts` — changing existing version stores corrupts users' local data. New version + additive migration only.
- **`viewport-fit=cover` / `env(safe-area-inset-*)`** — deliberately rejected for iPhone standalone PWA layout. Don't reintroduce.
- **Hardcoded base path `/Cozy-Pocket/`** in `vite.config.ts`, manifest, and HTML — changing it breaks the GitHub Pages deployment.
- **Sync payload shape** in `cloudSyncService.ts` — must stay compatible with the deployed Google Apps Script. `syncStatus` and `lastSyncError` are local-only and must NOT be uploaded.
- **`mock://cloud-sync` code path** — keep working when editing sync logic.

### Coding style

- **Code, comments, log strings: English / ASCII only.** UI-facing strings can be Chinese.
- **Dexie import**: `import Dexie from 'dexie'` — never named import. Named import breaks subclass typing of `this.version()`. Non-negotiable.
- **Lucide icons**: explicit per-icon imports only. No wildcards (`vite.config.ts` manualChunks depends on this).
- **Gemini API key**: read from Dexie `settings` table at runtime. Never expect a build-time env var. There is no `.env` file by design.
- **TypeScript strict** — no `as any`, no `// @ts-ignore` without a written justification.

### Quality gates

- **Sole automated check: `tsc --strict`** (runs as part of `npm run build`)
- No tests (none. Zero. This is fine for the project's scope.)
- No ESLint / Prettier / Biome
- CI = build only (`.github/workflows/deploy.yml`), no test step

When making data-correctness changes (CSV import/export, sync merge, AI parsing), prefer:
- Small, reviewable diffs over batched refactors
- Manual exercise of mock sync (`mock://cloud-sync`) for sync changes
- Clear inline assertions where behavior is subtle

### Documentation discipline

Two folders track design notes (in addition to inline comments):
- `docs/completed-references/` — for features already shipped
- `docs/todo-references/` — for planned / in-flight work

When you finish work that has a `todo-references/<name>.md` plan, move that file to `completed-references/` rather than deleting it.

### Implementation workflow

The standard end-to-end flow for non-trivial changes. Trivial fixes (typo, one-line tweak) can skip the worktree and commit straight on `main`; everything else uses this flow.

**1. Plan**

- Write the plan to `docs/todo-references/<slug>.md`. Slug is lowercase kebab-case, scoped (`stats-*`, `merchant-*`, `sync-*`, etc.).
- Plan sections: 摘要 / 關鍵變更 / 介面與型別 / UI 細節 / 測試計劃 / 假設. State the intended worktree path (`worktrees/<slug>`) so the next step is unambiguous.
- Add a `🟡 <one-line summary>。（計劃：[<slug>.md](docs/todo-references/<slug>.md)）` entry under the matching section of `TODO.md`.

**2. Worktree setup**

- `git worktree add worktrees/<slug> -b <slug> main` — feature branch from current `main`.
- If the plan rename / TODO edit is still uncommitted on `main`, stash it first (`git stash push -m "<slug> plan"`), then `git stash pop` inside the worktree so the plan files land on the feature branch with the implementation.
- `ln -s ../../node_modules worktrees/<slug>/node_modules` so the worktree shares the main repo's deps. Avoid `npm install` per worktree.

**3. Implement + self-verify**

- All worktree commands need an explicit prefix because the Bash tool's cwd does not persist between calls:
  - File edits: absolute paths.
  - Git: `git -C worktrees/<slug> <cmd>`.
  - npm: `npm --prefix worktrees/<slug> run <script>`.
- Run `npm --prefix worktrees/<slug> run build` after each meaningful change. This is the sole automated gate (tsc strict + Vite production build).
- **Do not commit before the user accepts the result in step 4.** A green build is necessary but not sufficient — the user's browser verification is part of the contract. The whole point of holding the commit is that step 4 is iterative: user finds something, code changes, HMR re-renders, user looks again. Committing after each round produces a churn of fix-up commits that nobody wants in `git log`. Keep the working tree dirty across the entire verify→tweak→re-verify loop; bundle everything into the single commit that step 5 produces.

**4. Browser verification**

- **Wait for the user to invoke `/start-local-server` before launching the dev server.** Do not auto-start the server after `npm run build` passes; pause and let the user decide when they want to verify in a browser. Once `/start-local-server` fires, follow the skill's steps:
  - Start dev server: `npm --prefix worktrees/<slug> run dev -- --host` in the background. Without `--prefix` the server boots from `main` and the user will see stale code.
  - Wait for the `Local:` URL via `until grep -q "Local:" <output-file>; do sleep 0.5; done` rather than fixed sleeps.
  - Open `http://localhost:5173/Cozy-Pocket/` in Microsoft Edge (`open -a "Microsoft Edge" <url>`).
- When the user reports no visual change after an edit, the cause is almost always service-worker cache from a previous dev run. Tell them to hard-reload (`⌘+Shift+R`) or unregister the SW in DevTools → Application before debugging the code.
- Iterate on user feedback with HMR; restart the server only when the project root changes (different worktree, dep change).

**5. Cleanup — delegate to `/git-branch-cleanup`**

**Wait for the user to invoke `/git-branch-cleanup` before starting this step.** The user's invocation is the signal that step 4 verification has been accepted and the feature is ready to land — until then, assume they may still iterate on the implementation. Once the skill fires, it owns the finalization sequence:

- Stop the dev server (do this proactively before the skill runs if it's still streaming).
- Update `README.md` (§6 behavior spec + operations cheat sheet), `TODO.md` (flip 🟡 → ✅, link target → `docs/completed-references/<slug>.md`), and any affected `docs/*.md`.
- `git mv docs/todo-references/<slug>.md docs/completed-references/<slug>.md`, then rewrite the body from plan language into a completed record: drop the worktree-setup paragraph, replace 測試計劃 → 驗證, use past-tense final-state wording.
- Run a doc audit: grep the old slug across `README.md`, `TODO.md`, `docs/` and confirm no stale links; grep plan-only phrasing (實作計劃 / 測試計劃 / 會 / 將) in the moved completed reference.
- Commit (HEREDOC commit message, subject + body explaining the why).
- `git rebase main`; on conflicts, resolve manually, rerun `npm run build`, then `git rebase --continue`.
- `git checkout main && git merge --ff-only <slug>` in the primary worktree.
- Remove the worktree's `node_modules` symlink first, then `git worktree remove worktrees/<slug>` and `git branch -d <slug>`.

### Operational reset

User-facing reset: 資料與設定 → 危險操作 → 「清除本機資料並重置」 (`localStorage.clear()` + delete `CozyPocketDB` + reload).

### Where to find more

- `README.md` §6 — extensive feature-level behavior spec, the source of truth for product behavior
- `docs/cloud-sync-specification.md` — full sync algorithm
- `docs/pwa-offline-implementation.md` — PWA / offline implementation notes
- `docs/pwa-layout-gotchas.md` — iOS Safari standalone layout traps
- `docs/google-apps-script-phase1.js` — backend implementation
- `docs/completed-references/` — design notes for shipped features
- `docs/todo-references/` — design notes for planned/in-flight work
- `TODO.md` — current todo list

---

## Commit Message Guidelines

- Commit messages should be more descriptive than a short one-line summary.
- Use a clear subject line plus a body when the change is not trivial.
- The expected level of detail should be similar to this example:

```text
Reduce build warnings by lazy-loading Gemini and splitting vendor chunks

Lazy-load the Gemini parser so AI code is only fetched when needed, replace wildcard lucide imports with an explicit category icon map, and add manual Vite chunking for React, Dexie, date-fns, icons, and AI dependencies.

This removes the 500 kB chunk warning and keeps the production build clean.
```

- The subject line should explain the user-visible or engineering outcome.
- The body should explain the main implementation choices, not just restate the title.
- Include enough context that someone reading `git log` can understand what changed and why without opening the diff immediately.
- For non-trivial changes, aim for:
  - 1 subject line
  - 1 to 2 short body paragraphs
  - concrete mention of the main technical actions taken
- Avoid vague commit messages such as `fix stuff`, `update`, `cleanup`, or `tweak build`.
