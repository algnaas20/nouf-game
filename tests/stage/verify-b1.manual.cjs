/**
 * PH-B1 verification driver — WL-B, tests/stage/ (owned by this line).
 *
 * NOT wired into `npm test`: it needs a real Chromium (via Playwright) and
 * `vite.config.ts`/`package.json` are WL-D's owned files (PROMPT D1), so
 * this line cannot add `playwright`/`playwright-core` as a devDependency
 * itself. Run it manually:
 *
 *   npm install --no-save playwright-core   (does not touch package.json)
 *   npx vite --port 3011 --strictPort       (separate terminal)
 *   node tests/stage/verify-b1.manual.cjs
 *
 * It launches the already-installed system Edge via Playwright's `channel`
 * option (no browser binary download). Produces V1/V2/V3/V4, the no-tell
 * check, the two-tap trace, and the two required screenshots. See
 * docs/تأسيس-المشروع/تقارير/المنفِّذ/worklog-B1.md for the recorded output
 * and the follow-up this leaves for D-line/B4 (wiring a real Playwright
 * devDependency + a `tests/stage` npm script).
 */
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const URL = process.env.STAGE_URL || 'http://localhost:3011/';
const OUT_DIR = path.join(__dirname, '..', '..', 'verify-out');
fs.mkdirSync(OUT_DIR, { recursive: true });

