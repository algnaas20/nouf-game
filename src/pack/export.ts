/**
 * Builds the ZIP `Blob` for a given `PackManifest` + media map — the exact
 * `questions.json` + `m/<sha256-12>.<ext>` layout §7.1/§10.1 of
 * media-storage-investigation.md specify, shared by both "صدّر للنشر"
 * (`exportForPublishing`) and "احفظ نسخة على جهازك" (`save-to-device.ts`).
 * One writer, two callers — see worklog-D2.md design decision 2.
 */

import type { PackManifest } from '../contracts';
import { validateForPublish } from '../editor/validate';
import type { DraftStore } from '../editor/draft-store';
import { contentAddressedFilename } from '../media/hash';
import { MANIFEST_ENTRY_NAME, MEDIA_ENTRY_DIR } from './constants';
import { buildPackFromDraft } from './from-draft';
import { validateExportFull, type ExportIssue } from './validate-export';
import { writeZip, type ZipEntryInput } from './zip-writer';

/** Pure assembly — throws only on programmer error (a manifest referencing
 *  a `sha256` absent from `media`, which `validateExportFull`/
 *  `buildPackFromDraft` are responsible for catching before this is ever
 *  called with untrusted input). */
export async function exportPack(manifest: PackManifest, media: ReadonlyMap<string, Blob>): Promise<Blob> {
  const entries: ZipEntryInput[] = [];
  const manifestJson = JSON.stringify(manifest);
  entries.push({
    name: MANIFEST_ENTRY_NAME,
    data: new Blob([manifestJson], { type: 'application/json' }),
  });

  for (const entry of manifest.media) {
    const blob = media.get(entry.sha256);
    if (!blob) {
      throw new Error(
        `exportPack: manifest references media sha256=${entry.sha256} with no matching blob — caller must validate before exporting`,
      );
    }
    const filename = contentAddressedFilename(entry.sha256, entry.ext);
    entries.push({ name: `${MEDIA_ENTRY_DIR}/${filename}`, data: blob });
  }

  const { blob } = await writeZip(entries);
  return blob;
}

export type PublishExportResult =
  | { ok: true; blob: Blob; manifest: PackManifest }
  | { ok: false; blockingMessages: string[] };

/**
 * The full "صدّر للنشر" pipeline: readiness gate (every question must be
 * «جاهز» — PH-C1 AC5's existing rule, reused via `validateForPublish`, not
 * reinvented) → build the manifest → the five export-time checks → write
 * the zip. Refuses **entirely** (no partial pack) the moment any check
 * fails — never a half-published game.
 */
export async function exportForPublishing(store: DraftStore, title: string): Promise<PublishExportResult> {
  const readiness = validateForPublish(store.getState().questions);
  if (!readiness.ok) return { ok: false, blockingMessages: readiness.blockingMessages };

  const { manifest, media } = await buildPackFromDraft(store, title);
  const issues: ExportIssue[] = await validateExportFull(manifest, media);
  const blocking = issues.filter((issue) => issue.severity === 'block');
  if (blocking.length > 0) {
    return { ok: false, blockingMessages: blocking.map((issue) => issue.message) };
  }

  const blob = await exportPack(manifest, media);
  return { ok: true, blob, manifest };
}
