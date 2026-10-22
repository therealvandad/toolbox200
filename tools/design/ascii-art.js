// Image to ASCII art with colour preview.
import { el, render, download, dropZone, field, toast, copy, loadImage } from '../../lib/ui.js';

const CHARSETS = {
  standard: ' .:-=+*#%@',
  detailed: ' .\'`^",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$',
  blocks: ' ░▒▓█',
  binary: ' 01',
  letters: ' abcdefghijklmnopqrstuvwxyz',
};

export default function (root) {
  let img = null, lines = [], colors = [];
  const width = el('input', { type: 'range', min: 20, max: 200, value: 80, class: 'input' });
  const wLabel = el('span', { class: 'mono small' }, '80');
  const charset = el('select', { class: 'select' }, Object.keys(CHARSETS).map(k => el('option', { value: k }, k)));
  const invert = el('input', { type: 'checkbox' });
  const colored = el('input', { type: 'checkbox' });
  const pre = el('pre', { class: 'out mono', style: { lineHeight: '1', fontSize: '10px', letterSpacing: '0', whiteSpace: 'pre' } }, 'Drop an image to convert.');
  const fontSize = el('input', { type: 'range', min: 4, max: 20, value: 10, class: 'input' });

  function convert() {
    if (!img) return;
    const cols = +width.value; wLabel.textContent = cols;
    const rows = Math.max(1, Math.round(img.naturalHeight / img.naturalWidth * cols * 0.5));
    const c = el('canvas'); c.width = cols; c.height = rows;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0, cols, rows);
    const d = ctx.getImageData(0, 0, cols, rows).data;
    let chars = CHARSETS[charset.value];
    if (invert.checked) chars = [...chars].reverse().join('');
    lines = []; colors = [];
    for (let y = 0; y < rows; y++) {
      let line = ''; const row = [];
      for (let x = 0; x < cols; x++) {
        const i = (y * cols + x) * 4;
        const r = d[i], g = d[i + 1], b = d[i + 2], a = d[i + 3] / 255;
        const lum = (0.299 * r + 0.587 * g + 0.114 * b) * a + 255 * (1 - a);
        const idx = Math.min(chars.length - 1, Math.round((255 - lum) / 255 * (chars.length - 1)));
        const ch = [...chars][idx];
        line += ch; row.push(`rgb(${r},${g},${b})`);
      }
      lines.push(line); colors.push(row);
    }
    show();
  }
  function show() {
    pre.style.fontSize = fontSize.value + 'px';
    if (!colored.checked) { pre.textContent = lines.join('\n'); return; }
    const frag = document.createDocumentFragment();
    lines.forEach((line, y) => {
      const chars = [...line];
      let i = 0;
      while (i < chars.length) {
        let j = i; while (j < chars.length && colors[y][j] === colors[y][i]) j++;
        frag.append(el('span', { style: { color: colors[y][i] } }, chars.slice(i, j).join('')));
        i = j;
      }
      frag.append('\n');
    });
    pre.replaceChildren(frag);
  }
  function downloadPng() {
    if (!lines.length) return;
    const fs = 12, cw = fs * 0.6, ch = fs;
    const c = el('canvas'); c.width = Math.ceil(lines[0].length * cw); c.height = lines.length * ch;
    const ctx = c.getContext('2d');
    ctx.fillStyle = invert.checked ? '#111' : '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.font = `${fs}px ui-monospace, Consolas, monospace`; ctx.textBaseline = 'top';
    lines.forEach((line, y) => [...line].forEach((chr, x) => {
      ctx.fillStyle = colored.checked ? colors[y][x] : (invert.checked ? '#eee' : '#111');
      ctx.fillText(chr, x * cw, y * ch);
    }));
    c.toBlob(b => b && download('ascii-art.png', b, 'image/png'), 'image/png');
  }
  const zone = dropZone('Drop an image here or click to choose', async files => {
    try { img = await loadImage(files[0]); convert(); } catch { toast('Could not load image'); }
  }, 'image/*', false);
  width.addEventListener('input', convert); charset.addEventListener('change', convert); invert.addEventListener('change', convert);
  colored.addEventListener('change', show); fontSize.addEventListener('input', show);
  render(root,
    zone,
    el('div', { class: 'row' },
      field('Width (chars)', el('div', { class: 'row', style: { margin: 0 } }, width, wLabel)),
      field('Charset', charset),
      field('Preview size', fontSize),
      el('label', { class: 'inline' }, invert, 'Invert'),
      el('label', { class: 'inline' }, colored, 'Colour preview')),
    el('div', { class: 'scroll-x' }, pre),
    el('div', { class: 'row' },
      el('button', { class: 'btn primary', onclick: () => lines.length ? copy(lines.join('\n')) : toast('Nothing to copy') }, 'Copy text'),
      el('button', { class: 'btn', onclick: () => lines.length && download('ascii-art.txt', lines.join('\n')) }, 'Download .txt'),
      el('button', { class: 'btn', onclick: downloadPng }, 'Download PNG')));
}
