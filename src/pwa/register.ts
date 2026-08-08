/**
 * Registers the generated service worker — relative path, exactly as
 * static-delivery-investigation.md §5.3 requires: "Register as
 * `navigator.serviceWorker.register('./sw.js')`. A leading slash gives a
 * root scope the site does not own and 404s on a project site."
 *
 * Skips registration entirely under `vite dev` (`import.meta.env.DEV`):
 * `sw.js` is generated only by the production build
 * (`scripts/vite-plugin-pwa.ts`, `apply: 'build'`) and does not exist on
 * the dev server — attempting to register it there would just 404 on every
 * page load for no benefit.
 */

export function registerServiceWorker(): void {
  if (import.meta.env.DEV) return;
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err: unknown) => {
      // A failed registration must never break the page — the app already
      // works perfectly well online with no service worker at all; offline
      // support is a bonus, not a dependency (D-18: "at zero extra user
      // steps", never "at the cost of breaking the online case").
      // eslint-disable-next-line no-console
      console.error('service worker registration failed:', err);
    });
  });
}

registerServiceWorker();