async function main() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const results = {};

  // ---------- V1: font-size per role at the three scale steps ----------
  const v1 = {};
  for (const scale of ['100', '115', '130']) {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    await page.goto(URL);
    await page.evaluate((s) => document.documentElement.setAttribute('data-scale', s), scale);
    await page.evaluate(() => document.fonts.ready);

    const homeRoles = await page.evaluate(() => {
      const out = {};
      const title = document.querySelector('.type-winner-headline');
      const btn = document.querySelector('.type-operator-button');
      if (title) out['winner-headline'] = getComputedStyle(title).fontSize;
      if (btn) out['operator-button'] = getComputedStyle(btn).fontSize;
      return out;
    });

    await page.click('text=ابدأ اللعبة');
    await page.evaluate(() => document.fonts.ready);
    const qRoles = await page.evaluate(() => {
      const out = {};
      const map = { question: '.type-question', option: '.type-option', 'option-letter': '.type-option-letter', 'team-name': '.type-team-name', score: '.type-score' };
      for (const [role, sel] of Object.entries(map)) {
        const el = document.querySelector(sel);
        if (el) out[role] = getComputedStyle(el).fontSize;
      }
      return out;
    });

    await page.click('.option-card');
    const resultRoles = await page.evaluate(() => {
      const rw = document.querySelector('.type-result-word');
      return rw ? { 'result-word': getComputedStyle(rw).fontSize } : {};
    });

    v1[scale] = { ...homeRoles, ...qRoles, ...resultRoles };
    await page.close();
  }
  results.v1 = v1;

  // turn-banner: not wired into a live B1 screen (PH-B3 scope) — measured
  // via a CSS-only probe so the number is still real.
  {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    await page.goto(URL);
    const v1TurnBanner = {};
    for (const scale of ['100', '115', '130']) {
      v1TurnBanner[scale] = await page.evaluate((s) => {
        document.documentElement.setAttribute('data-scale', s);
        const probe = document.createElement('div');
        probe.className = 'type-turn-banner';
        probe.textContent = 'x';
        document.body.appendChild(probe);
        const v = getComputedStyle(probe).fontSize;
        probe.remove();
        return v;
      }, scale);
    }
    results.v1TurnBanner = v1TurnBanner;
    await page.close();
  }

  // ---------- V2: ink height ratio of "بخ" at 100px canvas ----------
  {
    const page = await browser.newPage();
    await page.goto(URL);
    await page.evaluate(() => document.fonts.ready);
    results.v2 = await page.evaluate(() => {
      const ctx = document.createElement('canvas').getContext('2d');
      ctx.font = "700 100px 'Cairo'";
      const m = ctx.measureText('بخ');
      return (m.actualBoundingBoxAscent + m.actualBoundingBoxDescent) / 100;
    });
    await page.close();
  }

  // ---------- V3: contrast ratios ----------
  {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    await page.goto(URL);
    await page.click('text=ابدأ اللعبة');
    results.v3 = await page.evaluate(() => {
      function toRgb(str) {
        const m = str.match(/rgba?\((\d+), *(\d+), *(\d+)/);
        return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
      }
      function relLum([r, g, b]) {
        const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
      }
      function contrast(a, b) {
        const L1 = relLum(a), L2 = relLum(b);
        return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
      }
      const bg = getComputedStyle(document.querySelector('.stage-root')).backgroundColor;
      const bgRgb = toRgb(bg);
      const out = [];
      for (const [sel, label] of [['.type-question', 'question text'], ['.type-option', 'option text'], ['.type-team-name', 'team name'], ['.type-score', 'score'], ['.op-button', 'operator button']]) {
        const el = document.querySelector(sel);
        if (!el) continue;
        const color = getComputedStyle(el).color;
        out.push({ label, color, bg, ratio: contrast(toRgb(color), bgRgb) });
      }
      return out;
    });
    await page.close();
  }

  // ---------- V4: overflow with the 150-char/50-char fixture, all 3 scale steps ----------
  {
    const v4 = {};
    const longQuestion = 'ما اسم أطول نهر في العالم وأين يقع بالتحديد ولماذا يعتبر من أهم الأنهار على مستوى الكرة الأرضية عبر التاريخ الطويل لحضارات الإنسان القديمة والحديثة عل'; // exactly 150 code points
    const longOptions = [
      'نهر النيل في قارة أفريقيا وهو الأطول عالمياً كلمة ',
      'نهر الأمازون في قارة أمريكا الجنوبية الكبرى كلمة إ',
      'نهر المسيسيبي في قارة أمريكا الشمالية هناك كلمة إض',
      'نهر اليانغتسي في قارة آسيا الشرقية البعيدة كلمة إض',
    ]; // exactly 50 code points each
    for (const scale of ['100', '115', '130']) {
      const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
      await page.goto(URL);
      await page.evaluate((s) => document.documentElement.setAttribute('data-scale', s), scale);
      v4[scale] = await page.evaluate(
        async ({ longQuestion, longOptions }) => {
          const mod = await import('/src/stage/screens/question.ts');
          const appRoot = document.getElementById('app');
          appRoot.innerHTML = '';
          // Must render inside a real `.stage-root` (carries the Cairo
          // font-family) — rendering straight into #app silently falls
          // back to the default browser font and invalidates the test.
          const container = document.createElement('div');
          container.className = 'stage-root';
          appRoot.appendChild(container);
          mod.renderQuestionScreen(container, {
            question: { id: 'fixture', text: longQuestion, options: longOptions, correctIndex: 0, media: { kind: 'none' } },
            optionOrder: [0, 1, 2, 3],
            teamNames: ['الفريق الأزرق', 'الفريق البرتقالي'],
            answeringTeam: 'A',
            scores: [0, 0],
            revealed: false,
            chosenOption: null,
            canUndo: false,
            onChoose: () => {},
            onNext: () => {},
            onUndo: () => {},
          });
          await document.fonts.ready;
          await new Promise((r) => setTimeout(r, 50));
          const qBox = document.querySelector('.question-text');
          const grid = document.querySelector('.options-grid');
          const cards = Array.from(document.querySelectorAll('.option-card'));
          const boxes = [{ label: 'question', overflow: qBox.scrollHeight - qBox.clientHeight }];
          cards.forEach((c, i) => boxes.push({ label: `option-${i}`, overflow: c.scrollHeight - c.clientHeight }));
          // Supplementary to the literal V4 wording: once max-height is
          // dropped to `none` post-fit, scrollHeight===clientHeight is
          // trivially true even if the box grew so tall it collides with
          // the options grid below it (proven red in worklog-B1.md — a
          // disabled shrink loop passed literal V4 while visually
          // overlapping the options by 64px). This checks the real hazard.
          boxes.push({ label: 'question-vs-options-overlap', overflow: qBox.getBoundingClientRect().bottom - grid.getBoundingClientRect().top });
          return boxes;
        },
        { longQuestion, longOptions },
      );
      await page.close();
    }
    results.v4 = v4;
  }

  // ---------- No-tell (top-level non-negotiable, F8-style) ----------
  {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    await page.goto(URL);
    await page.click('text=ابدأ اللعبة');
    results.noTell = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.option-card'));
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
          if (attr === 'class' || attr === 'type' || attr === 'data-option-index') continue;
          leaks.push(attr);
        }
      }
      return { allIdentical, heights, heightsEqual, leaks };
    });
    await page.close();
  }

  // ---------- Screenshots (acceptance criterion 7) ----------
  for (const scale of ['100', '130']) {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
    await page.goto(URL);
    await page.evaluate((s) => document.documentElement.setAttribute('data-scale', s), scale);
    await page.click('text=ابدأ اللعبة');
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(OUT_DIR, `stage-question-text-scale${scale}.png`) });
    await page.close();
  }

  // ---------- Two-tap trace (acceptance criterion 8) ----------
  {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    await page.goto(URL);
    await page.click('text=ابدأ اللعبة');
    let taps = 0;
    const before = await page.evaluate(() => document.querySelector('.question-text')?.textContent);
    await page.click('.option-card'); taps++;
    const afterReveal = await page.evaluate(() => !!document.querySelector('.type-result-word'));
    await page.click('text=السؤال التالي'); taps++;
    const after = await page.evaluate(() => document.querySelector('.question-text')?.textContent);
    results.twoTap = { taps, before, afterReveal, after, changed: before !== after };
    await page.close();
  }

  await browser.close();
  fs.writeFileSync(path.join(OUT_DIR, 'results.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
