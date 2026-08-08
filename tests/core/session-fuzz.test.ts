/**
 * PH-A4 criterion 2 — S9-style: serialize/deserialize through the REAL
 * `session-store.ts` (`saveSession`/`loadRawSession`) at every step, for
 * ≥1,000 games, comparing the resumed run's final outcome against an
 * uninterrupted run driven by the identical decision sequence. Reuses
 * `tools/sim`'s real functions (never a copy — same discipline as A3).
 */

import { describe, expect, it } from 'vitest';
import type { GameEvent, TeamId } from '../../src/contracts';
import { fold } from '../../src/core/fold';
import { applyEvent } from '../../src/core/reducer';
import { legalEvents, type GameContext } from '../../src/core/legal';
import { saveSession, loadRawSession, type SessionStorageLike } from '../../src/core/session-store';
import { generateDeck } from '../../tools/sim/deck';
import { startEvent } from '../../tools/sim/harness';

function createFakeStorage(): SessionStorageLike {
  const raw = new Map<string, string>();
  return {
    getItem: (k) => (raw.has(k) ? raw.get(k)! : null),
    setItem: (k, v) => void raw.set(k, v),
    removeItem: (k) => void raw.delete(k),
  };
}

function makeFuzzRand(seed: number): () => number {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0;
    return s / 4294967296;
  };
}

/** Dispatch order MUST mirror tools/sim/harness.ts's playGame exactly
 *  (single forced candidate first, no rand() draw), or the two decision
 *  streams desync for a reason that has nothing to do with the refresh —
 *  the exact bug caught and documented in worklog-A3.md. */
function pick(rand: () => number, candidates: readonly GameEvent[]): GameEvent {
  const allGameEnded = candidates.every((c) => c.type === 'GAME_ENDED');
  if (candidates.length === 1) return candidates[0]!;
  if (allGameEnded) {
    return candidates.find((c) => c.type === 'GAME_ENDED' && c.outcome === 'draw') ?? candidates[0]!;
  }
  return candidates[Math.floor(rand() * candidates.length)]!;
}

describe('PH-A4 criterion 2 — session-store S9-style fuzz (≥1000 games)', () => {
  it('save+load at every step through the real session-store; resumed run matches an uninterrupted run, zero diffs', () => {
    // 1000 games, doubled (each also re-run uninterrupted for comparison),
    // with a full save/load cycle at every step — comfortably correct but
    // slower than vitest's 5s default.
    const GAMES = 1000;
    const deck = generateDeck(25);
    let checks = 0;
    let mismatches = 0;

    for (let seed = 1; seed <= GAMES; seed++) {
      const firstTeam: TeamId = seed % 2 === 0 ? 'A' : 'B';
      const rand = makeFuzzRand(seed + 555555);
      const storage = createFakeStorage();

      let events: GameEvent[] = [startEvent(seed, firstTeam, 10, deck)];
      let state = fold(events);
      let steps = 0;
      const maxSteps = 20 * deck.length + 40;

      while (state.stateId !== 'FINISHED' && steps < maxSteps) {
        const ctx: GameContext = { deck, events, now: () => 0 };
        const candidates = legalEvents(state, ctx);
        if (candidates.length === 0) break;
        const chosen = pick(rand, candidates);
        state = applyEvent(state, chosen);
        events.push(chosen);

        // Save through the REAL session-store, then reload through the
        // REAL session-store — simulating a refresh at every single step.
        saveSession(events, storage);
        const reloaded = loadRawSession(storage);
        expect(reloaded).not.toBeNull();
        const reloadedState = fold(reloaded!.events);
        checks++;
        if (JSON.stringify(reloadedState) !== JSON.stringify(state) || JSON.stringify(reloaded!.events) !== JSON.stringify(events)) {
          mismatches++;
        }
        // Continue play from the RELOADED log/state (not the original
        // in-memory ones) — the whole point of this fuzz.
        events = reloaded!.events;
        state = reloadedState;
        steps++;
      }

      // Compare the resumed-at-every-step run's final outcome against an
      // uninterrupted run driven by the identical decision sequence.
      const uninterruptedRand = makeFuzzRand(seed + 555555);
      let uEvents: GameEvent[] = [startEvent(seed, firstTeam, 10, deck)];
      let uState = fold(uEvents);
      let uSteps = 0;
      while (uState.stateId !== 'FINISHED' && uSteps < maxStepsFor(deck.length)) {
        const ctx: GameContext = { deck, events: uEvents, now: () => 0 };
        const candidates = legalEvents(uState, ctx);
        if (candidates.length === 0) break;
        const chosen = pick(uninterruptedRand, candidates);
        uState = applyEvent(uState, chosen);
        uEvents.push(chosen);
        uSteps++;
      }

      if (state.outcome !== uState.outcome) {
        mismatches++;
      }
    }

    // eslint-disable-next-line no-console
    console.log(`[A4 criterion 2] S9-style save/load checks=${checks} across ${GAMES} games, mismatches=${mismatches}`);
    expect(checks).toBeGreaterThan(0);
    expect(mismatches).toBe(0);
  }, 30000);
});

function maxStepsFor(deckLength: number): number {
  return 20 * deckLength + 40;
}
