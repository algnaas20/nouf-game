/**
 * The reducer: `applyEvent(state, event)`. Pure, throws on an illegal
 * transition and — because it never mutates its inputs — leaves the
 * caller's previous state object untouched (I5).
 *
 * Non-negotiable: the win check (inspecting `positions`/`usedQuestionIds`
 * to decide what happens next) never runs here. `MOVE_APPLIED` only moves
 * a token and lands on `PROGRESSION_APPLIED`; `outcome` is set exactly once,
 * by the `GAME_ENDED` case, which is only legal *from* `PROGRESSION_APPLIED`
 * (see legal.ts for where the actual win/exhaustion decision is computed).
 */

import type { GameEvent, GameState, MazeLayout, StateId, TeamId } from '../contracts';
import { QUESTION_SHOWN_DRAWS } from './select';
import { buildMaze, resolveMove } from './rules/maze';

const QUESTION_SHOWN_LEGAL_FROM: readonly StateId[] = [
  'TURN_START',
  'FINAL_BALANCING_TURN',
  'TIEBREAK',
];

const GAME_ENDED_LEGAL_FROM: readonly StateId[] = [
  'PROGRESSION_APPLIED',
  'FINAL_BALANCING_TURN',
  'TIEBREAK',
  // F-2: a game started with an empty deck reaches TURN_START directly from
  // GAME_STARTED (never through progression.ts) with nothing to show. Without
  // this, legal.ts's only possible candidate there (a declared-draw
  // GAME_ENDED) would itself be illegal to apply, and the freeze would
  // survive the legal.ts fix alone. See worklog-A5.md §1.
  'TURN_START',
];

export class IllegalTransitionError extends Error {
  constructor(
    public readonly eventType: GameEvent['type'],
    public readonly fromStateId: GameState['stateId'],
  ) {
    super(`Illegal event ${eventType} from state ${fromStateId}`);
    this.name = 'IllegalTransitionError';
  }
}

function teamIndex(team: TeamId): 0 | 1 {
  return team === 'A' ? 0 : 1;
}

function bumpPair(pair: [number, number], team: TeamId, delta: number): [number, number] {
  const idx = teamIndex(team);
  const next: [number, number] = [pair[0], pair[1]];
  next[idx] = next[idx] + delta;
  return next;
}

function clampPair(pair: [number, number], min: number, max: number): [number, number] {
  return [Math.min(max, Math.max(min, pair[0])), Math.min(max, Math.max(min, pair[1]))];
}

function setAt<T>(pair: [T, T], idx: 0 | 1, value: T): [T, T] {
  const next: [T, T] = [pair[0], pair[1]];
  next[idx] = value;
  return next;
}

/** Sentinel used only before `GAME_STARTED`; `genVersion: 0` never matches
 *  `MAZE_GEN_VERSION` (1), same "not started yet" convention as `deckHash: ''`. */
const EMPTY_MAZE: MazeLayout = {
  N: 0,
  routes: [
    { team: 'A', junctions: [] },
    { team: 'B', junctions: [] },
  ],
  decorSeed: 0,
  genVersion: 0,
};

/**
 * The state before any event has been applied. Not itself a state a UI ever
 * shows persistently — the very first event a real game log contains is
 * always `GAME_STARTED`, which is the only event legal from here.
 */
export function initialState(): GameState {
  return {
    stateId: 'SETUP',
    N: 0,
    teamNames: ['', ''],
    firstTeam: 'A',
    currentTeam: 'A',
    positions: [0, 0],
    attempts: [0, 0],
    maze: EMPTY_MAZE,
    closedExits: [[], []],
    wasted: [0, 0],
    deckHash: '',
    usedQuestionIds: [],
    currentQuestionId: null,
    optionOrder: null,
    rng: { seed: 0, drawIndex: 0 },
    outcome: null,
  };
}

