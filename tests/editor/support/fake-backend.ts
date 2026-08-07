/**
 * A hand-written fake `DraftBackend` for fast, deterministic unit tests.
 * Node has no IndexedDB, so this is a plain in-memory implementation of the
 * same interface `src/storage/idb.ts`'s real backend satisfies — the real
 * backend itself is proven against a real browser + real IndexedDB by
 * tests/editor/live/persistence-and-quota.ts, not by this fake.
 */

import type { DraftBackend, DraftMeta, DraftQuestion } from '../../../src/storage/idb';

export interface FakeBackend extends DraftBackend {
  /** Makes the *next* `putQuestion` call reject with a simulated
   *  `QuotaExceededError`, then resets — mirrors a one-shot storage-full
   *  condition without needing a real full disk. */
  setFailNextPut(fail: boolean): void;
}

export function createFakeBackend(): FakeBackend {
  const questions = new Map<string, DraftQuestion>();
  let meta: DraftMeta | null = null;
  let failNextPut = false;

  return {
    setFailNextPut(fail: boolean) {
      failNextPut = fail;
    },
    async listQuestions() {
      return Array.from(questions.values()).sort((a, b) => a.order - b.order);
    },
    async putQuestion(question) {
      if (failNextPut) {
        failNextPut = false;
        throw new DOMException('quota exceeded (simulated)', 'QuotaExceededError');
      }
      questions.set(question.id, { ...question });
    },
    async deleteQuestion(id) {
      questions.delete(id);
    },
    async getMeta() {
      return meta ? { ...meta } : null;
    },
    async putMeta(nextMeta) {
      meta = { ...nextMeta };
    },
    async clearAll() {
      questions.clear();
      meta = null;
    },
  };
}
