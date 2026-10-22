// Typing tutor: lessons by key row, live WPM/accuracy, error highlighting, finger hints, per-lesson progress.
import { el, render, store, stat, field } from '../../lib/ui.js';

const LESSONS = [
  { id: 'home', name: 'Home row', keys: 'asdfjkl;', texts: [
    'asdf jkl; asdf jkl; fjdk sla; fjdk sla; a;sl dkfj a;sl dkfj',
    'sad lad fad dad; ask all fall; flask salad; a lad asks dad',
    'jak lass fall; sal adds a salad; dad asks a lad; flask falls' ] },
  { id: 'top', name: 'Top row', keys: 'qwertyuiop', texts: [
    'qwer tyui op qwer tyui op; rt yu qw op; we try quiet pie',
    'tie rope; quip, pour, type, true, wire, tour, port, pretty',
    'we wrote poetry; your tire pops; pure water; try to type it' ] },
  { id: 'bottom', name: 'Bottom row', keys: 'zxcvbnm,./', texts: [
    'zxcv bnm,./ zxcv bnm,./ zx cv bn m, ./ zxcv bnm,./',
    'zebra, cabin. mix, vex, box. comb, numb, calm, zinc.',
    'can a vicar move? zinc boxes, mixed nuts. cabins, bamboo.' ] },
  { id: 'numbers', name: 'Numbers', keys: '1234567890', texts: [
    '1234 5678 90 1234 5678 90 12 34 56 78 90 0987 6543 21',
    'in 2024 we had 365 days, 52 weeks and 12 months; 100 is 10 x 10',
    'call 555 0199 at 7:30; room 42, floor 9; total 1,250.75' ] },
  { id: 'mixed', name: 'Mixed rows', keys: 'all', texts: [
    'the quick brown fox jumps over the lazy dog',
    'pack my box with five dozen liquor jugs',
    'how vexingly quick daft zebras jump; sphinx of black quartz, judge my vow' ] },
  { id: 'sentences', name: 'Sentences', keys: 'all', texts: [
    'Practice makes progress. Small steps every day add up to big changes over time.',
    'The library opens at 9 a.m. on weekdays, but on Saturdays it opens at noon.',
    'She asked, "Did you finish the report?" He nodded and handed her 3 copies.',
    'Good typing is about rhythm, not speed; accuracy first and speed will follow.' ] },
];

const FINGER = {};
const assign = (keys, name) => { for (const k of keys) FINGER[k] = name; };
assign('qaz1`', 'left pinky'); assign('wsx2', 'left ring'); assign('edc3', 'left middle'); assign('rfvtgb45', 'left index');
assign('yhnujm67', 'right index'); assign('ik,8', 'right middle'); assign('ol.9', 'right ring'); assign("p;/0-=[]\\'", 'right pinky'); assign(' ', 'thumb');
const SHIFT = { '!': '1', '@': '2', '#': '3', '$': '4', '%': '5', '^': '6', '&': '7', '*': '8', '(': '9', ')': '0', ':': ';', '"': "'", '<': ',', '>': '.', '?': '/', '_': '-', '+': '=' };
function fingerFor(ch) {
  const lower = ch.toLowerCase();
  const base = SHIFT[ch] || lower;
  const f = FINGER[base] || 'unknown';
  const shift = ch !== lower || SHIFT[ch];
  if (!shift) return f;
  return f + ' + ' + (f.startsWith('left') ? 'right' : 'left') + ' shift';
}

