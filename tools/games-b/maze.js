// Maze generator and solver: recursive backtracker / Prim, BFS solve animation, keyboard play, PNG export.
import { el, render, store, loop, toast, download, rng, pad } from '../../lib/ui.js';

const N = 1, E = 2, S = 4, Wl = 8;
const DIRS = [[0, -1, N, S], [1, 0, E, Wl], [0, 1, S, N], [-1, 0, Wl, E]]; // dx, dy, wall here, wall there
const fmt = s => `${Math.floor(s / 60)}:${pad(Math.floor(s % 60))}`;

function generate(cols, rows, algo, rand) {
  const cells = new Uint8Array(cols * rows).fill(N | E | S | Wl);
  const seen = new Uint8Array(cols * rows);
  const carve = (a, b, w, wt) => { cells[a] &= ~w; cells[b] &= ~wt; };
  if (algo === 'prim') {
    const frontier = []; seen[0] = 1;
    const addF = i => { const x = i % cols, y = (i / cols) | 0; for (const [dx, dy, w, wt] of DIRS) { const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < cols && ny < rows && !seen[ny * cols + nx]) frontier.push([i, ny * cols + nx, w, wt]); } };
    addF(0);
    while (frontier.length) {
      const k = Math.floor(rand() * frontier.length); const [a, b, w, wt] = frontier[k]; frontier[k] = frontier[frontier.length - 1]; frontier.pop();
      if (seen[b]) continue; seen[b] = 1; carve(a, b, w, wt); addF(b);
    }
  } else {
    const stack = [0]; seen[0] = 1;
    while (stack.length) {
      const i = stack[stack.length - 1], x = i % cols, y = (i / cols) | 0;
      const opts = DIRS.filter(([dx, dy]) => { const nx = x + dx, ny = y + dy; return nx >= 0 && ny >= 0 && nx < cols && ny < rows && !seen[ny * cols + nx]; });
      if (!opts.length) { stack.pop(); continue; }
      const [dx, dy, w, wt] = opts[Math.floor(rand() * opts.length)]; const j = (y + dy) * cols + x + dx;
      seen[j] = 1; carve(i, j, w, wt); stack.push(j);
    }
  }
  return cells;
}
function bfs(cells, cols, rows, from, to) {
  const prev = new Int32Array(cols * rows).fill(-1), order = [from]; prev[from] = from;
  for (let h = 0; h < order.length; h++) {
    const i = order[h]; if (i === to) break;
    const x = i % cols, y = (i / cols) | 0;
    for (const [dx, dy, w] of DIRS) { if (cells[i] & w) continue; const j = (y + dy) * cols + x + dx; if (prev[j] < 0) { prev[j] = i; order.push(j); } }
  }
  const path = []; if (prev[to] >= 0) { for (let i = to; i !== from; i = prev[i]) path.push(i); path.push(from); path.reverse(); }
  return { order, path };
}

