/**
 * «معاينة كما يراها الجميع» (PH-C3) — imports the REAL stage question
 * component (`src/stage/screens/question.ts`'s `renderQuestionScreen`,
 * WL-B-owned) rather than duplicating its rendering logic. This is the
 * whole point of this module: the editor's preview can never drift from
 * what the room actually sees, because it is not a second implementation
 * — it is the same function call WL-B's own `src/stage/app.ts` makes.
 *
 * Rendered as a full-viewport overlay, not a shrunk inline widget —
 * `--stage-unit` (`src/styles/tokens.css`) is `min(100vw/1920, 100vh/1080)`,
 * computed against the real browser viewport via the stage's own
 * `position: fixed` root, not against a containing element. Mounting the
 * real `.stage-root` full-viewport, exactly like `src/stage/app.ts` does,
 * is the only way to show the actual proportions "as everyone sees it" —
 * a shrunk inline copy would need CSS this module does not own
 * (`src/styles/**` is WL-B's).
 *
 * ---- `resolveMediaUrl` (integration fix, 2026-08-08) -------------------
 * `renderQuestionScreen` currently (as merged into `main`) resolves image/
 * audio URLs through a hardcoded demo lookup (`resolveDemoMediaUrl`,
 * keyed by a fixed set of `demo-image-N`/`demo-audio-N` question ids) —
 * calling it with a real draft question id throws. WL-B has agreed to add
 * an injectable `resolveMediaUrl?: (question: Question) => string | null`
 * parameter to `QuestionScreenParams`, falling back to the demo resolver
 * when absent, but that parameter is **not yet declared** in the
 * `QuestionScreenParams` merged into `main` as of this fix (confirmed:
 * `grep -r resolveMediaUrl src/` finds nothing anywhere in the repo, in
 * either worktree). This module is written *ready* for it regardless:
 *   - `openStagePreview` accepts the draft's already-fetched media `Blob`
 *     (the caller, `question-list.ts`, fetches it via
 *     `DraftStore.getMediaBlob` before opening the preview — the resolver
 *     itself must be synchronous, so the blob has to be in hand first).
 *   - One object URL is minted from it and revoked when the preview closes
 *     (`revokeMediaUrl`, called from the close button AND returned to the
 *     caller so a repeatedly-opened preview during a long authoring
 *     session never leaks object URLs).
 *   - The resolver is passed through an intersection type
 *     (`QuestionScreenParams & { resolveMediaUrl?: ... }`), which
 *     typechecks *today* without modifying WL-B's file (a raw object
 *     literal assigned directly to the narrower `QuestionScreenParams`
 *     would trigger an excess-property error; a value typed as the wider
 *     intersection does not, and is structurally still a valid
 *     `QuestionScreenParams`). The moment WL-B's real parameter lands,
 *     this cast becomes redundant, not incorrect — nothing here needs to
 *     change again.
 * Until that parameter lands and is actually *read* inside
 * `renderQuestionScreen`, an image/audio preview still shows demo/placeholder
 * media (or throws, for the "unknown question id" case — see
 * worklog-C3.md's fixes table for the live proof of the current gap and
 * the plan to close it the moment the upstream change is merged).
 */

import '../../styles/tokens.css';
import '../../styles/stage.css';
import type { Question, OptionIndex, TeamId } from '../../contracts';
import { renderQuestionScreen, type QuestionScreenParams } from '../../stage/screens/question';
import { initialMediaUiState, type MediaUiState } from '../../stage/screens/media-ui-state';
import { AR_COPY } from '../copy';
import type { DraftQuestion } from '../../storage/idb';

/** `DraftQuestion.correctIndex` is nullable during authoring; the frozen
 *  `Question` contract requires it. Returns `null` (never throws) when the
 *  question is not yet ready — the caller (question-list.ts) is expected
 *  to gate the preview button on `isQuestionReady` first and never call
 *  this on a question that fails it, but this stays defensive regardless. */
export function toStageQuestion(draft: DraftQuestion): Question | null {
  if (draft.correctIndex === null) return null;
  return {
    id: draft.id,
    text: draft.text,
    options: draft.options,
    correctIndex: draft.correctIndex,
    media: draft.media,
    category: draft.category,
    difficulty: draft.difficulty,
  };
}

/** Matches `src/stage/session/demo-deck.ts`'s team-colour convention
 *  (blue/orange, matching the stage's own team-A/team-B colours) — not
 *  imported directly, since that module's fixtures are its own concern,
 *  not a stable export for other lines to depend on. Restated here as the
 *  editor's own preview-only placeholder, for the same visual reason. */
