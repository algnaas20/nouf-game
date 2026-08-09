import type { Outcome, TeamId } from '../../contracts';
import { formatDigits } from '../format-digits';
import { buildUndoCorner } from '../undo-corner';
import { buildMazeView } from './maze-view';

export type MazeBeatMode = 'continue' | 'audience-decision' | 'decisive-auto' | 'decisive-manual';

/** What the move that just landed on this beat actually did — computed by
 *  `app.ts` from the state BEFORE the commit vs. AFTER (never re-derived
 *  here, which would risk disagreeing with the real reducer). Drives the
 *  transient «طريق مسدود!» moment — D-09.28, never the wrong-answer
 *  vocabulary («خطأ» / a red ✗): a dead end is the team's own chosen
 *  outcome, not an operator error. */
export interface JustMoved {
  team: TeamId;
  result: 'advance' | 'deadEnd' | 'none';
}

export interface MazeBeatParams {
  N: number;
  positions: [number, number];
  closedExits: [number[], number[]];
  wasted: [number, number];
  decorSeed: number;
  teamNames: [string, string];
  mode: MazeBeatMode;
  justMoved: JustMoved | null;
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
  /**
   * game-systems-expert 2026-08-08 §7 ("the screen auto-advances to the
   * next turn"): `'continue'` mode no longer waits for a manual «السؤال
   * التالي» tap on THIS screen — `app.ts` arms a short auto-advance timer,
   * matching the existing `'decisive-auto'` pattern, closing the third-tap
   * gap disclosed in worklog-B7.md §0. This screen stays tappable-anywhere
   * as an OPTIONAL accelerator (mirrors `turn-handoff.ts`'s own "dissolves,
   * skippable by a tap" pattern) — never a REQUIRED third tap.
   */
  onSkip?: () => void;
}

function stepCard(teamName: string, position: number, N: number, lane: 'a' | 'b', stumbled: boolean): HTMLElement {
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
  // D-09.26 (deck-floor addendum, binding): track length is «محطات», never
  // «خطوات» — a «خطوة» is now a move, and a move can be wasted on a dead end.
  remaining.textContent = `بقي ${formatDigits(Math.max(0, N - position))} محطات`;
  card.append(name, of, remaining);
  if (stumbled) {
    // D-09.28: appears ONLY once the risk has been spent, never before —
    // and, once true, stays visible on every subsequent beat for this team.
    const note = document.createElement('span');
    note.className = 'type-option maze-step-stumble-note';
    note.textContent = 'باقي مساركم سالك';
    card.append(note);
  }
  return card;
}

/**
 * The maze "beat" (§6.4) — full-stage, shown after every `MOVE_APPLIED`
 * (state `PROGRESSION_APPLIED`), before the next question. Modes, driven
 * entirely by what `driver.legal()` returned (app.ts's job, never decided
 * here):
 *   'continue' — ordinary play continues; auto-advances (see `onSkip` doc).
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
    stepCard(p.teamNames[0], p.positions[0], p.N, 'a', p.wasted[0] > 0),
    stepCard(p.teamNames[1], p.positions[1], p.N, 'b', p.wasted[1] > 0),
  );
  safe.append(cards);

  if (p.justMoved?.result === 'deadEnd') {
    // D-09.28 / addendum-maze-ux.md §1.6, literal: never «خطأ», never a red
    // ✗, never the wrong-answer treatment — this is the team's own chosen
    // outcome, stamped on the board itself (maze-view.ts's dead-end stamp,
    // same casing colour, never a team colour).
    const banner = document.createElement('div');
    banner.className = 'result-banner is-dead-end';
    const word = document.createElement('span');
    word.className = 'type-result-word';
    word.textContent = 'طريق مسدود!';
    banner.append(word);
    safe.append(banner);
  }

  const mazeWrap = document.createElement('div');
  mazeWrap.className = 'maze-wrap';
  const { svg } = buildMazeView({
    N: p.N,
    positions: p.positions,
    closedExits: p.closedExits,
    wasted: p.wasted,
    decorSeed: p.decorSeed,
    teamNames: p.teamNames,
  });
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
  } else if (p.mode === 'decisive-manual') {
    const bar = document.createElement('div');
    bar.className = 'operator-bar';
    const barEnd = document.createElement('div');
    barEnd.className = 'operator-bar-end';
    // Composed — reuses the app's existing generic "proceed" register
    // (§4.7's «اضغط للمتابعة»), not a literal Appendix أ string for this
    // exact moment (none exists). Disclosed in worklog-B5.md.
    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.className = 'op-button primary type-operator-button';
    confirmBtn.textContent = 'متابعة';
    confirmBtn.addEventListener('click', () => p.onConfirmDecisive?.());
    barEnd.append(confirmBtn);
    bar.append(barEnd);
    safe.append(bar);
  } else if (p.mode === 'continue' && p.onSkip) {
    // No button — auto-advances (app.ts arms the timer). Tappable anywhere
    // as an optional accelerator, same pattern as `turn-handoff.ts` —
    // EXCEPT the undo corner, which must keep its own independent meaning
    // (a bubbled click from that button must never also fire the skip).
    safe.classList.add('maze-beat-skippable');
    safe.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('.undo-corner')) return;
      p.onSkip?.();
    });
  }

  safe.append(buildUndoCorner(p.canUndo, p.onUndo));
  container.append(safe);
}
