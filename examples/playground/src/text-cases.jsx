import { useState } from 'react';
import {
  CATEGORIES, TEXT_TYPES, findSensitive, luhn,
  redactTranscript, documentTranscript, transcriptFromLines, regionsFromLines,
  SCAN_TYPES, defaultScanPrefs, normalizeScanPrefs, enabledTextTypes, enabledSteps,
  summarizeTags,
} from 'privacy-redact';
import { PASSAGE, intakePages } from './fixtures.js';
import { Findings, Sample, Section, Track, TypeToggles, everyTypeOn, pickedTypes } from './parts.jsx';

/** All text detectors on, keyed the way the checkboxes store them. */
function allTextOn() {
  return Object.fromEntries(TEXT_TYPES.map((id) => [id, true]));
}

/** The server call for the detectors the reader currently has checked. */
function redactSnippet(types, allOn) {
  const call = allOn
    ? 'const { text, findings } = redactDocument(passage);'
    : `const { text, findings } = redactDocument(passage, [${types.map((id) => `'${id}'`).join(', ')}]);`;
  return `import { redactDocument } from 'privacy-redact';

${call}`;
}

/** Three server steps. `post` is the in-flight request. `done` is the reply. */
function serverSteps(phase, count) {
  const waiting = [
    { id: 'post', label: 'POST /api/redact', status: 'idle', detail: '' },
    { id: 'call', label: 'redactDocument', status: 'idle', detail: '' },
    { id: 'back', label: 'Counts', status: 'idle', detail: '' },
  ];
  if (phase === 'post') {
    return waiting.map((step) => (step.id === 'back' ? step : { ...step, status: 'run' }));
  }
  if (phase === 'done') {
    return waiting.map((step) => ({
      ...step,
      status: 'done',
      detail: step.id === 'back' ? String(count) : '',
    }));
  }
  return waiting;
}

