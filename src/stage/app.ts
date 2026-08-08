import type { GameEvent, TeamId } from '../contracts';
import { renderHomeScreen } from './screens/home';
import { renderTeamSetupScreen } from './screens/team-setup';
import { renderQuestionScreen } from './screens/question';
import { renderMazeBeat, type MazeBeatMode } from './screens/maze-beat';
import { renderTurnHandoff, type HandoffKind } from './screens/turn-handoff';
import { renderEndingScreen, computeNextFirstTeam } from './screens/ending';
import { renderResumePromptScreen, renderDeckMismatchScreen } from './screens/resume-prompt';
import { initialMediaUiState, type MediaUiState } from './screens/media-ui-state';
import { GameDriver, findAnswerChosen, findNoAnswer, findMoveApplied, findTurnPassed, findGameEnded, findQuestionShown, isAudienceDecision, isDecisiveEnding } from './session/game-driver';
import { buildDemoDeck } from './session/demo-deck';
import { computeDeckHash } from './session/deck-hash';
// WL-C's own doc comment on `mountEditor` names this exact import as the
// intended integration point (خطة.md §5.4 — "same app, its own screen,
// reached only from the home screen. Not a mode toggle."). Import only —
// `src/editor/**` stays WL-C-owned; nothing here reaches into its internals.
import { mountEditor } from '../editor/app';
// PH-A4 (WL-A) — `checkResume()`'s `ResumeCheck` is the complete data
// contract for the prompt below; this file only ever READS it and never
// mutates storage directly except via the one explicit `clearSession()`
// call on the two refusal/decline paths (§6.3 — never a silent auto-delete
// of a resumable session; `clearSession()` here is only ever called either
// on a session that was already unrecoverable ('corrupt'), or after the
// operator explicitly chose «جلسة جديدة»).
import { checkResume, clearSession } from '../core/session-store';
import { fold } from '../core/fold';

/** No client-side router (D-11) — a plain state switch inside one root
 *  element, now driven by the REAL `src/core` state machine (`GameDriver`)
 *  instead of PH-B1's temporary `src/stage/demo/session.ts`, which is
 *  removed in this phase. */
