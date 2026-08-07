# Executor prompts — phase 1 (walking skeleton), one per work line

**Author:** `planner` · **Date:** 2026-08-07 · **Track:** تأسيس-المشروع
**Language:** English (v3 §11 — audience is agents). Arabic strings inside are **product copy** — pass through verbatim, never translate or paraphrase.
**Dispatch:** the coordinator dispatches these and records each as «قيد التنفيذ» in `المهام.md`. The planner does not dispatch.

**Sequencing:** PROMPT 0 (WL-A, contracts) must complete and be reviewed **before** PROMPT B1 and PROMPT C1 start. PROMPT D1 may start immediately in parallel with PROMPT 0 (it touches no `src/` file). PROMPT A1 continues in the same worktree as PROMPT 0.

**Port assignments (reserved range, never 3000):**

| Work line | Worktree | Port |
|---|---|---|
| WL-A core | `wt-core` | **3010** |
| WL-B stage | `wt-stage` | **3011** |
| WL-C editor | `wt-editor` | **3012** |
| WL-D packaging | `wt-pack` | **3013** |

---

## Shared block — paste into every prompt below

### Preconditions
Work in your **own isolated worktree** with its **own `node_modules`**. Use **only your assigned port**. Verify the port is free before you start and free again before you hand back. Kill only PIDs you created.

### File ownership — absolute
You may **read and import** any file in the repository. You may **write only** the files listed under "You own". Writing a file owned by another line is a defect, even a one-line change. If you believe an owned-elsewhere file must change, stop and report it to the coordinator with the exact diff you wanted.

### Load-bearing constraint checklist (project-wide — every line must respect all of it; the rows marked **[YOURS]** in your prompt are the ones you must *prove*)
1. Relative base `base: './'`; **zero leading-slash URLs** anywhere in source or output.
2. Every emitted filename is lowercase ASCII `^[a-z0-9._-]+$`; media filenames are content-addressed (first 12 hex of SHA-256): `^[a-z0-9-]+\.[a-z0-9]+$`. No `_`-prefixed emitted names. Arabic lives **inside** files, never in a filename or URL.
3. **Two taps per question** on the common path: tap the option the team said aloud → tap «السؤال التالي».
4. **One-action undo** via the append-only event log; available in the same corner on every screen.
5. The **correct option is pixel-identical to the other three before reveal**, and the correctness flag **does not exist on the option DOM element at all** — it lives in session state.
6. **Equal-attempts ending**; **no victory staging whatsoever** when the first team reaches N.
7. Decorative dead ends carry **no stations and no token-width opening** — they must never look like a road not taken.
8. **No timer, no clock, no elapsed time, no win-percentage, no consolation copy.** Timestamps are recorded silently in the event log only.
9. Images are **downscaled automatically and silently at add time** to 1600 px long edge, with **EXIF orientation baked in** (`createImageBitmap(blob,{imageOrientation:'from-image'})`), and **never upscaled**.
10. **WAV rejected** above ~2 MB with a warning telling the host to convert; publish refuses it.
11. The export screen states the **100-files-per-upload-batch** limit up front, before he starts.
12. `preload="none"` on every `<audio>`; `loading="lazy"` on every image.
13. Never call `navigator.storage.persist()`. Never display `estimate().quota` to the user.
14. Session persistence is **synchronous, small, and separate** from the media store.
15. `<html lang="ar" dir="rtl">` in markup; **never** set base direction from CSS. Logical CSS properties only.
16. **Zero video** anywhere in the product (`video`, `mp4`, `webm`, `<video` → zero matches).
17. Every failure ends in a **calm Arabic sentence**. Technical detail goes to a hidden copyable log, never to the stage.
18. `category` / `difficulty` on the question record and `event: null` on every maze cell exist from day one, unused.

