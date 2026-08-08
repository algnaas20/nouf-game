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
      imageUrl: resolveDemoMediaUrl(p.question.id),
    });
  } else if (kind === 'audio') {
    renderAudioQuestionScreen(container, {
      ...p,
      audioUrl: resolveDemoMediaUrl(p.question.id),
    });
  } else {
    renderTextQuestionScreen(container, p);
  }

  if (p.isDecider) {
    const safe = container.querySelector('.stage-safe');
    if (safe) safe.insertBefore(buildDeciderBadge(), safe.firstChild);
  }
}
