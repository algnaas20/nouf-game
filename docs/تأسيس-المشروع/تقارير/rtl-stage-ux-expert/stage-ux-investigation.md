# Stage UX Investigation — Arabic RTL Shared-Screen Quiz Game («لعبة نوف»)

**Agent:** `rtl-stage-ux-expert` · **Track:** تأسيس-المشروع · **Date:** 2026-08-07
**Status:** Complete — pre-implementation investigation. No product code exists yet; nothing here was measured against a running build.
**Language:** English (audience = agents). **All Arabic strings are product copy and are marked `AR-COPY`. Do not translate them, do not paraphrase them — pass them through verbatim or replace them by user decision.**

### Architecture baseline folded in (2026-08-07, latest ruling)

User's words: **«لا أبي أرفع اللعبة وأجهزها قبل المسابقة وخلاص، ألغِ فكرة الفيديو»**

1. **The host authors the whole game in the browser days before the event, then publishes it with its content included.** On the night he opens the link and plays — no file to find, no upload, no fumbling in front of guests. Authoring is therefore a **calm, unhurried, multi-session, sit-down activity**. The failure that must never happen is **losing that work between sessions**. "Save to my computer" survives as backup, device transfer, and the route into publishing (§5A).
2. **No video. Media types are text, image and audio only.** All video guidance removed. **Audio now matters more, not less** — it is one of only three question types (§6.3, §7.6).
3. **Play model ruled:** the team that is **not** answering reads the question aloud off the screen. Consequence for this report: **the correct option must be visually indistinguishable from the other three before reveal** — no tell of any kind (§4.9). Target remains **two taps per question**.
4. Game name is **«لعبة نوف»**. Every filename the app emits must match `^[a-z0-9._-]+$` — Arabic goes inside files, never in a filename or a URL.

---

## 0. Scope, sources, and what is *not* mine

| In scope here | Owner elsewhere |
|---|---|
| Type scale, contrast, colour, spacing, safe area | — |
| RTL/bidi correctness rules and anti-patterns | — |
| Font choice, self-hosting, fallback stack | — |
| Operator (presenter) flow and tap count | Rules/turn order/win condition → `game-systems-expert` |
| Editor flow, cross-session work safety, publish hand-off UX | Pack format, storage, quota, audio encoding/loudness → `media-storage-expert`; publish mechanics and base path → `static-delivery-expert`; backup policy → `durability-advisor` |
| Layout skeletons, aspect-ratio behaviour | — |
| Verification checklist (numeric) | Whether a feature ships in v1 → user, via `scope-advisor` |

### Sources used (accessed 2026-08-07)