### Verification rules
- A guard you have not seen **fail** is a blind guard. For every new guard, mutate the real code to make it red, paste the failure output in your report, then restore.
- Never assert "it works". Every acceptance criterion below produces **a number, a pass/fail test result, or a screenshot**. Report the number even when it passes.
- Never compare the code under test to a value produced by the same code. Expected values are hand-written literals.
- Screenshot filenames: Latin ASCII only.

### Reporting
Write your worklog to `docs/تأسيس-المشروع/تقارير/المنفِّذ/<line>-<phase>-2026-08-07.md`, in English.
**Write it incrementally — save each section the moment it is done, not at the end. If you crash or lose connection, write the report file with whatever you have BEFORE anything else.**
Report your status line inside your report; do **not** edit `المهام.md` (coordinator/documenter only, v3 §2).

---

## PROMPT 0 — WL-A · Freeze the contracts (blocks every other line)

**Worktree `wt-core` · port 3010.** Small, fast, and it gates the whole project — do it first and hand it back before continuing to PROMPT A1.

**You own:** `src/contracts/question.ts` · `src/contracts/pack.ts` · `src/contracts/events.ts` · `src/contracts/state.ts` · `src/contracts/index.ts`
**Forbidden:** everything else, without exception. In particular `src/core/**` in this prompt (that is PROMPT A1), `src/stage/**`, `src/editor/**`, `src/pack/**`, `vite.config.ts`, `index.html`.

**Task.** Write the type-only contracts every other work line will import. Types only — **no functions, no classes, no constants, no default values.**

Required shapes:
- `Question`: `id`, `text`, `options: [string,string,string,string]`, `correctIndex: 0|1|2|3`, `media: {kind:'none'} | {kind:'image'|'audio', sha256:string, ext:string}`, plus **optional unused** `category?: string` and `difficulty?: number`.
- `MazeCell`: `{ index:number; event: null }` — `event` present from day one so shortcuts are later data, never a schema migration.
- `GameEvent` — discriminated union, every member carrying `seq:number` and `at:number` (silent timestamp): `GAME_STARTED{seed,N,teamNames,firstTeam,deckHash}` · `QUESTION_SHOWN{questionId, optionOrder:[0|1|2|3,...]}` · `ANSWER_CHOSEN{optionId, correct}` · `NO_ANSWER` · `MOVE_APPLIED{team, delta}` · `TURN_PASSED{toTeam}` · `GAME_ENDED{outcome}`.
- `GameState`, `StateId` (the ten states: `SETUP`, `TEAM_SETUP`, `TURN_START`, `QUESTION_SHOWN`, `ANSWER_REVEALED`, `PROGRESSION_APPLIED`, `FINAL_BALANCING_TURN`, `TIEBREAK`, `DECK_EXHAUSTED`, `FINISHED`), `Outcome = 'winA'|'winB'|'draw'`.
- `PackManifest`: `formatVersion:number`, `title:string` (Arabic), `preparedAt:string`, `questions: Question[]`, `media: {sha256:string; ext:string; bytes:number}[]`.

**Constraint rows that are [YOURS]:** 18.

**Acceptance criteria — each with its measurement:**
1. `npx tsc --noEmit` exits 0 with **0 errors**. Paste the command output.
2. `grep -c` over `src/contracts/` for `category`, `difficulty`, `event`, `at`, `seq` returns **≥ 1 for each of the five**. Paste the counts.
3. `grep -E "function|class|=>|const " src/contracts/` returns **0 matches** (types only). Paste the result.
4. The `optionOrder` field exists on `QUESTION_SHOWN` — the shuffled on-screen order must be part of the event log so it survives undo unchanged.

**Out of scope:** any implementation, any test beyond type-checking, any tsconfig/package.json change (ask WL-D).

---

## PROMPT A1 — WL-A · Minimal core for the walking skeleton

**Worktree `wt-core` · port 3010.** Starts after PROMPT 0 is handed back.

