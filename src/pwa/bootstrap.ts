/**
 * PH-D1 build/gate scaffold. Its only job right now is to be a real,
 * content-hashed ES module that `index.html` loads via a relative URL, so
 * the delivery gates and the sub-path rehearsal have a real module to
 * exercise (not just static HTML). It intentionally does nothing else —
 * service-worker registration and the visible version string are PH-D3
 * scope ("Out of scope: service worker / PWA, the version string" in this
 * phase's brief) and are added there, in this same file or alongside it.
 */

const root = document.getElementById('app');
if (root) {
  root.dataset.bootstrapped = 'true';
  root.textContent = 'لعبة نوف';
}
