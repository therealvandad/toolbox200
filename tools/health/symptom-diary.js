// Allergy & symptom diary: entries with date, symptom tags, severity, triggers, notes; filter; trigger x symptom table; CSV export.
import { el, render, store, uid, today, toast, stat, field, download } from '../../lib/ui.js';

const SYM_SUGGEST = ['sneezing', 'runny nose', 'itchy eyes', 'headache', 'rash', 'cough', 'nausea', 'fatigue', 'bloating', 'wheezing', 'congestion', 'hives'];
const TRG_SUGGEST = ['pollen', 'dust', 'pet dander', 'dairy', 'gluten', 'nuts', 'stress', 'lack of sleep', 'smoke', 'exercise', 'alcohol', 'cold air'];

const splitTags = str => [...new Set(String(str).split(/[,;\n]/).map(t => t.trim().toLowerCase()).filter(Boolean))];

export default function (root) {
  const s = store('symptom-diary');
  let entries = s.get('entries', []);       // {id, date, symptoms[], severity, triggers[], notes}
  const save = () => s.set('entries', entries);

  const dateIn = el('input', { class: 'input', type: 'date', value: today() });
  const symIn = el('input', { class: 'input grow', placeholder: 'Symptoms, comma separated', list: 'sd-sym' });
  const trgIn = el('input', { class: 'input grow', placeholder: 'Possible triggers, comma separated', list: 'sd-trg' });
  const sevIn = el('input', { type: 'range', min: 1, max: 10, value: 4, oninput: () => (sevVal.textContent = sevIn.value) });
  const sevVal = el('b', {}, '4');
  const noteIn = el('textarea', { class: 'textarea prose', style: { minHeight: '60px' }, placeholder: 'Notes (food, weather, medication, location…)' });
  const dlSym = el('datalist', { id: 'sd-sym' });
  const dlTrg = el('datalist', { id: 'sd-trg' });
  let editing = null;
  const addBtn = el('button', { class: 'btn primary', onclick: () => submit() }, 'Add entry');
  const cancelBtn = el('button', { class: 'btn ghost hidden', onclick: () => resetForm() }, 'Cancel edit');

  const fText = el('input', { class: 'input', type: 'search', placeholder: 'Filter by symptom, trigger or note', oninput: () => update() });
  const fFrom = el('input', { class: 'input', type: 'date', onchange: () => update() });
  const fTo = el('input', { class: 'input', type: 'date', onchange: () => update() });
  const fSev = el('select', { class: 'select', onchange: () => update() }, [1, 3, 5, 7, 9].map(v => el('option', { value: v }, v === 1 ? 'any severity' : `severity ${v}+`)));
  const stats = el('div', { class: 'row' });
  const matrix = el('div', { class: 'scroll-x' });
  const listBox = el('div', { class: 'scroll-x' });

  const quick = (arr, input) => el('div', { class: 'row', style: { margin: '2px 0' } }, arr.map(t => el('button', { class: 'btn small ghost', onclick: () => { const cur = splitTags(input.value); if (!cur.includes(t)) cur.push(t); input.value = cur.join(', '); } }, '+ ' + t)));

  function resetForm() {
    editing = null; symIn.value = trgIn.value = noteIn.value = ''; sevIn.value = 4; sevVal.textContent = '4'; dateIn.value = today();
    addBtn.textContent = 'Add entry'; cancelBtn.classList.add('hidden');
  }
  function submit() {
    const symptoms = splitTags(symIn.value), triggers = splitTags(trgIn.value);
    if (!dateIn.value) { toast('Pick a date'); return; }
    if (!symptoms.length) { toast('Add at least one symptom'); return; }
    const e = { id: editing || uid(), date: dateIn.value, symptoms, severity: +sevIn.value, triggers, notes: noteIn.value.trim() };
    if (editing) entries = entries.map(x => (x.id === editing ? e : x)); else entries.push(e);
    entries.sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1));
    save(); resetForm(); update(); toast('Saved');
  }
  function startEdit(e) {
    editing = e.id; dateIn.value = e.date; symIn.value = e.symptoms.join(', '); trgIn.value = e.triggers.join(', ');
    sevIn.value = e.severity; sevVal.textContent = e.severity; noteIn.value = e.notes || '';
    addBtn.textContent = 'Save changes'; cancelBtn.classList.remove('hidden');
    dateIn.focus();
  }

  function filtered() {
    const q = fText.value.trim().toLowerCase(), min = +fSev.value || 1;
    return entries.filter(e => (!fFrom.value || e.date >= fFrom.value) && (!fTo.value || e.date <= fTo.value) && e.severity >= min &&
      (!q || [...e.symptoms, ...e.triggers, e.notes || ''].join(' ').toLowerCase().includes(q)));
  }

  function exportCsv() {
    const rows = [['date', 'symptoms', 'severity', 'triggers', 'notes']];
    filtered().slice().reverse().forEach(e => rows.push([e.date, e.symptoms.join('; '), e.severity, e.triggers.join('; '), e.notes || '']));
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    download('symptom-diary.csv', csv, 'text/csv');
  }

  function update() {
    const all = new Set(), allT = new Set();
    entries.forEach(e => { e.symptoms.forEach(x => all.add(x)); e.triggers.forEach(x => allT.add(x)); });
    render(dlSym, [...new Set([...all, ...SYM_SUGGEST])].map(v => el('option', { value: v })));
    render(dlTrg, [...new Set([...allT, ...TRG_SUGGEST])].map(v => el('option', { value: v })));
    const list = filtered();
    const avg = list.length ? list.reduce((a, b) => a + b.severity, 0) / list.length : 0;
    render(stats, stat(list.length, `entries${list.length !== entries.length ? ' (filtered)' : ''}`), stat(avg ? avg.toFixed(1) : '–', 'average severity'), stat(new Set(list.map(e => e.date)).size, 'days with symptoms'));

    // trigger x symptom frequency
    const sc = {}, tc = {}, cell = {};
    list.forEach(e => {
      e.symptoms.forEach(sy => { sc[sy] = (sc[sy] || 0) + 1; });
      e.triggers.forEach(tr => { tc[tr] = (tc[tr] || 0) + 1; e.symptoms.forEach(sy => { const k = tr + '\u0000' + sy; (cell[k] ||= { n: 0, sev: 0 }); cell[k].n++; cell[k].sev += e.severity; }); });
    });
    const syms = Object.keys(sc).sort((a, b) => sc[b] - sc[a]).slice(0, 8), trgs = Object.keys(tc).sort((a, b) => tc[b] - tc[a]).slice(0, 12);
    const maxN = Math.max(1, ...Object.values(cell).map(c => c.n));
    render(matrix, trgs.length && syms.length ? el('table', { class: 'table' },
      el('thead', {}, el('tr', {}, el('th', {}, 'Trigger \\ symptom'), syms.map(sy => el('th', {}, `${sy} (${sc[sy]})`)), el('th', {}, 'Total'))),
      el('tbody', {}, trgs.map(tr => el('tr', {}, el('td', {}, tr),
        syms.map(sy => { const c = cell[tr + '\u0000' + sy]; return el('td', { title: c ? `avg severity ${(c.sev / c.n).toFixed(1)}` : '', style: c ? { background: `color-mix(in srgb, var(--accent) ${Math.round(15 + 70 * c.n / maxN)}%, var(--bg))`, textAlign: 'center' } : { textAlign: 'center', color: 'var(--muted)' } }, c ? c.n : '·'); }),
        el('td', {}, tc[tr]))))) : el('div', { class: 'muted small' }, 'Log entries with both symptoms and triggers to see which go together. Counts show how many entries share each pair.'));

    render(listBox, list.length ? el('table', { class: 'table' }, el('thead', {}, el('tr', {}, ['Date', 'Symptoms', 'Sev', 'Triggers', 'Notes', ''].map(h => el('th', {}, h)))),
      el('tbody', {}, list.map(e => el('tr', {}, el('td', {}, e.date), el('td', {}, e.symptoms.join(', ')),
        el('td', {}, el('span', { class: 'badge ' + (e.severity >= 7 ? 'danger' : e.severity >= 4 ? 'warn' : 'ok') }, e.severity)),
        el('td', {}, e.triggers.join(', ') || '–'), el('td', { class: 'muted' }, e.notes || ''),
        el('td', { style: { whiteSpace: 'nowrap' } },
          el('button', { class: 'btn small ghost', onclick: () => startEdit(e) }, 'Edit'),
          el('button', { class: 'btn small ghost', onclick: () => { entries = entries.filter(x => x.id !== e.id); save(); update(); } }, '✕')))))) : el('div', { class: 'muted' }, entries.length ? 'No entries match the filter.' : 'No entries yet.'));
  }

  render(root,
    dlSym, dlTrg,
    el('div', { class: 'panel col' },
      el('div', { class: 'row' }, field('Date', dateIn), el('label', { class: 'field' }, 'Severity (1-10) ', sevIn, sevVal)),
      el('div', { class: 'row' }, symIn), quick(SYM_SUGGEST.slice(0, 8), symIn),
      el('div', { class: 'row' }, trgIn), quick(TRG_SUGGEST.slice(0, 8), trgIn),
      noteIn, el('div', { class: 'row' }, addBtn, cancelBtn)),
    el('h3', {}, 'Filter'),
    el('div', { class: 'row' }, fText, field('From', fFrom), field('To', fTo), fSev,
      el('button', { class: 'btn small ghost', onclick: () => { fText.value = fFrom.value = fTo.value = ''; fSev.value = 1; update(); } }, 'Reset')),
    stats,
    el('h3', {}, 'Triggers vs symptoms'), matrix,
    el('div', { class: 'row' }, el('h3', { style: { margin: 0 } }, 'Entries'), el('button', { class: 'btn small', onclick: exportCsv }, 'Export CSV')),
    listBox,
    el('p', { class: 'muted small' }, 'Patterns here are simple counts, not a diagnosis. Share the CSV with your doctor if useful. Entries stay in this browser only.'));
  update();
}
