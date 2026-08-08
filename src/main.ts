import './styles/tokens.css';
import './styles/stage.css';
import './styles/console.css';
import { mountApp } from './stage/app';

// Defensive fallback only — the authoritative `<html lang="ar" dir="rtl">`
// belongs in WL-D's index.html markup (S3: "never use CSS to apply the
// base direction"; setting it here on load is a safety net, not the
// source of truth, and never done via CSS).
if (document.documentElement.dir !== 'rtl') document.documentElement.dir = 'rtl';
if (!document.documentElement.lang) document.documentElement.lang = 'ar';

const root = document.getElementById('app');
if (root) {
  mountApp(root);
} else {
  // eslint-disable-next-line no-console
  console.error('#app root element missing — WL-D index.html must provide <div id="app">.');
}
