/**
 * The readiness meter (PH-C3) — tells the host what their deck of
 * questions supports, using the deck-band thresholds already built and
 * owned by WL-A (`src/core/rules/deck-bands.ts`, D-09.12/13). This module
 * never reimplements the green/warn/refuse arithmetic — it only imports
 * `deckBand` and `preselectTrackLength` and formats their output.
 *
 * ---- Why N=10 is the reference track length --------------------------
 *
 * خطة.md Appendix أ gives two literal example messages:
 *   «أسئلتك ٢٦ — تكفي غالباً، وإذا كثرت الأخطاء ممكن تخلص الأسئلة قبل ما يوصل أحد»
 *   «أسئلتك ١٨ — تكفي لمسار ٦ خطوات»
 * Both reproduce **exactly** under `deckBand(D, 10)` and nothing else:
 *   deckBand(26, 10): greenThreshold = 3.34*10+4 = 37.4, refuseThreshold = 2*10+2 = 22.
 *     26 < 37.4 and 26 >= 22  ⇒ 'warn'.  ✓ matches the first example.
 *   deckBand(18, 10): 18 < 37.4 and 18 < 22  ⇒ 'refuse'.  ✓ matches the second.
 *   Its fallback "6" matches `preselectTrackLength(18)` exactly: neither
 *   preset ≤10 (6 or 10) is green at D=18 (deckBand(18,6): greenThreshold
 *   3.34*6+4=24.04, refuseThreshold 2*6+2=14; 18<24.04 and 18>=14 ⇒ 'warn',
 *   not green; deckBand(18,10)='refuse' as above) — so `preselectTrackLength`
 *   falls through to its "largest warn-or-better" branch, which is only 6
 *   (10 is refuse), and returns 6.
 * N=10 is also خطة.md's "عادية" (normal) preset — the middle of
 * «قصيرة»/«عادية»/«طويلة» (short/normal/long) — the sensible default to
 * measure against before the host has necessarily chosen a track length.
 */

import { deckBand, preselectTrackLength } from '../../core/rules/deck-bands';
import { deckGreenMessage, deckRefuseMessage, deckWarnMessage } from '../copy';
import type { DraftStore, DraftState } from '../draft-store';

export const READINESS_REFERENCE_TRACK_LENGTH = 10;

export interface ReadinessResult {
  deckSize: number;
  band: 'green' | 'warn' | 'refuse';
  message: string;
}

export function computeReadiness(deckSize: number): ReadinessResult {
  const band = deckBand(deckSize, READINESS_REFERENCE_TRACK_LENGTH);
  if (band === 'green') {
    return { deckSize, band, message: deckGreenMessage(deckSize) };
  }
  if (band === 'warn') {
    return { deckSize, band, message: deckWarnMessage(deckSize) };
  }
  const fallback = preselectTrackLength(deckSize);
  return { deckSize, band, message: deckRefuseMessage(deckSize, fallback) };
}

export function renderReadinessMeter(store: DraftStore): HTMLElement {
  const container = document.createElement('div');
  container.className = 'readiness-meter';
  container.dir = 'rtl';
  container.setAttribute('role', 'status');

  function render(state: DraftState): void {
    const result = computeReadiness(state.questions.length);
    container.className = `readiness-meter band-${result.band}`;
    container.textContent = result.message;
  }

  render(store.getState());
  store.subscribe(render);
  return container;
}
