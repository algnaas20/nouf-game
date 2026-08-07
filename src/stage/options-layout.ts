/**
 * Options layout — default 2x2, switches to stacked 1x4 whole-set if any
 * option would wrap to two lines in 2x2 (never mixed, §4.9/§6.1). Then all
 * four cards are set to the tallest card's computed height — removes both
 * layout jitter and the "the long one is correct" tell.
 */

export function decideOptionsLayout(gridEl: HTMLElement, textEls: HTMLElement[]): void {
  gridEl.classList.remove('stacked');
  // Force layout, then check each option's text for a wrap in 2x2 width.
  let anyWraps = false;
  for (const el of textEls) {
    const cs = getComputedStyle(el);
    const lineHeightPx = parseFloat(cs.lineHeight);
    if (el.scrollHeight > lineHeightPx * 1.5) {
      anyWraps = true;
      break;
    }
  }
  if (anyWraps) {
    gridEl.classList.add('stacked');
  }
}

/** All four cards share the tallest card's computed height — §4.9. */
export function equalizeCardHeights(cards: HTMLElement[]): number {
  for (const c of cards) c.style.blockSize = '';
  const maxH = Math.max(...cards.map((c) => c.scrollHeight));
  for (const c of cards) c.style.blockSize = `${maxH}px`;
  return maxH;
}
