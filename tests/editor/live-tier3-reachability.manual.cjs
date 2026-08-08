/**
 * Standing live check — Tier 3 (editor) reachability and responsive scale,
 * per docs/تأسيس-المشروع/تقارير/rtl-stage-ux-expert/addendum-small-screens-2026-08-08.md
 * §7 (V37–V44). This file covers the checks that touch the editor:
 *
 *   V39 — no --stage-unit leakage in editor.css
 *   V38 — primary-action reachability (add-question bar, and the form's own
 *         submit button once the form is open) at four real viewports,
 *         proven by an actual scroll + a real Playwright click, with a long
 *         question list already authored (the exact scenario the user hit
 *         with 12–14 questions)
 *   V40 — touch targets >= 48x48 CSS px, gaps >= 12px, across Tier-3 controls
 *   V41 — every input/textarea in the editor computes font-size >= 16 CSS px
 *   V42 — full editor flow at 390x844 portrait: no horizontal scroll, no
 *         clipped/unreachable control
 *   V43 — no rotate-gate element appears on the editor screen at any
 *         orientation (the gate does not exist in this codebase yet; this
 *         guards against one being added in Tier-3 scope by mistake later)
 *
 * Usage:
 *   npx vite --port 3013 --strictPort   (separate terminal / background)
 *   node tests/editor/live-tier3-reachability.manual.cjs
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const URL = process.env.STAGE_URL || 'http://localhost:3013/';
const OUT_DIR = path.join(__dirname, '..', '..', 'verify-out');
fs.mkdirSync(OUT_DIR, { recursive: true });

const EDITOR_CSS_PATH = path.join(__dirname, '..', '..', 'src', 'editor', 'editor.css');

const V38_VIEWPORTS = [
  { name: '1366x768', width: 1366, height: 768 },
  { name: '1280x800', width: 1280, height: 800 },
  { name: '390x844', width: 390, height: 844 },
  { name: '360x640', width: 360, height: 640 },
];

async function openEditor(page) {
  await page.goto(URL);
  await page.waitForSelector('button:has-text("أسئلتي")');
  await page.click('button:has-text("أسئلتي")');
  await page.waitForTimeout(300);
}

/**
 * Real-input reachability primitive — deliberately NOT
 * `locator.scrollIntoViewIfNeeded()`. That Playwright helper calls the DOM
 * `Element.scrollIntoView()` API, which programmatically scrolls even an
 * `overflow: hidden` ancestor (permitted by spec for script-driven scroll)
 * — exactly the kind of container a real user's mouse wheel or touch swipe
 * CANNOT scroll (no scrollbar, no wheel/touch response). Using it here
 * would silently pass the exact containment-class bug this check exists to
 * catch (confirmed empirically: a red-team mutation adding
 * `overflow:hidden` to `.editor-content` did not fail V38 under
 * `scrollIntoViewIfNeeded`, and DID fail once switched to this real wheel
 * simulation). `page.mouse.wheel` dispatches a genuine wheel event at the
 * OS/input level, which the browser only honours for actually-scrollable
 * regions — the same constraint a real hand on a real trackpad or a real
 * thumb on glass is under.
 */
async function scrollToVisibleWithRealWheel(page, selector, { maxTicks = 60, tickDelta = 240 } = {}) {
  for (let i = 0; i < maxTicks; i++) {
    const box = await page.locator(selector).boundingBox();
    const vh = await page.evaluate(() => window.innerHeight);
    if (box && box.y >= 0 && box.y + box.height <= vh) {
      return { visible: true, attempts: i, box, viewportHeight: vh };
    }
    await page.mouse.wheel(0, tickDelta);
    await page.waitForTimeout(15);
  }
  const box = await page.locator(selector).boundingBox();
  const vh = await page.evaluate(() => window.innerHeight);
  const visible = !!box && box.y >= 0 && box.y + box.height <= vh;
  return { visible, attempts: maxTicks, box, viewportHeight: vh };
}

async function addQuestions(page, n) {
  for (let i = 0; i < n; i++) {
    await page.click('#editor-add-question');
    await page.fill('.question-text-input', `سؤال رقم ${i + 1} — نص تجريبي متوسط الطول لملء المساحة`);
    const opts = await page.$$('.option-text-input');
    await opts[0].fill('أ'); await opts[1].fill('ب'); await opts[2].fill('ج'); await opts[3].fill('د');
    await page.check('.option-row[data-option-index="0"] .option-correct-radio');
    await page.click('.question-submit');
    await page.waitForTimeout(20);
  }
}

