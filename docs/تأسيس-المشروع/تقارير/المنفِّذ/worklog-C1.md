# Worklog — PH-C1 (WL-C, draft store and question CRUD)

**Executor session** · 2026-08-07 · Worktree `nouf-wl-c-editor` · Branch `wl-c-editor` · Port **3012**

**Status: DONE.** All 7 numbered acceptance criteria from PROMPT C1
measured below, with pasted output. All new guards have a red→green
mutation proof. `tsc --noEmit` exit 0. Full unit suite green. Live-browser
scenario (real Chromium + real IndexedDB) green. Port 3012 verified free.
Not committed (coordinator commits).

---

## Discrepancies flagged (spec wins per task instructions)

1. **Port.** The dispatch message said my port is 3013. The authoritative
   spec (`executor-prompts-2026-08-07.md`, port table + PROMPT C1 header)
   assigns WL-C editor → `wt-editor` → **port 3012**, and 3013 is WL-D
   packaging's port. 3013 would have collided with WL-D's line, which is
   also running. I used **3012** throughout.
2. **Stage-preview import boundary.** The dispatch message asked me to
   "define the import boundary and stub behind it" for the stage
   question-preview component in this phase. The authoritative spec
   (PROMPT C1, "Out of scope") lists the stage preview as PH-C3's job, and
   خطة.md's ownership table says the same ("WL-C يستورده... في phase C3").
   I followed the spec: **no `src/stage/**` import anywhere in this
   phase's code**, no stub, nothing that risks a premature, wrong-shaped
   coupling to a component WL-B hasn't shipped yet.

---

## Files created (all within my ownership: `src/editor/**`,
`src/storage/idb.ts`, `tests/editor/**`)

| File | Purpose |
|---|---|
| `src/storage/idb.ts` | `DraftBackend` interface + `createIdbBackend()` — real IndexedDB, one transaction per question/meta write. `DraftQuestion` — my own draft-only shape (`correctIndex: OptionIndex \| null`), distinct from the frozen `Question` contract, which requires it non-null. Never requests persistent-storage permission, never reads a quota estimate. |
| `src/editor/format.ts` | One number/date formatting function (Western digits now — D-10 defers Arabic-Indic; one place to flip later). |
| `src/editor/copy.ts` | `AR_COPY` — literal strings from خطة.md Appendix أ and the C1 prompt, verbatim. |
| `src/editor/validate.ts` | `isQuestionReady`, `validateForPublish` (AC5). |
| `src/editor/draft-store.ts` | `DraftStore` — CRUD, reorder (▲/▼), delete-with-8s-undo, a **single, centralised** `QuotaExceededError` guard (`guardedWrite`) that every backend write goes through, return-prompt data (`hasDraft`). |
| `src/editor/ui/question-form.ts` | Add/edit form — 3 redundant correct-answer signals, `dir="auto"` text inputs. |
| `src/editor/ui/question-list.ts` | List — ▲/▼ buttons, delete-undo strip, «جاهز»/«غير جاهز» badge. |
| `src/editor/ui/storage-full-banner.ts` | The storage-full banner with the save button inside it (renamed from an earlier `quota-banner.ts` — see the grep-gate note below). |
| `src/editor/ui/return-prompt.ts` | Return-prompt banner (continue / start over / delete). |
| `src/editor/editor.css` | The one CSS rule needed to make "the whole row green with a ✓" a real, measured pixel fact, not just a class name (imported from `app.ts`; not a `src/styles/**` file, so no WL-B ownership conflict). |
| `src/editor/app.ts` | `mountEditor(container, options)` — the sole integration point for WL-B's `src/main.ts` to import later; never a mode toggle, never a router. |
| `tests/editor/support/fake-backend.ts` | Hand-written in-memory `DraftBackend` fake for fast unit tests (Node has no IndexedDB). |
| `tests/editor/validate.test.ts` | AC5. |
| `tests/editor/draft-store.test.ts` | AC1 (logic layer), AC6, AC7, AC2 (logic layer + a reorder-guard test). |
| `tests/editor/fixtures/editor-harness.html` | Test-only mount page — **not** `index.html` (WL-D-owned, untouched). |
| `tests/editor/live/persistence-and-quota.ts` | Real Chromium + real IndexedDB scenario for AC1 and AC2's literal "reload the page" / "screenshot" wording. |

