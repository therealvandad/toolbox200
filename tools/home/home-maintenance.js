import { el, render, store, uid, today } from '../../lib/ui.js';
import { N, pd, iso, addDays, addMonths, dayDiff, todayDate, fmtDate, exportBar, input, sel } from './_h.js';

const PRESET = [
  ['Replace HVAC / furnace filter', 3, 'months'], ['Test smoke and CO alarms', 1, 'months'], ['Replace smoke alarm batteries', 12, 'months'],
  ['Clean gutters', 6, 'months'], ['Flush water heater', 12, 'months'], ['Clean dryer vent', 12, 'months'],
  ['Test GFCI outlets', 6, 'months'], ['Clean refrigerator coils', 6, 'months'], ['Check fire extinguisher', 12, 'months'],
  ['Service heating system / boiler', 12, 'months'], ['Clean range hood filter', 3, 'months'], ['Clean washing machine drum and dishwasher filter', 1, 'months'],
  ['Check caulk and seals in bathrooms', 6, 'months'], ['Inspect roof and chimney', 12, 'months'], ['Replace fridge water filter', 6, 'months'],
  ['Drain outdoor faucets before winter', 12, 'months'],
];
const UNITS = ['days', 'weeks', 'months', 'years'];

function nextDue(t) {
  const last = pd(t.last);
  if (!last) return todayDate();
  const n = Math.max(1, t.every);
  return t.unit === 'days' ? addDays(last, n) : t.unit === 'weeks' ? addDays(last, n * 7) : t.unit === 'years' ? addMonths(last, n * 12) : addMonths(last, n);
}

export default function (root) {
  const s = store('home-maintenance');
  let tasks = s.get('tasks', null) || PRESET.map(([name, every, unit]) => ({ id: uid(), name, every, unit, last: '', history: [] }));
  const save = () => s.set('tasks', tasks);
  const out = el('div');

  const fName = input({ placeholder: 'Custom task (e.g. Oil door hinges)', class: 'input grow' });
  const fEvery = input({ type: 'number', min: '1', step: '1', value: '6', style: { width: '70px' } });
  const fUnit = sel(UNITS, 'months');
  const fLast = input({ type: 'date' });
  function add() {
    if (!fName.value.trim()) return;
    tasks.push({ id: uid(), name: fName.value.trim(), every: Math.max(1, Math.round(N(fEvery.value)) || 1), unit: fUnit.value, last: fLast.value, history: fLast.value ? [fLast.value] : [] });
    fName.value = ''; fLast.value = ''; save(); draw();
  }
  fName.addEventListener('keydown', e => e.key === 'Enter' && add());

  function markDone(t, date) {
    t.last = date; t.history = [...(t.history || []), date].sort();
    save(); draw();
  }

  function row(t, nd, days) {
    const doneDate = input({ type: 'date', value: today(), style: { width: '140px' } });
    return el('li', { style: { flexWrap: 'wrap' } },
      el('div', { class: 'grow' },
        el('div', {}, el('b', {}, t.name), ' ',
          !t.last ? el('span', { class: 'badge warn' }, 'never done')
            : days < 0 ? el('span', { class: 'badge danger' }, `overdue ${-days}d`)
              : days === 0 ? el('span', { class: 'badge warn' }, 'due today')
                : days <= 14 ? el('span', { class: 'badge warn' }, `in ${days}d`) : null),
        el('div', { class: 'small muted' }, `Every `, input({ type: 'number', min: '1', value: t.every, style: { width: '60px', padding: '2px 6px' }, onchange: e => { t.every = Math.max(1, Math.round(N(e.target.value)) || 1); save(); draw(); } }), ' ',
          sel(UNITS, t.unit, { onchange: e => { t.unit = e.target.value; save(); draw(); }, style: { padding: '2px 6px' } }),
          ` · Last done: ${t.last ? fmtDate(pd(t.last)) : '-'} · Next due: ${fmtDate(nd)}`)),
      doneDate,
      el('button', { class: 'btn small primary', onclick: () => markDone(t, doneDate.value || today()) }, 'Mark done'),
      el('button', { class: 'btn small ghost', title: 'Delete', onclick: () => { tasks = tasks.filter(x => x.id !== t.id); save(); draw(); } }, 'x'));
  }

  function draw() {
    const t0 = todayDate();
    const rows = tasks.map(t => { const nd = nextDue(t); return { t, nd, days: dayDiff(t0, nd) }; }).sort((a, b) => a.nd - b.nd || a.t.name.localeCompare(b.t.name));
    const over = rows.filter(r => !r.t.last || r.days < 0), soon = rows.filter(r => r.t.last && r.days >= 0 && r.days <= 30), later = rows.filter(r => r.t.last && r.days > 30);
    const sec = (title, list, cls) => list.length ? el('div', {}, el('h3', {}, title, ' ', el('span', { class: 'badge ' + cls }, list.length)), el('ul', { class: 'list' }, list.map(r => row(r.t, r.nd, r.days)))) : null;
    render(out,
      el('div', { class: 'row' }, el('div', { class: 'stat' }, el('div', { class: 'v', style: { color: over.length ? 'var(--danger)' : 'inherit' } }, over.length), el('div', { class: 'l' }, 'overdue / not started')),
        el('div', { class: 'stat' }, el('div', { class: 'v' }, soon.length), el('div', { class: 'l' }, 'due in 30 days')), el('div', { class: 'stat' }, el('div', { class: 'v' }, later.length), el('div', { class: 'l' }, 'later'))),
      sec('Overdue or never done', over, 'danger'), sec('Due in the next 30 days', soon, 'warn'), sec('Later', later, ''),
      exportBar('home-maintenance',
        () => [['Task', 'Every', 'Unit', 'Last done', 'Next due'], ...rows.map(r => [r.t.name, r.t.every, r.t.unit, r.t.last, iso(r.nd)])],
        () => tasks));
  }
  render(root,
    el('div', { class: 'row' }, fName, el('label', { class: 'inline' }, 'Every', fEvery, fUnit), el('label', { class: 'inline' }, 'Last done', fLast), el('button', { class: 'btn primary', onclick: add }, 'Add task')),
    out);
  draw();
}
