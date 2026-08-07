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

import type { GameEvent, GameState, MazeCell, StateId, TeamId } from '../contracts';
import { QUESTION_SHOWN_DRAWS } from './select';

const QUESTION_SHOWN_LEGAL_FROM: readonly StateId[] = [
  'TURN_START',
  'FINAL_BALANCING_TURN',
  'TIEBREAK',
];

const GAME_ENDED_LEGAL_FROM: readonly StateId[] = [
  'PROGRESSION_APPLIED',
  'FINAL_BALANCING_TURN',
  'TIEBREAK',
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

function buildMaze(N: number): MazeCell[] {
  return Array.from({ length: N + 1 }, (_, index) => ({ index, event: null }));
}

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
    maze: [],
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
        maze: buildMaze(event.N),
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
      const positions = clampPair(bumpPair(state.positions, event.team, event.delta), 0, state.N);
      return {
        ...state,
        stateId: 'PROGRESSION_APPLIED',
        positions,
      };
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
