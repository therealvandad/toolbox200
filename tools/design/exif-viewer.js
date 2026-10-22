// EXIF viewer and stripper: a small JPEG/TIFF EXIF parser plus a canvas re-encode that drops all metadata.
import { el, render, download, dropZone, field, toast, loadImage, readFile, fmtBytes } from '../../lib/ui.js';

const NAMES = {
  ifd0: { 0x010F: 'Make', 0x0110: 'Model', 0x0112: 'Orientation', 0x0131: 'Software', 0x0132: 'Date modified', 0x013B: 'Artist', 0x8298: 'Copyright', 0x011A: 'X resolution', 0x011B: 'Y resolution', 0x010E: 'Description' },
  exif: { 0x9003: 'Date taken', 0x9004: 'Date digitized', 0x829A: 'Exposure time', 0x829D: 'F-number', 0x8827: 'ISO', 0x920A: 'Focal length', 0xA405: 'Focal length (35mm)', 0x9204: 'Exposure bias', 0x9209: 'Flash', 0xA434: 'Lens model', 0xA433: 'Lens make', 0xA002: 'Image width', 0xA003: 'Image height', 0xA403: 'White balance', 0x8822: 'Exposure program', 0x9207: 'Metering mode', 0xA402: 'Exposure mode', 0x9000: 'EXIF version', 0xA420: 'Image unique ID', 0x927C: 'Maker note', 0x9286: 'User comment' },
  gps: { 1: 'Latitude ref', 2: 'Latitude', 3: 'Longitude ref', 4: 'Longitude', 5: 'Altitude ref', 6: 'Altitude', 7: 'GPS time', 29: 'GPS date', 18: 'Map datum', 16: 'Image direction ref', 17: 'Image direction' },
};
const PROGRAMS = ['Not defined', 'Manual', 'Program', 'Aperture priority', 'Shutter priority', 'Creative', 'Action', 'Portrait', 'Landscape'];
const METERING = ['Unknown', 'Average', 'Center-weighted', 'Spot', 'Multi-spot', 'Pattern', 'Partial'];
const ORIENT = { 1: 'Normal', 2: 'Mirrored', 3: 'Rotated 180°', 4: 'Flipped vertically', 5: 'Mirrored + 90° CCW', 6: 'Rotated 90° CW', 7: 'Mirrored + 90° CW', 8: 'Rotated 90° CCW' };

