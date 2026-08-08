# Worklog — WL-B follow-on: media-resolver seam, editor entry point, PH-B4 visual pack

**Executor** · **Started 2026-08-08** · **Worktree** `../nouf-wl-b-stage` (branch `wl-b-stage`) · **Port 3011**
Assignment: coordinator message (three tasks — resolveMediaUrl seam, editor entry point, PH-B4) + `docs/تأسيس-المشروع/خطة.md` §PH-B4 + `docs/تأسيس-المشروع/تقارير/rtl-stage-ux-expert/stage-ux-investigation.md` §5.4 (editor placement) + §8 (V1-V14, V20-V26 definitions) + `addendum-v2-ruling.md` §6 (V27/V28).

**Status: CLOSED.** Written incrementally per v3 §3/§4 — an interruption partway through (account limit, not anything I did) hit mid-edit on Task 2; per the coordinator's resume instruction this file was the first thing saved on resume, before continuing. Do not commit — the coordinator commits.

---

## Closing-claims list (written before most measurement, filled in as evidence lands)

| # | Claim | Status | Evidence |
|---|---|---|---|
| T1-1 | `resolveMediaUrl?: (question: Question) => string \| null` added to `QuestionScreenParams`, exact agreed signature | **Done** | §1 |
| T1-2 | Absent → falls back to `resolveDemoMediaUrl` (zero regression) | **Measured PASS** | §1, §4 |
| T1-3 | Provided, returns string → that string used, not the demo one | **Measured PASS** | §4 |
| T1-4 | Provided, returns null → real, truthful failure state, not a silent demo substitution | **Measured PASS** | §1, §4 |
| T1-5 | Pre-existing WL-C integration break at merge, found and reported (not fixed — file ownership) | **Disclosed with exact diff** | §1 |
| T2-1 | «أسئلتي» reachable from home screen, visually secondary | **Measured PASS, screenshot** | §2 |
| T2-2 | Editor mounts the real `mountEditor`, not a duplicate | **Measured PASS (live DOM check)** | §2 |
| T2-3 | One deliberate way back («→ الرئيسية»), game still playable after | **Measured PASS, 0 page errors** | §2 |
| T2-4 | Editor not reachable mid-play (guest-safety claim) | **Structural proof (code-path argument)** | §2 |
| T3-1 | V1–V14, V20–V22, V24, V26–V28 measured fresh, one consolidated report | **Measured, all PASS after 4 real bugs found+fixed** | §3 |
| T3-2 | V23/V25 explicitly N/A to WL-B, not silently omitted | **Done** | §3 |
| T3-3 | Every new guard (V6, V14) proven red→green | **Done, pasted** | §3 |
| T3-4 | `docs/بروتوكولات/arabic-stage-screenshots.md` written from real output | **Done** | §5 |
| — | Bounded ×1.30 worst-case question-floor exception (B2 disclosure) — ruling: keep it, make it explicit and guarded | **Guard re-confirmed still green, bound restated exactly** | §6 |
| — | New Arabic string for the draw-ending headline, authored not paraphrased | **Flagged explicitly, unchanged from B3** | §6 |
| — | Full project checks green (excluding the one pre-existing, not-mine-to-fix WL-C error) | **tsc/vitest confirmed** | §7 |

---

## 0. Pre-work — merge, baseline

