// Noise and rain mixer: generated white/pink/brown noise plus synthesized rain and wind layers,
// per-layer volume, saved presets, master volume and a sleep timer.
import { el, render, store, field, toast } from '../../lib/ui.js';

const LAYERS = [
  { id: 'white', name: 'White noise', hint: 'flat hiss' },
  { id: 'pink', name: 'Pink noise', hint: 'softer, balanced' },
  { id: 'brown', name: 'Brown noise', hint: 'deep rumble' },
  { id: 'rain', name: 'Rain', hint: 'droplets on a roof' },
  { id: 'wind', name: 'Wind', hint: 'gusting breeze' },
];
const BUILTIN = {
  'Soft rain': { white: 0, pink: 0.15, brown: 0, rain: 0.8, wind: 0.2 },
  'Storm': { white: 0.1, pink: 0, brown: 0.4, rain: 0.9, wind: 0.7 },
  'Focus': { white: 0, pink: 0.6, brown: 0.3, rain: 0, wind: 0 },
  'Deep sleep': { white: 0, pink: 0, brown: 0.8, rain: 0.2, wind: 0 },
};

export default function (root) {
  const s = store('noise-mixer');
  const vols = Object.assign({ white: 0, pink: 0.5, brown: 0, rain: 0, wind: 0 }, s.get('vols', {}));
  let master = s.get('master', 0.7);
  let presets = s.get('presets', {});
  let ac = null, masterGain = null, nodes = {}, playing = false;
  let sleepTimer = null, sleepTick = null, sleepEnd = 0;

  // ---- buffer generators ----
  function noiseBuffer(kind, seconds = 4) {
    const sr = ac.sampleRate, n = Math.floor(sr * seconds), b = ac.createBuffer(2, n, sr);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
      for (let i = 0; i < n; i++) {
        const w = Math.random() * 2 - 1;
        if (kind === 'white') d[i] = w * 0.5;
        else if (kind === 'pink') { // Paul Kellet's refined method
          b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.96900 * b2 + w * 0.1538520;
          b3 = 0.86650 * b3 + w * 0.3104856; b4 = 0.55000 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.0168980;
          d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
        } else { // brown
          last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5;
        }
      }
    }
    return b;
  }
  function rainBuffer(seconds = 6) {
    const sr = ac.sampleRate, n = Math.floor(sr * seconds), b = ac.createBuffer(2, n, sr);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      // background: high-passed hiss
      let prev = 0, prevIn = 0;
      for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; const hp = 0.97 * (prev + w - prevIn); prevIn = w; prev = hp; d[i] = hp * 0.08; }
      // droplets: short decaying bursts at random times, random brightness
      const drops = Math.floor(seconds * 260);
      for (let k = 0; k < drops; k++) {
        const start = Math.floor(Math.random() * n), len = 60 + Math.floor(Math.random() * 400), amp = 0.15 + Math.random() * 0.35;
        const f = 800 + Math.random() * 4000, ph = Math.random() * 6.28;
        for (let i = 0; i < len && start + i < n; i++) {
          const env = Math.exp(-i / (len / 4));
          d[start + i] += amp * env * (Math.sin(ph + i * f / sr * 6.283) * 0.5 + (Math.random() * 2 - 1) * 0.5);
        }
      }
    }
    return b;
  }

  function start() {
    if (playing) return;
    if (!ac) {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ac.createGain(); masterGain.connect(ac.destination);
    }
    if (ac.state === 'suspended') ac.resume();
    masterGain.gain.setValueAtTime(0, ac.currentTime);
    masterGain.gain.linearRampToValueAtTime(master, ac.currentTime + 0.8);
    for (const L of LAYERS) {
      const g = ac.createGain(); g.gain.value = vols[L.id]; g.connect(masterGain);
      const node = { gain: g, sources: [] };
      const src = ac.createBufferSource(); src.loop = true;
      if (L.id === 'rain') {
        src.buffer = rainBuffer();
        const bp = ac.createBiquadFilter(); bp.type = 'highpass'; bp.frequency.value = 400;
        src.connect(bp); bp.connect(g);
      } else if (L.id === 'wind') {
        src.buffer = noiseBuffer('pink', 4);
        const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 400; bp.Q.value = 1.2;
        // slow irregular gusts: two LFOs modulate filter frequency and gain
        const lfo1 = ac.createOscillator(), lfo2 = ac.createOscillator();
        lfo1.frequency.value = 0.07; lfo2.frequency.value = 0.19;
        const dep1 = ac.createGain(), dep2 = ac.createGain(); dep1.gain.value = 250; dep2.gain.value = 120;
        lfo1.connect(dep1); lfo2.connect(dep2); dep1.connect(bp.frequency); dep2.connect(bp.frequency);
        const gust = ac.createGain(); gust.gain.value = 1.4;
        const gl = ac.createOscillator(); gl.frequency.value = 0.11; const gd = ac.createGain(); gd.gain.value = 0.6;
        gl.connect(gd); gd.connect(gust.gain);
        src.connect(bp); bp.connect(gust); gust.connect(g);
        lfo1.start(); lfo2.start(); gl.start(); node.sources.push(lfo1, lfo2, gl);
      } else {
        src.buffer = noiseBuffer(L.id); src.connect(g);
      }
      src.start(); node.sources.push(src);
      nodes[L.id] = node;
    }
    playing = true; playBtn.textContent = 'Stop'; playBtn.classList.add('danger');
  }
  function stop(fade = 0.5) {
    if (!playing) return;
    const t = ac.currentTime;
    masterGain.gain.cancelScheduledValues(t); masterGain.gain.setValueAtTime(masterGain.gain.value, t);
    masterGain.gain.linearRampToValueAtTime(0, t + fade);
    const old = nodes; nodes = {};
    setTimeout(() => { for (const k in old) old[k].sources.forEach(x => { try { x.stop(); } catch {} }); }, fade * 1000 + 50);
    playing = false; playBtn.textContent = 'Play'; playBtn.classList.remove('danger');
    clearSleep();
  }
  function setVol(id, v) { vols[id] = v; s.set('vols', vols); if (nodes[id]) nodes[id].gain.gain.setTargetAtTime(v, ac.currentTime, 0.05); }
  function applyVols() { for (const L of LAYERS) { sliders[L.id].value = vols[L.id]; labels[L.id].textContent = Math.round(vols[L.id] * 100) + '%'; if (nodes[L.id]) nodes[L.id].gain.gain.setTargetAtTime(vols[L.id], ac.currentTime, 0.05); } s.set('vols', vols); }

  // ---- UI ----
  const playBtn = el('button', { class: 'btn primary', style: { minWidth: '90px' }, onclick: () => (playing ? stop() : start()) }, 'Play');
  const sliders = {}, labels = {};
  const layerRows = LAYERS.map(L => {
    labels[L.id] = el('span', { class: 'mono small', style: { width: '40px', textAlign: 'right' } }, Math.round(vols[L.id] * 100) + '%');
    sliders[L.id] = el('input', { type: 'range', min: 0, max: 1, step: 0.01, value: vols[L.id], class: 'grow', style: { minWidth: '120px' },
      oninput: e => { setVol(L.id, +e.target.value); labels[L.id].textContent = Math.round(vols[L.id] * 100) + '%'; } });
    return el('div', { class: 'row' },
      el('div', { style: { width: '120px' } }, el('div', {}, L.name), el('div', { class: 'muted small' }, L.hint)),
      sliders[L.id], labels[L.id]);
  });
  const masterLabel = el('span', { class: 'mono small', style: { width: '40px', textAlign: 'right' } }, Math.round(master * 100) + '%');
  const masterIn = el('input', { type: 'range', min: 0, max: 1, step: 0.01, value: master, class: 'grow', style: { minWidth: '120px' },
    oninput: e => { master = +e.target.value; s.set('master', master); masterLabel.textContent = Math.round(master * 100) + '%'; if (playing) masterGain.gain.setTargetAtTime(master, ac.currentTime, 0.05); } });

  // presets
  const presetList = el('div', { class: 'row' });
  const presetName = el('input', { class: 'input', placeholder: 'Preset name', onkeydown: e => { if (e.key === 'Enter') savePreset(); } });
  function savePreset() {
    const name = presetName.value.trim(); if (!name) { toast('Give the preset a name'); return; }
    presets[name] = { ...vols }; s.set('presets', presets); presetName.value = ''; renderPresets(); toast('Preset saved');
  }
  function renderPresets() {
    render(presetList,
      Object.entries(BUILTIN).map(([n, v]) => el('button', { class: 'btn small', onclick: () => { Object.assign(vols, v); applyVols(); } }, n)),
      Object.entries(presets).map(([n, v]) => el('span', { class: 'badge', style: { padding: '0 0 0 8px' } },
        el('span', { style: { cursor: 'pointer' }, onclick: () => { Object.assign(vols, v); applyVols(); } }, n),
        el('button', { class: 'btn ghost small', style: { border: 0, padding: '2px 6px' }, title: 'Delete', onclick: () => { delete presets[n]; s.set('presets', presets); renderPresets(); } }, '×'))));
  }

  // sleep timer
  const sleepSel = el('select', { class: 'select' }, [0, 5, 10, 15, 20, 30, 45, 60, 90].map(m => el('option', { value: m }, m ? m + ' min' : 'Off')));
  const sleepLabel = el('span', { class: 'mono small muted' });
  function clearSleep() { clearTimeout(sleepTimer); clearInterval(sleepTick); sleepTimer = sleepTick = null; sleepLabel.textContent = ''; sleepSel.value = '0'; }
  sleepSel.addEventListener('change', () => {
    clearTimeout(sleepTimer); clearInterval(sleepTick);
    const m = +sleepSel.value; if (!m) { sleepLabel.textContent = ''; return; }
    if (!playing) start();
    sleepEnd = Date.now() + m * 60000;
    const fade = Math.min(30, m * 60 * 0.2);
    sleepTimer = setTimeout(() => stop(fade), m * 60000 - fade * 1000);
    sleepTick = setInterval(() => {
      const left = Math.max(0, sleepEnd - Date.now()); const mm = Math.floor(left / 60000), ss = Math.floor(left / 1000) % 60;
      sleepLabel.textContent = `stops in ${mm}:${String(ss).padStart(2, '0')}`;
      if (left <= 0) clearSleep();
    }, 1000);
  });

  render(root,
    el('div', { class: 'row' }, playBtn, el('div', { class: 'row grow', style: { margin: 0 } }, el('span', { class: 'small muted' }, 'Master'), masterIn, masterLabel)),
    el('div', { class: 'panel' }, layerRows),
    el('div', { class: 'row' }, el('span', { class: 'muted small' }, 'Presets:'), presetList),
    el('div', { class: 'row' }, presetName, el('button', { class: 'btn', onclick: savePreset }, 'Save current mix')),
    el('div', { class: 'row' }, field('Sleep timer', sleepSel), sleepLabel),
    el('p', { class: 'muted small' }, 'All sounds are generated in the browser with the Web Audio API — nothing is downloaded. The sleep timer fades out and stops playback.'));
  renderPresets();

  return () => {
    clearTimeout(sleepTimer); clearInterval(sleepTick);
    for (const k in nodes) nodes[k].sources.forEach(x => { try { x.stop(); } catch {} });
    nodes = {}; playing = false;
    if (ac) { ac.close().catch(() => {}); ac = null; }
  };
}
