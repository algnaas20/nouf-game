/**
 * Runtime-synthesized placeholder media for `fixture-deck.ts` and the manual
 * verification scripts under `tests/stage/**`. **Test-only** — relocated
 * here from `src/stage/session/placeholder-media.ts` (deleted, D-25 /
 * worklog-B5.md, 2026-08-08): the product no longer ships or plays a
 * bundled demo/placeholder deck, and this generator must never be imported
 * from `src/**` again. It exists only so the manual Playwright drivers can
 * exercise the image/audio question SCREENS (layout, the 620x620 floor, the
 * two-beat flow, the hidden-until-ended audio phasing, the level meter,
 * failure states) with real `<img>`/`<audio>` elements, without depending on
 * a real author's IndexedDB-stored blobs for every check.
 *
 * Images are returned as `data:image/png` URLs (canvas-drawn). Audio is
 * returned as a `data:audio/wav` URL (a synthesized tone with a fade
 * envelope) — deliberately a data URL, not an object URL, so there is
 * nothing to revoke/leak.
 */

export type ImageAspect = 'landscape' | 'portrait' | 'square';

export function makePlaceholderImageDataUrl(opts: {
  label: string;
  aspect: ImageAspect;
  seed: number;
}): string {
  const { label, aspect, seed } = opts;
  const w = aspect === 'portrait' ? 900 : aspect === 'square' ? 1000 : 1600;
  const h = aspect === 'portrait' ? 1200 : aspect === 'square' ? 1000 : 900;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const hue = (seed * 47) % 360;
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, `hsl(${hue}, 55%, 32%)`);
  grad.addColorStop(1, `hsl(${(hue + 65) % 360}, 55%, 16%)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  ctx.font = `bold ${Math.floor(w / 11)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, w / 2, h / 2, w * 0.86);
  return canvas.toDataURL('image/png');
}

function bufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** A short synthesized WAV tone (mono, 8kHz, 16-bit PCM) as a data URL. */
export function makePlaceholderAudioDataUrl(opts: { freqHz: number; seconds: number }): string {
  const sampleRate = 8000;
  const length = Math.max(1, Math.floor(sampleRate * opts.seconds));
  const buffer = new ArrayBuffer(44 + length * 2);
  const view = new DataView(buffer);
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, length * 2, true);
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const env = Math.min(1, t * 20) * Math.min(1, (opts.seconds - t) * 20);
    const sample = Math.sin(2 * Math.PI * opts.freqHz * t) * 0.4 * env;
    view.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, sample)) * 32767), true);
  }
  return `data:audio/wav;base64,${bufferToBase64(buffer)}`;
}

/** A deliberately-broken audio source — for the "audio state truthfulness"
 *  failure-path fixture (V22): a data URL that is not valid audio at all. */
export const BROKEN_AUDIO_URL = 'data:audio/wav;base64,not-a-real-wav-file';
