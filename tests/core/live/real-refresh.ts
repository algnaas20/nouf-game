/**
 * Live-browser evidence for PH-A4 — the criteria whose literal wording
 * ("a real interruption, not a simulated one") only a real browser and a
 * real page reload can honestly satisfy. Everything else in this phase is
 * proven by tests/core/session-store.test.ts and
 * tests/core/session-fuzz.test.ts (fast, deterministic, fake storage).
 *
 * Run manually: `npx tsx tests/core/live/real-refresh.ts`
 * (not wired into package.json's `test` script — package.json is WL-D-owned
 * and out of scope for this line to edit; same convention as
 * tests/editor/live/persistence-and-quota.ts.)
 *
 * Uses the vite dev server's JS API directly on port 3010 (WL-A's assigned
 * port — executor-prompts-2026-08-07.md port table), and a brand-new,
 * ephemeral Playwright browser context (no persistent profile dir), so a
 * fresh localStorage is guaranteed at the start of every run.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';

const PORT = 3010; // WL-A core — executor-prompts-2026-08-07.md port table.
const ROOT = fileURLToPath(new URL('../../../', import.meta.url));

interface FoldedStateShape {
  stateId: string;
  positions: [number, number];
  attempts: [number, number];
  currentTeam: string;
  usedQuestionIds: string[];
  rng: { seed: number; drawIndex: number };
  optionOrder: [number, number, number, number] | null;
  currentQuestionId: string | null;
}

interface ResumeAvailable {
  kind: 'available';
  events: unknown[];
  state: FoldedStateShape;
}
interface ResumeRefused {
  kind: 'refused';
  reason: string;
  storedDeckHash?: string;
  currentDeckHash?: string;
}

async function main(): Promise<void> {
  let server: ViteDevServer | null = null;
  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;
  let failures = 0;

  try {
    server = await createServer({
      root: ROOT,
      server: { port: PORT, strictPort: true, host: '127.0.0.1' },
      logLevel: 'warn',
    });
    await server.listen();
    const url = `http://127.0.0.1:${PORT}/tests/core/fixtures/session-harness.html`;

    browser = await chromium.launch();
    const context = await browser.newContext({ viewport: { width: 1024, height: 768 } });
    const page = await context.newPage();
    page.on('pageerror', (err) => console.error('PAGEERROR:', err));
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.error('CONSOLE ERROR:', msg.text());
    });

    // ---- First load: play a partial game, save via the REAL localStorage ----
    await page.goto(url);
    await page.waitForFunction(() => document.getElementById('ready')?.textContent === 'ready');

    const preState = await page.evaluate(() => (window as unknown as { __preInterruptionState: FoldedStateShape }).__preInterruptionState);
    const preEvents = await page.evaluate(() => (window as unknown as { __preInterruptionEvents: unknown[] }).__preInterruptionEvents);
    const syncProbe = await page.evaluate(
      () => (window as unknown as { __syncWriteProbe: { rawImmediatelyAfterSave: string | null } }).__syncWriteProbe,
    );

    console.log('Pre-interruption state.stateId:', preState.stateId);
    console.log('Pre-interruption positions:', preState.positions, 'attempts:', preState.attempts);
    console.log('Pre-interruption currentTeam:', preState.currentTeam);
    console.log('Pre-interruption usedQuestionIds:', preState.usedQuestionIds);
    console.log('Pre-interruption rng.drawIndex:', preState.rng.drawIndex);
    console.log('Pre-interruption optionOrder:', preState.optionOrder);
    console.log('Pre-interruption currentQuestionId:', preState.currentQuestionId);

    // Criterion 1: synchronous write — the raw localStorage entry already
    // existed immediately after saveSession() returned, inside the SAME
    // page-load script execution, no await between save and this probe.
    if (!syncProbe || syncProbe.rawImmediatelyAfterSave === null) {
      failures += 1;
      console.error('SYNC-WRITE PROOF FAILED — localStorage was empty immediately after saveSession()');
    } else {
      const parsed = JSON.parse(syncProbe.rawImmediatelyAfterSave) as { events: unknown[] };
      const matches = JSON.stringify(parsed.events) === JSON.stringify(preEvents);
      console.log('SYNC-WRITE PROOF — raw localStorage matched saved events immediately:', matches);
      if (!matches) failures += 1;
    }

    if (preState.stateId !== 'QUESTION_SHOWN' || preState.optionOrder === null) {
      failures += 1;
      console.error('SETUP FAILED — expected to be interrupted mid-question with a shuffled optionOrder');
    }

    // ---- A REAL browser reload — the actual interruption ----
    await page.reload();
    await page.waitForFunction(() => document.getElementById('ready')?.textContent === 'ready');

    const resumeResult = await page.evaluate(
      () => (window as unknown as { __resumeResult: ResumeAvailable }).__resumeResult,
    );

    if (!resumeResult || resumeResult.kind !== 'available') {
      failures += 1;
      console.error('RESUME FAILED — expected kind:"available" after a real reload, got:', resumeResult);
    } else {
      const postState = resumeResult.state;
      console.log('Post-reload state.stateId:', postState.stateId);
      console.log('Post-reload positions:', postState.positions, 'attempts:', postState.attempts);
      console.log('Post-reload currentTeam:', postState.currentTeam);
      console.log('Post-reload usedQuestionIds:', postState.usedQuestionIds);
      console.log('Post-reload rng.drawIndex:', postState.rng.drawIndex);
      console.log('Post-reload optionOrder:', postState.optionOrder);

      const fieldsMatch =
        JSON.stringify(postState.positions) === JSON.stringify(preState.positions) &&
        JSON.stringify(postState.attempts) === JSON.stringify(preState.attempts) &&
        postState.currentTeam === preState.currentTeam &&
        JSON.stringify(postState.usedQuestionIds) === JSON.stringify(preState.usedQuestionIds) &&
        postState.rng.drawIndex === preState.rng.drawIndex &&
        JSON.stringify(postState.optionOrder) === JSON.stringify(preState.optionOrder) &&
        postState.currentQuestionId === preState.currentQuestionId;

      console.log(
        'RESUME AFTER A REAL RELOAD — positions/attempts/turn/usedQuestionIds/rng.drawIndex/optionOrder all match:',
        fieldsMatch,
      );
      if (!fieldsMatch) failures += 1;

      const eventsMatch = JSON.stringify(resumeResult.events) === JSON.stringify(preEvents);
      console.log('RESUME AFTER A REAL RELOAD — full event log byte-identical:', eventsMatch);
      if (!eventsMatch) failures += 1;
    }

    // ---- Criterion 3: deckHash mismatch refuses, does not partial-load ----
    const wrongDeckResult = await page.evaluate(
      () => (window as unknown as { __checkResumeWithWrongDeck: () => ResumeRefused }).__checkResumeWithWrongDeck(),
    );
    console.log('Wrong-deck checkResume() result:', wrongDeckResult);
    const refusalCorrect =
      wrongDeckResult.kind === 'refused' &&
      wrongDeckResult.reason === 'deck-mismatch' &&
      typeof wrongDeckResult.storedDeckHash === 'string' &&
      typeof wrongDeckResult.currentDeckHash === 'string' &&
      wrongDeckResult.storedDeckHash !== wrongDeckResult.currentDeckHash;
    console.log('DECKHASH MISMATCH REFUSAL — legible, no partial load:', refusalCorrect);
    if (!refusalCorrect) failures += 1;

    // Screenshot for the record — a blank harness page, not the real
    // resume-prompt UI (that screen is WL-B's src/stage/**, out of this
    // line's ownership; documented, not built here).
    const screenshotPath = path.join(ROOT, 'tests/core/live/real-refresh-harness.png');
    await page.screenshot({ path: screenshotPath });
    console.log('Harness screenshot saved:', screenshotPath);

    console.log(failures === 0 ? 'ALL LIVE SCENARIOS PASSED' : `${failures} LIVE SCENARIO(S) FAILED`);
    process.exitCode = failures === 0 ? 0 : 1;
  } finally {
    if (browser) await browser.close();
    if (server) await server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
