---
name: claude-browser-cozy-pocket
description: >-
  Cozy Pocket-specific verification guidance for the Claude desktop app's
  in-app Browser (the `mcp__Claude_Browser__preview_*` tools). Use whenever
  verifying a change to this repository's React PWA from the agent side —
  invoke it on your own initiative once the build is green (AGENTS.md step 4a),
  not only after /start-local-server. Covers the launch configuration, the
  limits that apply while the Browser pane is off screen, SweetAlert2 flows,
  Chinese UI text, sample data, and tag and merchant management.
---

# Cozy Pocket in-app Browser verification

The `preview_*` tool descriptions carry the general syntax. This skill carries
what is specific to this app, plus the traps that cost a verification round
when they are met for the first time.

## Start the server

- Start this verification yourself once the build is green; do not wait for
  `/start-local-server`. That command is for when the user wants to drive the
  browser personally.
- The launch configuration must live in the **main repo root's**
  `.claude/launch.json`, even when the code under test is in a worktree. A copy
  inside the worktree is not read. It must carry `runtimeExecutable` — a
  configuration that only carries a `url`, to attach to a server started by
  hand, is rejected on this machine.
- `runtimeArgs` needs `--prefix worktrees/<slug>`, or the server boots from
  `main` and you verify stale code. Choose a port nothing else holds, checked
  with `lsof -nP -iTCP:<port> -sTCP:LISTEN`; parallel worktrees routinely
  occupy `5173`, and a fresh port also yields a fresh per-origin
  `CozyPocketDB` with no sync credentials, so fixtures cannot reach the real
  Google Sheet.
- Keep the `serverId` that `preview_start` returns; every later call needs it.
  `preview_logs` prints the Vite banner with the `Local:` URL.
- The tab opens on an `Awaiting server…` placeholder whose `data:` origin makes
  relative navigation throw. Navigate with an absolute URL and confirm arrival:

  ```js
  location.href = 'http://localhost:<port>/Cozy-Pocket/'
  ```

  The base path is `/Cozy-Pocket/`. Never hardcode the port in notes or docs —
  read it from the banner.
- Assert the fresh database instead of trusting the fresh port. On a clean
  origin the `settings` store holds preference keys only, with no `syncApiUrl`
  and no `syncToken`:

  ```js
  (async () => {
    const open = indexedDB.open('CozyPocketDB');
    return new Promise((res, rej) => {
      open.onsuccess = () => {
        const req = open.result.transaction('settings', 'readonly').objectStore('settings').getAllKeys();
        req.onsuccess = () => res(req.result);
        req.onerror = () => rej(req.error);
      };
      open.onerror = () => rej(open.error);
    });
  })()
  ```

- The page reloads on its own during a long pass — HMR and the auto-updating
  service worker are both in play, and a reload has also been seen with no
  obvious trigger. Anything installed on `window` dies with it, so check a
  helper still exists before using it, or re-install it each round.
- If an edit does not appear at all, hard-reload or unregister the service
  worker before debugging the implementation.
- Desktop verification supplements, but does not replace, final layout
  verification in iPhone standalone PWA mode.

## Check whether the pane is on screen first

`document.visibilityState` decides which of the tools below actually work. It
reads `hidden` whenever the session is not open in a window — the normal state
for an unattended agent run — and then:

- The viewport is 0×0, so every `getBoundingClientRect` reads zero and every
  geometry assertion silently passes or fails on nothing. Call `preview_resize`
  with an explicit 390×844 before measuring — the iPhone logical width this
  app targets, which `preset: "mobile"` does not give you (it is 375×812). The
  override is cleared at the end of a turn and when the pane's width changes,
  so set it again in each turn that measures.
- CSS animations do not run at all — not a slowdown, a full stop: a 200ms
  keyframe fires neither `animationstart` nor `animationend`. See the
  SweetAlert2 section.
- `preview_click` reports success and delivers no events. Drive the app through
  `preview_eval` instead.
- Screenshots still render correctly, at the emulated viewport size.

## Driving the app

- `preview_eval` + `element.click()` is the primary driver. React `onClick`
  handlers fire normally through it.
- `preview_click` is best-effort. It has been seen to fail on the first attempt
  with a press coordinate that does not match the element's own box — the
  0×0 viewport again — then succeed on an identical retry, and to report
  `Successfully clicked` while delivering no events at all. Never build a flow
  that depends on it.
- **No tool's success string is evidence.** `Successfully clicked` and
  `Successfully filled` describe the attempt, not the outcome. Confirm each
  step by reading the DOM or Dexie back through `preview_eval`; that is the
  only reason a silent no-op does not corrupt a whole verification pass.
- `preview_fill` is reliable for this app's React controlled inputs — the value
  reaches React state, not just the DOM. Assigning `.value` through `eval` does
  not, and remains wrong.
- Order matters in the management sections: in 商家管理 select the merchant
  first and fill the new name second. Filling first loses the value, because
  selecting clears the field.
