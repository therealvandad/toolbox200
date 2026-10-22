import { el, render, store, uid, today } from '../../lib/ui.js';
import { money, N, pd, dayDiff, todayDate, fmtDate, exportBar, input, cssVar } from './_h.js';

function thermometer(canvas, pct) {
  const g = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
  const line = cssVar(canvas, '--line', '#ccc'), muted = cssVar(canvas, '--muted', '#777'), bg = cssVar(canvas, '--bg', '#fff');
  const done = pct >= 100;
  const fill = done ? cssVar(canvas, '--ok', '#1f9d55') : cssVar(canvas, '--accent', '#2f6fed');
  g.clearRect(0, 0, W, H);
  const cx = 28, tubeW = 22, bulbR = 24, top = 14, bottom = H - bulbR * 2 - 6, bcy = H - bulbR - 4;
  // outline
  g.fillStyle = bg; g.strokeStyle = line; g.lineWidth = 3;
  g.beginPath(); g.roundRect(cx - tubeW / 2, top, tubeW, bottom - top + 14, 11); g.fill(); g.stroke();
  g.beginPath(); g.arc(cx, bcy, bulbR, 0, 6.3); g.fill(); g.stroke();
  // fill
  g.fillStyle = fill;
  g.beginPath(); g.arc(cx, bcy, bulbR - 4, 0, 6.3); g.fill();
  const inner = tubeW - 8, h = (bottom - top) * Math.min(100, Math.max(0, pct)) / 100;
  g.fillRect(cx - inner / 2, bottom + 6 - h, inner, h + 8);
  // ticks
  g.strokeStyle = muted; g.fillStyle = muted; g.lineWidth = 1; g.font = '12px system-ui, sans-serif'; g.textBaseline = 'middle';
  for (let p = 0; p <= 100; p += 25) {
    const y = bottom + 6 - (bottom - top) * p / 100;
    g.beginPath(); g.moveTo(cx + tubeW / 2 + 3, y); g.lineTo(cx + tubeW / 2 + 10, y); g.stroke();
    g.fillText(p + '%', cx + tubeW / 2 + 13, y);
  }
}

export default function (root) {
  const s = store('savings-goal');
  let goals = s.get('goals', []);
  const save = () => s.set('goals', goals);
  const saved = g => N(g.start) + g.log.reduce((a, x) => a + x.amt, 0);

  const fName = input({ placeholder: 'Goal (e.g. Holiday)', class: 'input grow' });
  const fTarget = input({ type: 'number', min: '0', step: '0.01', placeholder: 'Target', style: { width: '110px' } });
  const fStart = input({ type: 'number', step: '0.01', placeholder: 'Already saved', style: { width: '120px' } });
  const fDead = input({ type: 'date' });
  const list = el('div', { class: 'col' });

  function addGoal() {
    const name = fName.value.trim();
    if (!name || N(fTarget.value) <= 0) return;
    goals.push({ id: uid(), name, target: N(fTarget.value), start: N(fStart.value), deadline: fDead.value, log: [] });
    fName.value = fTarget.value = fStart.value = fDead.value = '';
    save(); draw();
  }
  [fName, fTarget, fStart].forEach(f => f.addEventListener('keydown', e => e.key === 'Enter' && addGoal()));

  function goalCard(g) {
    const sv = saved(g), pct = g.target > 0 ? sv / g.target * 100 : 0, remaining = Math.max(0, g.target - sv);
    const canvas = el('canvas', { width: 90, height: 170 });
    let plan = '';
    const dl = pd(g.deadline);
    if (remaining <= 0) plan = 'Goal reached!';
    else if (dl) {
      const days = dayDiff(todayDate(), dl);
      if (days <= 0) plan = `Deadline passed. ${money(remaining)} still needed.`;
      else {
        const months = Math.max(1, days / 30.4375);
        plan = `Save ${money(remaining / months)} per month (${money(remaining / (days / 7 < 1 ? 1 : days / 7))} per week) for ${days} days.`;
      }
    } else plan = 'Set a deadline to see the monthly amount needed.';
    const cAmt = input({ type: 'number', step: '0.01', placeholder: 'Amount (negative = withdraw)', style: { width: '190px' } });
    const cDate = input({ type: 'date', value: today() });
    const cNote = input({ placeholder: 'Note', class: 'input grow' });
    const addC = () => {
      const amt = N(cAmt.value);
      if (!amt) return;
      g.log.push({ id: uid(), date: cDate.value || today(), amt, note: cNote.value.trim() });
      save(); draw();
    };
    cAmt.addEventListener('keydown', e => e.key === 'Enter' && addC());
    cNote.addEventListener('keydown', e => e.key === 'Enter' && addC());
    const card = el('div', { class: 'panel' },
      el('div', { class: 'row', style: { alignItems: 'flex-start', flexWrap: 'nowrap' } },
        canvas,
        el('div', { class: 'grow col' },
          el('div', { class: 'row', style: { margin: 0 } },
            el('b', { class: 'grow' }, g.name),
            pct >= 100 ? el('span', { class: 'badge ok' }, 'done') : null,
            el('button', { class: 'btn small ghost', onclick: () => { goals = goals.filter(x => x.id !== g.id); save(); draw(); } }, 'Delete')),
          el('div', {}, `${money(sv)} of ${money(g.target)} (${pct.toFixed(1)}%)`),
          el('div', { class: 'bar' }, el('div', { style: { width: Math.min(100, Math.max(0, pct)) + '%', background: pct >= 100 ? 'var(--ok)' : 'var(--accent)' } })),
          el('div', { class: 'small muted' }, g.deadline ? 'Deadline: ' + fmtDate(dl) : 'No deadline'),
          el('div', { class: 'small', style: { fontWeight: '600' } }, plan))),
      el('div', { class: 'row' }, cAmt, cDate, cNote, el('button', { class: 'btn primary small', onclick: addC }, 'Add contribution')),
      g.log.length ? el('div', { class: 'scroll-x' }, el('table', { class: 'table' },
        el('thead', {}, el('tr', {}, ['Date', 'Amount', 'Note', ''].map(h => el('th', {}, h)))),
        el('tbody', {}, [...g.log].sort((a, b) => b.date.localeCompare(a.date)).map(x =>
          el('tr', {}, el('td', {}, x.date), el('td', { style: { color: x.amt < 0 ? 'var(--danger)' : 'inherit' } }, money(x.amt)), el('td', {}, x.note),
            el('td', {}, el('button', { class: 'btn small ghost', onclick: () => { g.log = g.log.filter(y => y.id !== x.id); save(); draw(); } }, 'x'))))))) : null);
    requestAnimationFrame(() => thermometer(canvas, pct));
    thermometer(canvas, pct);
    return card;
  }

  function draw() {
    render(list, goals.length ? goals.map(goalCard) : el('div', { class: 'empty' }, 'No goals yet. Add one above.'));
  }
  render(root,
    el('div', { class: 'row' }, fName, fTarget, fStart, el('label', { class: 'inline' }, 'Deadline', fDead), el('button', { class: 'btn primary', onclick: addGoal }, 'Add goal')),
    list,
    exportBar('savings-goals',
      () => [['Goal', 'Target', 'Saved', 'Deadline', 'Date', 'Contribution', 'Note'], ...goals.flatMap(g => g.log.length ? g.log.map(x => [g.name, g.target, saved(g), g.deadline, x.date, x.amt, x.note]) : [[g.name, g.target, saved(g), g.deadline, '', '', '']])],
      () => goals));
  draw();
}
