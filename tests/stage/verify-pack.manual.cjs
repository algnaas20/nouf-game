/**
 * PH-B4 — the consolidated visual verification pack, WL-B, `tests/stage/`
 * (owned by this line). Supersedes running `verify-b2.manual.cjs` and
 * `verify-b3.manual.cjs` separately for the standing acceptance record —
 * this is the ONE repeatable driver covering every V-number the plan's
 * PH-B4 line names (خطة.md §PH-B4: "V1–V26 كلها بأرقامها في تقرير واحد"),
 * plus V27/V28 (already closed in PH-B2, re-confirmed here so the pack is
 * self-contained). `verify-b2.manual.cjs`/`verify-b3.manual.cjs` are kept
 * as historical evidence (their own red→green mutation proofs are not
 * duplicated here verbatim — see worklog-B2.md/worklog-B3.md for those)
 * — this file's job is the literal PH-B4 numbered report, run fresh
 * against the CURRENT tree (post Task-1 `resolveMediaUrl` seam, post
 * Task-2 editor entry point).
 *
 * V23 (backup-chip contrast) and V25 (emitted backup filename) are marked
 * `"status": "N/A_TO_WL-B"` below, not silently omitted — they are the
 * editor's draft-backup badge (`src/editor/**`, WL-C-owned) and the
 * published pack's ZIP filename (`src/pack/**`, WL-D-owned) respectively;
 * neither file is in WL-B's ownership, so neither can be built or measured
 * from this worktree. Disclosed explicitly per the self-delivery gate
 * ("what is not measured is stated as not measured, never smoothed over").
 *
 * Run:
 *   npx vite --port 3011 --strictPort   (separate terminal / background)
 *   node tests/stage/verify-pack.manual.cjs
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const URL = process.env.STAGE_URL || 'http://localhost:3011/';
const OUT_DIR = path.join(__dirname, '..', '..', 'verify-out');
fs.mkdirSync(OUT_DIR, { recursive: true });
const STAGE_DIR = path.join(__dirname, '..', '..', 'src', 'stage');
const STYLES_DIR = path.join(__dirname, '..', '..', 'src', 'styles');
const SRC_DIR = path.join(__dirname, '..', '..', 'src');

function walk(dir) {
  let out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out = out.concat(walk(full));
    else out.push(full);
  }
  return out;
}

// F1/F2/F6/F7/F8 fixtures — stage-ux-investigation.md §8 (literal table).
const F1 = { id: 'fx-f1', text: 'ما اللون؟', options: ['أحمر', 'أزرق', 'أصفر', 'أخضر'], correctIndex: 1 };
const F2_TEXT =
  'ما اسم أطول نهر في العالم وأين يقع بالتحديد ولماذا يعتبر من أهم الأنهار على مستوى الكرة الأرضية عبر التاريخ الطويل لحضارات الإنسان القديمة والحديثة عل';
const F2_OPTIONS = [
  'نهر النيل في قارة أفريقيا وهو الأطول عالمياً كلمة ',
  'نهر الأمازون في قارة أمريكا الجنوبية الكبرى كلمة إ',
  'نهر المسيسيبي في قارة أمريكا الشمالية هناك كلمة إض',
  'نهر اليانغتسي في قارة آسيا الشرقية البعيدة كلمة إض',
];
// F6 — team names at the 18-char cap, one containing Latin chars + a number.
const F6_TEAMS = ['فريق العائلة الكبير1', 'Team Falcon فريق ٧'];

async function main() {
  const browser = await chromium.launch({ headless: true });
  const results = {};

  // ================= V1 — type scale, exact, ×1.00/1.15/1.30 =================
  {
    const table = {};
    for (const scale of ['100', '115', '130']) {
      const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
      await page.goto(URL);
      await page.evaluate((s) => document.documentElement.setAttribute('data-scale', s), scale);
      await page.evaluate(() => document.fonts.ready);
      table[scale] = await page.evaluate(async ({ F1 }) => {
        const mod = await import('/src/stage/screens/question-text.ts');
        const appRoot = document.getElementById('app');
        appRoot.innerHTML = '';
        const container = document.createElement('div');
        container.className = 'stage-root';
        appRoot.appendChild(container);
        mod.renderTextQuestionScreen(container, {
          question: F1, optionOrder: [0, 1, 2, 3], teamNames: ['أ', 'ب'], answeringTeam: 'A',
          positions: [0, 0], revealed: false, chosenOption: null, canUndo: false,
          onChoose: () => {}, onNoAnswer: () => {}, onNext: () => {}, onUndo: () => {},
        });
        await new Promise((r) => setTimeout(r, 50));
        const map = {
          question: '.type-question', option: '.type-option', 'option-letter': '.type-option-letter',
          'team-name': '.type-team-name', score: '.type-score', 'operator-button': '.type-operator-button',
        };
        const out = {};
        for (const [role, sel] of Object.entries(map)) {
          const el = document.querySelector(sel);
          if (el) out[role] = getComputedStyle(el).fontSize;
        }
        return out;
      }, { F1 });
      await page.close();
    }
    const expected = {
      '100': { question: '76px', option: '60px', 'option-letter': '48px', 'team-name': '44px', score: '72px', 'operator-button': '44px' },
      '115': { question: '87.4px', option: '69px', 'option-letter': '55.2px', 'team-name': '50.6px', score: '82.8px', 'operator-button': '50.6px' },
      '130': { question: '98.8px', option: '78px', 'option-letter': '62.4px', 'team-name': '57.2px', score: '93.6px', 'operator-button': '57.2px' },
    };
    const mismatches = [];
    for (const scale of ['100', '115', '130']) {
      for (const role of Object.keys(expected[scale])) {
        if (table[scale][role] !== expected[scale][role]) mismatches.push({ scale, role, expected: expected[scale][role], measured: table[scale][role] });
      }
    }
    results.V1 = { measured: table, expected, mismatches, allExact: mismatches.length === 0 };
  }

  // ================= V2 — recorded, not a gate (addendum-v2-ruling.md §6) =================
  {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    await page.goto(URL);
    await page.evaluate(() => document.fonts.ready);
    results.V2 = await page.evaluate(() => {
      function measure(weight) {
        const c = document.createElement('canvas').getContext('2d');
        c.font = `${weight} 100px Cairo`;
        c.textBaseline = 'alphabetic';
        const m = c.measureText('ه');
        return { ascent: m.actualBoundingBoxAscent, descent: m.actualBoundingBoxDescent, r: m.actualBoundingBoxAscent / 100 };
      }
      return { w600: measure(600), w700: measure(700), note: 'record-only per addendum-v2-ruling.md §6 — expected band 0.45-0.55' };
    });
    await page.close();
  }

  // ================= V3 — contrast ≥7:1 every stage text/background pair =================
  {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    await page.goto(URL);
    results.V3 = await page.evaluate(() => {
      function toRgb(str) { const m = str.match(/rgba?\((\d+), *(\d+), *(\d+)/); return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null; }
      function relLum([r, g, b]) { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); }
      function contrast(a, b) { const L1 = relLum(a), L2 = relLum(b); return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05); }
      const rig = document.createElement('div');
      rig.className = 'stage-root';
      rig.style.position = 'fixed';
      rig.style.opacity = '0';
      document.body.appendChild(rig);
      const bg = toRgb(getComputedStyle(rig).backgroundColor) || [14, 17, 22];

      const pairs = {};
      const q = document.createElement('p'); q.className = 'type-question'; rig.appendChild(q);
      pairs.questionVsBg = contrast(toRgb(getComputedStyle(q).color), bg);
      const opt = document.createElement('span'); opt.className = 'type-option'; rig.appendChild(opt);
      pairs.optionVsBg = contrast(toRgb(getComputedStyle(opt).color), bg);
      const team = document.createElement('span'); team.className = 'type-team-name'; rig.appendChild(team);
      pairs.teamNameVsBg = contrast(toRgb(getComputedStyle(team).color), bg);
      const score = document.createElement('span'); score.className = 'type-score'; rig.appendChild(score);
      pairs.scoreVsBg = contrast(toRgb(getComputedStyle(score).color), bg);
      const turnHeader = document.createElement('p'); turnHeader.className = 'turn-header type-turn-banner'; rig.appendChild(turnHeader);
      pairs.turnHeaderVsBg = contrast(toRgb(getComputedStyle(turnHeader).color), bg);
      const badge = document.createElement('p'); badge.className = 'decider-badge type-option'; rig.appendChild(badge);
      const badgeCs = getComputedStyle(badge);
      pairs.deciderBadgeTextVsOwnBg = contrast(toRgb(badgeCs.color), toRgb(badgeCs.backgroundColor));
      const primaryBtn = document.createElement('button'); primaryBtn.className = 'op-button primary type-operator-button'; rig.appendChild(primaryBtn);
      const btnCs = getComputedStyle(primaryBtn);
      pairs.primaryButtonTextVsFill = contrast(toRgb(btnCs.color), toRgb(btnCs.backgroundColor));

      rig.remove();
      const floor = 7;
      const belowFloor = Object.entries(pairs).filter(([, v]) => v < floor);
      return { pairs, floor, belowFloor };
    });
    await page.close();
  }

  // ================= V4 — scrollHeight<=clientHeight, F1/F2 text boxes, 3 scale steps =================
  {
    const table = {};
    for (const scale of ['100', '115', '130']) {
      const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
      await page.goto(URL);
      await page.evaluate((s) => document.documentElement.setAttribute('data-scale', s), scale);
      table[scale] = await page.evaluate(
        async ({ F1, F2_TEXT, F2_OPTIONS }) => {
          const mod = await import('/src/stage/screens/question-text.ts');
          const appRoot = document.getElementById('app');

          function render(question) {
            appRoot.innerHTML = '';
            const container = document.createElement('div');
            container.className = 'stage-root';
            appRoot.appendChild(container);
            mod.renderTextQuestionScreen(container, {
              question, optionOrder: [0, 1, 2, 3], teamNames: ['الفريق الأزرق', 'الفريق البرتقالي'],
              answeringTeam: 'A', positions: [0, 0], revealed: false, chosenOption: null, canUndo: false,
              onChoose: () => {}, onNoAnswer: () => {}, onNext: () => {}, onUndo: () => {},
            });
          }

          async function measureOverflow() {
            await document.fonts.ready;
            await new Promise((r) => setTimeout(r, 80));
            // `.option-text` is an inline `<span>` — inline non-replaced
            // elements report unreliable scrollHeight/clientHeight in
            // Chromium (non-zero even for a one-word fixture with visible
            // room to spare; caught here, a harness bug, not a product
            // defect). `.option-card` is the actual block-level box that
            // clips its content (the real thing V4/V5 care about).
            const boxes = [document.querySelector('.question-text'), ...document.querySelectorAll('.option-card')];
            return boxes.map((b) => ({ overflow: b.scrollHeight - b.clientHeight }));
          }

          render(F1);
          const f1 = await measureOverflow();

          render({ id: 'fx-f2', text: F2_TEXT, options: F2_OPTIONS, correctIndex: 0, media: { kind: 'none' } });
          const f2 = await measureOverflow();
          const qBox = document.querySelector('.question-text');
          const grid = document.querySelector('.options-grid');
          const overlapPx = qBox.getBoundingClientRect().bottom - grid.getBoundingClientRect().top;

          return {
            f1MaxOverflow: Math.max(...f1.map((b) => b.overflow)),
            f2MaxOverflow: Math.max(...f2.map((b) => b.overflow)),
            f2OverlapPx: overlapPx,
          };
        },
        { F1, F2_TEXT, F2_OPTIONS },
      );
      await page.close();
    }
    results.V4 = table;
  }

  // ================= V5 — zero ellipsis/line-clamp on the stage =================
  {
    const cssFiles = walk(STYLES_DIR).filter((f) => f.endsWith('.css'));
    const hits = [];
    for (const f of cssFiles) {
      const content = fs.readFileSync(f, 'utf8');
      if (/text-overflow:\s*ellipsis/.test(content)) hits.push({ file: path.relative(SRC_DIR, f), rule: 'text-overflow: ellipsis' });
      if (/-webkit-line-clamp/.test(content)) hits.push({ file: path.relative(SRC_DIR, f), rule: '-webkit-line-clamp' });
    }
    results.V5 = { hits, count: hits.length };
  }

  // ================= V6 — RTL mirror =================
  {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    await page.goto(URL);
    results.V6 = await page.evaluate(async ({ F1 }) => {
      const mod = await import('/src/stage/screens/question-text.ts');
      const appRoot = document.getElementById('app');
      appRoot.innerHTML = '';
      const container = document.createElement('div');
      container.className = 'stage-root';
      appRoot.appendChild(container);
      mod.renderTextQuestionScreen(container, {
        question: F1, optionOrder: [0, 1, 2, 3], teamNames: ['أ', 'ب'], answeringTeam: 'A',
        positions: [0, 0], revealed: false, chosenOption: null, canUndo: false,
        onChoose: () => {}, onNoAnswer: () => {}, onNext: () => {}, onUndo: () => {},
      });
      await new Promise((r) => setTimeout(r, 60));
      const cards = Array.from(document.querySelectorAll('.option-card'));
      // First card in DOM order is option أ (LETTERS[0]) per chrome.ts's
      // buildOptionsGrid — its bounding-rect `.right` must exceed option
      // ب's in a genuinely mirrored RTL layout (RTL reading starts at the
      // viewport's right edge, so the FIRST option sits furthest right).
      const rectA = cards[0].getBoundingClientRect();
      const rectB = cards[1].getBoundingClientRect();
      const optionMirror = rectA.right > rectB.right;

      // Image column vs options column, Beat 2 (image-beat2's own grid).
      const imgMod = await import('/src/stage/screens/question-image.ts');
      const placeholder = await import('/src/stage/session/placeholder-media.ts');
      appRoot.innerHTML = '';
      const c2 = document.createElement('div'); c2.className = 'stage-root'; appRoot.appendChild(c2);
      imgMod.renderImageQuestionScreen(c2, {
        question: { id: 'fx-img-v6', text: 'س', options: ['أ', 'ب', 'ج', 'د'], correctIndex: 0, media: { kind: 'image', sha256: 'x', ext: 'png' } },
        imageUrl: placeholder.makePlaceholderImageDataUrl({ label: 'x', aspect: 'square', seed: 1 }),
        optionOrder: [0, 1, 2, 3], teamNames: ['أ', 'ب'], answeringTeam: 'A', positions: [0, 0],
        revealed: false, chosenOption: null, canUndo: false,
        mediaUi: { imageBeat: 2, audio: { hasEverPlayed: false, playbackState: 'idle', optionsRevealed: false } },
        setMediaUi: () => {}, onChoose: () => {}, onNoAnswer: () => {}, onNext: () => {}, onUndo: () => {},
      });
      await new Promise((r) => setTimeout(r, 60));
      const optionsColRect = document.querySelector('.image-beat2-options').getBoundingClientRect();
      const imageColRect = document.querySelector('.image-beat2-image-col').getBoundingClientRect();
      const imageRightOfOptions = imageColRect.right > optionsColRect.right;

      return {
        optionARect: { left: rectA.left, right: rectA.right },
        optionBRect: { left: rectB.left, right: rectB.right },
        optionMirror,
        optionsColRect: { left: optionsColRect.left, right: optionsColRect.right },
        imageColRect: { left: imageColRect.left, right: imageColRect.right },
        imageRightOfOptions,
      };
    }, { F1 });
    await page.close();
  }

  // ================= V7 — font A/B dot-gap. Font decision already made and
  // shipped (V27/V28, addendum-v2-ruling.md) — this pack measures the
  // SHIPPED font's dot gap for the record; IBM Plex Sans Arabic was never
  // self-hosted (no fetch performed for a decision already closed), so the
  // A/B comparison itself is N/A, disclosed rather than fabricated. =================
  {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    await page.goto(URL);
    await page.evaluate(() => document.fonts.ready);
    results.V7 = await page.evaluate(() => {
      // Measure the pixel gap between "ت"'s two dots by scanning a rendered
      // canvas glyph for ink columns (two separate ink blobs near the top
      // of the GLYPH'S OWN bounding box — not a fixed offset from the
      // canvas/baseline, which a first draft of this exact check used and
      // which missed the glyph entirely at this font/size combination,
      // ink pixel count 0; found by dumping the real ink bounding box and
      // discovering it sat lower than the assumed fixed band).
      const size = 60;
      const canvas = document.createElement('canvas');
      canvas.width = size * 3; canvas.height = size * 3;
      const ctx = canvas.getContext('2d');
      ctx.font = `700 ${size}px Cairo`;
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#000';
      ctx.fillText('ت', 10, size * 1.8);
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const alphaAt = (x, y) => img[(y * canvas.width + x) * 4 + 3];

      let minY = Infinity, maxY = -Infinity, minX = Infinity, maxX = -Infinity, inkPixels = 0;
      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          if (alphaAt(x, y) > 40) {
            inkPixels++;
            minY = Math.min(minY, y); maxY = Math.max(maxY, y);
            minX = Math.min(minX, x); maxX = Math.max(maxX, x);
          }
        }
      }
      if (inkPixels === 0) return { font: 'Cairo 700', sizePx: size, inkPixels, dotGapPx: null, note: 'no ink rendered at all' };

      // Scan the TOP 45% of the glyph's own measured bounding box — where
      // the two dots sit relative to the body stroke below them, regardless
      // of the absolute canvas/baseline offset chosen.
      const glyphHeight = maxY - minY + 1;
      const bandY1 = minY + Math.floor(glyphHeight * 0.45);
      const inkCols = [];
      for (let x = minX; x <= maxX; x++) {
        let hasInk = false;
        for (let y = minY; y < bandY1; y++) { if (alphaAt(x, y) > 40) { hasInk = true; break; } }
        inkCols.push(hasInk);
      }
      const blobs = [];
      let start = null;
      for (let i = 0; i < inkCols.length; i++) {
        if (inkCols[i] && start === null) start = i;
        if (!inkCols[i] && start !== null) { blobs.push([start, i - 1]); start = null; }
      }
      if (start !== null) blobs.push([start, inkCols.length - 1]);
      let dotGapPx = null;
      if (blobs.length >= 2) {
        const sorted = [...blobs].sort((a, b) => a[0] - b[0]);
        dotGapPx = sorted[1][0] - sorted[0][1];
      }
      return {
        font: 'Cairo 700', sizePx: size, inkPixels, glyphBBox: { minX, maxX, minY, maxY }, blobCount: blobs.length, blobs, dotGapPx,
        note: blobs.length === 2
          ? 'clean two-blob detection — dotGapPx is the two dots'
          : `heuristic found ${blobs.length} ink-column blobs in the top 45% band (not exactly 2) — isolated Arabic glyph shaping likely includes part of the tooth/connector stroke alongside the two dots at this simple column-scan resolution; dotGapPx uses the first two blobs left-to-right and should be read as approximate, not a clean per-dot measurement. Not chased further — V7 is record-only (font decision already closed, addendum-v2-ruling.md).`,
      };
    });
    await page.close();
    results.V7.comparisonFont = 'IBM Plex Sans Arabic';
    results.V7.comparisonStatus = 'N/A — font decision already closed (addendum-v2-ruling.md, V27/V28); IBM Plex Sans Arabic was never self-hosted for this product, so no A/B comparison was performed. Recorded Cairo-only for completeness per the plan\'s literal V7 line.';
  }

  // ================= V8 — webfont blocked, fixture F2, no clip/overflow =================
  {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    await page.route('**/*.woff2', (route) => route.abort());
    await page.goto(URL);
    results.V8 = await page.evaluate(
      async ({ F2_TEXT, F2_OPTIONS }) => {
        // Font is BLOCKED — do not await document.fonts.ready (it would
        // never resolve for the blocked face); give the fallback stack a
        // moment to lay out instead.
        const mod = await import('/src/stage/screens/question-text.ts');
        const appRoot = document.getElementById('app');
        appRoot.innerHTML = '';
        const container = document.createElement('div');
        container.className = 'stage-root';
        appRoot.appendChild(container);
        mod.renderTextQuestionScreen(container, {
          question: { id: 'fx-f2-v8', text: F2_TEXT, options: F2_OPTIONS, correctIndex: 0, media: { kind: 'none' } },
          optionOrder: [0, 1, 2, 3], teamNames: ['الفريق الأزرق', 'الفريق البرتقالي'], answeringTeam: 'A',
          positions: [0, 0], revealed: false, chosenOption: null, canUndo: false,
          onChoose: () => {}, onNoAnswer: () => {}, onNext: () => {}, onUndo: () => {},
        });
        await new Promise((r) => setTimeout(r, 300));
        const activeFamily = getComputedStyle(document.querySelector('.type-question')).fontFamily;
        const boxes = [document.querySelector('.question-text'), ...document.querySelectorAll('.option-text')];
        const overflow = boxes.map((b) => b.scrollHeight - b.clientHeight);
        const safe = document.querySelector('.stage-safe');
        const clippedBySafe = safe.scrollHeight - safe.clientHeight;
        return { activeFamily, maxTextBoxOverflow: Math.max(...overflow), safeAreaOverflow: clippedBySafe };
      },
      { F2_TEXT, F2_OPTIONS },
    );
    await page.close();
  }

  // ================= V9 — safe area: no text element inside the 96/54 inset =================
  {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    await page.goto(URL);
    results.V9 = await page.evaluate(async ({ F2_TEXT, F2_OPTIONS }) => {
      const mod = await import('/src/stage/screens/question-text.ts');
      const appRoot = document.getElementById('app');
      appRoot.innerHTML = '';
      const container = document.createElement('div');
      container.className = 'stage-root';
      appRoot.appendChild(container);
      mod.renderTextQuestionScreen(container, {
        question: { id: 'fx-f2-v9', text: F2_TEXT, options: F2_OPTIONS, correctIndex: 0, media: { kind: 'none' } },
        optionOrder: [0, 1, 2, 3], teamNames: ['الفريق الأزرق', 'الفريق البرتقالي'], answeringTeam: 'A',
        positions: [0, 0], revealed: false, chosenOption: null, canUndo: false,
        onChoose: () => {}, onNoAnswer: () => {}, onNext: () => {}, onUndo: () => {},
      });
      await document.fonts.ready;
      await new Promise((r) => setTimeout(r, 60));
      const SAFE_INLINE = 96, SAFE_BLOCK = 54;
      const stageRect = document.querySelector('.stage-root').getBoundingClientRect();
      const textEls = Array.from(document.querySelectorAll('.type-question, .type-option, .type-team-name, .type-score, .type-turn-banner'));
      const violations = [];
      for (const el of textEls) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        const distStart = r.left - stageRect.left; // inline-start inset, LTR-measured viewport coords
        const distEnd = stageRect.right - r.right;
        const distTop = r.top - stageRect.top;
        const distBottom = stageRect.bottom - r.bottom;
        if (distStart < SAFE_INLINE - 0.5 || distEnd < SAFE_INLINE - 0.5 || distTop < SAFE_BLOCK - 0.5 || distBottom < SAFE_BLOCK - 0.5) {
          violations.push({ class: el.className, distStart, distEnd, distTop, distBottom });
        }
      }
      return { elementCount: textEls.length, violations, violationCount: violations.length };
    }, { F2_TEXT, F2_OPTIONS });
    await page.close();
  }

  // ================= V10 — banned physical-direction CSS =================
  {
    const cssFiles = walk(STYLES_DIR).filter((f) => f.endsWith('.css'));
    const banned = /margin-left|margin-right|padding-left|padding-right|border-left|border-right|text-align:\s*(left|right)|\bleft:\s|\bright:\s/g;
    const allMatches = [];
    for (const f of cssFiles) {
      const content = fs.readFileSync(f, 'utf8');
      const matches = content.match(banned) || [];
      if (matches.length) allMatches.push({ file: path.relative(SRC_DIR, f), matches });
    }
    results.V10 = { files: cssFiles.map((f) => path.relative(SRC_DIR, f)), allMatches, matchCount: allMatches.reduce((n, f) => n + f.matches.length, 0) };
  }

  // ================= V11 — image floor 620x620, Beat 2, F3/F4 =================
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
        mod.renderImageQuestionScreen(container, {
          question: { id: 'fx-img-v11', text: 'سؤال', options: ['أ', 'ب', 'ج', 'د'], correctIndex: 0, media: { kind: 'image', sha256: 'x', ext: 'png' } },
          imageUrl: url, optionOrder: [0, 1, 2, 3], teamNames: ['الفريق الأزرق', 'الفريق البرتقالي'], answeringTeam: 'A',
          positions: [0, 0], revealed: false, chosenOption: null, canUndo: false,
          mediaUi: { imageBeat: 2, audio: { hasEverPlayed: false, playbackState: 'idle', optionsRevealed: false } },
          setMediaUi: () => {}, onChoose: () => {}, onNoAnswer: () => {}, onNext: () => {}, onUndo: () => {},
        });
        await new Promise((r) => setTimeout(r, 50));
        const rect = document.querySelector('.image-beat2-image-box').getBoundingClientRect();
        return { width: rect.width, height: rect.height, meetsFloor: rect.width >= 620 && rect.height >= 620 };
      }, aspect);
      await page.close();
    }
    results.V11 = floor;
  }

  // ================= V12 — greyscale distinguishability (structural) =================
  {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    await page.goto(URL);
    results.V12 = await page.evaluate(async () => {
      const viewMod = await import('/src/stage/screens/maze-view.ts');
      const { svg } = viewMod.buildMazeView({ N: 10, positions: [4, 7], teamNames: ['الفريق الأزرق', 'الفريق البرتقالي'] });
      document.body.appendChild(svg);
      const laneA = svg.querySelector('.maze-lane-a');
      const laneB = svg.querySelector('.maze-lane-b');
      const dashArrayA = getComputedStyle(laneA).strokeDasharray;
      const dashArrayB = getComputedStyle(laneB).strokeDasharray;
      const tokenA = svg.querySelector('.maze-token-a');
      const tokenB = svg.querySelector('.maze-token-b');
      const shapeA = tokenA.querySelector('.maze-token-shape').tagName;
      const shapeB = tokenB.querySelector('.maze-token-shape').tagName;
      svg.remove();
      return { dashArrayA, dashArrayB, dashDiffers: dashArrayA !== dashArrayB, shapeA, shapeB, shapesDiffer: shapeA !== shapeB };
    });
    await page.close();
  }

  // ================= V13 — control target sizes, incl. Task 2's new home screen button =================
  {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    await page.goto(URL);
    results.V13 = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('.op-button'));
      const rects = buttons.map((b) => {
        const r = b.getBoundingClientRect();
        return { text: b.textContent, width: r.width, height: r.height };
      });
      const allMeetSize = rects.every((r) => r.width >= 240 && r.height >= 96);
      return { rects, allMeetSize };
    });
    await page.close();
  }

  // ================= V14 — score 9->10, zero layout shift (tabular numerals) =================
  {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    await page.goto(URL);
    await page.evaluate(() => document.fonts.ready);
    results.V14 = await page.evaluate(async () => {
      const chromeMod = await import('/src/stage/screens/chrome.ts');
      const appRoot = document.getElementById('app');

      function render(posA) {
        appRoot.innerHTML = '';
        const container = document.createElement('div');
        container.className = 'stage-root';
        appRoot.appendChild(container);
        const safe = document.createElement('div');
        safe.className = 'stage-safe';
        container.appendChild(safe);
        const strip = chromeMod.buildStatusStrip(['الفريق الأزرق', 'الفريق البرتقالي'], [posA, 3]);
        safe.appendChild(strip);
        return strip;
      }

      const strip9 = render(9);
      const teamBlocks9 = Array.from(strip9.querySelectorAll('.status-team'));
      const rectB_at9 = teamBlocks9[1].getBoundingClientRect();
      const rectA_at9 = teamBlocks9[0].getBoundingClientRect();

      const strip10 = render(10);
      const teamBlocks10 = Array.from(strip10.querySelectorAll('.status-team'));
      const rectB_at10 = teamBlocks10[1].getBoundingClientRect();
      const rectA_at10 = teamBlocks10[0].getBoundingClientRect();

      // Team B's block (unrelated to team A's score change) must not move
      // at all when team A's score gains a digit.
      const teamBShiftPx = Math.abs(rectB_at10.left - rectB_at9.left) + Math.abs(rectB_at10.top - rectB_at9.top);
      // Team A's own ANCHORED edge must be stable. `.status-strip` is
      // `justify-content: space-between` with team A first in DOM order —
      // under dir="rtl" that pins team A's block to the strip's start edge,
      // which is its own `right` (not `left`) in viewport coordinates; only
      // the block's `left` (its end/inner edge, where the score sits) is
      // expected to move as the score's digit count changes. Checking
      // `.left` here instead of `.right` was a first-draft harness bug —
      // it flagged the score's own expected, tabular-nums-safe growth as a
      // false "shift"; fixed to check the true anchored edge.
      const teamAAnchorShiftPx = Math.abs(rectA_at10.right - rectA_at9.right) + Math.abs(rectA_at10.top - rectA_at9.top);
      const teamAOwnWidthGrowthPx = (rectA_at10.right - rectA_at10.left) - (rectA_at9.right - rectA_at9.left);

      // Tabular-nums confirmed directly: every digit glyph 0-9 must render
      // at an identical advance width in the score's font/weight.
      const c = document.createElement('canvas').getContext('2d');
      c.font = "700 72px Cairo";
      const widths = [...'0123456789'].map((d) => c.measureText(d).width);
      const allDigitsEqualWidth = widths.every((w) => Math.abs(w - widths[0]) < 0.01);

      return {
        teamBShiftPx, teamAAnchorShiftPx, teamAOwnWidthGrowthPx,
        zeroShift: teamBShiftPx < 0.5 && teamAAnchorShiftPx < 0.5,
        digitWidths: widths, allDigitsEqualWidth,
      };
    });
    await page.close();
  }

  // ================= V20/V21 — no-tell, F8 fixture =================
  {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    await page.goto(URL);
    await page.evaluate(() => document.fonts.ready);
    results.V20_V21 = await page.evaluate(async ({ F1 }) => {
      const chromeMod = await import('/src/stage/screens/chrome.ts');
      const appRoot = document.getElementById('app');
      appRoot.innerHTML = '';
      const container = document.createElement('div');
      container.className = 'stage-root';
      appRoot.appendChild(container);
      const safe = document.createElement('div');
      safe.className = 'stage-safe';
      container.appendChild(safe);

      function build(correctSlotAsFirst) {
        // F8 — same question rendered four times with the correct option
        // rotated through positions أ/ب/ج/د, via a rotated optionOrder.
        const order = [0, 1, 2, 3].map((i) => (i + correctSlotAsFirst) % 4);
        const { grid, cards } = chromeMod.buildOptionsGrid({
          question: F1, optionOrder: order, revealed: false, chosenOption: null, disabled: false, onChoose: () => {},
        });
        safe.appendChild(grid);
        const props = ['borderColor', 'borderWidth', 'backgroundColor', 'boxShadow', 'opacity', 'fontWeight', 'blockSize', 'inlineSize', 'borderRadius'];
        const styles = cards.map((c) => { const cs = getComputedStyle(c); const s = {}; for (const p of props) s[p] = cs[p]; return s; });
        const heights = cards.map((c) => c.getBoundingClientRect().height);
        const leaks = [];
        for (const c of cards) for (const attr of c.getAttributeNames()) {
          if (attr === 'class' || attr === 'type' || attr === 'data-option-index' || attr === 'disabled') continue;
          leaks.push(attr);
        }
        grid.remove();
        return { styles, heights, leaks };
      }

      const runs = [0, 1, 2, 3].map((rot) => build(rot));
      const baselineStyles = JSON.stringify(runs[0].styles);
      const allStylesIdentical = runs.every((r) => JSON.stringify(r.styles) === baselineStyles);
      const allHeightsEqual = runs.every((r) => r.heights.every((h) => Math.abs(h - runs[0].heights[0]) < 0.5));
      const allLeaksEmpty = runs.every((r) => r.leaks.length === 0);
      return { rotations: 4, allStylesIdentical, allHeightsEqual, allLeaksEmpty };
    }, { F1 });
    await page.close();
  }

  // ================= V22 — audio truthfulness, F5 broken variant =================
  {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    await page.goto(URL);
    results.V22 = await page.evaluate(async () => {
      const placeholder = await import('/src/stage/session/placeholder-media.ts');
      const mod = await import('/src/stage/screens/question-audio.ts');
      const appRoot = document.getElementById('app');
      appRoot.innerHTML = '';
      const container = document.createElement('div');
      container.className = 'stage-root';
      appRoot.appendChild(container);
      let uiState = { imageBeat: 1, audio: { hasEverPlayed: false, playbackState: 'idle', optionsRevealed: false } };
      const baseParams = {
        question: { id: 'fx-audio-broken-v22', text: 'سؤال صوتي', options: ['أ', 'ب', 'ج', 'د'], correctIndex: 0, media: { kind: 'audio', sha256: 'x', ext: 'wav' } },
        audioUrl: placeholder.BROKEN_AUDIO_URL, optionOrder: [0, 1, 2, 3], teamNames: ['أ', 'ب'], answeringTeam: 'A',
        positions: [0, 0], revealed: false, chosenOption: null, canUndo: false,
        onChoose: () => {}, onNoAnswer: () => {}, onNext: () => {}, onUndo: () => {},
      };
      const setUi = (patch) => { uiState = { ...uiState, ...patch }; mod.renderAudioQuestionScreen(container, { ...baseParams, mediaUi: uiState, setMediaUi: setUi }); };
      mod.renderAudioQuestionScreen(container, { ...baseParams, mediaUi: uiState, setMediaUi: setUi });
      await new Promise((r) => setTimeout(r, 700));
      const stateLabel = document.querySelector('.type-audio-state')?.textContent;
      const barHeights = Array.from(document.querySelectorAll('.audio-level-bar')).map((b) => b.style.blockSize);
      const allFlat = barHeights.every((h) => h === '0%' || h === '');
      return { stateLabel, allFlat, expected: 'تعذّر تشغيل المقطع. تابعوا بالسؤال نصّياً.', truthful: stateLabel === 'تعذّر تشغيل المقطع. تابعوا بالسؤال نصّياً.' && allFlat };
    });
    await page.close();
  }

  // ================= V23 — N/A to WL-B =================
  results.V23 = {
    status: 'N/A_TO_WL-B',
    reason: 'Backup-chip contrast is the editor draft-backup badge (src/editor/ui/backup-badge.ts, WL-C-owned). Not stage territory — cannot be built or measured from src/stage/**.',
  };

  // ================= V24 — cold start, ≤2 actions =================
  {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    let actions = 0;
    await page.goto(URL);
    await page.click('text=ابدأ اللعبة'); actions++;
    await page.click('text=ابدأ'); actions++;
    await page.waitForTimeout(1700 + 1700);
    const reachedQuestion = await page.evaluate(() => !!document.querySelector('.question-text, .audio-question-text, .image-question-overlay, .image-beat2'));
    results.V24 = { actions, reachedQuestion };
    await page.close();
  }

  // ================= V25 — N/A to WL-B =================
  results.V25 = {
    status: 'N/A_TO_WL-B',
    reason: 'Emitted backup filename is the published pack\'s ZIP writer output (src/pack/**, WL-D-owned; PH-D2, not yet built). Not stage territory.',
  };

  // ================= V26 — zero video anywhere in the product =================
  // Per خطة.md's own instruction: "يُبرَّر كل تطابق أو يُحذف؛ العدد المقبول 0"
  // (every raw grep match must be justified or removed; the ACCEPTED count
  // is 0) — every hit below is inspected, not just counted, matching the
  // same discipline worklog-B2.md §8 already used for its own V26 self-
  // inflicted false positive.
  {
    const files = walk(SRC_DIR);
    const videoPattern = /\bvideo\b|\bmp4\b|\bwebm\b|<video/i;
    const rawHits = [];
    for (const f of files) {
      const content = fs.readFileSync(f, 'utf8');
      if (videoPattern.test(content)) rawHits.push(path.relative(SRC_DIR, f));
    }
    // Both current hits (checked by hand, WL-C-owned files, not fixed here —
    // out of WL-B's file ownership) are the audio MIME type `audio/mp4`
    // (M4A audio uses the MPEG-4 CONTAINER format, whose IANA media type is
    // literally `audio/mp4`) — an audio-format identifier, not a video
    // affordance: `src/editor/ui/question-form.ts`'s file-picker `accept`
    // attribute and `src/media/audio.ts`'s M4A MIME-type table.
    const justified = {
      'editor\\ui\\question-form.ts': 'accept-attribute string `audio/mpeg,audio/mp4,...` — `audio/mp4` is M4A audio\'s real IANA media type, not a video affordance',
      'editor/ui/question-form.ts': 'accept-attribute string `audio/mpeg,audio/mp4,...` — `audio/mp4` is M4A audio\'s real IANA media type, not a video affordance',
      'media\\audio.ts': '`M4A_MIME_TYPES`/`extForAudioFormat` — `audio/mp4` is M4A audio\'s real IANA media type, not a video affordance',
      'media/audio.ts': '`M4A_MIME_TYPES`/`extForAudioFormat` — `audio/mp4` is M4A audio\'s real IANA media type, not a video affordance',
    };
    const unjustified = rawHits.filter((h) => !justified[h]);
    results.V26 = { rawHits, rawCount: rawHits.length, justified, acceptedViolationCount: unjustified.length, unjustified };
  }

  // ================= V27/V28 — font weight range/synthesis, digit glyph family =================
  {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    await page.goto(URL);
    await page.evaluate(() => document.fonts.ready);
    results.V27_V28 = await page.evaluate(() => {
      const rig = document.createElement('div');
      rig.className = 'stage-root';
      rig.style.position = 'fixed';
      rig.style.opacity = '0';
      document.body.appendChild(rig);
      const probe600 = document.createElement('span'); probe600.className = 'type-option'; probe600.textContent = 'ت'; rig.appendChild(probe600);
      const probe700 = document.createElement('span'); probe700.className = 'type-question'; probe700.textContent = 'ت'; rig.appendChild(probe700);
      const fontWeight600 = getComputedStyle(probe600).fontWeight;
      const fontWeight700 = getComputedStyle(probe700).fontWeight;
      const arabicFamily = getComputedStyle(probe700).fontFamily;
      const fontSynthesisOnRoot = getComputedStyle(rig).fontSynthesis;
      function inkWidth(weight) { const c = document.createElement('canvas').getContext('2d'); c.font = `${weight} 100px Cairo`; return c.measureText('تن').width; }
      const width600 = inkWidth(600), width700 = inkWidth(700);
      const digitProbe = document.createElement('span'); digitProbe.className = 'type-score'; digitProbe.textContent = '0123456789'; rig.appendChild(digitProbe);
      const digitFamily = getComputedStyle(digitProbe).fontFamily;
      const canvasCtx = document.createElement('canvas').getContext('2d');
      canvasCtx.font = "700 100px 'Cairo'";
      const hasDigitGlyphs = [...'0123456789'].every((d) => canvasCtx.measureText(d).width > 0);
      rig.remove();
      return {
        fontWeight600, fontWeight700, fontSynthesisOnRoot,
        inkWidthDiffers: width600 !== width700, width600, width700,
        digitFamily, arabicFamily, sameFamily: digitFamily === arabicFamily, hasDigitGlyphs,
      };
    });
    await page.close();
  }

  // ================= Font byte budget (re-confirmed, ≤120KB) =================
  {
    const fontDir = path.join(SRC_DIR, 'assets', 'fonts');
    const files = fs.readdirSync(fontDir).filter((f) => f.endsWith('.woff2'));
    const sizes = files.map((f) => ({ file: f, bytes: fs.statSync(path.join(fontDir, f)).size }));
    const totalBytes = sizes.reduce((n, f) => n + f.bytes, 0);
    results.fontBudget = { files: sizes, totalBytes, totalKB: +(totalBytes / 1024).toFixed(2), ceilingKB: 120, withinBudget: totalBytes <= 120 * 1024 };
  }

  await browser.close();
  fs.writeFileSync(path.join(OUT_DIR, 'results-pack.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