export function applyEvent(state: GameState, event: GameEvent): GameState {
  switch (event.type) {
    case 'GAME_STARTED': {
      if (state.stateId !== 'SETUP') {
        throw new IllegalTransitionError(event.type, state.stateId);
      }
      return {
        stateId: 'TURN_START',
        N: event.N,
        teamNames: event.teamNames,
        firstTeam: event.firstTeam,
        currentTeam: event.firstTeam,
        positions: [0, 0],
        attempts: [0, 0],
        maze: buildMaze(event.seed, event.N),
        closedExits: [[], []],
        wasted: [0, 0],
        deckHash: event.deckHash,
        usedQuestionIds: [],
        currentQuestionId: null,
        optionOrder: null,
        rng: { seed: event.seed, drawIndex: 0 },
        outcome: null,
      };
    }

    case 'QUESTION_SHOWN': {
      if (!QUESTION_SHOWN_LEGAL_FROM.includes(state.stateId)) {
        throw new IllegalTransitionError(event.type, state.stateId);
      }
      return {
        ...state,
        stateId: 'QUESTION_SHOWN',
        currentQuestionId: event.questionId,
        optionOrder: event.optionOrder,
        rng: { seed: state.rng.seed, drawIndex: state.rng.drawIndex + QUESTION_SHOWN_DRAWS },
      };
    }

    case 'ANSWER_CHOSEN': {
      if (state.stateId !== 'QUESTION_SHOWN') {
        throw new IllegalTransitionError(event.type, state.stateId);
      }
      if (state.currentQuestionId === null) {
        throw new IllegalTransitionError(event.type, state.stateId);
      }
      return {
        ...state,
        stateId: 'ANSWER_REVEALED',
        attempts: bumpPair(state.attempts, state.currentTeam, 1),
        usedQuestionIds: [...state.usedQuestionIds, state.currentQuestionId],
      };
    }

    case 'NO_ANSWER': {
      if (state.stateId !== 'QUESTION_SHOWN') {
        throw new IllegalTransitionError(event.type, state.stateId);
      }
      if (state.currentQuestionId === null) {
        throw new IllegalTransitionError(event.type, state.stateId);
      }
      return {
        ...state,
        stateId: 'ANSWER_REVEALED',
        attempts: bumpPair(state.attempts, state.currentTeam, 1),
        usedQuestionIds: [...state.usedQuestionIds, state.currentQuestionId],
      };
    }

    case 'MOVE_APPLIED': {
      if (state.stateId !== 'ANSWER_REVEALED') {
        throw new IllegalTransitionError(event.type, state.stateId);
      }
      const idx = teamIndex(event.team);
      const junctionIndex = state.positions[idx];

      // Wrong answer, or the team had already reached the goal (junction
      // beyond the route's last index): nothing moves. `exit: null` is the
      // ONLY event shape for this — the result is derived, never stored, so
      // the log can never contradict the rules (game-systems-expert §10.2).
      if (event.exit === null || junctionIndex >= state.N) {
        return { ...state, stateId: 'PROGRESSION_APPLIED' };
      }

      const result = resolveMove(
        state.maze,
        event.team,
        junctionIndex,
        state.closedExits[idx],
        state.wasted[idx],
        event.exit,
      );

      if (result === 'advance') {
        const positions = clampPair(bumpPair(state.positions, event.team, 1), 0, state.N);
        const closedExits = setAt(state.closedExits, idx, []);
        return { ...state, stateId: 'PROGRESSION_APPLIED', positions, closedExits };
      }

      const closedExits = setAt(state.closedExits, idx, [...state.closedExits[idx], event.exit]);
      const wasted = bumpPair(state.wasted, event.team, 1);
      return { ...state, stateId: 'PROGRESSION_APPLIED', closedExits, wasted };
    }

    case 'TURN_PASSED': {
      if (state.stateId !== 'PROGRESSION_APPLIED') {
        throw new IllegalTransitionError(event.type, state.stateId);
      }
      // D-09.7/D-09.9: which "waiting for the next question" state we land
      // on is fully derived from positions/N — no extra field needed.
      // Both at N: mid-tiebreak. Exactly one at N: the other is owed its
      // balancing attempt. Neither: ordinary play continues.
      const bothAtN = state.positions[0] >= state.N && state.positions[1] >= state.N;
      const oneAtN = (state.positions[0] >= state.N) !== (state.positions[1] >= state.N);
      const nextStateId: StateId = bothAtN
        ? 'TIEBREAK'
        : oneAtN
          ? 'FINAL_BALANCING_TURN'
          : 'TURN_START';
      return {
        ...state,
        stateId: nextStateId,
        currentTeam: event.toTeam,
        currentQuestionId: null,
        optionOrder: null,
      };
    }

    case 'GAME_ENDED': {
      if (!GAME_ENDED_LEGAL_FROM.includes(state.stateId)) {
        throw new IllegalTransitionError(event.type, state.stateId);
      }
      return {
        ...state,
        stateId: 'FINISHED',
        outcome: event.outcome,
      };
    }
  }
}
