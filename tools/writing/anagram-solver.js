import { el, render, store, copy } from '../../lib/ui.js';
import { WORDS } from './words.js';

const A = 'a'.charCodeAt(0);
const PRE = WORDS.map(w => {
  const c = new Uint8Array(26);
  for (let i = 0; i < w.length; i++) c[w.charCodeAt(i) - A]++;
  return { w, c };
});

function solve(letters, minLen) {
  const have = new Uint8Array(26);
  let blanks = 0, n = 0;
  for (const ch of letters.toLowerCase()) {
    if (ch === '?' || ch === '*' || ch === '_') blanks++;
    else if (ch >= 'a' && ch <= 'z') { have[ch.charCodeAt(0) - A]++; n++; }
  }
  const total = n + blanks;
  const exact = [], sub = [];
  for (const { w, c } of PRE) {
    if (w.length > total || w.length < minLen) continue;
    let need = 0;
    for (let i = 0; i < 26; i++) { if (c[i] > have[i]) { need += c[i] - have[i]; if (need > blanks) break; } }
    if (need > blanks) continue;
    (w.length === total ? exact : sub).push(w);
  }
  sub.sort((a, b) => b.length - a.length || a.localeCompare(b));
  exact.sort();
  return { exact, sub, total };
}

export default function (root) {
  const s = store('anagram-solver');
  const input = el('input', { class: 'input grow', placeholder: 'Letters, e.g. listen (use ? for a blank tile)', value: s.get('letters', ''), style: { minWidth: '180px' } });
  const minSel = el('select', { class: 'select' }, [2, 3, 4, 5].map(n => el('option', { value: n, selected: n === (s.get('min', 3)) }, 'Min length ' + n)));
  const out = el('div');

  function chips(list, onlyAlready) {
    return el('div', { class: 'row', style: { margin: '2px 0' } }, list.map(w => el('span', { class: 'badge', style: { fontSize: '14px', padding: '3px 10px' } }, w)));
  }
  function run() {
    s.set('letters', input.value); s.set('min', +minSel.value);
    const letters = input.value.trim();
    if (!/[a-z?*_]/i.test(letters)) { render(out, el('div', { class: 'empty' }, 'Enter some letters to find anagrams and shorter words.')); return; }
    if (letters.replace(/[^a-z?*_]/gi, '').length > 15) { render(out, el('div', { class: 'empty' }, 'Please use 15 letters or fewer.')); return; }
    const { exact, sub, total } = solve(letters, +minSel.value);
    const by = {};
    for (const w of sub) (by[w.length] ??= []).push(w);
    const all = [...exact, ...sub];
    render(out,
      el('div', { class: 'row' }, el('strong', {}, `${exact.length} full anagram${exact.length === 1 ? '' : 's'}`), el('span', { class: 'muted' }, `· ${sub.length} shorter word${sub.length === 1 ? '' : 's'} from ${total} letters`),
        el('span', { class: 'grow' }), el('button', { class: 'btn small', disabled: !all.length, onclick: () => copy(all.join('\n')) }, 'Copy all')),
      el('h3', {}, `Anagrams (${total} letters)`),
      exact.length ? chips(exact) : el('p', { class: 'muted' }, 'No full-length anagram in the built-in word list.'),
      Object.keys(by).sort((a, b) => b - a).map(len => el('div', {}, el('h3', {}, `${len} letters (${by[len].length})`), chips(by[len]))));
  }
  input.addEventListener('input', run);
  input.addEventListener('keydown', e => { if (e.key === 'Escape') { input.value = ''; run(); } });
  minSel.addEventListener('change', run);
  render(root, el('div', { class: 'row' }, input, minSel), out);
  run();
}
