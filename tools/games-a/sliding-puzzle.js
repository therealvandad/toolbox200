// Sliding puzzle: upload an image or use a generated pattern, 3×3 / 4×4 / 5×5, solvable shuffle, click or arrow keys,
// moves + timer, solved detection, preview of the full picture, best results per size kept in localStorage.
import { el, render, store, stat, toast, dropZone, loadImage, pad } from '../../lib/ui.js';

const SIZE = 600;

function makePattern() {
  const c = document.createElement('canvas'); c.width = c.height = SIZE; const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, SIZE, SIZE); grad.addColorStop(0, '#ff7a59'); grad.addColorStop(0.5, '#8e44ad'); grad.addColorStop(1, '#1e88e5');
  g.fillStyle = grad; g.fillRect(0, 0, SIZE, SIZE);
  g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 10;
  for (let r = 40; r < SIZE; r += 70) { g.beginPath(); g.arc(SIZE / 2, SIZE / 2, r, 0, Math.PI * 2); g.stroke(); }
  g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 14;
  g.beginPath(); g.moveTo(0, SIZE); g.lineTo(SIZE, 0); g.moveTo(0, 0); g.lineTo(SIZE, SIZE); g.stroke();
  g.fillStyle = 'rgba(255,255,255,.9)'; g.font = 'bold 160px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('★', SIZE / 2, SIZE / 2 + 10);
  return c;
}
function squareImage(img) {
  const c = document.createElement('canvas'); c.width = c.height = SIZE;
  const side = Math.min(img.width, img.height);
  c.getContext('2d').drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
  return c;
}
function isSolvable(tiles, n) {
  const blank = tiles.indexOf(n * n - 1);
  let inv = 0;
  for (let i = 0; i < tiles.length; i++) for (let j = i + 1; j < tiles.length; j++) if (tiles[i] !== n * n - 1 && tiles[j] !== n * n - 1 && tiles[i] > tiles[j]) inv++;
  if (n % 2 === 1) return inv % 2 === 0;
  const blankRowFromBottom = n - Math.floor(blank / n);
  return (inv + blankRowFromBottom) % 2 === 1;
}

