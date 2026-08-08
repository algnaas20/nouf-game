/**
 * Add/edit form. The correct option carries three redundant signals — a
 * radio control, the whole row turning green with a ✓, and the words
 * «الإجابة الصحيحة» — so a busy, non-technical author cannot miss it
 * (خطة.md §5.2, stage-ux-investigation.md §5.2). Text inputs carry
 * `dir="auto"` (implementation rule).
 */

import type { OptionIndex, QuestionMedia } from '../../contracts';
import type { NewQuestionInput } from '../draft-store';
import { AR_COPY } from '../copy';
import { formatBytes } from '../format';
import { processMediaFile } from '../../media/process';
import { loadIntoSharedAudio } from '../../media/audio-element';

export interface QuestionFormOptions {
  initial?: NewQuestionInput;
  onSubmit: (input: NewQuestionInput) => void;
  onCancel?: () => void;
}

function emptyTuple(): [string, string, string, string] {
  return ['', '', '', ''];
}

export function renderQuestionForm(options: QuestionFormOptions): HTMLFormElement {
  const form = document.createElement('form');
  form.className = 'question-form';
  form.dir = 'rtl';

  const textLabel = document.createElement('label');
  textLabel.className = 'question-text-label';
  textLabel.textContent = AR_COPY.questionTextLabel;
  const textInput = document.createElement('textarea');
  textInput.dir = 'auto';
  textInput.required = true;
  textInput.className = 'question-text-input';
  textInput.value = options.initial?.text ?? '';
  textLabel.append(textInput);
  form.append(textLabel);

  const initialOptions = options.initial?.options ?? emptyTuple();
  const optionInputs: HTMLInputElement[] = [];
  const radios: HTMLInputElement[] = [];
  const rows: HTMLDivElement[] = [];
  const radioGroupName = `correct-option-${Math.random().toString(36).slice(2)}`;

  for (let i = 0; i < 4; i += 1) {
    const optionIndex = i as OptionIndex;
    const row = document.createElement('div');
    row.className = 'option-row';
    row.dataset.optionIndex = String(optionIndex);

    // Addendum-small-screens §4.4 — 48x48 minimum touch target. The native
    // radio's own visual box stays small (24x24, editor.css), but a real
    // `<label>` wrapper gives the whole padded label area a native,
    // browser-handled click/tap target without a second event listener
    // that would risk double-toggling (a `<label><input></label>` pair
    // toggles the input on a click ANYWHERE in the label, including its
    // padding, by browser default behaviour — never re-implemented here).
    const radioToggle = document.createElement('label');
    radioToggle.className = 'option-correct-toggle';

    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = radioGroupName;
    radio.value = String(optionIndex);
    radio.className = 'option-correct-radio';
    radio.checked = options.initial?.correctIndex === optionIndex;
    radioToggle.append(radio);

    const input = document.createElement('input');
    input.type = 'text';
    input.dir = 'auto';
    input.required = true;
    input.className = 'option-text-input';
    input.value = initialOptions[optionIndex] ?? '';

    const check = document.createElement('span');
    check.className = 'correct-check';
    check.textContent = '✓';

    const label = document.createElement('span');
    label.className = 'correct-answer-label';
    label.textContent = AR_COPY.correctAnswerLabel;

    function refresh(): void {
      const isCorrect = radio.checked;
      row.classList.toggle('is-correct', isCorrect);
      check.hidden = !isCorrect;
      label.hidden = !isCorrect;
    }
    radio.addEventListener('change', () => {
      for (const otherRow of rows) otherRow.classList.remove('is-correct');
      refresh();
    });

    row.append(radioToggle, input, check, label);
    form.append(row);
    optionInputs.push(input);
    radios.push(radio);
    rows.push(row);
    refresh();
  }

  // ---- media attach (PH-C2) --------------------------------------------
  // `attachedMedia` only ever holds a *freshly processed* blob from this
  // session — there is no store access here to re-fetch a previously-saved
  // blob for an existing question (question-list.ts has no "edit" trigger
  // yet, a pre-existing C1-era gap; see the PH-C2 worklog). Attaching a new
  // file always replaces whatever was here, matching "one attachment per
  // question" — there is no multi-media model in this product.
  let attachedMedia: { media: QuestionMedia; blob: Blob } | null = null;
  let attachedImagePreviewUrl: string | null = null;

  function clearAttachedImagePreview(): void {
    if (attachedImagePreviewUrl) {
      URL.revokeObjectURL(attachedImagePreviewUrl);
      attachedImagePreviewUrl = null;
    }
  }

  const mediaSection = document.createElement('div');
  mediaSection.className = 'media-attach-section';

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.className = 'media-file-input';
  fileInput.hidden = true;
  fileInput.accept =
    'image/jpeg,image/png,image/webp,image/avif,.jpg,.jpeg,.png,.webp,.avif,' +
    'audio/mpeg,audio/mp4,audio/aac,audio/wav,.mp3,.m4a,.aac,.wav';

  const attachButton = document.createElement('button');
  attachButton.type = 'button';
  attachButton.className = 'attach-media-button';
  attachButton.textContent = AR_COPY.attachMedia;
  attachButton.addEventListener('click', () => fileInput.click());

  const errorEl = document.createElement('p');
  errorEl.className = 'media-attach-error';
  errorEl.hidden = true;

  const previewEl = document.createElement('div');
  previewEl.className = 'media-attach-preview';

  function renderMediaPreview(): void {
    previewEl.innerHTML = '';
    if (!attachedMedia) return;

    // Live size counter (PH-C2 AC6) — reflects the *already-processed*
    // (downscaled, for images) bytes, shown the moment the file is
    // attached, never at submit/publish time.
    const sizeLabel = document.createElement('span');
    sizeLabel.className = 'media-size-counter';
    sizeLabel.textContent = formatBytes(attachedMedia.blob.size);
    previewEl.append(sizeLabel);

    if (attachedMedia.media.kind === 'image') {
      clearAttachedImagePreview();
      attachedImagePreviewUrl = URL.createObjectURL(attachedMedia.blob);
      const img = document.createElement('img');
      img.className = 'media-attach-thumb';
      img.loading = 'lazy';
      img.src = attachedImagePreviewUrl;
      previewEl.append(img);
    } else if (attachedMedia.media.kind === 'audio') {
      const playButton = document.createElement('button');
      playButton.type = 'button';
      playButton.className = 'media-preview-play-button';
      playButton.textContent = AR_COPY.playPreview;
      playButton.addEventListener('click', () => {
        if (!attachedMedia) return;
        // Reuses the ONE shared <audio> element for the whole session
        // (src/media/audio-element.ts) — never a second element per
        // preview click, per §12 rule 4 and PH-C2 AC7.
        const { el } = loadIntoSharedAudio(attachedMedia.blob);
        // This click is the user activation §5.3 requires — play() should
        // resolve; still caught defensively (NotAllowedError etc.).
        void el.play().catch(() => {
          /* swallowed per §5.3 / §12 rule 8 — no UI feedback wired for a
             manual play click failing is not required by any PH-C2 AC */
        });
      });
      previewEl.append(playButton);
    }

    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'remove-media-button';
    removeButton.textContent = AR_COPY.removeMedia;
    removeButton.addEventListener('click', () => {
      clearAttachedImagePreview();
      attachedMedia = null;
      renderMediaPreview();
    });
    previewEl.append(removeButton);
  }

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (!file) return;
    errorEl.hidden = true;
    void processMediaFile(file).then((result) => {
      if (!result.ok) {
        errorEl.textContent = result.reason;
        errorEl.hidden = false;
        return;
      }
      clearAttachedImagePreview();
      attachedMedia = { media: result.media, blob: result.blob };
      renderMediaPreview();
    });
  });

  mediaSection.append(attachButton, fileInput, errorEl, previewEl);
  form.append(mediaSection);

  // Addendum-small-screens §5 fix #1 — the form's own primary action
  // ("تم") is pinned to the bottom of the viewport while the fields above
  // it (text, four options, media attach) are being filled, so completing
  // a question never requires scrolling past a long question list AND a
  // tall form to find the submit button.
  const actions = document.createElement('div');
  actions.className = 'question-form-actions';

  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.className = 'question-submit';
  submit.textContent = AR_COPY.done;
  actions.append(submit);

  if (options.onCancel) {
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'question-cancel';
    cancel.textContent = AR_COPY.cancel;
    cancel.addEventListener('click', () => {
      clearAttachedImagePreview();
      options.onCancel?.();
    });
    actions.append(cancel);
  }
  form.append(actions);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const checkedRadio = radios.find((radio) => radio.checked);
    const correctIndex = checkedRadio ? (Number(checkedRadio.value) as OptionIndex) : null;
    const values = optionInputs.map((input) => input.value) as [string, string, string, string];
    clearAttachedImagePreview();
    options.onSubmit({
      text: textInput.value,
      options: values,
      correctIndex,
      media: attachedMedia?.media,
      mediaBlob: attachedMedia?.blob,
    });
  });

  return form;
}
