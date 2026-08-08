/**
 * D2-6: backup filename shape + "lexicographic order = chronological order"
 * (V25) — five generated names, sort compared against creation order.
 */
import { describe, expect, it } from 'vitest';
import { BACKUP_FILENAME_PATTERN, generateBackupFilename } from '../../src/pack/filename';

describe('generateBackupFilename', () => {
  it('matches the project-wide lowercase-ASCII filename policy', () => {
    const name = generateBackupFilename(new Date(2026, 7, 8, 14, 5, 9)); // 2026-08-08 14:05:09
    console.log('generated filename:', name);
    expect(name).toMatch(BACKUP_FILENAME_PATTERN);
    expect(name).toBe('nouf-20260808-140509.zip');
  });

  it('D2-6: five names generated across real (increasing) timestamps sort lexicographically in the same order they were created', () => {
    const dates = [
      new Date(2026, 0, 1, 0, 0, 0),
      new Date(2026, 0, 1, 0, 0, 1),
      new Date(2026, 0, 1, 23, 59, 59),
      new Date(2026, 0, 2, 0, 0, 0),
      new Date(2027, 11, 31, 23, 59, 59),
    ];
    const names = dates.map(generateBackupFilename);
    console.log('D2-6 — generated in creation order:', names);

    const sorted = [...names].sort();
    console.log('D2-6 — lexicographically sorted:', sorted);
    expect(sorted).toEqual(names);
  });

  it('every generated name matches the pattern, across a year boundary and midnight', () => {
    for (const d of [new Date(2026, 11, 31, 23, 59, 59), new Date(2026, 0, 1, 0, 0, 0)]) {
      expect(generateBackupFilename(d)).toMatch(BACKUP_FILENAME_PATTERN);
    }
  });
});
