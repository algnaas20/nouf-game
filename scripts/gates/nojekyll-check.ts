/**
 * Assert .nojekyll exists in the built listing. Two-layer defence per
 * static-delivery-investigation.md §2.5: this assertion is layer 1;
 * gate 4b (forbid "_"-prefixed emitted names) is layer 2, so the site
 * survives even if .nojekyll itself is lost in a drag-and-drop upload.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { GateOutcome, Violation } from './types.ts';

export function runNojekyllCheck(distDir: string): GateOutcome {
  const present = existsSync(join(distDir, '.nojekyll'));
  const violations: Violation[] = present
    ? []
    : [{ file: '.nojekyll', reason: 'missing from build output root' }];
  return { gate: 'nojekyll', violations, numbers: { present } };
}
