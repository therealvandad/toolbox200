// Minimal QR Code encoder: byte mode, versions 1-10, error correction level M.
// qrEncode(text) -> { size, version, modules: boolean[][] } (throws if text is too long)

// version -> [ec codewords per block, [[blockCount, dataCodewordsPerBlock], ...]]
const EC_M = {
  1: [10, [[1, 16]]], 2: [16, [[1, 28]]], 3: [26, [[1, 44]]], 4: [18, [[2, 32]]], 5: [24, [[2, 43]]],
  6: [16, [[4, 27]]], 7: [18, [[4, 31]]], 8: [22, [[2, 38], [2, 39]]], 9: [22, [[3, 36], [2, 37]]], 10: [26, [[4, 43], [1, 44]]],
};
const ALIGN = { 1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50] };

// GF(256) arithmetic, primitive polynomial 0x11D
const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
(() => { let x = 1; for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11d; } for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]; })();
const mul = (a, b) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);

function rsGenerator(n) {
  let g = [1];
  for (let i = 0; i < n; i++) {
    const ng = new Array(g.length + 1).fill(0);
    for (let j = 0; j < g.length; j++) { ng[j] ^= g[j]; ng[j + 1] ^= mul(g[j], EXP[i]); }
    g = ng;
  }
  return g;
}
function rsRemainder(data, n) {
  const g = rsGenerator(n), res = new Array(n).fill(0);
  for (const b of data) {
    const f = b ^ res.shift();
    res.push(0);
    if (f) for (let i = 0; i < n; i++) res[i] ^= mul(g[i + 1], f);
  }
  return res;
}

function dataCapacity(v) { return EC_M[v][1].reduce((a, [c, d]) => a + c * d, 0); }
export function maxBytes(v = 10) { return Math.floor((dataCapacity(v) * 8 - 4 - (v < 10 ? 8 : 16)) / 8); }

