# Requirements

Local redaction of screenshots and PDFs before they are shared. The core is a library: detect private content, redact it, and handle document metadata. The page at the repo root is a harness for the browser components, not a branded product. The next surface is a local tool an AI agent can call, so a document is redacted before any model sees it.

This is a safety net, not a guarantee. A human or a test must still be able to tell when something was missed.

## Library and examples

The core stays free of any one audience. A product such as a legal assistant lives outside it and calls the library.

- ✅ Do not put a brand name, a use-case headline, page copy, colors, or a profile of those into the core. The harness page is not a white-label shell.
- ✅ One Node-safe entry (`src/index.js`, package name `privacy-redact`) exposes text detection, text redaction, and the metadata summary. OCR, faces, barcodes, PDF rendering, and canvas export stay on separate imports so a server does not load a browser.
- ✅ `redactDocument` is the text call. Omit the type list and it uses every text detector the library currently ships. It returns the redacted string and a count per detector. It does not return the matched secrets.
- ✅ An example, or anyone else, imports that entry and calls it. They do not copy detectors or keep their own pattern list. A new or better detector is then used on the next run, with no change in the caller.
- ✅ An example has its own server and its own frontend. It does not add use-case code to the core. It may call the library, the browser components, or, once they exist, the command and the MCP wrapper.
- ✅ The project is not MIT. All rights reserved.

## Current requirements

These describe the browser harness as it works today.

### Input

- ✅ Accept one PNG, JPG, WebP, GIF, BMP, AVIF, or PDF at a time, by file picker, drag-and-drop, or pasted image.
- ✅ Reject HEIC and unknown types with a clear error.
- ✅ Decode images to a canvas, apply EXIF orientation, and flatten transparency onto white.
- ✅ Rasterize PDFs in memory at 144 dpi. Cap a document at 60 pages and say when later pages were dropped.
- ✅ Do not execute JavaScript embedded in a PDF (`isEvalSupported: false`).

### Detection

- ✅ Find these categories and draw a box around each hit:
  - ✅ credit cards (Luhn, plus well-formed groups when OCR slips a digit, plus masked last-four)
  - ✅ SSN / national ID, with invalid ranges rejected
  - ✅ emails
  - ✅ phone numbers (US and international patterns)
  - ✅ street addresses, city/state/ZIP, PO boxes, and Canadian and UK postcodes
  - ✅ labelled account, routing, IBAN, MRN, and policy numbers
  - ✅ dates of birth only when labelled
  - ✅ API keys, tokens, JWTs, and labelled passwords
  - ✅ faces (SSD MobileNet, including a tiled scan on large images)
  - ✅ barcodes and QR codes (native `BarcodeDetector` when present, otherwise ZXing)
- ✅ Run OCR with the English Tesseract model. Upscale small images and invert dark images before OCR.
- ✅ Keep low-confidence OCR words only when they contain a digit or `@`.
- ✅ Do not auto-detect names, license plates, signatures, logos, or company names.

### Review and export

- ✅ Show a live preview. The user can toggle a box, toggle a whole category, draw a manual box, and hold to compare with the original.
- ✅ Offer blur (default), pixelate, and blackout, with a strength control.
- ✅ Blur and pixelate must average pixels into coarse blocks before any smoothing, so the original detail is not still in the file.
- ✅ Save a new file from those pixels. PNG for lossless images, JPG when chosen, and a flattened PDF for PDF input.
- ✅ Do not copy EXIF, GPS, XMP, IPTC, ICC, thumbnails, or PDF info into the output.
- ✅ Re-open the output and report whether metadata is still present.
- ✅ Copy to clipboard writes the redacted PNG only, and only when the user asks.
- ✅ The download name is the original name plus `-redacted`.
- ✅ Show the words the scanner read for the whole document, folded until the user opens it.
- ✅ That reading is redacted by default. The covered fields are the ones still hidden in the preview. A switch shows the original words.
- ✅ One click copies every page of whichever reading is showing. Copy stays off until every page has been read. A document of more than one page keeps its page numbers in that text.

### Privacy of the browser app

- ✅ After the page has loaded, processing a file makes no network request. The only fetch in the app loads a built-in sample from the same origin.
- ✅ Text reading, face finding, and PDF rendering work with no download. Everything they need ships with the install.
- ✅ A production build injects a Content-Security-Policy that allows connections only to the page itself, and blocks forms and plugins.
- ✅ No analytics, cookies, accounts, or telemetry.
- ✅ Dev and preview servers listen on localhost only.

### Known limits that are part of the current contract

- ✅ English-first OCR and address rules.
- ✅ Handwriting, tiny text, rotation, and heavy occlusion can be missed.
- ✅ Exported PDFs are images. The text under a box is gone, and the text is no longer selectable.
- ✅ The first scan loads the models. Later scans in the same tab reuse them.
- ✅ The original canvas and the full OCR lines stay in memory until the user starts a new file or closes the tab. They are not written to disk or IndexedDB.

## Planned

These are harness requirements that are not built yet.

### PDF open password

- On PDF save, an optional open password encrypts the file after redaction. The redactions are painted into new pixels first. The password then locks that flattened PDF. Opening it shows those redacted pages.
- An empty password leaves the export as it is today. PNG and JPG stay unlocked.
- The password is an open password. The file will not open without it. Permission flags alone are not enough.
- Use the password for that save, then drop it. Do not store it, log it, or put it in the filename.
- The metadata check still re-opens the output, with that same password, and reports whether any info fields remain.
- When a dropped PDF is encrypted, ask for its open password before rendering any page. A correct password continues into the same rasterize, detect, and redact path.
- A wrong password asks again and says the password was wrong. Cancel leaves the file unopened. An empty password does not open an encrypted PDF.
- The open password is used for that decrypt, then dropped. It is not stored, logged, or reused as the export password.
- The command does not set a password, prompt for one, or invent one. An encrypted input with no password fails the call.

