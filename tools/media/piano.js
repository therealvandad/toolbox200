// Piano: two octaves, mouse/touch and computer keyboard, oscillator with ADSR.
import { el, render, store, field } from '../../lib/ui.js';

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
// Keyboard row: A W S E D F T G Y H U J K O L P ; ' (C .. E of next octave), Z / X shift octave.
const KEYMAP = { KeyA: 0, KeyW: 1, KeyS: 2, KeyE: 3, KeyD: 4, KeyF: 5, KeyT: 6, KeyG: 7, KeyY: 8, KeyH: 9, KeyU: 10, KeyJ: 11, KeyK: 12, KeyO: 13, KeyL: 14, KeyP: 15, Semicolon: 16, Quote: 17 };
const KEYLABEL = ['A', 'W', 'S', 'E', 'D', 'F', 'T', 'G', 'Y', 'H', 'U', 'J', 'K', 'O', 'L', 'P', ';', "'"];

export default function (root) {
  const s = store('piano');
  const cfg = Object.assign({ wave: 'triangle', a: 0.02, d: 0.15, su: 0.6, r: 0.3, vol: 0.5, sustain: false, base: 60 }, s.get('cfg', {}));
  let ac = null, master = null;
  const active = new Map(); // midi -> {osc, gain}
  const keyEls = new Map();

  function audio() {
    if (ac) return ac;
    ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain(); master.gain.value = cfg.vol; master.connect(ac.destination);
    return ac;
  }
  const freq = m => 440 * Math.pow(2, (m - 69) / 12);
  function noteOn(m) {
    audio(); if (ac.state === 'suspended') ac.resume();
    if (active.has(m)) return;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = cfg.wave; o.frequency.value = freq(m);
    const t = ac.currentTime;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(1, t + cfg.a);
    g.gain.linearRampToValueAtTime(cfg.su, t + cfg.a + cfg.d);
    o.connect(g); g.connect(master); o.start(t);
    active.set(m, { o, g });
    const k = keyEls.get(m); if (k) k.style.background = 'var(--accent)';
    nowPlaying();
  }
  function noteOff(m, force = false) {
    const v = active.get(m); if (!v) return;
    if (cfg.sustain && !force) { v.held = false; return; }
    const t = ac.currentTime;
    v.g.gain.cancelScheduledValues(t); v.g.gain.setValueAtTime(v.g.gain.value, t);
    v.g.gain.linearRampToValueAtTime(0, t + cfg.r);
    v.o.stop(t + cfg.r + 0.02);
    active.delete(m);
    const k = keyEls.get(m); if (k) k.style.background = k.dataset.black ? 'var(--text)' : 'var(--panel)';
    nowPlaying();
  }
  function releaseAll() { for (const m of [...active.keys()]) noteOff(m, true); }
  const nameOf = m => NAMES[m % 12] + (Math.floor(m / 12) - 1);
  const playingLabel = el('div', { class: 'mono', style: { minHeight: '1.4em' } });
  function nowPlaying() { playingLabel.textContent = [...active.keys()].sort((a, b) => a - b).map(nameOf).join('  ') || ' '; }

  // keyboard drawing
  const board = el('div', { style: { position: 'relative', height: '170px', userSelect: 'none', touchAction: 'none', maxWidth: '100%', overflowX: 'auto' } });
  function buildBoard() {
    board.replaceChildren(); keyEls.clear();
    const whites = []; const base = cfg.base;
    for (let i = 0; i <= 24; i++) if (![1, 3, 6, 8, 10].includes(i % 12)) whites.push(i);
    const ww = 100 / whites.length;
    const press = (m) => (e) => { e.preventDefault(); noteOn(m); };
    const release = (m) => () => noteOff(m);
    whites.forEach((i, wi) => {
      const m = base + i;
      const key = el('div', { style: { position: 'absolute', left: wi * ww + '%', width: ww + '%', top: 0, bottom: 0, background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: '0 0 5px 5px', boxSizing: 'border-box', cursor: 'pointer' } },
        el('div', { class: 'small muted', style: { position: 'absolute', bottom: '4px', left: 0, right: 0, textAlign: 'center' } }, nameOf(m), el('br'), el('span', { class: 'kbd' }, KEYLABEL[i] || '')));
      key.addEventListener('pointerdown', press(m)); key.addEventListener('pointerup', release(m)); key.addEventListener('pointerleave', release(m));
      key.addEventListener('pointerenter', e => { if (e.buttons) noteOn(m); });
      keyEls.set(m, key); board.append(key);
    });
    for (let i = 0; i < 24; i++) {
      if (![1, 3, 6, 8, 10].includes(i % 12)) continue;
      const m = base + i;
      const wi = whites.filter(w => w < i).length; // black key sits between whites wi-1 and wi
      const key = el('div', { 'data-black': '1', style: { position: 'absolute', left: `calc(${wi * ww}% - ${ww * 0.3}%)`, width: ww * 0.6 + '%', top: 0, height: '60%', background: 'var(--text)', border: '1px solid var(--line)', borderRadius: '0 0 4px 4px', boxSizing: 'border-box', cursor: 'pointer', zIndex: 2 } },
        el('div', { class: 'small', style: { position: 'absolute', bottom: '4px', left: 0, right: 0, textAlign: 'center', color: 'var(--bg)' } }, KEYLABEL[i] || ''));
      key.addEventListener('pointerdown', press(m)); key.addEventListener('pointerup', release(m)); key.addEventListener('pointerleave', release(m));
      key.addEventListener('pointerenter', e => { if (e.buttons) noteOn(m); });
      keyEls.set(m, key); board.append(key);
    }
    octLabel.textContent = `${nameOf(base)} – ${nameOf(base + 24)}`;
  }
  const octLabel = el('span', { class: 'mono' });
  const save = () => s.set('cfg', cfg);
  const slider = (key, min, max, step, label) => {
    const inp = el('input', { type: 'range', min, max, step, value: cfg[key], oninput: () => { cfg[key] = +inp.value; out.textContent = (+inp.value).toFixed(2); if (key === 'vol' && master) master.gain.value = cfg.vol; save(); } });
    const out = el('span', { class: 'mono small' }, (+cfg[key]).toFixed(2));
    return field(label, el('span', { class: 'row', style: { margin: 0 } }, inp, out));
  };
  const waveSel = el('select', { class: 'select', onchange: () => { cfg.wave = waveSel.value; save(); } },
    ['sine', 'triangle', 'square', 'sawtooth'].map(w => el('option', { value: w, selected: cfg.wave === w }, w)));
  const sustainChk = el('input', { type: 'checkbox', checked: cfg.sustain, onchange: () => { cfg.sustain = sustainChk.checked; if (!cfg.sustain) releaseAll(); save(); } });
  const shift = d => { cfg.base = Math.max(36, Math.min(84, cfg.base + d)); releaseAll(); buildBoard(); save(); };

  render(root,
    el('div', { class: 'row' },
      field('Waveform', waveSel),
      slider('a', 0, 1, 0.01, 'Attack'), slider('d', 0, 1, 0.01, 'Decay'), slider('su', 0, 1, 0.01, 'Sustain level'), slider('r', 0.01, 2, 0.01, 'Release'),
      slider('vol', 0, 1, 0.01, 'Volume'),
      el('label', { class: 'inline' }, sustainChk, ' Sustain pedal (Space)')),
    el('div', { class: 'row' },
      el('button', { class: 'btn small', onclick: () => shift(-12) }, 'Octave − (Z)'),
      octLabel,
      el('button', { class: 'btn small', onclick: () => shift(12) }, 'Octave + (X)'),
      el('button', { class: 'btn small ghost', onclick: releaseAll }, 'Release all'),
      el('span', { class: 'grow' }), playingLabel),
    board,
    el('p', { class: 'muted small' }, 'Keys A W S E D F T G Y H U J K O L P ; \' play from the lower C. Hold Space for sustain.'));
  buildBoard();

  const isTyping = e => /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) && e.target.type !== 'range' && e.target.type !== 'checkbox';
  function onDown(e) {
    if (isTyping(e) || e.repeat) return;
    if (e.code in KEYMAP) { e.preventDefault(); noteOn(cfg.base + KEYMAP[e.code]); }
    else if (e.code === 'KeyZ') shift(-12);
    else if (e.code === 'KeyX') shift(12);
    else if (e.code === 'Space') { e.preventDefault(); cfg.sustain = true; sustainChk.checked = true; }
  }
  function onUp(e) {
    if (e.code in KEYMAP) noteOff(cfg.base + KEYMAP[e.code]);
    else if (e.code === 'Space') { cfg.sustain = false; sustainChk.checked = false; releaseAll(); save(); }
  }
  const onBlur = () => releaseAll();
  window.addEventListener('keydown', onDown); window.addEventListener('keyup', onUp); window.addEventListener('blur', onBlur);
  return () => {
    window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp); window.removeEventListener('blur', onBlur);
    if (ac) { ac.close().catch(() => {}); ac = null; }
  };
}
