// Command palette: Ctrl+K opens a fuzzy-searchable list of demo commands plus every Toolbox tool.
import { el, render, store, copy, toast } from '../../lib/ui.js';
import { registry, categories } from '../../registry.js';

/** Subsequence fuzzy match. Returns {score, idx} (matched character indices) or null. */
function fuzzy(query, text) {
  const q = query.toLowerCase(), t = text.toLowerCase();
  if (!q) return { score: 0, idx: [] };
  let qi = 0, score = 0, prev = -2; const idx = [];
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] !== q[qi]) continue;
    let s = 1;
    if (i === prev + 1) s += 3;                       // consecutive run
    if (i === 0 || /[\s\-_/:.(]/.test(t[i - 1])) s += 2;  // start of a word
    score += s; idx.push(i); prev = i; qi++;
  }
  if (qi < q.length) return null;                     // not every query char found
  score -= (idx[idx.length - 1] - idx[0] + 1 - q.length) * 0.2; // spread penalty
  if (t.startsWith(q)) score += 5;
  return { score, idx };
}

const SNIPPET = `// Minimal command palette (vanilla JS, no dependencies)
// commands: [{ id, title, keywords?, run() }]
${fuzzy.toString()}

export function createPalette(commands, { recentKey = 'palette:recent' } = {}) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.4);display:none;align-items:flex-start;justify-content:center;padding-top:12vh;z-index:1000';
  overlay.innerHTML = \`<div style="width:min(560px,92vw);background:#fff;color:#111;border-radius:12px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.3)">
    <input style="width:100%;box-sizing:border-box;padding:14px 16px;font-size:16px;border:0;border-bottom:1px solid #e5e5e5;outline:0" placeholder="Type a command…">
    <ul style="list-style:none;margin:0;padding:6px;max-height:50vh;overflow:auto"></ul></div>\`;
  document.body.append(overlay);
  const input = overlay.querySelector('input'), list = overlay.querySelector('ul');
  let items = [], active = 0;
  const recent = () => { try { return JSON.parse(localStorage.getItem(recentKey)) || []; } catch { return []; } };

  function search(q) {
    if (!q) { const r = recent(); return [...r.map(id => commands.find(c => c.id === id)).filter(Boolean), ...commands.filter(c => !r.includes(c.id))]; }
    return commands.map(c => ({ c, m: fuzzy(q, c.title) || (c.keywords && fuzzy(q, c.keywords) && { score: -5, idx: [] }) }))
      .filter(x => x.m).sort((a, b) => b.m.score - a.m.score).map(x => x.c);
  }
  function draw() {
    items = search(input.value.trim()).slice(0, 50); active = Math.min(active, Math.max(0, items.length - 1));
    list.replaceChildren(...items.map((c, i) => {
      const li = document.createElement('li');
      li.textContent = c.title;
      li.style.cssText = 'padding:8px 10px;border-radius:8px;cursor:pointer' + (i === active ? ';background:#2f6fed;color:#fff' : '');
      li.onmouseenter = () => { active = i; draw(); };
      li.onclick = () => run(c);
      return li;
    }));
    list.children[active]?.scrollIntoView({ block: 'nearest' });
  }
  function run(c) {
    close();
    localStorage.setItem(recentKey, JSON.stringify([c.id, ...recent().filter(id => id !== c.id)].slice(0, 8)));
    c.run();
  }
  function open() { overlay.style.display = 'flex'; input.value = ''; active = 0; draw(); input.focus(); }
  function close() { overlay.style.display = 'none'; }
  input.addEventListener('input', () => { active = 0; draw(); });
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); active = (active + 1) % items.length; draw(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = (active - 1 + items.length) % items.length; draw(); }
    else if (e.key === 'Enter' && items[active]) run(items[active]);
    else if (e.key === 'Escape') close();
  });
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  const onKey = e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); overlay.style.display === 'flex' ? close() : open(); } };
  window.addEventListener('keydown', onKey);
  return { open, close, destroy() { window.removeEventListener('keydown', onKey); overlay.remove(); } };
}

// usage:
// const palette = createPalette([{ id: 'home', title: 'Go home', run: () => location.hash = '#/' }]);
`;