Not created (deliberately, out of scope): anything under `src/media/**`
(PH-C2), anything importing `src/stage/**` (PH-C3), no `package.json` /
`vite.config.ts` / `index.html` change.

**One accidental touch, caught and reverted:** `npm approve-scripts`
(needed once, to let esbuild's postinstall run) wrote an `allowScripts`
block into `package.json`. I ran `git checkout -- package.json` to revert
it — confirmed by `git status` below showing no modification to that file
— and re-ran the full suite afterward to confirm nothing depended on it.

---

## Acceptance criteria — measured

### AC1 — 50 questions, reload, 50/50 in order

Two layers of evidence, both printed:

**Logic layer** (`tests/editor/draft-store.test.ts`, fake backend, a *second*
`DraftStore` instance reading the same backend — proves the read path is
derived from storage, not from anything held in memory):
```
AC1 (logic layer) — count after reload: 50
```
`expect(reloaded.getState().questions).toHaveLength(50)` +
`expect(texts).toEqual([...50 in order])` — both pass.

**Live browser** (`tests/editor/live/persistence-and-quota.ts` — real
Chromium via Playwright, real IndexedDB, a genuine `page.reload()`):
```
AC1 — questions present before reload: 50
AC1 — questions present after a REAL browser reload: 50
AC1 — order matches the order they were created in: true
AC1 PASSED — 50/50 present in original order after a real browser reload.
```

### AC2 — QuotaExceededError: Arabic message with the save button inside it, no silent drop

**Logic layer**: `store.addQuestion(...)` against a fake backend forced to
reject with `QuotaExceededError` on its next `putQuestion` returns
`{ ok: false, storageFullMessage: AR_COPY.draftStorageFull }`, the question
never entered `state.questions`, and the backend never received it either
(`await backend.listQuestions()` → length 0). Test passes.

**Live browser**, real Chromium, a real `putQuestion` call forced to reject:
```
AC2 — banner text: لم يعد هناك مكان للمسودة — احفظ لعبتك في الكمبيوتر الآن
AC2 — save button is inside the banner element: true
AC2 — question count unchanged after the failed write: 50 (expected 50 — the write was not silently dropped as a phantom success)
AC2 PASSED
```
Screenshot: `tests/editor/live/storage-full-banner-live.png` (shows the
Arabic message and «احفظ نسخة» button together inside `.storage-full-banner`).

**Beyond AC2's literal wording**, I found the guard only covered
`addQuestion`/`updateQuestion` at first — `moveUp`/`moveDown` and the
delete-commit path issued unguarded backend writes, which would have
rejected uncaught on a quota error mid-reorder. Fixed with a single
`guardedWrite<T>` every backend write goes through now (see the mutation
table below for its own red→green proof).

### AC3 — `grep -r "storage.persist" src/` → 0 matches

```
=== AC3: grep -r 'storage.persist' src/ ===
match count: 0
```
(One comment in `src/storage/idb.ts` originally spelled out the literal
API name and self-triggered this grep; reworded to describe the behaviour
without the literal substring, since the criterion is a literal grep, not
"no real calls".)

### AC4 — `grep -rn "quota" src/editor/` → 0 matches

```
=== AC4: grep -rn 'quota' src/editor/ ===
match count: 0
```
This required a real rename pass, not just careful new writing: my first
draft used `quotaMessage`, `renderQuotaBanner`, `.quota-banner` etc.
throughout — all matched. Renamed the whole concept to
`storageFullMessage` / `renderStorageFullBanner` / `.storage-full-banner`
everywhere in `src/editor/**` (including a file rename,
`quota-banner.ts` → `storage-full-banner.ts`). The only surviving
capitalised `QuotaExceededError` (the actual `DOMException.name`,
necessarily literal) does not match the lowercase grep pattern — verified
directly, see the table below. `src/storage/idb.ts` is outside the AC4
scope (only `src/editor/` is gated) and still says "quota" in comments
describing the DOM API, which is correct and intentional.

### AC5 — no correct option ⇒ never «جاهز», publish blocked, message names the question number

```
AC5 blockingMessages: [ 'السؤال 3 بلا إجابة صحيحة' ]
```
`validateForPublish` on a 3-question list where only #3 lacks a marked
correct option returns `{ ok: false, blockingMessages: ['السؤال 3 بلا
إجابة صحيحة'] }`; a fully-marked list returns `{ ok: true, blockingMessages: [] }`.
`isQuestionReady` independently drives the per-question «جاهز»/«غير جاهز»
badge in the list UI (also requires non-blank text and options — a
stricter, but non-contradictory, superset of AC5's specific correct-answer
gate; `validateForPublish`'s blocking messages stay scoped to exactly what
AC5 asks for). All 4 `isQuestionReady` tests and both `validateForPublish`
tests pass (see full test run below).

### AC6 — reorder with only ▲/▼, reload, order persists

```
AC6 order before: [
  'سؤال رقم 1', 'سؤال رقم 2', 'سؤال رقم 3', 'سؤال رقم 4', 'سؤال رقم 5',
  'سؤال رقم 6', 'سؤال رقم 7', 'سؤال رقم 8', 'سؤال رقم 9', 'سؤال رقم 10'
]
AC6 order after: [
  'سؤال رقم 10', 'سؤال رقم 1', 'سؤال رقم 2', 'سؤال رقم 3', 'سؤال رقم 4',
  'سؤال رقم 5', 'سؤال رقم 6', 'سؤال رقم 7', 'سؤال رقم 8', 'سؤال رقم 9'
]
```
10 questions, question #10 moved to the top with 9 calls to `moveUp` only
(never a direct order write, never drag), then read back through a *fresh*
`DraftStore` instance — the persisted order matches. No dedicated
drag-and-drop code exists at all (spec requires drag never be the *only*
way; not requiring it to exist).

### AC7 — delete → ~8s undo strip restores the exact question, including its media reference

Two tests:
- Undo at 7s (before the 8s window closes) restores the question,
  `media: { kind: 'image', sha256: 'aaa...', ext: 'jpg' }` deep-equal to
  the original, `pendingDeletion` cleared, and the backend was **never**
  touched (`backend.listQuestions()` length 1 the whole time — undo is
  pure in-memory).
- No undo, 8.001s elapses (`vi.advanceTimersByTimeAsync`) → the backend
  commits the delete (`backend.listQuestions()` length 0).

Both pass — see the full run below.

---

## Full unit test run (final, after every rename and refactor)

```
 Test Files  2 passed (2)
      Tests  12 passed (12)
   Duration  ~1.0s
```
12 = 4 (`isQuestionReady`) + 2 (`validateForPublish`) + 1 (AC1 logic) +
1 (AC6) + 2 (AC7) + 2 (AC2 logic, including the new reorder-guard test).

`npx tsc --noEmit` → exit 0, checked repeatedly through the session
including after every mutation restore below.

---

## Red→green mutation proofs (every one restored immediately after; suite
re-confirmed green each time)

