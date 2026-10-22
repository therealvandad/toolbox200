import { el, render, store, uid, today, copy } from '../../lib/ui.js';
import { pd, iso, addDays, dayDiff, todayDate, fmtDate, exportBar, input } from './_h.js';

// base64url <-> UTF-8 JSON
const enc = obj => {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  let bin = ''; bytes.forEach(b => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const dec = str => {
  const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
};

export default function (root) {
  // The app router owns location.hash, so the shared snapshot rides in the URL query part.
  let shared = null;
  try { const p = new URLSearchParams(location.search).get('share'); if (p) shared = dec(p); } catch { shared = null; }
  const readOnly = !!(shared && Array.isArray(shared.items));

  const s = store('tool-lending');
  let items = readOnly ? shared.items : s.get('items', []);
  const save = () => { if (!readOnly) s.set('items', items); };
  const out = el('div');

  const openLoan = it => it.loans.find(l => !l.back);
  const isOverdue = l => l && !l.back && l.due && pd(l.due) < todayDate();

  const nName = input({ placeholder: 'Item you own (e.g. Cordless drill)', class: 'input grow' });
  const nNote = input({ placeholder: 'Note (optional)', class: 'input grow' });
  const lItem = el('select', { class: 'select' });
  const lWho = input({ placeholder: 'Borrower', style: { width: '150px' } });
  const lOut = input({ type: 'date', value: today() });
  const lDue = input({ type: 'date', value: iso(addDays(todayDate(), 14)) });
  const linkOut = input({ readOnly: true, class: 'input grow', placeholder: 'Press "Create share link"' });

  function addItem() {
    if (!nName.value.trim()) return;
    items.push({ id: uid(), name: nName.value.trim(), note: nNote.value.trim(), loans: [] });
    nName.value = nNote.value = ''; save(); draw();
  }
  function lend() {
    const it = items.find(x => x.id === lItem.value);
    if (!it || !lWho.value.trim()) return;
    if (openLoan(it)) return;
    it.loans.push({ id: uid(), who: lWho.value.trim(), out: lOut.value || today(), due: lDue.value, back: '' });
    lWho.value = ''; save(); draw();
  }
  [nName, nNote].forEach(f => f.addEventListener('keydown', e => e.key === 'Enter' && addItem()));
  lWho.addEventListener('keydown', e => e.key === 'Enter' && lend());

  function makeLink() {
    const snapshot = { items: items.map(i => ({ id: i.id, name: i.name, note: i.note, loans: i.loans })) };
    const url = location.origin + location.pathname + '?share=' + enc(snapshot) + '#/tool/tool-lending';
    linkOut.value = url;
    linkOut.select();
    copy(url);
  }

  function itemRow(it) {
    const open = openLoan(it), od = isOverdue(open);
    const retDate = input({ type: 'date', value: today(), style: { width: '140px' } });
    return el('div', { class: 'panel', style: od ? { borderColor: 'var(--danger)', background: 'rgba(214,69,69,.12)' } : {} },
      el('div', { class: 'row', style: { margin: 0 } },
        el('div', { class: 'grow' }, el('b', {}, it.name), ' ', it.note ? el('span', { class: 'muted small' }, it.note) : null),
        open ? (od ? el('span', { class: 'badge danger' }, `overdue ${dayDiff(pd(open.due), todayDate())}d`) : el('span', { class: 'badge warn' }, 'lent out')) : el('span', { class: 'badge ok' }, 'available'),
        readOnly ? null : el('button', { class: 'btn small ghost', onclick: () => { items = items.filter(x => x.id !== it.id); save(); draw(); } }, 'Delete')),
      open ? el('div', { class: 'row' },
        el('span', {}, `With `, el('b', {}, open.who), ` since ${fmtDate(pd(open.out))}`, open.due ? `, due ${fmtDate(pd(open.due))}` : ''),
        readOnly ? null : [retDate, el('button', { class: 'btn small primary', onclick: () => { open.back = retDate.value || today(); save(); draw(); } }, 'Returned')]) : null,
      it.loans.length ? el('details', {}, el('summary', { class: 'small muted' }, `History (${it.loans.length})`),
        el('div', { class: 'scroll-x' }, el('table', { class: 'table' },
          el('thead', {}, el('tr', {}, ['Borrower', 'Out', 'Due', 'Returned', ''].map(h => el('th', {}, h)))),
          el('tbody', {}, [...it.loans].reverse().map(l => el('tr', {},
            el('td', {}, l.who), el('td', {}, l.out), el('td', {}, l.due || '-'),
            el('td', {}, l.back ? l.back : isOverdue(l) ? el('span', { class: 'badge danger' }, 'overdue') : el('span', { class: 'muted' }, 'out')),
            el('td', {}, readOnly ? null : el('button', { class: 'btn small ghost', onclick: () => { it.loans = it.loans.filter(x => x.id !== l.id); save(); draw(); } }, 'x')))))))) : null);
  }

  function draw() {
    const available = items.filter(i => !openLoan(i));
    const prev = lItem.value;
    render(lItem, available.map(i => el('option', { value: i.id }, i.name)));
    if (available.some(i => i.id === prev)) lItem.value = prev;
    const overdue = items.filter(i => isOverdue(openLoan(i))), out_ = items.filter(i => openLoan(i));
    const sorted = [...items].sort((a, b) => (isOverdue(openLoan(b)) ? 1 : 0) - (isOverdue(openLoan(a)) ? 1 : 0) || (openLoan(b) ? 1 : 0) - (openLoan(a) ? 1 : 0) || a.name.localeCompare(b.name));
    render(out,
      el('div', { class: 'row' },
        el('div', { class: 'stat' }, el('div', { class: 'v' }, items.length), el('div', { class: 'l' }, 'items')),
        el('div', { class: 'stat' }, el('div', { class: 'v' }, out_.length), el('div', { class: 'l' }, 'lent out')),
        el('div', { class: 'stat' }, el('div', { class: 'v', style: { color: overdue.length ? 'var(--danger)' : 'inherit' } }, overdue.length), el('div', { class: 'l' }, 'overdue'))),
      items.length ? el('div', { class: 'col' }, sorted.map(itemRow)) : el('div', { class: 'empty' }, readOnly ? 'This shared list is empty.' : 'Add the items you own and lend out.'),
      readOnly ? null : el('div', {},
        el('h3', {}, 'Share a read-only link'),
        el('div', { class: 'small muted' }, 'The link contains a snapshot of your list. Anyone opening it sees it read-only; later changes are not reflected.'),
        el('div', { class: 'row' }, el('button', { class: 'btn', onclick: makeLink }, 'Create share link'), linkOut),
        exportBar('tool-lending',
          () => [['Item', 'Borrower', 'Out', 'Due', 'Returned'], ...items.flatMap(i => i.loans.length ? i.loans.map(l => [i.name, l.who, l.out, l.due, l.back]) : [[i.name, '', '', '', '']])],
          () => items)));
  }

  if (readOnly) {
    render(root,
      el('div', { class: 'panel' }, el('b', {}, 'Shared view (read-only). '), el('a', { href: location.pathname + '#/tool/tool-lending' }, 'Open my own list')),
      out);
  } else {
    render(root,
      el('div', { class: 'row' }, nName, nNote, el('button', { class: 'btn primary', onclick: addItem }, 'Add item')),
      el('div', { class: 'row' }, el('b', {}, 'Lend:'), lItem, lWho, el('label', { class: 'inline' }, 'Out', lOut), el('label', { class: 'inline' }, 'Due back', lDue), el('button', { class: 'btn', onclick: lend }, 'Lend')),
      out);
  }
  draw();
}
