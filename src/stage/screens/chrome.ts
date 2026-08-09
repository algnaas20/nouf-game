/**
 * Shared question-screen chrome — status strip, the permanent turn header
 * (Ruling 1: the handoff overlay "dissolves into the question and leaves a
 * permanent header strip carrying the same two names for the whole
 * question"), the options grid, the result banner and the operator bar.
 *
 * Used identically by the text/image/audio question screens (question.ts's
 * dispatcher) — this is *how* the no-tell guarantee (§4.9, V20/V21) holds
 * across all three media kinds: there is exactly one function that builds
 * an `.option-card`, and every screen type calls it, so a leak fixed once
 * is fixed everywhere and a leak introduced once shows up in all three.
 */
import type { OptionIndex, Question, TeamId } from '../../contracts';
import { formatDigits } from '../format-digits';

const LETTERS = ['أ', 'ب', 'ج', 'د'];

export function buildStatusStrip(teamNames: [string, string], positions: [number, number]): HTMLElement {
  const status = document.createElement('div');
  status.className = 'status-strip';

  const teamBlock = (team: TeamId, name: string, position: number) => {
    const el = document.createElement('div');
    el.className = 'status-team';
    const dot = document.createElement('span');
    dot.className = `status-team-dot team-${team.toLowerCase()}`;
    const label = document.createElement('span');
    label.className = 'type-team-name';
    label.textContent = name;
    const scoreEl = document.createElement('span');
    scoreEl.className = 'type-score';
    scoreEl.textContent = formatDigits(position);
    el.append(dot, label, scoreEl);
    return el;
  };

  status.append(teamBlock('A', teamNames[0], positions[0]), teamBlock('B', teamNames[1], positions[1]));
  return status;
}

/**
 * `AR-COPY`, literal, from play-experience-advisor's ruling and Appendix أ:
 * «فريق ⟨أ⟩ يوجّه السؤال ← فريق ⟨ب⟩ يجاوب» — the reading (non-answering)
 * team is named first, the answering team second, exactly as the handoff
 * overlay states it. Kept visible for the whole life of the question
 * (Ruling 1, constraint 1).
 */
export function buildTurnHeader(readingTeamName: string, answeringTeamName: string): HTMLElement {
  const header = document.createElement('p');
  header.className = 'turn-header type-turn-banner';
  header.textContent = `فريق ${readingTeamName} يوجّه السؤال ← فريق ${answeringTeamName} يجاوب`;
  return header;
}

export interface OptionsGridResult {
  grid: HTMLElement;
  cards: HTMLElement[];
  textEls: HTMLElement[];
}

export interface BuildOptionsGridParams {
  question: Question;
  optionOrder: [OptionIndex, OptionIndex, OptionIndex, OptionIndex];
  revealed: boolean;
  chosenOption: OptionIndex | null;
  /** Options exist in the DOM but are not tappable yet — e.g. audio's
   *  "hidden during first playback" phase (D-09.19) still renders the grid
   *  (for layout/no-tell reasons — see question-audio.ts) with taps
   *  disabled and the cards visually concealed by an overlay, never by
   *  omitting them from the DOM (omitting them would be a second, harder
   *  leak: their absence would itself tell the room "the options aren't
   *  here yet", which is fine — the concealment is a deliberate opaque
   *  overlay class, not a correctness-encoding one). */
  disabled: boolean;
  onChoose: (optionIndex: OptionIndex) => void;
}

/**
 * Renders the four option cards. Pre-reveal, all four are structurally and
 * stylistically identical apart from their text — no attribute, class or
 * dataset key on any of them encodes which one is correct (§4.9, V20/V21).
 * The correctness comparison happens only inside the caller's `onChoose`
 * (session state), never read back from the DOM.
 */
export function buildOptionsGrid(p: BuildOptionsGridParams): OptionsGridResult {
  const grid = document.createElement('div');
  grid.className = 'options-grid';

  const cards: HTMLElement[] = [];
  const textEls: HTMLElement[] = [];

  for (const slotIndex of p.optionOrder) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'option-card';
    card.disabled = p.disabled;
    // data-option-index encodes the option's POSITION only (needed to route
    // the tap), never correctness — identical mechanism on all four cards.
    card.dataset.optionIndex = String(slotIndex);

    const letter = document.createElement('span');
    letter.className = 'option-letter-chip type-option-letter';
    letter.textContent = LETTERS[cards.length] ?? '';

    const text = document.createElement('span');
    text.className = 'option-text type-option';
    text.textContent = p.question.options[slotIndex] ?? '';

    card.append(letter, text);
    card.addEventListener('click', () => {
      if (p.revealed || p.disabled) return;
      p.onChoose(slotIndex);
    });

    cards.push(card);
    textEls.push(text);
    grid.append(card);
  }

  if (p.revealed) {
    const correctSlot = p.question.correctIndex;
    for (const card of cards) {
      const idx = Number(card.dataset.optionIndex) as OptionIndex;
      if (idx === correctSlot) card.classList.add('is-correct');
      else if (idx === p.chosenOption) card.classList.add('is-wrong-picked');
    }
  }

  return { grid, cards, textEls };
}

