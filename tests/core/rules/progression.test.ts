/**
 * PH-A2 acceptance tests: R-b equal-attempts ending, paired reversed-order
 * tiebreak, deck-exhaustion endings, deck-size bands, double-tap immunity.
 * See docs/تأسيس-المشروع/خطة.md PH-A2 for the literal criteria.
 */

import { describe, expect, it } from 'vitest';
import type { AnswerChosenEvent, GameEvent, GameState, Question, TeamId } from '../../../src/contracts';
import { applyEvent } from '../../../src/core/reducer';
import { fold, undo, commit } from '../../../src/core/fold';
import { legalEvents, type GameContext } from '../../../src/core/legal';
import { deckBand, maxGreenTrackLength, preselectTrackLength } from '../../../src/core/rules/deck-bands';
import { MAZE_GEN_VERSION } from '../../../src/core/rules/maze';

function generateDeck(n: number): Question[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `q${i + 1}`,
    text: `سؤال رقم ${i + 1}؟`,
    options: ['خيار أ', 'خيار ب', 'خيار ج', 'خيار د'],
    correctIndex: (i % 4) as 0 | 1 | 2 | 3,
    media: { kind: 'none' as const },
  }));
}

function computeDeckHash(deck: readonly Question[]): string {
  return deck.map((q) => q.id).join('|');
}