| # | Source | What I take from it |
|---|---|---|
| S1 | [ISO 9241-303:2011 — Requirements for electronic visual displays](https://cdn.standards.iteh.ai/samples/57992/bddfd91165b444f6b9815a6993feadc5/ISO-9241-303-2011.pdf) | Character height **≥ 16 arcmin** minimum; system should be able to provide **20–22 arcmin**. Backbone of §1. |
| S2 | [W3C — Understanding SC 1.4.3 Contrast (Minimum), WCAG 2.2](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum) | AA: 4.5:1 normal, 3:1 large (≥18pt/24px, or ≥14pt/18.66px bold). WCAG 2.2 is a W3C Recommendation (published 2023-10-05, revised 2024-12-12). |
| S3 | [W3C — Structural markup and right-to-left text in HTML](https://www.w3.org/International/questions/qa-html-dir) | `dir="rtl"` on `<html>`; **"Never use CSS to apply the base direction"**; `dir="auto"` on form fields and runtime-inserted text. |
| S4 | [W3C — The bidi algorithm and inline markup](https://www.w3.org/International/questions/qa-bidi-unicode-controls) | Use **isolation** (RLI/LRI/PDI, or `<bdi>`/`unicode-bidi: isolate`) rather than embedding; embedding causes number/punctuation spillover. |
| S5 | [Material Design 3 — Bidirectionality & RTL](https://m3.material.io/foundations/layout/bidirectionality-rtl) | **Linear representations of progress/time are mirrored in RTL** (right→left). Exceptions: media playback controls and media timelines, circular time, physical objects. Decides §2.7. |
| S6 | [Android TV — Style / Layouts](https://developer.android.com/design/ui/tv/guides/styles/layouts) | Min body 24sp, headings ≥48sp on TV; **5% overscan safe margin**. tvOS: 60pt top/bottom, 80pt sides. Independent cross-check of §1. |
| S7 | [MDN — `letter-spacing`](https://developer.mozilla.org/en-US/docs/Web/CSS/letter-spacing) | Arabic-script languages "expect connected letters to remain visually connected, and applying letter spacing will lead the text to look broken." |
| S8 | [Okabe & Ito / Wong palette](https://www.audioeye.com/post/colorblind-friendly-palettes/) (Wong, *Nature Methods* 2011) | The 8-colour CVD-safe set used for team colours in §7. |
| S9 | [Fontsource API — Cairo metadata](https://api.fontsource.org/v1/fonts/cairo) | Cairo: OFL-1.1, subsets latin/latin-ext/**arabic**, weights 200–900, **variable available** (wght 200–1000, slnt −11..11), last modified 2025-09-16. |
| S10 | [IBM Plex repo — `IBMPlexSansArabic-Regular.woff2`](https://github.com/IBM/plex/blob/master/packages/plex-sans-arabic/fonts/complete/woff2/IBMPlexSansArabic-Regular.woff2) | Measured file size **70.2 KB** (unsubsetted, one weight). Size anchor in §3. |
| S11 | [W3C — Arabic & Persian Layout Requirements (alreq)](https://www.w3.org/TR/alreq/) | Arabic layout background (line height, digits, justification). |

Anything marked **[ASSUMPTION]** must be measured once against the real build before it is treated as fact.

---

## 1. Legibility from across a room — the arithmetic

### 1.1 The model

Legibility is governed by **angular character height**, not by px. For small angles:

```
θ (arcmin)  =  3438 × h / D          h = character height, D = viewing distance (same units)
```

Per **S1**: θ ≥ 16 arcmin is the floor; 20–22 arcmin is the range a system *should* be able to provide.

**For Arabic we design to the top of ISO's comfortable range (22 arcmin), not the 16 floor.** Justification: Arabic letters are disambiguated by *dots* (ب/ت/ث/ن/ي differ only in dot count and placement) and by tooth counts (س/ش, ر/ز). The discriminating feature is roughly one sixth to one tenth of the letter body, not the letter body itself. Latin at 16 arcmin still separates `b` from `d` by whole-stroke position; Arabic at 16 arcmin puts the *only* difference between "بيت" and "نيت" at the edge of resolution. Targeting 22 arcmin with 16 as a never-cross floor is the correct response and does not require inventing an unpublished safety factor.

**Reinforced by the ruled play model:** the non-answering team **reads the question aloud off the screen**. That means the text must be readable not only by the answering team but by whoever is holding the reading role, wherever they happen to be sitting. There is no "the host reads it, so it only has to be legible to him" escape.

### 1.2 Making it device-independent

Physical px/mm varies by device, DPR and zoom. Rewrite with `H` = screen physical **height**, `k` = text height as a fraction of screen height:

```
θ = 3438 × k × H / D  =  3438 × k / R          where R = D / H  (distance in screen heights)
required k = θ × R / 3438
```

This is why the implementation should use a **fixed 16:9 design canvas of 1920×1080 "stage-px", scaled to fit the viewport**. One `--stage-unit = min(100vw/1920, 100vh/1080)` makes every size in this report exact on every screen, and makes verification screenshots deterministic.

### 1.3 [ASSUMPTION] Arabic letter-body height ≈ 0.50 × font-size

For Cairo / Tajawal / IBM Plex Sans Arabic (large-body Naskh-derived sans), the height of a typical Arabic letter body (ب, ه, ص) is taken as **0.50 em**. All arcmin figures below scale linearly with this number.

**Verification (one-time, mandatory):** render "بخ" at font-size 100 px on a canvas, read `TextMetrics.actualBoundingBoxAscent + actualBoundingBoxDescent` for the letter body, divide by 100. If the measured ratio differs from 0.50 by more than ±8%, rescale §1.5 by `0.50 / measured`.

### 1.4 What each screen can actually serve — the room rule

Solving for maximum viewing distance at font-size `F` (stage-px on a 1080-tall canvas), with `Δ` = screen diagonal (16:9, `H = Δ / 2.0398`):

```
D_max = 0.7803 × Δ × F / θ
```

At the recommended **option size F = 60 stage-px**:

| | Comfortable (θ = 22′) | Floor (θ = 16′) |
|---|---|---|
| **Rule of thumb** | **D ≤ 2.13 × diagonal** | **D ≤ 2.93 × diagonal** |

| Screen | Diagonal | Height H | Comfortable max | Absolute max | Verdict for a majlis |
|---|---|---|---|---|---|
| 13.3″ laptop | 338 mm | 166 mm | **0.72 m** | 0.99 m | **Cannot be the shared screen.** Guests at 2 m see options at **7.9 arcmin** — half the ISO floor |
| 27″ monitor | 686 mm | 336 mm | **1.46 m** | 2.00 m | Only for people at the same table. At 2.5 m: **12.8 arcmin** — fails |
| 43″ TV | 1092 mm | 535 mm | 2.32 m | 3.20 m | Marginal for a small majlis |
| **55″ TV** | 1397 mm | 685 mm | **2.97 m** | 4.09 m | **Practical minimum for a real majlis.** At 3 m = 21.8′ ✓; at 4 m = 16.4′ (floor); at 5 m = 13.1′ ✗ |
| 65″ TV | 1651 mm | 809 mm | 3.51 m | 4.83 m | Covers a 5 m room only at the floor |
| 75″ TV | 1905 mm | 934 mm | 4.05 m | 5.58 m | Comfortable to 4 m, floor to 5.5 m |

**Three findings the planner must carry forward:**

1. **"One person opens the game on one screen in front of a group" is not achievable on a laptop screen alone.** A 13″ laptop serves guests only within ~1 m. The product must assume *laptop → TV/projector*, and say so once, in Arabic, without jargon.
   `AR-COPY` (setup, shown once): **«أفضل تجربة: وصّل الجهاز بشاشة التلفزيون. على شاشة اللابتوب وحدها لن يقرأ الجالسون بعيداً.»**
2. **Seating rule: sit no farther than about twice the screen diagonal.** 55″ → ~2.9 m; 65″ → ~3.5 m.
3. **A global type-scale multiplier is mandatory, not a nicety.** Three steps — ×1.00 / ×1.15 / ×1.30 — turn a 55″ at 4 m from 16.4′ (floor) into 21.3′ (comfortable). Every layout must be verified at ×1.30, not only ×1.00.
   `AR-COPY` (settings): **«حجم الخط: عادي · كبير · أكبر»**

### 1.5 The type scale — use this table directly

Canvas **1920 × 1080 stage-px**. All sizes are stage-px × the global scale step. Arcmin columns for a **55″ TV** (θ = 0.3634 × F at 3 m; 0.2726 × F at 4 m).

| Role | Size | Weight | line-height | Tracking | θ @3 m | θ @4 m | Notes |
|---|---|---|---|---|---|---|---|
| Question text | **76** | 700 | **1.6** | 0 | 27.6′ ✓ | 20.7′ ✓ | Auto-shrinks to floor 56 before wrapping to a 3rd line |
| Question floor | 56 | 700 | 1.6 | 0 | 20.4′ ✓ | 15.3′ ~ | Never below — editor warns instead |
| Option text | **60** | 600 | **1.5** | 0 | 21.8′ ✓ | 16.4′ ~ | |
| Option floor | 44 | 600 | 1.5 | 0 | 16.0′ = | 12.0′ ✗ | Exactly the ISO floor at 3 m. Below this the editor refuses, not the renderer |
| Option letter (أ/ب/ج/د) | 48 | 700 | 1.0 | 0 | 17.4′ ✓ | — | Tabular, fixed-width chip |
| Turn banner | 56 | 700 | 1.4 | 0 | 20.4′ ✓ | 15.3′ ~ | |
| Team name | 44 | 600 | 1.4 | 0 | 16.0′ = | 12.0′ ✗ | At the floor; acceptable only because the room learns it once and colour+position reinforce it |
| Score / step number | 72 | 700 | 1.2 | 0 | 26.2′ ✓ | 19.6′ ✓ | `tabular-nums` — a score going 9→10 must not shift layout |
| Operator button label | 44 | 700 | 1.4 | 0 | 16.0′ = | 12.0′ ✗ | Icon + word, never word alone |
| Result word (صحيح/خطأ) | 96 | 700 | 1.2 | 0 | 34.9′ ✓ | 26.2′ ✓ | The one moment the whole room reads at once |
| Winner headline | 120 | 700 | 1.3 | 0 | 43.6′ ✓ | 32.7′ ✓ | |

**Tracking is 0 everywhere and is not negotiable — §2.4.**

### 1.6 Independent cross-check (S6)

Android TV specifies min body **24sp** and headings **≥48sp** on a 960×540 dp layout — i.e. **48 px and 96 px** on a 1080p screen at the standard ~3 m distance.

| | Android TV (S6) | This report (ISO derivation, 55″ @3 m) |
|---|---|---|
| Body / option floor | 48 px | 44 px (16.0′); 60 px recommended (21.8′) |
| Heading | 96 px | 76 px question, 96 px result, 120 px winner |

Two independent sources agree within ~10%. The ISO-derived scale is slightly more generous on options and less on headings — the correct trade for Arabic (dots matter more than headline drama).

### 1.7 Spacing and safe area

| Item | Value | Basis |
|---|---|---|
| Overscan safe area | **5% inset** = 96 px sides, 54 px top/bottom → usable **1728 × 972** | S6 |
| Min gap between tappable option cards | 32 px | Prevents mis-tap on a touchpad under social pressure |
| Option card min height | 120 px (1 line) / 200 px (2 lines) | 60 × 1.5 + 2 × 32 padding |
| Grid gutter | 48 px | |
| Text never inside | outer 5% band | Background may bleed to the edge; text may not |

### 1.8 Character budgets (drive the editor's live counters)

**[ASSUMPTION]** average Arabic advance width ≈ **0.50 em**. Measure once with `TextMetrics.width` on a 200-character Arabic sample and correct.

| Field | Box width | Advance @size | Chars/line | Comfortable | Hard cap |
|---|---|---|---|---|---|
| Question | 1600 px | 38 px @76 | 42 | **84 chars** (2 lines @76) | **150 chars** (3 lines @64) |
| Option, 2×2 | 776 px | 30 px @60 | 25 | **25 chars** (1 line) | **50 chars** (2 lines) |
| Option, stacked 1×4 | 1664 px | 30 px @60 | 55 | 55 chars | 110 chars |
| Team name | — | — | — | **12 chars** | 18 chars |

---

## 2. Arabic RTL correctness — the failure list

### 2.1 Document-level direction

| Rule | Why |
|---|---|
| `<html lang="ar" dir="rtl">` — in markup, on the root element | S3. `lang` drives font selection and speech; `dir` drives the bidi algorithm |
| **Never** set base direction from CSS as the source of truth | S3, verbatim: "Never use CSS to apply the base direction." If the stylesheet fails to load, the page silently becomes LTR |
| `dir` below `<html>` only where direction genuinely changes | Not as decoration |
| Editor text inputs: `dir="auto"` | S3 — lets the author type an English question or Latin proper noun and see it correctly |

### 2.2 Logical vs physical CSS — the ban list

| Banned in this codebase | Use instead |
|---|---|
| `margin-left` / `margin-right` | `margin-inline-start` / `margin-inline-end` |
| `padding-left` / `padding-right` | `padding-inline-start` / `padding-inline-end` |
| `left:` / `right:` | `inset-inline-start` / `inset-inline-end` |
| `text-align: left` / `right` | `text-align: start` / `end` |
| `border-left` / `border-right` | `border-inline-start` / `border-inline-end` |
| `border-radius: 8px 0 0 8px` | `border-start-start-radius` etc. |
| `float: left` / `right` | `float: inline-start` / `inline-end` |
| `background-position: left` | logical positioning of a pseudo-element, or a mirrored asset |
| `transform: translateX(+n)` for directional motion | §2.3 |

**Grep rule for the reviewer:** any of `margin-left`, `margin-right`, `padding-left`, `padding-right`, `border-left`, `border-right`, `text-align:\s*(left|right)`, `\bleft:\s`, `\bright:\s` in stage CSS is a defect unless it carries a comment naming the S5 exception it invokes.

**Legitimate exceptions (S5):** audio playback controls, the audio scrubber/timeline, clock/circular progress, icons of physical objects. These stay LTR.

### 2.3 What mirrors automatically and what does not

| Mechanism | Mirrors under `dir="rtl"`? |
|---|---|
| Flexbox `row` | **Yes** |
| CSS Grid columns | **Yes** — column 1 is the right-most |
| Logical inset (`inset-inline-start`) | **Yes** |
| Absolute positioning with `left`/`right` | **No** — the #1 RTL bug source |
| `transform: translateX()` | **No** — transforms are physical, always |
| Canvas / SVG coordinates | **No** — mirror explicitly, at exactly one place |
| `width: N%` progress fills | Follows the container's inline direction; verify, do not assume |

**Consequence for the maze token:** if DOM-based, position with `inset-inline-start: <progress>%` and it mirrors for free. If SVG/canvas, define a single `toStageX(progress)` conversion and mirror there once — never sprinkle sign flips.

### 2.4 Shaping and ligatures — what breaks Arabic letterforms

| Do not | Effect |
|---|---|
| `letter-spacing` on Arabic (any value ≠ 0) | S7: connected letters visually separate; text looks broken. **Zero tracking everywhere.** |
| `text-align: justify` on stage text | Browsers stretch inter-word space; no reliable kashida justification. Rivers and gaps at stage size. Use `start` |
| `text-transform: uppercase` | No-op on Arabic, but mangles embedded Latin |
| Splitting a word across inline elements (a `<span>` per letter for animation) | Breaks the cursive join at every element boundary in some engines |
| `line-height: normal` (≈1.2) or a fixed pixel height | Clips ascenders (ا أ إ ل ك ط), descenders (ج ح خ ع غ م ن ي ق س ش ر ز و), and any tashkīl |
| `overflow: hidden` on a box sized for Latin metrics | Same clipping, silently |
| `-webkit-line-clamp` on the stage | Cuts mid-diacritic, hides content the room needs |
| `text-overflow: ellipsis` **anywhere on the stage** | An ellipsised question on a shared screen is a product failure, not a graceful fallback. Shrink to the floor, then wrap; if it still does not fit, the **editor** should have prevented it |

**Line-height minimums:** 1.5 for display/headline roles, **1.7–1.8 for anything running to 3+ lines** (S11: Arabic needs more leading than Latin for diacritics and deep descenders). §1.5 uses 1.5–1.6 because those roles are 1–2 lines of large text with generous padding.

### 2.5 Bidi — numbers, Latin, punctuation

The classic scrambling ("the parentheses jump", "the score reads backwards") has one root cause: **a directionally-mixed string built by concatenation, rendered without isolation.**

| Rule | Detail |
|---|---|
| **Never build a mixed string** | `"${teamA} ${scoreA} - ${scoreB} ${teamB}"` is a defect. Each name and each score is its own element |
| **Isolate every foreign run** | Latin words or number runs inside Arabic → `<bdi>` (or `unicode-bidi: isolate`). S4: isolation, not embedding |
| **Isolate user-supplied text always** | Team names and question text are typed by the author; he may type Latin. `<bdi>` is a no-op when content matches the base direction, so wrap unconditionally |
| **Never store Unicode control characters** | Store plain text; isolate at render. Control characters survive export/import and corrupt the pack |
| Audio position/duration | `0:07 / 0:24` is a media timeline → LTR, isolated (S5 exception) |
| Tabular numerals | `font-variant-numeric: tabular-nums` on scores and timers |

### 2.6 Digits — Western vs Arabic-Indic

**Recommendation: Western digits (0 1 2 3 …) on the stage.**

1. **Legibility at distance, which is this product's whole problem.** In Arabic-Indic, **٥ (five) is a small ring and ٠ (zero) is a dot**. At 3 m on a TV with sharpening, a score of ٥ and a score of ٠ are the same shape at different sizes, and ٠ can vanish against texture. ٦/٧ and ٢/٣ are rotation pairs. Western digits carry more distinct silhouettes at 26 arcmin.
2. **Recognition breadth.** Saudi road signage has standardised on Western numerals and modern Arabic digital interfaces use them routinely. Nobody in a Saudi majlis fails to read `7`.
3. **Tooling.** `tabular-nums` and numeric font features are reliably implemented for Western digits; Arabic-Indic tabular figures are inconsistently available in webfonts.

**Counter-argument, honestly stated:** Arabic-Indic digits *feel* more Arabic and older guests may prefer them. That is identity, not correctness — so it is a user choice (§9).

**Implementation constraint either way:** digits come from **one formatting function**, never from literals scattered through markup, so flipping is one line. Flipping also changes measured widths → re-measure §1.8.

### 2.7 Maze direction — the design question, answered

**Recommendation: the maze starts at the RIGHT edge and advances LEFTWARD. Confidence: high (~85%).**

For:
- **S5, Material Design 3, verbatim:** "linear progress indicators move from right to left for most RTL languages." A team's track *is* a linear progress representation. The named exceptions (media playback controls and timelines, circular time, physical objects) do not cover a game board.
- An Arabic reader's gaze enters at the right. Start-where-reading-starts maps "beginning → end" onto "right → left" with no learning cost.
- Every other mirrored element (turn banner, option order, team strip) already reads right-to-left. An LTR maze on an RTL stage is the one element pointing the wrong way, and inconsistency confuses more than either convention alone.

Against, and it is real:
- Physical board games sold across the Arab world (Snakes & Ladders, Monopoly) are LTR reproductions, and many localised Arabic mobile games keep LTR progress maps. Arab players have genuinely seen LTR boards.
- But those are artifacts of localisation economics — nobody redrew the board — not evidence about Arabic reading.

**The robust answer that makes the question mostly moot:** make the **goal explicit and visual**. A winding path with a large, unmistakable finish marker (flag, gate, trophy) answers "which way is forward?" from the graphic, not from convention. Once drawn, direction becomes a style preference that is cheap to flip — *provided* the implementation routes it through a single `toStageX(progress)` mirror point (§2.3).

`AR-COPY`: **«النهاية»** / **«البداية»**

**Third option worth offering:** a **vertical maze, bottom → top ("climb")**. Sidesteps RTL entirely and reads as progress in every culture. Cost: height, the scarcest resource on a 16:9 stage — affordable only because the maze occupies its own beat (§6.4). In the deck (§9).

---

## 3. Arabic web fonts

### 3.1 Candidates assessed for *stage* sizes (44–120 px), not body text

| Font | Licence | Weights | Variable? | Stage assessment |
|---|---|---|---|---|
| **Cairo** (S9) | OFL-1.1 | 200–900 | Yes (wght 200–1000, slnt) | Modern Arabic sans, large letter bodies, open counters. Reads well at 60–90 px — our entire range. Weakness: relatively small dots, shallow teeth (س/ش); thin weights are destroyed by TV sharpening. **Already in the reference assets → zero acquisition cost, zero licence question** |
| **IBM Plex Sans Arabic** (S10) | OFL-1.1 | 100–700 | Static family (variable upstream) | Drawn explicitly for UI legibility: larger dots, more open apertures, stronger dot-family differentiation. Best dot separation of the set. **70.2 KB per weight unsubsetted.** The only serious challenger |
| Noto Sans Arabic | OFL-1.1 | 100–900 + width | Yes | Excellent shaping, broadest coverage — which is why it is heavy. Best as the *named fallback*, not primary |
| Tajawal | OFL-1.1 | 200–900 | No | Geometric, slightly tighter apertures. No advantage over Cairo here |
| Readex Pro | OFL-1.1 | variable | Yes | Designed for readability including low-literacy readers. Strong dark horse; less battle-tested on TVs |
| Almarai | OFL-1.1 | 300/400/700/800 | No | Clean, popular in the Gulf. Acceptable |
| **Noto Kufi Arabic** | OFL-1.1 | — | — | **Rejected for questions and options.** Kufi geometricises and flattens letterforms; dot and tooth discrimination drops exactly where we need it. Title/logo only |

### 3.2 Recommendation

**Use Cairo for v1, at weights 600 and 700 only for stage text.**

1. Already shipped at `C:\Users\Az202\Desktop\projects\تعليمات ومهارات للمشروع\أصول\fonts\cairo-arabic.woff2` — no acquisition, no licence review, no new dependency.
2. Two weights cover the whole §1.5 scale.
3. Reads well across 44–120 px, our entire operating range.
4. IBM Plex Sans Arabic buys marginal dot separation for a new dependency and ~70 KB/weight.

**Two conditions:**

- **Never use Cairo below weight 600 for question or option text.** Thin strokes are the first casualty of TV sharpening/overshoot and of glare. Weight 400 is for secondary labels only.
- **Provisional until one measured A/B is run** (check V7, §8): render four Arabic options with confusable letters at 60 stage-px in Cairo 700 and IBM Plex Sans Arabic 700, capture at 1920×1080, compare dot separation in pixels. If Cairo's dot gap at 60 px is under ~4 px, switch to Plex. A 20-minute check that prevents a font swap after the scale is tuned.

**Unknown to resolve first:** the shipped `cairo-arabic.woff2` — static or variable, which weight(s), which subset? I could not measure it (no shell access in this investigation). If it is a static 400-only Arabic subset, a 700 file is still needed, or the variable file must be used.

### 3.3 Self-host — not negotiable

**Self-host. No font CDN.**

| Risk of CDN | Consequence here |
|---|---|
| The majlis may have no internet, or bad internet | The stage falls back to a system font **mid-party** — different metrics, so §1.8 budgets break and text starts clipping or shrinking at the worst moment |
| The site is a static bundle the user publishes himself | A CDN adds an external dependency to a product whose point is "open the link and it works" |
| Latency / blocked domains | Same failure, no diagnosis available to a non-technical operator |

| Setting | Value | Reason |
|---|---|---|
| Format | woff2 only | Universally supported, smallest |
| `font-display` | **`block`** | The file is local, so the block period costs nothing. `swap` causes a visible metric jump on the shared screen — worse than a 100 ms delay |
| Preload | `<link rel="preload" as="font" type="font/woff2" crossorigin>` | Removes the CSS→font request chain |
| Subset | Arabic block + Arabic Supplement + Western digits + basic Latin punctuation | Drop maths alphanumerics, Latin-ext, Arabic Presentation Forms unless needed |
| Budget | **≤ 120 KB total for all font files** | ~45–60 KB per subsetted static weight × 2, or one subsetted variable file. **Must be measured and recorded** — hand final numbers to `static-delivery-expert` |

### 3.4 Fallback stack

```
"Cairo", "SF Arabic", "Segoe UI", "Noto Naskh Arabic", "Noto Sans Arabic", Tahoma, "Geeza Pro", sans-serif
```

Covers iOS/macOS (SF Arabic, Geeza Pro), Windows (Segoe UI, Tahoma), Android (Noto Naskh Arabic). **Every fallback has different metrics**, therefore:
- auto-fit/shrink logic runs **after `await document.fonts.ready`**, never on first paint;
- the verification suite includes one capture with the webfont deliberately blocked (check V8, §8).

---

## 4. The operator's flow

### 4.1 Governing principles

1. One person, in front of an audience, under social pressure. **Fewer, larger, unmistakable controls.**
2. **The stage never shows a control that would be a disaster to mis-tap, and the operator never needs a control that is not visible.**
3. Every failure degrades into a **calm Arabic sentence**, never a technical string.
4. There is no private screen. Any design requiring one is wrong for this product.
5. **The non-answering team reads the question aloud off the screen.** Everything on the question screen is public by design — which makes §4.9 (no tell on the correct option) a hard correctness requirement, not a nicety.

### 4.2 The two-tap question — the core proposal

The teams alternate, so the answering team is fixed by turn order (owned by `game-systems-expert`). The reading team reads the question aloud. The operator therefore never has to tell the app *who* answered, and never has to read anything himself:

| Tap | What the operator does | What happens |
|---|---|---|
| **1** | Taps **the option the answering team said out loud** | Reveals right/wrong, records the outcome, moves the token — one action, one meaning |
| **2** | Taps **«السؤال التالي»** | Turn card for the next team, next question |

**Two taps per question on the common path.** Compare the naive design — show question → reveal answer → mark correct/wrong → next — which is four taps and contains the classic error ("did I press correct for the right team?").

Why tapping the said-option beats a correct/wrong pair:
- The mental model is the most natural possible: *press what they said*.
- It removes any need for the operator to know the correct answer in advance (§4.4).
- Reveal and record are the same event, so they can never disagree.
- The drama survives: the tap starts a hold (~1.2–1.8 s) showing the chosen option, *then* the verdict, *then* the token move.
- The operator's hands and eyes are free during the reading — he is not competing with the reading team for attention.

### 4.3 The full control surface during a question

Nothing else exists on the stage:

| Control | Placement | Size | Note |
|---|---|---|---|
| Four option cards | Main area | ≥ 776 × 120 px, 32 px apart | **Visually identical to one another before reveal** — §4.9 |
| **«لم يجيبوا»** | Operator bar, inline-end | ≥ 320 × 96 px | Records a miss, reveals the answer. Timeouts and silence are normal |
| **«تراجُع»** | Operator bar, **always the same corner, every screen** | ≥ 240 × 96 px | Visually quieter (outline, not filled) but never hidden |
| Volume (audio questions) | Operator bar | ≥ 240 × 96 px | |
| **«أعِد التشغيل»** (audio questions) | Operator bar | ≥ 320 × 96 px | Guests will ask. Not optional |

Not present during a question: settings, editor, menu, close, native media controls, browser chrome.

### 4.4 Does the host ever need to see the answer while the room does not?

**On one shared screen there is no private channel — and now the reading team is looking straight at the screen too. So: he does not need to know, and nothing on screen may hint.**

| Option | Verdict |
|---|---|
| Hold-to-peek on the stage | **Rejected.** The room sees it, and the reading team is the closest pair of eyes to the screen |
| A second device (phone as remote) | **Rejected for v1.** Needs pairing → a server or WebRTC. Contradicts static hosting |
| Small "host-only" corner text | **Rejected.** No size is readable to him and unreadable to the room |
| **The 2-tap flow removes the need** | **Adopted.** The reading team reads; the answering team answers; he presses what they said |
| A printable answer sheet | **Available but now discouraged.** Under the new play model a printed sheet sits in the room with the reading team nearby. If offered, the copy must warn: `AR-COPY` **«لا تترك الورقة قرب الفريق الذي يقرأ.»** |

### 4.5 Undo — one action, no confirmation

| Property | Decision | Reason |
|---|---|---|
| Label | `AR-COPY` **«تراجُع»** | |
| Depth | **One level**, always | A deep stack invites a panicked operator to rewind the game. One level covers the real case: the last tap was wrong |
| Confirmation | **None** | A modal in front of guests is worse than the mistake. Undo *is* the confirmation mechanism |
| Double-tap guard | Becomes `AR-COPY` **«إعادة»** (redo) for 5 s after use, then returns to «تراجُع» | Prevents "tapped twice, rewound too far" without a dialog |
| Availability | Every screen, same corner | Predictability under pressure beats contextual placement |
| Deeper rewind | Guarded route only: `AR-COPY` **«الرجوع إلى سؤال سابق»** in the pause menu, with a confirm | Rare, deliberate, off the hot path |

**One undo subtlety created by the new play model:** undoing a reveal puts the correct answer back into hiding — but the room has already seen it. Undo must therefore **re-present the question in its pre-reveal visual state and advance to the next question**, never pretend the question is unseen. `AR-COPY` on the undo confirmation strip: **«أُلغيت النتيجة. تابعوا بالسؤال التالي.»**

### 4.6 Not exposing a "developer-looking" UI mid-party

| Leak | Fix |
|---|---|
| Browser chrome, URL bar, bookmarks, tab strip | Offer **fullscreen** on the first tap of the session (Fullscreen API needs a user gesture). `AR-COPY` **«اعرض بملء الشاشة»** — offered again once at the turn card if declined. **Now more important:** on the night he opens a link, so the URL bar is on screen at the moment guests are watching |
| Native `<audio>` controls | Custom controls only. Native controls are tiny at 3 m and read as "unfinished software" |
| Right-click context menu on the stage | Suppress on stage surfaces |
| Accidental refresh killing the session | `beforeunload` guard while a session is live; session state persisted so a refresh resumes (owner: `game-systems-expert`). Since content is now published with the site, a refresh does **not** lose the questions |
| A visible route to the editor during play | **There is none.** Exiting requires `AR-COPY` **«إنهاء الجلسة»** + confirm |
| Console errors / stack traces / English text | §4.7 |

### 4.7 Failure paths — every one ends in a calm Arabic sentence

| Failure | What the room sees (`AR-COPY`) | Next action |
|---|---|---|
| An image will not load | **«تعذّر عرض الصورة لهذا السؤال. تابعوا بالسؤال نصّياً.»** | One button: **«تابع»** |
| An audio clip will not load or decode | **«تعذّر تشغيل المقطع. تابعوا بالسؤال نصّياً.»** | One button: **«تابع»** |
| Autoplay blocked by the browser | **«اضغط لتشغيل المقطع»** on a large play target | One tap; the tap is the required user gesture |
| The published game has no questions | **«لا توجد أسئلة في هذه النسخة من اللعبة.»** | **«افتح ملف لعبة»** (the backup route, §5A.5) |
| Any unexpected error | **«حدث خلل بسيط. تم حفظ تقدّم اللعبة — اضغط للمتابعة.»** | Technical detail goes to a hidden copyable log, **never to the stage** |

### 4.8 Tap-cost of rules variations — for `scope-advisor`

| Variation | Extra taps/question | Note |
|---|---|---|
| Strict alternation, no steal | **0** | The 2-tap baseline |
| "Steal" if the other team answers | **+1** (`AR-COPY` «الفريق الآخر أجاب») | Also adds a control to the hot path — that is the real cost, not the tap |
| A timer per question | 0 taps, +1 control (pause), +1 failure state | |
| Bonus/penalty maze squares | 0 if automatic; +1 if the operator must choose | |

I state the UX cost; the rules belong to `game-systems-expert` and the decision to the user.

### 4.9 No tell — the correct option must be indistinguishable before reveal

The reading team is looking directly at the screen while reading the four options aloud. **Any difference between the correct card and the other three, however small, is a leak that ruins the question.** This is a correctness requirement with a numeric test (check V20, §8).

| Leak | Rule |
|---|---|
| Different border, fill, shadow, opacity, weight or size on the correct card | **Forbidden.** All four cards share one class and one computed style before reveal — pixel-identical apart from their text |
| Different DOM ordering (correct always rendered first) | Forbidden — it shows up in tab order and in any keyboard focus ring |
| `aria-label`, `title`, `data-correct`, class names or attributes that a hover tooltip or an accessibility overlay could surface | The correctness flag must **not exist on the option element at all** before reveal. Keep it in the session state object, not in the DOM |
| Height differences caused by text length (the author's correct answer is often the longest) | **All four cards share the same height** — the tallest of the four sets the row height. This also removes the classic "the long one is the right one" heuristic |
| **The author's own ordering habit** | The single biggest real-world leak. An author who types the correct answer first will produce a game where أ is right most of the time — and the room notices by round four |

**Ordering recommendation (needs a rule owner sign-off from `game-systems-expert`):**

- **Do not** re-shuffle on every render — the reading team reads "أ … ب … ج … د" and the labels must not move while they read.
- **Do** shuffle **once per question per session**, deterministically from a session seed, and fix the order for the whole life of that question on screen (including after undo).
- **Show the author what the room will see:** the editor's «معاينة كما يراها الجميع» renders a shuffled order, and the question list shows a small note that on-screen order differs from typing order. `AR-COPY` **«ترتيب الخيارات على الشاشة يختلف عن ترتيب كتابتها.»**
- If the user prefers his typed order preserved exactly, that is his call — it is Choice 3 in the deck (§9), stated with its cost.

---

## 5. The authoring editor for a non-technical person

**Re-aimed to the ruled model:** authoring is a **calm, unhurried, sit-down activity done days before the event**, likely across several sittings. The thing that must never happen is **losing that work between sessions**. Nothing here happens under time pressure with guests in the room.

### 5.1 The happy path — add one question with an image

Target: **six interactions**, no dialogs, no jargon.

```
«أسئلتي»  →  «+ سؤال جديد»
  1. يكتب نص السؤال                        (kept immediately, live length counter)
  2. «أضف صورة» أو «أضف صوتاً» → يختار الملف   (immediate inline preview + determinate progress)
  3. يكتب الخيار الأول … الرابع               (kept per field)
  4. يضغط علامة الصح على الخيار الصحيح         (row turns green + ✓ + «الإجابة الصحيحة»)
  5. «معاينة كما يراها الجميع»                (the real stage renderer, shuffled order — §4.9)
  6. «تم»                                    (card shows «جاهز ✓» in the list)
```

**Media types are text, image and audio only.** There is no video path anywhere in the editor — no "add video" control, no video in the accepted-types copy, no video size warnings.

### 5.2 The traps and the guardrails

| Trap | Guardrail | `AR-COPY` |
|---|---|---|
| A large audio file import looks frozen | **Determinate progress with MB and a cancel button.** A bare spinner is forbidden | **«جارٍ إضافة المقطع — ٣ من ٨ ميجابايت»** · **«إلغاء»** |
| Unsupported file type | `accept` on the picker + a rejection message naming what *is* accepted, with no MIME types or error codes | **«هذا الملف غير مدعوم. الأنواع المقبولة: صور JPG وPNG · صوت MP3 وM4A.»** |
| File too large | Warn at import with size in MB and the practical consequence, not a quota number (threshold owned by `media-storage-expert`) | **«هذا المقطع كبير (٢٠ ميجابايت). سيبطئ فتح اللعبة على الأجهزة البطيئة.»** |
| Forgot to mark the correct option | The card cannot reach «جاهز» without one. The list shows an unmissable badge; publishing is blocked with a message that **names the question** | **«السؤال ٣ بلا إجابة صحيحة»** |
| Ambiguous correct-answer marker | **Three redundant signals:** a radio control, the whole row turning green with a ✓, and the words | **«الإجابة الصحيحة»** |
| "The image was sideways / the text was too long" discovered live | **«معاينة كما يراها الجميع»** renders the *actual stage component* with this content at the real type scale, in the real on-screen option order. Highest-value single guardrail in the editor | **«معاينة كما يراها الجميع»** |
| Text too long for the stage | Live counter from §1.8; amber past comfortable, red past the cap; message states the *consequence*, not the rule | **«النص طويل — سيصغر خطّه على الشاشة»** / **«طويل جداً — اختصره قليلاً»** |
| No idea how many questions is "enough" | A live readiness meter. The threshold comes from `game-systems-expert` (steps to win × 2 teams) — **cross-expert dependency, do not invent the number** | **«لديك ٦ أسئلة — تكفي لجولة قصيرة. المتاهة تحتاج ١٢ سؤالاً على الأقل لتُكمل حتى الفوز.»** |
| Always typing the correct answer first | The list shows the distribution once there are ≥8 questions, and the preview shows the shuffled order (§4.9) | **«ترتيب الخيارات على الشاشة يختلف عن ترتيب كتابتها.»** |
| Drag-and-drop reordering on a touchpad | **Up/down buttons on each card are the primary mechanism**; drag is an optional extra, never the only way | **«▲ أعلى» / «▼ أسفل»** |
| Accidental delete | No modal. The card collapses to an undo strip for ~8 s, then commits | **«حُذف السؤال»** · **«تراجُع»** |
| **Coming back tomorrow and finding the work gone** | **§5A — the whole section** | |

### 5.3 What the editor must never do

- Never show a modal that can strand the author with unsaved text behind it.
- Never show a file path, a MIME type, an error code, a byte count with no unit, or an English word.
- Never require drag-and-drop as the only way to do anything.
- Never lose focus/scroll position after an action.
- Never mention video.
- **Never claim work is "safe" on a basis that can silently vanish** (§5A.2).

### 5.4 Where the editor lives — recommendation and defence

**Same app, its own screen, reached only from the home screen. Not a mode toggle.**

```
        ┌────────────────────────────────────────┐
        │              لعبة نوف                   │
        │                                        │
        │   ┌────────────────────────────────┐   │
        │   │        ابدأ اللعبة              │   │  ← ليلة المسابقة: ضغطة واحدة
        │   └────────────────────────────────┘   │
        │   ┌────────────────────────────────┐   │
        │   │           أسئلتي                │   │  ← اكتب وجهّز قبل الموعد
        │   └────────────────────────────────┘   │
        │   ┌────────────────────────────────┐   │
        │   │   نسخة احتياطية: احفظ / استورد   │   │  ← نقل بين الأجهزة ونسخة أمان
        │   └────────────────────────────────┘   │
        └────────────────────────────────────────┘
```

| Alternative | Why rejected |
|---|---|
| Separate page / separate HTML file | No access advantage, doubles the delivery surface for `static-delivery-expert`, and — decisively — breaks WYSIWYG: the preview would need a duplicated stage renderer, which will drift and will lie to the author |
| A mode toggle visible during play | Puts the editor one mis-tap from the stage — the "developer UI mid-party" failure |
| Editor behind a hidden gesture | Non-technical author. A hidden gesture is a feature he cannot find and a bug he triggers by accident |

**Why same-app matters most:** the preview must be the *same component* the stage uses. That is what catches long text, portrait images, bad contrast **and the option-order leak (§4.9)** at authoring time instead of in front of guests.

---

## 5A. Keeping the work between sessions, and getting it onto the screen

### 5A.1 Two moments, and what each one must cost

| Moment | When | Who | Must be effortless | Must be impossible |
|---|---|---|---|---|
| **Authoring** | days before, across several sittings | the game's author | resuming exactly where he left off | opening the editor tomorrow and finding yesterday's work gone |
| **Play night** | live, in front of guests | the host (same person) | **opening the link and pressing «ابدأ اللعبة» — zero file steps** | any file browser, any upload, any URL typing while people watch |

The published site now carries its content, so **play night has no file interaction at all**. Everything below is about protecting the authoring work.

### 5A.2 The vocabulary rule — the cheapest guardrail in the product

The browser's own storage is the author's working copy across sittings. It is convenient and it is **not durable**: clearing site data, a private window, a browser update, a different computer, or a storage eviction all erase it silently. The interface must therefore never imply permanence it cannot deliver.

| Concept | `AR-COPY` | Never say |
|---|---|---|
| Written to his own computer as a file | **«محفوظ على جهازك»** | — |
| Held in the browser between sittings | **«نسخة العمل — على هذا المتصفح فقط»** | ~~«محفوظ»~~ alone, ~~«آمن»~~ |
| Published with the game | **«منشور مع اللعبة»** | — |

**One sentence, once, on first entering the editor** (`AR-COPY`): **«عملك يبقى في هذا المتصفح بين الجلسات. لنقله إلى جهاز آخر — أو لأمان أكيد — احفظ نسخة على جهازك.»**

### 5A.3 When the save-a-backup prompt appears

Authoring is unhurried, so prompts should be **rare, non-blocking, and tied to real milestones** — not a timer that nags a man thinking about a question.

| # | Trigger | Form | Why here |
|---|---|---|---|
| **T0** | First entry to «أسئلتي», before the first keystroke | One line under the title; disappears when he starts typing | Sets the model once, when it costs nothing (§5A.2) |
| **T1** | **End of a sitting** — leaving the editor for the home screen, or ~20 min of inactivity with unsaved changes | Non-blocking bar with one primary button | The natural moment: he is stopping for today. `AR-COPY` **«قبل ما تسكّر: احفظ نسخة على جهازك حتى ما تضيع أسئلتك.»** + **«احفظ نسخة»** |
| **T2** | Every **10 completed questions** since the last backup | Same bar, quieter | Milestone-based, not clock-based. Respects a long thinking session |
| **T3** | Before **publishing** (§5A.4) | Part of the publish flow, not a separate nag | He is exporting anyway at that point |
| **T4** | Closing the tab with unsaved changes | `beforeunload` — **last resort only**, see §5A.5 | |

### 5A.4 Publishing — the hand-off, and the UX requirements I own

The author finishes, then his game has to become the thing at the link. The mechanics belong to `static-delivery-expert` and `media-storage-expert`; **the UX requirements are mine and they are strict:**

| Requirement | Detail |
|---|---|
| **One button, one file** | «جهّز اللعبة للنشر» produces **exactly one file** to place in the site folder. Two files, or "put this here and that there", is where a non-technical author fails |
| **A numbered recipe on screen, in Arabic, in the app** | Not in a README he will not read. Three steps maximum, each one sentence, each with the exact thing to click. Written jointly with `static-delivery-expert` |
| **A verification step he can perform himself** | After publishing, open the link and the home screen must show his game's title and question count. `AR-COPY` **«افتح الرابط: إذا ظهر اسم لعبتك وعدد الأسئلة، فالنشر تمّ.»** That single check replaces every technical diagnosis |
| **Publishing never silently succeeds with old content** | The home screen shows the published game's title, question count and the date it was prepared, so a stale bundle is visible at a glance. `AR-COPY` **«جُهّزت في ٧ أغسطس ٢٠٢٦ · ١٤ سؤالاً»** |
| **Never show him a path, a branch, a cache header or a base URL** | If a diagnosis is needed it goes into a copyable block behind «تفاصيل تقنية», never on the main flow |

### 5A.5 The backup file — mechanics and filename

**Two save paths; prefer the first, always ship the second.**

| Path | Availability | Behaviour | UX consequence |
|---|---|---|---|
| **File System Access API** (`showSaveFilePicker`) | Chromium desktop | Real "Save As"; the handle lets **later backups overwrite the same file in one silent tap** | After the first backup, «احفظ نسخة» is one tap, no dialog, no clutter |
| **Blob download** (`<a download>`) | Everywhere | Every backup writes a **new** file into Downloads | Mitigated by the timestamped filename below |

Feature-detect; wording is identical except that the download path adds `AR-COPY` **«ستجد الملف في مجلد التنزيلات — الأحدث تاريخاً هو الأخير.»**

**Filename — must match `^[a-z0-9._-]+$`:**

```
nouf-pack-2026-08-07-2140.noufpack
```

| Decision | Reason |
|---|---|
| All lowercase, digits, hyphens, one dot | Matches the required regex; survives case-sensitive hosts and Linux/macOS/Windows alike |
| `nouf-pack-` prefix | Recognisable in a Downloads folder full of unrelated files |
| **ISO-ordered date-time `YYYY-MM-DD-HHMM`** | With the download fallback every backup makes a new file. ISO ordering means **lexical sort = chronological sort**, so "the last one in the list is the newest" is true in every file manager |
| **The Arabic game title is NOT in the filename** | Arabic is banned from filenames, and transliterating is a guess that produces wrong, ugly ASCII. **The Arabic title lives inside the file** and is shown by the app the moment the file is imported |
| Extension | **`.noufpack`** if packs are only opened through the app's own picker. **`.zip` is safer if he will send a pack to another person** — unknown extensions are commonly blocked by mail and messaging apps. **Cross-expert call:** format → `media-storage-expert`, sharing → `durability-advisor` |

**Importing a backup** («استورد») is a secondary, unhurried action — used to move to a new computer or to recover. It shows the file's Arabic title, question count and prepared-date before replacing anything, and it never silently overwrites: `AR-COPY` **«هذا الملف فيه «أسئلة العائلة» — ١٤ سؤالاً، جُهّز في ٧ أغسطس. استبدال ما في المتصفح الآن؟»** + **«استبدل»** / **«إلغاء»**.

### 5A.6 Unsaved / un-backed-up state — how it is marked

One chip, one place, always present in the editor header, ≥44 stage-px:

| State | Icon | `AR-COPY` | Attached action |
|---|---|---|---|
| No backup ever taken | filled dot | **«ما أخذت نسخة على جهازك بعد»** | **«احفظ نسخة»** — attached, so the fix is one tap from the warning |
| Backed up, unchanged since | check | **«آخر نسخة: nouf-pack-2026-08-07-2140 · أمس»** | **«احفظ نسخة جديدة»** |
| Backed up, changed since | filled dot | **«١٢ تغييراً بعد آخر نسخة»** | **«احفظ نسخة»** |

- Showing the **actual filename** in the backed-up state is deliberate: it teaches a non-technical author what to look for on his disk later. A generic "saved ✓" teaches nothing.
- **Colour is never the only signal** (§7.3): icon *and* words.
- Tab title mirrors it: `● لعبة نوف — أسئلتي` when there are un-backed-up changes. The tab title is a display string, not a filename, so Arabic is correct there.

**Measured contrast for the warning state:**

| Surface | Warning colour | Contrast | Verdict |
|---|---|---|---|
| Dark editor `#0E1116` | `#E69F00` | **8.40 : 1** | ✓ usable as text |
| Light editor `#F7F8FA` | `#E69F00` | **2.12 : 1** | ✗ **fails** — must not carry text |
| Light editor `#F7F8FA` | `#8A5A00` | **5.58 : 1** | ✓ use this on the light theme; `#E69F00` for the icon fill only |

### 5A.7 Tab close — stated honestly

| Mechanism | Reality |
|---|---|
| `beforeunload` | Fires only after the user has interacted with the page (he has been typing). The browser shows **its own generic dialog** — we cannot control the wording, cannot make it Arabic, cannot add a "save" button |
| Consequence | **It is the last line, not the design.** The real defence is the ordered stack: **T0 (expectation) → chip (constant) → T1/T2 (milestone prompts) → our own in-app exit card → `beforeunload`** |
| The in-app exit card (which we fully control) | `AR-COPY` **«فيه تغييرات ما أخذت لها نسخة على جهازك»** with **«احفظ نسخة ثم اخرج»** (primary, inline-start) · **«اخرج بدون نسخة»** (outline only, ≥32 px away) · **«ارجع للتعديل»** |
| Because the browser keeps the working copy between sittings | A closed tab is normally **not** a loss. The prompts exist for the cases the browser cannot protect: cleared data, a new device, a different browser |

---

## 6. Layout under constraints

Canvas **1920 × 1080 stage-px**, usable **1728 × 972** after the 5% overscan inset (S6). Sketches are RTL: the **right edge is inline-start**. **Three question types only: text, image, audio.**

### 6.1 Skeleton A — text-only question

```
┌──────────────────────────────────────────────────────────────┐  ← 5% safe inset
│  [ ٥  البرتقالي ]        دور الإجابة: البرتقالي        [ الأزرق  ٣ ] │  status 104px
├──────────────────────────────────────────────────────────────┤
│                                                              │
│                نص السؤال — سطران بحد أقصى (76px)              │  question 300px
│                                                              │
├──────────────────────────────────────────────────────────────┤
│   ┌────────────────────────┐    ┌────────────────────────┐   │
│   │ ب)  خيار                │    │ أ)  خيار                │   │  options 2×2
│   └────────────────────────┘    └────────────────────────┘   │  equal height,
│   ┌────────────────────────┐    ┌────────────────────────┐   │  identical style
│   │ د)  خيار                │    │ ج)  خيار                │   │  (§4.9)
│   └────────────────────────┘    └────────────────────────┘   │
├──────────────────────────────────────────────────────────────┤
│                        [ لم يجيبوا ]            [ تراجُع ]    │  operator 104px
└──────────────────────────────────────────────────────────────┘
```

- Option order under a natural RTL grid: **أ top-right, ب top-left, ج bottom-right, د bottom-left.** This falls out of `dir="rtl"` on a 2-column grid — do not hand-place it.
- The letters أ/ب/ج/د **must be displayed** — the reading team reads them aloud, and the operator taps by them.
- **All four cards share the tallest card's height** (§4.9): removes both the layout jitter and the "longest one is correct" tell.
- **Layout rule:** default 2×2. **If any option would wrap to two lines in 2×2, the whole set switches to stacked 1×4.** Never mix.

### 6.2 Skeleton B — image question, two beats

**Rule that prevents "the image shrinks to nothing": image and options occupy separate beats.** They never compete for the same 972 px.

```
BEAT 1 — image first, question overlaid (the reading team reads from here)
┌──────────────────────────────────────────────────────────────┐
│  [ ٥  البرتقالي ]        دور الإجابة: البرتقالي        [ الأزرق  ٣ ] │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│                  الصورة — object-fit: contain                │  up to 1728×720
│                  (portrait images letterbox; the side        │
│                   bars carry the question text)              │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  نص السؤال فوق تعتيم بتباين ≥ 7:1  (76px)               │  │
│  └────────────────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────────────┤
│                        [ اعرض الخيارات ]        [ تراجُع ]    │
└──────────────────────────────────────────────────────────────┘

BEAT 2 — options, image kept but never below its floor
┌──────────────────────────────────────────────────────────────┐
│  [ ٥  البرتقالي ]        دور الإجابة: البرتقالي        [ الأزرق  ٣ ] │
├────────────────────────────────┬─────────────────────────────┤
│  ┌──────────────────────────┐  │                             │
│  │ أ)  خيار                  │  │        الصورة               │  image column
│  └──────────────────────────┘  │        contain              │  620–700 px
│  ┌──────────────────────────┐  │        ≥ 620 × 620          │  ← inline-START
│  │ ب)  خيار                  │  │                             │     (right side)
│  └──────────────────────────┘  ├─────────────────────────────┤
│  ┌──────────────────────────┐  │  نص السؤال (60px)            │
│  │ ج)  خيار                  │  │                             │
│  └──────────────────────────┘  │                             │
│  ┌──────────────────────────┐  │                             │
│  │ د)  خيار                  │  │                             │
│  └──────────────────────────┘  │                             │
├────────────────────────────────┴─────────────────────────────┤
│                        [ لم يجيبوا ]            [ تراجُع ]    │
└──────────────────────────────────────────────────────────────┘
```

- **Image floor: 620 × 620 stage-px.** Below that, fall back to Beat 1 and show options after a second tap. A picture the room cannot see is worse than an extra tap. *(This second tap is on top of the two-tap baseline and applies only to image questions — it is the honest cost of media, and it is the same tap the reading team's rhythm wants anyway.)*
- Options force to **stacked 1×4** in Beat 2 (the column is 1000 px, not 1728).
- **Portrait image on a landscape stage:** `contain` inside the image box; the letterbox bars are *used* to carry the question text in Beat 1. Never `cover` (crops the answer out of the picture). Never stretch.
- The image column sits on the **inline-start (right)** — a 2-column grid under `dir="rtl"` mirrors automatically; never `float` or `left:`.

### 6.3 Skeleton C — audio question

Audio is now one of only three question types, so this screen carries real weight. A naive implementation shows a blank stage and the room cannot tell playing from paused from broken.

```
┌──────────────────────────────────────────────────────────────┐
│  [ ٥  البرتقالي ]        دور الإجابة: البرتقالي        [ الأزرق  ٣ ] │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│                نص السؤال (76px، اختياري)                      │
│                                                              │
│         ▂▄▆█▇▅▃▂▄▆█▇▅▃▂▄▆█▇▅▃▂      ← live level meter        │  ≥ 200px tall
│                                                              │
│              ● يُشغَّل الآن            0:07 / 0:24              │  LTR-isolated
│                                                              │
├──────────────────────────────────────────────────────────────┤
│  [ 🔊 الصوت ]  [ أعِد التشغيل ]  [ اعرض الخيارات ]  [ تراجُع ] │
└──────────────────────────────────────────────────────────────┘
```

| Requirement | Reason |
|---|---|
| The level meter is driven by **actual audio output** (an analyser on the real element), never a decorative loop | A decorative animation lies precisely when the sound has failed — the one moment the room needs the truth |
| Three explicit states, at ≥56 px | `AR-COPY` **«يُشغَّل الآن»** · **«متوقّف»** · **«انتهى المقطع»**. Without them nobody knows whether to wait |
| **«أعِد التشغيل»** is on the hot path, not in a menu | Guests will ask, every time, in a noisy room |
| Volume is on the hot path | §7.6 — the laptop speaker is the weakest link in the product |
| Position/duration `0:07 / 0:24` stays **LTR and isolated** | S5 exception (§2.5) |
| Autoplay: `play()` is chained to the operator's tap | The tap that shows the question **is** the required user gesture. Never rely on unprompted autoplay |

### 6.4 The maze is a beat, not a permanent strip

**Recommendation: do not dock the maze on the question screen.**

- A permanent maze strip costs ~160 px of the 972 px usable height on *every* question — the difference between the comfortable option size (60 px) and the floor (44 px).
- The room does not need the map while a question is being read aloud; it needs it at two moments — the turn card, and immediately after an answer, when the token moves.
- Continuous state is carried numerically by the status strip, always visible.
- The token move deserves the whole stage: it is the reward beat.

```
BEAT 3 — the maze, full stage, after the answer
┌──────────────────────────────────────────────────────────────┐
│                          صحيح ✓                              │  96px
├──────────────────────────────────────────────────────────────┤
│  النهاية ◄──○──○──●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ البداية │  ← blue, solid
│  النهاية ◄──○──○──○──○──●┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄ البداية │  ← orange, dashed
├──────────────────────────────────────────────────────────────┤
│                        [ السؤال التالي ]        [ تراجُع ]    │
└──────────────────────────────────────────────────────────────┘
```

Tracks are distinguished by **colour + line style (solid vs dashed) + token glyph + the team name printed at the token** — never colour alone (§7.3 gives the measured reason).

### 6.5 Aspect ratios and screens

| Target | Behaviour |
|---|---|
| **16:9 TV / 1080p** | The design canvas exactly. 5% safe inset respected |
| **Laptop 16:10** (1920×1200, 2560×1600) | 16:9 stage centred, letterboxed in the stage background colour — invisible in practice. Do **not** reflow to 16:10; one canvas means one thing to verify |
| **Projector 4:3 / 16:10** | Same, larger letterbox |
| **Ultrawide 21:9** | Pillarboxed |
| **Tablet landscape** | Same canvas, scaled down. Verify the ×1.30 type step here — the tightest case |
| **Portrait (aspect < 1.2)** | **Do not attempt a portrait stage in v1.** Full-screen message. Scope note for `scope-advisor`. `AR-COPY` **«أدر الجهاز أفقياً لعرض اللعبة»** |

**What changes between TV and laptop:** nothing in the layout — that is the point of the fixed canvas. What changes is the *type-scale step the operator picks* (§1.4) and the necessity of the safe inset (needed on TV, harmless on laptop).

---

## 7. Accessibility and room conditions

### 7.1 Contrast targets

WCAG 2.2 AA (S2) formally requires only **3:1** for our text, because everything on the stage is "large text" by WCAG's definition (≥24 px). That is obviously wrong for a room with glare, an uncalibrated TV and older viewers.

| Element | Floor | Basis |
|---|---|---|
| All stage text | **≥ 7:1** | WCAG 2.2 SC 1.4.6 Contrast (Enhanced), AAA for normal text — used here as a *floor* to buy back the margin lost to glare, ambient light and TV processing |
| Text over an image (with scrim) | **≥ 7:1** against the scrim, measured at the brightest pixel region under the text | |
| Operator bar text | ≥ 4.5:1 | |
| Non-text (borders, tokens, focus rings, tracks) | ≥ 3:1 | WCAG 2.2 SC 1.4.11 |

### 7.2 The measured palette

All ratios computed with the WCAG relative-luminance formula (sRGB, 0.2126R + 0.7152G + 0.0722B).

**Dark theme (default — dim majlis, less glare, screen is not a lamp):**

| Token | Hex | Relative luminance | Contrast vs background | Verdict |
|---|---|---|---|---|
| Stage background | `#0E1116` | 0.005516 | — | Not pure black: `#000` crushes on cheap TVs and blooms against white text |
| Primary text | `#F2F4F7` | 0.902954 | **17.16 : 1** | Not pure white: `#FFF` clips and haloes with TV sharpening |
| Team A (blue) | `#0072B2` | 0.152517 | 3.65 : 1 | Okabe-Ito (S8). Passes SC 1.4.11 |
| Team B (orange) | `#E69F00` | 0.416148 | 8.40 : 1 | Okabe-Ito (S8) |
| Correct marker | `#009E73` | 0.256872 | 5.53 : 1 | Okabe-Ito bluish-green, not pure green |
| Wrong marker | `#D55E00` | 0.221498 | 4.89 : 1 | Okabe-Ito vermilion, not pure red |

**Light theme (bright room, window glare, daytime majlis) — also the editor's default surface:**

| Token | Hex | Relative luminance | Contrast | |
|---|---|---|---|---|
| Background | `#F7F8FA` | 0.938125 | — | |
| Primary text | `#14171C` | 0.008438 | **16.91 : 1** | |
| Backup-warning text | `#8A5A00` | 0.127162 | **5.58 : 1** | §5A.6 — `#E69F00` measures only 2.12:1 here and must not carry text |

`AR-COPY` (settings): **«الإضاءة: داكن · فاتح»**

### 7.3 Colour is never the only signal — with the numbers that force it

| Pair | Luminance contrast between them | Consequence |
|---|---|---|
| Team blue `#0072B2` vs team orange `#E69F00` | **2.30 : 1** | Distinguishable by hue, weak in greyscale. **Requires** solid vs dashed track, a different token glyph, and the team name printed at the token |
| Correct `#009E73` vs wrong `#D55E00` | **1.13 : 1** | Essentially *identical* in greyscale. A colour-only right/wrong signal is unreadable for a monochromat and marginal for anyone under glare. **Mandatory redundancy:** a ✓ / ✗ glyph at ≥64 px **and** the Arabic word |

`AR-COPY`: **«صحيح»** / **«خطأ»** — 96 px alongside the glyph.

**Recommended treatment of the correct option on reveal:** a **thick outline** in `#009E73` plus a filled ✓ chip, with the option text staying near-white on the dark background. This preserves 17:1 text contrast (white text *on* a green fill measures only **3.10 : 1**) and uses colour purely as a redundant marker. **The outline must be applied only at reveal — never present, never pre-rendered transparent, on the pre-reveal card (§4.9).**

**Alternative team pair for maximum greyscale separation:** blue `#0072B2` vs yellow `#F0E442` measures **3.92 : 1** — better than blue/orange. Cost: aesthetic asymmetry (yellow reads far brighter, can feel like the "favoured" team). Blue/orange with mandatory shape redundancy is the recommendation; blue/yellow is the fallback when a colour-vision-impaired guest is known to be present.

### 7.4 Surviving a cheap TV

| Hazard | Rule |
|---|---|
| Overscan | 5% safe inset (S6); background may bleed, text may not |
| "Vivid"/"Dynamic" mode oversaturates and crushes blacks | Never `#000` background, never `#FFF` text (§7.2) |
| HDMI / casting uses 4:2:0 chroma subsampling — colour resolution quartered | **Text is never rendered in a saturated colour.** All text is near-white or near-black. Colour lives in fills, outlines and tracks only |
| Sharpening / edge enhancement destroys thin strokes | Minimum weight 600 for stage text (§3.2) |
| Motion smoothing / low refresh | Keep animation simple: opacity and transform only, ≥300 ms, no fast small-element motion. Honour `prefers-reduced-motion` |
| Uncalibrated gamma | The 7:1 floor absorbs substantial gamma error; a 3:1 target would not |

### 7.5 Dim majlis lighting and glare

- **Dark theme by default.** In a dim room a white stage is a lamp; guests squint, and older eyes lose contrast sensitivity fastest under glare.
- **Light theme in one tap** for a daytime majlis or a window behind the screen — reflections on a dark screen are worse than a bright screen.
- No large pure-white areas in the dark theme; scrims over images at ≥60% opacity so text never sits on unpredictable brightness.

### 7.6 Audio in a noisy room — now one of only three question types

The laptop speaker is the weakest link in the whole product, and removing video makes audio questions *more* prominent, not less.

| Issue | Recommendation | Owner |
|---|---|---|
| Clips vary wildly in loudness; one is inaudible, the next startling | **Normalise loudness at import.** Broadcast R128 targets −23 LUFS, far too quiet for a noisy majlis; streaming platforms normalise nearer −14 LUFS. Target the streaming end. **I have not re-verified current platform figures — hand the exact target to `media-storage-expert`** | `media-storage-expert` |
| The room cannot hear it | A **large, always-present volume control** on the audio question screen, and **«أعِد التشغيل»**. Both on the hot path, never in a menu (§6.3) | this report |
| Laptop speakers are simply not enough | Say it once, plainly, on the setup screen: `AR-COPY` **«لأفضل صوت، وصّل الجهاز بمكبّر صوت أو بالتلفزيون.»** | this report |
| A very quiet clip discovered live | Warn at import in the editor: `AR-COPY` **«هذا المقطع منخفض الصوت — قد لا يُسمع في مجلس مزدحم.»** | joint |
| A long clip stalls the room | Warn at import past ~30 s: `AR-COPY` **«المقطع طويل (٥٥ ثانية). الأسئلة الصوتية القصيرة أمتع في المجلس.»** Length policy → `play-experience-advisor` | joint |
| Autoplay policy blocks sound | Chain `play()` to the operator's tap — that tap **is** the required user gesture | joint with `media-storage-expert` |

---

## 8. Verification checklist for the visual-verifier

**Deterministic capture conditions — record all of these every time (v3 §6ب, §12):**

| Setting | Value |
|---|---|
| Viewport | **1920 × 1080**, pinned |
| `deviceScaleFactor` | **1** |
| Fonts | capture only after `await document.fonts.ready` |
| Animation | `prefers-reduced-motion: reduce`, all transitions completed |
| Content | the fixed fixture set below — never ad-hoc content |
| Screenshot filenames | **Latin ASCII only** (v3 §1 rule 4), e.g. `stage-question-image-scale130-before.png` |

**Fixture set:**

| Fixture | Content |
|---|---|
| F1 | Shortest realistic question, four one-word options |
| F2 | **Longest allowed** question (150 chars) and four **50-char** options |
| F3 | Landscape image 16:9 |
| F4 | **Portrait image 3:4** — the case that breaks naive layouts |
| F5 | Audio question, with a broken-source variant |
| F6 | Team names at the 18-char cap, one containing Latin characters and a number |
| F7 | Score state `9 → 10` (tabular numerals, layout shift) |
| **F8** | **The same question rendered four times with the correct option rotated through positions أ/ب/ج/د** — the no-tell fixture (§4.9) |

**Numeric checks — each must produce a number, not a judgement:**

| # | Check | Passes when |
|---|---|---|
| V1 | Computed `font-size` of every role vs §1.5 | Exact match at ×1.00, ×1.15, ×1.30 |
| V2 | Measured Arabic ink height of "بخ" ÷ font-size | Within ±8% of the 0.50 assumption; else rescale §1.5 |
| V3 | Programmatic contrast ratio for every text/background pair from computed styles | Stage text ≥ 7:1; operator bar ≥ 4.5:1; non-text ≥ 3:1 |
| V4 | `scrollHeight <= clientHeight` on every text box, all fixtures, all three scale steps | No overflow anywhere |
| V5 | No stage element has `text-overflow: ellipsis` or `-webkit-line-clamp` | Zero matches |
| V6 | RTL mirror: `getBoundingClientRect().right` of option أ > option ب; image column right edge > options column right edge | True |
| V7 | Font A/B: pixel distance between the two dots of ت at 60 px, Cairo 700 vs IBM Plex Sans Arabic 700 | Record both. If Cairo < ~4 px, escalate the font decision (§3.2) |
| V8 | Capture with the webfont **blocked** (fallback stack active), fixture F2 | No clipping, no overflow — proves offline safety |
| V9 | Safe area: no text element's rect within 96 px (sides) / 54 px (top-bottom) of the stage edge | Zero violations |
| V10 | Static grep of stage CSS for physical direction properties (§2.2 ban list) | Zero matches without an S5-exception comment |
| V11 | Image floor: image box ≥ 620 × 620 in Beat 2, fixtures F3 and F4 | True, or the layout correctly fell back to Beat 1 |
| V12 | Greyscale capture of the maze and of the correct/wrong reveal | Team tracks and the verdict distinguishable **with all colour removed** |
| V13 | Tap-target size for every operator control | ≥ 240 × 96 stage-px, ≥ 32 px apart |
| V14 | Score `9 → 10` (F7) | Zero layout shift (tabular numerals confirmed) |
| **V20** | **No-tell, fixture F8:** compare computed styles of all four option cards pre-reveal (every property), compare their `getBoundingClientRect()` heights, and pixel-diff the four captures with the correct option in different positions | **All four cards have identical computed styles and identical heights; the four captures differ only in the text pixels.** Zero difference attributable to correctness |
| **V21** | **No-tell in the DOM:** search the pre-reveal option elements for any attribute, class, dataset key, `aria-*` or `title` that encodes correctness | Zero matches — the flag lives in session state, not the DOM |
| **V22** | **Audio state truthfulness, F5 broken variant** | The level meter is flat and the state reads «تعذّر تشغيل المقطع…»; it never animates over a dead source |
| **V23** | **Backup chip** present and legible in all three states (§5A.6), on both themes, contrast measured | Dark ≥ 7:1; light ≥ 4.5:1; `#E69F00` never used as text on light |
| **V24** | **Play-night cold start:** open the published link, count user actions to the first question | **≤ 2 actions** («ابدأ اللعبة», then the turn card) — zero file interactions |
| **V25** | **Emitted backup filename** | Matches `^[a-z0-9._-]+$` and sorts chronologically by name |
| **V26** | Grep the whole product for video: `video`, `mp4`, `webm`, `<video` | Zero matches |

**Proposed protocol file (v3 §8), to be written when implementation begins:** `docs/بروتوكولات/arabic-stage-screenshots.md` — deterministic capture procedure, fixture set, contrast-measurement routine, Arabic shaping/clipping assertions, and the no-tell comparison (V20/V21). English content, Latin filename. Not written in this investigation because there is no code to pin it against.

---

## 9. For the user-facing deck

Five concrete choices for a non-technical person, each stated as **what he will see and feel** — the planner translates to Arabic. All are cheap to flip *if* the implementation follows §2.3 (one mirror point), §2.6 (one digit formatter) and §4.9 (order decided in one place); they become expensive after the layout is tuned, which is why they belong in the first deck.

---

### Choice 1 — Which way does the maze run?

> Two teams, two tracks. Where does each track begin, and which way does the token travel as a team gets answers right?

| Option | What he will see | What it feels like |
|---|---|---|
| **A — from the right toward the left** *(recommended)* | Tracks start at the right edge next to «البداية»; tokens move leftward toward «النهاية» | Reads exactly like the Arabic text above it. The eye starts where the reading starts. Nothing on screen points the wrong way |
| B — from the left toward the right | Tracks start at the left and move right | Familiar to anyone who has played an imported board game, but it is the only element on screen running against the Arabic |
| C — from the bottom upward ("the climb") | Tracks run up the screen; the winner reaches the top | Progress reads as "climbing", understood regardless of language. Costs screen height, so the maze gets its own moment rather than sitting beside the question |

*Recommendation: A, with a large, unmistakable finish marker drawn at the end. Once he can see where the finish is, nobody has to work out which direction means "forward".*

---

### Choice 2 — Which numbers appear on the screen?

> The only numbers the room ever sees are the two scores and the step counts.

| Option | What he will see | What it feels like |
|---|---|---|
| **A — 0 1 2 3 4 5 6 7 8 9** *(recommended)* | Scores read `3` and `5` | Every guest of every age reads them instantly. And from four metres these shapes stay distinct from each other |
| B — ٠ ١ ٢ ٣ ٤ ٥ ٦ ٧ ٨ ٩ | Scores read `٣` and `٥` | More Arabic in feel. But from four metres on a TV, **٥ (five) and ٠ (zero) are both small rings** and get confused — and a misread score is the one number-mistake that starts an argument |

*Recommendation: A, on legibility grounds. Otherwise a taste question, and a one-line change if he prefers B.*

---

### Choice 3 — Should the app shuffle the four answers on screen?

> He types the four answers and marks the right one. Almost everyone types the correct answer first without noticing. The other team is reading the options aloud off the screen, so they see the order.

| Option | What he will see | What it feels like |
|---|---|---|
| **A — the app mixes the order on screen** *(recommended)* | The four answers appear in a different order from the one he typed. The order stays fixed while that question is on screen, so nobody gets confused mid-reading. The preview in the editor shows him exactly what the room will see | Nobody can guess "it's always أ". His habit while typing stops being a giveaway around round four |
| B — exactly the order he typed | The four answers appear precisely as he wrote them | Full control. But then he has to remember to vary the position himself, every single question, or the room works out the pattern |

*Recommendation: A. Either way, the correct answer looks exactly like the other three until it is revealed — same size, same colour, same box height. Nothing on the screen hints at it.*

---

### Choice 4 — How often should the app remind him to keep a copy of his questions?

> He writes the questions over several sittings in the days before. His work stays in his browser between sittings. It is only truly safe once he has a copy saved on his own computer.

| Option | What he will see | What it feels like |
|---|---|---|
| **A — a reminder when he stops for the day, and a permanent marker** *(recommended)* | When he leaves the editor: "قبل ما تسكّر: احفظ نسخة على جهازك". At all other times, a small corner marker says whether a copy exists, with a save button attached to it | He is never interrupted while thinking about a question. He is reminded exactly once per sitting, at the natural moment, and can always glance at the corner to know where he stands |
| B — also every ten questions | The same reminder, plus one every ten finished questions | Safer for someone who ignores small markers. Slightly more interruption |
| C — the corner marker only, no reminders | Quietest of all | Most likely to end with weeks of work living in one browser and nowhere else |

*Recommendation: A. In every option the app also asks before he closes the editor with changes he has not copied, and shows the actual file name of the last copy so he can find it on his computer.*

---

### Choice 5 — Should the maze stay on screen all the time?

> The maze is where the two teams' progress lives. It can sit at the bottom of every question, or it can get its own moment after each answer.

| Option | What he will see | What it feels like |
|---|---|---|
| **A — its own moment after each answer** *(recommended)* | The question fills the screen with big text. The instant an answer is recorded, the maze takes over the whole screen and the token visibly moves, then the next question | The answers are noticeably bigger and easier to read from across the room — measured, this is the difference between comfortable and barely-readable at three metres. And the token move becomes the celebration moment instead of a small twitch at the bottom |
| B — always visible at the bottom | A strip along the bottom of every question showing both tracks | Everyone can see the standings at any second. The price is real: the answer text has to shrink, and at three metres that shrink puts it right on the edge of legible |

*In both options the score for each team is on screen at all times as a number, so nobody is ever left guessing who is ahead.*

---

### Three things that are not choices — consequences he should hear once

1. **A laptop screen alone will not work in a majlis.** Measured: on a 13″ laptop the four options are readable only within about **1 metre**. Guests at 2 metres see letters at less than half the internationally recognised minimum. Connect the laptop to the TV.
2. **Sit no farther than about twice the screen's diagonal.** A 55-inch TV → about **3 metres**; a 65-inch → about **3.5 metres**. Beyond that the larger-text setting buys roughly another metre — but nothing buys five metres on a 55-inch screen.
3. **His questions live in one browser until he saves a copy.** Publishing the game puts them at the link; a saved copy on his computer is what lets him move to another computer or recover if the browser is cleared. Neither happens by itself.

---

## 10. Open dependencies on other agents

| Question | Owner | Why I cannot answer it |
|---|---|---|
| How many questions are "enough" (the readiness meter's threshold) | `game-systems-expert` | Depends on steps-to-win and turn structure |
| Whether option order is shuffled per session, and with what seed (must survive undo) | `game-systems-expert` | I gave the UX requirement (§4.9); the state rule is his |
| Whether a "steal" rule exists (costs +1 control on the hot path) | `game-systems-expert` / user | Rules decision |
| Pack file format and extension (`.noufpack` vs `.zip`) | `media-storage-expert` (format) + `durability-advisor` (sharing) | UX criteria in §5A.5; the format is not mine |
| **The publish recipe — the exact three Arabic steps the author follows** | `static-delivery-expert`, written jointly with me | I own the UX requirements (§5A.4); the mechanics are his |
| Audio loudness normalisation target, length warning threshold, and file-size warning thresholds | `media-storage-expert` (encoding) + `play-experience-advisor` (length) | Codec and pacing territory |
| Whether the printed answer sheet, the light theme and the shuffle default ship in v1 | user, via `scope-advisor` | I stated the UX cost of each; the decision is not mine |
| The shipped `cairo-arabic.woff2` — static or variable, which weight, which subset | whoever has shell access first | I had no way to measure the file in this investigation |
| Final font byte budget for the delivery size budget | `static-delivery-expert`, from measured numbers | Must be measured, not estimated |

**Resolved by the 2026-08-07 rulings, no longer open:** the heavy-video question (video is removed entirely); where the game content lives at play time (published with the site); whether the host loads a file in front of guests (he does not).
