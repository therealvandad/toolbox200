// Group availability finder (when2meet style). Share link carries the date/hour grid; people send back a short code.
import { el, render, store, copy, field, toast } from '../../lib/ui.js';
import { enc, dec, shareUrl, sharedData, leaveShared, h3, toISO, parseISO, addDays } from './_share.js';

const TOOL = 'availability';
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const hourLabel = h => (h % 12 || 12) + (h < 12 || h === 24 ? 'am' : 'pm');

function days(cfg) { const out = []; let d = parseISO(cfg.start); const end = parseISO(cfg.end); for (let i = 0; i < 31 && d <= end; i++, d = addDays(d, 1)) out.push(new Date(d)); return out; }

/** Build a grid. cell(dayIdx, hour, el) is called to style/label each cell. Returns {node, setPaint}. */
function buildGrid(cfg, onPaint, style) {
  const ds = days(cfg), hours = []; for (let h = cfg.h0; h < cfg.h1; h++) hours.push(h);
  const table = el('div', { style: { display: 'grid', gridTemplateColumns: `52px repeat(${ds.length}, minmax(34px, 1fr))`, gap: '2px', userSelect: 'none', touchAction: onPaint ? 'none' : 'auto', minWidth: (52 + ds.length * 38) + 'px' } });
  const cells = [];
  table.append(el('div', {}));
  ds.forEach(d => table.append(el('div', { class: 'small muted center', style: { lineHeight: '1.2' } }, DOW[d.getDay()], el('br'), (d.getMonth() + 1) + '/' + d.getDate())));
  hours.forEach(h => {
    table.append(el('div', { class: 'small muted', style: { textAlign: 'right', paddingRight: '4px', lineHeight: '24px' } }, hourLabel(h)));
    ds.forEach((d, di) => {
      const c = el('div', { style: { height: '24px', borderRadius: '4px', border: '1px solid var(--line)', background: 'var(--bg)', cursor: onPaint ? 'pointer' : 'default' } });
      c._d = di; c._h = h; cells.push(c); table.append(c);
    });
  });
  const refresh = () => cells.forEach(c => style(c, c._d, c._h));
  let mode = null, last = null;
  if (onPaint) {
    const at = e => { const t = document.elementFromPoint(e.clientX, e.clientY); return t && t._d != null && cells.includes(t) ? t : null; };
    const apply = c => { if (!c || c === last) return; last = c; onPaint(c._d, c._h, mode); refresh(); };
    table.addEventListener('pointerdown', e => { const c = at(e); if (!c) return; e.preventDefault(); mode = onPaint(c._d, c._h, 'peek') ? 'off' : 'on'; last = null; apply(c); });
    table.addEventListener('pointermove', e => { if (mode) apply(at(e)); });
    const up = () => { mode = null; last = null; };
    table.addEventListener('pointerup', up); table.addEventListener('pointercancel', up); table.addEventListener('pointerleave', up);
  }
  refresh();
  return { node: el('div', { class: 'scroll-x' }, table), refresh, days: ds };
}

const bitOn = (masks, d, h, h0) => !!((masks[d] || 0) & (1 << (h - h0)));
function toggleBit(masks, d, h, h0, mode) {
  const on = bitOn(masks, d, h, h0);
  if (mode === 'peek') return on;
  if (mode === 'on') masks[d] = (masks[d] || 0) | (1 << (h - h0)); else masks[d] = (masks[d] || 0) & ~(1 << (h - h0));
}

