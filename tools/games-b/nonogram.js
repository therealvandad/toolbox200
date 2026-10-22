// Nonogram / picross: built-in puzzles, random solvable generator, drag painting, error check, timer.
import { el, render, store, toast, rng } from '../../lib/ui.js';

const BUILT_IN = [
  { name: 'Heart (5x5)', rows: ['01010', '11111', '11111', '01110', '00100'] },
  { name: 'Cross (5x5)', rows: ['00100', '00100', '11111', '00100', '00100'] },
  { name: 'Letter X (5x5)', rows: ['10001', '01010', '00100', '01010', '10001'] },
  { name: 'House (7x7)', rows: ['0001000', '0011100', '0111110', '1111111', '0110110', '0110110', '0111110'] },
  { name: 'Invader (8x8)', rows: ['00100100', '00011000', '00111100', '01101101', '11111111', '10111101', '10100101', '00011000'] },
  { name: 'Tree (10x10)', rows: ['0000110000', '0001111000', '0011111100', '0001111000', '0011111100', '0111111110', '1111111111', '0000110000', '0000110000', '0001111000'] },
  { name: 'Cat (10x10)', rows: ['1000000001', '1100000011', '1111111111', '1101111011', '1111111111', '1110000111', '1111111111', '0111111110', '0011111100', '0001111000'] },
  { name: 'Mug (10x10)', rows: ['0000000000', '1111111000', '1000001100', '1000001010', '1000001010', '1000001100', '1000001000', '1111111000', '0111110000', '0000000000'] },
  { name: 'Duck (12x12)', rows: ['000011110000', '000111111000', '001101111000', '001111111000', '000111100000', '000011100000', '011111111100', '111111111110', '111111111110', '011111111100', '001111111000', '000000000000'] },
  { name: 'Sailboat (15x15)', rows: ['000000010000000', '000000110000000', '000001110000000', '000011110000000', '000111110000000', '001111110000000', '011111110000000', '111111110000000', '000000011111100', '000000010000000', '000000010000000', '111111111111111', '011111111111110', '001111111111100', '000111111111000'] },
  { name: 'Big heart (15x15)', rows: ['000000000000000', '001110000011100', '011111000111110', '111111101111111', '111111111111111', '111111111111111', '111111111111111', '011111111111110', '001111111111100', '000111111111000', '000011111110000', '000001111100000', '000000111000000', '000000010000000', '000000000000000'] },
];

const clueOf = line => { const out = []; let n = 0; for (const v of line) { if (v) n++; else if (n) { out.push(n); n = 0; } } if (n) out.push(n); return out.length ? out : [0]; };

