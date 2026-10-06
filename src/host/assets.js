/**
 * Serves the package's OCR, face, and PDF files on the host's own origin.
 * The review element loads them from `/vendor` and does not take a model URL.
 */
import { createReadStream, existsSync, statSync, cpSync } from 'node:fs';
import { join, normalize, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = fileURLToPath(new URL('../..', import.meta.url));
const vendorDir = fileURLToPath(new URL('../../public/vendor/', import.meta.url));

const types = {
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.gz': 'application/gzip',
  '.ttf': 'font/ttf',
};

/** URL prefix for the vendored files, including the Vite `base`. */
function vendorPrefix(base) {
  const normalized = !base || base === './' ? '/' : (base.startsWith('/') ? base : `/${base}`);
  const withSlash = normalized.endsWith('/') ? normalized : `${normalized}/`;
  return `${withSlash}vendor`;
}

/** True when `file` is a real file inside the vendored directory. */
function vendorFile(rel) {
  const clean = normalize(rel).replace(/^[/\\]+/, '');
  if (!clean || clean.startsWith('..') || clean.includes(`..${sep}`)) return null;
  const file = join(vendorDir, clean);
  const root = vendorDir.endsWith(sep) ? vendorDir : vendorDir + sep;
  if (!file.startsWith(root) || !existsSync(file) || !statSync(file).isFile()) return null;
  return file;
}

/** Vite plugin. Copy is for production builds. Dev requests are read from the package. */
export function privacyRedact() {
  return {
    name: 'privacy-redact-assets',
    config() {
      return {
        optimizeDeps: {
          // The review screen imports these on the first file. Prebundle them so that
          // discovery does not reload the page and discard the open document.
          exclude: ['privacy-redact'],
          include: [
            'exifr',
            'pdfjs-dist',
            'pdf-lib',
            'tesseract.js',
            '@zxing/library',
            '@vladmandic/face-api/dist/face-api.esm.js',
          ],
        },
        server: { fs: { allow: [packageRoot] } },
      };
    },
    configResolved() {
      if (!existsSync(vendorDir)) {
        console.warn('[privacy-redact] public/vendor is missing. Run npm install in the privacy-redact package.');
      }
    },
    configureServer(server) {
      const prefix = vendorPrefix(server.config.base);
      server.middlewares.use((req, res, next) => {
        const url = decodeURIComponent((req.url || '').split('?')[0]);
        if (url !== prefix && !url.startsWith(`${prefix}/`)) return next();
        const file = vendorFile(url.slice(prefix.length));
        if (!file) return next();
        res.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream');
        createReadStream(file).on('error', next).pipe(res);
      });
    },
    writeBundle(options) {
      if (!options.dir || !existsSync(vendorDir)) return;
      cpSync(vendorDir, join(options.dir, 'vendor'), { recursive: true });
    },
  };
}
