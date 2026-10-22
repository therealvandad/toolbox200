// Before-and-after slider: two images, draggable divider, labels, downloadable split or side-by-side composites.
import { el, render, download, dropZone, field, toast, loadImage } from '../../lib/ui.js';

export default function (root) {
  let a = null, b = null, split = 0.5, dragging = false;
  const canvas = el('canvas', { style: { maxWidth: '100%', cursor: 'ew-resize', touchAction: 'none' } });
  const stage = el('div', { class: 'canvas-wrap hidden' }, canvas);
  const labelA = el('input', { class: 'input', value: 'Before', style: { width: '120px' } });
  const labelB = el('input', { class: 'input', value: 'After', style: { width: '120px' } });
  const slider = el('input', { type: 'range', min: 0, max: 100, value: 50, class: 'input', style: { width: '200px' } });
  const orient = el('select', { class: 'select' }, el('option', { value: 'v' }, 'Vertical divider'), el('option', { value: 'h' }, 'Horizontal divider'));
  const showLabels = el('input', { type: 'checkbox', checked: true });
  const nameA = el('span', { class: 'muted small' }), nameB = el('span', { class: 'muted small' });

  function cover(ctx, im, x, y, w, h) {
    const s = Math.max(w / im.naturalWidth, h / im.naturalHeight);
    const sw = w / s, sh = h / s;
    ctx.drawImage(im, (im.naturalWidth - sw) / 2, (im.naturalHeight - sh) / 2, sw, sh, x, y, w, h);
  }
  function label(ctx, text, x, y, align, W) {
    if (!showLabels.checked || !text) return;
    const fs = Math.max(14, Math.round(W / 40));
    ctx.font = `600 ${fs}px system-ui, sans-serif`;
    const tw = ctx.measureText(text).width, padX = fs * .7, h = fs * 1.7;
    const bx = align === 'right' ? x - tw - padX * 2 : x;
    ctx.fillStyle = 'rgba(0,0,0,.55)';
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(bx, y, tw + padX * 2, h, h / 2) : ctx.rect(bx, y, tw + padX * 2, h); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.fillText(text, bx + padX, y + h / 2);
  }
  function size() { const W = Math.min(a.naturalWidth, 2000); return [W, Math.round(W * a.naturalHeight / a.naturalWidth)]; }
  function drawSplit(ctx, W, H, withHandle) {
    cover(ctx, b, 0, 0, W, H);
    ctx.save(); ctx.beginPath();
    if (orient.value === 'v') ctx.rect(0, 0, W * split, H); else ctx.rect(0, 0, W, H * split);
    ctx.clip(); cover(ctx, a, 0, 0, W, H); ctx.restore();
    const lw = Math.max(2, W / 300);
    ctx.fillStyle = '#fff'; ctx.shadowColor = 'rgba(0,0,0,.4)'; ctx.shadowBlur = lw * 2;
    if (orient.value === 'v') ctx.fillRect(W * split - lw / 2, 0, lw, H); else ctx.fillRect(0, H * split - lw / 2, W, lw);
    if (withHandle) {
      const r = Math.max(12, W / 40), cx = orient.value === 'v' ? W * split : W / 2, cy = orient.value === 'v' ? H / 2 : H * split;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0; ctx.strokeStyle = '#333'; ctx.lineWidth = Math.max(1.5, r / 8);
      ctx.beginPath();
      if (orient.value === 'v') { ctx.moveTo(cx - r * .45, cy); ctx.lineTo(cx - r * .15, cy - r * .3); ctx.moveTo(cx - r * .45, cy); ctx.lineTo(cx - r * .15, cy + r * .3); ctx.moveTo(cx + r * .45, cy); ctx.lineTo(cx + r * .15, cy - r * .3); ctx.moveTo(cx + r * .45, cy); ctx.lineTo(cx + r * .15, cy + r * .3); }
      else { ctx.moveTo(cx, cy - r * .45); ctx.lineTo(cx - r * .3, cy - r * .15); ctx.moveTo(cx, cy - r * .45); ctx.lineTo(cx + r * .3, cy - r * .15); ctx.moveTo(cx, cy + r * .45); ctx.lineTo(cx - r * .3, cy + r * .15); ctx.moveTo(cx, cy + r * .45); ctx.lineTo(cx + r * .3, cy + r * .15); }
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
    const m = Math.round(W / 50);
    if (orient.value === 'v') { label(ctx, labelA.value, m, m, 'left', W); label(ctx, labelB.value, W - m, m, 'right', W); }
    else { label(ctx, labelA.value, m, m, 'left', W); label(ctx, labelB.value, m, H - m - Math.max(14, Math.round(W / 40)) * 1.7, 'left', W); }
  }
  function draw() {
    if (!a || !b) { stage.classList.add('hidden'); return; }
    const [W, H] = size(); canvas.width = W; canvas.height = H;
    drawSplit(canvas.getContext('2d'), W, H, true);
    stage.classList.remove('hidden');
  }
  function fromPointer(e) {
    const r = canvas.getBoundingClientRect();
    split = orient.value === 'v' ? (e.clientX - r.left) / r.width : (e.clientY - r.top) / r.height;
    split = Math.min(1, Math.max(0, split)); slider.value = Math.round(split * 100); draw();
  }
  canvas.addEventListener('pointerdown', e => { if (!a || !b) return; dragging = true; canvas.setPointerCapture(e.pointerId); fromPointer(e); });
  canvas.addEventListener('pointermove', e => dragging && fromPointer(e));
  const stop = () => { dragging = false; };
  canvas.addEventListener('pointerup', stop); canvas.addEventListener('pointercancel', stop);
  slider.addEventListener('input', () => { split = slider.value / 100; draw(); });
  for (const c of [labelA, labelB]) c.addEventListener('input', draw);
  orient.addEventListener('change', draw); showLabels.addEventListener('change', draw);

  function exportSplit() {
    if (!a || !b) { toast('Load both images first'); return; }
    const [W, H] = size(); const c = el('canvas'); c.width = W; c.height = H;
    drawSplit(c.getContext('2d'), W, H, false);
    c.toBlob(bl => bl && download('before-after-split.png', bl, 'image/png'), 'image/png');
  }
  function exportSide() {
    if (!a || !b) { toast('Load both images first'); return; }
    const [W, H] = size(); const gap = Math.round(W / 60);
    const vert = orient.value === 'h';
    const c = el('canvas'); c.width = vert ? W : W * 2 + gap; c.height = vert ? H * 2 + gap : H;
    const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    cover(ctx, a, 0, 0, W, H); cover(ctx, b, vert ? 0 : W + gap, vert ? H + gap : 0, W, H);
    const m = Math.round(W / 50);
    label(ctx, labelA.value, m, m, 'left', W); label(ctx, labelB.value, (vert ? 0 : W + gap) + m, (vert ? H + gap : 0) + m, 'left', W);
    c.toBlob(bl => bl && download('before-after-side-by-side.png', bl, 'image/png'), 'image/png');
  }
  const zoneA = dropZone('Drop the BEFORE image', async f => { try { a = await loadImage(f[0]); nameA.textContent = f[0].name; draw(); } catch { toast('Could not load image'); } }, 'image/*', false);
  const zoneB = dropZone('Drop the AFTER image', async f => { try { b = await loadImage(f[0]); nameB.textContent = f[0].name; draw(); } catch { toast('Could not load image'); } }, 'image/*', false);
  render(root,
    el('div', { class: 'grid2' }, el('div', {}, zoneA, nameA), el('div', {}, zoneB, nameB)),
    el('div', { class: 'row' }, field('Left/top label', labelA), field('Right/bottom label', labelB), field('Divider', orient), field('Position', slider), el('label', { class: 'inline' }, showLabels, 'Show labels')),
    stage,
    el('div', { class: 'row' },
      el('button', { class: 'btn primary', onclick: exportSplit }, 'Download split view'),
      el('button', { class: 'btn', onclick: exportSide }, 'Download side by side')),
    el('p', { class: 'muted small' }, 'Drag on the image to move the divider. The after image is cropped to match the before image. Output is capped at 2000px wide.'));
}
