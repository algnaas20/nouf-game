/**
 * Arabic product copy for the pack module (export, backup, import). Same
 * discipline `src/editor/copy.ts` (WL-C) documents at its own top: every
 * string copied verbatim from خطة.md's Appendix أ where one exists, and
 * anything composed is marked as such at its point of definition — never
 * presented as scripted when it is not (v3 §11 / project rule).
 *
 * Numbers route through the one `num()` helper below (Western digits now,
 * per D-10 — mirrors `src/editor/format.ts`'s `formatNumber`, kept as a
 * separate function here rather than importing across the WL-C/WL-D
 * ownership boundary for a one-line utility).
 */

function num(n: number): string {
  return String(n);
}

/** Composed — the export/backup screen names skipped (not-yet-ready)
 *  questions, numbered by on-screen position — deliberately matching PH-C1's
 *  `questionMissingCorrectMessage` numbering rule (independently defined
 *  here; WL-D does not import WL-C's editor copy). */
export function skippedFromBackupMessage(questionNumbers: number[]): string {
  const list = questionNumbers.map(num).join('، ');
  return `لم تُحفظ في هذه النسخة الأسئلة التالية لأنها بلا إجابة صحيحة بعد: السؤال ${list}. أكملها ثم احفظ نسخة جديدة.`;
}

/** Composed — one question's media reference does not resolve to a stored
 *  file (§7.3 check 3, "orphan-reference"). */
export function orphanReferenceMessage(questionNumber: number): string {
  return `السؤال ${num(questionNumber)} يشير إلى ملف وسائط غير موجود.`;
}

/** Composed — the export screen's own "so he sees it before starting"
 *  100-files-per-batch notice (constraint row 11). Distinct wording context
 *  from WL-C's editor-side heads-up (`mediaBatchWarningMessage` in
 *  `src/editor/copy.ts` — shown continuously while authoring); this one is
 *  the export screen's own copy, in WL-D's ownership. Both are proven to
 *  fire at the identical threshold by
 *  `tests/pack/agrees-with-editor-threshold.test.ts`. */
export function mediaCountBatchWarning(mediaFileCount: number): string {
  return `لديك ${num(mediaFileCount)} ملف وسائط — الرفع سيحتاج أكثر من دفعة واحدة لأن الموقع يقبل ١٠٠ ملف كل مرة. قسّمها على دفعتين عند الرفع.`;
}

/** خطة.md Appendix أ — "النشر" row, literal, with `preparedAt` filled from
 *  the manifest exactly as authored, never reformatted: «جُهّزت في ٧ أغسطس
 *  ٢٠٢٦ · ١٤ سؤالاً». `dateLabel` is supplied pre-formatted by the caller
 *  (same split WL-C's `formatDraftDate`/`returnPromptMessage` already use). */
export function preparedLabel(dateLabel: string, questionCount: number): string {
  return `جُهّزت في ${dateLabel} · ${num(questionCount)} سؤالاً`;
}

/** خطة.md Appendix أ — "الاستيراد" row, literal: «هذا الملف فيه «أسئلة
 *  العائلة» — ١٤ سؤالاً، جُهّز في ٧ أغسطس. استبدال ما في المتصفح الآن؟» */
export function importConfirmMessage(title: string, questionCount: number, dateLabel: string): string {
  return `هذا الملف فيه «${title}» — ${num(questionCount)} سؤالاً، جُهّز في ${dateLabel}. استبدال ما في المتصفح الآن؟`;
}

export const AR_PACK_COPY = {
  // Composed — UI chrome for the export screen, not scripted in Appendix أ
  // (same convention WL-C's copy.ts used for "أسئلتي" / "+ سؤال جديد").
  exportForPublishingButton: 'صدّر للنشر',
  saveBackupButton: 'احفظ نسخة على جهازك',
  importButton: 'استورد ملف اللعبة',

  // PH-D3 — the publish recipe (خطة.md PH-D3 AC7: "٣ خطوات كحد أقصى،
  // بالعربية، بلا مسار ولا فرع ولا رأس تخزين مؤقّت، وتنتهي بخطوة تحقّق
  // يؤديها بنفسه"). Composed — no literal Appendix-أ text covers the setup
  // steps themselves (only the final verification line, below, is
  // literal). Deliberately never mentions a branch, a folder path, or
  // cache headers — the host only ever sees "your repository" and "the
  // link". Step 1 is a one-time prerequisite (a repository that already
  // has the game engine in it) — this phase does not build or host that
  // template; stated honestly in worklog-D3.md, not silently assumed away.
  publishRecipeTitle: 'كيف تنشر لعبتك؟',
  publishRecipeStep1: 'جهّز مستودعك على GitHub (مرة واحدة فقط) وفعّل خاصية النشر (Pages) من إعداداته.',
  publishRecipeStep2:
    'من شاشة «صدّر للنشر»، نزّل ملف لعبتك، فك الضغط عنه، واسحب كل ما بداخله إلى صفحة رفع الملفات في مستودعك.',
  openPublishRecipeButton: 'كيف أنشر لعبتي؟',
  closePublishRecipeButton: 'إغلاق',

  // خطة.md Appendix أ — "الاستيراد" row, literal.
  importConfirmReplace: 'استبدل',
  importConfirmCancel: 'إلغاء',

  // خطة.md Appendix أ — "النشر" row, literal, verbatim, no placeholders.
  openLinkVerification: 'افتح الرابط: إذا ظهر اسم لعبتك وعدد الأسئلة، فالنشر تمّ.',

  // Composed — export-time blocking/warning messages (§7.3's five checks).
  fileTooLarge: 'أحد ملفات الوسائط أكبر من الحد المسموح للرفع (٢٥ ميجابايت) — قلّص حجمه أو استبدله.',
  badFilename: 'اسم ملف داخلي غير صالح — هذا خطأ داخلي، لا يخص أسئلتك. أعد المحاولة أو تواصل مع الدعم.',
  hashMismatch: 'أحد ملفات الوسائط تالف في المسودة — أعد إضافته من جهازك.',
  orphanReference: orphanReferenceMessage,

  // Composed — formatVersion / corrupt-file refusals (§10.3: "hard,
  // explained refusal — never a partial load").
  formatTooNew: 'هذا الملف بصيغة أحدث من نسخة اللعبة الحالية — حدّث اللعبة أولاً.',
  notAValidPack: 'هذا الملف ليس ملف لعبة صالحًا.',
} as const;

/** Back-compat named export — some call sites read the literal string on
 *  its own rather than through `AR_PACK_COPY`. */
export const OPEN_LINK_VERIFICATION = AR_PACK_COPY.openLinkVerification;
