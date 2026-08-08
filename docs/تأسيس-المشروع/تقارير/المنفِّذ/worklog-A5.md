# worklog-A5 — maze redesign (branching maze, route choice, one-stumble rule) + F-2 empty-deck freeze

**Agent:** executor (WL-A core) · **Branch/worktree:** `wl-a-core` at `../nouf-wl-a-core` · **Port:** 3010 (not needed yet — no dev server this stage)
**Spec:** `docs/تأسيس-المشروع/تقارير/game-systems-expert/maze-redesign-2026-08-08.md` (binding, §10) + سجل-القرارات D-24..D-27
**Coordinator re-priority (mid-session):** F-2 (empty-deck freeze) first, then the maze redesign, then harness extension (I11-I15, G8 red proof, G4 asserted test).

Status legend: `[ ]` not started · `[~]` in progress · `[x]` done and verified.

---

## 0. Setup

- [x] Read full context: MEMORY.md project pointers, `المهام.md`, `خطة.md` (WL-A file ownership, PH-A1..A4 already merged), `سجل-القرارات.md` D-24..D-27, the full maze-redesign report, and the design-stage sweep script at the scratchpad path.
- [x] `git merge main` into `../nouf-wl-a-core` (worktree `wl-a-core` branch) — fast-forward `fda8fa0..33e101d`, clean, no conflicts. Picked up B4/D2+D3/A4/resume-screen work already merged to `main`.
- [x] Surveyed current WL-A-owned files: `src/contracts/{state,events,index}.ts`, `src/core/{reducer,legal,rng,select,fold,context,session-store}.ts`, `src/core/rules/{progression,deck-bands}.ts`, `tools/sim/{harness,invariants,policies,deck,run,main}.ts`, `tests/core/**`.
- [x] Confirmed non-WL-A files that read the maze contract today (`src/stage/session/game-driver.ts`, `src/stage/screens/maze-beat.ts`, `src/stage/app.ts`) will need WL-B's own follow-up once these contracts land — flagged, not touched (out of scope, `src/stage/**` is WL-B's).

## 1. F-2 — empty-deck freeze at first TURN_START (priority 1)

### 1.1 Root cause, found by reading (not yet reproduced with a test at time of writing this section)

`GAME_STARTED` (`src/core/reducer.ts`) transitions unconditionally to `stateId: 'TURN_START'`, with **no check on `deck.length`** — there is no such check anywhere before this transition (`legal.ts` never gets a chance to refuse the game start; the event is constructed and applied directly by the caller, per `legal.ts`'s own comment on the `SETUP` case).

`legal.ts`'s `showNextQuestion()`:

```ts
const sel = selectNextQuestion(state, ctx.deck);
if (!sel) {
  if (state.stateId === 'TURN_START') {
    // Structurally unreachable: TURN_PASSED only ever lands on
    // TURN_START when the exhaustion check already ran ...
    return [];
  }
  return [{ type: 'GAME_ENDED', seq, at: now(), outcome: 'draw' }];
}
```

The comment's reasoning is correct for every **mid-game** arrival at `TURN_START` (always via `TURN_PASSED`, always downstream of `progression.ts`'s exhaustion check). It is **false for the very first arrival**, which comes directly from `GAME_STARTED`, never through `progression.ts` at all. If the deck has zero questions when the game starts, `selectNextQuestion` returns `null` on the very first call, `state.stateId === 'TURN_START'` is true, and `legalEvents` returns `[]` **forever** — the reducer has nothing to apply, next, ever. This is a permanent freeze at the first screen. It is a real, reachable path once D-25 ships (no bundled demo deck — a fresh author's first "play" attempt with zero questions written is now the *default* first thing a real user can hit).

Even if that special case were simply deleted (always return the `GAME_ENDED` draw candidate when `sel` is null), the reducer would still reject it: `GAME_ENDED_LEGAL_FROM` in `reducer.ts` is `['PROGRESSION_APPLIED', 'FINAL_BALANCING_TURN', 'TIEBREAK']` — **`TURN_START` is not in that list**, so `applyEvent` would throw `IllegalTransitionError` on the very fix meant to unstick it. Both places need the fix.

### 1.2 Why 27,000 games never caught it

`tools/sim/harness.ts`'s `playGame` (the real driver used by every scenario in `run.ts`) already throws loudly on zero candidates (`No legal events from state ...`) — that path is fine. But `run.ts` has **two additional, hand-rolled game loops that do not go through `playGame`** — S8 (undo fuzz, line 336) and S9 (refresh fuzz, line 388) — and both contain:

```ts
if (candidates.length === 0) break;
```

A silent `break` out of the `while` loop, not a throw. No scenario in `run.ts` ever constructs an empty deck (`generateDeck(0)`), so this line was never *exercised* by the empty-deck case specifically — but it is exactly the kind of guard that would have swallowed this whole class of bug without failing a single assertion, which is the deeper problem: the 27,000-game run's own silence is not evidence of correctness here, it is a gap in what the harness was capable of catching. Fixing the `break`s to `throw` (matching `harness.ts`'s own standard) is part of F-2, done below, plus a dedicated empty-deck scenario added to `run.ts` so this exact bug is now actually exercised at scale, not just by a single unit test.

