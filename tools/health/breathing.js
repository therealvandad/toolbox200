// Breathing exercise: box, 4-7-8 and coherent breathing with an animated circle on canvas.
import { el, render, store, toast, stat, loop } from '../../lib/ui.js';

const PATTERNS = {
  box: { name: 'Box breathing (4-4-4-4)', steps: [['Inhale', 4, 1], ['Hold', 4, 1], ['Exhale', 4, 0], ['Hold', 4, 0]] },
  '478': { name: '4-7-8 breathing', steps: [['Inhale', 4, 1], ['Hold', 7, 1], ['Exhale', 8, 0]] },
  coherent: { name: 'Coherent breathing (5.5 / 5.5)', steps: [['Inhale', 5.5, 1], ['Exhale', 5.5, 0]] },
};

export default function (root) {
  const s = store('breathing');
  const cv = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || '#888';
  let key = s.get('pattern', 'box'); if (!PATTERNS[key]) key = 'box';
  let vib = !!s.get('vibrate', true);
  let stats = s.get('stats', { cycles: 0, sessions: 0, seconds: 0 });
  let running = false, t0 = 0, lastStep = -1, lastCycle = 0, cycles = 0, sessionStart = 0;
  const canVibrate = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

  const cvs = el('canvas', { width: 340, height: 340, style: { width: '100%', maxWidth: '340px' } });
  const sel = el('select', { class: 'select', onchange: () => { key = sel.value; s.set('pattern', key); if (running) stop(); drawIdle(); } },
    Object.entries(PATTERNS).map(([k, p]) => el('option', { value: k, selected: k === key }, p.name)));
  const startBtn = el('button', { class: 'btn primary', onclick: () => (running ? stop() : start()) }, 'Start');
  const vibCk = el('input', { type: 'checkbox', checked: vib, disabled: !canVibrate, onchange: () => { vib = vibCk.checked; s.set('vibrate', vib); } });
  const info = el('div', { class: 'row' });

  function buzz(ms) { if (vib && canVibrate) { try { navigator.vibrate(ms); } catch {} } }

  function start() {
    running = true; t0 = performance.now(); lastStep = -1; lastCycle = 0; cycles = 0; sessionStart = Date.now();
    startBtn.textContent = 'Stop'; renderInfo();
  }
  function stop() {
    if (!running) return;
    running = false; startBtn.textContent = 'Start';
    const secs = Math.round((Date.now() - sessionStart) / 1000);
    if (cycles > 0) {
      stats = { cycles: stats.cycles + cycles, sessions: stats.sessions + 1, seconds: stats.seconds + secs };
      s.set('stats', stats); toast(`${cycles} cycle${cycles === 1 ? '' : 's'} completed`);
    }
    try { navigator.vibrate && navigator.vibrate(0); } catch {}
    renderInfo();
  }
  function renderInfo() {
    render(info, stat(running ? cycles : 0, 'cycles this session'), stat(stats.cycles, 'cycles all time'), stat(Math.round(stats.seconds / 60), 'minutes all time'), stat(stats.sessions, 'sessions'));
  }

  function paint(label, count, k) {
    const c = cvs.getContext('2d'), W = cvs.width, cx = W / 2;
    c.clearRect(0, 0, W, W);
    const rMin = 55, rMax = 140, r = rMin + (rMax - rMin) * k;
    c.fillStyle = cv('--accent'); c.globalAlpha = 0.12; c.beginPath(); c.arc(cx, cx, rMax + 8, 0, 7); c.fill();
    c.globalAlpha = 0.5; c.beginPath(); c.arc(cx, cx, r, 0, 7); c.fill();
    c.globalAlpha = 1; c.lineWidth = 4; c.strokeStyle = cv('--accent'); c.beginPath(); c.arc(cx, cx, r, 0, 7); c.stroke();
    c.fillStyle = cv('--text'); c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = 'bold 26px system-ui, sans-serif'; c.fillText(label, cx, cx - 10);
    c.font = '20px ui-monospace, Consolas, monospace'; c.fillStyle = cv('--muted'); c.fillText(count, cx, cx + 22);
  }
  function drawIdle() { paint('Ready', PATTERNS[key].steps.map(x => x[1]).join(' · '), 0); }

  const ease = x => 0.5 - 0.5 * Math.cos(Math.PI * x);
  const stopLoop = loop(() => {
    if (!running) return;
    const steps = PATTERNS[key].steps, total = steps.reduce((a, b) => a + b[1], 0);
    const el_ = (performance.now() - t0) / 1000, cyc = Math.floor(el_ / total);
    let pos = el_ - cyc * total, i = 0;
    while (i < steps.length - 1 && pos >= steps[i][1]) { pos -= steps[i][1]; i++; }
    if (cyc !== lastCycle) { cycles = cyc; lastCycle = cyc; renderInfo(); }
    if (i !== lastStep) { lastStep = i; buzz(i === 0 ? 120 : 50); }
    const [name, dur, to] = steps[i], f = Math.min(1, pos / dur);
    let k;
    if (name === 'Hold') k = to ? 1 : 0;
    else k = to ? ease(f) : 1 - ease(f);
    paint(name, String(Math.max(1, Math.ceil(dur - pos - 1e-6))), k);
  });

  render(root,
    el('div', { class: 'grid2' },
      el('div', { class: 'col' }, el('div', { class: 'canvas-wrap' }, cvs)),
      el('div', { class: 'col' },
        el('label', { class: 'field' }, 'Pattern', sel),
        el('div', { class: 'row' }, startBtn),
        el('label', { class: 'inline' }, vibCk, canVibrate ? 'Vibrate on each phase change' : 'Vibration not available on this device'),
        info,
        el('div', { class: 'muted small' }, 'Breathe through your nose if comfortable. Stop if you feel dizzy. Not a substitute for medical advice.'))),
    el('p', { class: 'muted small' }, 'Your totals are stored in this browser only.'));
  drawIdle(); renderInfo();
  return () => { running = false; stopLoop(); try { navigator.vibrate && navigator.vibrate(0); } catch {} };
}
