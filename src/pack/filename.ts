/**
 * Backup/export filenames — must match `^[a-z0-9._-]+$` (project-wide rule,
 * §6 of media-storage-investigation.md) **and** sort lexicographically in
 * the same order they were created (خطة.md PH-D2 AC6 / V25), so a folder of
 * saved backups on the host's computer already lists oldest-to-newest with
 * no extra work on his part.
 *
 * Fixed-width, zero-padded, most-significant-first numeric fields achieve
 * both at once: `nouf-YYYYMMDD-HHMMSS.zip`.
 */

function pad(value: number, width = 2): string {
  return String(value).padStart(width, '0');
}

export function generateBackupFilename(date: Date): string {
  const year = pad(date.getFullYear(), 4);
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  return `nouf-${year}${month}${day}-${hours}${minutes}${seconds}.zip`;
}

/** The same shape rule the build gates already enforce on emitted site
 *  files (`scripts/gates/name-policy.ts`, gate 4b) — reused here so backup
 *  filenames are provably the same policy, not a second invented one. */
export const BACKUP_FILENAME_PATTERN = /^[a-z0-9._-]+$/;
