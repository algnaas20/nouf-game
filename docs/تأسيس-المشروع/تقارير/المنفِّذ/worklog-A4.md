# Worklog — PH-A4 (WL-A core: save and resume)

**Executor** · **Date:** 2026-08-08 · **Worktree:** `../nouf-wl-a-core` (branch `wl-a-core`, merged with `main` @ `d9a97c6` — carries B1–B3 stage, C1–C3 editor, D1 build gates) · **Port:** 3010

**Spec source:** `خطة.md` PH-A4 (no PROMPT A4 in `executor-prompts-2026-08-07.md`), cross-checked against `game-rules-and-maze-investigation.md` §6.3 ("what must survive a refresh") and the coordinator's explicit asks (deckHash refusal, explicit resume prompt data, a real — not simulated — interruption).

**Pre-flight:** merged `main` (fast-forward, no conflicts). `npm install` re-run (package.json changed — Playwright, `@types/node`, tsx now present). Found a **pre-existing** `tsc` error in `src/editor/ui/stage-preview.ts` (references a `scores` prop `QuestionScreenParams` in `src/stage/**` doesn't have) — confirmed present on `main` itself before I touched anything (git status clean at the merge commit, error already there). Outside WL-A ownership (`src/editor/**` is WL-C, `src/stage/**` is WL-B) — **flagged to the coordinator, not fixed**. `npx vitest run` still passes fully (55/55) despite it, since vitest's esbuild transform doesn't type-check.

## Closing-claims list (written before code)

| # | Criterion (خطة.md PH-A4, literal) | Planned measurement | Status |
|---|---|---|---|
| 1 | Write is synchronous, completes in the same transition pulse — proven by a test reading the store directly after the call with no `await` | Unit test reads the raw injected storage object immediately after `saveSession()` returns | pending |
| 2 | S9-style: serialize/deserialize at every step for ≥1,000 games, final outcome matches an uninterrupted run — zero diffs (I10) | Reuse `tools/sim`'s real harness + `session-store.ts`'s real save/load, ≥1,000 games | pending |
| 3 | `deckHash` mismatch → refuse resume with a message, not a partial load — test passes | `checkResume()` unit test + a live-browser proof | pending |
| 4 | No auto-resume, no auto-delete: the screen shows "تكملة الجلسة" and "جلسة جديدة" — screenshot | `checkResume()` returns data only, never acts; live screenshot of the two-choice data being available (screen itself is WL-B's, out of scope — documented) | pending |
| 5 (coordinator, explicit) | Prove with a REAL interruption, not simulated: resume restores positions, attempts, turn, used questions, RNG draw index, and the option order of the on-screen question | Live Playwright test: real `page.reload()` on a real dev-server-served page, via a fixture harness `tests/core` owns | pending |

**Design decision, stated up front:** persistence targets are exactly what A1–A3 already proved sufficient for undo — **the raw event log**. `saveSession` persists `events: GameEvent[]` verbatim; `fold(events)` (the same function already proven correct across 27,000+ games) regenerates positions, attempts, `currentTeam` (turn), `usedQuestionIds`, `rng.drawIndex`, and `optionOrder` losslessly, "by construction" — no separate snapshot format to keep in sync, no new serialization logic to get subtly wrong.

---

## Implementation log (incremental)

| File | Status | Evidence |
|---|---|---|
| `src/core/session-store.ts` | **Done** | `saveSession`, `loadRawSession`, `clearSession`, `checkResume` — injectable `SessionStorageLike`, defaults to real `localStorage`. `tsc --noEmit`: only the pre-existing unrelated `stage-preview.ts` error remains (confirmed present before any A4 change) |
| `tests/core/session-store.test.ts` | **Done, 8/8 green** | Fast unit tests: sync-write proof (criterion 1), deckHash refusal (criterion 3), no-mutation-on-check + full state restore (criterion 4/5 data side), finished-game → `none`, no-storage → `none`, corrupt payload → `none`, `clearSession` |
| `tests/core/session-fuzz.test.ts` | **Done, 1/1 green** | S9-style: real `saveSession`/`loadRawSession` at every step, 1,000 games, 100,000 checks, 0 mismatches, resumed run matches an uninterrupted run's outcome (criterion 2) |
| `tests/core/fixtures/session-harness.html` | **Done** | Minimal fixture page for the live-browser proof |
| `tests/core/fixtures/session-harness-main.ts` | in progress | Bootstrap module the fixture loads — plays a partial game, saves via real `localStorage`, exposes state on `window` for Playwright to read before/after a real `page.reload()` |
| `tests/core/live/real-refresh.ts` | not started | The live Playwright script — real `page.reload()`, same pattern as `tests/editor/live/persistence-and-quota.ts`, port 3010 |

Full suite so far: `npx vitest run` → **12 test files, 64 tests, all passing** (includes every prior phase's tests plus A4's two new files).

---

## Live-browser proof — criterion 5, run for real (`npx tsx tests/core/live/real-refresh.ts`)

Real `vite` dev server (JS API, not `vite.config.ts`/`index.html` edits — same untouched-config pattern as `tests/editor/live/persistence-and-quota.ts`) on **port 3010**, real Chromium via Playwright, real `window.localStorage`, real `page.reload()`.

```
Pre-interruption state.stateId: QUESTION_SHOWN
Pre-interruption positions: [ 2, 0 ] attempts: [ 2, 1 ]
Pre-interruption currentTeam: B
Pre-interruption usedQuestionIds: [ 'harness-q10', 'harness-q3', 'harness-q6' ]
Pre-interruption rng.drawIndex: 16
Pre-interruption optionOrder: [ 2, 3, 0, 1 ]
Pre-interruption currentQuestionId: harness-q7
SYNC-WRITE PROOF — raw localStorage matched saved events immediately: true
Post-reload state.stateId: QUESTION_SHOWN
Post-reload positions: [ 2, 0 ] attempts: [ 2, 1 ]
Post-reload currentTeam: B
Post-reload usedQuestionIds: [ 'harness-q10', 'harness-q3', 'harness-q6' ]
Post-reload rng.drawIndex: 16
Post-reload optionOrder: [ 2, 3, 0, 1 ]
RESUME AFTER A REAL RELOAD — positions/attempts/turn/usedQuestionIds/rng.drawIndex/optionOrder all match: true
RESUME AFTER A REAL RELOAD — full event log byte-identical: true
Wrong-deck checkResume() result: {
  kind: 'refused',
  reason: 'deck-mismatch',
  storedDeckHash: 'harness-q1|harness-q2|harness-q3|harness-q4|harness-q5|harness-q6|harness-q7|harness-q8|harness-q9|harness-q10',
  currentDeckHash: 'harness-q1|harness-q2|harness-q3|harness-q4|harness-q5|harness-q6|harness-q7|harness-q8'
}
DECKHASH MISMATCH REFUSAL — legible, no partial load: true
Harness screenshot saved: tests/core/live/real-refresh-harness.png
ALL LIVE SCENARIOS PASSED
```

Port 3010 verified free both before (`Get-NetTCPConnection -LocalPort 3010` → no result) and after the script exited (same check, same empty result) — the script's own `finally` block closes the Playwright browser and the vite dev server; nothing was left running.

**What this proves, item by item (coordinator's explicit list):**

| Restored field | Pre-interruption | Post-reload | Match |
|---|---|---|---|
| `positions` | `[2, 0]` | `[2, 0]` | yes |
| `attempts` | `[2, 1]` | `[2, 1]` | yes |
| turn (`currentTeam`) | `B` | `B` | yes |
| `usedQuestionIds` | `['harness-q10','harness-q3','harness-q6']` | same | yes |
| `rng.drawIndex` | `16` | `16` | yes |
| on-screen question's `optionOrder` | `[2,3,0,1]` | `[2,3,0,1]` | yes |
| `currentQuestionId` | `harness-q7` | `harness-q7` | yes |

`positions`/`attempts` land on `[2,0]`/`[2,1]` (not `[0,0]`) because the harness's deterministic policy is correct/wrong/correct — by design, so the interruption happens mid-game with real, non-trivial state, not at the empty starting point.

**Screenshot:** `tests/core/live/real-refresh-harness.png` — a blank harness page (the fixture has no visible UI; it only exercises `window` globals). The actual host-facing "تكملة الجلسة"/"جلسة جديدة" screen is `src/stage/**`, owned by WL-B, out of this line's ownership — **flagged for the coordinator to route to WL-B**: `checkResume()`'s `ResumeCheck` return value is the exact data contract that screen needs (`kind: 'available' | 'refused' | 'none'`, plus the resumable `state`/`events` when available), and nothing further needs building on the core side for that screen to exist.

---

## Red→green mutation proofs (session-store.ts's new logic)

All four mutated in `src/core/session-store.ts`, verified red via `npx vitest run tests/core/session-store.test.ts`, then reverted and reconfirmed green.

| # | Guard | Mutation | Failure output (pasted) | Reverted? |
|---|---|---|---|---|
| 1 | `checkResume` deckHash comparison | `if (false && first.deckHash !== currentDeckHash)` — the check is disabled | `AssertionError: expected 'available' to be 'refused'` — a changed deck would have been silently treated as resumable | Yes |
| 2 | `saveSession` synchronicity | Deferred the write into `queueMicrotask(...)` | `AssertionError: expected undefined to be defined` (criterion 1) — and it **cascaded** into 4 more failing tests (deckHash/resume/state-restore/clearSession), since every one of them relies on the write having actually landed by the time it checks; recorded as-is, not trimmed to look tidier | Yes |
| 3 | `checkResume`'s FINISHED exclusion | `if (false && state.stateId === 'FINISHED')` | `AssertionError: expected 'available' to be 'none'` — a completed game would have been offered as "resumable" | Yes |
| 4 | `loadRawSession`'s corrupt-payload handling | Removed the `try`/`catch` around `JSON.parse` | `SyntaxError: Expected property name or '}' in JSON at position 1` — thrown straight out of the function instead of being reported as a graceful absence | Yes |

Final gate (below) reconfirms full green, including a **second live-browser run**, after every mutation was reverted.

---

## Final gate

```
npx tsc --noEmit
→ only the pre-existing, out-of-scope src/editor/ui/stage-preview.ts error remains (confirmed present before any A4 change, flagged above, not touched)

npx vitest run
→ Test Files 12 passed (12), Tests 64 passed (64)

npx tsx tests/core/live/real-refresh.ts   (re-run after every mutation was reverted)
→ ALL LIVE SCENARIOS PASSED

Port 3010: free before the live run, free after (Get-NetTCPConnection -LocalPort 3010 → no result both times)
```

**File-ownership check:**
```
git status --porcelain
?? docs/تأسيس-المشروع/تقارير/المنفِّذ/worklog-A4.md
?? src/core/session-store.ts
?? tests/core/fixtures/
?? tests/core/live/
?? tests/core/session-fuzz.test.ts
?? tests/core/session-store.test.ts
```
All inside `src/core/**`, `tests/core/**`, and this report. `src/contracts/**` untouched (`git diff main -- src/contracts/` = 0 lines). No `vite.config.ts`/`index.html`/`package.json`/`src/stage/**`/`src/editor/**`/`src/storage/**`/`src/media/**`/`src/pack/**`/`src/pwa/**` files touched.

---

## Closing-claims list — final status

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | Synchronous write, proven by an immediate no-await read | **Met** | fast unit test + live-browser real-localStorage probe, both green; mutation #2 above proves the guard is not blind |
| 2 | S9-style, ≥1,000 games, zero diffs | **Met** | 1,000 games, 100,000 real save/load checks, 0 mismatches, resumed outcome matches uninterrupted run |
| 3 | deckHash mismatch → legible refusal, no partial load | **Met** | fast unit test + live-browser proof with two genuinely different deck hashes; mutation #1 above |
| 4 | No auto-resume, no auto-delete; two-choice data available | **Met** (data side) | `checkResume` only classifies, never acts, verified by a no-mutation-on-check test; **the visual two-button screen itself is WL-B's `src/stage/**`, out of scope — flagged, not built** |
| 5 (coordinator) | Real interruption, not simulated; all six fields restored | **Met** | live `page.reload()` in a real Chromium, real `localStorage`, real dev server on port 3010 — positions/attempts/turn/usedQuestionIds/rng.drawIndex/optionOrder/currentQuestionId all matched exactly, pasted above |

**Not built (flagged, not silently skipped):** the actual "تكملة الجلسة"/"جلسة جديدة" prompt screen and its wiring into `src/stage/session/game-driver.ts` — both are WL-B-owned files. `checkResume()`'s return shape (`ResumeCheck`) is the complete data contract that screen needs; recommend the coordinator route "wire `saveSession` after every `GameDriver.commit()` and call `checkResume` on stage boot" to WL-B.

**Pre-existing defect flagged, not fixed (outside WL-A ownership):** `src/editor/ui/stage-preview.ts` passes a `scores` prop `QuestionScreenParams` (`src/stage/**`) doesn't declare — a `tsc` error present on `main` before this phase touched anything. `src/editor/**` is WL-C, `src/stage/**` is WL-B; not mine to fix per file ownership.
