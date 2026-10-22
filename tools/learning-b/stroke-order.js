// Stroke-order practice: animated strokes for hiragana and Latin capitals, trace and get scored.
import { el, render, store, loop, stat } from '../../lib/ui.js';

// Each glyph: strokes as polylines in a 0..100 box, in writing order.
const HIRAGANA = {
  'あ': [[[30, 28], [70, 26]], [[50, 10], [48, 50], [40, 88]], [[64, 44], [55, 68], [36, 86], [26, 74], [40, 58], [62, 56], [78, 68], [72, 86], [58, 90]]],
  'い': [[[30, 22], [30, 62], [44, 76]], [[64, 24], [72, 54], [68, 72]]],
  'う': [[[42, 14], [58, 22]], [[28, 42], [55, 36], [70, 46], [60, 70], [38, 88]]],
  'え': [[[42, 12], [58, 18]], [[28, 36], [68, 34], [44, 62], [30, 82], [46, 72], [60, 70], [76, 82]]],
  'お': [[[24, 36], [60, 30]], [[44, 12], [44, 56], [34, 82], [24, 70], [40, 56], [60, 70], [50, 88]], [[70, 20], [82, 32]]],
  'か': [[[22, 30], [56, 26], [50, 70], [38, 86]], [[40, 12], [36, 50], [20, 82]], [[68, 24], [82, 40]]],
  'き': [[[30, 30], [70, 22]], [[28, 48], [76, 40]], [[56, 10], [46, 56], [52, 66]], [[30, 72], [50, 66], [66, 76], [46, 90], [30, 86]]],
  'く': [[[66, 12], [32, 50], [66, 88]]],
  'け': [[[24, 20], [24, 80]], [[44, 38], [82, 32]], [[66, 14], [66, 70], [50, 88]]],
  'こ': [[[30, 30], [70, 24]], [[28, 64], [40, 80], [72, 78]]],
  'さ': [[[30, 32], [72, 24]], [[56, 10], [48, 54]], [[62, 50], [56, 76], [36, 86], [28, 72]]],
  'し': [[[40, 12], [38, 70], [50, 86], [70, 72]]],
  'す': [[[24, 30], [76, 26]], [[52, 12], [52, 54], [40, 62], [46, 50], [56, 52], [56, 70], [40, 88]]],
  'せ': [[[22, 42], [78, 34]], [[62, 14], [62, 64], [50, 70]], [[34, 20], [34, 78], [56, 86]]],
  'そ': [[[34, 14], [62, 12], [40, 38], [70, 36], [42, 56], [30, 70], [48, 86], [68, 80]]],
  'た': [[[22, 30], [46, 26]], [[38, 12], [34, 56], [24, 86]], [[58, 34], [80, 30]], [[56, 64], [62, 82], [86, 78]]],
  'ち': [[[28, 28], [68, 22]], [[52, 12], [44, 46], [70, 46], [78, 66], [60, 88], [38, 82]]],
  'つ': [[[24, 46], [50, 32], [78, 46], [68, 76], [40, 86]]],
  'て': [[[28, 32], [72, 26], [46, 56], [40, 76], [56, 88]]],
  'と': [[[42, 12], [56, 42]], [[66, 46], [36, 62], [34, 82], [76, 86]]],
  'な': [[[22, 30], [48, 26]], [[38, 12], [30, 50], [22, 72]], [[64, 20], [76, 32]], [[60, 46], [56, 66], [40, 82], [38, 70], [50, 64], [68, 72], [80, 86]]],
  'に': [[[24, 20], [24, 82]], [[48, 36], [80, 30]], [[48, 70], [56, 82], [80, 78]]],
  'ぬ': [[[38, 14], [28, 60], [22, 82]], [[62, 20], [46, 50], [28, 72], [40, 86], [66, 70], [72, 50], [60, 46], [56, 66], [72, 88], [86, 78]]],
  'ね': [[[34, 12], [34, 86]], [[28, 40], [56, 30], [42, 56], [24, 72], [46, 80], [62, 70], [70, 50], [60, 46], [60, 70], [76, 88], [86, 80]]],
  'の': [[[60, 24], [40, 34], [28, 56], [40, 80], [60, 86], [76, 66], [70, 40], [54, 30]]],
  'は': [[[22, 20], [22, 82]], [[44, 36], [82, 30]], [[66, 14], [66, 70], [46, 80], [56, 88], [76, 78]]],
  'ひ': [[[24, 30], [46, 30], [32, 56], [30, 80], [50, 88], [70, 70], [66, 46], [60, 30]]],
  'ふ': [[[42, 14], [56, 22]], [[48, 36], [58, 56], [46, 78], [36, 70]], [[22, 56], [34, 70]], [[68, 56], [80, 70]]],
  'へ': [[[18, 56], [42, 30], [82, 66]]],
  'ほ': [[[22, 20], [22, 82]], [[44, 28], [82, 24]], [[48, 48], [80, 44]], [[66, 14], [66, 70], [46, 80], [56, 88], [78, 78]]],
  'ま': [[[28, 28], [76, 22]], [[28, 46], [76, 40]], [[52, 12], [52, 70], [36, 80], [46, 88], [70, 80]]],
  'み': [[[34, 14], [56, 20], [46, 46], [30, 70], [28, 86], [48, 82], [66, 70], [60, 54]], [[56, 56], [72, 72], [86, 86]]],
  'む': [[[24, 36], [60, 30]], [[42, 12], [42, 66], [28, 80], [36, 88], [50, 78], [66, 88]], [[70, 20], [82, 32]]],
  'め': [[[38, 14], [28, 60], [22, 82]], [[62, 20], [46, 50], [28, 72], [40, 86], [66, 70], [72, 50], [60, 46], [60, 70], [72, 88]]],
  'も': [[[50, 12], [44, 66], [56, 86], [76, 80]], [[28, 36], [68, 30]], [[28, 56], [68, 50]]],
  'や': [[[24, 36], [56, 28], [72, 36], [60, 56], [40, 62]], [[62, 14], [72, 30]], [[42, 40], [40, 88]]],
  'ゆ': [[[34, 18], [28, 56], [32, 80], [50, 86], [62, 66], [56, 46], [42, 40]], [[58, 12], [56, 88]]],
  'よ': [[[52, 32], [72, 28]], [[52, 12], [52, 70], [36, 80], [46, 88], [70, 80]]],
  'ら': [[[42, 12], [58, 20]], [[38, 38], [56, 32], [76, 46], [68, 76], [46, 88]]],
  'り': [[[36, 20], [32, 56], [40, 66]], [[62, 18], [68, 56], [56, 80], [38, 88]]],
  'る': [[[34, 18], [66, 14], [42, 42], [72, 48], [76, 72], [56, 88], [40, 78], [50, 68], [66, 72]]],
  'れ': [[[32, 12], [32, 86]], [[24, 40], [52, 30], [40, 56], [28, 70], [46, 78], [60, 66], [64, 46], [60, 46], [62, 80], [78, 86]]],
  'ろ': [[[34, 18], [66, 14], [42, 42], [72, 48], [76, 72], [56, 88], [38, 78]]],
  'わ': [[[32, 12], [32, 86]], [[24, 40], [52, 30], [40, 56], [28, 70], [46, 78], [62, 70], [76, 50], [66, 36], [56, 38]]],
  'を': [[[30, 26], [70, 20]], [[50, 10], [40, 46], [72, 42], [56, 62], [46, 70]], [[30, 70], [50, 66], [70, 82], [50, 90]]],
  'ん': [[[56, 12], [36, 56], [24, 86], [40, 72], [56, 78], [70, 70], [82, 82]]],
};
const arc = (cx, cy, r, a0, a1, n = 10) => Array.from({ length: n + 1 }, (_, i) => { const a = (a0 + (a1 - a0) * i / n) * Math.PI / 180; return [+(cx + r * Math.cos(a)).toFixed(1), +(cy + r * Math.sin(a)).toFixed(1)]; });
const LATIN = {
  A: [[[50, 12], [20, 88]], [[50, 12], [80, 88]], [[32, 60], [68, 60]]],
  B: [[[25, 12], [25, 88]], [[25, 12], [55, 12], ...arc(55, 30, 18, -90, 90), [25, 48]], [[25, 48], [58, 48], ...arc(58, 68, 20, -90, 90), [25, 88]]],
  C: [arc(50, 50, 34, -40, -320)],
  D: [[[25, 12], [25, 88]], [[25, 12], [48, 12], ...arc(48, 50, 38, -90, 90), [25, 88]]],
  E: [[[72, 12], [25, 12], [25, 88], [72, 88]], [[25, 50], [62, 50]]],
  F: [[[72, 12], [25, 12], [25, 88]], [[25, 50], [62, 50]]],
  G: [[...arc(50, 50, 34, -40, -320), [84, 50], [55, 50]]],
  H: [[[25, 12], [25, 88]], [[75, 12], [75, 88]], [[25, 50], [75, 50]]],
  I: [[[50, 12], [50, 88]]],
  J: [[[60, 12], [60, 70], ...arc(42, 70, 18, 0, 180)]],
  K: [[[25, 12], [25, 88]], [[72, 12], [25, 55]], [[38, 44], [75, 88]]],
  L: [[[25, 12], [25, 88], [75, 88]]],
  M: [[[20, 88], [20, 12], [50, 65], [80, 12], [80, 88]]],
  N: [[[22, 88], [22, 12], [78, 88], [78, 12]]],
  O: [arc(50, 50, 36, -90, 270, 16)],
  P: [[[25, 12], [25, 88]], [[25, 12], [55, 12], ...arc(55, 32, 20, -90, 90), [25, 52]]],
  Q: [arc(50, 48, 34, -90, 270, 16), [[60, 62], [82, 90]]],
  R: [[[25, 12], [25, 88]], [[25, 12], [55, 12], ...arc(55, 32, 20, -90, 90), [25, 52]], [[48, 52], [78, 88]]],
  S: [[...arc(50, 32, 20, -30, -270), ...arc(50, 70, 20, -90, 150)]],
  T: [[[20, 12], [80, 12]], [[50, 12], [50, 88]]],
  U: [[[22, 12], [22, 62], ...arc(50, 62, 28, 180, 360), [78, 12]]],
  V: [[[20, 12], [50, 88], [80, 12]]],
  W: [[[14, 12], [32, 88], [50, 30], [68, 88], [86, 12]]],
  X: [[[22, 12], [78, 88]], [[78, 12], [22, 88]]],
  Y: [[[20, 12], [50, 50], [80, 12]], [[50, 50], [50, 88]]],
  Z: [[[22, 12], [78, 12], [22, 88], [78, 88]]],
};
const SETS = { hiragana: { title: 'Hiragana', glyphs: HIRAGANA }, latin: { title: 'Latin capitals', glyphs: LATIN } };

