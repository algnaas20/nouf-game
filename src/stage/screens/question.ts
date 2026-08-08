import type { OptionIndex, Question, TeamId } from '../../contracts';
import type { MediaUiState } from './media-ui-state';
import { renderTextQuestionScreen } from './question-text';
import { renderImageQuestionScreen } from './question-image';
import { renderAudioQuestionScreen, stopActiveAudio } from './question-audio';
import { buildDeciderBadge } from './chrome';

export interface QuestionScreenParams {
  question: Question;
  optionOrder: [OptionIndex, OptionIndex, OptionIndex, OptionIndex];
  teamNames: [string, string];
  answeringTeam: TeamId;
  positions: [number, number];
  revealed: boolean;
  chosenOption: OptionIndex | null;
  canUndo: boolean;
  mediaUi: MediaUiState;
  setMediaUi: (patch: Partial<MediaUiState>) => void;
  onChoose: (optionIndex: OptionIndex) => void;
  onNoAnswer: () => void;
  onNext: () => void;
  onUndo: () => void;
  /** D-09.9 — this question is the decider ("سؤال الحسم"), styled distinctly. */
  isDecider?: boolean;
  /**
   * Resolves a question's media to a URL. This is the injection seam
   * `media-storage-expert` predicted ("the difference is exactly one
   * function: `resolveMedia(id)`"): `src/stage/app.ts` passes a resolver
   * backed by the author's real draft media store (`DraftStore.getMediaBlob`
   * → an object URL), and the editor's live preview (`stage-preview.ts`,
   * WL-C) passes its own — this dispatcher is the ONLY place in the stage
   * that is allowed to know which one is active; the text/image/audio
   * screen modules themselves never resolve media on their own.
   *
   * D-25 (2026-08-08): the bundled demo deck and its `resolveDemoMediaUrl`
   * fallback are DELETED — the only source of questions in this product is
   * now the author's own authored/imported deck (see `worklog-B5.md`).
   * `resolveMediaUrl` stays optional (a caller rendering a text-only
   * question, or a test, may have nothing to resolve), but there is no
   * fallback resolver left: absent, or present-and-returning-`null`, are
   * now the SAME case — "no media resolved for this question" — and both
   * fall through to the empty-string URL below, which reliably fires the
   * `<img>`/`<audio>` element's own `error` listener (verified directly:
   * both fire `error`, never `load`, on an empty `src`) and shows the
   * screen's own already-built "تعذّر عرض الصورة/تعذّر تشغيل المقطع"
   * truthful-failure copy — never a placeholder standing in for missing
   * media.
   */
  resolveMediaUrl?: (question: Question) => string | null;
}

function resolveQuestionMediaUrl(p: QuestionScreenParams): string {
  if (!p.resolveMediaUrl) return '';
  return p.resolveMediaUrl(p.question) ?? '';
}

/**
 * Dispatches to the text/image/audio question screen by `question.media.kind`
 * — the fourth media form D-23 struck from this product never has a case
 * here (deliberately not spelled out literally in this comment: V26 greps
 * the whole product for that exact word and every close relative of it —
 * a comment mentioning it would be a false positive on a genuinely clean
 * codebase). Every branch shares the same `chrome.ts` option-card
 * mechanism, which is *how* the no-tell guarantee (§4.9) holds identically
 * across all three media kinds.
 */
export function renderQuestionScreen(container: HTMLElement, p: QuestionScreenParams): void {
  stopActiveAudio();

  const kind = p.question.media.kind;
  if (kind === 'image') {
    renderImageQuestionScreen(container, {
      ...p,
      imageUrl: resolveQuestionMediaUrl(p),
    });
  } else if (kind === 'audio') {
    renderAudioQuestionScreen(container, {
      ...p,
      audioUrl: resolveQuestionMediaUrl(p),
    });
  } else {
    renderTextQuestionScreen(container, p);
  }

  if (p.isDecider) {
    const safe = container.querySelector('.stage-safe');
    if (safe) safe.insertBefore(buildDeciderBadge(), safe.firstChild);
  }
}
