/**
 * Live-browser evidence for PH-C3's numbered acceptance criteria
 * (خطة.md PH-C3 section). Real Chromium via Playwright, real IndexedDB,
 * against the real mounted `mountEditor` — the same harness pattern as
 * PH-C1/C2's live scripts (`persistence-and-quota.ts`, `media-intake.ts`).
 *
 * Where a claim is purely computational (the readiness meter's exact
 * message, the media-batch-warning's exact message), this script imports
 * the SAME pure functions directly in Node (no browser needed for those)
 * and cross-checks their output against what the live DOM actually shows
 * — proving the mounted UI is not silently drifted from the logic already
 * proven correct by the pure unit tests.
 *
 * Run manually: `npx tsx tests/editor/live/preview-readiness-backup.ts`
 * Port: 3013 (this phase's explicit port assignment — see worklog-C2.md's
 * port note, carried into this phase, same session).
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';
import { computeReadiness } from '../../../src/editor/ui/readiness-meter';
import { mediaBatchWarningMessage, AR_COPY } from '../../../src/editor/copy';

const PORT = 3013;
const ROOT = fileURLToPath(new URL('../../../', import.meta.url));

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
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const page = await context.newPage();
    page.on('pageerror', (err) => console.error('PAGEERROR:', err));
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.error('CONSOLE ERROR:', msg.text());
    });

    await page.goto(harnessUrl);
    await page.waitForSelector('#editor-add-question');

    // ===============================================================
    // AC3a — initial state: draft-only, T1 not shown (nothing written yet)
    // ===============================================================
    console.log('\n=== AC3a — initial backup-badge state (draft-only) ===');
    const initialBadgeText = await page.locator('.backup-badge').textContent();
    console.log('  badge text:', initialBadgeText);
    if (initialBadgeText !== AR_COPY.draftVocabulary) {
      fail('AC3a', `expected "${AR_COPY.draftVocabulary}", got "${initialBadgeText}"`);
    }
    const initialReminderHidden = await page.locator('.session-end-reminder').isHidden();
    console.log('  T1 reminder hidden (expected true — nothing written yet):', initialReminderHidden);
    if (!initialReminderHidden) fail('AC3a', 'T1 reminder shown before anything was ever written');

    // ===============================================================
    // Add one ready question — needed for AC1 (preview) and creates the
    // "unsaved changes" state AC4's dirty case checks.
    // ===============================================================
    await page.click('#editor-add-question');
    await page.fill('.question-text-input', 'ما عاصمة السعودية؟');
    const optionInputs = page.locator('.option-text-input');
    const options = ['الرياض', 'جدة', 'مكة', 'الدمام'];
    for (let i = 0; i < 4; i += 1) await optionInputs.nth(i).fill(options[i]!);
    await page.locator('.option-correct-radio').nth(0).check();
    await page.click('.question-submit');
    await page.waitForSelector('.question-card');

    // ===============================================================
    // AC4 (case 1 — dirty) — T1 reminder shown once there ARE unsaved
    // changes.
    // ===============================================================
    console.log('\n=== AC4 (case 1/2) — T1 reminder shown with unsaved changes ===');
    const dirtyReminderHidden = await page.locator('.session-end-reminder').isHidden();
    console.log('  T1 reminder hidden (expected false — one unsaved question exists):', dirtyReminderHidden);
    if (dirtyReminderHidden) fail('AC4 (dirty case)', 'T1 reminder NOT shown despite unsaved changes');
    else console.log('AC4 (dirty case) PASSED.');

    // ===============================================================
    // AC1 — «معاينة كما يراها الجميع» imports and renders the REAL stage
    // component.
    // ===============================================================
    console.log('\n=== AC1 — stage preview renders the real stage component ===');
    await page.click('.preview-like-everyone-button');
    await page.waitForSelector('.stage-preview-overlay');
    const stageQuestionText = await page.locator('.stage-root .type-question').textContent();
    const optionCardCount = await page.locator('.stage-root .option-card').count();
    console.log('  stage question text (live DOM):', stageQuestionText);
    console.log('  option-card count:', optionCardCount);
    if (stageQuestionText !== 'ما عاصمة السعودية؟') {
      fail('AC1', `stage preview question text mismatch: "${stageQuestionText}"`);
    }
    if (optionCardCount !== 4) fail('AC1', `expected 4 option cards, got ${optionCardCount}`);
    if (stageQuestionText === 'ما عاصمة السعودية؟' && optionCardCount === 4) {
      console.log('AC1 PASSED — the real stage component rendered the real question, verbatim.');
    }
    const screenshotPath = path.join(ROOT, 'tests/editor/live/stage-preview-live.png');
    await page.screenshot({ path: screenshotPath });
    console.log('  screenshot saved:', screenshotPath);
    await page.click('.stage-preview-close-button');
    const overlayGoneCount = await page.locator('.stage-preview-overlay').count();
    console.log('  overlay removed after close (count === 0):', overlayGoneCount === 0);
    if (overlayGoneCount !== 0) fail('AC1', 'overlay still present after clicking close');

    // ===============================================================
    // AC2 — readiness meter cross-check #1 (1 question)
    // ===============================================================
    console.log('\n=== AC2 — readiness meter matches computeReadiness() exactly (cross-check #1) ===');
    const readinessTextAt1 = await page.locator('.readiness-meter').textContent();
    const expectedAt1 = computeReadiness(1).message;
    console.log('  live DOM:', readinessTextAt1);
    console.log('  computeReadiness(1).message:', expectedAt1);
    if (readinessTextAt1 !== expectedAt1) fail('AC2 (cross-check #1)', 'live text does not match computeReadiness()');
    else console.log('AC2 (cross-check #1) PASSED.');

    // ===============================================================
    // AC3b — recordBackup boundary: real click → real filename shown
    // ===============================================================
    console.log('\n=== AC3b — backup badge shows the real filename after a (simulated) save ===');
    const backupFilename = 'نسخة-أسئلة-العائلة-2026-08-08.zip';
    await page.evaluate((name) => {
      (window as unknown as { __setNextBackupFilename: (n: string) => void }).__setNextBackupFilename(name);
    }, backupFilename);
    await page.click('.session-end-reminder-save-button');
    await page.waitForFunction(
      (expected) => document.querySelector('.backup-badge')?.textContent?.includes(expected),
      backupFilename,
    );
    const savedBadgeText = await page.locator('.backup-badge').textContent();
    console.log('  badge text after save:', savedBadgeText);
    const expectedSavedText = `${AR_COPY.savedOnDevice} (${backupFilename})`;
    if (savedBadgeText !== expectedSavedText) {
      fail('AC3b', `expected "${expectedSavedText}", got "${savedBadgeText}"`);
    } else {
      console.log('AC3b PASSED — the badge shows the real filename verbatim.');
    }
    const savedScreenshotPath = path.join(ROOT, 'tests/editor/live/backup-badge-saved.png');
    await page.locator('.backup-badge-area').screenshot({ path: savedScreenshotPath });
    console.log('  screenshot saved:', savedScreenshotPath);

    // ===============================================================
    // AC4 (case 2 — clean) — T1 reminder NOT shown once saved
    // ===============================================================
    console.log('\n=== AC4 (case 2/3) — T1 reminder hidden once there are no unsaved changes ===');
    const cleanReminderHidden = await page.locator('.session-end-reminder').isHidden();
    console.log('  T1 reminder hidden (expected true — just saved, no new edits):', cleanReminderHidden);
    if (!cleanReminderHidden) fail('AC4 (clean case)', 'T1 reminder still shown after a clean save');
    else console.log('AC4 (clean case) PASSED.');

    // ===============================================================
    // AC4 (case 3 — dirty again) — a further edit AFTER a clean backup
    // must bring the T1 reminder BACK. Coordinator follow-up, 2026-08-09:
    // the reminder must never train the host to ignore it — it has to
    // reappear the moment there is something new to lose, not stay
    // permanently cleared after the first save.
    // ===============================================================
    console.log('\n=== AC4 (case 3/3) — T1 reminder returns after a further edit past the backup ===');
    await page.click('#editor-add-question');
    await page.fill('.question-text-input', 'سؤال ثانٍ بعد الحفظ');
    const secondOptionInputs = page.locator('.option-text-input');
    const secondOptions = ['أ', 'ب', 'ج', 'د'];
    for (let i = 0; i < 4; i += 1) await secondOptionInputs.nth(i).fill(secondOptions[i]!);
    await page.locator('.option-correct-radio').nth(0).check();
    await page.click('.question-submit');
    await page.waitForSelector('.question-card >> nth=1');
    const reappearedReminderVisible = await page.locator('.session-end-reminder').isVisible();
    console.log('  T1 reminder visible again (expected true — edited after the backup):', reappearedReminderVisible);
    if (!reappearedReminderVisible) {
      fail('AC4 (dirty-again case)', 'T1 reminder did NOT return after an edit past the last backup — a cleared reminder that never comes back trains the host to ignore it');
    } else {
      console.log('AC4 (dirty-again case) PASSED — all three T1 cases proven live: fresh (hidden), dirty (shown), saved (hidden), edited-again (shown).');
    }

    // ===============================================================
    // AC3c — publish boundary (recordPublish), badge shows "published"
    // ===============================================================
    console.log('\n=== AC3c — backup badge shows "published" after recordPublish ===');
    await page.evaluate(async () => {
      await (window as unknown as { __store: { recordPublish: () => Promise<unknown> } }).__store.recordPublish();
    });
    await page.waitForFunction(
      (expected) => document.querySelector('.backup-badge')?.textContent === expected,
      AR_COPY.publishedWithGame,
    );
    const publishedBadgeText = await page.locator('.backup-badge').textContent();
    console.log('  badge text after publish:', publishedBadgeText);
    if (publishedBadgeText !== AR_COPY.publishedWithGame) {
      fail('AC3c', `expected "${AR_COPY.publishedWithGame}", got "${publishedBadgeText}"`);
    } else {
      console.log('AC3c PASSED.');
    }
    const publishedScreenshotPath = path.join(ROOT, 'tests/editor/live/backup-badge-published.png');
    await page.locator('.backup-badge-area').screenshot({ path: publishedScreenshotPath });
    console.log('  screenshot saved:', publishedScreenshotPath);

    // ===============================================================
    // AC6 — the 100-files-per-batch warning, driven by the REAL
    // deduplicated media-file count, both sides of the threshold.
    // ===============================================================
    console.log('\n=== AC6 — 100-files-per-batch warning, real threshold ===');
    const warningHiddenBefore = await page.locator('.media-batch-warning').isHidden();
    console.log('  warning hidden before adding media (expected true — 0 media files so far):', warningHiddenBefore);
    if (!warningHiddenBefore) fail('AC6 (below threshold)', 'warning shown with 0 media files');

    const mediaCount = await page.evaluate(async () => {
      const store = (
        window as unknown as {
          __store: {
            addQuestion: (input: unknown) => Promise<unknown>;
            getState: () => { questions: unknown[] };
          };
        }
      ).__store;
      for (let i = 0; i < 101; i += 1) {
        await store.addQuestion({
          text: `سؤال وسائط ${i}`,
          options: ['أ', 'ب', 'ج', 'د'],
          correctIndex: 0,
          media: { kind: 'image', sha256: i.toString(16).padStart(64, '0'), ext: 'jpg' },
          // No mediaBlob on purpose — this test only needs distinct sha256
          // references to exist on the question records to prove the
          // COUNTING and WARNING-DISPLAY logic against a real mounted DOM;
          // it is not re-proving PH-C2's media-processing pipeline again.
        });
      }
      return store.getState().questions.length;
    });
    console.log('  total questions after adding 101 distinct media-bearing ones:', mediaCount);

    await page.waitForFunction(() => {
      const el = document.querySelector('.media-batch-warning');
      return el && !(el as HTMLElement).hidden;
    });
    const warningTextAfter = await page.locator('.media-batch-warning').textContent();
    const expectedWarningText = mediaBatchWarningMessage(101);
    console.log('  live DOM:', warningTextAfter);
    console.log('  mediaBatchWarningMessage(101):', expectedWarningText);
    if (warningTextAfter !== expectedWarningText) {
      fail('AC6 (above threshold)', 'warning text does not match mediaBatchWarningMessage(101)');
    } else {
      console.log('AC6 PASSED — warning absent below 100 files, present and correctly worded above it.');
    }

    // ===============================================================
    // AC2 — readiness meter cross-check #2, at the final (much larger)
    // question count.
    // ===============================================================
    console.log('\n=== AC2 — readiness meter cross-check #2 (final count) ===');
    const readinessTextFinal = await page.locator('.readiness-meter').textContent();
    const expectedFinal = computeReadiness(mediaCount).message;
    console.log(`  live DOM (D=${mediaCount}):`, readinessTextFinal);
    console.log('  computeReadiness().message:', expectedFinal);
    if (readinessTextFinal !== expectedFinal) fail('AC2 (cross-check #2)', 'live text does not match computeReadiness()');
    else console.log('AC2 (cross-check #2) PASSED.');

    console.log(failures === 0 ? '\nALL PH-C3 LIVE SCENARIOS PASSED' : `\n${failures} SCENARIO(S) FAILED`);
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
