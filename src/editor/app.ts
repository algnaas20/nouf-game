/**
 * Mounts the editor's «أسئلتي» screen. Reached only from the app's home
 * screen (خطة.md §5.4 — same app, its own screen, not a mode toggle).
 *
 * `mountEditor` is the only integration point another line needs: WL-B's
 * `src/main.ts` imports it and calls it when the author taps «أسئلتي» on
 * the home screen. No router is involved (D-11).
 */

import './editor.css';
import { AR_COPY } from './copy';
import { createDraftStore, DraftStore } from './draft-store';
import { renderQuestionForm } from './ui/question-form';
import { renderQuestionList } from './ui/question-list';
import { renderStorageFullBanner, setStorageFullBannerVisible } from './ui/storage-full-banner';
import { renderReturnPrompt } from './ui/return-prompt';
import { renderReadinessMeter } from './ui/readiness-meter';
import { renderMediaBatchWarning } from './ui/media-batch-warning';
import { renderBackupBadge } from './ui/backup-badge';

export interface MountEditorOptions {
  /** Injected for tests (a store wrapping a fake or test-decorated
   *  backend); defaults to the real IndexedDB-backed store. */
  store?: DraftStore;
  /**
   * PH-C3 — the boundary this phase defines but does not fill: "define the
   * boundary, mark the state, do not build the ZIP." The real handler
   * (WL-D/PH-D2) performs the actual save-to-device write and resolves
   * with the filename it actually used, or `null` if the host cancelled or
   * the write failed. `mountEditor` awaits it and, only on a real filename,
   * calls `store.recordBackup(filename)` — the one place that boundary is
   * crossed. Until PH-D2/D3 supply a real implementation this stays
   * `undefined`; every backup-triggering button is visible and clickable
   * and simply has nothing to call, exactly like PH-C1 left it.
   */
  onRequestBackup?: () => Promise<{ filename: string } | null>;
}

export interface MountedEditor {
  store: DraftStore;
  container: HTMLElement;
}

export async function mountEditor(
  container: HTMLElement,
  options: MountEditorOptions = {},
): Promise<MountedEditor> {
  const store = options.store ?? createDraftStore();
  await store.load();

  container.innerHTML = '';
  container.dir = 'rtl';
  container.lang = 'ar';

  const title = document.createElement('h1');
  title.textContent = AR_COPY.questionsTitle;
  container.append(title);

  const vocabularyLine = document.createElement('p');
  vocabularyLine.className = 'draft-vocabulary';
  vocabularyLine.textContent = AR_COPY.draftVocabulary;
  container.append(vocabularyLine);

  // PH-C3 — the single place `options.onRequestBackup`'s Promise-returning
  // boundary is crossed into `store.recordBackup`. Every UI trigger below
  // (the storage-full banner's save button, the backup badge's own T1
  // reminder button) calls this same `triggerBackup`, never the raw option
  // directly — one code path, one place a future PH-D2 filename lands.
  function triggerBackup(): void {
    if (!options.onRequestBackup) return;
    void options.onRequestBackup().then((result) => {
      if (result) void store.recordBackup(result.filename);
    });
  }

  const storageFullBanner = renderStorageFullBanner({ onSaveBackup: triggerBackup });
  container.append(storageFullBanner);

  const backupBadge = renderBackupBadge(store, { onRequestBackup: triggerBackup });
  container.append(backupBadge);

  const readinessMeter = renderReadinessMeter(store);
  container.append(readinessMeter);

  const mediaBatchWarning = renderMediaBatchWarning(store);
  container.append(mediaBatchWarning);

  // PH-C3 — real `beforeunload` signal, defense in depth alongside the
  // always-visible T1 banner rendered by renderBackupBadge (see that
  // module's own comment for why "persistent while dirty" is the primary
  // mechanism, given there is no router/"leave" event yet).
  window.addEventListener('beforeunload', (event) => {
    if (store.hasUnsavedChanges()) {
      event.preventDefault();
      event.returnValue = true;
    }
  });

  // The workspace (list + add button) stays hidden until the author makes
  // an explicit choice on the return-prompt — never a silent auto-resume,
  // never a silent auto-discard.
  const workspace = document.createElement('div');
  workspace.className = 'editor-workspace';
  workspace.hidden = true;

  function revealWorkspace(withFirstEntryLine: boolean): void {
    if (withFirstEntryLine) {
      const firstEntry = document.createElement('p');
      firstEntry.className = 'first-entry-line';
      firstEntry.textContent = AR_COPY.firstEntry;
      workspace.prepend(firstEntry);
    }
    workspace.hidden = false;
  }

  if (store.hasDraft()) {
    const returnPrompt = renderReturnPrompt({
      updatedAt: store.getState().meta?.updatedAt ?? Date.now(),
      onContinue: () => {
        returnPrompt.remove();
        revealWorkspace(false);
      },
      onStartOver: () => {
        void store.discardDraft().then(() => {
          returnPrompt.remove();
          revealWorkspace(true);
        });
      },
      onDeleteDraft: () => {
        void store.discardDraft().then(() => {
          returnPrompt.remove();
          revealWorkspace(true);
        });
      },
    });
    container.append(returnPrompt);
  } else {
    revealWorkspace(true);
  }

  const list = renderQuestionList(store);
  workspace.append(list);

  const formContainer = document.createElement('div');
  formContainer.className = 'question-form-container';
  workspace.append(formContainer);

  const addButton = document.createElement('button');
  addButton.type = 'button';
  addButton.id = 'editor-add-question';
  addButton.textContent = AR_COPY.addQuestion;
  addButton.addEventListener('click', () => {
    formContainer.innerHTML = '';
    const form = renderQuestionForm({
      onSubmit: (input) => {
        void store.addQuestion(input).then((result) => {
          if (result.ok) {
            formContainer.innerHTML = '';
          } else {
            setStorageFullBannerVisible(storageFullBanner, true);
          }
        });
      },
      onCancel: () => {
        formContainer.innerHTML = '';
      },
    });
    formContainer.append(form);
  });
  workspace.append(addButton);

  container.append(workspace);

  store.subscribe((state) => {
    setStorageFullBannerVisible(storageFullBanner, state.storageFullMessage !== null);
  });

  return { store, container };
}
