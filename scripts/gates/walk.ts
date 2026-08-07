/** Recursive filesystem walk of a build output directory. Node fs only, no deps. */
import { readdirSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';

export interface DistEntry {
  /** Absolute path on disk. */
  absPath: string;
  /** Path relative to the dist root, POSIX separators. */
  relPath: string;
  isDirectory: boolean;
  size: number;
}

export function walkDist(distDir: string): DistEntry[] {
  const out: DistEntry[] = [];
  const stack: string[] = [distDir];
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const name of readdirSync(current)) {
      const abs = join(current, name);
      const st = statSync(abs);
      const rel = relative(distDir, abs).split('\\').join('/');
      if (st.isDirectory()) {
        out.push({ absPath: abs, relPath: rel, isDirectory: true, size: 0 });
        stack.push(abs);
      } else {
        out.push({ absPath: abs, relPath: rel, isDirectory: false, size: st.size });
      }
    }
  }
  return out;
}

export function textFilesOf(entries: DistEntry[]): DistEntry[] {
  return entries.filter(
    (e) => !e.isDirectory && ['.html', '.css', '.js', '.mjs'].includes(extname(e.relPath)),
  );
}
