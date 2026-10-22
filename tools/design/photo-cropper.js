// Photo cropper: drag a crop rectangle, presets, PNG/JPEG export.
import { el, render, download, dropZone, field, toast, loadImage } from '../../lib/ui.js';

const PRESETS = [
  { id: 'free', label: 'Free', ratio: 0 },
  { id: 'ig', label: 'Instagram square 1:1', ratio: 1 },
  { id: 'story', label: 'Story 9:16', ratio: 9 / 16 },
  { id: 'tw', label: 'Twitter 16:9', ratio: 16 / 9 },
  { id: 'yt', label: 'YouTube thumb 16:9 (1280x720)', ratio: 16 / 9, out: [1280, 720] },
  { id: 'circle', label: 'Profile circle', ratio: 1, circle: true },
];

export default function (root) {
  let img = null, crop = null, preset = PRESETS[0];
  let drag = null; // {mode:'new'|'move'|'resize', corner, start, orig}
  const canvas = el('canvas', { style: { cursor: 'crosshair', touchAction: 'none', maxWidth: '100%' } });
  const ctx = canvas.getContext('2d');
  const info = el('div', { class: 'muted small' }, 'Drop an image to start.');
  const sel = el('select', { class: 'select', onchange: () => { preset = PRESETS.find(p => p.id === sel.value); applyPreset(); } }, PRESETS.map(p => el('option', { value: p.id }, p.label)));
  const fmt = el('select', { class: 'select' }, el('option', { value: 'image/png' }, 'PNG'), el('option', { value: 'image/jpeg' }, 'JPEG'), el('option', { value: 'image/webp' }, 'WebP'));
  const quality = el('input', { type: 'range', min: 10, max: 100, value: 92, class: 'input' });
  const qLabel = el('span', { class: 'small mono' }, '92');
  quality.addEventListener('input', () => (qLabel.textContent = quality.value));
  const nums = ['x', 'y', 'w', 'h'].map(k => el('input', { type: 'number', class: 'input', style: { width: '80px' }, min: 0, oninput: () => fromInputs() }));
  const stage = el('div', { class: 'canvas-wrap hidden' }, canvas);
  const zone = dropZone('Drop an image here or click to choose', async files => {
    try { img = await loadImage(files[0]); } catch { toast('Could not load image'); return; }
    fit(); applyPreset(); stage.classList.remove('hidden');
  }, 'image/*', false);

  let scale = 1;
  function fit() {
    const maxW = Math.min(800, root.clientWidth - 60 || 800);
    scale = Math.min(1, maxW / img.naturalWidth, 600 / img.naturalHeight);
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
  }
  function applyPreset() {
    if (!img) return;
    const W = img.naturalWidth, H = img.naturalHeight;
    if (preset.ratio) {
      let w = W, h = w / preset.ratio;
      if (h > H) { h = H; w = h * preset.ratio; }
      w = Math.round(w * 0.9); h = Math.round(h * 0.9);
      crop = { x: Math.round((W - w) / 2), y: Math.round((H - h) / 2), w, h };
    } else crop = { x: Math.round(W * 0.1), y: Math.round(H * 0.1), w: Math.round(W * 0.8), h: Math.round(H * 0.8) };
    draw();
  }
  function clamp() {
    const W = img.naturalWidth, H = img.naturalHeight;
    crop.w = Math.max(8, Math.min(crop.w, W)); crop.h = Math.max(8, Math.min(crop.h, H));
    if (preset.ratio) { if (crop.w / crop.h > preset.ratio) crop.w = crop.h * preset.ratio; else crop.h = crop.w / preset.ratio; }
    crop.x = Math.max(0, Math.min(crop.x, W - crop.w)); crop.y = Math.max(0, Math.min(crop.y, H - crop.h));
  }
  function draw() {
    if (!img) return;
    clamp();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const c = { x: crop.x * scale, y: crop.y * scale, w: crop.w * scale, h: crop.h * scale };
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.5)';
    ctx.beginPath(); ctx.rect(0, 0, canvas.width, canvas.height);
    if (preset.circle) ctx.ellipse(c.x + c.w / 2, c.y + c.h / 2, c.w / 2, c.h / 2, 0, 0, Math.PI * 2, true);
    else ctx.rect(c.x + c.w, c.y, -c.w, c.h);
    ctx.fill('evenodd'); ctx.restore();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.setLineDash([6, 4]); ctx.strokeRect(c.x + .5, c.y + .5, c.w, c.h); ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(255,255,255,.4)';
    for (let i = 1; i < 3; i++) { ctx.beginPath(); ctx.moveTo(c.x + c.w * i / 3, c.y); ctx.lineTo(c.x + c.w * i / 3, c.y + c.h); ctx.moveTo(c.x, c.y + c.h * i / 3); ctx.lineTo(c.x + c.w, c.y + c.h * i / 3); ctx.stroke(); }
    ctx.fillStyle = '#fff';
    for (const [hx, hy] of corners(c)) ctx.fillRect(hx - 5, hy - 5, 10, 10);
    nums[0].value = Math.round(crop.x); nums[1].value = Math.round(crop.y); nums[2].value = Math.round(crop.w); nums[3].value = Math.round(crop.h);
    info.textContent = `Image ${img.naturalWidth}x${img.naturalHeight} · crop ${Math.round(crop.w)}x${Math.round(crop.h)}` + (preset.out ? ` · exported at ${preset.out[0]}x${preset.out[1]}` : '');
  }
  const corners = c => [[c.x, c.y, 'nw'], [c.x + c.w, c.y, 'ne'], [c.x, c.y + c.h, 'sw'], [c.x + c.w, c.y + c.h, 'se']];
  function fromInputs() {
    if (!img) return;
    crop = { x: +nums[0].value || 0, y: +nums[1].value || 0, w: +nums[2].value || 8, h: +nums[3].value || 8 };
    draw();
  }
  function pos(e) { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) * canvas.width / r.width / scale, y: (e.clientY - r.top) * canvas.height / r.height / scale }; }
  canvas.addEventListener('pointerdown', e => {
    if (!img) return; e.preventDefault(); canvas.setPointerCapture(e.pointerId);
    const p = pos(e); const c = { x: crop.x * scale, y: crop.y * scale, w: crop.w * scale, h: crop.h * scale };
    const hit = corners(c).find(([hx, hy]) => Math.abs(hx - p.x * scale) < 10 && Math.abs(hy - p.y * scale) < 10);
    if (hit) drag = { mode: 'resize', corner: hit[2], start: p, orig: { ...crop } };
    else if (p.x >= crop.x && p.x <= crop.x + crop.w && p.y >= crop.y && p.y <= crop.y + crop.h) drag = { mode: 'move', start: p, orig: { ...crop } };
    else drag = { mode: 'new', start: p, orig: { ...crop } };
  });
  canvas.addEventListener('pointermove', e => {
    if (!drag || !img) return;
    const p = pos(e), dx = p.x - drag.start.x, dy = p.y - drag.start.y, o = drag.orig;
    if (drag.mode === 'move') { crop.x = o.x + dx; crop.y = o.y + dy; }
    else if (drag.mode === 'new') {
      let w = Math.abs(dx), h = Math.abs(dy);
      if (preset.ratio) { if (w / Math.max(h, 1) > preset.ratio) h = w / preset.ratio; else w = h * preset.ratio; }
      crop = { x: dx < 0 ? drag.start.x - w : drag.start.x, y: dy < 0 ? drag.start.y - h : drag.start.y, w: Math.max(8, w), h: Math.max(8, h) };
    } else {
      const c = drag.corner; let x = o.x, y = o.y, w = o.w, h = o.h;
      if (c.includes('e')) w = o.w + dx; else { x = o.x + dx; w = o.w - dx; }
      if (c.includes('s')) h = o.h + dy; else { y = o.y + dy; h = o.h - dy; }
      if (w < 8) w = 8; if (h < 8) h = 8;
      if (preset.ratio) { if (w / h > preset.ratio) w = h * preset.ratio; else h = w / preset.ratio; if (!c.includes('e')) x = o.x + o.w - w; if (!c.includes('s')) y = o.y + o.h - h; }
      crop = { x, y, w, h };
    }
    draw();
  });
  const end = () => { drag = null; };
  canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);

  function exportCrop() {
    if (!img) { toast('Load an image first'); return; }
    const out = el('canvas');
    const ow = preset.out ? preset.out[0] : Math.round(crop.w), oh = preset.out ? preset.out[1] : Math.round(crop.h);
    out.width = ow; out.height = oh;
    const octx = out.getContext('2d');
    const type = fmt.value;
    if (type === 'image/jpeg') { octx.fillStyle = '#fff'; octx.fillRect(0, 0, ow, oh); }
    if (preset.circle) { octx.beginPath(); octx.ellipse(ow / 2, oh / 2, ow / 2, oh / 2, 0, 0, Math.PI * 2); octx.clip(); }
    octx.drawImage(img, crop.x, crop.y, crop.w, crop.h, 0, 0, ow, oh);
    const ext = type === 'image/png' ? 'png' : type === 'image/jpeg' ? 'jpg' : 'webp';
    out.toBlob(b => b ? download(`crop-${ow}x${oh}.${ext}`, b, type) : toast('Export failed'), type, quality.value / 100);
  }

  render(root,
    zone,
    el('div', { class: 'row' }, field('Preset', sel), field('X', nums[0]), field('Y', nums[1]), field('Width', nums[2]), field('Height', nums[3]),
      el('button', { class: 'btn small', onclick: applyPreset }, 'Reset box')),
    stage, info,
    el('div', { class: 'row' }, field('Format', fmt), field('Quality (JPEG/WebP)', el('div', { class: 'row', style: { margin: 0 } }, quality, qLabel)),
      el('button', { class: 'btn primary', onclick: exportCrop }, 'Download crop')),
    el('p', { class: 'muted small' }, 'Drag inside the box to move it, drag a corner to resize, or drag on empty space to draw a new box.'));
}
