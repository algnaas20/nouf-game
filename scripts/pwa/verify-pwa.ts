/**
 * PH-D3 live verification — D3-2 (cache name changes per build), D3-4
 * (offline replay after one online visit), D3-5 (visible version string,
 * matches the build fingerprint). Reuses the exact staging/serving pattern
 * `scripts/serve-subpath.ts` (PH-D1) already established — a genuine
 * sub-path, a plain static server, real Chromium via Playwright. Not
 * folded into `serve-subpath.ts` itself (that file is the PH-D1 rehearsal
 * and stays focused on the four delivery gates); this is PH-D3's own
 * script, same infra, different assertions.
 *
 * Run: `npx tsx scripts/pwa/verify-pwa.ts`
 */
import { spawnSync } from 'node:child_process';
import { rmSync, mkdirSync, cpSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { chromium } from 'playwright';
import { startStaticServer, stopServer } from '../static-server.ts';

const ROOT = resolve(import.meta.dirname, '../..');
const DIST = join(ROOT, 'dist');
const VERIFY = join(ROOT, 'verify-pwa');
const SUBDIR_NAME = 'nouf-game';
const PORT = 3012;

function runBuild(): string {
  rmSync(DIST, { recursive: true, force: true });
  const build = spawnSync('npm run build', { cwd: ROOT, shell: true, stdio: 'pipe', encoding: 'utf-8' });
  if (build.status !== 0) {
    console.error(build.stdout, build.stderr);
    throw new Error(`build failed with exit code ${build.status}`);
  }
  const swSource = readFileSync(join(DIST, 'sw.js'), 'utf-8');
  const match = swSource.match(/const CACHE_NAME = "([^"]+)"/);
  if (!match) throw new Error('CACHE_NAME not found in generated sw.js');
  return match[1]!;
}

