// Simon Says: four pads with Web Audio tones, growing sequence, strict mode, best level.
import { el, render, store, toast } from '../../lib/ui.js';

const PADS = [
  { color: '#1f9d55', freq: 392, key: '1', name: 'green' },
  { color: '#d64545', freq: 329.6, key: '2', name: 'red' },
  { color: '#d98c0b', freq: 261.6, key: '3', name: 'yellow' },
  { color: '#2f6fed', freq: 196, key: '4', name: 'blue' },
];

export default function (root) {
  const s = store('simon');
  let best = s.get('best', 0), strict = s.get('strict', false);
  let seq = [], pos = 0, state = 'idle', timers = [], actx = null;

  function tone(freq, ms = 300) {
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
      const o = actx.createOscillator(), gn = actx.createGain();
      o.type = 'sine'; o.frequency.value = freq; o.connect(gn); gn.connect(actx.destination);
      const t = actx.currentTime; gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(0.3, t + 0.02); gn.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
      o.start(t); o.stop(t + ms / 1000 + 0.05);
    } catch {}
  }
  const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); return t; };
  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };

  const padEls = PADS.map((p, i) => el('button', {
    class: 'btn', 'aria-label': p.name + ' pad (key ' + p.key + ')',
    style: { background: p.color, border: 0, borderRadius: i === 0 ? '100% 12px 12px 12px' : i === 1 ? '12px 100% 12px 12px' : i === 2 ? '12px 12px 12px 100%' : '12px 12px 100% 12px', aspectRatio: '1', opacity: 0.55, transition: 'opacity .1s, transform .1s', fontSize: '22px', color: '#fff', fontWeight: 700, touchAction: 'manipulation' },
    onpointerdown: e => { e.preventDefault(); press(i); },
  }, p.key));
  const board = el('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', width: 'min(320px, 80vw)', margin: '0 auto' } }, padEls);
  const status = el('div', { class: 'big center', style: { minHeight: '32px' } }, 'Press Start');
  const levelStat = el('div', { class: 'row center' });
  const strictCb = el('input', { type: 'checkbox', checked: strict, onchange: () => { strict = strictCb.checked; s.set('strict', strict); } });

  function light(i, ms = 300) {
    const p = padEls[i]; p.style.opacity = '1'; p.style.transform = 'scale(1.04)'; tone(PADS[i].freq, ms);
    later(() => { p.style.opacity = '0.55'; p.style.transform = ''; }, ms);
  }
  function showStats() { render(levelStat, el('div', { class: 'stat' }, el('div', { class: 'v' }, seq.length), el('div', { class: 'l' }, 'level')), el('div', { class: 'stat' }, el('div', { class: 'v' }, best), el('div', { class: 'l' }, 'best level'))); }
  function playback() {
    state = 'show'; pos = 0; status.textContent = 'Watch…';
    const gap = Math.max(250, 650 - seq.length * 25);
    seq.forEach((v, i) => later(() => light(v, gap * 0.6), 500 + i * gap));
    later(() => { state = 'input'; status.textContent = 'Your turn — repeat ' + seq.length + (seq.length === 1 ? ' pad' : ' pads'); }, 500 + seq.length * gap);
  }
  function next() { seq.push(Math.floor(Math.random() * 4)); if (seq.length - 1 > best) { best = seq.length - 1; s.set('best', best); } showStats(); playback(); }
  function start() { clearTimers(); seq = []; tone(523, 120); later(next, 300); }
  function press(i) {
    if (state === 'idle') { start(); return; }
    if (state !== 'input') return;
    light(i, 220);
    if (seq[pos] === i) {
      pos++;
      if (pos === seq.length) { state = 'wait'; status.textContent = 'Correct!'; later(next, 800); }
    } else {
      state = 'wait'; tone(110, 500);
      if (strict) { status.textContent = `Wrong! Game over at level ${seq.length}. Press Start.`; if (seq.length - 1 > best) { best = seq.length - 1; s.set('best', best); } showStats(); later(() => { state = 'idle'; }, 500); }
      else { status.textContent = 'Wrong — watch again'; later(playback, 900); }
    }
  }
  const onKey = e => {
    const i = ['1', '2', '3', '4'].indexOf(e.key);
    if (i >= 0) { e.preventDefault(); press(i); }
    else if (e.key === 'Enter' && state === 'idle') start();
    else if (e.key === 'Escape') { clearTimers(); state = 'idle'; seq = []; showStats(); status.textContent = 'Stopped. Press Start.'; }
  };
  window.addEventListener('keydown', onKey);

  render(root,
    el('div', { class: 'row center' },
      el('button', { class: 'btn primary', onclick: start }, 'Start'),
      el('label', { class: 'inline' }, strictCb, ' Strict mode (one mistake ends the game)'),
      el('span', { class: 'small muted' }, 'Keys ', el('span', { class: 'kbd' }, '1'), '–', el('span', { class: 'kbd' }, '4'), ' or click the pads. ', el('span', { class: 'kbd' }, 'Esc'), ' stops.')),
    levelStat, status, board);
  showStats();
  return () => { clearTimers(); window.removeEventListener('keydown', onKey); if (actx) { try { actx.close(); } catch {} } };
}
