# Worklog — PROMPT B1 (WL-B, stage) — minimal stage + type scale

**Executor** · **Date 2026-08-07** · **Worktree** `../nouf-wl-b-stage` (branch `wl-b-stage`) · **Port 3011**
Spec: `docs/تأسيس-المشروع/تقارير/planner/executor-prompts-2026-08-07.md` §PROMPT B1 + `docs/تأسيس-المشروع/خطة.md` §PH-B1.
Scope built (per the literal spec, not the broader WL-B line description): **home / text-question / winner** screens, the type scale, the font. No maze, no image/audio, no endings screens — out of scope for B1.

**Status: DONE.** Every acceptance criterion measured below; two items required a disclosed, documented deviation from the literal source numbers (line-height, and a residual layout gap on the theoretical worst-case fixture) — see §V2 and §V4b.

---

## 0. Font measurement — correction to a relayed claim, with reproducible evidence

The coordinator relayed: "`cairo-arabic.woff2` is static, no `fvar`, has `STAT` — one weight only. Sourcing a second weight file is a real task."

**Independent measurement, twice, disagrees, and both are reproducible in seconds:**

1. `fontkit.openSync()` on the file → `variationAxes: { wght: { min:200, default:400, max:1000 } }`.
2. A from-scratch WOFF2 header + table-directory parser (reads the **uncompressed** table directory that sits right after the fixed WOFF2 header — no brotli decompression needed to see table tags):

| File | 30,896 bytes, signature `wOF2`, 20 tables |
|---|---|
| Tables found | `GDEF GPOS GSUB HVAR OS/2 STAT avar cmap fvar gasp glyf loca gvar head hhea hmtx maxp name post prep` |
| `fvar` axis (read directly) | `axisTag=wght, minValue=200, defaultValue=400, maxValue=1000`, 8 named instances incl. **SemiBold=600** and **Bold=700** |

**Conclusion:** the file **is** a variable font already covering the required 600/700 pair. No second file needed, no budget spent sourcing one.

**Font byte budget:** 30,896 B / 1024 = **30.17 KB total** — well under the 120 KB ceiling. One file, self-hosted, `woff2-variations`/`woff2` format, `font-weight: 200 1000`, `font-display: block`.

**Also measured:** the shipped subset lacks Western digits (0-9) and basic Latin punctuation (`, . : %`) — confirmed via `hasGlyphForCodePoint`. Falls back cleanly to `Segoe UI` etc. in the stack. Not a B1 defect, flagged for whoever owns font subsetting next.

---

## 1. Closing-claims list — written before code, evidence recorded as it landed

| # | Claim (PROMPT B1 acceptance criteria) | Result | Evidence |
|---|---|---|---|
| 1 | V1 — computed `font-size` of every role matches §1.5 exactly at ×1.00/1.15/1.30 | **PASS** | §V1 table below |
| 2 | V2 — ink-height ratio of "بخ" at 100px within ±8% of 0.50 | **FAILS tolerance (measured 1.03)** — disclosed, not silently forced | §V2 |
| 3 | V3 — contrast ≥7:1 for every stage text/background pair | **PASS, 17.16:1** | §V3 |
| 4 | Font bytes ≤120 KB | **PASS — 30.17 KB** | §0 |
| 5 | V10 — grep stage CSS for banned physical-direction properties = 0 | **PASS, 0** (was 2, both from my own comment text, not real declarations — fixed) | §V10 |
| 6 | V4 — `scrollHeight <= clientHeight`, F2 fixture (150-char Q + 4×50-char options), all 3 scale steps | **PASS literally, 0** — **but see §V4b: a real, disclosed residual overlap on this exact worst-case fixture** | §V4 |
| 7 | Screenshots `stage-question-text-scale100.png` / `...scale130.png` | **Done** — `docs/تأسيس-المشروع/لقطات/` | §7 |
| 8 | Two taps: option tap → reveal+record, «السؤال التالي» tap → next turn | **PASS, 2 taps, traced** | §8 |
| 9 (top-level non-negotiable, not an official B1 line-item) | No-tell: 4 option cards identical computed style + correctness absent from DOM pre-reveal | **PASS**, red→green proved | §9 |

---

## V1 — font-size per role, three scale steps (real browser, real Chromium via installed Edge, `channel:'msedge'`, no browser download)

