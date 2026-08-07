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
}

const MAX_LINES = 10;

export function fitQuestionText(el: HTMLElement, opts: FitTextOptions): void {
  const { nominalPx, floorPx, lineHeight } = opts;
  let size = nominalPx;
  const setBox = (fontPx: number, lines: number) => {
    el.style.fontSize = `${fontPx}px`;
    el.style.maxHeight = `${fontPx * lineHeight * lines}px`;
  };

  setBox(size, 2);
  const steps = 24;
  const delta = (nominalPx - floorPx) / steps;
  let guard = 0;
  while (el.scrollHeight > el.clientHeight + 0.5 && size > floorPx && guard < steps) {
    size = Math.max(floorPx, size - delta);
    setBox(size, 2);
    guard += 1;
  }

  let lines = 2;
  while (el.scrollHeight > el.clientHeight + 0.5 && lines < MAX_LINES) {
    lines += 1;
    setBox(floorPx, lines);
  }

  // The box has converged to a size that contains the content; max-height
  // was not the binding constraint by this point. Drop it so there is
  // nothing left for `overflow: hidden` to clip.
  el.style.maxHeight = 'none';
}
