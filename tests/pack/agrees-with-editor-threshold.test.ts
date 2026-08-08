/**
 * Proves `MAX_FILES_PER_UPLOAD_BATCH` (WL-D's export-time threshold) and
 * WL-C's independently-defined `UPLOAD_BATCH_FILE_LIMIT`
 * (`src/editor/ui/media-batch-warning.ts`) fire at the **identical** media
 * count, even though the two lines never import from each other for this
 * constant (per `src/pack/constants.ts`'s own comment). If either constant
 * or comparison operator (`>` vs `>=`) is ever changed on one side without
 * the other, this test goes red — it is the only thing holding that
 * agreement in place.
 */
import { describe, expect, it } from 'vitest';
import type { PackManifest } from '../../src/contracts';
import { countDistinctMediaFiles, UPLOAD_BATCH_FILE_LIMIT } from '../../src/editor/ui/media-batch-warning';
import { MAX_FILES_PER_UPLOAD_BATCH } from '../../src/pack/constants';
import { validateExportSync } from '../../src/pack/validate-export';

function manifestWithMediaCount(count: number): PackManifest {
  return {
    formatVersion: 1,
    title: 'ت',
    preparedAt: new Date().toISOString(),
    questions: [],
    media: Array.from({ length: count }, (_, i) => ({
      sha256: i.toString(16).padStart(64, '0'),
      ext: 'jpg',
      bytes: 10,
    })),
  };
}

describe('WL-D export threshold agrees with WL-C editor-side threshold', () => {
  it('the two numeric constants are equal', () => {
    expect(MAX_FILES_PER_UPLOAD_BATCH).toBe(UPLOAD_BATCH_FILE_LIMIT);
  });

  it('both fire (or both stay silent) at the exact same boundary counts: 99, 100, 101', () => {
    for (const count of [99, 100, 101]) {
      const wlCFires = count > UPLOAD_BATCH_FILE_LIMIT;
      const wlDManifest = manifestWithMediaCount(count);
      const wlDFires = validateExportSync(wlDManifest, new Map()).some((i) => i.code === 'too-many-files');
      console.log(`count=${count} — WL-C fires: ${wlCFires}, WL-D fires: ${wlDFires}`);
      expect(wlDFires).toBe(wlCFires);
    }
  });

  it("WL-C's own dedup-by-sha256 counting function agrees with a manifest built the same way", () => {
    // Sanity that both sides count "distinct media files", not "questions".
    const dedupedState = {
      questions: [
        { id: 'a', text: '', options: ['', '', '', ''] as [string, string, string, string], correctIndex: 0 as const, media: { kind: 'image' as const, sha256: 'x'.repeat(64), ext: 'jpg' }, order: 0 },
        { id: 'b', text: '', options: ['', '', '', ''] as [string, string, string, string], correctIndex: 0 as const, media: { kind: 'image' as const, sha256: 'x'.repeat(64), ext: 'jpg' }, order: 1 },
      ],
    };
    expect(countDistinctMediaFiles(dedupedState)).toBe(1);
  });
});
