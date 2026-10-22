// Fantasy draft board: teams, rounds, snake order, player pool, pick timer, undo, CSV export. Everything lives in this browser.
import { el, render, store, download, copy, stat, field, uid, toast } from '../../lib/ui.js';
import { h3, csvCell } from './_share.js';

const TOOL = 'draft-board';
const DEF_TEAMS = ['Team 1', 'Team 2', 'Team 3', 'Team 4', 'Team 5', 'Team 6'];

export default function (root) {
  const s = store(TOOL);
  const st = s.get('state', { teams: DEF_TEAMS, rounds: 5, snake: true, secs: 90, players: [], picks: [] });
  const save = () => s.set('state', st);
  let remain = st.secs, running = false, timer = null, filterText = '', filterPos = '';

  const order = () => {   // team index for each overall pick
    const T = st.teams.length, out = [];
    for (let r = 0; r < st.rounds; r++) for (let i = 0; i < T; i++) out.push(st.snake && r % 2 ? T - 1 - i : i);
    return out;
  };
  const note = el('div', { class: 'muted small' }, 'Local tool: the draft lives in this browser (localStorage). Nothing is uploaded; export the CSV to share results.');

  // ---- setup ----
  const teamsTa = el('textarea', { class: 'textarea prose', style: { minHeight: '110px' }, value: st.teams.join('\n') });
  const roundsIn = el('input', { class: 'input', type: 'number', min: 1, max: 40, value: st.rounds, style: { width: '90px' } });
  const snakeIn = el('input', { type: 'checkbox', checked: st.snake });
  const secsIn = el('input', { class: 'input', type: 'number', min: 10, max: 600, value: st.secs, style: { width: '90px' } });
  const setupMsg = el('span', { class: 'small muted' });
  function applySetup() {
    if (st.picks.length) { setupMsg.textContent = 'Undo all picks (or reset) before changing teams, rounds or order.'; return; }
    const teams = teamsTa.value.split('\n').map(x => x.trim()).filter(Boolean);
    if (teams.length < 2) { setupMsg.textContent = 'Need at least 2 teams.'; return; }
    st.teams = teams.slice(0, 32); st.rounds = Math.max(1, Math.min(40, +roundsIn.value || 1)); st.snake = snakeIn.checked;
    st.secs = Math.max(10, Math.min(600, +secsIn.value || 90)); remain = st.secs; save(); setupMsg.textContent = 'Applied.'; drawAll();
  }

  // ---- players ----
  const bulk = el('textarea', { class: 'textarea', style: { minHeight: '90px' }, placeholder: 'One player per line. Optional position after a comma:\nPatrick Mahomes, QB\nJustin Jefferson, WR' });
  function addPlayers() {
    let n = 0;
    for (const line of bulk.value.split('\n')) {
      const [name, pos = ''] = line.split(',').map(x => x.trim());
      if (name && !st.players.some(p => p.name.toLowerCase() === name.toLowerCase())) { st.players.push({ id: uid(), name, pos: pos.toUpperCase() }); n++; }
    }
    bulk.value = ''; save(); drawAll(); toast(n + ' player(s) added');
  }
  const search = el('input', { class: 'input grow', placeholder: 'Filter players…', oninput: e => { filterText = e.target.value.toLowerCase(); drawPool(); }, onkeydown: e => { if (e.key === 'Escape') { search.value = ''; filterText = ''; drawPool(); } } });
  const posSel = el('select', { class: 'select', onchange: e => { filterPos = e.target.value; drawPool(); } });
  const pool = el('div', { class: 'row', style: { maxHeight: '260px', overflow: 'auto', alignItems: 'flex-start' } });
  const custom = el('input', { class: 'input grow', placeholder: 'Pick a name not in the pool (Enter)', onkeydown: e => { if (e.key === 'Enter') pickCustom(); } });

  // ---- draft ----
  const clock = el('div', { class: 'panel' });
  const timeEl = el('span', { class: 'big mono' });
  const startBtn = el('button', { class: 'btn primary small', onclick: () => { running ? pause() : resume(); } }, 'Start timer');
  const board = el('div', { class: 'scroll-x' });
  const stats = el('div', { class: 'row' });

  function pause() { running = false; clearInterval(timer); timer = null; startBtn.textContent = 'Start timer'; }
  function resume() {
    if (done()) return; running = true; startBtn.textContent = 'Pause'; clearInterval(timer);
    timer = setInterval(() => { remain = Math.max(0, remain - 1); drawTime(); if (remain === 0) { pause(); toast('Time is up for ' + currentTeamName()); } }, 1000);
  }
  function resetClock() { remain = st.secs; drawTime(); }
  const done = () => st.picks.length >= st.teams.length * st.rounds;
  const currentTeamName = () => done() ? '' : st.teams[order()[st.picks.length]];
  function drawTime() {
    timeEl.textContent = Math.floor(remain / 60) + ':' + String(remain % 60).padStart(2, '0');
    timeEl.style.color = remain <= 10 && !done() ? 'var(--danger)' : 'var(--text)';
  }
  function makePick(player) {
    if (done()) { toast('Draft is complete'); return; }
    const ord = order(), n = st.picks.length;
    st.picks.push({ n: n + 1, team: ord[n], player: player.name, pos: player.pos || '', pid: player.id });
    save(); const wasRunning = running; resetClock(); if (done()) pause(); else if (wasRunning) { /* keep running */ } drawAll();
  }
  function pickCustom() {
    const name = custom.value.trim(); if (!name) return;
    let p = st.players.find(x => x.name.toLowerCase() === name.toLowerCase());
    if (p && st.picks.some(k => k.pid === p.id)) { toast('Already drafted'); return; }
    if (!p) { p = { id: uid(), name, pos: '' }; st.players.push(p); }
    custom.value = ''; makePick(p);
  }
  function undo() {
    if (!st.picks.length) return; st.picks.pop(); save(); resetClock(); drawAll();
  }
  let confirmReset = false, resetTimer = null;
  const resetBtn = el('button', { class: 'btn danger small', onclick: () => {
    if (!confirmReset) { confirmReset = true; resetBtn.textContent = 'Click again to clear all picks'; resetTimer = setTimeout(() => { confirmReset = false; resetBtn.textContent = 'Reset draft'; }, 3000); return; }
    clearTimeout(resetTimer); confirmReset = false; resetBtn.textContent = 'Reset draft'; st.picks = []; save(); pause(); resetClock(); drawAll();
  } }, 'Reset draft');

  function exportCsv() {
    const rows = [['Pick', 'Round', 'Team', 'Player', 'Position']];
    const T = st.teams.length;
    for (const k of st.picks) rows.push([k.n, Math.floor((k.n - 1) / T) + 1, st.teams[k.team], k.player, k.pos]);
    download('draft-results.csv', rows.map(r => r.map(csvCell).join(',')).join('\n'), 'text/csv');
  }

  function drawPool() {
    const taken = new Set(st.picks.map(k => k.pid));
    const avail = st.players.filter(p => !taken.has(p.id));
    const poss = [...new Set(st.players.map(p => p.pos).filter(Boolean))].sort();
    render(posSel, el('option', { value: '' }, 'All positions'), poss.map(p => el('option', { value: p, selected: p === filterPos }, p)));
    const list = avail.filter(p => (!filterText || p.name.toLowerCase().includes(filterText)) && (!filterPos || p.pos === filterPos));
    if (!avail.length) render(pool, el('div', { class: 'muted small' }, st.players.length ? 'All players are drafted.' : 'Add players above to build the pool.'));
    else if (!list.length) render(pool, el('div', { class: 'muted small' }, 'No players match the filter.'));
    else render(pool, list.map(p => el('span', { style: { display: 'inline-flex', gap: '2px' } },
      el('button', { class: 'btn small', disabled: done(), title: 'Draft to ' + currentTeamName(), onclick: () => makePick(p) }, p.name + (p.pos ? ' · ' + p.pos : '')),
      el('button', { class: 'btn small ghost', title: 'Remove from pool', onclick: () => { st.players = st.players.filter(x => x !== p); save(); drawPool(); } }, '✕'))));
  }

  function drawBoard() {
    const T = st.teams.length, ord = order();
    const byN = new Map(st.picks.map(k => [k.n, k]));
    const rows = [];
    for (let r = 0; r < st.rounds; r++) {
      const cells = st.teams.map((_, t) => {
        const idx = ord.slice(r * T, r * T + T).indexOf(t); const n = r * T + idx + 1; const k = byN.get(n);
        const isNow = n === st.picks.length + 1;
        return el('td', { style: { minWidth: '110px', border: isNow ? '2px solid var(--accent)' : '', background: k ? 'var(--bg)' : '' } },
          el('div', { class: 'small muted' }, '#' + n), k ? el('div', {}, el('b', {}, k.player), k.pos ? el('span', { class: 'badge', style: { marginLeft: '4px' } }, k.pos) : null) : isNow ? el('span', { class: 'badge ok' }, 'on the clock') : '');
      });
      rows.push(el('tr', {}, el('th', {}, 'R' + (r + 1) + (st.snake && r % 2 ? ' ←' : ' →')), cells));
    }
    render(board, el('table', { class: 'table' }, el('thead', {}, el('tr', {}, el('th', {}, ''), st.teams.map(t => el('th', {}, t)))), el('tbody', {}, rows)));
  }

  function drawClock() {
    const n = st.picks.length, T = st.teams.length;
    if (done()) render(clock, el('b', {}, 'Draft complete. ' + n + ' picks made.'));
    else {
      const upNext = order()[n + 1];
      render(clock, el('div', { class: 'row', style: { margin: 0 } },
        el('div', {}, el('div', { class: 'small muted' }, `Pick ${n + 1} of ${T * st.rounds} · Round ${Math.floor(n / T) + 1}`), el('div', { class: 'big' }, currentTeamName()),
          upNext != null ? el('div', { class: 'small muted' }, 'Up next: ' + st.teams[upNext]) : null),
        el('span', { class: 'grow' }), timeEl, startBtn));
    }
    render(stats, stat(st.picks.length, 'picks made'), stat(T * st.rounds - st.picks.length, 'picks left'), stat(st.players.length - st.picks.filter(k => st.players.some(p => p.id === k.pid)).length, 'in pool'));
  }

  function drawAll() { drawClock(); drawTime(); drawBoard(); drawPool(); }

  render(root, note,
    h3('Draft'), clock, stats,
    el('div', { class: 'row' },
      custom, el('button', { class: 'btn', onclick: pickCustom }, 'Pick'),
      el('button', { class: 'btn', onclick: undo }, 'Undo last pick'),
      el('button', { class: 'btn', onclick: () => { resetClock(); } }, 'Reset clock'),
      el('button', { class: 'btn', onclick: exportCsv }, 'Export CSV'),
      el('button', { class: 'btn ghost', onclick: () => copy(st.picks.map(k => `${k.n}. ${st.teams[k.team]}: ${k.player}${k.pos ? ' (' + k.pos + ')' : ''}`).join('\n')) }, 'Copy as text'),
      resetBtn),
    board,
    h3('Player pool'), el('div', { class: 'row' }, search, posSel), pool,
    el('details', {}, el('summary', { class: 'small muted' }, 'Add players'), bulk, el('div', { class: 'row' }, el('button', { class: 'btn primary', onclick: addPlayers }, 'Add to pool'))),
    h3('Setup'),
    el('div', { class: 'grid2' }, field('Teams (one per line, in first-round order)', teamsTa),
      el('div', { class: 'col' }, field('Rounds', roundsIn), field('Seconds per pick', secsIn), el('label', { class: 'inline' }, snakeIn, 'Snake order (reverse every other round)'))),
    el('div', { class: 'row' }, el('button', { class: 'btn', onclick: applySetup }, 'Apply setup'), setupMsg));
  drawAll();
  return () => { clearInterval(timer); clearTimeout(resetTimer); };
}
