// Intermittent fasting clock: protocols, live countdown ring, phase info, history.
import { el, render, store, uid, toast, stat, field, pad } from '../../lib/ui.js';

const PROTOCOLS = [
  { id: '16:8', label: '16:8', hours: 16 },
  { id: '18:6', label: '18:6', hours: 18 },
  { id: '20:4', label: '20:4', hours: 20 },
  { id: 'omad', label: 'OMAD (23:1)', hours: 23 },
  { id: 'custom', label: 'Custom', hours: 14 },
];
const PHASES = [
  [0, 'Fed state', 'Your body is digesting and absorbing the last meal. Insulin is elevated.'],
  [4, 'Early fasting', 'Digestion winds down and blood sugar and insulin start to fall.'],
  [8, 'Glycogen drawdown', 'Stored glycogen is being used. Hunger often comes in waves and passes.'],
  [12, 'Fat burning ramps up', 'More energy comes from fat. Ketone production begins to rise.'],
  [16, 'Deeper fasting', 'Ketones climb further. Cellular clean-up processes are thought to increase.'],
  [24, 'Extended fast', 'Beyond a day. Fasts this long should be discussed with a clinician.'],
];

export default function (root) {
  const s = store('fasting-clock');
  const cv = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || '#888';
  let proto = s.get('proto', '16:8');
  let customH = +s.get('customH', 14) || 14;
  let current = s.get('current', null);       // {start: ms, hours, proto}
  let history = s.get('history', []);         // {id, start, end, goal, proto}
  let notified = !!(current && current.notified);
  let timer = null;

  const hoursOf = () => proto === 'custom' ? customH : (PROTOCOLS.find(p => p.id === proto) || PROTOCOLS[0]).hours;
  const fmtDur = ms => { const t = Math.max(0, Math.floor(ms / 1000)); return `${pad(Math.floor(t / 3600))}:${pad(Math.floor(t % 3600 / 60))}:${pad(t % 60)}`; };
  const fmtH = h => `${Math.floor(h)}h ${pad(Math.round((h % 1) * 60))}m`;
  const toLocalInput = ms => { const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };

  const ring = el('canvas', { width: 260, height: 260, style: { maxWidth: '100%' } });
  const phaseBox = el('div', { class: 'panel' });
  const stats = el('div', { class: 'row' });
  const hist = el('div', { class: 'scroll-x' });
  const startIn = el('input', { class: 'input', type: 'datetime-local', value: toLocalInput(Date.now()) });
  const customIn = el('input', { class: 'input', type: 'number', min: 1, max: 72, step: 0.5, value: customH, style: { width: '90px' }, onchange: () => { customH = Math.min(72, Math.max(1, +customIn.value || 14)); s.set('customH', customH); tick(); } });
  const protoSel = el('select', { class: 'select', onchange: () => { proto = protoSel.value; s.set('proto', proto); customWrap.classList.toggle('hidden', proto !== 'custom'); tick(); } },
    PROTOCOLS.map(p => el('option', { value: p.id, selected: p.id === proto }, p.label)));
  const customWrap = el('span', { class: proto === 'custom' ? '' : 'hidden' }, field('Custom hours', customIn));
  const startBtn = el('button', { class: 'btn primary', onclick: () => startFast() }, 'Start fast');
  const endBtn = el('button', { class: 'btn danger', onclick: () => endFast() }, 'End fast');
  const ctl = el('div', { class: 'row' });

  function startFast() {
    const t = startIn.value ? new Date(startIn.value).getTime() : Date.now();
    const start = isNaN(t) || t > Date.now() ? Date.now() : t;
    current = { start, hours: hoursOf(), proto, notified: false }; notified = false;
    s.set('current', current); tick(); toast('Fast started');
  }
  function endFast() {
    if (!current) return;
    history.unshift({ id: uid(), start: current.start, end: Date.now(), goal: current.hours, proto: current.proto });
    history = history.slice(0, 200); s.set('history', history);
    current = null; s.del('current'); startIn.value = toLocalInput(Date.now()); tick(); toast('Fast saved to history');
  }

  function phaseFor(h) { let p = PHASES[0]; for (const x of PHASES) if (h >= x[0]) p = x; return p; }

  function drawRing(p, text, sub, done) {
    const c = ring.getContext('2d'), W = ring.width, cx = W / 2, r = 100;
    c.clearRect(0, 0, W, W);
    c.lineWidth = 18; c.lineCap = 'round';
    c.strokeStyle = cv('--line'); c.beginPath(); c.arc(cx, cx, r, 0, Math.PI * 2); c.stroke();
    if (p > 0) { c.strokeStyle = done ? cv('--ok') : cv('--accent'); c.beginPath(); c.arc(cx, cx, r, -Math.PI / 2, -Math.PI / 2 + Math.min(1, p) * Math.PI * 2); c.stroke(); }
    c.fillStyle = cv('--text'); c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = 'bold 34px ui-monospace, Consolas, monospace'; c.fillText(text, cx, cx - 8);
    c.font = '13px system-ui, sans-serif'; c.fillStyle = cv('--muted'); c.fillText(sub, cx, cx + 24);
  }

  function tick(full = true) {
    const goalH = current ? current.hours : hoursOf();
    if (current) {
      const el_ = Date.now() - current.start, goalMs = goalH * 3600000, h = el_ / 3600000;
      const left = goalMs - el_, done = left <= 0;
      drawRing(el_ / goalMs, done ? '+' + fmtDur(-left) : fmtDur(left), done ? 'goal reached' : `of ${goalH}h fast, remaining`, done);
      const ph = phaseFor(h);
      render(phaseBox, el('div', {}, el('b', {}, ph[1]), el('span', { class: 'muted small' }, `  at ${fmtH(h)} fasted`)), el('div', { class: 'small muted' }, ph[2]),
        el('div', { class: 'small' }, `Started ${new Date(current.start).toLocaleString()} · goal ends ${new Date(current.start + goalMs).toLocaleString()}`));
      render(stats, stat(fmtH(h), 'fasted so far'), stat(Math.min(100, Math.round(el_ / goalMs * 100)) + '%', 'of goal'), stat(done ? 'done' : fmtH(left / 3600000), 'to go'));
      if (done && !notified) {
        notified = true; current.notified = true; s.set('current', current);
        const msg = `Fasting goal of ${goalH}h reached.`;
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') { try { new Notification('Fasting clock', { body: msg }); } catch {} }
        toast(msg, 4000);
      }
      if (full) render(ctl, endBtn);
    } else {
      drawRing(0, `${goalH}h`, 'ready to start', false);
      const eat = 24 - goalH;
      render(phaseBox, el('div', {}, el('b', {}, 'Not fasting')), el('div', { class: 'small muted' }, `${proto === 'custom' ? 'Custom' : (PROTOCOLS.find(p => p.id === proto) || {}).label}: fast ${goalH} h, eat within ${eat > 0 ? eat : 0} h. Pick a start time below if you began earlier.`));
      render(stats, stat(history.length, 'fasts logged'), stat(history.length ? fmtH(history.reduce((a, b) => a + (b.end - b.start), 0) / history.length / 3600000) : '–', 'average length'),
        stat(history.filter(h => h.end - h.start >= h.goal * 3600000).length, 'goals reached'));
      if (full) render(ctl, field('Fast started at', startIn), startBtn,
        typeof Notification !== 'undefined' && Notification.permission === 'default' && el('button', { class: 'btn small ghost', onclick: async () => { await Notification.requestPermission(); toast('Notification choice saved'); } }, 'Allow goal notification'));
    }
    if (full) renderHist();
  }

  function renderHist() {
    render(hist, history.length ? el('table', { class: 'table' },
      el('thead', {}, el('tr', {}, ['Started', 'Length', 'Goal', 'Result', ''].map(h => el('th', {}, h)))),
      el('tbody', {}, history.slice(0, 30).map(h => {
        const dur = (h.end - h.start) / 3600000, ok = dur >= h.goal;
        return el('tr', {}, el('td', {}, new Date(h.start).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })), el('td', {}, fmtH(dur)), el('td', {}, h.goal + 'h ' + (h.proto === 'custom' ? '' : h.proto)),
          el('td', {}, el('span', { class: 'badge ' + (ok ? 'ok' : 'warn') }, ok ? 'goal met' : 'ended early')),
          el('td', {}, el('button', { class: 'btn small ghost', onclick: () => { history = history.filter(x => x.id !== h.id); s.set('history', history); tick(); } }, '✕')));
      }))) : el('div', { class: 'muted' }, 'No completed fasts yet.'));
  }

  render(root,
    el('div', { class: 'grid2' },
      el('div', { class: 'col' }, el('div', { class: 'canvas-wrap' }, ring)),
      el('div', { class: 'col' },
        el('div', { class: 'row' }, field('Protocol', protoSel), customWrap),
        ctl, stats, phaseBox)),
    el('h3', {}, 'History'), hist,
    el('p', { class: 'muted small' }, 'General information only, not medical advice. Do not fast if you are pregnant, under 18, underweight, diabetic or have a history of eating disorders without medical guidance. Data stays in this browser.'));
  tick();
  timer = setInterval(() => { if (current) tick(false); }, 1000);
  return () => clearInterval(timer);
}
