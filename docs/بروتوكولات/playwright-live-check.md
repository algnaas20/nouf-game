# Protocol: writing a real-browser Playwright live check in this project

**Owner:** WL-D (packaging/delivery) · **First written:** 2026-08-08 (PH-D3), consolidating conventions already used by PH-D1's `scripts/serve-subpath.ts` and WL-C's `tests/editor/live/**` scripts, plus PH-D2/D3's own additions.
**Language:** English (v3 §11); this line only is Arabic for indexing.

**الغرض:** توحيد الطريقة التي يُكتب بها أي فحص حي (Playwright + Chromium حقيقي) في هذا المشروع، وتسجيل الأفخاخ الحقيقية التي وقعنا فيها فعلًا، حتى لا يُعاد اكتشافها.

---

## 1. The shape every live script in this repo follows

- A dedicated port from the reserved range (3010+, never 3000), matching whichever line/port table dispatched the work.
- `vite`'s JS API (`createServer`) or the hand-written `scripts/static-server.ts`, never `vite dev`'s HMR/dev-only behaviour presented as evidence of anything about the *built* artefact.
- Real `chromium.launch()` from the `playwright` package (not `@playwright/test`'s test runner — these are plain Node scripts, run with `npx tsx <script>.ts`, not `npx playwright test`).
- Listen on `pageerror` and `console` (error level) from the very first `page` creation — a silent JS exception must never be allowed to pass as "the screenshot looked fine."
- Print every real number the acceptance criteria ask for, even when the check passes (v3's verification rule: "never assert 'it works'").
- Kill the server / close the browser in a `finally` block; verify the port is free afterward.

## 2. The `tsx` + `page.evaluate` `__name is not defined` trap

**Already documented in full in `docs/بروتوكولات/tsx-playwright-page-evaluate.md`** (WL-C, PH-C2) — read that file first. Summary: never write a `page.evaluate` callback (in a script run via `tsx`) containing an internal *named* function/arrow binding; put real logic in a separate file the browser loads via Vite's normal module graph (`import()` with a non-literal specifier from inside the page), keep the Node-side `evaluate` callback a trivial one-line dispatcher. This project's WL-D scripts (`tests/pack/live/pack-roundtrip.ts`) follow the same split (`tests/pack/live/browser-fixtures.ts` holds the real logic).

## 3. New traps found while building PH-D2/PH-D3 (this session)

### 3.1 `showSaveFilePicker` exists in headless Chromium (on `http(s)://`, not on `data:`/`about:blank`) but cannot be driven by any automation tool

Probed directly: `typeof window.showSaveFilePicker` is `'function'` on a page served over `http://127.0.0.1:<port>/...`, `'undefined'` on `data:` or a blank new page — the File System Access API appears to require a non-opaque, potentially-secure origin even to be *exposed*, regardless of automation. Calling it from `page.evaluate()` (which carries **no** real user-activation signal) resolves near-instantly with a `DOMException` named `AbortError` — production code that (correctly) treats `AbortError` as "the user cancelled" will silently take that branch and return `null`, which looks exactly like a real cancel and is easy to misdiagnose as a hang or a logic bug elsewhere.

**No automation tool, headless or headed, can drive a native OS Save dialog.** If your code's design has a `showSaveFilePicker` branch with a universal fallback (as `src/pack/save-to-device.ts`'s `writeBlobToDevice` does), the only way to test the fallback branch in an automated script is to force it: `delete window.showSaveFilePicker` in your test harness page *before* calling the function under test, with a comment explaining why (see `tests/pack/fixtures/pack-harness.html`). Do **not** weaken the production code itself (e.g. adding a `navigator.webdriver` check) just to make it testable — that couples shipped behaviour to automation detection for no user-facing benefit.

### 3.2 `Promise.all([page.waitForEvent('download'), page.evaluate(...)])` needs `acceptDownloads: true` and a real anchor-download code path — verify the picker isn't silently intercepting first

Once 3.1's fix (deleting `showSaveFilePicker` in the harness) was in place, the standard `Promise.all([page.waitForEvent('download'), page.evaluate(triggerFn)])` pattern worked exactly as documented, on the first try, with `context = await browser.newContext({ acceptDownloads: true })`. Before that fix, the exact same code hung for the full 30s default timeout with **zero** errors surfaced anywhere (not from `page.evaluate`, not `pageerror`, not `console`) — because the underlying code was `await`-ing a promise (`showSaveFilePicker()`) that resolved to `null` almost instantly on the `AbortError` path, and `saveBackupToDevice()` faithfully returned `null` without ever reaching the anchor-download code at all. **If a `waitForEvent('download')` never fires and nothing else errors, suspect a Save-picker/AbortError branch swallowing the call before it reaches the download code — instrument the return value first, not the event listener.**

### 3.3 `indexedDB.deleteDatabase()` reports `"blocked"`, not an error, when the same tab holds an open connection — this is correct behaviour, not a failure

Calling `deleteDatabase()` from the same page whose own `DraftStore` still holds an open IndexedDB connection fires `onblocked`, not `onerror` — the delete request stays **pending** (not failed, not cancelled) until that connection closes. A `page.reload()` immediately after is sufficient to let it complete (the reload closes the old page's connection). **Do not treat `"blocked"` as a test failure; the actual gate is a post-reload emptiness check** (`await store.load(); assert questions.length === 0`), which is the real proof the wipe took effect — not the `deleteDatabase()` callback's own event.

## 4. Screenshot filenames

Latin ASCII only (project-wide rule, v3's verification rules section). Every screenshot referenced from a worklog in this project follows this — `version-badge-online.png`, `offline-reload.png`, `publish-recipe-open.png`, etc.

---

*Written by the executor during PH-D3 (2026-08-08) — v3 §8 (protocol library) discharged for this file now, later than ideal (owed since PH-D1; see `build-and-serve-at-subpath.md`'s closing note for the same admission).*
