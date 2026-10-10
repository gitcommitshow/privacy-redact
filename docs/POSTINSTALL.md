# Postinstall asset copy: limits and options

Status: open note. No code change has been made for this yet.
Owner: whoever touches `scripts/copy-assets.mjs` or `src/detect/ocrCore.js` next.

## What happens today

`package.json` runs `node scripts/copy-assets.mjs` as `postinstall`. The script copies these from `node_modules` into `public/vendor`:

- the Tesseract worker, every LSTM core listed in `OCR_CORE_FILES`, and the English traineddata
- the face-api SSD MobileNet models
- the PDF.js fonts, CMaps, WASM and ICC profiles

The browser app and the Vite plugin in `src/host/assets.js` read from `public/vendor`. `public/vendor` is git-ignored and is not in the package `files` list, so a published package never ships these files. Every consumer depends on the postinstall step creating them.

## Limits we have now

1. **`--ignore-scripts` silently skips the copy.** Installs with `npm --ignore-scripts`, and pnpm 10 and later (which skip dependency install scripts unless allow-listed), leave `public/vendor` empty. Nothing fails at install time. The app then fails at scan time with "Text reading failed".
2. **Missing files only warn.** `copy()` logs `[assets] missing ...` and carries on. A warning in a long install log is easy to miss, and the build still succeeds.
3. **The Vite plugin also fails quietly.** `writeBundle` returns early when `public/vendor` does not exist, and `configResolved` only warns. A host can ship a build with no OCR assets.
4. **A broken import fails the whole install.** The script imports `../src/detect/ocrCore.js`. If that import ever throws, or a future `files` change drops `src`, `npm install` fails for every consumer, not just the OCR feature.
5. **The copy script reaches into `src/`.** It needs `src/detect/ocrCore.js` to stay pure (no DOM, no tesseract.js import). Nothing enforces that today. A later edit could add a browser-only import, and the script would fail at install.
6. **Stale files are never removed.** `cpSync` overwrites, but an old core such as a renamed file stays in `public/vendor` after an upgrade. Harmless, but it hides what is really loaded.
7. **Re-runs are not guaranteed.** Postinstall runs when this package is installed or rebuilt. Upgrading only a sibling package such as `tesseract.js-core` may not re-run it. Do not rely on it re-running.
8. **Hoisted dependencies are found by walking up.** `nm()` searches parent `node_modules` folders. That is right in most layouts, but a pnpm or workspace layout can resolve to a different copy than the one the app actually loads.
9. **No test checks the copy.** `test/ocr-core.test.js` checks the core selection only. Nothing checks that every file in `OCR_CORE_FILES` is present after a copy.

## Alternatives

| Option | What it fixes | What it costs |
| --- | --- | --- |
| A. Keep postinstall, add a check (fail the host build if a required file is missing) | Silent failures in items 2, 3 | Still depends on install scripts being allowed |
| B. Move the core list to a JSON file with no code (for example `src/detect/ocr-cores.json`), read by both the loader and the script | Removes the runtime import from the script (item 4, 5) | Still a relative path, just to data instead of code |
| C. Ship the vendored files inside the tarball, built by a `prepack` script | No install hook needed, works with `--ignore-scripts` and pnpm (items 1, 7) | Larger package. Needs a size check. Must keep the lockfile pin story intact |
| D. Let the host copy at build time through the Vite plugin, from `node_modules`, with no postinstall | Works with install scripts disabled, and the copy runs where the output is produced | Hosts must use the plugin. Non-Vite hosts need a separate step |
| E. Import the core and data as Vite asset URLs (`?url`) from their npm packages | No copy step at all. Vite hashes and emits the files (items 1 to 3, 6, 8) | Needs a spike to confirm the `.wasm.js` and `.gz` files resolve cleanly, and that the worker path still works |
| F. Load from a CDN | Nothing to copy | Breaks the local-first and CSP rules in `docs/REQUIREMENTS.md`. Ruled out |

Options B and D or E look like the best fit for our rule that upgrades must not break the program. C is the strongest choice for library consumers who install with scripts disabled.

## Suggested next steps

1. Add a check in the Vite plugin: fail the build (not just warn) when a required vendor file is missing.
2. Add a test that runs the copy into a temp folder and asserts every file in `OCR_CORE_FILES` exists.
3. Decide between C (ship in tarball) and E (Vite asset URLs) for library consumers. Spike E first, because it may remove the copy step entirely.
4. Document for consumers: which package managers need `onlyBuiltDependencies` or `trustedDependencies` for postinstall to run.
