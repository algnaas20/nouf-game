/**
 * I1–I15 checks, independently derived from the log and from `src/contracts`
 * types — never by re-deriving what the reducer already computed for the
 * same field (v3 §4 rule 4 / §7.6: "never compare the code under test to a
 * value produced by the same code"). Where an invariant needs "was this
 * answer correct", it reads `ANSWER_CHOSEN.correct` from the log directly,
 * not `MOVE_APPLIED`'s own team field alone. Where an invariant needs "was
 * this a dead end", it replays `MOVE_APPLIED.exit` against a FRESH
 * `buildMaze(seed, N)` call — never against `state.wasted`/`state.closedExits`
 * themselves, and never by calling `resolveMove` (which would make the
 * check blind to a mutation IN `resolveMove` — the exact trap I11's
 * mutation test exists to catch; see worklog-A5.md).
 */

import type { GameEvent, GameState, Outcome, Question, StateId, TeamId } from '../../src/contracts';
import { buildMaze, EXITS_PER_JUNCTION, MAZE_GEN_VERSION } from '../../src/core/rules/maze';

export interface InvariantCounts {
  I1: number;
  I2: number;
  I3: number;
  I4: number;
  I6: number;
  I7: number;
  I8: number;
  I9: number;
  I10: number;
  I11: number;
  I12: number;
  I13: number;
  I14: number;
  /** N/A here by design (game-systems-expert §11.1): I15 ("no DOM node
   *  carries deadEndExit before that exit is chosen") is a DOM/visual
   *  concern with nothing to inspect in a headless simulation — it is the
   *  visual verifier's guard, not this harness's. Always 0; never incremented. */
  I15: number;
}

export function freshCounts(): InvariantCounts {
  return { I1: 0, I2: 0, I3: 0, I4: 0, I6: 0, I7: 0, I8: 0, I9: 0, I10: 0, I11: 0, I12: 0, I13: 0, I14: 0, I15: 0 };
}

export function mergeCounts(a: InvariantCounts, b: InvariantCounts): InvariantCounts {
  return {
    I1: a.I1 + b.I1,
    I2: a.I2 + b.I2,
    I3: a.I3 + b.I3,
    I4: a.I4 + b.I4,
    I6: a.I6 + b.I6,
    I7: a.I7 + b.I7,
    I8: a.I8 + b.I8,
    I9: a.I9 + b.I9,
    I10: a.I10 + b.I10,
    I11: a.I11 + b.I11,
    I12: a.I12 + b.I12,
    I13: a.I13 + b.I13,
    I14: a.I14 + b.I14,
    I15: a.I15 + b.I15,
  };
}

/** I8's independently hand-written reference transition table — matches
 *  the frozen 10-state contract plus the R-b extension documented in
 *  worklog-A2.md, NOT copied from `reducer.ts`'s guard clauses (written
 *  fresh from the state table in game-rules-and-maze-investigation.md §6.1
 *  and the ruling's D-09.7/D-09.9). */
const LEGAL_TRANSITIONS: Record<GameEvent['type'], readonly StateId[]> = {
  GAME_STARTED: ['SETUP'],
  QUESTION_SHOWN: ['TURN_START', 'FINAL_BALANCING_TURN', 'TIEBREAK'],
  ANSWER_CHOSEN: ['QUESTION_SHOWN'],
  NO_ANSWER: ['QUESTION_SHOWN'],
  MOVE_APPLIED: ['ANSWER_REVEALED'],
  TURN_PASSED: ['PROGRESSION_APPLIED'],
  // F-2: TURN_START added — the empty-deck-at-game-start declared-draw path
  // (worklog-A5.md §1) applies GAME_ENDED directly from TURN_START.
  GAME_ENDED: ['PROGRESSION_APPLIED', 'FINAL_BALANCING_TURN', 'TIEBREAK', 'TURN_START'],
};

export function isLegalTransition(fromStateId: StateId, eventType: GameEvent['type']): boolean {
  return LEGAL_TRANSITIONS[eventType].includes(fromStateId);
}

const VALID_OUTCOMES: readonly Outcome[] = ['winA', 'winB', 'draw'];

function idxOf(team: TeamId): 0 | 1 {
  return team === 'A' ? 0 : 1;
}

/**
 * Checks I1–I15 (I15 excepted, see above) across one full game's log.
 * Throws with the specific invariant name and seed on the first violation
 * (G1's "fail loudly instead of hanging" spirit, applied to invariants too).
 */
