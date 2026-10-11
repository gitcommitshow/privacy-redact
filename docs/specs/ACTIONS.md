# Review actions

Status: proposed.

Today the review screen ends in one fixed button, "Save sanitized file", which downloads the file and then fires `result`. A host that embeds the screen in a chat app wants that last step to say "Send" or "Attach", to release the redacted text instead of the file, and to look like the rest of the app. This spec lets the host configure the release step, keeps the review step sealed, and states what each side is responsible for.

Product requirements stay in [REQUIREMENTS.md](REQUIREMENTS.md). The shape of the system stays in [DESIGN.md](DESIGN.md). Both get a short update when this ships, because DESIGN.md currently says a host does not replace or restyle any part of the flow.

## What exists today

- `src/review/template.js` hard-codes the export card: a format select, `#btn-save` labelled "Save sanitized file", `#btn-copy` labelled "Copy to clipboard", a save note, and a warning line.
- On Save, `src/review/controller.js` paints the boxes that are on, checks metadata, calls `download()`, shows the save note, and emits `result` with `{ file, filename, findings, clean, truncated, transcript }`.
- Every save downloads a file, even when the host only wants the blob for a chat message.
- `result` always carries both the file and the transcript. The host cannot ask the person which one to send, and the person cannot see what will leave.
- Copy to clipboard writes the current page as PNG. It does not fire `result`, so the host never learns that something left the page.
- The colors are CSS custom properties on `:host` in `src/review/review.css`. A host rule such as `privacy-redact-review { --accent: #2563eb }` already wins over them, because document styles beat `:host` rules. That is not documented, so it is not a supported API yet. There are no `::part` names.
- The redacted transcript is masked by the text rules for the categories that are still on. Boxes the person drew by hand, faces, and barcodes do not mask any text, and a single detected box that the person turned off stays masked in the text. So the text the host receives can contain a name that the person hid by hand in the image. A text-only release would make that gap the whole output, so it is fixed first (see "Text follows the boxes").

## Use cases

| Host | Last step | What leaves |
| --- | --- | --- |
| LLM chat, attach beside a message | "Attach" | File, text, or both. The person picks. |
| LLM chat, send right away | "Send" | Often only the text, which costs fewer tokens and works with text-only models |
| Support ticket or form upload | "Upload" | The file only |
| Notes or document editor | "Insert text" | The text only |
| Standalone tool (the harness) | "Save sanitized file", "Copy to clipboard" | Download, as today |
| Modal in any of the above | "Cancel" | Nothing |
| App with its own composer button | The host's button, outside the element | Whatever the host asks for |

## Who owns what

The line follows one rule: **the library owns everything up to and including the person's confirmation, and the host owns everything after it.**

The library owns:

- Detection, the draft boxes, and every review control: toggle a box, toggle a category, draw a box, hold to compare, style, strength, and the transcript view.
- The confirmation itself. Something leaves only on a click by the person, after the scan is done, and only the outputs that click names.
- Producing the outputs: painting, the metadata check, the redacted text, and making sure the text matches the boxes.
- What the person sees about what will leave: the action label, the "Send as" choice, and the warning line.
- Safe defaults. With no configuration, the screen behaves exactly as it does today.

The host owns:

