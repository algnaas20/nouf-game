# بروتوكول: تصوير وقياس المسرح العربي (RTL, 1920×1080) — منهجية V1–V28

**المالك:** WL-B (المسرح) · **تاريخ الكتابة:** 2026-08-08، بعد تشغيل حقيقي كامل لحزمة PH-B4 (`tests/stage/verify-pack.manual.cjs`) — لا قبل ذلك (v3 §8).
**اللغة:** إنجليزية للتفاصيل التقنية (جمهورها الوكلاء)؛ هذا السطر والعنوان فقط عربي للفهرسة.

**Debt discharged:** the deterministic-framing and hidden-ceiling techniques worked out across PH-B1→PH-B4 (`worklog-B1.md`, `worklog-B2.md`, `worklog-B3.md`, `worklog-B4.md`), consolidated here so the next agent touching `src/stage/**` does not re-derive them from scratch. Every technique below was exercised for real in this session's `verify-pack.manual.cjs` run — this is not a plan, it is a description of code that ran and produced the numbers cited.

---

## 1. The one fixed harness shape every check in this pack uses

```js
const { chromium } = require('playwright');
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
await page.goto(URL); // http://localhost:3011/ — a running `npx vite --port 3011 --strictPort`, never a build/preview server for these checks
```

- **`deviceScaleFactor: 1` is load-bearing.** `--stage-unit: min(100vw/1920, 100vh/1080)` (`tokens.css`) resolves to exactly `1px` only at this exact viewport and scale factor — this is what makes every `getComputedStyle().fontSize` measurement an exact, hand-checkable number instead of a device-pixel-ratio-scaled approximation. Any other DPR turns V1's "exact match" criterion into a fuzzy one.
- **Always a fresh `page` per independent check**, not one page reused for everything. The stage has no router (D-11) — navigating between "screens" is a full re-render of `#app`'s contents driven by local closures inside `mountApp`, and several checks need to inject fixtures that bypass `mountApp` entirely (see §2). Reusing a page across unrelated checks risks stale DOM/state bleeding between them; a fresh page costs milliseconds and removes that whole class of doubt.
- **Never `file://`, never the built/preview output for these checks** — always the live Vite dev server on the assigned port (3011), so `import()` (§2) resolves TypeScript sources directly through Vite's transform. The build/dead-code/sub-path rehearsal is a *different*, WL-D-owned protocol (`build-and-serve-at-subpath.md`) — do not conflate the two.

---

## 2. Importing real stage modules straight into the page — never a copy of the render logic

Every non-trivial check imports the ACTUAL TypeScript module from `src/stage/**` from *inside* `page.evaluate`, via Vite's dev-server module transform, and calls the real exported function with a hand-built fixture:

```js
results.something = await page.evaluate(async ({ fixture }) => {
  const mod = await import('/src/stage/screens/question-text.ts');
  const appRoot = document.getElementById('app');
  appRoot.innerHTML = '';
  const container = document.createElement('div');
  container.className = 'stage-root';
  appRoot.appendChild(container);
  mod.renderTextQuestionScreen(container, { /* real QuestionScreenParams-shaped object */ });
  await new Promise((r) => setTimeout(r, 50)); // let synchronous DOM work settle
  // ...measure the real DOM mod just built...
}, { fixture });
```

**Why this matters (§7.1-style discipline, same spirit as `tools/sim/harness.ts`):** a verification script that re-implements "what the screen should look like" and compares against ITS OWN reimplementation proves nothing — it can only ever agree with itself. Every check in this pack calls the same `render*Screen`/`build*` functions `src/stage/app.ts` calls in production, with the same-shaped params object. A regression in the real renderer is a regression the check will see, because there is no second implementation to silently drift out of sync.

