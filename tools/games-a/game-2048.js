// 2048 with undo: arrow keys / WASD / swipe, sliding tiles, undo stack, best score.
import { el, render, store, stat, toast } from '../../lib/ui.js';

const N = 4;
const COLORS = { 2: [45, 30, 88], 4: [40, 45, 80], 8: [30, 80, 62], 16: [25, 85, 58], 32: [15, 85, 55], 64: [8, 85, 50],
  128: [50, 75, 50], 256: [50, 80, 45], 512: [50, 85, 40], 1024: [50, 90, 36], 2048: [48, 95, 32] };

export default function (root) {
  const s = store('game-2048');
  let tiles = [], score = 0, best = s.get('best', 0), undoStack = [], over = false, won = false, nextId = 1, animating = false;
  const elems = new Map();

  const board = el('div', { style: { position: 'relative', width: '100%', maxWidth: '420px', aspectRatio: '1', background: 'var(--line)', borderRadius: '10px', touchAction: 'none', userSelect: 'none' } });
  for (let i = 0; i < N * N; i++) {
    const r = Math.floor(i / N), c = i % N;
    board.append(el('div', { style: cellStyle(r, c, 'var(--bg)') }));
  }
  const overlay = el('div', { class: 'hidden', style: { position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.45)', color: '#fff', borderRadius: '10px', gap: '10px', zIndex: 5 } });
  board.append(overlay);
  const stats = el('div', { class: 'row' });
  const undoBtn = el('button', { class: 'btn', onclick: undo }, 'Undo');
  const msg = el('div', { class: 'muted small' }, 'Use arrow keys, WASD or swipe. Reach 2048!');

  function cellStyle(r, c, bg) {
    return { position: 'absolute', left: `calc(${c * 25}% + 5px)`, top: `calc(${r * 25}% + 5px)`, width: 'calc(25% - 10px)', height: 'calc(25% - 10px)', borderRadius: '8px', background: bg };
  }
  function tileColor(v) {
    const [h, sat, l] = COLORS[v] || [280, 70, 40];
    return `hsl(${h},${sat}%,${l}%)`;
  }
  function makeElem(t) {
    const node = el('div', { style: { ...cellStyle(t.r, t.c, tileColor(t.v)), display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: t.v <= 4 ? '#5b4b35' : '#fff', fontSize: t.v < 100 ? '30px' : t.v < 1000 ? '24px' : '19px', transition: 'left .12s ease, top .12s ease, transform .12s ease', transform: 'scale(0)', zIndex: 2 } }, t.v);
    board.append(node);
    node.getBoundingClientRect();
    node.style.transform = 'scale(1)';
    elems.set(t.id, node);
    return node;
  }
  function position(t) {
    const node = elems.get(t.id); if (!node) return;
    node.style.left = `calc(${t.c * 25}% + 5px)`; node.style.top = `calc(${t.r * 25}% + 5px)`;
  }
  function emptyCells() {
    const taken = new Set(tiles.map(t => t.r * N + t.c));
    const out = []; for (let i = 0; i < N * N; i++) if (!taken.has(i)) out.push(i);
    return out;
  }
  function addRandom() {
    const empties = emptyCells(); if (!empties.length) return;
    const i = empties[Math.floor(Math.random() * empties.length)];
    const t = { id: nextId++, r: Math.floor(i / N), c: i % N, v: Math.random() < 0.9 ? 2 : 4 };
    tiles.push(t); makeElem(t);
  }
  function snapshot() { return { tiles: tiles.map(t => ({ r: t.r, c: t.c, v: t.v })), score }; }
  function restore(snap) {
    for (const node of elems.values()) node.remove();
    elems.clear();
    tiles = snap.tiles.map(t => ({ ...t, id: nextId++ }));
    score = snap.score; over = false;
    tiles.forEach(makeElem);
    overlay.classList.add('hidden');
    updateStats();
  }
  function canMove() {
    if (emptyCells().length) return true;
    const g = grid();
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      if (c < N - 1 && g[r][c].v === g[r][c + 1].v) return true;
      if (r < N - 1 && g[r][c].v === g[r + 1][c].v) return true;
    }
    return false;
  }
  function grid() {
    const g = Array.from({ length: N }, () => Array(N).fill(null));
    tiles.forEach(t => (g[t.r][t.c] = t));
    return g;
  }
  function move(dr, dc) {
    if (over || animating) return;
    const g = grid();
    const rows = [0, 1, 2, 3], cols = [0, 1, 2, 3];
    if (dr === 1) rows.reverse(); if (dc === 1) cols.reverse();
    let moved = false, gained = 0;
    const removed = [], created = [];
    const before = snapshot();
    for (const r of rows) for (const c of cols) {
      const t = g[r][c]; if (!t) continue;
      let nr = r, nc = c;
      while (true) {
        const rr = nr + dr, cc = nc + dc;
        if (rr < 0 || rr >= N || cc < 0 || cc >= N || g[rr][cc]) break;
        nr = rr; nc = cc;
      }
      const ar = nr + dr, ac = nc + dc;
      const next = (ar >= 0 && ar < N && ac >= 0 && ac < N) ? g[ar][ac] : null;
      if (next && next.v === t.v && !next.merged) {
        g[r][c] = null;
        const m = { id: nextId++, r: ar, c: ac, v: t.v * 2, merged: true };
        g[ar][ac] = m;
        t.r = ar; t.c = ac; next.r = ar; next.c = ac;
        removed.push(t, next); created.push(m);
        gained += m.v; moved = true;
        if (m.v === 2048 && !won) { won = true; setTimeout(() => toast('You made 2048! Keep going.'), 150); }
      } else if (nr !== r || nc !== c) {
        g[r][c] = null; g[nr][nc] = t; t.r = nr; t.c = nc; moved = true;
      }
    }
    if (!moved) return;
    undoStack.push(before); if (undoStack.length > 100) undoStack.shift();
    score += gained;
    tiles.forEach(position); removed.forEach(position);
    tiles = g.flat().filter(Boolean);
    tiles.forEach(t => (t.merged = false));
    animating = true;
    setTimeout(() => {
      removed.forEach(t => { const n = elems.get(t.id); if (n) n.remove(); elems.delete(t.id); });
      created.forEach(t => { const n = makeElem(t); n.style.transform = 'scale(1.15)'; setTimeout(() => (n.style.transform = 'scale(1)'), 100); });
      addRandom();
      animating = false;
      if (score > best) { best = score; s.set('best', best); }
      if (!canMove()) { over = true; showOver(); }
      updateStats(); save();
    }, 125);
  }
  function showOver() {
    render(overlay, el('div', { class: 'big' }, 'Game over'), el('div', {}, `Score ${score}`),
      el('div', { class: 'row' }, el('button', { class: 'btn', onclick: undo }, 'Undo last move'), el('button', { class: 'btn primary', onclick: newGame }, 'New game')));
    overlay.classList.remove('hidden');
  }
  function undo() {
    if (!undoStack.length || animating) return;
    restore(undoStack.pop()); save();
  }
  function newGame() {
    undoStack = []; won = false;
    restore({ tiles: [], score: 0 });
    addRandom(); addRandom(); updateStats(); save();
  }
  function updateStats() {
    render(stats, stat(score, 'score'), stat(best, 'best'), stat(undoStack.length, 'undos available'));
    undoBtn.disabled = !undoStack.length;
  }
  function save() { s.set('state', { ...snapshot(), undo: undoStack.slice(-20) }); }

  // keyboard
  const KEYS = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1], w: [-1, 0], s: [1, 0], a: [0, -1], d: [0, 1] };
  const onKey = e => {
    if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    const d = KEYS[e.key];
    if (d) { e.preventDefault(); move(d[0], d[1]); }
    else if ((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey)) { e.preventDefault(); undo(); }
  };
  window.addEventListener('keydown', onKey);
  // swipe
  let touch = null;
  board.addEventListener('pointerdown', e => { touch = { x: e.clientX, y: e.clientY }; });
  board.addEventListener('pointerup', e => {
    if (!touch) return;
    const dx = e.clientX - touch.x, dy = e.clientY - touch.y; touch = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    if (Math.abs(dx) > Math.abs(dy)) move(0, dx > 0 ? 1 : -1); else move(dy > 0 ? 1 : -1, 0);
  });
  board.addEventListener('pointercancel', () => (touch = null));

  render(root,
    stats,
    el('div', { class: 'row' }, el('button', { class: 'btn primary', onclick: newGame }, 'New game'), undoBtn,
      el('span', { class: 'muted small' }, 'Ctrl+Z also undoes')),
    board, msg);

  const saved = s.get('state');
  if (saved && saved.tiles && saved.tiles.length) {
    restore(saved); undoStack = (saved.undo || []); updateStats();
    if (!canMove()) { over = true; showOver(); }
  } else newGame();

  return () => { window.removeEventListener('keydown', onKey); };
}
