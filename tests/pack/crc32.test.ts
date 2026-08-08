/**
 * CRC-32 correctness against **externally known** test vectors (never
 * compared to a value produced by the same code under test — v3's
 * verification rule) — plus the streaming-chunk-bound proof D2-2 needs.
 */
import { describe, expect, it } from 'vitest';
import { crc32OfBlob, crc32OfBytes } from '../../src/pack/crc32';

describe('crc32OfBytes — known external vectors', () => {
  it('CRC-32 of the empty buffer is 0', () => {
    expect(crc32OfBytes(new Uint8Array(0))).toBe(0);
  });

  it('CRC-32("123456789") is the canonical check value 0xCBF43926 (published PKZIP/PNG test vector)', () => {
    const bytes = new TextEncoder().encode('123456789');
    expect(crc32OfBytes(bytes)).toBe(0xcbf43926);
  });

  it('CRC-32("The quick brown fox jumps over the lazy dog") matches the widely-published reference value 0x414FA339', () => {
    const bytes = new TextEncoder().encode('The quick brown fox jumps over the lazy dog');
    expect(crc32OfBytes(bytes)).toBe(0x414fa339);
  });
});

describe('crc32OfBlob — streaming matches the one-shot result, at multiple chunk sizes', () => {
  it('a multi-chunk blob (chunkBytes smaller than the data) hashes identically to a single-chunk read', async () => {
    const size = 5000;
    const bytes = new Uint8Array(size);
    for (let i = 0; i < size; i += 1) bytes[i] = (i * 37 + 11) & 0xff;
    const blob = new Blob([bytes]);

    const wholeInOneChunk = await crc32OfBlob(blob, { chunkBytes: size });
    const manyTinyChunks = await crc32OfBlob(blob, { chunkBytes: 173 }); // deliberately not a divisor of `size`
    const knownGood = crc32OfBytes(bytes);

    expect(wholeInOneChunk).toBe(knownGood);
    expect(manyTinyChunks).toBe(knownGood);
  });

  it('the empty blob hashes to 0 with no chunks processed', async () => {
    let chunkCount = 0;
    const result = await crc32OfBlob(new Blob([]), { onChunk: () => (chunkCount += 1) });
    expect(result).toBe(0);
    expect(chunkCount).toBe(0);
  });
});

describe('crc32OfBlob — D2-2, the streaming chunk-size proof', () => {
  it('processes a large blob in bounded chunks, never exceeding the configured chunk size, and the chunk count matches ceil(size/chunkBytes)', async () => {
    const chunkBytes = 1024 * 1024; // 1 MB — the report's own figure
    const totalSize = 8 * chunkBytes + 12345; // not an exact multiple, to also prove the remainder chunk
    // A real Blob of this size, but backed by a single small repeated
    // pattern via `Blob`'s own internal storage — constructing it does not
    // require holding `totalSize` bytes as one JS array literal.
    const piece = new Uint8Array(1024).fill(7);
    const parts: Uint8Array<ArrayBuffer>[] = [];
    let built = 0;
    while (built < totalSize) {
      const remaining = totalSize - built;
      if (remaining >= piece.length) {
        parts.push(piece);
        built += piece.length;
      } else {
        parts.push(piece.slice(0, remaining));
        built += remaining;
      }
    }
    const blob = new Blob(parts);
    expect(blob.size).toBe(totalSize);

    const observedChunkLengths: number[] = [];
    await crc32OfBlob(blob, { chunkBytes, onChunk: (len) => observedChunkLengths.push(len) });

    const expectedChunkCount = Math.ceil(totalSize / chunkBytes);
    console.log('D2-2 — chunkBytes:', chunkBytes, 'totalSize:', totalSize);
    console.log('D2-2 — expected chunk count:', expectedChunkCount, 'observed:', observedChunkLengths.length);
    console.log('D2-2 — max observed chunk length:', Math.max(...observedChunkLengths));

    expect(observedChunkLengths).toHaveLength(expectedChunkCount);
    for (const len of observedChunkLengths) {
      expect(len).toBeLessThanOrEqual(chunkBytes);
    }
    // Every chunk but the last is exactly chunkBytes; the last is the remainder.
    expect(observedChunkLengths.slice(0, -1).every((len) => len === chunkBytes)).toBe(true);
    expect(observedChunkLengths.at(-1)).toBe(totalSize % chunkBytes);
  });
});
