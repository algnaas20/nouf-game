/**
 * Raw PKZIP binary structures — local file header, central directory file
 * header, end-of-central-directory (EOCD) record. STORE (method 0) only, no
 * ZIP64 (nothing this project produces or accepts approaches 4 GiB), no
 * file comments, no extra fields, ASCII entry names only (content-addressed
 * media names and the fixed `questions.json`/`m/` — §6 of
 * media-storage-investigation.md already forbids anything else project-wide).
 *
 * Every multi-byte field is little-endian, per the PKZIP APPNOTE format.
 */

export const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
export const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
export const EOCD_SIGNATURE = 0x06054b50;

const LOCAL_FILE_HEADER_FIXED_SIZE = 30;
const CENTRAL_DIRECTORY_FIXED_SIZE = 46;
const EOCD_FIXED_SIZE = 22;

/** MS-DOS date/time pair, as every PKZIP header requires. Precision is one
 *  minute for time-of-day purposes; nothing in this project reads it back
 *  (the manifest's own `preparedAt` ISO string is the source of truth for
 *  "when"), so this only needs to be a valid, non-crashing pair. */
export function dosDateTime(date: Date): { time: number; date: number } {
  const year = Math.max(1980, date.getFullYear());
  const time =
    ((date.getHours() & 0x1f) << 11) |
    ((date.getMinutes() & 0x3f) << 5) |
    ((date.getSeconds() >> 1) & 0x1f);
  const dosDate = (((year - 1980) & 0x7f) << 9) | (((date.getMonth() + 1) & 0xf) << 5) | (date.getDate() & 0x1f);
  return { time: time & 0xffff, date: dosDate & 0xffff };
}

function asciiBytes(name: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(name.length);
  for (let i = 0; i < name.length; i += 1) {
    const code = name.charCodeAt(i);
    if (code > 0x7f) {
      throw new Error(`zip entry name must be ASCII: ${JSON.stringify(name)}`);
    }
    bytes[i] = code;
  }
  return bytes;
}

export interface ZipEntryMeta {
  name: string;
  crc32: number;
  size: number;
  time: number;
  date: number;
}

/** Local file header — immediately precedes each entry's raw data. Method
 *  is always 0 (STORE): compressed size === uncompressed size === `size`,
 *  and the bytes that follow this header are the entry's bytes verbatim. */
export function buildLocalFileHeader(meta: ZipEntryMeta): Uint8Array<ArrayBuffer> {
  const nameBytes = asciiBytes(meta.name);
  const buffer = new ArrayBuffer(LOCAL_FILE_HEADER_FIXED_SIZE + nameBytes.length);
  const view = new DataView(buffer);
  view.setUint32(0, LOCAL_FILE_HEADER_SIGNATURE, true);
  view.setUint16(4, 20, true); // version needed to extract (2.0)
  view.setUint16(6, 0x0000, true); // general purpose bit flag — no UTF-8 flag needed, names are ASCII
  view.setUint16(8, 0, true); // compression method: 0 = STORE
  view.setUint16(10, meta.time, true);
  view.setUint16(12, meta.date, true);
  view.setUint32(14, meta.crc32, true);
  view.setUint32(18, meta.size, true); // compressed size
  view.setUint32(22, meta.size, true); // uncompressed size
  view.setUint16(26, nameBytes.length, true);
  view.setUint16(28, 0, true); // extra field length
  const out = new Uint8Array(buffer);
  out.set(nameBytes, LOCAL_FILE_HEADER_FIXED_SIZE);
  return out;
}

/** Central directory file header — one per entry, all consecutive, forming
 *  the central directory block that `readZip` finds via the EOCD. */
export function buildCentralDirectoryHeader(meta: ZipEntryMeta, localHeaderOffset: number): Uint8Array<ArrayBuffer> {
  const nameBytes = asciiBytes(meta.name);
  const buffer = new ArrayBuffer(CENTRAL_DIRECTORY_FIXED_SIZE + nameBytes.length);
  const view = new DataView(buffer);
  view.setUint32(0, CENTRAL_DIRECTORY_SIGNATURE, true);
  view.setUint16(4, 20, true); // version made by
  view.setUint16(6, 20, true); // version needed to extract
  view.setUint16(8, 0x0000, true); // general purpose bit flag
  view.setUint16(10, 0, true); // compression method: STORE
  view.setUint16(12, meta.time, true);
  view.setUint16(14, meta.date, true);
  view.setUint32(16, meta.crc32, true);
  view.setUint32(20, meta.size, true); // compressed size
  view.setUint32(24, meta.size, true); // uncompressed size
  view.setUint16(28, nameBytes.length, true);
  view.setUint16(30, 0, true); // extra field length
  view.setUint16(32, 0, true); // file comment length
  view.setUint16(34, 0, true); // disk number start
  view.setUint16(36, 0, true); // internal file attributes
  view.setUint32(38, 0, true); // external file attributes
  view.setUint32(42, localHeaderOffset, true);
  const out = new Uint8Array(buffer);
  out.set(nameBytes, CENTRAL_DIRECTORY_FIXED_SIZE);
  return out;
}

