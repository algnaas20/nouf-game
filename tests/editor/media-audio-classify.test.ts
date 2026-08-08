/**
 * PH-C2 AC4 (logic layer) — WAV over the ceiling is treated differently from
 * WAV under it, and unsupported containers are rejected outright. This is
 * pure classification/threshold logic (no real decode) — the real
 * load-to-loadedmetadata proof lives in tests/editor/live/media-intake.ts,
 * against real Chromium and a real WAV file this session builds.
 */
import { describe, expect, it } from 'vitest';
import { classifyAudioFile, extForAudioFormat, isOversizedWav } from '../../src/media/audio';
import { AUDIO_MAX_BYTES } from '../../src/media/limits';

describe('classifyAudioFile', () => {
  it('classifies by MIME type when present', () => {
    expect(classifyAudioFile({ type: 'audio/mpeg', name: 'x.bin' })).toBe('mp3');
    expect(classifyAudioFile({ type: 'audio/mp4', name: 'x.bin' })).toBe('m4a');
    expect(classifyAudioFile({ type: 'audio/x-m4a', name: 'x.bin' })).toBe('m4a');
    expect(classifyAudioFile({ type: 'audio/wav', name: 'x.bin' })).toBe('wav');
  });

  it('falls back to the file extension when MIME is empty (observed Windows .m4a uploads)', () => {
    expect(classifyAudioFile({ type: '', name: 'clip.m4a' })).toBe('m4a');
    expect(classifyAudioFile({ type: '', name: 'clip.mp3' })).toBe('mp3');
    expect(classifyAudioFile({ type: '', name: 'clip.wav' })).toBe('wav');
  });

  it('rejects an unrelated container outright (e.g. an .ogg or a renamed .mp4 video)', () => {
    expect(classifyAudioFile({ type: 'audio/ogg', name: 'clip.ogg' })).toBe('unsupported');
    expect(classifyAudioFile({ type: 'video/mp4', name: 'clip.mp4' })).toBe('unsupported');
    expect(classifyAudioFile({ type: '', name: 'clip.exe' })).toBe('unsupported');
  });
});

describe('extForAudioFormat', () => {
  it('maps each accepted format to its own extension', () => {
    expect(extForAudioFormat('mp3')).toBe('mp3');
    expect(extForAudioFormat('m4a')).toBe('m4a');
    expect(extForAudioFormat('wav')).toBe('wav');
  });
});

describe('isOversizedWav (PH-C2 AC4 — two cases, two results)', () => {
  it('a small WAV (≤ 2 MB) is accepted — not oversized', () => {
    const smallBytes = AUDIO_MAX_BYTES; // exactly at the ceiling — still accepted
    console.log('AC4 case 2 — small WAV bytes:', smallBytes, '→ oversized:', isOversizedWav('wav', smallBytes));
    expect(isOversizedWav('wav', smallBytes)).toBe(false);
    expect(isOversizedWav('wav', 100)).toBe(false);
  });

  it('a large WAV (> 2 MB) is rejected — oversized', () => {
    const largeBytes = AUDIO_MAX_BYTES + 1;
    console.log('AC4 case 1 — large WAV bytes:', largeBytes, '→ oversized:', isOversizedWav('wav', largeBytes));
    expect(isOversizedWav('wav', largeBytes)).toBe(true);
  });

  it('the same byte counts do NOT trigger the WAV rule for mp3/m4a — only WAV is size-gated this way', () => {
    const largeBytes = AUDIO_MAX_BYTES + 1;
    expect(isOversizedWav('mp3', largeBytes)).toBe(false);
    expect(isOversizedWav('m4a', largeBytes)).toBe(false);
  });
});
