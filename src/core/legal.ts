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

import type { AnswerChosenEvent, GameEvent, GameState, MoveAppliedEvent, TeamId } from '../contracts';
import type { GameContext } from './context';
import { selectNextQuestion, shuffleOptionOrder } from './select';
import { resolveProgression } from './rules/progression';
import { availableExits } from './rules/maze';

export type { GameContext } from './context';

function showNextQuestion(state: GameState, ctx: GameContext, seq: number, now: () => number): GameEvent[] {
  const sel = selectNextQuestion(state, ctx.deck);
  if (!sel) {
    // Deck exhausted — OR, at the very first TURN_START reached directly
    // from GAME_STARTED (never through progression.ts's own exhaustion
    // check), simply empty from the start: D-25 means a fresh author's deck
    // really can be zero questions the first time anyone presses "play".
    // F-2: a TURN_START special case here used to return `[]`. That
    // reasoning only holds for a TURN_START reached via TURN_PASSED (always
    // downstream of progression.ts's exhaustion check) — never for the very
    // first arrival — and it froze the game solid with zero legal events,
    // forever (see worklog-A5.md §1). Declared draw is the same documented
    // fallback used for every other "no question left to show" case
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
      const team: TeamId = state.currentTeam;
      const idx = team === 'A' ? 0 : 1;
      const junctionIndex = state.positions[idx];

      // Wrong answer, or the team has already reached the goal (can still
      // happen mid-tiebreak, where further correct answers keep clamping at
      // N): nothing to move, exactly one MOVE_APPLIED candidate with no exit.
      if (!correct || junctionIndex >= state.N) {
        const ev: MoveAppliedEvent = { type: 'MOVE_APPLIED', seq, at: now(), team, exit: null };
        return [ev];
      }

      // One MOVE_APPLIED candidate per available exit — same shape as the
      // four ANSWER_CHOSEN candidates above: the operator/policy picks one
      // (game-systems-expert §10.4). I12 guarantees this is always >= 2.
      const exits = availableExits(state.maze, team, junctionIndex, state.closedExits[idx]);
      return exits.map((exit): MoveAppliedEvent => ({ type: 'MOVE_APPLIED', seq, at: now(), team, exit }));
    }

    case 'PROGRESSION_APPLIED':
      return resolveProgression(state, ctx, seq, now);

    default:
      return [];
  }
}
