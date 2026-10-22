// Guitar chord library: fingering diagrams on canvas, search, strum with Web Audio.
import { el, render, field } from '../../lib/ui.js';

// frets: low E to high E. 'x' muted, 0 open, n fret number (absolute).
const RAW = `
C|x32010|major
D|xx0232|major
E|022100|major
F|133211|major
G|320003|major
A|x02220|major
B|x24442|major
Bb|x13331|major
Eb|x65343|major
Ab|466544|major
F#|244322|major
C#|x46664|major
Am|x02210|minor
Em|022000|minor
Dm|xx0231|minor
Bm|x24432|minor
Cm|x35543|minor
Fm|133111|minor
Gm|355333|minor
F#m|244222|minor
C#m|x46654|minor
Bbm|x13321|minor
G#m|466444|minor
Ebm|x68876|minor
A7|x02020|dominant 7th
B7|x21202|dominant 7th
C7|x32310|dominant 7th
D7|xx0212|dominant 7th
E7|020100|dominant 7th
F7|131211|dominant 7th
G7|320001|dominant 7th
Amaj7|x02120|major 7th
Cmaj7|x32000|major 7th
Dmaj7|xx0222|major 7th
Emaj7|021100|major 7th
Fmaj7|xx3210|major 7th
Gmaj7|320002|major 7th
Am7|x02010|minor 7th
Em7|022030|minor 7th
Dm7|xx0211|minor 7th
Bm7|x20202|minor 7th
Fm7|131111|minor 7th
Gm7|353333|minor 7th
Asus2|x02200|suspended
Asus4|x02230|suspended
Dsus2|xx0230|suspended
Dsus4|xx0233|suspended
Esus4|022200|suspended
Gsus4|330013|suspended
Cadd9|x32030|add9
Gadd9|320203|add9
Eadd9|022102|add9
C6|x32210|sixth
A6|x02222|sixth
D6|xx0202|sixth
E6|022120|sixth
G6|320000|sixth
Am6|x02212|minor sixth
Em6|022020|minor sixth
A9|x02423|ninth
E9|020102|ninth
C9|x32333|ninth
G9|320201|ninth
D9|xx0210|ninth
Bdim|x2313x|diminished
Cdim7|x3424x|diminished
Ddim7|xx0101|diminished
Caug|x32110|augmented
Eaug|032110|augmented
Aaug|x03221|augmented
E5|022xxx|power
A5|x022xx|power
D5|xx023x|power
G5|355xxx|power
C5|x355xx|power
`.trim().split('\n').map(l => { const [name, f, type] = l.split('|'); return { name, type, frets: [...f].map(c => (c === 'x' ? -1 : +c)) }; });

const OPEN = [40, 45, 50, 55, 59, 64]; // MIDI of open strings

