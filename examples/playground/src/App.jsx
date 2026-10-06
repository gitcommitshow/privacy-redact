import { useEffect, useState } from 'react';
import { RedactCase, SpansCase, LuhnCase, TranscriptCase, RegionsCase, PrefsCase, MetaCase } from './text-cases.jsx';
import { EffectsCase, FilesCase } from './picture-cases.jsx';
import { ReviewCase } from './review-case.jsx';

const NAV = [
  { id: 'review', label: 'Frontend' },
  { id: 'redact', label: 'Backend' },
  { id: 'spans', label: 'Mark spans' },
  { id: 'luhn', label: 'Check a card' },
  { id: 'transcript', label: 'OCR reading' },
  { id: 'regions', label: 'Boxes from OCR' },
  { id: 'prefs', label: 'Choose a scan' },
  { id: 'meta', label: 'Photo tags' },
  { id: 'effects', label: 'Paint a style' },
  { id: 'files', label: 'Name the file' },
];

/** Guide to each privacy-redact call, with the live result beside the sample. */
export function App() {
  const [current, setCurrent] = useState(NAV[0].id);

  useEffect(() => {
    const nodes = NAV.map((item) => document.getElementById(item.id)).filter(Boolean);
    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible?.target?.id) setCurrent(visible.target.id);
    }, { rootMargin: '-15% 0px -55% 0px', threshold: [0.1, 0.25, 0.5] });
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="shell">
      <header className="top">
        <p className="eyebrow">Example host</p>
        <h1>Playground</h1>
        <p className="lede">Drop a file in the browser. Paste a message and the server redacts it.</p>
      </header>
      <div className="body">
        <nav aria-label="Use cases">
          {NAV.map((item) => (
            <a key={item.id} href={`#${item.id}`} aria-current={current === item.id ? 'true' : undefined}>{item.label}</a>
          ))}
        </nav>
        <main>
          <ReviewCase />
          <RedactCase />
          <SpansCase />
          <LuhnCase />
          <TranscriptCase />
          <RegionsCase />
          <PrefsCase />
          <MetaCase />
          <EffectsCase />
          <FilesCase />
        </main>
      </div>
    </div>
  );
}
