import { useState } from 'react';
import { CATEGORIES, TEXT_TYPES } from 'privacy-redact';

/** One use case: the story, the live call, and the sample to copy. */
export function Section({ id, kicker, title, children }) {
  return (
    <section id={id} className="case">
      <p className="kicker">{kicker}</p>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

/** Sample a reader pastes into their own project. Folded until they open it. */
export function Sample({ label, code }) {
  const [copied, setCopied] = useState(false);

  async function onCopy(event) {
    event.preventDefault();
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }

  return (
    <details className="sample">
      <summary>{label}</summary>
      <button type="button" onClick={onCopy}>{copied ? 'Copied' : 'Copy'}</button>
      <pre><code>{code}</code></pre>
    </details>
  );
}

/** Background steps. Each status is idle, run, done, or fail. */
export function Track({ where, steps }) {
  return (
    <aside className="track" aria-label={where}>
      <p className="kicker">{where}</p>
      <ol>
        {steps.map((step) => (
          <li key={step.id} data-status={step.status}>
            <i aria-hidden="true" />
            <span>{step.label}</span>
            <span className="detail">{step.detail}</span>
          </li>
        ))}
      </ol>
    </aside>
  );
}

/** Counts per detector. The matched text is not in this list. */
export function Findings({ findings }) {
  if (!findings?.length) return <p className="quiet">No detector reported a hit.</p>;
  return (
    <ul className="findings">
      {findings.map((finding) => (
        <li key={finding.type}>{finding.label}: {finding.count}</li>
      ))}
    </ul>
  );
}

/** Detector checkboxes. `on` maps an id to a boolean. */
export function TypeToggles({ on, onToggle, types = TEXT_TYPES, legend = 'Detectors' }) {
  return (
    <fieldset className="toggles">
      <legend>{legend}</legend>
      {types.map((id) => (
        <label key={id}>
          <input type="checkbox" checked={!!on[id]} onChange={() => onToggle(id)} />
          {CATEGORIES[id]?.label || id}
        </label>
      ))}
    </fieldset>
  );
}

/** True when every listed detector is still checked. */
export function everyTypeOn(on, types) {
  return types.every((id) => on[id]);
}

/** Checked ids, in the library's own order. */
export function pickedTypes(on, types) {
  return types.filter((id) => on[id]);
}
