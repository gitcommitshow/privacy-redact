# Locale packs

Status: proposed.

Detection today is English-first. Labels, address rules, and the OCR language are written into `src/detect/patterns.js` and `src/detect/ocr.js`. This spec moves that knowledge into data packs, so a new language or country is a new pack and not a change to the engine. Hindi and India are the first packs that use it.

Product requirements stay in [REQUIREMENTS.md](REQUIREMENTS.md). The shape of the system stays in [DESIGN.md](DESIGN.md). Both get a short update when this ships.

## Goals

- A host chooses which countries and languages a scan covers.
- Adding a language with spaces between words, written left to right, needs a pack file, fixtures, and nothing else.
- The default output for current callers does not lose a single hit.
- Hindi documents are read and checked by default.
- A scan that cannot cover the document's language says so. It does not fail silently.

## Non-goals

- Names, in any language. They stay undetected, as today.
- Scripts without spaces between words (Chinese, Japanese, Thai). They need a tokenizer, which is later engine work.
- Right-to-left scripts (Arabic, Urdu). Box mapping in `rectForRange` assumes left to right.
- Guessing the document language. The host chooses the scope.
- Translating the review screen. Its wording stays English.
- Host-written region packs. Those carry value patterns and belong with the "custom detection rules" roadmap item.

## Terms

| Term | Meaning |
| --- | --- |
| Category | What is found: `card`, `aadhaar`, `address`, and so on. One global list. |
| Region pack | A country's formats: ID numbers, postal codes, phone formats, place names. Keyed by ISO 3166 code, such as `IN`. |
| Language pack | How a language writes those things: OCR data, labels, cue words, digits. Keyed by language tag, such as `hi`. |
| Scope | The regions and languages a detector uses. |
| Detector | Rules compiled once for one scope. |

Aadhaar and PAN belong to the `IN` region. An English form from India needs `IN`, not `hi`. A Hindi form needs both.

## Defaults

```js
export const DEFAULT_SCOPE = { regions: ['US', 'CA', 'GB', 'IN'], languages: ['en', 'hi'] };
```

- Every region with a rule today is in the default. Aadhaar, PAN, and Indian mobile numbers are found today, so `IN` stays on.
- `hi` is on by default. A Hindi page read only with the English model gives mostly unreadable text, and nothing is found on it.
- With the default scope, every current test passes unchanged. Hindi labels only add hits.

## Public API

### Text

```js
import { createDetector, redactDocument } from 'privacy-redact';

// Unchanged: default scope.
redactDocument(text);
redactDocument(text, ['email', 'phone']);

// A chosen scope. Rules are compiled once here.
const detector = createDetector({ regions: ['IN'], languages: ['en', 'hi'] });
const { text: safe, findings, scope, warnings } = detector.redactDocument(text);
```

- `createDetector(scope)` returns `{ findSensitive, redactDocument, redactPlainText, redactTranscript, documentTranscript, regionsFromLines, textTypes, ocrLanguages, scope }`. Each method takes the same arguments as today's function, without a scope.
- The top-level functions stay. They use a detector built from `DEFAULT_SCOPE`.
- `languages` entries are shipped pack ids (`'hi'`) or pack objects. A host adds a language by passing its object. There is no global registry, so two detectors on one page cannot affect each other.
- `regions` entries are shipped region ids only.
- `redactDocument` adds `scope` and `warnings` to its result. Both are new fields, so current callers are unaffected. Neither contains document text.
- `TEXT_TYPES` stays and equals `createDetector(DEFAULT_SCOPE).textTypes`.
- `createDetector` throws on an unknown id or an invalid pack. It names the pack and the field.

### Review element

- Attributes: `languages="en hi"` and `regions="IN US"`. Ids only.
- Properties: `el.languages` and `el.regions`. These also accept pack objects.
- React: `languages` and `regions` props on `PrivacyRedactReview`.
- When omitted, the element uses `DEFAULT_SCOPE`.
- `onResult` adds `scope` and `warnings`.
- A review session records its scope, so opening it later shows the scope that produced the boxes.

### Vite plugin

```js
privacyRedact({ languages: ['ta'] });
```

- This serves and copies OCR data for languages beyond the shipped ones. The data comes from `@tesseract.js-data/<code>`, installed by the host and pinned in the host's lockfile.
- The scan still makes no network request. The data is on the host's origin.

## Pack format

### Language pack

