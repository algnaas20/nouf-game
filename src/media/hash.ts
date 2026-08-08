/**
 * Content-addressed naming — §6 of media-storage-investigation.md v5.
 *
 * `crypto.subtle` is a Web Crypto API available in both real browsers and
 * modern Node (used directly by Vitest's pure unit tests here — no browser
 * needed to prove the naming logic in isolation; the *processing* pipeline
 * that produces the bytes to hash is proven separately, live, in
 * tests/editor/live/media-intake.ts, since that part needs real
 * `createImageBitmap`/canvas support Node does not have).
 */

import { MEDIA_FILENAME_PATTERN, SHA256_PREFIX_LENGTH } from './limits';

const HEX_ALPHABET = '0123456789abcdef';

function bytesToHex(bytes: ArrayBuffer): string {
  const view = new Uint8Array(bytes);
  let out = '';
  for (let i = 0; i < view.length; i += 1) {
    const byte = view[i]!;
    out += (HEX_ALPHABET[byte >> 4] ?? '0') + (HEX_ALPHABET[byte & 0x0f] ?? '0');
  }
  return out;
}

/** Full lowercase hex SHA-256 digest of a Blob's bytes. */
export async function sha256Hex(source: Blob | ArrayBuffer): Promise<string> {
  const bytes = source instanceof Blob ? await source.arrayBuffer() : source;
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return bytesToHex(digest);
}

/** §6 — `m/<first-12-hex-of-sha256>.<ext>`, e.g. `3f9a1c8b2d40.jpg`. Returns
 *  just the filename (the `m/` directory prefix is WL-D's export concern). */
export function contentAddressedFilename(fullSha256Hex: string, ext: string): string {
  const prefix = fullSha256Hex.slice(0, SHA256_PREFIX_LENGTH).toLowerCase();
  const normalizedExt = ext.toLowerCase();
  return `${prefix}.${normalizedExt}`;
}

/** Combines hashing and naming — the single call site every media-processing
 *  path (image, audio) uses so no path can invent its own scheme. */
export async function hashAndName(
  blob: Blob,
  ext: string,
): Promise<{ sha256: string; filename: string }> {
  const sha256 = await sha256Hex(blob);
  const filename = contentAddressedFilename(sha256, ext);
  return { sha256, filename };
}

export function isValidMediaFilename(name: string): boolean {
  return MEDIA_FILENAME_PATTERN.test(name);
}
