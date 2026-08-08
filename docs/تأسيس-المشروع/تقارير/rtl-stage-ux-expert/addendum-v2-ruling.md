# Addendum — Ruling on check V2 (Arabic ink-height ratio), and the Cairo font correction

**Agent:** `rtl-stage-ux-expert` · **Track:** تأسيس-المشروع · **Date:** 2026-08-07
**Amends:** `stage-ux-investigation.md` §1.3, §1.4, §3.2, §3.3, §8 (check V2)
**Language:** English. Arabic product copy unchanged by this addendum.

**Verdict in one line: the check recipe I wrote was wrong, the number it was meant to test is not. The executor measured correctly and was right to stop.**

---

## 1. What the ~0.50 figure was intended to be — precise definition

| | Definition |
|---|---|
| **Intended quantity** | **The height of the Arabic letter body above the alphabetic baseline, divided by the CSS `font-size`.** The x-height analogue for Arabic — the "tooth" height of ب/ت/ن, the loop height of ه |
| **Explicitly excludes** | dots above the letter (i'jām), dots below, descenders below the baseline, tashkīl, and the ascenders of ا/ل/ك/ط |
| **Where it is used** | It is the `h` in ISO 9241-303's `θ = 3438 × h / D`. It is the only bridge between a CSS px size and an angular legibility claim |
| **Why that quantity** | ISO 9241-303 defines character height for Latin as cap height *without diacritics*. The Arabic analogue is the letter body, not the extreme ink extent. Using total ink extent would credit dots and descenders as legible "character height" and overstate legibility by roughly 2× |

**Symbol for the rest of this document:** `r` = letter-body ratio (intended ≈ 0.50).

---

## 2. Which of the three is wrong

| Candidate | Verdict |
|---|---|
| The **check recipe** | **Wrong. My error.** I specified `actualBoundingBoxAscent + actualBoundingBoxDescent` on the string **"بخ"**. That string contains a raised dot (خ) and a deep descender bowl (خ), and ب carries a dot below the baseline. The sum of ascent+descent is the **total ink bounding box of the whole string** — dot-top to descender-bottom. It measures a different quantity from the one the sentence above it named |
| The **definition** | **Ambiguous as published.** §1.3 named "letter body" in prose but handed over a recipe that measures total extent. A reader following the recipe cannot arrive at the named quantity. Both halves needed to agree and did not |
| The **number (0.50)** | **Not refuted.** See §3 |
| The executor's **implementation** | **Correct.** 1.03 is the right answer to the question my recipe actually asked, under standard baseline semantics (`actualBoundingBoxAscent` measured upward from the alphabetic baseline, `Descent` downward) |

---

## 3. Why 1.03 is consistent with r ≈ 0.50, not contrary to it

Plausibility reconstruction of "بخ" total ink extent in a naskh-derived sans at 1 em. **This is arithmetic on typical proportions, not a measurement I performed** — it exists only to show the two numbers are not in conflict:

| Component of the measured extent | Typical share |
|---|---|
| Dot above خ, from letter-body top to ink top | ~0.25 em |
| **Letter body, baseline to body top** | **~0.50 em** ← the intended `r` |
| Descender bowl of خ, baseline to ink bottom | ~0.28 em |
| **Total** | **~1.03 em** |

The executor's 1.03 reconstructs cleanly with `r = 0.50` intact. His measurement is evidence *for* the number, once the two are recognised as different quantities.

---

## 4. The corrected check — one unambiguous target

**V2 is downgraded from a per-build pass/fail gate to a one-time recorded calibration.** Rationale: it calibrates a physical constant, it cannot regress unless the primary font changes, and a gate that fires on nothing is noise. V1 (computed font-size, 27/27) already covers the per-build concern.

### V2 (revised) — one-time calibration, record the number, do not gate

| Field | Value |
|---|---|
| **Purpose** | Calibrate `r`, the constant inside the legibility derivation |
| **String** | **`ه`** (U+0647, isolated) — no dots, no ascender, no descender in this class of typeface |
| **Measurement** | `actualBoundingBoxAscent` **only**, at `font-size: 100px`, `textBaseline: 'alphabetic'`, after `await document.fonts.ready`, at **each stage weight (600 and 700)** |
| **Formula** | `r = actualBoundingBoxAscent('ه') / 100` |
| **Sanity guard** | Also record `actualBoundingBoxDescent('ه')`. It must be **≈ 0** (< 0.03 em). If it is not, the baseline is not where this measurement assumes and the result must not be used |
| **Expected band** | **0.45 – 0.55** |
| **Outcome** | Record `r` in the worklog. **No pass/fail.** If `r` falls outside 0.42–0.58, escalate to me before proceeding |
| **Re-run trigger** | Only when the primary stage font changes |

### V2b (new) — keep the executor's measurement, give it its real job

His 1.03 figure is not waste; it belongs to a different question. Record it under its own name:

| Field | Value |
|---|---|
| **Name** | Total Arabic ink extent |
| **Measurement** | `actualBoundingBoxAscent('بخ') + actualBoundingBoxDescent('بخ')` at `font-size: 100px` |
| **Measured** | **1.03 em** (executor, 2026-08-07) |
| **Purpose** | It is the **measured justification for the line-height rules and the ban on fixed pixel heights** in §2.4. A default `line-height: normal` of ~1.2 leaves only **0.17 em** of total leading around 1.03 em of ink — which is exactly why Arabic clips at default line-height. That sentence was asserted in the report; it is now measured |
| **Outcome** | Recorded metric, **not a gate** — clipping is already gated numerically by V4 (`scrollHeight <= clientHeight`). Adding a second gate for the same failure duplicates V4 without adding coverage |

---

## 5. What moves in the type scale — nothing that matters

| Quantity | Depends on `r`? | Moves? |
|---|---|---|
| **The px type scale** (76 / 60 / 44 / 96 / 120 stage-px) | **No** | **Does not move.** These were cross-validated independently against Android TV's 24sp/48sp guidance (= 48 px / 96 px at 1080p), which agreed within ~10%. That leg of the argument does not touch `r` at all. The scale stands on two supports and only one can wobble |
| The **arcmin labels** in the §1.5 table | Linearly | Scale by `r / 0.50`. Presentation only |
| **`D_max = 0.7803 × Δ × F / θ`** | Yes — `0.7803 = 1.5606 × r` | Coefficient becomes `1.5606 × r_measured` |
| The **room rule** ("≈2× diagonal") | Linearly | See sensitivity below |

**Sensitivity across the full plausible band (F = 60, θ = 22′):**

| `r` | Coefficient | Comfortable distance | 55″ comfortable | 13″ floor |
|---|---|---|---|---|
| 0.45 | 0.7023 | **1.92 × Δ** | 2.67 m | 0.89 m |
| **0.50** (published) | 0.7803 | **2.13 × Δ** | 2.97 m | 0.99 m |
| 0.55 | 0.8583 | **2.34 × Δ** | 3.27 m | 1.09 m |

**Every headline conclusion survives the entire band:**

- "Sit no farther than **about twice the diagonal**" — true for `r` anywhere in 0.45–0.55. **Restate it as "about 2×", not 2.13× — the published second decimal was false precision resting on an unmeasured constant.**
- "**55″ is the practical minimum** for a majlis, comfortable to ~3 m" — holds (2.67–3.27 m).
- "**A 13″ laptop serves guests only within ~1 m**" — holds (0.89–1.09 m).
- "**60 stage-px for options**" — unchanged; it is set by the px scale, which does not depend on `r`.

**Action for the executor: none.** Record `r`, keep building. If `r` lands outside 0.42–0.58, stop and escalate — that would mean Cairo's proportions are unlike the assumed class and the arcmin labels need restating.

---

## 6. Cairo correction — variable, 200–1000 wght, 30.17 KB

Thank you for the correction; my §3.2 "unknown to resolve first" is now resolved and my §3.3 budget task dissolves.

| Item | Status |
|---|---|
| **Weight recommendation 600 / 700 for stage text** | **Unchanged and now cheaper.** A 200–1000 wght axis covers both directly from the single file. The reason stands: thin strokes are the first casualty of TV sharpening and glare |
| **Second-weight sourcing task** | **Dissolved.** Confirmed |
| **Font budget** | Was ≤120 KB. Actual **30.17 KB**, one file. **Release the remaining ~90 KB to `static-delivery-expert`** for the overall bundle budget |
| **IBM Plex A/B (check V7)** | **Still worth the 20 minutes**, but the bar has moved against switching: Plex is 70.2 KB per *static* weight, so two weights ≈ 140 KB vs Cairo's 30.17 KB for the full axis. Cairo now wins on size by ~4.6×. Switch only if V7 shows Cairo's dot gap at 60 px below ~4 px |

### Three variable-font traps to check before this is closed

| # | Trap | Why it matters here | Check |
|---|---|---|---|
| **F1** | `@font-face` declaring a single weight (e.g. `font-weight: 400`) on a variable file | The browser clamps to 400 and **synthesises** 600/700 by smearing the outline. Synthetic bold fattens strokes and closes the dot gaps — precisely the legibility property we chose 600/700 to protect. It looks approximately right on a monitor and fails on a TV | `@font-face` must declare **`font-weight: 200 1000`** |
| **F2** | Synthetic bold or oblique applied silently anywhere | Same failure mode, harder to spot | Set **`font-synthesis: none`** on the stage root, so a missing weight fails visibly instead of being faked |
| **F3** | The 30.17 KB subset may not contain **Western digits U+0030–0039** | §2.6 chose Western digits for scores. If they are absent, digits fall back to a system font: different metrics, `tabular-nums` lost, and a visible mismatch in the one element the whole room stares at | **Verify U+0030–U+0039 are present in the file.** If absent, subset them in — do not accept a fallback-font score |

**New check to add to §8:**

| # | Check | Passes when |
|---|---|---|
| **V27** | Computed `font-weight` on stage text elements, and rendered stroke width of a reference glyph at 600 vs 700 | The two weights are **visibly and measurably different** (real axis instances, not synthetic). `font-synthesis: none` present in computed style |
| **V28** | Render the digits `0123456789` and compare the resolved font family against the Arabic text's resolved family | **Same family.** Any fallback is a defect (trap F3) |

---

## 7. Summary for the executor

| Question | Ruling |
|---|---|
| Was `r ≈ 0.50` a ratio of what to what? | **Arabic letter-body height above the alphabetic baseline ÷ CSS font-size.** Excludes dots, descenders, ascenders, tashkīl |
| Check, number, or definition wrong? | **Definition ambiguous and recipe wrong — both mine.** Your 1.03 is correct for what my recipe asked, and is *consistent with* `r = 0.50` once decomposed |
| Corrected target | **V2 revised:** `actualBoundingBoxAscent('ه') / 100`, descent must be ≈0, expected 0.45–0.55, **record only — no gate**, one-time, re-run only on a font change |
| Drop it instead? | Not quite — it calibrates a real constant. But **demoted from gate to recorded calibration**, and your 1.03 is retained as **V2b**, a recorded metric that now supplies the measured justification for the line-height rules |
| Does the type scale move? | **No.** The px scale is independently cross-validated and does not depend on `r`. Only the arcmin labels and the room-rule coefficient scale with it, and every conclusion holds across `r` = 0.45–0.55. **One wording fix: the room rule is "about 2× the diagonal", not 2.13×** |
| Font | Variable 200–1000 at 30.17 KB confirms 600/700 from one file. Budget freed. **Add checks V27 (no synthetic bold) and V28 (digits in the same family).** Traps F1–F3 above |

Nothing here blocks B1. Record `r` and continue; escalate only if `r` falls outside 0.42–0.58.
