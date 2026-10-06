/**
 * Which fields a scan should look for. Pure: no DOM. The page stores the
 * result in localStorage; tests pass a fake storage object.
 */
import { CATEGORIES, TEXT_TYPES } from '../detect/patterns.js';

const STORAGE_KEY = 'privacy-redact.scan';

/** Picture detectors. Each one is its own pass, unlike the text fields. */
export const PICTURE_SCAN_TYPES = ['face', 'barcode'];

/** Every field the settings page can turn on or off, in display order. */
export const SCAN_TYPES = [...TEXT_TYPES, ...PICTURE_SCAN_TYPES];

/** All fields on. A new detector stays on until the user turns it off. */
export function defaultScanPrefs() {
  return Object.fromEntries(SCAN_TYPES.map((id) => [id, true]));
}

/**
 * Keep only known fields. A non-boolean value is ignored so a bad save
 * cannot quietly leave a field out of the scan.
 */
export function normalizeScanPrefs(raw) {
  const prefs = defaultScanPrefs();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return prefs;
  for (const id of SCAN_TYPES) {
    if (typeof raw[id] === 'boolean') prefs[id] = raw[id];
  }
  return prefs;
}

/** Read saved fields. Missing or unreadable storage means scan everything. */
export function loadScanPrefs(storage) {
  const store = storage ?? globalThis.localStorage;
  try {
    const raw = store?.getItem(STORAGE_KEY);
    if (!raw) return defaultScanPrefs();
    return normalizeScanPrefs(JSON.parse(raw));
  } catch {
    return defaultScanPrefs();
  }
}

/** Persist fields. Returns the normalized set even if the write fails. */
export function saveScanPrefs(prefs, storage) {
  const clean = normalizeScanPrefs(prefs);
  const store = storage ?? globalThis.localStorage;
  try {
    store?.setItem(STORAGE_KEY, JSON.stringify(clean));
  } catch {
    // Private mode or a full quota. The in-memory set still applies this session.
  }
  return clean;
}

/** Text fields still selected. Empty means the text pass can be skipped. */
export function enabledTextTypes(prefs) {
  const on = normalizeScanPrefs(prefs);
  return TEXT_TYPES.filter((id) => on[id]);
}

/** Detector passes to run: one text pass, then barcodes, then faces. */
export function enabledSteps(prefs) {
  const on = normalizeScanPrefs(prefs);
  const steps = [];
  if (TEXT_TYPES.some((id) => on[id])) steps.push('ocr');
  if (on.barcode) steps.push('barcode');
  if (on.face) steps.push('face');
  return steps;
}

/** Fields for the common "only emails and phone numbers" choice. */
export function emailPhonePrefs() {
  const prefs = defaultScanPrefs();
  for (const id of SCAN_TYPES) prefs[id] = id === 'email' || id === 'phone';
  return prefs;
}

/** One line for the scan card. Empty when every field is still on. */
export function scanScopeText(prefs) {
  const on = normalizeScanPrefs(prefs);
  const ids = SCAN_TYPES.filter((id) => on[id]);
  if (ids.length === SCAN_TYPES.length) return '';
  if (!ids.length) return 'No fields selected. You can still draw boxes by hand.';
  const labels = ids.map((id) => CATEGORIES[id].label.toLowerCase());
  if (labels.length === 1) return `Looking for ${labels[0]} only.`;
  const last = labels.pop();
  return `Looking for ${labels.join(', ')} and ${last} only.`;
}
