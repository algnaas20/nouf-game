/**
 * D2-5: formatVersion rejection — "hard refusal, no partial load." Also
 * covers the two other "not a valid pack" refusal paths (missing manifest,
 * a media entry compressed instead of STORED) — same discipline: refuse
 * fully, never a partial import.
 */
import { describe, expect, it } from 'vitest';
import type { PackManifest } from '../../src/contracts';
import { exportPack } from '../../src/pack/export';
import { PACK_FORMAT_VERSION } from '../../src/pack/constants';
import { importPack, PackFormatError } from '../../src/pack/import';
import { writeZip } from '../../src/pack/zip-writer';

function baseManifest(overrides: Partial<PackManifest> = {}): PackManifest {
  return {
    formatVersion: PACK_FORMAT_VERSION,
    title: 'حزمة اختبار',
    preparedAt: new Date().toISOString(),
    questions: [],
    media: [],
    ...overrides,
  };
}

describe('importPack — the happy path', () => {
  it('reads back a manifest built by exportPack with no questions/media', async () => {
    const manifest = baseManifest({ title: 'فارغة' });
    const blob = await exportPack(manifest, new Map());
    const imported = await importPack(blob);
    expect(imported.manifest.title).toBe('فارغة');
    expect(imported.manifest.questions).toEqual([]);
  });
});

describe('importPack — D2-5: formatVersion too high ⟶ hard refusal, no partial load', () => {
  it('throws PackFormatError and never returns a manifest', async () => {
    const manifest = baseManifest({ formatVersion: PACK_FORMAT_VERSION + 1 });
    const blob = await exportPack(manifest, new Map());
    await expect(importPack(blob)).rejects.toThrow(PackFormatError);
    try {
      await importPack(blob);
      expect.unreachable('importPack should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(PackFormatError);
      const formatErr = err as PackFormatError;
      console.log('D2-5 — userMessage:', formatErr.userMessage);
      console.log('D2-5 — detail:', formatErr.detail);
      expect(formatErr.userMessage).toBe('هذا الملف بصيغة أحدث من نسخة اللعبة الحالية — حدّث اللعبة أولاً.');
    }
  });

  it('a pack at exactly the supported formatVersion is accepted (boundary case)', async () => {
    const manifest = baseManifest({ formatVersion: PACK_FORMAT_VERSION });
    const blob = await exportPack(manifest, new Map());
    await expect(importPack(blob)).resolves.toBeDefined();
  });
});

describe('importPack — not a valid pack at all', () => {
  it('refuses a zip with no questions.json entry', async () => {
    const { blob } = await writeZip([{ name: 'unrelated.txt', data: new Blob(['x']) }]);
    await expect(importPack(blob)).rejects.toThrow(PackFormatError);
  });

  it('refuses a completely non-zip file', async () => {
    const notAZip = new Blob([new Uint8Array([1, 2, 3, 4, 5])]);
    await expect(importPack(notAZip)).rejects.toThrow(PackFormatError);
  });
});

describe('importPack — media entries must be STORED (method 0), never deflated', () => {
  it('refuses a pack whose media entry was written with a non-zero compression method (a foreign/malicious zip)', async () => {
    const manifest = baseManifest({
      questions: [
        {
          id: 'q1',
          text: 'س',
          options: ['أ', 'ب', 'ج', 'د'],
          correctIndex: 0,
          media: { kind: 'image', sha256: 'c'.repeat(64), ext: 'jpg' },
        },
      ],
      media: [{ sha256: 'c'.repeat(64), ext: 'jpg', bytes: 3 }],
    });
    const manifestBlob = new Blob([JSON.stringify(manifest)]);
    // Hand-build a zip whose media entry claims method=8 (deflate) by
    // writing it with the real writer, then flipping the on-the-wire byte —
    // this is the only way to produce a non-STORE entry, since writeZip()
    // itself cannot (constants.ts / zip-format.ts have no code path that
    // sets method to anything but 0).
    const { blob: cleanZip } = await writeZip([
      { name: 'questions.json', data: manifestBlob },
      { name: 'm/cccccccccccc.jpg', data: new Blob([new Uint8Array([9, 9, 9])]) },
    ]);
    const bytes = new Uint8Array(await cleanZip.arrayBuffer());
    // Local file header #2 starts right after header+data of entry #1.
    // Entry 1: name "questions.json" (14 chars) + data (manifestBlob.size).
    const entry1DataSize = manifestBlob.size;
    const entry1HeaderSize = 30 + 'questions.json'.length;
    const entry2LocalHeaderOffset = entry1HeaderSize + entry1DataSize;
    const methodFieldOffset = entry2LocalHeaderOffset + 8;
    // Also patch the matching central-directory copy of this entry's
    // method field so the reader's initial "is this entry STORE" check
    // (which reads from the central directory) sees the tampering too.
    const view = new DataView(bytes.buffer);
    expect(view.getUint32(entry2LocalHeaderOffset, true)).toBe(0x04034b50); // sanity: we found the right header
    view.setUint16(methodFieldOffset, 8, true); // local header: claim deflate
    // Find and patch the central directory entry for the same file.
    let cdSearch = entry2LocalHeaderOffset;
    let found = false;
    while (cdSearch < bytes.length - 4) {
      if (view.getUint32(cdSearch, true) === 0x02014b50) {
        const nameLen = view.getUint16(cdSearch + 28, true);
        const name = new TextDecoder().decode(bytes.subarray(cdSearch + 46, cdSearch + 46 + nameLen));
        if (name === 'm/cccccccccccc.jpg') {
          view.setUint16(cdSearch + 10, 8, true);
          found = true;
          break;
        }
      }
      cdSearch += 1;
    }
    expect(found).toBe(true);

    const tamperedZip = new Blob([bytes]);
    await expect(importPack(tamperedZip)).rejects.toThrow(PackFormatError);
  });
});
