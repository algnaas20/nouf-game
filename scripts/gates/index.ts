/**
 * Runs every PH-D1 build gate against a build output directory and returns
 * the aggregated result. Used both by the Vite plugin (fails the build) and
 * by standalone scripts (the red->green proof harness, the rehearsal script).
 * This is the single source of truth — nothing re-implements gate logic
 * anywhere else in the project.
 */
import type { GateOutcome } from './types.ts';
import { outcomeText } from './types.ts';
import { runLeadingSlashScan } from './leading-slash-scan.ts';
import { runNamePolicy } from './name-policy.ts';
import { runCaseAudit } from './case-audit.ts';
import { runBudgetAudit } from './budget-audit.ts';
import { runNojekyllCheck } from './nojekyll-check.ts';

export interface AllGatesResult {
  outcomes: GateOutcome[];
  totalViolations: number;
  text: string;
}

export function runAllGates(distDir: string): AllGatesResult {
  const outcomes: GateOutcome[] = [
    runLeadingSlashScan(distDir),
    runNamePolicy(distDir),
    runCaseAudit(distDir),
    runBudgetAudit(distDir),
    runNojekyllCheck(distDir),
  ];
  const totalViolations = outcomes.reduce((sum, o) => sum + o.violations.length, 0);
  const text = outcomes.map(outcomeText).join('\n');
  return { outcomes, totalViolations, text };
}

export {
  runLeadingSlashScan,
  runNamePolicy,
  runCaseAudit,
  runBudgetAudit,
  runNojekyllCheck,
};
export type { GateOutcome, Violation } from './types.ts';
