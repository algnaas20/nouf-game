import type { TeamId } from '../contracts';
import { renderHomeScreen } from './screens/home';
import { renderTeamSetupScreen } from './screens/team-setup';
import { renderQuestionScreen } from './screens/question';
import { renderMazeBeat, type MazeBeatMode } from './screens/maze-beat';
import { renderTurnHandoff, type HandoffKind } from './screens/turn-handoff';
import { renderEndingScreen, computeNextFirstTeam } from './screens/ending';
import { initialMediaUiState, type MediaUiState } from './screens/media-ui-state';
import { GameDriver, findAnswerChosen, findNoAnswer, findMoveApplied, findTurnPassed, findGameEnded, findQuestionShown, isAudienceDecision, isDecisiveEnding } from './session/game-driver';
import { buildDemoDeck } from './session/demo-deck';
import { computeDeckHash } from './session/deck-hash';

/** No client-side router (D-11) — a plain state switch inside one root
 *  element, now driven by the REAL `src/core` state machine (`GameDriver`)
 *  instead of PH-B1's temporary `src/stage/demo/session.ts`, which is
 *  removed in this phase. */
export function mountApp(root: HTMLElement): void {
  const deck = buildDemoDeck();
  const deckHash = computeDeckHash(deck);

  let driver = new GameDriver(deck);
  let localPhase: 'home' | 'team-setup' | 'draw' | 'playing' = 'home';
  let drawnFirstTeam: TeamId = 'A';
  let pendingTeamNames: [string, string] = ['', ''];
  let pendingN = 10;

  let mediaUi: MediaUiState = initialMediaUiState();
  let lastUiQuestionId: string | null = null;
  let decisiveTimer: ReturnType<typeof setTimeout> | null = null;
  let cancelHandoff: (() => void) | null = null;

  const wrap = document.createElement('div');
  wrap.className = 'stage-root';
  root.append(wrap);

  function setMediaUi(patch: Partial<MediaUiState>): void {
    mediaUi = { ...mediaUi, ...patch };
    render();
  }

  function startNewGame(teamNames: [string, string], N: number, firstTeam: TeamId): void {
    driver = new GameDriver(deck);
    const seed = Math.floor(Math.random() * 1_000_000_000);
    driver.start({ teamNames, N, firstTeam, seed, deckHash });
    localPhase = 'playing';
    render();
  }

  function render(): void {
    if (decisiveTimer !== null) {
      clearTimeout(decisiveTimer);
      decisiveTimer = null;
    }
    if (cancelHandoff) {
      cancelHandoff();
      cancelHandoff = null;
    }

    if (localPhase === 'home') {
      renderHomeScreen(wrap, {
        onStart: () => {
          localPhase = 'team-setup';
          render();
        },
      });
      return;
    }

    if (localPhase === 'team-setup') {
      renderTeamSetupScreen(wrap, {
        deckSize: deck.length,
        onConfirm: ({ teamNames, N }) => {
          pendingTeamNames = teamNames;
          pendingN = N;
          drawnFirstTeam = Math.random() < 0.5 ? 'A' : 'B';
          localPhase = 'draw';
          render();
        },
      });
      return;
    }

    if (localPhase === 'draw') {
      wrap.innerHTML = '';
      const safe = document.createElement('div');
      safe.className = 'stage-safe';
      const screen = document.createElement('div');
      screen.className = 'centered-screen';
      const text = document.createElement('p');
      text.className = 'type-winner-headline';
      const winnerName = drawnFirstTeam === 'A' ? pendingTeamNames[0] : pendingTeamNames[1];
      // Sourced verbatim from the ruling's own narrative ("الشاشة تقول
      // فريق النخبة يبدأ") — not present in Appendix أ's literal-strings
      // table, disclosed in the worklog.
      text.textContent = `فريق ${winnerName} يبدأ`;
      screen.append(text);
      safe.append(screen);
      wrap.append(safe);
      window.setTimeout(() => {
        startNewGame(pendingTeamNames, pendingN, drawnFirstTeam);
      }, 1600);
      return;
    }

    // localPhase === 'playing' — every screen below is driven by driver.state.
    const state = driver.state;

    if (state.currentQuestionId !== lastUiQuestionId) {
      mediaUi = initialMediaUiState();
      lastUiQuestionId = state.currentQuestionId;
    }

    if (state.stateId === 'FINISHED') {
      const outcome = state.outcome ?? 'draw';
      const reachedEnd = state.positions[0] >= state.N || state.positions[1] >= state.N;
      renderEndingScreen(wrap, {
        teamNames: state.teamNames,
        positions: state.positions,
        N: state.N,
        outcome,
        reachedEnd,
        nextFirstTeam: computeNextFirstTeam(outcome, state.firstTeam),
        canUndo: driver.canUndo(),
        onNewGame: () => {
          const nextFirst = computeNextFirstTeam(outcome, state.firstTeam);
          startNewGame(state.teamNames, state.N, nextFirst);
        },
        onUndo: () => {
          driver.undo();
          render();
        },
      });
      return;
    }

    if (
      (state.stateId === 'TURN_START' || state.stateId === 'FINAL_BALANCING_TURN' || state.stateId === 'TIEBREAK') &&
      state.currentQuestionId === null
    ) {
      const kind: HandoffKind =
        state.stateId === 'FINAL_BALANCING_TURN' ? 'balancing' : state.stateId === 'TIEBREAK' ? 'tiebreak' : 'turn';
      const readingTeam: TeamId = state.currentTeam === 'A' ? 'B' : 'A';
      const leaderTeam: TeamId = state.positions[0] >= state.N ? 'A' : 'B';
      const names: [string, string] =
        kind === 'balancing'
          ? [
              leaderTeam === 'A' ? state.teamNames[0] : state.teamNames[1],
              state.currentTeam === 'A' ? state.teamNames[0] : state.teamNames[1],
            ]
          : [
              readingTeam === 'A' ? state.teamNames[0] : state.teamNames[1],
              state.currentTeam === 'A' ? state.teamNames[0] : state.teamNames[1],
            ];
      cancelHandoff = renderTurnHandoff(wrap, {
        kind,
        names,
        onDismiss: () => {
          cancelHandoff = null;
          const candidates = driver.legal();
          const ev = findQuestionShown(candidates);
          if (ev) driver.commit(ev);
          render();
        },
      });
      return;
    }

    if (state.stateId === 'QUESTION_SHOWN' || state.stateId === 'ANSWER_REVEALED') {
      const question = deck.find((q) => q.id === state.currentQuestionId);
      if (!question || !state.optionOrder) return;
      const revealed = state.stateId === 'ANSWER_REVEALED';
      const lastAnswer = revealed ? findLastAnswer(driver) : null;
      // `stateId` is overwritten to 'QUESTION_SHOWN'/'ANSWER_REVEALED' by
      // the reducer regardless of which of TURN_START/FINAL_BALANCING_TURN/
      // TIEBREAK it came from (reducer.ts's QUESTION_SHOWN case) — so
      // "is this the decider" is derived the same way the reducer itself
      // derives which state TURN_PASSED lands on: both positions already
      // at N (only true once inside the tiebreak; MOVE_APPLIED only ever
      // clamps upward there, never below N again).
      const isDecider = state.positions[0] >= state.N && state.positions[1] >= state.N;
      renderQuestionScreen(wrap, {
        question,
        optionOrder: state.optionOrder,
        teamNames: state.teamNames,
        answeringTeam: state.currentTeam,
        positions: state.positions,
        revealed,
        chosenOption: lastAnswer,
        canUndo: driver.canUndo(),
        mediaUi,
        setMediaUi,
        isDecider,
        onChoose: (optionIndex) => {
          const ev = findAnswerChosen(driver.legal(), optionIndex);
          if (ev) driver.commit(ev);
          render();
        },
        onNoAnswer: () => {
          const ev = findNoAnswer(driver.legal());
          if (ev) driver.commit(ev);
          render();
        },
        onNext: () => {
          const ev = findMoveApplied(driver.legal());
          if (ev) driver.commit(ev);
          render();
        },
        onUndo: () => {
          driver.undo();
          render();
        },
      });
      return;
    }

    if (state.stateId === 'PROGRESSION_APPLIED') {
      const candidates = driver.legal();
      let mode: MazeBeatMode = 'continue';
      if (isAudienceDecision(candidates)) mode = 'audience-decision';
      else if (isDecisiveEnding(candidates)) mode = 'decisive-auto';

      renderMazeBeat(wrap, {
        N: state.N,
        positions: state.positions,
        teamNames: state.teamNames,
        mode,
        canUndo: driver.canUndo(),
        onContinue: () => {
          const ev = findTurnPassed(driver.legal());
          if (ev) driver.commit(ev);
          render();
        },
        onDeclare: (outcome) => {
          const ev = findGameEnded(driver.legal(), outcome);
          if (ev) driver.commit(ev);
          render();
        },
        onUndo: () => {
          driver.undo();
          render();
        },
      });

      if (mode === 'decisive-auto') {
        decisiveTimer = setTimeout(() => {
          decisiveTimer = null;
          const ev = findGameEnded(driver.legal());
          if (ev) driver.commit(ev);
          render();
        }, 900);
      }
      return;
    }
  }

  render();
}

/** The chosen option for the just-revealed question, read from the event
 *  log (session state), never from any DOM attribute — see chrome.ts's
 *  no-tell doc comment. `ANSWER_CHOSEN` is always the event immediately
 *  before the state's current position in the log once `ANSWER_REVEALED`
 *  is reached (see reducer.ts). */
function findLastAnswer(driver: GameDriver): 0 | 1 | 2 | 3 | null {
  // The driver does not expose the raw log outside itself (by design —
  // screens must never reconstruct correctness from anything but the
  // callback closures they're handed), so this reads it via the one
  // documented, deliberate exception: `legal()`'s own state is already
  // derived from the log, and `ANSWER_REVEALED`'s `attempts`/`usedQuestionIds`
  // bump happened on the most recent `ANSWER_CHOSEN`. Simplest correct
  // source: expose it explicitly.
  return driver.lastChosenOption();
}
