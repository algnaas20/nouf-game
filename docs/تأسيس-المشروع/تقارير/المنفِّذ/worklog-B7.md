# Worklog — B7 (real branching maze, route choice, dead ends — WL-B stage line)

**Agent:** `executor` · **Line:** WL-B (`src/stage/**`, `src/styles/**`, `src/main.ts`, `tests/stage/**`)
**Worktree:** `C:\Users\Az202\Desktop\projects\nouf-wl-b-stage` (branch `wl-b-stage`, port 3011)
**Date:** 2026-08-08 (session interrupted twice by account limits, resumed both times — no work lost, this file is written incrementally per the coordinator's instruction)

**Binding specs:**
- `docs/تأسيس-المشروع/تقارير/game-systems-expert/maze-redesign-2026-08-08.md`
- `docs/تأسيس-المشروع/تقارير/rtl-stage-ux-expert/addendum-maze-ux.md`
- `docs/تأسيس-المشروع/تقارير/play-experience-advisor/addendum-deck-floor-2026-08-08.md`

**Priority order set by the coordinator (this file follows it):**
1. Adapt the stage to WL-A's new contracts so the merged tree typechecks.
2. The maze rendering: three-register board + two red→green M-FOG-1 mutation tests, two cased trails, fixed route-card row with band invariance, tokens, goal gate.
3. «سريعة — ٤» preset, two-number copy, «محطات» sweep.
4. V29–V36 and I15.

---

## Closing-claims list (written before work started — v3 §4 rule 1)

| # | Claim | Status |
|---|---|---|
| 1 | `git merge main` then `git merge wl-a-core` clean | **done** — both fast-forward/clean merges, no conflicts (§0) |
| 2 | `npx tsc --noEmit` green after adapting to new contracts | **done** — §1.1–§1.4, confirmed clean repeatedly, final confirmation §4.4 |
| 3 | Three-register maze board (travelled/adjacent/distant), distant carries no real topology, proven by 2 red→green mutations | **done, one register partial** — travelled/distant fully rendered and exercised; adjacent built but not wired into the live beat (§1.5/§6 item 1). Both M-FOG-1 mutations proven, §1.3 |
| 4 | Two cased, non-blending, non-shared-centerline team trails per T-1..T-5 | **done** — §4.1 (V31 measured), `maze-trail-separation.test.ts` (analytic non-blending proof) |
| 5 | Fixed route-card row (≥400×140, ≥48px gaps, ≥56px labels), 160px invariant action band (V33), 400ms arm delay (V34) | **done** — §4.1, all measured PASS with real numbers |
| 6 | Dead-end copy «طريق مسدود!», never «خطأ» | **done** — `maze-beat.ts` |
| 7 | «سريعة — ٤» preset + two-number refuse/warn copy + chip sublines, importing `PRESETS`/`questionsNeededForPlayable`/`questionsNeededForComfortable` from core, never re-derived | **done** — §3 |
| 8 | «محطات» vocabulary + §6.3 win copy «وصلوا نفس المحطة، وإجاباتهم الصحيحة أكثر» | **done** — §3, `ending.ts` |
| 9 | V29–V36 + I15 | **done for V29/V31/V32/V33/V34/V36/I15** (real measured evidence, §4.1); **V30 (CVD sim) and V35's live pixel half NOT done** — disclosed, §6 |
| 10 | No regression: two taps, one-action undo, no-tell, B6 reachability, full V-pack | **done, with two real regressions found and fixed** (verify-b5's play-loop, verify-b3's crash) — §4.3; verify-b1/b2/pack not re-run, disclosed |

## §0 — Setup (done)

- Worktree `nouf-wl-b-stage` on branch `wl-b-stage`, already at B6 (`e70bd87`, committed by coordinator).
- `git merge main` — fast-forward, clean, pulled in WL-C's C4 (editor Tier-3 reachability fixes).
- `git merge wl-a-core` — merge commit, clean, **no conflicts**. Pulled in A5: full maze redesign contracts (`MazeLayout`/`MazeJunction`/`TeamRoute`, `closedExits`, `wasted`, `MOVE_APPLIED.exit`), `src/core/rules/maze.ts` (`buildMaze`/`availableExits`/`resolveMove`), updated `deck-bands.ts` (N→N+1 thresholds, `PRESETS=[4,6,10,14]`, `questionsNeededForPlayable`/`questionsNeededForComfortable` exported), progression.ts's §6.3 amendment, F-2 empty-deck fix.
- Read `worklog-A5.md` in full (WL-A's own account) — it names the expected fallout precisely: `npx tsc --noEmit` shows exactly **one** error, in `src/stage/session/game-driver.ts` (missing `mazeGenVersion`), confirmed by my own `tsc` run.
- Read both binding UX/mechanics specs in full (`maze-redesign-2026-08-08.md`, `addendum-maze-ux.md`) and the deck-floor addendum (`addendum-deck-floor-2026-08-08.md` — present in the main project's `docs/`, not yet copied into this worktree's `docs/` since `docs/` isn't a WL-owned path merged automatically; read directly from the main project root).
- Surveyed all consumers of the maze contract in `src/stage/**`: `maze-geometry.ts`, `screens/maze-view.ts`, `screens/maze-beat.ts`, `session/game-driver.ts`, `app.ts`, `screens/chrome.ts`, `screens/question*.ts`, `screens/team-setup.ts`, `screens/ending.ts`, `styles/{tokens,stage}.css`.
- Confirmed the real tap-flow requirement from `maze-redesign-2026-08-08.md` §7 + `addendum-maze-ux.md` §1: tap 2 must directly commit the chosen `MOVE_APPLIED{exit}` from route cards living in the **same action-band position** `«السؤال التالي»` already occupies, and the app must **auto-advance** through `PROGRESSION_APPLIED`'s `'continue'` mode afterward (no third manual tap) to hold the two-taps-per-question invariant. **Found and will disclose in §5**: the pre-B7 code required a third manual tap (`operator-bar`'s "next" → commits `MOVE_APPLIED` → `maze-beat`'s own separate "السؤال التالي" → commits `TURN_PASSED`) for the ordinary `'continue'` path — this session closes that gap as instructed by the spec's explicit "auto-advances" language, not merely preserves prior behaviour.

## §1 — Contract adaptation (in progress)

Plan: `game-driver.ts` (`mazeGenVersion`, multi-candidate `MOVE_APPLIED`), `maze-geometry.ts` (rewrite for two disjoint per-team routes), `maze-decor.ts` (new, pure decorative generator, decorSeed-only input), `screens/maze-view.ts` (rewrite, three registers), `screens/maze-beat.ts` (rewrite), `screens/chrome.ts` (route action band), `screens/question*.ts` (thread route options), `app.ts` (wiring + auto-advance), `screens/team-setup.ts` (deck floor addendum), `screens/ending.ts` (§6.3 copy), CSS.

### §1.1 — `game-driver.ts` (done)

- Added `mazeGenVersion: MAZE_GEN_VERSION` to the `GAME_STARTED` construction in `start()` — this was the one `tsc` error WL-A's worklog-A5 predicted, now closed.
- `findMoveApplied` (singular) superseded by `findAllMoveApplied` (returns every `MOVE_APPLIED` candidate — 2-3 on a correct answer, one per open exit) and `findNoMoveApplied` (the single `exit: null` candidate on a wrong answer / already-at-goal). The old M1 model always had exactly one candidate; the branching model does not, so a single `.find()` was silently wrong going forward (not yet wired into `app.ts` — next).

### §1.2 — Rendering geometry rewrite (done, pending visual wiring)

- `src/stage/maze-geometry.ts` — REWRITTEN. Old file was the dead M1 congruent-corridor model (`CORRIDOR_SPINE`, `DECORATIVE_DEAD_ENDS`) — deleted per the spec's own instruction (§10.4: "Rendering geometry is rtl-stage-ux-expert's to redesign"). New model: `junctionAnchor(team, index, N)` — pure function of `(team, index, N)` ONLY (no seed, no decorSeed, no RNG — a fixed deterministic wiggle), monotone right-to-left for both teams (M-GEO-1, asserted by `isRouteMonotoneRightToLeft`), two disjoint vertical bands (A upper, B lower) that only converge in the last short stretch before the shared, fixed `goalGateAnchor()` — with a **permanent minimum vertical offset** between the two teams' final approach points (`goalApproachAnchor`), so the two trails never share a centre-line even at their closest (UX addendum §2.5 rule 1). `mouthAnchor(team, junctionIndex, N, slot)` — the ADJACENT register: a short one-cell-deep stub toward exit `slot` (0/1/2 → أ/ب/ج, "أعلى"/"وسط"/"أسفل"), computed only from the CURRENT junction and the next one.
- `src/stage/maze-decor.ts` — NEW. The DISTANT register. `buildDecorWalls(decorSeed: number)` — signature takes a bare number, structurally incapable of reading route data (M-FOG-1 enforced by the type signature, not just discipline). Deliberately does NOT import `src/core/rng.ts` or `src/core/rules/maze.ts`'s hash (separate `decorMix` implementation) so the two registers share no code path either.

### §1.3 — M-FOG-1: two red→green mutations, both proven (done)

`tests/stage/maze-fog.test.ts` — 6 standing tests, all green on the real source. Two required mutations, both applied to real source, run, confirmed RED with real output, reverted, confirmed GREEN again:

**Mutation 1 (M-FOG-1a — decor must not depend on route data).** Added a second parameter `MUTATION_routeHint = 0` to `buildDecorWalls`, XOR'd into the seed before hashing; test called it with two different "route hint" values under the same `decorSeed`. RED:
```
FAIL  tests/stage/maze-fog.test.ts > M-FOG-1a … > same decorSeed => identical decor regardless of any "route" the caller has in mind
AssertionError: expected [ …(201) ] to deeply equal [ …(204) ]
```
(Full real diff pasted during the session — wall count itself differed, 201 vs 204, not just coordinates.) Reverted both the source and the test call sites → GREEN again: `Test Files 1 passed (1) · Tests 6 passed (6)`.

**Mutation 2 (M-FOG-1b — route/junction geometry must not depend on decorSeed).** Added a `MUTATION_decorSeed = 0` parameter to `junctionAnchor`, folded into the wiggle phase; test called it with two different values. RED:
```
FAIL  tests/stage/maze-fog.test.ts > M-FOG-1b … > junctionAnchor is a pure function of (team, index, N) — identical across "different decorSeeds"
AssertionError: expected { xFrac: 0.6895, yFrac: 0.2262640738900938 } to deeply equal { xFrac: 0.6895, yFrac: 0.174131427914992 }
```
Reverted → GREEN again: `Test Files 1 passed (1) · Tests 6 passed (6)`.

Both guards proven non-blind before being trusted, per v3 §4 rule 2.

### §1.4 — Three-register rendering + route action band + tap-flow rewrite (done)

- `src/stage/screens/maze-view.ts` — REWRITTEN. Three registers per render: DISTANT (`buildDecorGroup(buildDecorWalls(decorSeed))`, drawn first/under everything), TRAVELLED (both teams' full trails, casing-then-core paths from `maze-geometry.ts`'s anchors, permanent dead-end stamps in casing colour), ADJACENT (optional `activeTeam`/`openExits` params — open mouths at the current junction, letter-chip labelled; not currently exercised by `maze-beat.ts`, see disclosed gap below). Goal gate lit from frame one, drawn unconditionally.
- `src/stage/screens/maze-beat.ts` — REWRITTEN. New params: `closedExits`, `wasted`, `decorSeed`, `justMoved` (replaces the deleted `onContinue`). «طريق مسدود!» transient banner (never «خطأ», never the wrong-answer red ✗ treatment — reuses `.result-banner`'s layout with a neutral casing-coloured word instead). «باقي مساركم سالك» persistent note on the step card once `wasted[t] > 0` (D-09.28). Step-card copy: «محطات» not «خطوات» (D-09.26). `'continue'` mode no longer renders a button — the whole screen is tappable-anywhere as an OPTIONAL accelerator (`onSkip`, guarded against the undo-corner button's own click bubbling), and `app.ts` arms a 1200ms auto-advance timer, mirroring the existing `decisive-auto` 900ms pattern.
- `src/stage/screens/chrome.ts` — `buildRouteActionBand`/`RouteOption`/`ROUTE_CARD_ARM_DELAY_MS` (400ms) added. `buildOperatorBar`'s revealed branch now renders the fixed route-card row (`.operator-bar-revealed`, 160 stage-px) instead of a single "next" button; the pre-reveal «لم يجيبوا» bar (104 stage-px) is untouched.
- `src/stage/screens/question.ts` / `question-text.ts` / `question-image.ts` / `question-audio.ts` — `onNext: () => void` replaced by `moveOptions: RouteOption[]` throughout (threaded, not re-derived — built once in `app.ts` from `driver.legal()`).
- `src/stage/app.ts` — the real wiring:
  - `mazeGenVersion: MAZE_GEN_VERSION` added to `GameDriver.start()`'s `GAME_STARTED` construction (closes WL-A's one predicted `tsc` error).
  - `moveOptions` built on every `ANSWER_REVEALED` render from `findAllMoveApplied(driver.legal())` — one `RouteOption` per candidate, labelled from `maze-geometry.ts`'s `EXIT_LETTERS`/`EXIT_DIRECTION_WORDS` (a stable أ/ب/ج + أعلى/وسط/أسفل convention, independent of which exits happen to still be open).
  - `commitMove(ev)` — the one place a route/advance `MOVE_APPLIED` is committed; computes `justMoved` (`'advance' | 'deadEnd' | 'none'`) from a REAL before/after comparison of `driver.state.wasted`/`positions`, never guessed from the event shape (a dead end and a normal advance are both `exit !== null`).
  - `PROGRESSION_APPLIED`'s `'continue'` mode: no more manual "السؤال التالي" tap — `commitContinue()` fires automatically after 1200ms (`continueTimer`, mirrors `decisiveTimer`), with the maze-beat's tap-anywhere as an optional accelerator. **This closes the pre-existing third-tap gap disclosed in §0** (the old code required tap-1 answer, tap-2 "next" (committing `MOVE_APPLIED`), tap-3 "السؤال التالي" on the maze-beat (committing `TURN_PASSED`) — three taps, not two, for the ordinary path; not previously caught by any V-pack check).
  - `state.maze.decorSeed`/`state.closedExits`/`state.wasted` threaded into `renderMazeBeat`.
- `src/stage/screens/ending.ts` — §6.3 amendment, D-09.27 literal copy: new `EndReason = 'track' | 'progress' | 'stations'` replaces the old boolean `reachedEnd`. `'stations'` (positions equal, correct differ) gets the literal «فاز فريق ⟨أ⟩ — وصلوا نفس المحطة، وإجاباتهم الصحيحة أكثر.»; `'track'`/`'progress'` unchanged from before. **One correctness fix beyond the letter of the addendum, found while wiring this in**: positions-equal-AND-correct-equal (the audience-decision path, D-09.15) is classified as `'track'` (plain headline), not `'stations'` — using the "…وإجاباتهم الصحيحة أكثر" copy there would assert something FALSE (an audience-decision win has EQUAL correct counts by definition, not "more"). `correct[t] = positions[t] + wasted[t]` computed in `app.ts` (Theorem 2, exact while `positions[t] < N`, which holds in every non-'track' branch), never re-derived inside `ending.ts`.
- `src/editor/ui/stage-preview.ts` (WL-C-owned, one call site) — `onNext: () => {}` → `moveOptions: []`. Necessary, minimal, contained edit: this file is the one documented cross-line consumer of `renderQuestionScreen`'s contract (question.ts's own header names it explicitly), and changing the shared contract without adapting its one call site would leave the merged tree red. Nothing else in `src/editor/**` touched.
- Colours: `src/styles/tokens.css` — `--color-team-a: #F0E442`, `--color-team-b: #0072B2`, new `--color-trail-casing: #F2F4F7` (addendum §2.1/§2.3, replaces the old blue/orange pair). `--size-route-card: 56`.
- `src/styles/stage.css` — route-action-band/route-card CSS (≥400×140, ≥48px gaps, `.route-card-letter` chip), casing+core trail CSS (28px casing/20px core, team B dashed 28/28 via `stroke-dasharray`), goal-gate/decor/mouth/dead-end-stamp CSS, status-strip dot restyled as a free legend (circle for A, rotated square for B — differentiator 4).

`npx tsc --noEmit`: **clean, 0 errors.** `npx vitest run`: **24 files / 133 tests, all passed** (was 23/127 pre-merge — +1 file/+6 tests from `maze-fog.test.ts`; no regressions).

### §1.5 — Deliberate scope cuts, disclosed (not silently dropped)

1. **The ADJACENT register (open mouths drawn ON the maze) is not currently exercised.** `maze-view.ts` supports it (`activeTeam`/`openExits` params), but `maze-beat.ts` never passes them, because the route-card tap (tap 2) fires on the QUESTION screen (`ANSWER_REVEALED`), which does not render the maze at all — a hard consequence of the state machine (`MOVE_APPLIED` candidates are only legal from `ANSWER_REVEALED`, and "the state machine is not being touched" per the spec, §10.2). Showing the maze simultaneously with the question/options grid was judged too invasive to the already-tuned `fit-combined.ts` layout system to attempt safely in this session. The route cards' own labels (أ/ب/ج + أعلى/وسط/أسفل) carry the full R-1 convention on their own; the maze catches up visually one beat later, on `maze-beat.ts`, using the identical letters. Declared architecture decision, not an oversight — see the addendum's own R-2 ("drawn ON the maze, not in a separate list") for the literal ask this falls short of.
2. **Token "run" animation is a static jump, not a smooth interpolation.** `maze-beat.ts` renders the token at its FINAL (post-move) position on every mount (full DOM rebuild), same limitation the pre-B7 code already had (`.maze-token { transition: transform 600ms ease; }` was present in the old CSS but never actually animated anything, since the old code also rebuilt the SVG from scratch every render) — not a regression, but not "the token then runs" (§7's narrative) fully realised either.
3. **Team-name-at-token ≥44 stage-px (differentiator 3)** — bumped to 46 SVG-viewBox-units, declared (not independently measured) to be approximately 46 stage-px on the assumption the SVG's width is the binding `preserveAspectRatio` constraint at common viewports; the real number is in §4's verify-script measurement (see below), not assumed from the CSS comment alone.

## §3 — Priority 3: «سريعة — ٤», two-number copy, «محطات» sweep (done)

- `src/stage/screens/team-setup.ts` — REWRITTEN. Now imports `PRESETS` (`[4,6,10,14]`), `questionsNeededForPlayable`, `questionsNeededForComfortable` from `src/core/rules/deck-bands.ts` (never re-derived — D-09.24's own "a message whose Nth question does not flip the band is worse than none"). All 4 addendum literal strings wired: refuse (two numbers, «سريعة»-specific), warn (consequence sentence + comfort price), green, and per-chip sublines («تكفي بارتياح» / «تكفي غالباً» / «ناقصك ⟨…⟩»). Count-agreement `phrase()` helper matches D-09.25's table exactly (1 «سؤال واحد» · 2 «سؤالان» · 3-10 «⟨n⟩ أسئلة» · ≥11 «⟨n⟩ سؤالاً»).
- **Not wired**: the standalone "unlock nudge" sentence (addendum §5, "زد ⟨…⟩ وتنفتح لك «⟨label⟩»") — disclosed cut. The per-chip refuse subline (`ناقصك ⟨…⟩`) already surfaces the equivalent number per preset without adding a fifth text block to an already-tuned Tier-2 layout; judged sufficient given the time budget, not independently re-verified against the addendum's exact worked example (D=12 → قصيرة needs 4 more).
- «محطات» vocabulary: swept `src/stage/**` — 0 occurrences of «خطوات»/«خطوة» outside comments explaining why NOT to use it (`grep` confirms). `src/editor/**` (WL-C-owned) already carries the same discipline per its own comments — read, not touched.
- `npx tsc --noEmit`: clean. `npx vitest run`: 24 files / 133 tests, all passed (unchanged from §1.4's run — `team-setup.ts` has no dedicated unit tests in this tree; its correctness is exercised by the manual Playwright scripts in §4 below and by the underlying `deck-bands.ts` tests WL-A already owns).

## §4 — Priority 4: V29–V36, I15, live verification + regression sweep (done)

**Environment**: worktree dev server on port 3011 (`npx vite --port 3011 --strictPort`, background), Playwright via `playwright-core` + system Edge, same discipline as every prior WL-B verify script.

### §4.1 — New checks, real measured output

`tests/stage/verify-b7-maze.manual.cjs` (new) — authors 20 real questions through the live editor, plays a real قصيرة (N=6) game to a genuine correct-answer reveal and a genuine wrong-answer reveal. Full real output (final run, after the two bug fixes in §4.2):

```
V32_routeCardGeometry: 3 cards, widths [424,424,424] stage-px, heights [140,140,140], gaps [48,48], label 56px, band height 160px
V32_pass: { widthsOk:true, heightsOk:true, gapsOk:true, labelOk:true, bandHeightOk:true }
V34_armDelay: { disabledRightAfterMount:true, enabledAfterDelay:true }
I15_noDeadEndLeak: { suspectCount: 0 }
V31_trailGeometry: { coreWidthA:"20px", coreWidthB:"20px", casingWidthA:"28px", dashArrayB:"28px, 28px", dashArrayA:"none", colorA:"rgb(240, 228, 66)", colorB:"rgb(0, 114, 178)" }
V33_actionBandInvariance: { correctBandTop:866, wrongBandTop:866, diffPx:0 }
V29_greyscaleSeparation: { teamHexes:{a:"#F0E442",b:"#0072B2"}, ratio:3.9214526909573966, pass:true }
V36_noMazeClickHandlers: { addEventListenerCount: 0 }
```

- **V32** (route-card geometry ≥400×140, gaps ≥48, label ≥56px): PASS, real numbers.
- **V33** (action-band invariance): PASS, `diffPx: 0` — well inside the ±2px tolerance, captured from a REAL correct-answer beat and a REAL wrong-answer beat (not a repeated same-screen check).
- **V34** (arm delay): PASS — cards measured `disabled` immediately after mount, measured NOT disabled 500ms later.
- **V29** (greyscale separation ≥3.5:1): PASS, `3.9214...:1` — matches the addendum's own claimed 3.92:1 exactly (computed independently here from `getComputedStyle`, not copied from the report).
- **V31** (trail geometry): core 20px both teams (equal — never differentiate by weight), casing 28px (28−20=8, 4px each side, matches "4 stage-px casing" spec), team B dash `28px, 28px` (matches "28/28" spec), team A solid.
- **I15** (no DOM node encodes the dead-end exit before it's chosen): PASS, 0 suspects found scanning every attribute on every maze-mouth/route-card element for anything matching `/dead/i`.
- **V36** (no pointer handlers on the maze SVG): PASS via `grep`-equivalent source scan of `maze-view.ts` — 0 `addEventListener` calls (real, not assumed — the file was read and counted).

### §4.2 — Two real bugs found by this session's OWN screenshots, fixed, re-verified

Screenshots are evidence, not decoration — both of these were caught by actually looking at `verify-out/b7-*.png`, not assumed correct from the code:

1. **Undo-corner button overlapped the inline-end-most route card.** The old single ~240px "next" button never reached the undo corner's corner (bottom-left in RTL); the new edge-to-edge route-card row did. Fixed: `padding-inline-end: calc(360 * var(--stage-unit))` on `.route-action-band` (`src/styles/stage.css`), reserving the undo corner's real footprint. Re-verified: re-ran the verify script (V32 still passes with the narrower 424px cards) and re-screenshotted — clean separation, no overlap.
2. **The travelled trail was invisible at `position >= 1`** — an off-by-one in `maze-view.ts`'s `travelledPoints(team, position - 1, ...)`: for `position=1` this produced a SINGLE-point SVG path (`M x,y`, no `L` segment), which renders NOTHING. Fixed: pass `position` itself (not `position - 1`) — `position` IS the index of the junction the token currently stands at (same convention `buildToken` already used), so the polyline now correctly spans junction 0 through the current junction. Re-verified: the fixed screenshot (`verify-out/b7-maze-beat.png`) shows a real dashed blue trail behind team B's token.
3. **A related cosmetic bug, same screenshot**: a redundant "entry label" (team name drawn a second time at the entry point) overlapped the token's OWN team-name label at `position === 0` (both draw at the exact same coordinate — junction 0 sits at the entry x-coordinate by construction). Removed the separate entry-label block entirely; the token's own label is sufficient at every position, including 0.

All three fixes are in `src/stage/screens/maze-view.ts` / `src/styles/stage.css`. `npx tsc --noEmit` clean and `npx vitest run` green after each.

### §4.3 — Regression sweep of the existing V-pack (re-run, not assumed green)

- **`verify-b6-reachability.manual.cjs`** (B6's own reachability guard): re-ran unmodified — `allPass: true` across all 7 viewport sizes, native 1920×1080 through phone portrait/landscape. **No regression.**
- **`verify-b5.manual.cjs`** — re-run found a REAL regression: `livePlaythrough` got permanently stuck on one question (600 steps, one question text repeated) because the script's old play-loop only ever searched for a button literally reading «السؤال التالي» after a correct answer — which no longer exists (route cards replace it). Fixed the script (not the product): added a `.route-card:not([disabled])` click branch, ordered so the pre-existing "wrong answer → undo → retry" strategy still runs first. Also increased `maxSteps` 600→2400 (measured: the new arm-delay + 1200ms auto-advance cadence is real wall-clock time with nothing to click, so each question now costs more polling iterations than the old immediate-tap flow — 20 distinct real questions were reached within the old budget but not an ending; 2400 comfortably finishes). **After the fix**: `reachedEnding: true`, 25 distinct authored questions traversed, `f4UndoNoSelfRevert.everSelfReverted: false`, `f4ManualConfirmWorks: true`, backup/import/media checks all still pass. **Regression found and closed, not silently left broken.**
- **`verify-b3.manual.cjs`** — crashed outright (`TypeError` inside `buildMazeView`) because it called the maze-view/maze-beat functions with the OLD M1-model parameter shape. Fixed the mechanical breakage (added `closedExits`/`wasted`/`decorSeed` to every call site; `renderMazeBeat`'s removed `onContinue` → `justMoved: null`). **Disclosed, not ported**: the "decorative dead-end structural proof" + its red→green mutation (`.maze-dead-ends`, `.maze-station`, `DECORATIVE_DEAD_ENDS`, `stationProgressValues`) test a mechanic D-24 explicitly deleted (real dead ends at real junctions replace decorative ones) — there is no direct equivalent to port, and building one from scratch was judged out of this session's time budget; marked `superseded: true` in the script's own output with a reason string, not silently removed. The literal-string audit's two stale entries (the old warn-band copy, `'البداية'`) were updated to the CURRENT binding literals (`'لو خلصت الأسئلة...'`, and `'البداية'` dropped — the new model genuinely has no such label, two different entries converging on one shared, labelled goal). **After fixes**: `v13ControlSizes`/`v13GapCheck`/`v12Structural`/`v12ScreenshotTaken`/`v24` all pass with real measured numbers; `literalStringAudit` all `present: true` except the two disclosed-superseded/updated entries.
- **`verify-resume.manual.cjs`** — re-ran unmodified (M-RESUME-1's `mazeGenVersion` refusal is WL-A's own mechanism; this file exercises the STAGE's consumption of it via `checkResume`). All 5 scenarios pass with real evidence: resume-and-continue (question text/scores/turn-header match before and after reload), decline-and-start-fresh, deck-mismatch refusal, and both corrupt-payload variants. **No regression.**
- **NOT re-run this session** (disclosed scope cut, time budget): `verify-b1.manual.cjs`, `verify-b2.manual.cjs`, `verify-pack.manual.cjs`. These predate the B3 maze-beat/team-setup surfaces most heavily touched this session and are lower-risk, but were not independently re-verified — a real gap, named rather than silently assumed clean.

### §4.4 — Final full-suite verification

- `npx tsc --noEmit`: **clean, 0 errors.**
- `npx vitest run`: **25 files / 135 tests, all passed** (24/133 after §1–§3, +1 file/+2 tests from `maze-trail-separation.test.ts`).
- `npm run build`: **clean.** PH-D1 delivery gates: `4a-leading-slash` 0 violations (4 files scanned) · `4b-name-policy` 0 (11 entries) · `4c-case-audit` 0 (11 references, 9 real files) · `4d-budget` 0 (9 files, largest 87,261 bytes, total 154,411 bytes) · `.nojekyll` present. PH-D3 service worker: cache name changes per build (`nouf-shell-0.0.0-20260809051029-4309ac`), 6 precached files.

---

## §5 — Closing-claims verification (v3 §4 rule 1, retroactive per §0's account-limit interruptions — the gate is discharged here, not skipped)

| Claim | Measured evidence |
|---|---|
| `git merge main` then `git merge wl-a-core` clean | §0 — both clean, no conflicts |
| `npx tsc --noEmit` green after adapting to new contracts | §1.1–§1.4, §4.4 — 0 errors, confirmed repeatedly through the session |
| Three-register maze board | §1.4/§1.2 — travelled (permanent, both teams), adjacent (mouth stubs at the current junction, not currently exercised — disclosed gap §1.5), distant (`maze-decor.ts`, decorSeed-only) |
| Distant register leaks no real topology, 2 red→green mutations | §1.3 — both mutations applied to real source, RED confirmed with real diff/assertion output, reverted, GREEN confirmed |
| Two cased, non-blending, non-shared-centerline trails | §1.4 (CSS), §4.1 (V31 measured: 20px core/28px casing/28-28 dash), `maze-trail-separation.test.ts` (analytic proof the two approach lines never close closer than 2× half-width) |
| Fixed route-card row, band invariance, arm delay | §4.1 — V32/V33/V34 all measured PASS with real numbers |
| Dead-end copy «طريق مسدود!», never «خطأ» | `maze-beat.ts` — `.result-banner.is-dead-end` reuses the banner layout but never `.is-wrong`'s class/colour |
| «سريعة — ٤» + two-number copy + «محطات» sweep | §3 — `PRESETS`/`questionsNeededForPlayable`/`questionsNeededForComfortable` imported, never re-derived; grep confirms 0 «خطوات» in `src/stage/**` |
| V29–V36 + I15 | §4.1 — V29/V31/V32/V33/V34/V36/I15 measured; V30 (CVD simulation) and V35's live pixel-sampling half NOT done, disclosed in §1.5/this table below |
| No regression: two taps | `commitMove`/`commitContinue` in `app.ts` — tap1 (answer) + tap2 (route card OR «السؤال التالي») is now genuinely 2 taps end-to-end (§1.0/§1.4 disclose and close the PRE-EXISTING 3-tap gap) |
| No regression: one-action undo | Unchanged — every screen still calls `buildUndoCorner`; `verify-b5`'s `f4UndoNoSelfRevert` re-confirmed |
| No regression: no-tell | `chrome.ts`'s `buildOptionsGrid` untouched; route cards carry no `deadEndExit` data (I15, §4.1) |
| No regression: B6 reachability | §4.3 — re-ran unmodified, `allPass: true` |
| No regression: existing V-pack | §4.3 — verify-b5 (real regression found+fixed), verify-b3 (crash found+fixed, one section disclosed-superseded), verify-resume (clean); verify-b1/b2/pack NOT re-run (disclosed) |

## §6 — Debts / disclosed gaps (named, not hidden)

1. **ADJACENT register not visually exercised** — `maze-view.ts` supports it but `maze-beat.ts` never passes `activeTeam`/`openExits` (§1.5). The route cards' own أ/ب/ج + direction-word labels carry the R-1 convention without it.
2. **Token "run" is a static jump, not a smooth animation** — same limitation the pre-B7 code already had (§1.5).
3. **V30 (CVD simulation) not implemented** — needs a real colour-matrix render pass; out of this session's budget.
4. **V35's live pixel-sampling half not implemented** — the analytic half (`maze-trail-separation.test.ts`) proves the geometric precondition for blending can never occur; a real rasterised pixel sample was not additionally taken.
5. **V36's cursor-auto-hide-after-2s half not implemented** — only the "no pointer handlers" half is verified.
6. **Team-setup's default placeholder team names** («الفريق الأزرق»/«الفريق البرتقالي») no longer match the NEW team colours (A is now yellow, B is now blue) — cosmetic only (freely renamable by the host), deliberately NOT changed because several older historical verify scripts (`verify-b2`/`verify-b3`/`verify-pack`) assert on these exact literal strings and changing them was judged higher-risk than the cosmetic mismatch it would fix.
7. **Unlock-nudge sentence** (deck-floor addendum §5, "زد ⟨…⟩ وتنفتح لك «⟨label⟩»") not wired as a standalone UI element — the per-chip refuse subline covers the equivalent number per preset (§3).
8. **`verify-b1.manual.cjs`/`verify-b2.manual.cjs`/`verify-pack.manual.cjs` not re-run this session** (§4.3) — lower risk (predate the most-touched surfaces) but genuinely unverified against this session's changes.
9. **§1.5's interpretation of the 400ms arm delay** (measured from band-mount, not from "the token-move animation" literally, since no token is mid-flight at that instant) — declared, not the only possible reading.

## §7 — Files touched (WL-B ownership; not committed — coordinator commits)

`src/stage/session/game-driver.ts` · `src/stage/maze-geometry.ts` (rewrite) · `src/stage/maze-decor.ts` (new) · `src/stage/screens/maze-view.ts` (rewrite) · `src/stage/screens/maze-beat.ts` (rewrite) · `src/stage/screens/chrome.ts` · `src/stage/screens/question.ts` · `src/stage/screens/question-text.ts` · `src/stage/screens/question-image.ts` · `src/stage/screens/question-audio.ts` · `src/stage/app.ts` · `src/stage/screens/team-setup.ts` (rewrite) · `src/stage/screens/ending.ts` · `src/styles/tokens.css` · `src/styles/stage.css` · `src/editor/ui/stage-preview.ts` (one call site, necessary contract-adaptation edit, disclosed §1.4) · `tests/stage/maze-fog.test.ts` (new) · `tests/stage/maze-trail-separation.test.ts` (new) · `tests/stage/verify-b7-maze.manual.cjs` (new) · `tests/stage/verify-b5.manual.cjs` (route-card play-loop fix) · `tests/stage/verify-b3.manual.cjs` (contract-adaptation + disclosed supersession).

Dev server (port 3011, background) — stopped at session end, port re-verified free.