- Settings navigation uses icon-only buttons whose accessible name lives in
  `aria-label` or `title`. The data settings entry is `aria-label="資料管理"`;
  do not rely on `textContent` for it.
- Chinese labels are nested across elements, so a settings row's `textContent`
  arrives as one run-on string — the sync row reads
  `同步設定設定雲端同步，並查看同步狀態。可執行同步`. Match a distinctive
  fragment with `textContent.includes('同步設定設定雲端同步')`; an equality
  test against `'同步設定'` finds nothing. A small helper is worth re-installing
  each round:

  ```js
  window.__btn = (frag) => [...document.querySelectorAll('button')].find(b => b.textContent.includes(frag));
  ```

- Do not use this pass to judge behavior that depends on suppressing a pointer
  or mouse default action — suggestion chips that must keep the input focused,
  drag handles, custom selection. `element.click()` dispatches `click` alone
  with `isTrusted=false`; `pointerdown` and `mousedown` never happen, so
  `preventDefault()` has nothing to cancel and focus moves anyway, making a
  correct fix look broken. `preview_click` is the only tool that could deliver
  a real pointer sequence, and it is not dependable enough to settle the
  question. Route those to the user's Edge or iPhone pass and say why, rather
  than reporting a failure.

## SweetAlert2 confirm dialogs

Confirmation prompts are SweetAlert2, not native browser dialogs: wait for
`.swal2-popup`, then click `.swal2-confirm` or `.swal2-cancel` through `eval`.
Both of its animations strand while the pane is off screen, because the library
gates on `animationend`:

- On open, the popup keeps `swal2-show` and `opacity: 0`. It is in the DOM and
  its buttons work, but it is invisible in screenshots. Assert against the DOM
  (`.swal2-title`, `.swal2-confirm`), never against a picture.
- After confirming, the popup can keep `swal2-hide` with `.swal2-confirm`
  disabled for as long as the page lives. **The action itself already ran** —
  check the toast, the section status, or Dexie before suspecting
  `dialogService`.
- A stranded `.swal2-container` stays `display: grid` and covers what you want
  to click next, so confirm the popup is gone before the next round.
- Two ways out. Dispatching the animation event the library is waiting for
  completes the teardown, popup and container both, and clears the `body`
  class:

  ```js
  document.querySelector('.swal2-popup')?.dispatchEvent(
    new AnimationEvent('animationend', { bubbles: true, animationName: 'swal2-hide' })
  )
  ```

  `location.reload()` also clears it, at the cost of in-page state. Neither
  trick revives the open animation: a popup that never faded in stays at
  `opacity: 0`.

## Toasts and status assertions

- The global toast lives 1800ms. A separate tool call arrives too late, so
  click and read inside a single `preview_eval`:

  ```js
  (async () => {
    window.__btn('儲存同步設定').click();
    await new Promise(r => setTimeout(r, 700));
    return document.querySelector('.animate-slide-up p')?.textContent ?? null;
  })()
  ```

- A missing toast is not automatically a failure. The toast and a section's own
  status line are mutually exclusive presentations, so an absent status line is
  itself evidence that the flow took the toast branch.
- Read a section's status from the card it renders in, and keep the assertion on
  the rendered text plus the semantic class the card carries, not on a colour
  read off a screenshot.

## Narrow-width geometry

Long Chinese merchant and tag names are what break these layouts, and that is
settleable here rather than in the user's pass. With the 390×844 viewport in
place, measure the element and the page together:

```js
window.__geo = (sel) => {
  const el = document.querySelector(sel);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const lh = parseFloat(getComputedStyle(el).lineHeight);
  return {
    text: el.textContent,
    width: Math.round(r.width),
    lines: Math.round(r.height / lh),
    overflowX: el.scrollWidth - el.clientWidth,
    pageOverflowX: document.documentElement.scrollWidth - window.innerWidth,
  };
};
```

`pageOverflowX` must stay 0 — this app never scrolls horizontally at phone
width. Screenshots are trustworthy for this kind of check, since they render at
the emulated size, but keep the verdict on the numbers.

## Local data side effects

- Verification can mutate IndexedDB by inserting sample transactions or
  renaming tags and merchants.
- Sample transaction IDs use the `sample-tx-` prefix.
- Clean up through `危險操作` -> `刪除範例資料`, or use the documented full
  local reset only when the user intends to remove all local data.
- Stop the server with `preview_stop` when the pass is over, so the next
  verification starts from a known port.

## Tag rename verification

1. If the clean database has no tags, open `危險操作`, insert sample data, and
   confirm the SweetAlert2 prompt.
2. Open data settings through the `資料管理` accessible label, then enter
   `Tag 管理`.
3. Select a tag, fill the new name with `preview_fill`, and choose
   `預覽影響筆數`.
4. Verify the preview count, confirm the rename, and wait for the updated state.
5. Assert the success status and renamed tag chip, then check
   `preview_console_logs` for new errors.
