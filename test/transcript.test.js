import test from 'node:test';
import assert from 'node:assert/strict';
import {
  transcriptFromLines, redactTranscript, documentTranscript, redactUnderBoxes, regionsFromLines,
} from '../src/detect/textRegions.js';

const word = (text) => ({ text, bbox: { x0: 0, y0: 0, x1: 10, y1: 10 } });

/** A word that starts at x0, ten pixels per character, on one row. */
const placed = (text, x0) => ({ text, bbox: { x0, y0: 0, x1: x0 + text.length * 10, y1: 10 } });

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

test('masks only the words under a box that is on, such as one drawn by hand', () => {
  const lines = [{ words: [placed('Jane', 0), placed('Doe', 50), placed('jane@example.com', 100)] }];
  const boxes = [{ x: 0, y: 0, w: 40, h: 10 }];
  assert.equal(redactUnderBoxes(lines, boxes), `${'•'.repeat(4)} Doe jane@example.com`);
});

test('shows the words under a box that is off, even when the category is on', () => {
  const lines = [{ words: [placed('Jane', 0), placed('Doe', 50), placed('jane@example.com', 100)] }];
  // The email box was turned off, so no box is passed for it.
  assert.equal(documentTranscript([lines], { redact: true, boxes: [[]] }), 'Jane Doe jane@example.com');
  // The text rules alone would still hide it.
  assert.equal(redactTranscript(lines, ['email']), `Jane Doe ${'•'.repeat(16)}`);
});

test('boxes from the text rules give the same reading as the rules', () => {
  const lines = [{ words: [placed('Mail', 0), placed('jane@example.com', 50), placed('today', 230)] }];
  const boxes = regionsFromLines(lines, ['email']);
  assert.equal(redactUnderBoxes(lines, boxes), redactTranscript(lines, ['email']));
  assert.equal(redactUnderBoxes(lines, boxes), `Mail ${'•'.repeat(16)} today`);
});
