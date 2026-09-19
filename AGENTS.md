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
- `components/stats/*.tsx` — chart components owned by the stats page

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
- `tags` stored as **single space-separated string**, not array. Token-based exact match (no substring matching). Every write path serializes through `joinTags()` in `services/tagService.ts` — normalize, dedupe, sort by code point. Code point rather than `localeCompare` so the stored string is engine-independent across devices; keep new write paths on that helper.
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

## Sync endpoints — testing vs production

Two Google Apps Script deployments are in use. The URLs differ only in the deployment id:

| Sheet | Deployment id starts with |
|---|---|
| Testing | `AKfycbzU3ZXS` |
| Production | `AKfycbwX4dBp` |

Full URLs are deliberately absent from version control — this repo is public and the sync token is weak, so a published `exec` URL is a writable handle on the sheet. They live in `workdocs/gas-endpoints.md` (gitignored) and in each browser profile's Dexie `settings` table.

**Before seeding fixture transactions in a browser**, check `syncApiUrl` in that origin's Dexie `settings` table. `mock://cloud-sync` is inert; either deployment id above is a real network write, and the app-boot pending sweep uploads on its own without a user action. GAS has no delete path (R3), so fixtures that reach the production sheet come back only by hand.

IndexedDB is per-origin, so serving the dev build on a port that has never been used gives a fresh `CozyPocketDB` with no credentials — `getSyncConfig()` returns `null` and no upload path exists. That is cheaper and more reliable than remembering to check the URL.

## Known debt (intentional, not bugs)

These three files are oversized and the developer knows it. **Refactor opportunistically when touching them; do not force-break them as part of unrelated work.** (Line counts intentionally omitted — they drift; `wc -l` if you need the current number.)

| File | Why it's heavy | Guidance |
|---|---|---|
| `App.tsx` | The app's largest file: view routing + shared state + CRUD + sync orchestration + merchant/tag rename in one component. | New full pages must NOT add to it — extract `*Page.tsx` instead. Decomposition tracked in `docs/todo-references/app-tsx-decomposition.md`. |
| `AddTransactionModal.tsx` | Form state + AI parsing + validation in one file. | Keep the mock/AI/validation paths intact when editing. |
| `cloudSyncService.ts` | Sync engine + inline `mock://cloud-sync` backend in the same file. | Mock split is tracked debt; keep the mock path working. |

**Planned moves**: tracked per-plan in `docs/todo-references/`, with status flags (🔴🟡🟢) in `TODO.md`.

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

### Data-risk zones

Classify every change with three questions: (1) does it write to the `transactions` table or the Google Sheet? (2) does it affect the sync merge decision (version / updatedAt / payload comparison)? (3) is it a guard for a destructive operation (confirm dialog, id-prefix filter, mock-vs-real routing)? All three "no" → green, edit freely.

**Red zone — a mistake causes permanent loss, and the error is silent (no throw, build stays green, `tsc` cannot catch it; the damage surfaces only on the next sync/pull).** Change any of these only with a hand-reviewed diff and a manual `mock://cloud-sync` run exercising push / pull / conflict:

- **R1 — sync merge decision.** `compareLocalAndCloud` and the pull merge `put` in `services/cloudSyncService.ts`. A wrong verdict overwrites unsynced local edits with cloud data. The tie-break where cloud wins on content mismatch at equal version+updatedAt is deliberate, not a bug.
- **R2 — upload payload shape.** `toPayloadItem` in `services/cloudSyncService.ts`, typed by `SyncPayloadItem` in `types.ts`. GAS reads fields by name, so a renamed or dropped field silently writes blanks to the cloud backup. Keep the two in sync; `syncStatus` / `lastSyncError` must never be uploaded.
- **R3 — GAS sheet I/O.** `docs/google-apps-script-phase1.js`: `SHEET_HEADERS` order, the column indices in `loadRecordMap` / `processGetItems`, and `resolveSyncDecision`. This script has no clear/deleteRow anywhere — that invariant is the floor of the whole safety model. Do not add one.
- **R4 — Dexie schema.** Existing shipped `version()` stores in `db.ts`. New version + additive migration only; editing a shipped version corrupts local DBs.
- **R5 — full-wipe guards.** `commitImport` overwrite mode and `resetLocalData` in `components/SettingsPage.tsx`, plus their confirm flows. These are the only two "clear everything" operations and the confirm dialogs are the sole guard. Reset also wipes the sync credentials, so a user cannot recover from cloud without re-entering them.
- **R6 — transaction id + version.** Id generation and the version / updatedAt bump in `App.tsx`. Ids are the identity used for cross-device and cloud merge; a wrong id or a missed version bump causes silent overwrites.
- **R7 — epoch-seconds invariant.** `toEpochSeconds` in `time.ts`. It gates every write path; a millisecond value leaking through syncs up to the cloud and poisons the backup, which has no self-heal.