const PREVIEW_TEAM_NAMES: [string, string] = ['الفريق الأزرق', 'الفريق البرتقالي'];

export interface StagePreviewOptions {
  question: Question;
  /** The draft's own media blob for this question (already fetched by the
   *  caller via `DraftStore.getMediaBlob`) — `undefined` for text
   *  questions, or when nothing is stored under the question's `sha256`.
   *  `openStagePreview` mints exactly one object URL from it and revokes
   *  it when the preview closes. */
  mediaBlob?: Blob;
  onClose?: () => void;
}

export interface StagePreviewHandle {
  overlay: HTMLElement;
  /** Revokes the media object URL (if one was minted) without closing the
   *  overlay — exposed for tests; the close button already calls this. */
  revokeMediaUrl: () => void;
}

/** Opens the full-viewport preview overlay and returns a handle to it (so a
 *  caller/test can inspect or remove it without waiting for the close
 *  button). The preview is inert — tapping an option never mutates any
 *  real session state; it exists only to show layout, type scale and media
 *  exactly as the stage component itself would render them. */
export function openStagePreview(options: StagePreviewOptions): StagePreviewHandle {
  const overlay = document.createElement('div');
  overlay.className = 'stage-preview-overlay';
  overlay.dir = 'rtl';

  const stageRoot = document.createElement('div');
  stageRoot.className = 'stage-root';
  overlay.append(stageRoot);

  // One object URL for the whole preview session — never re-minted on
  // every re-render (setMediaUi triggers re-renders for the audio/image
  // beats), and always revoked on close (see the file header comment).
  let mediaObjectUrl: string | null = options.mediaBlob ? URL.createObjectURL(options.mediaBlob) : null;
  function revokeMediaUrl(): void {
    if (mediaObjectUrl) {
      URL.revokeObjectURL(mediaObjectUrl);
      mediaObjectUrl = null;
    }
  }

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'stage-preview-close-button';
  closeButton.textContent = AR_COPY.closePreview;
  closeButton.addEventListener('click', () => {
    overlay.remove();
    revokeMediaUrl();
    options.onClose?.();
  });
  overlay.append(closeButton);

  const optionOrder: [OptionIndex, OptionIndex, OptionIndex, OptionIndex] = [0, 1, 2, 3];
  const answeringTeam: TeamId = 'A';

  // Mirrors src/stage/app.ts's own `mediaUi`/`setMediaUi` pattern exactly
  // (a closure variable, mutated then re-rendered) — the audio/image
  // screens drive their own beat/playback state through this, and a
  // preview that does not supply it cannot render those screens correctly.
  let mediaUi: MediaUiState = initialMediaUiState();
  function setMediaUi(patch: Partial<MediaUiState>): void {
    mediaUi = { ...mediaUi, ...patch };
    renderInto();
  }

  function renderInto(): void {
    // See the file header comment: `resolveMediaUrl` is not yet declared
    // on `QuestionScreenParams` as merged into `main`. This intersection
    // type is the forward-compatible bridge — see that comment for why it
    // typechecks today without touching WL-B's file.
    const params: QuestionScreenParams & { resolveMediaUrl?: (q: Question) => string | null } = {
      question: options.question,
      optionOrder,
      teamNames: PREVIEW_TEAM_NAMES,
      answeringTeam,
      positions: [0, 0],
      revealed: false,
      chosenOption: null,
      canUndo: false,
      mediaUi,
      setMediaUi,
      onChoose: () => {
        /* inert preview — never mutates real game/session state */
      },
      onNoAnswer: () => {
        /* inert preview */
      },
      // WL-B contract change (worklog-B7.md): `onNext` -> `moveOptions`
      // (game-systems-expert 2026-08-08 §7, the route action band). The
      // preview always renders pre-reveal (`revealed: false`), so this is
      // never read — kept as an empty array for the same "inert preview"
      // reason the callbacks above are no-ops. Minimal, contained edit to
      // this ONE call site, made necessary by the shared contract change;
      // `src/editor/**` ownership is otherwise untouched (WL-C's file).
      moveOptions: [],
      onUndo: () => {
        /* inert preview */
      },
      resolveMediaUrl: () => mediaObjectUrl,
    };
    renderQuestionScreen(stageRoot, params);
  }
  renderInto();

  document.body.append(overlay);
  return { overlay, revokeMediaUrl };
}
