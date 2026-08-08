/**
 * Writes an already-parsed `ImportedPack` into a `DraftStore` — the "استبدل"
 * side of the literal Appendix-أ confirm dialog (`copy.ts`'s
 * `importConfirmMessage`). Only ever called after the host has confirmed
 * the replacement; this module performs the replacement, it does not ask.
 *
 * Goes through `DraftStore.addQuestion()` exactly like the editor's own UI
 * would — never touches `src/storage/idb.ts` directly — so an imported
 * question is indistinguishable, once written, from one typed in by hand
 * (same guarded-write quota handling, same media dedup-by-sha256 behaviour).
 */

import type { DraftStore } from '../editor/draft-store';
import type { ImportedPack } from './import';

export interface ApplyImportSummary {
  questionCount: number;
  /** Distinct media files written (deduplicated by sha256 — matches how
   *  the manifest itself counts media, `manifest.media.length`). */
  mediaCount: number;
}

export class ApplyImportError extends Error {
  constructor(
    message: string,
    readonly questionIndex: number,
  ) {
    super(message);
    this.name = 'ApplyImportError';
  }
}

export async function applyImportedPackToDraft(
  store: DraftStore,
  imported: ImportedPack,
): Promise<ApplyImportSummary> {
  await store.discardDraft();

  const seenMedia = new Set<string>();
  let mediaCount = 0;

  for (let i = 0; i < imported.manifest.questions.length; i += 1) {
    const question = imported.manifest.questions[i]!;
    let mediaBlob: Blob | undefined;
    if (question.media.kind !== 'none') {
      mediaBlob = await imported.getMediaBlob(question.media.sha256);
      if (!seenMedia.has(question.media.sha256)) {
        seenMedia.add(question.media.sha256);
        mediaCount += 1;
      }
    }

    const result = await store.addQuestion({
      text: question.text,
      options: question.options,
      correctIndex: question.correctIndex,
      media: question.media,
      mediaBlob,
      category: question.category,
      difficulty: question.difficulty,
    });

    if (!result.ok) {
      throw new ApplyImportError(result.storageFullMessage, i);
    }
  }

  return { questionCount: imported.manifest.questions.length, mediaCount };
}
