/**
 * Readiness and publish-blocking rules for the draft. A question cannot
 * reach «جاهز» without a marked correct option (WL-C C1 prompt,
 * implementation rules) — this is the one guard PH-C1 owns; the fuller
 * publish flow (export itself) is WL-D's, later.
 */

import type { DraftQuestion } from '../storage/idb';
import { questionMissingCorrectMessage } from './copy';

export function isQuestionReady(question: DraftQuestion): boolean {
  if (question.text.trim().length === 0) return false;
  if (question.options.some((option) => option.trim().length === 0)) return false;
  if (question.correctIndex === null) return false;
  return true;
}

export interface PublishValidation {
  ok: boolean;
  blockingMessages: string[];
}

/**
 * Messages are ordered and numbered by the question's on-screen position
 * (1-based) — the number the author sees in the list, never an internal id.
 */
export function validateForPublish(questions: readonly DraftQuestion[]): PublishValidation {
  const blockingMessages: string[] = [];
  questions.forEach((question, index) => {
    if (question.correctIndex === null) {
      blockingMessages.push(questionMissingCorrectMessage(index + 1));
    }
  });
  return { ok: blockingMessages.length === 0, blockingMessages };
}
