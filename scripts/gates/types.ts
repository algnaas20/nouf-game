/**
 * Shared types for the build gates (PH-D1). Types + tiny pure helpers only —
 * no side effects here so every gate stays independently testable and
 * callable both from the Vite plugin (build-time) and from a plain script
 * (the red->green proof harness, the rehearsal script).
 */

export interface Violation {
  /** Relative, POSIX-style path (from the dist root) of the offending file. */
  file: string;
  /** Human-readable reason, includes the offending snippet where useful. */
  reason: string;
}

export interface GateOutcome {
  gate: '4a-leading-slash' | '4b-name-policy' | '4c-case-audit' | '4d-budget' | 'nojekyll';
  violations: Violation[];
  /** Free-form numbers this gate wants printed regardless of pass/fail (4d, nojekyll). */
  numbers?: Record<string, number | string | boolean>;
}

export function outcomeText(outcome: GateOutcome): string {
  const lines: string[] = [];
  lines.push(`[${outcome.gate}] violations: ${outcome.violations.length}`);
  if (outcome.numbers) {
    for (const [k, v] of Object.entries(outcome.numbers)) {
      lines.push(`[${outcome.gate}]   ${k} = ${v}`);
    }
  }
  for (const v of outcome.violations) {
    lines.push(`[${outcome.gate}]   VIOLATION ${v.file} — ${v.reason}`);
  }
  return lines.join('\n');
}
