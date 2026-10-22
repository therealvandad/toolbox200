// Karaoke: load a song, paste lyrics, tap to time each line while it plays, then sing along with the
// current line highlighted. Timings are saved per file and can be exported as LRC.
import { el, render, store, dropZone, download, copy, toast, pad } from '../../lib/ui.js';

const lrcTime = t => `[${pad(Math.floor(t / 60))}:${pad(Math.floor(t % 60))}.${pad(Math.floor((t % 1) * 100))}]`;
const parseLrcLine = l => { const m = l.match(/^\s*\[(\d+):(\d+(?:\.\d+)?)\]\s?(.*)$/); return m ? { t: +m[1] * 60 + +m[2], text: m[3] } : null; };

export default function (root) {
  const s = store('karaoke');
  let key = '_untitled', url = null, raf = 0, mode = 'edit', lines = [], times = [], tapIdx = 0, activeIdx = -1;
  const audio = el('audio', { controls: true, style: { width: '100%', display: 'none' } });
  const fileLabel = el('div', { class: 'muted small' }, 'No song loaded.');
  const ta = el('textarea', { class: 'textarea prose', style: { minHeight: '160px' }, placeholder: 'Paste lyrics here, one line per lyric line.\nAn existing .lrc file ([00:12.50]line) is recognised too.' });
  const display = el('div', { class: 'panel', style: { height: '320px', overflowY: 'auto', scrollBehavior: 'smooth', textAlign: 'center', fontSize: '20px', lineHeight: 1.7 } });
  const modeLabel = el('span', { class: 'badge' }, 'Lyrics');
  const tapBtn = el('button', { class: 'btn primary', style: { padding: '14px 28px', fontSize: '16px' }, onclick: tap }, 'Tap: next line');
  const lineEls = [];

  function load() { const saved = s.get(key); if (saved && saved.lines) { lines = saved.lines; times = saved.times; ta.value = lines.join('\n'); } }
  function save() { s.set(key, { lines, times }); }
  function setLyrics() {
    const raw = ta.value.split(/\r?\n/).map(l => l.trimEnd()).filter(l => l.trim() !== '');
    const parsed = raw.map(parseLrcLine);
    if (raw.length && parsed.every(Boolean)) { lines = parsed.map(p => p.text || '♪'); times = parsed.map(p => p.t); toast('Loaded timed LRC lyrics'); }
    else { lines = raw; times = raw.map((_, i) => (times[i] != null && lines.length === raw.length ? times[i] : null)); }
    save(); buildDisplay(); setMode(times.length && times.every(t => t != null) ? 'play' : 'edit');
  }
  function buildDisplay() {
    lineEls.length = 0;
    render(display, el('div', { style: { height: '130px' } }),
      lines.length ? lines.map((l, i) => { const d = el('div', { style: { padding: '2px 8px', borderRadius: '6px', cursor: 'pointer', transition: 'all .15s' }, onclick: () => { if (times[i] != null && audio.src) { audio.currentTime = times[i]; audio.play(); } } }, l); lineEls.push(d); return d; }) : el('div', { class: 'muted' }, 'No lyrics yet.'),
      el('div', { style: { height: '160px' } }));
    paint();
  }
  function paint() {
    lineEls.forEach((d, i) => {
      const timed = times[i] != null;
      const isCur = mode === 'tap' ? i === tapIdx : i === activeIdx;
      d.style.color = isCur ? 'var(--accent)' : timed ? 'var(--text)' : 'var(--muted)';
      d.style.fontWeight = isCur ? 700 : 400; d.style.fontSize = isCur ? '1.25em' : '1em';
      d.style.background = isCur ? 'var(--bg)' : '';
      d.title = timed ? lrcTime(times[i]) : 'not timed';
    });
  }
  function setMode(m) {
    mode = m; tapIdx = times.findIndex(t => t == null); if (tapIdx < 0) tapIdx = 0;
    modeLabel.textContent = m === 'tap' ? 'Tap timing' : m === 'play' ? 'Sing along' : 'Lyrics';
    modeLabel.className = 'badge' + (m === 'tap' ? ' warn' : m === 'play' ? ' ok' : '');
    tapBtn.style.display = m === 'tap' ? '' : 'none';
    paint();
    if (m === 'tap' && lineEls[tapIdx]) scrollTo(tapIdx);
  }
  function scrollTo(i) { const d = lineEls[i]; if (d) display.scrollTop = d.offsetTop - display.clientHeight / 2 + d.offsetHeight / 2; }
  function tap() {
    if (mode !== 'tap' || !lines.length) return;
    if (!audio.src) { toast('Load a song first'); return; }
    if (audio.paused) audio.play();
    times[tapIdx] = audio.currentTime; save();
    tapIdx++;
    if (tapIdx >= lines.length) { toast('All lines timed'); setMode('play'); return; }
    paint(); scrollTo(tapIdx);
  }
  function startTap() {
    if (!lines.length) { setLyrics(); if (!lines.length) { toast('Paste lyrics first'); return; } }
    times = lines.map(() => null); save(); setMode('tap');
    if (audio.src) { audio.currentTime = 0; audio.play(); }
  }
  function tick() {
    raf = requestAnimationFrame(tick);
    if (mode !== 'play' || !audio.src) return;
    const t = audio.currentTime; let idx = -1;
    for (let i = 0; i < times.length; i++) if (times[i] != null && times[i] <= t) idx = i;
    if (idx !== activeIdx) { activeIdx = idx; paint(); if (idx >= 0) scrollTo(idx); }
  }
  const toLrc = () => lines.map((l, i) => (times[i] != null ? lrcTime(times[i]) : '[00:00.00]') + l).join('\n') + '\n';

  render(root,
    dropZone('Drop a song (mp3, m4a, wav…) or click to choose', files => {
      const f = files[0]; if (url) URL.revokeObjectURL(url); url = URL.createObjectURL(f);
      audio.src = url; audio.style.display = 'block'; key = f.name; fileLabel.textContent = f.name; load(); buildDisplay(); setMode(times.length && times.every(t => t != null) ? 'play' : 'edit');
    }, 'audio/*', false),
    fileLabel, audio,
    el('div', { class: 'grid2' },
      el('div', { class: 'col' },
        ta,
        el('div', { class: 'row' },
          el('button', { class: 'btn', onclick: setLyrics }, 'Use these lyrics'),
          el('button', { class: 'btn primary', onclick: startTap }, 'Start tap timing'),
          el('button', { class: 'btn', onclick: () => setMode('play') }, 'Sing along'))),
      el('div', { class: 'col' },
        el('div', { class: 'row' }, modeLabel, el('span', { class: 'grow' }), tapBtn),
        display)),
    el('div', { class: 'row' },
      el('button', { class: 'btn', onclick: () => copy(toLrc()) }, 'Copy LRC'),
      el('button', { class: 'btn', onclick: () => download(key.replace(/\.[^.]+$/, '') + '.lrc', toLrc()) }, 'Download .lrc'),
      el('button', { class: 'btn ghost', onclick: () => { times = lines.map(() => null); save(); setMode('edit'); } }, 'Clear timings')),
    el('p', { class: 'muted small' }, 'While tap timing: press Space or Enter (outside text fields) the moment each line starts. Click a timed line to jump to it. Timings are saved per song file name.'));
  load(); buildDisplay(); setMode(times.length && times.every(t => t != null) ? 'play' : 'edit');
  raf = requestAnimationFrame(tick);

  function onKey(e) {
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (mode === 'tap') tap(); else if (audio.src) (audio.paused ? audio.play() : audio.pause()); }
    else if (e.key === 'Backspace' && mode === 'tap' && tapIdx > 0) { e.preventDefault(); tapIdx--; times[tapIdx] = null; save(); paint(); scrollTo(tapIdx); }
  }
  window.addEventListener('keydown', onKey);
  return () => { cancelAnimationFrame(raf); window.removeEventListener('keydown', onKey); audio.pause(); audio.removeAttribute('src'); if (url) URL.revokeObjectURL(url); };
}
