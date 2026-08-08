/**
 * Pure maze geometry — no DOM here, so it is directly unit-testable and
 * directly inspectable by the "no stations / no token-width opening in a
 * decorative dead end" guard (D-09.6 / constraint row 7), independent of
 * any rendering. `toStageX` below is the SINGLE mirror point (§2.3): every
 * consumer (station placement, the token, the finish marker) calls the
 * same function, so an eventual LTR flip is one line, never scattered sign
 * flips.
 *
 * Coordinate space: a unit box, `xFrac` 1 = right edge (البداية) → 0 = left
 * edge (النهاية) — i.e. `xFrac` already reads right-to-left by construction
 * (D-09.6: "the maze starts at the RIGHT edge and advances LEFTWARD").
 * `yFrac` 0 = top, 1 = bottom.
 */

export interface MazePoint {
  xFrac: number;
  yFrac: number;
}

/**
 * The corridor's spine — monotonically decreasing `xFrac` (strictly
 * right-to-left) with a vertical wiggle for "winding" character. Both team
 * lanes are translated copies of this exact spine (see `laneOffset`) —
 * translation preserves congruence exactly: the corridor the tokens travel
 * is the SAME shape for both teams (D-09.6, binding art rule 1).
 */
export const CORRIDOR_SPINE: readonly MazePoint[] = [
  { xFrac: 0.95, yFrac: 0.5 },
  { xFrac: 0.8, yFrac: 0.16 },
  { xFrac: 0.64, yFrac: 0.84 },
  { xFrac: 0.48, yFrac: 0.16 },
  { xFrac: 0.32, yFrac: 0.84 },
  { xFrac: 0.16, yFrac: 0.16 },
  { xFrac: 0.03, yFrac: 0.5 },
];

/** Assert-friendly: the spine is strictly right-to-left. */
export function isSpineMonotonicRightToLeft(spine: readonly MazePoint[] = CORRIDOR_SPINE): boolean {
  for (let i = 1; i < spine.length; i++) {
    if (spine[i]!.xFrac >= spine[i - 1]!.xFrac) return false;
  }
  return true;
}

function segmentLengths(spine: readonly MazePoint[]): number[] {
  const lens: number[] = [];
  for (let i = 1; i < spine.length; i++) {
    const a = spine[i - 1]!;
    const b = spine[i]!;
    lens.push(Math.hypot(b.xFrac - a.xFrac, b.yFrac - a.yFrac));
  }
  return lens;
}

/** Uniform-speed (arclength-parametrized) point at `progress` in [0,1] along
 *  the spine, 0 = start (right, البداية), 1 = end (left, النهاية). */
export function pointAtProgress(progress: number, spine: readonly MazePoint[] = CORRIDOR_SPINE): MazePoint {
  const clamped = Math.max(0, Math.min(1, progress));
  const lens = segmentLengths(spine);
  const total = lens.reduce((a, b) => a + b, 0);
  const target = clamped * total;
  let acc = 0;
  for (let i = 0; i < lens.length; i++) {
    const segLen = lens[i]!;
    if (acc + segLen >= target || i === lens.length - 1) {
      const segT = segLen === 0 ? 0 : (target - acc) / segLen;
      const a = spine[i]!;
      const b = spine[i + 1]!;
      return { xFrac: a.xFrac + (b.xFrac - a.xFrac) * segT, yFrac: a.yFrac + (b.yFrac - a.yFrac) * segT };
    }
    acc += segLen;
  }
  return spine[spine.length - 1]!;
}

export type Lane = 'A' | 'B';

/** Constant vertical translation per lane — a translated copy of the same
 *  spine is exactly congruent (not merely "similar"). */
const LANE_OFFSET_YFRAC: Record<Lane, number> = { A: -0.055, B: 0.055 };

export function laneOffset(lane: Lane): number {
  return LANE_OFFSET_YFRAC[lane];
}

/** The single mirror point (§2.3): every consumer of maze geometry (station
 *  dots, the token, the finish marker) resolves a lane+progress through
 *  this one function. Flipping travel direction later is a change to
 *  `CORRIDOR_SPINE` (or this function), never a sprinkle of sign flips at
 *  call sites. */
export function toStagePoint(lane: Lane, progress: number): MazePoint {
  const base = pointAtProgress(progress);
  return { xFrac: base.xFrac, yFrac: base.yFrac + laneOffset(lane) };
}

export function stationProgressValues(N: number): number[] {
  const out: number[] = [];
  for (let i = 0; i <= N; i++) out.push(i / N);
  return out;
}

export interface DecorativeDeadEnd {
  /** Anchor point on the spine this stub branches from — NOT a station;
   *  dead ends attach between stations, never coincide with one. */
  fromProgress: number;
  /** Direction the stub travels away from the corridor, in yFrac units. */
  branchYFrac: number;
}

/** Fixed set of decorative dead ends — anchored at mid-segment progress
 *  values (never at a station progress value, i.e. never at i/N for any
 *  plausible N), so they can never be mistaken for a station by
 *  construction. Exactly zero station markers are ever drawn on these
 *  (constraint row 7) — the renderer never calls the station-drawing code
 *  for anything in this list. */
export const DECORATIVE_DEAD_ENDS: readonly DecorativeDeadEnd[] = [
  { fromProgress: 0.12, branchYFrac: -0.22 },
  { fromProgress: 0.29, branchYFrac: 0.22 },
  { fromProgress: 0.46, branchYFrac: -0.2 },
  { fromProgress: 0.63, branchYFrac: 0.2 },
  { fromProgress: 0.81, branchYFrac: -0.22 },
];
