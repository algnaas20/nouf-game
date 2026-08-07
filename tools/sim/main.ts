/**
 * Standalone entry point for the simulation harness.
 * Run: `npx vite-node tools/sim/main.ts`
 */

import { runSimulation, printReport } from './run';

const report = runSimulation();
printReport(report);
