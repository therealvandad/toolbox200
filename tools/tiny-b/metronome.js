import { el, render, store, loop } from '../../lib/ui.js';

export default function (root) {
  const s = store('metronome');
  let bpm = s.get('bpm', 100), beats = s.get('beats', 4), unit = s.get('unit', 4), vol = s.get('vol', 0.6);
  let ctx = null, timerId = 0, stopLoop = null, running = false;
  let nextTime = 0, beatIdx = 0, queue = [];
  let taps = [];

  const bpmNum = el('input', { class: 'input', type: 'number', min: 20, max: 300, value: bpm, style: { width: '90px', fontSize: '20px' } });
  const bpmRange = el('input', { type: 'range', min: 20, max: 300, value: bpm, style: { flex: 1, minWidth: '160px' } });
  const beatsSel = el('select', { class: 'select' }, Array.from({ length: 12 }, (_, i) => el('option', { value: i + 1 }, i + 1)));
  const unitSel = el('select', { class: 'select' }, [2, 4, 8, 16].map(u => el('option', { value: u }, u)));
  const volIn = el('input', { type: 'range', min: 0, max: 1, step: 0.05, value: vol, style: { width: '120px' } });
  const toggleBtn = el('button', { class: 'btn primary', style: { minWidth: '110px' } }, 'Start');
  const tapBtn = el('button', { class: 'btn' }, 'Tap tempo');
  const dots = el('div', { class: 'row', style: { justifyContent: 'center', gap: '12px', minHeight: '48px' } });
  const tempoName = el('div', { class: 'muted center' });
  beatsSel.value = beats; unitSel.value = unit;

  const NAMES = [[40, 'Grave'], [60, 'Largo'], [66, 'Larghetto'], [76, 'Adagio'], [108, 'Andante'], [120, 'Moderato'], [156, 'Allegro'], [176, 'Vivace'], [200, 'Presto'], [400, 'Prestissimo']];
  function paintDots(active = -1) {
    const els = [...dots.children];
    if (els.length !== beats) {
      render(dots, Array.from({ length: beats }, (_, i) => el('div', { style: { width: i === 0 ? '34px' : '26px', height: i === 0 ? '34px' : '26px', borderRadius: '50%', border: '2px solid var(--line)', background: 'var(--bg)', transition: 'background .05s' } })));
      return paintDots(active);
    }
    els.forEach((d, i) => { d.style.background = i === active ? (i === 0 ? 'var(--danger)' : 'var(--accent)') : 'var(--bg)'; d.style.borderColor = i === active ? 'transparent' : 'var(--line)'; });
  }
  function paintName() { tempoName.textContent = (NAMES.find(n => bpm <= n[0]) || NAMES[NAMES.length - 1])[1]; }
  function setBpm(v) {
    bpm = Math.max(20, Math.min(300, Math.round(v) || 100));
    bpmNum.value = bpm; bpmRange.value = bpm; s.set('bpm', bpm); paintName();
  }

  function click(time, accent) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = accent ? 1600 : 1000; o.type = 'square';
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol * 0.5), time + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.06);
    o.connect(g).connect(ctx.destination);
    o.start(time); o.stop(time + 0.08);
  }
  function scheduler() {
    // BPM is the click rate; the denominator is only the notation of the signature
    while (nextTime < ctx.currentTime + 0.12) {
      click(nextTime, beatIdx === 0);
      queue.push({ t: nextTime, i: beatIdx });
      nextTime += 60 / bpm;
      beatIdx = (beatIdx + 1) % beats;
    }
  }
  function start() {
    try { ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { toggleBtn.textContent = 'Audio unavailable'; return; }
    if (ctx.state === 'suspended') ctx.resume();
    running = true; beatIdx = 0; queue = []; nextTime = ctx.currentTime + 0.06;
    scheduler(); timerId = setInterval(scheduler, 25);
    let shown = -1;
    stopLoop = loop(() => {
      while (queue.length && queue[0].t <= ctx.currentTime) { shown = queue.shift().i; paintDots(shown); }
    });
    toggleBtn.textContent = 'Stop'; toggleBtn.className = 'btn danger';
  }
  function stop() {
    running = false; clearInterval(timerId); timerId = 0;
    if (stopLoop) { stopLoop(); stopLoop = null; }
    queue = []; paintDots(-1);
    toggleBtn.textContent = 'Start'; toggleBtn.className = 'btn primary';
  }
  function tap() {
    const now = performance.now();
    if (taps.length && now - taps[taps.length - 1] > 2000) taps = [];
    taps.push(now); taps = taps.slice(-8);
    if (taps.length >= 2) setBpm(60000 / ((taps[taps.length - 1] - taps[0]) / (taps.length - 1)));
  }

  toggleBtn.addEventListener('click', () => (running ? stop() : start()));
  tapBtn.addEventListener('click', tap);
  bpmRange.addEventListener('input', () => setBpm(Number(bpmRange.value)));
  bpmNum.addEventListener('change', () => setBpm(Number(bpmNum.value)));
  beatsSel.addEventListener('change', () => { beats = Number(beatsSel.value); s.set('beats', beats); beatIdx = 0; paintDots(-1); });
  unitSel.addEventListener('change', () => { unit = Number(unitSel.value); s.set('unit', unit); });
  volIn.addEventListener('input', () => { vol = Number(volIn.value); s.set('vol', vol); });

  render(root,
    el('div', { class: 'row' },
      el('label', { class: 'inline' }, 'BPM', bpmNum), bpmRange,
      el('button', { class: 'btn small', onclick: () => setBpm(bpm - 1) }, '-'),
      el('button', { class: 'btn small', onclick: () => setBpm(bpm + 1) }, '+')),
    tempoName,
    el('div', { class: 'row' },
      el('label', { class: 'inline' }, 'Time signature', beatsSel, '/', unitSel),
      el('label', { class: 'inline' }, 'Volume', volIn)),
    dots,
    el('div', { class: 'row', style: { justifyContent: 'center' } }, toggleBtn, tapBtn),
    el('div', { class: 'small muted center' }, 'First beat is accented (higher click, red dot). Tap the button at least twice to set the tempo.'));
  paintDots(-1); paintName();

  return () => {
    stop();
    if (ctx) { try { ctx.close(); } catch {} ctx = null; }
  };
}