function dist(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]); }
function resample(points, n) { // points: array of [x,y]; returns n evenly spaced points along the polyline
  if (points.length === 0) return [];
  if (points.length === 1) return Array.from({ length: n }, () => points[0]);
  const segs = []; let total = 0; for (let i = 1; i < points.length; i++) { const d = dist(points[i - 1], points[i]); segs.push(d); total += d; }
  if (total === 0) return Array.from({ length: n }, () => points[0]);
  const out = []; let i = 0, acc = 0;
  for (let k = 0; k < n; k++) {
    const target = total * k / (n - 1);
    while (i < segs.length - 1 && acc + segs[i] < target) { acc += segs[i]; i++; }
    const t = segs[i] ? Math.min(1, (target - acc) / segs[i]) : 0;
    out.push([points[i][0] + (points[i + 1][0] - points[i][0]) * t, points[i][1] + (points[i + 1][1] - points[i][1]) * t]);
  }
  return out;
}
function similarity(user, ref) { // both: arrays of strokes (in 0..100 space)
  const N = 48;
  const flat = s => s.flat();
  const u = resample(flat(user), N), r = resample(flat(ref), N);
  if (!u.length) return { score: 0, order: 0, shape: 0 };
  const ordered = u.reduce((sum, p, i) => sum + dist(p, r[i]), 0) / N; // rewards correct order and direction
  const ua = user.map(s => resample(s, 24)).flat(), ra = ref.map(s => resample(s, 24)).flat();
  const nearest = (A, B) => A.reduce((sum, p) => sum + Math.min(...B.map(q => dist(p, q))), 0) / A.length;
  const shape = (nearest(ua, ra) + nearest(ra, ua)) / 2; // shape regardless of order
  const orderScore = Math.max(0, 100 - ordered * 4.5), shapeScore = Math.max(0, 100 - shape * 7);
  const strokePenalty = Math.min(30, Math.abs(user.length - ref.length) * 12);
  return { score: Math.max(0, Math.round(0.5 * orderScore + 0.5 * shapeScore - strokePenalty)), order: Math.round(orderScore), shape: Math.round(shapeScore) };
}

