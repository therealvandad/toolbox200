// Ear training: hear two notes, name the interval. Choose which intervals to practise, keep score, replay.
import { el, render, store, stat, field, toast } from '../../lib/ui.js';

const INTERVALS = [
  { semi: 0, short: 'P1', name: 'Unison' },
  { semi: 1, short: 'm2', name: 'Minor 2nd' },
  { semi: 2, short: 'M2', name: 'Major 2nd' },
  { semi: 3, short: 'm3', name: 'Minor 3rd' },
  { semi: 4, short: 'M3', name: 'Major 3rd' },
  { semi: 5, short: 'P4', name: 'Perfect 4th' },
  { semi: 6, short: 'TT', name: 'Tritone' },
  { semi: 7, short: 'P5', name: 'Perfect 5th' },
  { semi: 8, short: 'm6', name: 'Minor 6th' },
  { semi: 9, short: 'M6', name: 'Major 6th' },
  { semi: 10, short: 'm7', name: 'Minor 7th' },
  { semi: 11, short: 'M7', name: 'Major 7th' },
  { semi: 12, short: 'P8', name: 'Octave' },
];
const PRESETS = {
  easy: [0, 5, 7, 12],
  medium: [0, 2, 3, 4, 5, 7, 9, 12],
  hard: INTERVALS.map(i => i.semi),
};

