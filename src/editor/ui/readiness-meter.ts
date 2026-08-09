/**
 * The readiness meter (PH-C3, rewritten per `addendum-deck-floor-2026-08-
 * 08.md` §"Editor readiness meter — continuous, three states") — tells the
 * host what their deck of questions supports AND, critically, how many
 * more questions the next milestone costs (D-09.21: no refusal without a
 * number). This module never reimplements the band/threshold arithmetic —
 * it only imports `deckBand`, `preselectTrackLength`,
 * `questionsNeededForPlayable` and `questionsNeededForComfortable` from
 * WL-A's `src/core/rules/deck-bands.ts` and formats their output.
 *
 * ---- How `N` is chosen, and why it is never hardcoded -----------------
 *
 * `N = preselectTrackLength(deckSize)` — the SAME function team-setup uses
 * to pick a default preset — always returns a real, existing preset from
 * `PRESETS` (now `[4, 6, 10, 14]`), never an invented number:
 *   - Below the absolute floor (D < 12, refuse even at the smallest preset
 *     «سريعة», N=4): `preselectTrackLength` falls through to `PRESETS[0]`,
 *     which IS 4 now — so `N` is always 4 in the refuse state, giving
 *     `questionsNeededForPlayable(D, 4)` = `12 − D`, matching the
 *     addendum's own worked example verbatim: D=9 → «ناقصك 3 أسئلة».
 *   - Once at least one preset is reachable, `preselectTrackLength` returns
 *     the LARGEST comfortably-or-warn-supported preset — e.g. D=14 resolves
 *     to N=4 (warn), matching the addendum's other worked example
 *     («أسئلتك 14 — تكفي لمسار 4 محطات... زد 7 أسئلة») exactly.
 * `deckBand(deckSize, N)` on that same `N` then decides which of the three
 * §7 messages applies, and `questionsNeededForPlayable`/
 * `questionsNeededForComfortable` (both routed through the identical
 * `Math.ceil` the band check itself uses, per D-09.24) supply the numbers.
 */

import {
  deckBand,
  preselectTrackLength,
  questionsNeededForComfortable,
  questionsNeededForPlayable,
} from '../../core/rules/deck-bands';
import { deckGreenMessage, deckRefuseMessage, deckWarnMessage } from '../copy';
import type { DraftStore, DraftState } from '../draft-store';

export interface ReadinessResult {
  deckSize: number;
  band: 'green' | 'warn' | 'refuse';
  trackLength: number;
  message: string;
}

export function computeReadiness(deckSize: number): ReadinessResult {
  const trackLength = preselectTrackLength(deckSize);
  const band = deckBand(deckSize, trackLength);
  if (band === 'green') {
    return { deckSize, band, trackLength, message: deckGreenMessage(deckSize, trackLength) };
  }
  if (band === 'warn') {
    const comfortGap = questionsNeededForComfortable(deckSize, trackLength);
    return { deckSize, band, trackLength, message: deckWarnMessage(deckSize, trackLength, comfortGap) };
  }
  const playableGap = questionsNeededForPlayable(deckSize, trackLength);
  return { deckSize, band, trackLength, message: deckRefuseMessage(deckSize, playableGap) };
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
