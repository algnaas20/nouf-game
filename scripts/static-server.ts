/**
 * A plain static file server — no SPA fallback, no dev server, no HMR.
 * Deliberately dumb: it resolves whatever path the URL asks for against the
 * filesystem and 404s otherwise. This is what proves the built artefact is
 * self-sufficient with genuinely relative paths; it does the opposite of
 * "helping" a broken reference resolve.
 *
 * Windows/NTFS note: this server IS case-insensitive on this filesystem,
 * exactly as static-delivery-investigation.md §3.2 warns. It is used only
 * for the request/response rehearsal (0 failed requests etc). Case
 * correctness itself is proven separately and only by gate 4c
 * (scripts/gates/case-audit.ts), a static filesystem check — never by this
 * server returning 200.
 */
import { createServer, type Server } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8',
};

export async function startStaticServer(rootDir: string, port: number): Promise<Server> {
  const server = createServer((req, res) => {
    void (async () => {
      try {
        const url = new URL(req.url ?? '/', 'http://localhost');
        let pathname = decodeURIComponent(url.pathname);
        if (pathname.endsWith('/')) pathname += 'index.html';
        // No SPA fallback: any unresolved segment is a genuine 404, not
        // rewritten to index.html.
        const filePath = join(rootDir, pathname);
        if (!filePath.startsWith(rootDir)) {
          res.writeHead(403);
          res.end('Forbidden');
          return;
        }
        const st = await stat(filePath).catch(() => null);
        if (!st || !st.isFile()) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('Not Found');
          return;
        }
        const body = await readFile(filePath);
        const type = MIME[extname(filePath).toLowerCase()] ?? 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': type, 'Content-Length': body.length });
        res.end(body);
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(String(err));
      }
    })();
  });

  await new Promise<void>((resolvePromise, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolvePromise());
  });

  return server;
}

export async function stopServer(server: Server): Promise<void> {
  await new Promise<void>((resolvePromise, reject) => {
    server.close((err) => (err ? reject(err) : resolvePromise()));
  });
}
