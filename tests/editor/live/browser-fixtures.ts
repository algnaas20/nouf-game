/**
 * In-browser fixture generation and pipeline invocation for
 * tests/editor/live/media-intake.ts (PH-C2). This file is served by Vite
 * and imported **from inside the page** via `import()` — it is never run
 * through Node/tsx's esbuild transpilation. That distinction matters: tsx's
 * transpilation of a `.ts` file injects a `keepNames`-style `__name(fn,
 * "name")` wrapper around named function bindings, and `page.evaluate`
 * only ships the evaluated function's own extracted source text into the
 * browser — not the surrounding module scope where that helper would
 * normally live — so any `page.evaluate` callback containing an internal
 * *named* function/arrow binding breaks with
 * `ReferenceError: __name is not defined` the moment it runs standalone in
 * the page. Keeping all real logic here (Vite-transpiled, never tsx-
 * transpiled) and letting `media-intake.ts`'s `page.evaluate` calls stay
 * trivial one-line dispatchers avoids the problem entirely. Documented for
 * real in `docs/بروتوكولات/tsx-playwright-page-evaluate.md`.
 */

// Static, relative imports — resolvable by both `tsc` (type-checking this
// file like any other project file) and Vite's dev server (which serves
// this whole module graph to the browser when the page dynamically imports
// this file's own path). No absolute `/src/...` specifiers here — those
// resolve fine at runtime in Vite but `tsc --noEmit` cannot resolve them
// for type-checking, since they are not real filesystem/tsconfig paths.
import { processImageFile } from '../../../src/media/image';
import { processMediaFile } from '../../../src/media/process';

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return new Blob([bytes], { type: mimeType });
}

async function encodeCanvasJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas.toBlob produced no blob'))), 'image/jpeg', quality);
  });
}

/** A "12MP-scale phone photo"-like JPEG: a gradient plus deterministic
 *  pseudo-random texture blocks (for realistic, non-trivial JPEG entropy),
 *  quality-searched into the report's stated 3–6 MB source range. */
export async function makePhotoFixture(
  width: number,
  height: number,
): Promise<{ base64: string; size: number; quality: number; tries: number }> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d context');
  const grad = ctx.createLinearGradient(0, 0, width, height);
  grad.addColorStop(0, '#3a5f8a');
  grad.addColorStop(0.5, '#c9a15a');
  grad.addColorStop(1, '#274b36');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  let seed = width * height + 1;
  const block = 24;
  for (let y = 0; y < height; y += block) {
    for (let x = 0; x < width; x += block) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const gate = seed / 0x7fffffff;
      if (gate < 0.35) {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        const shadeRoll = seed / 0x7fffffff;
        const shade = Math.floor(shadeRoll * 80) - 40;
        ctx.fillStyle = `rgba(${128 + shade},${128 + shade},${128 + shade},0.25)`;
        ctx.fillRect(x, y, block, block);
      }
    }
  }

  // Real per-pixel noise on top of the gradient/blocks — a genuine "phone
  // photo" JPEG is nowhere near as flat/compressible as a pure gradient
  // (sensor noise, fine texture); this closes the gap so the *source*
  // fixture actually lands in the report's stated 3–6 MB range, not just
  // the processed output's ceiling (which does not depend on this).
  // Mild per-pixel grain (not adversarial white noise — real camera sensor
  // grain is subtle, and unlike a uniform random walk it still compresses
  // reasonably under JPEG's block-DCT once resized down). Amplitude tuned
  // empirically (see worklog-C2.md) so the *source* fixture lands in the
  // report's stated 3–6 MB range while the *downscaled* 1600px/q0.80 output
  // still lands under the 400 KB ceiling, matching real phone-photo
  // behaviour rather than a worst-case incompressible pattern.
  const imageData = ctx.getImageData(0, 0, width, height);
  const pixels = imageData.data;
  for (let i = 0; i < pixels.length; i += 4) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const noise = (seed % 13) - 6;
    pixels[i] = Math.min(255, Math.max(0, (pixels[i] ?? 0) + noise));
    pixels[i + 1] = Math.min(255, Math.max(0, (pixels[i + 1] ?? 0) + noise));
    pixels[i + 2] = Math.min(255, Math.max(0, (pixels[i + 2] ?? 0) + noise));
  }
  ctx.putImageData(imageData, 0, 0);

  let quality = 0.92;
  const targetMin = 3 * 1024 * 1024;
  const targetMax = 6 * 1024 * 1024;
  let blob = await encodeCanvasJpeg(canvas, quality);
  let tries = 0;
  while ((blob.size < targetMin || blob.size > targetMax) && tries < 12) {
    quality = blob.size < targetMin ? Math.min(0.98, quality + 0.02) : Math.max(0.3, quality - 0.08);
    blob = await encodeCanvasJpeg(canvas, quality);
    tries += 1;
  }
  const arr = new Uint8Array(await blob.arrayBuffer());
  return { base64: bytesToBase64(arr), size: blob.size, quality, tries };
}

export interface ProcessedFixtureResult {
  outBase64: string;
  size: number;
  width: number;
  height: number;
  wasReencoded: boolean;
}

