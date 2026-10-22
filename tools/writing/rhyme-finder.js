import { el, render, store, copy } from '../../lib/ui.js';
import { WORDS } from './words.js';

const IRREG = { break: 'brAk', great: 'grAt', steak: 'stAk', love: 'luv', above: 'abuv', dove: 'duv', glove: 'gluv', shove: 'shuv', done: 'dun', none: 'nun', one: 'wun', son: 'sun', ton: 'tun', won: 'wun', some: 'sum', come: 'kum', money: 'munE', honey: 'hunE', monkey: 'munkE', who: 'hU', do: 'dU', to: 'tU', two: 'tU', too: 'tU', shoe: 'shU', blue: 'blU', true: 'trU', through: 'thrU', threw: 'thrU', you: 'yU', your: 'yJr', four: 'fJr', door: 'dJr', floor: 'flJr', poor: 'pJr', pour: 'pJr', more: 'mJr', store: 'stJr', roar: 'rJr', board: 'bJrd', sword: 'sJrd', word: 'wRd', world: 'wRld', work: 'wRk', worm: 'wRm', worth: 'wRth', worse: 'wRs', worry: 'wRE', heart: 'hQt', hear: 'hEr', here: 'hEr', where: 'wAr', there: 'thAr', their: 'thAr', bear: 'bAr', pear: 'pAr', wear: 'wAr', tear: 'tAr', swear: 'swAr', fear: 'fEr', year: 'yEr', near: 'nEr', dear: 'dEr', clear: 'klEr', beer: 'bEr', deer: 'dEr', cheer: 'chEr', steer: 'stEr', head: 'hed', bread: 'bred', dead: 'ded', read: 'rEd', thread: 'thred', spread: 'spred', breath: 'breth', health: 'helth', wealth: 'welth', heaven: 'hevn', heavy: 'hevE', weather: 'wether', feather: 'fether', leather: 'lether', measure: 'mezhr', treasure: 'trezhr', pleasure: 'plezhr', eight: 'At', weight: 'wAt', height: 'hIt', neighbor: 'nAbr', sleigh: 'slA', they: 'thA', obey: 'obA', prey: 'prA', grey: 'grA', blood: 'blud', flood: 'flud', good: 'gUd', wood: 'wUd', stood: 'stUd', hood: 'hUd', food: 'fUd', mood: 'mUd', would: 'wUd', could: 'kUd', should: 'shUd', laugh: 'laf', cough: 'kJf', enough: 'enuf', tough: 'tuf', rough: 'ruf', dough: 'dO', though: 'thO', bough: 'bW', plough: 'plW', ocean: 'Oshn', island: 'Ilnd', iron: 'Irn', giant: 'jIt', idea: 'IdEa', again: 'agen', said: 'sed', says: 'sez', friend: 'frend', guess: 'ges', guest: 'gest', build: 'bild', built: 'bilt', busy: 'bizE', buy: 'bI', guy: 'gI', eye: 'I', eyes: 'Iz', die: 'dI', lie: 'lI', pie: 'pI', tie: 'tI', fly: 'flI', sky: 'skI', sly: 'slI', try: 'trI', cry: 'krI', dry: 'drI', fry: 'frI', why: 'wI', my: 'mI', by: 'bI', shy: 'shI', spy: 'spI', sigh: 'sI', high: 'hI', thigh: 'thI', bye: 'bI', rye: 'rI', dye: 'dI', aisle: 'Il', isle: 'Il', smile: 'smIl', toe: 'tO', hoe: 'hO', foe: 'fO', woe: 'wO', doe: 'dO', row: 'rO', low: 'lO', slow: 'slO', know: 'nO', no: 'nO', go: 'gO', so: 'sO', show: 'shO', grow: 'grO', throw: 'thrO', snow: 'snO', blow: 'blO', flow: 'flO', glow: 'glO', crow: 'krO', bow: 'bO', cow: 'kW', how: 'hW', now: 'nW', brow: 'brW', plow: 'plW', vow: 'vW', wow: 'wW' };

const isV = c => 'aeiouAEIOUWYJQR'.includes(c);

