import { el, render, store, copy } from '../../lib/ui.js';

function randInt(max) {
  // unbiased random integer in [0, max)
  const lim = Math.floor(0x100000000 / max) * max;
  const buf = new Uint32Array(1);
  do { crypto.getRandomValues(buf); } while (buf[0] >= lim);
  return buf[0] % max;
}
function uuid4() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
const SETS = {
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lower: 'abcdefghijklmnopqrstuvwxyz',
  digits: '0123456789',
  symbols: '!@#$%^&*()-_=+[]{};:,.<>?/~',
};

export default function (root) {
  const s = store('random-generator');
  const st = Object.assign({ kind: 'uuid', count: 5, length: 16, upper: true, lower: true, digits: true, symbols: false, hyphens: true, uppercase: false, braces: false, exclude: false }, s.get('state', {}));
  let results = [];

  const kindSel = el('select', { class: 'select' }, el('option', { value: 'uuid' }, 'UUID v4'), el('option', { value: 'string' }, 'Random string'));
  const count = el('input', { class: 'input', type: 'number', min: 1, max: 500, value: st.count, style: { width: '90px' } });
  const length = el('input', { class: 'input', type: 'number', min: 1, max: 256, value: st.length, style: { width: '90px' } });
  const mkCheck = (key, label) => { const c = el('input', { type: 'checkbox', checked: !!st[key] }); c.addEventListener('change', () => { st[key] = c.checked; generate(); }); return el('label', { class: 'inline' }, c, label); };
  const uuidOpts = el('div', { class: 'row' }, mkCheck('hyphens', 'Hyphens'), mkCheck('uppercase', 'Uppercase'), mkCheck('braces', 'Braces {}'));
  const strOpts = el('div', { class: 'row' },
    el('label', { class: 'field' }, 'Length', length),
    mkCheck('upper', 'A-Z'), mkCheck('lower', 'a-z'), mkCheck('digits', '0-9'), mkCheck('symbols', 'Symbols'),
    mkCheck('exclude', 'Exclude look-alikes (0 O 1 l I)'));
  const outBox = el('textarea', { class: 'textarea mono', readOnly: true, style: { minHeight: '180px' } });
  const msg = el('div', { class: 'small muted' });

  function generate() {
    st.kind = kindSel.value;
    st.count = Math.min(500, Math.max(1, parseInt(count.value, 10) || 1));
    st.length = Math.min(256, Math.max(1, parseInt(length.value, 10) || 1));
    uuidOpts.classList.toggle('hidden', st.kind !== 'uuid');
    strOpts.classList.toggle('hidden', st.kind !== 'string');
    results = [];
    msg.textContent = '';
    if (st.kind === 'uuid') {
      for (let i = 0; i < st.count; i++) {
        let u = uuid4();
        if (!st.hyphens) u = u.replace(/-/g, '');
        if (st.uppercase) u = u.toUpperCase();
        if (st.braces) u = '{' + u + '}';
        results.push(u);
      }
    } else {
      let chars = '';
      for (const k of Object.keys(SETS)) if (st[k]) chars += SETS[k];
      if (st.exclude) chars = chars.replace(/[0O1lI]/g, '');
      if (!chars) msg.textContent = 'Select at least one character set.';
      else {
        for (let i = 0; i < st.count; i++) {
          let r = '';
          for (let j = 0; j < st.length; j++) r += chars[randInt(chars.length)];
          results.push(r);
        }
        msg.textContent = `Alphabet size ${chars.length}, about ${(st.length * Math.log2(chars.length)).toFixed(0)} bits of entropy per string.`;
      }
    }
    outBox.value = results.join('\n');
    s.set('state', st);
  }
  kindSel.value = st.kind;
  kindSel.addEventListener('change', generate);
  count.addEventListener('change', generate);
  length.addEventListener('change', generate);

  render(root,
    el('div', { class: 'row' },
      el('label', { class: 'field' }, 'Type', kindSel),
      el('label', { class: 'field' }, 'How many', count),
      el('button', { class: 'btn primary', onclick: generate }, 'Generate')),
    uuidOpts, strOpts, msg, outBox,
    el('div', { class: 'row' },
      el('button', { class: 'btn primary', onclick: () => results.length && copy(results.join('\n')) }, 'Copy all'),
      el('button', { class: 'btn', onclick: () => results.length && copy(results[0]) }, 'Copy first'),
      el('span', { class: 'small muted' }, 'Uses the browser secure random generator (crypto.getRandomValues).')));
  generate();
}
