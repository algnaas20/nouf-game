/**
 * STORE-only ZIP writer. media-storage-investigation.md §10.1/§10.2:
 *
 *   "Media entries must be STORED, not deflated ... this is a correctness
 *   issue, not a size one: deflating already-compressed media buys 0–2%
 *   and makes lazy `file.slice(offset,len)` reads impossible in principle."
 *
 *   "Assemble the pack as `new Blob([hdr1, mediaBlob1, hdr2, mediaBlob2, …,
 *   centralDirectory, eocd])` with nothing materialised in the JS heap."
 *
 * Both are followed literally below: `compression method` is hard-coded to
 * 0 in `zip-format.ts` (there is no code path that could set it to
 * anything else), and every entry's *data* part of the assembled `Blob` is
 * the caller's own `Blob` object passed straight into the `Blob` constructor
 * — never read into memory by this module. Only the CRC-32 pass reads
 * bytes, and it does so in bounded chunks (`crc32.ts`).
 */

import { crc32OfBlob } from './crc32';
import {
  buildCentralDirectoryHeader,
  buildEocd,
  buildLocalFileHeader,
  dosDateTime,
  type ZipEntryMeta,
} from './zip-format';

export interface ZipEntryInput {
  /** ASCII, forward-slash-separated path within the archive — e.g.
   *  `'questions.json'` or `'m/3f9a1c8b2d40.jpg'`. */
  name: string;
  data: Blob;
}

export interface ZipWrittenEntry {
  name: string;
  crc32: number;
  size: number;
}

export interface WriteZipResult {
  blob: Blob;
  entries: ZipWrittenEntry[];
}

export interface WriteZipOptions {
  /** Content-addressed media never changes for the same key — callers may
   *  supply a cache so a second save of an unchanged pack does not re-hash
   *  unchanged media (`export.ts` owns the actual cache; this is just the
   *  plumbing that lets it be supplied). Keyed by entry `name`. */
  crc32Cache?: Map<string, number>;
  now?: Date;
}

export async function writeZip(entries: ZipEntryInput[], options: WriteZipOptions = {}): Promise<WriteZipResult> {
  const { time, date } = dosDateTime(options.now ?? new Date());
  const parts: BlobPart[] = [];
  const centralParts: Uint8Array<ArrayBuffer>[] = [];
  const written: ZipWrittenEntry[] = [];
  let offset = 0;

  for (const entry of entries) {
    const size = entry.data.size;
    const cached = options.crc32Cache?.get(entry.name);
    const crc32 = cached ?? (await crc32OfBlob(entry.data));
    if (options.crc32Cache && cached === undefined) options.crc32Cache.set(entry.name, crc32);

    const meta: ZipEntryMeta = { name: entry.name, crc32, size, time, date };
    const localHeader = buildLocalFileHeader(meta);
    // Blob-referencing, not copying: `entry.data` is placed straight into
    // the parts array, exactly as media-storage-investigation.md §10.2
    // specifies — the writer never calls `.arrayBuffer()` on it.
    parts.push(localHeader, entry.data);
    centralParts.push(buildCentralDirectoryHeader(meta, offset));
    offset += localHeader.byteLength + size;
    written.push({ name: entry.name, crc32, size });
  }

  const centralDirectoryOffset = offset;
  let centralDirectorySize = 0;
  for (const central of centralParts) {
    parts.push(central);
    centralDirectorySize += central.byteLength;
  }
  offset += centralDirectorySize;

  const eocd = buildEocd(entries.length, centralDirectorySize, centralDirectoryOffset);
  parts.push(eocd);

  const blob = new Blob(parts, { type: 'application/zip' });
  return { blob, entries: written };
}
