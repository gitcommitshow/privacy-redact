/**
 * Thin React mount of `privacy-redact-review`. The screen, its edits, and Save stay in the element.
 */
import { createElement, useEffect, useRef } from 'react';
import './element.js';

/** Drop-in review screen. `onResult` runs when the person saves, and only then. */
export function PrivacyRedactReview({ file, style, strength, actions, onResult }) {
  const ref = useRef(null);
  // Compare the action list by value, so an inline array does not reset the screen on every render.
  const actionsKey = actions ? JSON.stringify(actions) : '';

  useEffect(() => {
    const el = ref.current;
    if (!el || !onResult) return undefined;
    const handle = (event) => onResult(event.detail);
    el.addEventListener('result', handle);
    return () => el.removeEventListener('result', handle);
  }, [onResult]);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof style !== 'string') return;
    el.redactStyle = style;
  }, [style]);

  useEffect(() => {
    const el = ref.current;
    if (!el || strength == null) return;
    el.strength = strength;
  }, [strength]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !file) return;
    el.open(file);
  }, [file]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !actions) return;
    el.actions = actions;
  }, [actionsKey]);

  return createElement('privacy-redact-review', { ref });
}
