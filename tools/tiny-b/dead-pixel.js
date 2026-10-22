import { el, render, store } from '../../lib/ui.js';

const MODES = [
  { name: 'Black', color: '#000000' }, { name: 'White', color: '#ffffff' },
  { name: 'Red', color: '#ff0000' }, { name: 'Green', color: '#00ff00' }, { name: 'Blue', color: '#0000ff' },
  { name: 'Cyan', color: '#00ffff' }, { name: 'Magenta', color: '#ff00ff' }, { name: 'Yellow', color: '#ffff00' },
  { name: 'Gray', color: '#808080' },
  { name: 'Fine checkerboard (1 px)', pattern: 'checker' },
  { name: 'Horizontal lines (1 px)', pattern: 'hlines' },
  { name: 'Vertical lines (1 px)', pattern: 'vlines' },
];

export default function (root) {
  const s = store('dead-pixel');
  let idx = 0, active = false, hintTimer = 0;

  const canvas = el('canvas', { style: { position: 'absolute', inset: 0, width: '100%', height: '100%', maxWidth: 'none', display: 'none' } });
  const hint = el('div', { style: { position: 'absolute', left: '50%', bottom: '24px', transform: 'translateX(-50%)', padding: '8px 14px', borderRadius: '8px', background: 'rgba(0,0,0,.75)', color: '#fff', fontSize: '14px', pointerEvents: 'none', transition: 'opacity .3s', textAlign: 'center' } });
  const stage = el('div', { style: { position: 'fixed', inset: 0, zIndex: 9999, display: 'none', cursor: 'pointer', background: '#000' } }, canvas, hint);

  function drawPattern(kind) {
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.round(stage.clientWidth * dpr)), h = Math.max(1, Math.round(stage.clientHeight * dpr));
    canvas.width = w; canvas.height = h;
    const g = canvas.getContext('2d');
    const img = g.createImageData(w, h), px = new Uint32Array(img.data.buffer);
    const BLACK = 0xff000000, WHITE = 0xffffffff;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const v = kind === 'checker' ? (x + y) & 1 : kind === 'hlines' ? y & 1 : x & 1;
      px[y * w + x] = v ? WHITE : BLACK;
    }
    g.putImageData(img, 0, 0);
  }
  function paint() {
    const m = MODES[idx];
    if (m.pattern) { canvas.style.display = 'block'; stage.style.background = '#000'; drawPattern(m.pattern); }
    else { canvas.style.display = 'none'; stage.style.background = m.color; }
    hint.textContent = `${m.name}  (${idx + 1}/${MODES.length})  -  click or arrows to change, Esc to exit`;
    hint.style.opacity = '1';
    clearTimeout(hintTimer); hintTimer = setTimeout(() => (hint.style.opacity = '0'), 2200);
  }
  function go(d) { idx = (idx + d + MODES.length) % MODES.length; paint(); s.set('idx', idx); }
  async function enter(i) {
    idx = i; active = true; stage.style.display = 'block'; paint();
    try { if (stage.requestFullscreen) await stage.requestFullscreen(); } catch {}
    paint(); // re-measure after the fullscreen resize
  }
  function exit() {
    if (!active) return;
    active = false; stage.style.display = 'none'; clearTimeout(hintTimer);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }

  const onKey = e => {
    if (!active) return;
    if (e.key === 'Escape') { e.preventDefault(); exit(); }
    else if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ' || e.key === 'Enter') { e.preventDefault(); go(1); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'Backspace') { e.preventDefault(); go(-1); }
  };
  const onFs = () => { if (active && !document.fullscreenElement && stage.dataset.wasFs === '1') exit(); stage.dataset.wasFs = document.fullscreenElement ? '1' : '0'; if (active) paint(); };
  const onResize = () => { if (active && MODES[idx].pattern) drawPattern(MODES[idx].pattern); };
  document.addEventListener('keydown', onKey);
  document.addEventListener('fullscreenchange', onFs);
  window.addEventListener('resize', onResize);
  stage.addEventListener('click', () => go(1));
  stage.addEventListener('contextmenu', e => { e.preventDefault(); go(-1); });

  const buttons = MODES.map((m, i) => el('button', { class: 'btn', style: { display: 'flex', alignItems: 'center', gap: '8px' }, onclick: () => enter(i) },
    el('span', { style: { width: '18px', height: '18px', borderRadius: '4px', border: '1px solid var(--line)', background: m.color || 'repeating-conic-gradient(#000 0% 25%, #fff 0% 50%) 0 0 / 6px 6px' } }), m.name));

  render(root,
    el('div', { class: 'row' }, el('button', { class: 'btn primary', onclick: () => enter(0) }, 'Start full screen'),
      el('button', { class: 'btn', onclick: () => enter(s.get('idx', 0)) }, 'Resume where I left off')),
    el('div', { class: 'small muted' }, 'Or jump straight to a colour or pattern:'),
    el('div', { class: 'row' }, buttons),
    el('ul', { class: 'small muted' },
      el('li', {}, 'Look for pixels that stay black on white, white on dark, or show a wrong colour on solid screens.'),
      el('li', {}, 'Click, Space or arrow keys switch screens; right-click or left arrow goes back; Esc exits.'),
      el('li', {}, 'The 1 px patterns are drawn at your screen\'s native resolution so every pixel toggles; they may shimmer on scaled displays.')),
    stage);

  return () => {
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('fullscreenchange', onFs);
    window.removeEventListener('resize', onResize);
    clearTimeout(hintTimer);
    active = false;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    stage.remove();
  };
}
