import { defineConfig } from 'vite';
import { deliveryGatesPlugin } from './scripts/vite-plugin-gates.ts';

// base MUST stay relative ('./'), never a hard-coded repo name — D-11, constraint row 1.
// No client-side router: history routing needs a 404.html hack on Pages (rejected in
// static-delivery-investigation.md §2.3); this project never adds one.
export default defineConfig({
  base: './',
  plugins: [deliveryGatesPlugin()],
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
