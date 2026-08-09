/**
 * The DISTANT register (game-systems-expert 2026-08-08 §1, §3.2) — dense
 * decorative maze texture. Binding rule **M-FOG-1: this register must never
 * encode true topology.** Enforced here structurally, not by discipline: this
 * module's only public function takes a single `number` (`decorSeed`) and
 * NOTHING else — no `MazeLayout`, no route, no junction, no team. There is
 * therefore no route-shaped value this function could leak even if it tried;
 * a reviewer does not need to trust that nobody read `layout.routes` here,
 * because the type signature makes it impossible to.
 *
 * `tests/stage/maze-fog.test.ts` proves the two required red→green
 * mutations against this exact file (see that file's own header for the
 * mutation log).
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Pure 32-bit hash — deliberately a SEPARATE implementation from
 *  `src/core/rng.ts`'s `hash32` and `src/core/rules/maze.ts`'s `mix` (never
 *  imported from either): the decorative register must not even share code
 *  with the route generator, so a future edit to one can never accidentally
 *  couple the two. */
function decorMix(a: number, b: number): number {
  let h = (a ^ 0x27d4eb2f) >>> 0;
  h = Math.imul(h ^ b, 0x165667b1) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d) >>> 0;
  h ^= h >>> 12;
  return h >>> 0;
}

export interface DecorWall {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** Fixed background grid the decorative texture is drawn onto — a constant,
 *  never a function of `N` or any route data (the drawn maze's cell count
 *  and the game's step count are decoupled, §3.1). */
const GRID_COLS = 22;
const GRID_ROWS = 9;

/**
 * Builds a dense field of decorative wall segments from `decorSeed` ALONE.
 * Pure, deterministic: the same `decorSeed` always yields byte-identical
 * output. Coordinates are fractions of the maze view box (`0..1`), consumed
 * by `screens/maze-view.ts`.
 */
export function buildDecorWalls(decorSeed: number): DecorWall[] {
  const walls: DecorWall[] = [];
  const cellW = 1 / GRID_COLS;
  const cellH = 1 / GRID_ROWS;
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      const h = decorMix(decorSeed, row * GRID_COLS + col);
      // Each cell may draw a right wall and/or a bottom wall — enough
      // density to read as "a maze, walls everywhere" (§1's declared
      // fiction) without needing any topology at all.
      if ((h & 0b1) === 0) {
        const x = (col + 1) * cellW;
        walls.push({ x1: x, y1: row * cellH, x2: x, y2: (row + 1) * cellH });
      }
      if ((h & 0b10) === 0) {
        const y = (row + 1) * cellH;
        walls.push({ x1: col * cellW, y1: y, x2: (col + 1) * cellW, y2: y });
      }
    }
  }
  return walls;
}

/** Renders the decorative field as a single, low-opacity SVG group — no
 *  station, no token, no dead-end stamp is ever drawn from this function
 *  (it only ever receives `DecorWall[]`, which carries no such concept). */
export function buildDecorGroup(walls: readonly DecorWall[], viewW: number, viewH: number): SVGGElement {
  const g = document.createElementNS(SVG_NS, 'g');
  g.setAttribute('class', 'maze-decor-group');
  for (const w of walls) {
    const line = document.createElementNS(SVG_NS, 'line');
    line.setAttribute('x1', (w.x1 * viewW).toFixed(1));
    line.setAttribute('y1', (w.y1 * viewH).toFixed(1));
    line.setAttribute('x2', (w.x2 * viewW).toFixed(1));
    line.setAttribute('y2', (w.y2 * viewH).toFixed(1));
    line.setAttribute('class', 'maze-decor-wall');
    g.append(line);
  }
  return g;
}
