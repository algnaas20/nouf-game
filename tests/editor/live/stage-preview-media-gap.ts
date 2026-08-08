/**
 * PH-C3 integration-fix verification (2026-08-08 coordinator fix request).
 *
 * Verifies, against a real browser, exactly what happens today when the
 * author previews an IMAGE question and an AUDIO question, given that
 * `src/stage/screens/question.ts`'s `resolveMediaUrl?` injection point has
 * not yet landed on `main` (confirmed: `grep -r resolveMediaUrl src/` finds
 * nothing in either worktree at the time of this run). This script is
 * evidence for worklog-C3.md's fixes table, not a pass/fail gate — the
 * expected, currently-honest outcome is that both previews are broken
 * (the hardcoded demo resolver throws on an unrecognised question id), and
 * this script proves that precisely rather than asserting it from memory.
 *
 * Run manually: `npx tsx tests/editor/live/stage-preview-media-gap.ts`
 * Port: 3013.
 */

import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';

const PORT = 3013;
const ROOT = fileURLToPath(new URL('../../../', import.meta.url));

async function main(): Promise<void> {
  let server: ViteDevServer | null = null;
  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;

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
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(String(err)));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto(harnessUrl);
    await page.waitForSelector('#editor-add-question');

    // ---- Add a real IMAGE question (real file, real pipeline) ----------
    console.log('=== Adding a real image question ===');
    await page.click('#editor-add-question');
    await page.fill('.question-text-input', 'سؤال بصورة حقيقية');
    const optionInputs1 = page.locator('.option-text-input');
    for (let i = 0; i < 4; i += 1) await optionInputs1.nth(i).fill(`خيار ${i + 1}`);
    await page.locator('.option-correct-radio').nth(0).check();
    const smallJpeg = await page.evaluate(async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 400;
      canvas.height = 300;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#2255aa';
      ctx.fillRect(0, 0, 400, 300);
      const blob: Blob = await new Promise((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('no blob'))), 'image/jpeg', 0.9),
      );
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let binary = '';
      for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]!);
      return btoa(binary);
    });
    await page.setInputFiles('.media-file-input', {
      name: 'real-photo.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from(smallJpeg, 'base64'),
    });
    await page.waitForSelector('.media-size-counter');
    await page.click('.question-submit');
    await page.waitForSelector('.question-card');
    console.log('  image question added.');

    pageErrors.length = 0;
    consoleErrors.length = 0;
    console.log('=== Clicking preview on the IMAGE question ===');
    await page.locator('.preview-like-everyone-button').first().click();
    await page.waitForTimeout(300); // let any thrown error surface
    const overlayCountImg = await page.locator('.stage-preview-overlay').count();
    const stageRootChildrenImg = await page.locator('.stage-root').innerHTML().catch(() => '<no .stage-root>');
    console.log('  overlay present:', overlayCountImg > 0);
    console.log('  pageerrors:', pageErrors);
    console.log('  console errors:', consoleErrors);
    console.log('  .stage-root innerHTML length:', stageRootChildrenImg.length, '(0 or near-0 means render aborted)');
    if (overlayCountImg > 0) {
      await page.locator('.stage-preview-close-button').click().catch(() => {});
    }

    // ---- Add a real AUDIO question --------------------------------------
    console.log('\n=== Adding a real audio question ===');
    await page.click('#editor-add-question');
    await page.fill('.question-text-input', 'سؤال بصوت حقيقي');
    const optionInputs2 = page.locator('.option-text-input');
    for (let i = 0; i < 4; i += 1) await optionInputs2.nth(i).fill(`خيار ${i + 1}`);
    await page.locator('.option-correct-radio').nth(0).check();
    // Minimal real WAV (silence, ~0.2s) — built by hand, no library needed.
    const wavBuffer = (() => {
      const numSamples = Math.floor(0.2 * 44100);
      const blockAlign = 4;
      const dataSize = numSamples * blockAlign;
      const buffer = Buffer.alloc(44 + dataSize);
      buffer.write('RIFF', 0, 'ascii');
      buffer.writeUInt32LE(36 + dataSize, 4);
      buffer.write('WAVE', 8, 'ascii');
      buffer.write('fmt ', 12, 'ascii');
      buffer.writeUInt32LE(16, 16);
      buffer.writeUInt16LE(1, 20);
      buffer.writeUInt16LE(2, 22);
      buffer.writeUInt32LE(44100, 24);
      buffer.writeUInt32LE(44100 * blockAlign, 28);
      buffer.writeUInt16LE(blockAlign, 32);
      buffer.writeUInt16LE(16, 34);
      buffer.write('data', 36, 'ascii');
      buffer.writeUInt32LE(dataSize, 40);
      return buffer;
    })();
    await page.setInputFiles('.media-file-input', {
      name: 'real-clip.wav',
      mimeType: 'audio/wav',
      buffer: wavBuffer,
    });
    await page.waitForSelector('.media-size-counter');
    await page.click('.question-submit');
    await page.waitForFunction(() => document.querySelectorAll('.question-card').length === 2);
    console.log('  audio question added.');

    pageErrors.length = 0;
    consoleErrors.length = 0;
    console.log('=== Clicking preview on the AUDIO question ===');
    await page.locator('.preview-like-everyone-button').nth(1).click();
    await page.waitForTimeout(300);
    const overlayCountAudio = await page.locator('.stage-preview-overlay').count();
    const stageRootChildrenAudio = await page.locator('.stage-root').innerHTML().catch(() => '<no .stage-root>');
    console.log('  overlay present:', overlayCountAudio > 0);
    console.log('  pageerrors:', pageErrors);
    console.log('  console errors:', consoleErrors);
    console.log('  .stage-root innerHTML length:', stageRootChildrenAudio.length, '(0 or near-0 means render aborted)');

    console.log('\n=== Conclusion ===');
    console.log(
      'Both previews are expected to fail today (uncaught exception from resolveDemoMediaUrl on an unrecognised',
      'question id) until src/stage/screens/question.ts declares and reads resolveMediaUrl — this is a real,',
      'upstream (WL-B) dependency, not something fixable from src/editor/**.',
    );
  } finally {
    if (browser) await browser.close();
    if (server) await server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
