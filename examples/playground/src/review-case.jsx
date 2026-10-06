import { useEffect, useRef, useState } from 'react';
import { PrivacyRedactReview } from 'privacy-redact/react';
import { STYLES } from 'privacy-redact/render/effects';
import { Findings, Sample, Section, Track } from './parts.jsx';

const STYLE_IDS = Object.keys(STYLES);
const DROP_TITLE = 'Drop a screenshot';

const PIPELINE = [
  ['decode', 'Decode'],
  ['meta', 'Metadata'],
  ['ocr', 'OCR'],
  ['rules', 'Text rules'],
  ['barcode', 'Barcodes'],
  ['face', 'Faces'],
  ['edit', 'Edit'],
  ['paint', 'Paint'],
  ['check', 'Metadata check'],
  ['result', 'onResult'],
];

/** Idle row for one background step. */
function idleSteps() {
  return PIPELINE.map(([id, label]) => ({ id, label, status: 'idle', detail: '' }));
}

/** True when the visible step list has not changed. */
function sameSteps(prev, next) {
  return prev.length === next.length && prev.every((step, i) => (
    step.id === next[i].id && step.status === next[i].status && step.detail === next[i].detail
  ));
}

/** One step row. */
function row(id, label, status, detail = '') {
  return { id, label, status, detail };
}

/** Read the review element's screen into the step list. */
function readPipeline(root, saved) {
  const view = root.shadowRoot;
  if (!view) return idleSteps();
  const workspace = view.querySelector('#workspace');
  const open = !!(workspace && !workspace.hidden);
  const title = view.querySelector('.dz-title')?.textContent || '';
  const decoding = !open && title && !title.startsWith(DROP_TITLE);
  const scan = root.dataset.scan || '';
  const started = open && (scan === 'running' || scan === 'done');

  const li = (id) => view.querySelector(`#step-${id}`);
  const pass = (id, label) => {
    const node = li(id);
    const detail = node?.querySelector('.r')?.textContent?.trim() || '';
    if (!node) return row(id, label, 'idle', started ? 'off' : '');
    if (node.classList.contains('fail')) return row(id, label, 'fail', detail);
    if (node.classList.contains('done')) return row(id, label, 'done', detail);
    if (node.classList.contains('run')) return row(id, label, 'run', detail);
    return row(id, label, 'idle', detail);
  };

  const ocr = pass('ocr', 'OCR');
  const rulesStatus = ocr.status === 'done' || ocr.status === 'fail' ? ocr.status : 'idle';
  const metaCount = view.querySelectorAll('#meta li').length;
  const editing = open && scan === 'done' && !saved;

  return [
    row('decode', 'Decode', open || saved ? 'done' : decoding ? 'run' : 'idle'),
    row('meta', 'Metadata', open || saved ? 'done' : 'idle', open ? String(metaCount) : ''),
    ocr.status === 'done' ? row('ocr', 'OCR', 'done') : ocr,
    row('rules', 'Text rules', rulesStatus, ocr.status === 'done' ? ocr.detail : ''),
    pass('barcode', 'Barcodes'),
    pass('face', 'Faces'),
    row('edit', 'Edit', saved ? 'done' : editing ? 'run' : 'idle'),
    row('paint', 'Paint', saved ? 'done' : 'idle'),
    row('check', 'Metadata check', saved ? 'done' : 'idle', saved ? (saved.clean ? 'clean' : 'still present') : ''),
    row('result', 'onResult', saved ? 'done' : 'idle'),
  ];
}

/** Mount the review screen and mirror the scan that runs inside it. */
export function ReviewCase() {
  const frameRef = useRef(null);
  const savedRef = useRef(null);
  const [style, setStyle] = useState('blur');
  const [strength, setStrength] = useState(0.65);
  const [steps, setSteps] = useState(idleSteps);
  const [result, setResult] = useState(null);

  useEffect(() => {
    const root = frameRef.current?.querySelector('privacy-redact-review');
    if (!root) return undefined;
    let frame = 0;
    const publish = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const next = readPipeline(root, savedRef.current);
        setSteps((prev) => (sameSteps(prev, next) ? prev : next));
      });
    };
    const onMode = (event) => {
      if (event.detail?.screen === 'drop') {
        savedRef.current = null;
        setResult(null);
      }
      publish();
    };
    const onResult = (event) => {
      savedRef.current = event.detail;
      setResult(event.detail);
      publish();
    };
    const observer = new MutationObserver(publish);
    observer.observe(root, { attributes: true });
    if (root.shadowRoot) observer.observe(root.shadowRoot, { subtree: true, attributes: true, childList: true, characterData: true });
    root.addEventListener('mode', onMode);
    root.addEventListener('result', onResult);
    publish();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      root.removeEventListener('mode', onMode);
      root.removeEventListener('result', onResult);
    };
  }, []);

  return (
    <Section id="review" kicker="Frontend · privacy-redact/react" title="Review a file">
      <p>Runs in this tab. No server. The Vite plugin is what serves the model files.</p>
      <div className="split">
        <div>
          <div className="actions host">
            <label htmlFor="pg-style">Style
              <select id="pg-style" value={style} onChange={(event) => setStyle(event.target.value)}>
                {STYLE_IDS.map((id) => <option key={id} value={id}>{STYLES[id].label}</option>)}
              </select>
            </label>
            <label className="slider" htmlFor="pg-review-strength">
              {Number(strength).toFixed(2)}
              <input id="pg-review-strength" type="range" min="0" max="1" step="0.05" value={strength} onChange={(event) => setStrength(event.target.value)} />
            </label>
          </div>
          <div className="review-frame" ref={frameRef}>
            <PrivacyRedactReview style={style} strength={Number(strength)} />
          </div>
          <ResultCard result={result} />
        </div>
        <Track where="In this tab" steps={steps} />
      </div>
      <Sample label="React" code={`import { privacyRedact } from 'privacy-redact/vite';
import { PrivacyRedactReview } from 'privacy-redact/react';

// vite.config.js
plugins: [privacyRedact()]

<PrivacyRedactReview file={file} style="${style}" strength={${Number(strength)}} onResult={onAttach} />`} />
    </Section>
  );
}

/** The file onResult handed the host after Save. */
function ResultCard({ result }) {
  const [url, setUrl] = useState('');

  useEffect(() => {
    if (!result?.file) return undefined;
    const next = URL.createObjectURL(result.file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [result]);

  if (!result) return null;

  const image = result.file?.type?.startsWith('image/');
  return (
    <div className="out" aria-live="polite">
      <p className="label">{result.filename}</p>
      <Findings findings={result.findings} />
      {image && url ? <img src={url} alt="Redacted file from onResult" /> : null}
      {result.transcript ? <pre>{result.transcript}</pre> : null}
    </div>
  );
}
