// CSS sprite sheet generator: pack images in a row, column or grid; output PNG and CSS with background-position.
import { el, render, download, dropZone, field, toast, loadImage, copy } from '../../lib/ui.js';

export default function (root) {
  let items = [];   // { img, name }
  let placed = [];
  const canvas = el('canvas', { style: { maxWidth: '100%', imageRendering: 'pixelated' } });
  const stage = el('div', { class: 'canvas-wrap hidden', style: { backgroundImage: 'linear-gradient(45deg,rgba(128,128,128,.15) 25%,transparent 25%,transparent 75%,rgba(128,128,128,.15) 75%),linear-gradient(45deg,rgba(128,128,128,.15) 25%,transparent 25%,transparent 75%,rgba(128,128,128,.15) 75%)', backgroundSize: '16px 16px', backgroundPosition: '0 0,8px 8px' } }, canvas);
  const layout = el('select', { class: 'select' }, el('option', { value: 'row' }, 'Single row'), el('option', { value: 'column' }, 'Single column'), el('option', { value: 'grid', selected: true }, 'Grid'));
  const cols = el('input', { type: 'number', class: 'input', min: 1, max: 50, value: 4, style: { width: '70px' } });
  const pad = el('input', { type: 'number', class: 'input', min: 0, max: 100, value: 2, style: { width: '70px' } });
  const prefix = el('input', { class: 'input', value: 'icon-', style: { width: '110px' } });
  const fileName = el('input', { class: 'input', value: 'sprite.png', style: { width: '130px' } });
  const embed = el('input', { type: 'checkbox' });
  const css = el('pre', { class: 'out', style: { maxHeight: '320px' } });
  const list = el('div', { class: 'row' });
  const info = el('div', { class: 'muted small' });
  const clean = n => n.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'img';

  function pack() {
    if (!items.length) { stage.classList.add('hidden'); css.textContent = ''; info.textContent = ''; return; }
    const p = Math.max(0, +pad.value || 0), n = items.length;
    const mode = layout.value, C = mode === 'row' ? n : mode === 'column' ? 1 : Math.max(1, Math.min(n, +cols.value || 1));
    const maxW = Math.max(...items.map(i => i.img.naturalWidth)), maxH = Math.max(...items.map(i => i.img.naturalHeight));
    placed = []; let W = 0, H = 0;
    if (mode === 'grid') {
      items.forEach((it, i) => { const c = i % C, r = Math.floor(i / C); placed.push({ ...it, x: c * (maxW + p), y: r * (maxH + p), w: it.img.naturalWidth, h: it.img.naturalHeight }); });
      W = C * maxW + (C - 1) * p; H = Math.ceil(n / C) * maxH + (Math.ceil(n / C) - 1) * p;
    } else {
      let x = 0, y = 0;
      for (const it of items) {
        placed.push({ ...it, x, y, w: it.img.naturalWidth, h: it.img.naturalHeight });
        if (mode === 'row') { x += it.img.naturalWidth + p; W = x - p; H = maxH; } else { y += it.img.naturalHeight + p; H = y - p; W = maxW; }
      }
    }
    canvas.width = Math.max(1, W); canvas.height = Math.max(1, H);
    const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, W, H);
    for (const s of placed) ctx.drawImage(s.img, s.x, s.y);
    stage.classList.remove('hidden');
    info.textContent = `${n} sprite(s) · sheet ${W}x${H}px`;
    buildCss();
  }
  function buildCss() {
    if (!placed.length) return;
    const url = embed.checked ? canvas.toDataURL('image/png') : fileName.value || 'sprite.png';
    const names = new Set();
    const lines = [`.${prefix.value}sprite, [class^="${prefix.value}"] {\n  display: inline-block;\n  background: url("${url}") no-repeat;\n}`];
    for (const s of placed) {
      let name = clean(s.name), k = 2; while (names.has(name)) name = clean(s.name) + '-' + k++; names.add(name);
      lines.push(`.${prefix.value}${name} {\n  width: ${s.w}px;\n  height: ${s.h}px;\n  background-position: ${s.x ? -s.x + 'px' : '0'} ${s.y ? -s.y + 'px' : '0'};\n}`);
    }
    css.textContent = lines.join('\n');
  }
  function showList() {
    render(list, items.map((it, i) => el('div', { class: 'col', style: { alignItems: 'center', gap: '2px' } },
      el('img', { src: it.img.src, title: it.name, style: { width: '48px', height: '48px', objectFit: 'contain', border: '1px solid var(--line)', borderRadius: '6px' } }),
      el('div', { class: 'row', style: { margin: 0, gap: '2px' } },
        el('button', { class: 'btn small ghost', title: 'Move earlier', onclick: () => { if (i > 0) { [items[i - 1], items[i]] = [items[i], items[i - 1]]; showList(); pack(); } } }, '←'),
        el('button', { class: 'btn small ghost', title: 'Remove', onclick: () => { items.splice(i, 1); showList(); pack(); } }, '✕'),
        el('button', { class: 'btn small ghost', title: 'Move later', onclick: () => { if (i < items.length - 1) { [items[i + 1], items[i]] = [items[i], items[i + 1]]; showList(); pack(); } } }, '→')))));
  }
  const zone = dropZone('Drop icons / images here or click to choose (many at once)', async files => {
    for (const f of files) { try { items.push({ img: await loadImage(f), name: f.name }); } catch { toast(`Skipped ${f.name}`); } }
    showList(); pack();
  }, 'image/*', true);
  for (const c of [layout, embed]) c.addEventListener('change', pack);
  for (const c of [cols, pad]) c.addEventListener('input', pack);
  for (const c of [prefix, fileName]) c.addEventListener('input', buildCss);
  render(root,
    zone, list,
    el('div', { class: 'row' }, field('Layout', layout), field('Columns (grid)', cols), field('Padding px', pad), field('Class prefix', prefix), field('Image file name', fileName), el('label', { class: 'inline' }, embed, 'Embed image as data URL')),
    stage, info,
    el('div', { class: 'row' },
      el('button', { class: 'btn primary', onclick: () => placed.length ? canvas.toBlob(b => b && download(fileName.value || 'sprite.png', b, 'image/png'), 'image/png') : toast('Add images first') }, 'Download PNG'),
      el('button', { class: 'btn', onclick: () => css.textContent ? copy(css.textContent) : toast('Nothing to copy') }, 'Copy CSS'),
      el('button', { class: 'btn', onclick: () => css.textContent && download('sprite.css', css.textContent, 'text/css') }, 'Download CSS'),
      el('button', { class: 'btn ghost', onclick: () => { items = []; showList(); pack(); } }, 'Clear')),
    css);
}
