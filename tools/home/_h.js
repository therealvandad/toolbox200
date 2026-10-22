// Small helpers shared by the home group tools.
import { el, download } from '../../lib/ui.js';

export const money = n => (isFinite(n) ? n : 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const N = v => { const x = parseFloat(v); return isFinite(x) ? x : 0; };
export const pd = s => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
export const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
export const addMonths = (d, n) => {
  const r = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const last = new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate();
  r.setDate(Math.min(d.getDate(), last));
  return r;
};
export const dayDiff = (a, b) => Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 864e5);
export const todayDate = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };
export const fmtDate = d => d ? d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '';
export const monthKey = d => iso(d).slice(0, 7);
export const csvText = rows => rows.map(r => r.map(c => { c = String(c ?? ''); return /[",\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(',')).join('\n');
export const cssVar = (node, name, fb = '#888') => { try { return getComputedStyle(node).getPropertyValue(name).trim() || fb; } catch { return fb; } };
export const COLORS = ['#2f6fed', '#1f9d55', '#d98c0b', '#d64545', '#8e5bd9', '#14a3b8', '#c2417a', '#7a8b2d'];

/** Row with Export CSV / Export JSON buttons. */
export function exportBar(name, csvRows, jsonData) {
  return el('div', { class: 'row' },
    csvRows ? el('button', { class: 'btn small', onclick: () => download(name + '.csv', csvText(csvRows()), 'text/csv') }, 'Export CSV') : null,
    jsonData ? el('button', { class: 'btn small', onclick: () => download(name + '.json', JSON.stringify(jsonData(), null, 2), 'application/json') }, 'Export JSON') : null);
}

export function legend(series) {
  return el('div', { class: 'row small' }, series.map(s =>
    el('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '5px' } },
      el('span', { style: { width: '12px', height: '12px', borderRadius: '3px', background: s.color, display: 'inline-block' } }), s.name)));
}

function niceStep(max, ticks = 4) {
  const raw = max / ticks, p = Math.pow(10, Math.floor(Math.log10(raw || 1)));
  const f = raw / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
}

/** Line chart. series: [{name,color,data:[number|null]}]; labels: x labels. */
export function drawLines(canvas, labels, series, { prefix = '', dashed = [] } = {}) {
  const W = canvas.width, H = canvas.height, g = canvas.getContext('2d');
  const text = cssVar(canvas, '--text', '#222'), muted = cssVar(canvas, '--muted', '#777'), line = cssVar(canvas, '--line', '#ddd');
  g.clearRect(0, 0, W, H);
  const L = 74, R = 16, T = 14, B = 38;
  let max = 0;
  series.forEach(s => s.data.forEach(v => { if (v != null && v > max) max = v; }));
  if (max <= 0) max = 1;
  const step = niceStep(max), top = Math.ceil(max / step) * step;
  g.font = '15px system-ui, sans-serif'; g.textBaseline = 'middle';
  for (let v = 0; v <= top + 1e-9; v += step) {
    const y = T + (H - T - B) * (1 - v / top);
    g.strokeStyle = line; g.lineWidth = 1; g.beginPath(); g.moveTo(L, y); g.lineTo(W - R, y); g.stroke();
    g.fillStyle = muted; g.textAlign = 'right';
    g.fillText(prefix + (v >= 1000 ? Math.round(v).toLocaleString() : +v.toFixed(2)), L - 8, y);
  }
  const n = Math.max(labels.length, 1);
  const X = i => L + (n === 1 ? (W - L - R) / 2 : (W - L - R) * i / (n - 1));
  g.textAlign = 'center'; g.textBaseline = 'top'; g.fillStyle = muted;
  const every = Math.max(1, Math.ceil(n / 8));
  labels.forEach((lb, i) => { if (i % every === 0 || i === n - 1) g.fillText(lb, Math.min(Math.max(X(i), L + 10), W - R - 10), H - B + 8); });
  series.forEach((s, si) => {
    g.strokeStyle = s.color; g.fillStyle = s.color; g.lineWidth = 2.5;
    g.setLineDash(dashed.includes(si) ? [8, 6] : []);
    g.beginPath(); let started = false;
    s.data.forEach((v, i) => {
      if (v == null) { started = false; return; }
      const x = X(i), y = T + (H - T - B) * (1 - v / top);
      if (!started) { g.moveTo(x, y); started = true; } else g.lineTo(x, y);
    });
    g.stroke(); g.setLineDash([]);
    if (n <= 40) s.data.forEach((v, i) => { if (v == null) return; g.beginPath(); g.arc(X(i), T + (H - T - B) * (1 - v / top), 3.5, 0, 6.3); g.fill(); });
  });
  g.fillStyle = text;
}

export function makeCanvas(w = 800, h = 320) {
  return el('canvas', { width: w, height: h, style: { width: '100%', height: 'auto', maxWidth: w + 'px' } });
}

export const input = (attrs = {}) => el('input', Object.assign({ class: 'input' }, attrs));
export const sel = (options, value, attrs = {}) => {
  const s = el('select', Object.assign({ class: 'select' }, attrs), options.map(o => {
    const [v, l] = Array.isArray(o) ? o : [o, o];
    return el('option', { value: v }, l);
  }));
  s.value = value;
  return s;
};
