import test from 'node:test';
import assert from 'node:assert/strict';
import { transcriptFromLines, redactTranscript, documentTranscript } from '../src/detect/textRegions.js';

const word = (text) => ({ text, bbox: { x0: 0, y0: 0, x1: 10, y1: 10 } });

test('joins recognized words into lines', () => {
  const text = transcriptFromLines([
    { words: [word('Jane'), word('Doe')] },
    { words: [word('jane@example.com')] },
  ]);
  assert.equal(text, 'Jane Doe\njane@example.com');
});

test('skips blank lines and empty words', () => {
  const text = transcriptFromLines([
    { words: [word(''), word('  ')] },
    { words: [word('Hello'), word('')] },
  ]);
  assert.equal(text, 'Hello');
});

test('returns empty text when nothing was read', () => {
  assert.equal(transcriptFromLines([]), '');
  assert.equal(transcriptFromLines(null), '');
});

test('hides a sensitive span and keeps the words around it', () => {
  const lines = [{ words: [word('Mail'), word('jane@example.com'), word('today')] }];
  assert.equal(redactTranscript(lines, ['email']), 'Mail •••••••••••••••• today');
});

test('leaves a span alone when that field is off', () => {
  const lines = [{ words: [word('Mail'), word('jane@example.com')] }];
  assert.equal(redactTranscript(lines, ['phone']), 'Mail jane@example.com');
  assert.equal(redactTranscript(null, ['email']), '');
});

test('joins every page, and skips the page label for a single page', () => {
  const hello = [{ words: [word('Hello')] }];
  const world = [{ words: [word('World')] }];
  assert.equal(documentTranscript([hello, world]), 'Page 1\nHello\n\nPage 2\nWorld');
  assert.equal(documentTranscript([hello]), 'Hello');
  assert.equal(documentTranscript([]), '');
});
