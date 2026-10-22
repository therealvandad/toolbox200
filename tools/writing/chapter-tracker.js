import { el, render, store, stat, uid, today, download, readFile, toast, pad } from '../../lib/ui.js';

const STATUSES = ['Planned', 'Drafting', 'Revising', 'Done'];
const SCOLOR = { Planned: '', Drafting: 'warn', Revising: 'warn', Done: 'ok' };

function dayKey(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

export default function (root) {
  const s = store('chapter-tracker');
  let state = s.get('state', null) || { bookTitle: 'My novel', dailyGoal: 500, chapters: [{ id: uid(), title: 'Chapter 1', status: 'Drafting', words: 0, target: 3000 }], log: {} };
  const save = () => s.set('state', state);

  const list = el('div');
  const totals = el('div', { class: 'row' });
  const bar = el('div', { style: { width: '0%' } });
  const barTxt = el('div', { class: 'small muted' });
  const dailyBox = el('div', { class: 'row' });
  const week = el('div', { class: 'row', style: { gap: '4px' } });
  const titleIn = el('input', { class: 'input grow', value: state.bookTitle, placeholder: 'Book title' });
  const goalIn = el('input', { class: 'input', type: 'number', min: '0', value: state.dailyGoal, style: { width: '100px' } });
  const addToday = el('input', { class: 'input', type: 'number', min: '1', placeholder: 'words', style: { width: '100px' } });

  function streak() {
    const goal = Math.max(1, state.dailyGoal || 1);
    const d = new Date(); let n = 0;
    // today counts only if goal met; otherwise streak continues from yesterday
    if ((state.log[dayKey(d)] || 0) < goal) d.setDate(d.getDate() - 1);
    while ((state.log[dayKey(d)] || 0) >= goal) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }
  function renderSummary() {
    const w = state.chapters.reduce((a, c) => a + (+c.words || 0), 0);
    const t = state.chapters.reduce((a, c) => a + (+c.target || 0), 0);
    const done = state.chapters.filter(c => c.status === 'Done').length;
    const pct = t ? Math.min(100, Math.round(w / t * 100)) : 0;
    render(totals, stat(w.toLocaleString(), 'total words'), stat(t.toLocaleString(), 'target words'), stat(pct + '%', 'of target'), stat(`${done}/${state.chapters.length}`, 'chapters done'));
    bar.style.width = pct + '%';
    barTxt.textContent = t ? `${w.toLocaleString()} of ${t.toLocaleString()} words${w < t ? ` · ${(t - w).toLocaleString()} to go` : ' · target reached'}` : 'Set chapter targets to see progress';
    const td = state.log[today()] || 0, goal = state.dailyGoal || 0;
    render(dailyBox, stat(td.toLocaleString(), `written today${goal ? ' / ' + goal : ''}`), stat(streak() + ' day' + (streak() === 1 ? '' : 's'), 'streak'));
    const days = [];
    for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); days.push(d); }
    const max = Math.max(goal, ...days.map(d => state.log[dayKey(d)] || 0), 1);
    render(week, days.map(d => {
      const v = state.log[dayKey(d)] || 0;
      return el('div', { style: { textAlign: 'center', flex: '1', minWidth: '36px' }, title: `${dayKey(d)}: ${v} words` },
        el('div', { style: { height: '48px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' } },
          el('div', { style: { width: '70%', height: Math.max(2, Math.round(v / max * 48)) + 'px', background: goal && v >= goal ? 'var(--ok)' : 'var(--accent)', borderRadius: '3px' } })),
        el('div', { class: 'small muted' }, d.toLocaleDateString(undefined, { weekday: 'short' })));
    }));
  }
  function logWords(n) { if (n > 0) { state.log[today()] = (state.log[today()] || 0) + n; } }

  function renderList() {
    render(list, el('div', { class: 'scroll-x' }, el('table', { class: 'table' },
      el('thead', {}, el('tr', {}, ['#', 'Title', 'Status', 'Words', 'Target', 'Progress', ''].map(h => el('th', {}, h)))),
      el('tbody', {}, state.chapters.map((c, i) => {
        const pct = c.target ? Math.min(100, Math.round(c.words / c.target * 100)) : 0;
        const tIn = el('input', { class: 'input', value: c.title, style: { width: '100%', minWidth: '120px' } });
        tIn.addEventListener('input', () => { c.title = tIn.value; save(); });
        const sSel = el('select', { class: 'select' }, STATUSES.map(x => el('option', { value: x, selected: x === c.status }, x)));
        sSel.addEventListener('change', () => { c.status = sSel.value; save(); renderList(); renderSummary(); });
        const wIn = el('input', { class: 'input', type: 'number', min: '0', value: c.words, style: { width: '90px' } });
        wIn.addEventListener('change', () => { const nv = Math.max(0, parseInt(wIn.value) || 0); logWords(nv - c.words); c.words = nv; save(); renderList(); renderSummary(); });
        const gIn = el('input', { class: 'input', type: 'number', min: '0', value: c.target, style: { width: '90px' } });
        gIn.addEventListener('change', () => { c.target = Math.max(0, parseInt(gIn.value) || 0); save(); renderList(); renderSummary(); });
        const mv = (d) => () => { const j = i + d; if (j < 0 || j >= state.chapters.length) return; [state.chapters[i], state.chapters[j]] = [state.chapters[j], state.chapters[i]]; save(); renderList(); };
        return el('tr', {},
          el('td', {}, i + 1), el('td', {}, tIn), el('td', {}, sSel), el('td', {}, wIn), el('td', {}, gIn),
          el('td', { style: { minWidth: '90px' } }, el('div', { class: 'bar' }, el('div', { style: { width: pct + '%', background: c.status === 'Done' ? 'var(--ok)' : '' } })), el('span', { class: 'small muted' }, pct + '%')),
          el('td', { style: { whiteSpace: 'nowrap' } },
            el('button', { class: 'btn small ghost', title: 'Move up', onclick: mv(-1) }, '▲'), el('button', { class: 'btn small ghost', title: 'Move down', onclick: mv(1) }, '▼'),
            el('button', { class: 'btn small danger ghost', title: 'Delete', onclick: () => { state.chapters.splice(i, 1); save(); renderList(); renderSummary(); } }, '✕')));
      })))));
  }

  titleIn.addEventListener('input', () => { state.bookTitle = titleIn.value; save(); });
  goalIn.addEventListener('input', () => { state.dailyGoal = Math.max(0, parseInt(goalIn.value) || 0); save(); renderSummary(); });
  const fileIn = el('input', { type: 'file', accept: '.json,application/json', class: 'hidden' });
  fileIn.addEventListener('change', async () => {
    try {
      const o = JSON.parse(await readFile(fileIn.files[0]));
      if (!o || !Array.isArray(o.chapters)) throw new Error('bad');
      state = { bookTitle: o.bookTitle || 'My novel', dailyGoal: +o.dailyGoal || 0, log: o.log || {}, chapters: o.chapters.map(c => ({ id: uid(), title: String(c.title || ''), status: STATUSES.includes(c.status) ? c.status : 'Planned', words: +c.words || 0, target: +c.target || 0 })) };
      titleIn.value = state.bookTitle; goalIn.value = state.dailyGoal; save(); renderList(); renderSummary(); toast('Imported');
    } catch { toast('Not a valid tracker JSON file'); }
    fileIn.value = '';
  });

  render(root,
    el('div', { class: 'row' }, titleIn),
    totals, el('div', { class: 'bar' }, bar), barTxt,
    el('h3', {}, 'Daily goal'),
    el('div', { class: 'row' }, el('label', { class: 'inline' }, 'Words per day', goalIn),
      el('label', { class: 'inline' }, 'Add words written', addToday, el('button', { class: 'btn small primary', onclick: () => { const n = parseInt(addToday.value); if (n > 0) { logWords(n); save(); addToday.value = ''; renderSummary(); } } }, 'Log'))),
    dailyBox, week,
    el('h3', {}, 'Chapters'),
    list,
    el('div', { class: 'row' },
      el('button', { class: 'btn primary', onclick: () => { state.chapters.push({ id: uid(), title: 'Chapter ' + (state.chapters.length + 1), status: 'Planned', words: 0, target: state.chapters.length ? state.chapters[state.chapters.length - 1].target : 3000 }); save(); renderList(); renderSummary(); } }, '+ Add chapter'),
      el('button', { class: 'btn', onclick: () => download((state.bookTitle || 'novel').replace(/[^\w-]+/g, '-') + '-progress.json', JSON.stringify(state, null, 2), 'application/json') }, 'Export JSON'),
      el('button', { class: 'btn', onclick: () => fileIn.click() }, 'Import JSON'), fileIn),
    el('p', { class: 'muted small' }, 'Increasing a chapter word count automatically counts toward today\'s total and your streak.'));
  renderList(); renderSummary();
}