export function qrEncode(text) {
  const bytes = Array.from(new TextEncoder().encode(text));
  let version = 0;
  for (let v = 1; v <= 10; v++) if (bytes.length <= maxBytes(v)) { version = v; break; }
  if (!version) throw new Error('Text too long for QR version 10-M (max ' + maxBytes(10) + ' bytes)');

  // ---- bit stream ----
  const bits = [];
  const put = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
  put(0b0100, 4);
  put(bytes.length, version < 10 ? 8 : 16);
  bytes.forEach(b => put(b, 8));
  const capBits = dataCapacity(version) * 8;
  for (let i = 0; i < 4 && bits.length < capBits; i++) bits.push(0);
  while (bits.length % 8) bits.push(0);
  const data = [];
  for (let i = 0; i < bits.length; i += 8) { let b = 0; for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j]; data.push(b); }
  for (let pad = 0xEC; data.length < dataCapacity(version); pad ^= 0xEC ^ 0x11) data.push(pad);

  // ---- split into blocks, add EC, interleave ----
  const [ecLen, groups] = EC_M[version];
  const dBlocks = [], eBlocks = [];
  let pos = 0;
  for (const [count, len] of groups) {
    for (let i = 0; i < count; i++) {
      const blk = data.slice(pos, pos + len); pos += len;
      dBlocks.push(blk); eBlocks.push(rsRemainder(blk, ecLen));
    }
  }
  const out = [];
  const maxLen = Math.max(...dBlocks.map(b => b.length));
  for (let i = 0; i < maxLen; i++) dBlocks.forEach(b => { if (i < b.length) out.push(b[i]); });
  for (let i = 0; i < ecLen; i++) eBlocks.forEach(b => out.push(b[i]));

  // ---- matrix ----
  const size = 17 + 4 * version;
  const mod = Array.from({ length: size }, () => new Array(size).fill(false));
  const fn = Array.from({ length: size }, () => new Array(size).fill(false));
  const setFn = (x, y, dark) => { if (x >= 0 && y >= 0 && x < size && y < size) { mod[y][x] = dark; fn[y][x] = true; } };

  for (let i = 0; i < size; i++) { setFn(6, i, i % 2 === 0); setFn(i, 6, i % 2 === 0); }
  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const d = Math.max(Math.abs(dx), Math.abs(dy));
      setFn(cx + dx, cy + dy, d !== 2 && d !== 4);
    }
  }
  const ap = ALIGN[version];
  for (let i = 0; i < ap.length; i++) for (let j = 0; j < ap.length; j++) {
    if ((i === 0 && j === 0) || (i === 0 && j === ap.length - 1) || (i === ap.length - 1 && j === 0)) continue;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) setFn(ap[i] + dx, ap[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }
  const drawFormat = mask => {
    const d = (0 << 3) | mask; // EC level M = 00
    let rem = d;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const fb = ((d << 10) | rem) ^ 0x5412;
    const bit = i => ((fb >>> i) & 1) !== 0;
    for (let i = 0; i <= 5; i++) setFn(8, i, bit(i));
    setFn(8, 7, bit(6)); setFn(8, 8, bit(7)); setFn(7, 8, bit(8));
    for (let i = 9; i < 15; i++) setFn(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) setFn(size - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) setFn(8, size - 15 + i, bit(i));
    setFn(8, size - 8, true);
  };
  drawFormat(0); // reserve area
  if (version >= 7) {
    let rem = version;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
    const vb = (version << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const dark = ((vb >>> i) & 1) !== 0, a = size - 11 + (i % 3), b = Math.floor(i / 3);
      setFn(a, b, dark); setFn(b, a, dark);
    }
  }

  // ---- place data bits ----
  let bi = 0;
  const total = out.length * 8;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j, upward = ((right + 1) & 2) === 0, y = upward ? size - 1 - vert : vert;
        if (!fn[y][x] && bi < total) { mod[y][x] = ((out[bi >>> 3] >>> (7 - (bi & 7))) & 1) !== 0; bi++; }
      }
    }
  }

  // ---- masking ----
  const MASKS = [
    (x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x, y) => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
    (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0, (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
  ];
  const applyMask = m => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y][x] && MASKS[m](x, y)) mod[y][x] = !mod[y][x]; };
  const penalty = () => {
    let p = 0;
    const lineRuns = get => {
      for (let a = 0; a < size; a++) {
        let run = 1;
        for (let b = 1; b < size; b++) {
          if (get(a, b) === get(a, b - 1)) run++;
          else { if (run >= 5) p += 3 + run - 5; run = 1; }
        }
        if (run >= 5) p += 3 + run - 5;
        // finder-like patterns
        for (let b = 0; b + 11 <= size; b++) {
          const w = [];
          for (let k = 0; k < 11; k++) w.push(get(a, b + k) ? 1 : 0);
          const s = w.join('');
          if (s === '10111010000' || s === '00001011101') p += 40;
        }
      }
    };
    lineRuns((y, x) => mod[y][x]);
    lineRuns((x, y) => mod[y][x]);
    for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) {
      const c = mod[y][x];
      if (c === mod[y][x + 1] && c === mod[y + 1][x] && c === mod[y + 1][x + 1]) p += 3;
    }
    let dark = 0;
    mod.forEach(r => r.forEach(c => { if (c) dark++; }));
    const tot = size * size;
    p += (Math.ceil(Math.abs(dark * 20 - tot * 10) / tot) - 1) * 10;
    return p;
  };
  let best = 0, bestP = Infinity;
  for (let m = 0; m < 8; m++) {
    applyMask(m); drawFormat(m);
    const p = penalty();
    if (p < bestP) { bestP = p; best = m; }
    applyMask(m);
  }
  applyMask(best); drawFormat(best);
  return { size, version, modules: mod };
}

/** Draw a QR code on a canvas. Returns false if the text is too long. */
export function drawQR(canvas, text, scale = 4, margin = 4, dark = '#000', light = '#fff') {
  let qr;
  try { qr = qrEncode(text); } catch { return false; }
  const px = (qr.size + margin * 2) * scale;
  canvas.width = px; canvas.height = px;
  const g = canvas.getContext('2d');
  g.fillStyle = light; g.fillRect(0, 0, px, px);
  g.fillStyle = dark;
  for (let y = 0; y < qr.size; y++) for (let x = 0; x < qr.size; x++) if (qr.modules[y][x]) g.fillRect((x + margin) * scale, (y + margin) * scale, scale, scale);
  return true;
}
