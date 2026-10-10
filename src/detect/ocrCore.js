/**
 * Which Tesseract WASM core to load. Pure: no DOM, no tesseract.js - runs in Node for tests.
 * The same file list drives scripts/copy-assets.mjs, so what we vendor and what we load cannot drift apart.
 */

/** Vendored LSTM-only cores, fastest first. */
export const OCR_CORE_FILES = {
  relaxedSimd: 'tesseract-core-relaxedsimd-lstm.wasm.js',
  simd: 'tesseract-core-simd-lstm.wasm.js',
  baseline: 'tesseract-core-lstm.wasm.js',
};

/**
 * 'stable' never uses relaxed SIMD, whose results are allowed to differ between CPUs.
 * 'fast' tries relaxed SIMD first when the browser supports it.
 */
export const OCR_CORE_PREFERENCES = ['stable', 'fast'];

/** Core files to try in order. Always ends with the baseline core, which every WASM browser can run. */
export function coreCandidates(preference, { simd = false, relaxedSimd = false } = {}) {
  if (!OCR_CORE_PREFERENCES.includes(preference)) {
    throw new Error(`Unknown OCR core preference "${preference}". Use one of: ${OCR_CORE_PREFERENCES.join(', ')}.`);
  }
  const files = [];
  if (preference === 'fast' && relaxedSimd) files.push(OCR_CORE_FILES.relaxedSimd);
  if (simd) files.push(OCR_CORE_FILES.simd);
  files.push(OCR_CORE_FILES.baseline);
  return files;
}
