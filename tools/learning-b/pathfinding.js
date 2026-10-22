// Pathfinding visualizer: BFS, DFS, Dijkstra, A* on a grid with walls, weights-free, animated.
import { el, render, store, stat, field, toast, rng } from '../../lib/ui.js';

export default function (root) {
  const s = store('pathfinding');
  const COLS = 36, ROWS = 20;
  let cell = 20;
  let walls = new Set(s.get('walls', []));
  let start = s.get('start', { r: 10, c: 5 });
  let end = s.get('end', { r: 10, c: 30 });
  let algo = s.get('algo', 'astar');
  let speed = s.get('speed', 3); // 1..5
  let visited = new Map(); // key -> order index
  let path = [];
  let running = false, timer = null, drag = null;
  const key = (r, c) => r + ',' + c;
  const inB = (r, c) => r >= 0 && c >= 0 && r < ROWS && c < COLS;

  const canvas = el('canvas', { width: COLS * cell, height: ROWS * cell, style: { maxWidth: '100%', touchAction: 'none', cursor: 'crosshair', display: 'block' } });
  const ctx = canvas.getContext('2d');
  const statsBox = el('div', { class: 'row' });
  const status = el('div', { class: 'muted small' }, 'Drag on the grid to draw walls. Drag the green and red cells to move start and end.');

  function css(name) { return getComputedStyle(root).getPropertyValue(name).trim() || '#888'; }

  function draw() {
    const W = canvas.width, H = canvas.height;
    ctx.fillStyle = css('--bg'); ctx.fillRect(0, 0, W, H);
    const line = css('--line'), accent = css('--accent');
    const pathSet = new Set(path.map(p => key(p.r, p.c)));
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const k = key(r, c);
      let fill = null;
      if (walls.has(k)) fill = css('--text');
      else if (pathSet.has(k)) fill = css('--warn');
      else if (visited.has(k)) { const t = visited.get(k) / Math.max(1, visited.size); fill = `hsl(${200 + t * 80} 70% ${60 - t * 10}%)`; }
      if (fill) { ctx.fillStyle = fill; ctx.fillRect(c * cell, r * cell, cell, cell); }
    }
    ctx.strokeStyle = line; ctx.lineWidth = 1; ctx.beginPath();
    for (let c = 0; c <= COLS; c++) { ctx.moveTo(c * cell + .5, 0); ctx.lineTo(c * cell + .5, H); }
    for (let r = 0; r <= ROWS; r++) { ctx.moveTo(0, r * cell + .5); ctx.lineTo(W, r * cell + .5); }
    ctx.stroke();
    ctx.fillStyle = css('--ok'); ctx.fillRect(start.c * cell + 2, start.r * cell + 2, cell - 4, cell - 4);
    ctx.fillStyle = css('--danger'); ctx.fillRect(end.c * cell + 2, end.r * cell + 2, cell - 4, cell - 4);
    ctx.strokeStyle = accent; ctx.lineWidth = 2;
    ctx.strokeRect(start.c * cell + 1, start.r * cell + 1, cell - 2, cell - 2);
    ctx.strokeRect(end.c * cell + 1, end.r * cell + 1, cell - 2, cell - 2);
  }

  function updateStats(done) {
    render(statsBox,
      stat(visited.size, 'visited'),
      stat(path.length ? path.length - 1 : (done ? 'none' : '–'), 'path length'),
      stat(walls.size, 'walls'),
      stat({ bfs: 'BFS', dfs: 'DFS', dijkstra: 'Dijkstra', astar: 'A*' }[algo], 'algorithm'));
  }

  function neighbors(r, c) {
    const out = [];
    for (const [dr, dc] of [[-1, 0], [0, 1], [1, 0], [0, -1]]) { const nr = r + dr, nc = c + dc; if (inB(nr, nc) && !walls.has(key(nr, nc))) out.push([nr, nc]); }
    return out;
  }

  // Each algorithm yields visited cells in order and returns the path (array of {r,c}) or null.
  function* search() {
    const sk = key(start.r, start.c), ek = key(end.r, end.c);
    const prev = new Map([[sk, null]]);
    const h = (r, c) => Math.abs(r - end.r) + Math.abs(c - end.c);
    const buildPath = () => { const out = []; let k = ek; while (k) { const [r, c] = k.split(',').map(Number); out.push({ r, c }); k = prev.get(k); } return out.reverse(); };
    if (algo === 'bfs' || algo === 'dfs') {
      const frontier = [[start.r, start.c]];
      const seen = new Set([sk]);
      while (frontier.length) {
        const [r, c] = algo === 'bfs' ? frontier.shift() : frontier.pop();
        const k = key(r, c);
        yield [r, c];
        if (k === ek) return buildPath();
        for (const [nr, nc] of neighbors(r, c)) { const nk = key(nr, nc); if (!seen.has(nk)) { seen.add(nk); prev.set(nk, k); frontier.push([nr, nc]); } }
      }
      return null;
    }
    // Dijkstra / A*: simple binary heap
    const heap = []; const push = (it) => { heap.push(it); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p].f <= heap[i].f) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { let l = 2 * i + 1, rr = l + 1, m = i; if (l < heap.length && heap[l].f < heap[m].f) m = l; if (rr < heap.length && heap[rr].f < heap[m].f) m = rr; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    const dist = new Map([[sk, 0]]); const closed = new Set();
    push({ r: start.r, c: start.c, g: 0, f: algo === 'astar' ? h(start.r, start.c) : 0 });
    while (heap.length) {
      const cur = pop(); const k = key(cur.r, cur.c);
      if (closed.has(k)) continue; closed.add(k);
      yield [cur.r, cur.c];
      if (k === ek) return buildPath();
      for (const [nr, nc] of neighbors(cur.r, cur.c)) {
        const nk = key(nr, nc); const g = cur.g + 1;
        if (g < (dist.has(nk) ? dist.get(nk) : Infinity)) { dist.set(nk, g); prev.set(nk, k); push({ r: nr, c: nc, g, f: g + (algo === 'astar' ? h(nr, nc) : 0) }); }
      }
    }
    return null;
  }

  function stop() { running = false; clearTimeout(timer); timer = null; runBtn.textContent = 'Run'; }
  function clearSearch() { visited = new Map(); path = []; draw(); updateStats(false); }

  function run() {
    if (running) { stop(); return; }
    clearSearch(); running = true; runBtn.textContent = 'Stop';
    const gen = search();
    const perTick = [1, 2, 5, 12, 40][speed - 1];
    const step = () => {
      if (!running) return;
      for (let i = 0; i < perTick; i++) {
        const n = gen.next();
        if (n.done) {
          path = n.value || []; running = false; runBtn.textContent = 'Run';
          draw(); updateStats(true);
          status.textContent = path.length ? `Found a path of ${path.length - 1} steps after visiting ${visited.size} cells.` : `No path exists — visited ${visited.size} cells.`;
          return;
        }
        visited.set(key(n.value[0], n.value[1]), visited.size);
      }
      draw(); updateStats(false);
      timer = setTimeout(step, 16);
    };
    step();
  }

  function instant() { stop(); clearSearch(); const gen = search(); for (;;) { const n = gen.next(); if (n.done) { path = n.value || []; break; } visited.set(key(...n.value), visited.size); } draw(); updateStats(true); }

  function maze() {
    stop(); clearSearch();
    // Randomised DFS maze on odd cells
    walls = new Set();
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) walls.add(key(r, c));
    const rand = rng(Date.now() & 0xffff);
    const carve = (r, c) => { walls.delete(key(r, c)); };
    const stack = [[1, 1]]; carve(1, 1);
    const seen = new Set([key(1, 1)]);
    while (stack.length) {
      const [r, c] = stack[stack.length - 1];
      const opts = [[-2, 0], [2, 0], [0, -2], [0, 2]].map(([dr, dc]) => [r + dr, c + dc]).filter(([nr, nc]) => nr > 0 && nc > 0 && nr < ROWS - 1 && nc < COLS - 1 && !seen.has(key(nr, nc)));
      if (!opts.length) { stack.pop(); continue; }
      const [nr, nc] = opts[Math.floor(rand() * opts.length)];
      seen.add(key(nr, nc)); carve(nr, nc); carve((r + nr) / 2, (c + nc) / 2); stack.push([nr, nc]);
    }
    // a few extra openings so there are alternative routes
    for (let i = 0; i < 25; i++) { const r = 1 + Math.floor(rand() * (ROWS - 2)), c = 1 + Math.floor(rand() * (COLS - 2)); walls.delete(key(r, c)); }
    start = { r: 1, c: 1 }; end = { r: ROWS - 2 - ((ROWS - 2) % 2 ? 0 : 1), c: COLS - 2 - ((COLS - 2) % 2 ? 0 : 1) };
    walls.delete(key(start.r, start.c)); walls.delete(key(end.r, end.c));
    save(); draw(); updateStats(false); status.textContent = 'Maze generated with randomised depth-first carving.';
  }

  function save() { s.set('walls', [...walls]); s.set('start', start); s.set('end', end); }

  function cellAt(e) {
    const b = canvas.getBoundingClientRect();
    const x = (e.clientX - b.left) * (canvas.width / b.width), y = (e.clientY - b.top) * (canvas.height / b.height);
    return { r: Math.floor(y / cell), c: Math.floor(x / cell) };
  }
  canvas.addEventListener('pointerdown', e => {
    e.preventDefault(); canvas.setPointerCapture(e.pointerId);
    const p = cellAt(e); if (!inB(p.r, p.c)) return;
    if (p.r === start.r && p.c === start.c) drag = { what: 'start' };
    else if (p.r === end.r && p.c === end.c) drag = { what: 'end' };
    else { drag = { what: walls.has(key(p.r, p.c)) ? 'erase' : 'wall' }; paint(p); }
  });
  canvas.addEventListener('pointermove', e => { if (!drag) return; const p = cellAt(e); if (inB(p.r, p.c)) paint(p); });
  const up = () => { if (drag) { drag = null; save(); } };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  function paint(p) {
    const k = key(p.r, p.c);
    if (drag.what === 'start') { if (!walls.has(k) && !(p.r === end.r && p.c === end.c)) start = { ...p }; }
    else if (drag.what === 'end') { if (!walls.has(k) && !(p.r === start.r && p.c === start.c)) end = { ...p }; }
    else if (k !== key(start.r, start.c) && k !== key(end.r, end.c)) { if (drag.what === 'wall') walls.add(k); else walls.delete(k); }
    if (visited.size && !running) { visited = new Map(); path = []; }
    else if (running) { stop(); visited = new Map(); path = []; }
    draw(); updateStats(false);
  }

  const algoSel = el('select', { class: 'select', value: algo, onchange: () => { algo = algoSel.value; s.set('algo', algo); clearSearch(); } },
    el('option', { value: 'bfs' }, 'Breadth-first search'), el('option', { value: 'dfs' }, 'Depth-first search'),
    el('option', { value: 'dijkstra' }, 'Dijkstra'), el('option', { value: 'astar' }, 'A* (Manhattan)'));
  algoSel.value = algo;
  const speedIn = el('input', { type: 'range', min: 1, max: 5, value: speed, oninput: () => { speed = +speedIn.value; s.set('speed', speed); } });
  const runBtn = el('button', { class: 'btn primary', onclick: run }, 'Run');

  render(root,
    el('div', { class: 'row' },
      field('Algorithm', algoSel), field('Speed', speedIn),
      runBtn,
      el('button', { class: 'btn', onclick: instant }, 'Instant'),
      el('button', { class: 'btn', onclick: maze }, 'Generate maze'),
      el('button', { class: 'btn ghost', onclick: () => { stop(); clearSearch(); } }, 'Clear search'),
      el('button', { class: 'btn ghost', onclick: () => { stop(); walls = new Set(); save(); clearSearch(); } }, 'Clear walls')),
    el('div', { class: 'canvas-wrap' }, canvas),
    status, statsBox,
    el('div', { class: 'muted small' },
      'BFS explores in rings and always finds a shortest path on an unweighted grid. DFS dives deep and rarely finds a short one. ',
      'Dijkstra equals BFS here because every step costs 1. A* adds the Manhattan distance heuristic so it visits far fewer cells.'));
  draw(); updateStats(false);
  return () => { stop(); };
}
