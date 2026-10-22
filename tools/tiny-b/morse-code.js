import { el, render, store, copy } from '../../lib/ui.js';

const TABLE = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---', K: '-.-', L: '.-..', M: '--',
  N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..',
  0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-', 5: '.....', 6: '-....', 7: '--...', 8: '---..', 9: '----.',
  '.': '.-.-.-', ',': '--..--', '?': '..--..', "'": '.----.', '!': '-.-.--', '/': '-..-.', '(': '-.--.', ')': '-.--.-', '&': '.-...', ':': '---...',
  ';': '-.-.-.', '=': '-...-', '+': '.-.-.', '-': '-....-', '_': '..--.-', '"': '.-..-.', '$': '...-..-', '@': '.--.-.',
};
const REV = Object.fromEntries(Object.entries(TABLE).map(([k, v]) => [v, k]));

function toMorse(text) {
  return text.toUpperCase().split(/\s+/).filter(Boolean)
    .map(w => [...w].map(c => TABLE[c]).filter(Boolean).join(' ')).filter(Boolean).join(' / ');
}
function normMorse(m) { return m.replace(/[·•]/g, '.').replace(/[–—_]/g, '-'); }
function fromMorse(m) {
  return normMorse(m).trim().split(/\s*\/\s*|\s{3,}|\n+/)
    .map(w => w.split(/\s+/).filter(Boolean).map(c => REV[c] ?? '?').join('')).join(' ');
}

export default function (root) {
  const s = store('morse-code');
  const text = el('textarea', { class: 'textarea prose', placeholder: 'Type text…', value: s.get('text', 'SOS HELLO') });
  const morse = el('textarea', { class: 'textarea', placeholder: '... --- ...', value: '' });
  const wpmIn = el('input', { type: 'range', min: 5, max: 40, value: s.get('wpm', 15), style: { width: '160px' } });
  const wpmLbl = el('span', { class: 'mono' });
  const freqIn = el('input', { type: 'range', min: 300, max: 1000, step: 10, value: s.get('freq', 600), style: { width: '160px' } });
  const freqLbl = el('span', { class: 'mono' });
  const soundCb = el('input', { type: 'checkbox', checked: s.get('sound', true) });
  const lightCb = el('input', { type: 'checkbox', checked: s.get('light', true) });
  const light = el('div', { style: { height: '90px', borderRadius: '10px', border: '1px solid var(--line)', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' } }, 'light');
  const playBtn = el('button', { class: 'btn primary' }, 'Play');
  const stopBtn = el('button', { class: 'btn', disabled: true }, 'Stop');
  const info = el('div', { class: 'small muted' });
  let ctx = null, timers = [], osc = null;

  function setLight(on) {
    light.style.background = on ? '#ffe45c' : 'var(--bg)';
    light.style.color = on ? '#333' : 'var(--muted)';
    light.style.boxShadow = on ? '0 0 40px 10px #ffe45c' : 'none';
  }
  function stop() {
    timers.forEach(clearTimeout); timers = [];
    if (osc) { try { osc.stop(); } catch {} osc = null; }
    setLight(false);
    playBtn.disabled = false; stopBtn.disabled = true;
  }
  function schedule(m, unit) {
    const ev = []; let t = 0;
    for (const word of m.split('/')) {
      for (const letter of word.trim().split(/\s+/).filter(Boolean)) {
        for (const sym of letter) {
          if (sym !== '.' && sym !== '-') continue;
          const d = sym === '.' ? unit : unit * 3;
          ev.push([t, d]); t += d + unit;
        }
        t += unit * 2;
      }
      t += unit * 4;
    }
    return { ev, end: t };
  }
  function play() {
    stop();
    const m = normMorse(morse.value);
    if (!/[.-]/.test(m)) { info.textContent = 'Nothing to play.'; return; }
    const useSound = soundCb.checked, useLight = lightCb.checked;
    if (!useSound && !useLight) { info.textContent = 'Enable sound or the flashing light.'; return; }
    const unit = 1.2 / Number(wpmIn.value);
    const { ev, end } = schedule(m, unit);
    info.textContent = 'Playing…';
    playBtn.disabled = true; stopBtn.disabled = false;
    const t0 = 0.08;
    if (useSound) {
      try {
        ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
        if (ctx.state === 'suspended') ctx.resume();
        const now = ctx.currentTime + t0;
        osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.frequency.value = Number(freqIn.value); g.gain.value = 0;
        osc.connect(g).connect(ctx.destination);
        for (const [st, d] of ev) {
          g.gain.setTargetAtTime(0.4, now + st, 0.004);
          g.gain.setTargetAtTime(0, now + st + d, 0.004);
        }
        osc.start(now); osc.stop(now + end + 0.1);
      } catch (e) { info.textContent = 'Audio unavailable: ' + e.message; }
    }
    if (useLight) for (const [st, d] of ev) {
      timers.push(setTimeout(() => setLight(true), (st + t0) * 1000));
      timers.push(setTimeout(() => setLight(false), (st + d + t0) * 1000));
    }
    timers.push(setTimeout(() => { stop(); info.textContent = 'Done.'; }, (end + t0) * 1000));
  }

  function fromText() { morse.value = toMorse(text.value); s.set('text', text.value); }
  function fromMorseBox() { text.value = fromMorse(morse.value); s.set('text', text.value); }
  function updLabels() {
    wpmLbl.textContent = wpmIn.value + ' WPM'; freqLbl.textContent = freqIn.value + ' Hz';
    s.set('wpm', Number(wpmIn.value)); s.set('freq', Number(freqIn.value));
  }
  text.addEventListener('input', fromText);
  morse.addEventListener('input', fromMorseBox);
  wpmIn.addEventListener('input', updLabels);
  freqIn.addEventListener('input', updLabels);
  soundCb.addEventListener('change', () => s.set('sound', soundCb.checked));
  lightCb.addEventListener('change', () => s.set('light', lightCb.checked));
  playBtn.addEventListener('click', play);
  stopBtn.addEventListener('click', () => { stop(); info.textContent = 'Stopped.'; });

  const ref = el('div', { class: 'row small mono' },
    Object.entries(TABLE).slice(0, 36).map(([k, v]) => el('span', { class: 'panel', style: { padding: '2px 6px' } }, k + ' ' + v)));

  render(root,
    el('div', { class: 'grid2' },
      el('label', { class: 'field' }, 'Text', text),
      el('label', { class: 'field' }, 'Morse (. and - ; space between letters, / between words)', morse)),
    el('div', { class: 'row' },
      el('button', { class: 'btn', onclick: () => copy(morse.value) }, 'Copy Morse'),
      el('button', { class: 'btn', onclick: () => copy(text.value) }, 'Copy text'),
      el('button', { class: 'btn ghost', onclick: () => { text.value = ''; morse.value = ''; s.set('text', ''); } }, 'Clear')),
    el('div', { class: 'row' },
      el('label', { class: 'inline' }, 'Speed', wpmIn, wpmLbl),
      el('label', { class: 'inline' }, 'Tone', freqIn, freqLbl),
      el('label', { class: 'inline' }, soundCb, 'Sound'),
      el('label', { class: 'inline' }, lightCb, 'Flashing light')),
    el('div', { class: 'row' }, playBtn, stopBtn, info),
    light,
    el('h3', {}, 'Reference'), ref);
  updLabels(); fromText();

  return () => { stop(); if (ctx) { try { ctx.close(); } catch {} ctx = null; } };
}
