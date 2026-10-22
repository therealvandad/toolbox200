// Volunteer shift scheduler: shifts with capacity, sign-ups, fill bars, conflict detection, CSV, share link + response codes.
import { el, render, store, copy, download, stat, field, uid, toast } from '../../lib/ui.js';
import { enc, dec, shareUrl, sharedData, leaveShared, h3, csvCell } from './_share.js';

const TOOL = 'volunteer-shifts';
const overlap = (a, b) => a.date === b.date && a.start < b.end && b.start < a.end;
const label = sh => `${sh.title || 'Shift'} · ${sh.date} ${sh.start}-${sh.end}`;
/** Pairs of overlapping shifts for each person. */
function conflicts(shifts) {
  const out = [];
  const people = new Set(shifts.flatMap(s => s.people));
  for (const p of people) {
    const mine = shifts.filter(s => s.people.includes(p));
    for (let i = 0; i < mine.length; i++) for (let j = i + 1; j < mine.length; j++) if (overlap(mine[i], mine[j])) out.push({ p, a: mine[i], b: mine[j] });
  }
  return out;
}

export default function (root) {
  const shared = sharedData(TOOL);
  const note = el('div', { class: 'muted small' }, 'How sharing works: no server. Shifts live in this browser. "Copy sign-up link" bakes the shifts and current names into a URL; volunteers pick shifts, get a short code, and send it back. Paste the codes under "Import responses" (full shifts are skipped; overlapping shifts for one person are highlighted as conflicts).');
  if (shared) return guestView(root, shared, note);

  const s = store(TOOL);
  const st = s.get('state', { title: '', shifts: [] });
  const save = () => s.set('state', st);
  const tIn = el('input', { class: 'input', placeholder: 'Shift (e.g. Registration desk)' }), dIn = el('input', { class: 'input', type: 'date' });
  const sIn = el('input', { class: 'input', type: 'time', value: '09:00' }), eIn = el('input', { class: 'input', type: 'time', value: '12:00' });
  const cIn = el('input', { class: 'input', type: 'number', min: 1, max: 500, value: 3, style: { width: '80px' } });
  const stats = el('div', { class: 'row' }), board = el('div', { class: 'col' }), conflictBox = el('div');
  const linkOut = el('input', { class: 'input grow mono small', readOnly: true, placeholder: 'Sign-up link appears here' });
  const codesTa = el('textarea', { class: 'textarea', style: { minHeight: '80px' }, placeholder: 'Paste response codes here (any whitespace between them)' });
  const importMsg = el('span', { class: 'small muted' });

  function addShift() {
    if (!dIn.value) { toast('Pick a date'); return; }
    if (eIn.value <= sIn.value) { toast('End time must be after start time'); return; }
    st.shifts.push({ id: uid(), title: tIn.value.trim(), date: dIn.value, start: sIn.value, end: eIn.value, cap: Math.max(1, +cIn.value || 1), people: [] });
    st.shifts.sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start)); save(); drawAll();
  }
  function signUp(sh, name) {
    name = name.trim(); if (!name) return 'Enter a name';
    if (sh.people.some(p => p.toLowerCase() === name.toLowerCase())) return 'Already signed up';
    if (sh.people.length >= sh.cap) return 'Shift is full';
    sh.people.push(name); return '';
  }
  function exportCsv() {
    const rows = [['Shift', 'Date', 'Start', 'End', 'Capacity', 'Filled', 'Volunteers']];
    for (const sh of st.shifts) rows.push([sh.title, sh.date, sh.start, sh.end, sh.cap, sh.people.length, sh.people.join('; ')]);
    download('volunteer-shifts.csv', rows.map(r => r.map(csvCell).join(',')).join('\n'), 'text/csv');
  }
  function importCodes() {
    let ok = 0, bad = 0, full = 0, dup = 0;
    for (const c of codesTa.value.split(/\s+/).filter(Boolean)) {
      try {
        const d = dec(c); if (d.t !== TOOL || !d.r || !d.r.n || !Array.isArray(d.r.ids)) throw 0;
        for (const id of d.r.ids) { const sh = st.shifts.find(x => x.id === id); if (!sh) continue; const err = signUp(sh, String(d.r.n).slice(0, 40)); if (!err) ok++; else if (err === 'Shift is full') full++; else dup++; }
      } catch { bad++; }
    }
    save(); codesTa.value = ''; drawAll(); importMsg.textContent = `${ok} sign-up(s) added` + (full ? `, ${full} skipped (full)` : '') + (dup ? `, ${dup} already there` : '') + (bad ? `, ${bad} invalid code(s)` : '');
  }

  function drawAll() {
    const cap = st.shifts.reduce((a, x) => a + x.cap, 0), filled = st.shifts.reduce((a, x) => a + x.people.length, 0), cf = conflicts(st.shifts);
    render(stats, stat(st.shifts.length, 'shifts'), stat(filled + '/' + cap, 'slots filled'), stat(new Set(st.shifts.flatMap(x => x.people.map(p => p.toLowerCase()))).size, 'volunteers'), stat(cf.length, 'conflicts'));
    render(conflictBox, cf.length ? el('div', { class: 'panel', style: { borderColor: 'var(--danger)' } }, el('b', {}, 'Conflicts'), cf.map(c => el('div', { class: 'small' }, `${c.p}: ${label(c.a)} overlaps ${label(c.b)}`))) : null);
    render(board, st.shifts.length ? st.shifts.map(sh => {
      const pct = Math.min(100, Math.round(sh.people.length / sh.cap * 100)), full = sh.people.length >= sh.cap;
      const nameIn = el('input', { class: 'input', placeholder: 'Name', style: { width: '140px' }, onkeydown: e => { if (e.key === 'Enter') add(); } });
      const err = el('span', { class: 'small', style: { color: 'var(--danger)' } });
      function add() { const m = signUp(sh, nameIn.value); if (m) { err.textContent = m; return; } save(); drawAll(); }
      return el('div', { class: 'panel' },
        el('div', { class: 'row', style: { margin: 0 } }, el('b', {}, sh.title || 'Shift'), el('span', { class: 'muted small' }, `${sh.date} · ${sh.start}-${sh.end}`), el('span', { class: 'grow' }),
          el('span', { class: 'badge ' + (full ? 'ok' : sh.people.length ? 'warn' : '') }, `${sh.people.length}/${sh.cap}` + (full ? ' full' : '')),
          el('button', { class: 'btn small ghost', onclick: () => { st.shifts = st.shifts.filter(x => x !== sh); save(); drawAll(); } }, 'Delete')),
        el('div', { class: 'bar', style: { margin: '6px 0' } }, el('div', { style: { width: pct + '%', background: full ? 'var(--ok)' : 'var(--accent)' } })),
        el('div', { class: 'row', style: { margin: '4px 0' } }, sh.people.map(p => {
          const clash = conflicts(st.shifts).some(c => c.p === p && (c.a === sh || c.b === sh));
          return el('span', { class: 'badge ' + (clash ? 'danger' : ''), title: clash ? 'Overlaps another shift' : '' }, p, ' ', el('a', { href: '#', onclick: e => { e.preventDefault(); sh.people = sh.people.filter(x => x !== p); save(); drawAll(); } }, '✕'));
        })),
        full ? null : el('div', { class: 'row', style: { margin: 0 } }, nameIn, el('button', { class: 'btn small', onclick: add }, 'Sign up'), err));
    }) : el('div', { class: 'muted small' }, 'No shifts yet. Add one below.'));
  }

  render(root, note,
    field('Event / roster name', el('input', { class: 'input', placeholder: 'Food bank weekend', value: st.title, oninput: e => { st.title = e.target.value; save(); } })),
    h3('Add a shift'), el('div', { class: 'row' }, tIn, dIn, field('Start', sIn), field('End', eIn), field('Spots', cIn), el('button', { class: 'btn primary', onclick: addShift }, 'Add shift')),
    h3('Roster'), stats, conflictBox, board,
    el('div', { class: 'row' }, el('button', { class: 'btn', onclick: exportCsv }, 'Export CSV')),
    h3('Share'), el('div', { class: 'row' }, el('button', { class: 'btn primary', onclick: () => { const u = shareUrl(TOOL, { n: st.title, s: st.shifts.map(x => [x.id, x.title, x.date, x.start, x.end, x.cap, x.people]) }); linkOut.value = u; copy(u); } }, 'Copy sign-up link'), linkOut),
    h3('Import responses'), codesTa, el('div', { class: 'row' }, el('button', { class: 'btn', onclick: importCodes }, 'Import codes'), importMsg));
  drawAll();
}

