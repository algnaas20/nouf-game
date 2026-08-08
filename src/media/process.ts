/**
 * Top-level media-intake orchestration — the single entry point
 * `src/editor/ui/*` calls when the author attaches a file. Ties together
 * classification, the per-kind processing pipeline, playability validation,
 * content-addressed hashing, and turns every failure into one of the calm
 * Arabic messages from `src/editor/copy.ts` (constraint row 17) — never a
 * raw exception reaching the UI.
 */

import type { QuestionMedia } from '../contracts';
import { AR_COPY } from '../editor/copy';
import { isSupportedImageType, processImageFile } from './image';
import {
  canLikelyPlayAudio,
  classifyAudioFile,
  extForAudioFormat,
  isOversizedWav,
  validateAudioPlayability,
} from './audio';
import { hashAndName } from './hash';

export interface MediaProcessSuccess {
  ok: true;
  kind: 'image' | 'audio';
  media: QuestionMedia;
  blob: Blob;
  bytes: number;
  /** Present for images only — informational, never shown as a "we
   *  compressed this" message per §4's "never a visible compress step". */
  dimensions?: { width: number; height: number };
  /** Present for audio only. */
  durationSeconds?: number;
}

export interface MediaProcessFailure {
  ok: false;
  reason: string;
}

export type MediaProcessResult = MediaProcessSuccess | MediaProcessFailure;

function isImageFile(file: File): boolean {
  return file.type.toLowerCase().startsWith('image/');
}

function isLikelyAudioFile(file: File): boolean {
  if (file.type.toLowerCase().startsWith('audio/')) return true;
  const ext = file.name.toLowerCase().split('.').pop() ?? '';
  return ['mp3', 'm4a', 'aac', 'wav'].includes(ext);
}

async function processAsImage(file: File): Promise<MediaProcessResult> {
  if (!isSupportedImageType(file.type)) {
    return { ok: false, reason: AR_COPY.unsupportedMediaType };
  }
  let processed;
  try {
    processed = await processImageFile(file);
  } catch {
    return { ok: false, reason: AR_COPY.imageUndecodable };
  }
  const { sha256 } = await hashAndName(processed.blob, processed.ext);
  const media: QuestionMedia = { kind: 'image', sha256, ext: processed.ext };
  return {
    ok: true,
    kind: 'image',
    media,
    blob: processed.blob,
    bytes: processed.blob.size,
    dimensions: { width: processed.width, height: processed.height },
  };
}

async function processAsAudio(file: File): Promise<MediaProcessResult> {
  const format = classifyAudioFile(file);
  if (format === 'unsupported') {
    return { ok: false, reason: AR_COPY.unsupportedMediaType };
  }
  if (isOversizedWav(format, file.size)) {
    return { ok: false, reason: AR_COPY.audioWavTooLarge };
  }

  // Fast pre-check first ("canPlayType plus a real load test" — the
  // dispatch's exact wording). Not fatal on 'maybe' — browsers are
  // conservative and sometimes under-report — but an outright '' blocks
  // early, saving a full load-to-loadedmetadata round trip on a file that
  // is certainly wrong, and it reuses the one shared `<audio>` element
  // rather than creating a throwaway one.
  if (!canLikelyPlayAudio(format)) {
    return { ok: false, reason: AR_COPY.audioUnplayable };
  }

  const playability = await validateAudioPlayability(file);
  if (!playability.ok) {
    return { ok: false, reason: AR_COPY.audioUnplayable };
  }

  const ext = extForAudioFormat(format);
  const { sha256 } = await hashAndName(file, ext);
  const media: QuestionMedia = { kind: 'audio', sha256, ext };
  return {
    ok: true,
    kind: 'audio',
    media,
    blob: file,
    bytes: file.size,
    durationSeconds: playability.durationSeconds,
  };
}

export async function processMediaFile(file: File): Promise<MediaProcessResult> {
  if (isImageFile(file)) return processAsImage(file);
  if (isLikelyAudioFile(file)) return processAsAudio(file);
  return { ok: false, reason: AR_COPY.unsupportedMediaType };
}
