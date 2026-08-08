/**
 * WL-B6 verification driver — the standing reachability pack
 * (worklog-B6.md, 2026-08-08). Proves, against the REAL running app:
 *
 *   - The live-user defect is fixed: on `team-setup` (now Tier 2 —
 *     `rtl-stage-ux-expert`'s `addendum-small-screens-2026-08-08.md`), the
 *     primary «ابدأ» action is inside the viewport with NO scrolling
 *     required, at a matrix of real viewport sizes including the user's
 *     own reported size and a small phone in both orientations — and a
 *     REAL click actually advances the app (not just a bounding-box check).
 *   - V39 (no `--stage-unit` leakage into Tier-2 stylesheets).
 *   - V40-lite (touch targets >=48x48 CSS px on the phone viewport).
 *   - V41 (input font-size >=16 CSS px, every viewport).
 *   - Tier-1 unaffected: the existing V-pack's own viewport (1920x1080)
 *     still renders a normal playable question screen through this same
 *     team-setup flow, and `.stage-root` still contains its content with no
 *     internal overflow at the sizes the V-pack already covers.
 *
 * Red->green proof for this exact check is in worklog-B6.md (git-stashed
 * the fix, re-ran this script, `ALL_PASS: false` with the button's bottom
 * edge past the viewport bottom at the user's own reported size; restored
 * the fix, re-ran, `ALL_PASS: true`).
 *
 *   npx vite --port 3011 --strictPort      (separate terminal / background)
 *   node tests/stage/verify-b6-reachability.manual.cjs
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const URL = process.env.STAGE_URL || 'http://localhost:3011/';
const OUT_DIR = path.join(__dirname, '..', '..', 'verify-out');
fs.mkdirSync(OUT_DIR, { recursive: true });

// Viewport matrix — the user's own reported size (CSS px at DPR 2, per
// `rtl-stage-ux-expert`'s own worked example), a common laptop (the size at
// which the addendum's own arithmetic shows the OLD stacked layout would
// still fail even with scrolling), a small phone portrait AND landscape,
// and the existing V-pack's native 1920x1080.
const SIZES = [
  { name: 'native-1920x1080', w: 1920, h: 1080 },
  { name: 'reported-1436x926', w: 1436, h: 926 },
  { name: 'laptop-1366x768', w: 1366, h: 768 },
  { name: 'laptop-1280x800', w: 1280, h: 800 },
  { name: 'phone-portrait-390x844', w: 390, h: 844 },
  { name: 'phone-portrait-360x640', w: 360, h: 640 },
  { name: 'phone-landscape-844x390', w: 844, h: 390 },
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function seedDeckAndOpenTeamSetup(page) {
  await page.goto(URL);
  await sleep(150);
  await page.evaluate(async () => {
    const { createDraftStore } = await import('/src/editor/draft-store.ts');
    const store = createDraftStore();
    await store.load();
    for (let i = 0; i < 14; i++) {
      await store.addQuestion({ text: `سؤال ${i + 1}`, options: ['أ', 'ب', 'ج', 'د'], correctIndex: 0 });
    }
  });
  await page.reload();
  await sleep(150);
  await page.getByRole('button', { name: 'ابدأ اللعبة', exact: true }).click();
  await sleep(150);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const results = { perSize: [], v39StageUnitLeakage: null, allPass: null };
  try {
    // ---- V39: grep the Tier-2 stylesheet for --stage-unit — zero matches.
    const consoleCss = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'styles', 'console.css'), 'utf8');
    results.v39StageUnitLeakage = {
      matches: (consoleCss.match(/--stage-unit/g) ?? []).length,
      pass: !consoleCss.includes('--stage-unit'),
    };
    // No `position: fixed` either — Tier 2 must be a normal scrolling doc.
    results.noPositionFixedInConsoleCss = !/position:\s*fixed/.test(consoleCss);

    for (const s of SIZES) {
      const page = await browser.newPage({ viewport: { width: s.w, height: s.h } });
      await seedDeckAndOpenTeamSetup(page);

      const before = await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.trim() === 'ابدأ');
        const r = btn ? btn.getBoundingClientRect() : null;
        const inputs = Array.from(document.querySelectorAll('.console-root input, .console-root button'));
        const smallTargets = inputs
          .map((el) => {
            const rect = el.getBoundingClientRect();
            return { tag: el.tagName, text: el.textContent?.trim().slice(0, 20) ?? el.getAttribute('aria-label'), w: rect.width, h: rect.height };
          })
          .filter((t) => t.w < 48 || t.h < 48);
        const inputFontSizes = Array.from(document.querySelectorAll('.console-root input')).map((el) => ({
          label: el.getAttribute('aria-label'),
          fontSizePx: parseFloat(getComputedStyle(el).fontSize),
        }));
        return {
          found: !!btn,
          rect: r ? { top: r.top, bottom: r.bottom, left: r.left, right: r.right } : null,
          viewportW: window.innerWidth,
          viewportH: window.innerHeight,
          fullyInViewportNoScroll: r
            ? r.top >= 0 && r.bottom <= window.innerHeight && r.left >= 0 && r.right <= window.innerWidth
            : false,
          stageRootHidden: document.querySelector('.stage-root')?.hidden ?? null,
          smallTargets,
          inputFontSizes,
          inputFontSizeAllAtLeast16: inputFontSizes.every((f) => f.fontSizePx >= 16),
        };
      });

      let clickResult = 'ok';
      try {
        await page.getByRole('button', { name: 'ابدأ', exact: true }).click({ timeout: 4000 });
      } catch (e) {
        clickResult = 'FAILED: ' + String(e).split('\n')[0];
      }
      const afterPhase = await page.evaluate(() => ({
        reachedDrawOrPlay: !!document.querySelector('.type-winner-headline') || !!document.querySelector('.question-text'),
      }));

      if (s.name === 'reported-1436x926') {
        await page.close();
        const page2 = await browser.newPage({ viewport: { width: s.w, height: s.h } });
        await seedDeckAndOpenTeamSetup(page2);
        await page2.screenshot({ path: path.join(OUT_DIR, 'b6-team-setup-reported-size.png') });
        await page2.close();
      } else {
        await page.close();
      }

      results.perSize.push({ size: s.name, before, clickResult, afterPhase });
    }

    // ---- Tier-1 regression spot-check: at the V-pack's own native size,
    //      the stage canvas (question screen, reached right after
    //      team-setup -> draw -> playing) still fully contains its content.
    {
      const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
      await seedDeckAndOpenTeamSetup(page);
      await page.getByRole('button', { name: 'ابدأ', exact: true }).click();
      await sleep(2000); // draw screen's 1600ms timer -> playing
      results.tier1Containment = await page.evaluate(() => {
        const root = document.querySelector('.stage-root');
        return {
          visible: root ? !root.hidden : null,
          scrollHeight: root ? root.scrollHeight : null,
          clientHeight: root ? root.clientHeight : null,
          contained: root ? root.scrollHeight <= root.clientHeight + 1 : null, // +1 sub-pixel tolerance
        };
      });
      await page.close();
    }

    results.allPass =
      results.v39StageUnitLeakage.pass &&
      results.noPositionFixedInConsoleCss &&
      results.perSize.every(
        (r) => r.before.fullyInViewportNoScroll && r.clickResult === 'ok' && r.afterPhase.reachedDrawOrPlay && r.before.smallTargets.length === 0 && r.before.inputFontSizeAllAtLeast16,
      ) &&
      results.tier1Containment?.contained === true;
  } finally {
    fs.writeFileSync(path.join(OUT_DIR, 'results-b6-reachability.json'), JSON.stringify(results, null, 2));
    await browser.close();
  }
  console.log(JSON.stringify(results, null, 2));
  if (!results.allPass) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
