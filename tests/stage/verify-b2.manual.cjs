/**
 * PH-B2 verification driver — WL-B, tests/stage/ (owned by this line).
 * Same discipline as verify-b1.manual.cjs: NOT wired into `npm test` (needs
 * a real Chromium via Playwright, and `package.json` is WL-D's). Run:
 *
 *   npx vite --port 3011 --strictPort   (separate terminal)
 *   node tests/stage/verify-b2.manual.cjs
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const URL = process.env.STAGE_URL || 'http://localhost:3011/';
const OUT_DIR = path.join(__dirname, '..', '..', 'verify-out');
fs.mkdirSync(OUT_DIR, { recursive: true });

const F1 = { id: 'fx-f1', text: 'ما اللون؟', options: ['أحمر', 'أزرق', 'أصفر', 'أخضر'], correctIndex: 1 };
const F2_TEXT = 'ما اسم أطول نهر في العالم وأين يقع بالتحديد ولماذا يعتبر من أهم الأنهار على مستوى الكرة الأرضية عبر التاريخ الطويل لحضارات الإنسان القديمة والحديثة عل';
const F2_OPTIONS = [
  'نهر النيل في قارة أفريقيا وهو الأطول عالمياً كلمة ',
  'نهر الأمازون في قارة أمريكا الجنوبية الكبرى كلمة إ',
  'نهر المسيسيبي في قارة أمريكا الشمالية هناك كلمة إض',
  'نهر اليانغتسي في قارة آسيا الشرقية البعيدة كلمة إض',
];

async function main() {
  const browser = await chromium.launch({ headless: true });
  const results = {};

  // ---------- No-tell (V20/V21) across all THREE screen types ----------
  {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    await page.goto(URL);
    await page.evaluate(() => document.fonts.ready);
    results.noTell = await page.evaluate(
      async ({ F1 }) => {
        const chrome = await import('/src/stage/screens/chrome.ts');
        const appRoot = document.getElementById('app');
        appRoot.innerHTML = '';
        const container = document.createElement('div');
        container.className = 'stage-root';
        appRoot.appendChild(container);
        const safe = document.createElement('div');
        safe.className = 'stage-safe';
        container.appendChild(safe);

        function checkOnce(revealed, disabled) {
          const { grid, cards } = chrome.buildOptionsGrid({
            question: F1,
            optionOrder: [0, 1, 2, 3],
            revealed,
            chosenOption: revealed ? 1 : null,
            disabled,
            onChoose: () => {},
          });
          safe.appendChild(grid);
          const props = ['borderColor', 'borderWidth', 'backgroundColor', 'boxShadow', 'opacity', 'fontWeight', 'blockSize', 'inlineSize', 'borderRadius'];
          const styles = cards.map((c) => {
            const cs = getComputedStyle(c);
            const snap = {};
            for (const p of props) snap[p] = cs[p];
            return snap;
          });
          const allIdentical = styles.every((s) => JSON.stringify(s) === JSON.stringify(styles[0]));
          const heights = cards.map((c) => c.getBoundingClientRect().height);
          const heightsEqual = heights.every((h) => Math.abs(h - heights[0]) < 0.5);
          const leaks = [];
          for (const c of cards) {
            for (const attr of c.getAttributeNames()) {
              if (attr === 'class' || attr === 'type' || attr === 'data-option-index' || attr === 'disabled') continue;
              leaks.push(attr);
            }
          }
          grid.remove();
          return { allIdentical, heights, heightsEqual, leaks };
        }

        return {
          preReveal_notDisabled: checkOnce(false, false),
          preReveal_disabled_audioConcealed: checkOnce(false, true),
        };
      },
      { F1 },
    );
    await page.close();
  }

  // ---------- Red->green mutation proof for no-tell ----------
  {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    await page.goto(URL);
    results.noTellMutation = await page.evaluate(async ({ F1 }) => {
      const chrome = await import('/src/stage/screens/chrome.ts');
      const appRoot = document.getElementById('app');
      appRoot.innerHTML = '';
      const container = document.createElement('div');
      container.className = 'stage-root';
      appRoot.appendChild(container);

      // BEFORE (mutated): simulate a leak by manually adding a
      // correctness-encoding attribute to the correct card, mirroring
      // what a real regression would look like.
      const before = chrome.buildOptionsGrid({
        question: F1, optionOrder: [0, 1, 2, 3], revealed: false, chosenOption: null, disabled: false, onChoose: () => {},
      });
      container.appendChild(before.grid);
      for (const c of before.cards) {
        if (Number(c.dataset.optionIndex) === F1.correctIndex) c.dataset.correct = 'true';
      }
      const leaksBefore = [];
      for (const c of before.cards) {
        for (const attr of c.getAttributeNames()) {
          if (attr === 'class' || attr === 'type' || attr === 'data-option-index' || attr === 'disabled') continue;
          leaksBefore.push(attr);
        }
      }
      before.grid.remove();

      // AFTER (real code, unmutated).
      const after = chrome.buildOptionsGrid({
        question: F1, optionOrder: [0, 1, 2, 3], revealed: false, chosenOption: null, disabled: false, onChoose: () => {},
      });
      container.appendChild(after.grid);
      const leaksAfter = [];
      for (const c of after.cards) {
        for (const attr of c.getAttributeNames()) {
          if (attr === 'class' || attr === 'type' || attr === 'data-option-index' || attr === 'disabled') continue;
          leaksAfter.push(attr);
        }
      }
      after.grid.remove();
      return { leaksBefore, leaksAfter };
    }, { F1 });
    await page.close();
  }

  // ---------- Combined overlap fix (successor to worklog-B1.md §V4b) ----------
  {
    const overlap = {};
    for (const scale of ['100', '115', '130']) {
      const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
      await page.goto(URL);
      await page.evaluate((s) => document.documentElement.setAttribute('data-scale', s), scale);
      overlap[scale] = await page.evaluate(
        async ({ F2_TEXT, F2_OPTIONS }) => {
          const mod = await import('/src/stage/screens/question-text.ts');
          const appRoot = document.getElementById('app');
          appRoot.innerHTML = '';
          const container = document.createElement('div');
          container.className = 'stage-root';
          appRoot.appendChild(container);
          mod.renderTextQuestionScreen(container, {
            question: { id: 'fx-f2', text: F2_TEXT, options: F2_OPTIONS, correctIndex: 0, media: { kind: 'none' } },
            optionOrder: [0, 1, 2, 3],
            teamNames: ['الفريق الأزرق', 'الفريق البرتقالي'],
            answeringTeam: 'A',
            positions: [0, 0],
            revealed: false,
            chosenOption: null,
            canUndo: false,
            onChoose: () => {},
            onNoAnswer: () => {},
            onNext: () => {},
            onUndo: () => {},
          });
          await document.fonts.ready;
          await new Promise((r) => setTimeout(r, 80));
          const qBox = document.querySelector('.question-text');
          const grid = document.querySelector('.options-grid');
          return { overlapPx: qBox.getBoundingClientRect().bottom - grid.getBoundingClientRect().top };
        },
        { F2_TEXT, F2_OPTIONS },
      );
      await page.close();
    }
    results.combinedOverlap = overlap;
  }

  // ---------- Red->green for the overlap fix: disable fitCombinedLayout ----------
  {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    await page.goto(URL);
    await page.evaluate((s) => document.documentElement.setAttribute('data-scale', s), '130');
    results.overlapMutation = await page.evaluate(
      async ({ F2_TEXT, F2_OPTIONS }) => {
        const fitTextMod = await import('/src/stage/fit-text.ts');
        const layoutMod = await import('/src/stage/options-layout.ts');
        const appRoot = document.getElementById('app');
        appRoot.innerHTML = '';
        const container = document.createElement('div');
        container.className = 'stage-root';
        appRoot.appendChild(container);
        const safe = document.createElement('div');
        safe.className = 'stage-safe';
        container.appendChild(safe);

        const chrome = await import('/src/stage/screens/chrome.ts');
        const undoMod = await import('/src/stage/undo-corner.ts');
        const status = chrome.buildStatusStrip(['الفريق الأزرق', 'الفريق البرتقالي'], [0, 0]);
        const header = chrome.buildTurnHeader('الفريق الأزرق', 'الفريق البرتقالي');
        const qArea = document.createElement('div');
        qArea.className = 'question-area';
        const qText = document.createElement('p');
        qText.className = 'question-text type-question';
        qText.textContent = F2_TEXT;
        qArea.appendChild(qText);
        const { grid, cards, textEls } = chrome.buildOptionsGrid({
          question: { id: 'fx', text: F2_TEXT, options: F2_OPTIONS, correctIndex: 0, media: { kind: 'none' } },
          optionOrder: [0, 1, 2, 3], revealed: false, chosenOption: null, disabled: false, onChoose: () => {},
        });
        const bar = chrome.buildOperatorBar({ revealed: false, onNoAnswer: () => {}, onNext: () => {} });
        safe.append(status, header, qArea, grid, bar, undoMod.buildUndoCorner(false, () => {}));
        layoutMod.decideOptionsLayout(grid, textEls);
        layoutMod.equalizeCardHeights(cards);
        await document.fonts.ready;
        const nominalPx = parseFloat(getComputedStyle(qText).fontSize);
        const floorPx = nominalPx * (56 / 76);
        fitTextMod.fitQuestionText(qText, { nominalPx, floorPx, lineHeight: 1.9 });
        await new Promise((r) => setTimeout(r, 50));
        // BEFORE: fitCombinedLayout NOT called (mutated — the fix disabled,
        // matching what question-text.ts did before PH-B2's re-fix).
        const before = qText.getBoundingClientRect().bottom - grid.getBoundingClientRect().top;

        // AFTER: apply the real fix.
        const combinedMod = await import('/src/stage/fit-combined.ts');
        const result = combinedMod.fitCombinedLayout({
          safeEl: safe, questionAreaEl: qArea, questionTextEl: qText, optionsGridEl: grid, optionCards: cards,
          nominalQuestionPx: nominalPx, floorQuestionPx: floorPx, questionLineHeight: 1.9,
        });
        const after = qText.getBoundingClientRect().bottom - grid.getBoundingClientRect().top;
        return { before, after, reportedFinalOverlapPx: result.finalOverlapPx, optionShrink: result.optionShrink, gapScale: result.gapScale, questionLines: result.questionLines };
      },
      { F2_TEXT, F2_OPTIONS },
    );
    await page.close();
  }

  // ---------- Image floor (V11) — F3 landscape, F4 portrait, Beat 2 ----------
  {
    const floor = {};
    for (const aspect of ['landscape', 'portrait']) {
      const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
      await page.goto(URL);
      floor[aspect] = await page.evaluate(async (aspect) => {
        const placeholder = await import('/src/stage/session/placeholder-media.ts');
        const mod = await import('/src/stage/screens/question-image.ts');
        const appRoot = document.getElementById('app');
        appRoot.innerHTML = '';
        const container = document.createElement('div');
        container.className = 'stage-root';
        appRoot.appendChild(container);
        const url = placeholder.makePlaceholderImageDataUrl({ label: 'x', aspect, seed: 1 });
        let uiState = { imageBeat: 2, audio: { hasEverPlayed: false, playbackState: 'idle', optionsRevealed: false } };
        mod.renderImageQuestionScreen(container, {
          question: { id: 'fx-img', text: 'سؤال', options: ['أ', 'ب', 'ج', 'د'], correctIndex: 0, media: { kind: 'image', sha256: 'x', ext: 'png' } },
          imageUrl: url,
          optionOrder: [0, 1, 2, 3],
          teamNames: ['الفريق الأزرق', 'الفريق البرتقالي'],
          answeringTeam: 'A',
          positions: [0, 0],
          revealed: false,
          chosenOption: null,
          canUndo: false,
          mediaUi: uiState,
          setMediaUi: () => {},
          onChoose: () => {}, onNoAnswer: () => {}, onNext: () => {}, onUndo: () => {},
        });
        await new Promise((r) => setTimeout(r, 50));
        const box = document.querySelector('.image-beat2-image-box');
        const rect = box.getBoundingClientRect();
        return { width: rect.width, height: rect.height, meetsFloor: rect.width >= 620 && rect.height >= 620 };
      }, aspect);
      await page.close();
    }
    results.imageFloor = floor;
  }

  // ---------- V22: broken audio source truthfulness ----------
  {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    await page.goto(URL);
    results.audioTruthfulness = await page.evaluate(async () => {
      const placeholder = await import('/src/stage/session/placeholder-media.ts');
      const mod = await import('/src/stage/screens/question-audio.ts');
      const appRoot = document.getElementById('app');
      appRoot.innerHTML = '';
      const container = document.createElement('div');
      container.className = 'stage-root';
      appRoot.appendChild(container);
      let uiState = { imageBeat: 1, audio: { hasEverPlayed: false, playbackState: 'idle', optionsRevealed: false } };
      const baseParams = {
        question: { id: 'fx-audio-broken', text: 'سؤال صوتي', options: ['أ', 'ب', 'ج', 'د'], correctIndex: 0, media: { kind: 'audio', sha256: 'x', ext: 'wav' } },
        audioUrl: placeholder.BROKEN_AUDIO_URL,
        optionOrder: [0, 1, 2, 3],
        teamNames: ['الفريق الأزرق', 'الفريق البرتقالي'],
        answeringTeam: 'A',
        positions: [0, 0],
        revealed: false,
        chosenOption: null,
        canUndo: false,
        onChoose: () => {}, onNoAnswer: () => {}, onNext: () => {}, onUndo: () => {},
      };
      // Mirrors app.ts's real behaviour: `setMediaUi` re-renders the screen
      // with the updated state — the component itself never re-renders on
      // its own. A test harness that forgot this (an earlier version of
      // this exact file) would show the INITIAL render's state forever and
      // falsely appear to fail V22 even once the product code was fixed.
      const setUi = (patch) => {
        uiState = { ...uiState, ...patch };
        mod.renderAudioQuestionScreen(container, { ...baseParams, mediaUi: uiState, setMediaUi: setUi });
      };
      mod.renderAudioQuestionScreen(container, { ...baseParams, mediaUi: uiState, setMediaUi: setUi });
      // Wait for the browser to actually fire `error` on the bogus source.
      await new Promise((r) => setTimeout(r, 700));
      const stateLabel = document.querySelector('.type-audio-state')?.textContent;
      const barHeights = Array.from(document.querySelectorAll('.audio-level-bar')).map((b) => b.style.blockSize);
      const allFlat = barHeights.every((h) => h === '0%' || h === '');
      return { stateLabel, allFlat, barHeights: barHeights.slice(0, 5) };
    });
    await page.close();
  }

  // ---------- preload/lazy grep-equivalent (live DOM check) ----------
  {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    await page.goto(URL);
    results.mediaAttrs = await page.evaluate(async () => {
      const placeholder = await import('/src/stage/session/placeholder-media.ts');
      const imgMod = await import('/src/stage/screens/question-image.ts');
      const audioMod = await import('/src/stage/screens/question-audio.ts');
      const appRoot = document.getElementById('app');
      appRoot.innerHTML = '';
      const c1 = document.createElement('div'); c1.className = 'stage-root'; appRoot.appendChild(c1);
      imgMod.renderImageQuestionScreen(c1, {
        question: { id: 'fx-img2', text: 'س', options: ['أ', 'ب', 'ج', 'د'], correctIndex: 0, media: { kind: 'image', sha256: 'x', ext: 'png' } },
        imageUrl: placeholder.makePlaceholderImageDataUrl({ label: 'x', aspect: 'square', seed: 1 }),
        optionOrder: [0, 1, 2, 3], teamNames: ['أ', 'ب'], answeringTeam: 'A', positions: [0, 0],
        revealed: false, chosenOption: null, canUndo: false,
        mediaUi: { imageBeat: 1, audio: { hasEverPlayed: false, playbackState: 'idle', optionsRevealed: false } },
        setMediaUi: () => {}, onChoose: () => {}, onNoAnswer: () => {}, onNext: () => {}, onUndo: () => {},
      });
      const imgLoading = document.querySelector('img')?.getAttribute('loading');

      const c2 = document.createElement('div'); c2.className = 'stage-root'; appRoot.appendChild(c2);
      audioMod.renderAudioQuestionScreen(c2, {
        question: { id: 'fx-audio2', text: 'س', options: ['أ', 'ب', 'ج', 'د'], correctIndex: 0, media: { kind: 'audio', sha256: 'x', ext: 'wav' } },
        audioUrl: placeholder.makePlaceholderAudioDataUrl({ freqHz: 440, seconds: 1 }),
        optionOrder: [0, 1, 2, 3], teamNames: ['أ', 'ب'], answeringTeam: 'A', positions: [0, 0],
        revealed: false, chosenOption: null, canUndo: false,
        mediaUi: { imageBeat: 1, audio: { hasEverPlayed: true, playbackState: 'idle', optionsRevealed: true } },
        setMediaUi: () => {}, onChoose: () => {}, onNoAnswer: () => {}, onNext: () => {}, onUndo: () => {},
      });
      const audioPreload = document.querySelector('audio')?.getAttribute('preload');
      return { imgLoading, audioPreload };
    });
    await page.close();
  }

  // ---------- V1 re-check: new B2/B3 roles (turn-header not itself in
  // §1.5's table — measured only as the probe already used in B1; here we
  // re-confirm the ORIGINAL roles still measure correctly on the new
  // question types, since new chrome elements were added around them) ----
  {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    await page.goto(URL);
    await page.click('text=ابدأ اللعبة');
    await page.click('text=ابدأ');
    await page.waitForTimeout(1800);
    await page.evaluate(() => document.fonts.ready);
    // dismiss handoff to reach a real question screen
    try { await page.click('.turn-handoff-overlay', { timeout: 1000 }); } catch {}
    await page.waitForTimeout(300);
    results.v1Recheck = await page.evaluate(() => {
      const map = { question: '.type-question', option: '.type-option', 'option-letter': '.type-option-letter', 'team-name': '.type-team-name', score: '.type-score' };
      const out = {};
      for (const [role, sel] of Object.entries(map)) {
        const el = document.querySelector(sel);
        if (el) out[role] = getComputedStyle(el).fontSize;
      }
      return out;
    });
    await page.close();
  }

  // ---------- V3 re-check: contrast on new elements (turn-header, decider-badge) ----------
  {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    await page.goto(URL);
    results.v3Recheck = await page.evaluate(() => {
      function toRgb(str) { const m = str.match(/rgba?\((\d+), *(\d+), *(\d+)/); return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null; }
      function relLum([r, g, b]) { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); }
      function contrast(a, b) { const L1 = relLum(a), L2 = relLum(b); return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05); }
      const bgEl = document.querySelector('.stage-root');
      const bg = bgEl ? getComputedStyle(bgEl).backgroundColor : 'rgb(14,17,22)';
      const bgRgb = toRgb(bg) || [14, 17, 22];
      // Same fix as V27/V28's probe rig: `.turn-header` declares no
      // `font-family`/`color` of its own — it INHERITS `color` from
      // `.stage-root`. A probe appended straight to `document.body` (an
      // earlier version of this exact check) inherits the browser's
      // default black-on-transparent instead, and the contrast math comes
      // out wrong for a reason that has nothing to do with the real page.
      const rig = document.createElement('div');
      rig.className = 'stage-root';
      rig.style.position = 'fixed';
      rig.style.opacity = '0';
      document.body.appendChild(rig);
      const probe = document.createElement('p');
      probe.className = 'turn-header type-turn-banner';
      rig.appendChild(probe);
      const turnHeaderColor = getComputedStyle(probe).color;
      const badge = document.createElement('p');
      badge.className = 'decider-badge type-option';
      rig.appendChild(badge);
      const badgeCs = getComputedStyle(badge);
      const badgeRatio = contrast(toRgb(badgeCs.color), toRgb(badgeCs.backgroundColor));
      rig.remove();
      return {
        turnHeaderVsBg: contrast(toRgb(turnHeaderColor), bgRgb),
        deciderBadgeTextVsOwnBg: badgeRatio,
      };
    });
    await page.close();
  }

  // ---------- V10 re-check: banned physical-direction CSS, whole stylesheet ----------
  {
    const css = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'styles', 'stage.css'), 'utf8');
    const banned = /margin-left|margin-right|padding-left|padding-right|border-left|border-right|text-align:\s*(left|right)|\bleft:\s|\bright:\s/g;
    const matches = css.match(banned) || [];
    results.v10Recheck = { matchCount: matches.length, matches };
  }

  // ---------- V26: zero video anywhere in the product ----------
  {
    const srcDir = path.join(__dirname, '..', '..', 'src');
    function walk(dir) {
      let out = [];
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out = out.concat(walk(full));
        else out.push(full);
      }
      return out;
    }
    const files = walk(srcDir);
    const videoPattern = /\bvideo\b|\bmp4\b|\bwebm\b|<video/i;
    const hits = [];
    for (const f of files) {
      const content = fs.readFileSync(f, 'utf8');
      if (videoPattern.test(content)) hits.push(f);
    }
    results.v26VideoGrep = { hits };
  }

  // ---------- V27/V28: font weight range, synthesis, digit glyph family ----------
  {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    await page.goto(URL);
    await page.evaluate(() => document.fonts.ready);
    results.v27v28 = await page.evaluate(() => {
      // Probes MUST be inside a `.stage-root` — that is where `font-family:
      // 'Cairo', ...` is declared (a real bug in an earlier version of this
      // exact check: probes appended straight to `document.body` silently
      // fell back to the BROWSER'S OWN default font ("Times New Roman"),
      // which made V28's "same family" comparison spuriously pass — both
      // sides were equally wrong, not equally Cairo).
      const rig = document.createElement('div');
      rig.className = 'stage-root';
      rig.style.position = 'fixed';
      rig.style.opacity = '0'; // measured, not shown
      document.body.appendChild(rig);

      const probe600 = document.createElement('span');
      probe600.className = 'type-option'; // weight 600
      probe600.textContent = 'ت';
      rig.appendChild(probe600);
      const probe700 = document.createElement('span');
      probe700.className = 'type-question'; // weight 700
      probe700.textContent = 'ت';
      rig.appendChild(probe700);

      // Read every value into a PLAIN variable before any removal —
      // `getComputedStyle()` returns a LIVE CSSStyleDeclaration tied to the
      // element; reading its properties AFTER `.remove()` (a real bug this
      // fix replaces) returns an empty string, not the last-known value.
      const fontWeight600 = getComputedStyle(probe600).fontWeight;
      const fontWeight700 = getComputedStyle(probe700).fontWeight;
      const arabicFamily = getComputedStyle(probe700).fontFamily;
      const fontSynthesisOnRoot = getComputedStyle(rig).fontSynthesis;

      // Measure actual glyph ink width at the two weights to confirm they
      // are genuinely different renderings (real axis instances), not the
      // same outline reused (which a broken font-weight declaration/range
      // would produce even though computed `font-weight` still reads 600/700).
      function inkWidth(weight) {
        const c = document.createElement('canvas').getContext('2d');
        c.font = `${weight} 100px Cairo`;
        return c.measureText('تن').width;
      }
      const width600 = inkWidth(600);
      const width700 = inkWidth(700);

      // V28 — digits resolve to the SAME family as Arabic text (no fallback).
      const digitProbe = document.createElement('span');
      digitProbe.className = 'type-score';
      digitProbe.textContent = '0123456789';
      rig.appendChild(digitProbe);
      const digitFamily = getComputedStyle(digitProbe).fontFamily;

      const canvasCtx = document.createElement('canvas').getContext('2d');
      canvasCtx.font = "700 100px 'Cairo'";
      const hasDigitGlyphs = [...'0123456789'].every((d) => canvasCtx.measureText(d).width > 0);

      rig.remove();
      return {
        fontWeight600,
        fontWeight700,
        fontSynthesisOnRoot,
        inkWidthDiffers: width600 !== width700,
        width600, width700,
        digitFamily, arabicFamily, sameFamily: digitFamily === arabicFamily,
        hasDigitGlyphs,
      };
    });
    await page.close();
  }

  // ---------- V2 (revised, addendum-v2-ruling.md) — one-time calibration, NOT a gate ----------
  {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    await page.goto(URL);
    await page.evaluate(() => document.fonts.ready);
    results.v2Revised = await page.evaluate(() => {
      function measure(weight) {
        const c = document.createElement('canvas').getContext('2d');
        c.font = `${weight} 100px Cairo`;
        c.textBaseline = 'alphabetic';
        const m = c.measureText('ه');
        return {
          ascent: m.actualBoundingBoxAscent,
          descent: m.actualBoundingBoxDescent,
          r: m.actualBoundingBoxAscent / 100,
        };
      }
      return { w600: measure(600), w700: measure(700) };
    });
    await page.close();
  }

  await browser.close();
  fs.writeFileSync(path.join(OUT_DIR, 'results-b2.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
