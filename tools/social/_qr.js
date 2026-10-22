// Small QR encoder: byte mode, versions 1-10, error correction level M, automatic mask choice.
// qrMatrix(text) -> { size, version, get(x, y) } or throws if the text is too long (max 213 bytes at version 10).
const DATA_CW = [0, 16, 28, 44, 64, 86, 108, 124, 154, 182, 216];          // data codewords, EC level M
const ECC_PER_BLOCK = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
const BLOCKS = [null, [[1, 16]], [[1, 28]], [[1, 44]], [[2, 32]], [[2, 43]], [[4, 27]], [[4, 31]], [[2, 38], [2, 39]], [[3, 36], [2, 37]], [[4, 43], [1, 44]]];
const ALIGN = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];
export const QR_MAX_BYTES = 213;

function gfMul(x, y) { let z = 0; for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; } return z; }
function rsDivisor(deg) {
  const r = new Array(deg).fill(0); r[deg - 1] = 1; let root = 1;
  for (let i = 0; i < deg; i++) { for (let j = 0; j < deg; j++) { r[j] = gfMul(r[j], root); if (j + 1 < deg) r[j] ^= r[j + 1]; } root = gfMul(root, 2); }
  return r;
}
function rsRemainder(data, div) {
  const res = new Array(div.length).fill(0);
  for (const b of data) { const f = b ^ res.shift(); res.push(0); for (let i = 0; i < div.length; i++) res[i] ^= gfMul(div[i], f); }
  return res;
}
const bit = (x, i) => ((x >>> i) & 1) !== 0;

export function utf8(text) { return Array.from(new TextEncoder().encode(text)); }

