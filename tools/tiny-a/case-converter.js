import { el, render, store, copy } from '../../lib/ui.js';

// Split any input (camelCase, snake_case, kebab-case, spaced, UPPER) into lowercase words.
function words(text) {
  return text
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .map(w => w.toLowerCase());
}
const cap = w => w.charAt(0).toUpperCase() + w.slice(1);
const SMALL = new Set(['a', 'an', 'the', 'and', 'but', 'or', 'nor', 'for', 'so', 'yet', 'at', 'by', 'in', 'of', 'on', 'to', 'up', 'as', 'is', 'vs']);

const CASES = [
  ['camelCase', t => words(t).map((w, i) => (i ? cap(w) : w)).join('')],
  ['PascalCase', t => words(t).map(cap).join('')],
  ['snake_case', t => words(t).join('_')],
  ['SCREAMING_SNAKE', t => words(t).join('_').toUpperCase()],
  ['kebab-case', t => words(t).join('-')],
  ['Title Case', t => words(t).map((w, i, a) => (i && i < a.length - 1 && SMALL.has(w) ? w : cap(w))).join(' ')],
  ['Sentence case', t => t.toLowerCase().replace(/(^\s*\p{L}|[.!?]\s+\p{L})/gu, m => m.toUpperCase())],
  ['UPPER CASE', t => t.toUpperCase()],
  ['lower case', t => t.toLowerCase()],
  ['Capitalized Words', t => t.toLowerCase().replace(/\b\p{L}/gu, m => m.toUpperCase())],
  ['dot.case', t => words(t).join('.')],
  ['path/case', t => words(t).join('/')],
  ['iNVERSE cASE', t => [...t].map(c => (c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase())).join('')],
  ['aLtErNaTiNg', t => [...t].map((c, i) => (i % 2 ? c.toUpperCase() : c.toLowerCase())).join('')],
];

export default function (root) {
  const s = store('case-converter');
  const ta = el('textarea', { class: 'textarea prose', placeholder: 'Type or paste text, e.g. "hello world" or "myVariableName"', value: s.get('text', ''), style: { minHeight: '110px' } });
  const list = el('div', { class: 'col' });

  function update() {
    const t = ta.value;
    s.set('text', t);
    render(list, CASES.map(([name, fn]) => {
      const out = t ? fn(t) : '';
      const val = el('div', { class: 'grow mono', style: { wordBreak: 'break-word', whiteSpace: 'pre-wrap', minWidth: '0' } }, out || el('span', { class: 'muted' }, '—'));
      return el('div', { class: 'row', style: { borderBottom: '1px solid var(--line)', padding: '4px 0', margin: 0 } },
        el('span', { class: 'small muted', style: { width: '150px', flex: 'none' } }, name),
        val,
        el('button', { class: 'btn small', disabled: !out, onclick: () => copy(out) }, 'Copy'),
        el('button', { class: 'btn small ghost', disabled: !out, title: 'Use as input', onclick: () => { ta.value = out; update(); } }, '↑'));
    }));
  }

  ta.addEventListener('input', update);
  ta.addEventListener('keydown', e => { if (e.key === 'Escape') { ta.value = ''; update(); } });
  render(root,
    ta,
    el('div', { class: 'row' },
      el('button', { class: 'btn ghost', onclick: () => { ta.value = ''; update(); } }, 'Clear'),
      el('span', { class: 'small muted' }, 'Word boundaries are detected from spaces, punctuation, underscores, dashes and capital letters.')),
    list);
  update();
}