export default function (root) {
  const s = store('maze');
  const canvas = el('canvas', { style: { maxWidth: '100%', height: 'auto', imageRendering: 'pixelated', borderRadius: '4px' } });
  const ctx = canvas.getContext('2d');
  const css = n => getComputedStyle(root).getPropertyValue(n).trim() || '#888';

  let cols = s.get('cols', 20), rows = s.get('rows', 15), algo = s.get('algo', 'backtracker'), seed = 0;
  let cells, cell = 20, solution = null, visited = new Set(), anim = null, stopAnim = null;
  let playing = false, px = 0, py = 0, moves = 0, startT = 0, won = false, trail = new Set();
  let best = s.get('best', {});

  const sizeSel = el('select', { class: 'select', onchange: () => { [cols, rows] = sizeSel.value.split('x').map(Number); s.set('cols', cols); s.set('rows', rows); newMaze(); } },
    [[10, 8], [15, 10], [20, 15], [30, 20], [40, 30], [60, 40]].map(([c, r]) => el('option', { value: `${c}x${r}`, selected: c === cols && r === rows }, `${c} × ${r}`)));
  const algoSel = el('select', { class: 'select', onchange: () => { algo = algoSel.value; s.set('algo', algo); newMaze(); } },
    el('option', { value: 'backtracker', selected: algo === 'backtracker' }, 'Recursive backtracker (long corridors)'),
    el('option', { value: 'prim', selected: algo === 'prim' }, "Prim's algorithm (many short branches)"));
  const seedIn = el('input', { class: 'input mono', style: { width: '110px' }, placeholder: 'seed', onkeydown: e => { if (e.key === 'Enter') newMaze(+seedIn.value || undefined); } });
  const status = el('div', { class: 'row small muted' });
  const playBtn = el('button', { class: 'btn primary', onclick: togglePlay }, 'Play with arrow keys');

  function layout() {
    cell = Math.max(6, Math.min(28, Math.floor(600 / cols), Math.floor(520 / rows)));
    canvas.width = cols * cell + 2; canvas.height = rows * cell + 2;
  }
  function newMaze(sd) {
    stopAnimation();
    seed = sd ?? ((Math.random() * 1e9) >>> 0); seedIn.value = seed;
    cells = generate(cols, rows, algo, rng(seed)); solution = null; visited = new Set();
    playing = false; won = false; px = 0; py = 0; moves = 0; trail = new Set(); playBtn.textContent = 'Play with arrow keys';
    layout(); draw(); showStatus();
  }
  function stopAnimation() { if (stopAnim) { stopAnim(); stopAnim = null; } anim = null; }
  function solve() {
    stopAnimation();
    const { order, path } = bfs(cells, cols, rows, 0, cols * rows - 1);
    visited = new Set(); solution = null;
    let k = 0; const perSec = Math.max(60, cols * rows / 4);
    anim = { order, path, k };
    stopAnim = loop(dt => {
      k += dt * perSec;
      while (anim.k < Math.min(k, order.length)) visited.add(order[anim.k++]);
      if (anim.k >= order.length) { solution = path; stopAnimation(); showStatus(); }
      draw();
    });
    showStatus();
  }
  function togglePlay() {
    playing = !playing;
    if (playing) { stopAnimation(); solution = null; visited = new Set(); px = 0; py = 0; moves = 0; won = false; trail = new Set([0]); startT = performance.now(); playBtn.textContent = 'Stop playing'; canvas.focus(); }
    else playBtn.textContent = 'Play with arrow keys';
    draw(); showStatus();
  }
  function move(d) {
    if (!playing || won) return;
    const [dx, dy, w] = DIRS[d]; const i = py * cols + px;
    if (cells[i] & w) return;
    px += dx; py += dy; moves++; trail.add(py * cols + px);
    if (px === cols - 1 && py === rows - 1) {
      won = true; playing = false; playBtn.textContent = 'Play with arrow keys';
      const t = (performance.now() - startT) / 1000, key = `${cols}x${rows}`;
      const b = best[key]; const record = !b || t < b.time;
      if (record) { best[key] = { time: Math.round(t * 10) / 10, moves }; s.set('best', best); }
      toast(`Finished in ${fmt(t)} with ${moves} moves${record ? ' — new best!' : ''}`);
    }
    draw(); showStatus();
  }
  const onKey = e => {
    if (!playing || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    const map = { ArrowUp: 0, w: 0, ArrowRight: 1, d: 1, ArrowDown: 2, s: 2, ArrowLeft: 3, a: 3 };
    if (e.key in map) { e.preventDefault(); move(map[e.key]); }
    else if (e.key === 'Escape') togglePlay();
  };
  window.addEventListener('keydown', onKey);

  function paint(g, opts) {
    const w = cols * cell + 2, h = rows * cell + 2;
    g.fillStyle = opts.export ? '#fff' : css('--panel'); g.fillRect(0, 0, w, h);
    const box = (i, color) => { g.fillStyle = color; g.fillRect(1 + (i % cols) * cell, 1 + ((i / cols) | 0) * cell, cell, cell); };
    if (!opts.export) for (const i of visited) box(i, 'rgba(47,111,237,.18)');
    if (!opts.export && playing) for (const i of trail) box(i, 'rgba(217,140,11,.22)');
    box(0, 'rgba(31,157,85,.35)'); box(cols * rows - 1, 'rgba(214,69,69,.35)');
    if (opts.solution && solution) {
      g.strokeStyle = '#d64545'; g.lineWidth = Math.max(2, cell / 4); g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath();
      solution.forEach((i, k) => g[k ? 'lineTo' : 'moveTo'](1 + (i % cols) * cell + cell / 2, 1 + ((i / cols) | 0) * cell + cell / 2)); g.stroke();
    }
    g.strokeStyle = opts.export ? '#000' : css('--text'); g.lineWidth = 2; g.lineCap = 'square'; g.beginPath();
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const c = cells[y * cols + x], X = 1 + x * cell, Y = 1 + y * cell;
      if (c & N) { g.moveTo(X, Y); g.lineTo(X + cell, Y); }
      if (c & Wl) { g.moveTo(X, Y); g.lineTo(X, Y + cell); }
      if (c & S) { g.moveTo(X, Y + cell); g.lineTo(X + cell, Y + cell); }
      if (c & E) { g.moveTo(X + cell, Y); g.lineTo(X + cell, Y + cell); }
    }
    g.stroke();
    if (!opts.export && (playing || won)) { g.fillStyle = '#d98c0b'; g.beginPath(); g.arc(1 + px * cell + cell / 2, 1 + py * cell + cell / 2, cell * 0.32, 0, Math.PI * 2); g.fill(); }
  }
  function draw() { paint(ctx, { solution: true }); }
  function exportPng(withSolution) {
    if (withSolution && !solution) solution = bfs(cells, cols, rows, 0, cols * rows - 1).path;
    const c = el('canvas', { width: canvas.width, height: canvas.height });
    paint(c.getContext('2d'), { export: true, solution: withSolution });
    c.toBlob(b => download(`maze-${cols}x${rows}-${seed}${withSolution ? '-solution' : ''}.png`, b, 'image/png'), 'image/png');
    if (withSolution) draw();
  }
  function showStatus() {
    const key = `${cols}x${rows}`, b = best[key];
    render(status,
      el('span', {}, `Seed ${seed} · ${cols}×${rows} · ${algo === 'prim' ? 'Prim' : 'backtracker'}`),
      anim ? el('span', { class: 'badge warn' }, 'solving…') : solution ? el('span', { class: 'badge ok' }, `path ${solution.length} cells`) : null,
      playing ? el('span', { class: 'badge' }, `moves ${moves}`) : null,
      b ? el('span', {}, `· best ${key}: ${fmt(b.time)} / ${b.moves} moves`) : el('span', {}, '· no best time yet for this size'));
  }
  const dpad = el('div', { class: 'row center', style: { gap: '4px' } },
    ['↑', '←', '↓', '→'].map((t, k) => el('button', { class: 'btn small', onpointerdown: e => { e.preventDefault(); move([0, 3, 2, 1][k]); } }, t)));

  render(root,
    el('div', { class: 'row' },
      el('label', { class: 'inline' }, 'Size ', sizeSel), el('label', { class: 'inline' }, 'Algorithm ', algoSel),
      el('label', { class: 'inline' }, 'Seed ', seedIn),
      el('button', { class: 'btn', onclick: () => newMaze(seedIn.value.trim() ? +seedIn.value : undefined) }, 'Generate')),
    el('div', { class: 'row' },
      el('button', { class: 'btn', onclick: solve }, 'Solve (BFS animation)'), playBtn,
      el('button', { class: 'btn ghost small', onclick: () => exportPng(false) }, 'Export PNG'),
      el('button', { class: 'btn ghost small', onclick: () => exportPng(true) }, 'Export PNG with solution'),
      el('span', { class: 'small muted' }, 'Green = start, red = goal. ', el('span', { class: 'kbd' }, 'Arrows'), '/', el('span', { class: 'kbd' }, 'WASD'), ' move, ', el('span', { class: 'kbd' }, 'Esc'), ' stops.')),
    status,
    el('div', { class: 'canvas-wrap' }, canvas), dpad);
  newMaze();
  return () => { stopAnimation(); window.removeEventListener('keydown', onKey); };
}
