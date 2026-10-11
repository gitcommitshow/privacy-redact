import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeActions } from '../src/review/actions.js';

test('fills in the defaults for a host list', () => {
  const [attach, cancel] = normalizeActions([
    { id: 'attach', label: 'Attach to chat', outputs: ['file', 'text'], choose: true, format: 'png' },
    { id: 'cancel', label: 'Cancel', outputs: [] },
  ]);
  assert.equal(attach.variant, 'primary');
  assert.equal(cancel.variant, 'secondary');
  assert.equal(attach.download, false);
  assert.equal(attach.busyLabel, 'Preparing...');
  assert.deepEqual(cancel.outputs, []);
});

test('an unset list is the built-in Save button, which downloads', () => {
  const [save] = normalizeActions(undefined);
  assert.equal(save.id, 'download');
  assert.equal(save.label, 'Save sanitized file');
  assert.equal(save.download, true);
});

test('a bad field throws a TypeError that names the entry and the field', () => {
  assert.throws(
    () => normalizeActions([{ id: 'attach', label: 'Attach', outputs: ['file'] }, { id: 'send', label: 'Send', outputs: ['pdf'] }]),
    (err) => err instanceof TypeError && /actions\[1\]\.outputs/.test(err.message),
  );
});
