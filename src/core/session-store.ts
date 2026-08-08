/**
 * Synchronous session persistence — the ONLY thing this file persists is
 * the append-only event log. `fold(events)` (already proven correct across
 * 27,000+ simulated games, tools/sim/) regenerates positions, attempts,
 * `currentTeam` (turn), `usedQuestionIds`, `rng.drawIndex` and
 * `optionOrder` losslessly — there is no separate "session snapshot"
 * format to invent or keep in sync.
 *
 * This is a *different* store from `src/storage/idb.ts` (WL-C's — drafts
 * and media, IndexedDB, asynchronous, can be large). This store is tiny
 * (an event log is a few KB), synchronous, and uses `localStorage` — never
 * IndexedDB — because the one property that matters here is completing
 * within the same tick as the transition that triggered it (game-systems-
 * expert §6.3: "the session write must be synchronous and complete within
 * the same tick... An asynchronous write can be lost on a hard tab close").
 *
 * Never auto-resumes, never auto-deletes: `checkResume` only *reports*
 * what is stored. The caller (the stage) decides, from an explicit
 * "تكملة الجلسة" / "جلسة جديدة" prompt, whether to actually resume.
 */

import type { GameEvent, GameState } from '../contracts';
import { fold } from './fold';

const STORAGE_KEY = 'nouf-game:session:v1';

/** The subset of the `Storage` interface this module needs — injectable so
 *  fast unit tests can use a plain in-memory fake (same pattern as
 *  `tests/editor/support/fake-backend.ts`'s `FakeBackend`), while the real
 *  path defaults to `window.localStorage` unmodified. */
export interface SessionStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function defaultStorage(): SessionStorageLike | null {
  if (typeof globalThis !== 'undefined') {
    const ls = (globalThis as { localStorage?: SessionStorageLike }).localStorage;
    if (ls) return ls;
  }
  return null;
}

export interface StoredSession {
  events: GameEvent[];
}

/**
 * Synchronous write. Returns before any microtask/macrotask boundary —
 * `localStorage.setItem` is itself synchronous, and nothing here awaits
 * anything. If no storage medium is available (SSR, a non-browser test
 * that didn't inject one), this is a silent no-op — it never throws, since
 * losing session persistence must never be what crashes a live game.
 */
export function saveSession(
  events: readonly GameEvent[],
  storage: SessionStorageLike | null = defaultStorage(),
): void {
  if (!storage) return;
  const payload: StoredSession = { events: events as GameEvent[] };
  storage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

/** Low-level read. Returns `null` for "nothing stored" AND for "stored but
 *  unparseable" alike — a corrupt payload is never surfaced as a thrown
 *  error to the caller, only ever as an absence. */
export function loadRawSession(
  storage: SessionStorageLike | null = defaultStorage(),
): StoredSession | null {
  if (!storage) return null;
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredSession;
    if (!parsed || !Array.isArray(parsed.events)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearSession(storage: SessionStorageLike | null = defaultStorage()): void {
  if (!storage) return;
  storage.removeItem(STORAGE_KEY);
}

export type ResumeCheck =
  | { kind: 'none' }
  | { kind: 'refused'; reason: 'deck-mismatch'; storedDeckHash: string; currentDeckHash: string }
  | { kind: 'refused'; reason: 'corrupt' }
  | { kind: 'available'; events: GameEvent[]; state: GameState };

/**
 * The single entry point the stage should call on load. Never mutates
 * storage, never decides to resume or discard — it only classifies what is
 * there so the UI can show the explicit two-button prompt (or nothing, if
 * there is nothing resumable).
 *
 * Refuses (does not silently partial-load) when the stored session's
 * `deckHash` (on its `GAME_STARTED` event — the frozen contract already
 * carries this) does not match the currently-loaded deck's hash. The event
 * log references questions by id; if the deck changed underneath, replaying
 * that log against a different deck would resume into state that is
 * quietly wrong (wrong question text, wrong correct answer, or a missing
 * question entirely) rather than loudly wrong.
 */
export function checkResume(
  currentDeckHash: string,
  storage: SessionStorageLike | null = defaultStorage(),
): ResumeCheck {
  const stored = loadRawSession(storage);
  if (!stored || stored.events.length === 0) return { kind: 'none' };

  const first = stored.events[0];
  if (!first || first.type !== 'GAME_STARTED') {
    return { kind: 'refused', reason: 'corrupt' };
  }
  if (first.deckHash !== currentDeckHash) {
    return {
      kind: 'refused',
      reason: 'deck-mismatch',
      storedDeckHash: first.deckHash,
      currentDeckHash,
    };
  }

  let state: GameState;
  try {
    state = fold(stored.events);
  } catch {
    return { kind: 'refused', reason: 'corrupt' };
  }

  // A finished game has nothing left to resume into.
  if (state.stateId === 'FINISHED') return { kind: 'none' };

  return { kind: 'available', events: stored.events, state };
}
