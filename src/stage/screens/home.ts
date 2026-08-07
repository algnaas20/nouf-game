import { buildUndoCorner } from '../undo-corner';

export interface HomeScreenParams {
  onStart: () => void;
}

/** `AR-COPY` «ابدأ اللعبة» — literal, from stage-ux-investigation.md §5.4. */
export function renderHomeScreen(container: HTMLElement, p: HomeScreenParams): void {
  container.innerHTML = '';

  const safe = document.createElement('div');
  safe.className = 'stage-safe';

  const screen = document.createElement('div');
  screen.className = 'centered-screen';

  const title = document.createElement('h1');
  title.className = 'type-winner-headline';
  title.textContent = 'لعبة نوف';

  const startBtn = document.createElement('button');
  startBtn.type = 'button';
  startBtn.className = 'op-button primary type-operator-button';
  startBtn.textContent = 'ابدأ اللعبة';
  startBtn.addEventListener('click', p.onStart);

  screen.append(title, startBtn);
  safe.append(screen);
  // Same corner as every other screen (§4.5) — nothing to undo yet, so disabled.
  safe.append(buildUndoCorner(false, () => {}));
  container.append(safe);
}
