// Drum machine: 16-step sequencer with synthesized drum voices.
import { el, render, store, field, toast } from '../../lib/ui.js';

const INSTRUMENTS = [
  { id: 'kick', name: 'Kick' },
  { id: 'snare', name: 'Snare' },
  { id: 'hat', name: 'Hi-hat' },
  { id: 'ohat', name: 'Open hat' },
  { id: 'clap', name: 'Clap' },
  { id: 'tom', name: 'Tom' },
];
const STEPS = 16;

export default function (root) {
  const s = store('drum-machine');
  const saved = s.get('pattern', null);
  const pattern = {};
  for (const ins of INSTRUMENTS) pattern[ins.id] = (saved && saved[ins.id]) || Array(STEPS).fill(false);
  if (!saved) { // a small default groove
    [0, 4, 8, 12].forEach(i => (pattern.kick[i] = true));
    [4, 12].forEach(i => (pattern.snare[i] = true));
    for (let i = 0; i < STEPS; i += 2) pattern.hat[i] = true;
  }
  const volumes = s.get('volumes', {});
  for (const ins of INSTRUMENTS) if (volumes[ins.id] == null) volumes[ins.id] = 0.8;

  let ac = null, master = null, noiseBuf = null;
  let timer = null, step = 0, nextTime = 0, playing = false;
  let bpm = s.get('bpm', 110), swing = s.get('swing', 0);
  const cells = {};

  function audio() {
    if (ac) return ac;
    ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain(); master.gain.value = 0.7; master.connect(ac.destination);
    const len = ac.sampleRate; noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return ac;
  }
  function noise(t, dur, filterType, freq, q, peak, decay) {
    const src = ac.createBufferSource(); src.buffer = noiseBuf;
    const f = ac.createBiquadFilter(); f.type = filterType; f.frequency.value = freq; f.Q.value = q || 1;
    const g = ac.createGain(); g.gain.setValueAtTime(peak, t); g.gain.exponentialRampToValueAtTime(0.001, t + decay);
    src.connect(f); f.connect(g); g.connect(master); src.start(t); src.stop(t + dur);
  }
  const voices = {
    kick(t, v) {
      const o = ac.createOscillator(), g = ac.createGain();
      o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
      g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.42);
      const c = ac.createOscillator(), cg = ac.createGain(); c.type = 'square';
      c.frequency.setValueAtTime(400, t); c.frequency.exponentialRampToValueAtTime(60, t + 0.03);
      cg.gain.setValueAtTime(v * 0.4, t); cg.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
      c.connect(cg); cg.connect(master); c.start(t); c.stop(t + 0.05);
    },
    snare(t, v) {
      noise(t, 0.25, 'highpass', 1200, 0.7, v, 0.18);
      const o = ac.createOscillator(), g = ac.createGain(); o.type = 'triangle';
      o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(150, t + 0.08);
      g.gain.setValueAtTime(v * 0.7, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.13);
    },
    hat(t, v) { noise(t, 0.08, 'highpass', 7000, 1, v * 0.6, 0.05); },
    ohat(t, v) { noise(t, 0.4, 'highpass', 6000, 1, v * 0.5, 0.3); },
    clap(t, v) { for (let i = 0; i < 3; i++) noise(t + i * 0.012, 0.03, 'bandpass', 1500, 1.2, v * 0.7, 0.025); noise(t + 0.036, 0.2, 'bandpass', 1500, 1.2, v * 0.7, 0.15); },
    tom(t, v) {
      const o = ac.createOscillator(), g = ac.createGain();
      o.frequency.setValueAtTime(200, t); o.frequency.exponentialRampToValueAtTime(90, t + 0.2);
      g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.32);
    },
  };

  function schedule() {
    const lookahead = 0.12;
    while (nextTime < ac.currentTime + lookahead) {
      const t = nextTime;
      for (const ins of INSTRUMENTS) if (pattern[ins.id][step]) voices[ins.id](t, volumes[ins.id]);
      const stepIdx = step;
      const delay = Math.max(0, (t - ac.currentTime) * 1000);
      setTimeout(() => highlight(stepIdx), delay);
      const sixteenth = 60 / bpm / 4;
      // swing delays every second 16th
      const sw = (step % 2 === 0) ? sixteenth * (1 + swing / 100 * 0.66) : sixteenth * (1 - swing / 100 * 0.66);
      nextTime += sw;
      step = (step + 1) % STEPS;
    }
  }
  let lastHl = -1;
  function highlight(i) {
    if (lastHl >= 0) for (const ins of INSTRUMENTS) cells[ins.id][lastHl].style.outline = '';
    if (i >= 0) for (const ins of INSTRUMENTS) cells[ins.id][i].style.outline = '2px solid var(--warn)';
    lastHl = i;
    stepLabel.textContent = i >= 0 ? `step ${i + 1}` : '';
  }
  function start() {
    audio(); if (ac.state === 'suspended') ac.resume();
    step = 0; nextTime = ac.currentTime + 0.05; playing = true;
    timer = setInterval(schedule, 25); schedule();
    playBtn.textContent = 'Stop';
  }
  function stop() {
    clearInterval(timer); timer = null; playing = false; highlight(-1);
    playBtn.textContent = 'Play';
  }
  function save() { s.set('pattern', pattern); s.set('volumes', volumes); s.set('bpm', bpm); s.set('swing', swing); }

  const stepLabel = el('span', { class: 'muted small mono' });
  const playBtn = el('button', { class: 'btn primary', onclick: () => (playing ? stop() : start()) }, 'Play');
  const bpmIn = el('input', { type: 'number', class: 'input', min: 40, max: 240, value: bpm, style: { width: '80px' }, oninput: () => { bpm = Math.min(240, Math.max(40, +bpmIn.value || 110)); save(); } });
  const swingIn = el('input', { type: 'range', min: 0, max: 60, value: swing, oninput: () => { swing = +swingIn.value; swingLabel.textContent = swing + '%'; save(); } });
  const swingLabel = el('span', { class: 'small mono' }, swing + '%');

  const cellStyle = (on) => ({
    width: '100%', aspectRatio: '1', borderRadius: '5px', border: '1px solid var(--line)', cursor: 'pointer',
    background: on ? 'var(--accent)' : 'var(--bg)', minWidth: '0',
  });
  const grid = el('div', { class: 'col', style: { gap: '6px' } });
  for (const ins of INSTRUMENTS) {
    cells[ins.id] = [];
    const rowCells = el('div', { style: { display: 'grid', gridTemplateColumns: `repeat(${STEPS}, 1fr)`, gap: '4px', flex: 1, minWidth: 0 } });
    for (let i = 0; i < STEPS; i++) {
      const c = el('div', { style: Object.assign(cellStyle(pattern[ins.id][i]), { outlineOffset: '-2px', marginLeft: i % 4 === 0 && i ? '4px' : '0' }), title: `${ins.name} step ${i + 1}` });
      c.addEventListener('click', () => { pattern[ins.id][i] = !pattern[ins.id][i]; c.style.background = pattern[ins.id][i] ? 'var(--accent)' : 'var(--bg)'; save(); });
      cells[ins.id].push(c); rowCells.append(c);
    }
    const vol = el('input', { type: 'range', min: 0, max: 1, step: 0.01, value: volumes[ins.id], style: { width: '70px' }, title: 'volume', oninput: () => { volumes[ins.id] = +vol.value; save(); } });
    const nameBtn = el('button', { class: 'btn small ghost', style: { width: '78px', textAlign: 'left' }, title: 'Preview', onclick: () => { audio(); if (ac.state === 'suspended') ac.resume(); voices[ins.id](ac.currentTime, volumes[ins.id]); } }, ins.name);
    grid.append(el('div', { class: 'row', style: { flexWrap: 'nowrap', margin: 0 } }, nameBtn, rowCells, vol));
  }

  function clear() { for (const ins of INSTRUMENTS) for (let i = 0; i < STEPS; i++) { pattern[ins.id][i] = false; cells[ins.id][i].style.background = 'var(--bg)'; } save(); }
  function randomize() {
    const dens = { kick: 0.35, snare: 0.2, hat: 0.6, ohat: 0.12, clap: 0.15, tom: 0.12 };
    for (const ins of INSTRUMENTS) for (let i = 0; i < STEPS; i++) {
      let on = Math.random() < dens[ins.id];
      if (ins.id === 'kick' && i === 0) on = true;
      if (ins.id === 'snare' && (i === 4 || i === 12)) on = true;
      pattern[ins.id][i] = on; cells[ins.id][i].style.background = on ? 'var(--accent)' : 'var(--bg)';
    }
    save(); toast('Random pattern');
  }

  render(root,
    el('div', { class: 'row' },
      playBtn,
      field('BPM', bpmIn),
      field('Swing', el('span', { class: 'row', style: { margin: 0 } }, swingIn, swingLabel)),
      el('button', { class: 'btn', onclick: randomize }, 'Random'),
      el('button', { class: 'btn ghost', onclick: clear }, 'Clear'),
      stepLabel),
    el('div', { class: 'scroll-x' }, el('div', { style: { minWidth: '520px' } }, grid)),
    el('p', { class: 'muted small' }, 'Click cells to toggle steps. Click an instrument name to preview it. The pattern is saved automatically.'));

  function onKey(e) { if (e.code === 'Space' && e.target === document.body) { e.preventDefault(); playing ? stop() : start(); } }
  window.addEventListener('keydown', onKey);
  return () => {
    stop(); window.removeEventListener('keydown', onKey);
    if (ac) { ac.close().catch(() => {}); ac = null; }
  };
}
