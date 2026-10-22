// Background pattern generator: stripes, dots, checks, waves, zigzag and hexagons with colours, size and angle.
// Outputs ready-to-paste CSS and a seamless PNG tile rendered on canvas.
import { el, render, copy, download, store, field } from '../../lib/ui.js';

const TYPES = ['stripes', 'dots', 'checks', 'waves', 'zigzag', 'hex'];
const svgUrl = svg => `url("data:image/svg+xml,${encodeURIComponent(svg).replace(/'/g, '%27').replace(/\(/g, '%28').replace(/\)/g, '%29')}")`;

/** Build { css, tile(canvas) } for the current settings. */
function build({ type, fg, bg, size, angle, thickness }) {
  const S = Math.max(4, size), t = Math.max(1, Math.min(S, thickness));
  const tile = el('canvas');
  const draw = (w, h, fn) => { tile.width = Math.max(1, Math.round(w)); tile.height = Math.max(1, Math.round(h)); const ctx = tile.getContext('2d'); ctx.fillStyle = bg; ctx.fillRect(0, 0, tile.width, tile.height); fn(ctx); };
  let css;
  if (type === 'stripes') {
    const diag = angle % 90 !== 0, q = diag ? S / Math.SQRT2 : S, w = t * q / S;
    css = `background-color: ${bg};\nbackground-image: repeating-linear-gradient(${angle}deg, ${fg} 0 ${w.toFixed(2)}px, transparent ${w.toFixed(2)}px ${q.toFixed(2)}px);`;
    draw(S, S, ctx => {
      ctx.translate(S / 2, S / 2); ctx.rotate(angle * Math.PI / 180); ctx.fillStyle = fg;
      const R = S * 2;
      for (let y = -R; y < R; y += q) ctx.fillRect(-R, y, 2 * R, w);
    });
  } else if (type === 'dots') {
    const r = t / 2;
    css = `background-color: ${bg};\nbackground-image: radial-gradient(circle at center, ${fg} ${r.toFixed(2)}px, transparent ${(r + 0.5).toFixed(2)}px);\nbackground-size: ${S}px ${S}px;`;
    draw(S, S, ctx => { ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(S / 2, S / 2, r, 0, Math.PI * 2); ctx.fill(); });
  } else if (type === 'checks') {
    css = `background-color: ${bg};\nbackground-image: conic-gradient(${fg} 25%, transparent 0 50%, ${fg} 0 75%, transparent 0);\nbackground-size: ${S}px ${S}px;`;
    draw(S, S, ctx => { ctx.fillStyle = fg; ctx.fillRect(S / 2, 0, S / 2, S / 2); ctx.fillRect(0, S / 2, S / 2, S / 2); });
  } else if (type === 'waves') {
    const a = S / 4, h = S / 2;
    const d = `M0 ${h} Q ${S / 4} ${h - a} ${S / 2} ${h} T ${S} ${h}`;
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${S}' height='${S}'><path d='${d}' fill='none' stroke='${fg}' stroke-width='${t}'/></svg>`;
    css = `background-color: ${bg};\nbackground-image: ${svgUrl(svg)};\nbackground-size: ${S}px ${S}px;`;
    draw(S, S, ctx => {
      ctx.strokeStyle = fg; ctx.lineWidth = t; ctx.lineCap = 'butt';
      for (const dx of [-S, 0, S]) { ctx.beginPath(); ctx.moveTo(dx, h); ctx.quadraticCurveTo(dx + S / 4, h - a, dx + S / 2, h); ctx.quadraticCurveTo(dx + 3 * S / 4, h + a, dx + S, h); ctx.stroke(); }
    });
  } else if (type === 'zigzag') {
    const top = S * 0.25, bot = S * 0.75;
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${S}' height='${S}'><path d='M${-S / 2} ${top} L0 ${bot} L${S / 2} ${top} L${S} ${bot} L${S * 1.5} ${top}' fill='none' stroke='${fg}' stroke-width='${t}' stroke-linejoin='miter'/></svg>`;
    css = `background-color: ${bg};\nbackground-image: ${svgUrl(svg)};\nbackground-size: ${S}px ${S}px;`;
    draw(S, S, ctx => { ctx.strokeStyle = fg; ctx.lineWidth = t; ctx.lineJoin = 'miter'; ctx.beginPath(); ctx.moveTo(-S / 2, top); ctx.lineTo(0, bot); ctx.lineTo(S / 2, top); ctx.lineTo(S, bot); ctx.lineTo(S * 1.5, top); ctx.stroke(); });
  } else { // hex: pointy-top honeycomb, circumradius r; tile = sqrt(3)*r wide, 3r tall
    const r = S / 2, Wf = Math.sqrt(3) * r, W = Math.round(Wf), H = Math.round(3 * r), sx = W / Wf, sy = H / (3 * r);
    const centers = [[Wf / 2, r], [Wf / 2, 4 * r], [Wf / 2, -2 * r], [0, 2.5 * r], [Wf, 2.5 * r], [0, -0.5 * r], [Wf, -0.5 * r]];
    const hexPts = (cx, cy) => Array.from({ length: 6 }, (_, i) => { const a = Math.PI / 6 + i * Math.PI / 3; return [(cx + r * Math.cos(a)) * sx, (cy + r * Math.sin(a)) * sy]; });
    const paths = centers.map(([cx, cy]) => 'M' + hexPts(cx, cy).map(p => p.map(v => +v.toFixed(2)).join(' ')).join('L') + 'Z').join('');
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${W}' height='${H}'><path d='${paths}' fill='none' stroke='${fg}' stroke-width='${t}'/></svg>`;
    css = `background-color: ${bg};\nbackground-image: ${svgUrl(svg)};\nbackground-size: ${W}px ${H}px;`;
    draw(W, H, ctx => {
      ctx.strokeStyle = fg; ctx.lineWidth = t; ctx.lineJoin = 'round';
      for (const [cx, cy] of centers) { const pts = hexPts(cx, cy); ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.stroke(); }
    });
  }
  return { css, tile };
}

