// Lighthouse score history: import Lighthouse JSON reports or enter scores by hand, chart the four categories per site over time, export CSV.
import { el, render, store, download, toast, uid, today, field, readFile, dropZone, copy } from '../../lib/ui.js';

const CATS = [
  { key: 'perf', label: 'Performance', light: '#2a78d6', dark: '#3987e5' },
  { key: 'a11y', label: 'Accessibility', light: '#eb6834', dark: '#d95926' },
  { key: 'bp', label: 'Best practices', light: '#1baf7a', dark: '#199e70' },
  { key: 'seo', label: 'SEO', light: '#eda100', dark: '#c98500' },
];

function normSite(url) {
  try { const u = new URL(url); return (u.hostname + u.pathname).replace(/\/$/, ''); } catch { return String(url || '').trim().replace(/\/$/, ''); }
}
function pct(score) { return score == null ? null : Math.round(Number(score) * 100); }

/** Parse one or more Lighthouse reports (plain, PSI-wrapped, or an array) into entries. */
export function parseReports(text) {
  let data;
  try { data = JSON.parse(text); } catch (e) { throw new Error('Not valid JSON: ' + e.message); }
  const list = Array.isArray(data) ? data : [data];
  const entries = [];
  for (let r of list) {
    if (r && r.lighthouseResult) r = r.lighthouseResult;
    if (r && r.site && r.date && !r.categories) { // an entry from this tool's own JSON backup
      entries.push({ id: uid(), site: normSite(r.site), date: String(r.date).slice(0, 10), perf: r.perf ?? null, a11y: r.a11y ?? null, bp: r.bp ?? null, seo: r.seo ?? null, source: r.source || 'backup' });
      continue;
    }
    if (!r || !r.categories) throw new Error('This JSON has no "categories" object; it does not look like a Lighthouse report.');
    const c = r.categories;
    const url = r.finalDisplayedUrl || r.finalUrl || r.requestedUrl || r.mainDocumentUrl || '';
    const when = r.fetchTime ? new Date(r.fetchTime) : new Date();
    entries.push({
      id: uid(), site: normSite(url), date: isNaN(when) ? today() : when.toISOString().slice(0, 10),
      perf: pct(c.performance && c.performance.score), a11y: pct(c.accessibility && c.accessibility.score),
      bp: pct(c['best-practices'] && c['best-practices'].score), seo: pct(c.seo && c.seo.score),
      source: 'report' + (r.lighthouseVersion ? ' v' + r.lighthouseVersion : '') + (r.configSettings && r.configSettings.formFactor ? ' ' + r.configSettings.formFactor : ''),
    });
  }
  return entries;
}

