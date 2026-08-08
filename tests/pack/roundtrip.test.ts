/**
 * D2-7 (in-process half): author into one `DraftStore` → export → import →
 * apply into a **second, independent** `DraftStore` (a fresh fake backend —
 * standing in for "wiped storage") → compare field by field, media
 * included, by SHA-256. Proves the whole `src/pack/**` wiring
 * (`buildPackFromDraft` → `exportPack` → `importPack` →
 * `applyImportedPackToDraft`) end to end, deterministically, in Node.
 *
 * This is deliberately **not** the full claim: it does not touch a real
 * IndexedDB or prove a real "wipe browser storage" (fake backends are
 * already separate instances — there is nothing to wipe). The literal,
 * real-browser, real-wipe proof is `tests/pack/live/pack-roundtrip.ts`,
 * required as the authoritative evidence for D2-7 per the task brief
 * ("a backup that has not been restored is not a backup").
 */
import { describe, expect, it } from 'vitest';
import { DraftStore } from '../../src/editor/draft-store';
import { applyImportedPackToDraft } from '../../src/pack/apply-import';
import { exportPack } from '../../src/pack/export';
import { buildPackFromDraft } from '../../src/pack/from-draft';
import { importPack } from '../../src/pack/import';
import { sha256Hex } from '../../src/media/hash';
import { createFakeDraftBackend } from './support/fake-draft-backend';

function makeImageBlob(seed: number): Blob {
  const bytes = new Uint8Array(200);
  for (let i = 0; i < bytes.length; i += 1) bytes[i] = (seed * 17 + i * 3) & 0xff;
  return new Blob([bytes], { type: 'image/jpeg' });
}

describe('D2-7 — full pack round trip (in-process)', () => {
  it('50 questions (mixed text/image), authored → exported → imported → applied to a fresh store, match field by field and media by SHA-256', async () => {
    const authorStore = new DraftStore({ backend: createFakeDraftBackend() });
    await authorStore.load();

    const mediaBlobs = new Map<number, Blob>();
    for (let i = 1; i <= 50; i += 1) {
      const hasMedia = i % 2 === 0;
      if (hasMedia) {
        const blob = makeImageBlob(i);
        const sha256 = await sha256Hex(blob);
        mediaBlobs.set(i, blob);
        await authorStore.addQuestion({
          text: `سؤال رقم ${i}`,
          options: [`خيار أ${i}`, `خيار ب${i}`, `خيار ج${i}`, `خيار د${i}`],
          correctIndex: (i % 4) as 0 | 1 | 2 | 3,
          media: { kind: 'image', sha256, ext: 'jpg' },
          mediaBlob: blob,
        });
      } else {
        await authorStore.addQuestion({
          text: `سؤال رقم ${i}`,
          options: [`خيار أ${i}`, `خيار ب${i}`, `خيار ج${i}`, `خيار د${i}`],
          correctIndex: (i % 4) as 0 | 1 | 2 | 3,
        });
      }
    }

    const built = await buildPackFromDraft(authorStore, 'أسئلة العائلة');
    expect(built.skippedQuestionNumbers).toEqual([]);
    expect(built.manifest.questions).toHaveLength(50);
    expect(built.media.size).toBe(25); // 25 even-numbered questions carry media

    const zipBlob = await exportPack(built.manifest, built.media);
    console.log('D2-7 — exported pack size (bytes):', zipBlob.size);

    // "Wipe storage": a brand-new DraftStore over a brand-new, empty fake
    // backend — no state shared with authorStore whatsoever.
    const restoredStore = new DraftStore({ backend: createFakeDraftBackend() });
    await restoredStore.load();
    expect(restoredStore.getState().questions).toHaveLength(0);

    const imported = await importPack(zipBlob);
    expect(imported.manifest.formatVersion).toBe(built.manifest.formatVersion);
    const summary = await applyImportedPackToDraft(restoredStore, imported);
    console.log('D2-7 — applied summary:', summary);
    expect(summary.questionCount).toBe(50);
    expect(summary.mediaCount).toBe(25);

    // ---- field-by-field comparison, exactly as the task brief demands ----
    const originalOrdered = built.manifest.questions; // same order as authored
    const restoredOrdered = restoredStore.getState().questions; // DraftStore assigns fresh `order` on import, in insertion order

    expect(restoredOrdered).toHaveLength(originalOrdered.length);
    let mediaFieldsChecked = 0;
    for (let i = 0; i < originalOrdered.length; i += 1) {
      const original = originalOrdered[i]!;
      const restored = restoredOrdered[i]!;
      expect(restored.text).toBe(original.text);
      expect(restored.options).toEqual(original.options);
      expect(restored.correctIndex).toBe(original.correctIndex);
      expect(restored.media).toEqual(original.media);
      if (original.media.kind !== 'none') {
        const originalBlob = built.media.get(original.media.sha256)!;
        const restoredBlob = await restoredStore.getMediaBlob(original.media.sha256);
        expect(restoredBlob).toBeDefined();
        const [originalBytes, restoredBytes] = await Promise.all([
          originalBlob.arrayBuffer(),
          restoredBlob!.arrayBuffer(),
        ]);
        expect(new Uint8Array(restoredBytes)).toEqual(new Uint8Array(originalBytes));
        const restoredHash = await sha256Hex(restoredBlob!);
        expect(restoredHash).toBe(original.media.sha256);
        mediaFieldsChecked += 1;
      }
    }
    console.log('D2-7 — questions matched field-by-field:', originalOrdered.length);
    console.log('D2-7 — media blobs matched by SHA-256:', mediaFieldsChecked);
    expect(mediaFieldsChecked).toBe(25);

    // Independent integrity re-check via the imported pack's own verifier
    // (reads and re-hashes every media entry — the explicit, opt-in step).
    const verification = await imported.verifyAllMedia();
    console.log('D2-7 — verifyAllMedia results:', verification.length, 'entries, all ok:', verification.every((v) => v.ok));
    expect(verification).toHaveLength(25);
    expect(verification.every((v) => v.ok)).toBe(true);
  });
});
