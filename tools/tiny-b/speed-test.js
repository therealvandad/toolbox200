import { el, render, store, stat } from '../../lib/ui.js';

const BASE = 'https://speed.cloudflare.com';
const DOWN_BYTES = 25000000, UP_BYTES = 8000000, MAX_PHASE_MS = 12000;
const BLOCKED = 'Could not reach speed.cloudflare.com. It may be blocked by your network, firewall, VPN, ad blocker or privacy extension, or you may be offline.';

class UserAbort extends Error {}

export default function (root) {
  const s = store('speed-test');
  let history = s.get('history', []);
  let running = false, userStop = false, curAbort = null, curXhr = null, timers = [];

  const phase = el('div', { class: 'muted', style: { minHeight: '1.4em' } }, 'Ready.');
  const fill = el('div', { style: { width: '0%' } });
  const bar = el('div', { class: 'bar', style: { height: '14px' } }, fill);
  const live = el('div', { class: 'big mono center' }, '0.0 Mbps');
  const stats = el('div', { class: 'row', style: { justifyContent: 'center' } });
  const err = el('div', { class: 'small', style: { color: 'var(--danger)' } });
  const histBox = el('div', { class: 'scroll-x' });
  const btn = el('button', { class: 'btn primary', style: { minWidth: '140px' } }, 'Start test');
  let res = { down: null, up: null, ping: null, jitter: null };

  const f1 = v => (v == null ? '-' : v.toFixed(v < 10 ? 2 : 1));
  const meter = mbps => { fill.style.width = Math.min(100, Math.log10(1 + mbps) / 3 * 100) + '%'; live.textContent = mbps.toFixed(1) + ' Mbps'; };
  function paintStats() {
    render(stats, stat(f1(res.down), 'Download Mbps'), stat(f1(res.up), 'Upload Mbps'), stat(res.ping == null ? '-' : res.ping.toFixed(0) + ' ms', 'Latency'), stat(res.jitter == null ? '-' : res.jitter.toFixed(1) + ' ms', 'Jitter'));
  }
  function paintHist() {
    render(histBox, history.length ? el('table', { class: 'table' },
      el('thead', {}, el('tr', {}, ['When', 'Down', 'Up', 'Ping', 'Jitter'].map(h => el('th', {}, h)))),
      el('tbody', {}, history.slice().reverse().map(h => el('tr', {}, el('td', {}, new Date(h.t).toLocaleString()), el('td', {}, f1(h.down) + ' Mbps'), el('td', {}, f1(h.up) + ' Mbps'), el('td', {}, h.ping == null ? '-' : h.ping.toFixed(0) + ' ms'), el('td', {}, h.jitter == null ? '-' : h.jitter.toFixed(1) + ' ms'))))) : el('div', { class: 'muted small' }, 'No results saved yet.'));
  }
  const checkStop = () => { if (userStop) throw new UserAbort(); };
  const randQ = () => Math.random().toString(36).slice(2);

  async function latency() {
    phase.textContent = 'Measuring latency…'; meter(0);
    const times = [];
    for (let i = 0; i < 9; i++) {
      checkStop();
      const ac = curAbort = new AbortController();
      const t = performance.now();
      const r = await fetch(`${BASE}/__down?bytes=0&r=${randQ()}`, { cache: 'no-store', signal: ac.signal });
      await r.arrayBuffer();
      times.push(performance.now() - t);
      fill.style.width = ((i + 1) / 9 * 100) + '%';
    }
    const t = times.slice(1).sort((a, b) => a - b); // first request includes connection setup
    res.ping = t[Math.floor(t.length / 2)];
    const seq = times.slice(1);
    res.jitter = seq.slice(1).reduce((a, v, i) => a + Math.abs(v - seq[i]), 0) / Math.max(1, seq.length - 1);
    paintStats();
  }
  async function download() {
    phase.textContent = 'Testing download…';
    const ac = curAbort = new AbortController();
    let timedOut = false;
    const to = setTimeout(() => { timedOut = true; ac.abort(); }, MAX_PHASE_MS); timers.push(to);
    let got = 0, t0 = 0, lastPaint = 0;
    try {
      const r = await fetch(`${BASE}/__down?bytes=${DOWN_BYTES}&r=${randQ()}`, { cache: 'no-store', signal: ac.signal });
      if (!r.ok) throw new Error('Server answered ' + r.status);
      const reader = r.body.getReader();
      t0 = performance.now();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        got += value.length;
        const now = performance.now();
        if (now - lastPaint > 80) { lastPaint = now; const mbps = got * 8 / ((now - t0) / 1000) / 1e6; meter(mbps); fill.style.width = Math.max(parseFloat(fill.style.width), got / DOWN_BYTES * 100) + '%'; }
      }
    } catch (e) {
      if (userStop) throw new UserAbort();
      if (!(timedOut && got > 0)) throw e;
    } finally { clearTimeout(to); }
    const secs = (performance.now() - t0) / 1000;
    res.down = got * 8 / secs / 1e6; meter(res.down); paintStats();
  }
  function upload() {
    phase.textContent = 'Testing upload…';
    fill.style.width = '0%';
    return new Promise((resolve, reject) => {
      const bytes = new Uint8Array(UP_BYTES);
      for (let o = 0; o < bytes.length; o += 65536) crypto.getRandomValues(bytes.subarray(o, Math.min(o + 65536, bytes.length)));
      const xhr = curXhr = new XMLHttpRequest();
      let t0 = 0, loaded = 0, timedOut = false, finished = false;
      const to = setTimeout(() => { timedOut = true; xhr.abort(); }, MAX_PHASE_MS); timers.push(to);
      const finish = () => {
        if (finished) return; finished = true; clearTimeout(to);
        const secs = (performance.now() - t0) / 1000;
        if (loaded <= 0 || !t0) return reject(new Error(BLOCKED));
        res.up = loaded * 8 / secs / 1e6; meter(res.up); paintStats(); resolve();
      };
      xhr.open('POST', `${BASE}/__up?r=${randQ()}`);
      xhr.upload.onloadstart = () => { t0 = performance.now(); };
      xhr.upload.onprogress = e => {
        if (!t0) t0 = performance.now();
        loaded = e.loaded;
        const secs = (performance.now() - t0) / 1000;
        if (secs > 0.05) meter(loaded * 8 / secs / 1e6);
        fill.style.width = (loaded / UP_BYTES * 100) + '%';
      };
      xhr.onload = () => { if (xhr.status >= 400) { finished = true; clearTimeout(to); reject(new Error('Server answered ' + xhr.status)); } else { loaded = UP_BYTES; finish(); } };
      xhr.onerror = () => { if (finished) return; finished = true; clearTimeout(to); reject(new Error(BLOCKED)); };
      xhr.onabort = () => { if (userStop) { finished = true; clearTimeout(to); reject(new UserAbort()); } else if (timedOut) finish(); };
      xhr.send(new Blob([bytes]));
    });
  }

  async function run() {
    running = true; userStop = false; err.textContent = '';
    res = { down: null, up: null, ping: null, jitter: null }; paintStats(); meter(0);
    btn.textContent = 'Stop'; btn.className = 'btn danger'; btn.style.minWidth = '140px';
    try {
      await latency(); await download(); await upload();
      phase.textContent = 'Done.';
      history.push({ t: Date.now(), down: res.down, up: res.up, ping: res.ping, jitter: res.jitter });
      history = history.slice(-10); s.set('history', history); paintHist();
    } catch (e) {
      if (e instanceof UserAbort || userStop) phase.textContent = 'Stopped.';
      else {
        phase.textContent = 'Test failed.';
        err.textContent = e instanceof TypeError || /Failed to fetch|NetworkError|Load failed/i.test(e.message || '') ? BLOCKED : (e.message || BLOCKED);
      }
    } finally {
      running = false; curAbort = curXhr = null; timers.forEach(clearTimeout); timers = [];
      btn.textContent = 'Start test'; btn.className = 'btn primary';
    }
  }
  btn.addEventListener('click', () => {
    if (running) { userStop = true; if (curAbort) curAbort.abort(); if (curXhr) curXhr.abort(); }
    else run();
  });

  render(root,
    el('div', { class: 'center' }, btn),
    phase, bar, live, stats, err,
    el('div', { class: 'small muted' }, 'Runs against Cloudflare\'s public speed endpoint (about 25 MB down, 8 MB up). Results depend on your device, Wi-Fi and the route to the nearest Cloudflare server, so treat them as an estimate.'),
    el('div', { class: 'row' }, el('h3', { style: { margin: 0 } }, 'Recent results'),
      el('button', { class: 'btn small ghost', onclick: () => { history = []; s.set('history', history); paintHist(); } }, 'Clear')),
    histBox);
  paintStats(); paintHist();

  return () => {
    userStop = true;
    if (curAbort) curAbort.abort();
    if (curXhr) { try { curXhr.abort(); } catch {} }
    timers.forEach(clearTimeout); timers = [];
  };
}
