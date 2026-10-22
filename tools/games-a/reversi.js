// Reversi / Othello: legal moves highlighted, animated flips on canvas, AI using corner/edge weighted
// evaluation plus a shallow alpha-beta search (exact endgame search near the end), pass handling, score, record.
import { el, render, store, stat, loop, toast } from '../../lib/ui.js';

const N = 8, CELL = 60, W = N * CELL, H = N * CELL;
const DIRS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
const WEIGHTS = [
  [120, -20, 20, 5, 5, 20, -20, 120],
  [-20, -40, -5, -5, -5, -5, -40, -20],
  [20, -5, 15, 3, 3, 15, -5, 20],
  [5, -5, 3, 3, 3, 3, -5, 5],
  [5, -5, 3, 3, 3, 3, -5, 5],
  [20, -5, 15, 3, 3, 15, -5, 20],
  [-20, -40, -5, -5, -5, -5, -40, -20],
  [120, -20, 20, 5, 5, 20, -20, 120],
];

function newBoard() {
  const b = Array.from({ length: N }, () => Array(N).fill(0));
  b[3][3] = 2; b[4][4] = 2; b[3][4] = 1; b[4][3] = 1; return b;
}
/** cells flipped if p plays at r,c (empty array = illegal) */
function flips(b, r, c, p) {
  if (b[r][c]) return [];
  const out = [];
  for (const [dr, dc] of DIRS) {
    const line = []; let rr = r + dr, cc = c + dc;
    while (rr >= 0 && rr < N && cc >= 0 && cc < N && b[rr][cc] === 3 - p) { line.push([rr, cc]); rr += dr; cc += dc; }
    if (line.length && rr >= 0 && rr < N && cc >= 0 && cc < N && b[rr][cc] === p) out.push(...line);
  }
  return out;
}
function legalMoves(b, p) {
  const m = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) { const f = flips(b, r, c, p); if (f.length) m.push({ r, c, f }); }
  return m;
}
function apply(b, mv, p) { const nb = b.map(row => row.slice()); nb[mv.r][mv.c] = p; for (const [r, c] of mv.f) nb[r][c] = p; return nb; }
function count(b) { let a = 0, w = 0; for (const row of b) for (const v of row) { if (v === 1) a++; else if (v === 2) w++; } return [a, w]; }
function evaluate(b, p) {
  const empties = 64 - count(b).reduce((x, y) => x + y);
  if (empties === 0) { const [a, w] = count(b); const d = (p === 1 ? a - w : w - a); return d * 1000; }
  let sc = 0;
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (b[r][c]) sc += (b[r][c] === p ? 1 : -1) * WEIGHTS[r][c];
  // corner-adjacent squares are only bad while the corner is empty
  for (const [cr, cc] of [[0, 0], [0, 7], [7, 0], [7, 7]]) if (b[cr][cc]) {
    for (const [dr, dc] of DIRS) { const r = cr + dr, c = cc + dc; if (r >= 0 && r < N && c >= 0 && c < N && b[r][c]) sc += (b[r][c] === p ? 1 : -1) * (WEIGHTS[r][c] < 0 ? -WEIGHTS[r][c] + 10 : 0); }
  }
  const mob = legalMoves(b, p).length - legalMoves(b, 3 - p).length;
  sc += mob * (empties > 20 ? 8 : 4);
  if (empties < 16) { const [a, w] = count(b); sc += (p === 1 ? a - w : w - a) * 3; }
  return sc;
}
function search(b, depth, alpha, beta, p, me, passed) {
  const moves = legalMoves(b, p);
  if (depth === 0) return evaluate(b, me);
  if (!moves.length) { if (passed) return evaluate(b, me); return search(b, depth - 1, alpha, beta, 3 - p, me, true); }
  moves.sort((x, y) => WEIGHTS[y.r][y.c] - WEIGHTS[x.r][x.c]);
  const maximizing = p === me;
  let best = maximizing ? -Infinity : Infinity;
  for (const mv of moves) {
    const v = search(apply(b, mv, p), depth - 1, alpha, beta, 3 - p, me, false);
    if (maximizing) { best = Math.max(best, v); alpha = Math.max(alpha, v); } else { best = Math.min(best, v); beta = Math.min(beta, v); }
    if (alpha >= beta) break;
  }
  return best;
}
function aiMove(b, p, level) {
  const moves = legalMoves(b, p); if (!moves.length) return null;
  const empties = 64 - count(b).reduce((x, y) => x + y);
  if (level === 'easy') { // greedy: most flips with a corner preference
    moves.sort((x, y) => (y.f.length + WEIGHTS[y.r][y.c] / 10) - (x.f.length + WEIGHTS[x.r][x.c] / 10));
    return moves[0];
  }
  let depth = level === 'hard' ? 4 : 2;
  if (empties <= (level === 'hard' ? 10 : 8)) depth = empties; // exact endgame
  let best = null, bestV = -Infinity;
  for (const mv of moves) {
    const v = search(apply(b, mv, p), depth - 1, -Infinity, Infinity, 3 - p, p, false) + Math.random() * 0.5;
    if (v > bestV) { bestV = v; best = mv; }
  }
  return best;
}

