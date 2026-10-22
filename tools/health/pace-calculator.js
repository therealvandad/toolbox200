// Running pace calculator: any two of distance / time / pace give the third, split table, Riegel race predictor.
import { el, render, store, toast, field, pad, copy } from '../../lib/ui.js';

const KM_PER_MI = 1.609344;
const RACES = [['5K', 5], ['10K', 10], ['Half marathon', 21.0975], ['Marathon', 42.195]];

export default function (root) {
  const s = store('pace-calculator');
  let unit = s.get('unit', 'km');

  const distIn = el('input', { class: 'input', type: 'number', min: 0, step: 'any', placeholder: 'distance', style: { width: '110px' }, value: s.get('dist', '') });
  const unitSel = el('select', { class: 'select', onchange: () => { unit = unitSel.value; s.set('unit', unit); paceLabel.textContent = `Pace (min/${unit})`; calc(true); } },
    ['km', 'mi'].map(u => el('option', { value: u, selected: u === unit }, u)));
  const mk = (ph, w, key, max) => el('input', { class: 'input', type: 'number', min: 0, max, step: 1, placeholder: ph, style: { width: w }, value: s.get(key, '') });
  const th = mk('h', '64px'), tm = mk('min', '70px'), ts = mk('sec', '70px', undefined, 59.99);
  const pm = mk('min', '70px'), ps = mk('sec', '70px', undefined, 59.99);
  [th, tm, ts, pm, ps].forEach((i, n) => { const k = ['th', 'tm', 'ts', 'pm', 'ps'][n]; i.value = s.get(k, ''); i.addEventListener('keydown', e => { if (e.key === 'Enter') calc(); }); });
  distIn.addEventListener('keydown', e => { if (e.key === 'Enter') calc(); });
  const paceLabel = el('span', {}, `Pace (min/${unit})`);
  const msg = el('div', { class: 'muted small' });
  const out = el('div', { class: 'col' });

  const num = i => (i.value === '' ? null : +i.value);
  const fmtT = sec => {
    sec = Math.round(sec);
    const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), x = sec % 60;
    return h ? `${h}:${pad(m)}:${pad(x)}` : `${m}:${pad(x)}`;
  };
  const fmtP = sec => { sec = Math.round(sec); return `${Math.floor(sec / 60)}:${pad(sec % 60)}`; };
  const setTime = sec => { sec = Math.round(sec); th.value = Math.floor(sec / 3600) || ''; tm.value = Math.floor(sec % 3600 / 60); ts.value = sec % 60; };
  const setPace = sec => { sec = Math.round(sec); pm.value = Math.floor(sec / 60); ps.value = sec % 60; };

  function readValues() {
    const d = num(distIn);
    const tAny = [th, tm, ts].some(i => i.value !== '');
    const pAny = [pm, ps].some(i => i.value !== '');
    const t = tAny ? (num(th) || 0) * 3600 + (num(tm) || 0) * 60 + (num(ts) || 0) : null;
    const p = pAny ? (num(pm) || 0) * 60 + (num(ps) || 0) : null;
    return { d: d && d > 0 ? d : null, t: t && t > 0 ? t : null, p: p && p > 0 ? p : null };
  }

  function calc(keepPace) {
    let { d, t, p } = readValues();
    const have = [d, t, p].filter(v => v != null).length;
    if (have < 2) { msg.textContent = 'Enter any two of distance, time and pace.'; render(out); return; }
    let which;
    if (d != null && t != null && (p == null || keepPace === true)) { p = t / d; setPace(p); which = 'pace'; }
    else if (d != null && p != null && t == null) { t = d * p; setTime(t); which = 'time'; }
    else if (t != null && p != null && d == null) { d = t / p; distIn.value = Math.round(d * 1000) / 1000; which = 'distance'; }
    else { p = t / d; setPace(p); which = 'pace'; }   // all three filled: recompute pace from distance and time
    msg.textContent = `Calculated ${which}.`;
    ['dist', 'th', 'tm', 'ts', 'pm', 'ps'].forEach((k, i) => s.set(k, [distIn, th, tm, ts, pm, ps][i].value));
    show(d, t, p);
  }

  function show(d, t, p) {
    const dKm = unit === 'km' ? d : d * KM_PER_MI;
    const altPace = unit === 'km' ? p * KM_PER_MI : p / KM_PER_MI;     // seconds per other unit
    const speed = 3600 / p;                                              // units per hour
    // splits
    const rows = []; const full = Math.floor(d + 1e-9);
    for (let i = 1; i <= full; i++) rows.push([`${i} ${unit}`, fmtP(p), fmtT(p * i)]);
    const frac = d - full;
    if (frac > 0.005) rows.push([`${Math.round(d * 100) / 100} ${unit} (finish)`, fmtP(p), fmtT(t)]);
    const tooMany = rows.length > 100;
    // Riegel
    const pred = RACES.map(([name, km]) => {
      const tt = t * Math.pow(km / dKm, 1.06);
      return el('tr', {}, el('td', {}, name), el('td', {}, el('b', {}, fmtT(tt))), el('td', {}, fmtP(tt / (unit === 'km' ? km : km / KM_PER_MI)) + ` /${unit}`));
    });
    render(out,
      el('div', { class: 'row' },
        el('div', { class: 'stat' }, el('div', { class: 'v' }, fmtT(t)), el('div', { class: 'l' }, 'finish time')),
        el('div', { class: 'stat' }, el('div', { class: 'v' }, `${fmtP(p)} /${unit}`), el('div', { class: 'l' }, 'pace')),
        el('div', { class: 'stat' }, el('div', { class: 'v' }, `${fmtP(altPace)} /${unit === 'km' ? 'mi' : 'km'}`), el('div', { class: 'l' }, 'pace other unit')),
        el('div', { class: 'stat' }, el('div', { class: 'v' }, (Math.round(speed * 100) / 100) + ` ${unit}/h`), el('div', { class: 'l' }, 'speed')),
        el('button', { class: 'btn small', onclick: () => copy(`${Math.round(d * 100) / 100} ${unit} in ${fmtT(t)} = ${fmtP(p)} /${unit}`) }, 'Copy result')),
      el('h3', {}, 'Splits (even pace)'),
      tooMany ? el('div', { class: 'muted small' }, 'Too many splits to list for this distance.') :
        el('div', { class: 'scroll-x', style: { maxHeight: '300px', overflow: 'auto' } }, el('table', { class: 'table' }, el('thead', {}, el('tr', {}, ['Split', 'Pace', 'Elapsed'].map(h => el('th', {}, h)))),
          el('tbody', {}, rows.map(r => el('tr', {}, r.map(c => el('td', {}, c))))))),
      el('h3', {}, 'Race predictor (Riegel)'),
      el('div', { class: 'scroll-x' }, el('table', { class: 'table' }, el('thead', {}, el('tr', {}, ['Race', 'Predicted time', 'Pace'].map(h => el('th', {}, h)))), el('tbody', {}, pred))),
      el('div', { class: 'muted small' }, 'Riegel: T2 = T1 x (D2 / D1)^1.06. Most reliable for distances within about 0.5x to 2x of the one you ran, and assumes similar training and conditions.'));
  }

  const presets = el('div', { class: 'row' }, [['5K', 5], ['10K', 10], ['Half', 21.0975], ['Marathon', 42.195]].map(([n, km]) =>
    el('button', { class: 'btn small ghost', onclick: () => { distIn.value = Math.round((unit === 'km' ? km : km / KM_PER_MI) * 1000) / 1000; calc(); } }, n)));
  const clearBtn = el('button', { class: 'btn ghost', onclick: () => { [distIn, th, tm, ts, pm, ps].forEach(i => (i.value = '')); ['dist', 'th', 'tm', 'ts', 'pm', 'ps'].forEach(k => s.del(k)); msg.textContent = ''; render(out); } }, 'Clear');

  render(root,
    el('div', { class: 'col' },
      el('div', { class: 'row' }, field('Distance', el('div', { class: 'row', style: { margin: 0 } }, distIn, unitSel)), presets),
      el('div', { class: 'row' },
        field('Time (h : min : sec)', el('div', { class: 'row', style: { margin: 0 } }, th, tm, ts)),
        field(paceLabel, el('div', { class: 'row', style: { margin: 0 } }, pm, ps))),
      el('div', { class: 'row' }, el('button', { class: 'btn primary', onclick: () => calc() }, 'Calculate'), clearBtn),
      msg, out),
    el('p', { class: 'muted small' }, 'Fill any two of distance, time and pace and leave the third empty. Inputs are remembered in this browser only.'));
  if (distIn.value || th.value || tm.value || ts.value || pm.value || ps.value) calc();
}
