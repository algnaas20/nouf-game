/**
 * Arabic product copy for the editor's draft-and-CRUD screen (PH-C1),
 * media intake (PH-C2), and preview/readiness/backup (PH-C3).
 *
 * Every string here is copied verbatim from either خطة.md's Appendix أ
 * ("نصوص الشاشة الحرفية") or the literal quotes inside the relevant WL-C
 * prompt — never paraphrased (v3 §11 / project rule). Strings with no
 * literal source are composed following the existing calm/short tone, and
 * marked as such in a comment at the point of definition — never presented
 * as if they were scripted.
 */

import { formatNumber } from './format';

export const AR_COPY = {
  // §5A.2 — the vocabulary rule. Never "محفوظ" alone, never "آمن", for the draft.
  draftVocabulary: 'نسخة العمل — على هذا المتصفح فقط',
  // §5A.2 — the one-time sentence on first entering the editor (T0).
  firstEntry:
    'عملك يبقى في هذا المتصفح بين الجلسات. لنقله إلى جهاز آخر — أو لأمان أكيد — احفظ نسخة على جهازك.',
  // خطة.md Appendix أ — "المحرّر — امتلاء التخزين".
  draftStorageFull: 'لم يعد هناك مكان للمسودة — احفظ لعبتك في الكمبيوتر الآن',
  // خطة.md Appendix أ — "المحرّر — نهاية الجلسة" button label, reused here as
  // the save button embedded inside the storage-full message (AC2).
  saveBackupButton: 'احفظ نسخة',
  // WL-C C1 prompt, implementation rules — "On return, prompt".
  returnPromptPrefix: 'لديك مسودة من',
  returnPromptSuffix: '— تابع، أو ابدأ من جديد، أو احذفها',
  returnContinue: 'تابع',
  returnStartOver: 'ابدأ من جديد',
  returnDelete: 'احذفها',
  // WL-C C1 prompt, implementation rules — reorder buttons.
  moveUp: '▲ أعلى',
  moveDown: '▼ أسفل',
  // WL-C C1 prompt, implementation rules — delete undo strip.
  deletedStrip: 'حُذف السؤال',
  undo: 'تراجُع',
  // خطة.md Appendix أ — "المحرّر — نقص"; one of the three redundant
  // correct-answer signals (radio, green row, this text).
  correctAnswerLabel: 'الإجابة الصحيحة',
  addQuestion: '+ سؤال جديد',
  done: 'تم',
  cancel: 'إلغاء',
  deleteButton: 'حذف',
  ready: 'جاهز',
  notReady: 'غير جاهز',
  questionsTitle: 'أسئلتي',
  questionTextLabel: 'نص السؤال',
  // خطة.md Appendix أ — "المحرّر — الأنواع المقبولة", literal.
  unsupportedMediaType: 'هذا الملف غير مدعوم. الأنواع المقبولة: صور JPG وPNG · صوت MP3 وM4A.',
  // PH-C2: no literal Appendix-أ string covers "WAV specifically over the
  // ceiling" — composed here, matching the existing calm/short tone and the
  // report's own instruction to "tell the host to convert" (§5.1).
  audioWavTooLarge: 'ملف WAV كبير جدًا — حوّله إلى MP3 أو M4A (نفس الجودة المسموعة، بحجم أصغر بكثير).',
  // PH-C2: composed — no literal string exists for "the file looked
  // supported but would not actually play" at add time (distinct from the
  // Appendix-أ "فشل الوسائط" strings, which are for playback failure
  // *during a live game*, not intake validation).
  audioUnplayable: 'تعذّر تشغيل هذا المقطع — جرّب ملفًا آخر.',
  imageUndecodable: 'تعذّر فتح هذا الملف كصورة — جرّب ملفًا آخر.',
  // PH-C2 UI chrome — not scripted in Appendix أ (like "أسئلتي" in PH-C1),
  // composed following the same minimal-utilitarian convention.
  attachMedia: '+ أضف صورة أو صوت',
  removeMedia: 'إزالة',
  playPreview: '▶ تشغيل',
  stopPreview: '■ إيقاف',

  // ---- PH-C3 -------------------------------------------------------
  // خطة.md Appendix أ — "المحرّر — المفردة الملزمة" row, literal, all three
  // states of the backup badge (the draft state reuses draftVocabulary
  // above — never redefined here, single source per §5A.2's rule).
  savedOnDevice: 'محفوظ على جهازك',
  publishedWithGame: 'منشور مع اللعبة',
  // خطة.md Appendix أ — "المحرّر — نقص", literal — the preview button label.
  previewLikeEveryone: 'معاينة كما يراها الجميع',
  // PH-C3 UI chrome — not scripted in Appendix أ, composed following the
  // same minimal-utilitarian convention PH-C1/C2 already used.
  closePreview: 'إغلاق المعاينة',
  notReadyForPreview: 'أكمل تعليم الإجابة الصحيحة أولاً للمعاينة',
  // خطة.md Appendix أ — "المحرّر — نهاية الجلسة", literal (T1). The button
  // is `saveBackupButton` above, reused verbatim per the same rule that
  // reused it inside the storage-full banner in PH-C1.
  sessionEndReminder: 'قبل ما تسكّر: احفظ نسخة على جهازك حتى ما تضيع أسئلتك.',
} as const;

