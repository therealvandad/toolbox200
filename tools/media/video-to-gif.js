// Video to GIF: pick a range, frame rate and width, grab frames onto a canvas and encode a GIF89a
// in plain JS (median-cut global palette, optional dithering, LZW).
import { el, render, dropZone, download, field, fmtBytes, toast } from '../../lib/ui.js';

// ---------- palette ----------
function medianCut(samples, count = 256) {
  // samples: Uint8Array of rgb triplets
  const n = samples.length / 3;
  const idx = new Uint32Array(n); for (let i = 0; i < n; i++) idx[i] = i;
  const boxes = [{ idx, lo: [0, 0, 0], hi: [255, 255, 255] }];
  const measure = b => {
    const lo = [255, 255, 255], hi = [0, 0, 0];
    for (let i = 0; i < b.idx.length; i++) { const o = b.idx[i] * 3; for (let c = 0; c < 3; c++) { const v = samples[o + c]; if (v < lo[c]) lo[c] = v; if (v > hi[c]) hi[c] = v; } }
    b.lo = lo; b.hi = hi; b.range = Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]);
  };
  measure(boxes[0]);
  while (boxes.length < count) {
    let best = -1, bestScore = 0;
    for (let i = 0; i < boxes.length; i++) { const b = boxes[i]; if (b.idx.length < 2 || b.range === 0) continue; const sc = b.range * Math.sqrt(b.idx.length); if (sc > bestScore) { bestScore = sc; best = i; } }
    if (best < 0) break;
    const b = boxes[best];
    let ch = 0; for (let c = 1; c < 3; c++) if (b.hi[c] - b.lo[c] > b.hi[ch] - b.lo[ch]) ch = c;
    const arr = Array.from(b.idx).sort((x, y) => samples[x * 3 + ch] - samples[y * 3 + ch]);
    const mid = arr.length >> 1;
    const b1 = { idx: Uint32Array.from(arr.slice(0, mid)) }, b2 = { idx: Uint32Array.from(arr.slice(mid)) };
    measure(b1); measure(b2);
    boxes.splice(best, 1, b1, b2);
  }
  const pal = new Uint8Array(256 * 3);
  boxes.forEach((b, i) => {
    let r = 0, g = 0, bl = 0; for (let k = 0; k < b.idx.length; k++) { const o = b.idx[k] * 3; r += samples[o]; g += samples[o + 1]; bl += samples[o + 2]; }
    const m = b.idx.length || 1; pal[i * 3] = r / m; pal[i * 3 + 1] = g / m; pal[i * 3 + 2] = bl / m;
  });
  return { pal, size: boxes.length };
}
function makeLookup(pal, size) {
  const cache = new Int16Array(32768).fill(-1);
  return (r, g, b) => {
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    let c = cache[key]; if (c >= 0) return c;
    let best = 0, bd = Infinity;
    for (let i = 0; i < size; i++) { const dr = pal[i * 3] - r, dg = pal[i * 3 + 1] - g, db = pal[i * 3 + 2] - b; const d = dr * dr + dg * dg + db * db; if (d < bd) { bd = d; best = i; } }
    cache[key] = best; return best;
  };
}
function quantize(rgba, w, h, lookup, pal, dither) {
  const out = new Uint8Array(w * h);
  if (!dither) { for (let i = 0, p = 0; i < out.length; i++, p += 4) out[i] = lookup(rgba[p], rgba[p + 1], rgba[p + 2]); return out; }
  const buf = new Float32Array(w * h * 3);
  for (let i = 0, p = 0; i < w * h; i++, p += 4) { buf[i * 3] = rgba[p]; buf[i * 3 + 1] = rgba[p + 1]; buf[i * 3 + 2] = rgba[p + 2]; }
  const cl = v => v < 0 ? 0 : v > 255 ? 255 : v;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x), o = i * 3;
    const r = cl(buf[o]), g = cl(buf[o + 1]), b = cl(buf[o + 2]);
    const c = lookup(r | 0, g | 0, b | 0); out[i] = c;
    const er = r - pal[c * 3], eg = g - pal[c * 3 + 1], eb = b - pal[c * 3 + 2];
    const spread = (dx, dy, f) => { const xx = x + dx, yy = y + dy; if (xx < 0 || xx >= w || yy >= h) return; const q = (yy * w + xx) * 3; buf[q] += er * f; buf[q + 1] += eg * f; buf[q + 2] += eb * f; };
    spread(1, 0, 7 / 16); spread(-1, 1, 3 / 16); spread(0, 1, 5 / 16); spread(1, 1, 1 / 16);
  }
  return out;
}

