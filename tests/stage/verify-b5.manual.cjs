/**
 * WL-B5 verification driver — the primary, up-to-date proof for this phase
 * (supersedes nothing older; those stay as historical evidence for their
 * own features, see worklog-B5.md §"what was NOT re-verified" for exactly
 * which older scripts still assume the deleted demo deck and were not
 * re-pointed this session).
 *
 * Proves, against the REAL running app (dev server) and separately against
 * the BUILT bundle (the reviewer's own tree-shaking-probe technique):
 *   - F-1: the authored/imported deck — not a demo deck — is what plays,
 *     including real author-uploaded image/audio media reaching the stage.
 *   - F-1 dead-button fix: the editor's «احفظ نسخة» button now really saves.
 *   - F-3: the refuse-band message names a track the deck can carry.
 *   - F-4: undo on the ending screen does not silently self-revert.
 *   - D-25 task 2/3: zero-question home screen + the team-setup readiness
 *     gate (disable "ابدأ" until the deck can support a track).
 *
 *   npx vite --port 3011 --strictPort      (separate terminal / background)
 *   node tests/stage/verify-b5.manual.cjs
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const URL = process.env.STAGE_URL || 'http://localhost:3011/';
const OUT_DIR = path.join(__dirname, '..', '..', 'verify-out');
fs.mkdirSync(OUT_DIR, { recursive: true });

// A real, minimal, valid 1x1 PNG (black pixel) — decodes fine via
// `createImageBitmap`, exercising the REAL image-intake pipeline
// (src/media/image.ts), not a synthetic canvas data: URL.
const PNG_1PX_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

/** A short, real, playable WAV tone (mono, 8kHz, 16-bit PCM) — same
 *  synthesis `tests/stage/fixtures/placeholder-media.ts` uses in-browser,
 *  reimplemented here in plain Node so a real `Buffer` can be handed to
 *  Playwright's `setInputFiles` (no browser context available at this
 *  point in the script). */
function makeWavBuffer(freqHz, seconds) {
  const sampleRate = 8000;
  const length = Math.max(1, Math.floor(sampleRate * seconds));
  const buffer = Buffer.alloc(44 + length * 2);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + length * 2, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(length * 2, 40);
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const env = Math.min(1, t * 20) * Math.min(1, (seconds - t) * 20);
    const sample = Math.sin(2 * Math.PI * freqHz * t) * 0.4 * env;
    buffer.writeInt16LE(Math.round(Math.max(-1, Math.min(1, sample)) * 32767), 44 + i * 2);
  }
  return buffer;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const results = {};
  try {
    await run(browser, results);
  } finally {
    fs.writeFileSync(path.join(OUT_DIR, 'results-b5.json'), JSON.stringify(results, null, 2));
    await browser.close();
  }
  console.log(JSON.stringify(results, null, 2));
}

