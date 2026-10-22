import { el, render, store, uid, download, toast } from '../../lib/ui.js';
import { N, input, sel, cssVar, COLORS } from './_h.js';

const PRESETS = [
  ['Double bed', 140, 200], ['Single bed', 90, 200], ['King bed', 180, 200], ['Sofa (3-seat)', 200, 90], ['Armchair', 80, 85], ['Dining table', 160, 90],
  ['Coffee table', 100, 50], ['Desk', 140, 70], ['Office chair', 55, 55], ['Wardrobe', 100, 60], ['Chest of drawers', 90, 45], ['Bookshelf', 80, 30],
  ['TV unit', 150, 40], ['Rug', 200, 140], ['Dining chair', 45, 45], ['Nightstand', 45, 40], ['Door swing', 90, 90], ['Plant', 40, 40],
];
const PAD = 34;

export default function (root) {
  const s = store('room-layout');
  const D = Object.assign({ room: { w: 450, h: 350 }, items: [], grid: 10, snap: true, sel: null }, s.get('d', {}));
  let saved = s.get('saved', []);
  const save = () => s.set('d', D);

  const canvas = el('canvas', { tabindex: '0', style: { touchAction: 'none', maxWidth: '100%', cursor: 'grab', outline: 'none' } });
  const g = canvas.getContext('2d');
  const panel = el('div'), savedBox = el('div');
  let scale = 1;

  const getSel = () => D.items.find(i => i.id === D.sel);
  const half = it => {
    const r = it.rot * Math.PI / 180, c = Math.abs(Math.cos(r)), sn = Math.abs(Math.sin(r));
    return [(it.w * c + it.h * sn) / 2, (it.w * sn + it.h * c) / 2];
  };

  function layoutCanvas() {
    const maxW = 900;
    scale = (maxW - PAD * 2) / D.room.w;
    const maxH = 640;
    if (D.room.h * scale + PAD * 2 > maxH) scale = (maxH - PAD * 2) / D.room.h;
    canvas.width = Math.round(D.room.w * scale + PAD * 2);
    canvas.height = Math.round(D.room.h * scale + PAD * 2);
  }

  function draw(forExport = false) {
    const text = cssVar(canvas, '--text', '#222'), muted = cssVar(canvas, '--muted', '#777'), line = cssVar(canvas, '--line', '#ddd');
    const bgc = cssVar(canvas, '--bg', '#f6f7f9'), panelc = cssVar(canvas, '--panel', '#fff'), accent = cssVar(canvas, '--accent', '#2f6fed');
    g.fillStyle = panelc; g.fillRect(0, 0, canvas.width, canvas.height);
    const rw = D.room.w * scale, rh = D.room.h * scale;
    g.fillStyle = bgc; g.fillRect(PAD, PAD, rw, rh);
    const gs = D.grid * scale;
    if (gs >= 6) {
      g.strokeStyle = line; g.lineWidth = 1; g.beginPath();
      for (let x = D.grid; x < D.room.w; x += D.grid) { g.moveTo(PAD + x * scale, PAD); g.lineTo(PAD + x * scale, PAD + rh); }
      for (let y = D.grid; y < D.room.h; y += D.grid) { g.moveTo(PAD, PAD + y * scale); g.lineTo(PAD + rw, PAD + y * scale); }
      g.stroke();
    }
    g.strokeStyle = text; g.lineWidth = 3; g.strokeRect(PAD, PAD, rw, rh);
    g.fillStyle = muted; g.font = '14px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(D.room.w + ' cm', PAD + rw / 2, PAD / 2);
    g.save(); g.translate(PAD / 2, PAD + rh / 2); g.rotate(-Math.PI / 2); g.fillText(D.room.h + ' cm', 0, 0); g.restore();
    for (const it of D.items) {
      g.save();
      g.translate(PAD + it.x * scale, PAD + it.y * scale);
      g.rotate(it.rot * Math.PI / 180);
      const w = it.w * scale, h = it.h * scale;
      g.fillStyle = it.color + 'cc'; g.strokeStyle = it.color; g.lineWidth = 2;
      g.fillRect(-w / 2, -h / 2, w, h); g.strokeRect(-w / 2, -h / 2, w, h);
      if (!forExport && it.id === D.sel) { g.strokeStyle = accent; g.lineWidth = 3; g.setLineDash([6, 4]); g.strokeRect(-w / 2 - 3, -h / 2 - 3, w + 6, h + 6); g.setLineDash([]); }
      // front marker
      g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(-w / 2, h / 2 - Math.min(5, h / 4), w, Math.min(5, h / 4));
      g.restore();
      // label upright
      g.fillStyle = text; g.font = '13px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      const [hw] = half(it);
      let label = it.name;
      if (g.measureText(label).width > hw * 2 * scale - 4) label = label.slice(0, Math.max(2, Math.floor(hw * 2 * scale / 7))) + '..';
      g.fillText(label, PAD + it.x * scale, PAD + it.y * scale);
    }
  }

  function clamp(it) {
    const [hw, hh] = half(it);
    it.x = hw * 2 > D.room.w ? D.room.w / 2 : Math.min(D.room.w - hw, Math.max(hw, it.x));
    it.y = hh * 2 > D.room.h ? D.room.h / 2 : Math.min(D.room.h - hh, Math.max(hh, it.y));
  }
  function snap(it) {
    if (!D.snap) return;
    const gsz = D.grid, [hw, hh] = half(it);
    const near = (center, h) => {
      const a = Math.round((center - h) / gsz) * gsz + h, b = Math.round((center + h) / gsz) * gsz - h;
      return Math.abs(a - center) <= Math.abs(b - center) ? a : b;
    };
    it.x = near(it.x, hw); it.y = near(it.y, hh);
  }

  function hit(px, py) {
    for (let i = D.items.length - 1; i >= 0; i--) {
      const it = D.items[i], r = -it.rot * Math.PI / 180;
      const dx = px - it.x, dy = py - it.y;
      const lx = dx * Math.cos(r) - dy * Math.sin(r), ly = dx * Math.sin(r) + dy * Math.cos(r);
      if (Math.abs(lx) <= it.w / 2 && Math.abs(ly) <= it.h / 2) return it;
    }
    return null;
  }
  const toCm = e => {
    const r = canvas.getBoundingClientRect(), k = canvas.width / r.width;
    return [((e.clientX - r.left) * k - PAD) / scale, ((e.clientY - r.top) * k - PAD) / scale];
  };

  let drag = null;
  canvas.addEventListener('pointerdown', e => {
    canvas.focus({ preventScroll: true });
    const [px, py] = toCm(e), it = hit(px, py);
    D.sel = it ? it.id : null;
    if (it) {
      D.items = D.items.filter(x => x !== it).concat(it); // bring to front
      drag = { it, dx: it.x - px, dy: it.y - py };
      canvas.setPointerCapture(e.pointerId); canvas.style.cursor = 'grabbing';
    }
    draw(); drawPanel();
  });
  canvas.addEventListener('pointermove', e => {
    if (!drag) { const [px, py] = toCm(e); canvas.style.cursor = hit(px, py) ? 'grab' : 'default'; return; }
    const [px, py] = toCm(e);
    drag.it.x = px + drag.dx; drag.it.y = py + drag.dy;
    snap(drag.it); clamp(drag.it); draw();
  });
  const endDrag = () => { if (drag) { drag = null; canvas.style.cursor = 'grab'; save(); drawPanel(); } };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('keydown', e => {
    const it = getSel();
    if (!it) return;
    const st = D.snap ? D.grid : 1;
    if (e.key === 'ArrowLeft') it.x -= st; else if (e.key === 'ArrowRight') it.x += st;
    else if (e.key === 'ArrowUp') it.y -= st; else if (e.key === 'ArrowDown') it.y += st;
    else if (e.key.toLowerCase() === 'r') it.rot = (it.rot + 90) % 360;
    else if (e.key === 'Delete' || e.key === 'Backspace') { D.items = D.items.filter(x => x !== it); D.sel = null; }
    else return;
    e.preventDefault(); if (D.sel) clamp(it); save(); draw(); drawPanel();
  });

  function addItem(name, w, h) {
    const it = { id: uid(), name, w, h, x: D.room.w / 2, y: D.room.h / 2, rot: 0, color: COLORS[D.items.length % COLORS.length] };
    snap(it); clamp(it);
    D.items.push(it); D.sel = it.id; save(); draw(); drawPanel();
  }

  const presetSel = sel(PRESETS.map((p, i) => [String(i), `${p[0]} (${p[1]} x ${p[2]})`]), '0');
  const cName = input({ placeholder: 'Custom name', style: { width: '130px' } });
  const cW = input({ type: 'number', min: '5', placeholder: 'W cm', style: { width: '80px' } });
  const cH = input({ type: 'number', min: '5', placeholder: 'D cm', style: { width: '80px' } });
  const rW = input({ type: 'number', min: '100', max: '3000', value: D.room.w, style: { width: '90px' }, onchange: () => resizeRoom() });
  const rH = input({ type: 'number', min: '100', max: '3000', value: D.room.h, style: { width: '90px' }, onchange: () => resizeRoom() });
  function resizeRoom() {
    D.room.w = Math.min(3000, Math.max(100, N(rW.value) || D.room.w)); D.room.h = Math.min(3000, Math.max(100, N(rH.value) || D.room.h));
    rW.value = D.room.w; rH.value = D.room.h;
    D.items.forEach(clamp); layoutCanvas(); save(); draw();
  }
  const gridSel = sel([['5', '5 cm'], ['10', '10 cm'], ['20', '20 cm'], ['50', '50 cm']], String(D.grid), { onchange: () => { D.grid = +gridSel.value; save(); draw(); } });
  const snapChk = el('input', { type: 'checkbox', checked: D.snap, onchange: () => { D.snap = snapChk.checked; save(); } });

  function drawPanel() {
    const it = getSel();
    if (!it) { render(panel, el('div', { class: 'muted small' }, 'Click a piece to select it. Drag to move. Arrow keys nudge, R rotates 90 degrees, Delete removes.')); return; }
    const upd = fn => () => { fn(); clamp(it); save(); draw(); };
    render(panel, el('div', { class: 'row' },
      input({ value: it.name, style: { width: '140px' }, onchange: e => { it.name = e.target.value || it.name; save(); draw(); } }),
      el('label', { class: 'inline' }, 'W', input({ type: 'number', min: '5', value: it.w, style: { width: '75px' }, onchange: e => upd(() => { it.w = Math.max(5, N(e.target.value)); })() })),
      el('label', { class: 'inline' }, 'D', input({ type: 'number', min: '5', value: it.h, style: { width: '75px' }, onchange: e => upd(() => { it.h = Math.max(5, N(e.target.value)); })() })),
      el('label', { class: 'inline' }, 'Angle', input({ type: 'number', step: '15', value: Math.round(it.rot), style: { width: '75px' }, onchange: e => upd(() => { it.rot = ((N(e.target.value) % 360) + 360) % 360; })() })),
      el('button', { class: 'btn small', onclick: upd(() => { it.rot = (it.rot + 90) % 360; drawPanelSoon(); }) }, 'Rotate 90'),
      el('button', { class: 'btn small', onclick: () => { addItem(it.name, it.w, it.h); const c = getSel(); c.x = it.x + 20; c.y = it.y + 20; c.rot = it.rot; clamp(c); draw(); } }, 'Duplicate'),
      el('button', { class: 'btn small danger', onclick: () => { D.items = D.items.filter(x => x !== it); D.sel = null; save(); draw(); drawPanel(); } }, 'Delete')));
  }
  const drawPanelSoon = () => queueMicrotask(drawPanel);

  function drawSaved() {
    const nameIn = input({ placeholder: 'Layout name', style: { width: '160px' } });
    const doSave = () => {
      const name = nameIn.value.trim();
      if (!name) { toast('Enter a layout name'); return; }
      const rec = { name, room: { ...D.room }, items: JSON.parse(JSON.stringify(D.items)) };
      const i = saved.findIndex(x => x.name === name);
      if (i >= 0) saved[i] = rec; else saved.push(rec);
      s.set('saved', saved); toast('Saved'); drawSaved();
    };
    nameIn.addEventListener('keydown', e => e.key === 'Enter' && doSave());
    render(savedBox,
      el('div', { class: 'row' }, nameIn, el('button', { class: 'btn', onclick: doSave }, 'Save layout'),
        el('button', { class: 'btn', onclick: exportPng }, 'Export PNG'),
        el('button', { class: 'btn ghost', onclick: () => { D.items = []; D.sel = null; save(); draw(); drawPanel(); } }, 'Clear room')),
      saved.length ? el('ul', { class: 'list' }, saved.map(l => el('li', {}, el('span', { class: 'grow' }, `${l.name} `, el('span', { class: 'muted small' }, `${l.room.w} x ${l.room.h} cm, ${l.items.length} items`)),
        el('button', { class: 'btn small', onclick: () => { D.room = { ...l.room }; D.items = JSON.parse(JSON.stringify(l.items)); D.sel = null; rW.value = D.room.w; rH.value = D.room.h; layoutCanvas(); save(); draw(); drawPanel(); } }, 'Load'),
        el('button', { class: 'btn small ghost', onclick: () => { saved = saved.filter(x => x !== l); s.set('saved', saved); drawSaved(); } }, 'x')))) : el('div', { class: 'muted small' }, 'No saved layouts yet.'));
  }
  function exportPng() {
    draw(true);
    canvas.toBlob(b => { if (b) download('room-layout.png', b, 'image/png'); draw(); }, 'image/png');
  }

  render(root,
    el('div', { class: 'row' }, el('label', { class: 'inline' }, 'Room width (cm)', rW), el('label', { class: 'inline' }, 'depth (cm)', rH),
      el('label', { class: 'inline' }, 'Grid', gridSel), el('label', { class: 'inline' }, snapChk, 'Snap to grid')),
    el('div', { class: 'row' }, presetSel, el('button', { class: 'btn', onclick: () => { const p = PRESETS[+presetSel.value]; addItem(p[0], p[1], p[2]); } }, 'Add'),
      cName, cW, cH, el('button', { class: 'btn', onclick: () => { if (N(cW.value) >= 5 && N(cH.value) >= 5) { addItem(cName.value.trim() || 'Item', N(cW.value), N(cH.value)); cName.value = cW.value = cH.value = ''; } else toast('Enter width and depth in cm'); } }, 'Add custom')),
    panel,
    el('div', { class: 'canvas-wrap' }, canvas),
    savedBox);
  layoutCanvas(); draw(); drawPanel(); drawSaved();
  requestAnimationFrame(() => draw());
}
