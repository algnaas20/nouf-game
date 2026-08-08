/**
 * Player policies for scenarios S1–S9 (answer correctness) and S10–S13
 * (route choice at a MOVE_APPLIED candidate set). Each policy only picks
 * among the candidates `legalEvents` already returned — it never decides
 * state transitions, never computes positions/wasted, never touches
 * `usedQuestionIds` or `rng`. That logic lives exclusively in `src/core`.
 */

import type { AnswerChosenEvent, GameEvent, GameState, MoveAppliedEvent, TeamId } from '../../src/contracts';
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

// ---------------------------------------------------------------------------
// Route policies (game-systems-expert §11.4's `routePolicy` dimension) — pick
// among a MOVE_APPLIED candidate set. A route policy is only ever invoked
// with MOVE_APPLIED candidates (>= 2 real exits by I12, since the single
// `exit: null` case is always the sole candidate and never reaches a policy
// at all — `harness.ts`'s `playGame` shortcuts `candidates.length === 1`).
// ---------------------------------------------------------------------------

export type RoutePolicy = (
  rand: () => number,
  candidates: readonly MoveAppliedEvent[],
  state: GameState,
) => GameEvent;

/** S10's worst case — every fairness claim (G8 chief among them) must hold
 *  under this. Picks uniformly among the exits offered, including the one
 *  that happens to be this junction's (still-secret) dead end. */
export const uniformRoute: RoutePolicy = (rand, candidates) => {
  const idx = Math.floor(rand() * candidates.length);
  return candidates[idx] ?? candidates[0]!;
};

/**
 * S11's other extreme — never stumbles. Reads `state.maze` directly (the
 * simulation harness has the full layout in hand; M-SECRET-1 is a DOM/UI
 * constraint on what the *screen* may show, not a data-availability
 * constraint on this policy's own decision). If the team has already spent
 * its one stumble, the trap is inert (`resolveMove`'s `wasted === 0` guard)
 * and any exit is equally safe, so any pick is fine.
 */
export const oracleRoute: RoutePolicy = (rand, candidates, state) => {
  const team = candidates[0]!.team;
  const idx = team === 'A' ? 0 : 1;
  if (state.wasted[idx] !== 0) {
    return candidates[Math.floor(rand() * candidates.length)] ?? candidates[0]!;
  }
  const junctionIndex = state.positions[idx];
  const junction = state.maze.routes[idx].junctions[junctionIndex];
  const safe = junction ? candidates.filter((c) => c.exit !== junction.deadEndExit) : candidates;
  const pool = safe.length > 0 ? safe : candidates;
  return pool[Math.floor(rand() * pool.length)] ?? pool[0]!;
};

/** A third, deterministic-leaning baseline distinct from both extremes:
 *  always the lowest-indexed available exit (stable, not the RNG-driven
 *  uniform pick) — useful as a non-random robustness check alongside
 *  `uniformRoute`/`oracleRoute`. */
export const avoidLastTried: RoutePolicy = (_rand, candidates) => {
  return candidates.reduce((min, c) => (c.exit! < min.exit! ? c : min), candidates[0]!);
};

/**
 * Combines an answer-correctness `Policy` with a `RoutePolicy` into a single
 * `Policy` — `harness.ts`'s `playGame`/`run.ts`'s hand-rolled loops all take
 * exactly one `Policy`, and this is the seam that lets a scenario declare
 * "uniform correctness, uniform route" or "uniform correctness, oracle
 * route" without either half knowing about the other.
 */
export function withRoutePolicy(answer: Policy, route: RoutePolicy): Policy {
  return (rand, candidates, state) => {
    if (candidates[0]?.type === 'MOVE_APPLIED') {
      return route(rand, candidates as MoveAppliedEvent[], state);
    }
    return answer(rand, candidates, state);
  };
}

/** S11: `oracleTeam` never stumbles, the other team is the uniform-random
 *  worst case — the maximum possible route-luck asymmetry (§11.4). */
export function makeAsymmetricRoutePolicy(oracleTeam: TeamId): RoutePolicy {
  return (rand, candidates, state) => {
    const team = candidates[0]!.team;
    return team === oracleTeam ? oracleRoute(rand, candidates, state) : uniformRoute(rand, candidates, state);
  };
}
