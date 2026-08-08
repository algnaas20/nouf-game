/**
 * A single formatting function for every on-screen number in the editor —
 * Western digits now (خطة.md D-10: Arabic-Indic numerals are deferred by
 * name). The later switch is a one-line change here and nowhere else in
 * src/editor.
 */
export function formatNumber(n: number): string {
  return String(n);
}

const ARABIC_MONTHS = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
] as const;

/** "7 أغسطس 2026" — day and year through `formatNumber`, month name spelled
 *  out in Arabic so nothing here depends on locale-specific `Intl` output. */
export function formatDraftDate(timestampMs: number): string {
  const date = new Date(timestampMs);
  const day = formatNumber(date.getDate());
  const month = ARABIC_MONTHS[date.getMonth()] ?? '';
  const year = formatNumber(date.getFullYear());
  return `${day} ${month} ${year}`;
}

/**
 * D-09.25 (`addendum-deck-floor-2026-08-08.md`, play-experience-advisor) —
 * Arabic count agreement for the deck-floor family of messages ("زد ⟨n⟩
 * أسئلة", "ناقصك ⟨n⟩ أسئلة"). The exact, binding table, copied verbatim —
 * no improvisation:
 *   1 → «سؤال واحد» · 2 → «سؤالان» · 3–10 → «⟨n⟩ أسئلة» · ≥11 → «⟨n⟩ سؤالاً»
 * Digits route through `formatNumber` (Western digits now, one place to
 * flip to Arabic-Indic later, per D-10 — same convention as every other
 * number in the editor). Ready for the readiness-meter/copy wiring the
 * moment WL-A's `deck-bands.ts` exports the "how many more" numbers this
 * helper is meant to format (see worklog-C4.md §4 — blocked on that file
 * as of this addition, not yet consumed anywhere).
 */
export function formatQuestionCount(n: number): string {
  if (n === 1) return 'سؤال واحد';
  if (n === 2) return 'سؤالان';
  if (n >= 3 && n <= 10) return `${formatNumber(n)} أسئلة`;
  return `${formatNumber(n)} سؤالاً`;
}

/** The live media size counter (PH-C2 AC6) — one place, like `formatNumber`,
 *  so the later Arabic-Indic digit switch (D-10) is a one-line change here
 *  too. Deliberately coarse (whole kilobytes/megabytes, one decimal past
 *  1 MB) — this is a size counter for a non-technical host, not a debug
 *  readout. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${formatNumber(bytes)} بايت`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${formatNumber(Math.round(kb))} كيلوبايت`;
  const mb = kb / 1024;
  return `${formatNumber(Math.round(mb * 10) / 10)} ميجابايت`;
}
