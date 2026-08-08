/**
 * The combined question+options vertical-fit pass — closes the residual
 * overlap disclosed in worklog-B1.md §V4b and re-diagnosed in
 * worklog-B2.md §6.
 *
 * Root cause (found by measuring every layer directly, not guessed):
 * `.question-area` is a SHRINKABLE flex child of the column `.stage-safe`
 * (`flex: 0 1 auto; min-block-size: 0`). When the column runs out of room
 * — which the worst-case fixture (a 150-char question AND four wrapped
 * 50-char options at once) reliably does — the flexbox algorithm shrinks
 * `.question-area`'s own box down toward 0, but `fitQuestionText`'s old
 * shrink/grow loop only ever asked "does my OWN scrollHeight fit my OWN
 * clientHeight" — a question completely blind to how much room the flex
 * parent was actually squeezed to. Measured concretely at ×1.30 on the
 * worst fixture: `.question-area` was allotted 81.8px by the flex layout
 * while its child rendered at 553px — a collision the old check structurally
 * could not see, because once `max-height` is removed (necessary — nothing
 * is left for `overflow: hidden` to clip against otherwise) the text box
 * simply renders at its own natural content height, independent of its
 * parent's actual allocation.
 *
 * A second, independent bug compounded this: `fitQuestionText`'s own line
 * budget hard-coded the shrink phase to start at 2 lines regardless of the
 * `maxLines` a caller passed — so a budget of "1 line only" had no effect
 * below 2 (fixed in fit-text.ts, see its own header comment).
 *
 * Even with both fixed, direct measurement shows the worst-case fixture at
 * ×1.30 needs more room than the options grid's stated floor (120 stage-px
 * per card × 4 + compressed gaps) and the question's stated floor (56,
 * line-height 1.9 ⇒ ~138px for even one line) leave once the fixed chrome
 * (status strip, turn header, operator bar, 4 gaps) is subtracted from the
 * 972px safe area — a genuine content-budget shortfall, not a bug. Phase 3
 * below reclaims the last real, disclosed lever: the turn header (whose
 * information the room already saw seconds earlier in the hand-off
 * overlay) shrinks and the safe-area's own gaps compress further, exactly
 * as far as needed and no further.
 */
import { fitQuestionText } from './fit-text';

export interface CombinedFitElements {
  safeEl: HTMLElement;
  questionAreaEl: HTMLElement;
  questionTextEl: HTMLElement;
  optionsGridEl: HTMLElement;
  optionCards: HTMLElement[];
  nominalQuestionPx: number;
  floorQuestionPx: number;
  questionLineHeight: number;
}

export interface CombinedFitResult {
  finalOverlapPx: number;
  optionShrink: number;
  gapScale: number;
  safeGapScale: number;
  turnHeaderShrink: number;
  questionLines: number;
  /**
   * True only if Phase 4 (below) had to go below the stated §1.5 question
   * floor (56 stage-px) to reach zero overlap. This is a disclosed,
   * bounded exception for the single pathological combined-worst-case
   * fixture (max-length question AND all four max-length options at
   * once) — never triggered by any ordinary question, and never silent:
   * a caller/reviewer can assert this is `false` on any real deck.
   */
  wentBelowStatedFloor: boolean;
  effectiveQuestionFloorPx: number;
}

const OPTION_SHRINK_FLOOR = 44 / 60; // §1.5: option nominal 60, floor 44.
const OPTION_SHRINK_STEPS = 10;
const GAP_SCALE_FLOOR = 0.5;
const GAP_SCALE_STEPS = 6;
const SAFE_GAP_SCALE_FLOOR = 0.35;
const SAFE_GAP_SCALE_STEPS = 8;
const TURN_HEADER_SHRINK_FLOOR = 0.4;
const TURN_HEADER_SHRINK_STEPS = 6;
/** Phase 4's absolute last-resort minimum — well below the stated 56
 *  stage-px floor, only ever used if Phases 1-3 together were still not
 *  enough. 28 stage-px is still comfortably above half the option floor
 *  and is a deliberate, visible degradation rather than a silent one. */
const ABSOLUTE_MIN_QUESTION_PX = 28;
const PHASE4_STEPS = 20;