function phones(word) {
  let w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (IRREG[w]) return IRREG[w];
  w = w.replace(/^kn/, 'n').replace(/^wr/, 'r').replace(/^ps/, 's').replace(/^gn/, 'n');
  w = w.replace(/mb$/, 'm').replace(/tch/g, 'C').replace(/dge/g, 'j').replace(/ph/g, 'f').replace(/ck/g, 'k').replace(/sh/g, 'S').replace(/ch/g, 'C').replace(/th/g, 'T');
  w = w.replace(/tion$/, 'Sun').replace(/sion$/, 'Sun').replace(/cian$/, 'Sun').replace(/ture$/, 'Cr').replace(/ous$/, 'us');
  w = w.replace(/ight/g, 'It').replace(/igh/g, 'I').replace(/eigh/g, 'A');
  // magic e: vowel + consonant + e at end (also with s/d suffix)
  w = w.replace(/([aeiou])([^aeiouy])e(s|d)?$/, (m, v, c, suf) => v.toUpperCase() + c + (suf || ''));
  w = w.replace(/ai|ay/g, 'A').replace(/ee|ea/g, 'E').replace(/ie$/, 'I').replace(/ie/g, 'E').replace(/oa/g, 'O').replace(/oe$/, 'O')
    .replace(/oo|ew|ue|ui/g, 'U').replace(/ou|ow/g, 'W').replace(/oi|oy/g, 'Y').replace(/au|aw/g, 'J').replace(/all/g, 'Jl')
    .replace(/er|ir|ur|ear(?=[^aeiou])/g, 'R').replace(/ar/g, 'Q').replace(/or/g, 'Jr');
  w = w.replace(/ng/g, 'N').replace(/ey$/, 'E');
  if (/[^aeiouAEIOUWYJQR]y$/.test(w)) {
    w = w.slice(0, -1) + (syl(word) <= 1 ? 'I' : 'E');
  }
  w = w.replace(/c(?=[eiy])/g, 's').replace(/c/g, 'k').replace(/g(?=e)/g, 'j').replace(/x/g, 'ks').replace(/q/g, 'k').replace(/gh$/g, '').replace(/([^aeiouAEIOUWYJQR])\1/g, '$1');
  w = w.replace(/e$/, (m) => (/[aeiouAEIOUWYJQR]/.test(w.slice(0, -1)) ? '' : m)).replace(/(.)e(s|d)$/, (m, a, b) => (isV(a) ? m : a + b));
  return w;
}
function syl(word) {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (w.length <= 3) return 1;
  let x = /[td]ed$/.test(w) ? w : w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
  x = x.replace(/^y/, '');
  return Math.max(1, (x.match(/[aeiouy]{1,2}/g) || []).length);
}
const UNSTRESSED = /(?:E|R|l|n|Sun|Cr|ing|Nz?|us|Id)$/;
function parts(word) {
  const p = phones(word);
  const idx = [];
  for (let i = 0; i < p.length; i++) if (isV(p[i]) && !(i > 0 && isV(p[i - 1]))) idx.push(i);
  if (!idx.length) return { vowel: '', coda: p, key: p };
  let k = idx[idx.length - 1];
  const trailingUnstressed = /(?:E|R|Sun|Cr|ing|us)$/.test(p) || /[^aeiouAEIOUWYJQR]l$/.test(p) || /[^aeiouAEIOUWYJQR]n$/.test(p) && /[aeiou]n$/.test(p);
  if (idx.length > 1 && trailingUnstressed && !IRREG[word.toLowerCase()]) k = idx[idx.length - 2];
  let e = k; while (e < p.length && isV(p[e])) e++;
  return { vowel: p.slice(k, e), coda: p.slice(e), key: p.slice(k) };
}
const CLASS = { p: 'P', b: 'P', t: 'T', d: 'T', k: 'K', g: 'K', s: 'S', z: 'S', f: 'F', v: 'F', m: 'M', n: 'M', N: 'M', S: 'S', C: 'T', j: 'T', T: 'F', l: 'L', r: 'L', h: '', w: '', y: '' };
const cls = s => [...s].map(c => CLASS[c] ?? c).join('');

