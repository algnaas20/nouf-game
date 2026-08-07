/**
 * D-09.13 — deck-size bands, thresholds set by `play-experience-advisor`.
 * `D` = deck size (number of questions), `N` = track length (stations).
 *
 * Green already bakes in D-09.10's 4-question decider reserve (the "+4"
 * term) — there is no separate runtime reservation of specific questions;
 * the reserve is purely this setup-time arithmetic margin.
 */

export type DeckBand = 'green' | 'warn' | 'refuse';

export function deckBand(D: number, N: number): DeckBand {
  const greenThreshold = 3.34 * N + 4;
  const refuseThreshold = 2 * N + 2;
  if (D >= greenThreshold) return 'green';
  if (D >= refuseThreshold) return 'warn';
  return 'refuse';
}

/**
 * The largest N for which `D` questions land in the green band — the
 * editor's "your deck of D supports N stations" number (coordinator's A2
 * item 4). Exact inverse of the green-band formula:
 *   D >= 3.34N + 4  <=>  N <= (D - 4) / 3.34
 * This is the precise form of the report's rough `N_max ≈ D·p/2` estimate,
 * self-consistent with `deckBand` rather than a second, looser formula.
 */
export function maxGreenTrackLength(D: number): number {
  return Math.max(0, Math.floor((D - 4) / 3.34));
}

const PRESETS = [6, 10, 14] as const;
export type TrackPreset = (typeof PRESETS)[number];

/**
 * D-09.12 — pre-selects the largest preset the deck comfortably (green)
 * supports, capped at 10. Falls back to the largest preset that is at
 * least 'warn' (offered, not blocked); falls back to the smallest preset
 * otherwise (still shown, correctly labelled 'refuse' by `deckBand`).
 */
export function preselectTrackLength(D: number): TrackPreset {
  const cappedPresets = PRESETS.filter((n) => n <= 10);
  const green = cappedPresets.filter((n) => deckBand(D, n) === 'green');
  if (green.length > 0) return green[green.length - 1]!;
  const warn = cappedPresets.filter((n) => deckBand(D, n) !== 'refuse');
  if (warn.length > 0) return warn[warn.length - 1]!;
  return PRESETS[0];
}
