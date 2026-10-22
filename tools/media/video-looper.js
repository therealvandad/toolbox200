// Video speed changer and looper: playback rate 0.25–2×, A-B loop points, frame stepping and keyboard shortcuts.
import { el, render, store, dropZone, field, pad } from '../../lib/ui.js';

const fmt = t => { const ms = Math.round(t * 1000); return `${pad(Math.floor(ms / 60000))}:${pad(Math.floor(ms / 1000) % 60)}.${pad(ms % 1000, 3)}`; };

export default function (root) {
  const s = store('video-looper');
  let url = null, raf = 0, a = null, b = null, looping = false;
  let fps = s.get('fps', 30);
  const video = el('video', { controls: true, playsInline: true, style: { width: '100%', maxHeight: '420px', display: 'none', background: '#000' } });
  const rateIn = el('input', { type: 'range', min: 0.25, max: 2, step: 0.05, value: 1, class: 'grow', style: { minWidth: '140px' } });
  const rateLabel = el('span', { class: 'mono', style: { width: '48px' } }, '1.00×');
  const timeLabel = el('span', { class: 'mono' }, '00:00.000');
  const abLabel = el('span', { class: 'mono small muted' }, 'A: – B: –');
  const loopBtn = el('button', { class: 'btn', onclick: () => setLoop(!looping) }, 'Loop A-B: off');
  const fpsIn = el('input', { class: 'input', type: 'number', min: 1, max: 120, value: fps, style: { width: '70px' }, onchange: e => { fps = Math.max(1, +e.target.value || 30); s.set('fps', fps); } });
  const pitchIn = el('input', { type: 'checkbox', checked: true, onchange: e => { video.preservesPitch = e.target.checked; } });
  const bar = el('div', { class: 'bar', style: { position: 'relative', height: '14px', cursor: 'pointer' }, onclick: e => { if (!video.duration) return; const r = bar.getBoundingClientRect(); video.currentTime = (e.clientX - r.left) / r.width * video.duration; } });
  const fill = el('div', { style: { width: '0%' } });
  const abBand = el('div', { style: { position: 'absolute', top: 0, bottom: 0, left: 0, width: 0, background: 'var(--warn)', opacity: 0.45, pointerEvents: 'none' } });
  bar.append(fill, abBand);

  function setRate(r) { r = Math.max(0.25, Math.min(2, r)); video.playbackRate = r; rateIn.value = r; rateLabel.textContent = r.toFixed(2) + '×'; }
  rateIn.addEventListener('input', () => setRate(+rateIn.value));
  function setLoop(on) { looping = on && a != null && b != null && b > a; loopBtn.textContent = 'Loop A-B: ' + (looping ? 'on' : 'off'); loopBtn.classList.toggle('primary', looping); }
  function updateAB() {
    abLabel.textContent = `A: ${a == null ? '–' : fmt(a)}   B: ${b == null ? '–' : fmt(b)}`;
    if (video.duration && a != null) { abBand.style.left = (a / video.duration * 100) + '%'; abBand.style.width = (((b ?? video.duration) - a) / video.duration * 100) + '%'; }
    else abBand.style.width = 0;
    if (looping && !(a != null && b != null && b > a)) setLoop(false);
  }
  const setA = () => { a = video.currentTime; if (b != null && b <= a) b = null; updateAB(); };
  const setB = () => { b = video.currentTime; if (a == null || a >= b) a = 0; updateAB(); setLoop(true); };
  const clearAB = () => { a = b = null; setLoop(false); updateAB(); };
  function step(n) { video.pause(); video.currentTime = Math.max(0, Math.min(video.duration || 0, video.currentTime + n / fps)); }
  function tick() {
    if (video.duration) {
      if (looping && (video.currentTime >= b || video.currentTime < a - 0.5)) video.currentTime = a;
      timeLabel.textContent = fmt(video.currentTime) + ' / ' + fmt(video.duration) + '  · frame ' + Math.floor(video.currentTime * fps);
      fill.style.width = (video.currentTime / video.duration * 100) + '%';
    }
    raf = requestAnimationFrame(tick);
  }
  const presets = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2].map(r => el('button', { class: 'btn small', onclick: () => setRate(r) }, r + '×'));

  render(root,
    dropZone('Drop a video file or click to choose', files => {
      const f = files[0]; if (url) URL.revokeObjectURL(url); url = URL.createObjectURL(f);
      video.src = url; video.style.display = 'block'; clearAB(); setRate(1); video.preservesPitch = pitchIn.checked;
    }, 'video/*', false),
    video, bar,
    el('div', { class: 'row' }, timeLabel, el('span', { class: 'grow' }), abLabel),
    el('div', { class: 'row' }, el('span', { class: 'small muted' }, 'Speed'), rateIn, rateLabel, presets),
    el('div', { class: 'row' },
      el('button', { class: 'btn', onclick: setA }, 'Set A'), el('button', { class: 'btn', onclick: setB }, 'Set B'), loopBtn,
      el('button', { class: 'btn ghost', onclick: clearAB }, 'Clear A-B'),
      el('span', { class: 'grow' }),
      el('button', { class: 'btn', onclick: () => step(-1) }, '◀ frame'), el('button', { class: 'btn', onclick: () => step(1) }, 'frame ▶'),
      field('FPS', fpsIn), el('label', { class: 'inline' }, pitchIn, 'Keep pitch')),
    el('div', { class: 'panel small muted' },
      'Shortcuts: ', el('span', { class: 'kbd' }, 'Space'), ' play/pause · ', el('span', { class: 'kbd' }, ','), ' / ', el('span', { class: 'kbd' }, '.'), ' step one frame · ',
      el('span', { class: 'kbd' }, '←'), ' / ', el('span', { class: 'kbd' }, '→'), ' skip 2 s · ', el('span', { class: 'kbd' }, '['), ' set A · ', el('span', { class: 'kbd' }, ']'), ' set B · ',
      el('span', { class: 'kbd' }, 'L'), ' toggle loop · ', el('span', { class: 'kbd' }, '-'), ' / ', el('span', { class: 'kbd' }, '+'), ' speed · ', el('span', { class: 'kbd' }, '0'), ' reset speed · ', el('span', { class: 'kbd' }, 'Home'), ' go to A'));
  raf = requestAnimationFrame(tick);

  function onKey(e) {
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName) || !video.src) return;
    const k = e.key;
    if (k === ' ') { e.preventDefault(); video.paused ? video.play() : video.pause(); }
    else if (k === ',') step(-1); else if (k === '.') step(1);
    else if (k === 'ArrowLeft') video.currentTime = Math.max(0, video.currentTime - 2);
    else if (k === 'ArrowRight') video.currentTime = Math.min(video.duration, video.currentTime + 2);
    else if (k === '[') setA(); else if (k === ']') setB();
    else if (k === 'l' || k === 'L') setLoop(!looping);
    else if (k === '-' || k === '_') setRate(video.playbackRate - 0.05);
    else if (k === '+' || k === '=') setRate(video.playbackRate + 0.05);
    else if (k === '0') setRate(1);
    else if (k === 'Home') video.currentTime = a ?? 0;
    else return;
    e.preventDefault();
  }
  window.addEventListener('keydown', onKey);
  return () => { cancelAnimationFrame(raf); window.removeEventListener('keydown', onKey); video.pause(); video.removeAttribute('src'); if (url) URL.revokeObjectURL(url); };
}
