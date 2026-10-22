import { el, render, store } from '../../lib/ui.js';
import { audio } from './_fx.js';

export default function (root) {
  const s = store('bubble-wrap');
  const A = audio();
  const timers = new Set();
  let total = s.get('total', 0), sheet = 0;
  const COLS = 8, ROWS = 8;
  const cells = [];
  let down = false;

  const style = el('style', {}, `
    .bw-grid{display:grid;grid-template-columns:repeat(${COLS},1fr);gap:8px;max-width:520px;margin:12px auto;padding:14px;background:linear-gradient(135deg,#dbeafe,#e0e7ff);border-radius:14px;touch-action:none;user-select:none}
    [data-theme="dark"] .bw-grid{background:linear-gradient(135deg,#1e293b,#312e81)}
    .bw-b{aspect-ratio:1;border-radius:50%;border:0;padding:0;cursor:pointer;background:radial-gradient(circle at 32% 28%,rgba(255,255,255,.95),rgba(255,255,255,.35) 28%,rgba(147,197,253,.55) 62%,rgba(96,165,250,.7));box-shadow:inset -3px -4px 8px rgba(30,64,175,.25),0 2px 4px rgba(0,0,0,.2);transition:transform .08s}
    .bw-b:hover{transform:scale(1.04)}
    .bw-b.popped{background:radial-gradient(circle at 50% 50%,rgba(0,0,0,.18),rgba(0,0,0,.05) 70%);box-shadow:inset 2px 3px 6px rgba(0,0,0,.3);cursor:default;transform:scale(.88);animation:bw-pop .22s ease-out}
    @keyframes bw-pop{0%{transform:scale(1.25)}50%{transform:scale(.7)}100%{transform:scale(.88)}}
  `);
  const sheetCount = el('span'), totalCount = el('span');
  const grid = el('div', { class: 'bw-grid' });

  function pop(b, vol = 1, silent) {
    if (b.popped) return false;
    b.popped = true; b.node.classList.add('popped');
    if (!silent) {
      A.noise(0.05 + Math.random() * 0.03, { vol: 0.5 * vol, freq: 1800 + Math.random() * 2500, q: 0.9, sweepTo: 400 });
      A.tone(160 + Math.random() * 120, 0.06, { type: 'square', vol: 0.12 * vol, slideTo: 60 });
    }
    total++; s.set('total', total); update();
    try { navigator.vibrate && navigator.vibrate(8); } catch {}
    if (cells.every(c => c.popped)) setTimeout(() => finishMsg.textContent = 'Sheet cleared! Reset for a fresh one.', 0);
    return true;
  }
  function update() { sheetCount.textContent = cells.filter(c => c.popped).length + ' / ' + cells.length; totalCount.textContent = total.toLocaleString(); }

  function build() {
    cells.length = 0; grid.replaceChildren(); finishMsg.textContent = '';
    for (let i = 0; i < COLS * ROWS; i++) {
      const node = el('button', { class: 'bw-b', 'aria-label': 'bubble' });
      const b = { node, popped: false, i }; cells.push(b);
      node.addEventListener('pointerdown', e => { e.preventDefault(); A.ctx(); down = true; pop(b); });
      node.addEventListener('pointerenter', () => { if (down) pop(b); });
      node.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); A.ctx(); pop(b); } });
      grid.append(node);
    }
    update();
  }
  // touch drag: pointerenter doesn't fire on touch, so hit-test while dragging
  const onMove = e => {
    if (!down || e.pointerType === 'mouse') return;
    const t = document.elementFromPoint(e.clientX, e.clientY);
    const b = cells.find(c => c.node === t); if (b) pop(b);
  };
  const up = () => { down = false; };
  window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  grid.addEventListener('pointermove', onMove);

  function popAll() {
    A.ctx();
    const order = cells.filter(c => !c.popped).sort((a, b) => (a.i % COLS + Math.floor(a.i / COLS)) - (b.i % COLS + Math.floor(b.i / COLS)));
    order.forEach((c, k) => { const t = setTimeout(() => { timers.delete(t); pop(c, 0.6); }, k * 28); timers.add(t); });
  }
  function reset() { timers.forEach(clearTimeout); timers.clear(); sheet++; build(); }

  const finishMsg = el('div', { class: 'center small muted', style: { minHeight: '1.4em' } });
  render(root, style,
    el('div', { class: 'row' },
      el('div', { class: 'stat' }, el('div', { class: 'v' }, sheetCount), el('div', { class: 'l' }, 'this sheet')),
      el('div', { class: 'stat' }, el('div', { class: 'v' }, totalCount), el('div', { class: 'l' }, 'popped all time')),
      el('button', { class: 'btn primary', onclick: popAll }, 'Pop all'),
      el('button', { class: 'btn', onclick: reset }, 'New sheet'),
      el('button', { class: 'btn ghost', onclick: () => { total = 0; s.set('total', 0); update(); } }, 'Reset total')),
    grid, finishMsg,
    el('p', { class: 'small muted center' }, 'Click, tap, or drag across the bubbles. Keyboard: Tab to a bubble and press Enter.'));
  build();

  return () => {
    timers.forEach(clearTimeout); timers.clear();
    window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
    A.close();
  };
}
