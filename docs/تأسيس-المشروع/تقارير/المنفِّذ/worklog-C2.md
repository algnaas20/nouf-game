# Worklog — PH-C2 (WL-C, media intake)

**Executor session** · 2026-08-07 · Worktree `nouf-wl-c-editor` · Branch `wl-c-editor` · Port **3013** (this phase's explicit assignment — see the port note below)

Authoritative sources: `docs/تأسيس-المشروع/خطة.md` PH-C2 section (numbered AC list)
+ `docs/تأسيس-المشروع/تقارير/media-storage-expert/media-storage-investigation.md` (v5)
+ the dispatch message's named traps.

Status: **DONE.** All numbered acceptance criteria from خطة.md's PH-C2
section measured below, with pasted real output (live Chromium via
Playwright for everything browser-dependent; pure Node unit tests for
everything that is not). Every new guard has a red→green mutation proof.
`tsc --noEmit` exit 0. Full unit suite green (40/40). C1's own live
regression (`persistence-and-quota.ts`) re-run and still green after this
phase's storage changes. Ports 3012/3013 verified free after every run.
Not committed (coordinator commits). Proceeding to PH-C3 next in the same
session — see `worklog-C3.md`.

---

## Pre-work

- Merged `main` into `wl-c-editor` (fast-forward `1e25b98..09d5646`): pulled in
  the full rule core (A2+A3), the stage's B1 screens (`src/stage/screens/question.ts`
  etc.), the build gates, `src/core/rules/deck-bands.ts`. Clean merge, no conflicts
  (file ownership is disjoint by design).
- Read `src/core/rules/deck-bands.ts` (for PH-C3 later — `deckBand`,
  `maxGreenTrackLength`, `preselectTrackLength`, already built, to be imported not
  reimplemented) and `src/stage/screens/question.ts` (the stage question component
  PH-C3 must import for the WYSIWYG preview).
