import { el, render, store, stat, loop, pad } from '../../lib/ui.js';

const fmt = sec => { sec = Math.max(0, Math.round(sec)); const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60; return (h ? h + ':' + pad(m) : m) + ':' + pad(s); };
const SAMPLE = 'Good morning, everyone. Thank you for being here today.\n\nI want to talk about three ideas that changed how our team works: clarity, trust, and small steady steps.\n\nFirst, clarity. When everyone knows the goal, decisions get easier and meetings get shorter.\n\nSecond, trust. Trust is not a speech. It is built each time we do what we said we would do.\n\nFinally, small steps. Big change is a long series of small, repeatable actions.\n\nThank you.';

export default function (root) {
  const s = store('speech-timer');
  const ta = el('textarea', { class: 'textarea prose', rows: 10, value: s.get('text', SAMPLE), placeholder: 'Paste your speech script here…' });
  const wpmIn = el('input', { class: 'input', type: 'number', min: '60', max: '300', value: s.get('wpm', 150), style: { width: '90px' } });
  const presets = el('select', { class: 'select' }, [['Slow (110)', 110], ['Conversational (150)', 150], ['Brisk (180)', 180], ['Fast (220)', 220]].map(([l, v]) => el('option', { value: v }, l)), el('option', { value: '' }, 'Custom'));
  const stats = el('div', { class: 'row' });
  const sizeIn = el('input', { type: 'range', min: '20', max: '96', value: s.get('size', 42) });
  const speedIn = el('input', { type: 'range', min: '0.5', max: '2', step: '0.05', value: 1 });
  const speedLbl = el('span', { class: 'small muted' }, '1.0x');
  const prompter = el('div', { class: 'hidden' });
  const scroller = el('div', { style: { height: '60vh', overflowY: 'auto', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: '8px', position: 'relative', scrollBehavior: 'auto' } });
  const inner = el('div', { style: { padding: '30vh 6% 40vh', lineHeight: '1.5', fontWeight: '600', textAlign: 'center', whiteSpace: 'pre-wrap' } });
  const guide = el('div', { style: { position: 'absolute', left: 0, right: 0, top: '30vh', height: '2px', background: 'var(--accent)', opacity: '.5', pointerEvents: 'none' } });
  const stage = el('div', { style: { position: 'relative' } }, scroller, guide);
  const clock = el('span', { class: 'mono' }, '0:00 / 0:00');
  const playBtn = el('button', { class: 'btn primary' }, 'Play');
  let playing = false, elapsed = 0, stop = null;

  const words = () => (ta.value.match(/\S+/g) || []).length;
  const wpm = () => Math.max(30, parseInt(wpmIn.value) || 150);
  const duration = () => words() / wpm() * 60;
  function update() {
    s.set('text', ta.value); s.set('wpm', wpm()); s.set('size', +sizeIn.value);
    const w = words(), d = duration();
    render(stats, stat(w.toLocaleString(), 'words'), stat(fmt(d), 'estimated time'), stat(ta.value.trim() ? (ta.value.trim().split(/\n\s*\n/).length) : 0, 'paragraphs'), stat(Math.round(w / Math.max(1, (ta.value.match(/[.!?]+(\s|$)/g) || []).length)), 'avg words / sentence'));
    inner.textContent = ta.value || 'Your script will scroll here.';
    inner.style.fontSize = sizeIn.value + 'px';
    clock.textContent = `${fmt(elapsed)} / ${fmt(d / +speedIn.value)}`;
  }
  const maxScroll = () => Math.max(0, scroller.scrollHeight - scroller.clientHeight);
  function setPlaying(on) {
    playing = on; playBtn.textContent = on ? 'Pause' : (elapsed > 0 ? 'Resume' : 'Play');
    if (stop) { stop(); stop = null; }
    if (!on) return;
    // sync elapsed to current manual scroll position
    const mx = maxScroll();
    if (mx > 0) elapsed = scroller.scrollTop / mx * duration() / +speedIn.value;
    stop = loop(dt => {
      elapsed += dt;
      const total = duration() / +speedIn.value;
      const p = total ? Math.min(1, elapsed / total) : 1;
      scroller.scrollTop = p * maxScroll();
      clock.textContent = `${fmt(elapsed)} / ${fmt(total)}`;
      if (p >= 1) setPlaying(false);
    });
  }
  playBtn.addEventListener('click', () => { if (!words()) return; if (!playing && elapsed >= duration() / +speedIn.value) { elapsed = 0; scroller.scrollTop = 0; } setPlaying(!playing); });
  const reset = () => { setPlaying(false); elapsed = 0; scroller.scrollTop = 0; playBtn.textContent = 'Play'; update(); };
  let teleprompter = false;
  const modeBtn = el('button', { class: 'btn' }, 'Teleprompter mode');
  modeBtn.addEventListener('click', () => {
    teleprompter = !teleprompter;
    prompter.classList.toggle('hidden', !teleprompter);
    editor.classList.toggle('hidden', teleprompter);
    modeBtn.textContent = teleprompter ? 'Back to editor' : 'Teleprompter mode';
    if (!teleprompter) setPlaying(false); else reset();
  });
  const fsBtn = el('button', { class: 'btn', onclick: () => { if (document.fullscreenElement) document.exitFullscreen(); else if (stage.requestFullscreen) stage.requestFullscreen().catch(() => {}); } }, 'Fullscreen');
  function onFs() { scroller.style.height = document.fullscreenElement === stage ? '100vh' : '60vh'; scroller.style.background = 'var(--bg)'; }
  document.addEventListener('fullscreenchange', onFs);
  const onKey = e => { if (teleprompter && e.code === 'Space' && !/INPUT|TEXTAREA|SELECT|BUTTON/.test(document.activeElement.tagName)) { e.preventDefault(); playBtn.click(); } };
  window.addEventListener('keydown', onKey);

  ta.addEventListener('input', update);
  wpmIn.addEventListener('input', () => { presets.value = [...presets.options].some(o => o.value === wpmIn.value) ? wpmIn.value : ''; update(); });
  presets.addEventListener('change', () => { if (presets.value) { wpmIn.value = presets.value; update(); } });
  presets.value = [...presets.options].some(o => o.value === wpmIn.value) ? wpmIn.value : '';
  sizeIn.addEventListener('input', update);
  speedIn.addEventListener('input', () => { speedLbl.textContent = (+speedIn.value).toFixed(2).replace(/0$/, '') + 'x'; if (playing) { const total = duration() / +speedIn.value; const mx = maxScroll(); elapsed = mx ? scroller.scrollTop / mx * total : elapsed; } update(); });

  const editor = el('div', {}, ta, stats,
    el('p', { class: 'muted small' }, 'Estimated from word count at your chosen pace. Typical speaking rates are 130-160 words per minute.'));
  scroller.append(inner);
  render(prompter, stage,
    el('div', { class: 'row' }, playBtn, el('button', { class: 'btn', onclick: reset }, 'Restart'), clock, fsBtn,
      el('label', { class: 'inline' }, 'Font', sizeIn), el('label', { class: 'inline' }, 'Speed', speedIn, speedLbl)),
    el('p', { class: 'muted small' }, 'Scrolls at your WPM pace so the script finishes in the estimated time. Pause to scroll manually; Space toggles play.'));
  render(root,
    el('div', { class: 'row' }, el('label', { class: 'inline' }, 'Pace', wpmIn, 'WPM'), presets, modeBtn,
      el('button', { class: 'btn ghost', onclick: () => { ta.value = ''; update(); } }, 'Clear')),
    editor, prompter);
  update();
  return () => { if (stop) stop(); window.removeEventListener('keydown', onKey); document.removeEventListener('fullscreenchange', onFs); if (document.fullscreenElement === stage) document.exitFullscreen(); };
}
