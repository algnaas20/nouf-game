/**
 * Pure maze RENDERING geometry — no DOM here, directly unit-testable.
 * Supersedes the old congruent-corridor model (D-24, the user's «مو تحط لي
 * خط» ruling; game-systems-expert 2026-08-08 §10.4 names this file
 * "replaced... rendering geometry is rtl-stage-ux-expert's / WL-B's to
 * redesign", with the one binding requirement **M-GEO-1: junction anchors
 * must be monotone along the travel axis** for both routes, so "further =
 * ahead" reads at a glance from 3 m).
 *
 * Reading D (§2.1 of the spec): two DISJOINT per-team regions, two entries,
 * one shared lit goal gate. Team A enters top-right, team B enters
 * bottom-right (RTL: travel is leftward for both, §2.3). Each team is
 * confined to its own vertical band for its whole route — the two bands
 * never overlap — so `cells(A) ∩ cells(B) = {goal}` (M-GEN-1) is true of the
 * RENDERED geometry too, not just the abstract WL-A data.
 *
 * Junction anchor positions are a function of `(team, index, N)` ONLY —
 * deliberately NOT of `decorSeed`, and not of the game's random seed at all
 * (sidesteps needing to plumb the raw session seed to the render layer: the
 * "winding" look is a fixed deterministic wiggle, not a per-game random
 * one). `tests/stage/maze-fog.test.ts`'s M-FOG-1b mutation proves this file
 * never lets `decorSeed` influence a junction anchor.
 */

import type { TeamId } from '../contracts';

export interface MazePoint {
  xFrac: number;
  yFrac: number;
}

export type ExitSlot = 0 | 1 | 2;

/** Fixed vertical bands, in `yFrac` (0 = top, 1 = bottom) — the two teams'
 *  regions never overlap for the WHOLE route, only converging in the last
 *  short stretch into the shared goal gate (with a permanent minimum
 *  offset, §2.5 rule 1: "trails never share a corridor centre-line"). */
const BAND: Record<TeamId, { center: number; amplitude: number }> = {
  A: { center: 0.24, amplitude: 0.15 },
  B: { center: 0.76, amplitude: 0.15 },
};

/** Entry xFrac (right edge, البداية) and goal xFrac (left edge, النهاية). */
const ENTRY_XFRAC = 0.94;
const GOAL_XFRAC = 0.045;
/** The last-junction-to-goal approach offsets — permanently distinct so the
 *  two trails never share a centre-line even at their closest point. */
const GOAL_APPROACH_YFRAC: Record<TeamId, number> = { A: 0.465, B: 0.535 };

/**
 * The junction anchor for `team`'s `index`-th junction (`0..N-1`) out of
 * `N` total. Monotonically decreasing `xFrac` as `index` grows (M-GEO-1) —
 * asserted directly by `isRouteMonotoneRightToLeft` below. The vertical
 * wiggle is a FIXED deterministic function of `(team, index)` only — no
 * RNG, no seed, so no session-specific plumbing is ever needed at the
 * render layer, and `decorSeed` never enters this computation at all
 * (M-FOG-1b).
 */
export function junctionAnchor(team: TeamId, index: number, N: number): MazePoint {
  const band = BAND[team];
  const progress = N <= 0 ? 0 : index / N; // 0 = entry, 1 = would be one past the last junction
  const xFrac = ENTRY_XFRAC - progress * (ENTRY_XFRAC - GOAL_XFRAC - 0.06);
  const wigglePhase = index * 1.7 + (team === 'A' ? 0 : Math.PI / 3);
  const yFrac = band.center + Math.sin(wigglePhase) * band.amplitude * 0.5;
  return { xFrac, yFrac };
}

/** The shared, always-lit goal gate — one fixed point, both teams converge
 *  on it (M-FOG-2: visible and lit from frame one, independent of any
 *  team's progress). */
export function goalGateAnchor(): MazePoint {
  return { xFrac: GOAL_XFRAC, yFrac: 0.5 };
}

/** The point a team's trail approaches the goal gate FROM — offset from the
 *  gate itself so the two teams' final approach segments never share a
 *  centre-line (§2.5 rule 1), even though both end at the same gate. */
export function goalApproachAnchor(team: TeamId): MazePoint {
  return { xFrac: GOAL_XFRAC + 0.05, yFrac: GOAL_APPROACH_YFRAC[team] };
}

/** Assert-friendly (I15-adjacent, geometry-layer sanity): strictly
 *  right-to-left for both teams' full routes. */
export function isRouteMonotoneRightToLeft(team: TeamId, N: number): boolean {
  let lastX = Infinity;
  for (let i = 0; i < N; i++) {
    const p = junctionAnchor(team, i, N);
    if (p.xFrac >= lastX) return false;
    lastX = p.xFrac;
  }
  const approach = goalApproachAnchor(team);
  if (approach.xFrac >= lastX) return false;
  const gate = goalGateAnchor();
  return gate.xFrac < approach.xFrac;
}

/** Fixed angular offsets for the (up to) 3 exits of a junction, relative to
 *  the forward (leftward) travel direction — "أعلى" / "وسط" / "أسفل"
 *  (up/mid/down), a stable convention independent of which exits happen to
 *  still be open (R-1/R-2 of the UX addendum: same alphabet as the answer
 *  options, drawn ON the maze at the mouth). */
const MOUTH_Y_OFFSET: Record<ExitSlot, number> = { 0: -0.05, 1: 0, 2: 0.05 };
export const EXIT_LETTERS = ['أ', 'ب', 'ج'] as const;
export const EXIT_DIRECTION_WORDS: Record<ExitSlot, string> = { 0: 'أعلى', 1: 'وسط', 2: 'أسفل' };

/**
 * The ADJACENT register (§1 table): a short stub, one cell deep, leaving
 * the team's CURRENT junction toward exit `slot`. This is the only true
 * topology drawn ahead of where a team has actually walked — everything
 * beyond it is the DISTANT decorative register (`maze-decor.ts`), which
 * never reads this function's output or inputs.
 */
export function mouthAnchor(team: TeamId, junctionIndex: number, N: number, slot: ExitSlot): MazePoint {
  const base = junctionAnchor(team, junctionIndex, N);
  // The next anchor (or the goal, if this is the last junction) gives the
  // forward direction to project the short stub toward.
  const forward = junctionIndex + 1 < N ? junctionAnchor(team, junctionIndex + 1, N) : goalApproachAnchor(team);
  const dx = (forward.xFrac - base.xFrac) * 0.42;
  return { xFrac: base.xFrac + dx, yFrac: base.yFrac + MOUTH_Y_OFFSET[slot] };
}
