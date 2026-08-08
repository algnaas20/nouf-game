/**
 * PH-C3 — the 100-files-per-upload-batch warning (dispatch: "A host who
 * uploads 100 of 126 files and stops gets a game with silently missing
 * images and no error. Warn up front."). Pure-logic tests for
 * `countDistinctMediaFiles` (deduplicated by sha256, exactly how the real
 * export would count files); the DOM-rendering half is proven live in
 * PH-C3's browser script.
 */
import { describe, expect, it } from 'vitest';
import { countDistinctMediaFiles, UPLOAD_BATCH_FILE_LIMIT } from '../../src/editor/ui/media-batch-warning';
import type { DraftQuestion } from '../../src/storage/idb';

function makeQuestion(id: string, media: DraftQuestion['media']): DraftQuestion {
  return {
    id,
    text: `q-${id}`,
    options: ['a', 'b', 'c', 'd'],
    correctIndex: 0,
    media,
    order: 0,
  };
}

describe('countDistinctMediaFiles', () => {
  it('the real limit is 100, matching the report\'s stated GitHub web-uploader cap', () => {
    expect(UPLOAD_BATCH_FILE_LIMIT).toBe(100);
  });

  it('counts each distinct sha256 once, ignoring text-only questions', () => {
    const questions: DraftQuestion[] = [
      makeQuestion('1', { kind: 'none' }),
      makeQuestion('2', { kind: 'image', sha256: 'a'.repeat(64), ext: 'jpg' }),
      makeQuestion('3', { kind: 'audio', sha256: 'b'.repeat(64), ext: 'mp3' }),
      makeQuestion('4', { kind: 'none' }),
    ];
    expect(countDistinctMediaFiles({ questions })).toBe(2);
  });

  it('deduplicates the SAME media reused across multiple questions (content-addressed) — the real export writes one file, not one per question', () => {
    const sharedSha = 'c'.repeat(64);
    const questions: DraftQuestion[] = [
      makeQuestion('1', { kind: 'image', sha256: sharedSha, ext: 'jpg' }),
      makeQuestion('2', { kind: 'image', sha256: sharedSha, ext: 'jpg' }),
      makeQuestion('3', { kind: 'image', sha256: sharedSha, ext: 'jpg' }),
    ];
    console.log('AC6 (dedup) — 3 questions sharing 1 photo → distinct file count:', countDistinctMediaFiles({ questions }));
    expect(countDistinctMediaFiles({ questions })).toBe(1);
  });

  it('126 media-bearing questions (all distinct) → 126 distinct files, over the 100 limit', () => {
    const questions: DraftQuestion[] = Array.from({ length: 126 }, (_, i) =>
      makeQuestion(String(i), { kind: 'image', sha256: i.toString(16).padStart(64, '0'), ext: 'jpg' }),
    );
    const count = countDistinctMediaFiles({ questions });
    console.log('126 distinct media files counted:', count);
    expect(count).toBe(126);
    expect(count).toBeGreaterThan(UPLOAD_BATCH_FILE_LIMIT);
  });
});
