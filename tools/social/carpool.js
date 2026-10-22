// Carpool organizer: drivers with seats/area/days, riders, assignment, remaining seats per weekday, read-only summary link.
import { el, render, store, copy, field, uid, toast } from '../../lib/ui.js';
import { shareUrl, sharedData, leaveShared, h3 } from './_share.js';

const TOOL = 'carpool';
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEK = [false, true, true, true, true, true, false];
const toMask = a => a.reduce((m, on, i) => m | (on ? 1 << i : 0), 0);
const fromMask = m => DAYS.map((_, i) => !!(m & (1 << i)));

/** Remaining seats per weekday for a driver (null on days the driver does not drive). */
function seatsLeft(d, riders) { return DAYS.map((_, i) => d.days[i] ? d.seats - riders.filter(r => r.driver === d.id && r.days[i]).length : null); }
function issues(r, d, riders) {
  if (!d) return [];
  const out = [];
  r.days.forEach((on, i) => { if (on && !d.days[i]) out.push(`${d.name} does not drive on ${DAYS[i]}`); });
  const left = seatsLeft(d, riders); left.forEach((n, i) => { if (n != null && n < 0 && r.days[i]) out.push(`car is over capacity on ${DAYS[i]}`); });
  return out;
}
function summaryText(st) {
  const lines = [st.title || 'Carpool'];
  for (const d of st.drivers) {
    const rs = st.riders.filter(r => r.driver === d.id);
    lines.push(`${d.name} (${d.area || 'no area'}, ${d.seats} seats${d.time ? ', leaves ' + d.time : ''}; ${DAYS.filter((_, i) => d.days[i]).join('/') || 'no days'}): ${rs.map(r => `${r.name} [${DAYS.filter((_, i) => r.days[i]).join('/')}]`).join(', ') || 'no riders'}`);
  }
  const un = st.riders.filter(r => !st.drivers.some(d => d.id === r.driver));
  if (un.length) lines.push('Needs a ride: ' + un.map(r => r.name).join(', '));
  return lines.join('\n');
}