// ---------- LZW + GIF writer ----------
function lzwEncode(pixels, minCodeSize, out) {
  const clear = 1 << minCodeSize, eoi = clear + 1;
  let codeSize = minCodeSize + 1, next = eoi + 1;
  const table = new Int32Array(1 << 20).fill(-1);
  const block = new Uint8Array(255); let blen = 0;
  let acc = 0, bits = 0;
  const flushBlock = () => { if (blen) { out.push(blen); for (let i = 0; i < blen; i++) out.push(block[i]); blen = 0; } };
  const emit = code => {
    acc |= code << bits; bits += codeSize;
    while (bits >= 8) { block[blen++] = acc & 255; acc >>>= 8; bits -= 8; if (blen === 255) flushBlock(); }
  };
  emit(clear);
  let prefix = pixels[0];
  for (let i = 1; i < pixels.length; i++) {
    const k = pixels[i], key = (prefix << 8) | k;
    const c = table[key];
    if (c >= 0) { prefix = c; continue; }
    emit(prefix);
    if (next === 4096) { emit(clear); table.fill(-1); next = eoi + 1; codeSize = minCodeSize + 1; }
    else { if (next >= (1 << codeSize)) codeSize++; table[key] = next++; }
    prefix = k;
  }
  emit(prefix); emit(eoi);
  if (bits > 0) { block[blen++] = acc & 255; if (blen === 255) flushBlock(); }
  flushBlock(); out.push(0);
}
function writeGif(w, h, pal, frames, delayCs, loop = true) {
  const out = [];
  const u16 = v => { out.push(v & 255, (v >> 8) & 255); };
  for (const ch of 'GIF89a') out.push(ch.charCodeAt(0));
  u16(w); u16(h); out.push(0xF7, 0, 0);
  for (let i = 0; i < 768; i++) out.push(pal[i]);
  if (loop) { out.push(0x21, 0xFF, 0x0B); for (const ch of 'NETSCAPE2.0') out.push(ch.charCodeAt(0)); out.push(3, 1, 0, 0, 0); }
  for (const f of frames) {
    out.push(0x21, 0xF9, 4, 0x04); u16(delayCs); out.push(0, 0);
    out.push(0x2C); u16(0); u16(0); u16(w); u16(h); out.push(0);
    out.push(8); lzwEncode(f, 8, out);
  }
  out.push(0x3B);
  return new Uint8Array(out);
}

