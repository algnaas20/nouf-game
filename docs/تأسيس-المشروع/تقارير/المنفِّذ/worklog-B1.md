# Worklog — PROMPT B1 (WL-B, stage) — minimal stage + type scale

**Executor** · **Date 2026-08-07** · **Worktree** `../nouf-wl-b-stage` (branch `wl-b-stage`) · **Port 3011**
Spec: `docs/تأسيس-المشروع/تقارير/planner/executor-prompts-2026-08-07.md` §PROMPT B1 + `docs/تأسيس-المشروع/خطة.md` §PH-B1.

Status: **IN PROGRESS — incremental log, saved section by section.**

---

## 0. Font measurement — correction to a relayed claim (evidence-first)

The coordinator relayed: "`cairo-arabic.woff2` is static, no `fvar`, has `STAT`, one weight only — sourcing a second weight file is a real task."

**Independent measurement, twice, disagrees.** Two methods, same file, same result:

1. `fontkit.openSync()` on the file reports `variationAxes: { wght: { min:200, default:400, max:1000 } }`.
2. A from-scratch WOFF2 header + table-directory parser (reads the **uncompressed** table directory that sits right after the fixed WOFF2 header — no brotli decompression needed to see table tags) lists all 20 tables present in the file.

Raw parse output (`file bytes = 30896`, `signature = wOF2`):

| Table present | fvar | avar | gvar | HVAR | STAT | glyf | loca |
|---|---|---|---|---|---|---|---|
| Found? | **yes** (origLength 100) | **yes** (46) | **yes** (37016) | **yes** (1179) | yes (166) | yes | yes |

`fvar` axis record read directly: `axisTag='wght', minValue=200, defaultValue=400, maxValue=1000`, plus 8 named instances (ExtraLight…Black) including **SemiBold=600** and **Bold=700**.

**Conclusion:** the bundled file **is** a variable font covering the full 600/700 pair already, inside its existing 30,896 bytes. No second file is needed. I did not spend budget sourcing one. Total font budget used: **30.2 KB**, not close to the 120 KB ceiling.

*(Scripts used, kept only in scratchpad, not in the repo: raw WOFF2 header/table-directory parser + `fontkit` cross-check — both give the same table list.)*

---

## 1. Closing-claims list — written before code, evidence recorded as each lands

| # | Claim (from PROMPT B1 acceptance criteria) | Evidence required | Status |
|---|---|---|---|
| 1 | V1 — computed `font-size` of every role matches §1.5 table exactly at ×1.00/1.15/1.30 | 3-column measured table, real browser | pending |
| 2 | V2 — ink-height ratio of "بخ" at 100px within ±8% of 0.50 | canvas measurement number | pending |
| 3 | V3 — contrast ≥7:1 for every stage text/background pair | computed-style contrast numbers | pending |
| 4 | Font bytes ≤120 KB | file size | **done — 30,896 B = 30.18 KB** |
| 5 | V10 — grep stage CSS for banned physical-direction properties = 0 | grep output pasted | pending |
| 6 | V4 — `scrollHeight <= clientHeight`, longest fixture (150-char Q + 4×50-char options), all 3 scale steps | pass/fail per box | pending |
| 7 | Screenshots `stage-question-text-scale100.png` / `...scale130.png`, 1920×1080, dsf 1, after fonts.ready, reduced-motion | files produced | pending |
| 8 | Two taps: option tap → reveal+record, «السؤال التالي» tap → next turn | tap count trace | pending |
| 9 (extra, top-level non-negotiable, not an official B1 line-item) | No-tell: 4 option cards identical computed style + correctness absent from DOM pre-reveal | computed-style diff + attribute scan | pending |

Anything not measured by the end of this file is written "not measured", not silently dropped.

---
