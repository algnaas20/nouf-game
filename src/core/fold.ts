/**
 * `fold` — state is always derived, never stored. `undo` — pop the last
 * event and re-fold. No hand-written per-field restoration exists anywhere
 * in this module or in the reducer.
 */

import type { GameEvent, GameState } from '../contracts';
import { applyEvent, initialState } from './reducer';

export function fold(events: readonly GameEvent[]): GameState {
  return events.reduce((state, event) => applyEvent(state, event), initialState());
}

/**
 * Undo = pop the last committed event and re-fold the remaining prefix.
 * Returns both the new (shorter) log and its derived state, since callers
 * hold the log, not the state, as the source of truth.
 */
export function undo(events: readonly GameEvent[]): { events: GameEvent[]; state: GameState } {
  const popped = events.slice(0, -1);
  return { events: popped, state: fold(popped) };
}
