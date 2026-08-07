/**
 * `legalEvents(state, ctx)` — the single place the win/exhaustion check
 * runs (non-negotiable: only from `PROGRESSION_APPLIED`, delegated to
 * `rules/progression.ts`), and the single place a question is
 * picked/shuffled for `QUESTION_SHOWN` (D-09.3: never inline in a turn
 * handler).
 *
 * `TURN_START`, `FINAL_BALANCING_TURN` and `TIEBREAK` all share the same
 * "show the next question" logic — they differ only in how they were
 * reached (see `reducer.ts`'s `TURN_PASSED` case, which derives the right
 * one purely from `positions`/`N`).
 */

import type { AnswerChosenEvent, GameEvent, GameState } from '../contracts';
import type { GameContext } from './context';
import { selectNextQuestion, shuffleOptionOrder } from './select';
import { resolveProgression } from './rules/progression';

export type { GameContext } from './context';

function showNextQuestion(state: GameState, ctx: GameContext, seq: number, now: () => number): GameEvent[] {
  const sel = selectNextQuestion(state, ctx.deck);
  if (!sel) {
    if (state.stateId === 'TURN_START') {
      // Structurally unreachable: TURN_PASSED only ever lands on
      // TURN_START when the exhaustion check already ran and found
      // unused questions remaining (see rules/progression.ts). Defensive.
      return [];
    }
    // Deck exhausted while a FINAL_BALANCING_TURN or TIEBREAK question was
    // due. D-09.10 reserves 4 questions precisely so this should not occur
    // for a green/warn-band deck; declared draw is the documented fallback
    // (game-systems-expert §5.5: "if no tiebreak question remains → declared draw").
    return [{ type: 'GAME_ENDED', seq, at: now(), outcome: 'draw' }];
  }
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

export function legalEvents(state: GameState, ctx: GameContext): GameEvent[] {
  const now = ctx.now ?? Date.now;
  const seq = ctx.events.length;

  switch (state.stateId) {
    case 'SETUP':
      // GAME_STARTED carries operator-authored data (team names) this
      // function cannot invent. The caller constructs and applies it
      // directly; it is never produced here.
      return [];

    case 'TURN_START':
    case 'FINAL_BALANCING_TURN':
    case 'TIEBREAK':
      return showNextQuestion(state, ctx, seq, now);

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

    case 'PROGRESSION_APPLIED':
      return resolveProgression(state, ctx, seq, now);

    default:
      return [];
  }
}
