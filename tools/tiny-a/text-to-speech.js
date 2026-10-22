import { el, render, store, field } from '../../lib/ui.js';

export default function (root) {
  const s = store('text-to-speech');
  const synth = window.speechSynthesis;
  if (!synth || !window.SpeechSynthesisUtterance) {
    render(root, el('div', { class: 'empty' }, 'Speech synthesis is not available in this browser.'));
    return;
  }

  const ta = el('textarea', { class: 'textarea prose', placeholder: 'Paste text to read aloud…', value: s.get('text', ''), style: { minHeight: '140px' } });
  const voiceSel = el('select', { class: 'select', style: { maxWidth: '100%' } });
  const rate = el('input', { type: 'range', min: 0.5, max: 2, step: 0.1, value: s.get('rate', 1) });
  const pitch = el('input', { type: 'range', min: 0, max: 2, step: 0.1, value: s.get('pitch', 1) });
  const rateVal = el('span', { class: 'mono small' }, rate.value + '×');
  const pitchVal = el('span', { class: 'mono small' }, pitch.value);
  const status = el('span', { class: 'badge' }, 'Idle');
  const reader = el('div', { class: 'panel', style: { lineHeight: '1.8', maxHeight: '300px', overflow: 'auto' } });
  const progress = el('div', { class: 'bar' }, el('div', { style: { width: '0%' } }));

  let voices = [], sentences = [], spans = [], idx = -1, current = null, state = 'idle';

  function fillVoices() {
    voices = synth.getVoices().sort((a, b) => (b.default - a.default) || a.lang.localeCompare(b.lang) || a.name.localeCompare(b.name));
    const saved = s.get('voice', '');
    render(voiceSel, voices.length ? voices.map(v => el('option', { value: v.name, selected: v.name === saved }, `${v.name} (${v.lang})${v.default ? ' — default' : ''}`))
      : el('option', { value: '' }, 'Default voice'));
  }
  fillVoices();
  const onVoices = () => fillVoices();
  synth.addEventListener('voiceschanged', onVoices);

  function splitSentences(t) {
    const out = [];
    for (const para of t.split(/\n+/)) {
      const parts = para.match(/[^.!?…]+[.!?…]+["'’”)]*\s*|[^.!?…]+$/g) || [];
      parts.forEach(p => { if (p.trim()) out.push(p); });
      if (parts.length) out.push('\n');
    }
    return out;
  }

  function buildReader() {
    sentences = splitSentences(ta.value).filter(x => x !== '\n' || true);
    spans = [];
    const nodes = [];
    sentences.forEach((sen, i) => {
      if (sen === '\n') { nodes.push(el('br')); spans.push(null); return; }
      const sp = el('span', { style: { cursor: 'pointer', borderRadius: '4px', padding: '1px 2px' }, title: 'Click to read from here', onclick: () => play(i) }, sen);
      spans.push(sp); nodes.push(sp);
    });
    render(reader, nodes.length ? nodes : el('span', { class: 'muted' }, 'Sentences will appear here. Click any sentence to start from it.'));
  }

  function highlight(i) {
    spans.forEach((sp, j) => { if (sp) { sp.style.background = j === i ? 'var(--accent)' : ''; sp.style.color = j === i ? 'var(--accent-text)' : ''; } });
    if (i >= 0 && spans[i]) spans[i].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    const spoken = sentences.filter((x, j) => j <= i && x !== '\n').length, total = sentences.filter(x => x !== '\n').length;
    progress.firstChild.style.width = total ? (100 * spoken / total) + '%' : '0%';
  }
  function setState(st, text) { state = st; status.textContent = text; status.className = 'badge ' + (st === 'playing' ? 'ok' : st === 'paused' ? 'warn' : ''); }

  function speakAt(i) {
    while (i < sentences.length && sentences[i] === '\n') i++;
    if (i >= sentences.length) { stop(); return; }
    idx = i;
    highlight(i);
    const u = new SpeechSynthesisUtterance(sentences[i]);
    const v = voices.find(x => x.name === voiceSel.value);
    if (v) u.voice = v;
    u.rate = parseFloat(rate.value); u.pitch = parseFloat(pitch.value);
    u.onend = () => { if (current === u && state !== 'idle') speakAt(idx + 1); };
    u.onerror = e => { if (current === u && e.error !== 'interrupted' && e.error !== 'canceled') { setState('idle', 'Error: ' + e.error); idx = -1; highlight(-1); } };
    current = u;
    synth.speak(u);
  }
  function play(from) {
    if (state === 'paused' && from == null) { synth.resume(); setState('playing', 'Playing'); return; }
    synth.cancel();
    if (!spans.length || from == null && idx < 0) buildReader();
    setState('playing', 'Playing');
    speakAt(from == null ? 0 : from);
  }
  function pause() { if (state === 'playing') { synth.pause(); setState('paused', 'Paused'); } }
  function stop() { current = null; synth.cancel(); idx = -1; highlight(-1); setState('idle', 'Idle'); }

  ta.addEventListener('input', () => { s.set('text', ta.value); if (state === 'idle') buildReader(); });
  rate.addEventListener('input', () => { rateVal.textContent = rate.value + '×'; s.set('rate', +rate.value); });
  pitch.addEventListener('input', () => { pitchVal.textContent = pitch.value; s.set('pitch', +pitch.value); });
  voiceSel.addEventListener('change', () => s.set('voice', voiceSel.value));

  render(root,
    ta,
    el('div', { class: 'row' },
      field('Voice', voiceSel),
      field('Rate', el('div', { class: 'row', style: { margin: 0 } }, rate, rateVal)),
      field('Pitch', el('div', { class: 'row', style: { margin: 0 } }, pitch, pitchVal))),
    el('div', { class: 'row' },
      el('button', { class: 'btn primary', onclick: () => play() }, '▶ Play'),
      el('button', { class: 'btn', onclick: pause }, '⏸ Pause'),
      el('button', { class: 'btn', onclick: stop }, '⏹ Stop'),
      el('button', { class: 'btn small', onclick: () => { if (state !== 'idle') { current = null; synth.cancel(); speakAt(Math.max(0, idx - 1)); } } }, '⏮ Prev'),
      el('button', { class: 'btn small', onclick: () => { if (state !== 'idle') { current = null; synth.cancel(); speakAt(idx + 1); } } }, '⏭ Next'),
      status),
    progress,
    reader);
  buildReader();

  return () => { current = null; synth.cancel(); synth.removeEventListener('voiceschanged', onVoices); };
}
