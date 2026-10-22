// Push-up & plank challenge: 30-day plan from your starting max, mark days done, today's sets, plank timer, progress chart.
import { el, render, store, today, toast, stat, field, pad } from '../../lib/ui.js';

// Build a 30-day plan. Every 4th day is a rest day (plank only, lighter).
export function buildPlan(max) {
  max = Math.max(1, Math.round(max));
  const plan = [];
  for (let d = 1; d <= 30; d++) {
    const plank = Math.round((20 + d * 3) / 5) * 5;
    if (d % 4 === 0) { plan.push({ day: d, rest: true, sets: [], total: 0, plank: Math.max(20, Math.round(plank * 0.7 / 5) * 5) }); continue; }
    const base = Math.max(2, Math.round(max * (0.45 + 0.0165 * d)));
    const sets = [base, base, Math.max(1, base - 1), Math.max(1, base - 1), Math.round(base * 1.3)];
    plan.push({ day: d, rest: false, sets, total: sets.reduce((a, b) => a + b, 0), plank });
  }
  return plan;
}

export default function (root) {
  const s = store('pushup-challenge');
  const cv = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || '#888';
  let max = +s.get('max', 0) || 0;
  let startDate = s.get('start', null);
  let done = s.get('done', {});          // day number -> true
  let bestPlank = +s.get('bestPlank', 0) || 0;
  let plan = max ? buildPlan(max) : [];
  let sel = 1;
  let plankT0 = 0, plankTimer = null;

  const dayNum = () => {
    if (!startDate) return 1;
    const a = new Date(startDate + 'T12:00:00'), b = new Date(today() + 'T12:00:00');
    return Math.max(1, Math.min(30, Math.round((b - a) / 864e5) + 1));
  };
  const save = () => { s.set('done', done); };

  const maxIn = el('input', { class: 'input', type: 'number', min: 1, max: 200, value: max || '', placeholder: 'max push-ups', style: { width: '120px' }, onkeydown: e => { if (e.key === 'Enter') begin(); } });
  const setup = el('div', { class: 'row' });
  const body = el('div', { class: 'col' });
  const chart = el('canvas', { width: 720, height: 230, style: { width: '100%', maxWidth: '720px' } });
  const grid = el('div', { class: 'cal', style: { gridTemplateColumns: 'repeat(10, 1fr)' } });
  const plankTime = el('div', { class: 'big mono', style: { fontSize: '40px' } }, '0:00');
  const plankBtn = el('button', { class: 'btn primary', onclick: () => togglePlank() }, 'Start plank');
  const plankInfo = el('div', { class: 'muted small' });
  const planWrap = el('div', {},
    el('h3', {}, 'Calendar'), el('div', { class: 'muted small' }, 'Click a day to view it. Green is done, dashed is today.'), grid,
    el('h3', {}, 'Progress'), el('div', { class: 'canvas-wrap' }, chart),
    el('div', { class: 'muted small' }, 'Bars show planned push-ups per day (green = done, blue = today, light = rest day).'));

  function begin() {
    const v = Math.round(+maxIn.value);
    if (!(v >= 1)) { toast('Enter how many push-ups you can do in one go'); return; }
    max = v; startDate = today(); done = {}; plan = buildPlan(max);
    s.set('max', max); s.set('start', startDate); save(); sel = 1; update(); toast('30-day plan created');
  }
  function reset() { max = 0; plan = []; startDate = null; done = {}; s.del('max'); s.del('start'); s.del('done'); maxIn.value = ''; update(); }

  const fmtP = sec => `${Math.floor(sec / 60)}:${pad(sec % 60)}`;
  function togglePlank() {
    if (plankTimer) {
      clearInterval(plankTimer); plankTimer = null;
      const sec = Math.round((Date.now() - plankT0) / 1000);
      plankBtn.textContent = 'Start plank';
      if (sec > bestPlank) { bestPlank = sec; s.set('bestPlank', bestPlank); toast(`New plank record: ${fmtP(sec)}`); } else toast(`Plank ${fmtP(sec)}`);
      plankInfo.textContent = `Best plank: ${bestPlank ? fmtP(bestPlank) : '–'}`;
    } else {
      plankT0 = Date.now(); plankBtn.textContent = 'Stop';
      plankTimer = setInterval(() => { plankTime.textContent = fmtP(Math.round((Date.now() - plankT0) / 1000)); }, 250);
    }
  }

  function drawChart() {
    const c = chart.getContext('2d'), W = chart.width, H = chart.height, padL = 36, padB = 26, padT = 14;
    c.clearRect(0, 0, W, H);
    const maxV = Math.max(...plan.map(p => p.total), 1) * 1.1, bw = (W - padL - 8) / 30;
    const y = v => H - padB - (v / maxV) * (H - padB - padT);
    c.strokeStyle = cv('--line'); c.beginPath(); c.moveTo(padL, y(0)); c.lineTo(W - 8, y(0)); c.stroke();
    c.font = '11px system-ui, sans-serif'; c.fillStyle = cv('--muted'); c.textAlign = 'right'; c.textBaseline = 'middle';
    c.fillText('0', padL - 4, y(0)); c.fillText(String(Math.round(maxV)), padL - 4, y(maxV));
    const cur = dayNum();
    plan.forEach((p, i) => {
      const x = padL + i * bw + 1, w = bw - 2;
      if (p.rest) { c.fillStyle = cv('--line'); c.fillRect(x, y(maxV * 0.08), w, y(0) - y(maxV * 0.08)); }
      else { c.fillStyle = done[p.day] ? cv('--ok') : p.day === cur ? cv('--accent') : cv('--muted'); c.globalAlpha = done[p.day] || p.day === cur ? 1 : 0.45; c.fillRect(x, y(p.total), w, y(0) - y(p.total)); c.globalAlpha = 1; }
      if (p.day === sel) { c.strokeStyle = cv('--text'); c.lineWidth = 2; c.strokeRect(x - 0.5, y(p.rest ? maxV * 0.08 : p.total) - 0.5, w + 1, y(0) - y(p.rest ? maxV * 0.08 : p.total) + 1); c.lineWidth = 1; }
      if (p.day % 5 === 0 || p.day === 1) { c.fillStyle = cv('--muted'); c.textAlign = 'center'; c.textBaseline = 'top'; c.fillText(String(p.day), x + w / 2, H - padB + 6); }
    });
  }

  function update() {
    planWrap.classList.toggle('hidden', !plan.length);
    if (!plan.length) {
      render(setup, el('span', { class: 'muted' }, 'How many push-ups can you do in one set (good form)?'), maxIn, el('button', { class: 'btn primary', onclick: begin }, 'Create my 30-day plan'));
      render(body, el('div', { class: 'muted small' }, 'The plan has 5 sets per training day, a rest day (plank only) every 4th day, and builds gradually. Do not train through pain.'));
      return;
    }
    render(setup);
    const p = plan[sel - 1], cur = dayNum(), nDone = Object.keys(done).length;
    const trainDays = plan.filter(x => !x.rest).length;
    const repsDone = plan.filter(x => done[x.day]).reduce((a, b) => a + b.total, 0);
    const doneBtn = el('button', { class: 'btn ' + (done[p.day] ? '' : 'primary'), onclick: () => { if (done[p.day]) delete done[p.day]; else done[p.day] = true; save(); update(); } }, done[p.day] ? 'Mark not done' : 'Mark day done');
    plankInfo.textContent = `Plank target for day ${p.day}: ${p.plank} s. Best plank: ${bestPlank ? fmtP(bestPlank) : '–'}`;
    render(body,
      el('div', { class: 'row' }, stat(`${cur} / 30`, 'today is day'), stat(`${nDone} / 30`, 'days done'), stat(repsDone, 'push-ups completed'), stat(max, 'starting max')),
      el('div', { class: 'panel col' },
        el('div', { class: 'row' }, el('b', {}, `Day ${p.day}`), p.day === cur && el('span', { class: 'badge ok' }, 'today'), p.rest && el('span', { class: 'badge' }, 'rest day'), done[p.day] && el('span', { class: 'badge ok' }, 'done')),
        p.rest ? el('div', {}, 'Rest day: no push-ups. Do one plank and some gentle stretching.')
          : el('div', { class: 'row' }, p.sets.map((r, i) => el('div', { class: 'stat', style: { minWidth: '70px', textAlign: 'center' } }, el('div', { class: 'v' }, r + (i === 4 ? '+' : '')), el('div', { class: 'l' }, 'set ' + (i + 1))))),
        !p.rest && el('div', { class: 'muted small' }, `Total ${p.total} reps. Rest 60-90 s between sets. The last set is "as many as you can, at least this many".`),
        el('div', { class: 'row' }, doneBtn, el('button', { class: 'btn ghost', onclick: () => { sel = cur; update(); } }, 'Go to today'))));
    render(grid, plan.map(x => el('div', {
      style: { cursor: 'pointer', background: done[x.day] ? 'var(--ok)' : 'var(--bg)', color: done[x.day] ? '#fff' : 'var(--text)', outline: x.day === sel ? '2px solid var(--accent)' : x.day === cur ? '2px dashed var(--muted)' : 'none', opacity: x.rest && !done[x.day] ? 0.6 : 1 },
      title: x.rest ? `Day ${x.day}: rest` : `Day ${x.day}: ${x.total} reps`, onclick: () => { sel = x.day; update(); },
    }, x.day)));
    drawChart();
  }

  render(root,
    setup, body,
    planWrap,
    el('h3', {}, 'Plank timer'),
    el('div', { class: 'row' }, plankTime, plankBtn), plankInfo,
    el('div', { class: 'row' }, el('button', { class: 'btn small danger', onclick: function () { if (this.dataset.arm) { reset(); this.dataset.arm = ''; this.textContent = 'Restart challenge'; } else { this.dataset.arm = 1; this.textContent = 'Click again to erase progress'; } } }, 'Restart challenge')),
    el('p', { class: 'muted small' }, 'Progress is stored in this browser only. Check with a doctor before starting a new exercise programme.'));
  update();
  return () => clearInterval(plankTimer);
}
