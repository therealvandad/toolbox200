// Keyboard shortcut trainer: press the real key combination for a named action.
import { el, render, store, stat } from '../../lib/ui.js';

// keys: 'Win-string' or [winString, macString]; alternatives separated by '|'.
const SETS = {
  vscode: { title: 'VS Code', items: [
    ['Open command palette', ['Ctrl+Shift+P|F1', 'Cmd+Shift+P|F1']], ['Quick open a file', ['Ctrl+P', 'Cmd+P']], ['Toggle sidebar', ['Ctrl+B', 'Cmd+B']],
    ['Toggle integrated terminal', 'Ctrl+`'], ['Format document', ['Shift+Alt+F', 'Shift+Option+F']], ['Go to line', 'Ctrl+G'],
    ['Find in all files', ['Ctrl+Shift+F', 'Cmd+Shift+F']], ['Toggle line comment', ['Ctrl+/', 'Cmd+/']], ['Rename symbol', 'F2'],
    ['Go to definition', 'F12'], ['Add selection to next match (multi-cursor)', ['Ctrl+D', 'Cmd+D']], ['Move line down', ['Alt+Down', 'Option+Down']],
    ['Copy line down', ['Shift+Alt+Down', 'Shift+Option+Down']], ['Delete line', ['Ctrl+Shift+K', 'Cmd+Shift+K']], ['Split editor', ['Ctrl+\\', 'Cmd+\\']],
    ['Toggle word wrap', ['Alt+Z', 'Option+Z']], ['Select all occurrences of selection', ['Ctrl+Shift+L', 'Cmd+Shift+L']], ['Open settings', ['Ctrl+,', 'Cmd+,']],
    ['Open Markdown preview to the side', ['Ctrl+K V', 'Cmd+K V']], ['Show problems panel', ['Ctrl+Shift+M', 'Cmd+Shift+M']], ['Trigger suggestion', 'Ctrl+Space'],
    ['Fold region', ['Ctrl+Shift+[', 'Cmd+Option+[']], ['Go back', ['Alt+Left', 'Ctrl+-']], ['Toggle Zen mode', ['Ctrl+K Z', 'Cmd+K Z']],
    ['Save all files', ['Ctrl+K S', 'Cmd+Option+S']], ['Find', ['Ctrl+F', 'Cmd+F']], ['Replace', ['Ctrl+H', 'Cmd+Option+F']], ['Expand selection', ['Shift+Alt+Right', 'Ctrl+Shift+Cmd+Right']],
  ] },
  photoshop: { title: 'Photoshop', items: [
    ['Move tool', 'V'], ['Marquee tool', 'M'], ['Lasso tool', 'L'], ['Crop tool', 'C'], ['Brush tool', 'B'], ['Eraser tool', 'E'], ['Zoom tool', 'Z'],
    ['Hand tool', 'H'], ['Type tool', 'T'], ['Eyedropper tool', 'I'], ['Gradient tool', 'G'], ['Clone stamp tool', 'S'], ['Healing brush tool', 'J'],
    ['Swap foreground/background colors', 'X'], ['Reset default colors', 'D'], ['Toggle panels', 'Tab'],
    ['New layer', ['Ctrl+Shift+N', 'Cmd+Shift+N']], ['Duplicate layer', ['Ctrl+J', 'Cmd+J']], ['Deselect', ['Ctrl+D', 'Cmd+D']],
    ['Invert selection', ['Ctrl+Shift+I', 'Cmd+Shift+I']], ['Levels', ['Ctrl+L', 'Cmd+L']], ['Curves', ['Ctrl+M', 'Cmd+M']], ['Hue/Saturation', ['Ctrl+U', 'Cmd+U']],
    ['Fill with foreground color', ['Alt+Backspace', 'Option+Backspace']], ['Fill with background color', ['Ctrl+Backspace', 'Cmd+Backspace']],
    ['Merge layer down', ['Ctrl+E', 'Cmd+E']], ['Step backward (undo history)', ['Ctrl+Alt+Z', 'Cmd+Option+Z']], ['Fit on screen', ['Ctrl+0', 'Cmd+0']],
    ['100% zoom', ['Ctrl+1', 'Cmd+1']], ['Group layers', ['Ctrl+G', 'Cmd+G']], ['Select all', ['Ctrl+A', 'Cmd+A']], ['Increase brush size', ']'], ['Decrease brush size', '['],
  ] },
  windows: { title: 'Windows', items: [
    ['Copy', 'Ctrl+C'], ['Paste', 'Ctrl+V'], ['Cut', 'Ctrl+X'], ['Undo', 'Ctrl+Z'], ['Redo', 'Ctrl+Y'], ['Select all', 'Ctrl+A'],
    ['Rename selected item', 'F2'], ['Refresh', 'F5'], ['New folder in Explorer', 'Ctrl+Shift+N'], ['Properties of selected item', 'Alt+Enter'],
    ['Delete permanently (skip Recycle Bin)', 'Shift+Delete'], ['Go back in Explorer', 'Alt+Left'], ['Go to address bar in Explorer', 'Alt+D'],
    ['Find', 'Ctrl+F'], ['Print', 'Ctrl+P'], ['Save', 'Ctrl+S'], ['Open', 'Ctrl+O'], ['Bold text', 'Ctrl+B'], ['Italic text', 'Ctrl+I'], ['Underline text', 'Ctrl+U'],
    ['Delete previous word', 'Ctrl+Backspace'], ['Jump to start of document', 'Ctrl+Home'], ['Jump to end of document', 'Ctrl+End'], ['Select next word', 'Ctrl+Shift+Right'],
    ['Open context menu', 'Shift+F10'], ['Help', 'F1'], ['Open folder up one level in Explorer', 'Alt+Up'], ['Zoom in', 'Ctrl+='], ['Zoom out', 'Ctrl+-'],
  ] },
  chrome: { title: 'Chrome', items: [
    ['Focus the address bar', ['Ctrl+L|Alt+D', 'Cmd+L']], ['Find on page', ['Ctrl+F', 'Cmd+F']], ['Bookmark this page', ['Ctrl+D', 'Cmd+D']],
    ['Open history', ['Ctrl+H', 'Cmd+Y']], ['Open downloads', ['Ctrl+J', 'Cmd+Shift+J']], ['Print', ['Ctrl+P', 'Cmd+P']], ['Reload', ['Ctrl+R|F5', 'Cmd+R']],
    ['View page source', ['Ctrl+U', 'Cmd+Option+U']], ['Open developer tools', ['Ctrl+Shift+I', 'Cmd+Option+I']], ['Open JavaScript console', ['Ctrl+Shift+J', 'Cmd+Option+J']],
    ['Zoom in', ['Ctrl+=', 'Cmd+=']], ['Zoom out', ['Ctrl+-', 'Cmd+-']], ['Reset zoom', ['Ctrl+0', 'Cmd+0']], ['Toggle bookmarks bar', ['Ctrl+Shift+B', 'Cmd+Shift+B']],
    ['Clear browsing data', ['Ctrl+Shift+Delete', 'Cmd+Shift+Delete']], ['Save page', ['Ctrl+S', 'Cmd+S']], ['Open a file', ['Ctrl+O', 'Cmd+O']],
    ['Go back', ['Alt+Left', 'Cmd+Left']], ['Go forward', ['Alt+Right', 'Cmd+Right']], ['Open bookmark manager', ['Ctrl+Shift+O', 'Cmd+Option+B']],
    ['Open Chrome task manager', 'Shift+Esc'], ['Search from the address bar', ['Ctrl+K|Ctrl+E', 'Cmd+Option+F']], ['Help', 'F1'], ['Jump to top of page', 'Home'],
    ['Select next match in find bar', ['Ctrl+G', 'Cmd+G']], ['Reload ignoring cache', ['Ctrl+Shift+R', 'Cmd+Shift+R']],
  ] },
};

