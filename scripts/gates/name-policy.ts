/**
 * Gate 4b — name policy. Every emitted file and folder name must match
 * ^[a-z0-9._-]+$ and none may start with "_" (Jekyll silently drops
 * underscore-prefixed paths; see static-delivery-investigation.md §2.5).
 * Media filenames additionally must be content-addressed
 * (^[a-z0-9-]+\.[a-z0-9]+$) but that class does not exist yet in this
 * phase's output — WL-C enforces it when media starts shipping.
 */
import { basename } from 'node:path';
import type { GateOutcome, Violation } from './types.ts';
import { walkDist } from './walk.ts';

const NAME_RE = /^[a-z0-9._-]+$/;

export function runNamePolicy(distDir: string): GateOutcome {
  const entries = walkDist(distDir);
  const violations: Violation[] = [];

  for (const entry of entries) {
    const name = basename(entry.relPath);
    if (name.startsWith('_')) {
      violations.push({ file: entry.relPath, reason: `name "${name}" starts with "_"` });
      continue;
    }
    if (!NAME_RE.test(name)) {
      violations.push({
        file: entry.relPath,
        reason: `name "${name}" does not match ^[a-z0-9._-]+$`,
      });
    }
  }

  return { gate: '4b-name-policy', violations, numbers: { entriesChecked: entries.length } };
}
