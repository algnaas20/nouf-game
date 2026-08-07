import type { OptionIndex, Question } from '../../contracts/question';
import { fitQuestionText } from '../fit-text';
import { decideOptionsLayout, equalizeCardHeights } from '../options-layout';
import { formatDigits } from '../format-digits';
import { buildUndoCorner } from '../undo-corner';

export interface QuestionScreenParams {
  question: Question;
  optionOrder: [OptionIndex, OptionIndex, OptionIndex, OptionIndex];
  teamNames: [string, string];
  answeringTeam: 'A' | 'B';
  scores: [number, number];
  revealed: boolean;
  chosenOption: OptionIndex | null;
  canUndo: boolean;
  onChoose: (optionIndex: OptionIndex) => void;
  onNext: () => void;
  onUndo: () => void;
}

const LETTERS = ['أ', 'ب', 'ج', 'د'];

/**
 * Renders the text-question screen. Pre-reveal, all four `.option-card`
 * elements are structurally and stylistically identical apart from their
 * text — no attribute, class or dataset key on any of them encodes which
 * one is correct (§4.9, V20/V21). The correctness comparison happens only
 * inside `onChoose`, driven by session state, never read back from the DOM.
 */
export function renderQuestionScreen(container: HTMLElement, p: QuestionScreenParams): void {
  container.innerHTML = '';

  const safe = document.createElement('div');
  safe.className = 'stage-safe';

  // ---- status strip ----
  const status = document.createElement('div');
  status.className = 'status-strip';

  const teamBlock = (team: 'A' | 'B', name: string, score: number) => {
    const el = document.createElement('div');
    el.className = 'status-team';
    const dot = document.createElement('span');
    dot.className = `status-team-dot team-${team.toLowerCase()}`;
    const label = document.createElement('span');
    label.className = 'type-team-name';
    label.textContent = name;
    const scoreEl = document.createElement('span');
    scoreEl.className = 'type-score';
    scoreEl.textContent = formatDigits(score);
    el.append(dot, label, scoreEl);
    return el;
  };

  status.append(
    teamBlock('A', p.teamNames[0], p.scores[0]),
    teamBlock('B', p.teamNames[1], p.scores[1]),
  );

  // ---- question text ----
  const qArea = document.createElement('div');
  qArea.className = 'question-area';
  const qText = document.createElement('p');
  qText.className = 'question-text type-question';
  qText.textContent = p.question.text;
  qArea.append(qText);

  // ---- options ----
  const grid = document.createElement('div');
  grid.className = 'options-grid';

  const cards: HTMLElement[] = [];
  const textEls: HTMLElement[] = [];

  for (const slotIndex of p.optionOrder) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'option-card';
    // data-option-index encodes the option's POSITION only (needed to route
    // the tap), never correctness — identical mechanism on all four cards.
    card.dataset.optionIndex = String(slotIndex);

    const letter = document.createElement('span');
    letter.className = 'option-letter-chip type-option-letter';
    letter.textContent = LETTERS[cards.length] ?? '';

    const text = document.createElement('span');
    text.className = 'option-text type-option';
    text.textContent = p.question.options[slotIndex];

    card.append(letter, text);
    card.addEventListener('click', () => {
      if (p.revealed) return;
      p.onChoose(slotIndex);
    });

    cards.push(card);
    textEls.push(text);
    grid.append(card);
  }

  safe.append(status, qArea, grid);

  // ---- result banner (only present once revealed — never pre-rendered) ----
  if (p.revealed) {
    const correctSlot = p.question.correctIndex;
    for (const card of cards) {
      const idx = Number(card.dataset.optionIndex) as OptionIndex;
      if (idx === correctSlot) card.classList.add('is-correct');
      else if (idx === p.chosenOption) card.classList.add('is-wrong-picked');
    }
    const isCorrect = p.chosenOption === correctSlot;
    const banner = document.createElement('div');
    banner.className = 'result-banner';
    banner.style.borderInline = `calc(4 * var(--stage-unit)) solid ${isCorrect ? 'var(--color-correct)' : 'var(--color-wrong)'}`;
    banner.style.borderBlock = `calc(4 * var(--stage-unit)) solid ${isCorrect ? 'var(--color-correct)' : 'var(--color-wrong)'}`;
    banner.style.borderRadius = 'calc(16 * var(--stage-unit))';
    banner.style.padding = 'calc(16 * var(--stage-unit)) calc(32 * var(--stage-unit))';
    const word = document.createElement('span');
    word.className = 'type-result-word';
    word.textContent = (isCorrect ? '✓ ' : '✗ ') + (isCorrect ? 'صحيح' : 'خطأ');
    banner.append(word);
    safe.append(banner);
  }

  // ---- operator bar ----
  const bar = document.createElement('div');
  bar.className = 'operator-bar';
  const barEnd = document.createElement('div');
  barEnd.className = 'operator-bar-end';
  if (p.revealed) {
    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'op-button primary type-operator-button';
    nextBtn.textContent = 'السؤال التالي';
    nextBtn.addEventListener('click', p.onNext);
    barEnd.append(nextBtn);
  }
  bar.append(barEnd);
  safe.append(bar);

  // ---- undo, same corner on every screen ----
  safe.append(buildUndoCorner(p.canUndo, p.onUndo));

  container.append(safe);

  // ---- layout passes: run synchronously after insertion (forces reflow) ----
  decideOptionsLayout(grid, textEls);
  equalizeCardHeights(cards);

  // ---- auto-fit question text, after fonts are ready, never on first paint ----
  // Read the resolved nominal px directly from the computed style (the
  // browser has already composed --stage-unit * --scale-step into it) —
  // never re-derive custom-property arithmetic in JS, which is unreliable
  // for unregistered CSS custom properties.
  const nominalPx = parseFloat(getComputedStyle(qText).fontSize);
  const floorPx = nominalPx * (56 / 76);
  void document.fonts.ready.then(() => {
    fitQuestionText(qText, {
      nominalPx,
      floorPx,
      lineHeight: 1.9, // must match .type-question's CSS line-height — see stage.css comment
    });
  });
}
