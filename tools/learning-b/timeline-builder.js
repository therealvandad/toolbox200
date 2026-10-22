// Historical timeline builder: zoomable horizontal timeline with JSON and PNG export.
import { el, render, store, download, readFile, dropZone, uid, field, toast } from '../../lib/ui.js';

const SAMPLE = {
  title: 'Space exploration',
  events: [
    { year: 1957, title: 'Sputnik 1', desc: 'First artificial satellite orbits Earth.', color: '#d64545' },
    { year: 1961, title: 'Gagarin in orbit', desc: 'Yuri Gagarin becomes the first human in space.', color: '#d64545' },
    { year: 1962, title: 'Mariner 2', desc: 'First successful planetary flyby, of Venus.', color: '#2f6fed' },
    { year: 1965, title: 'First spacewalk', desc: 'Alexei Leonov leaves Voskhod 2 for 12 minutes.', color: '#d64545' },
    { year: 1969, title: 'Apollo 11', desc: 'Armstrong and Aldrin walk on the Moon.', color: '#2f6fed' },
    { year: 1971, title: 'Salyut 1', desc: 'First space station launched.', color: '#d64545' },
    { year: 1976, title: 'Viking 1 lands on Mars', desc: 'First successful Mars lander returns images.', color: '#2f6fed' },
    { year: 1977, title: 'Voyager 1 and 2', desc: 'Grand tour of the outer planets begins.', color: '#2f6fed' },
    { year: 1981, title: 'Space Shuttle', desc: 'Columbia makes the first reusable orbiter flight.', color: '#2f6fed' },
    { year: 1986, title: 'Mir', desc: 'Modular space station assembled in orbit.', color: '#d64545' },
    { year: 1990, title: 'Hubble Space Telescope', desc: 'Launched aboard Discovery.', color: '#1f9d55' },
    { year: 1998, title: 'ISS assembly begins', desc: 'Zarya module launched.', color: '#1f9d55' },
    { year: 2004, title: 'Spirit and Opportunity', desc: 'Twin rovers land on Mars.', color: '#2f6fed' },
    { year: 2012, title: 'Curiosity', desc: 'Rover lands in Gale crater.', color: '#2f6fed' },
    { year: 2015, title: 'New Horizons at Pluto', desc: 'First close-up images of Pluto.', color: '#2f6fed' },
    { year: 2021, title: 'JWST launch', desc: 'James Webb Space Telescope lifts off.', color: '#1f9d55' },
  ],
};
const PALETTE = ['#2f6fed', '#d64545', '#1f9d55', '#d98c0b', '#8e44ad', '#16a085', '#e67e22', '#5d6670'];