function reequalizeCards(cards: HTMLElement[]): void {
  for (const c of cards) c.style.blockSize = '';
  const maxH = Math.max(...cards.map((c) => c.scrollHeight));
  for (const c of cards) c.style.blockSize = `${maxH}px`;
}

function overlapPx(questionTextEl: HTMLElement, optionsGridEl: HTMLElement): number {
  return questionTextEl.getBoundingClientRect().bottom - optionsGridEl.getBoundingClientRect().top;
}

/** Sum of the real rendered heights of every flex-flow child of `safeEl`
 *  EXCEPT `questionAreaEl`/`optionsGridEl` — i.e. status strip, turn
 *  header, operator bar (and a result banner, on a revealed screen, though
 *  this pass only ever runs pre-reveal). Explicitly skips
 *  `position: absolute` children (the undo corner) — they take no space
 *  in the flex layout at all, and including them would understate the
 *  real budget. */
function measureFixedSiblingsHeight(safeEl: HTMLElement, exclude: HTMLElement[]): { fixedHeight: number; gapPx: number; flowChildCount: number } {
  const gapPx = parseFloat(getComputedStyle(safeEl).rowGap || '0') || 0;
  let fixedHeight = 0;
  let flowChildCount = 0;
  for (const child of Array.from(safeEl.children)) {
    if (!(child instanceof HTMLElement)) continue;
    if (getComputedStyle(child).position === 'absolute') continue;
    flowChildCount += 1;
    if (exclude.includes(child)) continue;
    fixedHeight += child.getBoundingClientRect().height;
  }
  return { fixedHeight, gapPx, flowChildCount };
}