export default function (root) {
  const s = store(TOOL);
  const shared = sharedData(TOOL);
  const note = el('div', { class: 'muted small' }, 'How sharing works: no server. "Copy share link" bakes the date and hour grid into a URL. People open it, paint when they are free, and send back a short code. Paste the codes below and the overlap heatmap updates. Everything else stays in this browser.');
  if (shared) return guestView(root, shared, note);

  const t0 = new Date();
  const st = s.get('state', { title: '', start: toISO(addDays(t0, 1)), end: toISO(addDays(t0, 7)), h0: 9, h1: 18, people: {} });
  const save = () => s.set('state', st);
  let me = s.get('me', '');
  const cfg = () => ({ title: st.title, start: st.start, end: st.end, h0: st.h0, h1: st.h1 });

  const heatHost = el('div'), paintHost = el('div'), best = el('div', { class: 'col' });
  const peopleRow = el('div', { class: 'row' });
  const meIn = el('input', { class: 'input', placeholder: 'Name (e.g. Sam)', value: me, list: 'avail-people', oninput: e => { me = e.target.value.trim(); s.set('me', me); drawPaint(); } });
  const dl = el('datalist', { id: 'avail-people' });
  const tip = el('div', { class: 'small muted', style: { minHeight: '20px' } }, 'Hover a heatmap cell to see who is free.');
  const linkOut = el('input', { class: 'input grow mono small', readOnly: true, placeholder: 'Share link appears here' });
  const codesTa = el('textarea', { class: 'textarea', style: { minHeight: '80px' }, placeholder: 'Paste response codes here (any whitespace between them)' });
  const importMsg = el('span', { class: 'small muted' });

  const inp = (k, type, extra = {}) => el('input', { class: 'input', type, value: st[k], ...extra, oninput: e => { st[k] = type === 'number' ? Math.round(+e.target.value) : e.target.value; if (type === 'number') clampHours(); save(); } , onchange: () => { redrawAll(); } });
  function clampHours() { st.h0 = Math.max(0, Math.min(23, st.h0 || 0)); st.h1 = Math.max(st.h0 + 1, Math.min(24, st.h1 || 24)); }
  const setup = el('div', { class: 'grid2' },
    field('Event title', el('input', { class: 'input', placeholder: 'Team sync', value: st.title, oninput: e => { st.title = e.target.value; save(); } })),
    el('div'),
    field('First day', inp('start', 'date')), field('Last day (max 31 days)', inp('end', 'date')),
    field('Earliest hour (0-23)', inp('h0', 'number', { min: 0, max: 23 })), field('Latest hour end (1-24)', inp('h1', 'number', { min: 1, max: 24 })));

  function normalize() {
    if (!st.start || !st.end || parseISO(st.end) < parseISO(st.start)) st.end = st.start || toISO(new Date());
    if (!st.start) st.start = toISO(new Date());
    clampHours(); save();
  }
  const maskOf = name => st.people[name] || (st.people[name] = []);

  function drawPaint() {
    normalize();
    if (!me) { render(paintHost, el('div', { class: 'muted small' }, 'Type your name above to paint your own availability, or paste response codes from others.')); return; }
    const m = maskOf(me);
    const g = buildGrid(cfg(), (d, h, mode) => { const r = toggleBit(m, d, h, st.h0, mode); if (mode !== 'peek') { save(); drawHeat(); drawPeople(); } return r; },
      (c, d, h) => { const on = bitOn(m, d, h, st.h0); c.style.background = on ? 'var(--ok)' : 'var(--bg)'; });
    render(paintHost, el('div', { class: 'small muted' }, `Painting for ${me}: click or drag to mark free hours (drag over a green cell first to erase).`), g.node);
  }
  function heatInfo() {
    const names = Object.keys(st.people).filter(n => (st.people[n] || []).some(x => x));
    const ds = days(cfg()), res = [];
    ds.forEach((d, di) => { for (let h = st.h0; h < st.h1; h++) { const who = names.filter(n => bitOn(st.people[n], di, h, st.h0)); res.push({ di, d, h, who }); } });
    return { names, ds, res };
  }
  function drawHeat() {
    const { names, ds, res } = heatInfo(); const total = Math.max(1, names.length);
    const g = buildGrid(cfg(), null, (c, d, h) => {
      const r = res.find(x => x.di === d && x.h === h); const n = r ? r.who.length : 0;
      c.style.background = n ? `color-mix(in srgb, var(--ok) ${Math.round(18 + 82 * n / total)}%, var(--bg))` : 'var(--bg)';
      c.style.color = 'var(--text)'; c.style.fontSize = '11px'; c.style.textAlign = 'center'; c.style.lineHeight = '22px'; c.textContent = n || '';
      c.title = r ? `${n}/${names.length} free: ${r.who.join(', ') || 'nobody'}` : '';
      c.onmouseenter = () => { tip.textContent = r ? `${DOW[ds[d].getDay()]} ${ds[d].getMonth() + 1}/${ds[d].getDate()} ${hourLabel(h)}: ${n}/${names.length} free` + (n ? ' (' + r.who.join(', ') + ')' : '') : ''; };
    });
    const top = res.filter(r => r.who.length).sort((a, b) => b.who.length - a.who.length || a.di - b.di || a.h - b.h).slice(0, 6);
    render(heatHost, g.node);
    render(best, top.length ? [el('div', { class: 'small muted' }, 'Best times'), top.map(r => el('div', {}, el('span', { class: 'badge ok', style: { marginRight: '6px' } }, `${r.who.length}/${names.length}`), `${DOW[r.d.getDay()]} ${r.d.getMonth() + 1}/${r.d.getDate()}, ${hourLabel(r.h)}-${hourLabel(r.h + 1)}`, el('span', { class: 'small muted' }, '  ' + r.who.join(', '))))] : el('div', { class: 'muted small' }, 'No availability recorded yet.'));
  }
  function drawPeople() {
    const names = Object.keys(st.people);
    render(dl, names.map(n => el('option', { value: n })));
    render(peopleRow, names.length ? names.map(n => el('span', { class: 'badge' }, n, ' ', el('a', { href: '#', title: 'Remove', onclick: e => { e.preventDefault(); delete st.people[n]; if (me === n) { me = ''; meIn.value = ''; } save(); redrawAll(); } }, '✕'))) : el('span', { class: 'small muted' }, 'No people yet.'));
  }
  function redrawAll() { drawPaint(); drawHeat(); drawPeople(); }
  function importCodes() {
    let ok = 0, bad = 0;
    for (const c of codesTa.value.split(/\s+/).filter(Boolean)) {
      try { const d = dec(c); if (d.t !== TOOL || !d.r || !d.r.n || !Array.isArray(d.r.a)) throw 0; st.people[String(d.r.n).slice(0, 40)] = d.r.a.map(x => (+x | 0)); ok++; } catch { bad++; }
    }
    save(); codesTa.value = ''; importMsg.textContent = `${ok} imported${bad ? `, ${bad} invalid` : ''}`; redrawAll();
  }

  render(root, note, h3('Event'), setup,
    h3('My availability'), field('Your name', meIn), dl, paintHost,
    h3('Group overlap'), peopleRow, tip, heatHost, best,
    h3('Share'),
    el('div', { class: 'row' }, el('button', { class: 'btn primary', onclick: () => { normalize(); const u = shareUrl(TOOL, cfg()); linkOut.value = u; copy(u); } }, 'Copy share link'), linkOut),
    h3('Import responses'), codesTa,
    el('div', { class: 'row' }, el('button', { class: 'btn', onclick: importCodes }, 'Import codes'), importMsg));
  redrawAll();
}

