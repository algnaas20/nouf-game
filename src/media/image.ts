/**
 * Image intake — §4 of media-storage-investigation.md v5.
 *
 * Three mandatory implementation details from the report, all here:
 *   1. Bake in EXIF orientation via
 *      `createImageBitmap(blob, { imageOrientation: 'from-image' })` —
 *      canvas encode strips EXIF entirely, so if we re-encode without first
 *      correcting the pixels, a portrait phone photo comes out sideways.
 *   2. Never upscale. If the source's long edge is already ≤ the target,
 *      keep the original bytes untouched — no re-encode, no upscaling, no
 *      quality loss on an image that was already fine. (The original file's
 *      own EXIF orientation tag survives byte-for-byte in this path, and
 *      modern browsers honour it when decoding `<img>` — this is *not* a
 *      silent orientation bug, only the re-encode path needs the bake-in.)
 *   3. Do it silently at add time, never at publish time — this module has
 *      no "compress" step the host is shown; the caller decides what (if
 *      anything) to display, and per the report this must not be a visible
 *      "compressing…" affordance.
 */

import { IMAGE_JPEG_QUALITY, IMAGE_TARGET_LONG_EDGE_PX } from './limits';

/** §4 — "Accept AVIF uploads... but never produce it." image/avif is
 *  accepted on intake (decode-only, via createImageBitmap); the re-encode
 *  target is always JPEG (below), so AVIF is never *produced*. */
const SUPPORTED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
]);

export function isSupportedImageType(mimeType: string): boolean {
  return SUPPORTED_IMAGE_MIME_TYPES.has(mimeType.toLowerCase());
}

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
};

/** Extension for a MIME type this module knows about. Falls back to `bin`
 *  for anything else — callers should have already rejected unsupported
 *  types via `isSupportedImageType` before this is reached. */
export function extFromImageMime(mimeType: string): string {
  return MIME_TO_EXT[mimeType.toLowerCase()] ?? 'bin';
}

export interface ProcessedImage {
  blob: Blob;
  ext: string;
  width: number;
  height: number;
  /** false on the "kept original bytes, no re-encode" path — surfaced for
   *  tests and for AC3's "bytes match the original exactly" claim. */
  wasReencoded: boolean;
}

function longEdge(width: number, height: number): number {
  return Math.max(width, height);
}

/** Draws a `createImageBitmap` result onto a canvas at the given size and
 *  returns a JPEG blob at the fixed quality from `limits.ts`. Isolated as
 *  its own function so a live test can call it directly if ever needed. */
async function encodeJpeg(bitmap: ImageBitmap, width: number, height: number): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');
  ctx.drawImage(bitmap, 0, 0, width, height);
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('canvas.toBlob produced no blob'))),
      'image/jpeg',
      IMAGE_JPEG_QUALITY,
    );
  });
}

/**
 * The full image-intake pipeline. Throws only on a genuinely undecodable
 * file (the "real load" test for images — `createImageBitmap` rejects on
 * corrupt/unsupported bytes exactly like a load-to-`loadedmetadata` test
 * would for audio); callers turn that into the calm Arabic message.
 */
export async function processImageFile(file: Blob): Promise<ProcessedImage> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const sourceLongEdge = longEdge(bitmap.width, bitmap.height);

    if (sourceLongEdge <= IMAGE_TARGET_LONG_EDGE_PX) {
      // Rule 2 — never upscale, never re-encode a small image.
      const mime = file instanceof File ? file.type : 'image/jpeg';
      return {
        blob: file instanceof Blob ? file : (file as Blob),
        ext: extFromImageMime(mime),
        width: bitmap.width,
        height: bitmap.height,
        wasReencoded: false,
      };
    }

    const scale = IMAGE_TARGET_LONG_EDGE_PX / sourceLongEdge;
    const targetWidth = Math.round(bitmap.width * scale);
    const targetHeight = Math.round(bitmap.height * scale);
    const blob = await encodeJpeg(bitmap, targetWidth, targetHeight);
    return {
      blob,
      ext: 'jpg',
      width: targetWidth,
      height: targetHeight,
      wasReencoded: true,
    };
  } finally {
    bitmap.close();
  }
}
