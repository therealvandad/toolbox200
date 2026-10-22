// Graphing calculator: safe expression parser (no eval), multiple functions, pan/zoom canvas, parameter sliders, hover trace.
import { el, render, store, field, toast } from '../../lib/ui.js';

// ---------- safe expression parser ----------
const FUNCS = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan,
  sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh, sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs,
  ln: Math.log, log: Math.log10, log10: Math.log10, log2: Math.log2, exp: Math.exp, floor: Math.floor, ceil: Math.ceil,
  round: Math.round, sign: Math.sign, min: Math.min, max: Math.max, atan2: Math.atan2, pow: Math.pow,
  mod: (a, b) => a - b * Math.floor(a / b), sec: x => 1 / Math.cos(x), csc: x => 1 / Math.sin(x), cot: x => 1 / Math.tan(x),
};
const CONSTS = { pi: Math.PI, e: Math.E, tau: 2 * Math.PI };
const VARS = ['x', 'a', 'b', 'c'];

function tokenize(src) {
  const toks = []; let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (/[0-9.]/.test(ch)) {
      const m = src.slice(i).match(/^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/);
      if (!m) throw new Error('bad number at ' + i);
      toks.push({ t: 'num', v: parseFloat(m[0]) }); i += m[0].length; continue;
    }
    if (/[a-zA-Z_]/.test(ch)) { const m = src.slice(i).match(/^[a-zA-Z_][a-zA-Z0-9_]*/); toks.push({ t: 'id', v: m[0] }); i += m[0].length; continue; }
    if ('+-*/^(),'.includes(ch)) { toks.push({ t: ch }); i++; continue; }
    if (ch === '×') { toks.push({ t: '*' }); i++; continue; }
    if (ch === '÷') { toks.push({ t: '/' }); i++; continue; }
    if (ch === '−') { toks.push({ t: '-' }); i++; continue; }
    throw new Error(`unexpected "${ch}"`);
  }
  return toks;
}
/** Compile an expression string into f(vars) -> number. Throws on syntax error. */
export function compile(src) {
  const toks = tokenize(src); let p = 0;
  const peek = () => toks[p], next = () => toks[p++];
  const expect = (t) => { const k = next(); if (!k || k.t !== t) throw new Error(`expected "${t}"`); };
  function expr() {
    let left = term();
    while (peek() && (peek().t === '+' || peek().t === '-')) { const op = next().t; const r = term(); const l = left; left = op === '+' ? v => l(v) + r(v) : v => l(v) - r(v); }
    return left;
  }
  function term() {
    let left = unary();
    for (;;) {
      const k = peek(); if (!k) break;
      if (k.t === '*' || k.t === '/') { next(); const r = unary(); const l = left; left = k.t === '*' ? v => l(v) * r(v) : v => l(v) / r(v); }
      else if (k.t === 'num' || k.t === 'id' || k.t === '(') { const r = unary(); const l = left; left = v => l(v) * r(v); } // implicit multiplication
      else break;
    }
    return left;
  }
  function unary() { if (peek() && peek().t === '-') { next(); const r = unary(); return v => -r(v); } if (peek() && peek().t === '+') { next(); return unary(); } return power(); }
  function power() { const base = atom(); if (peek() && peek().t === '^') { next(); const ex = unary(); return v => Math.pow(base(v), ex(v)); } return base; }
  function atom() {
    const k = next(); if (!k) throw new Error('unexpected end');
    if (k.t === 'num') { const n = k.v; return () => n; }
    if (k.t === '(') { const e = expr(); expect(')'); return e; }
    if (k.t === 'id') {
      const name = k.v;
      if (peek() && peek().t === '(') {
        const fn = FUNCS[name]; if (!fn) throw new Error(`unknown function "${name}"`);
        next(); const args = [];
        if (peek() && peek().t !== ')') { args.push(expr()); while (peek() && peek().t === ',') { next(); args.push(expr()); } }
        expect(')');
        if (args.length === 1) { const a = args[0]; return v => fn(a(v)); }
        return v => fn(...args.map(a => a(v)));
      }
      if (name in CONSTS) { const c = CONSTS[name]; return () => c; }
      if (VARS.includes(name)) return v => v[name];
      if (name in FUNCS) throw new Error(`"${name}" needs parentheses`);
      throw new Error(`unknown variable "${name}"`);
    }
    throw new Error(`unexpected "${k.t}"`);
  }
  const f = expr();
  if (p < toks.length) throw new Error(`unexpected "${toks[p].t === 'num' ? toks[p].v : toks[p].v || toks[p].t}"`);
  return f;
}

