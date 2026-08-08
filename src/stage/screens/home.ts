import { buildUndoCorner } from '../undo-corner';
import { formatDigits } from '../format-digits';

export interface HomeScreenParams {
  onStart: () => void;
  /**
   * Reaches the editor («أسئلتي»), per `stage-ux-investigation.md` §5.4's
   * ruled placement: "same app, its own screen, reached only from the home
   * screen. Not a mode toggle." Only ever reachable from this one screen,
   * which itself only appears before any game has started (never mid-play),
   * so a guest cannot land on it by a stray tap during the majlis (§5.4's
   * rejected "mode toggle visible during play" alternative).
   */
  onOpenEditor: () => void;
  /**
   * D-25 (2026-08-08): "ما أبي أسئلة جاهزة، يكون الشخص يحط الأسئلة كاملة
   * بعدين يسوي المسابقة" — there is no bundled demo deck any more, so
   * opening the published link for the very first time lands on a deck of
   * zero questions. That is now the normal first experience, a **designed
   * primary path**, not an edge case or an error: this screen's whole job
   * when `questionCount === 0` is making the next step (author your
   * questions) the obvious one, per `rtl-stage-ux-expert`'s §5 (a "calm,
   * unhurried" authoring model — never a red/alarming error state on the
   * screen a non-technical host sees first).
   */
  questionCount: number;
}

/** `AR-COPY` «ابدأ اللعبة» / «أسئلتي» — literal, from stage-ux-investigation.md
 *  §5.4. The zero-question guidance line is composed (no Appendix أ literal
 *  covers this exact moment — the closest entry, §4.7's "the published game
 *  has no questions" row, predates D-25 and describes it as a *failure*
 *  path with a different button; D-25 overrides that framing entirely, see
 *  worklog-B5.md), disclosed here rather than presented as scripted. */
export function renderHomeScreen(container: HTMLElement, p: HomeScreenParams): void {
  container.innerHTML = '';

  const safe = document.createElement('div');
  safe.className = 'stage-safe';

  const screen = document.createElement('div');
  screen.className = 'centered-screen';

  const title = document.createElement('h1');
  title.className = 'type-winner-headline';
  title.textContent = 'لعبة نوف';

  const hasQuestions = p.questionCount > 0;

  const startBtn = document.createElement('button');
  startBtn.type = 'button';
  startBtn.className = hasQuestions
    ? 'op-button primary type-operator-button'
    : 'op-button type-operator-button home-secondary-button';
  startBtn.textContent = 'ابدأ اللعبة';
  startBtn.addEventListener('click', p.onStart);

  // «أسئلتي» — same word as the editor screen's own title
  // (`src/editor/copy.ts`'s `AR_COPY.questionsTitle`), from the wireframe in
  // stage-ux-investigation.md §5.4. Visually dominant (`primary`) exactly
  // when there is nothing to play yet — the obvious next step for a host
  // who just opened the link for the first time — and secondary once a
  // deck exists, so «ابدأ اللعبة» stays the dominant action on play night.
  const editorBtn = document.createElement('button');
  editorBtn.type = 'button';
  editorBtn.className = hasQuestions
    ? 'op-button type-operator-button home-secondary-button'
    : 'op-button primary type-operator-button';
  editorBtn.textContent = 'أسئلتي';
  editorBtn.addEventListener('click', p.onOpenEditor);

  screen.append(title);

  if (!hasQuestions) {
    // Composed — see the file header comment. Not from Appendix أ.
    const guidance = document.createElement('p');
    guidance.className = 'type-option home-guidance-line';
    guidance.textContent = 'لا توجد أسئلة بعد — أضف أسئلتك من «أسئلتي» قبل أن تبدأ اللعبة.';
    screen.append(guidance);
    // Order matches visual dominance: the obvious next step comes first.
    screen.append(editorBtn, startBtn);
  } else {
    // Composed count line — reassures a host returning to this screen after
    // authoring that his work is really there (no Appendix أ literal for
    // this either; §5A.4's "اسم لعبتك وعدد الأسئلة" verification line
    // requires a per-pack title field that does not exist yet — see
    // worklog-B5.md's disclosed limitation — so only the count half ships).
    const countLine = document.createElement('p');
    countLine.className = 'type-option home-guidance-line';
    countLine.textContent = `أسئلتك: ${formatDigits(p.questionCount)}`;
    screen.append(countLine, startBtn, editorBtn);
  }

  safe.append(screen);
  // Same corner as every other screen (§4.5) — nothing to undo yet, so disabled.
  safe.append(buildUndoCorner(false, () => {}));
  container.append(safe);
}
