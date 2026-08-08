/**
 * Audio intake — §5 of media-storage-investigation.md v5.
 *
 * "MP3 or AAC/M4A... Reject WAV [above the ceiling] with a clear Arabic
 * explanation... No in-browser audio transcoding: the platform has no
 * offline audio encoder" — so this module never re-encodes audio, only
 * classifies, validates and (for WAV) enforces the ceiling that stands in
 * for a hard rejection.
 *
 * Playability is checked two ways, exactly as named in the dispatch:
 *   1. `canPlayType` — a fast, synchronous pre-check.
 *   2. A real load-to-`loadedmetadata` test — the only thing that actually
 *      proves the browbrowser can decode *this* file, not just that the
 *      container/codec is plausible. A file that "looks supported" and does
 *      not play would otherwise be discovered live, in front of guests.
 */

import { AUDIO_MAX_BYTES } from './limits';
import { getSharedAudioElement, loadIntoSharedAudio } from './audio-element';

export type AudioFormat = 'mp3' | 'm4a' | 'wav' | 'unsupported';

const MP3_MIME_TYPES = new Set(['audio/mpeg', 'audio/mp3']);
const M4A_MIME_TYPES = new Set(['audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/m4a']);
const WAV_MIME_TYPES = new Set(['audio/wav', 'audio/x-wav', 'audio/wave']);

function extOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot === -1 ? '' : name.slice(dot + 1).toLowerCase();
}

/** Classifies by MIME type first (authoritative when present — browsers
 *  reliably set it from file content sniffing, not just the extension), and
 *  falls back to the file extension when the browser hands back an empty or
 *  generic MIME type (observed for some `.m4a` uploads on Windows). */
export function classifyAudioFile(file: { type: string; name: string }): AudioFormat {
  const mime = file.type.toLowerCase();
  if (MP3_MIME_TYPES.has(mime)) return 'mp3';
  if (M4A_MIME_TYPES.has(mime)) return 'm4a';
  if (WAV_MIME_TYPES.has(mime)) return 'wav';

  const ext = extOf(file.name);
  if (ext === 'mp3') return 'mp3';
  if (ext === 'm4a' || ext === 'aac') return 'm4a';
  if (ext === 'wav') return 'wav';
  return 'unsupported';
}

export function extForAudioFormat(format: Exclude<AudioFormat, 'unsupported'>): string {
  if (format === 'mp3') return 'mp3';
  if (format === 'm4a') return 'm4a';
  return 'wav';
}

/** A WAV is only rejected above the ceiling — a short WAV clip fits the
 *  budget just like any other accepted audio file (خطة.md PH-C2 AC4: "WAV
 *  صغير يُقبل"). This is the one place that rule lives. */
export function isOversizedWav(format: AudioFormat, bytes: number): boolean {
  return format === 'wav' && bytes > AUDIO_MAX_BYTES;
}

const MIME_FOR_CANPLAYTYPE: Record<Exclude<AudioFormat, 'unsupported'>, string> = {
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  wav: 'audio/wav',
};

/** Fast pre-check — `''` means "definitely not", `'maybe'`/`'probably'` mean
 *  "worth trying". Never authoritative on its own (browsers are
 *  conservative and sometimes say `'maybe'` for files that then fail to
 *  decode) — always followed by `validateAudioPlayability` before a file is
 *  accepted into the draft. */
export function canLikelyPlayAudio(format: Exclude<AudioFormat, 'unsupported'>): boolean {
  const el = getSharedAudioElement();
  const support = el.canPlayType(MIME_FOR_CANPLAYTYPE[format]);
  return support === 'probably' || support === 'maybe';
}

export interface AudioPlayabilityResult {
  ok: boolean;
  durationSeconds: number;
}

/**
 * The real load-to-`loadedmetadata` test, against the one shared `<audio>`
 * element (never a second, throwaway one — keeps AC7's DOM-element count
 * true even during validation, not just during preview playback).
 */
export function validateAudioPlayability(
  blob: Blob,
  timeoutMs = 5000,
): Promise<AudioPlayabilityResult> {
  return new Promise((resolve) => {
    const { el } = loadIntoSharedAudio(blob);

    let settled = false;
    const finish = (result: AudioPlayabilityResult): void => {
      if (settled) return;
      settled = true;
      el.removeEventListener('loadedmetadata', onLoaded);
      el.removeEventListener('error', onError);
      clearTimeout(timer);
      resolve(result);
    };
    const onLoaded = (): void => finish({ ok: true, durationSeconds: el.duration || 0 });
    const onError = (): void => finish({ ok: false, durationSeconds: 0 });
    const timer = setTimeout(() => finish({ ok: false, durationSeconds: 0 }), timeoutMs);

    el.addEventListener('loadedmetadata', onLoaded);
    el.addEventListener('error', onError);
    el.load();
  });
}
