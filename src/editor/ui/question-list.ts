/**
 * The question list: ▲/▼ buttons are the primary reorder mechanism (never
 * drag-only), and delete shows no modal — it collapses to an ~8s undo strip
 * (WL-C C1 prompt, implementation rules).
 */

import type { DraftStore, DraftState } from '../draft-store';
import { AR_COPY } from '../copy';
import { isQuestionReady } from '../validate';
import { formatNumber } from '../format';

export function renderQuestionList(store: DraftStore): HTMLElement {
  const container = document.createElement('div');
  container.className = 'question-list';
  container.dir = 'rtl';

  function render(state: DraftState): void {
    container.innerHTML = '';

    if (state.pendingDeletion) {
      const strip = document.createElement('div');
      strip.className = 'delete-undo-strip';
      const label = document.createElement('span');
      label.textContent = AR_COPY.deletedStrip;
      const undoButton = document.createElement('button');
      undoButton.type = 'button';
      undoButton.className = 'delete-undo-button';
      undoButton.textContent = AR_COPY.undo;
      undoButton.addEventListener('click', () => store.undoDelete());
      strip.append(label, undoButton);
      container.append(strip);
    }

    state.questions.forEach((question, index) => {
      const card = document.createElement('div');
      card.className = 'question-card';
      card.dataset.id = question.id;

      const numberLabel = document.createElement('span');
      numberLabel.className = 'question-number';
      numberLabel.textContent = formatNumber(index + 1);

      const textPreview = document.createElement('span');
      textPreview.className = 'question-text-preview';
      textPreview.textContent = question.text;

      const ready = isQuestionReady(question);
      const badge = document.createElement('span');
      badge.className = `ready-badge ${ready ? 'is-ready' : 'is-not-ready'}`;
      badge.textContent = ready ? AR_COPY.ready : AR_COPY.notReady;

      const upButton = document.createElement('button');
      upButton.type = 'button';
      upButton.className = 'move-up-button';
      upButton.textContent = AR_COPY.moveUp;
      upButton.disabled = index === 0;
      upButton.addEventListener('click', () => void store.moveUp(question.id));

      const downButton = document.createElement('button');
      downButton.type = 'button';
      downButton.className = 'move-down-button';
      downButton.textContent = AR_COPY.moveDown;
      downButton.disabled = index === state.questions.length - 1;
      downButton.addEventListener('click', () => void store.moveDown(question.id));

      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'delete-question-button';
      deleteButton.textContent = AR_COPY.deleteButton;
      deleteButton.addEventListener('click', () => store.deleteQuestion(question.id));

      card.append(numberLabel, textPreview, badge, upButton, downButton, deleteButton);
      container.append(card);
    });
  }

  render(store.getState());
  store.subscribe(render);
  return container;
}
