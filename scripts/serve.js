// `npm start`: builds the site, then serves dist/ at http://localhost:4000 so you can look at it before you push.
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';

const root = path.resolve('dist');
const port = Number(process.env.PORT) || 4000;
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

if (!existsSync(path.join(root, 'index.html'))) {
  console.error('dist/index.html does not exist yet. Run npm run build first.');
  process.exit(1);
}

createServer(async (request, response) => {
  let file;
  try {
    const { pathname } = new URL(request.url, 'http://localhost');
    file = path.join(root, decodeURIComponent(pathname));
    if (pathname.endsWith('/')) file = path.join(file, 'index.html');
  } catch {
    response.writeHead(400).end();
    return;
  }
  if (!file.startsWith(root)) {
    response.writeHead(403).end();
    return;
  }
  try {
    const body = await readFile(file);
    response.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
    response.end(body);
  } catch {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`Serving dist/ at http://localhost:${port} (press Ctrl+C to stop)`);
});
