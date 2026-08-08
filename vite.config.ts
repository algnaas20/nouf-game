import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { deliveryGatesPlugin } from './scripts/vite-plugin-gates.ts';
import { pwaPlugin } from './scripts/vite-plugin-pwa.ts';
import { generateBuildId } from './scripts/pwa/build-id.ts';

// One build-scoped identifier, computed exactly once per `vite build`/
// `vite dev` invocation — threaded into BOTH `define(__BUILD_ID__)` (the
// visible version string, src/pwa/version.ts) and the PWA plugin's
// generated sw.js cache name (scripts/vite-plugin-pwa.ts), so PH-D3 AC5
// ("the version number matches the build fingerprint") is true by
// construction, not by comparing two independently-computed values later.
const packageJson = JSON.parse(
  readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf-8'),
) as { version: string };
const buildId = generateBuildId(packageJson.version);

// base MUST stay relative ('./'), never a hard-coded repo name — D-11, constraint row 1.
// No client-side router: history routing needs a 404.html hack on Pages (rejected in
// static-delivery-investigation.md §2.3); this project never adds one.
export default defineConfig({
  base: './',
  define: {
    __BUILD_ID__: JSON.stringify(buildId),
  },
  // PH-D3 plugin runs BEFORE the delivery gates in closeBundle (Rollup's
  // closeBundle hook is sequential, in plugin-array order) — the generated
  // sw.js must exist in dist/ before gates 4a/4b/4c/4d scan it.
  plugins: [pwaPlugin({ buildId }), deliveryGatesPlugin()],
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        // Default hash alphabet includes uppercase letters (base64), which
        // gate 4b rejects — a real bug the gate caught on this project's
        // first build. base36 is lowercase alphanumeric only.
        hashCharacters: 'base36',
      },
    },
  },
});
