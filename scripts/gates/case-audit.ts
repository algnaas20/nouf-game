/**
 * Gate 4c — case audit. The only check in this project that catches
 * case-sensitivity bugs on Windows (NTFS + git core.ignorecase both hide
 * them locally; GitHub Pages is case-sensitive). Static, byte-exact,
 * referenced-vs-real comparison — never a runtime/browser check.
 * See static-delivery-investigation.md §3.
 */
import { readFileSync } from 'node:fs';
import { dirname, extname, posix as posixPath } from 'node:path';
import type { GateOutcome, Violation } from './types.ts';
import { textFilesOf, walkDist } from './walk.ts';

const ASSET_EXT = new Set([
  'js',
  'mjs',
  'css',
  'html',
  'json',
  'png',
  'jpg',
  'jpeg',
  'webp',
  'gif',
  'svg',
  'ico',
  'woff2',
  'woff',
  'ttf',
  'mp3',
  'm4a',
  'wav',
  'mp4',
  'webmanifest',
  'txt',
  'xml',
]);

const DISALLOWED_PREFIXES = ['http://', 'https://', '//', 'data:', 'mailto:', 'tel:', 'javascript:', 'blob:', '#'];

/** Extract candidate relative-path references from one text file's content. */
function extractReferences(text: string): string[] {
  const found = new Set<string>();

  // Quoted string literals (single, double, backtick), non-greedy, no escape handling
  // needed for our own emitted/scaffold sources (no embedded quotes in paths).
  const quoteRe = /(["'`])((?:(?!\1)[^\n\\]|\\.)*)\1/g;
  let m: RegExpExecArray | null;
  while ((m = quoteRe.exec(text)) !== null) {
    found.add(m[2]!);
  }

  // CSS url(...) without quotes.
  const urlRe = /url\(\s*([^)'"]+?)\s*\)/g;
  while ((m = urlRe.exec(text)) !== null) {
    found.add(m[1]!.trim());
  }

  const candidates: string[] = [];
  for (const raw of found) {
    if (raw.length === 0) continue;
    if (DISALLOWED_PREFIXES.some((p) => raw.startsWith(p))) continue;
    if (/\s/.test(raw)) continue;
    if (raw.includes('${')) continue;
    const withoutQuery = raw.split(/[?#]/)[0]!;
    if (withoutQuery.length === 0) continue;
    const ext = extname(withoutQuery).slice(1).toLowerCase();
    if (!ASSET_EXT.has(ext)) continue;
    const looksRelative = withoutQuery.includes('/') || withoutQuery.startsWith('.');
    if (!looksRelative) continue;
    if (withoutQuery.startsWith('/')) continue; // gate 4a's job
    candidates.push(withoutQuery);
  }
  return candidates;
}

export function runCaseAudit(distDir: string): GateOutcome {
  const allEntries = walkDist(distDir);
  const realFiles = new Set(allEntries.filter((e) => !e.isDirectory).map((e) => e.relPath));
  const realFilesLower = new Map<string, string>();
  for (const p of realFiles) realFilesLower.set(p.toLowerCase(), p);

  const textEntries = textFilesOf(allEntries);
  const violations: Violation[] = [];
  let referencesChecked = 0;

  for (const entry of textEntries) {
    const text = readFileSync(entry.absPath, 'utf8');
    const refs = extractReferences(text);
    const refDir = dirname(entry.relPath);

    for (const ref of refs) {
      const resolved = posixPath.normalize(posixPath.join(refDir === '.' ? '' : refDir, ref));
      const clean = resolved.startsWith('/') ? resolved.slice(1) : resolved;
      referencesChecked++;

      if (realFiles.has(clean)) continue; // byte-exact match — fine

      const lowerHit = realFilesLower.get(clean.toLowerCase());
      if (lowerHit) {
        violations.push({
          file: entry.relPath,
          reason: `reference "${ref}" resolves to "${clean}" which exists only as "${lowerHit}" (case mismatch)`,
        });
      } else {
        violations.push({
          file: entry.relPath,
          reason: `reference "${ref}" resolves to "${clean}" — no file on disk at all (any case)`,
        });
      }
    }
  }

  return {
    gate: '4c-case-audit',
    violations,
    numbers: { referencesChecked, realFilesOnDisk: realFiles.size },
  };
}
