/**
 * The backup badge (PH-C3) — the three vocabulary states from §5A.2:
 * «نسخة العمل — على هذا المتصفح فقط» (never saved), «محفوظ على جهازك»
 * (saved, showing the real filename), «منشور مع اللعبة» (published).
 * Purely a view over `DraftStore.backupState()` — never its own source of
 * truth.
 *
 * Also renders the T1 end-of-session reminder next to it: a persistent
 * banner shown whenever `hasUnsavedChanges()` is true (see draft-store.ts
 * and worklog-C3.md for why "persistent while dirty" is this phase's
 * chosen stand-in for "shown when leaving the editor" — there is no router
 * and no "leave" affordance yet, D-11). `onRequestBackup`, if supplied, is
 * the same boundary `mountEditor` already accepts — this module never
 * builds the ZIP itself.
 */

import { AR_COPY } from '../copy';
import type { DraftStore, DraftState } from '../draft-store';

export interface BackupBadgeOptions {
  onRequestBackup?: () => void;
}

export function renderBackupBadge(store: DraftStore, options: BackupBadgeOptions = {}): HTMLElement {
  const container = document.createElement('div');
  container.className = 'backup-badge-area';
  container.dir = 'rtl';

  const badge = document.createElement('span');
  badge.className = 'backup-badge';
  badge.setAttribute('role', 'status');
  container.append(badge);

  const reminder = document.createElement('div');
  reminder.className = 'session-end-reminder';
  reminder.setAttribute('role', 'alert');
  reminder.hidden = true;
  const reminderText = document.createElement('span');
  reminderText.textContent = AR_COPY.sessionEndReminder;
  const reminderButton = document.createElement('button');
  reminderButton.type = 'button';
  reminderButton.className = 'session-end-reminder-save-button';
  reminderButton.textContent = AR_COPY.saveBackupButton;
  reminderButton.addEventListener('click', () => options.onRequestBackup?.());
  reminder.append(reminderText, reminderButton);
  container.append(reminder);

  // The subscribed `state` argument is intentionally unused — this view
  // reads `store.backupState()`/`store.hasUnsavedChanges()` directly so it
  // never drifts from the store's own derivation logic.
  function render(_state: DraftState): void {
    const backupState = store.backupState();
    badge.className = `backup-badge state-${backupState.kind}`;
    if (backupState.kind === 'draft-only') {
      badge.textContent = AR_COPY.draftVocabulary;
    } else if (backupState.kind === 'saved') {
      badge.textContent = `${AR_COPY.savedOnDevice} (${backupState.filename})`;
    } else {
      badge.textContent = AR_COPY.publishedWithGame;
    }

    const dirty = store.hasUnsavedChanges();
    reminder.hidden = !dirty;
  }

  render(store.getState());
  store.subscribe(render);
  return container;
}
