/**
 * One build-scoped identifier, computed once per `vite build`/`vite dev`
 * invocation (`vite.config.ts` calls this exactly once and threads the
 * result into both `define(__BUILD_ID__)` — the visible version string —
 * and the PWA plugin's generated `sw.js` cache name. Sharing one value is
 * what makes خطة.md's AC5 ("رقم النسخة ... يطابق بصمة البناء" — the version
 * number matches the build fingerprint) true by construction rather than by
 * comparing two independently-computed hashes after the fact.
 *
 * Shape: `<package.json version>-<YYYYMMDDHHmmss>-<6 random hex chars>`.
 * Lowercase-ASCII/digits/dashes only — matches the project-wide name policy
 * (gate 4b) even though this string is never itself an emitted filename;
 * kept consistent on principle, and because it is embedded verbatim inside
 * `sw.js`'s cache name, which IS subject to no filename policy but costs
 * nothing to keep clean.
 */
import { randomBytes } from 'node:crypto';

export function generateBuildId(packageVersion: string, now: Date = new Date()): string {
  const pad = (n: number, w = 2): string => String(n).padStart(w, '0');
  const stamp =
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const random = randomBytes(3).toString('hex'); // 6 lowercase hex chars
  return `${packageVersion}-${stamp}-${random}`;
}
