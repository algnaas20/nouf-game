/**
 * Transient, render-only UI state for the image/audio question screens —
 * NOT part of the core `GameState` (never folded, never undo-relevant: it
 * only tracks which *beat* of a media question the operator is looking at,
 * and audio playback progress). Owned and reset by `app.ts` every time
 * `state.currentQuestionId` changes to a new value, so it can never leak
 * across questions or survive an undo into the wrong question.
 */
export type AudioPlaybackState = 'idle' | 'playing' | 'ended' | 'error';

export interface MediaUiState {
  /** Image questions only (Skeleton B, two-beat layout, §6.2). Forced to 2
   *  once `revealed` is true, regardless of this value. */
  imageBeat: 1 | 2;
  /** Audio questions only (D-09.19 / Skeleton C). */
  audio: {
    hasEverPlayed: boolean;
    playbackState: AudioPlaybackState;
    /** Options become tappable once true — set on `ended`, or by the
     *  always-present «اعرض الخيارات» escape hatch. Forced true once
     *  `revealed` is true. */
    optionsRevealed: boolean;
  };
}

export function initialMediaUiState(): MediaUiState {
  return {
    imageBeat: 1,
    audio: { hasEverPlayed: false, playbackState: 'idle', optionsRevealed: false },
  };
}
