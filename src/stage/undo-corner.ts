/**
 * «تراجُع» — one-action undo, no confirmation dialog, the same corner on
 * every screen (§4.5). A single builder so "same corner" cannot drift
 * between screens as they're built independently.
 */
export function buildUndoCorner(canUndo: boolean, onUndo: () => void): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'undo-corner';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'op-button type-operator-button';
  btn.textContent = 'تراجُع';
  btn.disabled = !canUndo;
  btn.addEventListener('click', onUndo);
  wrap.append(btn);
  return wrap;
}
