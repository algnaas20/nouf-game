/**
 * The resume prompt (D-09.19/§6.3, خطة.md PH-A4 criterion 4) — the visible
 * half of session persistence. `src/core/session-store.ts`'s `checkResume()`
 * (WL-A) is the complete data contract; this file is the ONLY thing that
 * decides what the room sees, and it decides nothing else — never
 * auto-resumes, never auto-discards.
 *
 * Two screens, both reached only once, at cold start, before any game
 * exists in this tab's `mountApp` call:
 *   - `renderResumePromptScreen` — a stored, resumable session exists
 *     (`ResumeCheck.kind === 'available'`). Literal buttons «تكملة الجلسة»/
 *     «جلسة جديدة» (خطة.md Appendix أ). The context line reuses
 *     `chrome.ts`'s own `buildStatusStrip` — the EXACT component the room
 *     already saw live during play — so the screen visibly proves "this is
 *     really your old game", not a generic "a session was found" notice.
 *   - `renderDeckMismatchScreen` — the stored session's `deckHash` no
 *     longer matches the loaded deck (`ResumeCheck.kind === 'refused',
 *     reason: 'deck-mismatch'`), i.e. the author edited/republished his
 *     questions since the interruption. No literal string exists in
 *     Appendix أ for this exact moment (`game-rules-and-maze-
 *     investigation.md` §6.3 only says "refuse to resume and say so
 *     plainly" — it does not script the sentence) — the copy below is
 *     AUTHORED here, in the project's existing calm/short register, not
 *     copied from any ruled source. Flagged in the worklog, same
 *     discipline as `ending.ts`'s authored «تعادل» headline.
 */
import { buildStatusStrip } from './chrome';
import { formatDigits } from '../format-digits';

export interface ResumePromptParams {
  teamNames: [string, string];
  positions: [number, number];
  N: number;
  onContinue: () => void;
  onNewGame: () => void;
}

/** `ResumeCheck.kind === 'available'`. */
export function renderResumePromptScreen(container: HTMLElement, p: ResumePromptParams): void {
  container.innerHTML = '';

  const safe = document.createElement('div');
  safe.className = 'stage-safe';

  const screen = document.createElement('div');
  screen.className = 'centered-screen resume-prompt-screen';

  // Composed heading — no literal Appendix أ string covers this exact
  // sentence (only the two button labels are scripted); calm, short,
  // matches the project's existing register (e.g. team-setup.ts's own
  // composed lines).
  const heading = document.createElement('h1');
  heading.className = 'type-winner-headline';
  heading.textContent = 'توجد جلسة سابقة لم تكتمل';
  screen.append(heading);

  // The SAME status-strip component the room saw live, mid-game — proof
  // (not just a claim) that this is genuinely their interrupted game, not
  // a generic "we found something" message. `N` is stated separately since
  // the status strip alone does not carry the track length.
  const strip = buildStatusStrip(p.teamNames, p.positions);
  screen.append(strip);

  const trackLine = document.createElement('p');
  trackLine.className = 'type-option resume-track-line';
  trackLine.textContent = `المسار حتى ${formatDigits(p.N)}`;
  screen.append(trackLine);

  const buttonRow = document.createElement('div');
  buttonRow.className = 'resume-prompt-buttons';

  const continueBtn = document.createElement('button');
  continueBtn.type = 'button';
  continueBtn.className = 'op-button primary type-operator-button';
  continueBtn.textContent = 'تكملة الجلسة'; // خطة.md Appendix أ, literal (PH-A4 criterion 4).
  continueBtn.addEventListener('click', p.onContinue);

  const newGameBtn = document.createElement('button');
  newGameBtn.type = 'button';
  newGameBtn.className = 'op-button type-operator-button';
  newGameBtn.textContent = 'جلسة جديدة'; // خطة.md Appendix أ, literal (PH-A4 criterion 4).
  newGameBtn.addEventListener('click', p.onNewGame);

  buttonRow.append(continueBtn, newGameBtn);
  screen.append(buttonRow);

  safe.append(screen);
  container.append(safe);
}

export interface DeckMismatchParams {
  onNewGame: () => void;
}

/** `ResumeCheck.kind === 'refused', reason: 'deck-mismatch'`. Every string
 *  below is AUTHORED (no literal source — see this file's header comment),
 *  in the calm-Arabic-sentence register constraint row 17 requires: the
 *  technical fact (`storedDeckHash`/`currentDeckHash`) never reaches this
 *  screen — it is available on `ResumeCheck` for a hidden log if one is
 *  ever built, never shown here. */
export function renderDeckMismatchScreen(container: HTMLElement, p: DeckMismatchParams): void {
  container.innerHTML = '';

  const safe = document.createElement('div');
  safe.className = 'stage-safe';

  const screen = document.createElement('div');
  screen.className = 'centered-screen resume-prompt-screen';

  const heading = document.createElement('h1');
  heading.className = 'type-winner-headline';
  heading.textContent = 'تغيّرت أسئلتك منذ آخر مرة';
  screen.append(heading);

  const explain = document.createElement('p');
  explain.className = 'type-option resume-track-line';
  explain.textContent = 'الجلسة القديمة لا يمكن إكمالها بأسئلة مختلفة — ابدأ جلسة جديدة بأسئلتك الحالية.';
  screen.append(explain);

  const newGameBtn = document.createElement('button');
  newGameBtn.type = 'button';
  newGameBtn.className = 'op-button primary type-operator-button';
  newGameBtn.textContent = 'جلسة جديدة'; // same literal word as the resume prompt's own button — one vocabulary.
  newGameBtn.addEventListener('click', p.onNewGame);
  screen.append(newGameBtn);

  safe.append(screen);
  container.append(safe);
}
