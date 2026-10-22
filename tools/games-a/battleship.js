// Battleship: place ships (click + rotate), AI with hunt/target mode, two boards, hit/miss markers, win detection,
// plus hot-seat two-player mode with a pass-the-device screen. Record vs the computer is kept.
import { el, render, store, stat, toast } from '../../lib/ui.js';

const N = 10;
const FLEET = [['Carrier', 5], ['Battleship', 4], ['Cruiser', 3], ['Submarine', 3], ['Destroyer', 2]];
const LET = 'ABCDEFGHIJ';

function emptyPlayer(name) {
  return { name, ships: [], grid: Array.from({ length: N }, () => Array(N).fill(-1)), shots: Array.from({ length: N }, () => Array(N).fill(0)) };
}
function canPlace(p, r, c, len, horiz) {
  for (let i = 0; i < len; i++) {
    const rr = horiz ? r : r + i, cc = horiz ? c + i : c;
    if (rr >= N || cc >= N || p.grid[rr][cc] !== -1) return false;
  }
  return true;
}
function place(p, r, c, len, horiz, name) {
  const cells = [];
  for (let i = 0; i < len; i++) { const rr = horiz ? r : r + i, cc = horiz ? c + i : c; p.grid[rr][cc] = p.ships.length; cells.push([rr, cc]); }
  p.ships.push({ name, len, cells, hits: 0, sunk: false });
}
function randomFleet(p) {
  p.ships = []; p.grid = Array.from({ length: N }, () => Array(N).fill(-1));
  for (const [name, len] of FLEET) {
    for (let tries = 0; tries < 500; tries++) {
      const horiz = Math.random() < 0.5, r = Math.floor(Math.random() * N), c = Math.floor(Math.random() * N);
      if (canPlace(p, r, c, len, horiz)) { place(p, r, c, len, horiz, name); break; }
    }
  }
}
function allSunk(p) { return p.ships.length && p.ships.every(s => s.sunk); }
/** Fire at p's board. Returns {hit, sunk: ship|null} */
function fire(p, r, c) {
  const idx = p.grid[r][c];
  if (idx === -1) { p.shots[r][c] = 1; return { hit: false, sunk: null }; }
  p.shots[r][c] = 2; const ship = p.ships[idx]; ship.hits++;
  if (ship.hits === ship.len) { ship.sunk = true; return { hit: true, sunk: ship }; }
  return { hit: true, sunk: null };
}
function aiPick(p) {
  const unshot = (r, c) => r >= 0 && c >= 0 && r < N && c < N && p.shots[r][c] === 0;
  const hits = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (p.shots[r][c] === 2 && !p.ships[p.grid[r][c]].sunk) hits.push([r, c]);
  let cand = [];
  if (hits.length >= 2) {
    const rows = new Set(hits.map(h => h[0])), cols = new Set(hits.map(h => h[1]));
    if (rows.size === 1) { const r = hits[0][0], cs = hits.map(h => h[1]); cand = [[r, Math.min(...cs) - 1], [r, Math.max(...cs) + 1]]; }
    else if (cols.size === 1) { const c = hits[0][1], rs = hits.map(h => h[0]); cand = [[Math.min(...rs) - 1, c], [Math.max(...rs) + 1, c]]; }
    cand = cand.filter(([r, c]) => unshot(r, c));
  }
  if (!cand.length) for (const [r, c] of hits) for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (unshot(r + dr, c + dc)) cand.push([r + dr, c + dc]);
  if (!cand.length) {
    const smallest = Math.min(...p.ships.filter(s => !s.sunk).map(s => s.len));
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (unshot(r, c) && (r + c) % Math.max(2, Math.min(smallest, 3)) === 0) cand.push([r, c]);
    if (!cand.length) for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (unshot(r, c)) cand.push([r, c]);
  }
  return cand[Math.floor(Math.random() * cand.length)];
}