export function buildResultBanner(isCorrect: boolean): HTMLElement {
  const banner = document.createElement('div');
  banner.className = `result-banner ${isCorrect ? 'is-correct' : 'is-wrong'}`;
  const word = document.createElement('span');
  word.className = 'type-result-word';
  word.textContent = (isCorrect ? '✓ ' : '✗ ') + (isCorrect ? 'صحيح' : 'خطأ');
  banner.append(word);
  return banner;
}

/** D-09.9: the decider question screen carries a different colour — a
 *  small badge above the turn header, «سؤال الحسم», styled distinctly
 *  (`.decider-badge` — amber, matching the handoff overlay's tiebreak
 *  variant) so the room recognizes it as the same moment continuing. */
export function buildDeciderBadge(): HTMLElement {
  const badge = document.createElement('p');
  badge.className = 'decider-badge type-option';
  badge.textContent = 'سؤال الحسم';
  return badge;
}

/**
 * game-systems-expert 2026-08-08 §7 / rtl-stage-ux-expert addendum-maze-ux.md
 * §1 — the route tap. One card per candidate `MOVE_APPLIED` event: a
 * correct answer yields 2-3 (one per open exit, R-1's أ/ب/ج convention,
 * `letterChip` set); a wrong answer / already-at-goal yields exactly one,
 * «السؤال التالي» (`letterChip` unset — same visual family as the old
 * single next-button, never styled like a route choice).
 */
export interface RouteOption {
  key: string;
  label: string;
  letterChip?: string;
  onSelect: () => void;
}

/** Addendum §1.5: cards are inert for ~400ms after this band mounts —
 *  declared interpretation (worklog-B7.md §2): measured from mount, since
 *  no token animation is ever mid-flight at the instant these cards first
 *  appear (the token-run animation happens strictly AFTER a card is
 *  tapped, on the next screen — `maze-beat.ts`). Prevents the residual
 *  momentum of tap 1 (the answer tap, which just fired the reveal this
 *  band appears under) from landing on tap 2. */
export const ROUTE_CARD_ARM_DELAY_MS = 400;

/**
 * The fixed action band (addendum §1.5): same 160-stage-px band, same
 * vertical position, every beat, every outcome (V33 — action-band
 * invariance) — only the card count and labels change. Never placed on the
 * maze itself (V36 — the board is never a tap target; it only labels and
 * highlights the mouths, `maze-view.ts`'s ADJACENT register).
 */
export function buildRouteActionBand(options: readonly RouteOption[]): HTMLElement {
  const band = document.createElement('div');
  band.className = 'route-action-band';
  const row = document.createElement('div');
  row.className = 'route-card-row';
  row.style.setProperty('--route-card-count', String(options.length));

  const buttons: HTMLButtonElement[] = [];
  for (const opt of options) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'route-card' + (opt.letterChip ? '' : ' route-card-solo');
    btn.dataset.routeKey = opt.key;
    btn.disabled = true; // armed below, after ROUTE_CARD_ARM_DELAY_MS.
    if (opt.letterChip) {
      const chip = document.createElement('span');
      chip.className = 'route-card-letter';
      chip.textContent = opt.letterChip;
      btn.append(chip);
    }
    const label = document.createElement('span');
    label.className = 'route-card-label type-route-card';
    label.textContent = opt.label;
    btn.append(label);
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      opt.onSelect();
    });
    row.append(btn);
    buttons.push(btn);
  }
  band.append(row);

  window.setTimeout(() => {
    for (const btn of buttons) btn.disabled = false;
  }, ROUTE_CARD_ARM_DELAY_MS);

  return band;
}

export interface OperatorBarParams {
  /** Extra type-specific controls (volume, أعِد التشغيل, اعرض الخيارات),
   *  placed at the inline-start end of the bar — always present, never
   *  hidden behind a menu (§4.3). */
  extraButtons?: HTMLElement[];
  revealed: boolean;
  noAnswerDisabled?: boolean;
  onNoAnswer: () => void;
  /** Required when `revealed` is true — the route action band's cards
   *  (`buildRouteActionBand` above). Ignored pre-reveal. */
  moveOptions?: RouteOption[];
}

/** «لم يجيبوا» (pre-reveal, 104 stage-px band, unchanged) / the fixed route
 *  action band (post-reveal, 160 stage-px, invariant — V33), plus any
 *  type-specific extra controls — shared by every question screen type. */
export function buildOperatorBar(p: OperatorBarParams): HTMLElement {
  const bar = document.createElement('div');
  bar.className = p.revealed ? 'operator-bar operator-bar-revealed' : 'operator-bar';

  const barStart = document.createElement('div');
  barStart.className = 'operator-bar-start';
  for (const el of p.extraButtons ?? []) barStart.append(el);

  if (p.revealed) {
    bar.append(barStart, buildRouteActionBand(p.moveOptions ?? []));
    return bar;
  }

  const barEnd = document.createElement('div');
  barEnd.className = 'operator-bar-end';
  const noAnswerBtn = document.createElement('button');
  noAnswerBtn.type = 'button';
  noAnswerBtn.className = 'op-button type-operator-button';
  noAnswerBtn.textContent = 'لم يجيبوا';
  noAnswerBtn.disabled = Boolean(p.noAnswerDisabled);
  noAnswerBtn.addEventListener('click', p.onNoAnswer);
  barEnd.append(noAnswerBtn);

  bar.append(barStart, barEnd);
  return bar;
}