// Line solver used to check that a random puzzle can be solved by pure line logic (so it is unique).
function lineSolve(clue, cells) { // cells: 0 unknown, 1 filled, -1 empty. Returns new cells or null if contradiction
  const n = cells.length; if (clue.length === 1 && clue[0] === 0) return cells.some(c => c === 1) ? null : Array(n).fill(-1);
  const res = Array(n).fill(0), seen = Array(n).fill(0); let found = false;
  const place = (ci, pos, cur) => {
    if (ci === clue.length) { for (let i = pos; i < n; i++) if (cells[i] === 1) return; for (let i = 0; i < n; i++) seen[i] |= cur[i] === 1 ? 1 : 2; found = true; return; }
    const len = clue[ci], rest = clue.slice(ci + 1).reduce((a, b) => a + b + 1, 0);
    for (let st = pos; st + len + rest <= n; st++) {
      if (cells[st - 1] === 1 && st > pos) break;
      let ok = true; for (let i = st; i < st + len; i++) if (cells[i] === -1) { ok = false; break; }
      if (ok && cells[st + len] === 1) ok = false;
      if (ok) { for (let i = st; i < st + len; i++) cur[i] = 1; place(ci + 1, st + len + 1, cur); for (let i = st; i < st + len; i++) cur[i] = 0; }
      if (cells[st] === 1) break;
    }
  };
  place(0, 0, Array(n).fill(0));
  if (!found) return null;
  for (let i = 0; i < n; i++) res[i] = seen[i] === 1 ? 1 : seen[i] === 2 ? -1 : cells[i];
  return res;
}
function solvable(sol) {
  const n = sol.length, rc = sol.map(clueOf), cc = sol[0].map((_, c) => clueOf(sol.map(r => r[c])));
  let g = sol.map(() => Array(n).fill(0)), changed = true, guard = 0;
  while (changed && guard++ < 60) {
    changed = false;
    for (let r = 0; r < n; r++) { const nl = lineSolve(rc[r], g[r]); if (!nl) return false; if (nl.some((v, i) => v !== g[r][i])) { g[r] = nl; changed = true; } }
    for (let c = 0; c < n; c++) { const col = g.map(r => r[c]); const nl = lineSolve(cc[c], col); if (!nl) return false; if (nl.some((v, i) => v !== col[i])) { nl.forEach((v, i) => g[i][c] = v); changed = true; } }
  }
  return g.every(r => r.every(v => v !== 0));
}
function randomPuzzle(n, seed) {
  const r = rng(seed);
  for (let t = 0; t < 40; t++) {
    const d = 0.5 + r() * 0.2;
    const sol = Array.from({ length: n }, () => Array.from({ length: n }, () => r() < d ? 1 : 0));
    if (n <= 12 ? solvable(sol) : t > 10 || solvable(sol)) return sol;
  }
  return Array.from({ length: n }, () => Array.from({ length: n }, () => r() < 0.55 ? 1 : 0));
}

