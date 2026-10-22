import { el, render, store, uid, today } from '../../lib/ui.js';
import { money, N, exportBar, input } from './_h.js';

export default function (root) {
  const s = store('budget-envelopes');
  const nowKey = today().slice(0, 7);
  const D = s.get('data', null) || { cur: nowKey, carry: false, months: {} };
  const save = () => s.set('data', D);
  const keys = () => Object.keys(D.months).sort();

  function ensure(key) {
    if (D.months[key]) return D.months[key];
    const prevKey = keys().filter(k => k < key).pop();
    if (prevKey) {
      const p = D.months[prevKey];
      D.months[key] = { income: p.income, envs: p.envs.map(e => ({ ...e })), spend: [] };
    } else {
      D.months[key] = {
        income: 0, spend: [],
        envs: ['Rent', 'Groceries', 'Transport', 'Fun', 'Savings'].map(name => ({ id: uid(), name, alloc: 0 })),
      };
    }
    return D.months[key];
  }
  function calc(key) {
    const m = D.months[key];
    const prevKey = keys().filter(k => k < key).pop();
    const prev = D.carry && prevKey ? calc(prevKey) : null;
    return m.envs.map(e => {
      const spent = m.spend.filter(x => x.env === e.id).reduce((a, x) => a + x.amt, 0);
      const carry = prev ? (prev.find(p => p.id === e.id) || { remaining: 0 }).remaining : 0;
      return { ...e, spent, carry, avail: e.alloc + carry, remaining: e.alloc + carry - spent };
    });
  }
  function shift(n) {
    const [y, mo] = D.cur.split('-').map(Number);
    const d = new Date(y, mo - 1 + n, 1);
    D.cur = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    save(); draw();
  }

  const spendEnv = el('select', { class: 'select' });
  const spendAmt = input({ type: 'number', step: '0.01', placeholder: 'Amount', style: { width: '110px' } });
  const spendNote = input({ placeholder: 'Note', class: 'input grow' });
  const spendDate = input({ type: 'date', value: today() });
  const newName = input({ placeholder: 'New envelope name' });
  const newAlloc = input({ type: 'number', step: '0.01', placeholder: 'Allocation', style: { width: '120px' } });
  const body = el('div');

  function addSpend() {
    const m = ensure(D.cur), amt = N(spendAmt.value);
    if (!amt || !spendEnv.value) return;
    m.spend.push({ id: uid(), env: spendEnv.value, amt, note: spendNote.value.trim(), date: spendDate.value || today() });
    spendAmt.value = ''; spendNote.value = '';
    save(); draw(); spendAmt.focus();
  }
  function addEnv() {
    const m = ensure(D.cur), name = newName.value.trim();
    if (!name) return;
    m.envs.push({ id: uid(), name, alloc: N(newAlloc.value) });
    newName.value = ''; newAlloc.value = '';
    save(); draw();
  }
  spendAmt.addEventListener('keydown', e => e.key === 'Enter' && addSpend());
  spendNote.addEventListener('keydown', e => e.key === 'Enter' && addSpend());
  newName.addEventListener('keydown', e => e.key === 'Enter' && addEnv());

  function draw() {
    const m = ensure(D.cur), rows = calc(D.cur);
    const alloc = m.envs.reduce((a, e) => a + e.alloc, 0);
    const spent = m.spend.reduce((a, x) => a + x.amt, 0);
    const prevSel = spendEnv.value;
    render(spendEnv, m.envs.map(e => el('option', { value: e.id }, e.name)));
    if (m.envs.some(e => e.id === prevSel)) spendEnv.value = prevSel;
    const unalloc = m.income - alloc;
    render(body,
      el('div', { class: 'row' },
        el('button', { class: 'btn', onclick: () => shift(-1) }, '< Prev'),
        input({ type: 'month', value: D.cur, onchange: e => { if (e.target.value) { D.cur = e.target.value; save(); draw(); } } }),
        el('button', { class: 'btn', onclick: () => shift(1) }, 'Next >'),
        el('label', { class: 'inline' }, el('input', { type: 'checkbox', checked: D.carry, onchange: e => { D.carry = e.target.checked; save(); draw(); } }), 'Carry over leftover (or overspend) to next month'),
      ),
      el('div', { class: 'row' },
        el('label', { class: 'field' }, 'Monthly income', input({ type: 'number', step: '0.01', value: m.income || '', onchange: e => { m.income = N(e.target.value); save(); draw(); } })),
        el('div', { class: 'stat' }, el('div', { class: 'v' }, money(alloc)), el('div', { class: 'l' }, 'allocated')),
        el('div', { class: 'stat' }, el('div', { class: 'v', style: { color: unalloc < 0 ? 'var(--danger)' : 'inherit' } }, money(unalloc)), el('div', { class: 'l' }, 'unallocated')),
        el('div', { class: 'stat' }, el('div', { class: 'v' }, money(spent)), el('div', { class: 'l' }, 'spent')),
        el('div', { class: 'stat' }, el('div', { class: 'v' }, money(m.income - spent)), el('div', { class: 'l' }, 'income left')),
      ),
      el('h3', {}, 'Envelopes'),
      el('div', { class: 'col' }, rows.map(r => {
        const pct = r.avail > 0 ? Math.min(100, Math.max(0, (r.spent / r.avail) * 100)) : (r.spent > 0 ? 100 : 0);
        return el('div', { class: 'panel' },
          el('div', { class: 'row', style: { margin: 0 } },
            input({ value: r.name, class: 'input grow', onchange: e => { const en = m.envs.find(x => x.id === r.id); en.name = e.target.value.trim() || en.name; save(); draw(); } }),
            el('label', { class: 'inline' }, 'Alloc', input({ type: 'number', step: '0.01', value: r.alloc, style: { width: '110px' }, onchange: e => { m.envs.find(x => x.id === r.id).alloc = N(e.target.value); save(); draw(); } })),
            el('button', { class: 'btn small danger', title: 'Delete envelope and its spending', onclick: () => { m.envs = m.envs.filter(x => x.id !== r.id); m.spend = m.spend.filter(x => x.env !== r.id); save(); draw(); } }, 'Delete')),
          el('div', { class: 'bar', style: { margin: '8px 0 4px' } }, el('div', { style: { width: pct + '%', background: r.remaining < 0 ? 'var(--danger)' : pct > 85 ? 'var(--warn)' : 'var(--ok)' } })),
          el('div', { class: 'small muted' },
            `Spent ${money(r.spent)} of ${money(r.avail)}`, r.carry ? ` (incl. ${money(r.carry)} carried)` : '', ' · ',
            el('b', { style: { color: r.remaining < 0 ? 'var(--danger)' : 'var(--ok)' } }, (r.remaining < 0 ? 'Over by ' : 'Remaining ') + money(Math.abs(r.remaining)))));
      })),
      el('div', { class: 'row' }, newName, newAlloc, el('button', { class: 'btn', onclick: addEnv }, 'Add envelope')),
      el('h3', {}, 'Log spending'),
      el('div', { class: 'row' }, spendEnv, spendAmt, spendNote, spendDate, el('button', { class: 'btn primary', onclick: addSpend }, 'Add')),
      m.spend.length ? el('div', { class: 'scroll-x' }, el('table', { class: 'table' },
        el('thead', {}, el('tr', {}, ['Date', 'Envelope', 'Note', 'Amount', ''].map(h => el('th', {}, h)))),
        el('tbody', {}, [...m.spend].sort((a, b) => (b.date || '').localeCompare(a.date || '')).map(x =>
          el('tr', {}, el('td', {}, x.date), el('td', {}, (m.envs.find(e => e.id === x.env) || { name: '?' }).name), el('td', {}, x.note),
            el('td', {}, money(x.amt)), el('td', {}, el('button', { class: 'btn small ghost', onclick: () => { m.spend = m.spend.filter(y => y.id !== x.id); save(); draw(); } }, 'x'))))))) : el('div', { class: 'muted small' }, 'No spending logged this month.'),
      exportBar('budget-' + D.cur,
        () => [['Month', 'Date', 'Envelope', 'Note', 'Amount'], ...m.spend.map(x => [D.cur, x.date, (m.envs.find(e => e.id === x.env) || {}).name, x.note, x.amt])],
        () => ({ month: D.cur, income: m.income, envelopes: rows, spending: m.spend })),
    );
  }
  render(root, body);
  draw();
}
