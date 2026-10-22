// Colour blindness simulator: apply protanopia, deuteranopia, tritanopia and achromatopsia matrices to an image, side by side.
import { el, render, download, dropZone, field, toast, loadImage } from '../../lib/ui.js';

// Row-major 3x3 RGB matrices (Machado et al. 2009, severity 1.0; achromatopsia = luminance).
const SIMS = {
  original: { label: 'Original', m: null },
  protanopia: { label: 'Protanopia (no red cones, ~1% of men)', m: [0.567, 0.433, 0, 0.558, 0.442, 0, 0, 0.242, 0.758] },
  deuteranopia: { label: 'Deuteranopia (no green cones, ~1% of men)', m: [0.625, 0.375, 0, 0.7, 0.3, 0, 0, 0.3, 0.7] },
  tritanopia: { label: 'Tritanopia (no blue cones, rare)', m: [0.95, 0.05, 0, 0, 0.433, 0.567, 0, 0.475, 0.525] },
  achromatopsia: { label: 'Achromatopsia (no colour, very rare)', m: [0.299, 0.587, 0.114, 0.299, 0.587, 0.114, 0.299, 0.587, 0.114] },
};

function simulate(img, key, maxW) {
  const sc = Math.min(1, maxW / img.naturalWidth);
  const c = el('canvas'); c.width = Math.max(1, Math.round(img.naturalWidth * sc)); c.height = Math.max(1, Math.round(img.naturalHeight * sc));
  const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.drawImage(img, 0, 0, c.width, c.height);
  const m = SIMS[key].m; if (!m) return c;
  const id = ctx.getImageData(0, 0, c.width, c.height), d = id.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    d[i] = Math.min(255, m[0] * r + m[1] * g + m[2] * b);
    d[i + 1] = Math.min(255, m[3] * r + m[4] * g + m[5] * b);
    d[i + 2] = Math.min(255, m[6] * r + m[7] * g + m[8] * b);
  }
  ctx.putImageData(id, 0, 0);
  return c;
}

export default function (root) {
  let img = null;
  const grid = el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' } });
  const layout = el('select', { class: 'select' }, el('option', { value: 'all' }, 'All five'), el('option', { value: 'pair' }, 'Original + one'));
  const only = el('select', { class: 'select' }, Object.keys(SIMS).filter(k => k !== 'original').map(k => el('option', { value: k }, SIMS[k].label.split(' (')[0])));
  const quality = el('select', { class: 'select' }, el('option', { value: 400 }, 'Fast preview (400px)'), el('option', { value: 800, selected: true }, 'Preview 800px'), el('option', { value: 1600 }, 'Large preview 1600px'));
  const info = el('div', { class: 'muted small' });

  function keys() { return layout.value === 'all' ? Object.keys(SIMS) : ['original', only.value]; }
  function show() {
    if (!img) return;
    const ks = keys();
    render(grid, ks.map(k => {
      const c = simulate(img, k, +quality.value); c.style.maxWidth = '100%'; c.style.borderRadius = '6px';
      return el('div', { class: 'panel', style: { padding: '8px' } }, c,
        el('div', { class: 'row', style: { margin: '6px 0 0', justifyContent: 'space-between' } },
          el('span', { class: 'small' }, SIMS[k].label),
          el('button', { class: 'btn small', onclick: () => simulate(img, k, 1e9).toBlob(b => b && download(`${k}.png`, b, 'image/png'), 'image/png') }, 'Download full size')));
    }));
    info.textContent = `${img.naturalWidth}x${img.naturalHeight} source · downloads are rendered at full resolution`;
  }
  function downloadAll() {
    if (!img) { toast('Load an image first'); return; }
    const ks = keys(), per = Math.min(800, img.naturalWidth), ph = Math.round(per * img.naturalHeight / img.naturalWidth);
    const cols = ks.length <= 2 ? ks.length : ks.length <= 4 ? 2 : 3, rows = Math.ceil(ks.length / cols), lab = 36, gap = 12;
    const c = el('canvas'); c.width = cols * per + (cols + 1) * gap; c.height = rows * (ph + lab) + (rows + 1) * gap;
    const ctx = c.getContext('2d'); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = '#1b1f24'; ctx.font = '600 18px system-ui, sans-serif'; ctx.textBaseline = 'middle';
    ks.forEach((k, i) => {
      const x = gap + (i % cols) * (per + gap), y = gap + Math.floor(i / cols) * (ph + lab + gap);
      ctx.drawImage(simulate(img, k, per), x, y, per, ph);
      ctx.fillText(SIMS[k].label.split(' (')[0], x + 4, y + ph + lab / 2);
    });
    c.toBlob(b => b && download('colorblind-comparison.png', b, 'image/png'), 'image/png');
  }
  const zone = dropZone('Drop an image, chart or UI screenshot here', async f => { try { img = await loadImage(f[0]); show(); } catch { toast('Could not load image'); } }, 'image/*', false);
  for (const c of [layout, only, quality]) c.addEventListener('change', show);
  render(root,
    zone,
    el('div', { class: 'row' }, field('Layout', layout), field('Type (pair mode)', only), field('Preview size', quality),
      el('button', { class: 'btn primary', onclick: downloadAll }, 'Download comparison sheet')),
    grid, info,
    el('p', { class: 'muted small' }, 'Uses the Machado, Oliveira and Fernandes (2009) simulation matrices at full severity. Check that your charts and UI states still read without relying on red vs green alone.'));
}
