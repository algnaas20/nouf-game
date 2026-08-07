# Game rules, maze model, session state machine — pre-implementation investigation

**Agent:** `game-systems-expert` · **Date:** 2026-08-07 · **Path:** تأسيس-المشروع
**Mode:** read-only design investigation. No code exists in the project yet.
**Language:** English (audience = agents, v3 §11).

---

## 0. Verification status — declared up front (v3 §9 rule 1)

| Claim class | Status | Why |
|---|---|---|
| Closed-form arithmetic (game length, question count, attempt counts, first-mover advantage) | **Derived, shown inline, NOT executed** | No rule functions exist to call. Every formula is written out so it can be re-derived and later confirmed by the harness in §7. |
| Timing constants (seconds per question) | **Estimated, NOT measured** — named debt | Requires one real session with a stopwatch. Measurement procedure given in §3.4. |
| State machine legality, invariants, undo model | **Design specification** — becomes testable the moment the reducer exists | Assertions written in §7 as literal, checkable statements. |
| Maze completability proofs | **Proof obligations specified, not discharged** | Cannot be discharged before the maze model is chosen (open decision #3, user's). |

Nothing in this report may be treated as verified. It is a specification of what must be built and what must then be proven.

---

## 1. The ambiguity in "each team directs the question at the other, in turn"

The user's phrase — «فريقين يتناوبان توجيه الأسئلة لبعضهما» — has at least five mechanically distinct readings. This is a **user decision**, not mine to resolve.

### 1.1 The readings

| # | Reading | Who picks the question | What the app must show extra | Deck structure required |
|---|---|---|---|---|
| **R1** | **Pure alternation.** The app picks the next question from the deck; the turn to *answer* alternates. "Directing" is the social framing (team A's turn to put a question to team B). | App (seeded order) | Nothing | Flat ordered list |
| **R2** | **Board pick.** The attacking team sees a board of categories × difficulties and picks the cell to throw at the defenders. | Attacking team | A full selection board screen, with consumed cells marked | Fully populated grid; deck size fixed by board size |
| **R3** | **Category pick only.** Attacking team picks a category; app picks a question inside it. | Team picks category, app picks question | A category strip | Questions tagged by category; each category needs depth |
| **R4** | **Ceremonial reading.** The app picks the question, the *asking team physically reads it aloud* off the shared screen to the opponents. Mechanically identical to R1; different staging. | App | A line of text naming who reads and who answers | Flat ordered list |
| **R5** | **Wager pick.** The attacking team picks a difficulty, which sets the reward (1 step for easy, 2 for hard) and possibly a penalty. | Attacking team | A difficulty prompt | Questions tagged by difficulty; step values per difficulty |

### 1.2 Which reading his phrasing most likely means

**R4 (which is R1 plus staging).** Evidence, in order of weight:

1. He described the authoring model in the same breath: the game's author writes the question, its options, and marks the correct one. He described **no** categorisation, no board, no difficulty tiers. R2/R3/R5 all silently require a second dimension of authoring he never mentioned.
2. The stated success measure is *one person opens the game and runs it end to end with no technical explanation*. R2 adds a selection screen that the **teams** must interact with on a screen only the operator touches — which means the operator relays their choice, adding a tap and a negotiation per question.
3. «يتناوبان» ("they alternate") is a statement about *turn order*, and «توجيه الأسئلة لبعضهما» ("directing the questions at each other") describes the *social act* of one side quizzing the other. Together they describe alternation with a direction — not a selection mechanic.
4. He asked for a first version that is "small and tight", playable end to end.

**Conclusion to put to the user:** he most likely means "the turn to be quizzed alternates", and the "directing" is ceremony that costs zero mechanics — but it should be *visible on screen* («فريق أ يوجّه — الجواب على فريق ب»), because if it is invisible the game reads as a plain quiz and his description is not honoured.

### 1.3 Cost comparison of the readings

Operator taps counted for one complete question cycle, from "next" to the next team's turn.

| Reading | Operator taps / question | Extra screens | Up-front authoring for a 10-station game (see §3) | Feel for the losing team | Adds to game length |
|---|---|---|---|---|---|
| R1 / R4 | **2** (tap the option the team said → tap next) | 0 | ~30 questions, flat list | Neutral; loss is attributable to their own answers | 0 |
| R2 | 3–4 (relay pick → show → tap option → next) | 1 board | ~30 questions **plus** a complete grid, e.g. 5 categories × 6 = 30 with no slack; any gap breaks the board | Better — they had agency in what they threw; worse — they can blame their own pick | +8–12 s/question ⇒ +4–6 min/game |
| R3 | 3 | 1 strip | ~30 questions, ≥5 per category ⇒ effectively ≥30 with depth constraints | Mildly better than R1 | +5–8 s/question ⇒ +2.5–4 min |
| R5 | 3 | 1 prompt | ~20–30 questions tagged easy/hard, both tiers stocked | Best agency, highest blowout risk | +5–8 s/question |

Minimum taps matters more than it looks: at ~30 questions per game, one extra tap per question is 30 extra interactions performed by a non-technical relative in front of an audience. Every one is a chance to mis-tap.

### 1.4 Recommendation for v1

**Adopt R4: app-driven alternation, with the "directing" made explicit on screen.**

Because: it is the cheapest correct reading, it needs no second authoring dimension, and it is the only reading whose deck is a flat list — which matters because the in-game question editor (already a decided requirement) is a whole second application, and a flat list is the cheapest editor to build correctly.

**What it forecloses — and how to foreclose nothing:**

R2/R3/R5 are all *pure additions* on top of R1 if, and only if, two things are done on day one:

1. The question record carries **optional, unused** `category` and `difficulty` fields from the very first version. Adding them later is a data migration across every game pack the author has already made — the single most expensive kind of change in a browser-stored, no-server project.
2. Question selection lives behind **one function** — `selectNextQuestion(state) -> questionId` — and never inline in the turn handler. Swapping app-picks for team-picks then changes one function plus one screen, not the state machine.

With those two, R1 forecloses nothing. Without them, it forecloses R2/R3/R5 at high cost. This is a non-negotiable instruction to the executor.

---

## 2. The maze model

The maze is the visual heart of the game and open decision #3. Four candidate models. M4 is orthogonal — it layers onto M1, M2 or M3.

### 2.1 The models

| | **M1 Fixed drawn path** | **M2 Grid maze with branches** | **M3 Generated per round** | **M4 Event cells** (layer) |
|---|---|---|---|---|
| Description | N stations per team on a hand-drawn winding path; maze is decoration, race is linear | Real grid; correct answer moves one step; the team chooses direction at junctions | Maze regenerated each game from a seed | Some cells carry shortcut / trap / steal-a-turn / bonus |
| Completion always provable? | **Yes, trivially.** Position is monotone non-decreasing and bounded; N correct answers finish. One assertion, proven once. | Only if proven per layout — a branch can be a dead end | Only if proven **per generated instance** — every seed | Only if events are forward-only; a backward event breaks monotonicity |
| Can a team get stuck? | No | **Yes** (dead-end branch) unless BFS-guaranteed | **Yes** unless BFS-guaranteed at generation time | No, but progress can oscillate and game length becomes unbounded in the worst case |
| Fair when one team is far ahead? | Yes — identical tracks, symmetric by construction | **Only if the two tracks are isomorphic** (same maze, mirrored) *and* all branches have equal length; otherwise a team can be unlucky in geometry | **Only if `shortestPath(A) === shortestPath(B)` is asserted per seed** | No — a trap makes the loss attributable to the board, not to the team's answers. This is the fairness cost that a family audience feels most sharply |
| Legibility from across a room | **Highest.** Two parallel tracks, one token each, "5 of 10" readable at a glance | Medium — the eye must trace a path; "who is ahead" is no longer a number | **Lowest.** The board changes every game, so nobody ever learns to read it | Reduces legibility: position no longer equals correct answers, so the board stops being a scoreboard |
| Implementation cost | Low — an array of coordinates and a token | High — grid model, junction UI, direction choice as a new state and a new tap | Highest — generator + validator + seed plumbing + regeneration UI | Medium per event type; each event is a new transition and a new proof |
| Art cost | One background illustration | A generated or drawn grid, junction markers | Must be programmatically drawn — no hand art possible | Icons per event type |

### 2.2 The structural argument against M2

With **one track per team**, a branching maze is not a maze in the puzzle sense: nobody is solving it, and correct answers move the token regardless of route. Therefore a branch only *matters* if the branches differ — in length, or in the events they carry.

- If branches are equal length and carry nothing, M2 **is** M1 with extra code and an extra tap.
- If branches differ in length, the game stops being a fair test of answers: two teams with identical accuracy finish at different times because of a route choice. That violates the fairness property this project cannot afford.
- If branches carry events, M2 **is** M4.

So M2 collapses. It should be presented to the user as a picture, not as a mechanic.

### 2.3 Proof obligations (what must be numerically proven before each ships)

| Model | Obligation | Cost to discharge |
|---|---|---|
| M1 | `trackLength[A] === trackLength[B] === N`; position monotone; win at exactly N; one full simulated playthrough finishing in the exact predicted question count | **One test, once.** Minutes of work |
| M2 | BFS from every reachable cell to goal for **each hand-drawn layout**; `minDist === maxDist` across all routes if fairness is to hold; junction state has legal transitions | Hours, per layout, re-done whenever art changes |
| M3 | Per seed, for ≥10,000 seeds: BFS reachability of goal from start; no unreachable cells on the played path; `shortestPath(A) === shortestPath(B)`; generator determinism (same seed ⇒ byte-identical maze) | Days, and it is a permanent tax — every generator tweak re-opens it |
| M4 | Termination: prove `maxQuestions` is bounded. Position floor at 0 and ceiling at N. Each event cell fires at most once (or prove the no-cycle property). If "steal a turn" exists, prove the equal-attempts invariant still holds or explicitly abandon it | Significant, and it interacts with every other proof |

### 2.4 Recommendation for v1

**M1 — fixed drawn path, maze-shaped decoration, N stations per team, one step per correct answer.**

Reasons, in order:

1. It is the only model where **position on the board equals the number of correct answers**. That makes the maze a literal scoreboard readable from across a majlis, which is the hardest UI constraint in this project (shared screen, read from metres away). Every other model breaks this identity.
2. Its completability proof is one assertion. M3's is a permanent verification tax paid for a feature that, in a host-operated quiz, the audience does not benefit from — the maze changing shape each game makes it *harder* to read, not more fun.
3. It is the only model where a loss is unambiguously attributable to the teams' own answers. In a family majlis this is not a design nicety; it is what stops an argument.

**Forward compatibility, day one:** every cell in the track array carries `event: null`. Adding shortcuts later is then data, not a schema change. Recommend that if events are ever added, **only forward-moving events** are allowed (shortcut, bonus step), because forward-only preserves monotonicity and therefore preserves the termination proof for free. Traps and back-steps require a new bounded-length proof and should be treated as a separate, later decision.

---

## 3. Progression and length

### 3.1 The model being costed

One step per correct answer. Wrong answer: nobody moves, turn passes (see §5). Strict alternation. Track length N per team, identical.

### 3.2 The arithmetic

Let `p` = the fraction of questions a team answers correctly (both teams assumed similar for the estimate).

- Attempts a team needs to accumulate N correct answers: `A = N / p` (expectation; negative-binomial mean).
- Turns alternate, so the total questions asked in the game: **`Q ≈ 2N / p`**.
- Wall-clock: `minutes = fixedOverhead + Q × secondsPerQuestion / 60`.

**Seconds per question** — component estimate (unmeasured, see §3.4):

| Phase | Text | Image | Audio | Video |
|---|---|---|---|---|
| Question appears, read aloud | 10 s | 10 s | 8 s | 8 s |
| Media playback (incl. one replay for audio) | — | 5 s | 25 s | 35 s |
| Team deliberates | 15 s | 15 s | 15 s | 15 s |
| Operator taps the option | 2 s | 2 s | 2 s | 2 s |
| Reveal + reaction | 8 s | 8 s | 8 s | 8 s |
| Token moves + turn hand-off | 5 s | 5 s | 5 s | 5 s |
| **Total** | **40 s** | **45 s** | **63 s** | **73 s** |

Weighted by a plausible mixed deck (50 % text, 20 % image, 15 % audio, 15 % video):

`0.50×40 + 0.20×45 + 0.15×63 + 0.15×73 = 20 + 9 + 9.45 + 10.95 = 49.4 s` → **use 50 s/question**.

Fixed overhead: setup + team naming + first-turn draw ≈ 2 min; winner moment ≈ 1 min → **3 min**.

So: **`minutes = 3 + (2N/p) × (50/60) = 3 + 1.667 × N / p`**

### 3.3 Table: track length × accuracy → questions and minutes

Cells show **Q questions / minutes**. Bold = inside the recommended 20–35 min band.

| N (stations) | p = 0.5 | p = 0.6 | p = 0.7 | p = 0.8 |
|---|---|---|---|---|
| **6** | 24 / **23.0** | 20 / 19.7 | 17 / 17.3 | 15 / 15.5 |
| **8** | 32 / **29.7** | 27 / **25.2** | 23 / **22.0** | 20 / 19.7 |
| **10** | 40 / 36.3 | 33 / **30.8** | 29 / **26.8** | 25 / **23.8** |
| **12** | 48 / 43.0 | 40 / 36.3 | 34 / **31.6** | 30 / **28.0** |
| **14** | 56 / 49.7 | 47 / 41.9 | 40 / 36.3 | 35 / **32.2** |

**Recommended default: N = 10.** It sits in band for p ∈ [0.6, 0.8] and only slips to 36 min at p = 0.5. Offer three lengths at setup: **6 = «قصيرة»**, **10 = «عادية»**, **14 = «طويلة»** — one setup control, no rules change, and it is the operator's single most useful lever on the night.

**Target band defence — 20–35 minutes per game:**

- A seated mixed-age majlis audience holds focus for roughly this long before side conversations start. Beyond ~40 min, the shared screen loses the room.
- Two 25-minute games beat one 50-minute game: the losing team gets a rematch, which is worth more socially than a longer single contest.
- With one shared screen and strict alternation, a given individual is idle roughly half the session. Doubling the game length doubles their idle time, not their play time.
- Recovery: if the night breaks (refresh, crash, someone unplugs the TV), the maximum loss is one game's length. Keeping that under ~30 min bounds the disaster.

### 3.4 How to convert the estimates into measurements (named debt)

At the first real session the operator's screen must log, per question: `questionShownAt`, `answerChosenAt`, `nextPressedAt`, and `mediaType`. That yields the true median seconds-per-question by media type, and this whole table is recomputed from measured constants. Until then, §3.3 is labelled estimate. **Debt name:** `question-cycle-timing-unmeasured`.

### 3.5 Deck size — the finding that matters most for authoring

The invariant "no question is asked twice in a session" means the deck must contain at least `Q` questions. But `Q` is driven by the **worst case** accuracy, not the expected one.

| N | Deck needed at p = 0.8 | at p = 0.7 | at p = 0.5 | at p = 0.4 |
|---|---|---|---|---|
| 6 | 15 | 17 | 24 | 30 |
| 10 | 25 | 29 | 40 | 50 |
| 14 | 35 | 40 | 56 | 70 |

A "10-station standard game" can consume **50 questions** if the teams struggle. The game's author will not intuit this. Two mandatory consequences:

1. **The editor must tell the author what their deck supports.** With `D` questions, the largest safe track length is roughly `N_max ≈ D × p_assumed / 2`; showing "عندك 24 سؤالاً — تكفي لمسار من ٨ خطوات" is a two-line calculation that prevents a game dying mid-majlis.
2. **Deck exhaustion must be a defined ending, not a crash.** See §5.5. This edge case will occur on the first night with a small starter deck; it is not exotic.

Also: playing two games in one evening off the same deck doubles the requirement unless the used-question set resets per game (it should; scope it to the game, not the evening — but then the same question can recur across two games in one night, which is acceptable and should be stated rather than discovered).

---

## 4. Catch-up and blowout

### 4.1 Framing the actual problem

"Team A wins the first six in a row" with N = 10 means A is at 6, B at 0. B now needs 10 correct answers while A needs 4. Under any plausible p, B has effectively lost.

But note what the scenario *is*: B answered six of six wrong. Under strict alternation, one step per correct answer, **the maximum possible lead after k rounds is exactly k** — a blowout can only mean one team's accuracy is far below the other's. That is usually an **authoring** mismatch (the questions suit one side's knowledge), not a rules defect. Rules mechanics can mask it; they cannot fix it.

### 4.2 The honest options

| Option | Mechanic | Effect on the blowout | Fairness cost | Proof obligation added |
|---|---|---|---|---|
| **A. Nothing** | Pure race | None | **Zero.** The loss is fully attributable to answers | None |
| **B. Comeback cells** | The trailing team's next cell is a shortcut (+2) | Real, but arbitrary | High — the leading team is overtaken by the board. The overtake happens *visibly on the shared screen*, which is exactly where resentment forms | Termination + no-oscillation + position ceiling |
| **C. Difficulty weighting** | The trailing team gets easier questions | Real | If hidden, it is a lie the operator has to keep; if shown, it is patronising in front of family. Also requires difficulty tagging on every question | Deck must be proven to hold enough easy questions, plus a graceful degrade |
| **D. Steal on a wrong answer** | The opposing team may answer a missed question | **Amplifies** blowouts — the strong team steals more | Moderate; and it breaks naive attempt-counting (see §5.2) | Equal *primary* attempts invariant must be redefined and re-proven |
| **E. Wager** | The trailing team may declare "خطوتين": correct = +2, wrong = −1 | Real, and dramatic | **Lowest of the assisted options** — the team opted into the risk, so the outcome stays attributable to them | Position floor at 0; termination bound; the wager state |
| **F. Track shortening** | If the gap ≥ K, shorten the trailing team's remaining track | Real | Crude and obvious; changes N mid-game, breaking the "position = correct answers" identity | Low |

### 4.3 Recommendation for v1

**Option A — nothing — plus presentation remedies that cost no fairness at all.**

The real damage from a blowout is not unfairness; it is the trailing team **disengaging**. That is fixable without touching the rules:

1. Keep the trailing team's *asking* role visible and active every round — they still direct the question at their opponents. This is the R4 staging from §1 earning its keep.
2. Show **«بقي X خطوات»** for both teams, not just position. "4 remaining vs 10" is a target; a token sitting at the start is a verdict.
3. Keep the game short (N = 10 ⇒ a blowout ends in ~13 minutes) and make **«لعبة جديدة»** a single obvious button on the win screen. The rematch is the catch-up mechanic.
4. Show per-team accuracy on the end screen. It tells the game's author, honestly, that the deck was lopsided — which fixes the cause instead of masking it.

If the user later wants a mechanic, recommend **E (wager)** and nothing else, because it is the only one where the outcome remains attributable to a team's own decision.

---

## 5. Wrong answers, ties, edge cases, and undo

### 5.1 Wrong-answer policy

| Policy | Steps produced per question | Effect on Q | Non-answering team's engagement | Extra proof needed | Verdict |
|---|---|---|---|---|---|
| **Nobody moves, turn passes** | `p` | Baseline | Idle (mitigated by the asking role) | **None** | **Recommended v1** |
| Opponent steals (bonus attempt) | `p + (1−p)·q` — at p=0.7, q=0.5 → 0.85 | ≈ −18 % questions | Both teams live every question | Attempts invariant must be split into primary vs steal attempts | Strong candidate for v2 |
| Opponent advances automatically | `1.0` | ≈ −30 % | Passive reward | A team can win having answered almost nothing | Reject |
| Wrong answer costs a step | `p − (1−p)` — negative below p = 0.5 | Unbounded games at low p | Demoralising | Position floor + termination bound | Reject for v1 |

**Recommendation: nobody moves, the turn passes.** It is the only policy that preserves `position === correctAnswers` — invariant I6 in §7 — which is what makes the maze legible from across a room and makes the game explainable in one sentence to a non-technical majlis.

### 5.2 The first-mover advantage — a provable unfairness, and the fix

This is the most important finding in the report.

Let `a` = number of attempts team A needs to reach N correct, `b` = the same for team B. Under strict alternation with A going first, **A's k-th attempt always precedes B's k-th attempt.**

Under **immediate win** (first team to reach N wins on the spot):

`P(A wins) = P(a < b) + P(a = b)`

Under identical skill, `P(a < b) = P(b < a) = (1 − P(a=b)) / 2`, so:

`P(A wins) = 0.5 + P(a = b)/2` — **strictly greater than 0.5** whenever a tie in required attempts is possible, which it always is.

Magnitude: `a` and `b` are negative-binomial(N, p). For N = 10, p = 0.7:
- mean attempts = N/p = 14.29
- sd = √(N(1−p)/p²) = √(10 × 0.3 / 0.49) = √6.12 = **2.47**
- for two i.i.d. near-normal discrete variables, `P(a = b) ≈ 1/(2σ√π) = 1/(2 × 2.47 × 1.7725) = 1/8.76 ≈ 0.114`
- ⇒ **`P(A wins) ≈ 0.557`**

**The team that goes first wins roughly 56 % of games purely from turn order.** In a majlis, the losing team will not compute this, but they *will* notice "they finished before we even got our last turn" — and that is the exact moment the game is called unfair.

**Two resolutions:**

| | **R-a Immediate win** | **R-b Equal-attempts completion ("last licks")** |
|---|---|---|
| Rule | First team to reach N wins immediately | When a team reaches N, the other team gets its balancing attempt(s) so both end on equal attempts. If both reach N, go to a tiebreak question |
| P(first team wins) | ≈ 0.557 (N=10, p=0.7) | **0.500** |
| Is a tie representable? | No — provable, and worth asserting | **Yes**, and it is on the main road (see below) |
| Cost | Zero | 1 state (`FINAL_BALANCING_TURN`), 1 tiebreak state, 1 invariant, ≥1 reserved tiebreak question |
| Feel | "They got one more turn than us" | "We both had exactly the same number of chances" |

**Recommendation: R-b, plus a visible seeded draw for who goes first** (so even the residual asymmetry is publicly random rather than an app decision nobody saw).

**A consequence that must be authored for, not discovered live:** under R-b, a game in which **both teams answer everything correctly always ends in a tiebreak** — A reaches N on question 2N−1, B on question 2N. For a family answering questions about people they know, high accuracy is the *expected* case. The tiebreak is therefore a main path, not an exotic branch. The deck must reserve tiebreak questions, and the harness must exercise the tiebreak path in every run.

### 5.3 The very last step

Two failure modes that are cheap to prevent and expensive to discover live:

1. **Overshoot.** If any mechanic ever grants more than one step (wager, shortcut), `position` must clamp to N. Assert `position <= N` always (I1), never `position === N` as the only win check — use `position >= N`, clamped.
2. **Win detected in the wrong place.** The win check must run in the `PROGRESSION_APPLIED` state, **after** the move is committed as an event — never inside the reveal handler. If the win is computed as a side effect of the reveal, undo cannot un-win, and the operator's mis-tap becomes unrecoverable in front of the audience.

### 5.4 Operator mis-tap and undo

The mis-taps that will actually happen, in likelihood order:

| Mis-tap | Frequency | Damage without undo |
|---|---|---|
| Team said B, operator tapped C | High | A wrong verdict announced publicly; the wrong team moves; the question is burned |
| Tapped "next" before the reveal was read | High | The room did not see the answer; the question is consumed |
| Double-tapped "next", skipping a question | Medium | A question silently consumed unseen |
| Tapped "next" on the win screen and reset the game | Low | The night is destroyed |

**Requirement: one visible «تراجع» button, always on screen, undoing exactly the last committed transition — and it must be the *only* recovery action a non-technical operator needs to know.**

**Specified implementation model (this is the recommendation, not an option):** the session is an **append-only event log**; state is `fold(applyEvent, initialState, events)`.

- Committed events: `GAME_STARTED{seed, N, teamNames, firstTeam}`, `QUESTION_SHOWN{questionId}`, `ANSWER_CHOSEN{optionId, correct}`, `MOVE_APPLIED{team, delta}`, `TURN_PASSED{toTeam}`, `GAME_ENDED{outcome}`.
- **Undo = pop the last event and re-fold** (or restore the previous snapshot).

What this buys, at essentially no extra cost:

1. Undo is correct **by construction**, including un-winning and including returning the question to the unused pool — the single most-forgotten part of an ad-hoc undo. A hand-written undo almost always restores `position` and forgets `usedQuestionIds`, silently burning a question.
2. Undo depth is free. Recommend **unlimited undo back to game start**, one button, repeated presses go further back.
3. The event log **is** the debug trace. Any live incident becomes a reproducible replay, which on a server-less project is the only forensic tool that exists.
4. Persistence is trivial: persist the log plus the seed; the derived state is a cache.

**Redo:** out of scope for v1 — declared, not silently dropped. Rationale: an operator who over-undoes simply re-taps forward, and redo doubles the transition surface.

**Double-tap idempotence:** each transition is keyed by `(currentEventCount, eventType)`. A repeated event carrying a stale `currentEventCount` is a no-op. Without this, a bouncy remote or a trackpad double-click consumes two questions in one tap, which reads to the room as the app skipping questions.

### 5.5 Edge cases that must have declared behaviour before implementation

| Edge case | Required behaviour |
|---|---|
| **Deck exhausted, no winner** | Enter `DECK_EXHAUSTED`. If positions differ → the leader wins («فاز بالتقدّم»). If equal → tiebreak. If no tiebreak question remains → **declared draw** |
| **Draw is therefore representable** | The outcome type must be `winA \| winB \| draw`. The naive invariant "exactly one winner" is **wrong** and must be worded as: at `FINISHED`, exactly one `outcome` value holds, and `draw` is reachable only via the exhausted-tiebreak path |
| **Both reach N** (only possible under R-b) | `TIEBREAK`: sudden death, one question each in the same order, first to be uniquely ahead wins |
| **Deck smaller than the minimum for N** | Refuse at setup with a plain-Arabic explanation and a suggested N — never start a game that cannot finish |
| **Question with a missing media file** | Skip with a visible operator notice and do not consume the turn; log it. Media integrity is `media-storage-expert`'s domain, but the *rules* response is mine and it is: never let a broken asset consume a team's attempt |
| **Operator closes the tab mid-question** | §6 |
| **Two games in one evening** | `usedQuestionIds` resets per game. State this to the user: a question may recur in the second game of the same night |

---

## 6. Session state machine

### 6.1 States

| State | Meaning | Legal exits |
|---|---|---|
| `SETUP` | Deck selected, track length N chosen, deck-size check passed | → `TEAM_SETUP` |
| `TEAM_SETUP` | Team names entered; who-goes-first drawn from the seed and shown | → `TURN_START` |
| `TURN_START` | Shows who directs and who answers. No question visible yet | → `QUESTION_SHOWN` |
| `QUESTION_SHOWN` | Question, media and options visible; nothing chosen | → `ANSWER_REVEALED` |
| `ANSWER_REVEALED` | Chosen option and correct option both marked | → `PROGRESSION_APPLIED` |
| `PROGRESSION_APPLIED` | Move committed (or explicitly none); win check ran here and only here | → `TURN_START` \| `FINAL_BALANCING_TURN` \| `TIEBREAK` \| `DECK_EXHAUSTED` \| `FINISHED` |
| `FINAL_BALANCING_TURN` | One team reached N; the other owes an attempt (R-b only) | → `QUESTION_SHOWN` |
| `TIEBREAK` | Both at N on equal attempts; sudden death | → `QUESTION_SHOWN` (tiebreak deck) \| `FINISHED` |
| `DECK_EXHAUSTED` | No unused question remains | → `FINISHED` \| `TIEBREAK` |
| `FINISHED` | Outcome declared: `winA` \| `winB` \| `draw` | → `SETUP` (new game) \| undo → `PROGRESSION_APPLIED` |

**Not states:** pause, media playing, "loading". A pause is a modal overlay that changes nothing. Introducing them as states multiplies the transition table for zero rules benefit.

### 6.2 Transitions that must be illegal and asserted

| Illegal | Why it matters |
|---|---|
| `QUESTION_SHOWN` → `QUESTION_SHOWN` | Double-tap consumes a question unseen |
| Two `MOVE_APPLIED` for the same `questionId` | Double-move on one answer |
| Any exit from `FINISHED` other than new-game or undo | An accidental tap after the win must not restart the night |
| `ANSWER_REVEALED` reached without a `QUESTION_SHOWN` for the same question | Out-of-order UI events |
| Win computed anywhere except `PROGRESSION_APPLIED` | Breaks undo of a win (§5.3) |

Every attempted illegal transition throws, is logged, and **leaves state unmutated** — assert the unmutated part explicitly (I5), because a throw after partial mutation is the classic way a state machine corrupts itself.

### 6.3 What must survive a refresh

Persist **synchronously on every committed event**, before the UI updates.

| Must survive | Reason |
|---|---|
| `seed` and the RNG draw index | Otherwise question order after resume differs from before — the same question can reappear |
| The full **event log** | Single source of truth; everything below is derivable from it, but store the derived snapshot too as a fast-path cache |
| `deckId` + `deckHash` | To refuse resuming against a deck the author edited mid-evening |
| Team names, colours, N | The room already knows these; regenerating them is visible and embarrassing |
| `positions`, `attempts`, `correct`, `usedQuestionIds` | The game itself |
| Current state id + current `questionId` | The resume point |

| May be lost | Reason |
|---|---|
| Media playback position | Replay from the start is acceptable and expected |
| Reveal/move animation progress | Re-enter the current state at its beginning |
| Transient UI (hover, focus, scroll) | No semantic content |

**Resume point:** on load, if a stored session exists and its state is not `FINISHED`, show two buttons — «تكملة الجلسة» and «جلسة جديدة». **Never auto-resume silently** (the operator may be starting a fresh game and would not notice a restored one) and **never auto-discard** (that is the night destroyed).

**Stale-deck rule:** if `deckHash` differs from the loaded deck, refuse to resume and say so plainly — `usedQuestionIds` would point at questions that no longer exist.

**Storage requirement (hand-off to `media-storage-expert` for the mechanism, but the requirement is mine):** the session write must be **synchronous and complete within the same tick as the transition**. An asynchronous write can be lost on a hard tab close, which is exactly the failure mode we are protecting against. The session payload is tiny — an event log of ~60 entries is a few KB — so it belongs in a small synchronous store, separate from the deck and media, which are large and belong elsewhere. I am specifying the property (`synchronous`, `small`, `separate from media`), not the API.

---

## 7. Numeric verification plan (v3 §4, §9)

### 7.1 Non-negotiables

- The harness imports and calls **the real rule functions** — `applyEvent(state, event)`, `legalEvents(state)`, `selectNextQuestion(state)`. It must not reimplement any rule. A harness that reimplements the rules proves that two implementations agree, which is worth nothing.
- Everything is **seeded**. Any failure prints the seed, the policy name and the full event log, so it replays exactly.
- The harness runs **before** any Playwright/visual check (v3 §4 rule 4). Screenshots are evidence for humans; the harness is the proof.

### 7.2 Scenarios (player policies)

| # | Policy | What it proves |
|---|---|---|
| S1 | Both teams always correct | Exact-length assertion; under R-b, the tiebreak path |
| S2 | Both teams always wrong | Deck-exhaustion path with positions 0–0 |
| S3 | A always correct, B always wrong | Maximum blowout; win detection at the extreme |
| S4 | Strict alternating correct/wrong | Turn-swap correctness under a regular pattern |
| S5 | Uniform random at p ∈ {0.1 … 0.9}, 1,000 games each | Fairness distribution; the empirical `P(first team wins)` for §5.2 |
| S6 | Tie-forcing (drive both to N on equal attempts) | The tiebreak state and the `draw` outcome |
| S7 | Adversarial max-length (always wrong until exhaustion) | Termination bound |
| S8 | Undo fuzz: random legal events with random undos interleaved | Undo correctness including question-pool restoration |
| S9 | Refresh fuzz: serialize + deserialize at **every** step, continue from the deserialized state | Persistence round-trip; that resume produces an identical outcome to the uninterrupted run |

**Volume:** ≥10,000 games total, ≥1,000 per scenario, seeds 1…10000. A game is ~60 transitions ⇒ ~600k reducer calls ⇒ seconds in JS. There is no runtime excuse for not running this on every commit.

### 7.3 Per-step invariants

| ID | Assertion |
|---|---|
| **I1** | `0 <= position[t] <= N` for both teams, at every step |
| **I2** | The turn belongs to exactly one team; `turnOwner` is defined in every state except `SETUP`, `TEAM_SETUP`, `FINISHED` |
| **I3** | `new Set(usedQuestionIds).size === usedQuestionIds.length` — no question asked twice |
| **I4** | In `QUESTION_SHOWN`: `currentQuestionId ∈ deck` and `currentQuestionId ∉ usedQuestionIds` |
| **I5** | The applied event is in `legalEvents(prevState)`; applying an illegal event throws **and leaves the previous state deep-equal to its pre-call value** |
| **I6** | `position[t] === correct[t]` (no-events model). With events: `position[t] === correct[t] + eventDelta[t]`. This catches any accidental extra movement anywhere in the codebase |
| **I7** | `abs(attempts[A] − attempts[B]) <= 1` at all times |
| **I8** | The current state id is in the declared state set, and the transition just taken is in the declared transition table — no ad-hoc transitions |
| **I9** | `outcome === null` unless state is `FINISHED`; at `FINISHED`, `outcome ∈ {winA, winB, draw}`, exactly one value, and `draw` only via the exhausted-tiebreak path |
| **I10** | `deserialize(serialize(s))` deep-equals `s`, at every step |

### 7.4 Per-game assertions

| ID | Assertion | Note |
|---|---|---|
| **G1** | Every game reaches `FINISHED` within `maxTransitions = 20 × deckSize`; exceeding it fails loudly instead of hanging | Termination |
| **G2** | S1 (all correct) finishes in **exactly** 2N−1 questions under R-a, or reaches the tiebreak at exactly question 2N under R-b | The expected number must be an **independently written literal**, not a value computed by the code under test |
| **G3** | S2 (all wrong) ends in `DECK_EXHAUSTED` after exactly `deckSize` questions, with `positions === [0, 0]` and `outcome === draw` | |
| **G4** | At `FINISHED`: under R-b, `attempts[A] === attempts[B]`; under R-a, `attempts[loser] ∈ {attempts[winner], attempts[winner] − 1}`. **Additionally, report the measured `P(first team wins)` over S5** | This measured number is the evidence the user needs to choose R-a vs R-b. Analytic prediction: ≈0.557 at N=10, p=0.7 under R-a; 0.500 under R-b |
| **G5** | Same seed + same policy ⇒ byte-identical event log. Every game is run twice and compared | Determinism |
| **G6** | For every prefix, `undo(apply(s, e))` deep-equals `s`, **including `usedQuestionIds` and the RNG draw index**. 1,000 fuzzed sequences | The RNG index is the part everyone forgets |
| **G7** | Maze completability for the chosen model: M1 — one assertion that both tracks have length N and the goal is reachable in exactly N steps. M3 — per seed over 10,000 seeds: goal reachable by BFS from start, and `shortestPath(A) === shortestPath(B)` | Discharges §2.3 |

### 7.5 Red→green proof obligation (v3 §4 rule 2)

**No guard is trusted until it has been made red by a real mutation of the rule function.** Required mutations, one per guard:

| Guard | Mutation that must turn it red |
|---|---|
| I1 | Change the move to `position += 2` |
| I3 | Delete the push to `usedQuestionIds` |
| I5 | Mutate state before the legality check throws |
| I6 | Grant a step on a wrong answer |
| I7 | Skip the turn swap on a wrong answer |
| I9 | Run the win check inside the reveal handler instead of `PROGRESSION_APPLIED` |
| G1 | Remove the deck-exhaustion transition |
| G5 | Replace the seeded RNG with `Math.random()` |
| G6 | Make undo restore `position` but not `usedQuestionIds` |
| G7 | Inject a dead-end cell / make track A one cell longer than B |

A guard that has never been red is blind and must be recorded as such.

### 7.6 Blind guards to reject on sight in this project

- A test asserting `applyEvent` **was called** rather than asserting the resulting state.
- `expect(...).toThrow()` with no error match — accepts any error, including a typo.
- Comparing the harness's expectation to a value produced by the same code under test (self-comparison). G2's expected length must be a hand-written literal.
- Asserting `game.finished === true` without also asserting the outcome, the winner and the question count.
- A fixed pixel/coordinate window for the token position not derived from live layout data (this one belongs to the visual verifier, but rules tests sometimes smuggle it in).

### 7.7 Protocol candidacy

`docs/بروتوكولات/simulated-playthrough.md` is the right home for §7.2–§7.6 — **but I am not writing it now, deliberately.** v3 §8 records techniques *discovered by doing*. There is no code, nothing has been executed, and a protocol written from speculation is exactly the kind of document that gets trusted and is wrong. **Declared as owed:** the protocol becomes due the moment the first rule function and the first harness run exist, and it must then be written by whoever ran it, with real output pasted in. **Debt name:** `simulated-playthrough-protocol-owed`.

---

## 8. Timers — should v1 have a per-question timer?

### 8.1 For

| Argument | Weight |
|---|---|
| Deliberation is the largest variance in session length. The 50 s/question estimate assumes nobody stalls; one team debating for three minutes turns a 27-minute game into 45 | High |
| It gives the operator a **socially neutral** way to end deliberation — "the timer ran out", not "hurry up". When the operator is somebody's uncle, this is genuinely valuable | High |
| Bounded question time ⇒ predictable game length, which makes the §3 table a promise instead of an estimate | Medium |
| It adds tension, which is fun | Medium |

### 8.2 Against

| Argument | Weight |
|---|---|
| It injects **real time** into an otherwise purely event-driven state machine. Pause, resume, what a mid-countdown refresh restores, the operator answering the door — each is a new state and a new bug surface, all of them live-only | High |
| **Media conflict.** A 30 s video inside a 30 s timer is nonsense. The timer must start after playback, which requires a `MEDIA_PLAYING` state and a reliable media-ended event — and `ended` on `<video>`/`<audio>` is not reliable across autoplay policies and codecs. This alone can eat the v1 budget | High |
| The audience is family — children and elderly among them. A countdown pressures exactly the people you least want to pressure, and can make the game feel hostile in a room where it is supposed to be warm | High |
| **There is nothing for the timer to punish.** Under the recommended wrong-answer policy, timeout = wrong = nobody moves, turn passes. Which is what the operator can already do by tapping. The timer's only real teeth are social, and the operator already holds that power | Decisive |

### 8.3 Verdict

**No timer in v1.** The last argument is decisive: in the recommended rules, a timer changes no state that the operator cannot already change with the tap they are making anyway, while importing the only real-time subsystem in the entire application, and colliding with media — the project's other hardest constraint.

**Preconditions for adding one later (write these down now so the decision is evidence-based):** add a per-question countdown only if, across **two real sessions**, the measured median deliberation time (§3.4 instrumentation) exceeds **45 s**, or the measured game length exceeds the 35-minute ceiling for reasons attributable to deliberation rather than media. If added, it requires: a `MEDIA_PLAYING` state, a `TIMED_OUT` event, a declared cost for a timeout, pause/resume, and a rule for what a refresh mid-countdown restores.

**Rejected middle option:** a manual count-up stopwatch the operator may start. It costs one button and no new state — but it is a control on screen that a non-technical operator must learn to ignore, and it does not solve the problem it is aimed at. Recorded here as considered and rejected, not omitted.

---

## 9. Summary of recommendations for v1

| Area | Recommendation | Cost | What it forecloses |
|---|---|---|---|
| Turn model | R4 — app alternates, "directing" shown on screen | Lowest (2 taps/question) | Nothing, **if** `category`/`difficulty` fields exist unused from day one and selection lives behind `selectNextQuestion()` |
| Maze | M1 — fixed drawn path, N stations, one step per correct answer, `event: null` on every cell | Lowest; one completability assertion | Events remain addable as data |
| Track length | N = 10 default; offer 6 / 10 / 14 at setup | One control | Nothing |
| Wrong answer | Nobody moves, turn passes | Zero extra proof | "Steal" remains addable in v2 |
| Ending | R-b equal-attempts completion + tiebreak + seeded visible first-turn draw | 2 states, 1 invariant, reserved tiebreak questions | Nothing |
| Blowout | No mechanic; presentation remedies + short games + easy rematch | Zero | Wager (option E) remains addable |
| Undo | Append-only event log, `fold` for state, unlimited undo, one button | Low, and pays for persistence and debugging simultaneously | Redo (declared out of scope) |
| Persistence | Event log + seed + deck hash, written synchronously each transition; explicit resume prompt | Low | Nothing |
| Timer | None | Zero | Re-openable with measured evidence |

### Named debts carried out of this investigation

| Debt | Meaning |
|---|---|
| `question-cycle-timing-unmeasured` | §3 minutes are estimates until the first instrumented session |
| `simulated-playthrough-protocol-owed` | §7 becomes a protocol file after the first real harness run, not before |
| `maze-completability-undischarged` | The proof in §2.3 cannot be discharged before the user picks the maze model |
| `first-mover-advantage-analytic-only` | The 0.557 figure is a closed-form approximation; G4 must measure it |

### Hand-offs

| Question | Owner |
|---|---|
| Where the session log and the deck physically live; synchronous small store vs IndexedDB; media integrity | `media-storage-expert` |
| How the maze looks, animates and reads from metres away; how "بقي X خطوات" is displayed | `rtl-stage-ux-expert` |
| Build/base path/deploy of the harness output and the game | `static-delivery-expert` |
| Whether events/wagers/steals make it **more fun** for a majlis; how long a session should *feel* | `play-experience-advisor` (user decision) |
| Whether R-b's tiebreak complexity is worth its fairness gain, in feel terms | `play-experience-advisor` (user decision) |

---

## For the user-facing deck

Four choices for the user. Each is described by what happens in the room, not by mechanics. The planner translates to Arabic; minutes and authoring effort are attached to each option. My recommendation is marked, but the choice is the user's.

---

### Choice 1 — Who decides which question gets asked?

| Option | What it feels like at the majlis | Minutes per game | Questions the author must write |
|---|---|---|---|
| **A. The app decides (recommended)** | Team A's name appears: "your turn to put a question to Team B". The question comes up, Team B huddles, answers, the token moves. Fast, no dead air, nobody argues about the pick | **~27 min** (10 stations) | **~30**, a simple list |
| **B. The asking team picks from a board** | Team A sees a board — "عائلة ٢٠٠", "أغاني ٤٠٠" — and picks what to throw at Team B. More theatre, more cheering, and more arguing inside Team A about what to pick | **~32 min** (+5) | **~30, but arranged in a complete grid** — every square must have a question, and a missing square breaks the board |

Note for the user: option A can become option B later without redoing any questions, *if* we decide that now.

---

### Choice 2 — What kind of maze?

| Option | What it feels like at the majlis | Minutes per game | Authoring / art effort |
|---|---|---|---|
| **A. One drawn path, two tracks (recommended)** | A winding, decorated path with ten stations. Each team has a token. Anyone glancing up from across the room instantly sees "they're at 6, we're at 4". The token's position **is** the score | ~27 min | One background illustration. No extra questions |
| **B. Path with surprises** | Same path, but some squares are a shortcut ("jump two ahead!") or a trap ("back one"). Loud moments, big reactions — and the risk that a team loses because of a square, not because of an answer. Somebody will say "that's not fair" | ~24–30 min, less predictable | Same art plus icons. No extra questions, but the game needs more testing before it can be trusted live |
| **C. A new maze every game** | The board is different every night. Novelty on the first game; after that, nobody can read it at a glance and "who's winning?" becomes a question instead of an obvious fact | ~27 min | Cannot be hand-drawn — it is machine-drawn, so it will look plainer. Significantly more work to build and to prove it never produces an unwinnable board |

---

### Choice 3 — Fairness at the end, and what happens in a landslide

| Option | What it feels like at the majlis | Minutes per game | Authoring effort |
|---|---|---|---|
| **A. Straight race, first to the end wins** | Clean and simple. But whoever goes first wins about **56 out of 100** games just from going first — and the second team may lose *before getting their last turn*, which is the moment people say the game is unfair | ~27 min | ~30 questions |
| **B. Equal turns for both, then a decider (recommended)** | Nobody ever loses without having had exactly as many chances as the other team. If both finish level, one final decider question settles it — the loudest moment of the night. Fully 50/50 by turn order | ~28 min (+1) | ~30 questions **plus 2–3 questions reserved for the decider** |
| **C. Help the trailing team catch up** | If a team falls far behind, the board helps them back in. It keeps them in the game — but the team that was winning gets overtaken by the board in front of everyone, and that stings more than losing | ~27 min | ~30 questions, plus more testing |

If the user picks A or B, the landslide case is handled without any mechanic: games are short (a landslide is over in about 13 minutes), the trailing team still gets to direct every question at their opponents, both teams see "X steps remaining", and «لعبة جديدة» is one button away. The rematch is the comeback.

---

### Choice 4 — A countdown on each question?

| Option | What it feels like at the majlis | Minutes per game | Effort |
|---|---|---|---|
| **A. No countdown (recommended)** | The team takes the time it takes. The operator moves things along by simply tapping when they've decided. Warm, unhurried, and works exactly the same for a question with a 30-second video as for a one-line question | ~27 min, but a slow-deliberating group can push it to ~40 | None |
| **B. A countdown per question** | Tension, a ticking clock, a reason to decide. But it presses hardest on the children and the elders in the room, it has to be paused whenever life interrupts, and it fights with video and audio questions — a 30-second clip inside a 30-second clock does not work, so the clock has to wait for the media to end, which is the fiddliest part of the whole app | ~25 min, more predictable | Meaningful extra build and testing; the only part of the game that runs on a real clock |

Suggestion: start without it, measure how long teams actually take on the first two real nights, and add it only if the answer is "too long". That way the decision is made from what actually happened in the majlis, not from a guess.
