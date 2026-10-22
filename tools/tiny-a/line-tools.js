import { el, render, store, copy, download, shuffle, stat } from '../../lib/ui.js';

export default function (root) {
  const s = store('line-tools');
  const ta = el('textarea', { class: 'textarea', placeholder: 'One item per line…', value: s.get('text', ''), style: { minHeight: '220px' } });
  const stats = el('div', { class: 'row' });
  const caseBox = el('input', { type: 'checkbox', checked: s.get('ci', false) });
  const history = [];

  const lines = () => ta.value.split(/\r?\n/);
  const key = l => (caseBox.checked ? l.toLowerCase() : l);
  const num = l => { const m = l.match(/-?\d+(\.\d+)?/); return m ? parseFloat(m[0]) : Number.POSITIVE_INFINITY; };
  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

  function apply(fn) {
    history.push(ta.value);
    if (history.length > 30) history.shift();
    ta.value = fn(lines()).join('\n');
    update();
  }
  function update() {
    const ls = lines();
    const nonEmpty = ls.filter(l => l.trim());
    const uniq = new Set(nonEmpty.map(key)).size;
    render(stats, stat(ta.value ? ls.length : 0, 'lines'), stat(nonEmpty.length, 'non-empty'), stat(uniq, 'unique'), stat(nonEmpty.length - uniq, 'duplicates'), stat(ta.value.length, 'characters'));
    s.set('text', ta.value); s.set('ci', caseBox.checked);
  }

  const ops = [
    ['Remove duplicates', ls => { const seen = new Set(); return ls.filter(l => { const k = key(l); if (seen.has(k)) return false; seen.add(k); return true; }); }],
    ['Keep only duplicates', ls => { const c = new Map(); ls.forEach(l => c.set(key(l), (c.get(key(l)) || 0) + 1)); const seen = new Set(); return ls.filter(l => c.get(key(l)) > 1 && !seen.has(key(l)) && seen.add(key(l))); }],
    ['Sort A → Z', ls => [...ls].sort(collator.compare)],
    ['Sort Z → A', ls => [...ls].sort(collator.compare).reverse()],
    ['Sort numeric', ls => [...ls].sort((a, b) => num(a) - num(b))],
    ['Sort by length', ls => [...ls].sort((a, b) => a.length - b.length || collator.compare(a, b))],
    ['Reverse', ls => [...ls].reverse()],
    ['Shuffle', ls => shuffle(ls)],
    ['Trim whitespace', ls => ls.map(l => l.trim())],
    ['Remove empty lines', ls => ls.filter(l => l.trim())],
    ['Number lines', ls => ls.map((l, i) => `${i + 1}. ${l}`)],
    ['Strip numbering', ls => ls.map(l => l.replace(/^\s*(\d+[.)]|[-*•])\s+/, ''))],
    ['lowercase', ls => ls.map(l => l.toLowerCase())],
    ['UPPERCASE', ls => ls.map(l => l.toUpperCase())],
    ['Join with commas', ls => [ls.filter(l => l.trim()).map(l => l.trim()).join(', ')]],
    ['Split commas into lines', ls => ls.flatMap(l => l.split(',').map(x => x.trim()).filter(Boolean))],
  ];

  const prefix = el('input', { class: 'input', placeholder: 'prefix', style: { width: '110px' } });
  const suffix = el('input', { class: 'input', placeholder: 'suffix', style: { width: '110px' } });

  ta.addEventListener('input', update);
  caseBox.addEventListener('change', update);
  render(root,
    ta,
    stats,
    el('div', { class: 'row' }, ops.map(([name, fn]) => el('button', { class: 'btn small', onclick: () => apply(fn) }, name))),
    el('div', { class: 'row' },
      prefix, suffix,
      el('button', { class: 'btn small', onclick: () => apply(ls => ls.map(l => (l.trim() ? prefix.value + l + suffix.value : l))) }, 'Add prefix / suffix'),
      el('label', { class: 'inline' }, caseBox, 'Ignore case when comparing')),
    el('div', { class: 'row' },
      el('button', { class: 'btn primary', onclick: () => copy(ta.value) }, 'Copy'),
      el('button', { class: 'btn', onclick: () => download('lines.txt', ta.value) }, 'Download .txt'),
      el('button', { class: 'btn', onclick: () => { if (history.length) { ta.value = history.pop(); update(); } } }, 'Undo'),
      el('button', { class: 'btn ghost', onclick: () => { history.push(ta.value); ta.value = ''; update(); } }, 'Clear')));
  update();
}
