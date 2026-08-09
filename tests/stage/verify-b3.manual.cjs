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

/**
 * D-25 / F-1 (worklog-B5.md, 2026-08-08): no bundled demo deck any more —
 * «ابدأ» on team-setup is disabled on an empty deck (the readiness gate,
 * task 3). Every scenario below that needs a real playable game now seeds
 * one first, through the real `DraftStore` (same technique
 * verify-pack.manual.cjs's re-pointed V24 and verify-b2.manual.cjs's
 * v1Recheck use), then reloads so `mountApp`'s own deck loader picks it up,
 * then drives home -> team-setup -> confirm exactly as before.
 */
async function seedDeckThenStartGame(page) {
  await page.evaluate(async () => {
    const { createDraftStore } = await import('/src/editor/draft-store.ts');
    const store = createDraftStore();
    await store.load();
    for (let i = 0; i < 25; i++) {
      await store.addQuestion({ text: `سؤال B3 رقم ${i + 1}`, options: ['أ', 'ب', 'ج', 'د'], correctIndex: 0 });
    }
  });
  await page.reload();
  await page.waitForTimeout(200);
  await page.click('button:has-text("ابدأ اللعبة")');
  await page.click('button:has-text("ابدأ"):not(:has-text("اللعبة"))');
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
      // Deck-floor addendum (2026-08-08, binding, worklog-B7.md §3) REPLACED
      // the old warn-band literal — 'تكفي غالباً، وإذا كثرت الأخطاء...' no
      // longer appears (D-09.21's two-number rule superseded it); the two
      // lines below are its actual current binding replacements. The old
      // 'إذا وصلوا النهاية سوا → سؤال الحسم' string was never present in
      // this tree even before this session (a pre-existing stale entry,
      // not touched here).
      { file: 'screens/team-setup.ts', literal: 'لو خلصت الأسئلة قبل ما يوصل أحد، يفوز المتقدّم' },
      { file: 'screens/team-setup.ts', literal: 'تكفي لمسار' },
      // 'البداية' — REMOVED by design (worklog-B7.md §4): the new
      // three-register model has two DIFFERENT entries (one per team, no
      // longer a single shared start), so only the one SHARED goal
      // ('النهاية') is a labelled marker; entries are unlabelled token
      // starting points. Not a regression — game-systems-expert
      // 2026-08-08 §2.1 ("Reading D... two entries").
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

  // ---------- SUPERSEDED (worklog-B7.md §4, disclosed not silently
  // dropped): this section tested the OLD M1 congruent-corridor model's
  // DECORATIVE dead ends (`.maze-dead-ends`, `.maze-station`,
  // `DECORATIVE_DEAD_ENDS`, `stationProgressValues`, a single "spine") —
  // D-24 (the user's «مو تحط لي خط» ruling) explicitly supersedes that
  // whole model; `game-systems-expert`'s 2026-08-08 redesign deletes
  // `MazeCell`/`CORRIDOR_SPINE`/`DECORATIVE_DEAD_ENDS` outright and replaces
  // "decorative dead end vs station" with a fundamentally different
  // concept (REAL dead ends at REAL junctions, no "station" glyph concept
  // at all). There is no direct equivalent assertion to port — a full
  // redesign of this check is out of this session's time budget; NOT
  // fixed, only disabled so the rest of this script's still-valid checks
  // (literal-string audit, V13, V12, V24 below) can run. The redesign's
  // OWN structural guarantees (I12/G7', "no junction ever fully closed",
  // M-GEN-1 disjoint routes) are proven at the data layer by WL-A's
  // `tools/sim/invariants.ts` and at the rendering layer by
  // `tests/stage/maze-fog.test.ts` / `maze-trail-separation.test.ts` — see
  // worklog-B7.md.
  results.deadEndStructure = { superseded: true, reason: 'D-24 / maze redesign 2026-08-08 — see worklog-B7.md §4' };
  results.deadEndMutation = { superseded: true, reason: 'D-24 / maze redesign 2026-08-08 — see worklog-B7.md §4' };

  // ---------- V13: control target sizes ----------
  {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    await page.goto(URL);
    await seedDeckThenStartGame(page);
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
      // B7 maze redesign (worklog-B7.md): `renderMazeBeat` now needs
      // `closedExits`/`wasted`/`decorSeed` (state fields that did not
      // exist in the old M1 model) and no longer takes `onContinue`
      // ('continue' mode auto-advances — see maze-beat.ts's own doc
      // comment); `justMoved: null` is the normal "nothing special
      // happened" value.
      mod.renderMazeBeat(container, {
        N: 10, positions: [8, 8], closedExits: [[], []], wasted: [0, 0], decorSeed: 12345,
        teamNames: ['الفريق الأزرق', 'الفريق البرتقالي'],
        mode: 'audience-decision', justMoved: null, onDeclare: () => {}, canUndo: false, onUndo: () => {},
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
      // B7 maze redesign (worklog-B7.md): `.maze-lane-a`/`.maze-lane-b`
      // (the old M1 corridor) are now `.maze-trail-core-a`/
      // `.maze-trail-core-b`; `buildMazeView` needs the new state fields.
      const { svg } = viewMod.buildMazeView({
        N: 10, positions: [4, 7], closedExits: [[], []], wasted: [0, 0], decorSeed: 12345,
        teamNames: ['الفريق الأزرق', 'الفريق البرتقالي'],
      });
      document.body.appendChild(svg);
      const laneA = svg.querySelector('.maze-trail-core-a');
      const laneB = svg.querySelector('.maze-trail-core-b');
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
    await seedDeckThenStartGame(page);
    await page.waitForTimeout(1800);
    for (let i = 0; i < 6; i++) {
      const hasOverlay = await page.evaluate(() => !!document.querySelector('.turn-handoff-overlay'));
      if (hasOverlay) { try { await page.click('.turn-handoff-overlay', { timeout: 500 }); } catch {} await page.waitForTimeout(200); continue; }
      const hasQuestion = await page.evaluate(() => !!document.querySelector('.question-text, .audio-question-text, .image-question-overlay, .image-beat2'));
      if (hasQuestion) {
        try { await page.click('button:has-text("اعرض الخيارات"):not([disabled])', { timeout: 400 }); } catch {}
        try { await page.click('.option-card:not([disabled])', { timeout: 800 }); } catch {}
        await page.waitForTimeout(500); // clear the route action band's arm delay either way
        // B7 maze redesign (worklog-B7.md): correct answers show 2-3
        // route cards (أعلى/وسط/أسفل), not "السؤال التالي" — `.route-card`
        // covers both that case and the wrong-answer single card.
        try { await page.click('.route-card:not([disabled])', { timeout: 800 }); } catch {}
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
  // D-25 / F-1: measured against an already-authored deck (task 2's whole
  // point — see verify-pack.manual.cjs's own re-pointed V24 comment). The
  // seeding step itself is not counted in `actions` (a real host authored
  // it days earlier, not as part of the 2-tap play-night flow).
  {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    let actions = 0;
    await page.goto(URL);
    await page.evaluate(async () => {
      const { createDraftStore } = await import('/src/editor/draft-store.ts');
      const store = createDraftStore();
      await store.load();
      for (let i = 0; i < 25; i++) {
        await store.addQuestion({ text: `سؤال B3 V24 رقم ${i + 1}`, options: ['أ', 'ب', 'ج', 'د'], correctIndex: 0 });
      }
    });
    await page.reload();
    await page.waitForTimeout(200);
    await page.click('button:has-text("ابدأ اللعبة")'); actions++;
    await page.click('button:has-text("ابدأ"):not(:has-text("اللعبة"))'); actions++;
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
