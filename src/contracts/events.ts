/**
 * Event log contract — frozen PH-00 (types only, no logic).
 * `GameState` is always `fold(applyEvent, initial, events)`; undo is
 * pop-last-event-and-re-fold. Every member carries `seq` (fold order) and
 * `at` (a silent timestamp — D-09.4: never surfaced as a clock or timer).
 */

import type { OptionIndex } from './question';
import type { Outcome, TeamId } from './state';

interface EventBase {
  seq: number;
  /** Silent timestamp (epoch ms). Recorded for the log only — never shown. */
  at: number;
}

export interface GameStartedEvent extends EventBase {
  type: 'GAME_STARTED';
  seed: number;
  N: number;
  teamNames: [string, string];
  firstTeam: TeamId;
  deckHash: string;
  /** Pins the maze generator version at the moment play started — same
   *  refuse-on-mismatch treatment as `deckHash` (M-RESUME-1). */
  mazeGenVersion: number;
}

export interface QuestionShownEvent extends EventBase {
  type: 'QUESTION_SHOWN';
  questionId: string;
  /** The shuffled on-screen option order, logged so undo restores it unchanged. */
  optionOrder: [OptionIndex, OptionIndex, OptionIndex, OptionIndex];
}

export interface AnswerChosenEvent extends EventBase {
  type: 'ANSWER_CHOSEN';
  optionId: OptionIndex;
  correct: boolean;
}

export interface NoAnswerEvent extends EventBase {
  type: 'NO_ANSWER';
}

export interface MoveAppliedEvent extends EventBase {
  type: 'MOVE_APPLIED';
  team: TeamId;
  /** The exit the operator tapped, or null when the answer was wrong (no
   *  movement) or the team had already reached the goal. The RESULT
   *  (advance vs. dead end) is never stored — it is derived from the maze
   *  layout via `resolveMove`, so a log can never contradict the rules
   *  (game-systems-expert §10.2). */
  exit: number | null;
}

export interface TurnPassedEvent extends EventBase {
  type: 'TURN_PASSED';
  toTeam: TeamId;
}

export interface GameEndedEvent extends EventBase {
  type: 'GAME_ENDED';
  outcome: Outcome;
}

export type GameEvent =
  | GameStartedEvent
  | QuestionShownEvent
  | AnswerChosenEvent
  | NoAnswerEvent
  | MoveAppliedEvent
  | TurnPassedEvent
  | GameEndedEvent;
