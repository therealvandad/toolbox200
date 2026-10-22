import { el, render, store, download, copy, today } from '../../lib/ui.js';

export default function (root) {
  const s = store('focus-writer');
  const ta = el('textarea', {
    class: 'textarea prose', placeholder: 'Start writing…', value: s.get('text', ''), spellcheck: 'true',
    style: { minHeight: '60vh', fontSize: '19px', lineHeight: '1.75', maxWidth: '760px', margin: '0 auto', display: 'block', border: '0', background: 'transparent', resize: 'none', outline: 'none' },
  });
  const wc = el('div', { class: 'small muted', style: { position: 'absolute', right: '14px', bottom: '10px', background: 'var(--panel)', padding: '2px 8px', borderRadius: '6px', border: '1px solid var(--line)' } });
  const saved = el('span', { class: 'small muted' }, '');
  const goalIn = el('input', { class: 'input', type: 'number', min: '0', style: { width: '90px' }, value: s.get('goal', 500) });
  const goalBar = el('div', { style: { width: '0%' } });
  const goalTxt = el('span', { class: 'small muted' });
  const stage = el('div', { style: { position: 'relative', background: 'var(--panel)', padding: '16px 8px 40px', borderRadius: '8px', border: '1px solid var(--line)' } }, ta, wc);

  const countWords = t => (t.match(/\S+/g) || []).length;
  // session goal: words relative to count when session started (reset per day or manually)
  let base = s.get('base', null);
  if (!base || base.date !== today()) { base = { date: today(), words: countWords(ta.value) }; s.set('base', base); }

  function update() {
    const t = ta.value, w = countWords(t);
    wc.textContent = `${w} words · ${t.length} chars`;
    const goal = Math.max(0, parseInt(goalIn.value) || 0);
    const done = Math.max(0, w - base.words);
    const pct = goal ? Math.min(100, Math.round(done / goal * 100)) : 0;
    goalBar.style.width = pct + '%';
    goalTxt.textContent = goal ? `Session: ${done} / ${goal} words (${pct}%)${done >= goal ? ' — goal reached!' : ''}` : 'No goal set';
  }
  let timer = null;
  function save() {
    s.set('text', ta.value); s.set('goal', parseInt(goalIn.value) || 0);
    saved.textContent = 'Saved ' + new Date().toLocaleTimeString();
  }
  ta.addEventListener('input', () => { update(); clearTimeout(timer); saved.textContent = 'Saving…'; timer = setTimeout(save, 500); });
  goalIn.addEventListener('input', () => { update(); save(); });

  const fsBtn = el('button', { class: 'btn', onclick: toggleFs }, 'Fullscreen');
  function toggleFs() {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (stage.requestFullscreen) stage.requestFullscreen().catch(() => {});
  }
  function onFs() {
    const on = document.fullscreenElement === stage;
    Object.assign(stage.style, on ? { padding: '8vh 16px', overflow: 'auto' } : { padding: '16px 8px 40px', overflow: '' });
    ta.style.minHeight = on ? '84vh' : '60vh';
    fsBtn.textContent = on ? 'Exit fullscreen' : 'Fullscreen';
  }
  document.addEventListener('fullscreenchange', onFs);

  const mdTitle = () => (ta.value.trim().split('\n')[0] || 'writing').replace(/^#+\s*/, '').slice(0, 40).replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') || 'writing';
  render(root,
    el('div', { class: 'row' },
      el('label', { class: 'inline' }, 'Session word goal', goalIn),
      el('button', { class: 'btn small ghost', onclick: () => { base = { date: today(), words: countWords(ta.value) }; s.set('base', base); update(); } }, 'Restart session'),
      el('span', { class: 'grow' }), saved),
    el('div', { class: 'bar' }, goalBar), goalTxt,
    el('div', { style: { height: '8px' } }),
    stage,
    el('div', { class: 'row' }, fsBtn,
      el('button', { class: 'btn', onclick: () => download(mdTitle() + '.txt', ta.value) }, 'Export .txt'),
      el('button', { class: 'btn', onclick: () => download(mdTitle() + '.md', ta.value, 'text/markdown') }, 'Export .md'),
      el('button', { class: 'btn', onclick: () => copy(ta.value) }, 'Copy'),
      el('button', { class: 'btn danger ghost', onclick: () => { if (ta.value && ta.dataset.arm !== '1') { ta.dataset.arm = '1'; clearBtn.textContent = 'Click again to clear'; setTimeout(() => { ta.dataset.arm = ''; clearBtn.textContent = 'Clear'; }, 2500); return; } ta.value = ''; ta.dataset.arm = ''; clearBtn.textContent = 'Clear'; update(); save(); } }, 'Clear')));
  const clearBtn = root.querySelector('.btn.danger');
  update();
  return () => { clearTimeout(timer); save(); document.removeEventListener('fullscreenchange', onFs); if (document.fullscreenElement === stage) document.exitFullscreen(); };
}
