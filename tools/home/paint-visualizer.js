import { el, render, store, dropZone, loadImage, download, toast } from '../../lib/ui.js';
import { input } from './_h.js';

const SWATCHES = ['#e8d9c0', '#f2efe6', '#a8c3b5', '#8fb1c9', '#d98f7a', '#c9a0b4', '#f0cf65', '#6f8f72', '#3d5a80', '#7b6b63', '#2f3a45', '#ffffff'];
const MAX = 1000;

const hex2rgb = h => { const m = /^#?([0-9a-f]{6})$/i.exec(h || ''); const n = m ? parseInt(m[1], 16) : 0xe8d9c0; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const lum = (r, g, b) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

export default function (root) {
  const s = store('paint-visualizer');
  let color = s.get('color', '#a8c3b5');
  let tol = s.get('tol', 30);
  let W = 0, H = 0, orig = null, cur = null;           // Uint8ClampedArray RGBA
  let undo = [], compare = false, split = 50;
  const view = el('canvas', { style: { maxWidth: '100%', cursor: 'crosshair' } });
  const vg = view.getContext('2d');
  const origCv = document.createElement('canvas'), curCv = document.createElement('canvas');

  const colorIn = el('input', { type: 'color', value: color, style: { width: '56px', height: '36px', padding: '0', border: '1px solid var(--line)', borderRadius: '8px', background: 'none' }, oninput: () => setColor(colorIn.value) });
  const hexIn = input({ value: color, style: { width: '90px' }, onchange: () => { if (/^#[0-9a-f]{6}$/i.test(hexIn.value.trim())) setColor(hexIn.value.trim()); else hexIn.value = color; } });
  function setColor(c) { color = c.toLowerCase(); colorIn.value = color; hexIn.value = color; s.set('color', color); }
  const tolLbl = el('span');
  const tolIn = el('input', { type: 'range', min: '1', max: '100', value: tol, oninput: () => { tol = +tolIn.value; tolLbl.textContent = tol; s.set('tol', tol); } });
  tolLbl.textContent = tol;
  const undoBtn = el('button', { class: 'btn', disabled: true, onclick: doUndo }, 'Undo');
  const resetBtn = el('button', { class: 'btn', disabled: true, onclick: () => { if (!orig) return; pushUndo(); cur.set(orig); paintView(); } }, 'Reset');
  const cmpChk = el('input', { type: 'checkbox', onchange: () => { compare = cmpChk.checked; splitIn.disabled = !compare; paintView(); } });
  const splitIn = el('input', { type: 'range', min: '0', max: '100', value: split, disabled: true, oninput: () => { split = +splitIn.value; paintView(); } });
  const dlBtn = el('button', { class: 'btn primary', disabled: true, onclick: () => curCv.toBlob(b => b && download('painted-room.png', b, 'image/png'), 'image/png') }, 'Download PNG');
  const hint = el('div', { class: 'muted small' }, 'Load a photo, choose a colour, then click a wall.');
  const stage = el('div', { class: 'canvas-wrap hidden' }, view);

  function pushUndo() { undo.push(new Uint8ClampedArray(cur)); if (undo.length > 12) undo.shift(); undoBtn.disabled = false; }
  function doUndo() { if (!undo.length) return; cur.set(undo.pop()); undoBtn.disabled = !undo.length; paintView(); }

  function paintView() {
    if (!cur) return;
    curCv.getContext('2d').putImageData(new ImageData(cur, W, H), 0, 0);
    vg.clearRect(0, 0, W, H);
    vg.drawImage(curCv, 0, 0);
    if (compare) {
      const x = Math.round(W * split / 100);
      vg.save(); vg.beginPath(); vg.rect(0, 0, x, H); vg.clip(); vg.drawImage(origCv, 0, 0); vg.restore();
      vg.strokeStyle = '#fff'; vg.lineWidth = 3; vg.beginPath(); vg.moveTo(x, 0); vg.lineTo(x, H); vg.stroke();
      vg.strokeStyle = '#000'; vg.lineWidth = 1; vg.stroke();
    }
  }

  async function loadFile(files) {
    const f = files[0];
    if (!f) return;
    try {
      const img = await loadImage(f);
      const k = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
      W = Math.max(1, Math.round(img.naturalWidth * k)); H = Math.max(1, Math.round(img.naturalHeight * k));
      origCv.width = curCv.width = view.width = W; origCv.height = curCv.height = view.height = H;
      const og = origCv.getContext('2d', { willReadFrequently: true });
      og.drawImage(img, 0, 0, W, H);
      orig = new Uint8ClampedArray(og.getImageData(0, 0, W, H).data);
      cur = new Uint8ClampedArray(orig);
      undo = []; undoBtn.disabled = true; resetBtn.disabled = false; dlBtn.disabled = false;
      stage.classList.remove('hidden');
      hint.textContent = 'Click a wall to paint it. Raise the tolerance if the fill stops too early; lower it if it leaks.';
      paintView();
    } catch { toast('Could not read that image'); }
  }

  function fill(sx, sy) {
    // reference colour: average of a 5x5 neighbourhood of the original at the seed
    let rr = 0, gg = 0, bb = 0, c = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const x = sx + dx, y = sy + dy;
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const i = (y * W + x) * 4; rr += orig[i]; gg += orig[i + 1]; bb += orig[i + 2]; c++;
    }
    rr /= c; gg /= c; bb /= c;
    const thr = tol / 100 * 180, thr2 = thr * thr;
    const dist2 = i => { const dr = orig[i] - rr, dg = orig[i + 1] - gg, db = orig[i + 2] - bb; return dr * dr + dg * dg + db * db; };
    const mask = new Uint8Array(W * H);
    const stack = [sx, sy];
    const ok = (x, y) => !mask[y * W + x] && dist2((y * W + x) * 4) <= thr2;
    while (stack.length) {
      const y = stack.pop(), x0 = stack.pop();
      if (!ok(x0, y)) continue;
      let xl = x0, xr = x0;
      while (xl > 0 && ok(xl - 1, y)) xl--;
      while (xr < W - 1 && ok(xr + 1, y)) xr++;
      for (let x = xl; x <= xr; x++) mask[y * W + x] = 1;
      for (const ny of [y - 1, y + 1]) {
        if (ny < 0 || ny >= H) continue;
        let inSpan = false;
        for (let x = xl; x <= xr; x++) {
          if (ok(x, ny)) { if (!inSpan) { stack.push(x, ny); inSpan = true; } } else inSpan = false;
        }
      }
    }
    // soften edges: include 1px neighbours that are almost within tolerance
    const grow = new Uint8Array(mask);
    const thrG2 = (thr * 1.5) * (thr * 1.5);
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const p = y * W + x;
      if (mask[p]) continue;
      if ((mask[p - 1] || mask[p + 1] || mask[p - W] || mask[p + W]) && dist2(p * 4) <= thrG2) grow[p] = 1;
    }
    let n = 0, lsum = 0;
    for (let p = 0; p < grow.length; p++) if (grow[p]) { const i = p * 4; lsum += lum(orig[i], orig[i + 1], orig[i + 2]); n++; }
    if (n < 2) { toast('Nothing to paint there. Try a higher tolerance.'); return; }
    const lref = Math.max(0.05, lsum / n);
    const [pr, pg, pb] = hex2rgb(color);
    pushUndo();
    for (let p = 0; p < grow.length; p++) {
      if (!grow[p]) continue;
      const i = p * 4;
      const shade = Math.min(1.7, Math.max(0.15, lum(orig[i], orig[i + 1], orig[i + 2]) / lref));
      cur[i] = Math.min(255, pr * shade); cur[i + 1] = Math.min(255, pg * shade); cur[i + 2] = Math.min(255, pb * shade); cur[i + 3] = 255;
    }
    paintView();
    toast(`Painted ${Math.round(n / (W * H) * 100)}% of the image`);
  }

  view.addEventListener('click', e => {
    if (!orig) return;
    const r = view.getBoundingClientRect();
    const x = Math.floor((e.clientX - r.left) * W / r.width), y = Math.floor((e.clientY - r.top) * H / r.height);
    if (x >= 0 && y >= 0 && x < W && y < H) fill(x, y);
  });

  render(root,
    dropZone('Drop a room photo here, or click to choose one', loadFile, 'image/*', false),
    el('div', { class: 'row' },
      el('label', { class: 'inline' }, 'Colour', colorIn, hexIn),
      el('div', { class: 'row', style: { margin: 0, gap: '4px' } }, SWATCHES.map(c => el('button', { title: c, style: { width: '26px', height: '26px', borderRadius: '6px', border: '1px solid var(--line)', background: c, cursor: 'pointer' }, onclick: () => setColor(c) }))),
      el('label', { class: 'inline' }, 'Tolerance', tolIn, tolLbl)),
    el('div', { class: 'row' }, undoBtn, resetBtn,
      el('label', { class: 'inline' }, cmpChk, 'Compare with original'), splitIn, dlBtn),
    hint, stage);
}
