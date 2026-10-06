import { useEffect, useRef, useState } from 'react';
import { STYLES, renderRedactions } from 'privacy-redact/render/effects';
import { Sample, Section } from './parts.jsx';

const STYLE_IDS = Object.keys(STYLES);

/** Paint one rectangle with blur, pixelate, or blackout. */
export function EffectsCase() {
  const canvasRef = useRef(null);
  const [style, setStyle] = useState('blur');
  const [strength, setStrength] = useState(0.65);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const source = document.createElement('canvas');
    source.width = 560;
    source.height = 140;
    const ctx = source.getContext('2d');
    ctx.fillStyle = '#fffaf9';
    ctx.fillRect(0, 0, source.width, source.height);
    ctx.fillStyle = '#292524';
    ctx.font = '22px sans-serif';
    const label = 'Card on file  ';
    const secret = '4242 4242 4242 4242';
    const x0 = 28;
    ctx.fillText(label + secret, x0, 82);
    const x = x0 + ctx.measureText(label).width;
    renderRedactions(canvas, source, [{
      type: 'card',
      x,
      y: 54,
      w: ctx.measureText(secret).width,
      h: 34,
    }], style, Number(strength));
  }, [style, strength]);

  return (
    <Section id="effects" kicker="privacy-redact/render/effects" title="Style">
      <div className="demo">
        <canvas ref={canvasRef} className="paint" width="560" height="140" />
        <div className="seg" role="radiogroup" aria-label="Redaction style">
          {STYLE_IDS.map((id) => (
            <button key={id} type="button" aria-checked={style === id} className={style === id ? 'on' : ''} onClick={() => setStyle(id)}>
              {STYLES[id].label}
            </button>
          ))}
        </div>
        <label className="slider" htmlFor="pg-strength">
          Strength {Number(strength).toFixed(2)}
          <input id="pg-strength" type="range" min="0" max="1" step="0.05" value={strength} onChange={(event) => setStrength(event.target.value)} />
        </label>
      </div>
      <Sample label="renderRedactions" code={`import { renderRedactions } from 'privacy-redact/render/effects';

renderRedactions(target, source, regions, '${style}', ${Number(strength)});`} />
    </Section>
  );
}

/** Classify a local file and show the download name the exporter would use. */
export function FilesCase() {
  const [info, setInfo] = useState(null);
  const [error, setError] = useState('');

  async function onFile(file) {
    setError('');
    try {
      const [{ classify }, { outputName }] = await Promise.all([
        import('privacy-redact/io/loader'),
        import('privacy-redact/io/exporter'),
      ]);
      const kind = classify(file);
      const ext = kind === 'pdf' ? 'pdf' : 'png';
      setInfo({
        name: file.name || 'pasted-image.png',
        kind: kind || 'unsupported',
        output: kind && kind !== 'heic' ? outputName(file.name || 'document', ext) : '',
      });
    } catch (err) {
      setInfo(null);
      setError(err.message || 'Could not read that file name.');
    }
  }

  return (
    <Section id="files" kicker="privacy-redact/io/loader" title="File name">
      <div className="demo">
        <label className="file" htmlFor="pg-classify">File</label>
        <input id="pg-classify" type="file" onChange={(event) => { const file = event.target.files?.[0]; if (file) onFile(file); }} />
        {error ? <p className="error" role="alert">{error}</p> : null}
        {info ? (
          <dl className="pairs">
            <div><dt>classify</dt><dd>{info.kind}</dd></div>
            <div><dt>outputName</dt><dd>{info.output || 'No output name for this type.'}</dd></div>
          </dl>
        ) : null}
      </div>
      <Sample label="loader" code={`import { classify, loadFile, MAX_PDF_PAGES } from 'privacy-redact/io/loader';
import { outputName } from 'privacy-redact/io/exporter';

const kind = classify(file); // 'image' | 'pdf' | 'heic' | null
const loaded = await loadFile(file);
const filename = outputName(loaded.name, loaded.kind === 'pdf' ? 'pdf' : 'png');`} />
    </Section>
  );
}
