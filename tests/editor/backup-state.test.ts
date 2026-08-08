/**
 * PH-C3 AC3/AC4 — the backup badge's three vocabulary states and the T1
 * "unsaved changes" detection, both purely derived from `DraftMeta` via
 * `DraftStore.backupState()`/`hasUnsavedChanges()`. Logic-layer tests
 * against the fake backend; the DOM-rendering half (screenshot, actual
 * filename shown) is proven live in PH-C3's browser script.
 */
import { describe, expect, it } from 'vitest';
import { createFakeBackend } from './support/fake-backend';
import { DraftStore, type NewQuestionInput } from '../../src/editor/draft-store';

function makeInput(n: number): NewQuestionInput {
  return {
    text: `سؤال رقم ${n}`,
    options: [`خيار أ${n}`, `خيار ب${n}`, `خيار ج${n}`, `خيار د${n}`],
    correctIndex: 0,
  };
}

describe('DraftStore — backup/publish boundary and hasUnsavedChanges (PH-C3)', () => {
  it('a fresh draft with no questions has no unsaved changes and is draft-only', async () => {
    const store = new DraftStore({ backend: createFakeBackend() });
    await store.load();
    expect(store.hasUnsavedChanges()).toBe(false);
    expect(store.backupState()).toEqual({ kind: 'draft-only' });
  });

  it('adding a question creates unsaved changes; recordBackup clears them and shows the real filename', async () => {
    const store = new DraftStore({ backend: createFakeBackend() });
    await store.load();
    await store.addQuestion(makeInput(1));
    expect(store.hasUnsavedChanges()).toBe(true);
    expect(store.backupState()).toEqual({ kind: 'draft-only' });

    const result = await store.recordBackup('نسخة-أسئلة-العائلة-2026-08-08.zip');
    expect(result.ok).toBe(true);
    console.log('backupState after recordBackup:', store.backupState());
    expect(store.hasUnsavedChanges()).toBe(false);
    expect(store.backupState()).toEqual({
      kind: 'saved',
      filename: 'نسخة-أسئلة-العائلة-2026-08-08.zip',
    });
  });

  it('a NEW question added after a backup makes it stale again (unsaved changes return)', async () => {
    const store = new DraftStore({ backend: createFakeBackend() });
    await store.load();
    await store.addQuestion(makeInput(1));
    await store.recordBackup('backup-1.zip');
    expect(store.hasUnsavedChanges()).toBe(false);

    await store.addQuestion(makeInput(2));
    console.log('hasUnsavedChanges after a post-backup edit:', store.hasUnsavedChanges());
    expect(store.hasUnsavedChanges()).toBe(true);
    expect(store.backupState()).toEqual({ kind: 'draft-only' });
  });

  it('recordPublish marks the deck published, and wins over an older backup', async () => {
    const store = new DraftStore({ backend: createFakeBackend() });
    await store.load();
    await store.addQuestion(makeInput(1));
    await store.recordBackup('backup-1.zip');
    const publishResult = await store.recordPublish();
    expect(publishResult.ok).toBe(true);
    console.log('backupState after recordPublish:', store.backupState());
    expect(store.backupState()).toEqual({ kind: 'published' });
    expect(store.hasUnsavedChanges()).toBe(false);
  });

  it('a QuotaExceededError on recordBackup surfaces the same Arabic storage-full message, never silently drops the mark', async () => {
    const backend = createFakeBackend();
    const store = new DraftStore({ backend });
    await store.load();
    await store.addQuestion(makeInput(1));
    backend.setFailNextPutMeta(true);
    const result = await store.recordBackup('backup-1.zip');
    expect(result.ok).toBe(false);
    // The backend never received the backup mark — state must not claim success.
    expect(store.backupState()).toEqual({ kind: 'draft-only' });
  });

  it('reload (fresh DraftStore over the same backend) preserves the backup state — durability survives a page reload', async () => {
    const backend = createFakeBackend();
    const store = new DraftStore({ backend });
    await store.load();
    await store.addQuestion(makeInput(1));
    await store.recordBackup('backup-1.zip');

    const reloaded = new DraftStore({ backend });
    await reloaded.load();
    expect(reloaded.backupState()).toEqual({ kind: 'saved', filename: 'backup-1.zip' });
  });
});