export default function (root) {
  const s = store('sliding-puzzle');
  let n = s.get('size', 4), tiles = [], moves = 0, startAt = 0, elapsed = 0, solved = false, timer = null, source = null, showNumbers = s.get('numbers', true), preview = false;
  let best = s.get('best', {});

  const canvas = el('canvas', { width: SIZE, height: SIZE, style: { maxWidth: '100%', width: '100%', height: 'auto', display: 'block', borderRadius: '8px', touchAction: 'manipulation', cursor: 'pointer' } });
  const ctx = canvas.getContext('2d');
  const wrap = el('div', { class: 'canvas-wrap', style: { maxWidth: '520px', margin: '0 auto', position: 'relative' } }, canvas);
  const msg = el('div', { class: 'center', style: { fontWeight: '600', minHeight: '24px' } });
  const stats = el('div', { class: 'row', style: { justifyContent: 'center' } });
  const sizeSel = el('select', { class: 'select', value: String(n), onchange: () => { n = +sizeSel.value; s.set('size', n); newGame(); } },
    el('option', { value: '3' }, '3 × 3'), el('option', { value: '4' }, '4 × 4'), el('option', { value: '5' }, '5 × 5'));
  const numChk = el('input', { type: 'checkbox', checked: showNumbers, onchange: () => { showNumbers = numChk.checked; s.set('numbers', showNumbers); draw(); } });
  const previewBtn = el('button', { class: 'btn', onpointerdown: e => { e.preventDefault(); preview = true; draw(); }, onpointerup: () => { preview = false; draw(); }, onpointerleave: () => { preview = false; draw(); } }, 'Hold to preview');
  const thumb = el('canvas', { width: 120, height: 120, style: { borderRadius: '6px', border: '1px solid var(--line)', maxWidth: '100%' } });
  const zone = dropZone('Drop a picture here or click to choose one', async files => {
    try { const img = await loadImage(files[0]); source = squareImage(img); s.set('image', source.toDataURL('image/jpeg', 0.8)); drawThumb(); newGame(); toast('Picture loaded'); }
    catch { toast('Could not load that image'); }
  }, 'image/*', false);

  function fmtTime(ms) { const t = Math.floor(ms / 1000); return `${pad(Math.floor(t / 60))}:${pad(t % 60)}`; }
  function drawThumb() { thumb.getContext('2d').drawImage(source, 0, 0, 120, 120); }
  function newGame() {
    clearInterval(timer); timer = null; moves = 0; elapsed = 0; startAt = 0; solved = false;
    const N = n * n;
    do {
      tiles = Array.from({ length: N }, (_, i) => i);
      for (let i = N - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [tiles[i], tiles[j]] = [tiles[j], tiles[i]]; }
      if (!isSolvable(tiles, n)) { // swap two non-blank tiles to flip parity
        const a = tiles[0] === N - 1 ? 2 : 0, b = tiles[1] === N - 1 ? 2 : 1;
        [tiles[a], tiles[b]] = [tiles[b], tiles[a]];
      }
    } while (tiles.every((t, i) => t === i));
    msg.textContent = 'Click a tile next to the gap (or in its row/column) to slide it.';
    draw(); updateStats();
  }
  function tick() { elapsed = Date.now() - startAt; updateStats(); }
  function slide(pos) {
    if (solved) return false;
    const N = n * n, blank = tiles.indexOf(N - 1);
    const br = Math.floor(blank / n), bc = blank % n, r = Math.floor(pos / n), c = pos % n;
    if (pos === blank || (r !== br && c !== bc)) return false;
    // move every tile between pos and blank one step toward the blank
    const step = r === br ? (c < bc ? -1 : 1) : (r < br ? -n : n);
    let cur = blank; let count = 0;
    while (cur !== pos) { tiles[cur] = tiles[cur + step]; cur += step; count++; }
    tiles[pos] = N - 1;
    moves += count;
    if (!startAt) { startAt = Date.now(); timer = setInterval(tick, 250); }
    if (tiles.every((t, i) => t === i)) {
      solved = true; clearInterval(timer); timer = null; elapsed = Date.now() - startAt;
      const key = String(n), b = best[key] || {}; let note = '';
      if (!b.moves || moves < b.moves) { b.moves = moves; note += ' Fewest moves yet!'; }
      if (!b.time || elapsed < b.time) { b.time = elapsed; note += ' Fastest yet!'; }
      best[key] = b; s.set('best', best);
      msg.textContent = `Solved in ${moves} moves and ${fmtTime(elapsed)}.${note}`;
    } else msg.textContent = `${moves} move${moves === 1 ? '' : 's'}`;
    draw(); updateStats();
    return true;
  }
  function draw() {
    const N = n * n, t = SIZE / n;
    ctx.clearRect(0, 0, SIZE, SIZE);
    if (preview || solved) { ctx.drawImage(source, 0, 0); }
    else {
      ctx.fillStyle = getComputedStyle(root).getPropertyValue('--bg').trim() || '#eee'; ctx.fillRect(0, 0, SIZE, SIZE);
      for (let pos = 0; pos < N; pos++) {
        const id = tiles[pos]; if (id === N - 1) continue;
        const sr = Math.floor(id / n), sc = id % n, dr = Math.floor(pos / n), dc = pos % n;
        ctx.drawImage(source, sc * t, sr * t, t, t, dc * t, dr * t, t, t);
        ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 2; ctx.strokeRect(dc * t + 1, dr * t + 1, t - 2, t - 2);
        if (showNumbers) {
          ctx.font = `bold ${Math.round(t / 4)}px system-ui,sans-serif`; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
          const label = String(id + 1); const w = ctx.measureText(label).width + 10;
          ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(dc * t + 4, dr * t + 4, w, t / 4 + 6);
          ctx.fillStyle = '#fff'; ctx.fillText(label, dc * t + 9, dr * t + 7);
        }
      }
    }
    if (solved) {
      ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(0, SIZE / 2 - 50, SIZE, 100);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 48px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('Solved!', SIZE / 2, SIZE / 2);
    }
  }
  function updateStats() {
    const b = best[String(n)] || {};
    render(stats, stat(moves, 'moves'), stat(fmtTime(elapsed), 'time'), stat(b.moves || '–', `best moves (${n}×${n})`), stat(b.time ? fmtTime(b.time) : '–', 'best time'));
  }
  canvas.addEventListener('click', e => {
    const rect = canvas.getBoundingClientRect();
    const c = Math.floor((e.clientX - rect.left) / rect.width * n), r = Math.floor((e.clientY - rect.top) / rect.height * n);
    if (solved) { newGame(); return; }
    if (r >= 0 && r < n && c >= 0 && c < n) slide(r * n + c);
  });
  function onKey(e) {
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    const d = { ArrowUp: [1, 0], ArrowDown: [-1, 0], ArrowLeft: [0, 1], ArrowRight: [0, -1] }[e.key]; // tile moves in arrow direction => it sits on the opposite side of the blank
    if (d) {
      e.preventDefault(); if (solved) return;
      const blank = tiles.indexOf(n * n - 1), r = Math.floor(blank / n) + d[0], c = blank % n + d[1];
      if (r >= 0 && r < n && c >= 0 && c < n) slide(r * n + c);
    } else if (e.key === 'n' || e.key === 'N') newGame();
    else if (e.key === 'p' || e.key === 'P') { preview = !preview; draw(); }
    else if (e.key === 'Enter' && solved) newGame();
  }
  window.addEventListener('keydown', onKey);

  render(root,
    el('div', { class: 'row', style: { justifyContent: 'center' } }, sizeSel, el('button', { class: 'btn primary', onclick: newGame }, 'Shuffle'), previewBtn,
      el('label', { class: 'inline' }, numChk, 'Show numbers'),
      el('button', { class: 'btn ghost', onclick: () => { source = makePattern(); s.del('image'); drawThumb(); newGame(); } }, 'Use pattern')),
    stats, msg, wrap,
    el('div', { class: 'grid2', style: { alignItems: 'center', marginTop: '10px' } },
      zone,
      el('div', { class: 'row' }, thumb, el('span', { class: 'muted small' }, 'Goal picture. Arrow keys slide a tile into the gap, P toggles preview, N shuffles. Your picture stays in this browser.'))));

  source = makePattern(); drawThumb();
  const saved = s.get('image');
  if (saved) loadImage(saved).then(img => { source = squareImage(img); drawThumb(); draw(); }).catch(() => s.del('image'));
  newGame();
  return () => { clearInterval(timer); window.removeEventListener('keydown', onKey); };
}
