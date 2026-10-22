import { el, render, store, uid } from '../../lib/ui.js';
import { money, N, exportBar, input, sel } from './_h.js';

const UNITS = {
  g: ['m', 1], kg: ['m', 1000], oz: ['m', 28.3495], lb: ['m', 453.592],
  ml: ['v', 1], L: ['v', 1000], 'fl oz': ['v', 29.5735], each: ['c', 1],
};
const DIM_LABEL = { m: '100 g', v: '100 ml', c: 'unit' };
const DIM_MULT = { m: 100, v: 100, c: 1 };

export default function (root) {
  const s = store('price-compare');
  let items = s.get('items', []);
  const save = () => s.set('items', items);
  const unitPrice = o => {
    const [d, f] = UNITS[o.unit] || ['c', 1];
    const base = o.size * f;
    return base > 0 ? o.price / base * DIM_MULT[d] : Infinity;
  };
  const dimOf = o => (UNITS[o.unit] || ['c'])[0];
  // dominant dimension of an item's offers, and its offers ordered by unit price
  function ranked(it) {
    const cnt = {};
    it.offers.forEach(o => { const d = dimOf(o); cnt[d] = (cnt[d] || 0) + 1; });
    const dim = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0];
    const offers = it.offers.filter(o => dimOf(o) === dim).sort((a, b) => unitPrice(a) - unitPrice(b));
    return { dim, offers, best: offers[0] };
  }
  const storeNames = () => [...new Set(items.flatMap(i => i.offers.map(o => o.store.trim())).filter(Boolean))];

  const nName = input({ placeholder: 'Item (e.g. Olive oil)', class: 'input grow' });
  const nQty = input({ type: 'number', min: '1', step: '1', value: '1', style: { width: '70px' }, title: 'Quantity to buy' });
  const body = el('div');
  const dl = el('datalist', { id: 'pc-stores-' + uid() });

  function addItem() {
    const name = nName.value.trim();
    if (!name) return;
    items.push({ id: uid(), name, qty: Math.max(1, Math.round(N(nQty.value)) || 1), offers: [] });
    nName.value = ''; save(); draw();
  }
  nName.addEventListener('keydown', e => e.key === 'Enter' && addItem());

  function itemCard(it) {
    const r = ranked(it);
    const st = input({ list: dl.id, placeholder: 'Store', style: { width: '130px' } });
    const pr = input({ type: 'number', step: '0.01', min: '0', placeholder: 'Price', style: { width: '90px' } });
    const sz = input({ type: 'number', step: 'any', min: '0', placeholder: 'Size', style: { width: '90px' } });
    const un = sel(Object.keys(UNITS), 'g');
    const add = () => {
      if (!st.value.trim() || N(pr.value) <= 0 || N(sz.value) <= 0) return;
      it.offers.push({ id: uid(), store: st.value.trim(), price: N(pr.value), size: N(sz.value), unit: un.value });
      save(); draw();
    };
    [st, pr, sz].forEach(f => f.addEventListener('keydown', e => e.key === 'Enter' && add()));
    return el('div', { class: 'panel' },
      el('div', { class: 'row', style: { margin: 0 } },
        input({ value: it.name, class: 'input grow', onchange: e => { it.name = e.target.value.trim() || it.name; save(); draw(); } }),
        el('label', { class: 'inline' }, 'Qty', input({ type: 'number', min: '1', value: it.qty, style: { width: '70px' }, onchange: e => { it.qty = Math.max(1, Math.round(N(e.target.value)) || 1); save(); draw(); } })),
        el('button', { class: 'btn small ghost', onclick: () => { items = items.filter(x => x.id !== it.id); save(); draw(); } }, 'Delete')),
      it.offers.length ? el('div', { class: 'scroll-x' }, el('table', { class: 'table' },
        el('thead', {}, el('tr', {}, ['Store', 'Price', 'Size', 'Unit price', ''].map(h => el('th', {}, h)))),
        el('tbody', {}, it.offers.map(o => {
          const isBest = r.best && o.id === r.best.id;
          const comparable = dimOf(o) === r.dim;
          return el('tr', { style: isBest ? { background: 'rgba(31,157,85,.2)' } : {} },
            el('td', {}, o.store, isBest ? [' ', el('span', { class: 'badge ok' }, 'cheapest')] : null),
            el('td', {}, money(o.price)), el('td', {}, `${o.size} ${o.unit}`),
            el('td', {}, comparable ? `${money(unitPrice(o))} / ${DIM_LABEL[dimOf(o)]}` : el('span', { class: 'muted' }, 'different unit type')),
            el('td', {}, el('button', { class: 'btn small ghost', onclick: () => { it.offers = it.offers.filter(x => x.id !== o.id); save(); draw(); } }, 'x')));
        })))) : el('div', { class: 'muted small' }, 'No prices yet.'),
      el('div', { class: 'row' }, st, pr, sz, un, el('button', { class: 'btn small', onclick: add }, 'Add price')));
  }

  function totals() {
    const stores = storeNames();
    const rows = stores.map(name => {
      let total = 0, covered = 0;
      items.forEach(it => {
        const offs = ranked({ offers: it.offers.filter(o => o.store.trim() === name) });
        if (offs.best) { total += offs.best.price * it.qty; covered++; }
      });
      return { name, total, covered, missing: items.length - covered };
    });
    let bestMix = 0, mixCount = 0;
    items.forEach(it => {
      // cheapest actual price per unit among comparable offers
      const r = ranked(it);
      if (r.best) { bestMix += r.best.price * it.qty; mixCount++; }
    });
    const complete = rows.filter(r => r.missing === 0 && items.length);
    const minTotal = complete.length ? Math.min(...complete.map(r => r.total)) : null;
    return { rows, bestMix, mixCount, minTotal };
  }

  function draw() {
    render(dl, storeNames().map(n => el('option', { value: n })));
    const t = totals();
    render(body,
      items.length ? el('div', { class: 'col' }, items.map(itemCard)) : el('div', { class: 'empty' }, 'Add items you want to compare.'),
      items.length ? el('div', {},
        el('h3', {}, 'Shopping list total per store'),
        el('div', { class: 'small muted' }, 'Each store uses its cheapest-per-unit offer for every item times the quantity. Stores that carry every item are comparable.'),
        el('div', { class: 'scroll-x' }, el('table', { class: 'table' },
          el('thead', {}, el('tr', {}, ['Store', 'Total', 'Items covered'].map(h => el('th', {}, h)))),
          el('tbody', {}, t.rows.map(r => el('tr', { style: t.minTotal != null && r.missing === 0 && r.total === t.minTotal ? { background: 'rgba(31,157,85,.2)' } : {} },
            el('td', {}, r.name), el('td', {}, money(r.total)),
            el('td', {}, `${r.covered}/${items.length}`, r.missing ? el('span', { class: 'badge warn', style: { marginLeft: '6px' } }, `${r.missing} missing`) : el('span', { class: 'badge ok', style: { marginLeft: '6px' } }, 'all items')))))),
        ),
        el('div', { class: 'row' }, el('div', { class: 'stat' }, el('div', { class: 'v' }, money(t.bestMix)), el('div', { class: 'l' }, `best mix across stores (${t.mixCount} items)`)))) : null,
      exportBar('price-compare',
        () => [['Item', 'Qty', 'Store', 'Price', 'Size', 'Unit', 'Unit price (per 100 g/100 ml/unit)'], ...items.flatMap(it => it.offers.map(o => [it.name, it.qty, o.store, o.price, o.size, o.unit, unitPrice(o).toFixed(4)]))],
        () => items));
  }
  render(root, el('div', { class: 'row' }, nName, el('label', { class: 'inline' }, 'Qty', nQty), el('button', { class: 'btn primary', onclick: addItem }, 'Add item')), dl, body);
  draw();
}
