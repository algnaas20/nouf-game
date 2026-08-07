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
