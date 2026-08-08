import type { OptionIndex, Question, TeamId } from '../../contracts';
import { decideOptionsLayout, equalizeCardHeights } from '../options-layout';
import { buildUndoCorner } from '../undo-corner';
import { formatDigits } from '../format-digits';
import type { AudioPlaybackState, MediaUiState } from './media-ui-state';
import {
  buildStatusStrip,
  buildTurnHeader,
  buildOptionsGrid,
  buildResultBanner,
  buildOperatorBar,
} from './chrome';

export interface AudioQuestionScreenParams {
  question: Question;
  audioUrl: string;
  optionOrder: [OptionIndex, OptionIndex, OptionIndex, OptionIndex];
  teamNames: [string, string];
  answeringTeam: TeamId;
  positions: [number, number];
  revealed: boolean;
  chosenOption: OptionIndex | null;
  canUndo: boolean;
  mediaUi: MediaUiState;
  setMediaUi: (patch: Partial<MediaUiState>) => void;
  onChoose: (optionIndex: OptionIndex) => void;
  onNoAnswer: () => void;
  onNext: () => void;
  onUndo: () => void;
}

function otherTeam(t: TeamId): TeamId {
  return t === 'A' ? 'B' : 'A';
}

function formatTime(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) totalSeconds = 0;
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${formatDigits(m)}:${String(formatDigits(s)).padStart(2, '0')}`;
}

// ---- module-level playback/analyser bookkeeping ----------------------
// One shared AudioContext (browsers cap the count meaningfully); a fresh
// AnalyserNode + MediaElementSourceNode per `<audio>` element, since
// `createMediaElementSource` may only ever be called once per element and
// this screen builds a brand new element on every render (§ "no reuse of
// a media element across an undo/re-render" avoids ever calling it twice
// on the same node).
let sharedAudioCtx: AudioContext | null = null;
let activeAudioEl: HTMLAudioElement | null = null;
let activeRafId: number | null = null;

/**
 * Question ids that have already had an automatic play() attempt — checked
 * independently of `MediaUiState` (which is app.ts's re-render-triggering
 * state) precisely so an automatic attempt can never re-fire on every
 * re-render. Without this guard, a blocked `play()` (NotAllowedError) sets
 * `playbackState` back to 'idle' via `setMediaUi`, which re-renders this
 * screen, which — if the retry condition depended on state that hadn't
 * changed — would attempt `play()` again, fail again, and re-render again:
 * an infinite loop that was caught live (Playwright's click kept finding
 * the button "detached from the DOM, retrying" — the screen was being
 * rebuilt every microtask). One attempt per question id, ever, full stop;
 * the operator's own tap on «أعِد التشغيل»/the play button is unaffected.
 */
const autoplayAttemptedIds = new Set<string>();

function getAudioCtx(): AudioContext | null {
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!sharedAudioCtx) sharedAudioCtx = new Ctor();
  return sharedAudioCtx;
}

/** Stops whatever audio question screen was previously active — called at
 *  the top of every screen render (question.ts's dispatcher) so navigating
 *  away from an audio question (including re-rendering the same one) never
 *  leaves a clip playing under a different screen. */
export function stopActiveAudio(): void {
  if (activeRafId !== null) {
    cancelAnimationFrame(activeRafId);
    activeRafId = null;
  }
  if (activeAudioEl) {
    activeAudioEl.pause();
    activeAudioEl = null;
  }
}

/**
 * Audio-question screen — Skeleton C (stage-ux-investigation.md §6.3) +
 * D-09.19: options stay hidden (rendered, but concealed and untappable —
 * never omitted from the DOM, so the SAME `buildOptionsGrid` no-tell
 * mechanism as every other screen type is exercised here too) during the
 * first playback, auto-revealed on `ended`, with an always-present
 * «اعرض الخيارات» escape so a failed `ended` event costs one tap, never a
 * frozen screen (play-experience ruling 8).
 */
export function renderAudioQuestionScreen(container: HTMLElement, p: AudioQuestionScreenParams): void {
  container.innerHTML = '';
  stopActiveAudio();

  const safe = document.createElement('div');
  safe.className = 'stage-safe';

  const teamNameOf = (t: TeamId) => (t === 'A' ? p.teamNames[0] : p.teamNames[1]);
  const readingTeam = otherTeam(p.answeringTeam);

  safe.append(
    buildStatusStrip(p.teamNames, p.positions),
    buildTurnHeader(teamNameOf(readingTeam), teamNameOf(p.answeringTeam)),
  );

  if (p.question.text) {
    const qText = document.createElement('p');
    qText.className = 'type-question audio-question-text';
    qText.textContent = p.question.text;
    safe.append(qText);
  }

  const audioArea = document.createElement('div');
  audioArea.className = 'audio-area';

  const meter = document.createElement('div');
  meter.className = 'audio-level-meter';
  const BAR_COUNT = 24;
  const bars: HTMLElement[] = [];
  for (let i = 0; i < BAR_COUNT; i++) {
    const bar = document.createElement('span');
    bar.className = 'audio-level-bar';
    meter.append(bar);
    bars.push(bar);
  }

  const stateLabel = document.createElement('p');
  stateLabel.className = 'type-audio-state';

  const timeLabel = document.createElement('span');
  timeLabel.className = 'audio-time ltr-isolate';

  const audio = document.createElement('audio');
  audio.src = p.audioUrl;
  audio.preload = 'none'; // constraint row 12 — never eager-fetch media.

  const optionsRevealed = p.revealed || p.mediaUi.audio.optionsRevealed;

  // Tracks the REAL current playback phase from this element's own events,
  // independent of `p.mediaUi` (a snapshot frozen at render time). Needed
  // because `setMediaUi` triggers a full app.ts re-render — a brand new
  // `<audio>` element and a brand new closure over a NEW `p.mediaUi` — so a
  // late event firing on THIS (possibly now-detached) element must not
  // blindly spread the stale `p.mediaUi.audio` it closed over: a real bug,
  // caught live, where a `pause` event arriving just after `error` had
  // already been recorded spread the pre-error snapshot and silently
  // overwrote 'error' back to 'idle' (worklog-B2.md §4 item 2's twin —
  // `play().catch()` was the first instance of this same class of bug;
  // `pause` was the second, found by direct reproduction).
  let localState: AudioPlaybackState = p.mediaUi.audio.playbackState;

  function setStateLabel(state: 'idle' | 'playing' | 'ended' | 'error'): void {
    stateLabel.textContent =
      state === 'playing' ? 'يُشغَّل الآن' : state === 'ended' ? 'انتهى المقطع' : state === 'error' ? 'تعذّر تشغيل المقطع. تابعوا بالسؤال نصّياً.' : 'متوقّف';
  }
  setStateLabel(p.mediaUi.audio.playbackState === 'idle' ? 'idle' : p.mediaUi.audio.playbackState);

  function updateTimeLabel(): void {
    timeLabel.textContent = `${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`;
  }
  updateTimeLabel();

  function stopMeterLoop(): void {
    if (activeRafId !== null) {
      cancelAnimationFrame(activeRafId);
      activeRafId = null;
    }
    for (const bar of bars) bar.style.blockSize = '0%';
  }

  function startMeterLoop(analyser: AnalyserNode): void {
    const data = new Uint8Array(analyser.frequencyBinCount);
    const step = () => {
      analyser.getByteFrequencyData(data);
      const perBar = Math.floor(data.length / BAR_COUNT) || 1;
      for (let i = 0; i < BAR_COUNT; i++) {
        const v = data[i * perBar] ?? 0;
        const bar = bars[i];
        // No artificial minimum height — a genuinely silent/broken source
        // must read as flat (0%), not a decorative idle shimmer (V22).
        if (bar) bar.style.blockSize = `${(v / 255) * 100}%`;
      }
      activeRafId = requestAnimationFrame(step);
    };
    activeRafId = requestAnimationFrame(step);
  }

  audio.addEventListener('playing', () => {
    localState = 'playing';
    p.setMediaUi({ audio: { ...p.mediaUi.audio, hasEverPlayed: true, playbackState: 'playing' } });
  });
  audio.addEventListener('pause', () => {
    if (audio.ended) return;
    // Only a pause of GENUINELY active playback means "idle" — a `pause`
    // firing as a side effect of a failed/never-started `play()` (observed
    // live, immediately after `error`) must not clobber whatever real
    // state was already recorded.
    if (localState !== 'playing') return;
    localState = 'idle';
    p.setMediaUi({ audio: { ...p.mediaUi.audio, playbackState: 'idle' } });
  });
  audio.addEventListener('timeupdate', updateTimeLabel);
  audio.addEventListener('loadedmetadata', updateTimeLabel);
  audio.addEventListener('ended', () => {
    localState = 'ended';
    p.setMediaUi({ audio: { ...p.mediaUi.audio, playbackState: 'ended', optionsRevealed: true } });
  });
  audio.addEventListener('error', () => {
    localState = 'error';
    stopMeterLoop();
    p.setMediaUi({ audio: { ...p.mediaUi.audio, playbackState: 'error' } });
  });

  function attemptPlay(): void {
    const ctx = getAudioCtx();
    if (ctx) {
      if (ctx.state === 'suspended') void ctx.resume();
      try {
        const source = ctx.createMediaElementSource(audio);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 128;
        source.connect(analyser);
        analyser.connect(ctx.destination);
        startMeterLoop(analyser);
      } catch {
        // Real audio graph wiring failed (e.g. a broken/undecodable source in
        // some engines throws here rather than on `error`) — the level meter
        // simply never animates, which is the truthful state (V22): it is
        // driven only by real output, never a decorative loop.
      }
    }
    activeAudioEl = audio;
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch((err: unknown) => {
        // Only NotAllowedError means "autoplay blocked, source is fine" —
        // §4.7: show the big "press to play" target, never a frozen or
        // silently-failed screen. Any OTHER rejection reason (a genuinely
        // broken/undecodable source — NotSupportedError, AbortError, …) is
        // the real media-failure path, and the `error` LISTENER above is
        // what sets `playbackState: 'error'` (V22) — this handler must not
        // clobber that with 'idle' using a stale `p.mediaUi` snapshot (a
        // real bug caught live: it raced the `error` event and overwrote
        // the truthful error state back to "متوقّف").
        const name = err instanceof DOMException ? err.name : '';
        if (name === 'NotAllowedError' && localState !== 'error') {
          localState = 'idle';
          p.setMediaUi({ audio: { ...p.mediaUi.audio, playbackState: 'idle' } });
        }
      });
    }
  }

  const playBtn = document.createElement('button');
  playBtn.type = 'button';
  playBtn.className = 'op-button primary type-operator-button audio-play-button';
  playBtn.textContent = p.mediaUi.audio.hasEverPlayed ? 'أعِد التشغيل' : 'اضغط لتشغيل المقطع';
  playBtn.addEventListener('click', () => {
    audio.currentTime = 0;
    attemptPlay();
  });

  const volumeBtn = document.createElement('button');
  volumeBtn.type = 'button';
  volumeBtn.className = 'op-button type-operator-button';
  volumeBtn.textContent = '🔊 الصوت';
  let muted = false;
  volumeBtn.addEventListener('click', () => {
    muted = !muted;
    audio.muted = muted;
    volumeBtn.textContent = muted ? '🔇 الصوت' : '🔊 الصوت';
  });

  const showOptionsBtn = document.createElement('button');
  showOptionsBtn.type = 'button';
  showOptionsBtn.className = 'op-button type-operator-button';
  showOptionsBtn.textContent = 'اعرض الخيارات';
  showOptionsBtn.disabled = optionsRevealed;
  showOptionsBtn.addEventListener('click', () => {
    p.setMediaUi({ audio: { ...p.mediaUi.audio, optionsRevealed: true } });
  });

  audioArea.append(meter, stateLabel, timeLabel);
  safe.append(audioArea);

  const { grid, cards, textEls } = buildOptionsGrid({
    question: p.question,
    optionOrder: p.optionOrder,
    revealed: p.revealed,
    chosenOption: p.chosenOption,
    disabled: !optionsRevealed,
    onChoose: p.onChoose,
  });
  // Concealed (not omitted — §buildOptionsGrid's own doc comment) while
  // hidden: the SAME four cards exist in the DOM the whole time, an opaque
  // cover class is what hides them, never their absence.
  if (!optionsRevealed) grid.classList.add('concealed');
  safe.append(grid);

  if (p.revealed) {
    const isCorrect = p.chosenOption === p.question.correctIndex;
    safe.append(buildResultBanner(isCorrect));
  }

  safe.append(
    buildOperatorBar({
      extraButtons: [playBtn, volumeBtn, showOptionsBtn],
      revealed: p.revealed,
      noAnswerDisabled: p.revealed,
      onNoAnswer: p.onNoAnswer,
      onNext: p.onNext,
    }),
  );
  safe.append(buildUndoCorner(p.canUndo, p.onUndo));
  safe.append(audio);

  container.append(safe);

  decideOptionsLayout(grid, textEls);
  equalizeCardHeights(cards);

  // Autoplay: chained to the tap that showed the question (Skeleton C) —
  // attempted automatically exactly ONCE per question id, ever (see
  // `autoplayAttemptedIds`'s doc comment — this must NOT be re-derived from
  // `mediaUi`, which would loop). Never on an already-revealed re-render.
  if (!p.revealed && !autoplayAttemptedIds.has(p.question.id)) {
    autoplayAttemptedIds.add(p.question.id);
    attemptPlay();
  } else if (p.mediaUi.audio.playbackState !== 'playing') {
    stopMeterLoop();
  }
}
