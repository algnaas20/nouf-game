/**
 * The visible version string (خطة.md PH-D3 AC5 — "رقم النسخة ظاهر على شاشة
 * البداية ويطابق بصمة البناء"). `__BUILD_ID__` is injected by
 * `vite.config.ts`'s `define()` from the exact same value threaded into
 * the generated `sw.js`'s cache name (`scripts/vite-plugin-pwa.ts`) — one
 * build-scoped identifier, so "matches the build fingerprint" is true by
 * construction. Mounted as a small, fixed-position element independent of
 * `src/stage/**`'s own DOM tree (WL-B-owned) — see this file's own header
 * comment in `index.html` for why.
 *
 * Also mounts the publish-recipe button/overlay (`src/pack/ui/publish-recipe.ts`)
 * right next to the version string — both are "home screen extras" no
 * current entry point wires in yet (the same integration gap recorded for
 * the editor in worklog-D2.md design decision 6); this file is a
 * self-contained overlay layer that works regardless of when/whether that
 * gap is closed.
 */

declare const __BUILD_ID__: string;

import { mountPublishRecipeButton } from '../pack/ui/publish-recipe';

export function mountVersionBadge(root: HTMLElement = document.body): void {
  const container = document.createElement('div');
  container.id = 'app-version-container';
  container.dir = 'ltr'; // build ids are Latin/digits — LTR isolation, same rule as media timestamps
  Object.assign(container.style, {
    position: 'fixed',
    insetBlockEnd: '8px',
    insetInlineEnd: '8px',
    zIndex: '9999',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontFamily: 'monospace',
    fontSize: '12px',
    color: '#8b93a1',
    background: 'rgba(14,17,22,0.6)',
    padding: '4px 8px',
    borderRadius: '6px',
    pointerEvents: 'none',
  } satisfies Partial<CSSStyleDeclaration>);

  const versionText = document.createElement('span');
  versionText.id = 'app-version';
  versionText.textContent = `v${__BUILD_ID__}`;
  versionText.style.pointerEvents = 'none';
  container.append(versionText);

  const recipeSlot = document.createElement('span');
  recipeSlot.style.pointerEvents = 'auto';
  recipeSlot.dir = 'rtl';
  mountPublishRecipeButton(recipeSlot);
  container.append(recipeSlot);

  root.append(container);
}

mountVersionBadge();
