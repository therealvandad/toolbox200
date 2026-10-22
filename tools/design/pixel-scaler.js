// Pixel art scaler: nearest-neighbour upscale with optional grid.
import { el, render, download, dropZone, field, toast, loadImage } from '../../lib/ui.js';

export default function (root) {
  let img = null;
  const canvas = el('canvas', { style: { imageRendering: 'pixelated', maxWidth: '100%' } });
  const factor = el('select', { class: 'select' }, [2, 3, 4, 5, 6, 8, 10, 12, 16].map(n => el('option', { value: n, selected: n === 4 }, n + 'x')));
  const grid = el('input', { type: 'checkbox' });
  const gridColor = el('input', { type: 'color', value: '#000000' });
  const gridAlpha = el('input', { type: 'range', min: 5, max: 100, value: 30, class: 'input' });
  const stage = el('div', { class: 'canvas-wrap hidden', style: { overflow: 'auto' } }, canvas);
  const info = el('div', { class: 'muted small' });

  function draw() {
    if (!img) return;
    const f = +factor.value, w = img.naturalWidth, h = img.naturalHeight;
    if (w * f > 8192 || h * f > 8192) { toast('Result would exceed 8192px; pick a smaller factor'); return; }
    canvas.width = w * f; canvas.height = h * f;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    if (grid.checked && f >= 2) {
      ctx.save(); ctx.globalAlpha = gridAlpha.value / 100; ctx.strokeStyle = gridColor.value; ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x <= w; x++) { ctx.moveTo(x * f + .5, 0); ctx.lineTo(x * f + .5, canvas.height); }
      for (let y = 0; y <= h; y++) { ctx.moveTo(0, y * f + .5); ctx.lineTo(canvas.width, y * f + .5); }
      ctx.stroke(); ctx.restore();
    }
    stage.classList.remove('hidden');
    info.textContent = `${w}x${h} → ${canvas.width}x${canvas.height}`;
  }
  const zone = dropZone('Drop a pixel-art image here or click to choose', async files => {
    try { img = await loadImage(files[0]); draw(); } catch { toast('Could not load image'); }
  }, 'image/*', false);
  factor.addEventListener('change', draw); grid.addEventListener('change', draw); gridColor.addEventListener('input', draw); gridAlpha.addEventListener('input', draw);
  render(root,
    zone,
    el('div', { class: 'row' }, field('Scale', factor), el('label', { class: 'inline' }, grid, 'Grid overlay'), field('Grid colour', gridColor), field('Grid opacity', gridAlpha)),
    stage, info,
    el('div', { class: 'row' }, el('button', { class: 'btn primary', onclick: () => img && canvas.toBlob(b => b && download(`pixel-${factor.value}x.png`, b, 'image/png'), 'image/png') }, 'Download PNG')));
}
