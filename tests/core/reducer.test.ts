/**
 * PH-A1 acceptance tests. See docs/تأسيس-المشروع/تقارير/planner/executor-prompts-2026-08-07.md
 * (PROMPT A1) for the literal criteria this file proves.
 *
 * Deck: 3 hardcoded text questions. N=2. Random policy: always answer,
 * option 0..3 chosen uniformly by a seeded PRNG independent of the game RNG.
 */

import { describe, expect, it } from 'vitest';
import type { GameEvent, GameState, Question, TeamId } from '../../src/contracts';
import { applyEvent, IllegalTransitionError, initialState } from '../../src/core/reducer';
import { fold, undo } from '../../src/core/fold';
import { legalEvents, type GameContext } from '../../src/core/legal';
import { buildMaze, MAZE_GEN_VERSION } from '../../src/core/rules/maze';

const DECK: Question[] = [
  {
    id: 'q1',
    text: 'ما عاصمة السعودية؟',
    options: ['الرياض', 'جدة', 'الدمام', 'مكة'],
    correctIndex: 0,
    media: { kind: 'none' },
  },
  {
    id: 'q2',
    text: 'كم عدد أيام الأسبوع؟',
    options: ['خمسة', 'ستة', 'سبعة', 'ثمانية'],
    correctIndex: 2,
    media: { kind: 'none' },
  },
  {
    id: 'q3',
    text: 'ما لون السماء؟',
    options: ['أحمر', 'أزرق', 'أخضر', 'أصفر'],
    correctIndex: 1,
    media: { kind: 'none' },
  },
];

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

