import test from 'node:test';
import assert from 'node:assert/strict';
import { findSensitive, luhn } from '../src/detect/patterns.js';
import { regionsFromLines, rectForRange, lineToText } from '../src/detect/textRegions.js';

const found = (text, types) => findSensitive(text, types).map((h) => ({ type: h.type, s: text.slice(h.start, h.end) }));

test('luhn', () => {
  assert.ok(luhn('4111111111111111'));
  assert.ok(luhn('378282246310005'));
  assert.ok(!luhn('4111111111111112'));
});

test('credit cards', () => {
  assert.deepEqual(found('Card 4111 1111 1111 1111 exp 12/29', ['card']), [{ type: 'card', s: '4111 1111 1111 1111' }]);
  assert.deepEqual(found('Amex 3782 822463 10005', ['card']), [{ type: 'card', s: '3782 822463 10005' }]);
  assert.deepEqual(found('4111-1111-1111-1111', ['card']).length, 1);
  assert.deepEqual(found('order #1234567890123456789012', ['card']), []);
  assert.equal(found('Visa **** **** **** 4242', ['card']).length, 1);
});

test('ssn', () => {
  assert.deepEqual(found('SSN 123-45-6789 ok', ['ssn']), [{ type: 'ssn', s: '123-45-6789' }]);
  assert.deepEqual(found('SSN: 123456789', ['ssn']), [{ type: 'ssn', s: '123456789' }]);
  assert.deepEqual(found('ref 000-12-3456', ['ssn']), []);
});

test('PAN: bare, labelled and OCR-garbled labelled values', () => {
  assert.deepEqual(found('Assessee ABCPE1234F filed', ['pan']), [{ type: 'pan', s: 'ABCPE1234F' }]);
  assert.deepEqual(found('(PAN: AAACX1234A)', ['pan']), [{ type: 'pan', s: 'AAACX1234A' }]);
  assert.equal(found('Permanent Account Number (PAN) ABCPE1234F', ['pan'])[0].s, 'ABCPE1234F');
  assert.equal(found('PAN No. ABCPE1234F', ['pan'])[0].s, 'ABCPE1234F');
  assert.equal(found('PAN: A8CPE1234F', ['pan'])[0].s, 'A8CPE1234F'); // 8 read in place of B
});

test('PAN in an ITAT cause-title cell, with typical OCR damage', () => {
  assert.deepEqual(found('Mumbai-400 004 PAN: ANQPS5958J', ['pan']), [{ type: 'pan', s: 'ANQPS5958J' }]);
  assert.equal(found('PAN: ANQPS5958|', ['pan'])[0].s, 'ANQPS5958|');          // last letter read as a table border
  assert.equal(found('PAN : ANQPS 5958J', ['pan'])[0].s, 'ANQPS 5958J');        // value split by a space
  assert.equal(found('PAN; ANQPSS958J', ['pan'])[0].s, 'ANQPSS958J');           // 5 read as S, odd separator
  assert.equal(found('as ANQPSS958J here', ['pan'])[0].s, 'ANQPSS958J');        // unlabelled, one swap
});

test('unlabelled PAN-shaped guesses stay strict', () => {
  assert.deepEqual(found('call 8888888888 now', ['pan']), []);       // all look-alike swaps, no real structure
  assert.deepEqual(found('call 9977343444 now', ['pan']), []);
  assert.deepEqual(found('PAN: ABCDE', ['pan']), []);
});

test('Aadhaar: grouped, plain and labelled', () => {
  assert.deepEqual(found('UID 2341 2341 2346 issued', ['aadhaar']), [{ type: 'aadhaar', s: '2341 2341 2346' }]);
  assert.equal(found('no 234123412346.', ['aadhaar'])[0].s, '234123412346');
  assert.equal(found('Aadhaar No: 2341-2341-2346', ['aadhaar'])[0].s, '2341-2341-2346');
  assert.equal(found('Aadhar Card No. 1234 5678 9012', ['aadhaar'])[0].s, '1234 5678 9012'); // labelled, no checksum needed
});

test('PAN and Aadhaar ignore look-alikes', () => {
  assert.deepEqual(found('code ABCXE1234F', ['pan']), []);           // 'X' is not a holder type
  assert.deepEqual(found('PAN 1234567890', ['pan']), []);            // not PAN-shaped
  assert.deepEqual(found('ref 234123412347', ['aadhaar']), []);      // checksum fails
  assert.deepEqual(found('ref 1341 2341 2346', ['aadhaar']), []);    // cannot start with 0 or 1
  assert.deepEqual(found('Card 4111 1111 1111 1111', ['aadhaar']), []);
});

