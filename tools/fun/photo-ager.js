import { el, render, dropZone, loadImage, download, toast, rng } from '../../lib/ui.js';

const MAX = 900;

export default function (root) {
  let img = null, urlToRevoke = null, level = 3, cache = [], seed = 1;
  const view = el('canvas', { style: { maxWidth: '100%', borderRadius: '8px' } });
  const orig = el('canvas', { style: { maxWidth: '100%', borderRadius: '8px' } });
  const label = el('div', { class: 'big center' });
  const slider = el('input', { type: 'range', min: 0, max: 5, step: 1, value: level, style: { width: '100%' }, oninput: e => { level = +e.target.value; show(); } });
  const strip = el('div', { class: 'row', style: { justifyContent: 'center' } });
  const work = el('div', { class: 'hidden' });
  const note = el('p', { class: 'small muted' }, 'This is a stylistic vintage effect made of filters (fading, sepia, vignette, grain, soft blur). It does not analyse your face and is not a prediction of how you will look. Your photo never leaves this page.');

  function age(src, k) {
    const w = src.width, h = src.height;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d');
    x.drawImage(src, 0, 0);
    if (k === 0) return c;
    const t = k / 5, r = rng(seed * 31 + k);
    // slight blur through down/up scaling
    const sc = 1 - 0.38 * t, tmp = document.createElement('canvas');
    tmp.width = Math.max(8, Math.round(w * sc)); tmp.height = Math.max(8, Math.round(h * sc));
    const tx = tmp.getContext('2d'); tx.imageSmoothingQuality = 'high'; tx.drawImage(c, 0, 0, tmp.width, tmp.height);
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'; x.drawImage(tmp, 0, 0, w, h);
    // colour pass
    const id = x.getImageData(0, 0, w, h), d = id.data;
    const desat = 0.65 * t, contrast = 1 + 0.22 * t, sep = 0.6 * t, fade = 26 * t, noise = 34 * t;
    for (let i = 0; i < d.length; i += 4) {
      let R = d[i], G = d[i + 1], B = d[i + 2];
      const L = 0.299 * R + 0.587 * G + 0.114 * B;
      R += (L - R) * desat; G += (L - G) * desat; B += (L - B) * desat;
      R = (R - 128) * contrast + 128; G = (G - 128) * contrast + 128; B = (B - 128) * contrast + 128;
      const sr = 0.393 * R + 0.769 * G + 0.189 * B, sg = 0.349 * R + 0.686 * G + 0.168 * B, sb = 0.272 * R + 0.534 * G + 0.131 * B;
      R += (sr - R) * sep; G += (sg - G) * sep; B += (sb - B) * sep;
      const n = (r() - 0.5) * noise;
      R = R * (1 - fade / 255) + fade + n; G = G * (1 - fade / 255) + fade * 0.92 + n; B = B * (1 - fade / 255) + fade * 0.7 + n;
      d[i] = R < 0 ? 0 : R > 255 ? 255 : R; d[i + 1] = G < 0 ? 0 : G > 255 ? 255 : G; d[i + 2] = B < 0 ? 0 : B > 255 ? 255 : B;
    }
    x.putImageData(id, 0, 0);
    // vignette
    const g = x.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.hypot(w, h) * 0.55);
    g.addColorStop(0, 'rgba(40,20,0,0)'); g.addColorStop(1, `rgba(40,20,0,${0.6 * t})`);
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    // grain specks and dust
    const specks = Math.floor(w * h / 1500 * t);
    for (let i = 0; i < specks; i++) {
      x.fillStyle = r() < 0.5 ? `rgba(255,250,235,${0.15 + r() * 0.3})` : `rgba(30,20,10,${0.1 + r() * 0.25})`;
      const s = 0.6 + r() * 1.6 * t; x.fillRect(r() * w, r() * h, s, s);
    }
    // faint scratches at higher ages
    if (k >= 3) {
      x.lineWidth = 1;
      for (let i = 0; i < (k - 2) * 4; i++) {
        x.strokeStyle = `rgba(255,255,255,${0.08 + r() * 0.15})`; const sx = r() * w, len = h * (0.1 + r() * 0.5), y0 = r() * h;
        x.beginPath(); x.moveTo(sx, y0); x.lineTo(sx + (r() - 0.5) * 8, y0 + len); x.stroke();
      }
    }
    // border-ish edge tint
    x.strokeStyle = `rgba(90,60,20,${0.25 * t})`; x.lineWidth = 10 * t; x.strokeRect(0, 0, w, h);
    return c;
  }
  function stage(k) { return cache[k] || (cache[k] = age(img, k)); }

  function paint(target, src) { target.width = src.width; target.height = src.height; target.getContext('2d').drawImage(src, 0, 0); }
  function show() {
    if (!img) return;
    label.textContent = level === 0 ? 'Today' : `+${level * 10} years`;
    paint(view, stage(level)); paint(orig, stage(0));
    [...strip.children].forEach((b, i) => b.classList.toggle('primary', i === level));
  }
  function build() {
    render(strip, [0, 1, 2, 3, 4, 5].map(k => {
      const th = document.createElement('canvas'); const s = stage(k);
      th.width = 80; th.height = Math.round(80 * s.height / s.width); th.getContext('2d').drawImage(s, 0, 0, th.width, th.height);
      return el('button', { class: 'btn small', style: { padding: '4px', display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center' }, onclick: () => { level = k; slider.value = k; show(); } }, th, el('span', { class: 'small' }, k ? '+' + k * 10 : 'now'));
    }));
  }

  async function onFiles(files) {
    const f = files.find(x => x.type.startsWith('image/')) || files[0];
    try {
      const im = await loadImage(f);
      const sc = Math.min(1, MAX / Math.max(im.naturalWidth, im.naturalHeight));
      const c = document.createElement('canvas'); c.width = Math.round(im.naturalWidth * sc); c.height = Math.round(im.naturalHeight * sc);
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      if (im.src.startsWith('blob:')) URL.revokeObjectURL(im.src);
      img = c; cache = []; seed = Math.floor(Math.random() * 1e6) + 1;
      results.classList.remove('hidden'); build(); show();
    } catch { toast('Could not read that image'); }
  }
  function sideBySide() {
    const a = stage(0), b = stage(level), c = document.createElement('canvas');
    c.width = a.width * 2 + 30; c.height = a.height + 90;
    const x = c.getContext('2d'); x.fillStyle = '#f3ecdc'; x.fillRect(0, 0, c.width, c.height);
    x.drawImage(a, 10, 10); x.drawImage(b, a.width + 20, 10);
    x.fillStyle = '#4a3b22'; x.font = '600 32px system-ui, sans-serif'; x.textAlign = 'center';
    x.fillText('Today', 10 + a.width / 2, a.height + 55); x.fillText(level ? `+${level * 10} years (stylistic)` : 'Today', a.width + 20 + a.width / 2, a.height + 55);
    return c;
  }

  const results = el('div', { class: 'hidden' },
    label, slider, strip,
    el('div', { class: 'grid2', style: { marginTop: '12px' } },
      el('div', { class: 'center' }, el('div', { class: 'small muted' }, 'Original'), orig),
      el('div', { class: 'center' }, el('div', { class: 'small muted' }, 'Aged'), view)),
    el('div', { class: 'row', style: { justifyContent: 'center' } },
      el('button', { class: 'btn primary', onclick: () => stage(level).toBlob(b => download(`aged-plus-${level * 10}.png`, b, 'image/png')) }, 'Download aged photo'),
      el('button', { class: 'btn', onclick: () => sideBySide().toBlob(b => download('before-after.png', b, 'image/png')) }, 'Download side by side'),
      el('button', { class: 'btn ghost', onclick: () => { cache = []; seed++; build(); show(); } }, 'Re-roll grain')));

  render(root, dropZone('Drop a photo here, or click to choose one', onFiles, 'image/*', false), note, results);
  return () => { img = null; cache = []; if (urlToRevoke) URL.revokeObjectURL(urlToRevoke); };
}
