# Worklog — PH-A1 (WL-A core: minimal rule engine + walking-skeleton harness)

**Executor** · **Date:** 2026-08-07 · **Worktree:** `../nouf-wl-a-core` (branch `wl-a-core`) · **Port:** 3010 (unused this phase — no server, pure CLI logic; noted at close)

**Spec source (literal):** `docs/تأسيس-المشروع/تقارير/planner/executor-prompts-2026-08-07.md`, section **PROMPT A1**. Cross-checked against `خطة.md` PH-A1 checklist, the ruling D-09.1…D-09.20, and I1–I10/G1–G7 in `game-rules-and-maze-investigation.md`.

**Scope note (read first):** the top-level dispatch message asked for "the rules engine, event log **and simulation harness**", G4 first-mover measurement, etc. The literal PROMPT A1 spec — which the dispatch explicitly told me to treat as authoritative — scopes the ≥10,000-game harness, R-b, deck bands, deck exhaustion (full form) and G4 to **phases A2/A3**, and lists them under "Out of scope: ... the ≥10,000-game harness (phases A2–A4). Do not build them now." I implemented **PROMPT A1 literally** (100-game harness, N=2, 3-question deck) and did **not** build the ≥10,000-game harness or G4 in this phase — flagged here per the no-scope-creep rule rather than silently expanded or silently dropped. This is a discrepancy between the dispatch preamble and the frozen phase spec; recommend the coordinator confirm before A2/A3 dispatch.

---

## Closing-claims list (written before code, per v3 §4 gate)

