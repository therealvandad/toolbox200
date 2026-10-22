// Spectrogram viewer: decode an audio file, run an STFT in JS and paint it with log or linear frequency
// and a choice of colormap; a playhead follows playback and clicking seeks.
import { el, render, store, dropZone, field, pad, fmtBytes, download } from '../../lib/ui.js';

// iterative radix-2 FFT (in place, re/im Float32Arrays)
function fft(re, im, cosT, sinT) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit;
    if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1, step = n / len;
    for (let i = 0; i < n; i += len) for (let k = 0; k < half; k++) {
      const wr = cosT[k * step], wi = -sinT[k * step];
      const a = i + k, b = a + half;
      const tr = re[b] * wr - im[b] * wi, ti = re[b] * wi + im[b] * wr;
      re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
    }
  }
}
const MAPS = {
  viridis: [[68, 1, 84], [72, 36, 117], [65, 68, 135], [53, 95, 141], [42, 120, 142], [33, 145, 140], [34, 168, 132], [68, 191, 112], [122, 209, 81], [189, 223, 38], [253, 231, 37]],
  magma: [[0, 0, 4], [28, 16, 68], [79, 18, 123], [129, 37, 129], [181, 54, 122], [229, 80, 100], [251, 135, 97], [254, 194, 135], [252, 253, 191]],
  inferno: [[0, 0, 4], [31, 12, 72], [85, 15, 109], [136, 34, 106], [186, 54, 85], [227, 89, 51], [249, 140, 10], [249, 201, 50], [252, 255, 164]],
  heat: [[0, 0, 0], [40, 0, 80], [120, 0, 120], [220, 40, 40], [255, 160, 0], [255, 255, 255]],
  gray: [[0, 0, 0], [255, 255, 255]],
};
function lut(name) {
  const stops = MAPS[name] || MAPS.viridis, out = new Uint8Array(256 * 3);
  for (let i = 0; i < 256; i++) {
    const p = i / 255 * (stops.length - 1), k = Math.min(stops.length - 2, Math.floor(p)), f = p - k;
    for (let c = 0; c < 3; c++) out[i * 3 + c] = stops[k][c] + (stops[k + 1][c] - stops[k][c]) * f;
  }
  return out;
}
const fmtT = t => `${pad(Math.floor(t / 60))}:${pad(Math.floor(t % 60))}`;

