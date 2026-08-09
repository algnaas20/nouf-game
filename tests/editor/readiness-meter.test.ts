/**
 * PH-C3 / addendum-deck-floor-2026-08-08 — the readiness meter must read
 * its thresholds AND its "questions needed" numbers from WL-A's
 * `src/core/rules/deck-bands.ts`, never an invented number (D-09.24: "add
 * X more" must use the SAME `ceil` the band check itself uses). These
 * tests assert against the addendum's own literal worked examples verbatim
 * (hand-copied from `addendum-deck-floor-2026-08-08.md`, not derived from
 * the code under test), proving both the import is real and the dynamic
 * `N = preselectTrackLength(D)` derivation documented in
 * readiness-meter.ts is correct.
 */
import { describe, expect, it } from 'vitest';
import { computeReadiness } from '../../src/editor/ui/readiness-meter';
import {
  deckBand,
  preselectTrackLength,
  questionsNeededForComfortable,
  questionsNeededForPlayable,
} from '../../src/core/rules/deck-bands';

describe('computeReadiness — imports WL-A deck-bands.ts, never reimplements it', () => {
  // addendum-deck-floor-2026-08-08.md §"The literal Arabic strings", #1:
  // «أسئلتك 9 — ناقصك 3 أسئلة عشان تبدأ لعبة «سريعة» (4 محطات)، و12 سؤالاً
  // عشان تلعب بارتياح.» — the READINESS METER's own §7 refuse variant is
  // shorter (no preset name/second number), but the R=3 figure must match.
  it('D=9 → refuse, N falls back to the new floor preset (4), R=3 matches the addendum verbatim', () => {
    const result = computeReadiness(9);
    console.log('readiness(9):', result);
    expect(result.band).toBe('refuse');
    expect(result.trackLength).toBe(4);
    expect(result.message).toBe('أسئلتك 9 — ناقصك 3 أسئلة عشان تقدر تبدأ.');
  });

  // addendum §"The literal Arabic strings", #3 worked example:
  // «أسئلتك 14 — تكفي لمسار 4 محطات. لو خلصت الأسئلة قبل ما يوصل أحد، يفوز
  // المتقدّم. زد 7 أسئلة وتلعب بارتياح.» — the editor's §7 "Playable"
  // variant drops the middle "لو خلصت..." sentence (that belongs to the
  // setup screen's band line, not the editor); this test checks the editor
  // wording specifically, and independently checks N=4/G=7 match the
  // addendum's own numbers so the two can never silently diverge.
  it('D=14 → warn, N=4 (سريعة), G=7 — matches the addendum\'s own worked example numbers', () => {
    const result = computeReadiness(14);
    console.log('readiness(14):', result);
    expect(result.band).toBe('warn');
    expect(result.trackLength).toBe(4);
    expect(result.message).toBe('أسئلتك 14 — تكفي لمسار 4 محطات. زد 7 أسئلة وتلعب بارتياح.');
    // Cross-check against the addendum's own worked numbers directly.
    expect(preselectTrackLength(14)).toBe(4);
    expect(questionsNeededForComfortable(14, 4)).toBe(7);
  });

  it('a comfortably large deck (D=60) is green and names the real supported track length, not a hardcoded 10', () => {
    const result = computeReadiness(60);
    console.log('readiness(60):', result);
    expect(result.band).toBe('green');
    expect(result.message).toContain('60');
    expect(result.message).toContain(String(result.trackLength));
    expect(result.trackLength).toBe(preselectTrackLength(60));
  });

  it('D-09.25 count agreement inside the message: D=1 short of the floor uses «سؤال واحد», not «1 أسئلة»', () => {
    // refuse threshold at N=4 is 12 (2*(4+1)+2) — D=11 is exactly one short.
    const result = computeReadiness(11);
    expect(result.band).toBe('refuse');
    expect(questionsNeededForPlayable(11, 4)).toBe(1);
    expect(result.message).toBe('أسئلتك 11 — ناقصك سؤال واحد عشان تقدر تبدأ.');
  });

  it('cross-check: computeReadiness never re-derives a threshold — its band always equals deckBand(D, preselectTrackLength(D)) directly', () => {
    for (const d of [0, 1, 5, 9, 11, 12, 14, 16, 18, 21, 22, 26, 37, 38, 60, 150]) {
      const n = preselectTrackLength(d);
      expect(computeReadiness(d).band).toBe(deckBand(d, n));
      expect(computeReadiness(d).trackLength).toBe(n);
    }
  });

  it('D-09.13‴ migration guard: a deck that used to be playable at 14 (old floor) is never refused now that «سريعة» exists', () => {
    // The old N=6 floor moved from 14 to 16 under the N->N+1 maze shift;
    // without the new N=4 preset this deck would have regressed from
    // playable to refused. It must not.
    const result = computeReadiness(14);
    expect(result.band).not.toBe('refuse');
  });
});
