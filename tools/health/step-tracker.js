// Step goal tracker: manual daily steps or CSV import (date,steps), goal line, 30-day chart, weekly totals, best day.
import { el, render, store, today, toast, stat, field, pad, readFile, dropZone } from '../../lib/ui.js';

export default function (root) {
  const s = store('step-tracker');
  const cv = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || '#888';
  let steps = s.get('steps', {});          // 'YYYY-MM-DD' -> number
  let goal = +s.get('goal', 8000) || 8000;

  const keyOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const save = () => s.set('steps', steps);
  const fmt = n => Math.round(n).toLocaleString();

  const dateIn = el('input', { class: 'input', type: 'date', value: today(), onchange: () => { const v = steps[dateIn.value]; stepIn.value = v != null ? v : ''; } });
  const stepIn = el('input', { class: 'input', type: 'number', min: 0, step: 100, placeholder: 'steps', style: { width: '120px' }, value: steps[today()] != null ? steps[today()] : '',
    onkeydown: e => { if (e.key === 'Enter') saveDay(); } });
  const goalIn = el('input', { class: 'input', type: 'number', min: 500, step: 500, value: goal, style: { width: '110px' }, onchange: () => { goal = Math.max(500, Math.round(+goalIn.value) || 8000); s.set('goal', goal); update(); } });
  const csvArea = el('textarea', { class: 'textarea', style: { minHeight: '90px' }, placeholder: 'date,steps\n2025-03-01,8412\n2025-03-02,10233' });
  const stats = el('div', { class: 'row' });
  const weeks = el('div', { class: 'scroll-x' });
  const chart = el('canvas', { width: 720, height: 240, style: { width: '100%', maxWidth: '720px' } });

  function saveDay() {
    if (!dateIn.value) return;
    const v = Math.round(+stepIn.value);
    if (stepIn.value === '' || !(v >= 0)) { delete steps[dateIn.value]; } else steps[dateIn.value] = v;
    save(); update(); toast('Saved');
  }

  function parseDate(str) {
    str = String(str).trim().replace(/^"|"$/g, '');
    let m = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (m) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
    m = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);       // D/M/Y or M/D/Y
    if (m) {
      let a = +m[1], b = +m[2];
      if (a > 12) return `${m[3]}-${pad(b)}-${pad(a)}`;
      if (b > 12) return `${m[3]}-${pad(a)}-${pad(b)}`;
      return `${m[3]}-${pad(a)}-${pad(b)}`;                         // ambiguous: treat as M/D/Y
    }
    const d = new Date(str);
    return isNaN(d) ? null : keyOf(d);
  }
  function importCsv(text) {
    let ok = 0, bad = 0;
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim()) continue;
      const parts = line.split(/[,;\t]/);
      if (parts.length < 2) { bad++; continue; }
      const k = parseDate(parts[0]), n = Math.round(+String(parts[1]).replace(/[\s"']/g, '').replace(/,/g, ''));
      if (!k || !(n >= 0) || isNaN(n)) { if (!/date/i.test(parts[0])) bad++; continue; }
      steps[k] = n; ok++;
    }
    save(); update();
    toast(`Imported ${ok} day${ok === 1 ? '' : 's'}${bad ? `, skipped ${bad} bad line${bad === 1 ? '' : 's'}` : ''}`, 3000);
  }

  function drawChart() {
    const c = chart.getContext('2d'), W = chart.width, H = chart.height, padL = 46, padB = 26, padT = 14;
    c.clearRect(0, 0, W, H);
    const days = []; for (let i = 29; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); days.push(d); }
    const vals = days.map(d => steps[keyOf(d)] || 0);
    const max = Math.max(goal * 1.15, ...vals, 1);
    const bw = (W - padL - 8) / 30, y = v => H - padB - (v / max) * (H - padB - padT);
    c.strokeStyle = cv('--line'); c.lineWidth = 1; c.beginPath(); c.moveTo(padL, y(0)); c.lineTo(W - 8, y(0)); c.stroke();
    c.fillStyle = cv('--muted'); c.font = '11px system-ui, sans-serif'; c.textAlign = 'right'; c.textBaseline = 'middle';
    c.fillText('0', padL - 4, y(0)); c.fillText(fmt(max), padL - 4, y(max));
    days.forEach((d, i) => {
      const x = padL + i * bw + 1, w = bw - 2;
      c.fillStyle = vals[i] >= goal ? cv('--ok') : cv('--accent');
      c.fillRect(x, y(vals[i]), w, y(0) - y(vals[i]));
      if (i % 5 === 0 || i === 29) { c.fillStyle = cv('--muted'); c.textAlign = 'center'; c.textBaseline = 'top'; c.fillText(`${d.getMonth() + 1}/${d.getDate()}`, x + w / 2, H - padB + 6); }
    });
    c.setLineDash([6, 4]); c.strokeStyle = cv('--warn'); c.lineWidth = 2; c.beginPath(); c.moveTo(padL, y(goal)); c.lineTo(W - 8, y(goal)); c.stroke(); c.setLineDash([]);
    c.fillStyle = cv('--warn'); c.textAlign = 'right'; c.textBaseline = 'bottom'; c.fillText('goal ' + fmt(goal), W - 10, y(goal) - 2);
  }

  function weekStart(d) { const x = new Date(d); x.setHours(12, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }

  function update() {
    const keys = Object.keys(steps).sort();
    const last30 = []; for (let i = 0; i < 30; i++) { const d = new Date(); d.setDate(d.getDate() - i); const v = steps[keyOf(d)]; if (v != null) last30.push([keyOf(d), v]); }
    const avg = last30.length ? last30.reduce((a, b) => a + b[1], 0) / last30.length : 0;
    const best = keys.reduce((b, k) => (!b || steps[k] > steps[b] ? k : b), null);
    const met = last30.filter(x => x[1] >= goal).length;
    let streak = 0; const d = new Date(); if ((steps[keyOf(d)] || 0) < goal) d.setDate(d.getDate() - 1);
    while ((steps[keyOf(d)] || 0) >= goal) { streak++; d.setDate(d.getDate() - 1); }
    render(stats, stat(fmt(steps[today()] || 0), 'today'), stat(fmt(avg), 'average (logged days, 30 d)'), stat(`${met}/${last30.length}`, 'goal days (30 d)'), stat(streak + ' d', 'goal streak'),
      stat(best ? fmt(steps[best]) : '–', best ? `best day (${best})` : 'best day'));
    // weekly totals: last 6 weeks
    const rows = []; const ws = weekStart(new Date());
    for (let w = 0; w < 6; w++) {
      const st = new Date(ws); st.setDate(st.getDate() - w * 7);
      let tot = 0, n = 0; for (let i = 0; i < 7; i++) { const x = new Date(st); x.setDate(x.getDate() + i); const v = steps[keyOf(x)]; if (v != null) { tot += v; n++; } }
      const en = new Date(st); en.setDate(en.getDate() + 6);
      rows.push(el('tr', {}, el('td', {}, `${keyOf(st)} → ${keyOf(en)}`), el('td', {}, fmt(tot)), el('td', {}, n), el('td', {}, n ? fmt(tot / n) : '–'),
        el('td', {}, el('div', { class: 'bar', style: { minWidth: '80px' } }, el('div', { style: { width: Math.min(100, tot / (goal * 7) * 100) + '%', background: tot >= goal * 7 ? 'var(--ok)' : 'var(--accent)' } })))));
    }
    render(weeks, el('table', { class: 'table' }, el('thead', {}, el('tr', {}, ['Week (Mon–Sun)', 'Total', 'Days', 'Avg/day', 'vs weekly goal'].map(h => el('th', {}, h)))), el('tbody', {}, rows)));
    drawChart();
  }

  render(root,
    el('div', { class: 'row' },
      field('Date', dateIn), field('Steps', stepIn), el('button', { class: 'btn primary', onclick: saveDay, style: { alignSelf: 'flex-end' } }, 'Save day'), field('Daily goal', goalIn)),
    stats,
    el('h3', {}, 'Last 30 days'), el('div', { class: 'canvas-wrap' }, chart),
    el('h3', {}, 'Weekly totals'), weeks,
    el('h3', {}, 'Import CSV'),
    el('div', { class: 'muted small' }, 'One line per day as date,steps (YYYY-MM-DD preferred). A header line is ignored. Existing days are overwritten.'),
    dropZone('Drop a .csv file here or click to choose', async files => { importCsv(await readFile(files[0], 'text')); }, '.csv,.txt,text/csv', false),
    csvArea,
    el('div', { class: 'row' },
      el('button', { class: 'btn', onclick: () => { if (csvArea.value.trim()) { importCsv(csvArea.value); csvArea.value = ''; } else toast('Paste some CSV first'); } }, 'Import pasted text'),
      el('button', { class: 'btn danger small', onclick: () => { if (btnClear.dataset.arm) { steps = {}; save(); update(); delete btnClear.dataset.arm; btnClear.textContent = 'Clear all data'; } else { btnClear.dataset.arm = 1; btnClear.textContent = 'Click again to confirm'; } } }, 'Clear all data')),
    el('p', { class: 'muted small' }, 'Steps stay in this browser only. Nothing is uploaded.'));
  const btnClear = root.querySelector('button.danger');
  update();
}