export default function (root) {
  const s = store('typing-tutor');
  let progress = s.get('progress', {}); // lessonId -> {done, bestWpm, bestAcc}
  let lessonId = s.get('lesson', 'home');
  let textIdx = 0;
  let target = '', typed = '', startAt = 0, keystrokes = 0, errors = 0, finished = false;
  let tick = null;

  const lessonSel = el('select', { class: 'select', onchange: () => { lessonId = lessonSel.value; s.set('lesson', lessonId); textIdx = 0; load(); } },
    LESSONS.map(l => el('option', { value: l.id, selected: l.id === lessonId }, l.name)));
  const textSel = el('select', { class: 'select', onchange: () => { textIdx = +textSel.value; load(); } });
  const display = el('div', { class: 'mono', style: { fontSize: '20px', lineHeight: '1.8', padding: '14px', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: '8px', wordBreak: 'break-word', minHeight: '80px', cursor: 'text' }, onclick: () => input.focus() });
  const input = el('input', { class: 'input mono', placeholder: 'Click here and start typing… (Esc restarts)', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', style: { width: '100%', fontSize: '16px' } });
  const hint = el('div', { class: 'small', style: { minHeight: '22px' } });
  const stats = el('div', { class: 'row' });
  const progBox = el('div', { class: 'col' });
  const result = el('div', { class: 'panel hidden' });

  function lesson() { return LESSONS.find(l => l.id === lessonId) || LESSONS[0]; }

  function load() {
    const L = lesson();
    render(textSel, L.texts.map((t, i) => el('option', { value: i, selected: i === textIdx }, 'Exercise ' + (i + 1))));
    target = L.texts[textIdx];
    typed = ''; startAt = 0; keystrokes = 0; errors = 0; finished = false;
    input.value = ''; input.disabled = false;
    result.classList.add('hidden');
    draw(); updateStats(); drawProgress();
  }

  function draw() {
    const spans = [];
    for (let i = 0; i < target.length; i++) {
      const ch = target[i];
      let style = { color: 'var(--muted)' };
      if (i < typed.length) style = typed[i] === ch
        ? { color: 'var(--ok)' }
        : { color: '#fff', background: 'var(--danger)', borderRadius: '3px' };
      else if (i === typed.length) style = { borderBottom: '3px solid var(--accent)', color: 'var(--text)' };
      spans.push(el('span', { style }, ch === ' ' && i < typed.length && typed[i] !== ' ' ? '␣' : ch));
    }
    render(display, spans);
    const next = target[typed.length];
    render(hint, next == null ? el('span', { class: 'badge ok' }, 'Done!') :
      [el('span', { class: 'muted' }, 'Next key: '), el('span', { class: 'kbd' }, next === ' ' ? 'space' : next), el('span', { class: 'muted' }, '  →  ' + fingerFor(next))]);
  }

  function metrics() {
    const elapsed = startAt ? (Date.now() - startAt) / 1000 : 0;
    const correct = [...typed].filter((c, i) => c === target[i]).length;
    const wpm = elapsed > 0 ? Math.round((correct / 5) / (elapsed / 60)) : 0;
    const acc = keystrokes ? Math.round(100 * (keystrokes - errors) / keystrokes) : 100;
    return { elapsed, wpm, acc, correct };
  }

  function updateStats() {
    const m = metrics();
    render(stats, stat(m.wpm, 'WPM'), stat(m.acc + '%', 'accuracy'), stat(m.elapsed.toFixed(0) + ' s', 'time'), stat(typed.length + '/' + target.length, 'chars'), stat(errors, 'errors'));
  }

  function finish() {
    finished = true; clearInterval(tick); tick = null;
    input.disabled = true;
    const m = metrics();
    const p = progress[lessonId] || { done: 0, bestWpm: 0, bestAcc: 0 };
    p.done++; p.bestWpm = Math.max(p.bestWpm, m.wpm); p.bestAcc = Math.max(p.bestAcc, m.acc);
    progress[lessonId] = p; s.set('progress', progress);
    const L = lesson();
    render(result, el('div', { class: 'row' },
      el('span', { class: 'big' }, m.wpm + ' WPM'), el('span', { class: 'badge ' + (m.acc >= 95 ? 'ok' : m.acc >= 85 ? 'warn' : 'danger') }, m.acc + '% accuracy'),
      el('span', { class: 'grow' }),
      el('button', { class: 'btn', onclick: () => { load(); input.focus(); } }, 'Retry'),
      el('button', { class: 'btn primary', onclick: () => { textIdx = (textIdx + 1) % L.texts.length; load(); input.focus(); } }, 'Next exercise')));
    result.classList.remove('hidden');
    updateStats(); drawProgress();
  }

  input.addEventListener('keydown', e => {
    if (e.key === 'Escape') { load(); return; }
    if (finished) { e.preventDefault(); return; }
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      keystrokes++;
      if (e.key !== target[typed.length]) errors++;
    }
  });
  input.addEventListener('input', () => {
    if (finished) return;
    if (!startAt && input.value.length) { startAt = Date.now(); tick = setInterval(updateStats, 500); }
    typed = input.value.slice(0, target.length);
    draw(); updateStats();
    if (typed.length === target.length && typed === target) finish();
    else if (typed.length === target.length) { // finished with mistakes: allow backspace to fix
      render(hint, el('span', { class: 'badge danger' }, 'Fix the highlighted mistakes to finish'));
    }
  });

  function drawProgress() {
    render(progBox, el('div', { class: 'muted small' }, 'Progress per lesson'),
      el('div', { class: 'scroll-x' }, el('table', { class: 'table' },
        el('thead', {}, el('tr', {}, el('th', {}, 'Lesson'), el('th', {}, 'Keys'), el('th', {}, 'Completed'), el('th', {}, 'Best WPM'), el('th', {}, 'Best accuracy'))),
        el('tbody', {}, LESSONS.map(L => { const p = progress[L.id]; return el('tr', { style: L.id === lessonId ? { fontWeight: '600' } : {} },
          el('td', {}, L.name), el('td', { class: 'mono small' }, L.keys), el('td', {}, p ? p.done : 0), el('td', {}, p ? p.bestWpm : '—'), el('td', {}, p ? p.bestAcc + '%' : '—')); })))),
      el('button', { class: 'btn small ghost', onclick: () => { progress = {}; s.set('progress', progress); drawProgress(); } }, 'Reset progress'));
  }

  render(root,
    el('div', { class: 'row' }, field('Lesson', lessonSel), field('Exercise', textSel), el('button', { class: 'btn ghost', onclick: () => { load(); input.focus(); } }, 'Restart')),
    display, input, hint, stats, result, progBox);
  load();
  return () => clearInterval(tick);
}