export function qrMatrix(text) {
  const bytes = utf8(text);
  let ver = 0;
  for (let v = 1; v <= 10; v++) { if (bytes.length <= DATA_CW[v] - (v < 10 ? 2 : 3)) { ver = v; break; } }
  if (!ver) throw new Error('Text too long for a QR code (max ' + QR_MAX_BYTES + ' bytes)');
  const bits = [];
  const push = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
  push(4, 4); push(bytes.length, ver < 10 ? 8 : 16); for (const b of bytes) push(b, 8);
  const cap = DATA_CW[ver] * 8;
  push(0, Math.min(4, cap - bits.length));
  while (bits.length % 8) bits.push(0);
  for (let pad = 0xEC; bits.length < cap; pad ^= 0xEC ^ 0x11) push(pad, 8);
  const data = []; for (let i = 0; i < bits.length; i += 8) { let v = 0; for (let j = 0; j < 8; j++) v = (v << 1) | bits[i + j]; data.push(v); }
  const div = rsDivisor(ECC_PER_BLOCK[ver]); const blocks = []; let off = 0;
  for (const [n, len] of BLOCKS[ver]) for (let i = 0; i < n; i++) { const d = data.slice(off, off + len); off += len; blocks.push({ d, e: rsRemainder(d, div) }); }
  const out = []; const maxLen = Math.max(...blocks.map(b => b.d.length));
  for (let i = 0; i < maxLen; i++) for (const b of blocks) if (i < b.d.length) out.push(b.d[i]);
  for (let i = 0; i < ECC_PER_BLOCK[ver]; i++) for (const b of blocks) out.push(b.e[i]);

  const size = ver * 4 + 17;
  const mod = Array.from({ length: size }, () => new Array(size).fill(false));
  const fn = Array.from({ length: size }, () => new Array(size).fill(false));
  const setF = (x, y, d) => { mod[y][x] = d; fn[y][x] = true; };
  for (let i = 0; i < size; i++) { setF(6, i, i % 2 === 0); setF(i, 6, i % 2 === 0); }
  const finder = (cx, cy) => { for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const dist = Math.max(Math.abs(dx), Math.abs(dy)), x = cx + dx, y = cy + dy; if (x >= 0 && x < size && y >= 0 && y < size) setF(x, y, dist !== 2 && dist !== 4); } };
  finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
  const ap = ALIGN[ver], n = ap.length;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    if ((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0)) continue;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) setF(ap[i] + dx, ap[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }
  const formatBits = m => {            // EC level M = 00
    const d = m; let rem = d;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const fb = ((d << 10) | rem) ^ 0x5412;
    for (let i = 0; i <= 5; i++) setF(8, i, bit(fb, i));
    setF(8, 7, bit(fb, 6)); setF(8, 8, bit(fb, 7)); setF(7, 8, bit(fb, 8));
    for (let i = 9; i < 15; i++) setF(14 - i, 8, bit(fb, i));
    for (let i = 0; i < 8; i++) setF(size - 1 - i, 8, bit(fb, i));
    for (let i = 8; i < 15; i++) setF(8, size - 15 + i, bit(fb, i));
    setF(8, size - 8, true);
  };
  formatBits(0);
  if (ver >= 7) {
    let rem = ver; for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
    const vb = (ver << 12) | rem;
    for (let i = 0; i < 18; i++) { const b = bit(vb, i), a = size - 11 + (i % 3), c = Math.floor(i / 3); setF(a, c, b); setF(c, a, b); }
  }
  let k = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) {
      const x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - vert : vert;
      if (!fn[y][x] && k < out.length * 8) { mod[y][x] = bit(out[k >>> 3], 7 - (k & 7)); k++; }
    }
  }
  const applyMask = m => {
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      if (fn[y][x]) continue;
      let inv;
      switch (m) {
        case 0: inv = (x + y) % 2 === 0; break; case 1: inv = y % 2 === 0; break; case 2: inv = x % 3 === 0; break; case 3: inv = (x + y) % 3 === 0; break;
        case 4: inv = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break; case 5: inv = (x * y) % 2 + (x * y) % 3 === 0; break;
        case 6: inv = ((x * y) % 2 + (x * y) % 3) % 2 === 0; break; default: inv = ((x + y) % 2 + (x * y) % 3) % 2 === 0;
      }
      if (inv) mod[y][x] = !mod[y][x];
    }
  };
  const penalty = () => {
    let p = 0;
    const line = get => {
      let run = 1, prev = get(0);
      for (let i = 1; i < size; i++) { const c = get(i); if (c === prev) run++; else { if (run >= 5) p += 3 + run - 5; run = 1; prev = c; } }
      if (run >= 5) p += 3 + run - 5;
      const s = Array.from({ length: size }, (_, i) => (get(i) ? 1 : 0)).join('');
      for (const pat of ['10111010000', '00001011101']) { let at = s.indexOf(pat); while (at >= 0) { p += 40; at = s.indexOf(pat, at + 1); } }
    };
    for (let i = 0; i < size; i++) { line(j => mod[i][j]); line(j => mod[j][i]); }
    let dark = 0;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { if (mod[y][x]) dark++; if (x < size - 1 && y < size - 1 && mod[y][x] === mod[y][x + 1] && mod[y][x] === mod[y + 1][x] && mod[y][x] === mod[y + 1][x + 1]) p += 3; }
    const total = size * size; p += Math.max(0, Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
    return p;
  };
  let best = 0, bestP = Infinity;
  for (let m = 0; m < 8; m++) { applyMask(m); formatBits(m); const p = penalty(); if (p < bestP) { bestP = p; best = m; } applyMask(m); }
  applyMask(best); formatBits(best);
  return { size, version: ver, get: (x, y) => mod[y][x] };
}

/** Draw a QR onto a canvas (px per module, 4-module quiet zone). */
export function qrCanvas(text, px = 4) {
  const q = qrMatrix(text), n = q.size + 8, c = document.createElement('canvas');
  c.width = c.height = n * px; const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.fillStyle = '#000';
  for (let y = 0; y < q.size; y++) for (let x = 0; x < q.size; x++) if (q.get(x, y)) g.fillRect((x + 4) * px, (y + 4) * px, px, px);
  return c;
}
/** SVG markup string for a QR (for standalone HTML). */
export function qrSvg(text, px = 4) {
  const q = qrMatrix(text), n = q.size + 8; let d = '';
  for (let y = 0; y < q.size; y++) for (let x = 0; x < q.size; x++) if (q.get(x, y)) d += `M${x + 4} ${y + 4}h1v1h-1z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" width="${n * px}" height="${n * px}" shape-rendering="crispEdges"><rect width="${n}" height="${n}" fill="#fff"/><path d="${d}"/></svg>`;
}