function startGame(
  seed: number,
  firstTeam: TeamId,
  N: number,
  deck: readonly Question[],
): GameEvent[] {
  const started: GameEvent = {
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
  return [started];
}

interface GameRunResult {
  events: GameEvent[];
  /** states[i] = fold(events.slice(0, i + 1)) */
  states: GameState[];
}

function runGame(
  seed: number,
  firstTeam: TeamId,
  N: number,
  deck: readonly Question[],
  strict = true,
): GameRunResult {
  const rand = policyRng(seed * 7919 + 13);
  const events = startGame(seed, firstTeam, N, deck);
  let state = fold(events);
  const states: GameState[] = [state];
  const maxSteps = 20 * deck.length + 20; // generous safety net well above what a 3-question deck needs
  let steps = 0;
  while (state.stateId !== 'FINISHED' && steps < maxSteps) {
    const ctx: GameContext = { deck, events, now: FIXED_NOW };
    const candidates = legalEvents(state, ctx);
    if (candidates.length === 0) {
      throw new Error(`No legal events from state ${state.stateId} (seed ${seed})`);
    }
    let chosen: GameEvent;
    if (state.stateId === 'QUESTION_SHOWN') {
      // Random policy: always answer (never NO_ANSWER), option chosen uniformly.
      const optionId = Math.floor(rand() * 4) as 0 | 1 | 2 | 3;
      const found = candidates.find((c) => c.type === 'ANSWER_CHOSEN' && c.optionId === optionId);
      if (!found) throw new Error('policy: expected ANSWER_CHOSEN candidate not found');
      chosen = found;
    } else {
      const first = candidates[0];
      if (!first) throw new Error('unreachable: candidates.length checked above');
      chosen = first;
    }
    state = applyEvent(state, chosen);
    events.push(chosen);
    states.push(state);
    steps++;
  }
  if (state.stateId !== 'FINISHED' && strict) {
    throw new Error(`Game (seed ${seed}) did not finish within ${maxSteps} steps`);
  }
  return { events, states };
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

const N = 2;
const MAX_TRANSITIONS = 20 * DECK.length; // 60, per PROMPT A1 acceptance criterion 1

describe('PH-A1 — minimal core: 100 seeded games, N=2, 3-question deck, random policy', () => {
  it('criterion 1: 100/100 games reach FINISHED within 20*deckSize transitions', () => {
    let finished = 0;
    let maxEvents = 0;
    let totalEvents = 0;
    for (let seed = 1; seed <= 100; seed++) {
      const firstTeam: TeamId = seed % 2 === 0 ? 'A' : 'B';
      const { events, states } = runGame(seed, firstTeam, N, DECK);
      const last = states[states.length - 1];
      expect(last?.stateId).toBe('FINISHED');
      expect(events.length).toBeLessThanOrEqual(MAX_TRANSITIONS);
      finished++;
      maxEvents = Math.max(maxEvents, events.length);
      totalEvents += events.length;
    }
    // eslint-disable-next-line no-console
    console.log(
      `[A1 criterion 1] finished=${finished}/100, maxTransitions allowed=${MAX_TRANSITIONS}, observed max events=${maxEvents}, avg events=${(totalEvents / 100).toFixed(2)}`,
    );
    expect(finished).toBe(100);
  });

  it('criterion 2+3: I1, I3, I6′, I7 hold at every step of every game; counts printed', () => {
    let i1Count = 0;
    let i3Count = 0;
    let i6Count = 0;
    let i7Count = 0;
    for (let seed = 1; seed <= 100; seed++) {
      const firstTeam: TeamId = seed % 2 === 0 ? 'A' : 'B';
      // strict=false: an I3-breaking mutation can make the game loop
      // without ever reaching FINISHED; let the invariant checks below
      // catch the real defect within the collected prefix instead of a
      // generic "did not finish" harness error.
      const { events, states } = runGame(seed, firstTeam, N, DECK, false);
      // Independently tracked (from the log, not from state.positions) so
      // this catches any accidental extra movement anywhere in the codebase.
      const correctByTeam: [number, number] = [0, 0];
      // Independently tracked from QUESTION_SHOWN events themselves — not
      // from state.usedQuestionIds — so a mutation that stops updating
      // usedQuestionIds cannot hide a repeated question behind a
      // trivially-still-unique empty array.
      const shownQuestionIds: string[] = [];
      // I6' ground truth: replayed against a FRESH buildMaze(seed, N) call,
      // never against state.maze/state.wasted themselves (the exact
      // self-referential shortcut worklog-A1.md warned against for I6).
      const layout = buildMaze(seed, N);
      const localJunction: [number, number] = [0, 0];
      const localWasted: [number, number] = [0, 0];
      const localClosed: [number[], number[]] = [[], []];
      for (let i = 0; i < events.length; i++) {
        const ev = events[i];
        const state = states[i];
        if (!ev || !state) throw new Error('unreachable');

        // I1: 0 <= position[t] <= N for both teams.
        expect(state.positions[0]).toBeGreaterThanOrEqual(0);
        expect(state.positions[0]).toBeLessThanOrEqual(N);
        expect(state.positions[1]).toBeGreaterThanOrEqual(0);
        expect(state.positions[1]).toBeLessThanOrEqual(N);
        i1Count += 2;

        // I3: no question asked twice — checked two ways: the state's own
        // usedQuestionIds bookkeeping, and an independent tally from the
        // raw QUESTION_SHOWN events in the log.
        expect(new Set(state.usedQuestionIds).size).toBe(state.usedQuestionIds.length);
        if (ev.type === 'QUESTION_SHOWN') shownQuestionIds.push(ev.questionId);
        expect(new Set(shownQuestionIds).size).toBe(shownQuestionIds.length);
        i3Count++;

        // I7: |attempts[A] - attempts[B]| <= 1 at all times.
        expect(Math.abs(state.attempts[0] - state.attempts[1])).toBeLessThanOrEqual(1);
        i7Count++;

        if (ev.type === 'MOVE_APPLIED') {
          // Ground truth for "was this a correct answer" comes from the
          // ANSWER_CHOSEN event that preceded this MOVE_APPLIED —
          // deliberately NOT from any reducer-computed field.
          const prev = events[i - 1];
          const wasCorrect = prev !== undefined && prev.type === 'ANSWER_CHOSEN' && prev.correct;
          const idx = ev.team === 'A' ? 0 : 1;
          if (wasCorrect) correctByTeam[idx]++;

          // Independent replay of the one-stumble rule itself, against the
          // freshly-rebuilt layout — not against resolveMove (mutating
          // resolveMove must NOT make this check blind, per worklog-A5.md).
          if (ev.exit !== null && localJunction[idx] < N) {
            const junction = layout.routes[idx]!.junctions[localJunction[idx]]!;
            if (ev.exit === junction.deadEndExit && localWasted[idx] === 0) {
              localWasted[idx]++;
              localClosed[idx] = [...localClosed[idx], ev.exit];
            } else {
              localJunction[idx]++;
              localClosed[idx] = [];
            }
          }
        }

        // I6': position[t] === min(N, correct[t] - wasted[t]).
        const expectedA = Math.min(N, correctByTeam[0] - localWasted[0]);
        const expectedB = Math.min(N, correctByTeam[1] - localWasted[1]);
        expect(state.positions[0]).toBe(expectedA);
        expect(state.positions[1]).toBe(expectedB);
        expect(state.wasted[0]).toBe(localWasted[0]);
        expect(state.wasted[1]).toBe(localWasted[1]);
        i6Count += 4;
      }
    }
    // eslint-disable-next-line no-console
    console.log(
      `[A1 criterion 2/3] I1=${i1Count} assertions, I3=${i3Count} assertions, I6'=${i6Count} assertions, I7=${i7Count} assertions (all must be > 0)`,
    );
    expect(i1Count).toBeGreaterThan(0);
    expect(i3Count).toBeGreaterThan(0);
    expect(i6Count).toBeGreaterThan(0);
    expect(i7Count).toBeGreaterThan(0);
  });

  it('criterion 3 (I5): an illegal event throws and leaves state deep-equal to its pre-call value', () => {
    let i5Checks = 0;

    // 1. MOVE_APPLIED is illegal from the bootstrap SETUP state.
    const s0 = initialState();
    const illegalFromSetup: GameEvent = {
      type: 'MOVE_APPLIED',
      seq: 0,
      at: FIXED_NOW(),
      team: 'A',
      exit: 0,
    };
    const beforeS0 = deepClone(s0);
    expect(() => applyEvent(s0, illegalFromSetup)).toThrow(IllegalTransitionError);
    expect(s0).toEqual(beforeS0);
    i5Checks++;

    // 2. A double-tap: QUESTION_SHOWN is legal once from TURN_START, but a
    //    second QUESTION_SHOWN from the resulting QUESTION_SHOWN state is not.
    const started: GameEvent = {
      type: 'GAME_STARTED',
      seq: 0,
      at: FIXED_NOW(),
      seed: 1,
      N: 2,
      teamNames: ['فريق أ', 'فريق ب'],
      firstTeam: 'A',
      deckHash: computeDeckHash(DECK),
      mazeGenVersion: MAZE_GEN_VERSION,
    };
    const s1 = applyEvent(s0, started);
    const shown: GameEvent = {
      type: 'QUESTION_SHOWN',
      seq: 1,
      at: FIXED_NOW(),
      questionId: 'q1',
      optionOrder: [0, 1, 2, 3],
    };
    const s2 = applyEvent(s1, shown);
    const beforeS2 = deepClone(s2);
    expect(() => applyEvent(s2, shown)).toThrow(IllegalTransitionError);
    expect(s2).toEqual(beforeS2);
    i5Checks++;

    // 3. GAME_ENDED is illegal except from PROGRESSION_APPLIED.
    const illegalGameEnded: GameEvent = {
      type: 'GAME_ENDED',
      seq: 2,
      at: FIXED_NOW(),
      outcome: 'winA',
    };
    const beforeS2b = deepClone(s2);
    expect(() => applyEvent(s2, illegalGameEnded)).toThrow(IllegalTransitionError);
    expect(s2).toEqual(beforeS2b);
    i5Checks++;

    // eslint-disable-next-line no-console
    console.log(`[A1 criterion 3] I5 checks=${i5Checks} (all threw and left state unchanged)`);
    expect(i5Checks).toBeGreaterThan(0);
  });

  it('criterion 4: undo(apply(s,e)) deep-equals s at every step, incl. usedQuestionIds and RNG drawIndex (>=1000 checks)', () => {
    let checks = 0;
    for (let seed = 1; seed <= 100; seed++) {
      const firstTeam: TeamId = seed % 2 === 0 ? 'A' : 'B';
      const { events } = runGame(seed, firstTeam, N, DECK);
      for (let i = 1; i <= events.length; i++) {
        const priorEvents = events.slice(0, i - 1);
        const priorState = fold(priorEvents);
        const fullEvents = events.slice(0, i);
        const undone = undo(fullEvents);
        expect(undone.events).toEqual(priorEvents);
        expect(undone.state).toEqual(priorState);
        // Explicitly re-assert the two fields the ruling calls out as the
        // most commonly forgotten in a hand-written undo.
        expect(undone.state.usedQuestionIds).toEqual(priorState.usedQuestionIds);
        expect(undone.state.rng.drawIndex).toBe(priorState.rng.drawIndex);
        checks++;
      }
    }
    // eslint-disable-next-line no-console
    console.log(`[A1 criterion 4] undo fuzz checks=${checks} (>= 1000 required), zero failures`);
    expect(checks).toBeGreaterThanOrEqual(1000);
  });
});
