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
 * A single station on the maze track. `event` is reserved, unused in v1 —
 * D-09.3 / §2.4: present from day one so a future shortcut/hazard mechanic
 * is a data addition, never a schema migration.
 */
export interface MazeCell {
  index: number;
  event: null;
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
  /** Steps taken per team; equals the team's correct-answer count. */
  positions: [number, number];
  /** Total questions answered (correct + wrong) per team. */
  attempts: [number, number];
  maze: MazeCell[];
  deckHash: string;
  usedQuestionIds: string[];
  currentQuestionId: string | null;
  optionOrder: [OptionIndex, OptionIndex, OptionIndex, OptionIndex] | null;
  rng: RngState;
  outcome: Outcome | null;
}
