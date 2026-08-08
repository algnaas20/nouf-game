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
 */

import '../../styles/tokens.css';
import '../../styles/stage.css';
import type { Question, OptionIndex } from '../../contracts';
import { renderQuestionScreen } from '../../stage/screens/question';
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

/** Matches `src/stage/demo/session.ts`'s `DEMO_TEAM_NAMES` convention
 *  (blue/orange, matching the stage's own team-A/team-B colours) — not
 *  imported directly, since that file is explicitly marked a throwaway
 *  PH-B1 walking-skeleton demo driver, not a stable export for other
 *  lines to depend on. Restated here as the editor's own preview-only
 *  placeholder, for the same visual reason. */
const PREVIEW_TEAM_NAMES: [string, string] = ['الفريق الأزرق', 'الفريق البرتقالي'];

export interface StagePreviewOptions {
  question: Question;
  onClose?: () => void;
}

/** Opens the full-viewport preview overlay and returns it (so a caller/test
 *  can inspect or remove it without waiting for the close button). The
 *  preview is inert — tapping an option never mutates any real session
 *  state; it exists only to show layout, type scale and media exactly as
 *  the stage component itself would render them. */
export function openStagePreview(options: StagePreviewOptions): HTMLElement {
  const overlay = document.createElement('div');
  overlay.className = 'stage-preview-overlay';
  overlay.dir = 'rtl';

  const stageRoot = document.createElement('div');
  stageRoot.className = 'stage-root';
  overlay.append(stageRoot);

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'stage-preview-close-button';
  closeButton.textContent = AR_COPY.closePreview;
  closeButton.addEventListener('click', () => {
    overlay.remove();
    options.onClose?.();
  });
  overlay.append(closeButton);

  const optionOrder: [OptionIndex, OptionIndex, OptionIndex, OptionIndex] = [0, 1, 2, 3];
  renderQuestionScreen(stageRoot, {
    question: options.question,
    optionOrder,
    teamNames: PREVIEW_TEAM_NAMES,
    answeringTeam: 'A',
    scores: [0, 0],
    revealed: false,
    chosenOption: null,
    canUndo: false,
    onChoose: () => {
      /* inert preview — never mutates real game/session state */
    },
    onNext: () => {
      /* inert preview */
    },
    onUndo: () => {
      /* inert preview */
    },
  });

  document.body.append(overlay);
  return overlay;
}