```js
/** Hindi: labels and digits for documents written in Devanagari. */
export default {
  schema: 1,
  id: 'hi',
  scripts: ['Devanagari'],
  ocr: ['hin'],
  digits: { '०': '0', '१': '1', '२': '2', '३': '3', '४': '4', '५': '5', '६': '6', '७': '7', '८': '8', '९': '9' },
  labelSuffixes: ['संख्या', 'नंबर', 'नं.', 'क्रमांक'],
  labels: {
    aadhaar: ['आधार'],
    pan: ['पैन', 'स्थायी लेखा संख्या'],
    phone: ['मोबाइल', 'मोबाईल', 'फ़ोन', 'दूरभाष', 'संपर्क'],
    account: ['खाता'],
    dob: ['जन्म तिथि', 'जन्मतिथि', 'जन्म की तारीख'],
  },
  postalLabels: ['पिन', 'पिन कोड', 'पिनकोड'],
  addressCues: ['मकान', 'फ्लैट', 'गली', 'मार्ग', 'सेक्टर', 'नगर', 'कॉलोनी', 'ग्राम', 'तहसील', 'जिला'],
  places: { IN: ['उत्तर प्रदेश', 'महाराष्ट्र', 'दिल्ली' /* every state and union territory */] },
};
```

| Field | Required | Rule |
| --- | --- | --- |
| `schema` | yes | `1`. Any other value is rejected. |
| `id` | yes | Lowercase language tag. Unique within a scope. |
| `scripts` | yes | Unicode script names the pack covers. Used for coverage warnings. |
| `ocr` | yes | Tesseract codes. Empty for a text-only pack. |
| `digits` | no | Each key and value is exactly one UTF-16 code unit, so offsets do not move. |
| `labels` | no | Keys are known categories. Values are literal text, at least 2 characters. |
| `labelSuffixes` | no | Literal words that may follow a label, such as "No" or "संख्या". |
| `postalLabels` | no | Literal words that introduce a postal code. |
| `addressCues` | no | Literal words that extend an address hit. A cue alone is never a hit. |
| `places` | no | Region id to place names in this language. Used before a postal code. |

All text in a language pack is literal. The engine escapes it and builds the regular expressions. A host pack cannot add a regular expression, which avoids catastrophic backtracking and keeps every match readable in review.

### Region pack

Region packs ship with the library and are not a public format in this version. Each one holds:

- The categories it adds, such as `aadhaar` and `pan` for `IN`.
- A value shape per category, used after a label: a regex source, an optional `validate`, and a confidence.
- Unlabelled rules, such as Aadhaar with the Verhoeff checksum or the US street-suffix rule.
- A postal code shape, such as six digits starting 1-9 for `IN`.
- Place names in English. Language packs add other spellings.

A rule that applies to several regions lists them, so the US street-suffix rule is enabled by `US`, `CA`, or `GB`.

### Universal rules

Some rules do not depend on country or language: email, Luhn-checked cards, masked cards, IBAN, `+` international phone numbers, and secret prefixes. They stay in the engine and run in every scope.

## How rules are compiled

`createDetector` builds one rule list per scope, in this order:

1. Universal rules.
2. Unlabelled rules from each region in scope.
3. Labelled rules. For each category with a value shape in a region in scope, the engine builds one rule from every label for that category in the scoped languages. The pattern is: start boundary, then the labels as alternatives, then optional suffixes, then a separator, then the value as the captured group.
4. Postal rules: postal labels followed by the postal shape, and place names followed by the postal shape.

Rules for building the patterns:

- **Boundaries.** Labels use `(?<![\p{L}\p{M}\p{N}_])` before and `(?![\p{L}\p{M}\p{N}_])` after, with the `u` flag. For ASCII text this matches what `\b` does today. Unlike `\b`, it also works for Devanagari letters and vowel signs.
- **Case.** Labels in scripts with case match without regard to case, as today.
- **Spaces.** A space inside a label matches one or more whitespace characters.
- **Unicode forms.** Each label matches both its composed and decomposed forms, so `फ़` written as one character or as `फ` plus a nukta both match. The document text is never normalized, because normalizing can change its length.
- **Digits.** Before matching, the text is mapped through every `digits` table in scope, one code unit at a time. Hits are offsets into the mapped text, and those offsets are the same in the original text.
- **Dedupe.** Unchanged. Overlaps keep the higher-confidence hit.

## OCR

- The worker's language string is the `ocr` codes of the scoped languages, in scope order, joined with `+`. The default is `eng+hin`.
- The worker is keyed by its core file and its language string. Changing either one ends the old worker and starts a new one.
- If the data file for a scoped language is missing, the scan fails with `Text reading failed: no OCR data for <code>`. It never falls back to fewer languages, because that would miss text silently.
- The confidence filter moves out of `ocr.js` into pure code, so it can be tested in Node. A word is kept when its confidence is at least 45, or when it contains a digit or `@` after digit mapping, or when it starts a label in scope. A Hindi label read at low confidence is kept, so the value after it is still found.
- `scripts/copy-assets.mjs` reads the list of shipped OCR codes from one module and copies `@tesseract.js-data/<code>/4.0.0_best_int/<code>.traineddata.gz` for each. Adding a shipped language does not edit the copy script.
- The `stable` core preference stays the default. The same scope gives the same findings on every machine.

## Coverage warnings

