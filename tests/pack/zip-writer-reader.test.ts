/**
 * ZIP writer/reader round trip, plus two independent (not self-comparing)
 * checks:
 *   1. **Raw byte inspection of the compression-method field**, parsed by
 *      hand in this test file — not via `zip-format.ts`'s own parser — so
 *      "media is STORED, never deflated" is proven against the actual bytes
 *      on the wire, not against our own reader agreeing with our own writer.
 *   2. **D2-1**: total pack size vs. sum of media bytes — the "≤ 64 KB
 *      overhead" claim, computed from real `Blob.size` numbers.
 * A stronger, real-tool cross-check (via .NET's `System.IO.Compression`)
 * is run separately and pasted into worklog-D2.md, since it needs a
 * PowerShell/.NET harness outside Vitest.
 */
import { describe, expect, it } from 'vitest';
import { readZip } from '../../src/pack/zip-reader';
import { writeZip } from '../../src/pack/zip-writer';

function textBlob(text: string): Blob {
  return new Blob([new TextEncoder().encode(text)], { type: 'text/plain' });
}

function randomBlob(size: number, seed: number): Blob {
  const bytes = new Uint8Array(size);
  let s = seed;
  for (let i = 0; i < size; i += 1) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    bytes[i] = s & 0xff;
  }
  return new Blob([bytes]);
}

describe('writeZip / readZip — round trip', () => {
  it('every written entry is read back byte-identical, and the central directory reports the correct count', async () => {
    const entries = [
      { name: 'questions.json', data: textBlob('{"hello":"عالم"}') },
      { name: 'm/aaaaaaaaaaaa.jpg', data: randomBlob(50_000, 1) },
      { name: 'm/bbbbbbbbbbbb.mp3', data: randomBlob(120_000, 2) },
    ];
    const { blob } = await writeZip(entries);
    const zip = await readZip(blob);

    expect(zip.entries.size).toBe(3);
    for (const entry of entries) {
      const readBack = await zip.getEntryBlob(entry.name);
      const [expectedBytes, actualBytes] = await Promise.all([
        entry.data.arrayBuffer(),
        readBack.arrayBuffer(),
      ]);
      expect(actualBytes.byteLength).toBe(expectedBytes.byteLength);
      expect(new Uint8Array(actualBytes)).toEqual(new Uint8Array(expectedBytes));
    }
  });

  it('an empty entry list still produces a valid, readable (empty) zip', async () => {
    const { blob } = await writeZip([]);
    const zip = await readZip(blob);
    expect(zip.entries.size).toBe(0);
  });

  it('a single very small entry round-trips (edge case: entry smaller than the CRC chunk size)', async () => {
    const { blob } = await writeZip([{ name: 'x.txt', data: textBlob('hi') }]);
    const zip = await readZip(blob);
    const back = await (await zip.getEntryBlob('x.txt')).text();
    expect(back).toBe('hi');
  });
});

describe('writeZip — media is STORED (method 0), proven by raw byte inspection independent of zip-format.ts', () => {
  it('the local file header compression-method field is 0 for every entry, read by hand from the wire bytes', async () => {
    const entries = [
      { name: 'questions.json', data: textBlob('{}') },
      { name: 'm/cccccccccccc.jpg', data: randomBlob(10_000, 3) },
    ];
    const { blob } = await writeZip(entries);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const view = new DataView(bytes.buffer);

    // Hand-rolled local-file-header walk — deliberately NOT importing
    // anything from src/pack/zip-format.ts, so this is an independent
    // reading of the produced bytes, not a self-comparison.
    let offset = 0;
    let localHeadersSeen = 0;
    while (offset < bytes.length) {
      const signature = view.getUint32(offset, true);
      if (signature !== 0x04034b50) break; // reached the central directory
      const method = view.getUint16(offset + 8, true);
      expect(method).toBe(0); // STORE — never 8 (deflate) or anything else
      const compressedSize = view.getUint32(offset + 18, true);
      const nameLength = view.getUint16(offset + 26, true);
      const extraLength = view.getUint16(offset + 28, true);
      offset += 30 + nameLength + extraLength + compressedSize;
      localHeadersSeen += 1;
    }
    expect(localHeadersSeen).toBe(entries.length);
  });
});

describe('writeZip — D2-1, size overhead vs. sum of media bytes', () => {
  it('total pack size minus the sum of entry bytes is within 64 KB (STORE has ~0% overhead)', async () => {
    const mediaSizes = [50_000, 250_000, 400_000, 1_500_000, 2_000_000];
    const entries = [
      { name: 'questions.json', data: textBlob(JSON.stringify({ some: 'manifest data'.repeat(50) })) },
      ...mediaSizes.map((size, i) => ({ name: `m/entry-${i}.bin`, data: randomBlob(size, i + 10) })),
    ];
    const sumOfMediaBytes = mediaSizes.reduce((a, b) => a + b, 0);
    const { blob } = await writeZip(entries);

    const overhead = blob.size - sumOfMediaBytes;
    console.log('D2-1 — sum of media bytes:', sumOfMediaBytes);
    console.log('D2-1 — total pack size:', blob.size);
    console.log('D2-1 — overhead (headers + manifest + central directory):', overhead);

    // The "≤64 KB" ceiling in خطة.md's AC1 is against total-vs-media-sum,
    // and is generous — our real per-entry header overhead is ~50-80 bytes
    // times a handful of entries, plus one small JSON manifest; nowhere
    // near 64 KB for this fixture. Asserting the real ceiling, not a
    // loosened one.
    expect(overhead).toBeGreaterThan(0); // headers/manifest do add *something*
    expect(overhead).toBeLessThanOrEqual(64 * 1024);
  });
});