export default function (root) {
  let url = null, outUrl = null, cancel = false, busy = false;
  const video = el('video', { muted: true, playsInline: true, preload: 'auto', controls: true, style: { maxWidth: '100%', maxHeight: '300px', display: 'none', background: 'var(--bg)' } });
  const canvas = el('canvas', { style: { display: 'none' } });
  const startIn = el('input', { class: 'input', type: 'number', min: 0, step: 0.1, value: 0, style: { width: '90px' } });
  const endIn = el('input', { class: 'input', type: 'number', min: 0, step: 0.1, value: 3, style: { width: '90px' } });
  const fpsIn = el('input', { class: 'input', type: 'number', min: 1, max: 30, step: 1, value: 10, style: { width: '70px' } });
  const widthIn = el('input', { class: 'input', type: 'number', min: 16, max: 1280, step: 2, value: 320, style: { width: '80px' } });
  const ditherIn = el('input', { type: 'checkbox', checked: true });
  const loopIn = el('input', { type: 'checkbox', checked: true });
  const info = el('div', { class: 'muted small' }, 'Load a video to begin.');
  const progress = el('div', { class: 'bar' }, el('div', { style: { width: '0%' } }));
  const status = el('div', { class: 'small mono' });
  const result = el('div', { class: 'col' });
  const goBtn = el('button', { class: 'btn primary', disabled: true, onclick: () => (busy ? (cancel = true) : go()) }, 'Make GIF');

  function estimate() {
    const dur = Math.max(0, +endIn.value - +startIn.value), fps = +fpsIn.value, frames = Math.round(dur * fps);
    const w = +widthIn.value, h = video.videoWidth ? Math.round(w * video.videoHeight / video.videoWidth) : 0;
    info.textContent = video.videoWidth ? `${frames} frames at ${w}×${h}, ${dur.toFixed(1)} s. Video is ${video.videoWidth}×${video.videoHeight}, ${video.duration.toFixed(1)} s.` : 'Load a video to begin.';
  }
  [startIn, endIn, fpsIn, widthIn].forEach(i => i.addEventListener('input', estimate));

  const seekTo = t => new Promise(res => {
    if (Math.abs(video.currentTime - t) < 0.001) return res();
    const done = () => { clearTimeout(to); video.removeEventListener('seeked', done); res(); };
    const to = setTimeout(done, 2500);
    video.addEventListener('seeked', done); video.currentTime = t;
  });
  const tick = () => new Promise(r => setTimeout(r, 0));

  async function go() {
    busy = true; cancel = false; goBtn.textContent = 'Cancel'; render(result);
    try {
      video.pause();
      const start = Math.max(0, +startIn.value), end = Math.min(video.duration, +endIn.value);
      const fps = Math.max(1, Math.min(30, +fpsIn.value || 10));
      const w = Math.max(16, Math.min(1280, Math.round(+widthIn.value / 2) * 2));
      const h = Math.max(2, Math.round(w * video.videoHeight / video.videoWidth / 2) * 2);
      if (end <= start) throw new Error('End must be after start');
      const nFrames = Math.max(1, Math.round((end - start) * fps));
      if (nFrames > 600) throw new Error('That is more than 600 frames — shorten the range or lower the frame rate');
      canvas.width = w; canvas.height = h;
      const g = canvas.getContext('2d', { willReadFrequently: true });
      // 1. grab frames
      const raw = [];
      const sampleStride = Math.max(1, Math.floor(w * h * nFrames / 60000));
      const samples = [];
      for (let i = 0; i < nFrames; i++) {
        if (cancel) throw new Error('Cancelled');
        await seekTo(start + i / fps);
        g.drawImage(video, 0, 0, w, h);
        const d = g.getImageData(0, 0, w, h).data; raw.push(d);
        for (let p = (i % sampleStride) * 4; p < d.length; p += sampleStride * 4) samples.push(d[p], d[p + 1], d[p + 2]);
        status.textContent = `Capturing frame ${i + 1} / ${nFrames}`; progress.firstChild.style.width = (50 * (i + 1) / nFrames) + '%';
      }
      // 2. palette
      status.textContent = 'Building palette…'; await tick();
      const { pal, size } = medianCut(Uint8Array.from(samples), 256);
      const lookup = makeLookup(pal, size);
      // 3. quantize + encode
      const frames = [];
      for (let i = 0; i < nFrames; i++) {
        if (cancel) throw new Error('Cancelled');
        frames.push(quantize(raw[i], w, h, lookup, pal, ditherIn.checked));
        raw[i] = null;
        status.textContent = `Quantizing frame ${i + 1} / ${nFrames}`; progress.firstChild.style.width = (50 + 40 * (i + 1) / nFrames) + '%';
        if (i % 3 === 0) await tick();
      }
      status.textContent = 'Encoding…'; progress.firstChild.style.width = '95%'; await tick();
      const bytes = writeGif(w, h, pal, frames, Math.max(2, Math.round(100 / fps)), loopIn.checked);
      const blob = new Blob([bytes], { type: 'image/gif' });
      if (outUrl) URL.revokeObjectURL(outUrl); outUrl = URL.createObjectURL(blob);
      progress.firstChild.style.width = '100%'; status.textContent = `Done: ${nFrames} frames, ${fmtBytes(blob.size)}`;
      render(result,
        el('img', { src: outUrl, style: { maxWidth: '100%', border: '1px solid var(--line)', borderRadius: '8px' } }),
        el('div', { class: 'row' }, el('button', { class: 'btn primary', onclick: () => download('clip.gif', blob) }, `Download GIF (${fmtBytes(blob.size)})`)));
    } catch (e) {
      status.textContent = e.message || String(e); progress.firstChild.style.width = '0%';
    } finally { busy = false; cancel = false; goBtn.textContent = 'Make GIF'; }
  }

  render(root,
    dropZone('Drop a video file (mp4, webm, mov…) or click to choose', files => {
      const f = files[0]; if (url) URL.revokeObjectURL(url); url = URL.createObjectURL(f);
      video.src = url; video.style.display = 'block'; goBtn.disabled = true; render(result); status.textContent = '';
      video.addEventListener('loadedmetadata', () => {
        endIn.value = Math.min(3, video.duration).toFixed(1); startIn.value = 0; endIn.max = video.duration;
        goBtn.disabled = false; estimate();
      }, { once: true });
      video.addEventListener('error', () => { status.textContent = 'This browser cannot decode that video.'; }, { once: true });
    }, 'video/*', false),
    video,
    el('div', { class: 'row' },
      field('Start (s)', startIn), field('End (s)', endIn), field('FPS', fpsIn), field('Width (px)', widthIn),
      el('label', { class: 'inline' }, ditherIn, 'Dither'), el('label', { class: 'inline' }, loopIn, 'Loop'),
      el('button', { class: 'btn small ghost', onclick: () => { startIn.value = video.currentTime.toFixed(1); estimate(); } }, 'Start = playhead'),
      el('button', { class: 'btn small ghost', onclick: () => { endIn.value = video.currentTime.toFixed(1); estimate(); } }, 'End = playhead')),
    info,
    el('div', { class: 'row' }, goBtn, status),
    progress, result, canvas,
    el('p', { class: 'muted small' }, 'Everything runs locally: frames are drawn to a canvas, reduced to a 256-colour palette (median cut) and LZW-encoded into a GIF89a. Long or wide clips make big files — 320 px at 10 fps is a good start.'));

  return () => { cancel = true; video.pause(); video.removeAttribute('src'); if (url) URL.revokeObjectURL(url); if (outUrl) URL.revokeObjectURL(outUrl); };
}
