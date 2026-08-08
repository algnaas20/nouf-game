/**
 * Reads a pack file back into a `PackManifest` + lazy media accessors.
 * §10.3: "Validate `formatVersion`; a version higher than the app
 * understands is a hard, explained refusal — never a partial load." Every
 * throw path here happens **before** any question/media is handed back —
 * there is no code path that returns a manifest the caller might partially
 * trust.
 *
 * "Ready" (the manifest, question count, title) is available without
 * reading any media bytes — `readZip` only reads the central directory and
 * `questions.json`'s own (small) bytes. Media integrity (`verifyAllMedia`)
 * is a separate, explicit, opt-in step — deliberately never run
 * automatically, or D2-3 ("ready time independent of pack size") would be
 * false for any pack with real media in it.
 */

import type { PackManifest } from '../contracts';
import { sha256Hex } from '../media/hash';
import { MANIFEST_ENTRY_NAME, MEDIA_ENTRY_DIR, PACK_FORMAT_VERSION } from './constants';
import { AR_PACK_COPY } from './copy';
import { readZip } from './zip-reader';

export class PackFormatError extends Error {
  /** Calm Arabic sentence for the UI — constraint row 17. */
  readonly userMessage: string;
  /** Hidden, copyable technical detail — row 17's other half. */
  readonly detail: string;

  constructor(userMessage: string, detail: string) {
    super(`${userMessage} (${detail})`);
    this.name = 'PackFormatError';
    this.userMessage = userMessage;
    this.detail = detail;
  }
}

export interface MediaVerifyResult {
  sha256: string;
  ok: boolean;
  detail: string;
}

export interface ImportedPack {
  manifest: PackManifest;
  /** Lazy, zero-copy until actually awaited — see `zip-reader.ts`. */
  getMediaBlob(sha256: string): Promise<Blob>;
  /** Explicit, opt-in — reads and hashes every media entry's bytes and
   *  compares against the manifest. Never called by `importPack` itself. */
  verifyAllMedia(): Promise<MediaVerifyResult[]>;
}

function mediaEntryName(sha256: string, ext: string): string {
  return `${MEDIA_ENTRY_DIR}/${sha256.slice(0, 12).toLowerCase()}.${ext.toLowerCase()}`;
}

export async function importPack(file: Blob): Promise<ImportedPack> {
  let zip: Awaited<ReturnType<typeof readZip>>;
  try {
    zip = await readZip(file);
  } catch (err) {
    throw new PackFormatError(AR_PACK_COPY.notAValidPack, err instanceof Error ? err.message : String(err));
  }

  const manifestEntry = zip.entries.get(MANIFEST_ENTRY_NAME);
  if (!manifestEntry) {
    throw new PackFormatError(AR_PACK_COPY.notAValidPack, `missing "${MANIFEST_ENTRY_NAME}" entry`);
  }
  if (manifestEntry.method !== 0) {
    throw new PackFormatError(
      AR_PACK_COPY.notAValidPack,
      `"${MANIFEST_ENTRY_NAME}" uses compression method ${manifestEntry.method}, expected 0 (STORE)`,
    );
  }

  const manifestBlob = await zip.getEntryBlob(MANIFEST_ENTRY_NAME);
  let manifest: PackManifest;
  try {
    manifest = JSON.parse(await manifestBlob.text()) as PackManifest;
  } catch (err) {
    throw new PackFormatError(AR_PACK_COPY.notAValidPack, `"${MANIFEST_ENTRY_NAME}" is not valid JSON: ${String(err)}`);
  }

  if (typeof manifest.formatVersion !== 'number' || manifest.formatVersion > PACK_FORMAT_VERSION) {
    throw new PackFormatError(
      AR_PACK_COPY.formatTooNew,
      `manifest.formatVersion=${String(manifest.formatVersion)} > supported ${PACK_FORMAT_VERSION}`,
    );
  }

  // Every media reference must resolve to a present, STORE-method entry —
  // checked eagerly (cheap: central-directory lookups only, no byte reads)
  // so "hard refusal, never a partial load" also covers a pack whose
  // manifest promises media that is not actually in the zip.
  for (const entry of manifest.media) {
    const name = mediaEntryName(entry.sha256, entry.ext);
    const zipEntry = zip.entries.get(name);
    if (!zipEntry) {
      throw new PackFormatError(AR_PACK_COPY.notAValidPack, `manifest references "${name}", not present in the zip`);
    }
    if (zipEntry.method !== 0) {
      throw new PackFormatError(
        AR_PACK_COPY.notAValidPack,
        `"${name}" uses compression method ${zipEntry.method}, expected 0 (STORE) — media must be STORED, never deflated`,
      );
    }
  }

  async function getMediaBlob(sha256: string): Promise<Blob> {
    const entry = manifest.media.find((m) => m.sha256 === sha256);
    if (!entry) throw new Error(`importPack: no media entry for sha256=${sha256}`);
    return zip.getEntryBlob(mediaEntryName(entry.sha256, entry.ext));
  }

  async function verifyAllMedia(): Promise<MediaVerifyResult[]> {
    const results: MediaVerifyResult[] = [];
    for (const entry of manifest.media) {
      const blob = await getMediaBlob(entry.sha256);
      if (blob.size !== entry.bytes) {
        results.push({
          sha256: entry.sha256,
          ok: false,
          detail: `size mismatch: manifest says ${entry.bytes} bytes, zip entry is ${blob.size} bytes`,
        });
        continue;
      }
      const actual = await sha256Hex(blob);
      results.push({
        sha256: entry.sha256,
        ok: actual === entry.sha256,
        detail: actual === entry.sha256 ? 'match' : `manifest sha256=${entry.sha256}, actual=${actual}`,
      });
    }
    return results;
  }

  return { manifest, getMediaBlob, verifyAllMedia };
}
