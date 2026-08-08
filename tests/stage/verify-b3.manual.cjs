/**
 * PH-B3 verification driver — WL-B, tests/stage/ (owned by this line).
 * Same discipline as verify-b1/b2.manual.cjs. Run:
 *
 *   npx vite --port 3011 --strictPort   (separate terminal)
 *   node tests/stage/verify-b3.manual.cjs
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const URL = process.env.STAGE_URL || 'http://localhost:3011/';
const OUT_DIR = path.join(__dirname, '..', '..', 'verify-out');
fs.mkdirSync(OUT_DIR, { recursive: true });
const STAGE_DIR = path.join(__dirname, '..', '..', 'src', 'stage');

function walk(dir) {
  let out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out = out.concat(walk(full));
    else out.push(full);
  }
  return out;
}

async function main() {
  const results = {};

  // ---------- Static greps (no browser needed) ----------
  const stageFiles = walk(STAGE_DIR).filter((f) => f.endsWith('.ts'));

  // 1. No-celebration on arrival: search turn-handoff.ts (the "arrival"
  // screen — D-09.8's no-victory-staging moment) for فاز / confetti / win-sound.
  {
    const content = fs.readFileSync(path.join(STAGE_DIR, 'screens', 'turn-handoff.ts'), 'utf8');
    const celebrationPattern = /فاز|confetti|win-?sound|تهنئة/i;
    const matches = content.match(new RegExp(celebrationPattern, 'gi')) || [];
    results.noCelebrationGrep = { file: 'turn-handoff.ts', matches };
  }

  // 2. No timer/clock/win-percentage grep across all of src/stage.
  {
    const setIntervalHits = [];
    const newDateHits = [];
    const percentHits = [];
    for (const f of stageFiles) {
      const content = fs.readFileSync(f, 'utf8');
      const rel = path.relative(STAGE_DIR, f);
      if (/setInterval/.test(content)) setIntervalHits.push(rel);
      if (/new Date\(/.test(content)) newDateHits.push(rel);
      const pctMatches = content.match(/%/g) || [];
      if (pctMatches.length > 0) percentHits.push({ file: rel, count: pctMatches.length });
    }
    results.timerPercentGrep = { setIntervalHits, newDateHits, percentHits };
  }

  // 3. Literal Appendix أ strings — verbatim presence audit.
  {
    const literalChecks = [
      { file: 'screens/chrome.ts', literal: 'يوجّه السؤال ← فريق' },
      { file: 'screens/turn-handoff.ts', literal: 'وصل النهاية — وفريق' },
      { file: 'screens/turn-handoff.ts', literal: 'له محاولة أخيرة' },
      { file: 'screens/turn-handoff.ts', literal: 'سؤال الحسم' },
      { file: 'screens/maze-beat.ts', literal: 'سؤال أخير من الحضور — أول فريق يجاوب صح يفوز' },
      { file: 'screens/maze-beat.ts', literal: 'جاوب صح' },
      { file: 'screens/maze-beat.ts', literal: 'نعلنها تعادل' },
      { file: 'screens/ending.ts', literal: 'بالتقدّم — ' },
      { file: 'screens/ending.ts', literal: 'نفس الفريقين — يبدأ فريق' },
      { file: 'screens/ending.ts', literal: 'الأسئلة ترجع من أولها' },
      { file: 'screens/team-setup.ts', literal: 'إذا وصلوا النهاية سوا → سؤال الحسم' },
      { file: 'screens/team-setup.ts', literal: 'تكفي غالباً، وإذا كثرت الأخطاء ممكن تخلص الأسئلة قبل ما يوصل أحد' },
      { file: 'screens/team-setup.ts', literal: 'تكفي لمسار' },
      { file: 'screens/maze-view.ts', literal: 'البداية' },
      { file: 'screens/maze-view.ts', literal: 'النهاية' },
    ];
    const out = [];
    for (const c of literalChecks) {
      const full = path.join(STAGE_DIR, c.file.includes('/') ? c.file : c.file);
      const content = fs.readFileSync(path.join(STAGE_DIR, c.file), 'utf8');
      out.push({ file: c.file, literal: c.literal, present: content.includes(c.literal) });
    }
    results.literalStringAudit = out;
  }

  const browser = await chromium.launch({ headless: true });

  // ---------- Decorative dead-end structural proof ----------
  {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    await page.goto(URL);
    results.deadEndStructure = await page.evaluate(async () => {
      const geomMod = await import('/src/stage/maze-geometry.ts');
      const viewMod = await import('/src/stage/screens/maze-view.ts');
      const N = 10;
      const { svg } = viewMod.buildMazeView({ N, positions: [4, 6], teamNames: ['أ', 'ب'] });
      document.body.appendChild(svg);
      const stationCircles = svg.querySelectorAll('.maze-station').length;
      const deadEndGroupCircles = svg.querySelector('.maze-dead-ends').querySelectorAll('circle').length;
      const wallLines = svg.querySelectorAll('.maze-dead-end-wall').length;
      const stubPaths = svg.querySelectorAll('.maze-dead-end-stub').length;
      svg.remove();

      // Station progress values never coincide with a dead-end anchor, for
      // several plausible N (6/10/14) — proves dead ends are never mistaken
      // for stations by construction, not just by the renderer's choices.
      const collisions = [];
      for (const testN of [6, 10, 14]) {
        const stations = geomMod.stationProgressValues(testN);
        for (const d of geomMod.DECORATIVE_DEAD_ENDS) {
          if (stations.some((s) => Math.abs(s - d.fromProgress) < 1e-9)) {
            collisions.push({ N: testN, fromProgress: d.fromProgress });
          }
        }
      }

      return {
        expectedStationCircles: (N + 1) * 2,
        actualStationCircles: stationCircles,
        deadEndCircleCount: deadEndGroupCircles, // must be 0 — dead ends never draw a station glyph
        wallLineCount: wallLines, // 2 per dead end (mouth + cap)
        expectedWallLineCount: geomMod.DECORATIVE_DEAD_ENDS.length * 2,
        stubPathCount: stubPaths,
        expectedStubPathCount: geomMod.DECORATIVE_DEAD_ENDS.length,
        stationVsDeadEndCollisions: collisions,
        spineMonotonic: geomMod.isSpineMonotonicRightToLeft(),
      };
    });
    await page.close();
  }

  // ---------- Red->green: mutate the dead-end renderer to draw a station on a dead end ----------
  {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    await page.goto(URL);
    results.deadEndMutation = await page.evaluate(async () => {
      const viewMod = await import('/src/stage/screens/maze-view.ts');
      const geomMod = await import('/src/stage/maze-geometry.ts');
      // BEFORE: manually inject a station-like circle into the dead-ends
      // group, simulating the regression the structural check exists to
      // catch (a future edit that accidentally draws a station marker on a
      // decorative stub).
      const { svg } = viewMod.buildMazeView({ N: 10, positions: [0, 0], teamNames: ['أ', 'ب'] });
      const deadEndsGroup = svg.querySelector('.maze-dead-ends');
      const fakeStation = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      fakeStation.setAttribute('class', 'maze-station maze-station-a');
      fakeStation.setAttribute('r', '6');
      deadEndsGroup.appendChild(fakeStation);
      const beforeCount = deadEndsGroup.querySelectorAll('circle').length;

      // AFTER: the real, unmutated renderer.
      const { svg: cleanSvg } = viewMod.buildMazeView({ N: 10, positions: [0, 0], teamNames: ['أ', 'ب'] });
      const afterCount = cleanSvg.querySelector('.maze-dead-ends').querySelectorAll('circle').length;
      void geomMod;
      return { beforeCount, afterCount };
    });
    await page.close();
  }

  // ---------- V13: control target sizes ----------
  {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    await page.goto(URL);
    await page.click('text=ابدأ اللعبة');
    await page.click('text=ابدأ');
    await page.waitForTimeout(1800);
    try { await page.click('.turn-handoff-overlay', { timeout: 1000 }); } catch {}
    await page.waitForTimeout(300);
    results.v13ControlSizes = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('.op-button, .undo-corner button'));
      const rects = buttons.map((b) => {
        const r = b.getBoundingClientRect();
        return { text: b.textContent, width: r.width, height: r.height, left: r.left, right: r.right };
      });
      const allMeetSize = rects.every((r) => r.width >= 240 && r.height >= 96);
      return { rects, allMeetSize };
    });
    await page.close();
  }

  // ---------- V13 gap check: a screen with MULTIPLE buttons side by side
  // (the audience-decision maze-beat, D-09.15's three-button screen) — the
  // single-button text-question bar above has nothing to measure a gap
  // against. Built directly (deterministic), not reached via a lucky RNG
  // playthrough into deck exhaustion. ----------
  {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    await page.goto(URL);
    results.v13GapCheck = await page.evaluate(async () => {
      const mod = await import('/src/stage/screens/maze-beat.ts');
      const appRoot = document.getElementById('app');
      appRoot.innerHTML = '';
      const container = document.createElement('div');
      container.className = 'stage-root';
      appRoot.appendChild(container);
      mod.renderMazeBeat(container, {
        N: 10, positions: [8, 8], teamNames: ['الفريق الأزرق', 'الفريق البرتقالي'],
        mode: 'audience-decision', onContinue: () => {}, onDeclare: () => {}, canUndo: false, onUndo: () => {},
      });
      const bar = document.querySelector('.audience-decision-buttons');
      const kids = Array.from(bar.children).map((c) => c.getBoundingClientRect()).sort((a, b) => a.left - b.left);
      let minGap = Infinity;
      for (let i = 1; i < kids.length; i++) minGap = Math.min(minGap, kids[i].left - kids[i - 1].right);
      const allMeetSize = kids.every((r) => r.width >= 240 && r.height >= 96);
      return { count: kids.length, minGap, allMeetSize, rects: kids.map((r) => ({ width: r.width, height: r.height })) };
    });
    await page.close();
  }

  // ---------- V12: greyscale distinguishability (structural + real screenshot) ----------
  {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
    await page.goto(URL);
    const structural = await page.evaluate(async () => {
      const viewMod = await import('/src/stage/screens/maze-view.ts');
      const { svg } = viewMod.buildMazeView({ N: 10, positions: [4, 7], teamNames: ['الفريق الأزرق', 'الفريق البرتقالي'] });
      document.body.appendChild(svg);
      const laneA = svg.querySelector('.maze-lane-a');
      const laneB = svg.querySelector('.maze-lane-b');
      // Read into PLAIN strings before removal — the same
      // read-after-.remove() staleness bug already caught and fixed twice
      // in verify-b2.manual.cjs (§4 items 5b in worklog-B2.md); a
      // getComputedStyle() CSSStyleDeclaration is LIVE and returns empty
      // once its element is detached.
      const dashArrayA = getComputedStyle(laneA).strokeDasharray;
      const dashArrayB = getComputedStyle(laneB).strokeDasharray;
      const tokenA = svg.querySelector('.maze-token-a');
      const tokenB = svg.querySelector('.maze-token-b');
      const shapeA = tokenA.querySelector('.maze-token-shape').tagName;
      const shapeB = tokenB.querySelector('.maze-token-shape').tagName;
      const labelA = tokenA.querySelector('.maze-token-label').textContent;
      const labelB = tokenB.querySelector('.maze-token-label').textContent;
      svg.remove();
      return {
        dashArrayA, dashArrayB,
        dashDiffers: dashArrayA !== dashArrayB,
        shapeA, shapeB, shapesDiffer: shapeA !== shapeB,
        labelA, labelB, labelsDiffer: labelA !== labelB,
      };
    });
    results.v12Structural = structural;

    // Real screenshot, colour removed via CSS filter, of a live maze-beat screen.
    await page.click('text=ابدأ اللعبة');
    await page.click('text=ابدأ');
    await page.waitForTimeout(1800);
    for (let i = 0; i < 6; i++) {
      const hasOverlay = await page.evaluate(() => !!document.querySelector('.turn-handoff-overlay'));
      if (hasOverlay) { try { await page.click('.turn-handoff-overlay', { timeout: 500 }); } catch {} await page.waitForTimeout(200); continue; }
      const hasQuestion = await page.evaluate(() => !!document.querySelector('.question-text, .audio-question-text, .image-question-overlay, .image-beat2'));
      if (hasQuestion) {
        try { await page.click('button:has-text("اعرض الخيارات"):not([disabled])', { timeout: 400 }); } catch {}
        try { await page.click('.option-card:not([disabled])', { timeout: 800 }); } catch {}
        await page.waitForTimeout(200);
        try { await page.click('button:has-text("السؤال التالي")', { timeout: 800 }); } catch {}
        await page.waitForTimeout(300);
        break;
      }
      await page.waitForTimeout(200);
    }
    const hasMaze = await page.evaluate(() => !!document.querySelector('.maze-svg'));
    if (hasMaze) {
      await page.addStyleTag({ content: '.stage-root { filter: grayscale(100%); }' });
      await page.screenshot({ path: path.join(OUT_DIR, 'stage-maze-greyscale.png') });
      results.v12ScreenshotTaken = true;
    } else {
      results.v12ScreenshotTaken = false;
    }
    await page.close();
  }

  // ---------- V24: actions from open to first question ----------
  {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    let actions = 0;
    await page.goto(URL);
    await page.click('text=ابدأ اللعبة'); actions++;
    await page.click('text=ابدأ'); actions++;
    // No further taps — draw + hand-off must clear on their own.
    await page.waitForTimeout(1700 + 1700);
    const reachedQuestion = await page.evaluate(() => !!document.querySelector('.question-text, .audio-question-text, .image-question-overlay, .image-beat2'));
    results.v24 = { actions, reachedQuestion };
    await page.close();
  }

  await browser.close();
  fs.writeFileSync(path.join(OUT_DIR, 'results-b3.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
