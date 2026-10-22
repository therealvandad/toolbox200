// Mood journal: 1-5 mood with emoji and note per day, colour calendar, monthly average and streak.
import { el, render, store, today, toast, stat, pad } from '../../lib/ui.js';

const MOODS = [
  { v: 1, emoji: '😞', label: 'Awful', color: '#c0392b' },
  { v: 2, emoji: '🙁', label: 'Bad', color: '#e67e22' },
  { v: 3, emoji: '😐', label: 'Okay', color: '#d4ac0d' },
  { v: 4, emoji: '🙂', label: 'Good', color: '#58a85a' },
  { v: 5, emoji: '😄', label: 'Great', color: '#1f9d55' },
];

export default function (root) {
  const s = store('mood-journal');
  let entries = s.get('entries', {});     // 'YYYY-MM-DD' -> {mood, note}
  const now = new Date();
  let year = now.getFullYear(), month = now.getMonth();
  let sel = today();
  let mood = 0;

  const keyOf = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
  const save = () => s.set('entries', entries);

  const title = el('h3', { style: { margin: 0, minWidth: '150px', textAlign: 'center' } });
  const cal = el('div', { class: 'cal' });
  const stats = el('div', { class: 'row' });
  const selLabel = el('div', { class: 'big', style: { fontSize: '20px' } });
  const moodRow = el('div', { class: 'row' });
  const note = el('textarea', { class: 'textarea prose', style: { minHeight: '80px' }, placeholder: 'What happened today? Anything on your mind…' });
  const recent = el('div', { class: 'scroll-x' });

  function pickDay(k) {
    sel = k; const e = entries[k];
    mood = e ? e.mood : 0; note.value = e ? e.note || '' : '';
    renderForm(); renderCal();
  }
  function renderForm() {
    selLabel.textContent = new Date(sel + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    render(moodRow, MOODS.map(m => el('button', {
      class: 'btn' + (mood === m.v ? ' primary' : ''), style: { fontSize: '22px', padding: '6px 12px' }, title: m.label,
      onclick: () => { mood = m.v; renderForm(); },
    }, m.emoji, el('span', { style: { fontSize: '12px', marginLeft: '6px' } }, m.label))));
  }
  function saveDay() {
    if (!mood) { toast('Pick a mood first'); return; }
    entries[sel] = { mood, note: note.value.trim() };
    save(); toast('Saved'); update();
  }
  function clearDay() { delete entries[sel]; save(); mood = 0; note.value = ''; renderForm(); update(); }

  function streak() {
    const d = new Date(); let n = 0;
    if (!entries[keyOf(d.getFullYear(), d.getMonth(), d.getDate())]) d.setDate(d.getDate() - 1);   // today may not be logged yet
    while (entries[keyOf(d.getFullYear(), d.getMonth(), d.getDate())]) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }

  function renderCal() {
    title.textContent = new Date(year, month, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    const first = (new Date(year, month, 1).getDay() + 6) % 7;       // Monday first
    const days = new Date(year, month + 1, 0).getDate();
    const cells = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(d => el('div', { style: { border: 0, background: 'none', aspectRatio: 'auto', color: 'var(--muted)' } }, d));
    for (let i = 0; i < first; i++) cells.push(el('div', { style: { border: 0, background: 'none' } }));
    for (let d = 1; d <= days; d++) {
      const k = keyOf(year, month, d), e = entries[k], m = e && MOODS[e.mood - 1];
      cells.push(el('div', {
        title: m ? `${k}: ${m.label}${e.note ? ' – ' + e.note : ''}` : k,
        style: { cursor: 'pointer', background: m ? m.color : 'var(--bg)', color: m ? '#fff' : 'var(--text)', outline: k === sel ? '2px solid var(--accent)' : k === today() ? '2px dashed var(--muted)' : 'none', flexDirection: 'column', lineHeight: 1.1, fontWeight: m ? 600 : 400 },
        onclick: () => pickDay(k),
      }, el('span', {}, d), m && el('span', { style: { fontSize: '14px' } }, m.emoji)));
    }
    render(cal, cells);
  }

  function update() {
    renderCal();
    const prefix = `${year}-${pad(month + 1)}-`;
    const ms = Object.entries(entries).filter(([k]) => k.startsWith(prefix)).map(([, e]) => e.mood);
    const avg = ms.length ? ms.reduce((a, b) => a + b, 0) / ms.length : 0;
    const am = avg ? MOODS[Math.round(avg) - 1] : null;
    render(stats, stat(avg ? avg.toFixed(2) + (am ? ' ' + am.emoji : '') : '–', 'average this month'), stat(ms.length, 'days logged this month'), stat(streak() + ' d', 'current streak'), stat(Object.keys(entries).length, 'total entries'));
    const rec = Object.entries(entries).sort((a, b) => (a[0] < b[0] ? 1 : -1)).slice(0, 10);
    render(recent, rec.length ? el('table', { class: 'table' }, el('tbody', {}, rec.map(([k, e]) => el('tr', { style: { cursor: 'pointer' }, onclick: () => { const d = new Date(k + 'T12:00:00'); year = d.getFullYear(); month = d.getMonth(); pickDay(k); update(); } },
      el('td', {}, k), el('td', {}, MOODS[e.mood - 1].emoji + ' ' + MOODS[e.mood - 1].label), el('td', { class: 'muted' }, e.note || ''))))) : el('div', { class: 'muted' }, 'No entries yet. Pick a mood above.'));
  }

  const nav = (d) => { month += d; if (month < 0) { month = 11; year--; } if (month > 11) { month = 0; year++; } update(); };

  render(root,
    el('div', { class: 'grid2' },
      el('div', { class: 'col' },
        el('div', { class: 'row', style: { justifyContent: 'center' } },
          el('button', { class: 'btn small', onclick: () => nav(-1) }, '◀'), title, el('button', { class: 'btn small', onclick: () => nav(1) }, '▶'),
          el('button', { class: 'btn small ghost', onclick: () => { year = now.getFullYear(); month = now.getMonth(); pickDay(today()); update(); } }, 'Today')),
        cal,
        el('div', { class: 'row small muted' }, MOODS.map(m => el('span', {}, el('span', { style: { display: 'inline-block', width: '10px', height: '10px', background: m.color, borderRadius: '3px', marginRight: '4px' } }), m.label)))),
      el('div', { class: 'col' }, selLabel, moodRow, note,
        el('div', { class: 'row' },
          el('button', { class: 'btn primary', onclick: saveDay }, 'Save day'),
          el('button', { class: 'btn ghost', onclick: clearDay }, 'Clear day')),
        stats)),
    el('h3', {}, 'Recent entries'), recent,
    el('p', { class: 'muted small' }, 'Your journal stays in this browser only. Nothing is uploaded. If you are struggling, please talk to someone you trust or a health professional.'));
  pickDay(sel); update();
}
