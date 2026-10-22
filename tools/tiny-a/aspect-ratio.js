import { el, render, store } from '../../lib/ui.js';

const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const PRESETS = [['16:9', 16, 9], ['4:3', 4, 3], ['21:9', 21, 9], ['1:1', 1, 1], ['9:16', 9, 16], ['3:2', 3, 2], ['2:3', 2, 3]];

export default function (root) {
  const s = store('aspect-ratio');
  const st = Object.assign({ w: 1920, h: 1080, lock: true, rw: 16, rh: 9 }, s.get('state', {}));

  const w = el('input', { class: 'input', type: 'number', min: 0, step: 'any', value: st.w });
  const h = el('input', { class: 'input', type: 'number', min: 0, step: 'any', value: st.h });
  const lock = el('input', { type: 'checkbox', checked: st.lock });
  const rw = el('input', { class: 'input', type: 'number', min: 0, step: 'any', value: st.rw, style: { width: '80px' } });
  const rh = el('input', { class: 'input', type: 'number', min: 0, step: 'any', value: st.rh, style: { width: '80px' } });
  const info = el('div', { class: 'row' });
  const presetRow = el('div', { class: 'row' });
  const box = el('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--accent)', color: 'var(--accent-text)', borderRadius: '8px', fontWeight: '700', transition: 'all .15s', overflow: 'hidden' } });
  const stage = el('div', { class: 'canvas-wrap', style: { height: '260px', alignItems: 'center' } }, box);

  const num = n => (Number.isFinite(n) ? Math.round(n * 100) / 100 : 0);
  const save = () => s.set('state', st);

  function ratioFromSize() {
    const a = Math.round(st.w), b = Math.round(st.h);
    if (a > 0 && b > 0 && Math.abs(st.w - a) < 1e-9 && Math.abs(st.h - b) < 1e-9) {
      const g = gcd(a, b);
      return [a / g, b / g];
    }
    return null;
  }
  function draw() {
    const exact = ratioFromSize();
    const dec = st.h > 0 ? st.w / st.h : 0;
    render(info,
      el('div', { class: 'stat' }, el('div', { class: 'v' }, exact ? `${exact[0]}:${exact[1]}` : 'n/a'), el('div', { class: 'l' }, 'simplified ratio')),
      el('div', { class: 'stat' }, el('div', { class: 'v' }, num(dec)), el('div', { class: 'l' }, 'width / height')),
      el('div', { class: 'stat' }, el('div', { class: 'v' }, `${num(st.w)} x ${num(st.h)}`), el('div', { class: 'l' }, 'size')),
      el('div', { class: 'stat' }, el('div', { class: 'v' }, num(st.w * st.h / 1e6) + ' MP'), el('div', { class: 'l' }, 'area')));
    const stageW = Math.min(stage.clientWidth - 20 || 400, 600), stageH = 240;
    const r = dec > 0 ? dec : 1;
    let bw = stageH * r, bh = stageH;
    if (bw > stageW) { bw = stageW; bh = stageW / r; }
    box.style.width = Math.max(20, bw) + 'px'; box.style.height = Math.max(20, bh) + 'px';
    box.textContent = exact ? `${exact[0]}:${exact[1]}` : num(dec).toString();
    render(presetRow, el('span', { class: 'small muted' }, 'Presets:'),
      PRESETS.map(([label, a, b]) => el('button', { class: 'btn small' + (st.rw === a && st.rh === b ? ' primary' : ''), onclick: () => { st.rw = a; st.rh = b; rw.value = a; rh.value = b; st.lock = true; lock.checked = true; applyRatio('w'); } }, label)));
    save();
  }
  function applyRatio(from) {
    const r = st.rw > 0 && st.rh > 0 ? st.rw / st.rh : null;
    if (r) {
      if (from === 'w') st.h = num(st.w / r); else st.h = num(st.w / r);
      if (from === 'h') st.w = num(st.h * r);
    }
    w.value = st.w; h.value = st.h;
    draw();
  }
  w.addEventListener('input', () => {
    st.w = parseFloat(w.value) || 0;
    if (st.lock && st.rw > 0 && st.rh > 0) { st.h = num(st.w * st.rh / st.rw); h.value = st.h; }
    else if (!st.lock) { /* free mode: ratio is derived */ }
    draw();
  });
  h.addEventListener('input', () => {
    st.h = parseFloat(h.value) || 0;
    if (st.lock && st.rw > 0 && st.rh > 0) { st.w = num(st.h * st.rw / st.rh); w.value = st.w; }
    draw();
  });
  lock.addEventListener('change', () => {
    st.lock = lock.checked;
    if (st.lock) {
      const ex = ratioFromSize();
      if (ex) { st.rw = ex[0]; st.rh = ex[1]; rw.value = ex[0]; rh.value = ex[1]; }
    }
    draw();
  });
  const onRatio = () => {
    st.rw = parseFloat(rw.value) || 0; st.rh = parseFloat(rh.value) || 0;
    if (st.lock && st.rw > 0 && st.rh > 0) { st.h = num(st.w * st.rh / st.rw); h.value = st.h; }
    draw();
  };
  rw.addEventListener('input', onRatio); rh.addEventListener('input', onRatio);

  render(root,
    el('div', { class: 'row' },
      el('label', { class: 'field' }, 'Width', w),
      el('label', { class: 'field' }, 'Height', h),
      el('button', { class: 'btn', style: { alignSelf: 'flex-end' }, title: 'Swap width and height', onclick: () => { [st.w, st.h] = [st.h, st.w]; [st.rw, st.rh] = [st.rh, st.rw]; w.value = st.w; h.value = st.h; rw.value = st.rw; rh.value = st.rh; draw(); } }, 'Swap')),
    el('div', { class: 'row' },
      el('label', { class: 'inline' }, lock, 'Lock ratio'),
      el('span', { class: 'small muted' }, 'Ratio'), rw, ':', rh,
      el('span', { class: 'small muted' }, '(edit width or height and the other side follows)')),
    presetRow, info, stage,
    el('div', { class: 'small muted' }, 'With the lock off, the ratio shown is simply width:height reduced. Decimal sizes show the width/height value instead.'));
  draw();
  // box sizing depends on the stage width, so redraw once layout has happened
  const t = setTimeout(draw, 50);
  return () => clearTimeout(t);
}
