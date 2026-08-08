# بروتوكول: مِشْحَنة المحاكاة (Simulated Playthrough)

**المالك:** WL-A (النواة) · **تاريخ الكتابة:** 2026-08-07، بعد أول تشغيل حقيقي للمِشْحَنة (PH-A3) — لا قبل ذلك (v3 §8).
**محدَّث:** 2026-08-08 (PH-A5, maze redesign — branching maze, one-stumble rule, I11–I15, G7′/G8/G9, route policies). كل رقم في هذا التحديث ملصوق من تشغيل حقيقي `npx tsx tools/sim/main.ts` بعد الإعادة، لا قبلها.
**اللغة:** إنجليزية للتفاصيل التقنية (جمهورها الوكلاء)؛ هذا السطر فقط عربي للفهرسة.

**Debts discharged:** `simulated-playthrough-protocol-owed` (original, PH-A3) and its A5 re-open (game-systems-expert 2026-08-08 §11.6: "now overdue — the harness exists and has run... must be written by whoever runs the extended harness, with real output pasted in").

---

## What this protocol is

How to run, extend, and interpret the ≥10,000-game simulation harness (`tools/sim/**`) that proves the rule engine (`src/core/**`) is correct across scenarios S1–S13, invariants I1–I15, and per-game assertions G1–G9 — including the first-mover fairness measurement (G4, D-09.7) and the branching-maze redesign's headline zero-theft proof (G8, "the acceptance test of this entire redesign" per game-systems-expert 2026-08-08).

## How to run it

```
cd <worktree>
npx tsc --noEmit                 # typecheck first — the harness imports src/core directly
npx vitest run tests/core/sim-smoke.test.ts     # fast (~1s) subset, for iterating
npx vitest run tests/core/rules/maze.test.ts    # fast, generator-focused unit tests (purity, M-GEN-1, I14 tag-selection)
$env:NODE_OPTIONS="--max-old-space-size=6144"   # PowerShell; REQUIRED since PH-A5 — see the trap below
npx tsx tools/sim/main.ts                       # the full run, prints the report below
Remove-Item Env:\NODE_OPTIONS
```

