import type { TeamId } from '../../contracts';
import { formatDigits } from '../format-digits';
import { buildUndoCorner } from '../undo-corner';

export interface EndingScreenParams {
  teamNames: [string, string];
  positions: [number, number];
  N: number;
  outcome: 'winA' | 'winB' | 'draw';
  /** Whether either team actually reached the last station — distinguishes
   *  a track win (D-09.7/9, plain "فاز فريق ⟨أ⟩") from an exhaustion-with-
   *  progress win (D-09.14, the literal "بالتقدّم" wording), per
   *  resolveProgression's own two GAME_ENDED sources. */
  reachedEnd: boolean;
  nextFirstTeam: TeamId;
  canUndo: boolean;
  onNewGame: () => void;
  onUndo: () => void;
}

function otherTeam(t: TeamId): TeamId {
  return t === 'A' ? 'B' : 'A';
}

/**
 * D-09.7…D-09.16: the three FINISHED-state screens. No clock, no elapsed
 * time, no win-percentage, no consolation copy anywhere here (constraint
 * row 8) — every number on this screen is a step count or a correct-answer
 * count, nothing else.
 */
export function renderEndingScreen(container: HTMLElement, p: EndingScreenParams): void {
  container.innerHTML = '';

  const safe = document.createElement('div');
  safe.className = 'stage-safe';

  const screen = document.createElement('div');
  screen.className = 'centered-screen ending-screen';

  const headline = document.createElement('h1');
  headline.className = 'type-winner-headline';

  const scoreLine = document.createElement('div');
  scoreLine.className = 'status-strip ending-score-line';
  for (let i = 0; i < 2; i++) {
    const block = document.createElement('div');
    block.className = 'status-team';
    const name = document.createElement('span');
    name.className = 'type-team-name';
    name.textContent = p.teamNames[i] ?? '';
    const score = document.createElement('span');
    score.className = 'type-score';
    score.textContent = formatDigits(p.positions[i] ?? 0);
    block.append(name, score);
    scoreLine.append(block);
  }

  if (p.outcome === 'draw') {
    // No literal "final draw" headline exists in Appendix أ — the ruled
    // literal copy (D-09.15) covers the *audience-decision* screen
    // (maze-beat.ts's 'audience-decision' mode), which is what the room
    // actually reads before choosing. Once "«نعلنها تعادل»" has been
    // tapped, reflecting that exact choice back with the single word
    // «تعادل» is the minimal honest label for this screen — flagged in
    // the worklog as not a literal Appendix أ string, since none exists
    // for this specific moment.
    headline.textContent = 'تعادل';
    screen.append(headline, scoreLine);
  } else {
    const winnerIdx: 0 | 1 = p.outcome === 'winA' ? 0 : 1;
    const loserIdx: 0 | 1 = winnerIdx === 0 ? 1 : 0;
    screen.classList.add('is-victory');
    const confetti = document.createElement('div');
    confetti.className = 'confetti-flourish';
    for (let i = 0; i < 24; i++) {
      const bit = document.createElement('span');
      bit.className = `confetti-bit confetti-bit-${i % 4}`;
      bit.style.setProperty('--i', String(i));
      confetti.append(bit);
    }
    screen.append(confetti);

    if (p.reachedEnd) {
      // Plain literal from the narrative ("فاز فريق النخبة") — no track/
      // tiebreak distinction is called out in Appendix أ's table.
      headline.textContent = `فاز فريق ${p.teamNames[winnerIdx]}`;
      screen.append(headline, scoreLine);
    } else {
      // D-09.14, literal: «فاز فريق ⟨أ⟩ بالتقدّم — ٧ مقابل ٥».
      headline.textContent = `فاز فريق ${p.teamNames[winnerIdx]} بالتقدّم — ${formatDigits(p.positions[winnerIdx])} مقابل ${formatDigits(p.positions[loserIdx])}`;
      screen.append(headline);
    }
  }

  const rematchInfo = document.createElement('p');
  rematchInfo.className = 'type-option rematch-info';
  rematchInfo.textContent = `نفس الفريقين — يبدأ فريق ${p.teamNames[p.nextFirstTeam === 'A' ? 0 : 1]}`;
  const rematchReset = document.createElement('p');
  rematchReset.className = 'type-option rematch-info';
  rematchReset.textContent = 'الأسئلة ترجع من أولها';

  const newGameBtn = document.createElement('button');
  newGameBtn.type = 'button';
  newGameBtn.className = 'op-button primary type-operator-button new-game-button';
  newGameBtn.textContent = 'لعبة جديدة';
  newGameBtn.addEventListener('click', p.onNewGame);

  screen.append(rematchInfo, rematchReset, newGameBtn);
  safe.append(screen);
  safe.append(buildUndoCorner(p.canUndo, p.onUndo));
  container.append(safe);
}

export function computeNextFirstTeam(outcome: 'winA' | 'winB' | 'draw', currentFirstTeam: TeamId): TeamId {
  if (outcome === 'winA') return 'B'; // D-09.18: the losing team goes first.
  if (outcome === 'winB') return 'A';
  return otherTeam(currentFirstTeam); // draw: no "loser" — disclosed default.
}
