// Podcast chapter markers: load audio, play, add chapters at the current time, edit them,
// and export/import as plain-text timestamps or JSON.
import { el, render, store, dropZone, download, copy, toast, pad, uid } from '../../lib/ui.js';

const fmt = t => { t = Math.max(0, Math.floor(t)); return `${pad(Math.floor(t / 3600))}:${pad(Math.floor(t / 60) % 60)}:${pad(t % 60)}`; };
const parseT = str => {
  const p = String(str).trim().split(':').map(Number);
  if (p.some(isNaN) || !p.length) return null;
  return p.reduce((a, b) => a * 60 + b, 0);
};

export default function (root) {
  const s = store('chapter-markers');
  let chapters = [], key = null, url = null;
  const audio = el('audio', { controls: true, style: { width: '100%', display: 'none' } });
  const fileLabel = el('div', { class: 'muted small' }, 'No file loaded. You can still add chapters by typing times.');
  const titleIn = el('input', { class: 'input grow', placeholder: 'Chapter title', onkeydown: e => { if (e.key === 'Enter') add(); } });
  const list = el('div', { class: 'col' });
  const exportOut = el('pre', { class: 'out', style: { minHeight: '60px' } });
  const importTa = el('textarea', { class: 'textarea', style: { minHeight: '90px' }, placeholder: '00:00:00 Intro\n00:02:30 First topic\n… or a JSON array of {"start": seconds, "title": "…"}' });

  function load() { chapters = (s.get(key || '_untitled', []) || []).map(c => ({ ...c, id: c.id || uid() })); }
  function save() { s.set(key || '_untitled', chapters.map(({ start, title }) => ({ start, title }))); }
  function sortChapters() { chapters.sort((a, b) => a.start - b.start); }

  function add() {
    const title = titleIn.value.trim() || `Chapter ${chapters.length + 1}`;
    chapters.push({ id: uid(), start: audio.src ? audio.currentTime : (chapters.length ? chapters[chapters.length - 1].start + 60 : 0), title });
    sortChapters(); save(); titleIn.value = ''; renderList(); toast('Chapter added');
  }
  function renderList() {
    if (!chapters.length) { render(list, el('div', { class: 'muted' }, 'No chapters yet.')); renderExport(); return; }
    render(list, chapters.map((c, i) => {
      const timeIn = el('input', { class: 'input mono', value: fmt(c.start), style: { width: '100px' }, onchange: e => {
        const t = parseT(e.target.value); if (t == null) { e.target.value = fmt(c.start); return; }
        c.start = t; sortChapters(); save(); renderList();
      } });
      const tIn = el('input', { class: 'input grow', value: c.title, style: { minWidth: '140px' }, oninput: e => { c.title = e.target.value; save(); renderExport(); } });
      return el('div', { class: 'row', style: { margin: '4px 0' } },
        el('span', { class: 'muted small', style: { width: '22px' } }, i + 1),
        timeIn, tIn,
        el('button', { class: 'btn small', title: 'Jump here', disabled: !audio.src, onclick: () => { audio.currentTime = c.start; audio.play(); } }, '▶'),
        el('button', { class: 'btn small ghost', title: 'Set to current playhead', disabled: !audio.src, onclick: () => { c.start = audio.currentTime; sortChapters(); save(); renderList(); } }, '⏱'),
        el('button', { class: 'btn small danger', onclick: () => { chapters.splice(i, 1); save(); renderList(); } }, '×'));
    }));
    renderExport();
  }
  const asText = () => chapters.map(c => `${fmt(c.start)} ${c.title}`).join('\n');
  const asJson = () => JSON.stringify({ file: key, chapters: chapters.map(c => ({ start: Math.round(c.start * 1000) / 1000, startTime: fmt(c.start), title: c.title })) }, null, 2);
  function renderExport() { exportOut.textContent = asText() || '(nothing yet)'; }

  function importText(txt) {
    txt = txt.trim(); if (!txt) return;
    let out = [];
    try {
      const j = JSON.parse(txt); const arr = Array.isArray(j) ? j : j.chapters;
      if (Array.isArray(arr)) out = arr.map(c => ({ start: typeof c.start === 'number' ? c.start : parseT(c.start ?? c.startTime ?? c.time) ?? 0, title: String(c.title ?? c.name ?? '') }));
    } catch {
      for (const line of txt.split(/\r?\n/)) {
        const m = line.match(/^\s*[\[(]?(\d{1,2}(?::\d{1,2}){1,2})[\])]?\s*[-–—:]?\s*(.*)$/);
        if (m) { const t = parseT(m[1]); if (t != null) out.push({ start: t, title: m[2].trim() }); }
      }
    }
    if (!out.length) { toast('Nothing recognised'); return; }
    chapters = out.map(c => ({ ...c, id: uid() })); sortChapters(); save(); renderList(); toast(`Imported ${out.length} chapters`);
  }

  const bigTime = el('span', { class: 'mono' }, '00:00:00');
  audio.addEventListener('timeupdate', () => { bigTime.textContent = fmt(audio.currentTime); });

  render(root,
    dropZone('Drop an audio file (mp3, m4a, wav…) or click to choose', files => {
      const f = files[0]; if (url) URL.revokeObjectURL(url); url = URL.createObjectURL(f);
      audio.src = url; audio.style.display = 'block'; key = f.name; fileLabel.textContent = f.name; load(); renderList();
    }, 'audio/*', false),
    fileLabel, audio,
    el('div', { class: 'row' },
      el('button', { class: 'btn primary', onclick: add }, '+ Add chapter at ', bigTime),
      titleIn),
    el('h3', { style: { margin: '12px 0 4px' } }, 'Chapters'),
    list,
    el('div', { class: 'grid2' },
      el('div', { class: 'col' },
        el('h3', { style: { margin: '12px 0 0' } }, 'Export'),
        exportOut,
        el('div', { class: 'row' },
          el('button', { class: 'btn', onclick: () => copy(asText()) }, 'Copy text'),
          el('button', { class: 'btn', onclick: () => download((key || 'chapters').replace(/\.[^.]+$/, '') + '-chapters.txt', asText()) }, 'Download .txt'),
          el('button', { class: 'btn', onclick: () => download((key || 'chapters').replace(/\.[^.]+$/, '') + '-chapters.json', asJson(), 'application/json') }, 'Download .json'))),
      el('div', { class: 'col' },
        el('h3', { style: { margin: '12px 0 0' } }, 'Import'),
        importTa,
        el('div', { class: 'row' },
          el('button', { class: 'btn', onclick: () => importText(importTa.value) }, 'Import from text'),
          dropZone('…or drop a .txt / .json', async f => importText(await f[0].text()), '.txt,.json,text/plain,application/json', false)))),
    el('p', { class: 'muted small' }, 'Chapters are saved per file name in this browser. Keyboard: press M to add a chapter at the playhead.'));
  load(); renderList();

  function onKey(e) {
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
    if (e.key === 'm' || e.key === 'M') add();
    else if (e.key === ' ' && audio.src) { e.preventDefault(); audio.paused ? audio.play() : audio.pause(); }
  }
  window.addEventListener('keydown', onKey);
  return () => { window.removeEventListener('keydown', onKey); audio.pause(); audio.removeAttribute('src'); if (url) URL.revokeObjectURL(url); };
}
