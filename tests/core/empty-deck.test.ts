/**
 * F-2 regression — the empty-deck freeze at the very first TURN_START.
 * `GAME_STARTED` transitions unconditionally to TURN_START with no check on
 * `deck.length`. If the deck is empty, the pre-fix `legalEvents` special-cased
 * TURN_START (assuming it is only ever reached via TURN_PASSED, downstream of
 * `progression.ts`'s own exhaustion check) and returned `[]` forever — a
 * permanent freeze, never reachable via `TURN_PASSED` but very much reachable
 * directly from `GAME_STARTED`. See worklog-A5.md §1 for the full analysis.
 */

import { describe, expect, it } from 'vitest';
import type { GameEvent, Question, TeamId } from '../../src/contracts';
import { applyEvent } from '../../src/core/reducer';
import { fold } from '../../src/core/fold';
import { legalEvents, type GameContext } from '../../src/core/legal';
import { MAZE_GEN_VERSION } from '../../src/core/rules/maze';

const EMPTY_DECK: Question[] = [];
const FIXED_NOW = (): number => 0;

function startEvent(seed: number, firstTeam: TeamId, N: number): GameEvent {
  return {
    type: 'GAME_STARTED',
    seq: 0,
    at: FIXED_NOW(),
    seed,
    N,
    teamNames: ['فريق أ', 'فريق ب'],
    firstTeam,
    deckHash: '',
    mazeGenVersion: MAZE_GEN_VERSION,
  };
}

describe('F-2 — empty-deck freeze at the first TURN_START', () => {
  it('a game started with zero questions does not freeze: legalEvents returns a candidate from TURN_START', () => {
    const events: GameEvent[] = [startEvent(1, 'A', 10)];
    const state = fold(events);
    expect(state.stateId).toBe('TURN_START');

    const ctx: GameContext = { deck: EMPTY_DECK, events, now: FIXED_NOW };
    const candidates = legalEvents(state, ctx);

    // THE bug: pre-fix this is [] and the game can never progress again.
    expect(candidates.length).toBeGreaterThan(0);
  });

  it('applying that candidate reaches FINISHED with outcome draw, in exactly one more event', () => {
    const events: GameEvent[] = [startEvent(2, 'B', 10)];
    let state = fold(events);
    const ctx: GameContext = { deck: EMPTY_DECK, events, now: FIXED_NOW };
    const candidates = legalEvents(state, ctx);
    expect(candidates.length).toBeGreaterThan(0);

    const chosen = candidates[0]!;
    expect(chosen.type).toBe('GAME_ENDED');

    // The reducer must actually ACCEPT this event from TURN_START — this is
    // the second half of the bug: even a fixed legalEvents() is useless if
    // GAME_ENDED_LEGAL_FROM still refuses TURN_START as a source state.
    state = applyEvent(state, chosen);
    expect(state.stateId).toBe('FINISHED');
    expect(state.outcome).toBe('draw');
  });

  it('does not regress the normal non-empty-deck path: TURN_START with questions available still offers QUESTION_SHOWN', () => {
    const deck: Question[] = [
      { id: 'q1', text: 'س؟', options: ['أ', 'ب', 'ج', 'د'], correctIndex: 0, media: { kind: 'none' } },
    ];
    const events: GameEvent[] = [startEvent(3, 'A', 10)];
    const state = fold(events);
    const ctx: GameContext = { deck, events, now: FIXED_NOW };
    const candidates = legalEvents(state, ctx);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]!.type).toBe('QUESTION_SHOWN');
  });
});