const MODS = { ctrl: 'ctrlKey', shift: 'shiftKey', alt: 'altKey', option: 'altKey', cmd: 'metaKey', meta: 'metaKey', win: 'metaKey' };
function parseCombo(str) {
  // "Ctrl+K V" => chord of two combos
  return str.trim().split(/\s+/).map(part => {
    const toks = part.split('+'); if (part.endsWith('++')) { toks.pop(); toks.pop(); toks.push('='); }
    const c = { ctrlKey: false, shiftKey: false, altKey: false, metaKey: false, key: '' };
    for (const t of toks) { const m = MODS[t.toLowerCase()]; if (m) c[m] = true; else c.key = normKey(t); }
    if (c.key === '=') c.key = '=';
    return c;
  });
}
function normKey(k) {
  const map = { esc: 'Esc', escape: 'Esc', up: 'Up', down: 'Down', left: 'Left', right: 'Right', space: 'Space', delete: 'Delete', del: 'Delete', backspace: 'Backspace', enter: 'Enter', return: 'Enter', tab: 'Tab', home: 'Home', end: 'End', pageup: 'PgUp', pagedown: 'PgDn', '+': '=' };
  const l = k.toLowerCase(); if (map[l]) return map[l]; if (/^f\d+$/i.test(k)) return k.toUpperCase(); return k.length === 1 ? k.toUpperCase() : k;
}
function eventKey(e) {
  const code = e.code || '';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad') && /\d$/.test(code)) return code.slice(-1);
  const codes = { Backquote: '`', Minus: '-', Equal: '=', NumpadAdd: '=', NumpadSubtract: '-', BracketLeft: '[', BracketRight: ']', Backslash: '\\', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Space: 'Space', Escape: 'Esc', ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right', PageUp: 'PgUp', PageDown: 'PgDn' };
  if (codes[code]) return codes[code];
  if (['Control', 'Shift', 'Alt', 'Meta', 'OS', 'AltGraph', 'CapsLock'].includes(e.key)) return null;
  return normKey(e.key);
}
function fmtCombo(c, mac) {
  const p = []; if (c.ctrlKey) p.push(mac ? '⌃ Ctrl' : 'Ctrl'); if (c.altKey) p.push(mac ? '⌥ Option' : 'Alt'); if (c.shiftKey) p.push(mac ? '⇧ Shift' : 'Shift'); if (c.metaKey) p.push(mac ? '⌘ Cmd' : 'Win');
  p.push(c.key === '=' ? '+' : c.key); return p;
}
function same(a, b) { return a.ctrlKey === b.ctrlKey && a.shiftKey === b.shiftKey && a.altKey === b.altKey && a.metaKey === b.metaKey && a.key === b.key; }

export default function (root) {
  const s = store('shortcut-trainer');
  let setId = s.get('set', 'vscode'); if (!SETS[setId]) setId = 'vscode';
  let mac = s.get('mac', /Mac|iPhone|iPad/.test(navigator.platform || ''));
  let stats = s.get('stats', {}); // key: set|idx -> {seen, right, wrong, streak}
  let cur = null, lastIdx = -1, phase = 'ask', chordPos = 0, attempts = 0, timer = null;
  let session = { score: 0, right: 0, total: 0, streak: 0, best: s.get('best', 0) };

  const action = el('div', { class: 'big', style: { textAlign: 'center', minHeight: '48px', fontSize: '26px' } });
  const pressed = el('div', { class: 'row', style: { justifyContent: 'center', minHeight: '36px' } });
  const feedback = el('div', { style: { textAlign: 'center', minHeight: '28px' } });
  const statsRow = el('div', { class: 'row' });
  const progress = el('div', { class: 'small muted' });
  const setSel = el('select', { class: 'select', onchange: () => { setId = setSel.value; s.set('set', setId); next(); } }, Object.entries(SETS).map(([k, v]) => el('option', { value: k }, v.title)));
  setSel.value = setId;
  const macBtn = el('button', { class: 'btn small', onclick: () => { mac = !mac; s.set('mac', mac); refreshMac(); next(); } });
  function refreshMac() { macBtn.textContent = mac ? 'Mac keys (⌘)' : 'Windows keys (Ctrl)'; }

  function keyFor(item) { const k = Array.isArray(item[1]) ? item[1][mac ? 1 : 0] : item[1]; return k.split('|').map(parseCombo); }
  function keyId(i) { return setId + '|' + i; }
  function kbd(parts) { return el('span', { class: 'row', style: { gap: '4px', margin: 0, display: 'inline-flex' } }, parts.map((p, i) => [i ? el('span', { class: 'muted' }, '+') : null, el('span', { class: 'kbd' }, p)])); }
  function showAnswer() { const alts = keyFor(cur); return el('span', {}, alts.map((chord, i) => [i ? el('span', { class: 'muted' }, ' or ') : null, chord.map((c, j) => [j ? el('span', { class: 'muted' }, ' then ') : null, kbd(fmtCombo(c, mac))])])); }

  function pickNext() {
    const items = SETS[setId].items; const weights = items.map((_, i) => { if (i === lastIdx && items.length > 1) return 0; const st = stats[keyId(i)]; if (!st) return 3; return Math.max(0.2, 1 + st.wrong * 2 - st.right * 0.5 - st.streak * 0.3); });
    const sum = weights.reduce((a, b) => a + b, 0); let r = Math.random() * sum;
    for (let i = 0; i < items.length; i++) { r -= weights[i]; if (r <= 0) return i; } return items.length - 1;
  }
  function next() {
    clearTimeout(timer); lastIdx = cur ? cur.idx : lastIdx; const idx = pickNext(); cur = { idx, ...{ 0: SETS[setId].items[idx][0], 1: SETS[setId].items[idx][1] } }; cur.item = SETS[setId].items[idx];
    phase = 'ask'; chordPos = 0; attempts = 0;
    render(action, cur.item[0]); render(pressed, el('span', { class: 'muted small' }, 'Press the shortcut…')); render(feedback, ''); updateStats();
  }
  function record(right) { const k = keyId(cur.idx); const st = stats[k] || { seen: 0, right: 0, wrong: 0, streak: 0 }; st.seen++; if (right) { st.right++; st.streak++; } else { st.wrong++; st.streak = 0; } stats[k] = st; s.set('stats', stats); }
  function updateStats() {
    const items = SETS[setId].items; const learned = items.filter((_, i) => (stats[keyId(i)] || {}).streak >= 2).length;
    render(statsRow, stat(session.score, 'score'), stat(session.total ? Math.round(100 * session.right / session.total) + '%' : '–', 'accuracy'), stat(session.streak, 'streak'), stat(session.best, 'best score'));
    progress.textContent = SETS[setId].title + ': ' + learned + '/' + items.length + ' shortcuts learned (answered right twice in a row).';
  }
  function finish(right) {
    phase = 'result'; record(right); session.total++;
    if (right) { session.right++; session.streak++; const pts = (attempts === 0 ? 10 : 5) + Math.min(5, session.streak); session.score += pts; if (session.score > session.best) { session.best = session.score; s.set('best', session.best); } render(feedback, el('span', { style: { color: 'var(--ok)', fontWeight: 600 } }, 'Correct! +' + pts, ' ', showAnswer())); timer = setTimeout(next, 900); }
    else { session.streak = 0; render(feedback, el('span', { style: { color: 'var(--danger)', fontWeight: 600 } }, 'The answer is '), showAnswer(), el('div', { class: 'small muted' }, 'Press Space or Enter for the next one')); }
    updateStats();
  }
  function onKey(e) {
    if (!root.isConnected) return;
    if (e.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
    const k = eventKey(e); if (k == null) return; // bare modifier
    if (phase === 'result') { if ((k === 'Space' || k === 'Enter') && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); next(); } return; }
    e.preventDefault(); e.stopPropagation();
    const got = { ctrlKey: e.ctrlKey, shiftKey: e.shiftKey, altKey: e.altKey, metaKey: e.metaKey, key: k };
    render(pressed, kbd(fmtCombo(got, mac)));
    const alts = keyFor(cur);
    const matching = alts.filter(chord => same(chord[chordPos], got));
    if (matching.length) {
      if (matching.some(chord => chord.length === chordPos + 1)) finish(true);
      else { chordPos++; render(feedback, el('span', { class: 'muted' }, 'Chord started, press the next key…')); }
    } else {
      chordPos = 0; attempts++;
      if (attempts >= 2) finish(false);
      else render(feedback, el('span', { style: { color: 'var(--warn)' } }, 'Not quite, one more try'));
    }
  }
  window.addEventListener('keydown', onKey, true);
  refreshMac();
  render(root,
    el('div', { class: 'row' }, setSel, macBtn, el('button', { class: 'btn', onclick: () => { if (phase === 'ask') { attempts = 2; finish(false); } else next(); } }, 'Skip / show answer'), el('button', { class: 'btn ghost', onclick: () => { session = { score: 0, right: 0, total: 0, streak: 0, best: session.best }; updateStats(); } }, 'New session'), el('button', { class: 'btn ghost', onclick: () => { stats = {}; s.set('stats', {}); updateStats(); } }, 'Forget progress')),
    el('div', { class: 'panel', style: { padding: '24px 12px' } }, el('div', { class: 'small muted', style: { textAlign: 'center' } }, 'Action'), action, pressed, feedback),
    statsRow, progress,
    el('div', { class: 'muted small' }, 'Click the page first so it has focus, then press the real key combination. Shortcuts the browser reserves (new tab, close tab, Alt+Tab, Win-key combos) are left out. Shortcuts you miss come back more often; a chord like Ctrl+K V is two presses.'));
  next();
  return () => { clearTimeout(timer); window.removeEventListener('keydown', onKey, true); };
}