- What each action is called and what happens after it: send, attach, upload, store, close a modal.
- Which outputs each action may release, and whether the person may choose among them.
- Where the button sits (inside the element or in the host's own UI) and how it looks, within the documented tokens and parts.
- Any network call, retry, or progress after the release.

The person owns:

- Which boxes and categories are on.
- When to release, and, when the host allows it, whether the file, the text, or both leave.

## Goals

- A host sets the label, look, and order of the actions on the review screen.
- A host chooses per action whether the file, the redacted text, both, or nothing is released, and may let the person choose.
- A host action does not download a file unless it asks to.
- A host may put the button in its own UI and still go through the person's click.
- The text released is masked wherever the image is covered.
- Current callers see no change.

## Non-goals

- Hiding or replacing the review controls. The person can always turn a box off, turn a category off, draw a box, and compare.
- Host markup inside the element. Labels are text only. There are no slots for arbitrary HTML, because a host node inside the shadow tree could read the preview or the original transcript.
- Releasing anything before the scan finishes or without a click by the person.
- Releasing the original transcript or the original file through any action.
- Forcing categories on, or blocking a release when a category is off. See open questions.
- Translating the built-in wording. Host labels can be in any language. The rest stays English, as in [LOCALES.md](LOCALES.md).
- More than one document at a time.

## Public API

### Actions

`actions` is a property on the element and a prop on `PrivacyRedactReview`. It is a list. Each entry is either the name of a built-in action or an object for a host action.

```js
const el = document.querySelector('privacy-redact-review');
el.actions = [
  { id: 'attach', label: 'Attach to chat', outputs: ['file', 'text'], choose: true, format: 'png' },
  { id: 'cancel', label: 'Cancel', outputs: [], variant: 'ghost' },
];
```

| Field | Required | Rule |
| --- | --- | --- |
| `id` | yes | Lowercase letters, digits, and `-`. Unique in the list. Returned in `result.action`. |
| `label` | yes | Plain text, 1 to 40 characters. Set with `textContent`, never parsed as HTML. |
| `outputs` | yes | A subset of `['file', 'text']`. An empty list releases nothing and is enabled even during the scan. |
| `choose` | no | When true and `outputs` has two entries, the person picks file, text, or both. Default false. |
| `variant` | no | `primary`, `secondary`, or `ghost`. The first action defaults to `primary`, the rest to `secondary`. At most one `primary`. |
| `format` | no | For images: `png` or `jpeg`. When set, the format select is hidden for this action. PDFs are always a flattened PDF. |
| `busyLabel` | no | Shown while painting. Default "Preparing...". |
| `download` | no | When true, the element also downloads the file, as Save does today. Default false. |

Built-in actions keep today's behavior:

| Name | Equivalent |
| --- | --- |
| `'download'` | `{ id: 'download', label: 'Save sanitized file', outputs: ['file', 'text'], download: true }` |
| `'clipboard'` | Copies the redacted PNG of the current page, as "Copy to clipboard" does today. Hidden for PDFs. Now also fires `result` with `action: 'clipboard'` and no file, so the host knows something left. |

When `actions` is not set, the list is `['download', 'clipboard']`. That is the screen as it is today.

The element rejects an invalid list with a `TypeError` that names the entry and the field, and keeps the previous list. An empty list shows no buttons. That is only useful together with `release()` below.

The warning line, "Auto-detection is good, not perfect...", stays under the actions in every configuration.

### The "Send as" choice

When an action has `choose: true`, the export card shows a small segmented control above the buttons with "Image" (or "PDF"), "Text", and "Both". It starts on "Both". The labels name the redacted output, so the person sees what will leave before they click.

- "Text" and "Both" are disabled until every page has been read. When text reading is off or failed, or found no words, they are disabled with the same reason the transcript panel shows, and the choice falls back to the file.
- When no action has `choose`, the control is hidden.
- An action with `outputs: ['text']` is disabled for the same reasons, with the reason as its tooltip.

### Result

`result` keeps its name and its fields. It gains `action` and `outputs`, and the file fields are present only when the file was released.

```js
function onResult({ action, outputs, file, filename, clean, transcript, findings, truncated }) {
  // action: the id that was clicked, such as 'attach', 'download', or 'cancel'
  // outputs: what was released, such as ['text'] or ['file', 'text']
  // file, filename, clean: present only when outputs includes 'file'
  // transcript: present only when outputs includes 'text'
  // findings, truncated: always present
}
```

- `findings` still counts the boxes that are on. It never contains matched values.
- An action with `outputs: []` fires `result` with `action`, `outputs: []`, and no document data, so a "Cancel" needs no second event.
- With the default actions, Save fires the same fields as today, plus `action: 'download'` and `outputs: ['file', 'text']`.
- When only the text is released, the element does not paint a file.

### A button in the host's UI

Some hosts want the CTA inside their own composer. They set `actions` to the actions they still want inside the element, often an empty list, and call `release()` from their own click handler.

```js
sendButton.addEventListener('click', async () => {
  const result = await el.release({ action: 'send', outputs: ['text'] });
  composer.attachText(result.transcript);
});

el.addEventListener('readychange', (event) => {
  sendButton.disabled = !event.detail.ready;
});
```

- `release({ action, outputs, format })` returns the same object as `result` and also fires `result`.
- It runs only during a click or key press by the person. The element checks `navigator.userActivation.isActive`, which every supported browser has. Without that activation it rejects with a `NotAllowedError` and releases nothing. This keeps the rule that a person confirms every release, even when the host owns the button.
- It rejects with `InvalidStateError` while scanning, while another release is running, or when no document is open.
- `readychange` fires when release becomes possible or impossible. Its detail is `{ ready, file, text, reason }`. `file` and `text` say which outputs can be released right now. `reason` is the same short text the screen shows, such as "Reading the document...".

### Look

The look is set through three things, all documented and kept stable within a major version.

- **Tokens.** The custom properties on `:host` become public: `--canvas`, `--surface`, `--surface-raised`, `--surface-sunken`, `--on-surface`, `--on-surface-muted`, `--on-surface-subtle`, `--accent`, `--accent-hover`, `--good`, `--warn`, `--bad`, `--radius-sm`, `--radius-md`, `--radius-lg`, `--font-ui`, and `--font-display`. A host sets them on the element. The dark values sit behind `prefers-color-scheme`, so a host that themes both modes sets both.
- **Variants.** `primary`, `secondary`, and `ghost` map to the button classes the screen already uses.
- **Parts.** Each action button carries `part="action action-<variant> action-<id>"`. The export card is `part="actions"` and the choice control is `part="send-as"`. A host can then write `privacy-redact-review::part(action-primary) { border-radius: 999px; }`.

Parts are only on the export card. The review controls get no parts, so a host cannot hide them with `display: none`. A host can still hide the whole element, and that is its choice.

### React

```jsx
import { PrivacyRedactReview } from 'privacy-redact/react';

function ChatAttachment({ file, onAttach, onClose }) {
  return (
    <PrivacyRedactReview
      file={file}
      actions={[
        { id: 'attach', label: 'Attach', outputs: ['file', 'text'], choose: true, format: 'png' },
        { id: 'cancel', label: 'Cancel', outputs: [], variant: 'ghost' },
      ]}
      onResult={(result) => (result.action === 'attach' ? onAttach(result) : onClose())}
    />
  );
}
```

- `actions` is applied when its content changes. The React wrapper compares the list by value, so an inline array does not reset the screen on every render.
- A `ref` reaches the element, so `ref.current.release()` works for a host-owned button.
- `onReadyChange` maps to `readychange`.

## Rules the element enforces

These hold for every configuration. Each one is tested.

1. Nothing leaves before the person clicks an action, or before `release()` runs during their click.
2. Nothing that carries document data leaves before the scan is done. "Text" also waits for every page to be read.
3. Only the outputs that the action, or the person's choice within it, names are released.
4. The released text is masked wherever the released image would be covered.
5. The original file, the original transcript, and the OCR lines never appear in `result`.
6. Boxes cannot be edited while a release is painting, so the output matches the screen.
7. No action downloads a file unless it sets `download: true`.

## Text follows the boxes

The released text, the "Redacted" view in the transcript panel, and Copy text all use one function, so what the person reads is what leaves.

- Every OCR word has a box in canvas pixels, the same space as boxes drawn by hand, faces, and barcodes.
- A character is masked when its center lies inside a box that is on, on that page. Character positions are estimated across the word box, the same way `rectForRange` does.
- A space between two masked characters is masked too, so a multi-word value reads as one run of bullets.
- A box that is off, or in a category that is off, is not passed in, so its text shows.
- Values that wrap onto the next line get a box on each line, so both parts are masked.
- The text API in `privacy-redact` does not change. The review element calls `documentTranscript(pages, { redact, boxes })`. Without `boxes`, the rule-based path is unchanged.
- Known gap: a box that covers only the top or bottom part of a word masks none of its characters, because the word's vertical center is outside the box. The image then hides part of the word while the text shows all of it. Open question below.

This changes what `transcript` contains for current callers: words under a box drawn by hand are now masked, and a single box the person turned off is now shown. Both match the image the person saved.

## Alternatives considered

| Option | Why not |
| --- | --- |
| Slots for host buttons or markup inside the element | A host node inside the shadow tree could read the preview canvas and the original transcript. `release()` gives the same placement freedom with no access. |
| A `beforeRelease` callback that can cancel or change the result | It invites hosts to edit the output after the person confirmed it. The host decides what to do with the result after it arrives. |
| Hiding the whole export card and exposing `export()` with no activation check | A host could release without a click, which breaks the human review rule in REQUIREMENTS.md. |
| One `release` attribute for the whole element instead of per action | A chat app often wants "Attach" (file and text) next to "Copy text". Per action is just as easy to read and covers that. |
| A theme object prop | The tokens already exist as custom properties and work with any CSS tooling. A second way to set them would drift. |

## Testing

Tests live under `test/` and run with `npm test`, using the suite's runner. Each step adds at most three tests: one happy path and two edge or failure cases. Pure logic (action validation, the text masking) runs in Node. Browser behavior goes in the e2e harness, in a file that ends in `.e2e.test.js`.

## Delivery

Each step is one pull request.

1. **Text follows the boxes.** In progress. Mask transcript characters by box position, and use it for the panel, Copy text, and `result.transcript`. Tests: a box drawn by hand masks the word under it, a turned-off box shows its text, and boxes from the text rules give the rule-based reading.
2. **Actions.** Add the action list, validation, the built-ins, `result.action` and `result.outputs`, per-action `format`, and no download by default for host actions. The default list keeps the screen as it is. Tests: a text-only action returns text and no file, an invalid list throws and keeps the old one, and the default list still downloads.
3. **Send as and look.** Add `choose`, the disabled reasons, the parts, and the token docs. Tests: "Text" is disabled while a page is unread, and a text-only choice releases no file. The parts get one e2e check.
4. **Host-owned button.** Add `release()`, the activation check, `readychange`, and the React `onReadyChange` and value-compared `actions`. Tests: `release()` from a click works, `release()` from a timer rejects with `NotAllowedError`, and a second call during painting rejects.
5. **Docs.** Update the README React and HTML sections, DESIGN.md "Surface" and "Review element", and REQUIREMENTS.md "Review and export". Add a chat example to the playground.

## Docs to update

- DESIGN.md: the host may configure the release step (labels, outputs, placement, look). The review step stays as it is. The element downloads only for `download` actions.
- REQUIREMENTS.md: copy to clipboard now reports through `result`. The released text follows the boxes, including boxes drawn by hand.
- README: an "LLM chat" example next to the existing React example.

## Licenses

No new dependency. Everything here uses web platform APIs (`::part`, custom properties, `navigator.userActivation`).

## Open questions

- Should a host be able to lock categories on, for example "faces are always hidden in this app"? It fits compliance use, but it takes a control away from the person. If added, it would be a scan scope option next to LOCALES, not part of actions.
- Should a PDF be releasable as one image per page? Many LLM APIs take images but not PDFs. That would be a third output, `pages`, returning a list of PNG or JPEG blobs.
- Should `result` offer `waitUntil(promise)`, so the button stays busy and the review stays locked while the host uploads, and the host's error shows in the save note? It helps "Send" flows, but it ties the element's state to the host's network.
- Should the host be able to hide the "Original" switch on the transcript panel? Copying the original words is the person's choice today, but some hosts may not want it on screen.
- Should the element reset itself after a host action, or leave that to `el.reset()`? This spec leaves it to the host.
- Should a word that is only partly under a box be masked? Options: mask it when the box covers its vertical middle, mask it when the box covers any part of it, or mask the whole word when a box covers at least half of it. The last one matches the image best, and it is the fix for the known gap in "Text follows the boxes".
