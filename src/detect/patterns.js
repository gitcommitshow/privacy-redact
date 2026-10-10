/**
 * Pure text pattern detection. No DOM, no dependencies – runs in Node for tests.
 *
 * `findSensitive(text, enabledTypes)` returns [{ type, start, end, confidence }]
 * where start/end are character offsets into `text` (end exclusive).
 */

export const CATEGORIES = {
  card:    { label: 'Credit cards',      icon: '💳' },
  ssn:     { label: 'SSN / national ID', icon: '🪪' },
  aadhaar: { label: 'Aadhaar numbers',   icon: '🆔' },
  pan:     { label: 'PAN (India tax ID)', icon: '🧾' },
  email:   { label: 'Emails',            icon: '✉️' },
  phone:   { label: 'Phone numbers',     icon: '📞' },
  address: { label: 'Home addresses',    icon: '🏠' },
  account: { label: 'Account numbers',   icon: '🏦' },
  dob:     { label: 'Dates of birth',    icon: '🎂' },
  secret:  { label: 'API keys & tokens', icon: '🔑' },
  face:    { label: 'Faces',             icon: '🙂' },
  barcode: { label: 'Barcodes & QR',     icon: '▦' },
};

export const TEXT_TYPES = ['card', 'ssn', 'aadhaar', 'pan', 'email', 'phone', 'address', 'account', 'dob', 'secret'];

/** Luhn checksum – used to tell real card numbers from random digit runs. */
export function luhn(digits) {
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = digits.charCodeAt(i) - 48;
    if (n < 0 || n > 9) return false;
    if (alt) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
    alt = !alt;
  }
  return digits.length > 0 && sum % 10 === 0;
}