export default function (root) {
  const shared = sharedData(TOOL);
  const note = el('div', { class: 'muted small' }, 'How sharing works: no server. The carpool lives in this browser. "Copy summary link" bakes a read-only snapshot into a URL; whoever opens it sees the cars and riders. To change anything, edit here and send a new link.');
  if (shared) return summaryView(root, shared, note);

  const s = store(TOOL);
  const st = s.get('state', { title: '', drivers: [], riders: [] });
  const save = () => s.set('state', st);
  const dName = el('input', { class: 'input', placeholder: 'Driver name' }), dSeats = el('input', { class: 'input', type: 'number', min: 1, max: 12, value: 4, style: { width: '80px' } });
  const dArea = el('input', { class: 'input', placeholder: 'Area / pickup' }), dTime = el('input', { class: 'input', type: 'time' });
  const rName = el('input', { class: 'input', placeholder: 'Rider name' }), rArea = el('input', { class: 'input', placeholder: 'Area / pickup' });
  let dDays = [...WEEK], rDays = [...WEEK];
  const dDaysBox = el('div', { class: 'row' }), rDaysBox = el('div', { class: 'row' });
  const dayChecks = (box, arr) => render(box, DAYS.map((d, i) => el('label', { class: 'inline' }, el('input', { type: 'checkbox', checked: arr[i], onchange: e => { arr[i] = e.target.checked; } }), d)));
  const carsBox = el('div', { class: 'col' }), ridersBox = el('div', { class: 'scroll-x' });
  const linkOut = el('input', { class: 'input grow mono small', readOnly: true, placeholder: 'Summary link appears here' });

  function addDriver() {
    const name = dName.value.trim(); if (!name) { toast('Driver name needed'); return; }
    st.drivers.push({ id: uid(), name, seats: Math.max(1, +dSeats.value || 1), area: dArea.value.trim(), time: dTime.value, days: [...dDays] });
    dName.value = ''; save(); drawAll();
  }
  function addRider() {
    const names = rName.value.split(/[,;\n]/).map(x => x.trim()).filter(Boolean); if (!names.length) { toast('Rider name needed'); return; }
    for (const name of names) st.riders.push({ id: uid(), name, area: rArea.value.trim(), days: [...rDays], driver: null });
    rName.value = ''; save(); drawAll();
  }
  function autoAssign() {
    let n = 0;
    for (const r of st.riders.filter(r => !st.drivers.some(d => d.id === r.driver))) {
      const ok = st.drivers.filter(d => r.days.every((on, i) => !on || (d.days[i] && seatsLeft(d, st.riders)[i] > 0)));
      ok.sort((a, b) => (norm(b.area) === norm(r.area) && r.area ? 1 : 0) - (norm(a.area) === norm(r.area) && r.area ? 1 : 0));
      if (ok[0]) { r.driver = ok[0].id; n++; }
    }
    save(); drawAll(); toast(n ? `Assigned ${n} rider(s)` : 'No rider could be matched');
  }
  const norm = t => String(t || '').trim().toLowerCase();

  function drawAll() {
    render(carsBox, st.drivers.length ? st.drivers.map(d => {
      const left = seatsLeft(d, st.riders), rs = st.riders.filter(r => r.driver === d.id);
      return el('div', { class: 'panel' },
        el('div', { class: 'row', style: { margin: 0 } }, el('b', {}, d.name), el('span', { class: 'muted small' }, `${d.area || 'no area'}${d.time ? ' · leaves ' + d.time : ''} · ${d.seats} seats`), el('span', { class: 'grow' }),
          el('button', { class: 'btn small ghost', onclick: () => { st.riders.forEach(r => { if (r.driver === d.id) r.driver = null; }); st.drivers = st.drivers.filter(x => x !== d); save(); drawAll(); } }, 'Remove')),
        el('div', { class: 'row' }, DAYS.map((n, i) => el('span', { class: 'badge ' + (left[i] == null ? '' : left[i] < 0 ? 'danger' : left[i] === 0 ? 'warn' : 'ok'), title: left[i] == null ? 'Not driving' : left[i] + ' seat(s) left' }, n + (left[i] == null ? ' –' : ' ' + left[i])))),
        el('div', { class: 'small muted' }, rs.length ? 'Riders: ' + rs.map(r => r.name).join(', ') : 'No riders assigned'));
    }) : el('div', { class: 'muted small' }, 'No drivers yet.'));
    render(ridersBox, st.riders.length ? el('table', { class: 'table' }, el('thead', {}, el('tr', {}, el('th', {}, 'Rider'), el('th', {}, 'Area'), el('th', {}, 'Days'), el('th', {}, 'Car'), el('th', {}, ''))),
      el('tbody', {}, st.riders.map(r => {
        const d = st.drivers.find(x => x.id === r.driver), prob = issues(r, d, st.riders);
        return el('tr', {}, el('td', {}, r.name), el('td', { class: 'small muted' }, r.area),
          el('td', {}, el('div', { class: 'row', style: { margin: 0, gap: '4px' } }, DAYS.map((n, i) => el('label', { class: 'small inline', style: { gap: '2px' } }, el('input', { type: 'checkbox', checked: r.days[i], onchange: e => { r.days[i] = e.target.checked; save(); drawAll(); } }), n[0])))),
          el('td', {}, el('select', { class: 'select', onchange: e => { r.driver = e.target.value || null; save(); drawAll(); } }, el('option', { value: '' }, '(unassigned)'), st.drivers.map(x => el('option', { value: x.id, selected: x.id === r.driver }, x.name))),
            prob.map(p => el('div', { class: 'small', style: { color: 'var(--danger)' } }, p))),
          el('td', {}, el('button', { class: 'btn small ghost', onclick: () => { st.riders = st.riders.filter(x => x !== r); save(); drawAll(); } }, '✕')));
      }))) : el('div', { class: 'muted small' }, 'No riders yet.'));
  }
  dayChecks(dDaysBox, dDays); dayChecks(rDaysBox, rDays);

  render(root, note,
    field('Carpool name', el('input', { class: 'input', placeholder: 'Morning commute', value: st.title, oninput: e => { st.title = e.target.value; save(); } })),
    h3('Add a driver'), el('div', { class: 'row' }, dName, dArea, field('Seats (riders)', dSeats), field('Leaves at', dTime)), dDaysBox, el('div', { class: 'row' }, el('button', { class: 'btn primary', onclick: addDriver }, 'Add driver')),
    h3('Add riders'), el('div', { class: 'row' }, rName, rArea), rDaysBox, el('div', { class: 'row' }, el('button', { class: 'btn primary', onclick: addRider }, 'Add rider(s)'), el('span', { class: 'small muted' }, 'Separate several names with commas.')),
    h3('Cars (seats left per weekday)'), carsBox,
    h3('Riders'), el('div', { class: 'row' }, el('button', { class: 'btn', onclick: autoAssign }, 'Auto-assign unassigned riders')), ridersBox,
    h3('Share'),
    el('div', { class: 'row' }, el('button', { class: 'btn primary', onclick: () => { const u = shareUrl(TOOL, { n: st.title, d: st.drivers.map(d => [d.name, d.seats, d.area, d.time, toMask(d.days)]), r: st.riders.map(r => [r.name, r.area, toMask(r.days), st.drivers.findIndex(d => d.id === r.driver)]) }); linkOut.value = u; copy(u); } }, 'Copy summary link'), linkOut,
      el('button', { class: 'btn', onclick: () => copy(summaryText(st)) }, 'Copy as text')));
  drawAll();
}

