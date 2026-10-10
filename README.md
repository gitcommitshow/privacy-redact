# privacy-redact

[![npm version](https://img.shields.io/npm/v/privacy-redact)](https://www.npmjs.com/package/privacy-redact)

Detect and redact private data in text, screenshots, and PDFs. It runs locally, and nothing is uploaded.

```bash
npm i privacy-redact
```

Requires Node.js 24 or later. Browser components need Chrome or Edge 119+, Firefox 121+, or Safari 17.4+.

![Before and after: a fictional pay stub with the SSN, address, email, phone, card, account numbers, face, QR code and barcode blurred](docs/before-after.png)

## Quick start

### Text

`privacy-redact` has no browser dependencies, so it runs in a server, a script, or a worker.

```js
import { redactDocument } from 'privacy-redact';

const { text, findings } = redactDocument(
  'Card 4242 4242 4242 4242, contact jane@example.com',
);

console.log(text);
// The card number and the email are replaced with bullet characters.

console.log(findings);
// [{ type: 'card', label: 'Credit cards', count: 1 }, { type: 'email', label: 'Emails', count: 1 }]
```

`findings` gives a count per category. The matched values are not returned.

To check only some categories, pass a list. Leave it out to use every text detector the library ships.

```js
import { redactDocument, TEXT_TYPES } from 'privacy-redact';

redactDocument(text, ['email', 'phone']);
console.log(TEXT_TYPES); // every category the default run checks
```

### Images and PDFs (React)

```jsx
import { PrivacyRedactReview } from 'privacy-redact/react';

export function Attachment({ file, onSave }) {
  return (
    <PrivacyRedactReview
      file={file}
      style="blur"
      strength={0.65}
      onResult={onSave}
    />
  );
}
```

`file` is optional. Without it, the person drops a file into the review screen. `style` is `blur`, `pixelate`, or `blackout`. `strength` runs from 0 to 1.

```js
function onSave({ file, filename, findings, clean, truncated, transcript }) {
  // file: Blob of the redacted image or flattened PDF
  // filename: the original name plus "-redacted"
  // findings: counts per category that are still turned on
  // clean: true when the saved file re-opened with no metadata left
  // truncated: true when a PDF had more than 60 pages
  // transcript: the redacted text read from the document
}
```

`onResult` runs only when the person clicks Save. Dropping a file or finishing a scan does not call it, so the host decides when the file leaves the page.

### Images and PDFs (plain HTML)

```html
<privacy-redact-review redact-style="pixelate" strength="0.8"></privacy-redact-review>

<script type="module">
  import 'privacy-redact/ui';

  document.querySelector('privacy-redact-review')
    .addEventListener('result', (event) => console.log(event.detail.filename));
</script>
```

### Browser setup (Vite)

The review screen reads its OCR, face, and PDF files from `/vendor`. The Vite plugin serves them in development and copies them into the build.

```js
// vite.config.js
import { defineConfig } from 'vite';
import { privacyRedact } from 'privacy-redact/vite';

export default defineConfig({
  plugins: [privacyRedact()],
});
```

A postinstall step copies those files into the package. Installs that skip install scripts (`npm --ignore-scripts`, or pnpm without an allow-list) leave them out, and scans then fail with "Text reading failed".

## API

| Import | Use |
| --- | --- |
| `privacy-redact` | Text detection and redaction. Node-safe. Exports `redactDocument`, `redactPlainText`, `findSensitive`, `TEXT_TYPES`, and `CATEGORIES`. |
| `privacy-redact/react` | `PrivacyRedactReview` React component. Needs React 18 or later. |
| `privacy-redact/ui` | The `privacy-redact-review` custom element, for any framework or none. |
| `privacy-redact/vite` | `privacyRedact()` Vite plugin that serves the OCR, face, and PDF files. |

## What it detects

| Category | Examples |
| --- | --- |
| Credit cards | `4242 4242 4242 4242` (Luhn checked) |
| SSN / national ID | `123-45-6789` |
| Emails | `jane.doe+work@example.co.uk` |
| Phone numbers | `(415) 555-2671`, `+44 20 7946 0958` |
| Home addresses | `742 Evergreen Terrace, Apt 4B`, `Springfield, IL 62704` |
| Account numbers | `Account No: 00123456789`, `Routing # 021000021`, IBANs |
| Aadhaar and PAN | `2341 2341 2346`, `ABCPE1234F` |
| Dates of birth | `DOB: 04/12/1988` (labeled dates only) |
| API keys and tokens | `sk-...`, `AKIA...`, JWTs, `password: ...` |

For images and PDFs, the scan also finds faces, barcodes, and QR codes. More before and after examples are in [docs/EXAMPLES.md](docs/EXAMPLES.md).

## How redaction works

- Images are decoded, read with OCR (Tesseract.js), and scanned for faces (face-api) and codes (ZXing). The text goes through the same rules as `redactDocument`.
- Blur and pixelate average pixels into coarse blocks before any smoothing, so the original detail is discarded. Blackout paints a solid fill.
- The output is a new set of pixels. Nothing is layered under a box.
- Nothing is copied from the source file, so EXIF, GPS, XMP, IPTC, thumbnails, and PDF info do not carry over. The saved file is re-opened and checked, and the result reports that as `clean`.
- PDFs are flattened to images, so the text under a box is gone. The trade-off is that the output is not text-selectable.

## Limitations

privacy-redact is a safety net, not a guarantee. Review the preview before sharing.

- Names, company names, signatures, logos, and license plates are not detected.
- Detection is English-first. OCR uses the English model, and address rules are US, Canada, and UK oriented.
- OCR can miss tiny, low-contrast, rotated, or handwritten text. Small or heavily rotated faces can be missed too.
- HEIC images cannot be decoded in browsers. Convert them to JPG or PNG first.
- PDFs are limited to 60 pages and are exported as images.
- The first OCR or face scan loads about 15 MB of models.

## Privacy

- The text API is plain JavaScript and makes no network calls.
- In the browser, the OCR, face, and PDF files ship with the package and are served from the host's own origin. A scan does not contact another server.
- The original file stays with the host. The package has no telemetry, analytics, or accounts.

## Roadmap

- Command-line tool that scans a local file and writes a draft for review
- MCP wrapper around that command, returning counts rather than file contents
- Text-only install without the OCR, face, and PDF files, for smaller installs
- Custom detection rules passed in by the host
- Optional on-device name and organization detection
- More locales: EU addresses and national IDs, IBAN validation, non-Latin OCR
- License plate and signature detectors
- PDF output that keeps text selectable

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, tests, and how to add a detection rule. To report a way to recover redacted content or leak data, see [SECURITY.md](SECURITY.md). Use a private report, and only share fictional documents.

## Credits

Started from [Hushshot](https://github.com/SYasJ/hushshot) by SYasJ (MIT). Built on [Tesseract.js](https://github.com/naptha/tesseract.js), [face-api](https://github.com/vladmandic/face-api), [ZXing](https://github.com/zxing-js/library), [PDF.js](https://github.com/mozilla/pdf.js), [pdf-lib](https://github.com/Hopding/pdf-lib), and [exifr](https://github.com/MikeKovarik/exifr). Each keeps its own license.

## License

Apache-2.0. See [LICENSE](LICENSE).