**You own:** `src/core/**` · `tests/core/**` · `tools/sim/**` · `docs/بروتوكولات/simulated-playthrough.md` (do **not** write the protocol file in this phase — it is owed only after a real harness run, phase A3).
**Forbidden:** `src/contracts/**` (frozen — request changes through the coordinator), `src/stage/**`, `src/editor/**`, `src/media/**`, `src/pack/**`, `src/pwa/**`, `index.html`, `vite.config.ts`, `public/**`, `scripts/**`.

**Task.** The smallest correct rule engine that plays a whole game: `applyEvent(state,event)`, `legalEvents(state)`, `selectNextQuestion(state)`, `fold`, `undo`, a seeded RNG. Target for this phase: `N = 2`, a hardcoded deck of 3 text questions, strict alternation, one step per correct answer, nobody moves on a wrong answer, turn passes.

Non-negotiable implementation rules:
- State is **derived**: `fold(applyEvent, initial, events)`. Nothing is stored that can be folded.
- **Undo = pop the last event and re-fold.** Never hand-write per-field restoration.
- The **win check runs only inside `PROGRESSION_APPLIED`**, after the move is committed as an event. If the win is computed in the reveal handler, undo cannot un-win.
- Question selection lives **only** in `selectNextQuestion(state)` — never inline in a turn handler.
- An illegal event **throws, is logged, and leaves the previous state deep-equal to its pre-call value**.
- The RNG is seeded and its draw index is part of the folded state.

**Constraint rows that are [YOURS]:** 4, 8 (timestamps recorded, never surfaced), 14 (design for it; implementation is phase A4), 18.

**Acceptance criteria — each with its measurement:**
1. **100/100** seeded games (`N=2`, 3-question deck, random policy) reach `FINISHED`, none exceeding `20 × deckSize` transitions. Print both numbers.
2. Invariant **I6 `position[t] === correct[t]`** asserted at **every step** of every game; print the total assertion count (must be > 0 — an invariant that never ran is not an invariant).
3. Invariants I1 (`0 ≤ position ≤ N`), I3 (no repeated question), I5 (illegal event throws **and leaves state deep-equal**), I7 (`|attempts[A]−attempts[B]| ≤ 1`) all pass at every step. Print pass counts.
4. **1,000 fuzzed undo sequences**: `undo(apply(s,e))` deep-equals `s` **including `usedQuestionIds` and the RNG draw index**. Zero failures.
5. **Red→green, mandatory, paste the failure output for each**: change the move to `position += 2` → I1 goes red; delete the push to `usedQuestionIds` → I3 goes red; grant a step on a wrong answer → I6 goes red; skip the turn swap on a wrong answer → I7 goes red. Restore after each.

**Out of scope:** R-b balancing turn, the decider, deck bands, deck exhaustion, persistence, the ≥10,000-game harness (phases A2–A4). Do not build them now.

---

## PROMPT B1 — WL-B · Minimal stage and the type scale

**Worktree `wt-stage` · port 3011.** Starts after PROMPT 0 is handed back.

**You own:** `src/main.ts` · `src/stage/**` · `src/styles/**` · `src/assets/fonts/**` · `tests/stage/**` · `docs/بروتوكولات/arabic-stage-screenshots.md` (write it only in phase B4, from real output).
**Forbidden:** `src/contracts/**`, `src/core/**`, `src/editor/**`, `src/media/**`, `src/pack/**`, `index.html` (WL-D owns it — request the `<link rel="preload">` font tags through the coordinator), `vite.config.ts`, `public/**`, `scripts/**`.

**Task.** A real 1920×1080 stage canvas with three screens — home, text question, winner — driven by the WL-A core, at the real type scale.

