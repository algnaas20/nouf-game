/**
 * The maze house — full-stage SVG (§6.4: "the maze is a beat, not a
 * permanent strip"). Renders the congruent two-lane corridor from
 * `maze-geometry.ts` plus decorative dead ends (D-09.6, constraint row 7:
 * no station inside one, no token-width opening — enforced by construction
 * here since the dead-end drawing code never calls the station-drawing
 * code, and the mouth is explicitly capped with a drawn wall block).
 */
import { CORRIDOR_SPINE, DECORATIVE_DEAD_ENDS, stationProgressValues, toStagePoint, pointAtProgress } from '../maze-geometry';

const SVG_NS = 'http://www.w3.org/2000/svg';
export const MAZE_VIEW_WIDTH = 1728;
export const MAZE_VIEW_HEIGHT = 620;

function pt(xFrac: number, yFrac: number): [number, number] {
  return [xFrac * MAZE_VIEW_WIDTH, yFrac * MAZE_VIEW_HEIGHT];
}

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

function laneD(lane: 'A' | 'B', samples = 48): string {
  const pts: [number, number][] = [];
  for (let i = 0; i <= samples; i++) {
    const p = toStagePoint(lane, i / samples);
    pts.push(pt(p.xFrac, p.yFrac));
  }
  return 'M ' + pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L ');
}

export interface MazeViewParams {
  N: number;
  positions: [number, number];
  teamNames: [string, string];
}

export interface MazeViewResult {
  svg: SVGSVGElement;
  tokenA: SVGGElement;
  tokenB: SVGGElement;
}

export function buildMazeView(p: MazeViewParams): MazeViewResult {
  const svg = el('svg', {
    viewBox: `0 0 ${MAZE_VIEW_WIDTH} ${MAZE_VIEW_HEIGHT}`,
    class: 'maze-svg',
    role: 'img',
    'aria-label': 'المتاهة',
  });

  // ---- decorative dead ends FIRST (so lanes/stations paint over their
  // roots and read as clearly subordinate to the real corridor) ----
  const deadEndsGroup = el('g', { class: 'maze-dead-ends' });
  for (const d of DECORATIVE_DEAD_ENDS) {
    const anchor = pointAtProgress(d.fromProgress, CORRIDOR_SPINE);
    const [ax, ay] = pt(anchor.xFrac, anchor.yFrac);
    const endYFrac = anchor.yFrac + d.branchYFrac;
    const [ex, ey] = pt(anchor.xFrac, endYFrac);
    // The stub itself — short, no stations ever drawn along it (constraint
    // row 7 — this file's dead-end loop never calls the station code).
    const stub = el('path', {
      d: `M ${ax.toFixed(1)},${ay.toFixed(1)} L ${ex.toFixed(1)},${ey.toFixed(1)}`,
      class: 'maze-dead-end-stub',
    });
    // The wall block across the mouth — the explicit visual signal that
    // this is NOT a token-width opening onto the corridor: a solid bar
    // wider than the stub sits right at the junction.
    const wallHalfWidth = 14;
    const mouthWall = el('line', {
      x1: (ax - wallHalfWidth).toFixed(1),
      y1: (ay + (endYFrac > anchor.yFrac ? -6 : 6)).toFixed(1),
      x2: (ax + wallHalfWidth).toFixed(1),
      y2: (ay + (endYFrac > anchor.yFrac ? -6 : 6)).toFixed(1),
      class: 'maze-dead-end-wall',
    });
    // The far end cap — visibly closed off, not a doorway.
    const cap = el('line', {
      x1: (ex - 10).toFixed(1),
      y1: ey.toFixed(1),
      x2: (ex + 10).toFixed(1),
      y2: ey.toFixed(1),
      class: 'maze-dead-end-wall',
    });
    deadEndsGroup.append(stub, mouthWall, cap);
  }
  svg.append(deadEndsGroup);

  // ---- the two congruent lanes ----
  const laneAPath = el('path', { d: laneD('A'), class: 'maze-lane maze-lane-a' });
  const laneBPath = el('path', { d: laneD('B'), class: 'maze-lane maze-lane-b' });
  svg.append(laneAPath, laneBPath);

  // ---- stations (both lanes), N+1 dots each ----
  const stationsGroup = el('g', { class: 'maze-stations' });
  for (const lane of ['A', 'B'] as const) {
    for (const progress of stationProgressValues(p.N)) {
      const sp = toStagePoint(lane, progress);
      const [x, y] = pt(sp.xFrac, sp.yFrac);
      const dot = el('circle', { cx: x.toFixed(1), cy: y.toFixed(1), r: 6, class: `maze-station maze-station-${lane.toLowerCase()}` });
      stationsGroup.append(dot);
    }
  }
  svg.append(stationsGroup);

  // ---- start / finish markers (AR-COPY, literal) ----
  const startPt = pointAtProgress(0, CORRIDOR_SPINE);
  const finishPt = pointAtProgress(1, CORRIDOR_SPINE);
  const [sx, sy] = pt(startPt.xFrac, startPt.yFrac);
  const [fx, fy] = pt(finishPt.xFrac, finishPt.yFrac);

  const startLabel = el('text', { x: sx.toFixed(1), y: (sy - 34).toFixed(1), class: 'maze-marker-label', 'text-anchor': 'middle' });
  startLabel.textContent = 'البداية';
  const finishLabel = el('text', { x: fx.toFixed(1), y: (fy - 34).toFixed(1), class: 'maze-marker-label maze-finish-label', 'text-anchor': 'middle' });
  finishLabel.textContent = 'النهاية';
  const finishFlag = el('path', {
    d: `M ${fx.toFixed(1)},${(fy - 26).toFixed(1)} L ${fx.toFixed(1)},${(fy + 26).toFixed(1)} M ${fx.toFixed(1)},${(fy - 26).toFixed(1)} L ${(fx + 26).toFixed(1)},${(fy - 16).toFixed(1)} L ${fx.toFixed(1)},${(fy - 6).toFixed(1)} Z`,
    class: 'maze-finish-flag',
  });
  svg.append(startLabel, finishFlag, finishLabel);

  // ---- tokens ----
  function buildToken(lane: 'A' | 'B', teamName: string): SVGGElement {
    const progress = (lane === 'A' ? p.positions[0] : p.positions[1]) / p.N;
    const sp = toStagePoint(lane, progress);
    const [x, y] = pt(sp.xFrac, sp.yFrac);
    const g = el('g', { class: `maze-token maze-token-${lane.toLowerCase()}`, 'data-progress': progress.toFixed(4), transform: `translate(${x.toFixed(1)},${y.toFixed(1)})` });
    // Distinct glyph shapes (never colour alone, §7.3): team A = circle,
    // team B = diamond.
    if (lane === 'A') {
      g.append(el('circle', { r: 18, class: 'maze-token-shape' }));
    } else {
      g.append(el('rect', { x: -14, y: -14, width: 28, height: 28, transform: 'rotate(45)', class: 'maze-token-shape' }));
    }
    const label = el('text', { y: -28, class: 'maze-token-label', 'text-anchor': 'middle' });
    label.textContent = teamName;
    g.append(label);
    return g;
  }

  const tokenA = buildToken('A', p.teamNames[0]);
  const tokenB = buildToken('B', p.teamNames[1]);
  svg.append(tokenA, tokenB);

  return { svg, tokenA, tokenB };
}