/** Returns { ifd0:{tag:val}, exif:{}, gps:{} } or null if no EXIF; throws on non-JPEG. */
function parseExif(buf) {
  const dv = new DataView(buf);
  if (dv.byteLength < 4 || dv.getUint16(0) !== 0xFFD8) throw new Error('Not a JPEG file');
  let off = 2;
  while (off + 4 <= dv.byteLength) {
    const marker = dv.getUint16(off);
    if ((marker & 0xFF00) !== 0xFF00 || marker === 0xFFDA || marker === 0xFFD9) break;
    const len = dv.getUint16(off + 2);
    if (marker === 0xFFE1 && off + 10 <= dv.byteLength && dv.getUint32(off + 4) === 0x45786966) return parseTiff(dv, off + 10, off + 2 + len);
    off += 2 + len;
  }
  return null;
}
function parseTiff(dv, start, end) {
  const le = dv.getUint16(start) === 0x4949;
  const g16 = o => dv.getUint16(start + o, le), g32 = o => dv.getUint32(start + o, le), gs32 = o => dv.getInt32(start + o, le);
  if (g16(2) !== 0x2A) return null;
  const out = { ifd0: {}, exif: {}, gps: {} };
  const SIZES = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8 };
  function readIFD(ofs, bucket) {
    if (start + ofs + 2 > end) return;
    const n = g16(ofs);
    for (let i = 0; i < n; i++) {
      const e = ofs + 2 + i * 12;
      if (start + e + 12 > end) return;
      const tag = g16(e), type = g16(e + 2), count = g32(e + 4);
      const sz = (SIZES[type] || 1) * count;
      const vo = sz > 4 ? g32(e + 8) : e + 8;
      if (start + vo + sz > end || sz > 1e6) continue;
      let val;
      try {
        if (type === 2) { let str = ''; for (let k = 0; k < count; k++) { const ch = dv.getUint8(start + vo + k); if (!ch) break; str += String.fromCharCode(ch); } val = str.trim(); }
        else if (type === 3) val = Array.from({ length: count }, (_, k) => g16(vo + 2 * k));
        else if (type === 4) val = Array.from({ length: count }, (_, k) => g32(vo + 4 * k));
        else if (type === 9) val = Array.from({ length: count }, (_, k) => gs32(vo + 4 * k));
        else if (type === 5) val = Array.from({ length: count }, (_, k) => [g32(vo + 8 * k), g32(vo + 8 * k + 4)]);
        else if (type === 10) val = Array.from({ length: count }, (_, k) => [gs32(vo + 8 * k), gs32(vo + 8 * k + 4)]);
        else if (type === 1 || type === 7 || type === 6) val = count <= 8 ? Array.from({ length: count }, (_, k) => dv.getUint8(start + vo + k)) : `${count} bytes`;
        else continue;
      } catch { continue; }
      if (Array.isArray(val) && val.length === 1) val = val[0];
      if (tag === 0x8769 && bucket === 'ifd0') readIFD(val, 'exif');
      else if (tag === 0x8825 && bucket === 'ifd0') readIFD(val, 'gps');
      else out[bucket][tag] = val;
    }
  }
  readIFD(g32(4), 'ifd0');
  return out;
}
const rat = v => Array.isArray(v) && v.length === 2 && typeof v[0] === 'number' ? (v[1] ? v[0] / v[1] : 0) : NaN;
function fmtVal(bucket, tag, v) {
  if (bucket === 'exif') {
    if (tag === 0x829A) { const x = rat(v); return x >= 1 ? `${x} s` : x > 0 ? `1/${Math.round(1 / x)} s` : String(v); }
    if (tag === 0x829D) return 'f/' + rat(v).toFixed(1);
    if (tag === 0x920A || tag === 0xA405) return rat(v).toFixed(1).replace(/\.0$/, '') + ' mm';
    if (tag === 0x9204) { const x = rat(v); return (x > 0 ? '+' : '') + x.toFixed(2) + ' EV'; }
    if (tag === 0x9209) return (v & 1) ? 'Fired' : 'Did not fire';
    if (tag === 0xA403) return v === 0 ? 'Auto' : 'Manual';
    if (tag === 0x8822) return PROGRAMS[v] || String(v);
    if (tag === 0x9207) return METERING[v] || String(v);
    if (tag === 0x9000 && Array.isArray(v)) return String.fromCharCode(...v);
  }
  if (bucket === 'ifd0' && tag === 0x0112) return ORIENT[v] || String(v);
  if (bucket === 'gps' && (tag === 2 || tag === 4) && Array.isArray(v) && v.length === 3) return `${rat(v[0])}° ${rat(v[1])}' ${rat(v[2]).toFixed(2)}"`;
  if (bucket === 'gps' && tag === 6) return rat(v).toFixed(1) + ' m';
  if (bucket === 'gps' && tag === 7 && Array.isArray(v)) return v.map(x => String(Math.round(rat(x))).padStart(2, '0')).join(':');
  if (Array.isArray(v) && Array.isArray(v[0])) return v.map(x => x[1] ? (x[0] / x[1]).toFixed(3).replace(/\.?0+$/, '') : '0').join(', ');
  if (Array.isArray(v)) return v.length > 16 ? v.length + ' values' : v.join(', ');
  return String(v);
}
function dms(v, ref) { if (!Array.isArray(v) || v.length !== 3) return null; const d = rat(v[0]) + rat(v[1]) / 60 + rat(v[2]) / 3600; return (ref === 'S' || ref === 'W') ? -d : d; }

