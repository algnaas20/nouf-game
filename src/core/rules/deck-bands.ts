/**
 * D-09.13 — deck-size bands, thresholds set by `play-experience-advisor`,
 * restated by game-systems-expert 2026-08-08 §9 for the branching-maze
 * movement model: a perfect game now needs `N+1` moves in ~98% of games
 * (the one-stumble rule), not `N`, so every threshold's `N` becomes `N+1`.
 * The shape of the ruling (and the "+4" decider-reserve term) is unchanged.
 *
 * Green already bakes in D-09.10's 4-question decider reserve (the "+4"
 * term) — there is no separate runtime reservation of specific questions;
 * the reserve is purely this setup-time arithmetic margin.
 *
 * D-09.13′/addendum-deck-floor-2026-08-08 (play-experience-advisor): the
 * threshold FORMULAS below were never wrong and stay exactly as written —
 * `greenThresholdRaw`/`refuseThresholdRaw` are the single source of truth
 * `deckBand`, `questionsNeededForPlayable` and `questionsNeededForComfortable`
 * all read from, so "add X more" can never drift from what actually flips
 * the band (D-09.24). What was wrong was the preset FLOOR of 6 — fixed
 * below by adding the N=4 «سريعة» preset (D-09.12′).
 */

export type DeckBand = 'green' | 'warn' | 'refuse';

/** Raw (possibly fractional) green threshold — `deckBand` compares an
 *  integer `D` against this directly, which is why "the ceiling of this
 *  value" is the exact number of questions that flips the band; see
 *  `questionsNeededForComfortable`. */
function greenThresholdRaw(N: number): number {
  return 3.34 * (N + 1) + 4;
}

/** Raw refuse threshold — always an integer for integer `N`, but routed
 *  through the same `Math.ceil` treatment as the green threshold for a
 *  single, uniform "questions needed" implementation (D-09.24). */
function refuseThresholdRaw(N: number): number {
  return 2 * (N + 1) + 2;
}

export function deckBand(D: number, N: number): DeckBand {
  if (D >= greenThresholdRaw(N)) return 'green';
  if (D >= refuseThresholdRaw(N)) return 'warn';
  return 'refuse';
}

/**
 * D-09.21/D-09.24 — how many MORE questions turn this preset from 'refuse'
 * into at least 'warn' ("playable"). Uses `Math.ceil` on the exact same
 * `refuseThresholdRaw` that `deckBand` compares `D` against, so a caller
 * who adds this many questions is GUARANTEED to flip the band — never "add
 * 9 and the ninth doesn't do it" (the addendum's explicit failure mode).
 * `0` once already playable, never negative.
 */
export function questionsNeededForPlayable(D: number, N: number): number {
  return Math.max(0, Math.ceil(refuseThresholdRaw(N)) - D);
}

/**
 * D-09.21/D-09.24 — how many MORE questions turn this preset 'green'
 * ("comfortable"). Same discipline as `questionsNeededForPlayable`: derived
 * from the identical `greenThresholdRaw` `deckBand` uses, via `Math.ceil`,
 * so it can never under-promise. `0` once already green, never negative.
 */
export function questionsNeededForComfortable(D: number, N: number): number {
  return Math.max(0, Math.ceil(greenThresholdRaw(N)) - D);
}

/**
 * The largest N for which `D` questions land in the green band — the
 * editor's "your deck of D supports N stations" number (coordinator's A2
 * item 4). Exact inverse of the green-band formula:
 *   D >= 3.34(N+1) + 4  <=>  N <= (D - 4) / 3.34 - 1
 * self-consistent with `deckBand` rather than a second, looser formula
 * (game-systems-expert §10.4: "maxGreenTrackLength inverts to
 * floor((D − 4) / 3.34) − 1").
 */
export function maxGreenTrackLength(D: number): number {
  return Math.max(0, Math.floor((D - 4) / 3.34) - 1);
}

/**
 * D-09.12′ (play-experience-advisor, addendum-deck-floor-2026-08-08): the
 * floor of 6 was the error, not the threshold formulas. «سريعة» (N=4) is
 * always visible, keeps a real dead-end race (P(stumble)=0.80 at N=4 —
 * re-verified, not assumed, see worklog-A5.md) and puts the playable floor
 * at 12 — exactly where the field evidence's user was standing. This is the
 * ONLY change this ruling makes to the preset list; the formulas, the `<=10`
 * cap, and `preselectTrackLength`'s fallback shape are all unchanged.
 */
export const PRESETS = [4, 6, 10, 14] as const;
export type TrackPreset = (typeof PRESETS)[number];

/**
 * D-09.12 — pre-selects the largest preset the deck comfortably (green)
 * supports, capped at 10. Falls back to the largest preset that is at
 * least 'warn' (offered, not blocked); falls back to the smallest preset
 * otherwise (still shown, correctly labelled 'refuse' by `deckBand`).
 *
 * Unchanged in shape (addendum-deck-floor-2026-08-08's own claim) — adding
 * 4 to `PRESETS` is the entire fix: a thin deck that used to fall back to
 * `PRESETS[0] === 6` (a track it could not finish, per the field evidence)
 * now falls back to `PRESETS[0] === 4`, a track it actually can.
 */
export function preselectTrackLength(D: number): TrackPreset {
  const cappedPresets = PRESETS.filter((n) => n <= 10);
  const green = cappedPresets.filter((n) => deckBand(D, n) === 'green');
  if (green.length > 0) return green[green.length - 1]!;
  const warn = cappedPresets.filter((n) => deckBand(D, n) !== 'refuse');
  if (warn.length > 0) return warn[warn.length - 1]!;
  return PRESETS[0];
}
