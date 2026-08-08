/**
 * Bootstrap module for the PH-A4 live-browser proof
 * (tests/core/live/real-refresh.ts). Runs the REAL `src/core` functions —
 * `applyEvent`, `legalEvents`, `fold`, and `session-store.ts`'s
 * `saveSession`/`checkResume` against the REAL `window.localStorage` (no
 * injected fake here — that is what makes the reload proof real).
 *
 * Behaviour:
 * - First load (nothing stored yet, or a mismatched-deck probe): plays a
 *   short, deterministic partial game (mixing at least one correct and one
 *   wrong answer, so a turn pass and a shuffled option order are both in
 *   flight), saves it via the real `saveSession`, and exposes the
 *   pre-interruption state on `window.__preInterruptionState` before the
 *   Playwright script triggers a real `page.reload()`.
 * - After a real reload, a stored session already matches the harness's
 *   deck hash, so this module does NOT replay — it only calls the real
 *   `checkResume` and exposes the result on `window.__resumeResult`.
 */

import type { GameEvent, Question, TeamId } from '../../../src/contracts';
import { fold } from '../../../src/core/fold';
import { applyEvent } from '../../../src/core/reducer';
import { legalEvents, type GameContext } from '../../../src/core/legal';
import { saveSession, checkResume, clearSession } from '../../../src/core/session-store';

declare global {
  interface Window {
    __preInterruptionState?: unknown;
    __preInterruptionEvents?: unknown;
    __resumeResult?: unknown;
    __deckHash?: string;
    __wrongDeckHash?: string;
    __checkResumeWithWrongDeck?: () => unknown;
    __clearSession?: () => void;
    __syncWriteProbe?: { rawImmediatelyAfterSave: string | null };
  }
}

const DECK: Question[] = Array.from({ length: 10 }, (_, i) => ({
  id: `harness-q${i + 1}`,
  text: `سؤال حي رقم ${i + 1}؟`,
  options: ['أ', 'ب', 'ج', 'د'],
  correctIndex: (i % 4) as 0 | 1 | 2 | 3,
  media: { kind: 'none' as const },
}));

function computeDeckHash(deck: readonly Question[]): string {
  return deck.map((q) => q.id).join('|');
}

const DECK_HASH = computeDeckHash(DECK);
const WRONG_DECK_HASH = computeDeckHash(DECK.slice(0, 8)); // a genuinely different deck

window.__deckHash = DECK_HASH;
window.__wrongDeckHash = WRONG_DECK_HASH;
window.__checkResumeWithWrongDeck = () => checkResume(WRONG_DECK_HASH);
window.__clearSession = () => clearSession();

function playDeterministicPartialGame(firstTeam: TeamId): GameEvent[] {
  const events: GameEvent[] = [
    {
      type: 'GAME_STARTED',
      seq: 0,
      at: 0,
      seed: 4242,
      N: 5,
      teamNames: ['فريق أ', 'فريق ب'],
      firstTeam,
      deckHash: DECK_HASH,
    },
  ];
  let state = fold(events);
  // Deterministic sequence: answer correctly, then wrongly, then correctly
  // again — guarantees at least one MOVE_APPLIED with delta>0, one with
  // delta===0, and a TURN_PASSED, before stopping mid-question so a
  // shuffled optionOrder is captured "on screen" at interruption time.
  const wantCorrect = [true, false, true];
  let answerIndex = 0;
  while (state.stateId !== 'FINISHED' && events.length < 20) {
    const ctx: GameContext = { deck: DECK, events, now: () => 0 };
    const candidates = legalEvents(state, ctx);
    if (candidates.length === 0) break;
    let chosen: GameEvent;
    if (state.stateId === 'QUESTION_SHOWN') {
      const want = wantCorrect[Math.min(answerIndex, wantCorrect.length - 1)];
      answerIndex++;
      chosen =
        candidates.find((c) => c.type === 'ANSWER_CHOSEN' && c.correct === want) ?? candidates[0]!;
      // Stop right after the THIRD question is shown (before answering it)
      // so the interruption happens with a real on-screen question and a
      // real shuffled optionOrder in flight.
      if (answerIndex > wantCorrect.length) break;
    } else {
      chosen = candidates[0]!;
    }
    state = applyEvent(state, chosen);
    events.push(chosen);
  }
  return events;
}

const existing = checkResume(DECK_HASH);

if (existing.kind === 'available') {
  // Post-reload path: report what a real reload + real localStorage gave
  // back, without touching it further.
  window.__resumeResult = existing;
} else {
  // First-load path: play, save via the REAL localStorage, expose the
  // pre-interruption snapshot for the Playwright script to capture.
  const events = playDeterministicPartialGame('A');
  saveSession(events); // real localStorage — no injected storage argument
  const rawImmediatelyAfterSave = window.localStorage.getItem('nouf-game:session:v1');
  window.__syncWriteProbe = { rawImmediatelyAfterSave };
  window.__preInterruptionState = fold(events);
  window.__preInterruptionEvents = events;
}

const readyMarker = document.getElementById('ready');
if (readyMarker) readyMarker.textContent = 'ready';
