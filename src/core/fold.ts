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

/**
 * Commits a candidate event, keyed by `(eventCount, eventType)` —
 * `event.seq` IS the event count at the moment the candidate was
 * constructed, so a stale re-dispatch of the same tap (a double-tap
 * arriving after the first dispatch already advanced the log) carries a
 * `seq` that no longer matches `events.length` and is silently ignored
 * instead of being applied a second time. This is deliberately NOT a throw
 * (unlike a genuinely illegal event, I5) — a double-tap is an ordinary,
 * expected occurrence on a touch/remote UI, not an error condition.
 */
export function commit(
  events: readonly GameEvent[],
  event: GameEvent,
): { events: GameEvent[]; state: GameState; applied: boolean } {
  if (event.seq !== events.length) {
    return { events: events.slice(), state: fold(events), applied: false };
  }
  const nextEvents = [...events, event];
  return { events: nextEvents, state: fold(nextEvents), applied: true };
}