export function checkGameInvariants(
  seed: number,
  events: readonly GameEvent[],
  states: readonly GameState[],
  deck: readonly Question[],
): InvariantCounts {
  const counts = freshCounts();
  const correctByTeam: [number, number] = [0, 0];
  const shownQuestionIds: string[] = [];

  const firstStarted = events[0];
  const N = firstStarted && firstStarted.type === 'GAME_STARTED' ? firstStarted.N : (states[0]?.N ?? 0);
  // I6'/I11/I12/I13 ground truth: replayed independently against a FRESH
  // buildMaze(seed, N) call — see the file header for why this must not
  // reuse resolveMove or read state.wasted/state.closedExits as ground truth.
  const layout = buildMaze(seed, N);
  const localJunction: [number, number] = [0, 0];
  const localWasted: [number, number] = [0, 0];
  const localClosed: [number[], number[]] = [[], []];

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    const state = states[i];
    const priorState = i === 0 ? undefined : states[i - 1];
    const priorStateId: StateId = i === 0 ? 'SETUP' : (priorState?.stateId ?? 'SETUP');
    if (!event || !state) throw new Error(`invariants: missing event/state at index ${i} (seed ${seed})`);

    // I1
    if (state.positions[0] < 0 || state.positions[0] > state.N) {
      throw new Error(`I1 violated (team A position=${state.positions[0]}, N=${state.N}, seed ${seed})`);
    }
    if (state.positions[1] < 0 || state.positions[1] > state.N) {
      throw new Error(`I1 violated (team B position=${state.positions[1]}, N=${state.N}, seed ${seed})`);
    }
    counts.I1 += 2;

    // I2
    if (state.stateId !== 'SETUP' && state.stateId !== 'FINISHED') {
      if (state.currentTeam !== 'A' && state.currentTeam !== 'B') {
        throw new Error(`I2 violated (seed ${seed})`);
      }
    }
    counts.I2++;

    // I3 — two independent checks: the state's own bookkeeping, AND a tally
    // built purely from QUESTION_SHOWN events (immune to a mutation that
    // stops updating usedQuestionIds — see worklog-A1.md's own blind-guard note).
    if (new Set(state.usedQuestionIds).size !== state.usedQuestionIds.length) {
      throw new Error(`I3 violated: state.usedQuestionIds has a duplicate (seed ${seed})`);
    }
    if (event.type === 'QUESTION_SHOWN') shownQuestionIds.push(event.questionId);
    if (new Set(shownQuestionIds).size !== shownQuestionIds.length) {
      throw new Error(`I3 violated: a question was shown twice (seed ${seed})`);
    }
    counts.I3++;

    // I4
    if (state.stateId === 'QUESTION_SHOWN') {
      const inDeck = deck.some((q) => q.id === state.currentQuestionId);
      const notUsed = state.currentQuestionId !== null && !state.usedQuestionIds.includes(state.currentQuestionId);
      if (!inDeck || !notUsed) throw new Error(`I4 violated (seed ${seed})`);
      counts.I4++;
    }

    // I7
    if (Math.abs(state.attempts[0] - state.attempts[1]) > 1) {
      throw new Error(`I7 violated (attempts=${state.attempts.join(',')}, seed ${seed})`);
    }
    counts.I7++;

    // I8
    if (!isLegalTransition(priorStateId, event.type)) {
      throw new Error(`I8 violated: ${event.type} from ${priorStateId} not in the reference table (seed ${seed})`);
    }
    counts.I8++;

    if (event.type === 'MOVE_APPLIED') {
      const idx = idxOf(event.team);

      // I13 — checked against the PRIOR state (the junction/closedExits the
      // operator was actually offered at the moment this event was chosen).
      if (priorState) {
        const priorJunctionIndex = priorState.positions[idx];
        const priorJunction = layout.routes[idx]!.junctions[priorJunctionIndex];
        const validExit =
          event.exit === null ||
          (priorJunction !== undefined &&
            event.exit >= 0 &&
            event.exit < priorJunction.exits &&
            !priorState.closedExits[idx].includes(event.exit));
        if (!validExit) {
          throw new Error(
            `I13 violated: MOVE_APPLIED.exit=${String(event.exit)} illegal at junction ${priorJunctionIndex} (closedExits=${priorState.closedExits[idx].join(',')}, seed ${seed})`,
          );
        }
        counts.I13++;
      }

      // Ground truth for "was this a correct answer", from the log — not
      // from any reducer-computed field.
      const prevEvent = events[i - 1];
      const wasCorrect = prevEvent !== undefined && prevEvent.type === 'ANSWER_CHOSEN' && prevEvent.correct;
      if (wasCorrect) correctByTeam[idx]++;

      // Independent replay of the one-stumble rule, against the FRESHLY
      // rebuilt layout (never against resolveMove/state.wasted — see header).
      if (event.exit !== null && localJunction[idx] < N) {
        const junction = layout.routes[idx]!.junctions[localJunction[idx]]!;
        if (event.exit === junction.deadEndExit && localWasted[idx] === 0) {
          localWasted[idx]++;
          localClosed[idx] = [...localClosed[idx], event.exit];
        } else {
          localJunction[idx]++;
          localClosed[idx] = [];
        }
      }
    }

    // I6' — position[t] === min(N, correct[t] - wasted[t]); wasted[t] itself
    // independently replayed above, never read back from state.wasted.
    const expectedA = Math.min(N, correctByTeam[0] - localWasted[0]);
    const expectedB = Math.min(N, correctByTeam[1] - localWasted[1]);
    if (state.positions[0] !== expectedA || state.positions[1] !== expectedB) {
      throw new Error(
        `I6' violated (positions=${state.positions.join(',')}, expected=${expectedA},${expectedB}, seed ${seed})`,
      );
    }
    if (state.wasted[0] !== localWasted[0] || state.wasted[1] !== localWasted[1]) {
      throw new Error(
        `I6' violated: state.wasted=${state.wasted.join(',')} !== independently-replayed ${localWasted.join(',')} (seed ${seed})`,
      );
    }
    counts.I6 += 4;

    // I11 — wasted[t] ∈ {0, 1} at every step, both teams.
    for (const w of state.wasted) {
      if (w !== 0 && w !== 1) throw new Error(`I11 violated: wasted=${state.wasted.join(',')} (seed ${seed})`);
    }
    counts.I11 += 2;

    // I12 — closedExits[t] has no duplicates and length <= exits - 1; a
    // junction can never be fully closed.
    for (const closed of state.closedExits) {
      if (new Set(closed).size !== closed.length) {
        throw new Error(`I12 violated: closedExits has a duplicate (${closed.join(',')}, seed ${seed})`);
      }
      if (closed.length > EXITS_PER_JUNCTION - 1) {
        throw new Error(`I12 violated: closedExits.length=${closed.length} > exits-1 (seed ${seed})`);
      }
    }
    counts.I12 += 2;

    // I9
    if (state.stateId !== 'FINISHED' && state.outcome !== null) {
      throw new Error(`I9 violated: outcome set before FINISHED (seed ${seed})`);
    }
    if (state.stateId === 'FINISHED' && !VALID_OUTCOMES.includes(state.outcome as Outcome)) {
      throw new Error(`I9 violated: invalid outcome at FINISHED (seed ${seed})`);
    }
    counts.I9++;

    // I10
    const roundTripped = JSON.parse(JSON.stringify(state)) as GameState;
    if (JSON.stringify(roundTripped) !== JSON.stringify(state)) {
      throw new Error(`I10 violated: serialize/deserialize round-trip mismatch (seed ${seed})`);
    }
    counts.I10++;

    // I14 — buildMaze purity + version stamp (the stream-independence half
    // of I14 is a generator-only property, checked once per seed by
    // `checkGeneratorStructure`/S12 below, not per game step here).
    if (state.stateId !== 'SETUP') {
      if (state.maze.genVersion !== MAZE_GEN_VERSION) {
        throw new Error(`I14 violated: maze.genVersion=${state.maze.genVersion} !== ${MAZE_GEN_VERSION} (seed ${seed})`);
      }
      counts.I14++;
    }
  }

  return counts;
}

