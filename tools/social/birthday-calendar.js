// Office birthday calendar: people + birthdays, monthly view, next 14 days, ages, .ics export. Saved in this browser.
import { el, render, store, download, copy, field, uid, toast, pad } from '../../lib/ui.js';
import { h3 } from './_share.js';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const leap = y => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
/** Day of month the birthday is celebrated in a given year (Feb 29 -> Feb 28 in non-leap years). */
const dayIn = (p, y) => (p.m === 2 && p.d === 29 && !leap(y) ? 28 : p.d);
const dim = (y, m) => new Date(y, m, 0).getDate();
const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

function nextOccurrence(p, from) {
  const y = from.getFullYear();
  let d = new Date(y, p.m - 1, dayIn(p, y));
  if (d < new Date(y, from.getMonth(), from.getDate())) d = new Date(y + 1, p.m - 1, dayIn(p, y + 1));
  return d;
}

export default function (root) {
  const s = store('birthday-calendar');
  const st = s.get('state', { people: [] });
  const save = () => s.set('state', st);
  const now = new Date();
  let vy = now.getFullYear(), vm = now.getMonth() + 1;

  const nameIn = el('input', { class: 'input', placeholder: 'Name' });
  const monthSel = el('select', { class: 'select' }, MONTHS.map((m, i) => el('option', { value: i + 1 }, m)));
  const dayIn_ = el('input', { class: 'input', type: 'number', min: 1, max: 31, placeholder: 'Day', style: { width: '80px' } });
  const yearIn = el('input', { class: 'input', type: 'number', min: 1900, max: 2100, placeholder: 'Year (optional)', style: { width: '130px' } });
  const bulk = el('textarea', { class: 'textarea', style: { minHeight: '80px' }, placeholder: 'One per line: Name, 1990-05-12   or   Name, 05-12   or   Name, 12 May' });
  const msg = el('span', { class: 'small muted' });
  const upcoming = el('div'), cal = el('div'), listBox = el('div', { class: 'scroll-x' });
  const monthTitle = el('b', { style: { minWidth: '150px', textAlign: 'center' } });

  function addOne() {
    const name = nameIn.value.trim(), m = +monthSel.value, d = +dayIn_.value, y = yearIn.value ? +yearIn.value : 0;
    if (!name) { msg.textContent = 'Enter a name.'; return; }
    if (!(d >= 1 && d <= dim(2024, m))) { msg.textContent = 'That day does not exist in ' + MONTHS[m - 1] + '.'; return; }
    if (y && (y < 1900 || y > now.getFullYear() || (m === 2 && d === 29 && !leap(y)))) { msg.textContent = 'Check the year.'; return; }
    st.people.push({ id: uid(), name, m, d, y: y || 0 }); save(); nameIn.value = ''; dayIn_.value = ''; yearIn.value = ''; msg.textContent = 'Added.'; drawAll(); nameIn.focus();
  }
  function parseLine(line) {
    const i = line.lastIndexOf(','); if (i < 1) return null;
    const name = line.slice(0, i).trim(), t = line.slice(i + 1).trim(); let m, mm;
    if ((m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) return { name, y: +m[1], m: +m[2], d: +m[3] };
    if ((m = t.match(/^(\d{1,2})[-/](\d{1,2})$/))) return { name, y: 0, m: +m[1], d: +m[2] };
    if ((m = t.match(/^(\d{1,2})\s+([A-Za-z]+)(?:\s+(\d{4}))?$/)) && (mm = MONTHS.findIndex(x => x.toLowerCase().startsWith(m[2].toLowerCase().slice(0, 3))) + 1)) return { name, y: +(m[3] || 0), m: mm, d: +m[1] };
    return null;
  }
  function importBulk() {
    let ok = 0, bad = 0;
    for (const line of bulk.value.split('\n').map(x => x.trim()).filter(Boolean)) {
      const p = parseLine(line);
      if (p && p.m >= 1 && p.m <= 12 && p.d >= 1 && p.d <= dim(2024, p.m)) { st.people.push({ id: uid(), ...p }); ok++; } else bad++;
    }
    save(); bulk.value = ''; msg.textContent = `${ok} added${bad ? `, ${bad} line(s) not understood` : ''}`; drawAll();
  }

  const ageOn = (p, date) => p.y ? date.getFullYear() - p.y : null;

  function drawUpcoming() {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const list = st.people.map(p => ({ p, date: nextOccurrence(p, today) })).map(x => ({ ...x, days: Math.round((x.date - today) / 864e5) })).filter(x => x.days <= 14).sort((a, b) => a.days - b.days || a.p.name.localeCompare(b.p.name));
    render(upcoming, list.length ? el('ul', { class: 'list' }, list.map(({ p, date, days }) => el('li', {},
      el('span', { class: 'badge ' + (days === 0 ? 'ok' : days <= 3 ? 'warn' : '') }, days === 0 ? 'today' : days === 1 ? 'tomorrow' : 'in ' + days + ' days'),
      el('span', { class: 'grow' }, el('b', {}, p.name), '  ', date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })),
      p.y ? el('span', { class: 'muted' }, 'turns ' + ageOn(p, date)) : null))) : el('div', { class: 'muted small' }, st.people.length ? 'No birthdays in the next 14 days.' : 'Add people to see upcoming birthdays.'));
  }
  function drawCal() {
    monthTitle.textContent = MONTHS[vm - 1] + ' ' + vy;
    const first = new Date(vy, vm - 1, 1).getDay(), days = dim(vy, vm), cells = [];
    DOW.forEach(d => cells.push(el('div', { class: 'small muted', style: { aspectRatio: 'auto', border: 0, background: 'transparent' } }, d)));
    for (let i = 0; i < first; i++) cells.push(el('div', { style: { border: 0, background: 'transparent' } }));
    for (let d = 1; d <= days; d++) {
      const ps = st.people.filter(p => p.m === vm && dayIn(p, vy) === d), isToday = sameDay(new Date(vy, vm - 1, d), now);
      cells.push(el('div', { style: { aspectRatio: 'auto', minHeight: '64px', alignItems: 'flex-start', justifyContent: 'flex-start', flexDirection: 'column', padding: '3px 4px', overflow: 'hidden', borderColor: isToday ? 'var(--accent)' : '', background: ps.length ? 'color-mix(in srgb, var(--accent) 14%, var(--bg))' : '' } },
        el('span', { class: isToday ? 'badge ok' : 'muted' }, d),
        ps.map(p => el('span', { style: { fontSize: '11px', lineHeight: '1.2', wordBreak: 'break-word' }, title: p.y ? p.name + ' turns ' + (vy - p.y) : p.name }, '🎂 ' + p.name))));
    }
    render(cal, el('div', { class: 'cal', style: { gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' } }, cells));
  }
  function drawList() {
    const rows = [...st.people].sort((a, b) => a.m - b.m || a.d - b.d || a.name.localeCompare(b.name));
    render(listBox, rows.length ? el('table', { class: 'table' }, el('thead', {}, el('tr', {}, ['Name', 'Birthday', 'Age', ''].map(h => el('th', {}, h)))),
      el('tbody', {}, rows.map(p => el('tr', {}, el('td', {}, p.name), el('td', {}, MONTHS[p.m - 1].slice(0, 3) + ' ' + p.d + (p.y ? ', ' + p.y : '')), el('td', {}, p.y ? ageOn(p, new Date(now.getFullYear(), p.m - 1, p.d)) - (new Date(now.getFullYear(), p.m - 1, p.d) > now ? 1 : 0) : ''),
        el('td', {}, el('button', { class: 'btn small ghost', onclick: () => { st.people = st.people.filter(x => x !== p); save(); drawAll(); } }, '✕')))))) : el('div', { class: 'muted small' }, 'Nobody added yet.'));
  }
  function drawAll() { drawUpcoming(); drawCal(); drawList(); }

  function exportIcs() {
    if (!st.people.length) { toast('Add people first'); return; }
    const esc = t => String(t).replace(/([,;\\])/g, '\\$1');
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const out = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Toolbox 200//Birthdays//EN', 'CALSCALE:GREGORIAN'];
    for (const p of st.people) {
      const y = p.y || now.getFullYear(), start = `${y}${pad(p.m)}${pad(p.d)}`, nd = new Date(y, p.m - 1, p.d + 1), end = `${nd.getFullYear()}${pad(nd.getMonth() + 1)}${pad(nd.getDate())}`;
      out.push('BEGIN:VEVENT', `UID:${p.id}@toolbox200`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${start}`, `DTEND;VALUE=DATE:${end}`, 'RRULE:FREQ=YEARLY', `SUMMARY:${esc(p.name)}'s birthday`, 'TRANSP:TRANSPARENT', 'END:VEVENT');
    }
    out.push('END:VCALENDAR');
    download('birthdays.ics', out.join('\r\n'), 'text/calendar');
  }
  const nav = d => { vm += d; if (vm < 1) { vm = 12; vy--; } if (vm > 12) { vm = 1; vy++; } drawCal(); };

  render(root,
    el('div', { class: 'muted small' }, 'Local tool: birthdays are stored in this browser only. Export .ics to import them into Google, Apple or Outlook calendars (repeats yearly).'),
    h3('Next 14 days'), upcoming,
    h3('Month'),
    el('div', { class: 'row' }, el('button', { class: 'btn small', onclick: () => nav(-1) }, '←'), monthTitle, el('button', { class: 'btn small', onclick: () => nav(1) }, '→'), el('button', { class: 'btn small ghost', onclick: () => { vy = now.getFullYear(); vm = now.getMonth() + 1; drawCal(); } }, 'This month')),
    cal,
    h3('Add a person'),
    el('div', { class: 'row' }, nameIn, monthSel, dayIn_, yearIn, el('button', { class: 'btn primary', onclick: addOne }, 'Add')),
    el('details', {}, el('summary', { class: 'small muted' }, 'Paste several at once'), bulk, el('div', { class: 'row' }, el('button', { class: 'btn', onclick: importBulk }, 'Import lines'))),
    msg,
    h3('Everyone'), listBox,
    el('div', { class: 'row' }, el('button', { class: 'btn primary', onclick: exportIcs }, 'Export .ics'),
      el('button', { class: 'btn ghost', onclick: () => copy([...st.people].sort((a, b) => a.m - b.m || a.d - b.d).map(p => `${p.name}, ${p.y ? p.y + '-' : ''}${pad(p.m)}-${pad(p.d)}`).join('\n')) }, 'Copy list')));
  nameIn.addEventListener('keydown', e => { if (e.key === 'Enter') addOne(); });
  drawAll();
}
