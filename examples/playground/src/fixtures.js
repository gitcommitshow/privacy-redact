/** One OCR word with a pixel box, the shape `regionsFromLines` expects. */
export function word(text, x, y, w, h = 22) {
  return { text, bbox: { x0: x, y0: y, x1: x + w, y1: y + h } };
}

/** A note a person might paste into a chat before it is stored or sent onward. */
export const PASSAGE = `Hi, this is a note for the front desk.

Please reach Alex at alex.rivera@example.com or (415) 555-0134.
Mailing address: 742 Evergreen Terrace, Springfield, IL 62704.
Card on file: 4242 4242 4242 4242. SSN: 123-45-6789.
DOB: 04/12/1988. Account No: 00123456789.
The staging key is sk_test_4eC39HqLyjWDarjtT1zdp7dc.
password: river-demo-88`;

/**
 * Two fictional pages of OCR lines.
 * The phone number is split across stacked rows so the wrap rule has something to join.
 */
export const intakePages = [
  [
    { words: [word('Patient', 16, 16, 72), word('MRN:', 98, 16, 52), word('004821', 158, 16, 78)] },
    { words: [word('DOB:', 16, 52, 52), word('04/12/1988', 76, 52, 118)] },
    { words: [word('Call', 16, 88, 46), word('+1', 70, 88, 32), word('303', 110, 88, 42), word('555', 160, 88, 42)] },
    { words: [word('0166', 70, 116, 52), word('after', 132, 116, 52), word('five.', 194, 116, 48)] },
  ],
  [
    { words: [word('Email', 16, 16, 56), word('alex.rivera@example.com', 82, 16, 240)] },
    { words: [word('742', 16, 52, 40), word('Evergreen', 64, 52, 100), word('Terrace,', 172, 52, 84)] },
    { words: [word('Springfield,', 16, 88, 118), word('IL', 142, 88, 28), word('62704', 178, 88, 64)] },
  ],
];
