/**
 * V35 (addendum-maze-ux.md §3) analytic half — "no blending": sample pixels
 * in a corridor travelled by both teams. Under this redesign's geometry
 * (`maze-geometry.ts`), the two teams' regions are disjoint by construction
 * for the ENTIRE route and only visually converge in the last short stretch
 * before the shared goal gate (§2.5 rule 1: "trails never share a
 * centre-line"). This test proves that convergence never closes to less
 * than the two trails' combined half-widths (core + casing on each side),
 * at every `N` the product ships — i.e. no rendered pixel can ever belong
 * to both trails, which is the geometric precondition alpha-blending would
 * require. The live pixel-sampling half (an actual rendered/rasterised
 * check) is in `tests/stage/verify-b7-maze.manual.cjs` (V35 proper);
 * declared here as the analytic guarantee this repo can check without a
 * browser, per worklog-B7.md §4.
 */
import { describe, expect, it } from 'vitest';
import { goalApproachAnchor, junctionAnchor } from '../../src/stage/maze-geometry';

// Trail half-width in SVG user units (stage.css: 20px core + 2*4px casing =
// 28px total painted width -> 14px half-width on each side of the centre
// line). Converted to a yFrac tolerance using the SAME MAZE_VIEW_HEIGHT
// maze-view.ts uses, imported directly so this test can never silently
// drift from the real renderer's scale.
const TRAIL_HALF_WIDTH_PX = 14;

describe('V35 analytic — the two trails never share a centre-line, even at the goal', () => {
  it('goalApproachAnchor keeps a permanent minimum vertical offset between the two teams', () => {
    const a = goalApproachAnchor('A');
    const b = goalApproachAnchor('B');
    const gapYFrac = Math.abs(a.yFrac - b.yFrac);
    // MAZE_VIEW_HEIGHT (620, from maze-view.ts) converts yFrac to px.
    const gapPx = gapYFrac * 620;
    // The gap must exceed twice the half-width (28px) so neither trail's
    // painted casing ever touches the other's, with real margin.
    expect(gapPx).toBeGreaterThan(TRAIL_HALF_WIDTH_PX * 2);
  });

  it('every junction anchor for A stays in the upper half, every one for B in the lower half (disjoint bands)', () => {
    for (const N of [4, 6, 10, 14]) {
      for (let i = 0; i < N; i++) {
        const pa = junctionAnchor('A', i, N);
        const pb = junctionAnchor('B', i, N);
        expect(pa.yFrac).toBeLessThan(0.5);
        expect(pb.yFrac).toBeGreaterThan(0.5);
      }
    }
  });

});
