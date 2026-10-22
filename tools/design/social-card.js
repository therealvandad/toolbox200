// Social card maker: 1200x630 Open Graph image with title, subtitle, author and a colour, gradient or photo background.
import { el, render, download, dropZone, field, toast, loadImage, store } from '../../lib/ui.js';

const W = 1200, H = 630;

function wrap(ctx, text, maxW) {
  const out = [];
  for (const para of String(text).split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/)) {
      const t = line ? line + ' ' + word : word;
      if (ctx.measureText(t).width > maxW && line) { out.push(line); line = word; } else line = t;
    }
    out.push(line);
  }
  return out;
}

export default function (root) {
  const s = store('social-card');
  let photo = null;
  const canvas = el('canvas', { style: { maxWidth: '100%' } });
  const title = el('textarea', { class: 'textarea prose', style: { minHeight: '60px' }, value: s.get('title', 'How we cut page load time in half'), placeholder: 'Title' });
  const subtitle = el('input', { class: 'input', value: s.get('subtitle', 'A practical guide to lazy loading, caching and image formats'), placeholder: 'Subtitle', style: { width: '100%' } });
  const author = el('input', { class: 'input', value: s.get('author', 'Jane Doe'), placeholder: 'Author', style: { width: '160px' } });
  const site = el('input', { class: 'input', value: s.get('site', 'example.com'), placeholder: 'Site / URL', style: { width: '160px' } });
  const bgType = el('select', { class: 'select' }, el('option', { value: 'solid' }, 'Solid colour'), el('option', { value: 'gradient', selected: true }, 'Gradient'), el('option', { value: 'image' }, 'Photo'));
  const c1 = el('input', { type: 'color', value: s.get('c1', '#1e3a8a') });
  const c2 = el('input', { type: 'color', value: s.get('c2', '#7c3aed') });
  const angle = el('input', { type: 'range', min: 0, max: 360, value: s.get('angle', 135), class: 'input' });
  const textColor = el('input', { type: 'color', value: s.get('text', '#ffffff') });
  const accent = el('input', { type: 'color', value: s.get('accent', '#fbbf24') });
  const overlay = el('input', { type: 'range', min: 0, max: 90, value: 45, class: 'input' });
  const titleSize = el('input', { type: 'range', min: 36, max: 110, value: s.get('ts', 68), class: 'input' });
  const align = el('select', { class: 'select' }, el('option', { value: 'left' }, 'Left'), el('option', { value: 'center' }, 'Centre'));
  const font = el('select', { class: 'select' }, [['system-ui, -apple-system, "Segoe UI", sans-serif', 'Sans'], ['Georgia, "Times New Roman", serif', 'Serif'], ['ui-monospace, Consolas, monospace', 'Mono']].map(([v, l]) => el('option', { value: v }, l)));
  const stage = el('div', { class: 'canvas-wrap' }, canvas);
  const zone = dropZone('Drop a background photo (optional)', async f => { try { photo = await loadImage(f[0]); bgType.value = 'image'; draw(); } catch { toast('Could not load image'); } }, 'image/*', false);
  zone.style.padding = '12px';

  function draw() {
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    // background
    if (bgType.value === 'image' && photo) {
      const sc = Math.max(W / photo.naturalWidth, H / photo.naturalHeight), sw = W / sc, sh = H / sc;
      ctx.drawImage(photo, (photo.naturalWidth - sw) / 2, (photo.naturalHeight - sh) / 2, sw, sh, 0, 0, W, H);
      ctx.fillStyle = `rgba(0,0,0,${overlay.value / 100})`; ctx.fillRect(0, 0, W, H);
    } else if (bgType.value === 'gradient') {
      const a = angle.value * Math.PI / 180, r = Math.hypot(W, H) / 2, cx = W / 2, cy = H / 2;
      const g = ctx.createLinearGradient(cx - Math.sin(a) * r, cy + Math.cos(a) * r, cx + Math.sin(a) * r, cy - Math.cos(a) * r);
      g.addColorStop(0, c1.value); g.addColorStop(1, c2.value); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    } else { ctx.fillStyle = c1.value; ctx.fillRect(0, 0, W, H); }
    // accent bar
    ctx.fillStyle = accent.value; ctx.fillRect(0, 0, W, 14);
    const pad = 80, maxW = W - pad * 2, centered = align.value === 'center';
    ctx.textAlign = centered ? 'center' : 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = textColor.value;
    const x = centered ? W / 2 : pad;
    // measure block
    const ts = +titleSize.value;
    ctx.font = `700 ${ts}px ${font.value}`;
    let tl = wrap(ctx, title.value.trim(), maxW); if (tl.length > 4) { tl = tl.slice(0, 4); tl[3] = tl[3].replace(/\s*\S*$/, '') + '…'; }
    const ss = Math.round(ts * .42);
    ctx.font = `400 ${ss}px ${font.value}`;
    let sl = subtitle.value.trim() ? wrap(ctx, subtitle.value.trim(), maxW).slice(0, 2) : [];
    const blockH = tl.length * ts * 1.15 + (sl.length ? ss * .8 + sl.length * ss * 1.4 : 0);
    let y = (H - 70) / 2 - blockH / 2 + ts * .9;
    ctx.font = `700 ${ts}px ${font.value}`;
    ctx.shadowColor = 'rgba(0,0,0,.25)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2;
    for (const ln of tl) { ctx.fillText(ln, x, y); y += ts * 1.15; }
    ctx.font = `400 ${ss}px ${font.value}`; ctx.globalAlpha = .88; y += ss * .5;
    for (const ln of sl) { ctx.fillText(ln, x, y); y += ss * 1.4; }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    // footer: author with initial avatar, site right
    const fy = H - 64, fs = 28;
    ctx.font = `600 ${fs}px ${font.value}`; ctx.textBaseline = 'middle';
    if (author.value.trim()) {
      const r = 26, ax = centered ? W / 2 - (ctx.measureText(author.value.trim()).width + r * 2 + 16) / 2 + r : pad + r;
      ctx.fillStyle = accent.value; ctx.beginPath(); ctx.arc(ax, fy, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1b1f24'; ctx.textAlign = 'center'; ctx.font = `700 ${fs}px ${font.value}`;
      ctx.fillText(author.value.trim()[0].toUpperCase(), ax, fy + 1);
      ctx.fillStyle = textColor.value; ctx.textAlign = 'left'; ctx.font = `600 ${fs}px ${font.value}`;
      ctx.fillText(author.value.trim(), ax + r + 16, fy);
    }
    if (site.value.trim() && !centered) { ctx.globalAlpha = .8; ctx.textAlign = 'right'; ctx.font = `500 ${fs - 4}px ${font.value}`; ctx.fillText(site.value.trim(), W - pad, fy); ctx.globalAlpha = 1; }
    else if (site.value.trim()) { ctx.globalAlpha = .8; ctx.textAlign = 'center'; ctx.font = `500 ${fs - 4}px ${font.value}`; ctx.fillText(site.value.trim(), W / 2, H - 22); ctx.globalAlpha = 1; }
    s.set('title', title.value); s.set('subtitle', subtitle.value); s.set('author', author.value); s.set('site', site.value);
    s.set('c1', c1.value); s.set('c2', c2.value); s.set('angle', +angle.value); s.set('text', textColor.value); s.set('accent', accent.value); s.set('ts', ts);
  }
  for (const c of [title, subtitle, author, site, c1, c2, angle, textColor, accent, overlay, titleSize]) c.addEventListener('input', draw);
  for (const c of [bgType, align, font]) c.addEventListener('change', draw);
  render(root,
    el('div', { class: 'grid2' },
      el('div', { class: 'col' }, field('Title', title), field('Subtitle', subtitle), el('div', { class: 'row', style: { margin: 0 } }, field('Author', author), field('Site', site))),
      el('div', { class: 'col' },
        el('div', { class: 'row', style: { margin: 0 } }, field('Background', bgType), field('Colour 1', c1), field('Colour 2', c2), field('Gradient angle', angle)),
        el('div', { class: 'row', style: { margin: 0 } }, field('Text', textColor), field('Accent', accent), field('Photo darkening', overlay)),
        el('div', { class: 'row', style: { margin: 0 } }, field('Title size', titleSize), field('Align', align), field('Font', font)),
        zone)),
    stage,
    el('div', { class: 'row' },
      el('button', { class: 'btn primary', onclick: () => canvas.toBlob(b => b && download('social-card.png', b, 'image/png'), 'image/png') }, 'Download PNG'),
      el('button', { class: 'btn', onclick: () => canvas.toBlob(b => b && download('social-card.jpg', b, 'image/jpeg'), 'image/jpeg', 0.9) }, 'Download JPEG'),
      el('span', { class: 'muted small' }, '1200×630, the standard Open Graph / Twitter card size')));
  draw();
}
