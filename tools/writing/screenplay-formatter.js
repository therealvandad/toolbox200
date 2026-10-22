import { el, render, store, download, copy } from '../../lib/ui.js';

const SAMPLE = `INT. COFFEE SHOP - MORNING

Rain taps the window. MAYA (30s, tired) stares into an empty cup.

MAYA
(whispering)
I should have called her.

The barista, JOE, slides a fresh coffee across the counter.

JOE
On the house. You look like you need it.

MAYA
(smiling)
That obvious?

CUT TO:

EXT. CITY STREET - CONTINUOUS

Maya steps out into the rain and dials a number.
`;

const SCENE = /^(?:INT|EXT|EST|INT\.?\/EXT|EXT\.?\/INT|I\/E)[. ]/i;
const TRANS = /^(?:[A-Z ]+ TO:|FADE (?:IN|OUT)\.?|FADE TO BLACK\.?|CUT TO BLACK\.?|SMASH CUT:?|DISSOLVE TO:?|MATCH CUT:?)$/;
const isCaps = l => /[A-Z]/.test(l) && l === l.toUpperCase();

export function parse(text) {
  const lines = text.replace(/\r/g, '').split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const raw = lines[i]; const l = raw.trim();
    if (!l) { i++; continue; }
    const prevBlank = i === 0 || !lines[i - 1].trim();
    if (l.startsWith('.') && !l.startsWith('..')) { out.push({ k: 'scene', t: l.slice(1).trim().toUpperCase() }); i++; continue; }
    if (SCENE.test(l)) { out.push({ k: 'scene', t: l.toUpperCase() }); i++; continue; }
    if (l.startsWith('>') && !l.endsWith('<')) { out.push({ k: 'trans', t: l.slice(1).trim().toUpperCase() }); i++; continue; }
    if (TRANS.test(l)) { out.push({ k: 'trans', t: l }); i++; continue; }
    if (l.startsWith('!')) { out.push({ k: 'action', t: l.slice(1) }); i++; continue; }
    const next = lines[i + 1] ? lines[i + 1].trim() : '';
    const forced = l.startsWith('@');
    const name = l.replace(/^@/, '');
    if ((forced || (isCaps(name.replace(/\s*\(.*?\)\s*/g, '')) && name.length < 40 && !/[.!?]$/.test(name))) && prevBlank && next) {
      out.push({ k: 'char', t: forced ? name : name });
      i++;
      while (i < lines.length && lines[i].trim()) {
        const d = lines[i].trim();
        if (/^\(.*\)$/.test(d)) out.push({ k: 'paren', t: d });
        else out.push({ k: 'dialogue', t: d });
        i++;
      }
      continue;
    }
    // action: gather consecutive lines
    let buf = [l]; i++;
    while (i < lines.length && lines[i].trim() && !SCENE.test(lines[i].trim())) { buf.push(lines[i].trim()); i++; }
    out.push({ k: 'action', t: buf.join(' ') });
  }
  return out;
}

function wrap(text, width) {
  const words = text.split(/\s+/).filter(Boolean); const lines = []; let cur = '';
  for (const w of words) {
    if (cur && (cur + ' ' + w).length > width) { lines.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w;
  }
  if (cur) lines.push(cur);
  return lines;
}
export function toText(blocks) {
  const o = [];
  const sp = n => ' '.repeat(n);
  blocks.forEach((b, idx) => {
    const prev = blocks[idx - 1];
    const sameSpeech = prev && (b.k === 'dialogue' || b.k === 'paren') && ['char', 'paren', 'dialogue'].includes(prev.k);
    if (b.k === 'scene' && o.length) o.push('');
    if (b.k === 'scene') o.push(b.t, '');
    else if (b.k === 'action') { o.push(...wrap(b.t, 60), ''); }
    else if (b.k === 'char') { if (o.length && o[o.length - 1] !== '') o.push(''); o.push(sp(22) + b.t.toUpperCase()); }
    else if (b.k === 'paren') o.push(...wrap(b.t, 25).map(x => sp(16) + x));
    else if (b.k === 'dialogue') { o.push(...wrap(b.t, 35).map(x => sp(10) + x)); }
    else if (b.k === 'trans') { o.push('', sp(Math.max(0, 60 - b.t.length)) + b.t, ''); }
    if ((b.k === 'dialogue') && !(blocks[idx + 1] && ['dialogue', 'paren'].includes(blocks[idx + 1].k))) o.push('');
    void sameSpeech;
  });
  return o.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

export default function (root) {
  const s = store('screenplay-formatter');
  const ta = el('textarea', { class: 'textarea', rows: 18, value: s.get('text', SAMPLE), style: { minHeight: '320px' } });
  const page = el('div', { style: { fontFamily: 'Courier New, Courier, monospace', fontSize: '14px', lineHeight: '1.35', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: '6px', padding: '24px 16px', minHeight: '320px', overflow: 'auto', color: 'var(--text)' } });
  let blocks = [];
  function update() {
    s.set('text', ta.value);
    blocks = parse(ta.value);
    if (!blocks.length) { render(page, el('span', { class: 'muted' }, 'Formatted script appears here.')); return; }
    const st = {
      scene: { fontWeight: '700', textTransform: 'uppercase', margin: '1.4em 0 .7em', maxWidth: '60ch' },
      action: { margin: '0 0 .9em', maxWidth: '60ch' },
      char: { margin: '.9em 0 0 22ch', textTransform: 'uppercase' },
      paren: { margin: '0 0 0 16ch', maxWidth: '25ch' },
      dialogue: { margin: '0 0 0 10ch', maxWidth: '35ch' },
      trans: { margin: '.9em 0', maxWidth: '60ch', textAlign: 'right', textTransform: 'uppercase' },
    };
    render(page, el('div', { style: { minWidth: '62ch' } }, blocks.map((b, i) => {
      const last = blocks[i + 1];
      const style = { ...st[b.k] };
      if (b.k === 'dialogue' && !(last && (last.k === 'dialogue' || last.k === 'paren'))) style.marginBottom = '.9em';
      return el('div', { style }, b.t);
    })));
  }
  ta.addEventListener('input', update);
  render(root,
    el('p', { class: 'muted small' }, 'Type INT./EXT. scene headings, put CHARACTER names in caps on their own line before dialogue, wrap parentheticals in (), and end transitions with TO:. Prefix a line with ',
      el('span', { class: 'kbd' }, '.'), ' scene, ', el('span', { class: 'kbd' }, '@'), ' character, ', el('span', { class: 'kbd' }, '>'), ' transition or ', el('span', { class: 'kbd' }, '!'), ' action to force its type.'),
    el('div', { class: 'grid2' }, el('div', { class: 'col' }, ta), el('div', { style: { minWidth: 0 } }, page)),
    el('div', { class: 'row' },
      el('button', { class: 'btn primary', onclick: () => download('screenplay.txt', toText(blocks)) }, 'Export .txt (formatted)'),
      el('button', { class: 'btn', onclick: () => copy(toText(blocks)) }, 'Copy formatted'),
      el('button', { class: 'btn ghost', onclick: () => { ta.value = SAMPLE; update(); } }, 'Load sample'),
      el('button', { class: 'btn ghost', onclick: () => { ta.value = ''; update(); } }, 'Clear')));
  update();
}
