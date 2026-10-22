import { el, render, store, copy, dropZone, readFile, fmtBytes } from '../../lib/ui.js';

// Pure JS MD5 over a Uint8Array. Returns a 16-byte Uint8Array.
const S = [7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
  4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21];
const K = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) >>> 0);
export function md5(bytes) {
  const len = bytes.length;
  const total = (((len + 8) >>> 6) + 1) << 6;
  const buf = new Uint8Array(total);
  buf.set(bytes);
  buf[len] = 0x80;
  const dv = new DataView(buf.buffer);
  dv.setUint32(total - 8, (len << 3) >>> 0, true);
  dv.setUint32(total - 4, Math.floor(len / 0x20000000), true);
  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
  const M = new Uint32Array(16);
  for (let off = 0; off < total; off += 64) {
    for (let i = 0; i < 16; i++) M[i] = dv.getUint32(off + i * 4, true);
    let A = a0, B = b0, C = c0, D = d0;
    for (let i = 0; i < 64; i++) {
      let F, g;
      if (i < 16) { F = (B & C) | (~B & D); g = i; }
      else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) & 15; }
      else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) & 15; }
      else { F = C ^ (B | ~D); g = (7 * i) & 15; }
      F = (F + A + K[i] + M[g]) >>> 0;
      A = D; D = C; C = B;
      B = (B + ((F << S[i]) | (F >>> (32 - S[i])))) >>> 0;
    }
    a0 = (a0 + A) >>> 0; b0 = (b0 + B) >>> 0; c0 = (c0 + C) >>> 0; d0 = (d0 + D) >>> 0;
  }
  const out = new Uint8Array(16);
  const odv = new DataView(out.buffer);
  [a0, b0, c0, d0].forEach((v, i) => odv.setUint32(i * 4, v, true));
  return out;
}

const ALGOS = [['MD5', null], ['SHA-1', 'SHA-1'], ['SHA-256', 'SHA-256'], ['SHA-384', 'SHA-384'], ['SHA-512', 'SHA-512']];
const toHex = u8 => [...u8].map(b => b.toString(16).padStart(2, '0')).join('');
const toB64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };

async function digestAll(bytes) {
  const res = {};
  for (const [name, sub] of ALGOS) {
    try {
      res[name] = sub ? new Uint8Array(await crypto.subtle.digest(sub, bytes)) : md5(bytes);
    } catch (e) { res[name] = null; }
  }
  return res;
}

export default function (root) {
  const s = store('hash-calculator');
  let fmt = s.get('fmt', 'hex');
  let upper = s.get('upper', false);
  let source = { kind: 'text' };      // or {kind:'file', name, size, bytes}
  let digests = null;
  let token = 0;

  const ta = el('textarea', { class: 'textarea', placeholder: 'Type or paste text to hash…', value: s.get('text', '') });
  const fileInfo = el('div', { class: 'small muted' });
  const results = el('div', { class: 'col' });
  const fmtSel = el('select', { class: 'select', onchange: () => { fmt = fmtSel.value; s.set('fmt', fmt); draw(); } },
    el('option', { value: 'hex' }, 'Hex'), el('option', { value: 'base64' }, 'Base64'));
  fmtSel.value = fmt;
  const upperChk = el('input', { type: 'checkbox', checked: upper, onchange: () => { upper = upperChk.checked; s.set('upper', upper); draw(); } });
  const compare = el('input', { class: 'input mono grow', placeholder: 'Paste a hash here to compare…', style: { minWidth: '220px' }, oninput: draw });

  function fmtValue(u8) {
    if (!u8) return 'unsupported in this browser';
    if (fmt === 'base64') return toB64(u8);
    const h = toHex(u8);
    return upper ? h.toUpperCase() : h;
  }
  function draw() {
    if (!digests) { render(results, el('div', { class: 'muted' }, 'Calculating…')); return; }
    const cmp = compare.value.trim().replace(/\s+/g, '');
    render(results, ALGOS.map(([name]) => {
      const v = fmtValue(digests[name]);
      const match = cmp && digests[name] && (cmp.toLowerCase() === toHex(digests[name]) || cmp === toB64(digests[name]));
      return el('div', { class: 'panel' },
        el('div', { class: 'row', style: { margin: 0 } },
          el('strong', {}, name),
          match ? el('span', { class: 'badge ok' }, 'matches') : null,
          el('span', { class: 'grow' }),
          el('button', { class: 'btn small', onclick: () => copy(v) }, 'Copy')),
        el('div', { class: 'mono small', style: { wordBreak: 'break-all', marginTop: '6px' } }, v));
    }));
  }
  async function run() {
    const my = ++token;
    digests = null; draw();
    const bytes = source.kind === 'file' ? source.bytes : new TextEncoder().encode(ta.value);
    const d = await digestAll(bytes);
    if (my !== token) return;
    digests = d; draw();
  }
  function setText() {
    source = { kind: 'text' };
    render(fileInfo, 'Hashing the text above (UTF-8).');
    s.set('text', ta.value);
    run();
  }
  ta.addEventListener('input', setText);

  async function onFiles(files) {
    const f = files[0];
    render(fileInfo, `Reading ${f.name}…`);
    try {
      const bytes = new Uint8Array(await readFile(f, 'arrayBuffer'));
      source = { kind: 'file', name: f.name, size: f.size, bytes };
      render(fileInfo, el('span', {}, 'Hashing file: ', el('strong', {}, f.name), ` (${fmtBytes(f.size)}) `),
        el('button', { class: 'btn small ghost', onclick: setText }, 'Back to text'));
      run();
    } catch (e) { render(fileInfo, 'Could not read that file.'); }
  }

  render(root,
    ta,
    dropZone('Drop a file here (or click) to hash it instead', onFiles, '', false),
    fileInfo,
    el('div', { class: 'row' },
      el('label', { class: 'field' }, 'Output', fmtSel),
      el('label', { class: 'inline' }, upperChk, 'Uppercase hex'),
      compare),
    results);
  setText();
}