function guestView(root, cfg, note) {
  const s = store(TOOL + '-guest');
  cfg = { title: String(cfg.title || ''), start: cfg.start, end: cfg.end, h0: Math.max(0, +cfg.h0 || 0), h1: Math.min(24, +cfg.h1 || 24) };
  const masks = s.get('masks:' + JSON.stringify(cfg), []);
  const nameIn = el('input', { class: 'input', placeholder: 'Your name', value: s.get('name', '') });
  const out = el('pre', { class: 'out hidden' });
  const copyBtn = el('button', { class: 'btn hidden', onclick: () => copy(out.textContent) }, 'Copy code');
  const g = buildGrid(cfg, (d, h, mode) => { const r = toggleBit(masks, d, h, cfg.h0, mode); if (mode !== 'peek') s.set('masks:' + JSON.stringify(cfg), masks); return r; },
    (c, d, h) => { c.style.background = bitOn(masks, d, h, cfg.h0) ? 'var(--ok)' : 'var(--bg)'; });
  function gen() {
    const n = nameIn.value.trim(); if (!n) { toast('Please enter your name'); nameIn.focus(); return; }
    s.set('name', n);
    const a = g.days.map((_, i) => masks[i] || 0);
    out.textContent = enc({ t: TOOL, r: { n, a } }); out.classList.remove('hidden'); copyBtn.classList.remove('hidden');
  }
  render(root, note,
    el('div', { class: 'big', style: { margin: '10px 0' } }, cfg.title || 'When are you free?'),
    el('div', { class: 'small muted' }, 'Click or drag over the hours you are free (start on a green cell to erase).'),
    g.node,
    el('div', { class: 'row' }, el('div', { style: { maxWidth: '260px' } }, field('Your name', nameIn)), el('button', { class: 'btn primary', onclick: gen }, 'Generate response code'), copyBtn),
    out, el('div', { class: 'small muted' }, 'Send the code to the organizer; they paste it into their page.'),
    el('div', { class: 'row' }, leaveShared()));
}
