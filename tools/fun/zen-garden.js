import { el, render, download, toast } from '../../lib/ui.js';

const W = 900, H = 560;

export default function (root) {
  // base sand texture (static), sand layer (with grooves), stones list
  const base = document.createElement('canvas'); base.width = W; base.height = H;
  const sand = document.createElement('canvas'); sand.width = W; sand.height = H;
  const bx = base.getContext('2d'), sx = sand.getContext('2d');
  (function makeBase() {
    bx.fillStyle = '#e3d5b5'; bx.fillRect(0, 0, W, H);
    const img = bx.getImageData(0, 0, W, H), d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random() - 0.5) * 22;
      d[i] += n; d[i + 1] += n; d[i + 2] += n * 1.1;
    }
    bx.putImageData(img, 0, 0);
  })();
  sx.drawImage(base, 0, 0);

  const canvas = el('canvas', { width: W, height: H, style: { width: '100%', maxWidth: W + 'px', touchAction: 'none', cursor: 'crosshair', borderRadius: '8px', border: '10px solid #6b4f2d', boxSizing: 'border-box' } });
  const cx = canvas.getContext('2d');
  const stones = [];
  let tool = 'rake', tines = 5, spacing = 9, brush = 36;
  let drag = null; // {type:'rake'|'smooth'|'stone', ...}
  let dir = { x: 1, y: 0 };

  function blob(r) {
    const n = 14, pts = [], ph = Math.random() * 6.28, a2 = 0.08 + Math.random() * 0.1;
    for (let i = 0; i < n; i++) { const a = i / n * 6.28; pts.push([Math.cos(a), Math.sin(a) * (0.78 + Math.random() * 0.1), 1 + Math.sin(a * 2 + ph) * a2 + (Math.random() - 0.5) * 0.06]); }
    return pts;
  }
  function path(c, st, k = 1, ox = 0, oy = 0) {
    c.beginPath();
    st.pts.forEach(([ux, uy, m], i) => { const x = st.x + ox + ux * st.r * m * k, y = st.y + oy + uy * st.r * m * k; i ? c.lineTo(x, y) : c.moveTo(x, y); });
    c.closePath();
  }
  function draw() {
    cx.drawImage(sand, 0, 0);
    for (const st of stones) {
      // ripples in the sand
      cx.lineWidth = 3;
      for (let i = 1; i <= 3; i++) {
        cx.strokeStyle = 'rgba(100,80,45,.35)'; path(cx, st, 1 + i * 0.32, 0, 0); cx.stroke();
        cx.strokeStyle = 'rgba(255,250,235,.5)'; path(cx, st, 1 + i * 0.32, 1.5, 1.5); cx.stroke();
      }
      cx.save(); cx.filter = 'blur(5px)'; cx.fillStyle = 'rgba(0,0,0,.35)'; path(cx, st, 1, st.r * 0.18, st.r * 0.22); cx.fill(); cx.restore();
      const g = cx.createRadialGradient(st.x - st.r * 0.3, st.y - st.r * 0.35, st.r * 0.1, st.x, st.y, st.r * 1.1);
      g.addColorStop(0, '#b8b8b8'); g.addColorStop(0.6, '#767676'); g.addColorStop(1, '#4a4a4a');
      cx.fillStyle = g; path(cx, st); cx.fill();
      cx.strokeStyle = 'rgba(0,0,0,.25)'; cx.lineWidth = 1.5; cx.stroke();
    }
  }
  function pos(e) { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height }; }
  function stoneAt(p) { for (let i = stones.length - 1; i >= 0; i--) { const s = stones[i]; if (Math.hypot(p.x - s.x, (p.y - s.y) / 0.85) < s.r * 1.05) return s; } return null; }

  function smoothAt(p) {
    sx.save(); sx.beginPath(); sx.arc(p.x, p.y, brush / 2, 0, 6.28); sx.clip(); sx.drawImage(base, 0, 0); sx.restore();
  }
  function rakeSeg(a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
    if (len < 0.5) return;
    dir.x += (dx / len - dir.x) * 0.25; dir.y += (dy / len - dir.y) * 0.25;
    const dl = Math.hypot(dir.x, dir.y) || 1, ux = dir.x / dl, uy = dir.y / dl, nx = -uy, ny = ux;
    sx.lineCap = 'round';
    for (let k = 0; k < tines; k++) {
      const o = (k - (tines - 1) / 2) * spacing, ox = nx * o, oy = ny * o;
      sx.strokeStyle = 'rgba(105,82,45,.55)'; sx.lineWidth = 3.2;
      sx.beginPath(); sx.moveTo(a.x + ox, a.y + oy); sx.lineTo(b.x + ox, b.y + oy); sx.stroke();
      sx.strokeStyle = 'rgba(255,250,232,.65)'; sx.lineWidth = 2;
      sx.beginPath(); sx.moveTo(a.x + ox + nx * 2.4, a.y + oy + ny * 2.4); sx.lineTo(b.x + ox + nx * 2.4, b.y + oy + ny * 2.4); sx.stroke();
    }
  }

  canvas.addEventListener('pointerdown', e => {
    e.preventDefault(); canvas.setPointerCapture(e.pointerId);
    const p = pos(e), st = stoneAt(p);
    if (st) { drag = { type: 'stone', st, dx: p.x - st.x, dy: p.y - st.y }; stones.push(stones.splice(stones.indexOf(st), 1)[0]); return; }
    if (tool === 'stone') {
      const s = { x: p.x, y: p.y, r: 28 + Math.random() * 30, pts: blob() };
      stones.push(s); drag = { type: 'stone', st: s, dx: 0, dy: 0 }; draw(); return;
    }
    if (tool === 'smooth') { drag = { type: 'smooth' }; smoothAt(p); draw(); return; }
    drag = { type: 'rake', last: p, started: false }; dir = { x: 0, y: 0 };
  });
  canvas.addEventListener('pointermove', e => {
    if (!drag) { canvas.style.cursor = stoneAt(pos(e)) ? 'grab' : tool === 'stone' ? 'copy' : 'crosshair'; return; }
    const p = pos(e);
    if (drag.type === 'stone') { drag.st.x = p.x - drag.dx; drag.st.y = p.y - drag.dy; }
    else if (drag.type === 'smooth') smoothAt(p);
    else if (Math.hypot(p.x - drag.last.x, p.y - drag.last.y) >= 3) {
      if (!drag.started) { dir = { x: (p.x - drag.last.x), y: (p.y - drag.last.y) }; const l = Math.hypot(dir.x, dir.y); dir.x /= l; dir.y /= l; drag.started = true; }
      rakeSeg(drag.last, p); drag.last = p;
    }
    draw();
  });
  const end = () => { drag = null; };
  canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('dblclick', e => { const st = stoneAt(pos(e)); if (st) { stones.splice(stones.indexOf(st), 1); draw(); } });

  const toolBtns = {};
  function setTool(t) { tool = t; for (const k in toolBtns) toolBtns[k].classList.toggle('primary', k === t); }
  const mk = (id, label) => (toolBtns[id] = el('button', { class: 'btn', onclick: () => setTool(id) }, label));
  const range = (min, max, val, on) => el('input', { type: 'range', min, max, value: val, oninput: e => on(+e.target.value) });

  render(root,
    el('div', { class: 'row' },
      mk('rake', 'Rake'), mk('stone', 'Place stone'), mk('smooth', 'Smooth sand'),
      el('label', { class: 'inline' }, 'Tines', range(1, 9, tines, v => (tines = v))),
      el('label', { class: 'inline' }, 'Spacing', range(5, 18, spacing, v => (spacing = v))),
      el('button', { class: 'btn ghost', onclick: () => { sx.drawImage(base, 0, 0); draw(); } }, 'Smooth all'),
      el('button', { class: 'btn ghost', onclick: () => { stones.length = 0; draw(); } }, 'Clear stones'),
      el('button', { class: 'btn primary', onclick: () => canvas.toBlob(b => { download('zen-garden.png', b, 'image/png'); toast('Saved'); }) }, 'Save PNG')),
    el('div', { class: 'canvas-wrap' }, canvas),
    el('p', { class: 'small muted' }, 'Drag to rake; the grooves follow your direction. Drag stones to move them, double-click a stone to remove it.'));
  setTool('rake');
  // a first stone cluster so the garden isn't empty
  stones.push({ x: 640, y: 190, r: 52, pts: blob() }, { x: 725, y: 245, r: 30, pts: blob() }, { x: 595, y: 255, r: 24, pts: blob() });
  // initial gentle raked lines
  dir = { x: 1, y: 0 };
  for (const y of [400, 480]) rakeSeg({ x: 40, y }, { x: 860, y });
  draw();
  return () => { drag = null; };
}
