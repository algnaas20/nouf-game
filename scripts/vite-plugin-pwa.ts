/**
 * Generates `dist/sw.js` at build time — placed in `closeBundle`, running
 * BEFORE the delivery-gates plugin in `vite.config.ts`'s plugin array (so
 * gate 4a/4b/4c/4d also scan the generated service worker, not just the
 * hand-written source). `apply: 'build'` — never runs under `vite dev`
 * (there is no `dist/` to write into, and `src/pwa/register.ts` itself
 * skips registration in dev — see that file's own comment).
 */
import type { Plugin, ResolvedConfig } from 'vite';
import { resolve } from 'node:path';
import { writeFileSync } from 'node:fs';
import { walkDist } from './gates/walk.ts';
import { generateServiceWorkerSource } from './pwa/generate-sw.ts';

export interface PwaPluginOptions {
  buildId: string;
}

/** `index.html` is handled network-first inside the generated worker
 *  itself (never precached with a hashed name — it has none); `sw.js` and
 *  `.nojekyll` are never meaningfully fetchable/cacheable content. */
const EXCLUDED_FROM_PRECACHE = new Set(['index.html', 'sw.js', '.nojekyll']);

export function pwaPlugin(options: PwaPluginOptions): Plugin {
  let config: ResolvedConfig;
  return {
    name: 'nouf-game:pwa',
    apply: 'build',
    configResolved(resolved) {
      config = resolved;
    },
    closeBundle() {
      const distDir = resolve(config.root, config.build.outDir);
      const entries = walkDist(distDir).filter((e) => !e.isDirectory && !EXCLUDED_FROM_PRECACHE.has(e.relPath));
      const precacheUrls = entries.map((e) => `./${e.relPath}`);

      const source = generateServiceWorkerSource({ buildId: options.buildId, precacheUrls });
      writeFileSync(resolve(distDir, 'sw.js'), source, 'utf-8');
      console.log(`\n--- PH-D3 service worker ---`);
      console.log(`cache name: nouf-shell-${options.buildId}`);
      console.log(`precached files: ${precacheUrls.length}`);
      console.log(`--- end service worker ---\n`);
    },
  };
}