export default function (root) {
  const s = store('ear-training');
  const cfg = Object.assign({ enabled: PRESETS.medium, dir: 'asc', wave: 'triangle', tempo: 0.6 }, s.get('cfg', {}));
  let score = s.get('score', { right: 0, wrong: 0, streak: 0, best: 0 });
  let ac = null, current = null, answered = false, timers = [];

  function audio() {
    if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }
  const freq = m => 440 * Math.pow(2, (m - 69) / 12);
  function tone(midi, at, dur) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = cfg.wave; o.frequency.value = freq(midi);
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(0.4, at + 0.02);
    g.gain.setValueAtTime(0.4, at + dur - 0.08);
    g.gain.linearRampToValueAtTime(0, at + dur);
    o.connect(g); g.connect(ac.destination);
    o.start(at); o.stop(at + dur + 0.02);
  }
  function playCurrent() {
    if (!current) return;
    audio();
    const t = ac.currentTime + 0.05, d = cfg.tempo;
    const [a, b] = current.dir === 'desc' ? [current.root + current.semi, current.root] : [current.root, current.root + current.semi];
    if (current.dir === 'harm') { tone(a, t, d * 2); tone(b, t, d * 2); }
    else { tone(a, t, d); tone(b, t + d, d); }
  }
  function next() {
    const pool = INTERVALS.filter(i => cfg.enabled.includes(i.semi));
    if (!pool.length) { toast('Enable at least one interval'); return; }
    const iv = pool[Math.floor(Math.random() * pool.length)];
    const root = 48 + Math.floor(Math.random() * 24); // C3..B4
    let dir = cfg.dir; if (dir === 'mix') dir = ['asc', 'desc', 'harm'][Math.floor(Math.random() * 3)];
    current = { semi: iv.semi, root, dir };
    answered = false;
    feedback.textContent = 'Listen, then pick the interval.'; feedback.style.color = '';
    renderAnswers();
    playCurrent();
  }
  function answer(semi) {
    if (!current || answered) return;
    answered = true;
    const iv = INTERVALS.find(i => i.semi === current.semi);
    if (semi === current.semi) {
      score.right++; score.streak++; score.best = Math.max(score.best, score.streak);
      feedback.textContent = `Correct — ${iv.name} (${iv.semi} semitones).`; feedback.style.color = 'var(--ok)';
    } else {
      score.wrong++; score.streak = 0;
      const picked = INTERVALS.find(i => i.semi === semi);
      feedback.textContent = `No — that was a ${iv.name}, not a ${picked.name}.`; feedback.style.color = 'var(--danger)';
    }
    s.set('score', score); renderScore(); renderAnswers();
    timers.push(setTimeout(next, 1400));
  }

  const scoreBox = el('div', { class: 'row' });
  function renderScore() {
    const total = score.right + score.wrong;
    render(scoreBox, stat(score.right, 'correct'), stat(score.wrong, 'wrong'),
      stat(total ? Math.round(100 * score.right / total) + '%' : '–', 'accuracy'), stat(score.streak, 'streak'), stat(score.best, 'best streak'));
  }
  const answers = el('div', { class: 'row' });
  function renderAnswers() {
    render(answers, INTERVALS.filter(i => cfg.enabled.includes(i.semi)).map(i => {
      let cls = 'btn';
      if (answered && current) { if (i.semi === current.semi) cls += ' primary'; }
      return el('button', { class: cls, disabled: !current || answered, onclick: () => answer(i.semi), title: i.name }, `${i.short} `, el('span', { class: 'muted small' }, i.name));
    }));
  }
  const feedback = el('div', { style: { minHeight: '1.6em', fontWeight: 600 } }, 'Press Start to hear the first interval.');

  // settings
  const checks = el('div', { class: 'row' });
  function renderChecks() {
    render(checks, INTERVALS.map(i => el('label', { class: 'inline' },
      el('input', { type: 'checkbox', checked: cfg.enabled.includes(i.semi), onchange: e => {
        cfg.enabled = e.target.checked ? [...new Set([...cfg.enabled, i.semi])].sort((a, b) => a - b) : cfg.enabled.filter(x => x !== i.semi);
        s.set('cfg', cfg); renderAnswers();
      } }), i.short)));
  }
  const presetBtns = el('div', { class: 'row' }, Object.keys(PRESETS).map(k => el('button', { class: 'btn small', onclick: () => { cfg.enabled = [...PRESETS[k]]; s.set('cfg', cfg); renderChecks(); renderAnswers(); } }, k[0].toUpperCase() + k.slice(1))));
  const dirSel = el('select', { class: 'select', value: cfg.dir, onchange: e => { cfg.dir = e.target.value; s.set('cfg', cfg); } },
    el('option', { value: 'asc' }, 'Ascending'), el('option', { value: 'desc' }, 'Descending'), el('option', { value: 'harm' }, 'Harmonic (together)'), el('option', { value: 'mix' }, 'Mixed'));
  dirSel.value = cfg.dir;
  const waveSel = el('select', { class: 'select', onchange: e => { cfg.wave = e.target.value; s.set('cfg', cfg); } },
    ['triangle', 'sine', 'square', 'sawtooth'].map(w => el('option', { value: w }, w)));
  waveSel.value = cfg.wave;
  const tempoIn = el('input', { class: 'input', type: 'range', min: 0.3, max: 1.2, step: 0.1, value: cfg.tempo, oninput: e => { cfg.tempo = +e.target.value; s.set('cfg', cfg); } });

  render(root,
    el('div', { class: 'row' },
      el('button', { class: 'btn primary', onclick: next }, 'Start / Next'),
      el('button', { class: 'btn', onclick: playCurrent }, 'Replay'),
      el('button', { class: 'btn ghost small', onclick: () => { score = { right: 0, wrong: 0, streak: 0, best: 0 }; s.set('score', score); renderScore(); } }, 'Reset score')),
    feedback,
    answers,
    scoreBox,
    el('details', { class: 'panel' },
      el('summary', {}, 'Difficulty and sound'),
      el('div', { class: 'muted small' }, 'Intervals to practise:'),
      presetBtns, checks,
      el('div', { class: 'row' }, field('Direction', dirSel), field('Waveform', waveSel), field('Note length', tempoIn))),
    el('p', { class: 'muted small' }, 'Keyboard: Enter = start/next, R = replay, 1–9 and 0 pick answers in order.'));
  renderChecks(); renderAnswers(); renderScore();

  function onKey(e) {
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
    if (e.key === 'Enter') { e.preventDefault(); next(); }
    else if (e.key === 'r' || e.key === 'R') playCurrent();
    else if (/^[0-9]$/.test(e.key)) {
      const idx = e.key === '0' ? 9 : +e.key - 1;
      const pool = INTERVALS.filter(i => cfg.enabled.includes(i.semi));
      if (pool[idx]) answer(pool[idx].semi);
    }
  }
  window.addEventListener('keydown', onKey);
  return () => {
    window.removeEventListener('keydown', onKey);
    timers.forEach(clearTimeout);
    if (ac) { ac.close().catch(() => {}); ac = null; }
  };
}
