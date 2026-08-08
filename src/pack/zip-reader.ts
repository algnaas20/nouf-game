/**
 * ZIP reader — locates the end-of-central-directory record in the last
 * 64 KB, reads the (small) central directory, and hands back lazy
 * `Blob.slice()` accessors for each entry's data. media-storage-
 * investigation.md §10.3 / §7.1's "load speed on import" note:
 *
 *   "Read the last 64 KB → central directory → manifest. Time-to-ready is
 *   independent of pack size."
 *
 * Nothing in this module reads an entry's *data* bytes — only the small,
 * fixed-size headers (central directory + one 30-byte local-file-header
 * read per entry, to locate where its data starts). Reading the actual
 * media/manifest bytes is the caller's job, on demand, via `getEntryBlob`.
 */

import {
  EOCD_MIN_SIZE,
  findEocdSignatureOffset,
  parseCentralDirectoryEntry,
  parseLocalFileHeaderDataOffset,
  type ParsedCentralDirectoryEntry,
} from './zip-format';

const EOCD_SEARCH_WINDOW = 65536; // "the last 64 KB", per §10.3, with room for a comment we never write

export class NotAZipFileError extends Error {
  constructor(detail: string) {
    super(`not a valid zip file: ${detail}`);
  }
}

export interface ZipEntry extends ParsedCentralDirectoryEntry {}

export interface ReadZipResult {
  /** Keyed by entry name (`'questions.json'`, `'m/<hash>.<ext>'`, …). */
  entries: Map<string, ZipEntry>;
  /** Lazily locates an entry's data (one tiny local-header read) and
   *  returns a zero-copy `Blob.slice()` over the source file — no bytes
   *  are read here; the caller decides if/when to materialise them. */
  getEntryBlob(entryName: string): Promise<Blob>;
}

export async function readZip(file: Blob): Promise<ReadZipResult> {
  if (file.size < EOCD_MIN_SIZE) {
    throw new NotAZipFileError(`file too small to contain an end-of-central-directory record (${file.size} bytes)`);
  }
  const tailSize = Math.min(EOCD_SEARCH_WINDOW, file.size);
  const tailBuffer = await file.slice(file.size - tailSize, file.size).arrayBuffer();
  const tailView = new DataView(tailBuffer);
  const eocdOffsetInTail = findEocdSignatureOffset(tailView);

  const totalEntries = tailView.getUint16(eocdOffsetInTail + 10, true);
  const centralDirectorySize = tailView.getUint32(eocdOffsetInTail + 12, true);
  const centralDirectoryOffset = tailView.getUint32(eocdOffsetInTail + 16, true);

  // The central directory is almost always inside the same tail window we
  // already fetched (it immediately precedes the EOCD); only re-fetch if a
  // pathological producer put a huge gap before it (never happens for our
  // own writer, but keeps this reader honest for any well-formed input).
  const tailWindowStart = file.size - tailSize;
  let centralView: DataView;
  let centralBaseOffset: number;
  if (centralDirectoryOffset >= tailWindowStart) {
    centralView = tailView;
    centralBaseOffset = centralDirectoryOffset - tailWindowStart;
  } else {
    const centralBuffer = await file
      .slice(centralDirectoryOffset, centralDirectoryOffset + centralDirectorySize)
      .arrayBuffer();
    centralView = new DataView(centralBuffer);
    centralBaseOffset = 0;
  }

  const entries = new Map<string, ZipEntry>();
  let cursor = centralBaseOffset;
  for (let i = 0; i < totalEntries; i += 1) {
    const { entry, nextOffset } = parseCentralDirectoryEntry(centralView, cursor);
    entries.set(entry.name, entry);
    cursor = nextOffset;
  }

  async function getEntryBlob(entryName: string): Promise<Blob> {
    const entry = entries.get(entryName);
    if (!entry) throw new NotAZipFileError(`no such entry: ${entryName}`);
    // A tiny, constant-size read (30 bytes + name length, capped well
    // above any realistic entry name) — not proportional to the entry's
    // own data size. `headerProbe` is relative to `entry.localHeaderOffset`,
    // so the parsed offset is added back to get an absolute file offset.
    const headerProbe = await file
      .slice(entry.localHeaderOffset, entry.localHeaderOffset + 30 + 512)
      .arrayBuffer();
    const relativeDataOffset = parseLocalFileHeaderDataOffset(new DataView(headerProbe), 0);
    const dataOffset = entry.localHeaderOffset + relativeDataOffset;
    return file.slice(dataOffset, dataOffset + entry.compressedSize);
  }

  return { entries, getEntryBlob };
}