Implementation rules:
- One `--stage-unit: min(100vw/1920, 100vh/1080)`; every size in stage-px × the global scale step. Global type scale **×1.00 / ×1.15 / ×1.30** is shipped in this phase, not later.
- Type scale, exactly: question **76**/700/lh 1.6 (floor 56) · option **60**/600/lh 1.5 (floor 44) · option letter أ/ب/ج/د **48**/700 · turn banner 56/700 · team name 44/600 · score 72/700 `tabular-nums` · result word 96/700 · winner headline 120/700. **`letter-spacing: 0` everywhere — non-negotiable, Arabic breaks otherwise.**
- Safe area: 5% inset (96 px sides, 54 px top/bottom); usable 1728×972. Background may bleed to the edge; text may not.
- Dark theme only: background `#0E1116`, text `#F2F4F7`, team A `#0072B2`, team B `#E69F00`, correct `#009E73`, wrong `#D55E00`. Never `#000`, never `#FFF`.
- Options default to a 2×2 grid; **if any option would wrap to two lines, the whole set switches to stacked 1×4** — never mix. All four cards share the tallest card's height.
- Western digits, produced by **one formatting function** so a later flip is one line.
- Any auto-fit/shrink logic runs **after `await document.fonts.ready`**, never on first paint.

**Fonts.** The bundled `تعليمات ومهارات للمشروع/أصول/fonts/cairo-arabic.woff2` is **30.2 KB, static (not variable), has a STAT table, one weight only** — measured, this closes the open question. You therefore need **a second weight file** for the required 600/700 pair (or a subset variable file). Self-host, woff2 only, `font-display: block`, subset to Arabic + Arabic Supplement + Western digits + basic Latin punctuation. **Total font bytes ≤ 120 KB, measured.** Report the final byte numbers — WL-D needs them for the size budget.

**Constraint rows that are [YOURS]:** 3, 8, 12, 15, 17.

**Acceptance criteria — each with its measurement:**
1. **V1** — computed `font-size` of every role matches the table **exactly** at ×1.00, ×1.15 and ×1.30. Paste the three-column table of measured values.
2. **V2** — render "بخ" at font-size 100 px on a canvas; `(actualBoundingBoxAscent + actualBoundingBoxDescent) / 100` is within **±8%** of 0.50. Print the measured ratio. If it is outside, rescale the whole table by `0.50 / measured` and report both tables.
3. **V3** — programmatic contrast ratio for every stage text/background pair, computed from `getComputedStyle`: **≥ 7:1**. Print every pair and its ratio.
4. **Total font bytes ≤ 120 KB** — an actual file-size measurement, not an estimate. Print each file and the sum.
5. **V10** — grep stage CSS for `margin-left|margin-right|padding-left|padding-right|border-left|border-right|text-align:\s*(left|right)|\bleft:\s|\bright:\s`: **0 matches** without a comment naming the exception. Paste the grep output.
6. **V4** — `scrollHeight <= clientHeight` on every text box at all three scale steps, with the longest fixture (150-char question, four 50-char options): **0 overflow**.
7. Screenshot at 1920×1080, `deviceScaleFactor: 1`, after `document.fonts.ready`, `prefers-reduced-motion: reduce`: `stage-question-text-scale100.png` and `stage-question-text-scale130.png`.
8. Two taps take a question from shown to the next team's turn. Count them in the report.

**Out of scope:** image questions, audio questions, the maze beat, endings screens, the light theme, the editor preview integration.

---

## PROMPT C1 — WL-C · Draft store and question CRUD

**Worktree `wt-editor` · port 3012.** Starts after PROMPT 0 is handed back. Independent of B and D — nothing you need from them in this phase.

