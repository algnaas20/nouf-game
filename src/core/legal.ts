/**
 * `legalEvents(state, ctx)` — the single place the win/exhaustion check
 * runs (non-negotiable: only from `PROGRESSION_APPLIED`), and the single
 * place a question is picked/shuffled for `QUESTION_SHOWN` (D-09.3: never
 * inline in a turn handler).
 *
 * `ctx` extends the frozen `GameState` with what the state deliberately does
 * NOT carry: the deck itself and the event log so far. `GameState` only
 * stores `deckHash` (a string) and `usedQuestionIds` — it cannot tell us the
 * deck's *size* (needed to detect exhaustion) or what the last answer's
 * correctness was (needed to build the next `MOVE_APPLIED`). The event log
 * is the only authority for both, which is exactly the point of an
 * append-only log: `ctx.events` is real, load-bearing input here, not a
 * debug convenience.
 */

import type {
  AnswerChosenEvent,
  GameEvent,
  GameState,
  Outcome,
  Question,
  TeamId,
} from '../contracts';
import { selectNextQuestion, shuffleOptionOrder } from './select';

export interface GameContext {
  deck: readonly Question[];
  /** The full committed event log so far. `events.length` is the next `seq`. */
  events: readonly GameEvent[];
  /** Injectable clock for deterministic tests. Defaults to `Date.now`. */
  now?: () => number;
}

function otherTeam(team: TeamId): TeamId {
  return team === 'A' ? 'B' : 'A';
}

export function legalEvents(state: GameState, ctx: GameContext): GameEvent[] {
  const now = ctx.now ?? Date.now;
  const seq = ctx.events.length;

  switch (state.stateId) {
    case 'SETUP':
      // GAME_STARTED carries operator-authored data (team names) this
      // function cannot invent. The caller constructs and applies it
      // directly; it is never produced here.
      return [];

    case 'TURN_START': {
      const sel = selectNextQuestion(state, ctx.deck);
      if (!sel) return [];
      const shuffled = shuffleOptionOrder(sel.rng);
      const ev: GameEvent = {
        type: 'QUESTION_SHOWN',
        seq,
        at: now(),
        questionId: sel.questionId,
        optionOrder: shuffled.order,
      };
      return [ev];
    }

    case 'QUESTION_SHOWN': {
      if (!state.optionOrder || state.currentQuestionId === null) return [];
      const question = ctx.deck.find((q) => q.id === state.currentQuestionId);
      if (!question) return [];
      const optionOrder = state.optionOrder;
      const answers: GameEvent[] = optionOrder.map((originalIndex, slot) => {
        const correct = originalIndex === question.correctIndex;
        const ev: AnswerChosenEvent = {
          type: 'ANSWER_CHOSEN',
          seq,
          at: now(),
          optionId: slot as 0 | 1 | 2 | 3,
          correct,
        };
        return ev;
      });
      const noAnswer: GameEvent = { type: 'NO_ANSWER', seq, at: now() };
      return [...answers, noAnswer];
    }

    case 'ANSWER_REVEALED': {
      const last = ctx.events[ctx.events.length - 1];
      const correct = last !== undefined && last.type === 'ANSWER_CHOSEN' ? last.correct : false;
      const ev: GameEvent = {
        type: 'MOVE_APPLIED',
        seq,
        at: now(),
        team: state.currentTeam,
        delta: correct ? 1 : 0,
      };
      return [ev];
    }

    case 'PROGRESSION_APPLIED': {
      const idx = state.currentTeam === 'A' ? 0 : 1;
      // Win check — the only place in the codebase this runs, and only
      // reachable when stateId is PROGRESSION_APPLIED.
      if (state.positions[idx] >= state.N) {
        const outcome: Outcome = state.currentTeam === 'A' ? 'winA' : 'winB';
        return [{ type: 'GAME_ENDED', seq, at: now(), outcome }];
      }
      // Minimal deck-exhaustion resolution (see worklog D1): leader wins,
      // tie draws. No R-b balancing turn, no decider — that is A2.
      if (state.usedQuestionIds.length >= ctx.deck.length) {
        const [posA, posB] = state.positions;
        const outcome: Outcome = posA === posB ? 'draw' : posA > posB ? 'winA' : 'winB';
        return [{ type: 'GAME_ENDED', seq, at: now(), outcome }];
      }
      const toTeam = otherTeam(state.currentTeam);
      return [{ type: 'TURN_PASSED', seq, at: now(), toTeam }];
    }

    default:
      return [];
  }
}