export default function (root) {
  const s = store('lighthouse-history');
  let entries = s.get('entries', []);
  let hover = null;

  // ---- inputs ----
  const jsonTa = el('textarea', { class: 'textarea', style: { minHeight: '90px' }, placeholder: 'Paste a Lighthouse JSON report (from DevTools "Save as JSON", the CLI, or the PageSpeed Insights API)…' });
  const siteIn = el('input', { class: 'input', placeholder: 'example.com/page', style: { width: '200px' } });
  const dateIn = el('input', { class: 'input', type: 'date', value: today() });
  const scoreIns = CATS.map(c => el('input', { class: 'input', type: 'number', min: 0, max: 100, placeholder: c.label, style: { width: '110px' } }));
  const siteSel = el('select', { class: 'select' });
  const canvas = el('canvas', { width: 860, height: 320, style: { maxWidth: '100%', display: 'block', cursor: 'crosshair' } });
  const tip = el('div', { class: 'panel small hidden', style: { position: 'absolute', pointerEvents: 'none', padding: '6px 8px', zIndex: 2, whiteSpace: 'nowrap' } });
  const chartWrap = el('div', { style: { position: 'relative' } }, canvas, tip);
  const legend = el('div', { class: 'row small' });
  const table = el('div', { class: 'scroll-x' });
  const msg = el('div', { class: 'small muted' });

  function save() { s.set('entries', entries); }
  function sites() { return [...new Set(entries.map(e => e.site))].sort(); }
  function addEntries(list) {
    let added = 0;
    for (const e of list) {
      const dup = entries.find(x => x.site === e.site && x.date === e.date && x.perf === e.perf && x.a11y === e.a11y && x.bp === e.bp && x.seo === e.seo);
      if (dup) continue;
      entries.push(e); added++;
    }
    save();
    toast(`${added} entr${added === 1 ? 'y' : 'ies'} added`);
    if (list.length) siteSel.value = list[list.length - 1].site;
    draw();
  }

  function importJson() {
    try { const list = parseReports(jsonTa.value); addEntries(list); jsonTa.value = ''; msg.textContent = ''; }
    catch (e) { msg.textContent = e.message; msg.style.color = 'var(--danger)'; setTimeout(() => { msg.style.color = ''; }, 3000); }
  }
  async function importFiles(files) {
    const all = [];
    const errs = [];
    for (const f of files) { try { all.push(...parseReports(await readFile(f, 'text'))); } catch (e) { errs.push(f.name + ': ' + e.message); } }
    if (all.length) addEntries(all);
    msg.textContent = errs.join(' · ');
  }
  function addManual() {
    const site = normSite(siteIn.value);
    if (!site) { msg.textContent = 'Enter a site.'; siteIn.focus(); return; }
    const vals = scoreIns.map(i => i.value === '' ? null : Math.max(0, Math.min(100, Math.round(+i.value))));
    if (vals.every(v => v == null)) { msg.textContent = 'Enter at least one score.'; scoreIns[0].focus(); return; }
    addEntries([{ id: uid(), site, date: dateIn.value || today(), perf: vals[0], a11y: vals[1], bp: vals[2], seo: vals[3], source: 'manual' }]);
    scoreIns.forEach(i => i.value = ''); msg.textContent = '';
  }

  // ---- chart ----
  function isDark() { return document.documentElement.dataset.theme === 'dark'; }
  function color(c) { return isDark() ? c.dark : c.light; }
  function cssVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888'; }
  function seriesFor(site) { return entries.filter(e => e.site === site).sort((a, b) => a.date.localeCompare(b.date) || 0); }
  let layout = null;

  function drawChart() {
    const site = siteSel.value;
    const data = seriesFor(site);
    const dpr = window.devicePixelRatio || 1;
    const W = 860, H = 320;
    if (canvas.width !== W * dpr) { canvas.width = W * dpr; canvas.height = H * dpr; }
    canvas.style.width = '100%'; canvas.style.aspectRatio = `${W} / ${H}`;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const text = cssVar('--text'), muted = cssVar('--muted'), line = cssVar('--line'), panel = cssVar('--panel');
    const pad = { l: 44, r: 16, t: 14, b: 34 };
    const pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;
    ctx.font = '12px system-ui, sans-serif';
    if (!data.length) {
      ctx.fillStyle = muted; ctx.textAlign = 'center'; ctx.fillText(entries.length ? 'Select a site' : 'No data yet. Import a Lighthouse report or add scores by hand.', W / 2, H / 2);
      layout = null; return;
    }
    const times = data.map(e => Date.parse(e.date));
    let t0 = Math.min(...times), t1 = Math.max(...times);
    if (t0 === t1) { t0 -= 86400000 * 3; t1 += 86400000 * 3; }
    const x = t => pad.l + (t - t0) / (t1 - t0) * pw;
    const y = v => pad.t + (100 - v) / 100 * ph;
    // grid
    ctx.strokeStyle = line; ctx.lineWidth = 1; ctx.fillStyle = muted; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (let v = 0; v <= 100; v += 25) { ctx.beginPath(); ctx.moveTo(pad.l, y(v)); ctx.lineTo(W - pad.r, y(v)); ctx.stroke(); ctx.fillText(String(v), pad.l - 8, y(v)); }
    // score bands (Lighthouse thresholds) as faint lines
    ctx.setLineDash([3, 4]);
    for (const v of [50, 90]) { ctx.beginPath(); ctx.moveTo(pad.l, y(v)); ctx.lineTo(W - pad.r, y(v)); ctx.stroke(); }
    ctx.setLineDash([]);
    // x labels
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    const ticks = Math.min(8, Math.max(2, Math.round(pw / 110)));
    const labelled = new Set();
    for (let i = 0; i < ticks; i++) {
      const t = t0 + (t1 - t0) * i / (ticks - 1);
      const d = new Date(t).toISOString().slice(0, 10);
      if (labelled.has(d)) continue; labelled.add(d);
      ctx.fillText(d, x(t), H - pad.b + 8);
    }
    // series
    const pts = {};
    for (const c of CATS) {
      const p = data.filter(e => e[c.key] != null).map(e => ({ x: x(Date.parse(e.date)), y: y(e[c.key]), e }));
      pts[c.key] = p;
      if (!p.length) continue;
      ctx.strokeStyle = color(c); ctx.lineWidth = 2; ctx.lineJoin = 'round';
      ctx.beginPath(); p.forEach((q, i) => i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)); ctx.stroke();
      for (const q of p) {
        ctx.beginPath(); ctx.arc(q.x, q.y, 4, 0, Math.PI * 2); ctx.fillStyle = color(c); ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = panel; ctx.stroke();
      }
      // direct label at the last point
      const last = p[p.length - 1];
      ctx.fillStyle = text; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.font = '11px system-ui, sans-serif';
      ctx.fillText(String(last.e[c.key]), Math.min(last.x + 7, W - pad.r - 18), last.y);
      ctx.font = '12px system-ui, sans-serif';
    }
    layout = { data, x, pad, W, H, times };
    // hover crosshair
    if (hover != null && data[hover]) {
      const hx = x(times[hover]);
      ctx.strokeStyle = muted; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(hx, pad.t); ctx.lineTo(hx, H - pad.b); ctx.stroke(); ctx.setLineDash([]);
    }
    render(legend, CATS.map(c => el('span', { class: 'row', style: { margin: 0, gap: '5px' } }, el('span', { style: { width: '10px', height: '10px', borderRadius: '50%', background: color(c), display: 'inline-block' } }), c.label)),
      el('span', { class: 'muted' }, 'dashed lines: 50 and 90 thresholds'));
  }

  canvas.addEventListener('mousemove', ev => {
    if (!layout) return;
    const r = canvas.getBoundingClientRect();
    const mx = (ev.clientX - r.left) / r.width * layout.W;
    let best = -1, bd = 1e9;
    layout.times.forEach((t, i) => { const d = Math.abs(layout.x(t) - mx); if (d < bd) { bd = d; best = i; } });
    if (best < 0 || bd > 40) { if (hover != null) { hover = null; tip.classList.add('hidden'); drawChart(); } return; }
    if (hover !== best) { hover = best; drawChart(); }
    const e = layout.data[best];
    render(tip, el('b', {}, e.date), el('div', { class: 'muted' }, e.source),
      CATS.map(c => el('div', {}, el('span', { style: { display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: color(c), marginRight: '6px' } }), `${c.label}: ${e[c.key] ?? '—'}`)));
    tip.classList.remove('hidden');
    const px = layout.x(layout.times[best]) / layout.W * r.width;
    tip.style.left = Math.min(px + 12, r.width - 170) + 'px';
    tip.style.top = Math.max(0, (ev.clientY - r.top) - 20) + 'px';
  });
  canvas.addEventListener('mouseleave', () => { hover = null; tip.classList.add('hidden'); drawChart(); });

  // ---- table ----
  function scoreCell(v) {
    if (v == null) return el('td', { class: 'muted' }, '—');
    const cls = v >= 90 ? 'ok' : v >= 50 ? 'warn' : 'danger';
    return el('td', {}, el('span', { class: 'badge ' + cls }, v));
  }
  function drawTable() {
    const site = siteSel.value;
    const rows = (site === '__all__' ? [...entries] : seriesFor(site)).sort((a, b) => a.site.localeCompare(b.site) || b.date.localeCompare(a.date));
    render(table, rows.length ? el('table', { class: 'table' },
      el('thead', {}, el('tr', {}, el('th', {}, 'Site'), el('th', {}, 'Date'), CATS.map(c => el('th', {}, c.label)), el('th', {}, 'Source'), el('th', {}))),
      el('tbody', {}, rows.map(e => el('tr', {},
        el('td', { class: 'mono small' }, e.site), el('td', { class: 'mono small' }, e.date),
        CATS.map(c => scoreCell(e[c.key])),
        el('td', { class: 'small muted' }, e.source),
        el('td', {}, el('button', { class: 'btn small ghost', title: 'Delete', onclick: () => { entries = entries.filter(x => x.id !== e.id); save(); draw(); } }, '×')))))) : null);
  }

  function draw() {
    const list = sites();
    const cur = siteSel.value;
    render(siteSel, list.map(st => el('option', { value: st }, st)), el('option', { value: '__all__' }, list.length ? 'All sites (table only)' : 'No sites yet'));
    siteSel.value = list.includes(cur) ? cur : (list[0] || '__all__');
    if (siteSel.value !== cur) hover = null;
    drawChart(); drawTable();
  }

  const q = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  function toCsv() { return ['site,date,performance,accessibility,best_practices,seo,source', ...[...entries].sort((a, b) => a.site.localeCompare(b.site) || a.date.localeCompare(b.date)).map(e => [e.site, e.date, e.perf, e.a11y, e.bp, e.seo, e.source].map(q).join(','))].join('\n'); }
  function importCsv(text) {
    const lines = text.replace(/\r/g, '').split('\n').filter(l => l.trim());
    const head = (lines.shift() || '').toLowerCase();
    if (!/site/.test(head) || !/date/.test(head)) throw new Error('CSV needs a header with site, date and the four scores (as exported here).');
    const cells = l => { const out = []; let cur = '', inq = false; for (let i = 0; i < l.length; i++) { const ch = l[i]; if (inq) { if (ch === '"' && l[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') inq = false; else cur += ch; } else if (ch === '"') inq = true; else if (ch === ',') { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out; };
    const n = v => v === '' || v == null ? null : Math.max(0, Math.min(100, Math.round(+v)));
    return lines.map(l => { const c = cells(l); return { id: uid(), site: normSite(c[0]), date: c[1], perf: n(c[2]), a11y: n(c[3]), bp: n(c[4]), seo: n(c[5]), source: c[6] || 'csv' }; }).filter(e => e.site && /^\d{4}-\d{2}-\d{2}$/.test(e.date));
  }

  let armed = null;
  const clearBtn = el('button', { class: 'btn danger small', onclick: () => {
    if (!entries.length) return;
    if (!armed) { clearBtn.textContent = 'Click again to clear all'; armed = setTimeout(() => { armed = null; clearBtn.textContent = 'Clear all'; }, 3000); return; }
    clearTimeout(armed); armed = null; clearBtn.textContent = 'Clear all';
    entries = []; save(); draw(); toast('Cleared');
  } }, 'Clear all');
  siteSel.addEventListener('change', () => { hover = null; drawChart(); drawTable(); });
  jsonTa.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) importJson(); });
  scoreIns.forEach(i => i.addEventListener('keydown', e => { if (e.key === 'Enter') addManual(); }));
  siteIn.addEventListener('keydown', e => { if (e.key === 'Enter') addManual(); });
  const mo = new MutationObserver(drawChart);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  render(root,
    el('div', { class: 'grid2' },
      el('div', {},
        el('div', { class: 'small muted', style: { marginBottom: '4px' } }, 'Import Lighthouse JSON'),
        jsonTa,
        el('div', { class: 'row' }, el('button', { class: 'btn primary', onclick: importJson }, 'Import JSON'),
          el('span', { class: 'muted small' }, 'Ctrl+Enter. Accepts one report, an array, or PageSpeed Insights API output.')),
        dropZone('Drop .json report files (or a CSV exported here) to import', async files => {
          const csvs = files.filter(f => /\.csv$/i.test(f.name));
          if (csvs.length) { for (const f of csvs) { try { addEntries(importCsv(await readFile(f, 'text'))); } catch (e) { msg.textContent = e.message; } } }
          await importFiles(files.filter(f => !/\.csv$/i.test(f.name)));
        }, '.json,application/json,.csv,text/csv')),
      el('div', {},
        el('div', { class: 'small muted', style: { marginBottom: '4px' } }, 'Or enter scores by hand'),
        el('div', { class: 'row' }, field('Site', siteIn), field('Date', dateIn)),
        el('div', { class: 'row' }, CATS.map((c, i) => field(c.label, scoreIns[i]))),
        el('div', { class: 'row' }, el('button', { class: 'btn primary', onclick: addManual }, 'Add entry'), msg))),
    el('div', { class: 'row', style: { marginTop: '14px' } },
      field('Site', siteSel),
      el('span', { class: 'grow' }),
      el('button', { class: 'btn', onclick: () => entries.length ? download('lighthouse-history.csv', toCsv(), 'text/csv') : toast('Nothing to export') }, 'Export CSV'),
      el('button', { class: 'btn', onclick: () => copy(toCsv()) }, 'Copy CSV'),
      el('button', { class: 'btn ghost', onclick: () => download('lighthouse-history.json', JSON.stringify(entries, null, 2), 'application/json') }, 'Backup JSON'),
      clearBtn),
    el('div', { class: 'panel', style: { padding: '8px' } }, chartWrap, legend),
    table);
  draw();
  return () => { mo.disconnect(); clearTimeout(armed); };
}
