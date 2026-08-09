/**
 * The maze board — full-stage SVG, three registers (game-systems-expert
 * 2026-08-08 §1 / rtl-stage-ux-expert addendum-maze-ux.md):
 *
 *   DISTANT   — decorative texture from `maze-decor.ts`, drawn first
 *               (under everything), from `layout.decorSeed` alone. Carries
 *               no true topology (M-FOG-1 — proven in `maze-fog.test.ts`).
 *   TRAVELLED — both teams' full trails, permanent, drawn every render:
 *               entry -> every completed junction -> current junction (and
 *               on to the goal gate once a team has reached it). Casing +
 *               core (T-1..T-5, addendum §2), never blended where a
 *               corridor is shared (they never ARE shared here — the two
 *               regions are disjoint by construction, `maze-geometry.ts`).
 *   ADJACENT  — only for `activeTeam`'s CURRENT junction: the open exit
 *               mouths, one cell deep, labelled أ/ب/ج + direction word
 *               (R-1/R-2). Nothing beyond this is ever true topology.
 *
 * Dead ends are stamped in place, permanently, in the near-white casing
 * colour — never a team colour (addendum §2.6) — with the glyph + word
 * «مسدود», never «خطأ» (never the wrong-answer vocabulary).
 */
import type { TeamId } from '../../contracts';
import {
  junctionAnchor,
  goalGateAnchor,
  goalApproachAnchor,
  mouthAnchor,
  EXIT_LETTERS,
  type ExitSlot,
  type MazePoint,
} from '../maze-geometry';
import { buildDecorWalls, buildDecorGroup } from '../maze-decor';

const SVG_NS = 'http://www.w3.org/2000/svg';
export const MAZE_VIEW_WIDTH = 1728;
export const MAZE_VIEW_HEIGHT = 620;

function pt(p: MazePoint): [number, number] {
  return [p.xFrac * MAZE_VIEW_WIDTH, p.yFrac * MAZE_VIEW_HEIGHT];
}

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

function pathD(points: MazePoint[]): string {
  return 'M ' + points.map((p) => pt(p).map((n) => n.toFixed(1)).join(',')).join(' L ');
}

/**
 * The travelled polyline for `team`, from junction 0 through the junction
 * at `position` (inclusive — `position` IS the index of the junction the
 * token currently stands at, same convention `buildToken` uses) — the SAME
 * points used by both the casing path and the core path underneath it, so
 * they can never drift apart.
 *
 * Real bug found and fixed here (worklog-B7.md §4, caught by the verify
 * script's own screenshot, not assumed correct from the code alone): the
 * previous version was called with `position - 1`, which for `position=1`
 * produced a single-point path (`junction 0` only) — an SVG path with no
 * `L` segment renders NOTHING, so a team that had genuinely advanced once
 * showed no visible trail at all, only its token. Passing `position`
 * itself (not `position - 1`) includes the junction the team is actually
 * standing at, giving a real >=2-point line whenever `position >= 1`.
 */
function travelledPoints(team: TeamId, position: number, N: number, reachedGoal: boolean): MazePoint[] {
  const points: MazePoint[] = [];
  const last = Math.min(position, N - 1);
  for (let i = 0; i <= last; i++) points.push(junctionAnchor(team, i, N));
  if (reachedGoal) {
    points.push(goalApproachAnchor(team));
    points.push(goalGateAnchor());
  }
  return points;
}

export interface MazeViewParams {
  N: number;
  teamNames: [string, string];
  positions: [number, number];
  closedExits: [number[], number[]];
  wasted: [number, number];
  /** Only set while it is meaningful to show open mouths at a junction —
   *  the ADJACENT register (§1 table) is drawn for this team's CURRENT
   *  junction alone, never any other. */
  activeTeam?: TeamId | null;
  openExits?: ExitSlot[];
  decorSeed: number;
}

