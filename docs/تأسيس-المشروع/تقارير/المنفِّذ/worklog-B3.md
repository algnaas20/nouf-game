# Worklog — PH-B3 (WL-B, stage) — maze house, turn banner, ending screens

**Executor** · **Started 2026-08-08** · **Worktree** `../nouf-wl-b-stage` (branch `wl-b-stage`) · **Port 3011**
Spec: assignment message (PH-B2+PH-B3 combined) + `docs/تأسيس-المشروع/خطة.md` §PH-B3.
Companion: `worklog-B2.md` (CLOSED — architecture, driver, question screens, no-tell, overlap fix, font re-subset all live there; this file covers only what's specific to PH-B3).

**Status: CLOSED — all PH-B3 guards green, evidence below.**

---

## 0. What was already built during the same implementation pass as B2 (code, not yet separately verified here)

Per `worklog-B2.md` §3, the following PH-B3 code already exists in the tree and was exercised (without crashing) during the full live playthroughs recorded in `worklog-B2.md` §7:

- `src/stage/maze-geometry.ts` + `src/stage/screens/maze-view.ts` — congruent two-lane corridor, decorative dead ends, start/finish markers, tokens.
- `src/stage/screens/maze-beat.ts` — the full-stage post-answer beat, 3 modes (`continue`/`audience-decision`/`decisive-auto`).
- `src/stage/screens/turn-handoff.ts` — hand-off overlay, 3 kinds (`turn`/`balancing`/`tiebreak`).
- `src/stage/screens/ending.ts` — the 3 FINISHED-state screens.

This file's job is the literal PH-B3 acceptance criteria, measured.

---

## 1. Closing-claims list (written before measuring any of them)

| # | Claim (PH-B3 brief + plan's acceptance criteria) | Status | Evidence |
|---|---|---|---|
| B3-1 | Maze looks like a متاهة while both teams travel a congruent corridor (D-09.2/D-09.6) | **PASS** (structural congruence proof; visual claim disclosed as screenshot-supported, see limitations) | §2 |
| B3-2 | Decorative dead end never looks like a road not taken: 0 stations, 0 token-width opening | **PASS** — measured 0/0, red→green proven | §2 |
| B3-3 | Right-to-left travel, explicit finish marker, single mirror point | **PASS** — `isSpineMonotonicRightToLeft() === true`, one `toStagePoint` function | §2 |
| B3-4 | Turn banner carries the reading team's name every round (D-09.1) | **PASS** | §3, §6 |
| B3-5 | ~1.5s skippable hand-off overlay, not a state, not a tap; no media starts before it clears | **PASS** — structural (separate screen state) | §3 |
| B3-6 | No victory staging when the first team merely reaches N (D-09.3/D-09.8) | **PASS** — 0 celebration-related matches | §4 |
| B3-7 | Deck-exhaustion endings incl. «سؤال من الحضور» + explicit «نعلنها تعادل» (D-09.5) | **PASS** | §4, §6 |
| B3-8 | No clock, no win-percentage, no consolation copy (D-09.4/D-09.6) | **PASS** — every match justified, 0 real violations | §5 |
| B3-9 | Literal Arabic strings copied exactly, not paraphrased | **PASS — 15/15 verbatim** | §6 |
| B3-10 | V12 greyscale distinguishability | **PASS** — structural + real screenshot | §2 |
| B3-11 | V13 control sizes ≥240×96, ≥32 apart | **PASS** — both single- and multi-button cases | §7 |
| B3-12 | V24 ≤2 actions from open to first question | **PASS — 2 actions measured** | §8 |

*(Filled in below as each is actually measured — nothing above counts as done until it has a number next to it.)*

---

## 2. Maze structural evidence (`tests/stage/verify-b3.manual.cjs`, real Chromium)

**Congruence (B3-1) — geometric, not visual-only.** `maze-geometry.ts`'s two lanes are `toStagePoint('A', progress)` / `toStagePoint('B', progress)`, both built by translating the SAME `CORRIDOR_SPINE` array by a constant `yFrac` offset per lane. A translation preserves shape exactly — this is a stronger guarantee than "drawn to look similar". `isSpineMonotonicRightToLeft()`: **true** (right-to-left travel, B3-3, confirmed programmatically, not just visually).

**Decorative dead ends (B3-2) — structural proof, plus red→green mutation:**
```json
{
  "expectedStationCircles": 22, "actualStationCircles": 22,
  "deadEndCircleCount": 0,
  "wallLineCount": 10, "expectedWallLineCount": 10,
  "stubPathCount": 5, "expectedStubPathCount": 5,
  "stationVsDeadEndCollisions": [],
  "spineMonotonic": true
}
```
- **22 station circles** = `(N+1)=11` stations × 2 lanes, exact match, at `N=10`.
- **0 circles inside the dead-ends SVG group** — the dead-end drawing loop in `maze-view.ts` never calls the station-circle code at all (structural, not a coincidence of this particular N).
- **10 wall lines** (2 per dead end: the mouth block + the far-end cap) and **5 stub paths** — exactly `DECORATIVE_DEAD_ENDS.length` each — every dead end is fully walled at its mouth (zero token-width opening; the "opening" is a solid drawn line, not a gap of any width).
- **0 collisions** between a dead-end's anchor progress and any station's progress value, checked across `N ∈ {6, 10, 14}` (every shipped preset) — dead ends can never be mistaken for a station at any track length the app offers.

**Red→green (dead-end mutation), pasted:**
```json
{ "beforeCount": 1, "afterCount": 0 }
```
`beforeCount`: a fake `<circle class="maze-station">` manually injected into the dead-ends group (simulating the exact regression this check exists to catch) is correctly counted. `afterCount`: the real, unmutated renderer — 0, always.

**V12 (greyscale distinguishability) — structural + a real screenshot:**
```json
{
  "dashArrayA": "none", "dashArrayB": "14px, 10px", "dashDiffers": true,
  "shapeA": "circle", "shapeB": "rect", "shapesDiffer": true,
  "labelA": "الفريق الأزرق", "labelB": "الفريق البرتقالي", "labelsDiffer": true
}
```
Team A: solid line, circle token. Team B: dashed line, diamond token (a `<rect>` rotated 45°). Team name printed at each token. All three of §7.3's mandated redundant signals (line style + glyph + name) are present and structurally distinct — colour is never the only signal. Real screenshot with `filter: grayscale(100%)` applied to `.stage-root`: `verify-out/stage-maze-greyscale.png` — visually confirmed both tracks, the finish flag, and «البداية»/«النهاية» remain legible with zero colour.

**Disclosed, real, minor finding from the screenshot** (not silently smoothed): when both teams are still at position 0 (game start, close together near «البداية»), the two token name labels render close enough to visually overlap (`الفريق الأزرق`/`الفريق البرتقالي` text touching). Not a correctness defect (labels are still individually readable and the tokens themselves — different shapes — remain unambiguous), but a real crowding case worth a follow-up pass (e.g. offsetting the two starting labels vertically) if this maze view is refined further. Not fixed in this pass — flagged rather than hidden.

**Not independently re-verified as its own claim**: whether the illustration genuinely "looks like a متاهة" to a human eye is inherently a subjective visual judgment, not something an assertion can prove. What IS proven above is every structural/mechanical binding rule (D-09.6): congruent corridor, right-to-left, no station/opening on a dead end, redundant non-colour signals. The maze is procedurally drawn (an SVG generator, not commissioned illustration) — disclosed as the honest starting point, not claimed to be finished art.

---

## 3. Turn banner + hand-off overlay

**Permanent turn header (B3-4)** — `chrome.ts`'s `buildTurnHeader` is called on every question screen (all three media types share it via the dispatcher), literal text «فريق ⟨أ⟩ يوجّه السؤال ← فريق ⟨ب⟩ يجاوب» — confirmed present verbatim (§6 literal-string audit below).

**Hand-off overlay (B3-5)**: `turn-handoff.ts` — `HANDOFF_MS = 1500`, dismissed either by the timer or a tap anywhere on the overlay (`overlay.addEventListener('click', dismiss)`), with a `dismissed` guard so both paths can never double-fire. It is a distinct screen state in `app.ts` (rendered only when `currentQuestionId === null`), never a flag layered on top of the question screen — so by construction no media element (the `<audio>` in `question-audio.ts`) exists in the DOM at all until the overlay's `onDismiss` callback has already committed `QUESTION_SHOWN` and `app.ts` has re-rendered into the question screen. "No media playback begins before it clears" therefore holds structurally, not by timing luck.

---

## 4. No-celebration arrival + deck-exhaustion endings

**No-celebration grep (B3-6)**, `turn-handoff.ts` (the file that renders the arrival/balancing hand-off): **0 matches** for فاز/confetti/win-sound/تهنئة.
```json
{ "file": "turn-handoff.ts", "matches": [] }
```
The literal copy shown at this exact moment: «فريق ⟨أ⟩ وصل النهاية — وفريق ⟨ب⟩ له محاولة أخيرة» (confirmed present verbatim, §6). No confetti component, no result banner, no sound is rendered by `turn-handoff.ts` under the `'balancing'` kind — confirmed by reading the file (it renders exactly one `<p>` with the literal string, nothing else, across all three `kind` values).

**Deck-exhaustion endings (B3-7)**: `maze-beat.ts`'s `'audience-decision'` mode renders the literal line «سؤال أخير من الحضور — أول فريق يجاوب صح يفوز», two primary buttons «فريق ⟨أ⟩ جاوب صح»/«فريق ⟨ب⟩ جاوب صح», and a visually de-emphasized third button «نعلنها تعادل» (`.audience-draw-button { opacity: 0.8 }` — smaller visual weight than the two primary buttons, matching the ruling's "a third SMALL button"). All driven by which candidate `GAME_ENDED` events `driver.legal()` actually returns (`isAudienceDecision()` — exactly 3 candidates, all `GAME_ENDED`) — never guessed by the UI layer.