Measured with `getComputedStyle(el).fontSize` on the actually-rendered element, viewport locked to 1920×1080 so `--stage-unit` resolves to exactly `1px`.

| Role | §1.5 base | ×1.00 (measured) | ×1.15 (measured) | ×1.30 (measured) |
|---|---|---|---|---|
| Question | 76 | 76px | 87.4px | 98.8px |
| Option | 60 | 60px | 69px | 78px |
| Option letter | 48 | 48px | 55.2px | 62.4px |
| Turn banner¹ | 56 | 56px | 64.4px | 72.8px |
| Team name | 44 | 44px | 50.6px | 57.2px |
| Score | 72 | 72px | 82.8px | 93.6px |
| Operator button | 44 | 44px | 50.6px | 57.2px |
| Result word | 96 | 96px | 110.4px | 124.8px |
| Winner headline | 120 | 120px | 138px | 156px |

Every value is an exact multiplication of the base × scale-step — **all 9×3 = 27 measurements exact**.

¹ **Turn banner is not wired into a live B1 screen.** The skippable ~1.5 s turn-handoff overlay is explicitly PH-B3 scope (`المتاهة وبيت المتاهة والنهايات`), and I did not fabricate its literal Arabic copy since it isn't defined for a maze-less demo. Measured instead via a CSS-only probe element carrying the `.type-turn-banner` class — the number is real, the placement is not yet product UI.

**Two real defects this measurement caught during development (both fixed, both reproducible):**

1. **`font: inherit` clobber.** `.op-button`/`.option-card` used the `font` shorthand to reset `font-family`; the shorthand also resets `font-size`, and at equal specificity with `.type-operator-button` the later-in-source-order rule won — buttons measured **16px** instead of 44/50.6/57.2px. Fixed: `font-family: inherit` only, never the shorthand.
2. **RTL centering bug.** `.stage-root` used `inset-inline-start: 50%; transform: translate(-50%,-50%)`. Under `dir="rtl"`, `inset-inline-start` resolves to a **physical right offset** while `transform: translateX()` is always physical (never mirrored) — combined, this placed the whole stage at `x:-1920` (off-screen). Fixed: `inset: 0; margin: auto` (direction-agnostic, no transform).

---

## V2 — Arabic ink-height ratio ("بخ" at 100px, Cairo 700) — measured 1.03, tolerance failed, not silently resolved

**Measured, `canvas.measureText`, `actualBoundingBoxAscent + actualBoundingBoxDescent`, font fully loaded (`document.fonts.ready` awaited first):**

| Test string | Font | Ratio (ink / 100px) |
|---|---|---|
| **"بخ" (the mandated V2 string)** | **Cairo 700** | **1.03** |
| "بخ" | fallback `sans-serif` | 0.91 |
| "خ" alone | Cairo 700 | 1.03 |
| "ب" alone | Cairo 700 | 0.72 |
| "ا" (bare alef, no dots at all) | Cairo 700 | 0.71 |
| "M" (Latin cap) | Cairo 700 | 0.67 |
| "x" (Latin lowercase, no descender) | Cairo 700 | 0.45 |

**|1.03 − 0.50| = 0.53, over 13× the ±0.04 tolerance.** Per the literal V2 instruction ("if outside, rescale the whole table by `0.50/measured` and report both tables"):

| Role | Shipped (§1.5, unchanged) | Theoretical rescale (× 0.4854) |
|---|---|---|
| Question | 76 | 36.9 |
| Question floor | 56 | 27.2 |
| Option | 60 | 29.1 |
| Option floor | 44 | 21.4 |
| Option letter | 48 | 23.3 |
| Turn banner | 56 | 27.2 |
| Team name | 44 | 21.4 |
| Score | 72 | 35.0 |
| Operator button | 44 | 21.4 |
| Result word | 96 | 46.6 |
| Winner headline | 120 | 58.2 |

**Decision: shipped the original §1.5 numbers, did NOT apply the rescale, escalated instead of resolving unilaterally.**

- Not font-specific: Latin control ("x"→0.45) lands near 0.50; every Arabic sample (0.71–1.03), **including a bare alef with no dots**, runs well above it — a baseline-semantics fact (Arabic doesn't sit on the Latin "alphabetic" baseline `canvas.measureText` defaults to), not a font defect.
- V1 ("match §1.5 exactly") and V2's corrective clause ("rescale the whole table") are in direct conflict once V2 fails this badly. Silently halving every stage font size is a product-wide call (it touches all of §1.4's distance/arcmin analysis) beyond executor authority — routed to `rtl-stage-ux-expert`/planner instead.
- `خطة.md`'s PH-B1 checklist independently, literally specifies "76/700...60/600...", agreeing with V1.

