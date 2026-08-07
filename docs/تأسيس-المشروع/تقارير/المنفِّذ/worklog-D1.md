## Worklog — WL-D / PH-D1 (build, gates, sub-path rehearsal)

**Agent:** executor · **Date:** 2026-08-07 · **Worktree:** `../nouf-wl-d-pack` (branch `wl-d-pack`, base `9c4afbf`)

**Port note (discrepancy, resolved by following the direct launch instruction):** `executor-prompts-2026-08-07.md` assigns WL-D → `wt-pack` → port **3013**. My direct launch message overrides this explicitly: *"Your dedicated port is 3012."* Followed 3012 throughout as a live coordinator reassignment. No other port was touched.

---

### Closing-claims scorecard

| # | Claim | Result |
|---|---|---|
| C1 | Evidence line, real numbers | **DONE** — §Evidence line |
| C2–C5 | Gates 4a/4b/4c/4d: 0 violations, numbers printed | **DONE** — §Gate results |
| C6 | Red→green 4a | **DONE** — real `<img src="/x.png">`, real `npm run build`, exit 1→0 |
| C7 | Red→green 4b+4c together | **DONE** — real rename `favicon.svg`→`Logo.PNG` in `dist/`, both flagged, reverted |
| C7b | Red→green 4c, same-name case-only (stronger than the spec's literal example) | **DONE** — `favicon.svg`→`FAVICON.SVG`, gate names it `"case mismatch"`, not just "missing" |
| C8 | Red→green 4b, `_helper.js` | **DONE** |
| C9 | `.nojekyll` presence, asserted programmatically | **DONE** — `present: true` in `dist/` and in staged `verify/nouf-game/` |
| C10 | Playwright: 0≥400, 0 requestfailed, 0 console errors, 0 pageerror | **DONE** — 2 requests, 0 failed, every response logged |
| C11 | Screenshot attached | **DONE** — `screenshots-d1/subpath-rehearsal-1920x1080.png` |
| C12 | Port free after teardown | **DONE** — proven by re-binding a listener on 3012, not just `netstat` |
| C13 | `npm audit` + blocked `esbuild` postinstall | **FIXED** — `vite`/`vitest` upgraded, audit now 0 vulnerabilities |
| C14–C15 | Constraint rows 1 (leading-slash) and 2 (lowercase names) | **DONE**, and row 2 caught a **real bug** (§Real bug found) |
| C16 | Row 11 — reserve the copy for D2 | **DONE** — `src/pack/constants.ts`; no literal Arabic sentence exists yet for this warning, none invented |
| C17 | Row 12 — `preload="none"`/`loading="lazy"` | **NOT MEASURED — VACUOUS**, stated explicitly, not silently claimed (§Row 12) |
| C18 | `core.ignorecase false` + duplicate-modulo-case scan | **DONE** — 0 duplicates |
| C19 | Out-of-scope items not started | **DONE** — see §Files written |

---

### Environment

| Step | Result |
|---|---|
| `git worktree add -b wl-d-pack ../nouf-wl-d-pack main` | at `9c4afbf`, own branch |
| `npm install` | 45 packages; 5 vulnerabilities (3 moderate/1 high/1 critical) — reproduces PH-00's exact numbers |
| `npm install --save-dev vite@latest vitest@latest` | `vite@8.2.1`, `vitest@4.1.10` → **0 vulnerabilities** |
| `npm install --save-dev tsx playwright @types/node` | run `.ts` scripts directly, drive real Chromium, type-check Node builtins |
| `npx playwright install chromium` | already cached; launched, `version() = 151.0.7922.34` |
| Ports 3012/3013 | both free before start |

---

### Security — the two PH-00-flagged items

| Item | Assessment | Action |
|---|---|---|
| `npm audit`: 5 vulns | Read `npm audit --json`: every advisory is in `vite`/`vitest`/`esbuild`/`vite-node`/`@vitest/mocker` and concerns the **dev server or Vitest UI server** (e.g. `GHSA-fx2h-pf6j-xcff` fs-deny bypass, `GHSA-5xrq-8626-4rwp` Vitest-UI arbitrary file read). Confirmed `dist/` contains none of this code — only `index.html`, one hashed `.js`, `favicon.svg`, `.nojekyll`. **"Dev-time only, not shipped" holds.** | **Fixed, not just accepted**: upgraded to latest majors, `npm audit` → 0. Re-verified `tsc --noEmit`, `vitest run`, `npm run build` all still pass |
| Blocked `esbuild` postinstall | Reproduced the same `allow-scripts` warning on `esbuild@0.28.1`. `npx esbuild --version` → `0.28.1`, exit 0 — binary works without the postinstall script (PH-00's finding still holds on the upgraded version) | **Accepted, with reason**: the platform binary resolves fine via npm's normal optional-dependency mechanism; the blocked step is `esbuild`'s own redundant download/verify. Risk carried forward for the record: a machine without the cached binary could need `npm approve-scripts --allow-scripts-pending` |

---

### Real bug the gates caught on their first run

First `npm run build` after wiring gate 4b failed:
```
[4b-name-policy] VIOLATION assets/index-CjhaCT9a.js — name does not match ^[a-z0-9._-]+$
```
Vite's default hash alphabet includes uppercase letters — a genuine bundler-produced instance of the exact bug class §2.6/§3 warn about, not a hand-written violation. Fixed in `vite.config.ts`:
```ts
build: { rollupOptions: { output: { hashCharacters: 'base36' } } } // lowercase alphanumeric only
```
Re-build: `assets/index-jysp7vx9.js` — all lowercase. This is why gate 4b runs against emitted output, never source.

---

### Gate results — clean build

| Gate | Violations | Numbers |
|---|---|---|
| 4a leading-slash | **0** | `filesScanned = 2` |
| 4b name policy | **0** | `entriesChecked = 6` |
| 4c case audit | **0** | `referencesChecked = 2`, `realFilesOnDisk = 4` |
| 4d budget | **0** | `fileCount = 4` · largest `index.html` 790 B · total 1819 B — well inside ≤100 files/≤20 MB |
| `.nojekyll` | **0** | `present = true` |

All five run inside `vite.config.ts`'s `closeBundle` hook (`scripts/vite-plugin-gates.ts`); a violation throws and `npm run build` exits non-zero — not a post-build review step.

---

### Red→green proof (`npx tsx scripts/gates/prove-red-green.ts`, exit 0)

Calls the same gate functions the plugin uses — no reimplementation. Four mutations, each red then restored:

**1 — gate 4a, real source edit, real `npm run build`:**
```
<img src="/x.png"> injected into index.html
[4a-leading-slash] VIOLATION index.html — pattern "src="/" at 19:10
error during build: Delivery gates failed with 1 violation(s)
[proof] build exit code: 1 (expected non-zero)
[proof] reverted; rebuild exit code: 0
```

**2 — gates 4b+4c together, `favicon.svg`→`Logo.PNG` in `dist/`:**
```
[4b-name-policy] VIOLATION icons/Logo.PNG — does not match ^[a-z0-9._-]+$
[4c-case-audit] VIOLATION index.html — reference "./icons/favicon.svg" — no file on disk at all (any case)
[proof] 4b: 1, 4c: 1 (both expected > 0)
[proof] renamed back; total violations now: 0
```

**2b — gate 4c, same-basename case-only rename `favicon.svg`→`FAVICON.SVG` (proves it names the failure "case mismatch", not just "missing"):**
```
[4c-case-audit] VIOLATION ... "icons/favicon.svg" which exists only as "icons/FAVICON.SVG" (case mismatch)
[proof] reports "case mismatch": true
[proof] renamed back; total violations now: 0
```

**3 — gate 4b, `dist/assets/_helper.js` added:**
```
[4b-name-policy] VIOLATION assets/_helper.js — name starts with "_"
[proof] 4b: 1 (expected > 0)
[proof] removed; total violations now: 0
```

Final: `ALL THREE RED->GREEN PROOFS PASSED, STATE RESTORED`. Exit code `0`.

---

### The sub-path rehearsal (`npm run rehearsal`)

Clean build → stage `verify/nouf-game/` (full copy) → assert `.nojekyll` in the staged copy → re-run all 5 gates **against the staged copy** (proves the copy step didn't corrupt anything) → serve `verify/` as server root on port **3012** with a hand-written plain static server (`scripts/static-server.ts`, no SPA fallback — an unmatched path 404s) → real Chromium via Playwright, 1920×1080, `deviceScaleFactor: 1`, listening on `response`/`requestfailed`/`console`/`pageerror` → navigate to `http://127.0.0.1:3012/nouf-game/` → assert `#app.dataset.bootstrapped === 'true'` → **root-path control check**: `GET http://127.0.0.1:3012/` → **404**, proving this is a genuine sub-path test → screenshot → stop server.

**Every response observed:**
```
200 790B http://127.0.0.1:3012/nouf-game/
200 774B http://127.0.0.1:3012/nouf-game/assets/index-jysp7vx9.js
```
(2 requests. Headless Chromium did not fetch the declared favicon within `networkidle` — a known headless quirk, not a failure; 0 responses ≥400 regardless.)

**The accepted evidence line, real values:**
```
built a6b7eba02f0f · served from /nouf-game/ · Chromium 151.0.7922.34 · 2 requests · 0 failed · 0.0 MB transferred · 4 files · largest file 0.00 MB
```
(`<hash>` = SHA-256 of the staged output's sorted relative paths+sizes, truncated to 12 hex — a build fingerprint, since this worktree is uncommitted. `0.0`/`0.00` MB are honest roundings of 1564 B transferred / 790 B largest — exact bytes printed above, not hidden.)

Console errors: 0. Page errors: 0. `requestfailed`: 0. Responses ≥400: 0.

Screenshot: `docs/تأسيس-المشروع/تقارير/المنفِّذ/screenshots-d1/subpath-rehearsal-1920x1080.png` (also at `verify/...` inside the worktree, gitignored as a build artefact). Shows the RTL page with "لعبة نوف" rendered top-right — confirms the ES module loaded from a relative, hashed, sub-path-relative URL and ran.

**Explicitly avoided as evidence:** no `file://`, no dev server (`vite build` then a separate static server, never `vite dev`/`preview`), no root-path serving (control check proves it), screenshot is a supplement to the printed numbers, not the proof itself.

---

### Port teardown
```
node -e "net.createServer().listen(3012, ...)" → "bind OK -- port 3012 free"
```
Proven by re-binding a fresh listener after `stopServer()` closed the rehearsal's server — stronger than `netstat`, which still showed a `TIME_WAIT` client-socket remnant (normal post-close TCP behaviour, not a listening process). Confirmed at session end too: 3011 has another agent's listener (not touched), 3012/3013 free, no process I started left running.

---

### Row 11 and Row 12

**Row 11** (100-files-per-batch warning; reserve the copy, build the screen in D2): `src/pack/constants.ts` exports `MAX_FILES_PER_UPLOAD_BATCH = 100`. No literal Arabic sentence for this exact warning exists in خطة.md Appendix A — rather than invent product copy, the file states this gap as a comment for D2.

**Row 12** (`preload="none"`, `loading="lazy"`): grepped `dist/` for `<audio`/`<img` — **0 matches**, because no media markup ships in this phase at all (no stage, no editor built here). This is **not** "satisfied" — it is "nothing to check yet," stated explicitly per the self-delivery gate rather than silently claimed. Forward obligation recorded for whichever phase first ships real media markup.

---

### `core.ignorecase` and duplicate-name scan
```
git config core.ignorecase false
git config core.ignorecase → false (confirmed from both the worktree and the main tree — shared .git/config)
git ls-files | lowercase | group-by | count>1 → 0 duplicates
```

---

### Files written (all within WL-D ownership)

| File(s) | Note |
|---|---|
| `index.html` | new — placeholder scaffold; WL-B/WL-A's `<script src="./src/main.ts">` and font preload tags are added here later by the coordinator (WL-D-owned, others can't write it directly) |
| `public/.nojekyll`, `public/icons/favicon.svg` | new — empty marker file; minimal icon giving the gates a real emitted asset |
| `src/pwa/bootstrap.ts` | new — inert placeholder module (not a service worker); only job is being a real content-hashed ES module for the gates/rehearsal to exercise. SW registration is explicitly D3 scope, not started |
| `src/pack/constants.ts` | new — reserves `MAX_FILES_PER_UPLOAD_BATCH` for D2; no ZIP logic (D2 scope) |
| `scripts/gates/{types,walk,leading-slash-scan,name-policy,case-audit,budget-audit,nojekyll-check,index}.ts` | new — the five gates + aggregator, single source of truth for both the plugin and the standalone scripts |
| `scripts/vite-plugin-gates.ts` | new — wires gates into `closeBundle`, throws to fail the build |
| `scripts/static-server.ts`, `scripts/serve-subpath.ts` | new — plain static server; rehearsal orchestration + evidence line |
| `scripts/gates/prove-red-green.ts` | new — mutation harness against real gate functions |
| `vite.config.ts` | modified — wired the gates plugin, `build.outDir`, `hashCharacters: 'base36'` fix; `base: './'` untouched |
| `tsconfig.json` | modified — added `scripts`/`vite.config.ts`/`vitest.config.ts` to `include` (previously `scripts/**` was silently excluded from `tsc --noEmit` — found and fixed); added `allowImportingTsExtensions: true` |
| `package.json`/`package-lock.json` | modified — `vite`/`vitest` upgraded (closes the 5 audit findings); added `tsx`, `playwright`, `@types/node`; added `"rehearsal"` script |
| `.gitignore` | modified — added `verify/` (rehearsal staging dir, a build artefact like `dist/`) |

**Not touched:** `src/contracts/**`, `src/core/**`, `src/stage/**`, `src/editor/**`, `src/media/**`, `src/storage/**`, `tests/core/**`, `tests/stage/**` — confirmed via `git status --porcelain`.

---

### Full checks, final state (all green)

| Check | Command | Result |
|---|---|---|
| Type-check | `npx tsc --noEmit` | exit 0, now actually covers `scripts/**` too |
| Test runner | `npx vitest run` | exit 0 — "No test files found" (`passWithNoTests: true`); no unit tests added this phase, see below |
| Security audit | `npm audit` | **0 vulnerabilities** (was 5) |
| Build + all 5 gates | `npm run build` | exit 0, 0 violations |
| Sub-path rehearsal | `npm run rehearsal` | exit 0, evidence line above |
| Red→green harness | `npx tsx scripts/gates/prove-red-green.ts` | exit 0, 4/4 mutations proven |
| Port 3012 after teardown | manual re-bind | free |

---

### Scope decisions (rejected alternative in parentheses)

- **No vitest unit tests for the gates** (rejected: fixture-based `tests/gates/*.test.ts`) — the spec's own method is red→green against **real emitted build output**, which `prove-red-green.ts` already does against an actual `vite build`, including one genuine bug it caught unprompted. Fixture tests would be strictly weaker evidence for more code.
- **`src/pwa/bootstrap.ts` as a real external module** (rejected: inline `<script>` in `index.html`) — an inline script can't be hashed/rewritten, so gates 4b/4c/4d would have nothing realistic to check. A real module under `src/pwa/**` (mine) avoids touching `src/main.ts` (WL-B's) or building actual PWA logic (D3's).
- **Fixed the hash-alphabet bug immediately** (rejected: document as a known risk for D2/D3) — one line in `vite.config.ts`, which I own; leaving a known-red gate unfixed would contradict this phase's purpose.
- **Upgraded vite/vitest majors** (rejected: accept-with-reason) — zero source changes needed, audit → 0 in seconds, no regression in any check afterward.
- **Did not add `robots.txt`, `sw.js`, or bump `package.json` version** — explicitly D2/D3 scope ("do not start them"), even though individually cheap.

---

### What this phase proves

The built bundle serves correctly from `/nouf-game/` with relative paths and zero failed requests, driven by a real browser against a real static server — not a dev server, not the root path — closed with a real request log, not a description. All four delivery gates fail the build on a real violation and pass on the restored state, proven by mutating real emitted output, including one genuine bug (uppercase build hashes) the gates caught on their own first run, before any deliberate mutation was even written.

**Not provable by WL-D alone:** the full "open link → play 3 questions → winner screen" walking-skeleton claim needs WL-A's core and WL-B's stage wired into `index.html`/`src/main.ts`, outside this phase's ownership. This report proves the delivery half only.