export default function (root) {
  const s = store('battleship');
  let record = s.get('record', { wins: 0, losses: 0 });
  let twoPlayer = false, players, phase, placing, turn, shipIdx, horiz = true, hover = null, timer = null, lastMsg = '';

  const stats = el('div', { class: 'row' });
  const msg = el('div', { style: { fontWeight: '600', minHeight: '24px' } });
  const area = el('div');
  const modeSel = el('select', { class: 'select', onchange: () => { twoPlayer = modeSel.value === '2p'; start(); } },
    el('option', { value: 'ai' }, 'You vs computer'), el('option', { value: '2p' }, 'Two players (hot-seat)'));

  function makeBoard(onCell, onHover) {
    const cells = [];
    const grid = el('div', { style: { display: 'grid', gridTemplateColumns: `18px repeat(${N}, 1fr)`, gap: '2px', width: '100%', maxWidth: '380px', userSelect: 'none', touchAction: 'manipulation' }, onmouseleave: () => onHover && onHover(null) });
    grid.append(el('div'));
    for (let c = 0; c < N; c++) grid.append(el('div', { class: 'muted small center' }, c + 1));
    for (let r = 0; r < N; r++) {
      grid.append(el('div', { class: 'muted small', style: { display: 'flex', alignItems: 'center' } }, LET[r]));
      cells[r] = [];
      for (let c = 0; c < N; c++) {
        const d = el('div', { style: { aspectRatio: '1', border: '1px solid var(--line)', borderRadius: '3px', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '700', cursor: 'pointer' },
          onclick: () => onCell(r, c), onmouseenter: () => onHover && onHover([r, c]) });
        cells[r][c] = d; grid.append(d);
      }
    }
    return { grid, cells };
  }
  const own = makeBoard((r, c) => { if (phase === 'place') placeAt(r, c); }, h => { if (phase === 'place') { hover = h; paint(); } });
  const enemy = makeBoard((r, c) => { if (phase === 'play') shoot(r, c); });
  const ownTitle = el('div', { class: 'small muted', style: { fontWeight: '600' } });
  const enemyTitle = el('div', { class: 'small muted', style: { fontWeight: '600' } });
  const fleetList = el('div', { class: 'row small' });
  const enemyFleetList = el('div', { class: 'row small' });
  const placeBtns = el('div', { class: 'row' });
  const boards = el('div', { class: 'grid2' },
    el('div', { class: 'col' }, ownTitle, own.grid, fleetList, placeBtns),
    el('div', { class: 'col' }, enemyTitle, enemy.grid, enemyFleetList));

  function cur() { return players[phase === 'place' ? placing : turn]; }
  function opp() { return players[1 - (phase === 'place' ? placing : turn)]; }

  function start() {
    clearTimeout(timer);
    players = [emptyPlayer(twoPlayer ? 'Player 1' : 'You'), emptyPlayer(twoPlayer ? 'Player 2' : 'Computer')];
    if (!twoPlayer) randomFleet(players[1]);
    placing = 0; turn = 0; shipIdx = 0; horiz = true; hover = null;
    phase = 'place';
    msg.textContent = `${players[0].name}: place your ${FLEET[0][0]} (${FLEET[0][1]} cells). Click a cell; R rotates.`;
    showBoards(); paint();
  }
  function placeAt(r, c) {
    const p = players[placing]; const [name, len] = FLEET[shipIdx];
    if (!canPlace(p, r, c, len, horiz)) { toast('Does not fit there'); return; }
    place(p, r, c, len, horiz, name); shipIdx++;
    if (shipIdx < FLEET.length) msg.textContent = `${p.name}: place your ${FLEET[shipIdx][0]} (${FLEET[shipIdx][1]} cells).`;
    else msg.textContent = `${p.name}: fleet placed. Press Start battle.`;
    paint();
  }
  function undoShip() {
    const p = players[placing]; if (!p.ships.length) return;
    const ship = p.ships.pop(); for (const [r, c] of ship.cells) p.grid[r][c] = -1; shipIdx--; paint();
  }
  function finishPlacing() {
    if (shipIdx < FLEET.length) { toast('Place all ships first'); return; }
    if (twoPlayer && placing === 0) { placing = 1; shipIdx = 0; horiz = true; showPass('Player 2, your turn to place ships', () => { phase = 'place'; msg.textContent = 'Player 2: place your Carrier (5 cells).'; showBoards(); paint(); }); return; }
    phase = 'play'; turn = 0;
    if (twoPlayer) showPass('Player 1 fires first', () => { phase = 'play'; msg.textContent = 'Player 1: click a cell in enemy waters to fire.'; showBoards(); paint(); });
    else { msg.textContent = 'Your turn: click a cell in enemy waters to fire.'; paint(); }
  }
  function shoot(r, c) {
    const target = opp();
    if (target.shots[r][c]) { toast('Already fired there'); return; }
    const res = fire(target, r, c);
    const who = cur().name;
    lastMsg = res.sunk ? `${who}: ${LET[r]}${c + 1} — hit and sunk the ${res.sunk.name}!` : res.hit ? `${who}: ${LET[r]}${c + 1} — hit!` : `${who}: ${LET[r]}${c + 1} — miss.`;
    msg.textContent = lastMsg;
    if (allSunk(target)) return gameOver(turn);
    if (twoPlayer) {
      phase = 'handoff'; paint();
      render(placeBtns, el('button', { class: 'btn primary', onclick: () => { turn = 1 - turn; showPass(`${players[turn].name}, your turn`, () => { phase = 'play'; msg.textContent = `${players[turn].name}: fire!`; showBoards(); paint(); }); } }, `End turn — pass to ${players[1 - turn].name}`));
    } else {
      phase = 'ai'; paint();
      timer = setTimeout(aiTurn, 650);
    }
  }
  function aiTurn() {
    const me = players[0]; const [r, c] = aiPick(me);
    const res = fire(me, r, c);
    msg.textContent = lastMsg + '  |  ' + (res.sunk ? `Computer: ${LET[r]}${c + 1} — sank your ${res.sunk.name}!` : res.hit ? `Computer: ${LET[r]}${c + 1} — hit you.` : `Computer: ${LET[r]}${c + 1} — missed.`);
    if (allSunk(me)) return gameOver(1);
    phase = 'play'; paint();
  }
  function gameOver(winner) {
    phase = 'over';
    msg.textContent = `${players[winner].name} win${players[winner].name === 'You' ? '' : 's'}! All enemy ships sunk.`;
    if (!twoPlayer) { if (winner === 0) record.wins++; else record.losses++; s.set('record', record); updateStats(); }
    paint();
  }
  function showPass(title, go) {
    phase = 'pass';
    render(area, el('div', { class: 'panel center', style: { padding: '40px 20px' } },
      el('div', { class: 'big' }, title),
      el('div', { class: 'muted' }, 'Pass the device. The boards are hidden until you press the button.'),
      el('div', { style: { marginTop: '16px' } }, el('button', { class: 'btn primary', onclick: go }, 'I am ready'))));
  }
  function showBoards() { render(area, boards); }

  function paint() {
    if (phase === 'pass') return;
    const me = cur(), them = opp();
    const viewer = phase === 'place' ? placing : turn;
    ownTitle.textContent = `${players[viewer].name}'s fleet`;
    enemyTitle.textContent = phase === 'place' ? (twoPlayer ? 'Enemy waters (hidden until battle)' : 'Enemy waters') : `${players[1 - viewer].name}'s waters`;
    // own board
    const preview = new Set();
    if (phase === 'place' && hover && shipIdx < FLEET.length) {
      const len = FLEET[shipIdx][1];
      for (let i = 0; i < len; i++) { const rr = horiz ? hover[0] : hover[0] + i, cc = horiz ? hover[1] + i : hover[1]; if (rr < N && cc < N) preview.add(rr * N + cc); }
    }
    const previewOk = phase === 'place' && hover && shipIdx < FLEET.length && canPlace(me, hover[0], hover[1], FLEET[shipIdx][1], horiz);
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const d = own.cells[r][c]; const ship = me.grid[r][c] !== -1 ? me.ships[me.grid[r][c]] : null; const shot = me.shots[r][c];
      let bg = 'var(--bg)', txt = '', color = '';
      if (ship) bg = ship.sunk ? 'var(--danger)' : 'var(--accent)';
      if (shot === 2) { txt = '✕'; color = '#fff'; } else if (shot === 1) { txt = '•'; color = 'var(--muted)'; }
      if (preview.has(r * N + c)) bg = previewOk ? 'var(--ok)' : 'var(--danger)';
      d.style.background = bg; d.textContent = txt; d.style.color = color; d.style.cursor = phase === 'place' ? 'pointer' : 'default';
    }
    // enemy board
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const d = enemy.cells[r][c]; const shot = them.shots[r][c];
      const ship = them.grid[r][c] !== -1 ? them.ships[them.grid[r][c]] : null;
      let bg = 'var(--bg)', txt = '', color = '';
      if (shot === 2) { bg = ship && ship.sunk ? 'var(--danger)' : 'var(--warn)'; txt = '✕'; color = '#fff'; }
      else if (shot === 1) { txt = '•'; color = 'var(--muted)'; }
      else if (phase === 'over' && ship) bg = 'var(--line)';
      d.style.background = bg; d.textContent = txt; d.style.color = color; d.style.cursor = phase === 'play' ? 'crosshair' : 'default';
    }
    render(fleetList, FLEET.map(([name, len], i) => {
      const sh = me.ships[i];
      return el('span', { class: 'badge ' + (sh ? (sh.sunk ? 'danger' : 'ok') : '') }, `${name} ${len}${sh && sh.sunk ? ' sunk' : ''}`);
    }));
    render(enemyFleetList, phase === 'place' ? [] : them.ships.map(sh => el('span', { class: 'badge ' + (sh.sunk ? 'danger' : '') }, `${sh.name} ${sh.len}${sh.sunk ? ' sunk' : ''}`)));
    if (phase === 'place') render(placeBtns,
      el('button', { class: 'btn', onclick: () => { horiz = !horiz; paint(); } }, `Rotate (${horiz ? 'horizontal' : 'vertical'})`),
      el('button', { class: 'btn', onclick: () => { randomFleet(me); shipIdx = FLEET.length; msg.textContent = `${me.name}: fleet placed randomly. Press Start battle.`; paint(); } }, 'Random'),
      el('button', { class: 'btn ghost', onclick: undoShip, disabled: !me.ships.length }, 'Undo'),
      el('button', { class: 'btn primary', onclick: finishPlacing, disabled: shipIdx < FLEET.length }, 'Start battle'));
    else if (phase !== 'handoff') render(placeBtns);
  }
  function updateStats() { render(stats, stat(record.wins, 'wins vs computer'), stat(record.losses, 'losses')); }
  function onKey(e) {
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (phase === 'place' && (e.key === 'r' || e.key === 'R')) { horiz = !horiz; paint(); }
    else if (phase === 'place' && e.key === 'Enter' && shipIdx >= FLEET.length) finishPlacing();
    else if (phase === 'over' && e.key === 'Enter') start();
  }
  window.addEventListener('keydown', onKey);

  render(root,
    el('div', { class: 'row' }, modeSel, el('button', { class: 'btn primary', onclick: start }, 'New game'), stats),
    msg, area,
    el('div', { class: 'muted small' }, 'Click your board to place each ship, R or the button to rotate. Then click enemy waters to fire; one shot per turn. Yellow ✕ hit, red = sunk, • miss.'));
  updateStats(); start();
  return () => { clearTimeout(timer); window.removeEventListener('keydown', onKey); };
}