export interface MazeViewResult {
  svg: SVGSVGElement;
  tokenA: SVGGElement;
  tokenB: SVGGElement;
}

const TEAM_INDEX: Record<TeamId, 0 | 1> = { A: 0, B: 1 };

function buildTrail(team: TeamId, positions: [number, number], N: number): { casing: SVGPathElement; core: SVGPathElement } {
  const idx = TEAM_INDEX[team];
  const position = positions[idx]!;
  const reachedGoal = position >= N;
  const points = travelledPoints(team, position, N, reachedGoal);
  // Position 0 legitimately has nothing to draw yet (junction 0 sits
  // exactly at the entry x-coordinate — see `junctionAnchor`'s own doc
  // comment) — the token itself is the only marker until the first
  // advance. `points` is never empty here since the loop above always
  // pushes at least junction 0.
  const d = pathD(points);
  const casing = el('path', { d, class: `maze-trail-casing maze-trail-casing-${team.toLowerCase()}`, fill: 'none' });
  const core = el('path', { d, class: `maze-trail-core maze-trail-core-${team.toLowerCase()}`, fill: 'none' });
  return { casing, core };
}

function buildToken(team: TeamId, position: number, N: number, teamName: string): SVGGElement {
  const p = position >= N ? goalGateAnchor() : junctionAnchor(team, Math.min(position, N - 1), N);
  const [x, y] = pt(p);
  const g = el('g', { class: `maze-token maze-token-${team.toLowerCase()}`, transform: `translate(${x.toFixed(1)},${y.toFixed(1)})` });
  // Distinct glyph shapes (never colour alone, T-2): team A = circle, team
  // B = diamond — they differ in rotational symmetry so they separate even
  // in pure silhouette.
  if (team === 'A') {
    g.append(el('circle', { r: 20, class: 'maze-token-shape' }));
  } else {
    g.append(el('rect', { x: -15, y: -15, width: 30, height: 30, transform: 'rotate(45)', class: 'maze-token-shape' }));
  }
  const label = el('text', { y: -30, class: 'maze-token-label', 'text-anchor': 'middle' });
  label.textContent = teamName;
  g.append(label);
  return g;
}

/** The dead-end stamp — permanent, in the near-white casing colour (never a
 *  team colour, addendum §2.6), glyph + word, never the wrong-answer
 *  vocabulary. Drawn at the mouth of the team's CURRENT junction toward the
 *  exit recorded in `closedExits` (the one dead end this game). */
function buildDeadEndStamp(team: TeamId, junctionIndex: number, N: number, exit: ExitSlot): SVGGElement {
  const mouth = mouthAnchor(team, junctionIndex, N, exit);
  const [x, y] = pt(mouth);
  const g = el('g', { class: 'maze-dead-end-stamp', transform: `translate(${x.toFixed(1)},${y.toFixed(1)})` });
  g.append(el('rect', { x: -22, y: -14, width: 44, height: 28, class: 'maze-dead-end-brick' }));
  const glyph = el('text', { y: 6, class: 'maze-dead-end-glyph', 'text-anchor': 'middle' });
  glyph.textContent = '✕';
  const label = el('text', { y: 32, class: 'maze-dead-end-label', 'text-anchor': 'middle' });
  label.textContent = 'مسدود';
  g.append(glyph, label);
  return g;
}

