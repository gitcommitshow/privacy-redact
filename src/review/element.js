/**
 * `privacy-redact-review` draws its screen in a shadow root. Host CSS, ids, and
 * page-level paste or drop stay outside the element.
 */
import { reviewTemplate } from './template.js';
import { attachController } from './controller.js';
import reviewCss from './review.css?inline';

export const REVIEW_TAG = 'privacy-redact-review';
const STYLES = ['blur', 'pixelate', 'blackout'];

/** Register the review element once. Importing this module also registers it. */
export function defineReviewElement() {
  if (!customElements.get(REVIEW_TAG)) customElements.define(REVIEW_TAG, PiiRedactReview);
}

/** Drop-in review screen: scan, manual edits, and Save. */
class PiiRedactReview extends HTMLElement {
  /** Open a file in this screen. A call before connect waits until the template is stamped. */
  open(file) {
    this._pendingFile = file;
    return this._api ? this._api.open(file) : undefined;
  }

  /** Leave the open file and return to the drop screen. */
  reset() {
    this._pendingFile = null;
    this._api?.reset();
  }

  /** Open or close the field picker. */
  toggleSettings() {
    this._api?.toggleSettings();
  }

  /** Header home: reset an open file, or leave settings. */
  home() {
    this._api?.home();
  }

  /** Redaction style. Named redactStyle because HTMLElement.style is the CSS declaration. */
  get redactStyle() {
    return this._api?.getStyle() ?? this._redactStyle ?? 'blur';
  }

  set redactStyle(value) {
    if (!STYLES.includes(value)) return;
    this._redactStyle = value;
    this._api?.setStyle(value);
  }

  /** Strength from 0 to 1. The slider shows the same value. */
  get strength() {
    return this._api?.getStrength() ?? this._strength ?? 0.65;
  }

  set strength(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return;
    this._strength = Math.min(1, Math.max(0, n));
    this._api?.setStrength(this._strength);
  }

  /** A file assigned here opens in the review flow. */
  get file() {
    return this._pendingFile ?? null;
  }

  set file(value) {
    this.open(value);
  }

  connectedCallback() {
    if (this._api) return;
    if (!this.shadowRoot) this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = reviewCss;
    const markup = document.createElement('template');
    markup.innerHTML = reviewTemplate;
    this.shadowRoot.replaceChildren(style, markup.content.cloneNode(true));
    const strengthAttr = this.getAttribute('strength');
    this._api = attachController(this, {
      style: this._redactStyle || this.getAttribute('redact-style') || undefined,
      strength: this._strength ?? (strengthAttr != null && strengthAttr !== '' ? Number(strengthAttr) : undefined),
    });
    if (this._pendingFile) this._api.open(this._pendingFile);
  }

  /** Drop page listeners when a host removes the element, including a React remount. */
  disconnectedCallback() {
    this._api?.dispose();
    this._api = null;
  }
}

defineReviewElement();