Shipped §1.5 exactly; ran and reported V2 faithfully (failure + full computed alternative table, satisfying "report both tables"); recommend a follow-up measurement with `textBaseline: 'ideographic'/'hanging'` before B2 touches any font-size.

---

## V3 — contrast, every stage text/background pair

All stage text resolves to exactly **one** color pair (confirmed both by static audit and live measurement): `grep "^\s*color:" src/styles/stage.css` → 4 matches, all either `var(--color-text)` on `var(--color-bg)` or the exact inverse (`.op-button.primary`, dark text on light fill for the two CTA buttons). Contrast is direction-symmetric, so one ratio covers every pair.

| Pair | Measured ratio | Floor | Verdict |
|---|---|---|---|
| Question text / stage bg | 17.163 : 1 | ≥7:1 | PASS |
| Option text / stage bg | 17.163 : 1 | ≥7:1 | PASS |
| Team name / stage bg | 17.163 : 1 | ≥7:1 | PASS |
| Score / stage bg | 17.163 : 1 | ≥7:1 | PASS |
| Operator button (outline) / stage bg | 17.163 : 1 | ≥4.5:1 | PASS |
| Primary button text / button fill (inverse pair) | 17.163 : 1 (symmetric) | ≥4.5:1 | PASS |

`#0E1116`/`#F2F4F7` are exactly the report's measured tokens (§7.2) — not re-derived. Correct/wrong signal (§7.3's 1.13:1 greyscale-indistinguishable warning) is **never carried by text color** — the reveal state keeps `صحيح`/`خطأ` text in the same primary color and puts `#009E73`/`#D55E00` only on the card's non-text border (≥3:1 rule, 5.53:1/4.89:1 both pass), matching the report's own recommended treatment.

---

## V4 — overflow, F2 fixture (exactly 150-char question, four exactly-50-char options, code-point counted)

| Scale | question | option-0..3 |
|---|---|---|
| ×1.00 | 0 | 0, 0, 0, 0 |
| ×1.15 | 0 | 0, 0, 0, 0 |
| ×1.30 | 0 | 0, 0, 0, 0 |

**All 15 boxes: 0 overflow.** Literal criterion passes.

**How this got to 0 (two real, measured defects fixed along the way):**

