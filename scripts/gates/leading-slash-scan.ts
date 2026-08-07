/**
 * Gate 4a — leading-slash scan.
 * Every emitted .html/.css/.js file, scanned for URL forms that resolve to
 * the wrong host when served from a sub-path (`https://<owner>.github.io/nouf-game/`)
 * instead of the root. `base: './'` makes the bundler emit only relative
 * forms *if the source never wrote an absolute one* — this gate is what
 * turns that "if" into a build failure. See static-delivery-investigation.md §2.4.
 */
import { readFileSync } from 'node:fs';
import type { GateOutcome, Violation } from './types.ts';
import { textFilesOf, walkDist, type DistEntry } from './walk.ts';

interface Rule {
  name: string;
  /** Regex must be global; capture index 0 is reported verbatim (trimmed). */
  re: RegExp;
}

// Each rule matches the *start* of a URL/import target, right after the
// opening quote/paren, so "./assets/x.js" (a dot, not a slash) never matches.
const RULES: Rule[] = [
  { name: 'src="/', re: /\b(?:src|href)\s*=\s*(["'])\/(?!\/)/g },
  { name: 'url(/', re: /\burl\(\s*(["']?)\/(?!\/)/g },
  { name: 'from "/', re: /\bfrom\s*(["'])\/(?!\/)/g },
  { name: 'import("/', re: /\bimport\(\s*(["'])\/(?!\/)/g },
  { name: 'fetch("/', re: /\bfetch\(\s*(["'])\/(?!\/)/g },
  { name: 'register("/', re: /\bregister\(\s*(["'])\/(?!\/)/g },
  // Protocol-relative "//host/..." — a quote/paren directly followed by two
  // slashes then a non-slash char. Deliberately does NOT match "https://..."
  // (the character right after the quote there is 'h', not '/').
  { name: 'protocol-relative //', re: /(["'(])\/\/[^/]/g },
];

function lineAndColOf(text: string, index: number): { line: number; col: number } {
  const upTo = text.slice(0, index);
  const line = upTo.split('\n').length;
  const col = index - upTo.lastIndexOf('\n');
  return { line, col };
}

export function runLeadingSlashScan(distDir: string): GateOutcome {
  const entries = textFilesOf(walkDist(distDir));
  const violations: Violation[] = [];

  for (const entry of entries) {
    const text = readFileSync(entry.absPath, 'utf8');
    for (const rule of RULES) {
      rule.re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = rule.re.exec(text)) !== null) {
        const { line, col } = lineAndColOf(text, m.index);
        const snippet = text.slice(m.index, m.index + 40).replace(/\s+/g, ' ');
        violations.push({
          file: entry.relPath,
          reason: `pattern "${rule.name}" at ${line}:${col} — "${snippet}"`,
        });
        // Guard against zero-width infinite loop for safety.
        if (m.index === rule.re.lastIndex) rule.re.lastIndex++;
      }
    }
  }

  return { gate: '4a-leading-slash', violations, numbers: { filesScanned: entries.length } };
}

export function _entriesScannedFor4a(distDir: string): DistEntry[] {
  return textFilesOf(walkDist(distDir));
}