/** Runs the real `processImageFile` pipeline on a base64 JPEG and returns
 *  both the resulting metadata and the output bytes (base64) for an
 *  independent byte-for-byte comparison on the Node side. */
export async function processImageFixture(base64: string): Promise<ProcessedFixtureResult> {
  const blob = base64ToBlob(base64, 'image/jpeg');
  const processed = await processImageFile(blob);
  const outBytes = new Uint8Array(await processed.blob.arrayBuffer());
  return {
    outBase64: bytesToBase64(outBytes),
    size: processed.blob.size,
    width: processed.width,
    height: processed.height,
    wasReencoded: processed.wasReencoded,
  };
}

/** A landscape frame, solid blue, with a red marker block in the raw
 *  top-left 20%×20% — the base fixture for the EXIF-orientation test,
 *  produced with NO EXIF at all (canvas.toBlob never writes any). */
export async function makeExifTestBase(width: number, height: number): Promise<{ base64: string }> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d context');
  ctx.fillStyle = '#1040c0';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#e02020';
  ctx.fillRect(0, 0, Math.round(width * 0.2), Math.round(height * 0.2));
  const blob = await encodeCanvasJpeg(canvas, 0.95);
  const arr = new Uint8Array(await blob.arrayBuffer());
  return { base64: bytesToBase64(arr) };
}

export interface ExifSampleResult {
  width: number;
  height: number;
  wasReencoded: boolean;
  topRight: { r: number; g: number; b: number };
  bottomLeft: { r: number; g: number; b: number };
  afterDataUrl: string;
}

/** Runs the real pipeline on a JPEG carrying a spliced EXIF
 *  Orientation=6 tag, then draws the *processed output* to a canvas and
 *  samples two pixels to prove the rotation was actually baked into the
 *  pixels — not just "looks right" in a screenshot. */
export async function processAndSampleForExif(base64: string): Promise<ExifSampleResult> {
  const blob = base64ToBlob(base64, 'image/jpeg');
  const processed = await processImageFile(blob);
  const bmp = await createImageBitmap(processed.blob);
  const canvas = document.createElement('canvas');
  canvas.width = bmp.width;
  canvas.height = bmp.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d context');
  ctx.drawImage(bmp, 0, 0);
  const sampleAt = (px: number, py: number): { r: number; g: number; b: number } => {
    const d = ctx.getImageData(px, py, 1, 1).data;
    return { r: d[0] ?? 0, g: d[1] ?? 0, b: d[2] ?? 0 };
  };
  const topRight = sampleAt(Math.round(bmp.width * 0.9), Math.round(bmp.height * 0.1));
  const bottomLeft = sampleAt(Math.round(bmp.width * 0.1), Math.round(bmp.height * 0.9));
  return {
    width: processed.width,
    height: processed.height,
    wasReencoded: processed.wasReencoded,
    topRight,
    bottomLeft,
    afterDataUrl: canvas.toDataURL('image/png'),
  };
}

/** The "before" (buggy) comparison: decodes the SAME EXIF-tagged bytes with
 *  `imageOrientation: 'none'` — i.e. explicitly simulating what would ship
 *  if the code under test forgot the `imageOrientation: 'from-image'` fix —
 *  so the before/after screenshots are a genuine, deterministic contrast,
 *  not dependent on any particular browser's `createImageBitmap` default. */
export async function renderWithoutOrientationCorrection(
  base64: string,
): Promise<{ beforeDataUrl: string; width: number; height: number }> {
  const blob = base64ToBlob(base64, 'image/jpeg');
  const buggyBitmap = await createImageBitmap(blob, { imageOrientation: 'none' });
  const canvas = document.createElement('canvas');
  canvas.width = buggyBitmap.width;
  canvas.height = buggyBitmap.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d context');
  ctx.drawImage(buggyBitmap, 0, 0);
  return { beforeDataUrl: canvas.toDataURL('image/png'), width: buggyBitmap.width, height: buggyBitmap.height };
}

/** A small (800×600, well under the 1600px target) JPEG — AC3's fixture. */
export async function makeSmallImageFixture(): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 600;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d context');
  ctx.fillStyle = '#446688';
  ctx.fillRect(0, 0, 800, 600);
  ctx.fillStyle = '#ffcc00';
  ctx.beginPath();
  ctx.arc(400, 300, 120, 0, Math.PI * 2);
  ctx.fill();
  const blob = await encodeCanvasJpeg(canvas, 0.9);
  const arr = new Uint8Array(await blob.arrayBuffer());
  return bytesToBase64(arr);
}

export interface ProcessMediaFileResult {
  ok: boolean;
  reason?: string;
  kind?: string;
  ext?: string;
}

/** Runs the real top-level `processMediaFile` orchestration (image or audio
 *  routing, classification, ceilings, playability) on an arbitrary file. */
export async function runProcessMediaFile(
  base64: string,
  name: string,
  mimeType: string,
): Promise<ProcessMediaFileResult> {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const file = new File([bytes], name, { type: mimeType });
  const result = await processMediaFile(file);
  if (!result.ok) return { ok: false, reason: result.reason };
  return { ok: true, kind: result.kind, ext: result.media.kind === 'none' ? undefined : result.media.ext };
}
