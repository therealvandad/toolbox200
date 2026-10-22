import { el, render, store, stat, today, pad } from '../../lib/ui.js';

const DAY = 86400000;
const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Dates are handled as UTC midnight timestamps so DST never changes day counts.
function parse(v) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || '');
  if (!m) return null;
  const t = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  return isNaN(t) ? null : t;
}
const iso = t => { const d = new Date(t); return `${String(d.getUTCFullYear()).padStart(4, '0')}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; };
const pretty = t => { const d = new Date(t); return `${DOW[d.getUTCDay()]}, ${MON[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`; };
const daysInMonth = (y, m) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();

// Calendar breakdown between a <= b
function ymd(a, b) {
  const A = new Date(a), B = new Date(b);
  let y = B.getUTCFullYear() - A.getUTCFullYear();
  let m = B.getUTCMonth() - A.getUTCMonth();
  let d = B.getUTCDate() - A.getUTCDate();
  if (d < 0) { m--; const pm = (B.getUTCMonth() + 11) % 12, py = B.getUTCMonth() === 0 ? B.getUTCFullYear() - 1 : B.getUTCFullYear(); d += daysInMonth(py, pm); }
  if (m < 0) { y--; m += 12; }
  return { y, m, d };
}
// Weekdays (Mon-Fri) in [a, b) where a <= b
function weekdays(a, b) {
  const total = Math.round((b - a) / DAY);
  let count = Math.floor(total / 7) * 5;
  const rem = total % 7;
  const start = new Date(a).getUTCDay();
  for (let i = 0; i < rem; i++) { const d = (start + i) % 7; if (d !== 0 && d !== 6) count++; }
  return count;
}
function addMonths(t, n) {
  const d = new Date(t);
  const total = d.getUTCFullYear() * 12 + d.getUTCMonth() + n;
  const y = Math.floor(total / 12), m = ((total % 12) + 12) % 12;
  const day = Math.min(d.getUTCDate(), daysInMonth(y, m));
  const r = new Date(Date.UTC(2000, m, day)); r.setUTCFullYear(y);
  return r.getTime();
}
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

export default function (root) {
  const s = store('date-calc');
  const st = Object.assign({ from: today(), to: '', incl: false, base: today(), amt: 30, unit: 'days', op: 'add' }, s.get('state', {}));
  if (!st.to) { const d = new Date(); d.setDate(d.getDate() + 100); st.to = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

  const from = el('input', { class: 'input', type: 'date', value: st.from });
  const to = el('input', { class: 'input', type: 'date', value: st.to });
  const incl = el('input', { type: 'checkbox', checked: st.incl });
  const diffOut = el('div', { class: 'col' });
  const base = el('input', { class: 'input', type: 'date', value: st.base });
  const amt = el('input', { class: 'input', type: 'number', step: 1, value: st.amt, style: { width: '100px' } });
  const unit = el('select', { class: 'select' }, ['days', 'weeks', 'months', 'years'].map(u => el('option', { value: u }, u)));
  const op = el('select', { class: 'select' }, el('option', { value: 'add' }, 'Add'), el('option', { value: 'sub' }, 'Subtract'));
  unit.value = st.unit; op.value = st.op;
  const addOut = el('div', { class: 'col' });

  function diff() {
    st.from = from.value; st.to = to.value; st.incl = incl.checked;
    let a = parse(from.value), b = parse(to.value);
    if (a == null || b == null) { render(diffOut, el('div', { class: 'muted' }, 'Pick both dates.')); s.set('state', st); return; }
    const swapped = a > b;
    if (swapped) [a, b] = [b, a];
    const days = Math.round((b - a) / DAY) + (incl.checked ? 1 : 0);
    const bb = incl.checked ? b + DAY : b;
    const { y, m, d } = ymd(a, bb);
    const wd = weekdays(a, bb);
    render(diffOut,
      el('div', { class: 'row' }, stat(days.toLocaleString(), 'days'), stat((days / 7).toFixed(2), 'weeks'),
        stat(Math.floor(days / 7) + 'w ' + (days % 7) + 'd', 'weeks and days'), stat(wd.toLocaleString(), 'weekdays (Mon-Fri)'),
        stat((y * 12 + m).toLocaleString(), 'whole months'), stat((days / 365.2425).toFixed(2), 'years')),
      el('div', { class: 'panel' },
        el('div', {}, el('strong', {}, `${plural(y, 'year')}, ${plural(m, 'month')}, ${plural(d, 'day')}`)),
        el('div', { class: 'small muted' }, `${pretty(a)}  to  ${pretty(b)}${swapped ? ' (dates were reversed, shown earliest first)' : ''}`),
        el('div', { class: 'small muted' }, `Weekends: ${days - wd} days. ${incl.checked ? 'End date included.' : 'End date not counted.'}`)));
    s.set('state', st);
  }
  function add() {
    st.base = base.value; st.amt = parseInt(amt.value, 10) || 0; st.unit = unit.value; st.op = op.value;
    const t = parse(base.value);
    if (t == null) { render(addOut, el('div', { class: 'muted' }, 'Pick a start date.')); s.set('state', st); return; }
    const n = (st.op === 'sub' ? -1 : 1) * st.amt;
    let r;
    if (st.unit === 'days') r = t + n * DAY;
    else if (st.unit === 'weeks') r = t + n * 7 * DAY;
    else if (st.unit === 'months') r = addMonths(t, n);
    else r = addMonths(t, n * 12);
    const dd = Math.round((r - t) / DAY);
    render(addOut,
      el('div', { class: 'panel' },
        el('div', { class: 'big', style: { fontSize: '24px' } }, pretty(r)),
        el('div', { class: 'small muted' }, `${iso(r)}  |  ${Math.abs(dd).toLocaleString()} days ${dd < 0 ? 'before' : 'after'} ${iso(t)}`)),
      el('div', { class: 'row' }, el('button', { class: 'btn small', onclick: () => { from.value = iso(t); to.value = iso(r); diff(); } }, 'Compare these two dates above')));
    s.set('state', st);
  }
  [from, to, incl].forEach(i => i.addEventListener('input', diff));
  [base, amt, unit, op].forEach(i => i.addEventListener('input', add));

  render(root,
    el('h3', { style: { margin: '0 0 4px' } }, 'Difference between two dates'),
    el('div', { class: 'row' },
      el('label', { class: 'field' }, 'From', from), el('label', { class: 'field' }, 'To', to),
      el('button', { class: 'btn', style: { alignSelf: 'flex-end' }, onclick: () => { [from.value, to.value] = [to.value, from.value]; diff(); } }, 'Swap'),
      el('button', { class: 'btn', style: { alignSelf: 'flex-end' }, onclick: () => { from.value = today(); diff(); } }, 'From today'),
      el('label', { class: 'inline', style: { alignSelf: 'flex-end' } }, incl, 'Include end date')),
    diffOut,
    el('hr', { style: { border: 0, borderTop: '1px solid var(--line)', margin: '18px 0' } }),
    el('h3', { style: { margin: '0 0 4px' } }, 'Add or subtract time'),
    el('div', { class: 'row' },
      el('label', { class: 'field' }, 'Start date', base),
      el('label', { class: 'field' }, 'Operation', op),
      el('label', { class: 'field' }, 'Amount', amt),
      el('label', { class: 'field' }, 'Unit', unit),
      el('button', { class: 'btn', style: { alignSelf: 'flex-end' }, onclick: () => { base.value = today(); add(); } }, 'Today')),
    addOut);
  diff(); add();
}