**You own:** `src/editor/**` · `src/media/**` · `src/storage/idb.ts` · `tests/editor/**`
**Forbidden:** `src/contracts/**`, `src/core/**` (including `src/core/session-store.ts` — that is a *different* store from yours and it is WL-A's), `src/stage/**` (you will **import** the stage question component in phase C3; you never edit it), `src/pack/**` (you call `exportPack()`/`importPack()`; WL-D writes them), `index.html`, `vite.config.ts`, `public/**`, `scripts/**`.

**Task.** The authoring draft: IndexedDB store, and add/edit/delete/reorder of questions with the correct-option marking.

Implementation rules:
- **IndexedDB** for metadata and blobs together, one transaction per question. `localStorage` never holds media.
- **Never call `navigator.storage.persist()`** — it silently prompts in Firefox and is a silent coin-flip in Chrome. **Never show `estimate().quota` to the user** — Chrome derives it from total disk size, so it lies about free space.
- Wrap **every** draft write in a `QuotaExceededError` handler that shows «لم يعد هناك مكان للمسودة — احفظ لعبتك في الكمبيوتر الآن» **with the save button inside the message**.
- Vocabulary is load-bearing: the draft is «نسخة العمل — على هذا المتصفح فقط». **Never** «محفوظ» alone and never «آمن» for the draft.
- On return, prompt — never auto-resume silently, never auto-discard: «لديك مسودة من [التاريخ] — تابع، أو ابدأ من جديد، أو احذفها».
- Reordering: **«▲ أعلى» / «▼ أسفل» buttons are the primary mechanism**; drag is an optional extra, never the only way.
- Delete: no modal. The card collapses to an undo strip for ~8 s («حُذف السؤال» + «تراجُع»), then commits.
- A question cannot reach «جاهز» without a marked correct option; the correct row shows **three redundant signals** — a radio control, the whole row green with a ✓, and the words «الإجابة الصحيحة».
- Text inputs carry `dir="auto"`.

**Constraint rows that are [YOURS]:** 13, 17, and the vocabulary rule above.

**Acceptance criteria — each with its measurement:**
1. Create **50 questions**, reload the page, assert **50/50** present in the original order. Print the number.
2. Simulate `QuotaExceededError` on a draft write: the Arabic message appears **with the save button inside it**, and no write is silently dropped. Test passes; screenshot.
3. `grep -r "storage.persist" src/` → **0 matches**. Paste it.
4. `grep -rn "quota" src/editor/` → **0 matches** reaching the UI. Paste it.
5. A question with no correct option cannot reach «جاهز», and publish is blocked with a message **naming the question number** («السؤال ٣ بلا إجابة صحيحة»). Test passes.
6. Reorder 10 questions using only the ▲/▼ buttons (no drag), reload, order persists. Print before/after order arrays.
7. Delete → the 8-second undo strip restores the exact question including its media reference. Test passes.

**Out of scope:** media intake and downscaling (phase C2), the stage preview and readiness meter and backup chip (phase C3), export/import (WL-D).

---

## PROMPT D1 — WL-D · Build, gates, and the sub-path rehearsal

**Worktree `wt-pack` · port 3013.** May start immediately, in parallel with PROMPT 0.

**You own:** `index.html` · `vite.config.ts` · `package.json` · `tsconfig.json` · `public/**` (including `public/.nojekyll`) · `scripts/**` · `src/pack/**` · `src/pwa/**` · `docs/بروتوكولات/build-and-serve-at-subpath.md` · `docs/بروتوكولات/playwright-live-check.md`
**Forbidden:** `src/contracts/**`, `src/core/**`, `src/stage/**`, `src/editor/**`, `src/media/**`, `src/storage/**`, `tests/core/**`, `tests/stage/**`.

**Task.** Set up the Vite + TypeScript project (no framework, no router), and build the four gates that make "works locally, 404 after upload" impossible. In this phase build **only** the gates and the sub-path rehearsal — the ZIP pack, PWA and version string are phases D2/D3.

Implementation rules:
- **`base: './'`** — *not* `'/nouf-game/'`. A hard-coded repo name breaks the moment the user names the repo differently or we move to Cloudflare Pages.
- **No client-side router at all.** Never history routing (it needs a `404.html` hack on Pages).
- Emit `.nojekyll` into the output **and assert its presence in the built listing**. Additionally forbid `_`-prefixed emitted names, so the site survives even if `.nojekyll` is lost in a drag-and-drop upload.
- Dynamic asset URLs use `new URL('./x.png', import.meta.url)`. If `BASE_URL` is ever needed it is written **literally** as `import.meta.env.BASE_URL` — the bracket form does not work.
- Run `git config core.ignorecase false` at repo creation, and scan for paths that are duplicates modulo case.

The four gates, all inside `npm run build` so they **fail the build** — not review habits:
- **4a leading-slash scan** across every emitted `.html`/`.css`/`.js` for `src="/`, `href="/`, `url(/`, `from "/`, `import("/`, `fetch("/`, `register("/`, and protocol-relative `//`.
- **4b name policy**: every emitted file and folder name matches `^[a-z0-9._-]+$` and none starts with `_`.
- **4c case audit** — the only check that catches case bugs on Windows: enumerate real filenames from the filesystem, extract every relative path referenced from emitted `.html`/`.css`/`.js`, and assert a **byte-exact, case-sensitive** match exists for each. A local Windows static server will resolve the wrong case successfully, so a passing browser run proves nothing here.
- **4d budget audit**: emitted file count, largest single file, total on-disk size — **always print all three numbers**.

Then the rehearsal: copy the entire build output into `verify/nouf-game/`, serve `verify/` as the server root on port 3013 with a **plain static file server** (no SPA fallback, no dev server, no HMR), and drive `http://127.0.0.1:3013/nouf-game/` with **real Chromium** via Playwright at 1920×1080, `deviceScaleFactor: 1`, listening on `response`, `requestfailed`, `console`, `pageerror`.

**Constraint rows that are [YOURS]:** 1, 2, 11 (state it in the export screen — build the screen in D2, but reserve the copy now), 12.

**Acceptance criteria — each with its measurement:**
1. The only accepted evidence line, filled in with real values:
   `built <hash> · served from /nouf-game/ · Chromium <ver> · N requests · 0 failed · X.X MB transferred · M files · largest file Y MB`
2. Gates 4a, 4b, 4c: **0 violations**. Gate 4d within **≤ 100 files** and **largest file ≤ 20 MB**. Print all numbers.
3. **Red→green for every gate, paste each failure output, then restore**: insert `<img src="/x.png">` → 4a red; rename an emitted asset to `Logo.PNG` → 4b **and** 4c red; add a file named `_helper.js` → 4b red.
4. Playwright run: **0 responses with status ≥ 400 · 0 `requestfailed` · 0 console errors · 0 `pageerror`**. Record total requests and transferred bytes. Attach `subpath-rehearsal-1920x1080.png`.
5. `.nojekyll` present in the built listing — assert programmatically, print the assertion result.
6. Port 3013 verified free after teardown; state it explicitly.

**Explicitly rejected as evidence:** `file://` · the dev server · serving at the root path · "the screenshot looks fine" · "it worked on localhost" · a passing local run used as proof of case correctness.

**Out of scope:** service worker / PWA, the version string, the ZIP pack writer and reader, the publish recipe screen (phases D2/D3). Do not start them.

---

## What phase 1 collectively proves (state this in every report's conclusion)

1. The built bundle **serves correctly from the sub-path** `/nouf-game/` with relative paths and zero failed requests — the project's single most likely catastrophic failure, closed on day one.
2. **Event log + fold + undo** is sufficient as the one state model for a full question cycle, including returning the question to the unused pool.
3. **Two taps per question** is real, not aspirational.
4. The **type scale is measured, not asserted** — 76/60 stage-px at ×1.00 and ×1.30, contrast ≥ 7:1, fonts ≤ 120 KB.
5. `position === correctAnswers` holds visually and in the invariants — the maze is a scoreboard.

A user can open the served URL, press «ابدأ اللعبة», answer three hardcoded text questions on a 2-station track, and see a winner screen.
