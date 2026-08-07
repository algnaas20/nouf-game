/**
 * `GameContext` extends the frozen `GameState` with what state deliberately
 * does NOT carry: the deck itself and the event log so far. Split into its
 * own module (rather than living in legal.ts) so `src/core/rules/*.ts` can
 * depend on the type without a circular import back into legal.ts.
 */

import type { GameEvent, Question } from '../contracts';

export interface GameContext {
  deck: readonly Question[];
  /** The full committed event log so far. `events.length` is the next `seq`. */
  events: readonly GameEvent[];
  /** Injectable clock for deterministic tests. Defaults to `Date.now`. */
  now?: () => number;
}