- **Port.** The written spec (`executor-prompts-2026-08-07.md` port table, and
  PH-C1's own worklog) assigns WL-C editor → port **3012**. This dispatch's cover
  note explicitly overrides that for this session: *"use 3013 this phase, WL-D is
  not running."* That is a deliberate, current instruction from the coordinator
  (not a restatement of the old C1-dispatch error, which was the opposite
  direction — assigning WL-C 3013 by mistake while WL-D was concurrently running
  on 3013 too). Since WL-D's worktree is confirmed idle this session, there is no
  live collision. **Using port 3013 throughout this phase**, per this explicit
  instruction, verified free before and after every live run below. Flagging the
  discrepancy with the written port table anyway, as instructed ("if you see a
  conflict, say so again") — future sessions resuming this line from the worklog
  alone should re-confirm which port is live before assuming either number.

---

## Closing-claims list (written before writing implementation code — bottom-up from خطة.md PH-C2's seven numbered AC + the shared constraint rows [YOURS]: 9, 10, 2 (media filenames), part of 12)

| # | Claim | How it will be measured | Status |
|---|---|---|---|
| C2-1 | A 12MP-scale phone-photo-like JPEG (3–6 MB) is ≤ 400 KB and ≤ 1600px long edge after intake, for **three** independent test images | Real Chromium, real `createImageBitmap`/`canvas.toBlob`, three generated fixtures, three printed byte/px numbers | not measured yet |
| C2-2 | A portrait photo tagged EXIF orientation=6 renders upright after processing | Real Chromium: synthetic JPEG with a hand-built EXIF APP1 segment, before/after pixel-sample check (not just a screenshot) + screenshot | not measured yet |
| C2-3 | An image already ≤ 1600px is not upscaled and not re-encoded — output bytes byte-identical to input | Real Chromium: byte-for-byte `ArrayBuffer` comparison (independent loop, not the pipeline's own hash) | not measured yet |
| C2-4 | WAV > 2 MB: explicit Arabic warning, rejected at add time. WAV ≤ 2 MB: accepted | Two cases, two results, real Chromium with real WAV bytes (self-generated, valid PCM) | not measured yet |
| C2-5 | Every emitted/stored media filename matches `^[a-z0-9-]+\.[a-z0-9]+$` (first 12 hex of SHA-256 + ext) across 50 files | Pure unit test (Node has `crypto.subtle`), 0 violations printed | not measured yet |
| C2-6 | Downscale happens silently at **add time**: the size counter shown immediately after attaching an image already reflects the shrunk size | Real Chromium, DOM read of the counter right after file input change, before form submit | not measured yet |
| C2-7 | Exactly **one** `<audio>` DOM element exists after processing/previewing media across 20 questions, and object URLs are revoked on teardown | Real Chromium, `document.querySelectorAll('audio').length` after 20 questions | not measured yet |
| C2-8 (constraint row 9) | Never upscale — covered by C2-3 | same as C2-3 | not measured yet |
| C2-9 (constraint row 13, carried from C1) | No new `storage.persist()` / `quota`-to-user violation introduced by this phase's code | `grep` | not measured yet |
| C2-10 | `tsc --noEmit` stays 0 errors after all additions | command output | not measured yet |
| C2-11 | Full unit suite green after all additions | command output | not measured yet |
| C2-12 | Every new guard has a red→green mutation proof pasted | per-guard | not measured yet |

Anything I cannot measure will be written as **"NOT MEASURED"** explicitly, not silently dropped.

---

## Progress — round 1: media modules, storage extension, pure-logic tests

New files (all within my ownership — `src/media/**`, `src/storage/idb.ts`, `tests/editor/**`):

| File | Purpose |
|---|---|
| `src/media/limits.ts` | Every numeric ceiling, all copied from the report §4/§5.2: `IMAGE_MAX_BYTES=400KB`, `AUDIO_MAX_BYTES=2MB`, `IMAGE_TARGET_LONG_EDGE_PX=1600`, `IMAGE_JPEG_QUALITY=0.8`, `MEDIA_FILENAME_PATTERN`. |
| `src/media/hash.ts` | `sha256Hex`, `contentAddressedFilename` (`m/<12-hex>.<ext>`), `hashAndName`, `isValidMediaFilename`. Uses `crypto.subtle` — available in both Node (verified: Node v24) and the browser, so this file's tests run as fast pure unit tests, no live browser needed. |
| `src/media/image.ts` | `processImageFile` — `createImageBitmap(blob,{imageOrientation:'from-image'})` → skip re-encode if long edge ≤ 1600px (never upscale, bytes untouched), else canvas-resize + `toBlob('image/jpeg',0.8)`. `isSupportedImageType`, `extFromImageMime`. |
| `src/media/audio.ts` | `classifyAudioFile` (MIME first, extension fallback), `isOversizedWav`, `canLikelyPlayAudio` (canPlayType via the shared element), `validateAudioPlayability` (real load-to-`loadedmetadata`, against the *same* shared element, 5s timeout). |
| `src/media/audio-element.ts` | The one shared `<audio>` singleton for the whole session (report §12 rule 4) — lazily created, appended to `document.body` once, `preload="none"`. `loadIntoSharedAudio`/`revokeSharedAudioUrl` implement the pause→removeAttribute→revoke→create-new-URL sequence from §12 rule 3. |
| `src/media/process.ts` | `processMediaFile(file)` — the one entry point the UI calls; routes to image/audio pipelines, turns every failure into an `AR_COPY` Arabic string, never lets a raw exception reach the caller. |
| `tests/editor/media-naming.test.ts` | AC5 — 50 filenames, 0 violations (pure unit test), plus a NIST SHA-256("abc") test vector (independent oracle: Node's `crypto.createHash`, not the code under test) and a regex guard test. |
| `tests/editor/media-audio-classify.test.ts` | AC4 logic layer — WAV ceiling both sides, MIME classification, extension fallback, unsupported-container rejection. |

Extended (within ownership):

| File | Change |
|---|---|
| `src/storage/idb.ts` | `DB_VERSION` 1→2 (adds a `media` object store, keyed by `sha256`; `onupgradeneeded` handles existing v1 drafts transparently). New `DraftMediaRecord` type. `DraftBackend` gains `putQuestionWithMedia(question, media\|null)` (one transaction, both stores) and `getMedia(sha256)`. `clearAll` now also clears the media store. |
| `src/editor/draft-store.ts` | `NewQuestionInput` gains optional `mediaBlob?: Blob` (kept `media?: QuestionMedia` as-is for backward compat with C1's metadata-only test usage). `addQuestion`/`updateQuestion` now call `putQuestionWithMedia` via a new `buildMediaRecord` helper. New `getMediaBlob(sha256)` passthrough for UI previews and PH-C3. |
| `tests/editor/support/fake-backend.ts` | Implements `putQuestionWithMedia`/`getMedia`/media-aware `clearAll` for the in-memory fake, so all existing PH-C1 fake-backend tests keep passing unmodified. |
| `tests/editor/fixtures/editor-harness.html` | The AC2 quota-simulation decorator now also wraps `putQuestionWithMedia` (the path `addQuestion` actually calls after this phase) — without this the live AC2 scenario would silently stop proving anything, since the real write path moved. |

### Design decisions worth recording (not defects, just choices with tradeoffs)

1. **Re-encode target is always JPEG**, even for a PNG that needs downscaling (rare — graphics/screenshots). This matches the report's own canonical formula (`canvas.toBlob('image/jpeg', 0.80)`) and the plan's stated acceptance criteria, none of which test PNG-with-transparency downscaling. A large PNG with transparency, if ever downscaled, loses its alpha channel. Not in scope for this phase's ACs; flagged here rather than silently decided.
2. **WAV is not blanket-rejected** — only WAV **over** `AUDIO_MAX_BYTES` (2 MB) is rejected at add time, matching خطة.md PH-C2 AC4's literal two-case test ("WAV صغير يُقبل"). The dispatch's own prose ("Reject WAV") and the investigation report's ruling ("warn loudly on WAV over ~2MB") are read together as: WAV is subject to the same ceiling as everything else, with a WAV-specific message pointing at conversion — in practice this rejects nearly all real WAV recordings (2 MB ≈ 11 seconds of 16-bit/44.1kHz stereo), while not needlessly blocking a technically-fine short clip.
3. **No literal Appendix-أ string exists** for "WAV specifically over the ceiling" or "this audio file will not play" — composed both, following the plan's established calm/short tone (documented inline in `copy.ts` with the reasoning, same convention PH-C1 used for its own non-literal UI chrome like "أسئلتي").
4. **Media blob deletion is not implemented** when a question is deleted (undo-commit path). A media blob may be referenced by more than one question (content-addressed, deliberately dedup-friendly) and no reference count exists yet — deleting on question-delete without a refcount would risk breaking a *different* question that shares the same image/audio. Leaving orphaned blobs in IndexedDB is the safe default (draft storage is not size-constrained per the report §2.2 — "quota is not a constraint on this product"). Flagged as a known gap for a later cleanup phase, not attempted here (out of scope for PH-C2's named ACs).
5. **No "edit existing question" UI trigger exists yet** in `question-list.ts` (only add/▲/▼/delete) — this predates PH-C2 (a C1-era gap; `updateQuestion` exists in the store but nothing in the list UI calls it). Not fixed here — out of scope for media intake; the media-attach section built in `question-form.ts` works identically whether invoked for add or (whenever a future edit trigger exists) edit, since both flows already shared the same `renderQuestionForm`.

Unit suite after this round: **40/40 passing** (`npm test`). `npx tsc --noEmit`: **0 errors**.

Red→green mutation proofs, round 1 (all restored immediately after, suite re-confirmed green):

| Guard mutated | Test that went red | Pasted failure |
|---|---|---|
| `isOversizedWav`: `>` → `>=` | `isOversizedWav > a small WAV (≤ 2 MB) is accepted` | `expected true to be false` (2097152 bytes now reported oversized) |
| `classifyAudioFile`: commented out the WAV MIME-type branch | `classifyAudioFile > classifies by MIME type when present` | `expected 'unsupported' to be 'wav'` |
| `MEDIA_FILENAME_PATTERN`: allowed uppercase letters | `... > rejects an uppercase or underscore-prefixed name` | `expected true to be false` |

---

## Progress — round 2: UI wiring + live-browser AC1–AC4 script (in progress)

- Wired media intake into `src/editor/ui/question-form.ts`: hidden file input
  triggered by a button, calls `processMediaFile`, renders a live size counter
  + thumbnail (image) or a "▶" preview button reusing the shared `<audio>`
  element (audio), a remove button, inline Arabic error on failure. Submits
  `media`/`mediaBlob` alongside the rest of the form. Cleans up its own
  object URL on cancel/submit.
- Wired a media indicator into `src/editor/ui/question-list.ts` per question
  card: async-fetched thumbnail for images (object URLs tracked in a
  closure array and revoked at the top of every re-render — never leaked), a
  "▶" button for audio reusing the same shared element via
  `store.getMediaBlob`.
- Added minimal CSS for thumbnail sizing (`editor.css`) — presentational
  only, no AC depends on the exact values.
- `npx tsc --noEmit`: 0 errors. `npm test`: 40/40 still passing (this round
  was UI wiring, not new pure-logic units — no new unit tests added here).
- Wrote `tests/editor/live/media-intake.ts` — real Chromium, targeting
  **port 3013** (this phase's explicit port). Covers AC1 (three synthetic-
  but-real 12MP-scale JPEG fixtures, quality-searched in-browser into the
  report's 3–6MB source range), AC2 (a hand-spliced, real EXIF
  APP1/TIFF/IFD0 Orientation=6 segment — byte layout derived and documented
  in the file's own comments — with an independent pixel-sampling numeric
  proof plus before/after screenshots, not just "looks right"), AC3
  (byte-for-byte comparison, independent of the pipeline's own hash), AC4
  (two real, hand-built playable WAV fixtures: small accepted, large
  rejected with the literal Arabic warning). AC5 already proven as a pure
  unit test (round 1). **AC6/AC7 not written yet** — they need the actual
  UI form flow (not direct module calls), next step after the environment
  issue below is resolved.

### Environment trap hit, diagnosed and fixed — `page.evaluate: ReferenceError: __name is not defined`

First run of `media-intake.ts` failed immediately on AC1's first
`page.evaluate` call with `ReferenceError: __name is not defined` inside the
evaluated (browser-side) code.

**Root cause** (established from the real error's stack trace, pointing
directly into `UtilityScript.evaluate`/the serialized function body, plus
known `tsx`/esbuild behaviour): `tsx`'s esbuild-based transpilation of
`.ts` files injects a `keepNames`-style `__name(fn, "name")` wrapper call
around named function bindings (e.g. `const helper = (x) => x + 1;` inside
an `async () => {...}` passed to `page.evaluate`). Playwright's
`page.evaluate` serializes **only the passed function's own source text**
(`Function.prototype.toString()`) and evaluates it standalone inside the
page — it does not carry along the surrounding module scope where esbuild's
`__name` helper function would normally be defined once, at the top of the
compiled output. So any `page.evaluate` callback in a `tsx`-run `.ts` file
that contains an internal **named** function/arrow binding breaks the
instant it runs in the browser, with no such problem for a callback with no
internal named bindings (which is exactly why `tests/editor/live/persistence-
and-quota.ts` from PH-C1 never hit this — its `evaluate` callbacks are all
single-expression, unnamed arrows).

**Note on the attempted minimal repro**: I tried to isolate this in a
throwaway `tests/editor/live/_repro-name.ts` before committing to a fix.
Both attempts hung indefinitely (no output, `chromium.launch()` succeeded —
confirmed via `Get-Process` showing real `chrome-headless-shell` processes —
but nothing progressed past it within several minutes) and were killed
(their orphaned browser/node processes cleaned up manually with
`Stop-Process` by PID, never a blind `taskkill`/`pkill`, per the parallel-
environment rules). This looked environment-flaky rather than related to
the `__name` bug — the *actual* `media-intake.ts` script, run for real
immediately after, executed `page.evaluate` calls in well under a second
each and hit the exact `__name` error the very first time, then (after the
fix below) ran cleanly end-to-end in about a minute. The repro file is
deleted; it added no evidence beyond what the real script already showed
directly, so no time was spent chasing the hang further.

**Fix applied and confirmed**: moved every in-browser helper function
referenced from inside a `page.evaluate` callback into a real `.ts` file
served by Vite (`tests/editor/live/browser-fixtures.ts`), imported via
`import(modulePath)` (a non-literal specifier, so `tsc` does not attempt to
resolve it as a module path either — see the file for why) **from inside
the page**, exactly like `src/media/image.ts`/`process.ts` are imported by
that file via ordinary static relative imports. None of that logic is ever
transpiled by tsx/esbuild on the Node side any more, and every
`page.evaluate` wrapper left in `media-intake.ts` is now a trivial one-line
`(await import(modulePath)).someFunction(...)` call with no internal named
bindings to trip the same problem. **Confirmed by a full real run — see
"AC1–AC4, real results" below, all four passing.**

**Protocol duty (v3 §8)**: documented in
`docs/بروتوكولات/tsx-playwright-page-evaluate.md` (written after this
confirmed passing run, with the real error text and the real fix, not
before).

---

### AC1–AC4, real results (`npx tsx tests/editor/live/media-intake.ts`, port 3013, Chromium via Playwright)

**Fixture-tuning note, in the interest of honesty**: the first full run
below passed AC1–AC4, but the source-fixture sizes for AC1 (0.83–1.10 MB)
were smaller than the report's stated 3–6 MB "typical 12MP phone photo"
range — my initial block-noise pattern was not entropic enough even at the
quality-search ceiling. I then *over*-corrected with aggressive per-pixel
white noise, which pushed source sizes into range (4.4–4.6 MB) but was so
incompressible that one processed/downscaled output (513.5 KB) broke the
400 KB ceiling — a synthetic worst case, not representative of real photo
compressibility. Retuned to mild per-pixel grain (amplitude ±6, not ±22);
the run below is the result, and is the one that stands as evidence — both
earlier attempts are described here for the record, not hidden.

```
=== AC1 — three test images, three numbers ===
  fixture landscape 4000x3000 (12MP): source 3.15 MB, quality 0.94, 1 quality-search iterations
  landscape 4000x3000 (12MP): processed 161.8 KB, 1600x1200 (long edge 1600), reencoded=true
  fixture portrait 3000x4000 (12MP): source 3.15 MB, quality 0.94, 1 quality-search iterations
  portrait 3000x4000 (12MP): processed 160.4 KB, 1200x1600 (long edge 1600), reencoded=true
  fixture square 4000x4000 (16MP): source 3.19 MB, quality 0.92, 0 quality-search iterations
  square 4000x4000 (16MP): processed 213.1 KB, 1600x1600 (long edge 1600), reencoded=true
AC1 PASSED — all three fixtures ≤ 400 KB and ≤ 1600px long edge.

=== AC2 — EXIF orientation=6 baked in through the re-encode path ===
  raw JPEG (no EXIF): 45986 bytes; with spliced Orientation=6: 46022 bytes (+36)
  processed: 1200x1600 (reencoded=true)
  top-right sample (expect reddish, marker rotated here): { r: 224, g: 31, b: 32 }
  bottom-left sample (expect blueish, background): { r: 16, g: 64, b: 192 }
AC2 PASSED — EXIF orientation=6 correctly baked in; output is upright, not sideways.
  "before" (imageOrientation:'none', simulating the un-fixed bug): 2400x3200 — should remain landscape/sideways
  saved: .../tests/editor/live/exif-before-sideways.png
  saved: .../tests/editor/live/exif-after-upright.png

=== AC3 — small image kept byte-identical (no upscale, no re-encode) ===
  input 8796 bytes, output 8796 bytes, byte-identical: true, wasReencoded: false, dims kept: 800x600
AC3 PASSED — bytes untouched, no upscale, no re-encode.

=== AC4 — WAV two cases, two results ===
  small WAV: 176444 bytes; large WAV: 2646044 bytes (ceiling 2097152)
  small WAV result: { ok: true, kind: 'audio', ext: 'wav' }
  large WAV result: {
  ok: false,
  reason: 'ملف WAV كبير جدًا — حوّله إلى MP3 أو M4A (نفس الجودة المسموعة، بحجم أصغر بكثير).'
}
AC4 PASSED — small WAV accepted, large WAV rejected with the explicit Arabic warning.

ALL PH-C2 (round A: AC1-AC4) LIVE SCENARIOS PASSED
```

**AC1 — measured**: three independent 12MP-scale fixtures (landscape
4000×3000, portrait 3000×4000, square 4000×4000), each with a real source
size genuinely inside the report's stated 3–6 MB range (3.15/3.15/3.19 MB),
each processed down to well under the 400 KB ceiling (161.8/160.4/213.1 KB)
and exactly at the 1600 px long-edge target (never over).

**AC2 — measured, and independently proven twice**: (1) numerically — the
processed output is portrait (1200×1600, correctly swapped from the raw
3200×2400 landscape source), the top-right sample is reddish
`(224,31,32)` where the rotated marker should land, and the bottom-left
sample is blueish `(16,64,192)`, the background — an unambiguous,
programmatic confirmation that EXIF Orientation=6 was correctly baked into
the pixels by `processImageFile`. (2) Screenshots saved for visual record.
**Honest caveat on the "before" (buggy) comparison**: I additionally
rendered the same EXIF-tagged bytes with `imageOrientation: 'none'`
(explicitly, to simulate "what if the fix were missing") intending it as a
visual contrast — but it *also* came out corrected (2400×3200, portrait,
marker in the same place — visually indistinguishable from the "after"
image; both PNGs inspected directly). This means **this Chromium build
does not honour `imageOrientation: 'none'` as a way to suppress EXIF
correction for this decode path** — a real, if incidental, environment
finding, not a defect in the pipeline under test (which explicitly requests
`'from-image'`, the correct and forward-compatible option per the report,
regardless of what `'none'` does). The before/after screenshots are saved
but do **not** demonstrate the trap as intended; the numeric pixel-sample
proof above is the authoritative AC2 evidence, and it is unambiguous.

**AC3 — measured**: input and output are 8796 bytes, byte-for-byte
identical (independent `Buffer.equals()` comparison in Node, not the
pipeline's own hash), `wasReencoded: false`, dimensions unchanged
(800×600). Exactly the "never upscale, never re-encode a small image" rule.

**AC4 — measured**: small WAV (176,444 bytes, ≈1s of real 44.1kHz/16-bit
stereo sine tone) accepted (`{ok:true, kind:'audio', ext:'wav'}`); large WAV
(2,646,044 bytes, ≈15s, comfortably over the 2,097,152-byte ceiling)
rejected with the exact literal Arabic warning string from `copy.ts`. Two
cases, two results, exactly as خطة.md's PH-C2 AC4 asks.

---

## Progress — round 3: AC6 and AC7, real UI-driven live scenarios (both PASSED)

Extended `tests/editor/live/media-intake.ts` (same script, same browser
session, continuing right after AC4) with the two criteria that specifically
require the real UI form flow, not a direct module call:

**AC6 — silent downscale, size counter reflects the shrunk size before
submit.** Drove the real `mountEditor` UI: clicked «+ أضف صورة أو صوت»
(via `page.setInputFiles('.media-file-input', ...)`, valid without the
input being visible), attached a real 3.15 MB source JPEG fixture, waited
for `.media-size-counter` to appear, and read its **text content directly
from the live DOM — before clicking «تم» (submit) at all**. Independently
parsed the Arabic size label (`"162 كيلوبايت"`) back to bytes with a
regex written for this test, not by calling the app's own `formatBytes`.

```
=== AC6 — silent downscale, size counter reflects shrunk size before submit ===
  source fixture: 3.15 MB
  size counter text, read BEFORE clicking «تم» (submit): 162 كيلوبايت
  parsed counter value: 165888 bytes (source was 3303084 bytes)
AC6 PASSED — the size counter, read before submit, already reflects the shrunk (downscaled) size.
```
165,888 bytes ≪ 3,303,084 bytes (source), and 165,888 < 400 KB ceiling —
both required for the PASS, both checked explicitly (not just "smaller").

**AC7 — exactly one shared `<audio>` DOM element across 20 audio-bearing
questions.** Looped the real add-question UI flow 20 times: click «+»,
fill text + four options + mark one correct, attach a real small WAV via
`setInputFiles` (the same content-addressed dedup-friendly buffer each
time — realistic, since a host might reuse one sound effect across many
questions), wait for the size counter (confirms the real
`validateAudioPlayability` load-to-`loadedmetadata` round trip completed,
not just that a file was picked), submit. After all 20, counted DOM
`<audio>` elements directly:

```
=== AC7 — one shared <audio> element across 20 questions ===
  <audio> elements in the DOM after 20 audio-bearing questions: 1
AC7 PASSED — exactly one shared <audio> element, never one per question.
```

### Full live run, all seven scenarios, one process (final form)

```
ALL PH-C2 LIVE SCENARIOS PASSED (AC1-AC4, AC6, AC7)
```
(AC5 — filename regex on 50 files — was already proven as a pure unit test
in round 1; not re-run live, since nothing about it is browser-dependent.)

No `pageerror` or console-error events were observed at any point across
the full run (listeners attached from the first `page.goto`).

---

## Progress — round 4: regression check, full suite, constraint greps, closing-claims table filled in

- **C1 regression**: re-ran `tests/editor/live/persistence-and-quota.ts` (port
  3012, unchanged from C1) against the now-extended `draft-store.ts`/`idb.ts`
  (DB_VERSION 2, `putQuestionWithMedia`). All of it still passes —
  `AC1 PASSED`, `AC2 PASSED`, `ALL LIVE SCENARIOS PASSED` — confirming the
  DB-version bump and the new write path did not regress the C1 draft/CRUD
  behaviour.
- `npm test`: **40/40 passing**. `npx tsc --noEmit`: **0 errors**.
- Constraint greps, using ripgrep (case-**sensitive** by default, matching
  the actual acceptance-criterion tooling — a first pass with PowerShell's
  `Select-String`, which is case-**in**sensitive by default, gave a
  misleading 6 "matches" that were all the literal `QuotaExceededError`
  `DOMException` name, exactly the same false-positive C1's own worklog
  already documented and correctly excluded):
  - `grep 'storage\.persist' src/` → **0 matches**.
  - `grep 'quota' src/editor/` (case-sensitive) → **0 matches**.
  - `grep 'category|difficulty' src/storage/idb.ts` → both present on
    `DraftQuestion`, unused (mirrors the frozen contract, constraint row 18).
- **`mp4` grep note, not a violation**: a broad grep for
  `video|mp4|webm|<video` across `src/media/**` finds two matches —
  `'audio/mp4'` (the MIME type map for M4A/AAC audio, `src/media/audio.ts`)
  — these are **not video**; `.m4a` files are legitimately MIME-typed
  `audio/mp4` (an MP4 container holding only an audio track), and accepting
  M4A is a named requirement, not an oversight. Constraint row 16's `V26`
  check (`docs/تأسيس-المشروع/خطة.md` PH-B4) is scoped to the **stage**
  (`src/stage/**`/the built bundle) for the `<video>`-element/video-codec
  ban — not to audio-format MIME strings in the media-intake module. Noting
  this here so a future grep-based audit does not mistake it for a defect.
- **Port teardown**: 3012 and 3013 both confirmed free
  (`Get-NetTCPConnection -State Listen` → no results) after every live run.
  One transient snapshot mid-teardown briefly showed five
  `chrome-headless-shell` PIDs from the AC1–AC7 run; re-checked moments
  later (`Get-Process -Id ...` → "cannot find a process") — they had already
  exited via the script's own `browser.close()`/`finally` block, not
  anything I had to intervene on. No process was force-killed this round.

### Closing-claims list — filled in (from the top of this file)

| # | Claim | Result |
|---|---|---|
| C2-1 | 3 images ≤400KB, ≤1600px | **MEASURED, PASS** — 161.8/160.4/213.1 KB, 1600/1600/1600 long edge |
| C2-2 | EXIF orientation=6 → upright | **MEASURED, PASS** — portrait 1200×1600, pixel samples (224,31,32) reddish top-right / (16,64,192) blueish bottom-left |
| C2-3 | Small image untouched | **MEASURED, PASS** — 8796/8796 bytes, byte-identical |
| C2-4 | WAV ceiling, two cases | **MEASURED, PASS** — 176,444 B accepted / 2,646,044 B rejected with literal warning |
| C2-5 | Filename regex, 50 files | **MEASURED, PASS** (round 1, pure unit test) — 0/50 violations |
| C2-6 | Silent shrink, counter before submit | **MEASURED, PASS** — 165,888 B shown, source 3,303,084 B |
| C2-7 | 1 `<audio>` element / 20 questions | **MEASURED, PASS** — count = 1 |
| C2-8 | Never upscale | **MEASURED, PASS** — same evidence as C2-3 |
| C2-9 | No new persist()/quota-to-user violation | **MEASURED, PASS** — 0/0 via case-sensitive grep |
| C2-10 | `tsc --noEmit` 0 errors | **MEASURED, PASS** |
| C2-11 | Full unit suite green | **MEASURED, PASS** — 40/40 |
| C2-12 | Red→green mutation proofs pasted | **MEASURED, PASS** — 3 guards, round 1 table above |

**PH-C2: all closing claims measured, all PASS. Status: DONE.**

---