### 1.3 Fix

- [x] `src/core/legal.ts` — `showNextQuestion`: removed the `TURN_START` special case; `sel === null` now always returns the `GAME_ENDED` draw candidate, from any state.
- [x] `src/core/reducer.ts` — added `'TURN_START'` to `GAME_ENDED_LEGAL_FROM`.
- [x] `tools/sim/run.ts` — S8 and S9's silent `break` on zero candidates replaced with a `throw` (matches `harness.ts`'s existing standard so this class of bug can never again be silently swallowed by a hand-rolled loop).
- [x] New scenario in `run.ts`: **S-EMPTY** — `GAME_STARTED` with a zero-question deck, `N=10`, asserts the game reaches `FINISHED` with `outcome: 'draw'` in exactly one transition (`GAME_STARTED` → `GAME_ENDED`), run for both `firstTeam` values and multiple seeds.
- [x] Regression test `tests/core/empty-deck.test.ts` — red→green proven (see §1.4).

### 1.4 Red→green proof

`tests/core/empty-deck.test.ts` (new file, 3 tests):

**RED** (before the fix, `npx vitest run tests/core/empty-deck.test.ts`):
```
 FAIL  tests/core/empty-deck.test.ts > ... legalEvents returns a candidate from TURN_START
 AssertionError: expected 0 to be greater than 0
 FAIL  tests/core/empty-deck.test.ts > ... reaches FINISHED with outcome draw
 AssertionError: expected 0 to be greater than 0
 Test Files  1 failed (1)
      Tests  2 failed | 1 passed (3)
```

**GREEN** (after `legal.ts` + `reducer.ts` fix):
```
 Test Files  1 passed (1)
      Tests  3 passed (3)
```

Fix applied in two places (both needed — proven by the fact the RED test's second assertion specifically checks `applyEvent` accepts the candidate, not just that `legalEvents` offers one):
1. `src/core/legal.ts`'s `showNextQuestion` — removed the `state.stateId === 'TURN_START' → return []` special case.
2. `src/core/reducer.ts`'s `GAME_ENDED_LEGAL_FROM` — added `'TURN_START'`.
3. `tools/sim/invariants.ts`'s independent I8 reference table (`LEGAL_TRANSITIONS`) — added `'TURN_START'` to `GAME_ENDED`'s allowed sources, so the harness's own independently-hand-written transition table (not copied from `reducer.ts`) still agrees with the fix instead of flagging every S-EMPTY game as an I8 violation.
4. `tools/sim/run.ts` — S8/S9's silent `if (candidates.length === 0) break;` → `throw` (two sites), matching `harness.ts`'s existing standard.
5. `tools/sim/run.ts` — new scenario **S-EMPTY**: 600 games (3 presets × 200 seeds, alternating `firstTeam`), zero-question deck, asserts `FINISHED`/`draw`/exactly 2 events (`GAME_STARTED`, `GAME_ENDED`) for every game. Bypasses `runScenarioGames`'s `checkG1` call deliberately — `maxTransitions = 20 × deckSize` is `0` for an empty deck, which would itself misfire on the *correct* 2-event game (a separate, pre-existing sharp edge in G1's formula for `deckSize=0`, not the bug under test; noted, not fixed — out of scope for F-2).

**Full-scale confirmation**, `npx tsx tools/sim/main.ts` (whole harness, 27,600 games total incl. the new 600 S-EMPTY games):
```
  S-EMPTY: 600 games — F-2 regression: zero-question deck reaches FINISHED/draw at the first TURN_START, never freezes
Overall invariant counts: I1=6167210 I2=3083605 I3=3083605 I4=763560 I6=6167210 I7=3083605 I8=3083605 I9=3083605 I10=3083605
...
Runtime: 56637 ms
```
0 failures, 0 thrown errors — confirms both the fix and that the F-2 class of bug can no longer hide behind a silent `break` in the harness's hand-rolled loops.

Full `npx vitest run` after the fix: **22 files, 106 tests, all passed** (pre-existing suite + the new `empty-deck.test.ts`), confirming no regression on PH-A1–A4's existing acceptance tests.

## 2. Maze redesign (priority 2) — status: contracts + core rules + harness DONE, mutation proofs next

## 3. Contract + core rule changes — DONE

