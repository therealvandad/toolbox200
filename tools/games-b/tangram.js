// Tangram: seven pieces you drag, rotate (45° steps) and flip on a canvas; built-in silhouettes, free mode, save your own puzzles.
import { el, render, store, loop, toast, pad } from '../../lib/ui.js';

const W = 600, H = 480, SCALE = 24;              // canvas px; world units (the full square is 8x8)
const Q = 2 * Math.SQRT2;                        // leg of a small triangle in world units
const COLORS = ['#d64545', '#2f6fed', '#1f9d55', '#d98c0b', '#8e44ad', '#17a2b8', '#e0527f'];
const SHAPES = [
  { name: 'Large triangle', pts: [[0, 0], [8, 0], [4, 4]] },
  { name: 'Large triangle', pts: [[0, 0], [8, 0], [4, 4]] },
  { name: 'Medium triangle', pts: [[0, 0], [4, 0], [0, 4]] },
  { name: 'Small triangle', pts: [[0, 0], [4, 0], [2, 2]] },
  { name: 'Small triangle', pts: [[0, 0], [4, 0], [2, 2]] },
  { name: 'Square', pts: [[0, 0], [2, 2], [0, 4], [-2, 2]] },
  { name: 'Parallelogram', pts: [[0, 0], [4, 0], [6, 2], [2, 2]] },
].map(s => {
  const cx = s.pts.reduce((a, p) => a + p[0], 0) / s.pts.length, cy = s.pts.reduce((a, p) => a + p[1], 0) / s.pts.length;
  return { name: s.name, pts: s.pts.map(([x, y]) => [x - cx, y - cy]) };
});
const START = [[20.5, 3.5], [20.5, 8], [20.5, 12.5], [3, 19], [8, 19], [20.5, 17], [14, 19]];
const q = polys => polys.map(p => p.map(([x, y]) => [x * Q, y * Q]));
// Built-in targets: each is the list of piece polygons in world units (verified non-overlapping, area 64).
const FIGURES = [
  { name: 'Square', polys: [[[0, 0], [8, 0], [4, 4]], [[0, 0], [4, 4], [0, 8]], [[8, 4], [8, 8], [4, 8]], [[4, 4], [6, 2], [8, 4], [6, 6]], [[2, 6], [4, 4], [6, 6]], [[6, 2], [8, 0], [8, 4]], [[0, 8], [2, 6], [6, 6], [4, 8]]] },
  { name: 'Triangle', polys: [[[8, 8], [0, 8], [4, 4]], [[16, 8], [8, 8], [12, 4]], [[6, 2], [10, 2], [12, 4], [8, 4]], [[10, 2], [6, 2], [8, 0]], [[6, 2], [8, 4], [6, 6], [4, 4]], [[8, 4], [12, 4], [8, 8]], [[8, 4], [8, 8], [6, 6]]] },
  { name: 'Cat', polys: [[[6, 2], [8, 4], [6, 6], [4, 4]], [[4, 4], [4, 0], [6, 2]], [[8, 0], [8, 4], [6, 2]], [[8, 4], [8, 12], [4, 8]], [[16, 12], [8, 12], [12, 8]], [[8, 8], [12, 8], [8, 12]], [[14, 10], [14, 6], [12, 4], [12, 8]]] },
  { name: 'House', polys: q([[[0, 2], [2, 2], [0, 4]], [[2, 2], [2, 4], [0, 4]], [[2, 2], [3, 2], [3, 3], [2, 3]], [[2, 3], [3, 3], [2, 4]], [[3, 3], [3, 4], [2, 4]], [[0, 2], [2, 2], [1, 1]], [[1, 1], [2, 1], [3, 2], [2, 2]]]) },
  { name: 'Fish', polys: q([[[0, 2], [2, 0], [2, 2]], [[0, 2], [2, 2], [2, 4]], [[2, 0], [2, 2], [3, 1]], [[2, 2], [3, 1], [3, 2]], [[2, 0], [3, 0], [3, 1]], [[2, 2], [3, 2], [3, 3], [2, 3]], [[2, 3], [3, 3], [4, 4], [3, 4]]]) },
  { name: 'Rocket', polys: q([[[0, 1], [2, 1], [1, 0]], [[0, 1], [2, 1], [0, 3]], [[2, 1], [2, 3], [0, 3]], [[0, 3], [1, 3], [2, 4], [1, 4]], [[1, 3], [2, 3], [2, 4]], [[0, 3], [0, 4], [1, 4]], [[0.5, 4], [1.5, 4], [1.5, 5], [0.5, 5]]]) },
  { name: 'Arrow', polys: q([[[4, 0], [6, 2], [4, 2]], [[4, 2], [6, 2], [4, 4]], [[0, 1.5], [1, 1.5], [1, 2.5], [0, 2.5]], [[1, 1.5], [1, 2.5], [2, 2.5]], [[1, 1.5], [2, 1.5], [3, 2.5], [2, 2.5]], [[2, 1.5], [4, 1.5], [3, 2.5]], [[3, 2.5], [4, 1.5], [4, 2.5]]]) },
];

