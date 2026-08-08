/**
 * PH-C3 — the readiness meter must read its thresholds from WL-A's
 * `src/core/rules/deck-bands.ts`, never an invented number (AC2). These
 * tests assert against the two literal Appendix-أ example messages
 * verbatim (hand-copied from خطة.md, not derived from the code under
 * test), proving both the import is real and the N=10 reference-length
 * derivation documented in readiness-meter.ts is correct.
 */
import { describe, expect, it } from 'vitest';
import { computeReadiness, READINESS_REFERENCE_TRACK_LENGTH } from '../../src/editor/ui/readiness-meter';
import { deckBand } from '../../src/core/rules/deck-bands';

describe('computeReadiness — imports WL-A deck-bands.ts, never reimplements it', () => {
  it('reference track length is 10 ("عادية")', () => {
    expect(READINESS_REFERENCE_TRACK_LENGTH).toBe(10);
  });

  it('D=26 → warn, matching خطة.md Appendix أ literally: «أسئلتك 26 — تكفي غالباً، وإذا كثرت الأخطاء ممكن تخلص الأسئلة قبل ما يوصل أحد»', () => {
    const result = computeReadiness(26);
    console.log('readiness(26):', result);
    expect(result.band).toBe('warn');
    expect(result.message).toBe(
      'أسئلتك 26 — تكفي غالباً، وإذا كثرت الأخطاء ممكن تخلص الأسئلة قبل ما يوصل أحد',
    );
  });

  // D-09.26 (addendum-deck-floor-2026-08-08.md, binding) overrides خطة.md's
  // own literal Appendix-أ string by name: track length is «محطات», never
  // «خطوات» — a «خطوة» is now a move under the branching maze, and a move
  // can be wasted on a dead end, so «خطوات» is literally false.
  it('D=18 → refuse, matching the D-09.26 vocabulary fix: «أسئلتك 18 — تكفي لمسار 6 محطات»', () => {
    const result = computeReadiness(18);
    console.log('readiness(18):', result);
    expect(result.band).toBe('refuse');
    expect(result.message).toBe('أسئلتك 18 — تكفي لمسار 6 محطات');
  });

  it('a comfortably large deck (D=60) is green', () => {
    const result = computeReadiness(60);
    console.log('readiness(60):', result);
    expect(result.band).toBe('green');
    expect(result.message).toContain('60');
  });

  it('cross-check: computeReadiness\'s band at N=10 always equals deckBand(D,10) directly — same import, not a coincidence', () => {
    for (const d of [0, 5, 14, 18, 22, 26, 37, 38, 60, 150]) {
      expect(computeReadiness(d).band).toBe(deckBand(d, READINESS_REFERENCE_TRACK_LENGTH));
    }
  });
});