export default function (root) {
  let file = null, img = null;
  const summary = el('div', { class: 'row' });
  const table = el('div');
  const info = el('div', { class: 'muted small' });
  const fmt = el('select', { class: 'select' }, el('option', { value: 'image/jpeg' }, 'JPEG'), el('option', { value: 'image/png' }, 'PNG'));
  const quality = el('input', { type: 'range', min: 50, max: 100, value: 92, class: 'input' });
  const stripBtn = el('button', { class: 'btn primary', onclick: strip, disabled: true }, 'Download clean copy (metadata removed)');
  const preview = el('img', { style: { maxWidth: '240px', maxHeight: '240px', borderRadius: '6px', border: '1px solid var(--line)' } });
  const previewBox = el('div', { class: 'row hidden' }, preview);

  function row(label, value) { return el('tr', {}, el('td', { class: 'muted', style: { whiteSpace: 'nowrap' } }, label), el('td', { class: 'mono', style: { wordBreak: 'break-word' } }, value)); }
  function show(exif) {
    summary.replaceChildren(); table.replaceChildren();
    if (!exif) { render(summary, el('span', { class: 'badge ok' }, 'No EXIF metadata found')); return; }
    const d = exif.ifd0, x = exif.exif, g = exif.gps;
    const chips = [];
    if (d[0x010F] || d[0x0110]) chips.push(el('span', { class: 'badge' }, [d[0x010F], d[0x0110]].filter(Boolean).join(' ')));
    if (x[0x9003]) chips.push(el('span', { class: 'badge' }, String(x[0x9003])));
    if (x[0x829A]) chips.push(el('span', { class: 'badge' }, fmtVal('exif', 0x829A, x[0x829A])));
    if (x[0x829D]) chips.push(el('span', { class: 'badge' }, fmtVal('exif', 0x829D, x[0x829D])));
    if (x[0x8827]) chips.push(el('span', { class: 'badge' }, 'ISO ' + x[0x8827]));
    if (x[0x920A]) chips.push(el('span', { class: 'badge' }, fmtVal('exif', 0x920A, x[0x920A])));
    const lat = dms(g[2], g[1]), lon = dms(g[4], g[3]);
    if (lat != null && lon != null) chips.push(el('span', { class: 'badge warn' }, 'Contains GPS location'));
    render(summary, chips.length ? chips : el('span', { class: 'badge' }, 'EXIF present (no camera summary)'));
    const sections = [];
    for (const [bucket, title] of [['ifd0', 'Image'], ['exif', 'Camera'], ['gps', 'GPS']]) {
      const rows = Object.entries(exif[bucket]).map(([t, v]) => { const tag = +t; return row(NAMES[bucket][tag] || `Tag 0x${tag.toString(16).toUpperCase().padStart(4, '0')}`, fmtVal(bucket, tag, v)); });
      if (bucket === 'gps' && lat != null && lon != null) rows.unshift(row('Decimal', el('span', {}, `${lat.toFixed(6)}, ${lon.toFixed(6)} `, el('a', { href: `https://www.openstreetmap.org/?mlat=${lat.toFixed(6)}&mlon=${lon.toFixed(6)}#map=15/${lat.toFixed(6)}/${lon.toFixed(6)}`, target: '_blank', rel: 'noopener' }, 'open map'))));
      if (rows.length) sections.push(el('h3', { style: { margin: '14px 0 4px', fontSize: '15px' } }, title), el('table', { class: 'table' }, el('tbody', {}, rows)));
    }
    render(table, sections);
  }
  async function load(f) {
    file = f; img = null; stripBtn.disabled = true; previewBox.classList.add('hidden');
    info.textContent = `${f.name} · ${fmtBytes(f.size)}`;
    try { img = await loadImage(f); preview.src = img.src; previewBox.classList.remove('hidden'); } catch { toast('Could not decode image'); }
    try {
      const buf = await readFile(f, 'arrayBuffer');
      show(parseExif(buf));
    } catch (e) { render(summary, el('span', { class: 'badge warn' }, e.message + ' — only JPEG EXIF can be read, but any image can still be stripped')); table.replaceChildren(); }
    stripBtn.disabled = !img;
  }
  function strip() {
    if (!img) return;
    const c = el('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const ctx = c.getContext('2d');
    if (fmt.value === 'image/jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); }
    ctx.drawImage(img, 0, 0);
    c.toBlob(async b => {
      if (!b) { toast('Export failed'); return; }
      const ext = fmt.value === 'image/png' ? 'png' : 'jpg';
      download(file.name.replace(/\.[^.]+$/, '') + '-clean.' + ext, b, fmt.value);
      let note = '';
      if (fmt.value === 'image/jpeg') { try { note = parseExif(await b.arrayBuffer()) ? ' (warning: EXIF still present)' : ' · verified: no EXIF in output'; } catch {} }
      toast(`Saved ${fmtBytes(b.size)}${note}`, 3000);
    }, fmt.value, quality.value / 100);
  }
  const zone = dropZone('Drop a JPEG here or click to choose', files => load(files[0]), 'image/*', false);
  render(root,
    zone, info, previewBox, summary, table,
    el('div', { class: 'row', style: { marginTop: '16px' } }, field('Output', fmt), field('JPEG quality', quality), stripBtn),
    el('p', { class: 'muted small' }, 'Everything happens in your browser. The clean copy is re-encoded from pixels, so EXIF, GPS, thumbnails and colour profiles are all dropped. Rotation from the orientation tag is baked into the pixels.'));
}
