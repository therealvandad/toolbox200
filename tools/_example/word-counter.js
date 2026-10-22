// REFERENCE TOOL: the contract every tool follows.
// A tool module default-exports render(root, ctx). It builds its UI inside `root`
// (a <div class="tool">) and may return a cleanup function (timers, listeners, media streams).
import { el, render, store, copy, download, stat } from '../../lib/ui.js';

export default function (root) {
  const s = store('word-counter');                 // namespaced localStorage
  const ta = el('textarea', { class: 'textarea prose', placeholder: 'Paste or type text…', value: s.get('text', '') });
  const stats = el('div', { class: 'row' });

  function update() {
    const t = ta.value;
    const words = (t.match(/\S+/g) || []).length;
    const sentences = (t.match(/[.!?]+(\s|$)/g) || []).length;
    const minutes = words ? Math.max(1, Math.round(words / 200)) : 0;
    render(stats, stat(words, 'words'), stat(t.length, 'characters'), stat(sentences, 'sentences'), stat(minutes + ' min', 'reading time'));
    s.set('text', t);
  }

  ta.addEventListener('input', update);
  render(root,
    ta,
    stats,
    el('div', { class: 'row' },
      el('button', { class: 'btn primary', onclick: () => copy(ta.value) }, 'Copy'),
      el('button', { class: 'btn', onclick: () => download('text.txt', ta.value) }, 'Download .txt'),
      el('button', { class: 'btn ghost', onclick: () => { ta.value = ''; update(); } }, 'Clear')));
  update();
  // return () => { /* cleanup */ };
}
