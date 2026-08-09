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

import { formatNumber, formatQuestionCount } from './format';

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
 * D-09.21…D-09.26 (`addendum-deck-floor-2026-08-08.md` §"Editor readiness
 * meter — continuous, three states", final, binding — supersedes the
 * earlier warn/refuse/green strings entirely, not just their vocabulary).
 *
 * All three take `⟨D⟩`/`⟨N⟩`/the "questions needed" number from the
 * caller — never re-derive a threshold here (D-09.24: "add X more" must
 * use the SAME `ceil` the band check itself uses, or the message can
 * promise a number that does not actually flip the band).
 * `src/editor/ui/readiness-meter.ts` is the only caller and is the one
 * that imports WL-A's `deckBand`/`preselectTrackLength`/
 * `questionsNeededForPlayable`/`questionsNeededForComfortable`
 * (`src/core/rules/deck-bands.ts`) to compute `N`/the needed counts — this
 * module only formats what it is given. Digits stay Western via
 * `formatNumber` (D-10, deferred project-wide) even though the addendum's
 * own literal examples are typeset in Arabic-Indic for readability — same
 * convention every other number in the editor already follows.
 *
 * D-09.26 (binding vocabulary, folded in here): track length is «محطات»,
 * never «خطوات» — a «خطوة» is now a move under the branching maze, and a
 * move can be wasted on a dead end, so «خطوات» is literally false for most
 * teams; «محطة» is the junction the token actually stands on.
 */

/** §7 "Below the floor": «أسئلتك ⟨D⟩ — ناقصك ⟨phrase(R)⟩ عشان تقدر تبدأ.»
 *  `questionsNeeded` is `questionsNeededForPlayable(D, N)` for whatever `N`
 *  the caller resolved via `preselectTrackLength` — the caller's job, not
 *  this function's. */
export function deckRefuseMessage(deckSize: number, questionsNeeded: number): string {
  return `أسئلتك ${formatNumber(deckSize)} — ناقصك ${formatQuestionCount(questionsNeeded)} عشان تقدر تبدأ.`;
}

/** §7 "Playable": «أسئلتك ⟨D⟩ — تكفي لمسار ⟨N⟩ محطات. زد ⟨phrase(G)⟩ وتلعب
 *  بارتياح.» `questionsNeededForComfort` is `questionsNeededForComfortable(D, N)`
 *  for the SAME `N` used in the first sentence — the caller's
 *  responsibility to pass the one consistent `N` throughout. */
export function deckWarnMessage(deckSize: number, trackLength: number, questionsNeededForComfort: number): string {
  return `أسئلتك ${formatNumber(deckSize)} — تكفي لمسار ${formatNumber(trackLength)} محطات. زد ${formatQuestionCount(questionsNeededForComfort)} وتلعب بارتياح.`;
}

/** §7 "Comfortable": «أسئلتك ⟨D⟩ — تكفي بارتياح لمسار ⟨N⟩ محطات.» — replaces
 *  the previous hardcoded «(10 محطات)» string (§4 of the addendum), now
 *  reading the real `N` the deck actually supports instead of a literal 10. */
export function deckGreenMessage(deckSize: number, trackLength: number): string {
  return `أسئلتك ${formatNumber(deckSize)} — تكفي بارتياح لمسار ${formatNumber(trackLength)} محطات.`;
}

/** PH-C3: composed — the proactive editor-side heads-up ahead of WL-D's
 *  real export screen (which owns the authoritative wording at publish
 *  time, §7.3 of media-storage-investigation.md). Not a duplicate of any
 *  literal string — none exists yet for this specific editor-side warning. */
export function mediaBatchWarningMessage(mediaFileCount: number): string {
  return `لديك ${formatNumber(mediaFileCount)} ملف وسائط — الرفع للنشر سيحتاج أكثر من دفعة لأن الموقع يقبل 100 ملف كل مرة`;
}