async function main(): Promise<void> {
  let failures = 0;

  // ---- D3-2: two consecutive builds produce two different cache names ----
  console.log('[pwa-verify] step 1: first build');
  const cacheNameA = runBuild();
  console.log('[pwa-verify] cache name (build A):', cacheNameA);
  console.log('[pwa-verify] step 2: second build');
  const cacheNameB = runBuild();
  console.log('[pwa-verify] cache name (build B):', cacheNameB);
  const namesDiffer = cacheNameA !== cacheNameB;
  console.log('[pwa-verify] D3-2 — cache names differ across consecutive builds:', namesDiffer);
  if (!namesDiffer) {
    failures += 1;
    console.error('D3-2 FAILED — cache name did not change between builds');
  } else {
    console.log('D3-2 PASSED');
  }

  // D3-1: grep the actually-built output (not just source) for any
  // absolute-path service-worker registration.
  const jsAssetName = readdirSync(join(DIST, 'assets')).find((f) => f.endsWith('.js'));
  if (!jsAssetName) throw new Error('no built .js asset found in dist/assets');
  const distEntryJs = readFileSync(join(DIST, 'assets', jsAssetName), 'utf-8');
  const hasAbsoluteSwRegister = distEntryJs.includes("register('/sw.js')") || distEntryJs.includes('register("/sw.js")');
  console.log('[pwa-verify] D3-1 — built JS contains an absolute "/sw.js" registration:', hasAbsoluteSwRegister, '(expected false)');
  if (hasAbsoluteSwRegister) {
    failures += 1;
    console.error('D3-1 FAILED');
  } else {
    console.log('D3-1 PASSED');
  }

  // ---- Stage the LAST build (cacheNameB) at a genuine sub-path ----
  rmSync(VERIFY, { recursive: true, force: true });
  mkdirSync(join(VERIFY, SUBDIR_NAME), { recursive: true });
  cpSync(DIST, join(VERIFY, SUBDIR_NAME), { recursive: true });

  const server = await startStaticServer(VERIFY, PORT);
  let exitCode = 0;
  try {
    const browser = await chromium.launch();
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    page.on('pageerror', (err) => console.error('PAGEERROR:', err));
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.error('CONSOLE ERROR:', msg.text());
    });

    const url = `http://127.0.0.1:${PORT}/${SUBDIR_NAME}/`;
    console.log(`\n[pwa-verify] navigating (online) to ${url}`);
    await page.goto(url, { waitUntil: 'networkidle' });

    // ---- D3-5: visible version string, matches the build fingerprint ----
    const versionText = await page.locator('#app-version').textContent();
    console.log('[pwa-verify] D3-5 — #app-version text:', versionText);
    const expectedVersionText = `v${cacheNameB.replace('nouf-shell-', '')}`;
    const versionMatches = versionText === expectedVersionText;
    console.log('[pwa-verify] D3-5 — expected:', expectedVersionText, '· matches:', versionMatches);
    if (!versionMatches) {
      failures += 1;
      console.error('D3-5 FAILED — version text does not match the build fingerprint');
    } else {
      console.log('D3-5 PASSED (text comparison)');
    }
    await page.screenshot({ path: join(VERIFY, 'version-badge-online.png') });
    await page.locator('#app-version-container').screenshot({ path: join(VERIFY, 'version-badge-crop.png') });
    console.log('[pwa-verify] screenshots saved');

    // ---- D3-6: robots.txt + <meta name="robots"> ----
    const robotsMeta = await page.locator('meta[name="robots"]').getAttribute('content');
    console.log('[pwa-verify] D3-6 — <meta name="robots" content="...">:', robotsMeta);
    const robotsTxtResponse = await page.request.get(`${url}robots.txt`);
    const robotsTxtBody = await robotsTxtResponse.text();
    console.log('[pwa-verify] D3-6 — robots.txt status:', robotsTxtResponse.status(), '· body:', JSON.stringify(robotsTxtBody));
    const robotsOk = robotsMeta === 'noindex' && robotsTxtResponse.ok() && robotsTxtBody.includes('Disallow: /');
    if (!robotsOk) {
      failures += 1;
      console.error('D3-6 FAILED');
    } else {
      console.log('D3-6 PASSED');
    }

    // ---- D3-7: the publish recipe — click-open for real, count steps, verify the literal final sentence ----
    await page.click('#open-publish-recipe');
    await page.waitForSelector('.publish-recipe-overlay li');
    const stepTexts = await page.locator('.publish-recipe-overlay li').allTextContents();
    console.log('[pwa-verify] D3-7 — recipe step count:', stepTexts.length);
    console.log('[pwa-verify] D3-7 — recipe steps:', stepTexts);
    const forbiddenWords = ['فرع', 'branch', 'Cache-Control', 'كاش', 'تخزين مؤقّت'];
    const violatesForbidden = stepTexts.some((t) => forbiddenWords.some((w) => t.includes(w)));
    const endsWithLiteralVerification =
      stepTexts.at(-1) === 'افتح الرابط: إذا ظهر اسم لعبتك وعدد الأسئلة، فالنشر تمّ.';
    console.log('[pwa-verify] D3-7 — mentions a forbidden term (branch/cache-header):', violatesForbidden);
    console.log('[pwa-verify] D3-7 — ends with the literal Appendix-أ verification sentence:', endsWithLiteralVerification);
    await page.screenshot({ path: join(VERIFY, 'publish-recipe-open.png') });
    if (stepTexts.length > 3 || stepTexts.length === 0 || violatesForbidden || !endsWithLiteralVerification) {
      failures += 1;
      console.error('D3-7 FAILED');
    } else {
      console.log('D3-7 PASSED —', stepTexts.length, 'steps, ends with the self-performed verification step.');
    }
    await page.click('.publish-recipe-close');
    const overlayHiddenAfterClose = await page.evaluate(
      () => (document.querySelector('.publish-recipe-overlay') as HTMLElement | null)?.style.display,
    );
    console.log('[pwa-verify] D3-7 — overlay style.display after close:', overlayHiddenAfterClose, '(expected "none")');
    if (overlayHiddenAfterClose !== 'none') {
      failures += 1;
      console.error('D3-7 FAILED — overlay did not actually close');
    }

    // Wait for the service worker to actually finish installing+activating
    // before testing offline — otherwise "no successful online visit yet"
    // would make the offline test meaningless by construction.
    const swState = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready;
      return reg.active?.state ?? 'none';
    });
    console.log('[pwa-verify] service worker active state after first visit:', swState);
    if (swState !== 'activated') {
      failures += 1;
      console.error('SETUP FAILED — service worker did not reach "activated" after one online visit');
    }

    // ---- D3-4: offline after one successful online visit ----
    await context.setOffline(true);
    console.log('[pwa-verify] context set offline — reloading...');
    let offlineReloadOk = true;
    try {
      await page.reload({ waitUntil: 'networkidle', timeout: 15000 });
    } catch (err) {
      offlineReloadOk = false;
      console.error('[pwa-verify] offline reload threw:', err);
    }
    // NOTE: `#app.dataset.bootstrapped` (PH-D1's original signal, still
    // used by scripts/serve-subpath.ts) is no longer set by anything —
    // confirmed a PRE-EXISTING regression, not caused by this session:
    // `npm run rehearsal` itself now fails the identical way on an
    // unmodified checkout, because a later merge rewired src/main.ts to
    // call the real `mountApp()` (src/stage/app.ts) instead of PH-D1's
    // placeholder module, and `mountApp()` never sets that dataset flag.
    // Flagged to the coordinator in worklog-D3.md; using `.stage-root`
    // (the real, currently-mounted class name) as this test's own signal
    // instead, so THIS check reflects current reality rather than
    // silently reporting a false pass/fail off a dead marker.
    const stageRootPresent = await page.evaluate(() => document.querySelector('.stage-root') !== null).catch(() => false);
    const versionTextOffline = await page.locator('#app-version').textContent().catch(() => null);
    console.log('[pwa-verify] D3-4 — offline reload succeeded:', offlineReloadOk);
    console.log('[pwa-verify] D3-4 — .stage-root present offline:', stageRootPresent);
    console.log('[pwa-verify] D3-4 — version text visible offline:', versionTextOffline);
    if (!offlineReloadOk || !stageRootPresent || !versionTextOffline) {
      failures += 1;
      console.error('D3-4 FAILED — the app did not open and render offline after one successful online visit');
    } else {
      console.log('D3-4 PASSED — the game opened and its shell rendered fully offline.');
    }
    await page.screenshot({ path: join(VERIFY, 'offline-reload.png') });

    await context.setOffline(false);
    await browser.close();
  } finally {
    await stopServer(server);
  }

  console.log(failures === 0 ? '\nALL PH-D3 LIVE CHECKS PASSED' : `\n${failures} PH-D3 LIVE CHECK(S) FAILED`);
  process.exit(exitCode || (failures > 0 ? 1 : 0));
}

main().catch((err) => {
  console.error('[pwa-verify] FAILED:', err);
  process.exit(1);
});
