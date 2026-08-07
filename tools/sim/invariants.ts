/**
 * I1–I10 checks, independently derived from the log and from `src/contracts`
 * types — never by re-deriving what the reducer already computed for the
 * same field (v3 §4 rule 4 / §7.6: "never compare the code under test to a
 * value produced by the same code"). Where an invariant needs "was this
 * answer correct", it reads `ANSWER_CHOSEN.correct` from the log directly,
 * not `MOVE_APPLIED.delta` (the field a "grant a step on a wrong answer"
 * mutation corrupts — the exact self-referential bug caught during A1).
 */

import type { GameEvent, GameState, Outcome, Question, StateId } from '../../src/contracts';

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
}

export function freshCounts(): InvariantCounts {
  return { I1: 0, I2: 0, I3: 0, I4: 0, I6: 0, I7: 0, I8: 0, I9: 0, I10: 0 };
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
  GAME_ENDED: ['PROGRESSION_APPLIED', 'FINAL_BALANCING_TURN', 'TIEBREAK'],
};

export function isLegalTransition(fromStateId: StateId, eventType: GameEvent['type']): boolean {
  return LEGAL_TRANSITIONS[eventType].includes(fromStateId);
}

const VALID_OUTCOMES: readonly Outcome[] = ['winA', 'winB', 'draw'];

/**
 * Checks I1, I2, I3, I4, I6, I7, I8, I9, I10 across one full game's log.
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

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    const state = states[i];
    const priorStateId: StateId = i === 0 ? 'SETUP' : (states[i - 1]?.stateId ?? 'SETUP');
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

    // Ground truth for I6, from the log — not from MOVE_APPLIED.delta.
    if (event.type === 'MOVE_APPLIED') {
      const prevEvent = events[i - 1];
      const wasCorrect = prevEvent !== undefined && prevEvent.type === 'ANSWER_CHOSEN' && prevEvent.correct;
      if (wasCorrect) correctByTeam[event.team === 'A' ? 0 : 1]++;
    }
    // I6 — clamped at N, because positions clamp at N while correct-answer
    // count keeps growing through a balancing turn / tiebreak (documented
    // in worklog-A2.md).
    const expectedA = Math.min(state.N, correctByTeam[0]);
    const expectedB = Math.min(state.N, correctByTeam[1]);
    if (state.positions[0] !== expectedA || state.positions[1] !== expectedB) {
      throw new Error(
        `I6 violated (positions=${state.positions.join(',')}, expected=${expectedA},${expectedB}, seed ${seed})`,
      );
    }
    counts.I6 += 2;

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

/** G7 (M1 completability): the shared maze has exactly N+1 cells, and the
 *  goal is reachable at exactly index N — one assertion, as the M1 model
 *  requires (§2.3 of the investigation). */
export function checkG7(seed: number, finalState: GameState): void {
  if (finalState.maze.length !== finalState.N + 1) {
    throw new Error(`G7 violated: seed ${seed} maze.length=${finalState.maze.length} !== N+1=${finalState.N + 1}`);
  }
  const goal = finalState.maze[finalState.maze.length - 1];
  if (!goal || goal.index !== finalState.N) {
    throw new Error(`G7 violated: seed ${seed} goal cell index mismatch`);
  }
}
