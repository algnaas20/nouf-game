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

export interface OperatorBarParams {
  /** Extra type-specific controls (volume, أعِد التشغيل, اعرض الخيارات),
   *  placed at the inline-start end of the bar — always present, never
   *  hidden behind a menu (§4.3). */
  extraButtons?: HTMLElement[];
  revealed: boolean;
  noAnswerDisabled?: boolean;
  onNoAnswer: () => void;
  onNext: () => void;
}

/** «لم يجيبوا» (pre-reveal) / «السؤال التالي» (post-reveal), plus any
 *  type-specific extra controls — the full operator bar shared by every
 *  question screen type. */
export function buildOperatorBar(p: OperatorBarParams): HTMLElement {
  const bar = document.createElement('div');
  bar.className = 'operator-bar';

  const barStart = document.createElement('div');
  barStart.className = 'operator-bar-start';
  for (const el of p.extraButtons ?? []) barStart.append(el);

  const barEnd = document.createElement('div');
  barEnd.className = 'operator-bar-end';

  if (p.revealed) {
    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'op-button primary type-operator-button';
    nextBtn.textContent = 'السؤال التالي';
    nextBtn.addEventListener('click', p.onNext);
    barEnd.append(nextBtn);
  } else {
    const noAnswerBtn = document.createElement('button');
    noAnswerBtn.type = 'button';
    noAnswerBtn.className = 'op-button type-operator-button';
    noAnswerBtn.textContent = 'لم يجيبوا';
    noAnswerBtn.disabled = Boolean(p.noAnswerDisabled);
    noAnswerBtn.addEventListener('click', p.onNoAnswer);
    barEnd.append(noAnswerBtn);
  }

  bar.append(barStart, barEnd);
  return bar;
}
