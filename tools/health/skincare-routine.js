// Skincare routine checklist: AM/PM steps with products, daily ticks, expiry, monthly completion heatmap.
import { el, render, store, uid, today, toast, stat, field, pad } from '../../lib/ui.js';

const DEFAULT_STEPS = [
  { id: uid(), period: 'am', name: 'Cleanser', product: '', expiry: '' },
  { id: uid(), period: 'am', name: 'Serum', product: '', expiry: '' },
  { id: uid(), period: 'am', name: 'Moisturiser', product: '', expiry: '' },
  { id: uid(), period: 'am', name: 'Sunscreen', product: '', expiry: '' },
  { id: uid(), period: 'pm', name: 'Cleanser', product: '', expiry: '' },
  { id: uid(), period: 'pm', name: 'Treatment', product: '', expiry: '' },
  { id: uid(), period: 'pm', name: 'Moisturiser', product: '', expiry: '' },
];

export default function (root) {
  const s = store('skincare-routine');
  let steps = s.get('steps', null) || DEFAULT_STEPS;     // {id, period 'am'|'pm', name, product, expiry}
  let ticks = s.get('ticks', {});                         // date -> [stepId]
  const now = new Date();
  let year = now.getFullYear(), month = now.getMonth();

  const saveSteps = () => s.set('steps', steps);
  const saveTicks = () => s.set('ticks', ticks);
  const keyOf = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
  const daysUntil = ex => ex ? Math.round((new Date(ex + 'T12:00:00') - new Date(today() + 'T12:00:00')) / 864e5) : null;

  const nameIn = el('input', { class: 'input', placeholder: 'Step (e.g. Toner)', onkeydown: e => { if (e.key === 'Enter') addStep(); } });
  const prodIn = el('input', { class: 'input', placeholder: 'Product (optional)', onkeydown: e => { if (e.key === 'Enter') addStep(); } });
  const expIn = el('input', { class: 'input', type: 'date', title: 'Expiry date (optional)' });
  const perSel = el('select', { class: 'select' }, el('option', { value: 'am' }, 'Morning'), el('option', { value: 'pm' }, 'Evening'));
  const lists = el('div', { class: 'grid2' });
  const stats = el('div', { class: 'row' });
  const expiries = el('div', { class: 'col' });
  const heat = el('div', { class: 'cal' });
  const monthTitle = el('b', { style: { minWidth: '140px', textAlign: 'center' } });

  function addStep() {
    const name = nameIn.value.trim(); if (!name) { toast('Enter a step name'); return; }
    steps.push({ id: uid(), period: perSel.value, name, product: prodIn.value.trim(), expiry: expIn.value });
    nameIn.value = prodIn.value = expIn.value = ''; saveSteps(); update(); nameIn.focus();
  }
  function tick(id, on) {
    const k = today(); const a = (ticks[k] ||= []);
    const i = a.indexOf(id);
    if (on && i < 0) a.push(id); if (!on && i >= 0) a.splice(i, 1);
    if (!a.length) delete ticks[k];
    saveTicks(); update();
  }
  function move(step, d) {
    const same = steps.filter(x => x.period === step.period), i = same.indexOf(step), j = i + d;
    if (j < 0 || j >= same.length) return;
    const a = steps.indexOf(step), b = steps.indexOf(same[j]);
    [steps[a], steps[b]] = [steps[b], steps[a]]; saveSteps(); update();
  }

  function expBadge(st) {
    const d = daysUntil(st.expiry);
    if (d == null) return null;
    return el('span', { class: 'badge ' + (d < 0 ? 'danger' : d <= 30 ? 'warn' : 'ok'), title: st.expiry }, d < 0 ? `expired ${-d}d ago` : d === 0 ? 'expires today' : `${d}d left`);
  }

  function periodCol(period, label) {
    const list = steps.filter(x => x.period === period), tk = ticks[today()] || [];
    const nDone = list.filter(x => tk.includes(x.id)).length;
    return el('div', { class: 'panel' },
      el('div', { class: 'row', style: { margin: '0 0 4px' } }, el('b', {}, label), el('span', { class: 'muted small' }, `${nDone}/${list.length}`)),
      list.length ? el('ul', { class: 'list' }, list.map(st => el('li', {},
        el('input', { type: 'checkbox', checked: tk.includes(st.id), onchange: e => tick(st.id, e.target.checked) }),
        el('span', { class: 'grow', style: { textDecoration: tk.includes(st.id) ? 'line-through' : 'none', opacity: tk.includes(st.id) ? 0.6 : 1 } }, st.name, st.product && el('span', { class: 'muted small' }, ' – ' + st.product)),
        expBadge(st),
        el('button', { class: 'btn small ghost', title: 'Move up', onclick: () => move(st, -1) }, '↑'),
        el('button', { class: 'btn small ghost', title: 'Move down', onclick: () => move(st, 1) }, '↓'),
        el('button', { class: 'btn small ghost', title: 'Remove', onclick: () => { steps = steps.filter(x => x !== st); saveSteps(); update(); } }, '✕')))) : el('div', { class: 'muted small' }, 'No steps yet.'));
  }

  function renderHeat() {
    monthTitle.textContent = new Date(year, month, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    const first = (new Date(year, month, 1).getDay() + 6) % 7, n = new Date(year, month + 1, 0).getDate();
    const ids = new Set(steps.map(x => x.id)), total = ids.size;
    const cells = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(d => el('div', { style: { border: 0, background: 'none', aspectRatio: 'auto', color: 'var(--muted)' } }, d));
    for (let i = 0; i < first; i++) cells.push(el('div', { style: { border: 0, background: 'none' } }));
    let sum = 0, cnt = 0, perfect = 0;
    const lastDay = (year === now.getFullYear() && month === now.getMonth()) ? now.getDate() : (new Date(year, month, 1) > now ? 0 : n);
    for (let d = 1; d <= n; d++) {
      const k = keyOf(year, month, d), done = (ticks[k] || []).filter(id => ids.has(id)).length, f = total ? done / total : 0;
      if (d <= lastDay) { sum += f; cnt++; if (f >= 1) perfect++; }
      cells.push(el('div', {
        title: `${k}: ${done}/${total} steps`,
        style: { background: f > 0 ? `color-mix(in srgb, var(--ok) ${Math.round(20 + f * 80)}%, var(--bg))` : 'var(--bg)', color: f > 0.6 ? '#fff' : 'var(--text)', outline: k === today() ? '2px dashed var(--muted)' : 'none' },
      }, d));
    }
    render(heat, cells);
    return { avg: cnt ? sum / cnt : 0, perfect };
  }

  function update() {
    render(lists, periodCol('am', '☀ Morning'), periodCol('pm', '☾ Evening'));
    const { avg, perfect } = renderHeat();
    const tk = ticks[today()] || [], ids = new Set(steps.map(x => x.id));
    const doneToday = tk.filter(id => ids.has(id)).length;
    render(stats, stat(`${doneToday}/${steps.length}`, 'steps done today'), stat(Math.round(avg * 100) + '%', 'completion this month'), stat(perfect, 'perfect days this month'));
    const withExp = steps.filter(x => x.expiry).sort((a, b) => (a.expiry < b.expiry ? -1 : 1));
    render(expiries, withExp.length ? el('table', { class: 'table' }, el('thead', {}, el('tr', {}, ['Step', 'Product', 'Expires', ''].map(h => el('th', {}, h)))),
      el('tbody', {}, withExp.map(st => el('tr', {}, el('td', {}, st.name + (st.period === 'am' ? ' (AM)' : ' (PM)')), el('td', {}, st.product || '–'), el('td', {}, st.expiry), el('td', {}, expBadge(st)))))) : el('div', { class: 'muted small' }, 'Add an expiry date when adding a step to track it here.'));
  }

  const nav = d => { month += d; if (month < 0) { month = 11; year--; } if (month > 11) { month = 0; year++; } update(); };

  render(root,
    stats, lists,
    el('h3', {}, 'Add a step'),
    el('div', { class: 'row' }, perSel, nameIn, prodIn, field('Expiry', expIn), el('button', { class: 'btn primary', onclick: addStep, style: { alignSelf: 'flex-end' } }, 'Add')),
    el('h3', {}, 'Product expiry'), expiries,
    el('h3', {}, 'Monthly heatmap'),
    el('div', { class: 'row', style: { justifyContent: 'center' } }, el('button', { class: 'btn small', onclick: () => nav(-1) }, '◀'), monthTitle, el('button', { class: 'btn small', onclick: () => nav(1) }, '▶')),
    heat,
    el('div', { class: 'muted small' }, 'Darker green = more of the day\'s steps completed (morning and evening together).'),
    el('p', { class: 'muted small' }, 'Your routine and ticks are stored in this browser only.'));
  update();
}
