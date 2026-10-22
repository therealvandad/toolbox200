// Morse code trainer (Koch method): plays a character with Web Audio, you type it; new characters unlock as accuracy rises.
import { el, render, store, stat, field } from '../../lib/ui.js';

const MORSE = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---', K: '-.-', L: '.-..', M: '--',
  N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..',
  0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-', 5: '.....', 6: '-....', 7: '--...', 8: '---..', 9: '----.',
  '.': '.-.-.-', ',': '--..--', '?': '..--..', '/': '-..-.', '=': '-...-',
};
const KOCH = 'KMRSUAPTLOWI.NJEF0Y,VG5/Q9ZH38B?427C1D6X';
const WINDOW = 20, PROMOTE = 0.9;

export default function (root) {
  const s = store('morse-trainer');
  let level = s.get('level', 2);            // number of characters in play (min 2)
  let wpm = s.get('wpm', 20);               // character speed
  let tone = s.get('tone', 600);
  let perChar = s.get('perChar', {});       // ch -> {n, ok}
  let recent = s.get('recent', []);         // last WINDOW results (1/0)
  let total = s.get('total', 0), correct = s.get('correct', 0);
  let current = null, awaiting = false, playing = false;
  let ctx = null, timers = [], pendingNext = null;

  function audio() { if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)(); if (ctx.state === 'suspended') ctx.resume(); return ctx; }
  function playChar(ch) {
    const ac = audio();
    const dit = 1.2 / wpm; // seconds (PARIS standard)
    let t = ac.currentTime + 0.05;
    const osc = ac.createOscillator(); const g = ac.createGain();
    osc.type = 'sine'; osc.frequency.value = tone; g.gain.value = 0;
    osc.connect(g); g.connect(ac.destination); osc.start(t);
    for (const sym of MORSE[ch]) {
      const len = sym === '.' ? dit : dit * 3;
      g.gain.setTargetAtTime(0.5, t, 0.004); g.gain.setTargetAtTime(0, t + len - 0.004, 0.004);
      t += len + dit;
    }
    osc.stop(t + 0.05);
    playing = true;
    timers.push(setTimeout(() => { playing = false; }, (t - ac.currentTime) * 1000));
  }

  function pool() { return KOCH.slice(0, Math.max(2, Math.min(KOCH.length, level))).split(''); }
  function pickChar() {
    const p = pool();
    // weight the two newest and any weak characters more heavily
    const weights = p.map((ch, i) => {
      const st = perChar[ch]; let w = 1;
      if (i >= p.length - 2) w += 1.5;
      if (st && st.n >= 3 && st.ok / st.n < 0.8) w += 2;
      return w;
    });
    let r = Math.random() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < p.length; i++) { r -= weights[i]; if (r <= 0) return p[i]; }
    return p[p.length - 1];
  }

  const answer = el('input', { class: 'input mono', placeholder: 'type the character you hear', maxlength: 1, autocomplete: 'off', autocapitalize: 'characters', style: { width: '260px', fontSize: '22px', textAlign: 'center' } });
  const feedback = el('div', { class: 'row', style: { minHeight: '34px' } });
  const statsBox = el('div', { class: 'row' });
  const poolBox = el('div', { class: 'row', style: { gap: '4px' } });
  const chart = el('div', { class: 'row', style: { gap: '6px' } });
  const progBar = el('div', { class: 'bar', style: { width: '100%', maxWidth: '420px' } }, el('div'));
  const startBtn = el('button', { class: 'btn primary', onclick: next }, 'Play next');
  const replayBtn = el('button', { class: 'btn', onclick: () => current && playChar(current) }, 'Replay');

  function next() {
    clearTimeout(pendingNext); pendingNext = null;
    current = pickChar(); awaiting = true;
    answer.value = ''; answer.focus();
    render(feedback, el('span', { class: 'muted small' }, 'Listening…'));
    playChar(current);
  }

  function grade(ch) {
    if (!awaiting || !current) return;
    awaiting = false;
    const ok = ch === current;
    total++; if (ok) correct++;
    const st = perChar[current] || { n: 0, ok: 0 }; st.n++; if (ok) st.ok++; perChar[current] = st;
    recent.push(ok ? 1 : 0); if (recent.length > WINDOW) recent.shift();
    let promoted = false;
    if (recent.length >= WINDOW && recent.reduce((a, b) => a + b, 0) / WINDOW >= PROMOTE && level < KOCH.length) {
      level++; recent = []; promoted = true;
    }
    s.set('level', level); s.set('perChar', perChar); s.set('recent', recent); s.set('total', total); s.set('correct', correct);
    render(feedback,
      el('span', { class: 'badge ' + (ok ? 'ok' : 'danger') }, ok ? 'Correct' : 'Wrong'),
      el('span', { class: 'mono' }, current + '  ' + MORSE[current]),
      !ok && el('span', { class: 'muted small' }, 'you typed ' + (ch || '—') + (MORSE[ch] ? ' (' + MORSE[ch] + ')' : '')),
      promoted && el('span', { class: 'badge ok' }, 'New character unlocked: ' + KOCH[level - 1]));
    drawStats();
    pendingNext = setTimeout(next, ok ? 700 : 1600); timers.push(pendingNext);
  }

  answer.addEventListener('input', () => {
    const ch = answer.value.toUpperCase().slice(-1);
    if (!ch) return;
    if (!awaiting) { answer.value = ''; return; }
    grade(ch);
  });
  answer.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !awaiting) { next(); e.preventDefault(); }
    if (e.key === ' ' || e.key === 'Tab') { if (current) playChar(current); e.preventDefault(); }
  });

  function drawStats() {
    const rec = recent.length ? Math.round(100 * recent.reduce((a, b) => a + b, 0) / recent.length) : 0;
    render(statsBox, stat(level, 'characters'), stat(total, 'answered'), stat(total ? Math.round(100 * correct / total) + '%' : '—', 'overall'), stat(rec + '%', 'last ' + recent.length));
    progBar.firstChild.style.width = Math.min(100, 100 * recent.length / WINDOW) + '%';
    render(poolBox, pool().map(ch => {
      const st = perChar[ch]; const acc = st && st.n ? st.ok / st.n : null;
      const color = acc == null ? 'var(--line)' : acc >= 0.9 ? 'var(--ok)' : acc >= 0.7 ? 'var(--warn)' : 'var(--danger)';
      return el('span', { class: 'kbd', title: st ? `${st.ok}/${st.n}` : 'not yet heard', style: { borderBottomColor: color, borderBottomWidth: '3px', fontSize: '14px', cursor: 'pointer' }, onclick: () => playChar(ch) }, ch);
    }));
    render(chart, Object.keys(MORSE).map(ch => el('span', { class: 'small mono', style: { padding: '2px 6px', border: '1px solid var(--line)', borderRadius: '5px', opacity: pool().includes(ch) ? 1 : 0.45, cursor: 'pointer' }, onclick: () => playChar(ch) }, ch + ' ' + MORSE[ch])));
  }

  const wpmIn = el('input', { class: 'input', type: 'number', min: 5, max: 40, value: wpm, style: { width: '80px' }, onchange: () => { wpm = Math.max(5, Math.min(40, +wpmIn.value || 20)); s.set('wpm', wpm); } });
  const toneIn = el('input', { class: 'input', type: 'number', min: 300, max: 1000, step: 50, value: tone, style: { width: '90px' }, onchange: () => { tone = Math.max(300, Math.min(1000, +toneIn.value || 600)); s.set('tone', tone); } });
  const levelIn = el('input', { class: 'input', type: 'number', min: 2, max: KOCH.length, value: level, style: { width: '80px' }, onchange: () => { level = Math.max(2, Math.min(KOCH.length, +levelIn.value || 2)); recent = []; s.set('level', level); s.set('recent', recent); drawStats(); } });

  render(root,
    el('div', { class: 'muted small' }, 'Koch method: start with K and M at full speed; a new character is added each time you score ' + Math.round(PROMOTE * 100) + '% over the last ' + WINDOW + ' answers. Space replays, Enter plays the next.'),
    el('div', { class: 'row' }, field('Char speed (WPM)', wpmIn), field('Tone (Hz)', toneIn), field('Characters', levelIn)),
    el('div', { class: 'row' }, startBtn, replayBtn, answer),
    feedback,
    el('div', { class: 'muted small' }, 'Progress to next character'), progBar,
    statsBox,
    el('div', { class: 'muted small' }, 'Characters in play (click to hear; underline colour = your accuracy)'), poolBox,
    el('details', {}, el('summary', { class: 'muted small', style: { cursor: 'pointer' } }, 'Reference chart'), chart),
    el('button', { class: 'btn small ghost', onclick: () => { level = 2; perChar = {}; recent = []; total = correct = 0; ['level', 'perChar', 'recent', 'total', 'correct'].forEach(k => s.del(k)); levelIn.value = 2; drawStats(); } }, 'Reset progress'));
  drawStats();
  return () => { timers.forEach(clearTimeout); if (ctx) { try { ctx.close(); } catch {} } };
}
