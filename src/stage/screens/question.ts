import type { OptionIndex, Question, TeamId } from '../../contracts';
import type { MediaUiState } from './media-ui-state';
import { renderTextQuestionScreen } from './question-text';
import { renderImageQuestionScreen } from './question-image';
import { renderAudioQuestionScreen, stopActiveAudio } from './question-audio';
import { resolveDemoMediaUrl } from '../session/demo-deck';
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
   * Resolves a question's media to a URL. Falls back to the demo resolver
   * when absent (i.e. the caller passed no function at all) — this keeps
   * every already-verified PH-B2/B3 demo-deck behaviour regressing to zero
   * change. This is the injection seam `media-storage-expert` predicted
   * ("the difference is exactly one function: `resolveMedia(id)`"): the
   * editor's live preview passes the author's actual uploaded blob URL, a
   * published pack's stage passes its own content-addressed resolver, and
   * this dispatcher is the ONLY place in the stage that is allowed to know
   * which one is active — the text/image/audio screen modules themselves
   * never call `resolveDemoMediaUrl` directly.
   *
   * Returning `null` means "the function ran but genuinely found no media
   * for this question" (e.g. a broken/incomplete pack) — this is treated
   * as a real resolution failure, NOT silently patched over with demo
   * content, so the empty-string URL is passed straight to `<img>`/`<audio>`,
   * which reliably fires their existing `error` listener (verified directly:
   * both elements fire `error`, never `load`, on an empty `src`) and shows
   * the screen's own already-built "تعذّر عرض الصورة/تعذّر تشغيل المقطع"
   * truthful-failure copy — never a mismatched demo placeholder standing in
   * for a real author's missing media.
   */
  resolveMediaUrl?: (question: Question) => string | null;
}

function resolveQuestionMediaUrl(p: QuestionScreenParams): string {
  if (!p.resolveMediaUrl) return resolveDemoMediaUrl(p.question.id);
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
