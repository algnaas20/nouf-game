/**
 * PH-B4 / Task 2 — editor entry point live smoke check (WL-B, tests/stage/).
 * Not a V-numbered acceptance criterion from the plan (Task 2 is a
 * coordinator-assigned integration task, not a PH-B1..B3 line item) — this
 * is the literal proof that «أسئلتي» reaches the real `mountEditor` and
 * that the way back is real, run against actual Chromium, not asserted.
 *
 *   npx vite --port 3011 --strictPort   (separate terminal / background)
 *   node tests/stage/verify-editor-entry.manual.cjs
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const URL = process.env.STAGE_URL || 'http://localhost:3011/';
const OUT_DIR = path.join(__dirname, '..', '..', 'verify-out');
fs.mkdirSync(OUT_DIR, { recursive: true });

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') pageErrors.push(m.text()); });

  await page.goto(URL);
  await page.evaluate(() => document.fonts.ready);

  const homeButtons = await page.evaluate(() => Array.from(document.querySelectorAll('.op-button')).map((b) => b.textContent));
  await page.screenshot({ path: path.join(OUT_DIR, 'stage-home-with-editor-entry.png') });

  await page.click('text=أسئلتي');
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT_DIR, 'editor-shell-opened.png') });

  const afterOpen = await page.evaluate(() => ({
    stageHidden: document.querySelector('.stage-root')?.hasAttribute('hidden'),
    editorShellPresent: !!document.querySelector('.editor-shell'),
    editorTitle: document.querySelector('.editor-shell h1')?.textContent ?? null,
    backButtonText: document.querySelector('.editor-back-button')?.textContent ?? null,
    addQuestionButtonPresent: !!document.querySelector('#editor-add-question'),
  }));

  await page.click('text=→ الرئيسية');
  await page.waitForTimeout(200);

  const afterBack = await page.evaluate(() => ({
    stageHidden: document.querySelector('.stage-root')?.hasAttribute('hidden'),
    editorShellPresent: !!document.querySelector('.editor-shell'),
    homeButtonsPresent: Array.from(document.querySelectorAll('.op-button')).map((b) => b.textContent),
  }));

  // Confirm the real game path still works after visiting and leaving the
  // editor (no leaked state, no dead click handlers).
  await page.click('text=ابدأ اللعبة');
  await page.click('text=ابدأ');
  await page.waitForTimeout(1700 + 1700);
  const reachedQuestion = await page.evaluate(() => !!document.querySelector('.question-text, .audio-question-text, .image-question-overlay, .image-beat2'));

  const result = { homeButtons, afterOpen, afterBack, reachedQuestion, pageErrors };
  fs.writeFileSync(path.join(OUT_DIR, 'results-editor-entry.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