export default function (root) {
  const s = store('command-palette');
  const log = el('ul', { class: 'list' });
  const logEmpty = el('div', { class: 'muted small' }, 'Nothing run yet.');
  const demoPanel = el('div', { class: 'panel hidden' }, 'This panel was toggled by a command.');
  const catTitle = slug => (categories.find(c => c.slug === slug) || {}).title || slug;

  const commands = [
    { id: 'home', title: 'Go to the Toolbox home', group: 'Navigation', run: () => { location.hash = '#/'; } },
    { id: 'random', title: 'Open a random tool', group: 'Navigation', keywords: 'surprise lucky', run: () => { const t = registry[Math.floor(Math.random() * registry.length)]; location.hash = '#/tool/' + t.id; } },
    ...categories.map(c => ({ id: 'cat:' + c.slug, title: 'Browse: ' + c.title, group: 'Navigation', keywords: c.slug + ' category', run: () => { location.hash = '#/cat/' + c.slug; } })),
    { id: 'top', title: 'Scroll to top', group: 'Demo', run: () => window.scrollTo({ top: 0, behavior: 'smooth' }) },
    { id: 'bottom', title: 'Scroll to bottom', group: 'Demo', run: () => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }) },
    { id: 'copy-url', title: 'Copy page URL', group: 'Demo', keywords: 'link share clipboard', run: () => copy(location.href) },
    { id: 'toggle-panel', title: 'Toggle demo panel', group: 'Demo', keywords: 'show hide', run: () => { demoPanel.classList.toggle('hidden'); } },
    { id: 'time', title: 'Show current time', group: 'Demo', keywords: 'clock date now', run: () => toast(new Date().toLocaleString()) },
    { id: 'clear-recent', title: 'Clear recent commands', group: 'Demo', run: () => { s.del('recent'); toast('Recents cleared'); } },
    { id: 'copy-code', title: 'Copy the palette implementation', group: 'Demo', keywords: 'source snippet', run: () => copy(SNIPPET) },
    ...registry.map(t => ({ id: 'tool:' + t.id, title: `Tool: ${t.title}`, sub: `#${t.num} · ${catTitle(t.category)}`, group: 'Tools', keywords: `${t.id} ${t.keywords || ''} ${t.desc}`, run: () => { location.hash = '#/tool/' + t.id; } })),
  ];

  // ---- palette UI ----
  const input = el('input', { class: 'input', placeholder: 'Type a command or tool name…', style: { width: '100%', borderRadius: 0, border: 0, borderBottom: '1px solid var(--line)', padding: '14px 16px', fontSize: '16px', background: 'var(--panel)' } });
  const list = el('ul', { class: 'list', style: { maxHeight: '50vh', overflow: 'auto', padding: '6px' } });
  const empty = el('div', { class: 'muted center small', style: { padding: '18px' } }, 'No matching commands');
  const box = el('div', { style: { width: 'min(600px, 94vw)', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: '12px', boxShadow: '0 20px 60px rgba(0,0,0,.35)', overflow: 'hidden' } },
    input, list, empty,
    el('div', { class: 'row small muted', style: { padding: '6px 12px', borderTop: '1px solid var(--line)', margin: 0 } },
      el('span', {}, el('span', { class: 'kbd' }, '↑'), ' ', el('span', { class: 'kbd' }, '↓'), ' navigate'),
      el('span', {}, el('span', { class: 'kbd' }, '↵'), ' run'),
      el('span', {}, el('span', { class: 'kbd' }, 'esc'), ' close')));
  const overlay = el('div', { class: 'hidden', style: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '10vh', zIndex: 40 } }, box);
  overlay.addEventListener('mousedown', e => { if (e.target === overlay) close(); });

  let items = [], active = 0, isOpen = false;
  const recent = () => s.get('recent', []);

  function search(q) {
    if (!q) {
      const r = recent().map(id => commands.find(c => c.id === id)).filter(Boolean);
      return [...r.map(c => ({ c, idx: [], recent: true })), ...commands.filter(c => !r.includes(c)).map(c => ({ c, idx: [] }))];
    }
    return commands.map(c => {
      const m = fuzzy(q, c.title);
      if (m) return { c, idx: m.idx, score: m.score + (c.group === 'Tools' ? 0 : 1) };
      const k = c.keywords && fuzzy(q, c.keywords);
      return k ? { c, idx: [], score: k.score - 8 } : null;
    }).filter(Boolean).sort((a, b) => b.score - a.score);
  }
  function highlight(text, idx) {
    if (!idx.length) return text;
    const set = new Set(idx);
    return [...text].map((ch, i) => set.has(i) ? el('b', { style: { color: 'inherit' } }, ch) : ch);
  }
  function draw() {
    items = search(input.value.trim()).slice(0, 60);
    active = Math.min(active, Math.max(0, items.length - 1));
    empty.classList.toggle('hidden', items.length > 0);
    let lastHdr = '';
    const nodes = [];
    items.forEach((it, i) => {
      const hdr = it.recent ? 'Recent' : it.c.group;
      if (!input.value.trim() && hdr !== lastHdr) { nodes.push(el('li', { class: 'muted small', style: { padding: '6px 10px 2px', border: 0, textTransform: 'uppercase', letterSpacing: '.06em', fontSize: '11px' } }, hdr)); lastHdr = hdr; }
      const on = i === active;
      const li = el('li', { style: { padding: '8px 10px', borderRadius: '8px', cursor: 'pointer', border: 0, background: on ? 'var(--accent)' : '', color: on ? 'var(--accent-text)' : '' },
        onmouseenter: () => { if (active !== i) { active = i; draw(); } }, onclick: () => run(it.c) },
        el('span', { class: 'grow' }, highlight(it.c.title, it.idx), it.c.sub ? el('span', { class: 'small', style: { opacity: .7, marginLeft: '8px' } }, it.c.sub) : null),
        it.recent ? el('span', { class: 'small', style: { opacity: .7 } }, 'recent') : null);
      li.dataset.i = i;
      nodes.push(li);
    });
    render(list, nodes);
    list.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }
  function run(c) {
    close();
    s.set('recent', [c.id, ...recent().filter(id => id !== c.id)].slice(0, 8));
    logEmpty.classList.add('hidden');
    render(log, el('li', {}, el('span', { class: 'muted small' }, new Date().toLocaleTimeString()), el('span', { class: 'grow' }, 'Ran: ' + c.title)), ...[...log.children].slice(0, 5));
    c.run();
  }
  function open() { isOpen = true; overlay.classList.remove('hidden'); input.value = ''; active = 0; draw(); input.focus(); }
  function close() { isOpen = false; overlay.classList.add('hidden'); }
  input.addEventListener('input', () => { active = 0; draw(); });
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); if (items.length) { active = (active + 1) % items.length; draw(); } }
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (items.length) { active = (active - 1 + items.length) % items.length; draw(); } }
    else if (e.key === 'Enter') { if (items[active]) run(items[active].c); }
    else if (e.key === 'Escape') { e.stopPropagation(); close(); }
  });
  const onKey = e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); isOpen ? close() : open(); }
    else if (e.key === 'Escape' && isOpen) close();
  };
  window.addEventListener('keydown', onKey);

  const code = el('pre', { class: 'out', style: { maxHeight: '420px' } }, SNIPPET);
  render(root,
    el('div', { class: 'row' },
      el('span', { class: 'grow' }, 'Press ', el('span', { class: 'kbd' }, 'Ctrl'), ' + ', el('span', { class: 'kbd' }, 'K'), ' (or ⌘K) anywhere on this page, or '),
      el('button', { class: 'btn primary', onclick: open }, 'Open palette')),
    el('p', { class: 'muted small' }, `${commands.length} commands: navigation, a few demo actions and every one of the ${registry.length} tools in this Toolbox. Fuzzy matching scores consecutive and word-start hits; Enter runs the highlighted command and recents are remembered.`),
    demoPanel,
    el('h3', { style: { margin: '14px 0 4px', fontSize: '15px' } }, 'Command log'),
    el('div', { class: 'panel' }, log, logEmpty),
    el('h3', { style: { margin: '18px 0 4px', fontSize: '15px' } }, 'Implementation'),
    el('div', { class: 'row' }, el('span', { class: 'muted small grow' }, 'Drop-in vanilla JS: fuzzy matcher, overlay, keyboard navigation, recents in localStorage.'),
      el('button', { class: 'btn small', onclick: () => copy(SNIPPET) }, 'Copy code')),
    code,
    overlay);
  return () => { window.removeEventListener('keydown', onKey); };
}