export default function (root) {
  const s = store('spectrogram');
  const cfg = Object.assign({ fft: 2048, scale: 'log', map: 'viridis', floor: -90, cols: 1200 }, s.get('cfg', {}));
  let url = null, raf = 0, cancel = false, spec = null; // spec: {cols, bins, data: Float32Array (col-major dB), sr, duration}
  const audio = el('audio', { controls: true, style: { width: '100%', display: 'none' } });
  const off = el('canvas');
  const cv = el('canvas', { width: 1200, height: 420, style: { width: '100%', maxWidth: '100%', display: 'block', cursor: 'crosshair' } });
  const status = el('div', { class: 'small mono muted' }, 'Drop an audio file to render its spectrogram.');
  const progress = el('div', { class: 'bar hidden' }, el('div', { style: { width: '0%' } }));
  const hover = el('div', { class: 'small mono muted', style: { minHeight: '1.4em' } });
  const tick = () => new Promise(r => setTimeout(r, 0));

  let lastFile = null;
  async function analyze(file) {
    cancel = false; spec = null; lastFile = file;
    status.textContent = `Decoding ${file.name} (${fmtBytes(file.size)})…`; progress.classList.remove('hidden'); progress.firstChild.style.width = '3%';
    if (url) URL.revokeObjectURL(url); url = URL.createObjectURL(file); audio.src = url; audio.style.display = 'block';
    try {
      const buf = await (new OfflineAudioContext(1, 1, 44100)).decodeAudioData(await file.arrayBuffer());
      if (cancel) return;
      const sr = buf.sampleRate, n = buf.length, mono = new Float32Array(n);
      for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < n; i++) mono[i] += d[i] / buf.numberOfChannels; }
      const N = cfg.fft, bins = N / 2;
      const cols = Math.max(16, Math.min(cfg.cols, Math.floor(n / 64)));
      const hop = Math.max(1, (n - N) / (cols - 1));
      const win = new Float32Array(N); for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1));
      const cosT = new Float32Array(N / 2), sinT = new Float32Array(N / 2);
      for (let i = 0; i < N / 2; i++) { cosT[i] = Math.cos(2 * Math.PI * i / N); sinT[i] = Math.sin(2 * Math.PI * i / N); }
      const re = new Float32Array(N), im = new Float32Array(N);
      const data = new Float32Array(cols * bins);
      const norm = 2 / (N * 0.5); // Hann window gain compensation
      for (let c = 0; c < cols; c++) {
        const start = Math.floor(c * hop);
        for (let i = 0; i < N; i++) { const v = start + i < n ? mono[start + i] : 0; re[i] = v * win[i]; im[i] = 0; }
        fft(re, im, cosT, sinT);
        const o = c * bins;
        for (let k = 0; k < bins; k++) { const m = Math.hypot(re[k], im[k]) * norm; data[o + k] = 20 * Math.log10(m + 1e-9); }
        if ((c & 31) === 0) { progress.firstChild.style.width = (5 + 90 * c / cols) + '%'; status.textContent = `Analysing… ${Math.round(100 * c / cols)}%`; await tick(); if (cancel) return; }
      }
      spec = { cols, bins, data, sr, duration: buf.duration, N };
      status.textContent = `${file.name} — ${fmtT(buf.duration)}, ${sr} Hz, FFT ${N} (${(sr / N).toFixed(1)} Hz per bin), ${cols} columns`;
      paint();
    } catch (e) { status.textContent = 'Could not analyse this file: ' + (e.message || e); }
    finally { progress.firstChild.style.width = '100%'; setTimeout(() => progress.classList.add('hidden'), 500); }
  }

  const fMin = 20;
  function yToFreq(y, H, sr) { // y=0 top
    const t = 1 - y / H, ny = sr / 2;
    return cfg.scale === 'log' ? fMin * Math.pow(ny / fMin, t) : t * ny;
  }
  function paint() {
    if (!spec) return;
    const { cols, bins, data, sr } = spec;
    const W = cols, H = 512; off.width = W; off.height = H;
    const g = off.getContext('2d'), img = g.createImageData(W, H), px = img.data, L = lut(cfg.map);
    const floor = cfg.floor, range = -floor; // map floor..0 dB
    const rowBin = new Int32Array(H), rowBin2 = new Int32Array(H);
    for (let y = 0; y < H; y++) {
      const f0 = yToFreq(y + 0.5, H, sr), f1 = yToFreq(y - 0.5, H, sr);
      rowBin[y] = Math.max(0, Math.min(bins - 1, Math.floor(f0 / (sr / 2) * bins)));
      rowBin2[y] = Math.max(rowBin[y], Math.min(bins - 1, Math.floor(f1 / (sr / 2) * bins)));
    }
    for (let x = 0; x < W; x++) {
      const o = x * bins;
      for (let y = 0; y < H; y++) {
        let v = -Infinity; for (let k = rowBin[y]; k <= rowBin2[y]; k++) if (data[o + k] > v) v = data[o + k];
        let t = (v - floor) / range; t = t < 0 ? 0 : t > 1 ? 1 : t;
        const ci = Math.round(t * 255) * 3, p = (y * W + x) * 4;
        px[p] = L[ci]; px[p + 1] = L[ci + 1]; px[p + 2] = L[ci + 2]; px[p + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
  }
  function draw() {
    raf = requestAnimationFrame(draw);
    const g = cv.getContext('2d'), W = cv.width, H = cv.height;
    const css = getComputedStyle(root);
    g.fillStyle = css.getPropertyValue('--bg').trim() || '#111'; g.fillRect(0, 0, W, H);
    if (!spec) return;
    const left = 46;
    g.drawImage(off, left, 0, W - left, H - 18);
    // axes
    g.fillStyle = css.getPropertyValue('--muted').trim() || '#888'; g.font = '11px system-ui'; g.textAlign = 'right';
    const ticks = cfg.scale === 'log' ? [50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000] : [0, 2000, 4000, 6000, 8000, 10000, 12000, 14000, 16000, 18000, 20000];
    for (const f of ticks) {
      if (f > spec.sr / 2 || (cfg.scale === 'log' && f < fMin)) continue;
      const t = cfg.scale === 'log' ? Math.log(f / fMin) / Math.log(spec.sr / 2 / fMin) : f / (spec.sr / 2);
      const y = (1 - t) * (H - 18);
      g.fillText(f >= 1000 ? (f / 1000) + 'k' : f, left - 4, y + 4);
      g.fillRect(left - 2, y, 2, 1);
    }
    g.textAlign = 'center';
    const step = spec.duration > 300 ? 60 : spec.duration > 120 ? 30 : spec.duration > 40 ? 10 : spec.duration > 10 ? 5 : 1;
    for (let t = 0; t <= spec.duration; t += step) g.fillText(fmtT(t), left + t / spec.duration * (W - left), H - 4);
    // playhead
    if (audio.src && spec.duration) {
      const x = left + audio.currentTime / spec.duration * (W - left);
      g.fillStyle = css.getPropertyValue('--danger').trim() || '#d64545'; g.fillRect(x - 1, 0, 2, H - 18);
    }
  }
  cv.addEventListener('click', e => {
    if (!spec || !audio.src) return;
    const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * cv.width, left = 46;
    if (x < left) return; audio.currentTime = (x - left) / (cv.width - left) * spec.duration; audio.play().catch(() => {});
  });
  cv.addEventListener('mousemove', e => {
    if (!spec) return;
    const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * cv.width, y = (e.clientY - r.top) / r.height * cv.height, left = 46;
    if (x < left || y > cv.height - 18) { hover.textContent = ''; return; }
    const t = (x - left) / (cv.width - left) * spec.duration, f = yToFreq(y / (cv.height - 18) * 512, 512, spec.sr);
    const col = Math.min(spec.cols - 1, Math.floor((x - left) / (cv.width - left) * spec.cols)), bin = Math.min(spec.bins - 1, Math.floor(f / (spec.sr / 2) * spec.bins));
    hover.textContent = `${fmtT(t)}.${pad(Math.floor((t % 1) * 10), 1)}  ·  ${Math.round(f)} Hz  ·  ${spec.data[col * spec.bins + bin].toFixed(1)} dB`;
  });
  cv.addEventListener('mouseleave', () => { hover.textContent = ''; });

  const saveCfg = () => s.set('cfg', cfg);
  const fftSel = el('select', { class: 'select', onchange: e => { cfg.fft = +e.target.value; saveCfg(); if (lastFile) analyze(lastFile); } }, [512, 1024, 2048, 4096, 8192].map(v => el('option', { value: v }, v)));
  fftSel.value = cfg.fft;
  const scaleSel = el('select', { class: 'select', onchange: e => { cfg.scale = e.target.value; saveCfg(); paint(); } }, el('option', { value: 'log' }, 'Logarithmic'), el('option', { value: 'linear' }, 'Linear'));
  scaleSel.value = cfg.scale;
  const mapSel = el('select', { class: 'select', onchange: e => { cfg.map = e.target.value; saveCfg(); paint(); } }, Object.keys(MAPS).map(m => el('option', { value: m }, m)));
  mapSel.value = cfg.map;
  const floorIn = el('input', { type: 'range', min: -120, max: -30, step: 5, value: cfg.floor, oninput: e => { cfg.floor = +e.target.value; floorLabel.textContent = cfg.floor + ' dB'; saveCfg(); paint(); } });
  const floorLabel = el('span', { class: 'mono small' }, cfg.floor + ' dB');

  render(root,
    dropZone('Drop an audio file (mp3, wav, ogg, m4a…) or click to choose', f => analyze(f[0]), 'audio/*', false),
    status, progress, audio,
    el('div', { class: 'canvas-wrap', style: { padding: 0 } }, cv),
    hover,
    el('div', { class: 'row' },
      field('FFT size', fftSel), field('Frequency scale', scaleSel), field('Colormap', mapSel),
      field('Floor', el('span', { class: 'row', style: { margin: 0 } }, floorIn, floorLabel)),
      el('button', { class: 'btn', onclick: () => { if (spec) cv.toBlob(b => download('spectrogram.png', b)); } }, 'Save PNG')),
    el('p', { class: 'muted small' }, 'The whole file is analysed with a Hann-windowed STFT in JavaScript. Click the spectrogram to seek; the red line follows playback. Larger FFT sizes give finer frequency and coarser time resolution.'));
  raf = requestAnimationFrame(draw);

  return () => { cancel = true; cancelAnimationFrame(raf); audio.pause(); audio.removeAttribute('src'); if (url) URL.revokeObjectURL(url); };
}