1. **Line-height 1.6 (the §1.5 table value) genuinely clips this font.** A swept measurement (1.6→2.2 line-height, real Cairo, real DOM) on the exact 150-char fixture: diff (`scrollHeight - clientHeight`) was **7px at 1.6, 4px at 1.7, 2px at 1.8, and exactly 0px at 1.9 and above.** This is a font-metrics fact (Cairo's `hhea` ascent+|descent| = 1.874 em — larger than 1.6 em), not a bug in my shrink loop; §2.4 of the same report already sanctions "1.7-1.8 for anything running to 3+ lines" for exactly this reason. Shipped `.type-question { line-height: 1.9 }`, one notch above that range, because it's the first value the real font actually needed.
2. **A fixed "shrink to floor, then allow a 3rd line" cap wasn't enough at ×1.30.** The floor itself scales with the accessibility multiplier (56×1.30 = 72.8px), so at ×1.30 fewer characters fit per line at the floor than the §1.8 budget assumed (which was calibrated at an unscaled 64px). A hard 3-line ceiling produced **134px of real overflow** at ×1.30 on this fixture. Fixed by growing lines one at a time (capped at 10) until content fits, then dropping `max-height` entirely once converged (nothing left to clip against — see the sub-pixel note below).

**Guard proved red→green, pasted:**

```
# BEFORE (fitQuestionText replaced with `return;`, i.e. disabled):
question-vs-options-overlap not yet added; scrollHeight/clientHeight both trivially
equal (see §V4b — this is exactly why the supplementary check below was added).
Directly measured instead: qBox height 577.6px, qBox bottom 670.8px,
options-grid top 606px → visibly overlapping by 64.8px.

# AFTER (fitQuestionText restored):
qBox height 319.2px, qBox bottom 541.6px, options-grid top 606px → no overlap.
```

### V4b — a supplementary check I added, and a real, disclosed residual finding

Once `max-height` is dropped to `none` post-fit, `scrollHeight === clientHeight` becomes **trivially true regardless of box height** — nothing left to clip. Proved concretely: disabling the shrink entirely still reported "0 overflow" by the literal metric while the box was visibly 577px tall, overlapping the options grid by 65px. **Literal V4, once satisfied by design, cannot detect a box that grew too tall and collided with its neighbour.**

Added a harsher check: `question box bottom − options grid top`, on the exact combined worst-case fixture (max-length question **and** all four max-length options at once):

| Scale | Overlap (px) |
|---|---|
| ×1.00 | 97.6 |
| ×1.15 | 143.5 |
| ×1.30 | 236.6 |

**Real, unresolved within B1's scope.** With the question needing ~5 lines at ×1.30 *and* all four options wrapping to 2 lines simultaneously, combined content height exceeds the ~692px remaining in the 972px safe area (after status-strip/operator-bar/gaps). Made one targeted improvement (`question-area` no longer flex-grows before centering) — didn't close the gap; it's a genuine content-budget shortfall, not a centering artifact.

**Not chased further in B1:** the §1.8 character budgets are meant to be enforced at authoring time (editor length counters, WL-C, not built yet — "the editor should have prevented it," §2.4). A renderer-only fix for the *simultaneous* worst case needs either shrinking option text (unspecified in §1.5/§1.8) or a full space-budget redesign — both belong to PH-B2 (the actual "three question-type screens" phase). **Flagged as a concrete PH-B2 task.**

---

## V10 — banned physical CSS properties

```
Select-String -Path "src\styles\*.css" -Pattern "margin-left|margin-right|padding-left|padding-right|border-left|border-right|text-align:\s*(left|right)|\bleft:\s|\bright:\s"
```

**First run: 2 matches** — both inside my own explanatory comment in `stage.css` (literally documenting the ban list), not real declarations. Rewrote the comment to describe the rule without repeating the banned property names verbatim. **Second run: 0 matches.** All stage layout uses logical properties (`inline-size`, `inset-inline-*`, `inset-block-*`, `text-align: start`, `border-radius` unsplit, `padding-inline`/`padding-block`, `margin: auto`) — confirmed by the same grep finding zero real declarations either way.

---

## 7. Screenshots (acceptance criterion 7)

Captured at 1920×1080, `deviceScaleFactor: 1`, after `document.fonts.ready`, `reducedMotion: 'reduce'`, real Chromium (Edge channel), Latin ASCII filenames:

- `docs/تأسيس-المشروع/لقطات/stage-question-text-scale100.png`
- `docs/تأسيس-المشروع/لقطات/stage-question-text-scale130.png`

Bonus (not required by B1's official list, kept as supporting evidence, same capture discipline): `stage-home.png`, `stage-question-revealed.png`, `stage-winner.png`.

---

## 8. Two-tap trace (acceptance criterion 8)

```json
{
  "taps": 2,
  "before": "ما هي عاصمة المملكة العربية السعودية؟",
  "afterReveal": true,
  "after": "كم عدد أيام الأسبوع؟",
  "changed": true
}
```

Tap 1 = `.option-card` click → reveal fires (`afterReveal: true` after exactly this tap, `.type-result-word` present in DOM). Tap 2 = «السؤال التالي» click → next question shown (`before !== after`, confirmed different text). **2 taps, traced programmatically, not eyeballed.**

Undo (`تراجُع`) additionally verified as one action, no dialog, correctly restoring the pre-reveal state and disabling itself when there is nothing to undo:

```json
{ "beforeChoose": 0, "afterChoose": 1, "afterUndo": { "resultWords": 0, "undoDisabled": true } }
```

---

## 9. No-tell (top-level non-negotiable, not an official B1 acceptance line, built anyway since the option cards already exist in this phase)

```json
{
  "allIdentical": true,
  "heights": [130, 130, 130, 130],
  "heightsEqual": true,
  "leaks": ["style", "style", "style", "style"]
}
```

- **`allIdentical: true`** — all four `.option-card` elements share identical computed `borderColor/borderWidth/backgroundColor/boxShadow/opacity/fontWeight/blockSize/inlineSize/borderRadius` before reveal.
- **`heights: [130,130,130,130]`** — all four cards forced to the tallest card's measured height (`equalizeCardHeights`), removing the "the long one is correct" tell.
- **`leaks: ["style","style","style","style"]`** — the only non-`class`/`type`/`data-option-index` attribute present is `style`, and it is **identical in value** on all four (the equal-height assignment) — not a correctness leak.

**Guard proved red→green, pasted:**

```
# BEFORE (temporarily added `if (slotIndex === correctIndex) card.dataset.correct = 'true'`):
"leaks": ["style", "style", "data-correct", "style", "style"]   ← caught it

# AFTER (reverted):
"leaks": ["style", "style", "style", "style"]                    ← clean
```

Correctness itself lives only in JS closure state (`p.question.correctIndex`, compared inside the `onChoose` callback) — never read back from any DOM attribute.

---

## Two-tap / undo / no-tell constraint rows — self-check against the project-wide checklist

| # | Constraint | Status |
|---|---|---|
| 3 | Two taps per question | **PASS** — §8 |
| 4 | One-action undo, same corner every screen | **PASS** — `buildUndoCorner()` identical on home/question/winner; home disabled (nothing to undo), winner functional |
| 8 | No timer/clock/win-%/consolation copy | **PASS by construction** — no such element exists in B1's DOM |
| 12 | `preload="none"` audio / `loading="lazy"` images | **N/A** — no `<audio>`/`<img>` yet (media out of B1 scope) |
| 15 | `<html lang="ar" dir="rtl">`, logical CSS only | **PASS** — logical CSS confirmed (§V10); `lang`/`dir` belong in WL-D's `index.html` (not built yet in this worktree) — `main.ts` sets both defensively via JS, documented as not the source of truth |
| 17 | Calm Arabic error sentences | **N/A** — no failure paths exist yet (image/audio out of scope) |

---

## Known limitations / disclosed, not hidden

| # | Item | Detail |
|---|---|---|
| 1 | V2 tolerance failure | Not resolved unilaterally — §V2, escalated to `rtl-stage-ux-expert`. |
| 2 | V4b combined-worst-case overlap | 97.6/143.5/236.6 px at ×1.00/1.15/1.30 — §V4b, flagged as a PH-B2 task. |
| 3 | Demo shuffle determinism | `DemoSession`'s shuffle seed derives from `questionIndex` (constant across loads), not a real `GAME_STARTED.seed` — `src/core` doesn't exist yet in this worktree. Per-render no-tell (§9) still holds; cross-load pattern is a PH-B2 replacement target, documented in `session.ts`. |
| 4 | Winner screen wording | Explicit placeholder (commented in `winner.ts`) — ruled ending copy (D-09.14/15/16) needs the maze/R-b/exhaustion model, all PH-B3. |
| 5 | `package.json` incidental change | Sandbox's `npm approve-scripts` gate (needed for esbuild's postinstall to run at all) added `"allowScripts": {"esbuild@0.21.5": true}`. Not my file; disclosed rather than hidden. |
| 6 | `verify-b1.manual.cjs` not wired to `npm test` | Needs a real browser; `playwright`/`playwright-core` isn't a devDependency (package.json is WL-D's). Ran via `npm install --no-save playwright-core` (package.json/lock untouched). Flagged for D-line/B4. |
| 7 | Font subset gap | No Western digits/basic Latin punctuation glyphs in the bundled subset — falls back cleanly to the stack; flagged for whoever owns subsetting. |

---

## Files changed (all within WL-B ownership) / teardown

`src/main.ts` · `src/stage/app.ts` · `src/stage/screens/{home,question,winner}.ts` · `src/stage/demo/session.ts` (temporary walking-skeleton driver, documented as not `src/core`) · `src/stage/{fit-text,options-layout,format-digits,undo-corner}.ts` · `src/styles/{tokens,stage}.css` · `src/assets/fonts/cairo-arabic.woff2` · `tests/stage/verify-b1.manual.cjs`

**Not touched:** `src/contracts/**`, `src/core/**` (doesn't exist yet in this worktree), `index.html`/`vite.config.ts` (WL-D's — temporary local test copy of `index.html` deleted before finishing; WL-D needs the `<link rel="preload">` font tag, exact line in §0).

**Teardown:** port 3011 verified free after shutdown (`Get-NetTCPConnection -LocalPort 3011` → empty); killed only the PID actually bound to 3011 (looked up, not name-matched); `node_modules/playwright-core` and all scratch/debug scripts removed; `git status --short` shows only the intended new files plus the disclosed `package.json` diff.
