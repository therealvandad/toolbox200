// Regex crossword: fill a grid so every row and column matches its regular expression.
import { el, render, store, toast } from '../../lib/ui.js';

const PUZZLES = [
  { name: 'Warm-up', rows: ['H[IO]', 'A[TS]'], cols: ['[HG]A', 'I[TD]'], sol: ['HI', 'AT'] },
  { name: 'Word square', rows: ['C[AO]T', 'A(RE|CE)', 'T[EO]N'], cols: ['C[AU]T', 'A(R|S)E', 'T[EA]N'], sol: ['CAT', 'ARE', 'TEN'] },
  { name: 'Dog days', rows: ['D[OU]G', 'A[RL]E', 'Y[EA]S'], cols: ['D[AO]Y', 'O(RE|AR)', 'G[EI]S'], sol: ['DOG', 'ARE', 'YES'] },
  { name: 'Alphabet soup', rows: ['(A|B)*', 'A.B', '[^A]+'], cols: ['A+B', '(BC)+B', 'ABC'], sol: ['ABA', 'ACB', 'BBC'] },
  { name: 'Rain', rows: ['R[AO]IN', 'I(DE|CE)A', 'N[EO]ST'], cols: ['R[IO]N', 'A[DN]E', 'I[EA]S', 'N[AO]T'], sol: ['RAIN', 'IDEA', 'NEST'] },
  { name: 'Noughts and crosses', rows: ['(XO)+', '(OX)+', 'X+O+', 'O+X+'], cols: ['(XO){2}', 'OX{2}O', 'XO+X', '(OX)+'], sol: ['XOXO', 'OXOX', 'XXOO', 'OOXX'] },
  { name: 'Moonlight', rows: ['M[OU]{2}N', 'A[RL]TS', 'P[EA]+L'], cols: ['MA[PT]', 'O[RL]E', 'OTE', 'N[SZ]L'], sol: ['MOON', 'ARTS', 'PEEL'] },
  { name: 'Backreferences', rows: ['(.)\\1.\\1', '(.)(.)\\2\\1', '(.)B+\\1'], cols: ['A[BC]A', 'AC[BD]', 'B[CD]B', '(.)B\\1'], sol: ['AABA', 'BCCB', 'ABBA'] },
  { name: 'Card trick', rows: ['[CB]A[RL]D', 'A(RE|CE)A', 'R[EA]AR', 'D[AO]R[TS]'], cols: ['[CK]ARD', 'AR[EA]A', 'RE[AE]R', 'DAR[TK]'], sol: ['CARD', 'AREA', 'REAR', 'DART'] },
  { name: 'Digits', rows: ['[1-3]+', '2(4|5)6', '7[89]9'], cols: ['1[2-4]7', '[2-4]4[8-9]', '36[0-9]'], sol: ['123', '246', '789'] },
  { name: 'Vowels only', rows: ['[AEIOU]{2}[^AEIOU]', 'E(A|E)T', '[^AEIOU][AEIOU]{2}'], cols: ['[AEIOU]E[^AEIOU]', '(AA|EE|OO)[AEIOU]', '[^AEIOU]T[AEIOU]'], sol: ['AEB', 'EET', 'TOO'] },
  { name: 'Mirror', rows: ['(..)\\1', '(.)(.)\\2\\1', '(.)\\1(.)\\2', '(.)(.)\\1\\2'], cols: ['[ST]+', 'T(O|S)+', '[OS]+T', 'T.*'], sol: ['STST', 'TOOT', 'SSOO', 'TOTO'] },
];

