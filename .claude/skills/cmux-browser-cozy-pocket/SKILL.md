---
name: cmux-browser-cozy-pocket
description: >-
  Cozy Pocket-specific browser verification guidance layered on top of the
  user-scope cmux-browser skill. Use after /start-local-server when testing this
  repository's React PWA, SweetAlert2 flows, Chinese UI text, sample data, or
  tag and merchant management in cmux.
---

# Cozy Pocket cmux browser verification

## Load the base skill

Before running browser commands, read
`/Users/gtso/.claude/skills/cmux-browser/SKILL.md` completely. Treat it as the
source of truth for current cmux syntax, surface targeting, snapshot refs,
waiting, form interaction, screenshots, and troubleshooting. Do not duplicate
those instructions here.

## Start from the correct app

- Wait for the user to invoke `/start-local-server` before starting browser
  verification.
- Use the Local URL emitted by the feature worktree's dev server. The expected
  path is `/Cozy-Pocket/`; do not assume port `5173` when another port was
  assigned.
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
  `.swal2-popup`, then interact with `.swal2-confirm` or `.swal2-cancel`.
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
