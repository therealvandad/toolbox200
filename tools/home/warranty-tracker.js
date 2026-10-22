import { el, render, store, uid, today, loadImage, toast } from '../../lib/ui.js';
import { N, pd, iso, addMonths, dayDiff, todayDate, fmtDate, exportBar, input } from './_h.js';

async function compress(file) {
  const img = await loadImage(file);
  const k = Math.min(1, 1000 / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
  g.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.7);
}

export default function (root) {
  const s = store('warranty-tracker');
  let items = s.get('items', []);
  let q = '', editId = null, receipt = '', viewing = null;
  const save = () => {
    s.set('items', items);
    const back = s.get('items', null);
    if (!back || back.length !== items.length) toast('Storage is full: remove some receipt photos');
  };

  const fName = input({ placeholder: 'Product', class: 'input grow' });
  const fStore = input({ placeholder: 'Store', style: { width: '140px' } });
  const fDate = input({ type: 'date', value: today() });
  const fMonths = input({ type: 'number', min: '1', step: '1', value: '24', style: { width: '80px' } });
  const fNote = input({ placeholder: 'Note / serial no.', class: 'input grow' });
  const fileIn = el('input', { type: 'file', accept: 'image/*', onchange: async () => {
    const f = fileIn.files && fileIn.files[0];
    if (!f) return;
    try { receipt = await compress(f); recLbl.textContent = 'Receipt attached (' + Math.round(receipt.length * 0.75 / 1024) + ' KB)'; }
    catch { toast('Could not read that image'); }
  } });
  const recLbl = el('span', { class: 'small muted' }, 'No receipt');
  const addBtn = el('button', { class: 'btn primary', onclick: submit }, 'Add');
  const cancelBtn = el('button', { class: 'btn ghost hidden', onclick: clearForm }, 'Cancel');
  const search = input({ type: 'search', placeholder: 'Search products, stores, notes...', class: 'input grow', oninput: () => { q = search.value.toLowerCase(); draw(); } });
  search.addEventListener('keydown', e => { if (e.key === 'Escape') { search.value = ''; q = ''; draw(); } });
  const out = el('div'), viewer = el('div');

  function clearForm() {
    editId = null; receipt = ''; fName.value = ''; fStore.value = ''; fNote.value = ''; fDate.value = today(); fMonths.value = '24'; fileIn.value = '';
    recLbl.textContent = 'No receipt'; addBtn.textContent = 'Add'; cancelBtn.classList.add('hidden');
  }
  function submit() {
    if (!fName.value.trim() || !fDate.value) return;
    const rec = { name: fName.value.trim(), store: fStore.value.trim(), date: fDate.value, months: Math.max(1, Math.round(N(fMonths.value)) || 1), note: fNote.value.trim() };
    const cur = editId && items.find(x => x.id === editId);
    if (cur) { Object.assign(cur, rec); if (receipt) cur.receipt = receipt; }
    else items.push({ id: uid(), ...rec, receipt });
    save(); clearForm(); draw();
  }
  fName.addEventListener('keydown', e => e.key === 'Enter' && submit());
  function edit(it) {
    editId = it.id; receipt = '';
    fName.value = it.name; fStore.value = it.store; fDate.value = it.date; fMonths.value = it.months; fNote.value = it.note || '';
    recLbl.textContent = it.receipt ? 'Receipt kept (choose a file to replace)' : 'No receipt';
    addBtn.textContent = 'Save'; cancelBtn.classList.remove('hidden'); fName.focus();
  }

  function draw() {
    const t = todayDate();
    const rows = items.map(it => { const exp = addMonths(pd(it.date), it.months); return { it, exp, days: dayDiff(t, exp) }; })
      .filter(r => !q || (r.it.name + ' ' + r.it.store + ' ' + (r.it.note || '')).toLowerCase().includes(q))
      .sort((a, b) => a.exp - b.exp);
    const soon = rows.filter(r => r.days >= 0 && r.days <= 60);
    const badge = r => r.days < 0 ? el('span', { class: 'badge danger' }, `expired ${-r.days}d ago`) : r.days <= 60 ? el('span', { class: 'badge warn' }, `${r.days}d left`) : el('span', { class: 'badge ok' }, r.days > 365 ? `${(r.days / 365).toFixed(1)}y left` : `${r.days}d left`);
    render(viewer, viewing && (items.find(x => x.id === viewing) || {}).receipt ? el('div', { class: 'panel center' },
      el('div', { class: 'row', style: { justifyContent: 'space-between' } }, el('b', {}, 'Receipt: ' + items.find(x => x.id === viewing).name), el('button', { class: 'btn small', onclick: () => { viewing = null; draw(); } }, 'Close')),
      el('img', { src: items.find(x => x.id === viewing).receipt, style: { maxWidth: '100%', borderRadius: '8px' } })) : null);
    render(out,
      el('div', { class: 'row' },
        el('div', { class: 'stat' }, el('div', { class: 'v' }, items.length), el('div', { class: 'l' }, 'products')),
        el('div', { class: 'stat' }, el('div', { class: 'v', style: { color: soon.length ? 'var(--warn)' : 'inherit' } }, soon.length), el('div', { class: 'l' }, 'expiring within 60 days')),
        el('div', { class: 'stat' }, el('div', { class: 'v' }, rows.filter(r => r.days < 0).length), el('div', { class: 'l' }, 'expired'))),
      rows.length ? el('div', { class: 'scroll-x' }, el('table', { class: 'table' },
        el('thead', {}, el('tr', {}, ['Product', 'Store', 'Purchased', 'Warranty', 'Expires', 'Receipt', ''].map(h => el('th', {}, h)))),
        el('tbody', {}, rows.map(r => el('tr', { style: r.days >= 0 && r.days <= 60 ? { background: 'rgba(217,140,11,.18)' } : {} },
          el('td', {}, el('b', {}, r.it.name), r.it.note ? el('div', { class: 'small muted' }, r.it.note) : null),
          el('td', {}, r.it.store), el('td', {}, fmtDate(pd(r.it.date))), el('td', {}, r.it.months + ' mo'),
          el('td', {}, fmtDate(r.exp), ' ', badge(r)),
          el('td', {}, r.it.receipt ? el('img', { src: r.it.receipt, title: 'View receipt', style: { height: '40px', borderRadius: '4px', cursor: 'pointer', border: '1px solid var(--line)' }, onclick: () => { viewing = r.it.id; draw(); } }) : el('span', { class: 'muted' }, '-')),
          el('td', {}, el('button', { class: 'btn small', onclick: () => edit(r.it) }, 'Edit'), ' ', el('button', { class: 'btn small ghost', onclick: () => { items = items.filter(x => x.id !== r.it.id); if (viewing === r.it.id) viewing = null; save(); draw(); } }, 'x')))))))
        : el('div', { class: 'empty' }, items.length ? 'Nothing matches your search.' : 'No products yet. Add one above.'),
      exportBar('warranties',
        () => [['Product', 'Store', 'Purchased', 'Warranty months', 'Expires', 'Note'], ...items.map(it => [it.name, it.store, it.date, it.months, iso(addMonths(pd(it.date), it.months)), it.note || ''])],
        () => items));
  }
  render(root,
    el('div', { class: 'row' }, fName, fStore, el('label', { class: 'inline' }, 'Purchased', fDate), el('label', { class: 'inline' }, 'Warranty (months)', fMonths)),
    el('div', { class: 'row' }, fNote, el('label', { class: 'inline' }, 'Receipt photo', fileIn), recLbl, addBtn, cancelBtn),
    el('div', { class: 'row' }, search),
    viewer, out);
  draw();
}
