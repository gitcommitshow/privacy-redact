/**
 * Review screen controller. Looks up its nodes inside the element root so a host
 * page can mount the same flow without owning the document.
 */
import { CATEGORIES, TEXT_TYPES } from '../detect/patterns.js';
import { regionsFromLines, maskHint, documentTranscript } from '../detect/textRegions.js';
import { renderRedactions } from '../render/effects.js';
import {
  SCAN_TYPES, PICTURE_SCAN_TYPES, loadScanPrefs, saveScanPrefs, defaultScanPrefs,
  normalizeScanPrefs, enabledTextTypes, enabledSteps, emailPhonePrefs, scanScopeText,
} from '../prefs/scan.js';

const TAGS = {
  card: 'Credit card', ssn: 'SSN / ID', email: 'Email', phone: 'Phone', address: 'Address', account: 'Account no.',
  dob: 'Birth date', secret: 'Secret / key', face: 'Face', barcode: 'Barcode / QR', manual: 'Manual',
};
const CAT_ORDER = [...SCAN_TYPES, 'manual'];
const STYLES = ['blur', 'pixelate', 'blackout'];
const DROP_TITLE = 'Drop a screenshot, photo, or PDF here';

/**
 * Bind the review flow to one element. Queries stay in its shadow tree. Page paste
 * is ignored while the person is typing in the host.
 * @param {HTMLElement} host
 * @param {{ style?: string, strength?: number }} [initial]
 */
