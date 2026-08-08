/**
 * Fast, deterministic unit tests for PH-A4 using a hand-written in-memory
 * `SessionStorageLike` fake (same pattern as
 * tests/editor/support/fake-backend.ts). The REAL `localStorage` + a REAL
 * browser page reload is proven separately by
 * tests/core/live/real-refresh.ts (v3 §4: a real interruption, not a
 * simulated one) — this file's job is fast coverage of the logic.
 */

import { describe, expect, it } from 'vitest';
import type { GameEvent, Question, TeamId } from '../../src/contracts';
import { fold } from '../../src/core/fold';
import { applyEvent } from '../../src/core/reducer';
import { legalEvents, type GameContext } from '../../src/core/legal';
import {
  checkResume,
  clearSession,
  loadRawSession,
  saveSession,
  type SessionStorageLike,
} from '../../src/core/session-store';

function createFakeStorage(): SessionStorageLike & { raw: Map<string, string> } {
  const raw = new Map<string, string>();
  return {
    raw,
    getItem(key) {
      return raw.has(key) ? raw.get(key)! : null;
    },
    setItem(key, value) {
      raw.set(key, value);
    },
    removeItem(key) {
      raw.delete(key);
    },
  };
}

function generateDeck(n: number): Question[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `sq${i + 1}`,
    text: `سؤال ${i + 1}؟`,
    options: ['أ', 'ب', 'ج', 'د'],
    correctIndex: (i % 4) as 0 | 1 | 2 | 3,
    media: { kind: 'none' as const },
  }));
}

function computeDeckHash(deck: readonly Question[]): string {
  return deck.map((q) => q.id).join('|');
}

/** Plays a short, deterministic game (always answers option 0) far enough
 *  to have a non-trivial log: at least one correct AND one wrong answer,
 *  a turn pass, and a shuffled option order in flight. */
function playPartialGame(deck: readonly Question[], N: number, firstTeam: TeamId): GameEvent[] {
  const events: GameEvent[] = [
    {
      type: 'GAME_STARTED',
      seq: 0,
      at: 0,
      seed: 7,
      N,
      teamNames: ['فريق أ', 'فريق ب'],
      firstTeam,
      deckHash: computeDeckHash(deck),
    },
  ];
  let state = fold(events);
  for (let step = 0; step < 5; step++) {
    const ctx: GameContext = { deck, events, now: () => 0 };
    const candidates = legalEvents(state, ctx);
    if (candidates.length === 0 || state.stateId === 'FINISHED') break;
    const chosen =
      state.stateId === 'QUESTION_SHOWN'
        ? (candidates.find((c) => c.type === 'ANSWER_CHOSEN' && c.optionId === 0) ?? candidates[0]!)
        : candidates[0]!;
    state = applyEvent(state, chosen);
    events.push(chosen);
  }
  return events;
}

