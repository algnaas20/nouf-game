/**
 * CRC-32 (the ordinary zip/PNG polynomial, 0xEDB88320), computed from a
 * `Blob`'s bytes in bounded-size sequential reads.
 *
 * Why `Blob.slice()` in a loop rather than `blob.stream().getReader()`:
 * the media-storage report's exact words are "stream each blob through
 * `blob.stream()` in 1 MB chunks" — but the *stream's own* chunk size is
 * implementation-defined (a real browser may hand back arbitrarily large or
 * small pieces for a disk-backed Blob; Node's Blob/File polyfill used by
 * Vitest's unit tests hands back the whole buffer in one chunk). Slicing
 * ourselves makes the 1 MB bound an actual, portable guarantee we can prove
 * in a plain Node test, not a hope about a particular engine's stream
 * implementation. Each `.slice()` is itself zero-copy (a view), so only the
 * chunk actually being hashed is ever materialised as bytes.
 */

const CRC32_TABLE = buildTable();

function buildTable(): Uint32Array {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
}

/** Incremental update — `crc` is the running (not-yet-inverted) register;
 *  callers start at `0xFFFFFFFF` and invert (`^ 0xFFFFFFFF`) only once, at
 *  the very end, per the standard CRC-32 algorithm. Exported so a writer
 *  that already has bytes in hand (e.g. the tiny `questions.json` entry)
 *  need not go through the Blob-slicing path for a few kilobytes. */
export function crc32Update(crc: number, chunk: Uint8Array): number {
  let c = crc;
  for (let i = 0; i < chunk.length; i += 1) {
    const tableEntry = CRC32_TABLE[(c ^ chunk[i]!) & 0xff]!;
    c = tableEntry ^ (c >>> 8);
  }
  return c >>> 0;
}

/** One-shot CRC-32 of an in-memory buffer (small inputs — `questions.json`,
 *  test fixtures). */
export function crc32OfBytes(bytes: Uint8Array): number {
  return (crc32Update(0xffffffff, bytes) ^ 0xffffffff) >>> 0;
}

export interface Crc32StreamOptions {
  chunkBytes?: number;
  /** Fired after each chunk is processed — the memory/streaming proof hooks
   *  in here to record chunk sizes without needing to reach into the
   *  function's internals. */
  onChunk?: (chunkLength: number, offset: number, total: number) => void;
}

/** Streams a `Blob`'s bytes through CRC-32 in bounded chunks (default 1 MB —
 *  `CRC_STREAM_CHUNK_BYTES`). Peak memory for this function is one chunk's
 *  `ArrayBuffer`, regardless of `blob.size` — the earlier chunk becomes
 *  garbage as soon as the next `.slice().arrayBuffer()` is awaited. */
export async function crc32OfBlob(blob: Blob, options: Crc32StreamOptions = {}): Promise<number> {
  const chunkBytes = options.chunkBytes ?? 1024 * 1024;
  let crc = 0xffffffff;
  let offset = 0;
  const total = blob.size;
  while (offset < total) {
    const end = Math.min(offset + chunkBytes, total);
    const buffer = await blob.slice(offset, end).arrayBuffer();
    const chunk = new Uint8Array(buffer);
    crc = crc32Update(crc, chunk);
    options.onChunk?.(chunk.length, offset, total);
    offset = end;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
