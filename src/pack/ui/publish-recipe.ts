/**
 * "وصفة النشر داخل التطبيق" — خطة.md PH-D3 AC7: at most 3 steps, in
 * Arabic, never mentioning a branch, a path, or a cache header, ending in a
 * verification step the host performs himself (the literal Appendix-أ
 * sentence). Self-contained DOM + inline styles only — this file lives in
 * `src/pack/**` (WL-D-owned) and deliberately never imports `src/styles/**`
 * (WL-B-owned tokens) or any `src/stage/**`/`src/editor/**` component, so it
 * has zero dependency on where in the app it eventually gets mounted.
 *
 * Exactly 3 steps: `publishRecipeStep1` (one-time repository/Pages setup —
 * a real prerequisite this phase does not build, stated honestly in
 * worklog-D3.md rather than assumed away), `publishRecipeStep2` (export →
 * extract → drag into the upload page), and the literal
 * `openLinkVerification` sentence as step 3.
 */

import { AR_PACK_COPY } from '../copy';

export function renderPublishRecipe(): { overlay: HTMLElement; open: () => void; close: () => void } {
  const overlay = document.createElement('div');
  overlay.className = 'publish-recipe-overlay';
  overlay.dir = 'rtl';
  overlay.lang = 'ar';
  overlay.hidden = true;
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  // `display` is deliberately NOT set here as a static inline style: an
  // inline `style.display` would out-rank the `[hidden] { display: none }`
  // user-agent rule the `hidden` property relies on, making the overlay
  // permanently visible regardless of `.hidden` — a real bug this exact
  // mistake caused, caught by scripts/pwa/verify-pwa.ts's own screenshots
  // (see worklog-D3.md). `open()`/`close()` below set `display` explicitly
  // instead, and are the ONLY code that ever touches it.
  Object.assign(overlay.style, {
    position: 'fixed',
    inset: '0',
    background: 'rgba(0, 0, 0, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: '10000',
    fontFamily: 'sans-serif',
  } satisfies Partial<CSSStyleDeclaration>);

  const card = document.createElement('div');
  Object.assign(card.style, {
    background: '#161b22',
    color: '#f2f4f7',
    borderRadius: '12px',
    padding: '32px',
    maxWidth: '560px',
    width: '90%',
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
  } satisfies Partial<CSSStyleDeclaration>);

  const title = document.createElement('h2');
  title.textContent = AR_PACK_COPY.publishRecipeTitle;
  title.style.marginTop = '0';
  card.append(title);

  const steps = [AR_PACK_COPY.publishRecipeStep1, AR_PACK_COPY.publishRecipeStep2, AR_PACK_COPY.openLinkVerification];
  const list = document.createElement('ol');
  list.className = 'publish-recipe-steps';
  for (const step of steps) {
    const item = document.createElement('li');
    item.textContent = step;
    item.style.marginBottom = '12px';
    item.style.lineHeight = '1.6';
    list.append(item);
  }
  card.append(list);

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'publish-recipe-close';
  closeButton.textContent = AR_PACK_COPY.closePublishRecipeButton;
  Object.assign(closeButton.style, {
    marginTop: '16px',
    padding: '10px 24px',
    borderRadius: '8px',
    border: 'none',
    background: '#0072b2',
    color: '#fff',
    cursor: 'pointer',
  } satisfies Partial<CSSStyleDeclaration>);
  card.append(closeButton);

  overlay.append(card);

  function open(): void {
    overlay.hidden = false;
    overlay.style.display = 'flex';
  }
  function close(): void {
    overlay.hidden = true;
    overlay.style.display = 'none';
  }
  close(); // establish the initial (closed) visual state explicitly, not just via `hidden`
  closeButton.addEventListener('click', close);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) close();
  });

  return { overlay, open, close };
}

/** Convenience: builds the recipe overlay AND a trigger button, appends
 *  both to `container`, and wires the click. Used by `src/pwa/version.ts`. */
export function mountPublishRecipeButton(container: HTMLElement): void {
  const { overlay, open } = renderPublishRecipe();
  const button = document.createElement('button');
  button.type = 'button';
  button.id = 'open-publish-recipe';
  button.textContent = AR_PACK_COPY.openPublishRecipeButton;
  button.addEventListener('click', open);
  container.append(button, overlay);
}