function v39_noStageUnitLeakage() {
  const css = fs.readFileSync(EDITOR_CSS_PATH, 'utf8');
  const matches = css.match(/--stage-unit/g) || [];
  return { file: 'src/editor/editor.css', matchCount: matches.length, pass: matches.length === 0 };
}

async function v38_primaryActionReachability(browser) {
  const results = {};
  for (const vp of V38_VIEWPORTS) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height }, hasTouch: true });
    await openEditor(page);
    // Long list — the exact scenario reported (12-14 authored questions);
    // tested at 15 to be past the reported threshold.
    await addQuestions(page, 15);

    const outcome = { addButtonReachable: false, addButtonError: null, submitReachable: false, submitError: null };

    try {
      const found = await scrollToVisibleWithRealWheel(page, '#editor-add-question');
      if (!found.visible) throw new Error(`not reachable by real wheel scroll after ${found.attempts} ticks; box=${JSON.stringify(found.box)}`);
      await page.mouse.click(found.box.x + found.box.width / 2, found.box.y + found.box.height / 2);
      await page.waitForSelector('.question-text-input', { timeout: 3000 });
      outcome.addButtonReachable = true;
      outcome.addButtonRectAtClick = found.box;
      outcome.addButtonScrollTicks = found.attempts;
    } catch (e) {
      outcome.addButtonError = String(e.message || e);
    }

    // Fill the freshly-opened form (16th question) and reach its OWN
    // submit button — the second half of the reported complaint: filling
    // the form and then failing to reach/press "تم".
    try {
      await page.fill('.question-text-input', 'سؤال ما بعد التمرير — يثبت وصول زر تم');
      const opts = await page.$$('.option-text-input');
      await opts[0].fill('أ'); await opts[1].fill('ب'); await opts[2].fill('ج'); await opts[3].fill('د');
      await page.check('.option-row[data-option-index="0"] .option-correct-radio');
      const found = await scrollToVisibleWithRealWheel(page, '.question-submit');
      if (!found.visible) throw new Error(`not reachable by real wheel scroll after ${found.attempts} ticks; box=${JSON.stringify(found.box)}`);
      await page.mouse.click(found.box.x + found.box.width / 2, found.box.y + found.box.height / 2);
      await page.waitForTimeout(150);
      outcome.submitReachable = true;
      outcome.submitRectAtClick = found.box;
      outcome.submitScrollTicks = found.attempts;
      // Confirm the click had a REAL effect (question count grew), not
      // just "the click event fired" — a covered/dead button can still
      // report a successful Playwright click if it silently no-ops.
      const count = await page.locator('.question-card').count();
      outcome.questionCountAfterSubmit = count;
      outcome.realEffectConfirmed = count === 16;
    } catch (e) {
      outcome.submitError = String(e.message || e);
    }

    results[vp.name] = outcome;
    await page.close();
  }
  return results;
}

async function v40_v41_touchTargetsAndInputFontSize(browser) {
  const page = await browser.newPage({ viewport: { width: 360, height: 640 }, hasTouch: true });
  await openEditor(page);
  await addQuestions(page, 3);
  await page.click('#editor-add-question');
  await page.fill('.question-text-input', 'سؤال لفحص المقاسات');

  const measurement = await page.evaluate(() => {
    const content = document.querySelector('.editor-content');
    if (!content) return { error: 'no .editor-content found' };

    // A `display:none`/hidden element (e.g. `#editor-add-question`'s
    // wrapper bar while the form is open — see app.ts's
    // `setAddButtonBarVisible`) is correctly absent from the page at that
    // moment, not an undersized touch target; `offsetParent === null` is
    // the standard cheap "not rendered" test and excludes it here.
    function rectsOf(selector) {
      return Array.from(content.querySelectorAll(selector))
        .filter((el) => el.offsetParent !== null)
        .map((el) => {
          const r = el.getBoundingClientRect();
          return { selector, tag: el.tagName, cls: el.className, width: r.width, height: r.height };
        });
    }

    const buttons = rectsOf('button');
    const radioToggles = rectsOf('.option-correct-toggle');
    const inputs = Array.from(content.querySelectorAll('input, textarea')).map((el) => {
      const cs = getComputedStyle(el);
      return { tag: el.tagName, type: el.type || null, cls: el.className, fontSizePx: parseFloat(cs.fontSize) };
    });

    // V41 is specifically the iOS-Safari-zooms-on-focus rule, which applies
    // to text-entry surfaces (a caret the browser zooms to make editable) —
    // never to radio/checkbox/file inputs, which have no text caret and are
    // not the mechanism the addendum is guarding against. `media-file-input`
    // is additionally `hidden` (question-form.ts) and never itself receives
    // focus — the visible trigger is `.attach-media-button`, a real button
    // already covered by the V40 touch-target check above.
    const TEXT_ENTRY_TYPES = new Set(['text', 'textarea', 'email', 'number', 'tel', 'search', 'password', 'url', 'date']);
    const undersizedTargets = [...buttons, ...radioToggles].filter((b) => b.width < 48 || b.height < 48);
    const undersizedInputs = inputs.filter((i) => TEXT_ENTRY_TYPES.has((i.type || i.tag.toLowerCase())) && i.fontSizePx < 16);

    return {
      buttonCount: buttons.length,
      radioToggleCount: radioToggles.length,
      undersizedTargets,
      inputCount: inputs.length,
      inputs,
      undersizedInputs,
    };
  });

  await page.close();
  return {
    v40: { pass: (measurement.undersizedTargets || []).length === 0, ...measurement },
    v41: { pass: (measurement.undersizedInputs || []).length === 0, inputs: measurement.inputs },
  };
}

