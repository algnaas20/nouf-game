import { describe, expect, it } from 'vitest';
import { DraftStore } from '../../src/editor/draft-store';
import { buildPackFromDraft } from '../../src/pack/from-draft';
import { createFakeDraftBackend } from './support/fake-draft-backend';

function readyInput(n: number) {
  return {
    text: `سؤال ${n}`,
    options: [`أ${n}`, `ب${n}`, `ج${n}`, `د${n}`] as [string, string, string, string],
    correctIndex: 0 as const,
  };
}

describe('buildPackFromDraft', () => {
  it('builds a valid PackManifest with formatVersion, title, and every ready question, when the whole deck is ready', async () => {
    const store = new DraftStore({ backend: createFakeDraftBackend() });
    await store.load();
    for (let i = 1; i <= 5; i += 1) await store.addQuestion(readyInput(i));

    const { manifest, media, skippedQuestionNumbers } = await buildPackFromDraft(store, 'عنوان الاختبار');

    expect(manifest.title).toBe('عنوان الاختبار');
    expect(manifest.questions).toHaveLength(5);
    expect(media.size).toBe(0);
    expect(skippedQuestionNumbers).toEqual([]);
  });

  it('skips not-ready questions (no marked correct option) and reports their 1-based numbers, never fabricating a correct answer', async () => {
    const store = new DraftStore({ backend: createFakeDraftBackend() });
    await store.load();
    await store.addQuestion(readyInput(1));
    await store.addQuestion({ ...readyInput(2), correctIndex: null }); // not ready
    await store.addQuestion(readyInput(3));
    await store.addQuestion({ ...readyInput(4), correctIndex: null }); // not ready

    const { manifest, skippedQuestionNumbers } = await buildPackFromDraft(store, 'ت');

    expect(manifest.questions).toHaveLength(2);
    expect(manifest.questions.map((q) => q.text)).toEqual(['سؤال 1', 'سؤال 3']);
    expect(skippedQuestionNumbers).toEqual([2, 4]);
    // No included question has an invalid correctIndex — the frozen
    // contract's 0|1|2|3 is never satisfied by fabricating a value for a
    // question that was actually incomplete.
    for (const q of manifest.questions) expect([0, 1, 2, 3]).toContain(q.correctIndex);
  });

  it('deduplicates media referenced by multiple questions into a single manifest.media entry', async () => {
    const store = new DraftStore({ backend: createFakeDraftBackend() });
    await store.load();
    const sha = 'd'.repeat(64);
    const blob = new Blob([new Uint8Array([1, 2, 3])]);
    await store.addQuestion({
      ...readyInput(1),
      media: { kind: 'image', sha256: sha, ext: 'jpg' },
      mediaBlob: blob,
    });
    await store.addQuestion({
      ...readyInput(2),
      media: { kind: 'image', sha256: sha, ext: 'jpg' },
      mediaBlob: blob,
    });

    const { manifest, media } = await buildPackFromDraft(store, 'ت');
    expect(manifest.media).toHaveLength(1);
    expect(media.size).toBe(1);
    expect(media.get(sha)).toBeDefined();
  });
});
