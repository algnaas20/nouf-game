import { formatDigits } from '../format-digits';
import { buildUndoCorner } from '../undo-corner';

export interface WinnerScreenParams {
  teamNames: [string, string];
  scores: [number, number];
  canUndo: boolean;
  onRestart: () => void;
  onUndo: () => void;
}

/**
 * PLACEHOLDER winner screen for the PH-B1 walking skeleton only. The ruled
 * ending copy (D-09.14/15/16 — "فاز فريق ⟨أ⟩ بالتقدّم — N مقابل M", the
 * no-celebration wording, the decider) belongs to PH-B3 and is explicitly
 * out of scope here (no maze, no R-b, no exhaustion model in B1). This
 * screen exists only to exercise the winner-headline type role and close
 * the two-tap loop with a real third screen — it must not be mistaken for
 * final product copy.
 */
export function renderWinnerScreen(container: HTMLElement, p: WinnerScreenParams): void {
  container.innerHTML = '';

  const safe = document.createElement('div');
  safe.className = 'stage-safe';

  const screen = document.createElement('div');
  screen.className = 'centered-screen';

  const winnerIdx = p.scores[0] === p.scores[1] ? -1 : p.scores[0] > p.scores[1] ? 0 : 1;

  const headline = document.createElement('h1');
  headline.className = 'type-winner-headline';
  headline.textContent = winnerIdx === -1 ? 'تعادل' : `فاز ${p.teamNames[winnerIdx]}`;

  const scoreLine = document.createElement('div');
  scoreLine.className = 'status-strip';
  for (let i = 0; i < 2; i++) {
    const block = document.createElement('div');
    block.className = 'status-team';
    const name = document.createElement('span');
    name.className = 'type-team-name';
    name.textContent = p.teamNames[i] ?? '';
    const score = document.createElement('span');
    score.className = 'type-score';
    score.textContent = formatDigits(p.scores[i] ?? 0);
    block.append(name, score);
    scoreLine.append(block);
  }

  const restartBtn = document.createElement('button');
  restartBtn.type = 'button';
  restartBtn.className = 'op-button primary type-operator-button';
  restartBtn.textContent = 'لعبة جديدة';
  restartBtn.addEventListener('click', p.onRestart);

  screen.append(headline, scoreLine, restartBtn);
  safe.append(screen);
  safe.append(buildUndoCorner(p.canUndo, p.onUndo));
  container.append(safe);
}
