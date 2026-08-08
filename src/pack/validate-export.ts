/**
 * The five export-time checks — media-storage-investigation.md §7.3, and
 * خطة.md PH-D2 AC4's literal list: "لا ملف > 25 MiB · كل اسم مطابق للنمط ·
 * كل مرجع في البيان له ملف · كل SHA-256 مطابق · وإذا تجاوز عدد الملفات ١٠٠
 * تُقسَّم الدفعة أو تُعرض الجملة صراحة". All cheap, all prevent a broken
 * site rather than a debugging session in front of guests.
 *
 * The first four are `severity: 'block'` (an export that fails them would
 * publish a broken game). The fifth (`too-many-files`) is `severity: 'warn'`
 * — §8.3's own ruling is "it is not a failure — it is one extra drag-and-
 * drop — but the export screen must say so up front", i.e. inform, don't
 * block.
 */

import type { PackManifest } from '../contracts';
import { contentAddressedFilename, isValidMediaFilename, sha256Hex } from '../media/hash';
import { MAX_FILES_PER_UPLOAD_BATCH, WEB_UPLOAD_MAX_FILE_BYTES } from './constants';
import { AR_PACK_COPY, mediaCountBatchWarning } from './copy';

export type ExportIssueCode =
  | 'file-too-large'
  | 'bad-filename'
  | 'orphan-reference'
  | 'hash-mismatch'
  | 'too-many-files';

export interface ExportIssue {
  code: ExportIssueCode;
  severity: 'block' | 'warn';
  /** Calm Arabic sentence — constraint row 17: technical detail never
   *  reaches this field. */
  message: string;
  /** Hidden, copyable technical detail — the same row 17's other half. */
  detail: string;
}

/** Checks 1–3 (size, filename shape, orphan references) plus 5 (batch
 *  count) — everything that does not require reading media bytes. Check 4
 *  (SHA-256 match) is necessarily async and lives in
 *  `validateExportHashes` below; `validateExportFull` runs both. Exported
 *  separately because #1–3/#5 are useful synchronously (e.g. to disable an
 *  "export" button the instant the deck changes, with no network/IO wait). */
export function validateExportSync(manifest: PackManifest, media: ReadonlyMap<string, Blob>): ExportIssue[] {
  const issues: ExportIssue[] = [];

  for (const entry of manifest.media) {
    const blob = media.get(entry.sha256);
    const filename = contentAddressedFilename(entry.sha256, entry.ext);

    if (blob && blob.size > WEB_UPLOAD_MAX_FILE_BYTES) {
      issues.push({
        code: 'file-too-large',
        severity: 'block',
        message: AR_PACK_COPY.fileTooLarge,
        detail: `m/${filename} = ${blob.size} bytes > ${WEB_UPLOAD_MAX_FILE_BYTES} (25 MiB)`,
      });
    }

    if (!isValidMediaFilename(filename)) {
      issues.push({
        code: 'bad-filename',
        severity: 'block',
        message: AR_PACK_COPY.badFilename,
        detail: `"${filename}" does not match ^[a-z0-9-]+\\.[a-z0-9]+$`,
      });
    }
  }

  const mediaShas = new Set(manifest.media.map((entry) => entry.sha256));
  manifest.questions.forEach((question, index) => {
    if (question.media.kind !== 'none' && !mediaShas.has(question.media.sha256)) {
      issues.push({
        code: 'orphan-reference',
        severity: 'block',
        message: AR_PACK_COPY.orphanReference(index + 1),
        detail: `question[${index}] (id=${question.id}) references sha256=${question.media.sha256}, absent from manifest.media`,
      });
    }
  });

  if (manifest.media.length > MAX_FILES_PER_UPLOAD_BATCH) {
    issues.push({
      code: 'too-many-files',
      severity: 'warn',
      message: mediaCountBatchWarning(manifest.media.length),
      detail: `${manifest.media.length} media files > ${MAX_FILES_PER_UPLOAD_BATCH} per web-upload batch`,
    });
  }

  return issues;
}

/** Check 4 — every file's SHA-256 matches its manifest value. Necessarily
 *  reads every media blob's bytes (there is no way to verify a hash
 *  without hashing), so this is export-time only — never run as part of
 *  import's "ready" step (D2-3). */
export async function validateExportHashes(
  manifest: PackManifest,
  media: ReadonlyMap<string, Blob>,
): Promise<ExportIssue[]> {
  const issues: ExportIssue[] = [];
  for (const entry of manifest.media) {
    const blob = media.get(entry.sha256);
    if (!blob) continue; // caught as `orphan-reference` by the sync pass
    const actual = await sha256Hex(blob);
    if (actual !== entry.sha256) {
      issues.push({
        code: 'hash-mismatch',
        severity: 'block',
        message: AR_PACK_COPY.hashMismatch,
        detail: `manifest says sha256=${entry.sha256}, actual bytes hash to ${actual}`,
      });
    }
  }
  return issues;
}

export async function validateExportFull(
  manifest: PackManifest,
  media: ReadonlyMap<string, Blob>,
): Promise<ExportIssue[]> {
  const sync = validateExportSync(manifest, media);
  const hashes = await validateExportHashes(manifest, media);
  return [...sync, ...hashes];
}
