// Book club: nominations with votes by member, meetings with host and notes, reading progress per member, current-book banner.
import { el, render, store, copy, field, uid, toast } from '../../lib/ui.js';
import { h3 } from './_share.js';

export default function (root) {
  const s = store('book-club');
  const st = s.get('state', { members: [], noms: [], current: null, meetings: [], progress: {} });
  const save = () => s.set('state', st);
  let voter = s.get('voter', '');
  const note = el('div', { class: 'muted small' }, 'Local tool: the club lives in this browser (localStorage), so use it on one shared screen or export the notes. Pick who you are under "Voting as" to cast votes.');

  const banner = el('div'), memberBox = el('div', { class: 'row' }), voterSel = el('select', { class: 'select', onchange: e => { voter = e.target.value; s.set('voter', voter); drawNoms(); } });
  const memIn = el('input', { class: 'input', placeholder: 'Add member (Enter)', onkeydown: e => { if (e.key === 'Enter') addMember(); } });
  const nomTitle = el('input', { class: 'input grow', placeholder: 'Book title' }), nomAuthor = el('input', { class: 'input', placeholder: 'Author' }), nomPages = el('input', { class: 'input', type: 'number', min: 1, placeholder: 'Pages', style: { width: '90px' } });
  const nomBox = el('div', { class: 'col' }), progBox = el('div', { class: 'col' }), meetBox = el('div', { class: 'col' });
  const mDate = el('input', { class: 'input', type: 'date' }), mHost = el('select', { class: 'select' }), mBook = el('input', { class: 'input grow', placeholder: 'Discussing (book / chapters)' });

  function addMember() {
    const n = memIn.value.trim(); if (!n) return;
    if (!st.members.some(m => m.toLowerCase() === n.toLowerCase())) st.members.push(n);
    memIn.value = ''; if (!voter) { voter = n; s.set('voter', voter); } save(); drawAll();
  }
  function addNom() {
    const title = nomTitle.value.trim(); if (!title) { toast('Enter a title'); return; }
    st.noms.push({ id: uid(), title, author: nomAuthor.value.trim(), pages: +nomPages.value || 0, by: voter, votes: [] });
    nomTitle.value = nomAuthor.value = nomPages.value = ''; save(); drawNoms();
  }
  function addMeeting() {
    if (!mDate.value) { toast('Pick a date'); return; }
    st.meetings.push({ id: uid(), date: mDate.value, host: mHost.value, book: mBook.value.trim() || (st.current ? st.current.title : ''), notes: '' });
    mBook.value = ''; save(); drawMeetings();
  }
  function setCurrent(n) { st.current = { title: n.title, author: n.author, pages: n.pages }; st.progress = {}; save(); drawAll(); toast('Current book set'); }

  function drawBanner() {
    const c = st.current;
    if (!c) { render(banner, el('div', { class: 'panel muted center' }, 'No current book yet. Nominate books, vote, then press "Make current" on the winner.')); return; }
    const avg = st.members.length ? Math.round(st.members.reduce((a, m) => a + (st.progress[m] || 0), 0) / st.members.length) : 0;
    const next = [...st.meetings].filter(m => m.date >= new Date().toISOString().slice(0, 10)).sort((a, b) => a.date.localeCompare(b.date))[0];
    render(banner, el('div', { class: 'panel', style: { borderLeft: '5px solid var(--accent)' } },
      el('div', { class: 'small muted' }, 'NOW READING'), el('div', { class: 'big' }, c.title), c.author ? el('div', { class: 'muted' }, 'by ' + c.author + (c.pages ? ' · ' + c.pages + ' pages' : '')) : null,
      el('div', { class: 'row' }, el('div', { class: 'bar grow' }, el('div', { style: { width: avg + '%' } })), el('span', { class: 'small' }, avg + '% club average')),
      next ? el('div', { class: 'small' }, `Next meeting: ${next.date}${next.host ? ' hosted by ' + next.host : ''}`) : null,
      el('div', { class: 'row' }, el('button', { class: 'btn small ghost', onclick: () => { st.current = null; save(); drawAll(); } }, 'Clear current book'))));
  }
  function drawMembers() {
    render(memberBox, st.members.length ? st.members.map(m => el('span', { class: 'badge' }, m, ' ', el('a', { href: '#', title: 'Remove', onclick: e => { e.preventDefault(); st.members = st.members.filter(x => x !== m); st.noms.forEach(n => { n.votes = n.votes.filter(v => v !== m); }); delete st.progress[m]; if (voter === m) voter = ''; save(); drawAll(); } }, '✕'))) : el('span', { class: 'small muted' }, 'Add your members first.'));
    render(voterSel, el('option', { value: '' }, '(choose)'), st.members.map(m => el('option', { value: m, selected: m === voter }, m)));
    render(mHost, el('option', { value: '' }, 'Host: (none)'), st.members.map(m => el('option', { value: m }, m)));
  }
  function drawNoms() {
    const sorted = [...st.noms].sort((a, b) => b.votes.length - a.votes.length);
    const top = sorted[0] && sorted[0].votes.length ? sorted[0].votes.length : -1;
    render(nomBox, sorted.length ? sorted.map(n => el('div', { class: 'panel' }, el('div', { class: 'row', style: { margin: 0 } },
      el('b', {}, n.title), n.author ? el('span', { class: 'muted' }, 'by ' + n.author) : null, n.pages ? el('span', { class: 'small muted' }, n.pages + ' pp') : null,
      n.votes.length === top ? el('span', { class: 'badge ok' }, 'leading') : null, el('span', { class: 'grow' }),
      el('span', { class: 'badge' }, n.votes.length + ' vote' + (n.votes.length === 1 ? '' : 's')),
      el('button', { class: 'btn small' + (n.votes.includes(voter) ? ' primary' : ''), onclick: () => { if (!voter) { toast('Choose who you are under "Voting as"'); return; } n.votes = n.votes.includes(voter) ? n.votes.filter(v => v !== voter) : [...n.votes, voter]; save(); drawNoms(); } }, n.votes.includes(voter) ? 'Voted' : 'Vote'),
      el('button', { class: 'btn small', onclick: () => setCurrent(n) }, 'Make current'),
      el('button', { class: 'btn small ghost', onclick: () => { st.noms = st.noms.filter(x => x !== n); save(); drawNoms(); } }, '✕')),
      n.votes.length ? el('div', { class: 'small muted' }, 'Votes: ' + n.votes.join(', ') + (n.by ? ' · nominated by ' + n.by : '')) : (n.by ? el('div', { class: 'small muted' }, 'Nominated by ' + n.by) : null))) : el('div', { class: 'muted small' }, 'No nominations yet.'));
  }
  function drawProgress() {
    const c = st.current;
    render(progBox, !c ? el('div', { class: 'muted small' }, 'Set a current book to track progress.') : st.members.length ? st.members.map(m => {
      const v = st.progress[m] || 0, label = el('span', { class: 'small', style: { minWidth: '90px', display: 'inline-block' } });
      const upd = x => { label.textContent = c.pages ? `${Math.round(c.pages * x / 100)} / ${c.pages} pp` : x + '%'; };
      const range = el('input', { type: 'range', min: 0, max: 100, value: v, class: 'grow', oninput: e => { st.progress[m] = +e.target.value; upd(+e.target.value); bar.firstChild.style.width = e.target.value + '%'; }, onchange: () => { save(); drawBanner(); } });
      const bar = el('div', { class: 'bar', style: { width: '90px' } }, el('div', { style: { width: v + '%' } }));
      upd(v);
      return el('div', { class: 'row', style: { margin: '2px 0' } }, el('span', { style: { minWidth: '110px' } }, m), range, bar, label, v >= 100 ? el('span', { class: 'badge ok' }, 'finished') : null);
    }) : el('div', { class: 'muted small' }, 'Add members to track their progress.'));
  }
  function drawMeetings() {
    const sorted = [...st.meetings].sort((a, b) => a.date.localeCompare(b.date));
    render(meetBox, sorted.length ? sorted.map(m => el('div', { class: 'panel' }, el('div', { class: 'row', style: { margin: 0 } }, el('b', {}, m.date), m.host ? el('span', { class: 'muted' }, 'host: ' + m.host) : null, m.book ? el('span', {}, '· ' + m.book) : null, el('span', { class: 'grow' }),
      el('button', { class: 'btn small ghost', onclick: () => { st.meetings = st.meetings.filter(x => x !== m); save(); drawMeetings(); drawBanner(); } }, '✕')),
      el('textarea', { class: 'textarea prose', style: { minHeight: '60px' }, placeholder: 'Meeting notes…', value: m.notes, oninput: e => { m.notes = e.target.value; save(); } }))) : el('div', { class: 'muted small' }, 'No meetings scheduled.'));
    drawBanner();
  }
  function drawAll() { drawBanner(); drawMembers(); drawNoms(); drawProgress(); drawMeetings(); }

  render(root, note, banner,
    h3('Members'), memberBox, el('div', { class: 'row' }, memIn, el('button', { class: 'btn', onclick: addMember }, 'Add member')),
    h3('Nominations and votes'), el('div', { class: 'row' }, el('span', { class: 'small muted' }, 'Voting as'), voterSel), nomBox,
    el('div', { class: 'row' }, nomTitle, nomAuthor, nomPages, el('button', { class: 'btn primary', onclick: addNom }, 'Nominate')),
    h3('Reading progress'), progBox,
    h3('Meetings'), el('div', { class: 'row' }, mDate, mHost, mBook, el('button', { class: 'btn primary', onclick: addMeeting }, 'Schedule')), meetBox,
    el('div', { class: 'row', style: { marginTop: '14px' } }, el('button', { class: 'btn ghost', onclick: () => copy(st.meetings.map(m => `${m.date} (${m.host || 'no host'}): ${m.book}\n${m.notes}`).join('\n\n')) }, 'Copy all meeting notes')));
  drawAll();
}