export default function (root) {
  const s = store('timeline-builder');
  let data = s.get('data', null);
  if (!data || !Array.isArray(data.events)) data = JSON.parse(JSON.stringify(SAMPLE));
  data.events.forEach(e => { e.id ??= uid(); });
  let pxPerYear = s.get('zoom', 14), offsetX = s.get('offset', null);
  let editing = null, dragging = null;

  const canvas = el('canvas', { height: 360, style: { width: '100%', height: '360px', display: 'block', cursor: 'grab', touchAction: 'none' } });
  const ctx = canvas.getContext('2d');
  const titleIn = el('input', { class: 'input', value: data.title || '', placeholder: 'Timeline title', oninput: () => { data.title = titleIn.value; save(); draw(); } });
  const fYear = el('input', { class: 'input', type: 'number', placeholder: '1969', style: { width: '100px' } });
  const fTitle = el('input', { class: 'input', placeholder: 'Event title' });
  const fDesc = el('input', { class: 'input', placeholder: 'Description (optional)' });
  const fColor = el('input', { type: 'color', value: PALETTE[0], style: { width: '48px', height: '36px', padding: '2px', border: '1px solid var(--line)', borderRadius: '8px', background: 'var(--bg)' } });
  const addBtn = el('button', { class: 'btn primary', onclick: submit }, 'Add event');
  const cancelBtn = el('button', { class: 'btn ghost hidden', onclick: () => setEditing(null) }, 'Cancel');
  const list = el('div', { class: 'scroll-x' });
  const zoomLabel = el('span', { class: 'muted small' });

  function save() { s.set('data', data); s.set('zoom', pxPerYear); s.set('offset', offsetX); }
  function sorted() { return [...data.events].sort((a, b) => a.year - b.year); }
  function range() { const ys = data.events.map(e => e.year); return ys.length ? [Math.min(...ys), Math.max(...ys)] : [2000, 2020]; }
  function fit() { const W = canvas.clientWidth || 800; const [a, b] = range(); const span = Math.max(1, b - a); pxPerYear = Math.max(0.05, Math.min(400, (W - 160) / span)); offsetX = 80 - a * pxPerYear; save(); draw(); }
  const xOf = y => y * pxPerYear + offsetX;

  function niceStep() { const target = 90 / pxPerYear; const steps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000]; return steps.find(st => st >= target) || 10000; }
  function layout() {
    // Assign each event a level above/below the axis so labels do not overlap.
    ctx.font = 'bold 12px system-ui,sans-serif';
    const items = sorted().map(e => ({ e, x: xOf(e.year), w: Math.max(60, ctx.measureText(e.title).width + 12) }));
    const lanes = [[], []]; // above, below: list of [x0, x1] per level
    for (let i = 0; i < items.length; i++) {
      const it = items[i]; const side = i % 2; it.side = side; const levels = lanes[side]; let lvl = 0;
      for (;;) { levels[lvl] ??= []; if (!levels[lvl].some(([a, b]) => it.x < b + 8 && it.x + it.w > a - 8)) { levels[lvl].push([it.x, it.x + it.w]); break; } lvl++; if (lvl > 5) { levels[lvl] ??= []; levels[lvl].push([it.x, it.x + it.w]); break; } }
      it.level = lvl;
    }
    return items;
  }
  function draw() {
    const W = canvas.clientWidth || 800; if (canvas.width !== W * devicePixelRatio) { canvas.width = W * devicePixelRatio; canvas.height = 360 * devicePixelRatio; }
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    const H = 360, axisY = 200; const cs = getComputedStyle(document.documentElement);
    const text = cs.getPropertyValue('--text').trim() || '#111', muted = cs.getPropertyValue('--muted').trim() || '#888', line = cs.getPropertyValue('--line').trim() || '#ddd', panel = cs.getPropertyValue('--panel').trim() || '#fff';
    ctx.fillStyle = panel; ctx.fillRect(0, 0, W, H);
    if (offsetX == null) { fit(); return; }
    // ticks
    const step = niceStep(); const y0 = Math.floor((0 - offsetX) / pxPerYear / step) * step, y1 = Math.ceil((W - offsetX) / pxPerYear / step) * step;
    ctx.strokeStyle = line; ctx.lineWidth = 1; ctx.fillStyle = muted; ctx.font = '11px system-ui,sans-serif'; ctx.textAlign = 'center';
    for (let y = y0; y <= y1; y += step) { const x = xOf(y); ctx.beginPath(); ctx.moveTo(x, 20); ctx.lineTo(x, H - 20); ctx.stroke(); ctx.fillText(y < 0 ? Math.abs(y) + ' BC' : String(y), x, H - 6); }
    ctx.strokeStyle = muted; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, axisY); ctx.lineTo(W, axisY); ctx.stroke();
    // title
    ctx.fillStyle = text; ctx.font = 'bold 16px system-ui,sans-serif'; ctx.textAlign = 'left'; ctx.fillText(data.title || '', 10, 24);
    // events
    const items = layout(); draw.items = items;
    for (const it of items) {
      const dir = it.side === 0 ? -1 : 1; const y = axisY + dir * (36 + it.level * 40); const x = it.x; const sel = editing === it.e.id;
      ctx.strokeStyle = it.e.color || PALETTE[0]; ctx.lineWidth = sel ? 3 : 1.5; ctx.beginPath(); ctx.moveTo(x, axisY); ctx.lineTo(x, y); ctx.stroke();
      ctx.fillStyle = it.e.color || PALETTE[0]; ctx.beginPath(); ctx.arc(x, axisY, sel ? 7 : 5, 0, Math.PI * 2); ctx.fill();
      const bw = it.w, bh = 30; const bx = x - bw / 2, by = dir < 0 ? y - bh : y;
      ctx.fillStyle = panel; ctx.strokeStyle = sel ? text : (it.e.color || PALETTE[0]); ctx.lineWidth = sel ? 2 : 1; ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 6); ctx.fill(); ctx.stroke();
      ctx.fillStyle = text; ctx.font = 'bold 12px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.fillText(it.e.title, x, by + 13);
      ctx.fillStyle = muted; ctx.font = '10px system-ui,sans-serif'; ctx.fillText(String(it.e.year < 0 ? Math.abs(it.e.year) + ' BC' : it.e.year), x, by + 25);
      it.box = [bx, by, bw, bh];
    }
    zoomLabel.textContent = pxPerYear.toFixed(2) + ' px/year · ' + step + '-year ticks';
  }
  function hit(mx, my) { for (const it of draw.items || []) { const [bx, by, bw, bh] = it.box; if (mx >= bx && mx <= bx + bw && my >= by && my <= by + bh) return it.e; if (Math.hypot(mx - it.x, my - 200) < 8) return it.e; } return null; }
  function setEditing(id) {
    editing = id; const e = data.events.find(x => x.id === id);
    if (e) { fYear.value = e.year; fTitle.value = e.title; fDesc.value = e.desc || ''; fColor.value = e.color || PALETTE[0]; addBtn.textContent = 'Save changes'; cancelBtn.classList.remove('hidden'); }
    else { fYear.value = ''; fTitle.value = ''; fDesc.value = ''; addBtn.textContent = 'Add event'; cancelBtn.classList.add('hidden'); }
    draw(); renderList();
  }
  function submit() {
    const year = parseInt(fYear.value, 10); const title = fTitle.value.trim();
    if (!Number.isFinite(year) || !title) { toast('Year and title are required'); return; }
    if (editing) { const e = data.events.find(x => x.id === editing); Object.assign(e, { year, title, desc: fDesc.value.trim(), color: fColor.value }); }
    else { data.events.push({ id: uid(), year, title, desc: fDesc.value.trim(), color: fColor.value }); fColor.value = PALETTE[data.events.length % PALETTE.length]; }
    save(); setEditing(null); fYear.focus();
  }
  function renderList() {
    render(list, el('table', { class: 'table' }, el('thead', {}, el('tr', {}, el('th', {}, 'Year'), el('th', {}, 'Event'), el('th', {}, 'Description'), el('th', {}, ''))),
      el('tbody', {}, sorted().map(e => el('tr', { style: { background: editing === e.id ? 'var(--bg)' : '' } },
        el('td', { class: 'mono' }, e.year < 0 ? Math.abs(e.year) + ' BC' : e.year),
        el('td', {}, el('span', { style: { display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: e.color || PALETTE[0], marginRight: '6px' } }), e.title),
        el('td', { class: 'muted small' }, e.desc || ''),
        el('td', {}, el('button', { class: 'btn small', onclick: () => { setEditing(e.id); offsetX = (canvas.clientWidth || 800) / 2 - e.year * pxPerYear; save(); draw(); } }, 'Edit'), ' ', el('button', { class: 'btn small danger', onclick: () => { data.events = data.events.filter(x => x !== e); if (editing === e.id) editing = null; save(); setEditing(null); } }, '✕')))))));
  }
  // pan / zoom / click
  canvas.addEventListener('pointerdown', e => { dragging = { x: e.clientX, off: offsetX, moved: false }; canvas.setPointerCapture(e.pointerId); canvas.style.cursor = 'grabbing'; });
  canvas.addEventListener('pointermove', e => { if (!dragging) return; const dx = e.clientX - dragging.x; if (Math.abs(dx) > 3) dragging.moved = true; offsetX = dragging.off + dx; draw(); });
  canvas.addEventListener('pointerup', e => { if (!dragging) return; canvas.style.cursor = 'grab'; if (!dragging.moved) { const r = canvas.getBoundingClientRect(); const ev = hit(e.clientX - r.left, e.clientY - r.top); if (ev) setEditing(ev.id); else if (editing) setEditing(null); } dragging = null; save(); });
  canvas.addEventListener('wheel', e => { e.preventDefault(); const r = canvas.getBoundingClientRect(); const mx = e.clientX - r.left; const yearAt = (mx - offsetX) / pxPerYear; pxPerYear = Math.max(0.05, Math.min(400, pxPerYear * (e.deltaY < 0 ? 1.15 : 1 / 1.15))); offsetX = mx - yearAt * pxPerYear; save(); draw(); }, { passive: false });
  function zoom(f) { const W = canvas.clientWidth || 800; const yearAt = (W / 2 - offsetX) / pxPerYear; pxPerYear = Math.max(0.05, Math.min(400, pxPerYear * f)); offsetX = W / 2 - yearAt * pxPerYear; save(); draw(); }
  function exportPng() {
    const out = el('canvas', { width: canvas.width, height: canvas.height }); const c2 = out.getContext('2d'); c2.drawImage(canvas, 0, 0);
    out.toBlob(b => download((data.title || 'timeline').replace(/[^\w-]+/g, '_') + '.png', b, 'image/png'));
  }
  function importJson(files) {
    readFile(files[0], 'text').then(t => { const j = JSON.parse(t); const evs = Array.isArray(j) ? j : j.events; if (!Array.isArray(evs)) throw new Error('no events'); data = { title: (j.title || files[0].name.replace(/\.json$/i, '')), events: evs.filter(e => e && Number.isFinite(+e.year) && e.title).map(e => ({ id: uid(), year: +e.year, title: String(e.title), desc: e.desc ? String(e.desc) : '', color: /^#[0-9a-f]{6}$/i.test(e.color || '') ? e.color : PALETTE[0] })) }; titleIn.value = data.title; save(); setEditing(null); fit(); toast('Imported ' + data.events.length + ' events'); }).catch(() => toast('Could not read that JSON file'));
  }
  const onResize = () => draw(); window.addEventListener('resize', onResize);
  const onKey = e => { if (e.key === 'Enter' && [fYear, fTitle, fDesc].includes(e.target)) submit(); if (e.key === 'Escape' && editing) setEditing(null); };
  root.addEventListener('keydown', onKey);
  const mo = new MutationObserver(draw); mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  render(root,
    el('div', { class: 'row' }, titleIn, el('button', { class: 'btn', onclick: () => zoom(1.4) }, 'Zoom +'), el('button', { class: 'btn', onclick: () => zoom(1 / 1.4) }, 'Zoom −'), el('button', { class: 'btn', onclick: fit }, 'Fit all'), zoomLabel),
    el('div', { style: { border: '1px solid var(--line)', borderRadius: '8px', overflow: 'hidden' } }, canvas),
    el('div', { class: 'muted small' }, 'Drag to pan, scroll to zoom, click an event to edit it.'),
    el('div', { class: 'row', style: { alignItems: 'flex-end' } }, field('Year (negative = BC)', fYear), field('Title', fTitle), el('label', { class: 'field grow' }, 'Description', fDesc), field('Color', fColor), addBtn, cancelBtn),
    list,
    el('div', { class: 'row' },
      el('button', { class: 'btn', onclick: () => download((data.title || 'timeline').replace(/[^\w-]+/g, '_') + '.json', JSON.stringify({ title: data.title, events: sorted().map(({ year, title, desc, color }) => ({ year, title, desc, color })) }, null, 2), 'application/json') }, 'Export JSON'),
      el('button', { class: 'btn', onclick: exportPng }, 'Export PNG'),
      el('button', { class: 'btn ghost', onclick: () => { data = JSON.parse(JSON.stringify(SAMPLE)); data.events.forEach(e => e.id = uid()); titleIn.value = data.title; save(); setEditing(null); fit(); } }, 'Load sample'),
      el('button', { class: 'btn ghost', onclick: () => { data = { title: 'My timeline', events: [] }; titleIn.value = data.title; save(); setEditing(null); fit(); } }, 'New empty'),
      el('div', { class: 'grow' }, dropZone('Import JSON (drop or click) — [{year, title, desc, color}] or {title, events}', importJson, '.json,application/json', false))));
  renderList(); requestAnimationFrame(() => { draw(); if (offsetX == null) fit(); });
  return () => { window.removeEventListener('resize', onResize); root.removeEventListener('keydown', onKey); mo.disconnect(); };
}