export default function (root) {
  const s = store('regex-crossword');
  let idx = Math.min(s.get('puzzle', 0), PUZZLES.length - 1);
  const solved = new Set(s.get('solved', []));
  let cells = [], hintsUsed = 0, rowBadges = [], colBadges = [];
  const board = el('div');
  const clueRows = el('div', { class: 'col' });
  const clueCols = el('div', { class: 'col' });
  const msg = el('div', { class: 'muted' });
  const progress = el('span', { class: 'muted small' });
  const pick = el('select', { class: 'select', onchange: () => { idx = +pick.value; s.set('puzzle', idx); build(); } });

  const fullRe = src => new RegExp('^(?:' + src + ')$');
  const gridText = () => cells.map(r => r.map(i => (i.value || ' ').toUpperCase()).join(''));
  const colText = (rows, c) => rows.map(r => r[c]).join('');

  function check() {
    const p = PUZZLES[idx]; const rows = gridText();
    let allOk = true; const filled = rows.every(r => !r.includes(' '));
    const judge = (re, txt, badge) => { const complete = !txt.includes(' '); const ok = complete && fullRe(re).test(txt); badge.className = 'badge ' + (complete ? (ok ? 'ok' : 'danger') : ''); if (!ok) allOk = false; };
    p.rows.forEach((re, r) => judge(re, rows[r], rowBadges[r]));
    p.cols.forEach((re, c) => judge(re, colText(rows, c), colBadges[c]));
    s.set('grid:' + idx, rows);
    if (allOk) {
      if (!solved.has(idx)) { solved.add(idx); s.set('solved', [...solved]); toast('Solved!'); }
      msg.textContent = `Solved${hintsUsed ? ` with ${hintsUsed} hint${hintsUsed > 1 ? 's' : ''}` : ''}. Pick another puzzle.`;
    } else msg.textContent = filled ? 'Not quite — red clues do not match yet.' : 'Fill every cell. Each clue must match its whole row or column.';
    refreshPick();
  }

  function refreshPick() {
    render(pick, PUZZLES.map((p, i) => el('option', { value: i }, `${i + 1}. ${p.name} (${p.sol.length}×${p.sol[0].length})${solved.has(i) ? ' ✓' : ''}`)));
    pick.value = idx; progress.textContent = `${solved.size}/${PUZZLES.length} solved`;
  }

  function hint() {
    const p = PUZZLES[idx]; const wrong = [];
    cells.forEach((row, r) => row.forEach((inp, c) => { if ((inp.value || '').toUpperCase() !== p.sol[r][c]) wrong.push([r, c]); }));
    if (!wrong.length) { msg.textContent = 'Nothing to reveal — the grid already matches the stored solution.'; return; }
    const [r, c] = wrong[Math.floor(Math.random() * wrong.length)];
    cells[r][c].value = p.sol[r][c]; cells[r][c].style.color = 'var(--warn)'; hintsUsed++;
    check();
  }

  function build() {
    const p = PUZZLES[idx]; hintsUsed = 0;
    const saved = s.get('grid:' + idx, null);
    const R = p.sol.length, C = p.sol[0].length;
    cells = [];
    const focusAt = (c, r) => { if (cells[r] && cells[r][c]) cells[r][c].focus(); };
    const table = el('table', { style: { borderCollapse: 'collapse', margin: '0 auto' } });
    for (let r = 0; r < R; r++) {
      const row = []; const tr = el('tr');
      for (let c = 0; c < C; c++) {
        const inp = el('input', {
          class: 'input', maxlength: 1, 'aria-label': `row ${r + 1} column ${c + 1}`,
          value: saved && saved[r] && saved[r][c] && saved[r][c] !== ' ' ? saved[r][c] : '',
          style: { width: '44px', height: '44px', textAlign: 'center', fontSize: '20px', fontWeight: '700', textTransform: 'uppercase', padding: '0' },
          oninput: () => { inp.value = inp.value.slice(-1).toUpperCase(); inp.style.color = ''; check(); if (inp.value) { if (c + 1 < C) focusAt(c + 1, r); else if (r + 1 < R) focusAt(0, r + 1); } },
          onkeydown: e => {
            const k = e.key;
            if (k === 'Backspace' && !inp.value) { if (c > 0) focusAt(c - 1, r); else if (r > 0) focusAt(C - 1, r - 1); }
            else if (k === 'ArrowRight') focusAt(c + 1, r); else if (k === 'ArrowLeft') focusAt(c - 1, r);
            else if (k === 'ArrowDown') focusAt(c, r + 1); else if (k === 'ArrowUp') focusAt(c, r - 1);
            else if (k === 'Escape') { inp.value = ''; check(); }
            else return;
            e.preventDefault();
          },
        });
        row.push(inp); tr.append(el('td', { style: { padding: '2px' } }, inp));
      }
      cells.push(row); table.append(tr);
    }
    render(board, table);
    rowBadges = p.rows.map((_, i) => el('span', { class: 'badge' }, 'R' + (i + 1)));
    colBadges = p.cols.map((_, i) => el('span', { class: 'badge' }, 'C' + (i + 1)));
    render(clueRows, el('div', { class: 'muted small' }, 'Rows →'), p.rows.map((re, i) => el('div', { class: 'row', style: { margin: '2px 0' } }, rowBadges[i], el('code', { class: 'mono' }, '^' + re + '$'))));
    render(clueCols, el('div', { class: 'muted small' }, 'Columns ↓'), p.cols.map((re, i) => el('div', { class: 'row', style: { margin: '2px 0' } }, colBadges[i], el('code', { class: 'mono' }, '^' + re + '$'))));
    check();
  }

  render(root,
    el('div', { class: 'row' },
      pick,
      el('button', { class: 'btn', onclick: hint }, 'Hint (reveal a letter)'),
      el('button', { class: 'btn ghost', onclick: () => { cells.flat().forEach(i => { i.value = ''; i.style.color = ''; }); hintsUsed = 0; check(); } }, 'Clear'),
      el('button', { class: 'btn ghost', onclick: () => { if (idx < PUZZLES.length - 1) { idx++; s.set('puzzle', idx); build(); } } }, 'Next ›'),
      progress),
    el('div', { class: 'row', style: { alignItems: 'flex-start' } },
      el('div', { class: 'panel' }, board),
      el('div', { class: 'panel grow' }, el('div', { class: 'row', style: { alignItems: 'flex-start', gap: '24px' } }, clueRows, clueCols))),
    msg,
    el('div', { class: 'muted small' }, 'Each pattern is anchored: it must match the entire row (left to right) or column (top to bottom). Letters are case-insensitive; type one per cell. Arrow keys move around the grid.'));
  refreshPick(); build();
}
