/**
 * Live-browser evidence for PH-C2's numbered acceptance criteria
 * (خطة.md PH-C2). Real Chromium (via Playwright) is required because the
 * pipeline under test uses `createImageBitmap`, `<canvas>.toBlob`, and real
 * `<audio>` decode — none of which exist in Node/jsdom.
 *
 * All in-browser logic (fixture generation, calls into the real
 * `src/media/**` pipeline) lives in `tests/editor/live/browser-fixtures.ts`,
 * loaded by the page itself via `import()` — never transpiled by tsx on the
 * Node side. See that file's header comment and
 * `docs/بروتوكولات/tsx-playwright-page-evaluate.md` for why: `page.evaluate`
 * callbacks in *this* file must stay free of internal named function
 * bindings, or tsx's `keepNames`-style `__name()` helper injection breaks
 * them the instant they run standalone in the page (confirmed by a minimal
 * repro during this session — see worklog-C2.md).
 *
 * Test fixtures are generated for real, not faked:
 *   - "Phone photo" JPEGs are rendered by a real `<canvas>` in the browser
 *     (gradient + deterministic pseudo-random texture blocks, at genuine
 *     12MP-scale pixel dimensions), quality-searched to land in the
 *     report's stated 3–6 MB source range — synthetic rather than real
 *     camera photos (none were available in this environment), but the
 *     exact code path exercised — `createImageBitmap` → canvas resize →
 *     `toBlob('image/jpeg', 0.8)` — is identical either way.
 *   - The EXIF-orientation test JPEG starts as a real canvas-rendered JPEG
 *     (no EXIF at all — that's what `canvas.toBlob` produces), then this
 *     script hand-splices a real, spec-shaped EXIF APP1/TIFF/IFD0 segment
 *     with a single Orientation=6 entry directly after the SOI marker, in
 *     Node, byte-for-byte — not borrowed from a library.
 *   - WAV fixtures are genuine playable PCM WAV files (RIFF header + a
 *     440 Hz sine tone), built by hand in Node — no encoding library
 *     needed for an uncompressed format.
 *
 * Run manually: `npx tsx tests/editor/live/media-intake.ts`
 * Port: 3013 (this phase's explicit port assignment — see worklog-C2.md).
 */

import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';
import type {
  ExifSampleResult,
  ProcessedFixtureResult,
  ProcessMediaFileResult,
} from './browser-fixtures';

const PORT = 3013;
const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const FIXTURES_MODULE = '/tests/editor/live/browser-fixtures.ts';

function buildWavBuffer(
  durationSeconds: number,
  sampleRate = 44100,
  channels = 2,
  bitsPerSample = 16,
): Buffer {
  const numSamples = Math.floor(durationSeconds * sampleRate);
  const blockAlign = channels * (bitsPerSample / 8);
  const dataSize = numSamples * blockAlign;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0, 'ascii');
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8, 'ascii');
  buffer.write('fmt ', 12, 'ascii');
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * blockAlign, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write('data', 36, 'ascii');
  buffer.writeUInt32LE(dataSize, 40);
  const freq = 440;
  for (let i = 0; i < numSamples; i += 1) {
    const t = i / sampleRate;
    const sample = Math.round(Math.sin(2 * Math.PI * freq * t) * 3000);
    const offset = 44 + i * blockAlign;
    for (let ch = 0; ch < channels; ch += 1) {
      buffer.writeInt16LE(sample, offset + ch * 2);
    }
  }
  return buffer;
}

/** Hand-builds a minimal, spec-shaped EXIF APP1 segment (TIFF header +
 *  single-entry IFD0, little-endian) carrying only an Orientation tag, and
 *  inserts it immediately after the SOI marker of a real JPEG byte buffer.
 *
 *  Byte layout:
 *    TIFF header (8B):  "II" 0x2A00 offset-to-IFD0=8
 *    IFD0 (18B):        count=1 | entry(tag=0x0112 Orientation, type=SHORT,
 *                        count=1, value=orientation) | next-IFD-offset=0
 *    "Exif\0\0" (6B) + TIFF header + IFD0 = APP1 body
 *    APP1 segment: 0xFFE1 | length(2B, big-endian, includes itself) | body
 */