| # | Acceptance criterion (PROMPT A1, literal) | Planned measurement | Status |
|---|---|---|---|
| 1 | 100/100 seeded games (N=2, 3-question deck, random policy) reach `FINISHED`, none exceeding `20 × deckSize` = 60 transitions | Vitest test prints pass count and max/avg transitions | pending |
| 2 | I6 `position[t] === correct[t]` asserted at every step of every game; assertion count > 0, printed | Vitest test prints total I6 assertion count | pending |
| 3 | I1, I3, I5, I7 all pass at every step; pass counts printed | Vitest test prints per-invariant counts | pending |
| 4 | 1,000+ fuzzed undo sequences: `undo(apply(s,e))` deep-equals `s` incl. `usedQuestionIds` and RNG draw index; zero failures | Vitest test over many games' full event logs, deep-equal check per event, count printed | pending |
| 5 | Red→green mutation proof, I1: `position += 2` | Manual source mutation + test run + failure output pasted + revert | pending |
| 6 | Red→green mutation proof, I3: delete push to `usedQuestionIds` | Same | pending |
| 7 | Red→green mutation proof, I6: grant a step on a wrong answer | Same | pending |
| 8 | Red→green mutation proof, I7: skip the turn swap on a wrong answer | Same | pending |
| 9 (bonus, not required by A1 list) | I5 mutation proof: remove a legality guard clause | Same, extra evidence for the "illegal event throws" guard since it's cheap | pending |
| 10 | `npx tsc --noEmit` 0 errors in the worktree after implementation | Command output pasted | pending |
| 11 | `npm run test` (vitest) full green run, output pasted | Command output pasted | pending |
| 12 | Files touched stay inside `src/core/**`, `tests/core/**` only (no `src/contracts/**` edits, no other line's files) | `git status`/`git diff --stat` in worktree, pasted | pending |
| 13 | Port 3010 / worktree cleanup | State explicitly: no server was started this phase (pure logic + CLI test runner only); worktree left in place for coordinator to merge/inspect, no background process to kill | pending |

**Explicitly NOT claimed this phase (would be false "done"):** ≥10,000-game harness, G1–G7 harness assertions, G4 first-mover measurement (both R-a and R-b figures), R-b equal-attempts balancing, decider/tiebreak, deck bands, deck exhaustion beyond a minimal leader/draw resolution needed only to let the 3-question/N=2 toy deck terminate at all (see design note below) — these are A2/A3 spec items. `docs/بروتوكولات/simulated-playthrough.md` is **not** written this phase (explicitly owed only after a real ≥10,000-game harness run, A3).

---

## Design decisions (with rejected alternatives)

### D1 — Minimal deck-exhaustion resolution is *necessary* for A1's own numbers to be achievable, not scope creep

With `N=2` and a 3-question deck under strict alternation (turn passes every question, win or lose), the **first team** gets questions 1 and 3, the **second team** gets only question 2. The second team can never reach `position=2` (max 1 attempt). So in the large majority of the 100 seeded random-policy games, nobody reaches N=2 "in flight" — the game can only finish if (a) the first team answers both its questions correctly (immediate win), or (b) all 3 questions are exhausted with nobody at N=2, which is the *common* case under a uniformly-random 4-option tap (~25% correct per tap).

Given PROMPT A1's own acceptance criterion #1 demands **100/100** games reach `FINISHED` within 60 transitions, some minimal deck-exhaustion resolution is mathematically required for the numbers to be honest — not an optional add from A2. I implemented the smallest possible version: when the unused pool is empty and no team has reached N, the leader wins (`winA`/`winB`); if positions are equal, `outcome = 'draw'`. **This is not R-b** (no balancing turn, no reserved decider question, no "سؤال من الحضور" screen, no deck bands) — those remain A2 scope, explicitly deferred. It is the frozen `Outcome` union's `draw` case, already required to exist by the frozen contract, put to its minimum necessary use.

**Rejected alternative:** grow the toy deck so the 2-vs-1 attempt split never matters (e.g., 6 questions). Rejected because PROMPT A1 is explicit and literal: "a hardcoded deck of 3 text questions." Changing the deck size to dodge the exhaustion question would be a silent, undocumented rule change; the chosen minimal resolution keeps the deck at exactly 3 as specified and makes termination provable instead.

### D2 — Function signatures extend beyond the prose in the prompt, where the frozen contract forces it

PROMPT A1 says (prose, not a type signature): `applyEvent(state,event)`, `legalEvents(state)`, `selectNextQuestion(state)`. The frozen `GameState` (state.ts, untouched) carries **no deck, no deck size, no full event log** — only `deckHash` (a string) and `usedQuestionIds`. Deciding "is the deck exhausted" or "what was the last answer's correctness" (needed to build the next `MOVE_APPLIED.delta`) is **not derivable from `GameState` alone** without either (a) adding fields to the frozen contract (forbidden) or (b) passing the deck / event log in alongside state to the functions that need them.

I chose (b): `legalEvents(state, ctx)` where `ctx = { deck, events, now? }`, and `selectNextQuestion(state, deck)`. `applyEvent(state, event)` stays exactly two arguments — it never needs the deck, only the event and the previous state, which is the property that keeps `fold` a pure reduction over the log alone.

**Rejected alternative:** thread deck/eventCount through a module-level singleton or closure factory (`makeCore(deck) -> {applyEvent, legalEvents, ...}`). Rejected: it hides the dependency, breaks referential transparency for tests that want to swap decks per game (as the 100-game harness does per seed), and makes the "event log is the only authority" property harder to see in the function signatures themselves.

### D3 — RNG is a pure function of `(seed, drawIndex)`, never a stateful generator object

`drawInt(rng: RngState, max) -> {value, rng: newRngState}` is a pure hash of `(seed, drawIndex)` (mulberry32-style mixing), not a mutable generator. This is what makes `rng.drawIndex` meaningfully "part of the folded state" per the frozen contract's `RngState` shape — re-folding from any prefix of the event log reproduces byte-identical future draws, which is exactly what undo/redo-by-refold requires without special-casing the RNG.

Fixed draw budgets are used so `applyEvent` (folding) never needs to recompute *what* was drawn, only *how many* draws were consumed by the event that was already decided by `legalEvents`: `selectNextQuestion` = 1 draw, `shuffleOptionOrder` (Fisher–Yates over 4 items) = 3 draws, so a `QUESTION_SHOWN` event always advances `drawIndex` by a shared constant `QUESTION_SHOWN_DRAWS = 4`. This is asserted, not assumed, by the undo-fuzz test (drawIndex is part of the deep-equal check).

### D4 — Win-check placement

Per the non-negotiable rule ("the win check runs only inside `PROGRESSION_APPLIED`"), the *code path* that inspects `positions[team] >= N` or `usedQuestionIds.length >= deck.length` to decide the next event only executes from `legalEvents` when `state.stateId === 'PROGRESSION_APPLIED'` — never from the `ANSWER_REVEALED` handler. `applyEvent`'s `MOVE_APPLIED` case only updates `positions` and sets `stateId = 'PROGRESSION_APPLIED'`; it does **not** set `outcome`. `outcome` is set exactly once, by `applyEvent`'s `GAME_ENDED` case, which is only legal from `PROGRESSION_APPLIED`. This keeps I9 (`outcome === null` unless `FINISHED`) true by construction and means undo (pop `GAME_ENDED`, re-fold) un-wins for free — no special-cased "un-win" code exists anywhere.

---

## Implementation log

| File | Change | Evidence |
|---|---|---|
| `src/core/rng.ts` | `createRng`, `drawInt` — pure `(seed, drawIndex) -> value` hash, no stateful generator | `tsc --noEmit` clean; exercised by every game run below |
| `src/core/select.ts` | `selectNextQuestion(state, deck)`, `shuffleOptionOrder(rng)`, draw-count constants `SELECT_DRAWS=1`, `SHUFFLE_DRAWS=3`, `QUESTION_SHOWN_DRAWS=4` | same |
| `src/core/reducer.ts` | `applyEvent(state,event)`, `initialState()`, `IllegalTransitionError`; one `case` per frozen `GameEvent` member, each starts with a `stateId` legality guard that throws | I5 test below |
| `src/core/legal.ts` | `legalEvents(state, ctx)` — win/exhaustion check lives only in the `PROGRESSION_APPLIED` case | criterion 1/2/3 tests below |
| `src/core/fold.ts` | `fold(events)`, `undo(events)` — pop-last-and-refold, no per-field restoration | criterion 4 test below |
| `tests/core/reducer.test.ts` | 4 tests covering PROMPT A1 criteria 1–4 | full run pasted below |

### Test run (`npx vitest run`, worktree `nouf-wl-a-core`)

```
[A1 criterion 1] finished=100/100, maxTransitions allowed=60, observed max events=13, avg events=13.00
[A1 criterion 2/3] I1=2600 assertions, I3=1300 assertions, I6=2600 assertions, I7=1300 assertions (all must be > 0)
[A1 criterion 3] I5 checks=3 (all threw and left state unchanged)
[A1 criterion 4] undo fuzz checks=1300 (>= 1000 required), zero failures

 ✓ tests/core/reducer.test.ts (4 tests) 253ms
 Test Files  1 passed (1)
      Tests  4 passed (4)
```

**Reading the numbers against PROMPT A1's criteria:**

| # | Criterion | Result |
|---|---|---|
| 1 | 100/100 games reach `FINISHED`, none exceeding 60 transitions | **100/100**, max observed 13, avg 13.00 — well under the 60 cap (the 3-question/N=2 deck simply cannot produce a longer game; see design note D1) |
| 2 | I6 assertion count > 0, printed | **2600** (2 per step × 1300 steps across 100 games) |
| 3 | I1, I3, I5, I7 pass counts printed | I1=2600, I3=1300, I7=1300, I5=3 (dedicated negative-path checks — SETUP guard, double-`QUESTION_SHOWN` guard, `GAME_ENDED`-outside-`PROGRESSION_APPLIED` guard) |
| 4 | 1,000+ fuzzed undo sequences, zero failures | **1300 checks, 0 failures**, deep-equality includes `usedQuestionIds` and `rng.drawIndex` explicitly (asserted twice: once via full `toEqual`, once via a targeted assertion on each field) |

`npx tsc --noEmit`: **0 output, exit 0** (clean) both before writing any core code (baseline) and after.

---

## Red→green mutation proofs (PROMPT A1 criterion 5, plus one bonus)

Each row: source file mutated → command run → **exact failure line pasted** → file reverted via `Edit` → confirmed green again before moving to the next mutation. All five were run sequentially in the worktree; typecheck + full suite reconfirmed green after the last one (see final gate below).

| Guard | Mutation | Failure output (pasted, not paraphrased) | Reverted? |
|---|---|---|---|
| **I1** | `reducer.ts` `MOVE_APPLIED`: grant **10** steps per correct answer, unclamped (an initial `position += 2` attempt did not overshoot `N=2`'s tiny bound and instead tripped I6 first — see note below; 10 was used so I1 itself fails) | `AssertionError: expected 10 to be less than or equal to 2` at `reducer.test.ts:166` (the I1 assertion itself) | Yes |
| **I3** | `reducer.ts` `ANSWER_CHOSEN`: delete the push to `usedQuestionIds` (`usedQuestionIds: state.usedQuestionIds`) | `AssertionError: expected 1 to be 2` at `reducer.test.ts:186` — the **independent** tally built from raw `QUESTION_SHOWN` events (not from `state.usedQuestionIds`, which stayed trivially "unique" at length 0 forever — see note below). Games 1 and 4 also failed with `Game (seed 2) did not finish within 80 steps` (the deck never empties because nothing is ever marked used) | Yes |
| **I6** | `legal.ts` `ANSWER_REVEALED`: `delta: 1` unconditionally (was `delta: correct ? 1 : 0`) | `AssertionError: expected 1 to be +0` at `reducer.test.ts:206` (the I6 assertion itself) | Yes |
| **I7** | `legal.ts` `PROGRESSION_APPLIED`: only pass the turn if the last answer was correct — a wrong answer keeps the same team's turn | `AssertionError: expected 2 to be less than or equal to 1` at `reducer.test.ts:190` (the I7 assertion itself) | Yes |
| **I5** (bonus, not required by A1's list, included because it was cheap) | `reducer.ts` `MOVE_APPLIED`: removed the `if (state.stateId !== 'ANSWER_REVEALED') throw` guard | `AssertionError: expected function to throw an error, but it didn't` at `reducer.test.ts:233` | Yes |

**Two guards caught themselves being blind on the first attempt — recorded here rather than silently fixed and hidden, per the "no self-comparison" rule:**

1. **I1's first mutation attempt** (`position += 2`, i.e. doubling `delta`) did not turn I1 red — with `N=2`, doubling a `delta` of 1 lands exactly on `N` (`0→2`), still in-bounds, so the *first* correct answer never overshoots. It surfaced as an **I6** failure instead (`positions[0]=2` but only 1 real correct answer). This is legitimate red→green evidence for I6, but not for I1 specifically, so the mutation was strengthened to `delta*10` to unambiguously overshoot `N` within the same tiny deck and produce a genuine I1 failure at the I1 assertion line — see the table row above.
2. **I3's first mutation attempt** was checked only against `state.usedQuestionIds` (`Set(state.usedQuestionIds).size === state.usedQuestionIds.length`). Deleting the push to `usedQuestionIds` keeps that array **permanently empty**, and an empty array is trivially "unique" — the check passed even though the same question could now be shown twice, which is a **self-referential blind guard** (checking the mutated field against itself). I added an independent tally built from the raw `QUESTION_SHOWN.questionId` values in the event log (a value untouched by this specific mutation) and re-ran; that is the assertion that actually fails and is now permanently part of the test (`reducer.test.ts:186`).
3. **I6's own tracker had the same class of bug initially**: it derived "was this answer correct" from `MOVE_APPLIED.delta > 0` — exactly the field the "grant a step on a wrong answer" mutation corrupts. Caught before running the mutation (by re-reading the test), fixed to derive correctness from the **preceding `ANSWER_CHOSEN.correct` field** instead, which the delta-mutation never touches. This is the version that produced the clean red result recorded above.

---

## Final gate (after every mutation was reverted)

```
npx tsc --noEmit
# 0 output, exit 0

npx vitest run
[A1 criterion 1] finished=100/100, maxTransitions allowed=60, observed max events=13, avg events=13.00
[A1 criterion 2/3] I1=2600 assertions, I3=1300 assertions, I6=2600 assertions, I7=1300 assertions (all must be > 0)
[A1 criterion 3] I5 checks=3 (all threw and left state unchanged)
[A1 criterion 4] undo fuzz checks=1300 (>= 1000 required), zero failures

 ✓ tests/core/reducer.test.ts (4 tests)
 Test Files  1 passed (1)
      Tests  4 passed (4)
```

**File-ownership check:**
```
git status --porcelain
?? docs/تأسيس-المشروع/تقارير/المنفِّذ/worklog-A1.md
?? src/core/
?? tests/

git diff main -- src/contracts/   → 0 lines (frozen contracts untouched)
```
Nothing outside `src/core/**`, `tests/core/**`, and this report was written. `src/contracts/**`, `src/stage/**`, `src/editor/**`, `src/pack/**`, `vite.config.ts`, `index.html` — untouched (confirmed by `git status`; this worktree never had any of those files modified).

---

## Closing-claims list — final status

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | 100/100 games reach `FINISHED`, ≤60 transitions | **Met** | max 13, avg 13.00 events, printed above |
| 2 | I6 assertion count > 0, printed | **Met** | 2600 |
| 3 | I1, I3, I5, I7 pass counts printed | **Met** | I1=2600, I3=1300, I7=1300, I5=3 |
| 4 | ≥1,000 fuzzed undo sequences, zero failures, incl. `usedQuestionIds`/`rng.drawIndex` | **Met** | 1300 checks, 0 failures |
| 5–8 | Red→green for I1, I3, I6, I7 | **Met** | table above, all reverted, final gate green |
| 9 | I5 mutation (bonus) | **Met** | table above |
| 10 | `tsc --noEmit` 0 errors | **Met** | pasted above |
| 11 | `vitest run` full green | **Met** | pasted above |
| 12 | File ownership respected | **Met** | `git status`/`git diff` pasted above |
| 13 | Port 3010 / cleanup | **Met, trivially** — no server or long-running process was ever started this phase. Pure logic + `vitest run`/`tsc --noEmit` one-shot CLI invocations only. Nothing to kill; no port to free. Worktree `../nouf-wl-a-core` (branch `wl-a-core`) left in place, uncommitted, for the coordinator to inspect/merge |

**Not measured / explicitly deferred to A2–A3 (named, not silently dropped):**

| Item | Why deferred | Owning phase |
|---|---|---|
| ≥10,000-game harness, G1–G7 | PROMPT A1 lists this under "Out of scope... Do not build them now" | A3 |
| G4 first-mover measurement (R-a ≈0.557 vs R-b ≈0.500 at N=10, p=0.7) | Requires R-b, which is explicitly A2 scope; A1's toy deck (N=2, 3 questions) cannot produce this measurement meaningfully | A2/A3 |
| R-b equal-attempts balancing turn, decider/tiebreak, deck bands | Explicitly out of scope for A1 | A2 |
| `docs/بروتوكولات/simulated-playthrough.md` | Explicitly owed only after a real ≥10,000-game harness run (A3), per PROMPT A1's file-ownership note | A3 |
| Double-tap idempotence as a *no-op* (rather than a throw) | I5 requires illegal events to throw; PH-A2's own acceptance criterion #5 ("double-tap consumes one question not two") is where the nuanced no-op-not-throw behaviour is specified and tested | A2 |

---

## Risks / notes for the coordinator

1. **Scope discrepancy** (repeated from the top, for visibility): the dispatch message described this task as including "the simulation harness" and G4 at ≥10,000 games. The literal PROMPT A1 spec excludes both. I built PROMPT A1 exactly. If the intent was actually to fold A2/A3 into this dispatch, that needs a fresh assignment — it is not a small top-up (R-b, deck bands and the harness are substantial pieces of new logic).
2. **Minimal deck-exhaustion resolution (D1)** is new logic beyond the PH-A1 checklist in `خطة.md` (which only lists I1/I3 mutations) but is required for PROMPT A1's own 100/100-games criterion to be achievable given the specified 3-question/N=2 toy deck — see design note D1. It is the smallest possible version (leader wins, tie draws) and does not implement any A2 feature (no balancing turn, no decider, no bands).
3. **Function signatures extend beyond the prose** in PROMPT A1 (`legalEvents(state, ctx)` not `legalEvents(state)`, `selectNextQuestion(state, deck)` not `selectNextQuestion(state)`) because the frozen `GameState` cannot carry the deck or the full event log without violating the freeze — see design note D2. `applyEvent(state, event)` itself stays exactly two arguments.
4. **No dev server, no worktree processes left running.** Everything in this phase is pure TypeScript logic exercised by `vitest`/`tsc` CLI runs; port 3010 was never bound.