Per §10 of the spec, built literally as specified, no reinterpretation except where noted:

- `src/contracts/state.ts`: deleted `MazeCell`; added `MazeJunction`, `TeamRoute`, `MazeLayout`; `GameState.maze` retyped to `MazeLayout`; added `closedExits: [number[], number[]]` and `wasted: [number, number]`. `positions` keeps its exact name/`0..N` meaning (doc comment updated to `min(N, correct[t] − wasted[t])`).
- `src/contracts/events.ts`: `MoveAppliedEvent.delta` → `exit: number | null`; `GameStartedEvent` gains `mazeGenVersion: number`. No new event types — the 7-member union and I8's transition table are unchanged (plus the F-2 `TURN_START` addition, unrelated to the maze redesign).
- New `src/core/rules/maze.ts`: `MAZE_GEN_VERSION`, `MAZE_STREAM_TAG`, `DECOR_STREAM_TAG`, `EXITS_PER_JUNCTION=3`, `buildMaze(seed, N)`, `availableExits(...)`, `resolveMove(...)`. `buildMaze` derives its own hash stream from `(seed, MAZE_STREAM_TAG, teamIdx, junctionIndex)` for `deadEndExit`, and `(seed, DECOR_STREAM_TAG)` for `decorSeed` — never touches `rng.drawIndex` (M-RNG-1 — verified: G5 determinism, 500 seed pairs, 0 mismatches, unaffected by the redesign since question/shuffle draws are byte-identical).
- `src/core/reducer.ts`: `GAME_STARTED` calls `buildMaze(event.seed, event.N)` (was `buildMaze(N)` with no seed); initialises `closedExits: [[], []]`, `wasted: [0, 0]`. `MOVE_APPLIED` rewritten: `exit === null` or already-at-goal → no-op; else calls `resolveMove` and applies `'advance'` (bump position, clear that team's closedExits) or `'deadEnd'` (push the exit, bump wasted) — the RESULT is never read from the event, only derived.
- `src/core/legal.ts`'s `ANSWER_REVEALED` case: wrong answer or already-at-goal → one `MOVE_APPLIED` candidate with `exit: null`; correct answer → one candidate per `availableExits(...)` (always >= 2, per I12).
- `src/core/rules/progression.ts`: **one change**, the §6.3 amendment — at exhaustion with equal positions, compare `correct[t] = positions[t] + wasted[t]` (exact while `positions[t] < N`, which holds in this branch) before falling through to "سؤال من الحضور". Cases 1–3 (balancing, tiebreak, normal) untouched, as specified.
- `src/core/rules/deck-bands.ts`: `3.34N+4` → `3.34(N+1)+4`; `2N+2` → `2(N+1)+2`; `maxGreenTrackLength` → `floor((D−4)/3.34) − 1`. Verified against the report's own worked table (N=10: green=41, refuse<24) in `tests/core/rules/progression.test.ts`.
- `src/core/session-store.ts`: **M-RESUME-1** implemented — new `ResumeCheck` variant `{ kind: 'refused', reason: 'maze-version-mismatch', storedVersion, currentVersion }`, checked right after the `deckHash` check, before folding. Test added (tamper `mazeGenVersion` only, deckHash still matches, confirm refusal).
- **Not touched** (explicitly out of scope, WL-B-owned): `src/stage/**` (`maze-geometry.ts`, `game-driver.ts`, `maze-beat.ts`) — these files reference the old `MazeCell`/`delta` shapes and **will fail `tsc --noEmit`** until WL-B adapts to the new contract. This is expected fallout, flagged per the coordinator's note ("WL-B... will build the maze rendering against your contracts once they land") and confirmed to be the *only* non-WL-A breakage (`npx tsc --noEmit` shows exactly one error, in `game-driver.ts`, throughout this whole session).

All updated: `tests/core/reducer.test.ts` (I6 → I6′ with independent `wasted` replay against a fresh `buildMaze` call, `mazeGenVersion` added, `delta`→`exit` in the illegal-event fixture), `tests/core/rules/progression.test.ts` (deck-band literals recomputed from the report's own table, G2's literal loosened to a bound — see §4), `tests/core/session-store.test.ts` (M-RESUME-1 test + `mazeGenVersion`), `tests/core/fixtures/session-harness-main.ts`, `tools/sim/harness.ts`'s `startEvent`.

## 4. Harness extension (I11-I15, G8, G4, G9) — DONE, full-scale run below

### 4.1 What was built

- `tools/sim/invariants.ts`: full rewrite. `InvariantCounts` gains I11–I15 (I15 declared but intentionally always 0 — DOM/visual concern, explicitly the visual verifier's per the report, nothing to inspect in a headless run). I6 → **I6′**: independently replays `wasted`/`closedExits` against a **fresh `buildMaze(seed, N)` call**, hand-rolling the one-stumble condition inline rather than calling `resolveMove` — calling the real `resolveMove` here would make I11's mutation (which targets `resolveMove` itself) invisible to this guard, the exact self-referential trap the task called out. New: `checkGeneratorStructure` (G7′ structural: junction counts, `exits>=2`, `deadEndExit∈[-1,exits)`, M-GEN-1 via reference-identity check that no `MazeJunction` object is shared between the two routes — see §4.3 for why "cells" means junction-object-identity at this abstract layer, an interpretation call since the frozen contract has no geometry), `checkG7MoveBound` (<=N+1 real moves per team), `checkNoTheft` (G8 — throws immediately on any theft, not just an aggregate stat).
- `tools/sim/policies.ts`: added `RoutePolicy` type, `uniformRoute` (worst case), `oracleRoute` (never stumbles, reads `state.maze` directly — legitimate, M-SECRET-1 is a DOM constraint not a data-availability one), `avoidLastTried` (deterministic lowest-index baseline), `withRoutePolicy` (combinator), `makeAsymmetricRoutePolicy` (S11).
- `tools/sim/run.ts`: extended, never forked (verified: `grep -c "function apply\|function resolve\|function legal" tools/sim/*.ts` → 0, only imports). Added S10 (= S5 combined with `uniformRoute` — same infra, relabelled), S11 (oracle-vs-uniform asymmetry), S12 (generator sweep, 10,000 seeds × 3 presets × both teams), S13 (extends S8's undo fuzz with an explicit dead-end-discovery undo re-check, asserted to have fired >0 times). G2 rewritten per §11.2 (see finding below). G4 turned into a **real asserted guard** (`throw` if outside `[0.48, 0.52]`), not just a printed number. G9 measured via a new `walkFullRoute` helper (see finding below).
- `tests/core/sim-smoke.test.ts`: extended with fast-vitest-speed coverage of I11–I14, `checkGeneratorStructure`, `checkG7MoveBound`, `checkNoTheft` — so `npm test` (not just the standalone 156-second script) catches a regression in any of these.

### 4.2 Two findings, not tuned away (task's explicit instruction)

1. **S1 no longer reaches TIEBREAK 100% of the time.** Under the old model, `positions === correct` exactly, so two teams with the same policy (`alwaysCorrect`) always finish in lockstep — one reaches N "ahead by one attempt" (owed a balancing turn), the other's balancing attempt then also reaches N, entering TIEBREAK, deterministically at question `2N`. Under the redesign, per-team target length is `N + wasted[t] ∈ {N, N+1}`, generally different between the two teams (~3-4% of games at N=10, since both stumble independently at ~98.3% each). When targets differ, the reducer's own pre-existing "attempts already equal → immediate win" branch (Case 1, `progression.ts`, untouched by this redesign) can resolve the game before ever reaching `FINAL_BALANCING_TURN`/`TIEBREAK`. Measured: **961/1000 S1 games reached TIEBREAK**; the other 39 resolved via immediate win. This is a legitimate new branch usage, not a bug — verified by re-checking **I7/R-b's core promise directly: attempts[A] === attempts[B] at FINISHED held for 1000/1000 S1 games regardless of which branch was taken.** G2's guard is restated per §11.2 as two hand-written-literal bounds (`2N <= q <= 2(N+1)` for games that DO reach TIEBREAK, plus the stumble-rate distribution check on a dedicated 10,000-game sample) rather than the old single literal.
2. **G9 (E[wasted] ≈ 1−(2/3)^N) cannot be measured honestly over full R-b-refereed games.** First attempt (all teams, all games): observed 0.8838 vs expected 0.9122 at N=6 — a ~6-standard-error gap, not noise. Restricting to teams that reached `positions === N` only made it worse (0.8788). Root cause: R-b can end a game before a trailing team completes its route, and a team that stumbled needs **one more attempt** to finish than one that didn't — so "did this team finish in time" is correlated with "did this team stumble" (informative censoring), biasing any full-game sample downward. This is a genuine structural interaction between R-b's ending rule and the new variable-per-team route length, not a bug in either. Fix: added `walkFullRoute(seed, N, team, rand)` — walks ONE team's route in isolation from junction 0 to N using the **real** `buildMaze`/`availableExits`/`resolveMove`, with no R-b turn-taking/ending logic involved at all (which is what the formula actually describes — a team walking its own route, full stop). Result: **N=6: 0.9099 vs 0.9122 · N=10: 0.9824 vs 0.9827 · N=14: 0.9961 vs 0.9966** — all within ±0.01, all real numbers from a real run below.

### 4.3 One interpretation call, declared

The frozen contract (§10.1 of the spec) gives `MazeJunction`/`TeamRoute`/`MazeLayout` no geometry at all — no cell coordinates, nothing physical. M-GEN-1's "cells(route A) ∩ cells(route B) = {goalCell}" and G7′'s matching structural assertion are literally about rendering geometry, which is explicitly routed to `rtl-stage-ux-expert`/WL-B (`src/stage/maze-geometry.ts`). At the abstract WL-A layer there is no "cell" to intersect. I operationalised this as: **no `MazeJunction` object is ever shared by reference between `routes[0]` and `routes[1]`** — `buildMaze` always allocates two fresh, disjoint arrays of fresh object literals, so this holds trivially by construction (mirroring how Theorem 1 is "discharged by construction, not per-seed BFS"), and the mutation test (aliasing a junction across routes) is a meaningful, cheap thing to check at this layer. The "goal" itself isn't a `MazeJunction` at all — it's reached one step past a route's last index — so nothing in the type ever represents it as a shared, indexable object; the convergence is a rendering-layer fact for WL-B to realise, not something WL-A's abstract data can violate.

### 4.4 `route-model-unsimulated` ship gate — closed (actually run, not restated)

The report declared this gate explicitly ("§12's script exists but has not been run... a ship gate, not a nicety") and named it my job to close. Ran both required variants:

**As-written (Finalist A, scattered `d` dead ends, no cap)** — `npx tsx <scratchpad>/maze-model-sim.ts`, N=10, p=0.7, `d=3`, n=20,000:
```
split d=3    P(first)=0.4973  P(theft)=0.0341  P(tb)=0.106  E[W]=0.92  sd[W]=0.78  Qmean=28.8  Qp95=38  Qmax=64
```
`P(theft)=0.0341` — strictly > 0 and <= the report's proved bound 0.187. Matches §5.4's table (predicted proved-bound at d=3: 0.1866; the heuristic *estimate* was ~0.06, always labelled separately from the proved bound in the report — the measured 0.0341 sits under both, consistent).

**One-stumble cap** (the report's own instruction: "adding the one-stumble cap is a one-line change — the `canWaste` condition gains `&& wasted[cur] === 0`. Run both.") — applied that exact one-line change in a new file, `maze-model-sim-onestumble.ts` (same scratchpad dir), `d=N=10` (every junction nominally has a trap, matching the real `buildMaze` — the cap, not the trap count, is what changed), n=20,000:
```
P(first team wins)=0.4939   (expect 0.500 +/- 0.02)   -> PASS
P(theft)=0.0000             (expect exactly 0.0000)   -> PASS
E[wasted] per team=0.9741   (expect 0.983 +/- 0.01)   -> PASS (diff 0.0089)
max moves per team=11       (expect <= 11 = N+1)      -> PASS
```
All four of §12's predicted values reproduced by an actual run. `route-model-unsimulated` is closed. (Note: this design-stage model is explicitly *not* evidence about the shipped rules per the report's own caveat — §4.4's real evidence, from the actual reducer via `tools/sim/`, is what §4.1/§4.4 above and §5 below are built on.)

## 5. Red→green mutation log (consolidated) — ALL DONE

Every mutation below was applied to the real source, run, confirmed RED with real error output, then reverted and confirmed GREEN again (full `npx vitest run` = 23 files / 119 tests passing after every single revert — verified after each one, not just at the end). No mutation marker (`grep MUTATION-`) remains in `src/`.

| Guard | Mutation applied | RED evidence (real output) |
|---|---|---|
| F-2 (legal.ts) | `TURN_START` special case returns `[]` | `tests/core/empty-deck.test.ts`: 2/3 failed, `expected 0 to be greater than 0` |
| F-2 (reducer.ts `GAME_ENDED_LEGAL_FROM`) | `TURN_START` omitted | same test file, second assertion (`applyEvent` throw) |
| I6′ | `deadEnd` branch in `reducer.ts` also bumps `positions` | `reducer.test.ts` + `sim-smoke.test.ts`: `I6' violated (positions=0,2, expected=0,1, seed 1)` |
| I11 | Deleted `&& wasted === 0` in `resolveMove` | `maze.test.ts`, `sim-smoke.test.ts` (I6′, G7′ move bound, **G8 theft** all fired): `G8 VIOLATED (theft): seed 1 winner correct=13 < loser correct=14` |
| I12(a) | `reducer.ts` deadEnd branch pushes the same exit twice into `closedExits` | `sim-smoke.test.ts`: `I12 violated: closedExits has a duplicate (1,1, seed 1)` |
| I12(b)/G7′ | `buildMaze` emits `deadEndExit = EXITS_PER_JUNCTION` (out of range) — the closest analog to "two dead ends" given the frozen contract's single scalar field | `maze.test.ts` + `sim-smoke.test.ts`: `G7' violated: seed 1 team A junction 0 deadEndExit=3 out of [-1,3)` |
| G7′ (M-GEN-1) | `buildMaze` aliases `routes[1].junctions[0] = routes[0].junctions[0]` | `maze.test.ts` + `sim-smoke.test.ts`: `G7'/M-GEN-1 violated: seed 1 routes share a junction object at index 0` |
| G7′ (zero-exits) | `buildMaze` sets `junction 0` of every route to `exits: 0` | Fails loudly, not hangs, per spec: `No legal events from state ANSWER_REVEALED (seed 1)` (17 tests across the whole suite failed this way) + `checkGeneratorStructure`: `G7' violated: seed 1 team A junction 0 exits=0 < 2` |
| I13 | `availableExits` filter (`!closedExits.includes(e)`) disabled | `sim-smoke.test.ts`: `I13 violated: MOVE_APPLIED.exit=0 illegal at junction 1 (closedExits=0, seed 2)` |
| I14 | `decorSeed` computed with `MAZE_STREAM_TAG` instead of `DECOR_STREAM_TAG` | `maze.test.ts`'s dedicated tag-selection test: `expect(buildMaze(seed,10).decorSeed).toBe(expected)` fails |
| I15 | N/A — declared out of scope (DOM/visual concern, the report attributes it to the visual verifier; nothing to inspect in a headless harness) | not applicable, documented not silently skipped |
| G6 | `undo()` in `fold.ts` overrides the re-folded `wasted` with the PRE-undo value ("the exact field a hand-written undo forgets") | `reducer.test.ts`, `progression.test.ts`, `sim-smoke.test.ts` all failed on `wasted` mismatch in the JSON diff |
| G8 (Finalist A, the named mutation) | `buildMaze`: `d=3` scattered dead ends (first 3 junctions only, `-1` elsewhere) **+** `resolveMove`: cap removed | `sim-smoke.test.ts`: `G8 VIOLATED (theft): seed 7 winner correct=10 < loser correct=11` — matches the report's own §5.4 prediction (proved bound at d=3: <= 0.1866; design-stage script measured 0.0341, strictly > 0, well inside the bound) |
| G9 | `EXITS_PER_JUNCTION` changed 3 → 4, expected value (`1-(2/3)^N`) left unchanged | Dedicated script (`g9-mutation-check.ts`) at N=10: `observed=0.9433 expected(old formula)=0.9827 diff=0.0394 violates_tolerance=true` |
| G4 | `progression.ts` Case 1: unconditionally routes an extra `TURN_PASSED` to `state.firstTeam` whenever they didn't just move, even when attempts are already equal | `progression.test.ts`'s I7 test failed (`expected 199 to be 200`); dedicated script (`g4-mutation-check.ts`) at N=10,p=0.7,n=3000: `P(first team wins) = 0.5447` — clearly outside `[0.48, 0.52]` |

**Blind-guard self-check (v3 §4 rule 2's spirit, applied explicitly to the two highest-risk guards):** I6′ and G8 both use *independent* replay logic (fresh `buildMaze` call, hand-rolled one-stumble condition inline in `invariants.ts` — never calling the real `resolveMove`). Proof this actually matters: the I11 mutation (deleting `&& wasted === 0` inside `resolveMove`) made **both** I6′ and G8 fire, which would have been impossible if `checkGameInvariants`/`checkNoTheft` had called the mutated `resolveMove` themselves instead of re-deriving the same condition independently.

## 6. Full test run / typecheck output — FINAL

- `npx tsc --noEmit`: **exactly one error**, in `src/stage/session/game-driver.ts` (WL-B-owned, missing `mazeGenVersion` on its own `GAME_STARTED` literal) — expected fallout, not touched, see §7.
- `npx vitest run`: **23 test files, 119 tests, all passed.**
- `npx tsx tools/sim/main.ts` (full standalone harness, `NODE_OPTIONS=--max-old-space-size=6144` — see §7 for why): **72,600 games total**, runtime **156,010 ms**. Full output:

```
=== PH-A3 simulation report ===
Total games: 72600
  S1: 1000 games — both teams always correct
  G2-dedicated: 10000 games — dedicated large sample for the G2 stumble-rate measurement (N=10, always correct, uniformRoute)
  S2: 1000 games — both teams always wrong
  S3: 1000 games — A always correct, B always wrong
  S4: 1000 games — strict alternating correct/wrong per team
  S5/S10(p=0.1..0.9): 1000 games each — uniform random correctness, uniformRoute (worst case)
  S11: 5000 games — oracleRoute (A) vs uniformRoute (B) — maximum route-luck asymmetry, p=0.7 both teams
  S12: 30000 games — generator sweep: 10,000 seeds x 3 presets, G7' structural assertions
  G4-dedicated: 10000 games — dedicated large sample for the G4 first-mover measurement (N=10, p=0.7, uniformRoute)
  S6: 1000 games — tie-forcing (both always correct, fresh seeds, uniformRoute)
  S7: 1000 games — adversarial max-length (always wrong until exhaustion)
  S-EMPTY: 600 games — F-2 regression
  S8/S13: 1000 games — undo fuzz + dead-end wasted/closedExits restoration
  S9: 1000 games — refresh fuzz
Overall invariant counts: I1=10776482 I2=5388241 I3=5388241 I4=1333790 I6=21552964 I7=5388241 I8=5388241 I9=5388241 I10=5388241
G2: S1 reached TIEBREAK in 961/1000 games (bounds [2N,2(N+1)] held for all); resolved without TIEBREAK in 39 — a legitimate new branch. I7 equal-attempts-at-FINISHED: 1000/1000. Stumble rate: observed=0.9820 vs expected 0.9827
G3: checked 1000 S2 games, all DECK_EXHAUSTED-equivalent with positions [0,0] and outcome=draw
G4 (N=10, p=0.7), small sample n=1000: P(first team wins) under R-b = 0.5510
G4 (N=10, p=0.7), large sample n=10000: P(first team wins) under R-b = 0.4987 — IN [0.48,0.52]: true
G5: 500 seed pairs compared, 0 mismatches
G6: 100000 undo-fuzz checks, 0 failures
S13: 1110 dead-end-discovery undo checks, all restored wasted+closedExits correctly
S12/G7': 30000 generator-structure checks, 0 violations
G9 (N=6): observed=0.9099 vs expected=0.9122
G9 (N=10): observed=0.9824 vs expected=0.9827
G9 (N=14): observed=0.9961 vs expected=0.9966
S11: P(A wins, oracle vs uniform)=0.6478 — honest cost of route luck; G8 still 0 across this sample
S9/I10: 100000 refresh-fuzz checks, 0 mismatches
Runtime: 156010 ms
```

**The two numbers the task explicitly demanded be measured, not restated:**
- **`P(theft) = 0`**: held across the ENTIRE 72,600-game corpus (`checkNoTheft` runs on every single game via `runScenarioGames`, throws on first violation, never threw in the final run) — including S11's maximum-asymmetry scenario (oracle vs. worst-case uniform) and every answer-policy variant (always-correct, always-wrong, alternating, blowout, uniform-random at 9 different p values). Proven non-blind by the I11 and G8/Finalist-A mutations above.
- **`P(first team wins) = 0.4987`** at N=10, p=0.7, n=10,000 (dedicated sample) — **inside [0.48, 0.52]**, reproducing the pre-redesign 0.4996 result under the new model, as the report demanded ("must be re-measured, not assumed"). The 1,000-game slice (0.5510) is reported alongside it unedited, continuing the same instability-is-visible-evidence discipline the A3 harness established.

## 7. Debts, hand-offs, out-of-scope notes

### 7.1 Expected out-of-scope breakage (not fixed, by file ownership)

`npx tsc --noEmit` on the full worktree shows exactly **one** error, throughout this entire session, in `src/stage/session/game-driver.ts` (missing `mazeGenVersion` on its own `GAME_STARTED` construction). `src/stage/**` is WL-B's exclusively (خطة.md's file-ownership table). Also affected but not (yet) surfaced by `tsc` because they weren't re-typechecked in isolation: `src/stage/maze-geometry.ts` (explicitly named in the report as "Replaced... Rendering geometry is `rtl-stage-ux-expert`'s to redesign") and `src/stage/screens/maze-beat.ts` (references `MOVE_APPLIED` events, will need the `exit`-shaped candidates instead of `delta`). **Not touched.** The coordinator's brief anticipated this ("WL-B... will build the maze rendering against your contracts once they land").

### 7.2 Hand-offs named explicitly by the report, still open

| Item | Owner | Status |
|---|---|---|
| Three-register rendering (travelled/adjacent/distant), decorative maze texture, two team colours (T-1…T-5), mouth chips (R-1…R-4), M-SECRET-1's DOM check (I15) | `rtl-stage-ux-expert` / WL-B | Not started — outside this scope |
| Arabic copy acceptance for «باقي مساركم سالك» and the §6.3 exhaustion win staging | `play-experience-advisor` | Not started — outside this scope |
| Bundle size of a per-game generated decorative maze | `static-delivery-expert` | Not started — outside this scope |
| `demo-deck.ts` review against the no-sample-questions ruling (D-25) | coordinator → `scope-advisor` | Not started — explicitly the report's own "not mine to decide" |

### 7.3 Interpretation calls I made, declared (not silently decided)

1. **"Cells" at the abstract WL-A layer (§4.3 above).** No geometry exists in the frozen contract; operationalised M-GEN-1/G7′'s "cells(A) ∩ cells(B) = {goal}" as reference-identity of `MazeJunction` objects (never aliased across routes) — cheap, meaningful, and matches Theorem 1's "discharged by construction" spirit. Real geometric non-overlap is WL-B's rendering-layer responsibility to realise from this abstract, non-overlapping data.
2. **I14's stream-independence test reimplements the hash-mixing function.** Declared explicitly in the test's own comment: this is testing *which tag constant* `buildMaze` uses for `decorSeed`, not re-verifying the mixing math itself (the mixing function is my own implementation choice, not specified by the report) — a duplicate-but-narrowly-scoped check, not a blind self-comparison.
3. **`avoidLastTried` route policy** — the report names it as one of three `routePolicy` dimension values without specifying its algorithm. Implemented as a deterministic lowest-available-exit-index policy: a distinct, non-random baseline. Not exercised by any specific numbered scenario in this pass (S10/S11 use `uniformRoute`/`oracleRoute`); available for future use.
4. **G9's measurement method (`walkFullRoute`, isolated from R-b)** — see §4.2 finding 2. This is a real methodological decision, not just an interpretation of ambiguous wording; documented at length because a future reader re-deriving G9 from scratch would plausibly make the same "measure over full games" mistake I did first.

### 7.4 Closing-claims verification (v3 §4 rule 1, done retroactively — this task started under time pressure from an account-limit interruption, see the coordinator's resume message; the gate is still discharged, not skipped)

| Claim | Measured evidence |
|---|---|
| F-2 fixed | `tests/core/empty-deck.test.ts` red→green (§1.4); 600-game `S-EMPTY` scenario in the full harness, 0 failures |
| Contract matches §10.1/§10.2 literally | Read side-by-side against `src/contracts/state.ts`/`events.ts`; `npx tsc --noEmit` — 0 errors in any WL-A file |
| `positions` name/meaning preserved | `progression.ts`'s `>= N` comparisons untouched (diff-reviewed); I6′ test proves the formula holds |
| Move result derived, never stored | `MoveAppliedEvent` has only `exit`; `resolveMove` is the sole place `'advance'`/`'deadEnd'` is computed — grep confirms no other `deadEndExit ===` comparison exists outside `maze.ts` |
| Generator: seeded, one-stumble, two entries, disjoint regions, one goal, ≤N+1 moves | Theorem 1 test in `maze.test.ts` (500 seeds × 2 teams); `checkG7MoveBound` on 72,600 real games, 0 violations; `checkGeneratorStructure` on 30,000 seed×preset×team combinations, 0 violations |
| `legalEvents` emits one candidate per exit; progression's one change | Code diff-reviewed against §10.4's table; `tests/core/rules/progression.test.ts` passing |
| Deck bands `3.34(N+1)+4` / `2(N+1)+2` | `tests/core/rules/progression.test.ts`'s literal table (D=23,24,40,41 at N=10), matching the report's own §9 worked numbers exactly |
| Harness extended, not forked | `grep -rn "function applyEvent\|function resolveMove\|function legalEvents" tools/sim/` → 0 matches (only imports) |
| I11–I15 implemented, I15 declared N/A with reason | `tools/sim/invariants.ts`; §5's mutation table |
| **`P(theft) = 0`, not blind** | 72,600-game corpus, 0 violations; G8 proven non-blind by 3 independent mutations (I11's cap removal, the exact Finalist-A d=3 mutation, and indirectly by every other red guard sharing its replay logic) |
| **`P(first team wins)` re-measured** | 0.4987 at n=10,000 (§6), inside [0.48,0.52], now a real `throw`-backed guard, not a printed number |
| A3's equal-attempts result re-run | 1000/1000 S1 games, 100% equal attempts at FINISHED (§4.2 finding 1) — **survives**, explicitly re-verified, not assumed |
| Route-model-unsimulated gate closed | §4.4 — both script variants actually run, all 4 predicted numbers reproduced |
| Every new guard red→green | §5's table — all 14 rows, real command output for each |

### 7.5 Debts NOT discharged (named, not hidden)

- `stumble-beat-frequency-unmeasured-live` (report's own debt) — still open, needs a real majlis, not a simulation.
- `route-tap-target-unverified` (report's own debt) — WL-B/visual verifier's, still open.
- I15 — genuinely not WL-A's to discharge; the report itself says so.
- G9's relationship to R-b (see §7.2 protocol note) — not measured, and I now believe it may not be cleanly measurable without either censoring bias or abandoning "a full game" as the unit of measurement; flagged rather than forced.
