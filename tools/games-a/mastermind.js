// Mastermind: 6 colours, 4 pegs, 10 guesses, black/white feedback. Two modes: you break the computer's code,
// or you set a code and the computer breaks it by candidate elimination (Knuth minimax over the 1296 codes).
import { el, render, store, stat, toast } from '../../lib/ui.js';

const COLORS = ['#e53935', '#fb8c00', '#fdd835', '#43a047', '#1e88e5', '#8e24aa'];
const NAMES = ['red', 'orange', 'yellow', 'green', 'blue', 'purple'];
const PEGS = 4, MAX = 10, K = 6;
const ALL = [];
for (let i = 0; i < K ** PEGS; i++) ALL.push([Math.floor(i / 216) % 6, Math.floor(i / 36) % 6, Math.floor(i / 6) % 6, i % 6]);

function feedback(guess, code) {
  let black = 0; const g = Array(K).fill(0), c = Array(K).fill(0);
  for (let i = 0; i < PEGS; i++) { if (guess[i] === code[i]) black++; else { g[guess[i]]++; c[code[i]]++; } }
  let white = 0; for (let k = 0; k < K; k++) white += Math.min(g[k], c[k]);
  return [black, white];
}
function nextGuess(candidates, first) {
  if (first) return [0, 0, 1, 1];
  if (candidates.length <= 2) return candidates[0];
  let best = null, bestScore = Infinity, bestIsCand = false;
  const candSet = new Set(candidates.map(c => c.join('')));
  for (const g of ALL) {
    const buckets = new Map();
    for (const c of candidates) { const k = feedback(g, c).join(''); buckets.set(k, (buckets.get(k) || 0) + 1); }
    let worst = 0; for (const v of buckets.values()) if (v > worst) worst = v;
    const isCand = candSet.has(g.join(''));
    if (worst < bestScore || (worst === bestScore && isCand && !bestIsCand)) { bestScore = worst; best = g; bestIsCand = isCand; }
  }
  return best;
}

