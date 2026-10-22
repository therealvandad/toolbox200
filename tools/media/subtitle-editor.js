// Subtitle editor: load a video and optionally an .srt/.vtt, edit a cue list, add cues at the playhead,
// see them live over the video and export .srt or .vtt.
import { el, render, store, dropZone, download, toast, pad, uid } from '../../lib/ui.js';

const fmtSrt = t => { const ms = Math.round(t * 1000); return `${pad(Math.floor(ms / 3600000))}:${pad(Math.floor(ms / 60000) % 60)}:${pad(Math.floor(ms / 1000) % 60)},${pad(ms % 1000, 3)}`; };
const fmtVtt = t => fmtSrt(t).replace(',', '.');
const parseTime = s => {
  const m = String(s).trim().match(/^(?:(\d+):)?(\d{1,2}):(\d{1,2})[,.](\d{1,3})$/);
  if (!m) { const n = parseFloat(s); return isNaN(n) ? null : n; }
  return (+(m[1] || 0)) * 3600 + (+m[2]) * 60 + (+m[3]) + (+m[4].padEnd(3, '0')) / 1000;
};
function parseSubs(text) {
  const cues = [];
  const blocks = text.replace(/\r/g, '').replace(/^WEBVTT[^\n]*\n/, '').split(/\n\s*\n/);
  for (const b of blocks) {
    const lines = b.split('\n').filter(l => l.trim() !== '');
    const ti = lines.findIndex(l => l.includes('-->'));
    if (ti < 0) continue;
    const [a, c] = lines[ti].split('-->');
    const start = parseTime(a), end = parseTime(c.trim().split(/\s+/)[0]);
    if (start == null || end == null) continue;
    cues.push({ id: uid(), start, end, text: lines.slice(ti + 1).join('\n').replace(/<[^>]+>/g, '') });
  }
  return cues;
}

