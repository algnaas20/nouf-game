import type { GameEvent, Question, TeamId } from '../contracts';
import { renderHomeScreen } from './screens/home';
import { renderTeamSetupScreen } from './screens/team-setup';
import { renderQuestionScreen } from './screens/question';
import { renderMazeBeat, type MazeBeatMode, type JustMoved } from './screens/maze-beat';
import { renderTurnHandoff, type HandoffKind } from './screens/turn-handoff';
import { renderEndingScreen, computeNextFirstTeam } from './screens/ending';
import { renderResumePromptScreen, renderDeckMismatchScreen } from './screens/resume-prompt';
import { initialMediaUiState, type MediaUiState } from './screens/media-ui-state';
import { resetAutoplayTracking } from './screens/question-audio';
import type { RouteOption } from './screens/chrome';
import { EXIT_LETTERS, EXIT_DIRECTION_WORDS, type ExitSlot } from './maze-geometry';
import {
  GameDriver,
  findAnswerChosen,
  findNoAnswer,
  findAllMoveApplied,
  findTurnPassed,
  findGameEnded,
  findQuestionShown,
  isAudienceDecision,
  isDecisiveEnding,
} from './session/game-driver';
import { computeDeckHash } from './session/deck-hash';
// WL-C's own doc comment on `mountEditor` names this exact import as the
// intended integration point (خطة.md §5.4 — "same app, its own screen,
// reached only from the home screen. Not a mode toggle."). Import only —
// `src/editor/**` stays WL-C-owned; nothing here reaches into its internals.
import { mountEditor } from '../editor/app';
// D-25 (2026-08-08) / adversarial review F-1 fix (worklog-B5.md): the ONLY
// source of playable questions now is the author's own draft — either typed
// in directly through «أسئلتي», or written there by importing a pack
// (`applyImportedPackToDraft`, WL-D's `src/pack/apply-import.ts`, which
// itself writes through this exact same `DraftStore`). There is no bundled
// demo deck any more. `createDraftStore`/`DraftStore` are WL-C's
// (`src/editor/**`); read/import only, never written to from this file.
import { createDraftStore, type DraftStore } from '../editor/draft-store';
// `buildPackFromDraft` is WL-D's (`src/pack/from-draft.ts`) — the exact same
// ready-question-filtering + media-collection logic the real "صدّر للنشر"/
// "احفظ نسخة" flows use, reused here rather than re-derived, so the deck
// that plays can never quietly drift from the deck that exports.
import { buildPackFromDraft } from '../pack/from-draft';
// `saveBackupToDevice`'s own doc comment names this exact call site
// (`mountEditor({ onRequestBackup: () => saveBackupToDevice(store, title) })`)
// as its intended wiring point — closing adversarial-review F-1's dead-
// button defect (the backup badge / storage-full-banner save buttons were
// visible, clickable, and did nothing, because nothing supplied
// `onRequestBackup` at this call site).
import { saveBackupToDevice } from '../pack/save-to-device';
// PH-A4 (WL-A) — `checkResume()`'s `ResumeCheck` is the complete data
// contract for the prompt below; this file only ever READS it and never
// mutates storage directly except via the one explicit `clearSession()`
// call on the two refusal/decline paths (§6.3 — never a silent auto-delete
// of a resumable session; `clearSession()` here is only ever called either
// on a session that was already unrecoverable ('corrupt'), or after the
// operator explicitly chose «جلسة جديدة»).
import { checkResume, clearSession } from '../core/session-store';
import { fold } from '../core/fold';

/**
 * Placeholder pack title (adversarial review §5(a)/F-1 item 3 — WL-D/WL-C's
 * territory to fully resolve: the draft has no per-deck title field yet;
 * `src/storage/idb.ts`/`DraftMeta` is WL-C-owned and this file does not add
 * one). Used only as the `title` argument `buildPackFromDraft`/
 * `saveBackupToDevice` require — disclosed in worklog-B5.md, not presented
 * as a real "name your game" feature.
 */
