import { el, render, store, copy, download, readFile, toast } from '../../lib/ui.js';

const DEFAULTS = [
  { a: 'API', m: 'Application Programming Interface' }, { a: 'ASAP', m: 'As Soon As Possible' }, { a: 'FAQ', m: 'Frequently Asked Questions' },
  { a: 'KPI', m: 'Key Performance Indicator' }, { a: 'ROI', m: 'Return on Investment' }, { a: 'SLA', m: 'Service Level Agreement' },
];
const esc = t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export default function (root) {
  const s = store('acronym-glossary');
  let items = s.get('items', null) || DEFAULTS.map(x => ({ ...x }));
  let caseSensitive = s.get('cs', true);
  let mode = s.get('mode', 'tooltip');
  const save = () => { s.set('items', items); s.set('cs', caseSensitive); s.set('mode', mode); };

  const listBox = el('div');
  const aIn = el('input', { class: 'input', placeholder: 'Acronym', style: { width: '120px' } });
  const mIn = el('input', { class: 'input grow', placeholder: 'Meaning', style: { minWidth: '160px' } });
  const ta = el('textarea', { class: 'textarea prose', rows: 6, placeholder: 'Paste text containing acronyms…', value: s.get('text', 'Please send the API docs ASAP so we can update the FAQ and track the KPI.') });
  const out = el('div', { class: 'panel', style: { lineHeight: '1.8', whiteSpace: 'pre-wrap', minHeight: '80px' } });
  const info = el('div', { class: 'small muted' });
  const modeSel = el('select', { class: 'select' }, el('option', { value: 'tooltip' }, 'Tooltips only'), el('option', { value: 'first' }, 'Expand first use inline'), el('option', { value: 'all' }, 'Expand every use inline'));
  modeSel.value = mode;
  const csChk = el('input', { type: 'checkbox', checked: caseSensitive });

  function rx() {
    const keys = items.map(i => i.a.trim()).filter(Boolean).sort((a, b) => b.length - a.length);
    if (!keys.length) return null;
    return new RegExp('(?<![A-Za-z0-9])(' + keys.map(esc).join('|') + ')(?![A-Za-z0-9])', caseSensitive ? 'g' : 'gi');
  }
  const lookup = k => items.find(i => caseSensitive ? i.a.trim() === k : i.a.trim().toLowerCase() === k.toLowerCase());

  function expanded() {
    const r = rx(); const text = ta.value; if (!r) return text;
    const seen = new Set();
    return text.replace(r, (m) => {
      const it = lookup(m); if (!it) return m;
      const key = it.a.toLowerCase();
      if (mode !== 'all' && seen.has(key)) return m;
      seen.add(key);
      return `${m} (${it.m})`;
    });
  }
  function update() {
    s.set('text', ta.value);
    const r = rx(); const text = ta.value;
    if (!text) { render(out, el('span', { class: 'muted' }, 'Expansions appear here.')); render(info); return; }
    if (!r) { render(out, text); render(info); return; }
    const parts = []; let last = 0, m, found = new Map(); const seen = new Set();
    r.lastIndex = 0;
    while ((m = r.exec(text))) {
      const it = lookup(m[0]); if (!it) continue;
      if (m.index > last) parts.push(text.slice(last, m.index));
      const first = !seen.has(it.a.toLowerCase()); seen.add(it.a.toLowerCase());
      found.set(it.a, (found.get(it.a) || 0) + 1);
      parts.push(el('abbr', { title: it.m, style: { textDecoration: 'underline dotted', cursor: 'help', color: 'var(--accent)', fontWeight: '600' } }, m[0]));
      if (mode === 'all' || (mode === 'first' && first)) parts.push(el('span', { class: 'muted' }, ` (${it.m})`));
      last = m.index + m[0].length;
    }
    parts.push(text.slice(last));
    render(out, parts);
    render(info, found.size ? `${found.size} acronym${found.size > 1 ? 's' : ''} found: ` + [...found].map(([k, v]) => `${k}×${v}`).join(', ') : 'No acronyms from your list found in this text.');
  }
  function renderList() {
    if (!items.length) { render(listBox, el('div', { class: 'empty', style: { padding: '14px' } }, 'No acronyms yet. Add one above.')); return; }
    const sorted = items.map((it, i) => ({ it, i })).sort((x, y) => x.it.a.localeCompare(y.it.a));
    render(listBox, el('ul', { class: 'list' }, sorted.map(({ it, i }) => {
      const a = el('input', { class: 'input', value: it.a, style: { width: '110px', fontWeight: '700' } });
      const m = el('input', { class: 'input grow', value: it.m });
      a.addEventListener('input', () => { it.a = a.value; save(); update(); });
      m.addEventListener('input', () => { it.m = m.value; save(); update(); });
      return el('li', {}, a, m, el('button', { class: 'btn small danger ghost', title: 'Remove', onclick: () => { items.splice(i, 1); save(); renderList(); update(); } }, '✕'));
    })));
  }
  function add() {
    const a = aIn.value.trim(), m = mIn.value.trim();
    if (!a || !m) { toast('Enter both an acronym and its meaning'); return; }
    const ex = items.find(i => i.a === a);
    if (ex) ex.m = m; else items.push({ a, m });
    aIn.value = ''; mIn.value = ''; aIn.focus(); save(); renderList(); update();
  }
  [aIn, mIn].forEach(i => i.addEventListener('keydown', e => { if (e.key === 'Enter') add(); }));
  ta.addEventListener('input', update);
  modeSel.addEventListener('change', () => { mode = modeSel.value; save(); update(); });
  csChk.addEventListener('change', () => { caseSensitive = csChk.checked; save(); update(); });
  const fileIn = el('input', { type: 'file', accept: '.json,application/json', class: 'hidden' });
  fileIn.addEventListener('change', async () => {
    try {
      const o = JSON.parse(await readFile(fileIn.files[0]));
      let arr = Array.isArray(o) ? o : Object.entries(o).map(([a, m]) => ({ a, m }));
      arr = arr.map(x => ({ a: String(x.a ?? x.acronym ?? ''), m: String(x.m ?? x.meaning ?? '') })).filter(x => x.a && x.m);
      if (!arr.length) throw new Error('empty');
      for (const x of arr) { const ex = items.find(i => i.a === x.a); if (ex) ex.m = x.m; else items.push(x); }
      save(); renderList(); update(); toast(`Imported ${arr.length} acronyms`);
    } catch { toast('Could not read that JSON file'); }
    fileIn.value = '';
  });

  render(root,
    el('div', { class: 'grid2' },
      el('div', {}, el('h3', { style: { marginTop: 0 } }, 'Your acronym list'),
        el('div', { class: 'row' }, aIn, mIn, el('button', { class: 'btn primary', onclick: add }, 'Add')),
        listBox,
        el('div', { class: 'row' },
          el('button', { class: 'btn', onclick: () => download('acronyms.json', JSON.stringify(items, null, 2), 'application/json') }, 'Export JSON'),
          el('button', { class: 'btn', onclick: () => fileIn.click() }, 'Import JSON'), fileIn)),
      el('div', {}, el('h3', { style: { marginTop: 0 } }, 'Your text'), ta,
        el('div', { class: 'row' }, el('label', { class: 'inline' }, 'Display', modeSel), el('label', { class: 'inline' }, csChk, 'Case sensitive')),
        out, info,
        el('div', { class: 'row' }, el('button', { class: 'btn', onclick: () => copy(expanded()) }, 'Copy text with expansions')))));
  renderList(); update();
}
