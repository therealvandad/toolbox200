import { el, render, store, uid, download, toast, loadImage, loop, copy } from '../../lib/ui.js';

const W = 960, H = 620;
const FONT = '"Segoe Print","Bradley Hand","Comic Sans MS",cursive';

const WHO = ['The mayor', 'Your neighbour', 'A suspiciously calm pigeon', 'The office printer', 'Big Lighthouse', 'The moon', 'A retired magician', 'The local bakery', 'Every cat', 'The Wi-Fi router', 'The group chat', 'Someone named Dave'];
const DO = ['has been secretly replacing', 'is quietly funding', 'planted evidence about', 'is in a long-distance relationship with', 'invented the rumour about', 'is rehearsing a speech for', 'keeps stealing socks from', 'has been sending coded messages to', 'is the true author of'];
const WHAT = ['the Tuesday meeting', 'all left socks', 'the second Monday', 'the neighbourhood squirrels', 'the elevator music', 'the missing stapler', 'the Great Cheese Shortage', 'every stock photo of a handshake', 'the lunchtime queue', 'the autocorrect', 'the clouds'];
const WHY = ['Nobody noticed because it happened on a Wednesday.', 'The evidence? A single feather.', 'Coincidence? The string says no.', 'It all started in 1997.', 'Look at the dates. Now look at them again.', 'That is exactly what they want you to think.', 'The paperwork has been shredded, but the shredder talks.', 'Follow the biscuits.'];
const pick = a => a[Math.floor(Math.random() * a.length)];

