import { el, render, store, copy } from '../../lib/ui.js';

const COMMON = [8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 56, 64, 72, 96];
const clean = n => (Number.isFinite(n) ? String(parseFloat(n.toFixed(4))) : '');

export default function (root) {
  const s = store('px-rem');
  let base = s.get('base', 16);

  const baseIn = el('input', { class: 'input', type: 'number', min: 1, step: 'any', value: base, style: { width: '100px' } });
  const px = el('input', { class: 'input', type: 'number', step: 'any', placeholder: 'px', value: 24 });
  const rem = el('input', { class: 'input', type: 'number', step: 'any', placeholder: 'rem', value: '' });
  const em = el('input', { class: 'input', type: 'number', step: 'any', placeholder: 'em', value: '' });
  const tbody = el('tbody');

  const getBase = () => { const b = parseFloat(baseIn.value); return b > 0 ? b : 16; };
  function fromPx() { const b = getBase(), v = parseFloat(px.value); rem.value = clean(v / b); em.value = clean(v / b); }
  function fromRem(src) { const b = getBase(), v = parseFloat(src.value); px.value = clean(v * b); (src === rem ? em : rem).value = clean(v); }
  function table() {
    const b = getBase();
    render(tbody, COMMON.map(p => el('tr', {},
      el('td', { class: 'mono' }, p + 'px'),
      el('td', { class: 'mono' }, clean(p / b) + 'rem'),
      el('td', { class: 'mono' }, clean(p / b) + 'em'),
      el('td', {}, el('button', { class: 'btn small ghost', onclick: () => copy(clean(p / b) + 'rem') }, 'Copy')))));
  }
  const preview = el('div', { style: { overflow: 'hidden' } }, 'The quick brown fox jumps over the lazy dog');
  function updatePreview() { const v = parseFloat(px.value); preview.style.fontSize = (v > 0 ? Math.min(v, 120) : 16) + 'px'; }

  baseIn.addEventListener('input', () => { base = getBase(); s.set('base', base); if (px.value !== '') fromPx(); table(); });
  px.addEventListener('input', () => { fromPx(); updatePreview(); });
  rem.addEventListener('input', () => { fromRem(rem); updatePreview(); });
  em.addEventListener('input', () => { fromRem(em); updatePreview(); });

  const copyBtn = (inp, unit) => el('button', { class: 'btn small', onclick: () => inp.value !== '' && copy(inp.value + unit) }, 'Copy');
  render(root,
    el('div', { class: 'row' }, el('label', { class: 'field' }, 'Base font size (px)', baseIn),
      ...[14, 16, 18, 20].map(b => el('button', { class: 'btn small', style: { alignSelf: 'flex-end' }, onclick: () => { baseIn.value = b; baseIn.dispatchEvent(new Event('input')); } }, b + 'px'))),
    el('div', { class: 'row' },
      el('label', { class: 'field' }, 'Pixels', px), copyBtn(px, 'px'),
      el('label', { class: 'field' }, 'rem', rem), copyBtn(rem, 'rem'),
      el('label', { class: 'field' }, 'em', em), copyBtn(em, 'em')),
    el('div', { class: 'small muted' }, 'em values assume the parent element font size equals the base size. Type in any box and the others update.'),
    el('div', { class: 'panel' }, preview),
    el('div', { class: 'scroll-x' }, el('table', { class: 'table' },
      el('thead', {}, el('tr', {}, el('th', {}, 'Pixels'), el('th', {}, 'rem'), el('th', {}, 'em'), el('th', {}, ''))), tbody)));
  fromPx(); updatePreview(); table();
}
