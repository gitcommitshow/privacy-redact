/**
 * Playground server. Pasted text is redacted here with privacy-redact.
 * Vite mounts `playgroundApi` in dev. Running this file also serves a production build.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { redactDocument, TEXT_TYPES } from 'privacy-redact';

const here = fileURLToPath(new URL('.', import.meta.url));
const staticRoot = join(here, 'dist');
const port = Number(process.env.PORT) || 8791;
const maxBody = 1_000_000;
const allowedTypes = new Set(TEXT_TYPES);

const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.gz': 'application/gzip',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.woff2': 'font/woff2',
};

/** Read a JSON body up to the size cap. */
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let failed = false;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBody && !failed) {
        failed = true;
        reject(Object.assign(new Error('Document is too large.'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (failed) return;
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch {
        reject(Object.assign(new Error('Send a JSON body with a text field.'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

/**
 * Detector ids the caller asked for.
 * Omitted means every text detector. An empty array means none.
 */
function pickedTypes(body) {
  if (!Object.prototype.hasOwnProperty.call(body, 'types')) return undefined;
  if (!Array.isArray(body.types)) {
    throw Object.assign(new Error('types must be an array of detector ids.'), { status: 400 });
  }
  return body.types.filter((id) => allowedTypes.has(id));
}

/** A URL path inside dist/, or null when it would escape that folder. */
function fileFor(urlPath) {
  const raw = decodeURIComponent(urlPath.split('?')[0]);
  const rel = raw === '/' ? 'index.html' : normalize(raw).replace(/^[/\\]+/, '');
  const file = join(staticRoot, rel);
  const fromRoot = relative(staticRoot, file);
  if (!fromRoot || fromRoot.startsWith('..') || fromRoot.includes(`..${sep}`)) return null;
  return file;
}

/** POST /api/redact. Other requests continue to the next handler. */
export function playgroundApi(req, res, next) {
  const path = req.url?.split('?')[0];
  if (req.method === 'POST' && path === '/api/redact') {
    readBody(req)
      .then((body) => {
        const text = typeof body.text === 'string' ? body.text : '';
        const types = pickedTypes(body);
        const result = types ? redactDocument(text, types) : redactDocument(text);
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(result));
      })
      .catch((err) => {
        const status = err.status || 500;
        if (status === 500) console.error(err);
        const message = status === 500 ? 'Redaction failed.' : err.message;
        res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: message }));
      });
    return;
  }
  if (typeof next === 'function') {
    next();
    return;
  }
  serveStatic(req, res);
}

/** Serve the Vite build when this file is the process entry. */
async function serveStatic(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405).end();
    return;
  }
  const file = fileFor(req.url || '/');
  if (!file) {
    res.writeHead(404).end();
    return;
  }
  try {
    const body = await readFile(file);
    const type = types[extname(file)] || 'application/octet-stream';
    res.writeHead(200, { 'content-type': type });
    if (req.method === 'HEAD') res.end();
    else res.end(body);
  } catch (err) {
    const status = err.code === 'ENOENT' ? 404 : 500;
    if (status === 500) console.error(err);
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: status === 404 ? 'Not found.' : 'Redaction failed.' }));
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  createServer(playgroundApi).listen(port, '127.0.0.1', () => {
    console.log(`Playground listening on http://127.0.0.1:${port}`);
  });
}
