import { el, render, store, pad } from '../../lib/ui.js';
import { confetti } from './_fx.js';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function (root) {
  const s = store('weekend-countdown');
  const cfg = { day: s.get('day', 5), time: s.get('time', '17:00'), start: s.get('start', '09:00') };
  root.style.position = 'relative';
  root.style.overflow = 'hidden';

  const big = el('div', { style: { fontSize: 'clamp(34px,10vw,96px)', fontWeight: 800, fontVariantNumeric: 'tabular-nums', textAlign: 'center', lineHeight: 1.1, margin: '16px 0 4px' } });
  const sub = el('div', { class: 'muted center' });
  const fill = el('div', { style: { width: '0%', transition: 'width .5s' } });
  const pct = el('div', { class: 'small muted center' });
  const bar = el('div', { class: 'bar', style: { height: '18px', margin: '18px 0 6px' } }, fill);
  const days = el('div', { class: 'row', style: { justifyContent: 'center', gap: '6px' } });

  const daySel = el('select', { class: 'select', onchange: save }, DAYS.map((d, i) => el('option', { value: i, selected: i === cfg.day }, d)));
  const timeIn = el('input', { class: 'input', type: 'time', value: cfg.time, onchange: save });
  const startIn = el('input', { class: 'input', type: 'time', value: cfg.start, onchange: save });
  function save() {
    cfg.day = +daySel.value; cfg.time = timeIn.value || '17:00'; cfg.start = startIn.value || '09:00';
    Object.entries(cfg).forEach(([k, v]) => s.set(k, v));
    tick(true);
  }

  const canvas = el('canvas', { style: { position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' } });
  render(root,
    big, sub, bar, pct, days,
    el('div', { class: 'row', style: { justifyContent: 'center', marginTop: '18px' } },
      el('label', { class: 'field' }, 'Week ends on', daySel),
      el('label', { class: 'field' }, 'At', timeIn),
      el('label', { class: 'field' }, 'Week starts Monday at', startIn)),
    canvas);

  const fx = confetti(canvas);
  let wasWeekend = null, bt = null;

  function hm(str) { const [h, m] = str.split(':').map(Number); return [h || 0, m || 0]; }
  function tick(force) {
    const now = new Date();
    if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) { canvas.width = canvas.clientWidth; canvas.height = canvas.clientHeight; }
    const [eh, em] = hm(cfg.time), [sh, sm] = hm(cfg.start);
    // Monday of this week at start time; the week's end is the chosen day at the end time.
    const monday = new Date(now); monday.setHours(sh, sm, 0, 0);
    monday.setDate(monday.getDate() - ((now.getDay() + 6) % 7));
    const endOffset = (cfg.day + 6) % 7; // days after Monday
    const end = new Date(monday); end.setDate(end.getDate() + endOffset); end.setHours(eh, em, 0, 0);
    const nextStart = new Date(monday); nextStart.setDate(nextStart.getDate() + 7);
    // Before Monday start time (early Monday morning) we are still in the weekend of the previous week.
    const beforeStart = now < monday;
    const weekend = beforeStart || now >= end;
    let ms, prog;
    if (beforeStart) { ms = monday - now; prog = 1; }
    else if (!weekend) { ms = end - now; prog = (now - monday) / Math.max(1, end - monday); }
    else { ms = nextStart - now; prog = 1; }
    prog = Math.max(0, Math.min(1, prog));
    const t = Math.max(0, Math.floor(ms / 1000));
    const d = Math.floor(t / 86400), h = Math.floor(t % 86400 / 3600), m = Math.floor(t % 3600 / 60), sec = t % 60;
    big.textContent = (d ? d + 'd ' : '') + `${pad(h)}:${pad(m)}:${pad(sec)}`;
    sub.textContent = weekend ? `Weekend mode! Time until Monday ${cfg.start}.` : `until ${DAYS[cfg.day]} ${cfg.time}`;
    fill.style.width = (prog * 100).toFixed(2) + '%';
    fill.style.background = weekend ? 'var(--ok)' : 'var(--accent)';
    pct.textContent = weekend ? '100% of the work week survived' : (prog * 100).toFixed(1) + '% of the work week done';
    const idx = (now.getDay() + 6) % 7;
    render(days, ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((n, i) =>
      el('span', { class: 'badge ' + (i === idx ? 'ok' : ''), style: { opacity: i < idx ? 0.5 : 1 } }, n)));
    if (weekend !== wasWeekend || force === true) {
      if (weekend) { fx.rain(true); clearTimeout(bt); bt = setTimeout(() => fx.burst(120), 300); } else fx.rain(false);
      wasWeekend = weekend;
    }
  }
  tick(true);
  const iv = setInterval(tick, 250);
  const onClick = e => { if (wasWeekend) { const r = canvas.getBoundingClientRect(); fx.burst(60, e.clientX - r.left, e.clientY - r.top); } };
  root.addEventListener('click', onClick);
  return () => { clearInterval(iv); clearTimeout(bt); fx.stop(); root.removeEventListener('click', onClick); };
}
