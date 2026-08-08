import type { Outcome } from '../../contracts';
import { formatDigits } from '../format-digits';
import { buildUndoCorner } from '../undo-corner';
import { buildMazeView } from './maze-view';

export type MazeBeatMode = 'continue' | 'audience-decision' | 'decisive-auto' | 'decisive-manual';

export interface MazeBeatParams {
  N: number;
  positions: [number, number];
  teamNames: [string, string];
  mode: MazeBeatMode;
  onContinue: () => void;
  onDeclare: (outcome: Outcome) => void;
  canUndo: boolean;
  onUndo: () => void;
  /**
   * F-4 fix (adversarial review, 2026-08-08 — worklog-B5.md): required only
   * for `mode: 'decisive-manual'`. `'decisive-auto'` still auto-commits the
   * single legal `GAME_ENDED` candidate after a short delay (unchanged,
   * normal-play behaviour); `app.ts` switches to `'decisive-manual'`
   * instead, for exactly one render pass, whenever this beat was reached by
   * an undo (popping the just-declared ending) rather than by forward play
   * — so undoing a wrong final answer no longer silently re-commits the
   * same result ~900ms later. This mode renders an explicit button instead
   * of arming the timer; a real tap is required to end the game again.
   */
  onConfirmDecisive?: () => void;
}

function stepCard(teamName: string, position: number, N: number, lane: 'a' | 'b'): HTMLElement {
  const card = document.createElement('div');
  card.className = `maze-step-card maze-step-card-${lane}`;
  const name = document.createElement('span');
  name.className = 'type-team-name';
  name.textContent = teamName;
  const of = document.createElement('span');
  of.className = 'type-score maze-step-of';
  of.textContent = `${formatDigits(position)} من ${formatDigits(N)}`;
  const remaining = document.createElement('span');
  remaining.className = 'type-option maze-step-remaining';
  remaining.textContent = `بقي ${formatDigits(Math.max(0, N - position))} خطوات`;
  card.append(name, of, remaining);
  return card;
}

/**
 * The maze "beat" (§6.4) — full-stage, shown after every `MOVE_APPLIED`
 * (state `PROGRESSION_APPLIED`), before the next question. Three modes,
 * driven entirely by what `driver.legal()` returned (app.ts's job, never
 * decided here):
 *   'continue' — ordinary play continues; «السؤال التالي» commits the
 *                single `TURN_PASSED` candidate.
 *   'audience-decision' — D-09.15, deck exhausted & level: three buttons
 *                for the three legal `GAME_ENDED` candidates.
 *   'decisive-auto' — a single `GAME_ENDED` candidate with no room choice
 *                (the balancing attempt just settled it, a tiebreak pair
 *                resolved, or exhaustion-with-progress) — app.ts auto-
 *                commits it a moment after this beat renders; no button
 *                copy is invented for a step that isn't "next question".
 */
export function renderMazeBeat(container: HTMLElement, p: MazeBeatParams): void {
  container.innerHTML = '';

  const safe = document.createElement('div');
  safe.className = 'stage-safe maze-beat-safe';

  const cards = document.createElement('div');
  cards.className = 'maze-step-cards';
  cards.append(
    stepCard(p.teamNames[0], p.positions[0], p.N, 'a'),
    stepCard(p.teamNames[1], p.positions[1], p.N, 'b'),
  );
  safe.append(cards);

  const mazeWrap = document.createElement('div');
  mazeWrap.className = 'maze-wrap';
  const { svg } = buildMazeView({ N: p.N, positions: p.positions, teamNames: p.teamNames });
  mazeWrap.append(svg);
  safe.append(mazeWrap);

  if (p.mode === 'audience-decision') {
    const panel = document.createElement('div');
    panel.className = 'audience-decision-panel';
    const line = document.createElement('p');
    line.className = 'type-question';
    line.textContent = 'سؤال أخير من الحضور — أول فريق يجاوب صح يفوز';
    panel.append(line);

    const buttons = document.createElement('div');
    buttons.className = 'audience-decision-buttons';
    const btnA = document.createElement('button');
    btnA.type = 'button';
    btnA.className = 'op-button primary type-operator-button';
    btnA.textContent = `فريق ${p.teamNames[0]} جاوب صح`;
    btnA.addEventListener('click', () => p.onDeclare('winA'));

    const btnB = document.createElement('button');
    btnB.type = 'button';
    btnB.className = 'op-button primary type-operator-button';
    btnB.textContent = `فريق ${p.teamNames[1]} جاوب صح`;
    btnB.addEventListener('click', () => p.onDeclare('winB'));

    const btnDraw = document.createElement('button');
    btnDraw.type = 'button';
    btnDraw.className = 'op-button type-operator-button audience-draw-button';
    btnDraw.textContent = 'نعلنها تعادل';
    btnDraw.addEventListener('click', () => p.onDeclare('draw'));

    buttons.append(btnA, btnB, btnDraw);
    panel.append(buttons);
    safe.append(panel);
  } else {
    const bar = document.createElement('div');
    bar.className = 'operator-bar';
    const barEnd = document.createElement('div');
    barEnd.className = 'operator-bar-end';
    if (p.mode === 'continue') {
      const nextBtn = document.createElement('button');
      nextBtn.type = 'button';
      nextBtn.className = 'op-button primary type-operator-button';
      nextBtn.textContent = 'السؤال التالي';
      nextBtn.addEventListener('click', p.onContinue);
      barEnd.append(nextBtn);
    } else if (p.mode === 'decisive-manual') {
      // Composed — reuses the app's existing generic "proceed" register
      // (§4.7's «اضغط للمتابعة»), not a literal Appendix أ string for this
      // exact moment (none exists). Disclosed in worklog-B5.md.
      const confirmBtn = document.createElement('button');
      confirmBtn.type = 'button';
      confirmBtn.className = 'op-button primary type-operator-button';
      confirmBtn.textContent = 'متابعة';
      confirmBtn.addEventListener('click', () => p.onConfirmDecisive?.());
      barEnd.append(confirmBtn);
    }
    bar.append(barEnd);
    safe.append(bar);
  }

  safe.append(buildUndoCorner(p.canUndo, p.onUndo));
  container.append(safe);
}
