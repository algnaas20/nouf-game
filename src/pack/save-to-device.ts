/**
 * "احفظ نسخة على جهازك" — writes a pack `Blob` to the host's own device.
 * media-storage-investigation.md §10.2: "Build both" mechanisms — the real
 * Save dialog (`showSaveFilePicker`, Chrome/Edge 86+) as the strictly
 * better path, and the universal `<a download>` fallback for every other
 * browser. This is the one file in `src/pack/**` that touches `window`/
 * `document` — everything else in this module is pure and Node-testable;
 * this file is proven live, in a real browser (`tests/pack/live/**`).
 *
 * `saveBackupToDevice`'s signature — `(store, title) => Promise<{filename}|null>`
 * with `title` pre-bound — matches `MountEditorOptions.onRequestBackup`'s
 * exact shape (`() => Promise<{filename:string}|null>`) so it can be handed
 * straight to `mountEditor({ onRequestBackup: () => saveBackupToDevice(store, title) })`
 * the moment whichever line wires the editor's entry point does so (not yet
 * done anywhere in the app — see worklog-D2.md design decision 6).
 */

import type { DraftStore } from '../editor/draft-store';
import { buildPackFromDraft } from './from-draft';
import { exportPack } from './export';
import { generateBackupFilename } from './filename';

export interface SaveFilePickerLike {
  showSaveFilePicker(options: {
    suggestedName: string;
    types?: { description: string; accept: Record<string, string[]> }[];
  }): Promise<{
    name: string;
    createWritable(): Promise<{ write(data: Blob): Promise<void>; close(): Promise<void> }>;
  }>;
}

function hasShowSaveFilePicker(win: unknown): win is SaveFilePickerLike {
  return typeof win === 'object' && win !== null && typeof (win as { showSaveFilePicker?: unknown }).showSaveFilePicker === 'function';
}

/** Writes `blob` to the host's device under `suggestedName`. Returns the
 *  filename actually used, or `null` only when the host explicitly
 *  cancelled a native Save dialog (never on the anchor-download path, which
 *  has no cancel signal — matches media-storage-investigation.md §10.2's
 *  own comparison table). */
export async function writeBlobToDevice(blob: Blob, suggestedName: string): Promise<{ filename: string } | null> {
  if (hasShowSaveFilePicker(window)) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName,
        types: [{ description: 'ZIP', accept: { 'application/zip': ['.zip'] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return { filename: handle.name || suggestedName };
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return null; // host cancelled the dialog
      // Any other failure (e.g. a permission quirk) falls through to the
      // universal anchor-download path below rather than failing outright.
    }
  }

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = suggestedName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  // Revoked after a delay, not immediately — some browsers start the
  // download asynchronously and revoking too early breaks it.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
  return { filename: suggestedName };
}

/** The full backup pipeline: build from the current draft (never blocked by
 *  readiness — §ownership design decision 3) → zip → write to device. Does
 *  **not** call `store.recordBackup()` itself — that boundary crossing
 *  belongs to whoever supplies this as `onRequestBackup`
 *  (`src/editor/app.ts`'s `triggerBackup` already does exactly that, per
 *  PH-C3). Returns the same `skippedQuestionNumbers` `from-draft.ts`
 *  produced, so a caller can show `copy.ts`'s `skippedFromBackupMessage`
 *  when it is non-empty. */
export async function saveBackupToDevice(
  store: DraftStore,
  title: string,
): Promise<{ filename: string; skippedQuestionNumbers: number[] } | null> {
  const { manifest, media, skippedQuestionNumbers } = await buildPackFromDraft(store, title);
  const blob = await exportPack(manifest, media);
  const filename = generateBackupFilename(new Date());
  const result = await writeBlobToDevice(blob, filename);
  if (!result) return null;
  return { filename: result.filename, skippedQuestionNumbers };
}
