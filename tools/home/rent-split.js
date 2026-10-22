import { el, render, store, uid } from '../../lib/ui.js';
import { money, N, exportBar, input } from './_h.js';

const PERKS = [
  ['bath', 'Private bathroom', 10], ['balcony', 'Balcony', 6], ['closet', 'Walk-in closet', 4],
  ['light', 'Great light / view', 4], ['quiet', 'Quiet side', 3],
  ['noise', 'Noisy side', -5], ['dark', 'Dark / small windows', -5], ['pass', 'Walk-through room', -6],
];

export default function (root) {
  const s = store('rent-split');
  const D = Object.assign({
    total: 2400, fairness: 0.7,
    rooms: [
      { id: uid(), name: 'Room A', size: 18, perks: { bath: true, balcony: true }, adj: 0 },
      { id: uid(), name: 'Room B', size: 12, perks: {}, adj: 0 },
      { id: uid(), name: 'Room C', size: 10, perks: { dark: true }, adj: 0 },
    ],
    shared: [{ id: uid(), name: 'Internet', amt: 60 }, { id: uid(), name: 'Utilities', amt: 180 }],
  }, s.get('d', {}));
  const save = () => s.set('d', D);
  const out = el('div');
  const fairLbl = el('span');
  const fair = el('input', { type: 'range', min: '0', max: '1', step: '0.05', value: D.fairness, oninput: () => { D.fairness = +fair.value; save(); draw(); } });

  const nName = input({ placeholder: 'Shared cost (e.g. Cleaner)', class: 'input grow' });
  const nAmt = input({ type: 'number', step: '0.01', placeholder: 'Monthly amount', style: { width: '130px' } });

  function addShared() {
    if (!nName.value.trim() || !N(nAmt.value)) return;
    D.shared.push({ id: uid(), name: nName.value.trim(), amt: N(nAmt.value) });
    nName.value = nAmt.value = ''; save(); draw();
  }
  nAmt.addEventListener('keydown', e => e.key === 'Enter' && addShared());

  function compute() {
    const n = D.rooms.length || 1;
    const ws = D.rooms.map(r => {
      const pct = PERKS.reduce((a, [k, , p]) => a + (r.perks[k] ? p : 0), 0) + N(r.adj);
      return Math.max(0.05, N(r.size)) * Math.max(0.05, 1 + pct / 100);
    });
    const W = ws.reduce((a, b) => a + b, 0) || 1;
    const sharedTotal = D.shared.reduce((a, x) => a + x.amt, 0);
    return D.rooms.map((r, i) => {
      const rent = D.total * ((1 - D.fairness) / n + D.fairness * ws[i] / W);
      const sh = sharedTotal / n;
      return { r, weight: ws[i], rent, shared: sh, total: rent + sh, diff: rent - D.total / n };
    });
  }

  function draw() {
    fairLbl.textContent = `Fairness factor: ${Math.round(D.fairness * 100)}% (0% = equal split, 100% = fully by size and perks)`;
    const res = compute(), grand = res.reduce((a, x) => a + x.total, 0);
    render(out,
      el('div', { class: 'row' },
        el('label', { class: 'field' }, 'Total monthly rent', input({ type: 'number', step: '0.01', value: D.total, onchange: e => { D.total = N(e.target.value); save(); draw(); } }))),
      el('h3', {}, 'Rooms'),
      el('div', { class: 'col' }, D.rooms.map(r => el('div', { class: 'panel' },
        el('div', { class: 'row', style: { margin: 0 } },
          input({ value: r.name, class: 'input grow', onchange: e => { r.name = e.target.value.trim() || r.name; save(); draw(); } }),
          el('label', { class: 'inline' }, 'Size m2', input({ type: 'number', min: '1', step: '0.5', value: r.size, style: { width: '80px' }, onchange: e => { r.size = N(e.target.value); save(); draw(); } })),
          el('label', { class: 'inline' }, 'Adjust %', input({ type: 'number', step: '1', value: r.adj || 0, style: { width: '70px' }, onchange: e => { r.adj = N(e.target.value); save(); draw(); } })),
          el('button', { class: 'btn small ghost', disabled: D.rooms.length <= 1, onclick: () => { D.rooms = D.rooms.filter(x => x.id !== r.id); save(); draw(); } }, 'Remove')),
        el('div', { class: 'row small' }, PERKS.map(([k, label, p]) => el('label', { class: 'inline' },
          el('input', { type: 'checkbox', checked: !!r.perks[k], onchange: e => { r.perks[k] = e.target.checked; save(); draw(); } }), `${label} (${p > 0 ? '+' : ''}${p}%)`)))))),
      el('div', { class: 'row' }, el('button', { class: 'btn', onclick: () => { D.rooms.push({ id: uid(), name: 'Room ' + String.fromCharCode(65 + D.rooms.length), size: 12, perks: {}, adj: 0 }); save(); draw(); } }, 'Add room')),
      el('h3', {}, 'Shared costs (split evenly)'),
      D.shared.length ? el('ul', { class: 'list' }, D.shared.map(x => el('li', {}, el('span', { class: 'grow' }, x.name), money(x.amt),
        el('button', { class: 'btn small ghost', onclick: () => { D.shared = D.shared.filter(y => y.id !== x.id); save(); draw(); } }, 'x')))) : null,
      el('div', { class: 'row' }, nName, nAmt, el('button', { class: 'btn', onclick: addShared }, 'Add')),
      el('h3', {}, 'Result'),
      el('div', { class: 'scroll-x' }, el('table', { class: 'table' },
        el('thead', {}, el('tr', {}, ['Room', 'Rent share', 'vs equal split', 'Shared costs', 'Total / month', 'Share'].map(h => el('th', {}, h)))),
        el('tbody', {}, res.map(x => el('tr', {},
          el('td', {}, x.r.name), el('td', {}, money(x.rent)),
          el('td', { style: { color: x.diff > 0.005 ? 'var(--danger)' : x.diff < -0.005 ? 'var(--ok)' : 'inherit' } }, (x.diff >= 0 ? '+' : '') + money(x.diff)),
          el('td', {}, money(x.shared)), el('td', {}, el('b', {}, money(x.total))), el('td', {}, grand ? (x.total / grand * 100).toFixed(1) + '%' : '')))),
        el('tfoot', {}, el('tr', {}, el('td', {}, el('b', {}, 'Total')), el('td', {}, money(res.reduce((a, x) => a + x.rent, 0))), el('td'), el('td', {}, money(res.reduce((a, x) => a + x.shared, 0))), el('td', {}, el('b', {}, money(grand))), el('td'))))),
      exportBar('rent-split',
        () => [['Room', 'Size m2', 'Weight', 'Rent share', 'Shared', 'Total'], ...res.map(x => [x.r.name, x.r.size, x.weight.toFixed(3), x.rent.toFixed(2), x.shared.toFixed(2), x.total.toFixed(2)])],
        () => ({ ...D, result: res.map(x => ({ room: x.r.name, rent: x.rent, shared: x.shared, total: x.total })) })));
  }
  render(root, el('label', { class: 'field' }, fairLbl, fair), out);
  draw();
}