| Guard mutated | Test that went red | Pasted failure |
|---|---|---|
| `isQuestionReady`: removed the `correctIndex === null` check | `isQuestionReady > is false when no option is marked correct` | `expected true to be false` |
| `validateForPublish`: removed the blocking-message push | `validateForPublish > blocks and names the question number...` | `expected true to be false` (`result.ok` defaulted `true`) |
| `undoDelete`: dropped the restore-to-list line | `AC7 > undo before 8s restores...` | `expected [] to have a length of 1 but got +0` |
| `commitPendingDeletion`: dropped the `backend.deleteQuestion` call | `AC7 > commits the deletion...` | `expected [ {...} ] to have a length of +0 but got 1` |
| `moveUp`: applied the reorder without waiting on `guardedWrite`'s result | `AC6 > moveUp/moveDown persist...` | `expected 'سؤال رقم 1' to be 'سؤال رقم 10'` |
| `guardedWrite`/`handleWriteError` path: swallowed `QuotaExceededError`, returned `{ok:true}` | `AC2 (logic layer) > surfaces the Arabic message...` | `expected { ok: true } to deeply equal { ok: false, ... }` |
| `moveUp`: applied the swap unconditionally, ignoring a quota failure | `AC2 > also guards reorder — a quota failure on moveUp leaves the order untouched...` | `expected [ 'سؤال رقم 2', 'سؤال رقم 1' ] to deeply equal [ 'سؤال رقم 1', 'سؤال رقم 2' ]` |

