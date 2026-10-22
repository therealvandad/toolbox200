// Meditation timer: duration, interval bells, start/end bell via Web Audio, breathing visual, history.
import { el, render, store, uid, today, toast, stat, field, loop, pad } from '../../lib/ui.js';

export default function (root) {
  const s = store('meditation-timer');
  const cv = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || '#888';
  let minutes = +s.get('minutes', 10) || 10;
  let interval = +s.get('interval', 0) || 0;        // minutes between bells, 0 = none
  let visual = s.get('visual', true);
  let history = s.get('history', []);               // {id, date, minutes}
  let state = 'idle';                               // idle | running | paused | done
  let endAt = 0, leftMs = 0, totalMs = 0, nextBellMs = 0, timer = null, actx = null;

  function audio() {
    if (!actx) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) { try { actx = new AC(); } catch {} } }
    if (actx && actx.state === 'suspended') actx.resume().catch(() => {});
    return actx;
  }
  function bell(strong = true) {
    const a = audio(); if (!a) return;
    const t0 = a.currentTime, base = strong ? 440 : 660, dur = strong ? 4 : 2.2;
    [[1, 0.5], [2.01, 0.25], [2.76, 0.15], [5.4, 0.07]].forEach(([mul, amp]) => {
      const o = a.createOscillator(), g = a.createGain();
      o.type = 'sine'; o.frequency.value = base * mul;
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(amp * 0.6, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur / (mul > 2 ? 2 : 1));
      o.connect(g); g.connect(a.destination); o.start(t0); o.stop(t0 + dur + 0.1);
    });
  }

  const minIn = el('input', { class: 'input', type: 'number', min: 1, max: 240, value: minutes, style: { width: '90px' }, onchange: () => { minutes = Math.min(240, Math.max(1, Math.round(+minIn.value) || 10)); minIn.value = minutes; s.set('minutes', minutes); if (state === 'idle') showTime(minutes * 60000); } });
  const intSel = el('select', { class: 'select', onchange: () => { interval = +intSel.value; s.set('interval', interval); } },
    [0, 1, 2, 3, 5, 10, 15].map(m => el('option', { value: m, selected: m === interval }, m ? `every ${m} min` : 'no interval bell')));
  const visCk = el('input', { type: 'checkbox', checked: visual, onchange: () => { visual = visCk.checked; s.set('visual', visual); } });
  const timeBox = el('div', { class: 'huge', style: { fontFamily: 'ui-monospace, Consolas, monospace', textAlign: 'center' } });
  const bar = el('div', { class: 'bar' }, el('div', { style: { width: '0%' } }));
  const cvs = el('canvas', { width: 280, height: 280, style: { width: '100%', maxWidth: '280px' } });
  const startBtn = el('button', { class: 'btn primary', onclick: () => toggle() });
  const stopBtn = el('button', { class: 'btn ghost', onclick: () => finish(false) }, 'End early');
  const stats = el('div', { class: 'row' });
  const hist = el('div', { class: 'scroll-x' });
  const presets = el('div', { class: 'row' }, [5, 10, 15, 20, 30].map(m => el('button', { class: 'btn small ghost', onclick: () => { if (state !== 'idle') return; minutes = m; minIn.value = m; s.set('minutes', m); showTime(m * 60000); } }, m + ' min')));

  function showTime(ms) {
    const t = Math.ceil(Math.max(0, ms) / 1000);
    timeBox.textContent = `${pad(Math.floor(t / 60))}:${pad(t % 60)}`;
    bar.firstChild.style.width = totalMs && state !== 'idle' ? (100 - ms / totalMs * 100) + '%' : '0%';
  }
  function buttons() {
    startBtn.textContent = state === 'running' ? 'Pause' : state === 'paused' ? 'Resume' : 'Begin';
    stopBtn.classList.toggle('hidden', state === 'idle' || state === 'done');
    minIn.disabled = intSel.disabled = state !== 'idle';
  }

  function toggle() {
    if (state === 'idle' || state === 'done') {
      audio();
      totalMs = leftMs = minutes * 60000; nextBellMs = interval ? totalMs - interval * 60000 : -1;
      state = 'running'; endAt = Date.now() + leftMs; bell(true);
      clearInterval(timer); timer = setInterval(step, 250);
    } else if (state === 'running') {
      leftMs = endAt - Date.now(); state = 'paused';
    } else if (state === 'paused') {
      endAt = Date.now() + leftMs; state = 'running';
    }
    buttons(); step();
  }
  function step() {
    if (state === 'running') {
      leftMs = endAt - Date.now();
      if (interval && nextBellMs > 0 && leftMs <= nextBellMs && leftMs > 1500) { bell(false); nextBellMs -= interval * 60000; }
      if (leftMs <= 0) { finish(true); return; }
    }
    showTime(leftMs);
  }
  function finish(full) {
    clearInterval(timer); timer = null;
    const leftNow = state === 'running' ? endAt - Date.now() : leftMs;
    const spentMs = full ? totalMs : totalMs - Math.max(0, leftNow);
    const mins = Math.round(spentMs / 600) / 100;
    if (full) bell(true);
    state = full ? 'done' : 'idle'; leftMs = 0;
    if (mins >= 0.5) {
      history.unshift({ id: uid(), date: today(), minutes: mins }); history = history.slice(0, 500); s.set('history', history);
      toast(full ? 'Session complete' : `Session saved (${mins} min)`);
    }
    if (full) { timeBox.textContent = '✓'; bar.firstChild.style.width = '100%'; } else showTime(minutes * 60000);
    buttons(); renderHist();
    if (full) setTimeout(() => { if (state === 'done') { state = 'idle'; buttons(); showTime(minutes * 60000); } }, 5000);
  }

  function renderHist() {
    const total = history.reduce((a, b) => a + b.minutes, 0);
    const week = history.filter(h => (Date.now() - new Date(h.date + 'T12:00:00').getTime()) / 864e5 < 7).reduce((a, b) => a + b.minutes, 0);
    const days = new Set(history.map(h => h.date));
    let streak = 0; const d = new Date(); if (!days.has(today())) d.setDate(d.getDate() - 1);
    while (days.has(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`)) { streak++; d.setDate(d.getDate() - 1); }
    render(stats, stat(Math.round(total * 10) / 10, 'total minutes'), stat(history.length, 'sessions'), stat(Math.round(week * 10) / 10, 'minutes, last 7 days'), stat(streak + ' d', 'streak'));
    render(hist, history.length ? el('table', { class: 'table' }, el('thead', {}, el('tr', {}, el('th', {}, 'Date'), el('th', {}, 'Minutes'), el('th', {}))),
      el('tbody', {}, history.slice(0, 15).map(h => el('tr', {}, el('td', {}, h.date), el('td', {}, h.minutes),
        el('td', {}, el('button', { class: 'btn small ghost', onclick: () => { history = history.filter(x => x.id !== h.id); s.set('history', history); renderHist(); } }, '✕')))))) : el('div', { class: 'muted' }, 'No sessions yet.'));
  }

  // breathing visual: slow 4s in / 6s out pulse
  const stopLoop = loop((dt, t) => {
    const c = cvs.getContext('2d'), W = cvs.width, cx = W / 2;
    c.clearRect(0, 0, W, W);
    let k = 0.35, label = '';
    if (visual && state === 'running') {
      const ph = (t / 1000) % 10;
      if (ph < 4) { k = 0.35 + 0.55 * (0.5 - 0.5 * Math.cos(Math.PI * ph / 4)); label = 'breathe in'; }
      else { k = 0.35 + 0.55 * (0.5 + 0.5 * Math.cos(Math.PI * (ph - 4) / 6)); label = 'breathe out'; }
    } else if (state === 'paused') label = 'paused';
    const r = 120 * k + 8;
    c.fillStyle = cv('--accent'); c.globalAlpha = 0.18; c.beginPath(); c.arc(cx, cx, 128, 0, 7); c.fill();
    c.globalAlpha = 0.55; c.beginPath(); c.arc(cx, cx, r, 0, 7); c.fill();
    c.globalAlpha = 1; c.lineWidth = 3; c.strokeStyle = cv('--accent'); c.beginPath(); c.arc(cx, cx, r, 0, 7); c.stroke();
    c.fillStyle = cv('--text'); c.font = '15px system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(label, cx, cx);
  });

  render(root,
    el('div', { class: 'grid2' },
      el('div', { class: 'col' }, el('div', { class: 'canvas-wrap' }, cvs)),
      el('div', { class: 'col' },
        el('div', { class: 'row' }, field('Minutes', minIn), field('Interval bell', intSel)),
        presets,
        el('label', { class: 'inline' }, visCk, 'Show breathing visual (4 s in, 6 s out)'),
        timeBox, bar,
        el('div', { class: 'row' }, startBtn, stopBtn),
        el('div', { class: 'muted small' }, 'A bell sounds at the start and end, plus at each interval. Sound is generated in your browser.'))),
    el('h3', {}, 'Progress'), stats, hist,
    el('p', { class: 'muted small' }, 'Session history stays in this browser only.'));
  showTime(minutes * 60000); buttons(); renderHist();
  return () => { clearInterval(timer); stopLoop(); if (actx) { try { actx.close(); } catch {} } };
}
