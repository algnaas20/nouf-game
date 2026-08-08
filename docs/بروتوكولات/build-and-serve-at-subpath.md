# Protocol: build, stage, and serve at a genuine sub-path

**Owner:** WL-D (packaging/delivery) · **First written:** 2026-08-08, after PH-D1's build/gates work and PH-D3's PWA work both needed it — later than owed (see note at the end).
**Language:** English (v3 §11 — audience is agents); this line only is Arabic for indexing.

**الغرض:** يوثّق هذا الملف كيف تُبنى الحزمة، تُنسخ إلى مسار فرعي حقيقي، وتُخدَّم وتُفحص ببراوزر حقيقي — بحيث لا يعيد أي منفِّذ لاحق اكتشاف الطريقة من الصفر.

---

## 1. Why this exists

`https://<owner>.github.io/nouf-game/` serves the site from a **sub-path**, not the root. A local dev server (`vite dev`/`vite preview`) always serves from `/`, so it can never catch the single most common "worked locally, broke live" bug class (static-delivery-investigation.md §2). This protocol is the only thing that does.

## 2. The procedure

1. **Clean build**: delete `dist/`, run `npm run build`. The four delivery gates (`scripts/gates/**`) run inside `closeBundle` and fail the build on any violation — this is not a separate review step.
2. **Stage a sub-path**: create `verify/nouf-game/` (or `verify-pwa/nouf-game/` for a PWA-focused run), copy the **entire** `dist/` output into it.
3. Assert `.nojekyll` exists in the staged copy.
4. **Re-run the gates against the staged copy**, not just `dist/` — proves the copy step introduced nothing new.
5. **Serve `verify/` as the server root** (`scripts/static-server.ts`) on the reserved port, plain static file serving, **no SPA fallback** — an unmatched path must 404, not silently resolve to `index.html`.
6. **Real Chromium via Playwright**, fixed viewport (1920×1080, `deviceScaleFactor: 1`), listening on `response`/`requestfailed`/`console`/`pageerror`. Navigate to `http://127.0.0.1:<port>/nouf-game/` (never the root — a root-path control check, `GET http://127.0.0.1:<port>/` expecting 404, proves this is a genuine sub-path test).
7. Screenshot. Print the accepted evidence line (below). Kill the server, verify the port is free.

## 3. The accepted evidence line

```
built <hash> · served from /nouf-game/ · Chromium <ver> · N requests · 0 failed · X.X MB transferred · M files · largest file Y MB
```

`<hash>` = SHA-256 of the staged output's sorted `{relPath, size}` pairs, truncated to 12 hex (`scripts/serve-subpath.ts`'s `buildFingerprint()`) — a content fingerprint of the actual staged bytes, not a git commit (this worktree may be uncommitted at verification time).

**Explicitly rejected as evidence:** `file://`, the dev server, serving at the root path, "the screenshot looks fine", a passing local Windows-server run used to claim case correctness (§4 below explains why).

## 4. Case sensitivity — the one thing a local run can never prove

Windows/NTFS is case-insensitive; GitHub Pages is case-sensitive. A local static server on Windows resolves `Logo.PNG` when the reference says `logo.png` — **it will never fail this class of bug**. Case correctness is proven only by gate 4c (`scripts/gates/case-audit.ts`), a static, case-sensitive filesystem check, run as part of step 4 above — never inferred from "the browser loaded it fine."

## 5. What changed for PH-D3 (PWA) — read this before staging a build with a service worker

- `dist/sw.js` is **generated**, not source (`scripts/vite-plugin-pwa.ts`, `closeBundle`, runs **before** the delivery gates in the plugin array so gate 4a/4b/4c/4d also scan it). It embeds a `CACHE_NAME` derived from a build-scoped `BUILD_ID` (`scripts/pwa/build-id.ts`) — regenerated, and different, on every `npm run build`.
- **A genuine, previously-blind gap in gate 4a was found and fixed while building this**: esbuild's minifier (used by this project's real `vite build`) rewrites plain single/double-quoted string literals with no interpolation into **backtick** template-literal strings — e.g. `register('/sw.js')` in source came out of a real build as `` register(`/sw.js`) ``. Gate 4a's original regex family only matched `["']` as the opening quote; it silently passed the backtick form. Fixed in `scripts/gates/leading-slash-scan.ts` (the quote character class now includes `` ` ``), proven red→green as **Mutation 4** in `scripts/gates/prove-red-green.ts`. **Lesson for future gate authors: any "scan the emitted output for pattern X" gate must account for what the actual minifier in this toolchain does to string literals, not just what the source looks like.**
- **Offline verification needs an extra step beyond "visit once, go offline, reload"**: the very first-ever navigation to a page happens *before* any service worker exists to intercept it, so a `networkFirst` fetch handler's own `cache.put()` side effect never fires for that first document load — only a *second*, already-SW-controlled navigation would populate the cache that way. To make "after ONE successful visit, offline works" literally true, the service worker's `install` handler must **also** explicitly `cache.add('./')` (the navigation-scope URL) as a best-effort step, separately from the asset precache list. Discovered empirically (`net::ERR_FAILED` on the very first offline reload attempt) while building `scripts/pwa/verify-pwa.ts`; fixed in `scripts/pwa/generate-sw.ts`'s `install` handler.
- Run `npm run verify-pwa` (`scripts/pwa/verify-pwa.ts`) for the PWA-specific live checks (cache-name-changes-per-build, offline replay, visible version string, robots meta, the publish-recipe overlay) — a sibling script to `npm run rehearsal`, same staging/serving pattern, different assertions.

## 6. Known pre-existing gap in `npm run rehearsal` itself (not fixed here, flagged)

`scripts/serve-subpath.ts` asserts `document.getElementById('app')?.dataset.bootstrapped === 'true'` as its "did the app shell actually boot" signal. As of PH-D3 (2026-08-08), **this assertion is stale and the rehearsal now fails on an unmodified checkout**: a later merge (WL-B's stage wiring) rewired `src/main.ts` to call the real `mountApp()` (`src/stage/app.ts`) instead of PH-D1's placeholder module, and `mountApp()` never sets that dataset flag. `scripts/pwa/verify-pwa.ts` works around this for its own purposes by checking for `.stage-root` (the real, currently-mounted class name) instead — but `scripts/serve-subpath.ts` itself was not touched (out of this session's declared scope; flagged to the coordinator in `worklog-D3.md`). **Whoever next runs `npm run rehearsal` should expect it to fail on this exact assertion until it is updated to check for a currently-real signal.**

---

*Written by the executor during PH-D3 (2026-08-08), consolidating PH-D1's procedure (which owed this file but did not write it) with PH-D3's additions — v3 §8 (protocol library) discharged for this file now, later than ideal.*
