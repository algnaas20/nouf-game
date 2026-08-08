/**
 * Bridges WL-C's authoring draft (`DraftStore`) to the frozen `PackManifest`
 * shape everyone else agrees on. Reads only `DraftStore`'s public API —
 * never reaches into `src/storage/idb.ts` directly, and never writes to
 * either (`src/editor/**`/`src/storage/**` stay WL-C's).
 *
 * Readiness gating differs by caller (§ design decision 3 in worklog-D2.md):
 * `buildPackFromDraft` itself never blocks — it always builds the best
 * valid pack it can from whatever is ready right now, and *reports* which
 * questions were skipped (0-based skip list, 1-based question numbers in
 * the message text, matching PH-C1's own numbering convention). Callers
 * decide what "skipped > 0" means for them: `exportForPublishing` in
 * `export.ts` treats any skip as a hard block (before ever calling this),
 * `saveBackupToDevice` in `save-to-device.ts` proceeds and surfaces the
 * warning instead.
 */

import type { OptionIndex, PackManifest, PackMediaEntry, Question } from '../contracts';
import type { DraftQuestion } from '../storage/idb';
import type { DraftStore } from '../editor/draft-store';
import { isQuestionReady } from '../editor/validate';
import { PACK_FORMAT_VERSION } from './constants';

export interface BuildPackFromDraftResult {
  manifest: PackManifest;
  /** `sha256 -> blob`, one entry per distinct media file actually
   *  referenced by an included question (deduplicated — the same media
   *  reused across questions is stored once, matching the manifest's own
   *  `media[]` list and `src/editor/ui/media-batch-warning.ts`'s counting
   *  rule). */
  media: Map<string, Blob>;
  /** 1-based, on-screen question numbers that were left out because they
   *  are not yet «جاهز» (no marked correct option). Empty when every
   *  question in the draft is ready. */
  skippedQuestionNumbers: number[];
}

function toFrozenQuestion(draft: DraftQuestion): Question {
  if (draft.correctIndex === null) {
    throw new Error('toFrozenQuestion called on a not-ready question — caller must filter first');
  }
  return {
    id: draft.id,
    text: draft.text,
    options: draft.options,
    correctIndex: draft.correctIndex as OptionIndex,
    media: draft.media,
    category: draft.category,
    difficulty: draft.difficulty,
  };
}

export async function buildPackFromDraft(store: DraftStore, title: string): Promise<BuildPackFromDraftResult> {
  const draftQuestions = store.getState().questions;
  const skippedQuestionNumbers: number[] = [];
  const questions: Question[] = [];

  draftQuestions.forEach((draft, index) => {
    if (!isQuestionReady(draft)) {
      skippedQuestionNumbers.push(index + 1);
      return;
    }
    questions.push(toFrozenQuestion(draft));
  });

  const mediaShas = new Set<string>();
  for (const question of questions) {
    if (question.media.kind !== 'none') mediaShas.add(question.media.sha256);
  }

  const media = new Map<string, Blob>();
  const mediaEntries: PackMediaEntry[] = [];
  for (const sha256 of mediaShas) {
    const blob = await store.getMediaBlob(sha256);
    if (!blob) continue; // defensive: a question referenced a sha256 the media store never got — surfaces as an orphan-reference at validation, not silently here
    const owningQuestion = questions.find((q) => q.media.kind !== 'none' && q.media.sha256 === sha256);
    const ext = owningQuestion && owningQuestion.media.kind !== 'none' ? owningQuestion.media.ext : '';
    media.set(sha256, blob);
    mediaEntries.push({ sha256, ext, bytes: blob.size });
  }

  const manifest: PackManifest = {
    formatVersion: PACK_FORMAT_VERSION,
    title,
    preparedAt: new Date().toISOString(),
    questions,
    media: mediaEntries,
  };

  return { manifest, media, skippedQuestionNumbers };
}
