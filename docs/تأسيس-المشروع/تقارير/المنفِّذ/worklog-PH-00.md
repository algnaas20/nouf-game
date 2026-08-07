# Worklog — PH-00 (contracts freeze)

**Agent:** executor · **Date:** 2026-08-07 · **Task:** م-08 · **Worktree:** main tree (sole agent running; no isolation needed per coordinator)

## Scope actually executed

PH-00 per `docs/تأسيس-المشروع/تقارير/planner/executor-prompts-2026-08-07.md` PROMPT 0, plus the coordinator's addition #1 (project skeleton bootstrap, since `tsc --noEmit` needs a `tsconfig.json` to run at all). No `src/core`, `src/stage`, `src/editor`, `src/pack`, `index.html` written — confirmed by directory listing below.

## Files written

| File | Change | Owner per plan | Note |
|---|---|---|---|
| `src/contracts/question.ts` | new — `OptionIndex`, `QuestionMedia`, `Question` | WL-A (mine) | `category?`/`difficulty?` present, unused |
| `src/contracts/pack.ts` | new — `PackMediaEntry`, `PackManifest` | WL-A (mine) | imports `Question` only |
| `src/contracts/state.ts` | new — `TeamId`, `StateId`, `Outcome`, `MazeCell`, `RngState`, `GameState` | WL-A (mine) | `MazeCell.event: null` present |
| `src/contracts/events.ts` | new — `GameEvent` discriminated union, 7 members | WL-A (mine) | every member has `seq`, `at`; `optionOrder` on `QUESTION_SHOWN` |
| `src/contracts/index.ts` | new — barrel `export *` | WL-A (mine) | |
| `package.json` | new — scripts `dev/build/preview/typecheck/test`, devDeps `typescript@^5.6.3 vite@^5.4.11 vitest@^2.1.8` | WL-D per plan's ownership map | Bootstrapped now under coordinator's explicit addition #1 — see Decisions |
| `tsconfig.json` | new — strict mode (`strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`), `noEmit`, `isolatedModules`, target ES2022 | WL-D per plan | same |
| `vite.config.ts` | new — `base: './'` only, nothing else | WL-D per plan | same; no `index.html` yet (WL-D's D1) |
| `vitest.config.ts` | new — `test.passWithNoTests: true` | WL-D per plan | so the test command exits 0 with zero test files, as required now |

**Files NOT touched:** everything else, including `src/core/**`, `src/stage/**`, `src/editor/**`, `src/pack/**`, `index.html`, `public/**`, `scripts/**` — verified by full repo file listing (see Gate results).

## Acceptance criteria — measured

| # | Criterion | Measurement | Result |
|---|---|---|---|
| 1 | `npx tsc --noEmit` exits 0, 0 errors | Command run, output empty, `EXIT CODE: 0` | **PASS** |
| 2 | grep counts for `category`, `difficulty`, `event`, `at`, `seq` in `src/contracts/`, each ≥ 1 | `category`=1, `difficulty`=1, `event`=6 (3 files), `at`=2, `seq`=2 | **PASS** (all ≥1) |
| 3 | `grep -E "function\|class\|=>\|const "` over `src/contracts/` → 0 matches | ripgrep run, "No matches found" | **PASS** (0) |
| 4 | `optionOrder` field exists on `QUESTION_SHOWN` | `src/contracts/events.ts:30` — `optionOrder: [OptionIndex, OptionIndex, OptionIndex, OptionIndex];` on `QuestionShownEvent` | **PASS** |

## Red→green proof (tsc is not a vacuous pass)

Not a "new guard" in the strict sense (PH-00 has no test files by design — "no test beyond type-checking"), but `tsc --noEmit` is the only gate this phase has, so it was mutated to prove it actually discriminates:

1. Injected `brokenField: ThisTypeDoesNotExist;` into `src/contracts/question.ts`.
2. Ran `npx tsc --noEmit` → **exit 2**, `src/contracts/question.ts(20,16): error TS2304: Cannot find name 'ThisTypeDoesNotExist'.`
3. Reverted the edit.
4. Ran `npx tsc --noEmit` again → **exit 0**, no output.

## Skeleton / tooling gates

| Gate | Command | Result |
|---|---|---|
| Install | `npm install` | 45 packages added, 46 audited, 47s. 5 vulnerabilities reported (3 moderate, 1 high, 1 critical) by `npm audit` — **not investigated, out of scope for PH-00**; flagged below as a risk for WL-D. `esbuild` postinstall flagged by `allow-scripts` but the Windows binary (`node_modules/@esbuild/win32-x64`) is present and vitest ran successfully, so it did not block this phase. |
| Type-check | `npx tsc --noEmit` | exit 0, 0 errors (see above) |
| Test runner wired | `npx vitest run` | exit 0 — "No test files found, exiting with code 0" (via `passWithNoTests: true`); no test files exist yet, none were required for PH-00 |
| Repo file listing (proves no forbidden-file writes) | `git ls-files` equivalent via recursive listing, `node_modules` excluded | 5 `src/contracts/*.ts` files + `package.json`, `package-lock.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts` — no `src/core`, `src/stage`, `src/editor`, `src/pack`, `index.html` present |

## Decisions (with rejected alternative)

| Decision | Rejected alternative | Why |
|---|---|---|
| Bootstrapped `package.json`/`tsconfig.json`/`vite.config.ts`/`vitest.config.ts` in PH-00 despite the plan assigning them to WL-D | Leave PH-00 as literally 5 `.ts` files with no runnable `tsc` | The coordinator's task brief explicitly overrides PROMPT 0's "out of scope: any tsconfig/package.json change" on this one point ("Set up the project skeleton as part of this phase if PH-00's spec assumes it exists"), and acceptance criterion 1 (`npx tsc --noEmit` exits 0) is unmeasurable without a `tsconfig.json`. WL-D's D1 phase owns these files going forward for the build/gates work; this is a minimal placeholder, not the final `vite.config.ts` (D1 also needs `index.html`, the four build gates, `.nojekyll`, etc., none of which were added here) |
| `MazeCell` placed in `state.ts` rather than a 6th file | A new `maze.ts` file | The owned-files list for PROMPT 0 is exactly 5 files (`question.ts`, `pack.ts`, `events.ts`, `state.ts`, `index.ts`); `MazeCell` is consumed only as part of `GameState.maze`, so it lives with `GameState` |
| `TeamId` placed in `state.ts`, imported by `events.ts` | Define `TeamId` in `events.ts` | Avoids a state→events circular import (`events.ts` needs `Outcome` and `TeamId` from `state.ts`; `state.ts` never needs anything from `events.ts`) |
| `GameState` given a full plausible shape (positions, attempts, rng, deckHash, maze, optionOrder, outcome, currentTeam) rather than left minimal | A near-empty `GameState` with only `stateId` | PH-A1 (next, same work line) implements the reducer against this exact type; the acceptance criteria for A1 explicitly reference `usedQuestionIds` and "RNG draw index" as part of the folded state, so the type needed to carry them now to avoid a same-day contract-change request |
| Did not create empty placeholder directories for `src/core`, `src/stage`, `src/editor`, `src/pack`, etc. | Pre-create the full directory tree named in the plan | Git does not track empty directories, and the coordinator's brief said "nothing else — no UI, no editor, no game logic beyond what the contracts require"; the owning work lines create their own directories when they write into them |

## Risks / notes for the coordinator

| Risk | Detail | Suggested owner |
|---|---|---|
| `npm audit`: 5 vulnerabilities (3 moderate, 1 high, 1 critical) | Not investigated — out of scope for PH-00 (types-only phase, no build/serve). Should be triaged before WL-D's PH-D1 build/gates work or before first publish (D-16/D-17 territory) | WL-D, PH-D1 or PH-D4 |
| `esbuild` postinstall script not run automatically (`allow-scripts` blocked it) | Did not block this phase because the Windows platform binary was already present in `node_modules/@esbuild/win32-x64` and `vitest run` executed successfully. If a future `npm install` on a clean machine lacks that binary, `vite`/`vitest` may fail until `npm approve-scripts --allow-scripts-pending` (or equivalent) is run | WL-D (owns `package.json`/tooling going forward) |
| `tsconfig.json` strictness choices (`noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `noUncheckedIndexedAccess`) were not requested line-by-line in the plan, only "strict mode" | Not measured against a specific list — flagged as **not measured against an explicit spec**, only against "strict mode" generally, which `strict: true` alone satisfies; the extra flags are additive safety, could be loosened by WL-D if they conflict with a later phase's code style | WL-D / coordinator |

## Conclusion

**The contract is frozen and ready for WL-B / WL-C / WL-D to start against it.**

All four PROMPT 0 acceptance criteria pass with pasted measurements above. `npx tsc --noEmit` exits 0 against a real `tsconfig.json` (strict mode), `npx vitest run` is wired and exits 0, and the repo contains no files outside `src/contracts/**` plus the minimal skeleton config files the coordinator explicitly authorized. No forbidden file (`src/core/**`, `src/stage/**`, `src/editor/**`, `src/pack/**`, `vite.config.ts` beyond the one line it needs, `index.html`) was written beyond that skeleton bootstrap.
