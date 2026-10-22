// Connect Four: minimax with alpha-beta (depth 2/4/6 by difficulty) and a window heuristic, two-player mode,
// animated disc drop on canvas, win highlight, record per difficulty.
import { el, render, store, stat, loop } from '../../lib/ui.js';

const COLS = 7, ROWS = 6, CELL = 68, PAD = 8;
const W = COLS * CELL + PAD * 2, H = (ROWS + 1) * CELL + PAD * 2;
const ORDER = [3, 2, 4, 1, 5, 0, 6];
const DEPTH = { easy: 2, medium: 4, hard: 6 };
const COLORS = { 1: '#e3413d', 2: '#f2c21b' };

function makeBoard() { return Array.from({ length: ROWS }, () => Array(COLS).fill(0)); }
function dropRow(b, c) { for (let r = ROWS - 1; r >= 0; r--) if (!b[r][c]) return r; return -1; }
function winningCells(b, r, c) {
  const p = b[r][c]; if (!p) return null;
  for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
    const cells = [[r, c]];
    for (const sgn of [1, -1]) for (let i = 1; i < 4; i++) {
      const rr = r + dr * i * sgn, cc = c + dc * i * sgn;
      if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS || b[rr][cc] !== p) break;
      cells.push([rr, cc]);
    }
    if (cells.length >= 4) return cells;
  }
  return null;
}
function scoreWindow(w, p) {
  const o = 3 - p; let mine = 0, theirs = 0, empty = 0;
  for (const v of w) { if (v === p) mine++; else if (v === o) theirs++; else empty++; }
  if (mine === 4) return 1000; if (mine === 3 && empty === 1) return 6; if (mine === 2 && empty === 2) return 2;
  if (theirs === 3 && empty === 1) return -5; if (theirs === 4) return -1000;
  return 0;
}
function evaluate(b, p) {
  let sc = 0;
  for (let r = 0; r < ROWS; r++) if (b[r][3] === p) sc += 3;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    if (c + 3 < COLS) sc += scoreWindow([b[r][c], b[r][c + 1], b[r][c + 2], b[r][c + 3]], p);
    if (r + 3 < ROWS) sc += scoreWindow([b[r][c], b[r + 1][c], b[r + 2][c], b[r + 3][c]], p);
    if (r + 3 < ROWS && c + 3 < COLS) sc += scoreWindow([b[r][c], b[r + 1][c + 1], b[r + 2][c + 2], b[r + 3][c + 3]], p);
    if (r + 3 < ROWS && c - 3 >= 0) sc += scoreWindow([b[r][c], b[r + 1][c - 1], b[r + 2][c - 2], b[r + 3][c - 3]], p);
  }
  return sc;
}
function minimax(b, depth, alpha, beta, maximizing, ai, lastR, lastC) {
  if (lastR >= 0 && winningCells(b, lastR, lastC)) return b[lastR][lastC] === ai ? 100000 + depth : -100000 - depth;
  const moves = ORDER.filter(c => !b[0][c]);
  if (!moves.length) return 0;
  if (depth === 0) return evaluate(b, ai);
  const p = maximizing ? ai : 3 - ai;
  let best = maximizing ? -Infinity : Infinity;
  for (const c of moves) {
    const r = dropRow(b, c); b[r][c] = p;
    const v = minimax(b, depth - 1, alpha, beta, !maximizing, ai, r, c);
    b[r][c] = 0;
    if (maximizing) { best = Math.max(best, v); alpha = Math.max(alpha, v); } else { best = Math.min(best, v); beta = Math.min(beta, v); }
    if (alpha >= beta) break;
  }
  return best;
}
function aiMove(b, ai, difficulty) {
  const moves = ORDER.filter(c => !b[0][c]);
  if (difficulty === 'easy' && Math.random() < 0.35) return moves[Math.floor(Math.random() * moves.length)];
  let bestV = -Infinity, bestC = moves[0];
  for (const c of moves) {
    const r = dropRow(b, c); b[r][c] = ai;
    const v = minimax(b, DEPTH[difficulty] - 1, -Infinity, Infinity, false, ai, r, c);
    b[r][c] = 0;
    if (v > bestV || (v === bestV && Math.random() < 0.3)) { bestV = v; bestC = c; }
  }
  return bestC;
}

