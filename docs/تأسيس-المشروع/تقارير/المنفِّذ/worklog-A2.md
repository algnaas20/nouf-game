# Worklog — PH-A2 (WL-A core: R-b equal-attempts ending, tiebreak, deck bands)

**Executor** · **Date:** 2026-08-07 · **Worktree:** `../nouf-wl-a-core` (branch `wl-a-core`, continuing from committed `343a5dd`) · **Port:** 3010 (unused — pure logic + CLI)

**Spec source:** `خطة.md` PH-A2 (no PROMPT A2 exists in `executor-prompts-2026-08-07.md` — that file only covers phase-1 walking-skeleton prompts). Cross-checked against ruling D-09.3/D-09.5/D-09.7…D-09.16 and I1–I10/G1–G7 in `game-rules-and-maze-investigation.md` §5.2, §5.5, §7.

## Closing-claims list (written before code)

| # | Criterion (خطة.md PH-A2, literal) | Planned measurement | Status |
|---|---|---|---|
| 1 | `\|attempts[A]−attempts[B]\| ≤ 1` at every step of every game (I7), zero violations | Test over many R-b games, seeded + random policy, count printed | pending |
| 2 | At `FINISHED` under R-b: `attempts[A] === attempts[B]` — 100% of games | Test counts games where this holds / total | pending |
| 3 | G2: S1 (all correct) reaches the tiebreak at exactly question `2N` — literal hand-written expected value, not computed by code under test | Deterministic S1 policy test, N=10, literal `2N=20` in test source | pending |
| 4 | Deck-band boundaries at N=10, D=21,22,37,38 → refuse/warn/warn/green — four cases, four results | Direct unit test on `deckBand()` | pending |
| 5 | Double-tap on "next question" consumes one question, not two | Test using `commit()` with a stale/duplicate event | pending |
| 6 (bonus, coordinator's item 4) | `N_max` deck→track-length relationship for the editor | `maxGreenTrackLength(D)` / `preselectTrackLength(D)` implemented + tested | pending |
| 7 | Every new guard proven red→green | Mutation table pasted below | pending |
| 8 | `tsc --noEmit` clean, full test suite green, A1's existing suite still green (no regression) | Command output pasted | pending |

**Explicitly not claimed here:** the ≥10,000-game harness and G4 (that is A3, tracked in `worklog-A3.md`).

---

## Design: how R-b/tiebreak/exhaustion is derived without new state fields

`GameState` (frozen, untouched) has no field for "which endgame phase we're in." Everything below is derived from `positions`/`attempts`/`N`/`firstTeam` (already-frozen fields) plus the event log — consistent with A1's "log is the only authority" design.

| Question | How it's answered without a new field |
|---|---|
| Is the other team owed a balancing attempt when a team reaches N? | `attempts[team] > attempts[other]` at the instant of reaching N (true iff this team was the round's first mover) — see `resolveProgression` Case 1 |
| Which "waiting to show a question" state do we land on after `TURN_PASSED`? | Purely from `positions`/`N`: both ≥ N → `TIEBREAK`; exactly one ≥ N → `FINAL_BALANCING_TURN`; neither → `TURN_START` (`reducer.ts`'s `TURN_PASSED` case) |
| Was this `MOVE_APPLIED` the owed team's balancing attempt, or a tiebreak pair member? | Re-fold the log up to (not including) this `MOVE_APPLIED` (`fold(ctx.events.slice(0,-1))`) to get the exact pre-move positions — **not** `position - delta`, which is lossy once a position has ever been clamped at `N` (true throughout a tiebreak) |
| Who won a tiebreak pair? | The two most recent `ANSWER_CHOSEN`/`NO_ANSWER` correctness values, read directly from `ctx.events` — no field needed |
| Who answers first in the tiebreak (D-09.9 reversed order)? | `otherTeam(state.firstTeam)` — fixed for the whole tiebreak, independent of who happened to reach N first |

**`DECK_EXHAUSTED` is never a literally-visited fold snapshot**, same design choice as A1: no event exists in the frozen 7-member `GameEvent` union to transition *into* it distinctly from `PROGRESSION_APPLIED`. The decision (leader-wins vs. the three-button "سؤال من الحضور" choice) is computed exactly at `PROGRESSION_APPLIED`, immediately followed by `GAME_ENDED`. Documented, not silently done — a reviewer expecting a real `DECK_EXHAUSTED` snapshot in the log should read this note.

**"سؤال من الحضور" (D-09.15) is three *legal* `GAME_ENDED` candidates**, not an automatic pick — `legalEvents` returns `[GAME_ENDED(winA), GAME_ENDED(winB), GAME_ENDED(draw)]` and the caller (eventually the stage, driven by the operator's tap) chooses which one to commit. This matches the ruling's "the room chooses, the app never shrugs" requirement precisely: the RNG never touches this decision.

**`commit()` (double-tap immunity)** is new in A2, added to `fold.ts`. Keyed by `event.seq !== events.length` — `seq` *is* the event count at construction time, so this is literally the `(eventCount, eventType)` key the ruling specifies (the eventType match is implicit: a stale event of any type carries a stale `seq`). Unlike `applyEvent`'s illegal-transition guard (I5, which throws), a stale/duplicate commit is a **silent no-op** — a double-tap is an expected UI occurrence, not an error.

---

## Test run (`npx vitest run`, full suite incl. A1)

```
[A1 criterion 1] finished=100/100, maxTransitions allowed=60, observed max events=14, avg events=13.05
[A1 criterion 2/3] I1=2610 assertions, I3=1305 assertions, I6=2610 assertions, I7=1305 assertions
[A1 criterion 3] I5 checks=3
[A1 criterion 4] undo fuzz checks=1305, zero failures
 ✓ tests/core/reducer.test.ts (4 tests)

[A2 deck-bands] N=10 D=21→refuse, D=22→warn, D=37→warn, D=38→green
[A2 criterion 1/2] I7 assertions=32120 (0 violations), attempts-equal-at-FINISHED=200/200 (100% required)
[A2 criterion 3 / G2] questions shown before first TIEBREAK state = 20 (expected 20)
[A2 D-09.9] main-game firstTeam=A, tiebreak currentTeam at first TIEBREAK state=B (must be B)
[A2 criterion 5] double-tap: first.applied=true, second.applied=false, events after both taps=2 (must be 2, not 3)
[A2 sanity] undo checks through an R-b game = 161
 ✓ tests/core/rules/progression.test.ts (8 tests)

 Test Files  2 passed (2)
      Tests  12 passed (12)
```

`npx tsc --noEmit`: **0 output, exit 0.** A1's own test file was re-run unmodified and stays green — no regression from the A2 rewrite of `legal.ts`/`reducer.ts` (A1's max observed event count moved from 13 to 14 for one seed, expected: some games that previously ended in an immediate win now take one extra event for the balancing turn/exhaustion resolution — still well under the 60-transition cap, and no A1 assertion checks the specific `outcome` value).

**Note on A1's own scenario under R-b:** with A1's toy deck (N=2, 3 questions), a team that gets both its answers correct now sometimes triggers a balancing-turn-owed decision with **no question left** for the owed team (deck already exhausted) — this hits the `legal.ts` `showNextQuestion` defensive fallback (declared draw) rather than A1's old immediate-win. This is exactly the deck-too-small edge case the deck-band "refuse" threshold exists to prevent in a real deck; A1's toy deck was never meant to be green-band-sized. A1's assertions don't check `outcome`, so this doesn't break anything, but it is a real behavior change worth flagging for anyone re-reading A1's report.

---

## Red→green mutation proofs

| Guard | Mutation | Failure output (pasted) | Reverted? |
|---|---|---|---|
| **R-b balancing-turn decision** | `progression.ts` Case 1: `if (false && attempts[movedIdx] > attempts[otherIdx])` — never owe a balancing turn (degrades to R-a) | `AssertionError: expected 195 to be 200` (criterion 2, attempts-equal-at-FINISHED dropped from 200/200) **and** `expected -1 to be greater than -1` (G2's S1 test — TIEBREAK state never reached, since R-a always ends immediately) — 3 tests failed | Yes |
| **D-09.9 reversed tiebreak order** | `progression.ts` Case 2 tiebreak-entry: `tiebreakFirstTeam = state.firstTeam` (dropped the `otherTeam(...)`) | `AssertionError: expected 'A' to be 'B'` at the exact D-09.9 assertion | Yes |
| **Deck-band thresholds** | `deck-bands.ts`: green threshold `3.34*N+4` weakened to `3*N+4` | `expected [ 'refuse','warn','green','green' ] to deeply equal [ 'refuse','warn','warn','green' ]` (D=37 flips to green early) **and** the self-consistency test also failed | Yes |
| **Double-tap immunity (`commit`)** | `fold.ts`: staleness check disabled (`if (false && event.seq !== events.length)`) | `IllegalTransitionError: Illegal event QUESTION_SHOWN from state QUESTION_SHOWN` — the disabled guard let the stale duplicate reach `applyEvent`, which then correctly refused it at the reducer level (a second layer catching what `commit` should have silently absorbed) | Yes |

All four reverted; final gate (below) reconfirms every test green and `tsc --noEmit` clean after every mutation was undone.

---

## Final gate

```
npx tsc --noEmit          → 0 output, exit 0
npx vitest run             → Test Files 2 passed (2), Tests 12 passed (12)
```

**File-ownership check:**
```
git status --porcelain
?? docs/تأسيس-المشروع/تقارير/المنفِّذ/worklog-A1.md   (already committed as 343a5dd; now shows because worklog-A2/A3 sit alongside)
?? docs/تأسيس-المشروع/تقارير/المنفِّذ/worklog-A2.md
?? src/core/context.ts
?? src/core/rules/
?? tests/core/rules/
   src/core/fold.ts       (modified — commit() added)
   src/core/legal.ts      (modified — delegates to rules/progression.ts, extends TURN_START handling)
   src/core/reducer.ts    (modified — extended legality guards, TURN_PASSED next-state derivation)
```
All changes are inside `src/core/**` and `tests/core/**` (WL-A's owned files). `src/contracts/**` untouched (`git diff main -- src/contracts/` = 0 lines, re-verified).

---

## Closing-claims list — final status

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | I7 zero violations | **Met** | 32,120 assertions, 0 failures |
| 2 | `attempts[A]===attempts[B]` at FINISHED, 100% | **Met** | 200/200 games |
| 3 | G2: S1 reaches tiebreak at exactly `2N` (literal) | **Met** | 20 questions before first `TIEBREAK` state, N=10, literal `20` in source |
| 4 | Deck-band 4 cases at N=10 | **Met** | refuse/warn/warn/green for D=21/22/37/38 |
| 5 | Double-tap consumes one question, not two | **Met** | `applied=true` then `applied=false`, events.length stays 2 |
| 6 | `N_max` relationship (bonus) | **Met** | `maxGreenTrackLength`/`preselectTrackLength`, self-consistency tested |
| 7 | Red→green for every new guard | **Met** | 4 mutations, table above, all reverted |
| 8 | `tsc`/`vitest` clean, A1 no-regression | **Met** | pasted above |

**Not measured / deferred to A3:** ≥10,000-game harness, G1/G3/G5/G6/G7 formal assertions, G4 both figures, red→green for I9/G1/G5/G6/G7 (the 10-mutation table required by PH-A3's own criterion 6).

