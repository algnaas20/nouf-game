/**
 * D2-4: the five export-time checks, each with a passing AND a failing
 * case — خطة.md PH-D2 AC4's literal list.
 */
import { describe, expect, it } from 'vitest';
import type { PackManifest } from '../../src/contracts';
import { MAX_FILES_PER_UPLOAD_BATCH, WEB_UPLOAD_MAX_FILE_BYTES } from '../../src/pack/constants';
import { validateExportFull, validateExportSync } from '../../src/pack/validate-export';

function baseManifest(): PackManifest {
  return {
    formatVersion: 1,
    title: 'اختبار',
    preparedAt: new Date().toISOString(),
    questions: [
      {
        id: 'q1',
        text: 'سؤال؟',
        options: ['أ', 'ب', 'ج', 'د'],
        correctIndex: 0,
        media: { kind: 'image', sha256: 'a'.repeat(64), ext: 'jpg' },
      },
    ],
    media: [{ sha256: 'a'.repeat(64), ext: 'jpg', bytes: 1000 }],
  };
}

describe('validateExportSync — check 1: no file > 25 MiB', () => {
  it('passes when every media blob is under the ceiling', () => {
    const manifest = baseManifest();
    const media = new Map([[manifest.media[0]!.sha256, new Blob([new Uint8Array(1000)])]]);
    const issues = validateExportSync(manifest, media);
    expect(issues.some((i) => i.code === 'file-too-large')).toBe(false);
  });

  it('fails when a media blob exceeds 25 MiB', () => {
    const manifest = baseManifest();
    const oversized = new Blob([new Uint8Array(WEB_UPLOAD_MAX_FILE_BYTES + 1)]);
    const media = new Map([[manifest.media[0]!.sha256, oversized]]);
    const issues = validateExportSync(manifest, media);
    expect(issues.filter((i) => i.code === 'file-too-large')).toHaveLength(1);
    expect(issues[0]!.severity).toBe('block');
  });
});

describe('validateExportSync — check 2: filename matches the content-addressed pattern', () => {
  it('passes for a well-formed sha256/ext pair', () => {
    const manifest = baseManifest();
    const media = new Map([[manifest.media[0]!.sha256, new Blob([new Uint8Array(10)])]]);
    expect(validateExportSync(manifest, media).some((i) => i.code === 'bad-filename')).toBe(false);
  });

  it('fails when the extension contains a character outside the allowed pattern (e.g. an unsanitised upload extension)', () => {
    const manifest = baseManifest();
    // contentAddressedFilename() lowercases both halves but does not strip
    // disallowed characters — a stray "#" (as could arrive from a
    // malformed upload extension) must still be caught here, at export
    // time, as defence in depth even though intake (WL-C) is expected to
    // never produce one.
    manifest.media[0]!.ext = 'jp#g';
    manifest.questions[0]!.media = { kind: 'image', sha256: manifest.media[0]!.sha256, ext: 'jp#g' };
    const media = new Map([[manifest.media[0]!.sha256, new Blob([new Uint8Array(10)])]]);
    const issues = validateExportSync(manifest, media);
    expect(issues.some((i) => i.code === 'bad-filename')).toBe(true);
  });
});

describe('validateExportSync — check 3: every manifest reference resolves to a present file', () => {
  it('passes when every question media sha256 is in manifest.media', () => {
    const manifest = baseManifest();
    const media = new Map([[manifest.media[0]!.sha256, new Blob([new Uint8Array(10)])]]);
    expect(validateExportSync(manifest, media).some((i) => i.code === 'orphan-reference')).toBe(false);
  });

  it('fails when a question references a sha256 absent from manifest.media, naming the question number', () => {
    const manifest = baseManifest();
    manifest.questions[0]!.media = { kind: 'image', sha256: 'b'.repeat(64), ext: 'jpg' };
    const media = new Map<string, Blob>();
    const issues = validateExportSync(manifest, media);
    const orphan = issues.find((i) => i.code === 'orphan-reference');
    expect(orphan).toBeDefined();
    expect(orphan!.message).toContain('1'); // question #1
  });
});

describe('validateExportHashes (via validateExportFull) — check 4: every SHA-256 matches', () => {
  it('passes when the blob actually hashes to the manifest value', async () => {
    const manifest = baseManifest();
    const bytes = new TextEncoder().encode('real content');
    const sha = await crypto.subtle.digest('SHA-256', bytes);
    const hex = Array.from(new Uint8Array(sha))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    manifest.media[0]!.sha256 = hex;
    manifest.questions[0]!.media = { kind: 'image', sha256: hex, ext: 'jpg' };
    const media = new Map([[hex, new Blob([bytes])]]);
    const issues = await validateExportFull(manifest, media);
    expect(issues.some((i) => i.code === 'hash-mismatch')).toBe(false);
  });

  it('fails when the blob bytes do not match the manifest-declared sha256 (a corrupted or swapped file)', async () => {
    const manifest = baseManifest();
    const media = new Map([[manifest.media[0]!.sha256, new Blob([new TextEncoder().encode('wrong content')])]]);
    const issues = await validateExportFull(manifest, media);
    expect(issues.some((i) => i.code === 'hash-mismatch')).toBe(true);
  });
});

describe('validateExportSync — check 5: media count vs. the 100-files-per-batch cap', () => {
  it('is absent (no warning) at or under the cap', () => {
    const manifest = baseManifest();
    manifest.media = Array.from({ length: MAX_FILES_PER_UPLOAD_BATCH }, (_, i) => ({
      sha256: i.toString(16).padStart(64, '0'),
      ext: 'jpg',
      bytes: 10,
    }));
    manifest.questions = [];
    const issues = validateExportSync(manifest, new Map());
    expect(issues.some((i) => i.code === 'too-many-files')).toBe(false);
  });

  it('warns (never blocks) once media count exceeds the cap', () => {
    const manifest = baseManifest();
    manifest.media = Array.from({ length: MAX_FILES_PER_UPLOAD_BATCH + 1 }, (_, i) => ({
      sha256: i.toString(16).padStart(64, '0'),
      ext: 'jpg',
      bytes: 10,
    }));
    manifest.questions = [];
    const issues = validateExportSync(manifest, new Map());
    const warning = issues.find((i) => i.code === 'too-many-files');
    expect(warning).toBeDefined();
    expect(warning!.severity).toBe('warn'); // never blocks export
    console.log('D2-4 check 5 message:', warning!.message);
  });
});