export default function (root) {
  const s = store('nonogram');
  let sol, n, grid, cellEls = [], rowClueEls = [], colClueEls = [], timer = null, seconds = 0, done = false, cur = [0, 0], tool = 'fill', painting = null, name = '';
  const puzzleSel = el('select', { class: 'select' }, BUILT_IN.map((p, i) => el('option', { value: i }, p.name)));
  const sizeSel = el('select', { class: 'select' }, [5, 7, 10, 12, 15].map(v => el('option', { value: v }, v + 'x' + v + ' random')));
  const board = el('div', { style: { display: 'inline-grid', gap: '0', userSelect: 'none', touchAction: 'none', margin: '8px auto' } });
  const wrap = el('div', { class: 'scroll-x', style: { textAlign: 'center' } }, board);
  const timeEl = el('span', { class: 'mono' }, '0:00');
  const info = el('div', { class: 'row small muted' });
  const toolBtns = el('div', { class: 'row' });
  const fmtT = t => Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');

  function load(solution, title) {
    sol = solution; n = sol.length; name = title; grid = sol.map(r => r.map(() => 0)); done = false; seconds = 0; cur = [0, 0];
    clearInterval(timer); timer = setInterval(() => { seconds++; timeEl.textContent = fmtT(seconds); }, 1000); timeEl.textContent = '0:00';
    const rc = sol.map(clueOf), cc = sol[0].map((_, c) => clueOf(sol.map(r => r[c])));
    const maxR = Math.max(...rc.map(c => c.length)), maxC = Math.max(...cc.map(c => c.length));
    const size = n <= 7 ? 36 : n <= 10 ? 30 : 24;
    board.style.gridTemplateColumns = `${maxR * (size * 0.6) + 8}px repeat(${n}, ${size}px)`;
    board.style.gridTemplateRows = `${maxC * (size * 0.6) + 8}px repeat(${n}, ${size}px)`;
    cellEls = []; rowClueEls = []; colClueEls = [];
    const kids = [el('div', {})];
    for (let c = 0; c < n; c++) { const e = el('div', { class: 'mono small', style: { display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', fontSize: size * 0.45 + 'px', lineHeight: 1.15, borderBottom: '2px solid var(--text)', borderRight: (c + 1) % 5 === 0 && c < n - 1 ? '2px solid var(--muted)' : '1px solid var(--line)' } }, cc[c].map(v => el('span', {}, v))); colClueEls.push(e); kids.push(e); }
    for (let r = 0; r < n; r++) {
      const e = el('div', { class: 'mono small', style: { display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '4px', paddingRight: '6px', fontSize: size * 0.45 + 'px', borderRight: '2px solid var(--text)', borderBottom: (r + 1) % 5 === 0 && r < n - 1 ? '2px solid var(--muted)' : '1px solid var(--line)' } }, rc[r].map(v => el('span', {}, v)));
      rowClueEls.push(e); kids.push(e);
      for (let c = 0; c < n; c++) {
        const cell = el('div', { 'data-rc': r + ',' + c, style: { boxSizing: 'border-box', borderRight: (c + 1) % 5 === 0 && c < n - 1 ? '2px solid var(--muted)' : '1px solid var(--line)', borderBottom: (r + 1) % 5 === 0 && r < n - 1 ? '2px solid var(--muted)' : '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.6 + 'px', color: 'var(--muted)', cursor: 'pointer' } });
        cellEls.push(cell); kids.push(cell);
      }
    }
    render(board, kids);
    paintAll(); updateInfo();
  }
  function paintCell(r, c) {
    const e = cellEls[r * n + c], v = grid[r][c];
    e.style.background = v === 1 ? 'var(--text)' : 'transparent'; e.textContent = v === -1 ? '×' : '';
    e.style.outline = (r === cur[0] && c === cur[1]) ? '2px solid var(--accent)' : ''; e.style.outlineOffset = '-2px'; e.style.zIndex = (r === cur[0] && c === cur[1]) ? 1 : '';
  }
  function paintAll() { for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) paintCell(r, c); checkLines(); }
  function checkLines() {
    const rc = sol.map(clueOf), cc = sol[0].map((_, c) => clueOf(sol.map(r => r[c])));
    let all = true;
    for (let r = 0; r < n; r++) { const ok = JSON.stringify(clueOf(grid[r].map(v => v === 1 ? 1 : 0))) === JSON.stringify(rc[r]); rowClueEls[r].style.color = ok ? 'var(--muted)' : ''; all = all && ok; }
    for (let c = 0; c < n; c++) { const ok = JSON.stringify(clueOf(grid.map(r => r[c] === 1 ? 1 : 0))) === JSON.stringify(cc[c]); colClueEls[c].style.color = ok ? 'var(--muted)' : ''; all = all && ok; }
    if (all && !done) {
      done = true; clearInterval(timer);
      const key = 'best:' + name, b = s.get(key, null);
      if (b == null || seconds < b) { s.set(key, seconds); toast('Solved in ' + fmtT(seconds) + ' — new best!'); } else toast('Solved in ' + fmtT(seconds));
      cellEls.forEach((e, i) => { if (grid[Math.floor(i / n)][i % n] !== 1) e.textContent = ''; });
      updateInfo();
    }
  }
  function updateInfo() {
    const b = s.get('best:' + name, null);
    render(info, el('b', {}, name), el('span', {}, 'Time ', timeEl), el('span', {}, 'Best ', b == null ? '—' : fmtT(b)), done ? el('span', { class: 'badge ok' }, 'Solved') : null);
  }
  function setCell(r, c, v) { if (done || r < 0 || c < 0 || r >= n || c >= n) return; grid[r][c] = v; paintCell(r, c); checkLines(); }
  function apply(r, c) {
    if (painting == null) return;
    setCell(r, c, painting);
  }
  const rcOf = t => { if (!t || !t.dataset || !t.dataset.rc) return null; return t.dataset.rc.split(',').map(Number); };
  board.addEventListener('contextmenu', e => e.preventDefault());
  board.addEventListener('pointerdown', e => {
    const rc = rcOf(e.target); if (!rc) return; e.preventDefault();
    const [r, c] = rc; const want = e.button === 2 || tool === 'cross' ? -1 : 1;
    painting = grid[r][c] === want ? 0 : want; cur = [r, c]; const old = cellEls; apply(r, c); old.forEach((_, i) => { if (i !== r * n + c) {} });
    paintAll();
  });
  board.addEventListener('pointermove', e => {
    if (painting == null) return;
    const t = e.pointerType === 'touch' ? document.elementFromPoint(e.clientX, e.clientY) : e.target; const rc = rcOf(t); if (rc) apply(rc[0], rc[1]);
  });
  const endPaint = () => { painting = null; };
  window.addEventListener('pointerup', endPaint);
  const onKey = e => {
    const k = e.key; if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'x', 'X', 'z', 'Z', 'Enter'].includes(k)) return;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
    e.preventDefault();
    const [r, c] = cur;
    if (k === 'ArrowUp') cur = [Math.max(0, r - 1), c]; if (k === 'ArrowDown') cur = [Math.min(n - 1, r + 1), c];
    if (k === 'ArrowLeft') cur = [r, Math.max(0, c - 1)]; if (k === 'ArrowRight') cur = [r, Math.min(n - 1, c + 1)];
    if (k === ' ' || k === 'Enter' || k === 'z' || k === 'Z') setCell(r, c, grid[r][c] === 1 ? 0 : 1);
    if (k === 'x' || k === 'X') setCell(r, c, grid[r][c] === -1 ? 0 : -1);
    paintCell(r, c); paintCell(cur[0], cur[1]);
  };
  window.addEventListener('keydown', onKey);

  function setTool(t) { tool = t; render(toolBtns, el('button', { class: 'btn small' + (tool === 'fill' ? ' primary' : ''), onclick: () => setTool('fill') }, '■ Fill'), el('button', { class: 'btn small' + (tool === 'cross' ? ' primary' : ''), onclick: () => setTool('cross') }, '× Cross'), el('span', { class: 'small muted' }, 'Right-click always crosses. Drag to paint.')); }
  setTool('fill');
  function errorCheck() {
    let bad = 0;
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) { const e = cellEls[r * n + c]; if (grid[r][c] === 1 && !sol[r][c]) { e.style.background = 'var(--danger)'; bad++; } }
    toast(bad ? bad + ' wrong cell' + (bad > 1 ? 's' : '') + ' highlighted' : 'No mistakes so far');
    if (bad) setTimeout(paintAll, 1500);
  }

  render(root,
    el('div', { class: 'row' },
      el('label', { class: 'inline' }, 'Puzzle ', puzzleSel), el('button', { class: 'btn primary', onclick: () => { const p = BUILT_IN[+puzzleSel.value]; load(p.rows.map(r => [...r].map(Number)), p.name); } }, 'Load'),
      el('label', { class: 'inline' }, 'or ', sizeSel), el('button', { class: 'btn', onclick: () => { const sz = +sizeSel.value, seed = (Math.random() * 1e9) >>> 0; load(randomPuzzle(sz, seed), `Random ${sz}x${sz} #${seed % 10000}`); } }, 'Random puzzle')),
    el('div', { class: 'row' }, toolBtns, el('button', { class: 'btn small', onclick: errorCheck }, 'Check errors'), el('button', { class: 'btn small ghost', onclick: () => { grid = sol.map(r => r.map(() => 0)); done = false; paintAll(); } }, 'Clear'),
      el('span', { class: 'small muted' }, el('span', { class: 'kbd' }, 'Arrows'), ' move, ', el('span', { class: 'kbd' }, 'Space'), ' fill, ', el('span', { class: 'kbd' }, 'X'), ' cross')),
    info, wrap);
  load(BUILT_IN[0].rows.map(r => [...r].map(Number)), BUILT_IN[0].name);
  return () => { clearInterval(timer); window.removeEventListener('pointerup', endPaint); window.removeEventListener('keydown', onKey); };
}