export function checkG1(seed: number, events: readonly GameEvent[], deck: readonly Question[]): void {
  const maxTransitions = 20 * deck.length;
  if (events.length > maxTransitions) {
    throw new Error(`G1 violated: seed ${seed} used ${events.length} > maxTransitions=${maxTransitions}`);
  }
}

export function checkG3(seed: number, finalState: GameState): void {
  if (finalState.stateId !== 'FINISHED') throw new Error(`G3 violated: seed ${seed} not FINISHED`);
  if (finalState.positions[0] !== 0 || finalState.positions[1] !== 0) {
    throw new Error(`G3 violated: seed ${seed} positions ${finalState.positions.join(',')} !== [0,0]`);
  }
  if (finalState.outcome !== 'draw') {
    throw new Error(`G3 violated: seed ${seed} outcome ${String(finalState.outcome)} !== 'draw'`);
  }
}

/**
 * G7' — completability, restated for the branching-maze model
 * (game-systems-expert §11.2). Purely structural: every route has exactly
 * `N` junctions, every junction has `exits >= 2` and `deadEndExit ∈
 * [-1, exits)`, and — M-GEN-1 — the two teams' routes never share a
 * junction. No BFS, ever; Theorem 1 (§6.1) is what makes that legitimate.
 *
 * "cells(A) ∩ cells(B) = {goal}" (§2.3/§10.5) is checked here as reference
 * identity of `MazeJunction` objects: `buildMaze` never has any legitimate
 * reason to let a junction object be shared between `routes[0]` and
 * `routes[1]` (each route's junctions are always fresh object literals —
 * see `src/core/rules/maze.ts`'s header). The "goal" itself is not a
 * `MazeJunction` at all — it is reached one step past a route's last
 * index — so it is trivially the sole point where the two routes converge:
 * nothing in the type ever represents it as a shared, indexable cell.
 */
