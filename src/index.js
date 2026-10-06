/**
 * Node-safe library: find private text, redact it, and summarize document metadata.
 * OCR, faces, barcodes, PDF rendering, and canvas export stay in their own modules
 * so a server does not load a browser.
 */
export { findSensitive, luhn, CATEGORIES, TEXT_TYPES } from './detect/patterns.js';
export {
  redactDocument, redactPlainText, redactTranscript, documentTranscript, transcriptFromLines, regionsFromLines,
} from './detect/textRegions.js';
export {
  SCAN_TYPES, defaultScanPrefs, normalizeScanPrefs, enabledTextTypes, enabledSteps,
} from './prefs/scan.js';
export { summarizeTags } from './io/metadata.js';
