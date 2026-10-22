import { el, render, store, copy, stat } from '../../lib/ui.js';

const DIG = '0123456789abcdefghijklmnopqrstuvwxyz';

function parse(text, base) {
  let t = text.replace(/[\s_,]/g, '').toLowerCase();
  if (!t) return { empty: true };
  let neg = false;
  if (t[0] === '-') { neg = true; t = t.slice(1); } else if (t[0] === '+') t = t.slice(1);
  const pre = { 2: '0b', 8: '0o', 16: '0x' }[base];
  if (pre && t.startsWith(pre)) t = t.slice(2);
  if (!t) return { error: 'Enter some digits.' };
  const b = BigInt(base);
  let acc = 0n;
  for (const ch of t) {
    const d = DIG.indexOf(ch);
    if (d < 0 || d >= base) return { error: `"${ch}" is not a valid base-${base} digit.` };
    acc = acc * b + BigInt(d);
  }
  return { value: neg ? -acc : acc };
}
function group(str, size) {
  const out = [];
  for (let i = str.length; i > 0; i -= size) out.unshift(str.slice(Math.max(0, i - size), i));
  return out;
}

export default function (root) {
  const s = store('base-converter');
  const defs = [['bin', 'Binary (2)', 2], ['oct', 'Octal (8)', 8], ['dec', 'Decimal (10)', 10], ['hex', 'Hexadecimal (16)', 16]];
  const inputs = {};
  for (const [k] of defs) inputs[k] = el('input', { class: 'input mono', type: 'text', spellcheck: 'false', autocomplete: 'off', style: { width: '100%' } });
  const customBase = el('input', { class: 'input', type: 'number', min: 2, max: 36, value: s.get('cbase', 36), style: { width: '80px' } });
  const customOut = el('input', { class: 'input mono', type: 'text', spellcheck: 'false', style: { width: '100%' } });
  const groupSel = el('select', { class: 'select' },
    el('option', { value: '4' }, 'Groups of 4 bits'), el('option', { value: '8' }, 'Groups of 8 bits (bytes)'), el('option', { value: '16' }, 'Groups of 16 bits'));
  groupSel.value = String(s.get('group', '4'));
  const errBox = el('div', { class: 'small', style: { color: 'var(--danger)', minHeight: '1.4em' } });
  const bits = el('pre', { class: 'out mono' });
  const stats = el('div', { class: 'row' });
  const twos = el('div', { class: 'small muted' });
  const cbase = () => Math.min(36, Math.max(2, parseInt(customBase.value) || 36));

  function fill(v, except) {
    for (const [k, , base] of defs) if (k !== except) inputs[k].value = v === null ? '' : v.toString(base);
    if (except !== 'custom') customOut.value = v === null ? '' : v.toString(cbase());
    show(v);
  }
  function show(v) {
    if (v === null) { render(stats); bits.textContent = ''; twos.textContent = ''; return; }
    const neg = v < 0n, a = neg ? -v : v;
    const bin = a.toString(2);
    const n = bin.length;
    const gs = parseInt(groupSel.value);
    const padded = bin.padStart(Math.ceil(n / gs) * gs, '0');
    const hex = a.toString(16).padStart(Math.ceil(padded.length / 4), '0');
    render(stats, stat(n, 'bits'), stat(Math.ceil(n / 8), 'bytes'), stat(a.toString().length, 'decimal digits'),
      stat(neg ? 'negative' : (a % 2n === 0n ? 'even' : 'odd'), 'sign / parity'));
    const sign = neg ? '-' : '';
    bits.textContent = sign + 'bin  ' + group(padded, gs).join(' ') + '\n' +
      sign + 'hex  ' + group(hex, Math.max(1, gs / 4)).join(' ') + '\n' +
      sign + 'oct  ' + a.toString(8);
    if (neg) {
      let w = 8; while (w < 8192 && -(1n << BigInt(w - 1)) > v) w *= 2;
      const tc = (1n << BigInt(w)) + v;
      twos.textContent = `Two's complement (${w}-bit): ` + group(tc.toString(2).padStart(w, '0'), gs).join(' ') + '  (0x' + tc.toString(16).toUpperCase() + ')';
    } else twos.textContent = '';
  }
  function accept(r, except) {
    if (r.empty) { errBox.textContent = ''; fill(null, except); s.set('dec', ''); return; }
    if (r.error) { errBox.textContent = r.error; return; }
    errBox.textContent = '';
    fill(r.value, except);
    s.set('dec', r.value.toString());
  }
  function clearAll() {
    for (const i of Object.values(inputs)) i.value = '';
    customOut.value = ''; errBox.textContent = ''; show(null); s.set('dec', '');
  }
  for (const [k, , base] of defs) {
    inputs[k].addEventListener('input', () => accept(parse(inputs[k].value, base), k));
    inputs[k].addEventListener('keydown', e => { if (e.key === 'Escape') clearAll(); });
  }
  customOut.addEventListener('input', () => accept(parse(customOut.value, cbase()), 'custom'));
  customBase.addEventListener('input', () => {
    s.set('cbase', cbase());
    const r = parse(inputs.dec.value, 10);
    if (r.value !== undefined) fill(r.value);
  });
  groupSel.addEventListener('change', () => {
    s.set('group', groupSel.value);
    const r = parse(inputs.dec.value, 10);
    if (r.value !== undefined) show(r.value);
  });

  const fieldFor = ([k, label]) => el('div', { class: 'col' },
    el('label', { class: 'field' }, label, inputs[k]),
    el('div', {}, el('button', { class: 'btn small ghost', onclick: () => inputs[k].value && copy(inputs[k].value) }, 'Copy')));

  render(root,
    el('div', { class: 'grid2' }, defs.map(fieldFor)),
    el('div', { class: 'row' }, el('label', { class: 'inline' }, 'Custom base', customBase), el('div', { class: 'grow' }, customOut)),
    errBox, stats,
    el('div', { class: 'row' }, groupSel, el('button', { class: 'btn ghost', onclick: clearAll }, 'Clear')),
    bits, twos,
    el('p', { class: 'small muted' }, 'Arbitrarily large integers are supported (BigInt). Prefixes 0b, 0o, 0x, spaces and underscores are accepted; a leading minus sign works too. Esc clears.'));
  const saved = s.get('dec', '255');
  if (saved) { try { inputs.dec.value = saved; fill(BigInt(saved), 'dec'); } catch { inputs.dec.value = ''; } }
}
