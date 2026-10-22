// Watermark tool: batch-stamp text or a logo image onto many photos, preview, download each or all.
import { el, render, download, dropZone, field, toast, loadImage, store } from '../../lib/ui.js';

const POS = { 'top-left': [0, 0], 'top': [.5, 0], 'top-right': [1, 0], 'left': [0, .5], 'center': [.5, .5], 'right': [1, .5], 'bottom-left': [0, 1], 'bottom': [.5, 1], 'bottom-right': [1, 1] };

export default function (root) {
  const s = store('watermark');
  let items = [];      // { img, name }
  let logo = null, selected = 0;

  const mode = el('select', { class: 'select' }, el('option', { value: 'text' }, 'Text'), el('option', { value: 'image' }, 'Image (logo)'));
  const text = el('input', { class: 'input', value: s.get('text', '© Your Name'), placeholder: 'Watermark text', style: { minWidth: '180px' } });
  const font = el('select', { class: 'select' }, ['system-ui, sans-serif', 'Georgia, serif', 'ui-monospace, Consolas, monospace', 'Impact, sans-serif', 'cursive'].map(f => el('option', { value: f }, f.split(',')[0])));
  const size = el('input', { type: 'range', min: 1, max: 30, value: s.get('size', 6), class: 'input' });
  const color = el('input', { type: 'color', value: s.get('color', '#ffffff') });
  const shadow = el('input', { type: 'checkbox', checked: true });
  const opacity = el('input', { type: 'range', min: 5, max: 100, value: s.get('opacity', 50), class: 'input' });
  const pos = el('select', { class: 'select' }, Object.keys(POS).map(p => el('option', { value: p, selected: p === s.get('pos', 'bottom-right') }, p)));
  const rotation = el('input', { type: 'range', min: -90, max: 90, value: s.get('rot', 0), class: 'input' });
  const margin = el('input', { type: 'range', min: 0, max: 20, value: s.get('margin', 3), class: 'input' });
  const tile = el('input', { type: 'checkbox' });
  const logoScale = el('input', { type: 'range', min: 5, max: 80, value: 25, class: 'input' });
  const fmt = el('select', { class: 'select' }, el('option', { value: 'image/png' }, 'PNG'), el('option', { value: 'image/jpeg', selected: true }, 'JPEG'));
  const quality = el('input', { type: 'range', min: 50, max: 100, value: 92, class: 'input' });
  const logoInfo = el('span', { class: 'muted small' }, 'No logo loaded');
  const thumbs = el('div', { class: 'row' });
  const preview = el('canvas', { style: { maxWidth: '100%' } });
  const stage = el('div', { class: 'canvas-wrap hidden' }, preview);
  const previewName = el('div', { class: 'muted small' });
  const textOpts = el('div', { class: 'row' }, field('Text', text), field('Font', font), field('Colour', color), el('label', { class: 'inline' }, shadow, 'Shadow'));
  const imgOpts = el('div', { class: 'row hidden' }, field('Logo width (% of image)', logoScale), logoInfo);
  const logoZone = dropZone('Drop a logo (PNG with transparency works best)', async files => {
    try { logo = await loadImage(files[0]); logoInfo.textContent = `${files[0].name} (${logo.naturalWidth}x${logo.naturalHeight})`; draw(); } catch { toast('Could not load logo'); }
  }, 'image/*', false);
  logoZone.classList.add('hidden'); logoZone.style.padding = '14px';

  function stamp(img) {
    const c = el('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
    const W = c.width, H = c.height, base = Math.min(W, H);
    const m = base * margin.value / 100, rot = rotation.value * Math.PI / 180;
    let w, h, fs = 0;
    if (mode.value === 'text') {
      if (!text.value.trim()) return c;
      fs = Math.max(8, base * size.value / 100);
      ctx.font = `bold ${fs}px ${font.value}`;
      w = ctx.measureText(text.value).width; h = fs;
    } else {
      if (!logo) return c;
      w = W * logoScale.value / 100; h = w * logo.naturalHeight / logo.naturalWidth;
    }
    ctx.globalAlpha = opacity.value / 100;
    const place = (cx, cy) => {
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot);
      if (mode.value === 'text') {
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = color.value;
        if (shadow.checked) { ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = fs / 6; ctx.shadowOffsetY = fs / 20; }
        ctx.fillText(text.value, 0, 0);
      } else ctx.drawImage(logo, -w / 2, -h / 2, w, h);
      ctx.restore();
    };
    if (tile.checked) {
      const sx = w + base * .2, sy = h + base * .2;
      for (let y = sy / 2, row = 0; y < H + sy; y += sy, row++) for (let x = (row % 2 ? sx / 2 : 0); x < W + sx; x += sx) place(x, y);
    } else {
      const [ax, ay] = POS[pos.value];
      place(m + w / 2 + ax * (W - w - 2 * m), m + h / 2 + ay * (H - h - 2 * m));
    }
    return c;
  }

  function save() { s.set('text', text.value); s.set('size', +size.value); s.set('color', color.value); s.set('opacity', +opacity.value); s.set('pos', pos.value); s.set('rot', +rotation.value); s.set('margin', +margin.value); }
  function draw() {
    save();
    const it = items[selected];
    if (!it) { stage.classList.add('hidden'); return; }
    const c = stamp(it.img);
    preview.width = c.width; preview.height = c.height;
    preview.getContext('2d').drawImage(c, 0, 0);
    previewName.textContent = `Preview: ${it.name} (${c.width}x${c.height})`;
    stage.classList.remove('hidden');
  }
  function blobOf(canvas) { return new Promise(res => canvas.toBlob(res, fmt.value, quality.value / 100)); }
  function outName(name) { return name.replace(/\.[^.]+$/, '') + '-watermarked.' + (fmt.value === 'image/png' ? 'png' : 'jpg'); }
  async function downloadOne(it) { const b = await blobOf(stamp(it.img)); if (b) download(outName(it.name), b, fmt.value); else toast('Export failed'); }
  async function downloadAll() {
    if (!items.length) { toast('Add some images first'); return; }
    for (const it of items) { await downloadOne(it); await new Promise(r => setTimeout(r, 300)); }
    toast(`Downloaded ${items.length} file(s)`);
  }
  function showThumbs() {
    render(thumbs, items.map((it, i) => el('div', { class: 'col', style: { alignItems: 'center', gap: '4px' } },
      el('img', { src: it.img.src, title: it.name, onclick: () => { selected = i; showThumbs(); draw(); }, style: { width: '72px', height: '72px', objectFit: 'cover', borderRadius: '6px', cursor: 'pointer', border: `2px solid ${i === selected ? 'var(--accent)' : 'var(--line)'}` } }),
      el('div', { class: 'row', style: { margin: 0, gap: '4px' } },
        el('button', { class: 'btn small ghost', title: 'Download this one', onclick: () => downloadOne(it) }, '⬇'),
        el('button', { class: 'btn small ghost', title: 'Remove', onclick: () => { items.splice(i, 1); selected = Math.min(selected, Math.max(0, items.length - 1)); showThumbs(); draw(); } }, '✕')))),
      items.length ? el('span', { class: 'muted small' }, `${items.length} image(s); click a thumbnail to preview it`) : null);
  }
  const zone = dropZone('Drop images here or click to choose (several at once is fine)', async files => {
    for (const f of files) { try { items.push({ img: await loadImage(f), name: f.name }); } catch { toast(`Skipped ${f.name}`); } }
    selected = items.length - 1; showThumbs(); draw();
  }, 'image/*', true);
  mode.addEventListener('change', () => { const t = mode.value === 'text'; textOpts.classList.toggle('hidden', !t); imgOpts.classList.toggle('hidden', t); logoZone.classList.toggle('hidden', t); draw(); });
  for (const c of [text, size, color, opacity, rotation, margin, logoScale]) c.addEventListener('input', draw);
  for (const c of [font, pos, tile, shadow]) c.addEventListener('change', draw);
  render(root,
    zone, thumbs,
    el('div', { class: 'row' }, field('Watermark type', mode), field('Position', pos), el('label', { class: 'inline' }, tile, 'Tile across image')),
    textOpts, logoZone, imgOpts,
    el('div', { class: 'row' }, field('Size (% of image)', size), field('Opacity', opacity), field('Rotation', rotation), field('Margin', margin)),
    stage, previewName,
    el('div', { class: 'row' }, field('Format', fmt), field('JPEG quality', quality),
      el('button', { class: 'btn primary', onclick: () => items[selected] ? downloadOne(items[selected]) : toast('Add an image first') }, 'Download this image'),
      el('button', { class: 'btn', onclick: downloadAll }, 'Download all')));
}
