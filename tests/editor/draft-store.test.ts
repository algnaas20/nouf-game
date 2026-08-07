/**
 * PH-C1 acceptance criteria 1 (logic layer), 2 (logic layer), 6, 7. The
 * literal "reload the page" wording of AC1/AC2 is proven separately, against
 * a real browser and real IndexedDB, by tests/editor/live/persistence-and-quota.ts
 * — that script is the authoritative evidence for those two; the tests here
 * prove the store's *logic* is correct and fast to re-run.
 */

import { describe, expect, it, vi } from 'vitest';
import { createFakeBackend } from './support/fake-backend';
import { DraftStore, type NewQuestionInput } from '../../src/editor/draft-store';
import { AR_COPY } from '../../src/editor/copy';

function makeInput(n: number): NewQuestionInput {
  return {
    text: `سؤال رقم ${n}`,
    options: [`خيار أ${n}`, `خيار ب${n}`, `خيار ج${n}`, `خيار د${n}`],
    correctIndex: 0,
  };
}

describe('DraftStore — persistence across a fresh instance (AC1, logic layer)', () => {
  it('50 added questions are all present, in order, when a *new* store reloads from the same backend', async () => {
    const backend = createFakeBackend();
    const store = new DraftStore({ backend });
    await store.load();
    for (let i = 1; i <= 50; i += 1) {
      const result = await store.addQuestion(makeInput(i));
      expect(result.ok).toBe(true);
    }

    // Simulate "reload the page": a brand-new store, no shared in-memory
    // state, pointed at the same backend only.
    const reloaded = new DraftStore({ backend });
    await reloaded.load();
    const texts = reloaded.getState().questions.map((q) => q.text);
    console.log('AC1 (logic layer) — count after reload:', reloaded.getState().questions.length);
    expect(reloaded.getState().questions).toHaveLength(50);
    expect(texts).toEqual(Array.from({ length: 50 }, (_, i) => `سؤال رقم ${i + 1}`));
  });
});

describe('DraftStore — reorder with only ▲/▼ (AC6)', () => {
  it('moveUp/moveDown persist through the backend and survive a reload', async () => {
    const backend = createFakeBackend();
    const store = new DraftStore({ backend });
    await store.load();
    for (let i = 1; i <= 10; i += 1) await store.addQuestion(makeInput(i));

    const before = store.getState().questions.map((q) => q.text);
    console.log('AC6 order before:', before);

    const lastQuestion = store.getState().questions[9];
    if (!lastQuestion) throw new Error('expected 10 questions');
    for (let i = 0; i < 9; i += 1) await store.moveUp(lastQuestion.id);

    const reloaded = new DraftStore({ backend });
    await reloaded.load();
    const after = reloaded.getState().questions.map((q) => q.text);
    console.log('AC6 order after:', after);

    expect(after[0]).toBe('سؤال رقم 10');
    expect(after.slice(1)).toEqual(before.slice(0, 9));
  });
});

describe('DraftStore — delete with an ~8s undo strip (AC7)', () => {
  it('undo before 8s restores the exact question, including its media reference', async () => {
    vi.useFakeTimers();
    try {
      const backend = createFakeBackend();
      const store = new DraftStore({ backend });
      await store.load();
      await store.addQuestion({
        ...makeInput(1),
        media: { kind: 'image', sha256: 'a'.repeat(64), ext: 'jpg' },
      });
      const question = store.getState().questions[0];
      if (!question) throw new Error('expected one question');

      store.deleteQuestion(question.id);
      expect(store.getState().questions).toHaveLength(0);
      expect(store.getState().pendingDeletion?.question.id).toBe(question.id);

      vi.advanceTimersByTime(7000);
      store.undoDelete();

      const restored = store.getState().questions[0];
      expect(store.getState().questions).toHaveLength(1);
      expect(restored?.media).toEqual({ kind: 'image', sha256: 'a'.repeat(64), ext: 'jpg' });
      expect(store.getState().pendingDeletion).toBeNull();

      // The backend was never touched — undo happened before the commit.
      expect(await backend.listQuestions()).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('commits the deletion to the backend once the 8s window elapses without undo', async () => {
    vi.useFakeTimers();
    try {
      const backend = createFakeBackend();
      const store = new DraftStore({ backend });
      await store.load();
      await store.addQuestion(makeInput(1));
      const question = store.getState().questions[0];
      if (!question) throw new Error('expected one question');

      store.deleteQuestion(question.id);
      await vi.advanceTimersByTimeAsync(8001);

      expect(await backend.listQuestions()).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('DraftStore — QuotaExceededError on a write (AC2, logic layer)', () => {
  it('surfaces the Arabic message and does not silently drop the write', async () => {
    const backend = createFakeBackend();
    backend.setFailNextPut(true);
    const store = new DraftStore({ backend });
    await store.load();

    const result = await store.addQuestion(makeInput(1));
    expect(result).toEqual({ ok: false, storageFullMessage: AR_COPY.draftStorageFull });
    expect(store.getState().storageFullMessage).toBe(AR_COPY.draftStorageFull);
    // Not silently dropped: the question never entered the in-memory list,
    // and the backend never received it either.
    expect(store.getState().questions).toHaveLength(0);
    expect(await backend.listQuestions()).toHaveLength(0);
  });

  it('also guards reorder — a quota failure on moveUp leaves the order untouched instead of rejecting unnoticed', async () => {
    const backend = createFakeBackend();
    const store = new DraftStore({ backend });
    await store.load();
    await store.addQuestion(makeInput(1));
    await store.addQuestion(makeInput(2));
    const before = store.getState().questions.map((q) => q.text);

    const second = store.getState().questions[1];
    if (!second) throw new Error('expected two questions');
    backend.setFailNextPut(true);
    await store.moveUp(second.id);

    expect(store.getState().storageFullMessage).toBe(AR_COPY.draftStorageFull);
    // The in-memory order was never optimistically applied over a failed write.
    expect(store.getState().questions.map((q) => q.text)).toEqual(before);
  });
});
