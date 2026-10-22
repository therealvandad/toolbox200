import { el, render, store, stat } from '../../lib/ui.js';

function syl(word) {
  let w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  if (w.length <= 3) return 1;
  if (!/[td]ed$/.test(w)) w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, m => (m.length === 2 && m !== 'ed' ? m[0] : ''));
  w = w.replace(/^y/, '');
  let n = (w.match(/[aeiouy]{1,2}/g) || []).length;
  const extra = w.match(/ia|io(?!u)|iu|ua(?!y)|eo|uo|ii/g);
  if (extra) n += Math.min(extra.length, 2);
  return Math.max(1, n);
}

const ABBR = /\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|vs|etc|e\.g|i\.e|No|Inc|Ltd)\.$/;
export function splitSentences(text) {
  const out = [];
  const re = /[^.!?\n]+(?:[.!?]+["')\]]*|\n+|$)/g;
  let m, buf = '';
  while ((m = re.exec(text))) {
    const piece = m[0];
    buf += piece;
    if (ABBR.test(piece.trim())) continue;
    if (buf.trim()) out.push(buf.trim());
    buf = '';
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}
const wordsIn = t => t.match(/[A-Za-z0-9][A-Za-z0-9'’-]*/g) || [];

export function analyze(text) {
  const sentences = splitSentences(text).map(t => ({ t, words: wordsIn(t) })).filter(x => x.words.length);
  const words = sentences.flatMap(x => x.words);
  const W = words.length, S = sentences.length;
  if (!W) return null;
  const sy = words.map(w => /^\d/.test(w) ? 2 : syl(w));
  const syllables = sy.reduce((a, b) => a + b, 0);
  const letters = words.join('').replace(/[^A-Za-z0-9]/g, '').length;
  const complex = words.filter((w, i) => sy[i] >= 3 && !/^[A-Z]/.test(w) && !/^\d/.test(w)).length;
  const complexAll = sy.filter(n => n >= 3).length;
  const wps = W / S, spw = syllables / W;
  const flesch = 206.835 - 1.015 * wps - 84.6 * spw;
  const fk = 0.39 * wps + 11.8 * spw - 15.59;
  const fog = 0.4 * (wps + 100 * complex / W);
  const smog = S >= 1 ? 1.043 * Math.sqrt(complexAll * (30 / S)) + 3.1291 : 0;
  return { sentences, W, S, syllables, letters, complex, wps, spw, flesch, fk, fog, smog, avgWord: letters / W, chars: text.length };
}

function easeLabel(f) {
  if (f >= 90) return ['Very easy (5th grade)', 'ok'];
  if (f >= 80) return ['Easy (6th grade)', 'ok'];
  if (f >= 70) return ['Fairly easy (7th grade)', 'ok'];
  if (f >= 60) return ['Plain English (8th-9th grade)', 'ok'];
  if (f >= 50) return ['Fairly difficult (10th-12th grade)', 'warn'];
  if (f >= 30) return ['Difficult (college)', 'warn'];
  return ['Very difficult (graduate)', 'danger'];
}

export default function (root) {
  const s = store('readability');
  const ta = el('textarea', { class: 'textarea prose', rows: 9, placeholder: 'Paste your text here…', value: s.get('text', '') });
  const limitIn = el('input', { class: 'input', type: 'number', min: '10', max: '80', value: s.get('limit', 25), style: { width: '80px' } });
  const stats = el('div', { class: 'row' });
  const scores = el('div', { class: 'row' });
  const verdict = el('div', { class: 'row' });
  const hl = el('div', { class: 'panel', style: { lineHeight: '1.8' } });

  function update() {
    s.set('text', ta.value); s.set('limit', +limitIn.value);
    const a = analyze(ta.value);
    if (!a) {
      render(stats); render(scores); render(verdict);
      render(hl, el('span', { class: 'muted' }, 'Highlighted text appears here.'));
      return;
    }
    const limit = Math.max(5, +limitIn.value || 25);
    const [lbl, cls] = easeLabel(a.flesch);
    render(verdict, el('span', { class: 'badge ' + cls }, lbl), el('span', { class: 'muted small' }, `Average of grade formulas: ${((a.fk + a.fog + a.smog) / 3).toFixed(1)}`));
    render(scores,
      stat(a.flesch.toFixed(1), 'Flesch Reading Ease'),
      stat(a.fk.toFixed(1), 'Flesch-Kincaid grade'),
      stat(a.fog.toFixed(1), 'Gunning Fog'),
      stat(a.S >= 1 ? a.smog.toFixed(1) : '–', 'SMOG'));
    render(stats,
      stat(a.W, 'words'), stat(a.S, 'sentences'), stat(a.wps.toFixed(1), 'avg sentence length (words)'),
      stat(a.avgWord.toFixed(2), 'avg word length (letters)'), stat(a.spw.toFixed(2), 'syllables / word'), stat(a.complex, 'complex words (3+ syl)'));
    const long = a.sentences.filter(x => x.words.length > limit).length;
    render(hl,
      el('div', { class: 'small muted', style: { marginBottom: '6px' } }, long ? `${long} sentence${long > 1 ? 's' : ''} longer than ${limit} words highlighted` : `No sentences longer than ${limit} words.`),
      a.sentences.map(x => {
        const n = x.words.length;
        const bad = n > limit, vbad = n > limit * 1.5;
        return el('span', { title: `${n} words`, style: bad ? { background: vbad ? 'color-mix(in srgb, var(--danger) 30%, transparent)' : 'color-mix(in srgb, var(--warn) 30%, transparent)', borderRadius: '4px', padding: '1px 2px' } : {} }, x.t + ' ');
      }));
  }
  ta.addEventListener('input', update);
  limitIn.addEventListener('input', update);
  render(root, ta,
    el('div', { class: 'row' }, el('label', { class: 'inline' }, 'Flag sentences longer than', limitIn, 'words'),
      el('button', { class: 'btn ghost small', onclick: () => { ta.value = ''; update(); } }, 'Clear')),
    verdict, scores, stats, hl,
    el('p', { class: 'muted small' }, 'Syllables are estimated, so scores are approximate. SMOG is most reliable for 30+ sentences.'));
  update();
}
