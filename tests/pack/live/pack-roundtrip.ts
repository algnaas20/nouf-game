/**
 * D2-7 — the authoritative, live evidence: author into a REAL browser with
 * REAL IndexedDB → "احفظ نسخة على جهازك" (the real `saveBackupToDevice`,
 * exercising its actual anchor-download fallback, captured via Playwright's
 * `download` event — not simulated) → **actually delete the IndexedDB
 * database** (`indexedDB.deleteDatabase`, the same call a host clearing
 * browsing data would trigger) → reload the page → assert the store is
 * genuinely empty → load the downloaded file back through a real
 * `<input type=file>` → import → compare every question field-by-field and
 * every media blob by SHA-256 against what was authored before the wipe.
 *
 * "A backup that has not been restored is not a backup" (task brief) — this
 * script is the restoration proof.
 *
 * Run manually: `npx tsx tests/pack/live/pack-roundtrip.ts`
 * (not wired into package.json's `test` script, matching WL-C's own
 * precedent for live scripts — see tests/editor/live/persistence-and-quota.ts).
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';
import type { FixtureQuestionSummary, ImportComparisonResult } from './browser-fixtures';

const PORT = 3012; // WL-D's assigned port for this session.
const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const QUESTION_COUNT = 15;

function deepEqualSummary(a: FixtureQuestionSummary, b: FixtureQuestionSummary): boolean {
  return (
    a.text === b.text &&
    a.correctIndex === b.correctIndex &&
    a.mediaKind === b.mediaKind &&
    a.mediaSha256 === b.mediaSha256 &&
    a.options.length === b.options.length &&
    a.options.every((opt, i) => opt === b.options[i])
  );
}

async function main(): Promise<void> {
  let server: ViteDevServer | null = null;
  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;
  let failures = 0;

  try {
    server = await createServer({
      root: ROOT,
      server: { port: PORT, strictPort: true, host: '127.0.0.1' },
      logLevel: 'warn',
    });
    await server.listen();
    const url = `http://127.0.0.1:${PORT}/tests/pack/fixtures/pack-harness.html`;

    browser = await chromium.launch();
    const context = await browser.newContext({ viewport: { width: 1280, height: 1024 }, acceptDownloads: true });
    const page = await context.newPage();
    page.on('pageerror', (err) => console.error('PAGEERROR:', err));
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.error('CONSOLE ERROR:', msg.text());
    });

    await page.goto(url);
    await page.waitForFunction(() => document.getElementById('status')?.textContent === 'ready');

    // ---- Author QUESTION_COUNT questions into the REAL IndexedDB store ----
    const originalSummaries = (await page.evaluate(
      (n) => (window as any).__addFixtureQuestions(n),
      QUESTION_COUNT,
    )) as FixtureQuestionSummary[];
    const mediaCountBefore = originalSummaries.filter((s) => s.mediaKind === 'image').length;
    console.log('D2-7 — authored questions:', originalSummaries.length, '(with media:', mediaCountBefore, ')');

    const questionCountBeforeWipe = await page.evaluate(() => (window as any).__questionCount());
    console.log('D2-7 — store question count before wipe:', questionCountBeforeWipe);
    if (questionCountBeforeWipe !== QUESTION_COUNT) {
      failures += 1;
      console.error('SETUP FAILED — question count mismatch before wipe');
    }

    // ---- "احفظ نسخة على جهازك" — the REAL saveBackupToDevice pipeline ----
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.evaluate((title) => (window as any).__triggerRealBackupDownload(title), 'اختبار حي D2-7'),
    ]);
    const downloadedFilename = download.suggestedFilename();
    console.log('D2-7 — real download captured, suggested filename:', downloadedFilename);
    const downloadPath = path.join(ROOT, 'tests/pack/live/downloaded-backup.zip');
    await download.saveAs(downloadPath);
    console.log('D2-7 — saved to disk at:', downloadPath);

    // ---- Real wipe: delete the IndexedDB database, then reload the page ----
    const wipeResult = await page.evaluate(() => (window as any).__wipeDatabase());
    console.log('D2-7 — indexedDB.deleteDatabase result:', wipeResult);
    // "blocked" is expected here, not a failure: the store's own open
    // connection on this same tab holds the database open until the page
    // navigates away, exactly like a real browser would behave with the
    // tab still open. The delete request stays pending and completes the
    // moment that connection closes — which the reload below does. The
    // real gate is the post-reload emptiness check, not this event.
    if (wipeResult !== true && wipeResult !== 'blocked') {
      failures += 1;
      console.error('WIPE FAILED — deleteDatabase reported an unexpected result:', wipeResult);
    }

    await page.reload();
    await page.waitForFunction(() => document.getElementById('status')?.textContent === 'ready');
    const questionCountAfterWipe = await page.evaluate(() => (window as any).__questionCount());
    console.log('D2-7 — store question count after wipe + page reload:', questionCountAfterWipe, '(expected 0)');
    if (questionCountAfterWipe !== 0) {
      failures += 1;
      console.error('WIPE VERIFICATION FAILED — storage was not actually empty after the wipe');
    }

    // ---- Load the downloaded file back through a REAL <input type=file> ----
    await page.setInputFiles('#import-file-input', downloadPath);
    const importResult = (await page.evaluate(
      () => (window as any).__importFileFromInput(),
    )) as ImportComparisonResult;
    console.log('D2-7 — import summary:', {
      questionCount: importResult.questionCount,
      mediaCount: importResult.mediaCount,
      verifyAllMediaOk: importResult.verifyAllMediaOk,
      verifyAllMediaCount: importResult.verifyAllMediaCount,
    });

    // ---- Field-by-field comparison, exactly as required ----
    let mismatches = 0;
    if (importResult.summaries.length !== originalSummaries.length) {
      mismatches += 1;
      console.error(
        `COUNT MISMATCH: original=${originalSummaries.length} restored=${importResult.summaries.length}`,
      );
    }
    for (let i = 0; i < originalSummaries.length; i += 1) {
      const original = originalSummaries[i]!;
      const restored = importResult.summaries[i];
      if (!restored || !deepEqualSummary(original, restored)) {
        mismatches += 1;
        console.error(`MISMATCH at index ${i}:`, { original, restored });
      }
    }
    console.log('D2-7 — questions compared field-by-field:', originalSummaries.length, '· mismatches:', mismatches);
    console.log('D2-7 — media blobs re-verified by SHA-256 (verifyAllMedia):', importResult.verifyAllMediaCount, 'ok:', importResult.verifyAllMediaOk);

    if (
      importResult.questionCount !== QUESTION_COUNT ||
      importResult.mediaCount !== mediaCountBefore ||
      mismatches !== 0 ||
      !importResult.verifyAllMediaOk ||
      importResult.verifyAllMediaCount !== mediaCountBefore
    ) {
      failures += 1;
      console.error('D2-7 FAILED');
    } else {
      console.log(
        `D2-7 PASSED — ${QUESTION_COUNT}/${QUESTION_COUNT} questions and ${mediaCountBefore}/${mediaCountBefore} media blobs restored identically after a real IndexedDB wipe.`,
      );
    }

    console.log(failures === 0 ? 'ALL PH-D2 LIVE SCENARIOS PASSED' : `${failures} LIVE SCENARIO(S) FAILED`);
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