export function fitCombinedLayout(els: CombinedFitElements): CombinedFitResult {
  const { safeEl, questionAreaEl, questionTextEl, optionsGridEl, optionCards, nominalQuestionPx, floorQuestionPx, questionLineHeight } = els;

  optionsGridEl.style.setProperty('--option-shrink', '1');
  optionsGridEl.style.setProperty('--option-gap-scale', '1');
  safeEl.style.setProperty('--safe-gap-scale', '1');
  safeEl.style.setProperty('--turn-header-shrink', '1');
  reequalizeCards(optionCards);

  function questionAreaPadding(): number {
    const cs = getComputedStyle(questionAreaEl);
    return parseFloat(cs.paddingBlockStart || '0') + parseFloat(cs.paddingBlockEnd || '0');
  }

  let optionShrink = 1;
  let gapScale = 1;
  let safeGapScale = 1;
  let turnHeaderShrink = 1;

  function attemptFit(floorOverridePx?: number): { overlap: number; questionLines: number } {
    const floor = floorOverridePx ?? floorQuestionPx;
    const { fixedHeight, gapPx, flowChildCount } = measureFixedSiblingsHeight(safeEl, [questionAreaEl, optionsGridEl]);
    const gapsTotal = Math.max(0, flowChildCount - 1) * gapPx;
    const available = safeEl.clientHeight - fixedHeight - gapsTotal;
    const optionsHeight = optionsGridEl.getBoundingClientRect().height;
    const availableForQuestionText = Math.max(0, available - optionsHeight - questionAreaPadding());
    const maxLines = Math.max(1, Math.floor(availableForQuestionText / (floor * questionLineHeight)));
    const fitResult = fitQuestionText(questionTextEl, {
      nominalPx: floorOverridePx === undefined ? nominalQuestionPx : floor,
      floorPx: floor,
      lineHeight: questionLineHeight,
      maxLines,
    });
    return { overlap: overlapPx(questionTextEl, optionsGridEl), questionLines: fitResult.lines };
  }

  let effectiveFloor = floorQuestionPx;
  let { overlap, questionLines } = attemptFit();
  const result = (): CombinedFitResult => ({
    finalOverlapPx: overlap,
    optionShrink,
    gapScale,
    safeGapScale,
    turnHeaderShrink,
    questionLines,
    wentBelowStatedFloor: effectiveFloor < floorQuestionPx - 0.01,
    effectiveQuestionFloorPx: effectiveFloor,
  });
  if (overlap <= 0) return result();

  // Phase 1 — shrink options toward their floor; each step frees real
  // vertical room, re-fit the question against the new real budget.
  const shrinkDelta = (1 - OPTION_SHRINK_FLOOR) / OPTION_SHRINK_STEPS;
  let guard = 0;
  while (overlap > 0 && optionShrink > OPTION_SHRINK_FLOOR && guard < OPTION_SHRINK_STEPS) {
    optionShrink = Math.max(OPTION_SHRINK_FLOOR, optionShrink - shrinkDelta);
    optionsGridEl.style.setProperty('--option-shrink', String(optionShrink));
    reequalizeCards(optionCards);
    ({ overlap, questionLines } = attemptFit());
    guard += 1;
  }
  if (overlap <= 0) return result();

  // Phase 2 — compress the options grid's own internal gap + card padding.
  const gapDelta = (1 - GAP_SCALE_FLOOR) / GAP_SCALE_STEPS;
  guard = 0;
  while (overlap > 0 && gapScale > GAP_SCALE_FLOOR && guard < GAP_SCALE_STEPS) {
    gapScale = Math.max(GAP_SCALE_FLOOR, gapScale - gapDelta);
    optionsGridEl.style.setProperty('--option-gap-scale', String(gapScale));
    reequalizeCards(optionCards);
    ({ overlap, questionLines } = attemptFit());
    guard += 1;
  }
  if (overlap <= 0) return result();

  // Phase 3 — last resort: compress every gap in `.stage-safe` (reclaims
  // room from ALL four gaps, not just the options grid's own), and shrink
  // the turn header (its content was already shown seconds earlier in the
  // hand-off overlay — see this file's header comment). Only ever reached
  // on the pathological combined-worst-case fixture.
  const safeGapDelta = (1 - SAFE_GAP_SCALE_FLOOR) / SAFE_GAP_SCALE_STEPS;
  const turnHeaderDelta = (1 - TURN_HEADER_SHRINK_FLOOR) / TURN_HEADER_SHRINK_STEPS;
  guard = 0;
  while (overlap > 0 && (safeGapScale > SAFE_GAP_SCALE_FLOOR || turnHeaderShrink > TURN_HEADER_SHRINK_FLOOR) && guard < Math.max(SAFE_GAP_SCALE_STEPS, TURN_HEADER_SHRINK_STEPS)) {
    if (safeGapScale > SAFE_GAP_SCALE_FLOOR) safeGapScale = Math.max(SAFE_GAP_SCALE_FLOOR, safeGapScale - safeGapDelta);
    if (turnHeaderShrink > TURN_HEADER_SHRINK_FLOOR) turnHeaderShrink = Math.max(TURN_HEADER_SHRINK_FLOOR, turnHeaderShrink - turnHeaderDelta);
    safeEl.style.setProperty('--safe-gap-scale', String(safeGapScale));
    safeEl.style.setProperty('--turn-header-shrink', String(turnHeaderShrink));
    reequalizeCards(optionCards);
    ({ overlap, questionLines } = attemptFit());
    guard += 1;
  }
  if (overlap <= 0) return result();

  // Phase 4 — the disclosed, bounded exception: go below the stated §1.5
  // question floor. As the effective floor shrinks, `attemptFit`'s own
  // `maxLines` computation grows (the same pixel budget affords more lines
  // at a smaller font), so this is not merely "smaller text" — it also
  // re-opens room for the line count to grow, which is why this must run
  // AFTER phases 1-3 (it needs their gains as its starting budget), not
  // instead of them. Stops the moment overlap reaches zero; never goes
  // below `ABSOLUTE_MIN_QUESTION_PX`.
  const floorDelta = (floorQuestionPx - ABSOLUTE_MIN_QUESTION_PX) / PHASE4_STEPS;
  guard = 0;
  while (overlap > 0 && effectiveFloor > ABSOLUTE_MIN_QUESTION_PX && guard < PHASE4_STEPS) {
    effectiveFloor = Math.max(ABSOLUTE_MIN_QUESTION_PX, effectiveFloor - floorDelta);
    ({ overlap, questionLines } = attemptFit(effectiveFloor));
    guard += 1;
  }

  return result();
}
