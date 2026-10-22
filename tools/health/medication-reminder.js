// Medication reminder: medicines with dose, times per day, start date, pill count; today's schedule with ticks;
// refill date; reminders via Notification (or on-page toast) while this page is open.
import { el, render, store, uid, today, toast, stat, field, pad } from '../../lib/ui.js';

export default function (root) {
  const s = store('medication-reminder');
  let meds = s.get('meds', []);          // {id, name, dose, times:['08:00'], start, pills, perDose}
  let taken = s.get('taken', {});        // date -> { 'medId@HH:MM': true }
  let notified = {};                     // runtime only: 'date|medId|time'
  let timer = null, lastMin = -1;
  const hasNotif = typeof Notification !== 'undefined';

  const save = () => { s.set('meds', meds); s.set('taken', taken); };
  const nowHM = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
  const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const parseTimes = str => [...new Set(String(str).split(/[,;\s]+/).map(t => t.trim()).filter(t => /^\d{1,2}:\d{2}$/.test(t)).map(t => { const [h, m] = t.split(':').map(Number); return h < 24 && m < 60 ? `${pad(h)}:${pad(m)}` : null; }).filter(Boolean))].sort();
  const addDays = (dateStr, n) => { const d = new Date(dateStr + 'T12:00:00'); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

  const nameIn = el('input', { class: 'input', placeholder: 'Medicine name' });
  const doseIn = el('input', { class: 'input', placeholder: 'Dose (e.g. 500 mg)', style: { width: '140px' } });
  const timesIn = el('input', { class: 'input', placeholder: '08:00, 20:00', value: '08:00', style: { width: '150px' }, title: 'Times of day, 24-hour HH:MM, separated by commas' });
  const startIn = el('input', { class: 'input', type: 'date', value: today() });
  const pillsIn = el('input', { class: 'input', type: 'number', min: 0, placeholder: 'pills left', style: { width: '100px' } });
  const perIn = el('input', { class: 'input', type: 'number', min: 0.25, step: 0.25, value: 1, style: { width: '80px' }, title: 'Pills per dose' });
  const schedule = el('div', { class: 'col' });
  const medList = el('div', { class: 'scroll-x' });
  const stats = el('div', { class: 'row' });
  const status = el('div', { class: 'muted small' });

  function addMed() {
    const name = nameIn.value.trim(), times = parseTimes(timesIn.value);
    if (!name) { toast('Enter a medicine name'); return; }
    if (!times.length) { toast('Enter at least one time like 08:00'); return; }
    meds.push({ id: uid(), name, dose: doseIn.value.trim(), times, start: startIn.value || today(), pills: pillsIn.value === '' ? null : Math.max(0, +pillsIn.value), perDose: Math.max(0.25, +perIn.value || 1) });
    nameIn.value = doseIn.value = pillsIn.value = ''; save(); update(); toast('Medicine added');
  }

  function toggle(m, t, on) {
    const k = today(), key = `${m.id}@${t}`;
    const day = (taken[k] ||= {});
    if (on && !day[key]) { day[key] = true; if (m.pills != null) m.pills = Math.max(0, Math.round((m.pills - m.perDose) * 100) / 100); }
    if (!on && day[key]) { delete day[key]; if (m.pills != null) m.pills = Math.round((m.pills + m.perDose) * 100) / 100; }
    save(); update();
  }

  function refillInfo(m) {
    if (m.pills == null) return null;
    const perDay = m.times.length * m.perDose;
    if (!perDay) return null;
    const daysLeft = Math.floor(m.pills / perDay);
    return { daysLeft, date: addDays(today(), daysLeft) };
  }

  function activeToday() { return meds.filter(m => m.start <= today()); }

  function update() { renderSchedule(); renderMeds(); }
  function renderSchedule() {
    const k = today(), day = taken[k] || {}, nm = nowHM();
    const rows = [];
    activeToday().forEach(m => m.times.forEach(t => rows.push({ m, t })));
    rows.sort((a, b) => (a.t < b.t ? -1 : a.t > b.t ? 1 : a.m.name.localeCompare(b.m.name)));
    const doneN = rows.filter(r => day[`${r.m.id}@${r.t}`]).length;
    render(schedule, rows.length ? el('ul', { class: 'list' }, rows.map(({ m, t }) => {
      const isTaken = !!day[`${m.id}@${t}`], late = !isTaken && toMin(t) < nm;
      return el('li', {},
        el('input', { type: 'checkbox', checked: isTaken, onchange: e => toggle(m, t, e.target.checked) }),
        el('span', { class: 'mono', style: { minWidth: '48px' } }, t),
        el('span', { class: 'grow', style: { textDecoration: isTaken ? 'line-through' : 'none', opacity: isTaken ? 0.6 : 1 } }, m.name, m.dose && el('span', { class: 'muted small' }, ' · ' + m.dose)),
        isTaken ? el('span', { class: 'badge ok' }, 'taken') : late ? el('span', { class: 'badge warn' }, 'overdue') : el('span', { class: 'badge' }, 'upcoming'));
    })) : el('div', { class: 'muted' }, meds.length ? 'Nothing scheduled today (check start dates).' : 'Add a medicine below to build today\'s schedule.'));

    const low = meds.filter(m => { const r = refillInfo(m); return r && r.daysLeft <= 7; }).length;
    render(stats, stat(`${doneN}/${rows.length}`, 'doses taken today'), stat(meds.length, 'medicines'), stat(low, 'need refill within 7 days'));

  }
  function renderMeds() {
    render(medList, meds.length ? el('table', { class: 'table' }, el('thead', {}, el('tr', {}, ['Medicine', 'Times', 'Per dose', 'Pills left', 'Refill by', 'Started', ''].map(h => el('th', {}, h)))),
      el('tbody', {}, meds.map(m => {
        const r = refillInfo(m);
        return el('tr', {}, el('td', {}, m.name + (m.dose ? ` (${m.dose})` : '')), el('td', {}, m.times.join(', ')), el('td', {}, m.perDose),
          el('td', {}, m.pills == null ? '–' : el('input', { class: 'input', type: 'number', min: 0, value: m.pills, style: { width: '80px' }, onchange: e => { m.pills = Math.max(0, +e.target.value || 0); save(); update(); } })),
          el('td', {}, r ? el('span', { class: 'badge ' + (r.daysLeft <= 3 ? 'danger' : r.daysLeft <= 7 ? 'warn' : 'ok') }, r.daysLeft <= 0 ? 'now' : `${r.date} (${r.daysLeft} d)`) : '–'),
          el('td', {}, m.start),
          el('td', {}, el('button', { class: 'btn small ghost', onclick: () => { meds = meds.filter(x => x.id !== m.id); save(); update(); } }, '✕')));
      }))) : el('div', { class: 'muted small' }, 'No medicines yet.'));
  }

  // ---- reminders ----
  function notify(m, t) {
    const msg = `${m.name}${m.dose ? ' ' + m.dose : ''} - scheduled ${t}`;
    if (hasNotif && Notification.permission === 'granted') { try { new Notification('Medication reminder', { body: msg }); } catch {} }
    toast('Time to take: ' + msg, 6000);
  }
  function check() {
    const k = today(), nm = nowHM(), day = taken[k] || {};
    let changed = false;
    activeToday().forEach(m => m.times.forEach(t => {
      const id = `${k}|${m.id}|${t}`;
      const diff = nm - toMin(t);
      if (diff >= 0 && diff < 10 && !day[`${m.id}@${t}`] && !notified[id]) { notified[id] = 1; notify(m, t); changed = true; }
    }));
    if (changed || nm !== lastMin) { lastMin = nm; renderSchedule(); }     // refresh overdue badges
  }
  function setStatus() {
    status.textContent = !hasNotif ? 'System notifications are not supported here; reminders appear as on-page messages.'
      : Notification.permission === 'granted' ? 'Notifications on. Reminders only fire while this page stays open.'
        : Notification.permission === 'denied' ? 'Notifications are blocked in browser settings; on-page messages will be used.'
          : 'Reminders appear as on-page messages. Enable notifications for system alerts. They only fire while this page is open.';
  }

  render(root,
    stats,
    el('h3', {}, "Today's schedule"), schedule,
    el('div', { class: 'row' },
      hasNotif && Notification.permission === 'default' && el('button', { class: 'btn small', onclick: async () => { try { await Notification.requestPermission(); } catch {} setStatus(); } }, 'Enable notifications'),
      status),
    el('h3', {}, 'Add a medicine'),
    el('div', { class: 'row' }, nameIn, doseIn, field('Times (HH:MM, comma separated)', timesIn), field('Start date', startIn), field('Pills in stock', pillsIn), field('Pills per dose', perIn),
      el('button', { class: 'btn primary', onclick: addMed, style: { alignSelf: 'flex-end' } }, 'Add')),
    el('h3', {}, 'Medicines and refills'), medList,
    el('p', { class: 'muted small' }, 'Ticking a dose subtracts the pills per dose from your stock; unticking adds it back. This is a memory aid only, not medical advice. Everything stays in this browser.'));
  setStatus(); update(); check();
  timer = setInterval(check, 30000);
  return () => clearInterval(timer);
}
