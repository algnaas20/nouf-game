/**
 * Real in-browser logic for tests/pack/live/pack-roundtrip.ts — served by
 * Vite and `import()`-ed **from inside the page**, never run through tsx's
 * transpilation (see docs/بروتوكولات/tsx-playwright-page-evaluate.md — the
 * exact same discipline WL-C established for tests/editor/live/**).
 */

import type { DraftStore } from '../../../src/editor/draft-store';
import { hashAndName } from '../../../src/media/hash';
import { buildPackFromDraft } from '../../../src/pack/from-draft';
import { exportPack } from '../../../src/pack/export';
import { importPack, type ImportedPack } from '../../../src/pack/import';
import { applyImportedPackToDraft } from '../../../src/pack/apply-import';
import { saveBackupToDevice } from '../../../src/pack/save-to-device';

function makeCanvasImageBlob(seed: number): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d context');
  ctx.fillStyle = `rgb(${(seed * 37) % 255}, ${(seed * 71) % 255}, ${(seed * 113) % 255})`;
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(seed % 40, seed % 40, 10, 10);
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/jpeg', 0.9);
  });
}

export interface FixtureQuestionSummary {
  text: string;
  options: [string, string, string, string];
  correctIndex: number;
  mediaKind: 'none' | 'image';
  mediaSha256: string | null;
}

/** Adds `count` questions to the real store (real IndexedDB), every third
 *  one carrying a real, correctly-hashed image blob — mirrors how the real
 *  editor pipeline (media/process.ts) always hashes the actual processed
 *  bytes before calling addQuestion, so this fixture never manufactures an
 *  inconsistent (sha256, blob) pair. Returns a summary Node can compare
 *  against post-import state. */
export async function addFixtureQuestions(store: DraftStore, count: number): Promise<FixtureQuestionSummary[]> {
  const summaries: FixtureQuestionSummary[] = [];
  for (let i = 1; i <= count; i += 1) {
    const withMedia = i % 3 === 0;
    const options: [string, string, string, string] = [
      `خيار أ${i}`,
      `خيار ب${i}`,
      `خيار ج${i}`,
      `خيار د${i}`,
    ];
    const correctIndex = (i % 4) as 0 | 1 | 2 | 3;
    if (withMedia) {
      const blob = await makeCanvasImageBlob(i);
      const { sha256 } = await hashAndName(blob, 'jpg');
      const result = await store.addQuestion({
        text: `سؤال حي رقم ${i}`,
        options,
        correctIndex,
        media: { kind: 'image', sha256, ext: 'jpg' },
        mediaBlob: blob,
      });
      if (!result.ok) throw new Error(`addQuestion failed at ${i}: ${result.storageFullMessage}`);
      summaries.push({ text: `سؤال حي رقم ${i}`, options, correctIndex, mediaKind: 'image', mediaSha256: sha256 });
    } else {
      const result = await store.addQuestion({ text: `سؤال حي رقم ${i}`, options, correctIndex });
      if (!result.ok) throw new Error(`addQuestion failed at ${i}: ${result.storageFullMessage}`);
      summaries.push({ text: `سؤال حي رقم ${i}`, options, correctIndex, mediaKind: 'none', mediaSha256: null });
    }
  }
  return summaries;
}

/** Runs the REAL `saveBackupToDevice` pipeline (build → zip → write to
 *  device). In headless Chromium `showSaveFilePicker` is absent, so this
 *  exercises the universal anchor-download fallback for real — Playwright's
 *  `page.on('download')` captures the resulting file. */
export async function triggerRealBackupDownload(
  store: DraftStore,
  title: string,
): Promise<{ filename: string; skippedQuestionNumbers: number[] } | null> {
  return saveBackupToDevice(store, title);
}

export interface ImportComparisonResult {
  questionCount: number;
  mediaCount: number;
  summaries: FixtureQuestionSummary[];
  verifyAllMediaOk: boolean;
  verifyAllMediaCount: number;
}

/** Runs the real `importPack` + `applyImportedPackToDraft` pipeline against
 *  a `File` picked via a real `<input type=file>` (i.e. genuinely loaded
 *  from disk by the browser, not handed in as an in-memory Blob the test
 *  already had lying around), and returns a summary Node compares to the
 *  pre-wipe fixture data. */
export async function importFileIntoStore(store: DraftStore, file: File): Promise<ImportComparisonResult> {
  const imported: ImportedPack = await importPack(file);
  const summary = await applyImportedPackToDraft(store, imported);
  const verifyResults = await imported.verifyAllMedia();

  const state = store.getState();
  const summaries: FixtureQuestionSummary[] = state.questions.map((q) => ({
    text: q.text,
    options: q.options,
    correctIndex: q.correctIndex ?? -1,
    mediaKind: q.media.kind === 'none' ? 'none' : 'image',
    mediaSha256: q.media.kind === 'none' ? null : q.media.sha256,
  }));

  return {
    questionCount: summary.questionCount,
    mediaCount: summary.mediaCount,
    summaries,
    verifyAllMediaOk: verifyResults.every((v) => v.ok),
    verifyAllMediaCount: verifyResults.length,
  };
}

/** Direct pack build+export, exposed for a secondary in-page sanity check
 *  (not the download path) — e.g. to print pack size. */
export async function buildAndExportForInspection(store: DraftStore, title: string): Promise<{ size: number }> {
  const { manifest, media } = await buildPackFromDraft(store, title);
  const blob = await exportPack(manifest, media);
  return { size: blob.size };
}
