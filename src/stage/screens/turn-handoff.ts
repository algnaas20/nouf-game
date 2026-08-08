export type HandoffKind = 'turn' | 'balancing' | 'tiebreak';

export interface TurnHandoffParams {
  kind: HandoffKind;
  /** 'turn': [reading team, answering team]. 'balancing': [leader team,
   *  owed team]. 'tiebreak': unused. */
  names: [string, string];
  onDismiss: () => void;
}

const HANDOFF_MS = 1500;

/**
 * The turn hand-off — Ruling 1, constraint 1: "an animation, not a state
 * and not a tap. ~1.5s... Tapping anywhere skips it instantly. No media
 * playback begins until the overlay has cleared." Also carries D-09.8's
 * no-celebration arrival message and D-09.9's decider banner — both are
 * hand-offs into a next question, just with different literal copy, so
 * they share this one component rather than three near-duplicates.
 */
export function renderTurnHandoff(container: HTMLElement, p: TurnHandoffParams): () => void {
  container.innerHTML = '';

  const overlay = document.createElement('div');
  overlay.className = `turn-handoff-overlay turn-handoff-${p.kind}`;

  const text = document.createElement('p');
  text.className = 'type-turn-banner';
  if (p.kind === 'turn') {
    text.textContent = `فريق ${p.names[0]} يوجّه السؤال ← فريق ${p.names[1]} يجاوب`;
  } else if (p.kind === 'balancing') {
    // D-09.8, literal: no victory staging when the first team reaches N.
    text.textContent = `فريق ${p.names[0]} وصل النهاية — وفريق ${p.names[1]} له محاولة أخيرة`;
  } else {
    text.textContent = 'سؤال الحسم';
  }

  overlay.append(text);
  container.append(overlay);

  let dismissed = false;
  const dismiss = () => {
    if (dismissed) return;
    dismissed = true;
    clearTimeout(timer);
    overlay.removeEventListener('click', dismiss);
    p.onDismiss();
  };

  const timer = setTimeout(dismiss, HANDOFF_MS);
  overlay.addEventListener('click', dismiss);

  // Returns a manual-cancel handle (e.g. if the screen is torn down by an
  // undo before the timer fires) so no stray commit ever fires against a
  // stale state.
  return () => {
    dismissed = true;
    clearTimeout(timer);
  };
}
