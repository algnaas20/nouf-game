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