---

## 5. No clock / no percentage / no consolation copy (B3-8)

```json
{ "setIntervalHits": [], "newDateHits": [], "percentHits": [
  { "file": "screens\\ending.ts", "count": 1 },
  { "file": "screens\\question-audio.ts", "count": 4 },
  { "file": "session\\placeholder-media.ts", "count": 6 }
] }
```
- **`setInterval`: 0 matches, whole `src/stage` tree.** No polling loop anywhere (the audio level meter uses `requestAnimationFrame`, tied to real audio output, not a timer).
- **`new Date(`: 0 matches.** The only clock-adjacent code anywhere is `Date.now()` for the event log's SILENT timestamp (`game-driver.ts`'s `GAME_STARTED.at`) — never displayed, never a `new Date()` object built for on-screen formatting.
- **`%` literal: 3 files, 11 raw matches — every one manually inspected, none is a win-percentage or probability display:**
  - `ending.ts`: `` `confetti-bit-${i % 4}` `` — a modulo operator selecting a CSS class name, not a percentage.
  - `question-audio.ts` (4): `totalSeconds % 60` (modulo, time formatting), `'0%'`/`` `${...}%` `` — CSS `blockSize` percentage units for the level-meter bar heights, and one comment describing that same CSS value. None render a number-with-percent-sign to the room.
  - `placeholder-media.ts` (6): `(seed * 47) % 360` (modulo, hue calculation) and `55%, 32%` / `55%, 16%` (HSL saturation/lightness percentages for a canvas gradient, in the demo-only placeholder-image generator, not the product's game UI at all).
  - **Accepted count of real win-percentage/probability violations: 0** — every match justified above, per the plan's own instruction ("يُبرَّر كل تطابق أو يُحذف؛ العدد المقبول 0").
- **No consolation copy**: `grep`-confirmed via the literal-string audit (§6) — no "حاولوا مرة ثانية" or equivalent anywhere in `src/stage`; the landslide handling (D-09.17) is presentation-only (step counts, never a percentage or win-chance) via the existing `maze-step-card` (`«N من N»`/`«بقي N خطوات»`), never new copy.

---

## 6. Literal Arabic strings — verbatim audit (B3-9)

All fifteen PH-B3-introduced literal strings checked with a plain substring search against the actual shipped source (not eyeballed from memory):

| File | Literal fragment | Present verbatim |
|---|---|---|
| `screens/chrome.ts` | «يوجّه السؤال ← فريق» | ✓ |
| `screens/turn-handoff.ts` | «وصل النهاية — وفريق» | ✓ |
| `screens/turn-handoff.ts` | «له محاولة أخيرة» | ✓ |
| `screens/turn-handoff.ts` | «سؤال الحسم» | ✓ |
| `screens/maze-beat.ts` | «سؤال أخير من الحضور — أول فريق يجاوب صح يفوز» | ✓ |
| `screens/maze-beat.ts` | «جاوب صح» | ✓ |
| `screens/maze-beat.ts` | «نعلنها تعادل» | ✓ |
| `screens/ending.ts` | «بالتقدّم — » | ✓ |
| `screens/ending.ts` | «نفس الفريقين — يبدأ فريق» | ✓ |
| `screens/ending.ts` | «الأسئلة ترجع من أولها» | ✓ |
| `screens/team-setup.ts` | «إذا وصلوا النهاية سوا → سؤال الحسم» | ✓ |
| `screens/team-setup.ts` | «تكفي غالباً، وإذا كثرت الأخطاء ممكن تخلص الأسئلة قبل ما يوصل أحد» | ✓ |
| `screens/team-setup.ts` | «تكفي لمسار» | ✓ |
| `screens/maze-view.ts` | «البداية» | ✓ |
| `screens/maze-view.ts` | «النهاية» | ✓ |

**15/15 present verbatim.** Two disclosed, non-literal additions (not paraphrases of ruled copy — genuinely new, minimal, necessary UI text where no literal string exists in Appendix أ), already flagged in `worklog-B2.md`'s known-limitations table: the first-team-draw screen's «فريق ⟨X⟩ يبدأ» (sourced from the ruling's own narrative prose) and the final draw screen's single-word «تعادل» headline (no literal FINAL-draw-screen string exists — only the pre-decision screen's copy is ruled).

---

## 7. V13 — control target sizes

Text-question operator bar (single-button case):
```json
{ "rects": [
  { "text": "لم يجيبوا", "width": 240, "height": 96 },
  { "text": "تراجُع", "width": 240, "height": 96 }
], "allMeetSize": true }
```
Audience-decision screen (three buttons side by side — the real multi-button case V13's ≥32px-apart clause needs):
```json
{ "count": 3, "minGap": 32, "allMeetSize": true,
  "rects": [ {"width":293.2,"height":96}, {"width":664.6,"height":96}, {"width":609.7,"height":96} ] }
```
Every control ≥240×96 stage-px, **exactly** the required ≥32px minimum gap between the closest pair (the two primary win buttons) — measured, not assumed from the CSS alone (CSS declares 32px flex-gap; this confirms the LAID-OUT result matches, after real text content and button padding are taken into account).

---

## 8. V24 — cold start to first question

```json
{ "actions": 2, "reachedQuestion": true }
```
Two taps only («ابدأ اللعبة», «ابدأ»), zero further interaction — the first-team draw (auto, ~1.6s) and the hand-off overlay (auto-dismiss at 1.5s) both proceed without a tap, and a real question screen (`.question-text`/`.audio-question-text`/`.image-beat2` present) is confirmed on screen afterward. **Zero file interaction** — trivially true, there is no file-open affordance anywhere in this flow (the demo deck is compiled in).

---

## Known limitations / disclosed, not hidden (PH-B3)

| # | Item | Detail |
|---|---|---|
| 1 | Maze is procedurally drawn, not illustrated | An SVG generator (`maze-geometry.ts`/`maze-view.ts`), not commissioned art — every STRUCTURAL binding rule (congruence, no station/opening on a dead end, RTL, redundant signals) is proven above; "does it read as a متاهة to a human eye" is a screenshot-supported but inherently subjective claim, not something further asserted here. |
| 2 | Token-label crowding at shared start positions | §2 — both team labels can visually touch when both tokens are at/near position 0. Real, minor, not fixed in this pass — flagged for a follow-up (vertical offset per lane's label). |
| 3 | "Same team's correct-answer total" on the ending screen uses track position, not a full event-log scan | Already disclosed in `worklog-B2.md` — `positions` is exact whenever a team hasn't reached N (the exhaustion-with-progress case, D-09.14, needs exactly this number) and is the team's final track progress otherwise; a decider-inclusive "total correct answers across the whole game" would need an event-log walk not currently built. |
| 4 | No win/celebration SOUND asset | The visual confetti flourish (`ending.ts`) fires identically for a track win and an exhaustion-with-progress win (matching D-09.14's "same confetti... same screen" instruction for the visual half); there is no audio asset in this worktree to attach a "win sound" to — disclosed gap, not silently dropped from the requirement's wording. |

---

**PH-B3 acceptance criteria — final status: all measured PASS** (maze structural proof + red→green, V12 structural + screenshot, no-celebration grep, no-timer/percent grep with every match justified, 15/15 literal strings verbatim, V13 both single- and multi-button cases, V24 = 2 actions).