export default function (root) {
  const s = store('stroke-order');
  let setId = SETS[s.get('set', 'hiragana')] ? s.get('set', 'hiragana') : 'hiragana';
  let best = s.get('best', {}); let showGuide = s.get('guide', true);
  let glyphKeys = Object.keys(SETS[setId].glyphs); let idx = Math.min(s.get('idx', 0), glyphKeys.length - 1);
  const SIZE = 320;
  const canvas = el('canvas', { width: SIZE, height: SIZE, style: { width: '100%', maxWidth: SIZE + 'px', height: 'auto', touchAction: 'none', cursor: 'crosshair', borderRadius: '8px', background: 'var(--panel)' } });
  const ctx = canvas.getContext('2d');
  let userStrokes = [], current = null, anim = null, animT = 0, stopLoop = null, result = null;
  const title = el('div', { class: 'huge', style: { fontFamily: 'serif', minWidth: '90px', textAlign: 'center' } });
  const info = el('div', { class: 'row' });
  const picker = el('div', { class: 'row', style: { gap: '4px' } });
  const pct = v => v + '%';

  const glyph = () => SETS[setId].glyphs[glyphKeys[idx]];
  const key = () => setId + ':' + glyphKeys[idx];
  const toCanvas = p => [p[0] * SIZE / 100, p[1] * SIZE / 100];
  const colors = () => { const cs = getComputedStyle(document.documentElement); return { line: cs.getPropertyValue('--line').trim() || '#ddd', muted: cs.getPropertyValue('--muted').trim() || '#888', accent: cs.getPropertyValue('--accent').trim() || '#2f6fed', text: cs.getPropertyValue('--text').trim() || '#000', ok: cs.getPropertyValue('--ok').trim() || 'green' }; };

  function drawStroke(pts, color, width, upTo = Infinity) {
    if (pts.length < 1) return; ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
    const [x0, y0] = toCanvas(pts[0]); ctx.moveTo(x0, y0);
    if (pts.length === 1) ctx.lineTo(x0 + 0.1, y0);
    let len = 0;
    for (let i = 1; i < pts.length; i++) { const d = dist(pts[i - 1], pts[i]); if (len + d > upTo) { const t = (upTo - len) / d; const [x, y] = toCanvas([pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t]); ctx.lineTo(x, y); break; } const [x, y] = toCanvas(pts[i]); ctx.lineTo(x, y); len += d; }
    ctx.stroke();
  }
  function draw() {
    const c = colors(); ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.strokeStyle = c.line; ctx.lineWidth = 1; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(SIZE / 2, 0); ctx.lineTo(SIZE / 2, SIZE); ctx.moveTo(0, SIZE / 2); ctx.lineTo(SIZE, SIZE / 2); ctx.stroke(); ctx.setLineDash([]);
    const g = glyph();
    if (showGuide || anim) g.forEach(st => drawStroke(st, c.line, 14));
    if (anim) { // animate strokes up to animT (in length units)
      let remaining = animT;
      g.forEach((st, i) => { const L = st.reduce((a, _, j) => j ? a + dist(st[j - 1], st[j]) : 0, 0); if (remaining <= 0) return; drawStroke(st, c.accent, 10, remaining); if (remaining >= L) { const [x, y] = toCanvas(st[0]); ctx.fillStyle = c.text; ctx.font = 'bold 11px system-ui'; ctx.fillText(String(i + 1), x - 14, y - 6); } remaining -= L + 12; });
    } else if (showGuide) {
      g.forEach((st, i) => { const [x, y] = toCanvas(st[0]); ctx.fillStyle = c.muted; ctx.font = 'bold 11px system-ui'; ctx.fillText(String(i + 1), x - 14, y - 6); ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill(); });
    }
    userStrokes.forEach(st => drawStroke(st, result ? c.ok : c.text, 8));
    if (current) drawStroke(current, c.text, 8);
  }
  function play() {
    if (stopLoop) stopLoop();
    anim = true; animT = 0; const total = glyph().reduce((a, st) => a + st.reduce((b, _, j) => j ? b + dist(st[j - 1], st[j]) : 0, 0) + 12, 0);
    stopLoop = loop(dt => { animT += dt * 110; draw(); if (animT > total + 30) { stopLoop(); stopLoop = null; anim = null; draw(); } });
  }
  function score() {
    if (!userStrokes.length) return;
    result = similarity(userStrokes, glyph());
    const prev = best[key()] || 0; if (result.score > prev) { best[key()] = result.score; s.set('best', best); }
    updateInfo(); draw(); buildPicker();
  }
  function clear() { userStrokes = []; current = null; result = null; updateInfo(); draw(); }
  function updateInfo() {
    render(info, stat(result ? pct(result.score) : '–', 'score'), stat(result ? pct(result.order) : '–', 'stroke order'), stat(result ? pct(result.shape) : '–', 'shape'), stat(userStrokes.length + ' / ' + glyph().length, 'strokes'), stat(best[key()] ? pct(best[key()]) : '–', 'best'));
  }
  function select(i) { idx = i; s.set('idx', i); if (stopLoop) { stopLoop(); stopLoop = null; anim = null; } title.textContent = glyphKeys[idx]; clear(); buildPicker(); }
  function buildPicker() {
    render(picker, glyphKeys.map((k, i) => { const b = best[setId + ':' + k]; return el('button', { class: 'btn small' + (i === idx ? ' primary' : ''), style: { minWidth: '34px', padding: '3px 6px', borderColor: b >= 70 ? 'var(--ok)' : '' }, title: b ? 'best ' + b + '%' : '', onclick: () => select(i) }, k); }));
  }
  const pos = e => { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * 100, (e.clientY - r.top) / r.height * 100]; };
  canvas.addEventListener('pointerdown', e => { e.preventDefault(); canvas.setPointerCapture(e.pointerId); if (result) { userStrokes = []; result = null; } current = [pos(e)]; draw(); });
  canvas.addEventListener('pointermove', e => { if (!current) return; const p = pos(e); if (dist(p, current[current.length - 1]) > 0.8) { current.push(p); draw(); } });
  const end = e => { if (!current) return; userStrokes.push(current); current = null; updateInfo(); draw(); if (userStrokes.length >= glyph().length) score(); };
  canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
  const mo = new MutationObserver(draw); mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  const setSel = el('select', { class: 'select', onchange: () => { setId = setSel.value; s.set('set', setId); glyphKeys = Object.keys(SETS[setId].glyphs); select(0); } }, Object.entries(SETS).map(([k, v]) => el('option', { value: k }, v.title)));
  setSel.value = setId;
  const guideBtn = el('button', { class: 'btn', onclick: () => { showGuide = !showGuide; s.set('guide', showGuide); guideBtn.textContent = showGuide ? 'Hide guide' : 'Show guide'; draw(); } }, showGuide ? 'Hide guide' : 'Show guide');

  render(root,
    el('div', { class: 'row' }, setSel, el('button', { class: 'btn primary', onclick: play }, '▶ Play strokes'), guideBtn,
      el('button', { class: 'btn', onclick: score }, 'Score now'), el('button', { class: 'btn ghost', onclick: clear }, 'Clear'),
      el('button', { class: 'btn ghost', onclick: () => select((idx - 1 + glyphKeys.length) % glyphKeys.length) }, '‹ Prev'),
      el('button', { class: 'btn ghost', onclick: () => select((idx + 1) % glyphKeys.length) }, 'Next ›')),
    el('div', { class: 'row', style: { alignItems: 'flex-start' } }, title, el('div', { class: 'canvas-wrap', style: { flex: '1 1 320px' } }, canvas)),
    info, picker,
    el('div', { class: 'muted small' }, 'Press Play to watch the strokes in order, then trace them on the canvas with the same count, order and direction. Scoring is done automatically after the last stroke (or press Score now). Score mixes an ordered comparison along the path with an order-free shape distance; a wrong stroke count costs points. Stroke shapes are simplified approximations.'));
  select(idx);
  return () => { if (stopLoop) stopLoop(); mo.disconnect(); };
}
