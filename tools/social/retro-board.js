// Team retro board: Went well / To improve / Action items, anonymous cards, votes, drag between columns, timer, Markdown export.
import { el, render, store, download, copy, uid, toast } from '../../lib/ui.js';

const COLS = [{ id: 'well', title: 'Went well', color: 'var(--ok)' }, { id: 'improve', title: 'To improve', color: 'var(--warn)' }, { id: 'action', title: 'Action items', color: 'var(--accent)' }];

export default function (root) {
  const s = store('retro-board');
  const st = s.get('state', { title: 'Sprint retro', cards: [], votesPer: 5, used: 0, sort: 'votes', hidden: false });
  const save = () => s.set('state', st);
  const note = el('div', { class: 'muted small' }, 'Local tool: the board lives in this browser, so run it on a shared screen. Cards have no author. Votes are limited per round (set below); "New vote round" resets the budget.');
  let dragId = null, secs = s.get('timer', 300), left = secs, running = false, iv = null;
  const board = el('div', { class: 'grid2', style: { gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', alignItems: 'start' } });
  const timeEl = el('span', { class: 'big mono' }), startBtn = el('button', { class: 'btn primary small', onclick: () => (running ? pause() : start()) }, 'Start');
  const minIn = el('input', { class: 'input', type: 'number', min: 1, max: 120, value: Math.round(secs / 60), style: { width: '70px' }, onchange: e => { secs = Math.max(1, Math.min(120, +e.target.value || 5)) * 60; s.set('timer', secs); pause(); left = secs; drawTime(); } });
  const voteInfo = el('span', { class: 'badge' });

  function drawTime() { timeEl.textContent = Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0'); timeEl.style.color = left <= 30 && left < secs ? 'var(--danger)' : 'var(--text)'; }
  function pause() { running = false; clearInterval(iv); iv = null; startBtn.textContent = left > 0 && left < secs ? 'Resume' : 'Start'; }
  function start() {
    if (left <= 0) left = secs;
    running = true; startBtn.textContent = 'Pause'; clearInterval(iv);
    iv = setInterval(() => { left--; drawTime(); if (left <= 0) { pause(); left = 0; drawTime(); beep(); toast('Time is up!'); startBtn.textContent = 'Restart'; } }, 1000);
  }
  function beep() {
    try { const A = window.AudioContext || window.webkitAudioContext, c = new A(), o = c.createOscillator(), g = c.createGain(); o.connect(g); g.connect(c.destination); g.gain.value = 0.1; o.frequency.value = 880; o.start(); o.stop(c.currentTime + 0.5); setTimeout(() => c.close(), 800); } catch { /* no audio */ }
  }

  function addCard(col, input) {
    const text = input.value.trim(); if (!text) return;
    st.cards.push({ id: uid(), col, text, votes: 0, done: false, ts: Date.now() }); input.value = ''; save(); draw();
  }
  function move(card, col) { if (card.col !== col) { card.col = col; save(); draw(); } }
  function draw() {
    voteInfo.textContent = `Votes left: ${Math.max(0, st.votesPer - st.used)} of ${st.votesPer}`;
    render(board, COLS.map(col => {
      const input = el('textarea', { class: 'textarea prose', style: { minHeight: '56px' }, placeholder: 'Add a card (Enter to post, Shift+Enter for a new line)', onkeydown: e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addCard(col.id, input); } } });
      const cards = st.cards.filter(c => c.col === col.id).sort((a, b) => st.sort === 'votes' ? b.votes - a.votes || a.ts - b.ts : a.ts - b.ts);
      const zone = el('div', { class: 'col', style: { minHeight: '90px', padding: '4px', borderRadius: '8px', border: '2px dashed transparent' } },
        cards.map(c => {
          const idx = COLS.findIndex(x => x.id === col.id);
          return el('div', { class: 'panel', draggable: 'true', style: { cursor: 'grab', borderLeft: '4px solid ' + col.color, opacity: c.done ? .55 : 1 },
            ondragstart: e => { dragId = c.id; e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', c.id); } catch {} }, ondragend: () => { dragId = null; } },
            el('div', { style: { whiteSpace: 'pre-wrap', textDecoration: c.done ? 'line-through' : '' } }, st.hidden && c.ts > st.revealAfter ? '••••••' : c.text),
            el('div', { class: 'row', style: { margin: '6px 0 0', gap: '6px' } },
              el('button', { class: 'btn small', title: 'Vote', onclick: () => { if (st.used >= st.votesPer) { toast('No votes left. Start a new vote round.'); return; } c.votes++; st.used++; save(); draw(); } }, '👍 ' + c.votes),
              c.votes ? el('button', { class: 'btn small ghost', title: 'Remove one vote', onclick: () => { c.votes--; st.used = Math.max(0, st.used - 1); save(); draw(); } }, '−') : null,
              col.id === 'action' ? el('label', { class: 'inline small' }, el('input', { type: 'checkbox', checked: c.done, onchange: e => { c.done = e.target.checked; save(); draw(); } }), 'done') : null,
              el('span', { class: 'grow' }),
              idx > 0 ? el('button', { class: 'btn small ghost', title: 'Move left', onclick: () => move(c, COLS[idx - 1].id) }, '◀') : null,
              idx < COLS.length - 1 ? el('button', { class: 'btn small ghost', title: 'Move right', onclick: () => move(c, COLS[idx + 1].id) }, '▶') : null,
              el('button', { class: 'btn small ghost', title: 'Delete', onclick: () => { st.used = Math.max(0, st.used - c.votes); st.cards = st.cards.filter(x => x !== c); save(); draw(); } }, '✕')));
        }));
      zone.addEventListener('dragover', e => { e.preventDefault(); zone.style.borderColor = col.color; });
      zone.addEventListener('dragleave', () => { zone.style.borderColor = 'transparent'; });
      zone.addEventListener('drop', e => { e.preventDefault(); zone.style.borderColor = 'transparent'; const id = dragId || (e.dataTransfer && e.dataTransfer.getData('text/plain')); const c = st.cards.find(x => x.id === id); if (c) move(c, col.id); });
      return el('div', { class: 'panel' }, el('div', { class: 'row', style: { margin: '0 0 6px' } }, el('b', { style: { color: col.color } }, col.title), el('span', { class: 'badge' }, cards.length)), input, zone);
    }));
  }

  function markdown() {
    const out = [`# ${st.title || 'Retro'}`, `_${new Date().toLocaleDateString()}_`, ''];
    for (const col of COLS) {
      out.push(`## ${col.title}`);
      const cards = st.cards.filter(c => c.col === col.id).sort((a, b) => b.votes - a.votes || a.ts - b.ts);
      if (!cards.length) out.push('_nothing_');
      for (const c of cards) out.push(col.id === 'action' ? `- [${c.done ? 'x' : ' '}] ${c.text.replace(/\n/g, ' ')}${c.votes ? ` (${c.votes} votes)` : ''}` : `- ${c.text.replace(/\n/g, ' ')}${c.votes ? ` (+${c.votes})` : ''}`);
      out.push('');
    }
    return out.join('\n');
  }
  let confirmClear = false, ct = null;
  const clearBtn = el('button', { class: 'btn danger small', onclick: () => {
    if (!confirmClear) { confirmClear = true; clearBtn.textContent = 'Click again to delete all cards'; ct = setTimeout(() => { confirmClear = false; clearBtn.textContent = 'Clear board'; }, 3000); return; }
    clearTimeout(ct); confirmClear = false; clearBtn.textContent = 'Clear board'; st.cards = []; st.used = 0; save(); draw();
  } }, 'Clear board');

  render(root, note,
    el('div', { class: 'row' },
      el('input', { class: 'input grow', value: st.title, placeholder: 'Retro title', oninput: e => { st.title = e.target.value; save(); } }),
      el('span', { class: 'small muted' }, 'Timer (min)'), minIn, timeEl, startBtn,
      el('button', { class: 'btn small ghost', onclick: () => { pause(); left = secs; startBtn.textContent = 'Start'; drawTime(); } }, 'Reset')),
    el('div', { class: 'row' }, voteInfo,
      el('label', { class: 'inline small' }, 'Votes per round', el('input', { class: 'input', type: 'number', min: 1, max: 50, value: st.votesPer, style: { width: '70px' }, onchange: e => { st.votesPer = Math.max(1, Math.min(50, +e.target.value || 5)); save(); draw(); } })),
      el('button', { class: 'btn small', onclick: () => { st.used = 0; save(); draw(); toast('New vote round: budget reset'); } }, 'New vote round'),
      el('button', { class: 'btn small', onclick: () => { st.sort = st.sort === 'votes' ? 'time' : 'votes'; save(); draw(); } }, 'Toggle sort: votes / newest last'),
      el('label', { class: 'inline small', title: 'While on, cards added from now on are masked until you turn it off' }, el('input', { type: 'checkbox', checked: st.hidden, onchange: e => { st.hidden = e.target.checked; st.revealAfter = Date.now() - 1; save(); draw(); } }), 'Write silently (hide new cards)')),
    board,
    el('div', { class: 'row' }, el('button', { class: 'btn primary', onclick: () => download('retro.md', markdown(), 'text/markdown') }, 'Export Markdown'), el('button', { class: 'btn', onclick: () => copy(markdown()) }, 'Copy Markdown'), clearBtn));
  drawTime(); draw();
  return () => { clearInterval(iv); clearTimeout(ct); };
}
