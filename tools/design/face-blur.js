// Blur regions tool: draw rectangles or ellipses over a photo to pixelate or blur them, undo, download.
import { el, render, download, dropZone, field, toast, loadImage } from '../../lib/ui.js';

export default function (root) {
  let img = null, regions = [], drag = null;
  const work = el('canvas');                    // processed image without outlines
  const canvas = el('canvas', { style: { maxWidth: '100%', cursor: 'crosshair', touchAction: 'none' } });
  const shape = el('select', { class: 'select' }, el('option', { value: 'rect' }, 'Rectangle'), el('option', { value: 'ellipse' }, 'Ellipse'));
  const effect = el('select', { class: 'select' }, el('option', { value: 'pixelate' }, 'Pixelate'), el('option', { value: 'blur' }, 'Blur'), el('option', { value: 'black' }, 'Solid block'));
  const strength = el('input', { type: 'range', min: 1, max: 100, value: 30, class: 'input' });
  const outlines = el('input', { type: 'checkbox', checked: true });
  const stage = el('div', { class: 'canvas-wrap hidden' }, canvas);
  const info = el('div', { class: 'muted small' });
  const undoBtn = el('button', { class: 'btn', onclick: () => { regions.pop(); redraw(); } }, 'Undo');
  const clearBtn = el('button', { class: 'btn ghost', onclick: () => { regions = []; redraw(); } }, 'Clear all');

  function clipPath(ctx, r) {
    ctx.beginPath();
    if (r.shape === 'ellipse') ctx.ellipse(r.x + r.w / 2, r.y + r.h / 2, r.w / 2, r.h / 2, 0, 0, Math.PI * 2);
    else ctx.rect(r.x, r.y, r.w, r.h);
  }
  function applyRegion(ctx, r) {
    const base = Math.min(work.width, work.height);
    const pad = 2;
    const sx = Math.max(0, Math.floor(r.x - pad)), sy = Math.max(0, Math.floor(r.y - pad));
    const sw = Math.min(work.width - sx, Math.ceil(r.w + 2 * pad)), sh = Math.min(work.height - sy, Math.ceil(r.h + 2 * pad));
    if (sw <= 0 || sh <= 0) return;
    const src = el('canvas'); src.width = sw; src.height = sh;
    src.getContext('2d').drawImage(work, sx, sy, sw, sh, 0, 0, sw, sh);
    ctx.save(); clipPath(ctx, r); ctx.clip();
    if (r.effect === 'black') { ctx.fillStyle = '#111'; ctx.fillRect(sx, sy, sw, sh); }
    else if (r.effect === 'pixelate') {
      const block = Math.max(2, Math.round(base * r.strength / 1500));
      const tw = Math.max(1, Math.ceil(sw / block)), th = Math.max(1, Math.ceil(sh / block));
      const tmp = el('canvas'); tmp.width = tw; tmp.height = th;
      const tc = tmp.getContext('2d'); tc.imageSmoothingEnabled = true; tc.drawImage(src, 0, 0, tw, th);
      ctx.imageSmoothingEnabled = false; ctx.drawImage(tmp, 0, 0, tw, th, sx, sy, tw * block, th * block); ctx.imageSmoothingEnabled = true;
    } else {
      const radius = Math.max(1, base * r.strength / 2500);
      if ('filter' in ctx) { ctx.filter = `blur(${radius}px)`; ctx.drawImage(src, sx, sy); ctx.filter = 'none'; }
      else { // fallback: repeated down/up scaling approximates a blur
        const f = Math.max(2, radius / 2); let cur = src;
        for (let i = 0; i < 2; i++) { const t = el('canvas'); t.width = Math.max(1, Math.round(cur.width / f)); t.height = Math.max(1, Math.round(cur.height / f)); t.getContext('2d').drawImage(cur, 0, 0, t.width, t.height); cur = t; }
        ctx.drawImage(cur, 0, 0, cur.width, cur.height, sx, sy, sw, sh);
      }
    }
    ctx.restore();
  }
  function redraw(temp) {
    if (!img) return;
    work.width = img.naturalWidth; work.height = img.naturalHeight;
    const wctx = work.getContext('2d'); wctx.drawImage(img, 0, 0);
    for (const r of regions) applyRegion(wctx, r);
    if (temp) applyRegion(wctx, temp);
    canvas.width = work.width; canvas.height = work.height;
    const ctx = canvas.getContext('2d'); ctx.drawImage(work, 0, 0);
    if (outlines.checked) {
      ctx.save(); ctx.strokeStyle = '#2f6fed'; ctx.lineWidth = Math.max(1, work.width / 500); ctx.setLineDash([ctx.lineWidth * 4, ctx.lineWidth * 3]);
      for (const r of [...regions, temp].filter(Boolean)) { clipPath(ctx, r); ctx.stroke(); }
      ctx.restore();
    }
    undoBtn.disabled = !regions.length; clearBtn.disabled = !regions.length;
    info.textContent = `${regions.length} region(s) · ${work.width}x${work.height}`;
  }
  function pt(e) { const b = canvas.getBoundingClientRect(); return { x: (e.clientX - b.left) * canvas.width / b.width, y: (e.clientY - b.top) * canvas.height / b.height }; }
  function norm(a, b) { return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y), shape: shape.value, effect: effect.value, strength: +strength.value }; }
  canvas.addEventListener('pointerdown', e => { if (!img) return; e.preventDefault(); canvas.setPointerCapture(e.pointerId); drag = { start: pt(e), cur: pt(e) }; });
  canvas.addEventListener('pointermove', e => { if (!drag) return; drag.cur = pt(e); const r = norm(drag.start, drag.cur); if (r.w > 2 && r.h > 2) redraw(r); });
  const finish = e => { if (!drag) return; const r = norm(drag.start, pt(e)); drag = null; if (r.w > 4 && r.h > 4) regions.push(r); redraw(); };
  canvas.addEventListener('pointerup', finish); canvas.addEventListener('pointercancel', () => { drag = null; redraw(); });

  const zone = dropZone('Drop a photo here or click to choose', async files => {
    try { img = await loadImage(files[0]); regions = []; stage.classList.remove('hidden'); redraw(); } catch { toast('Could not load image'); }
  }, 'image/*', false);
  strength.addEventListener('input', () => { if (regions.length) { regions[regions.length - 1].strength = +strength.value; redraw(); } });
  outlines.addEventListener('change', () => redraw());
  render(root,
    zone,
    el('div', { class: 'row' }, field('Shape', shape), field('Effect', effect), field('Strength (applies to last region)', strength), el('label', { class: 'inline' }, outlines, 'Show outlines'), undoBtn, clearBtn),
    stage, info,
    el('div', { class: 'row' },
      el('button', { class: 'btn primary', onclick: () => img ? work.toBlob(b => b && download('blurred.png', b, 'image/png'), 'image/png') : toast('Load an image first') }, 'Download PNG'),
      el('button', { class: 'btn', onclick: () => img && work.toBlob(b => b && download('blurred.jpg', b, 'image/jpeg'), 'image/jpeg', 0.92) }, 'Download JPEG')),
    el('p', { class: 'muted small' }, 'Drag on the photo to draw a region. Regions are applied in order; Undo removes the most recent one. Downloads never include the dashed outlines.'));
  redraw();
}
