import { defineConfig } from 'vite';

// base MUST stay relative ('./'), never a hard-coded repo name — D-11, constraint row 1.
export default defineConfig({
  base: './',
});