A scan reports when it may be reading a language it does not cover.

- **Text.** When the input has at least 20 letters in a script that no scoped language lists, the result has `{ code: 'uncovered-script', script }`. Latin is covered by `en`.
- **Images and PDFs.** OCR cannot report a script it was not loaded for. Instead, when more than half the words on a page are dropped by the confidence filter, that page gets `{ code: 'low-confidence-page', page }`. The review screen shows it beside the page.
- The command report includes `scope` and `warnings`. Neither contains document text.

## Categories and settings

- `CATEGORIES` stays one global list. Each entry gains `regions`, which is empty for universal categories.
- The scan settings list shows only categories in scope. `prefs/scan.js` builds `SCAN_TYPES` from the detector's `textTypes`. A saved setting for a category outside the scope is kept and ignored, not deleted.
- A category that is new to the scope starts on, as today.
- Category labels stay English.

## Shipped packs

| Pack | Contents |
| --- | --- |
| `en` | Every English label in `patterns.js` today, as literal lists. Fuzzy spellings become explicit variants, such as Aadhaar, Aadhar, Adhaar, and Adhar. |
| `hi` | The pack above, with all 36 states and union territories in Devanagari. |
| `US` | SSN, labelled SSN, NANP phone, street suffix, city and state with ZIP, PO box, routing number. |
| `CA` | Postal code with province, SIN label. Shares the street-suffix rule. |
| `GB` | Postcode. Shares the street-suffix rule. |
| `IN` | Aadhaar, PAN, Indian mobile formats, plus the new rules below. |

New `IN` rules:

- **PIN code.** A postal label followed by six digits starting 1-9, at confidence 0.9. A place name followed by a PIN, at confidence 0.9. A bare six-digit number is never a hit.
- **Landline.** `0`, then an area code, then the subscriber number, with 10 or 11 digits in total, such as `011-23456789`.
- **Masked Aadhaar.** Two masked groups of four, then four digits, such as `XXXX XXXX 1234`, at confidence 0.85. This beats the masked-card rule at 0.8 on the same span.
- **Address cues.** A cue word extends a PIN or labelled address hit on the same line. It does not start one.

## Testing

Tests use `node:test`, like the rest of the suite. Each change adds at most three tests: one happy path and two edge or failure cases.

- **Refactor gate.** After the rules move into packs, `test/patterns.test.js` and `test/transcript.test.js` pass with no edits. That is the proof that default output did not change.
- **Conformance.** `test/fixtures/locales/<id>.json` holds fictional positive and negative strings for each pack. One test function runs every file. A new language adds a fixture file, not test code.
- **End to end.** One fictional Hindi sample image runs through the production harness. The sample generator needs a Devanagari font to draw it. Noto Sans Devanagari (OFL-1.1) is used only to make the sample and does not ship.

## Delivery

Each step is one pull request. The default output stays the same until step 3, which only adds hits.

1. **Move rules into packs.** Add `en`, `US`, `CA`, `GB`, and `IN` with today's rules, and the compiler for the default scope. Accepted when the existing tests pass unchanged.
2. **Scopes.** Add `createDetector`, pack validation, Unicode boundaries, digit mapping, and label form matching. Tests: a Hindi-labelled Aadhaar is found, Devanagari digits keep their offsets, and a pack with a two-unit digit is rejected.
3. **Hindi and India.** Add the `hi` pack and the new `IN` rules. Tests: a PIN after a state name is found, a bare six-digit number is not, and a label inside a longer word does not match.
4. **OCR.** Add the language list, the worker key, the label-aware filter, the missing-data error, the element and React props, and the Vite option. Tests: the language string for a scope, a missing file named in the error, and a low-confidence Hindi label kept.
5. **Warnings and docs.** Add coverage warnings, the command report fields, and updates to the README limits, REQUIREMENTS, and DESIGN. Record the measured download size and first-scan time with `eng+hin`.

## Requirements this keeps

- Scanning works offline. Every OCR file is served from the host's origin.
- Every install uses pinned versions. Added `@tesseract.js-data/*` packages are pinned in the lockfile.
- The browser and the command find the same fields for the same file and scope.
- The same scope gives the same findings on every machine.
- Results never contain matched secrets, document text, or OCR lines.

## Licenses

- Tesseract language data comes from tessdata_best, under Apache-2.0.
- The `@tesseract.js-data/*` npm wrappers are MIT.
- Noto Sans Devanagari is OFL-1.1, used only for test samples.
- Every new language package has its license checked before it is added.

## Open questions

- Should a labelled address line, such as "Address:" or "पता:", redact the rest of the line? It would catch many Indian forms, but it also changes English output and needs a stop rule.
- Should hosts be able to write region packs? That needs a safe format for value shapes and fits with the custom detection rules item.
- Is `eng+hin` acceptable as the default once its size and scan time are measured? If not, the default languages become `['en']` and hosts add `hi`.
