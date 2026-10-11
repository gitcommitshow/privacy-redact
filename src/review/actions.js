/**
 * Review actions: the release buttons a host can set on the review screen. These are pure rules
 * with no DOM, so the controller and the Node tests share one check.
 */

const OUTPUTS = ['file', 'text'];
const VARIANTS = ['primary', 'secondary', 'ghost'];
const FORMATS = ['png', 'jpeg'];
const ID_PATTERN = /^[a-z0-9-]+$/;
const LABEL_MAX = 40;

/** Input for the built-in name "download", which keeps today's Save button. */
const BUILTIN_DOWNLOAD = {
  id: 'download', label: 'Save sanitized file', outputs: ['file', 'text'], download: true, busyLabel: 'Sanitizing...',
};

/**
 * Check a host action list and fill in the defaults. Throws a TypeError that names the entry and
 * the field, so the caller can keep the list it had before.
 * @param {unknown} list an array of "download" and/or action objects, or null for the default
 * @returns {object[]} normalized actions, in the order given
 */
export function normalizeActions(list) {
  if (list == null) return [normalizeAction('download', 0)];
  if (!Array.isArray(list)) throw new TypeError('actions must be an array of "download" and/or action objects');
  const seen = new Set();
  let primaries = 0;
  return list.map((entry, i) => {
    const action = normalizeAction(entry, i, seen);
    if (action.variant === 'primary') primaries += 1;
    if (primaries > 1) throw new TypeError(`actions[${i}].variant: only one action can be "primary"`);
    return action;
  });
}

/**
 * Check one entry and return it with defaults filled in.
 * @param {unknown} entry the built-in name "download", or an action object
 * @param {number} i position in the list, used for the default variant and error messages
 * @param {Set<string>} [seen] ids already used in this list
 */
function normalizeAction(entry, i, seen = new Set()) {
  const at = `actions[${i}]`;
  const builtin = entry === 'download';
  if (typeof entry === 'string' && !builtin) {
    throw new TypeError(`${at}: unknown built-in "${entry}". The only built-in is "download".`);
  }
  if (!builtin && (!entry || typeof entry !== 'object' || Array.isArray(entry))) {
    throw new TypeError(`${at}: expected "download" or an action object`);
  }
  const src = builtin ? BUILTIN_DOWNLOAD : entry;
  if (!builtin && src.id === 'download') {
    throw new TypeError(`${at}.id: "download" is reserved for the built-in. Use the string "download" instead.`);
  }
  if (typeof src.id !== 'string' || !ID_PATTERN.test(src.id)) {
    throw new TypeError(`${at}.id must use lowercase letters, digits, and "-"`);
  }
  if (seen.has(src.id)) throw new TypeError(`${at}.id "${src.id}" is already used by another action`);
  seen.add(src.id);

  const label = typeof src.label === 'string' ? src.label.trim() : '';
  if (!label || label.length > LABEL_MAX) throw new TypeError(`${at}.label must be 1 to ${LABEL_MAX} characters`);

  const outputs = src.outputs;
  if (!Array.isArray(outputs) || outputs.some((o) => !OUTPUTS.includes(o)) || new Set(outputs).size !== outputs.length) {
    throw new TypeError(`${at}.outputs must list "file" and/or "text", each at most once`);
  }

  const choose = src.choose ?? false;
  if (typeof choose !== 'boolean') throw new TypeError(`${at}.choose must be true or false`);
  if (choose && outputs.length !== 2) throw new TypeError(`${at}.choose needs outputs ["file", "text"]`);

  const variant = src.variant ?? (i === 0 ? 'primary' : 'secondary');
  if (!VARIANTS.includes(variant)) throw new TypeError(`${at}.variant must be "primary", "secondary", or "ghost"`);

  const format = src.format;
  if (format !== undefined && !FORMATS.includes(format)) throw new TypeError(`${at}.format must be "png" or "jpeg"`);
  if (format !== undefined && !outputs.includes('file')) throw new TypeError(`${at}.format needs "file" in outputs`);

  const download = src.download ?? false;
  if (typeof download !== 'boolean') throw new TypeError(`${at}.download must be true or false`);
  if (download && !outputs.includes('file')) throw new TypeError(`${at}.download needs "file" in outputs`);

  const busyLabel = src.busyLabel ?? 'Preparing...';
  if (typeof busyLabel !== 'string' || !busyLabel.trim()) throw new TypeError(`${at}.busyLabel must be text`);

  return { id: src.id, label, outputs: [...outputs], choose, variant, format, busyLabel, download, builtin };
}

/** The built-in Save action, used when the list leaves it out or the screen needs its defaults. */
export function downloadAction() {
  return normalizeAction('download', 0);
}
