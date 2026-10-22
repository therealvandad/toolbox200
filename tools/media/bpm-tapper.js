// BPM tapper and tempo detector: tap along, or drop an audio file and estimate tempo from onset-energy autocorrelation.
import { el, render, stat, dropZone, toast, fmtBytes } from '../../lib/ui.js';

export default function (root) {
  // ---------- tapping ----------
  let taps = [];
  let resetTimer = null;
  const bpmBig = el('div', { class: 'huge', style: { textAlign: 'center', minHeight: '1em' } }, '–');
  const tapStats = el('div', { class: 'row', style: { justifyContent: 'center' } });
  function tap() {
    const now = performance.now();
    if (taps.length && now - taps[taps.length - 1] > 2500) taps = [];
    taps.push(now);
    if (taps.length > 24) taps.shift();
    tapBtn.style.transform = 'scale(0.96)'; setTimeout(() => (tapBtn.style.transform = ''), 80);
    showTaps();
    clearTimeout(resetTimer); resetTimer = setTimeout(() => { hint.textContent = 'Paused — tapping again starts a new measurement.'; }, 2500);
  }
  function showTaps() {
    if (taps.length < 2) { bpmBig.textContent = taps.length ? '…' : '–'; render(tapStats); hint.textContent = 'Keep tapping on the beat.'; return; }
    const iv = []; for (let i = 1; i < taps.length; i++) iv.push(taps[i] - taps[i - 1]);
    const avg = iv.reduce((a, b) => a + b, 0) / iv.length;
    const bpm = 60000 / avg;
    const sd = Math.sqrt(iv.reduce((a, b) => a + (b - avg) ** 2, 0) / iv.length);
    bpmBig.textContent = bpm.toFixed(1);
    render(tapStats, stat(Math.round(bpm), 'BPM'), stat(taps.length, 'taps'), stat((avg / 1000).toFixed(3) + ' s', 'avg interval'), stat('±' + Math.round(sd) + ' ms', 'jitter'));
    hint.textContent = 'Keep tapping on the beat.';
  }
  const hint = el('div', { class: 'muted small center' }, 'Click the button or press Space / any key on the beat.');
  const tapBtn = el('button', { class: 'btn primary', style: { fontSize: '20px', padding: '26px 48px', transition: 'transform .08s' }, onclick: tap }, 'TAP');
  const resetBtn = el('button', { class: 'btn ghost', onclick: () => { taps = []; showTaps(); } }, 'Reset');

  // ---------- file analysis ----------
  const fileOut = el('div', { class: 'col' });
  const progress = el('div', { class: 'bar hidden' }, el('div', { style: { width: '0%' } }));
  let cancelled = false;

  async function analyze(file) {
    cancelled = false;
    render(fileOut, el('div', { class: 'muted small' }, `Decoding ${file.name} (${fmtBytes(file.size)})…`));
    progress.classList.remove('hidden'); progress.firstChild.style.width = '5%';
    try {
      const buf = await file.arrayBuffer();
      const probe = new OfflineAudioContext(1, 1, 44100);
      const audio = await probe.decodeAudioData(buf);
      if (cancelled) return;
      const sr = audio.sampleRate;
      const maxSec = 90; // analyse at most 90 s from the middle of the track
      const total = audio.length;
      const span = Math.min(total, maxSec * sr);
      const off = Math.floor((total - span) / 2);
      const mono = new Float32Array(span);
      for (let c = 0; c < audio.numberOfChannels; c++) {
        const d = audio.getChannelData(c);
        for (let i = 0; i < span; i++) mono[i] += d[off + i] / audio.numberOfChannels;
      }
      progress.firstChild.style.width = '25%';
      await tick();
      // onset envelope: frame energy, half-wave rectified difference
      const hop = 256, win = 1024;
      const frames = Math.floor((span - win) / hop);
      const fps = sr / hop;
      const energy = new Float32Array(frames);
      for (let f = 0; f < frames; f++) {
        let e = 0; const o = f * hop;
        for (let i = 0; i < win; i++) { const v = mono[o + i]; e += v * v; }
        energy[f] = Math.log1p(e * 100);
        if ((f & 4095) === 0) { progress.firstChild.style.width = (25 + 30 * f / frames) + '%'; await tick(); if (cancelled) return; }
      }
      const onset = new Float32Array(frames);
      for (let f = 1; f < frames; f++) onset[f] = Math.max(0, energy[f] - energy[f - 1]);
      // remove mean
      let mean = 0; for (let f = 0; f < frames; f++) mean += onset[f]; mean /= frames;
      for (let f = 0; f < frames; f++) onset[f] -= mean;
      // autocorrelation over lags for 50..220 BPM
      const minLag = Math.floor(fps * 60 / 220), maxLag = Math.ceil(fps * 60 / 50);
      const ac = new Float32Array(maxLag + 1);
      for (let lag = minLag; lag <= maxLag; lag++) {
        let sum = 0;
        for (let f = lag; f < frames; f++) sum += onset[f] * onset[f - lag];
        ac[lag] = sum / (frames - lag);
        if ((lag & 15) === 0) { progress.firstChild.style.width = (55 + 40 * (lag - minLag) / (maxLag - minLag)) + '%'; await tick(); if (cancelled) return; }
      }
      // find peaks, weight toward 80-160 BPM
      const cands = [];
      for (let lag = minLag + 1; lag < maxLag; lag++) {
        if (ac[lag] > ac[lag - 1] && ac[lag] >= ac[lag + 1]) {
          const bpm = 60 * fps / lag;
          const w = Math.exp(-0.5 * ((Math.log2(bpm / 120)) / 0.6) ** 2); // gaussian in log tempo
          cands.push({ bpm, lag, score: ac[lag] * (0.5 + w) });
        }
      }
      cands.sort((a, b) => b.score - a.score);
      if (!cands.length) throw new Error('No clear beat found');
      // refine the best candidate by parabolic interpolation
      const best = cands[0];
      const y0 = ac[best.lag - 1], y1 = ac[best.lag], y2 = ac[best.lag + 1];
      const denom = y0 - 2 * y1 + y2;
      const shift = denom ? 0.5 * (y0 - y2) / denom : 0;
      const bpm = 60 * fps / (best.lag + shift);
      const alts = cands.slice(1, 4).map(c => Math.round(c.bpm));
      const top = cands[0].score, second = cands[1] ? cands[1].score : 0;
      const conf = top > 0 ? Math.min(1, (top - second) / top + 0.3) : 0;
      progress.firstChild.style.width = '100%';
      render(fileOut,
        el('div', { class: 'row' },
          stat(bpm.toFixed(1), 'estimated BPM'),
          stat((bpm / 2).toFixed(1) + ' / ' + (bpm * 2).toFixed(1), 'half / double'),
          stat(Math.round(conf * 100) + '%', 'confidence'),
          stat(Math.round(audio.duration) + ' s', 'duration')),
        el('div', { class: 'muted small' }, `${file.name} — other candidates: ${alts.join(', ') || 'none'}. Tempo detectors often land on half or double time; tap along to confirm.`));
      drawCurve(ac, minLag, maxLag, best.lag, fps);
    } catch (e) {
      render(fileOut, el('div', { style: { color: 'var(--danger)' } }, 'Could not analyse this file: ' + (e.message || e)));
    } finally { setTimeout(() => progress.classList.add('hidden'), 600); }
  }
  const tick = () => new Promise(r => setTimeout(r, 0));

  const cv = el('canvas', { width: 800, height: 160, style: { width: '100%', maxWidth: '100%', display: 'none' } });
  function drawCurve(ac, minLag, maxLag, bestLag, fps) {
    cv.style.display = 'block';
    const g = cv.getContext('2d'), W = cv.width, H = cv.height;
    g.clearRect(0, 0, W, H);
    const css = getComputedStyle(root);
    let max = 0, min = Infinity; for (let l = minLag; l <= maxLag; l++) { max = Math.max(max, ac[l]); min = Math.min(min, ac[l]); }
    g.strokeStyle = css.getPropertyValue('--accent').trim() || '#2f6fed'; g.lineWidth = 2; g.beginPath();
    for (let l = minLag; l <= maxLag; l++) {
      const x = (l - minLag) / (maxLag - minLag) * W, y = H - 10 - (ac[l] - min) / (max - min || 1) * (H - 30);
      l === minLag ? g.moveTo(x, y) : g.lineTo(x, y);
    }
    g.stroke();
    const bx = (bestLag - minLag) / (maxLag - minLag) * W;
    g.strokeStyle = css.getPropertyValue('--danger').trim() || '#d64545'; g.beginPath(); g.moveTo(bx, 0); g.lineTo(bx, H); g.stroke();
    g.fillStyle = css.getPropertyValue('--muted').trim() || '#888'; g.font = '12px system-ui';
    for (const b of [60, 80, 100, 120, 140, 160, 180, 200]) {
      const lag = fps * 60 / b; if (lag < minLag || lag > maxLag) continue;
      const x = (lag - minLag) / (maxLag - minLag) * W; g.fillText(b, x - 8, H - 2);
    }
  }

  render(root,
    el('div', { class: 'grid2' },
      el('div', { class: 'panel col center' },
        el('div', { class: 'muted small' }, 'Tap tempo'),
        bpmBig, tapStats,
        el('div', { class: 'row', style: { justifyContent: 'center' } }, tapBtn, resetBtn),
        hint),
      el('div', { class: 'panel col' },
        el('div', { class: 'muted small' }, 'Detect tempo from a file'),
        dropZone('Drop an audio file (mp3, wav, ogg…) or click to choose', f => analyze(f[0]), 'audio/*', false),
        progress, fileOut,
        el('div', { class: 'canvas-wrap' }, cv))));

  function onKey(e) {
    if (['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(e.target.tagName) && e.target !== tapBtn) return;
    if (e.key === 'Escape') { taps = []; showTaps(); return; }
    if (e.repeat || e.key === 'Tab' || e.ctrlKey || e.metaKey || e.altKey) return;
    e.preventDefault(); tap();
  }
  window.addEventListener('keydown', onKey);
  return () => { window.removeEventListener('keydown', onKey); clearTimeout(resetTimer); cancelled = true; };
}
