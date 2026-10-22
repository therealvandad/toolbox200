// Dithering: Floyd-Steinberg, ordered Bayer 4x4, threshold; retro palettes.
import { el, render, download, dropZone, field, toast, loadImage } from '../../lib/ui.js';

const PALETTES = {
  '1-bit': [[0, 0, 0], [255, 255, 255]],
  '4 grays': [[0, 0, 0], [85, 85, 85], [170, 170, 170], [255, 255, 255]],
  'Game Boy green': [[15, 56, 15], [48, 98, 48], [139, 172, 15], [155, 188, 15]],
  'CGA': [[0, 0, 0], [85, 255, 255], [255, 85, 255], [255, 255, 255]],
  'CGA warm': [[0, 0, 0], [85, 255, 85], [255, 85, 85], [255, 255, 85]],
  '8 colours': [[0, 0, 0], [255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 255, 0], [0, 255, 255], [255, 0, 255], [255, 255, 255]],
};
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];

export default function (root) {
  let img = null;
  const canvas = el('canvas', { style: { imageRendering: 'pixelated', maxWidth: '100%' } });
  const algo = el('select', { class: 'select' }, el('option', { value: 'fs' }, 'Floyd-Steinberg'), el('option', { value: 'bayer' }, 'Ordered Bayer 4x4'), el('option', { value: 'threshold' }, 'Threshold'));
  const pal = el('select', { class: 'select' }, Object.keys(PALETTES).map(k => el('option', { value: k }, k)));
  const scale = el('select', { class: 'select' }, [1, 2, 3, 4, 6, 8].map(n => el('option', { value: n }, n + 'x pixels')));
  const thr = el('input', { type: 'range', min: 0, max: 100, value: 50, class: 'input' });
  const stage = el('div', { class: 'canvas-wrap hidden' }, canvas);
  const info = el('div', { class: 'muted small' });

  function nearest(r, g, b, p) {
    let best = p[0], bd = Infinity;
    for (const c of p) { const d = (r - c[0]) ** 2 + (g - c[1]) ** 2 + (b - c[2]) ** 2; if (d < bd) { bd = d; best = c; } }
    return best;
  }
  function process() {
    if (!img) return;
    const s = +scale.value;
    const w = Math.max(1, Math.floor(img.naturalWidth / s)), h = Math.max(1, Math.floor(img.naturalHeight / s));
    const small = el('canvas'); small.width = w; small.height = h;
    const sc = small.getContext('2d'); sc.drawImage(img, 0, 0, w, h);
    const id = sc.getImageData(0, 0, w, h), d = id.data;
    const p = PALETTES[pal.value];
    const mode = algo.value, t = thr.value / 100;
    const f = new Float32Array(w * h * 3);
    for (let i = 0, j = 0; i < d.length; i += 4, j += 3) { f[j] = d[i]; f[j + 1] = d[i + 1]; f[j + 2] = d[i + 2]; }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const j = (y * w + x) * 3;
      let r = f[j], g = f[j + 1], b = f[j + 2];
      if (mode === 'bayer') { const o = (BAYER[y % 4][x % 4] / 16 - 0.5) * (255 / Math.max(1, p.length - 1)); r += o; g += o; b += o; }
      if (mode === 'threshold') { const o = (0.5 - t) * 255; r += o; g += o; b += o; }
      const c = nearest(r, g, b, p);
      const i = (y * w + x) * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
      if (mode === 'fs') {
        const er = r - c[0], eg = g - c[1], eb = b - c[2];
        const spread = (dx, dy, k) => { const xx = x + dx, yy = y + dy; if (xx < 0 || xx >= w || yy >= h) return; const q = (yy * w + xx) * 3; f[q] += er * k; f[q + 1] += eg * k; f[q + 2] += eb * k; };
        spread(1, 0, 7 / 16); spread(-1, 1, 3 / 16); spread(0, 1, 5 / 16); spread(1, 1, 1 / 16);
      }
    }
    sc.putImageData(id, 0, 0);
    canvas.width = w * s; canvas.height = h * s;
    const ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false;
    ctx.drawImage(small, 0, 0, canvas.width, canvas.height);
    stage.classList.remove('hidden');
    info.textContent = `${w}x${h} dithered pixels, shown at ${canvas.width}x${canvas.height}`;
  }
  const zone = dropZone('Drop an image here or click to choose', async files => {
    try { img = await loadImage(files[0]); process(); } catch { toast('Could not load image'); }
  }, 'image/*', false);
  for (const c of [algo, pal, scale]) c.addEventListener('change', process);
  thr.addEventListener('input', () => algo.value === 'threshold' && process());
  render(root,
    zone,
    el('div', { class: 'row' }, field('Algorithm', algo), field('Palette', pal), field('Pixel size', scale), field('Threshold (threshold mode)', thr)),
    stage, info,
    el('div', { class: 'row' }, el('button', { class: 'btn primary', onclick: () => img && canvas.toBlob(b => b && download('dithered.png', b, 'image/png'), 'image/png') }, 'Download PNG')));
}
