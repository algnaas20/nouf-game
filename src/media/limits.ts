/**
 * Numeric ceilings for media intake — every number here is copied from
 * `media-storage-investigation.md` v5, §5.2 and §4, not invented:
 *
 *   - Image per-file ceiling: 400 KB (§5.2 — "1600×900 JPEG q0.80 lands at
 *     150–300 KB; 400 KB is ~1.5× headroom").
 *   - Audio per-file ceiling: 2 MB (§5.2 — "0.96 MB/min at 128 kbps → 2 MB
 *     ≈ 2 minutes, twice any plausible quiz clip"). This is also the exact
 *     threshold that separates an accepted small WAV from a rejected large
 *     one (§5.1's ruling: "warn loudly on WAV over ~2 MB").
 *   - Image target long edge: 1600 px (§4 — "already exceeds perceptual
 *     need" for a 1080p shared screen read from metres away).
 *   - JPEG re-encode quality: 0.80 (§4's canonical
 *     `canvas.toBlob('image/jpeg', 0.80)` formula).
 */

export const IMAGE_MAX_BYTES = 400 * 1024;
export const AUDIO_MAX_BYTES = 2 * 1024 * 1024;
export const IMAGE_TARGET_LONG_EDGE_PX = 1600;
export const IMAGE_JPEG_QUALITY = 0.8;

/** §6 — "All published media filenames must match `^[a-z0-9-]+\.[a-z0-9]+$`."
 *  Also enforced by WL-D's build gate 4b on the emitted site; this is the
 *  same shape enforced at intake time, before anything is ever exported. */
export const MEDIA_FILENAME_PATTERN = /^[a-z0-9-]+\.[a-z0-9]+$/;

/** §6 — "the first 12 hex characters of the media's SHA-256". */
export const SHA256_PREFIX_LENGTH = 12;
