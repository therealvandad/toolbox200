import { el, render, store, uid, copy, download, toast } from '../../lib/ui.js';

const escHtml = t => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const enc = obj => btoa(unescape(encodeURIComponent(JSON.stringify(obj)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const dec = str => JSON.parse(decodeURIComponent(escape(atob(str.replace(/-/g, '+').replace(/_/g, '/')))));
const letterOf = t => { const c = (t.trim()[0] || '#').toUpperCase(); return /[A-Z]/.test(c.normalize('NFD')[0] || c) ? c.normalize('NFD')[0] : /[0-9]/.test(c) ? '0-9' : '#'; };

function sharedFromUrl() {
  // The app router owns location.hash (#/tool/<id>), so shared data travels in a ?g= parameter
  // and is also accepted as "#g=..." for convenience.
  try {
    const q = new URLSearchParams(location.search).get('g');
    const h = /[#&]g=([^&]+)/.exec(location.hash);
    const raw = q || (h && h[1]);
    if (!raw) return null;
    const arr = dec(raw);
    if (!Array.isArray(arr)) return null;
    return arr.map(x => ({ id: uid(), term: String(x[0] || ''), def: String(x[1] || ''), tags: Array.isArray(x[2]) ? x[2].map(String) : [] })).filter(x => x.term);
  } catch { return null; }
}

export default function (root) {
  const s = store('glossary-builder');
  let items = s.get('items', null) || [
    { id: uid(), term: 'Alliteration', def: 'The repetition of the same initial sound in nearby words.', tags: ['literary'] },
    { id: uid(), term: 'Metaphor', def: 'A figure of speech that describes something as if it were something else.', tags: ['literary'] },
    { id: uid(), term: 'Anagram', def: 'A word formed by rearranging the letters of another.', tags: ['wordplay'] },
  ];
  let q = '', tagFilter = '', editing = null;
  const save = () => s.set('items', items);
  const tIn = el('input', { class: 'input', placeholder: 'Term', style: { minWidth: '140px' } });
  const dIn = el('textarea', { class: 'textarea', rows: 2, placeholder: 'Definition', style: { minHeight: '56px' } });
  const gIn = el('input', { class: 'input', placeholder: 'Tags (comma separated)' });
  const search = el('input', { class: 'input grow', placeholder: 'Search terms, definitions, tags…' });
  const addBtn = el('button', { class: 'btn primary' }, 'Add term');
  const banner = el('div');
  const tagBar = el('div', { class: 'row' });
  const listBox = el('div');
  const linkOut = el('div');

  const allTags = () => [...new Set(items.flatMap(i => i.tags))].sort();
  const visible = () => items.filter(i => {
    if (tagFilter && !i.tags.includes(tagFilter)) return false;
    if (!q) return true;
    const h = (i.term + ' ' + i.def + ' ' + i.tags.join(' ')).toLowerCase();
    return q.toLowerCase().split(/\s+/).every(w => h.includes(w));
  }).sort((a, b) => a.term.localeCompare(b.term, undefined, { sensitivity: 'base' }));

  function refresh() {
    save();
    const tags = allTags();
    render(tagBar, tags.length ? [el('span', { class: 'muted small' }, 'Filter:'), el('button', { class: 'btn small' + (tagFilter ? ' ghost' : ' primary'), onclick: () => { tagFilter = ''; refresh(); } }, 'all'), tags.map(t => el('button', { class: 'btn small' + (tagFilter === t ? ' primary' : ' ghost'), onclick: () => { tagFilter = tagFilter === t ? '' : t; refresh(); } }, '#' + t))] : null);
    const vis = visible();
    if (!vis.length) { render(listBox, el('div', { class: 'empty' }, items.length ? 'No terms match.' : 'Add your first term above.')); return; }
    const groups = {};
    for (const i of vis) (groups[letterOf(i.term)] ??= []).push(i);
    render(listBox, el('div', { class: 'muted small' }, `${vis.length} of ${items.length} terms`),
      Object.keys(groups).sort().map(L => el('div', {},
        el('h3', { style: { borderBottom: '1px solid var(--line)', paddingBottom: '2px' } }, L),
        groups[L].map(i => editing === i.id ? editRow(i) : el('div', { style: { padding: '6px 0' } },
          el('div', { class: 'row', style: { margin: 0 } }, el('strong', { class: 'grow' }, i.term),
            el('button', { class: 'btn small ghost', onclick: () => { editing = i.id; refresh(); } }, 'Edit'),
            el('button', { class: 'btn small danger ghost', onclick: () => { items = items.filter(x => x.id !== i.id); refresh(); } }, '✕')),
          el('div', {}, i.def),
          i.tags.length ? el('div', { class: 'row', style: { margin: '2px 0' } }, i.tags.map(t => el('span', { class: 'badge' }, t))) : null)))));
  }
  function editRow(i) {
    const t = el('input', { class: 'input', value: i.term }), d = el('textarea', { class: 'textarea', rows: 2, value: i.def, style: { minHeight: '56px' } }), g = el('input', { class: 'input', value: i.tags.join(', ') });
    return el('div', { class: 'panel col', style: { margin: '6px 0' } }, t, d, g,
      el('div', { class: 'row', style: { margin: 0 } },
        el('button', { class: 'btn small primary', onclick: () => { if (!t.value.trim()) return; i.term = t.value.trim(); i.def = d.value.trim(); i.tags = parseTags(g.value); editing = null; refresh(); } }, 'Save'),
        el('button', { class: 'btn small', onclick: () => { editing = null; refresh(); } }, 'Cancel')));
  }
  const parseTags = v => [...new Set(v.split(/[,#]/).map(x => x.trim().toLowerCase()).filter(Boolean))];
  function add() {
    const term = tIn.value.trim();
    if (!term) { toast('Enter a term'); return; }
    items.push({ id: uid(), term, def: dIn.value.trim(), tags: parseTags(gIn.value) });
    tIn.value = ''; dIn.value = ''; gIn.value = ''; tIn.focus(); refresh();
  }
  addBtn.addEventListener('click', add);
  tIn.addEventListener('keydown', e => { if (e.key === 'Enter') add(); });
  search.addEventListener('input', () => { q = search.value; refresh(); });
  search.addEventListener('keydown', e => { if (e.key === 'Escape') { search.value = ''; q = ''; refresh(); } });

  const sorted = () => [...items].sort((a, b) => a.term.localeCompare(b.term, undefined, { sensitivity: 'base' }));
  function toMd() {
    const lines = ['# Glossary', ''];
    let cur = '';
    for (const i of sorted()) {
      const L = letterOf(i.term);
      if (L !== cur) { cur = L; lines.push(`## ${L}`, ''); }
      lines.push(`**${i.term}** — ${i.def}${i.tags.length ? '  \n*Tags: ' + i.tags.join(', ') + '*' : ''}`, '');
    }
    return lines.join('\n');
  }
  function toHtml() {
    let cur = '', body = '';
    for (const i of sorted()) {
      const L = letterOf(i.term);
      if (L !== cur) { if (cur) body += '</dl>\n'; cur = L; body += `<h2>${escHtml(L)}</h2>\n<dl>\n`; }
      body += `  <dt>${escHtml(i.term)}</dt>\n  <dd>${escHtml(i.def)}${i.tags.length ? ` <small>(${i.tags.map(escHtml).join(', ')})</small>` : ''}</dd>\n`;
    }
    if (cur) body += '</dl>\n';
    return `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><title>Glossary</title>\n<style>body{font:16px/1.5 system-ui,sans-serif;max-width:720px;margin:2rem auto;padding:0 1rem}dt{font-weight:700;margin-top:.8rem}dd{margin:0}</style></head>\n<body>\n<h1>Glossary</h1>\n${body}</body></html>\n`;
  }
  function makeLink() {
    const data = enc(sorted().map(i => [i.term, i.def, i.tags]));
    const url = location.origin + location.pathname + '?g=' + data + (location.hash.startsWith('#/tool/') ? location.hash.split('?')[0] : '#/tool/glossary-builder');
    render(linkOut,
      el('textarea', { class: 'textarea mono', rows: 3, readOnly: true, value: url, onfocus: e => e.target.select() }),
      el('div', { class: 'row' }, el('button', { class: 'btn primary', onclick: () => copy(url) }, 'Copy link'), el('span', { class: 'muted small' }, `${url.length.toLocaleString()} characters${url.length > 8000 ? ' (very long, some apps may truncate it)' : ''}`)));
  }

  const shared = sharedFromUrl();
  if (shared && shared.length) {
    const clear = () => { try { history.replaceState(null, '', location.pathname + '#/tool/glossary-builder'); } catch {} render(banner); };
    render(banner, el('div', { class: 'panel row' }, el('span', { class: 'grow' }, `A shared glossary with ${shared.length} term${shared.length === 1 ? '' : 's'} was found in this link.`),
      el('button', { class: 'btn small primary', onclick: () => { items = shared; clear(); refresh(); toast('Loaded shared glossary'); } }, 'Replace mine'),
      el('button', { class: 'btn small', onclick: () => { const have = new Set(items.map(i => i.term.toLowerCase())); items.push(...shared.filter(x => !have.has(x.term.toLowerCase()))); clear(); refresh(); toast('Merged'); } }, 'Merge'),
      el('button', { class: 'btn small ghost', onclick: clear }, 'Ignore')));
  }

  render(root, banner,
    el('div', { class: 'panel col' }, el('div', { class: 'row', style: { margin: 0 } }, tIn, gIn), dIn, el('div', {}, addBtn)),
    el('div', { class: 'row' }, search), tagBar, listBox,
    el('h3', {}, 'Export & share'),
    el('div', { class: 'row' },
      el('button', { class: 'btn', onclick: () => download('glossary.md', toMd(), 'text/markdown') }, 'Download Markdown'),
      el('button', { class: 'btn', onclick: () => download('glossary.html', toHtml(), 'text/html') }, 'Download HTML'),
      el('button', { class: 'btn', onclick: () => copy(toMd()) }, 'Copy Markdown'),
      el('button', { class: 'btn', onclick: makeLink }, 'Create shareable link')),
    linkOut);
  refresh();
}