export default function (root) {
  const s = store('mastermind');
  let stats = s.get('stats', { wins: 0, losses: 0, best: null, cpuGames: 0, cpuGuesses: 0 });
  let mode = s.get('mode', 'break');
  let code = [], rows = [], current = [], over = false, timer = null, candidates = [], secretShown = false;

  const peg = (color, size = 34) => el('div', { style: { width: size + 'px', height: size + 'px', borderRadius: '50%', background: color == null ? 'transparent' : COLORS[color], border: color == null ? '2px dashed var(--line)' : '2px solid rgba(0,0,0,.25)', boxSizing: 'border-box', transition: 'background .15s' } });
  const fbPeg = (type) => el('div', { style: { width: '12px', height: '12px', borderRadius: '50%', background: type === 'b' ? 'var(--text)' : type === 'w' ? 'var(--panel)' : 'transparent', border: '1px solid ' + (type ? 'var(--text)' : 'var(--line)') } });

  const board = el('div', { class: 'col', style: { gap: '6px', alignItems: 'center' } });
  const secretRow = el('div', { class: 'row', style: { justifyContent: 'center' } });
  const palette = el('div', { class: 'row', style: { justifyContent: 'center' } });
  COLORS.forEach((c, i) => palette.append(el('button', { class: 'btn', title: `${NAMES[i]} (key ${i + 1})`, style: { padding: '6px', borderRadius: '50%', width: '46px', height: '46px', touchAction: 'manipulation' }, onclick: () => addColor(i) }, peg(i, 30))));
  const msg = el('div', { class: 'center', style: { fontWeight: '600', minHeight: '24px' } });
  const statsBox = el('div', { class: 'row', style: { justifyContent: 'center' } });
  const modeSel = el('select', { class: 'select', value: mode, onchange: () => { mode = modeSel.value; s.set('mode', mode); newGame(); } },
    el('option', { value: 'break' }, 'You break the code'), el('option', { value: 'set' }, 'Computer breaks your code'));
  const submitBtn = el('button', { class: 'btn primary', onclick: submit }, 'Check');
  const backBtn = el('button', { class: 'btn', onclick: () => { current.pop(); drawBoard(); } }, '⌫');
  const revealBtn = el('button', { class: 'btn ghost', onclick: () => { if (mode === 'break' && !over) { over = true; secretShown = true; stats.losses++; s.set('stats', stats); msg.textContent = 'Given up — the code is shown above.'; drawBoard(); updateStats(); } } }, 'Give up');
  const controls = el('div', { class: 'row', style: { justifyContent: 'center' } }, submitBtn, backBtn, revealBtn);

  function randomCode() { return Array.from({ length: PEGS }, () => Math.floor(Math.random() * K)); }
  function newGame() {
    clearTimeout(timer); rows = []; current = []; over = false; secretShown = false; candidates = ALL.slice();
    if (mode === 'break') { code = randomCode(); msg.textContent = 'Pick 4 colours (keys 1–6), then Check. 10 tries.'; }
    else { code = []; msg.textContent = 'Set your secret code with the palette, then press Start.'; }
    drawBoard(); updateStats();
  }
  function addColor(i) {
    if (over) return;
    if (mode === 'set' && rows.length) return;
    if (current.length < PEGS) { current.push(i); drawBoard(); }
  }
  function submit() {
    if (over) return;
    if (current.length < PEGS) { toast('Choose 4 colours'); return; }
    if (mode === 'set') { if (!code.length) startCpu(); return; }
    const fb = feedback(current, code); rows.push({ guess: current, fb }); current = [];
    if (fb[0] === PEGS) { over = true; secretShown = true; stats.wins++; if (!stats.best || rows.length < stats.best) stats.best = rows.length; msg.textContent = `Cracked in ${rows.length} guess${rows.length > 1 ? 'es' : ''}!`; s.set('stats', stats); }
    else if (rows.length >= MAX) { over = true; secretShown = true; stats.losses++; msg.textContent = 'Out of guesses. The code is shown above.'; s.set('stats', stats); }
    else msg.textContent = `${fb[0]} black, ${fb[1]} white. ${MAX - rows.length} tries left.`;
    drawBoard(); updateStats();
  }
  function startCpu() {
    code = current.slice(); current = []; secretShown = true;
    msg.textContent = 'Computer is thinking…'; drawBoard();
    timer = setTimeout(cpuStep, 500);
  }
  function cpuStep() {
    const g = nextGuess(candidates, rows.length === 0);
    const fb = feedback(g, code); rows.push({ guess: g, fb });
    candidates = candidates.filter(c => { const f = feedback(g, c); return f[0] === fb[0] && f[1] === fb[1]; });
    if (fb[0] === PEGS) { over = true; stats.cpuGames++; stats.cpuGuesses += rows.length; s.set('stats', stats); msg.textContent = `Computer cracked it in ${rows.length} guess${rows.length > 1 ? 'es' : ''}.`; }
    else if (rows.length >= MAX) { over = true; msg.textContent = 'Computer failed in 10 guesses (that should not happen!).'; }
    else { msg.textContent = `Guess ${rows.length}: ${fb[0]} black, ${fb[1]} white — ${candidates.length} code${candidates.length === 1 ? '' : 's'} still possible.`; timer = setTimeout(cpuStep, 900); }
    drawBoard(); updateStats();
  }
  function drawBoard() {
    render(secretRow, el('span', { class: 'muted small', style: { width: '60px' } }, mode === 'set' && !code.length ? 'Secret' : 'Code'),
      Array.from({ length: PEGS }, (_, i) => {
        if (mode === 'set' && !code.length) return peg(current[i]);
        if (secretShown) return peg(code[i]);
        return el('div', { style: { width: '34px', height: '34px', borderRadius: '50%', background: 'var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700' } }, '?');
      }));
    const lines = [];
    for (let i = 0; i < MAX; i++) {
      const row = rows[i];
      const isCurrent = !row && i === rows.length && !over && !(mode === 'set');
      const pegs = Array.from({ length: PEGS }, (_, j) => row ? peg(row.guess[j]) : isCurrent ? peg(current[j]) : peg(null));
      const fbs = row ? [...'b'.repeat(row.fb[0]), ...'w'.repeat(row.fb[1]), ...''.padEnd(PEGS - row.fb[0] - row.fb[1], 'x')].map(t => fbPeg(t === 'x' ? '' : t)) : Array.from({ length: PEGS }, () => fbPeg(''));
      lines.push(el('div', { style: { display: 'flex', gap: '8px', alignItems: 'center', padding: '4px 8px', borderRadius: '8px', background: isCurrent ? 'var(--bg)' : 'transparent', outline: isCurrent ? '1px solid var(--accent)' : 'none' } },
        el('span', { class: 'muted small mono', style: { width: '18px' } }, i + 1),
        el('div', { style: { display: 'flex', gap: '6px' } }, pegs),
        el('div', { style: { display: 'grid', gridTemplateColumns: '12px 12px', gap: '3px', marginLeft: '6px' } }, fbs)));
    }
    render(board, lines);
    const settingSecret = mode === 'set' && !code.length;
    submitBtn.textContent = settingSecret ? 'Start' : 'Check';
    submitBtn.disabled = over || (mode === 'set' && code.length > 0);
    backBtn.disabled = over || !current.length;
    revealBtn.disabled = over || mode === 'set';
    palette.style.opacity = over || (mode === 'set' && code.length) ? '.5' : '1';
  }
  function updateStats() {
    render(statsBox, stat(stats.wins, 'cracked'), stat(stats.losses, 'failed'), stat(stats.best || '–', 'best (guesses)'),
      stat(stats.cpuGames ? (stats.cpuGuesses / stats.cpuGames).toFixed(2) : '–', 'computer avg'));
  }
  function onKey(e) {
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (/^[1-6]$/.test(e.key)) addColor(+e.key - 1);
    else if (e.key === 'Backspace') { e.preventDefault(); if (!over) { current.pop(); drawBoard(); } }
    else if (e.key === 'Enter') { e.preventDefault(); if (over) newGame(); else submit(); }
    else if (e.key === 'Escape') { current = []; drawBoard(); }
    else if (e.key === 'n' || e.key === 'N') newGame();
  }
  window.addEventListener('keydown', onKey);

  render(root,
    el('div', { class: 'row', style: { justifyContent: 'center' } }, modeSel, el('button', { class: 'btn', onclick: newGame }, 'New game')),
    statsBox, msg, secretRow, board, palette, controls,
    el('div', { class: 'muted small center' }, 'Black peg: right colour in the right place. White peg: right colour, wrong place. Keys 1–6 pick colours, Backspace removes, Enter checks. Colours may repeat.'));
  newGame();
  return () => { clearTimeout(timer); window.removeEventListener('keydown', onKey); };
}
