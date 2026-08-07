/**
 * PH-C1 acceptance criterion 5: a question with no correct option cannot
 * reach «جاهز», and publish is blocked with a message naming the question
 * number.
 */

import { describe, expect, it } from 'vitest';
import type { DraftQuestion } from '../../src/storage/idb';
import { isQuestionReady, validateForPublish } from '../../src/editor/validate';

function makeDraft(overrides: Partial<DraftQuestion> = {}): DraftQuestion {
  return {
    id: 'q1',
    text: 'سؤال',
    options: ['أ', 'ب', 'ج', 'د'],
    correctIndex: 0,
    media: { kind: 'none' },
    order: 0,
    ...overrides,
  };
}

describe('isQuestionReady', () => {
  it('is false when no option is marked correct', () => {
    expect(isQuestionReady(makeDraft({ correctIndex: null }))).toBe(false);
  });

  it('is true when text, four options and a correct index are all present', () => {
    expect(isQuestionReady(makeDraft())).toBe(true);
  });

  it('is false when an option is blank', () => {
    expect(isQuestionReady(makeDraft({ options: ['أ', '', 'ج', 'د'] }))).toBe(false);
  });

  it('is false when the question text is blank', () => {
    expect(isQuestionReady(makeDraft({ text: '   ' }))).toBe(false);
  });
});

describe('validateForPublish', () => {
  it('blocks and names the question number for a missing correct answer', () => {
    const questions = [
      makeDraft({ id: 'q1' }),
      makeDraft({ id: 'q2' }),
      makeDraft({ id: 'q3', correctIndex: null }),
    ];
    const result = validateForPublish(questions);
    console.log('AC5 blockingMessages:', result.blockingMessages);
    expect(result.ok).toBe(false);
    expect(result.blockingMessages).toEqual(['السؤال 3 بلا إجابة صحيحة']);
  });

  it('is ok with no blocking messages when every question has a correct answer', () => {
    const questions = [makeDraft({ id: 'q1' }), makeDraft({ id: 'q2' })];
    const result = validateForPublish(questions);
    expect(result).toEqual({ ok: true, blockingMessages: [] });
  });
});
