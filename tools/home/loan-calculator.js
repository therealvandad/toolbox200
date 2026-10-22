import { el, render, store, stat } from '../../lib/ui.js';
import { money, N, exportBar, input, drawLines, makeCanvas, legend, COLORS } from './_h.js';

// Build an amortization schedule. Returns { payment, rows:[{n,pay,interest,principal,balance}], interest }
export function schedule(P, annualRate, years, extra = 0) {
  const n = Math.round(years * 12);
  const i = annualRate / 100 / 12;
  if (P <= 0 || n <= 0) return { payment: 0, rows: [], interest: 0 };
  const payment = i === 0 ? P / n : P * i / (1 - Math.pow(1 + i, -n));
  const rows = [];
  let bal = P, totalInt = 0;
  for (let k = 1; k <= n * 3 && bal > 0.005; k++) {
    const interest = bal * i;
    let pay = payment + extra;
    if (pay > bal + interest) pay = bal + interest;
    const principal = pay - interest;
    bal = Math.max(0, bal - principal);
    totalInt += interest;
    rows.push({ n: k, pay, interest, principal, balance: bal });
    if (pay < interest - 1e-9) break;
  }
  return { payment, rows, interest: totalInt };
}

export default function (root) {
  const s = store('loan-calculator');
  const v = Object.assign({ amount: 250000, rate: 6.5, years: 30, extra: 200, yearly: true }, s.get('v', {}));
  const fA = input({ type: 'number', min: '0', step: '100', value: v.amount });
  const fR = input({ type: 'number', min: '0', step: '0.05', value: v.rate });
  const fY = input({ type: 'number', min: '1', max: '50', step: '1', value: v.years });
  const fE = input({ type: 'number', min: '0', step: '10', value: v.extra });
  const chk = el('input', { type: 'checkbox', checked: v.yearly, onchange: () => update() });
  const summary = el('div');
  const canvas = makeCanvas(800, 320);
  const tableBox = el('div', { class: 'scroll-x', style: { maxHeight: '420px', overflowY: 'auto' } });
  let base, ex;

  function fmtDur(m) { const y = Math.floor(m / 12), r = m % 12; return (y ? y + ' y ' : '') + r + ' m'; }

  function update() {
    v.amount = N(fA.value); v.rate = N(fR.value); v.years = N(fY.value); v.extra = N(fE.value); v.yearly = chk.checked;
    s.set('v', v);
    base = schedule(v.amount, v.rate, v.years, 0);
    ex = schedule(v.amount, v.rate, v.years, v.extra);
    const withExtra = v.extra > 0;
    render(summary,
      el('div', { class: 'row' },
        stat(money(base.payment), 'monthly payment'),
        stat(money(base.interest), 'total interest'),
        stat(money(v.amount + base.interest), 'total paid'),
        stat(fmtDur(base.rows.length), 'time to payoff')),
      withExtra ? el('div', { class: 'panel' },
        el('b', {}, `With ${money(v.extra)} extra per month`),
        el('div', { class: 'row' },
          stat(money(base.payment + v.extra), 'monthly payment'),
          stat(money(ex.interest), 'total interest'),
          stat(fmtDur(ex.rows.length), 'time to payoff'),
          stat(money(base.interest - ex.interest), 'interest saved'),
          stat(fmtDur(base.rows.length - ex.rows.length), 'time saved'))) : null);
    const n = base.rows.length;
    const labels = [], d1 = [], d2 = [];
    const step = Math.max(1, Math.ceil(n / 60));
    const ks = [];
    for (let k = 0; k < n; k += step) ks.push(k);
    if (n > 0) ks.push(n);
    for (const k of ks) {
      labels.push(k % 12 === 0 ? 'Y' + (k / 12) : 'M' + k);
      d1.push(k === 0 ? v.amount : base.rows[k - 1].balance);
      d2.push(k === 0 ? v.amount : (ex.rows[k - 1] ? ex.rows[k - 1].balance : 0));
    }
    const series = [{ name: 'Balance (no extra)', color: COLORS[0], data: d1 }];
    if (withExtra) series.push({ name: 'Balance (with extra)', color: COLORS[1], data: d2 });
    drawLines(canvas, labels, series);
    canvas._series = series;
    renderLegend(series);
    renderTable();
  }
  const legBox = el('div');
  function renderLegend(series) { render(legBox, legend(series)); }

  function renderTable() {
    const rows = v.extra > 0 ? ex.rows : base.rows;
    let data;
    if (chk.checked) {
      data = [];
      for (let y = 0; y * 12 < rows.length; y++) {
        const part = rows.slice(y * 12, y * 12 + 12);
        data.push({ label: 'Year ' + (y + 1), pay: sum(part, 'pay'), interest: sum(part, 'interest'), principal: sum(part, 'principal'), balance: part[part.length - 1].balance });
      }
    } else data = rows.map(r => ({ label: 'Month ' + r.n, ...r }));
    render(tableBox, el('table', { class: 'table' },
      el('thead', {}, el('tr', {}, ['Period', 'Payment', 'Interest', 'Principal', 'Balance'].map(h => el('th', {}, h)))),
      el('tbody', {}, data.map(r => el('tr', {}, el('td', {}, r.label), el('td', {}, money(r.pay)), el('td', {}, money(r.interest)), el('td', {}, money(r.principal)), el('td', {}, money(r.balance)))))));
  }
  const sum = (a, k) => a.reduce((x, r) => x + r[k], 0);

  [fA, fR, fY, fE].forEach(f => f.addEventListener('input', update));
  render(root,
    el('div', { class: 'row' },
      el('label', { class: 'field' }, 'Loan amount', fA), el('label', { class: 'field' }, 'Interest rate % / year', fR),
      el('label', { class: 'field' }, 'Term (years)', fY), el('label', { class: 'field' }, 'Extra monthly payment', fE)),
    summary,
    el('h3', {}, 'Remaining balance'), legBox, el('div', { class: 'canvas-wrap' }, canvas),
    el('h3', {}, 'Amortization'),
    el('label', { class: 'inline' }, chk, 'Group by year'),
    el('div', { class: 'small muted' }, 'Table shows the schedule including your extra payment, if any.'),
    tableBox,
    exportBar('amortization',
      () => [['Month', 'Payment', 'Interest', 'Principal', 'Balance'], ...(v.extra > 0 ? ex.rows : base.rows).map(r => [r.n, r.pay.toFixed(2), r.interest.toFixed(2), r.principal.toFixed(2), r.balance.toFixed(2)])],
      () => ({ inputs: v, noExtra: { payment: base.payment, totalInterest: base.interest, months: base.rows.length }, withExtra: { totalInterest: ex.interest, months: ex.rows.length }, schedule: v.extra > 0 ? ex.rows : base.rows })));
  update();
}
