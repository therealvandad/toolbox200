import { el, render, store, loop } from '../../lib/ui.js';

export default function (root) {
  const s = store('av-tester');
  let camStream = null, micStream = null, actx = null, analyser = null, stopMeter = null, peak = 0, peakAt = 0, disposed = false;

  const video = el('video', { autoplay: true, playsinline: true, muted: true, style: { width: '100%', maxWidth: '640px', background: '#000', borderRadius: '8px', display: 'block', minHeight: '120px' } });
  video.muted = true;
  const camSel = el('select', { class: 'select', style: { maxWidth: '100%' } });
  const micSel = el('select', { class: 'select', style: { maxWidth: '100%' } });
  const camInfo = el('div', { class: 'small muted mono' });
  const micInfo = el('div', { class: 'small muted mono' });
  const err = el('div', { class: 'small', style: { color: 'var(--danger)', minHeight: '1.3em' } });
  const camBtn = el('button', { class: 'btn primary' }, 'Start camera');
  const micBtn = el('button', { class: 'btn primary' }, 'Start microphone');
  const meterFill = el('div', { style: { width: '0%', transition: 'none' } });
  const meter = el('div', { class: 'bar', style: { height: '22px' } }, meterFill);
  const peakMark = el('div', { style: { position: 'absolute', top: 0, bottom: 0, width: '3px', background: 'var(--danger)', left: '0%' } });
  const meterWrap = el('div', { style: { position: 'relative' } }, meter, peakMark);
  const dbLbl = el('div', { class: 'mono' }, '-inf dB');

  const stopTracks = st => st && st.getTracks().forEach(t => t.stop());
  function message(e) {
    const n = e && e.name;
    if (n === 'NotAllowedError' || n === 'SecurityError') return 'Permission denied. Allow access in your browser\'s site settings and try again.';
    if (n === 'NotFoundError' || n === 'OverconstrainedError') return 'No matching device found.';
    if (n === 'NotReadableError') return 'The device is in use by another application.';
    return (e && e.message) || 'Could not access the device.';
  }
  const hasMedia = () => navigator.mediaDevices && navigator.mediaDevices.getUserMedia;

  async function listDevices() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
    try {
      const devs = await navigator.mediaDevices.enumerateDevices();
      if (disposed) return;
      const fill = (sel, kind, saved, label) => {
        const items = devs.filter(d => d.kind === kind);
        const cur = sel.value || saved;
        render(sel, items.length ? items.map((d, i) => el('option', { value: d.deviceId }, d.label || `${label} ${i + 1}`)) : el('option', { value: '' }, 'No ' + label.toLowerCase() + ' found'));
        if (items.some(d => d.deviceId === cur)) sel.value = cur;
      };
      fill(camSel, 'videoinput', s.get('cam', ''), 'Camera');
      fill(micSel, 'audioinput', s.get('mic', ''), 'Microphone');
    } catch {}
  }

  async function startCam() {
    err.textContent = '';
    if (!hasMedia()) { err.textContent = 'Camera access is not available here (it needs HTTPS or localhost).'; return; }
    stopCam();
    try {
      const c = camSel.value ? { video: { deviceId: { exact: camSel.value } } } : { video: true };
      camStream = await navigator.mediaDevices.getUserMedia(c);
      if (disposed) { stopTracks(camStream); camStream = null; return; }
      video.srcObject = camStream; video.play().catch(() => {});
      const t = camStream.getVideoTracks()[0], set = t.getSettings();
      camInfo.textContent = `${t.label} - ${set.width || '?'} x ${set.height || '?'}${set.frameRate ? ' @ ' + Math.round(set.frameRate) + ' fps' : ''}`;
      camBtn.textContent = 'Stop camera';
      s.set('cam', camSel.value);
      listDevices();
    } catch (e) { err.textContent = 'Camera: ' + message(e); }
  }
  function stopCam() {
    stopTracks(camStream); camStream = null; video.srcObject = null; camInfo.textContent = ''; camBtn.textContent = 'Start camera';
  }
  async function startMic() {
    err.textContent = '';
    if (!hasMedia()) { err.textContent = 'Microphone access is not available here (it needs HTTPS or localhost).'; return; }
    stopMic();
    try {
      const c = micSel.value ? { audio: { deviceId: { exact: micSel.value } } } : { audio: true };
      micStream = await navigator.mediaDevices.getUserMedia(c);
      if (disposed) { stopTracks(micStream); micStream = null; return; }
      actx = new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
      const src = actx.createMediaStreamSource(micStream);
      analyser = actx.createAnalyser(); analyser.fftSize = 1024;
      src.connect(analyser); // not connected to destination: no feedback
      const buf = new Float32Array(analyser.fftSize);
      peak = -100;
      stopMeter = loop(() => {
        if (!analyser) return;
        analyser.getFloatTimeDomainData(buf);
        let sum = 0; for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
        const rms = Math.sqrt(sum / buf.length), db = rms > 0 ? Math.max(-100, 20 * Math.log10(rms)) : -100;
        const pct = Math.max(0, Math.min(100, (db + 60) / 60 * 100));
        meterFill.style.width = pct + '%';
        meterFill.style.background = db > -6 ? 'var(--danger)' : db > -18 ? 'var(--warn)' : 'var(--ok)';
        const now = performance.now();
        if (db > peak || now - peakAt > 1500) { peak = db; peakAt = now; }
        peakMark.style.left = Math.max(0, Math.min(99.5, (peak + 60) / 60 * 100)) + '%';
        dbLbl.textContent = (db <= -100 ? '-inf' : db.toFixed(1)) + ' dB   (peak ' + (peak <= -100 ? '-inf' : peak.toFixed(1)) + ' dB)';
      });
      const t = micStream.getAudioTracks()[0], set = t.getSettings();
      micInfo.textContent = `${t.label}${set.sampleRate ? ' - ' + set.sampleRate + ' Hz' : ''}${set.channelCount ? ', ' + set.channelCount + ' ch' : ''}`;
      micBtn.textContent = 'Stop microphone';
      s.set('mic', micSel.value);
      listDevices();
    } catch (e) { err.textContent = 'Microphone: ' + message(e); }
  }
  function stopMic() {
    if (stopMeter) { stopMeter(); stopMeter = null; }
    stopTracks(micStream); micStream = null; analyser = null;
    if (actx) { try { actx.close(); } catch {} actx = null; }
    meterFill.style.width = '0%'; peakMark.style.left = '0%'; dbLbl.textContent = '-inf dB'; micInfo.textContent = ''; micBtn.textContent = 'Start microphone';
  }
  function stopAll() { stopCam(); stopMic(); }

  camBtn.addEventListener('click', () => (camStream ? stopCam() : startCam()));
  micBtn.addEventListener('click', () => (micStream ? stopMic() : startMic()));
  camSel.addEventListener('change', () => { s.set('cam', camSel.value); if (camStream) startCam(); });
  micSel.addEventListener('change', () => { s.set('mic', micSel.value); if (micStream) startMic(); });
  const onDeviceChange = () => listDevices();
  if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) navigator.mediaDevices.addEventListener('devicechange', onDeviceChange);

  render(root,
    el('div', { class: 'grid2' },
      el('div', { class: 'col' },
        el('h3', { style: { margin: 0 } }, 'Camera'),
        el('label', { class: 'field' }, 'Device', camSel),
        el('div', { class: 'row' }, camBtn),
        video, camInfo),
      el('div', { class: 'col' },
        el('h3', { style: { margin: 0 } }, 'Microphone'),
        el('label', { class: 'field' }, 'Device', micSel),
        el('div', { class: 'row' }, micBtn),
        meterWrap, dbLbl, micInfo,
        el('div', { class: 'small muted' }, 'Speak or clap: the bar should move. Audio is only analysed, never played back or recorded.'))),
    err,
    el('div', { class: 'row' }, el('button', { class: 'btn danger', onclick: stopAll }, 'Stop everything')),
    el('div', { class: 'small muted' }, 'Everything stays in your browser. Device names appear after you grant permission once.'));
  if (!hasMedia()) err.textContent = 'This browser or context does not expose camera/microphone access (it needs HTTPS or localhost).';
  listDevices();

  return () => {
    disposed = true;
    stopAll();
    if (navigator.mediaDevices && navigator.mediaDevices.removeEventListener) navigator.mediaDevices.removeEventListener('devicechange', onDeviceChange);
  };
}