export function buildEocd(
  entryCount: number,
  centralDirectorySize: number,
  centralDirectoryOffset: number,
): Uint8Array<ArrayBuffer> {
  const buffer = new ArrayBuffer(EOCD_FIXED_SIZE);
  const view = new DataView(buffer);
  view.setUint32(0, EOCD_SIGNATURE, true);
  view.setUint16(4, 0, true); // number of this disk
  view.setUint16(6, 0, true); // disk where central directory starts
  view.setUint16(8, entryCount, true); // central directory records on this disk
  view.setUint16(10, entryCount, true); // total central directory records
  view.setUint32(12, centralDirectorySize, true);
  view.setUint32(16, centralDirectoryOffset, true);
  view.setUint16(20, 0, true); // comment length
  return new Uint8Array(buffer);
}

export interface ParsedCentralDirectoryEntry {
  name: string;
  method: number;
  crc32: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
}

/** Parses one central directory record starting at `offset` within `view`.
 *  Returns the entry plus the byte offset immediately after it (so callers
 *  can walk the whole central directory block sequentially). */
export function parseCentralDirectoryEntry(
  view: DataView,
  offset: number,
): { entry: ParsedCentralDirectoryEntry; nextOffset: number } {
  const signature = view.getUint32(offset, true);
  if (signature !== CENTRAL_DIRECTORY_SIGNATURE) {
    throw new Error(`bad central directory signature at offset ${offset}: 0x${signature.toString(16)}`);
  }
  const method = view.getUint16(offset + 10, true);
  const time = view.getUint16(offset + 12, true);
  const date = view.getUint16(offset + 14, true);
  void time;
  void date;
  const crc32 = view.getUint32(offset + 16, true) >>> 0;
  const compressedSize = view.getUint32(offset + 20, true);
  const uncompressedSize = view.getUint32(offset + 24, true);
  const nameLength = view.getUint16(offset + 28, true);
  const extraLength = view.getUint16(offset + 30, true);
  const commentLength = view.getUint16(offset + 32, true);
  const localHeaderOffset = view.getUint32(offset + 42, true);
  const nameStart = offset + CENTRAL_DIRECTORY_FIXED_SIZE;
  const nameBytes = new Uint8Array(view.buffer, view.byteOffset + nameStart, nameLength);
  const name = String.fromCharCode(...nameBytes);
  const nextOffset = nameStart + nameLength + extraLength + commentLength;
  return {
    entry: { name, method, crc32, compressedSize, uncompressedSize, localHeaderOffset },
    nextOffset,
  };
}

/** Reads just enough of a local file header (its fixed 30 bytes + name
 *  length) to compute where this entry's *data* actually starts — the
 *  central directory does not give that offset directly. A tiny, constant-
 *  size read per entry, not proportional to the entry's data size. */
export function parseLocalFileHeaderDataOffset(view: DataView, localHeaderOffset: number): number {
  const signature = view.getUint32(localHeaderOffset, true);
  if (signature !== LOCAL_FILE_HEADER_SIGNATURE) {
    throw new Error(`bad local file header signature at offset ${localHeaderOffset}: 0x${signature.toString(16)}`);
  }
  const nameLength = view.getUint16(localHeaderOffset + 26, true);
  const extraLength = view.getUint16(localHeaderOffset + 28, true);
  return localHeaderOffset + LOCAL_FILE_HEADER_FIXED_SIZE + nameLength + extraLength;
}

export function findEocdSignatureOffset(tail: DataView): number {
  // Scan backward — correct even in the (here, never-produced) case of a
  // non-empty zip comment shifting the EOCD off the very last 22 bytes.
  for (let i = tail.byteLength - EOCD_FIXED_SIZE; i >= 0; i -= 1) {
    if (tail.getUint32(i, true) === EOCD_SIGNATURE) return i;
  }
  throw new Error('not a valid zip file: end-of-central-directory record not found');
}

export const EOCD_MIN_SIZE = EOCD_FIXED_SIZE;
