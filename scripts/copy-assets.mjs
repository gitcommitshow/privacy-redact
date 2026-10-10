// Copies the OCR engine, language data, face model and PDF.js fonts out of node_modules into
// public/vendor so the app is fully self-contained and never touches a CDN at runtime.
import { cpSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { OCR_CORE_FILES } from '../src/detect/ocrCore.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
/**
 * Resolves `p` inside the closest node_modules, walking up from the package root.
 * When this package is installed in another project, its dependencies are hoisted
 * to the host's node_modules instead of living under the package itself.
 * Falls back to the package-local path so the "missing" warning stays meaningful.
 */
function nm(p) {
  let dir = root;
  for (;;) {
    const candidate = join(dir, 'node_modules', p);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) return join(root, 'node_modules', p);
    dir = parent;
  }
}
const out = (p) => join(root, 'public', 'vendor', p);

function copy(src, dest) {
  if (!existsSync(src)) { console.warn(`[assets] missing ${src} – did you run npm install?`); return; }
  mkdirSync(dirname(dest), { recursive: true });
  cpSync(src, dest, { recursive: true });
}

// Tesseract OCR: worker + every LSTM-only WASM core the OCR module can pick + English model
copy(nm('tesseract.js/dist/worker.min.js'), out('tesseract/worker.min.js'));
for (const f of Object.values(OCR_CORE_FILES)) {
  copy(nm(`tesseract.js-core/${f}`), out(`tesseract/${f}`));
}
copy(nm('@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz'), out('tesseract/eng.traineddata.gz'));

// Face detection model (SSD MobileNet v1)
const faceModelDir = nm('@vladmandic/face-api/model');
if (existsSync(faceModelDir)) {
  for (const f of readdirSync(faceModelDir).filter((n) => n.startsWith('ssd_mobilenetv1'))) {
    copy(join(faceModelDir, f), out(`face-models/${f}`));
  }
} else {
  console.warn(`[assets] missing ${faceModelDir} - did you run npm install?`);
}

// PDF.js fonts + CMaps (needed for PDFs that don't embed their fonts).
// wasm/ (image decoders such as JPEG2000) and iccs/ (colour profiles) exist from pdf.js 5 on.
copy(nm('pdfjs-dist/standard_fonts'), out('pdfjs/standard_fonts'));
copy(nm('pdfjs-dist/cmaps'), out('pdfjs/cmaps'));
copy(nm('pdfjs-dist/wasm'), out('pdfjs/wasm'));
copy(nm('pdfjs-dist/iccs'), out('pdfjs/iccs'));

// Blend fonts (Crimson Pro, IBM Plex Sans) for static pages under public/ such as the wiki,
// which Vite does not process and so cannot resolve the font imports in src/style.css.
for (const f of ['crimson-pro-300.woff2', 'ibm-plex-sans-300.woff2', 'ibm-plex-sans-400.woff2']) {
  copy(join(root, 'src', 'fonts', f), out(`fonts/${f}`));
}

console.log('[assets] vendored offline assets ready in public/vendor');