export default function (root) {
  const s = store('pattern-generator');
  const type = el('select', { class: 'select' }, TYPES.map(t => el('option', { value: t, selected: t === s.get('type', 'stripes') }, t[0].toUpperCase() + t.slice(1))));
  const fg = el('input', { type: 'color', value: s.get('fg', '#2f6fed') });
  const bg = el('input', { type: 'color', value: s.get('bg', '#ffffff') });
  const size = el('input', { type: 'range', min: 8, max: 160, value: s.get('size', 32), class: 'input' });
  const angle = el('select', { class: 'select' }, [0, 45, 90, 135].map(a => el('option', { value: a, selected: a === s.get('angle', 45) }, a + '°')));
  const thickness = el('input', { type: 'range', min: 1, max: 80, value: s.get('thickness', 10), class: 'input' });
  const scale = el('input', { type: 'range', min: 1, max: 8, value: 1, class: 'input' });
  const preview = el('div', { style: { height: '240px', borderRadius: '10px', border: '1px solid var(--line)' } });
  const tileWrap = el('div', { class: 'row', style: { alignItems: 'center' } });
  const css = el('pre', { class: 'out' });
  let current = null;

  function update() {
    const opts = { type: type.value, fg: fg.value, bg: bg.value, size: +size.value, angle: +angle.value, thickness: +thickness.value };
    for (const [k, v] of Object.entries(opts)) s.set(k, v);
    current = build(opts);
    preview.style.cssText = 'height:240px;border-radius:10px;border:1px solid var(--line);' + current.css.replace(/\n/g, '');
    css.textContent = `.pattern {\n  ${current.css.replace(/\n/g, '\n  ')}\n}`;
    const t = current.tile; t.style.cssText = 'image-rendering:pixelated;border:1px solid var(--line);max-width:100%';
    const sc = +scale.value; t.style.width = t.width * sc + 'px'; t.style.height = t.height * sc + 'px';
    render(tileWrap, el('span', { class: 'muted small' }, `Seamless tile ${t.width}×${t.height}px (shown at ${sc}x):`), t);
    angle.parentElement.classList.toggle('hidden', type.value !== 'stripes');
  }
  function downloadTile() {
    const t = current.tile, sc = +scale.value;
    const out = el('canvas'); out.width = t.width * sc; out.height = t.height * sc;
    const ctx = out.getContext('2d'); ctx.imageSmoothingEnabled = sc === 1; ctx.drawImage(t, 0, 0, out.width, out.height);
    out.toBlob(b => b && download(`pattern-${type.value}-${out.width}x${out.height}.png`, b, 'image/png'), 'image/png');
  }
  for (const c of [fg, bg, size, thickness, scale]) c.addEventListener('input', update);
  for (const c of [type, angle]) c.addEventListener('change', update);
  render(root,
    el('div', { class: 'row' }, field('Pattern', type), field('Foreground', fg), field('Background', bg), field('Size', size), field('Angle', angle), field('Thickness / dot size', thickness)),
    preview, tileWrap, css,
    el('div', { class: 'row' },
      el('button', { class: 'btn primary', onclick: () => copy(css.textContent) }, 'Copy CSS'),
      el('button', { class: 'btn', onclick: downloadTile }, 'Download PNG tile'),
      field('PNG scale', scale)),
    el('p', { class: 'muted small' }, 'The CSS uses gradients or an inline SVG so it stays crisp at any zoom. The PNG tile repeats seamlessly; set a larger scale for high-DPI use.'));
  update();
}
