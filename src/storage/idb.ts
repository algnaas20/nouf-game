/**
 * src/storage/idb.ts — WL-C's IndexedDB draft store.
 *
 * This is a *different* store from `src/core/session-store.ts` (WL-A's
 * small, synchronous, `localStorage`-backed session save — خطة.md
 * "الملفات التي يلمسها أكثر من خط"). This module holds the editor's
 * authoring draft: question metadata now, and (from PH-C2 onward) media
 * blobs, together, one transaction per question. `localStorage` never
 * holds media (constraint row 14).
 *
 * Never requests the browser's persistent-storage permission and never
 * surfaces a storage-quota estimate to the user — constraint row 13.
 */

import type { OptionIndex, Question } from '../contracts';

const DB_NAME = 'nouf-editor-draft';
const DB_VERSION = 1;
const STORE_QUESTIONS = 'questions';
const STORE_META = 'meta';
const META_KEY = 'draft';

/**
 * A question mid-authoring. `correctIndex` may be unset (`null`) until the
 * author marks one option — unlike the frozen `Question` contract, where it
 * is mandatory. Only a `DraftQuestion` that passes `isQuestionReady`
 * (src/editor/validate.ts) is eligible to become a real `Question` for
 * publishing (WL-D, later phase).
 */
export interface DraftQuestion {
  id: string;
  text: string;
  options: [string, string, string, string];
  correctIndex: OptionIndex | null;
  media: Question['media'];
  /** Position in the author's list — the ▲/▼ buttons are the only way to
   *  change it (implementation rule, PH-C1 prompt). */
  order: number;
  /** Reserved, unused in v1 — D-09.3 / D-23, mirrors the frozen contract. */
  category?: string;
  /** Reserved, unused in v1 — D-09.3 / D-23, mirrors the frozen contract. */
  difficulty?: number;
}

export interface DraftMeta {
  createdAt: number;
  updatedAt: number;
}

/**
 * Every operation a caller needs from the draft store. Implemented for real
 * by `createIdbBackend()` below; tests inject a hand-written fake that
 * satisfies the same shape without touching a real IndexedDB (Node has
 * none — the real backend is proven against a real browser instead, see
 * tests/editor/live/persistence-and-quota.ts).
 */
export interface DraftBackend {
  listQuestions(): Promise<DraftQuestion[]>;
  putQuestion(question: DraftQuestion): Promise<void>;
  deleteQuestion(id: string): Promise<void>;
  getMeta(): Promise<DraftMeta | null>;
  putMeta(meta: DraftMeta): Promise<void>;
  clearAll(): Promise<void>;
}

function toStorageError(err: unknown): Error {
  if (err instanceof DOMException) return err;
  if (err instanceof Error) return err;
  return new Error(String(err));
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_QUESTIONS)) {
        db.createObjectStore(STORE_QUESTIONS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(toStorageError(request.error));
  });
}

function runRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(toStorageError(request.error));
  });
}

function runWriteTx(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(toStorageError(tx.error));
    tx.onabort = () => reject(toStorageError(tx.error));
  });
}

interface StoredMetaRecord extends DraftMeta {
  key: string;
}

/**
 * Real IndexedDB-backed implementation — one transaction per question,
 * metadata and (future) blobs together, never split across `localStorage`.
 */
export function createIdbBackend(): DraftBackend {
  let dbPromise: Promise<IDBDatabase> | null = null;
  const getDb = (): Promise<IDBDatabase> => (dbPromise ??= openDb());

  return {
    async listQuestions() {
      const db = await getDb();
      const tx = db.transaction(STORE_QUESTIONS, 'readonly');
      const all = await runRequest<DraftQuestion[]>(tx.objectStore(STORE_QUESTIONS).getAll());
      return all.slice().sort((a, b) => a.order - b.order);
    },
    async putQuestion(question) {
      const db = await getDb();
      const tx = db.transaction(STORE_QUESTIONS, 'readwrite');
      tx.objectStore(STORE_QUESTIONS).put(question);
      await runWriteTx(tx);
    },
    async deleteQuestion(id) {
      const db = await getDb();
      const tx = db.transaction(STORE_QUESTIONS, 'readwrite');
      tx.objectStore(STORE_QUESTIONS).delete(id);
      await runWriteTx(tx);
    },
    async getMeta() {
      const db = await getDb();
      const tx = db.transaction(STORE_META, 'readonly');
      const value = await runRequest<StoredMetaRecord | undefined>(
        tx.objectStore(STORE_META).get(META_KEY) as IDBRequest<StoredMetaRecord | undefined>,
      );
      return value ? { createdAt: value.createdAt, updatedAt: value.updatedAt } : null;
    },
    async putMeta(meta) {
      const db = await getDb();
      const tx = db.transaction(STORE_META, 'readwrite');
      const record: StoredMetaRecord = { key: META_KEY, ...meta };
      tx.objectStore(STORE_META).put(record);
      await runWriteTx(tx);
    },
    async clearAll() {
      const db = await getDb();
      const tx = db.transaction([STORE_QUESTIONS, STORE_META], 'readwrite');
      tx.objectStore(STORE_QUESTIONS).clear();
      tx.objectStore(STORE_META).clear();
      await runWriteTx(tx);
    },
  };
}
