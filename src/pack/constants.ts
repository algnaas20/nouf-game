/**
 * Reserved for PH-D2 (the export/publish screen). This phase (PH-D1) only
 * "reserves the copy" per constraint row 11 ("state it in the export screen
 * — build the screen in D2, but reserve the copy now"): the numeric limit
 * lives here as the single source of truth so D2 imports it instead of
 * hardcoding a magic number.
 *
 * No literal Arabic sentence for this warning exists yet in
 * `docs/تأسيس-المشروع/خطة.md` Appendix A ("الملحق أ")؛ PH-D2 must write the
 * on-screen copy itself when it builds the export screen — do not invent it
 * here (v3: never paraphrase or invent product copy).
 *
 * PH-D2 addendum: the on-screen copy IS now written (`src/pack/copy.ts`).
 * This constant stays the single source of truth; `src/editor/ui/media-batch-warning.ts`
 * (WL-C, editor-side heads-up) independently hardcodes the same threshold
 * (100) rather than importing across the WL-C/WL-D ownership boundary — the
 * two are proven to agree by `tests/pack/agrees-with-editor-threshold.test.ts`,
 * which imports WL-C's own `mediaBatchWarningMessage`/threshold behaviour and
 * asserts both fire at the identical count. If either constant is ever
 * changed without the other, that test goes red.
 */
export const MAX_FILES_PER_UPLOAD_BATCH = 100;

/**
 * §7.2 of media-storage-investigation.md v5 — "the cap that actually binds":
 * 25 MiB per file through the GitHub web uploader. MiB, not MB (1024-based),
 * matching the report's own units.
 */
export const WEB_UPLOAD_MAX_FILE_BYTES = 25 * 1024 * 1024;

/**
 * The pack manifest's `formatVersion` this build understands. Bump this the
 * moment `PackManifest`'s shape changes in a way older readers cannot parse.
 * `importPack()` refuses (hard, fully, no partial load) any pack whose
 * `formatVersion` is higher than this — media-storage-investigation.md
 * §10.3: "a version higher than the app understands is a hard, explained
 * refusal — never a partial load."
 */
export const PACK_FORMAT_VERSION = 1;

/** §10.1 — the pack's fixed entry names/paths inside the zip. */
export const MANIFEST_ENTRY_NAME = 'questions.json';
export const MEDIA_ENTRY_DIR = 'm';

/** §10.2 — "stream each blob through blob.stream() in 1 MB chunks so peak
 *  memory is one chunk." Implemented via sequential `Blob.slice()` reads of
 *  this size (deterministic and portable — see crc32.ts's own comment for
 *  why slicing was chosen over `.stream()`'s reader). */
export const CRC_STREAM_CHUNK_BYTES = 1024 * 1024;