async function run(browser, results) {
  // ===================================================================
  // 1. D-25 task 2 — zero-question home screen is a designed primary path
  // ===================================================================
  {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    await page.goto(URL);
    await sleep(150); // mountApp's own store.load()+refreshDeck() are async
    results.zeroQuestionHome = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button')).map((b) => b.textContent.trim());
      const guidance = document.querySelector('.home-guidance-line')?.textContent ?? null;
      const editorBtn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.trim() === 'أسئلتي');
      const startBtn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.trim() === 'ابدأ اللعبة');
      return {
        buttons,
        guidance,
        editorIsPrimary: editorBtn?.classList.contains('primary') ?? false,
        startIsPrimary: startBtn?.classList.contains('primary') ?? false,
      };
    });
    await page.screenshot({ path: path.join(OUT_DIR, 'b5-zero-question-home.png') });
    await page.close();
  }

  // ===================================================================
  // 2. F-3 + task 3 — team-setup readiness gate, refuse-band message
  // ===================================================================
  {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    await page.goto(URL);
    // Seed a SMALL deck (18 questions): refuse at N=10 (needs 38 green /
    // 22 to avoid refuse), warn at N=6 (needs >=16 to avoid refuse, >=24
    // for green) — 18 lands: N=6 warn, N=10 refuse. Matches the exact
    // shape F-3 is about (a refuse band that must NOT claim the refused
    // length is fine).
    await page.evaluate(async () => {
      const { createDraftStore } = await import('/src/editor/draft-store.ts');
      const store = createDraftStore();
      await store.load();
      for (let i = 0; i < 18; i++) {
        await store.addQuestion({ text: `سؤال المؤلف رقم ${i + 1}`, options: ['أ', 'ب', 'ج', 'د'], correctIndex: 0 });
      }
    });
    await page.reload();
    await sleep(150);
    await page.click('button:has-text("ابدأ اللعبة")');
    // Default preselect for D=18 is N=6 (warn, not refuse) — force N=10 to
    // exercise the refuse band directly (F-3's own reproduction used D=18
    // against N=10). Scoped to `button:has-text` throughout this script —
    // worklog-B4.md §D.1's own documented trap (a bare `text=` selector
    // substring-matches inert non-interactive text too), re-triggered once
    // by this session's own new home-screen guidance copy (§1) before being
    // caught and fixed here.
    await page.click('button:has-text("عادية — 10")');
    results.f3RefuseBand = await page.evaluate(() => {
      const bandLine = document.querySelector('.deck-band-line')?.textContent ?? null;
      const confirmBtn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.trim() === 'ابدأ');
      return { bandLine, confirmDisabled: confirmBtn?.disabled ?? null, selectedN: 10 };
    });
    // Real deckBand/maxGreenTrackLength, measured the same way, for the
    // assertion below (not re-derived — imported from the real module).
    results.f3Expected = await page.evaluate(async () => {
      const { deckBand, maxGreenTrackLength } = await import('/src/core/rules/deck-bands.ts');
      return { band10: deckBand(18, 10), maxGreen: maxGreenTrackLength(18) };
    });
    await page.screenshot({ path: path.join(OUT_DIR, 'b5-refuse-band.png') });
    await page.close();
  }

  // ===================================================================
  // 3. Task 3 — a green-band deck enables "ابدأ"
  // ===================================================================
  {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    await page.goto(URL);
    await page.evaluate(async () => {
      const { createDraftStore } = await import('/src/editor/draft-store.ts');
      const store = createDraftStore();
      await store.load();
      // deckBand(25, 6): greenThreshold = 3.34*6+4 = 24.04 -> 25 is green.
      for (let i = 0; i < 25; i++) {
        await store.addQuestion({ text: `سؤال المؤلف رقم ${i + 1}`, options: ['أ', 'ب', 'ج', 'د'], correctIndex: 0 });
      }
    });
    await page.reload();
    await sleep(150);
    await page.click('button:has-text("ابدأ اللعبة")');
    await page.click('button:has-text("قصيرة — 6")');
    results.greenBandEnabled = await page.evaluate(() => {
      const confirmBtn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.trim() === 'ابدأ');
      return { confirmDisabled: confirmBtn?.disabled ?? null, bandLine: document.querySelector('.deck-band-line')?.textContent };
    });
    await page.close();
  }

  // ===================================================================
  // 4. F-1 core — author a question with a REAL image and REAL audio
  //    through the REAL editor UI, then prove the exact same bytes reach
  //    the stage via the resolveMediaUrl seam (not a placeholder).
  // ===================================================================
  {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    await page.goto(URL);
    await page.click('button:has-text("أسئلتي")');
    await sleep(100);

    // ---- author the IMAGE question, through the real form ----
    await page.click('#editor-add-question');
    await page.fill('.question-text-input', 'سؤال المؤلف — صورة حقيقية');
    const optionInputsImg = await page.$$('.option-text-input');
    await optionInputsImg[0].fill('خيار أ');
    await optionInputsImg[1].fill('خيار ب');
    await optionInputsImg[2].fill('خيار ج');
    await optionInputsImg[3].fill('خيار د');
    await page.setInputFiles('.media-file-input', {
      name: 'author-image.png',
      mimeType: 'image/png',
      buffer: Buffer.from(PNG_1PX_BASE64, 'base64'),
    });
    await sleep(300); // real decode/downscale pipeline
    await page.check('.option-row[data-option-index="1"] .option-correct-radio');
    await page.click('.question-submit');
    await sleep(150);

    // ---- author the AUDIO question, through the real form ----
    await page.click('#editor-add-question');
    await page.fill('.question-text-input', 'سؤال المؤلف — صوت حقيقي');
    const optionInputsAud = await page.$$('.option-text-input');
    await optionInputsAud[0].fill('خيار أ');
    await optionInputsAud[1].fill('خيار ب');
    await optionInputsAud[2].fill('خيار ج');
    await optionInputsAud[3].fill('خيار د');
    await page.setInputFiles('.media-file-input', {
      name: 'author-audio.wav',
      mimeType: 'audio/wav',
      buffer: makeWavBuffer(440, 1.5),
    });
    await sleep(300); // real playability-validation load test
    await page.check('.option-row[data-option-index="2"] .option-correct-radio');
    await page.click('.question-submit');
    await sleep(150);

    // ---- direct proof: buildPackFromDraft (the REAL function app.ts uses)
    //      sees both questions, and the media Map's blobs, resolved through
    //      the SAME resolveMediaUrl construction app.ts builds, are
    //      byte-identical to what the draft store itself has stored — i.e.
    //      the stage would show the AUTHOR'S bytes, not a placeholder.
    results.authoredMediaReachesStage = await page.evaluate(async () => {
      const { createDraftStore } = await import('/src/editor/draft-store.ts');
      const { buildPackFromDraft } = await import('/src/pack/from-draft.ts');
      const store = createDraftStore();
      await store.load();
      const { manifest, media } = await buildPackFromDraft(store, 'لعبة نوف');

      const imgQ = manifest.questions.find((q) => q.text === 'سؤال المؤلف — صورة حقيقية');
      const audQ = manifest.questions.find((q) => q.text === 'سؤال المؤلف — صوت حقيقي');
      if (!imgQ || !audQ) return { found: false, imgQ: !!imgQ, audQ: !!audQ };

      // Build the object-URL map exactly like `app.ts`'s own `refreshDeck`.
      const urlBySha = new Map();
      for (const [sha256, blob] of media) urlBySha.set(sha256, URL.createObjectURL(blob));
      function resolveMediaUrl(q) {
        if (q.media.kind === 'none') return null;
        return urlBySha.get(q.media.sha256) ?? null;
      }

      async function bytesOf(url) {
        const res = await fetch(url);
        return new Uint8Array(await res.arrayBuffer());
      }

      const imgUrl = resolveMediaUrl(imgQ);
      const audUrl = resolveMediaUrl(audQ);
      const imgBytesFromResolver = imgUrl ? await bytesOf(imgUrl) : null;
      const audBytesFromResolver = audUrl ? await bytesOf(audUrl) : null;

      const imgBlobFromStore = await store.getMediaBlob(imgQ.media.sha256);
      const audBlobFromStore = await store.getMediaBlob(audQ.media.sha256);
      const imgBytesFromStore = imgBlobFromStore ? new Uint8Array(await imgBlobFromStore.arrayBuffer()) : null;
      const audBytesFromStore = audBlobFromStore ? new Uint8Array(await audBlobFromStore.arrayBuffer()) : null;

      function bytesEqual(a, b) {
        if (!a || !b || a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
        return true;
      }

      return {
        found: true,
        imgUrlIsRealBlob: !!imgUrl && imgUrl.startsWith('blob:'),
        audUrlIsRealBlob: !!audUrl && audUrl.startsWith('blob:'),
        imgBytesLength: imgBytesFromResolver ? imgBytesFromResolver.length : 0,
        audBytesLength: audBytesFromResolver ? audBytesFromResolver.length : 0,
        // The real invariant this seam guarantees: what the stage's
        // resolveMediaUrl hands to <img>/<audio> is BYTE-IDENTICAL to what
        // the author's own draft has stored for that exact question — not a
        // demo/placeholder substitute.
        imageMatchesDraftStore: bytesEqual(imgBytesFromResolver, imgBytesFromStore),
        audioMatchesDraftStore: bytesEqual(audBytesFromResolver, audBytesFromStore),
        imgPngSignatureOk: imgBytesFromResolver ? imgBytesFromResolver[0] === 0x89 && imgBytesFromResolver[1] === 0x50 : false,
        audRiffSignatureOk:
          audBytesFromResolver
            ? String.fromCharCode(audBytesFromResolver[0], audBytesFromResolver[1], audBytesFromResolver[2], audBytesFromResolver[3]) === 'RIFF'
            : false,
      };
    });
    await page.close();
  }

  // ===================================================================
  // 5. F-1 dead-button fix — the backup badge's «احفظ نسخة» button
  //    (mountEditor's onRequestBackup) now really writes a file.
  //
  //    `showSaveFilePicker` exists as a function in headless Chromium
  //    (confirmed: `typeof window.showSaveFilePicker === 'function'`) but
  //    never resolves/rejects with no real user-facing dialog surface to
  //    drive — a pure headless-testing environment gap, not a product
  //    defect (a real desktop Chrome/Edge with a human clicking it behaves
  //    correctly; `tests/pack/live/**`, WL-D's, already exercises that
  //    picker path). Overridden away here so this script exercises the
  //    UNIVERSAL `<a download>` fallback `save-to-device.ts` itself falls
  //    back to on every other browser — real code, real path, just not the
  //    picker branch.
  // ===================================================================
  {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, acceptDownloads: true });
    await page.addInitScript(() => {
      Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true });
    });
    await page.goto(URL);
    await page.click('button:has-text("أسئلتي")');
    await page.click('#editor-add-question');
    await page.fill('.question-text-input', 'سؤال للنسخة الاحتياطية');
    const opts = await page.$$('.option-text-input');
    await opts[0].fill('أ'); await opts[1].fill('ب'); await opts[2].fill('ج'); await opts[3].fill('د');
    await page.check('.option-row[data-option-index="0"] .option-correct-radio');
    await page.click('.question-submit');
    await sleep(100);

    const downloadPromise = page.waitForEvent('download', { timeout: 5000 }).catch((e) => ({ error: String(e) }));
    await page.click('.session-end-reminder-save-button');
    const download = await downloadPromise;
    results.backupButtonWired = {
      gotDownloadEvent: download && !download.error,
      suggestedFilename: download && !download.error ? download.suggestedFilename() : null,
      error: download && download.error ? download.error : null,
    };
    await page.close();
  }

  // ===================================================================
  // 6. F-1 core (bulk) + full live playthrough with the authored deck,
  //    proving question text on screen is the AUTHOR'S text, never a
  //    legacy demo-deck string — and F-4: undo on the ending screen does
  //    not silently self-revert.
  // ===================================================================
  {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    await page.goto(URL);
    await page.evaluate(async () => {
      const { createDraftStore } = await import('/src/editor/draft-store.ts');
      const store = createDraftStore();
      await store.load();
      // Green at N=6 (greenThreshold = 3.34*6+4 = 24.04 -> 25 is green).
      // `correctIndex: 0` always — the on-screen SLOT showing original
      // option 0 is the correct one after shuffling, discovered live below
      // by trying untried slots and undoing on a wrong reveal (the
      // shuffle is session-seeded and not predictable from here).
      for (let i = 0; i < 25; i++) {
        await store.addQuestion({
          text: `سؤال المؤلف الحي رقم ${i + 1}`,
          options: ['خيار أ', 'خيار ب', 'خيار ج', 'خيار د'],
          correctIndex: 0,
        });
      }
    });
    await page.reload();
    await sleep(150);

    await page.click('button:has-text("ابدأ اللعبة")');
    await page.click('button:has-text("قصيرة — 6")');
    await page.click('button:has-text("ابدأ"):not(:has-text("اللعبة"))');

    const playTrace = await page.evaluate(async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const seenQuestionTexts = new Set();
      let steps = 0;
      // B7 maze redesign (worklog-B7.md): each correct-answer beat now
      // spends real wall-clock time in the arm delay (~400ms) and the
      // auto-advance timer (~1200ms) with NOTHING to click during either
      // window (this loop just polls every 60ms and waits) — a slower,
      // deliberately paced cadence than the old immediate-manual-tap flow.
      // 600 was tuned for the old cadence; real measurement this session
      // (see worklog-B7.md §4) showed 20 distinct questions reached but
      // NOT an ending within 600 steps, whereas 2400 comfortably finishes
      // a قصيرة (N=6) game.
      const maxSteps = 2400;
      // `data-option-index` values already tried AND FOUND WRONG for the
      // CURRENT question — reset whenever the question text changes.
      // Necessary because `optionOrder` is fixed for a question's whole
      // life on screen (including across undo — D-09.3), so re-querying
      // `.option-card` after a wrong answer + undo returns the SAME slot
      // first unless already-tried slots are skipped explicitly.
      let currentQuestionKey = null;
      let triedSlots = new Set();
      while (steps < maxSteps) {
        steps++;
        await sleep(60);
        if (document.querySelector('.ending-screen')) break;
        const handoff = document.querySelector('.turn-handoff-overlay');
        if (handoff) { handoff.click(); continue; }
        const qText = document.querySelector('.question-text, .audio-question-text, .image-beat2-question-text, .image-question-overlay .type-question');
        if (qText && qText.textContent) {
          seenQuestionTexts.add(qText.textContent);
          if (qText.textContent !== currentQuestionKey) {
            currentQuestionKey = qText.textContent;
            triedSlots = new Set();
          }
        }
        const showOptionsBtn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.trim() === 'اعرض الخيارات' && !b.disabled);
        if (showOptionsBtn) { showOptionsBtn.click(); continue; }
        const banner = document.querySelector('.result-banner');
        if (banner && banner.classList.contains('is-correct')) {
          // B7 maze redesign (worklog-B7.md): the plain "السؤال التالي"
          // button on a CORRECT answer is now the route-card row (2-3
          // cards, one per open exit) — click whichever is enabled (arm
          // delay has a fixed 400ms window; `sleep(60)` above means this
          // branch is revisited repeatedly until one arms).
          const routeCard = document.querySelector('.route-card:not([disabled])');
          if (routeCard) { routeCard.click(); continue; }
        }
        if (banner && banner.classList.contains('is-wrong')) {
          // Wrong: undo (pops ANSWER_CHOSEN back to QUESTION_SHOWN, same
          // fixed optionOrder) and retry with an UNTRIED slot next pass —
          // BEFORE the wrong-answer route-card ("السؤال التالي") would
          // otherwise be clicked, preserving this script's own
          // always-find-the-correct-slot strategy.
          const undoBtn = document.querySelector('.undo-corner button:not([disabled])');
          if (undoBtn) { undoBtn.click(); continue; }
        }
        const cards = Array.from(document.querySelectorAll('.option-card:not([disabled])'));
        if (cards.length > 0 && !banner) {
          const untried = cards.find((c) => !triedSlots.has(c.dataset.optionIndex));
          if (untried) {
            triedSlots.add(untried.dataset.optionIndex);
            untried.click();
            continue;
          }
        }
        const audienceBtn = document.querySelector('.audience-decision-buttons .op-button.primary');
        if (audienceBtn) { audienceBtn.click(); continue; }
        const mazeContinue = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.trim() === 'السؤال التالي');
        if (mazeContinue && document.querySelector('.maze-wrap')) { mazeContinue.click(); continue; }
        // otherwise: likely a decisive-auto maze beat with no button — just wait.
      }
      return { steps, reachedEnding: !!document.querySelector('.ending-screen'), seenQuestionTexts: Array.from(seenQuestionTexts) };
    });
    results.livePlaythrough = playTrace;
    await page.screenshot({ path: path.join(OUT_DIR, 'b5-live-ending-screen.png') });

    // ---- F-4: tap تراجُع on the ending screen, confirm it does NOT
    //      silently self-revert within 3s, and a manual confirm control is
    //      offered instead of the old auto-timer.
    //
    //      Which of the FOUR ways a game can reach FINISHED (track win,
    //      failed-balancing win, resolved tiebreak, exhaustion-with-
    //      progress win — all `isDecisiveEnding`; OR the fifth,
    //      exhaustion-while-level, `isAudienceDecision`, three buttons, no
    //      timer at all) depends on this run's random seed and is not
    //      controlled from here. F-4's fix only applies to the decisive
    //      case (the only one that ever had a timer to mis-fire). When a
    //      run happens to land on the audience-decision ending instead,
    //      this is recorded explicitly as not-applicable-this-run rather
    //      than silently passing OR failing on the wrong claim — the fix
    //      itself is ALSO proven separately, deterministically, via a real
    //      red->green reproduction pasted in worklog-B5.md §F4.
    if (playTrace.reachedEnding) {
      await page.click('.undo-corner button');
      await sleep(100);
      const isAudienceEnding = await page.evaluate(() => !!document.querySelector('.audience-decision-buttons'));
      if (isAudienceEnding) {
        // Re-finish the game so the page is left in a sane state, and
        // record this run as not applicable to the decisive-timer check.
        await page.click('.audience-decision-buttons .op-button.primary');
        results.f4UndoNoSelfRevert = {
          notApplicableThisRun: true,
          reason: 'this playthrough happened to end via the audience-decision (exhaustion-while-level) path, which never had a timer — F-4 targets the decisive-auto/decisive-manual path specifically, proven separately in worklog-B5.md §F4 via a deterministic red->green reproduction',
        };
        results.f4ManualConfirmWorks = { notApplicableThisRun: true };
        await page.close();
        return;
      }
      const trace = [];
      for (let t = 0; t <= 3000; t += 400) {
        trace.push({
          tMs: t,
          onEndingScreen: await page.evaluate(() => !!document.querySelector('.ending-screen')),
          hasManualConfirm: await page.evaluate(() => Array.from(document.querySelectorAll('button')).some((b) => b.textContent.trim() === 'متابعة')),
        });
        await sleep(400);
      }
      const everSelfReverted = trace.slice(1).some((s) => s.onEndingScreen); // index 0 is immediately after the tap
      results.f4UndoNoSelfRevert = { trace, everSelfReverted };

      // Round-trip: the manual button DOES re-commit when explicitly tapped.
      try {
        await page.click('button:has-text("متابعة")', { timeout: 5000 });
        await sleep(200);
        results.f4ManualConfirmWorks = await page.evaluate(() => !!document.querySelector('.ending-screen'));
      } catch (e) {
        results.f4ManualConfirmWorks = { error: String(e) };
      }
    }
    await page.close();
  }

  // ===================================================================
  // 7. F-1 — import a pack (WL-D's REAL `exportPack`/`importPack`/
  //    `applyImportedPackToDraft`) -> the imported questions become the
  //    deck that plays. Simulates a second device: one store authors and
  //    exports; `discardDraft()` clears the "device" back to empty before
  //    the import, so what plays afterward can only have come from the
  //    imported pack, never leftover authoring state.
  // ===================================================================
  {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    await page.goto(URL);
    results.importThenPlay = await page.evaluate(async () => {
      const { createDraftStore } = await import('/src/editor/draft-store.ts');
      const { buildPackFromDraft } = await import('/src/pack/from-draft.ts');
      const { exportPack } = await import('/src/pack/export.ts');
      const { importPack } = await import('/src/pack/import.ts');
      const { applyImportedPackToDraft } = await import('/src/pack/apply-import.ts');

      const authorStore = createDraftStore();
      await authorStore.load();
      const TITLE = 'أسئلة الاستيراد التجريبية';
      for (let i = 0; i < 20; i++) {
        await authorStore.addQuestion({
          text: `سؤال مستورد رقم ${i + 1}`,
          options: ['خيار أ', 'خيار ب', 'خيار ج', 'خيار د'],
          correctIndex: 1,
        });
      }
      const { manifest, media } = await buildPackFromDraft(authorStore, TITLE);
      const zipBlob = await exportPack(manifest, media);

      // Simulate a second device: wipe this "device"'s draft entirely.
      await authorStore.discardDraft();
      const wipedCount = authorStore.getState().questions.length;

      const imported = await importPack(zipBlob);
      const summary = await applyImportedPackToDraft(authorStore, imported);

      // Now read back through the SAME real path `app.ts` uses.
      const { manifest: replayedManifest } = await buildPackFromDraft(authorStore, TITLE);

      return {
        wipedCountWasZero: wipedCount === 0,
        importedQuestionCount: summary.questionCount,
        deckAfterImportCount: replayedManifest.questions.length,
        firstQuestionText: replayedManifest.questions[0]?.text ?? null,
        allTextsAreImportedOnes: replayedManifest.questions.every((q) => q.text.startsWith('سؤال مستورد رقم')),
      };
    });
    // Reload so `mountApp`'s own deck loader (not this script's direct
    // calls) is the one asserted against too — the real integration point.
    await page.reload();
    await sleep(150);
    results.importThenPlayHomeCount = await page.evaluate(() => document.querySelector('.home-guidance-line')?.textContent ?? null);
    await page.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
