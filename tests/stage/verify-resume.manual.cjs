/**
 * PH-A4/WL-B — live proof of the resume prompt + deck-mismatch refusal
 * screens, and that `saveSession` is actually wired into
 * `src/stage/session/game-driver.ts` as the game is played (not just unit-
 * tested against `session-store.ts` in isolation, which is WL-A's own
 * proof in `worklog-A4.md` — this is the ROOM'S view of the same feature).
 *
 * Three real Chromium scenarios, real localStorage, real `page.reload()`:
 *   1. Play a partial game -> reload -> «تكملة الجلسة» shown with the real
 *      team/score context -> click it -> the SAME on-screen question and
 *      score are restored (checked at the DOM level — what the room sees).
 *   2. A stored session with a deliberately mismatched deckHash (the
 *      author edited his questions) -> reload -> the legible deck-mismatch
 *      refusal screen, not a crash, not a silent new game.
 *   3. A corrupt (unparseable) stored payload -> reload -> silently lands
 *      on the home screen, storage cleared, no dead-end screen shown.
 *
 *   npx vite --port 3011 --strictPort   (separate terminal / background)
 *   node tests/stage/verify-resume.manual.cjs
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const URL = process.env.STAGE_URL || 'http://localhost:3011/';
const OUT_DIR = path.join(__dirname, '..', '..', 'verify-out');
fs.mkdirSync(OUT_DIR, { recursive: true });

/**
 * D-25 / F-1 (worklog-B5.md, 2026-08-08): no bundled demo deck any more —
 * seeds a real authored deck through the real `DraftStore` first, then
 * reloads so `mountApp`'s own deck loader picks it up, before driving home
 * -> team-setup -> confirm (team-setup's "ابدأ" is disabled on an empty
 * deck — the readiness gate, task 3).
 */
async function playToAQuestion(page) {
  await page.goto(URL);
  await page.evaluate(async () => {
    const { createDraftStore } = await import('/src/editor/draft-store.ts');
    const store = createDraftStore();
    await store.load();
    for (let i = 0; i < 25; i++) {
      await store.addQuestion({ text: `سؤال الاستئناف رقم ${i + 1}`, options: ['أ', 'ب', 'ج', 'د'], correctIndex: 0 });
    }
  });
  await page.reload();
  await page.evaluate(() => document.fonts.ready);
  await page.click('button:has-text("ابدأ اللعبة")');
  await page.click('button:has-text("ابدأ"):not(:has-text("اللعبة"))');
  await page.waitForTimeout(1700 + 1700); // draw + handoff, both auto
}

/**
 * Answers whatever question is currently on screen and advances all the
 * way to the NEXT real question-shown screen (or a resting point if the
 * game ended). `«السؤال التالي»` is used as the continue label on BOTH the
 * question-reveal operator bar (ANSWER_REVEALED -> PROGRESSION_APPLIED) AND
 * the maze-beat's own "continue" mode (PROGRESSION_APPLIED -> TURN_START) —
 * two real, separate taps sharing one label, not a single tap. This loop
 * clicks whatever the SAME literal advance affordance the room would press
 * is at each step, up to a small bounded number of iterations, rather than
 * hard-coding an exact click count that would be fragile against demo-deck
 * shuffling (text/image/audio questions take different numbers of steps to
 * reveal their options).
 */
async function answerOnce(page) {
  for (let i = 0; i < 8; i++) {
    const hasOverlay = await page.evaluate(() => !!document.querySelector('.turn-handoff-overlay'));
    if (hasOverlay) {
      await page.click('.turn-handoff-overlay');
      await page.waitForTimeout(200);
      return; // handed off to the next team's question — this call is done.
    }
    // «السؤال التالي» takes priority once a reveal has happened — a real
    // harness bug, found and fixed live: audio's option cards keep their
    // `disabled` DOM attribute `false` even after `p.revealed` becomes
    // true (`question-audio.ts`'s `disabled: !optionsRevealed`, which never
    // flips back once options were shown), so checking `.option-card:not
    // ([disabled])` BEFORE checking for a post-reveal result banner kept
    // re-clicking an already-answered card forever (each click a no-op,
    // since the real component's own `onChoose` short-circuits on
    // `p.revealed` — never a product bug, purely this harness picking the
    // wrong element first) instead of ever advancing past ANSWER_REVEALED.
    const alreadyRevealed = await page.evaluate(() => !!document.querySelector('.result-banner'));
    if (!alreadyRevealed) {
      const enabledOption = page.locator('.option-card:not([disabled])');
      if (await enabledOption.count() > 0) {
        await enabledOption.first().click();
        await page.waitForTimeout(200);
        continue;
      }
      const showOptionsBtn = page.locator('button:has-text("اعرض الخيارات"):not([disabled])');
      if (await showOptionsBtn.count() > 0) {
        await showOptionsBtn.first().click();
        await page.waitForTimeout(200);
        continue;
      }
    }
    const nextBtn = page.locator('button:has-text("السؤال التالي")');
    if (await nextBtn.count() > 0) {
      await nextBtn.first().click();
      await page.waitForTimeout(200);
      // If a new question is now showing (no handoff, no maze-beat), stop.
      const stillMazeBeat = await page.evaluate(() => !!document.querySelector('.maze-beat-safe'));
      const nowQuestion = await page.evaluate(() => !!document.querySelector('.question-text, .audio-question-text, .image-beat2, .image-beat1-area'));
      if (!stillMazeBeat && nowQuestion) return;
      continue;
    }
    await page.waitForTimeout(200);
  }
}

