import { el, render, store, stat } from '../../lib/ui.js';

// [code, label, width in key units]; null = spacer
const k = (code, label, w = 1) => [code, label ?? code, w];
const LAYOUT = [
  [k('Escape', 'Esc'), null, ...Array.from({ length: 4 }, (_, i) => k('F' + (i + 1))), null, ...Array.from({ length: 4 }, (_, i) => k('F' + (i + 5))), null, ...Array.from({ length: 4 }, (_, i) => k('F' + (i + 9))), null, k('PrintScreen', 'PrtSc'), k('ScrollLock', 'ScrLk'), k('Pause')],
  [k('Backquote', '`'), ...'1234567890'.split('').map(d => k('Digit' + d, d)), k('Minus', '-'), k('Equal', '='), k('Backspace', 'Backspace', 2), null, k('Insert', 'Ins'), k('Home'), k('PageUp', 'PgUp')],
  [k('Tab', 'Tab', 1.5), ...'QWERTYUIOP'.split('').map(c => k('Key' + c, c)), k('BracketLeft', '['), k('BracketRight', ']'), k('Backslash', '\\', 1.5), null, k('Delete', 'Del'), k('End'), k('PageDown', 'PgDn')],
  [k('CapsLock', 'Caps', 1.75), ...'ASDFGHJKL'.split('').map(c => k('Key' + c, c)), k('Semicolon', ';'), k('Quote', "'"), k('Enter', 'Enter', 2.25)],
  [k('ShiftLeft', 'Shift', 2.25), ...'ZXCVBNM'.split('').map(c => k('Key' + c, c)), k('Comma', ','), k('Period', '.'), k('Slash', '/'), k('ShiftRight', 'Shift', 2.75), null, null, k('ArrowUp', '↑')],
  [k('ControlLeft', 'Ctrl', 1.25), k('MetaLeft', 'Win', 1.25), k('AltLeft', 'Alt', 1.25), k('Space', 'Space', 6.25), k('AltRight', 'Alt', 1.25), k('MetaRight', 'Win', 1.25), k('ContextMenu', 'Menu', 1.25), k('ControlRight', 'Ctrl', 1.25), null, k('ArrowLeft', '←'), k('ArrowDown', '↓'), k('ArrowRight', '→')],
];
const STUCK_MS = 3000;