test('email', () => {
  assert.deepEqual(found('mail jane.doe+x@example.co.uk, thanks', ['email']), [{ type: 'email', s: 'jane.doe+x@example.co.uk' }]);
});

test('email when OCR swaps the at-sign', () => {
  assert.equal(found('E-mail: test¢example.com', ['email'])[0].s, 'test¢example.com');
  assert.deepEqual(found('E-mail: B808Sumesh¢gmail', ['email']), []);
  assert.deepEqual(found('cost 5¢ per page', ['email']), []);
});

test('phone', () => {
  assert.equal(found('Call (415) 555-2671 now', ['phone'])[0].s, '(415) 555-2671');
  assert.equal(found('Call 415-555-2671', ['phone'])[0].s, '415-555-2671');
  assert.equal(found('+1 415 555 2671', ['phone']).length, 1);
  assert.equal(found('Tel +44 20 7946 0958', ['phone']).length, 1);
  assert.deepEqual(found('SSN 123-45-6789', ['phone']), []);
});

test('mobile number glued to its label', () => {
  assert.equal(found('Enrolment No.R-1234/2000 Mobile No.98765-43210', ['phone'])[0].s, '98765-43210');
  assert.deepEqual(found('Enrolment No.R-1234/2000', ['phone']), []);
  assert.deepEqual(found('Mobile No.12', ['phone']), []);
});

test('short phone labels (ph, phn, whatsapp) catch a bare 10-digit number', () => {
  assert.equal(found('hi I am available at ph 9977343444', ['phone'])[0].s, '9977343444');
  assert.equal(found('Phn: 9977343444', ['phone'])[0].s, '9977343444');
  assert.equal(found('Whatsapp 99773 43444', ['phone'])[0].s, '99773 43444');
});

test('unlabelled bare 10-digit Indian mobile is found', () => {
  assert.equal(found('call 9977343444 today', ['phone'])[0].s, '9977343444');
});

test('bare 10-digit rule ignores longer numbers, decimals and non-mobile prefixes', () => {
  assert.deepEqual(found('ref 99773434441234', ['phone']), []);
  assert.deepEqual(found('total 9977343444.55', ['phone']), []);
  assert.deepEqual(found('order 1234567890', ['phone']), []);
});

test('address', () => {
  assert.equal(found('Lives at 742 Evergreen Terrace, Apt 4B today', ['address'])[0].s, '742 Evergreen Terrace, Apt 4B');
  assert.equal(found('1600 Pennsylvania Ave NW, Washington, DC 20500', ['address'])[0].s, '1600 Pennsylvania Ave NW'); // quadrant suffix included
  assert.equal(found('Springfield, IL 62704', ['address'])[0].s, 'Springfield, IL 62704');
  assert.equal(found('New York NY 10001', ['address']).length, 1);
  assert.equal(found('PO Box 1234', ['address']).length, 1);
  assert.deepEqual(found('We shipped 3 items to the Way', ['address']), []);
});

test('labelled account, dob, secrets', () => {
  assert.equal(found('Account No: 00123456789', ['account'])[0].s, '00123456789');
  assert.equal(found('Routing # 021000021', ['account'])[0].s, '021000021');
  assert.equal(found('DOB: 04/12/1988', ['dob'])[0].s, '04/12/1988');
  assert.equal(found('Date of Birth March 3, 1990', ['dob'])[0].s, 'March 3, 1990');
  assert.equal(found('key sk-abcdefghijklmnopqrstuvwxyz123456', ['secret']).length, 1);
  assert.equal(found('AKIAIOSFODNN7EXAMPLE', ['secret']).length, 1);
  assert.equal(found('key: sk live 4eC39HqLyjWDarjtT1zdp7dc ok', ['secret']).length, 1); // OCR turned _ into space
  assert.equal(found('password: hunter2!', ['secret'])[0].s, 'hunter2!');
});

test('does not flag plain prose', () => {
  assert.deepEqual(findSensitive('The quick brown fox jumps over the lazy dog on 5 May.'), []);
});

