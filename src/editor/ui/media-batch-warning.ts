/**
 * The 100-files-per-upload-batch warning (PH-C3) — dispatch: "A host who
 * uploads 100 of 126 files and stops gets a game with silently missing
 * images and no error. Warn up front." media-storage-investigation.md
 * §7.3/§8.3: "the export screen must say so up front" and the real cap is
 * a **file count**, not a question count.
 *
 * This is the editor-side, proactive heads-up — computed from the real,
 * deduplicated set of media files the draft would export (content-
 * addressed by `sha256`, so two questions sharing one photo count once,
 * exactly like the real export would produce). The authoritative wording
 * *at publish time* belongs to WL-D's export screen (PH-D2/D3, owns
 * `src/pack/**`) — this module only defines the boundary and warns early,
 * per this phase's explicit brief; it does not build the export flow.
 */

import { mediaBatchWarningMessage } from '../copy';
import type { DraftStore, DraftState } from '../draft-store';

/** The real GitHub web-uploader limit (media-storage-investigation.md
 *  §7.2/§7.3) — the warning fires once the draft's distinct media-file
 *  count would exceed a single batch. */
export const UPLOAD_BATCH_FILE_LIMIT = 100;

export function countDistinctMediaFiles(state: Pick<DraftState, 'questions'>): number {
  const hashes = new Set<string>();
  for (const question of state.questions) {
    if (question.media.kind !== 'none') hashes.add(question.media.sha256);
  }
  return hashes.size;
}

export function renderMediaBatchWarning(store: DraftStore): HTMLElement {
  const container = document.createElement('div');
  container.className = 'media-batch-warning';
  container.dir = 'rtl';
  container.setAttribute('role', 'status');
  container.hidden = true;

  function render(state: DraftState): void {
    const count = countDistinctMediaFiles(state);
    const overLimit = count > UPLOAD_BATCH_FILE_LIMIT;
    container.hidden = !overLimit;
    container.textContent = overLimit ? mediaBatchWarningMessage(count) : '';
  }

  render(store.getState());
  store.subscribe(render);
  return container;
}
