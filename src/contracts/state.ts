/**
 * Game state contract — frozen PH-00 (types only, no logic).
 * `GameState` is always derived: `fold(applyEvent, initial, events)`.
 * Nothing here is ever constructed by hand outside the reducer WL-A owns.
 */

import type { OptionIndex } from './question';

export type TeamId = 'A' | 'B';

/** The ten states of a game session, in the order they can be reached. */
export type StateId =
  | 'SETUP'
  | 'TEAM_SETUP'
  | 'TURN_START'
  | 'QUESTION_SHOWN'
  | 'ANSWER_REVEALED'
  | 'PROGRESSION_APPLIED'
  | 'FINAL_BALANCING_TURN'
  | 'TIEBREAK'
  | 'DECK_EXHAUSTED'
  | 'FINISHED';

export type Outcome = 'winA' | 'winB' | 'draw';

/**
 * One junction on one team's route. `deadEndExit` is generated up front for
 * EVERY junction (game-systems-expert 2026-08-08 §4.2/§10.1) — whether it is
 * actually live depends only on the team's runtime `wasted` counter (the
 * one-stumble rule: `wasted === 0` at the moment that exit is chosen). Exits
 * are numbered `0..exits-1` and labelled أ/ب/ج on screen in that order.
 * `deadEndExit === -1` means no dead end (reserved; the v1 generator always
 * sets a real dead-end index, matching "every junction carries exactly one").
 *
 * MUST NEVER reach the DOM before that exit has been chosen — rule M-SECRET-1.
 */
export interface MazeJunction {
  /** 0 .. N-1. */
  index: number;
  /** Corridors leaving this junction. v1: always 3 (EXITS_PER_JUNCTION). */
  exits: number;
  /** Which exit is the dead end, or -1 for none. */
  deadEndExit: number;
}

export interface TeamRoute {
  team: TeamId;
  /** Length N. */
  junctions: MazeJunction[];
}

/**
 * The maze redesign's route model (supersedes the congruent-corridor `MazeCell[]`
 * — D-24, the user's «مو تحط لي خط» ruling). Two disjoint per-team routes
 * converging on one shared, always-lit goal gate (D-27, Reading D of
 * game-systems-expert §2.1). Generated once, per game, from a seed —
 * `buildMaze` (src/core/rules/maze.ts) — never constructed by hand.
 */
export interface MazeLayout {
  N: number;
  /** Index 0 = team A, 1 = team B. Combinatorially congruent, drawn differently. */
  routes: [TeamRoute, TeamRoute];
  /** Seed for the DECORATIVE walls only. Carries no true topology (M-FOG-1). */
  decorSeed: number;
  /** Pins the generator. A session whose version differs is refused on resume (M-RESUME-1). */
  genVersion: number;
}

/** A seeded RNG's state; the draw index is part of the folded state. */
export interface RngState {
  seed: number;
  drawIndex: number;
}

export interface GameState {
  stateId: StateId;
  N: number;
  teamNames: [string, string];
  firstTeam: TeamId;
  currentTeam: TeamId;
  /** Junction index reached per team, `0..N`. `min(N, correct[t] − wasted[t])`
   *  while below N — NOT simply "equals correct answers" anymore, because a
   *  dead-end move costs one move without advancing (game-systems-expert
   *  §10.1). Name and `0..N` meaning are otherwise unchanged, so
   *  `progression.ts`'s `>= N` logic is untouched. */
  positions: [number, number];
  /** Total questions answered (correct + wrong) per team. */
  attempts: [number, number];
  maze: MazeLayout;
  /** Exits eliminated at each team's CURRENT junction; reset to `[]` on advance. */
  closedExits: [number[], number[]];
  /** Dead-end hits this game, per team; `∈ {0,1}` — the one-stumble cap. */
  wasted: [number, number];
  deckHash: string;
  usedQuestionIds: string[];
  currentQuestionId: string | null;
  optionOrder: [OptionIndex, OptionIndex, OptionIndex, OptionIndex] | null;
  rng: RngState;
  outcome: Outcome | null;
}