// Verhoeff tables (multiplication and permutation) used by the Aadhaar checksum.
const VERHOEFF_D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2, 3, 4, 0, 6, 7, 8, 9, 5], [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7], [4, 0, 1, 2, 3, 9, 5, 6, 7, 8], [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2], [7, 6, 5, 9, 8, 2, 1, 0, 4, 3], [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];
const VERHOEFF_P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 5, 7, 6, 2, 8, 3, 0, 9, 4], [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7], [9, 4, 5, 3, 1, 2, 6, 8, 7, 0], [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5], [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

/** Verhoeff checksum - used to tell real Aadhaar numbers from random 12-digit runs. */
export function verhoeff(digits) {
  let c = 0;
  for (let i = 0; i < digits.length; i++) {
    const n = digits.charCodeAt(digits.length - 1 - i) - 48;
    if (n < 0 || n > 9) return false;
    c = VERHOEFF_D[c][VERHOEFF_P[i % 8][n]];
  }
  return digits.length > 0 && c === 0;
}

// PAN is 5 letters, 4 digits, 1 letter. OCR swaps look-alike characters, so these maps repair a labelled value.
const PAN_DIGIT_TO_LETTER = { 0: 'O', 1: 'I', 2: 'Z', 5: 'S', 6: 'G', 8: 'B' };
const PAN_LETTER_TO_DIGIT = { O: '0', D: '0', I: '1', L: '1', Z: '2', S: '5', G: '6', B: '8' };

// A table border or bracket right after the last character is often read as part of it ("ANQPS5958J|").
const PAN_TRAILING_NOISE = '|])!/\\';
const PAN_HOLDER_TYPES = 'PCHFATBLJG';

/**
 * True if a 10-char value is a PAN once common OCR look-alike swaps are undone.
 * `minExact` is how many characters must already be the right kind without any repair.
 */
function looksLikePan(value, minExact = 0) {
  if (value.length !== 10) return false;
  let exact = 0;
  for (let i = 0; i < 10; i++) {
    const c = value[i];
    const wantLetter = i < 5 || i === 9;
    if (wantLetter ? (c >= 'A' && c <= 'Z') : (c >= '0' && c <= '9')) { exact++; continue; }
    const repaired = wantLetter ? PAN_DIGIT_TO_LETTER[c] : PAN_LETTER_TO_DIGIT[c];
    if (!repaired && !(i === 9 && PAN_TRAILING_NOISE.includes(c))) return false;
  }
  return exact >= minExact;
}

const STATES = 'AL|AK|AZ|AR|CA|CO|CT|DE|DC|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY';
const PROVINCES = 'AB|BC|MB|NB|NL|NS|NT|NU|ON|PE|QC|SK|YT';
const STREET_SUFFIX_BASE = 'Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Court|Ct|Way|Place|Pl|Terrace|Ter|Parkway|Pkwy|Circle|Cir|Highway|Hwy|Trail|Trl|Square|Sq|Loop|Alley|Row';
// Capitalised ("Street") or ALL CAPS ("STREET") – never lowercase, which avoids matching prose like "3 items to the way".
const STREET_SUFFIX = `${STREET_SUFFIX_BASE}|${STREET_SUFFIX_BASE.toUpperCase()}`;

const DATE = String.raw`(?:\d{1,2}[\/.\-]\d{1,2}[\/.\-](?:\d{4}|\d{2})|\d{4}[\/.\-]\d{1,2}[\/.\-]\d{1,2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4}|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?,?\s+\d{4})`;

/** Each rule: regex with /g, optional `group` (capture group to redact), optional `validate`. */
const RULES = [
  {
    // @ plus marks OCR prints in its place: fullwidth ＠, cent ¢, © ® ¤.
    type: 'email',
    re: /[A-Za-z0-9._%+\-]+[@＠¢©®¤][A-Za-z0-9\-]+(?:\.[A-Za-z0-9\-]+)*\.[A-Za-z]{2,}/g,
    confidence: 0.98,
  },
  {
    type: 'card',
    re: /(?<![\d])(?:\d[ \-]?){12,18}\d(?![\d])/g,
    validate(m) {
      const digits = m.replace(/\D/g, '');
      if (digits.length < 13 || digits.length > 19) return 0;
      if (luhn(digits)) return 0.97;
      // OCR often misreads a digit; keep well-formed 4-4-4-4 / Amex 4-6-5 groupings.
      if (/^\d{4}[ \-]\d{4}[ \-]\d{4}[ \-]\d{4}$/.test(m.trim())) return 0.75;
      if (/^\d{4}[ \-]\d{6}[ \-]\d{5}$/.test(m.trim())) return 0.75;
      return 0;
    },
  },
  {
    // Masked cards: "**** **** **** 1234", "XXXX-XXXX-XXXX-1234", "•••• 1234"
    type: 'card',
    re: /(?:[*xX•●·]{4}[ \-]?){1,3}\d{4}\b/g,
    confidence: 0.8,
  },
  {
    type: 'ssn',
    re: /(?<![\d\-])(?!000|666|9\d\d)\d{3}[\- ](?!00)\d{2}[\- ](?!0000)\d{4}(?![\d\-])/g,
    confidence: 0.95,
  },
  {
    // "SSN: 123456789" / "Social Security No. 123 45 6789"
    type: 'ssn',
    re: /\b(?:SSN|SS#|Social\s+Security(?:\s+(?:No|Number|#))?\.?|SIN|Tax\s*ID|TIN|EIN)\s*[:#\-]?\s*([\dXx*\- ]{9,12})\b/gi,
    group: 1,
    confidence: 0.9,
  },
  {
    // Aadhaar, unlabelled: 12 digits (optionally grouped 4-4-4), first digit 2-9, must pass the Verhoeff checksum.
    type: 'aadhaar',
    re: /(?<![\d\-])(?<!\d[ \-])[2-9]\d{3}([ \-]?)\d{4}\1\d{4}(?!\d|[ \-]\d|-)/g,
    validate: (m) => (verhoeff(m.replace(/\D/g, '')) ? 0.95 : 0),
  },
  {
    // Aadhaar, labelled ("Aadhaar No: 2341 2341 2346", "UID 234123412346"). No checksum, so OCR digit slips still match.
    type: 'aadhaar',
    re: /\b(?:aa?dha{1,2}r|UID(?:AI)?)(?:\s+(?:Card|No|Number|Num|ID))*\.?\s*[:#\-\u2013\u2014]?\s*(\d{4}[ \-]?\d{4}[ \-]?\d{4})(?!\d)/gi,
    group: 1,
    confidence: 0.9,
  },
  {
    // PAN, unlabelled: AAAAA9999A. The 4th letter is the holder type (P person, C company, H HUF, F firm, ...).
    // Up to two characters may be OCR look-alike swaps (S for 5, O for 0), but the rest must already fit.
    type: 'pan',
    re: /\b[A-Z0-9]{10}\b/g,
    validate(m) {
      if (!looksLikePan(m, 8)) return 0;
      const fourth = /[A-Z]/.test(m[3]) ? m[3] : PAN_DIGIT_TO_LETTER[m[3]];
      return PAN_HOLDER_TYPES.includes(fourth) ? 0.95 : 0;
    },
  },
  {
    // PAN, labelled ("PAN: ABCDE1234F", "Permanent Account Number (PAN) ABCDE1234F"). The label makes it safe to accept
    // a value split by a space, with look-alike swaps, or with a table border glued to the last character.
    type: 'pan',
    re: /\b(?:Permanent\s+Account\s+(?:No|Number)|PAN)(?:\s*\(\s*PAN\s*\))?(?:\s+(?:No|Number|Card))?\.?\s*[:;,#=\-\u2013\u2014]?\s*([A-Z0-9]{5} ?[A-Z0-9]{4} ?[A-Z0-9|\])!\/\\])(?![A-Za-z0-9])/gi,
    group: 1,
    validate: (m) => (looksLikePan(m.replace(/\s/g, '').toUpperCase().slice(-10)) ? 0.9 : 0),
  },
  {
    type: 'phone',
    re: /(?<![\w@.\-\/])(?:\+?1[\s.\-]?)?(?:\(\d{3}\)\s?|\d{3}[\s.\-])\d{3}[\s.\-]\d{4}(?![\d\-])/g,
    confidence: 0.9,
  },
  {
    // International: +44 20 7946 0958, +33 1 23 45 67 89
    type: 'phone',
    re: /(?<![\w@.\-\/])\+\d{1,3}[\s.\-]?(?:\(?\d{1,4}\)?[\s.\-]?){2,5}\d{2,4}(?![\d\-])/g,
    validate(m) {
      const n = m.replace(/\D/g, '').length;
      return n >= 8 && n <= 15 ? 0.85 : 0;
    },
  },
  {
    // "Mobile No.98765-43210" — the dot is glued on, so a bare number pattern never sees a word boundary.
    type: 'phone',
    re: /\b(?:Mobile|Mob|Phone|Ph|Phn|Tel|Telephone|Cell|Whatsapp|WA|Contact)\s*(?:No|Number|#)?\.?\s*[:#\-]?\s*(\+?\d[\d\s.\-()]{7,16}\d)/gi,
    group: 1,
    validate(m) {
      const n = m.replace(/\D/g, '').length;
      return n >= 10 && n <= 15 ? 0.92 : 0;
    },
  },
  {
    // India writes a 10-digit mobile as 5-5: 98765-43210, +91 98765 43210.
    type: 'phone',
    re: /(?<![\w@/])(?:\+91[\s.\-]?)?[6-9]\d{4}[\s.\-]\d{5}(?!\d)/g,
    confidence: 0.88,
  },
  {
    // Unlabelled bare Indian mobile: 9977343444 (10 digits, starts 6-9, not part of a longer number/decimal/ID).
    type: 'phone',
    re: /(?<![\w@/.\-])[6-9]\d{9}(?![\d\-@/]|\.\d)/g,
    confidence: 0.75,
  },
  {
    // 123 Main Street, Apt 4B
    type: 'address',
    re: new RegExp(String.raw`\b\d{1,6}[A-Za-z]?\s+(?:(?:N|S|E|W|NE|NW|SE|SW|North|South|East|West|NORTH|SOUTH|EAST|WEST)\.?\s+)?(?:[A-Z0-9][A-Za-z0-9.'\-]*\s+){0,3}?(?:${STREET_SUFFIX})\b\.?(?:\s+(?:NW|NE|SW|SE|N|S|E|W)\b\.?)?(?:,?\s*(?:Apt|Apartment|Suite|Ste|Unit|Fl|Floor|APT|SUITE|STE|UNIT|#)\.?\s*[\w\-]+)?`, 'g'),
    validate: (m) => (/^\d/.test(m) ? 0.85 : 0),
  },
  {
    // Springfield, IL 62704   |   Toronto ON M5V 2T6
    type: 'address',
    re: new RegExp(String.raw`\b[A-Z][A-Za-z.'\-]+(?:\s[A-Z][A-Za-z.'\-]+){0,3},?\s+(?:${STATES})\.?\s+\d{5}(?:-\d{4})?\b`, 'g'),
    confidence: 0.9,
  },
  {
    type: 'address',
    re: new RegExp(String.raw`\b[A-Z][A-Za-z.'\-]+(?:\s[A-Z][A-Za-z.'\-]+){0,3},?\s+(?:${PROVINCES})\s+[A-Z]\d[A-Z][ \-]?\d[A-Z]\d\b`, 'g'),
    confidence: 0.9,
  },
  {
    type: 'address',
    re: /\bP\.?\s?O\.?\s+Box\s+\d+\b/gi,
    confidence: 0.9,
  },
  {
    // UK postcode: SW1A 1AA
    type: 'address',
    re: /\b[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}\b/g,
    confidence: 0.6,
  },
  {
    // Labelled values: "Account No: 00123456", "Routing # 021000021", "IBAN GB29 NWBK ..."
    type: 'account',
    re: /\b(?:Acct|Account|Routing|ABA|Member|Policy|Patient|MRN|Claim|Customer|License|Licence|Passport|Employee|Driver'?s?\s+Lic(?:ense)?)\.?\s*(?:ID|No|Number|Num|#)?\.?\s*[:#\-]?\s*((?=[A-Z\-]*\d)[A-Z0-9][A-Z0-9\-]{5,})/gi,
    group: 1,
    confidence: 0.85,
  },
  {
    type: 'account',
    re: /\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{4}){3,7}(?:[ ]?[A-Z0-9]{1,4})?\b/g,
    validate: (m) => (m.replace(/\s/g, '').length >= 15 && /\d/.test(m) ? 0.8 : 0),
  },
  {
    type: 'dob',
    re: new RegExp(String.raw`\b(?:DOB|D\.O\.B\.?|Date\s+of\s+Birth|Birth\s*date|Birthday|Born)\s*[:\-]?\s*(${DATE})`, 'gi'),
    group: 1,
    confidence: 0.92,
  },
  {
    type: 'secret',
    re: /\b(?:sk-[A-Za-z0-9_\-]{20,}|sk_(?:live|test)_[A-Za-z0-9]{16,}|pk_(?:live|test)_[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|xox[baprs]-[A-Za-z0-9\-]{10,}|AIza[0-9A-Za-z_\-]{30,}|eyJ[A-Za-z0-9_\-]{8,}\.[A-Za-z0-9_\-]{8,}\.[A-Za-z0-9_\-]{8,})\b/g,
    confidence: 0.97,
  },
  {
    // Stripe-style keys after OCR turned the underscores into spaces: "sk live 4eC39Hq…"
    type: 'secret',
    re: /\b(?:sk|pk|rk)[_\- ](?:live|test)[_\- ][A-Za-z0-9]{16,}/g,
    confidence: 0.9,
  },
  {
    type: 'secret',
    re: /\b(?:password|passwd|pwd|passcode|secret|token|api[_\- ]?key)\s*[:=]\s*(\S{4,})/gi,
    group: 1,
    confidence: 0.85,
  },
];

/**
 * @param {string} text
 * @param {Iterable<string>} [enabled] category ids to look for (default: all text types)
 * @returns {{type:string,start:number,end:number,confidence:number}[]}
 */
export function findSensitive(text, enabled = TEXT_TYPES) {
  const on = new Set(enabled);
  const out = [];
  for (const rule of RULES) {
    if (!on.has(rule.type)) continue;
    rule.re.lastIndex = 0;
    let m;
    while ((m = rule.re.exec(text)) !== null) {
      if (m[0].length === 0) { rule.re.lastIndex++; continue; }
      const conf = rule.validate ? rule.validate(m[0]) : rule.confidence;
      if (!conf) continue;
      let start = m.index;
      let end = m.index + m[0].length;
      if (rule.group) {
        const g = m[rule.group];
        if (!g) continue;
        start = m.index + m[0].lastIndexOf(g);
        end = start + g.length;
      }
      // trim trailing punctuation / whitespace
      while (end > start && /[\s.,;:)]/.test(text[end - 1]) && !(text[end - 1] === ')' && text.slice(start, end).includes('('))) end--;
      while (start < end && /\s/.test(text[start])) start++;
      if (end > start) out.push({ type: rule.type, start, end, confidence: conf });
    }
  }
  return dedupe(out);
}

/** Merge overlapping hits, preferring the higher-confidence / more specific one. */
function dedupe(hits) {
  hits.sort((a, b) => a.start - b.start || b.end - a.end);
  const res = [];
  for (const h of hits) {
    const last = res[res.length - 1];
    if (last && h.start < last.end) {
      // overlap: keep the union if same type, else keep the better one
      if (h.type === last.type) { last.end = Math.max(last.end, h.end); last.confidence = Math.max(last.confidence, h.confidence); }
      else if (h.confidence > last.confidence && h.end - h.start >= (last.end - last.start) * 0.6) res[res.length - 1] = h;
      continue;
    }
    res.push({ ...h });
  }
  return res;
}
