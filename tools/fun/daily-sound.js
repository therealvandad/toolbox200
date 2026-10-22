import { el, render, store, rng, pad } from '../../lib/ui.js';
import { audio } from './_fx.js';

// Each recipe: (A, p, ctx) where p is a pitch factor ~0.8..1.25 chosen by the date.
const RECIPES = [
  ['chirp', (A, p) => { A.tone(1800 * p, 0.08, { type: 'sine', vol: 0.25, slideTo: 3200 * p }); A.tone(2400 * p, 0.1, { type: 'sine', vol: 0.2, at: 0.1, slideTo: 3600 * p }); A.tone(1500 * p, 0.12, { type: 'sine', vol: 0.2, at: 0.24, slideTo: 3000 * p }); }],
  ['laser', (A, p) => { A.tone(1800 * p, 0.35, { type: 'sawtooth', vol: 0.15, slideTo: 90 }); A.tone(900 * p, 0.35, { type: 'square', vol: 0.06, slideTo: 60 }); }],
  ['gong', (A, p) => { [1, 1.51, 2.02, 2.77, 3.4].forEach((m, i) => A.tone(110 * p * m, 3.2 - i * 0.3, { type: 'sine', vol: 0.22 / (i + 1), attack: 0.01 })); A.noise(0.4, { vol: 0.25, freq: 2500, type: 'highpass' }); }],
  ['boing', (A, p, x) => { const o = x.createOscillator(), g = x.createGain(), l = x.createOscillator(), lg = x.createGain(); const t = x.currentTime; o.type = 'sine'; o.frequency.setValueAtTime(140 * p, t); o.frequency.exponentialRampToValueAtTime(520 * p, t + 0.08); o.frequency.exponentialRampToValueAtTime(110 * p, t + 0.9); l.frequency.value = 22; lg.gain.value = 40; l.connect(lg).connect(o.frequency); g.gain.setValueAtTime(0.4, t); g.gain.exponentialRampToValueAtTime(0.001, t + 1); o.connect(g).connect(x.destination); o.start(t); l.start(t); o.stop(t + 1.05); l.stop(t + 1.05); }],
  ['drum roll', (A, p) => { for (let i = 0; i < 28; i++) A.noise(0.07, { vol: 0.1 + i * 0.012, freq: 220 * p, q: 1.2, at: i * 0.055 }); A.noise(0.5, { vol: 0.35, freq: 4000, type: 'highpass', at: 1.65 }); A.tone(70, 0.5, { vol: 0.5, at: 1.65, slideTo: 40 }); }],
  ['sparkle', (A, p) => { [1, 1.25, 1.5, 2, 2.5, 3, 4].forEach((m, i) => A.tone(1000 * p * m, 0.4, { type: 'triangle', vol: 0.09, at: i * 0.07 })); }],
  ['sad trombone', (A, p) => { [[233, 0], [220, 0.45], [207, 0.9]].forEach(([f, at]) => A.tone(f * p, 0.45, { type: 'sawtooth', vol: 0.12, at })); A.tone(196 * p, 1.2, { type: 'sawtooth', vol: 0.12, at: 1.35, slideTo: 150 * p }); }],
  ['coin', (A, p) => { A.tone(988 * p, 0.09, { type: 'square', vol: 0.12 }); A.tone(1319 * p, 0.5, { type: 'square', vol: 0.12, at: 0.09 }); }],
  ['whoosh', (A, p) => { A.noise(1.1, { vol: 0.6, freq: 300 * p, q: 2, sweepTo: 5000 }); }],
  ['bloop', (A, p) => { A.tone(300 * p, 0.14, { vol: 0.35, slideTo: 900 * p }); A.tone(400 * p, 0.12, { vol: 0.25, slideTo: 1200 * p, at: 0.18 }); }],
  ['siren', (A, p, x) => { const o = x.createOscillator(), g = x.createGain(), t = x.currentTime; o.type = 'triangle'; for (let i = 0; i < 4; i++) { o.frequency.linearRampToValueAtTime(900 * p, t + i * 0.7 + 0.35); o.frequency.linearRampToValueAtTime(500 * p, t + i * 0.7 + 0.7); } g.gain.setValueAtTime(0.2, t); g.gain.linearRampToValueAtTime(0.0001, t + 2.8); o.connect(g).connect(x.destination); o.start(t); o.stop(t + 2.8); }],
  ['knock knock', (A, p) => { [0, 0.22, 0.65, 0.85].forEach(at => { A.tone(160 * p, 0.09, { vol: 0.6, at, slideTo: 70 }); A.noise(0.05, { vol: 0.4, freq: 900, at }); }); }],
  ['cricket', (A, p) => { for (let k = 0; k < 3; k++) for (let i = 0; i < 4; i++) A.tone(4200 * p, 0.04, { vol: 0.07, at: k * 0.5 + i * 0.07 }); }],
  ['power up', (A, p) => { [262, 330, 392, 523, 659, 784, 1047].forEach((f, i) => A.tone(f * p, 0.09, { type: 'square', vol: 0.09, at: i * 0.06 })); A.tone(1047 * p, 0.4, { type: 'square', vol: 0.09, at: 0.45 }); }],
  ['power down', (A, p) => { A.tone(900 * p, 1.1, { type: 'sawtooth', vol: 0.14, slideTo: 40 }); A.tone(450 * p, 1.1, { type: 'square', vol: 0.06, slideTo: 20 }); }],
  ['organ', (A, p) => { [1, 1.25, 1.5, 2].forEach(m => { A.tone(220 * p * m, 1.8, { type: 'sine', vol: 0.1, attack: 0.15 }); A.tone(440 * p * m, 1.8, { type: 'sine', vol: 0.04, attack: 0.15 }); }); }],
  ['water drop', (A, p) => { A.tone(1400 * p, 0.12, { vol: 0.3, slideTo: 500 * p }); A.tone(1000 * p, 0.5, { vol: 0.05, at: 0.1, slideTo: 800 * p }); A.noise(0.04, { vol: 0.1, freq: 3000 }); }],
  ['robot', (A, p, x) => { const t = x.currentTime, c = x.createOscillator(), m = x.createOscillator(), mg = x.createGain(), g = x.createGain(); c.type = 'sine'; c.frequency.value = 200 * p; m.frequency.setValueAtTime(30, t); m.frequency.linearRampToValueAtTime(240, t + 0.9); mg.gain.value = 300; m.connect(mg).connect(c.frequency); g.gain.setValueAtTime(0.3, t); g.gain.exponentialRampToValueAtTime(0.001, t + 1); c.connect(g).connect(x.destination); c.start(t); m.start(t); c.stop(t + 1.05); m.stop(t + 1.05); }],
  ['heartbeat', (A, p) => { [0, 0.25, 0.9, 1.15].forEach((at, i) => A.tone((i % 2 ? 50 : 62) * p, 0.18, { vol: 0.8, at, slideTo: 35 })); }],
  ['wind chimes', (A, p) => { const n = [1, 1.125, 1.333, 1.5, 1.667, 2]; for (let i = 0; i < 9; i++) A.tone(880 * p * n[(i * 5) % n.length], 2, { vol: 0.07, at: i * 0.17 + (i % 2) * 0.05 }); }],
];

