# Playground

A small host that links `privacy-redact` and walks through each call. Every section runs live and has the sample a new project can paste.

The page imports the library by name. It does not copy detectors. A better detector in the library shows up the next time this page runs.

| Section | Call | Use it when |
| --- | --- | --- |
| Frontend | `PrivacyRedactReview` from `privacy-redact/react` | Drop an image or PDF. The step list is the scan running in the tab |
| Backend | `redactDocument` | Paste a message. The page posts it, the server redacts it |
| Mark spans | `findSensitive` | Your own editor wants ranges, not a rewritten string |
| Check a card | `luhn` | A form should accept a card number only when the checksum holds |
| OCR reading | `transcriptFromLines`, `redactTranscript`, `documentTranscript` | You already have OCR lines, including a value split across two rows |
| Boxes from OCR | `regionsFromLines` | Those lines need pixel rectangles for the same rules |
| Choose a scan | `defaultScanPrefs`, `normalizeScanPrefs`, `enabledTextTypes`, `enabledSteps` | A settings screen decides which fields and which passes run |
| Photo tags | `summarizeTags`, `readImageMetadata` | A person should see GPS, serials, and author before they share |
| Paint a style | `renderRedactions` | You are drawing blur, pixelate, or blackout on your own canvas |
| File name | `classify`, `loadFile`, `outputName` | You are accepting a drop and choosing the download name |

`server.js` is the text call. `vite.config.js` loads `privacyRedact()` so the review screen can fetch its model files from this origin. `src/review-case.jsx` mounts `PrivacyRedactReview`.

## Run

From the repository root, install once so the model files are copied, then link the package:

```bash
npm install
npm link
```

From this folder:

```bash
npm install
npm link privacy-redact
npm run dev
```

Open `http://127.0.0.1:8791`. `npm install` fetches React and Vite. `privacy-redact` is not published, so it is listed as an optional dependency and `npm link privacy-redact` is what satisfies it. The import name is still `privacy-redact`.

`npm start` serves a production build from `dist/` after `npm run build`.

Text is redacted by `POST /api/redact`. An image or PDF stays in the review screen until the person saves. A file dropped anywhere on the page opens in that screen.