**Orange zone — corruption or pollution, but cloud-recoverable:** delete-path filters (e.g. the `sample-tx-` prefix), merge-type renames (willMerge is irreversible), CSV import validation, `prepareMockPullFixture` (writes the real Dexie table, isolated only by the `mock-demo-` prefix), sample-data-to-cloud pollution, `dialogService` confirm semantics.

**Green zone — edit freely:** presentation components, read-only compute (`statsService`, `analyticsService`), preferences / localStorage, `networkService` (failing toward skip is fail-safe), Gemini parsing (only prefills a form, human confirms), pull-report display. Green ≠ ruleless — PWA layout has its own gotchas doc.

**Last-resort recovery:** the cloud is Google Sheets, which keeps File → Version history. If a bad payload pollutes the sheet, that history is the only way back — local IndexedDB has no equivalent. Full zone rationale and the remaining guardrail steps: `docs/todo-references/data-risk-guardrails.md`.

### Coding style

- **Code, comments, log strings: English / ASCII only.** UI-facing strings can be Chinese.
- **Dexie import**: `import Dexie from 'dexie'` — never named import. Named import breaks subclass typing of `this.version()`. Non-negotiable.
- **Lucide icons**: explicit per-icon imports only. No wildcards (`vite.config.ts` manualChunks depends on this).
- **Gemini API key**: read from Dexie `settings` table at runtime. Never expect a build-time env var. There is no `.env` file by design.
- **TypeScript strict** — no `as any`, no `// @ts-ignore` without a written justification.

### Quality gates