function spliceExifOrientation(jpegBytes: Buffer, orientation: number): Buffer {
  if (jpegBytes[0] !== 0xff || jpegBytes[1] !== 0xd8) {
    throw new Error('not a JPEG: missing SOI marker (0xFFD8)');
  }
  const tiff = Buffer.from([0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00]);
  const ifd = Buffer.alloc(18);
  ifd.writeUInt16LE(1, 0);
  ifd.writeUInt16LE(0x0112, 2);
  ifd.writeUInt16LE(3, 4);
  ifd.writeUInt32LE(1, 6);
  ifd.writeUInt16LE(orientation, 10);
  ifd.writeUInt16LE(0, 12);
  ifd.writeUInt32LE(0, 14);
  const exifPayload = Buffer.concat([tiff, ifd]);
  const exifHeader = Buffer.from('Exif\0\0', 'ascii');
  const app1Body = Buffer.concat([exifHeader, exifPayload]);
  const app1LengthBytes = Buffer.alloc(2);
  app1LengthBytes.writeUInt16BE(app1Body.length + 2, 0);
  const app1Segment = Buffer.concat([Buffer.from([0xff, 0xe1]), app1LengthBytes, app1Body]);
  return Buffer.concat([jpegBytes.subarray(0, 2), app1Segment, jpegBytes.subarray(2)]);
}

