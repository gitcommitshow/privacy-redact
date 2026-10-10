import test from 'node:test';
import assert from 'node:assert/strict';
import { coreCandidates, OCR_CORE_FILES } from '../src/detect/ocrCore.js';

const all = { simd: true, relaxedSimd: true };

test('stable never picks relaxed SIMD, and every list ends with the baseline core', () => {
  assert.deepEqual(coreCandidates('stable', all), [OCR_CORE_FILES.simd, OCR_CORE_FILES.baseline]);
});

test('fast tries relaxed SIMD first only when the browser supports it', () => {
  assert.deepEqual(coreCandidates('fast', all), [OCR_CORE_FILES.relaxedSimd, OCR_CORE_FILES.simd, OCR_CORE_FILES.baseline]);
  assert.deepEqual(coreCandidates('fast', { simd: false, relaxedSimd: false }), [OCR_CORE_FILES.baseline]);
});

test('an unknown preference is rejected instead of silently ignored', () => {
  assert.throws(() => coreCandidates('turbo', all), /Unknown OCR core preference "turbo"/);
});