- **Code gate: `tsc --strict`** (runs as part of `npm run build`)
- **Docs gate: `npm run docs:check`** (`scripts/docs-check.mjs`) — validates markdown links resolve, completed references contain no plan-language, and every reference doc is linked from `TODO.md` / `CHANGELOG.md`. Run it after any docs change.
- No tests (none. Zero. This is fine for the project's scope.)
- No ESLint / Prettier / Biome
- CI (`.github/workflows/deploy.yml`): a `docs-check` job runs `npm run docs:check`; the `build` job runs `npm run build` and is what gates deployment.

When making data-correctness changes (CSV import/export, sync merge, AI parsing), prefer:
- Small, reviewable diffs over batched refactors
- Manual exercise of mock sync (`mock://cloud-sync`) for sync changes
- Clear inline assertions where behavior is subtle

### Documentation discipline

The docs system has four moving parts. Know which one a fact belongs in:

- `TODO.md` — **active work only** (🔴 high / 🟡 planned / 🟢 evaluated-and-deferred). Not a changelog.
- `CHANGELOG.md` — **completed work**, grouped by the same sections as `TODO.md`. When an item ships, move its line here (keep the `docs/completed-references/` link); do not leave ✅ items piling up in `TODO.md`.
- `docs/todo-references/<slug>.md` — the design note / plan for one planned or in-flight item, or a **deprioritized/rejected decision** (those stay here, marked 🟢 in `TODO.md` — they are not "completed", so they do not move to `completed-references/`).
- `docs/completed-references/<slug>.md` — the design note for a shipped feature. **Treat these as immutable snapshots**: once written, don't update them as behavior evolves. Ongoing behavior changes go to the README §6 behavior spec (the living source of truth); the completed reference records what shipped at the time.

When you finish work that has a `todo-references/<slug>.md` plan, `git mv` it to `completed-references/` and rewrite it from plan language into a completed record (see workflow step 5). A deprioritized item is the exception — it stays in `todo-references/`.

**Run `npm run docs:check` after any docs change** — it catches broken links, plan-language left in completed references, and reference docs nothing links to.

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
- **Do not commit before the user accepts the result in step 4b.** A green build and a clean agent browser pass are both necessary but not sufficient — the user's own browser verification is part of the contract. The whole point of holding the commit is that step 4 is iterative: user finds something, code changes, HMR re-renders, user looks again. Committing after each round produces a churn of fix-up commits that nobody wants in `git log`. Keep the working tree dirty across the entire verify→tweak→re-verify loop; bundle everything into the single commit that step 5 produces.

**4. Browser verification**

Two layers, both required: the agent verifies in the Claude desktop app's in-app Browser on its own initiative, then the user accepts in a real browser. The first catches regressions before the user spends attention on them; the second covers what the in-app Browser structurally cannot reach.

**4a. Agent self-verification in the in-app Browser — automatic, no prompt**

- Run this yourself once `npm run build` is green. Do not wait for `/start-local-server`; that command is for when the user wants to drive the browser personally.
- The `mcp__Claude_Browser__preview_*` tools start the dev server themselves, from a named configuration in **the main repo root's `.claude/launch.json`**. A copy inside the worktree is not read — `preview_start` reports "No .claude/launch.json found" and names the main-root path. A configuration that carries only a `url` (attach to a server you started by hand) is rejected on this machine: it must carry `runtimeExecutable`, so the tool owns the server process.
- `runtimeArgs` needs `--prefix worktrees/<slug>` for the same reason every other npm call does — without it the server boots from `main` and you verify stale code. Pick a port nothing else holds, checked with `lsof -nP -iTCP:<port> -sTCP:LISTEN`, since parallel worktrees routinely occupy 5173:

```json
{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "cozy-pocket-verify",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["--prefix", "worktrees/<slug>", "run", "dev", "--", "--port", "5200"],
      "port": 5200
    }
  ]
}
```

- A never-before-used port is also the cheapest safety guard available. IndexedDB is per-origin, so a fresh port means a fresh `CozyPocketDB` with no sync credentials; `getSyncConfig()` returns `null` and fixture data has no path to the real Google Sheet. See "Sync endpoints — testing vs production". The skill carries a one-line assertion for this, so it can be checked instead of assumed.
- `preview_start` returns the `serverId` every later `preview_*` call needs, and `preview_logs` prints the whole Vite banner including the `Local:` URL — read it there rather than tailing a log file.
- The tab opens on an `Awaiting server…` placeholder whose `data:` origin makes relative navigation throw. Navigate with an absolute URL (`preview_eval` → `location.href = 'http://localhost:<port>/Cozy-Pocket/'`), then follow the `claude-browser-cozy-pocket` skill.
- Report what the browser pass settled *and* what it could not, then hand to 4b. Never present it as full verification.

**What the in-app Browser can and cannot settle**

- Settles: field values and component state, DOM geometry (`getBoundingClientRect`, `scrollWidth` vs `clientWidth`), element presence, rendered text, navigation, `preview_console_logs`, `preview_network`, and screenshots — which render correctly even when the pane is not on screen.
- Geometry needs `preview_resize` first. When the session is not open in a window the WebView has a 0×0 viewport, so every measurement silently reads zero; `preview_resize` to 390×844 installs a real layout viewport. The desktop app clears it at the end of a turn, so re-apply it in every turn that measures.
- With that viewport in place, narrow-width behavior belongs in 4a, not 4b: wrapping of long Chinese names, card and paragraph overflow, and `document.documentElement.scrollWidth` vs `window.innerWidth` are all assertable here. What is genuinely left for 4b is what standalone PWA mode owns — safe-area insets, PWA chrome, header continuity — plus touch event ordering.
- Never read a tool's own success string as evidence. `preview_click` and `preview_fill` report success on work they did not do; confirm every step with an independent `preview_eval` read of the DOM or Dexie.
- Cannot settle: anything depending on cancelling a pointer or mouse default action. The dependable way to drive this app is `preview_eval` + `element.click()`, which dispatches `click` alone with `isTrusted=false` — `pointerdown` and `mousedown` never happen, so `preventDefault()` has nothing to cancel and focus moves anyway, which makes a *correct* fix look broken. `preview_click` is the only tool that could deliver a real pointer sequence and it cannot be relied on: with the pane off screen it reports success and delivers no events at all. Touch-specific event ordering and standalone PWA layout are equally out of reach.
- When a result falls in that second category, say so explicitly and route it to 4b. Reporting it as a failure is wrong.
- CSS animations do not run while `document.visibilityState === 'hidden'`, which is the normal state when the session is not open in a window. SweetAlert2 gates its teardown on `animationend`, so a confirm dialog strands: the action itself registers, but the popup stays in the DOM with `.swal2-confirm` disabled, and the container keeps covering whatever you want to click next. Check the popup's class list before suspecting `dialogService`; the skill carries the two ways out.

**4b. User acceptance — still gated on the user**

- Hand back with the browser findings and whatever remains open. The user verifies in Microsoft Edge (`open -a "Microsoft Edge" <url>`) and, for anything layout- or touch-related, on the iPhone standalone PWA — the primary runtime, where desktop passes do not transfer.
- Pointer-default behavior always lands here. The agent cannot dispatch a trusted pointer sequence, so a fix for focus retention, drag handling, or custom selection is unverified until the user looks at it.
- When the user reports no visual change after an edit, the cause is almost always service-worker cache from a previous dev run. Tell them to hard-reload (`⌘+Shift+R`) or unregister the SW in DevTools → Application before debugging the code.
- Iterate on user feedback with HMR; restart the server only when the project root changes (different worktree, dep change) — edit the launch configuration, `preview_stop` the old `serverId`, then `preview_start` again.

**5. Cleanup — delegate to `/git-branch-cleanup`**

**Wait for the user to invoke `/git-branch-cleanup` before starting this step.** The user's invocation is the signal that step 4 verification has been accepted and the feature is ready to land — until then, assume they may still iterate on the implementation. Once the skill fires, it owns the finalization sequence:

- Stop the dev server (`preview_stop` with its `serverId`; do this proactively before the skill runs if it's still streaming).
- Update `README.md` (§6 behavior spec + operations cheat sheet) and any affected `docs/*.md`.
- Move the item's line from `TODO.md` to `CHANGELOG.md` (under the matching section), with the link target flipped to `docs/completed-references/<slug>.md`.
- `git mv docs/todo-references/<slug>.md docs/completed-references/<slug>.md`, then rewrite the body from plan language into a completed record: drop the worktree-setup paragraph, replace 測試計劃 → 驗證, use past-tense final-state wording.
- Run the doc audit: `npm run docs:check` (links, plan-language, orphans), then grep the old slug across `README.md`, `TODO.md`, `CHANGELOG.md`, `docs/` to confirm no stale references remain.
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
- `docs/app-icon-ios-liquid-glass.md` — what makes iOS 26 apply Liquid Glass to the app icon, and the artwork constraints that follow. Read before touching `public/icon.svg`
- `docs/google-apps-script-phase1.js` — backend implementation
- `docs/user-feedback-inventory.md` — inventory of user-feedback mechanisms (dialogs / toasts / inline status) and which to use when
- `docs/completed-references/` — design notes for shipped features (immutable snapshots)
- `docs/todo-references/` — design notes for planned/in-flight work and deprioritized decisions
- `TODO.md` — active work only (🔴🟡🟢)
- `CHANGELOG.md` — completed work, grouped by section

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
