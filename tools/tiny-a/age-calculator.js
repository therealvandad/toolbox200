import { el, render, store, stat, today, pad } from '../../lib/ui.js';

const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const dim = (y, m) => new Date(y, m + 1, 0).getDate();
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

function parse(v) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || '');
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  d.setFullYear(+m[1]);
  return isNaN(d) ? null : d;
}
// Calendar age between birth and now (local)
function age(b, n) {
  let y = n.getFullYear() - b.getFullYear();
  let m = n.getMonth() - b.getMonth();
  let d = n.getDate() - b.getDate();
  if (d < 0) { m--; const pm = (n.getMonth() + 11) % 12; const py = n.getMonth() === 0 ? n.getFullYear() - 1 : n.getFullYear(); d += dim(py, pm); }
  if (m < 0) { y--; m += 12; }
  return { y, m, d };
}
function nextBirthday(b, n) {
  const make = yr => {
    // Feb 29 birthdays fall on Mar 1 in non-leap years
    let m = b.getMonth(), d = b.getDate();
    if (m === 1 && d === 29 && dim(yr, 1) < 29) { m = 2; d = 1; }
    return new Date(yr, m, d);
  };
  let t = make(n.getFullYear());
  const startOfToday = new Date(n.getFullYear(), n.getMonth(), n.getDate());
  if (t < startOfToday) t = make(n.getFullYear() + 1);
  return t;
}

export default function (root) {
  const s = store('age-calculator');
  const input = el('input', { class: 'input', type: 'date', max: today(), value: s.get('birth', '') });
  const out = el('div', { class: 'col' });
  let liveEls = null;

  function fmtCountdown(ms) {
    const sec = Math.max(0, Math.floor(ms / 1000));
    const d = Math.floor(sec / 86400), h = Math.floor(sec % 86400 / 3600), mi = Math.floor(sec % 3600 / 60), se = sec % 60;
    return `${d}d ${pad(h)}h ${pad(mi)}m ${pad(se)}s`;
  }
  function tick() {
    if (!liveEls) return;
    const now = new Date();
    const b = liveEls.birth;
    const ms = now - b;
    liveEls.secs.textContent = Math.floor(ms / 1000).toLocaleString();
    liveEls.hours.textContent = Math.floor(ms / 3600000).toLocaleString();
    liveEls.mins.textContent = Math.floor(ms / 60000).toLocaleString();
    liveEls.count.textContent = fmtCountdown(liveEls.next - now);
  }
  function update() {
    s.set('birth', input.value);
    liveEls = null;
    const b = parse(input.value);
    if (!b) { render(out, el('div', { class: 'muted' }, 'Pick your date of birth.')); return; }
    const now = new Date();
    if (b > now) { render(out, el('div', { class: 'badge warn' }, 'That date is in the future.')); return; }
    const a = age(b, now);
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const totalDays = Math.round((startToday - b) / 86400000);
    const next = nextBirthday(b, now);
    const daysLeft = Math.round((next - startToday) / 86400000);
    const turning = next.getFullYear() - b.getFullYear();
    const secs = el('span'), hours = el('span'), mins = el('span'), count = el('span', { class: 'mono' });
    liveEls = { birth: b, next, secs, hours, mins, count };
    render(out,
      el('div', { class: 'panel' },
        el('div', { class: 'big' }, plural(a.y, 'year')),
        el('div', {}, `${plural(a.y, 'year')}, ${plural(a.m, 'month')}, ${plural(a.d, 'day')} old`),
        daysLeft === 0 ? el('div', { class: 'badge ok', style: { marginTop: '6px' } }, 'Happy birthday today!') : null),
      el('div', { class: 'row' },
        stat(totalDays.toLocaleString(), 'total days'),
        stat(Math.floor(totalDays / 7).toLocaleString(), 'total weeks'),
        stat(a.y * 12 + a.m, 'total months'),
        el('div', { class: 'stat' }, el('div', { class: 'v' }, hours), el('div', { class: 'l' }, 'hours')),
        el('div', { class: 'stat' }, el('div', { class: 'v' }, mins), el('div', { class: 'l' }, 'minutes')),
        el('div', { class: 'stat' }, el('div', { class: 'v' }, secs), el('div', { class: 'l' }, 'seconds (live)'))),
      el('div', { class: 'grid2' },
        el('div', { class: 'panel' },
          el('strong', {}, 'Next birthday'),
          el('div', {}, `${DOW[next.getDay()]}, ${next.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}`),
          el('div', { class: 'small muted' }, `Turning ${turning} in ${plural(daysLeft, 'day')}`),
          el('div', { style: { marginTop: '6px' } }, count)),
        el('div', { class: 'panel' },
          el('strong', {}, 'Born on a'),
          el('div', { class: 'big', style: { fontSize: '26px' } }, DOW[b.getDay()]),
          el('div', { class: 'small muted' }, b.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })))),
      el('div', { class: 'small muted' }, 'Time-based counts assume you were born at midnight local time.'));
    tick();
  }
  input.addEventListener('input', update);
  const timer = setInterval(tick, 1000);
  render(root,
    el('div', { class: 'row' }, el('label', { class: 'field' }, 'Date of birth', input),
      el('button', { class: 'btn ghost', style: { alignSelf: 'flex-end' }, onclick: () => { input.value = ''; update(); } }, 'Clear')),
    out);
  update();
  return () => clearInterval(timer);
}