const PALETTE = ['#2f6fed', '#d64545', '#1f9d55', '#d98c0b', '#8e44ad', '#0aa6a6'];
const niceStep = (px) => { const raw = px; const m = Math.pow(10, Math.floor(Math.log10(raw))); const r = raw / m; return (r < 1.5 ? 1 : r < 3.5 ? 2 : r < 7.5 ? 5 : 10) * m; };
const fmt = (n) => Math.abs(n) < 1e-9 ? '0' : Math.abs(n) >= 1e5 || Math.abs(n) < 1e-3 ? n.toExponential(2) : +n.toFixed(4) + '';

export default function (root) {
  const s = store('graphing-calculator');
  let funcs = s.get('funcs', [{ expr: 'sin(x)', visible: true }, { expr: 'a*x^2 + b*x + c', visible: true }]);
  let view = s.get('view', { cx: 0, cy: 0, scale: 40 }); // scale = px per unit
  let params = s.get('params', { a: 1, b: 0, c: 0 });
  let compiled = []; let trace = null; // trace: canvas px x
  const canvas = el('canvas', { style: { width: '100%', display: 'block', cursor: 'crosshair', touchAction: 'none', borderRadius: '8px' } });
  const ctx = canvas.getContext('2d');
  const wrap = el('div', { style: { border: '1px solid var(--line)', borderRadius: '8px', background: 'var(--bg)' } }, canvas);
  const list = el('div', { class: 'col' });
  const traceBox = el('div', { class: 'small mono muted', style: { minHeight: '20px' } });
  let W = 600, H = 420, dpr = 1;

  function cssVar(v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }
  function toPx(x, y) { return [W / 2 + (x - view.cx) * view.scale, H / 2 - (y - view.cy) * view.scale]; }
  function toWorld(px, py) { return [view.cx + (px - W / 2) / view.scale, view.cy - (py - H / 2) / view.scale]; }

  function recompile() {
    compiled = funcs.map(f => { try { f.err = null; return compile(f.expr); } catch (e) { f.err = e.message; return null; } });
  }

  function resize() {
    dpr = window.devicePixelRatio || 1;
    W = Math.max(280, Math.floor(wrap.clientWidth || root.clientWidth || 600)); H = Math.round(Math.min(480, Math.max(260, W * 0.6)));
    canvas.width = W * dpr; canvas.height = H * dpr; canvas.style.height = H + 'px';
    draw();
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const line = cssVar('--line'), muted = cssVar('--muted'), text = cssVar('--text');
    // grid
    const step = niceStep(80 / view.scale);
    const [x0, y1] = toWorld(0, 0), [x1, y0] = toWorld(W, H);
    ctx.font = '11px system-ui, sans-serif'; ctx.fillStyle = muted;
    ctx.lineWidth = 1; ctx.strokeStyle = line;
    for (let gx = Math.floor(x0 / step) * step; gx <= x1; gx += step) {
      const [px] = toPx(gx, 0); ctx.beginPath(); ctx.moveTo(Math.round(px) + 0.5, 0); ctx.lineTo(Math.round(px) + 0.5, H); ctx.stroke();
      if (Math.abs(gx) > 1e-9) ctx.fillText(fmt(gx), px + 2, Math.min(H - 4, Math.max(12, toPx(0, 0)[1] + 12)));
    }
    for (let gy = Math.floor(y0 / step) * step; gy <= y1; gy += step) {
      const [, py] = toPx(0, gy); ctx.beginPath(); ctx.moveTo(0, Math.round(py) + 0.5); ctx.lineTo(W, Math.round(py) + 0.5); ctx.stroke();
      if (Math.abs(gy) > 1e-9) ctx.fillText(fmt(gy), Math.min(W - 30, Math.max(2, toPx(0, 0)[0] + 3)), py - 2);
    }
    // axes
    ctx.strokeStyle = muted; ctx.lineWidth = 1.5;
    const [ox, oy] = toPx(0, 0);
    ctx.beginPath(); ctx.moveTo(0, oy); ctx.lineTo(W, oy); ctx.moveTo(ox, 0); ctx.lineTo(ox, H); ctx.stroke();
    // functions
    funcs.forEach((f, i) => {
      const fn = compiled[i]; if (!fn || !f.visible) return;
      ctx.strokeStyle = PALETTE[i % PALETTE.length]; ctx.lineWidth = 2; ctx.beginPath();
      let pen = false, prevY = null;
      const v = { ...params, x: 0 };
      for (let px = 0; px <= W; px += 0.5) {
        v.x = toWorld(px, 0)[0];
        let y; try { y = fn(v); } catch { y = NaN; }
        if (!Number.isFinite(y)) { pen = false; prevY = null; continue; }
        const py = toPx(0, y)[1];
        const jump = prevY != null && ((prevY < -H && py > 2 * H) || (prevY > 2 * H && py < -H));
        const cy = Math.max(-H * 4, Math.min(H * 5, py));
        if (!pen || jump) { ctx.moveTo(px, cy); pen = true; } else ctx.lineTo(px, cy);
        prevY = py;
      }
      ctx.stroke();
    });
    // trace
    if (trace != null) {
      const [wx] = toWorld(trace, 0);
      ctx.strokeStyle = muted; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(trace, 0); ctx.lineTo(trace, H); ctx.stroke(); ctx.setLineDash([]);
      const parts = ['x = ' + fmt(wx)];
      funcs.forEach((f, i) => {
        const fn = compiled[i]; if (!fn || !f.visible) return;
        let y; try { y = fn({ ...params, x: wx }); } catch { y = NaN; }
        if (!Number.isFinite(y)) { parts.push(`f${i + 1}: undefined`); return; }
        const [px, py] = toPx(wx, y);
        ctx.fillStyle = PALETTE[i % PALETTE.length]; ctx.beginPath(); ctx.arc(px, py, 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = text; ctx.fillText(fmt(y), px + 7, Math.max(12, Math.min(H - 4, py - 6)));
        parts.push(`f${i + 1} = ${fmt(y)}`);
      });
      traceBox.textContent = parts.join('   ');
    } else traceBox.textContent = 'Drag to pan · wheel or pinch to zoom · hover to trace';
  }

  function save() { s.set('funcs', funcs.map(f => ({ expr: f.expr, visible: f.visible }))); s.set('view', view); s.set('params', params); }

  function drawList() {
    render(list, funcs.map((f, i) => {
      const input = el('input', { class: 'input mono', value: f.expr, placeholder: 'e.g. x^2 - 2x + 1', style: { flex: 1, minWidth: '160px', borderColor: f.err ? 'var(--danger)' : undefined },
        oninput: () => { f.expr = input.value; recompile(); save(); draw(); errEl.textContent = f.err || ''; input.style.borderColor = f.err ? 'var(--danger)' : ''; } });
      input.addEventListener('keydown', e => { if (e.key === 'Enter') { addFunc(); } });
      const errEl = el('div', { class: 'small', style: { color: 'var(--danger)', minHeight: f.err ? '18px' : '0' } }, f.err || '');
      return el('div', { class: 'col', style: { gap: '2px' } },
        el('div', { class: 'row', style: { margin: 0, flexWrap: 'nowrap' } },
          el('button', { class: 'btn small', title: 'show/hide', style: { background: f.visible ? PALETTE[i % PALETTE.length] : 'transparent', borderColor: PALETTE[i % PALETTE.length], color: f.visible ? '#fff' : 'var(--text)', minWidth: '44px' }, onclick: () => { f.visible = !f.visible; save(); drawList(); draw(); } }, 'f' + (i + 1)),
          el('span', { class: 'mono muted small' }, '='), input,
          el('button', { class: 'btn small ghost', title: 'remove', onclick: () => { funcs.splice(i, 1); recompile(); save(); drawList(); draw(); } }, '×')),
        errEl);
    }));
  }
  function addFunc() { if (funcs.length >= 6) { toast('Up to 6 functions'); return; } funcs.push({ expr: '', visible: true }); recompile(); save(); drawList(); list.querySelector && list.lastChild.querySelector('input').focus(); }

  // sliders
  const sliderBox = el('div', { class: 'row', style: { gap: '16px' } });
  function drawSliders() {
    render(sliderBox, ['a', 'b', 'c'].map(k => {
      const val = el('span', { class: 'mono', style: { minWidth: '48px', display: 'inline-block' } }, k + ' = ' + fmt(params[k]));
      const range = el('input', { type: 'range', min: -5, max: 5, step: 0.1, value: params[k], style: { width: '140px' }, oninput: () => { params[k] = +range.value; val.textContent = k + ' = ' + fmt(params[k]); save(); draw(); } });
      const num = el('input', { class: 'input mono small', type: 'number', step: 'any', value: params[k], style: { width: '72px' }, onchange: () => { params[k] = +num.value || 0; range.value = params[k]; val.textContent = k + ' = ' + fmt(params[k]); save(); draw(); } });
      return el('div', { class: 'row', style: { margin: 0 } }, val, range, num);
    }));
  }

  // pan / zoom / trace
  const pointers = new Map(); let dragStart = null, pinchStart = null;
  canvas.addEventListener('pointerdown', e => {
    canvas.setPointerCapture(e.pointerId); pointers.set(e.pointerId, [e.offsetX, e.offsetY]);
    if (pointers.size === 1) dragStart = { x: e.offsetX, y: e.offsetY, cx: view.cx, cy: view.cy };
    else if (pointers.size === 2) { const [p1, p2] = [...pointers.values()]; pinchStart = { d: Math.hypot(p1[0] - p2[0], p1[1] - p2[1]), scale: view.scale }; dragStart = null; }
  });
  canvas.addEventListener('pointermove', e => {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, [e.offsetX, e.offsetY]);
    if (pointers.size === 2 && pinchStart) {
      const [p1, p2] = [...pointers.values()]; const d = Math.hypot(p1[0] - p2[0], p1[1] - p2[1]);
      view.scale = Math.max(2, Math.min(5000, pinchStart.scale * d / Math.max(1, pinchStart.d))); trace = null; draw(); return;
    }
    if (dragStart && pointers.size === 1) {
      view.cx = dragStart.cx - (e.offsetX - dragStart.x) / view.scale; view.cy = dragStart.cy + (e.offsetY - dragStart.y) / view.scale;
      trace = null; draw(); return;
    }
    if (e.pointerType === 'mouse' || pointers.size === 0) { trace = e.offsetX; draw(); }
  });
  const endPointer = e => { pointers.delete(e.pointerId); if (pointers.size < 2) pinchStart = null; if (pointers.size === 0) { dragStart = null; save(); } };
  canvas.addEventListener('pointerup', endPointer); canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('pointerleave', () => { if (!dragStart) { trace = null; draw(); } });
  canvas.addEventListener('wheel', e => { e.preventDefault(); zoomAt(e.offsetX, e.offsetY, Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
  function zoomAt(px, py, k) {
    const [wx, wy] = toWorld(px, py);
    view.scale = Math.max(2, Math.min(5000, view.scale * k));
    const [nx, ny] = toWorld(px, py); view.cx += wx - nx; view.cy += wy - ny;
    save(); draw();
  }

  const onResize = () => resize();
  window.addEventListener('resize', onResize);

  const help = el('details', {}, el('summary', { class: 'muted small', style: { cursor: 'pointer' } }, 'Syntax help'),
    el('div', { class: 'small muted' }, 'Operators + − × ÷ ^ and implicit multiplication (2x, 3sin(x), (x+1)(x−1)). Variables x, a, b, c. Constants pi, e, tau. Functions: ' + Object.keys(FUNCS).join(', ') + '.'));

  render(root,
    el('div', { class: 'row' },
      el('button', { class: 'btn small', onclick: () => zoomAt(W / 2, H / 2, 1.5) }, '+'),
      el('button', { class: 'btn small', onclick: () => zoomAt(W / 2, H / 2, 1 / 1.5) }, '−'),
      el('button', { class: 'btn small ghost', onclick: () => { view = { cx: 0, cy: 0, scale: 40 }; save(); draw(); } }, 'Reset view'),
      el('button', { class: 'btn small ghost', onclick: () => { view = { cx: 0, cy: 0, scale: W / (4 * Math.PI) }; save(); draw(); } }, 'Fit −2π…2π'),
      el('span', { class: 'grow' }),
      el('button', { class: 'btn small primary', onclick: addFunc }, '+ Add function')),
    list, wrap, traceBox,
    field('Parameters', sliderBox), help);
  recompile(); drawList(); drawSliders();
  resize(); requestAnimationFrame(resize);
  return () => window.removeEventListener('resize', onResize);
}
