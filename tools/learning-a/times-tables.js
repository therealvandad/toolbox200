// Times tables trainer: pick tables, timed quiz, per-question timing, accuracy, heatmap of weak facts.
import { el, render, store, stat, field } from '../../lib/ui.js';

export default function (root) {
  const s = store('times-tables');
  const MAX = 12;
  let selected = new Set(s.get('tables', [2, 3, 4, 5, 6, 7, 8, 9]));
  let count = s.get('count', 20);
  let timeLimit = s.get('limit', 8); // seconds per question, 0 = no limit
  let facts = s.get('facts', {}); // "a,b" -> {n, ok, ms}

  // --- state for a running quiz ---
  let quiz = null; // {qs, i, results, startedAt, qStart}
  let tick = null;

  const tableBtns = el('div', { class: 'row' });
  function drawTables() {
    render(tableBtns, Array.from({ length: MAX }, (_, i) => i + 1).map(n =>
      el('button', { class: 'btn small' + (selected.has(n) ? ' primary' : ''), onclick: () => { selected.has(n) ? selected.delete(n) : selected.add(n); s.set('tables', [...selected]); drawTables(); } }, '×' + n)),
      el('button', { class: 'btn small ghost', onclick: () => { selected = new Set(Array.from({ length: MAX }, (_, i) => i + 1)); s.set('tables', [...selected]); drawTables(); } }, 'All'),
      el('button', { class: 'btn small ghost', onclick: () => { selected = new Set(); s.set('tables', []); drawTables(); } }, 'None'));
  }
  drawTables();

  const countSel = el('select', { class: 'select', onchange: () => { count = +countSel.value; s.set('count', count); } },
    [10, 20, 30, 50].map(n => el('option', { value: n, selected: n === count }, n + ' questions')));
  const limitSel = el('select', { class: 'select', onchange: () => { timeLimit = +limitSel.value; s.set('limit', timeLimit); } },
    [[0, 'No time limit'], [3, '3 s per question'], [5, '5 s per question'], [8, '8 s per question'], [12, '12 s per question']].map(([v, t]) => el('option', { value: v, selected: v === timeLimit }, t)));

  const setup = el('div', { class: 'col' },
    el('div', { class: 'muted small' }, 'Choose which tables to practise:'),
    tableBtns,
    el('div', { class: 'row' }, field('Length', countSel), field('Timer', limitSel),
      el('button', { class: 'btn primary', onclick: start }, 'Start quiz')),
  );

  // quiz UI
  const qText = el('div', { class: 'huge center', style: { margin: '10px 0' } });
  const answer = el('input', { class: 'input big', type: 'number', inputmode: 'numeric', placeholder: '?', style: { width: '160px', textAlign: 'center', fontSize: '28px' } });
  const timerBar = el('div', { class: 'bar', style: { width: '100%', maxWidth: '400px' } }, el('div'));
  const progress = el('div', { class: 'muted small' });
  const feedback = el('div', { class: 'small', style: { minHeight: '22px' } });
  const quizBox = el('div', { class: 'col center hidden', style: { alignItems: 'center' } },
    progress, qText, el('div', { class: 'row', style: { justifyContent: 'center' } }, answer, el('button', { class: 'btn primary', onclick: submit }, 'Check')),
    timerBar, feedback,
    el('button', { class: 'btn ghost small', onclick: endQuiz }, 'Stop'));

  const summary = el('div', { class: 'col hidden' });
  const heat = el('div');
  const heatBox = el('div', { class: 'col' },
    el('div', { class: 'row' }, el('strong', {}, 'Heatmap of your facts'), el('span', { class: 'muted small grow' }, 'green = fast and right, red = slow or wrong, grey = not seen yet'),
      el('button', { class: 'btn small ghost', onclick: () => { facts = {}; s.set('facts', facts); drawHeat(); } }, 'Reset history')),
    el('div', { class: 'scroll-x' }, heat));

  answer.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } if (e.key === 'Escape') answer.value = ''; });

  function makeQuestions() {
    const tables = [...selected];
    const qs = [];
    // weight weak facts: include each (a,b) with weight 1 + errorRate*3
    const pool = [];
    for (const a of tables) for (let b = 1; b <= MAX; b++) {
      const f = facts[a + ',' + b];
      let w = 1;
      if (f && f.n) w += 3 * (1 - f.ok / f.n) + (f.ms / f.n > 4000 ? 1 : 0);
      pool.push({ a, b, w });
    }
    const total = pool.reduce((t, p) => t + p.w, 0);
    for (let i = 0; i < count; i++) {
      let r = Math.random() * total;
      let pick = pool[pool.length - 1];
      for (const p of pool) { r -= p.w; if (r <= 0) { pick = p; break; } }
      const flip = Math.random() < 0.5;
      qs.push(flip ? { a: pick.b, b: pick.a, key: pick.a + ',' + pick.b } : { a: pick.a, b: pick.b, key: pick.a + ',' + pick.b });
    }
    return qs;
  }

  function start() {
    if (!selected.size) { feedback.textContent = ''; render(summary, el('div', { class: 'panel' }, 'Select at least one table first.')); summary.classList.remove('hidden'); return; }
    quiz = { qs: makeQuestions(), i: 0, results: [], startedAt: performance.now() };
    setup.classList.add('hidden'); summary.classList.add('hidden'); quizBox.classList.remove('hidden');
    nextQ();
  }

  function nextQ() {
    if (!quiz) return;
    if (quiz.i >= quiz.qs.length) return endQuiz();
    const q = quiz.qs[quiz.i];
    quiz.qStart = performance.now();
    progress.textContent = `Question ${quiz.i + 1} of ${quiz.qs.length}`;
    qText.textContent = `${q.a} × ${q.b}`;
    answer.value = ''; answer.focus();
    feedback.textContent = '';
    clearInterval(tick);
    timerBar.firstChild.style.width = '100%';
    timerBar.style.visibility = timeLimit ? 'visible' : 'hidden';
    if (timeLimit) {
      tick = setInterval(() => {
        const left = 1 - (performance.now() - quiz.qStart) / (timeLimit * 1000);
        timerBar.firstChild.style.width = Math.max(0, left * 100) + '%';
        timerBar.firstChild.style.background = left < 0.3 ? 'var(--danger)' : 'var(--accent)';
        if (left <= 0) record(null);
      }, 50);
    }
  }

  function submit() { if (!quiz || answer.value === '') return; record(+answer.value); }

  function record(given) {
    clearInterval(tick);
    const q = quiz.qs[quiz.i];
    const ms = Math.round(performance.now() - quiz.qStart);
    const ok = given === q.a * q.b;
    quiz.results.push({ ...q, given, ok, ms });
    const f = facts[q.key] || { n: 0, ok: 0, ms: 0 };
    f.n++; if (ok) f.ok++; f.ms += Math.min(ms, timeLimit ? timeLimit * 1000 : 15000);
    facts[q.key] = f; s.set('facts', facts);
    feedback.textContent = ok ? `✓ ${(ms / 1000).toFixed(1)} s` : (given == null ? `⏱ Time's up — ${q.a} × ${q.b} = ${q.a * q.b}` : `✗ ${q.a} × ${q.b} = ${q.a * q.b}`);
    feedback.style.color = ok ? 'var(--ok)' : 'var(--danger)';
    quiz.i++;
    setTimeout(nextQ, ok ? 350 : 1200);
  }

  function endQuiz() {
    clearInterval(tick);
    if (!quiz) return;
    const r = quiz.results;
    const n = r.length, okN = r.filter(x => x.ok).length;
    const totalMs = r.reduce((t, x) => t + x.ms, 0);
    const avg = n ? totalMs / n / 1000 : 0;
    const best = s.get('best', null);
    const acc = n ? Math.round(okN / n * 100) : 0;
    const score = n ? Math.round(okN * 100 / Math.max(1, avg)) : 0;
    if (n >= 10 && (!best || score > best.score)) s.set('best', { score, acc, avg: avg.toFixed(1), date: new Date().toLocaleDateString() });
    const history = s.get('history', []);
    if (n) { history.push({ d: Date.now(), n, acc, avg: +avg.toFixed(2) }); s.set('history', history.slice(-50)); }
    const wrong = r.filter(x => !x.ok);
    render(summary,
      el('div', { class: 'row' }, stat(n, 'answered'), stat(acc + '%', 'accuracy'), stat(avg.toFixed(1) + ' s', 'avg per question'), stat((totalMs / 1000).toFixed(0) + ' s', 'total time')),
      wrong.length ? el('div', { class: 'panel' }, el('strong', {}, 'Review: '), wrong.map(x => el('span', { class: 'badge danger', style: { margin: '2px' } }, `${x.a}×${x.b}=${x.a * x.b}`))) : el('div', { class: 'badge ok' }, 'Perfect round!'),
      el('div', { class: 'row' }, el('button', { class: 'btn primary', onclick: start }, 'Again'), el('button', { class: 'btn', onclick: () => { summary.classList.add('hidden'); setup.classList.remove('hidden'); } }, 'Change settings')),
    );
    quiz = null;
    quizBox.classList.add('hidden'); summary.classList.remove('hidden');
    drawHeat(); drawHistory();
  }

  function drawHeat() {
    const cell = (txt, bg, title, color) => el('div', { title, style: { width: '34px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', borderRadius: '4px', background: bg, color: color || 'var(--text)' } }, txt);
    const rows = [el('div', { class: 'row', style: { gap: '3px', flexWrap: 'nowrap', margin: 0 } }, cell('×', 'transparent'), Array.from({ length: MAX }, (_, i) => cell(i + 1, 'var(--line)')))];
    for (let a = 1; a <= MAX; a++) {
      const cells = [cell(a, 'var(--line)')];
      for (let b = 1; b <= MAX; b++) {
        const f = facts[Math.min(a, b) + ',' + Math.max(a, b)];
        if (!f || !f.n) { cells.push(cell('', 'var(--bg)', `${a}×${b}: not practised`)); continue; }
        const acc = f.ok / f.n, avg = f.ms / f.n / 1000;
        // score 0 (bad) .. 1 (good): accuracy weighted 70%, speed 30% (fast = under 2s)
        const sc = 0.7 * acc + 0.3 * Math.max(0, Math.min(1, (6 - avg) / 4));
        const hue = Math.round(sc * 120);
        cells.push(cell(a * b, `hsl(${hue} 65% ${sc > 0.5 ? 45 : 50}%)`, `${a}×${b}: ${Math.round(acc * 100)}% right, ${avg.toFixed(1)} s avg (${f.n} tries)`, '#fff'));
      }
      rows.push(el('div', { class: 'row', style: { gap: '3px', flexWrap: 'nowrap', margin: 0 } }, cells));
    }
    render(heat, el('div', { class: 'col', style: { gap: '3px', width: 'max-content' } }, rows));
  }

  const histBox = el('div', { class: 'row' });
  function drawHistory() {
    const best = s.get('best');
    const h = s.get('history', []);
    const tot = h.reduce((t, x) => t + x.n, 0);
    render(histBox, stat(h.length, 'quizzes'), stat(tot, 'questions'), stat(best ? best.acc + '%' : '—', 'best accuracy'), stat(best ? best.avg + ' s' : '—', 'best avg time'));
  }

  render(root, setup, quizBox, summary, el('hr', { style: { border: 0, borderTop: '1px solid var(--line)', margin: '16px 0' } }), histBox, heatBox);
  drawHeat(); drawHistory();
  return () => clearInterval(tick);
}
