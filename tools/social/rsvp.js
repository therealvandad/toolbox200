// RSVP page: organizer builds the event + guest list; guests open the share link, fill a form and send back a code.
import { el, render, store, copy, stat, field, uid, toast } from '../../lib/ui.js';

const TOOL = 'rsvp';
function enc(o) { const b = new TextEncoder().encode(JSON.stringify(o)); let s = ''; for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function dec(t) { const s = atob(t.trim().replace(/-/g, '+').replace(/_/g, '/')); const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return JSON.parse(new TextDecoder().decode(b)); }
function shareUrl(data) { return location.origin + location.pathname + '?s=' + enc({ t: TOOL, ...data }) + '#/tool/' + TOOL; }
function sharedData() { try { const q = new URLSearchParams(location.search).get('s'); if (!q) return null; const d = dec(q); return d.t === TOOL ? d : null; } catch { return null; } }
const STATUS = ['pending', 'yes', 'no', 'maybe'];
const badgeClass = { yes: 'badge ok', no: 'badge danger', maybe: 'badge warn', pending: 'badge' };

export default function (root) {
  const s = store(TOOL);
  const st = s.get('state', { event: { title: '', date: '', time: '', location: '', notes: '' }, guests: [] });
  const save = () => s.set('state', st);
  const shared = sharedData();
  const note = el('div', { class: 'muted small' }, 'How sharing works: there is no server. Everything lives in this browser. "Copy guest link" puts the event in a URL; guests open it, answer, and send you a short response code (by text or email) which you paste below to import.');

  if (shared) return guestView(root, shared, note);

  // ---------- organizer ----------
  const ev = st.event;
  const inp = (k, ph, type = 'text') => el('input', { class: 'input', type, placeholder: ph, value: ev[k] || '', oninput: e => { ev[k] = e.target.value; save(); } });
  const evForm = el('div', { class: 'grid2' },
    field('Event title', inp('title', 'Summer BBQ')),
    field('Location', inp('location', 'Riverside park, shelter 3')),
    field('Date', inp('date', '', 'date')),
    field('Time', inp('time', '', 'time')),
    field('Notes for guests', el('textarea', { class: 'textarea prose', style: { minHeight: '70px' }, placeholder: 'Bring a chair…', value: ev.notes || '', oninput: e => { ev.notes = e.target.value; save(); } })));

  const nameIn = el('input', { class: 'input grow', placeholder: 'Guest name (Enter to add)', onkeydown: e => { if (e.key === 'Enter') addGuest(); if (e.key === 'Escape') nameIn.value = ''; } });
  function addGuest() {
    const names = nameIn.value.split(/[,;\n]/).map(x => x.trim()).filter(Boolean);
    for (const name of names) if (!st.guests.some(g => g.name.toLowerCase() === name.toLowerCase())) st.guests.push({ id: uid(), name, status: 'pending', diet: '', plus: 0, note: '' });
    nameIn.value = ''; save(); draw();
  }
  const counts = el('div', { class: 'row' });
  const table = el('div', { class: 'scroll-x' });
  const dietSummary = el('div', { class: 'small muted' });
  const codesTa = el('textarea', { class: 'textarea', style: { minHeight: '80px' }, placeholder: 'Paste one or more response codes here (any whitespace between them)' });
  const importMsg = el('span', { class: 'small muted' });
  const linkOut = el('input', { class: 'input grow mono small', readOnly: true, placeholder: 'Guest link appears here' });

  function importCodes() {
    const codes = codesTa.value.split(/\s+/).filter(Boolean); let ok = 0, bad = 0;
    for (const c of codes) {
      try {
        const d = dec(c); if (d.t !== TOOL || !d.r || !d.r.name) throw 0;
        const r = d.r; let g = st.guests.find(x => x.name.toLowerCase() === r.name.trim().toLowerCase());
        if (!g) { g = { id: uid(), name: r.name.trim() }; st.guests.push(g); }
        g.status = STATUS.includes(r.status) ? r.status : 'pending'; g.diet = String(r.diet || ''); g.plus = Math.max(0, +r.plus || 0); g.note = String(r.note || ''); ok++;
      } catch { bad++; }
    }
    save(); draw(); codesTa.value = ''; importMsg.textContent = `${ok} imported${bad ? `, ${bad} invalid` : ''}`;
  }

  function draw() {
    const n = k => st.guests.filter(g => g.status === k).length;
    const head = st.guests.filter(g => g.status === 'yes').reduce((a, g) => a + 1 + (+g.plus || 0), 0);
    render(counts, stat(st.guests.length, 'invited'), stat(n('yes'), 'yes'), stat(n('no'), 'no'), stat(n('maybe'), 'maybe'), stat(n('pending'), 'no reply'), stat(head, 'headcount (yes + plus-ones)'));
    const diets = {}; for (const g of st.guests) if (g.status !== 'no' && g.diet) for (const d of g.diet.split(/[,;]/).map(x => x.trim().toLowerCase()).filter(Boolean)) diets[d] = (diets[d] || 0) + 1 + (+g.plus || 0);
    render(dietSummary, Object.keys(diets).length ? 'Dietary: ' + Object.entries(diets).map(([k, v]) => `${k} ×${v}`).join(', ') : 'No dietary preferences recorded.');
    if (!st.guests.length) { render(table, el('div', { class: 'muted small' }, 'No guests yet. Add names above.')); return; }
    render(table, el('table', { class: 'table' },
      el('thead', {}, el('tr', {}, el('th', {}, 'Guest'), el('th', {}, 'Status'), el('th', {}, 'Dietary'), el('th', {}, 'Plus-ones'), el('th', {}, 'Note'), el('th', {}, ''))),
      el('tbody', {}, st.guests.map(g => el('tr', {},
        el('td', {}, el('span', { class: badgeClass[g.status], style: { marginRight: '6px' } }, g.status), g.name),
        el('td', {}, el('select', { class: 'select', value: g.status, onchange: e => { g.status = e.target.value; save(); draw(); } }, STATUS.map(x => el('option', { value: x, selected: x === g.status }, x)))),
        el('td', {}, el('input', { class: 'input', style: { width: '130px' }, value: g.diet || '', placeholder: 'vegan, nut-free', oninput: e => { g.diet = e.target.value; save(); } , onblur: draw })),
        el('td', {}, el('input', { class: 'input', type: 'number', min: 0, max: 20, style: { width: '70px' }, value: g.plus || 0, oninput: e => { g.plus = Math.max(0, +e.target.value || 0); save(); }, onblur: draw })),
        el('td', { class: 'small muted' }, g.note || ''),
        el('td', {}, el('button', { class: 'btn small ghost', title: 'Remove', onclick: () => { st.guests = st.guests.filter(x => x !== g); save(); draw(); } }, '✕')))))));
  }

  render(root, note,
    el('h3', { style: { margin: '12px 0 6px' } }, 'Event'), evForm,
    el('h3', { style: { margin: '16px 0 6px' } }, 'Guests'),
    el('div', { class: 'row' }, nameIn, el('button', { class: 'btn primary', onclick: addGuest }, 'Add')),
    counts, table, dietSummary,
    el('h3', { style: { margin: '16px 0 6px' } }, 'Share'),
    el('div', { class: 'row' },
      el('button', { class: 'btn primary', onclick: () => { const url = shareUrl({ event: st.event, names: st.guests.map(g => g.name) }); linkOut.value = url; copy(url); } }, 'Copy guest link'),
      linkOut),
    el('h3', { style: { margin: '16px 0 6px' } }, 'Import responses'),
    codesTa,
    el('div', { class: 'row' }, el('button', { class: 'btn', onclick: importCodes }, 'Import codes'), importMsg,
      el('span', { class: 'grow' }),
      el('button', { class: 'btn ghost small', onclick: () => copy(st.guests.map(g => `${g.name}\t${g.status}\t${g.diet || ''}\t+${g.plus || 0}\t${g.note || ''}`).join('\n')) }, 'Copy list as text')));
  draw();
}

// ---------- guest ----------
function guestView(root, d, note) {
  const ev = d.event || {}; const names = d.names || [];
  const s = store(TOOL + '-guest');
  const prev = s.get('reply', {});
  const nameIn = el('input', { class: 'input', list: 'rsvp-names-' + uid(), placeholder: 'Your name', value: prev.name || '' });
  const dl = el('datalist', { id: nameIn.getAttribute('list') }, names.map(n => el('option', { value: n })));
  let status = prev.status || 'yes';
  const statusBtns = el('div', { class: 'row' });
  const drawStatus = () => render(statusBtns, ['yes', 'no', 'maybe'].map(x => el('button', { class: 'btn' + (status === x ? ' primary' : ''), onclick: () => { status = x; drawStatus(); } }, x === 'yes' ? 'Yes, I will come' : x === 'no' ? 'No, sorry' : 'Maybe')));
  drawStatus();
  const diet = el('input', { class: 'input', placeholder: 'vegetarian, gluten-free…', value: prev.diet || '' });
  const plus = el('input', { class: 'input', type: 'number', min: 0, max: 20, value: prev.plus || 0, style: { width: '90px' } });
  const noteIn = el('input', { class: 'input', placeholder: 'Anything else for the host', value: prev.note || '' });
  const out = el('pre', { class: 'out hidden' });
  const copyBtn = el('button', { class: 'btn hidden', onclick: () => copy(out.textContent) }, 'Copy code');
  function gen() {
    if (!nameIn.value.trim()) { toast('Please enter your name'); nameIn.focus(); return; }
    const r = { name: nameIn.value.trim(), status, diet: diet.value.trim(), plus: +plus.value || 0, note: noteIn.value.trim() };
    s.set('reply', r);
    out.textContent = enc({ t: TOOL, r }); out.classList.remove('hidden'); copyBtn.classList.remove('hidden');
  }
  const when = [ev.date, ev.time].filter(Boolean).join(' at ');
  render(root, note,
    el('div', { class: 'panel', style: { margin: '10px 0' } },
      el('div', { class: 'big' }, ev.title || 'You are invited'),
      when ? el('div', {}, '📅 ', when) : null,
      ev.location ? el('div', {}, '📍 ', ev.location) : null,
      ev.notes ? el('div', { class: 'muted', style: { marginTop: '6px', whiteSpace: 'pre-wrap' } }, ev.notes) : null),
    el('div', { class: 'col', style: { maxWidth: '520px' } },
      field('Your name', el('div', {}, nameIn, dl)), field('Will you come?', statusBtns),
      field('Dietary preferences', diet), field('Plus-ones (extra people you bring)', plus), field('Note', noteIn),
      el('div', { class: 'row' }, el('button', { class: 'btn primary', onclick: gen }, 'Generate response code'), copyBtn)),
    out,
    el('div', { class: 'muted small' }, 'Send the code to the organizer; they paste it to record your answer.'),
    el('div', { class: 'row' }, el('button', { class: 'btn ghost small', onclick: () => { history.replaceState(null, '', location.pathname + location.hash); dispatchEvent(new HashChangeEvent('hashchange')); } }, 'I am the organizer — open my own page')));
}