describe('PH-A4 — session-store', () => {
  it('criterion 1: the write is synchronous — the raw storage already has it immediately after saveSession() returns, no await', () => {
    const storage = createFakeStorage();
    const deck = generateDeck(10);
    const events = playPartialGame(deck, 5, 'A');
    saveSession(events, storage);
    // Read the UNDERLYING fake storage directly (not loadRawSession) —
    // proves the write reached the storage medium itself, synchronously.
    const raw = storage.raw.get('nouf-game:session:v1');
    expect(raw).toBeDefined();
    expect(JSON.parse(raw!)).toEqual({ events });
  });

  it('criterion 3: deckHash mismatch refuses resume, does not partial-load', () => {
    const storage = createFakeStorage();
    const deckA = generateDeck(10);
    const events = playPartialGame(deckA, 5, 'A');
    saveSession(events, storage);

    const deckB = generateDeck(12); // different id set -> different hash
    const result = checkResume(computeDeckHash(deckB), storage);
    expect(result.kind).toBe('refused');
    if (result.kind === 'refused' && result.reason === 'deck-mismatch') {
      expect(result.storedDeckHash).toBe(computeDeckHash(deckA));
      expect(result.currentDeckHash).toBe(computeDeckHash(deckB));
    } else {
      throw new Error('expected a deck-mismatch refusal');
    }
  });

  it('criterion 4: checkResume never mutates storage and never auto-decides — matching deck returns the full resumable state', () => {
    const storage = createFakeStorage();
    const deck = generateDeck(10);
    const events = playPartialGame(deck, 5, 'A');
    saveSession(events, storage);
    const before = storage.raw.get('nouf-game:session:v1');

    const result = checkResume(computeDeckHash(deck), storage);
    expect(result.kind).toBe('available');
    if (result.kind === 'available') {
      expect(result.events).toEqual(events);
      expect(result.state).toEqual(fold(events));
    }
    // Nothing was written or removed by merely checking.
    expect(storage.raw.get('nouf-game:session:v1')).toBe(before);
    expect(storage.raw.size).toBe(1);
  });

  it('criterion 5 (data side): resume restores positions, attempts, turn, usedQuestionIds, rng.drawIndex and optionOrder exactly', () => {
    const storage = createFakeStorage();
    const deck = generateDeck(10);
    const events = playPartialGame(deck, 5, 'B');
    const preInterruptionState = fold(events);
    saveSession(events, storage);

    // Simulate "the page is gone" — a fresh call with only the storage
    // object surviving, no shared in-memory reference to `preInterruptionState`.
    const result = checkResume(computeDeckHash(deck), storage);
    expect(result.kind).toBe('available');
    if (result.kind !== 'available') throw new Error('expected available');

    expect(result.state.positions).toEqual(preInterruptionState.positions);
    expect(result.state.attempts).toEqual(preInterruptionState.attempts);
    expect(result.state.currentTeam).toBe(preInterruptionState.currentTeam);
    expect(result.state.usedQuestionIds).toEqual(preInterruptionState.usedQuestionIds);
    expect(result.state.rng.drawIndex).toBe(preInterruptionState.rng.drawIndex);
    expect(result.state.optionOrder).toEqual(preInterruptionState.optionOrder);
    expect(result.state).toEqual(preInterruptionState);
  });

  it('a finished game is reported as nothing to resume ("kind: none")', () => {
    const storage = createFakeStorage();
    const deck = generateDeck(3);
    const events: GameEvent[] = [
      { type: 'GAME_STARTED', seq: 0, at: 0, seed: 1, N: 1, teamNames: ['أ', 'ب'], firstTeam: 'A', deckHash: computeDeckHash(deck) },
    ];
    let state = fold(events);
    while (state.stateId !== 'FINISHED') {
      const ctx: GameContext = { deck, events, now: () => 0 };
      const candidates = legalEvents(state, ctx);
      const chosen =
        state.stateId === 'QUESTION_SHOWN'
          ? (candidates.find((c) => c.type === 'ANSWER_CHOSEN' && c.correct) ?? candidates[0]!)
          : candidates[0]!;
      state = applyEvent(state, chosen);
      events.push(chosen);
    }
    saveSession(events, storage);
    const result = checkResume(computeDeckHash(deck), storage);
    expect(result.kind).toBe('none');
  });

  it('no storage present at all returns "none" without throwing', () => {
    expect(checkResume('anything', null)).toEqual({ kind: 'none' });
  });

  it('a corrupted payload is refused, not thrown', () => {
    const storage = createFakeStorage();
    storage.setItem('nouf-game:session:v1', '{not valid json');
    expect(loadRawSession(storage)).toBeNull();
    expect(checkResume('anything', storage)).toEqual({ kind: 'none' });
  });

  it('clearSession removes the stored session', () => {
    const storage = createFakeStorage();
    const deck = generateDeck(5);
    saveSession(playPartialGame(deck, 3, 'A'), storage);
    expect(loadRawSession(storage)).not.toBeNull();
    clearSession(storage);
    expect(loadRawSession(storage)).toBeNull();
  });
});
