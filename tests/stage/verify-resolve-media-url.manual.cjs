/**
 * PH-B4 / Task 1 — direct proof of `QuestionScreenParams.resolveMediaUrl`
 * (WL-B, tests/stage/). Exercises all three documented branches of
 * `resolveQuestionMediaUrl` in `src/stage/screens/question.ts`:
 *   1. absent  -> falls back to `resolveDemoMediaUrl` (zero regression path)
 *   2. present, returns a string -> that exact string is used as the URL
 *   3. present, returns null -> empty string -> the element's own `error`
 *      listener fires -> the screen's existing truthful failure copy shows
 *
 *   npx vite --port 3011 --strictPort   (separate terminal / background)
 *   node tests/stage/verify-resolve-media-url.manual.cjs
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const URL = process.env.STAGE_URL || 'http://localhost:3011/';
const OUT_DIR = path.join(__dirname, '..', '..', 'verify-out');
fs.mkdirSync(OUT_DIR, { recursive: true });

async function main() {
  const browser = await chromium.launch({ headless: true });
  const results = {};

  // ---------- Branch 1: absent -> demo resolver used (unchanged path) ----------
  {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    await page.goto(URL);
    results.branchAbsent = await page.evaluate(async () => {
      const questionMod = await import('/src/stage/screens/question.ts');
      const demoMod = await import('/src/stage/session/demo-deck.ts');
      const appRoot = document.getElementById('app');
      appRoot.innerHTML = '';
      const container = document.createElement('div');
      container.className = 'stage-root';
      appRoot.appendChild(container);
      const question = { id: 'demo-image-1', text: 'س', options: ['أ', 'ب', 'ج', 'د'], correctIndex: 0, media: { kind: 'image', sha256: 'x', ext: 'png' } };
      const expectedUrl = demoMod.resolveDemoMediaUrl('demo-image-1');
      questionMod.renderQuestionScreen(container, {
        question, optionOrder: [0, 1, 2, 3], teamNames: ['أ', 'ب'], answeringTeam: 'A', positions: [0, 0],
        revealed: false, chosenOption: null, canUndo: false,
        mediaUi: { imageBeat: 2, audio: { hasEverPlayed: false, playbackState: 'idle', optionsRevealed: false } },
        setMediaUi: () => {}, onChoose: () => {}, onNoAnswer: () => {}, onNext: () => {}, onUndo: () => {},
        // resolveMediaUrl deliberately omitted
      });
      const img = document.querySelector('.image-beat2-img');
      return { imgSrc: img?.src ?? null, expectedUrl, matches: img?.src === expectedUrl };
    });
    await page.close();
  }

  // ---------- Branch 2: provided, returns a real URL -> that URL is used, NOT the demo one ----------
  {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    await page.goto(URL);
    results.branchProvidedString = await page.evaluate(async () => {
      const questionMod = await import('/src/stage/screens/question.ts');
      const appRoot = document.getElementById('app');
      appRoot.innerHTML = '';
      const container = document.createElement('div');
      container.className = 'stage-root';
      appRoot.appendChild(container);
      // A distinctive, hand-authored data: URL standing in for "the author's
      // actual uploaded blob URL" — this is the injected seam's whole point.
      const AUTHORED_URL = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciLz4=';
      const question = { id: 'authored-q-1', text: 'س', options: ['أ', 'ب', 'ج', 'د'], correctIndex: 0, media: { kind: 'image', sha256: 'y', ext: 'svg' } };
      questionMod.renderQuestionScreen(container, {
        question, optionOrder: [0, 1, 2, 3], teamNames: ['أ', 'ب'], answeringTeam: 'A', positions: [0, 0],
        revealed: false, chosenOption: null, canUndo: false,
        mediaUi: { imageBeat: 2, audio: { hasEverPlayed: false, playbackState: 'idle', optionsRevealed: false } },
        setMediaUi: () => {}, onChoose: () => {}, onNoAnswer: () => {}, onNext: () => {}, onUndo: () => {},
        resolveMediaUrl: (q) => (q.id === 'authored-q-1' ? AUTHORED_URL : null),
      });
      const img = document.querySelector('.image-beat2-img');
      return { imgSrc: img?.src ?? null, authoredUrlUsed: img?.src === AUTHORED_URL };
    });
    await page.close();
  }

  // ---------- Branch 3: provided, returns null -> empty src -> real error state, not silently blank ----------
  {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    await page.goto(URL);
    results.branchProvidedNull = await page.evaluate(async () => {
      const questionMod = await import('/src/stage/screens/question.ts');
      const appRoot = document.getElementById('app');
      appRoot.innerHTML = '';
      const container = document.createElement('div');
      container.className = 'stage-root';
      appRoot.appendChild(container);
      const question = { id: 'missing-media-q', text: 'س', options: ['أ', 'ب', 'ج', 'د'], correctIndex: 0, media: { kind: 'image', sha256: 'z', ext: 'png' } };
      questionMod.renderQuestionScreen(container, {
        question, optionOrder: [0, 1, 2, 3], teamNames: ['أ', 'ب'], answeringTeam: 'A', positions: [0, 0],
        revealed: false, chosenOption: null, canUndo: false,
        mediaUi: { imageBeat: 2, audio: { hasEverPlayed: false, playbackState: 'idle', optionsRevealed: false } },
        setMediaUi: () => {}, onChoose: () => {}, onNoAnswer: () => {}, onNext: () => {}, onUndo: () => {},
        resolveMediaUrl: () => null,
      });
      await new Promise((r) => setTimeout(r, 300)); // let the `error` event fire
      const errorMsg = document.querySelector('.image-beat2-image-box .media-error')?.textContent ?? null;
      return { errorMsg, expected: 'تعذّر عرض الصورة لهذا السؤال. تابعوا بالسؤال نصّياً.', truthful: errorMsg === 'تعذّر عرض الصورة لهذا السؤال. تابعوا بالسؤال نصّياً.' };
    });
    await page.close();
  }

  await browser.close();
  fs.writeFileSync(path.join(OUT_DIR, 'results-resolve-media-url.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
