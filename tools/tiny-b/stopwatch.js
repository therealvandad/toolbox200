import { el, render, store, download, pad } from '../../lib/ui.js';

function fmt(ms) {
  ms = Math.max(0, Math.floor(ms));
  const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, sec = Math.floor(ms / 1000) % 60, cs = Math.floor(ms / 10) % 100;
  return (h ? h + ':' + pad(m) : pad(m)) + ':' + pad(sec) + '.' + pad(cs);
}

export default function (root) {
  const s = store('stopwatch');
  // State is kept as timestamps so it survives navigation and reload.
  let st = s.get('state', { running: false, startedAt: 0, base: 0, laps: [] });
  const elapsed = () => st.base + (st.running ? Date.now() - st.startedAt : 0);
  const save = () => s.set('state', st);

  const display = el('div', { class: 'mono', style: { fontSize: 'clamp(40px, 12vw, 84px)', fontWeight: '800', textAlign: 'center', lineHeight: 1.1, padding: '16px 0' } });
  const startBtn = el('button', { class: 'btn primary' });
  const lapBtn = el('button', { class: 'btn' }, 'Lap');
  const resetBtn = el('button', { class: 'btn ghost' }, 'Reset');
  const csvBtn = el('button', { class: 'btn' }, 'Export CSV');
  const lapsBox = el('div', { class: 'scroll-x' });
  let raf = 0, timer = 0;

  function paintTime() { display.textContent = fmt(elapsed()); }
  function paintButtons() {
    startBtn.textContent = st.running ? 'Stop' : (st.base > 0 ? 'Resume' : 'Start');
    startBtn.className = 'btn ' + (st.running ? 'danger' : 'primary');
    lapBtn.disabled = !st.running;
    resetBtn.disabled = st.running || (st.base === 0 && !st.laps.length);
    csvBtn.disabled = !st.laps.length;
  }
  function paintLaps() {
    if (!st.laps.length) { render(lapsBox, el('div', { class: 'muted small' }, 'No laps yet. Press L while running.')); return; }
    const splits = st.laps.map(l => l.split);
    const best = Math.min(...splits), worst = Math.max(...splits);
    render(lapsBox, el('table', { class: 'table mono' },
      el('thead', {}, el('tr', {}, el('th', {}, '#'), el('th', {}, 'Split'), el('th', {}, 'Total'))),
      el('tbody', {}, st.laps.slice().reverse().map((l, i) => {
        const n = st.laps.length - i;
        const color = st.laps.length > 2 ? (l.split === best ? 'var(--ok)' : l.split === worst ? 'var(--danger)' : '') : '';
        return el('tr', {}, el('td', {}, n), el('td', { style: { color } }, fmt(l.split)), el('td', {}, fmt(l.total)));
      }))));
  }
  function toggle() {
    if (st.running) { st.base = elapsed(); st.running = false; stopTick(); paintTime(); }
    else { st.startedAt = Date.now(); st.running = true; startTick(); }
    save(); paintButtons();
  }
  function lap() {
    if (!st.running) return;
    const total = elapsed(), prev = st.laps.length ? st.laps[st.laps.length - 1].total : 0;
    st.laps.push({ total, split: total - prev });
    save(); paintLaps(); paintButtons();
  }
  function reset() {
    if (st.running) return;
    st = { running: false, startedAt: 0, base: 0, laps: [] };
    save(); paintTime(); paintLaps(); paintButtons();
  }
  function exportCsv() {
    const rows = ['lap,split,total,split_ms,total_ms'].concat(st.laps.map((l, i) => `${i + 1},${fmt(l.split)},${fmt(l.total)},${Math.round(l.split)},${Math.round(l.total)}`));
    download('stopwatch-laps.csv', rows.join('\n') + '\n', 'text/csv');
  }
  function startTick() {
    const step = () => { paintTime(); raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    // rAF pauses in background tabs; keep the number fresh anyway
    timer = setInterval(paintTime, 250);
  }
  function stopTick() { cancelAnimationFrame(raf); clearInterval(timer); raf = 0; timer = 0; }

  const onKey = e => {
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) toggle(); }
    else if (e.key === 'l' || e.key === 'L') { if (!e.repeat) lap(); }
    else if (e.key === 'r' || e.key === 'R') { if (!e.repeat) reset(); }
  };
  const onKeyUp = e => { if (e.code === 'Space' && e.target && e.target.tagName === 'BUTTON') e.preventDefault(); };
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKeyUp);

  const blurAfter = fn => e => { fn(); e.currentTarget.blur(); };
  startBtn.addEventListener('click', blurAfter(toggle));
  lapBtn.addEventListener('click', blurAfter(lap));
  resetBtn.addEventListener('click', blurAfter(reset));
  csvBtn.addEventListener('click', exportCsv);

  render(root,
    display,
    el('div', { class: 'row', style: { justifyContent: 'center' } }, startBtn, lapBtn, resetBtn, csvBtn),
    el('div', { class: 'small muted center' }, el('span', { class: 'kbd' }, 'Space'), ' start/stop  ', el('span', { class: 'kbd' }, 'L'), ' lap  ', el('span', { class: 'kbd' }, 'R'), ' reset. Keeps running if you leave this page.'),
    lapsBox);
  paintTime(); paintLaps(); paintButtons();
  if (st.running) startTick();

  return () => { stopTick(); window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKeyUp); };
}