test('word rect mapping with partial words', () => {
  const line = { words: [
    { text: 'Email:jane@x.com', bbox: { x0: 100, y0: 10, x1: 260, y1: 30 } },
  ] };
  const [r] = regionsFromLines([line], ['email']);
  assert.equal(r.type, 'email');
  assert.ok(r.x > 100 && r.x <= 160);          // trimmed off "Email:"
  assert.equal(Math.round(r.x + r.w), 260);
});

test('multi-word match unions boxes', () => {
  const line = { words: [
    { text: 'Card', bbox: { x0: 0, y0: 0, x1: 40, y1: 20 } },
    { text: '4111', bbox: { x0: 50, y0: 2, x1: 90, y1: 22 } },
    { text: '1111', bbox: { x0: 100, y0: 2, x1: 140, y1: 22 } },
    { text: '1111', bbox: { x0: 150, y0: 2, x1: 190, y1: 22 } },
    { text: '1111', bbox: { x0: 200, y0: 2, x1: 240, y1: 22 } },
  ] };
  const [r] = regionsFromLines([line], ['card']);
  assert.deepEqual([r.x, r.y, r.w, r.h], [50, 2, 190, 20]);
  const { spans } = lineToText(line);
  assert.equal(rectForRange(spans, 0, 4).w, 40);
});

test('phone number wrapped across two lines is found on both lines', () => {
  const lines = [
    { words: [
      { text: 'Emergency', bbox: { x0: 10, y0: 10, x1: 90, y1: 28 } },
      { text: 'contact:', bbox: { x0: 100, y0: 10, x1: 160, y1: 28 } },
      { text: '+1', bbox: { x0: 170, y0: 10, x1: 185, y1: 28 } },
      { text: '303', bbox: { x0: 195, y0: 10, x1: 225, y1: 28 } },
      { text: '555', bbox: { x0: 235, y0: 10, x1: 265, y1: 28 } },
    ] },
    { words: [{ text: '0166.', bbox: { x0: 10, y0: 34, x1: 50, y1: 52 } }] },
  ];
  const rs = regionsFromLines(lines, ['phone']);
  assert.equal(rs.length, 2);
  assert.ok(rs.some((r) => r.y < 20) && rs.some((r) => r.y > 30));
});

test('unrelated stacked numbers are not merged into a phone/card', () => {
  const mk = (t, y) => ({ words: [{ text: t, bbox: { x0: 10, y0: y, x1: 200, y1: y + 18 } }] });
  assert.equal(regionsFromLines([mk('Total 3,692.00', 10), mk('Net 3,391.24', 34)], ['phone', 'card', 'address']).length, 0);
});

test('trailing punctuation after a match is covered (no sliver left behind)', () => {
  const line = { words: [
    { text: '1600', bbox: { x0: 0, y0: 0, x1: 40, y1: 20 } },
    { text: 'Pennsylvania', bbox: { x0: 50, y0: 0, x1: 170, y1: 20 } },
    { text: 'Ave', bbox: { x0: 180, y0: 0, x1: 210, y1: 20 } },
    { text: 'NW,', bbox: { x0: 220, y0: 0, x1: 265, y1: 20 } },
  ] };
  const [r] = regionsFromLines([line], ['address']);
  assert.equal(Math.round(r.x + r.w), 265);
});

test('neighbouring same-type hits on one line are merged into one box', () => {
  const line = { words: [
    { text: '1600', bbox: { x0: 0, y0: 0, x1: 40, y1: 20 } },
    { text: 'Pennsylvania', bbox: { x0: 50, y0: 0, x1: 170, y1: 20 } },
    { text: 'Ave', bbox: { x0: 180, y0: 0, x1: 210, y1: 20 } },
    { text: 'NW,', bbox: { x0: 220, y0: 0, x1: 265, y1: 20 } },
    { text: 'Washington,', bbox: { x0: 275, y0: 0, x1: 370, y1: 20 } },
    { text: 'DC', bbox: { x0: 380, y0: 0, x1: 405, y1: 20 } },
    { text: '20500', bbox: { x0: 415, y0: 0, x1: 465, y1: 20 } },
  ] };
  const rs = regionsFromLines([line], ['address']);
  assert.equal(rs.length, 1);
  assert.equal(Math.round(rs[0].x), 0);
  assert.equal(Math.round(rs[0].x + rs[0].w), 465);
});