**The `.stage-root` wrapper is mandatory on every injected fixture**, even ones that only render a single sub-component (e.g. `chrome.ts`'s `buildStatusStrip` alone). `font-family: 'Cairo', ...`, `font-synthesis: none`, `color`, and `background` are all declared on `.stage-root`, not on `body` or any individual component class — a probe element appended straight to `document.body` silently falls back to the *browser's own default font and colours*, which can make a broken check spuriously **pass** (both sides equally wrong) just as easily as spuriously fail. This exact mistake was made and caught twice in PH-B2 (documented in `worklog-B2.md` §4 item 5b: a V3/V27/V28 probe rig read "Times New Roman" because it wasn't inside `.stage-root`) and is why every fixture-building snippet in this pack wraps its probes in a `.stage-root` div, even a hidden/off-screen one (`position: fixed; opacity: 0`) built purely for measurement.

---

## 3. The "hidden ceiling" technique for overflow checks (V4, V5, V8)

**What it is:** measuring `element.scrollHeight - element.clientHeight` on the actual rendered box, at the exact worst-case fixture, is only meaningful while the element still has a real, non-`none` `max-height`/`max-block-size` acting as a ceiling. Once a shrink-to-fit routine (`fitQuestionText` in `src/stage/fit-text.ts`) converges and then — correctly — clears `max-height` (so nothing is left to visually clip against, per its own design), `scrollHeight === clientHeight` becomes **trivially true regardless of the box's actual height**, because there is no longer a ceiling for content to overflow past.

**Concretely, this was caught for real in PH-B1** (`worklog-B1.md` §V4b): the literal "V4: `scrollHeight <= clientHeight`" acceptance criterion read a clean `0` on a box that was, by direct `getBoundingClientRect()` measurement, visibly **65px taller than the space available to it** and overlapping the options grid below. The overflow metric was satisfied by construction (no ceiling left to violate) while the real defect — colliding with a NEIGHBOUR element — was completely invisible to it.

**The fix, standing in every subsequent phase's checks:** never rely on `scrollHeight <= clientHeight` alone once a fit routine may have cleared its own ceiling. Always pair it with a **direct neighbour-collision measurement** — `elementA.getBoundingClientRect().bottom - elementB.getBoundingClientRect().top` (or the RTL/inline equivalent) — on the worst-case combined fixture (F2: 150-char question + four 50-char options, simultaneously, the single most content-dense state the layout must survive). This is `verify-pack.manual.cjs`'s `V4.<scale>.f2OverlapPx` and its ancestor, `verify-b2.manual.cjs`'s `combinedOverlap`/`overlapMutation` blocks. A negative number means no collision; `+N` means an `N`px real, visible overlap — read it as a literal pixel measurement, not a boolean.

**A second, related trap this pack's own V4 check fell into and fixed (PH-B4, this session):** `.option-text` is an inline `<span>` inside `.option-card` (a `<button>`). Inline non-replaced elements report unreliable, often non-zero `scrollHeight`/`clientHeight` in Chromium even when there is visibly nothing to overflow (measured: 8–15px of "overflow" on a one-word fixture with obvious room to spare). **Always measure the block-level container** (`.option-card`, not `.option-text`) for this class of check — the harness bug, root-caused live, is documented in `verify-pack.manual.cjs`'s `measureOverflow` comment.

---

## 4. Deterministic-scale framing (×1.00 / ×1.15 / ×1.30)

`--scale-step` is driven purely by a `data-scale` attribute on `<html>`, read from `tokens.css`'s `:root[data-scale='100'|'115'|'130']` rules — never a media query, never a JS-computed viewport heuristic:

```js
await page.evaluate((s) => document.documentElement.setAttribute('data-scale', s), '130');
```

Set this **before** navigating fixtures into the page (or immediately after `page.goto`, before rendering anything) so every subsequent measurement in that `page` instance is unambiguously at that scale step. Never assume a default — the attribute is absent until explicitly set, which resolves to `--scale-step: 1` (the `:root` fallback), so omitting it silently means ×1.00, not "whatever the last check happened to leave it at" (each check in this pack uses a fresh `page`, so this is moot in practice, but is worth stating explicitly for anyone tempted to share a page across scale steps for speed).

---

## 5. `document.fonts.ready` — when to wait for it, and when NOT to

- **Always** `await page.evaluate(() => document.fonts.ready)` before any type-scale (V1), ink-metric (V2/V7), contrast (V3), or overflow (V4/V9) measurement. Any shrink/grow-to-fit logic in `src/stage/**` is itself gated on this same promise (per the project-wide constraint checklist row 15's spirit — "any auto-fit/shrink logic runs after `document.fonts.ready`, never on first paint") — measuring before the font has actually swapped in silently measures the FALLBACK stack's metrics, not Cairo's, and will not match this pack's expected numbers.
- **Never** await it for V8 (webfont-blocked capture) — the whole point of that check is to confirm the *fallback* stack still lays out cleanly when the real font never arrives. `document.fonts.ready` for a permanently-blocked face family never resolves; awaiting it hangs the check forever. Block the font network request instead (`page.route('**/*.woff2', (route) => route.abort())`, set up **before** `page.goto`) and give the fallback stack a fixed short settle time (a few hundred ms) instead of a promise that will never fire.

---

## 6. RTL mirror checks (V6) — reading `getBoundingClientRect()` correctly under `dir="rtl"`

`getBoundingClientRect()` always returns **physical, LTR-measured viewport coordinates** (`x=0` is the browser window's own left edge) regardless of the page's `dir` attribute — RTL does not flip the coordinate system, only the layout algorithm that decides where boxes end up within it. This means:

- **"First in reading order" (rightmost on screen) has the LARGER `.right`/`.left` values**, not the smaller ones. A first option card (أ) that is genuinely mirrored correctly will have `rectA.right > rectB.right` (and typically `rectA.left > rectB.left` too, for cards of similar width) — confirmed live this session: `optionARect: {left:976, right:1824}` vs `optionBRect: {left:96, right:944}`.
- **CSS Grid's numbered columns follow the container's writing-direction start edge, not literal left-to-right.** `grid-template-columns: auto 1fr` under `dir="rtl"` places "column 1" (`auto`) at the container's **right** edge and "column 2" (`1fr`) to its left — and grid items are auto-placed into those numbered columns by **DOM/source order**, not by any visual left/right the author may have had in mind while writing the CSS. **A real, measured defect this exact confusion caused, found and fixed in this session (PH-B4):** `question-image.ts`'s Beat 2 appended `optionsCol` before `imageCol` while `grid-template-columns` was `1fr auto` — this placed the OPTIONS in the rightmost column and the IMAGE in the leftmost one, the exact opposite of `stage-ux-investigation.md` §6.2's explicit wireframe ("the image column sits on the inline-start (right)"). Caught by measuring `imageColRect.right > optionsColRect.right` and getting `false`; confirmed as a real regression (not a check bug) via a red→green mutation — `git stash` the two-file fix, re-run, observe `imageRightOfOptions: false`, `git stash pop`, re-run, observe `true` again. **The fix is two coupled changes, not one**: swap the DOM append order (`beat2.append(imageCol, optionsCol)`) AND swap the grid-template-columns declaration to match (`auto 1fr`, so the fixed-size image box lands in the auto-sized column, not stretched across a flexible one). Changing only one of the two produces a different, equally wrong layout.
- **For a genuinely block-level "which side" check** (not a grid), measure the two candidate boxes' `.left`/`.right` directly rather than trusting `justify-content`/`flex-direction` intuition transplanted from LTR experience — always verify with a real render, never by reading the CSS and reasoning about it in the abstract (this whole section exists because that reasoning is exactly what got the original `1fr auto` order wrong in the first place).

---

## 7. Digit/score layout-shift checks (V14) — which edge is actually anchored

For a `justify-content: space-between` flex row with **N** items, item `k`'s **anchored edge is the one nearest its own end of the row**, not uniformly `.left` for every item. Concretely, for `.status-strip` (team A first, team B second, RTL): team A's block is pinned to the strip's **start** edge, which is its own `.right` in viewport coordinates (not `.left`) — only team A's `.left` is expected to move as its own content (the score's digit count) changes. **A check that measures `.left` for every item uniformly will falsely flag team A's own legitimate, expected growth as a "shift" bug** — this happened live in this session's first V14 draft (`teamAStartShiftPx: 40.03`, matching exactly one digit's tabular-nums advance width, i.e. real expected growth, not a defect) and was fixed by measuring `.right` (the true anchored edge) for team A instead. **Always identify which physical edge of each flex item `justify-content` actually pins before writing the "must not move" assertion**, and confirm by direct measurement, not by symmetry assumption.

The companion invariant that IS a real defect if violated: an element with **no relationship at all** to what changed (team B's whole block, when only team A's score changes) must show **zero** movement on **both** axes — `Math.abs(rectAfter.left - rectBefore.left) + Math.abs(rectAfter.top - rectBefore.top) < 0.5`. This was red→green mutation-tested live this session by temporarily overriding `.status-strip`'s `justify-content` from `space-between` to `flex-start` (via a direct, reverted CSS edit — not a code path a runtime override could reach) and confirming `teamBShiftPx` jumps to exactly one digit's width (`40.03px`, matching `allDigitsEqualWidth`'s own measured per-glyph width) before being restored.

---

## 8. Greyscale distinguishability (V12) and other colour-independent checks

Apply `filter: grayscale(100%)` to `.stage-root` via `page.addStyleTag`, never to `body` or the whole page — the filter must affect exactly the surface a spectator would see, no more, no less:

```js
await page.addStyleTag({ content: '.stage-root { filter: grayscale(100%); }' });
await page.screenshot({ path: '...' });
```

Pair the screenshot with a **structural** assertion, not just a human eyeball on the PNG — this pack asserts `strokeDasharray` differs between the two maze lanes, and that the two token shapes are different SVG tag names (`circle` vs `rect`), both read via `getComputedStyle()`/`tagName` **before** any `.remove()` call (see §9 on the live-DOM staleness trap). The screenshot is supporting visual evidence for a human reviewer; the structural read is the actual pass/fail signal a script can assert on.

---

## 9. `getComputedStyle()` returns a LIVE object — read into plain values before removing the element

`getComputedStyle(el)` returns a `CSSStyleDeclaration` that stays **live-bound** to `el`. Reading a property from it *after* calling `el.remove()` (or otherwise detaching it from the document) returns an **empty string**, silently — not the last value it held. This bit two separate checks in PH-B2 (`worklog-B2.md` §4 item 5b: V3/V27/V28 probes) and was avoided in every subsequent check in this pack by always capturing every needed computed value into a plain local variable **before** any `.remove()` call:

```js
const color = getComputedStyle(probe).color; // read into a plain string NOW
rig.remove(); // safe — `color` is already a copied value, not a live reference
```

---

## 10. Font decision provenance (V2, V7, V27, V28) — what is a gate and what is record-only

- **V2** (Arabic ink-height ratio) was **downgraded from a hard gate to a one-time recorded calibration** by `addendum-v2-ruling.md` §6 after PH-B1's original measurement (`"بخ"` at 100px → ratio 1.03, over 13× the original ±8%-of-0.50 tolerance) turned out to be a baseline-semantics fact about Arabic script, not a font defect (a bare Latin "x" measured close to 0.50; every Arabic sample, including a dotless bare alef, measured 0.71–1.03). The corrected recipe (single "ه", alphabetic baseline, expected band 0.45–0.55) is what this pack's V2 section runs — it is **informational**, re-run only if the font file itself changes, never a pass/fail gate.
- **V7** (font A/B dot-gap, Cairo vs IBM Plex Sans Arabic) was a **provisional pre-decision check** (`stage-ux-investigation.md` §3.2/§8) meant to inform which font to ship, back before any font was chosen. The font decision (Cairo, self-hosted, re-subset for full glyph coverage) is closed and shipped (`addendum-v2-ruling.md`, V27/V28) — IBM Plex Sans Arabic was never fetched or self-hosted for this product. This pack's V7 section therefore measures **Cairo only**, for the record, and marks the A/B comparison itself `N/A` rather than fabricating a number for a font that was never actually integrated. Do not resurrect this as a live gate without a real reason to reopen the font decision.
- **V27/V28** (declared weight range spans the full variable-font axis with no synthesis; digits share the Arabic text's font family) are real, standing gates — re-run them on **any** change to `@font-face`, the font file itself, or the font stack in `.stage-root`.

---

## 11. Fixture set (F1–F8) — canonical definitions, `stage-ux-investigation.md` §8

| Fixture | What it is | Used by |
|---|---|---|
| F1 | Shortest realistic question, four one-word options | V1, V6, V20/V21 |
| F2 | Longest allowed question (150 chars) + four 50-char options | V4, V8, V9 |
| F3 | Landscape image 16:9 | V11 |
| F4 | Portrait image 3:4 | V11 |
| F5 | Audio question, broken-source variant | V22 |
| F6 | Team names at the 18-char cap, Latin+digit mix | (reserved — not yet exercised by any script in this pack; see §12) |
| F7 | Score `9 → 10` | V14 |
| F8 | Same question × 4, correct option rotated through أ/ب/ج/د | V20/V21 |

Reuse these EXACT literal strings across checks and phases — a fixture redefined slightly differently each time it is used silently invalidates any cross-phase comparison of the resulting numbers (this is why `verify-pack.manual.cjs` keeps `F1`/`F2_TEXT`/`F2_OPTIONS` as top-of-file constants rather than inlining slightly-different strings per check).

---

## 12. Known gaps in this pack, disclosed (do not silently treat as covered)

- **A bare Playwright `text=` selector is a whole-page SUBSTRING match, not a button match — never use it for a click on this stage.** Recurred a third time in worklog-B5.md (2026-08-08), after `worklog-B4.md`'s own §D.1 first documented it (a deck-mismatch screen's own explanation paragraph containing the word "جلسة جديدة" inside a longer sentence): this session's NEW zero-question home-screen guidance copy ("...أضف أسئلتك من «أسئلتي»...") made `text=أسئلتي` ambiguous against the home screen's own `<p>`, and Playwright silently resolved to the inert paragraph, not the button — no error, the click simply did nothing. **Rule going forward: every click selector in every `tests/stage/*.manual.cjs` script must be scoped to an element kind, e.g. `button:has-text("...")`, never a bare `text=...`.** When two buttons' labels could substring-match each other (e.g. «ابدأ» vs «ابدأ اللعبة»), add a `:not(:has-text("..."))` exclusion rather than relying on DOM order or luck.
- **F6 (team-name stress fixture) is defined but not yet exercised by any script in this repository.** No check in `verify-b1/b2/b3/pack.manual.cjs` renders team names at the 18-char cap with Latin+digit content. A future pass should add a check confirming `.type-team-name` neither overflows nor breaks `dir="auto"`/bidi isolation with this fixture.
- **V23 (backup-chip contrast) and V25 (emitted backup filename) are outside WL-B's file ownership** (`src/editor/**`/WL-C and `src/pack/**`/WL-D respectively) and cannot be built or measured from this worktree — `verify-pack.manual.cjs` marks both `"status": "N/A_TO_WL-B"` rather than silently omitting them from the report.
- **V7's dot-gap heuristic is approximate, not a clean per-dot measurement**, at the specific font/size this pack uses (Cairo 700, 60px) — a simple ink-column scan finds 4 blobs in the glyph's top 45% band, not a clean 2 (likely including part of the tooth/connector stroke alongside the two dots). Since V7 is record-only (§10) this was not chased further; a future need to reopen the font decision should build a more precise dot-isolation routine (e.g. connected-component labelling with a size/aspect-ratio filter) rather than trusting this pack's `dotGapPx` as authoritative.
- **`localStorage` is shared across every `browser.newPage()` opened from the same `browser` instance** (it is scoped to the browser *context*, not the page) — found while building `tests/stage/verify-resume.manual.cjs` (PH-A4's resume prompt, `worklog-B4.md`'s addendum). A script that plays a real game far enough to reach `GAME_STARTED` (which now genuinely calls `saveSession` — `src/stage/session/game-driver.ts`'s `persist()`) leaves a resumable session behind; any LATER `page.goto()` in the same script, on a fresh `page` but the same `browser`, will land on the resume-prompt screen instead of `'home'` if it doesn't clear `localStorage` first. No check in this pack's current ordering happens to trip this, but it is fragile against reordering. Either call `page.evaluate(() => localStorage.clear())` before `page.goto()` when a fresh `'home'` landing is required, or open a `browser.newContext()` per independent scenario instead of reusing pages on one context.

  **Correction (worklog-B5.md, 2026-08-08 — v3 §8):** re-tested directly against this worktree's installed `playwright` package (not `playwright-core`) with a minimal two-page probe (page 1 writes `localStorage`/an IndexedDB record via a real `DraftStore`, closes; page 2 opens fresh and reads back) and got the OPPOSITE result on both storage mediums: **`browser.newPage()` creates an isolated context per call in this installation — neither `localStorage` nor IndexedDB is visible on the second page.** (`{"seenOnSecondPage":null}`, `{"seenOnSecondPageIdb":0}`.) This is consistent with Playwright's own documented `Browser.newPage()` contract ("Creates a new page **in a new browser context**"). Do not trust the paragraph above as a standing fact about this project's tooling — it may have reflected a different Playwright version, a different launch option, or simply been a misdiagnosis at the time. **The safe, version-independent assumption going forward is the opposite of what that paragraph says: assume each `newPage()` is storage-isolated, and explicitly seed (via a real `DraftStore`/`localStorage.setItem`) whatever a given scenario needs on ITS OWN page** — this is what `tests/stage/verify-b5.manual.cjs` and the D-25-era re-points of `verify-b2/b3/pack/editor-entry/resume.manual.cjs` (worklog-B5.md) all do. If a future script genuinely observes cross-page sharing again, re-verify with the same minimal-probe technique before trusting either claim — do not assume, measure.