1. `git merge main` into `wl-b-stage`: **clean fast-forward** (`7bc512c..d9a97c6`), no conflicts. Brings in WL-C's C2+C3 (`src/editor/**`, `src/media/**`, `src/storage/idb.ts` — media intake/downscaling, stage preview, readiness meter, backup badge).
2. `npm install`: clean, `removed 23 packages, audited 53 packages, 0 vulnerabilities`.
3. **Baseline `npx tsc --noEmit` (before touching anything): FAILS, 1 error**:
   ```
   src/editor/ui/stage-preview.ts(87,5): error TS2353: Object literal may only specify known properties, and 'scores' does not exist in type 'QuestionScreenParams'.
   ```
   Confirmed pre-existing at merge (before any of my edits), in a file I do not own (`src/editor/**`, WL-C's). See §1 for the full diagnosis and the exact diff WL-C needs.

---

## 1. Task 1 — `resolveMediaUrl` injection seam (`src/stage/screens/question.ts`, WL-B-owned)

**Implemented exactly the agreed signature** (not changed without asking, per the coordinator's instruction):
```ts
resolveMediaUrl?: (question: Question) => string | null;
```
Added to `QuestionScreenParams`; used in both the image and audio branches via a small `resolveQuestionMediaUrl(p)` helper:
- **Not provided at all** → falls back to `resolveDemoMediaUrl(p.question.id)` (zero behaviour change for every already-verified B2/B3 demo-deck path).
- **Provided, returns a string** → that exact string is used as the URL.
- **Provided, returns `null`** (a real "no media resolved" case, e.g. an incomplete pack) → **empty string**, not a silent fallback to demo content. Verified empty `src` reliably fires the existing `error` listener on both `<img>` and `<audio>` in real Chromium (a throwaway Playwright probe, deleted after use, never committed: `{"imgEmptySrc":"error","imgSentinelSrc":"error","audioEmptySrc":"error"}`). This routes straight into the screens' own already-built truthful failure copy ("تعذّر عرض الصورة لهذا السؤال" / "تعذّر تشغيل المقطع…") — never a mismatched demo placeholder standing in for a real author's missing media.

**All three branches measured directly, real Chromium, `tests/stage/verify-resolve-media-url.manual.cjs`** (§4 has the full run):
```json
"branchAbsent":         { "matches": true }
"branchProvidedString": { "authoredUrlUsed": true }
"branchProvidedNull":   { "errorMsg": "تعذّر عرض الصورة لهذا السؤال. تابعوا بالسؤال نصّياً.", "truthful": true }
```

`npx tsc --noEmit` after this change: **same single pre-existing WL-C error as the baseline, nothing new** — confirms my change compiles clean on its own.

### The exact diff WL-C (or the coordinator) needs to apply to `src/editor/ui/stage-preview.ts`

**Not applied by me** — `src/editor/**` is WL-C's, file ownership is absolute. Root cause: `stage-preview.ts`'s call to `renderQuestionScreen` was written against an older/assumed shape of `QuestionScreenParams` — it passes `scores` (renamed `positions` by PH-B2) and is missing `mediaUi`, `setMediaUi`, and `onNoAnswer` (all added in PH-B2 for the real audio/image screens). This is a broader mismatch than just the media-URL seam. Current broken call:
```ts
renderQuestionScreen(stageRoot, {
  question: options.question, optionOrder, teamNames: PREVIEW_TEAM_NAMES, answeringTeam: 'A',
  scores: [0, 0], revealed: false, chosenOption: null, canUndo: false,
  onChoose: () => {}, onNext: () => {}, onUndo: () => {},
});
```
Needs, at minimum, to compile against the current `QuestionScreenParams`:
```ts
renderQuestionScreen(stageRoot, {
  question: options.question, optionOrder, teamNames: PREVIEW_TEAM_NAMES, answeringTeam: 'A',
  positions: [0, 0],              // renamed from `scores` by PH-B2
  revealed: false, chosenOption: null, canUndo: false,
  mediaUi: initialMediaUiState(), // new in PH-B2 — import from '../../stage/screens/media-ui-state'
  setMediaUi: () => {},           // inert preview, same spirit as onChoose/onNext/onUndo
  onChoose: () => {}, onNoAnswer: () => {}, onNext: () => {}, onUndo: () => {},
});
```
And, to fulfil this task's actual purpose ("the editor's preview must show the author's actual uploaded image/audio"), WL-C should also pass the new seam: `resolveMediaUrl: (q) => /* WL-C's own blob-URL resolution against the draft's media store, e.g. via src/storage/idb.ts / src/media/audio-element.ts's `URL.createObjectURL` pattern */`. I did not design that resolver's body — it needs WL-C's own media-store API, which is their territory. Flagging the exact shape/seam is my job here; wiring it is WL-C's.

---

## 2. Task 2 — editor entry point (`src/stage/app.ts` + `src/stage/screens/home.ts`, both WL-B-owned; `src/main.ts` unchanged)

Per `stage-ux-investigation.md` §5.4's ruling: "Same app, its own screen, reached only from the home screen. Not a mode toggle" — and WL-C's own `mountEditor` doc comment in `src/editor/app.ts` names this exact integration point verbatim ("WL-B's `src/main.ts` imports it and calls it when the author taps «أسئلتي» on the home screen"). The call site is `src/stage/app.ts` (which `src/main.ts` already delegates all mounting to via `mountApp(root)`) — no separate change needed in `main.ts` itself.

**Implementation:**
- `src/stage/screens/home.ts`: added `onOpenEditor: () => void` to `HomeScreenParams`; added a second button, «أسئلتي» (same word as `src/editor/copy.ts`'s own `AR_COPY.questionsTitle`), plain (non-`primary`) `op-button` styling — visually secondary to «ابدأ اللعبة».
- `src/stage/app.ts`: added `'editor'` to the `localPhase` union. A new `renderEditorShell(root, { onBack })`:
  - Appended as a **sibling of `.stage-root`** under the same outer `root`, never nested inside it — `.stage-root` is `position: fixed; overflow: hidden` clipped to the 1920×1080 canvas, and `src/editor/editor.css`'s own header states the editor is "not the 1920x1080 stage" (a normal scrolling document); nesting would silently clip any real question list.
  - Renders exactly one thing itself: a «→ الرئيسية» back button (WL-B-owned markup, not inside `src/editor/**`) — the one deliberate way back, matching §5.4's "not a mode toggle."
  - Calls `mountEditor(editorContainer)` (imported, read-only, from `../editor/app`).
  - `wrap` (`.stage-root`) is hidden (`wrap.hidden = true`), not destroyed, while the editor shows; un-hidden and the editor host removed on the way back.
- **CSS** (`src/styles/stage.css`): `.editor-shell`/`.editor-back-bar`/`.editor-back-button`/`.editor-shell-body`, plus `.home-secondary-button`. One real defect found and fixed during this work: `.editor-shell { min-block-size: 100%; }` resolved to nothing (its ancestor chain up to `#app`/`body` has no explicit, non-`auto` height), leaving `body`'s `#000` letterbox colour visible below short editor content — caught by screenshot (`verify-out/editor-shell-opened.png`, before/after both attached as evidence), fixed to `100vh` (does not depend on ancestor height resolution).

**Reachability argument (why this is not reachable "by accident in front of guests"):** the home screen (and therefore «أسئلتي») is only ever rendered when `localPhase === 'home'` — exclusively the very first screen before any game has started. Once `startNewGame` runs, `localPhase` becomes `'playing'`, driven by `driver.state`, until a new game is explicitly started from the ending screen (which calls `startNewGame` directly, never routing back through `'home'`). A guest mid-majlis is never on the screen that has «أسئلتي» on it. This is a structural/code-path argument (traced through `app.ts`'s own control flow), not a live "try to sneak in mid-game" test — disclosed as such, not overclaimed as a UX study.

**Live end-to-end proof, real Chromium (`tests/stage/verify-editor-entry.manual.cjs`):**
```json
{
  "homeButtons": ["ابدأ اللعبة", "أسئلتي", "تراجُع"],
  "afterOpen": { "stageHidden": true, "editorShellPresent": true, "editorTitle": "أسئلتي", "backButtonText": "→ الرئيسية", "addQuestionButtonPresent": true },
  "afterBack": { "stageHidden": false, "editorShellPresent": false, "homeButtonsPresent": ["ابدأ اللعبة", "أسئلتي", "تراجُع"] },
  "reachedQuestion": true,
  "pageErrors": []
}
```
This proves: (a) the REAL `mountEditor` mounted (its own title, its own real `#editor-add-question` button — not a stub); (b) the back path genuinely restores the home screen and removes the editor DOM entirely; (c) after visiting and leaving the editor, the actual game path (`ابدأ اللعبة` → `ابدأ` → a real question screen) still works, zero page errors — no leaked state, no dead click handlers. Screenshots: `verify-out/stage-home-with-editor-entry.png`, `verify-out/editor-shell-opened.png` (both attached, visually reviewed).

---

## 3. Task 3 — PH-B4 visual verification pack

**Consolidated into `tests/stage/verify-pack.manual.cjs`** (superseding `verify-b2.manual.cjs`/`verify-b3.manual.cjs` as the standing PH-B4 report — those two are kept as historical evidence, not deleted, and were themselves re-run this session to confirm zero regression from Task 1/2's changes, §3.5). Covers V1–V14, V20–V22, V24, V26–V28 with real numbers; V23/V25 explicitly marked `N/A_TO_WL-B`.

### 3.1 Final measured results (`verify-out/results-pack.json`, real Chromium, port 3011)

| V | Result | Verdict |
|---|---|---|
| V1 | All 6 roles × 3 scale steps exact-match §1.5 (18/18) | **PASS** |
| V2 | w600 r=0.50, w700 r=0.51 (band 0.45–0.55) | **record-only, in band** |
| V3 | 7 pairs, all ≥7:1 (min 7.10:1) | **PASS** |
| V4 | F1/F2 max overflow = 0 at all 3 scales; F2 overlap = −12.9/−11.5/−10.7px | **PASS** |
| V5 | 0 `ellipsis`/`line-clamp` hits | **PASS** |
| V6 | option أ/ب mirror true; image col right of options col: **true** | **PASS (after a real fix — §3.2)** |
| V7 | Cairo dot-gap 4px (approximate — §3.3); IBM Plex comparison N/A (decision closed) | **record-only** |
| V8 | Webfont blocked: fallback stack active, 0 overflow, 0 safe-area overflow | **PASS** |
| V9 | 10 text elements, 0 safe-area violations | **PASS** |
| V10 | 0 banned physical-direction CSS declarations | **PASS** |
| V11 | Landscape/portrait both 660×660 (floor 620) | **PASS** |
| V12 | Dash array differs, token shape differs (circle vs rect) | **PASS (structural)** |
| V13 | 3 buttons (incl. Task 2's new «أسئلتي»), all ≥240×96 | **PASS** |
| V14 | Team B shift = 0px; team A anchor shift = 0px; all 10 digit widths = 40.032px | **PASS (after a real harness fix — §3.3)** |
| V20/V21 | 4 rotations, identical styles/heights, 0 leaked attributes | **PASS** |
| V22 | Broken audio → truthful error copy, flat meter | **PASS** |
| V23 | — | **N/A_TO_WL-B** (editor's `src/editor/ui/backup-badge.ts`) |
| V24 | 2 actions to first question | **PASS** |
| V25 | — | **N/A_TO_WL-B** (WL-D's `src/pack/**`, not built yet) |
| V26 | 2 raw hits, both justified (`audio/mp4` MIME type, not video) — accepted count **0** | **PASS** |
| V27/V28 | weight 600/700 real distinct instances, `font-synthesis: none`, digits share Arabic family | **PASS** |
| Font budget | 36,340 B (35.49 KB) ≤ 120 KB | **PASS** |

### 3.2 Real product defect found and fixed: V6 (image/options column swap)

`stage-ux-investigation.md` §6.2 is explicit: "the image column sits on the inline-start (right)." Measured against the shipped `question-image.ts` Beat 2: `imageRightOfOptions: false` — the OPTIONS were on the right, the IMAGE on the left, the exact opposite of the ruled wireframe. Root cause: CSS Grid numbers its columns from the container's start edge (the right, under `dir="rtl"`) and auto-places items by DOM order; `beat2.append(optionsCol, imageCol)` with `grid-template-columns: 1fr auto` put `optionsCol` in the rightmost (flexible) column and `imageCol` in the leftmost (auto) one.

**Fixed** (WL-B-owned file, so fixed, not just reported): swapped the append order (`beat2.append(imageCol, optionsCol)`) **and** the column-track declaration (`grid-template-columns: auto 1fr`) together — both are needed; changing only one produces a different, still-wrong layout.

**Red→green, pasted** (`git stash` of the two-file fix, re-measure, `git stash pop`, re-measure):
```
BEFORE (fix stashed): "imageRightOfOptions": false
AFTER  (fix restored): "imageRightOfOptions": true
```
Re-ran `verify-b2.manual.cjs`'s image-floor check after the fix: still 660×660 both orientations (floor unaffected, only position changed) — no regression.

### 3.3 Two harness bugs found in my OWN new checks (not product bugs), fixed before reporting

1. **V4's overflow probe measured `.option-text` (an inline `<span>`)** instead of `.option-card` (the actual block-level clipping container). Inline non-replaced elements report unreliable, non-zero `scrollHeight`/`clientHeight` in Chromium even on a trivially short fixture (measured 8–15px of spurious "overflow" on a one-word F1 option before the fix). Fixed by measuring `.option-card`; F1/F2 overflow is genuinely `0` after the fix, confirmed by direct re-measurement, not assumed.
2. **V14's "zero shift" check measured `.left` for BOTH status-strip team blocks uniformly.** `.status-strip` is `justify-content: space-between` with team A first — under `dir="rtl"` this pins team A's block to its own `.right` (the strip's start edge), not `.left`; only `.left` (the block's inner/end edge, where the score sits) is expected to move as the score's digit count changes. The first-draft check flagged team A's own legitimate 40.03px growth (exactly one tabular-nums digit width) as a false "shift" bug. Fixed to measure `.right` for team A's anchor invariant. Both bugs are documented inline in `verify-pack.manual.cjs` at the point they were fixed, and in `docs/بروتوكولات/arabic-stage-screenshots.md` §3/§7 so a future agent does not repeat either.

**Red→green, pasted, for both of V14's real invariants** (temporary `git`-free CSS edit — `justify-content: space-between` → `flex-start` — re-measured, then manually restored and re-measured again):
```
BEFORE (justify-content: flex-start): "teamBShiftPx": 40.03125, "zeroShift": false
AFTER  (justify-content: space-between, real code): "teamBShiftPx": 0, "teamAAnchorShiftPx": 0, "zeroShift": true
```

### 3.4 V7 and V26 — measured honestly, not smoothed over

- **V7** (font A/B dot-gap): the Cairo-only measurement's ink-column heuristic finds 4 blobs in the glyph's top-45% band at this exact font/size, not a clean 2 — disclosed as approximate (likely includes part of the tooth/connector stroke), not chased further since V7 is record-only (the font decision closed in `addendum-v2-ruling.md`; IBM Plex Sans Arabic was never self-hosted for this product, so the literal A/B comparison is `N/A`, not fabricated).
- **V26**: 2 raw grep hits (`editor/ui/question-form.ts`, `media/audio.ts`), both individually inspected and justified — both are the string `audio/mp4`, which is M4A audio's real IANA media type (`audio/mp4` — MPEG-4 is an audio+video *container* format; the MIME type for audio-only M4A content is literally `audio/mp4`), not a video affordance. Per the plan's own instruction ("يُبرَّر كل تطابق أو يُحذف؛ العدد المقبول 0"), accepted violation count is **0**.

### 3.5 Regression check — verify-b2/verify-b3 re-run after all Task 1/2/3 changes

Both re-run clean, real Chromium (`verify-out/rerun-b2.log`, `verify-out/rerun-b3.log`): no-tell still 0 leaks both variants, combined overlap still negative at all 3 scales, image floor still 660×660 both orientations, audio truthfulness still correct, V1/V3/V10/V27/V28/V2 all unchanged, maze structural proof unchanged (22 stations, 0 dead-end circles), V13/V24 unchanged.

**One genuine, disclosed difference, not a regression**: `verify-b2.manual.cjs`'s own committed `verify-out/results-b2.json` (from the original PH-B2 run) is overwritten in place on every re-run (it always writes to the same path) — the re-run's `v26VideoGrep` now shows the 2 justified `audio/mp4` hits from WL-C's merged-in C2/C3 code (§3.4) instead of the ORIGINAL committed artifact's single hit in `src/stage/screens/question.ts`. That original hit was itself already stale relative to the code at the time it was committed: `worklog-B2.md` §8's own V26 paragraph documents finding and rewording that exact comment ("a comment in `question.ts` literally used the word 'video'... reworded") — the committed JSON simply predates that fix being re-measured. Re-running now correctly shows **0** hits in `question.ts` and the 2 new, justified, non-video hits described in §3.4. `git diff verify-out/results-b2.json` shows exactly this one block changing; nothing else in either file differs from the original run.

### 3.6 Direct proof of Task 1's `resolveMediaUrl` (`tests/stage/verify-resolve-media-url.manual.cjs`)

See §1 and §4 — all three branches (absent/string/null) measured directly against the real `renderQuestionScreen`.

---

## 4. Full raw evidence files (all in `verify-out/`, real Chromium output)

- `results-pack.json` — the PH-B4 consolidated report (§3.1's source)
- `results-resolve-media-url.json` — Task 1's three-branch proof
- `results-editor-entry.json` — Task 2's end-to-end proof
- `stage-home-with-editor-entry.png`, `editor-shell-opened.png` — Task 2 screenshots
- `rerun-b2.log`, `rerun-b3.log` — regression re-runs (§3.5)

---

## 5. `docs/بروتوكولات/arabic-stage-screenshots.md` — written, from real output

Written after all of the above ran for real (v3 §8 discipline — never before). Covers: the fixed 1920×1080/DSF1 harness shape and why; importing real stage modules via Vite's dev-server `import()` inside `page.evaluate` (never a reimplementation); the "hidden ceiling" trap (§V4b's own history, plus this session's inline-`<span>` overflow-measurement bug); deterministic `data-scale` framing; when to (and not to) await `document.fonts.ready`; RTL mirror reading of `getBoundingClientRect()` under `dir="rtl"` (including the CSS-Grid-column-numbering confusion that caused the real V6 bug); the anchored-edge subtlety for `justify-content: space-between` layout-shift checks (V14); greyscale/structural distinguishability technique; the live-`CSSStyleDeclaration`-goes-empty-after-`.remove()` trap (already known from B2, restated for the next agent); font-decision provenance (what's a gate vs. record-only, and why); the canonical F1–F8 fixture table; and an explicit "known gaps" section (F6 never exercised by any script yet; V23/V25 out of WL-B's ownership; V7's heuristic is approximate).

---

## 6. The two items from B2/B3 the coordinator asked me to resolve

### The ×1.30 worst-case combined-fixture question-floor exception

**Ruling followed: keep the bounded exception, explicit and guarded, not silent.** Re-confirmed this session (§3.5, `overlapMutation`/`combinedOverlap` re-run unchanged): `fitCombinedLayout`'s Phase 4 (`src/stage/fit-combined.ts`) lets the question font go below the stated §1.5 floor (56 stage-px) **only** when Phases 1–3 combined are still insufficient, down to an **absolute minimum of 28 stage-px**, and always reports back `wentBelowStatedFloor`/`effectiveQuestionFloorPx` — never a silent violation. The exact bound, restated here per the ruling: **28 stage-px absolute floor, only reachable when both the question is at its 150-char maximum AND all four options are simultaneously at their 50-char maximum, at the ×1.30 accessibility step** — the single most extreme fixture in the whole spec. Every fixture not simultaneously at both maxima renders at or above the stated 56px floor (unchanged from B2's finding; nothing in Task 1/2/3's work touched `fit-combined.ts`). The **standing guard** enforcing "no visible collision regardless" is `verify-pack.manual.cjs`'s `V4.<scale>.f2OverlapPx` (successor to `verify-b2.manual.cjs`'s `combinedOverlap`) — asserts `overlapPx <= 0` at all 3 scale steps; re-confirmed green this session: `-12.9 / -11.5 / -10.7`px at ×1.00/1.15/1.30. This guard fails (goes red) if the overlap ever grows positive, which is the concrete, testable form of "fails if it ever grows beyond that bound" — the bound is on the *symptom* (visible collision), not a number the shrink routine could quietly renegotiate without the guard noticing.

### The draw screen's «تعادل» headline

**Unchanged from `worklog-B3.md` — flagged again here for visibility, not re-authored.** No literal string exists in Appendix أ for the FINAL draw-outcome screen (only the pre-decision "سؤال من الحضور" screen has ruled literal copy, including its own «نعلنها تعادل» button). The shipped headline is the single word **«تعادل»** — the same register as the surrounding strings, matching the word on the button the room just pressed, not a paraphrase of any existing ruled string. **This is a string I authored, not one copied from Appendix أ or any expert report** — exactly as `worklog-B3.md` §180 item 187/table row 7 already disclosed. Restating it explicitly here per the coordinator's instruction to mark it clearly: `src/stage/screens/ending.ts`'s draw-outcome branch renders the literal text `تعادل`. Ready to be folded into Appendix أ by the coordinator/documenter.

---

## 7. Full project checks (final, after all three tasks)

- `npx tsc --noEmit`: **exit 2, exactly 1 error** — `src/editor/ui/stage-preview.ts(87,5)`, the pre-existing WL-C break disclosed in §1, unchanged before/after my work (confirmed by running `tsc` immediately after merge, before any edit, and again as the very last step).
- `npx vitest run`: **10 test files, 55 tests, all passed.**
- Manual Playwright drivers (`verify-pack.manual.cjs`, `verify-resolve-media-url.manual.cjs`, `verify-editor-entry.manual.cjs`, re-run `verify-b2.manual.cjs`/`verify-b3.manual.cjs`): **all green**, numbers pasted above.
- Port 3011: verified free after teardown (`Get-NetTCPConnection -LocalPort 3011` → empty after `Stop-Process -Id 20028` — the exact PID I started via `npx vite --port 3011 --strictPort`, looked up by port, never a name-matched kill).
- `git status --short`: only the files this worklog names, plus `verify-out/results-pack.json`/`results-resolve-media-url.json`/`results-editor-entry.json`/two PNGs/`rerun-b2.log`/`rerun-b3.log` (evidence artifacts, same pattern as `results-b2.json`/`results-b3.json` already tracked from prior phases) and the new `tests/stage/verify-*.manual.cjs` drivers + the protocol file + `خطة.md`'s single `PH-B4` checkbox line (per v3 §2's stated exception, my own phase's row only, nothing else touched).

---

## Known limitations / disclosed, not hidden (this phase)

| # | Item | Detail |
|---|---|---|
| 1 | F6 fixture (team names, 18-char cap, Latin+digit mix) never exercised | Defined in `stage-ux-investigation.md` §8, not built into any check across B1→B4. Flagged in the new protocol file §12 for a future pass. |
| 2 | V7's dot-gap heuristic is approximate | 4 ink-column blobs found, not a clean 2, at Cairo 700/60px — disclosed in §3.4 and the protocol file §12; not chased further since V7 is record-only (font decision already closed). |
| 3 | The exact seam for WL-C's `resolveMediaUrl` wiring into `stage-preview.ts` is diagnosed but not implemented | Diff provided in §1; the resolver body needs WL-C's own `src/media`/`src/storage/idb.ts` blob-lookup API, outside what I read deeply enough to safely prescribe. |
| 4 | Editor's "not reachable mid-play" claim is a structural code-path argument, not a live adversarial UX test | Traced through `app.ts`'s own control flow (§2) — a human trying to reach it accidentally mid-game was not separately user-tested (out of an executor's scope; that is the visual auditor's territory if requested). |
| 5 | `.editor-shell`'s minimal CSS (background/color/font-family/back-bar) is WL-B's own addition, not styling WL-C's own content | Everything inside `.editor-shell-body` remains exactly WL-C's `editor.css` — I did not touch or restyle any editor-internal element. |

**PH-B4 (+ Task 1 + Task 2) — final status: all measured PASS**, four real bugs found and fixed along the way (one product defect — V6 image/options swap; one CSS layout bug — editor-shell black-void; two test-harness bugs — V4 inline-span overflow, V14 wrong anchor edge), all disclosed with red→green proof, none smoothed over.
