import { el, render, store } from '../../lib/ui.js';

const CARD_MM = 85.6, CARD_H_MM = 53.98, BREADTH = 120;

export default function (root) {
  const s = store('screen-ruler');
  const dprNow = () => window.devicePixelRatio || 1;
  let st = Object.assign({ mode: 'default', ppm: 96 / 25.4, dprCal: dprNow(), cardPx: 324, diag: 15.6, orient: 'h', unit: 'all' }, s.get('state', {}));
  const save = () => s.set('state', st);
  // CSS pixels per millimetre. Calibrated values are corrected when browser zoom (DPR) changes.
  const eff = () => (st.mode === 'default' ? 96 / 25.4 : st.ppm * dprNow() / st.dprCal);

  const modeSel = el('select', { class: 'select' },
    el('option', { value: 'default' }, 'Default (96 px = 1 inch)'), el('option', { value: 'card' }, 'Calibrate with a credit card'), el('option', { value: 'diag' }, 'Calibrate with screen diagonal'));
  const orientSel = el('select', { class: 'select' },
    el('option', { value: 'h' }, 'Horizontal'), el('option', { value: 'v' }, 'Vertical'), el('option', { value: 'both' }, 'Both'));
  modeSel.value = st.mode; orientSel.value = st.orient;

  const cardPx = el('input', { type: 'range', min: 120, max: 800, step: 1, value: st.cardPx, style: { flex: 1, minWidth: '200px' } });
  const cardLbl = el('span', { class: 'mono small' });
  const cardShape = el('div', { style: { border: '2px solid var(--text)', borderRadius: '4.5% / 7%', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: '13px', maxWidth: 'none', margin: '8px 0' } }, 'Make this box match a credit card');
  const cardBox = el('div', { class: 'panel' },
    el('div', { class: 'small muted' }, 'Hold a real credit/ID card (85.6 mm wide) to the screen and drag the slider until this box has exactly the same width.'),
    cardShape,
    el('div', { class: 'row' }, el('button', { class: 'btn small', onclick: () => adj(-1) }, '-1 px'), cardPx, el('button', { class: 'btn small', onclick: () => adj(1) }, '+1 px'), cardLbl));
  const diagIn = el('input', { class: 'input', type: 'number', min: 1, max: 120, step: 0.1, value: st.diag, style: { width: '100px' } });
  const diagLbl = el('span', { class: 'small muted' });
  const diagBox = el('div', { class: 'panel' },
    el('div', { class: 'small muted' }, 'Enter your screen size in inches (the diagonal printed in the specs). Assumes square pixels and a full-screen browser reporting the whole screen.'),
    el('div', { class: 'row' }, el('label', { class: 'inline' }, 'Diagonal (inches)', diagIn), el('button', { class: 'btn primary small', onclick: applyDiag }, 'Apply'), diagLbl));
  const calInfo = el('div', { class: 'small muted' });
  const readout = el('div', { class: 'mono small', style: { minHeight: '1.4em' } }, 'Move the pointer over a ruler to read a position.');
  const hWrap = el('div', { style: { width: '100%' } });
  const hCanvas = el('canvas', { style: { display: 'block', cursor: 'crosshair' } });
  const vCanvas = el('canvas', { style: { display: 'block', cursor: 'crosshair' } });
  hWrap.append(hCanvas);
  const vWrap = el('div', { class: 'scroll-x' }, vCanvas);

  function adj(d) { cardPx.value = Number(cardPx.value) + d; onCard(); }
  function onCard() {
    st.cardPx = Number(cardPx.value); st.ppm = st.cardPx / CARD_MM; st.dprCal = dprNow();
    save(); refresh();
  }
  function applyDiag() {
    const inches = Number(diagIn.value);
    if (!(inches > 0)) { diagLbl.textContent = 'Enter a positive size.'; return; }
    const diagCss = Math.hypot(screen.width, screen.height);
    st.diag = inches; st.ppm = diagCss / (inches * 25.4); st.dprCal = dprNow();
    diagLbl.textContent = `Screen is ${screen.width} x ${screen.height} CSS px.`;
    save(); refresh();
  }

  function colors() {
    const cs = getComputedStyle(root);
    const g = (v, d) => cs.getPropertyValue(v).trim() || d;
    return { bg: g('--panel', '#fff'), fg: g('--text', '#000'), muted: g('--muted', '#666'), accent: g('--accent', '#2f6fed'), line: g('--line', '#ccc') };
  }
  function draw(canvas, length, vertical) {
    const dpr = dprNow(), ppm = eff(), c = colors();
    const cw = vertical ? BREADTH : length, ch = vertical ? length : BREADTH;
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
    const g = canvas.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (vertical) g.transform(0, 1, -1, 0, BREADTH, 0); // ruler space: u along length, w across
    g.fillStyle = c.bg; g.fillRect(0, 0, length, BREADTH);
    g.strokeStyle = c.line; g.strokeRect(0.5, 0.5, length - 1, BREADTH - 1);
    g.fillStyle = c.fg; g.strokeStyle = c.fg; g.lineWidth = 1;
    g.font = '11px system-ui,sans-serif'; g.textBaseline = 'top';
    const tick = (u, w0, w1) => { g.beginPath(); g.moveTo(Math.round(u) + 0.5, w0); g.lineTo(Math.round(u) + 0.5, w1); g.stroke(); };
    // pixel scale hangs from the top edge
    for (let px = 0; px <= length; px += 10) {
      const len = px % 100 === 0 ? 22 : px % 50 === 0 ? 14 : 8;
      tick(px, 0, len);
      if (px % 100 === 0 && px > 0) { g.textAlign = 'center'; g.fillText(String(px), px, 24); }
    }
    g.textAlign = 'left'; g.fillStyle = c.accent; g.fillText('px', 4, 24); g.fillStyle = c.fg;
    // centimetres hang from w=48
    const mmMax = Math.floor(length / ppm);
    for (let mm = 0; mm <= mmMax; mm++) {
      const len = mm % 10 === 0 ? 18 : mm % 5 === 0 ? 12 : 7;
      tick(mm * ppm, 48, 48 + len);
      if (mm % 10 === 0 && mm > 0) { g.textAlign = 'center'; g.fillText(String(mm / 10), mm * ppm, 48 + 20); }
    }
    g.textAlign = 'left'; g.fillStyle = c.accent; g.fillText('cm', 4, 48 + 20); g.fillStyle = c.fg;
    // inches rise from the bottom edge, 1/16 resolution
    const pxIn = ppm * 25.4, sixteenths = Math.floor(length / pxIn * 16);
    for (let i = 0; i <= sixteenths; i++) {
      const len = i % 16 === 0 ? 24 : i % 8 === 0 ? 17 : i % 4 === 0 ? 12 : i % 2 === 0 ? 8 : 5;
      tick(i * pxIn / 16, BREADTH - len, BREADTH);
      if (i % 16 === 0 && i > 0) { g.textAlign = 'center'; g.fillText(String(i / 16), i * pxIn / 16, BREADTH - 40); }
    }
    g.textAlign = 'left'; g.fillStyle = c.accent; g.fillText('in', 4, BREADTH - 40); g.fillStyle = c.fg;
  }
  function refresh() {
    const ppm = eff();
    cardLbl.textContent = st.cardPx + ' px = 85.6 mm';
    cardShape.style.width = st.cardPx + 'px'; cardShape.style.height = Math.round(st.cardPx * CARD_H_MM / CARD_MM) + 'px';
    cardBox.hidden = st.mode !== 'card'; diagBox.hidden = st.mode !== 'diag';
    calInfo.textContent = `1 cm = ${(ppm * 10).toFixed(2)} px  |  1 inch = ${(ppm * 25.4).toFixed(2)} px  |  browser zoom/DPR ${dprNow().toFixed(2)}`;
    const showH = st.orient !== 'v', showV = st.orient !== 'h';
    hWrap.hidden = !showH; vWrap.hidden = !showV;
    if (showH) draw(hCanvas, Math.max(200, Math.floor(hWrap.clientWidth || root.clientWidth - 40 || 700)), false);
    if (showV) draw(vCanvas, 640, true);
  }

  function pointer(vertical) {
    return e => {
      const r = (vertical ? vCanvas : hCanvas).getBoundingClientRect();
      const u = vertical ? e.clientY - r.top : e.clientX - r.left, ppm = eff();
      readout.textContent = `${Math.round(u)} px  =  ${(u / ppm).toFixed(1)} mm  =  ${(u / ppm / 10).toFixed(2)} cm  =  ${(u / ppm / 25.4).toFixed(3)} in`;
    };
  }
  hCanvas.addEventListener('pointermove', pointer(false));
  vCanvas.addEventListener('pointermove', pointer(true));
  modeSel.addEventListener('change', () => {
    st.mode = modeSel.value;
    if (st.mode !== 'default') { st.dprCal = dprNow(); if (!st.ppm) st.ppm = 96 / 25.4; }
    save(); refresh();
  });
  orientSel.addEventListener('change', () => { st.orient = orientSel.value; save(); refresh(); });
  cardPx.addEventListener('input', onCard);
  diagIn.addEventListener('keydown', e => { if (e.key === 'Enter') applyDiag(); });

  render(root,
    el('div', { class: 'row' }, modeSel, orientSel,
      el('button', { class: 'btn ghost small', onclick: () => { st.mode = 'default'; st.ppm = 96 / 25.4; modeSel.value = 'default'; save(); refresh(); } }, 'Reset calibration')),
    cardBox, diagBox, calInfo, readout,
    hWrap, vWrap,
    el('p', { class: 'small muted' }, 'Accuracy depends on calibration. If you change browser zoom, the ruler rescales automatically; recalibrate if you move to another monitor.'));

  const onResize = () => refresh();
  window.addEventListener('resize', onResize);
  let ro = null;
  if (typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(() => refresh()); ro.observe(root); }
  refresh();
  requestAnimationFrame(refresh);

  return () => { window.removeEventListener('resize', onResize); if (ro) ro.disconnect(); };
}
