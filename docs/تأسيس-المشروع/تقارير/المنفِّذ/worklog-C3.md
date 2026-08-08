# Worklog — PH-C3 (WL-C, preview, readiness, backup badge)

**Executor session** · 2026-08-08 · Worktree `nouf-wl-c-editor` · Branch `wl-c-editor` · Port **3013** (this phase's explicit assignment, per the dispatch — see worklog-C2.md's port note; same reasoning carries into this phase, same session).

Authoritative sources: `docs/تأسيس-المشروع/خطة.md` PH-C3 section (numbered AC list) + the dispatch message's four named deliverables (stage-preview import boundary, readiness meter importing `deck-bands.ts`, backup badge boundary, 100-files-per-batch warning).

Status: **DONE.** All numbered acceptance criteria from خطة.md's PH-C3
section measured below, with pasted real output (live Chromium via
Playwright for everything DOM-dependent; pure Node unit tests + grep for
everything that is not). Every new guard has a red→green mutation proof.
`tsc --noEmit` exit 0. Full unit suite green (55/55). Both PH-C1 and PH-C2
live regressions re-run and still green after this phase's changes to
`app.ts`/`editor-harness.html`. Ports 3012/3013 verified free after every
run. Not committed (coordinator commits). This closes WL-C's PH-C1/C2/C3
run for this session.

---

## Closing-claims list (written before implementation)

| # | Claim | How it will be measured | Status |
|---|---|---|---|
| C3-1 | «معاينة كما يراها الجميع» imports the real stage question component (`src/stage/screens/question.ts`'s `renderQuestionScreen`), zero duplicated rendering logic in `src/editor/` | `grep` proves the import; `grep`/manual inspection proves no second implementation of option-card/reveal rendering exists under `src/editor/` | not measured yet |
| C3-2 | The readiness meter's thresholds come from `src/core/rules/deck-bands.ts` (`deckBand`/`preselectTrackLength`), not an invented number | `grep` proves the import; a guard test proves the editor's output changes when `deck-bands.ts`'s own thresholds are mutated (so it's a real dependency, not a coincidentally-similar reimplementation) | not measured yet |
| C3-3 | The backup badge shows all three vocabulary states, and the "saved" state shows the **actual filename** | Screenshot + a test driving the boundary hook with a real filename string | not measured yet |
| C3-4 | The end-of-session reminder (T1) shows with unsaved changes, does not show without — two cases | Test, both cases, printed pass/fail | not measured yet |
| C3-5 | Zero standalone "محفوظ"/"آمن" for the draft anywhere in new copy | `grep` | not measured yet |
| C3-6 | 100-files-per-batch warning appears once the real, deduplicated media-file count crosses the actual GitHub limit | Test: add media-bearing questions past the threshold, assert the warning appears; assert absent below it | not measured yet |
| C3-7 | `tsc --noEmit` 0 errors; full unit suite green; C1/C2 live regressions still green | command output | not measured yet |
| C3-8 | Every new guard has a red→green mutation proof | per-guard | not measured yet |

Anything I cannot measure will be written as **"NOT MEASURED"** explicitly.

---

## Design decisions made before writing code