export function buildMazeView(p: MazeViewParams): MazeViewResult {
  const svg = el('svg', {
    viewBox: `0 0 ${MAZE_VIEW_WIDTH} ${MAZE_VIEW_HEIGHT}`,
    class: 'maze-svg',
    role: 'img',
    'aria-label': 'المتاهة',
  });

  // ---- DISTANT register first (under everything) ----
  svg.append(buildDecorGroup(buildDecorWalls(p.decorSeed), MAZE_VIEW_WIDTH, MAZE_VIEW_HEIGHT));

  // ---- goal gate, lit from frame one (M-FOG-2) ----
  const gate = goalGateAnchor();
  const [gx, gy] = pt(gate);
  const gateGroup = el('g', { class: 'maze-goal-gate' });
  gateGroup.append(el('circle', { cx: gx.toFixed(1), cy: gy.toFixed(1), r: 30, class: 'maze-goal-glow' }));
  gateGroup.append(el('rect', { x: (gx - 10).toFixed(1), y: (gy - 40).toFixed(1), width: 20, height: 80, class: 'maze-goal-post' }));
  const gateLabel = el('text', { x: gx.toFixed(1), y: (gy - 52).toFixed(1), class: 'maze-marker-label maze-goal-label', 'text-anchor': 'middle' });
  gateLabel.textContent = 'النهاية';
  gateGroup.append(gateLabel);
  svg.append(gateGroup);

  // ---- TRAVELLED register, both teams, casing first then core ----
  const trailA = buildTrail('A', p.positions, p.N);
  const trailB = buildTrail('B', p.positions, p.N);
  svg.append(trailA.casing, trailB.casing, trailA.core, trailB.core);

  // ---- dead-end stamps (permanent, casing-coloured, never team-coloured) ----
  for (const team of ['A', 'B'] as const) {
    const idx = TEAM_INDEX[team];
    const closed = p.closedExits[idx]!;
    if (closed.length > 0 && p.wasted[idx]! > 0) {
      const junctionIndex = Math.min(p.positions[idx]!, p.N - 1);
      svg.append(buildDeadEndStamp(team, junctionIndex, p.N, closed[0] as ExitSlot));
    }
  }

  // ---- ADJACENT register: open mouths at activeTeam's current junction ----
  if (p.activeTeam && p.openExits && p.openExits.length > 0) {
    const idx = TEAM_INDEX[p.activeTeam];
    const junctionIndex = Math.min(p.positions[idx]!, p.N - 1);
    const mouthsGroup = el('g', { class: 'maze-mouths' });
    for (const slot of p.openExits) {
      const from = junctionAnchor(p.activeTeam, junctionIndex, p.N);
      const to = mouthAnchor(p.activeTeam, junctionIndex, p.N, slot);
      const [fx, fy] = pt(from);
      const [tx, ty] = pt(to);
      const stub = el('line', {
        x1: fx.toFixed(1),
        y1: fy.toFixed(1),
        x2: tx.toFixed(1),
        y2: ty.toFixed(1),
        class: `maze-mouth-stub maze-mouth-stub-${p.activeTeam.toLowerCase()}`,
      });
      const chip = el('g', { class: 'maze-mouth-chip', transform: `translate(${tx.toFixed(1)},${ty.toFixed(1)})` });
      chip.append(el('circle', { r: 16, class: 'maze-mouth-chip-bg' }));
      const letter = el('text', { y: 6, class: 'maze-mouth-chip-letter', 'text-anchor': 'middle' });
      letter.textContent = EXIT_LETTERS[slot];
      chip.append(letter);
      mouthsGroup.append(stub, chip);
    }
    svg.append(mouthsGroup);
  }

  // No separate "entry label" — real bug found and fixed here
  // (worklog-B7.md §4, caught by the verify script's own screenshot): at
  // `position === 0` the token sits EXACTLY at `junctionAnchor(team,0,N)`
  // (junction 0 is defined to sit at the entry x-coordinate — see
  // `junctionAnchor`'s doc comment), which is the exact same point an
  // earlier version of this file also drew a separate team-name label at
  // — producing visibly doubled, overlapping text. The token's own label
  // (below) is the only team-name marker needed; it is present at every
  // position, including 0.

  // ---- tokens ----
  const tokenA = buildToken('A', p.positions[0], p.N, p.teamNames[0]);
  const tokenB = buildToken('B', p.positions[1], p.N, p.teamNames[1]);
  svg.append(tokenA, tokenB);

  return { svg, tokenA, tokenB };
}