/** خطة.md Appendix أ — "المحرّر — نقص": «السؤال ٣ بلا إجابة صحيحة». The
 *  digit routes through `formatNumber` (Western digits now, one place to
 *  flip later) rather than being hard-coded Arabic-Indic. */
export function questionMissingCorrectMessage(questionNumber: number): string {
  return `السؤال ${formatNumber(questionNumber)} بلا إجابة صحيحة`;
}

/** WL-C C1 prompt: «لديك مسودة من [التاريخ] — تابع، أو ابدأ من جديد، أو
 *  احذفها» — `[التاريخ]` is the prompt's own placeholder token for the
 *  real formatted date. */
export function returnPromptMessage(dateLabel: string): string {
  return `${AR_COPY.returnPromptPrefix} ${dateLabel} ${AR_COPY.returnPromptSuffix}`;
}

/**
 * خطة.md Appendix أ — "مؤشّر الرزمة" family, literal, `⟨...⟩` placeholder
 * filled with `formatNumber` (Western digits, per D-10 — same convention
 * as every other number in the editor, even though the Appendix's own
 * rendering shows Arabic-Indic digits; that switch is deferred project-wide
 * to a single later flip). See `src/editor/ui/readiness-meter.ts` for the
 * derivation proving these are evaluated at the N=10 "عادية" preset,
 * matching the two literal examples exactly (`أسئلتك ٢٦ …` / `أسئلتك ١٨ …`).
 */
export function deckWarnMessage(deckSize: number): string {
  return `أسئلتك ${formatNumber(deckSize)} — تكفي غالباً، وإذا كثرت الأخطاء ممكن تخلص الأسئلة قبل ما يوصل أحد`;
}

export function deckRefuseMessage(deckSize: number, fallbackTrackLength: number): string {
  return `أسئلتك ${formatNumber(deckSize)} — تكفي لمسار ${formatNumber(fallbackTrackLength)} خطوات`;
}

/** PH-C3: no literal "all clear" deck message exists in Appendix أ (only
 *  the warn/refuse cases are scripted — silence-implies-fine is the pattern
 *  elsewhere in this project, e.g. no "well done" ever appears). Composed,
 *  in the same voice, reusing the literal verb "تكفي". */
export function deckGreenMessage(deckSize: number): string {
  return `أسئلتك ${formatNumber(deckSize)} — تكفي بارتياح لمسار عادي (10 محطات)`;
}

/** PH-C3: composed — the proactive editor-side heads-up ahead of WL-D's
 *  real export screen (which owns the authoritative wording at publish
 *  time, §7.3 of media-storage-investigation.md). Not a duplicate of any
 *  literal string — none exists yet for this specific editor-side warning. */
export function mediaBatchWarningMessage(mediaFileCount: number): string {
  return `لديك ${formatNumber(mediaFileCount)} ملف وسائط — الرفع للنشر سيحتاج أكثر من دفعة لأن الموقع يقبل 100 ملف كل مرة`;
}
