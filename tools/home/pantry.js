import { el, render, store, uid, copy, download } from '../../lib/ui.js';
import { N, pd, dayDiff, todayDate, exportBar, input } from './_h.js';

const CATS = ['Grains & pasta', 'Canned', 'Dairy', 'Fridge', 'Freezer', 'Spices & sauces', 'Snacks', 'Drinks', 'Baking', 'Cleaning', 'Other'];

export default function (root) {
  const s = store('pantry');
  let items = s.get('items', []);
  let q = '';
  const save = () => s.set('items', items);

  const fName = input({ placeholder: 'Item (e.g. Rice)', class: 'input grow' });
  const fQty = input({ type: 'number', step: 'any', min: '0', value: '1', style: { width: '80px' } });
  const fUnit = input({ placeholder: 'unit', style: { width: '80px' } });
  const fCat = el('select', { class: 'select' }, CATS.map(c => el('option', { value: c }, c)));
  const fExp = input({ type: 'date' });
  const fMin = input({ type: 'number', step: 'any', min: '0', value: '1', style: { width: '70px' }, title: 'Low-stock threshold' });
  const search = input({ type: 'search', placeholder: 'Search items...', class: 'input grow', oninput: () => { q = search.value.toLowerCase(); draw(); } });
  search.addEventListener('keydown', e => { if (e.key === 'Escape') { search.value = ''; q = ''; draw(); } });
  const out = el('div');

  function add() {
    const name = fName.value.trim();
    if (!name) return;
    items.push({ id: uid(), name, qty: N(fQty.value), unit: fUnit.value.trim(), cat: fCat.value, expiry: fExp.value, min: N(fMin.value) });
    fName.value = ''; fExp.value = ''; save(); draw(); fName.focus();
  }
  fName.addEventListener('keydown', e => e.key === 'Enter' && add());

  function row(it, days) {
    const exp = pd(it.expiry);
    return el('li', {},
      el('div', { class: 'grow' },
        el('div', {}, el('b', {}, it.name), ' ', el('span', { class: 'badge' }, it.cat)),
        el('div', { class: 'small muted' }, exp ? (days < 0 ? `Expired ${-days} day(s) ago` : days === 0 ? 'Expires today' : `Expires in ${days} day(s)`) : 'No expiry date')),
      el('button', { class: 'btn small', title: 'Use one', onclick: () => { it.qty = Math.max(0, +(it.qty - 1).toFixed(3)); save(); draw(); } }, '-'),
      el('b', { style: { minWidth: '56px', textAlign: 'center' } }, it.qty + (it.unit ? ' ' + it.unit : '')),
      el('button', { class: 'btn small', title: 'Add one', onclick: () => { it.qty = +(it.qty + 1).toFixed(3); save(); draw(); } }, '+'),
      input({ type: 'date', value: it.expiry || '', title: 'Expiry', onchange: e => { it.expiry = e.target.value; save(); draw(); } }),
      el('label', { class: 'inline small', title: 'Low-stock threshold' }, 'min', input({ type: 'number', min: '0', step: 'any', value: it.min, style: { width: '60px' }, onchange: e => { it.min = N(e.target.value); save(); draw(); } })),
      el('button', { class: 'btn small ghost', onclick: () => { items = items.filter(x => x.id !== it.id); save(); draw(); } }, 'x'));
  }

  function section(title, list, cls) {
    if (!list.length) return null;
    return el('div', {}, el('h3', {}, title, ' ', el('span', { class: 'badge ' + (cls || '') }, list.length)),
      el('ul', { class: 'list' }, list.map(x => row(x.it, x.days))));
  }

  function draw() {
    const t = todayDate();
    const all = items.map(it => ({ it, days: pd(it.expiry) ? dayDiff(t, pd(it.expiry)) : null }))
      .filter(x => !q || (x.it.name + ' ' + x.it.cat).toLowerCase().includes(q));
    const expired = all.filter(x => x.days != null && x.days < 0).sort((a, b) => a.days - b.days);
    const soon = all.filter(x => x.days != null && x.days >= 0 && x.days <= 7).sort((a, b) => a.days - b.days);
    const rest = all.filter(x => !expired.includes(x) && !soon.includes(x));
    const cats = [...new Set(rest.map(x => x.it.cat))].sort();
    const low = items.filter(it => it.qty <= it.min);
    const lowText = low.map(it => `${it.name} (have ${it.qty}${it.unit ? ' ' + it.unit : ''}, min ${it.min})`).join('\n');
    render(out,
      section('Expired', expired, 'danger'),
      section('Expiring within 7 days', soon, 'warn'),
      cats.map(c => section(c, rest.filter(x => x.it.cat === c).sort((a, b) => a.it.name.localeCompare(b.it.name)))),
      all.length ? null : el('div', { class: 'empty' }, items.length ? 'Nothing matches your search.' : 'Your pantry is empty. Add items above.'),
      el('h3', {}, 'Shopping list (low stock) ', el('span', { class: 'badge' }, low.length)),
      low.length ? el('div', {},
        el('ul', { class: 'list' }, low.map(it => el('li', {}, el('span', { class: 'grow' }, `${it.name} `, el('span', { class: 'muted small' }, `have ${it.qty}${it.unit ? ' ' + it.unit : ''}, min ${it.min}`)),
          el('button', { class: 'btn small', onclick: () => { it.qty = +(it.qty + 1).toFixed(3); save(); draw(); } }, 'Bought 1')))),
        el('div', { class: 'row' },
          el('button', { class: 'btn small', onclick: () => copy(lowText) }, 'Copy list'),
          el('button', { class: 'btn small', onclick: () => download('shopping-list.txt', lowText) }, 'Download .txt'))) : el('div', { class: 'muted small' }, 'Nothing is running low.'),
      exportBar('pantry',
        () => [['Name', 'Quantity', 'Unit', 'Category', 'Expiry', 'Min'], ...items.map(i => [i.name, i.qty, i.unit, i.cat, i.expiry, i.min])],
        () => items));
  }
  render(root,
    el('div', { class: 'row' }, fName, fQty, fUnit, fCat, el('label', { class: 'inline' }, 'Expiry', fExp), el('label', { class: 'inline' }, 'Min', fMin), el('button', { class: 'btn primary', onclick: add }, 'Add')),
    el('div', { class: 'row' }, search),
    out);
  draw();
}
