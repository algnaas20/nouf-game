/**
 * B7 maze-redesign verification — WL-B, tests/stage/ (owned by this line).
 * Run manually against a live dev server:
 *
 *   npx vite --port 3011 --strictPort       (separate terminal)
 *   node tests/stage/verify-b7-maze.manual.cjs
 *
 * Covers (best-effort, disclosed gaps noted in worklog-B7.md §4):
 *   V31 — trail geometry (core/casing widths, dash period)
 *   V32 — route-card geometry (>=400x140, gaps >=48, label >=56px)
 *   V33 — action-band invariance (correct vs wrong beat, same top edge)
 *   V34 — arm delay (cards start disabled, enable ~400ms later)
 *   V29 — greyscale separation between the two team colours
 *   V36 — no pointer handlers on the maze SVG (grep-based)
 *   I15 — no DOM node encodes which exit is the dead end before it is chosen
 *
 * NOT covered here (disclosed, worklog-B7.md §4): V30 (CVD simulation —
 * needs a real colour-matrix render pass, out of this session's budget),
 * V35's live pixel-sampling half (the analytic half is
 * `tests/stage/maze-trail-separation.test.ts`), the cursor-auto-hide-after-2s
 * half of V36.
 */
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const URL = process.env.STAGE_URL || 'http://localhost:3011/';
const OUT_DIR = path.join(__dirname, '..', '..', 'verify-out');
fs.mkdirSync(OUT_DIR, { recursive: true });

