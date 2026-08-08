/**
 * The win/exhaustion decision — the ONLY code that runs while
 * `state.stateId === 'PROGRESSION_APPLIED'`, called exactly once from
 * `legal.ts`'s `PROGRESSION_APPLIED` case. Implements D-09.7 (R-b:
 * equal-attempts completion), D-09.8 (no victory staging until the
 * balancing attempt is actually taken), D-09.9 (paired tiebreak, reversed
 * order), D-09.14/15 (deck-exhaustion endings).
 *
 * No new `GameState` fields are used or needed: every branch below is
 * derived from the frozen `positions`/`attempts`/`firstTeam`/`N` fields
 * plus the event log (`ctx.events`), which is why the log — not a bigger
 * state shape — is "the only authority" here.
 */

import type { GameEvent, GameState, Outcome, TeamId } from '../../contracts';
import type { GameContext } from '../context';
import { fold } from '../fold';

function otherTeam(team: TeamId): TeamId {
  return team === 'A' ? 'B' : 'A';
}

function idxOf(team: TeamId): 0 | 1 {
  return team === 'A' ? 0 : 1;
}

/**
 * The most recent `count` answer correctness values, most-recent-first.
 * `NO_ANSWER` counts as incorrect. Used to evaluate a tiebreak pair without
 * any dedicated state field — the log already has the answer.
 */
function lastAnswerCorrectness(events: readonly GameEvent[], count: number): boolean[] {
  const found: boolean[] = [];
  for (let i = events.length - 1; i >= 0 && found.length < count; i--) {
    const e = events[i];
    if (!e) break;
    if (e.type === 'ANSWER_CHOSEN') found.push(e.correct);
    else if (e.type === 'NO_ANSWER') found.push(false);
  }
  return found;
}

export function resolveProgression(
  state: GameState,
  ctx: GameContext,
  seq: number,
  now: () => number,
): GameEvent[] {
  const lastEvent = ctx.events[ctx.events.length - 1];
  if (!lastEvent || lastEvent.type !== 'MOVE_APPLIED') {
    throw new Error('resolveProgression: expected the last committed event to be MOVE_APPLIED');
  }

  // The exact pre-move state, obtained by re-folding — NOT by subtracting
  // `lastEvent.delta` from the current position, which is lossy once a
  // position has ever been clamped at N (as it is throughout a tiebreak,
  // where every further correct answer clamps back down to N).
  const priorState = fold(ctx.events.slice(0, -1));
  const preBothAtN = priorState.positions[0] >= state.N && priorState.positions[1] >= state.N;
  const preOneAtN = (priorState.positions[0] >= state.N) !== (priorState.positions[1] >= state.N);

  const movedIdx = idxOf(lastEvent.team);
  const otherIdx: 0 | 1 = movedIdx === 0 ? 1 : 0;

  // --- Case 3: mid-tiebreak — both teams were already at N before this move ---
  if (preBothAtN) {
    const tiebreakFirstTeam = otherTeam(state.firstTeam); // D-09.9: reversed order
    if (lastEvent.team === tiebreakFirstTeam) {
      // First-of-pair just answered; show the pair-mate's question next.
      return [{ type: 'TURN_PASSED', seq, at: now(), toTeam: otherTeam(tiebreakFirstTeam) }];
    }
    // Second-of-pair just answered; evaluate the pair from the log.
    const [thisCorrect, mateCorrect] = lastAnswerCorrectness(ctx.events, 2);
    if (thisCorrect !== undefined && mateCorrect !== undefined && thisCorrect !== mateCorrect) {
      const winnerTeam = thisCorrect ? lastEvent.team : otherTeam(lastEvent.team);
      const outcome: Outcome = winnerTeam === 'A' ? 'winA' : 'winB';
      return [{ type: 'GAME_ENDED', seq, at: now(), outcome }];
    }
    // Both correct or both wrong: another pair, tiebreakFirstTeam goes again.
    return [{ type: 'TURN_PASSED', seq, at: now(), toTeam: tiebreakFirstTeam }];
  }

  // --- Case 2: resolving the FINAL_BALANCING_TURN's one owed question ---
  if (preOneAtN) {
    const nowBothAtN = state.positions[0] >= state.N && state.positions[1] >= state.N;
    if (nowBothAtN) {
      // The owed team also reached N: both level now — enter the tiebreak.
      const tiebreakFirstTeam = otherTeam(state.firstTeam);
      return [{ type: 'TURN_PASSED', seq, at: now(), toTeam: tiebreakFirstTeam }];
    }
    // D-09.8: no victory staging fired when the leader first reached N —
    // only now, after the owed team's one extra attempt has failed, does
    // the game actually end.
    const leaderIdx = otherIdx; // lastEvent.team is the *owed* team here
    const outcome: Outcome = leaderIdx === 0 ? 'winA' : 'winB';
    return [{ type: 'GAME_ENDED', seq, at: now(), outcome }];
  }

  // --- Case 1: normal play — neither team was at N before this move ---
  if (state.positions[movedIdx] >= state.N) {
    // This team just reached N for the first time.
    if (state.attempts[movedIdx] > state.attempts[otherIdx]) {
      // Ahead by one attempt (was the round's first mover): the other team
      // is owed its balancing attempt before anyone wins (D-09.7).
      return [{ type: 'TURN_PASSED', seq, at: now(), toTeam: otherTeam(lastEvent.team) }];
    }
    // Attempts already equal (was the round's second mover, matching the
    // other's already-taken turn): nothing to balance, the game ends now.
    const outcome: Outcome = lastEvent.team === 'A' ? 'winA' : 'winB';
    return [{ type: 'GAME_ENDED', seq, at: now(), outcome }];
  }

  // Nobody at N yet: continue normally, or resolve deck exhaustion.
  if (state.usedQuestionIds.length >= ctx.deck.length) {
    const [posA, posB] = state.positions;
    if (posA !== posB) {
      // D-09.14: the leader wins by progress, full victory staging.
      const outcome: Outcome = posA > posB ? 'winA' : 'winB';
      return [{ type: 'GAME_ENDED', seq, at: now(), outcome }];
    }
    // game-systems-expert §6.3 amendment to D-09.14/15 (Theorem 2, Path 3):
    // under the branching maze, equal positions no longer implies equal
    // correct-answer counts — one team may have spent its one stumble. Both
    // teams are still < N here (checked above/by the earlier branches), so
    // `correct[t] === positions[t] + wasted[t]` exactly, with no clamping
    // distortion. The team with more correct answers wins outright; only
    // when correct ALSO ties does D-09.15's "سؤال من الحضور" still apply.
    const correctA = posA + state.wasted[0];
    const correctB = posB + state.wasted[1];
    if (correctA !== correctB) {
      const outcome: Outcome = correctA > correctB ? 'winA' : 'winB';
      return [{ type: 'GAME_ENDED', seq, at: now(), outcome }];
    }
    // D-09.15: level and exhausted — "سؤال من الحضور". Three legal
    // candidates; the room (not the RNG) picks which one gets applied.
    return [
      { type: 'GAME_ENDED', seq, at: now(), outcome: 'winA' },
      { type: 'GAME_ENDED', seq, at: now(), outcome: 'winB' },
      { type: 'GAME_ENDED', seq, at: now(), outcome: 'draw' },
    ];
  }
  const toTeam = otherTeam(state.currentTeam);
  return [{ type: 'TURN_PASSED', seq, at: now(), toTeam }];
}
