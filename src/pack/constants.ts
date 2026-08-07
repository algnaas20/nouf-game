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
 */
export const MAX_FILES_PER_UPLOAD_BATCH = 100;
