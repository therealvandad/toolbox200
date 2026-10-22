// Soundboard: a grid of clips from audio files or microphone recordings, with hotkeys, per-clip volume
// and stop-all. Clips are stored as data URLs in localStorage (with a size warning).
import { el, render, store, dropZone, readFile, download, toast, fmtBytes, uid } from '../../lib/ui.js';

const LIMIT = 4 * 1024 * 1024; // bytes of localStorage we are willing to use

export default function (root) {
  const s = store('soundboard');
  let clips = s.get('clips', []);
  let editing = null, playing = new Set(), stream = null, rec = null, chunks = [], recTimer = null, recStart = 0;

  function totalBytes() { return clips.reduce((a, c) => a + (c.data ? c.data.length : 0), 0); }
  function save(justAdded) {
    let before = totalBytes();
    try { localStorage.setItem('tb200:soundboard:clips', JSON.stringify(clips)); }
    catch { toast('Storage is full — the clip could not be saved'); if (justAdded) { clips = clips.filter(c => c !== justAdded); before = totalBytes(); } }
    sizeInfo.textContent = `${clips.length} clips · ${fmtBytes(before)} stored`;
    sizeInfo.className = 'small ' + (before > LIMIT ? 'badge danger' : before > LIMIT * 0.7 ? 'badge warn' : 'muted');
    if (before > LIMIT) sizeInfo.textContent += ' — over the ~4 MB budget, browsers may refuse to save more';
  }
  function play(c) {
    const a = new Audio(c.data); a.volume = c.vol ?? 1;
    playing.add(a); a.addEventListener('ended', () => playing.delete(a));
    a.play().catch(() => toast('Could not play clip'));
    const b = grid.querySelector(`[data-id="${c.id}"]`); if (b) { b.style.transform = 'scale(0.96)'; b.style.borderColor = 'var(--accent)'; setTimeout(() => { b.style.transform = ''; b.style.borderColor = ''; }, 150); }
  }
  function stopAll() { playing.forEach(a => { a.pause(); a.currentTime = 0; }); playing.clear(); }
  async function addFiles(files) {
    for (const f of files) {
      if (f.size > 2.5 * 1024 * 1024) { toast(`${f.name} is ${fmtBytes(f.size)} — too big to store, keep clips under 2.5 MB`); continue; }
      const data = await readFile(f, 'dataURL');
      const clip = { id: uid(), name: f.name.replace(/\.[^.]+$/, ''), key: '', vol: 1, data };
      clips.push(clip); save(clip);
    }
    renderGrid();
  }

  // recording
  const recBtn = el('button', { class: 'btn', onclick: () => (rec ? stopRec() : startRec()) }, '● Record clip');
  const recStatus = el('span', { class: 'mono small muted' });
  async function startRec() {
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch (e) { toast('Microphone failed: ' + (e.message || e)); return; }
    const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4', ''].find(m => !m || MediaRecorder.isTypeSupported(m));
    rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined); chunks = [];
    rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    rec.onstop = async () => {
      const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
      stream.getTracks().forEach(t => t.stop()); stream = null; rec = null; clearInterval(recTimer);
      recBtn.textContent = '● Record clip'; recBtn.classList.remove('danger'); recStatus.textContent = '';
      if (blob.size > 2.5 * 1024 * 1024) { toast('Recording too large to store'); return; }
      const data = await readFile(blob, 'dataURL');
      const clip = { id: uid(), name: 'Recording ' + (clips.length + 1), key: '', vol: 1, data };
      clips.push(clip); save(clip); renderGrid();
    };
    rec.start(); recStart = performance.now();
    recBtn.textContent = '■ Stop'; recBtn.classList.add('danger');
    recTimer = setInterval(() => { recStatus.textContent = ((performance.now() - recStart) / 1000).toFixed(1) + ' s'; if (performance.now() - recStart > 30000) stopRec(); }, 100);
  }
  function stopRec() { if (rec && rec.state !== 'inactive') rec.stop(); }

  // grid
  const grid = el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px' } });
  const editor = el('div', { class: 'panel col hidden' });
  function renderGrid() {
    if (!clips.length) { render(grid, el('div', { class: 'muted', style: { gridColumn: '1/-1' } }, 'No clips yet — drop audio files or record one.')); return; }
    render(grid, clips.map(c => el('button', { class: 'btn', 'data-id': c.id, style: { minHeight: '80px', display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '4px', textAlign: 'left', transition: 'transform .08s' }, onclick: () => play(c), oncontextmenu: e => { e.preventDefault(); openEditor(c); } },
      el('div', { style: { fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, c.name),
      el('div', { class: 'row', style: { margin: 0, justifyContent: 'space-between' } },
        c.key ? el('span', { class: 'kbd' }, c.key.toUpperCase()) : el('span', { class: 'muted small' }, 'no key'),
        el('span', { class: 'small muted', title: 'Edit', style: { padding: '0 4px' }, onclick: e => { e.stopPropagation(); openEditor(c); } }, '⚙')))));
  }
  function openEditor(c) {
    editing = c; editor.classList.remove('hidden');
    const keyIn = el('input', { class: 'input mono', value: c.key, style: { width: '90px' }, placeholder: 'press key', onkeydown: e => {
      e.preventDefault(); if (e.key === 'Backspace' || e.key === 'Escape') { c.key = ''; } else if (e.key.length === 1 || /^F\d+$/.test(e.key)) c.key = e.key.toLowerCase();
      keyIn.value = c.key; save(); renderGrid();
    } });
    render(editor,
      el('div', { class: 'row' },
        el('label', { class: 'field' }, 'Name', el('input', { class: 'input', value: c.name, oninput: e => { c.name = e.target.value; save(); renderGrid(); } })),
        el('label', { class: 'field' }, 'Hotkey', keyIn),
        el('label', { class: 'field' }, 'Volume', el('input', { type: 'range', min: 0, max: 1, step: 0.05, value: c.vol ?? 1, oninput: e => { c.vol = +e.target.value; save(); } })),
        el('span', { class: 'muted small' }, fmtBytes(c.data.length))),
      el('div', { class: 'row' },
        el('button', { class: 'btn small', onclick: () => play(c) }, 'Preview'),
        el('button', { class: 'btn small', onclick: () => { const m = c.data.match(/^data:([^;]+)/); const ext = m && m[1].includes('mp3') ? 'mp3' : m && m[1].includes('wav') ? 'wav' : m && m[1].includes('ogg') ? 'ogg' : m && m[1].includes('mp4') ? 'm4a' : 'webm'; fetch(c.data).then(r => r.blob()).then(b => download(c.name + '.' + ext, b)); } }, 'Download'),
        el('button', { class: 'btn small', onclick: () => { const i = clips.indexOf(c); if (i > 0) { clips.splice(i, 1); clips.splice(i - 1, 0, c); save(); renderGrid(); } } }, '← Move'),
        el('button', { class: 'btn small', onclick: () => { const i = clips.indexOf(c); if (i < clips.length - 1) { clips.splice(i, 1); clips.splice(i + 1, 0, c); save(); renderGrid(); } } }, 'Move →'),
        el('span', { class: 'grow' }),
        el('button', { class: 'btn small danger', onclick: () => { clips = clips.filter(x => x !== c); save(); renderGrid(); closeEditor(); } }, 'Delete'),
        el('button', { class: 'btn small ghost', onclick: closeEditor }, 'Close')));
  }
  function closeEditor() { editing = null; editor.classList.add('hidden'); render(editor); }
  const sizeInfo = el('span', { class: 'muted small' });

  render(root,
    el('div', { class: 'row' },
      dropZone('Drop audio files or click to add', addFiles, 'audio/*', true),
      recBtn, recStatus,
      el('span', { class: 'grow' }),
      el('button', { class: 'btn danger', onclick: stopAll }, 'Stop all')),
    grid, editor,
    el('div', { class: 'row' }, sizeInfo, el('span', { class: 'grow' }),
      el('button', { class: 'btn small ghost', onclick: () => { if (!clips.length) return; clips = []; save(); renderGrid(); closeEditor(); toast('All clips removed'); } }, 'Remove all')),
    el('p', { class: 'muted small' }, 'Click a pad or press its hotkey to play (clips can overlap). Click ⚙ or right-click a pad to rename it, set a key or volume. Esc stops everything. Clips live in this browser\'s localStorage, so keep them short — about 4 MB fits in total.'));
  renderGrid(); save();

  function onKey(e) {
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
    if (e.key === 'Escape') { stopAll(); return; }
    if (e.repeat) return;
    const c = clips.find(c => c.key && c.key === e.key.toLowerCase());
    if (c) { e.preventDefault(); play(c); }
  }
  window.addEventListener('keydown', onKey);
  return () => {
    window.removeEventListener('keydown', onKey); stopAll(); clearInterval(recTimer);
    if (rec && rec.state !== 'inactive') { rec.onstop = null; try { rec.stop(); } catch {} }
    if (stream) stream.getTracks().forEach(t => t.stop());
  };
}