export function checkGeneratorStructure(seed: number, N: number): void {
  const layout = buildMaze(seed, N);
  if (layout.N !== N) throw new Error(`G7' violated: seed ${seed} layout.N=${layout.N} !== ${N}`);
  if (layout.genVersion !== MAZE_GEN_VERSION) {
    throw new Error(`G7' violated: seed ${seed} genVersion=${layout.genVersion} !== ${MAZE_GEN_VERSION}`);
  }
  const [routeA, routeB] = layout.routes;
  for (const route of [routeA, routeB]) {
    if (route.junctions.length !== N) {
      throw new Error(`G7' violated: seed ${seed} team ${route.team} has ${route.junctions.length} junctions !== N=${N}`);
    }
    for (const junction of route.junctions) {
      if (junction.exits < 2) {
        throw new Error(`G7' violated: seed ${seed} team ${route.team} junction ${junction.index} exits=${junction.exits} < 2`);
      }
      if (junction.deadEndExit < -1 || junction.deadEndExit >= junction.exits) {
        throw new Error(
          `G7' violated: seed ${seed} team ${route.team} junction ${junction.index} deadEndExit=${junction.deadEndExit} out of [-1,${junction.exits})`,
        );
      }
      // "at most one dead end per junction" is structural: deadEndExit is a
      // single scalar field, never a set — there is nothing else to check.
    }
  }
  // M-GEN-1: no MazeJunction object is shared by reference between the two
  // routes (the mutation test aliases one deliberately — see run.ts's S12).
  const setA = new Set(routeA.junctions);
  for (const j of routeB.junctions) {
    if (setA.has(j)) {
      throw new Error(`G7'/M-GEN-1 violated: seed ${seed} routes share a junction object at index ${j.index}`);
    }
  }
}

/** The second half of G7': every simulated game finishes in <= N+1 moves
 *  per team (Theorem 1's move bound), counted from MOVE_APPLIED events with
 *  a real (non-null) exit — advances AND dead ends both count as "a move". */
export function checkG7MoveBound(seed: number, events: readonly GameEvent[], N: number): void {
  const moveCount: [number, number] = [0, 0];
  for (const e of events) {
    if (e.type === 'MOVE_APPLIED' && e.exit !== null) moveCount[idxOf(e.team)]++;
  }
  for (const idx of [0, 1] as const) {
    if (moveCount[idx] > N + 1) {
      throw new Error(`G7' move bound violated: seed ${seed} team ${idx === 0 ? 'A' : 'B'} used ${moveCount[idx]} moves > N+1=${N + 1}`);
    }
  }
}

/**
 * G8 — P(theft) === 0 exactly (game-systems-expert §11.2, "the acceptance
 * test of this entire redesign"). Theft: the winning team's independently-
 * tallied correct-answer count is strictly less than the loser's. Draws
 * have no winner and are skipped. Throws on the FIRST occurrence — per the
 * report, "any non-zero value is an implementation bug, not a design
 * tolerance", so this is a hard per-game guard, not a soft aggregate stat.
 */
export function checkNoTheft(seed: number, events: readonly GameEvent[], finalState: GameState): void {
  if (finalState.outcome === null || finalState.outcome === 'draw') return;
  const correctByTeam: [number, number] = [0, 0];
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (e?.type === 'MOVE_APPLIED') {
      const prev = events[i - 1];
      if (prev?.type === 'ANSWER_CHOSEN' && prev.correct) correctByTeam[idxOf(e.team)]++;
    }
  }
  const winnerIdx = finalState.outcome === 'winA' ? 0 : 1;
  const loserIdx = winnerIdx === 0 ? 1 : 0;
  if (correctByTeam[winnerIdx] < correctByTeam[loserIdx]) {
    throw new Error(
      `G8 VIOLATED (theft): seed ${seed} winner correct=${correctByTeam[winnerIdx]} < loser correct=${correctByTeam[loserIdx]}`,
    );
  }
}
