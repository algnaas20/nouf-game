/**
 * The authoring draft store — CRUD, reorder and delete-with-undo on top of
 * `src/storage/idb.ts`. This is the "draft store" half of PH-C1's title;
 * `src/storage/idb.ts` is the raw persistence, this file is the orchestration
 * layer the UI (and tests) actually talk to.
 *
 * Every single backend write in this file (question puts, question
 * deletes, meta touches — add, update, reorder and delete-commit alike)
 * goes through `guardedWrite`, so a `QuotaExceededError` from *any* of them
 * turns into the same Arabic banner state rather than an unhandled
 * rejection (constraint row 13 / 17 and the WL-C C1 vocabulary rule —
 * never claim a write succeeded when it did not, and never let one go
 * unnoticed either).
 */

import type { OptionIndex, QuestionMedia } from '../contracts';
import type { DraftBackend, DraftMeta, DraftQuestion } from '../storage/idb';
import { createIdbBackend } from '../storage/idb';
import { AR_COPY } from './copy';

export interface NewQuestionInput {
  text: string;
  options: [string, string, string, string];
  correctIndex: OptionIndex | null;
  media?: QuestionMedia;
  category?: string;
  difficulty?: number;
}

export type WriteResult = { ok: true } | { ok: false; storageFullMessage: string };

type GuardedResult<T> = { ok: true; value: T } | { ok: false; storageFullMessage: string };

export interface PendingDeletion {
  question: DraftQuestion;
  expiresAt: number;
}

export interface DraftState {
  questions: DraftQuestion[];
  pendingDeletion: PendingDeletion | null;
  storageFullMessage: string | null;
  meta: DraftMeta | null;
  loaded: boolean;
}

export interface DraftStoreOptions {
  backend?: DraftBackend;
  /** ~8s per the WL-C C1 prompt; overridable so tests can assert both sides
   *  of the window deterministically with fake timers. */
  undoWindowMs?: number;
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearTimer?: (handle: ReturnType<typeof setTimeout>) => void;
}

function isQuotaExceededError(err: unknown): err is DOMException {
  return err instanceof DOMException && err.name === 'QuotaExceededError';
}

let idCounter = 0;
function generateId(): string {
  idCounter += 1;
  return `q-${Date.now().toString(36)}-${idCounter.toString(36)}`;
}

const initialState: DraftState = {
  questions: [],
  pendingDeletion: null,
  storageFullMessage: null,
  meta: null,
  loaded: false,
};

export class DraftStore {
  private readonly backend: DraftBackend;
  private readonly undoWindowMs: number;
  private readonly now: () => number;
  private readonly setTimer: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  private readonly clearTimer: (handle: ReturnType<typeof setTimeout>) => void;
  private state: DraftState = initialState;
  private pendingTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly listeners = new Set<(state: DraftState) => void>();

  constructor(options: DraftStoreOptions = {}) {
    this.backend = options.backend ?? createIdbBackend();
    this.undoWindowMs = options.undoWindowMs ?? 8000;
    this.now = options.now ?? (() => Date.now());
    this.setTimer = options.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
    this.clearTimer = options.clearTimer ?? ((handle) => clearTimeout(handle));
  }

