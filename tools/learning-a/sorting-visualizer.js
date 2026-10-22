// Sorting visualizer: bubble, insertion, selection, merge, quick, heap; speed, size, step mode, comparison/write counters, canvas bars.
import { el, render, store, stat, field } from '../../lib/ui.js';

// Each algorithm is a generator over the shared array `a`. It yields highlight descriptors {c: [compared idx], w: [written idx]}.
// `ops.cmp(i,j)` compares and counts; `ops.swap`, `ops.set` write and count.
const ALGOS = {
  bubble: { name: 'Bubble sort', big: 'O(n²)', *run(a, ops) {
    const n = a.length;
    for (let i = 0; i < n - 1; i++) {
      let swapped = false;
      for (let j = 0; j < n - i - 1; j++) {
        yield { c: [j, j + 1] };
        if (ops.cmp(j, j + 1) > 0) { ops.swap(j, j + 1); swapped = true; yield { w: [j, j + 1] }; }
      }
      ops.sorted(n - i - 1);
      if (!swapped) break;
    }
  } },
  insertion: { name: 'Insertion sort', big: 'O(n²)', *run(a, ops) {
    for (let i = 1; i < a.length; i++) {
      const key = a[i]; let j = i - 1;
      yield { c: [i] };
      while (j >= 0) {
        yield { c: [j, j + 1] };
        if (ops.cmpVal(j, key) > 0) { ops.set(j + 1, a[j]); yield { w: [j + 1] }; j--; } else break;
      }
      ops.set(j + 1, key); yield { w: [j + 1] };
    }
  } },
  selection: { name: 'Selection sort', big: 'O(n²)', *run(a, ops) {
    const n = a.length;
    for (let i = 0; i < n - 1; i++) {
      let m = i;
      for (let j = i + 1; j < n; j++) { yield { c: [j, m], p: [i] }; if (ops.cmp(j, m) < 0) m = j; }
      if (m !== i) { ops.swap(i, m); yield { w: [i, m] }; }
      ops.sorted(i);
    }
    ops.sorted(n - 1);
  } },
  merge: { name: 'Merge sort', big: 'O(n log n)', *run(a, ops) {
    function* sort(lo, hi) {
      if (hi - lo < 2) return;
      const mid = (lo + hi) >> 1;
      yield* sort(lo, mid); yield* sort(mid, hi);
      const left = a.slice(lo, mid), right = a.slice(mid, hi);
      let i = 0, j = 0, k = lo;
      while (i < left.length && j < right.length) {
        yield { c: [lo + i, mid + j], r: [lo, hi - 1] };
        ops.count();
        if (left[i] <= right[j]) ops.set(k++, left[i++]); else ops.set(k++, right[j++]);
        yield { w: [k - 1], r: [lo, hi - 1] };
      }
      while (i < left.length) { ops.set(k++, left[i++]); yield { w: [k - 1], r: [lo, hi - 1] }; }
      while (j < right.length) { ops.set(k++, right[j++]); yield { w: [k - 1], r: [lo, hi - 1] }; }
    }
    yield* sort(0, a.length);
  } },
  quick: { name: 'Quick sort', big: 'O(n log n)', *run(a, ops) {
    function* qs(lo, hi) {
      if (lo >= hi) { if (lo === hi) ops.sorted(lo); return; }
      const pivot = a[hi]; let i = lo;
      for (let j = lo; j < hi; j++) {
        yield { c: [j], p: [hi], r: [lo, hi] };
        if (ops.cmpVal(j, pivot) < 0) { if (i !== j) { ops.swap(i, j); yield { w: [i, j], p: [hi], r: [lo, hi] }; } i++; }
      }
      ops.swap(i, hi); yield { w: [i, hi], r: [lo, hi] }; ops.sorted(i);
      yield* qs(lo, i - 1); yield* qs(i + 1, hi);
    }
    yield* qs(0, a.length - 1);
  } },
  heap: { name: 'Heap sort', big: 'O(n log n)', *run(a, ops) {
    const n = a.length;
    function* sift(i, end) {
      for (;;) {
        const l = 2 * i + 1, r = l + 1; let m = i;
        if (l < end) { yield { c: [l, m] }; if (ops.cmp(l, m) > 0) m = l; }
        if (r < end) { yield { c: [r, m] }; if (ops.cmp(r, m) > 0) m = r; }
        if (m === i) return;
        ops.swap(i, m); yield { w: [i, m] }; i = m;
      }
    }
    for (let i = (n >> 1) - 1; i >= 0; i--) yield* sift(i, n);
    for (let end = n - 1; end > 0; end--) { ops.swap(0, end); yield { w: [0, end] }; ops.sorted(end); yield* sift(0, end); }
    ops.sorted(0);
  } },
};