export default function (root) {
  const s = store('conspiracy-board');
  let items = s.get('items', null), links = s.get('links', []);
  const imgs = new Map();
  let dirty = true, drag = null, sel = null, selLink = -1, pinFrom = null, hover = null;
  let theory = '';

  if (!items) {
    items = [
      { id: uid(), kind: 'note', x: 90, y: 90, w: 170, h: 120, text: 'Who ate the last biscuit?', rot: -0.05, born: 0 },
      { id: uid(), kind: 'clip', x: 420, y: 70, w: 230, h: 140, head: 'LOCAL TOWN SHOCKED', text: 'Residents report that Tuesday happened twice this week.', rot: 0.03, born: 0 },
      { id: uid(), kind: 'photo', x: 700, y: 300, w: 150, h: 175, text: 'Suspect #1', rot: 0.06, born: 0, mystery: true },
    ];
    links = [[items[0].id, items[1].id], [items[1].id, items[2].id]];
  } else items.forEach(i => { i.born = 0; if (i.img) loadImage(i.img).then(im => { imgs.set(i.id, im); dirty = true; }).catch(() => {}); });

  const canvas = el('canvas', { width: W, height: H, style: { width: '100%', maxWidth: W + 'px', touchAction: 'none', borderRadius: '8px', border: '8px solid #5a3d1e', boxSizing: 'border-box' } });
  const cx = canvas.getContext('2d');
  const cork = document.createElement('canvas'); cork.width = W; cork.height = H;
  (function () {
    const c = cork.getContext('2d'); c.fillStyle = '#b98b5a'; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 9000; i++) { c.fillStyle = Math.random() < 0.5 ? 'rgba(90,55,20,.18)' : 'rgba(230,190,140,.2)'; c.fillRect(Math.random() * W, Math.random() * H, 1 + Math.random() * 3, 1 + Math.random() * 3); }
  })();

  const byId = id => items.find(i => i.id === id);
  const pinOf = i => ({ x: i.x + i.w / 2, y: i.y + 12 });
  function persist() { s.set('items', items); s.set('links', links); dirty = true; }

  function wrap(c, text, maxW) {
    const out = []; let line = '';
    for (const w of String(text).split(/\s+/)) {
      const t = line ? line + ' ' + w : w;
      if (c.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t;
    }
    if (line) out.push(line); return out;
  }

  function drawItem(c, i, t, forExport) {
    const grow = i.born ? Math.min(1, (t - i.born) / 250) : 1;
    const sc = i.born && grow < 1 ? 0.6 + 0.4 * (1 - Math.pow(1 - grow, 3)) : 1;
    c.save(); c.translate(i.x + i.w / 2, i.y + i.h / 2); c.rotate(i.rot); c.scale(sc, sc); c.translate(-i.w / 2, -i.h / 2);
    c.shadowColor = 'rgba(0,0,0,.4)'; c.shadowBlur = 10; c.shadowOffsetX = 3; c.shadowOffsetY = 5;
    if (i.kind === 'note') {
      c.fillStyle = '#fff176'; c.fillRect(0, 0, i.w, i.h); c.shadowColor = 'transparent';
      c.fillStyle = '#2b2b2b'; c.font = `17px ${FONT}`; c.textBaseline = 'top';
      wrap(c, i.text, i.w - 22).slice(0, Math.floor((i.h - 30) / 22)).forEach((l, k) => c.fillText(l, 11, 26 + k * 22));
    } else if (i.kind === 'clip') {
      c.fillStyle = '#ece6d3'; c.fillRect(0, 0, i.w, i.h); c.shadowColor = 'transparent';
      c.fillStyle = '#111'; c.font = 'bold 18px Georgia, serif'; c.textBaseline = 'top';
      const hl = wrap(c, i.head || '', i.w - 20).slice(0, 2); hl.forEach((l, k) => c.fillText(l, 10, 24 + k * 21));
      c.fillRect(10, 24 + hl.length * 21 + 2, i.w - 20, 2);
      c.font = '12px Georgia, serif'; c.fillStyle = '#333';
      wrap(c, i.text, i.w - 20).slice(0, 6).forEach((l, k) => c.fillText(l, 10, 24 + hl.length * 21 + 10 + k * 15));
    } else {
      c.fillStyle = '#f7f5ef'; c.fillRect(0, 0, i.w, i.h); c.shadowColor = 'transparent';
      const iw = i.w - 20, ih = i.h - 52, im = imgs.get(i.id);
      c.fillStyle = '#444'; c.fillRect(10, 22, iw, ih);
      if (im) {
        const k = Math.max(iw / im.width, ih / im.height); c.save(); c.beginPath(); c.rect(10, 22, iw, ih); c.clip();
        c.filter = 'grayscale(.6) contrast(1.1)'; c.drawImage(im, 10 + (iw - im.width * k) / 2, 22 + (ih - im.height * k) / 2, im.width * k, im.height * k); c.restore();
      } else {
        const g = c.createLinearGradient(0, 22, 0, 22 + ih); g.addColorStop(0, '#8a8f98'); g.addColorStop(1, '#4a4e57'); c.fillStyle = g; c.fillRect(10, 22, iw, ih);
        c.fillStyle = '#20232a'; c.beginPath(); c.arc(10 + iw / 2, 22 + ih * 0.38, ih * 0.2, 0, 6.28); c.fill();
        c.beginPath(); c.ellipse(10 + iw / 2, 22 + ih * 0.95, iw * 0.34, ih * 0.38, 0, Math.PI, 0); c.fill();
        c.fillStyle = 'rgba(255,255,255,.7)'; c.font = `bold ${Math.round(ih * 0.3)}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('?', 10 + iw / 2, 22 + ih * 0.4); c.textAlign = 'left';
      }
      c.fillStyle = '#222'; c.font = `15px ${FONT}`; c.textBaseline = 'middle'; c.textAlign = 'center';
      c.fillText(String(i.text || '').slice(0, 20), i.w / 2, i.h - 15); c.textAlign = 'left';
    }
    c.restore();
    if (!forExport && sel === i.id) {
      c.save(); c.translate(i.x + i.w / 2, i.y + i.h / 2); c.rotate(i.rot); c.strokeStyle = '#1e90ff'; c.lineWidth = 3; c.setLineDash([8, 5]); c.strokeRect(-i.w / 2 - 4, -i.h / 2 - 4, i.w + 8, i.h + 8); c.restore();
    }
  }
  function sagPoint(a, b, t) {
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 + Math.min(60, Math.hypot(a.x - b.x, a.y - b.y) * 0.18);
    const u = 1 - t; return { x: u * u * a.x + 2 * u * t * mx + t * t * b.x, y: u * u * a.y + 2 * u * t * my + t * t * b.y };
  }
  function drawString(c, a, b, hl) {
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 + Math.min(60, Math.hypot(a.x - b.x, a.y - b.y) * 0.18);
    c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 3; c.beginPath(); c.moveTo(a.x + 2, a.y + 4); c.quadraticCurveTo(mx + 2, my + 4, b.x + 2, b.y + 4); c.stroke();
    c.strokeStyle = hl ? '#ff5252' : '#c62828'; c.lineWidth = hl ? 4 : 2.5; c.beginPath(); c.moveTo(a.x, a.y); c.quadraticCurveTo(mx, my, b.x, b.y); c.stroke();
  }
  function drawPin(c, p, active) {
    c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.arc(p.x + 2, p.y + 3, 7, 0, 6.28); c.fill();
    const g = c.createRadialGradient(p.x - 2, p.y - 2, 1, p.x, p.y, 8); g.addColorStop(0, '#ff8a80'); g.addColorStop(1, '#b71c1c');
    c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, 7, 0, 6.28); c.fill();
    if (active) { c.strokeStyle = '#fff'; c.lineWidth = 2.5; c.beginPath(); c.arc(p.x, p.y, 12, 0, 6.28); c.stroke(); }
  }
  function paint(c, t, forExport) {
    c.drawImage(cork, 0, 0);
    items.forEach(i => drawItem(c, i, t, forExport));
    links.forEach((l, k) => { const a = byId(l[0]), b = byId(l[1]); if (a && b) drawString(c, pinOf(a), pinOf(b), !forExport && k === selLink); });
    if (!forExport && pinFrom && byId(pinFrom) && hover) drawString(c, pinOf(byId(pinFrom)), hover, true);
    items.forEach(i => drawPin(c, pinOf(i), !forExport && pinFrom === i.id));
  }

  const stop = loop((dt, t) => {
    if (items.some(i => i.born)) { dirty = true; items.forEach(i => { if (i.born && t - i.born > 260) i.born = 0; }); }
    if (!dirty) return; dirty = false; paint(cx, t, false);
  });

  const pos = e => { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height }; };
  function itemAt(p) { for (let k = items.length - 1; k >= 0; k--) { const i = items[k]; if (p.x >= i.x && p.x <= i.x + i.w && p.y >= i.y && p.y <= i.y + i.h) return i; } return null; }
  function pinAt(p) { for (let k = items.length - 1; k >= 0; k--) { const q = pinOf(items[k]); if (Math.hypot(p.x - q.x, p.y - q.y) < 13) return items[k]; } return null; }
  function linkAt(p) {
    for (let k = links.length - 1; k >= 0; k--) {
      const a = byId(links[k][0]), b = byId(links[k][1]); if (!a || !b) continue;
      for (let u = 0.05; u < 0.96; u += 0.05) { const q = sagPoint(pinOf(a), pinOf(b), u); if (Math.hypot(q.x - p.x, q.y - p.y) < 9) return k; }
    }
    return -1;
  }

  canvas.addEventListener('pointerdown', e => {
    e.preventDefault(); canvas.setPointerCapture(e.pointerId);
    const p = pos(e), pin = pinAt(p);
    if (pin) {
      if (!pinFrom) { pinFrom = pin.id; sel = pin.id; selLink = -1; syncEditor(); toast('Now click another pin to tie the string'); }
      else if (pinFrom === pin.id) pinFrom = null;
      else {
        const exists = links.some(l => (l[0] === pinFrom && l[1] === pin.id) || (l[1] === pinFrom && l[0] === pin.id));
        if (!exists) links.push([pinFrom, pin.id]);
        pinFrom = null; persist();
      }
      dirty = true; return;
    }
    const it = itemAt(p);
    if (it) {
      sel = it.id; selLink = -1; items.push(items.splice(items.indexOf(it), 1)[0]);
      drag = { it, dx: p.x - it.x, dy: p.y - it.y, moved: false }; syncEditor();
    } else {
      const lk = linkAt(p); selLink = lk; sel = null; pinFrom = null; syncEditor();
    }
    dirty = true;
  });
  canvas.addEventListener('pointermove', e => {
    const p = pos(e); hover = p;
    if (drag) { drag.it.x = Math.max(-20, Math.min(W - drag.it.w + 20, p.x - drag.dx)); drag.it.y = Math.max(-10, Math.min(H - drag.it.h + 20, p.y - drag.dy)); drag.moved = true; dirty = true; }
    else if (pinFrom) dirty = true;
    else canvas.style.cursor = pinAt(p) ? 'pointer' : itemAt(p) ? 'grab' : 'default';
  });
  const up = () => { if (drag && drag.moved) persist(); drag = null; };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);

  // editor
  const textIn = el('input', { class: 'input grow', placeholder: 'Text for a new note, or edit the selected item', maxlength: 140, onkeydown: e => e.key === 'Enter' && addNote() });
  const headIn = el('input', { class: 'input', placeholder: 'Clipping headline', maxlength: 40, style: { width: '170px' } });
  const fileIn = el('input', { type: 'file', accept: 'image/*', class: 'hidden', onchange: async () => { const f = fileIn.files[0]; fileIn.value = ''; if (f) addPhoto(f); } });
  function syncEditor() {
    const i = byId(sel);
    if (i) { textIn.value = i.text || ''; headIn.value = i.head || ''; }
    editing.textContent = i ? 'Editing the selected ' + (i.kind === 'clip' ? 'clipping' : i.kind) + ' (click empty board to deselect)' : '';
  }
  const editing = el('span', { class: 'small muted' });
  textIn.addEventListener('input', () => { const i = byId(sel); if (i) { i.text = textIn.value; persist(); } });
  headIn.addEventListener('input', () => { const i = byId(sel); if (i && i.kind === 'clip') { i.head = headIn.value; persist(); } });

  const spot = () => ({ x: 60 + Math.random() * (W - 300), y: 60 + Math.random() * (H - 260) });
  function add(o) { const it = { id: uid(), rot: (Math.random() - 0.5) * 0.14, born: performance.now(), ...spot(), ...o }; items.push(it); sel = null; syncEditor(); persist(); return it; }
  function addNote() { add({ kind: 'note', w: 170, h: 120, text: textIn.value.trim() || 'It was them.' }); textIn.value = ''; }
  function addClip() { add({ kind: 'clip', w: 230, h: 140, head: headIn.value.trim().toUpperCase() || 'BREAKING', text: textIn.value.trim() || 'Sources confirm that nothing is as it seems.' }); textIn.value = ''; headIn.value = ''; }
  function addMystery() { add({ kind: 'photo', w: 150, h: 175, text: textIn.value.trim() || 'Unknown', mystery: true }); textIn.value = ''; }
  async function addPhoto(f) {
    try {
      const im = await loadImage(f);
      const k = Math.min(1, 260 / Math.max(im.naturalWidth, im.naturalHeight)), c = document.createElement('canvas');
      c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      if (im.src.startsWith('blob:')) URL.revokeObjectURL(im.src);
      const url = c.toDataURL('image/jpeg', 0.7), it = add({ kind: 'photo', w: 150, h: 175, text: textIn.value.trim() || f.name.replace(/\.[^.]+$/, ''), img: url });
      imgs.set(it.id, c); dirty = true; textIn.value = '';
    } catch { toast('Could not load that image'); }
  }
  function removeSel() {
    if (selLink >= 0) { links.splice(selLink, 1); selLink = -1; }
    else if (sel) { links = links.filter(l => l[0] !== sel && l[1] !== sel); items = items.filter(i => i.id !== sel); imgs.delete(sel); sel = null; }
    pinFrom = null; persist();
  }
  const onKey = e => { if ((e.key === 'Delete' || e.key === 'Backspace') && document.activeElement === canvas) { e.preventDefault(); removeSel(); } if (e.key === 'Escape') { pinFrom = null; dirty = true; } };
  canvas.tabIndex = 0; canvas.addEventListener('keydown', onKey);

  // theory
  const theoryBox = el('div', { class: 'panel', style: { minHeight: '3.2em', fontFamily: FONT, fontSize: '16px' } }, 'Press "Generate theory" to uncover the truth.');
  function genTheory() {
    const names = items.filter(i => i.kind !== 'photo' || i.text).map(i => (i.head || i.text || '').trim()).filter(Boolean);
    const a = names.length > 1 && Math.random() < 0.6 ? '"' + pick(names).slice(0, 40) + '"' : pick(WHO);
    const b = names.length > 1 && Math.random() < 0.5 ? '"' + pick(names).slice(0, 40) + '"' : pick(WHAT);
    theory = `${a} ${pick(DO)} ${b}. ${pick(WHY)}`;
    theoryBox.textContent = theory;
  }
  function theoryToClip() { if (!theory) genTheory(); add({ kind: 'clip', w: 250, h: 150, head: 'THE TRUTH', text: theory }); }

  function exportPng() { const c = document.createElement('canvas'); c.width = W; c.height = H; paint(c.getContext('2d'), performance.now() + 1e6, true); c.toBlob(b => { download('conspiracy-board.png', b, 'image/png'); toast('Saved'); }); }

  render(root,
    el('div', { class: 'row' }, textIn, headIn), editing,
    el('div', { class: 'row' },
      el('button', { class: 'btn primary', onclick: addNote }, 'Add note'),
      el('button', { class: 'btn', onclick: addClip }, 'Add clipping'),
      el('button', { class: 'btn', onclick: () => fileIn.click() }, 'Add photo'),
      el('button', { class: 'btn', onclick: addMystery }, 'Mystery photo'),
      el('button', { class: 'btn danger', onclick: removeSel }, 'Delete selected'),
      el('button', { class: 'btn', onclick: exportPng }, 'Export PNG'),
      fileIn),
    el('div', { class: 'canvas-wrap' }, canvas),
    el('p', { class: 'small muted' }, 'Drag items. Click a red pin, then another pin, to tie a string. Click an item or string to select it, then Delete. Edit the selected item with the text boxes above.'),
    el('div', { class: 'row' }, el('button', { class: 'btn primary', onclick: genTheory }, 'Generate theory'), el('button', { class: 'btn', onclick: theoryToClip }, 'Pin it to the board'), el('button', { class: 'btn ghost', onclick: () => theory && copy(theory) }, 'Copy')),
    theoryBox);
  return () => { stop(); canvas.removeEventListener('keydown', onKey); persist(); };
}
