// Sleep log: bedtime/wake entries, duration, quality, 30-day consistency chart, averages.
import { el, render, store, uid, today, stat, field, pad } from '../../lib/ui.js';

export default function (root) {
  const s = store('sleep-log');
  const cv = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || '#888';
  let entries = s.get('entries', []);   // {id, date (wake-up date), bed 'HH:MM', wake 'HH:MM', quality 1-5}
  const QUAL = ['awful', 'poor', 'ok', 'good', 'great'];

  const toMin = t => { const [h, m] = String(t).split(':').map(Number); return (h || 0) * 60 + (m || 0); };
  const duration = e => { let d = toMin(e.wake) - toMin(e.bed); if (d <= 0) d += 1440; return d; };
  const fmtH = m => `${Math.floor(m / 60)}h ${pad(Math.round(m % 60))}m`;
  const rel = t => (toMin(t) - 18 * 60 + 1440) % 1440;           // minutes after 18:00
  const relToClock = r => { const m = ((Math.round(r) + 18 * 60) % 1440 + 1440) % 1440; return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`; };
  const keyOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  const dateIn = el('input', { class: 'input', type: 'date', value: today() });
  const bedIn = el('input', { class: 'input', type: 'time', value: '23:00' });
  const wakeIn = el('input', { class: 'input', type: 'time', value: '07:00' });
  const qualIn = el('select', { class: 'select' }, [1, 2, 3, 4, 5].map(q => el('option', { value: q, selected: q === 4 }, `${q} – ${QUAL[q - 1]}`)));
  const preview = el('span', { class: 'muted small' });
  const onKey = e => { if (e.key === 'Enter') addEntry(); };
  [dateIn, bedIn, wakeIn].forEach(i => i.addEventListener('keydown', onKey));
  [bedIn, wakeIn].forEach(i => i.addEventListener('input', () => { preview.textContent = bedIn.value && wakeIn.value ? 'Duration ' + fmtH(duration({ bed: bedIn.value, wake: wakeIn.value })) : ''; }));

  function addEntry() {
    if (!dateIn.value || !bedIn.value || !wakeIn.value) return;
    entries = entries.filter(e => e.date !== dateIn.value);
    entries.push({ id: uid(), date: dateIn.value, bed: bedIn.value, wake: wakeIn.value, quality: +qualIn.value });
    entries.sort((a, b) => (a.date < b.date ? -1 : 1));
    s.set('entries', entries); update();
  }

  const chart = el('canvas', { width: 680, height: 260, style: { width: '100%', maxWidth: '680px' } });
  const stats = el('div', { class: 'row' });
  const tbody = el('tbody');

  function drawChart() {
    const c = chart.getContext('2d'), W = chart.width, H = chart.height, L = 46, R = 12, T = 16, B = 30;
    c.clearRect(0, 0, W, H);
    const days = []; for (let i = 29; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); days.push(keyOf(d)); }
    const byDate = Object.fromEntries(entries.map(e => [e.date, e]));
    const yMax = 18 * 60; // 18:00 .. 12:00 next day
    const y = r => T + (r / yMax) * (H - T - B);
    const x = i => L + (i + 0.5) * ((W - L - R) / 30);
    c.font = '11px system-ui, sans-serif'; c.textBaseline = 'middle'; c.textAlign = 'right';
    for (let h = 0; h <= 18; h += 3) {
      c.strokeStyle = cv('--line'); c.beginPath(); c.moveTo(L, y(h * 60)); c.lineTo(W - R, y(h * 60)); c.stroke();
      c.fillStyle = cv('--muted'); c.fillText(relToClock(h * 60), L - 5, y(h * 60));
    }
    c.textAlign = 'center'; c.textBaseline = 'top';
    days.forEach((k, i) => { if (i % 5 === 0) c.fillText(k.slice(5), x(i), H - B + 6); });
    // sleep bands
    days.forEach((k, i) => {
      const e = byDate[k]; if (!e) return;
      const b = rel(e.bed), w = b + duration(e);
      const q = e.quality;
      c.fillStyle = q >= 4 ? cv('--ok') : q === 3 ? cv('--accent') : cv('--warn');
      c.globalAlpha = 0.35; c.fillRect(x(i) - 7, y(b), 14, y(Math.min(w, yMax)) - y(b)); c.globalAlpha = 1;
    });
    // bedtime line
    const pts = days.map((k, i) => (byDate[k] ? [x(i), y(rel(byDate[k].bed))] : null));
    c.strokeStyle = cv('--accent'); c.lineWidth = 2; c.beginPath(); let started = false;
    pts.forEach(p => { if (!p) { started = false; return; } if (!started) { c.moveTo(p[0], p[1]); started = true; } else c.lineTo(p[0], p[1]); });
    c.stroke();
    pts.forEach(p => { if (!p) return; c.fillStyle = cv('--accent'); c.beginPath(); c.arc(p[0], p[1], 3.5, 0, Math.PI * 2); c.fill(); });
    // wake dots
    days.forEach((k, i) => { const e = byDate[k]; if (!e) return; c.fillStyle = cv('--ok'); c.beginPath(); c.arc(x(i), y(Math.min(rel(e.bed) + duration(e), yMax)), 3, 0, Math.PI * 2); c.fill(); });
    // average bedtime
    const recent = days.map(k => byDate[k]).filter(Boolean);
    if (recent.length) {
      const avg = recent.reduce((a, e) => a + rel(e.bed), 0) / recent.length;
      c.setLineDash([5, 4]); c.strokeStyle = cv('--muted'); c.lineWidth = 1; c.beginPath(); c.moveTo(L, y(avg)); c.lineTo(W - R, y(avg)); c.stroke(); c.setLineDash([]);
      c.fillStyle = cv('--muted'); c.textAlign = 'left'; c.textBaseline = 'bottom'; c.fillText('avg bedtime ' + relToClock(avg), L + 4, y(avg) - 2);
    }
    c.lineWidth = 1;
  }

  function update() {
    const n = entries.length;
    if (n) {
      const durs = entries.map(duration), beds = entries.map(e => rel(e.bed)), wakes = entries.map(e => rel(e.bed) + duration(e));
      const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
      const avgBed = mean(beds), sd = Math.sqrt(mean(beds.map(b => (b - avgBed) ** 2)));
      render(stats, stat(fmtH(mean(durs)), 'avg sleep'), stat(relToClock(avgBed), 'avg bedtime'), stat(relToClock(mean(wakes)), 'avg wake'),
        stat('±' + Math.round(sd) + ' min', 'bedtime consistency'), stat(mean(entries.map(e => e.quality)).toFixed(1) + ' / 5', 'avg quality'), stat(n, 'nights'));
    } else render(stats, el('span', { class: 'muted' }, 'Add your first night below.'));
    render(tbody, [...entries].reverse().slice(0, 60).map(e => el('tr', {},
      el('td', {}, e.date), el('td', {}, e.bed), el('td', {}, e.wake), el('td', {}, fmtH(duration(e))),
      el('td', {}, el('span', { class: 'badge ' + (e.quality >= 4 ? 'ok' : e.quality <= 2 ? 'warn' : '') }, QUAL[e.quality - 1])),
      el('td', {}, el('button', { class: 'btn small ghost', onclick: () => { entries = entries.filter(x => x.id !== e.id); s.set('entries', entries); update(); } }, '✕')))));
    drawChart();
  }

  render(root,
    el('div', { class: 'row' },
      field('Wake-up date', dateIn), field('Went to bed', bedIn), field('Woke up', wakeIn), field('Quality', qualIn),
      el('button', { class: 'btn primary', onclick: addEntry }, 'Save night'), preview),
    stats,
    el('h3', {}, 'Last 30 days'),
    el('div', { class: 'canvas-wrap' }, chart),
    el('div', { class: 'muted small' }, 'Band = asleep (green: good night, blue: ok, orange: poor). Line = bedtime. The dashed line is your average bedtime; a flatter line means a more consistent schedule.'),
    el('div', { class: 'scroll-x' }, el('table', { class: 'table' },
      el('thead', {}, el('tr', {}, el('th', {}, 'Date'), el('th', {}, 'Bed'), el('th', {}, 'Wake'), el('th', {}, 'Slept'), el('th', {}, 'Quality'), el('th', {}))), tbody)),
    el('p', { class: 'muted small' }, 'Entries are stored only in this browser.'));
  update();
}
