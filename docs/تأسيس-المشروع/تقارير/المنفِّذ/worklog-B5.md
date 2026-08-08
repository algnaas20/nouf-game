# Worklog — WL-B5: authoring-first flow (D-25) + adversarial-review corrections F-1/F-3/F-4

**Executor** · **2026-08-08** · **Worktree** `../nouf-wl-b-stage` (branch `wl-b-stage`) · **Port 3011**

**Status: CLOSED.** Written incrementally per v3 §3/§4. An earlier session was interrupted mid-read of `src/stage/app.ts` (account limit, not a code issue) before any edit landed — nothing to recover; reads were simply redone. Do not commit — the coordinator commits.

## Assignment (merged, in the coordinator's stated priority order)

Original assignment: D-25 authoring-first flow — delete the bundled demo deck, make "no questions yet" a designed primary path, wire the readiness gate into starting a game, re-point verification fixtures.

Mid-task the coordinator forwarded `تقارير/المراجع/review-2026-08-08-release-v1.md` (**الحكم: إعادة**) and re-prioritized:
1. **F-1** (BLOCKER) — the authored deck never reaches `GameDriver`; the whole pack pipeline (export/save/import) was tree-shaken out of the shipped bundle because nothing called it. Also: pass real options to `mountEditor` so the backup/storage-full save buttons stop being dead.
2. **F-4** (MAJOR) — undo on the ending screen silently self-reverts after ~900ms (the decisive-auto timer re-arming); `persist()` clearing the session at `FINISHED` left no recovery from a wrong final answer.
3. **F-3** (MAJOR) — `team-setup.ts`'s refuse-band message substituted the just-refused `selectedN`, making a refused deck read as sufficient.
4. The rest of the original D-25 assignment (home screen, readiness gate wiring, re-pointing fixtures).

This worklog covers all of it under one continuous closing-claims list, in that order.

---

## Closing-claims list