function summaryView(root, d, note) {
  const st = { title: d.n || '', drivers: (d.d || []).map((x, i) => ({ id: 'd' + i, name: x[0], seats: x[1], area: x[2], time: x[3], days: fromMask(x[4]) })), riders: (d.r || []).map((x, i) => ({ id: 'r' + i, name: x[0], area: x[1], days: fromMask(x[2]), driver: x[3] >= 0 ? 'd' + x[3] : null })) };
  const un = st.riders.filter(r => !st.drivers.some(x => x.id === r.driver));
  render(root, note, el('div', { class: 'big', style: { margin: '10px 0' } }, st.title || 'Carpool'),
    el('div', { class: 'col' }, st.drivers.map(dr => {
      const left = seatsLeft(dr, st.riders), rs = st.riders.filter(r => r.driver === dr.id);
      return el('div', { class: 'panel' }, el('b', {}, dr.name), el('span', { class: 'muted small' }, `  ${dr.area || ''}${dr.time ? ' · leaves ' + dr.time : ''} · ${dr.seats} seats`),
        el('div', { class: 'row' }, DAYS.map((n, i) => el('span', { class: 'badge ' + (left[i] == null ? '' : left[i] <= 0 ? 'warn' : 'ok') }, n + (left[i] == null ? ' –' : ' ' + left[i] + ' free')))),
        el('div', {}, rs.length ? rs.map(r => el('div', {}, r.name, el('span', { class: 'muted small' }, '  ' + DAYS.filter((_, i) => r.days[i]).join(' ')))) : el('span', { class: 'muted small' }, 'No riders yet')));
    })),
    un.length ? el('div', { class: 'panel', style: { marginTop: '10px' } }, el('b', {}, 'Still needs a ride: '), un.map(r => r.name).join(', ')) : null,
    el('div', { class: 'row' }, el('button', { class: 'btn', onclick: () => copy(summaryText(st)) }, 'Copy as text'), leaveShared()));
}