export default function (root) {
  let ac = null, master = null;
  function audio() {
    if (ac) return ac;
    ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain(); master.gain.value = 0.5; master.connect(ac.destination);
    return ac;
  }
  function pluck(midi, t) {
    const f = 440 * Math.pow(2, (midi - 69) / 12);
    const o1 = ac.createOscillator(), o2 = ac.createOscillator(), g = ac.createGain(), lp = ac.createBiquadFilter();
    o1.type = 'triangle'; o2.type = 'sawtooth'; o1.frequency.value = f; o2.frequency.value = f * 1.002;
    const o2g = ac.createGain(); o2g.gain.value = 0.25;
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(3500, t); lp.frequency.exponentialRampToValueAtTime(600, t + 1.5);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.5, t + 0.008); g.gain.exponentialRampToValueAtTime(0.001, t + 2);
    o1.connect(lp); o2.connect(o2g); o2g.connect(lp); lp.connect(g); g.connect(master);
    o1.start(t); o2.start(t); o1.stop(t + 2.05); o2.stop(t + 2.05);
  }
  function strum(chord, down = true) {
    audio(); if (ac.state === 'suspended') ac.resume();
    const t0 = ac.currentTime + 0.02;
    const idx = [0, 1, 2, 3, 4, 5]; if (!down) idx.reverse();
    let k = 0;
    for (const i of idx) { if (chord.frets[i] < 0) continue; pluck(OPEN[i] + chord.frets[i], t0 + k * 0.045); k++; }
  }

  function drawChord(canvas, chord) {
    const dpr = window.devicePixelRatio || 1, W = 120, H = 150;
    canvas.width = W * dpr; canvas.height = H * dpr; canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    const c = canvas.getContext('2d'); c.scale(dpr, dpr);
    const cs = getComputedStyle(root);
    const text = cs.getPropertyValue('--text').trim() || '#222', line = cs.getPropertyValue('--line').trim() || '#999', accent = cs.getPropertyValue('--accent').trim() || '#36c';
    const fretted = chord.frets.filter(f => f > 0);
    const maxF = Math.max(0, ...fretted), minF = fretted.length ? Math.min(...fretted) : 1;
    const base = maxF > 4 ? minF : 1;
    const left = 22, top = 36, sw = 15, fh = 20, nStr = 6, nFr = 5;
    c.strokeStyle = line; c.lineWidth = 1; c.fillStyle = text; c.font = '11px system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = 'bold 14px system-ui, sans-serif'; c.fillText(chord.name, W / 2, 12);
    c.font = '11px system-ui, sans-serif';
    // nut
    if (base === 1) { c.fillStyle = text; c.fillRect(left - 1, top - 2, sw * (nStr - 1) + 2, 3); }
    else { c.fillStyle = text; c.textAlign = 'right'; c.fillText(base + 'fr', left - 6, top + fh / 2); c.textAlign = 'center'; }
    for (let i = 0; i < nStr; i++) { c.beginPath(); c.moveTo(left + i * sw, top); c.lineTo(left + i * sw, top + fh * nFr); c.stroke(); }
    for (let j = 0; j <= nFr; j++) { c.beginPath(); c.moveTo(left, top + j * fh); c.lineTo(left + (nStr - 1) * sw, top + j * fh); c.stroke(); }
    chord.frets.forEach((f, i) => {
      const x = left + i * sw;
      if (f < 0) { c.fillStyle = text; c.fillText('×', x, top - 11); }
      else if (f === 0) { c.strokeStyle = text; c.beginPath(); c.arc(x, top - 11, 3.5, 0, Math.PI * 2); c.stroke(); c.strokeStyle = line; }
      else { const y = top + (f - base + 0.5) * fh; c.fillStyle = accent; c.beginPath(); c.arc(x, y, 5.5, 0, Math.PI * 2); c.fill(); }
    });
    // barre: if same fret on 3+ strings at the lowest fretted fret and it is the base, draw a bar
    const lowest = base;
    const onLow = chord.frets.map((f, i) => (f === lowest ? i : -1)).filter(i => i >= 0);
    if (onLow.length >= 3 && maxF > lowest) {
      const y = top + (lowest - base + 0.5) * fh; c.fillStyle = accent;
      c.beginPath(); c.roundRect ? c.roundRect(left + onLow[0] * sw - 5.5, y - 5.5, (onLow[onLow.length - 1] - onLow[0]) * sw + 11, 11, 5.5) : c.rect(left + onLow[0] * sw - 5.5, y - 5.5, (onLow[onLow.length - 1] - onLow[0]) * sw + 11, 11); c.fill();
    }
    // note names
    c.fillStyle = text; c.font = '9px system-ui, sans-serif';
    chord.frets.forEach((f, i) => { if (f >= 0) c.fillText(['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][(OPEN[i] + f) % 12], left + i * sw, top + nFr * fh + 10); });
  }

  const search = el('input', { class: 'input', placeholder: 'Search: Am, maj7, sus, power…', style: { minWidth: '220px' }, oninput: show, onkeydown: e => { if (e.key === 'Escape') { search.value = ''; show(); } } });
  const typeSel = el('select', { class: 'select', onchange: show }, el('option', { value: '' }, 'All types'), [...new Set(RAW.map(c => c.type))].map(t => el('option', { value: t }, t)));
  const grid = el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px' } });
  const count = el('span', { class: 'muted small' });
  function show() {
    const q = search.value.trim().toLowerCase(), t = typeSel.value;
    const list = RAW.filter(c => (!t || c.type === t) && (!q || c.name.toLowerCase().includes(q) || c.type.includes(q)));
    count.textContent = `${list.length} of ${RAW.length} chords`;
    render(grid, list.map(ch => {
      const cv = el('canvas', { style: { maxWidth: '100%', cursor: 'pointer' }, title: 'Click to strum', onclick: () => strum(ch) });
      drawChord(cv, ch);
      return el('div', { class: 'panel col center', style: { alignItems: 'center', padding: '8px' } },
        cv,
        el('div', { class: 'row', style: { margin: 0 } },
          el('button', { class: 'btn small', onclick: () => strum(ch, true) }, '▼ Strum'),
          el('button', { class: 'btn small ghost', onclick: () => strum(ch, false) }, '▲')),
        el('span', { class: 'muted small' }, ch.type));
    }));
  }
  render(root,
    el('div', { class: 'row' }, field('Search', search), field('Type', typeSel), count),
    grid,
    el('p', { class: 'muted small' }, 'Diagrams show strings low E (left) to high E (right); × = muted, ○ = open. Click a diagram to hear the chord.'));
  show();
  return () => { if (ac) { ac.close().catch(() => {}); ac = null; } };
}
