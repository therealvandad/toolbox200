// Collage maker: 2-6 images, grid templates, gap, background colour.
import { el, render, download, dropZone, field, toast, loadImage } from '../../lib/ui.js';

// Each template returns an array of [x,y,w,h] in unit coordinates for n images.
const TEMPLATES = {
  'Grid': n => { const cols = n <= 2 ? n : n <= 4 ? 2 : 3, rows = Math.ceil(n / cols); return Array.from({ length: n }, (_, i) => [(i % cols) / cols, Math.floor(i / cols) / rows, 1 / cols, 1 / rows]); },
  'Row': n => Array.from({ length: n }, (_, i) => [i / n, 0, 1 / n, 1]),
  'Column': n => Array.from({ length: n }, (_, i) => [0, i / n, 1, 1 / n]),
  'Feature left': n => n === 1 ? [[0, 0, 1, 1]] : [[0, 0, .6, 1], ...Array.from({ length: n - 1 }, (_, i) => [.6, i / (n - 1), .4, 1 / (n - 1)])],
  'Feature top': n => n === 1 ? [[0, 0, 1, 1]] : [[0, 0, 1, .6], ...Array.from({ length: n - 1 }, (_, i) => [i / (n - 1), .6, 1 / (n - 1), .4])],
  'Mosaic': n => { const out = [[0, 0, .5, .5], [.5, 0, .5, .5], [0, .5, .5, .5], [.5, .5, .5, .5]]; if (n <= 4) return out.slice(0, n); return [[0, 0, .5, .5], [.5, 0, .25, .5], [.75, 0, .25, .5], [0, .5, .25, .5], [.25, .5, .25, .5], [.5, .5, .5, .5]].slice(0, n); },
};

export default function (root) {
  let imgs = [];
  const canvas = el('canvas', { style: { maxWidth: '100%' } });
  const tpl = el('select', { class: 'select' }, Object.keys(TEMPLATES).map(k => el('option', { value: k }, k)));
  const gap = el('input', { type: 'range', min: 0, max: 60, value: 10, class: 'input' });
  const bg = el('input', { type: 'color', value: '#ffffff' });
  const size = el('select', { class: 'select' }, [['1200x1200', 'Square 1200'], ['1600x1200', 'Landscape 1600x1200'], ['1200x1600', 'Portrait 1200x1600'], ['1920x1080', 'Wide 1920x1080']].map(([v, l]) => el('option', { value: v }, l)));
  const list = el('div', { class: 'row' });
  const stage = el('div', { class: 'canvas-wrap hidden' }, canvas);

  function showList() {
    render(list, imgs.map((im, i) => el('div', { class: 'col', style: { alignItems: 'center' } },
      el('img', { src: im.src, style: { width: '70px', height: '70px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--line)' } }),
      el('div', { class: 'row', style: { margin: 0 } },
        el('button', { class: 'btn small ghost', title: 'Move left', onclick: () => { if (i > 0) { [imgs[i - 1], imgs[i]] = [imgs[i], imgs[i - 1]]; showList(); draw(); } } }, '←'),
        el('button', { class: 'btn small ghost', title: 'Remove', onclick: () => { imgs.splice(i, 1); showList(); draw(); } }, '✕'),
        el('button', { class: 'btn small ghost', title: 'Move right', onclick: () => { if (i < imgs.length - 1) { [imgs[i + 1], imgs[i]] = [imgs[i], imgs[i + 1]]; showList(); draw(); } } }, '→')))),
      imgs.length ? el('span', { class: 'muted small' }, `${imgs.length} of 6`) : null);
  }
  function draw() {
    if (imgs.length < 2) { stage.classList.add('hidden'); return; }
    const [W, H] = size.value.split('x').map(Number);
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = bg.value; ctx.fillRect(0, 0, W, H);
    const g = +gap.value, rects = TEMPLATES[tpl.value](imgs.length);
    rects.forEach(([x, y, w, h], i) => {
      const im = imgs[i]; if (!im) return;
      const l = x <= 0 ? g : g / 2, r = x + w >= 0.999 ? g : g / 2, t = y <= 0 ? g : g / 2, bt = y + h >= 0.999 ? g : g / 2;
      const cx = x * W + l, cy = y * H + t, cw = w * W - l - r, ch = h * H - t - bt;
      // cover-fit
      const s = Math.max(cw / im.naturalWidth, ch / im.naturalHeight);
      const sw = cw / s, sh = ch / s, sx = (im.naturalWidth - sw) / 2, sy = (im.naturalHeight - sh) / 2;
      ctx.drawImage(im, sx, sy, sw, sh, cx, cy, cw, ch);
    });
    stage.classList.remove('hidden');
  }
  const zone = dropZone('Drop 2 to 6 images here or click to choose', async files => {
    const room = 6 - imgs.length;
    if (files.length > room) toast('Maximum 6 images');
    for (const f of files.slice(0, room)) { try { imgs.push(await loadImage(f)); } catch { toast('Skipped a file that is not an image'); } }
    showList(); draw();
  }, 'image/*', true);
  for (const c of [tpl, size]) c.addEventListener('change', draw);
  gap.addEventListener('input', draw); bg.addEventListener('input', draw);
  render(root,
    zone, list,
    el('div', { class: 'row' }, field('Template', tpl), field('Canvas', size), field('Gap', gap), field('Background', bg),
      el('button', { class: 'btn small ghost', onclick: () => { imgs = []; showList(); draw(); } }, 'Clear all')),
    stage,
    el('div', { class: 'row' }, el('button', { class: 'btn primary', onclick: () => imgs.length >= 2 ? canvas.toBlob(b => b && download('collage.png', b, 'image/png'), 'image/png') : toast('Add at least 2 images') }, 'Download PNG'),
      el('button', { class: 'btn', onclick: () => imgs.length >= 2 && canvas.toBlob(b => b && download('collage.jpg', b, 'image/jpeg'), 'image/jpeg', 0.92) }, 'Download JPEG')));
}