const ADJ = ['Velvet', 'Hollow', 'Nine-Fingered', 'Borrowed', 'Quiet', 'Copper', 'Sleepwalking', 'Midnight', 'Paper', 'Forgotten', 'Wandering', 'Glass', 'Tuesday\'s', 'Seventh', 'Lukewarm', 'Reluctant'];
const NOUN = ['Lantern', 'Anchor', 'Moth', 'Compass', 'Whisper', 'Orchard', 'Marionette', 'Telegram', 'Comet', 'Almanac', 'Pendulum', 'Fox', 'Lighthouse', 'Riddle', 'Umbrella', 'Gargoyle'];

function dayKey(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function dayNum(d) { return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5); }
function info(d) {
  const n = dayNum(d), r = rng(n * 2654435761 % 4294967296 + 17);
  const idx = ((n * 7) % RECIPES.length + RECIPES.length) % RECIPES.length; // 7 is coprime to 20: no repeats within 20 days
  const pitch = 0.8 + r() * 0.45;
  const name = `The ${ADJ[Math.floor(r() * ADJ.length)]} ${NOUN[Math.floor(r() * NOUN.length)]}`;
  return { idx, pitch, name, key: dayKey(d) };
}

export default function (root) {
  const s = store('daily-sound');
  const A = audio();
  let offset = 0, pressTimers = [];
  const presses = s.get('presses', {});

  const style = el('style', {}, `
    @keyframes ds-ring{0%{transform:scale(1);opacity:.6}100%{transform:scale(1.9);opacity:0}}
    .ds-btn{position:relative;width:min(70vw,260px);aspect-ratio:1;border-radius:50%;border:0;cursor:pointer;color:#fff;font-size:22px;font-weight:700;background:radial-gradient(circle at 35% 30%,#ff9a9e,#d6336c 60%,#862e9c);box-shadow:0 10px 0 #5f1f6e,0 18px 30px rgba(0,0,0,.35);transition:transform .08s,box-shadow .08s}
    .ds-btn:active,.ds-btn.hit{transform:translateY(8px);box-shadow:0 2px 0 #5f1f6e,0 6px 12px rgba(0,0,0,.35)}
    .ds-ring{position:absolute;inset:0;border-radius:50%;border:3px solid #d6336c;pointer-events:none;animation:ds-ring .8s ease-out forwards}
  `);
  const dateLbl = el('div', { class: 'big center' }), nameLbl = el('div', { class: 'center', style: { fontSize: '20px', fontStyle: 'italic' } });
  const counter = el('div', { class: 'center muted' });
  const wrap = el('div', { class: 'center', style: { position: 'relative', margin: '24px 0', display: 'flex', justifyContent: 'center' } });
  const btn = el('button', { class: 'ds-btn', onclick: play }, 'Press');
  wrap.append(btn);

  function cur() { const d = new Date(); d.setDate(d.getDate() + offset); return d; }
  function refresh() {
    const d = cur(), inf = info(d);
    dateLbl.textContent = offset === 0 ? 'Today' : d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
    nameLbl.textContent = inf.name;
    counter.textContent = `Pressed ${presses[inf.key] || 0} time${(presses[inf.key] || 0) === 1 ? '' : 's'} on this day` + (offset === 0 ? '' : ' (preview)');
    btn.textContent = offset === 0 ? 'Press' : 'Preview';
  }
  function play() {
    const x = A.ctx(); if (!x) return;
    const inf = info(cur());
    RECIPES[inf.idx][1](A, inf.pitch, x);
    presses[inf.key] = (presses[inf.key] || 0) + 1; s.set('presses', presses);
    const ring = el('div', { class: 'ds-ring' }); wrap.firstChild.append(ring); setTimeout(() => ring.remove(), 850);
    btn.classList.add('hit'); const t = setTimeout(() => btn.classList.remove('hit'), 110); pressTimers.push(t);
    refresh();
  }
  const move = d => { offset += d; refresh(); };

  render(root, style, dateLbl, nameLbl,
    el('div', { class: 'row', style: { justifyContent: 'center', gap: '18px', flexWrap: 'nowrap' } },
      el('button', { class: 'btn', 'aria-label': 'Previous day', onclick: () => move(-1) }, '←'),
      wrap,
      el('button', { class: 'btn', 'aria-label': 'Next day', onclick: () => move(1) }, '→')),
    counter,
    el('div', { class: 'row', style: { justifyContent: 'center' } }, el('button', { class: 'btn small ghost', onclick: () => { offset = 0; refresh(); } }, 'Back to today')),
    el('p', { class: 'small muted center' }, 'A different synthesized sound every day, picked from 20 recipes. Its name is not a hint.'));
  refresh();
  return () => { pressTimers.forEach(clearTimeout); A.close(); };
}