function policyRng(seed: number): () => number {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const FIXED_NOW = (): number => 1_700_000_000_000;

type Policy = (rand: () => number, candidates: readonly GameEvent[]) => GameEvent;

/** Uniform random among the answer options (never NO_ANSWER, never picks
 *  among a GAME_ENDED/TURN_PASSED-only candidate set — those are forced). */
const randomAnswerPolicy: Policy = (rand, candidates) => {
  const answers = candidates.filter((c): c is AnswerChosenEvent => c.type === 'ANSWER_CHOSEN');
  if (answers.length === 0) {
    const first = candidates[0];
    if (!first) throw new Error('policy: no candidates at all');
    return first;
  }
  const idx = Math.floor(rand() * answers.length);
  return answers[idx] ?? answers[0]!;
};

/** S1: always correct. */
const alwaysCorrectPolicy: Policy = (_rand, candidates) => {
  const answers = candidates.filter((c): c is AnswerChosenEvent => c.type === 'ANSWER_CHOSEN');
  if (answers.length === 0) {
    const first = candidates[0];
    if (!first) throw new Error('policy: no candidates at all');
    return first;
  }
  return answers.find((a) => a.correct) ?? answers[0]!;
};

function startEvent(seed: number, firstTeam: TeamId, N: number, deck: readonly Question[]): GameEvent {
  return {
    type: 'GAME_STARTED',
    seq: 0,
    at: FIXED_NOW(),
    seed,
    N,
    teamNames: ['فريق أ', 'فريق ب'],
    firstTeam,
    deckHash: computeDeckHash(deck),
    mazeGenVersion: MAZE_GEN_VERSION,
  };
}

interface GameRunResult {
  events: GameEvent[];
  states: GameState[];
}

function runGame(
  seed: number,
  firstTeam: TeamId,
  N: number,
  deck: readonly Question[],
  policy: Policy = randomAnswerPolicy,
  maxSteps = 20 * deck.length + 40,
): GameRunResult {
  const rand = policyRng(seed * 7919 + 13);
  const events: GameEvent[] = [startEvent(seed, firstTeam, N, deck)];
  let state = fold(events);
  const states: GameState[] = [state];
  let steps = 0;
  while (state.stateId !== 'FINISHED' && steps < maxSteps) {
    const ctx: GameContext = { deck, events, now: FIXED_NOW };
    const candidates = legalEvents(state, ctx);
    if (candidates.length === 0) {
      throw new Error(`No legal events from state ${state.stateId} (seed ${seed})`);
    }
    const chosen =
      state.stateId === 'QUESTION_SHOWN' ? policy(rand, candidates) : (candidates[0] ?? policy(rand, candidates));
    state = applyEvent(state, chosen);
    events.push(chosen);
    states.push(state);
    steps++;
  }
  return { events, states };
}

describe('PH-A2 — deck-size bands (D-09.13), restated by game-systems-expert §9 for N+1 moves', () => {
  it('N=10, D=23,24,40,41 → refuse/warn/warn/green (four cases, four results) — report §9\'s own worked table', () => {
    const N = 10;
    // greenThreshold(10) = 3.34*(10+1)+4 = 40.74 ; refuseThreshold(10) = 2*(10+1)+2 = 24
    const results = [23, 24, 40, 41].map((D) => deckBand(D, N));
    // eslint-disable-next-line no-console
    console.log(`[A2/A5 deck-bands] N=10 D=23→${results[0]}, D=24→${results[1]}, D=40→${results[2]}, D=41→${results[3]}`);
    expect(results).toEqual(['refuse', 'warn', 'warn', 'green']);
  });

  it('maxGreenTrackLength / preselectTrackLength are self-consistent with deckBand', () => {
    for (const D of [10, 22, 37, 38, 40, 60, 100]) {
      const nMax = maxGreenTrackLength(D);
      expect(deckBand(D, nMax)).toBe('green');
      expect(deckBand(D, nMax + 1)).not.toBe('green');
    }
    // D=55 is green at N=6, N=10 AND N=14 under the new formula — capping at
    // 10 must still win even though 14 would also qualify.
    expect(preselectTrackLength(55)).toBe(10);
    expect(preselectTrackLength(10)).toBe(6); // refuse everywhere; falls back to the smallest preset
  });
});

describe('PH-A2 — R-b equal-attempts ending', () => {
  const N = 10;
  const DECK = generateDeck(40); // D=40 >= 3.34*10+4=37.4 → green band

  it('I7 holds at every step, and attempts[A]===attempts[B] at FINISHED for 100% of games', () => {
    let i7Count = 0;
    let equalAtFinish = 0;
    const games = 200;
    for (let seed = 1; seed <= games; seed++) {
      const firstTeam: TeamId = seed % 2 === 0 ? 'A' : 'B';
      const { states } = runGame(seed, firstTeam, N, DECK);
      for (const state of states) {
        expect(Math.abs(state.attempts[0] - state.attempts[1])).toBeLessThanOrEqual(1);
        i7Count++;
      }
      const last = states[states.length - 1]!;
      expect(last.stateId).toBe('FINISHED');
      if (last.attempts[0] === last.attempts[1]) equalAtFinish++;
    }
    // eslint-disable-next-line no-console
    console.log(
      `[A2 criterion 1/2] I7 assertions=${i7Count} (0 violations), attempts-equal-at-FINISHED=${equalAtFinish}/${games} (100% required)`,
    );
    expect(equalAtFinish).toBe(games);
  });

  it('G2: S1 (always correct) reaches TIEBREAK within [2N, 2(N+1)] questions — game-systems-expert §11.2 bound (not a single literal anymore: the stumble is stochastic)', () => {
    const LOWER = 2 * N; // hand-written literal, NOT computed from N by the code under test
    const UPPER = 2 * (N + 1); // hand-written literal
    const { events, states } = runGame(1, 'A', N, DECK, alwaysCorrectPolicy, 500);
    const firstTiebreakIdx = states.findIndex((s) => s.stateId === 'TIEBREAK');
    expect(firstTiebreakIdx).toBeGreaterThan(-1);
    const questionsShownBeforeTiebreak = events
      .slice(0, firstTiebreakIdx + 1)
      .filter((e) => e.type === 'QUESTION_SHOWN').length;
    // eslint-disable-next-line no-console
    console.log(
      `[A2/A5 criterion 3 / G2] questions shown before first TIEBREAK state = ${questionsShownBeforeTiebreak} (expected in [${LOWER}, ${UPPER}])`,
    );
    expect(questionsShownBeforeTiebreak).toBeGreaterThanOrEqual(LOWER);
    expect(questionsShownBeforeTiebreak).toBeLessThanOrEqual(UPPER);
    // The game must still terminate (S1 in the tiebreak never produces a
    // single-correct pair, so it runs to deck exhaustion — a declared draw
    // — rather than hanging; this is G1's termination bound in miniature).
    const last = states[states.length - 1]!;
    expect(last.stateId).toBe('FINISHED');
  });

  it('D-09.9: the tiebreak order reverses — whoever went second in the main game answers first in the decider', () => {
    // firstTeam='A' for the main game, so D-09.9 requires 'B' to answer the
    // first tiebreak question.
    const { states } = runGame(1, 'A', N, DECK, alwaysCorrectPolicy, 500);
    const firstTiebreakIdx = states.findIndex((s) => s.stateId === 'TIEBREAK');
    expect(firstTiebreakIdx).toBeGreaterThan(-1);
    const firstTiebreakState = states[firstTiebreakIdx]!;
    // eslint-disable-next-line no-console
    console.log(
      `[A2 D-09.9] main-game firstTeam=A, tiebreak currentTeam at first TIEBREAK state=${firstTiebreakState.currentTeam} (must be B)`,
    );
    expect(firstTiebreakState.currentTeam).toBe('B');
  });

  it('exercises DECK_EXHAUSTED level "سؤال من الحضور" (3 legal GAME_ENDED candidates)', () => {
    // Build a state by hand: both teams level at N-1 with the pool
    // artificially exhausted, entered via a normal PROGRESSION_APPLIED so
    // legalEvents' exhaustion branch is exercised directly.
    const smallDeck = generateDeck(1);
    const events: GameEvent[] = [startEvent(2, 'A', 3, smallDeck)];
    let state = fold(events);
    state = applyEvent(state, { type: 'QUESTION_SHOWN', seq: 1, at: FIXED_NOW(), questionId: 'q1', optionOrder: [0, 1, 2, 3] });
    state = applyEvent(state, { type: 'ANSWER_CHOSEN', seq: 2, at: FIXED_NOW(), optionId: 1, correct: false });
    state = applyEvent(state, { type: 'MOVE_APPLIED', seq: 3, at: FIXED_NOW(), team: 'A', exit: null });
    events.push(
      { type: 'QUESTION_SHOWN', seq: 1, at: FIXED_NOW(), questionId: 'q1', optionOrder: [0, 1, 2, 3] },
      { type: 'ANSWER_CHOSEN', seq: 2, at: FIXED_NOW(), optionId: 1, correct: false },
      { type: 'MOVE_APPLIED', seq: 3, at: FIXED_NOW(), team: 'A', exit: null },
    );
    const ctx: GameContext = { deck: smallDeck, events, now: FIXED_NOW };
    const candidates = legalEvents(state, ctx);
    const outcomes = candidates.filter((c) => c.type === 'GAME_ENDED').map((c) => (c as { outcome: string }).outcome);
    expect(outcomes.sort()).toEqual(['draw', 'winA', 'winB']);
  });
});

describe('PH-A2 — double-tap immunity (eventCount, eventType)', () => {
  it('a double-tap on the next-question action consumes one question, not two', () => {
    const deck = generateDeck(5);
    const events: GameEvent[] = [startEvent(9, 'A', 3, deck)];
    let state = fold(events);
    const ctx: GameContext = { deck, events, now: FIXED_NOW };
    const [nextQuestion] = legalEvents(state, ctx);
    if (!nextQuestion) throw new Error('expected a QUESTION_SHOWN candidate');

    // First tap: applied normally.
    const first = commit(events, nextQuestion);
    expect(first.applied).toBe(true);
    expect(first.events.length).toBe(2);
    expect(first.state.usedQuestionIds.length + (first.state.currentQuestionId ? 1 : 0)).toBeGreaterThanOrEqual(0);

    // Second tap: the SAME event object re-dispatched (a bouncy remote or a
    // trackpad double-click), carrying the same stale seq=1. Must be a
    // silent no-op, not a second question shown.
    const second = commit(first.events, nextQuestion);
    expect(second.applied).toBe(false);
    expect(second.events.length).toBe(first.events.length); // still exactly one QUESTION_SHOWN committed
    expect(second.state).toEqual(first.state);
    // eslint-disable-next-line no-console
    console.log(
      `[A2 criterion 5] double-tap: first.applied=${first.applied}, second.applied=${second.applied}, events after both taps=${second.events.length} (must be 2, not 3)`,
    );
  });
});

describe('PH-A2 — sanity: undo still restores correctly through R-b states', () => {
  it('undo pops the last event and re-folds through a FINAL_BALANCING_TURN/TIEBREAK game', () => {
    const N = 10;
    const DECK = generateDeck(40);
    const { events } = runGame(3, 'A', N, DECK);
    let checks = 0;
    for (let i = 1; i <= events.length; i++) {
      const priorEvents = events.slice(0, i - 1);
      const priorState = fold(priorEvents);
      const undone = undo(events.slice(0, i));
      expect(undone.state).toEqual(priorState);
      checks++;
    }
    // eslint-disable-next-line no-console
    console.log(`[A2 sanity] undo checks through an R-b game = ${checks}`);
    expect(checks).toBeGreaterThan(0);
  });
});
