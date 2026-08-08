/**
 * PH-B2/B3 — thin orchestration over the REAL `src/core` state machine
 * (`fold`, `commit`, `undo`, `legalEvents`) — never a reimplementation of
 * any rule, matching the discipline `tools/sim/harness.ts` already proves
 * against 27,000+ simulated games (v3 §7.1). Replaces the PH-B1 walking
 * skeleton's `src/stage/demo/session.ts`, which is deleted in this phase.
 *
 * The driver never decides which candidate event is "the next question" or
 * "the winner" — it only (a) holds the append-only event log, (b) exposes
 * `legal()` so a screen can find the specific candidate it needs, and
 * (c) commits whichever candidate the UI captured at render time, via the
 * SAME `commit()` seq-keyed double-tap guard the core ships (fold.ts) —
 * never re-deriving a fresh candidate at click time, which would defeat
 * that guard.
 */

import type { GameEvent, GameState, Outcome, Question, TeamId } from '../../contracts';
import { fold, undo as coreUndo, commit as coreCommit } from '../../core/fold';
import { legalEvents, type GameContext } from '../../core/legal';
import { saveSession } from '../../core/session-store';

export interface StartParams {
  teamNames: [string, string];
  N: number;
  firstTeam: TeamId;
  seed: number;
  deckHash: string;
}

export class GameDriver {
  readonly deck: readonly Question[];
  private events: GameEvent[] = [];
  private cachedState: GameState;

  /**
   * `initialEvents` is how a resumed session re-enters play (PH-A4/§6.3):
   * `checkResume()`'s `ResumeCheck.events` — the SAME raw event log
   * `fold()` already regenerated `state` from — is handed straight back in
   * here, so a resumed driver is not a special code path with its own
   * rules; it is the exact same `GameDriver` a fresh game uses, just
   * pre-loaded. Defaults to `[]` (a brand-new game), so every existing
   * `new GameDriver(deck)` call site is unaffected.
   */
  constructor(deck: readonly Question[], initialEvents: readonly GameEvent[] = []) {
    this.deck = deck;
    this.events = [...initialEvents];
    this.cachedState = fold(this.events);
  }

  /**
   * The single place `saveSession`/`clearSession` (WL-A's
   * `src/core/session-store.ts`) are called from — every log-mutating
   * operation below (`start`, a successfully applied `commit`, `undo`)
   * routes through here, so "the game in progress is being persisted as it
   * is played" is true by construction, not by remembering to call it at
   * each call site.
   *
   * **F-4 fix (adversarial review, 2026-08-08 — worklog-B5.md):** this used
   * to clear the stored session the instant `FINISHED` was reached. In
   * practice that meant: reach `FINISHED` -> session cleared -> tap «تراجُع»
   * -> a shorter log re-saved -> the (buggy) decisive-auto timer re-commits
   * `GAME_ENDED` -> session cleared again. Net result: at the one moment a
   * host most needs a safety net (he just declared the wrong winner in
   * front of guests), there was no persisted record at all — a stray reload
   * lost everything, and in-memory undo was the *only* recovery path. This
   * now always saves the current log, `FINISHED` included, removing that
   * churn. **Disclosed limitation, not silently claimed complete:**
   * `checkResume()` (`src/core/session-store.ts:136`, WL-A-owned — not this
   * file) still classifies a stored `FINISHED` log as `{ kind: 'none' }`,
   * so a real page reload while sitting on the ending screen still will
   * NOT resume back into it — that half of the fix needs a WL-A change and
   * is out of this file's ownership. What this change does deliver: the log
   * is no longer actively deleted-then-recreated-then-deleted-again across
   * the undo/re-commit dance, and a fresh game's first `GAME_STARTED`
   * (`start()`, above) naturally overwrites whatever the previous game left
   * behind the moment a new one actually begins — so the old session is
   * kept for exactly as long as the host is still on (or might return to,
   * via undo) the ending screen, and no longer.
   */
  private persist(): void {
    saveSession(this.events);
  }

  get state(): GameState {
    return this.cachedState;
  }

  private ctx(): GameContext {
    return { deck: this.deck, events: this.events };
  }

  /** The full set of legal next events from the current state — the only
   *  place a screen may discover what it is allowed to dispatch. */
  legal(): GameEvent[] {
    return legalEvents(this.cachedState, this.ctx());
  }