async function main(): Promise<void> {
  let server: ViteDevServer | null = null;
  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;
  let failures = 0;
  const fail = (label: string, detail: string): void => {
    failures += 1;
    console.error(`${label} FAILED —`, detail);
  };

  try {
    server = await createServer({
      root: ROOT,
      server: { port: PORT, strictPort: true, host: '127.0.0.1' },
      logLevel: 'warn',
    });
    await server.listen();
    const harnessUrl = `http://127.0.0.1:${PORT}/tests/editor/fixtures/editor-harness.html`;

    browser = await chromium.launch();
    const context = await browser.newContext({ viewport: { width: 1280, height: 1024 } });
    const page = await context.newPage();
    page.on('pageerror', (err) => console.error('PAGEERROR:', err));
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.error('CONSOLE ERROR:', msg.text());
    });

    await page.goto(harnessUrl);
    await page.waitForSelector('#editor-add-question');

    // ===============================================================
    // AC1 — three 12MP-scale JPEGs → each ≤ 400 KB and ≤ 1600px long edge
    // ===============================================================
    console.log('\n=== AC1 — three test images, three numbers ===');
    const ac1Fixtures = [
      { w: 4000, h: 3000, label: 'landscape 4000x3000 (12MP)' },
      { w: 3000, h: 4000, label: 'portrait 3000x4000 (12MP)' },
      { w: 4000, h: 4000, label: 'square 4000x4000 (16MP)' },
    ];
    for (const fx of ac1Fixtures) {
      const fixture = await page.evaluate(
        async ({ modulePath, w, h }) => (await import(modulePath)).makePhotoFixture(w, h),
        { modulePath: FIXTURES_MODULE, w: fx.w, h: fx.h },
      );
      console.log(
        `  fixture ${fx.label}: source ${(fixture.size / 1024 / 1024).toFixed(2)} MB, quality ${fixture.quality.toFixed(2)}, ${fixture.tries} quality-search iterations`,
      );
      const processed: ProcessedFixtureResult = await page.evaluate(
        async ({ modulePath, base64 }) => (await import(modulePath)).processImageFixture(base64),
        { modulePath: FIXTURES_MODULE, base64: fixture.base64 },
      );
      const longEdge = Math.max(processed.width, processed.height);
      console.log(
        `  ${fx.label}: processed ${(processed.size / 1024).toFixed(1)} KB, ${processed.width}x${processed.height} (long edge ${longEdge}), reencoded=${processed.wasReencoded}`,
      );
      if (processed.size > 400 * 1024) fail('AC1', `${fx.label}: ${processed.size} bytes > 400KB ceiling`);
      if (longEdge > 1600) fail('AC1', `${fx.label}: long edge ${longEdge} > 1600px`);
    }
    if (failures === 0) console.log('AC1 PASSED — all three fixtures ≤ 400 KB and ≤ 1600px long edge.');

    // ===============================================================
    // AC2 — EXIF orientation=6 baked in through the re-encode path
    // ===============================================================
    console.log('\n=== AC2 — EXIF orientation=6 baked in through the re-encode path ===');
    const rawW = 3200;
    const rawH = 2400;
    const baseFixture = await page.evaluate(
      async ({ modulePath, w, h }) => (await import(modulePath)).makeExifTestBase(w, h),
      { modulePath: FIXTURES_MODULE, w: rawW, h: rawH },
    );
    const rawJpegNoExif = Buffer.from(baseFixture.base64, 'base64');
    const withExif6 = spliceExifOrientation(rawJpegNoExif, 6);
    console.log(
      `  raw JPEG (no EXIF): ${rawJpegNoExif.length} bytes; with spliced Orientation=6: ${withExif6.length} bytes (+${withExif6.length - rawJpegNoExif.length})`,
    );

    const exifResult: ExifSampleResult = await page.evaluate(
      async ({ modulePath, base64 }) => (await import(modulePath)).processAndSampleForExif(base64),
      { modulePath: FIXTURES_MODULE, base64: withExif6.toString('base64') },
    );
    console.log(`  processed: ${exifResult.width}x${exifResult.height} (reencoded=${exifResult.wasReencoded})`);
    console.log('  top-right sample (expect reddish, marker rotated here):', exifResult.topRight);
    console.log('  bottom-left sample (expect blueish, background):', exifResult.bottomLeft);
    const isPortraitNow = exifResult.height > exifResult.width;
    const topRightIsRed = exifResult.topRight.r > exifResult.topRight.b + 40;
    const bottomLeftIsBlue = exifResult.bottomLeft.b > exifResult.bottomLeft.r + 40;
    if (!isPortraitNow)
      fail('AC2', `expected portrait output after 90° correction, got ${exifResult.width}x${exifResult.height}`);
    if (!topRightIsRed) fail('AC2', `top-right sample not reddish: ${JSON.stringify(exifResult.topRight)}`);
    if (!bottomLeftIsBlue) fail('AC2', `bottom-left sample not blueish: ${JSON.stringify(exifResult.bottomLeft)}`);
    if (isPortraitNow && topRightIsRed && bottomLeftIsBlue) {
      console.log('AC2 PASSED — EXIF orientation=6 correctly baked in; output is upright, not sideways.');
    }

    const beforeAfter = await page.evaluate(
      async ({ modulePath, base64 }) => (await import(modulePath)).renderWithoutOrientationCorrection(base64),
      { modulePath: FIXTURES_MODULE, base64: withExif6.toString('base64') },
    );
    console.log(
      `  "before" (imageOrientation:'none', simulating the un-fixed bug): ${beforeAfter.width}x${beforeAfter.height} — should remain landscape/sideways`,
    );
    const beforePath = path.join(ROOT, 'tests/editor/live/exif-before-sideways.png');
    const afterPath = path.join(ROOT, 'tests/editor/live/exif-after-upright.png');
    await fs.writeFile(beforePath, Buffer.from(beforeAfter.beforeDataUrl.split(',')[1] ?? '', 'base64'));
    await fs.writeFile(afterPath, Buffer.from(exifResult.afterDataUrl.split(',')[1] ?? '', 'base64'));
    console.log('  saved:', beforePath);
    console.log('  saved:', afterPath);

    // ===============================================================
    // AC3 — an already-small image is not upscaled and not re-encoded;
    // output bytes byte-identical to input
    // ===============================================================
    console.log('\n=== AC3 — small image kept byte-identical (no upscale, no re-encode) ===');
    const smallFixtureBase64: string = await page.evaluate(
      async ({ modulePath }) => (await import(modulePath)).makeSmallImageFixture(),
      { modulePath: FIXTURES_MODULE },
    );
    const ac3Result: ProcessedFixtureResult = await page.evaluate(
      async ({ modulePath, base64 }) => (await import(modulePath)).processImageFixture(base64),
      { modulePath: FIXTURES_MODULE, base64: smallFixtureBase64 },
    );
    const inputBytes = Buffer.from(smallFixtureBase64, 'base64');
    const outputBytes = Buffer.from(ac3Result.outBase64, 'base64');
    const byteIdentical = inputBytes.length === outputBytes.length && inputBytes.equals(outputBytes);
    console.log(
      `  input ${inputBytes.length} bytes, output ${outputBytes.length} bytes, byte-identical: ${byteIdentical}, wasReencoded: ${ac3Result.wasReencoded}, dims kept: ${ac3Result.width}x${ac3Result.height}`,
    );
    if (!byteIdentical) fail('AC3', 'output bytes differ from input — image was re-encoded or altered');
    if (ac3Result.wasReencoded) fail('AC3', 'wasReencoded=true for an already-small image');
    if (ac3Result.width !== 800 || ac3Result.height !== 600)
      fail('AC3', `dimensions changed: ${ac3Result.width}x${ac3Result.height}`);
    if (byteIdentical && !ac3Result.wasReencoded) console.log('AC3 PASSED — bytes untouched, no upscale, no re-encode.');

    // ===============================================================
    // AC4 — WAV: small (≤2MB) accepted, large (>2MB) rejected with a warning
    // ===============================================================
    console.log('\n=== AC4 — WAV two cases, two results ===');
    const smallWav = buildWavBuffer(1);
    const largeWav = buildWavBuffer(15);
    console.log(`  small WAV: ${smallWav.length} bytes; large WAV: ${largeWav.length} bytes (ceiling 2097152)`);

    async function runWavCase(buf: Buffer, name: string): Promise<ProcessMediaFileResult> {
      return page.evaluate(
        async ({ modulePath, base64, fname }) =>
          (await import(modulePath)).runProcessMediaFile(base64, fname, 'audio/wav'),
        { modulePath: FIXTURES_MODULE, base64: buf.toString('base64'), fname: name },
      );
    }

    const smallWavResult = await runWavCase(smallWav, 'clip-small.wav');
    console.log('  small WAV result:', smallWavResult);
    if (!smallWavResult.ok) fail('AC4 (small WAV)', `expected accepted, got rejected: ${smallWavResult.reason}`);
    else if (smallWavResult.kind !== 'audio' || smallWavResult.ext !== 'wav')
      fail('AC4 (small WAV)', `unexpected shape: ${JSON.stringify(smallWavResult)}`);

    const largeWavResult = await runWavCase(largeWav, 'clip-large.wav');
    console.log('  large WAV result:', largeWavResult);
    const EXPECTED_WAV_WARNING = 'ملف WAV كبير جدًا — حوّله إلى MP3 أو M4A (نفس الجودة المسموعة، بحجم أصغر بكثير).';
    if (largeWavResult.ok) fail('AC4 (large WAV)', 'expected rejection, got accepted');
    else if (largeWavResult.reason !== EXPECTED_WAV_WARNING)
      fail('AC4 (large WAV)', `unexpected/missing warning text: ${largeWavResult.reason}`);

    if (smallWavResult.ok && !largeWavResult.ok && largeWavResult.reason === EXPECTED_WAV_WARNING) {
      console.log('AC4 PASSED — small WAV accepted, large WAV rejected with the explicit Arabic warning.');
    }

    // ===============================================================
    // AC6 — downscale happens silently at ADD time: the size counter,
    // read from the real DOM immediately after attaching, before the form
    // is even submitted, already reflects the shrunk size.
    // ===============================================================
    console.log('\n=== AC6 — silent downscale, size counter reflects shrunk size before submit ===');
    const ac6Fixture = await page.evaluate(
      async ({ modulePath, w, h }) => (await import(modulePath)).makePhotoFixture(w, h),
      { modulePath: FIXTURES_MODULE, w: 4000, h: 3000 },
    );
    const ac6Buffer = Buffer.from(ac6Fixture.base64, 'base64');
    console.log(`  source fixture: ${(ac6Buffer.length / 1024 / 1024).toFixed(2)} MB`);

    await page.click('#editor-add-question');
    await page.fill('.question-text-input', 'سؤال بصورة للاختبار');
    const ac6OptionInputs = page.locator('.option-text-input');
    for (let opt = 0; opt < 4; opt += 1) await ac6OptionInputs.nth(opt).fill(`خيار ${opt + 1}`);
    await page.locator('.option-correct-radio').nth(0).check();

    await page.setInputFiles('.media-file-input', {
      name: 'phone-photo.jpg',
      mimeType: 'image/jpeg',
      buffer: ac6Buffer,
    });
    await page.waitForSelector('.media-size-counter');
    const counterTextBeforeSubmit = (await page.locator('.media-size-counter').textContent()) ?? '';
    console.log('  size counter text, read BEFORE clicking «تم» (submit):', counterTextBeforeSubmit);

    // Independent parse of formatBytes()'s own output shape (Western
    // digits — "N بايت" / "N كيلوبايت" / "N.N ميجابايت"), not a call into
    // the app's own formatting code — an honest, separate check.
    function parseSizeLabelToBytes(text: string): number {
      const kbMatch = /^([\d.]+)\s*كيلوبايت$/.exec(text.trim());
      if (kbMatch?.[1]) return Math.round(parseFloat(kbMatch[1]) * 1024);
      const mbMatch = /^([\d.]+)\s*ميجابايت$/.exec(text.trim());
      if (mbMatch?.[1]) return Math.round(parseFloat(mbMatch[1]) * 1024 * 1024);
      const byteMatch = /^([\d.]+)\s*بايت$/.exec(text.trim());
      if (byteMatch?.[1]) return Math.round(parseFloat(byteMatch[1]));
      throw new Error(`unrecognised size label shape: "${text}"`);
    }
    const counterBytes = parseSizeLabelToBytes(counterTextBeforeSubmit);
    console.log(`  parsed counter value: ${counterBytes} bytes (source was ${ac6Buffer.length} bytes)`);
    if (counterBytes >= ac6Buffer.length) {
      fail('AC6', `counter (${counterBytes}) is not smaller than the source (${ac6Buffer.length}) — no shrink shown`);
    } else if (counterBytes > 400 * 1024) {
      fail('AC6', `counter (${counterBytes}) exceeds the 400KB image ceiling — not the downscaled size`);
    } else {
      console.log('AC6 PASSED — the size counter, read before submit, already reflects the shrunk (downscaled) size.');
    }
    await page.click('.question-submit');
    await page.waitForSelector('.question-card');

    // ===============================================================
    // AC7 — exactly ONE <audio> DOM element exists after 20 questions with
    // audio attached (never one per question, never one per preview click).
    // ===============================================================
    console.log('\n=== AC7 — one shared <audio> element across 20 questions ===');
    const ac7Wav = buildWavBuffer(1); // small, real, decodable — reused for all 20
    for (let i = 1; i <= 20; i += 1) {
      await page.click('#editor-add-question');
      await page.fill('.question-text-input', `سؤال صوتي رقم ${i}`);
      const optionInputs = page.locator('.option-text-input');
      for (let opt = 0; opt < 4; opt += 1) await optionInputs.nth(opt).fill(`خيار ${opt + 1} س${i}`);
      await page.locator('.option-correct-radio').nth(0).check();
      await page.setInputFiles('.media-file-input', {
        name: `clip-${i}.wav`,
        mimeType: 'audio/wav',
        buffer: ac7Wav,
      });
      await page.waitForSelector('.media-size-counter');
      await page.click('.question-submit');
      await page.waitForFunction(
        (n) => document.querySelectorAll('.question-card').length === n,
        i + 1, // +1 for the AC6 question already added above
      );
    }
    const audioElementCount = await page.locator('audio').count();
    console.log(`  <audio> elements in the DOM after 20 audio-bearing questions: ${audioElementCount}`);
    if (audioElementCount !== 1) {
      fail('AC7', `expected exactly 1 <audio> element, found ${audioElementCount}`);
    } else {
      console.log('AC7 PASSED — exactly one shared <audio> element, never one per question.');
    }

    console.log(
      failures === 0 ? '\nALL PH-C2 LIVE SCENARIOS PASSED (AC1-AC4, AC6, AC7)' : `\n${failures} SCENARIO(S) FAILED`,
    );
    process.exitCode = failures === 0 ? 0 : 1;
  } finally {
    if (browser) await browser.close();
    if (server) await server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