| # | Claim | Status | Evidence |
|---|---|---|---|
| F1-1 | `mountApp` builds its deck from the author's `DraftStore` (real IndexedDB backend), never `buildDemoDeck()` (deleted) | **Done** | §1 |
| F1-2 | Media resolved through the existing `resolveMediaUrl` seam, backed by real blobs from the draft's media store | **Done, measured byte-identical** | §1, §3 |
| F1-3 | Proven live: author a question with a REAL image and a REAL audio clip through the actual editor UI, then see that exact media reachable from the stage | **Measured PASS** (`imageMatchesDraftStore: true`, `audioMatchesDraftStore: true`) | §3 |
| F1-4 | Proven live: import a pack (`applyImportedPackToDraft`, the real WL-D function, via a real `exportPack`→`importPack` round trip) → the imported questions become playable | **Measured PASS** (20/20) | §3 |
| F1-5 | `mountEditor` called with the real `store` + `onRequestBackup` (wired to WL-D's `saveBackupToDevice`) — the backup badge's save button now does something real | **Measured PASS, real `download` event** | §3 |
| F1-6 | Re-verified against the **built bundle**, reproducing the reviewer's own string-probe technique | **Measured — `questions.json`/`formatVersion`/`showSaveFilePicker` now present; `demo-*`/`buildDemoDeck` now 0** | §4 |
| F1-7 | Import/export UI reachability (a dedicated "صدّر للنشر" button, an import file-picker button) — disclosed, NOT built | **Explicitly out of my file ownership** | §6 |
| F4-1 | Undo on the ending screen does not self-revert — the decisive-auto timer does not re-arm on the render pass immediately following an undo | **Measured PASS + red→green** | §2 |
| F4-2 | A manual, explicit control (`متابعة`) replaces the suppressed timer for that one render pass — no new freeze introduced | **Measured PASS** | §2 |
| F4-3 | `persist()` no longer clears the session specifically because state is `FINISHED` | **Done; WL-A-owned limitation disclosed, not hidden** | §2 |
| F3-1 | Refuse-band message substitutes `maxGreenTrackLength(deckSize)`, never `selectedN` | **Measured PASS + red→green** | §5 |
| F3-2 | When even the smallest offered preset isn't green-achievable, the message says so honestly instead of naming an unofferable track length | **Done, measured** | §5 |
| T2-1 | Home screen: zero-question state is a designed primary path (composed Arabic copy, not an error), «أسئلتي» made the obvious next step | **Measured PASS, screenshot** | §5 |
| T3-1 | `team-setup.ts` "ابدأ" disabled when `deckBand(deckSize, selectedN) === 'refuse'`, reason shown in plain Arabic, using `deckBand`/`maxGreenTrackLength` from `src/core/rules/deck-bands.ts` (no hardcoded threshold) | **Measured PASS** | §5 |
| T3-2 | Deck too small for ANY preset (including 0) — start fully blocked, not just the selected preset; visibly disabled, not just inert | **Measured PASS** (real CSS defect found+fixed) | §5, §7 |
| N-1 | `autoplayAttemptedIds` cleared on `startNewGame` (reviewer note item 13) | **Implemented; not separately live-verified this session — disclosed** | §8 |
| T4-1 | `demo-deck.ts` / `placeholder-media.ts` deleted from `src/` | **Done** | §1 |
| T4-2 | Fixture deck + placeholder media relocated to `tests/stage/**`; verification scripts re-pointed | **Done for 6 of 7 scripts; `verify-b1.manual.cjs` explicitly NOT fixed — pre-existing staleness, disclosed** | §9 |
| — | Full project checks (tsc/vitest/build) green | **Confirmed, final run pasted** | §10 |

---

## 0. Pre-work

`git merge main`: clean fast-forward (brings in WL-D's D2+D3 — `src/pack/**`, PWA). `npm install`: up to date. Baseline `npx tsc --noEmit`: **0 errors** before any edit.

Read, in order: `docs/تأسيس-المشروع/{المهام,ملخص,سياق-المحادثة,خطة}.md`, `سجل-القرارات.md` (D-22/D-24/D-25/D-27/D-26), `تقارير/rtl-stage-ux-expert/{stage-ux-investigation,addendum-v2-ruling}.md` §5/§5A, `تقارير/المراجع/review-2026-08-08-release-v1.md` (the full adversarial review, الحكم: إعادة), and every file the review names (`src/stage/app.ts`, `src/core/legal.ts`, `src/stage/screens/team-setup.ts`, `src/pack/**`, `src/editor/app.ts`).

---

## 1. F-1 core — the deck that plays is the author's `DraftStore`

**`src/stage/app.ts`, rewritten.** `mountApp` stays a synchronous `void` function (its one caller, `src/main.ts`, never awaits it — unchanged, not touched); the one-time async work (`store.load()`, building the first deck) now runs inside an `initialize()` async IIFE, fired-and-forgotten the same way `renderEditorShell` already fires-and-forgets `mountEditor`.

- `const store: DraftStore = createDraftStore();` — the real `src/editor/draft-store.ts` (WL-C's, read/import only), backed by real IndexedDB.
- `refreshDeck()`: calls `buildPackFromDraft(store, GAME_TITLE)` — **WL-D's own `src/pack/from-draft.ts`**, the EXACT function `exportForPublishing`/`saveBackupToDevice` use to turn a draft into a `PackManifest`. Reusing it (not re-deriving the ready-question filter or media collection a second time) is the whole point: the deck that plays can never quietly drift from the deck that exports. Builds `deck: Question[]` from `manifest.questions` and a `Map<sha256, blobURL>` from `media`, revoking the previous batch of object URLs first (mirrors `stage-preview.ts`'s own one-URL-at-a-time discipline — no leak across repeated editor visits).
- `resolveMediaUrl(question)`: `question.media.kind === 'none' ? null : mediaUrlByHash.get(question.media.sha256) ?? null` — passed into `renderQuestionScreen` as the REAL resolver (previously never passed at all; the seam existed since PH-B4 but had no real body wired in — see worklog-B4.md's own §1 disclosure of this exact gap).
- Called once at cold start (before the resume-check), and again from the editor's `onBack` — **the author may have added/edited/deleted questions while inside «أسئلتي»**, so the deck (and `deckHash`, used both for `checkResume` and the next `GAME_STARTED`) is refreshed the moment he returns to the home screen, not left stale until a full page reload.
- `renderEditorShell` now takes `{ store, onRequestBackup, onBack }` and passes `store`/`onRequestBackup` straight through to `mountEditor(editorContainer, { store, onRequestBackup })` — closing the F-1 "dead button" defect (§3.3 below). `onRequestBackup: () => saveBackupToDevice(store, GAME_TITLE)` — `saveBackupToDevice` is WL-D's own `src/pack/save-to-device.ts`; its own doc comment names this exact call shape as its intended wiring point, never built until now (worklog-D2.md design decision 6, and the review's own F-1 correction #2).

**`src/stage/screens/question.ts`**: removed the `resolveDemoMediaUrl` import and fallback entirely. `resolveQuestionMediaUrl` now: absent resolver → `''`; resolver present, returns `string` → that string; resolver present, returns `null` → `''`. Absent and null-returning are now the SAME case (both are "no media resolved"), both routing to the screens' pre-existing truthful-failure copy via the empty-`src` → `error` event mechanism (verified in PH-B4, unchanged).

**Deletion**: `src/stage/session/demo-deck.ts` and `placeholder-media.ts` removed. Confirmed via `grep` (before deletion) that the only two references left in `src/` were doc-comment mentions in `src/editor/ui/stage-preview.ts` (WL-C-owned, not an import — flagged for WL-C in §6) and `src/stage/screens/question-image.ts` (WL-B-owned, fixed — the stale comment reworded).

`npx tsc --noEmit` after deletion: **0 errors.**

---

## 2. F-4 — undo on the ending screen no longer self-reverts

Two independent parts, both in files WL-B owns.

### 2a. `src/stage/screens/maze-beat.ts` — a fourth mode

`MazeBeatMode` gains `'decisive-manual'`, plus an optional `onConfirmDecisive?: () => void`. In `'decisive-manual'` mode the operator bar renders an explicit button, literal text **«متابعة»** (composed — reuses the app's existing generic "proceed" register, e.g. §4.7's «اضغط للمتابعة»; no Appendix أ literal exists for this exact moment, disclosed here) — no timer is armed for this mode at all.

### 2b. `src/stage/app.ts` — `suppressDecisiveAuto`

A closure flag, set to `true` at the top of **every** `onUndo` callback (question screen, maze-beat, ending screen) right before `driver.undo(); render();`. Read once at the very top of `render()` into a local `justUndone`, then reset to `false` immediately (consumed for exactly one render pass). In the `PROGRESSION_APPLIED` branch:

```ts
else if (isDecisiveEnding(candidates)) mode = justUndone ? 'decisive-manual' : 'decisive-auto';
```

`commitDecisive()` (the `findGameEnded` + `commit` + `render` sequence) is now a single named function, called from BOTH the 900ms `setTimeout` (normal forward path, unchanged) and the new manual button's `onConfirmDecisive` — one code path, cannot diverge.

**Red→green, pasted** (temporarily forced `mode = 'decisive-auto'` unconditionally, i.e. reverted the fix in place, restored after):

Isolated reproduction (`tests/stage/_debug-f4.manual.cjs`, throwaway, deleted after use, real Chromium, a real 25-question authored deck, a real played-to-completion game reaching an exhaustion-with-progress ending, real undo tap):

```
RED  (fix reverted):  right after undo: hasManualConfirm=false, hasEnding=false
                       after 1200ms wait:                        hasEnding=TRUE   <- self-reverted
GREEN (fix restored): right after undo: hasManualConfirm=true,  hasEnding=false
                       after 1200ms wait:                        hasEnding=false  <- still false, "متابعة" button present
```

Full trace, GREEN, from the standing `verify-b5.manual.cjs` (`results-b5.json`, `f4UndoNoSelfRevert`): polled every 400ms for 3000ms after the undo tap — `onEndingScreen: false` and `hasManualConfirm: true` at every single sample; `everSelfReverted: false`. `f4ManualConfirmWorks: true` — tapping «متابعة» DOES re-commit to the ending screen (the round-trip: suppression is real, not a permanent freeze).

**Which ending type a given playthrough reaches (decisive vs the three-button "سؤال من الحضور") depends on the run's random seed and is not controlled from the outside.** `verify-b5.manual.cjs` detects this after the undo tap (`.audience-decision-buttons` present) and records `notApplicableThisRun` rather than fabricating a claim about a code path that ending type never touches — the fix itself is proven deterministically by the isolated red→green reproduction above regardless.

### 2c. `src/stage/session/game-driver.ts` — `persist()` no longer special-cases `FINISHED`

Previously: `persist()` called `clearSession()` the instant `FINISHED` was reached, then a tap of «تراجُع» re-saved a shorter log, then the (buggy) auto-timer re-committed and `persist()` cleared it again — net result, per the review: "at the one moment a host most needs a safety net... there was no persisted record at all." Now `persist()` always `saveSession(this.events)`, `FINISHED` included — removing that delete→recreate→delete churn.

**Disclosed limitation, not silently claimed complete**: `checkResume()` (`src/core/session-store.ts:136`, **WL-A-owned, not this file**) still classifies a stored `FINISHED` log as `{ kind: 'none' }` — so a real page reload while sitting on the ending screen still will **not** resume back into it. That half of a full fix needs a WL-A change and is out of my file ownership; flagged here for the coordinator to route if a full reload-survives-the-winner-screen guarantee is wanted. What this change DOES deliver: the log is no longer actively destroyed while the host might still be mid-undo, and a fresh game's own first `GAME_STARTED` naturally overwrites the old one the moment a new game actually begins (no explicit `clearSession()` needed there either).

---

## 3. F-1 live proof — `tests/stage/verify-b5.manual.cjs` (new, the standing report for this phase)

Real Chromium, real IndexedDB, real file uploads, port 3011. Full JSON: `verify-out/results-b5.json`. Re-run three times during this session for stability (RNG-dependent ending type, see §2); all three green.

### 3.1 Author a REAL image + REAL audio question, through the REAL editor UI

- `#editor-add-question` → real `.question-text-input`/`.option-text-input` fills → `page.setInputFiles('.media-file-input', {mimeType:'image/png', buffer: <a real, valid, decodable 1×1 PNG>})` → the real `processMediaFile`/`processImageFile` pipeline runs → mark correct → submit. Same for a real, playable, synthesized WAV (mono/8kHz/16-bit PCM — decodes cleanly, exercising the real `validateAudioPlayability` load-test path).
- **Direct proof the exact same bytes reach the stage**: called the REAL `buildPackFromDraft` (not a reimplementation), built the object-URL map exactly as `app.ts`'s own `resolveMediaUrl` does, fetched the URL's bytes, and compared them **byte-for-byte** against `store.getMediaBlob(sha256)`'s own bytes:

```json
"authoredMediaReachesStage": {
  "found": true,
  "imgUrlIsRealBlob": true, "audUrlIsRealBlob": true,
  "imgBytesLength": 68, "audBytesLength": 24044,
  "imageMatchesDraftStore": true, "audioMatchesDraftStore": true,
  "imgPngSignatureOk": true, "audRiffSignatureOk": true
}
```

This is the real invariant the seam guarantees: what `resolveMediaUrl` hands to `<img>`/`<audio>` is byte-identical to what the author's own draft has stored — never a placeholder standing in.

### 3.2 `onRequestBackup` wiring — the backup badge's save button is no longer dead

`showSaveFilePicker` exists as a real `function` in headless Chromium but never resolves/rejects with no dialog surface to drive (confirmed directly: `typeof window.showSaveFilePicker === 'function'`) — a headless-testing environment gap, not a product defect (WL-D's own `tests/pack/live/**` already exercises the picker path with a real user). Overridden away via `page.addInitScript` so this script exercises the universal `<a download>` fallback instead — real code, real path:

```json
"backupButtonWired": { "gotDownloadEvent": true, "suggestedFilename": "nouf-20260808-155908.zip", "error": null }
```

### 3.3 A full live playthrough on the authored deck, to a real `FINISHED`

25 authored questions (`سؤال المؤلف الحي رقم N`), green band at N=6. Answers driven by real DOM clicks — tries each untried on-screen slot, undoes on a wrong reveal (the shuffled `optionOrder` is fixed for a question's whole life, including across undo — D-09.3), retries with a different slot, up to 4 tries per question (the RNG-shuffled correct slot is discovered live, never assumed).

```json
"livePlaythrough": { "steps": 210, "reachedEnding": true, "seenQuestionTexts": [ /* 25 distinct "سؤال المؤلف الحي رقم N" strings */ ] }
```

All 25 question texts seen are the author's own — none is a legacy demo-deck string (`ما عاصمة المملكة العربية السعودية؟` etc. do not appear anywhere; those files no longer exist). Screenshot `verify-out/b5-live-ending-screen.png` — a real winner screen, live authored content.

### 3.4 F-1 item 4 — import → play (a second "device")

Real `exportPack`/`importPack`/`applyImportedPackToDraft` (WL-D's, no reimplementation): one `DraftStore` authors 20 questions and exports a real ZIP `Blob`; `discardDraft()` wipes it (simulating a second device with nothing on it — confirmed `wipedCountWasZero: true`); `importPack(zipBlob)` + `applyImportedPackToDraft` write the imported questions back in; read back through the SAME `buildPackFromDraft` path `app.ts` itself uses:

```json
"importThenPlay": { "wipedCountWasZero": true, "importedQuestionCount": 20, "deckAfterImportCount": 20, "allTextsAreImportedOnes": true },
"importThenPlayHomeCount": "أسئلتك: 20"
```

The last line is read after a real `page.reload()` — `mountApp`'s own deck loader, not this script's direct calls, is what is being asserted against.

---

## 4. F1-6 — re-verified against the BUILT bundle, reviewer's own technique

`npm run build` → 0 gate violations. Reproduced the reviewer's exact string probe against `dist/assets/index-*.js`:

```
Bundle: index-j5mxx2ik.js
questions.json        => 1   (was 0 in the review)
.zip                   => 2   (was 0)
formatVersion          => 1   (was 0)
showSaveFilePicker     => 2   (was 0)
showOpenFilePicker     => 0   (still 0 — see §6, disclosed, not mine to build)
demo-image-            => 0
demo-text-             => 0
buildDemoDeck          => 0
resolveDemoMediaUrl    => 0
```
(`verify-out/bundle-string-probe.txt`)

Additionally ran a live smoke test against the SERVED built bundle (`vite preview --port 3012`, not the dev server): zero `pageerror`, zero `requestfailed`; opened the app cold, saw the zero-question home screen, authored one real question through the real editor UI, went back, home screen correctly showed «أسئلتك: 1». Confirms the fix works in production, not only under Vite's dev-server module graph.

---

## 5. F-3 + D-25 tasks 2/3 — `team-setup.ts` + `home.ts`

### 5.1 `team-setup.ts` — the refuse-band message and the readiness gate

`updateBandLine()`: green → clear message, confirm enabled. Warn → the existing D-09.13 literal, confirm enabled. **Refuse** → `const bestN = maxGreenTrackLength(p.deckSize)` (the already-exported function the review named, never re-derived): if `bestN >= smallestPreset (6)`, names that real, achievable track; if the deck is too small even for the shortest preset, an honest composed message ("لا تكفي بعد لأي مسار") instead of naming an unofferable number — **and `confirmBtn.disabled = true` in every refuse case.** Added a «→ الرئيسية» back button (same literal wording as the editor shell's own) so a blocked host has an explicit way back to «أسئلتي», not just a dead-end disabled control.

**Red→green, pasted** (temporarily restored the exact original bug — `selectedN` substituted, no disabling — reran, then restored the fix):

```
RED  (bug reproduced): {"bandLine":"أسئلتك 18 — تكفي لمسار 10 خطوات [RED-PROOF]","confirmDisabled":false}
GREEN (fix restored):  {"bandLine":"أسئلتك 18 — لا تكفي بعد لأي مسار. أضف المزيد من «أسئلتي».","confirmDisabled":true}
```

**Disclosed judgement call**: for D=18 at N=10, `maxGreenTrackLength(18) = 4`, which is BELOW the smallest offered preset (6) — so my code takes the "no track at all" branch rather than literally printing "تكفي لمسار 4 خطوات". This differs from the review's own illustrative "أسئلتك ١٨ — تكفي لمسار ٦ خطوات" (which corresponds to `preselectTrackLength`'s WARN-tier fallback, not the green-guaranteed `maxGreenTrackLength` the review explicitly named as "already exported and not used here"). I followed the review's explicit instruction (`maxGreenTrackLength`) rather than reverse-engineering the Appendix's illustrative number, and consider the result MORE honest (a green-guaranteed recommendation, or an honest "not enough for any track" rather than a WARN-tier number that could still run short) — but it is a real, disclosed deviation from the Appendix's specific worked example, not a hidden one.

### 5.2 `home.ts` — the zero-question path is a designed primary screen (D-25 task 2)

`HomeScreenParams` gains `questionCount: number`. `questionCount === 0`: «أسئلتي» becomes the visually dominant (`primary`) button, «ابدأ اللعبة» secondary, plus a composed guidance line: **«لا توجد أسئلة بعد — أضف أسئلتك من «أسئلتي» قبل أن تبدأ اللعبة.»** (composed — no Appendix أ literal covers this exact moment; disclosed, not presented as scripted). `questionCount > 0`: normal priority restored, plus a composed count line **«أسئلتك: N»** (partial answer to the review's F-1 item 3 "verify the publish worked" ask — the *count* half ships; the *title* half needs a per-pack title field that does not exist in `DraftMeta` yet, WL-C's schema, disclosed as out of scope here).

Measured, screenshot `verify-out/b5-zero-question-home.png`:
```json
{ "buttons": ["أسئلتي","ابدأ اللعبة","تراجُع","كيف أنشر لعبتي؟","إغلاق"],
  "guidance": "لا توجد أسئلة بعد — أضف أسئلتك من «أسئلتي» قبل أن تبدأ اللعبة.",
  "editorIsPrimary": true, "startIsPrimary": false }
```

I deliberately kept «ابدأ اللعبة» itself always CLICKABLE (never disabled at the home screen) — the single, authoritative gate is `team-setup.ts`'s "ابدأ" (§5.1), the actual point `startNewGame` is invoked from. Two independent gates duplicating the same threshold logic would drift; one gate, reached one screen later, is simpler and was judged sufficient (F-2's correction #4 only requires the game be impossible to *enter*, not that every upstream button be pre-emptively disabled).

---

## 6. What F-1's remaining correction items are NOT mine, and why (disclosed, not silently dropped)

The review's F-1 corrections span four owners. Mine: #1 (deck→game wiring) and the `app.ts` half of #2 (`onRequestBackup` at the `mountEditor` call site) — both done, §1/§3. **Not mine, not touched:**

- **#2's other half** ("give the export, save-to-device and import flows real, reachable UI") — a dedicated "صدّر للنشر" button/screen and an import file-picker button do not exist anywhere in the product yet. Building them means editing `src/editor/ui/**` (WL-C-owned) and/or `src/pack/ui/**` (WL-D-owned) — absolute file ownership forbids me from adding them myself. `showOpenFilePicker` measuring `0` in the bundle (§4) is the honest, current state of this gap.
- **#3** ("fix the publish recipe so every step refers to something that exists") — `src/pack/ui/publish-recipe.ts` is WL-D-owned.
- **The stale doc-comment in `src/editor/ui/stage-preview.ts`** referencing the now-deleted `src/stage/session/demo-deck.ts`'s "team-colour convention" — WL-C-owned file, flagged here rather than edited.

---

## 7. A real CSS defect found while screenshotting the new gate, fixed (WL-B-owned file)

`src/styles/stage.css` had **no `.op-button:disabled` rule at all** — a disabled button (the undo corner when `canUndo=false`, and now team-setup's refused "ابدأ") was pixel-identical to an enabled one. The first `b5-refuse-band.png` screenshot showed a crisp white "ابدأ" that LOOKED fully clickable while `disabled` silently blocked the tap — exactly the kind of silent dead-end the project's own constraint row 17 / §7.3 ("colour is never the only signal") argues against, now made materially worse by giving team-setup a real reason to disable its primary action. Added:

```css
.op-button:disabled { opacity: 0.4; cursor: not-allowed; }
```

Re-screenshotted (`b5-refuse-band.png`, `b5-zero-question-home.png`) — both now show the visibly muted state. Re-ran the full manual-script suite after this change: all still green (V13's size check measures width/height, unaffected by opacity).

---

## 8. Reviewer note item 13 — `autoplayAttemptedIds` reset on a new game

`src/stage/screens/question-audio.ts`: exported `resetAutoplayTracking()`, clearing the module-level `Set`. Called once at the top of `src/stage/app.ts#startNewGame`, before the new `GameDriver` is used — so the second game of an evening auto-plays its first audio question exactly like the first game did (previously: no audio question ever auto-played again after game 1, a real behaviour drift no test covered, per the review's note).

**Disclosed, not silently claimed verified**: implemented and code-reviewed, but not separately exercised in a dedicated live two-games-with-audio-in-both scenario this session (time-boxed out — `verify-b5.manual.cjs`'s deck is all-text for the playthrough scenario, and building a second scripted scenario specifically for this one-line reset was judged lower priority than the four items the coordinator explicitly ranked above it). A future pass should add exactly that scenario.

---

## 9. Re-pointing the existing verification scripts (D-25 task 4)

All manual scripts import questions/media via `Question`-shaped fixtures or a real seeded `DraftStore` — never the deleted demo deck. Moved (not just deleted): `tests/stage/fixtures/fixture-deck.ts` (renamed from `demo-deck.ts`, `buildFixtureDeck`/`resolveFixtureMediaUrl`) and `tests/stage/fixtures/placeholder-media.ts` (identical content, relocated) — test-only, never importable from `src/**` again.

| Script | Status | What changed |
|---|---|---|
| `verify-resolve-media-url.manual.cjs` | **Rewritten, green** | Branch 1 ("absent") re-aimed: was "falls back to demo", now "same truthful-failure outcome as branch 3" (no fallback resolver left to test) |
| `verify-pack.manual.cjs` | **Green** | `placeholder-media.ts` import path updated (3 sites); V24 now seeds a real 25-question deck before driving team-setup |
| `verify-b2.manual.cjs` | **Green** | `placeholder-media.ts` import path updated (3 sites); the one live-app scenario (`v1Recheck`) now seeds a deck first |
| `verify-b3.manual.cjs` | **Green** | New shared `seedDeckThenStartGame(page)` helper; all 3 live-app scenarios (V13, V12 screenshot, V24) updated |
| `verify-editor-entry.manual.cjs` | **Green** | Bare `text=أسئلتي`/`text=→ الرئيسية` scoped to `button:has-text` (a NEW instance of worklog-B4.md's own documented trap, tripped by this session's own new home-screen copy — see the protocol update below); now authors one real question before re-testing the game path, and asserts the readiness GATE instead of a stale "reached a question" claim |
| `verify-resume.manual.cjs` | **Green, all 5 scenarios** | `playToAQuestion` now seeds a real deck first |
| `verify-b5.manual.cjs` | **New — the standing report for this phase** | §§1–5 above |
| `verify-b1.manual.cjs` | **NOT fixed — pre-existing staleness, disclosed** | Fails at `.option-card` after `ابدأ اللعبة` — this script predates the `team-setup.ts` screen (PH-B1-era, written before PH-B2/B3 introduced team setup) and was **already broken before this phase**, for a reason unrelated to the demo-deck deletion. Its V1/V2/V3/V4/no-tell measurements are independently re-confirmed fresh by `verify-pack.manual.cjs`'s `v1Recheck`/`v3Recheck` and `verify-b2.manual.cjs`'s own re-checks — nothing it uniquely covered is unverified, but the script ITSELF was not repaired (out of this phase's scope; flagged for whoever next touches PH-B1's own history). |

**Protocol updates** (`docs/بروتوكولات/arabic-stage-screenshots.md`, v3 §8):
1. Corrected §12's claim that `localStorage`/IndexedDB is shared across `browser.newPage()` calls on the same `browser` — re-tested directly (a minimal two-page probe, both storage mediums) and found the OPPOSITE in this worktree's installed Playwright: **each `newPage()` is fully storage-isolated.** The paragraph is kept (not deleted) with a correction appended, per v3 §8 discipline — a future script author should re-measure with the same technique before trusting either claim, not assume.
2. New bullet: bare `text=` selectors are a whole-page substring match and have now caused this exact class of bug three times (worklog-B4.md §D.1, and twice in this session's own new copy) — every click in every `tests/stage/*.manual.cjs` script must scope to `button:has-text(...)`.

---

## 10. Full project checks (final)

- `npx tsc --noEmit`: **exit 0, 0 errors.**
- `npx vitest run`: **21 test files, 103 tests, all passed.**
- `npm run build`: **passes, 0 delivery-gate violations** (4a/4b/4c/4d/nojekyll), `dist/assets/index-*.js` 79.7 KB, total on-disk 137.3 KB.
- Manual Playwright drivers, all re-run to a clean exit code 0 in the final pass: `verify-resolve-media-url`, `verify-pack`, `verify-b2`, `verify-b3`, `verify-editor-entry`, `verify-resume`, `verify-b5` (`verify-out/rerun-*.log` + `results-*.json`). `verify-b1` intentionally not re-run to green — §9.
- Bundle string probe against the built bundle: §4.
- Port 3011 (the dev server used throughout): verified in use only by the one `npx vite --port 3011 --strictPort` process I started; stopped at session end and confirmed free (below).
- `git status --short`: only files this worklog names, plus this file itself and the new `tests/stage/fixtures/` directory — nothing outside WL-B ownership touched. **The one `خطة.md` v3 §2 exception**: no `PH-B5` row exists yet in `خطة.md`'s own phase table (this assignment came from the coordinator's live message + the adversarial review, both post-dating the plan's original phase list) — I did not invent one; flagged here for the coordinator/documenter to add if a standing row is wanted.

---

## Known limitations / disclosed, not hidden (this phase)

| # | Item | Detail |
|---|---|---|
| 1 | `checkResume()` still refuses to resume a stored `FINISHED` log | WL-A-owned (`src/core/session-store.ts:136`) — §2c. A real reload while on the winner screen does not yet resume back into it; the churn that made this worse (delete-recreate-delete) is fixed on WL-B's side regardless. |
| 2 | Export/save/import have no reachable UI beyond the backup badge's single button | §6 — `src/editor/ui/**` (WL-C) and `src/pack/ui/**` (WL-D), not mine to build. `showOpenFilePicker` measures 0 in the shipped bundle. |
| 3 | Home screen shows a question COUNT but not a pack TITLE | No `title` field exists in `DraftMeta`/`src/storage/idb.ts` (WL-C's schema) — §5.2. `GAME_TITLE = 'لعبة نوف'` is a placeholder constant in `app.ts`, disclosed as such, used only where `buildPackFromDraft`/`saveBackupToDevice` require a string. |
| 4 | `mountApp` is now async; a brief (dev-server-measured ~140ms, unbundled ES-module overhead — not separately re-timed against the production bundle beyond the qualitative smoke test in §4) gap exists between page load and the first paint, where nothing is shown | No loading indicator built for this gap — judged acceptable (a local IndexedDB open is fast; the production bundle is a single file, no per-module round trips) but not separately measured. |
| 5 | Reviewer note item 13 (autoplay reset) implemented but not separately live-verified | §8 |
| 6 | `verify-b1.manual.cjs` left broken | §9 — pre-existing, unrelated to this phase's changes, superseded by other scripts' equivalent measurements |
| 7 | F-3's exact number for D=18/N=10 (`4`) differs from the review's own illustrative Appendix-أ-style pairing (`6`) | §5.1 — a disclosed, deliberate interpretation of the review's explicit instruction, not an oversight |
| 8 | `src/editor/ui/stage-preview.ts`'s stale doc-comment reference to the now-deleted `demo-deck.ts` | WL-C-owned file, flagged not edited — §1 |

**Final status: all four coordinator-ranked items (F-1, F-4, F-3, plus the original D-25 tasks) measured PASS**, with every new guard proven red→green (F-4's timer suppression, F-3's message substitution), one real product CSS defect found and fixed along the way (disabled buttons were invisible as disabled), and every limitation that remains open stated explicitly rather than smoothed over.