export default function (root) {
  const s = store('reversi');
  let record = s.get('record', { w: 0, l: 0, d: 0 });
  let mode = s.get('mode', 'ai'), level = s.get('level', 'medium'), human = 1;
  let board, turn, over, moves = [], anims = [], last = null, cursor = [3, 3], timer = null, thinking = false;

  const canvas = el('canvas', { width: W, height: H, style: { maxWidth: '100%', height: 'auto', display: 'block', borderRadius: '8px', touchAction: 'manipulation', cursor: 'pointer' } });
  const ctx = canvas.getContext('2d');
  const msg = el('div', { style: { fontWeight: '600', minHeight: '24px' } });
  const score = el('div', { class: 'row' });
  const stats = el('div', { class: 'row' });
  const modeSel = el('select', { class: 'select', value: mode, onchange: () => { mode = modeSel.value; s.set('mode', mode); levelSel.disabled = mode === '2p'; newGame(); } },
    el('option', { value: 'ai' }, 'You (black) vs computer'), el('option', { value: 'ai-white' }, 'You (white) vs computer'), el('option', { value: '2p' }, 'Two players'));
  const levelSel = el('select', { class: 'select', value: level, onchange: () => { level = levelSel.value; s.set('level', level); newGame(); } },
    el('option', { value: 'easy' }, 'Easy (greedy)'), el('option', { value: 'medium' }, 'Medium (2-ply)'), el('option', { value: 'hard' }, 'Hard (4-ply + endgame)'));
  levelSel.disabled = mode === '2p';
  const hintChk = el('input', { type: 'checkbox', checked: s.get('hints', true), onchange: () => s.set('hints', hintChk.checked) });

  function cssVar(n) { return getComputedStyle(root).getPropertyValue(n).trim() || '#888'; }
  function name(p) { return mode === '2p' ? (p === 1 ? 'Black' : 'White') : (p === human ? 'You' : 'Computer'); }
  function isHumanTurn() { return mode === '2p' || turn === human; }

  function newGame() {
    clearTimeout(timer); board = newBoard(); turn = 1; over = false; anims = []; last = null; thinking = false;
    human = mode === 'ai-white' ? 2 : 1;
    moves = legalMoves(board, turn);
    msg.textContent = `${name(turn)} to move (black starts).`;
    updateScore(); scheduleAi();
  }
  function scheduleAi() { if (!over && mode !== '2p' && turn !== human) { thinking = true; msg.textContent = 'Computer is thinking…'; timer = setTimeout(() => { thinking = false; const mv = aiMove(board, turn, level); if (mv) makeMove(mv); }, 450); } }
  function makeMove(mv) {
    const p = turn;
    for (const [r, c] of mv.f) anims.push({ r, c, from: 3 - p, to: p, t: -0.05 * Math.max(Math.abs(r - mv.r), Math.abs(c - mv.c)) });
    board = apply(board, mv, p); last = [mv.r, mv.c];
    turn = 3 - p; moves = legalMoves(board, turn);
    if (!moves.length) {
      const back = legalMoves(board, p);
      if (!back.length) { finish(); return; }
      toast(`${name(turn)} has no legal move — pass`);
      turn = p; moves = back;
      msg.textContent = `${name(3 - p)} passes. ${name(turn)} moves again.`;
    } else msg.textContent = `${name(turn)} to move.`;
    updateScore(); scheduleAi();
  }
  function finish() {
    over = true; const [a, w] = count(board);
    const winner = a > w ? 1 : w > a ? 2 : 0;
    msg.textContent = winner ? `${name(winner)} win${winner === human && mode !== '2p' ? '' : 's'} ${Math.max(a, w)}–${Math.min(a, w)}.` : `Draw ${a}–${w}.`;
    if (mode !== '2p') { if (winner === human) record.w++; else if (winner) record.l++; else record.d++; s.set('record', record); updateStats(); }
    updateScore();
  }
  function updateScore() {
    const [a, w] = count(board);
    render(score, stat(a, 'black'), stat(w, 'white'), stat(moves.length, 'legal moves'), stat(64 - a - w, 'empty'));
  }
  function updateStats() { render(stats, stat(record.w, 'wins'), stat(record.l, 'losses'), stat(record.d, 'draws')); }
  function tryPlay(r, c) {
    if (over || thinking || !isHumanTurn()) return;
    const mv = moves.find(m => m.r === r && m.c === c);
    if (!mv) { toast('Not a legal move'); return; }
    makeMove(mv);
  }
  canvas.addEventListener('click', e => {
    const rect = canvas.getBoundingClientRect();
    const c = Math.floor((e.clientX - rect.left) * (W / rect.width) / CELL), r = Math.floor((e.clientY - rect.top) * (H / rect.height) / CELL);
    if (r >= 0 && r < N && c >= 0 && c < N) { cursor = [r, c]; tryPlay(r, c); }
  });

  function drawDisc(x, y, color, sx) {
    ctx.save(); ctx.translate(x, y); ctx.scale(Math.max(0.02, Math.abs(sx)), 1);
    ctx.fillStyle = color === 1 ? '#111' : '#f4f4f4'; ctx.beginPath(); ctx.arc(0, 0, CELL * 0.4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore();
  }
  function draw(dt) {
    for (const a of anims) a.t += dt * 2.2;
    anims = anims.filter(a => a.t < 1);
    ctx.fillStyle = '#2e8b57'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1;
    for (let i = 0; i <= N; i++) { ctx.beginPath(); ctx.moveTo(i * CELL, 0); ctx.lineTo(i * CELL, H); ctx.moveTo(0, i * CELL); ctx.lineTo(W, i * CELL); ctx.stroke(); }
    ctx.fillStyle = 'rgba(0,0,0,.45)';
    for (const [r, c] of [[2, 2], [2, 6], [6, 2], [6, 6]]) { ctx.beginPath(); ctx.arc(c * CELL, r * CELL, 3, 0, 7); ctx.fill(); }
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const v = board[r][c]; if (!v) continue;
      const x = c * CELL + CELL / 2, y = r * CELL + CELL / 2;
      const a = anims.find(z => z.r === r && z.c === c);
      if (a) { const t = Math.max(0, a.t); const sx = Math.cos(t * Math.PI); drawDisc(x, y, t < 0.5 ? a.from : a.to, sx); }
      else drawDisc(x, y, v, 1);
    }
    if (last) { ctx.fillStyle = '#ff5252'; ctx.beginPath(); ctx.arc(last[1] * CELL + CELL / 2, last[0] * CELL + CELL / 2, 4, 0, 7); ctx.fill(); }
    if (!over && hintChk.checked && isHumanTurn() && !thinking) {
      ctx.strokeStyle = turn === 1 ? 'rgba(0,0,0,.6)' : 'rgba(255,255,255,.8)'; ctx.lineWidth = 2;
      for (const m of moves) { ctx.beginPath(); ctx.arc(m.c * CELL + CELL / 2, m.r * CELL + CELL / 2, CELL * 0.18, 0, 7); ctx.stroke(); }
    }
    if (!over && isHumanTurn()) { ctx.strokeStyle = cssVar('--warn'); ctx.lineWidth = 3; ctx.strokeRect(cursor[1] * CELL + 2, cursor[0] * CELL + 2, CELL - 4, CELL - 4); }
  }
  function onKey(e) {
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    const d = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key];
    if (d) { e.preventDefault(); cursor = [Math.max(0, Math.min(N - 1, cursor[0] + d[0])), Math.max(0, Math.min(N - 1, cursor[1] + d[1]))]; }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (over) newGame(); else tryPlay(cursor[0], cursor[1]); }
    else if (e.key === 'n' || e.key === 'N') newGame();
  }
  window.addEventListener('keydown', onKey);

  render(root,
    el('div', { class: 'row' }, modeSel, levelSel, el('button', { class: 'btn primary', onclick: newGame }, 'New game'),
      el('label', { class: 'inline' }, hintChk, 'Show legal moves')),
    msg, score,
    el('div', { class: 'canvas-wrap' }, canvas),
    stats,
    el('div', { class: 'muted small' }, 'Click a highlighted square or move the cursor with arrow keys and press Enter. The red dot marks the last move. A player with no legal move passes automatically.'));
  updateStats(); newGame();
  const stop = loop(draw);
  return () => { stop(); clearTimeout(timer); window.removeEventListener('keydown', onKey); };
}