async function readVisibleState(page) {
  return page.evaluate(() => {
    const scores = Array.from(document.querySelectorAll('.type-score')).map((el) => el.textContent);
    const questionText = document.querySelector('.type-question, .audio-question-text, .image-beat2-question-text')?.textContent ?? null;
    const turnHeader = document.querySelector('.turn-header')?.textContent ?? null;
    return { scores, questionText, turnHeader };
  });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const results = {};

  // ---------- Scenario 1: real interruption -> resume prompt -> continue ----------
  {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e)));

    await page.evaluate(() => localStorage.clear()).catch(() => {}); // page not loaded yet; ignore
    await playToAQuestion(page);
    // Play two full question cycles so a turn pass / real progress exists.
    await answerOnce(page);
    await answerOnce(page);

    const preReload = await readVisibleState(page);
    const rawBeforeReload = await page.evaluate(() => localStorage.getItem('nouf-game:session:v1'));

    await page.reload();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);

    const resumeScreen = await page.evaluate(() => ({
      heading: document.querySelector('.resume-prompt-screen h1')?.textContent ?? null,
      hasStatusStrip: !!document.querySelector('.resume-prompt-screen .status-strip'),
      scores: Array.from(document.querySelectorAll('.resume-prompt-screen .type-score')).map((el) => el.textContent),
      buttons: Array.from(document.querySelectorAll('.resume-prompt-buttons button')).map((b) => b.textContent),
    }));
    await page.screenshot({ path: path.join(OUT_DIR, 'resume-prompt-screen.png') });

    // `button:has-text(...)` — a bare `text=` selector is a SUBSTRING match
    // across the whole page and is genuinely ambiguous on this exact screen
    // (a harness bug found and fixed live, see the worklog): the deck-
    // mismatch screen's explanation paragraph literally contains the
    // phrase "جلسة جديدة" inside a longer sentence, so `text=جلسة جديدة`
    // matches BOTH that `<p>` and the real `<button>`; Playwright silently
    // clicked the non-interactive `<p>` first and nothing happened.
    // `button:has-text(...)` scopes the match to `<button>` elements only.
    await page.click('button:has-text("تكملة الجلسة")');
    await page.waitForTimeout(200);
    const postResume = await readVisibleState(page);
    await page.screenshot({ path: path.join(OUT_DIR, 'resumed-question-screen.png') });

    results.scenario1_resumeAndContinue = {
      rawSessionExistedBeforeReload: rawBeforeReload !== null,
      preReload,
      resumeScreen,
      postResume,
      questionTextMatches: preReload.questionText === postResume.questionText,
      scoresMatch: JSON.stringify(preReload.scores) === JSON.stringify(postResume.scores),
      turnHeaderMatches: preReload.turnHeader === postResume.turnHeader,
      pageErrors,
    };
    await page.close();
  }

  // ---------- Scenario 1b: real interruption -> resume prompt -> «جلسة جديدة» ----------
  {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    await playToAQuestion(page);
    await answerOnce(page);
    await page.reload();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    const sawResumePrompt = await page.evaluate(() => !!document.querySelector('.resume-prompt-screen'));
    await page.click('button:has-text("جلسة جديدة")');
    await page.waitForTimeout(200);
    const afterDecline = await page.evaluate(() => ({
      onHome: Array.from(document.querySelectorAll('.op-button')).map((b) => b.textContent),
      sessionCleared: localStorage.getItem('nouf-game:session:v1') === null,
    }));
    results.scenario1b_declineAndStartFresh = { sawResumePrompt, afterDecline };
    await page.close();
  }

  // ---------- Scenario 2: deck-mismatch refusal ----------
  {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    await playToAQuestion(page);
    await answerOnce(page);
    // Corrupt only the stored deckHash — a legitimate simulation of "the
    // author republished a different question deck between sittings", not
    // an arbitrary/unrealistic payload mutation.
    await page.evaluate(() => {
      const raw = localStorage.getItem('nouf-game:session:v1');
      const parsed = JSON.parse(raw);
      parsed.events[0].deckHash = 'a-completely-different-deck-hash';
      localStorage.setItem('nouf-game:session:v1', JSON.stringify(parsed));
    });
    await page.reload();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    const mismatchScreen = await page.evaluate(() => ({
      heading: document.querySelector('.resume-prompt-screen h1')?.textContent ?? null,
      explanation: document.querySelector('.resume-track-line')?.textContent ?? null,
      buttons: Array.from(document.querySelectorAll('.resume-prompt-screen button')).map((b) => b.textContent),
      // Never legible on-stage — confirm the raw hash strings do NOT appear
      // anywhere in the visible screen text (constraint row 17).
      bodyTextIncludesRawHash: document.body.textContent.includes('a-completely-different-deck-hash'),
    }));
    await page.screenshot({ path: path.join(OUT_DIR, 'deck-mismatch-screen.png') });

    await page.click('button:has-text("جلسة جديدة")');
    await page.waitForTimeout(200);
    const afterClick = await page.evaluate(() => ({
      onHome: Array.from(document.querySelectorAll('.op-button')).map((b) => b.textContent),
      sessionCleared: localStorage.getItem('nouf-game:session:v1') === null,
    }));
    results.scenario2_deckMismatch = { mismatchScreen, afterClick };
    await page.close();
  }

  // ---------- Scenario 3: structurally-valid-but-illegal payload
  // ('refused', reason: 'corrupt' — first event isn't GAME_STARTED) ->
  // silently cleared and landed on home, no dead-end screen. ----------
  {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    await page.goto(URL);
    await page.evaluate(() => {
      // Valid JSON, valid `{events: [...]}` shape, but the first event is
      // NOT `GAME_STARTED` — `checkResume()`'s own literal `'corrupt'`
      // path (`src/core/session-store.ts`), distinct from syntactically
      // invalid JSON (see scenario 3b below, a DIFFERENT code path).
      localStorage.setItem('nouf-game:session:v1', JSON.stringify({ events: [{ type: 'NO_ANSWER', seq: 0, at: 0 }] }));
    });
    await page.reload();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    const landed = await page.evaluate(() => ({
      onHome: Array.from(document.querySelectorAll('.op-button')).map((b) => b.textContent),
      resumePromptShown: !!document.querySelector('.resume-prompt-screen'),
      sessionCleared: localStorage.getItem('nouf-game:session:v1') === null,
    }));
    results.scenario3_structurallyCorruptPayload = landed;
    await page.close();
  }

  // ---------- Scenario 3b: syntactically INVALID JSON -> a DIFFERENT code
  // path (`loadRawSession`'s own try/catch already reports this as
  // `{ kind: 'none' }`, never reaching `checkResume`'s 'corrupt' branch at
  // all) — silently lands on home; the garbage bytes are harmlessly left in
  // `localStorage` (never re-surfaced, `loadRawSession` will keep reading
  // it as absent on every future load too). Documented as the correct,
  // intentional contract — not a defect and not something this stage-side
  // code needs to explicitly clear. ----------
  {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    await page.goto(URL);
    await page.evaluate(() => {
      localStorage.setItem('nouf-game:session:v1', '{not valid json!!');
    });
    await page.reload();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    const landed = await page.evaluate(() => ({
      onHome: Array.from(document.querySelectorAll('.op-button')).map((b) => b.textContent),
      resumePromptShown: !!document.querySelector('.resume-prompt-screen'),
      rawStillPresentButHarmless: localStorage.getItem('nouf-game:session:v1') === '{not valid json!!',
    }));
    results.scenario3b_syntacticallyInvalidJson = landed;
    await page.close();
  }

  await browser.close();
  fs.writeFileSync(path.join(OUT_DIR, 'results-resume.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