## Future requirements

Make the same pipeline callable from a command. The scan can run without a person watching. The redacted file and its text stay put until a person has reviewed them and confirmed. An MCP wrapper comes after that command works. The review screen is the one the harness already has, including the manual edits. A host that builds its own screen keeps those edits and the confirm step.

### Tool shape

- The first entry point is a local command. Do not expose it as a network service. MCP, later, is a wrapper around that command.
- Input is a local file path, or bytes the caller already has. Options are categories, style, and strength.
- Propose writes a local session and a short waiting result: counts per category, whether the PDF was truncated at 60 pages, and which detectors failed. It does not write the shareable file.
- Commit, after the person confirms, writes the redacted file and adds whether metadata verified clean.
- The result must not include OCR lines, matched secrets, metadata values, bounding-box crops, or the original bytes.
- Logs and errors must not include file contents, filenames that contain a person's name, or detector text.

### Scan defaults

These apply to propose. They do not release the file.

- All current categories on. No silent way to turn a category off.
- Blackout as the default style. Blur and pixelate remain available when the caller asks.
- If OCR, face detection, or barcode detection fails to load, fail the call. Do not return a file described as redacted.
- If the PDF is longer than 60 pages, say so in the result. Do not imply the rest was processed.
- Scrub the output filename to a neutral name. Do not keep the source name.
- State in the tool description that detection is English-first and does not cover names.

### Same engine, local assets

- A file sent through the command finds the same fields as the same file dropped into the browser app. A rule fixed for one is fixed for both.
- Scanning works offline. The OCR engine, its language data, face models, and PDF fonts come with the install. A scan never downloads them, and never from a third-party host.
- Updating the app or its dependencies must not quietly stop text from being read. If the fastest way to run OCR is not available on a machine, the scan uses a slower one that is. Text reading is reported as failed only when no way works.
- By default, the same document gives the same findings on every machine. A host can choose faster text reading, which may read a few characters differently on different processors.
- Opening a PDF never runs code inside it, and the file is never written to a temporary location to be read.
- Any browser surface that remains keeps the rule that the page can only talk to itself.
- Every install uses the exact package versions the project was tested with.

### What the agent path must not do

- Do not send the original or the redacted image to a model "to check".
- Do not return the words the scanner read, the metadata values, or any debug handle the browser app exposes.
- Do not run the development server as the tool. It is for working on the app, not for processing files.
- Do not let the text reader download its engine or language data from the internet.
- Do not add a clipboard watcher or a folder watcher unless it is a separate, explicit mode. The default tool redacts one file per call.
- Do not set a PDF open password, prompt for one, or invent one. An encrypted input with no password fails the call. The prompt stays on the browser open path, and setting a password stays on the browser Save path.

### Human review

A person confirms every document before it goes to an AI or to another person. The scan is a draft because it will miss some private content.

- Split the work into propose and commit. Propose finds the boxes. Commit paints them and writes the file only after the person confirms.
- Propose writes a local session: the page images and the boxes (position, category, on or off). The session has no OCR transcript and no metadata values.
- The review screen keeps the manual controls the harness has today. The person can turn a box off, turn a whole category off, draw a new box, and hold to compare with the original. Then they save.
- The same screen opens a session and does not scan the file a second time. A host that draws its own screen provides those same controls and still waits for the person to confirm.
- The result returned to the model while the person is editing is the waiting summary. After save, it is the final counts. The original pages are not part of that result.
- Commit checks metadata. A session is temporary and is removed after a successful commit.

## Serious security risks

1. **The output can still contain secrets.** Names are not detected. OCR misses leave the original pixels in place. A category switched off is saved in the clear. Blur at low strength is coarser than a glyph, but it is not the same as a solid fill. Anyone who shares the output is sharing whatever was missed. The scan default is blackout, all categories on, and a result that does not claim the file is clean of every secret. The person still reviews the draft before it is shared.

2. **The tool result is a new way to leak the file.** The browser app keeps OCR text and metadata values in memory and on screen, and does not send them. An agent result, log line, or debug dump would send them to the model provider. The future requirements above are the control.

3. **Tesseract will download its engine unless paths are set.** The browser app sets local paths. The library default fetches the worker, WASM core, and language data from a CDN. A replaced WASM file would be in a position to read the image. The agent entry point must keep using the vendored copies pinned by the lockfile.

4. **Dev mode can still place an outbound request.** The Content-Security-Policy is injected only into production builds. A PDF can contain a URL, and PDF.js may try to fetch it. In dev, that request can reveal that a file was opened, and the machine's address. Real documents go through a production build or the future local tool, not `npm run dev`.

5. **The desktop wrapper is not pinned.** `npm run desktop` and `npm run desktop:pack` download `electron` and `electron-builder` with `npx` at run time. Those tools are not in the lockfile. Do not put real documents through the desktop app until both are pinned. The shell itself is loopback-only, sandboxed, and blocks non-local requests, but that does not cover an unpinned install.

### Residual, not serious on their own

- `?debug` exposes the canvas and full OCR text to scripts in that tab. The production page loads no third-party script. The agent path must not grow an equivalent hook.
- The Electron request filter matches the local origin by string prefix, so a nearby localhost port can match. The production Content-Security-Policy still blocks that request. Fix the filter if the desktop shell is kept.
- `tesseract.js` runs a donation prompt on `npm install`. It does not receive the document.