function relLuminance(hex) {
  const n = hex.replace('#', '');
  const r = parseInt(n.slice(0, 2), 16) / 255;
  const g = parseInt(n.slice(2, 4), 16) / 255;
  const b = parseInt(n.slice(4, 6), 16) / 255;
  const lin = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

async function authorQuestions(page, count) {
  await page.click('button:has-text("أسئلتي")');
  await page.waitForTimeout(150);
  for (let i = 0; i < count; i++) {
    await page.click('#editor-add-question');
    await page.fill('.question-text-input', `سؤال اختبار المتاهة رقم ${i + 1}`);
    const opts = await page.$$('.option-text-input');
    await opts[0].fill('أ');
    await opts[1].fill('ب');
    await opts[2].fill('ج');
    await opts[3].fill('د');
    await page.check('.option-row[data-option-index="0"] .option-correct-radio');
    await page.click('.question-submit');
    await page.waitForTimeout(80);
  }
  // Back to home.
  const backBtn = page.locator('button:has-text("→ الرئيسية")');
  if (await backBtn.count()) await backBtn.click();
  await page.waitForTimeout(100);
}

/** Plays forward, always trying UNTRIED option slots until a correct
 *  answer lands (mirrors verify-b5's own strategy) — stops the instant the
 *  route action band (post-correct-answer) is visible, OR (separately)
 *  the instant a wrong-answer single-card band is visible, so the caller
 *  can measure either beat on demand. */
async function playUntil(page, stopCondition, maxSteps = 400) {
  const triedSlots = new Set();
  for (let step = 0; step < maxSteps; step++) {
    if (await stopCondition(page)) return true;
    const handoff = page.locator('.turn-handoff-overlay');
    if (await handoff.count()) {
      await handoff.click();
      await page.waitForTimeout(60);
      continue;
    }
    const routeCards = page.locator('.route-card:not([disabled])');
    const routeCardCount = await routeCards.count();
    if (routeCardCount > 0) {
      await routeCards.first().click();
      triedSlots.clear();
      await page.waitForTimeout(1400); // wait out the auto-advance timer
      continue;
    }
    const optionCards = page.locator('.option-card:not([disabled])');
    const n = await optionCards.count();
    if (n > 0) {
      let clicked = false;
      for (let i = 0; i < n; i++) {
        const card = optionCards.nth(i);
        const idx = await card.getAttribute('data-option-index');
        if (!triedSlots.has(idx)) {
          triedSlots.add(idx);
          await card.click();
          clicked = true;
          break;
        }
      }
      if (!clicked) triedSlots.clear();
      await page.waitForTimeout(120);
      continue;
    }
    // Wrong-answer path: undo and retry with a fresh slot.
    const undoBtn = page.locator('.undo-corner button:not([disabled])');
    if (await undoBtn.count()) {
      const resultWrong = await page.locator('.result-banner.is-wrong').count();
      if (resultWrong) {
        await undoBtn.click();
        await page.waitForTimeout(80);
        continue;
      }
    }
    await page.waitForTimeout(80);
  }
  return false;
}

async function main() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const results = {};

  // ---------- Setup: author a deck, start a قصيرة(N=6) game ----------
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await page.goto(URL);
  await authorQuestions(page, 20);
  await page.click('button:has-text("ابدأ اللعبة")');
  await page.click('button:has-text("قصيرة — 6")');
  await page.click('button:has-text("ابدأ"):not(:has-text("اللعبة"))');
  await page.waitForTimeout(1700); // draw screen delay

  // ---------- Reach a CORRECT-answer reveal (route cards visible) ----------
  const reachedCorrect = await playUntil(page, async (p) => (await p.locator('.route-card[data-route-key]:not([data-route-key="next"])').count()) > 0);
  results.reachedCorrectRouteCards = reachedCorrect;
  let correctBandTopCaptured = null;

  if (reachedCorrect) {
    // ---- V32: route-card geometry ----
    const geo = await page.evaluate(() => {
      const unit = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--stage-unit')) || 1;
      const cards = Array.from(document.querySelectorAll('.route-card'));
      const rects = cards.map((c) => c.getBoundingClientRect());
      const label = cards[0]?.querySelector('.route-card-label');
      const labelPx = label ? parseFloat(getComputedStyle(label).fontSize) : 0;
      const gaps = [];
      const sorted = [...rects].sort((a, b) => a.left - b.left);
      for (let i = 1; i < sorted.length; i++) gaps.push(sorted[i].left - sorted[i - 1].right);
      return {
        unit,
        count: cards.length,
        widthsStagePx: rects.map((r) => r.width / unit),
        heightsStagePx: rects.map((r) => r.height / unit),
        gapsStagePx: gaps.map((g) => g / unit),
        labelStagePx: labelPx / unit,
        bandTop: document.querySelector('.route-action-band')?.getBoundingClientRect().top ?? null,
        bandHeightStagePx: (document.querySelector('.operator-bar-revealed')?.getBoundingClientRect().height ?? 0) / unit,
      };
    });
    results.V32_routeCardGeometry = geo;
    results.V32_pass = {
      widthsOk: geo.widthsStagePx.every((w) => w >= 399), // 1px rounding tolerance
      heightsOk: geo.heightsStagePx.every((h) => h >= 139),
      gapsOk: geo.gapsStagePx.every((g) => g >= 47),
      labelOk: geo.labelStagePx >= 55,
      bandHeightOk: geo.bandHeightStagePx >= 159 && geo.bandHeightStagePx <= 161,
    };

    // ---- V34: arm delay — cards must be disabled right after mount ----
    const disabledRightAfterMount = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.route-card'));
      return cards.length > 0 && cards.every((c) => c.disabled);
    });
    // Re-navigate the SAME beat by waiting past the arm delay and re-checking.
    await page.waitForTimeout(500);
    const enabledAfterDelay = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.route-card'));
      return cards.length > 0 && cards.every((c) => !c.disabled);
    });
    results.V34_armDelay = { disabledRightAfterMount, enabledAfterDelay };

    // ---- I15: no DOM node encodes which exit is the dead end ----
    const i15 = await page.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll('.maze-mouths *, .route-card, .maze-mouth-chip *'));
      const suspect = nodes.filter((n) => {
        for (const attr of n.getAttributeNames ? n.getAttributeNames() : []) {
          if (/dead/i.test(attr) || /dead/i.test(n.getAttribute(attr) || '')) return true;
        }
        return false;
      });
      return { suspectCount: suspect.length };
    });
    results.I15_noDeadEndLeak = i15;

    await page.screenshot({ path: path.join(OUT_DIR, 'b7-route-cards-correct.png') });

    // V33 (part 1): capture the band's top edge on THIS correct-answer
    // beat BEFORE tapping a card (tapping starts the 1200ms auto-advance
    // that tears this exact band down).
    correctBandTopCaptured = geo.bandTop;

    // ---- V31: trail geometry — tap a route card, then check the maze
    // beat IMMEDIATELY (well inside the 1200ms auto-advance window). ----
    await page.locator('.route-card:not([disabled])').first().click();
    await page.waitForTimeout(150);
    const trailGeoEarly = await page.evaluate(() => {
      const coreA = document.querySelector('.maze-trail-core-a');
      const coreB = document.querySelector('.maze-trail-core-b');
      const casingA = document.querySelector('.maze-trail-casing-a');
      if (!coreA || !coreB || !casingA) return null;
      const csCoreA = getComputedStyle(coreA);
      const csCoreB = getComputedStyle(coreB);
      const csCasingA = getComputedStyle(casingA);
      return {
        coreWidthA: csCoreA.strokeWidth,
        coreWidthB: csCoreB.strokeWidth,
        casingWidthA: csCasingA.strokeWidth,
        dashArrayB: csCoreB.strokeDasharray,
        dashArrayA: csCoreA.strokeDasharray,
        colorA: csCoreA.stroke,
        colorB: csCoreB.stroke,
      };
    });
    results.V31_trailGeometry = trailGeoEarly;
    await page.screenshot({ path: path.join(OUT_DIR, 'b7-maze-beat.png') });
    await page.waitForTimeout(1300); // let the beat finish auto-advancing before continuing the script
  }

  // ---------- V33: compare the captured correct-answer band top edge against a fresh wrong-answer beat ----------
  const correctBandTop = correctBandTopCaptured;
  // Force a wrong answer: click an option, and if it turns out correct, undo and pick a different one until wrong is found.
  let wrongBandTop = null;
  {
    let tries = 0;
    while (wrongBandTop === null && tries < 30) {
      tries++;
      const handoff = page.locator('.turn-handoff-overlay');
      if (await handoff.count()) {
        await handoff.click();
        await page.waitForTimeout(60);
        continue;
      }
      const routeCards = page.locator('.route-card:not([disabled])');
      if ((await routeCards.count()) > 0) {
        await routeCards.first().click();
        await page.waitForTimeout(1400);
        continue;
      }
      const wrongBand = page.locator('.result-banner.is-wrong');
      if (await wrongBand.count()) {
        wrongBandTop = await page.evaluate(() => document.querySelector('.route-action-band')?.getBoundingClientRect().top ?? null);
        break;
      }
      const cards = page.locator('.option-card:not([disabled])');
      const n = await cards.count();
      if (n > 0) {
        // Pick the LAST slot repeatedly — some slot is wrong with p=0.75.
        await cards.nth(n - 1).click();
        await page.waitForTimeout(150);
        continue;
      }
      await page.waitForTimeout(80);
    }
  }
  results.V33_actionBandInvariance = {
    correctBandTop,
    wrongBandTop,
    diffPx: correctBandTop !== null && wrongBandTop !== null ? Math.abs(correctBandTop - wrongBandTop) : null,
  };

  await page.screenshot({ path: path.join(OUT_DIR, 'b7-route-cards-wrong.png') });

  // ---------- V29: greyscale separation (from the same CSS custom properties maze-view.ts paints with) ----------
  {
    const teamHexes = await page.evaluate(() => {
      const cs = getComputedStyle(document.documentElement);
      return { a: cs.getPropertyValue('--color-team-a').trim(), b: cs.getPropertyValue('--color-team-b').trim() };
    });
    const la = relLuminance(teamHexes.a);
    const lb = relLuminance(teamHexes.b);
    const lighter = Math.max(la, lb);
    const darker = Math.min(la, lb);
    const ratio = (lighter + 0.05) / (darker + 0.05);
    results.V29_greyscaleSeparation = { teamHexes, la, lb, ratio, pass: ratio >= 3.5 };
  }

  // ---------- V36: grep-based — no pointer handlers on the maze SVG ----------
  const mazeViewSrc = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'stage', 'screens', 'maze-view.ts'), 'utf8');
  results.V36_noMazeClickHandlers = { addEventListenerCount: (mazeViewSrc.match(/addEventListener/g) || []).length };

  await browser.close();
  fs.writeFileSync(path.join(OUT_DIR, 'results-b7-maze.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