export default function (root) {
  const s = store('keyboard-tester');
  const U = 40;
  const keyEls = new Map();
  let down = new Map();       // code -> time pressed
  let counts = {}, tested = new Set(), total = 0, maxSim = 0, log = [];
  const blockCb = el('input', { type: 'checkbox', checked: s.get('block', true) });

  const board = el('div', { class: 'scroll-x' });
  const inner = el('div', { style: { display: 'inline-block', padding: '8px', minWidth: 'min-content' } });
  for (const row of LAYOUT) {
    const r = el('div', { style: { display: 'flex', marginBottom: '4px', whiteSpace: 'nowrap' } });
    for (const cell of row) {
      if (!cell) { r.append(el('div', { style: { width: (U * 0.5) + 'px', flex: 'none' } })); continue; }
      const [code, label, w] = cell;
      const kEl = el('div', { style: { width: (w * U - 4) + 'px', height: (U - 4) + 'px', margin: '0 2px', flex: 'none', border: '1px solid var(--line)', borderBottomWidth: '3px', borderRadius: '6px', background: 'var(--bg)', color: 'var(--text)', fontSize: '11px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', userSelect: 'none', lineHeight: 1.1 } },
        el('span', {}, label), el('span', { class: 'cnt', style: { fontSize: '9px', opacity: .7 } }));
      keyEls.set(code, kEl); r.append(kEl);
    }
    inner.append(r);
  }
  board.append(inner);

  const last = el('div', { class: 'panel mono small' }, 'Press any key…');
  const stats = el('div', { class: 'row' });
  const stuckBox = el('div', { class: 'small' });
  const logBox = el('div', { class: 'mono small muted', style: { whiteSpace: 'pre-wrap' } });
  const heldBox = el('div', { class: 'mono small' });

  function paintKey(code) {
    const e = keyEls.get(code);
    if (!e) return;
    const isDown = down.has(code);
    const stuck = isDown && Date.now() - down.get(code) > STUCK_MS;
    e.style.background = stuck ? 'var(--warn)' : isDown ? 'var(--accent)' : tested.has(code) ? 'color-mix(in srgb, var(--ok) 30%, var(--bg))' : 'var(--bg)';
    e.style.color = isDown ? 'var(--accent-text)' : 'var(--text)';
    e.style.transform = isDown ? 'translateY(2px)' : '';
    e.lastChild.textContent = counts[code] ? counts[code] : '';
  }
  function paintStats() {
    const keys = [...keyEls.keys()];
    render(stats, stat(total, 'key presses'), stat(down.size, 'held now'), stat(maxSim, 'max held at once'), stat(`${keys.filter(c => tested.has(c)).length} / ${keys.length}`, 'keys tested'));
    render(heldBox, down.size ? 'Held: ' + [...down.keys()].join(' + ') : 'Held: none');
    const stuck = [...down].filter(([, t]) => Date.now() - t > STUCK_MS).map(([c]) => c);
    render(stuckBox, stuck.length ? el('span', { class: 'badge warn' }, 'Possibly stuck: ' + stuck.join(', ')) : el('span', { class: 'muted' }, 'No stuck keys (a key held longer than 3 s is flagged).'));
  }
  function persist() { s.set('block', blockCb.checked); }

  const onDown = e => {
    if (blockCb.checked) e.preventDefault();
    const code = e.code || 'Unidentified:' + e.keyCode;
    if (!e.repeat) { down.set(code, Date.now()); counts[code] = (counts[code] || 0) + 1; total++; tested.add(code); maxSim = Math.max(maxSim, down.size); }
    paintKey(code);
    const mods = ['ctrlKey', 'shiftKey', 'altKey', 'metaKey'].filter(m => e[m]).map(m => m.replace('Key', '')).join('+') || 'none';
    render(last, [`key:      ${JSON.stringify(e.key)}`, `code:     ${e.code}`, `keyCode:  ${e.keyCode}`, `location: ${['standard', 'left', 'right', 'numpad'][e.location] || e.location}`, `modifiers: ${mods}${e.repeat ? '   (auto-repeat)' : ''}`].join('\n'));
    last.style.whiteSpace = 'pre';
    if (!e.repeat) { log.unshift(`${new Date().toLocaleTimeString()}  ${e.code}  "${e.key}"  ${e.keyCode}`); log = log.slice(0, 8); logBox.textContent = log.join('\n'); }
    paintStats();
  };
  const onUp = e => {
    if (blockCb.checked) e.preventDefault();
    const code = e.code || 'Unidentified:' + e.keyCode;
    down.delete(code); paintKey(code); paintStats();
  };
  const onBlur = () => { const codes = [...down.keys()]; down.clear(); codes.forEach(paintKey); paintStats(); };
  const tick = setInterval(() => { if (down.size) { for (const c of down.keys()) paintKey(c); paintStats(); } }, 500);

  window.addEventListener('keydown', onDown);
  window.addEventListener('keyup', onUp);
  window.addEventListener('blur', onBlur);
  blockCb.addEventListener('change', persist);

  function reset() {
    down = new Map(); counts = {}; tested = new Set(); total = 0; maxSim = 0; log = [];
    for (const c of keyEls.keys()) paintKey(c);
    render(last, 'Press any key…'); last.style.whiteSpace = ''; logBox.textContent = ''; paintStats();
  }

  render(root,
    el('div', { class: 'small muted' }, 'Press keys on your keyboard. Blue = held, green = tested, orange = held for over 3 s (possibly stuck). Hold several keys at once to test ghosting: the "max held at once" counter shows how many your keyboard registers simultaneously.'),
    board, last, stats, heldBox, stuckBox,
    el('div', { class: 'row' },
      el('label', { class: 'inline' }, blockCb, 'Block browser shortcuts while this page is open (F5, Tab, Ctrl+...)'),
      el('button', { class: 'btn', onclick: reset }, 'Reset')),
    el('h3', {}, 'Recent presses'), logBox);
  paintStats();

  return () => {
    window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp); window.removeEventListener('blur', onBlur);
    clearInterval(tick);
  };
}
