/**
 * The draft-storage-full banner, shown when a write is rejected by the
 * browser because there is no room left (the DOM exception the browser
 * throws for this is named `QuotaExceededError` — every draft write is
 * wrapped so it can never be silently skipped, constraint row 13, AC2). The
 * save button lives *inside* the message, per the exact wording required by
 * the C1 prompt.
 *
 * The save-to-device mechanics are WL-D/PH-D2's ZIP export — out of scope
 * here. `onSaveBackup` is the integration boundary this phase defines: a
 * caller (mountEditor's consumer, later PH-D2 wiring) supplies the real
 * handler; until then the button exists, is visible and clickable, and
 * simply has nothing to call.
 */

import { AR_COPY } from '../copy';

export interface StorageFullBannerOptions {
  onSaveBackup?: () => void;
}

export function renderStorageFullBanner(options: StorageFullBannerOptions = {}): HTMLElement {
  const banner = document.createElement('div');
  banner.className = 'storage-full-banner';
  banner.setAttribute('role', 'alert');
  banner.dir = 'rtl';
  banner.hidden = true;

  const message = document.createElement('span');
  message.className = 'storage-full-banner-message';
  message.textContent = AR_COPY.draftStorageFull;

  const saveButton = document.createElement('button');
  saveButton.type = 'button';
  saveButton.className = 'storage-full-banner-save-button';
  saveButton.textContent = AR_COPY.saveBackupButton;
  saveButton.addEventListener('click', () => options.onSaveBackup?.());

  banner.append(message, saveButton);
  return banner;
}

export function setStorageFullBannerVisible(banner: HTMLElement, visible: boolean): void {
  banner.hidden = !visible;
}
