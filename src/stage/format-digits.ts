/**
 * The one digit-formatting function on the stage — §2.6. Every number
 * rendered on screen (scores, step counts) must go through this, never a
 * literal template. Flipping to Arabic-Indic digits later is one line here.
 */
export function formatDigits(value: number): string {
  return String(value);
}
