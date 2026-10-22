// Placeholder image generator: size, colours, custom text, format; download, copy data URL or <img> tag.
import { el, render, download, field, toast, copy, store } from '../../lib/ui.js';

const PRESETS = [['', 'Custom'], ['300x250', 'Medium rectangle 300x250'], ['728x90', 'Leaderboard 728x90'], ['400x400', 'Square 400'], ['800x600', '800x600'], ['1200x630', 'OG image 1200x630'], ['1280x720', 'HD 1280x720'], ['1920x1080', 'Full HD 1920x1080'], ['1080x1920', 'Story 1080x1920'], ['150x150', 'Thumbnail 150'], ['64x64', 'Icon 64']];

export default function (root) {
  const s = store('placeholder-image');
  const canvas = el('canvas', { style: { maxWidth: '100%', maxHeight: '420px' } });
  const w = el('input', { type: 'number', class: 'input', min: 1, max: 4096, value: s.get('w', 600), style: { width: '90px' } });
  const h = el('input', { type: 'number', class: 'input', min: 1, max: 4096, value: s.get('h', 400), style: { width: '90px' } });
  const preset = el('select', { class: 'select' }, PRESETS.map(([v, l]) => el('option', { value: v }, l)));
  const bg = el('input', { type: 'color', value: s.get('bg', '#cccccc') });
  const fg = el('input', { type: 'color', value: s.get('fg', '#666666') });
  const text = el('input', { class: 'input', value: s.get('text', ''), placeholder: 'Defaults to WIDTH×HEIGHT', style: { minWidth: '180px' } });
  const fontSize = el('input', { type: 'number', class: 'input', min: 0, max: 500, value: s.get('fs', 0), placeholder: 'auto', style: { width: '80px' } });
  const font = el('select', { class: 'select' }, ['system-ui, sans-serif', 'Georgia, serif', 'ui-monospace, Consolas, monospace'].map(f => el('option', { value: f }, f.split(',')[0])));
  const fmt = el('select', { class: 'select' }, [['image/png', 'PNG'], ['image/jpeg', 'JPEG'], ['image/webp', 'WebP']].map(([v, l]) => el('option', { value: v }, l)));
  const border = el('input', { type: 'checkbox' });
  const cross = el('input', { type: 'checkbox' });
  const sizeInfo = el('span', { class: 'muted small' });
  const stage = el('div', { class: 'canvas-wrap' }, canvas);

  function draw() {
    const W = Math.max(1, Math.min(4096, +w.value || 1)), H = Math.max(1, Math.min(4096, +h.value || 1));
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = bg.value; ctx.fillRect(0, 0, W, H);
    if (cross.checked) { ctx.strokeStyle = fg.value; ctx.globalAlpha = .35; ctx.lineWidth = Math.max(1, Math.min(W, H) / 150); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(W, H); ctx.moveTo(W, 0); ctx.lineTo(0, H); ctx.stroke(); ctx.globalAlpha = 1; }
    if (border.checked) { ctx.strokeStyle = fg.value; ctx.lineWidth = Math.max(2, Math.min(W, H) / 60); ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, W - ctx.lineWidth, H - ctx.lineWidth); }
    const label = text.value.trim() || `${W}×${H}`;
    let fs = +fontSize.value || 0;
    if (!fs) { fs = Math.min(H * .5, W / Math.max(2, label.length) * 1.5, Math.min(W, H) / 4); fs = Math.max(6, Math.floor(fs)); }
    ctx.font = `600 ${fs}px ${font.value}`;
    ctx.fillStyle = fg.value; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const lines = label.split(/\\n|\n/);
    lines.forEach((ln, i) => ctx.fillText(ln, W / 2, H / 2 + (i - (lines.length - 1) / 2) * fs * 1.2));
    s.set('w', W); s.set('h', H); s.set('bg', bg.value); s.set('fg', fg.value); s.set('text', text.value); s.set('fs', +fontSize.value || 0);
    const url = canvas.toDataURL(fmt.value);
    sizeInfo.textContent = `${W}×${H} · data URL ≈ ${Math.round(url.length / 1024)} KB`;
  }
  const ext = () => fmt.value === 'image/png' ? 'png' : fmt.value === 'image/jpeg' ? 'jpg' : 'webp';
  preset.addEventListener('change', () => { if (!preset.value) return; const [pw, ph] = preset.value.split('x'); w.value = pw; h.value = ph; draw(); });
  for (const c of [w, h, bg, fg, text, fontSize]) c.addEventListener('input', () => { preset.value = ''; draw(); });
  for (const c of [font, fmt, border, cross]) c.addEventListener('change', draw);
  render(root,
    el('div', { class: 'row' }, field('Preset', preset), field('Width', w), field('Height', h), field('Background', bg), field('Text colour', fg)),
    el('div', { class: 'row' }, field('Text (\\n for a new line)', text), field('Font size (0 = auto)', fontSize), field('Font', font), el('label', { class: 'inline' }, border, 'Border'), el('label', { class: 'inline' }, cross, 'Diagonals')),
    stage, sizeInfo,
    el('div', { class: 'row' }, field('Format', fmt),
      el('button', { class: 'btn primary', onclick: () => canvas.toBlob(b => b ? download(`placeholder-${canvas.width}x${canvas.height}.${ext()}`, b, fmt.value) : toast('Export failed'), fmt.value, 0.9) }, 'Download'),
      el('button', { class: 'btn', onclick: () => copy(canvas.toDataURL(fmt.value, 0.9)) }, 'Copy data URL'),
      el('button', { class: 'btn', onclick: () => copy(`<img src="${canvas.toDataURL(fmt.value, 0.9)}" width="${canvas.width}" height="${canvas.height}" alt="${(text.value.trim() || 'placeholder').replace(/"/g, '&quot;')}">`) }, 'Copy <img> tag')));
  draw();
}
