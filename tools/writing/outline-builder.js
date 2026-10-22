import { el, render, store, uid, copy, download } from '../../lib/ui.js';

const DEFAULT = () => [
  { id: uid(), text: 'Introduction', note: 'Hook, background, thesis statement.', depth: 0 },
  { id: uid(), text: 'Hook', note: '', depth: 1 },
  { id: uid(), text: 'Thesis', note: '', depth: 1 },
  { id: uid(), text: 'Body paragraph 1', note: '', depth: 0 },
  { id: uid(), text: 'Conclusion', note: '', depth: 0 },
];

export default function (root) {
  const s = store('outline-builder');
  let nodes = s.get('nodes', null) || DEFAULT();
  let title = s.get('title', 'My essay');
  let notesOpen = new Set(nodes.filter(n => n.note).map(n => n.id));
  let focusId = null;
  const list = el('div', { class: 'col', style: { gap: '4px' } });
  const preview = el('pre', { class: 'out' });
  const titleIn = el('input', { class: 'input grow', value: title, placeholder: 'Outline title' });

  const save = () => { s.set('nodes', nodes); s.set('title', title); };
  const end = i => { let j = i + 1; while (j < nodes.length && nodes[j].depth > nodes[i].depth) j++; return j; };
  const idx = id => nodes.findIndex(n => n.id === id);

  function numbering() {
    const counters = []; const labels = [];
    const roman = n => { const m = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]; let r = ''; for (const [v, c] of m) while (n >= v) { r += c; n -= v; } return r; };
    for (const n of nodes) {
      counters.length = n.depth + 1;
      for (let d = 0; d <= n.depth; d++) counters[d] = counters[d] || 0;
      counters[n.depth]++;
      const c = counters[n.depth];
      const k = n.depth % 4;
      labels.push(k === 0 ? roman(c) + '.' : k === 1 ? String.fromCharCode(64 + ((c - 1) % 26) + 1) + '.' : k === 2 ? c + '.' : String.fromCharCode(96 + ((c - 1) % 26) + 1) + '.');
    }
    return labels;
  }
  function markdown() {
    const lines = [];
    if (title.trim()) lines.push('# ' + title.trim(), '');
    for (const n of nodes) {
      lines.push('#'.repeat(Math.min(n.depth + 2, 6)) + ' ' + (n.text || '(untitled)'));
      if (n.note.trim()) lines.push('', n.note.trim());
      lines.push('');
    }
    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
  }

  const act = {
    add(i, depthOverride) { const n = { id: uid(), text: '', note: '', depth: depthOverride ?? nodes[i].depth }; nodes.splice(end(i), 0, n); focusId = n.id; },
    child(i) { const n = { id: uid(), text: '', note: '', depth: nodes[i].depth + 1 }; nodes.splice(i + 1, 0, n); focusId = n.id; },
    indent(i) {
      if (i === 0 || nodes[i - 1].depth < nodes[i].depth) return;
      // can only go one deeper than previous node
      const e = end(i); for (let j = i; j < e; j++) nodes[j].depth++; focusId = nodes[i].id;
    },
    outdent(i) { if (nodes[i].depth === 0) return; const e = end(i); for (let j = i; j < e; j++) nodes[j].depth--; focusId = nodes[i].id; },
    up(i) {
      const d = nodes[i].depth; let j = i - 1;
      while (j >= 0 && nodes[j].depth > d) j--;
      if (j < 0 || nodes[j].depth < d) return;
      const block = nodes.splice(i, end(i) - i); nodes.splice(j, 0, ...block); focusId = block[0].id;
    },
    down(i) {
      const e = end(i); if (e >= nodes.length || nodes[e].depth < nodes[i].depth) return;
      const e2 = end(e); const block = nodes.splice(i, e - i); nodes.splice(e2 - block.length, 0, ...block); focusId = block[0].id;
    },
    del(i) { const e = end(i); nodes.splice(i, e - i); if (!nodes.length) nodes.push({ id: uid(), text: '', note: '', depth: 0 }); },
  };
  function apply(name, id) { const i = idx(id); if (i < 0) return; act[name](i); refresh(); }

  function row(n, label) {
    const open = notesOpen.has(n.id);
    const input = el('input', { class: 'input grow', value: n.text, placeholder: 'Heading…', 'data-id': n.id, style: { fontWeight: n.depth === 0 ? '700' : '400' } });
    input.addEventListener('input', () => { n.text = input.value; save(); preview.textContent = markdown(); });
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); apply('add', n.id); }
      else if (e.key === 'Tab') { e.preventDefault(); apply(e.shiftKey ? 'outdent' : 'indent', n.id); }
      else if (e.key === 'ArrowUp' && e.altKey) { e.preventDefault(); apply('up', n.id); }
      else if (e.key === 'ArrowDown' && e.altKey) { e.preventDefault(); apply('down', n.id); }
    });
    const b = (t, title, fn, extra = '') => el('button', { class: 'btn small ' + extra, title, onclick: fn }, t);
    const note = el('textarea', { class: 'textarea', rows: 2, placeholder: 'Notes for this section…', value: n.note, style: { minHeight: '50px', marginLeft: (n.depth * 22 + 30) + 'px', width: `calc(100% - ${n.depth * 22 + 30}px)` } });
    note.addEventListener('input', () => { n.note = note.value; save(); preview.textContent = markdown(); });
    return el('div', {},
      el('div', { class: 'row', style: { margin: 0, flexWrap: 'nowrap', paddingLeft: (n.depth * 22) + 'px' } },
        el('span', { class: 'muted mono small', style: { minWidth: '26px' } }, label),
        input,
        b('◀', 'Outdent (Shift+Tab)', () => apply('outdent', n.id)), b('▶', 'Indent (Tab)', () => apply('indent', n.id)),
        b('▲', 'Move up (Alt+Up)', () => apply('up', n.id)), b('▼', 'Move down (Alt+Down)', () => apply('down', n.id)),
        b('+', 'Add sibling (Enter)', () => apply('add', n.id)), b('↳', 'Add sub-heading', () => apply('child', n.id)),
        b(open ? 'Hide note' : (n.note ? 'Note •' : 'Note'), 'Toggle notes', () => { open ? notesOpen.delete(n.id) : notesOpen.add(n.id); refresh(); }),
        b('✕', 'Delete (and its children)', () => apply('del', n.id), 'danger ghost')),
      open ? note : null);
  }
  function refresh() {
    save();
    const labels = numbering();
    render(list, nodes.map((n, i) => row(n, labels[i])));
    preview.textContent = markdown();
    if (focusId) { const f = list.querySelector(`input[data-id="${focusId}"]`); if (f) f.focus(); focusId = null; }
  }
  titleIn.addEventListener('input', () => { title = titleIn.value; save(); preview.textContent = markdown(); });

  render(root,
    el('div', { class: 'row' }, titleIn,
      el('button', { class: 'btn primary', onclick: () => { nodes.push({ id: uid(), text: '', note: '', depth: 0 }); focusId = nodes[nodes.length - 1].id; refresh(); } }, '+ Top-level heading')),
    el('p', { class: 'muted small' }, 'Enter adds a sibling, Tab / Shift+Tab indent and outdent, Alt+Up / Alt+Down reorder.'),
    list,
    el('h3', {}, 'Markdown'),
    preview,
    el('div', { class: 'row' },
      el('button', { class: 'btn primary', onclick: () => copy(markdown()) }, 'Copy Markdown'),
      el('button', { class: 'btn', onclick: () => download((title.trim().replace(/[^\w-]+/g, '-').toLowerCase() || 'outline') + '.md', markdown(), 'text/markdown') }, 'Download .md'),
      el('button', { class: 'btn ghost', onclick: () => { nodes = DEFAULT(); title = 'My essay'; titleIn.value = title; notesOpen = new Set(nodes.filter(n => n.note).map(n => n.id)); refresh(); } }, 'Reset to template')));
  refresh();
}
