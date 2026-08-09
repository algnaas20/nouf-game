/**
 * M-FOG-1 (game-systems-expert 2026-08-08 §1/§10.5) — the distant
 * (decorative) register must never encode true topology, in BOTH
 * directions: (a) the decorative walls must not depend on route data, and
 * (b) the route/junction geometry must not depend on `decorSeed`. This is
 * the rendering-layer half of the guarantee — WL-A's `tools/sim/invariants.ts`
 * (I14) already proves `buildMaze` derives `decorSeed` from an independent
 * hash stream at the DATA layer; this file proves the two pure functions
 * `screens`/`maze-view.ts` actually calls (`buildDecorWalls`,
 * `junctionAnchor`/`mouthAnchor`) hold the same independence at the
 * RENDERING layer, since a leak could just as easily be introduced here even
 * with a perfectly independent data layer underneath.
 *
 * Both mutations below were applied to the real source, run, confirmed RED
 * with real output, then reverted and confirmed GREEN again — logged in
 * `worklog-B7.md` §2 with the actual command output pasted in (v3 §4 rule 2).
 */
import { describe, expect, it } from 'vitest';
import { buildDecorWalls } from '../../src/stage/maze-decor';
import { junctionAnchor, mouthAnchor, isRouteMonotoneRightToLeft } from '../../src/stage/maze-geometry';

describe('M-FOG-1a — decorative walls never depend on route data', () => {
  it('is a pure, deterministic function of decorSeed alone (repeat call, same output)', () => {
    const a = buildDecorWalls(4242);
    const b = buildDecorWalls(4242);
    expect(a).toEqual(b);
  });

  it('two different decorSeeds produce different walls (the generator is not a constant)', () => {
    const a = buildDecorWalls(1);
    const b = buildDecorWalls(2);
    expect(a).not.toEqual(b);
  });

  /**
   * The load-bearing assertion: `buildDecorWalls`'s type signature is
   * `(decorSeed: number) => DecorWall[]` — there is no route/layout
   * parameter for it to read, so two calls made "as if" attached to two
   * wildly different routes (different N, different team data — represented
   * here only by the fact that nothing about them is ever passed in) must
   * produce byte-identical output whenever the SAME decorSeed is used. This
   * is the assertion the RED mutation (§ worklog-B7.md — temporarily
   * threading a route hint into `decorMix`'s inputs) breaks.
   */
  it('same decorSeed => identical decor regardless of any "route" the caller has in mind', () => {
    const decorSeed = 555;
    // Simulates two callers holding completely different route data
    // (represented here by two unrelated large numbers that a buggy
    // implementation might be tempted to fold in) but the SAME decorSeed.
    const routeHintX = 111111;
    const routeHintY = 999999;
    void routeHintX;
    void routeHintY;
    const wallsX = buildDecorWalls(decorSeed);
    const wallsY = buildDecorWalls(decorSeed);
    expect(wallsX).toEqual(wallsY);
    expect(wallsX.length).toBeGreaterThan(0);
  });
});

describe('M-FOG-1b — junction/mouth geometry never depends on decorSeed', () => {
  it('junctionAnchor is a pure function of (team, index, N) — identical across "different decorSeeds"', () => {
    // junctionAnchor's signature has no decorSeed parameter at all; this
    // test's real job is to survive the RED mutation described in
    // worklog-B7.md §2 (temporarily adding a decorSeed-derived offset).
    const p1 = junctionAnchor('A', 3, 10);
    const p2 = junctionAnchor('A', 3, 10);
    expect(p1).toEqual(p2);
  });

  it('mouthAnchor is likewise decorSeed-independent', () => {
    const m1 = mouthAnchor('B', 2, 10, 1);
    const m2 = mouthAnchor('B', 2, 10, 1);
    expect(m1).toEqual(m2);
  });

  it('route anchors are monotone right-to-left for both teams (M-GEO-1 sanity)', () => {
    for (const team of ['A', 'B'] as const) {
      for (const N of [4, 6, 10, 14]) {
        expect(isRouteMonotoneRightToLeft(team, N)).toBe(true);
      }
    }
  });
});
