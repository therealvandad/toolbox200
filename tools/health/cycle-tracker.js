// Period & cycle tracker: log period start/end, predict next period and fertile window from the average cycle,
// calendar view and a private note. Everything stays on this device.
import { el, render, store, uid, today, toast, stat, field, pad } from '../../lib/ui.js';

const DAY = 864e5;

export default function (root) {
  const s = store('cycle-tracker');
  let periods = s.get('periods', []);      // {id, start 'YYYY-MM-DD', end 'YYYY-MM-DD' | null}
  let note = s.get('note', '');
  const now = new Date();
  let year = now.getFullYear(), month = now.getMonth();

  const save = () => s.set('periods', periods);
  const toD = k => new Date(k + 'T12:00:00');
  const toK = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const addDays = (k, n) => { const d = toD(k); d.setDate(d.getDate() + n); return toK(d); };
  const diffDays = (a, b) => Math.round((toD(b) - toD(a)) / DAY);
  const sorted = () => periods.slice().sort((a, b) => (a.start < b.start ? -1 : 1));

  const startIn = el('input', { class: 'input', type: 'date', value: today() });
  const endIn = el('input', { class: 'input', type: 'date' });
  const manualCycle = el('input', { class: 'input', type: 'number', min: 20, max: 45, placeholder: 'auto', style: { width: '90px' }, value: s.get('manualCycle', '') || '',
    onchange: () => { const v = Math.round(+manualCycle.value); if (manualCycle.value === '' || !(v >= 20 && v <= 45)) { manualCycle.value = ''; s.del('manualCycle'); } else s.set('manualCycle', v); update(); } });
  const stats = el('div', { class: 'row' });
  const monthTitle = el('b', { style: { minWidth: '150px', textAlign: 'center' } });
  const cal = el('div', { class: 'cal' });
  const listBox = el('div', { class: 'scroll-x' });
  const noteIn = el('textarea', { class: 'textarea prose', style: { minHeight: '80px' }, placeholder: 'Private notes (symptoms, mood, flow…) – saved only on this device', value: note,
    oninput: () => { s.set('note', noteIn.value); } });

  function logStart() {
    if (!startIn.value) return;
    if (periods.some(p => p.start === startIn.value)) { toast('That start date is already logged'); return; }
    periods.push({ id: uid(), start: startIn.value, end: endIn.value && endIn.value >= startIn.value ? endIn.value : null });
    endIn.value = ''; save(); update(); toast('Period logged');
  }
  function logEnd() {
    if (!endIn.value) { toast('Pick an end date'); return; }
    const open = sorted().filter(p => p.start <= endIn.value).pop();
    if (!open) { toast('No period start on or before that date'); return; }
    open.end = endIn.value; endIn.value = ''; save(); update(); toast('Period end saved');
  }

  function analyse() {
    const ps = sorted();
    const cycles = []; for (let i = 1; i < ps.length; i++) { const d = diffDays(ps[i - 1].start, ps[i].start); if (d >= 15 && d <= 60) cycles.push(d); }
    const lens = ps.filter(p => p.end).map(p => diffDays(p.start, p.end) + 1).filter(n => n >= 1 && n <= 14);
    const manual = +s.get('manualCycle', 0) || 0;
    const avgC = manual || (cycles.length ? Math.round(cycles.slice(-6).reduce((a, b) => a + b, 0) / cycles.slice(-6).length) : 28);
    const avgP = lens.length ? Math.round(lens.slice(-6).reduce((a, b) => a + b, 0) / lens.slice(-6).length) : 5;
    const preds = [];
    if (ps.length) {
      let st = ps[ps.length - 1].start;
      for (let i = 0; i < 4; i++) {
        st = addDays(st, avgC);
        const ov = addDays(st, -14);
        preds.push({ start: st, end: addDays(st, avgP - 1), ovulation: ov, fertileFrom: addDays(ov, -5), fertileTo: addDays(ov, 1) });
      }
    }
    return { ps, avgC, avgP, preds, cyclesN: cycles.length, manual: !!manual };
  }

  function update() {
    const a = analyse();
    const nextP = a.preds.find(p => p.start >= today()) || a.preds[0];
    const daysTo = nextP ? diffDays(today(), nextP.start) : null;
    render(stats,
      stat(a.avgC + ' d', a.manual ? 'cycle length (manual)' : a.cyclesN ? `average cycle (${a.cyclesN} logged)` : 'default cycle (log 2+ periods)'),
      stat(a.avgP + ' d', 'average period length'),
      stat(nextP ? (daysTo < 0 ? `${-daysTo} d late` : daysTo === 0 ? 'today' : `in ${daysTo} d`) : '–', nextP ? 'next period ' + nextP.start : 'next period'),
      stat(nextP ? `${nextP.fertileFrom.slice(5)} → ${nextP.fertileTo.slice(5)}` : '–', 'predicted fertile window'));
    renderCal(a);
    render(listBox, a.ps.length ? el('table', { class: 'table' }, el('thead', {}, el('tr', {}, ['Start', 'End', 'Length', 'Cycle before', ''].map(h => el('th', {}, h)))),
      el('tbody', {}, a.ps.slice().reverse().map(p => {
        const i = a.ps.indexOf(p), prev = i > 0 ? diffDays(a.ps[i - 1].start, p.start) : null;
        return el('tr', {}, el('td', {}, p.start), el('td', {}, p.end || el('span', { class: 'muted' }, 'open')), el('td', {}, p.end ? diffDays(p.start, p.end) + 1 + ' d' : '–'), el('td', {}, prev ? prev + ' d' : '–'),
          el('td', {}, el('button', { class: 'btn small ghost', onclick: () => { periods = periods.filter(x => x.id !== p.id); save(); update(); } }, '✕')));
      }))) : el('div', { class: 'muted' }, 'No periods logged yet. Add your last period start date above.'));
  }

  function renderCal(a) {
    monthTitle.textContent = new Date(year, month, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    const first = (new Date(year, month, 1).getDay() + 6) % 7, n = new Date(year, month + 1, 0).getDate();
    const cells = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(d => el('div', { style: { border: 0, background: 'none', aspectRatio: 'auto', color: 'var(--muted)' } }, d));
    for (let i = 0; i < first; i++) cells.push(el('div', { style: { border: 0, background: 'none' } }));
    const logged = k => a.ps.some(p => k >= p.start && k <= (p.end || addDays(p.start, a.avgP - 1)));
    for (let d = 1; d <= n; d++) {
      const k = `${year}-${pad(month + 1)}-${pad(d)}`;
      const isLogged = logged(k);
      const pred = a.preds.find(p => k >= p.start && k <= p.end);
      const fert = a.preds.find(p => k >= p.fertileFrom && k <= p.fertileTo);
      const ovu = a.preds.some(p => p.ovulation === k);
      let bg = 'var(--bg)', color = 'var(--text)', border = '1px solid var(--line)';
      if (isLogged) { bg = 'var(--danger)'; color = '#fff'; }
      else if (pred) { bg = 'color-mix(in srgb, var(--danger) 25%, var(--bg))'; border = '1px dashed var(--danger)'; }
      else if (fert) { bg = 'color-mix(in srgb, var(--ok) 28%, var(--bg))'; }
      cells.push(el('div', {
        title: isLogged ? `${k}: period` : pred ? `${k}: predicted period` : ovu ? `${k}: estimated ovulation` : fert ? `${k}: fertile window (estimate)` : k,
        style: { background: bg, color, border, outline: k === today() ? '2px solid var(--accent)' : 'none', fontWeight: ovu ? 800 : 400, textDecoration: ovu ? 'underline' : 'none' },
      }, d));
    }
    render(cal, cells);
  }

  const nav = d => { month += d; if (month < 0) { month = 11; year--; } if (month > 11) { month = 0; year++; } update(); };
  const swatch = (bg, border, label) => el('span', {}, el('span', { style: { display: 'inline-block', width: '12px', height: '12px', background: bg, border: border || '1px solid var(--line)', borderRadius: '3px', marginRight: '4px', verticalAlign: 'middle' } }), label);

  render(root,
    el('div', { class: 'panel muted small' }, 'Local only: this data never leaves your browser. Predictions are rough estimates from your logged history and must not be used for contraception or to diagnose anything.'),
    el('div', { class: 'row' },
      field('Period start', startIn), field('Period end (optional)', endIn),
      el('button', { class: 'btn primary', onclick: logStart, style: { alignSelf: 'flex-end' } }, 'Log period start'),
      el('button', { class: 'btn', onclick: logEnd, style: { alignSelf: 'flex-end' } }, 'Set end of current period'),
      field('Cycle length override', manualCycle)),
    stats,
    el('div', { class: 'row', style: { justifyContent: 'center' } },
      el('button', { class: 'btn small', onclick: () => nav(-1) }, '◀'), monthTitle, el('button', { class: 'btn small', onclick: () => nav(1) }, '▶'),
      el('button', { class: 'btn small ghost', onclick: () => { year = now.getFullYear(); month = now.getMonth(); update(); } }, 'Today')),
    cal,
    el('div', { class: 'row small muted' }, swatch('var(--danger)', '', 'period'), swatch('color-mix(in srgb, var(--danger) 25%, var(--bg))', '1px dashed var(--danger)', 'predicted period'), swatch('color-mix(in srgb, var(--ok) 28%, var(--bg))', '', 'fertile window (est.)'), el('span', {}, 'underlined = estimated ovulation')),
    el('h3', {}, 'History'), listBox,
    el('h3', {}, 'Private note'), noteIn,
    el('p', { class: 'muted small' }, 'Ovulation is estimated at 14 days before the next period; the fertile window is the 5 days before it plus the day after.'));
  update();
}
