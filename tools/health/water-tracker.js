// Water intake tracker: goal, quick-add, progress ring, 7-day chart, optional reminders.
import { el, render, store, toast, today, stat, field, pad } from '../../lib/ui.js';

export default function (root) {
  const s = store('water-tracker');
  const cv = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || '#888';
  let goal = +s.get('goal', 2000) || 2000;
  let log = s.get('log', {});          // 'YYYY-MM-DD' -> [ml, ml, ...]
  let remMin = +s.get('reminder', 0) || 0;
  let timer = null;

  const keyOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const daySum = k => (log[k] || []).reduce((a, b) => a + b, 0);
  const save = () => s.set('log', log);

  const ring = el('canvas', { width: 200, height: 200, style: { maxWidth: '100%' } });
  const chart = el('canvas', { width: 640, height: 220, style: { width: '100%', maxWidth: '640px' } });
  const stats = el('div', { class: 'row' });
  const entries = el('ul', { class: 'list' });
  const goalIn = el('input', { class: 'input', type: 'number', min: 100, step: 50, value: goal, style: { width: '110px' },
    onchange: () => { goal = Math.max(100, +goalIn.value || 2000); s.set('goal', goal); update(); } });
  const customIn = el('input', { class: 'input', type: 'number', min: 1, placeholder: 'ml', style: { width: '90px' },
    onkeydown: e => { if (e.key === 'Enter') addCustom(); } });

  function add(ml) { const k = today(); (log[k] ||= []).push(ml); save(); update(); toast(`+${ml} ml`); }
  function addCustom() { const v = Math.round(+customIn.value); if (v > 0) { add(v); customIn.value = ''; } }
  function undo() { const k = today(); if (log[k] && log[k].length) { log[k].pop(); save(); update(); } }

  function drawRing() {
    const c = ring.getContext('2d'), W = ring.width, cx = W / 2, cy = W / 2, r = 80;
    const total = daySum(today()), p = Math.min(1, total / goal);
    c.clearRect(0, 0, W, W);
    c.lineWidth = 16; c.lineCap = 'round';
    c.strokeStyle = cv('--line'); c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.stroke();
    if (p > 0) { c.strokeStyle = p >= 1 ? cv('--ok') : cv('--accent'); c.beginPath(); c.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2); c.stroke(); }
    c.fillStyle = cv('--text'); c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = 'bold 28px system-ui, sans-serif'; c.fillText(Math.round(p * 100) + '%', cx, cy - 8);
    c.font = '13px system-ui, sans-serif'; c.fillStyle = cv('--muted'); c.fillText(`${total} / ${goal} ml`, cx, cy + 18);
  }

  function drawChart() {
    const c = chart.getContext('2d'), W = chart.width, H = chart.height, padL = 44, padB = 28, padT = 16;
    c.clearRect(0, 0, W, H);
    const days = []; for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); days.push(d); }
    const vals = days.map(d => daySum(keyOf(d)));
    const max = Math.max(goal * 1.2, ...vals, 1);
    const bw = (W - padL - 10) / 7;
    const y = v => H - padB - (v / max) * (H - padB - padT);
    c.strokeStyle = cv('--line'); c.lineWidth = 1;
    c.beginPath(); c.moveTo(padL, y(0)); c.lineTo(W - 10, y(0)); c.stroke();
    c.setLineDash([5, 4]); c.strokeStyle = cv('--warn'); c.beginPath(); c.moveTo(padL, y(goal)); c.lineTo(W - 10, y(goal)); c.stroke(); c.setLineDash([]);
    c.fillStyle = cv('--muted'); c.font = '11px system-ui, sans-serif'; c.textAlign = 'right'; c.textBaseline = 'middle';
    c.fillText(String(goal), padL - 4, y(goal)); c.fillText('0', padL - 4, y(0));
    days.forEach((d, i) => {
      const x = padL + i * bw + bw * 0.2, w = bw * 0.6;
      c.fillStyle = vals[i] >= goal ? cv('--ok') : cv('--accent');
      c.fillRect(x, y(vals[i]), w, y(0) - y(vals[i]));
      c.fillStyle = cv('--text'); c.textAlign = 'center'; c.textBaseline = 'top';
      c.fillText(d.toLocaleDateString(undefined, { weekday: 'short' }), x + w / 2, H - padB + 6);
      if (vals[i]) { c.fillStyle = cv('--muted'); c.textBaseline = 'bottom'; c.fillText(String(vals[i]), x + w / 2, y(vals[i]) - 2); }
    });
  }

  function update() {
    const k = today(), arr = log[k] || [], total = daySum(k);
    let sum7 = 0; for (let i = 0; i < 7; i++) { const d = new Date(); d.setDate(d.getDate() - i); sum7 += daySum(keyOf(d)); }
    const met = Object.keys(log).filter(d => daySum(d) >= goal).length;
    render(stats, stat(total + ' ml', 'today'), stat(Math.max(0, goal - total) + ' ml', 'to go'), stat(Math.round(sum7 / 7) + ' ml', '7-day average'), stat(met, 'days goal met'));
    render(entries, arr.length
      ? arr.map((ml, i) => el('li', {}, el('span', { class: 'grow' }, `${ml} ml`),
        el('button', { class: 'btn small ghost', title: 'Remove', onclick: () => { arr.splice(i, 1); save(); update(); } }, '✕'))).reverse()
      : el('li', { class: 'muted' }, 'Nothing logged today yet.'));
    drawRing(); drawChart();
  }

  // ---- reminders (only while the page is open) ----
  const hasNotif = typeof Notification !== 'undefined';
  const remSel = el('select', { class: 'select', onchange: () => { remMin = +remSel.value; s.set('reminder', remMin); startTimer(); } },
    [0, 15, 30, 45, 60, 90, 120].map(m => el('option', { value: m, selected: m === remMin }, m ? `every ${m} min` : 'off')));
  const remStatus = el('div', { class: 'muted small' });
  function notify() {
    const msg = `Time for a drink — ${daySum(today())} / ${goal} ml so far today.`;
    if (hasNotif && Notification.permission === 'granted') { try { new Notification('Water reminder', { body: msg }); return; } catch {} }
    toast(msg, 4000);
  }
  function startTimer() {
    clearInterval(timer); timer = null;
    if (remMin > 0) timer = setInterval(notify, remMin * 60000);
    remStatus.textContent = remMin
      ? `Reminder every ${remMin} min while this page is open (${hasNotif && Notification.permission === 'granted' ? 'system notification' : 'on-page toast'}).`
      : 'Reminders are off.';
  }
  const permBtn = el('button', { class: 'btn small', onclick: async () => {
    if (!hasNotif) { toast('Notifications are not supported in this browser'); return; }
    const p = await Notification.requestPermission();
    toast(p === 'granted' ? 'Notifications enabled' : 'Permission not granted — on-page toasts will be used');
    startTimer();
  } }, 'Enable notifications');

  render(root,
    el('div', { class: 'grid2' },
      el('div', { class: 'col' },
        el('div', { class: 'canvas-wrap' }, ring),
        el('div', { class: 'row', style: { justifyContent: 'center' } },
          el('button', { class: 'btn primary', onclick: () => add(250) }, '🥛 Glass 250 ml'),
          el('button', { class: 'btn primary', onclick: () => add(500) }, '🍶 Bottle 500 ml'),
          customIn, el('button', { class: 'btn', onclick: addCustom }, 'Add'),
          el('button', { class: 'btn ghost', onclick: undo }, 'Undo'))),
      el('div', { class: 'col' },
        el('div', { class: 'row' }, field('Daily goal (ml)', goalIn), field('Reminder', remSel), permBtn),
        remStatus, stats)),
    el('h3', {}, 'Last 7 days'), el('div', { class: 'canvas-wrap' }, chart),
    el('h3', {}, 'Today'), entries,
    el('p', { class: 'muted small' }, 'All data stays in this browser (localStorage). Nothing is sent anywhere.'));
  update(); startTimer();
  return () => clearInterval(timer);
}
