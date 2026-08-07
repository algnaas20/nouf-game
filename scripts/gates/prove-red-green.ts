/**
 * Red -> green proof harness for the PH-D1 delivery gates (v3 §4 —
 * "a guard you have not seen fail is a blind guard"). Runs three real
 * mutations, one at a time, shows each gate turning red, then restores and
 * shows green again. Calls the exact same gate functions the Vite plugin
 * uses (scripts/gates/index.ts) — nothing here re-implements gate logic.
 *
 * Usage: npx tsx scripts/gates/prove-red-green.ts
 * Requires a clean `npm run build` to have produced dist/ already, or runs
 * one itself first.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, renameSync, rmSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { runAllGates } from './index.ts';

const ROOT = resolve(import.meta.dirname, '..', '..');
const DIST = join(ROOT, 'dist');
const INDEX_HTML = join(ROOT, 'index.html');

function npmBuild(): { status: number | null; stdout: string } {
  // Single command string (no args array) + shell:true — required on Windows
  // to invoke the npm.cmd batch file at all (spawnSync('npm.cmd', [...])
  // fails EINVAL without a shell); passing one string instead of an args
  // array also avoids Node's "unescaped args with shell" warning since
  // there is nothing here that came from outside this file.
  const result = spawnSync('npm run build', { cwd: ROOT, shell: true, encoding: 'utf8' });
  return { status: result.status, stdout: (result.stdout ?? '') + (result.stderr ?? '') };
}

function section(title: string): void {
  console.log(`\n${'='.repeat(70)}\n${title}\n${'='.repeat(70)}`);
}

function main(): void {
  // --- Baseline: prove green before touching anything ---
  section('BASELINE — clean build, expect 0 violations');
  const baseline = npmBuild();
  console.log(baseline.stdout);
  if (baseline.status !== 0) {
    throw new Error('baseline build must be green before starting the red->green proof');
  }

  // --- Mutation 1: gate 4a — leading-slash URL in real source ---
  section('MUTATION 1 (gate 4a) — inject <img src="/x.png"> into index.html');
  const originalHtml = readFileSync(INDEX_HTML, 'utf8');
  const mutatedHtml = originalHtml.replace('<div id="app"></div>', '<div id="app"></div>\n    <img src="/x.png">');
  writeFileSync(INDEX_HTML, mutatedHtml, 'utf8');
  const red1 = npmBuild();
  console.log(red1.stdout);
  console.log(`[proof] build exit code: ${red1.status} (expected non-zero)`);
  if (red1.status === 0) throw new Error('gate 4a did NOT go red — blind guard');
  writeFileSync(INDEX_HTML, originalHtml, 'utf8');
  const green1 = npmBuild();
  console.log(`[proof] reverted index.html; rebuild exit code: ${green1.status} (expected 0)`);
  if (green1.status !== 0) throw new Error('failed to restore green state after mutation 1');

  // --- Mutation 2: gates 4b + 4c — rename a real emitted asset to Logo.PNG ---
  section('MUTATION 2 (gates 4b + 4c) — rename an emitted asset to Logo.PNG');
  const faviconPath = join(DIST, 'icons', 'favicon.svg');
  const badPath = join(DIST, 'icons', 'Logo.PNG');
  if (!existsSync(faviconPath)) throw new Error('expected dist/icons/favicon.svg to exist after build');
  renameSync(faviconPath, badPath);
  const mutatedResult = runAllGates(DIST);
  console.log(mutatedResult.text);
  const gate4b = mutatedResult.outcomes.find((o) => o.gate === '4b-name-policy')!;
  const gate4c = mutatedResult.outcomes.find((o) => o.gate === '4c-case-audit')!;
  console.log(`[proof] 4b violations: ${gate4b.violations.length} (expected > 0)`);
  console.log(`[proof] 4c violations: ${gate4c.violations.length} (expected > 0)`);
  if (gate4b.violations.length === 0) throw new Error('gate 4b did NOT go red — blind guard');
  if (gate4c.violations.length === 0) throw new Error('gate 4c did NOT go red — blind guard');
  renameSync(badPath, faviconPath);
  const restored2 = runAllGates(DIST);
  console.log(`[proof] renamed back; total violations now: ${restored2.totalViolations} (expected 0)`);
  if (restored2.totalViolations !== 0) throw new Error('failed to restore green state after mutation 2');

  // --- Mutation 2b: gate 4c specifically — SAME basename, case-only change ---
  // (§3.1's exact scenario: "Logo.PNG opens logo.png" — Windows resolves it,
  // GitHub Pages does not. Mutation 2 above proves 4c catches a renamed/
  // missing reference; this proves it names the failure as a *case*
  // mismatch specifically, not just "file missing".)
  section('MUTATION 2b (gate 4c) — case-only rename, same basename: favicon.svg -> FAVICON.SVG');
  const caseOnlyPath = join(DIST, 'icons', 'FAVICON.SVG');
  renameSync(faviconPath, caseOnlyPath);
  const mutated2b = runAllGates(DIST);
  console.log(mutated2b.text);
  const gate4cCaseOnly = mutated2b.outcomes.find((o) => o.gate === '4c-case-audit')!;
  const caseMismatchHit = gate4cCaseOnly.violations.some((v) => v.reason.includes('case mismatch'));
  console.log(`[proof] 4c violations: ${gate4cCaseOnly.violations.length}, reports "case mismatch": ${caseMismatchHit} (expected true)`);
  if (!caseMismatchHit) throw new Error('gate 4c did not report a same-name case mismatch — blind guard');
  renameSync(caseOnlyPath, faviconPath);
  const restored2b = runAllGates(DIST);
  console.log(`[proof] renamed back; total violations now: ${restored2b.totalViolations} (expected 0)`);
  if (restored2b.totalViolations !== 0) throw new Error('failed to restore green state after mutation 2b');

  // --- Mutation 3: gate 4b — add an underscore-prefixed emitted file ---
  section('MUTATION 3 (gate 4b) — add dist/assets/_helper.js');
  const helperPath = join(DIST, 'assets', '_helper.js');
  writeFileSync(helperPath, '// bundler-style helper chunk, underscore-prefixed on purpose\n', 'utf8');
  const mutated3 = runAllGates(DIST);
  console.log(mutated3.text);
  const gate4bAgain = mutated3.outcomes.find((o) => o.gate === '4b-name-policy')!;
  console.log(`[proof] 4b violations: ${gate4bAgain.violations.length} (expected > 0)`);
  if (gate4bAgain.violations.length === 0) throw new Error('gate 4b did NOT go red for _helper.js — blind guard');
  rmSync(helperPath, { force: true });
  const restored3 = runAllGates(DIST);
  console.log(`[proof] removed _helper.js; total violations now: ${restored3.totalViolations} (expected 0)`);
  if (restored3.totalViolations !== 0) throw new Error('failed to restore green state after mutation 3');

  section('ALL THREE RED->GREEN PROOFS PASSED, STATE RESTORED');
}

main();
