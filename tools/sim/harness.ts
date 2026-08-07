/**
 * The simulation harness's game driver. Imports and calls the REAL
 * `applyEvent`, `legalEvents`, `fold` from `src/core` — never a copy, never
 * a reimplementation of any rule (PH-A3 non-negotiable, v3 §7.1). This file
 * contains only orchestration: build a `GAME_STARTED` event, loop
 * `legalEvents -> policy picks one -> applyEvent`, stop at `FINISHED`.
 */

import type { GameEvent, GameState, Question, TeamId } from '../../src/contracts';
import { applyEvent } from '../../src/core/reducer';
import { fold } from '../../src/core/fold';
import { legalEvents, type GameContext } from '../../src/core/legal';
import { computeDeckHash } from './deck';

/** A policy picks one of the legal candidate events. Its own decision logic
 *  (e.g. "always answer correctly") is test-harness bookkeeping, not a game
 *  rule — the rule that a correct answer grants a step, or that the turn
 *  passes, lives only in `src/core`, never here. */
export type Policy = (rand: () => number, candidates: readonly GameEvent[], state: GameState) => GameEvent;

/** Deterministic LCG, seeded independently of the game's own RNG (which is
 *  seeded by `GameEvent.seed` and drives question/shuffle selection only). */
export function makeRand(seed: number): () => number {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function startEvent(
  seed: number,
  firstTeam: TeamId,
  N: number,
  deck: readonly Question[],
): GameEvent {
  return {
    type: 'GAME_STARTED',
    seq: 0,
    at: 0, // fixed, deterministic — real time would break G5 byte-identity across two runs
    seed,
    N,
    teamNames: ['فريق أ', 'فريق ب'],
    firstTeam,
    deckHash: computeDeckHash(deck),
  };
}

export interface PlayResult {
  events: GameEvent[];
  states: GameState[];
  seed: number;
  firstTeam: TeamId;
  N: number;
}

const FIXED_NOW = (): number => 0;

/**
 * Plays one full game to `FINISHED` using only the real core functions.
 * Throws (G1) if `maxSteps` is exceeded instead of hanging.
 */
export function playGame(
  seed: number,
  firstTeam: TeamId,
  N: number,
  deck: readonly Question[],
  policy: Policy,
  randSeed = seed,
  maxSteps = 20 * deck.length + 40,
): PlayResult {
  const rand = makeRand(randSeed);
  const events: GameEvent[] = [startEvent(seed, firstTeam, N, deck)];
  let state = fold(events);
  const states: GameState[] = [state];
  let steps = 0;
  while (state.stateId !== 'FINISHED' && steps < maxSteps) {
    const ctx: GameContext = { deck, events, now: FIXED_NOW };
    const candidates = legalEvents(state, ctx);
    if (candidates.length === 0) {
      throw new Error(`No legal events from state ${state.stateId} (seed ${seed})`);
    }
    const allGameEnded = candidates.every((c) => c.type === 'GAME_ENDED');
    // D-09.15's "سؤال من الحضور": three EQUALLY LEGAL GAME_ENDED candidates
    // (winA / winB / draw) exist for the room to pick from. No room exists
    // in simulation, so the harness convention (not a game rule — all
    // three really are legal) is: declare draw. This matches G3's own
    // expectation for S2 (positions [0,0] → draw).
    const chosen =
      candidates.length === 1
        ? candidates[0]!
        : allGameEnded
          ? (candidates.find((c) => c.type === 'GAME_ENDED' && c.outcome === 'draw') ?? candidates[0]!)
          : policy(rand, candidates, state);
    state = applyEvent(state, chosen);
    events.push(chosen);
    states.push(state);
    steps++;
  }
  if (state.stateId !== 'FINISHED') {
    throw new Error(`G1 VIOLATION: game (seed ${seed}) exceeded maxTransitions=${maxSteps}`);
  }
  return { events, states, seed, firstTeam, N };
}
