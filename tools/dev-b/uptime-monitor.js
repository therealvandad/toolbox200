// Uptime monitor: polls URLs while the page is open (fetch no-cors, image-ping fallback),
// keeps a history per URL, draws a response-time chart and exports a standalone status page.
import { el, render, store, download, toast, stat, field } from '../../lib/ui.js';

const MAX_HISTORY = 120;
const TIMEOUT = 10000;

export default function (root) {
  const s = store('uptime-monitor');
  let sites = s.get('sites', [{ url: 'https://example.com', name: 'Example' }]);
  let history = s.get('history', {});       // url -> [{t, up, ms, via}]
  let interval = s.get('interval', 30);
  let timer = null, countdown = null, nextAt = 0, selected = sites[0]?.url || '';
  let view = 'monitor';

  const save = () => { s.set('sites', sites); s.set('history', history); s.set('interval', interval); };

  // ---- checks ----
  async function fetchCheck(url) {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), TIMEOUT);
    const t0 = performance.now();
    try {
      await fetch(url, { mode: 'no-cors', cache: 'no-store', signal: ctrl.signal });
      return { up: true, ms: Math.round(performance.now() - t0), via: 'fetch' };
    } catch (e) {
      return { up: false, ms: Math.round(performance.now() - t0), via: 'fetch', err: e.name === 'AbortError' ? 'timeout' : 'network error' };
    } finally { clearTimeout(to); }
  }
  function imageCheck(url) {
    return new Promise(res => {
      const img = new Image();
      const t0 = performance.now();
      let done = false;
      const finish = (up, err) => { if (done) return; done = true; clearTimeout(to); res({ up, ms: Math.round(performance.now() - t0), via: 'image', err }); };
      const to = setTimeout(() => { img.src = ''; finish(false, 'timeout'); }, TIMEOUT);
      img.onload = () => finish(true);
      img.onerror = () => finish(false, 'image failed');
      let target;
      try { const u = new URL(url); target = u.origin + '/favicon.ico?_=' + Date.now(); } catch { target = url; }
      img.src = target;
    });
  }
  async function check(site) {
    let r = await fetchCheck(site.url);
    if (!r.up && r.err !== 'timeout') { const r2 = await imageCheck(site.url); if (r2.up) r = r2; else r.err += ' (image ping also failed)'; }
    const h = history[site.url] || (history[site.url] = []);
    h.push({ t: Date.now(), up: r.up, ms: r.ms, via: r.via, err: r.err || '' });
    if (h.length > MAX_HISTORY) h.splice(0, h.length - MAX_HISTORY);
  }
  async function pollAll() {
    if (!sites.length) return;
    statusLine.textContent = 'Checking…';
    await Promise.all(sites.map(check));
    save();
    nextAt = Date.now() + interval * 1000;
    statusLine.textContent = 'Last check ' + new Date().toLocaleTimeString();
    draw();
  }
  function start() {
    stop();
    pollAll();
    timer = setInterval(pollAll, Math.max(5, interval) * 1000);
    countdown = setInterval(() => { if (timer) nextLine.textContent = 'next in ' + Math.max(0, Math.ceil((nextAt - Date.now()) / 1000)) + 's'; }, 1000);
    startBtn.textContent = 'Stop'; startBtn.classList.add('danger');
  }
  function stop() {
    clearInterval(timer); clearInterval(countdown); timer = null; countdown = null;
    nextLine.textContent = ''; startBtn.textContent = 'Start polling'; startBtn.classList.remove('danger');
  }

  // ---- summary helpers ----
  function summary(url) {
    const h = history[url] || [];
    const ups = h.filter(x => x.up);
    const last = h[h.length - 1];
    return {
      checks: h.length,
      uptime: h.length ? (100 * ups.length / h.length) : null,
      avg: ups.length ? Math.round(ups.reduce((a, x) => a + x.ms, 0) / ups.length) : null,
      last,
      state: !last ? 'unknown' : last.up ? 'up' : 'down',
    };
  }

  // ---- UI ----
  const urlIn = el('input', { class: 'input grow', placeholder: 'https://example.com', style: { minWidth: '220px' } });
  const nameIn = el('input', { class: 'input', placeholder: 'Name (optional)', style: { width: '160px' } });
  const intIn = el('input', { class: 'input', type: 'number', min: 5, max: 3600, value: interval, style: { width: '90px' },
    onchange: () => { interval = Math.max(5, +intIn.value || 30); intIn.value = interval; save(); if (timer) start(); } });
  const startBtn = el('button', { class: 'btn primary', onclick: () => timer ? stop() : start() }, 'Start polling');
  const statusLine = el('span', { class: 'muted small' });
  const nextLine = el('span', { class: 'muted small' });
  const list = el('ul', { class: 'list' });
  const chart = el('canvas', { width: 900, height: 220, style: { width: '100%', height: 'auto', display: 'block' } });
  const chartTitle = el('div', { class: 'small muted' });
  const statusPage = el('div');
  const tabMon = el('button', { class: 'btn small primary', onclick: () => setView('monitor') }, 'Monitor');
  const tabStat = el('button', { class: 'btn small', onclick: () => setView('status') }, 'Status page');
  const monitorView = el('div');
  const statusView = el('div', { class: 'hidden' });

  function addSite() {
    let url = urlIn.value.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    try { new URL(url); } catch { toast('Not a valid URL'); return; }
    if (sites.some(x => x.url === url)) { toast('Already in the list'); return; }
    sites.push({ url, name: nameIn.value.trim() || new URL(url).hostname });
    urlIn.value = ''; nameIn.value = ''; selected = selected || url; save(); draw();
    if (timer) check(sites[sites.length - 1]).then(() => { save(); draw(); });
  }
  urlIn.addEventListener('keydown', e => { if (e.key === 'Enter') addSite(); if (e.key === 'Escape') urlIn.value = ''; });
  nameIn.addEventListener('keydown', e => { if (e.key === 'Enter') addSite(); });

  function badge(state) {
    return el('span', { class: 'badge ' + (state === 'up' ? 'ok' : state === 'down' ? 'danger' : '') }, state.toUpperCase());
  }

  function drawList() {
    render(list, sites.length ? sites.map(site => {
      const sm = summary(site.url);
      return el('li', { style: site.url === selected ? { background: 'var(--bg)', borderRadius: '6px' } : {} },
        badge(sm.state),
        el('div', { class: 'grow', style: { cursor: 'pointer', minWidth: 0 }, onclick: () => { selected = site.url; draw(); } },
          el('div', {}, site.name, ' ', el('span', { class: 'muted small mono', style: { wordBreak: 'break-all' } }, site.url)),
          el('div', { class: 'muted small' },
            sm.checks ? `${sm.uptime.toFixed(1)}% up · ${sm.checks} checks · avg ${sm.avg == null ? '—' : sm.avg + ' ms'}` : 'no checks yet',
            sm.last && !sm.last.up ? ` · ${sm.last.err}` : '',
            sm.last ? ` · ${sm.last.ms} ms via ${sm.last.via}` : '')),
        el('button', { class: 'btn small', title: 'Check now', onclick: async () => { await check(site); save(); draw(); } }, 'Check'),
        el('button', { class: 'btn small ghost', title: 'Remove', onclick: () => { sites = sites.filter(x => x !== site); delete history[site.url]; if (selected === site.url) selected = sites[0]?.url || ''; save(); draw(); } }, '✕'));
    }) : el('li', { class: 'muted' }, 'Add a URL to start monitoring.'));
  }

  function drawChart() {
    const ctx = chart.getContext('2d');
    const W = chart.width, H = chart.height;
    const cs = getComputedStyle(root);
    const col = { text: cs.getPropertyValue('--muted').trim() || '#888', line: cs.getPropertyValue('--line').trim() || '#ccc', accent: cs.getPropertyValue('--accent').trim() || '#36c', ok: cs.getPropertyValue('--ok').trim() || '#2a2', danger: cs.getPropertyValue('--danger').trim() || '#c33' };
    ctx.clearRect(0, 0, W, H);
    const h = history[selected] || [];
    const site = sites.find(x => x.url === selected);
    chartTitle.textContent = site ? `Response time — ${site.name} (last ${h.length} checks)` : 'Select a site to see its chart';
    if (!h.length) { ctx.fillStyle = col.text; ctx.font = '14px system-ui'; ctx.fillText('No data yet', 20, 30); return; }
    const padL = 48, padR = 10, padT = 10, padB = 40;
    const cw = W - padL - padR, ch = H - padT - padB;
    const max = Math.max(100, ...h.map(x => x.ms));
    ctx.strokeStyle = col.line; ctx.fillStyle = col.text; ctx.font = '11px system-ui'; ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padT + ch - (ch * i / 4);
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
      ctx.fillText(Math.round(max * i / 4) + ' ms', 4, y + 4);
    }
    const bw = cw / h.length;
    // up/down strip
    h.forEach((x, i) => {
      ctx.fillStyle = x.up ? col.ok : col.danger;
      ctx.fillRect(padL + i * bw, H - padB + 8, Math.max(1, bw - 1), 10);
    });
    // line
    ctx.strokeStyle = col.accent; ctx.lineWidth = 2; ctx.beginPath();
    let started = false;
    h.forEach((x, i) => {
      if (!x.up) { started = false; return; }
      const px = padL + i * bw + bw / 2, py = padT + ch - (x.ms / max) * ch;
      if (!started) { ctx.moveTo(px, py); started = true; } else ctx.lineTo(px, py);
    });
    ctx.stroke();
    ctx.fillStyle = col.accent;
    h.forEach((x, i) => { if (x.up) { const px = padL + i * bw + bw / 2, py = padT + ch - (x.ms / max) * ch; ctx.beginPath(); ctx.arc(px, py, 2.5, 0, 7); ctx.fill(); } });
    ctx.fillStyle = col.text;
    ctx.fillText(new Date(h[0].t).toLocaleTimeString(), padL, H - 4);
    const lastLabel = new Date(h[h.length - 1].t).toLocaleTimeString();
    ctx.fillText(lastLabel, W - padR - ctx.measureText(lastLabel).width, H - 4);
  }

  function statusHTML(standalone) {
    const rows = sites.map(site => {
      const sm = summary(site.url);
      const colr = sm.state === 'up' ? '#22a35a' : sm.state === 'down' ? '#d64545' : '#999';
      const bars = (history[site.url] || []).slice(-60).map(x => `<span title="${new Date(x.t).toLocaleString()} ${x.up ? x.ms + ' ms' : 'down'}" style="display:inline-block;width:6px;height:22px;margin-right:2px;border-radius:2px;background:${x.up ? '#22a35a' : '#d64545'}"></span>`).join('');
      return `<div style="padding:14px 0;border-bottom:1px solid #8884">
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
          <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${colr}"></span>
          <strong>${esc(site.name)}</strong>
          <span style="opacity:.7;font-size:13px;word-break:break-all">${esc(site.url)}</span>
          <span style="margin-left:auto;font-weight:600;color:${colr}">${sm.state.toUpperCase()}</span>
        </div>
        <div style="font-size:13px;opacity:.75;margin:4px 0 8px">${sm.checks ? `${sm.uptime.toFixed(2)}% uptime over ${sm.checks} checks · avg ${sm.avg == null ? '—' : sm.avg + ' ms'} · last ${new Date(sm.last.t).toLocaleString()}` : 'No checks yet'}</div>
        <div style="line-height:0">${bars}</div>
      </div>`;
    }).join('');
    const allUp = sites.length && sites.every(x => summary(x.url).state === 'up');
    const body = `<h1 style="margin:0 0 4px">Status</h1>
      <div style="font-size:15px;margin-bottom:16px;color:${allUp ? '#22a35a' : '#d64545'}">${sites.length ? (allUp ? 'All systems operational' : 'Some systems are having issues') : 'No services configured'}</div>
      ${rows}
      <div style="font-size:12px;opacity:.6;margin-top:14px">Generated ${new Date().toLocaleString()} by Toolbox 200 uptime monitor. Checks run from the browser that generated this page.</div>`;
    if (!standalone) return body;
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Status</title>
<style>body{margin:0;padding:24px;font:15px/1.5 system-ui,sans-serif;background:#fff;color:#1a1a1a}@media(prefers-color-scheme:dark){body{background:#111;color:#eee}}main{max-width:760px;margin:0 auto}</style></head><body><main>${body}</main></body></html>`;
  }
  const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function setView(v) {
    view = v;
    monitorView.classList.toggle('hidden', v !== 'monitor');
    statusView.classList.toggle('hidden', v !== 'status');
    tabMon.classList.toggle('primary', v === 'monitor');
    tabStat.classList.toggle('primary', v === 'status');
    draw();
  }

  function draw() {
    drawList();
    if (view === 'monitor') drawChart();
    else statusPage.innerHTML = statusHTML(false);
    const total = sites.length, up = sites.filter(x => summary(x.url).state === 'up').length;
    render(stats, stat(total, 'sites'), stat(up, 'up'), stat(sites.filter(x => summary(x.url).state === 'down').length, 'down'), stat(timer ? interval + 's' : 'off', 'interval'));
  }
  const stats = el('div', { class: 'row' });

  render(monitorView,
    el('div', { class: 'row' }, urlIn, nameIn, el('button', { class: 'btn', onclick: addSite }, 'Add')),
    el('div', { class: 'row' }, field('Interval (s)', intIn), startBtn, statusLine, nextLine,
      el('button', { class: 'btn ghost small', onclick: () => { history = {}; save(); draw(); toast('History cleared'); } }, 'Clear history')),
    stats,
    list,
    chartTitle,
    el('div', { class: 'canvas-wrap' }, chart),
    el('p', { class: 'muted small' }, 'How it works: a fetch with mode "no-cors" returns an opaque response when the host answers (reachable), and rejects on DNS/connection failure. If it fails, a favicon image ping is tried. Response time includes connection setup. Monitoring runs only while this tab is open; history is kept in localStorage.'));

  render(statusView,
    el('div', { class: 'row' },
      el('button', { class: 'btn primary', onclick: () => download('status.html', statusHTML(true), 'text/html') }, 'Export standalone HTML'),
      el('button', { class: 'btn', onclick: () => { statusPage.innerHTML = statusHTML(false); toast('Refreshed'); } }, 'Refresh')),
    el('div', { class: 'panel' }, statusPage));

  render(root, el('div', { class: 'row' }, tabMon, tabStat), monitorView, statusView);
  draw();

  return () => stop();
}
