/**
 * Arabic product copy for the editor's draft-and-CRUD screen (PH-C1).
 *
 * Every string here is copied verbatim from either خطة.md's Appendix أ
 * ("نصوص الشاشة الحرفية") or the literal quotes inside the WL-C C1 prompt
 * (docs/تأسيس-المشروع/تقارير/planner/executor-prompts-2026-08-07.md) — never
 * paraphrased (v3 §11 / project rule). Strings that belong to a later phase
 * (backup chip states, T1/T2 session-end reminders, media-type rejection,
 * live length counters, the shuffled-preview line) are intentionally absent
 * here — they are PH-C3/PH-C2's job, not this one.
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
