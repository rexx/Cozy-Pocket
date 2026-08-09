---
name: cmux-browser-cozy-pocket
description: >-
  Cozy Pocket-specific browser verification guidance layered on top of the
  user-scope cmux-browser skill. Use whenever verifying a change to this
  repository's React PWA in cmux — invoke it on your own initiative once the
  build is green (AGENTS.md step 4a), not only after /start-local-server.
  Covers SweetAlert2 flows, Chinese UI text, sample data, and tag and merchant
  management.
---

# Cozy Pocket cmux browser verification

## Load the base skill

Before running browser commands, read
`/Users/gtso/.claude/skills/cmux-browser/SKILL.md` completely. Treat it as the
source of truth for current cmux syntax, surface targeting, snapshot refs,
waiting, form interaction, screenshots, and troubleshooting. Do not duplicate
those instructions here.

## Start from the correct app

- Start this verification yourself once the build is green; do not wait for
  `/start-local-server`. That command is for when the user wants to drive the
  browser personally.
- Serve the feature worktree on a port nothing else holds, checked with
  `lsof -nP -iTCP:<port> -sTCP:LISTEN`. Parallel worktrees routinely occupy
  `5173`, and a fresh port also yields a fresh per-origin `CozyPocketDB` with
  no sync credentials, so fixtures cannot reach the real Google Sheet.
- Use the Local URL the dev server emits. The expected path is `/Cozy-Pocket/`;
  never assume the port.
- If an edit does not appear, hard-reload or unregister the service worker
  before debugging the implementation.
- Desktop browser verification supplements, but does not replace, final layout
  verification in iPhone standalone PWA mode.

## Project-specific interaction notes

- Settings navigation uses icon-only buttons whose accessible name may be in
  `aria-label` or `title`. The data settings entry currently uses
  `aria-label="資料管理"`; do not rely on `textContent` for it.
- Cozy Pocket forms use React controlled inputs. Use the base skill's `fill` or
  `type` workflow; assigning `.value` through `eval` does not update React
  state.
- Prefer native cmux `click` actions for `PageHeader` icon buttons. Direct DOM
  `.click()` has failed on those controls in prior verification runs.
- Confirmation prompts use SweetAlert2, not native browser dialogs. Wait for
  `.swal2-popup`, then interact with `.swal2-confirm` or `.swal2-cancel`. If a
  popup stops responding, check for `swal2-hide` on it and `disabled` on
  `.swal2-confirm` before suspecting `dialogService`: a cmux pane that is not
  on screen stops running CSS animations, so `animationend` never fires and the
  popup strands even though the action already registered. Bring the cmux
  window to the foreground, or reload to clear it.
- Do not use cmux to judge behavior that depends on suppressing a pointer or
  mouse default action — suggestion chips that must keep the input focused,
  drag handles, custom selection. `click` dispatches synthetic events, so
  `preventDefault()` has nothing to cancel and focus moves anyway, making a
  correct fix look broken. Route those to the user's Edge or iPhone pass and
  say why, rather than reporting a failure.
- Chinese labels are often nested across elements. If `wait --text` is
  unreliable, wait on a stable selector or use a DOM assertion against the
  specific control or status region.

After navigation or state changes, follow the base skill's wait and re-snapshot
loop before using element refs or asserting results.

## Local data side effects

- Verification can mutate IndexedDB by inserting sample transactions or
  renaming tags and merchants.
- Sample transaction IDs use the `sample-tx-` prefix.
- Clean up through `危險操作` -> `刪除範例資料`, or use the documented full
  local reset only when the user intends to remove all local data.

## Tag rename verification

1. If the clean database has no tags, open `危險操作`, insert sample data, and
   confirm the SweetAlert2 prompt.
2. Open data settings through the `資料管理` accessible label, then enter
   `Tag 管理`.
3. Select a tag, fill the new name with the base skill's form workflow, and
   choose `預覽影響筆數`.
4. Verify the preview count, confirm the rename, and wait for the updated state.
5. Assert the success status and renamed tag chip, then check for new browser
   errors.
