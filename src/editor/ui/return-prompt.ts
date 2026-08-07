/**
 * «لديك مسودة من [التاريخ] — تابع، أو ابدأ من جديد، أو احذفها» — shown on
 * return, never auto-resumed and never auto-discarded (WL-C C1 prompt,
 * implementation rules).
 */

import { AR_COPY, returnPromptMessage } from '../copy';
import { formatDraftDate } from '../format';

export interface ReturnPromptOptions {
  updatedAt: number;
  onContinue: () => void;
  onStartOver: () => void;
  onDeleteDraft: () => void;
}

export function renderReturnPrompt(options: ReturnPromptOptions): HTMLElement {
  const banner = document.createElement('div');
  banner.className = 'return-prompt';
  banner.setAttribute('role', 'alertdialog');
  banner.dir = 'rtl';

  const message = document.createElement('p');
  message.className = 'return-prompt-message';
  message.textContent = returnPromptMessage(formatDraftDate(options.updatedAt));
  banner.append(message);

  const continueButton = document.createElement('button');
  continueButton.type = 'button';
  continueButton.className = 'return-prompt-continue';
  continueButton.textContent = AR_COPY.returnContinue;
  continueButton.addEventListener('click', options.onContinue);

  const startOverButton = document.createElement('button');
  startOverButton.type = 'button';
  startOverButton.className = 'return-prompt-start-over';
  startOverButton.textContent = AR_COPY.returnStartOver;
  startOverButton.addEventListener('click', options.onStartOver);

  const deleteButton = document.createElement('button');
  deleteButton.type = 'button';
  deleteButton.className = 'return-prompt-delete';
  deleteButton.textContent = AR_COPY.returnDelete;
  deleteButton.addEventListener('click', options.onDeleteDraft);

  banner.append(continueButton, startOverButton, deleteButton);
  return banner;
}
