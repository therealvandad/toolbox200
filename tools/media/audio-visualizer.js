// Audio visualizer: audio file or microphone through an AnalyserNode, drawn as bars, waveform, circle or particles.
import { el, render, store, dropZone, field } from '../../lib/ui.js';

export default function (root) {
  const s = store('audio-visualizer');
  const cfg = Object.assign({ style: 'bars', c1: '#2f6fed', c2: '#e04fb0', bg: 'theme', sens: 1 }, s.get('cfg', {}));
  let ac = null, analyser = null, srcNode = null, stream = null, url = null, raf = 0, particles = [];
  const audio = el('audio', { controls: true, style: { width: '100%', display: 'none' } });
  const wrap = el('div', { style: { position: 'relative', width: '100%', background: 'var(--bg)', borderRadius: '8px', overflow: 'hidden' } });
  const cv = el('canvas', { style: { width: '100%', height: '100%', display: 'block', cursor: 'pointer' }, title: 'Click for fullscreen', onclick: () => fullscreen() });
  wrap.append(cv);
  const status = el('span', { class: 'muted small' }, 'Load a file or start the microphone.');

  function ctx() {
    if (!ac) { ac = new (window.AudioContext || window.webkitAudioContext)(); analyser = ac.createAnalyser(); analyser.fftSize = 2048; analyser.smoothingTimeConstant = 0.82; }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }
  let elementSrc = null;
  function useFile(file) {
    stopMic(); ctx();
    if (url) URL.revokeObjectURL(url); url = URL.createObjectURL(file);
    audio.src = url; audio.style.display = 'block';
    if (!elementSrc) { elementSrc = ac.createMediaElementSource(audio); elementSrc.connect(ac.destination); }
    if (srcNode && srcNode !== elementSrc) { try { srcNode.disconnect(analyser); } catch {} }
    elementSrc.connect(analyser); srcNode = elementSrc;
    status.textContent = file.name; audio.play().catch(() => {});
  }
  async function startMic() {
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch (e) { status.textContent = 'Microphone failed: ' + (e.message || e); return; }
    ctx(); audio.pause();
    if (srcNode) { try { srcNode.disconnect(analyser); } catch {} }
    srcNode = ac.createMediaStreamSource(stream); srcNode.connect(analyser);
    status.textContent = 'Listening to microphone'; micBtn.textContent = 'Stop mic';
  }
  function stopMic() {
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; if (srcNode && srcNode !== elementSrc) { try { srcNode.disconnect(); } catch {} srcNode = null; } micBtn.textContent = 'Use microphone'; status.textContent = 'Microphone stopped.'; }
  }
  const micBtn = el('button', { class: 'btn', onclick: () => (stream ? stopMic() : startMic()) }, 'Use microphone');

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = wrap.clientWidth || 600, h = document.fullscreenElement === wrap ? wrap.clientHeight : Math.round(Math.min(420, w * 0.56));
    wrap.style.height = document.fullscreenElement === wrap ? '100%' : h + 'px';
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  }
  function fullscreen() { if (document.fullscreenElement) document.exitFullscreen(); else wrap.requestFullscreen && wrap.requestFullscreen().catch(() => {}); }
  const onFs = () => resize();
  document.addEventListener('fullscreenchange', onFs);

  const freq = new Uint8Array(1024), wave = new Uint8Array(2048);
  function draw(t) {
    raf = requestAnimationFrame(draw);
    resize();
    const g = cv.getContext('2d'), W = cv.width, H = cv.height;
    const css = getComputedStyle(root);
    const bg = cfg.bg === 'black' ? '#000' : cfg.bg === 'white' ? '#fff' : (css.getPropertyValue('--bg').trim() || '#111');
    g.fillStyle = bg; g.globalAlpha = cfg.style === 'particles' ? 0.25 : 1; g.fillRect(0, 0, W, H); g.globalAlpha = 1;
    if (analyser) { analyser.getByteFrequencyData(freq); analyser.getByteTimeDomainData(wave); } else { freq.fill(0); wave.fill(128); }
    const sens = cfg.sens;
    let bass = 0; for (let i = 0; i < 24; i++) bass += freq[i]; bass = bass / 24 / 255 * sens;
    const grad = g.createLinearGradient(0, H, 0, 0); grad.addColorStop(0, cfg.c1); grad.addColorStop(1, cfg.c2);
    if (cfg.style === 'bars') {
      const n = 96, bw = W / n;
      for (let i = 0; i < n; i++) {
        const idx = Math.floor(Math.pow(i / n, 1.6) * 700);
        let v = 0; for (let k = 0; k < 4; k++) v = Math.max(v, freq[Math.min(1023, idx + k)]);
        const h = Math.min(H, v / 255 * H * sens);
        g.fillStyle = grad; g.fillRect(i * bw + 1, H - h, bw - 2, h);
      }
    } else if (cfg.style === 'wave') {
      g.lineWidth = Math.max(2, W / 300); g.strokeStyle = cfg.c1; g.beginPath();
      for (let i = 0; i < wave.length; i++) { const x = i / wave.length * W, y = H / 2 + (wave[i] - 128) / 128 * H / 2 * sens; i ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.stroke();
      g.strokeStyle = cfg.c2; g.globalAlpha = 0.5; g.beginPath();
      for (let i = 0; i < 256; i++) { const x = i / 256 * W, y = H - freq[i] / 255 * H * 0.5 * sens; i ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.stroke(); g.globalAlpha = 1;
    } else if (cfg.style === 'circle') {
      const cx = W / 2, cy = H / 2, r0 = Math.min(W, H) * (0.18 + bass * 0.08), n = 180;
      g.save(); g.translate(cx, cy); g.rotate(t / 9000);
      for (let i = 0; i < n; i++) {
        const idx = Math.floor(Math.pow(i / n, 1.4) * 600), v = freq[Math.min(1023, idx)] / 255 * sens;
        const len = v * Math.min(W, H) * 0.3, ang = i / n * Math.PI * 2;
        g.strokeStyle = i % 2 ? cfg.c1 : cfg.c2; g.lineWidth = Math.max(2, W / 400); g.beginPath();
        g.moveTo(Math.cos(ang) * r0, Math.sin(ang) * r0); g.lineTo(Math.cos(ang) * (r0 + len), Math.sin(ang) * (r0 + len)); g.stroke();
      }
      g.restore();
      g.strokeStyle = cfg.c1; g.lineWidth = 2; g.beginPath();
      for (let i = 0; i < wave.length; i += 4) { const ang = i / wave.length * Math.PI * 2, rr = r0 * 0.85 + (wave[i] - 128) / 128 * r0 * 0.3 * sens; const x = cx + Math.cos(ang) * rr, y = cy + Math.sin(ang) * rr; i ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.closePath(); g.stroke();
    } else { // particles
      if (particles.length < 220) for (let i = particles.length; i < 220; i++) particles.push({ x: Math.random() * W, y: Math.random() * H, vx: 0, vy: 0, r: 1 + Math.random() * 3, band: Math.floor(Math.random() * 200) });
      const cx = W / 2, cy = H / 2;
      for (const p of particles) {
        const e = freq[p.band] / 255 * sens;
        const dx = p.x - cx, dy = p.y - cy, d = Math.hypot(dx, dy) || 1;
        p.vx += (dx / d) * e * 1.5 + (Math.random() - 0.5) * 0.4; p.vy += (dy / d) * e * 1.5 + (Math.random() - 0.5) * 0.4;
        p.vx *= 0.94; p.vy *= 0.94; p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > W || p.y < 0 || p.y > H || d > Math.min(W, H) * 0.6 && e < 0.05) { p.x = cx + (Math.random() - 0.5) * 40; p.y = cy + (Math.random() - 0.5) * 40; p.vx = p.vy = 0; }
        g.fillStyle = p.band < 60 ? cfg.c1 : cfg.c2; g.globalAlpha = 0.4 + e * 0.6; g.beginPath(); g.arc(p.x, p.y, p.r * (1 + e * 2) * (W / 800), 0, Math.PI * 2); g.fill();
      }
      g.globalAlpha = 1;
      g.strokeStyle = cfg.c1; g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, 20 + bass * 60 * (W / 800), 0, Math.PI * 2); g.stroke();
    }
  }

  const saveCfg = () => s.set('cfg', cfg);
  const styleSel = el('select', { class: 'select', onchange: e => { cfg.style = e.target.value; saveCfg(); } }, ['bars', 'wave', 'circle', 'particles'].map(v => el('option', { value: v }, v[0].toUpperCase() + v.slice(1))));
  styleSel.value = cfg.style;
  const bgSel = el('select', { class: 'select', onchange: e => { cfg.bg = e.target.value; saveCfg(); } }, el('option', { value: 'theme' }, 'Theme'), el('option', { value: 'black' }, 'Black'), el('option', { value: 'white' }, 'White'));
  bgSel.value = cfg.bg;

  render(root,
    el('div', { class: 'row' },
      dropZone('Drop an audio file or click', f => useFile(f[0]), 'audio/*', false),
      micBtn, status),
    audio,
    wrap,
    el('div', { class: 'row' },
      field('Style', styleSel),
      field('Colour 1', el('input', { type: 'color', value: cfg.c1, oninput: e => { cfg.c1 = e.target.value; saveCfg(); } })),
      field('Colour 2', el('input', { type: 'color', value: cfg.c2, oninput: e => { cfg.c2 = e.target.value; saveCfg(); } })),
      field('Background', bgSel),
      field('Sensitivity', el('input', { type: 'range', min: 0.3, max: 2.5, step: 0.1, value: cfg.sens, oninput: e => { cfg.sens = +e.target.value; saveCfg(); } })),
      el('button', { class: 'btn', onclick: fullscreen }, 'Fullscreen')),
    el('p', { class: 'muted small' }, 'Click the canvas or press F for fullscreen; Esc leaves it. Audio from files is played through your speakers while it is analysed.'));
  raf = requestAnimationFrame(draw);

  function onKey(e) { if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return; if (e.key === 'f' || e.key === 'F') fullscreen(); }
  window.addEventListener('keydown', onKey);
  return () => {
    cancelAnimationFrame(raf); window.removeEventListener('keydown', onKey); document.removeEventListener('fullscreenchange', onFs);
    if (document.fullscreenElement === wrap) document.exitFullscreen().catch(() => {});
    audio.pause(); audio.removeAttribute('src'); if (url) URL.revokeObjectURL(url);
    if (stream) stream.getTracks().forEach(t => t.stop());
    if (ac) { ac.close().catch(() => {}); ac = null; }
  };
}