let INDEX = null;
function build() {
  if (INDEX) return INDEX;
  INDEX = WORDS.map(w => ({ w, s: syl(w), ...parts(w) }));
  return INDEX;
}

function find(word) {
  const idx = build();
  const t = { w: word.toLowerCase(), s: syl(word), ...parts(word) };
  const perfect = [], near = [];
  for (const c of idx) {
    if (c.w === t.w) continue;
    if (c.key === t.key && c.key) perfect.push(c);
    else if (c.vowel === t.vowel && cls(c.coda) === cls(t.coda) && c.vowel) near.push(c);
    else if (c.coda === t.coda && c.coda.length >= 2 && c.vowel && c.s === t.s) near.push(c);
  }
  // prefer words with matching syllable count first, then alphabetical
  const sorter = (a, b) => Math.abs(a.s - t.s) - Math.abs(b.s - t.s) || a.w.localeCompare(b.w);
  perfect.sort(sorter); near.sort(sorter);
  return { t, perfect, near };
}

export default function (root) {
  const s = store('rhyme-finder');
  const input = el('input', { class: 'input grow', placeholder: 'Type a word, e.g. light', value: s.get('word', ''), style: { minWidth: '160px' } });
  const out = el('div');
  const hist = el('div', { class: 'row' });

  function group(list) {
    const by = {};
    for (const c of list) (by[c.s] ??= []).push(c.w);
    return Object.keys(by).sort((a, b) => a - b).map(n =>
      el('div', { style: { margin: '6px 0' } },
        el('div', { class: 'muted small' }, `${n} syllable${n == 1 ? '' : 's'} (${by[n].length})`),
        el('div', { class: 'row', style: { margin: '2px 0' } }, by[n].slice(0, 80).map(w =>
          el('button', { class: 'btn small', onclick: () => { input.value = w; run(); }, title: 'Rhymes for ' + w }, w)))));
  }
  function run() {
    const w = input.value.trim().split(/\s+/).pop().replace(/[^A-Za-z]/g, '');
    s.set('word', input.value);
    if (!w) { render(out, el('div', { class: 'empty' }, 'Enter a word to find rhymes.')); return; }
    const { t, perfect, near } = find(w);
    const h = [w.toLowerCase(), ...s.get('hist', []).filter(x => x !== w.toLowerCase())].slice(0, 8);
    s.set('hist', h);
    render(hist, h.length > 1 ? [el('span', { class: 'muted small' }, 'Recent:'), h.slice(1).map(x => el('button', { class: 'btn small ghost', onclick: () => { input.value = x; run(); } }, x))] : null);
    render(out,
      el('p', { class: 'muted small' }, `Sound key for "${w}": `, el('span', { class: 'mono' }, t.key || '?'), ` · ${t.s} syllable${t.s === 1 ? '' : 's'}`),
      el('h3', {}, `Perfect rhymes (${perfect.length})`),
      perfect.length ? group(perfect) : el('p', { class: 'muted' }, 'No perfect rhymes in the built-in list.'),
      el('h3', {}, `Near rhymes (${near.length})`),
      near.length ? group(near) : el('p', { class: 'muted' }, 'No near rhymes found.'),
      el('div', { class: 'row' },
        el('button', { class: 'btn', disabled: !perfect.length, onclick: () => copy(perfect.map(c => c.w).join(', ')) }, 'Copy perfect rhymes'),
        el('button', { class: 'btn', disabled: !near.length, onclick: () => copy(near.map(c => c.w).join(', ')) }, 'Copy near rhymes')),
      el('p', { class: 'muted small' }, 'Rhymes are guessed from spelling patterns, so a few results may be off. Works fully offline.'));
  }
  input.addEventListener('keydown', e => { if (e.key === 'Enter') run(); else if (e.key === 'Escape') { input.value = ''; run(); } });
  render(root, el('div', { class: 'row' }, input, el('button', { class: 'btn primary', onclick: run }, 'Find rhymes')), hist, out);
  run();
}
export { find as _find, phones as _phones };
