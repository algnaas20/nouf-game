/**
 * Player policies for scenarios S1–S9. Each policy only picks among the
 * candidates `legalEvents` already returned — it never decides state
 * transitions, never computes deltas, never touches `usedQuestionIds` or
 * `rng`. That logic lives exclusively in `src/core`.
 */

import type { AnswerChosenEvent, GameEvent, GameState } from '../../src/contracts';
import type { Policy } from './harness';

function pickAnswer(
  candidates: readonly GameEvent[],
  want: 'correct' | 'wrong',
  rand: () => number,
): GameEvent {
  const answers = candidates.filter((c): c is AnswerChosenEvent => c.type === 'ANSWER_CHOSEN');
  if (answers.length === 0) {
    const first = candidates[0];
    if (!first) throw new Error('pickAnswer: no candidates at all');
    return first;
  }
  const pool = answers.filter((a) => (want === 'correct' ? a.correct : !a.correct));
  const chosen = pool.length > 0 ? pool : answers;
  const idx = Math.floor(rand() * chosen.length);
  return chosen[idx] ?? chosen[0]!;
}

/** S1 / S6: always correct. */
export const alwaysCorrect: Policy = (rand, candidates) => pickAnswer(candidates, 'correct', rand);

/** S2 / S7: always wrong. */
export const alwaysWrong: Policy = (rand, candidates) => pickAnswer(candidates, 'wrong', rand);

/** S3: team A always correct, team B always wrong (maximum blowout). */
export const teamAAlwaysCorrectBAlwaysWrong: Policy = (rand, candidates, state: GameState) => {
  const want = state.currentTeam === 'A' ? 'correct' : 'wrong';
  return pickAnswer(candidates, want, rand);
};

/** S4: strict alternating correct/wrong, tracked per team (each team's own
 *  sequence of answers alternates) — a regular, non-degenerate pattern
 *  distinct from S3's all-or-nothing split. */
export function makeAlternatingPolicy(): Policy {
  const counters: Record<'A' | 'B', number> = { A: 0, B: 0 };
  return (rand, candidates, state: GameState) => {
    const team = state.currentTeam;
    const want = counters[team] % 2 === 0 ? 'correct' : 'wrong';
    counters[team]++;
    return pickAnswer(candidates, want, rand);
  };
}

/** S5: uniform random correctness at a fixed probability p. */
export function makeUniformRandomPolicy(p: number): Policy {
  return (rand, candidates) => {
    const want = rand() < p ? 'correct' : 'wrong';
    return pickAnswer(candidates, want, rand);
  };
}
