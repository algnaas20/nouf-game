/**
 * The sub-path rehearsal (static-delivery-investigation.md §8, steps 1-6+9).
 * Builds clean, stages the output at verify/nouf-game/ (an honest rehearsal
 * of <owner>.github.io/<repo>/), serves verify/ as the server root with a
 * plain static file server, and drives it with real Chromium via Playwright.
 * Prints the one accepted evidence line, with real numbers.
 *
 * Explicitly NOT evidence (static-delivery-investigation.md §8): file://,
 * the dev server, serving at the root path, "the screenshot looks fine".
 * This script serves from a genuine sub-path with a genuine static server
 * and a genuine browser.
 */
import { spawnSync } from 'node:child_process';
import { rmSync, mkdirSync, cpSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
import { chromium } from 'playwright';
import { startStaticServer, stopServer } from './static-server.ts';
import { runAllGates } from './gates/index.ts';
import { walkDist } from './gates/walk.ts';

const ROOT = resolve(import.meta.dirname, '..');
const DIST = join(ROOT, 'dist');
const VERIFY = join(ROOT, 'verify');
const SUBDIR_NAME = 'nouf-game';
const PORT = 3012; // this agent's assigned port (see worklog port note)

function buildFingerprint(distDir: string): string {
  const entries = walkDist(distDir)
    .filter((e) => !e.isDirectory)
    .sort((a, b) => a.relPath.localeCompare(b.relPath));
  const hash = createHash('sha256');
  for (const e of entries) {
    hash.update(e.relPath);
    hash.update(String(e.size));
  }
  return hash.digest('hex').slice(0, 12);
}

async function main(): Promise<void> {
  console.log('[rehearsal] step 1: clean production build');
  rmSync(DIST, { recursive: true, force: true });
  // Single command string + shell:true — see scripts/gates/prove-red-green.ts
  // for why (spawnSync('npm.cmd', [...]) is EINVAL on Windows without a shell).
  const build = spawnSync('npm run build', { cwd: ROOT, shell: true, stdio: 'inherit' });
  if (build.status !== 0) {
    throw new Error(`build failed with exit code ${build.status}`);
  }

  console.log(`\n[rehearsal] step 2: stage verify/${SUBDIR_NAME}/`);
  rmSync(VERIFY, { recursive: true, force: true });
  mkdirSync(join(VERIFY, SUBDIR_NAME), { recursive: true });
  cpSync(DIST, join(VERIFY, SUBDIR_NAME), { recursive: true });

  const nojekyllPath = join(VERIFY, SUBDIR_NAME, '.nojekyll');
  const nojekyllPresent = existsSync(nojekyllPath);
  console.log(`[rehearsal] step 3: .nojekyll present in staged copy = ${nojekyllPresent}`);
  if (!nojekyllPresent) throw new Error('.nojekyll missing from staged copy');

  console.log('[rehearsal] step 4: re-running gates against the staged copy (not just dist/)');
  const gateResult = runAllGates(join(VERIFY, SUBDIR_NAME));
  console.log(gateResult.text);
  if (gateResult.totalViolations > 0) {
    throw new Error(`gates failed on staged copy: ${gateResult.totalViolations} violation(s)`);
  }

  const budgetOutcome = gateResult.outcomes.find((o) => o.gate === '4d-budget');
  if (!budgetOutcome?.numbers) throw new Error('budget gate produced no numbers');
  const fileCount = budgetOutcome.numbers.fileCount as number;
  const largestFileBytes = budgetOutcome.numbers.largestFileBytes as number;

  console.log(`\n[rehearsal] step 5: serving verify/ (plain static server, no SPA fallback) on port ${PORT}`);
  const server = await startStaticServer(VERIFY, PORT);

  let exitCode = 0;
  try {
    const browser = await chromium.launch();
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();

    let requestCount = 0;
    let transferredBytes = 0;
    const badResponses: { url: string; status: number }[] = [];
    const failedRequests: string[] = [];
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const seenResponses: { url: string; status: number; bytes: number }[] = [];

    page.on('response', (response) => {
      requestCount++;
      const status = response.status();
      if (status >= 400) badResponses.push({ url: response.url(), status });
      const cl = response.headers()['content-length'];
      const bytes = cl ? Number(cl) : 0;
      if (cl) transferredBytes += bytes;
      seenResponses.push({ url: response.url(), status, bytes });
    });
    page.on('requestfailed', (request) => {
      failedRequests.push(`${request.url()} — ${request.failure()?.errorText ?? 'unknown'}`);
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => {
      pageErrors.push(String(err));
    });

    const url = `http://127.0.0.1:${PORT}/${SUBDIR_NAME}/`;
    console.log(`\n[rehearsal] step 6: navigating to ${url} (real Chromium, 1920x1080, dpr=1)`);
    await page.goto(url, { waitUntil: 'networkidle' });

    const bootstrapped = await page.evaluate(
      () => document.getElementById('app')?.dataset.bootstrapped,
    );
    console.log(`[rehearsal] #app dataset.bootstrapped = ${bootstrapped}`);
    if (bootstrapped !== 'true') {
      throw new Error('app shell did not bootstrap under the sub-path');
    }

    // Root-path control check: proves the rehearsal really tests a sub-path,
    // not the server root (explicitly rejected as evidence otherwise).
    const rootResponse = await page.request.get(`http://127.0.0.1:${PORT}/`).catch(() => null);
    const rootStatus = rootResponse ? rootResponse.status() : 'network error';
    console.log(`[rehearsal] control: GET http://127.0.0.1:${PORT}/ (no sub-path) -> ${rootStatus} (expected 404 — proves this is a real sub-path test, not root-path serving)`);

    const screenshotPath = join(VERIFY, 'subpath-rehearsal-1920x1080.png');
    await page.screenshot({ path: screenshotPath });
    console.log(`[rehearsal] screenshot: ${screenshotPath}`);

    const browserVersion = browser.version();
    await browser.close();

    const fingerprint = buildFingerprint(join(VERIFY, SUBDIR_NAME));
    const mbTransferred = (transferredBytes / (1024 * 1024)).toFixed(1);
    const largestMB = (largestFileBytes / (1024 * 1024)).toFixed(2);
    const totalFailed = badResponses.length + failedRequests.length;

    const evidenceLine =
      `built ${fingerprint} · served from /${SUBDIR_NAME}/ · Chromium ${browserVersion} · ` +
      `${requestCount} requests · ${totalFailed} failed · ${mbTransferred} MB transferred · ` +
      `${fileCount} files · largest file ${largestMB} MB`;

    console.log('\n--- PH-D1 accepted evidence line ---');
    console.log(evidenceLine);
    console.log('-------------------------------------\n');

    console.log('[rehearsal] every response observed (url, status, content-length bytes):');
    for (const r of seenResponses) console.log(`  ${r.status} ${r.bytes}B ${r.url}`);

    console.log(`[rehearsal] responses >= 400: ${badResponses.length}`);
    for (const b of badResponses) console.log(`  ${b.status} ${b.url}`);
    console.log(`[rehearsal] requestfailed: ${failedRequests.length}`);
    for (const f of failedRequests) console.log(`  ${f}`);
    console.log(`[rehearsal] console errors: ${consoleErrors.length}`);
    for (const c of consoleErrors) console.log(`  ${c}`);
    console.log(`[rehearsal] pageerror: ${pageErrors.length}`);
    for (const p of pageErrors) console.log(`  ${p}`);

    if (totalFailed > 0 || consoleErrors.length > 0 || pageErrors.length > 0) {
      exitCode = 1;
    }
  } finally {
    await stopServer(server);
    console.log('[rehearsal] step 9: server stopped');
  }

  process.exit(exitCode);
}

main().catch((err) => {
  console.error('[rehearsal] FAILED:', err);
  process.exit(1);
});
