import type { OptionIndex, Question, TeamId } from '../../contracts';
import { decideOptionsLayout, equalizeCardHeights } from '../options-layout';
import { buildUndoCorner } from '../undo-corner';
import type { MediaUiState } from './media-ui-state';
import {
  buildStatusStrip,
  buildTurnHeader,
  buildOptionsGrid,
  buildResultBanner,
  buildOperatorBar,
} from './chrome';

export interface ImageQuestionScreenParams {
  question: Question;
  imageUrl: string;
  optionOrder: [OptionIndex, OptionIndex, OptionIndex, OptionIndex];
  teamNames: [string, string];
  answeringTeam: TeamId;
  positions: [number, number];
  revealed: boolean;
  chosenOption: OptionIndex | null;
  canUndo: boolean;
  mediaUi: MediaUiState;
  setMediaUi: (patch: Partial<MediaUiState>) => void;
  onChoose: (optionIndex: OptionIndex) => void;
  onNoAnswer: () => void;
  onNext: () => void;
  onUndo: () => void;
}

function otherTeam(t: TeamId): TeamId {
  return t === 'A' ? 'B' : 'A';
}

function buildImageEl(url: string, className: string, onError: () => void): HTMLImageElement {
  const img = document.createElement('img');
  img.src = url;
  img.alt = '';
  // Constraint row 12: every image is loading="lazy". Meaningful for real
  // network-fetched media — the demo deck's placeholder images are data:
  // URLs (disclosed in placeholder-media.ts); the attribute is still
  // present and correct for real authored packs.
  img.loading = 'lazy';
  img.className = className;
  img.addEventListener('error', onError);
  return img;
}

/**
 * Image-question screen — Skeleton B (stage-ux-investigation.md §6.2),
 * two beats so the image and the options never compete for the same
 * vertical space:
 *   Beat 1 — image (up to 1728x720, `object-fit: contain`) with the
 *            question text on a solid (not translucent, so contrast is
 *            exact, never a compositing guess) bar; «اعرض الخيارات» moves
 *            to Beat 2. No options in the DOM at all in Beat 1 — there is
 *            nothing to conceal or leak because nothing is rendered yet.
 *   Beat 2 — a fixed 660x660 stage-px image column (floor 620x620, V11)
 *            beside a stacked 1x4 options column, built by the SAME
 *            `buildOptionsGrid` every other screen type uses (§4.9).
 * D-09.19: image questions are NOT phased for correctness-reveal purposes —
 * options are simply not laid out until Beat 2 (a spatial choice, the
 * report's own explicit second-tap allowance), never a timed concealment.
 * `revealed` always forces Beat 2 (the reveal must be visible).
 */
export function renderImageQuestionScreen(container: HTMLElement, p: ImageQuestionScreenParams): void {
  container.innerHTML = '';

  const safe = document.createElement('div');
  safe.className = 'stage-safe';

  const teamNameOf = (t: TeamId) => (t === 'A' ? p.teamNames[0] : p.teamNames[1]);
  const readingTeam = otherTeam(p.answeringTeam);

  safe.append(
    buildStatusStrip(p.teamNames, p.positions),
    buildTurnHeader(teamNameOf(readingTeam), teamNameOf(p.answeringTeam)),
  );

  const beat = p.revealed ? 2 : p.mediaUi.imageBeat;

  if (beat === 1) {
    const imgArea = document.createElement('div');
    imgArea.className = 'image-beat1-area';
    const img = buildImageEl(p.imageUrl, 'image-beat1-img', () => {
      imgArea.innerHTML = '';
      const msg = document.createElement('p');
      msg.className = 'type-question media-error';
      msg.textContent = 'تعذّر عرض الصورة لهذا السؤال. تابعوا بالسؤال نصّياً.';
      imgArea.append(msg);
    });
    const overlay = document.createElement('div');
    overlay.className = 'image-question-overlay';
    const qText = document.createElement('p');
    qText.className = 'type-question';
    qText.textContent = p.question.text;
    overlay.append(qText);
    imgArea.append(img, overlay);
    safe.append(imgArea);

    const showOptionsBtn = document.createElement('button');
    showOptionsBtn.type = 'button';
    showOptionsBtn.className = 'op-button primary type-operator-button';
    showOptionsBtn.textContent = 'اعرض الخيارات';
    showOptionsBtn.addEventListener('click', () => p.setMediaUi({ imageBeat: 2 }));

    safe.append(
      buildOperatorBar({
        extraButtons: [showOptionsBtn],
        revealed: false,
        noAnswerDisabled: true,
        onNoAnswer: () => {},
        onNext: () => {},
      }),
    );
  } else {
    const beat2 = document.createElement('div');
    beat2.className = 'image-beat2';

    const optionsCol = document.createElement('div');
    optionsCol.className = 'image-beat2-options';
    const { grid, cards, textEls } = buildOptionsGrid({
      question: p.question,
      optionOrder: p.optionOrder,
      revealed: p.revealed,
      chosenOption: p.chosenOption,
      disabled: false,
      onChoose: p.onChoose,
    });
    grid.classList.add('stacked');
    optionsCol.append(grid);

    const imageCol = document.createElement('div');
    imageCol.className = 'image-beat2-image-col';
    const imgBox = document.createElement('div');
    imgBox.className = 'image-beat2-image-box'; // fixed 660x660 stage-px — floor 620x620, V11.
    const img = buildImageEl(p.imageUrl, 'image-beat2-img', () => {
      imgBox.innerHTML = '';
      const msg = document.createElement('p');
      msg.className = 'type-option media-error';
      msg.textContent = 'تعذّر عرض الصورة لهذا السؤال. تابعوا بالسؤال نصّياً.';
      imgBox.append(msg);
    });
    imgBox.append(img);
    const qText = document.createElement('p');
    qText.className = 'type-option image-beat2-question-text';
    qText.textContent = p.question.text;
    imageCol.append(imgBox, qText);

    beat2.append(optionsCol, imageCol);
    safe.append(beat2);

    if (p.revealed) {
      const isCorrect = p.chosenOption === p.question.correctIndex;
      safe.append(buildResultBanner(isCorrect));
    }

    safe.append(
      buildOperatorBar({
        revealed: p.revealed,
        noAnswerDisabled: p.revealed,
        onNoAnswer: p.onNoAnswer,
        onNext: p.onNext,
      }),
    );

    safe.append(buildUndoCorner(p.canUndo, p.onUndo));
    container.append(safe);
    decideOptionsLayout(grid, textEls);
    equalizeCardHeights(cards);
    return;
  }

  safe.append(buildUndoCorner(p.canUndo, p.onUndo));
  container.append(safe);
}
