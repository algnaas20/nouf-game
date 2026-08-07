/**
 * Add/edit form. The correct option carries three redundant signals — a
 * radio control, the whole row turning green with a ✓, and the words
 * «الإجابة الصحيحة» — so a busy, non-technical author cannot miss it
 * (خطة.md §5.2, stage-ux-investigation.md §5.2). Text inputs carry
 * `dir="auto"` (implementation rule).
 */

import type { OptionIndex } from '../../contracts';
import type { NewQuestionInput } from '../draft-store';
import { AR_COPY } from '../copy';

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

    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = radioGroupName;
    radio.value = String(optionIndex);
    radio.className = 'option-correct-radio';
    radio.checked = options.initial?.correctIndex === optionIndex;

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

    row.append(radio, input, check, label);
    form.append(row);
    optionInputs.push(input);
    radios.push(radio);
    rows.push(row);
    refresh();
  }

  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.className = 'question-submit';
  submit.textContent = AR_COPY.done;
  form.append(submit);

  if (options.onCancel) {
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'question-cancel';
    cancel.textContent = AR_COPY.cancel;
    cancel.addEventListener('click', () => options.onCancel?.());
    form.append(cancel);
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const checkedRadio = radios.find((radio) => radio.checked);
    const correctIndex = checkedRadio ? (Number(checkedRadio.value) as OptionIndex) : null;
    const values = optionInputs.map((input) => input.value) as [string, string, string, string];
    options.onSubmit({ text: textInput.value, options: values, correctIndex });
  });

  return form;
}
