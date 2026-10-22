import { el, render, store } from '../../lib/ui.js';

const EXC = { the: 1, area: 3, idea: 3, being: 2, create: 2, poem: 2, poet: 2, poetry: 3, fire: 1, hour: 1, our: 1, flower: 2, power: 2, tower: 2, shower: 2, every: 2, everything: 3, evening: 2, different: 2, family: 3, camera: 3, interest: 3, business: 2, chocolate: 2, comfortable: 3, favorite: 3, beautiful: 3, memory: 3, usually: 3, actually: 4, quiet: 2, science: 2, violet: 3, diamond: 2, orange: 2, vegetable: 3, average: 3, several: 3, wednesday: 2, aluminum: 4, simile: 3, coyote: 3, iron: 2, once: 1, one: 1, lion: 2, ruin: 2, real: 1, really: 2, create: 2, naive: 2, fuel: 2, cruel: 2, jewel: 2, dual: 2, trial: 2, dial: 2, giant: 2, client: 2, ion: 2, riot: 2, diet: 2, via: 2, media: 3, radio: 3, video: 3, studio: 3, curious: 3, serious: 3, various: 3, previous: 3, delicious: 3, million: 2, brilliant: 2, genius: 2, ocean: 2, special: 2, social: 2, nation: 2, patient: 2, ancient: 2, being: 2, seeing: 2, doing: 2, going: 2, lying: 2, flying: 2, crying: 2, dying: 2, buying: 2, trying: 2, drying: 2, scientist: 3, society: 4, variety: 4, anxiety: 4, quiet: 2, poem: 2, heaven: 2, seven: 2, eleven: 3, even: 2, open: 2, haiku: 2, people: 2, little: 2, whistle: 2, castle: 2, gentle: 2, simple: 2, table: 2, purple: 2, circle: 2, middle: 2, idle: 2, bottle: 2, candle: 2, handle: 2, apple: 2, ripple: 2, cycle: 2, bicycle: 3, example: 3, able: 2, noble: 2, double: 2, trouble: 2, couple: 2, wrinkle: 2, twinkle: 2, sparkle: 2, tickle: 2, puzzle: 2, bubble: 2, cattle: 2, battle: 2, settle: 2, kettle: 2, nettle: 2, rustle: 2, hustle: 2, tussle: 2 };

export function syllables(word) {
  let w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  if (EXC[w] != null) return EXC[w];
  // handle simple plural/possessive/verb endings of exceptions
  for (const suf of ['s', 'es', 'ed', 'd']) {
    if (w.endsWith(suf) && EXC[w.slice(0, -suf.length)] != null && w.length > suf.length + 2) {
      const b = EXC[w.slice(0, -suf.length)];
      return suf === 'ed' && /[td]$/.test(w.slice(0, -2)) ? b + 1 : b;
    }
  }
  if (w.length <= 3) return 1;
  if (!/[td]ed$/.test(w)) w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, m => (m.length === 2 && m !== 'ed' ? m[0] : ''));
  w = w.replace(/^y/, '');
  const groups = w.match(/[aeiouy]{1,2}/g);
  let n = groups ? groups.length : 1;
  // extra syllable patterns
  const extra = w.match(/ia|io(?!u)|iu|ua(?!y)|eo|uo|ii|[^aeiou]ism|eu(?=m)/g);
  if (extra) n += Math.min(extra.length, 2);
  return Math.max(1, n);
}
export const wordsOf = line => line.match(/[A-Za-z][A-Za-z'’-]*|\d+/g) || [];
function lineSyl(line) {
  return wordsOf(line).reduce((a, w) => {
    if (/^\d+$/.test(w)) return a + Math.max(1, w.length);
    return a + w.split(/[-'’]/).filter(Boolean).reduce((x, p) => x + syllables(p), 0);
  }, 0);
}

export default function (root) {
  const s = store('haiku-checker');
  const ta = el('textarea', { class: 'textarea prose', rows: 5, placeholder: 'An old silent pond…\nA frog jumps into the pond—\nSplash! Silence again.', value: s.get('text', 'An old silent pond\nA frog jumps into the pond\nSplash! Silence again.') });
  const out = el('div', { class: 'col' });
  const target = [5, 7, 5];

  function update() {
    s.set('text', ta.value);
    const lines = ta.value.split('\n').map(l => l.trim());
    const nonEmpty = lines.filter(Boolean);
    if (!nonEmpty.length) { render(out, el('div', { class: 'empty' }, 'Type a poem above to see syllable counts.')); return; }
    const rows = nonEmpty.map((l, i) => {
      const n = lineSyl(l), t = target[i];
      const ok = t != null && n === t;
      const detail = wordsOf(l).map(w => `${w}·${/^\d+$/.test(w) ? w.length : w.split(/[-'’]/).filter(Boolean).reduce((x, p) => x + syllables(p), 0)}`).join('  ');
      return el('div', { class: 'panel' },
        el('div', { class: 'row', style: { margin: 0 } },
          el('span', { class: 'badge ' + (t == null ? 'warn' : ok ? 'ok' : 'danger') }, t == null ? 'extra line' : ok ? 'pass' : 'fail'),
          el('strong', {}, `${n} syllable${n === 1 ? '' : 's'}`),
          el('span', { class: 'muted small' }, t != null ? `(need ${t}${n !== t ? ', ' + (n > t ? 'cut ' + (n - t) : 'add ' + (t - n)) : ''})` : ''),
          el('span', { class: 'grow' }), el('span', { class: 'mono small' }, l)),
        el('div', { class: 'muted small mono', style: { marginTop: '4px', wordBreak: 'break-word' } }, detail));
    });
    const all = nonEmpty.length === 3 && nonEmpty.every((l, i) => lineSyl(l) === target[i]);
    render(out,
      el('div', { class: 'row' }, el('span', { class: 'badge ' + (all ? 'ok' : 'danger') }, all ? 'Valid 5-7-5 haiku' : nonEmpty.length !== 3 ? `Haiku needs 3 lines (you have ${nonEmpty.length})` : 'Not 5-7-5 yet')),
      ...rows,
      el('p', { class: 'muted small' }, 'Syllable counts are a heuristic and may be off by one for unusual words.'));
  }
  ta.addEventListener('input', update);
  render(root, ta, out);
  update();
}