1. **Stage preview is a full-viewport overlay, not an inline shrunk widget.** `--stage-unit` (`min(100vw/1920, 100vh/1080)`, `src/styles/tokens.css`) is computed against the real browser viewport via `position: fixed`, not against a containing element — so the only way to show the *real* stage component at its *real* proportions ("كما يراها الجميع" — "as everyone sees it", literally) is to mount `.stage-root` full-viewport, exactly like `src/stage/app.ts` does, with a close control layered on top. A shrunk inline preview would require re-deriving `--stage-unit` against a container, which is WL-B-owned CSS I must not modify.
2. **The readiness meter evaluates the deck against N=10** ("عادية", the normal/default preset — Appendix أ's «أطوال المسار: قصيرة · عادية · طويلة»), not the smallest or largest preset. This is not an arbitrary choice: both of Appendix أ's literal example messages (`أسئلتك ٢٦ — تكفي غالباً...` and `أسئلتك ١٨ — تكفي لمسار ٦ خطوات`) only reproduce exactly under `deckBand(D, 10)` — verified by hand: `deckBand(26,10)` = warn (refuseThreshold 22 ≤ 26 < greenThreshold 37.4) ✓; `deckBand(18,10)` = refuse (18 < 22) ✓, and its recommended fallback of "6" matches `preselectTrackLength(18)` exactly (verified: no preset is green at D=18; only 6 is warn-or-better, since `deckBand(18,6)` = warn as 18 ≥ 14). This derivation is pasted as a code comment, not asserted from memory.
3. **The backup/publish boundary is a Promise-returning callback** (`onRequestBackup?: () => Promise<{ filename: string } | null>`), changed from C1's `() => void` stub (safe — no other work line calls `mountEditor` yet, confirmed by grep). The real ZIP writer (WL-D/PH-D2) will implement this callback for real and return the chosen filename; `mountEditor` awaits it and calls the new `store.recordBackup(filename)` — the actual "mark the state" boundary this phase owns. Nothing here builds a ZIP.
4. **T1 (session-end reminder) is a persistent banner shown whenever `hasUnsavedChanges` is true**, not tied to a nonexistent router "leave" event (D-11: no router at all, and no "back to home" affordance exists yet in this editor). This satisfies the literal two-case test (dirty → shown, clean → not shown) and functionally guarantees visibility before the host closes the tab, since it never disappears while dirty. Additionally wires the real `beforeunload` event (native "leave site?" confirmation) as defense in depth, matching "قبل ما تسكّر" (*before you close*) literally — cheap, and the standard web-platform mechanism for exactly this warning.

---

## Progress — round 1: all modules written, wired, unit-tested

New files (all within my ownership — `src/editor/**`):

| File | Purpose |
|---|---|
| `src/editor/ui/stage-preview.ts` | `openStagePreview` — imports `renderQuestionScreen` from `src/stage/screens/question.ts` (WL-B's real component), mounts it full-viewport (`.stage-root`, matching `src/stage/app.ts`'s own mounting), inert (no callback mutates real state). `toStageQuestion` converts a ready `DraftQuestion` to the frozen `Question` contract shape (returns `null`, never throws, if not ready). |
| `src/editor/ui/readiness-meter.ts` | `computeReadiness`/`renderReadinessMeter` — imports `deckBand`/`preselectTrackLength` from `src/core/rules/deck-bands.ts`; evaluates at N=10 (derivation proven in the file's own comment and in the unit tests below). |
| `src/editor/ui/media-batch-warning.ts` | `countDistinctMediaFiles` (deduplicated by `sha256` — matches how the real export would count files) / `renderMediaBatchWarning` — warns once the real count exceeds 100. |
| `src/editor/ui/backup-badge.ts` | `renderBackupBadge` — the three vocabulary states + the T1 reminder banner, both purely derived from `DraftStore`. |

Extended (within ownership):

| File | Change |
|---|---|
| `src/storage/idb.ts` | `DraftMeta` gains `lastBackupAt?`, `lastBackupFilename?`, `lastPublishAt?` — no `DB_VERSION` bump needed (optional fields on an existing record, no schema/index change). |
| `src/editor/draft-store.ts` | New `BackupBadgeState` type; `recordBackup(filename)`, `recordPublish()` (both through `guardedWrite`, matching every other write in this file); `hasUnsavedChanges()`; `backupState()`. |
| `src/editor/copy.ts` | PH-C3 literal strings (`savedOnDevice`, `publishedWithGame`, `previewLikeEveryone`, `sessionEndReminder`) + composed functions (`deckWarnMessage`, `deckRefuseMessage`, `deckGreenMessage`, `mediaBatchWarningMessage`), each documented as literal-vs-composed at its definition. Rewrote the whole file via `Write` after several failed `Edit` attempts hit an invisible-character mismatch (likely a stray directional-mark or non-breaking character introduced somewhere in a prior multi-line Arabic edit) — a full re-read-and-rewrite was faster and safer than fighting the diff. |
| `src/editor/ui/question-list.ts` | Added the preview button per card, gated on `isQuestionReady` (disabled + `notReadyForPreview` label when not ready). |
| `src/editor/app.ts` | Mounts `renderBackupBadge`/`renderReadinessMeter`/`renderMediaBatchWarning`; `MountEditorOptions.onRequestBackup` changed from C1's `() => void` stub to `() => Promise<{filename:string}\|null>` (safe — grepped first, confirmed no other work line calls `mountEditor` yet); added a `triggerBackup()` closure as the single place that Promise boundary is crossed into `store.recordBackup`; wired `beforeunload`. |
| `tests/editor/support/fake-backend.ts` | Added `setFailNextPutMeta` (separate from the existing `setFailNextPut`, since `recordBackup`/`recordPublish` write meta directly and never touch `putQuestion`). |

`npx tsc --noEmit`: **0 errors**. Full unit suite: **55/55 passing** (40 carried from PH-C1/C2 + 15 new: 5 readiness-meter + 4 media-batch-warning + 6 backup-state).

### Red→green mutation proofs, round 1 (all restored immediately after, suite re-confirmed green each time)

| Guard mutated | Test(s) that went red | Pasted failure |
|---|---|---|
| `computeReadiness`: hardcoded `band = 'green'`, ignoring the `deckBand` import entirely | 3 tests (D=26 warn, D=18 refuse, cross-check loop) | `expected 'green' to be 'warn'` / `'refuse'` |
| `countDistinctMediaFiles`: counted every media-bearing question instead of deduplicating by `sha256` | `deduplicates the SAME media reused across multiple questions` | `expected 3 to be 1` |
| `hasUnsavedChanges`: inverted `updatedAt > savedAt` to `<` | 2 tests (`adding a question creates unsaved changes`, `a NEW question added after a backup makes it stale again`) | `expected false to be true` (both) |
| `backupState`: disabled the "published wins" branch (`if (false && ...)`) | `recordPublish marks the deck published, and wins over an older backup` | `expected { kind:'saved', filename:'backup-1.zip' } to deeply equal { kind:'published' }` |

---

## Progress — round 2: grep proofs + live-browser run (all PASSED)

### AC1/AC5 grep proofs

- `grep "from '\.\./\.\./stage/screens/question'" src/editor` → exactly one match, `src/editor/ui/stage-preview.ts:22`.
- `grep "option-card|options-grid|renderQuestionScreen" src/editor` → only the import line, the call site, and a comment referencing it in `stage-preview.ts` — **0 duplicated implementation** of option-card/grid rendering anywhere under `src/editor/`.
- `grep "محفوظ" src/editor` → three matches, all either the rule's own comment or `savedOnDevice: 'محفوظ على جهازك'` (the "saved" *backup* state, not the draft) — never the draft described as "محفوظ" alone.
- `grep "آمن" src/editor` → one match, the rule's own comment. **0 real occurrences.**

### Harness extended for PH-C3 (`tests/editor/fixtures/editor-harness.html`)

- `window.__store = store` — exposed so a live script can drive `recordPublish()` directly and add many questions fast for AC6, without needing a UI-only path for concerns already covered elsewhere.
- `onRequestBackup` wired to a controllable `window.__setNextBackupFilename(name)` stand-in for the real (not-yet-built) ZIP writer — proves `mountEditor`'s new Promise-returning boundary and `recordBackup` for real, end to end, through an actual button click.

### Live script (`tests/editor/live/preview-readiness-backup.ts`, port 3013) — full real output

```
=== AC3a — initial backup-badge state (draft-only) ===
  badge text: نسخة العمل — على هذا المتصفح فقط
  T1 reminder hidden (expected true — nothing written yet): true

=== AC4 (case 1/2) — T1 reminder shown with unsaved changes ===
  T1 reminder hidden (expected false — one unsaved question exists): false
AC4 (dirty case) PASSED.

=== AC1 — stage preview renders the real stage component ===
  stage question text (live DOM): ما عاصمة السعودية؟
  option-card count: 4
AC1 PASSED — the real stage component rendered the real question, verbatim.
  screenshot saved: .../tests/editor/live/stage-preview-live.png
  overlay removed after close (count === 0): true

=== AC2 — readiness meter matches computeReadiness() exactly (cross-check #1) ===
  live DOM: أسئلتك 1 — تكفي لمسار 6 خطوات
  computeReadiness(1).message: أسئلتك 1 — تكفي لمسار 6 خطوات
AC2 (cross-check #1) PASSED.

=== AC3b — backup badge shows the real filename after a (simulated) save ===
  badge text after save: محفوظ على جهازك (نسخة-أسئلة-العائلة-2026-08-08.zip)
AC3b PASSED — the badge shows the real filename verbatim.
  screenshot saved: .../tests/editor/live/backup-badge-saved.png

=== AC4 (case 2/2) — T1 reminder hidden once there are no unsaved changes ===
  T1 reminder hidden (expected true — just saved, no new edits): true
AC4 (clean case) PASSED — both T1 cases proven live.

=== AC3c — backup badge shows "published" after recordPublish ===
  badge text after publish: منشور مع اللعبة
AC3c PASSED.
  screenshot saved: .../tests/editor/live/backup-badge-published.png

=== AC6 — 100-files-per-batch warning, real threshold ===
  warning hidden before adding media (expected true — 0 media files so far): true
  total questions after adding 101 distinct media-bearing ones: 102
  live DOM: لديك 101 ملف وسائط — الرفع للنشر سيحتاج أكثر من دفعة لأن الموقع يقبل 100 ملف كل مرة
  mediaBatchWarningMessage(101): لديك 101 ملف وسائط — الرفع للنشر سيحتاج أكثر من دفعة لأن الموقع يقبل 100 ملف كل مرة
AC6 PASSED — warning absent below 100 files, present and correctly worded above it.

=== AC2 — readiness meter cross-check #2 (final count) ===
  live DOM (D=102): أسئلتك 102 — تكفي بارتياح لمسار عادي (10 محطات)
  computeReadiness().message: أسئلتك 102 — تكفي بارتياح لمسار عادي (10 محطات)
AC2 (cross-check #2) PASSED.

ALL PH-C3 LIVE SCENARIOS PASSED
```

No `pageerror` or console-error events observed at any point.

**Screenshots inspected directly** (not just "the assertion passed"):
- `stage-preview-live.png` — the real 1920×1080 stage canvas, dark theme, RTL, the real question text and four option cards, team names, the close button top-left. This is not a mockup — it is `src/stage/screens/question.ts` rendering for real, driven from editor data.
- `backup-badge-saved.png` / `backup-badge-published.png` — thin single-line crops (the element's natural size), text confirmed both visually and via the programmatic `textContent` check above; legible green text in both.

### C1/C2 regression re-run after PH-C3's changes to `app.ts` (`mountEditor` signature) and `editor-harness.html`

Both re-run in full, both still green:
- `persistence-and-quota.ts`: `AC1 PASSED`, `AC2 PASSED`, `ALL LIVE SCENARIOS PASSED`.
- `media-intake.ts`: `AC1 PASSED` … `AC7 PASSED`, `ALL PH-C2 LIVE SCENARIOS PASSED`.

### Final state checks

- `npx tsc --noEmit`: **0 errors**.
- `npm test`: **55/55 passing**.
- `grep 'storage\.persist' src/` → **0**. `grep 'quota' src/editor/` (case-sensitive) → **0**.
- Ports 3012 and 3013 both confirmed free after every run (`Get-NetTCPConnection -State Listen` → no results); no stray Chromium/node processes (`Get-Process` → none matching `chrome|chromium`) after the final run.
- No new environment trap hit this round — the discipline established in PH-C2's `tsx-playwright-page-evaluate.md` protocol (no named function bindings inside `page.evaluate` callbacks run through tsx) held up cleanly on the first real run of `preview-readiness-backup.ts`, with no red→fix→green cycle needed for tooling this time.

### Closing-claims list — filled in

| # | Claim | Result |
|---|---|---|
| C3-1 | Stage-preview imports the real component, 0 duplication | **MEASURED, PASS** — grep + live DOM text/option-count match + screenshot |
| C3-2 | Readiness meter reads WL-A's thresholds, not invented | **MEASURED, PASS** — 2 literal Appendix-أ messages reproduced exactly + red→green mutation proof + 2 live cross-checks |
| C3-3 | Backup badge, 3 states, real filename shown | **MEASURED, PASS** — live DOM text for all 3 states + 2 screenshots |
| C3-4 | T1 reminder, 2 cases | **MEASURED, PASS** — both cases proven live |
| C3-5 | 0 standalone "محفوظ"/"آمن" for the draft | **MEASURED, PASS** — grep |
| C3-6 | 100-files warning at the real threshold | **MEASURED, PASS** — 0 files → hidden; 101 distinct files → shown with exact literal-derived text |
| C3-7 | `tsc`/suite/regressions green | **MEASURED, PASS** — 0 errors, 55/55, both C1/C2 live scripts re-confirmed |
| C3-8 | Red→green mutation proofs | **MEASURED, PASS** — 4 guards, table above |

**PH-C3: all closing claims measured, all PASS. Status: DONE.**

---