export default function (root) {
  const s = store('sorting-visualizer');
  let algo = s.get('algo', 'bubble'), size = s.get('size', 40), speed = s.get('speed', 60), dist = s.get('dist', 'random');
  let a = [], gen = null, hl = {}, sortedSet = new Set(), comparisons = 0, writes = 0, running = false, finished = false, timer = null, startAt = 0, elapsed = 0;

  const canvas = el('canvas', { style: { width: '100%', display: 'block', borderRadius: '8px', background: 'var(--bg)', border: '1px solid var(--line)' } });
  const ctx = canvas.getContext('2d');
  let W = 700, H = 320, dpr = 1;
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

  const ops = {
    cmp(i, j) { comparisons++; return a[i] - a[j]; },
    cmpVal(i, v) { comparisons++; return a[i] - v; },
    count() { comparisons++; },
    swap(i, j) { [a[i], a[j]] = [a[j], a[i]]; writes += 2; },
    set(i, v) { a[i] = v; writes++; },
    sorted(i) { sortedSet.add(i); },
  };

  function makeArray() {
    const n = size;
    if (dist === 'random') a = Array.from({ length: n }, () => 5 + Math.floor(Math.random() * 95));
    else if (dist === 'nearly') { a = Array.from({ length: n }, (_, i) => Math.round(5 + 95 * i / Math.max(1, n - 1))); for (let k = 0; k < Math.max(1, n / 10); k++) { const i = Math.floor(Math.random() * n), j = Math.floor(Math.random() * n); [a[i], a[j]] = [a[j], a[i]]; } }
    else if (dist === 'reversed') a = Array.from({ length: n }, (_, i) => Math.round(5 + 95 * (n - 1 - i) / Math.max(1, n - 1)));
    else a = Array.from({ length: n }, () => 5 + 10 * Math.floor(Math.random() * 10));
    reset();
  }
  function reset() {
    stop(); gen = null; hl = {}; sortedSet = new Set(); comparisons = 0; writes = 0; finished = false; elapsed = 0; startAt = 0;
    draw(); updateStats();
  }
  function ensureGen() { if (!gen) { gen = ALGOS[algo].run(a, ops); startAt = performance.now() - elapsed; } }
  function step() {
    if (finished) return false;
    ensureGen();
    const r = gen.next();
    if (r.done) { finished = true; hl = {}; for (let i = 0; i < a.length; i++) sortedSet.add(i); elapsed = performance.now() - startAt; stop(); draw(); updateStats(); return false; }
    hl = r.value || {}; elapsed = performance.now() - startAt;
    draw(); updateStats();
    return true;
  }
  function delayMs() { return Math.max(0, Math.round(Math.pow(1 - speed / 100, 2) * 400)); }
  function tick() {
    if (!running) return;
    const d = delayMs();
    const batch = d === 0 ? Math.max(1, Math.ceil(a.length / 40)) : 1; // at max speed, do several steps per frame
    for (let k = 0; k < batch; k++) if (!step()) return;
    timer = setTimeout(tick, d);
  }
  function play() { if (finished) makeArray(); running = true; playBtn.textContent = 'Pause'; ensureGen(); tick(); }
  function stop() { running = false; clearTimeout(timer); timer = null; playBtn.textContent = finished ? 'Sort again' : gen ? 'Resume' : 'Play'; }

  function resize() {
    dpr = window.devicePixelRatio || 1;
    W = Math.max(260, Math.floor(wrap.clientWidth || 700)); H = Math.round(Math.min(360, Math.max(200, W * 0.45)));
    canvas.width = W * dpr; canvas.height = H * dpr; canvas.style.height = H + 'px'; draw();
  }
  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    const n = a.length; if (!n) return;
    const gap = n > 80 ? 0 : n > 40 ? 1 : 2; const bw = (W - 8) / n;
    const colors = { base: css('--muted'), cmp: css('--warn'), write: css('--danger'), pivot: css('--accent'), sorted: css('--ok'), range: css('--accent') };
    if (hl.r) { ctx.fillStyle = colors.range; ctx.globalAlpha = 0.08; ctx.fillRect(4 + hl.r[0] * bw, 0, (hl.r[1] - hl.r[0] + 1) * bw, H); ctx.globalAlpha = 1; }
    const cmp = new Set(hl.c || []), wr = new Set(hl.w || []), pv = new Set(hl.p || []);
    for (let i = 0; i < n; i++) {
      const h = (a[i] / 100) * (H - 10);
      ctx.fillStyle = wr.has(i) ? colors.write : cmp.has(i) ? colors.cmp : pv.has(i) ? colors.pivot : sortedSet.has(i) ? colors.sorted : colors.base;
      ctx.fillRect(4 + i * bw + gap / 2, H - h - 4, Math.max(1, bw - gap), h);
    }
    if (n <= 20) { ctx.fillStyle = css('--text'); ctx.font = '11px system-ui, sans-serif'; ctx.textAlign = 'center'; for (let i = 0; i < n; i++) ctx.fillText(a[i], 4 + i * bw + bw / 2, H - (a[i] / 100) * (H - 10) - 8); }
  }
  const statsBox = el('div', { class: 'row' });
  function updateStats() {
    render(statsBox, stat(comparisons, 'comparisons'), stat(writes, 'writes'), stat((elapsed / 1000).toFixed(1) + ' s', 'elapsed'), stat(ALGOS[algo].big, 'average'),
      finished && el('span', { class: 'badge ok' }, 'Sorted'));
  }

  const algoSel = el('select', { class: 'select', onchange: () => { algo = algoSel.value; s.set('algo', algo); reset(); } }, Object.entries(ALGOS).map(([k, v]) => el('option', { value: k, selected: k === algo }, v.name)));
  const distSel = el('select', { class: 'select', onchange: () => { dist = distSel.value; s.set('dist', dist); makeArray(); } },
    [['random', 'Random'], ['nearly', 'Nearly sorted'], ['reversed', 'Reversed'], ['few', 'Few unique']].map(([v, t]) => el('option', { value: v, selected: v === dist }, t)));
  const sizeLbl = el('span', { class: 'mono small', style: { minWidth: '32px', display: 'inline-block' } }, size);
  const sizeIn = el('input', { type: 'range', min: 5, max: 200, value: size, style: { width: '140px' }, oninput: () => { size = +sizeIn.value; sizeLbl.textContent = size; s.set('size', size); makeArray(); } });
  const speedLbl = el('span', { class: 'mono small', style: { minWidth: '32px', display: 'inline-block' } }, speed);
  const speedIn = el('input', { type: 'range', min: 1, max: 100, value: speed, style: { width: '140px' }, oninput: () => { speed = +speedIn.value; speedLbl.textContent = speed; s.set('speed', speed); } });
  const playBtn = el('button', { class: 'btn primary', onclick: () => running ? stop() : play() }, 'Play');
  const stepBtn = el('button', { class: 'btn', onclick: () => { if (finished) makeArray(); stop(); step(); } }, 'Step');
  const wrap = el('div', {}, canvas);
  const onResize = () => resize();
  window.addEventListener('resize', onResize);
  root.addEventListener('keydown', e => { if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return; if (e.key === ' ') { e.preventDefault(); running ? stop() : play(); } else if (e.key === 'ArrowRight') { e.preventDefault(); stepBtn.click(); } });
  root.tabIndex = -1;

  render(root,
    el('div', { class: 'row' }, field('Algorithm', algoSel), field('Data', distSel),
      field('Size', el('div', { class: 'row', style: { margin: 0 } }, sizeIn, sizeLbl)), field('Speed', el('div', { class: 'row', style: { margin: 0 } }, speedIn, speedLbl))),
    el('div', { class: 'row' }, playBtn, stepBtn, el('button', { class: 'btn ghost', onclick: makeArray }, 'New array'),
      el('span', { class: 'muted small' }, 'Space play/pause · → step')),
    wrap, statsBox,
    el('div', { class: 'row small muted', style: { gap: '14px' } },
      legend('--warn', 'comparing'), legend('--danger', 'writing'), legend('--accent', 'pivot / minimum'), legend('--ok', 'sorted')));
  function legend(v, t) { return el('span', { class: 'row', style: { margin: 0, gap: '5px' } }, el('span', { style: { width: '12px', height: '12px', borderRadius: '3px', background: `var(${v})`, display: 'inline-block' } }), t); }
  makeArray(); resize(); requestAnimationFrame(resize);
  return () => { clearTimeout(timer); running = false; window.removeEventListener('resize', onResize); };
}
