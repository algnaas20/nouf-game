/**
 * Live-browser evidence for PH-C1 AC1 and AC2 — the two criteria whose
 * literal wording ("reload the page", "a screenshot") only a real browser
 * and a real IndexedDB can honestly satisfy. Everything else in this phase
 * is proven by tests/editor/*.test.ts (fast, deterministic, fake backend).
 *
 * Run manually: `npx tsx tests/editor/live/persistence-and-quota.ts`
 * (not wired into package.json's `test` script — package.json is WL-D-owned
 * and out of scope for this line to edit).
 *
 * Uses the vite dev server's JS API directly (no child process to spawn or
 * kill — nothing to leak a PID for) on port 3012, and a brand-new,
 * ephemeral Playwright browser context (no persistent profile dir), so a
 * fresh IndexedDB is guaranteed at the start of every run.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';

const PORT = 3012; // WL-C editor — executor-prompts-2026-08-07.md port table.
const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const EXPECTED_QUOTA_MESSAGE =
  'لم يعد هناك مكان للمسودة — احفظ لعبتك في الكمبيوتر الآن';

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
    const url = `http://127.0.0.1:${PORT}/tests/editor/fixtures/editor-harness.html`;

    browser = await chromium.launch();
    const context = await browser.newContext({ viewport: { width: 1280, height: 1024 } });
    const page = await context.newPage();
    page.on('pageerror', (err) => console.error('PAGEERROR:', err));
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.error('CONSOLE ERROR:', msg.text());
    });

    await page.goto(url);
    await page.waitForSelector('#editor-add-question');

    // ---- AC1: 50 questions survive a real page reload, in order --------
    for (let i = 1; i <= 50; i += 1) {
      await page.click('#editor-add-question');
      await page.fill('.question-text-input', `سؤال حي رقم ${i}`);
      const optionInputs = page.locator('.option-text-input');
      for (let opt = 0; opt < 4; opt += 1) {
        await optionInputs.nth(opt).fill(`خيار ${opt + 1} للسؤال ${i}`);
      }
      await page.locator('.option-correct-radio').nth(0).check();
      await page.click('.question-submit');
      await page.waitForFunction(
        (n) => document.querySelectorAll('.question-card').length === n,
        i,
      );
    }

    const countBeforeReload = await page.locator('.question-card').count();
    console.log('AC1 — questions present before reload:', countBeforeReload);

    await page.reload();
    await page.waitForSelector('.return-prompt-continue');
    await page.click('.return-prompt-continue');
    await page.waitForSelector('.question-card');
    await page.waitForFunction(() => document.querySelectorAll('.question-card').length === 50);

    const cardsAfterReload = await page
      .locator('.question-card .question-text-preview')
      .allTextContents();
    console.log('AC1 — questions present after a REAL browser reload:', cardsAfterReload.length);
    const expected = Array.from({ length: 50 }, (_, i) => `سؤال حي رقم ${i + 1}`);
    const orderMatches = JSON.stringify(cardsAfterReload) === JSON.stringify(expected);
    console.log('AC1 — order matches the order they were created in:', orderMatches);
    if (cardsAfterReload.length !== 50 || !orderMatches) {
      failures += 1;
      console.error('AC1 FAILED');
    } else {
      console.log('AC1 PASSED — 50/50 present in original order after a real browser reload.');
    }

    // ---- AC2: QuotaExceededError banner, save button inside it ----------
    await page.evaluate(() => {
      (window as unknown as { __forceNextPutQuotaError: () => void }).__forceNextPutQuotaError();
    });
    await page.click('#editor-add-question');
    await page.fill('.question-text-input', 'سؤال سيفشل كتابته');
    const optionInputs2 = page.locator('.option-text-input');
    for (let opt = 0; opt < 4; opt += 1) await optionInputs2.nth(opt).fill(`خيار ${opt + 1}`);
    await page.locator('.option-correct-radio').nth(1).check();
    await page.click('.question-submit');

    await page.locator('.storage-full-banner').waitFor({ state: 'visible' });
    const bannerText = await page.locator('.storage-full-banner-message').textContent();
    const buttonInsideBanner = await page
      .locator('.storage-full-banner .storage-full-banner-save-button')
      .count();
    console.log('AC2 — banner text:', bannerText);
    console.log('AC2 — save button is inside the banner element:', buttonInsideBanner === 1);
    const countAfterFailedWrite = await page.locator('.question-card').count();
    console.log(
      'AC2 — question count unchanged after the failed write:',
      countAfterFailedWrite,
      '(expected 50 — the write was not silently dropped as a phantom success)',
    );
    if (
      bannerText !== EXPECTED_QUOTA_MESSAGE ||
      buttonInsideBanner !== 1 ||
      countAfterFailedWrite !== 50
    ) {
      failures += 1;
      console.error('AC2 FAILED');
    } else {
      console.log('AC2 PASSED');
    }

    const screenshotPath = path.join(ROOT, 'tests/editor/live/storage-full-banner-live.png');
    await page.locator('.storage-full-banner').scrollIntoViewIfNeeded();
    await page.locator('.storage-full-banner').screenshot({ path: screenshotPath });
    console.log('AC2 screenshot saved:', screenshotPath);

    console.log(failures === 0 ? 'ALL LIVE SCENARIOS PASSED' : `${failures} LIVE SCENARIO(S) FAILED`);
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
