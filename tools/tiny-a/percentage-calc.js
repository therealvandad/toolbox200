import { el, render, store, copy } from '../../lib/ui.js';

const fmt = n => {
  if (!Number.isFinite(n)) return 'undefined';
  return parseFloat(n.toFixed(6)).toLocaleString(undefined, { maximumFractionDigits: 6 });
};

const MODES = [
  { id: 'of', a: 'What is', b: '% of', labels: ['X', 'Y'], compute: (x, y) => ({ val: x / 100 * y, text: v => `${fmt(x)}% of ${fmt(y)} is ${fmt(v)}`, plain: v => fmt(v) }) },
  { id: 'whatpct', a: '', b: 'is what % of', labels: ['X', 'Y'], compute: (x, y) => ({ val: x / y * 100, text: v => `${fmt(x)} is ${fmt(v)}% of ${fmt(y)}`, plain: v => fmt(v) + '%' }) },
  { id: 'change', a: '% change from', b: 'to', labels: ['X', 'Y'], compute: (x, y) => ({ val: (y - x) / Math.abs(x) * 100, text: v => `From ${fmt(x)} to ${fmt(y)} is ${v >= 0 ? 'an increase' : 'a decrease'} of ${fmt(Math.abs(v))}%`, plain: v => fmt(v) + '%' }) },
  { id: 'inc', a: 'Increase', b: 'by', c: '%', labels: ['X', 'Y'], compute: (x, y) => ({ val: x * (1 + y / 100), text: v => `${fmt(x)} increased by ${fmt(y)}% is ${fmt(v)}`, plain: v => fmt(v) }) },
  { id: 'dec', a: 'Decrease', b: 'by', c: '%', labels: ['X', 'Y'], compute: (x, y) => ({ val: x * (1 - y / 100), text: v => `${fmt(x)} decreased by ${fmt(y)}% is ${fmt(v)}`, plain: v => fmt(v) }) },
];

export default function (root) {
  const s = store('percentage-calc');
  const saved = s.get('vals', {});
  const defaults = { of: [15, 200], whatpct: [30, 120], change: [80, 100], inc: [50, 20], dec: [50, 20] };

  const rows = MODES.map(m => {
    const [dx, dy] = saved[m.id] || defaults[m.id];
    const x = el('input', { class: 'input', type: 'number', step: 'any', value: dx, style: { width: '110px' } });
    const y = el('input', { class: 'input', type: 'number', step: 'any', value: dy, style: { width: '110px' } });
    const res = el('div', { class: 'big', style: { fontSize: '22px' } });
    const sentence = el('div', { class: 'small muted' });
    const btn = el('button', { class: 'btn small', onclick: () => { if (m._plain) copy(m._plain); } }, 'Copy');
    function update() {
      const xv = parseFloat(x.value), yv = parseFloat(y.value);
      if (!Number.isFinite(xv) || !Number.isFinite(yv)) { res.textContent = '...'; sentence.textContent = 'Enter both numbers.'; m._plain = ''; return; }
      const r = m.compute(xv, yv);
      if (!Number.isFinite(r.val)) { res.textContent = 'Undefined'; sentence.textContent = 'Cannot divide by zero.'; m._plain = ''; return; }
      res.textContent = r.plain(r.val);
      sentence.textContent = r.text(r.val);
      m._plain = r.plain(r.val);
      saved[m.id] = [x.value, y.value];
      s.set('vals', saved);
    }
    x.addEventListener('input', update); y.addEventListener('input', update);
    update();
    return el('div', { class: 'panel' },
      el('div', { class: 'row', style: { margin: 0 } },
        m.a ? el('span', {}, m.a) : null, x, el('span', {}, m.b), y, m.c ? el('span', {}, m.c) : el('span', {}, m.id === 'of' ? '?' : (m.id === 'whatpct' ? '?' : '?')),
        el('span', { class: 'grow' }), btn),
      el('div', { class: 'row', style: { margin: '6px 0 0' } }, el('span', { class: 'muted' }, '='), res),
      sentence);
  });
  render(root, rows);
}
