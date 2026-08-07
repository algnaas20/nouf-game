/**
 * Vite plugin wiring the PH-D1 delivery gates into `npm run build` itself,
 * so a violation fails the build — not a review habit. Runs in `closeBundle`,
 * after every file has been written to the output directory.
 */
import type { Plugin, ResolvedConfig } from 'vite';
import { resolve } from 'node:path';
import { runAllGates } from './gates/index.ts';

export function deliveryGatesPlugin(): Plugin {
  let config: ResolvedConfig;
  return {
    name: 'nouf-game:delivery-gates',
    apply: 'build',
    configResolved(resolved) {
      config = resolved;
    },
    closeBundle() {
      const distDir = resolve(config.root, config.build.outDir);
      const result = runAllGates(distDir);
      // Always print — acceptance criteria require the numbers even when green.
      console.log('\n--- PH-D1 delivery gates ---');
      console.log(result.text);
      console.log(`--- total violations: ${result.totalViolations} ---\n`);
      if (result.totalViolations > 0) {
        throw new Error(
          `Delivery gates failed with ${result.totalViolations} violation(s). See output above.`,
        );
      }
    },
  };
}