function guestView(root, d, note) {
  const shifts = (d.s || []).map(x => ({ id: x[0], title: x[1], date: x[2], start: x[3], end: x[4], cap: +x[5] || 1, people: Array.isArray(x[6]) ? x[6] : [] }));
  const picked = new Set(); const nameIn = el('input', { class: 'input', placeholder: 'Your name' });
  const warn = el('div', { class: 'small', style: { color: 'var(--danger)' } }), out = el('pre', { class: 'out hidden' });
  const copyBtn = el('button', { class: 'btn hidden', onclick: () => copy(out.textContent) }, 'Copy code');
  const checks = shifts.map(sh => {
    const full = sh.people.length >= sh.cap;
    const cb = el('input', { type: 'checkbox', disabled: full, onchange: () => { cb.checked ? picked.add(sh.id) : picked.delete(sh.id); const sel = shifts.filter(x => picked.has(x.id)); const bad = []; for (let i = 0; i < sel.length; i++) for (let j = i + 1; j < sel.length; j++) if (overlap(sel[i], sel[j])) bad.push(`${label(sel[i])} overlaps ${label(sel[j])}`); warn.textContent = bad.join('. '); } });
    return el('label', { class: 'panel inline', style: { display: 'flex', margin: '6px 0', opacity: full ? .55 : 1 } }, cb, el('span', { class: 'grow' }, el('b', {}, sh.title || 'Shift'), el('span', { class: 'muted small' }, `  ${sh.date} · ${sh.start}-${sh.end}`)), el('span', { class: 'badge ' + (full ? 'ok' : '') }, full ? 'full' : `${sh.cap - sh.people.length} spot(s) left`));
  });
  function gen() {
    const n = nameIn.value.trim(); if (!n) { toast('Please enter your name'); nameIn.focus(); return; }
    if (!picked.size) { toast('Pick at least one shift'); return; }
    out.textContent = enc({ t: TOOL, r: { n, ids: [...picked] } }); out.classList.remove('hidden'); copyBtn.classList.remove('hidden');
  }
  render(root, note, el('div', { class: 'big', style: { margin: '10px 0' } }, d.n || 'Volunteer sign-up'), el('div', { class: 'small muted' }, 'Tick the shifts you can work.'), checks, warn,
    el('div', { class: 'row' }, el('div', { style: { maxWidth: '240px' } }, field('Your name', nameIn)), el('button', { class: 'btn primary', onclick: gen }, 'Generate response code'), copyBtn), out,
    el('div', { class: 'small muted' }, 'Send the code to the organizer; they paste it in to confirm your shifts.'), el('div', { class: 'row' }, leaveShared()));
}
