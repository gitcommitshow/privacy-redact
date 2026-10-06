/** Working review markup stamped into the shadow tree. Ids stay local to that tree. */
export const reviewTemplate = `
<div id="review-drop">
  <label id="dropzone" class="dropzone" tabindex="0">
    <input id="file" type="file" accept="image/*,application/pdf,.pdf" hidden />
    <div class="dz-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5"/><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></svg>
    </div>
    <div class="dz-title">Drop a screenshot, photo, or PDF here</div>
    <div class="dz-sub">or <u>browse</u> · or paste with <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>V</kbd></div>
    <div class="dz-formats">PNG · JPG · WebP · GIF · PDF</div>
  </label>
  <div class="settings-cue">
    <button id="btn-settings-landing" class="btn ghost sm" type="button">Choose fields to scan</button>
  </div>
  <div id="landing-error" class="error" role="alert" hidden></div>
</div>

<section id="settings" hidden aria-labelledby="settings-title">
  <div class="settings-wrap">
    <h1 id="settings-title" tabindex="-1">What to scan for</h1>
    <p class="lede">Choose what the next scan looks for. Text fields share one reading pass. Faces and barcodes are separate passes, and they are skipped when off. Anything you turn off is left visible in the saved file.</p>
    <div class="card">
      <div class="card-head">
        <h2>Fields</h2>
        <div class="settings-presets">
          <button id="prefs-all" class="btn ghost sm" type="button">Everything</button>
          <button id="prefs-email-phone" class="btn ghost sm" type="button">Email and phone</button>
        </div>
      </div>
      <ul id="prefs" class="cats"></ul>
      <p class="fine settings-note">Saved in this browser only. Open a file again, or rescan, to use a change.</p>
    </div>
    <div class="settings-actions">
      <button id="prefs-done" class="btn primary" type="button">Done</button>
      <button id="prefs-rescan" class="btn primary" type="button" hidden>Rescan current file</button>
    </div>
  </div>
</section>

<section id="workspace" hidden tabindex="-1">
  <div class="stage-col">
    <div id="stage" class="stage">
      <div id="frame" class="frame">
        <canvas id="preview"></canvas>
        <div id="overlay" class="overlay"></div>
        <div id="scanfx" class="scanfx" hidden><i></i></div>
      </div>
    </div>
    <div class="stage-bar">
      <div id="pagenav" class="pagenav" hidden>
        <button id="pg-prev" class="btn ghost sm" aria-label="Previous page">‹</button>
        <span id="pg-label">Page 1 / 1</span>
        <button id="pg-next" class="btn ghost sm" aria-label="Next page">›</button>
      </div>
      <div class="hint" id="stage-hint">Click a box to toggle it · drag on the image to hide anything else</div>
      <button id="btn-peek" class="btn ghost sm" title="Hold to see the original">👁 Hold to compare</button>
    </div>
  </div>

  <aside class="panel">
    <div class="card" id="scan-card">
      <div class="card-head"><h2 id="scan-title">Scanning…</h2><span id="scan-count" class="count-badge"></span></div>
      <ul id="steps" class="scan-steps"></ul>
      <p id="scan-scope" class="fine" hidden></p>
      <div class="bar"><i id="scan-bar"></i></div>
    </div>

    <div class="card transcript" id="transcript-card">
      <div class="transcript-head">
        <button type="button" id="transcript-toggle" class="transcript-toggle" aria-expanded="false" aria-controls="transcript-panel">
          <span class="twist" aria-hidden="true"></span>
          <span id="transcript-label">What the scanner read</span>
        </button>
        <span class="transcript-actions">
          <button type="button" id="transcript-redact" class="transcript-redact on" role="switch" aria-checked="true" title="Hide the words the scanner would cover">Redacted</button>
          <span id="transcript-count" class="count-badge"></span>
          <button id="btn-transcript-copy" class="btn ghost sm" type="button" disabled>Copy text</button>
        </span>
      </div>
      <div id="transcript-panel" hidden>
        <p id="transcript-empty" class="fine" hidden></p>
        <pre id="transcript-text"></pre>
      </div>
    </div>

    <div class="card">
      <div class="card-head"><h2>What gets hidden</h2></div>
      <ul id="cats" class="cats"></ul>
    </div>

    <div class="card">
      <div class="card-head"><h2>Style</h2></div>
      <div class="seg" id="styles" role="radiogroup" aria-label="Redaction style">
        <button data-style="blur" class="on" role="radio" aria-checked="true">Blur</button>
        <button data-style="pixelate" role="radio" aria-checked="false">Pixelate</button>
        <button data-style="blackout" role="radio" aria-checked="false">Blackout</button>
      </div>
      <label class="slider"><span>Strength</span><input id="strength" type="range" min="0" max="100" value="65" /></label>
    </div>

    <div class="card" id="meta-card">
      <div class="card-head"><h2>Hidden metadata</h2><span class="tag ok">will be stripped</span></div>
      <ul id="meta" class="meta"></ul>
    </div>

    <div class="card export">
      <div class="row">
        <label class="fmt" id="fmt-wrap"><span>Format</span>
          <select id="format"><option value="png">PNG (lossless)</option><option value="jpeg">JPG (smaller)</option></select>
        </label>
      </div>
      <button id="btn-save" class="btn primary big">Save sanitized file</button>
      <button id="btn-copy" class="btn ghost wide">Copy to clipboard</button>
      <div id="save-note" class="save-note" hidden></div>
      <p class="fine">Auto-detection is good, not perfect. Give the preview a quick look before you share.</p>
    </div>
  </aside>
</section>

<div id="toast" class="toast" role="status" aria-live="polite" hidden></div>
<div id="dragveil" class="dragveil" hidden><div>Drop to redact</div></div>
`;