const inside = (p, x, y) => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const [xi, yi] = p[i], [xj, yj] = p[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
const fmt = s => `${Math.floor(s / 60)}:${pad(Math.floor(s % 60))}`;

export default function (root) {
  const s = store('tangram');
  const canvas = el('canvas', { width: W, height: H, style: { maxWidth: '100%', height: 'auto', touchAction: 'none', cursor: 'grab', borderRadius: '6px' } });
  const ctx = canvas.getContext('2d');
  const off = el('canvas', { width: W / 4, height: H / 4 }), offT = el('canvas', { width: W / 4, height: H / 4 });
  const css = n => getComputedStyle(root).getPropertyValue(n).trim() || '#888';

  let pieces = [], order = [], sel = -1, drag = null, dirty = true;
  let target = null, targetKey = 'free', targetPolys = [], targetVerts = [];
  let solved = false, startAt = 0, elapsed = 0, timing = false;
  let custom = s.get('custom', []);
  let scores = s.get('scores', {});

  // ---- geometry ----
  function worldPts(p) {
    const a = p.rot * Math.PI / 180, c = Math.cos(a), sn = Math.sin(a);
    return SHAPES[p.i].pts.map(([lx, ly]) => { if (p.flip) lx = -lx; return [p.x + c * lx - sn * ly, p.y + sn * lx + c * ly]; });
  }
  function resetPieces(scatter) {
    pieces = SHAPES.map((_, i) => ({ i, x: START[i][0], y: START[i][1], rot: scatter ? 45 * Math.floor(Math.random() * 8) : 0, flip: scatter && i === 6 && Math.random() < 0.5 }));
    order = pieces.map((_, i) => i); sel = -1; dirty = true;
  }
  function setTarget(key) {
    targetKey = key; solved = false; elapsed = 0; timing = false; startAt = 0;
    let polys = null;
    if (key.startsWith('b:')) polys = FIGURES[+key.slice(2)].polys;
    else if (key.startsWith('c:')) { const c = custom.find(c => c.id === key.slice(2)); polys = c ? c.polys : null; }
    if (!polys) { target = null; targetPolys = []; targetVerts = []; }
    else {
      const xs = polys.flat().map(p => p[0]), ys = polys.flat().map(p => p[1]);
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
      const ox = 9.5 - cx, oy = 9.5 - cy;                       // centre the silhouette in the left part of the board
      targetPolys = polys.map(p => p.map(([x, y]) => [x + ox, y + oy]));
      targetVerts = targetPolys.flat();
      target = key;
    }
    resetPieces(false); showInfo(); dirty = true;
  }
  function snap(p) {
    const mine = worldPts(p);
    const others = pieces.filter(o => o !== p).flatMap(worldPts).concat(targetVerts);
    let best = 0.5, dx = 0, dy = 0;
    for (const [mx, my] of mine) for (const [ox, oy] of others) { const d = Math.hypot(ox - mx, oy - my); if (d < best) { best = d; dx = ox - mx; dy = oy - my; } }
    p.x += dx; p.y += dy;
  }
  function checkSolved() {
    if (!target || solved) return;
    const paint = (c, polys) => {
      const g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height); g.fillStyle = '#000';
      for (const poly of polys) { g.beginPath(); poly.forEach(([x, y], i) => g[i ? 'lineTo' : 'moveTo'](x * SCALE / 4, y * SCALE / 4)); g.closePath(); g.fill(); }
      return g.getImageData(0, 0, c.width, c.height).data;
    };
    const a = paint(off, pieces.map(worldPts)), b = paint(offT, targetPolys);
    let inter = 0, union = 0;
    for (let i = 3; i < a.length; i += 4) { const pa = a[i] > 127, pb = b[i] > 127; if (pa && pb) inter++; if (pa || pb) union++; }
    const iou = union ? inter / union : 0;
    if (iou >= 0.94) {
      solved = true; timing = false;
      const sc = scores[targetKey] || { count: 0, best: null };
      sc.count++; if (sc.best == null || elapsed < sc.best) sc.best = Math.round(elapsed);
      scores[targetKey] = sc; s.set('scores', scores); showInfo();
      toast(`Solved in ${fmt(elapsed)}!`);
    }
  }

  // ---- drawing ----
  function draw() {
    ctx.fillStyle = css('--bg'); ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = css('--line'); ctx.lineWidth = 1; ctx.setLineDash([2, 6]);
    for (let x = 0; x <= W; x += SCALE * 2) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    ctx.setLineDash([]);
    if (target) {
      ctx.fillStyle = solved ? css('--ok') : css('--muted'); ctx.globalAlpha = solved ? 0.35 : 0.22;
      ctx.beginPath();
      for (const poly of targetPolys) { poly.forEach(([x, y], i) => ctx[i ? 'lineTo' : 'moveTo'](x * SCALE, y * SCALE)); ctx.closePath(); }
      ctx.fill('nonzero'); ctx.globalAlpha = 1;
      ctx.strokeStyle = solved ? css('--ok') : css('--muted'); ctx.lineWidth = 1.5;
      for (const poly of targetPolys) { ctx.beginPath(); poly.forEach(([x, y], i) => ctx[i ? 'lineTo' : 'moveTo'](x * SCALE, y * SCALE)); ctx.closePath(); ctx.stroke(); }
    }
    for (const idx of order) {
      const p = pieces[idx], pts = worldPts(p);
      ctx.beginPath(); pts.forEach(([x, y], i) => ctx[i ? 'lineTo' : 'moveTo'](x * SCALE, y * SCALE)); ctx.closePath();
      ctx.fillStyle = COLORS[p.i]; ctx.globalAlpha = 0.9; ctx.fill(); ctx.globalAlpha = 1;
      ctx.lineWidth = idx === sel ? 3 : 1.2; ctx.strokeStyle = idx === sel ? css('--text') : 'rgba(0,0,0,.35)'; ctx.stroke();
    }
    ctx.fillStyle = css('--muted'); ctx.font = '12px system-ui, sans-serif'; ctx.textAlign = 'right';
    ctx.fillText(target ? (solved ? 'Solved!' : 'Fit all seven pieces into the grey silhouette') : 'Free mode: arrange, then save as a puzzle', W - 8, H - 8);
    ctx.textAlign = 'left';
  }

  // ---- input ----
  function pointerPos(e) { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) * W / r.width / SCALE, (e.clientY - r.top) * H / r.height / SCALE]; }
  function pick(x, y) { for (let k = order.length - 1; k >= 0; k--) if (inside(worldPts(pieces[order[k]]), x, y)) return order[k]; return -1; }
  function select(i) { sel = i; if (i >= 0) { order = order.filter(o => o !== i); order.push(i); } dirty = true; }
  function onDown(e) {
    const [x, y] = pointerPos(e); const i = pick(x, y);
    select(i); if (i < 0) return;
    drag = { i, dx: pieces[i].x - x, dy: pieces[i].y - y }; canvas.setPointerCapture(e.pointerId); canvas.style.cursor = 'grabbing';
    if (target && !timing && !solved) { timing = true; startAt = performance.now() - elapsed * 1000; }
  }
  function onMove(e) { if (!drag) return; const [x, y] = pointerPos(e); const p = pieces[drag.i]; p.x = Math.max(0, Math.min(W / SCALE, x + drag.dx)); p.y = Math.max(0, Math.min(H / SCALE, y + drag.dy)); dirty = true; }
  function onUp() { if (!drag) return; snap(pieces[drag.i]); drag = null; canvas.style.cursor = 'grab'; dirty = true; checkSolved(); }
  function rotate(d) { if (sel < 0) return toast('Select a piece first'); const p = pieces[sel]; p.rot = ((p.rot + d) % 360 + 360) % 360; snap(p); dirty = true; checkSolved(); }
  function flip() { if (sel < 0) return toast('Select a piece first'); const p = pieces[sel]; p.flip = !p.flip; snap(p); dirty = true; checkSolved(); }
  function nudge(dx, dy) { if (sel < 0) return; pieces[sel].x += dx; pieces[sel].y += dy; dirty = true; checkSolved(); }
  const onKey = e => {
    if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    const k = e.key;
    if (k === 'r' || k === 'e') rotate(45); else if (k === 'R' || k === 'q') rotate(-45); else if (k === 'f' || k === 'F') flip();
    else if (k === 'ArrowLeft') nudge(-0.25, 0); else if (k === 'ArrowRight') nudge(0.25, 0); else if (k === 'ArrowUp') nudge(0, -0.25); else if (k === 'ArrowDown') nudge(0, 0.25);
    else if (k === 'n' || k === 'Tab') select((sel + 1) % pieces.length); else if (k === 'Escape') select(-1); else return;
    e.preventDefault();
  };
  const onWheel = e => { if (sel < 0) return; e.preventDefault(); rotate(e.deltaY > 0 ? 45 : -45); };
  canvas.addEventListener('pointerdown', onDown); canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp); canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('dblclick', () => rotate(45));
  canvas.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('keydown', onKey);

  // ---- UI ----
  const puzzleSel = el('select', { class: 'select', onchange: () => setTarget(puzzleSel.value) });
  const nameIn = el('input', { class: 'input', placeholder: 'Puzzle name', style: { width: '160px' }, onkeydown: e => { if (e.key === 'Enter') savePuzzle(); } });
  const info = el('div', { class: 'row small muted' });
  const timeEl = el('span', { class: 'mono' }, '0:00');
  function fillSelect() {
    render(puzzleSel,
      el('option', { value: 'free' }, 'Free mode (no target)'),
      FIGURES.map((f, i) => el('option', { value: 'b:' + i }, f.name + (scores['b:' + i] ? ' ✓' : ''))),
      custom.map(c => el('option', { value: 'c:' + c.id }, 'Custom: ' + c.name + (scores['c:' + c.id] ? ' ✓' : ''))));
    puzzleSel.value = targetKey;
  }
  function showInfo() {
    const sc = scores[targetKey], total = Object.values(scores).reduce((a, v) => a + v.count, 0);
    render(info, el('span', {}, 'Time ', timeEl), sc ? el('span', {}, ` · solved ${sc.count}×, best ${fmt(sc.best)}`) : null, el('span', {}, ` · ${total} total solves`),
      targetKey.startsWith('c:') ? el('button', { class: 'btn ghost small danger', onclick: () => { custom = custom.filter(c => c.id !== targetKey.slice(2)); s.set('custom', custom); fillSelect(); setTarget('free'); fillSelect(); toast('Puzzle deleted'); } }, 'Delete this puzzle') : null);
    fillSelect();
  }
  function savePuzzle() {
    const name = nameIn.value.trim() || 'My puzzle ' + (custom.length + 1);
    const polys = pieces.map(worldPts);
    // refuse heavily overlapping layouts: the silhouette would be smaller than the pieces
    const g = off.getContext('2d'); g.clearRect(0, 0, off.width, off.height); g.fillStyle = '#000';
    for (const poly of polys) { g.beginPath(); poly.forEach(([x, y], i) => g[i ? 'lineTo' : 'moveTo'](x * SCALE / 4, y * SCALE / 4)); g.closePath(); g.fill(); }
    const d = g.getImageData(0, 0, off.width, off.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 127) n++;
    if (n < 64 * 36 * 0.9) return toast('Pieces overlap too much to make a fair puzzle');
    const id = Date.now().toString(36);
    custom.push({ id, name, polys }); s.set('custom', custom); nameIn.value = '';
    fillSelect(); toast(`Saved "${name}"`);
  }

  render(root,
    el('div', { class: 'row' },
      el('label', { class: 'inline' }, 'Puzzle ', puzzleSel),
      el('button', { class: 'btn small', onclick: () => rotate(-45) }, '⟲ 45°'),
      el('button', { class: 'btn small', onclick: () => rotate(45) }, '⟳ 45°'),
      el('button', { class: 'btn small', onclick: flip }, 'Flip'),
      el('button', { class: 'btn small ghost', onclick: () => { resetPieces(true); } }, 'Scatter'),
      el('button', { class: 'btn small ghost', onclick: () => { resetPieces(false); solved = false; elapsed = 0; timing = false; } }, 'Reset')),
    el('div', { class: 'row' },
      el('span', { class: 'small muted' }, 'Drag pieces; ', el('span', { class: 'kbd' }, 'R'), '/', el('span', { class: 'kbd' }, 'E'), ' rotate, ', el('span', { class: 'kbd' }, 'Q'), ' back, ', el('span', { class: 'kbd' }, 'F'), ' flip, wheel or double-click to rotate, arrows nudge, ', el('span', { class: 'kbd' }, 'N'), ' next piece. Corners snap together when you let go.')),
    info,
    el('div', { class: 'canvas-wrap' }, canvas),
    el('div', { class: 'row' }, nameIn, el('button', { class: 'btn primary small', onclick: savePuzzle }, 'Save current layout as puzzle'),
      el('span', { class: 'small muted' }, 'Arrange the pieces into any shape (free mode is handy), then save it; it appears in the list as a silhouette for later.')));

  setTarget('b:0');
  const stop = loop(() => {
    if (timing) { elapsed = (performance.now() - startAt) / 1000; timeEl.textContent = fmt(elapsed); }
    if (dirty) { dirty = false; draw(); }
  });
  return () => { stop(); window.removeEventListener('keydown', onKey); };
}