  /**
   * `GAME_STARTED` carries operator-authored data (team names, N, the seed,
   * the deck hash) that `legalEvents` cannot invent (see legal.ts's own
   * comment on its `SETUP` case) — it is constructed here, once, and
   * applied directly, exactly as the frozen contract intends.
   */
  start(params: StartParams): void {
    const event: GameEvent = {
      type: 'GAME_STARTED',
      seq: this.events.length,
      at: Date.now(),
      seed: params.seed,
      N: params.N,
      teamNames: params.teamNames,
      firstTeam: params.firstTeam,
      deckHash: params.deckHash,
    };
    this.commit(event);
  }

  /**
   * Commits a caller-supplied event via the core's seq-keyed `commit()` —
   * a stale re-dispatch (the event's `seq` no longer matching the current
   * log length, e.g. a double-tap whose second click handler fires after
   * the first already advanced the log) is silently ignored, never
   * re-applied. Returns whether it was actually applied.
   */
  commit(event: GameEvent): boolean {
    const result = coreCommit(this.events, event);
    this.events = result.events;
    this.cachedState = result.state;
    // Only a genuinely applied event changes the log — a stale/double-tap
    // commit that `coreCommit` silently ignored must not re-persist an
    // unchanged log (harmless, since it would write the same bytes, but
    // pointless work on every ignored double-tap).
    if (result.applied) this.persist();
    return result.applied;
  }

  canUndo(): boolean {
    return this.events.length > 0;
  }

  /**
   * The option the operator tapped for the just-revealed question, read
   * from the event log — never stored as its own `GameState` field (the
   * frozen contract doesn't carry one) and never read back from any DOM
   * attribute (chrome.ts's no-tell doc comment). Only meaningful while
   * `state.stateId === 'ANSWER_REVEALED'`, where the reducer guarantees
   * the log's last event is either `ANSWER_CHOSEN` or `NO_ANSWER`.
   */
  lastChosenOption(): 0 | 1 | 2 | 3 | null {
    const last = this.events[this.events.length - 1];
    return last && last.type === 'ANSWER_CHOSEN' ? last.optionId : null;
  }

  undo(): void {
    const result = coreUndo(this.events);
    this.events = result.events;
    this.cachedState = result.state;
    // Undoing out of FINISHED (e.g. the operator undoes the final answer)
    // re-persists the now-shorter, still-in-progress log — `persist()`
    // re-reads `this.cachedState` fresh, so this is never stale.
    this.persist();
  }
}

/** Finds the `QUESTION_SHOWN` candidate — the only one legal at
 *  TURN_START/FINAL_BALANCING_TURN/TIEBREAK. */
export function findQuestionShown(candidates: readonly GameEvent[]): GameEvent | undefined {
  return candidates.find((e) => e.type === 'QUESTION_SHOWN');
}

export function findAnswerChosen(
  candidates: readonly GameEvent[],
  optionId: 0 | 1 | 2 | 3,
): GameEvent | undefined {
  return candidates.find((e) => e.type === 'ANSWER_CHOSEN' && e.optionId === optionId);
}

export function findNoAnswer(candidates: readonly GameEvent[]): GameEvent | undefined {
  return candidates.find((e) => e.type === 'NO_ANSWER');
}

export function findMoveApplied(candidates: readonly GameEvent[]): GameEvent | undefined {
  return candidates.find((e) => e.type === 'MOVE_APPLIED');
}

export function findTurnPassed(candidates: readonly GameEvent[]): GameEvent | undefined {
  return candidates.find((e) => e.type === 'TURN_PASSED');
}

export function findGameEnded(
  candidates: readonly GameEvent[],
  outcome?: Outcome,
): GameEvent | undefined {
  return candidates.find((e) => e.type === 'GAME_ENDED' && (outcome === undefined || e.outcome === outcome));
}

/** D-09.15: exactly the three-candidate shape means the room decides
 *  ("سؤال من الحضور") — never inferred any other way. */
export function isAudienceDecision(candidates: readonly GameEvent[]): boolean {
  return candidates.length === 3 && candidates.every((e) => e.type === 'GAME_ENDED');
}

/** A single GAME_ENDED candidate with no room choice — the game simply
 *  ended (either the balancing attempt failed, a tiebreak pair resolved, or
 *  the deck exhausted with unequal progress). */
export function isDecisiveEnding(candidates: readonly GameEvent[]): boolean {
  return candidates.length === 1 && candidates[0]!.type === 'GAME_ENDED';
}
