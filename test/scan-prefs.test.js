import test from 'node:test';
import assert from 'node:assert/strict';
import { TEXT_TYPES } from '../src/detect/patterns.js';
import {
  defaultScanPrefs, loadScanPrefs, saveScanPrefs, normalizeScanPrefs,
  enabledTextTypes, enabledSteps, emailPhonePrefs, scanScopeText,
} from '../src/prefs/scan.js';

test('every field is scanned unless a preference says otherwise', () => {
  const prefs = loadScanPrefs({ getItem() { return null; } });
  assert.deepEqual(prefs, defaultScanPrefs());
  assert.equal(Object.values(prefs).every(Boolean), true);
  assert.deepEqual(enabledSteps(prefs), ['ocr', 'barcode', 'face']);
  assert.deepEqual(enabledTextTypes(prefs), TEXT_TYPES);
  assert.equal(scanScopeText(prefs), '');
});

test('email and phone leave the other detectors off', () => {
  const prefs = emailPhonePrefs();
  assert.deepEqual(enabledTextTypes(prefs), ['email', 'phone']);
  assert.deepEqual(enabledSteps(prefs), ['ocr']);
  assert.equal(prefs.face, false);
  assert.equal(prefs.barcode, false);
  assert.equal(prefs.card, false);
  assert.match(scanScopeText(prefs), /emails/i);
  assert.match(scanScopeText(prefs), /phone numbers/i);
  assert.doesNotMatch(scanScopeText(prefs), /faces/i);
});

test('broken storage does not turn fields off', () => {
  assert.deepEqual(loadScanPrefs({ getItem() { return '{'; } }), defaultScanPrefs());
  const saved = saveScanPrefs({ email: false, face: false }, {
    setItem() { throw new Error('quota'); },
  });
  assert.equal(saved.email, false);
  assert.equal(saved.phone, true);
  const weird = normalizeScanPrefs({ email: false, face: 'off', extra: false });
  assert.equal(weird.email, false);
  assert.equal(weird.face, true);
  assert.equal(weird.extra, undefined);
});
