// Voice recorder: MediaRecorder with a live waveform, a list of takes, playback, trim start/end
// (decoded and re-encoded as WAV) and download.
import { el, render, download, toast, fmtBytes, uid, pad } from '../../lib/ui.js';

function encodeWav(buffer) {
  const ch = buffer.numberOfChannels, sr = buffer.sampleRate, n = buffer.length;
  const data = new DataView(new ArrayBuffer(44 + n * ch * 2));
  const str = (o, s) => { for (let i = 0; i < s.length; i++) data.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); data.setUint32(4, 36 + n * ch * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
  data.setUint32(16, 16, true); data.setUint16(20, 1, true); data.setUint16(22, ch, true);
  data.setUint32(24, sr, true); data.setUint32(28, sr * ch * 2, true); data.setUint16(32, ch * 2, true); data.setUint16(34, 16, true);
  str(36, 'data'); data.setUint32(40, n * ch * 2, true);
  const chans = []; for (let c = 0; c < ch; c++) chans.push(buffer.getChannelData(c));
  let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { const v = Math.max(-1, Math.min(1, chans[c][i])); data.setInt16(o, v < 0 ? v * 32768 : v * 32767, true); o += 2; }
  return new Blob([data], { type: 'audio/wav' });
}
const fmtT = t => `${Math.floor(t / 60)}:${pad(Math.floor(t % 60))}.${pad(Math.floor((t % 1) * 10), 1)}`;

export default function (root) {
  let ac = null, stream = null, rec = null, analyser = null, raf = 0, chunks = [], startAt = 0, timer = null;
  const takes = []; // {id, name, blob, url, duration, buffer?}
  const urls = new Set();

  const cv = el('canvas', { width: 800, height: 120, style: { width: '100%', maxWidth: '100%', display: 'block' } });
  const status = el('div', { class: 'mono' }, 'Ready');
  const recBtn = el('button', { class: 'btn primary', onclick: () => (rec && rec.state !== 'inactive' ? stopRec() : startRec()) }, '● Record');
  const pauseBtn = el('button', { class: 'btn', disabled: true, onclick: () => { if (!rec) return; if (rec.state === 'recording') { rec.pause(); pauseBtn.textContent = 'Resume'; } else if (rec.state === 'paused') { rec.resume(); pauseBtn.textContent = 'Pause'; } } }, 'Pause');
  const list = el('ul', { class: 'list' });
  const err = el('div', { style: { color: 'var(--danger)' } });

  function drawWave() {
    const g = cv.getContext('2d'), W = cv.width, H = cv.height;
    const buf = new Uint8Array(analyser.fftSize);
    const accent = getComputedStyle(root).getPropertyValue('--accent').trim() || '#2f6fed';
    const line = getComputedStyle(root).getPropertyValue('--line').trim() || '#ccc';
    const step = () => {
      analyser.getByteTimeDomainData(buf);
      g.clearRect(0, 0, W, H);
      g.strokeStyle = line; g.beginPath(); g.moveTo(0, H / 2); g.lineTo(W, H / 2); g.stroke();
      g.strokeStyle = accent; g.lineWidth = 2; g.beginPath();
      for (let i = 0; i < buf.length; i++) { const x = i / buf.length * W, y = buf[i] / 255 * H; i ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.stroke();
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }

  async function startRec() {
    err.textContent = '';
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (e) { err.textContent = 'Microphone access failed: ' + (e.message || e); return; }
    if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === 'suspended') ac.resume();
    const src = ac.createMediaStreamSource(stream);
    analyser = ac.createAnalyser(); analyser.fftSize = 2048; src.connect(analyser);
    const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4', ''].find(m => !m || MediaRecorder.isTypeSupported(m));
    rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    chunks = [];
    rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    rec.onstop = () => {
      const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
      const duration = (performance.now() - startAt) / 1000;
      addTake(blob, duration);
      stream.getTracks().forEach(t => t.stop()); stream = null;
      cancelAnimationFrame(raf); clearInterval(timer);
      recBtn.textContent = '● Record'; recBtn.classList.add('primary'); recBtn.classList.remove('danger');
      pauseBtn.disabled = true; pauseBtn.textContent = 'Pause';
      status.textContent = 'Saved take ' + takes.length;
    };
    rec.start(250); startAt = performance.now();
    recBtn.textContent = '■ Stop'; recBtn.classList.remove('primary'); recBtn.classList.add('danger');
    pauseBtn.disabled = false;
    timer = setInterval(() => { status.textContent = 'Recording ' + fmtT((performance.now() - startAt) / 1000); }, 100);
    drawWave();
  }
  function stopRec() { if (rec && rec.state !== 'inactive') rec.stop(); }

  function addTake(blob, duration) {
    const url = URL.createObjectURL(blob); urls.add(url);
    const d = new Date();
    takes.push({ id: uid(), name: `take-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`, blob, url, duration, isWav: blob.type === 'audio/wav' });
    renderList();
  }
  async function decode(take) {
    if (take.buffer) return take.buffer;
    const ab = await take.blob.arrayBuffer();
    const ctx = new OfflineAudioContext(1, 1, 44100);
    take.buffer = await ctx.decodeAudioData(ab);
    take.duration = take.buffer.duration;
    return take.buffer;
  }
  async function trim(take, from, to, row) {
    try {
      const buf = await decode(take);
      from = Math.max(0, Math.min(from, buf.duration)); to = Math.max(from + 0.05, Math.min(to, buf.duration));
      const sr = buf.sampleRate, s0 = Math.floor(from * sr), s1 = Math.floor(to * sr);
      const out = new AudioBuffer({ numberOfChannels: buf.numberOfChannels, length: s1 - s0, sampleRate: sr });
      for (let c = 0; c < buf.numberOfChannels; c++) out.copyToChannel(buf.getChannelData(c).subarray(s0, s1), c);
      const blob = encodeWav(out);
      URL.revokeObjectURL(take.url); urls.delete(take.url);
      take.blob = blob; take.url = URL.createObjectURL(blob); urls.add(take.url); take.buffer = out; take.duration = out.duration; take.isWav = true;
      renderList(); toast(`Trimmed to ${fmtT(out.duration)}`);
    } catch (e) { err.textContent = 'Trim failed: ' + (e.message || e); }
  }
  async function toWav(take) {
    const buf = await decode(take); return encodeWav(buf);
  }

  function renderList() {
    if (!takes.length) { render(list, el('li', { class: 'muted' }, 'No recordings yet.')); return; }
    render(list, takes.map((t, i) => {
      const audio = el('audio', { controls: true, src: t.url, style: { maxWidth: '100%', height: '36px' } });
      const nameIn = el('input', { class: 'input small', value: t.name, style: { width: '150px' }, oninput: e => (t.name = e.target.value) });
      const from = el('input', { class: 'input', type: 'number', min: 0, step: 0.1, value: 0, style: { width: '80px' }, title: 'Trim start (s)' });
      const to = el('input', { class: 'input', type: 'number', min: 0, step: 0.1, value: t.duration.toFixed(1), style: { width: '80px' }, title: 'Trim end (s)' });
      const info = el('span', { class: 'muted small' }, `${fmtT(t.duration)} · ${fmtBytes(t.blob.size)} · ${t.isWav ? 'wav' : (t.blob.type.split(';')[0] || 'audio')}`);
      const row = el('li', { style: { flexWrap: 'wrap' } },
        el('div', { class: 'col grow', style: { minWidth: '220px' } },
          el('div', { class: 'row', style: { margin: 0 } }, el('b', {}, i + 1 + '.'), nameIn, info),
          audio,
          el('div', { class: 'row', style: { margin: 0 } },
            el('span', { class: 'small muted' }, 'Trim'), from, el('span', { class: 'small muted' }, 'to'), to,
            el('button', { class: 'btn small', onclick: () => trim(t, +from.value, +to.value, row) }, 'Apply trim'),
            el('button', { class: 'btn small ghost', onclick: () => { from.value = audio.currentTime.toFixed(1); } }, 'Start = playhead'),
            el('button', { class: 'btn small ghost', onclick: () => { to.value = audio.currentTime.toFixed(1); } }, 'End = playhead'))),
        el('div', { class: 'col' },
          el('button', { class: 'btn small primary', onclick: async () => download((t.name || 'recording') + '.wav', await toWav(t)) }, 'Download WAV'),
          t.isWav ? null : el('button', { class: 'btn small', onclick: () => download((t.name || 'recording') + '.' + (t.blob.type.includes('ogg') ? 'ogg' : t.blob.type.includes('mp4') ? 'm4a' : 'webm'), t.blob) }, 'Download original'),
          el('button', { class: 'btn small danger', onclick: () => { URL.revokeObjectURL(t.url); urls.delete(t.url); takes.splice(i, 1); renderList(); } }, 'Delete')));
      return row;
    }));
  }

  render(root,
    el('div', { class: 'row' }, recBtn, pauseBtn, status),
    el('div', { class: 'canvas-wrap' }, cv),
    err,
    el('h3', { style: { margin: '14px 0 4px' } }, 'Recordings'),
    list,
    el('p', { class: 'muted small' }, 'Recordings stay in memory only — download what you want to keep. Trimming decodes the take and re-encodes it as 16-bit WAV.'));
  renderList();

  return () => {
    cancelAnimationFrame(raf); clearInterval(timer);
    if (rec && rec.state !== 'inactive') { rec.onstop = null; try { rec.stop(); } catch {} }
    if (stream) stream.getTracks().forEach(t => t.stop());
    urls.forEach(u => URL.revokeObjectURL(u));
    if (ac) { ac.close().catch(() => {}); ac = null; }
  };
}
