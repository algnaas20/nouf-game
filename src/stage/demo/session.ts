/**
 * WALKING-SKELETON DEMO DRIVER — PH-B1 only.
 *
 * `src/core/**` (WL-A's applyEvent/legalEvents/selectNextQuestion/fold/undo
 * over the frozen `GameEvent`/`GameState` contracts) does not exist yet in
 * this isolated worktree — the four work lines run in parallel from the
 * same frozen-contracts commit and are integrated later by the coordinator.
 *
 * This file is therefore NOT an implementation of the core reducer and
 * does not claim to satisfy PH-A1's invariants (I1/I3/I5/I6/I7). It is a
 * small, self-contained state holder whose only job is to let the three
 * PH-B1 screens (home/question/winner) be driven by *something* real for
 * the walking-skeleton demo: 3 hardcoded text questions, strict
 * alternation, one point per correct answer, undo-by-snapshot.
 *
 * It must be replaced by real `src/core` wiring in PH-B2 — do not extend
 * this file with rule logic (R-b, deck bands, tiebreak, maze). That is
 * WL-A's owned surface.
 */

import type { Question, OptionIndex } from '../../contracts/question';

export type Team = 'A' | 'B';

/** Seeded PRNG (mulberry32) — deterministic so the demo's option shuffle is
 * reproducible in tests, not `Math.random()`. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates with a seeded RNG — the on-screen option order, fixed for
 * the life of the question (including across undo, since it lives in the
 * snapshotted DemoState). §4.9: "shuffle once per question per session". */
function shuffledOptionOrder(seed: number): [OptionIndex, OptionIndex, OptionIndex, OptionIndex] {
  const rand = mulberry32(seed);
  const arr: OptionIndex[] = [0, 1, 2, 3];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const ai = arr[i]!;
    const aj = arr[j]!;
    arr[i] = aj;
    arr[j] = ai;
  }
  return arr as [OptionIndex, OptionIndex, OptionIndex, OptionIndex];
}

export const DEMO_TEAM_NAMES: [string, string] = ['الفريق الأزرق', 'الفريق البرتقالي'];

export const DEMO_QUESTIONS: Question[] = [
  {
    id: 'demo-1',
    text: 'ما هي عاصمة المملكة العربية السعودية؟',
    options: ['الرياض', 'جدة', 'الدمام', 'مكة المكرمة'],
    correctIndex: 0,
    media: { kind: 'none' },
  },
  {
    id: 'demo-2',
    text: 'كم عدد أيام الأسبوع؟',
    options: ['خمسة أيام', 'ستة أيام', 'سبعة أيام', 'ثمانية أيام'],
    correctIndex: 2,
    media: { kind: 'none' },
  },
  {
    id: 'demo-3',
    text: 'أي كوكب هو الأقرب إلى الشمس؟',
    options: ['الأرض', 'عطارد', 'المريخ', 'الزهرة'],
    correctIndex: 1,
    media: { kind: 'none' },
  },
];

export interface DemoState {
  questionIndex: number;
  answeringTeam: Team;
  scores: [number, number];
  revealed: boolean;
  chosenOption: 0 | 1 | 2 | 3 | null;
  finished: boolean;
  /** Fixed on-screen order of the four options — §4.9, never re-shuffled on render. */
  optionOrder: [OptionIndex, OptionIndex, OptionIndex, OptionIndex];
}

export function initialDemoState(): DemoState {
  return {
    questionIndex: 0,
    answeringTeam: 'A',
    scores: [0, 0],
    revealed: false,
    chosenOption: null,
    finished: false,
    optionOrder: shuffledOptionOrder(0),
  };
}

function clone(s: DemoState): DemoState {
  return { ...s, scores: [...s.scores] as [number, number] };
}

/** Snapshot-stack undo — one level is enough for a demo driver; the real
 * core (PH-A1) implements undo as pop-last-event-and-re-fold. */
export class DemoSession {
  state: DemoState = initialDemoState();
  private history: DemoState[] = [];

  currentQuestion(): Question {
    const q = DEMO_QUESTIONS[this.state.questionIndex];
    if (!q) throw new Error(`demo question index out of range: ${this.state.questionIndex}`);
    return q;
  }

  canUndo(): boolean {
    return this.history.length > 0;
  }

  chooseOption(optionIndex: 0 | 1 | 2 | 3): void {
    if (this.state.revealed || this.state.finished) return;
    this.history.push(clone(this.state));
    const q = this.currentQuestion();
    const correct = optionIndex === q.correctIndex;
    const next = clone(this.state);
    next.revealed = true;
    next.chosenOption = optionIndex;
    if (correct) {
      const idx = next.answeringTeam === 'A' ? 0 : 1;
      next.scores[idx] += 1;
    }
    this.state = next;
  }

  nextQuestion(): void {
    if (!this.state.revealed || this.state.finished) return;
    this.history.push(clone(this.state));
    const next = clone(this.state);
    const isLast = next.questionIndex >= DEMO_QUESTIONS.length - 1;
    if (isLast) {
      next.finished = true;
    } else {
      next.questionIndex += 1;
      next.answeringTeam = next.answeringTeam === 'A' ? 'B' : 'A';
      next.revealed = false;
      next.chosenOption = null;
      next.optionOrder = shuffledOptionOrder(next.questionIndex + 17);
    }
    this.state = next;
  }

  undo(): void {
    const prev = this.history.pop();
    if (prev) this.state = prev;
  }

  restart(): void {
    this.history = [];
    this.state = initialDemoState();
  }
}
