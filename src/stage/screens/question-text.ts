import type { OptionIndex, Question, TeamId } from '../../contracts';
import { fitCombinedLayout } from '../fit-combined';
import { decideOptionsLayout, equalizeCardHeights } from '../options-layout';
import { buildUndoCorner } from '../undo-corner';
import {
  buildStatusStrip,
  buildTurnHeader,
  buildOptionsGrid,
  buildResultBanner,
  buildOperatorBar,
  type RouteOption,
} from './chrome';

export interface TextQuestionScreenParams {
  question: Question;
  optionOrder: [OptionIndex, OptionIndex, OptionIndex, OptionIndex];
  teamNames: [string, string];
  answeringTeam: TeamId;
  positions: [number, number];
  revealed: boolean;
  chosenOption: OptionIndex | null;
  canUndo: boolean;
  onChoose: (optionIndex: OptionIndex) => void;
  onNoAnswer: () => void;
  moveOptions: RouteOption[];
  onUndo: () => void;
}

function otherTeam(t: TeamId): TeamId {
  return t === 'A' ? 'B' : 'A';
}

/** Text-question screen: options appear immediately (D-09.19 — no phasing
 *  for text/image), question above a 2x2/1x4 options grid. Owns the
 *  combined question+options vertical fit (fit-combined.ts) that closes the
 *  worklog-B1.md §V4b overlap on the worst-case fixture. */
export function renderTextQuestionScreen(container: HTMLElement, p: TextQuestionScreenParams): void {
  container.innerHTML = '';

  const safe = document.createElement('div');
  safe.className = 'stage-safe';

  const teamNameOf = (t: TeamId) => (t === 'A' ? p.teamNames[0] : p.teamNames[1]);
  const readingTeam = otherTeam(p.answeringTeam);

  const status = buildStatusStrip(p.teamNames, p.positions);
  const turnHeader = buildTurnHeader(teamNameOf(readingTeam), teamNameOf(p.answeringTeam));

  const qArea = document.createElement('div');
  qArea.className = 'question-area';
  const qText = document.createElement('p');
  qText.className = 'question-text type-question';
  qText.textContent = p.question.text;
  qArea.append(qText);

  const { grid, cards, textEls } = buildOptionsGrid({
    question: p.question,
    optionOrder: p.optionOrder,
    revealed: p.revealed,
    chosenOption: p.chosenOption,
    disabled: false,
    onChoose: p.onChoose,
  });

  safe.append(status, turnHeader, qArea, grid);

  if (p.revealed) {
    const isCorrect = p.chosenOption === p.question.correctIndex;
    safe.append(buildResultBanner(isCorrect));
  }

  safe.append(
    buildOperatorBar({
      revealed: p.revealed,
      noAnswerDisabled: p.revealed,
      onNoAnswer: p.onNoAnswer,
      moveOptions: p.moveOptions,
    }),
  );
  safe.append(buildUndoCorner(p.canUndo, p.onUndo));

  container.append(safe);

  // ---- layout passes: run synchronously after insertion (forces reflow) ----
  grid.style.removeProperty('--option-shrink');
  grid.style.removeProperty('--option-gap-scale');
  decideOptionsLayout(grid, textEls);
  equalizeCardHeights(cards);

  const nominalPx = parseFloat(getComputedStyle(qText).fontSize);
  const floorPx = nominalPx * (56 / 76);
  void document.fonts.ready.then(() => {
    // fit-combined.ts owns the whole question+options fit now — it calls
    // fitQuestionText itself with a real, measured line-count budget
    // (worklog-B2.md §6: growing lines with no awareness of the flex
    // parent's actual remaining allocation was the root cause of the
    // worklog-B1.md §V4b collision, not merely an insufficiently
    // aggressive option shrink).
    fitCombinedLayout({
      safeEl: safe,
      questionAreaEl: qArea,
      questionTextEl: qText,
      optionsGridEl: grid,
      optionCards: cards,
      nominalQuestionPx: nominalPx,
      floorQuestionPx: floorPx,
      questionLineHeight: 1.9, // must match .type-question's CSS line-height — see stage.css comment
    });
  });
}
