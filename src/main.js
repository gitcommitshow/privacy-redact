import './style.css';
import './review/element.js';

const BASE = import.meta.env.BASE_URL;
const review = document.querySelector('privacy-redact-review');
const marketing = document.querySelectorAll('#landing > .landing-copy');

/** Show or hide the harness chrome around the review element. */
function applyMode(detail) {
  document.getElementById('btn-reset').hidden = !detail.hasDoc;
  document.getElementById('btn-settings').setAttribute('aria-pressed', String(detail.screen === 'settings'));
  for (const block of marketing) block.hidden = detail.screen !== 'drop';
}

document.getElementById('btn-settings').addEventListener('click', () => review.toggleSettings());
document.getElementById('btn-reset').addEventListener('click', () => review.reset());
document.getElementById('brand').addEventListener('click', (e) => {
  e.preventDefault();
  review.home();
});

review.addEventListener('mode', (e) => applyMode(e.detail));

document.getElementById('samples').addEventListener('click', async (e) => {
  const name = e.target.closest('[data-sample]')?.dataset.sample;
  if (!name) return;
  try {
    const res = await fetch(`${BASE}samples/${name}`);
    if (!res.ok) throw new Error(res.statusText);
    const blob = await res.blob();
    review.open(new File([blob], name, { type: blob.type }));
  } catch {
    const error = review.shadowRoot.querySelector('#landing-error');
    error.textContent = 'Could not load the sample.';
    error.hidden = false;
  }
});