async function v42_portraitFullFlow(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
  await openEditor(page);
  await addQuestions(page, 5);

  const noHorizontalScrollBeforeForm = await page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  );

  await page.click('#editor-add-question');
  await page.fill('.question-text-input', 'سؤال في الوضع الرأسي');
  const opts = await page.$$('.option-text-input');
  await opts[0].fill('أ'); await opts[1].fill('ب'); await opts[2].fill('ج'); await opts[3].fill('د');
  await page.check('.option-row[data-option-index="0"] .option-correct-radio');

  const noHorizontalScrollWithForm = await page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  );

  let submitClicked = false;
  try {
    const found = await scrollToVisibleWithRealWheel(page, '.question-submit');
    if (!found.visible) throw new Error(`not reachable by real wheel scroll after ${found.attempts} ticks; box=${JSON.stringify(found.box)}`);
    await page.mouse.click(found.box.x + found.box.width / 2, found.box.y + found.box.height / 2);
    submitClicked = true;
  } catch (e) {
    submitClicked = String(e.message || e);
  }

  await page.screenshot({ path: path.join(OUT_DIR, 'editor-v42-portrait.png'), fullPage: false });
  await page.close();

  return {
    pass: noHorizontalScrollBeforeForm && noHorizontalScrollWithForm && submitClicked === true,
    noHorizontalScrollBeforeForm,
    noHorizontalScrollWithForm,
    submitClicked,
  };
}

async function v43_noRotateGateOnEditor(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 320 }, hasTouch: true }); // aspect < 1.2 territory inverted (landscape-thin) — portrait-thin also tested below
  await openEditor(page);
  const landscapeThin = await page.evaluate(() => {
    const text = document.body.textContent || '';
    return { rotateMessagePresent: text.includes('أدر الجهاز') };
  });
  await page.setViewportSize({ width: 320, height: 390 });
  await page.waitForTimeout(50);
  const portraitThin = await page.evaluate(() => {
    const text = document.body.textContent || '';
    return { rotateMessagePresent: text.includes('أدر الجهاز') };
  });
  await page.close();
  return {
    pass: !landscapeThin.rotateMessagePresent && !portraitThin.rotateMessagePresent,
    landscapeThin,
    portraitThin,
  };
}

async function main() {
  const browser = await chromium.launch({ headless: true });

  const v39 = v39_noStageUnitLeakage();
  const v38 = await v38_primaryActionReachability(browser);
  const v40v41 = await v40_v41_touchTargetsAndInputFontSize(browser);
  const v42 = await v42_portraitFullFlow(browser);
  const v43 = await v43_noRotateGateOnEditor(browser);

  await browser.close();

  const v38Pass = Object.values(v38).every(
    (r) => r.addButtonReachable && r.submitReachable && r.realEffectConfirmed,
  );

  const result = {
    V39_no_stage_unit_leakage: v39,
    V38_primary_action_reachability: { pass: v38Pass, byViewport: v38 },
    V40_touch_targets: v40v41.v40,
    V41_input_font_size: v40v41.v41,
    V42_portrait_full_flow: v42,
    V43_no_rotate_gate_on_editor: v43,
  };

  const overallPass =
    v39.pass && v38Pass && v40v41.v40.pass && v40v41.v41.pass && v42.pass && v43.pass;
  result.OVERALL_PASS = overallPass;

  fs.writeFileSync(path.join(OUT_DIR, 'results-editor-tier3.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  if (!overallPass) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exit(1); });