/** Redact a pasted message on the server before it is stored or sent to a model. */
export function RedactCase() {
  const [draft, setDraft] = useState(PASSAGE);
  const [on, setOn] = useState(allTextOn);
  const [result, setResult] = useState(null);
  const [phase, setPhase] = useState('idle');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const types = pickedTypes(on, TEXT_TYPES);
  const allOn = everyTypeOn(on, TEXT_TYPES);

  function toggle(id) {
    setOn((prev) => ({ ...prev, [id]: !prev[id] }));
    setResult(null);
    setPhase('idle');
  }

  async function onRedact(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    setPhase('post');
    setResult(null);
    try {
      const res = await fetch('/api/redact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(allOn ? { text: draft } : { text: draft, types }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Redaction failed.');
      setResult(data);
      setPhase('done');
    } catch (err) {
      setResult(null);
      setPhase('idle');
      setError(err.message || 'Redaction failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section id="redact" kicker="Backend · privacy-redact" title="Redact a message">
      <form className="split" onSubmit={onRedact}>
        <div className="demo">
          <p className="kicker">In this tab</p>
          <label htmlFor="pg-passage">Passage</label>
          <textarea
            id="pg-passage"
            rows="8"
            value={draft}
            onChange={(event) => { setDraft(event.target.value); setResult(null); setPhase('idle'); }}
          />
          <TypeToggles on={on} onToggle={toggle} />
          <div className="actions">
            <button type="submit" disabled={busy}>{busy ? 'Redacting…' : 'Redact'}</button>
            <button type="button" className="ghost" onClick={() => { setDraft(PASSAGE); setOn(allTextOn()); setResult(null); setPhase('idle'); }}>Sample</button>
          </div>
          {error ? <p className="error" role="alert">{error}</p> : null}
        </div>
        <div className="stack">
          <Track where="On the server" steps={serverSteps(phase, result?.findings?.length || 0)} />
          {result ? (
            <div className="out" aria-live="polite">
              <pre>{result.text || ' '}</pre>
              <Findings findings={result.findings} />
            </div>
          ) : null}
        </div>
      </form>
      <Sample label="server.js" code={redactSnippet(types, allOn)} />
    </Section>
  );
}

/** Paint findSensitive hits on text the page already has. */
export function SpansCase() {
  const [draft, setDraft] = useState(PASSAGE);
  const [on, setOn] = useState(allTextOn);
  const types = pickedTypes(on, TEXT_TYPES);
  const hits = draft ? findSensitive(draft, types) : [];

  return (
    <Section id="spans" kicker="privacy-redact" title="Mark the spans">
      <div className="demo">
        <label htmlFor="pg-spans">Passage</label>
        <textarea id="pg-spans" rows="6" value={draft} onChange={(event) => setDraft(event.target.value)} />
        <TypeToggles on={on} onToggle={(id) => setOn((prev) => ({ ...prev, [id]: !prev[id] }))} />
        <Highlighted text={draft} hits={hits} />
        <HitTable hits={hits} />
      </div>
      <Sample label="findSensitive" code={`import { findSensitive } from 'privacy-redact';

const hits = findSensitive(passage, ['email', 'phone', 'secret']);`} />
    </Section>
  );
}

/** Cover [start, end) ranges. Overlaps are already merged by findSensitive. */
function Highlighted({ text, hits }) {
  const pieces = [];
  let cursor = 0;
  const ordered = [...hits].sort((a, b) => a.start - b.start || a.end - b.end);
  ordered.forEach((hit, index) => {
    const start = Math.max(hit.start, cursor);
    if (start > cursor) pieces.push(text.slice(cursor, start));
    if (hit.end > start) {
      pieces.push(<mark key={`${hit.type}-${index}`} data-type={hit.type}>{text.slice(start, hit.end)}</mark>);
      cursor = hit.end;
    }
  });
  if (cursor < text.length) pieces.push(text.slice(cursor));
  return <p className="marked">{pieces.length ? pieces : 'Type a passage to see the ranges.'}</p>;
}

/** The findSensitive return value, without a column for the matched slice. */
function HitTable({ hits }) {
  if (!hits.length) return <p className="quiet">No ranges for the detectors that are on.</p>;
  return (
    <table>
      <thead>
        <tr><th>type</th><th>start</th><th>end</th><th>confidence</th></tr>
      </thead>
      <tbody>
        {hits.map((hit) => (
          <tr key={`${hit.type}-${hit.start}-${hit.end}`}>
            <td>{CATEGORIES[hit.type]?.label || hit.type}</td>
            <td>{hit.start}</td>
            <td>{hit.end}</td>
            <td>{hit.confidence}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Luhn check, the same one the card detector uses before it keeps a digit run. */
export function LuhnCase() {
  const [raw, setRaw] = useState('4242 4242 4242 4242');
  const digits = raw.replace(/\D/g, '');
  let verdict = 'Enter 13 to 19 digits.';
  if (digits.length > 19) verdict = 'That is longer than a card number.';
  else if (digits.length >= 13) verdict = luhn(digits) ? 'Passes the Luhn check.' : 'Fails the Luhn check.';

  return (
    <Section id="luhn" kicker="privacy-redact" title="Check a card">
      <form className="demo" onSubmit={(event) => event.preventDefault()}>
        <label htmlFor="pg-luhn">Digits</label>
        <input id="pg-luhn" value={raw} onChange={(event) => setRaw(event.target.value)} inputMode="numeric" autoComplete="off" />
        <p className="verdict" role="status">{verdict}</p>
      </form>
      <Sample label="luhn" code={`import { luhn } from 'privacy-redact';

const digits = raw.replace(/\\D/g, '');
const ok = digits.length >= 13 && digits.length <= 19 && luhn(digits);`} />
    </Section>
  );
}

/** Redact words a scanner already produced, including a value split across two rows. */
export function TranscriptCase() {
  const [redact, setRedact] = useState(true);
  const pageOne = redact ? redactTranscript(intakePages[0]) : transcriptFromLines(intakePages[0]);
  const full = documentTranscript(intakePages, { redact });

  return (
    <Section id="transcript" kicker="privacy-redact" title="OCR reading">
      <div className="demo">
        <label className="check">
          <input type="checkbox" checked={redact} onChange={(event) => setRedact(event.target.checked)} />
          Redact the reading
        </label>
        <p className="label">One page, {redact ? 'redactTranscript' : 'transcriptFromLines'}</p>
        <pre>{pageOne}</pre>
        <p className="label">Both pages, documentTranscript</p>
        <pre>{full}</pre>
      </div>
      <Sample label="transcript" code={`import { transcriptFromLines, redactTranscript, documentTranscript } from 'privacy-redact';

const original = transcriptFromLines(lines);
const covered = redactTranscript(lines);
const bothPages = documentTranscript([pageOneLines, pageTwoLines], { redact: true });`} />
    </Section>
  );
}

/** Map the same OCR lines to pixel rectangles. */
export function RegionsCase() {
  const pages = intakePages.map((lines, index) => ({
    index,
    lines,
    regions: regionsFromLines(lines, TEXT_TYPES),
  }));

  return (
    <Section id="regions" kicker="privacy-redact" title="Boxes">
      <div className="demo sketches">
        {pages.map((page) => <PageSketch key={page.index} page={page} />)}
      </div>
      <Sample label="regionsFromLines" code={`import { regionsFromLines, enabledTextTypes } from 'privacy-redact';

const regions = regionsFromLines(lines, enabledTextTypes(prefs));`} />
    </Section>
  );
}

/** One OCR page with the library's boxes drawn on top of the words. */
function PageSketch({ page }) {
  let maxX = 280;
  let maxY = 80;
  for (const line of page.lines) {
    for (const item of line.words) {
      maxX = Math.max(maxX, item.bbox.x1 + 20);
      maxY = Math.max(maxY, item.bbox.y1 + 20);
    }
  }
  return (
    <figure>
      <figcaption>Page {page.index + 1}</figcaption>
      <div className="sheet" style={{ width: maxX, height: maxY }}>
        {page.lines.flatMap((line, lineIndex) => line.words.map((item) => (
          <span
            key={`${lineIndex}-${item.bbox.x0}`}
            className="ocr-word"
            style={{ left: item.bbox.x0, top: item.bbox.y0, height: item.bbox.y1 - item.bbox.y0 }}
          >{item.text}</span>
        )))}
        {page.regions.map((region) => (
          <span
            key={`${region.type}-${region.x}-${region.y}`}
            className="region"
            style={{ left: region.x, top: region.y, width: region.w, height: region.h }}
          >{CATEGORIES[region.type]?.label || region.type}</span>
        ))}
      </div>
    </figure>
  );
}

/** Settings for a scan: which text fields, and which passes actually run. */
export function PrefsCase() {
  const [prefs, setPrefs] = useState(() => defaultScanPrefs());
  const [bad, setBad] = useState(null);
  const text = enabledTextTypes(prefs);
  const steps = enabledSteps(prefs);

  function toggle(id) {
    setBad(null);
    setPrefs((prev) => normalizeScanPrefs({ ...prev, [id]: !prev[id] }));
  }

  function loadBad() {
    const saved = { email: false, face: 'yes', extra: true };
    setBad(saved);
    setPrefs(normalizeScanPrefs(saved));
  }

  return (
    <Section id="prefs" kicker="privacy-redact" title="Scan">
      <div className="demo">
        <TypeToggles on={prefs} onToggle={toggle} types={SCAN_TYPES} legend="Fields" />
        <div className="actions">
          <button type="button" className="ghost" onClick={() => { setBad(null); setPrefs(defaultScanPrefs()); }}>Everything</button>
          <button type="button" className="ghost" onClick={loadBad}>Load a bad save</button>
        </div>
        {bad ? (
          <dl className="pairs">
            <div><dt>saved</dt><dd><code>{JSON.stringify(bad)}</code></dd></div>
            <div><dt>normalized</dt><dd><code>{JSON.stringify(prefs)}</code></dd></div>
          </dl>
        ) : null}
        <dl className="pairs">
          <div><dt>enabledTextTypes</dt><dd>{text.length ? text.join(', ') : 'none, skip OCR'}</dd></div>
          <div><dt>enabledSteps</dt><dd>{steps.length ? steps.join(', ') : 'none'}</dd></div>
        </dl>
      </div>
      <Sample label="scan prefs" code={`import {
  SCAN_TYPES, defaultScanPrefs, normalizeScanPrefs, enabledTextTypes, enabledSteps,
} from 'privacy-redact';

const prefs = normalizeScanPrefs(JSON.parse(saved));
const types = enabledTextTypes(prefs);
const steps = enabledSteps(prefs);`} />
    </Section>
  );
}

/** Turn raw EXIF tags into the short list a person can read before they share a photo. */
export function MetaCase() {
  const [gps, setGps] = useState(true);
  const [serial, setSerial] = useState(true);
  const [fromFile, setFromFile] = useState(null);
  const [note, setNote] = useState('');
  const tags = {
    Make: 'Apple',
    Model: 'iPhone 15 Pro',
    Software: 'Photos 9.0',
    Artist: 'Alex Rivera',
    DateTimeOriginal: '2026-01-02T03:04:05Z',
  };
  if (gps) {
    tags.latitude = 34.0647;
    tags.longitude = -118.2436;
  }
  if (serial) tags.BodySerialNumber = 'F2LXK123';
  const fields = fromFile ? fromFile.fields : summarizeTags(tags);

  async function onFile(file) {
    setNote('');
    const { classify } = await import('privacy-redact/io/loader');
    const kind = classify(file);
    if (kind === 'heic') {
      setFromFile(null);
      setNote('HEIC');
      return;
    }
    if (kind === 'pdf') {
      setFromFile(null);
      setNote('PDF');
      return;
    }
    if (kind !== 'image') {
      setFromFile(null);
      setNote(kind || 'unsupported');
      return;
    }
    const { readImageMetadata } = await import('privacy-redact/io/metadata');
    const meta = await readImageMetadata(file);
    setFromFile(meta);
    setNote(meta.rawCount ? String(meta.rawCount) : '0');
  }

  return (
    <Section id="meta" kicker="privacy-redact" title="Photo tags">
      <div className="demo">
        <div className="actions">
          <label className="check"><input type="checkbox" checked={gps} onChange={(event) => { setGps(event.target.checked); setFromFile(null); }} /> GPS</label>
          <label className="check"><input type="checkbox" checked={serial} onChange={(event) => { setSerial(event.target.checked); setFromFile(null); }} /> Camera serial</label>
          <label className="file">
            Read a local image
            <input
              type="file"
              accept="image/*,application/pdf,.pdf,.heic,.heif"
              onChange={(event) => { const file = event.target.files?.[0]; if (file) onFile(file); }}
            />
          </label>
          {fromFile ? <button type="button" className="ghost" onClick={() => { setFromFile(null); setNote(''); }}>Back to the sample</button> : null}
        </div>
        {note ? <p className="quiet">{note}</p> : null}
        <TagList fields={fields} />
      </div>
      <Sample label="metadata" code={`import { summarizeTags } from 'privacy-redact';
import { readImageMetadata } from 'privacy-redact/io/metadata';

const fields = summarizeTags(tags);
const { fields: fromFile, rawCount } = await readImageMetadata(file);`} />
    </Section>
  );
}

/** The human list from summarizeTags or readImageMetadata. */
function TagList({ fields }) {
  if (!fields.length) return <p className="quiet">None</p>;
  return (
    <ul className="tags">
      {fields.map((field) => (
        <li key={field.label}>
          <span>{field.label}</span>
          <span>{field.value}</span>
          <span className={`risk ${field.risk}`}>{field.risk}</span>
        </li>
      ))}
    </ul>
  );
}
