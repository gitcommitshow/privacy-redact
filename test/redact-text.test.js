import test from 'node:test';
import assert from 'node:assert/strict';
import { redactDocument } from '../src/index.js';

test('redacts an email and reports that detector', () => {
  const out = redactDocument('Write jane.doe@example.com about the filing.');
  assert.match(out.text, /^Write •+ about the filing\.$/);
  assert.equal(out.text.includes('jane.doe'), false);
  assert.deepEqual(out.findings, [{ type: 'email', label: 'Emails', count: 1 }]);
});

test('leaves text that has no private fields', () => {
  const out = redactDocument('The hearing is on Tuesday.');
  assert.equal(out.text, 'The hearing is on Tuesday.');
  assert.deepEqual(out.findings, []);
});

test('returns an empty document for empty input', () => {
  assert.deepEqual(redactDocument(''), { text: '', findings: [] });
  assert.deepEqual(redactDocument(null), { text: '', findings: [] });
});