const GAME_TITLE = 'لعبة نوف';

/** No client-side router (D-11) — a plain state switch inside one root
 *  element, driven by the REAL `src/core` state machine (`GameDriver`).
 *  `mountApp` itself stays synchronous (its callers, `src/main.ts`, never
 *  await it) — the one-time async work (loading the draft store, building
 *  the first playable deck) runs inside `initialize()`, fired-and-forgotten
 *  the same way `renderEditorShell` already does for `mountEditor` below. */
export function mountApp(root: HTMLElement): void {
  const store: DraftStore = createDraftStore();

  const wrap = document.createElement('div');
  wrap.className = 'stage-root';
  root.append(wrap);

  void initialize();

  async function initialize(): Promise<void> {
    await store.load();

    // D-25 / F-1: `deck` and `mediaUrlByHash` are the live, re-buildable
    // projection of the author's draft — never a fixed constant. `deck`
    // starts empty and stays empty until the author has written (or
    // imported) at least one ready question; that is now the FIRST-experience
    // default, not an error state (see `renderHomeScreen`/`team-setup.ts`).
    let deck: Question[] = [];
    let deckHash = computeDeckHash(deck);
    let mediaUrlByHash = new Map<string, string>();

    /**
     * Rebuilds `deck`/`deckHash`/the media-URL map from the CURRENT draft
     * contents. Reuses `buildPackFromDraft` (WL-D's — the same function
     * "صدّر للنشر"/"احفظ نسخة" call) rather than re-deriving the
     * ready-question filter or the media-collection logic a second time —
     * the deck that plays can never drift from the deck that exports.
     * Object URLs from the PREVIOUS deck are revoked first so re-entering
     * the editor repeatedly across a long authoring session never leaks
     * blob URLs (mirrors `src/editor/ui/stage-preview.ts`'s own one-URL-at-
     * a-time discipline).
     */
    async function refreshDeck(): Promise<void> {
      for (const url of mediaUrlByHash.values()) URL.revokeObjectURL(url);
      const { manifest, media } = await buildPackFromDraft(store, GAME_TITLE);
      deck = manifest.questions;
      deckHash = computeDeckHash(deck);
      const nextMediaUrls = new Map<string, string>();
      for (const [sha256, blob] of media) nextMediaUrls.set(sha256, URL.createObjectURL(blob));
      mediaUrlByHash = nextMediaUrls;
    }

    /** The `resolveMediaUrl` seam (`question.ts`) — backed by the real
     *  draft media store via the object-URL map above, never a placeholder.
     *  Returns `null` (not a thrown error) for a question whose media
     *  genuinely has nothing resolvable yet — `question.ts`'s own dispatcher
     *  turns that into the screen's existing truthful failure copy. */
    function resolveMediaUrl(question: Question): string | null {
      if (question.media.kind === 'none') return null;
      return mediaUrlByHash.get(question.media.sha256) ?? null;
    }

    await refreshDeck();

    let driver = new GameDriver(deck);
    let localPhase: 'home' | 'editor' | 'team-setup' | 'draw' | 'playing' | 'resume-prompt' | 'deck-mismatch' = 'home';
    let drawnFirstTeam: TeamId = 'A';
    let pendingTeamNames: [string, string] = ['', ''];
    let pendingN = 10;

    // PH-A4 — classified ONCE, at cold start (now: once the FIRST real deck
    // is known), before the first `render()`. A resumable session only ever
    // exists right after a real reload/interruption; nothing later in this
    // same tab's lifetime can produce a new one to check for (every
    // subsequent log mutation goes through `GameDriver`'s own `persist()`,
    // which this same tab's `driver` is already the source of truth for).
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
        // see worklog-B4.md.
        clearSession();
      }
      // 'none' → stays 'home', unchanged behaviour.
    }

    let mediaUi: MediaUiState = initialMediaUiState();
    let lastUiQuestionId: string | null = null;
    let decisiveTimer: ReturnType<typeof setTimeout> | null = null;
    // game-systems-expert 2026-08-08 §7 ("the screen auto-advances to the
    // next turn"): 'continue' mode on the maze beat no longer waits for a
    // manual tap — mirrors `decisiveTimer`'s own existing pattern.
    let continueTimer: ReturnType<typeof setTimeout> | null = null;
    // Set by a route-card `onSelect` (below) immediately before `render()`,
    // consumed once at the top of the very next `render()` pass (same
    // pattern as `suppressDecisiveAuto`) — tells the maze beat what the
    // move that just landed actually did, for the transient «طريق مسدود!»
    // moment (D-09.28). Never re-derived inside `maze-beat.ts` itself.
    let justMoved: JustMoved | null = null;
    let cancelHandoff: (() => void) | null = null;
    // F-4 fix (adversarial review, 2026-08-08 — worklog-B5.md §F4): set
    // immediately before `driver.undo(); render();` at every undo call
    // site below. Consumed (read once, then reset) at the very top of the
    // very next `render()` pass — so the decisive-auto timer never re-arms
    // on the render immediately following an undo, without touching the
    // normal forward-play 900ms auto-advance at all.
    let suppressDecisiveAuto = false;

    // The editor is a normal scrolling document (`src/editor/editor.css`'s
    // own header explicitly says so — "not the 1920x1080 stage"), so it
    // must NOT be mounted inside `.stage-root` (`position: fixed`,
    // `overflow: hidden`, clipped to the 16:9 canvas) — a question list past
    // a couple of screens would be silently clipped. It is mounted as
    // `wrap`'s SIBLING under the same outer `root`, and `wrap` itself is
    // hidden (not removed — cheaper to restore, and it owns no state that
    // would be lost) while the editor is showing.
    let editorHost: HTMLElement | null = null;
    function teardownEditor(): void {
      if (editorHost) {
        editorHost.remove();
        editorHost = null;
      }
    }

    // Tier 2 ("console") screens — `rtl-stage-ux-expert`'s
    // `addendum-small-screens-2026-08-08.md` (worklog-B6.md): a normal
    // scrolling document on `src/styles/console.css`'s CSS-px scale, never
    // `--stage-unit`, never `position: fixed`. Mounted as a SIBLING of
    // `.stage-root` (`wrap`), same reason and same pattern as
    // `editorHost` above — a fixed 1920x1080 `overflow: hidden` canvas
    // silently clips content whose height is not bounded by construction
    // (two typed team names, a variable readiness message), which is
    // exactly the live-user defect this phase fixes (worklog-B6.md).
    // Currently used by `team-setup` only — `home`/`resume-prompt`/
    // `deck-mismatch` are short, fixed-shape screens that do not overflow
    // the canvas today and are deliberately NOT reassigned this session
    // (disclosed scope cut, worklog-B6.md); reassigning them later is a
    // one-line change per screen using this same `mountConsole` helper.
    let consoleHost: HTMLElement | null = null;
    function teardownConsole(): void {
      if (consoleHost) {
        consoleHost.remove();
        consoleHost = null;
      }
    }
    function mountConsole(build: (container: HTMLElement) => void): void {
      teardownEditor();
      wrap.hidden = true;
      if (!consoleHost) {
        consoleHost = document.createElement('div');
        root.append(consoleHost);
      }
      build(consoleHost);
    }

    function setMediaUi(patch: Partial<MediaUiState>): void {
      mediaUi = { ...mediaUi, ...patch };
      render();
    }

    function startNewGame(teamNames: [string, string], N: number, firstTeam: TeamId): void {
      resetAutoplayTracking(); // reviewer note item 13 — see question-audio.ts's own doc comment.
      driver = new GameDriver(deck);
      const seed = Math.floor(Math.random() * 1_000_000_000);
      driver.start({ teamNames, N, firstTeam, seed, deckHash });
      localPhase = 'playing';
      render();
    }

    /** Shared by the decisive-auto timer AND the decisive-manual button
     *  (F-4 fix) — one code path, so the two can never diverge. */
    function commitDecisive(): void {
      const ev = findGameEnded(driver.legal());
      if (ev) driver.commit(ev);
      render();
    }

    /** Shared by 'continue' mode's auto-advance timer AND the optional tap-
     *  anywhere-to-skip accelerator (`maze-beat.ts`'s `onSkip`) — one code
     *  path, matching `commitDecisive`'s own discipline. */
    function commitContinue(): void {
      const ev = findTurnPassed(driver.legal());
      if (ev) driver.commit(ev);
      render();
    }

    /**
     * The single place a route/advance `MOVE_APPLIED` candidate is
     * committed from (both the 2-3-card correct-answer case and the
     * 1-card wrong-answer case) — records `justMoved` from a real
     * before/after comparison of `driver.state`, never guessed from the
     * event shape alone (a dead end and a normal advance are BOTH
     * `exit !== null`; only the resulting `wasted`/`positions` delta tells
     * them apart).
     */
    function commitMove(ev: GameEvent): void {
      if (ev.type !== 'MOVE_APPLIED') return;
      const idx = ev.team === 'A' ? 0 : 1;
      const prevWasted = driver.state.wasted[idx];
      const prevPosition = driver.state.positions[idx];
      const applied = driver.commit(ev);
      if (applied) {
        const newWasted = driver.state.wasted[idx];
        const newPosition = driver.state.positions[idx];
        justMoved =
          ev.exit === null
            ? { team: ev.team, result: 'none' }
            : newWasted > (prevWasted ?? 0)
              ? { team: ev.team, result: 'deadEnd' }
              : newPosition > (prevPosition ?? 0)
                ? { team: ev.team, result: 'advance' }
                : { team: ev.team, result: 'none' };
      }
      render();
    }

    function render(): void {
      const justUndone = suppressDecisiveAuto;
      suppressDecisiveAuto = false;
      const justMovedNow = justMoved;
      justMoved = null;

      if (decisiveTimer !== null) {
        clearTimeout(decisiveTimer);
        decisiveTimer = null;
      }
      if (continueTimer !== null) {
        clearTimeout(continueTimer);
        continueTimer = null;
      }
      if (cancelHandoff) {
        cancelHandoff();
        cancelHandoff = null;
      }

      // Tier bookkeeping — see `mountConsole`'s own doc comment above.
      // `team-setup` tears down the editor and hides `wrap` itself, inside
      // `mountConsole` below, without touching `consoleHost` (the same
      // sibling element is reused/redrawn across re-renders while this
      // phase stays active). Every OTHER phase tears down both the editor
      // and the console host and restores `wrap`.
      if (localPhase !== 'editor' && localPhase !== 'team-setup') {
        teardownEditor();
        teardownConsole();
        wrap.hidden = false;
      } else if (localPhase === 'editor') {
        teardownConsole();
      }

      if (localPhase === 'home') {
        renderHomeScreen(wrap, {
          questionCount: deck.length,
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
            store,
            onRequestBackup: () => saveBackupToDevice(store, GAME_TITLE),
            onBack: () => {
              // The author may have added/edited/deleted questions while in
              // the editor — refresh the playable deck before returning, so
              // the home screen's count and the next team-setup screen's
              // readiness gate both reflect what was just authored, not a
              // stale snapshot from cold start.
              void refreshDeck().then(() => {
                localPhase = 'home';
                render();
              });
            },
          });
        }
        return;
      }

      if (localPhase === 'team-setup') {
        // Tier 2 (worklog-B6.md) — mounted OUTSIDE `.stage-root`, a normal
        // scrolling document; see `mountConsole`'s doc comment above and
        // `team-setup.ts`'s own header comment for why.
        mountConsole((consoleContainer) => {
          renderTeamSetupScreen(consoleContainer, {
            deckSize: deck.length,
            onConfirm: ({ teamNames, N }) => {
              pendingTeamNames = teamNames;
              pendingN = N;
              drawnFirstTeam = Math.random() < 0.5 ? 'A' : 'B';
              localPhase = 'draw';
              // Tier 2 -> Tier 1 transition (addendum §2.3): reset scroll
              // before the fixed canvas takes over, so a host who scrolled
              // down to reach «ابدأ» does not land mid-scroll on the draw
              // screen underneath it.
              window.scrollTo(0, 0);
              render();
            },
            onBack: () => {
              localPhase = 'home';
              render();
            },
          });
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

      // F-2 defense-in-depth (adversarial review, 2026-08-08 — worklog-B5.md):
      // the readiness gate in `team-setup.ts` now refuses to start a game the
      // deck cannot support at all, which is the ROOT fix — a game should
      // never reach this point with an empty legal-events set outside
      // `FINISHED`. This is a second, independent guard: if it is ever
      // reached anyway (a future rule change, a bug elsewhere), the host
      // gets a truthful, calm screen with a real way out instead of a
      // same-screen re-render loop with no exit. `legal()` is pure/cheap —
      // calling it once here, before dispatching to the per-state branches
      // below (which each call it again for their own purposes), is not a
      // meaningful cost.
      if (state.stateId !== 'FINISHED' && driver.legal().length === 0) {
        renderDeadEndScreen(wrap, {
          onContinue: () => {
            localPhase = 'home';
            render();
          },
        });
        return;
      }

      if (state.stateId === 'FINISHED') {
        const outcome = state.outcome ?? 'draw';
        // game-systems-expert §6.3 amendment — computed from state, never
        // re-derived by ending.ts (see ending.ts's own `EndReason` doc
        // comment). `correct[t] = positions[t] + wasted[t]` is exact here
        // (Theorem 2, §6.2 — holds while `positions[t] < N`, which is true
        // in every branch below except 'track'). Positions-equal AND
        // correct-equal is the audience-decision path (D-09.15) — the room
        // chose the winner directly, so it gets the same plain "فاز فريق
        // ⟨أ⟩" headline as a track win rather than a manufactured "نفس
        // المحطة" claim that would be untrue (correct counts really ARE
        // equal there, not "more").
        const reachedEnd = state.positions[0] >= state.N || state.positions[1] >= state.N;
        const correctA = state.positions[0] + state.wasted[0];
        const correctB = state.positions[1] + state.wasted[1];
        const endReason: 'track' | 'progress' | 'stations' = reachedEnd
          ? 'track'
          : state.positions[0] !== state.positions[1]
            ? 'progress'
            : correctA !== correctB
              ? 'stations'
              : 'track';
        renderEndingScreen(wrap, {
          teamNames: state.teamNames,
          positions: state.positions,
          N: state.N,
          outcome,
          endReason,
          nextFirstTeam: computeNextFirstTeam(outcome, state.firstTeam),
          canUndo: driver.canUndo(),
          onNewGame: () => {
            const nextFirst = computeNextFirstTeam(outcome, state.firstTeam);
            startNewGame(state.teamNames, state.N, nextFirst);
          },
          onUndo: () => {
            suppressDecisiveAuto = true;
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

        // game-systems-expert 2026-08-08 §7 / addendum-maze-ux.md §1 — the
        // route action band. One `RouteOption` per legal `MOVE_APPLIED`
        // candidate: `driver.legal()` already returns 2-3 candidates (one
        // per open exit) on a correct answer, or exactly one (`exit: null`)
        // on a wrong answer / already-at-goal — never re-derived here, only
        // labelled. Built fresh on every render so `revealed === false`
        // simply gets an empty array (chrome.ts ignores it pre-reveal).
        const moveOptions: RouteOption[] = revealed
          ? findAllMoveApplied(driver.legal()).map((ev) => {
              if (ev.exit === null) {
                return { key: 'next', label: 'السؤال التالي', onSelect: () => commitMove(ev) };
              }
              const slot = ev.exit as ExitSlot;
              return {
                key: String(ev.exit),
                letterChip: EXIT_LETTERS[slot],
                label: EXIT_DIRECTION_WORDS[slot],
                onSelect: () => commitMove(ev),
              };
            })
          : [];

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
          resolveMediaUrl,
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
          moveOptions,
          onUndo: () => {
            suppressDecisiveAuto = true;
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
        else if (isDecisiveEnding(candidates)) mode = justUndone ? 'decisive-manual' : 'decisive-auto';

        renderMazeBeat(wrap, {
          N: state.N,
          positions: state.positions,
          closedExits: state.closedExits,
          wasted: state.wasted,
          decorSeed: state.maze.decorSeed,
          teamNames: state.teamNames,
          mode,
          justMoved: justMovedNow,
          canUndo: driver.canUndo(),
          onDeclare: (outcome) => {
            const ev = findGameEnded(driver.legal(), outcome);
            if (ev) driver.commit(ev);
            render();
          },
          onConfirmDecisive: commitDecisive,
          onUndo: () => {
            suppressDecisiveAuto = true;
            driver.undo();
            render();
          },
          onSkip: mode === 'continue' ? commitContinue : undefined,
        });

        if (mode === 'decisive-auto') {
          decisiveTimer = setTimeout(() => {
            decisiveTimer = null;
            commitDecisive();
          }, 900);
        } else if (mode === 'continue') {
          // game-systems-expert §7: auto-advances — no manual tap required
          // (worklog-B7.md §0 discloses the pre-B7 code needed a third tap
          // here; this closes that gap). 1200ms: long enough to read the
          // «طريق مسدود!» transient moment when it fires, matching the
          // existing 900ms decisive-auto pace plus headroom for that banner
          // — a chosen value, not independently measured against real
          // majlis pacing (same disclosed-estimate status as the existing
          // 900ms figure).
          continueTimer = setTimeout(() => {
            continueTimer = null;
            commitContinue();
          }, 1200);
        }
        return;
      }
    }

    render();
  }
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
 *
 * `store`/`onRequestBackup` (adversarial review F-1 fix, 2026-08-08):
 * passes the SAME `DraftStore` instance `mountApp` already loaded (so the
 * editor's writes are immediately visible to `refreshDeck()` without a
 * second IndexedDB round trip), and a real backup handler — closing the
 * "dead save button" defect the review found (`mountEditor` was always
 * called with no options at all, so `triggerBackup()` returned immediately
 * on `if (!options.onRequestBackup) return;`).
 */
function renderEditorShell(
  root: HTMLElement,
  opts: { store: DraftStore; onRequestBackup: () => ReturnType<typeof saveBackupToDevice>; onBack: () => void },
): HTMLElement {
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
  void mountEditor(editorContainer, { store: opts.store, onRequestBackup: opts.onRequestBackup });

  return shell;
}

/**
 * F-2 defense-in-depth fallback (worklog-B5.md) — reuses the EXISTING
 * literal Appendix أ "any unexpected error" copy (`stage-ux-investigation.md`
 * §4.7: «حدث خلل بسيط. تم حفظ تقدّم اللعبة — اضغط للمتابعة.» / one button
 * «تابع») rather than inventing new copy for a state that should now be
 * structurally unreachable (the `team-setup.ts` readiness gate is the real
 * fix). Routes «تابع» back to the home screen — the only place guaranteed
 * to render something legal regardless of what produced the dead end.
 */
function renderDeadEndScreen(container: HTMLElement, opts: { onContinue: () => void }): HTMLElement {
  container.innerHTML = '';
  const safe = document.createElement('div');
  safe.className = 'stage-safe';
  const screen = document.createElement('div');
  screen.className = 'centered-screen';
  const text = document.createElement('p');
  text.className = 'type-question';
  text.textContent = 'حدث خلل بسيط. تم حفظ تقدّم اللعبة — اضغط للمتابعة.';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'op-button primary type-operator-button';
  btn.textContent = 'تابع';
  btn.addEventListener('click', opts.onContinue);
  screen.append(text, btn);
  safe.append(screen);
  container.append(safe);
  return safe;
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