export default function (root) {
  const s = store('subtitle-editor');
  let cues = [], key = '_untitled', url = null, raf = 0, activeId = null;
  const video = el('video', { controls: true, playsInline: true, style: { width: '100%', maxHeight: '360px', display: 'block', background: '#000' } });
  const overlay = el('div', { style: { position: 'absolute', left: 0, right: 0, bottom: '12%', textAlign: 'center', pointerEvents: 'none', padding: '0 6%' } });
  const overlayText = el('span', { style: { display: 'inline-block', background: 'rgba(0,0,0,.65)', color: '#fff', padding: '4px 10px', borderRadius: '4px', fontSize: 'clamp(13px, 2.4vw, 22px)', whiteSpace: 'pre-wrap', lineHeight: 1.3 } });
  overlay.append(overlayText);
  const stage = el('div', { style: { position: 'relative', maxWidth: '100%', display: 'none' } }, video, overlay);
  const fileLabel = el('div', { class: 'muted small' }, 'No video loaded — you can still write cues and export them.');
  const list = el('div', { class: 'col' });
  const timeLabel = el('span', { class: 'mono' }, '00:00:00,000');
  const newText = el('textarea', { class: 'textarea prose', style: { minHeight: '56px' }, placeholder: 'Cue text (Ctrl+Enter adds it at the playhead)', onkeydown: e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); addCue(); } } });
  const durIn = el('input', { class: 'input', type: 'number', min: 0.2, step: 0.1, value: 2.5, style: { width: '80px' }, title: 'Default cue length (s)' });

  function load() { cues = (s.get(key, []) || []).map(c => ({ ...c, id: uid() })); }
  function save() { s.set(key, cues.map(({ start, end, text }) => ({ start, end, text }))); }
  function sortCues() { cues.sort((a, b) => a.start - b.start); }
  function addCue() {
    const text = newText.value.trim(); if (!text) { toast('Type the cue text first'); newText.focus(); return; }
    const start = video.src ? video.currentTime : (cues.length ? cues[cues.length - 1].end + 0.5 : 0);
    cues.push({ id: uid(), start, end: start + (+durIn.value || 2), text });
    sortCues(); save(); newText.value = ''; renderList(); toast('Cue added');
  }
  function renderList() {
    if (!cues.length) { render(list, el('div', { class: 'muted' }, 'No cues yet.')); return; }
    render(list, cues.map((c, i) => {
      const st = el('input', { class: 'input mono small', value: fmtSrt(c.start), style: { width: '120px' }, onchange: e => { const t = parseTime(e.target.value); if (t == null) { e.target.value = fmtSrt(c.start); return; } c.start = t; sortCues(); save(); renderList(); } });
      const en = el('input', { class: 'input mono small', value: fmtSrt(c.end), style: { width: '120px' }, onchange: e => { const t = parseTime(e.target.value); if (t == null) { e.target.value = fmtSrt(c.end); return; } c.end = t; save(); } });
      const tx = el('textarea', { class: 'textarea prose', style: { minHeight: '40px', fontSize: '14px' }, value: c.text, oninput: e => { c.text = e.target.value; save(); } });
      const row = el('div', { class: 'panel col', style: { gap: '6px', borderColor: c.id === activeId ? 'var(--accent)' : '' }, 'data-id': c.id },
        el('div', { class: 'row', style: { margin: 0 } },
          el('span', { class: 'muted small', style: { width: '24px' } }, i + 1), st, el('span', { class: 'muted' }, '→'), en,
          el('button', { class: 'btn small', disabled: !video.src, title: 'Seek', onclick: () => { video.currentTime = c.start; } }, '▶'),
          el('button', { class: 'btn small ghost', disabled: !video.src, title: 'Start = playhead', onclick: () => { c.start = video.currentTime; if (c.end <= c.start) c.end = c.start + 1; sortCues(); save(); renderList(); } }, '[ now'),
          el('button', { class: 'btn small ghost', disabled: !video.src, title: 'End = playhead', onclick: () => { c.end = Math.max(c.start + 0.1, video.currentTime); save(); renderList(); } }, 'now ]'),
          el('span', { class: 'grow' }),
          el('button', { class: 'btn small danger', onclick: () => { cues.splice(i, 1); save(); renderList(); } }, '×')),
        tx);
      return row;
    }));
  }
  function tickOverlay() {
    const t = video.currentTime;
    timeLabel.textContent = fmtSrt(t);
    const cur = cues.find(c => t >= c.start && t < c.end);
    const id = cur ? cur.id : null;
    overlayText.textContent = cur ? cur.text : ''; overlayText.style.display = cur ? 'inline-block' : 'none';
    if (id !== activeId) {
      activeId = id;
      for (const n of list.children) { n.style.borderColor = n.dataset.id === id ? 'var(--accent)' : ''; }
    }
    raf = requestAnimationFrame(tickOverlay);
  }
  const toSrt = () => cues.map((c, i) => `${i + 1}\n${fmtSrt(c.start)} --> ${fmtSrt(c.end)}\n${c.text}`).join('\n\n') + '\n';
  const toVtt = () => 'WEBVTT\n\n' + cues.map((c, i) => `${i + 1}\n${fmtVtt(c.start)} --> ${fmtVtt(c.end)}\n${c.text}`).join('\n\n') + '\n';
  const base = () => key.replace(/\.[^.]+$/, '') || 'subtitles';

  render(root,
    el('div', { class: 'grid2' },
      dropZone('Drop a video or click to choose', files => {
        const f = files[0]; if (url) URL.revokeObjectURL(url); url = URL.createObjectURL(f);
        video.src = url; stage.style.display = 'block'; key = f.name; fileLabel.textContent = f.name; load(); renderList();
      }, 'video/*', false),
      dropZone('Drop an .srt / .vtt to import (optional)', async files => {
        const parsed = parseSubs(await files[0].text());
        if (!parsed.length) { toast('No cues found in that file'); return; }
        cues = parsed; sortCues(); save(); renderList(); toast(`Imported ${parsed.length} cues`);
      }, '.srt,.vtt,text/plain,text/vtt', false)),
    fileLabel, stage,
    el('div', { class: 'row' }, el('span', { class: 'muted small' }, 'Playhead'), timeLabel, el('span', { class: 'muted small' }, '· default length'), durIn, el('span', { class: 'muted small' }, 's')),
    newText,
    el('div', { class: 'row' },
      el('button', { class: 'btn primary', onclick: addCue }, '+ Add cue at playhead'),
      el('span', { class: 'grow' }),
      el('button', { class: 'btn', onclick: () => download(base() + '.srt', toSrt()) }, 'Export .srt'),
      el('button', { class: 'btn', onclick: () => download(base() + '.vtt', toVtt(), 'text/vtt') }, 'Export .vtt'),
      el('button', { class: 'btn ghost', onclick: () => { cues = []; save(); renderList(); } }, 'Clear all')),
    el('h3', { style: { margin: '10px 0 4px' } }, 'Cues'),
    list,
    el('p', { class: 'muted small' }, 'Cues are saved per video name in this browser. Keys (outside text fields): Space play/pause, ← → skip 1 s, N add cue from the text box.'));
  load(); renderList();
  raf = requestAnimationFrame(tickOverlay);

  function onKey(e) {
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName) || !video.src) return;
    if (e.key === ' ') { e.preventDefault(); video.paused ? video.play() : video.pause(); }
    else if (e.key === 'ArrowLeft') video.currentTime = Math.max(0, video.currentTime - 1);
    else if (e.key === 'ArrowRight') video.currentTime = Math.min(video.duration || 0, video.currentTime + 1);
    else if (e.key === 'n' || e.key === 'N') addCue();
  }
  window.addEventListener('keydown', onKey);
  return () => { cancelAnimationFrame(raf); window.removeEventListener('keydown', onKey); video.pause(); video.removeAttribute('src'); if (url) URL.revokeObjectURL(url); };
}