  subscribe(listener: (state: DraftState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    for (const listener of this.listeners) listener(this.state);
  }

  private setState(patch: Partial<DraftState>): void {
    this.state = { ...this.state, ...patch };
    this.emit();
  }

  getState(): DraftState {
    return this.state;
  }

  /** Populates state purely from the backend — never from anything held in
   *  memory — so a fresh `DraftStore` pointed at the same backend proves
   *  the read path is truly derived from storage (mirrors src/core/fold.ts's
   *  "state is derived" discipline, applied to the draft). */
  async load(): Promise<void> {
    const [questions, meta] = await Promise.all([
      this.backend.listQuestions(),
      this.backend.getMeta(),
    ]);
    this.setState({ questions, meta, loaded: true });
  }

  /** Drives the return-prompt: a draft exists once anything has ever been
   *  written, even if the author later deleted every question. */
  hasDraft(): boolean {
    return this.state.questions.length > 0 || this.state.meta !== null;
  }

  /** The one place a `QuotaExceededError` is caught, project-wide for this
   *  store. Every backend write — question puts, question deletes, meta
   *  touches — is issued through this method so none of them can reject
   *  unnoticed. On success it clears any stale banner; on a storage-full failure
   *  it sets the Arabic message and returns `ok:false` instead of
   *  rethrowing. Any other error still propagates — this is not a
   *  catch-all. */
  private async guardedWrite<T>(run: () => Promise<T>): Promise<GuardedResult<T>> {
    try {
      const value = await run();
      if (this.state.storageFullMessage !== null) this.setState({ storageFullMessage: null });
      return { ok: true, value };
    } catch (err) {
      if (isQuotaExceededError(err)) {
        this.setState({ storageFullMessage: AR_COPY.draftStorageFull });
        return { ok: false, storageFullMessage: AR_COPY.draftStorageFull };
      }
      throw err;
    }
  }

  private writeMetaRaw(): Promise<DraftMeta> {
    const at = this.now();
    const meta: DraftMeta = { createdAt: this.state.meta?.createdAt ?? at, updatedAt: at };
    return this.backend.putMeta(meta).then(() => meta);
  }

  async addQuestion(input: NewQuestionInput): Promise<WriteResult> {
    const order =
      this.state.questions.length === 0
        ? 0
        : Math.max(...this.state.questions.map((q) => q.order)) + 1;
    const question: DraftQuestion = {
      id: generateId(),
      text: input.text,
      options: input.options,
      correctIndex: input.correctIndex,
      media: input.media ?? { kind: 'none' },
      order,
      category: input.category,
      difficulty: input.difficulty,
    };
    const result = await this.guardedWrite(async () => {
      await this.backend.putQuestion(question);
      return this.writeMetaRaw();
    });
    if (!result.ok) return result;
    this.setState({ questions: [...this.state.questions, question], meta: result.value });
    return { ok: true };
  }

  async updateQuestion(id: string, patch: Partial<NewQuestionInput>): Promise<WriteResult> {
    const index = this.state.questions.findIndex((q) => q.id === id);
    const existing = this.state.questions[index];
    if (index === -1 || !existing) throw new Error(`unknown draft question: ${id}`);
    const updated: DraftQuestion = { ...existing, ...patch };
    const result = await this.guardedWrite(async () => {
      await this.backend.putQuestion(updated);
      return this.writeMetaRaw();
    });
    if (!result.ok) return result;
    const questions = this.state.questions.slice();
    questions[index] = updated;
    this.setState({ questions, meta: result.value });
    return { ok: true };
  }

  /** No modal — the card collapses to an undo strip for ~8s, then commits
   *  (WL-C C1 prompt, implementation rules). The optimistic removal from
   *  the visible list is immediate; only the backend commit is guarded, so
   *  a storage-full failure at commit time surfaces the banner without pretending
   *  the earlier undo-window UI never happened. */
  deleteQuestion(id: string): void {
    const index = this.state.questions.findIndex((q) => q.id === id);
    const question = this.state.questions[index];
    if (index === -1 || !question) return;
    // A second delete before the first settles would leak a pending timer
    // and silently drop the first question — commit it first.
    if (this.pendingTimer) void this.commitPendingDeletion();

    const remaining = this.state.questions.filter((q) => q.id !== id);
    const expiresAt = this.now() + this.undoWindowMs;
    this.setState({ questions: remaining, pendingDeletion: { question, expiresAt } });
    this.pendingTimer = this.setTimer(() => {
      this.pendingTimer = null;
      void this.commitPendingDeletion();
    }, this.undoWindowMs);
  }

  private async commitPendingDeletion(): Promise<void> {
    const pending = this.state.pendingDeletion;
    if (!pending) return;
    if (this.pendingTimer) {
      this.clearTimer(this.pendingTimer);
      this.pendingTimer = null;
    }
    this.setState({ pendingDeletion: null });
    const result = await this.guardedWrite(async () => {
      await this.backend.deleteQuestion(pending.question.id);
      return this.writeMetaRaw();
    });
    if (result.ok) this.setState({ meta: result.value });
  }

  /** Restores the exact question, including its media reference, to its
   *  original position — the undo strip's only action. Purely in-memory:
   *  the backend was never touched while the undo window was open, so
   *  there is nothing to write here. */
  undoDelete(): void {
    const pending = this.state.pendingDeletion;
    if (!pending) return;
    if (this.pendingTimer) {
      this.clearTimer(this.pendingTimer);
      this.pendingTimer = null;
    }
    const questions = [...this.state.questions, pending.question].sort(
      (a, b) => a.order - b.order,
    );
    this.setState({ questions, pendingDeletion: null });
  }

  /** ▲ — the primary reorder mechanism (drag is optional, never the only
   *  way). Swaps `order` with the previous question, persists both *before*
   *  reflecting the swap in state — a failed write must never show an order
   *  on screen that never made it to storage. */
  async moveUp(id: string): Promise<void> {
    const questions = this.state.questions;
    const index = questions.findIndex((q) => q.id === id);
    if (index <= 0) return;
    const current = questions[index];
    const prev = questions[index - 1];
    if (!current || !prev) return;
    const swappedCurrent: DraftQuestion = { ...current, order: prev.order };
    const swappedPrev: DraftQuestion = { ...prev, order: current.order };
    const result = await this.guardedWrite(async () => {
      await this.backend.putQuestion(swappedCurrent);
      await this.backend.putQuestion(swappedPrev);
      return this.writeMetaRaw();
    });
    if (!result.ok) return;
    const next = questions.slice();
    next[index - 1] = swappedCurrent;
    next[index] = swappedPrev;
    next.sort((x, y) => x.order - y.order);
    this.setState({ questions: next, meta: result.value });
  }

  /** ▼ — the mirror of `moveUp`. */
  async moveDown(id: string): Promise<void> {
    const questions = this.state.questions;
    const index = questions.findIndex((q) => q.id === id);
    if (index === -1 || index >= questions.length - 1) return;
    const current = questions[index];
    const nextQuestion = questions[index + 1];
    if (!current || !nextQuestion) return;
    const swappedCurrent: DraftQuestion = { ...current, order: nextQuestion.order };
    const swappedNext: DraftQuestion = { ...nextQuestion, order: current.order };
    const result = await this.guardedWrite(async () => {
      await this.backend.putQuestion(swappedCurrent);
      await this.backend.putQuestion(swappedNext);
      return this.writeMetaRaw();
    });
    if (!result.ok) return;
    const next = questions.slice();
    next[index] = swappedCurrent;
    next[index + 1] = swappedNext;
    next.sort((x, y) => x.order - y.order);
    this.setState({ questions: next, meta: result.value });
  }

  /** «ابدأ من جديد» / «احذفها» from the return-prompt — an explicit,
   *  user-initiated wipe. Never called automatically (implementation rule:
   *  never auto-discard). */
  async discardDraft(): Promise<void> {
    if (this.pendingTimer) {
      this.clearTimer(this.pendingTimer);
      this.pendingTimer = null;
    }
    await this.backend.clearAll();
    this.setState({ questions: [], pendingDeletion: null, meta: null, storageFullMessage: null });
  }
}

export function createDraftStore(options?: DraftStoreOptions): DraftStore {
  return new DraftStore(options);
}
