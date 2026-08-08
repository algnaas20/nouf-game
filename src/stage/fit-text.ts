/**
 * Question-text auto-shrink — §1.5/§2.4. Runs only after `document.fonts.ready`
 * (never on first paint, per the fallback-metrics rule in §3.4). Shrinks
 * from the nominal size toward the floor inside a 2-line box; if it still
 * overflows at the floor, grows the box by one line at a time (never
 * truncates, never ellipsis — V5) until it fits, then removes the height
 * cap entirely (nothing left to clip against).
 *
 * Line-height is 1.9 (see stage.css) — measured, not the table's 1.6: the
 * bundled Cairo variable font's real Arabic ink extent needs it (worklog-B1
 * §V4). Growing lines beyond a fixed 3 is also measured-in: the floor size
 * itself scales with the accessibility multiplier, so at ×1.30 a fixed
 * 3-line cap produced real overflow on the 150-char fixture.
 */
export interface FitTextOptions {
  nominalPx: number;
  floorPx: number;
  lineHeight: number;
  /**
   * Hard cap on how many lines the box may grow to — PH-B2's fix for
   * worklog-B1.md §V4b: growing "as many lines as it takes" with no
   * awareness of how much room the surrounding flex layout actually has
   * left is exactly what produced the collision (the box grew to whatever
   * height its OWN content needed, while its flex parent had already been
   * shrunk to a smaller allocation by the rest of `.stage-safe`'s layout —
   * see fit-combined.ts's header comment for the full mechanics). Callers
   * that know the real remaining budget (fit-combined.ts) pass it in;
   * defaults to 10 (the original unbounded-ish behaviour) for any other
   * caller that doesn't have a combined-layout budget to enforce.
   */
  maxLines?: number;
}

const DEFAULT_MAX_LINES = 10;

/** Returns the final line count actually used, so a caller (fit-combined.ts)
 *  can tell whether growth was cut short by `maxLines` (i.e. the box still
 *  overflows and a further remedy — shrinking options, compressing gaps —
 *  is needed) rather than converging naturally. */
export function fitQuestionText(el: HTMLElement, opts: FitTextOptions): { lines: number; overflowing: boolean } {
  const { nominalPx, floorPx, lineHeight, maxLines = DEFAULT_MAX_LINES } = opts;
  let size = nominalPx;
  const setBox = (fontPx: number, lines: number) => {
    el.style.fontSize = `${fontPx}px`;
    el.style.maxHeight = `${fontPx * lineHeight * lines}px`;
  };

  // The shrink phase's starting line budget must itself respect `maxLines`
  // — a real bug, caught by direct measurement (worklog-B2.md §6): this
  // used to hard-code `2` here regardless of `maxLines`, so a caller
  // passing `maxLines: 1` (a genuinely tiny remaining budget) still got a
  // 2-line-tall box the whole time, because the growth loop below never
  // even ran (`lines(2) < maxLines(1)` is false from the first check) —
  // `maxLines` had no effect at all below 2.
  const initialLines = Math.max(1, Math.min(2, maxLines));

  setBox(size, initialLines);
  const steps = 24;
  const delta = (nominalPx - floorPx) / steps;
  let guard = 0;
  while (el.scrollHeight > el.clientHeight + 0.5 && size > floorPx && guard < steps) {
    size = Math.max(floorPx, size - delta);
    setBox(size, initialLines);
    guard += 1;
  }

  let lines = initialLines;
  while (el.scrollHeight > el.clientHeight + 0.5 && lines < maxLines) {
    lines += 1;
    setBox(floorPx, lines);
  }

  const overflowing = el.scrollHeight > el.clientHeight + 0.5;

  // The box has converged to a size that contains the content (or hit
  // `maxLines` still overflowing — the caller decides what to do next);
  // max-height was not the binding constraint by this point either way.
  // Drop it so there is nothing left for `overflow: hidden` to clip.
  el.style.maxHeight = 'none';

  return { lines, overflowing };
}
