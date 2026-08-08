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
  // `mountApp` is now async (F-1 fix, worklog-B5.md: it awaits the real
  // `DraftStore.load()` before its first render) — a brief gap versus the
  // previous fully-synchronous-on-load home screen. Waiting for the real
  // button here rather than assuming it is already painted.
  await page.waitForSelector('button:has-text("أسئلتي")');
  await page.evaluate(() => document.fonts.ready);

  const homeButtons = await page.evaluate(() => Array.from(document.querySelectorAll('.op-button')).map((b) => b.textContent));
  await page.screenshot({ path: path.join(OUT_DIR, 'stage-home-with-editor-entry.png') });

  // D-25 / F-1 (worklog-B5.md, 2026-08-08): a bare `text=أسئلتي` selector is
  // now ambiguous — the zero-question home screen's own new guidance line
  // ("...من «أسئلتي»...") contains the button's label as a substring
  // (worklog-B4.md §D.1's own documented trap class, re-triggered by this
  // session's new copy). Scoped to `button:has-text` throughout.
  await page.click('button:has-text("أسئلتي")');
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT_DIR, 'editor-shell-opened.png') });

  const afterOpen = await page.evaluate(() => ({
    stageHidden: document.querySelector('.stage-root')?.hasAttribute('hidden'),
    editorShellPresent: !!document.querySelector('.editor-shell'),
    editorTitle: document.querySelector('.editor-shell h1')?.textContent ?? null,
    backButtonText: document.querySelector('.editor-back-button')?.textContent ?? null,
    addQuestionButtonPresent: !!document.querySelector('#editor-add-question'),
  }));

  // Author ONE real question while inside the editor — D-25's own model:
  // the game only ever plays what was authored, so "the real game path
  // still works after visiting the editor" now means AFTER AUTHORING
  // SOMETHING, not against a bundled demo deck that no longer exists.
  await page.click('#editor-add-question');
  await page.fill('.question-text-input', 'سؤال مدخل المحرّر');
  const opts = await page.$$('.option-text-input');
  await opts[0].fill('أ'); await opts[1].fill('ب'); await opts[2].fill('ج'); await opts[3].fill('د');
  await page.check('.option-row[data-option-index="0"] .option-correct-radio');
  await page.click('.question-submit');
  await page.waitForTimeout(150);

  await page.click('button:has-text("→ الرئيسية")');
  await page.waitForTimeout(200);

  const afterBack = await page.evaluate(() => ({
    stageHidden: document.querySelector('.stage-root')?.hasAttribute('hidden'),
    editorShellPresent: !!document.querySelector('.editor-shell'),
    homeButtonsPresent: Array.from(document.querySelectorAll('.op-button')).map((b) => b.textContent),
    questionCountShown: document.querySelector('.home-guidance-line')?.textContent ?? null,
  }));

  // Confirm the real game path still works after visiting and leaving the
  // editor (no leaked state, no dead click handlers) — but with only ONE
  // authored question, team-setup's readiness gate correctly refuses every
  // track (D=1 < refuseThreshold at N=6), so "reached a question" is no
  // longer the right claim to make here; the gate itself is the thing now
  // being proven not to have regressed.
  await page.click('button:has-text("ابدأ اللعبة")');
  const gateState = await page.evaluate(() => {
    const confirmBtn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.trim() === 'ابدأ');
    return { confirmDisabled: confirmBtn?.disabled ?? null, bandLine: document.querySelector('.deck-band-line')?.textContent ?? null };
  });
  await page.waitForTimeout(200);

  const result = { homeButtons, afterOpen, afterBack, gateState, pageErrors };
  fs.writeFileSync(path.join(OUT_DIR, 'results-editor-entry.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