There is no build step required — `tsx` transforms TypeScript on the fly (the project switched from `vite-node` to `tsx` between PH-A3 and PH-A5; both work the same way for this purpose, `tsx` is what `package.json`'s devDependencies actually carry). No dev server, no port, is involved; this is pure CLI logic.

**Trap, found while running this at A5 scale (record it so nobody re-discovers it the hard way):** the corpus grew from 27,000 games (PH-A3) to 72,600 (PH-A5 — new S10–S13, S12's 30,000-seed generator sweep, a dedicated 10,000-game G2 sample, a 5,000-game S11 asymmetry sample). Running with Node's default heap (~2 GB old-space) reliably **crashes with `FATAL ERROR: Ineffective mark-compacts near heap limit — JavaScript heap out of memory`** partway through, because `runSimulation()` is one long-lived function and every scenario's full `PlayResult[]` (complete event+state history per game) stays reachable — and therefore un-collectable — until the function returns at the very end. `NODE_OPTIONS=--max-old-space-size=6144` (6 GB) is what the run below actually used; a smaller bump may work but was not the one measured.

## Non-negotiable properties of this harness (why the numbers below are trustworthy)

1. **`tools/sim` imports the real `applyEvent`, `legalEvents`, `fold`, `undo`, `commit` from `src/core` — never a copy.** Verified by grep (zero rule-shaped code — position/attempts mutation, delta/clamp arithmetic — found inside `tools/sim`; see `worklog-A3.md` for the exact grep commands and their zero-match output).
2. **Every game is seeded**, and a failing game would print its seed, policy and full event log for exact replay (the harness throws with the seed embedded in every error message it raises).
3. **Player policies (`tools/sim/policies.ts`) only pick among candidates `legalEvents` already returned.** They never decide a state transition, compute a delta, or touch `usedQuestionIds`/`rng` — that logic lives exclusively in `src/core`.
4. **Invariant checks (`tools/sim/invariants.ts`) are independently derived from the event log**, not by re-reading the same field a plausible mutation would corrupt. In particular: I6′ ("`positions[t] === min(N, correct[t] − wasted[t])`") tallies `correct` from `ANSWER_CHOSEN.correct` and replays `wasted`/`closedExits` against a **freshly-rebuilt `buildMaze(seed, N)` call, hand-rolling the one-stumble condition inline rather than calling the real `resolveMove`** — a lesson learned the hard way during A1 (see `worklog-A1.md`'s "two guards caught themselves being blind" note) and re-applied at A5: calling the real `resolveMove` inside the invariant would make it blind to a bug IN `resolveMove` itself (proven concretely — see the mutation log in `worklog-A5.md` §5: deleting `resolveMove`'s `&& wasted === 0` clause makes BOTH I6′ and G8 fire, which would be structurally impossible if either called the mutated function itself).

## Scenarios (S1–S13) and what each proves

| # | Policy | Games this run | Deck | N | What it proves |
|---|---|---|---|---|---|
| S1 | Both teams always correct, `uniformRoute` | 1,000 | D=40 | 10 | The tiebreak path; see the A5 finding below (no longer 100% reach TIEBREAK) |
| G2-dedicated | Both teams always correct, `uniformRoute` | 10,000 | D=40 | 10 | G2's stumble-rate distribution check (dedicated — S1's 1,000 is not stable enough for this stochastic stat) |
| S2 | Both teams always wrong | 1,000 | D=15 | 10 | G3: deck-exhaustion path, positions [0,0] |
| S3 | A always correct, B always wrong, `uniformRoute` | 1,000 | D=30 | 10 | Maximum blowout; win detection at the extreme |
| S4 | Strict alternating correct/wrong, per team, `uniformRoute` | 1,000 | D=40 | 10 | Turn-swap correctness under a regular pattern |
| S5/S10 | Uniform random at p ∈ {0.1…0.9}, `uniformRoute` (worst case) | 9 × 1,000 = 9,000 | D=40 | 10 | Fairness distribution; the empirical P(first team wins); S10 IS S5 once combined with `uniformRoute` — same infra |
| S11 | `oracleRoute` (team A, never stumbles) vs `uniformRoute` (team B, worst case) | 5,000 | D=40 | 10 | Maximum possible route-luck asymmetry — honest cost report, NOT a fairness violation (G8 still checked, still 0) |
| S12 | No gameplay — generator sweep | 30,000 (10,000 seeds × 3 presets) | — | 6/10/14 | G7′ structural assertions: junction counts, exit ranges, M-GEN-1 (no shared junction objects) |
| G4-dedicated | Uniform random p=0.7, `uniformRoute` | 10,000 | D=40 | 10 | Dedicated large sample for the G4 headline figure — now a REAL asserted guard (throws outside [0.48,0.52]), re-measured under the new maze model |
| S6 | Tie-forcing (always correct, fresh seeds, `uniformRoute`) | 1,000 | D=40 | 10 | The tiebreak state and the `draw` outcome path — loosened assertion (≥90%, see finding below) |
| S7 | Adversarial max-length (always wrong) | 1,000 | D=50 | 14 | Termination bound (G1), stressed at the largest preset |
| S8/S13 | Undo fuzz (random legal events + undo at every step; dead-end discovery undo explicitly re-checked) | 1,000 | D=25 | 10 | Undo correctness incl. `closedExits`/`wasted` restoration (G6, extended) |
| S9 | Refresh fuzz (serialize+deserialize every step) | 1,000 | D=25 | 10 | Persistence round-trip; resume matches an uninterrupted run |
| S-EMPTY | Zero-question deck | 600 (3 presets × 200 seeds) | D=0 | 6/10/14 | F-2 regression: reaches FINISHED/draw at the first TURN_START, never freezes |

**G9** (E[wasted] per team vs. `1-(2/3)^N`, all 3 presets) is measured OUTSIDE the game-playing scenarios above, by `walkFullRoute` — see the finding below for why.

**Total this run: 72,600 games** (up from PH-A3's 27,000 — see the runtime/heap note above for what that costs).

## Real output (`npx tsx tools/sim/main.ts`, 2026-08-08, PH-A5)

```
=== PH-A3 simulation report ===
Total games: 72600
Overall invariant counts: I1=10776482 I2=5388241 I3=5388241 I4=1333790 I6=21552964 I7=5388241 I8=5388241 I9=5388241 I10=5388241
G2: S1 reached TIEBREAK in 961/1000 games (bounds [2N,2(N+1)] held for all); resolved without TIEBREAK (equal-attempts immediate win) in 39 — a legitimate new branch, not a bug. I7 equal-attempts-at-FINISHED: 1000/1000 (must be 100%). Stumble rate (G2-dedicated, n=10000x2 team-samples): observed=0.9820 vs expected 1-(2/3)^N=0.9827
G3: checked 1000 S2 games, all DECK_EXHAUSTED-equivalent with positions [0,0] and outcome=draw
G4 (N=10, p=0.7), small sample n=1000: P(first team wins) under R-b = 0.5510 | under R-a (comparison) = 0.6040 | P(draw) = 0.0130
G4 (N=10, p=0.7), large sample n=10000: P(first team wins) under R-b = 0.4987 | under R-a (comparison) = 0.5610 | P(draw) = 0.0148
G4 analytic prediction: R-b ≈ 0.500, R-a ≈ 0.557 (N=10, p=0.7) — large-sample R-b in [0.48,0.52]: true
G5: 500 seed pairs compared, 0 mismatches
G6: 100000 undo-fuzz checks, 0 failures
S13: 1110 dead-end-discovery undo checks, all restored wasted+closedExits correctly
S12/G7': 30000 generator-structure checks (seeds x presets x both teams), 0 violations
G9 (N=6): E[wasted] (walkFullRoute, n=20000) observed=0.9099 vs expected 1-(2/3)^N=0.9122
G9 (N=10): E[wasted] (walkFullRoute, n=20000) observed=0.9824 vs expected 1-(2/3)^N=0.9827
G9 (N=14): E[wasted] (walkFullRoute, n=20000) observed=0.9961 vs expected 1-(2/3)^N=0.9966
S11: oracleRoute(A) vs uniformRoute(B), p=0.7 both — P(A wins)=0.6478 (honest cost of route luck; G8 still 0 across this sample, checked per-game)
S9/I10: 100000 refresh-fuzz checks, 0 mismatches
Runtime: 156010 ms
```

**G8 (`P(theft) = 0`) is not printed as a line item because it is a per-game guard (`checkNoTheft`) that runs on EVERY one of the 72,600 games via `runScenarioGames` and throws immediately on the first violation — it never threw. This is the redesign's headline result: real-money proof, not a restated theorem.** This run reproduced an earlier same-session run's numbers exactly (same seeds ⇒ deterministic), which is itself corroborating live evidence for G5 beyond the harness's own 500-pair internal check.

## Two findings from the A5 run (kept visible, not tuned away)

1. **S1 no longer reaches TIEBREAK 100% of the time (961/1000).** Under the old congruent-corridor model, `positions === correct` exactly, so two same-policy teams always finish in exact lockstep, entering TIEBREAK deterministically at question `2N`. Under the branching-maze redesign, each team's target length is `N + wasted[t] ∈ {N, N+1}` — usually equal (both stumble at ~98.3% each), but when they differ (~3-4% of games), the reducer's pre-existing "attempts already equal → immediate win" branch (unchanged by this redesign) can resolve the game before TIEBREAK is ever reached. **Re-verified directly, not assumed:** `attempts[A] === attempts[B]` at FINISHED held for **1000/1000** S1 games regardless of which branch fired — R-b's core promise survives.
2. **G9 cannot be measured honestly over full R-b-refereed games.** A first attempt (all games, then restricted to `positions[t] === N` only) gave 0.8838 and 0.8788 respectively at N=6 — both several standard errors below the theoretical 0.9122, because R-b can end a game before a trailing team completes its route, and a stumbled team needs ONE MORE attempt to finish than one that didn't (informative censoring). `walkFullRoute` (real `buildMaze`/`availableExits`/`resolveMove`, no R-b turn-taking involved) is the honest measurement: **0.9099 vs 0.9122 at N=6.**

## Route policies (new at A5) — `tools/sim/policies.ts`

`uniformRoute` (picks uniformly among available exits — the worst case every fairness claim, especially G8, is asserted against), `oracleRoute` (never stumbles while it can avoid it — reads `state.maze` directly; legitimate, since M-SECRET-1 is a DOM/UI constraint on what the screen shows, not a data-availability constraint on a simulation policy), `avoidLastTried` (a deterministic lowest-index baseline), and the `withRoutePolicy`/`makeAsymmetricRoutePolicy` combinators that let a scenario declare an answer-policy and a route-policy independently.

## G4 — the fairness measurement, and the sample-size finding

**PH-A5 re-measurement under the new maze model (n=10,000):** P(first team wins) under R-b = **0.4987** — reproduces the PH-A3 figure below, as game-systems-expert 2026-08-08 §5.3 required ("must be re-measured — the 0.4996 result must be reproduced, not assumed"). G4 is now a real asserted guard in `run.ts` (throws if outside [0.48, 0.52]), not just a printed number.

**PH-A3 original headline (n=10,000, seeds 20001–30000), kept for the historical record:** P(first team wins) under R-b = **0.4996** (within the required [0.48, 0.52]); under R-a comparison (post-hoc, see method below) = **0.5652** — close to the analytic ≈0.557 prediction (game-rules-and-maze-investigation.md §5.2).

**A real finding, not a footnote:** the same measurement at **n=1,000 gave 0.5730** — outside the analytic range and looking, at first glance, like a bug or a real deviation. It is neither. Re-running at n=2,000 gave 0.4910; repeated n=10,000 runs gave 0.4946–0.4996. **The statistic converges to ≈0.50 as the sample grows; 1,000 games, despite satisfying the formal "≥1,000 per scenario" floor, is not always a stable sample for this specific measurement.** The reason: at p=0.7, N=10, a game's resolution path is a mixture of roughly 44% "reaches N with attempts already equal" (no balancing turn needed), 44% "resolved via one balancing turn", 11% "resolved via a decisive tiebreak pair", and ~1% "exhausted the deck". Each path has a different (and not individually 50/50) contribution to who wins, so the aggregate statistic has higher variance than a naive independent-Bernoulli-trials estimate would suggest. **Recommendation for future re-measurement of this or a similarly composite statistic: use n≥10,000 for the specific number being reported, even where the general "≥1,000 per scenario" rule is satisfied.**

**Method for the R-a comparison figure (documented so it is never mistaken for a competing rule engine):** R-a was never implemented in `src/core` (only R-b — A2's deliverable — exists). R-a and R-b play out **identically** up to the moment either team's position first reaches N; R-b's extra machinery (balancing turn, tiebreak) only ever fires after that moment. So the R-a figure is a **pure post-hoc observation** over the real, already-played R-b event log: scan the real `states` array for the first index where either position reaches N, and that team is who would have won immediately under R-a. If neither team ever reaches N (pure deck exhaustion), R-a and R-b never diverge for that game and the real outcome is used for both. No delta arithmetic, no turn logic, no win-check re-derivation — confirmed by the grep evidence above.

## Red→green mutations proven during this phase

- **PH-A3:** see `docs/تأسيس-المشروع/تقارير/المنفِّذ/worklog-A3.md` for the full table (10 required by game-systems-expert §7.5: I1, I3, I5, I6, I7, I9, G1, G5, G6, G7).
- **PH-A5 (maze redesign):** see `docs/تأسيس-المشروع/تقارير/المنفِّذ/worklog-A5.md` §5 for the full table — F-2 (2), I6′, I11, I12 (×2), I13, I14, G6, G7′ (×3), **G8 (the exact Finalist-A mutation the report names as "the important one")**, G9, G4. Every one applied to the real source, confirmed red with real error output, reverted, confirmed green (`npx vitest run` back to 23/119 passing) before moving to the next.

## Known limitations / named debts carried forward

- **`DECK_EXHAUSTED` is never a literally-visited fold snapshot.** No event exists in the frozen 7-member `GameEvent` union to transition into it distinctly from `PROGRESSION_APPLIED`; the decision (leader-wins vs. the three-button "سؤال من الحضور" choice) is computed exactly at `PROGRESSION_APPLIED`, immediately followed by `GAME_ENDED`. This is a deliberate, documented design choice (see `worklog-A1.md`/`worklog-A2.md`), not an oversight.
- **The "سؤال من الحضور" simulation convention (pick `draw`) is a harness convention, not a rule** — the real app offers the operator all three choices; simulation has no room to ask, so it picks the neutral one. See `worklog-A3.md`'s design note.
- **Runtime is 97–235 seconds at PH-A3's 27,000 games, and 156 seconds at PH-A5's 72,600 games** — over the original 60-second target in every measurement so far. The harness is single-threaded, unoptimized, and runs via on-the-fly TypeScript transform rather than a compiled build. This is a real cost of the corpus size (driven by the dedicated 10,000-game G2/G4 stability runs, the 30,000-check S12 generator sweep, and S11's 5,000-game asymmetry sample), not a correctness concern — every game still completed and every invariant held in every run.
- **Requires `NODE_OPTIONS=--max-old-space-size=6144` since PH-A5** (see the "How to run it" trap above) — the default heap OOMs partway through at the current 72,600-game scale. If this harness grows further, either raise the heap again or restructure `runSimulation()` to let each scenario's `PlayResult[]` go out of scope (and be collected) before the next scenario starts, rather than keeping all of them reachable for the whole function's lifetime.
- **G9 cannot be measured over full R-b-refereed games** — see the A5 finding above. `walkFullRoute` measures the generator+`resolveMove` mechanic in isolation instead; this is correct and intentional, not a workaround to note with suspicion, but it does mean G9 is NOT evidence about R-b's interaction with the maze (nothing currently is, for E[wasted] specifically — S11's win-rate delta is the closest thing to that interaction being measured).
