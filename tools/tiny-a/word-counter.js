import { el, render, store, copy, download, stat } from '../../lib/ui.js';

export default function (root) {
  const s = store('word-counter');
  const ta = el('textarea', { class: 'textarea prose', placeholder: 'Paste or type text…', value: s.get('text', ''), style: { minHeight: '200px' } });
  const stats = el('div', { class: 'row' });
  const extra = el('div', { class: 'row small muted' });
  const topWords = el('div', { class: 'row' });

  const fmtTime = (words, wpm) => {
    if (!words) return '0 s';
    const secs = Math.round((words / wpm) * 60);
    if (secs < 60) return secs + ' s';
    const m = Math.floor(secs / 60), sec = secs % 60;
    return sec ? `${m} min ${sec} s` : `${m} min`;
  };

  function update() {
    const t = ta.value;
    const wordList = t.match(/[\p{L}\p{N}'’-]+/gu) || [];
    const words = wordList.length;
    const chars = t.length;
    const charsNoSpace = t.replace(/\s/g, '').length;
    const sentences = t.trim() ? (t.match(/[^.!?…]+[.!?…]+(\s|$)|[^.!?…]+$/g) || []).length : 0;
    const paragraphs = t.trim() ? t.split(/\n\s*\n/).filter(p => p.trim()).length : 0;
    const lines = t ? t.split('\n').length : 0;
    const avgWord = words ? (wordList.join('').length / words).toFixed(1) : '0';
    const longest = wordList.reduce((a, w) => (w.length > a.length ? w : a), '');
    render(stats,
      stat(words, 'words'), stat(chars, 'characters'), stat(charsNoSpace, 'without spaces'),
      stat(sentences, 'sentences'), stat(paragraphs, 'paragraphs'), stat(lines, 'lines'),
      stat(fmtTime(words, 225), 'reading time'), stat(fmtTime(words, 150), 'speaking time'));
    render(extra, el('span', {}, `Average word length: ${avgWord}`), el('span', {}, longest ? `Longest word: ${longest}` : ''),
      el('span', {}, sentences ? `Words per sentence: ${(words / sentences).toFixed(1)}` : ''));
    const freq = new Map();
    for (const w of wordList) { const k = w.toLowerCase(); if (k.length > 3) freq.set(k, (freq.get(k) || 0) + 1); }
    const top = [...freq].sort((a, b) => b[1] - a[1]).slice(0, 8);
    render(topWords, top.length ? [el('span', { class: 'small muted' }, 'Frequent words:'), top.map(([w, n]) => el('span', { class: 'badge' }, `${w} × ${n}`))] : null);
    s.set('text', t);
  }

  ta.addEventListener('input', update);
  ta.addEventListener('keydown', e => { if (e.key === 'Escape') { ta.value = ''; update(); } });
  render(root,
    ta,
    stats,
    extra,
    topWords,
    el('div', { class: 'row' },
      el('button', { class: 'btn primary', onclick: () => copy(ta.value) }, 'Copy'),
      el('button', { class: 'btn', onclick: () => download('text.txt', ta.value) }, 'Download .txt'),
      el('button', { class: 'btn ghost', onclick: () => { ta.value = ''; update(); } }, 'Clear')));
  update();
}
