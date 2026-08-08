/**
 * PH-C2 AC5 — "every emitted media filename matches
 * `^[a-z0-9-]+\.[a-z0-9]+$` (first 12 hex of SHA-256) — 0 violations on 50
 * files." Pure logic, no browser needed: `crypto.subtle` is a Web Crypto
 * API available in Node directly (verified: `node --version` → v24, global
 * `crypto.subtle` present).
 */
import { describe, expect, it } from 'vitest';
import { contentAddressedFilename, hashAndName, isValidMediaFilename, sha256Hex } from '../../src/media/hash';
import { MEDIA_FILENAME_PATTERN } from '../../src/media/limits';

describe('sha256Hex + contentAddressedFilename (PH-C2 AC5)', () => {
  it('produces the well-known SHA-256("abc") digest — a literal hand-written expected value from an independent oracle (Node\'s built-in `crypto.createHash`, a different code path from `crypto.subtle` used by the implementation), not derived from the code under test', async () => {
    // Cross-checked independently: `node -e "require('crypto').createHash('sha256').update('abc').digest('hex')"`
    // → ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad
    // (also the standard NIST FIPS 180-4 test vector for "abc").
    const expectedHex = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
    const bytes = new TextEncoder().encode('abc');
    const hex = await sha256Hex(bytes.buffer);
    console.log('sha256Hex("abc") =', hex);
    expect(hex).toBe(expectedHex);
    expect(hex).toHaveLength(64);
  });

  it('50 distinct files → 50 filenames, all matching the pattern, 0 violations', async () => {
    const names: string[] = [];
    for (let i = 0; i < 50; i += 1) {
      const bytes = new TextEncoder().encode(`media-file-number-${i}`);
      const ext = i % 2 === 0 ? 'jpg' : 'mp3';
      const { filename } = await hashAndName(new Blob([bytes]), ext);
      names.push(filename);
    }
    const violations = names.filter((n) => !MEDIA_FILENAME_PATTERN.test(n));
    console.log('AC5 — filenames checked:', names.length, '— violations:', violations.length);
    expect(names).toHaveLength(50);
    expect(violations).toHaveLength(0);
    // Content-addressed: identical content ⇒ identical name (dedup for free).
    const unique = new Set(names);
    expect(unique.size).toBe(50); // all 50 inputs were distinct here
  });

  it('rejects an uppercase or underscore-prefixed name (guard behaviour, not just the happy path)', () => {
    expect(isValidMediaFilename('3f9a1c8b2d40.jpg')).toBe(true);
    expect(isValidMediaFilename('3F9A1C8B2D40.jpg')).toBe(false);
    expect(isValidMediaFilename('_3f9a1c8b2d40.jpg')).toBe(false);
    expect(isValidMediaFilename('3f9a1c8b2d40.JPG')).toBe(false);
    expect(isValidMediaFilename('my photo.jpg')).toBe(false);
  });

  it('contentAddressedFilename takes exactly the first 12 hex chars', () => {
    const full = 'a'.repeat(64);
    expect(contentAddressedFilename(full, 'jpg')).toBe('aaaaaaaaaaaa.jpg');
  });
});
