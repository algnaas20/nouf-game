/**
 * Seeded, pure RNG. `drawInt` is a pure function of `(seed, drawIndex)` —
 * never a stateful generator object — so that `RngState.drawIndex` (frozen
 * contract, state.ts) is genuinely "part of the folded state": re-folding
 * any prefix of the event log reproduces byte-identical future draws.
 */

import type { RngState } from '../contracts';

/** 32-bit deterministic mix of (seed, drawIndex). Pure, no closures, no mutation. */
function hash32(seed: number, drawIndex: number): number {
  let h = (seed ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ drawIndex, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

export function createRng(seed: number): RngState {
  return { seed, drawIndex: 0 };
}

/** Draws a pseudo-random integer in [0, maxExclusive). Pure — returns the next RngState. */
export function drawInt(rng: RngState, maxExclusive: number): { value: number; rng: RngState } {
  if (maxExclusive <= 0) {
    throw new Error(`drawInt: maxExclusive must be > 0, got ${maxExclusive}`);
  }
  const raw = hash32(rng.seed, rng.drawIndex);
  const value = raw % maxExclusive;
  return { value, rng: { seed: rng.seed, drawIndex: rng.drawIndex + 1 } };
}
