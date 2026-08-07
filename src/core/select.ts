/**
 * Question selection and on-screen option shuffling.
 * D-09.3 / non-negotiable: selection lives ONLY here, never inline in a
 * turn handler. `legal.ts` calls these two functions and nowhere else picks
 * a question or shuffles options.
 */

import type { Question, OptionIndex } from '../contracts';
import type { GameState } from '../contracts';
import type { RngState } from '../contracts';
import { drawInt } from './rng';

/** Draws exactly one RNG value. Shared constant so `applyEvent` can advance
 *  `rng.drawIndex` by the same fixed amount without recomputing the draw. */
export const SELECT_DRAWS = 1;

/** Fisher–Yates over 4 items always consumes exactly 3 draws. */
export const SHUFFLE_DRAWS = 3;

export const QUESTION_SHOWN_DRAWS = SELECT_DRAWS + SHUFFLE_DRAWS;

/**
 * Picks uniformly among the deck's not-yet-used questions.
 * Returns null if the pool is empty (deck exhausted).
 */
export function selectNextQuestion(
  state: GameState,
  deck: readonly Question[],
): { questionId: string; rng: RngState } | null {
  const unused = deck.filter((q) => !state.usedQuestionIds.includes(q.id));
  if (unused.length === 0) return null;
  const draw = drawInt(state.rng, unused.length);
  const picked = unused[draw.value];
  if (!picked) {
    // Defensive: unreachable given draw.value < unused.length by construction.
    throw new Error('selectNextQuestion: draw index out of range');
  }
  return { questionId: picked.id, rng: draw.rng };
}

/** Fisher–Yates shuffle of the four on-screen slots. Pure, exactly 3 draws. */
export function shuffleOptionOrder(rng: RngState): {
  order: [OptionIndex, OptionIndex, OptionIndex, OptionIndex];
  rng: RngState;
} {
  const arr: OptionIndex[] = [0, 1, 2, 3];
  let r = rng;
  for (let i = arr.length - 1; i > 0; i--) {
    const draw = drawInt(r, i + 1);
    r = draw.rng;
    const j = draw.value;
    const ai = arr[i]!;
    const aj = arr[j]!;
    arr[i] = aj;
    arr[j] = ai;
  }
  const order = arr as [OptionIndex, OptionIndex, OptionIndex, OptionIndex];
  return { order, rng: r };
}