None of these assertions read back the same field the mutation corrupted
without an independent check: e.g. the AC7-undo test asserts both the
question count *and* the deep-equal media object *and* the backend's own
`listQuestions()` — three independent signals, not one field checked
against itself.

---

## Live browser evidence (real Chromium, real IndexedDB — the strongest
proof available for "reload the page")

`tests/editor/live/persistence-and-quota.ts`, run via
`npx tsx tests/editor/live/persistence-and-quota.ts`:
- Vite dev server started via its own JS API on **port 3012** (no child
  process, nothing to leak a PID for).
- A fresh, ephemeral Playwright browser context (no persistent profile) —
  every run starts with an empty IndexedDB, so the result is not an
  artefact of leftover data.
- Full console/pageerror listeners attached; zero errors observed.

```
AC1 — questions present before reload: 50
AC1 — questions present after a REAL browser reload: 50
AC1 — order matches the order they were created in: true
AC1 PASSED — 50/50 present in original order after a real browser reload.
AC2 — banner text: لم يعد هناك مكان للمسودة — احفظ لعبتك في الكمبيوتر الآن
AC2 — save button is inside the banner element: true
AC2 — question count unchanged after the failed write: 50 (expected 50 — the write was not silently dropped as a phantom success)
AC2 PASSED
AC2 screenshot saved: .../tests/editor/live/storage-full-banner-live.png
ALL LIVE SCENARIOS PASSED
```

Additionally verified (not a numbered AC, but the exact implementation
rule "the whole row green with a ✓"): `getComputedStyle` of `.option-row.is-correct`
→ `background-color: rgb(0, 158, 115)` (= `#009E73`), screenshot
`tests/editor/live/correct-row-green-check.png` shows the radio checked,
the green row, the ✓ and «الإجابة الصحيحة» together on one option.

Port check after every run:
```
PORT 3012 FREE (no LISTEN socket; only harmless TIME_WAIT residuals from closed connections)
```

---

## Other constraint checks

| Check | Result |
|---|---|
| `navigator.storage.persist` / `estimate(` anywhere in `src/` | 0 matches (grep) |
| `video\|mp4\|webm` anywhere in `src/editor/` | 0 matches — no video affordance, per D-23 |
| Standalone «محفوظ» or «آمن» for the draft anywhere in `AR_COPY` | 0 — only inside the comment *stating* the rule |
| `dir="auto"` on question text and all 4 option inputs | present (`question-form.ts`) |
| `category`/`difficulty` on `DraftQuestion` | present, unused, mirrors the frozen contract |
| `src/media/**` created | not created — PH-C2, correctly out of scope |
| `src/stage/**` imported | not imported — PH-C3, correctly out of scope |

---

## Notes for the next phases (not defects, just handed-off context)

- **PH-C2** will need to extend `DraftQuestion.media` writes into the same
  `guardedWrite` path in `draft-store.ts` when blob storage is added — the
  seam is there (`putQuestion` already carries the full `media` field).
- **PH-C3** owns the readiness *meter* (aggregate, deck-level, reading
  WL-A's step-count ranges) and the backup-state *chip* (3 states). This
  phase only built the per-question «جاهز»/«غير جاهز» badge, which AC5
  requires directly — the two are different UI elements, not overlapping
  work.
- **PH-D2** owns the actual ZIP writer for «احفظ نسخة». The button exists
  now, in the right place (inside the storage-full banner, and in the
  return-prompt is not wired since that's out of scope for the return
  banner), wired to an `onRequestBackup` callback `mountEditor` accepts —
  today it is `undefined` by default (button visible, clickable, does
  nothing) until PH-D2/D3 wiring supplies the real handler.

## Environment teardown

- No dev server left running; Vite's JS-API server and Playwright's
  browser were both explicitly closed in every script (`finally` blocks).
- Port 3012 confirmed free (no `LISTEN` socket) after the final run.
- `git status --porcelain` in the worktree shows only new files under my
  ownership (`src/editor/**`, `src/storage/**`, `tests/editor/**`) plus
  this worklog — `package.json` is clean (the accidental `allowScripts`
  write was reverted).
- Not committed — leaving that to the coordinator as instructed.
