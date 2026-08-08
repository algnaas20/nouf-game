import { buildUndoCorner } from '../undo-corner';

export interface HomeScreenParams {
  onStart: () => void;
  /**
   * Reaches the editor («أسئلتي»), per `stage-ux-investigation.md` §5.4's
   * ruled placement: "same app, its own screen, reached only from the home
   * screen. Not a mode toggle." Deliberately rendered as a plain (non-
   * `primary`) `op-button` — visually secondary to «ابدأ اللعبة» — and only
   * ever reachable from this one screen, which itself only appears before
   * any game has started (never mid-play), so a guest cannot land on it by
   * a stray tap during the majlis (§5.4's rejected "mode toggle visible
   * during play" alternative).
   */
  onOpenEditor: () => void;
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

  // «أسئلتي» — same word as the editor screen's own title
  // (`src/editor/copy.ts`'s `AR_COPY.questionsTitle`), from the wireframe in
  // stage-ux-investigation.md §5.4. Plain (non-primary) styling on purpose —
  // the host's play-night action must stay visually dominant.
  const editorBtn = document.createElement('button');
  editorBtn.type = 'button';
  editorBtn.className = 'op-button type-operator-button home-secondary-button';
  editorBtn.textContent = 'أسئلتي';
  editorBtn.addEventListener('click', p.onOpenEditor);

  screen.append(title, startBtn, editorBtn);
  safe.append(screen);
  // Same corner as every other screen (§4.5) — nothing to undo yet, so disabled.
  safe.append(buildUndoCorner(false, () => {}));
  container.append(safe);
}
