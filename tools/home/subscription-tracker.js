import { el, render, store, uid, today } from '../../lib/ui.js';
import { money, N, pd, iso, addDays, addMonths, dayDiff, todayDate, fmtDate, exportBar, input, sel } from './_h.js';

const CYCLES = [['weekly', 'Weekly'], ['monthly', 'Monthly'], ['yearly', 'Yearly']];
const CATS = ['Streaming', 'Software', 'Music', 'Gaming', 'News', 'Fitness', 'Cloud', 'Utilities', 'Other'];

export default function (root) {
  const s = store('subscription-tracker');
  let items = s.get('items', []);
  let sortBy = s.get('sort', 'next');
  let editId = null;
  const save = () => s.set('items', items);

  const monthly = it => it.cycle === 'weekly' ? it.cost * 52 / 12 : it.cycle === 'yearly' ? it.cost / 12 : it.cost;
  // roll the stored renewal date forward until it is today or later
  function nextDate(it) {
    let d = pd(it.next); const t = todayDate();
    if (!d) return null;
    let guard = 0;
    while (d < t && guard++ < 5000) {
      d = it.cycle === 'weekly' ? addDays(d, 7) : it.cycle === 'yearly' ? addMonths(d, 12) : addMonths(d, 1);
    }
    return d;
  }

  const fName = input({ placeholder: 'Name (e.g. Netflix)', class: 'input grow' });
  const fCost = input({ type: 'number', step: '0.01', min: '0', placeholder: 'Cost', style: { width: '100px' } });
  const fCycle = sel(CYCLES, 'monthly');
  const fNext = input({ type: 'date', value: today() });
  const fCat = input({ list: 'sub-cats', placeholder: 'Category', style: { width: '130px' } });
  const dl = el('datalist', { id: 'sub-cats-' + uid() }, CATS.map(c => el('option', { value: c })));
  fCat.setAttribute('list', dl.id);
  const addBtn = el('button', { class: 'btn primary', onclick: submit }, 'Add');
  const cancelBtn = el('button', { class: 'btn ghost hidden', onclick: () => { editId = null; clearForm(); } }, 'Cancel');
  const sortSel = sel([['next', 'Next renewal'], ['name', 'Name'], ['cost', 'Cost (monthly, high first)'], ['cat', 'Category']], sortBy, {
    onchange: () => { sortBy = sortSel.value; s.set('sort', sortBy); draw(); },
  });
  const out = el('div');

  function clearForm() {
    fName.value = ''; fCost.value = ''; fCycle.value = 'monthly'; fNext.value = today(); fCat.value = '';
    addBtn.textContent = 'Add'; cancelBtn.classList.add('hidden');
  }
  function submit() {
    const name = fName.value.trim();
    if (!name || !fNext.value) return;
    const rec = { name, cost: N(fCost.value), cycle: fCycle.value, next: fNext.value, cat: fCat.value.trim() || 'Other' };
    const cur = editId && items.find(i => i.id === editId);
    if (cur) { Object.assign(cur, rec); editId = null; }
    else items.push({ id: uid(), ...rec });
    save(); clearForm(); draw();
  }
  [fName, fCost, fCat].forEach(f => f.addEventListener('keydown', e => e.key === 'Enter' && submit()));

  function edit(it) {
    editId = it.id;
    fName.value = it.name; fCost.value = it.cost; fCycle.value = it.cycle; fNext.value = it.next; fCat.value = it.cat;
    addBtn.textContent = 'Save'; cancelBtn.classList.remove('hidden'); fName.focus();
  }

  function draw() {
    const t = todayDate();
    const rows = items.map(it => ({ it, nd: nextDate(it), m: monthly(it) }));
    rows.forEach(r => { r.days = r.nd ? dayDiff(t, r.nd) : 9999; });
    const cmp = {
      next: (a, b) => a.days - b.days,
      name: (a, b) => a.it.name.localeCompare(b.it.name),
      cost: (a, b) => b.m - a.m,
      cat: (a, b) => a.it.cat.localeCompare(b.it.cat) || a.it.name.localeCompare(b.it.name),
    }[sortBy];
    rows.sort(cmp);
    const totM = rows.reduce((a, r) => a + r.m, 0);
    const in7 = rows.filter(r => r.days <= 7), in30 = rows.filter(r => r.days <= 30);
    const sum = l => l.reduce((a, r) => a + r.it.cost, 0);
    const byCat = {};
    rows.forEach(r => { byCat[r.it.cat] = (byCat[r.it.cat] || 0) + r.m; });
    render(out,
      el('div', { class: 'row' },
        el('div', { class: 'stat' }, el('div', { class: 'v' }, money(totM)), el('div', { class: 'l' }, 'per month')),
        el('div', { class: 'stat' }, el('div', { class: 'v' }, money(totM * 12)), el('div', { class: 'l' }, 'per year')),
        el('div', { class: 'stat' }, el('div', { class: 'v' }, money(sum(in7))), el('div', { class: 'l' }, `due in 7 days (${in7.length})`)),
        el('div', { class: 'stat' }, el('div', { class: 'v' }, money(sum(in30))), el('div', { class: 'l' }, `due in 30 days (${in30.length})`))),
      Object.keys(byCat).length ? el('div', { class: 'row small muted' }, 'By category (monthly): ',
        Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([c, v]) => el('span', { class: 'badge' }, `${c}: ${money(v)}`))) : null,
      el('div', { class: 'row' }, el('label', { class: 'inline' }, 'Sort by', sortSel)),
      rows.length ? el('div', { class: 'scroll-x' }, el('table', { class: 'table' },
        el('thead', {}, el('tr', {}, ['Name', 'Category', 'Cost', 'Cycle', 'Per month', 'Next renewal', ''].map(h => el('th', {}, h)))),
        el('tbody', {}, rows.map(r => el('tr', { style: r.days <= 7 ? { background: 'rgba(217,140,11,.18)' } : r.days <= 30 ? { background: 'rgba(47,111,237,.10)' } : {} },
          el('td', {}, r.it.name), el('td', {}, r.it.cat), el('td', {}, money(r.it.cost)), el('td', {}, r.it.cycle), el('td', {}, money(r.m)),
          el('td', {}, fmtDate(r.nd), ' ', r.days === 0 ? el('span', { class: 'badge danger' }, 'today') : r.days <= 7 ? el('span', { class: 'badge warn' }, `in ${r.days}d`) : r.days <= 30 ? el('span', { class: 'badge' }, `in ${r.days}d`) : null),
          el('td', {}, el('button', { class: 'btn small', onclick: () => edit(r.it) }, 'Edit'), ' ',
            el('button', { class: 'btn small ghost', onclick: () => { items = items.filter(i => i.id !== r.it.id); save(); draw(); } }, 'x')))))))
        : el('div', { class: 'empty' }, 'No subscriptions yet. Add one above.'),
      exportBar('subscriptions',
        () => [['Name', 'Category', 'Cost', 'Cycle', 'Per month', 'Next renewal'], ...rows.map(r => [r.it.name, r.it.cat, r.it.cost, r.it.cycle, r.m.toFixed(2), r.nd ? iso(r.nd) : ''])],
        () => items));
  }
  render(root,
    el('div', { class: 'row' }, fName, fCost, fCycle, el('label', { class: 'inline' }, 'Next', fNext), fCat, dl, addBtn, cancelBtn),
    out);
  draw();
}
