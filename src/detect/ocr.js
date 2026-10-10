/**
 * OCR via Tesseract.js – engine, WASM core and language data are all served locally from /vendor.
 * Returns lines of words in the *original* canvas' pixel coordinates.
 */
import { createWorker } from 'tesseract.js';
import { coreCandidates, OCR_CORE_PREFERENCES } from './ocrCore.js';

let workerPromise = null;
let progressCb = null;
let corePreference = 'stable';

const abs = (p) => new URL(import.meta.env.BASE_URL + p, window.location.href).href;

/** True if this browser accepts the given WASM probe module. */
function wasmSupports(bytes) {
  try {
    return WebAssembly.validate(new Uint8Array(bytes));
  } catch {
    return false;
  }
}

// Probe modules from wasm-feature-detect. A wrong probe only means a slower core is picked.
const SIMD_PROBE = [0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11];
const RELAXED_SIMD_PROBE = [0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 15, 1, 13, 0, 65, 1, 253, 15, 65, 2, 253, 15, 253, 128, 2, 11];

/**
 * Choose 'stable' (default, same OCR output on every CPU) or 'fast' (relaxed SIMD when available).
 * Takes effect for the next worker, so call it before the first scan or after disposeOcr().
 */
export function setOcrCorePreference(preference) {
  if (!OCR_CORE_PREFERENCES.includes(preference)) {
    throw new Error(`Unknown OCR core preference "${preference}". Use one of: ${OCR_CORE_PREFERENCES.join(', ')}.`);
  }
  corePreference = preference;
}

/**
 * Start a worker on the first core that loads. We pick the core file ourselves instead of handing
 * tesseract.js a directory, so a tesseract.js upgrade that asks for a new file name cannot break OCR.
 */
async function startWorker() {
  const files = coreCandidates(corePreference, { simd: wasmSupports(SIMD_PROBE), relaxedSimd: wasmSupports(RELAXED_SIMD_PROBE) });
  let lastError;
  for (const file of files) {
    try {
      const worker = await createWorker('eng', 1, {
        workerPath: abs('vendor/tesseract/worker.min.js'),
        corePath: abs(`vendor/tesseract/${file}`),
        langPath: abs('vendor/tesseract'),
        gzip: true,
        cacheMethod: 'none',
        logger: (m) => { if (m.status === 'recognizing text' && progressCb) progressCb(m.progress); },
      });
      await worker.setParameters({ user_defined_dpi: '300' });
      return worker;
    } catch (err) {
      lastError = err;
      console.warn(`[privacy-redact] OCR core ${file} did not load, trying the next one`, err);
    }
  }
  throw lastError;
}

function getWorker() {
  if (!workerPromise) {
    workerPromise = startWorker().catch((err) => {
      workerPromise = null;
      throw err;
    });
  }
  return workerPromise;
}

/** Mean luminance 0-255 sampled on a coarse grid. */
function meanLuma(canvas) {
  const s = document.createElement('canvas');
  s.width = 64; s.height = 64;
  const c = s.getContext('2d', { willReadFrequently: true });
  c.drawImage(canvas, 0, 0, 64, 64);
  const d = c.getImageData(0, 0, 64, 64).data;
  let sum = 0;
  for (let i = 0; i < d.length; i += 4) sum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
  return sum / (d.length / 4);
}

/** Scale small screenshots up (Tesseract likes ~30px tall text), huge scans down; invert dark themes. */
function prepare(canvas) {
  const longest = Math.max(canvas.width, canvas.height);
  let scale = 1;
  if (longest < 1400) scale = Math.min(2.5, 2000 / longest);
  else if (longest > 4200) scale = 4200 / longest;
  const dark = meanLuma(canvas) < 110;
  if (scale === 1 && !dark) return { image: canvas, scale };
  const c = document.createElement('canvas');
  c.width = Math.round(canvas.width * scale);
  c.height = Math.round(canvas.height * scale);
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  if (dark) ctx.filter = 'invert(1) grayscale(1)';
  ctx.drawImage(canvas, 0, 0, c.width, c.height);
  return { image: c, scale };
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {(p:number)=>void} [onProgress] 0..1
 * @returns {Promise<{words:{text:string,confidence:number,bbox:{x0:number,y0:number,x1:number,y1:number}}[]}[]>}
 */
export async function recognizeLines(canvas, onProgress) {
  const worker = await getWorker();
  progressCb = onProgress || null;
  const { image, scale } = prepare(canvas);
  const { data } = await worker.recognize(image, {}, { blocks: true });
  progressCb = null;
  const lines = [];
  for (const block of data.blocks || []) {
    for (const para of block.paragraphs || []) {
      for (const line of para.lines || []) {
        const words = (line.words || [])
          // Drop low-confidence garbage (e.g. "words" OCR hallucinates inside photos) – it would otherwise stretch
          // redaction boxes. Anything containing a digit or "@" is kept, because that is what secrets look like.
          .filter((w) => w.text && w.text.trim() && (w.confidence >= 45 || /[\d@]/.test(w.text)))
          .map((w) => ({
            text: w.text.trim(),
            confidence: w.confidence,
            bbox: { x0: w.bbox.x0 / scale, y0: w.bbox.y0 / scale, x1: w.bbox.x1 / scale, y1: w.bbox.y1 / scale },
          }));
        if (words.length) lines.push({ words });
      }
    }
  }
  return lines;
}

export async function disposeOcr() {
  if (workerPromise) { const w = await workerPromise; await w.terminate(); workerPromise = null; }
}
