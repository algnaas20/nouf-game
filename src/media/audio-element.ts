/**
 * The one shared `<audio>` element for the whole editor session — §12 rule 4
 * of media-storage-investigation.md v5: "Reuse ONE `<audio>` element for the
 * whole session. Swap `src`; never create one per question." Constraint row
 * 12 ("`preload=\"none\"` on every `<audio>`") applies to it too.
 *
 * Used both for the author's own preview playback (a "▶" button next to an
 * attached audio question) and for the real load-to-`loadedmetadata`
 * playability check in `audio.ts` — the same element, never a second one,
 * so PH-C2's AC7 ("one `<audio>` DOM element after 20 questions") holds
 * regardless of how many times audio is attached, previewed or replaced.
 *
 * Lazily created on first use and appended to `document.body` exactly once
 * — never rendered visibly (no default browser controls; playback is
 * driven entirely by the "▶" button in the UI, never autoplay, per §5.3).
 */

let sharedElement: HTMLAudioElement | null = null;
let currentObjectUrl: string | null = null;

export function getSharedAudioElement(): HTMLAudioElement {
  if (!sharedElement) {
    sharedElement = document.createElement('audio');
    sharedElement.preload = 'none';
    sharedElement.hidden = true;
    sharedElement.dataset.role = 'shared-media-preview-audio';
    document.body.append(sharedElement);
  }
  return sharedElement;
}

/** Revokes whatever object URL is currently loaded into the shared element,
 *  if any — §12 rule 1/2: "revoke when the question leaves the screen",
 *  "never store an object URL persistently". */
export function revokeSharedAudioUrl(): void {
  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl);
    currentObjectUrl = null;
  }
}

/** Loads a blob into the shared element, revoking the previous object URL
 *  first (§12 rule 3: `removeAttribute('src')` → `load()` → revoke, applied
 *  here as "swap, then revoke the old one" since only one entry is ever live
 *  at a time). Returns the element and the freshly minted URL so a caller
 *  that needs the raw URL (none currently do) still can. Does not call
 *  `.load()` itself — callers that need a fresh `loadedmetadata` event
 *  (the playability check) call `.load()` explicitly afterward. */
export function loadIntoSharedAudio(blob: Blob): { el: HTMLAudioElement; url: string } {
  const el = getSharedAudioElement();
  el.pause();
  el.removeAttribute('src');
  revokeSharedAudioUrl();
  const url = URL.createObjectURL(blob);
  currentObjectUrl = url;
  el.src = url;
  return { el, url };
}

/** For tests only — lets a live-browser script assert the module's internal
 *  singleton state without reaching into module internals directly. */
export function debugSharedAudioState(): { hasElement: boolean; hasObjectUrl: boolean } {
  return { hasElement: sharedElement !== null, hasObjectUrl: currentObjectUrl !== null };
}
