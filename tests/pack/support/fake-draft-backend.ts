/**
 * A minimal in-memory `DraftBackend`, hand-written for `src/pack/**`'s own
 * unit tests. Deliberately not imported from `tests/editor/support/
 * fake-backend.ts` (WL-C's own test support file) — reading it was useful
 * as a reference for the shape, but `tests/pack/**` keeps its own,
 * self-contained fixture so this test line never depends on another line's
 * test-support file changing shape underneath it. Node has no IndexedDB;
 * the real backend is proven separately, live, in
 * `tests/pack/live/pack-roundtrip.ts`.
 */
import type { DraftBackend, DraftMediaRecord, DraftMeta, DraftQuestion } from '../../../src/storage/idb';

export function createFakeDraftBackend(): DraftBackend {
  const questions = new Map<string, DraftQuestion>();
  const media = new Map<string, DraftMediaRecord>();
  let meta: DraftMeta | null = null;

  return {
    async listQuestions() {
      return Array.from(questions.values()).sort((a, b) => a.order - b.order);
    },
    async putQuestion(question) {
      questions.set(question.id, { ...question });
    },
    async putQuestionWithMedia(question, mediaRecord) {
      questions.set(question.id, { ...question });
      if (mediaRecord) media.set(mediaRecord.sha256, { ...mediaRecord });
    },
    async getMedia(sha256) {
      const record = media.get(sha256);
      return record ? { ...record } : undefined;
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
      media.clear();
      meta = null;
    },
  };
}