export function attachController(host, initial = {}) {
  const root = host.shadowRoot;
  const $ = (id) => root.querySelector(`#${id}`);
  /** Events cross the shadow boundary so a host can listen on the element. */
  const emit = (name, detail) => {
    host.dispatchEvent(new CustomEvent(name, { bubbles: true, composed: true, detail }));
  };
  /** Scan progress lives on the element, not on the host document. */
  const setScan = (value) => {
    if (value) host.dataset.scan = value;
    else delete host.dataset.scan;
  };
  /** A span with a class, so the markup strings do not look like JSX to the dev server. */
  const span = (className, text) => {
    const el = document.createElement('span');
    el.className = className;
    if (text) el.textContent = text;
    return el;
  };

  const state = { doc: null, page: 0, style: 'blur', strength: 0.65, catOn: {}, scan: loadScanPrefs(), scanning: false, run: 0, transcriptRedacted: true };
  let nextId = 1;

  const isActive = (r) => state.catOn[r.type] !== false && r.on;
  const cur = () => state.doc.pages[state.page];
  const activeRegions = (p) => p.regions.filter(isActive);
  const preview = $('preview');
  let rafId = 0;
  const schedule = () => { cancelAnimationFrame(rafId); rafId = requestAnimationFrame(renderNow); };

  function toast(msg, ms = 3200) {
    const t = $('toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toast.t);
    toast.t = setTimeout(() => (t.hidden = true), ms);
  }
  function showError(msg) {
    const e = $('landing-error');
    e.textContent = msg; e.hidden = !msg;
  }

  /** Tell the host which screen is showing so it can hide its own marketing. */
  function setScreen(screen) {
    $('review-drop').hidden = screen !== 'drop';
    $('settings').hidden = screen !== 'settings';
    $('workspace').hidden = screen !== 'review';
    host.dataset.screen = screen;
    emit('mode', { screen, hasDoc: !!state.doc });
  }

  function renderNow() {
    if (!state.doc) return;
    const p = cur();
    renderRedactions(preview, p.canvas, activeRegions(p), state.style, state.strength);
  }

  function drawOverlay() {
    const ov = $('overlay');
    ov.replaceChildren();
    if (!state.doc) return;
    const p = cur();
    const W = p.canvas.width, H = p.canvas.height;
    for (const r of p.regions) {
      const el = document.createElement('div');
      el.className = `box ${isActive(r) ? 'on' : 'off'} ${r.type === 'face' ? 'face' : ''} ${r.manual ? 'manual' : ''}`;
      const padX = r.type === 'face' ? r.w * 0.18 : Math.max(3, r.h * 0.18);
      const padY = r.type === 'face' ? r.h * 0.28 : Math.max(2, r.h * 0.14);
      el.style.left = `${((r.x - padX) / W) * 100}%`;
      el.style.top = `${((r.y - padY) / H) * 100}%`;
      el.style.width = `${((r.w + padX * 2) / W) * 100}%`;
      el.style.height = `${((r.h + padY * 2) / H) * 100}%`;
      el.dataset.id = r.id;
      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.textContent = `${TAGS[r.type]}${r.hint ? ' · ' + r.hint : ''}${isActive(r) ? '' : ' · NOT hidden'}`;
      el.append(tag);
      if (r.manual) {
        const x = document.createElement('span');
        x.className = 'x'; x.textContent = '×'; x.title = 'Remove';
        x.dataset.remove = r.id;
        el.append(x);
      }
      ov.append(el);
    }
  }

  function drawCategories() {
    const ul = $('cats');
    ul.replaceChildren();
    const counts = {};
    let total = 0;
    if (state.doc) for (const p of state.doc.pages) for (const r of p.regions) counts[r.type] = (counts[r.type] || 0) + 1;
    const order = CAT_ORDER.filter((t) => (t === 'manual' ? counts.manual : state.scan[t] !== false || counts[t]));
    order.sort((a, b) => (counts[b] ? 1 : 0) - (counts[a] ? 1 : 0) || CAT_ORDER.indexOf(a) - CAT_ORDER.indexOf(b));
    for (const t of order) {
      const n = counts[t] || 0;
      if (state.catOn[t] !== false) total += n;
      const li = document.createElement('li');
      li.className = `cat ${n ? 'has' : 'none'} ${state.catOn[t] !== false ? 'enabled' : ''}`;
      li.dataset.type = t;
      li.setAttribute('role', 'switch');
      li.setAttribute('aria-checked', String(state.catOn[t] !== false));
      li.tabIndex = 0;
      const meta = t === 'manual' ? { icon: '✏️', label: 'Drawn by you' } : CATEGORIES[t];
      li.append(span('ic'), span('lbl'), span('n'), span('switch'));
      li.children[0].textContent = meta.icon;
      li.children[1].textContent = meta.label;
      li.children[2].textContent = n;
      ul.append(li);
    }
    $('scan-count').textContent = total ? `${total} hidden` : '';
    if (!state.scanning && state.doc) $('scan-title').textContent = scanTitle(total);
  }

  /** Title after a scan. An empty field list is not the same as a scan that found nothing. */
  function scanTitle(total) {
    if (!enabledSteps(state.scan).length) return 'Nothing selected to scan';
    return total ? `Shielded ${total} item${total === 1 ? '' : 's'}` : 'Nothing sensitive found';
  }

  function drawMeta() {
    const ul = $('meta');
    ul.replaceChildren();
    const { fields } = state.doc.meta;
    const tag = root.querySelector('#meta-card .tag');
    if (!fields.length) {
      const li = document.createElement('li');
      li.className = 'empty';
      li.textContent = state.doc.kind === 'pdf'
        ? 'No document info found. Pages are flattened, so any hidden text layer is discarded too.'
        : 'No EXIF, GPS or camera data found. The export is metadata-free either way.';
      ul.append(li);
      tag.textContent = 'clean'; tag.className = 'tag ok';
      return;
    }
    tag.textContent = `${fields.length} field${fields.length === 1 ? '' : 's'} will be stripped`;
    tag.className = 'tag warn';
    for (const f of fields) {
      const li = document.createElement('li');
      const k = document.createElement('span'); k.className = 'k'; k.textContent = `${f.icon} ${f.label}`;
      const v = document.createElement('span'); v.className = `v ${f.risk}`; v.textContent = f.value;
      li.append(k, v);
      ul.append(li);
    }
  }

  function drawPageNav() {
    const n = state.doc.pages.length;
    $('pagenav').hidden = n <= 1;
    $('pg-label').textContent = `Page ${state.page + 1} / ${n}`;
    $('pg-prev').disabled = state.page === 0;
    $('pg-next').disabled = state.page === n - 1;
  }

  /** Fold or open the scanner reading without touching the text already filled in. */
  function setTranscriptOpen(open) {
    $('transcript-panel').hidden = !open;
    $('transcript-toggle').setAttribute('aria-expanded', String(open));
    $('transcript-card').classList.toggle('open', open);
  }

  /** Text fields still hidden in the preview. The transcript redaction follows these. */
  function activeTranscriptTypes() {
    return enabledTextTypes(state.scan).filter((id) => state.catOn[id] !== false);
  }

  /** Keep the Redacted switch in step with the reading that will be copied. */
  function syncTranscriptRedact() {
    const on = state.transcriptRedacted !== false;
    const btn = $('transcript-redact');
    btn.setAttribute('aria-checked', String(on));
    btn.classList.toggle('on', on);
    btn.title = on
      ? 'Showing redacted text. Click for the original words.'
      : 'Showing the original words. Click to redact.';
  }

  /**
   * The whole document, redacted or original.
   * Copy stays off until every page has been read, so a paste is never a partial file.
   */
  function transcriptView() {
    const pages = state.doc.pages;
    const textOn = enabledSteps(state.scan).includes('ocr');
    if (!textOn && pages.every((p) => !p.ocr)) {
      return { text: '', empty: 'Text reading is off. Choose fields in Settings, then rescan.', pending: false };
    }
    const pending = textOn && pages.some((p) => !p.ocr);
    const failed = pages.some((p) => p.ocr === 'fail');
    const text = documentTranscript(
      pages.map((p) => (p.ocr === 'done' ? p.lines : [])),
      { redact: state.transcriptRedacted !== false, types: activeTranscriptTypes() },
    );
    if (pending && !text) return { text: '', empty: 'Reading the document…', pending: true };
    if (!text && failed) return { text: '', empty: 'Text reading failed.', pending: false };
    if (!text) return { text: '', empty: 'The scanner did not read any words.', pending: false };
    if (pending) return { text, empty: 'Copy waits until every page has been read.', pending: true };
    return { text, empty: '', pending: false };
  }

  /** Redacted reading for the host. Follows the boxes still on, not the on-screen original switch. */
  function redactedTranscript() {
    return documentTranscript(
      state.doc.pages.map((p) => (p.ocr === 'done' ? p.lines : [])),
      { redact: true, types: activeTranscriptTypes() },
    );
  }

  /** Counts of boxes still turned on, one entry per category that has any. */
  function activeFindings() {
    const counts = {};
    for (const page of state.doc.pages) {
      for (const region of activeRegions(page)) counts[region.type] = (counts[region.type] || 0) + 1;
    }
    return CAT_ORDER.filter((type) => counts[type]).map((type) => ({
      type,
      label: type === 'manual' ? 'Manual' : (CATEGORIES[type]?.label || TAGS[type] || type),
      count: counts[type],
    }));
  }

  /** Fill the folded transcript. Stays closed until the user opens it. */
  function drawTranscript() {
    const pre = $('transcript-text');
    const empty = $('transcript-empty');
    const copy = $('btn-transcript-copy');
    if (!state.doc) {
      pre.textContent = '';
      empty.hidden = true;
      copy.disabled = true;
      copy.textContent = 'Copy text';
      $('transcript-count').textContent = '';
      return;
    }
    const n = state.doc.pages.length;
    $('transcript-label').textContent = 'What the scanner read';
    const view = transcriptView();
    pre.textContent = view.text;
    pre.hidden = !view.text;
    empty.textContent = view.empty;
    empty.hidden = !view.empty;
    copy.disabled = !view.text || view.pending;
    copy.textContent = n > 1 ? 'Copy all' : 'Copy text';
    const lines = view.text ? view.text.split('\n').length : 0;
    const bits = [];
    if (n > 1) bits.push(`${n} pages`);
    if (lines) bits.push(`${lines} line${lines === 1 ? '' : 's'}`);
    $('transcript-count').textContent = bits.join(' · ');
  }

  function refreshAll() { drawOverlay(); drawCategories(); drawTranscript(); schedule(); }

  const STEPS = [
    ['ocr', 'Reading text'],
    ['barcode', 'Barcodes & QR codes'],
    ['face', 'Faces'],
  ];
  /** Detector rows for this preference set, in the same order as STEPS. */
  function stepsFor(prefs) {
    const ids = new Set(enabledSteps(prefs));
    return STEPS.filter(([id]) => ids.has(id));
  }
  function initSteps(steps) {
    const ul = $('steps');
    ul.replaceChildren();
    for (const [id, label] of steps) {
      const li = document.createElement('li');
      li.id = `step-${id}`;
      li.append(span('ic', '○'), span('l'), span('r'));
      li.children[1].textContent = label;
      ul.append(li);
    }
  }
  function setStep(id, status, right = '') {
    const li = $(`step-${id}`);
    if (!li) return;
    li.className = status;
    li.children[0].textContent = status === 'done' ? '✓' : status === 'fail' ? '!' : status === 'run' ? '' : '○';
    li.children[2].textContent = right;
  }

  function finishScan() {
    $('scan-bar').style.width = '100%';
    state.scanning = false;
    $('scan-card').classList.add('done');
    $('scanfx').hidden = true;
    $('btn-save').disabled = false;
    $('btn-copy').disabled = false;
    refreshAll();
    setScan('done');
  }

  async function scanDocument(runId) {
    const doc = state.doc;
    const prefs = normalizeScanPrefs(state.scan);
    const textTypes = enabledTextTypes(prefs);
    const steps = stepsFor(prefs);
    state.scanning = true;
    drawTranscript();
    setScan('running');
    $('scan-card').classList.remove('done');
    $('scan-title').textContent = steps.length ? 'Scanning…' : 'Nothing selected to scan';
    $('scanfx').hidden = !steps.length;
    $('btn-save').disabled = true; $('btn-copy').disabled = true;
    initSteps(steps);
    const scope = scanScopeText(prefs);
    const scopeEl = $('scan-scope');
    scopeEl.textContent = scope;
    scopeEl.hidden = !scope;
    const nPages = doc.pages.length;
    const bar = $('scan-bar');
    const totals = { ocr: 0, barcode: 0, face: 0 };
    const fails = new Set();
    const stale = () => runId !== state.run;
    if (!steps.length) {
      if (!stale()) finishScan();
      return;
    }

    const load = (p) => p.catch((err) => { console.error('[privacy-redact] could not load detector', err); return null; });
    const ids = new Set(steps.map(([id]) => id));
    const [ocrMod, barMod, faceMod] = await Promise.all([
      ids.has('ocr') ? load(import('../detect/ocr.js')) : null,
      ids.has('barcode') ? load(import('../detect/barcodes.js')) : null,
      ids.has('face') ? load(import('../detect/faces.js')) : null,
    ]);
    if (stale()) return;

    const nSteps = steps.length;
    for (let pi = 0; nPages > pi; pi++) {
      const page = doc.pages[pi];
      const suffix = nPages > 1 ? ` · p${pi + 1}/${nPages}` : '';
      const progress = (si, f) => { bar.style.width = `${(((pi * nSteps + si + f) / (nPages * nSteps)) * 100).toFixed(1)}%`; };

      for (let si = 0; nSteps > si; si++) {
        const id = steps[si][0];
        if (fails.has(id)) {
          if (id === 'ocr') page.ocr = 'fail';
          progress(si, 1);
          continue;
        }
        setStep(id, 'run', suffix.replace(' · ', ''));
        progress(si, 0);
        try {
          let found = [];
          if (!{ ocr: ocrMod, barcode: barMod, face: faceMod }[id]) throw new Error('detector not loaded');
          if (id === 'ocr') {
            const lines = await ocrMod.recognizeLines(page.canvas, (f) => !stale() && progress(si, f));
            page.lines = lines;
            page.ocr = 'done';
            found = regionsFromLines(lines, textTypes).map((r) => ({ ...r, hint: maskHint(r.text) }));
          } else if (id === 'barcode') {
            found = (await barMod.detectBarcodes(page.canvas)).map((r) => ({ ...r, type: 'barcode' }));
          } else {
            found = (await faceMod.detectFaces(page.canvas, (f) => !stale() && progress(si, f))).map((r) => ({ ...r, type: 'face' }));
          }
          if (stale()) return;
          for (const r of found) page.regions.push({ id: nextId++, on: true, manual: false, type: r.type, x: r.x, y: r.y, w: r.w, h: r.h, hint: r.hint || '' });
          totals[id] += found.length;
          setStep(id, 'done', `${totals[id]} found`);
          if (pi === state.page) refreshAll(); else drawCategories();
        } catch (err) {
          console.error(`[privacy-redact] ${id} failed`, err);
          fails.add(id);
          if (id === 'ocr') page.ocr = 'fail';
          setStep(id, 'fail', 'unavailable');
          toast(`Couldn’t run ${STEPS.find((s) => s[0] === id)[1].toLowerCase()} detection – you can still draw boxes by hand.`, 5000);
        }
      }
    }
    if (stale()) return;
    finishScan();
  }

  /** Apply a host style before the person edits, and keep the style buttons in step. */
  function setStyle(name) {
    if (!STYLES.includes(name)) return;
    state.style = name;
    for (const button of $('styles').children) {
      const on = button.dataset.style === name;
      button.classList.toggle('on', on);
      button.setAttribute('aria-checked', String(on));
    }
    schedule();
  }

  /** Apply a host strength from 0 to 1 and move the slider to match. */
  function setStrength(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return;
    state.strength = Math.min(1, Math.max(0, n));
    $('strength').value = String(Math.round(state.strength * 100));
    schedule();
  }

  async function openFile(file) {
    if (!file) return;
    showError('');
    const runId = ++state.run;
    $('dropzone').style.opacity = .6;
    try {
      const { loadFile } = await import('../io/loader.js');
      const doc = await loadFile(file, (m) => ($('dropzone').querySelector('.dz-title').textContent = m));
      if (runId !== state.run) return;
      doc.pages = doc.pages.map((canvas) => ({ canvas, regions: [], lines: [], ocr: null }));
      setTranscriptOpen(false);
      state.transcriptRedacted = true;
      syncTranscriptRedact();
      state.doc = doc;
      state.page = 0;
      state.catOn = {};
      if (doc.truncated) toast('Only the first 60 pages were loaded.', 5000);
      setScreen('review');

      const fmt = $('format');
      fmt.replaceChildren();
      const opts = doc.kind === 'pdf'
        ? [['pdf', 'PDF (pages flattened)']]
        : [['png', 'PNG (lossless)'], ['jpeg', 'JPG (smaller)']];
      for (const [v, l] of opts) fmt.append(new Option(l, v));
      fmt.value = doc.kind === 'pdf' ? 'pdf' : (/\.jpe?g$/i.test(doc.name) ? 'jpeg' : 'png');
      $('btn-copy').hidden = doc.kind === 'pdf';
      $('save-note').hidden = true;

      drawMeta();
      drawPageNav();
      preview.width = doc.pages[0].canvas.width;
      preview.height = doc.pages[0].canvas.height;
      refreshAll();
      $('workspace').focus({ preventScroll: true });
      scanDocument(runId);
    } catch (err) {
      console.error(err);
      showError(err.message || 'Could not open that file.');
      $('dropzone').querySelector('.dz-title').textContent = DROP_TITLE;
    } finally {
      $('dropzone').style.opacity = 1;
    }
  }

  function reset() {
    state.run++;
    state.doc = null;
    state.scanning = false;
    setScan('');
    setScreen('drop');
    $('file').value = '';
    $('dropzone').querySelector('.dz-title').textContent = DROP_TITLE;
    $('scanfx').hidden = true;
    setTranscriptOpen(false);
    showError('');
    import('../detect/ocr.js').then((m) => m.disposeOcr()).catch(() => {});
  }

  const fileInput = $('file');
  fileInput.addEventListener('change', () => fileInput.files[0] && openFile(fileInput.files[0]));
  $('dropzone').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); } });

  /** Add a non-interactive group label to the field list. */
  function appendPrefGroup(ul, label) {
    const li = document.createElement('li');
    li.className = 'prefs-group';
    li.textContent = label;
    ul.append(li);
  }

  /** One on/off row for a scannable field. */
  function appendPrefSwitch(ul, id) {
    const on = state.scan[id] !== false;
    const li = document.createElement('li');
    li.className = `cat ${on ? 'enabled' : ''}`;
    li.dataset.type = id;
    li.setAttribute('role', 'switch');
    li.setAttribute('aria-checked', String(on));
    li.tabIndex = 0;
    li.append(span('ic'), span('lbl'), span('switch'));
    li.children[0].textContent = CATEGORIES[id].icon;
    li.children[1].textContent = CATEGORIES[id].label;
    ul.append(li);
  }

  /** Rebuild the settings switches from the saved field set. */
  function drawPrefs() {
    const ul = $('prefs');
    ul.replaceChildren();
    appendPrefGroup(ul, 'Text');
    for (const id of TEXT_TYPES) appendPrefSwitch(ul, id);
    appendPrefGroup(ul, 'Picture');
    for (const id of PICTURE_SCAN_TYPES) appendPrefSwitch(ul, id);
  }

  /** Show rescan only while a file is open, and keep a single primary button. */
  function syncSettingsActions() {
    const hasDoc = !!state.doc;
    $('prefs-rescan').hidden = !hasDoc;
    $('prefs-done').classList.toggle('primary', !hasDoc);
    $('prefs-done').classList.toggle('ghost', hasDoc);
  }

  /** Close settings and return to the open file, or the drop screen. */
  function closeSettings() {
    setScreen(state.doc ? 'review' : 'drop');
  }

  /** Open the field picker. The current file stays in memory. */
  function showSettings() {
    setScreen('settings');
    syncSettingsActions();
    drawPrefs();
    $('settings-title').focus();
  }

  /** Save a new field set and refresh the switches. */
  function applyScanPrefs(next) {
    state.scan = saveScanPrefs(next);
    drawPrefs();
  }

  /** Drop automatic boxes and scan the open file again with the current fields. */
  function rescanCurrent() {
    if (!state.doc) return;
    const runId = ++state.run;
    state.catOn = {};
    for (const page of state.doc.pages) {
      page.regions = page.regions.filter((r) => r.manual);
      page.lines = [];
      page.ocr = null;
      if (page.regions.length) state.catOn.manual = true;
    }
    setScreen('review');
    refreshAll();
    scanDocument(runId);
  }

  function toggleSettings() {
    if ($('settings').hidden) showSettings();
    else closeSettings();
  }

  /** Brand control: leave the open file, or leave settings for the drop screen. */
  function home() {
    if (state.doc) reset();
    else closeSettings();
  }

  $('btn-settings-landing').addEventListener('click', showSettings);
  $('prefs-all').addEventListener('click', () => applyScanPrefs(defaultScanPrefs()));
  $('prefs-email-phone').addEventListener('click', () => applyScanPrefs(emailPhonePrefs()));
  $('prefs-done').addEventListener('click', closeSettings);
  $('prefs-rescan').addEventListener('click', rescanCurrent);
  $('prefs').addEventListener('click', (e) => {
    const li = e.target.closest('.cat');
    if (!li) return;
    const id = li.dataset.type;
    applyScanPrefs({ ...state.scan, [id]: state.scan[id] === false });
  });
  $('prefs').addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('cat')) { e.preventDefault(); e.target.click(); }
  });

  let dragDepth = 0;
  /** True when a file drag is aimed at this element, not at another control on the page. */
  const dragHasFile = (e) => e.dataTransfer?.types?.includes('Files');
  const onDragEnter = (e) => { if (dragHasFile(e)) { dragDepth++; $('dragveil').hidden = false; } };
  const onDragLeave = () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) $('dragveil').hidden = true; };
  const onDragOver = (e) => { if (dragHasFile(e)) e.preventDefault(); };
  const onDrop = (e) => {
    if (!dragHasFile(e)) return;
    e.preventDefault(); dragDepth = 0; $('dragveil').hidden = true;
    const files = [...(e.dataTransfer?.files || [])];
    if (!files.length) return;
    if (files.length > 1) toast('Opened the first file. One document at a time.');
    openFile(files[0]);
  };
  host.addEventListener('dragenter', onDragEnter);
  host.addEventListener('dragleave', onDragLeave);
  host.addEventListener('dragover', onDragOver);
  host.addEventListener('drop', onDrop);

  /** True for a text field. File and range inputs still accept a pasted screenshot. */
  const blocksPaste = (node) => {
    if (!(node instanceof Element)) return false;
    if (node.closest('textarea, select, [contenteditable="true"]')) return true;
    const input = node.closest('input');
    if (!input) return false;
    const type = (input.getAttribute('type') || 'text').toLowerCase();
    return !['file', 'range', 'button', 'checkbox', 'radio', 'hidden'].includes(type);
  };
  /** Paste an image into this screen, and leave text fields on the host page alone. */
  const onPaste = (e) => {
    const node = e.composedPath()[0];
    if (blocksPaste(node)) return;
    const inside = e.composedPath().includes(host);
    if (!inside) {
      const activeHost = document.activeElement?.closest?.('privacy-redact-review');
      if (activeHost && activeHost !== host) return;
      if (!activeHost && document.querySelector('privacy-redact-review') !== host) return;
    }
    const item = [...(e.clipboardData?.items || [])].find((i) => i.kind === 'file' && /^image\//.test(i.type));
    if (!item) return;
    const f = item.getAsFile();
    if (!f) return;
    e.preventDefault();
    openFile(new File([f], `pasted-screenshot.${(f.type.split('/')[1] || 'png').replace('jpeg', 'jpg')}`, { type: f.type }));
  };
  window.addEventListener('paste', onPaste);

  $('cats').addEventListener('click', (e) => {
    const li = e.target.closest('.cat');
    if (!li) return;
    const t = li.dataset.type;
    state.catOn[t] = state.catOn[t] === false;
    refreshAll();
  });
  $('cats').addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('cat')) { e.preventDefault(); e.target.click(); }
  });

  $('styles').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-style]');
    if (!b) return;
    setStyle(b.dataset.style);
  });
  $('strength').addEventListener('input', (e) => { state.strength = e.target.value / 100; schedule(); });

  $('pg-prev').addEventListener('click', () => gotoPage(state.page - 1));
  $('pg-next').addEventListener('click', () => gotoPage(state.page + 1));
  function gotoPage(i) {
    if (!state.doc || 0 > i || i >= state.doc.pages.length) return;
    state.page = i;
    drawPageNav();
    refreshAll();
  }
  const onKey = (e) => {
    const target = e.composedPath()[0];
    if (e.key === 'Escape' && !$('settings').hidden) { e.stopPropagation(); closeSettings(); return; }
    if (!$('settings').hidden) return;
    if (!state.doc) return;
    if (target instanceof Element && /^(INPUT|SELECT|TEXTAREA)$/.test(target.tagName)) return;
    if (e.key === 'ArrowRight') gotoPage(state.page + 1);
    if (e.key === 'ArrowLeft') gotoPage(state.page - 1);
  };
  host.addEventListener('keydown', onKey);
  $('stage').addEventListener('pointerdown', () => { $('workspace').focus({ preventScroll: true }); });

  const peekOn = () => { if (!state.doc) return; $('frame').classList.add('peeking'); preview.getContext('2d').drawImage(cur().canvas, 0, 0); };
  const peekOff = () => { $('frame').classList.remove('peeking'); schedule(); };
  const peek = $('btn-peek');
  peek.addEventListener('pointerdown', (e) => { peek.setPointerCapture(e.pointerId); peekOn(); });
  peek.addEventListener('pointerup', peekOff);
  peek.addEventListener('pointercancel', peekOff);
  peek.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); peekOn(); } });
  peek.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') peekOff(); });

  const overlay = $('overlay');
  overlay.addEventListener('click', (e) => {
    if (!state.doc) return;
    const rm = e.target.closest('[data-remove]');
    const box = e.target.closest('.box');
    if (rm) {
      const p = cur();
      p.regions = p.regions.filter((r) => String(r.id) !== rm.dataset.remove);
      refreshAll();
    } else if (box) {
      const r = cur().regions.find((x) => String(x.id) === box.dataset.id);
      if (r) {
        if (state.catOn[r.type] === false) { state.catOn[r.type] = true; r.on = true; } else r.on = !r.on;
        refreshAll();
      }
    }
  });
  let drag = null;
  overlay.addEventListener('pointerdown', (e) => {
    if (!state.doc || e.target !== overlay || e.button !== 0) return;
    const rect = overlay.getBoundingClientRect();
    drag = { rect, x0: e.clientX - rect.left, y0: e.clientY - rect.top, el: document.createElement('div') };
    drag.el.className = 'box draft';
    overlay.append(drag.el);
    overlay.setPointerCapture(e.pointerId);
  });
  overlay.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const x = Math.max(0, Math.min(drag.rect.width, e.clientX - drag.rect.left));
    const y = Math.max(0, Math.min(drag.rect.height, e.clientY - drag.rect.top));
    Object.assign(drag.el.style, {
      left: `${Math.min(x, drag.x0)}px`, top: `${Math.min(y, drag.y0)}px`,
      width: `${Math.abs(x - drag.x0)}px`, height: `${Math.abs(y - drag.y0)}px`,
    });
  });
  const endDrag = (e) => {
    if (!drag) return;
    const { rect, el } = drag;
    drag = null;
    const w = parseFloat(el.style.width) || 0, h = parseFloat(el.style.height) || 0;
    const l = parseFloat(el.style.left) || 0, t = parseFloat(el.style.top) || 0;
    el.remove();
    if (8 > w || 8 > h || e.type === 'pointercancel') return;
    const p = cur();
    const sx = p.canvas.width / rect.width, sy = p.canvas.height / rect.height;
    p.regions.push({ id: nextId++, type: 'manual', manual: true, on: true, hint: '', x: l * sx, y: t * sy, w: w * sx, h: h * sy });
    state.catOn.manual = true;
    refreshAll();
  };
  overlay.addEventListener('pointerup', endDrag);
  overlay.addEventListener('pointercancel', endDrag);

  $('btn-save').addEventListener('click', async () => {
    if (!state.doc || state.scanning) return;
    const btn = $('btn-save');
    const label = btn.textContent;
    btn.disabled = true; btn.textContent = 'Sanitizing…';
    const note = $('save-note');
    try {
      const ex = await import('../io/exporter.js');
      const opts = { style: state.style, strength: state.strength };
      const pagesIn = state.doc.pages.map((p) => ({ canvas: p.canvas, regions: activeRegions(p) }));
      let res;
      if (state.doc.kind === 'pdf') res = await ex.exportPdf(pagesIn, opts);
      else res = await ex.exportImage(pagesIn[0], { ...opts, format: $('format').value });
      const name = ex.outputName(state.doc.name, res.ext);
      ex.download(res.blob, name);
      const hidden = pagesIn.reduce((n, p) => n + p.regions.length, 0);
      const stripped = state.doc.meta.fields.length;
      note.className = `save-note ${res.clean ? '' : 'bad'}`;
      note.textContent = res.clean
        ? `✓ Saved ${name} · ${hidden} region${hidden === 1 ? '' : 's'} hidden · ${stripped ? stripped + ' metadata field' + (stripped === 1 ? '' : 's') + ' removed · ' : ''}re-checked: 0 metadata fields in the output`
        : `Saved ${name}, but a metadata check still found data. Please report this bug.`;
      note.hidden = false;
      emit('result', {
        file: res.blob,
        filename: name,
        findings: activeFindings(),
        clean: res.clean,
        truncated: !!state.doc.truncated,
        transcript: redactedTranscript(),
      });
    } catch (err) {
      console.error(err);
      note.className = 'save-note bad'; note.textContent = `Export failed: ${err.message}`; note.hidden = false;
    } finally {
      btn.disabled = false; btn.textContent = label;
    }
  });
  $('transcript-toggle').addEventListener('click', () => {
    setTranscriptOpen($('transcript-panel').hidden);
  });

  /** Switch the reading between redacted (default) and the original words. */
  $('transcript-redact').addEventListener('click', () => {
    state.transcriptRedacted = !state.transcriptRedacted;
    syncTranscriptRedact();
    drawTranscript();
  });

  /** Copy every page. Works while the panel is still folded, in whichever mode is showing. */
  $('btn-transcript-copy').addEventListener('click', async () => {
    if (!state.doc) return;
    const view = transcriptView();
    if (!view.text || view.pending) return;
    const kind = state.transcriptRedacted !== false ? 'Redacted' : 'Original';
    try {
      await navigator.clipboard.writeText(view.text);
      toast(`${kind} transcript copied.`);
    } catch (err) {
      console.error(err);
      toast('Your browser blocked clipboard access. Expand the transcript and select the text.', 4500);
    }
  });

  $('btn-copy').addEventListener('click', async () => {
    if (!state.doc || state.scanning) return;
    try {
      const ex = await import('../io/exporter.js');
      const res = await ex.exportImage({ canvas: cur().canvas, regions: activeRegions(cur()) }, { style: state.style, strength: state.strength, format: 'png' });
      await ex.copyImage(res.blob);
      toast('Copied. Paste it into the destination.');
    } catch (err) {
      console.error(err);
      toast('Your browser blocked clipboard access – use Save instead.', 4500);
    }
  });

  if (new URLSearchParams(location.search).has('debug')) window.__privacyRedact = {
    state,
    detectFaces: async (...a) => (await import('../detect/faces.js')).detectFaces(...a),
    detectBarcodes: async (...a) => (await import('../detect/barcodes.js')).detectBarcodes(...a),
  };

  if (initial.style) setStyle(initial.style);
  if (initial.strength != null) setStrength(initial.strength);
  setScreen('drop');

  return {
    open: openFile,
    reset,
    toggleSettings,
    home,
    setStyle,
    setStrength,
    getStyle: () => state.style,
    getStrength: () => state.strength,
    /** Release page listeners. The element calls this when it leaves the document. */
    dispose() {
      cancelAnimationFrame(rafId);
      clearTimeout(toast.t);
      window.removeEventListener('paste', onPaste);
      host.removeEventListener('dragenter', onDragEnter);
      host.removeEventListener('dragleave', onDragLeave);
      host.removeEventListener('dragover', onDragOver);
      host.removeEventListener('drop', onDrop);
      host.removeEventListener('keydown', onKey);
    },
  };
}
