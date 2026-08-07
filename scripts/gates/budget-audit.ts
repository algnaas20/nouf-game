/**
 * Gate 4d — budget audit. Always prints file count, largest file, total
 * on-disk size (spec requirement: "always print all three numbers"),
 * and fails if file count > 100 or the largest single file > 20 MB.
 */
import type { GateOutcome, Violation } from './types.ts';
import { walkDist } from './walk.ts';

export const MAX_FILES = 100;
export const MAX_LARGEST_BYTES = 20 * 1024 * 1024;

export function runBudgetAudit(distDir: string): GateOutcome {
  const entries = walkDist(distDir).filter((e) => !e.isDirectory);
  const fileCount = entries.length;
  const totalBytes = entries.reduce((sum, e) => sum + e.size, 0);
  let largest = entries[0] ?? { relPath: '(none)', size: 0 };
  for (const e of entries) if (e.size > largest.size) largest = e;

  const violations: Violation[] = [];
  if (fileCount > MAX_FILES) {
    violations.push({ file: '(dist)', reason: `${fileCount} files emitted, budget is <= ${MAX_FILES}` });
  }
  if (largest.size > MAX_LARGEST_BYTES) {
    violations.push({
      file: largest.relPath,
      reason: `${largest.size} bytes, budget is <= ${MAX_LARGEST_BYTES} bytes (20 MB)`,
    });
  }

  return {
    gate: '4d-budget',
    violations,
    numbers: {
      fileCount,
      largestFile: largest.relPath,
      largestFileBytes: largest.size,
      totalOnDiskBytes: totalBytes,
    },
  };
}
