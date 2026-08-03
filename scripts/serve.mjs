/**
 * A static file server for the demo, in one file with no dependencies.
 *
 *   npm start            serve on http://localhost:5174
 *   npm start -- 8080    serve on a different port
 *
 * Deliberately not `npx serve`: that needs a network round-trip the first time
 * it runs, and this demo's whole promise is that it works in a room with no
 * usable wifi. Node alone is enough.
 *
 * Serving over http rather than opening the file directly also gives the page a
 * real origin, which is what a Fernfly project's allowed-origins list matches
 * against.
 */
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { join, extname, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = Number(process.argv[2] ?? process.env.PORT ?? 5174);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.md': 'text/plain; charset=utf-8',
};

const server = createServer(async (req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  let file = normalize(join(ROOT, urlPath === '/' ? '/index.html' : urlPath));

  // Refuse anything that climbed out of the deck directory.
  if (!file.startsWith(ROOT.endsWith(sep) ? ROOT : ROOT + sep)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  try {
    const info = await stat(file);
    if (info.isDirectory()) file = join(file, 'index.html');
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
    return;
  }

  res.writeHead(200, {
    'Content-Type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
    // Editing a slide mid-rehearsal should show up on the next reload.
    'Cache-Control': 'no-store',
  });
  createReadStream(file).pipe(res);
});

server.listen(PORT, () => {
  console.log(`\n  Chart command bar`);
  console.log(`  http://localhost:${PORT}\n`);
  console.log(`  Add this origin to your Fernfly project's allowed origins:`);
  console.log(`  http://localhost:${PORT}\n`);
  console.log(`  ctrl-c to stop\n`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n  Port ${PORT} is busy. Try: npm start -- ${PORT + 1}\n`);
    process.exit(1);
  }
  throw err;
});
