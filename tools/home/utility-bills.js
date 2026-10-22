import { el, render, store, uid, today } from '../../lib/ui.js';
import { money, N, exportBar, input, sel, drawLines, makeCanvas, legend, COLORS } from './_h.js';

const DEFAULT_TYPES = ['Electricity', 'Water', 'Gas', 'Internet', 'Phone', 'Waste'];
const DEFAULT_UNIT = { electricity: 'kWh', water: 'm3', gas: 'm3' };

export default function (root) {
  const s = store('utility-bills');
  let bills = s.get('bills', []);
  let metric = s.get('metric', 'amount');
  let yearFilter = 'all';
  const save = () => s.set('bills', bills);

  const fType = input({ placeholder: 'Type', style: { width: '130px' } });
  const dl = el('datalist', { id: 'ub-types-' + uid() });
  fType.setAttribute('list', dl.id);
  const fMonth = input({ type: 'month', value: today().slice(0, 7) });
  const fAmt = input({ type: 'number', step: '0.01', min: '0', placeholder: 'Amount', style: { width: '100px' } });
  const fUse = input({ type: 'number', step: 'any', min: '0', placeholder: 'Usage (optional)', style: { width: '130px' } });
  const fUnit = input({ placeholder: 'unit', style: { width: '70px' } });
  fType.addEventListener('change', () => { const u = DEFAULT_UNIT[fType.value.trim().toLowerCase()]; if (u && !fUnit.value) fUnit.value = u; });
  const metricSel = sel([['amount', 'Amount'], ['usage', 'Usage']], metric, { onchange: () => { metric = metricSel.value; s.set('metric', metric); draw(); } });
  const yearSel = el('select', { class: 'select', onchange: () => { yearFilter = yearSel.value; draw(); } });
  const canvas = makeCanvas(800, 320);
  const legBox = el('div');
  const out = el('div');

  function add() {
    const type = fType.value.trim();
    if (!type || !fMonth.value || !fAmt.value) return;
    bills.push({ id: uid(), type, month: fMonth.value, amount: N(fAmt.value), usage: fUse.value === '' ? null : N(fUse.value), unit: fUnit.value.trim() });
    fAmt.value = ''; fUse.value = ''; save(); draw(); fAmt.focus();
  }
  [fType, fAmt, fUse].forEach(f => f.addEventListener('keydown', e => e.key === 'Enter' && add()));

  function monthsRange(a, b) {
    const out = [];
    let [y, m] = a.split('-').map(Number);
    const [y2, m2] = b.split('-').map(Number);
    while (y < y2 || (y === y2 && m <= m2)) { out.push(`${y}-${String(m).padStart(2, '0')}`); m++; if (m > 12) { m = 1; y++; } }
    return out;
  }

  function draw() {
    const types = [...new Set(bills.map(b => b.type))].sort();
    render(dl, [...new Set([...DEFAULT_TYPES, ...types])].map(t => el('option', { value: t })));
    const years = [...new Set(bills.map(b => b.month.slice(0, 4)))].sort();
    const prevYear = yearFilter;
    render(yearSel, [el('option', { value: 'all' }, 'All years'), ...years.map(y => el('option', { value: y }, y))]);
    yearFilter = years.includes(prevYear) ? prevYear : 'all'; yearSel.value = yearFilter;

    const shown = bills.filter(b => yearFilter === 'all' || b.month.startsWith(yearFilter));
    if (shown.length) {
      const sorted = shown.map(b => b.month).sort();
      const months = monthsRange(sorted[0], sorted[sorted.length - 1]);
      const tShown = [...new Set(shown.map(b => b.type))].sort();
      const series = tShown.map((t, i) => ({
        name: t, color: COLORS[i % COLORS.length],
        data: months.map(mo => {
          const f = shown.filter(b => b.type === t && b.month === mo);
          if (!f.length) return null;
          if (metric === 'usage') { const u = f.filter(b => b.usage != null); return u.length ? u.reduce((a, b) => a + b.usage, 0) : null; }
          return f.reduce((a, b) => a + b.amount, 0);
        }),
      })).filter(sr => sr.data.some(v => v != null));
      canvas.classList.remove('hidden');
      drawLines(canvas, months, series.length ? series : [{ name: '', color: COLORS[0], data: months.map(() => null) }], { prefix: metric === 'amount' ? '' : '' });
      render(legBox, series.length ? legend(series) : el('div', { class: 'muted small' }, 'No usage values recorded for this selection.'));
    } else {
      canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
      render(legBox, el('div', { class: 'muted small' }, 'Add bills to see the month-over-month chart.'));
    }

    // yearly totals (all years, regardless of filter)
    const yearRows = years.map(y => {
      const by = {};
      types.forEach(t => { by[t] = bills.filter(b => b.type === t && b.month.startsWith(y)).reduce((a, b) => a + b.amount, 0); });
      return { y, by, total: Object.values(by).reduce((a, b) => a + b, 0) };
    });
    const avg = types.map(t => {
      const bs = bills.filter(b => b.type === t);
      const mons = new Set(bs.map(b => b.month)).size;
      const us = bs.filter(b => b.usage != null);
      return { t, mons, avgAmt: bs.reduce((a, b) => a + b.amount, 0) / (mons || 1), avgUse: us.length ? us.reduce((a, b) => a + b.usage, 0) / new Set(us.map(b => b.month)).size : null, unit: (us[0] || {}).unit || '' };
    });
    render(out,
      types.length ? el('div', {},
        el('h3', {}, 'Yearly totals'),
        el('div', { class: 'scroll-x' }, el('table', { class: 'table' },
          el('thead', {}, el('tr', {}, ['Year', ...types, 'Total'].map(h => el('th', {}, h)))),
          el('tbody', {}, yearRows.map(r => el('tr', {}, el('td', {}, r.y), types.map(t => el('td', {}, money(r.by[t]))), el('td', {}, el('b', {}, money(r.total)))))))),
        el('h3', {}, 'Monthly average'),
        el('div', { class: 'row' }, avg.map(a => el('div', { class: 'stat' }, el('div', { class: 'v' }, money(a.avgAmt)), el('div', { class: 'l' }, a.t + (a.avgUse != null ? ` · ${a.avgUse.toFixed(1)} ${a.unit}` : '') + ` · ${a.mons} mo`))))) : null,
      el('h3', {}, 'All bills'),
      bills.length ? el('div', { class: 'scroll-x', style: { maxHeight: '320px', overflowY: 'auto' } }, el('table', { class: 'table' },
        el('thead', {}, el('tr', {}, ['Month', 'Type', 'Amount', 'Usage', ''].map(h => el('th', {}, h)))),
        el('tbody', {}, [...bills].sort((a, b) => b.month.localeCompare(a.month) || a.type.localeCompare(b.type)).map(b =>
          el('tr', {}, el('td', {}, b.month), el('td', {}, b.type), el('td', {}, money(b.amount)), el('td', {}, b.usage != null ? `${b.usage} ${b.unit || ''}` : ''),
            el('td', {}, el('button', { class: 'btn small ghost', onclick: () => { bills = bills.filter(x => x.id !== b.id); save(); draw(); } }, 'x'))))))) : el('div', { class: 'muted small' }, 'No bills yet.'),
      exportBar('utility-bills',
        () => [['Month', 'Type', 'Amount', 'Usage', 'Unit'], ...bills.map(b => [b.month, b.type, b.amount, b.usage ?? '', b.unit])],
        () => bills));
  }
  render(root,
    el('div', { class: 'row' }, fType, dl, fMonth, fAmt, fUse, fUnit, el('button', { class: 'btn primary', onclick: add }, 'Add bill')),
    el('div', { class: 'row' }, el('label', { class: 'inline' }, 'Chart', metricSel), el('label', { class: 'inline' }, 'Year', yearSel)),
    legBox, el('div', { class: 'canvas-wrap' }, canvas),
    out);
  draw();
}
