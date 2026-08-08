/**
 * The question list: ▲/▼ buttons are the primary reorder mechanism (never
 * drag-only), and delete shows no modal — it collapses to an ~8s undo strip
 * (WL-C C1 prompt, implementation rules).
 */

import type { DraftStore, DraftState } from '../draft-store';
import { AR_COPY } from '../copy';
import { isQuestionReady } from '../validate';
import { formatNumber } from '../format';
import { loadIntoSharedAudio } from '../../media/audio-element';
import { openStagePreview, toStageQuestion } from './stage-preview';

export function renderQuestionList(store: DraftStore): HTMLElement {
  const container = document.createElement('div');
  container.className = 'question-list';
  container.dir = 'rtl';

  // PH-C2 — image thumbnails in the list are fetched async from IndexedDB
  // and rendered via a fresh object URL each render; revoke the previous
  // batch before creating the next one so a re-render (any store change)
  // never leaks URLs (§12 rule 1/2 of the media report, applied here too).
  let activeImagePreviewUrls: string[] = [];
  function revokeActiveImagePreviews(): void {
    for (const url of activeImagePreviewUrls) URL.revokeObjectURL(url);
    activeImagePreviewUrls = [];
  }

  function render(state: DraftState): void {
    revokeActiveImagePreviews();
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

      // PH-C2 — media indicator/preview per question. Reuses the ONE shared
      // <audio> element (never a new one per card) — AC7.
      const mediaPreview = document.createElement('span');
      mediaPreview.className = 'question-media-preview';
      const media = question.media;
      if (media.kind === 'image') {
        const img = document.createElement('img');
        img.className = 'question-media-thumb';
        img.loading = 'lazy';
        img.alt = '';
        void store.getMediaBlob(media.sha256).then((blob) => {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          activeImagePreviewUrls.push(url);
          img.src = url;
        });
        mediaPreview.append(img);
      } else if (media.kind === 'audio') {
        const playButton = document.createElement('button');
        playButton.type = 'button';
        playButton.className = 'question-media-play-button';
        playButton.textContent = AR_COPY.playPreview;
        playButton.addEventListener('click', () => {
          void store.getMediaBlob(media.sha256).then((blob) => {
            if (!blob) return;
            const { el } = loadIntoSharedAudio(blob);
            void el.play().catch(() => {
              /* swallowed — no UI feedback wired for a manual click failing;
                 not required by any PH-C2 AC */
            });
          });
        });
        mediaPreview.append(playButton);
      }

      // PH-C3 — «معاينة كما يراها الجميع»: imports and calls the REAL stage
      // component (stage-preview.ts) rather than a second implementation.
      // Gated on readiness — `toStageQuestion` requires a marked correct
      // option, which `isQuestionReady` (computed above as `ready`) already
      // guarantees before this button is ever enabled.
      const previewButton = document.createElement('button');
      previewButton.type = 'button';
      previewButton.className = 'preview-like-everyone-button';
      previewButton.textContent = ready ? AR_COPY.previewLikeEveryone : AR_COPY.notReadyForPreview;
      previewButton.disabled = !ready;
      previewButton.addEventListener('click', () => {
        const stageQuestion = toStageQuestion(question);
        if (!stageQuestion) return;
        // The resolver `openStagePreview` builds needs the blob already in
        // hand (it must be synchronous) — fetch it first for image/audio
        // questions, so the preview shows the author's OWN media, not
        // whatever the stage component falls back to for an unknown id.
        const mediaBlobPromise: Promise<Blob | undefined> =
          stageQuestion.media.kind === 'none'
            ? Promise.resolve(undefined)
            : store.getMediaBlob(stageQuestion.media.sha256);
        void mediaBlobPromise.then((mediaBlob) => {
          openStagePreview({ question: stageQuestion, mediaBlob });
        });
      });

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

      // Addendum-small-screens §4.4 — two wrapper rows so the flex-wrap
      // layout in editor.css can keep every button at >=48x48 CSS px with
      // >=12px gaps at phone width without the card's text content
      // fighting the buttons for the same wrapped line.
      const main = document.createElement('div');
      main.className = 'question-card-main';
      main.append(numberLabel, textPreview, mediaPreview, badge);

      const actions = document.createElement('div');
      actions.className = 'question-card-actions';
      actions.append(previewButton, upButton, downButton, deleteButton);

      card.append(main, actions);
      container.append(card);
    });
  }

  render(store.getState());
  store.subscribe(render);
  return container;
}