export function mountApp(root: HTMLElement): void {
  const deck = buildDemoDeck();
  const deckHash = computeDeckHash(deck);

  let driver = new GameDriver(deck);
  let localPhase: 'home' | 'editor' | 'team-setup' | 'draw' | 'playing' | 'resume-prompt' | 'deck-mismatch' = 'home';
  let drawnFirstTeam: TeamId = 'A';
  let pendingTeamNames: [string, string] = ['', ''];
  let pendingN = 10;

  // PH-A4 — classified ONCE, at cold start, before the first `render()`.
  // A resumable session only ever exists right after a real reload/
  // interruption; nothing later in this same tab's lifetime can produce a
  // new one to check for (every subsequent log mutation goes through
  // `GameDriver`'s own `persist()`, which this same tab's `driver` is
  // already the source of truth for).
  let resumableEvents: GameEvent[] | null = null;
  {
    const resumeCheck = checkResume(deckHash);
    if (resumeCheck.kind === 'available') {
      resumableEvents = resumeCheck.events;
      localPhase = 'resume-prompt';
    } else if (resumeCheck.kind === 'refused' && resumeCheck.reason === 'deck-mismatch') {
      localPhase = 'deck-mismatch';
    } else if (resumeCheck.kind === 'refused' && resumeCheck.reason === 'corrupt') {
      // Nothing legible to refuse against — a corrupt/unparseable payload
      // has no recoverable content, so there is nothing a host could
      // meaningfully choose to keep. Silently cleared rather than shown as
      // a dead-end screen with no real choice on it (constraint row 17:
      // technical detail never reaches the stage). Disclosed, not hidden —
      // see the worklog.
      clearSession();
    }
    // 'none' → stays 'home', the pre-PH-A4 default behaviour, unchanged.
  }

  let mediaUi: MediaUiState = initialMediaUiState();
  let lastUiQuestionId: string | null = null;
  let decisiveTimer: ReturnType<typeof setTimeout> | null = null;
  let cancelHandoff: (() => void) | null = null;

  const wrap = document.createElement('div');
  wrap.className = 'stage-root';
  root.append(wrap);

  // The editor is a normal scrolling document (`src/editor/editor.css`'s own
  // header explicitly says so — "not the 1920x1080 stage"), so it must NOT
  // be mounted inside `.stage-root` (`position: fixed`, `overflow: hidden`,
  // clipped to the 16:9 canvas) — a question list past a couple of screens
  // would be silently clipped. It is mounted as `wrap`'s SIBLING under the
  // same outer `root`, and `wrap` itself is hidden (not removed — cheaper to
  // restore, and it owns no state that would be lost) while the editor is
  // showing.
  let editorHost: HTMLElement | null = null;
  function teardownEditor(): void {
    if (editorHost) {
      editorHost.remove();
      editorHost = null;
    }
  }

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

    if (localPhase !== 'editor') {
      teardownEditor();
      wrap.hidden = false;
    }

    if (localPhase === 'home') {
      renderHomeScreen(wrap, {
        onStart: () => {
          localPhase = 'team-setup';
          render();
        },
        onOpenEditor: () => {
          localPhase = 'editor';
          render();
        },
      });
      return;
    }

    if (localPhase === 'resume-prompt') {
      // `resumableEvents` is guaranteed non-null here — it is set in the
      // same branch that sets `localPhase = 'resume-prompt'` at startup,
      // and nothing else can reach this branch.
      const events = resumableEvents!;
      // `fold()` — the same function `GameDriver`'s own constructor calls —
      // read directly here only to show the context line; the actual
      // resume (below) still goes through the one real `GameDriver`
      // construction path, never a second reconstruction.
      const resumedState = fold(events);
      renderResumePromptScreen(wrap, {
        teamNames: resumedState.teamNames,
        positions: resumedState.positions,
        N: resumedState.N,
        onContinue: () => {
          // Re-enter play with the EXACT stored log — `GameDriver`'s own
          // constructor `fold()`s it, the same function that already
          // regenerated `resumedState` above; no second reconstruction path.
          driver = new GameDriver(deck, events);
          localPhase = 'playing';
          render();
        },
        onNewGame: () => {
          clearSession(); // explicit operator choice — never silent (§6.3).
          resumableEvents = null;
          localPhase = 'home';
          render();
        },
      });
      return;
    }

    if (localPhase === 'deck-mismatch') {
      renderDeckMismatchScreen(wrap, {
        onNewGame: () => {
          clearSession();
          localPhase = 'home';
          render();
        },
      });
      return;
    }

    if (localPhase === 'editor') {
      wrap.hidden = true;
      if (!editorHost) {
        editorHost = renderEditorShell(root, {
          onBack: () => {
            localPhase = 'home';
            render();
          },
        });
      }
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

/**
 * Wraps WL-C's `mountEditor` with a single «→ الرئيسية» back affordance —
 * built and owned entirely here (WL-B's own markup/CSS), never inside
 * `src/editor/**`, so file ownership stays absolute (`src/editor/**` is
 * WL-C's; this shell is a caller, not an edit). This is the ONE way back
 * out of the editor screen — deliberate, not automatic, matching §5.4's
 * "not a mode toggle": the host must choose to leave, the same way he chose
 * to enter.
 *
 * Appended as a SIBLING of `.stage-root` under `root` (never inside it) —
 * `editor.css`'s own header says the editor is "not the 1920x1080 stage",
 * a normal scrolling document, and `.stage-root` is `position: fixed` with
 * `overflow: hidden` clipped to the 16:9 canvas, which would silently clip
 * a question list of any real length.
 */
function renderEditorShell(root: HTMLElement, opts: { onBack: () => void }): HTMLElement {
  const shell = document.createElement('div');
  shell.className = 'editor-shell';
  shell.dir = 'rtl';
  shell.lang = 'ar';

  const backBar = document.createElement('div');
  backBar.className = 'editor-back-bar';
  const backBtn = document.createElement('button');
  backBtn.type = 'button';
  backBtn.className = 'op-button type-operator-button editor-back-button';
  backBtn.textContent = '→ الرئيسية';
  backBtn.addEventListener('click', opts.onBack);
  backBar.append(backBtn);

  const editorContainer = document.createElement('div');
  editorContainer.className = 'editor-shell-body';

  shell.append(backBar, editorContainer);
  root.append(shell);

  // `mountEditor` is async (it awaits the IndexedDB draft load) — fire and
  // forget from this synchronous `render()` pass; the editor paints itself
  // into `editorContainer` once its own `store.load()` resolves, same as
  // any other consumer of `mountEditor` (WL-C's own tests await it the same
  // way from an already-mounted container).
  void mountEditor(editorContainer);

  return shell;
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