export default function (root) {
  const s = store('connect-four');
  let record = s.get('record', { easy: { w: 0, l: 0, d: 0 }, medium: { w: 0, l: 0, d: 0 }, hard: { w: 0, l: 0, d: 0 } });
  let difficulty = s.get('difficulty', 'medium'), mode = s.get('mode', 'ai'), humanFirst = true;
  let board, turn, over, winner, winCells, falling = null, hoverCol = 3, selCol = 3, timer = null, busy = false;

  const canvas = el('canvas', { width: W, height: H, style: { maxWidth: '100%', height: 'auto', display: 'block', borderRadius: '10px', touchAction: 'manipulation', cursor: 'pointer' } });
  const ctx = canvas.getContext('2d');
  const msg = el('div', { style: { fontWeight: '600', minHeight: '24px' } });
  const stats = el('div', { class: 'row' });
  const diffSel = el('select', { class: 'select', value: difficulty, onchange: () => { difficulty = diffSel.value; s.set('difficulty', difficulty); updateStats(); newGame(); } },
    el('option', { value: 'easy' }, 'Easy'), el('option', { value: 'medium' }, 'Medium'), el('option', { value: 'hard' }, 'Hard'));
  const modeSel = el('select', { class: 'select', value: mode, onchange: () => { mode = modeSel.value; s.set('mode', mode); diffSel.disabled = mode !== 'ai'; newGame(); } },
    el('option', { value: 'ai' }, 'Play vs computer'), el('option', { value: '2p' }, 'Two players'));
  diffSel.disabled = mode !== 'ai';

  function cssVar(n) { return getComputedStyle(root).getPropertyValue(n).trim() || '#888'; }
  function playerName(p) { return mode === '2p' ? (p === 1 ? 'Red' : 'Yellow') : (p === 1 ? 'You (red)' : 'Computer (yellow)'); }
  function newGame() {
    clearTimeout(timer); board = makeBoard(); over = false; winner = 0; winCells = null; falling = null; busy = false;
    if (mode === 'ai') humanFirst = !humanFirst;
    turn = 1;
    msg.textContent = `${playerName(turn)} to move.`;
    if (mode === 'ai' && !humanFirst) { turn = 2; msg.textContent = 'Computer starts.'; timer = setTimeout(computerTurn, 400); }
  }
  function play(c) {
    if (over || busy || falling) return;
    const r = dropRow(board, c); if (r < 0) return;
    busy = true;
    falling = { c, r, y: 0, p: turn, vy: 0 };
  }
  function land() {
    const { r, c, p } = falling; falling = null; board[r][c] = p;
    const wc = winningCells(board, r, c);
    if (wc) { over = true; winner = p; winCells = wc; msg.textContent = `${playerName(p)} win${mode === 'ai' && p === 1 ? '' : 's'}!`; tally(p); busy = false; return; }
    if (board[0].every(v => v)) { over = true; msg.textContent = 'Draw — the board is full.'; tally(0); busy = false; return; }
    turn = 3 - turn; msg.textContent = `${playerName(turn)} to move.`;
    busy = false;
    if (mode === 'ai' && turn === 2) { busy = true; msg.textContent = 'Computer is thinking…'; timer = setTimeout(computerTurn, 250); }
  }
  function computerTurn() {
    if (over) return;
    const c = aiMove(board, 2, difficulty);
    busy = false; play(c);
  }
  function tally(p) {
    if (mode !== 'ai') return;
    const rec = record[difficulty]; if (p === 1) rec.w++; else if (p === 2) rec.l++; else rec.d++;
    s.set('record', record); updateStats();
  }
  function updateStats() {
    const rec = record[difficulty];
    render(stats, stat(rec.w, `wins (${difficulty})`), stat(rec.l, 'losses'), stat(rec.d, 'draws'));
  }
  function colFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (W / rect.width);
    return Math.max(0, Math.min(COLS - 1, Math.floor((x - PAD) / CELL)));
  }
  canvas.addEventListener('mousemove', e => { hoverCol = colFromEvent(e); selCol = hoverCol; });
  canvas.addEventListener('mouseleave', () => { hoverCol = -1; });
  canvas.addEventListener('click', e => { const c = colFromEvent(e); selCol = c; play(c); });

  function draw(dt) {
    if (falling) {
      falling.vy += 2600 * dt; falling.y += falling.vy * dt;
      const target = (falling.r + 1) * CELL;
      if (falling.y >= target) land();
    }
    ctx.clearRect(0, 0, W, H);
    // preview disc
    const previewCol = hoverCol >= 0 ? hoverCol : selCol;
    if (!over && !falling && !(mode === 'ai' && turn === 2) && previewCol >= 0 && !board[0][previewCol]) {
      ctx.globalAlpha = 0.6; disc(previewCol, -1, COLORS[turn], 0); ctx.globalAlpha = 1;
    }
    if (falling) disc(falling.c, -1, COLORS[falling.p], falling.y);
    // placed discs sit behind the frame; the frame's holes (even-odd) reveal them
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (board[r][c]) disc(c, r, COLORS[board[r][c]], 0);
    ctx.fillStyle = cssVar('--accent');
    ctx.beginPath(); ctx.roundRect(PAD, CELL + PAD, COLS * CELL, ROWS * CELL, 12);
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const [x, y] = center(c, r); ctx.moveTo(x + CELL * 0.4, y); ctx.arc(x, y, CELL * 0.4, 0, Math.PI * 2, true);
    }
    ctx.fill('evenodd');
    if (winCells) {
      ctx.strokeStyle = cssVar('--text'); ctx.lineWidth = 5;
      for (const [r, c] of winCells) { const [x, y] = center(c, r); ctx.beginPath(); ctx.arc(x, y, CELL * 0.28, 0, Math.PI * 2); ctx.stroke(); }
    }
    if (!over && !falling && selCol >= 0 && hoverCol < 0) {
      ctx.fillStyle = cssVar('--muted'); const [x] = center(selCol, 0); ctx.beginPath(); ctx.moveTo(x, CELL * 0.85); ctx.lineTo(x - 10, CELL * 0.6); ctx.lineTo(x + 10, CELL * 0.6); ctx.fill();
    }
  }
  function center(c, r) { return [PAD + c * CELL + CELL / 2, PAD + (r + 1) * CELL + CELL / 2]; }
  function disc(c, r, color, dy) {
    const [x, y] = center(c, r);
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y + dy, CELL * 0.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.15)'; ctx.beginPath(); ctx.arc(x, y + dy, CELL * 0.28, 0, Math.PI * 2); ctx.fill();
  }
  function onKey(e) {
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (e.key === 'ArrowLeft') { selCol = Math.max(0, selCol - 1); hoverCol = -1; e.preventDefault(); }
    else if (e.key === 'ArrowRight') { selCol = Math.min(COLS - 1, selCol + 1); hoverCol = -1; e.preventDefault(); }
    else if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (over) newGame(); else play(selCol); }
    else if (/^[1-7]$/.test(e.key)) { selCol = +e.key - 1; play(selCol); }
    else if (e.key === 'n' || e.key === 'N') newGame();
  }
  window.addEventListener('keydown', onKey);

  render(root,
    el('div', { class: 'row' }, modeSel, diffSel, el('button', { class: 'btn primary', onclick: newGame }, 'New game'), stats),
    msg,
    el('div', { class: 'canvas-wrap' }, canvas),
    el('div', { class: 'muted small' }, 'Click a column or use ← → and Enter (or keys 1–7). Red moves first; sides alternate each game against the computer.'));
  updateStats(); newGame();
  const stop = loop(draw);
  return () => { stop(); clearTimeout(timer); window.removeEventListener('keydown', onKey); };
}
