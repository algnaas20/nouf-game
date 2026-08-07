/**
 * Mounts the editor's «أسئلتي» screen. Reached only from the app's home
 * screen (خطة.md §5.4 — same app, its own screen, not a mode toggle). This
 * module never renders a mode toggle and never imports `src/stage/**`; the
 * WYSIWYG preview import boundary is PH-C3's job (out of scope here — see
 * the worklog's discrepancy note).
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

export interface MountEditorOptions {
  /** Injected for tests (a store wrapping a fake or test-decorated
   *  backend); defaults to the real IndexedDB-backed store. */
  store?: DraftStore;
  /** The boundary this phase defines but does not fill — PH-D2's ZIP
   *  export is the real handler, wired in later. */
  onRequestBackup?: () => void;
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

  const storageFullBanner = renderStorageFullBanner({ onSaveBackup: options.onRequestBackup });
  container.append(storageFullBanner);

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
